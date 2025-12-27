/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🎯 RESOLVE TARGETS - FONTE ÚNICA DA VERDADE PARA TARGETS
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * OBJETIVO: Centralizar resolução de targets para eliminar divergências entre:
 *   1) Tabela de comparação
 *   2) Cards de Sugestões
 *   3) Score
 * 
 * REGRAS OBRIGATÓRIAS:
 *   - TRUE PEAK: max = 0.0 dBTP SEMPRE (hard cap físico)
 *   - Se TP > 0.0 => severidade = "CRÍTICA" em TODOS os lugares
 *   - Targets normalizados têm estrutura: { target, min, max, tolerance?, warnFrom? }
 * 
 * FORMATO DE SAÍDA:
 * {
 *   _resolved: true,
 *   _genre: string,
 *   _mode: string,
 *   truePeak: { target, min, max, warnFrom, hardCap },
 *   lufs: { target, min, max },
 *   dr: { target, min, max },
 *   lra: { target, min, max },
 *   stereo: { target, min, max },
 *   bands: { sub: { min, max, target }, bass: {...}, ... }
 * }
 * 
 * ════════════════════════════════════════════════════════════════════════════════
 */

// 🎯 CONSTANTE FÍSICA - True Peak NUNCA > 0 dBTP
export const TRUE_PEAK_HARD_CAP = 0.0;

// 🎯 DEFAULTS DE SEGURANÇA - Usados APENAS se não há target definido
// NÃO são fallbacks silenciosos - geram warning em log
const SAFE_DEFAULTS = {
  truePeak: { target: -1.0, min: -3.0, max: 0.0, warnFrom: -0.5, hardCap: TRUE_PEAK_HARD_CAP },
  lufs: { target: -14.0, min: -15.0, max: -13.0 },
  dr: { target: 8.0, min: 6.0, max: 12.0 },
  lra: { target: 7.0, min: 5.0, max: 10.0 },
  stereo: { target: 0.7, min: 0.3, max: 0.95 }
};

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🎯 resolveTargets - FUNÇÃO PRINCIPAL
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * Resolve targets de múltiplas fontes com prioridade:
 *   1. rawTargets fornecido diretamente
 *   2. JSON de gênero do filesystem (se genreId fornecido)
 *   3. ERRO se nenhum disponível (não usa defaults silenciosos)
 * 
 * @param {string|null} genreId - ID do gênero (ex: 'funk_mandela', 'progressive_trance')
 * @param {string} mode - Modo de destino ('pista', 'streaming', 'carro')
 * @param {Object|null} rawTargets - Targets já carregados (formato JSON ou normalizado)
 * @returns {Object} - Targets normalizados com estrutura única
 * @throws {Error} - Se não houver targets válidos
 */
