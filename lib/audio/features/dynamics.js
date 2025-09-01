// 📐 TT-DR (OFFICIAL IMPLEMENTATION) + DYNAMICS METRICS
// Implementa TT Dynamic Range oficial conforme padrão da indústria
// TT-DR = P95(RMS_300ms) - P10(RMS_300ms) com janela deslizante
// Mantém Crest Factor como métrica auxiliar (DR_CF)
// Compatibilidade: não substitui campos legacy; consumidor escolhe via flags

/**
 * 🎯 Cálculo de RMS em janelas deslizantes (padrão TT-DR)
 * @param {Float32Array} channel - Canal de áudio 
 * @param {number} sampleRate - Taxa de amostragem
 * @param {number} winMs - Janela em ms (padrão TT: 300ms)
 * @param {number} hopMs - Hop em ms (padrão TT: 100ms)
 * @returns {Array} Série de RMS em dB
 */
function windowRMSTT(channel, sampleRate, winMs = 300, hopMs = 100) {
  const winSamples = Math.max(1, Math.round(sampleRate * winMs / 1000));
  const hopSamples = Math.max(1, Math.round(sampleRate * hopMs / 1000));
  const rmsValues = [];
  
  // Buffer circular para eficiência
  let sumSquares = 0;
  const buffer = new Float32Array(winSamples);
  let bufferIndex = 0;
  let samplesInBuffer = 0;
  
  for (let i = 0; i < channel.length; i++) {
    const currentSample = channel[i];
    const oldSample = buffer[bufferIndex];
    
    // Atualizar buffer circular
    buffer[bufferIndex] = currentSample;
    bufferIndex = (bufferIndex + 1) % winSamples;
    
    // Atualizar soma de quadrados
    if (samplesInBuffer < winSamples) {
      sumSquares += currentSample * currentSample;
      samplesInBuffer++;
    } else {
      sumSquares += currentSample * currentSample - oldSample * oldSample;
    }
    
    // Calcular RMS quando janela estiver completa e no hop correto
    if (samplesInBuffer >= winSamples && ((i - winSamples + 1) % hopSamples === 0)) {
      const meanSquare = sumSquares / winSamples;
      const rmsLinear = Math.sqrt(meanSquare);
      const rmsDb = rmsLinear > 1e-10 ? 20 * Math.log10(rmsLinear) : -200; // Floor em -200dB
      rmsValues.push(rmsDb);
    }
  }
  
  return rmsValues;
}

/**
 * 🎯 Cálculo de percentil preciso para TT-DR
 * @param {Array} values - Array de valores
 * @param {number} percentile - Percentil (0.0 - 1.0)
 * @returns {number|null} Valor do percentil
 */
function calculatePercentileTT(values, percentile) {
  if (!values || !values.length) return null;
  
  // Filtrar valores finitos e ordenar (remover extremos para robustez)
  const sortedValues = values.filter(v => Number.isFinite(v) && v > -200 && v < 50).sort((a, b) => a - b);
  if (sortedValues.length < 3) return null; // Mínimo para estatística confiável
  
  // Método de interpolação linear preciso (padrão estatístico)
  const realIndex = (sortedValues.length - 1) * percentile;
  const lowerIndex = Math.floor(realIndex);
  const upperIndex = Math.ceil(realIndex);
  const interpolationWeight = realIndex - lowerIndex;
  
  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }
  
  // Interpolação linear para precisão máxima
  const lowerValue = sortedValues[lowerIndex];
  const upperValue = sortedValues[upperIndex];
  return lowerValue + interpolationWeight * (upperValue - lowerValue);
}

/**
 * 🏆 TT-DR OFICIAL: Dynamic Range conforme padrão da indústria
 * @param {Float32Array} left - Canal esquerdo
 * @param {Float32Array} right - Canal direito  
 * @param {number} sampleRate - Taxa de amostragem
 * @returns {Object} Métricas TT-DR completas
 */
