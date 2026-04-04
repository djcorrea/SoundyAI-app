/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🎯 COMPARE WITH TARGETS - FUNÇÃO ÚNICA DE COMPARAÇÃO
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * OBJETIVO: Centralizar comparação de métricas para eliminar divergências entre:
 *   1) Tabela de comparação (rows)
 *   2) Cards de Sugestões (issues)
 *   3) Score (pontuação)
 * 
 * REGRAS OBRIGATÓRIAS:
 *   - TRUE PEAK > 0.0 dBTP = "CRÍTICA" SEMPRE
 *   - Severidades: OK, ATENÇÃO, ALTA, CRÍTICA
 *   - Mesma lógica para tabela, sugestões e score
 * 
 * FORMATO DE SAÍDA:
 * {
 *   rows: [{ key, label, value, targetText, diff, severity, action }],
 *   issues: [{ key, category, severity, problemText, numbers }],
 *   score: { total, breakdown }
 * }
 * 
 * ════════════════════════════════════════════════════════════════════════════════
 */

import { resolveTargets, validateTargets, TRUE_PEAK_HARD_CAP } from './resolveTargets.js';

// 🐛 DEBUG FLAG para instrumentação de True Peak
const DEBUG_TP_ACTION = false;

// 🎯 LABELS PARA DISPLAY
const METRIC_LABELS = {
  lufs: 'Loudness (LUFS)',
  truePeak: 'True Peak',
  dr: 'Dynamic Range',
  lra: 'LU Range',
  stereo: 'Correlação Stereo'
};

const BAND_LABELS = {
  sub: 'Sub (20-60 Hz)',
  bass: 'Bass (60-150 Hz)',
  lowMid: 'Low Mid (150-500 Hz)',
  mid: 'Mid (500-2k Hz)',
  highMid: 'High Mid (2k-4k Hz)',
  presence: 'Presença (4k-10k Hz)',
  air: 'Brilho (10k-20k Hz)'
};

const METRIC_UNITS = {
  lufs: 'LUFS',
  truePeak: 'dBTP',
  dr: 'dB',
  lra: 'LU',
  stereo: ''
};

// 🎯 CATEGORIAS PARA SUGESTÕES
const METRIC_CATEGORIES = {
  lufs: 'LOUDNESS',
  truePeak: 'MASTERING',
  dr: 'DYNAMICS',
  lra: 'DYNAMICS',
  stereo: 'STEREO'
};

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🎯 compareWithTargets - FUNÇÃO PRINCIPAL
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * Compara métricas medidas com targets e retorna dados para tabela, sugestões e score.
 * 
 * @param {Object} metrics - Métricas medidas do áudio
 * @param {Object} targets - Targets resolvidos (de resolveTargets)
 * @returns {Object} - { rows, issues, score }
 */
