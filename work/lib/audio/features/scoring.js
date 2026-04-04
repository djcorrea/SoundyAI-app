// 🧮 MIX SCORING ENGINE
// Calcula porcentagem de conformidade e classificação qualitativa baseada nas métricas técnicas e referências por gênero
// 
// SISTEMA DE SCORING HÍBRIDO (Range-based + Fixed-target):
// ═══════════════════════════════════════════════════════════════════
// 
// 1. RANGE-BASED SCORING (NOVO - Implementado para bandas espectrais):
//    - Usa objetos target_range: {"min": -34, "max": -22}
//    - Score MÁXIMO (1.0) para qualquer valor dentro do intervalo [min, max]
//    - Penalização PROPORCIONAL fora do intervalo baseada na distância
//    - Ideal para perfis "batida forte sem distorcer" onde há faixa aceitável
//    - Aplicado via scoreToleranceRange(value, min, max)
//
// 2. FIXED-TARGET SCORING (LEGADO - Mantido para compatibilidade):
//    - Usa valores target_db: -26.5 (número fixo)
//    - Score baseado na distância até o alvo específico
//    - Mantido para gêneros que não especificam ranges
//    - Aplicado via scoreTolerance(value, target, tolerance)
//
// 3. RETROCOMPATIBILIDADE:
//    - addMetric() detecta automaticamente se tem target_range ou target_db
//    - Prioriza target_range quando disponível
//    - Fallback para target_db se range não existir
//    - Gêneros antigos continuam funcionando sem modificação
//
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

// 🎯 NORMALIZAÇÃO DE CHAVES DE BANDA - Resolve mismatch PT↔EN
// spectralBands usa: sub, bass, lowMid, mid, highMid, presence, air (EN)
// targets de gênero podem usar: presenca, brilho, low_mid, high_mid (PT/snake_case)
const BAND_ALIASES = {
  // Português → Inglês (canônico)
  'presenca': 'presence',
  'brilho': 'air',
  // Snake_case → camelCase
  'low_mid': 'lowMid',
  'high_mid': 'highMid',
  'low_bass': 'bass',      // fallback se não existir low_bass
  'upper_bass': 'lowMid',  // fallback se não existir upper_bass
  // Inverso Inglês → Português (para lookup em targets PT)
  'presence': 'presenca',
  'air': 'brilho',
  'lowMid': 'low_mid',
  'highMid': 'high_mid'
};

/**
 * 🔧 Normaliza chave de banda para o formato canônico (Inglês/camelCase)
 * @param {string} key - Chave original (pode ser PT ou EN)
 * @returns {string} - Chave normalizada
 */
function normalizeBandKey(key) {
  if (!key) return key;
  const lower = key.toLowerCase();
  // Mapeamento direto se existir
  if (BAND_ALIASES[lower]) return BAND_ALIASES[lower];
  if (BAND_ALIASES[key]) return BAND_ALIASES[key];
  return key; // Retorna original se não houver alias
}

/**
 * 🔧 Busca banda em objeto usando aliases
 * @param {object} obj - Objeto com bandas (bandEnergies ou ref.bands)
 * @param {string} bandKey - Chave da banda a buscar
 * @returns {object|null} - Dados da banda ou null
 */
function getBandWithAlias(obj, bandKey) {
  if (!obj || typeof obj !== 'object') return null;
  
  // Tentar chave original
  if (obj[bandKey]) return obj[bandKey];
  
  // Tentar alias normalizado
  const normalized = normalizeBandKey(bandKey);
  if (obj[normalized]) return obj[normalized];
  
  // Tentar inverso (se veio em EN, buscar PT ou vice-versa)
  const inverse = BAND_ALIASES[normalized] || BAND_ALIASES[bandKey];
  if (inverse && obj[inverse]) return obj[inverse];
  
  return null;
}

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

// Novo: suporte a tolerância assimétrica (tolMin / tolMax). Mantém compatibilidade quando apenas tol fornecido.
function scoreTolerance(metricValue, target, tol, invert = false, tolMin = null, tolMax = null) {
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
  if (adiff <= sideTol) return 1;
  if (adiff >= 2 * sideTol) return 0;
  return 1 - (adiff - sideTol) / sideTol;
}

