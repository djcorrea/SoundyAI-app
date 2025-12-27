/**
 * 🔧 NORMALIZADOR DE TARGETS - FONTE ÚNICA DA VERDADE
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * OBJETIVO: Eliminar divergências entre tabela, score e sugestões.
 * O objeto normalizado gerado aqui é a ÚNICA fonte para decisões de severidade.
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * FORMATO DO JSON REAL (work/refs/out/*.json):
 * - lufs_target, tol_lufs, lufs_min, lufs_max
 * - true_peak_target, tol_true_peak, true_peak_min, true_peak_max, true_peak_warn_from
 * - dr_target, tol_dr, dr_min, dr_max
 * - stereo_target, tol_stereo
 * - bands.sub.target_db, bands.sub.tol_db, bands.sub.target_range
 * 
 * FORMATO NORMALIZADO PARA FRONTEND/SCORING/SUGESTÕES:
 * {
 *   metrics: {
 *     lufs: { target, min, max, tolerance },
 *     truePeak: { target, min, max, tolerance, warnFrom, hardCap: 0.0 },
 *     dr: { target, min, max, tolerance },
 *     stereo: { target, min, max, tolerance }
 *   },
 *   bands: {
 *     sub: { target, min, max, tolerance },
 *     bass: { target, min, max, tolerance },
 *     ...
 *   }
 * }
 * 
 * REGRA OBRIGATÓRIA TRUE PEAK:
 * - truePeak.max = 0.0 SEMPRE (hard cap físico)
 * - truePeak > 0 dBTP => severidade CRÍTICA sempre
 */

// 🎯 CONSTANTES FÍSICAS
const TRUE_PEAK_HARD_CAP = 0.0; // dBTP - NUNCA ultrapassar

/**
 * Normaliza targets do formato JSON real para formato único de referência
 * @param {Object} rawTargets - Targets no formato do JSON (lufs_target, tol_lufs, etc)
 * @returns {Object} - Targets normalizados com estrutura { metrics: {...}, bands: {...}, _normalized: true }
 */
