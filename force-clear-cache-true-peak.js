// 🔄 FORÇAR LIMPEZA DE CACHE DE REFERÊNCIAS - TRUE-PEAK FIX
// Script para limpar todos os caches e forçar reload das referências

console.log('🔄 [CACHE-CLEAR] Iniciando limpeza completa de cache...');

// 1. Limpar cache de referências
if (typeof window !== 'undefined') {
    // Cache de referências por gênero
    if (window.__refDataCache) {
        console.log('🗑️ [CACHE-CLEAR] Limpando __refDataCache...');
        window.__refDataCache = {};
    }
    
    // Dados ativos de referência
    if (window.__activeRefData) {
        console.log('🗑️ [CACHE-CLEAR] Limpando __activeRefData...');
        window.__activeRefData = null;
    }
    
    // Gênero ativo
    if (window.__activeRefGenre) {
        console.log('🗑️ [CACHE-CLEAR] Limpando __activeRefGenre...');
        window.__activeRefGenre = null;
    }
    
    // Cache de análise de áudio
    if (window.__AUDIO_ANALYSIS_CACHE__) {
        console.log('🗑️ [CACHE-CLEAR] Limpando __AUDIO_ANALYSIS_CACHE__...');
        window.__AUDIO_ANALYSIS_CACHE__.clear();
    }
    
    // Cache determinístico
    if (window.__AUDIO_CACHE_DETERMINISTIC__) {
        console.log('🗑️ [CACHE-CLEAR] Limpando __AUDIO_CACHE_DETERMINISTIC__...');
        window.__AUDIO_CACHE_DETERMINISTIC__.clear();
    }
    
    // Flags para forçar bypass de cache
    console.log('🔧 [CACHE-CLEAR] Ativando flags de bypass...');
    window.REFS_BYPASS_CACHE = true;
    window.FORCE_RELOAD_REFS = true;
    window.CACHE_BYPASS_TRUE_PEAK_FIX = true;
    
    // Invalidar localStorage se existir
    try {
        if (localStorage.getItem('ai_synth_refs_cache')) {
            console.log('🗑️ [CACHE-CLEAR] Limpando localStorage refs...');
            localStorage.removeItem('ai_synth_refs_cache');
        }
    } catch (e) {
        console.warn('[CACHE-CLEAR] Erro ao limpar localStorage:', e);
    }
    
    // 2. Forçar reload das referências do gênero atual
    const currentGenre = window.PROD_AI_REF_GENRE || 'funk_mandela';
    console.log(`🔄 [CACHE-CLEAR] Forçando reload para gênero: ${currentGenre}`);
    
    // Se função loadReferenceData existir, chamar
    if (typeof window.loadReferenceData === 'function') {
        console.log('🔄 [CACHE-CLEAR] Chamando loadReferenceData...');
        window.loadReferenceData(currentGenre).then(() => {
            console.log('✅ [CACHE-CLEAR] Referencias recarregadas com sucesso!');
            
            // Verificar se o true_peak_target foi atualizado
            if (window.__activeRefData && window.__activeRefData.true_peak_target !== undefined) {
                console.log(`🎯 [CACHE-CLEAR] Novo true_peak_target: ${window.__activeRefData.true_peak_target} dBTP`);
                
                if (currentGenre === 'funk_mandela' && window.__activeRefData.true_peak_target === -0.8) {
                    console.log('✅ [CACHE-CLEAR] Funk corrigido para -0.8 dBTP!');
                } else if (window.__activeRefData.true_peak_target === -1.0) {
                    console.log('✅ [CACHE-CLEAR] Gênero corrigido para -1.0 dBTP!');
                } else {
                    console.warn(`⚠️ [CACHE-CLEAR] Valor ainda incorreto: ${window.__activeRefData.true_peak_target} dBTP`);
                }
            }
            
            // Triggerar atualização da UI se houver análise ativa
            if (window.__lastAnalysis) {
                console.log('🔄 [CACHE-CLEAR] Atualizando UI com novos valores...');
                if (typeof window.renderReferenceComparisons === 'function') {
                    window.renderReferenceComparisons(window.__lastAnalysis);
                }
            }
            
        }).catch(error => {
            console.error('❌ [CACHE-CLEAR] Erro ao recarregar referências:', error);
        });
    }
    
    // 3. Se há função de atualização de interface, chamar
    if (typeof window.updateReferenceDisplay === 'function') {
        console.log('🔄 [CACHE-CLEAR] Atualizando display de referências...');
        window.updateReferenceDisplay();
    }
    
    console.log('✅ [CACHE-CLEAR] Limpeza de cache concluída!');
    console.log('💡 [CACHE-CLEAR] Agora faça upload de um arquivo para ver os novos valores');
    
} else {
    console.error('❌ [CACHE-CLEAR] Contexto window não disponível');
}

// Exportar função para uso manual
if (typeof window !== 'undefined') {
    window.forceClearCacheAndReload = () => {
        location.reload();
    };
    
    console.log('💡 [CACHE-CLEAR] Use window.forceClearCacheAndReload() para reload completo da página');
}