export function compareWithTargets(metrics, targets) {
  console.log('[COMPARE] 🔍 Iniciando comparação com targets');
  
  // ════════════════════════════════════════════════════════════════════
  // 1️⃣ VALIDAÇÕES
  // ════════════════════════════════════════════════════════════════════
  if (!metrics || typeof metrics !== 'object') {
    console.error('[COMPARE] ❌ Metrics inválido');
    return createEmptyResult('Metrics inválido');
  }
  
  if (!targets || typeof targets !== 'object') {
    console.error('[COMPARE] ❌ Targets inválido');
    return createEmptyResult('Targets inválido');
  }
  
  // Validar targets (guardrail)
  const validation = validateTargets(targets);
  if (!validation.valid) {
    console.error('[COMPARE] ❌ Targets com erros:', validation.errors);
    // Continuar mesmo com erros (mas logar)
  }
  
  // ════════════════════════════════════════════════════════════════════
  // 2️⃣ NORMALIZAR MÉTRICAS (múltiplos formatos de entrada)
  // ════════════════════════════════════════════════════════════════════
  const normalizedMetrics = normalizeMetrics(metrics);
  
  // ════════════════════════════════════════════════════════════════════
  // 3️⃣ COMPARAR CADA MÉTRICA
  // ════════════════════════════════════════════════════════════════════
  const rows = [];
  const issues = [];
  const scoreBreakdown = {};
  
  // === LUFS ===
  if (normalizedMetrics.lufs !== null && targets.lufs) {
    const result = evaluateRangeMetric(
      normalizedMetrics.lufs,
      targets.lufs,
      'lufs'
    );
    rows.push(result.row);
    if (result.issue) issues.push(result.issue);
    scoreBreakdown.lufs = result.score;
  }
  
  // === TRUE PEAK (REGRA ESPECIAL) ===
  if (normalizedMetrics.truePeak !== null && targets.truePeak) {
    const result = evaluateTruePeak(
      normalizedMetrics.truePeak,
      targets.truePeak
    );
    rows.push(result.row);
    if (result.issue) issues.push(result.issue);
    scoreBreakdown.truePeak = result.score;
  }
  
  // === DR ===
  if (normalizedMetrics.dr !== null && targets.dr) {
    // 🔍 LOG DIAGNÓSTICO — confirmar que min/max vêm do JSON (esperado: min:7, max:12 para pop)
    console.log('FINAL DR RANGE:', {
      min: targets.dr.min,
      max: targets.dr.max,
      target: targets.dr.target,
      source: 'compareWithTargets'
    });
    const result = evaluateRangeMetric(
      normalizedMetrics.dr,
      targets.dr,
      'dr'
    );
    rows.push(result.row);
    if (result.issue) issues.push(result.issue);
    scoreBreakdown.dr = result.score;
  }
  
  // === LRA ===
  if (normalizedMetrics.lra !== null && targets.lra) {
    const result = evaluateRangeMetric(
      normalizedMetrics.lra,
      targets.lra,
      'lra'
    );
    rows.push(result.row);
    if (result.issue) issues.push(result.issue);
    scoreBreakdown.lra = result.score;
  }
  
  // === STEREO ===
  if (normalizedMetrics.stereo !== null && targets.stereo) {
    const result = evaluateRangeMetric(
      normalizedMetrics.stereo,
      targets.stereo,
      'stereo'
    );
    rows.push(result.row);
    if (result.issue) issues.push(result.issue);
    scoreBreakdown.stereo = result.score;
  }
  
  // === BANDAS ===
  if (normalizedMetrics.bands && targets.bands) {
    for (const [bandKey, bandValue] of Object.entries(normalizedMetrics.bands)) {
      const bandTarget = targets.bands[bandKey];
      if (bandValue === null || !bandTarget) continue;
      
      const result = evaluateBand(bandValue, bandTarget, bandKey);
      rows.push(result.row);
      if (result.issue) issues.push(result.issue);
      scoreBreakdown[`band_${bandKey}`] = result.score;
    }
  }
  
  // ════════════════════════════════════════════════════════════════════
  // 4️⃣ CALCULAR SCORE TOTAL
  // ════════════════════════════════════════════════════════════════════
  const scoreValues = Object.values(scoreBreakdown).filter(v => v !== null);
  const totalScore = scoreValues.length > 0 
    ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length * 100
    : 0;
  
  // ════════════════════════════════════════════════════════════════════
  // 5️⃣ ORDENAR ISSUES POR PRIORIDADE
  // ════════════════════════════════════════════════════════════════════
  const severityOrder = { 'CRÍTICA': 0, 'ALTA': 1, 'ATENÇÃO': 2, 'OK': 3 };
  issues.sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99));
  
  console.log('[COMPARE] ✅ Comparação completa:', {
    rowsCount: rows.length,
    issuesCount: issues.length,
    score: totalScore.toFixed(1)
  });
  
  return {
    rows,
    issues,
    score: {
      total: Math.round(totalScore * 10) / 10,
      breakdown: scoreBreakdown,
      classification: classifyScore(totalScore)
    },
    _comparedAt: new Date().toISOString()
  };
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🎯 FUNÇÕES DE AVALIAÇÃO
 * ════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Avalia TRUE PEAK com regra especial: > 0.0 = CRÍTICA sempre
 */
