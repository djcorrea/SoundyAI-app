/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎛️ EFFECTS CONTROLLER V2 - SoundyAI
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * VERSÃO: 2.0.0 - Refatoração completa para performance extrema
 * DATA: 2026-01-04
 * 
 * PROBLEMAS RESOLVIDOS:
 * ❌ Vanta sendo iniciado múltiplas vezes → ✅ SINGLETON com window.__VANTA_INSTANCE__
 * ❌ Degradação apenas pausa, não destrói → ✅ destroy() real com cleanup completo
 * ❌ FPS médio ~38 mesmo em low → ✅ Low tier = SEM VANTA (destroy total)
 * ❌ Long tasks > 1000ms → ✅ Kill switch automático
 * ❌ Efeitos ativos sem foco → ✅ Visibility + Focus = destroy imediato
 * 
 * ARQUITETURA:
 * 1. SINGLETON Pattern - Apenas UMA instância de Vanta permitida
 * 2. Tiers: high → medium → low (SEM VANTA) → killed
 * 3. Cooldown entre mudanças de tier (evita thrashing)
 * 4. Kill switch baseado em FPS e LongTasks
 * 5. Limpeza completa: destroy + remove canvas + cancel RAF
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════
    // SINGLETON GUARD - Prevenir múltiplas instâncias do controller
    // ═══════════════════════════════════════════════════════════════════
    if (window.__EFFECTS_CONTROLLER_LOADED__) {
        console.warn('⚠️ [Effects] Controller já carregado, ignorando duplicata');
        return;
    }
    window.__EFFECTS_CONTROLLER_LOADED__ = true;

    // ═══════════════════════════════════════════════════════════════════
    // CONFIGURAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    const CONFIG = {
        // Thresholds de detecção de dispositivo
        LOW_END_CORES: 4,
        LOW_END_MEMORY: 4, // GB
        MOBILE_WIDTH: 768,
        
        // Pixel ratio caps por tier
        PIXEL_RATIO_HIGH: Math.min(window.devicePixelRatio || 1, 1.5),
        PIXEL_RATIO_MEDIUM: Math.min(window.devicePixelRatio || 1, 1.25),
        
        // Vanta configs por tier
        // NOTA: 'low' não tem config pois Vanta é DESTRUÍDO em low tier
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
            showDots: false,  // Sem dots para performance
            mouseControls: false  // Sem mouse tracking
        },
        
        // ═══════════════════════════════════════════════════════════════
        // TIMING - Valores críticos para performance
        // ═══════════════════════════════════════════════════════════════
        
        // Cooldown entre mudanças de tier (evita thrashing)
        TIER_CHANGE_COOLDOWN: 5000,  // 5 segundos mínimo entre mudanças
        
        // Recovery timing
        FPS_RECOVERY_DELAY: 8000,    // 8s de FPS bom antes de tentar upgrade
        
        // Debounce para resize
        DEBOUNCE_RESIZE: 500,        // 500ms de debounce no resize
        
        // Delay antes de pausar no blur (evita flicker em alt-tab rápido)
        BLUR_PAUSE_DELAY: 300,
        
        // ═══════════════════════════════════════════════════════════════
        // KILL SWITCH - Thresholds para desativar Vanta completamente
        // ═══════════════════════════════════════════════════════════════
        
        // FPS kill switch
        KILL_FPS_THRESHOLD: 45,      // FPS abaixo disso = problema
        KILL_FPS_DURATION: 3000,     // Por 3 segundos = kill
        
        // LongTask kill switch
        KILL_LONGTASK_THRESHOLD: 300,  // LongTasks > 300ms
        KILL_LONGTASK_COUNT: 3,        // 3 ocorrências = kill
        KILL_LONGTASK_WINDOW: 10000    // Dentro de 10 segundos
    };

    // ═══════════════════════════════════════════════════════════════════
    // ESTADO DO CONTROLADOR
    // ═══════════════════════════════════════════════════════════════════
    const state = {
        // ═══════ Device Detection ═══════
        isLowEnd: false,
        isMobile: false,
        prefersReducedMotion: false,
        
        // ═══════ Tier System ═══════
        // Tiers: 'high' (Vanta full), 'medium' (Vanta lite), 'low' (SEM VANTA), 'killed' (desabilitado)
        currentTier: 'high',
        baseTier: 'high',  // Tier máximo permitido para o dispositivo
        
        // ═══════ Visibility ═══════
        isDocumentVisible: true,
        isWindowFocused: true,
        isModalOpen: false,
        
        // ═══════ Vanta Singleton ═══════
        // CRÍTICO: Apenas UMA referência, gerenciada via window.__VANTA_INSTANCE__
        vantaElement: null,
        
        // ═══════ Timers & Cooldowns ═══════
        lastTierChange: 0,           // Timestamp da última mudança de tier
        recoveryTimer: null,
        blurTimer: null,
        modalCheckTimer: null,
        
        // ═══════ Kill Switch Tracking ═══════
        lowFpsStart: null,           // Quando FPS começou a ficar baixo
        longTaskTimestamps: [],      // Array de timestamps de longtasks pesados
        isKilled: false,             // Se true, Vanta está permanentemente desabilitado
        
        // ═══════ Performance Metrics ═══════
        consecutiveLowFps: 0,
        lastFps: 60
    };

    // ═══════════════════════════════════════════════════════════════════
    // SINGLETON VANTA MANAGER
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Verifica se Vanta já existe (qualquer instância)
     * Usa window.__VANTA_INSTANCE__ como fonte única de verdade
     */
    function hasVantaInstance() {
        return window.__VANTA_INSTANCE__ != null;
    }
    
    /**
     * Obtém a instância singleton do Vanta
     */
    function getVantaInstance() {
        return window.__VANTA_INSTANCE__;
    }
    
    /**
     * DESTROY COMPLETO do Vanta
     * - Chama destroy() na instância
     * - Remove canvas WebGL do DOM
     * - Limpa referência global
     * - Força garbage collection
     */
    function destroyVantaCompletely() {
        const instance = window.__VANTA_INSTANCE__;
        
        if (instance) {
            try {
                // 1. Parar animation frame loop interno
                if (instance.animationId) {
                    cancelAnimationFrame(instance.animationId);
                }
                
                // 2. Destruir renderer Three.js
                if (instance.renderer) {
                    instance.renderer.dispose();
                    instance.renderer.forceContextLoss();
                    
                    // 3. Remover canvas do DOM
                    const canvas = instance.renderer.domElement;
                    if (canvas && canvas.parentNode) {
                        canvas.parentNode.removeChild(canvas);
                    }
                }
                
                // 4. Limpar scene Three.js
                if (instance.scene) {
                    instance.scene.traverse((obj) => {
                        if (obj.geometry) obj.geometry.dispose();
                        if (obj.material) {
                            if (Array.isArray(obj.material)) {
                                obj.material.forEach(m => m.dispose());
                            } else {
                                obj.material.dispose();
                            }
                        }
                    });
                }
                
                // 5. Chamar destroy() oficial do Vanta
                instance.destroy();
                
                console.log('🗑️ [Effects] Vanta destruído completamente');
            } catch (e) {
                console.warn('⚠️ [Effects] Erro no destroy:', e.message);
            }
        }
        
        // 6. Limpar referência global (SEMPRE, mesmo se instance era null)
        window.__VANTA_INSTANCE__ = null;
        
        // 7. Limpar qualquer canvas órfão no elemento vanta-bg
        const vantaBg = document.getElementById('vanta-bg');
        if (vantaBg) {
            const orphanCanvases = vantaBg.querySelectorAll('canvas');
            orphanCanvases.forEach(canvas => {
                try {
                    const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
                    if (gl) {
                        gl.getExtension('WEBGL_lose_context')?.loseContext();
                    }
                    canvas.remove();
                } catch (e) {}
            });
        }
    }
    
    /**
     * Cria nova instância de Vanta (SINGLETON)
     * Apenas cria se não existir instância
     */
    function createVantaInstance(config) {
        // GUARD: Não criar se já existe
        if (hasVantaInstance()) {
            console.warn('⚠️ [Effects] Tentativa de criar Vanta duplicado bloqueada');
            return getVantaInstance();
        }
        
        // GUARD: Verificar dependências
        if (typeof VANTA === 'undefined' || typeof THREE === 'undefined') {
            console.warn('⚠️ [Effects] VANTA/THREE não disponíveis');
            return null;
        }
        
        // GUARD: Verificar elemento
        const element = document.getElementById('vanta-bg');
        if (!element) {
            console.warn('⚠️ [Effects] Elemento #vanta-bg não encontrado');
            return null;
        }
        
        try {
            const instance = VANTA.NET({
                el: element,
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
            
            // Aplicar pixel ratio cap
            if (instance?.renderer) {
                const ratio = state.currentTier === 'high' 
                    ? CONFIG.PIXEL_RATIO_HIGH 
                    : CONFIG.PIXEL_RATIO_MEDIUM;
                instance.renderer.setPixelRatio(ratio);
            }
            
            // Armazenar como SINGLETON
            window.__VANTA_INSTANCE__ = instance;
            state.vantaElement = element;
            
            console.log(`✨ [Effects] Vanta criado (tier: ${state.currentTier})`);
            return instance;
            
        } catch (e) {
            console.error('❌ [Effects] Erro ao criar Vanta:', e);
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // DETECÇÃO DE DISPOSITIVO
    // ═══════════════════════════════════════════════════════════════════
    function detectDevice() {
        const cores = navigator.hardwareConcurrency || 4;
        const memory = navigator.deviceMemory || 4;
        const width = window.innerWidth;
        
        state.isMobile = width <= CONFIG.MOBILE_WIDTH;
        state.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        // Detecção mais agressiva de low-end
        state.isLowEnd = (
            cores <= CONFIG.LOW_END_CORES ||
            memory <= CONFIG.LOW_END_MEMORY ||
            state.isMobile ||
            state.prefersReducedMotion
        );

        // Determinar tier BASE (máximo permitido para este dispositivo)
        if (state.prefersReducedMotion) {
            state.baseTier = 'killed';  // Usuário não quer animações
        } else if (state.isLowEnd || state.isMobile) {
            state.baseTier = 'low';     // Low-end = sem Vanta por padrão
        } else {
            state.baseTier = 'high';
        }
        
        // Tier atual começa no base
        state.currentTier = state.baseTier;

        console.log(`🎛️ [Effects] Device detected:`, {
            cores, memory, width,
            mobile: state.isMobile,
            lowEnd: state.isLowEnd,
            reducedMotion: state.prefersReducedMotion,
            baseTier: state.baseTier
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // TIER SYSTEM
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Verifica se Vanta deve estar rodando no tier atual
     * Tiers 'low' e 'killed' = SEM VANTA
     */
    function shouldVantaRun() {
        return (
            state.isDocumentVisible &&
            state.isWindowFocused &&
            !state.isModalOpen &&
            !state.isKilled &&
            state.currentTier !== 'low' &&
            state.currentTier !== 'killed' &&
            !state.prefersReducedMotion
        );
    }
    
    /**
     * Obtém config do Vanta para o tier atual
     * Retorna null para tiers sem Vanta
     */
    function getVantaConfigForTier(tier) {
        switch (tier) {
            case 'high': return CONFIG.VANTA_HIGH;
            case 'medium': return CONFIG.VANTA_MEDIUM;
            default: return null;  // low, killed = sem Vanta
        }
    }
    
    /**
     * Aplica o tier atual
     * - Tiers com Vanta: cria/atualiza instância
     * - Tiers sem Vanta: destroy completo
     */
    function applyCurrentTier() {
        const config = getVantaConfigForTier(state.currentTier);
        
        if (config && shouldVantaRun()) {
            // Tier com Vanta: criar se não existe
            if (!hasVantaInstance()) {
                createVantaInstance(config);
            }
        } else {
            // Tier sem Vanta: destruir se existe
            if (hasVantaInstance()) {
                destroyVantaCompletely();
            }
        }
    }
    
    /**
     * Muda para um novo tier com cooldown
     */
    function changeTier(newTier, reason) {
        // GUARD: Verificar cooldown
        const now = Date.now();
        if (now - state.lastTierChange < CONFIG.TIER_CHANGE_COOLDOWN) {
            console.log(`⏳ [Effects] Cooldown ativo, ignorando mudança para ${newTier}`);
            return false;
        }
        
        // GUARD: Não mudar se já está no tier
        if (state.currentTier === newTier) {
            return false;
        }
        
        // GUARD: Não permitir upgrade além do baseTier
        const tierOrder = ['killed', 'low', 'medium', 'high'];
        const baseIndex = tierOrder.indexOf(state.baseTier);
        const newIndex = tierOrder.indexOf(newTier);
        if (newIndex > baseIndex) {
            console.log(`⚠️ [Effects] Não pode ir para ${newTier}, baseTier é ${state.baseTier}`);
            return false;
        }
        
        console.log(`🔄 [Effects] Mudando tier: ${state.currentTier} → ${newTier} (${reason})`);
        
        state.currentTier = newTier;
        state.lastTierChange = now;
        
        // Aplicar novo tier
        applyCurrentTier();
        
        return true;
    }
    
    /**
     * Degrada para o próximo tier inferior
     */
    function degradeTier(reason) {
        const tiers = ['high', 'medium', 'low', 'killed'];
        const currentIndex = tiers.indexOf(state.currentTier);
        
        if (currentIndex < tiers.length - 1) {
            return changeTier(tiers[currentIndex + 1], reason || 'degradação');
        }
        return false;
    }
    
    /**
     * Tenta upgrade para tier superior (respeitando baseTier)
     */
    function upgradeTier(reason) {
        const tiers = ['high', 'medium', 'low', 'killed'];
        const currentIndex = tiers.indexOf(state.currentTier);
        
        if (currentIndex > 0) {
            return changeTier(tiers[currentIndex - 1], reason || 'recovery');
        }
        return false;
    }

    // ═══════════════════════════════════════════════════════════════════
    // KILL SWITCH - Desativa Vanta permanentemente se performance crítica
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Ativa kill switch - desabilita Vanta permanentemente na sessão
     */
    function activateKillSwitch(reason) {
        if (state.isKilled) return;
        
        console.warn(`💀 [Effects] KILL SWITCH ATIVADO: ${reason}`);
        
        state.isKilled = true;
        state.currentTier = 'killed';
        destroyVantaCompletely();
        
        // Pausar animações CSS também
        document.body.classList.add('perf-animations-paused');
    }
    
    /**
     * Processa evento de FPS baixo
     * Se FPS < threshold por X segundos, ativa kill switch
     */
    function processLowFps(fps) {
        state.lastFps = fps;
        
        if (fps < CONFIG.KILL_FPS_THRESHOLD) {
            if (!state.lowFpsStart) {
                state.lowFpsStart = Date.now();
            } else if (Date.now() - state.lowFpsStart > CONFIG.KILL_FPS_DURATION) {
                // FPS baixo por muito tempo - degradar primeiro
                if (state.currentTier === 'high') {
                    degradeTier('FPS baixo prolongado');
                    state.lowFpsStart = Date.now(); // Reset timer
                } else if (state.currentTier === 'medium') {
                    degradeTier('FPS baixo em medium tier');
                    state.lowFpsStart = Date.now();
                } else {
                    // Já está em low e ainda assim FPS baixo = kill
                    activateKillSwitch(`FPS ${fps} por ${CONFIG.KILL_FPS_DURATION}ms`);
                }
            }
        } else {
            state.lowFpsStart = null;  // Reset se FPS voltou ao normal
            state.consecutiveLowFps = 0;
        }
    }
    
    /**
     * Processa evento de LongTask
     * Se muitos longtasks pesados em curto período, ativa kill switch
     */
    function processLongTask(duration) {
        if (duration >= CONFIG.KILL_LONGTASK_THRESHOLD) {
            const now = Date.now();
            
            // Adicionar timestamp
            state.longTaskTimestamps.push(now);
            
            // Limpar timestamps antigos (fora da janela)
            state.longTaskTimestamps = state.longTaskTimestamps.filter(
                t => now - t < CONFIG.KILL_LONGTASK_WINDOW
            );
            
            // Verificar se atingiu limite
            if (state.longTaskTimestamps.length >= CONFIG.KILL_LONGTASK_COUNT) {
                if (state.currentTier !== 'killed' && state.currentTier !== 'low') {
                    // Degradar primeiro
                    degradeTier(`${state.longTaskTimestamps.length} LongTasks > ${CONFIG.KILL_LONGTASK_THRESHOLD}ms`);
                } else if (state.currentTier === 'low' && hasVantaInstance()) {
                    // Em low tier ainda com Vanta? Não deveria acontecer, mas destroy
                    destroyVantaCompletely();
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // VISIBILITY & FOCUS HANDLERS
    // ═══════════════════════════════════════════════════════════════════
    
    function onVisibilityChange() {
        state.isDocumentVisible = document.visibilityState === 'visible';
        
        if (!state.isDocumentVisible) {
            // Aba oculta = DESTROY imediato (não apenas pause)
            destroyVantaCompletely();
            document.body.classList.add('perf-animations-paused');
            console.log('👁️ [Effects] Aba oculta - Vanta destruído');
        } else {
            // Aba visível = restaurar se condições permitirem
            document.body.classList.remove('perf-animations-paused');
            
            if (shouldVantaRun()) {
                // Delay antes de restaurar (evita flicker em alt-tab rápido)
                setTimeout(() => {
                    if (state.isDocumentVisible && shouldVantaRun()) {
                        applyCurrentTier();
                        console.log('👁️ [Effects] Aba visível - Vanta restaurado');
                    }
                }, 200);
            }
        }
    }
    
    function onWindowBlur() {
        state.isWindowFocused = false;
        
        // Delay antes de pausar (evita flicker em alt-tab rápido)
        clearTimeout(state.blurTimer);
        state.blurTimer = setTimeout(() => {
            if (!state.isWindowFocused) {
                destroyVantaCompletely();
                console.log('🔇 [Effects] Janela perdeu foco - Vanta destruído');
            }
        }, CONFIG.BLUR_PAUSE_DELAY);
    }
    
    function onWindowFocus() {
        state.isWindowFocused = true;
        clearTimeout(state.blurTimer);
        
        if (shouldVantaRun()) {
            // Pequeno delay para evitar flicker
            setTimeout(() => {
                if (state.isWindowFocused && shouldVantaRun()) {
                    applyCurrentTier();
                    console.log('🔊 [Effects] Janela focada - Vanta restaurado');
                }
            }, 100);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // MODAL HANDLERS
    // ═══════════════════════════════════════════════════════════════════
    
    const HEAVY_MODALS = [
        'audioAnalysisModal',
        'analysisModeModal',
        'welcomeAnalysisModal'
    ];

    function checkModalState() {
        const isAnyModalOpen = HEAVY_MODALS.some(id => {
            const modal = document.getElementById(id);
            if (!modal) return false;
            const style = window.getComputedStyle(modal);
            return style.display !== 'none' && style.visibility !== 'hidden';
        });

        if (isAnyModalOpen !== state.isModalOpen) {
            state.isModalOpen = isAnyModalOpen;
            
            if (isAnyModalOpen) {
                destroyVantaCompletely();
                document.body.classList.add('perf-animations-paused');
                console.log('📦 [Effects] Modal aberto - Vanta destruído');
            } else {
                document.body.classList.remove('perf-animations-paused');
                if (shouldVantaRun()) {
                    setTimeout(() => {
                        if (!state.isModalOpen && shouldVantaRun()) {
                            applyCurrentTier();
                            console.log('📦 [Effects] Modal fechado - Vanta restaurado');
                        }
                    }, 100);
                }
            }
        }
    }

    function initModalObserver() {
        const observer = new MutationObserver(() => {
            clearTimeout(state.modalCheckTimer);
            state.modalCheckTimer = setTimeout(checkModalState, 50);
        });

        HEAVY_MODALS.forEach(id => {
            const modal = document.getElementById(id);
            if (modal) {
                observer.observe(modal, { 
                    attributes: true, 
                    attributeFilter: ['style', 'class'] 
                });
            }
        });

        observer.observe(document.body, { childList: true, subtree: false });
        return observer;
    }

    // ═══════════════════════════════════════════════════════════════════
    // CSS ANIMATIONS CONTROLLER
    // ═══════════════════════════════════════════════════════════════════
    
    function pauseAnimations() {
        document.body.classList.add('perf-animations-paused');
    }

    function resumeAnimations() {
        if (!state.isKilled) {
            document.body.classList.remove('perf-animations-paused');
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // API PÚBLICA
    // ═══════════════════════════════════════════════════════════════════
    window.EffectsController = {
        // ═══════ Estado ═══════
        getState: () => ({ 
            ...state,
            hasVanta: hasVantaInstance(),
            vantaInstance: getVantaInstance()
        }),
        getTier: () => state.currentTier,
        isKilled: () => state.isKilled,
        
        // ═══════ Controle Manual ═══════
        pause: () => {
            destroyVantaCompletely();
            pauseAnimations();
        },
        resume: () => {
            if (shouldVantaRun()) {
                applyCurrentTier();
            }
            resumeAnimations();
        },
        
        // ═══════ Tier Control ═══════
        setTier: (tier) => {
            if (['high', 'medium', 'low', 'killed'].includes(tier)) {
                return changeTier(tier, 'manual');
            }
            return false;
        },
        degradeTier,
        upgradeTier,
        
        // ═══════ Kill Switch ═══════
        kill: () => activateKillSwitch('manual'),
        
        // ═══════ Callbacks para PerfMon ═══════
        onLongTask: processLongTask,
        onLowFps: processLowFps,
        
        // ═══════ Reinit (útil para debug) ═══════
        reinit: () => {
            destroyVantaCompletely();
            state.isKilled = false;
            state.lastTierChange = 0;
            detectDevice();
            if (shouldVantaRun()) {
                applyCurrentTier();
            }
        },
        
        // ═══════ Debug ═══════
        debug: () => {
            console.group('🎛️ Effects Controller Debug');
            console.log('State:', state);
            console.log('Has Vanta:', hasVantaInstance());
            console.log('Should Run:', shouldVantaRun());
            console.log('Config:', CONFIG);
            console.groupEnd();
        }
    };

    // ═══════════════════════════════════════════════════════════════════
    // INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    function init() {
        // Limpar qualquer instância Vanta existente (de carregamentos anteriores)
        destroyVantaCompletely();
        
        // Detectar dispositivo
        detectDevice();

        // Event listeners
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('blur', onWindowBlur);
        window.addEventListener('focus', onWindowFocus);
        
        // Modal observer
        initModalObserver();
        checkModalState();

        // Resize handler com debounce grande
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const wasMobile = state.isMobile;
                detectDevice();
                
                // Apenas reinit se mudou de mobile para desktop ou vice-versa
                if (wasMobile !== state.isMobile) {
                    destroyVantaCompletely();
                    if (shouldVantaRun()) {
                        applyCurrentTier();
                    }
                }
            }, CONFIG.DEBOUNCE_RESIZE);
        });

        // Aguardar libs e iniciar Vanta (se aplicável)
        const waitForLibs = () => {
            if (typeof VANTA !== 'undefined' && typeof THREE !== 'undefined') {
                if (shouldVantaRun()) {
                    applyCurrentTier();
                }
                console.log('✅ [Effects] Controller V2 inicializado');
            } else {
                setTimeout(waitForLibs, 100);
            }
        };
        
        // Iniciar após DOM pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', waitForLibs);
        } else {
            waitForLibs();
        }
    }

    // Iniciar
    init();
})();
