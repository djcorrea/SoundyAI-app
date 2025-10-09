// 🧮 MIX SCORING ENGINE
// Calcula porcentagem de conformidade e classificação qualitativa baseada nas métricas técnicas e referências por gênero
// Design principles:
// - Não falha se métricas ausentes; ignora e ajusta pesos dinamicamente
// - Usa tolerâncias da referência sempre que disponível; senão aplica fallbacks sensatos

// FIXME: Código órfão comentado - precisa ser reorganizado
// console.log('[COLOR_RATIO_V2_INTERNAL] Contagens:', { total, green, yellow, red });
    
// Debug detalhado de cada métrica considerada
// FIXME: visibleFinal não está definido - comentado temporariamente
// const colorDebug = visibleFinal.map(m => ({
//   key: m.key,
//   status: m.status,
//   severity: m.severity,
//   value: m.value,
//   target: m.target
// }));

// Configuração de pesos para scoring
function initScoringWeights() {
    const winCfg = (typeof window !== 'undefined') ? window : {};
    const wGreen = Number.isFinite(winCfg.SCORE_WEIGHT_GREEN)? winCfg.SCORE_WEIGHT_GREEN : 1.0;
    const wYellow = Number.isFinite(winCfg.SCORE_WEIGHT_YELLOW)? winCfg.SCORE_WEIGHT_YELLOW : 0.7; // ← MELHORADO: era 0.5
    const wRed = Number.isFinite(winCfg.SCORE_WEIGHT_RED)? winCfg.SCORE_WEIGHT_RED : 0.3; // ← MELHORADO: era 0.0
    
    return { wGreen, wYellow, wRed };
}

// FIXME: Código órfão comentado - precisa ser movido para função apropriada
// 🎯 FÓRMULA MELHORADA: Microdiferenças (vermelho) ainda contribuem parcialmente
// Era: Verde=1.0, Amarelo=0.5, Vermelho=0.0 (muito rígido)
// Agora: Verde=1.0, Amarelo=0.7, Vermelho=0.3 (mais realístico)
// const raw = total > 0 ? ((green * wGreen + yellow * wYellow + red * wRed) / total) * 100 : 0;

// 🎯 2025-10: Score progressivo dentro da tolerância — somente bandas
function scoreTolerance(metricValue, target, tol, invert = false, tolMin = null, tolMax = null, isBandMetric = false) {
  if (!Number.isFinite(metricValue) || !Number.isFinite(target)) return null;
  // Compatibilidade: se tolMin/tolMax ausentes, usar tol simétrico
  if (!Number.isFinite(tol) || tol <= 0) tol = 1;
  if (!Number.isFinite(tolMin) || tolMin <= 0) tolMin = tol;
  if (!Number.isFinite(tolMax) || tolMax <= 0) tolMax = tol;
  const diff = metricValue - target; // positivo => acima
  const sideTol = diff > 0 ? tolMax : (diff < 0 ? tolMin : Math.max(tolMin, tolMax));
  const adiff = Math.abs(diff);
  
  if (invert) {
    // Métricas onde só penalizamos acima do target (ex: truePeak) – manter lógica antiga
    if (diff <= 0) return 1;
    if (diff >= 2 * sideTol) return 0;
    if (diff <= sideTol) return 1 - (diff / sideTol) * 0.5;
    return 1 - (0.5 + (diff - sideTol) / sideTol * 0.5);
  }
  
  // 🎯 2025-10: SCORE PROGRESSIVO PARA BANDAS - dentro da tolerância não é mais 100% instantâneo
  if (adiff <= sideTol) {
    if (PROGRESSIVE_BAND_SCORE && isBandMetric) {
      // 🎯 2025-10: SWEET SPOT - até 4dB de diferença = 100% score
      if (adiff <= SWEET_SPOT_DB) {
        return 1; // 100% para diferenças pequenas (0-4dB)
      }
      
      // Score progressivo entre SWEET_SPOT_DB e tolerância máxima
      const range = sideTol - SWEET_SPOT_DB;
      if (range > 0) {
        const progress = (sideTol - adiff) / range;  // 1 no sweet spot → 0 na borda
        const curved = Math.pow(progress, 1.1);       // Curva mais suave (era 1.3)
        return Math.min(Math.max(curved, 0), 1);     // Clamp 0..1
      } else {
        return 1; // Se range <= 0, tolerância muito baixa, retorna 100%
      }
    } else {
      // Comportamento original para métricas não-tonais
      return 1;
    }
  }
  
  // Fora da tolerância: comportamento inalterado
  if (adiff >= 2 * sideTol) return 0;
  return 1 - (adiff - sideTol) / sideTol;
}
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

// 🎯 2025-10: Utilitário para detectar métricas de banda
function isBandMetric(category, key) {
  return category === 'tonal' || 
         key.startsWith('band_') ||
         ['sub', 'bass', 'low_mid', 'mid', 'high_mid', 'presence', 'air'].includes(key);
}

// 🎯 2025-10: Aplicar tolerância ampliada para bandas respeitando refs maiores
function getEnhancedBandTolerance(bandName, originalTol) {
  const enhancedTol = ENHANCED_BAND_TOLERANCES[bandName];
  if (!enhancedTol) return originalTol;
  
  // Nunca reduzir tolerâncias que venham dos refs; apenas aumentar quando menores
  return Math.max(originalTol, enhancedTol);
}

// 🎯 CLASSIFICAÇÃO REBALANCEADA PARA NOVO SISTEMA DE SCORING
// Ajustada para ser mais otimista e realística com tolerâncias ampliadas
function classify(scorePct) {
  if (scorePct >= 85) return 'Referência Mundial';    // ↓ Era 90 - Mais acessível
  if (scorePct >= 70) return 'Avançado';              // ↓ Era 75 - Mais acessível  
  if (scorePct >= 55) return 'Intermediário';         // ↓ Era 60 - Mais acessível
  return 'Básico';
}

// 🎯 2025-10: FEATURE FLAG PARA SCORE PROGRESSIVO EM BANDAS
const PROGRESSIVE_BAND_SCORE = true;

// 🎯 2025-10: SWEET SPOT - até 4dB de diferença = 100% score
const SWEET_SPOT_DB = 4;

// 🎯 2025-10: TOLERÂNCIAS AMPLIADAS PARA BANDAS ESPECTRAIS
const ENHANCED_BAND_TOLERANCES = {
  sub: 10,        // Sub Bass (20-60 Hz)
  bass: 9,        // Bass (60-250 Hz)  
  low_mid: 8,     // Low Mid (250-500 Hz)
  mid: 7,         // Mid (500-2000 Hz)
  high_mid: 6,    // High Mid (2-4 kHz)
  presence: 8,    // Presence (4-8 kHz)
  air: 10         // Air (8+ kHz)
};

// 🎯 TOLERÂNCIAS REBALANCEADAS PARA SCORING MAIS REALÍSTICO
// Ajustadas para refletir variações aceitáveis no mundo real
const DEFAULT_TARGETS = {
  crestFactor: { target: 10, tol: 5 },            // ↑ Era 4 - Mais flexível
  stereoCorrelation: { target: 0.3, tol: 0.7 },   // ↑ Era 0.5 - Mais tolerante
  stereoWidth: { target: 0.6, tol: 0.3 },         // ↑ Era 0.25 - Mais flexível
  balanceLR: { target: 0, tol: 0.2 },             // ↑ Era 0.15 - Mais tolerante
  dcOffset: { target: 0, tol: 0.03, invert: true }, // ↑ Era 0.02 - Mais flexível
  spectralFlatness: { target: 0.25, tol: 0.2 },   // ↑ Era 0.15 - Mais tolerante
  centroid: { target: 2500, tol: 1500 },          // ↑ Era 1200 - Mais flexível
  rolloff50: { target: 3000, tol: 1500 },         // ↑ Era 1200 - Mais flexível
  rolloff85: { target: 8000, tol: 3000 },         // ↑ Era 2500 - Mais flexível
  thdPercent: { target: 1, tol: 1.5, invert: true }, // ↑ Era 1.0 - Mais tolerante
  lufsIntegrated: { target: -14, tol: 3.0 },      // ↑ Era 1.5 - MUITO mais tolerante
  lra: { target: 7, tol: 5 },                     // ↑ Era 4.0 - Mais flexível
  dr: { target: 10, tol: 5 },                     // ↑ Era 4.0 - Mais flexível
  truePeakDbtp: { target: -1, tol: 2.5, invert: true }  // ↑ Era 1.5 - Mais tolerante
};