function evaluateTruePeak(value, target) {
  const { min, max, warnFrom, hardCap } = target;
  const effectiveHardCap = hardCap ?? TRUE_PEAK_HARD_CAP;
  const unit = METRIC_UNITS.truePeak;
  
  let severity, action, severityClass, scoreValue;
  
  // 🚨 REGRA CRÍTICA: TP > 0.0 dBTP = CRÍTICA SEMPRE
  if (value > effectiveHardCap) {
    // 🔧 FIX: usar target.target (não hardCap) para consistência com coluna "Diferença"
    const delta = value - target.target;
    severity = 'CRÍTICA';
    severityClass = 'critical';
    action = `🔴 CLIPPING! Reduzir ${delta.toFixed(1)} ${unit}`;
    scoreValue = 0;
    
    console.log('[COMPARE][TRUE-PEAK] 🚨 CRÍTICA: TP > 0.0 dBTP detectado:', value);
  }
  // WARNING ZONE: Acima de warnFrom
  else if (warnFrom !== null && value > warnFrom) {
    // 🔧 FIX: usar target.target (não warnFrom) para consistência com coluna "Diferença"
    const deltaToTarget = value - target.target;
    severity = 'ALTA';
    severityClass = 'warning';
    action = `⚠️ Próximo do limite. Reduzir ${deltaToTarget.toFixed(2)} ${unit}`;
    scoreValue = 0.5;
  }
  // ABAIXO DO MÍNIMO (muito baixo)
  else if (value < min) {
    const delta = min - value;
    severity = 'ATENÇÃO';
    severityClass = 'caution';
    action = `ℹ️ Margem extra de ${delta.toFixed(2)} ${unit}`;
    scoreValue = 0.9; // Não penaliza muito
  }
  // OK
  else {
    severity = 'OK';
    severityClass = 'ok';
    action = '✅ Dentro do padrão';
    scoreValue = 1;
  }
  
  const row = {
    key: 'truePeak',
    type: 'metric',
    label: METRIC_LABELS.truePeak,
    value: `${value.toFixed(1)} ${unit}`,
    valueRaw: value,
    targetText: `${min.toFixed(1)} a ${max.toFixed(1)} ${unit}`,
    target: target.target,
    min,
    max,
    diff: value - target.target,
    severity,
    severityClass,
    action,
    category: METRIC_CATEGORIES.truePeak
  };
  
  // 🐛 DEBUG: Instrumentação para validar TP Action
  if (DEBUG_TP_ACTION) {
    const deltaToTarget = value - target.target;
    console.log('[TP_ACTION]', {
      tp_value: value,
      tp_target: target.target,
      tp_hardCap: effectiveHardCap,
      diff: row.diff,
      deltaToTarget,
      action: row.action,
      match: Math.abs(deltaToTarget - Math.abs(row.diff)) <= 0.1 ? '✅' : '❌'
    });
  }
  
  // Issue só se não for OK
  const issue = severity !== 'OK' ? {
    key: 'truePeak',
    metric: 'truePeak',
    category: METRIC_CATEGORIES.truePeak,
    severity,
    severityLevel: severity === 'CRÍTICA' ? 'critical' : severity === 'ALTA' ? 'warning' : 'caution',
    problemText: `True Peak: ${value.toFixed(1)} ${unit} (limite: ${max.toFixed(1)} ${unit})`,
    numbers: { value, target: target.target, min, max, diff: value - target.target },
    action
  } : null;
  
  return { row, issue, score: scoreValue };
}

/**
 * Avalia métricas com range (LUFS, DR, LRA, Stereo)
 */
