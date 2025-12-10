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
  const normalized = {
    // LUFS
    lufs: {
      target: typeof rawTargets.lufs_target === 'number' ? rawTargets.lufs_target : -14.0,
      tolerance: typeof rawTargets.tol_lufs === 'number' ? rawTargets.tol_lufs : 1.0,
      critical: typeof rawTargets.tol_lufs === 'number' ? rawTargets.tol_lufs * 1.5 : 1.5
    },

    // True Peak
    truePeak: {
      target: typeof rawTargets.true_peak_target === 'number' ? rawTargets.true_peak_target : -1.0,
      tolerance: typeof rawTargets.tol_true_peak === 'number' ? rawTargets.tol_true_peak : 0.5,
      critical: typeof rawTargets.tol_true_peak === 'number' ? rawTargets.tol_true_peak * 1.5 : 0.75
    },

    // Dynamic Range
    dr: {
      target: typeof rawTargets.dr_target === 'number' ? rawTargets.dr_target : 8.0,
      tolerance: typeof rawTargets.tol_dr === 'number' ? rawTargets.tol_dr : 2.0,
      critical: typeof rawTargets.tol_dr === 'number' ? rawTargets.tol_dr * 1.5 : 3.0
    },

    // Stereo Correlation
    stereo: {
      target: typeof rawTargets.stereo_target === 'number' ? rawTargets.stereo_target : 0.7,
      tolerance: typeof rawTargets.tol_stereo === 'number' ? rawTargets.tol_stereo : 0.15,
      critical: typeof rawTargets.tol_stereo === 'number' ? rawTargets.tol_stereo * 1.5 : 0.225
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
