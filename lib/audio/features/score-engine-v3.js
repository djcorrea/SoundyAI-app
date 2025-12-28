/**
 * =============================================================================
 * SCORE ENGINE V3 - Sistema de Score Realista por Gênero e Modo
 * =============================================================================
 * 
 * ARQUITETURA:
 * - Score por target+range: valor fora do range = 0, no target = 100
 * - TRUE PEAK GATE: TP > 0 dBTP = gate crítico (peaksScore=0, technicalScore=0, final≤35)
 * - Pesos por gênero + por modo
 * - Bandas tonais ENTRAM no score final
 * 
 * @version 3.0.0
 * @author SoundyAI Engineering
 */

// ============================================================================
// CONFIGURAÇÃO E CACHE
// ============================================================================

let v3Config = null;
let configLoadPromise = null;

/**
 * Carrega a configuração do V3 (com cache)
 */
async function loadV3Config() {
  if (v3Config) return v3Config;
  
  if (configLoadPromise) return configLoadPromise;
  
  configLoadPromise = (async () => {
    try {
      const response = await fetch('/config/scoring-v3-weights.json');
      if (!response.ok) {
        throw new Error(`Falha ao carregar config V3: ${response.status}`);
      }
      v3Config = await response.json();
      console.log('[ScoreEngineV3] Configuração carregada com sucesso');
      return v3Config;
    } catch (error) {
      console.error('[ScoreEngineV3] Erro ao carregar configuração:', error);
      // Retorna config mínima para não quebrar
      v3Config = getDefaultConfig();
      return v3Config;
    } finally {
      configLoadPromise = null;
    }
  })();
  
  return configLoadPromise;
}

/**
 * Configuração padrão caso o JSON não carregue
 */
function getDefaultConfig() {
  return {
    defaults: {
      subscore_weights: { peaks: 25, loudness: 20, tonal: 25, dynamics: 15, stereo: 10, technical: 5 },
      mode_adjustments: {
        streaming: { peaks: 1.3, loudness: 1.2, tonal: 0.9, dynamics: 0.9, stereo: 0.9, technical: 1.0 },
        pista: { peaks: 0.8, loudness: 1.3, tonal: 1.1, dynamics: 0.8, stereo: 1.0, technical: 1.0 },
        reference: { peaks: 1.0, loudness: 1.0, tonal: 1.0, dynamics: 1.0, stereo: 1.0, technical: 1.0 }
      },
      true_peak_targets: {
        streaming: { target: -1.0, min: -3.0, max: -0.5 },
        pista: { target: -0.3, min: -1.5, max: 0.0 },
        reference: { target: -1.0, min: -3.0, max: 0.0 }
      },
      lufs_targets: {
        streaming: { target: -14.0, min: -16.0, max: -12.0 },
        pista: { target: -9.0, min: -12.0, max: -6.0 },
        reference: { target: -14.0, min: -18.0, max: -8.0 }
      }
    },
    gates: {
      true_peak_critical: {
        threshold: 0.0,
        actions: { peaks_score: 0, technical_score: 0, loudness_cap: 20, final_cap: 35, classification: "Inaceitável" }
      },
      clipping_severe: {
        threshold: 5.0,
        actions: { peaks_cap: 30, technical_cap: 40, final_cap: 50, classification: "Necessita Correções" }
      }
    },
    curves: {
      default_exponent: 1.5,
      metric_exponents: { true_peak: 2.0, lufs: 1.5, bands: 1.3, dynamics: 1.5, stereo: 1.2, technical: 1.8 }
    },
    classification_thresholds: {
      referencia_mundial: { min: 90, label: "Referência Mundial", icon: "🏆" },
      pronto_streaming: { min: 75, label: "Pronto para Streaming", icon: "✅" },
      bom_ajustes: { min: 60, label: "Bom (ajustes recomendados)", icon: "⚠️" },
      necessita_correcoes: { min: 40, label: "Necessita Correções", icon: "❌" },
      inaceitavel: { min: 0, label: "Inaceitável", icon: "🚫" }
    }
  };
}

// ============================================================================
// FUNÇÕES CORE DE SCORING
// ============================================================================

