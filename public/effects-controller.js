/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎛️ EFFECTS CONTROLLER - SoundyAI
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * MUDANÇAS IMPLEMENTADAS:
 * 1. Gerenciamento centralizado de Vanta + animações CSS pesadas
 * 2. Pausa em: document.hidden, window.blur, input focus prolongado
 * 3. Degradação progressiva:
 *    - Capar pixel ratio (1.25 normal, 1.0 low-end)
 *    - Reduzir parâmetros Vanta dinamicamente
 *    - Pausar Vanta se FPS continuar baixo
 * 4. Detecção de low-end: deviceMemory, hardwareConcurrency, mobile
 * 5. Sistema de backdrop-filter inteligente (desativa quando não visível)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════
    // CONFIGURAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    const CONFIG = {
        // Thresholds de detecção
        LOW_END_CORES: 4,
        LOW_END_MEMORY: 4, // GB
        MOBILE_WIDTH: 768,
        
        // Pixel ratio caps
        PIXEL_RATIO_NORMAL: Math.min(window.devicePixelRatio || 1, 1.5),
        PIXEL_RATIO_LOW: 1.0,
        
        // Vanta configs por tier
        VANTA_HIGH: {
            points: 5.0,
            maxDistance: 18.0,
            spacing: 22.0,
            showDots: true,
            mouseControls: true
        },
        VANTA_MEDIUM: {
            points: 3.0,
            maxDistance: 14.0,
            spacing: 28.0,
            showDots: true,
            mouseControls: true
        },
        VANTA_LOW: {
            points: 2.0,
            maxDistance: 10.0,
            spacing: 35.0,
            showDots: false,
            mouseControls: false
        },
        
        // Timing
        INPUT_IDLE_THRESHOLD: 3000, // 3s sem digitar para reativar
        FPS_RECOVERY_DELAY: 2000,   // Esperar 2s de FPS bom para reativar
        DEBOUNCE_RESIZE: 250
    };

    // ═══════════════════════════════════════════════════════════════════
    // ESTADO DO CONTROLADOR
    // ═══════════════════════════════════════════════════════════════════
    const state = {
        // Device detection
        isLowEnd: false,
        isMobile: false,
        prefersReducedMotion: false,
        
        // Current tier: 'high', 'medium', 'low', 'paused'
        currentTier: 'high',
        
        // Visibility states
        isDocumentVisible: true,
        isWindowFocused: true,
        isUserTyping: false,
        
        // Vanta reference
        vantaEffect: null,
        vantaElement: null,
        
        // Timers
        typingTimer: null,
        recoveryTimer: null,
        
        // FPS tracking
        consecutiveLowFps: 0,
        
        // Backdrop state
        backdropEnabled: true
    };

    // ═══════════════════════════════════════════════════════════════════
    // DETECÇÃO DE DISPOSITIVO
    // ═══════════════════════════════════════════════════════════════════
    function detectDevice() {
        const cores = navigator.hardwareConcurrency || 4;
        const memory = navigator.deviceMemory || 4;
        const width = window.innerWidth;
        
        state.isMobile = width <= CONFIG.MOBILE_WIDTH;
        state.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        state.isLowEnd = (
            cores <= CONFIG.LOW_END_CORES ||
            memory <= CONFIG.LOW_END_MEMORY ||
            state.isMobile ||
            state.prefersReducedMotion
        );

        // Determinar tier inicial
        if (state.prefersReducedMotion) {
            state.currentTier = 'paused';
        } else if (state.isLowEnd) {
            state.currentTier = 'low';
        } else if (state.isMobile) {
            state.currentTier = 'medium';
        } else {
            state.currentTier = 'high';
        }

        console.log(`🎛️ [Effects] Device: ${state.isLowEnd ? 'LOW-END' : 'NORMAL'}, Tier: ${state.currentTier}`, {
            cores, memory, width, mobile: state.isMobile, reducedMotion: state.prefersReducedMotion
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // VANTA CONTROLLER
    // ═══════════════════════════════════════════════════════════════════
    function getVantaConfig() {
        switch (state.currentTier) {
            case 'high': return CONFIG.VANTA_HIGH;
            case 'medium': return CONFIG.VANTA_MEDIUM;
            case 'low': return CONFIG.VANTA_LOW;
            default: return null;
        }
    }

    function initVanta() {
        if (state.currentTier === 'paused' || state.prefersReducedMotion) {
            console.log('🎛️ [Effects] Vanta desabilitado (tier: paused)');
            return;
        }

        state.vantaElement = document.getElementById('vanta-bg');
        if (!state.vantaElement) return;

        if (typeof VANTA === 'undefined' || typeof THREE === 'undefined') {
            console.warn('🎛️ [Effects] VANTA/THREE não disponíveis');
            return;
        }

        destroyVanta();

        const config = getVantaConfig();
        if (!config) return;

        try {
            state.vantaEffect = VANTA.NET({
                el: state.vantaElement,
                THREE: THREE,
                mouseControls: config.mouseControls,
                touchControls: config.mouseControls,
                gyroControls: false,
                minHeight: 200,
                minWidth: 200,
                scale: 1.0,
                scaleMobile: 0.8,
                color: 0x8a2be2,
                backgroundColor: 0x0a0a1a,
                points: config.points,
                maxDistance: config.maxDistance,
                spacing: config.spacing,
                showDots: config.showDots
            });
            
            // Aplicar pixel ratio cap ao renderer
            if (state.vantaEffect?.renderer) {
                const ratio = state.isLowEnd ? CONFIG.PIXEL_RATIO_LOW : CONFIG.PIXEL_RATIO_NORMAL;
                state.vantaEffect.renderer.setPixelRatio(ratio);
            }

            console.log(`✨ [Effects] Vanta iniciado (tier: ${state.currentTier})`);
        } catch (e) {
            console.error('🎛️ [Effects] Erro ao iniciar Vanta:', e);
        }
    }

    function destroyVanta() {
        if (state.vantaEffect) {
            try {
                state.vantaEffect.destroy();
            } catch (e) {}
            state.vantaEffect = null;
        }
    }

    function pauseVanta(reason) {
        if (!state.vantaEffect) return;
        destroyVanta();
        console.log(`⏸️ [Effects] Vanta pausado (${reason})`);
    }

    function resumeVanta(reason) {
        if (state.vantaEffect) return;
        if (!shouldVantaRun()) return;
        
        initVanta();
        console.log(`▶️ [Effects] Vanta retomado (${reason})`);
    }

    function shouldVantaRun() {
        return (
            state.isDocumentVisible &&
            state.isWindowFocused &&
            !state.isUserTyping &&
            state.currentTier !== 'paused' &&
            !state.prefersReducedMotion
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // DEGRADAÇÃO PROGRESSIVA
    // ═══════════════════════════════════════════════════════════════════
    function degradeTier() {
        const tiers = ['high', 'medium', 'low', 'paused'];
        const currentIndex = tiers.indexOf(state.currentTier);
        
        if (currentIndex < tiers.length - 1) {
            const newTier = tiers[currentIndex + 1];
            console.log(`📉 [Effects] Degradando: ${state.currentTier} → ${newTier}`);
            state.currentTier = newTier;
            
            if (newTier === 'paused') {
                pauseVanta('degradação');
            } else {
                // Reiniciar com nova config
                destroyVanta();
                initVanta();
            }
        }
    }

    function upgradeTier() {
        const tiers = ['high', 'medium', 'low', 'paused'];
        const targetTier = state.isLowEnd ? 'low' : (state.isMobile ? 'medium' : 'high');
        const currentIndex = tiers.indexOf(state.currentTier);
        const targetIndex = tiers.indexOf(targetTier);
        
        if (currentIndex > targetIndex) {
            const newTier = tiers[currentIndex - 1];
            console.log(`📈 [Effects] Melhorando: ${state.currentTier} → ${newTier}`);
            state.currentTier = newTier;
            
            if (state.currentTier !== 'paused') {
                destroyVanta();
                initVanta();
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // BACKDROP-FILTER CONTROLLER
    // ═══════════════════════════════════════════════════════════════════
    function setBackdropState(enabled) {
        if (state.backdropEnabled === enabled) return;
        state.backdropEnabled = enabled;
        
        // Toggle classe no body para CSS handling
        document.body.classList.toggle('perf-blur-disabled', !enabled);
        
        console.log(`🎨 [Effects] Backdrop-filter: ${enabled ? 'ON' : 'OFF'}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // CSS ANIMATIONS CONTROLLER
    // ═══════════════════════════════════════════════════════════════════
    function pauseAnimations() {
        document.body.classList.add('perf-animations-paused');
    }

    function resumeAnimations() {
        document.body.classList.remove('perf-animations-paused');
    }

    // ═══════════════════════════════════════════════════════════════════
    // EVENT HANDLERS
    // ═══════════════════════════════════════════════════════════════════
    function onVisibilityChange() {
        state.isDocumentVisible = document.visibilityState === 'visible';
        
        if (!state.isDocumentVisible) {
            pauseVanta('aba oculta');
            pauseAnimations();
        } else {
            resumeAnimations();
            if (shouldVantaRun()) {
                setTimeout(() => resumeVanta('aba visível'), 100);
            }
        }
    }

    function onWindowBlur() {
        state.isWindowFocused = false;
        // Dar um delay antes de pausar (usuário pode estar só mudando de aba rápido)
        setTimeout(() => {
            if (!state.isWindowFocused) {
                pauseVanta('janela perdeu foco');
            }
        }, 500);
    }

    function onWindowFocus() {
        state.isWindowFocused = true;
        if (shouldVantaRun()) {
            setTimeout(() => resumeVanta('janela focada'), 100);
        }
    }

    function onInputFocus(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            state.isUserTyping = true;
            clearTimeout(state.typingTimer);
            
            // Pausar efeitos pesados durante digitação
            pauseVanta('usuário digitando');
            setBackdropState(false);
        }
    }

    function onInputBlur(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            // Delay antes de reativar
            clearTimeout(state.typingTimer);
            state.typingTimer = setTimeout(() => {
                state.isUserTyping = false;
                if (shouldVantaRun()) {
                    resumeVanta('fim da digitação');
                }
                setBackdropState(true);
            }, 500);
        }
    }

    function onKeyDown(e) {
        // Reset do timer de typing a cada tecla
        if (state.isUserTyping) {
            clearTimeout(state.typingTimer);
            state.typingTimer = setTimeout(() => {
                state.isUserTyping = false;
                if (shouldVantaRun()) {
                    resumeVanta('idle após digitação');
                }
                setBackdropState(true);
            }, CONFIG.INPUT_IDLE_THRESHOLD);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // CALLBACKS DO PERFORMANCE MONITOR
    // ═══════════════════════════════════════════════════════════════════
    function onLongTask(duration) {
        if (duration > 150) {
            state.consecutiveLowFps++;
            if (state.consecutiveLowFps >= 3) {
                degradeTier();
                state.consecutiveLowFps = 0;
            }
        }
    }

    function onLowFps(fps) {
        state.consecutiveLowFps++;
        
        if (state.consecutiveLowFps >= 2) {
            degradeTier();
            
            // Agendar tentativa de recovery
            clearTimeout(state.recoveryTimer);
            state.recoveryTimer = setTimeout(() => {
                const currentFps = window.__getCurrentFps?.() || 60;
                if (currentFps >= 55) {
                    state.consecutiveLowFps = 0;
                    upgradeTier();
                }
            }, CONFIG.FPS_RECOVERY_DELAY);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // API PÚBLICA
    // ═══════════════════════════════════════════════════════════════════
    window.EffectsController = {
        // Estado
        getState: () => ({ ...state }),
        getTier: () => state.currentTier,
        
        // Controle manual
        pause: () => { pauseVanta('manual'); pauseAnimations(); },
        resume: () => { resumeVanta('manual'); resumeAnimations(); },
        
        // Tier control
        setTier: (tier) => {
            if (['high', 'medium', 'low', 'paused'].includes(tier)) {
                state.currentTier = tier;
                destroyVanta();
                if (tier !== 'paused') initVanta();
            }
        },
        
        // Backdrop control
        enableBackdrop: () => setBackdropState(true),
        disableBackdrop: () => setBackdropState(false),
        
        // Callbacks para PerfMon
        onLongTask,
        onLowFps,
        
        // Re-init (útil após resize)
        reinit: () => {
            destroyVanta();
            detectDevice();
            if (shouldVantaRun()) initVanta();
        }
    };

    // ═══════════════════════════════════════════════════════════════════
    // INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    function init() {
        detectDevice();

        // Event listeners
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('blur', onWindowBlur);
        window.addEventListener('focus', onWindowFocus);
        document.addEventListener('focusin', onInputFocus);
        document.addEventListener('focusout', onInputBlur);
        document.addEventListener('keydown', onKeyDown);

        // Resize handler com debounce
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const wasMobile = state.isMobile;
                detectDevice();
                if (wasMobile !== state.isMobile) {
                    window.EffectsController.reinit();
                }
            }, CONFIG.DEBOUNCE_RESIZE);
        });

        // Iniciar Vanta (se aplicável)
        // Delay para garantir que THREE/VANTA carregaram
        const waitForLibs = () => {
            if (typeof VANTA !== 'undefined' && typeof THREE !== 'undefined') {
                if (shouldVantaRun()) {
                    initVanta();
                }
            } else {
                setTimeout(waitForLibs, 100);
            }
        };
        waitForLibs();

        console.log('✅ [Effects] EffectsController inicializado');
    }

    // Iniciar quando DOM pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
