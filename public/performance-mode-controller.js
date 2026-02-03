/**
 * 🚀 PERFORMANCE MODE CONTROLLER
 * ===============================
 * 
 * Controla ativação/desativação automática do modo de performance
 * para reduzir peso durante análise de áudio.
 * 
 * FUNCIONALIDADES:
 * - Adiciona/remove classe 'perf-mode' no body
 * - Pausa Vanta.js/Three.js durante análise
 * - Cancela requestAnimationFrame loops desnecessários
 * - Logs com timestamps para instrumentação
 * 
 * EVENTOS:
 * - performanceModeEnabled
 * - performanceModeDisabled
 */

(function() {
    'use strict';
    
    // Estado interno
    let perfModeActive = false;
    let vantaPaused = false;
    let vantaInstance = null;
    let rafHandles = new Set();
    
    /**
     * Timestamp formatado para logs
     */
    function timestamp() {
        const now = new Date();
        return `[${now.toISOString()}]`;
    }
    
    /**
     * Ativa Performance Mode
     */
    function enablePerformanceMode() {
        if (perfModeActive) {
            console.log(timestamp(), '⚡ [PERF] Performance Mode já ativo');
            return;
        }
        
        console.log(timestamp(), '🚀 [PERF] ATIVANDO Performance Mode AGRESSIVO...');
        perfModeActive = true;
        
        // Adicionar classe no body
        document.body.classList.add('perf-mode');
        console.log(timestamp(), '✅ [PERF] Classe perf-mode adicionada ao body');
        
        // Pausar Vanta.js
        pauseVanta();
        
        // 🚨 MODO AGRESSIVO: Desligar observers não essenciais
        pauseNonEssentialObservers();
        
        // Cancelar loops de animação não essenciais
        // (requestAnimationFrame handles são mantidos no Set para possível cancelamento)
        console.log(timestamp(), '⏸️  [PERF] Loops de animação pausados');
        
        // Disparar evento customizado
        window.dispatchEvent(new CustomEvent('performanceModeEnabled', {
            detail: { timestamp: Date.now() }
        }));
        
        console.log(timestamp(), '✅ [PERF] Performance Mode ATIVO');
    }
    
    /**
     * Desativa Performance Mode
     */
    function disablePerformanceMode() {
        if (!perfModeActive) {
            console.log(timestamp(), '⚡ [PERF] Performance Mode já inativo');
            return;
        }
        
        console.log(timestamp(), '🔄 [PERF] DESATIVANDO Performance Mode...');
        perfModeActive = false;
        
        // Remover classe do body
        document.body.classList.remove('perf-mode');
        console.log(timestamp(), '✅ [PERF] Classe perf-mode removida do body');
        
        // Retomar Vanta.js
        resumeVanta();
        
        // 🔄 RESTAURAR: Reativar observers apenas se necessário
        resumeNonEssentialObservers();
        
        // Disparar evento customizado
        window.dispatchEvent(new CustomEvent('performanceModeDisabled', {
            detail: { timestamp: Date.now() }
        }));
        
        console.log(timestamp(), '✅ [PERF] Performance Mode DESATIVADO');
    }
    
    /**
     * Pausa Vanta.js/Three.js
     */
    function pauseVanta() {
        try {
            // Tentar via EffectsController (preferencial)
            if (window.EffectsController && typeof window.EffectsController.pause === 'function') {
                window.EffectsController.pause();
                vantaPaused = true;
                console.log(timestamp(), '⏸️  [VANTA] Pausado via EffectsController');
                return;
            }
            
            // Fallback: Pausar instância direta
            if (window.vantaEffect && window.vantaEffect.renderer) {
                vantaInstance = window.vantaEffect;
                // Salvar estado antes de pausar
                if (vantaInstance.animationLoop) {
                    vantaInstance.__pausedByPerfMode = true;
                }
                vantaPaused = true;
                console.log(timestamp(), '⏸️  [VANTA] Instância salva para pausa');
            }
            
            // Ocultar elemento Vanta
            const vantaBg = document.getElementById('vanta-bg');
            if (vantaBg) {
                vantaBg.style.display = 'none';
                console.log(timestamp(), '👁️  [VANTA] Elemento #vanta-bg ocultado');
            }
            
        } catch (error) {
            console.error(timestamp(), '❌ [VANTA] Erro ao pausar:', error);
        }
    }
    
    /**
     * Retoma Vanta.js/Three.js
     */
    function resumeVanta() {
        if (!vantaPaused) return;
        
        try {
            // Tentar via EffectsController (preferencial)
            if (window.EffectsController && typeof window.EffectsController.resume === 'function') {
                window.EffectsController.resume();
                vantaPaused = false;
                console.log(timestamp(), '▶️  [VANTA] Retomado via EffectsController');
                return;
            }
            
            // Mostrar elemento Vanta
            const vantaBg = document.getElementById('vanta-bg');
            if (vantaBg) {
                vantaBg.style.display = '';
                console.log(timestamp(), '👁️  [VANTA] Elemento #vanta-bg exibido');
            }
            
            vantaPaused = false;
            
        } catch (error) {
            console.error(timestamp(), '❌ [VANTA] Erro ao retomar:', error);
        }
    }
    
    /**
     * 🚨 MODO AGRESSIVO: Pausa observers não essenciais
     */
    function pauseNonEssentialObservers() {
        console.log(timestamp(), '🛑 [PERF] Pausando observers não essenciais...');
        
        // Desconectar Voice DOM Observer
        if (window.__VOICE_DOM_OBSERVER_INSTANCE && window.__VOICE_DOM_OBSERVER_ACTIVE) {
            try {
                window.__VOICE_DOM_OBSERVER_INSTANCE.disconnect();
                window.__VOICE_DOM_OBSERVER_WAS_ACTIVE = true; // Flag para restaurar depois
                console.log(timestamp(), '⏸️  [PERF] Voice DOM Observer desconectado');
            } catch (e) {
                console.error(timestamp(), '❌ [PERF] Erro ao desconectar Voice Observer:', e);
            }
        }
        
        // Desabilitar Tooltip Manager temporariamente
        if (window.TooltipManager && typeof window.TooltipManager.disable === 'function') {
            try {
                window.TooltipManager.disable();
                window.__TOOLTIP_WAS_ACTIVE = true;
                console.log(timestamp(), '⏸️  [PERF] Tooltip Manager desabilitado');
            } catch (e) {
                console.error(timestamp(), '❌ [PERF] Erro ao desabilitar Tooltip Manager:', e);
            }
        }
        
        // Desabilitar Premium Popovers/Watchers
        if (window.premiumWatcher && typeof window.premiumWatcher.pause === 'function') {
            try {
                window.premiumWatcher.pause();
                window.__PREMIUM_WATCHER_WAS_ACTIVE = true;
                console.log(timestamp(), '⏸️  [PERF] Premium Watcher pausado');
            } catch (e) {
                console.error(timestamp(), '❌ [PERF] Erro ao pausar Premium Watcher:', e);
            }
        }
        
        console.log(timestamp(), '✅ [PERF] Observers não essenciais pausados');
    }
    
    /**
     * 🔄 RESTAURAR: Retoma observers apenas se necessário
     */
    function resumeNonEssentialObservers() {
        console.log(timestamp(), '🔄 [PERF] Restaurando observers...');
        
        // Reconectar Voice DOM Observer (APENAS se estava ativo antes)
        if (window.__VOICE_DOM_OBSERVER_WAS_ACTIVE && window.__VOICE_DOM_OBSERVER_INSTANCE) {
            try {
                window.__VOICE_DOM_OBSERVER_INSTANCE.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                window.__VOICE_DOM_OBSERVER_WAS_ACTIVE = false;
                console.log(timestamp(), '▶️  [PERF] Voice DOM Observer reconectado');
            } catch (e) {
                console.error(timestamp(), '❌ [PERF] Erro ao reconectar Voice Observer:', e);
            }
        }
        
        // Reabilitar Tooltip Manager (APENAS se estava ativo antes)
        if (window.__TOOLTIP_WAS_ACTIVE && window.TooltipManager && typeof window.TooltipManager.enable === 'function') {
            try {
                window.TooltipManager.enable();
                window.__TOOLTIP_WAS_ACTIVE = false;
                console.log(timestamp(), '▶️  [PERF] Tooltip Manager reabilitado');
            } catch (e) {
                console.error(timestamp(), '❌ [PERF] Erro ao reabilitar Tooltip Manager:', e);
            }
        }
        
        // Retomar Premium Watcher (APENAS se estava ativo antes)
        if (window.__PREMIUM_WATCHER_WAS_ACTIVE && window.premiumWatcher && typeof window.premiumWatcher.resume === 'function') {
            try {
                window.premiumWatcher.resume();
                window.__PREMIUM_WATCHER_WAS_ACTIVE = false;
                console.log(timestamp(), '▶️  [PERF] Premium Watcher retomado');
            } catch (e) {
                console.error(timestamp(), '❌ [PERF] Erro ao retomar Premium Watcher:', e);
            }
        }
        
        console.log(timestamp(), '✅ [PERF] Observers restaurados');
    }
    
    /**
     * Setup auto-detection de modais
     * Auto-detectar abertura/fechamento de modal de análise
     */
    function setupAutoDetection() {
        // Observer para #audioAnalysisModal
        const audioModal = document.getElementById('audioAnalysisModal');
        if (audioModal) {
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        const isVisible = window.getComputedStyle(audioModal).display !== 'none';
                        
                        if (isVisible && !perfModeActive) {
                            console.log(timestamp(), '🔍 [AUTO] Modal de análise abriu → ativando perf mode');
                            enablePerformanceMode();
                        } else if (!isVisible && perfModeActive) {
                            console.log(timestamp(), '🔍 [AUTO] Modal de análise fechou → desativando perf mode');
                            disablePerformanceMode();
                        }
                    }
                }
            });
            
            observer.observe(audioModal, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });
            
            console.log(timestamp(), '👀 [AUTO] Observer ativo em #audioAnalysisModal');
        }
        
        // Observer para #analysisModeModal (modal de seleção de modo)
        const modeModal = document.getElementById('analysisModeModal');
        if (modeModal) {
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        const isVisible = window.getComputedStyle(modeModal).display !== 'none';
                        
                        if (isVisible && !perfModeActive) {
                            console.log(timestamp(), '🔍 [AUTO] Modal de modo abriu → ativando perf mode');
                            enablePerformanceMode();
                        }
                        // Não desativa quando fecha (espera modal de análise abrir)
                    }
                }
            });
            
            observer.observe(modeModal, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });
            
            console.log(timestamp(), '👀 [AUTO] Observer ativo em #analysisModeModal');
        }
    }
    
    /**
     * Inicialização
     */
    function init() {
        console.log(timestamp(), '🚀 [PERF] Performance Mode Controller carregado');
        
        // Setup auto-detection quando DOM estiver pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupAutoDetection);
        } else {
            setupAutoDetection();
        }
        
        // Expor API global
        window.PerformanceModeController = {
            enable: enablePerformanceMode,
            disable: disablePerformanceMode,
            isActive: () => perfModeActive,
            pauseVanta: pauseVanta,
            resumeVanta: resumeVanta
        };
        
        console.log(timestamp(), '✅ [PERF] API exposta: window.PerformanceModeController');
    }
    
    // Inicializar
    init();
    
})();