// Mantido para compatibilidade (não mais usado na fórmula final principal, mas
// ainda usado no método advanced_fallback se o novo método falhar)
// 🎯 PESOS LEGADOS - SUBSTITUÍDOS POR PESO IGUAL NO NOVO SISTEMA
// Estes pesos eram desbalanceados e causavam dominância de loudness/bandas
const CATEGORY_WEIGHTS_LEGACY = {
  loudness: 20,   // Era dominante
  dynamics: 20,   // Era dominante
  peak: 15,       // Era dominante
  stereo: 10,     // Era subvalorizado
  tonal: 20,      // Era dominante
  spectral: 10,   // Era subvalorizado
  technical: 5    // Era muito subvalorizado
};

// 🎯 NOVO SISTEMA DE SCORING: PESOS IGUAIS V3
function _computeEqualWeightV3(analysisData) {
  console.log('[EQUAL_WEIGHT_V3] 🎯 Iniciando cálculo com pesos iguais');
  console.log('[EQUAL_WEIGHT_V3] 📊 analysisData recebido:', analysisData);
  
  // Validação robusta dos dados de entrada
  if (!analysisData) {
    console.error('[EQUAL_WEIGHT_V3] ❌ analysisData é null/undefined');
    return { score: 50, classification: 'Básico', method: 'equal_weight_v3_fallback', error: 'analysisData null' };
  }
  
  const metrics = analysisData.metrics || {};
  const reference = analysisData.reference || {};
  
  console.log('[EQUAL_WEIGHT_V3] 📊 Metrics keys:', Object.keys(metrics));
  console.log('[EQUAL_WEIGHT_V3] 📋 Reference keys:', Object.keys(reference));
  
  // Se não tem métricas, retorna fallback
  if (Object.keys(metrics).length === 0) {
    console.warn('[EQUAL_WEIGHT_V3] ⚠️ Nenhuma métrica disponível, usando fallback');
    return { score: 50, classification: 'Básico', method: 'equal_weight_v3_fallback', error: 'no metrics' };
  }
  
  // Mapeamento das métricas do technicalData para o formato do novo sistema
  const metricValues = {
    lufsIntegrated: metrics.lufsIntegrated || metrics.lufs_integrated || -14,
    truePeakDbtp: metrics.truePeakDbtp || metrics.true_peak_dbtp || -1,
    dr: metrics.dr || metrics.dr_stat || 10,
    lra: metrics.lra || 7,
    crestFactor: metrics.crestFactor || metrics.crest_factor || 10,
    stereoCorrelation: metrics.stereoCorrelation || metrics.stereo_correlation || 0.3,
    stereoWidth: metrics.stereoWidth || metrics.stereo_width || 0.6,
    balanceLR: metrics.balanceLR || metrics.balance_lr || 0,
    centroid: metrics.centroid || metrics.spectral_centroid || 2500,
    spectralFlatness: metrics.spectralFlatness || metrics.spectral_flatness || 0.25,
    rolloff85: metrics.rolloff85 || metrics.spectral_rolloff_85 || 8000,
    dcOffset: Math.max(Math.abs(metrics.dcOffsetLeft || 0), Math.abs(metrics.dcOffsetRight || 0)),
    clippingPct: metrics.clippingPct || metrics.clipping_pct || 0
  };
  
  // Targets e tolerâncias otimizadas
  const targets = {
    lufsIntegrated: reference.lufs_target || -14,
    truePeakDbtp: reference.true_peak_target || -1,
    dr: reference.dr_target || 10,
    lra: reference.lra_target || 7,
    crestFactor: 10,
    stereoCorrelation: reference.stereo_target || 0.3,
    stereoWidth: 0.6,
    balanceLR: 0,
    centroid: 2500,
    spectralFlatness: 0.25,
    rolloff85: 8000,
    dcOffset: 0,
    clippingPct: 0
  };
  
  const tolerances = {
    lufsIntegrated: reference.tol_lufs || 3.0,
    truePeakDbtp: reference.tol_true_peak || 2.5,
    dr: reference.tol_dr || 5.0,
    lra: reference.tol_lra || 5.0,
    crestFactor: 5.0,
    stereoCorrelation: reference.tol_stereo || 0.7,
    stereoWidth: 0.3,
    balanceLR: 0.2,
    centroid: 1500,
    spectralFlatness: 0.2,
    rolloff85: 3000,
    dcOffset: 0.03,
    clippingPct: 0.5
  };
  
  console.log('[EQUAL_WEIGHT_V3] Valores das métricas:', metricValues);
  
  let totalScore = 0;
  let metricCount = 0;
  const details = [];
  
  // Cálculo com peso igual para cada métrica
  for (const [key, value] of Object.entries(metricValues)) {
    if (targets[key] !== undefined && tolerances[key] !== undefined && Number.isFinite(value)) {
      const target = targets[key];
      const tolerance = tolerances[key];
      const deviation = Math.abs(value - target);
      const deviationRatio = tolerance > 0 ? deviation / tolerance : 0;
      
      let metricScore = 100;
      
      // Curva de penalização suave
      if (deviationRatio > 0) {
        if (deviationRatio <= 1) {
          metricScore = 100; // Dentro da tolerância = perfeito
        } else if (deviationRatio <= 2) {
          metricScore = 100 - (deviationRatio - 1) * 25; // 75-100%
        } else if (deviationRatio <= 3) {
          metricScore = 75 - (deviationRatio - 2) * 20; // 55-75%
        } else {
          metricScore = Math.max(30, 55 - (deviationRatio - 3) * 15); // 30-55%
        }
      }
      
      totalScore += metricScore;
      metricCount++;
      
      details.push({
        key,
        value,
        target,
        tolerance,
        deviation,
        deviationRatio: parseFloat(deviationRatio.toFixed(3)),
        metricScore: parseFloat(metricScore.toFixed(1))
      });
      
      console.log(`[EQUAL_WEIGHT_V3] ${key}: ${value} -> ${metricScore.toFixed(1)}% (dev: ${deviationRatio.toFixed(2)}x)`);
    }
  }
  
  // Score final = média aritmética simples
  const finalScore = metricCount > 0 ? totalScore / metricCount : 50; // Fallback para 50% se nenhuma métrica
  const scoreDecimal = parseFloat(finalScore.toFixed(1));
  
  console.log('[EQUAL_WEIGHT_V3] 📊 Cálculo final:');
  console.log('[EQUAL_WEIGHT_V3]   - totalScore:', totalScore);
  console.log('[EQUAL_WEIGHT_V3]   - metricCount:', metricCount);
  console.log('[EQUAL_WEIGHT_V3]   - finalScore:', finalScore);
  console.log('[EQUAL_WEIGHT_V3]   - scoreDecimal:', scoreDecimal);
  
  // Garantir que o score é válido com múltiplas verificações
  let validScore = Number.isFinite(scoreDecimal) ? scoreDecimal : 50;
  
  // Clamp para range válido
  if (validScore < 0) validScore = 0;
  if (validScore > 100) validScore = 100;
  if (isNaN(validScore)) validScore = 50;
  
  console.log('[EQUAL_WEIGHT_V3] 📊 Score validado:', validScore);
  
  // Classificação otimizada
  let classification = 'Básico';
  if (validScore >= 85) classification = 'Referência Mundial';
  else if (validScore >= 70) classification = 'Avançado';
  else if (validScore >= 55) classification = 'Intermediário';
  
  console.log('[EQUAL_WEIGHT_V3] 🏷️ Classificação:', classification);
  
  const result = {
    score: validScore,
    classification,
    method: 'equal_weight_v3',
    details: {
      totalMetrics: metricCount,
      equalWeight: metricCount > 0 ? parseFloat((100 / metricCount).toFixed(2)) : 100,
      metricDetails: details,
      _computed: true,
      _finalScore: finalScore,
      _validScore: validScore,
      _rawData: {
        totalScore,
        metricCount,
        scoreDecimal
      }
    }
  };
  
  console.log('[EQUAL_WEIGHT_V3] ✅ Resultado final completo:', result);
  console.log('[EQUAL_WEIGHT_V3] ✅ Score verificação final:', Number.isFinite(result.score));
  
  // Garantia absoluta de que nunca retorna null
  if (!result || !Number.isFinite(result.score)) {
    console.error('[EQUAL_WEIGHT_V3] ❌ ERRO CRÍTICO: Resultado inválido, forçando fallback');
    return {
      score: 50,
      classification: 'Básico',
      method: 'equal_weight_v3_emergency_fallback',
      error: 'invalid_result'
    };
  }
  
  return result;
}