export function normalizeGenreTargets(rawTargets) {
  if (!rawTargets || typeof rawTargets !== 'object') {
    console.error('[NORMALIZE-TARGETS] ❌ rawTargets inválido:', rawTargets);
    return null;
  }

  // ✅ Se já estiver no formato normalizado, retornar direto
  if (rawTargets._normalized === true || (rawTargets.metrics && rawTargets.metrics.lufs)) {
    console.log('[NORMALIZE-TARGETS] ✅ Targets já estão normalizados');
    return rawTargets;
  }
  
  // ✅ Detectar formato antigo (lufs.target em vez de lufs_target)
  if (rawTargets.lufs && typeof rawTargets.lufs === 'object' && 'target' in rawTargets.lufs) {
    console.log('[NORMALIZE-TARGETS] ⚠️ Formato intermediário detectado - convertendo para novo formato');
    return convertIntermediateFormat(rawTargets);
  }

  // 🔥 CONVERSÃO: Formato JSON → Formato Normalizado
  const lufsTarget = typeof rawTargets.lufs_target === 'number' ? rawTargets.lufs_target : -14.0;
  const lufsTol = typeof rawTargets.tol_lufs === 'number' ? rawTargets.tol_lufs : 1.0;
  
  const tpTarget = typeof rawTargets.true_peak_target === 'number' ? rawTargets.true_peak_target : -1.0;
  const tpTol = typeof rawTargets.tol_true_peak === 'number' ? rawTargets.tol_true_peak : 0.5;
  const tpWarnFrom = typeof rawTargets.true_peak_warn_from === 'number' ? rawTargets.true_peak_warn_from : null;
  
  const drTarget = typeof rawTargets.dr_target === 'number' ? rawTargets.dr_target : 8.0;
  const drTol = typeof rawTargets.tol_dr === 'number' ? rawTargets.tol_dr : 2.0;
  
  const stereoTarget = typeof rawTargets.stereo_target === 'number' ? rawTargets.stereo_target : 0.7;
  const stereoTol = typeof rawTargets.tol_stereo === 'number' ? rawTargets.tol_stereo : 0.15;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎯 ESTRUTURA NORMALIZADA - FONTE ÚNICA DA VERDADE
  // ═══════════════════════════════════════════════════════════════════════════
  const normalized = {
    _normalized: true,
    _version: '2.0.0',
    _generatedAt: new Date().toISOString(),
    
    // 🎯 MÉTRICAS PRINCIPAIS
    metrics: {
      // LUFS
      lufs: {
        target: lufsTarget,
        tolerance: lufsTol,
        min: typeof rawTargets.lufs_min === 'number' ? rawTargets.lufs_min : lufsTarget - lufsTol,
        max: typeof rawTargets.lufs_max === 'number' ? rawTargets.lufs_max : lufsTarget + lufsTol,
        unit: 'LUFS'
      },

      // TRUE PEAK - 🚨 REGRA CRÍTICA: max = 0.0 SEMPRE (hard cap físico)
      truePeak: {
        target: tpTarget,
        tolerance: tpTol,
        min: typeof rawTargets.true_peak_min === 'number' ? rawTargets.true_peak_min : tpTarget - tpTol,
        // 🔥 HARD CAP: true_peak_max NUNCA pode ser > 0.0 dBTP
        max: Math.min(
          typeof rawTargets.true_peak_max === 'number' ? rawTargets.true_peak_max : tpTarget + tpTol,
          TRUE_PEAK_HARD_CAP
        ),
        warnFrom: tpWarnFrom,
        hardCap: TRUE_PEAK_HARD_CAP,
        unit: 'dBTP'
      },

      // Dynamic Range
      dr: {
        target: drTarget,
        tolerance: drTol,
        min: typeof rawTargets.dr_min === 'number' ? rawTargets.dr_min : drTarget - drTol,
        max: typeof rawTargets.dr_max === 'number' ? rawTargets.dr_max : drTarget + drTol,
        unit: 'dB'
      },

      // Stereo Correlation
      stereo: {
        target: stereoTarget,
        tolerance: stereoTol,
        min: typeof rawTargets.stereo_min === 'number' ? rawTargets.stereo_min : stereoTarget - stereoTol,
        max: typeof rawTargets.stereo_max === 'number' ? rawTargets.stereo_max : stereoTarget + stereoTol,
        unit: 'correlation'
      }
    },

    // 🎯 BANDAS ESPECTRAIS
    bands: {},
    
    // 🔄 COMPATIBILIDADE: Manter formato legado para código que ainda usa
    lufs: null,
    truePeak: null,
    dr: null,
    stereo: null
  };

  // 🎯 NORMALIZAR BANDAS
  if (rawTargets.bands && typeof rawTargets.bands === 'object') {
    for (const bandKey of Object.keys(rawTargets.bands)) {
      const rawBand = rawTargets.bands[bandKey];
      
      if (!rawBand || typeof rawBand !== 'object') continue;

      const targetDb = typeof rawBand.target_db === 'number' ? rawBand.target_db : -30.0;
      const tolDb = typeof rawBand.tol_db === 'number' ? rawBand.tol_db : 3.0;
      
      // Extrair min/max de target_range se disponível
      let minDb = targetDb - tolDb;
      let maxDb = targetDb + tolDb;
      
      if (rawBand.target_range && typeof rawBand.target_range === 'object') {
        if (typeof rawBand.target_range.min === 'number') minDb = rawBand.target_range.min;
        if (typeof rawBand.target_range.max === 'number') maxDb = rawBand.target_range.max;
      }

      normalized.bands[bandKey] = {
        target: targetDb,
        tolerance: tolDb,
        min: minDb,
        max: maxDb,
        energy_pct: rawBand.energy_pct,
        unit: 'dB'
      };
    }
  }
  
  // 🔄 COMPATIBILIDADE: Preencher formato legado (para código antigo)
  normalized.lufs = { ...normalized.metrics.lufs };
  normalized.truePeak = { ...normalized.metrics.truePeak };
  normalized.dr = { ...normalized.metrics.dr };
  normalized.stereo = { ...normalized.metrics.stereo };

  // 📊 Log resumido (evitar flood)
  console.log('[NORMALIZE-TARGETS] ✅ Normalização completa:', {
    version: normalized._version,
    lufs: `[${normalized.metrics.lufs.min.toFixed(1)}, ${normalized.metrics.lufs.max.toFixed(1)}]`,
    truePeak: `[${normalized.metrics.truePeak.min.toFixed(1)}, ${normalized.metrics.truePeak.max.toFixed(1)}] hardCap=${normalized.metrics.truePeak.hardCap}`,
    dr: `[${normalized.metrics.dr.min.toFixed(1)}, ${normalized.metrics.dr.max.toFixed(1)}]`,
    bandsCount: Object.keys(normalized.bands).length
  });

  return normalized;
}

/**
 * Converte formato intermediário (lufs.target) para novo formato normalizado
 */
