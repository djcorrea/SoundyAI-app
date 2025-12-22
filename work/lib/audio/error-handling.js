// 🚨 SISTEMA DE TRATAMENTO DE ERROS PADRONIZADO - FASES 5.1-5.4
// Implementa makeErr() e guards para fail-fast sem valores fictícios

/**
 * Cria erro padronizado com stage explícito
 * @param {string} stage - "decode" | "segmentation" | "core_metrics" | "output_scoring"
 * @param {string|Error} errorOrMessage - Erro original ou mensagem
 * @param {string} code - Código específico do erro (opcional)
 */
export function makeErr(stage, errorOrMessage, code = null) {
  const message = typeof errorOrMessage === 'string' 
    ? errorOrMessage 
    : errorOrMessage?.message || 'Unknown error';
    
  const originalStack = typeof errorOrMessage === 'object' 
    ? errorOrMessage?.stack 
    : null;
    
  // Stack snippet (primeiras 3 linhas)
  const stackSnippet = originalStack 
    ? originalStack.split('\n').slice(0, 3).join('\n')
    : null;
    
  const error = new Error(`[${stage.toUpperCase()}] ${message}`);
  
  error.stage = stage;
  error.code = code || 'unknown';
  error.originalMessage = message;
  error.stackSnippet = stackSnippet;
  error.timestamp = new Date().toISOString();
  
  return error;
}

/**
 * Garante que array seja finito (sem NaN/Infinity)
 * @param {Float32Array|Array} arr - Array para validar
 * @param {string} stage - Stage atual para erro
 * @param {string} context - Contexto adicional
 */
export function ensureFiniteArray(arr, stage, context = '') {
  if (!arr || !arr.length) {
    throw makeErr(stage, `Empty buffer${context ? ': ' + context : ''}`, 'empty_buffer');
  }
  
  for (let i = 0; i < arr.length; i++) {
    if (!Number.isFinite(arr[i])) {
      throw makeErr(
        stage, 
        `Non-finite sample at index ${i}${context ? ' in ' + context : ''}: ${arr[i]}`, 
        'non_finite_sample'
      );
    }
  }
  
  return arr;
}

/**
 * Valida que todas as métricas numéricas sejam finitas
 * @param {Object} obj - Objeto com métricas
 * @param {string} stage - Stage atual
 */
export function assertFinite(obj, stage) {
  function checkValue(value, path) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw makeErr(stage, `Non-finite metric at ${path}: ${value}`, 'non_finite_metric');
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'number' && !Number.isFinite(item)) {
          throw makeErr(stage, `Non-finite value in array ${path}[${index}]: ${item}`, 'non_finite_array_value');
        }
      });
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, val]) => {
        checkValue(val, `${path}.${key}`);
      });
    }
  }
  
  Object.entries(obj).forEach(([key, value]) => {
    checkValue(value, key);
  });
}

/**
 * Logger estruturado para pipeline de áudio
 * @param {string} stage - Stage atual
 * @param {string} action - "start" | "done" | "error"
 * @param {Object} data - Dados adicionais
 */
export function logAudio(stage, action, data = {}) {
  const timestamp = new Date().toISOString();
  const baseLog = `[AUDIO] ${action} stage=${stage}`;
  
  switch (action) {
    case 'start':
      console.log(`${baseLog} file=${data.fileName || 'unknown'} jobId=${data.jobId || 'unknown'}`);
      break;
      
    case 'done':
      const timing = data.ms ? ` ms=${data.ms}` : '';
      const meta = data.meta ? ` meta=${JSON.stringify(data.meta)}` : '';
      console.log(`${baseLog}${timing}${meta}`);
      break;
      
    case 'error':
      console.error(`${baseLog} code=${data.code || 'unknown'} msg="${data.message || 'Unknown error'}"`);
      if (data.stackSnippet) {
        console.error(`[AUDIO] stack snippet:\n${data.stackSnippet}`);
      }
      break;
      
    default:
      console.log(`${baseLog} ${JSON.stringify(data)}`);
  }
}

/**
 * Clamp value para range específico
 * @param {number} value - Valor para clamp
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Remove DC offset (high-pass filter muito baixo)
 * 🚨 CORREÇÃO CRÍTICA: Algoritmo anterior estava AMPLIFICANDO sinais por 1000x+
 * 
 * Nova implementação: DC blocking filter de primeira ordem (passa-alta)
 * @param {Float32Array} samples - Amostras de áudio
 * @param {number} sampleRate - Sample rate
 * @param {number} cutoffHz - Frequência de corte (default: 20Hz)
 */
export function removeDCOffset(samples, sampleRate, cutoffHz = 20) {
  // DC blocking filter: y[n] = x[n] - x[n-1] + R * y[n-1]
  // onde R = 1 - (2 * PI * cutoff / sampleRate)
  
  const output = new Float32Array(samples.length);
  
  if (samples.length === 0) return output;
  
  // Calcular coeficiente do filtro
  const R = 1.0 - (2.0 * Math.PI * cutoffHz / sampleRate);
  
  // Aplicar filtro recursivo
  let prevInput = samples[0];
  let prevOutput = 0;
  
  for (let i = 0; i < samples.length; i++) {
    const currentInput = samples[i];
    
    // y[n] = x[n] - x[n-1] + R * y[n-1]
    const currentOutput = currentInput - prevInput + R * prevOutput;
    
    output[i] = currentOutput;
    
    prevInput = currentInput;
    prevOutput = currentOutput;
  }
  
  return output;
}

/**
 * Detecta clipping (amostras próximas aos limites ±1)
 * @param {Float32Array} samples - Amostras de áudio
 * @param {number} threshold - Threshold para clipping (default: 0.99)
 */
export function detectClipping(samples, threshold = 0.99) {
  let clippedSamples = 0;
  
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) >= threshold) {
      clippedSamples++;
    }
  }
  
  return {
    clippedSamples,
    totalSamples: samples.length,
    clippingPct: (clippedSamples / samples.length) * 100
  };
}

export default {
  makeErr,
  ensureFiniteArray,
  assertFinite,
  logAudio,
  clamp,
  removeDCOffset,
  detectClipping
};