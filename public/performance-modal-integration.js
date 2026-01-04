/**
 * 🔧 PERFORMANCE MODAL INTEGRATION
 * 
 * Este arquivo integra as otimizações de performance com o código existente
 * sem quebrar nada. Intercepta funções existentes e aplica otimizações.
 * 
 * INTEGRAÇÃO SEGURA:
 * ✅ Intercepta renderizações existentes
 * ✅ Mantém compatibilidade 100%
 * ✅ Fallback se otimizações falharem
 * ✅ Não altera comportamento visual
 */

class PerformanceModalIntegration {
    constructor() {
        this.originalFunctions = {};
        this.isInitialized = false;
        this.performanceOptimizer = window.modalPerformanceOptimizer;
        
        this.init();
    }
    
    init() {
        // Aguardar DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }
    
    setup() {
        console.log('🔧 Iniciando integração de performance modal...');
        
        // Interceptar funções de modal
        this.interceptModalFunctions();
        
        // Interceptar renderização de tabelas
        this.interceptTableRendering();
        
        // Interceptar renderização de cards IA
        this.interceptAICardsRendering();
        
        // Setup de observers
        this.setupDOMObservers();
        
        this.isInitialized = true;
        console.log('✅ Performance modal integration ativa');
    }
    
    interceptModalFunctions() {
        // Interceptar abertura do modal de análise
        if (window.showAudioAnalysisModal) {
            this.originalFunctions.showAudioAnalysisModal = window.showAudioAnalysisModal;
            window.showAudioAnalysisModal = (...args) => {
                this.handleModalOpen();
                return this.originalFunctions.showAudioAnalysisModal.apply(this, args);
            };
        }
        
        // Interceptar fechamento do modal
        if (window.closeAudioModal) {
            this.originalFunctions.closeAudioModal = window.closeAudioModal;
            window.closeAudioModal = (...args) => {
                this.handleModalClose();
                return this.originalFunctions.closeAudioModal.apply(this, args);
            };
        }
        
        // Interceptar display de resultados
        if (window.displayAnalysisResultsInModal) {
            this.originalFunctions.displayAnalysisResultsInModal = window.displayAnalysisResultsInModal;
            window.displayAnalysisResultsInModal = (...args) => {
                const result = this.originalFunctions.displayAnalysisResultsInModal.apply(this, args);
                this.handleResultsDisplayed();
                return result;
            };
        }
        
        console.log('🔧 Funções de modal interceptadas');
    }
    
    interceptTableRendering() {
        // Interceptar renderização de tabelas de comparação
        if (window.renderGenreComparisonTable) {
            this.originalFunctions.renderGenreComparisonTable = window.renderGenreComparisonTable;
            window.renderGenreComparisonTable = (...args) => {
                const startTime = performance.now();
                const result = this.originalFunctions.renderGenreComparisonTable.apply(this, args);
                
                // Aplicar virtual scroll se tabela grande
                setTimeout(() => {
                    this.optimizeTableIfNeeded();
                    const endTime = performance.now();
                    console.log(`📊 Tabela renderizada e otimizada em ${(endTime - startTime).toFixed(2)}ms`);
                }, 0);
                
                return result;
            };
        }
        
        // Interceptar outras funções de tabela
        const tableFunctions = [
            'createComparisonTable',
            'renderReferenceTable',
            'displayComparisonResults'
        ];
        
        tableFunctions.forEach(funcName => {
            if (window[funcName]) {
                this.originalFunctions[funcName] = window[funcName];
                window[funcName] = (...args) => {
                    const result = this.originalFunctions[funcName].apply(this, args);
                    setTimeout(() => this.optimizeTableIfNeeded(), 0);
                    return result;
                };
            }
        });
        
        console.log('📊 Funções de tabela interceptadas');
    }
    
    interceptAICardsRendering() {
        // Interceptar sistema de sugestões IA
        if (window.AISuggestionsIntegration && window.AISuggestionsIntegration.prototype.displaySuggestions) {
            const originalDisplay = window.AISuggestionsIntegration.prototype.displaySuggestions;
            const integration = this; // closure para acessar a instância da integração

            window.AISuggestionsIntegration.prototype.displaySuggestions = function(...args) {
                const startTime = performance.now();
                const result = originalDisplay.apply(this, args);

                // Aplicar render progressivo assincronamente; usar `integration` para chamar utilitários
                setTimeout(() => {
                    try {
                        integration.optimizeAICardsIfNeeded();
                        const endTime = performance.now();
                        console.log(`🤖 Cards IA renderizados e otimizados em ${(endTime - startTime).toFixed(2)}ms`);
                    } catch (e) {
                        console.warn('⚠️ Erro ao otimizar cards IA (async):', e);
                    }
                }, 0);

                return result;
            };
        }
        
        // Interceptar outras funções de cards
        const cardFunctions = [
            'renderAISuggestions',
            'displaySuggestionsGrid',
            'createSuggestionCard'
        ];
        
        cardFunctions.forEach(funcName => {
            if (window[funcName]) {
                this.originalFunctions[funcName] = window[funcName];
                window[funcName] = (...args) => {
                    const result = this.originalFunctions[funcName].apply(this, args);
                    setTimeout(() => this.optimizeAICardsIfNeeded(), 0);
                    return result;
                };
            }
        });
        
        console.log('🤖 Funções de cards IA interceptadas');
    }
    
    setupDOMObservers() {
        // Observer para detectar mudanças no DOM do modal
        const modalObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.handleNewContent(node);
                        }
                    });
                }
            });
        });
        
        // Observar container de resultados
        const modalResults = document.getElementById('audioAnalysisResults');
        if (modalResults) {
            modalObserver.observe(modalResults, {
                childList: true,
                subtree: true
            });
        }
        
        // Observer para tabelas especificamente
        const tableObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const tables = node.querySelectorAll?.('.classic-genre-table') || [];
                        if (tables.length > 0 || node.classList?.contains('classic-genre-table')) {
                            setTimeout(() => this.optimizeTableIfNeeded(), 50);
                        }
                    }
                });
            });
        });
        
        const referenceContainer = document.getElementById('referenceComparisons');
        if (referenceContainer) {
            tableObserver.observe(referenceContainer, {
                childList: true,
                subtree: true
            });
        } else {
            // Observer global para detectar criação do container
            const globalObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.id === 'referenceComparisons') {
                            tableObserver.observe(node, {
                                childList: true,
                                subtree: true
                            });
                        }
                    });
                });
            });
            
            globalObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
        
        console.log('👁️ DOM observers configurados');
    }
    
    handleModalOpen() {
        try {
            if (this.performanceOptimizer) {
                this.performanceOptimizer.handleModalOpenStart();
            }
            
            // Aplicar classes CSS de performance
            const modal = document.getElementById('audioAnalysisModal');
            if (modal) {
                modal.classList.add('modal-opening');
                modal.style.willChange = 'transform, opacity';
                
                // Remover will-change após animação
                setTimeout(() => {
                    modal.style.willChange = 'auto';
                    modal.classList.add('animation-complete');
                }, 300);
            }
            
        } catch (error) {
            console.warn('⚠️ Erro ao otimizar abertura do modal:', error);
        }
    }
    
    handleModalClose() {
        try {
            if (this.performanceOptimizer) {
                this.performanceOptimizer.handleModalClose();
            }
            
            // Aplicar animação de fechamento
            const modal = document.getElementById('audioAnalysisModal');
            if (modal) {
                modal.classList.remove('modal-opening', 'animation-complete');
                modal.classList.add('modal-closing');
                modal.style.willChange = 'transform, opacity';
                
                // Cleanup após animação
                setTimeout(() => {
                    modal.style.willChange = 'auto';
                    modal.classList.remove('modal-closing');
                }, 250);
            }
            
        } catch (error) {
            console.warn('⚠️ Erro ao otimizar fechamento do modal:', error);
        }
    }
    
    handleResultsDisplayed() {
        try {
            // Aguardar um frame para garantir que DOM foi atualizado
            requestAnimationFrame(() => {
                this.optimizeTableIfNeeded();
                this.optimizeAICardsIfNeeded();
                
                if (this.performanceOptimizer) {
                    this.performanceOptimizer.handleModalOpenEnd();
                }
            });
            
        } catch (error) {
            console.warn('⚠️ Erro ao otimizar exibição de resultados:', error);
        }
    }
    
    handleNewContent(node) {
        try {
            // Verificar se é tabela
            const tables = node.querySelectorAll?.('.classic-genre-table') || 
                          (node.classList?.contains('classic-genre-table') ? [node] : []);
            
            if (tables.length > 0) {
                setTimeout(() => this.optimizeTableIfNeeded(), 0);
            }
            
            // Verificar se são cards IA
            const aiGrids = node.querySelectorAll?.('.ai-suggestions-grid') ||
                           (node.classList?.contains('ai-suggestions-grid') ? [node] : []);
            
            if (aiGrids.length > 0) {
                setTimeout(() => this.optimizeAICardsIfNeeded(), 0);
            }
            
            // Verificar cards individuais
            const cards = node.querySelectorAll?.('.suggestion-card, .ai-suggestion-card') || [];
            if (cards.length > 5) {
                setTimeout(() => this.optimizeAICardsIfNeeded(), 0);
            }
            
        } catch (error) {
            console.warn('⚠️ Erro ao processar novo conteúdo:', error);
        }
    }
    
    optimizeTableIfNeeded() {
        try {
            const tables = document.querySelectorAll('.classic-genre-table');
            tables.forEach(table => {
                const tbody = table.querySelector('tbody');
                if (tbody && tbody.querySelectorAll('tr').length > 20) {
                    const container = table.closest('.card, .reference-comparisons-container, #referenceComparisons');
                    if (container && this.performanceOptimizer) {
                        this.performanceOptimizer.enableVirtualScrollForTable(container);
                    }
                }
            });
        } catch (error) {
            console.warn('⚠️ Erro ao otimizar tabela:', error);
        }
    }
    
    optimizeAICardsIfNeeded() {
        try {
            const grids = document.querySelectorAll('.ai-suggestions-grid');
            grids.forEach(grid => {
                const cards = grid.querySelectorAll('.suggestion-card, .ai-suggestion-card, [class*="card"]');
                if (cards.length > 5 && this.performanceOptimizer) {
                    this.performanceOptimizer.enableProgressiveRenderForCards(grid);
                }
            });
        } catch (error) {
            console.warn('⚠️ Erro ao otimizar cards IA:', error);
        }
    }
    
    // Métricas de performance
    getPerformanceMetrics() {
        return this.performanceOptimizer ? 
               this.performanceOptimizer.getPerformanceReport() : 
               { error: 'Performance optimizer não disponível' };
    }
    
    logPerformanceReport() {
        if (this.performanceOptimizer) {
            this.performanceOptimizer.logPerformanceReport();
        }
    }
    
    // Debug utilities
    enablePerformanceDebug() {
        document.body.classList.add('performance-debug');
        console.log('🔧 Performance debug ativado');
    }
    
    disablePerformanceDebug() {
        document.body.classList.remove('performance-debug');
        console.log('🔧 Performance debug desativado');
    }
    
    // Utilities para testes
    disableAnimations() {
        document.body.classList.add('no-animation');
    }
    
    enableAnimations() {
        document.body.classList.remove('no-animation');
    }
}

// 🚀 AUTO-INICIALIZAÇÃO
let performanceIntegration;

// Aguardar carregamento das dependências
function initPerformanceIntegration() {
    if (!performanceIntegration) {
        performanceIntegration = new PerformanceModalIntegration();
        window.performanceModalIntegration = performanceIntegration;
        console.log('✅ Performance Modal Integration inicializado');
    }
}

// Múltiplos pontos de entrada para garantir inicialização
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPerformanceIntegration);
} else {
    initPerformanceIntegration();
}

// Fallback para carregamento tardio
setTimeout(initPerformanceIntegration, 1000);

// Export
window.PerformanceModalIntegration = PerformanceModalIntegration;
window.initPerformanceIntegration = initPerformanceIntegration;