function evaluateRangeMetric(value, target, metricKey) {
  const { min, max, target: targetValue } = target;
  const unit = METRIC_UNITS[metricKey] || '';
  const label = METRIC_LABELS[metricKey] || metricKey;
  
  let severity, action, severityClass, scoreValue;
  
  // OK: Dentro do range [min, max]
  if (value >= min && value <= max) {
    severity = 'OK';
    severityClass = 'ok';
    action = '✅ Dentro do padrão';
    scoreValue = 1;
  }
  // FORA DO RANGE
  else {
    let diff, absDiff, actionVerb;
    
    if (value < min) {
      diff = value - min; // negativo
      absDiff = min - value;
      actionVerb = 'Aumentar';
    } else {
      diff = value - max; // positivo
      absDiff = value - max;
      actionVerb = 'Reduzir';
    }
    
    // Calcular tolerância baseada na largura do range
    const rangeWidth = max - min;
    const tolerance = rangeWidth > 0 ? rangeWidth / 2 : 1;
    
    // Gradação de severidade
    if (absDiff <= tolerance * 0.5) {
      severity = 'ATENÇÃO';
      severityClass = 'caution';
      scoreValue = 0.8;
    } else if (absDiff <= tolerance) {
      severity = 'ALTA';
      severityClass = 'warning';
      scoreValue = 0.5;
    } else {
      severity = 'CRÍTICA';
      severityClass = 'critical';
      scoreValue = 0.2;
    }
    
    const icon = severity === 'CRÍTICA' ? '🔴' : severity === 'ALTA' ? '🟡' : '⚠️';
    action = `${icon} ${actionVerb} ${absDiff.toFixed(1)} ${unit}`;
  }
  
  const valueFormatted = typeof value === 'number' 
    ? (metricKey === 'stereo' ? value.toFixed(2) : value.toFixed(1))
    : value;
  
  const row = {
    key: metricKey,
    type: 'metric',
    label,
    value: `${valueFormatted}${unit ? ' ' + unit : ''}`,
    valueRaw: value,
    targetText: `${min.toFixed(1)} a ${max.toFixed(1)}${unit ? ' ' + unit : ''}`,
    target: targetValue,
    min,
    max,
    diff: value - targetValue,
    severity,
    severityClass,
    action,
    category: METRIC_CATEGORIES[metricKey] || 'OTHER'
  };
  
  const issue = severity !== 'OK' ? {
    key: metricKey,
    metric: metricKey,
    category: METRIC_CATEGORIES[metricKey] || 'OTHER',
    severity,
    severityLevel: severity === 'CRÍTICA' ? 'critical' : severity === 'ALTA' ? 'warning' : 'caution',
    problemText: `${label}: ${valueFormatted}${unit ? ' ' + unit : ''} (ideal: ${min.toFixed(1)} a ${max.toFixed(1)})`,
    numbers: { value, target: targetValue, min, max, diff: value - targetValue },
    action
  } : null;
  
  return { row, issue, score: scoreValue };
}

/**
 * Avalia banda espectral
 */
