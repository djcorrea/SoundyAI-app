/* ============================================ */
/* 🚨 SCRIPT DE EMERGÊNCIA - BLOQUEIO DE RELOAD */
/* ============================================ */

(function() {
    // Contador de tentativas de reload
    let reloadAttempts = 0;
    const MAX_ATTEMPTS = 3;
    
    // Salvar funções originais
    const originalReload = window.location.reload;
    const originalReplace = window.location.replace;
    
    // Sobrescrever reload
    window.location.reload = function(...args) {
        reloadAttempts++;
        console.error(`🚨 [EMERGENCY] Tentativa de reload bloqueada! (#${reloadAttempts})`);
        console.trace('Stack trace do reload:');
        
        if (reloadAttempts >= MAX_ATTEMPTS) {
            console.error(`🚨 [EMERGENCY] ${MAX_ATTEMPTS} tentativas de reload bloqueadas! Algo está errado.`);
            alert(`⚠️ AVISO: Detectado loop de reload infinito!\n\nA página tentou recarregar ${reloadAttempts} vezes.\nO reload foi bloqueado para evitar loop.`);
        }
        
        // NÃO executa o reload
        return false;
    };
    
    // Sobrescrever replace (redirecionamentos)
    window.location.replace = function(url) {
        console.warn(`🚨 [EMERGENCY] Tentativa de redirect bloqueada para: ${url}`);
        console.trace('Stack trace do redirect:');
        
        // NÃO executa o redirect
        return false;
    };
    
    // Interceptar mudanças em location.href
    let locationHref = window.location.href;
    Object.defineProperty(window.location, 'href', {
        get: function() {
            return locationHref;
        },
        set: function(url) {
            if (url === locationHref || url.includes(window.location.pathname)) {
                console.warn(`🚨 [EMERGENCY] Tentativa de reload via location.href bloqueada`);
                console.trace('Stack trace:');
                return;
            }
            console.warn(`🚨 [EMERGENCY] Tentativa de redirect via location.href para: ${url}`);
            console.trace('Stack trace:');
            // NÃO muda a URL
        }
    });
    
    console.log('%c🚨 [EMERGENCY] Sistema de bloqueio de reload ATIVADO', 'color: red; font-weight: bold; font-size: 16px;');
    console.log('Todos os reloads e redirects serão bloqueados e logados no console.');
    
    // Timer de segurança: após 10 segundos sem reload, desativa o bloqueio
    setTimeout(function() {
        if (reloadAttempts === 0) {
            console.log('%c✅ [EMERGENCY] Nenhum reload detectado em 10s. Sistema parece estável.', 'color: green; font-weight: bold;');
        } else {
            console.error(`%c🚨 [EMERGENCY] ${reloadAttempts} tentativas de reload bloqueadas!`, 'color: red; font-weight: bold;');
        }
    }, 10000);
})();

console.log('🚨 Emergency reload blocker carregado');
