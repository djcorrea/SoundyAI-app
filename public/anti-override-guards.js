// 🛡️ DESABILITAR PREMIUM-BLOCKER.JS
// Este script impede que o premium-blocker.js sobrescreva os guards nativos

(function() {
    'use strict';
    
    log('🛡️ [ANTI-OVERRIDE] Protegendo guards nativos...');
    
    // Salvar referências originais das funções COM guards
    const protectedFunctions = {
        sendModalAnalysisToChat: window.sendModalAnalysisToChat,
        downloadModalAnalysis: window.downloadModalAnalysis
    };
    
    // Detectar quando premium-blocker.js tentar sobrescrever
    let overrideAttempts = 0;
    
    // Criar getters/setters para proteger as funções
    Object.keys(protectedFunctions).forEach(fnName => {
        const original = protectedFunctions[fnName];
        
        if (!original) {
            warn(`⚠️ [ANTI-OVERRIDE] Função ${fnName} não encontrada no escopo global`);
            return;
        }
        
        let currentValue = original;
        
        Object.defineProperty(window, fnName, {
            get() {
                return currentValue;
            },
            set(newValue) {
                // Permitir apenas se for a primeira definição (original)
                // ou se já for a função protegida
                if (newValue === original || newValue.toString().includes('PREMIUM-GUARD')) {
                    currentValue = newValue;
                    log(`✅ [ANTI-OVERRIDE] ${fnName} mantida protegida`);
                } else {
                    overrideAttempts++;
                    warn(`🚫 [ANTI-OVERRIDE] Bloqueada tentativa de sobrescrever ${fnName} (tentativa ${overrideAttempts})`);
                    warn(`   Mantendo função original COM guard`);
                    // NÃO permitir sobrescrita - manter função original
                    currentValue = original;
                }
            },
            configurable: false, // Impede redefinição
            enumerable: true
        });
    });
    
    log('✅ [ANTI-OVERRIDE] Proteção ativada para:', Object.keys(protectedFunctions).join(', '));
    
    // Monitorar tentativas de override
    const checkInterval = setInterval(() => {
        Object.keys(protectedFunctions).forEach(fnName => {
            const current = window[fnName];
            const original = protectedFunctions[fnName];
            
            if (current !== original && !current.toString().includes('PREMIUM-GUARD')) {
                error(`❌ [ANTI-OVERRIDE] Detectada corrupção em ${fnName}! Restaurando...`);
                window[fnName] = original;
            }
        });
    }, 100);
    
    // Parar monitoramento após 5 segundos (tempo suficiente para premium-blocker carregar)
    setTimeout(() => {
        clearInterval(checkInterval);
        log('✅ [ANTI-OVERRIDE] Monitoramento encerrado. Guards protegidos.');
        
        if (overrideAttempts > 0) {
            warn(`⚠️ [ANTI-OVERRIDE] ${overrideAttempts} tentativas de override bloqueadas`);
        } else {
            log('✅ [ANTI-OVERRIDE] Nenhuma tentativa de override detectada');
        }
    }, 5000);
})();
