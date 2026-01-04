/**
 * 🚀 MODAL PERFORMANCE OPTIMIZER
 * 
 * OTIMIZAÇÕES IMPLEMENTADAS:
 * ✅ Virtual scroll para tabelas grandes
 * ✅ Render progressivo de cards IA via requestIdleCallback
 * ✅ CSS content-visibility e contain para containers pesados
 * ✅ Animações apenas com transform/opacity (sem reflow)
 * ✅ Background freeze/unfreeze no modal
 * ✅ Instrumentação de performance
 * 
 * IMPORTANTE: Mantém visual idêntico, apenas otimiza o render!
 */

class ModalPerformanceOptimizer {
    constructor() {
        this.isModalOpen = false;
        this.vantaEffect = null; // Referência para pausar background
        this.performanceMetrics = {
            modalOpenTime: 0,
            tableRenderTime: 0,
            cardsRenderTime: 0,
            longTasksDetected: 0,
            nodesRendered: 0
        };
        
        // Virtual scroll configurações
        this.virtualScrollConfig = {
            rowHeight: 45, // altura estimada de cada linha da tabela
            buffer: 5, // linhas extras acima/abaixo do viewport
            container: null,
            totalRows: 0,
            visibleStart: 0,
            visibleEnd: 0
        };
        
        // Cards render progressivo
        this.progressiveRenderConfig = {
            chunkSize: 3, // renderizar 3 cards por chunk
            delay: 16, // delay entre chunks (1 frame)
            currentChunk: 0,
            totalCards: 0,
            isRendering: false
        };
        
        this.initializeOptimizations();
        this.setupPerformanceObservation();
        console.log('🚀 ModalPerformanceOptimizer inicializado - Visual mantido, performance otimizada');
    }
    
    initializeOptimizations() {
        // Interceptar abertura do modal
        this.interceptModalOpen();
        
        // Otimizar CSS para containers pesados
        this.optimizeCSS();
        
        // Setup do virtual scroll observer
        this.setupVirtualScrollObserver();
    }
    
    interceptModalOpen() {
        // Hook na função original de abertura do modal
        const originalShowModal = window.showAudioAnalysisModal || (() => {});
        window.showAudioAnalysisModal = (...args) => {
            this.handleModalOpenStart();
            originalShowModal.apply(this, args);
            this.handleModalOpenEnd();
        };
        
        // Hook no fechamento
        const originalCloseModal = window.closeAudioModal || (() => {});
        window.closeAudioModal = (...args) => {
            this.handleModalClose();
            originalCloseModal.apply(this, args);
        };
    }
    
    handleModalOpenStart() {
        this.performanceMetrics.modalOpenTime = performance.now();
        this.isModalOpen = true;
        
        // Pausar efeitos de background
        this.freezeBackground();
        
        // Aplicar CSS otimizado
        this.applyPerformanceStyles();
        
        console.log('🎯 Modal opening - Background frozen, performance styles applied');
    }
    
    handleModalOpenEnd() {
        // Aguardar próximo frame para calcular tempo real
        requestAnimationFrame(() => {
            const totalTime = performance.now() - this.performanceMetrics.modalOpenTime;
            this.performanceMetrics.modalOpenTime = totalTime;
            console.log(`📊 Modal opened in ${totalTime.toFixed(2)}ms`);
        });
    }
    
    handleModalClose() {
        this.isModalOpen = false;
        
        // Reativar background
        this.unfreezeBackground();
        
        // Remover estilos de performance específicos
        this.removePerformanceStyles();
        
        // Reset configs
        this.resetConfigurations();
        
        console.log('🎯 Modal closed - Background restored');
    }
    
    freezeBackground() {
        try {
            // Pausar Vanta effect se existir
            if (window.VANTA && window.VANTA.current) {
                this.vantaEffect = window.VANTA.current;
                if (this.vantaEffect.pause) {
                    this.vantaEffect.pause();
                } else if (this.vantaEffect.options) {
                    // Reduzir FPS para quase zero
                    this.vantaEffect.options.speed = 0.1;
                    this.vantaEffect.options.points = Math.min(this.vantaEffect.options.points || 10, 3);
                }
                console.log('❄️ Background Vanta effect paused/reduced');
            }
            
            // Pausar animações CSS do background
            const backgroundElements = document.querySelectorAll('.stars, .shooting-star, [class*="animate"]');
            backgroundElements.forEach(el => {
                el.style.animationPlayState = 'paused';
            });
            
        } catch (error) {
            console.warn('⚠️ Erro ao pausar background:', error);
        }
    }
    
