/**
 * ⚡ MODAL PERFORMANCE OPTIMIZER
 * Sistema de otimização ultra-agressiva para renderização do modal
 * Lazy loading, virtual scrolling, debouncing e otimização de DOM
 */

(function() {
    'use strict';

    // ⚡ Detectar se dispositivo é low-end (menos de 4GB RAM ou CPU lenta)
    const isLowEndDevice = () => {
        if (!navigator.deviceMemory) return false;
        return navigator.deviceMemory < 4 || navigator.hardwareConcurrency < 4;
    };

    // ⚡ Usar requestIdleCallback com fallback
    const scheduleIdleWork = (callback) => {
        if ('requestIdleCallback' in window) {
            return requestIdleCallback(callback, { timeout: 1000 });
        }
        return setTimeout(callback, 16); // ~60fps
    };

    // ⚡ Lazy Rendering: Renderizar elementos apenas quando visíveis
    class LazyRenderer {
        constructor() {
            this.observer = null;
            this.setupIntersectionObserver();
        }

        setupIntersectionObserver() {
            if (!('IntersectionObserver' in window)) return;

            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const element = entry.target;
                        const lazyContent = element.dataset.lazyContent;
                        
                        if (lazyContent) {
                            // Renderizar conteúdo lazy
                            scheduleIdleWork(() => {
                                element.innerHTML = lazyContent;
                                delete element.dataset.lazyContent;
                                element.classList.add('lazy-loaded');
                                this.observer.unobserve(element);
                            });
                        }
                    }
                });
            }, {
                rootMargin: '100px', // Começar a carregar 100px antes
                threshold: 0.01
            });
        }

        observe(element) {
            if (this.observer) {
                this.observer.observe(element);
            }
        }

        disconnect() {
            if (this.observer) {
                this.observer.disconnect();
            }
        }
    }

    // ⚡ Batch DOM Updates: Agrupar mudanças de DOM
    class DOMBatcher {
        constructor() {
            this.queue = [];
            this.scheduled = false;
        }

        add(updateFn) {
            this.queue.push(updateFn);
            if (!this.scheduled) {
                this.scheduled = true;
                requestAnimationFrame(() => this.flush());
            }
        }

        flush() {
            const updates = this.queue.slice();
            this.queue.length = 0;
            this.scheduled = false;

            // Executar todas as atualizações de uma vez
            updates.forEach(fn => {
                try {
                    fn();
                } catch (err) {
                    console.error('[DOM-BATCHER] Erro ao executar update:', err);
                }
            });
        }
    }

    // ⚡ Scroll Optimizer: Debounce de scroll para evitar repaints
    class ScrollOptimizer {
        constructor(element, callback, delay = 150) {
            this.element = element;
            this.callback = callback;
            this.delay = delay;
            this.timeoutId = null;
            this.isScrolling = false;

            this.handleScroll = this.handleScroll.bind(this);
            this.element?.addEventListener('scroll', this.handleScroll, { passive: true });
        }

        handleScroll() {
            // Flag para indicar que está scrollando
            if (!this.isScrolling) {
                this.isScrolling = true;
                document.body.classList.add('is-scrolling');
            }

            clearTimeout(this.timeoutId);
            
            this.timeoutId = setTimeout(() => {
                this.isScrolling = false;
                document.body.classList.remove('is-scrolling');
                
                if (this.callback) {
                    this.callback();
                }
            }, this.delay);
        }

        destroy() {
            this.element?.removeEventListener('scroll', this.handleScroll);
            clearTimeout(this.timeoutId);
        }
    }

    // ⚡ Otimizar Modal ao abrir
    window.optimizeModalPerformance = function() {
        console.log('[PERF-OPTIMIZER] ⚡ Iniciando otimizações de performance...');

        const modal = document.getElementById('audioAnalysisModal');
        if (!modal) return;

        // 1. Aplicar CSS otimizado para low-end devices
        if (isLowEndDevice()) {
            console.log('[PERF-OPTIMIZER] 🔧 Dispositivo low-end detectado, aplicando otimizações');
            modal.classList.add('low-end-device');
        }

        // 2. Setup Lazy Rendering
        const lazyRenderer = new LazyRenderer();
        const lazyElements = modal.querySelectorAll('[data-lazy-render]');
        lazyElements.forEach(el => lazyRenderer.observe(el));

        // 3. Setup Scroll Optimizer
        const resultsContainer = document.getElementById('audioAnalysisResults');
        if (resultsContainer) {
            const scrollOptimizer = new ScrollOptimizer(resultsContainer, () => {
                console.log('[PERF-OPTIMIZER] Scroll finalizado, fazendo cleanup...');
            });

            // Guardar referência para limpeza posterior
            modal._scrollOptimizer = scrollOptimizer;
        }

        // 4. Renderizar sugestões em lotes (chunking)
        const suggestionsContainer = document.querySelector('.ai-suggestions-grid');
        if (suggestionsContainer) {
            const cards = Array.from(suggestionsContainer.children);
            
            if (cards.length > 6) {
                console.log(`[PERF-OPTIMIZER] ${cards.length} sugestões detectadas, renderizando em lotes...`);
                
                // Ocultar cards após o 6º
                cards.slice(6).forEach(card => {
                    card.style.display = 'none';
                    card.dataset.lazyCard = 'true';
                });

                // Criar botão "Carregar Mais"
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.className = 'load-more-suggestions';
                loadMoreBtn.textContent = `Carregar mais ${cards.length - 6} sugestões`;
                loadMoreBtn.style.cssText = `
                    width: 100%;
                    padding: 12px 24px;
                    margin-top: 16px;
                    background: rgba(59, 130, 246, 0.1);
                    border: 1px solid rgba(59, 130, 246, 0.3);
                    border-radius: 10px;
                    color: #93c5fd;
                    cursor: pointer;
                    transition: all 0.3s ease;
                `;
                
                loadMoreBtn.addEventListener('click', function() {
                    cards.slice(6).forEach(card => {
                        card.style.display = '';
                        delete card.dataset.lazyCard;
                    });
                    this.remove();
                });

                suggestionsContainer.parentNode.insertBefore(loadMoreBtn, suggestionsContainer.nextSibling);
            }
        }

        console.log('[PERF-OPTIMIZER] ✅ Otimizações aplicadas');
    };

    // ⚡ Limpar otimizações ao fechar modal
    window.cleanupModalPerformance = function() {
        const modal = document.getElementById('audioAnalysisModal');
        if (!modal) return;

        if (modal._scrollOptimizer) {
            modal._scrollOptimizer.destroy();
            delete modal._scrollOptimizer;
        }

        document.body.classList.remove('is-scrolling');
        console.log('[PERF-OPTIMIZER] 🧹 Cleanup concluído');
    };

    // ⚡ CSS adicional para otimizações
    const style = document.createElement('style');
    style.textContent = `
        /* ⚡ Low-end device optimizations */
        .low-end-device .audio-modal-content {
            backdrop-filter: blur(4px) !important;
            -webkit-backdrop-filter: blur(4px) !important;
        }

        .low-end-device .audio-modal-content::before,
        .low-end-device .audio-modal-content::after,
        .low-end-device #final-score-display::before {
            display: none !important;
        }

        /* ⚡ Durante scroll, pausar animações */
        body.is-scrolling * {
            animation-play-state: paused !important;
        }

        /* ⚡ Lazy loading states */
        [data-lazy-render]:not(.lazy-loaded) {
            min-height: 100px;
            background: rgba(255, 255, 255, 0.02);
            border-radius: 8px;
        }

        [data-lazy-card] {
            content-visibility: hidden;
        }

        /* ⚡ Botão carregar mais */
        .load-more-suggestions:hover {
            background: rgba(59, 130, 246, 0.2);
            border-color: rgba(59, 130, 246, 0.5);
            transform: translateY(-1px);
        }

        /* ⚡ Otimização: Reduzir complexidade durante scroll */
        body.is-scrolling .ai-suggestion-card {
            will-change: auto !important;
        }
    `;
    document.head.appendChild(style);

    console.log('[PERF-OPTIMIZER] 🚀 Sistema de otimização carregado');
})();
