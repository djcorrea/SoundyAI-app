/**
 * INDEX-LEAN CONTROLLER
 * Sistema de carregamento minimalista - load apenas essencial
 * Features pesadas carregam sob demanda (lazy loading)
 * 
 * FILOSOFIA:
 * - Load inicial: Auth + UI chat + enviar/receber mensagens
 * - Fingerprint forte: NUNCA no load, só quando anti-burla detectar suspeita
 * - Voice: NUNCA auto-start, só ao clicar no microfone
 * - Observers: só após abrir modal de análise
 * - Validators/testes: só com ?debug=1
 * 
 * @version 2026-02-03
 */

(function() {
    'use strict';
    
    const log = window.log || console.log;
    
    /**
     * Configuração global - LEAN MODE SEMPRE ATIVO
     */
    window.__INDEX_LEAN_MODE = true;
    window.__LEAN_DISABLE_FINGERPRINT_AUTOSTART = true;
    window.__LEAN_DISABLE_VOICE_AUTOSTART = true;
    window.__LEAN_DISABLE_AUTO_VALIDATORS = true;
    window.__LEAN_DISABLE_OBSERVERS_AUTOSTART = true;
    
    log('🌿 [INDEX-LEAN] ✅ Modo minimalista ATIVADO (features pesadas sob demanda)');
    
    /**
     * Estado de features carregadas
     */
    const loadedFeatures = {
        fingerprint: false,
        voice: false,
        observers: false,
        validators: false
    };
    
    /**
     * Fingerprint forte - lazy loading
     * Só chama quando anti-burla detectar comportamento suspeito
     */
    window.lazyLoadFingerprint = async function() {
        if (loadedFeatures.fingerprint) {
            log('🔍 [INDEX-LEAN] Fingerprint já carregado');
            return window.SoundyFingerprint?.get?.();
        }
        
        log('🔄 [INDEX-LEAN] Carregando fingerprint forte sob demanda...');
        
        try {
            // Se device-fingerprint.js já está carregado mas não inicializado
            if (window.initSoundyFingerprint) {
                await window.initSoundyFingerprint();
                loadedFeatures.fingerprint = true;
                log('✅ [INDEX-LEAN] Fingerprint carregado com sucesso');
                return window.SoundyFingerprint?.get?.();
            }
            
            // Fallback: usar fingerprint leve (timestamp + userAgent hash)
            log('⚡ [INDEX-LEAN] Usando fingerprint leve (fallback)');
            const lightFp = 'lean_' + Date.now() + '_' + btoa(navigator.userAgent).slice(0, 16);
            return lightFp;
        } catch (err) {
            log('❌ [INDEX-LEAN] Erro ao carregar fingerprint:', err);
            return 'lean_error_' + Date.now();
        }
    };
    
    /**
     * Voice integration - lazy loading
     * Só chama ao clicar no ícone do microfone
     */
    window.lazyLoadVoice = async function() {
        if (loadedFeatures.voice) {
            log('🎤 [INDEX-LEAN] Voice já carregado');
            return;
        }
        
        log('🔄 [INDEX-LEAN] Carregando voice integration sob demanda...');
        
        try {
            // Se voice-clean.js já está carregado mas não inicializado
            if (window.initVoiceIntegration) {
                await window.initVoiceIntegration();
                loadedFeatures.voice = true;
                log('✅ [INDEX-LEAN] Voice carregado com sucesso');
            } else {
                log('⚠️ [INDEX-LEAN] Voice não disponível (script não carregado)');
            }
        } catch (err) {
            log('❌ [INDEX-LEAN] Erro ao carregar voice:', err);
        }
    };
    
    /**
     * Observers - lazy loading
     * Só inicia após abrir modal de análise
     */
    window.lazyLoadObservers = async function() {
        if (loadedFeatures.observers) {
            log('👁️ [INDEX-LEAN] Observers já carregados');
            return;
        }
        
        log('🔄 [INDEX-LEAN] Carregando observers sob demanda...');
        
        try {
            if (window.initModalObservers) {
                await window.initModalObservers();
                loadedFeatures.observers = true;
                log('✅ [INDEX-LEAN] Observers carregados com sucesso');
            }
        } catch (err) {
            log('❌ [INDEX-LEAN] Erro ao carregar observers:', err);
        }
    };
    
    /**
     * Validators - lazy loading
     * Só com ?debug=1
     */
    window.lazyLoadValidators = async function() {
        const isDebug = new URLSearchParams(window.location.search).get('debug') === '1';
        
        if (!isDebug) {
            log('🌿 [INDEX-LEAN] Validators bloqueados (não está em debug mode)');
            return;
        }
        
        if (loadedFeatures.validators) {
            log('✅ [INDEX-LEAN] Validators já carregados');
            return;
        }
        
        log('🔄 [INDEX-LEAN] Carregando validators sob demanda...');
        
        try {
            if (window.initAutoValidators) {
                await window.initAutoValidators();
                loadedFeatures.validators = true;
                log('✅ [INDEX-LEAN] Validators carregados com sucesso');
            }
        } catch (err) {
            log('❌ [INDEX-LEAN] Erro ao carregar validators:', err);
        }
    };
    
    /**
     * Helper: Verificar se fingerprint forte é necessário
     * Chamado por sistema anti-burla
     */
    window.shouldRunStrongFingerprint = function() {
        // Só executa se:
        // 1. Sistema anti-burla solicitar (suspeita de múltiplas análises grátis)
        // 2. Modo anônimo ativo (prevenção de burla)
        const isAnonymous = window.isAnonymousMode || window.ANONYMOUS_MODE_ACTIVE;
        const antiCheatRequest = window.__ANTI_CHEAT_REQUEST_FINGERPRINT;
        
        if (isAnonymous || antiCheatRequest) {
            log('🔍 [INDEX-LEAN] Fingerprint forte necessário (anti-burla)');
            return true;
        }
        
        log('🌿 [INDEX-LEAN] Fingerprint forte desnecessário');
        return false;
    };
    
    /**
     * Install click listeners para lazy loading de voice
     */
    function installVoiceClickListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            const micIcons = document.querySelectorAll('.chatbot-mic-icon, [data-voice-trigger]');
            
            if (micIcons.length === 0) {
                log('🎤 [INDEX-LEAN] Nenhum ícone de microfone encontrado (OK)');
                return;
            }
            
            log(`🎤 [INDEX-LEAN] ${micIcons.length} ícones de microfone com lazy loading instalado`);
            
            micIcons.forEach(mic => {
                mic.addEventListener('click', async function initVoiceOnFirstClick() {
                    log('🎤 [INDEX-LEAN] Microfone clicado - carregando voice...');
                    mic.removeEventListener('click', initVoiceOnFirstClick);
                    await window.lazyLoadVoice();
                }, { once: true });
            });
        });
    }
    
    /**
     * Install listeners para lazy loading de observers (modal aberto)
     */
    function installObserversModalListeners() {
        // Aguarda abertura de modal de análise
        document.addEventListener('DOMContentLoaded', () => {
            const analyzeBtn = document.querySelector('[data-action="analyze"]');
            
            if (!analyzeBtn) {
                log('👁️ [INDEX-LEAN] Botão de análise não encontrado (OK)');
                return;
            }
            
            analyzeBtn.addEventListener('click', async function loadObserversOnModalOpen() {
                log('👁️ [INDEX-LEAN] Modal de análise abrindo - carregando observers...');
                analyzeBtn.removeEventListener('click', loadObserversOnModalOpen);
                await window.lazyLoadObservers();
            }, { once: true });
        });
    }
    
    /**
     * Inicialização
     */
    installVoiceClickListeners();
    installObserversModalListeners();
    
    log('🌿 [INDEX-LEAN] ✅ Sistema inicializado');
    log('🌿 [INDEX-LEAN] Load inicial: Auth + UI Chat + Mensagens');
    log('🌿 [INDEX-LEAN] Fingerprint forte: deferred (anti-burla)');
    log('🌿 [INDEX-LEAN] Voice: deferred (click microfone)');
    log('🌿 [INDEX-LEAN] Observers: deferred (modal análise)');
    log('🌿 [INDEX-LEAN] Validators: deferred (debug mode)');
    
})();
