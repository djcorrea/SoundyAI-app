/**
 * ⚡ PERFORMANCE OPTIMIZER - Sistema de Otimização Dinâmica
 * 
 * Sistema enterprise de gerenciamento de performance visual
 * Mantém visual premium com custo computacional mínimo
 * 
 * ESTRATÉGIA:
 * - Visual completo apenas em momentos estratégicos (hero, primeira impressão)
 * - Light mode automático durante uso real (chat, modais, análise)
 * - Pausa animações quando aba perde foco
 * - Lazy load de efeitos gráficos
 * 
 * TARGET:
 * - CPU idle: < 3%
 * - RAM frontend: < 300MB
 * - GPU: mínimo durante uso
 * 
 * @version 1.0.0 - PERFORMANCE FIRST
 * @date 2026-02-03
 */

(function() {
    'use strict';
    
    const log = window.log || console.log;
    
    // ═══════════════════════════════════════════════════════════
    // 🎯 CONFIGURAÇÃO
    // ═══════════════════════════════════════════════════════════
    
    const CONFIG = {
        // Ativar light mode automaticamente em
        autoLightModeOn: [
            'modal-open',      // Qualquer modal aberto
            'chat-active',     // Chat em uso
            'analysis-running',// Análise de áudio
            'tab-hidden'       // Aba perdeu foco
        ],
        
        // Manter modo visual completo apenas em
        keepHeavyEffects: [
            'landing-hero',    // Hero da landing page
            'first-load'       // Primeiros 2s do load
        ],
        
        // Thresholds de performance
        maxIdleCPU: 3,         // % máximo de CPU idle
        maxRAM: 300,           // MB máximo de RAM
        
        // Logging
        debug: new URLSearchParams(window.location.search).get('perf_debug') === '1'
    };
    
    // ═══════════════════════════════════════════════════════════
    // 📊 ESTADO
    // ═══════════════════════════════════════════════════════════
    
    const state = {
        mode: 'heavy',         // 'heavy' | 'light'
        tabVisible: true,
        modalOpen: false,
        chatActive: false,
        analysisRunning: false,
        firstLoadComplete: false,
        animationsPaused: false
    };
    
    // ═══════════════════════════════════════════════════════════
    // 🎨 MODO LIGHT (Performance Otimizada)
    // ═══════════════════════════════════════════════════════════
    
    function activateLightMode(reason) {
        if (state.mode === 'light') return;
        
        log(`⚡ [PERF-OPT] Ativando LIGHT MODE (razão: ${reason})`);
        
        state.mode = 'light';
        document.body.classList.add('perf-light-mode');
        document.body.classList.remove('perf-heavy-mode');
        
        // Pausar animações caras
        pauseHeavyAnimations();
        
        // Logs de economia
        if (CONFIG.debug) {
            log('⚡ [PERF-OPT] Efeitos desativados:');
            log('  - backdrop-filter reduzido (20px → 3px)');
            log('  - box-shadow leve');
            log('  - animações infinite pausadas');
            log('  - gradientes estáticos');
        }
    }
    
    function activateHeavyMode(reason) {
        if (state.mode === 'heavy') return;
        
        log(`🎨 [PERF-OPT] Ativando HEAVY MODE (razão: ${reason})`);
        
        state.mode = 'heavy';
        document.body.classList.add('perf-heavy-mode');
        document.body.classList.remove('perf-light-mode');
        
        // Reativar animações
        resumeHeavyAnimations();
        
        if (CONFIG.debug) {
            log('🎨 [PERF-OPT] Efeitos visuais completos ativos');
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // ⏸️ CONTROLE DE ANIMAÇÕES
    // ═══════════════════════════════════════════════════════════
    
    function pauseHeavyAnimations() {
        if (state.animationsPaused) return;
        
        state.animationsPaused = true;
        
        // Pausar animações CSS infinite
        const animatedElements = document.querySelectorAll([
            '[data-animation="infinite"]',
            '.spinner-loading',
            '.pulse-animation',
            '.shimmer-effect',
            '.glow-pulse',
            '.ai-pulse',
            '.float-animation'
        ].join(','));
        
        animatedElements.forEach(el => {
            el.style.animationPlayState = 'paused';
        });
        
        // Marcar elementos para identificação
        document.documentElement.setAttribute('data-animations-paused', 'true');
        
        log(`⏸️ [PERF-OPT] ${animatedElements.length} animações pausadas`);
    }
    
    function resumeHeavyAnimations() {
        if (!state.animationsPaused) return;
        
        state.animationsPaused = false;
        
        const animatedElements = document.querySelectorAll([
            '[data-animation="infinite"]',
            '.spinner-loading',
            '.pulse-animation',
            '.shimmer-effect',
            '.glow-pulse',
            '.ai-pulse',
            '.float-animation'
        ].join(','));
        
        animatedElements.forEach(el => {
            el.style.animationPlayState = 'running';
        });
        
        document.documentElement.removeAttribute('data-animations-paused');
        
        log(`▶️ [PERF-OPT] ${animatedElements.length} animações retomadas`);
    }
    
    // ═══════════════════════════════════════════════════════════
    // 👁️ DETECTORES DE CONTEXTO
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Detecta abertura de modais
     */
    function setupModalDetection() {
        // MutationObserver para detectar modais
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    
                    // Detectar modal visível
                    if (target.classList && (
                        target.classList.contains('modal') ||
                        target.classList.contains('popup-overlay') ||
                        target.id?.includes('Modal') ||
                        target.id?.includes('modal')
                    )) {
                        const isVisible = target.style.display !== 'none' &&
                                        target.classList.contains('show') ||
                                        target.classList.contains('active') ||
                                        target.classList.contains('visible');
                        
                        if (isVisible && !state.modalOpen) {
                            state.modalOpen = true;
                            activateLightMode('modal-open');
                        } else if (!isVisible && state.modalOpen) {
                            state.modalOpen = false;
                            checkIfShouldEnableHeavyMode();
                        }
                    }
                }
            }
        });
        
        // Observar todo o body
        observer.observe(document.body, {
            attributes: true,
            subtree: true,
            attributeFilter: ['class', 'style']
        });
        
        log('👁️ [PERF-OPT] Modal detection ativo');
    }
    
    /**
     * Detecta atividade no chat
     */
    function setupChatDetection() {
        // Detectar foco no input do chat
        document.addEventListener('focusin', (e) => {
            if (e.target.matches('#userMessage, .chat-input, .message-input')) {
                state.chatActive = true;
                activateLightMode('chat-active');
            }
        });
        
        document.addEventListener('focusout', (e) => {
            if (e.target.matches('#userMessage, .chat-input, .message-input')) {
                state.chatActive = false;
                setTimeout(() => checkIfShouldEnableHeavyMode(), 500);
            }
        });
        
        log('👁️ [PERF-OPT] Chat detection ativo');
    }
    
    /**
     * Detecta análise de áudio
     */
    function setupAnalysisDetection() {
        // Interceptar início de análise
        const originalAnalyze = window.analyzeAudioFile || window.audioAnalyzer?.analyzeAudioFile;
        
        if (originalAnalyze) {
            window.analyzeAudioFile = async function(...args) {
                state.analysisRunning = true;
                activateLightMode('analysis-running');
                
                try {
                    return await originalAnalyze.apply(this, args);
                } finally {
                    state.analysisRunning = false;
                    checkIfShouldEnableHeavyMode();
                }
            };
            
            log('👁️ [PERF-OPT] Analysis detection ativo');
        }
    }
    
    /**
     * Detecta visibilidade da aba
     */
    function setupTabVisibilityDetection() {
        document.addEventListener('visibilitychange', () => {
            state.tabVisible = !document.hidden;
            
            if (document.hidden) {
                log('👁️ [PERF-OPT] Aba oculta - pausando animações');
                pauseHeavyAnimations();
                activateLightMode('tab-hidden');
            } else {
                log('👁️ [PERF-OPT] Aba visível - verificando contexto');
                resumeHeavyAnimations();
                checkIfShouldEnableHeavyMode();
            }
        });
        
        log('👁️ [PERF-OPT] Tab visibility detection ativo');
    }
    
    /**
     * Verifica se deve ativar heavy mode
     */
    function checkIfShouldEnableHeavyMode() {
        // Se qualquer contexto exigir light mode, manter
        if (state.modalOpen || state.chatActive || state.analysisRunning || !state.tabVisible) {
            return;
        }
        
        // Caso contrário, pode voltar para heavy mode
        activateHeavyMode('idle-state');
    }
    
    // ═══════════════════════════════════════════════════════════
    // 🚀 PRIMEIRA CARGA (2s de visual completo)
    // ═══════════════════════════════════════════════════════════
    
    function handleFirstLoad() {
        log('🚀 [PERF-OPT] Primeira carga - visual completo por 2s');
        
        // Heavy mode inicial para impressão
        activateHeavyMode('first-load');
        
        // Após 2s, ativar light mode automaticamente
        setTimeout(() => {
            state.firstLoadComplete = true;
            activateLightMode('first-load-complete');
        }, 2000);
    }
    
    // ═══════════════════════════════════════════════════════════
    // 📈 MONITORAMENTO DE PERFORMANCE (OPCIONAL)
    // ═══════════════════════════════════════════════════════════
    
    function startPerformanceMonitoring() {
        if (!CONFIG.debug) return;
        
        // Monitorar RAM
        if (performance.memory) {
            setInterval(() => {
                const usedRAM = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                
                if (usedRAM > CONFIG.maxRAM) {
                    log(`⚠️ [PERF-OPT] RAM elevada: ${usedRAM}MB (target: ${CONFIG.maxRAM}MB)`);
                }
            }, 10000); // Check a cada 10s
        }
        
        log('📈 [PERF-OPT] Performance monitoring ativo');
    }
    
    // ═══════════════════════════════════════════════════════════
    // 🌐 API PÚBLICA
    // ═══════════════════════════════════════════════════════════
    
    window.PerformanceOptimizer = {
        // Controle manual
        activateLightMode: () => activateLightMode('manual'),
        activateHeavyMode: () => activateHeavyMode('manual'),
        
        // Estado
        getState: () => ({ ...state }),
        getMode: () => state.mode,
        
        // Animações
        pauseAnimations: pauseHeavyAnimations,
        resumeAnimations: resumeHeavyAnimations,
        
        // Versão
        version: '1.0.0'
    };
    
    // ═══════════════════════════════════════════════════════════
    // 🎬 INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════
    
    function init() {
        log('⚡ [PERF-OPT] Performance Optimizer inicializando...');
        
        // Aguardar DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setupDetectors();
                handleFirstLoad();
            });
        } else {
            setupDetectors();
            handleFirstLoad();
        }
        
        // Performance monitoring
        if (CONFIG.debug) {
            startPerformanceMonitoring();
        }
        
        log('✅ [PERF-OPT] Performance Optimizer pronto');
        log(`Target: CPU idle < ${CONFIG.maxIdleCPU}%, RAM < ${CONFIG.maxRAM}MB`);
    }
    
    function setupDetectors() {
        setupModalDetection();
        setupChatDetection();
        setupAnalysisDetection();
        setupTabVisibilityDetection();
    }
    
    // Iniciar
    init();
    
})();
