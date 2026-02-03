/**
 * ⚡ PERFORMANCE MODE AGRESSIVO
 * =============================
 * 
 * Detecta máquinas fracas e desabilita recursos pesados automaticamente
 * para evitar travamento do FL Studio / DAWs durante uso do site.
 * 
 * CRITÉRIOS DE ATIVAÇÃO:
 * - navigator.hardwareConcurrency <= 4 (CPUs limitadas)
 * - prefers-reduced-motion (preferência do sistema)
 * - ?perf=1 na URL (forçado manualmente)
 * 
 * RECURSOS DESABILITADOS EM PERF MODE:
 * - Fingerprint forte (só roda quando necessário para anti-burla)
 * - Voice integration auto-start (só inicia ao clicar no microfone)
 * - MutationObservers não essenciais
 * - Auto-validators e testes em produção
 * - WebGL/Canvas decorativos
 */

(function() {
    'use strict';
    
    // 🔍 DETECTAR SE DEVE ATIVAR PERF MODE AGRESSIVO
    function shouldActivateAggressivePerfMode() {
        // 1. Forçado via URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('perf') === '1') {
            log('⚡ [PERF-AGG] Ativado via URL (?perf=1)');
            return true;
        }
        
        // 2. CPU fraca (4 cores ou menos)
        const cpuCores = navigator.hardwareConcurrency || 0;
        if (cpuCores > 0 && cpuCores <= 4) {
            log(`⚡ [PERF-AGG] Ativado - CPU fraca detectada (${cpuCores} cores)`);
            return true;
        }
        
        // 3. Preferência do sistema por performance
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            log('⚡ [PERF-AGG] Ativado - prefers-reduced-motion detectado');
            return true;
        }
        
        // 4. Memória baixa (< 4GB)
        if (navigator.deviceMemory && navigator.deviceMemory < 4) {
            log(`⚡ [PERF-AGG] Ativado - memória baixa detectada (${navigator.deviceMemory}GB)`);
            return true;
        }
        
        log('⚡ [PERF-AGG] Desativado - máquina possui recursos adequados');
        return false;
    }
    
    // 🚀 ATIVAR PERF MODE AGRESSIVO
    const isAggressivePerfMode = shouldActivateAggressivePerfMode();
    
    // 📢 EXPOR GLOBALMENTE
    window.__AGGRESSIVE_PERF_MODE = isAggressivePerfMode;
    
    // 🎯 FLAGS DE CONTROLE (o que desabilitar)
    window.__PERF_DISABLE_FINGERPRINT = isAggressivePerfMode;
    window.__PERF_DISABLE_VOICE_AUTOSTART = isAggressivePerfMode;
    window.__PERF_DISABLE_OBSERVERS = isAggressivePerfMode;
    window.__PERF_DISABLE_VALIDATORS = isAggressivePerfMode;
    
    if (isAggressivePerfMode) {
        log('⚡ [PERF-AGG] ✅ Performance Mode Agressivo ATIVADO');
        log('⚡ [PERF-AGG] Recursos desabilitados:');
        log('  - Fingerprint forte (só anti-burla)');
        log('  - Voice integration auto-start');
        log('  - MutationObservers não essenciais');
        log('  - Auto-validators em produção');
        
        // Adicionar classe visual no body (opcional)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                document.body.classList.add('aggressive-perf-mode');
            });
        } else {
            document.body.classList.add('aggressive-perf-mode');
        }
    }
    
    // 🔧 HELPER: Verificar se deve rodar fingerprint
    window.shouldRunFingerprint = function() {
        // Sempre rodar se não estiver em perf mode
        if (!window.__AGGRESSIVE_PERF_MODE) {
            return true;
        }
        
        // Em perf mode, só rodar se for para anti-burla (modo anônimo)
        const isAnonymous = window.isAnonymousMode || 
                           window.ANONYMOUS_MODE_ACTIVE || 
                           sessionStorage.getItem('anonymousMode') === 'true';
        
        if (isAnonymous) {
            log('⚡ [PERF-AGG] Fingerprint liberado - modo anônimo detectado (anti-burla)');
            return true;
        }
        
        log('⚡ [PERF-AGG] Fingerprint bloqueado - não necessário neste momento');
        return false;
    };
    
    // 🔧 HELPER: Verificar se deve auto-iniciar voice
    window.shouldAutoStartVoice = function() {
        if (window.__PERF_DISABLE_VOICE_AUTOSTART) {
            log('⚡ [PERF-AGG] Voice auto-start bloqueado - aguardando clique no microfone');
            return false;
        }
        return true;
    };
    
    // 🔧 HELPER: Verificar se deve iniciar observers
    window.shouldStartObservers = function() {
        if (window.__PERF_DISABLE_OBSERVERS) {
            log('⚡ [PERF-AGG] Observers não essenciais bloqueados');
            return false;
        }
        return true;
    };
    
    log('⚡ [PERF-AGG] Sistema de detecção inicializado');
    
})();