/**
 * Calcula score por target e range com curva de penalização
 * 
 * REGRA CENTRAL:
 * - Valor fora do range [min, max] = 0
 * - Valor no target exato = 100
 * - Curva suave entre target e limites
 * 
 * @param {number} value - Valor medido
 * @param {number} target - Valor ideal
 * @param {number} min - Limite mínimo aceitável
 * @param {number} max - Limite máximo aceitável
 * @param {number} exponent - Expoente da curva (1=linear, 2=quadrático)
 * @returns {number} Score de 0 a 100
 */
function scoreByTargetRange(value, target, min, max, exponent = 1.5) {
  // Validação de entradas
  if (value == null || isNaN(value)) return 0;
  if (target == null || min == null || max == null) return 50; // Fallback seguro
  
  // GATE: Fora do range = 0
  if (value < min || value > max) {
    return 0;
  }
  
  // No target = 100
  if (value === target) {
    return 100;
  }
  
  // Calcular distância normalizada do target até o limite
  let distance, maxDistance;
  
  if (value < target) {
    // Abaixo do target - distância até min
    distance = target - value;
    maxDistance = target - min;
  } else {
    // Acima do target - distância até max
    distance = value - target;
    maxDistance = max - target;
  }
  
  // Prevenir divisão por zero
  if (maxDistance === 0) return 100;
  
  // Normalizar distância (0 = no target, 1 = no limite)
  const normalizedDistance = Math.min(distance / maxDistance, 1);
  
  // Aplicar curva de penalização
  // Quanto maior o expoente, mais permissivo perto do target, mais punitivo nos extremos
  const penalty = Math.pow(normalizedDistance, exponent);
  
  // Score final: 100 no target, decai até 0 nos limites com a curva aplicada
  // Mas como valor fora do range já é 0, o mínimo aqui será algo > 0
  // Para manter consistência: no limite exato = score baixo mas não 0
  const score = 100 * (1 - penalty);
  
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

/**
 * Score especial para True Peak com GATE CRÍTICO
 * 
 * REGRA CRÍTICA: TP > 0 dBTP = GATE (score = 0 + flags)
 * 
 * @param {number} truePeak - Valor de True Peak em dBTP
 * @param {number} target - Target ideal
 * @param {number} min - Mínimo aceitável  
 * @param {number} max - Máximo aceitável
 * @param {number} criticalThreshold - Limite crítico (default: 0.0 dBTP)
 * @returns {{ score: number, gateTriggered: boolean, gateType: string|null }}
 */
function scoreTruePeak(truePeak, target, min, max, criticalThreshold = 0.0) {
  const result = {
    score: 0,
    gateTriggered: false,
    gateType: null,
    rawValue: truePeak
  };
  
  // Validação
  if (truePeak == null || isNaN(truePeak)) {
    result.score = 0;
    result.gateTriggered = true;
    result.gateType = 'INVALID_DATA';
    return result;
  }
  
  // GATE CRÍTICO: TP > 0 = clipping digital
  if (truePeak > criticalThreshold) {
    result.score = 0;
    result.gateTriggered = true;
    result.gateType = 'TRUE_PEAK_CRITICAL';
    return result;
  }
  
  // Score normal usando função base
  result.score = scoreByTargetRange(truePeak, target, min, max, 2.0);
  
  // Gate secundário: TP muito perto de 0
  if (truePeak > -0.1 && truePeak <= criticalThreshold) {
    result.score = Math.min(result.score, 30); // Cap em 30
    result.gateTriggered = true;
    result.gateType = 'TRUE_PEAK_WARNING';
  }
  
  return result;
}

/**
 * Score para métricas de banda tonal
 * 
 * @param {number} value - Valor medido em dB
 * @param {object} bandSpec - { target_db, target_range: {min, max}, tol_db }
 * @param {number} exponent - Expoente da curva
 * @returns {number} Score de 0 a 100
 */
function scoreTonalBand(value, bandSpec, exponent = 1.3) {
  if (!bandSpec) return 50; // Sem spec = neutro
  
  // Extrair targets (suporta múltiplos formatos de JSON)
  let target, min, max;
  
  if (bandSpec.target_range) {
    min = bandSpec.target_range.min;
    max = bandSpec.target_range.max;
    target = bandSpec.target_db ?? bandSpec.target ?? (min + max) / 2;
  } else if (bandSpec.min != null && bandSpec.max != null) {
    min = bandSpec.min;
    max = bandSpec.max;
    target = bandSpec.target ?? (min + max) / 2;
  } else {
    // Formato legado com apenas target e tolerância
    target = bandSpec.target_db ?? bandSpec.target ?? 0;
    const tol = bandSpec.tol_db ?? 3;
    min = target - tol;
    max = target + tol;
  }
  
  return scoreByTargetRange(value, target, min, max, exponent);
}

// ============================================================================
// FUNÇÕES DE SUBSCORE
// ============================================================================

/**
 * Calcula Peaks Score (True Peak + Clipping)
 */
function computePeaksScore(technicalData, targets, exponents) {
  const truePeak = technicalData.truePeakDbtp ?? technicalData.true_peak_dbtp;
  const clipping = technicalData.clippingPct ?? technicalData.clipping_pct ?? 0;
  
  // True Peak Score (70% do peso)
  const tpResult = scoreTruePeak(
    truePeak,
    targets.true_peak.target,
    targets.true_peak.min,
    targets.true_peak.max
  );
  
  // Clipping Score (30% do peso) - invertido: 0% clipping = 100
  let clippingScore = 100;
  if (clipping > 0) {
    if (clipping > 5) clippingScore = 0;
    else if (clipping > 2) clippingScore = 20;
    else if (clipping > 1) clippingScore = 40;
    else if (clipping > 0.5) clippingScore = 60;
    else clippingScore = 80;
  }
  
  const peaksScore = tpResult.score * 0.7 + clippingScore * 0.3;
  
  return {
    score: Math.round(peaksScore * 10) / 10,
    truePeakScore: tpResult.score,
    truePeakGate: tpResult.gateTriggered,
    truePeakGateType: tpResult.gateType,
    clippingScore,
    details: {
      truePeak,
      clipping,
      targets: targets.true_peak
    }
  };
}

/**
 * Calcula Loudness Score (LUFS + LRA)
 */
function computeLoudnessScore(technicalData, targets, exponents) {
  const lufs = technicalData.lufsIntegrated ?? technicalData.lufs_integrated;
  const lra = technicalData.lra ?? technicalData.loudness_range;
  
  // LUFS Score (80% do peso)
  const lufsScore = scoreByTargetRange(
    lufs,
    targets.lufs.target,
    targets.lufs.min,
    targets.lufs.max,
    exponents.lufs
  );
  
  // LRA Score (20% do peso) - mais tolerante
  // LRA ideal varia muito por gênero, usar range amplo
  const lraTarget = 7;
  const lraMin = 3;
  const lraMax = 15;
  const lraScore = scoreByTargetRange(lra, lraTarget, lraMin, lraMax, 1.2);
  
  const loudnessScore = lufsScore * 0.8 + lraScore * 0.2;
  
  return {
    score: Math.round(loudnessScore * 10) / 10,
    lufsScore,
    lraScore,
    details: {
      lufs,
      lra,
      targets: targets.lufs
    }
  };
}

/**
 * Calcula Tonal Score (Bandas de frequência)
 */
function computeTonalScore(technicalData, bandsSpec, bandWeights, exponents) {
  const bands = technicalData.bands || {};
  const bandScores = {};
  let totalWeight = 0;
  let weightedSum = 0;
  
  // Mapeamento de nomes de banda (suporta múltiplos formatos)
  const bandMapping = {
    sub: ['sub', 'sub_bass'],
    low_bass: ['low_bass', 'lowBass'],
    upper_bass: ['upper_bass', 'upperBass'],
    low_mid: ['low_mid', 'lowMid', 'lower_mid'],
    mid: ['mid', 'mids'],
    high_mid: ['high_mid', 'highMid', 'upper_mid'],
    brilho: ['brilho', 'brightness', 'high'],
    presenca: ['presenca', 'presence', 'air']
  };
  
  for (const [bandKey, weight] of Object.entries(bandWeights)) {
    if (weight === 0) continue;
    
    // Encontrar valor da banda (tenta múltiplos nomes)
    let bandValue = null;
    const possibleNames = bandMapping[bandKey] || [bandKey];
    
    for (const name of possibleNames) {
      if (bands[name]?.avg_db != null) {
        bandValue = bands[name].avg_db;
        break;
      }
      if (bands[name]?.value != null) {
        bandValue = bands[name].value;
        break;
      }
      if (typeof bands[name] === 'number') {
        bandValue = bands[name];
        break;
      }
    }
    
    if (bandValue == null) continue;
    
    // Encontrar spec da banda no JSON de referência
    let bandSpec = null;
    if (bandsSpec) {
      for (const name of possibleNames) {
        if (bandsSpec[name]) {
          bandSpec = bandsSpec[name];
          break;
        }
      }
    }
    
    // Calcular score da banda
    const score = scoreTonalBand(bandValue, bandSpec, exponents.bands);
    bandScores[bandKey] = {
      score,
      value: bandValue,
      weight,
      spec: bandSpec
    };
    
    weightedSum += score * weight;
    totalWeight += weight;
  }
  
  const tonalScore = totalWeight > 0 ? weightedSum / totalWeight : 50;
  
  return {
    score: Math.round(tonalScore * 10) / 10,
    bandScores,
    totalBandsEvaluated: Object.keys(bandScores).length
  };
}

/**
 * Calcula Dynamics Score (DR + Crest Factor)
 */
function computeDynamicsScore(technicalData, targets, exponents) {
  const dr = technicalData.dr ?? technicalData.dr_stat;
  const crest = technicalData.crestFactor ?? technicalData.crest_factor;
  
  // DR Score (60% do peso)
  // DR ideal varia muito por gênero - usar config ou defaults
  const drTarget = targets.dr?.target ?? 8;
  const drMin = targets.dr?.min ?? 4;
  const drMax = targets.dr?.max ?? 14;
  const drScore = scoreByTargetRange(dr, drTarget, drMin, drMax, exponents.dynamics);
  
  // Crest Factor Score (40% do peso)
  // Crest ideal ~10-15 dB
  const crestTarget = 12;
  const crestMin = 6;
  const crestMax = 20;
  const crestScore = scoreByTargetRange(crest, crestTarget, crestMin, crestMax, 1.3);
  
  const dynamicsScore = drScore * 0.6 + crestScore * 0.4;
  
  return {
    score: Math.round(dynamicsScore * 10) / 10,
    drScore,
    crestScore,
    details: {
      dr,
      crest,
      drTarget: { target: drTarget, min: drMin, max: drMax }
    }
  };
}

/**
 * Calcula Stereo Score (Width + Correlation + Balance)
 */
function computeStereoScore(technicalData, exponents) {
  const width = technicalData.stereoWidth ?? technicalData.stereo_width;
  const correlation = technicalData.stereoCorrelation ?? technicalData.stereo_correlation;
  const balance = technicalData.balanceLR ?? technicalData.balance_lr ?? 0;
  
  // Stereo Width Score (40%)
  // Width ideal: 0.3-0.8 (muito estreito ou muito largo = ruim)
  const widthScore = scoreByTargetRange(width, 0.55, 0.2, 0.9, exponents.stereo);
  
  // Correlation Score (40%)
  // Correlation ideal: 0.3-0.9 (muito correlacionado = mono, muito descorrelacionado = fase)
  const correlationScore = scoreByTargetRange(correlation, 0.6, 0.1, 1.0, 1.2);
  
  // Balance Score (20%)
  // Balance ideal: próximo de 0 (centralizado)
  const balanceAbs = Math.abs(balance);
  const balanceScore = balanceAbs < 0.05 ? 100 : 
                       balanceAbs < 0.1 ? 85 :
                       balanceAbs < 0.2 ? 60 :
                       balanceAbs < 0.3 ? 40 : 20;
  
  const stereoScore = widthScore * 0.4 + correlationScore * 0.4 + balanceScore * 0.2;
  
  return {
    score: Math.round(stereoScore * 10) / 10,
    widthScore,
    correlationScore,
    balanceScore,
    details: {
      width,
      correlation,
      balance
    }
  };
}

/**
 * Calcula Technical Score (DC Offset + qualidade geral)
 */
function computeTechnicalScore(technicalData, exponents) {
  const dcOffset = technicalData.dcOffset ?? technicalData.dc_offset ?? 0;
  const centroid = technicalData.centroid ?? technicalData.spectral_centroid;
  const flatness = technicalData.spectralFlatness ?? technicalData.spectral_flatness;
  
  // DC Offset Score (50%) - deve ser próximo de 0
  const dcAbs = Math.abs(dcOffset);
  const dcScore = dcAbs < 0.001 ? 100 :
                  dcAbs < 0.01 ? 90 :
                  dcAbs < 0.03 ? 70 :
                  dcAbs < 0.05 ? 50 : 20;
  
  // Spectral Centroid (25%) - indica brilho/balanço tonal
  // Centroid ideal varia muito por gênero, usar range amplo
  const centroidScore = centroid != null ? 
    scoreByTargetRange(centroid, 3000, 1000, 6000, 1.0) : 50;
  
  // Spectral Flatness (25%) - indica "ruído" vs "tonalidade"
  // Flatness ideal para música: 0.1-0.4
  const flatnessScore = flatness != null ?
    scoreByTargetRange(flatness, 0.2, 0.05, 0.5, 1.2) : 50;
  
  const technicalScore = dcScore * 0.5 + centroidScore * 0.25 + flatnessScore * 0.25;
  
  return {
    score: Math.round(technicalScore * 10) / 10,
    dcScore,
    centroidScore,
    flatnessScore,
    details: {
      dcOffset,
      centroid,
      flatness
    }
  };
}

// ============================================================================
// FUNÇÃO PRINCIPAL DO ENGINE V3
// ============================================================================

/**
 * Computa o score usando o Score Engine V3
 * 
 * @param {object} technicalData - Dados técnicos da análise de áudio
 * @param {object} referenceData - JSON de referência do gênero
 * @param {string} mode - Modo: 'streaming', 'pista', ou 'reference'
 * @param {string} genreId - ID do gênero (ex: 'funk_mandela', 'tech_house')
 * @returns {Promise<object>} Resultado completo do scoring
 */
async function computeScoreV3(technicalData, referenceData, mode = 'streaming', genreId = null) {
  const startTime = performance.now();
  
  // Resultado padrão em caso de erro
  const errorResult = {
    scorePct: 0,
    method: 'v3_error',
    mode,
    genreId,
    error: null,
    subscores: {},
    gatesApplied: [],
    classification: 'Erro na análise'
  };
  
  try {
    // Validar entrada
    if (!technicalData) {
      errorResult.error = 'technicalData ausente';
      return errorResult;
    }
    
    // Carregar configuração
    const config = await loadV3Config();
    
    // Determinar gênero
    const effectiveGenreId = genreId || referenceData?.genre_id || 'eletronico';
    const genreConfig = config.genres[effectiveGenreId] || config.genres.eletronico || {};
    
    // Determinar modo
    const effectiveMode = normalizeMode(mode);
    
    // Obter pesos e targets
    const weights = getEffectiveWeights(config, genreConfig, effectiveMode);
    const targets = getEffectiveTargets(config, genreConfig, referenceData, effectiveMode);
    const exponents = config.curves?.metric_exponents || { true_peak: 2.0, lufs: 1.5, bands: 1.3, dynamics: 1.5, stereo: 1.2, technical: 1.8 };
    
    // Extrair specs das bandas do referenceData
    const bandsSpec = extractBandsSpec(referenceData);
    const bandWeights = genreConfig.tonal_band_weights || config.defaults?.tonal_band_weights || {
      sub: 20, low_bass: 20, upper_bass: 15, low_mid: 15, mid: 15, high_mid: 10, brilho: 3, presenca: 2
    };
    
    // =====================================================================
    // CALCULAR SUBSCORES
    // =====================================================================
    
    const peaksResult = computePeaksScore(technicalData, targets, exponents);
    const loudnessResult = computeLoudnessScore(technicalData, targets, exponents);
    const tonalResult = computeTonalScore(technicalData, bandsSpec, bandWeights, exponents);
    const dynamicsResult = computeDynamicsScore(technicalData, targets, exponents);
    const stereoResult = computeStereoScore(technicalData, exponents);
    const technicalResult = computeTechnicalScore(technicalData, exponents);
    
    // =====================================================================
    // APLICAR GATES
    // =====================================================================
    
    const gatesApplied = [];
    let finalScoreCap = 100;
    
    // GATE CRÍTICO: True Peak > 0
    if (peaksResult.truePeakGate && peaksResult.truePeakGateType === 'TRUE_PEAK_CRITICAL') {
      gatesApplied.push({
        type: 'TRUE_PEAK_CRITICAL',
        reason: `True Peak > 0 dBTP (${peaksResult.details.truePeak?.toFixed(2)} dBTP)`,
        actions: ['peaksScore=0', 'technicalScore=0', 'finalCap=35']
      });
      peaksResult.score = 0;
      technicalResult.score = 0;
      loudnessResult.score = Math.min(loudnessResult.score, 20);
      finalScoreCap = 35;
    }
    
    // GATE: True Peak Warning (muito perto de 0)
    if (peaksResult.truePeakGateType === 'TRUE_PEAK_WARNING' && !gatesApplied.some(g => g.type === 'TRUE_PEAK_CRITICAL')) {
      gatesApplied.push({
        type: 'TRUE_PEAK_WARNING',
        reason: `True Peak muito próximo de 0 (${peaksResult.details.truePeak?.toFixed(2)} dBTP)`,
        actions: ['peaksCap=30', 'finalCap=70']
      });
      peaksResult.score = Math.min(peaksResult.score, 30);
      finalScoreCap = Math.min(finalScoreCap, 70);
    }
    
    // GATE: Clipping Severo
    if (peaksResult.details.clipping > 5) {
      gatesApplied.push({
        type: 'CLIPPING_SEVERE',
        reason: `Clipping > 5% (${peaksResult.details.clipping?.toFixed(2)}%)`,
        actions: ['peaksCap=30', 'technicalCap=40', 'finalCap=50']
      });
      peaksResult.score = Math.min(peaksResult.score, 30);
      technicalResult.score = Math.min(technicalResult.score, 40);
      finalScoreCap = Math.min(finalScoreCap, 50);
    }
    
    // GATE: DC Offset Alto
    const dcOffset = technicalData.dcOffset ?? technicalData.dc_offset ?? 0;
    if (Math.abs(dcOffset) > 0.05) {
      gatesApplied.push({
        type: 'DC_OFFSET_HIGH',
        reason: `DC Offset > 5% (${(dcOffset * 100).toFixed(2)}%)`,
        actions: ['technicalPenalty=-20', 'finalPenalty=-10']
      });
      technicalResult.score = Math.max(0, technicalResult.score - 20);
    }
    
    // =====================================================================
    // CALCULAR SCORE FINAL
    // =====================================================================
    
    const subscores = {
      peaks: peaksResult,
      loudness: loudnessResult,
      tonal: tonalResult,
      dynamics: dynamicsResult,
      stereo: stereoResult,
      technical: technicalResult
    };
    
    // Soma ponderada
    let weightedSum = 0;
    let totalWeight = 0;
    
    weightedSum += peaksResult.score * weights.peaks;
    totalWeight += weights.peaks;
    
    weightedSum += loudnessResult.score * weights.loudness;
    totalWeight += weights.loudness;
    
    weightedSum += tonalResult.score * weights.tonal;
    totalWeight += weights.tonal;
    
    weightedSum += dynamicsResult.score * weights.dynamics;
    totalWeight += weights.dynamics;
    
    weightedSum += stereoResult.score * weights.stereo;
    totalWeight += weights.stereo;
    
    weightedSum += technicalResult.score * weights.technical;
    totalWeight += weights.technical;
    
    let finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    
    // Aplicar cap do gate se houver
    finalScore = Math.min(finalScore, finalScoreCap);
    
    // Aplicar penalidade de DC Offset se gate ativo
    if (gatesApplied.some(g => g.type === 'DC_OFFSET_HIGH')) {
      finalScore = Math.max(0, finalScore - 10);
    }
    
    // Arredondar
    finalScore = Math.round(finalScore * 10) / 10;
    
    // =====================================================================
    // CLASSIFICAÇÃO
    // =====================================================================
    
    const classification = getClassification(finalScore, config.classification_thresholds, gatesApplied);
    
    // =====================================================================
    // RESULTADO FINAL
    // =====================================================================
    
    const endTime = performance.now();
    
    return {
      scorePct: finalScore,
      method: 'v3',
      version: '3.0.0',
      mode: effectiveMode,
      genreId: effectiveGenreId,
      subscores,
      weights,
      gatesApplied,
      classification,
      debug: {
        computeTime: `${(endTime - startTime).toFixed(2)}ms`,
        configLoaded: !!config,
        genreConfigFound: !!config.genres[effectiveGenreId],
        bandsSpecFound: !!bandsSpec,
        metricsEvaluated: {
          peaks: true,
          loudness: true,
          tonal: tonalResult.totalBandsEvaluated > 0,
          dynamics: true,
          stereo: true,
          technical: true
        }
      }
    };
    
  } catch (error) {
    console.error('[ScoreEngineV3] Erro no cálculo:', error);
    errorResult.error = error.message;
    return errorResult;
  }
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Normaliza o modo para valores conhecidos
 */
function normalizeMode(mode) {
  if (!mode) return 'streaming';
  
  const modeMap = {
    'streaming': 'streaming',
    'streamingmax': 'streaming',
    'streaming_max': 'streaming',
    'pista': 'pista',
    'baile': 'pista',
    'bailemax': 'pista',
    'baile_max': 'pista',
    'club': 'pista',
    'reference': 'reference',
    'ref': 'reference',
    'referencia': 'reference'
  };
  
  return modeMap[mode.toLowerCase()] || 'streaming';
}

/**
 * Obtém pesos efetivos considerando gênero e modo
 */
function getEffectiveWeights(config, genreConfig, mode) {
  // Pesos base do gênero ou defaults
  const baseWeights = genreConfig.subscore_weights || config.defaults.subscore_weights;
  
  // Multiplicadores do modo
  const modeMultipliers = config.defaults.mode_adjustments[mode] || config.defaults.mode_adjustments.streaming;
  
  // Aplicar multiplicadores e normalizar para soma = 100
  const adjustedWeights = {
    peaks: baseWeights.peaks * (modeMultipliers.peaks || 1),
    loudness: baseWeights.loudness * (modeMultipliers.loudness || 1),
    tonal: baseWeights.tonal * (modeMultipliers.tonal || 1),
    dynamics: baseWeights.dynamics * (modeMultipliers.dynamics || 1),
    stereo: baseWeights.stereo * (modeMultipliers.stereo || 1),
    technical: baseWeights.technical * (modeMultipliers.technical || 1)
  };
  
  // Normalizar para soma = 100
  const total = Object.values(adjustedWeights).reduce((a, b) => a + b, 0);
  if (total > 0 && total !== 100) {
    for (const key of Object.keys(adjustedWeights)) {
      adjustedWeights[key] = adjustedWeights[key] * 100 / total;
    }
  }
  
  return adjustedWeights;
}

/**
 * Obtém targets efetivos considerando gênero, modo e referenceData
 */
function getEffectiveTargets(config, genreConfig, referenceData, mode) {
  const targets = {
    true_peak: null,
    lufs: null,
    dr: null
  };
  
  // Prioridade: genreConfig.mode_overrides > referenceData > config.defaults
  
  // True Peak
  if (genreConfig.mode_overrides?.[mode]?.true_peak) {
    targets.true_peak = genreConfig.mode_overrides[mode].true_peak;
  } else if (referenceData?.legacy_compatibility) {
    const lc = referenceData.legacy_compatibility;
    targets.true_peak = {
      target: lc.true_peak_target ?? -1,
      min: lc.true_peak_min ?? -3,
      max: lc.true_peak_max ?? 0
    };
  } else {
    targets.true_peak = config.defaults.true_peak_targets[mode] || config.defaults.true_peak_targets.streaming;
  }
  
  // LUFS
  if (genreConfig.mode_overrides?.[mode]?.lufs) {
    targets.lufs = genreConfig.mode_overrides[mode].lufs;
  } else if (referenceData?.legacy_compatibility) {
    const lc = referenceData.legacy_compatibility;
    targets.lufs = {
      target: lc.lufs_target ?? -9,
      min: lc.lufs_min ?? -12,
      max: lc.lufs_max ?? -6
    };
  } else {
    targets.lufs = config.defaults.lufs_targets[mode] || config.defaults.lufs_targets.streaming;
  }
  
  // DR
  if (referenceData?.legacy_compatibility) {
    const lc = referenceData.legacy_compatibility;
    targets.dr = {
      target: lc.dr_target ?? 8,
      min: lc.dr_min ?? 4,
      max: lc.dr_max ?? 14
    };
  } else {
    targets.dr = { target: 8, min: 4, max: 14 };
  }
  
  return targets;
}

/**
 * Extrai especificações das bandas do referenceData
 */
function extractBandsSpec(referenceData) {
  if (!referenceData) return null;
  
  // Tentar múltiplos caminhos
  if (referenceData.legacy_compatibility?.bands) {
    return referenceData.legacy_compatibility.bands;
  }
  
  if (referenceData.bands) {
    return referenceData.bands;
  }
  
  if (referenceData.spectral_balance?.bands) {
    return referenceData.spectral_balance.bands;
  }
  
  return null;
}

/**
 * Determina classificação baseada no score e gates
 */
function getClassification(score, thresholds, gatesApplied) {
  // Gates críticos sobrescrevem classificação
  if (gatesApplied.some(g => g.type === 'TRUE_PEAK_CRITICAL')) {
    return {
      level: 'inaceitavel',
      label: 'Inaceitável - Clipping Digital',
      icon: '🚫',
      reason: 'True Peak acima de 0 dBTP'
    };
  }
  
  if (gatesApplied.some(g => g.type === 'CLIPPING_SEVERE')) {
    return {
      level: 'necessita_correcoes',
      label: 'Necessita Correções Urgentes',
      icon: '❌',
      reason: 'Clipping severo detectado'
    };
  }
  
  // Classificação por score
  if (!thresholds) {
    thresholds = {
      referencia_mundial: { min: 90 },
      pronto_streaming: { min: 75 },
      bom_ajustes: { min: 60 },
      necessita_correcoes: { min: 40 },
      inaceitavel: { min: 0 }
    };
  }
  
  if (score >= thresholds.referencia_mundial.min) {
    return { level: 'referencia_mundial', label: 'Referência Mundial', icon: '🏆', score };
  }
  if (score >= thresholds.pronto_streaming.min) {
    return { level: 'pronto_streaming', label: 'Pronto para Streaming', icon: '✅', score };
  }
  if (score >= thresholds.bom_ajustes.min) {
    return { level: 'bom_ajustes', label: 'Bom (ajustes recomendados)', icon: '⚠️', score };
  }
  if (score >= thresholds.necessita_correcoes.min) {
    return { level: 'necessita_correcoes', label: 'Necessita Correções', icon: '❌', score };
  }
  
  return { level: 'inaceitavel', label: 'Inaceitável', icon: '🚫', score };
}

// ============================================================================
// EXPORTAÇÕES
// ============================================================================

// Export para uso como módulo ES6
export {
  computeScoreV3,
  scoreByTargetRange,
  scoreTruePeak,
  scoreTonalBand,
  loadV3Config,
  normalizeMode
};

// Export para uso global (compatibilidade com sistema atual)
if (typeof window !== 'undefined') {
  window.ScoreEngineV3 = {
    computeScore: computeScoreV3,
    scoreByTargetRange,
    scoreTruePeak,
    scoreTonalBand,
    loadConfig: loadV3Config,
    normalizeMode,
    version: '3.0.0'
  };
  
  console.log('[ScoreEngineV3] Engine carregado e disponível em window.ScoreEngineV3');
}
