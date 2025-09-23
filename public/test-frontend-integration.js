// test-frontend-integration.js - Teste rápido do fluxo modificado

console.log('🧪 [TEST] Iniciando teste do sistema modificado...');

// Verificar se as modificações estão funcionando
setTimeout(() => {
    console.log('🧪 [TEST] Verificando sistema...');
    
    // Verificar feature flag
    console.log('🚩 AI_ENRICH_ENABLED:', window.AI_ENRICH_ENABLED);
    
    // Verificar se ai-suggestion-layer tem a nova função
    if (window.aiSuggestionLayer && typeof window.aiSuggestionLayer.fetchEnrichedSuggestions === 'function') {
        console.log('✅ [TEST] fetchEnrichedSuggestions encontrada no ai-suggestion-layer');
    } else {
        console.log('❌ [TEST] fetchEnrichedSuggestions NÃO encontrada');
    }
    
    // Verificar se ai-suggestion-ui-controller tem o novo método
    if (window.aiUIController && typeof window.aiUIController.displayEnrichedSuggestionsInPurpleModal === 'function') {
        console.log('✅ [TEST] displayEnrichedSuggestionsInPurpleModal encontrada no ai-suggestion-ui-controller');
    } else {
        console.log('❌ [TEST] displayEnrichedSuggestionsInPurpleModal NÃO encontrada');
    }
    
    // Verificar se containers estão corretos
    const simpleContainer = document.getElementById('aiSuggestionsExpanded');
    const purpleModal = document.getElementById('aiSuggestionsFullModal');
    
    console.log('🧪 [TEST] Container simples (deve estar oculto):', simpleContainer?.style.display);
    console.log('🧪 [TEST] Modal roxo (deve existir):', purpleModal ? 'existe' : 'NÃO existe');
    
}, 2000);

// Expor função de teste para simular análise
window.testEnrichmentFlow = async function() {
    console.log('🧪 [TEST] Simulando fluxo de enriquecimento...');
    
    const mockSuggestions = [
        {
            id: 'test_1',
            message: 'Baixo muito forte na faixa de 80Hz',
            type: 'frequency_adjustment',
            band: 'sub_bass',
            issue: 'excessive_energy'
        },
        {
            id: 'test_2', 
            message: 'Compressão excessiva detectada',
            type: 'dynamics',
            issue: 'over_compression'
        }
    ];
    
    if (window.aiSuggestionLayer) {
        try {
            const result = await window.aiSuggestionLayer.fetchEnrichedSuggestions(mockSuggestions);
            console.log('🧪 [TEST] Resultado do enriquecimento:', result);
            
            if (window.aiUIController) {
                window.aiUIController.displayEnrichedSuggestionsInPurpleModal(result.suggestions, {}, result.ok);
            }
        } catch (error) {
            console.error('🧪 [TEST] Erro no teste:', error);
        }
    } else {
        console.error('🧪 [TEST] aiSuggestionLayer não disponível');
    }
};

console.log('🧪 [TEST] Para testar o fluxo manualmente, execute: testEnrichmentFlow()');