function evaluateBand(value, target, bandKey) {
  const { min, max, target: targetValue } = target;
  const label = BAND_LABELS[bandKey] || bandKey;
  const unit = 'dB';
  
  let severity, action, severityClass, scoreValue;
  
  // OK: Dentro do range
  if (value >= min && value <= max) {
    severity = 'OK';
    severityClass = 'ok';
    action = '✅ Dentro do padrão';
    scoreValue = 1;
  }
  // FORA DO RANGE
  else {
    let absDiff, actionVerb;
    
    if (value < min) {
      absDiff = min - value;
      actionVerb = 'Aumentar';
    } else {
      absDiff = value - max;
      actionVerb = 'Reduzir';
    }
    
    // Threshold para bandas: 2dB = CRÍTICA, else ATENÇÃO
    if (absDiff >= 2) {
      severity = 'CRÍTICA';
      severityClass = 'critical';
      scoreValue = 0.3;
    } else {
      severity = 'ATENÇÃO';
      severityClass = 'caution';
      scoreValue = 0.7;
    }
    
    const icon = severity === 'CRÍTICA' ? '🔴' : '⚠️';
    action = `${icon} ${actionVerb} ${absDiff.toFixed(1)} ${unit}`;
  }
  
  const row = {
    key: bandKey,
    type: 'band',
    label,
    value: `${value.toFixed(1)} ${unit}`,
    valueRaw: value,
    targetText: `${min.toFixed(1)} a ${max.toFixed(1)} ${unit}`,
    target: targetValue,
    min,
    max,
    diff: value - (targetValue ?? (min + max) / 2),
    severity,
    severityClass,
    action,
    category: 'SPECTRAL'
  };
  
  const issue = severity !== 'OK' ? {
    key: bandKey,
    metric: bandKey,
    category: 'SPECTRAL',
    severity,
    severityLevel: severity === 'CRÍTICA' ? 'critical' : 'caution',
    problemText: `${label}: ${value.toFixed(1)} ${unit} (ideal: ${min.toFixed(1)} a ${max.toFixed(1)})`,
    numbers: { value, target: targetValue, min, max, diff: value - (targetValue ?? (min + max) / 2) },
    action
  } : null;
  
  return { row, issue, score: scoreValue };
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔧 FUNÇÕES AUXILIARES
 * ════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Normaliza métricas de múltiplos formatos de entrada
 */
function normalizeMetrics(metrics) {
  // Extrair valores de diferentes estruturas possíveis
  const getValue = (paths) => {
    for (const path of paths) {
      const parts = path.split('.');
      let value = metrics;
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }
      if (typeof value === 'number' && isFinite(value)) return value;
    }
    return null;
  };
  
  return {
    lufs: getValue(['loudness.value', 'lufsIntegrated', 'lufs_integrated', 'lufs']),
    truePeak: getValue(['truePeak.value', 'truePeakDbtp', 'true_peak_dbtp', 'truePeak']),
    dr: getValue(['dr.value', 'dynamicRange', 'dynamic_range', 'dr']),
    lra: getValue(['lra.value', 'lra', 'lu_range']),
    stereo: getValue(['stereo.value', 'stereoCorrelation', 'stereo_correlation', 'stereo']),
    bands: extractBands(metrics)
  };
}

/**
 * Extrai valores de bandas de diferentes estruturas
 */
function extractBands(metrics) {
  const sources = [
    metrics.bands,
    metrics.spectralBands?.bands,
    metrics.spectralBands
  ];
  
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    
    const bands = {};
    const bandKeys = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air'];
    
    for (const key of bandKeys) {
      const band = source[key];
      if (!band) continue;
      
      const value = typeof band === 'number' 
        ? band 
        : (band.energy_db ?? band.value ?? band.percentage);
      
      if (typeof value === 'number' && isFinite(value)) {
        bands[key] = value;
      }
    }
    
    if (Object.keys(bands).length > 0) return bands;
  }
  
  return {};
}

/**
 * Classifica score em categorias
 */
function classifyScore(scorePct) {
  if (scorePct >= 85) return 'Referência Mundial';
  if (scorePct >= 70) return 'Avançado';
  if (scorePct >= 55) return 'Intermediário';
  return 'Básico';
}

/**
 * Cria resultado vazio com erro
 */
function createEmptyResult(error) {
  return {
    rows: [],
    issues: [],
    score: { total: 0, breakdown: {}, classification: 'Erro', error },
    _error: error
  };
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🧪 EXPORTS PÚBLICOS
 * ════════════════════════════════════════════════════════════════════════════════
 */
export { 
  METRIC_LABELS, 
  BAND_LABELS, 
  METRIC_UNITS,
  METRIC_CATEGORIES,
  evaluateTruePeak,
  evaluateRangeMetric,
  evaluateBand,
  normalizeMetrics,
  classifyScore
};

console.log('🎯 CompareWithTargets v1.0.0 carregado - FUNÇÃO ÚNICA de comparação');