function _computeMixScoreInternal(technicalData = {}, reference = null, force = { AUDIT_MODE:false, SCORING_V2:false, AUTO_V2:true }) {
  console.log('[SCORING_INTERNAL] 🚀 _computeMixScoreInternal iniciado');
  console.log('[SCORING_INTERNAL] 📊 Flags recebidas:', force);
  
  const __caiarLog = (typeof window !== 'undefined' && window.__caiarLog) ? window.__caiarLog : function(){};
  __caiarLog('SCORING_START','Iniciando cálculo de mix score', { metrics: Object.keys(technicalData||{}).length, ref: !!reference, modeFlags: force });
  const AUDIT_MODE = !!force.AUDIT_MODE;
  let SCORING_V2 = !!force.SCORING_V2 && (AUDIT_MODE || force.overrideAuditBypass);
  // Auto-upgrade: se não está em V2 mas métricas avançadas existem e auto habilitado
  if (!SCORING_V2 && force.AUTO_V2 !== false) {
    if (technicalData && (
      Number.isFinite(technicalData.tt_dr) ||        // 🏆 TT-DR AUTO-ATIVA SCORING_V2
      Number.isFinite(technicalData.dr_stat) ||
      Number.isFinite(technicalData.thdPercent) ||
      Number.isFinite(technicalData.spectralRolloff50) ||
      Number.isFinite(technicalData.dcOffsetLeft) ||
      Number.isFinite(technicalData.dcOffsetRight)
    )) {
      SCORING_V2 = true;
      force._autoPromoted = true;
      console.log('🏆 AUTO-PROMOÇÃO SCORING_V2: TT-DR detectado!');
    }
  }
  const ref = reference;
  const metrics = technicalData || {};
  const perMetric = [];
  const catAgg = {};
  function addMetric(category, key, value, target, tol, opts = {}) {
    if (!Number.isFinite(value) || value === -Infinity) return;
    if (!Number.isFinite(target)) return;
    if (!Number.isFinite(tol) || tol <= 0) tol = DEFAULT_TARGETS[key]?.tol || 1;
    
    // 🎯 2025-10: Aplicar tolerâncias ampliadas para bandas
    const isFrequencyBand = isBandMetric(category, key);
    if (isFrequencyBand) {
      // Extrair nome da banda do key (remove 'band_' prefix se presente)
      const bandName = key.startsWith('band_') ? key.substring(5) : key;
      tol = getEnhancedBandTolerance(bandName, tol);
    }
    
    // Suporte opcional a tolMin / tolMax em opts
    const tolMin = Number.isFinite(opts.tolMin) && opts.tolMin > 0 ? opts.tolMin : null;
    const tolMax = Number.isFinite(opts.tolMax) && opts.tolMax > 0 ? opts.tolMax : null;
    
    // 🎯 2025-10: Passar flag isBandMetric para scoreTolerance()
    const scoreA = scoreTolerance(value, target, tol, !!opts.invert, tolMin, tolMax, isFrequencyBand);
    if (scoreA == null) return;
    
    // 🎯 2025-01: SISTEMA HÍBRIDO - Calcular Pista B (improvement-based scoring)
    let finalScore = scoreA; // Padrão: usar Pista A (proximidade)
    
    if (isFrequencyBand && typeof window !== 'undefined' && window.__BASELINE_BAND_ENERGIES) {
      const bandName = key.startsWith('band_') ? key.substring(5) : key;
      const baseline = window.__BASELINE_BAND_ENERGIES.data[bandName];
      
      if (baseline && Number.isFinite(baseline.rms_db)) {
        const STEP_MAX = 4; // dB - máximo step considerado para score 100%
        
        // Calcular melhoria: quão mais próximo ficou do target
        const distBefore = Math.abs(baseline.rms_db - target);
        const distAfter = Math.abs(value - target);
        const improvement = distBefore - distAfter; // positivo = melhorou
        
        if (improvement > 0) {
          // Score B baseado na proporção de melhoria vs STEP_MAX (com boost opcional)
          let scoreB = Math.min(1.0, (improvement / STEP_MAX) * 1.2); // boost 1.2x
          
          // Cap de sanidade: se banda continua muito longe, limitar scoreB
          const sideTol = Math.max(effTolMin, effTolMax);
          if (distAfter > 2 * sideTol) {
            scoreB = Math.min(scoreB, 0.80); // máx 80% se ainda muito longe
          }
          
          // 🏆 HÍBRIDO: Math.max(Pista A, Pista B)
          finalScore = Math.max(scoreA, scoreB);
          
          // Debug detalhado só se habilitado
          if (window.DEBUG_HYBRID_SCORE) {
            console.debug('[HYBRID]', bandName, {
              distBefore: distBefore.toFixed(1),
              distAfter: distAfter.toFixed(1), 
              improvement: improvement.toFixed(1),
              scoreA: (scoreA*100).toFixed(1)+'%',
              scoreB: (scoreB*100).toFixed(1)+'%',
              final: (finalScore*100).toFixed(1)+'%'
            });
          }
        }
      }
    }
    
    // 🎯 2025-10: LOG TEMPORÁRIO para validação - somente bandas (dev)
    if (isFrequencyBand && typeof window !== 'undefined' && window.DEBUG_PROGRESSIVE_SCORE) {
      const diff = Math.abs(value - target);
      console.log(`[PROGRESSIVE] ${key}: val=${value.toFixed(1)} target=${target.toFixed(1)} tol=${tol.toFixed(1)} diff=${diff.toFixed(1)} score=${(finalScore*100).toFixed(1)}%`);
    }
    // Determinar status (OK / BAIXO / ALTO) e severidade
    let status = 'OK';
    let severity = null;
    const diff = value - target;
    const effTolMin = tolMin || tol; const effTolMax = tolMax || tol;
    if (!opts.invert) {
      if (diff < -effTolMin) status = 'BAIXO'; else if (diff > effTolMax) status = 'ALTO';
    } else {
      // invert: só faz sentido 'ALTO' se acima do target mais tolMax
      if (diff > effTolMax) status = 'ALTO';
    }
    if (status !== 'OK') {
      const sideTol = diff > 0 ? effTolMax : effTolMin;
      const n = Math.abs(diff) / sideTol;
      severity = n <= 1 ? 'leve' : (n <= 2 ? 'media' : 'alta');
    }
  const sideTol = diff > 0 ? effTolMax : effTolMin;
  const n = status === 'OK' ? 0 : (sideTol>0 ? Math.abs(diff)/sideTol : Infinity);
  perMetric.push({ category, key, value, target, tol, tol_min: effTolMin, tol_max: effTolMax, score: clamp01(finalScore), status, severity, n: Number.isFinite(n)?parseFloat(n.toFixed(3)):null, diff: parseFloat((value-target).toFixed(3)) });
  try { __caiarLog && __caiarLog('SCORING_METRIC', 'Metric avaliada', { key, value, target, tolMin: effTolMin, tolMax: effTolMax, status, severity, n }); } catch {}
  }
  const lufsTarget = ref?.lufs_target ?? DEFAULT_TARGETS.lufsIntegrated.target;
  const lufsTol = ref?.tol_lufs ?? DEFAULT_TARGETS.lufsIntegrated.tol;
  // Loudness com suporte a tol_lufs_min / tol_lufs_max
  const lufsTolMin = Number.isFinite(ref?.tol_lufs_min) ? ref.tol_lufs_min : lufsTol;
  const lufsTolMax = Number.isFinite(ref?.tol_lufs_max) ? ref.tol_lufs_max : lufsTol;
  addMetric('loudness', 'lufsIntegrated', metrics.lufsIntegrated, lufsTarget, (lufsTolMin + lufsTolMax)/2, { tolMin: lufsTolMin, tolMax: lufsTolMax });
  
  // 🏆 TT-DR OFICIAL vs Legacy Crest Factor
  // Prioridade: TT-DR (tt_dr) > dr_stat > dynamicRange (crest factor legacy)
  const useTTDR = SCORING_V2 || force.USE_TT_DR === true;
  
  if (useTTDR && Number.isFinite(metrics.tt_dr)) {
    // TT-DR oficial (padrão da indústria)
    addMetric('dynamics', 'tt_dr', metrics.tt_dr, ref?.tt_dr_target ?? (ref?.dr_stat_target ?? (ref?.dr_target ?? DEFAULT_TARGETS.dr.target)), ref?.tol_tt_dr ?? (ref?.tol_dr_stat ?? (ref?.tol_dr ?? DEFAULT_TARGETS.dr.tol)));
  } else if (useTTDR && Number.isFinite(metrics.dr_stat)) {
    // Fallback para dr_stat (percentil method)
    addMetric('dynamics', 'dr_stat', metrics.dr_stat, ref?.dr_stat_target ?? (ref?.dr_target ?? DEFAULT_TARGETS.dr.target), ref?.tol_dr_stat ?? (ref?.tol_dr ?? DEFAULT_TARGETS.dr.tol));
  } else {
    // Legacy: Crest Factor (Peak-RMS)
    addMetric('dynamics', 'dr', metrics.dynamicRange ?? metrics.dr, ref?.dr_target ?? DEFAULT_TARGETS.dr.target, ref?.tol_dr ?? DEFAULT_TARGETS.dr.tol);
  }
  
  addMetric('dynamics', 'lra', metrics.lra, ref?.lra_target ?? DEFAULT_TARGETS.lra.target, ref?.tol_lra ?? DEFAULT_TARGETS.lra.tol);
  
  // Crest Factor como métrica auxiliar separada (opcional)
  if (Number.isFinite(metrics.crestFactor)) {
    addMetric('dynamics', 'crestFactor', metrics.crestFactor, DEFAULT_TARGETS.crestFactor.target, DEFAULT_TARGETS.crestFactor.tol);
  }
  addMetric('peak', 'truePeakDbtp', metrics.truePeakDbtp, ref?.true_peak_target ?? DEFAULT_TARGETS.truePeakDbtp.target, ref?.tol_true_peak ?? DEFAULT_TARGETS.truePeakDbtp.tol, { invert: true });
  addMetric('stereo', 'stereoCorrelation', metrics.stereoCorrelation, ref?.stereo_target ?? DEFAULT_TARGETS.stereoCorrelation.target, ref?.tol_stereo ?? DEFAULT_TARGETS.stereoCorrelation.tol);
  addMetric('stereo', 'stereoWidth', metrics.stereoWidth, DEFAULT_TARGETS.stereoWidth.target, DEFAULT_TARGETS.stereoWidth.tol);
  addMetric('stereo', 'balanceLR', metrics.balanceLR, DEFAULT_TARGETS.balanceLR.target, DEFAULT_TARGETS.balanceLR.tol);
  if (ref?.bands && metrics.bandEnergies) {
    for (const [band, refBand] of Object.entries(ref.bands)) {
      const mBand = metrics.bandEnergies[band];
      if (!mBand) continue;
      const val = Number.isFinite(mBand.rms_db) ? mBand.rms_db : null;
      if (val == null) continue;
      if (Number.isFinite(refBand?.target_db) && (Number.isFinite(refBand?.tol_db) || (Number.isFinite(refBand?.tol_min) && Number.isFinite(refBand?.tol_max))) && refBand.target_db != null) {
        const tolMin = Number.isFinite(refBand.tol_min) ? refBand.tol_min : (Number.isFinite(refBand.tol_db) ? refBand.tol_db : null);
        const tolMax = Number.isFinite(refBand.tol_max) ? refBand.tol_max : (Number.isFinite(refBand.tol_db) ? refBand.tol_db : null);
        
        // 🎯 2025-10: Aplicar tolerância ampliada respeitando valores maiores dos refs
        let tolAvg = ((tolMin||0)+(tolMax||0))/2 || refBand.tol_db || 1;
        tolAvg = getEnhancedBandTolerance(band, tolAvg);
        
        addMetric('tonal', `band_${band}`, val, refBand.target_db, tolAvg, { tolMin, tolMax });
      }
    }
  } else if (metrics.tonalBalance) {
    ['sub','low','mid','high'].forEach(b => {
      const v = metrics.tonalBalance?.[b]?.rms_db;
      if (Number.isFinite(v)) {
        // 🎯 2025-10: Aplicar tolerância ampliada para fallback de bandas
        const enhancedTol = getEnhancedBandTolerance(b, 6);
        addMetric('tonal', `band_${b}`, v, v, enhancedTol);
      }
    });
  }
  addMetric('spectral', 'centroid', metrics.spectralCentroid, DEFAULT_TARGETS.centroid.target, DEFAULT_TARGETS.centroid.tol);
  addMetric('spectral', 'spectralFlatness', metrics.spectralFlatness, DEFAULT_TARGETS.spectralFlatness.target, DEFAULT_TARGETS.spectralFlatness.tol);
  if (SCORING_V2) {
    addMetric('spectral', 'rolloff50', metrics.spectralRolloff50, DEFAULT_TARGETS.rolloff50.target, DEFAULT_TARGETS.rolloff50.tol);
  }
  addMetric('spectral', 'rolloff85', metrics.spectralRolloff85, DEFAULT_TARGETS.rolloff85.target, DEFAULT_TARGETS.rolloff85.tol);
  if (SCORING_V2 && Number.isFinite(metrics.thdPercent)) {
    addMetric('technical', 'thdPercent', metrics.thdPercent, DEFAULT_TARGETS.thdPercent.target, DEFAULT_TARGETS.thdPercent.tol, { invert: true });
  }
  addMetric('technical', 'dcOffset', Math.abs(metrics.dcOffset), DEFAULT_TARGETS.dcOffset.target, DEFAULT_TARGETS.dcOffset.tol, { invert: true });
  if (SCORING_V2) {
    if (Number.isFinite(metrics.dcOffsetLeft)) addMetric('technical','dcOffsetLeft', Math.abs(metrics.dcOffsetLeft), DEFAULT_TARGETS.dcOffset.target, DEFAULT_TARGETS.dcOffset.tol, { invert:true });
    if (Number.isFinite(metrics.dcOffsetRight)) addMetric('technical','dcOffsetRight', Math.abs(metrics.dcOffsetRight), DEFAULT_TARGETS.dcOffset.target, DEFAULT_TARGETS.dcOffset.tol, { invert:true });
  }
  if (Number.isFinite(metrics.clippingPct)) {
    const cTol = 0.5;
    const cVal = metrics.clippingPct;
    const s = cVal <= cTol ? 1 : (cVal >= 5 ? 0 : 1 - (cVal - cTol) / (5 - cTol));
    perMetric.push({ category: 'technical', key: 'clippingPct', value: cVal, target: 0, tol: cTol, score: clamp01(s) });
  } else if (Number.isFinite(metrics.clippingSamples)) {
    const samples = metrics.clippingSamples;
    const s = samples === 0 ? 1 : (samples < 10 ? 0.7 : 0);
    perMetric.push({ category: 'technical', key: 'clippingSamples', value: samples, target: 0, tol: 0, score: clamp01(s) });
  }
  for (const cat of Object.keys(CATEGORY_WEIGHTS_LEGACY)) {
    catAgg[cat] = { weight: CATEGORY_WEIGHTS_LEGACY[cat], metrics: [], score: null };
  }
  for (const m of perMetric) { if (catAgg[m.category]) catAgg[m.category].metrics.push(m); }
  let totalWeight = 0;
  for (const cat of Object.values(catAgg)) { if (cat.metrics.length === 0) cat.weight = 0; else totalWeight += cat.weight; }
  if (totalWeight === 0) return { scorePct: 0, classification: 'Básico', details: { perMetric: [], categories: {} } };
  let weightedSum = 0;
  for (const [name, cat] of Object.entries(catAgg)) {
    if (cat.weight === 0 || cat.metrics.length === 0) continue;
    const mean = cat.metrics.reduce((a,b)=>a + b.score, 0) / cat.metrics.length;
    cat.score = mean;
    weightedSum += mean * cat.weight;
  }
  let scorePct = (weightedSum / totalWeight) * 100; // legacy pre-penalties (mantido como base para advancedScorePct)
  // Penalização de invariants (SCORING_V2): reduz até 5 pontos conforme flags críticos
  if (SCORING_V2 && metrics.auditInvariants && metrics.auditInvariants.flags) {
    const f = metrics.auditInvariants.flags;
    let penalty = 0;
    if (f.truePeakOverZero) penalty += 2;
    if (f.dcOffsetHigh) penalty += 1;
    if (f.tooManyBandsOut) penalty += 2;
    if (f.nonFinite) penalty += 5;
    if (f.lufsOutOfRange) penalty += 2;
    scorePct = Math.max(0, scorePct - penalty);
  }
  // (legacy intermediate classification calculado antes da nova fórmula é ignorado)
  // ================= NOVO ALGORITMO DE PENALIDADES (score reformulado) =================
  // Requisitos chave:
  // - Penalização bidirecional (abaixo/acima) usando tol_min/tol_max assimétricos
  // - Fórmula score = round(100 * (1 - P_final)) onde P_final = max(P_sum, P_crit)
  // - Curva de severidade com joelhos em 1x e 2x tolerância
  // - Caps para desvios críticos >=3x
  // - Redistribuição de pesos quando faltam métricas

  const logMetricPenalty = (m) => { try { __caiarLog('SCORING_PENALTY_METRIC','Penalty calc', m); } catch {} };

  // Função util clamp
  const clamp01f = (x)=> x<0?0:(x>1?1:x);
  // 🎯 CORREÇÃO: Função de penalty mais suave para evitar scores muito baixos
  function unitPenaltyFromN(n){
    if (n <= 0) return 0;
    if (n <= 1) return 0.10 * n; // Reduzido de 0.15 para 0.10
    if (n <= 2) return 0.10 + 0.20 * (n - 1); // 0.10 -> 0.30 (antes era 0.40)
    if (n <= 3) return 0.30 + 0.25 * (n - 2); // 0.30 -> 0.55 (nova faixa)
    // n > 3: 0.55 + 0.35 * ((n-3)/2) saturando em 0.90 em n=5
    return 0.55 + 0.35 * clamp01f((n - 3) / 2);
  }

  // Mapear pesos base (somam 0.95 + 0.05 contextual = 1.0)
  const baseWeights = {
    lufsIntegrated: 0.18,
    truePeakDbtp: 0.14, // headroom substituído por truePeak
    band_high_mid: 0.14,
    band_brilho: 0.12,
    band_presenca: 0.12,
    band_low_bass: 0.08,
    band_upper_bass: 0.07,
    band_low_mid: 0.05,
    band_mid: 0.05,
    // Contextuais (espalhar 0.05): lra, dr|dr_stat, stereoCorrelation, stereoWidth
    lra: 0, // atribuído depois
    dr: 0,
    dr_stat: 0,
    stereoCorrelation: 0,
    stereoWidth: 0
  };
  const contextualKeys = ['lra','dr_stat','dr','stereoCorrelation','stereoWidth'];
  const contextualBudget = 0.05;
  // Coletar quais contextuais estão presentes
  const presentContextual = contextualKeys.filter(k => perMetric.some(m => m.key === k));
  const ctxUnit = presentContextual.length ? contextualBudget / presentContextual.length : 0;
  presentContextual.forEach(k => { baseWeights[k] = ctxUnit; });

  // Filtrar métricas realmente presentes com target válido
  const presentMetrics = perMetric.filter(m => Number.isFinite(m.value) && Number.isFinite(m.target));
  // ================== CÁLCULO DE PENALIDADES AVANÇADAS ==================
  const sumBasePresent = presentMetrics.reduce((acc,m)=> acc + (baseWeights[m.key] || 0), 0) || 1;
  const penalties = [];
  for (const m of presentMetrics) {
    const wRaw = baseWeights[m.key] || 0;
    const w = wRaw / sumBasePresent; // normalizado
    const u = unitPenaltyFromN(Number.isFinite(m.n)?m.n:0); // 0..1
    const p = u * w;
    penalties.push({ key: m.key, n: m.n, u: parseFloat(u.toFixed(4)), w: parseFloat(w.toFixed(4)), p: parseFloat(p.toFixed(4)), status: m.status, severity: m.severity });
  }
  const P_sum = penalties.reduce((a,b)=> a + b.p, 0);
  // P_crit simples: maior unidade crítica isolada
  const critUnits = penalties.map(p=>p.u).sort((a,b)=>b-a);
  const Ucrit_max = critUnits[0] || 0;
  const Ucrit_2nd = critUnits[1] || 0;
  // 🎯 CORREÇÃO: Combinação crítica mais suave para evitar saturação
  const P_crit = Math.max(Ucrit_max * 0.8, (Ucrit_max*0.6 + Ucrit_2nd*0.2));
  // 🎯 CORREÇÃO: P_final com saturação mais gradual
  const P_final = Math.min(0.85, Math.max(P_sum * 0.7, P_crit)); // Reduzido de 1.0 para 0.85 max
  const scoreNew = Math.max(15, (1 - P_final) * 100); // Floor de 15% em vez de 0%
  // ================== RESULT STRUCT ==================
  const result = {
    advancedScorePct: parseFloat(scoreNew.toFixed(2)),
    scorePct: null,
    classification: null,
    scoreMode: SCORING_V2 ? 'v2' : 'legacy',
    invariantsPenaltyApplied: (SCORING_V2 && metrics.auditInvariants && metrics.auditInvariants.flags) ? true : false,
    totalWeight: parseFloat(totalWeight.toFixed(2)),
    categories: Object.fromEntries(Object.entries(catAgg).map(([k,v])=>[k, { weight: v.weight, score: v.score != null ? parseFloat((v.score*100).toFixed(1)) : null }])),
    perMetric: perMetric.map(m=>({ key: m.key, category: m.category, value: m.value, target: m.target, tol: m.tol, tol_min: m.tol_min, tol_max: m.tol_max, diff: m.diff, status: m.status, severity: m.severity, n: m.n, scorePct: parseFloat((m.score*100).toFixed(1)) })),
    highlights: { /* placeholders antes: best/worst removidos */ },
    penalties,
    penaltiesSummary: { P_sum: parseFloat(P_sum.toFixed(4)), P_crit: parseFloat(P_crit.toFixed(4)), P_final: parseFloat(P_final.toFixed(4)), Ucrit_max: parseFloat(Ucrit_max.toFixed(4)), Ucrit_2nd: parseFloat(Ucrit_2nd.toFixed(4)) },
    formulaNote: 'advancedScorePct = 100 * (1 - max(P_sum, P_crit)); método principal de exibição = color_ratio_v2.'
  };
  // ================== MÉTODO PRINCIPAL COLOR_RATIO_V2 REFORMULADO ==================
  // 🔥 FORÇAR NOVO SISTEMA: DESABILITAR COLOR_RATIO_V2 PARA USAR EQUAL_WEIGHT_V3
  const colorRatioEnabled = (() => {
    // FORÇAR DESABILITAÇÃO do color_ratio_v2 para usar equal_weight_v3
    console.log('[EQUAL_WEIGHT_V3] ⚡ Sistema antigo color_ratio_v2 DESABILITADO - usando novo sistema');
    console.log('[EQUAL_WEIGHT_V3] 🎯 Retornando FALSE para forçar novo sistema');
    return false; // ⭐ FORÇA USO DO NOVO SISTEMA
  })();
  
  console.log('[SCORING_INTERNAL] 🎯 colorRatioEnabled resultado:', colorRatioEnabled);
  
  if (colorRatioEnabled) {
    try {
  // 🎯 NOVO SISTEMA: PESO IGUAL PARA TODAS AS MÉTRICAS
  console.log('[NEW_EQUAL_WEIGHT_SCORING] Iniciando cálculo com pesos iguais');
  
  if (perMetric.length === 0) {
    console.warn('[NEW_EQUAL_WEIGHT_SCORING] Nenhuma métrica disponível');
    throw new Error('Nenhuma métrica processada');
  }
  
  // 🔥 INOVAÇÃO: Cálculo individual de score por métrica com penalização suave
  const metricScores = [];
  
  for (const metric of perMetric) {
    let metricScore = 100; // Começar com 100%
    
    if (metric.status !== 'OK') {
      // Calcular penalização baseada em desvio da tolerância
      const deviationRatio = metric.n || 0; // ratio of deviation/tolerance
      
      // 🎯 CURVA SUAVE: Não zera score, apenas reduz proporcionalmente
      if (deviationRatio <= 1) {
        metricScore = 100; // Dentro da tolerância = 100%
      } else if (deviationRatio <= 2) {
        metricScore = 100 - (deviationRatio - 1) * 25; // 75-100% (antes era muito mais severo)
      } else if (deviationRatio <= 3) {
        metricScore = 75 - (deviationRatio - 2) * 20;  // 55-75%
      } else {
        metricScore = Math.max(30, 55 - (deviationRatio - 3) * 15); // 30-55% mínimo
      }
    }
    
    metricScores.push({
      key: metric.key,
      score: metricScore,
      status: metric.status,
      severity: metric.severity,
      deviationRatio: metric.n || 0,
      value: metric.value,
      target: metric.target
    });
  }
  
  // 🎯 PESO IGUAL: Cada métrica contribui igualmente para o score final
  const totalMetrics = metricScores.length;
  const equalWeight = 100 / totalMetrics;
  
  console.log(`[NEW_EQUAL_WEIGHT_SCORING] ${totalMetrics} métricas, peso cada: ${equalWeight.toFixed(2)}%`);
  
  // 🎯 SCORE FINAL COM DECIMAIS REALÍSTICOS
  const rawScore = metricScores.reduce((sum, metric) => {
    return sum + (metric.score * equalWeight / 100);
  }, 0);
  
  // 🔥 PRESERVAR DECIMAIS: Usar 1 casa decimal para realismo
  const finalScore = parseFloat(rawScore.toFixed(1));
  
  console.log(`[NEW_EQUAL_WEIGHT_SCORING] Score final: ${finalScore}% (era ${Math.round(rawScore)}%)`);
  
  // Manter compatibilidade com sistema de cores para interface
  const total = perMetric.length;
  const green = perMetric.filter(m => m.status === 'OK').length;
  const yellow = perMetric.filter(m => m.status !== 'OK' && m.severity === 'leve').length;
  const red = total - green - yellow;
  
  result.scorePct = finalScore; // 🎯 NOVO: Score decimal realístico
  result.score_simple_binary = Math.round((green / total) * 100);
  result.method = 'equal_weight_v3';
  result.scoringMethod = 'equal_weight_v3';
  result.colorCounts = { green, yellow, red, total };
  result.equalWeightDetails = {
    totalMetrics,
    equalWeight: parseFloat(equalWeight.toFixed(2)),
    metricScores: metricScores.map(m => ({
      key: m.key,
      score: parseFloat(m.score.toFixed(1)),
      contribution: parseFloat((m.score * equalWeight / 100).toFixed(2)),
      status: m.status,
      deviationRatio: m.deviationRatio
    }))
  };
  
  // INSTRUMENTAÇÃO PARA DIAGNÓSTICO
  result.yellowKeys = perMetric.filter(m => m.status !== 'OK' && m.severity === 'leve').map(m => m.key);
  result.greenKeys = perMetric.filter(m => m.status === 'OK').map(m => m.key);
  result.redKeys = perMetric.filter(m => m.status !== 'OK' && m.severity !== 'leve').map(m => m.key);
  
  result.audit = { 
    rawExact: rawScore, 
    finalScore: finalScore,
    previousRoundedScore: Math.round(rawScore),
    improvementFromDecimals: parseFloat((finalScore - Math.round(rawScore)).toFixed(1))
  };
  
  result.previousAdvancedScorePct = result.advancedScorePct;
  result.classification = classify(result.scorePct);
  
  try { __caiarLog('NEW_EQUAL_WEIGHT_SCORING', 'Score calculado com pesos iguais', { 
    totalMetrics, 
    equalWeight: equalWeight.toFixed(2), 
    finalScore, 
    green, yellow, red,
    improvement: `${Math.round(rawScore)}% → ${finalScore}%`
  }); } catch {}
  
  } catch (eColor) {
    result._colorRatioError = eColor?.message || String(eColor);
    result.scorePct = result.advancedScorePct;
    result.method = 'advanced_fallback';
    result.scoringMethod = 'advanced_fallback';
    result.fallback_used = 'advanced';
    result.classification = classify(result.scorePct);
    try { __caiarLog('SCORING_COLOR_ERROR','Falha new equal weight -> fallback advanced', { error: eColor?.message, fallback_used: 'advanced' }); } catch {}
  }
  } else {
    // 🎯 NOVO SISTEMA EQUAL_WEIGHT_V3 ATIVADO!
    console.log('[EQUAL_WEIGHT_V3] Color ratio v2 desabilitado - usando novo sistema de pesos iguais');
    
    try {
      // 🔧 CORREÇÃO: Preparar dados corretamente com validação robusta
      console.log('[EQUAL_WEIGHT_V3] 📊 technicalData keys:', Object.keys(technicalData || {}));
      console.log('[EQUAL_WEIGHT_V3] 📋 reference:', reference);
      
      // Garantir que technicalData não é null/undefined
      const safeMetrics = technicalData || {};
      const safeReference = reference || {};
      
      const analysisData = {
        metrics: safeMetrics,
        reference: safeReference,
        runId: safeMetrics.runId || 'scoring-' + Date.now()
      };
      
      console.log('[EQUAL_WEIGHT_V3] 🎯 Chamando _computeEqualWeightV3 com:', analysisData);
      
      const equalWeightResult = _computeEqualWeightV3(analysisData);
      
      console.log('[EQUAL_WEIGHT_V3] 📊 Resultado bruto:', equalWeightResult);
      
      // Verificar se o resultado é válido com logs detalhados
      if (equalWeightResult) {
        console.log('[EQUAL_WEIGHT_V3] ✅ Resultado existe');
        console.log('[EQUAL_WEIGHT_V3] 📊 Score:', equalWeightResult.score);
        console.log('[EQUAL_WEIGHT_V3] 📊 Score é finite?', Number.isFinite(equalWeightResult.score));
        
        if (Number.isFinite(equalWeightResult.score)) {
          result.scorePct = parseFloat(equalWeightResult.score.toFixed(1)); // Preservar decimal
          result.method = 'equal_weight_v3';
          result.scoringMethod = 'equal_weight_v3';
          result.classification = equalWeightResult.classification;
          result.equalWeightDetails = equalWeightResult.details;
          
          console.log('[EQUAL_WEIGHT_V3] ✅ Score calculado:', result.scorePct + '%', 'Classificação:', result.classification);
        } else {
          console.error('[EQUAL_WEIGHT_V3] ❌ Score não é finite:', equalWeightResult.score);
          throw new Error('Score não é finite: ' + equalWeightResult.score);
        }
      } else {
        console.error('[EQUAL_WEIGHT_V3] ❌ Resultado é null/undefined:', equalWeightResult);
        throw new Error('equalWeightResult é null/undefined');
      }
      
    } catch (error) {
      console.error('[EQUAL_WEIGHT_V3] ❌ Erro no novo sistema, fallback para advanced:', error);
      console.error('[EQUAL_WEIGHT_V3] ❌ Stack trace:', error.stack);
      result.scorePct = result.advancedScorePct;
      result.method = 'advanced_fallback';
      result.scoringMethod = 'advanced_fallback';
      result.classification = classify(result.scorePct);
      result._equalWeightError = error.message;
    }
  }
  try { __caiarLog('SCORING_PENALTY_AGG','Aggregated penalties', { P_sum: result.penaltiesSummary.P_sum, P_crit: result.penaltiesSummary.P_crit, P_final: result.penaltiesSummary.P_final, advancedScore: result.advancedScorePct }); } catch {}
  __caiarLog('SCORING_DONE','Mix score calculado', { scorePct: result.scorePct, class: result.classification, mode: result.scoreMode, metrics: result.perMetric.length });
  if (!AUDIT_MODE && !force._autoPromoted) {
    result._note = 'Modo legado: AUDIT_MODE desativado e nenhuma métrica avançada para promover.';
  } else if (!AUDIT_MODE && force._autoPromoted) {
    result._note = 'Auto-promovido para V2 (AUTO_SCORING_V2) por métricas avançadas presentes.';
  } else if (AUDIT_MODE && result.scoreMode==='legacy') {
    result._note = 'AUDIT_MODE ativo mas SCORING_V2 desativado explicitamente.';
  }
  // Expor para inspeção externa sem depender de logs prévios
  try {
    if (typeof window !== 'undefined') {
      window.__LAST_MIX_SCORE = result;
      
      // 🎯 2025-01: SISTEMA HÍBRIDO - Baseline persistente com localStorage
      const generateTrackId = (metrics) => {
        // Gerar ID único baseado em características do áudio
        const bandValues = Object.values(metrics.bandEnergies || {})
          .map(b => b?.rms_db?.toFixed(1) || '0')
          .join(',');
        const lufs = metrics.lufsIntegrated?.toFixed(1) || '0';
        const raw = `${bandValues}_${lufs}_${Date.now()}`;
        
        // Hash simples para ID compacto
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
          const char = raw.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
      };
      
      // Carregar baseline existente do localStorage
      if (!window.__BASELINE_BAND_ENERGIES && metrics.bandEnergies) {
        const trackId = generateTrackId(metrics);
        const storageKey = `bandBaseline:${trackId}`;
        
        try {
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            window.__BASELINE_BAND_ENERGIES = JSON.parse(stored);
            console.log('🎯 BASELINE carregado do localStorage:', trackId);
          }
        } catch (e) {
          console.warn('⚠️ Erro ao carregar baseline do localStorage:', e);
        }
        
        // Se ainda não existe, criar nova baseline
        if (!window.__BASELINE_BAND_ENERGIES) {
          window.__BASELINE_BAND_ENERGIES = {
            timestamp: Date.now(),
            trackId: trackId,
            data: {}
          };
          
          // Capturar valores iniciais das bandas espectrais
          for (const [band, bandData] of Object.entries(metrics.bandEnergies)) {
            if (Number.isFinite(bandData?.rms_db)) {
              window.__BASELINE_BAND_ENERGIES.data[band] = {
                rms_db: bandData.rms_db,
                target_db: ref?.bands?.[band]?.target_db
              };
            }
          }
          
          // Salvar no localStorage
          try {
            localStorage.setItem(storageKey, JSON.stringify(window.__BASELINE_BAND_ENERGIES));
            console.log('🎯 BASELINE salvo no localStorage:', trackId, Object.keys(window.__BASELINE_BAND_ENERGIES.data));
          } catch (e) {
            console.warn('⚠️ Erro ao salvar baseline no localStorage:', e);
          }
        }
      }
      
      if (window.DEBUG_SCORE === true) {
        // Log compacto + detalhado em grupo
        console.log('[MIX_SCORE]', result.scorePct + '%', 'mode=' + result.scoreMode, 'class=' + result.classification);
        if (window.DEBUG_SCORE_VERBOSE) console.log('[MIX_SCORE_FULL]', result);
      }
    }
  } catch {}
  return result;
}

