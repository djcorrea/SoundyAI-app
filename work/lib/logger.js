/**
 * 🔇 LOGGER CENTRAL - Sistema de Logging Controlado
 * 
 * Objetivo: Reduzir drasticamente logs no Railway (limite 500 logs/sec)
 * 
 * Níveis:
 * - error: sempre loga (erros críticos + stack trace)
 * - warn: sempre loga (avisos importantes)
 * - info: controlado por LOG_LEVEL
 * - debug: controlado por LOG_LEVEL
 * - debugFFT: controlado por FFT_DEBUG (logs de FFT/spectrum/bandas)
 * 
 * ENV Variables:
 * - LOG_LEVEL=error|warn|info|debug (padrão: warn)
 * - FFT_DEBUG=true|false (padrão: false)
 * - LOG_SAMPLE_N=0-100 (padrão: 0 = desabilitado, 50 = loga 1 em cada 50)
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'warn';
const FFT_DEBUG = process.env.FFT_DEBUG === 'true';
const LOG_SAMPLE_N = parseInt(process.env.LOG_SAMPLE_N || '0', 10);

const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLevel = LEVELS[LOG_LEVEL] ?? LEVELS.warn;

// Contador para sampling
let sampleCounter = 0;

/**
 * Helper: Resumo de array grande para evitar logging gigante
 * @param {Array|Float32Array} arr - Array para resumir
 * @returns {Object} Resumo {len, min, max, avg}
 */
export function summarizeArray(arr) {
  if (!arr || arr.length === 0) {
    return { len: 0, min: null, max: null, avg: null };
  }
  
  let min = arr[0];
  let max = arr[0];
  let sum = 0;
  
  for (let i = 0; i < arr.length; i++) {
    const val = arr[i];
    if (val < min) min = val;
    if (val > max) max = val;
    sum += val;
  }
  
  return {
    len: arr.length,
    min: min.toFixed(3),
    max: max.toFixed(3),
    avg: (sum / arr.length).toFixed(3)
  };
}

/**
 * Verifica se deve fazer sampling (para logs info)
 * @returns {boolean}
 */
function shouldSample() {
  if (LOG_SAMPLE_N === 0) return false;
  sampleCounter++;
  if (sampleCounter >= LOG_SAMPLE_N) {
    sampleCounter = 0;
    return true;
  }
  return false;
}

/**
 * Logger principal
 */
class Logger {
  /**
   * ERROR: sempre loga, preserva stack trace
   */
  error(message, ...args) {
    console.error('[ERROR]', message, ...args);
  }

  /**
   * WARN: sempre loga
   */
  warn(message, ...args) {
    if (currentLevel >= LEVELS.warn) {
      console.warn('[WARN]', message, ...args);
    }
  }

  /**
   * INFO: loga se LOG_LEVEL >= info
   * Respeita sampling se configurado
   */
  info(message, ...args) {
    if (currentLevel >= LEVELS.info) {
      if (LOG_SAMPLE_N > 0 && !shouldSample()) {
        return; // Pula este log (sampling)
      }
      console.log('[INFO]', message, ...args);
    }
  }

  /**
   * DEBUG: loga se LOG_LEVEL === debug
   */
  debug(message, ...args) {
    if (currentLevel >= LEVELS.debug) {
      console.log('[DEBUG]', message, ...args);
    }
  }

  /**
   * DEBUG FFT: loga APENAS se FFT_DEBUG=true
   * 
   * Use para:
   * - Loops por banda/bin/frame
   * - Arrays FFT/spectrum/magnitude
   * - Métricas por frame (spectral bands, centroid, etc)
   * - Qualquer log dentro de loop de análise
   * 
   * NUNCA logue arrays grandes diretamente! Use summarizeArray()
   */
  debugFFT(message, ...args) {
    if (FFT_DEBUG) {
      // Detectar se há arrays grandes nos args e avisar
      const hasLargeArray = args.some(arg => {
        if (Array.isArray(arg) || arg instanceof Float32Array) {
          return arg.length > 100;
        }
        return false;
      });
      
      if (hasLargeArray) {
        console.warn('[FFT_DEBUG] ⚠️ Array grande detectado! Use summarizeArray()');
      }
      
      console.log('[FFT_DEBUG]', message, ...args);
    }
  }

  /**
   * Log de início de análise (sempre útil, mas conciso)
   */
  analysisStart(analysisId, params) {
    this.info('🎵 Analysis START', {
      id: analysisId?.substring?.(0, 8) || analysisId,
      mode: params.mode,
      genre: params.genre,
      fileName: params.fileName
    });
  }

  /**
   * Log de fim de análise (sempre útil)
   */
  analysisEnd(analysisId, durationMs, summary = {}) {
    this.info('✅ Analysis END', {
      id: analysisId?.substring?.(0, 8) || analysisId,
      duration_ms: durationMs,
      ...summary
    });
  }

  /**
   * Log de métricas resumidas (NÃO por banda)
   */
  metrics(label, data) {
    this.info(`📊 ${label}`, data);
  }
}

// Singleton
const logger = new Logger();

export default logger;

// Named exports para conveniência
export const {
  error,
  warn,
  info,
  debug,
  debugFFT,
  analysisStart,
  analysisEnd,
  metrics
} = logger;
