/**
 * Audio Decoder - Fase 5.1 do Pipeline de Migração
 * 
 * Substituição do Web Audio API (decodeAudioData + AudioBuffer) por decodificação server-side
 * Converte arquivos WAV/FLAC para Float32Array normalizado (-1.0 a 1.0)
 * 
 * Requisitos críticos:
 * - Entrada: apenas WAV e FLAC
 * - Sample rate fixo: 48000 Hz
 * - Estéreo (2 canais sempre)
 * - Formato: 32-bit float PCM
 * - Saída: Float32Array equivalente ao AudioBuffer.getChannelData()
 * 
 * Implementação: Dezembro 2024
 */

import { spawn } from 'child_process';
import { readFile, writeFile, unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

// Caminho absoluto do FFmpeg/FFprobe no Windows
const FFMPEG_PATH = "C:/Users/DJ Correa/Desktop/Programação/processamento no beckend/ffmpeg/bin/ffmpeg.exe";
const FFPROBE_PATH = "C:/Users/DJ Correa/Desktop/Programação/processamento no beckend/ffmpeg/bin/ffprobe.exe";


// Configurações fixas do pipeline (NÃO ALTERAR)
const SAMPLE_RATE = 48000;
const CHANNELS = 2; // Estéreo
const BIT_DEPTH = 32; // Float32
const SUPPORTED_FORMATS = ['.wav', '.flac'];
const MAX_DURATION_SECONDS = 600; // 10 minutos máximo

/**
 * Validar formato de arquivo suportado
 */
function validateFileFormat(filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('INVALID_FILENAME: Nome do arquivo inválido');
  }
  
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  if (!SUPPORTED_FORMATS.includes(extension)) {
    throw new Error(`UNSUPPORTED_FORMAT: Apenas ${SUPPORTED_FORMATS.join(', ')} são suportados. Recebido: ${extension}`);
  }
  
  return extension;
}

/**
 * Gerar nome de arquivo temporário único
 */
function generateTempFilename(extension) {
  const randomId = randomBytes(8).toString('hex');
  const timestamp = Date.now();
  return join(tmpdir(), `soundy_audio_${timestamp}_${randomId}${extension}`);
}

/**
 * Converter arquivo para WAV PCM usando FFmpeg
 * 
 * @param {Buffer} inputBuffer - Buffer do arquivo de entrada
 * @param {string} inputFormat - Formato de entrada (.wav ou .flac)
 * @returns {Promise<Buffer>} - Buffer do WAV convertido
 */
