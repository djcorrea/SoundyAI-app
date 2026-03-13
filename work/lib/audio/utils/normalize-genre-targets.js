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

  // ── AUDIT STEP 3 ──
  console.log("AUDIT NORMALIZED TARGETS →", normalized.metrics?.lufs);

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
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎧 STREAMING MODE OVERRIDE
 * 
 * Aplica overrides para streaming (Spotify, Apple Music, YouTube):
 * - LUFS target = -14.0 (padrão streaming)
 * - True Peak target = -1.0 (mais conservador)
 * - Mantém bandas/DR do gênero original
 * 
 * @param {Object} normalizedTargets - Targets já normalizados
 * @param {string} destination - 'streaming' | 'pista' | 'carro'
 * @returns {Object} - Targets com override aplicado
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function applyStreamingOverride(normalizedTargets, destination = 'pista') {
  if (!normalizedTargets || !normalizedTargets._normalized) {
    console.error('[STREAMING-OVERRIDE] ❌ Targets não normalizados');
    return normalizedTargets;
  }

  // Se não for streaming, retornar original
  if (destination !== 'streaming') {
    return normalizedTargets;
  }

  // Clonar para não modificar original
  const overridden = JSON.parse(JSON.stringify(normalizedTargets));
  
  // 🎧 OVERRIDE PARA STREAMING
  const STREAMING_LUFS = -14.0;
  const STREAMING_LUFS_TOL = 1.0;
  const STREAMING_TP = -1.0;
  const STREAMING_TP_TOL = 0.5;

  overridden.metrics.lufs = {
    target: STREAMING_LUFS,
    tolerance: STREAMING_LUFS_TOL,
    min: STREAMING_LUFS - STREAMING_LUFS_TOL,
    max: STREAMING_LUFS + STREAMING_LUFS_TOL,
    unit: 'LUFS',
    _overrideSource: 'streaming'
  };

  overridden.metrics.truePeak = {
    ...overridden.metrics.truePeak,
    target: STREAMING_TP,
    tolerance: STREAMING_TP_TOL,
    min: STREAMING_TP - STREAMING_TP_TOL,
    warnFrom: -0.5,
    _overrideSource: 'streaming'
  };

  // Compatibilidade legada
  overridden.lufs = { ...overridden.metrics.lufs };
  overridden.truePeak = { ...overridden.metrics.truePeak };

  overridden._destination = destination;
  overridden._overrideApplied = true;

  console.log('[STREAMING-OVERRIDE] ✅ Override aplicado:', {
    destination,
    lufs: `[${overridden.metrics.lufs.min.toFixed(1)}, ${overridden.metrics.lufs.max.toFixed(1)}]`,
    truePeak: `[${overridden.metrics.truePeak.min.toFixed(1)}, ${overridden.metrics.truePeak.max.toFixed(1)}]`
  });

  return overridden;
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
 * 🎯 classifySeverity — FUNÇÃO CENTRAL DE SEVERIDADE (Mix-Oriented v3.0)
 *
 * Lógica unificada e previsível para análise de MIX:
 *  - Dentro do range  → sempre OK
 *  - Fora do range    → distância até borda determina nível
 *  - Regra base       : dist < 3 → OK | 3–7 → ATENÇÃO | >7 → CRÍTICA
 *  - Exceções por métrica controladas explicitamente
 *
 * @param {Object} params
 * @param {number} params.value      - Valor medido
 * @param {number} params.min        - Limite mínimo do range
 * @param {number} params.max        - Limite máximo do range
 * @param {string} [params.metricType] - 'lufs'|'truePeak'|'dr'|'stereo'|
 *                                       'sub'|'low_bass'|'upper_bass'|
 *                                       'low_mid'|'mid'|'high_mid'|'brilho'|'presenca'
 * @returns {'OK'|'ATENÇÃO'|'CRÍTICA'|'N/A'}
 */
export function classifySeverity({ value, min, max, metricType = 'default' }) {
  if (!Number.isFinite(value)) return 'N/A';

  const isInside = value >= min && value <= max;

  // ── TRUE PEAK: hard cap + limiares próprios ─────────────────────────────
  if (metricType === 'truePeak') {
    // Acima de 0 dBTP = clipping físico → sempre CRÍTICA
    if (value > 0) return 'CRÍTICA';
    // Dentro do range → OK
    if (isInside) return 'OK';
    const dist = value < min ? min - value : value - max;
    // Abaixo do mínimo (mix muito quieto): máximo ATENÇÃO
    if (value < min) return dist >= 1 ? 'ATENÇÃO' : 'OK';
    // Acima do máximo (próximo de clipar)
    if (dist < 1) return 'OK';
    if (dist <= 2) return 'ATENÇÃO';
    return 'CRÍTICA';
  }

  // ── Dentro do range = sempre OK ─────────────────────────────────────────
  if (isInside) return 'OK';

  // ── Distância fora do range (positiva) ───────────────────────────────────
  const dist = value < min ? min - value : value - max;

  // ── DR: range natural mais amplo ─────────────────────────────────────────
  if (metricType === 'dr') {
    if (dist < 3) return 'OK';
    if (dist <= 6) return 'ATENÇÃO';
    return 'CRÍTICA';
  }

  // ── Bandas mid/high: presença espectral mais variável ────────────────────
  if (metricType === 'mid' || metricType === 'high_mid' ||
      metricType === 'brilho' || metricType === 'presenca') {
    if (dist < 4) return 'OK';
    if (dist <= 8) return 'ATENÇÃO';
    return 'CRÍTICA';
  }

  // ── Regra base (lufs, stereo, sub, low_bass, upper_bass, low_mid, etc.) ──
  if (dist < 3) return 'OK';
  if (dist <= 7) return 'ATENÇÃO';
  return 'CRÍTICA';
}

/**
 * 🎯 FUNÇÃO DE SEVERIDADE ÚNICA - WRAPPER PARA evaluateMetric
 * 
 * Esta função DELEGA para evaluateMetric (fonte única da verdade).
 * Mantém assinatura compatível para código existente.
 * 
 * @param {string} metricKey - Chave da métrica ('lufs', 'truePeak', 'dr', 'stereo')
 * @param {number} value - Valor medido
 * @param {Object} normalizedTargets - Targets normalizados (do normalizeGenreTargets)
 * @returns {Object} { severity: 'OK'|'ATENÇÃO'|'ALTA'|'CRÍTICA', delta, action, isCritical? }
 */
export function calculateMetricSeverity(metricKey, value, normalizedTargets) {
  // DELEGA para evaluateMetricByKey (fonte única)
  // Isso garante que NÃO há lógica duplicada
  const result = evaluateMetricByKey(metricKey, value, normalizedTargets);
  
  // Adaptar resultado para assinatura esperada pelo código existente
  return {
    severity: result.severity,
    delta: result.diffToNearestLimit,
    action: result.action,
    isCritical: result.isCritical
  };
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
  const { min, max } = band;
  
  // Severidade via classifySeverity (fonte única)
  const severity = classifySeverity({ value, min, max, metricType: bandKey });

  if (severity === 'OK') {
    return { severity: 'OK', delta: 0, action: '✅ Dentro do padrão' };
  }

  const isAbove = value > max;
  const delta    = isAbove ? value - max : value - min; // positivo se acima, negativo se abaixo
  const absDelta = Math.abs(delta);
  const actionVerb = isAbove ? 'Reduzir' : 'Aumentar';
  const icon = severity === 'CRÍTICA' ? '🔴' : '⚠️';

  return {
    severity,
    delta,
    action: `${icon} ${actionVerb} ${absDelta.toFixed(1)} dB`
  };
}

console.log('🔧 Normalize Genre Targets v3.0.0 carregado (Mix-Oriented: classifySeverity central, 3 níveis: OK/ATENÇÃO/CRÍTICA)');

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 evaluateMetric - FUNÇÃO ÚNICA DE AVALIAÇÃO
 * 
 * Esta função DEVE ser usada por:
 *   1) Tabela de comparação (status, ação)
 *   2) Score (pontuação)
 *   3) Builder de sugestões (severidade, delta)
 * 
 * GARANTE: mesma avaliação em todos os lugares, sem divergências.
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @param {number} value - Valor medido
 * @param {Object} cfg - Configuração do target
 * @param {number} cfg.min - Limite mínimo aceitável
 * @param {number} cfg.max - Limite máximo aceitável  
 * @param {number} cfg.target - Valor alvo (para cálculo de delta)
 * @param {number} [cfg.tolerance] - Tolerância (para gradação de severidade)
 * @param {number} [cfg.warnFrom] - Ponto de warning (para True Peak)
 * @param {number} [cfg.hardCap] - Hard cap absoluto (para True Peak = 0.0)
 * @param {string} [cfg.unit] - Unidade (LUFS, dBTP, dB, correlation)
 * @param {boolean} [cfg.isTruePeak] - Se é True Peak (regra especial: >0 = CRÍTICA)
 * 
 * @returns {Object} {
 *   status: 'OK' | 'LEVE' | 'MÉDIA' | 'ALTA' | 'CRÍTICA',
 *   severity: 'OK' | 'ATENÇÃO' | 'ALTA' | 'CRÍTICA',
 *   diffToTarget: number,
 *   diffToNearestLimit: number,
 *   action: string,
 *   isWithinRange: boolean,
 *   isCritical: boolean
 * }
 */