    unfreezeBackground() {
        try {
            // Restaurar Vanta effect
            if (this.vantaEffect) {
                if (this.vantaEffect.play) {
                    this.vantaEffect.play();
                } else if (this.vantaEffect.options) {
                    this.vantaEffect.options.speed = 1.0;
                    this.vantaEffect.options.points = 10;
                }
                console.log('🔄 Background Vanta effect restored');
            }
            
            // Restaurar animações CSS
            const backgroundElements = document.querySelectorAll('[style*="animation-play-state: paused"]');
            backgroundElements.forEach(el => {
                el.style.animationPlayState = 'running';
            });
            
        } catch (error) {
            console.warn('⚠️ Erro ao restaurar background:', error);
        }
    }
    
    optimizeCSS() {
        // Criar stylesheet para otimizações
        const style = document.createElement('style');
        style.id = 'modal-performance-optimizer';
        style.textContent = `
            /* 🚀 MODAL PERFORMANCE OPTIMIZATIONS */
            
            /* Content Visibility para containers pesados */
            .audio-modal-content {
                content-visibility: auto;
                contain: layout style paint;
            }
            
            /* Otimização para tabelas grandes */
            .classic-genre-table {
                contain: layout style paint;
                content-visibility: auto;
                contain-intrinsic-size: 0 500px;
            }
            
            /* Otimização para grid de sugestões IA */
            .ai-suggestions-grid {
                contain: layout style paint;
                content-visibility: auto;
                contain-intrinsic-size: 0 800px;
            }
            
            /* Otimização para cards individuais */
            .suggestion-card,
            .ai-suggestion-card,
            .genre-comparison-classic {
                contain: layout paint style;
            }
            
            /* Animações otimizadas - apenas transform/opacity */
            .modal-fade-in {
                animation: modalFadeInOptimized 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                will-change: transform, opacity;
            }
            
            .modal-fade-out {
                animation: modalFadeOutOptimized 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                will-change: transform, opacity;
            }
            
            @keyframes modalFadeInOptimized {
                from {
                    opacity: 0;
                    transform: translateY(-10px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            @keyframes modalFadeOutOptimized {
                from {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
                to {
                    opacity: 0;
                    transform: translateY(-10px) scale(0.95);
                }
            }
            
            /* Reduzir blur em áreas grandes para performance */
            .audio-modal {
                backdrop-filter: blur(8px) brightness(0.3);
            }
            
            /* Progressive render para cards */
            .progressive-card {
                opacity: 0;
                transform: translateY(20px);
                transition: opacity 0.3s ease, transform 0.3s ease;
            }
            
            .progressive-card.loaded {
                opacity: 1;
                transform: translateY(0);
            }
            
            /* Virtual scroll container */
            .virtual-scroll-container {
                height: 400px;
                overflow: auto;
                position: relative;
            }
            
            .virtual-scroll-spacer {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                pointer-events: none;
            }
            
            .virtual-scroll-content {
                position: relative;
                z-index: 1;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    applyPerformanceStyles() {
        const modal = document.getElementById('audioAnalysisModal');
        if (modal) {
            modal.classList.add('modal-fade-in');
            modal.classList.remove('modal-fade-out');
            
            // Aplicar will-change durante animação
            modal.style.willChange = 'transform, opacity';
            setTimeout(() => {
                modal.style.willChange = 'auto';
            }, 300);
        }
    }
    
    removePerformanceStyles() {
        const modal = document.getElementById('audioAnalysisModal');
        if (modal) {
            modal.classList.add('modal-fade-out');
            modal.classList.remove('modal-fade-in');
        }
    }
    
    // 📊 VIRTUAL SCROLL IMPLEMENTATION
    enableVirtualScrollForTable(tableContainer) {
        if (!tableContainer) return;
        
        const table = tableContainer.querySelector('.classic-genre-table');
        if (!table) return;
        
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr');
        this.virtualScrollConfig.totalRows = rows.length;
        
        // Se tabela pequena, não precisa de virtual scroll
        if (rows.length <= 20) {
            console.log('📊 Tabela pequena - virtual scroll desnecessário');
            return;
        }
        
        console.log(`📊 Implementando virtual scroll para ${rows.length} linhas`);
        
        // Converter para virtual scroll
        this.convertTableToVirtual(tableContainer, table, rows);
    }
    
    convertTableToVirtual(container, table, rows) {
        const startTime = performance.now();
        
        // Criar container virtual
        const virtualContainer = document.createElement('div');
        virtualContainer.className = 'virtual-scroll-container';
        
        // Spacer para manter altura total
        const spacer = document.createElement('div');
        spacer.className = 'virtual-scroll-spacer';
        spacer.style.height = `${rows.length * this.virtualScrollConfig.rowHeight}px`;
        
        // Container para linhas visíveis
        const visibleContent = document.createElement('div');
        visibleContent.className = 'virtual-scroll-content';
        
        // Clonar cabeçalho da tabela
        const virtualTable = table.cloneNode(false);
        const thead = table.querySelector('thead').cloneNode(true);
        const tbody = document.createElement('tbody');
        
        virtualTable.appendChild(thead);
        virtualTable.appendChild(tbody);
        visibleContent.appendChild(virtualTable);
        
        virtualContainer.appendChild(spacer);
        virtualContainer.appendChild(visibleContent);
        
        // Substituir tabela original
        table.style.display = 'none';
        container.appendChild(virtualContainer);
        
        // Setup do scroll observer
        this.setupVirtualScroll(virtualContainer, virtualTable.querySelector('tbody'), rows);
        
        const renderTime = performance.now() - startTime;
        this.performanceMetrics.tableRenderTime = renderTime;
        this.performanceMetrics.nodesRendered = rows.length;
        
        console.log(`📊 Virtual scroll implementado em ${renderTime.toFixed(2)}ms`);
    }
    
    setupVirtualScroll(container, virtualTbody, originalRows) {
        const config = this.virtualScrollConfig;
        config.container = container;
        
        const updateVisibleRows = () => {
            const scrollTop = container.scrollTop;
            const containerHeight = container.clientHeight;
            
            const start = Math.floor(scrollTop / config.rowHeight);
            const end = Math.min(
                originalRows.length,
                Math.ceil((scrollTop + containerHeight) / config.rowHeight) + config.buffer
            );
            
            config.visibleStart = Math.max(0, start - config.buffer);
            config.visibleEnd = end;
            
            // Renderizar apenas linhas visíveis
            virtualTbody.innerHTML = '';
            
            for (let i = config.visibleStart; i < config.visibleEnd; i++) {
                if (originalRows[i]) {
                    const clonedRow = originalRows[i].cloneNode(true);
                    virtualTbody.appendChild(clonedRow);
                }
            }
            
            // Ajustar posição do conteúdo
            const offset = config.visibleStart * config.rowHeight;
            virtualTbody.style.transform = `translateY(${offset}px)`;
        };
        
        // Throttled scroll handler
        let scrollTimeout;
        container.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(updateVisibleRows, 16); // ~60fps
        });
        
        // Renderizar inicial
        updateVisibleRows();
    }
    
    // 🎨 PROGRESSIVE RENDER PARA CARDS IA
    enableProgressiveRenderForCards(cardsContainer) {
        if (!cardsContainer) return;
        
        const cards = cardsContainer.querySelectorAll('.suggestion-card, .ai-suggestion-card, [class*="card"]');
        if (cards.length <= 5) {
            console.log('🎨 Poucos cards - render progressivo desnecessário');
            return;
        }
        
        console.log(`🎨 Implementando render progressivo para ${cards.length} cards`);
        
        this.progressiveRenderConfig.totalCards = cards.length;
        this.progressiveRenderConfig.currentChunk = 0;
        this.progressiveRenderConfig.isRendering = true;
        
        // Esconder todos os cards inicialmente
        cards.forEach(card => {
            card.classList.add('progressive-card');
        });
        
        // Iniciar render progressivo
        this.renderNextChunk(cards);
    }
    
    renderNextChunk(cards) {
        const config = this.progressiveRenderConfig;
        const startIndex = config.currentChunk * config.chunkSize;
        const endIndex = Math.min(startIndex + config.chunkSize, cards.length);
        
        // Renderizar chunk atual
        for (let i = startIndex; i < endIndex; i++) {
            if (cards[i]) {
                cards[i].classList.add('loaded');
            }
        }
        
        config.currentChunk++;
        
        // Se ainda há cards para renderizar
        if (endIndex < cards.length) {
            // Usar requestIdleCallback se disponível, senão requestAnimationFrame
            if (window.requestIdleCallback) {
                requestIdleCallback(() => this.renderNextChunk(cards), { timeout: 100 });
            } else {
                setTimeout(() => this.renderNextChunk(cards), config.delay);
            }
        } else {
            config.isRendering = false;
            const totalTime = performance.now() - this.performanceMetrics.modalOpenTime;
            this.performanceMetrics.cardsRenderTime = totalTime;
            console.log(`🎨 Render progressivo concluído em ${totalTime.toFixed(2)}ms`);
        }
    }
    
    // 📊 PERFORMANCE MONITORING
    setupPerformanceObservation() {
        if (window.PerformanceObserver) {
            // Monitor long tasks
            const longTaskObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.duration > 50) { // Long task > 50ms
                        this.performanceMetrics.longTasksDetected++;
                        console.warn(`⚠️ Long task detected: ${entry.duration.toFixed(2)}ms`);
                    }
                }
            });
            
            try {
                longTaskObserver.observe({ entryTypes: ['longtask'] });
            } catch (e) {
                console.log('ℹ️ LongTask API não disponível neste navegador');
            }
        }
    }
    
    setupVirtualScrollObserver() {
        // Observer para detectar quando tabelas são adicionadas ao DOM
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Procurar por tabelas de comparação
                        const tables = node.querySelectorAll?.('.classic-genre-table') || 
                                     (node.classList?.contains('classic-genre-table') ? [node] : []);
                        
                        tables.forEach(table => {
                            const container = table.closest('.card, .reference-comparisons-container, #referenceComparisons');
                            if (container && this.isModalOpen) {
                                setTimeout(() => this.enableVirtualScrollForTable(container), 0);
                            }
                        });
                        
                        // Procurar por grids de sugestões IA
                        const aiGrids = node.querySelectorAll?.('.ai-suggestions-grid') ||
                                       (node.classList?.contains('ai-suggestions-grid') ? [node] : []);
                        
                        aiGrids.forEach(grid => {
                            if (this.isModalOpen) {
                                setTimeout(() => this.enableProgressiveRenderForCards(grid), 0);
                            }
                        });
                    }
                });
            });
        });
        
        // Observar mudanças no modal
        const modalResults = document.getElementById('audioAnalysisResults');
        if (modalResults) {
            observer.observe(modalResults, {
                childList: true,
                subtree: true
            });
        }
    }
    
    resetConfigurations() {
        this.virtualScrollConfig.container = null;
        this.virtualScrollConfig.totalRows = 0;
        this.virtualScrollConfig.visibleStart = 0;
        this.virtualScrollConfig.visibleEnd = 0;
        
        this.progressiveRenderConfig.currentChunk = 0;
        this.progressiveRenderConfig.totalCards = 0;
        this.progressiveRenderConfig.isRendering = false;
    }
    
    // 📊 MÉTRICA FINAL
    getPerformanceReport() {
        return {
            modalOpenTime: `${this.performanceMetrics.modalOpenTime.toFixed(2)}ms`,
            tableRenderTime: `${this.performanceMetrics.tableRenderTime.toFixed(2)}ms`,
            cardsRenderTime: `${this.performanceMetrics.cardsRenderTime.toFixed(2)}ms`,
            longTasksDetected: this.performanceMetrics.longTasksDetected,
            nodesRendered: this.performanceMetrics.nodesRendered,
            memoryUsage: performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)}MB` : 'N/A'
        };
    }
    
    logPerformanceReport() {
        console.group('📊 MODAL PERFORMANCE REPORT');
        const report = this.getPerformanceReport();
        Object.entries(report).forEach(([key, value]) => {
            console.log(`${key}: ${value}`);
        });
        console.groupEnd();
    }
}

// 🚀 AUTO-INICIALIZAÇÃO
window.modalPerformanceOptimizer = new ModalPerformanceOptimizer();

// Export para uso externo
window.ModalPerformanceOptimizer = ModalPerformanceOptimizer;