/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎛️ EFFECTS CONTROLLER V3.1 - SoundyAI
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * VERSÃO: 3.1.0 - Vanta Sempre Ativo com Performance Otimizada
 * DATA: 2026-01-05
 * 
 * MELHORIAS V3.1:
 * ✅ Vanta permanece ativo em TODOS os tiers (high, medium, low)
 * ✅ Configuração VANTA_LOW ultra-leve (2 pontos, spacing 30)
 * ✅ Thresholds muito menos agressivos:
 *    - FPS < 40 por 5s → high → medium
 *    - FPS < 30 por 8s → medium → low (ainda com Vanta!)
 *    - FPS < 20 por 15s → KILL (último recurso)
 * ✅ Dispositivos mobile/low-end começam em tier MEDIUM (não low)
 * ✅ LongTask threshold muito tolerante (300ms, 12 ocorrências em 20s)
 * ✅ Configuração HIGH mais leve por padrão (sem dots, menos pontos)
 * 
 * OBJETIVO: Manter animação interativa sempre rodando, apenas reduzindo
 * intensidade gradualmente conforme necessário para performance.
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
    // CONFIGURAÇÃO V3 - Degradação Progressiva Suavizada
    // ═══════════════════════════════════════════════════════════════════
    const CONFIG = {
        // Thresholds de detecção de dispositivo
        LOW_END_CORES: 4,
        LOW_END_MEMORY: 4, // GB
        MOBILE_WIDTH: 768,
        
        // Pixel ratio caps por tier
        PIXEL_RATIO_HIGH: Math.min(window.devicePixelRatio || 1, 1.5),
        PIXEL_RATIO_MEDIUM: Math.min(window.devicePixelRatio || 1, 1.25),
        PIXEL_RATIO_LOW: Math.min(window.devicePixelRatio || 1, 0.75), // Cap agressivo
        
        // Vanta configs por tier
        // NOTA: Aumentado densidade e alcance para melhor visualização
        VANTA_HIGH: {
            points: 8.0,        // Aumentado para mais partículas
            maxDistance: 24.0,  // Aumentado para alcançar os lados
            spacing: 16.0,      // Reduzido para mais densidade
            showDots: true,     // Ativado para melhor visualização
            mouseControls: true
        },
        VANTA_MEDIUM: {
            points: 6.0,        // Aumentado
            maxDistance: 20.0,  // Aumentado alcance
            spacing: 18.0,      // Mais denso
            showDots: true,
            mouseControls: true
        },
        VANTA_LOW: {            // Configuração leve mas visível
            points: 4.0,        // Aumentado
            maxDistance: 16.0,  // Maior alcance
            spacing: 22.0,      // Mais denso
            showDots: false,
            mouseControls: false
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
        
        // Debounce para destroy (evita múltiplas chamadas)
        DESTROY_DEBOUNCE: 500,       // 500ms de debounce no destroy
        
        // ═══════════════════════════════════════════════════════════════
        // DEGRADAÇÃO PROGRESSIVA (menos agressiva - manter Vanta rodando)
        // ═══════════════════════════════════════════════════════════════
        
        // Tier 1: FPS < 40 por 5s → high → medium
        DEGRADE_FPS_TIER1: 40,
        DEGRADE_DURATION_TIER1: 5000,
        
        // Tier 2: FPS < 30 por 8s → medium → low (ainda com Vanta leve)
        DEGRADE_FPS_TIER2: 30,
        DEGRADE_DURATION_TIER2: 8000,
        
        // Tier 3: FPS < 20 por 15s → KILL (extremamente crítico)
        KILL_FPS_THRESHOLD: 20,
        KILL_FPS_DURATION: 15000,
        
        // ═══════════════════════════════════════════════════════════════
        // LONGTASK THRESHOLDS (muito mais tolerante)
        // ═══════════════════════════════════════════════════════════════
        KILL_LONGTASK_THRESHOLD: 300,  // LongTasks > 300ms (era 200ms)
        KILL_LONGTASK_COUNT: 12,       // 12 ocorrências = degrade (era 8)
        KILL_LONGTASK_WINDOW: 20000,   // Dentro de 20 segundos (era 15s)
        
        // ═══════════════════════════════════════════════════════════════
        // RECOVERY (upgrade de tier quando FPS está bom)
        // ═══════════════════════════════════════════════════════════════
        RECOVERY_FPS_THRESHOLD: 55,   // FPS bom para recovery
        RECOVERY_DURATION: 5000,      // Por 5 segundos
        RECOVERY_COOLDOWN: 10000,     // Cooldown entre upgrades
        
        // ═══════════════════════════════════════════════════════════════
        // MODO DIGITAÇÃO
        // ═══════════════════════════════════════════════════════════════
        TYPING_DEBOUNCE: 1000,        // Pausa efeitos por 1s após keystroke
        TYPING_REDUCE_TIER: true      // Reduzir tier durante digitação
    };

    // ═══════════════════════════════════════════════════════════════════
    // ESTADO DO CONTROLADOR V3
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
        destroyDebounceTimer: null,  // Timer para debounce do destroy
        
        // ═══════ Kill Switch Tracking ═══════
        lowFpsStart: null,           // Quando FPS começou a ficar baixo
        longTaskTimestamps: [],      // Array de timestamps de longtasks pesados
        isKilled: false,             // Se true, Vanta está permanentemente desabilitado
        
        // ═══════ Destroy Lock ═══════
        isDestroying: false,         // Lock para evitar destroy duplicado
        isDestroyed: false,          // Flag de estado destruído
        
        // ═══════ Modo Digitação ═══════
        isTyping: false,             // Se usuário está digitando
        typingTimeout: null,         // Timer para reset do modo digitação
        tierBeforeTyping: null,      // Tier salvo antes de entrar em typing mode
        
        // ═══════ FPS Recovery Tracking ═══════
        goodFpsStart: null,          // Quando FPS começou a ficar bom
        lastRecoveryAttempt: 0,      // Timestamp da última tentativa de recovery
        
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
     * DESTROY COMPLETO do Vanta (IDEMPOTENTE)
     * - Verifica locks para evitar chamadas duplicadas
     * - Chama destroy() na instância
     * - Remove canvas WebGL do DOM de forma segura
     * - Limpa referência global
     * - Força garbage collection
     */
    function destroyVantaCompletely() {
        // GUARD: Verificar lock de destroy
        if (state.isDestroying) {
            console.log('⏳ [Effects] Destroy já em andamento, ignorando');
            return;
        }
        
        // GUARD: Verificar se já está destruído
        const instance = window.__VANTA_INSTANCE__;
        if (!instance && state.isDestroyed) {
            return; // Silenciosamente ignora se já destruído
        }
        
        // Ativar lock
        state.isDestroying = true;
        
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
                    
                    // 3. Remover canvas do DOM de forma SEGURA
                    const canvas = instance.renderer.domElement;
                    if (canvas && canvas.parentNode) {
                        // CRÍTICO: Verificar se canvas é realmente filho do parent
                        try {
                            if (canvas.parentNode.contains(canvas)) {
                                canvas.parentNode.removeChild(canvas);
                            }
                        } catch (removeErr) {
                            // Silenciosamente ignora erro de removeChild
                            console.log('⚠️ [Effects] Canvas já removido do DOM');
                        }
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
                if (typeof instance.destroy === 'function') {
                    instance.destroy();
                }
                
                console.log('🗑️ [Effects] Vanta destruído completamente');
            } catch (e) {
                // Não logar como warning para evitar spam - destroy pode falhar se já destruído
                console.log('⚠️ [Effects] Destroy parcial:', e.message);
            }
        }
        
        // 6. Limpar referência global (SEMPRE, mesmo se instance era null)
        window.__VANTA_INSTANCE__ = null;
        state.isDestroyed = true;
        
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
                    if (canvas.parentNode && canvas.parentNode.contains(canvas)) {
                        canvas.remove();
                    }
                } catch (e) {}
            });
        }
        
        // 8. Liberar lock após pequeno delay (evita race conditions)
        setTimeout(() => {
            state.isDestroying = false;
        }, 100);
    }
    
    /**
     * Wrapper com debounce para destroy
     * Evita múltiplas chamadas em sequência rápida
     */
    function destroyVantaDebounced() {
        clearTimeout(state.destroyDebounceTimer);
        state.destroyDebounceTimer = setTimeout(() => {
            destroyVantaCompletely();
        }, CONFIG.DESTROY_DEBOUNCE);
    }
    
    /**
     * Cria nova instância de Vanta (SINGLETON)
     * Apenas cria se não existir instância
     */
    function createVantaInstance(config) {
        // GUARD: Não criar se já existe
        if (hasVantaInstance()) {
            console.log('⚠️ [Effects] Tentativa de criar Vanta duplicado bloqueada');
            return getVantaInstance();
        }
        
        // GUARD: Não criar se destroy em andamento
        if (state.isDestroying) {
            console.log('⏳ [Effects] Destroy em andamento, não criando Vanta');
            return null;
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
                scale: 1.5,        // Aumentado para cobrir mais área
                scaleMobile: 1.2,  // Aumentado no mobile também
                color: 0x8a2be2,
                backgroundColor: 0x0a0a1a,
                points: config.points,
                maxDistance: config.maxDistance,
                spacing: config.spacing,
                showDots: config.showDots
            });
            
            // Aplicar pixel ratio cap baseado no tier
            if (instance?.renderer) {
                let ratio;
                switch (state.currentTier) {
                    case 'high':
                        ratio = CONFIG.PIXEL_RATIO_HIGH;
                        break;
                    case 'medium':
                        ratio = CONFIG.PIXEL_RATIO_MEDIUM;
                        break;
                    case 'low':
                        ratio = CONFIG.PIXEL_RATIO_LOW;  // Ultra-leve
                        break;
                    default:
                        ratio = CONFIG.PIXEL_RATIO_MEDIUM;
                }
                instance.renderer.setPixelRatio(ratio);
            }
            
            // Armazenar como SINGLETON
            window.__VANTA_INSTANCE__ = instance;
            state.vantaElement = element;
            state.isDestroyed = false;  // Reset flag de destruído
            
            console.log(`✨ [Effects] Vanta criado (tier: ${state.currentTier})`);
            return instance;
            
        } catch (e) {
            console.error('❌ [Effects] Erro ao criar Vanta:', e);
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // DETECÇÃO DE DISPOSITIVO (ainda menos restritiva)
    // ═══════════════════════════════════════════════════════════════════
    function detectDevice() {
        const cores = navigator.hardwareConcurrency || 4;
        const memory = navigator.deviceMemory || 4;
        const width = window.innerWidth;
        
        state.isMobile = width <= CONFIG.MOBILE_WIDTH;
        state.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        // Detecção muito mais permissiva - quase todos os dispositivos podem usar Vanta
        state.isLowEnd = (
            cores <= 1 ||  // Apenas dispositivos extremamente antigos
            memory <= 1 ||  // Apenas com muito pouca RAM
            state.prefersReducedMotion
        );

        // Determinar tier BASE - permitir high para quase todos
        if (state.prefersReducedMotion) {
            state.baseTier = 'killed';  // Usuário não quer animações
        } else if (state.isLowEnd) {
            state.baseTier = 'low';     // Extremamente low-end = low tier
        } else if (state.isMobile) {
            state.baseTier = 'medium';  // Mobile = medium tier
        } else {
            state.baseTier = 'high';    // Desktop = high tier
        }
        
        // Tier atual começa no base
        state.currentTier = state.baseTier;

        console.log(`🎛️ [Effects] Device detected:`, {
            cores, memory, width,
            mobile: state.isMobile,
            lowEnd: state.isLowEnd,
            reducedMotion: state.prefersReducedMotion,
            baseTier: state.baseTier,
            shouldRun: shouldVantaRun()
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // TIER SYSTEM
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Verifica se Vanta deve estar rodando no tier atual
     * Agora permite Vanta em tier 'low' com configuração ultra-leve
     */
    function shouldVantaRun() {
        return (
            state.isDocumentVisible &&
            state.isWindowFocused &&
            !state.isModalOpen &&
            !state.isKilled &&
            state.currentTier !== 'killed' &&  // Só bloqueia se 'killed'
            !state.prefersReducedMotion
        );
    }
    
    /**
     * Obtém config do Vanta para o tier atual
     * Agora retorna config para todos os tiers (incluindo low)
     */
    function getVantaConfigForTier(tier) {
        switch (tier) {
            case 'high': return CONFIG.VANTA_HIGH;
            case 'medium': return CONFIG.VANTA_MEDIUM;
            case 'low': return CONFIG.VANTA_LOW;     // Agora tem config!
            default: return null;  // Apenas 'killed' = sem Vanta
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
     * Processa evento de FPS baixo com DEGRADAÇÃO PROGRESSIVA SUAVE
     * Tier 1: FPS < 40 por 5s → high → medium
     * Tier 2: FPS < 30 por 8s → medium → low (ainda com Vanta!)
     * Tier 3: FPS < 20 por 15s → KILL (extremamente crítico)
     */
    function processLowFps(fps) {
        state.lastFps = fps;
        
        // Se FPS está bom, tentar recovery
        if (fps >= CONFIG.RECOVERY_FPS_THRESHOLD) {
            processGoodFps(fps);
            state.lowFpsStart = null;
            state.consecutiveLowFps = 0;
            return;
        }
        
        const now = Date.now();
        
        // Tier 1: FPS < 40 por 5s → degradar de high para medium
        if (fps < CONFIG.DEGRADE_FPS_TIER1 && state.currentTier === 'high') {
            if (!state.lowFpsStart) {
                state.lowFpsStart = now;
            } else if (now - state.lowFpsStart > CONFIG.DEGRADE_DURATION_TIER1) {
                degradeTier('FPS < 40 por 5s');
                state.lowFpsStart = now;
                return;
            }
        }
        
        // Tier 2: FPS < 30 por 8s → degradar de medium para low (mantém Vanta leve)
        if (fps < CONFIG.DEGRADE_FPS_TIER2 && state.currentTier === 'medium') {
            if (!state.lowFpsStart) {
                state.lowFpsStart = now;
            } else if (now - state.lowFpsStart > CONFIG.DEGRADE_DURATION_TIER2) {
                // Degradar para low (ainda com Vanta ultra-leve)
                degradeTier('FPS < 30 por 8s');
                state.lowFpsStart = now;
                return;
            }
        }
        
        // Tier 3: FPS < 20 por 15s em tier low = KILL (último recurso)
        if (fps < CONFIG.KILL_FPS_THRESHOLD) {
            if (!state.lowFpsStart) {
                state.lowFpsStart = now;
            } else if (now - state.lowFpsStart > CONFIG.KILL_FPS_DURATION) {
                if (state.currentTier === 'low') {
                    // Extremamente crítico - kill
                    activateKillSwitch(`FPS crítico ${fps} por ${CONFIG.KILL_FPS_DURATION / 1000}s`);
                } else {
                    // Ainda tem margem, degradar
                    degradeTier('FPS extremamente baixo');
                    state.lowFpsStart = now;
                }
            }
        }
    }
    
    /**
     * Processa FPS bom para tentar recovery (upgrade de tier)
     */
    function processGoodFps(fps) {
        const now = Date.now();
        
        // Não fazer recovery se killed ou no tier máximo
        if (state.isKilled || state.currentTier === state.baseTier) {
            return;
        }
        
        // Verificar cooldown de recovery
        if (now - state.lastRecoveryAttempt < CONFIG.RECOVERY_COOLDOWN) {
            return;
        }
        
        // Iniciar tracking de FPS bom
        if (!state.goodFpsStart) {
            state.goodFpsStart = now;
        } else if (now - state.goodFpsStart > CONFIG.RECOVERY_DURATION) {
            // FPS bom por tempo suficiente - tentar upgrade
            if (upgradeTier('recovery - FPS estável')) {
                state.lastRecoveryAttempt = now;
            }
            state.goodFpsStart = null;
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
    // MODO DIGITAÇÃO - Prioriza UI do chat durante input
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Ativa modo digitação - reduz efeitos para priorizar input
     */
    function enterTypingMode() {
        if (state.isTyping) return;
        
        state.isTyping = true;
        
        // Salvar tier atual se vamos reduzir
        if (CONFIG.TYPING_REDUCE_TIER && state.currentTier === 'high') {
            state.tierBeforeTyping = state.currentTier;
            
            // Reduzir temporariamente para medium durante digitação
            const instance = getVantaInstance();
            if (instance?.renderer) {
                instance.renderer.setPixelRatio(CONFIG.PIXEL_RATIO_MEDIUM);
            }
        }
    }
    
    /**
     * Sai do modo digitação - restaura efeitos
     */
    function exitTypingMode() {
        if (!state.isTyping) return;
        
        state.isTyping = false;
        
        // Restaurar tier se foi reduzido
        if (state.tierBeforeTyping) {
            const instance = getVantaInstance();
            if (instance?.renderer && state.currentTier === 'high') {
                instance.renderer.setPixelRatio(CONFIG.PIXEL_RATIO_HIGH);
            }
            state.tierBeforeTyping = null;
        }
    }
    
    /**
     * Handler de keystroke - ativa modo digitação com debounce
     */
    function onTypingActivity() {
        enterTypingMode();
        
        // Resetar timer de saída do modo digitação
        clearTimeout(state.typingTimeout);
        state.typingTimeout = setTimeout(() => {
            exitTypingMode();
        }, CONFIG.TYPING_DEBOUNCE);
    }
    
    /**
     * Inicializa listeners de digitação para elementos de input
     */
    function initTypingListeners() {
        // Seletores de elementos de input do chat
        const inputSelectors = [
            '#chatInput',
            '#chat-input',
            '.chat-input',
            'input[type="text"]',
            'textarea'
        ];
        
        const attachListeners = (element) => {
            if (!element || element.dataset.typingListenerAttached) return;
            
            element.addEventListener('input', onTypingActivity, { passive: true });
            element.addEventListener('keydown', onTypingActivity, { passive: true });
            element.addEventListener('focus', () => enterTypingMode(), { passive: true });
            element.addEventListener('blur', () => {
                clearTimeout(state.typingTimeout);
                state.typingTimeout = setTimeout(exitTypingMode, 100);
            }, { passive: true });
            
            element.dataset.typingListenerAttached = 'true';
        };
        
        // Attach para elementos existentes
        inputSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(attachListeners);
        });
        
        // Observer para elementos adicionados dinamicamente
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    
                    inputSelectors.forEach(selector => {
                        if (node.matches?.(selector)) {
                            attachListeners(node);
                        }
                        node.querySelectorAll?.(selector).forEach(attachListeners);
                    });
                });
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
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
                // Forçar criação do Vanta mesmo se condições parecem não atender
                if (shouldVantaRun() || !state.isKilled) {
                    applyCurrentTier();
                    console.log('✨ [Effects] Vanta forçado a iniciar');
                } else {
                    console.log('⚠️ [Effects] Condições impedem Vanta:', {
                        visible: state.isDocumentVisible,
                        focused: state.isWindowFocused,
                        modal: state.isModalOpen,
                        killed: state.isKilled,
                        tier: state.currentTier,
                        reducedMotion: state.prefersReducedMotion
                    });
                }
                
                // Inicializar typing listeners após libs carregadas
                initTypingListeners();
                
                console.log('✅ [Effects] Controller V3.1 inicializado');
            } else {
                console.log('⏳ [Effects] Aguardando VANTA/THREE...');
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