export function evaluateMetric(value, cfg) {
  if (!Number.isFinite(value)) {
    return {
      status: 'N/A',
      severity: 'N/A',
      diffToTarget: 0,
      diffToNearestLimit: 0,
      action: 'Sem dados',
      isWithinRange: false,
      isCritical: false
    };
  }

  if (!cfg || typeof cfg.min !== 'number' || typeof cfg.max !== 'number') {
    return {
      status: 'N/A',
      severity: 'N/A',
      diffToTarget: 0,
      diffToNearestLimit: 0,
      action: 'Configuração inválida',
      isWithinRange: false,
      isCritical: false
    };
  }

  const { min, max, target, warnFrom, hardCap, unit = '', isTruePeak = false, metricType = 'default' } = cfg;
  const effectiveTarget = typeof target === 'number' ? target : (min + max) / 2;
  const effectiveHardCap = isTruePeak ? (hardCap ?? TRUE_PEAK_HARD_CAP) : null;
  // metricType para classifySeverity — isTruePeak tem prioridade (retrocompatibilidade)
  const effectiveMetricType = isTruePeak ? 'truePeak' : metricType;

  // ═══════════════════════════════════════════════════════════════════════════
  // 🚨 REGRA ESPECIAL TRUE PEAK: valor > 0.0 dBTP = SEMPRE CRÍTICA
  // 🔧 FIX: Ação usa deltaToTarget (não hardCap) para consistência com coluna "Diferença"
  // ═══════════════════════════════════════════════════════════════════════════
  if (isTruePeak && effectiveHardCap !== null && value > effectiveHardCap) {
    const deltaToTarget = value - effectiveTarget;  // ✅ SSOT: sempre usa target do gênero
    return {
      status: 'CRÍTICA',
      severity: 'CRÍTICA',
      diffToTarget: deltaToTarget,
      diffToNearestLimit: value - effectiveHardCap,  // Info: distância até hardcap
      action: `🔴 CLIPPING! Reduzir ${deltaToTarget.toFixed(2)} ${unit}`,
      isWithinRange: false,
      isCritical: true
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OK: Dentro do range [min, max]
  // ═══════════════════════════════════════════════════════════════════════════
  if (value >= min && value <= max) {
    return {
      status: 'OK',
      severity: 'OK',
      diffToTarget: value - effectiveTarget,
      diffToNearestLimit: 0,
      action: '✅ Dentro do padrão',
      isWithinRange: true,
      isCritical: false
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORA DO RANGE: Severidade via classifySeverity (Mix-Oriented v3.0)
  // ═══════════════════════════════════════════════════════════════════════════
  let diffToNearestLimit, actionVerb;

  if (value < min) {
    diffToNearestLimit = value - min; // negativo
    actionVerb = 'Aumentar';
  } else {
    diffToNearestLimit = value - max; // positivo
    actionVerb = 'Reduzir';
  }

  const absDiff = Math.abs(diffToNearestLimit);

  // Classificar via função central (fonte única da verdade)
  const severity = classifySeverity({ value, min, max, metricType: effectiveMetricType });
  const status = severity; // Alinhado: status === severity (3 níveis: OK/ATENÇÃO/CRÍTICA)
  const icon = severity === 'CRÍTICA' ? '🔴' : '⚠️';

  return {
    status,
    severity,
    diffToTarget: value - effectiveTarget,
    diffToNearestLimit,
    action: `${icon} ${actionVerb} ${absDiff.toFixed(1)} ${unit}`,
    isWithinRange: false,
    isCritical: severity === 'CRÍTICA'
  };
}

/**
 * 🎯 Wrapper de evaluateMetric para métricas por key
 */
export function evaluateMetricByKey(metricKey, value, normalizedTargets) {
  if (!normalizedTargets) {
    return evaluateMetric(value, {});
  }
  
  const metrics = normalizedTargets.metrics || normalizedTargets;
  const target = metrics[metricKey];
  
  if (!target) {
    return evaluateMetric(value, {});
  }

  // ── AUDIT STEP 4 ──
  if (metricKey === 'lufs') {
    console.log("AUDIT LOUDNESS CHECK →", {
      value,
      target: target.target,
      tol:    target.tolerance,
      min:    target.min,
      max:    target.max
    });
  }

  const _auditResult = evaluateMetric(value, {
    min: target.min,
    max: target.max,
    target: target.target,
    warnFrom: target.warnFrom,
    hardCap: target.hardCap,
    unit: target.unit,
    isTruePeak: metricKey === 'truePeak',
    metricType: metricKey
  });

  // ── AUDIT STEP 5 ──
  if (metricKey === 'lufs') {
    console.log("AUDIT RESULT →", _auditResult);
  }

  return _auditResult;
}
