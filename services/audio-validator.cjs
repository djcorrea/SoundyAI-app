// WAV validation uses ffprobe instead of MIME to support PCM 24-bit and DAW exports safely.

/**
 * Audio Validator
 * 
 * Validações de segurança para arquivos de áudio usando ffprobe.
 * Suporta WAV PCM 16/24/32-bit e exports de DAWs profissionais.
 * 
 * Validações:
 * - Extensão .wav
 * - Tamanho máximo
 * - Codec PCM válido via ffprobe
 * - Sample rate >= 44100 Hz
 * - Channels >= 1
 * - Duração máxima
 * 
 * @module services/audio-validator
 */

const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

// =============================================================================
// CONFIGURAÇÃO
// =============================================================================

const MAX_DURATION_MINUTES = parseInt(process.env.MAX_DURATION_MINUTES || '15', 10);
const MAX_FILE_MB = parseInt(process.env.MAX_FILE_MB || '120', 10);
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// =============================================================================
// VALIDAÇÕES
// =============================================================================

/**
 * Valida tamanho do arquivo
 * 
 * @param {Buffer} buffer - Buffer do arquivo
 * @returns {boolean}
 */
function validateFileSize(buffer) {
  return buffer.length <= MAX_FILE_BYTES;
}

/**
 * Valida extensão do arquivo
 * 
 * @param {string} filename - Nome do arquivo
 * @returns {boolean}
 */
function validateWavExtension(filename) {
  return filename.toLowerCase().endsWith('.wav');
}

/**
 * Valida áudio completo via ffprobe (determinístico)
 * 
 * Valida:
 * - Arquivo contém stream de áudio
 * - Codec é PCM (pcm_s16le, pcm_s24le, pcm_s32le, etc)
 * - Sample rate >= 44100 Hz
 * - Channels >= 1
 * - Duração <= MAX_DURATION_MINUTES
 * 
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<{valid: boolean, errors: string[], metadata: object}>}
 */
async function validateAudioWithFFProbe(filePath) {
  const errors = [];
  let metadata = {};

  try {
    // Executar ffprobe com output JSON
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      filePath
    ]);

    const probeResult = JSON.parse(stdout);

    // Validar estrutura básica
    if (!probeResult.streams || probeResult.streams.length === 0) {
      errors.push('No streams found in file');
      return { valid: false, errors, metadata };
    }

    // Encontrar stream de áudio
    const audioStream = probeResult.streams.find(s => s.codec_type === 'audio');

    if (!audioStream) {
      errors.push('No audio stream found');
      return { valid: false, errors, metadata };
    }

    // Validar codec PCM
    if (!audioStream.codec_name || !audioStream.codec_name.startsWith('pcm_')) {
      errors.push(`Invalid codec: ${audioStream.codec_name || 'unknown'} (only PCM supported)`);
    }

    // Validar sample rate
    const sampleRate = parseInt(audioStream.sample_rate, 10);
    if (isNaN(sampleRate) || sampleRate < 44100) {
      errors.push(`Invalid sample rate: ${audioStream.sample_rate} Hz (minimum 44100 Hz)`);
    }

    // Validar channels
    const channels = parseInt(audioStream.channels, 10);
    if (isNaN(channels) || channels < 1) {
      errors.push(`Invalid channels: ${audioStream.channels}`);
    }

    // Validar duração
    let duration = 0;
    if (probeResult.format && probeResult.format.duration) {
      duration = parseFloat(probeResult.format.duration);
    } else if (audioStream.duration) {
      duration = parseFloat(audioStream.duration);
    }

    const maxSeconds = MAX_DURATION_MINUTES * 60;
    if (duration > maxSeconds) {
      const actualMinutes = Math.floor(duration / 60);
      const actualSeconds = Math.floor(duration % 60);
      errors.push(`Duration exceeds ${MAX_DURATION_MINUTES} minutes (actual: ${actualMinutes}m ${actualSeconds}s)`);
    }

    // Metadata para debug
    metadata = {
      codec: audioStream.codec_name,
      sample_rate: sampleRate,
      channels: channels,
      duration: duration,
      bit_depth: audioStream.bits_per_raw_sample || audioStream.bits_per_sample || 'unknown'
    };

    return {
      valid: errors.length === 0,
      errors,
      metadata
    };

  } catch (error) {
    // ffprobe falhou (arquivo corrompido ou não é áudio)
    if (error.code === 'ENOENT') {
      errors.push('Audio validation failed: ffprobe not found');
    } else {
      errors.push(`Audio validation failed: ${error.message}`);
    }

    return { valid: false, errors, metadata };
  }
}

/**
 * Validação completa do arquivo
 * 
 * @param {string} filePath - Caminho do arquivo salvo
 * @param {string} originalName - Nome original do arquivo
 * @param {number} fileSize - Tamanho do arquivo em bytes
 * @returns {Promise<{valid: boolean, errors: string[], metadata: object}>}
 */
async function validateAudioFile(filePath, originalName, fileSize) {
  const errors = [];

  // 1. Validar extensão
  if (!validateWavExtension(originalName)) {
    errors.push('Invalid file extension (only .wav allowed)');
  }

  // 2. Validar tamanho
  if (fileSize > MAX_FILE_BYTES) {
    errors.push(`File size exceeds ${MAX_FILE_MB}MB limit`);
  }

  // Se validações básicas falharam, não executar ffprobe
  if (errors.length > 0) {
    return { valid: false, errors, metadata: {} };
  }

  // 3. Validação profunda via ffprobe
  const ffprobeResult = await validateAudioWithFFProbe(filePath);

  // Combinar erros
  errors.push(...ffprobeResult.errors);

  return {
    valid: errors.length === 0,
    errors,
    metadata: ffprobeResult.metadata
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  validateFileSize,
  validateWavExtension,
  validateAudioWithFFProbe,
  validateAudioFile
};