function convertIntermediateFormat(intermediate) {
  return {
    _normalized: true,
    _version: '2.0.0',
    _generatedAt: new Date().toISOString(),
    
    metrics: {
      lufs: {
        target: intermediate.lufs?.target ?? -14.0,
        tolerance: intermediate.lufs?.tolerance ?? 1.0,
        min: intermediate.lufs?.min ?? (intermediate.lufs?.target - intermediate.lufs?.tolerance),
        max: intermediate.lufs?.max ?? (intermediate.lufs?.target + intermediate.lufs?.tolerance),
        unit: 'LUFS'
      },
      truePeak: {
        target: intermediate.truePeak?.target ?? -1.0,
        tolerance: intermediate.truePeak?.tolerance ?? 0.5,
        min: intermediate.truePeak?.min ?? (intermediate.truePeak?.target - intermediate.truePeak?.tolerance),
        max: Math.min(intermediate.truePeak?.max ?? 0.0, TRUE_PEAK_HARD_CAP),
        warnFrom: intermediate.truePeak?.warnFrom ?? null,
        hardCap: TRUE_PEAK_HARD_CAP,
        unit: 'dBTP'
      },
      dr: {
        target: intermediate.dr?.target ?? 8.0,
        tolerance: intermediate.dr?.tolerance ?? 2.0,
        min: intermediate.dr?.min ?? (intermediate.dr?.target - intermediate.dr?.tolerance),
        max: intermediate.dr?.max ?? (intermediate.dr?.target + intermediate.dr?.tolerance),
        unit: 'dB'
      },
      stereo: {
        target: intermediate.stereo?.target ?? 0.7,
        tolerance: intermediate.stereo?.tolerance ?? 0.15,
        min: intermediate.stereo?.min ?? (intermediate.stereo?.target - intermediate.stereo?.tolerance),
        max: intermediate.stereo?.max ?? (intermediate.stereo?.target + intermediate.stereo?.tolerance),
        unit: 'correlation'
      }
    },
    bands: intermediate.bands || {},
    // Compatibilidade
    lufs: intermediate.lufs,
    truePeak: intermediate.truePeak,
    dr: intermediate.dr,
    stereo: intermediate.stereo
  };
}

/**
 * Valida se targets estão no formato normalizado correto
 * @param {Object} targets - Targets normalizados
 * @returns {boolean} - true se válido
 */
export function validateNormalizedTargets(targets) {
  if (!targets || typeof targets !== 'object') {
    console.error('[VALIDATE-TARGETS] ❌ Targets ausente');
    return false;
  }

  // Verificar flag de normalização
  if (!targets._normalized && !targets.metrics) {
    console.error('[VALIDATE-TARGETS] ❌ Targets não estão normalizados');
    return false;
  }

  const metrics = targets.metrics || targets;
  const requiredMetrics = ['lufs', 'truePeak', 'dr', 'stereo'];
  
  const missingMetrics = requiredMetrics.filter(m => {
    const metric = metrics[m];
    return !metric || 
           typeof metric !== 'object' || 
           typeof metric.target !== 'number';
  });

  if (missingMetrics.length > 0) {
    console.error('[VALIDATE-TARGETS] ❌ Métricas inválidas:', missingMetrics);
    return false;
  }

  // Verificar hard cap do True Peak
  if (metrics.truePeak && metrics.truePeak.max > TRUE_PEAK_HARD_CAP) {
    console.error('[VALIDATE-TARGETS] ❌ True Peak max excede hard cap:', metrics.truePeak.max);
    return false;
  }

  console.log('[VALIDATE-TARGETS] ✅ Targets válidos');
  return true;
}

/**
 * 🎯 FUNÇÃO DE SEVERIDADE ÚNICA - FONTE DA VERDADE
 * 
 * Calcula severidade de uma métrica usando targets normalizados.
 * Esta função deve ser usada por TODAS as partes do sistema (tabela, score, sugestões).
 * 
 * @param {string} metricKey - Chave da métrica ('lufs', 'truePeak', 'dr', 'stereo')
 * @param {number} value - Valor medido
 * @param {Object} normalizedTargets - Targets normalizados (do normalizeGenreTargets)
 * @returns {Object} { severity: 'OK'|'ATENÇÃO'|'ALTA'|'CRÍTICA', delta, action }
 */
