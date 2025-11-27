/**
 * 🎯 GENRE TARGETS UTILITIES
 * ══════════════════════════════════════════════════════════════
 * Centraliza toda a lógica de extração de targets de gênero.
 * ÚNICA FONTE VÁLIDA: analysis.data.genreTargets (vindo do backend)
 * ══════════════════════════════════════════════════════════════
 */

/**
 * 🎯 FONTE OFICIAL: Extrai targets de gênero da análise
 * Ordem de prioridade:
 * 1. analysis.data.genreTargets (vindo do backend - PostgreSQL job.data)
 * 2. analysis.genreTargets (fallback)
 * 3. analysis.data.targets (fallback alternativo)
 * 4. null (se nenhum target disponível)
 * 
 * @param {Object} analysis - Objeto de análise retornado do backend
 * @returns {Object|null} - Targets do gênero ou null
 */
export function extractGenreTargetsFromAnalysis(analysis) {
    if (!analysis) {
        console.log('[GENRE-TARGETS-UTIL] ⚠️ Analysis é null/undefined');
        return null;
    }

    // 🎯 PRIORIDADE 1: analysis.data.genreTargets (FONTE OFICIAL DO BACKEND)
    if (analysis.data?.genreTargets) {
        console.log('[GENRE-TARGETS-UTIL] ✅ Targets extraídos de analysis.data.genreTargets (OFICIAL)');
        console.log('[GENRE-TARGETS-UTIL] 📦 Keys:', Object.keys(analysis.data.genreTargets));
        return analysis.data.genreTargets;
    }

    // 🎯 PRIORIDADE 2: analysis.genreTargets (fallback)
    if (analysis.genreTargets) {
        console.log('[GENRE-TARGETS-UTIL] ✅ Targets extraídos de analysis.genreTargets (fallback)');
        console.log('[GENRE-TARGETS-UTIL] 📦 Keys:', Object.keys(analysis.genreTargets));
        return analysis.genreTargets;
    }

    // 🎯 PRIORIDADE 3: analysis.data.targets (fallback alternativo)
    if (analysis.data?.targets) {
        console.log('[GENRE-TARGETS-UTIL] ✅ Targets extraídos de analysis.data.targets (fallback alt)');
        console.log('[GENRE-TARGETS-UTIL] 📦 Keys:', Object.keys(analysis.data.targets));
        return analysis.data.targets;
    }

    console.log('[GENRE-TARGETS-UTIL] ❌ Nenhum target encontrado em analysis');
    console.log('[GENRE-TARGETS-UTIL] 🔍 Verificado:', {
        'analysis.data?.genreTargets': !!analysis.data?.genreTargets,
        'analysis.genreTargets': !!analysis.genreTargets,
        'analysis.data?.targets': !!analysis.data?.targets,
        'analysis.data': !!analysis.data,
        'analysis keys': Object.keys(analysis)
    });

    return null;
}

/**
 * 🎯 Carrega targets default (para modo gênero sem targets)
 * @returns {Object} - Targets padrão genéricos
 */
export function loadDefaultGenreTargets() {
    console.warn('[GENRE-TARGETS-UTIL] ⚠️ Usando targets DEFAULT (nenhum target específico disponível)');
    
    return {
        lufs_target: -14.0,
        tol_lufs: 2.0,
        true_peak_target: -1.0,
        tol_true_peak: 0.5,
        dr_target: 8.0,
        tol_dr: 2.0,
        lra_target: 6.0,
        tol_lra: 2.0,
        stereo_target: 0.7,
        tol_stereo: 0.2,
        bands: {
            sub: { target: 50, tolerance: 5 },
            bass: { target: 50, tolerance: 5 },
            low_mid: { target: 50, tolerance: 5 },
            mid: { target: 50, tolerance: 5 },
            high_mid: { target: 50, tolerance: 5 },
            presence: { target: 50, tolerance: 5 },
            brilliance: { target: 50, tolerance: 5 }
        }
    };
}

/**
 * 🎯 Extrai gênero da análise
 * @param {Object} analysis - Análise retornada do backend
 * @returns {string|null} - Nome do gênero ou null
 */
export function extractGenreFromAnalysis(analysis) {
    if (!analysis) {
        return null;
    }

    // Ordem de prioridade para extração de gênero
    const genre = analysis.data?.genre ||
                  analysis.genre ||
                  analysis.genreId ||
                  analysis.metadata?.genre ||
                  null;

    console.log('[GENRE-TARGETS-UTIL] 🎵 Gênero extraído:', genre);
    return genre;
}

/**
 * 🎯 Obtém targets completos com fallback para default
 * @param {Object} analysis - Análise retornada do backend
 * @returns {Object} - Targets (nunca null, usa default se necessário)
 */
export function getGenreTargetsWithFallback(analysis) {
    const targets = extractGenreTargetsFromAnalysis(analysis);
    
    if (targets) {
        console.log('[GENRE-TARGETS-UTIL] ✅ Usando targets do gênero:', extractGenreFromAnalysis(analysis));
        return targets;
    }

    console.warn('[GENRE-TARGETS-UTIL] ⚠️ Nenhum target disponível - usando DEFAULT');
    return loadDefaultGenreTargets();
}

/**
 * 🎯 Valida se targets são válidos
 * @param {Object} targets - Objeto de targets
 * @returns {boolean} - true se válido
 */
export function validateGenreTargets(targets) {
    if (!targets || typeof targets !== 'object') {
        console.warn('[GENRE-TARGETS-UTIL] ❌ Targets inválido (não é objeto)');
        return false;
    }

    // Verificar se tem pelo menos lufs_target ou bands
    const hasLufsTarget = targets.lufs_target !== null && targets.lufs_target !== undefined;
    const hasBands = targets.bands && typeof targets.bands === 'object' && Object.keys(targets.bands).length > 0;

    if (!hasLufsTarget && !hasBands) {
        console.warn('[GENRE-TARGETS-UTIL] ❌ Targets sem dados essenciais (sem lufs_target nem bands)');
        return false;
    }

    console.log('[GENRE-TARGETS-UTIL] ✅ Targets válido:', {
        hasLufsTarget,
        hasBands,
        bandsCount: hasBands ? Object.keys(targets.bands).length : 0
    });

    return true;
}

console.log('✅ Genre Targets Utils carregado');
