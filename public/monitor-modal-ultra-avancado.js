// 🎯 MONITOR MODAL - Detecta quando o modal de análise é exibido e verifica o sistema ultra-avançado

console.log('🎯 [MODAL_MONITOR] Monitor do modal carregado');

// Função para interceptar e monitorar o displayModalResults
function interceptarDisplayModalResults() {
    const safeAttachDisplayModal = () => {
        if (typeof window.displayModalResults !== 'function') {
            console.warn("[SAFE_INTERCEPT_WAIT] Aguardando função displayModalResults...");
            setTimeout(safeAttachDisplayModal, 300);
            return;
        }

        console.log('🎯 [MODAL_MONITOR] displayModalResults encontrada, interceptando...');
        
        const original = window.displayModalResults;
        window.displayModalResults = function(data) {
            console.log("[SAFE_INTERCEPT] displayModalResults interceptado (monitor-modal)", data);

            // 🔒 NÃO sobrescreve userAnalysis nem referenceAnalysis
            if (data?.mode === "reference" && data.userAnalysis && data.referenceAnalysis) {
                console.log("[SAFE_INTERCEPT] Preservando estrutura A/B");
                return original.call(this, data);
            }

            const merged = {
                ...data,
                userAnalysis: data.userAnalysis || window.__soundyState?.previousAnalysis,
                referenceAnalysis: data.referenceAnalysis || window.__soundyState?.referenceAnalysis || null,
            };

            // Logs de monitoramento
            console.log('🎯 [MODAL_MONITOR] Modal sendo exibido, dados recebidos:', {
                hasSuggestions: !!(merged && merged.suggestions),
                suggestionsCount: merged?.suggestions?.length || 0,
                hasUltraSystem: typeof window.AdvancedEducationalSuggestionSystem !== 'undefined'
            });
            
            // Verificar se as sugestões foram enriquecidas pelo sistema ultra-avançado
            if (merged && merged.suggestions && merged.suggestions.length > 0) {
                const firstSuggestion = merged.suggestions[0];
                const hasEducationalContent = !!(firstSuggestion.educationalContent);
                const hasEnhancedMetrics = !!(merged.enhancedMetrics?.ultraAdvancedSystem);
                
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
                    console.log('📊 [MODAL_MONITOR] Métricas do sistema ultra-avançado:', merged.enhancedMetrics.ultraAdvancedSystem);
                }
            } else {
                console.warn('⚠️ [MODAL_MONITOR] Nenhuma sugestão encontrada na análise');
            }
            
            // Chamar a função original com dados mesclados
            return original.call(this, merged);
        };
        
        console.log('✅ [MODAL_MONITOR] Interceptação ativa - monitorando próximas análises');
    };
    
    safeAttachDisplayModal();
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

// Aguardar carregamento e iniciar interceptação
window.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        console.log('🎯 [MODAL_MONITOR] Iniciando interceptação...');
        interceptarDisplayModalResults();
    }, 3000);
});

// Disponibilizar teste no console para debug
console.log('💡 [MODAL_MONITOR] Para testar manualmente, execute: testarSistemaUltraAvancadoManual()');

console.log('🎯 [MODAL_MONITOR] Monitor carregado e aguardando análises de áudio');