/**
 * 🎯 FUNÇÃO DE SCORING HÍBRIDA (Range-based + Fixed-target)
 * ═══════════════════════════════════════════════════════════
 * 
 * NOVO SISTEMA: Score baseado em intervalos (ranges) para bandas espectrais
 * Substitui target fixo por range {min, max} onde qualquer valor dentro = score máximo
 * 
 * @param {number} metricValue - Valor medido da métrica (ex: -26.5 dB)
 * @param {object|number} targetRange - Range {min, max} OU valor fixo para compatibilidade
 * @param {number} fallbackTarget - Target fixo se range não disponível
 * @param {number} tol - Tolerância personalizada (opcional)
 * @returns {number|null} Score de 0.1 a 1.0, ou null se valor inválido
 * 
 * COMPORTAMENTO:
 * 1. Se targetRange = {min: -34, max: -22} → usa sistema de ranges
 * 2. Se targetRange = número → fallback para sistema antigo  
 * 3. DENTRO DO RANGE [min, max] = Score 1.0 (verde)
 * 4. FORA DO RANGE = Penalização suave baseada na distância
 * 
 * EXEMPLOS:
 * - scoreToleranceRange(-26, {min:-34, max:-22}) = 1.0 (dentro do range)
 * - scoreToleranceRange(-20, {min:-34, max:-22}) = 0.7 (fora, penalizado)
 * - scoreToleranceRange(-26.5, -26.5, null, 3.0) = 1.0 (target fixo antigo)
 */
function scoreToleranceRange(metricValue, targetRange, fallbackTarget = null, tol = null) {
  if (!Number.isFinite(metricValue)) return null;
  
  // 🔧 SUPORTE A RANGE: Se target_range definido, usar sistema de intervalo
  if (targetRange && typeof targetRange === 'object' && 
      Number.isFinite(targetRange.min) && Number.isFinite(targetRange.max)) {
    
    const { min, max } = targetRange;
    
    // ✅ DENTRO DO RANGE: Score máximo (verde)
    if (metricValue >= min && metricValue <= max) {
      return 1.0; // Score perfeito
    }
    
    // ❌ FORA DO RANGE: Penalização proporcional baseada na distância
    let distance;
    if (metricValue < min) {
      distance = min - metricValue; // Distância abaixo do mínimo
    } else {
      distance = metricValue - max; // Distância acima do máximo
    }
    
    // 📉 CURVA DE PENALIZAÇÃO SUAVE
    // Tolerância padrão = 1/4 da largura do range, ou usar tol fornecida
    const rangeWidth = max - min;
    const defaultTolerance = rangeWidth * 0.25;
    const tolerance = Number.isFinite(tol) && tol > 0 ? tol : defaultTolerance;
    
    if (distance <= tolerance) {
      // Dentro da tolerância: score 0.5-1.0 (amarelo/verde)
      return 1.0 - (distance / tolerance) * 0.5;
    } else if (distance <= tolerance * 2) {
      // Fora da tolerância mas não crítico: score 0.2-0.5 (amarelo/vermelho)
      return 0.5 - (distance - tolerance) / tolerance * 0.3;
    } else {
      // Muito fora: score mínimo 0.1-0.2 (vermelho)
      return Math.max(0.1, 0.2 - (distance - tolerance * 2) / (tolerance * 3) * 0.1);
    }
  }
  
  // 🔄 FALLBACK: Se não tem range, usar sistema antigo com target fixo
  if (Number.isFinite(fallbackTarget)) {
    return scoreTolerance(metricValue, fallbackTarget, tol || 1);
  }
  
  // 🚫 SEM DADOS VÁLIDOS
  return null;
}
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

