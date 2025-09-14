/**
 * Audio Decoder – Fase 5.1 (Servidor) - CORRIGIDO
 * Decodifica WAV/MP3 para PCM Float32 estéreo 48kHz com validações rigorosas.
 * Implementa fail-fast, guards contra NaN/Infinity, política de canais explícita.
 */

import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { writeFile, unlink } from 'fs/promises';

// Sistema de tratamento de erros padronizado
import { makeErr, ensureFiniteArray, logAudio, removeDCOffset, detectClipping } from '../../lib/audio/error-handling.js';

// Paths portáteis do ffmpeg/ffprobe
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStaticPkg from 'ffprobe-static';

const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';
const FFPROBE_PATH =
  process.env.FFPROBE_PATH ||
  (ffprobeStaticPkg && (ffprobeStaticPkg.path || ffprobeStaticPkg)) ||
  'ffprobe';

// ========= CONFIGURAÇÕES FIXAS (AUDITORIA) =========
const SAMPLE_RATE = 48000;
const CHANNELS = 2;               // Estéreo fixo - política explícita
const BIT_DEPTH = 32;             // Float32
const MAX_DURATION_SECONDS = 600; // 10 minutos
const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const SUPPORTED_EXTS = ['.wav', '.mp3', '.flac']; // WAV/MP3 conforme solicitado

// ========= POLÍTICA DE CANAIS (EXPLÍCITA) =========
// REGRA: Sempre normalizar para ESTÉREO (2 canais)
// - Se mono: duplicar para L=R
// - Se estéreo: manter L,R  
// - Se surround: downmix para estéreo (L+R)
// Esta política é aplicada CONSISTENTEMENTE em todo o pipeline

function extFromFilename(filename) {
  if (!filename || typeof filename !== 'string') return '';
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i).toLowerCase() : '';
}

function validateSupportedFormat(filename) {
  const ext = extFromFilename(filename);
  if (!ext || !SUPPORTED_EXTS.includes(ext)) {
    throw makeErr('decode', `Formato não suportado. Aceitos: ${SUPPORTED_EXTS.join(', ')}. Recebido: ${ext || '(sem extensão)'}`, 'unsupported_format');
  }
  return ext;
}

function generateTmp(ext) {
  const id = randomBytes(8).toString('hex');
  return join(tmpdir(), `audio_${Date.now()}_${id}${ext}`);
}

// ========= CONVERSÃO COM FFMPEG (FAIL-FAST) =========

/**
 * Converte arquivo para WAV PCM Float32 48kHz estéreo com validações rigorosas
 * @param {Buffer} inputBuffer - Buffer do arquivo de áudio
 * @param {string} filename - Nome do arquivo para logs
 * @returns {Promise<Buffer>} WAV convertido (Float32 LE, 48kHz, 2ch)
 */
async function convertToWavPcmStream(inputBuffer, filename) {
  return new Promise((resolve, reject) => {
    // Validação de entrada
    if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
      reject(makeErr('decode', 'Buffer de entrada inválido ou vazio', 'invalid_input'));
      return;
    }

    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-nostdin',
      '-i', 'pipe:0',        // entrada via stdin
      '-vn',                 // sem vídeo
      '-ar', String(SAMPLE_RATE),
      '-ac', String(CHANNELS), // força estéreo
      '-c:a', 'pcm_f32le',   // Float32 LE
      '-f', 'wav',
      'pipe:1'               // saída via stdout
    ];

    const ff = spawn(FFMPEG_PATH, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderr = '';
    const chunks = [];
    let ffmpegKilled = false;

    // 🔥 TIMEOUT PROTECTION
    const ffmpegTimeout = setTimeout(() => {
      console.warn(`⚠️ FFmpeg timeout para ${filename} - matando processo...`);
      ffmpegKilled = true;
      ff.kill('SIGKILL');
      reject(makeErr('decode', `FFmpeg timeout após 2 minutos para: ${filename}`, 'ffmpeg_timeout'));
    }, 120000);

    ff.stdout.on('data', (d) => chunks.push(d));
    ff.stderr.on('data', (d) => (stderr += d?.toString?.() || ''));

    ff.on('error', (err) => {
      clearTimeout(ffmpegTimeout);
      if (!ffmpegKilled) {
        reject(makeErr('decode', `FFmpeg spawn error: ${err.message}`, 'ffmpeg_spawn_error'));
      }
    });

    ff.on('close', (code) => {
      clearTimeout(ffmpegTimeout);
      if (ffmpegKilled) return; // Já rejeitado no timeout
      
      if (code !== 0) {
        const errorMsg = stderr || '(sem stderr)';
        reject(makeErr('decode', `FFmpeg falhou (code=${code}): ${errorMsg}`, 'ffmpeg_conversion_failed'));
        return;
      }
      
      const outputBuffer = Buffer.concat(chunks);
      if (outputBuffer.length === 0) {
        reject(makeErr('decode', 'FFmpeg retornou buffer vazio', 'ffmpeg_empty_output'));
        return;
      }
      
      resolve(outputBuffer);
    });

    // Enviar dados para stdin do FFmpeg
    try {
      ff.stdin.write(inputBuffer);
      ff.stdin.end();
    } catch (err) {
      clearTimeout(ffmpegTimeout);
      reject(makeErr('decode', `Erro ao escrever no stdin do FFmpeg: ${err.message}`, 'ffmpeg_stdin_error'));
    }
  });
}

