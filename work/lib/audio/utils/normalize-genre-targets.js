/**
 * 🔧 NORMALIZADOR DE TARGETS
 * 
 * Converte o formato REAL do JSON (lufs_target, tol_lufs, etc)
 * para o formato esperado pelo analyzer (target, tolerance)
 * 
 * FORMATO DO JSON REAL:
 * - lufs_target, tol_lufs
 * - true_peak_target, tol_true_peak
 * - dr_target, tol_dr
 * - stereo_target, tol_stereo
 * - bands.sub.target_db, bands.sub.tol_db, bands.sub.target_range
 * 
 * FORMATO ESPERADO PELO ANALYZER:
 * - lufs: { target, tolerance }
 * - truePeak: { target, tolerance }
 * - dr: { target, tolerance }
 * - stereo: { target, tolerance }
 * - bands.sub: { target, tolerance, target_range }
 */

/**
 * Normaliza targets do formato JSON real para formato do analyzer
 * @param {Object} rawTargets - Targets no formato do JSON (lufs_target, tol_lufs, etc)
 * @returns {Object} - Targets normalizados (lufs: { target, tolerance }, etc)
 */
export function normalizeGenreTargets(rawTargets) {
  if (!rawTargets || typeof rawTargets !== 'object') {
    console.error('[NORMALIZE-TARGETS] ❌ rawTargets inválido:', rawTargets);
    return null;
  }

  console.log('[NORMALIZE-TARGETS] 🔍 Iniciando normalização...');
  console.log('[NORMALIZE-TARGETS] Formato recebido:', Object.keys(rawTargets));

  // ✅ Se já estiver no formato correto (tem .lufs.target), retornar direto
  if (rawTargets.lufs && typeof rawTargets.lufs === 'object' && 'target' in rawTargets.lufs) {
    console.log('[NORMALIZE-TARGETS] ✅ Targets já estão normalizados');
    return rawTargets;
  }

  // 🔥 CONVERSÃO: Formato JSON → Formato Analyzer
  // ✅ PATCH RANGE-MIGRATION: Adicionar min/max explícitos para todas as métricas
  const lufsTarget = typeof rawTargets.lufs_target === 'number' ? rawTargets.lufs_target : -14.0;
  const lufsTol = typeof rawTargets.tol_lufs === 'number' ? rawTargets.tol_lufs : 1.0;
  
  const tpTarget = typeof rawTargets.true_peak_target === 'number' ? rawTargets.true_peak_target : -1.0;
  const tpTol = typeof rawTargets.tol_true_peak === 'number' ? rawTargets.tol_true_peak : 0.5;
  
  const drTarget = typeof rawTargets.dr_target === 'number' ? rawTargets.dr_target : 8.0;
  const drTol = typeof rawTargets.tol_dr === 'number' ? rawTargets.tol_dr : 2.0;
  
  const stereoTarget = typeof rawTargets.stereo_target === 'number' ? rawTargets.stereo_target : 0.7;
  const stereoTol = typeof rawTargets.tol_stereo === 'number' ? rawTargets.tol_stereo : 0.15;
  
  const normalized = {
    // LUFS
    lufs: {
      target: lufsTarget,
      tolerance: lufsTol,
      critical: lufsTol * 1.5,
      // ✅ NOVO: min/max explícitos (prioridade sobre cálculo artificial)
      min: typeof rawTargets.lufs_min === 'number' ? rawTargets.lufs_min : lufsTarget - lufsTol,
      max: typeof rawTargets.lufs_max === 'number' ? rawTargets.lufs_max : lufsTarget + lufsTol
    },

    // True Peak
    truePeak: {
      target: tpTarget,
      tolerance: tpTol,
      critical: tpTol * 1.5,
      // ✅ NOVO: min/max explícitos
      min: typeof rawTargets.true_peak_min === 'number' ? rawTargets.true_peak_min : tpTarget - tpTol,
      // ✅ REGRA ABSOLUTA: True Peak nunca pode passar de 0.0 dBTP
      // Se o JSON não trouxer true_peak_max, o default deve ser 0.0 (não tpTarget + tol)
      max: (() => {
        const jsonMax = typeof rawTargets.true_peak_max === 'number' ? rawTargets.true_peak_max : 0.0;
        return jsonMax > 0 ? 0.0 : jsonMax;
      })()
    },

    // Dynamic Range
    dr: {
      target: drTarget,
      tolerance: drTol,
      critical: drTol * 1.5,
      // ✅ NOVO: min/max explícitos
      min: typeof rawTargets.dr_min === 'number' ? rawTargets.dr_min : drTarget - drTol,
      max: typeof rawTargets.dr_max === 'number' ? rawTargets.dr_max : drTarget + drTol
    },

    // Stereo Correlation
    stereo: {
      target: stereoTarget,
      tolerance: stereoTol,
      critical: stereoTol * 1.5,
      // ✅ NOVO: min/max explícitos
      min: typeof rawTargets.stereo_min === 'number' ? rawTargets.stereo_min : stereoTarget - stereoTol,
      max: typeof rawTargets.stereo_max === 'number' ? rawTargets.stereo_max : stereoTarget + stereoTol
    },

    // Bandas Espectrais
    bands: {}
  };

  // 🎯 NORMALIZAR BANDAS
  if (rawTargets.bands && typeof rawTargets.bands === 'object') {
    const bandKeys = Object.keys(rawTargets.bands);
    console.log('[NORMALIZE-TARGETS] 🎵 Normalizando bandas:', bandKeys);

    for (const bandKey of bandKeys) {
      const rawBand = rawTargets.bands[bandKey];
      
      if (!rawBand || typeof rawBand !== 'object') {
        console.warn(`[NORMALIZE-TARGETS] ⚠️ Banda ${bandKey} inválida, pulando`);
        continue;
      }

      // ✅ Normalizar banda
      normalized.bands[bandKey] = {
        target_db: typeof rawBand.target_db === 'number' ? rawBand.target_db : -30.0,
        tol_db: typeof rawBand.tol_db === 'number' ? rawBand.tol_db : 3.0,
        target_range: rawBand.target_range || null,
        critical: typeof rawBand.tol_db === 'number' ? rawBand.tol_db * 1.5 : 4.5,
        // Preservar energy_pct para referência (não usado em sugestões)
        energy_pct: rawBand.energy_pct
      };

      console.log(`[NORMALIZE-TARGETS] ✅ Banda ${bandKey}:`, {
        target_db: normalized.bands[bandKey].target_db,
        tol_db: normalized.bands[bandKey].tol_db,
        target_range: normalized.bands[bandKey].target_range
      });
    }
  }

  console.log('[NORMALIZE-TARGETS] ✅ Normalização completa:', {
    lufs: normalized.lufs,
    truePeak: normalized.truePeak,
    dr: normalized.dr,
    stereo: normalized.stereo,
    bandsCount: Object.keys(normalized.bands).length
  });
  
  // ✅ PATCH RANGE-MIGRATION: Log de auditoria dos ranges criados
  console.log('[NORMALIZE-TARGETS][RANGE-MIGRATION] ✅ Ranges min/max criados:', {
    lufs: { min: normalized.lufs.min, max: normalized.lufs.max, source: typeof rawTargets.lufs_min === 'number' ? 'JSON' : 'calculado' },
    truePeak: { min: normalized.truePeak.min, max: normalized.truePeak.max, source: typeof rawTargets.true_peak_min === 'number' ? 'JSON' : 'calculado' },
    dr: { min: normalized.dr.min, max: normalized.dr.max, source: typeof rawTargets.dr_min === 'number' ? 'JSON' : 'calculado' },
    stereo: { min: normalized.stereo.min, max: normalized.stereo.max, source: typeof rawTargets.stereo_min === 'number' ? 'JSON' : 'calculado' }
  });

  return normalized;
}

/**
 * Valida se targets estão no formato correto
 * @param {Object} targets - Targets normalizados
 * @returns {boolean} - true se válido
 */
export function validateNormalizedTargets(targets) {
  if (!targets || typeof targets !== 'object') {
    console.error('[VALIDATE-TARGETS] ❌ Targets ausente');
    return false;
  }

  const requiredMetrics = ['lufs', 'truePeak', 'dr', 'stereo'];
  const missingMetrics = requiredMetrics.filter(m => {
    const metric = targets[m];
    return !metric || 
           typeof metric !== 'object' || 
           typeof metric.target !== 'number' || 
           typeof metric.tolerance !== 'number';
  });

  if (missingMetrics.length > 0) {
    console.error('[VALIDATE-TARGETS] ❌ Métricas inválidas:', missingMetrics);
    return false;
  }

  if (!targets.bands || typeof targets.bands !== 'object') {
    console.error('[VALIDATE-TARGETS] ❌ Bandas ausentes');
    return false;
  }

  console.log('[VALIDATE-TARGETS] ✅ Targets válidos');
  return true;
}

console.log('🔧 Normalize Genre Targets carregado');