// 🎯 CLASSIFICAÇÃO REBALANCEADA PARA NOVO SISTEMA DE SCORING
// Ajustada para ser mais otimista e realística com tolerâncias ampliadas
function classify(scorePct) {
  if (scorePct >= 85) return 'Referência Mundial';    // ↓ Era 90 - Mais acessível
  if (scorePct >= 70) return 'Avançado';              // ↓ Era 75 - Mais acessível  
  if (scorePct >= 55) return 'Intermediário';         // ↓ Era 60 - Mais acessível
  return 'Básico';
}

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
  truePeakDbtp: { target: -1, tol: 0.1, invert: true }   // AutoMaster V1: ceiling de -1.0 dBTP, qualquer valor > -0.9 gera penalty
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
    
    // 🎯 NOVA LÓGICA: Suporte a target_range nas opções
    // Se opts.target_range existe, usar sistema de intervalos em vez de target fixo
    let s;
    if (opts.target_range && typeof opts.target_range === 'object') {
      // Sistema de intervalos: qualquer valor dentro do range = score máximo
      s = scoreToleranceRange(value, opts.target_range, target, tol);
      console.log(`[SCORING_RANGE] ${key}: valor=${value}, range=[${opts.target_range.min}, ${opts.target_range.max}], score=${s?.toFixed(3)}`);
    } else {
      // Sistema antigo: target fixo + tolerância
      const tolMin = Number.isFinite(opts.tolMin) && opts.tolMin > 0 ? opts.tolMin : null;
      const tolMax = Number.isFinite(opts.tolMax) && opts.tolMax > 0 ? opts.tolMax : null;
      s = scoreTolerance(value, target, tol, !!opts.invert, tolMin, tolMax);
    }
    
    if (s == null) return;
    
    // Determinar status (OK / BAIXO / ALTO) e severidade
    let status = 'OK';
    let severity = null;
    let n = 0; // ratio de desvio
    
    if (opts.target_range) {
      // 🎯 LÓGICA DE STATUS PARA RANGES
      const { min, max } = opts.target_range;
      if (value >= min && value <= max) {
        status = 'OK';
        n = 0;
      } else {
        const rangeWidth = max - min;
        const tolerance = Number.isFinite(tol) ? tol : rangeWidth * 0.25;
        
        if (value < min) {
          status = 'BAIXO';
          n = (min - value) / tolerance;
        } else {
          status = 'ALTO';
          n = (value - max) / tolerance;
        }
        
        // Classificar severidade baseada na distância do range
        if (n <= 1) severity = 'leve';
        else if (n <= 2) severity = 'media';
        else severity = 'alta';
      }
    } else {
      // 🔄 LÓGICA ANTIGA PARA TARGET FIXO
      const diff = value - target;
      const effTolMin = opts.tolMin || tol; 
      const effTolMax = opts.tolMax || tol;
      
      if (!opts.invert) {
        if (diff < -effTolMin) status = 'BAIXO'; 
        else if (diff > effTolMax) status = 'ALTO';
      } else {
        if (diff > effTolMax) status = 'ALTO';
      }
      
      if (status !== 'OK') {
        const sideTol = diff > 0 ? effTolMax : effTolMin;
        n = Math.abs(diff) / sideTol;
        severity = n <= 1 ? 'leve' : (n <= 2 ? 'media' : 'alta');
      }
    }
    
    const effTolMin = opts.tolMin || tol; 
    const effTolMax = opts.tolMax || tol;
    const diff = parseFloat((value-target).toFixed(3));
    
    perMetric.push({ 
      category, 
      key, 
      value, 
      target, 
      tol, 
      tol_min: effTolMin, 
      tol_max: effTolMax, 
      score: clamp01(s), 
      status, 
      severity, 
      n: Number.isFinite(n) ? parseFloat(n.toFixed(3)) : null, 
      diff,
      // 🆕 ADICIONAR INFORMAÇÃO DE RANGE PARA DEBUG
      target_range: opts.target_range || null,
      scoring_method: opts.target_range ? 'range' : 'fixed_target'
    });
    
    try { __caiarLog && __caiarLog('SCORING_METRIC', 'Metric avaliada', { 
      key, 
      value, 
      target, 
      target_range: opts.target_range,
      tolMin: effTolMin, 
      tolMax: effTolMax, 
      status, 
      severity, 
      n,
      scoring_method: opts.target_range ? 'range' : 'fixed_target'
    }); } catch {}
  }
  const lufsTarget = ref?.lufs_target ?? DEFAULT_TARGETS.lufsIntegrated.target;
  const lufsTol = ref?.tol_lufs ?? DEFAULT_TARGETS.lufsIntegrated.tol;
  // Loudness com suporte a tol_lufs_min / tol_lufs_max
  const lufsTolMin = Number.isFinite(ref?.tol_lufs_min) ? ref.tol_lufs_min : lufsTol;
  const lufsTolMax = Number.isFinite(ref?.tol_lufs_max) ? ref.tol_lufs_max : lufsTol;
  
  // 🚨 LOG CRÍTICO: Ver o que está sendo usado no scoring de loudness
  console.error('\n╔═════════════════════════════════════════════════════════════╗');
  console.error('║  🎯 SCORING.JS: CALCULANDO LOUDNESS SUBSCORE               ║');
  console.error('╚═════════════════════════════════════════════════════════════╝');
  console.error('[SCORING] LUFS medido:', metrics.lufsIntegrated);
  console.error('[SCORING] LUFS TARGET usado:', lufsTarget);
  console.error('[SCORING] ref?.lufs_target:', ref?.lufs_target);
  console.error('[SCORING] DEFAULT usado?', !ref?.lufs_target);
  console.error('[SCORING] Tolerância:', { lufsTolMin, lufsTolMax, avg: (lufsTolMin + lufsTolMax)/2 });
  console.error('\n');
  
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
      // 🔧 CORREÇÃO: Usar getBandWithAlias para resolver mismatch PT↔EN
      // targets podem ter 'presenca'/'brilho' mas bandEnergies tem 'presence'/'air'
      const mBand = getBandWithAlias(metrics.bandEnergies, band);
      if (!mBand) {
        console.log(`[SCORING_BAND_ALIAS] ⚠️ Banda ${band} não encontrada em bandEnergies (tentou aliases)`);
        continue;
      }
      const val = Number.isFinite(mBand.rms_db) ? mBand.rms_db : null;
      if (val == null) continue;
      
      // 🔧 Normalizar nome da banda para penalties (usar formato canônico EN)
      const canonicalBand = normalizeBandKey(band);
      console.log(`[SCORING_BAND_ALIAS] ✅ Banda ${band} → ${canonicalBand}, valor=${val}`);
      
      // 🎯 NOVA LÓGICA: Suporte a target_range para bandas espectrais
      // Prioridade: target_range > target_db (fallback)
      if (refBand.target_range && typeof refBand.target_range === 'object' && 
          Number.isFinite(refBand.target_range.min) && Number.isFinite(refBand.target_range.max)) {
        
        // ✅ Sistema de intervalos: Score verde se dentro do range
        const target = (refBand.target_range.min + refBand.target_range.max) / 2; // Centro do range para compatibilidade
        const tol = Number.isFinite(refBand.tol_db) ? refBand.tol_db : Math.abs(refBand.target_range.max - refBand.target_range.min) * 0.25;
        
        addMetric('tonal', `band_${canonicalBand}`, val, target, tol, { 
          target_range: refBand.target_range,
          tolMin: null, 
          tolMax: null 
        });
        
        console.log(`[SCORING_BAND_RANGE] ${canonicalBand}: valor=${val}, range=[${refBand.target_range.min}, ${refBand.target_range.max}], target_fallback=${target}, tol=${tol}`);
        
      } else if (Number.isFinite(refBand?.target_db) && (Number.isFinite(refBand?.tol_db) || (Number.isFinite(refBand?.tol_min) && Number.isFinite(refBand?.tol_max))) && refBand.target_db != null) {
        
        // 🔄 Sistema antigo: target_db fixo + tolerâncias
        const tolMin = Number.isFinite(refBand.tol_min) ? refBand.tol_min : (Number.isFinite(refBand.tol_db) ? refBand.tol_db : null);
        const tolMax = Number.isFinite(refBand.tol_max) ? refBand.tol_max : (Number.isFinite(refBand.tol_db) ? refBand.tol_db : null);
        const tolAvg = ((tolMin||0)+(tolMax||0))/2 || refBand.tol_db || 1;
        
        addMetric('tonal', `band_${canonicalBand}`, val, refBand.target_db, tolAvg, { tolMin, tolMax });
        
        console.log(`[SCORING_BAND_FIXED] ${canonicalBand}: valor=${val}, target=${refBand.target_db}, tol=${tolAvg}`);
      }
    }
  } else if (metrics.tonalBalance) {
    ['sub','low','mid','high'].forEach(b => {
      const v = metrics.tonalBalance?.[b]?.rms_db;
      if (Number.isFinite(v)) addMetric('tonal', `band_${b}`, v, v, 6);
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
  // 🔧 CORREÇÃO: Usar nomes canônicos (EN) E aliases (PT) para garantir match
  const baseWeights = {
    lufsIntegrated: 0.18,
    truePeakDbtp: 0.14, // headroom substituído por truePeak
    // Bandas com nomes canônicos (EN) - agora normalizados pelo addMetric
    band_highMid: 0.14,
    band_high_mid: 0.14,  // alias snake_case
    band_air: 0.12,
    band_brilho: 0.12,    // alias PT
    band_presence: 0.12,
    band_presenca: 0.12,  // alias PT
    band_bass: 0.08,
    band_low_bass: 0.08,  // alias (pode mapear para bass)
    band_lowMid: 0.07,
    band_upper_bass: 0.07, // alias
    band_low_mid: 0.05,   // alias snake_case
    band_mid: 0.05,
    // Sub banda (se existir)
    band_sub: 0.03,
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
