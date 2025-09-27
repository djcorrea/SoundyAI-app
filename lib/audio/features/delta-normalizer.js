// 🎯 DELTA NORMALIZER - Etapa 1: Normalização dos deltas espectrais
// Normaliza valores de delta calculados pelo pipeline espectral para uso seguro em equalizadores

/**
 * 🎯 Normaliza deltas espectrais aplicando regras de segurança
 * 
 * REGRAS DE NORMALIZAÇÃO:
 * - |delta| < 0.5 dB → considera insignificante → retorna 0
 * - 0.5 dB ≤ |delta| < 2 dB → ajuste leve → retorna delta integral  
 * - 2 dB ≤ |delta| < 6 dB → compressão suave (soft-knee) → aplica delta * 0.8
 * - |delta| ≥ 6 dB → aplica cap de ±6 dB máximo
 * 
 * @param {number} delta - Valor delta calculado (measuredDb - targetDb)
 * @returns {number} Valor normalizado pronto para equalizador (-6dB a +6dB)
 */
export function normalizeDelta(delta) {
  // Validação de entrada
  if (typeof delta !== 'number' || !isFinite(delta)) {
    console.warn('⚠️ [DELTA_NORMALIZER] Valor delta inválido:', delta);
    return 0;
  }
  
  // Calcular valor absoluto para comparações
  const absDelta = Math.abs(delta);
  const signal = delta >= 0 ? 1 : -1; // Preservar sinal original
  
  // REGRA 1: Deltas insignificantes (< 0.5 dB) → ignorar
  if (absDelta < 0.5) {
    return 0;
  }
  
  // REGRA 2: Ajuste leve (0.5 dB ≤ |delta| < 2 dB) → valor integral
  if (absDelta < 2.0) {
    return delta; // Retorna valor original sem modificação
  }
  
  // REGRA 3: Compressão suave (2 dB ≤ |delta| < 6 dB) → soft-knee 0.8x
  if (absDelta < 6.0) {
    return delta * 0.8; // Aplica compressão suave
  }
  
  // REGRA 4: Cap máximo (|delta| ≥ 6 dB) → limita a ±6 dB
  return signal * 6.0; // Retorna ±6 dB respeitando o sinal
}

/**
 * 🎯 Processa múltiplos deltas de uma vez (para todas as bandas espectrais)
 * 
 * @param {Object} deltas - Objeto com deltas por banda: { sub: delta, bass: delta, ... }
 * @returns {Object} Objeto com deltas normalizados por banda
 */
export function normalizeSpectralDeltas(deltas) {
  if (!deltas || typeof deltas !== 'object') {
    console.warn('⚠️ [DELTA_NORMALIZER] Deltas espectrais inválidos:', deltas);
    return {};
  }
  
  const normalizedDeltas = {};
  
  for (const [bandName, delta] of Object.entries(deltas)) {
    normalizedDeltas[bandName] = normalizeDelta(delta);
  }
  
  return normalizedDeltas;
}

/**
 * 🎯 Valida se um delta normalizado está dentro dos limites seguros
 * 
 * @param {number} normalizedDelta - Delta após normalização
 * @returns {boolean} True se está dentro dos limites (-6dB a +6dB)
 */
export function isNormalizedDeltaSafe(normalizedDelta) {
  return typeof normalizedDelta === 'number' && 
         isFinite(normalizedDelta) && 
         normalizedDelta >= -6.0 && 
         normalizedDelta <= 6.0;
}

/**
 * 🎯 Gera relatório detalhado da normalização aplicada
 * 
 * @param {number} originalDelta - Delta original
 * @param {number} normalizedDelta - Delta após normalização
 * @returns {Object} Relatório com detalhes da transformação
 */
export function getDeltaNormalizationReport(originalDelta, normalizedDelta) {
  const absDelta = Math.abs(originalDelta);
  let rule = '';
  let action = '';
  
  if (absDelta < 0.5) {
    rule = 'REGRA 1: Insignificante';
    action = 'Ignorado (retorna 0)';
  } else if (absDelta < 2.0) {
    rule = 'REGRA 2: Ajuste leve';
    action = 'Preservado integral';
  } else if (absDelta < 6.0) {
    rule = 'REGRA 3: Compressão suave';
    action = 'Aplicado soft-knee (0.8x)';
  } else {
    rule = 'REGRA 4: Cap máximo';
    action = 'Limitado a ±6dB';
  }
  
  return {
    originalDelta: Number(originalDelta.toFixed(2)),
    normalizedDelta: Number(normalizedDelta.toFixed(2)),
    rule,
    action,
    reduction: Number((Math.abs(originalDelta - normalizedDelta)).toFixed(2)),
    safe: isNormalizedDeltaSafe(normalizedDelta)
  };
}

/**
 * 🎯 Configurações e constantes do normalizador
 */
export const DELTA_NORMALIZER_CONFIG = {
  // Thresholds das regras
  INSIGNIFICANT_THRESHOLD: 0.5,   // dB - Abaixo disso é ignorado
  LIGHT_ADJUSTMENT_THRESHOLD: 2.0, // dB - Até aqui preserva integral
  SOFT_KNEE_THRESHOLD: 6.0,       // dB - Até aqui aplica compressão 0.8x
  MAX_DELTA_CAP: 6.0,              // dB - Limite máximo absoluto
  
  // Fatores de processamento
  SOFT_KNEE_FACTOR: 0.8,          // Fator de compressão suave
  
  // Limites de segurança
  MIN_SAFE_DELTA: -6.0,           // dB - Limite mínimo seguro
  MAX_SAFE_DELTA: 6.0,            // dB - Limite máximo seguro
  
  // Metadados
  ALGORITHM_VERSION: '1.0.0',
  DESCRIPTION: 'Normalização de deltas espectrais para uso seguro em equalizadores'
};

// Logging para auditoria
console.log('🎯 Delta Normalizer carregado - Etapa 1 do sistema de correção espectral');
console.log('📋 Regras configuradas:', {
  insignificant: `< ${DELTA_NORMALIZER_CONFIG.INSIGNIFICANT_THRESHOLD}dB → 0`,
  light: `${DELTA_NORMALIZER_CONFIG.INSIGNIFICANT_THRESHOLD}-${DELTA_NORMALIZER_CONFIG.LIGHT_ADJUSTMENT_THRESHOLD}dB → integral`,
  softKnee: `${DELTA_NORMALIZER_CONFIG.LIGHT_ADJUSTMENT_THRESHOLD}-${DELTA_NORMALIZER_CONFIG.SOFT_KNEE_THRESHOLD}dB → ${DELTA_NORMALIZER_CONFIG.SOFT_KNEE_FACTOR}x`,
  cap: `≥${DELTA_NORMALIZER_CONFIG.SOFT_KNEE_THRESHOLD}dB → ±${DELTA_NORMALIZER_CONFIG.MAX_DELTA_CAP}dB`
});