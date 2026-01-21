// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

/**
 * 🎯 GENRE TARGETS UTILS - FONTE ÚNICA DE VERDADE
 * ====================================================
 * Este módulo centraliza TODA a lógica de extração de genre targets.
 * 
 * ESTRUTURA ACEITA:
 * - results.data.genreTargets (backend/worker/postgres)
 * - analysis.data.genreTargets (frontend)
 * 
 * FALLBACKS AUTOMÁTICOS:
 * - window.__activeRefData
 * - window.PROD_AI_REF_DATA[genre]
 * 
 * Esta função NUNCA retorna undefined ou null em modo genre.
 * Sempre retorna targets válidos usando fallbacks se necessário.
 */

/**
 * 🎯 EXTRAI TARGETS DO GÊNERO - FUNÇÃO DEFINITIVA E ROBUSTA
 * 
 * @param {Object} source - Objeto results (backend) ou analysis (frontend)
 * @returns {Object|null} Targets do gênero (null apenas se não for modo genre)
 */
export function extractGenreTargets(source) {
    log('[EXTRACT-TARGETS] 🔍 Iniciando extração de targets');
    
    // ═══════════════════════════════════════════════════════════════
    // ETAPA 1: IDENTIFICAR SE É MODO GENRE
    // ═══════════════════════════════════════════════════════════════
    const mode = source?.mode || source?.data?.mode || 'unknown';
    
    if (mode !== "genre") {
        log('[EXTRACT-TARGETS] ⚠️ Não é modo genre, retornando null');
        return null;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ETAPA 2: EXTRAIR GÊNERO
    // ═══════════════════════════════════════════════════════════════
    const genre = source?.data?.genre || 
                  source?.genre || 
                  source?.metadata?.genre || 
                  'unknown';
    
    log('[EXTRACT-TARGETS] Gênero identificado:', genre);
    
    // ═══════════════════════════════════════════════════════════════
    // ETAPA 3: BUSCAR TARGETS NA ORDEM DE PRIORIDADE
    // ═══════════════════════════════════════════════════════════════
    let targets = null;
    let targetSource = null;
    
    // 🎯 PRIORIDADE 1: source.data.genreTargets (BACKEND/FRONTEND OFICIAL)
    if (source?.data?.genreTargets && typeof source.data.genreTargets === 'object') {
        targets = source.data.genreTargets;
        targetSource = 'source.data.genreTargets (OFICIAL)';
    }
    // 🎯 PRIORIDADE 2: source.genreTargets
    else if (source?.genreTargets && typeof source.genreTargets === 'object') {
        targets = source.genreTargets;
        targetSource = 'source.genreTargets';
    }
    // 🎯 PRIORIDADE 3: source.targets
    else if (source?.targets && typeof source.targets === 'object') {
        targets = source.targets;
        targetSource = 'source.targets';
    }
    // 🎯 PRIORIDADE 4: source.data.targets
    else if (source?.data?.targets && typeof source.data.targets === 'object') {
        targets = source.data.targets;
        targetSource = 'source.data.targets';
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ETAPA 4: VALIDAR E RETORNAR SE ENCONTRADO
    // ═══════════════════════════════════════════════════════════════
    if (targets && isValidTargets(targets)) {
        log('[EXTRACT-TARGETS] ✅ Targets encontrados em:', targetSource);
        return targets;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ETAPA 5: FALLBACK 1 - window.__activeRefData
    // ═══════════════════════════════════════════════════════════════
    warn('[EXTRACT-TARGETS] ⚠️ Targets não encontrados, usando fallback');
    
    if (typeof window !== 'undefined' && window.__activeRefData) {
        const activeData = window.__activeRefData;
        const activeGenre = activeData.genre || activeData.data?.genre;
        
        if (activeGenre === genre || !activeGenre) {
            log('[EXTRACT-TARGETS] ✅ Usando window.__activeRefData');
            return activeData.targets || activeData.data?.genreTargets || activeData;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ETAPA 6: FALLBACK 2 - window.PROD_AI_REF_DATA[genre]
    // ═══════════════════════════════════════════════════════════════
    if (typeof window !== 'undefined' && 
        typeof window.PROD_AI_REF_DATA !== 'undefined' && 
        window.PROD_AI_REF_DATA[genre]) {
        
        log('[EXTRACT-TARGETS] ✅ Usando window.PROD_AI_REF_DATA[' + genre + ']');
        return window.PROD_AI_REF_DATA[genre];
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ETAPA 7: FALLBACK 3 - window.PROD_AI_REF_DATA (objeto único)
    // ═══════════════════════════════════════════════════════════════
    if (typeof window !== 'undefined' && 
        typeof window.PROD_AI_REF_DATA === 'object' &&
        (window.PROD_AI_REF_DATA.bands || window.PROD_AI_REF_DATA.legacy_compatibility)) {
        
        log('[EXTRACT-TARGETS] ✅ Usando window.PROD_AI_REF_DATA (objeto único)');
        return window.PROD_AI_REF_DATA;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ETAPA 8: ESTRUTURA VAZIA VÁLIDA (ÚLTIMO RECURSO)
    // ═══════════════════════════════════════════════════════════════
    error('[EXTRACT-TARGETS] ❌ CRÍTICO: Nenhum target encontrado');
    warn('[EXTRACT-TARGETS] ⚠️ Retornando estrutura vazia válida');
    
    return {
        lufs: { target: -14, tolerance: 1 },
        truePeak: { target: -1, tolerance: 0.5 },
        dr: { target: 8, tolerance: 2 },
        stereo: { target: 100, tolerance: 10 },
        bands: {}
    };
}

/**
 * Valida se a estrutura de targets é válida
 */
function isValidTargets(targets) {
    if (!targets || typeof targets !== 'object') {
        return false;
    }
    
    return targets.lufs || targets.truePeak || targets.dr || targets.bands || targets.legacy_compatibility;
}

/**
 * Extrai gênero de uma análise
 * @param {Object} analysis - Objeto de análise normalizado
 * @returns {string|null} Nome do gênero ou null
 */
export function extractGenre(analysis) {
    log('[GENRE-TARGETS-UTILS] 🎵 Extraindo gênero da análise');
    
    // 🎯 PRIORIDADE 1: analysis.data.genre (BACKEND OFICIAL)
    if (analysis?.data?.genre) {
        log('[GENRE-TARGETS-UTILS] ✅ Gênero encontrado em analysis.data.genre:', analysis.data.genre);
        return analysis.data.genre;
    }
    
    // 🎯 PRIORIDADE 2: analysis.genre (fallback direto)
    if (analysis?.genre) {
        log('[GENRE-TARGETS-UTILS] ⚠️ Gênero encontrado em analysis.genre (fallback):', analysis.genre);
        return analysis.genre;
    }
    
    // 🎯 PRIORIDADE 3: analysis.metadata.genre
    if (analysis?.metadata?.genre) {
        log('[GENRE-TARGETS-UTILS] ⚠️ Gênero encontrado em analysis.metadata.genre (fallback):', analysis.metadata.genre);
        return analysis.metadata.genre;
    }
    
    warn('[GENRE-TARGETS-UTILS] ❌ Nenhum gênero encontrado na análise');
    return null;
}

/**
 * Carrega targets default do localStorage ou JSON
 * @param {string} genreName - Nome do gênero
 * @returns {Promise<Object|null>} Targets default ou null
 */
export async function loadDefaultGenreTargets(genreName = 'default') {
    log('[GENRE-TARGETS-UTILS] 📥 Carregando targets default para:', genreName);
    
    try {
        // Tentar carregar do localStorage
        const cached = localStorage.getItem(`genre-targets-${genreName}`);
        if (cached) {
            log('[GENRE-TARGETS-UTILS] ✅ Targets carregados do localStorage');
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
            log('[GENRE-TARGETS-UTILS] ✅ Targets carregados do JSON');
            // Cachear no localStorage
            localStorage.setItem(`genre-targets-${genreName}`, JSON.stringify(targets));
            return targets;
        }
        
        warn('[GENRE-TARGETS-UTILS] ❌ Targets não encontrados no JSON');
        return null;
        
    } catch (error) {
        error('[GENRE-TARGETS-UTILS] ❌ Erro ao carregar targets default:', error.message);
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
        warn('[GENRE-TARGETS-UTILS] ⚠️ Targets não têm bandas esperadas:', Object.keys(targets));
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
    
    warn('[GENRE-TARGETS-UTILS] ⚠️ Não foi possível normalizar targets:', targets);
    return targets;
}

log('✅ Genre Targets Utils carregado');
