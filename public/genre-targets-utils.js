/**
 * 🎯 GENRE TARGETS UTILS - FONTE ÚNICA DE VERDADE
 * ====================================================
 * Este módulo centraliza TODA a lógica de extração de genre targets.
 * 
 * ❌ NUNCA mais acessar:
 *    - analysis.result.genreTargets
 *    - analysis.results.*
 *    - analysis.scoring.genre
 *    - globalGenreState.targets
 * 
 * ✅ SEMPRE usar extractGenreTargets(analysis)
 * 
 * HIERARQUIA DE PRIORIDADE:
 * 1. analysis.data.genreTargets (FONTE OFICIAL DO BACKEND)
 * 2. analysis.genreTargets (fallback direto)
 * 3. analysis.data.targets (nomenclatura alternativa)
 * 4. null (sem targets - carrega default)
 */

/**
 * Extrai genre targets de uma análise
 * @param {Object} analysis - Objeto de análise normalizado
 * @returns {Object|null} Targets do gênero ou null
 */
export function extractGenreTargets(analysis) {
    console.log('[GENRE-TARGETS-UTILS] 🔍 Extraindo targets da análise');
    
    // 🎯 PRIORIDADE 1: analysis.data.genreTargets (BACKEND OFICIAL)
    if (analysis?.data?.genreTargets) {
        console.log('[GENRE-TARGETS-UTILS] ✅ Targets encontrados em analysis.data.genreTargets');
        console.log('[GENRE-TARGETS-UTILS] Keys:', Object.keys(analysis.data.genreTargets));
        return analysis.data.genreTargets;
    }
    
    // 🎯 PRIORIDADE 2: analysis.genreTargets (fallback direto)
    if (analysis?.genreTargets) {
        console.log('[GENRE-TARGETS-UTILS] ⚠️ Targets encontrados em analysis.genreTargets (fallback)');
        console.log('[GENRE-TARGETS-UTILS] Keys:', Object.keys(analysis.genreTargets));
        return analysis.genreTargets;
    }
    
    // 🎯 PRIORIDADE 3: analysis.data.targets (nomenclatura alternativa)
    if (analysis?.data?.targets) {
        console.log('[GENRE-TARGETS-UTILS] ⚠️ Targets encontrados em analysis.data.targets (nomenclatura antiga)');
        console.log('[GENRE-TARGETS-UTILS] Keys:', Object.keys(analysis.data.targets));
        return analysis.data.targets;
    }
    
    console.warn('[GENRE-TARGETS-UTILS] ❌ Nenhum target encontrado na análise');
    console.warn('[GENRE-TARGETS-UTILS] analysis.data:', analysis?.data);
    console.warn('[GENRE-TARGETS-UTILS] analysis.genreTargets:', analysis?.genreTargets);
    return null;
}

/**
 * Extrai gênero de uma análise
 * @param {Object} analysis - Objeto de análise normalizado
 * @returns {string|null} Nome do gênero ou null
 */
export function extractGenre(analysis) {
    console.log('[GENRE-TARGETS-UTILS] 🎵 Extraindo gênero da análise');
    
    // 🎯 PRIORIDADE 1: analysis.data.genre (BACKEND OFICIAL)
    if (analysis?.data?.genre) {
        console.log('[GENRE-TARGETS-UTILS] ✅ Gênero encontrado em analysis.data.genre:', analysis.data.genre);
        return analysis.data.genre;
    }
    
    // 🎯 PRIORIDADE 2: analysis.genre (fallback direto)
    if (analysis?.genre) {
        console.log('[GENRE-TARGETS-UTILS] ⚠️ Gênero encontrado em analysis.genre (fallback):', analysis.genre);
        return analysis.genre;
    }
    
    // 🎯 PRIORIDADE 3: analysis.metadata.genre
    if (analysis?.metadata?.genre) {
        console.log('[GENRE-TARGETS-UTILS] ⚠️ Gênero encontrado em analysis.metadata.genre (fallback):', analysis.metadata.genre);
        return analysis.metadata.genre;
    }
    
    console.warn('[GENRE-TARGETS-UTILS] ❌ Nenhum gênero encontrado na análise');
    return null;
}

/**
 * Carrega targets default do localStorage ou JSON
 * @param {string} genreName - Nome do gênero
 * @returns {Promise<Object|null>} Targets default ou null
 */
export async function loadDefaultGenreTargets(genreName = 'default') {
    console.log('[GENRE-TARGETS-UTILS] 📥 Carregando targets default para:', genreName);
    
    try {
        // Tentar carregar do localStorage
        const cached = localStorage.getItem(`genre-targets-${genreName}`);
        if (cached) {
            console.log('[GENRE-TARGETS-UTILS] ✅ Targets carregados do localStorage');
            return JSON.parse(cached);
        }
        
        // Tentar carregar do JSON
        const response = await fetch('/api/genre-targets.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const targets = data[genreName] || data.default || null;
        
        if (targets) {
            console.log('[GENRE-TARGETS-UTILS] ✅ Targets carregados do JSON');
            // Cachear no localStorage
            localStorage.setItem(`genre-targets-${genreName}`, JSON.stringify(targets));
            return targets;
        }
        
        console.warn('[GENRE-TARGETS-UTILS] ❌ Targets não encontrados no JSON');
        return null;
        
    } catch (error) {
        console.error('[GENRE-TARGETS-UTILS] ❌ Erro ao carregar targets default:', error.message);
        return null;
    }
}

/**
 * Valida se targets têm estrutura correta
 * @param {Object} targets - Objeto de targets
 * @returns {boolean} true se válido
 */
export function validateGenreTargets(targets) {
    if (!targets || typeof targets !== 'object') {
        return false;
    }
    
    // Verificar se tem pelo menos algumas bandas esperadas
    const expectedBands = ['sub', 'bass', 'low_mid', 'mid', 'high_mid', 'presence', 'brilliance'];
    const hasAnyBand = expectedBands.some(band => targets[band] !== undefined);
    
    if (!hasAnyBand) {
        console.warn('[GENRE-TARGETS-UTILS] ⚠️ Targets não têm bandas esperadas:', Object.keys(targets));
        return false;
    }
    
    return true;
}

/**
 * Normaliza targets para estrutura padrão
 * @param {Object} targets - Targets brutos
 * @returns {Object} Targets normalizados
 */
export function normalizeGenreTargets(targets) {
    if (!targets) return null;
    
    // Se já está normalizado, retornar
    if (validateGenreTargets(targets)) {
        return targets;
    }
    
    // Tentar extrair de estruturas aninhadas
    if (targets.bands) {
        return targets.bands;
    }
    
    if (targets.spectral_bands) {
        return targets.spectral_bands;
    }
    
    if (targets.hybrid_processing?.spectral_bands) {
        return targets.hybrid_processing.spectral_bands;
    }
    
    console.warn('[GENRE-TARGETS-UTILS] ⚠️ Não foi possível normalizar targets:', targets);
    return targets;
}

console.log('✅ Genre Targets Utils carregado');