function computeMixScore(technicalData = {}, reference = null) {
  console.log('[SCORING_ENTRY] 🎯 computeMixScore chamado com:', {
    metricas: Object.keys(technicalData || {}),
    hasReference: !!reference,
    timestamp: Date.now(),
    technicalDataSample: technicalData
  });
  
  // 🚨 DIAGNÓSTICO CRÍTICO - Verificar se dados são válidos
  if (!technicalData || typeof technicalData !== 'object') {
    console.error('[SCORING_ENTRY] ❌ technicalData inválido:', technicalData);
    return {
      scorePct: 50,
      classification: 'Básico',
      method: 'emergency_fallback',
      error: 'invalid_technical_data'
    };
  }
  
  const AUDIT_MODE = (typeof process !== 'undefined' && process.env.AUDIT_MODE === '1') || (typeof window !== 'undefined' && window.AUDIT_MODE === true);
  const win = (typeof window !== 'undefined') ? window : {};
  const explicitV2 = ((typeof process !== 'undefined' && process.env.SCORING_V2 === '1') || win.SCORING_V2 === true);
  const explicitLegacy = ((typeof process !== 'undefined' && process.env.SCORING_V2 === '0') || win.SCORING_V2 === false);
  const AUTO_V2 = win.AUTO_SCORING_V2 !== false; // default true
  const overrideAuditBypass = win.FORCE_SCORING_V2 === true; // permite V2 mesmo sem AUDIT_MODE
  const SCORING_V2 = (!explicitLegacy) && (explicitV2 || (AUDIT_MODE && win.SCORING_V2 !== false) || overrideAuditBypass);
  
  console.log('[SCORING_ENTRY] 🔧 Flags calculadas:', {
    AUDIT_MODE,
    SCORING_V2,
    AUTO_V2,
    overrideAuditBypass,
    explicitV2,
    explicitLegacy
  });
  
  // 🚨 GARANTIA: Sempre tenta _computeMixScoreInternal
  let result;
  try {
    result = _computeMixScoreInternal(technicalData, reference, { AUDIT_MODE, SCORING_V2, AUTO_V2, overrideAuditBypass });
    console.log('[SCORING_ENTRY] ✅ _computeMixScoreInternal sucesso:', result);
  } catch (error) {
    console.error('[SCORING_ENTRY] ❌ Erro em _computeMixScoreInternal:', error);
    result = {
      scorePct: 50,
      classification: 'Básico',
      method: 'emergency_fallback',
      error: error.message
    };
  }
  
  // 🚨 VALIDAÇÃO FINAL ABSOLUTA
  if (!result) {
    console.error('[SCORING_ENTRY] ❌ Result é null/undefined!');
    result = {
      scorePct: 50,
      classification: 'Básico',
      method: 'null_result_fallback'
    };
  }
  
  if (!Number.isFinite(result.scorePct)) {
    console.error('[SCORING_ENTRY] ❌ scorePct inválido:', result.scorePct);
    result.scorePct = 50;
    result.classification = 'Básico';
    result.method = 'invalid_score_fallback';
  }
  
  console.log('[SCORING_ENTRY] 📊 Resultado final garantido:', {
    score: result.scorePct,
    method: result.method,
    classification: result.classification
  });
  
  return result;
}