// ========= PARSER WAV ROBUSTO (FAIL-FAST) =========

/**
 * Decodifica WAV Float32 LE 48kHz estéreo para Float32Arrays com validações rigorosas
 * @param {Buffer} wav - Buffer WAV
 * @param {string} filename - Nome do arquivo para logs
 * @returns {Object} Dados de áudio estruturados
 */
function decodeWavFloat32Stereo(wav, filename) {
  if (!Buffer.isBuffer(wav) || wav.length < 44) {
    throw makeErr('decode', `WAV inválido: arquivo muito pequeno (${wav.length} bytes)`, 'wav_too_small');
  }

  // Validar cabeçalhos básicos
  const riff = wav.toString('ascii', 0, 4);
  const wave = wav.toString('ascii', 8, 12);
  
  if (riff !== 'RIFF') {
    throw makeErr('decode', `WAV inválido: RIFF header inválido: "${riff}"`, 'wav_invalid_riff');
  }
  if (wave !== 'WAVE') {
    throw makeErr('decode', `WAV inválido: WAVE header inválido: "${wave}"`, 'wav_invalid_wave');
  }

  let fmtOffset = -1;
  let dataOffset = -1;
  let dataSize = 0;

  // Buscar chunks fmt e data
  let off = 12;
  let chunkCount = 0;
  
  while (off + 8 <= wav.length && chunkCount < 20) {
    const id = wav.toString('ascii', off, off + 4);
    const sz = wav.readUInt32LE(off + 4);
    const payloadStart = off + 8;
    const next = payloadStart + sz + (sz % 2); // alinhamento

    if (id === 'fmt ') {
      fmtOffset = payloadStart;
    } else if (id === 'data') {
      dataOffset = payloadStart;
      dataSize = sz;
      break; // dados encontrados, podemos parar
    }
    
    // Proteção contra chunks inválidos
    if (next <= off || next > wav.length || sz > wav.length) {
      break;
    }
    
    off = next;
    chunkCount++;
  }

  if (fmtOffset < 0) {
    throw makeErr('decode', 'WAV inválido: chunk "fmt " não encontrado', 'wav_missing_fmt');
  }
  if (dataOffset < 0 || dataSize <= 0) {
    throw makeErr('decode', 'WAV inválido: chunk "data" não encontrado ou vazio', 'wav_missing_data');
  }

  // Validar formato
  const audioFormat = wav.readUInt16LE(fmtOffset + 0);
  const numChannels = wav.readUInt16LE(fmtOffset + 2);
  const sampleRate = wav.readUInt32LE(fmtOffset + 4);
  const bitsPerSample = wav.readUInt16LE(fmtOffset + 14);

  // Validações rigorosas do formato
  if (audioFormat !== 3 && audioFormat !== 65534) {
    throw makeErr('decode', `WAV: formato não suportado. Esperado Float (3) ou Extensible (65534), recebido ${audioFormat}`, 'wav_unsupported_format');
  }
  if (bitsPerSample !== 32) {
    throw makeErr('decode', `WAV: bit depth não suportado. Esperado 32-bit, recebido ${bitsPerSample}`, 'wav_unsupported_bitdepth');
  }
  if (sampleRate !== SAMPLE_RATE) {
    throw makeErr('decode', `WAV: sample rate não suportado. Esperado ${SAMPLE_RATE}Hz, recebido ${sampleRate}`, 'wav_unsupported_samplerate');
  }
  if (numChannels !== CHANNELS) {
    throw makeErr('decode', `WAV: número de canais não suportado. Esperado ${CHANNELS} canais, recebido ${numChannels}`, 'wav_unsupported_channels');
  }

  // Calcular amostras
  const bytesPerSample = 4; // Float32
  const frameBytes = numChannels * bytesPerSample;
  const maxDataSize = wav.length - dataOffset;
  const validDataSize = (dataSize > maxDataSize || dataSize === 0xFFFFFFFF) ? maxDataSize : dataSize;
  const totalFrames = Math.floor(validDataSize / frameBytes);
  const samplesPerChannel = totalFrames;

  if (samplesPerChannel === 0) {
    throw makeErr('decode', 'WAV: dados de áudio vazios', 'wav_no_audio_data');
  }

  // Decodificar amostras
  const left = new Float32Array(samplesPerChannel);
  const right = new Float32Array(samplesPerChannel);

  let ptr = dataOffset;
  for (let i = 0; i < samplesPerChannel; i++) {
    // Verificação de bounds
    if (ptr + frameBytes > wav.length) {
      throw makeErr('decode', `WAV: buffer overflow no frame ${i}. Precisa ${ptr + frameBytes} bytes, tem ${wav.length}`, 'wav_buffer_overflow');
    }
    
    const l = wav.readFloatLE(ptr);
    const r = wav.readFloatLE(ptr + 4);
    
    // Validar amostras individuais
    if (!Number.isFinite(l)) {
      throw makeErr('decode', `WAV: amostra não finita no canal esquerdo, frame ${i}: ${l}`, 'wav_non_finite_sample');
    }
    if (!Number.isFinite(r)) {
      throw makeErr('decode', `WAV: amostra não finita no canal direito, frame ${i}: ${r}`, 'wav_non_finite_sample');
    }
    
    // Clamp para [-1, 1]
    left[i] = Math.max(-1, Math.min(1, l));
    right[i] = Math.max(-1, Math.min(1, r));
    
    ptr += frameBytes;
  }

  const duration = samplesPerChannel / sampleRate;
  
  // Validar duração
  if (duration > MAX_DURATION_SECONDS) {
    throw makeErr('decode', `WAV: duração muito longa: ${duration.toFixed(1)}s > ${MAX_DURATION_SECONDS}s`, 'wav_duration_too_long');
  }

  return {
    sampleRate,
    numberOfChannels: numChannels,
    length: samplesPerChannel,
    duration,
    data: left,          // Canal principal para compatibilidade
    leftChannel: left,
    rightChannel: right
  };
}

