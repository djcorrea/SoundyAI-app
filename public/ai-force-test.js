// 🧪 TESTE FORÇADO - Exibição de Sugestões IA sem API Key
// Script para forçar a exibição da interface IA para validação

(function() {
    'use strict';
    
    console.log('🧪 [TESTE-FORÇA] Iniciando teste forçado da interface IA...');
    
    // Aguardar inicialização completa
    setTimeout(() => {
        if (window.aiUIController && window.currentModalAnalysis) {
            console.log('🧪 [TESTE-FORÇA] Forçando exibição com análise atual...');
            
            // Forçar exibição com sugestões base
            window.aiUIController.checkForAISuggestions(window.currentModalAnalysis);
            
            console.log('🧪 [TESTE-FORÇA] Interface IA forçada para exibição');
            
            // Também forçar configuração para mostrar seção
            const aiSection = document.getElementById('aiSuggestionsSection');
            if (aiSection) {
                aiSection.style.display = 'block';
                aiSection.classList.add('ai-fade-in');
                console.log('🧪 [TESTE-FORÇA] Seção IA forçada para visível');
            }
            
        } else {
            console.warn('🧪 [TESTE-FORÇA] Componentes não encontrados:', {
                aiUIController: !!window.aiUIController,
                currentModalAnalysis: !!window.currentModalAnalysis
            });
            
            // Tentar novamente em 2 segundos
            setTimeout(() => {
                if (window.aiUIController) {
                    // Criar análise mock para teste
                    const mockAnalysis = {
                        suggestions: [
                            {
                                title: 'Teste Base 1',
                                description: 'Sugestão de teste sem IA',
                                category: 'teste',
                                priority: 5,
                                original: 'Problema de teste detectado',
                                action: 'Aplicar correção de teste'
                            },
                            {
                                title: 'Teste Base 2', 
                                description: 'Segunda sugestão de teste',
                                category: 'teste',
                                priority: 7,
                                original: 'Outro problema detectado',
                                action: 'Segunda correção recomendada'
                            },
                            {
                                title: 'Teste Base 3',
                                description: 'Terceira sugestão para validação',
                                category: 'teste',
                                priority: 3,
                                original: 'Terceiro problema encontrado',
                                action: 'Terceira solução proposta'
                            }
                        ]
                    };
                    
                    console.log('🧪 [TESTE-FORÇA] Usando análise mock para teste');
                    window.aiUIController.checkForAISuggestions(mockAnalysis);
                    
                    // Forçar exibição visual
                    const aiSection = document.getElementById('aiSuggestionsSection');
                    if (aiSection) {
                        aiSection.style.display = 'block';
                        aiSection.classList.add('ai-fade-in');
                    }
                }
            }, 2000);
        }
        
    }, 3000);
    
    // Função global para teste manual
    window.forceShowAISuggestions = function() {
        console.log('🧪 [TESTE-MANUAL] Forçando exibição manual...');
        
        const mockAnalysis = {
            suggestions: [
                {
                    title: 'Manual Test 1',
                    description: 'Teste manual de sugestão',
                    category: 'manual',
                    priority: 8,
                    original: 'Problema detectado manualmente',
                    action: 'Solução manual recomendada'
                }
            ]
        };
        
        if (window.aiUIController) {
            window.aiUIController.checkForAISuggestions(mockAnalysis);
            
            // Garantir visibilidade
            const aiSection = document.getElementById('aiSuggestionsSection');
            if (aiSection) {
                aiSection.style.display = 'block';
                aiSection.classList.add('ai-fade-in');
                console.log('🧪 [TESTE-MANUAL] ✅ Interface IA exibida');
            }
        } else {
            console.error('🧪 [TESTE-MANUAL] ❌ aiUIController não encontrado');
        }
    };
    
    // Função para teste da configuração
    window.testAIConfig = function() {
        if (window.aiUIController) {
            window.aiUIController.showQuickConfig();
            console.log('🧪 [TESTE-CONFIG] Modal de configuração exibido');
        }
    };
    
    // Função para teste do modal full
    window.testAIFullModal = function() {
        if (window.aiUIController && window.aiUIController.currentSuggestions.length > 0) {
            window.aiUIController.openFullModal();
            console.log('🧪 [TESTE-MODAL] Modal full-screen exibido');
        } else {
            console.warn('🧪 [TESTE-MODAL] Sem sugestões para exibir no modal');
        }
    };
    
    console.log('🧪 [TESTE-FORÇA] Funções de teste disponíveis:');
    console.log('  - forceShowAISuggestions() - Força exibição manual');
    console.log('  - testAIConfig() - Testa modal de configuração');
    console.log('  - testAIFullModal() - Testa modal full-screen');
    
})();