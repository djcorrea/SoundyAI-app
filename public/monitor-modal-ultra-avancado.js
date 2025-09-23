// 🎯 MONITOR MODAL - Detecta quando o modal de análise é exibido e verifica o sistema ultra-avançado

console.log('🎯 [MODAL_MONITOR] Monitor do modal carregado');

// Função para interceptar e monitorar o displayModalResults
function interceptarDisplayModalResults() {
    // Aguardar o script de integração carregar
    const aguardarScript = setInterval(() => {
        if (typeof window.displayModalResults === 'function') {
            clearInterval(aguardarScript);
            console.log('🎯 [MODAL_MONITOR] displayModalResults encontrada, interceptando...');
            
            // Fazer backup da função original
            const originalDisplayModalResults = window.displayModalResults;
            
            // Substituir pela versão monitorada
            window.displayModalResults = function(analysis) {
                console.log('🎯 [MODAL_MONITOR] Modal sendo exibido, dados recebidos:', {
                    hasSuggestions: !!(analysis && analysis.suggestions),
                    suggestionsCount: analysis?.suggestions?.length || 0,
                    hasUltraSystem: typeof window.AdvancedEducationalSuggestionSystem !== 'undefined'
                });
                
                // Verificar se as sugestões foram enriquecidas pelo sistema ultra-avançado
                if (analysis && analysis.suggestions && analysis.suggestions.length > 0) {
                    const firstSuggestion = analysis.suggestions[0];
                    const hasEducationalContent = !!(firstSuggestion.educationalContent);
                    const hasEnhancedMetrics = !!(analysis.enhancedMetrics?.ultraAdvancedSystem);
                    
                    console.log('🔍 [MODAL_MONITOR] Análise das sugestões:', {
                        firstSuggestion: firstSuggestion,
                        hasEducationalContent: hasEducationalContent,
                        hasEnhancedMetrics: hasEnhancedMetrics,
                        ultraSystemApplied: hasEnhancedMetrics
                    });
                    
                    if (hasEducationalContent) {
                        console.log('🎉 [MODAL_MONITOR] ✅ SISTEMA ULTRA-AVANÇADO FUNCIONANDO!');
                        console.log('📚 Conteúdo educacional detectado:', firstSuggestion.educationalContent);
                    } else {
                        console.warn('⚠️ [MODAL_MONITOR] Sistema ultra-avançado não aplicou conteúdo educacional');
                    }
                    
                    if (hasEnhancedMetrics) {
                        console.log('📊 [MODAL_MONITOR] Métricas do sistema ultra-avançado:', analysis.enhancedMetrics.ultraAdvancedSystem);
                    }
                } else {
                    console.warn('⚠️ [MODAL_MONITOR] Nenhuma sugestão encontrada na análise');
                }
                
                // Chamar a função original
                return originalDisplayModalResults.call(this, analysis);
            };
            
            console.log('✅ [MODAL_MONITOR] Interceptação ativa - monitorando próximas análises');
            
        } else if (typeof window.audio_analyzer_integration !== 'undefined') {
            // Tentar encontrar a função no namespace
            console.log('🔍 [MODAL_MONITOR] Procurando displayModalResults em namespace...');
        }
    }, 1000);
    
    // Timeout de segurança
    setTimeout(() => {
        clearInterval(aguardarScript);
        console.log('⏰ [MODAL_MONITOR] Timeout - função displayModalResults não encontrada');
    }, 10000);
}

// Função para testar manualmente se o sistema está funcionando
window.testarSistemaUltraAvancadoManual = function() {
    console.log('🧪 [MODAL_MONITOR] Executando teste manual do sistema...');
    
    // Dados simulados de análise
    const testAnalysis = {
        suggestions: [
            {
                type: 'surgical_eq',
                subtype: 'sibilance',
                message: 'Teste manual de sibilância',
                action: 'Aplicar corte cirúrgico de teste',
                explanation: 'Teste de explicação',
                frequency_range: '6000-7000Hz',
                adjustment_db: -3.0,
                priority: 8,
                confidence: 0.85
            }
        ],
        lufs: -16.5,
        truePeak: -1.8,
        lra: 6.2,
        detectedGenre: 'electronic',
        sampleRate: 48000,
        duration: 180,
        channels: 2
    };
    
    if (typeof window.AdvancedEducationalSuggestionSystem !== 'undefined') {
        try {
            const ultraSystem = new window.AdvancedEducationalSuggestionSystem();
            
            const contextData = {
                originalAnalysis: testAnalysis,
                audioData: {
                    sampleRate: testAnalysis.sampleRate,
                    duration: testAnalysis.duration,
                    channels: testAnalysis.channels
                },
                metrics: {
                    lufs: testAnalysis.lufs,
                    truePeak: testAnalysis.truePeak,
                    lra: testAnalysis.lra
                },
                userLevel: 'intermediate',
                preferredDAW: 'multi',
                musicGenre: testAnalysis.detectedGenre
            };
            
            console.log('🚀 [MODAL_MONITOR] Aplicando sistema ultra-avançado nos dados de teste...');
            const resultado = ultraSystem.generateAdvancedSuggestions(testAnalysis.suggestions, contextData);
            
            if (resultado && resultado.enhancedSuggestions && resultado.enhancedSuggestions.length > 0) {
                console.log('✅ [MODAL_MONITOR] TESTE MANUAL PASSOU!');
                console.log('📚 Sugestões enriquecidas:', resultado.enhancedSuggestions);
                console.log('📊 Confidence:', resultado.confidenceScore);
                console.log('🎓 Educational Level:', resultado.educationalLevel);
                
                // Simular exibição no modal
                testAnalysis.suggestions = resultado.enhancedSuggestions;
                testAnalysis.enhancedMetrics = {
                    ultraAdvancedSystem: {
                        applied: true,
                        confidenceScore: resultado.confidenceScore,
                        educationalLevel: resultado.educationalLevel,
                        enhancedCount: resultado.enhancedSuggestions.length
                    }
                };
                
                if (typeof window.displayModalResults === 'function') {
                    console.log('🎭 [MODAL_MONITOR] Exibindo modal com dados enriquecidos...');
                    window.displayModalResults(testAnalysis);
                } else {
                    console.warn('⚠️ [MODAL_MONITOR] displayModalResults não encontrada para teste visual');
                }
                
                return true;
            } else {
                console.error('❌ [MODAL_MONITOR] TESTE MANUAL FALHOU - Sistema não retornou sugestões');
                return false;
            }
            
        } catch (error) {
            console.error('❌ [MODAL_MONITOR] Erro no teste manual:', error);
            return false;
        }
    } else {
        console.error('❌ [MODAL_MONITOR] Sistema Ultra-Avançado não disponível para teste');
        return false;
    }
};

// ❌ DESABILITADO: Monitor para evitar conflitos e loops
// Aguardar carregamento e iniciar interceptação
// window.addEventListener('DOMContentLoaded', function() {
//     setTimeout(() => {
//         console.log('🎯 [MODAL_MONITOR] Iniciando interceptação...');
//         interceptarDisplayModalResults();
//     }, 3000);
// });

// Disponibilizar teste no console para debug
console.log('💡 [MODAL_MONITOR] DESABILITADO - Para testar manualmente, execute: testarSistemaUltraAvancadoManual()');

console.log('🎯 [MODAL_MONITOR] Monitor desabilitado para evitar loops');