export function resolveTargets(genreId, mode = 'pista', rawTargets = null) {
  console.log('[RESOLVE-TARGETS] 🔍 Iniciando resolução de targets:', { genreId, mode, hasRaw: !!rawTargets });
  
  // VALIDAÇÃO: Deve haver alguma fonte de targets
  if (!rawTargets && !genreId) {
    throw new Error('[RESOLVE-TARGETS] ❌ ERRO FATAL: Nenhuma fonte de targets (rawTargets ou genreId)');
  }
  
  let targets = null;
  
  // ════════════════════════════════════════════════════════════════════
  // 1️⃣ PRIORIDADE 1: rawTargets já fornecido
  // ════════════════════════════════════════════════════════════════════
  if (rawTargets && typeof rawTargets === 'object') {
    // Verificar se já está no formato resolvido
    if (rawTargets._resolved === true) {
      console.log('[RESOLVE-TARGETS] ✅ Targets já resolvidos, retornando direto');
      return rawTargets;
    }
    
    // Verificar se está no formato normalizado (de normalize-genre-targets.js)
    if (rawTargets._normalized === true || rawTargets.metrics) {
      console.log('[RESOLVE-TARGETS] ✅ Usando formato normalizado existente');
      targets = convertFromNormalized(rawTargets);
    }
    // Formato JSON raw (lufs_target, true_peak_target, etc)
    else if ('lufs_target' in rawTargets || 'true_peak_target' in rawTargets) {
      console.log('[RESOLVE-TARGETS] ✅ Convertendo formato JSON raw');
      targets = convertFromJsonRaw(rawTargets);
    }
    // Formato com objetos aninhados (lufs: { target }, truePeak: { target })
    else if (rawTargets.lufs?.target !== undefined || rawTargets.truePeak?.target !== undefined) {
      console.log('[RESOLVE-TARGETS] ✅ Convertendo formato aninhado');
      targets = convertFromNested(rawTargets);
    }
    else {
      console.warn('[RESOLVE-TARGETS] ⚠️ Formato de targets desconhecido:', Object.keys(rawTargets));
    }
  }
  
  // ════════════════════════════════════════════════════════════════════
  // 2️⃣ VALIDAÇÃO FINAL
  // ════════════════════════════════════════════════════════════════════
  if (!targets) {
    throw new Error(`[RESOLVE-TARGETS] ❌ ERRO FATAL: Não foi possível resolver targets para ${genreId || 'unknown'}`);
  }
  
  // ════════════════════════════════════════════════════════════════════
  // 3️⃣ APLICAR OVERRIDES POR MODO (streaming, carro, etc)
  // ════════════════════════════════════════════════════════════════════
  targets = applyModeOverrides(targets, mode);
  
  // ════════════════════════════════════════════════════════════════════
  // 4️⃣ GARANTIR HARD CAP TRUE PEAK = 0.0
  // ════════════════════════════════════════════════════════════════════
  if (targets.truePeak.max > TRUE_PEAK_HARD_CAP) {
    console.warn('[RESOLVE-TARGETS] ⚠️ Corrigindo truePeak.max de', targets.truePeak.max, 'para', TRUE_PEAK_HARD_CAP);
    targets.truePeak.max = TRUE_PEAK_HARD_CAP;
  }
  targets.truePeak.hardCap = TRUE_PEAK_HARD_CAP;
  
  // ════════════════════════════════════════════════════════════════════
  // 5️⃣ MARCAR COMO RESOLVIDO E RETORNAR
  // ════════════════════════════════════════════════════════════════════
  targets._resolved = true;
  targets._genre = genreId || 'unknown';
  targets._mode = mode;
  targets._resolvedAt = new Date().toISOString();
  
  console.log('[RESOLVE-TARGETS] ✅ Targets resolvidos:', {
    genre: targets._genre,
    mode: targets._mode,
    lufs: `[${targets.lufs.min.toFixed(1)}, ${targets.lufs.max.toFixed(1)}]`,
    truePeak: `[${targets.truePeak.min.toFixed(1)}, ${targets.truePeak.max.toFixed(1)}] hardCap=${targets.truePeak.hardCap}`,
    dr: `[${targets.dr.min.toFixed(1)}, ${targets.dr.max.toFixed(1)}]`,
    bandsCount: Object.keys(targets.bands || {}).length
  });
  
  return targets;
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔧 CONVERSORES DE FORMATO
 * ════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Converte formato normalizado (_normalized: true) para formato resolvido
 */
function convertFromNormalized(normalized) {
  const metrics = normalized.metrics || normalized;
  
  return {
    truePeak: {
      target: metrics.truePeak?.target ?? SAFE_DEFAULTS.truePeak.target,
      min: metrics.truePeak?.min ?? SAFE_DEFAULTS.truePeak.min,
      max: Math.min(metrics.truePeak?.max ?? TRUE_PEAK_HARD_CAP, TRUE_PEAK_HARD_CAP),
      warnFrom: metrics.truePeak?.warnFrom ?? SAFE_DEFAULTS.truePeak.warnFrom,
      hardCap: TRUE_PEAK_HARD_CAP
    },
    lufs: {
      target: metrics.lufs?.target ?? SAFE_DEFAULTS.lufs.target,
      min: metrics.lufs?.min ?? SAFE_DEFAULTS.lufs.min,
      max: metrics.lufs?.max ?? SAFE_DEFAULTS.lufs.max
    },
    dr: {
      target: metrics.dr?.target ?? SAFE_DEFAULTS.dr.target,
      min: metrics.dr?.min ?? SAFE_DEFAULTS.dr.min,
      max: metrics.dr?.max ?? SAFE_DEFAULTS.dr.max
    },
    lra: {
      target: metrics.lra?.target ?? SAFE_DEFAULTS.lra.target,
      min: metrics.lra?.min ?? SAFE_DEFAULTS.lra.min,
      max: metrics.lra?.max ?? SAFE_DEFAULTS.lra.max
    },
    stereo: {
      target: metrics.stereo?.target ?? SAFE_DEFAULTS.stereo.target,
      min: metrics.stereo?.min ?? SAFE_DEFAULTS.stereo.min,
      max: metrics.stereo?.max ?? SAFE_DEFAULTS.stereo.max
    },
    bands: convertBands(normalized.bands || {})
  };
}

/**
 * Converte formato JSON raw (lufs_target, true_peak_target, etc)
 */
function convertFromJsonRaw(raw) {
  const lufsTol = raw.tol_lufs ?? 1.0;
  const tpTol = raw.tol_true_peak ?? 0.5;
  const drTol = raw.tol_dr ?? 2.0;
  const lraTol = raw.tol_lra ?? 2.0;
  const stereoTol = raw.tol_stereo ?? 0.15;
  
  return {
    truePeak: {
      target: raw.true_peak_target ?? SAFE_DEFAULTS.truePeak.target,
      min: raw.true_peak_min ?? (raw.true_peak_target - tpTol),
      max: Math.min(raw.true_peak_max ?? TRUE_PEAK_HARD_CAP, TRUE_PEAK_HARD_CAP),
      warnFrom: raw.true_peak_warn_from ?? null,
      hardCap: TRUE_PEAK_HARD_CAP
    },
    lufs: {
      target: raw.lufs_target ?? SAFE_DEFAULTS.lufs.target,
      min: raw.lufs_min ?? (raw.lufs_target - lufsTol),
      max: raw.lufs_max ?? (raw.lufs_target + lufsTol)
    },
    dr: {
      target: raw.dr_target ?? SAFE_DEFAULTS.dr.target,
      min: raw.dr_min ?? (raw.dr_target - drTol),
      max: raw.dr_max ?? (raw.dr_target + drTol)
    },
    lra: {
      target: raw.lra_target ?? SAFE_DEFAULTS.lra.target,
      min: raw.lra_min ?? (raw.lra_target - lraTol),
      max: raw.lra_max ?? (raw.lra_target + lraTol)
    },
    stereo: {
      target: raw.stereo_target ?? SAFE_DEFAULTS.stereo.target,
      min: raw.stereo_min ?? (raw.stereo_target - stereoTol),
      max: raw.stereo_max ?? (raw.stereo_target + stereoTol)
    },
    bands: convertBandsFromRaw(raw.bands || {})
  };
}

/**
 * Converte formato aninhado (lufs: { target }, truePeak: { target })
 */
function convertFromNested(nested) {
  return {
    truePeak: {
      target: nested.truePeak?.target ?? SAFE_DEFAULTS.truePeak.target,
      min: nested.truePeak?.min ?? SAFE_DEFAULTS.truePeak.min,
      max: Math.min(nested.truePeak?.max ?? TRUE_PEAK_HARD_CAP, TRUE_PEAK_HARD_CAP),
      warnFrom: nested.truePeak?.warnFrom ?? nested.truePeak?.warn_from ?? SAFE_DEFAULTS.truePeak.warnFrom,
      hardCap: TRUE_PEAK_HARD_CAP
    },
    lufs: {
      target: nested.lufs?.target ?? SAFE_DEFAULTS.lufs.target,
      min: nested.lufs?.min ?? SAFE_DEFAULTS.lufs.min,
      max: nested.lufs?.max ?? SAFE_DEFAULTS.lufs.max
    },
    dr: {
      target: nested.dr?.target ?? SAFE_DEFAULTS.dr.target,
      min: nested.dr?.min ?? SAFE_DEFAULTS.dr.min,
      max: nested.dr?.max ?? SAFE_DEFAULTS.dr.max
    },
    lra: {
      target: nested.lra?.target ?? SAFE_DEFAULTS.lra.target,
      min: nested.lra?.min ?? SAFE_DEFAULTS.lra.min,
      max: nested.lra?.max ?? SAFE_DEFAULTS.lra.max
    },
    stereo: {
      target: nested.stereo?.target ?? SAFE_DEFAULTS.stereo.target,
      min: nested.stereo?.min ?? SAFE_DEFAULTS.stereo.min,
      max: nested.stereo?.max ?? SAFE_DEFAULTS.stereo.max
    },
    bands: convertBands(nested.bands || {})
  };
}

/**
 * Converte bandas do formato normalizado
 */
function convertBands(rawBands) {
  const bands = {};
  const CANONICAL_BANDS = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air'];
  
  for (const bandKey of CANONICAL_BANDS) {
    const band = rawBands[bandKey];
    if (!band) continue;
    
    bands[bandKey] = {
      target: band.target ?? band.target_db ?? -30,
      min: band.min ?? band.target_range?.min ?? (band.target - 3),
      max: band.max ?? band.target_range?.max ?? (band.target + 3)
    };
  }
  
  return bands;
}

/**
 * Converte bandas do formato JSON raw
 */
function convertBandsFromRaw(rawBands) {
  const bands = {};
  
  for (const [key, band] of Object.entries(rawBands)) {
    if (!band || typeof band !== 'object') continue;
    
    const targetDb = band.target_db ?? -30;
    const tolDb = band.tol_db ?? 3;
    
    let min = targetDb - tolDb;
    let max = targetDb + tolDb;
    
    if (band.target_range) {
      if (typeof band.target_range.min === 'number') min = band.target_range.min;
      if (typeof band.target_range.max === 'number') max = band.target_range.max;
    }
    
    bands[key] = { target: targetDb, min, max };
  }
  
  return bands;
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🎧 OVERRIDES POR MODO (streaming, carro, etc)
 * ════════════════════════════════════════════════════════════════════════════════
 */
function applyModeOverrides(targets, mode) {
  if (mode === 'streaming') {
    console.log('[RESOLVE-TARGETS] 📡 Aplicando override STREAMING');
    return {
      ...targets,
      lufs: { target: -14.0, min: -15.0, max: -13.0 },
      truePeak: {
        ...targets.truePeak,
        target: -1.0,
        min: -2.0,
        warnFrom: -0.5,
        max: TRUE_PEAK_HARD_CAP,
        hardCap: TRUE_PEAK_HARD_CAP
      },
      _mode: 'streaming',
      _modeOverrideApplied: true
    };
  }
  
  if (mode === 'carro') {
    console.log('[RESOLVE-TARGETS] 🚗 Aplicando override CARRO');
    return {
      ...targets,
      lufs: { target: -10.0, min: -12.0, max: -8.0 },
      _mode: 'carro',
      _modeOverrideApplied: true
    };
  }
  
  return targets;
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔐 validateTargets - GUARDRAIL OBRIGATÓRIO
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * Valida que targets estão dentro dos limites físicos aceitáveis.
 * DEVE ser chamado em dev/test para garantir integridade.
 * 
 * @param {Object} targets - Targets resolvidos
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validateTargets(targets) {
  const errors = [];
  
  if (!targets || typeof targets !== 'object') {
    return { valid: false, errors: ['Targets é null ou não é objeto'] };
  }
  
  // ══════════════════════════════════════════════════════════════
  // 1️⃣ TRUE PEAK VALIDAÇÕES
  // ══════════════════════════════════════════════════════════════
  if (!targets.truePeak) {
    errors.push('truePeak ausente');
  } else {
    if (targets.truePeak.max > TRUE_PEAK_HARD_CAP) {
      errors.push(`truePeak.max (${targets.truePeak.max}) excede hard cap (${TRUE_PEAK_HARD_CAP})`);
    }
    if (targets.truePeak.target > 0) {
      errors.push(`truePeak.target (${targets.truePeak.target}) não pode ser positivo`);
    }
    if (targets.truePeak.warnFrom !== null && targets.truePeak.warnFrom > 0) {
      errors.push(`truePeak.warnFrom (${targets.truePeak.warnFrom}) não pode ser positivo`);
    }
  }
  
  // ══════════════════════════════════════════════════════════════
  // 2️⃣ MÉTRICAS COM RANGE: min <= target <= max
  // ══════════════════════════════════════════════════════════════
  const rangeMetrics = ['lufs', 'dr', 'lra', 'stereo'];
  for (const metricKey of rangeMetrics) {
    const metric = targets[metricKey];
    if (!metric) {
      errors.push(`${metricKey} ausente`);
      continue;
    }
    
    if (typeof metric.target !== 'number') {
      errors.push(`${metricKey}.target não é número`);
    }
    if (typeof metric.min !== 'number') {
      errors.push(`${metricKey}.min não é número`);
    }
    if (typeof metric.max !== 'number') {
      errors.push(`${metricKey}.max não é número`);
    }
    
    if (metric.min > metric.target) {
      errors.push(`${metricKey}: min (${metric.min}) > target (${metric.target})`);
    }
    if (metric.target > metric.max) {
      errors.push(`${metricKey}: target (${metric.target}) > max (${metric.max})`);
    }
  }
  
  // ══════════════════════════════════════════════════════════════
  // 3️⃣ BANDAS: min <= max
  // ══════════════════════════════════════════════════════════════
  if (targets.bands) {
    for (const [bandKey, band] of Object.entries(targets.bands)) {
      if (!band) continue;
      if (band.min > band.max) {
        errors.push(`bands.${bandKey}: min (${band.min}) > max (${band.max})`);
      }
    }
  }
  
  const valid = errors.length === 0;
  
  if (!valid) {
    console.error('[VALIDATE-TARGETS] ❌ Erros encontrados:', errors);
  } else {
    console.log('[VALIDATE-TARGETS] ✅ Targets válidos');
  }
  
  return { valid, errors };
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🧪 EXPORT PARA TESTES
 * ════════════════════════════════════════════════════════════════════════════════
 */
export { SAFE_DEFAULTS };

console.log('🎯 ResolveTargets v1.0.0 carregado - FONTE ÚNICA para targets');