// Diagnóstico: compara resultado legacy vs v2 independente das flags atuais
function computeMixScoreBoth(technicalData = {}, reference = null) {
  const legacy = _computeMixScoreInternal(technicalData, reference, { AUDIT_MODE:true, SCORING_V2:false, AUTO_V2:false });
  const v2 = _computeMixScoreInternal(technicalData, reference, { AUDIT_MODE:true, SCORING_V2:true, AUTO_V2:false });
  return {
    legacy,
    v2,
    deltaPct: parseFloat((v2.scorePct - legacy.scorePct).toFixed(2)),
    changedMetricsCount: (v2.perMetric||[]).length - (legacy.perMetric||[]).length
  };
}

try {
  if (typeof window !== 'undefined') {
    window.__compareMixScore = (td, ref) => computeMixScoreBoth(td || (window.__LAST_FULL_ANALYSIS?.technicalData)||{}, ref || (typeof window !== 'undefined'? window.PROD_AI_REF_DATA : null));
    
    // 🎯 2025-01: UTILITÁRIOS SISTEMA HÍBRIDO
    window.enableHybridDebug = () => {
      window.DEBUG_HYBRID_SCORE = true;
      console.log('🎯 Debug híbrido Pista A + Pista B ativado');
    };
    
    window.disableHybridDebug = () => {
      window.DEBUG_HYBRID_SCORE = false;
      console.log('🎯 Debug híbrido Pista A + Pista B desativado');
    };
    
    window.resetBaseline = () => {
      // Limpar memória
      delete window.__BASELINE_BAND_ENERGIES;
      
      // Limpar localStorage (todas as chaves de baseline)
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('bandBaseline:')) {
            localStorage.removeItem(key);
          }
        });
        console.log('🎯 Baseline resetado (memória + localStorage) - próxima análise será nova baseline');
      } catch (e) {
        console.warn('⚠️ Erro ao limpar localStorage:', e);
        console.log('🎯 Baseline resetado (apenas memória) - próxima análise será nova baseline');
      }
    };
    
    window.showBaseline = () => {
      if (window.__BASELINE_BAND_ENERGIES) {
        console.log('🎯 Baseline atual:', window.__BASELINE_BAND_ENERGIES);
        
        // Mostrar também o que está no localStorage
        try {
          const keys = Object.keys(localStorage).filter(k => k.startsWith('bandBaseline:'));
          if (keys.length > 0) {
            console.log('🎯 Baselines no localStorage:', keys.length);
            keys.forEach(key => {
              const data = JSON.parse(localStorage.getItem(key));
              console.log(`  - ${key}: ${Object.keys(data.data || {}).length} bandas`);
            });
          }
        } catch (e) {
          console.warn('⚠️ Erro ao ler localStorage:', e);
        }
      } else {
        console.log('🎯 Nenhuma baseline armazenada ainda');
      }
    };
    
    // Helper rápido de debug
    if (typeof window.debugMix !== 'function') {
      window.debugMix = () => ({ lastScore: window.__LAST_MIX_SCORE, lastAnalysis: window.__LAST_FULL_ANALYSIS });
    }
    
    // FUNÇÃO DE DIAGNÓSTICO COMPLETO
    window.__DIAGNOSE_SCORE_ISSUE = function() {
      console.log('🔍 DIAGNÓSTICO COMPLETO DO SCORE...');
      
      // Testar função interna diretamente
      const testData = {
        lufsIntegrated: -14,
        truePeakDbtp: -1.0,
        dynamicRange: 10,
        lra: 7,
        stereoCorrelation: 0.3,
        bandEnergies: {
          green1: { rms_db: -7.0 }, // verde (target -7±1)
          green2: { rms_db: -7.0 }, // verde
          green3: { rms_db: -7.0 }, // verde  
          green4: { rms_db: -7.0 }, // verde
          green5: { rms_db: -7.0 }, // verde (5 verdes)
          yellow1: { rms_db: -8.5 }, // amarelo (fora por 1.5, n=1.5)
          yellow2: { rms_db: -8.5 }, // amarelo
          yellow3: { rms_db: -8.5 }, // amarelo
          yellow4: { rms_db: -8.5 }, // amarelo (4 amarelos)
          red1: { rms_db: -9.5 }, // vermelho (fora por 2.5, n=2.5)
          red2: { rms_db: -9.5 }, // vermelho
          red3: { rms_db: -9.5 }  // vermelho (3 vermelhos)
        }
      };
      
      const testRef = {
        lufs_target: -14, tol_lufs: 1,
        true_peak_target: -1, tol_true_peak: 1,
        dr_target: 10, tol_dr: 3,
        lra_target: 7, tol_lra: 3,
        stereo_target: 0.3, tol_stereo: 0.5,
        bands: {
          green1: { target_db: -7.0, tol_db: 1.0 },
          green2: { target_db: -7.0, tol_db: 1.0 },
          green3: { target_db: -7.0, tol_db: 1.0 },
          green4: { target_db: -7.0, tol_db: 1.0 },
          green5: { target_db: -7.0, tol_db: 1.0 },
          yellow1: { target_db: -7.0, tol_db: 1.0 },
          yellow2: { target_db: -7.0, tol_db: 1.0 },
          yellow3: { target_db: -7.0, tol_db: 1.0 },
          yellow4: { target_db: -7.0, tol_db: 1.0 },
          red1: { target_db: -7.0, tol_db: 1.0 },
          red2: { target_db: -7.0, tol_db: 1.0 },
          red3: { target_db: -7.0, tol_db: 1.0 }
        }
      };
      
      console.log('📊 Testando internamente _computeMixScoreInternal...');
      const result = _computeMixScoreInternal(testData, testRef, { AUDIT_MODE: true, SCORING_V2: true });
      
      console.log('📈 RESULTADO DO TESTE:');
      console.log('  Score:', result.scorePct + '%');
      console.log('  Método:', result.method);
      console.log('  Color counts:', result.colorCounts);
      console.log('  Weights:', result.weights);
      console.log('  Yellow keys:', result.yellowKeys);
      console.log('  Denominador info:', result.denominator_info);
      
      // Validar se está usando color_ratio_v2
      if (result.method !== 'color_ratio_v2') {
        console.error('❌ PROBLEMA: Não está usando color_ratio_v2!');
        console.log('Fallback info:', result.fallback_used, result._colorRatioError);
      }
      
      // Validar contagem
      const expectedScore = Math.round(100 * (5*1.0 + 4*0.5 + 3*0.0) / 12); // = 58
      console.log('✅ Score esperado:', expectedScore + '%');
      console.log('✅ Score obtido:', result.scorePct + '%');
      console.log('✅ Match:', result.scorePct === expectedScore ? '✓' : '✗');
      
      // Diagnóstico das métricas
      console.log('� BREAKDOWN POR MÉTRICA:');
      result.perMetric.forEach(m => {
        const color = m.status === 'OK' ? '🟢' : (m.severity === 'leve' ? '🟡' : '🔴');
        console.log(`  ${color} ${m.key}: ${m.value} vs ${m.target}±${m.tol} → status:${m.status}, severity:${m.severity}, n:${m.n}`);
      });
      
      return result;
    };
    
    // FUNÇÃO SIMPLES PARA VER ÚLTIMO SCORE
    window.__PRINT_LAST_MIX_SCORE = function() {
      const score = window.__LAST_MIX_SCORE;
      if (!score) {
        console.log('❌ Nenhum __LAST_MIX_SCORE disponível');
        return;
      }
      
      console.log('🎯 ÚLTIMO MIX SCORE:');
      console.log('  Método:', score.method || score.scoringMethod);
      console.log('  Score:', score.scorePct + '%');
      console.log('  Cores:', score.colorCounts);
      console.log('  Amarelos:', score.yellowKeys);
      console.log('  Pesos:', score.weights);
      
      return score;
    };
    
    // TESTES OBRIGATÓRIOS PARA VALIDAÇÃO COLOR_RATIO_V2
    window.__TEST_COLOR_RATIO_V2 = function() {
      console.log('🧪 TESTES OBRIGATÓRIOS COLOR_RATIO_V2...');
      
      // Função helper para criar mock de perMetric
      const createMockData = (greenCount, yellowCount, redCount) => {
        const mockData = { lufsIntegrated: -14, truePeakDbtp: -1.0, dynamicRange: 10, lra: 7, stereoCorrelation: 0.3 };
        const mockRef = { lufs_target: -14, tol_lufs: 1, true_peak_target: -1, tol_true_peak: 1, dr_target: 10, tol_dr: 3, lra_target: 7, tol_lra: 3, stereo_target: 0.3, tol_stereo: 0.5 };
        
        // Simular bandas com diferentes severidades
        const bands = {};
        let bandIndex = 0;
        
        // Verdes (dentro da tolerância)
        for (let i = 0; i < greenCount; i++) {
          const bandName = `test_green_${i}`;
          mockData.bandEnergies = mockData.bandEnergies || {};
          mockData.bandEnergies[bandName] = { rms_db: -7.0 }; // exato no target
          bands[bandName] = { target_db: -7.0, tol_db: 1.0 };
          bandIndex++;
        }
        
        // Amarelos (severity leve: 1 < n <= 2)
        for (let i = 0; i < yellowCount; i++) {
          const bandName = `test_yellow_${i}`;
          mockData.bandEnergies = mockData.bandEnergies || {};
          mockData.bandEnergies[bandName] = { rms_db: -8.5 }; // fora por 1.5, n = 1.5 (leve)
          bands[bandName] = { target_db: -7.0, tol_db: 1.0 };
          bandIndex++;
        }
        
        // Vermelhos (severity média/alta: n > 2)
        for (let i = 0; i < redCount; i++) {
          const bandName = `test_red_${i}`;
          mockData.bandEnergies = mockData.bandEnergies || {};
          mockData.bandEnergies[bandName] = { rms_db: -9.5 }; // fora por 2.5, n = 2.5 (média)
          bands[bandName] = { target_db: -7.0, tol_db: 1.0 };
          bandIndex++;
        }
        
        mockRef.bands = bands;
        return { mockData, mockRef };
      };
      
      // Caso A: G=7, Y=0, R=7, T=14 → mixScorePct = 50
      const { mockData: dataA, mockRef: refA } = createMockData(7, 0, 7);
      const resultA = _computeMixScoreInternal(dataA, refA, { AUDIT_MODE: true, SCORING_V2: true });
      const expectedA = Math.round(100 * (7 * 1.0 + 0 * 0.5 + 7 * 0.0) / 14); // = 50
      console.log(`✅ Caso A: G=7, Y=0, R=7, T=14 → Expected: ${expectedA}, Got: ${resultA.scorePct}`, resultA.colorCounts);
      
      // Caso B: G=5, Y=0, R=9, T=14 → mixScorePct = 36
      const { mockData: dataB, mockRef: refB } = createMockData(5, 0, 9);
      const resultB = _computeMixScoreInternal(dataB, refB, { AUDIT_MODE: true, SCORING_V2: true });
      const expectedB = Math.round(100 * (5 * 1.0 + 0 * 0.5 + 9 * 0.0) / 14); // = 36
      console.log(`✅ Caso B: G=5, Y=0, R=9, T=14 → Expected: ${expectedB}, Got: ${resultB.scorePct}`, resultB.colorCounts);
      
      // Caso C: G=5, Y=4, R=3, T=12 → mixScorePct = round(100*((5 + 0.5*4)/12)) = 58
      const { mockData: dataC, mockRef: refC } = createMockData(5, 4, 3);
      const resultC = _computeMixScoreInternal(dataC, refC, { AUDIT_MODE: true, SCORING_V2: true });
      const expectedC = Math.round(100 * (5 * 1.0 + 4 * 0.5 + 3 * 0.0) / 12); // = 58
      console.log(`✅ Caso C: G=5, Y=4, R=3, T=12 → Expected: ${expectedC}, Got: ${resultC.scorePct}`, resultC.colorCounts);
      
      // Validações
      const tests = [
        { name: 'Caso A', result: resultA, expected: expectedA, counts: { green: 7, yellow: 0, red: 7, total: 14 } },
        { name: 'Caso B', result: resultB, expected: expectedB, counts: { green: 5, yellow: 0, red: 9, total: 14 } },
        { name: 'Caso C', result: resultC, expected: expectedC, counts: { green: 5, yellow: 4, red: 3, total: 12 } }
      ];
      
      let allPassed = true;
      tests.forEach(test => {
        const scoreMatch = test.result.scorePct === test.expected;
        const countsMatch = JSON.stringify(test.result.colorCounts) === JSON.stringify(test.counts);
        const denominatorMatch = test.result.colorCounts.total === test.result.denominator_info.length;
        const methodMatch = test.result.method === 'color_ratio_v2';
        
        if (!scoreMatch || !countsMatch || !denominatorMatch || !methodMatch) {
          console.error(`❌ ${test.name} FALHOU:`, {
            scoreMatch, countsMatch, denominatorMatch, methodMatch,
            expected: test.expected, got: test.result.scorePct,
            expectedCounts: test.counts, gotCounts: test.result.colorCounts
          });
          allPassed = false;
        } else {
          console.log(`✅ ${test.name} PASSOU`);
        }
      });
      
      if (allPassed) {
        console.log('🎉 TODOS OS TESTES PASSARAM! Color ratio v2 funcionando corretamente.');
      } else {
        console.error('❌ Alguns testes falharam. Verificar implementação.');
      }
      
      return { resultA, resultB, resultC, allPassed };
    };
  }
} catch {}

if (typeof window !== 'undefined') { 
  window.__MIX_SCORING_VERSION__ = '2.0.0-equal-weight-v3-FORCED'; 
  console.log('🎯 NOVO SISTEMA CARREGADO - Versão:', window.__MIX_SCORING_VERSION__);
}

// Export das funções principais
export { computeMixScore, computeMixScoreBoth };
