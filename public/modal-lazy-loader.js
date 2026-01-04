/**
 * ⚡ MODAL LAZY LOADER - Sistema de Carregamento Progressivo
 * Otimiza performance inicial reduzindo DOM e renderizando sob demanda
 */

(function() {
    'use strict';
    
    // 🎯 CONFIGURAÇÃO
    const CONFIG = {
        // Delay para carregar conteúdo secundário (ms)
        SECONDARY_DELAY: 150,
        // Delay para carregar conteúdo terciário (ms)
        TERTIARY_DELAY: 300,
        // Usar requestIdleCallback se disponível
        USE_IDLE_CALLBACK: true
    };
    
    /**
     * Sistema de renderização progressiva
     * Prioriza conteúdo essencial e carrega resto progressivamente
     */
    window.ModalLazyLoader = {
        /**
         * Renderiza conteúdo em fases
         * @param {Object} analysis - Dados da análise
         * @param {Function} renderPrimary - Renderiza conteúdo essencial
         * @param {Function} renderSecondary - Renderiza conteúdo secundário
         * @param {Function} renderTertiary - Renderiza conteúdo terciário
         */
        renderProgressive: function(analysis, renderPrimary, renderSecondary, renderTertiary) {
            console.log('[LAZY-LOADER] 🚀 Iniciando renderização progressiva');
            
            // ⚡ FASE 1: Renderizar conteúdo ESSENCIAL imediatamente
            // - Score final
            // - 5-6 métricas principais
            // - Botão "Ver mais"
            const primaryStart = performance.now();
            const primaryHTML = renderPrimary(analysis);
            const primaryTime = performance.now() - primaryStart;
            console.log(`[LAZY-LOADER] ✅ Fase 1 (ESSENCIAL) renderizada em ${primaryTime.toFixed(1)}ms`);
            
            // ⚡ FASE 2: Renderizar conteúdo SECUNDÁRIO após delay
            // - Métricas avançadas
            // - Análise de frequências (resumida)
            const scheduleSecondary = () => {
                const secondaryStart = performance.now();
                const secondaryHTML = renderSecondary(analysis);
                const secondaryTime = performance.now() - secondaryStart;
                console.log(`[LAZY-LOADER] ✅ Fase 2 (SECUNDÁRIO) renderizada em ${secondaryTime.toFixed(1)}ms`);
                
                // Inserir conteúdo secundário
                const container = document.getElementById('modal-secondary-content');
                if (container) {
                    container.innerHTML = secondaryHTML;
                    container.style.display = 'block';
                }
            };
            
            // ⚡ FASE 3: Renderizar conteúdo TERCIÁRIO após delay maior
            // - Sugestões IA completas
            // - Comparações espectrais detalhadas
            // - Problemas expandidos
            const scheduleTertiary = () => {
                const tertiaryStart = performance.now();
                const tertiaryHTML = renderTertiary(analysis);
                const tertiaryTime = performance.now() - tertiaryStart;
                console.log(`[LAZY-LOADER] ✅ Fase 3 (TERCIÁRIO) renderizada em ${tertiaryTime.toFixed(1)}ms`);
                
                // Inserir conteúdo terciário
                const container = document.getElementById('modal-tertiary-content');
                if (container) {
                    container.innerHTML = tertiaryHTML;
                    container.style.display = 'block';
                }
            };
            
            // Agendar fases 2 e 3
            if (CONFIG.USE_IDLE_CALLBACK && window.requestIdleCallback) {
                // Usar requestIdleCallback se disponível (melhor performance)
                requestIdleCallback(() => {
                    scheduleSecondary();
                    requestIdleCallback(scheduleTertiary, { timeout: CONFIG.TERTIARY_DELAY });
                }, { timeout: CONFIG.SECONDARY_DELAY });
            } else {
                // Fallback para setTimeout
                setTimeout(scheduleSecondary, CONFIG.SECONDARY_DELAY);
                setTimeout(scheduleTertiary, CONFIG.TERTIARY_DELAY);
            }
            
            return primaryHTML;
        },
        
        /**
         * Cria estrutura de containers para lazy loading
         */
        createLazyContainers: function() {
            return `
                <!-- ⚡ Container para conteúdo ESSENCIAL (renderizado imediatamente) -->
                <div id="modal-primary-content">
                    <!-- Será preenchido por renderPrimary -->
                </div>
                
                <!-- ⚡ Container para conteúdo SECUNDÁRIO (lazy-loaded) -->
                <div id="modal-secondary-content" style="display:none;">
                    <!-- Será preenchido após ${CONFIG.SECONDARY_DELAY}ms -->
                </div>
                
                <!-- ⚡ Container para conteúdo TERCIÁRIO (lazy-loaded) -->
                <div id="modal-tertiary-content" style="display:none;">
                    <!-- Será preenchido após ${CONFIG.TERTIARY_DELAY}ms -->
                </div>
            `;
        },
        
        /**
         * Reduz conjunto de métricas para apenas essenciais
         * @param {Object} allMetrics - Todas as métricas disponíveis
         * @returns {Object} - Métricas essenciais apenas
         */
        getEssentialMetrics: function(allMetrics) {
            const ESSENTIAL_KEYS = [
                'lufs', 'lufsIntegrated', 'loudness',
                'truePeak', 'truePeakDbtp',
                'dr', 'dynamicRange',
                'peak', 'rmsPeak300msDbfs',
                'stereoCorrelation', 'stereoWidth'
            ];
            
            const essential = {};
            ESSENTIAL_KEYS.forEach(key => {
                if (allMetrics[key] !== undefined) {
                    essential[key] = allMetrics[key];
                }
            });
            
            return essential;
        },
        
        /**
         * Verifica se deve usar lazy loading (desabilitar em mobile lento)
         */
        shouldUseLazyLoading: function() {
            // Desabilitar em dispositivos muito lentos
            if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
                return navigator.hardwareConcurrency >= 2;
            }
            return true;
        }
    };
    
    console.log('[LAZY-LOADER] ✅ Sistema de carregamento progressivo inicializado');
})();