export function calculateMetricSeverity(metricKey, value, normalizedTargets) {
  if (!Number.isFinite(value)) {
    return { severity: 'N/A', delta: 0, action: 'Sem dados' };
  }
  
  if (!normalizedTargets) {
    return { severity: 'N/A', delta: 0, action: 'Sem targets' };
  }
  
  // Extrair targets da estrutura normalizada
  const metrics = normalizedTargets.metrics || normalizedTargets;
  const target = metrics[metricKey];
  
  if (!target || typeof target.min !== 'number' || typeof target.max !== 'number') {
    return { severity: 'N/A', delta: 0, action: 'Target inválido' };
  }
  
  const { min, max, warnFrom, hardCap } = target;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🚨 REGRA ESPECIAL TRUE PEAK: valor > 0.0 dBTP = SEMPRE CRÍTICA
  // ═══════════════════════════════════════════════════════════════════════════
  if (metricKey === 'truePeak') {
    // CRÍTICA: Acima do hard cap (0.0 dBTP)
    if (value > (hardCap ?? TRUE_PEAK_HARD_CAP)) {
      const delta = value - (hardCap ?? TRUE_PEAK_HARD_CAP);
      return {
        severity: 'CRÍTICA',
        delta,
        action: `🔴 CLIPPING! Reduzir ${delta.toFixed(2)} dB`,
        isCritical: true
      };
    }
    
    // ATENÇÃO: Na zona de warning (ex: acima de -0.1)
    if (warnFrom !== null && warnFrom !== undefined && value > warnFrom) {
      const delta = value - warnFrom;
      return {
        severity: 'ATENÇÃO',
        delta,
        action: `⚠️ Próximo do limite. Reduzir ${delta.toFixed(2)} dB`
      };
    }
    
    // ATENÇÃO: Abaixo do mínimo
    if (value < min) {
      const delta = min - value;
      return {
        severity: 'ATENÇÃO',
        delta: -delta,
        action: `⚠️ Muito baixo. Pode aumentar até ${delta.toFixed(1)} dB`
      };
    }
    
    // OK: Dentro do range
    return { severity: 'OK', delta: 0, action: '✅ Dentro do padrão' };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // OUTRAS MÉTRICAS: Lógica padrão de range [min, max]
  // ═══════════════════════════════════════════════════════════════════════════
  
  // OK: Dentro do range
  if (value >= min && value <= max) {
    return { severity: 'OK', delta: 0, action: '✅ Dentro do padrão' };
  }
  
  // Fora do range: calcular distância
  const tolerance = target.tolerance || (max - min) / 2;
  let delta, absDelta;
  
  if (value < min) {
    delta = value - min; // negativo
    absDelta = min - value;
  } else {
    delta = value - max; // positivo
    absDelta = value - max;
  }
  
  // Determinar severidade baseada na distância
  const actionVerb = delta > 0 ? 'Reduzir' : 'Aumentar';
  
  if (absDelta <= tolerance) {
    return {
      severity: 'ATENÇÃO',
      delta,
      action: `⚠️ ${actionVerb} ${absDelta.toFixed(1)} ${target.unit || ''}`
    };
  } else if (absDelta <= tolerance * 2) {
    return {
      severity: 'ALTA',
      delta,
      action: `🟡 ${actionVerb} ${absDelta.toFixed(1)} ${target.unit || ''}`
    };
  } else {
    return {
      severity: 'CRÍTICA',
      delta,
      action: `🔴 ${actionVerb} ${absDelta.toFixed(1)} ${target.unit || ''}`
    };
  }
}

/**
 * 🎯 Calcula severidade para banda espectral
 */
export function calculateBandSeverity(bandKey, value, normalizedTargets) {
  if (!Number.isFinite(value)) {
    return { severity: 'N/A', delta: 0, action: 'Sem dados' };
  }
  
  const bands = normalizedTargets?.bands || normalizedTargets?.metrics?.bands;
  if (!bands || !bands[bandKey]) {
    return { severity: 'N/A', delta: 0, action: 'Sem target' };
  }
  
  const band = bands[bandKey];
  const { min, max, tolerance } = band;
  
  // OK: Dentro do range
  if (value >= min && value <= max) {
    return { severity: 'OK', delta: 0, action: '✅ Dentro do padrão' };
  }
  
  // Fora do range
  const tol = tolerance || 2.0;
  let delta, absDelta;
  
  if (value < min) {
    delta = value - min;
    absDelta = min - value;
  } else {
    delta = value - max;
    absDelta = value - max;
  }
  
  const actionVerb = delta > 0 ? 'Reduzir' : 'Aumentar';
  
  if (absDelta >= tol * 1.5) {
    return {
      severity: 'CRÍTICA',
      delta,
      action: `🔴 ${actionVerb} ${absDelta.toFixed(1)} dB`
    };
  } else if (absDelta >= tol) {
    return {
      severity: 'ALTA',
      delta,
      action: `🟡 ${actionVerb} ${absDelta.toFixed(1)} dB`
    };
  } else {
    return {
      severity: 'ATENÇÃO',
      delta,
      action: `⚠️ ${actionVerb} ${absDelta.toFixed(1)} dB`
    };
  }
}

console.log('🔧 Normalize Genre Targets v2.0.0 carregado (FONTE ÚNICA DA VERDADE)');
