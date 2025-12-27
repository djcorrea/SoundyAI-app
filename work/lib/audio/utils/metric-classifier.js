// 🎯 METRIC CLASSIFIER - Sistema Unificado de Classificação de Métricas
// Garante consistência entre Tabela, Score e Sugestões
// Baseado no mesmo threshold: OK / ATTENTION (2× tol) / CRITICAL (> 2× tol)

/**
 * 🎨 Sistema de Classificação Unificado
 * REGRA: OK se diff ≤ tol, ATTENTION se diff ≤ 2*tol, CRITICAL se diff > 2*tol
 */
const CLASSIFICATION_LEVELS = {
  OK: {
    level: 'ok',
    priority: 1,
    color: '#00ff88',
    colorHex: 'green',
    icon: '🟢',
    label: 'Ideal',
    cssClass: 'ok',
    description: 'Dentro do ideal para o gênero'
  },
  ATTENTION: {
    level: 'attention',
    priority: 2,
    color: '#ffcc00',
    colorHex: 'yellow',
    icon: '🟡',
    label: 'Ajuste leve',
    cssClass: 'yellow',
    description: 'Pequenos ajustes recomendados'
  },
  CRITICAL: {
    level: 'critical',
    priority: 3,
    color: '#ff4444',
    colorHex: 'red',
    icon: '🔴',
    label: 'Corrigir',
    cssClass: 'warn',
    description: 'Requer correção para o gênero'
  }
};

/**
 * 🎯 Epsilon para comparações float precisas
 */
const EPS = 1e-6;

/**
 * 🧮 Classificar métrica baseada em diferença e tolerância
 * 
 * @param {number} diff - Diferença absoluta entre valor atual e target
 * @param {number} tolerance - Tolerância para zona OK
 * @param {Object} options - Opções adicionais
 * @returns {Object} - Classificação com { level, priority, color, icon, label, cssClass }
 */