async function convertToWavPcm(inputBuffer, inputFormat) {
  const inputTempFile = generateTempFilename(inputFormat);
  const outputTempFile = generateTempFilename('.wav');
  
  try {
    // Salvar buffer de entrada em arquivo temporário
    await writeFile(inputTempFile, inputBuffer);
    
    // Comando FFmpeg para conversão
    const ffmpegArgs = [
      '-i', inputTempFile,           // Arquivo de entrada
      '-ar', SAMPLE_RATE.toString(), // Sample rate: 48000 Hz
      '-ac', CHANNELS.toString(),    // Canais: 2 (estéreo)
      '-c:a', 'pcm_f32le',          // Codec: PCM Float32 Little Endian
      '-f', 'wav',                  // Formato: WAV
      '-y',                         // Sobrescrever arquivo existente
      outputTempFile                // Arquivo de saída
    ];
    
    console.log(`[AUDIO_DECODER] Executando FFmpeg: ffmpeg ${ffmpegArgs.join(' ')}`);
    console.log(`[AUDIO_DECODER] Convertendo para: 48kHz estéreo Float32 PCM`);
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs, {
  stdio: ['pipe', 'pipe', 'pipe']
});

      
      let stderr = '';
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ffmpeg.on('close', async (code) => {
        try {
          // Limpar arquivo de entrada
          await unlink(inputTempFile).catch(() => {});
          
          if (code !== 0) {
            console.error(`[AUDIO_DECODER] FFmpeg erro (código ${code}):`, stderr);
            reject(new Error(`FFMPEG_ERROR: Falha na conversão (código ${code})`));
            return;
          }
          
          // Ler arquivo convertido
          const outputBuffer = await readFile(outputTempFile);
          
          // Limpar arquivo de saída
          await unlink(outputTempFile).catch(() => {});
          
          console.log(`[AUDIO_DECODER] Conversão concluída: ${outputBuffer.length} bytes`);
          resolve(outputBuffer);
          
        } catch (error) {
          console.error(`[AUDIO_DECODER] Erro no pós-processamento:`, error);
          reject(new Error(`CONVERSION_ERROR: ${error.message}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        console.error(`[AUDIO_DECODER] Erro no spawn FFmpeg:`, error);
        reject(new Error(`FFMPEG_SPAWN_ERROR: ${error.message}`));
      });
    });
    
  } catch (error) {
    // Limpar arquivos temporários em caso de erro
    await unlink(inputTempFile).catch(() => {});
    await unlink(outputTempFile).catch(() => {});
    throw error;
  }
}

/**
 * Decodificar WAV PCM para Float32Array
 * 
 * @param {Buffer} wavBuffer - Buffer do arquivo WAV
 * @returns {Object} - Dados de áudio decodificados
 */
function decodeWavPcm(wavBuffer) {
  try {
    // Verificar cabeçalho WAV mínimo
    if (wavBuffer.length < 44) {
      throw new Error('WAV_INVALID: Arquivo WAV muito pequeno (< 44 bytes)');
    }
    
    // Verificar assinatura RIFF
    const riffSignature = wavBuffer.toString('ascii', 0, 4);
    if (riffSignature !== 'RIFF') {
      throw new Error(`WAV_INVALID: Assinatura RIFF inválida: ${riffSignature}`);
    }
    
    // Verificar formato WAV
    const waveSignature = wavBuffer.toString('ascii', 8, 12);
    if (waveSignature !== 'WAVE') {
      throw new Error(`WAV_INVALID: Assinatura WAVE inválida: ${waveSignature}`);
    }
    
    // Localizar chunk 'fmt '
    let fmtChunkOffset = -1;
    let dataChunkOffset = -1;
    let offset = 12; // Após RIFF header
    
    while (offset < wavBuffer.length - 8) {
      const chunkId = wavBuffer.toString('ascii', offset, offset + 4);
      const chunkSize = wavBuffer.readUInt32LE(offset + 4);
      
      if (chunkId === 'fmt ') {
        fmtChunkOffset = offset + 8;
      } else if (chunkId === 'data') {
        dataChunkOffset = offset + 8;
        break;
      }
      
      offset += 8 + chunkSize;
      
      // Alinhamento para chunks ímpares
      if (chunkSize % 2 === 1) {
        offset += 1;
      }
    }
    
    if (fmtChunkOffset === -1) {
      throw new Error('WAV_INVALID: Chunk fmt não encontrado');
    }
    
    if (dataChunkOffset === -1) {
      throw new Error('WAV_INVALID: Chunk data não encontrado');
    }
    
    // Ler informações do chunk fmt
    const audioFormat = wavBuffer.readUInt16LE(fmtChunkOffset);
    const numChannels = wavBuffer.readUInt16LE(fmtChunkOffset + 2);
    const sampleRate = wavBuffer.readUInt32LE(fmtChunkOffset + 4);
    const bitsPerSample = wavBuffer.readUInt16LE(fmtChunkOffset + 14);
    
    console.log(`[AUDIO_DECODER] WAV Info: ${audioFormat === 3 ? 'Float' : 'Int'} ${bitsPerSample}-bit, ${numChannels}ch, ${sampleRate}Hz`);
    
    // Validar formato esperado
    if (audioFormat !== 3) { // IEEE Float
      throw new Error(`WAV_FORMAT_ERROR: Esperado Float PCM (3), recebido: ${audioFormat}`);
    }
    
    if (bitsPerSample !== 32) {
      throw new Error(`WAV_FORMAT_ERROR: Esperado 32-bit, recebido: ${bitsPerSample}-bit`);
    }
    
    if (sampleRate !== SAMPLE_RATE) {
      throw new Error(`WAV_FORMAT_ERROR: Esperado ${SAMPLE_RATE}Hz, recebido: ${sampleRate}Hz`);
    }
    
    if (numChannels !== CHANNELS) {
      throw new Error(`WAV_FORMAT_ERROR: Esperado ${CHANNELS} canal(is), recebido: ${numChannels}`);
    }
    
    // Calcular tamanho dos dados
    const dataSize = wavBuffer.readUInt32LE(dataChunkOffset - 4);
    const bytesPerSample = 4; // Float32 = 4 bytes
    const totalSamples = dataSize / (numChannels * bytesPerSample);
    const samplesPerChannel = Math.floor(totalSamples);
    
    // Validar duração máxima
    const duration = samplesPerChannel / sampleRate;
    if (duration > MAX_DURATION_SECONDS) {
      throw new Error(`DURATION_ERROR: Arquivo muito longo (${duration.toFixed(1)}s > ${MAX_DURATION_SECONDS}s)`);
    }
    
    // Extrair dados de áudio como Float32Array para cada canal
    const leftChannel = new Float32Array(samplesPerChannel);
    const rightChannel = new Float32Array(samplesPerChannel);
    
    for (let i = 0; i < samplesPerChannel; i++) {
      const sampleOffset = i * numChannels; // Offset em samples (não bytes)
      const byteOffset = dataChunkOffset + (sampleOffset * bytesPerSample);
      
      if (byteOffset + (numChannels * bytesPerSample) > wavBuffer.length) {
        console.warn(`[AUDIO_DECODER] Truncando em ${i}/${samplesPerChannel} samples devido ao fim do buffer`);
        break;
      }
      
      // Ler samples dos dois canais (intercalados)
      const leftSample = wavBuffer.readFloatLE(byteOffset);
      const rightSample = wavBuffer.readFloatLE(byteOffset + bytesPerSample);
      
      // Clamp para range válido (-1.0 a 1.0)
      leftChannel[i] = Math.max(-1.0, Math.min(1.0, leftSample));
      rightChannel[i] = Math.max(-1.0, Math.min(1.0, rightSample));
    }
    
    // Verificar se dados são válidos
    const validLeftSamples = leftChannel.filter(s => !isNaN(s) && isFinite(s));
    const validRightSamples = rightChannel.filter(s => !isNaN(s) && isFinite(s));
    
    if (validLeftSamples.length === 0 || validRightSamples.length === 0) {
      throw new Error('WAV_DATA_ERROR: Nenhum sample válido encontrado em um ou ambos os canais');
    }
    
    if (validLeftSamples.length < leftChannel.length * 0.9 || validRightSamples.length < rightChannel.length * 0.9) {
      console.warn(`[AUDIO_DECODER] Aviso: samples inválidos detectados (L: ${leftChannel.length - validLeftSamples.length}, R: ${rightChannel.length - validRightSamples.length})`);
    }
    
    console.log(`[AUDIO_DECODER] Decodificação concluída: ${samplesPerChannel} samples por canal, ${duration.toFixed(2)}s estéreo`);
    
    return {
      sampleRate: SAMPLE_RATE,
      numberOfChannels: CHANNELS,
      length: samplesPerChannel,
      duration: duration,
      data: leftChannel,  // Canal esquerdo como principal (compatibilidade)
      leftChannel: leftChannel,
      rightChannel: rightChannel
    };
    
  } catch (error) {
    console.error(`[AUDIO_DECODER] Erro na decodificação WAV:`, error);
    throw error;
  }
}

/**
 * Função principal: decodificar arquivo de áudio
 * 
 * @param {Buffer} fileBuffer - Buffer do arquivo de áudio
 * @param {string} filename - Nome do arquivo (para determinar formato)
 * @returns {Promise<Object>} - Dados de áudio compatíveis com AudioBuffer
 */
export async function decodeAudioFile(fileBuffer, filename) {
  const startTime = Date.now();
  
  try {
    console.log(`[AUDIO_DECODER] Iniciando decodificação: ${filename} (${fileBuffer.length} bytes)`);
    
    // Validar formato
    const inputFormat = validateFileFormat(filename);
    console.log(`[AUDIO_DECODER] Formato detectado: ${inputFormat}`);
    
    // Validar tamanho máximo (100MB)
    const maxSizeBytes = 100 * 1024 * 1024;
    if (fileBuffer.length > maxSizeBytes) {
      throw new Error(`FILE_TOO_LARGE: Arquivo muito grande (${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB > 100MB)`);
    }
    
    // Converter para WAV PCM usando FFmpeg
    const wavBuffer = await convertToWavPcm(fileBuffer, inputFormat);
    
    // Decodificar WAV para Float32Array
    const audioData = decodeWavPcm(wavBuffer);
    
    const processingTime = Date.now() - startTime;
    console.log(`[AUDIO_DECODER] Decodificação concluída em ${processingTime}ms`);
    
    // Adicionar método getChannelData para compatibilidade total com AudioBuffer
    const audioBufferCompatible = {
      ...audioData,
      getChannelData: function(channel) {
        if (channel === 0) return this.leftChannel || this.data;
        if (channel === 1) return this.rightChannel || this.data;
        throw new Error(`Canal ${channel} não existe. Canais disponíveis: 0 (esquerdo), 1 (direito)`);
      },
      _metadata: {
        originalFormat: inputFormat,
        originalSize: fileBuffer.length,
        processingTime: processingTime,
        decodedAt: new Date().toISOString(),
        stereoProcessing: true
      }
    };
    
    // Retornar no formato compatível com AudioBuffer
    return audioBufferCompatible;
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[AUDIO_DECODER] Erro após ${processingTime}ms:`, error);
    
    // Re-throw com contexto adicional
    const enhancedError = new Error(`DECODE_FAILED: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.filename = filename;
    enhancedError.fileSize = fileBuffer.length;
    enhancedError.processingTime = processingTime;
    
    throw enhancedError;
  }
}

/**
 * Verificar se FFmpeg está disponível
 */
export async function checkFFmpegAvailable() {
  return new Promise((resolve) => {
    const ffmpeg = spawn(FFMPEG_PATH, ['-version'], { stdio: 'pipe' });

    
    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });
    
    ffmpeg.on('error', () => {
      resolve(false);
    });
    
    // Timeout de 5 segundos
    setTimeout(() => {
      ffmpeg.kill();
      resolve(false);
    }, 5000);
  });
}

/**
 * Obter informações de um arquivo de áudio sem decodificar
 */
export async function getAudioInfo(fileBuffer, filename) {
  const inputFormat = validateFileFormat(filename);
  const inputTempFile = generateTempFilename(inputFormat);
  
  try {
    await writeFile(inputTempFile, fileBuffer);
    
    const ffprobeArgs = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      inputTempFile
    ];
    
    return new Promise((resolve, reject) => {
      const ffprobe = spawn(FFPROBE_PATH, ffprobeArgs, { stdio: 'pipe' });
      
      let stdout = '';
      let stderr = '';
      
      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      ffprobe.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ffprobe.on('close', async (code) => {
        await unlink(inputTempFile).catch(() => {});
        
        if (code !== 0) {
          reject(new Error(`FFPROBE_ERROR: ${stderr}`));
          return;
        }
        
        try {
          const info = JSON.parse(stdout);
          const audioStream = info.streams.find(s => s.codec_type === 'audio');
          
          if (!audioStream) {
            reject(new Error('NO_AUDIO_STREAM: Nenhum stream de áudio encontrado'));
            return;
          }
          
          resolve({
            format: info.format.format_name,
            duration: parseFloat(info.format.duration),
            bitrate: parseInt(info.format.bit_rate),
            sampleRate: parseInt(audioStream.sample_rate),
            channels: parseInt(audioStream.channels),
            codec: audioStream.codec_name,
            bitDepth: audioStream.bits_per_raw_sample || audioStream.bits_per_sample
          });
          
        } catch (error) {
          reject(new Error(`FFPROBE_PARSE_ERROR: ${error.message}`));
        }
      });
      
      ffprobe.on('error', async (error) => {
        await unlink(inputTempFile).catch(() => {});
        reject(new Error(`FFPROBE_SPAWN_ERROR: ${error.message}`));
      });
    });
    
  } catch (error) {
    await unlink(inputTempFile).catch(() => {});
    throw error;
  }
}

// Export da função principal
export default decodeAudioFile;
