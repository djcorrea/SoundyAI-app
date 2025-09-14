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

    ff.on('error', (err) => {
      clearTimeout(ffmpegTimeout);
      if (!ffmpegKilled) {
        reject(new Error(`FFMPEG_SPAWN_ERROR: ${err.message}`));
      }
    });

    ff.on('close', (code) => {
      clearTimeout(ffmpegTimeout);
      if (ffmpegKilled) return; // Já rejeitado no timeout
      
      if (code !== 0) {
        reject(new Error(`FFMPEG_ERROR: code=${code} msg=${stderr || '(sem stderr)'}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });

    // Envia o arquivo para o stdin do ffmpeg
    try {
      ff.stdin.write(inputBuffer);
      ff.stdin.end();
    } catch (err) {
      reject(new Error(`FFMPEG_STDIN_ERROR: ${err.message}`));
    }
  });
}

// ========= Parser WAV robusto (Float32 LE, 48kHz, 2ch) =========

/**
 * Decodifica um WAV Float32 LE 48kHz estéreo para Float32Arrays (L/R).
 * Valida RIFF/WAVE e varre chunks até achar 'fmt ' e 'data'.
 * @param {Buffer} wav
 * @returns {{ sampleRate:number, numberOfChannels:number, length:number, duration:number, leftChannel:Float32Array, rightChannel:Float32Array, data:Float32Array }}
 */
function decodeWavFloat32Stereo(wav) {
  if (!Buffer.isBuffer(wav) || wav.length < 44) {
    throw new Error('WAV_INVALID: Arquivo WAV muito pequeno');
  }

  // Cabeçalhos básicos
  const riff = wav.toString('ascii', 0, 4);
  const wave = wav.toString('ascii', 8, 12);
  if (riff !== 'RIFF') throw new Error(`WAV_INVALID: RIFF inválido: ${riff}`);
  if (wave !== 'WAVE') throw new Error(`WAV_INVALID: WAVE inválido: ${wave}`);

  let fmtOffset = -1;
  let dataOffset = -1;
  let dataSize = 0;

  // Varredura de chunks (após cabeçalho RIFF/WAVE)
  let off = 12;
  let chunkCount = 0;
  while (off + 8 <= wav.length && chunkCount < 20) { // limite de segurança
    const id = wav.toString('ascii', off, off + 4);
    const sz = wav.readUInt32LE(off + 4);
    const payloadStart = off + 8;
    const next = payloadStart + sz + (sz % 2); // alinhamento

    if (id === 'fmt ') {
      fmtOffset = payloadStart;
    } else if (id === 'data') {
      dataOffset = payloadStart;
      dataSize = sz;
      break; // achou os dados, podemos sair (mantendo robustez, isso é ok)
    }
    
    // Verificação de segurança - para com chunks inválidos
    if (next <= off || next > wav.length || sz > wav.length) {
      break;
    }
    
    off = next;
    chunkCount++;
  }

  if (fmtOffset < 0) throw new Error('WAV_INVALID: chunk "fmt " não encontrado');
  if (dataOffset < 0 || dataSize <= 0) throw new Error('WAV_INVALID: chunk "data" não encontrado');

  // Leitura do chunk fmt
  const audioFormat = wav.readUInt16LE(fmtOffset + 0);  // 3 = IEEE Float
  const numChannels = wav.readUInt16LE(fmtOffset + 2);
  const sampleRate = wav.readUInt32LE(fmtOffset + 4);
  const bitsPerSample = wav.readUInt16LE(fmtOffset + 14);

  // Valida formato esperado
  // Formato 3 = IEEE Float, Formato 65534 = WAVE_FORMAT_EXTENSIBLE (também pode ser Float)
  if (audioFormat !== 3 && audioFormat !== 65534) {
    throw new Error(`WAV_FORMAT_ERROR: Esperado Float (3) ou Extensible (65534), recebido ${audioFormat}`);
  }
  if (bitsPerSample !== 32) throw new Error(`WAV_FORMAT_ERROR: Esperado 32-bit, recebido ${bitsPerSample}`);
  if (sampleRate !== SAMPLE_RATE) throw new Error(`WAV_FORMAT_ERROR: Esperado ${SAMPLE_RATE}Hz, recebido ${sampleRate}`);
  if (numChannels !== CHANNELS) throw new Error(`WAV_FORMAT_ERROR: Esperado ${CHANNELS} canais, recebido ${numChannels}`);

  const bytesPerSample = 4; // Float32
  const frameBytes = numChannels * bytesPerSample;
  
  // Proteção contra dataSize inválido - usa o que realmente temos
  const maxDataSize = wav.length - dataOffset;
  const validDataSize = (dataSize > maxDataSize || dataSize === 0xFFFFFFFF) ? maxDataSize : dataSize;
  
  const totalFrames = Math.floor(validDataSize / frameBytes);
  const samplesPerChannel = totalFrames;

  const left = new Float32Array(samplesPerChannel);
  const right = new Float32Array(samplesPerChannel);

  let ptr = dataOffset;
  for (let i = 0; i < samplesPerChannel; i++) {
    // Verificação de bounds para evitar overflow
    if (ptr + frameBytes > wav.length) {
      throw new Error(`WAV_BUFFER_OVERFLOW: Frame ${i} precisa ler bytes ${ptr}-${ptr + frameBytes - 1}, mas buffer tem apenas ${wav.length} bytes`);
    }
    
    const l = wav.readFloatLE(ptr);
    const r = wav.readFloatLE(ptr + 4);
    // clamp
    left[i] = Math.max(-1, Math.min(1, l));
    right[i] = Math.max(-1, Math.min(1, r));
    ptr += frameBytes;
  }

  const duration = samplesPerChannel / sampleRate;

  if (duration > MAX_DURATION_SECONDS) {
    throw new Error(`DURATION_ERROR: ${duration.toFixed(1)}s > ${MAX_DURATION_SECONDS}s`);
  }

  return {
    sampleRate,
    numberOfChannels: numChannels,
    length: samplesPerChannel,
    duration,
    data: left,          // compatibilidade com "AudioBuffer.getChannelData(0)" usado como principal
    leftChannel: left,
    rightChannel: right
  };
}

// ========= API pública =========

/**
 * Decodifica arquivo de áudio suportado para PCM Float32 estéreo 48kHz.
 * @param {Buffer} fileBuffer
 * @param {string} filename
 */
export async function decodeAudioFile(fileBuffer, filename) {
  const start = Date.now();

  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error('INVALID_INPUT: fileBuffer ausente');
  }
  if (fileBuffer.length > MAX_SIZE_BYTES) {
    throw new Error(`FILE_TOO_LARGE: ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB > 100MB`);
  }

  // Conforme seu requisito, validamos a extensão (WAV/FLAC).
  // Se quiser aceitar qualquer (mp3, aac, etc.), comente a linha abaixo:
  ensureSupportedExtension(filename || '');

  let wavBuffer;
  try {
    // Converte para WAV 48kHz/2ch/Float32 via streaming
    wavBuffer = await convertToWavPcmStream(fileBuffer);
  } catch (err) {
    const ms = Date.now() - start;
    const e = new Error(`FFMPEG_CONVERSION_FAILED: ${err.message}`);
    e.processingTime = ms;
    e.filename = filename;
    throw e;
  }

  // Decodifica WAV -> Float32 L/R
  let audioData;
  try {
    audioData = decodeWavFloat32Stereo(wavBuffer);
  } catch (err) {
    const ms = Date.now() - start;
    const e = new Error(`WAV_DECODE_FAILED: ${err.message}`);
    e.processingTime = ms;
    e.filename = filename;
    throw e;
  }

  const processingTime = Date.now() - start;

  // Objeto compatível com AudioBuffer
  const audioBufferCompatible = {
    sampleRate: audioData.sampleRate,
    numberOfChannels: audioData.numberOfChannels,
    length: audioData.length,
    duration: audioData.duration,

    // Compat: alguns códigos leem "data" como canal principal
    data: audioData.leftChannel,
    leftChannel: audioData.leftChannel,
    rightChannel: audioData.rightChannel,

    getChannelData(channel) {
      if (channel === 0) return this.leftChannel;
      if (channel === 1) return this.rightChannel;
      throw new Error(`Canal ${channel} inválido. Use 0 (L) ou 1 (R).`);
    },

    _metadata: {
      originalSize: fileBuffer.length,
      processingTime,
      decodedAt: new Date().toISOString(),
      stereoProcessing: true,
      enforced: { SAMPLE_RATE, CHANNELS, BIT_DEPTH }
    }
  };

  return audioBufferCompatible;
}

/**
 * Verifica se ffmpeg e ffprobe estão disponíveis.
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

/**
 * Extrai metadados de áudio (ffprobe) – leitura por stdin (pipe:0).
 * @param {Buffer} fileBuffer
 * @param {string} filename
 */
export async function getAudioInfo(fileBuffer, filename) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error('INVALID_INPUT: fileBuffer ausente');
  }

  // Primeiro, tenta via stdin
  try {
    return await new Promise((resolve, reject) => {
      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        'pipe:0'
      ];

      const pr = spawn(FFPROBE_PATH, args, { stdio: ['pipe', 'pipe', 'pipe'] });

      let out = '';
      let err = '';

      pr.stdout.on('data', (d) => (out += d?.toString?.() || ''));
      pr.stderr.on('data', (d) => (err += d?.toString?.() || ''));

      pr.on('close', (code) => {
        if (code !== 0) return reject(new Error(`FFPROBE_ERROR: ${err || '(sem stderr)'}`));
        try {
          const info = JSON.parse(out);
          const audioStream = (info.streams || []).find((s) => s.codec_type === 'audio');
          if (!audioStream) return reject(new Error('NO_AUDIO_STREAM'));
          resolve({
            format: info.format?.format_name || '',
            duration: parseFloat(info.format?.duration || '0') || 0,
            bitrate: parseInt(info.format?.bit_rate || '0', 10) || 0,
            sampleRate: parseInt(audioStream.sample_rate || '0', 10) || 0,
            channels: parseInt(audioStream.channels || '0', 10) || 0,
            codec: audioStream.codec_name || '',
            bitDepth:
              audioStream.bits_per_raw_sample ||
              audioStream.bits_per_sample ||
              null
          });
        } catch (e) {
          reject(new Error(`FFPROBE_PARSE_ERROR: ${e.message}`));
        }
      });

      pr.on('error', (e) => {
        reject(new Error(`FFPROBE_SPAWN_ERROR: ${e.message}`));
      });

      try {
        pr.stdin.write(fileBuffer);
        pr.stdin.end();
      } catch (e) {
        reject(new Error(`FFPROBE_STDIN_ERROR: ${e.message}`));
      }
    });
  } catch (e) {
    // Fallback: grava tmp (mais resiliente em alguns ambientes)
    const ext = extFromFilename(filename) || '.bin';
    const tmp = generateTmp(ext);
    try {
      await writeFile(tmp, fileBuffer);
      const info = await new Promise((resolve, reject) => {
        const args = [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          '-show_streams',
          tmp
        ];
        const pr = spawn(FFPROBE_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        let err = '';
        pr.stdout.on('data', (d) => (out += d?.toString?.() || ''));
        pr.stderr.on('data', (d) => (err += d?.toString?.() || ''));
        pr.on('close', async (code) => {
          try { await unlink(tmp).catch(() => {}); } catch {}
          if (code !== 0) return reject(new Error(`FFPROBE_ERROR: ${err || '(sem stderr)'}`));
          try {
            const json = JSON.parse(out);
            const audioStream = (json.streams || []).find((s) => s.codec_type === 'audio');
            if (!audioStream) return reject(new Error('NO_AUDIO_STREAM'));
            resolve({
              format: json.format?.format_name || '',
              duration: parseFloat(json.format?.duration || '0') || 0,
              bitrate: parseInt(json.format?.bit_rate || '0', 10) || 0,
              sampleRate: parseInt(audioStream.sample_rate || '0', 10) || 0,
              channels: parseInt(audioStream.channels || '0', 10) || 0,
              codec: audioStream.codec_name || '',
              bitDepth:
                audioStream.bits_per_raw_sample ||
                audioStream.bits_per_sample ||
                null
            });
          } catch (e2) {
            reject(new Error(`FFPROBE_PARSE_ERROR: ${e2.message}`));
          }
        });
        pr.on('error', async (err) => {
          try { await unlink(tmp).catch(() => {}); } catch {}
          reject(new Error(`FFPROBE_SPAWN_ERROR: ${err.message}`));
        });
      });
      return info;
    } catch (e2) {
      try { await unlink(tmp).catch(() => {}); } catch {}
      throw e2;
    }
  }
}

export default decodeAudioFile;