// ========= API PÚBLICA =========

/**
 * Decodifica arquivo de áudio para PCM Float32 estéreo 48kHz - FASE 5.1
 * @param {Buffer} fileBuffer - Buffer do arquivo
 * @param {string} filename - Nome do arquivo
 * @param {Object} options - Opções (jobId para logs)
 */
export async function decodeAudioFile(fileBuffer, filename, options = {}) {
  const jobId = options.jobId || 'unknown';
  const stage = 'decode';
  const start = Date.now();

  try {
    logAudio(stage, 'start', { fileName: filename, jobId });

    // ========= VALIDAÇÕES DE ENTRADA =========
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      throw makeErr(stage, 'Buffer de entrada ausente ou inválido', 'invalid_input');
    }
    
    if (fileBuffer.length === 0) {
      throw makeErr(stage, 'Buffer de entrada vazio', 'empty_input');
    }
    
    if (fileBuffer.length > MAX_SIZE_BYTES) {
      throw makeErr(stage, `Arquivo muito grande: ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB > 100MB`, 'file_too_large');
    }

    // Validar formato suportado
    validateSupportedFormat(filename || '');

    // ========= CONVERSÃO FFmpeg =========
    let wavBuffer;
    try {
      wavBuffer = await convertToWavPcmStream(fileBuffer, filename);
    } catch (err) {
      // Re-propagar erros do FFmpeg com contexto
      if (err.stage === 'decode') {
        throw err; // Já é um erro estruturado
      }
      throw makeErr(stage, `FFmpeg conversion failed: ${err.message}`, 'ffmpeg_conversion_failed');
    }

    // ========= DECODIFICAÇÃO WAV =========
    let audioData;
    try {
      audioData = decodeWavFloat32Stereo(wavBuffer, filename);
    } catch (err) {
      if (err.stage === 'decode') {
        throw err; // Já é um erro estruturado
      }
      throw makeErr(stage, `WAV decode failed: ${err.message}`, 'wav_decode_failed');
    }

    // ========= PÓS-PROCESSAMENTO (OPCIONAL) =========
    
    // Remover DC offset (filtro 20Hz)
    const leftProcessed = removeDCOffset(audioData.leftChannel, audioData.sampleRate, 20);
    const rightProcessed = removeDCOffset(audioData.rightChannel, audioData.sampleRate, 20);
    
    // Validar que pós-processamento não introduziu NaN/Infinity
    ensureFiniteArray(leftProcessed, stage, 'left channel after DC removal');
    ensureFiniteArray(rightProcessed, stage, 'right channel after DC removal');
    
    // Detectar clipping
    const clippingLeft = detectClipping(leftProcessed);
    const clippingRight = detectClipping(rightProcessed);
    const clippingTotal = {
      clippedSamples: clippingLeft.clippedSamples + clippingRight.clippedSamples,
      totalSamples: clippingLeft.totalSamples + clippingRight.totalSamples,
      clippingPct: ((clippingLeft.clippedSamples + clippingRight.clippedSamples) / (clippingLeft.totalSamples + clippingRight.totalSamples)) * 100
    };

    // ========= RESULTADO FINAL =========
    const processingTime = Date.now() - start;

    const audioBufferCompatible = {
      sampleRate: audioData.sampleRate,
      numberOfChannels: audioData.numberOfChannels,
      length: audioData.length,
      duration: audioData.duration,

      // Canais processados (sem DC offset)
      data: leftProcessed,           // Canal principal
      leftChannel: leftProcessed,
      rightChannel: rightProcessed,

      getChannelData(channel) {
        if (channel === 0) return this.leftChannel;
        if (channel === 1) return this.rightChannel;
        throw makeErr(stage, `Canal inválido: ${channel}. Use 0 (L) ou 1 (R).`, 'invalid_channel');
      },

      _metadata: {
        originalSize: fileBuffer.length,
        processingTime,
        decodedAt: new Date().toISOString(),
        stage: '5.1-decode',
        format: extFromFilename(filename),
        clipping: clippingTotal,
        dcRemoval: true,
        channelPolicy: 'force_stereo',
        enforced: { SAMPLE_RATE, CHANNELS, BIT_DEPTH }
      }
    };

    logAudio(stage, 'done', {
      ms: processingTime,
      meta: {
        sampleRate: audioData.sampleRate,
        channels: audioData.numberOfChannels,
        duration: audioData.duration.toFixed(2),
        clippingPct: clippingTotal.clippingPct.toFixed(1)
      }
    });

    return audioBufferCompatible;

  } catch (error) {
    const processingTime = Date.now() - start;
    
    // Log do erro
    logAudio(stage, 'error', {
      code: error.code || 'unknown',
      message: error.message,
      stackSnippet: error.stackSnippet
    });
    
    // Re-propagar erro estruturado
    if (error.stage === stage) {
      throw error; // Já é nosso erro estruturado
    }
    
    // Erro inesperado - estruturar
    throw makeErr(stage, error.message || String(error), 'unexpected_error');
  }
}

/**
 * Verifica se ffmpeg está disponível
 */
export async function checkFFmpegAvailable() {
  const test = (bin, args = ['-version']) =>
    new Promise((resolve) => {
      const p = spawn(bin, args, { stdio: ['ignore', 'ignore', 'ignore'] });
      p.on('close', (code) => resolve(code === 0));
      p.on('error', () => resolve(false));
      setTimeout(() => { try { p.kill(); } catch {} resolve(false); }, 5000);
    });

  const okFfmpeg = await test(FFMPEG_PATH);
  const okFfprobe = await test(FFPROBE_PATH);

  return { ffmpeg: okFfmpeg, ffprobe: okFfprobe, FFMPEG_PATH, FFPROBE_PATH };
}

export default decodeAudioFile;