export function classifyMetric(diff, tolerance, options = {}) {
  // 🛡️ Validação de entrada
  if (!Number.isFinite(diff) || !Number.isFinite(tolerance)) {
    console.error('[AUDIT_FIX][CLASSIFIER] ❌ Valores inválidos:', { diff, tolerance });
    return CLASSIFICATION_LEVELS.CRITICAL; // Fail-safe
  }

  const absDiff = Math.abs(diff);
  
  // 🔥 LOG PARA AUDITORIA
  const metricName = options.metricName || 'unknown';
  console.log(`[AUDIT_FIX][CLASSIFIER] Classificando ${metricName}:`, {
    absDiff: absDiff.toFixed(3),
    tolerance: tolerance.toFixed(3),
    multiplicador: (absDiff / tolerance).toFixed(2)
  });

  // ✅ ZONA OK: diff ≤ tolerance
  if (absDiff <= tolerance + EPS) {
    console.log(`[AUDIT_FIX][CLASSIFIER] → OK (diff ≤ tol)`);
    return CLASSIFICATION_LEVELS.OK;
  }

  // 🟡 ZONA ATTENTION: diff ≤ 2 × tolerance
  const multiplicador = absDiff / tolerance;
  if (multiplicador <= 2 + EPS) {
    console.log(`[AUDIT_FIX][CLASSIFIER] → ATTENTION (diff ≤ 2×tol, multiplicador=${multiplicador.toFixed(2)})`);
    return CLASSIFICATION_LEVELS.ATTENTION;
  }

  // 🔴 ZONA CRITICAL: diff > 2 × tolerance
  console.log(`[AUDIT_FIX][CLASSIFIER] → CRITICAL (diff > 2×tol, multiplicador=${multiplicador.toFixed(2)})`);
  return CLASSIFICATION_LEVELS.CRITICAL;
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🚨 REGRA ABSOLUTA: TRUE PEAK > 0.0 dBTP = CRÍTICA SEMPRE
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * Esta regra é FÍSICA e INVIOLÁVEL:
 * - 0.0 dBTP é o limite absoluto digital
 * - Valores acima causam clipping em qualquer sistema
 * - NUNCA deve ser considerado OK ou ATTENTION, independente de tolerância
 * 
 * @param {number} truePeakValue - Valor de True Peak em dBTP
 * @param {Object} target - Target opcional (ignorado se TP > 0)
 * @param {Object} options - Opções adicionais
 * @returns {Object} - Classificação
 */
const TRUE_PEAK_HARD_CAP = 0.0;

export function classifyTruePeak(truePeakValue, target = {}, options = {}) {
  // 🛡️ Validação
  if (!Number.isFinite(truePeakValue)) {
    console.error('[CLASSIFIER][TRUE_PEAK] ❌ Valor inválido:', truePeakValue);
    return {
      classification: CLASSIFICATION_LEVELS.CRITICAL,
      diff: NaN,
      reasonCode: 'INVALID_VALUE'
    };
  }

  // 🚨 REGRA ABSOLUTA: TP > 0.0 = CRÍTICA SEMPRE
  if (truePeakValue > TRUE_PEAK_HARD_CAP) {
    const diff = truePeakValue - TRUE_PEAK_HARD_CAP;
    console.log('[CLASSIFIER][TRUE_PEAK] 🚨 CRÍTICA ABSOLUTA: TP > 0.0 dBTP', {
      value: truePeakValue.toFixed(2),
      hardCap: TRUE_PEAK_HARD_CAP,
      excesso: diff.toFixed(2),
      reasonCode: 'TP_ABOVE_ZERO'
    });
    
    return {
      classification: CLASSIFICATION_LEVELS.CRITICAL,
      diff,
      min: target.min ?? -3.0,
      max: TRUE_PEAK_HARD_CAP,
      reasonCode: 'TP_ABOVE_ZERO',
      message: `🔴 CLIPPING DIGITAL! True Peak ${truePeakValue.toFixed(1)} dBTP está ${diff.toFixed(1)} dB acima do limite físico de 0.0 dBTP`
    };
  }

  // ✅ Se TP <= 0, usar classificação normal
  const min = target.min ?? -3.0;
  const max = target.max ?? TRUE_PEAK_HARD_CAP;
  const warnFrom = target.warnFrom ?? -0.3;
  const tolerance = target.tolerance ?? 1.0;

  let diff, reasonCode;
  
  // Acima de warnFrom (próximo do limite)
  if (truePeakValue > warnFrom) {
    diff = truePeakValue - warnFrom;
    reasonCode = 'TP_NEAR_CLIP';
    console.log('[CLASSIFIER][TRUE_PEAK] ⚠️ Próximo do limite:', {
      value: truePeakValue.toFixed(2),
      warnFrom,
      diff: diff.toFixed(2)
    });
    return {
      classification: CLASSIFICATION_LEVELS.ATTENTION,
      diff,
      min,
      max,
      reasonCode,
      message: `⚠️ True Peak ${truePeakValue.toFixed(1)} dBTP está próximo do limite seguro`
    };
  }
  
  // Abaixo do mínimo (muito baixo - improvável mas possível)
  if (truePeakValue < min) {
    diff = truePeakValue - min;
    reasonCode = 'TP_TOO_LOW';
    console.log('[CLASSIFIER][TRUE_PEAK] ℹ️ Abaixo do mínimo:', {
      value: truePeakValue.toFixed(2),
      min,
      diff: diff.toFixed(2)
    });
    // TP baixo é OK (margem de segurança), não penalizar
    return {
      classification: CLASSIFICATION_LEVELS.OK,
      diff,
      min,
      max,
      reasonCode,
      message: `✅ True Peak ${truePeakValue.toFixed(1)} dBTP com margem extra de segurança`
    };
  }

  // Dentro do range [min, warnFrom]
  diff = 0;
  reasonCode = 'TP_OK';
  console.log('[CLASSIFIER][TRUE_PEAK] ✅ OK:', {
    value: truePeakValue.toFixed(2),
    range: `${min} a ${warnFrom}`
  });
  
  return {
    classification: CLASSIFICATION_LEVELS.OK,
    diff,
    min,
    max,
    reasonCode,
    message: `✅ True Peak ${truePeakValue.toFixed(1)} dBTP dentro do padrão`
  };
}

/**
 * 🎯 Classificar métrica considerando range (min/max)
 * 
 * @param {number} value - Valor atual da métrica
 * @param {Object} target - Objeto com { min, max } ou { target, tolerance }
 * @param {Object} options - Opções adicionais
 * @returns {Object} - Classificação + diff calculado
 */
export function classifyMetricWithRange(value, target, options = {}) {
  // 🛡️ Validação de entrada
  if (!Number.isFinite(value)) {
    console.error('[AUDIT_FIX][CLASSIFIER_RANGE] ❌ Valor inválido:', value);
    return { 
      classification: CLASSIFICATION_LEVELS.CRITICAL, 
      diff: NaN 
    };
  }

  let min, max, tolerance;

  // 🎯 Caso 1: target tem min/max explícitos
  if (target && Number.isFinite(target.min) && Number.isFinite(target.max)) {
    min = target.min;
    max = target.max;
    tolerance = target.tolerance || (max - min) / 2;
  } 
  // 🎯 Caso 2: target tem target_range (bandas espectrais)
  else if (target && target.target_range && 
           Number.isFinite(target.target_range.min) && 
           Number.isFinite(target.target_range.max)) {
    min = target.target_range.min;
    max = target.target_range.max;
    tolerance = target.tolerance || target.tol_db || (max - min) / 2;
  }
  // 🎯 Caso 3: target simples com tolerance
  else if (target && Number.isFinite(target.target) && Number.isFinite(target.tolerance)) {
    const center = target.target;
    tolerance = target.tolerance;
    min = center - tolerance;
    max = center + tolerance;
  }
  // ❌ Caso inválido
  else {
    console.error('[AUDIT_FIX][CLASSIFIER_RANGE] ❌ Target inválido:', target);
    return { 
      classification: CLASSIFICATION_LEVELS.CRITICAL, 
      diff: NaN 
    };
  }

  // 🧮 Calcular diferença até borda mais próxima
  let diff;
  if (value < min) {
    diff = value - min; // Negativo (precisa aumentar)
  } else if (value > max) {
    diff = value - max; // Positivo (precisa reduzir)
  } else {
    diff = 0; // Dentro do range
  }

  // 🎯 Classificar usando diferença absoluta
  const classification = classifyMetric(diff, tolerance, options);

  return {
    classification,
    diff,
    min,
    max,
    tolerance
  };
}

/**
 * 📊 Obter texto de status baseado na classificação
 * 
 * @param {Object} classification - Resultado de classifyMetric()
 * @returns {string} - Texto amigável para UI
 */
export function getStatusText(classification) {
  return classification.label || 'Desconhecido';
}

/**
 * 🎨 Obter classe CSS baseada na classificação
 * 
 * @param {Object} classification - Resultado de classifyMetric()
 * @returns {string} - Nome da classe CSS
 */
export function getCssClass(classification) {
  return classification.cssClass || 'unknown';
}

/**
 * 📈 Calcular score numérico baseado na classificação
 * 
 * @param {Object} classification - Resultado de classifyMetric()
 * @returns {number} - Score de 0-100
 */
export function calculateScore(classification) {
  switch (classification.level) {
    case 'ok':
      return 100;
    case 'attention':
      return 70;
    case 'critical':
      return 30;
    default:
      return 0;
  }
}

console.log('[AUDIT_FIX] ✅ Metric Classifier carregado - Sistema unificado OK/ATTENTION(2×tol)/CRITICAL');