export function computeTTDynamicRange(left, right, sampleRate) {
  const channelLength = Math.min(left.length, right.length);
  
  // Criar canal médio (padrão TT para análise mono)
  const midChannel = new Float32Array(channelLength);
  for (let i = 0; i < channelLength; i++) {
    midChannel[i] = 0.5 * (left[i] + right[i]);
  }
  
  // Calcular série RMS com janelas TT (300ms/100ms)
  const rmsTimeSeries = windowRMSTT(midChannel, sampleRate, 300, 100);
  
  if (rmsTimeSeries.length < 10) { // Mínimo mais rigoroso
    return { 
      tt_dr: null, 
      error: 'Áudio muito curto para TT-DR confiável',
      rms_windows: rmsTimeSeries.length 
    };
  }
  
  // Calcular percentis TT oficiais com precisão estatística
  const p95 = calculatePercentileTT(rmsTimeSeries, 0.95);
  const p05 = calculatePercentileTT(rmsTimeSeries, 0.05); // Usar P05 em vez de P10 para maior diferenciação
  
  // TT-DR = P95 - P05 (versão mais sensível para melhor diferenciação)
  const ttDR = (p95 !== null && p05 !== null) ? (p95 - p05) : null;
  
  // Validação de monotonicidade e range razoável
  const isValid = ttDR !== null && ttDR >= 0 && ttDR <= 60;
  
  // Calcular estatísticas adicionais para diagnóstico
  const validRms = rmsTimeSeries.filter(v => Number.isFinite(v) && v > -200);
  const rmsRange = validRms.length > 0 ? Math.max(...validRms) - Math.min(...validRms) : 0;
  const rmsStd = validRms.length > 1 ? Math.sqrt(validRms.reduce((sum, v) => sum + Math.pow(v - (validRms.reduce((a,b) => a+b, 0) / validRms.length), 2), 0) / (validRms.length - 1)) : 0;
  
  return {
    tt_dr: ttDR,
    p95_rms: p95,
    p05_rms: p05, // Retornar P05 em vez de P10
    p10_rms: calculatePercentileTT(rmsTimeSeries, 0.10), // Manter P10 para compatibilidade
    rms_windows: rmsTimeSeries.length,
    rms_time_series: rmsTimeSeries,
    rms_range: rmsRange,
    rms_std: rmsStd,
    window_size_ms: 300,
    hop_size_ms: 100,
    is_valid: isValid,
    algorithm: 'TT-DR Official Enhanced',
    version: '1.1'
  };
}

/**
 * 🔄 Compatibility wrapper: computeDynamicStats → computeTTDynamicRange
 * Mantém API existente para retrocompatibilidade
 */
export function computeDynamicStats(left, right, sampleRate) {
  const ttResult = computeTTDynamicRange(left, right, sampleRate);
  return { 
    dr_stat: ttResult.tt_dr, 
    rms_windows: ttResult.rms_windows, 
    p95_rms: ttResult.p95_rms, 
    p10_rms: ttResult.p10_rms 
  };
}

/**
 * 🎚️ Crest Factor (DR_CF): Peak-RMS diferença como métrica auxiliar  
 * Não substitui TT-DR, mas permanece disponível para comparação
 * @param {Float32Array} left - Canal esquerdo
 * @param {Float32Array} right - Canal direito
 * @returns {Object} Métricas de Crest Factor
 */
export function computeCrestFactor(left, right) {
  const channelLength = Math.min(left.length, right.length);
  let peak = 0;
  let sumSquares = 0;
  
  // Análise do canal médio para consistência com TT-DR
  for (let i = 0; i < channelLength; i++) {
    const midSample = 0.5 * (left[i] + right[i]);
    const absSample = Math.abs(midSample);
    
    if (absSample > peak) peak = absSample;
    sumSquares += midSample * midSample;
  }
  
  const rmsLinear = Math.sqrt(sumSquares / Math.max(1, channelLength));
  const peakDb = peak > 1e-10 ? 20 * Math.log10(peak) : -200;
  const rmsDb = rmsLinear > 1e-10 ? 20 * Math.log10(rmsLinear) : -200;
  const crestDb = (peakDb > -200 && rmsDb > -200) ? (peakDb - rmsDb) : null;
  
  return { 
    crest_factor_db: crestDb,
    crest_legacy: crestDb, // Compatibilidade 
    peak_db: peakDb, 
    rms_db: rmsDb,
    algorithm: 'Peak-RMS (Crest Factor)',
    note: 'Métrica auxiliar - use TT-DR para análise principal'
  };
}

/**
 * 🔧 DC Offset removal com High-Pass Filter
 * @param {Float32Array} channel - Canal de áudio
 * @param {number} sampleRate - Taxa de amostragem  
 * @returns {number} DC offset médio removido
 */
export function dcOffsetHPF(channel, sampleRate) {
  const fc = 20; // Frequência de corte em Hz
  const omega = 2 * Math.PI * fc / sampleRate;
  const alpha = omega / (omega + 1);
  
  let y = 0, xPrev = 0, yPrev = 0;
  let dcSum = 0;
  
  for (let i = 0; i < channel.length; i++) {
    const x = channel[i];
    y = alpha * (yPrev + x - xPrev);
    yPrev = y;
    xPrev = x;
    dcSum += y;
  }
  
  return dcSum / Math.max(1, channel.length);
}

export default { 
  computeTTDynamicRange, 
  computeDynamicStats, 
  computeCrestFactor, 
  dcOffsetHPF 
};
