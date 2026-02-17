/**
 * ============================================================================
 * ERROR CLASSIFIER - CLASSIFICAÇÃO DE ERROS
 * ============================================================================
 * 
 * Determina se erro é recuperável (retry) ou não-recuperável (fail).
 * 
 * RECOVERABLE: rede, storage temporário, timeout transient
 * NON_RECOVERABLE: arquivo inválido, codec não suportado, limites excedidos
 * 
 * Autor: SoundyAI Engineering
 * Data: 2026-02-11
 * ============================================================================
 */

const ERROR_TYPES = {
  RECOVERABLE: 'RECOVERABLE',
  NON_RECOVERABLE: 'NON_RECOVERABLE'
};

const ERROR_CODES = {
  // Não-recuperáveis
  INVALID_INPUT: 'INVALID_INPUT',
  CODEC_UNSUPPORTED: 'CODEC_UNSUPPORTED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  DURATION_TOO_LONG: 'DURATION_TOO_LONG',
  INVALID_AUDIO: 'INVALID_AUDIO',
  CORRUPTED_FILE: 'CORRUPTED_FILE',
  LOCK_LOST: 'LOCK_LOST',
  
  // Recuperáveis
  NETWORK_ERROR: 'NETWORK_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  TIMEOUT: 'TIMEOUT',
  REDIS_ERROR: 'REDIS_ERROR',
  UNKNOWN: 'UNKNOWN'
};

/**
 * Classifica erro e retorna tipo + código
 */
function classifyError(error) {
  const message = error.message || '';
  const stack = error.stack || '';
  const combined = (message + ' ' + stack).toLowerCase();

  // Lock perdido durante processamento (não-recuperável, não deve retry)
  if (combined.includes('lock_lost')) {
    return {
      type: ERROR_TYPES.NON_RECOVERABLE,
      code: ERROR_CODES.LOCK_LOST,
      message: 'Worker perdeu ownership do lock'
    };
  }

  // FFmpeg errors característicos de problemas não-recuperáveis
  if (
    combined.includes('invalid codec') ||
    combined.includes('unknown codec') ||
    combined.includes('codec not supported') ||
    combined.includes('invalid data found')
  ) {
    return {
      type: ERROR_TYPES.NON_RECOVERABLE,
      code: ERROR_CODES.CODEC_UNSUPPORTED,
      message: 'Codec de áudio não suportado'
    };
  }

  if (
    combined.includes('invalid wav') ||
    combined.includes('no audio stream') ||
    combined.includes('could not find codec')
  ) {
    return {
      type: ERROR_TYPES.NON_RECOVERABLE,
      code: ERROR_CODES.INVALID_AUDIO,
      message: 'Arquivo de áudio inválido'
    };
  }

  if (combined.includes('corrupted') || combined.includes('damaged')) {
    return {
      type: ERROR_TYPES.NON_RECOVERABLE,
      code: ERROR_CODES.CORRUPTED_FILE,
      message: 'Arquivo corrompido'
    };
  }

  // Limites excedidos
  if (combined.includes('file too large') || combined.includes('size limit')) {
    return {
      type: ERROR_TYPES.NON_RECOVERABLE,
      code: ERROR_CODES.FILE_TOO_LARGE,
      message: 'Arquivo excede tamanho máximo'
    };
  }

  if (combined.includes('duration too long') || combined.includes('duration limit')) {
    return {
      type: ERROR_TYPES.NON_RECOVERABLE,
      code: ERROR_CODES.DURATION_TOO_LONG,
      message: 'Duração excede limite máximo'
    };
  }

  // Erros de validação de input
  if (
    combined.includes('validation failed') ||
    combined.includes('invalid input') ||
    combined.includes('invalid file')
  ) {
    return {
      type: ERROR_TYPES.NON_RECOVERABLE,
      code: ERROR_CODES.INVALID_INPUT,
      message: 'Input inválido'
    };
  }

  // Erros de rede/storage (recuperáveis)
  if (
    combined.includes('econnrefused') ||
    combined.includes('econnreset') ||
    combined.includes('etimedout') ||
    combined.includes('network') ||
    combined.includes('socket hang up') ||
    combined.includes('connect timeout')
  ) {
    return {
      type: ERROR_TYPES.RECOVERABLE,
      code: ERROR_CODES.NETWORK_ERROR,
      message: 'Erro de rede temporário'
    };
  }

  // Erros de storage (apenas 5xx são recuperáveis)
  if (
    combined.includes('500') ||
    combined.includes('502') ||
    combined.includes('503') ||
    combined.includes('504') ||
    combined.includes('storage') ||
    combined.includes('download failed') ||
    combined.includes('upload failed') ||
    combined.includes('s3') ||
    combined.includes('b2')
  ) {
    return {
      type: ERROR_TYPES.RECOVERABLE,
      code: ERROR_CODES.STORAGE_ERROR,
      message: 'Erro de storage temporário'
    };
  }

  // Timeout
  if (combined.includes('timeout') || combined.includes('timed out')) {
    return {
      type: ERROR_TYPES.RECOVERABLE,
      code: ERROR_CODES.TIMEOUT,
      message: 'Timeout excedido'
    };
  }

  // Redis
  if (combined.includes('redis') || combined.includes('connection lost')) {
    return {
      type: ERROR_TYPES.RECOVERABLE,
      code: ERROR_CODES.REDIS_ERROR,
      message: 'Erro de conexão Redis'
    };
  }

  // 404 - arquivo não existe (não-recuperável)
  if (combined.includes('404') || combined.includes('not found') || combined.includes('no such file')) {
    return {
      type: ERROR_TYPES.NON_RECOVERABLE,
      code: ERROR_CODES.INVALID_INPUT,
      message: 'Arquivo não encontrado'
    };
  }

  // Default: NÃO-RECUPERÁVEL (evita retry infinito em erros desconhecidos)
  return {
    type: ERROR_TYPES.NON_RECOVERABLE,
    code: ERROR_CODES.UNKNOWN,
    message: error.message || 'Erro interno desconhecido'
  };
}

/**
 * Verifica se deve fazer retry
 */
function shouldRetry(errorClassification, attempt, maxAttempts) {
  if (errorClassification.type === ERROR_TYPES.NON_RECOVERABLE) {
    return false;
  }

  return attempt < maxAttempts;
}

/**
 * Calcula delay de backoff exponencial
 */
function getRetryDelay(attempt) {
  const delays = [10000, 30000, 90000]; // 10s, 30s, 90s
  return delays[Math.min(attempt - 1, delays.length - 1)];
}

module.exports = {
  ERROR_TYPES,
  ERROR_CODES,
  classifyError,
  shouldRetry,
  getRetryDelay
};
