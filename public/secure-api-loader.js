/**
 * 🔐 Carregador Seguro de API Key - SoundyAI
 * Sistema seguro para carregar API Keys sem expor no código
 */

log('🔐 [SECURE-API-LOADER] Carregador seguro inicializado');

// Função para carregar API Key de fontes seguras
async function loadSecureAPIKey() {
    // Múltiplas fontes seguras (ordem de prioridade)
    const sources = [
        () => localStorage.getItem('soundyai_openai_key'),
        () => sessionStorage.getItem('openai_api_key'),
        () => window.OPENAI_API_KEY,
        () => getUserConfiguredKey()
    ];

    for (let source of sources) {
        try {
            const key = source();
            if (key && key.startsWith('sk-') && key.length > 40) {
                return key;
            }
        } catch (e) {
            // Ignorar erros de fontes individuais
        }
    }
    
    return 'demo-mode'; // Fallback seguro
}

// Configuração automática segura
async function autoConfigureSecureAI() {
    try {
        if (!window.aiConfigManager) {
            setTimeout(autoConfigureSecureAI, 1000);
            return;
        }

        const apiKey = await loadSecureAPIKey();
        
        window.aiConfigManager.updateSetting('apiKey', apiKey);
        window.aiConfigManager.updateSetting('model', 'gpt-3.5-turbo');
        
        log('✅ [SECURE-API-LOADER] Configuração aplicada:', {
            hasKey: apiKey !== 'demo-mode',
            mode: apiKey === 'demo-mode' ? 'demo' : 'ai'
        });
        
    } catch (error) {
        error('❌ [SECURE-API-LOADER] Erro:', error);
    }
}

// Função para usuário configurar via modal
function promptForAPIKey() {
    const key = prompt('🔑 Digite sua API Key da OpenAI (sk-...):', '');
    if (key && key.startsWith('sk-')) {
        localStorage.setItem('soundyai_openai_key', key);
        log('✅ [SECURE-API-LOADER] API Key salva!');
        location.reload();
    }
}

function getUserConfiguredKey() {
    return window.USER_API_KEY || null;
}

// Funções globais
window.loadSecureAPIKey = loadSecureAPIKey;
window.promptForAPIKey = promptForAPIKey;
window.setAPIKey = (key) => {
    if (key && key.startsWith('sk-')) {
        localStorage.setItem('soundyai_openai_key', key);
        return true;
    }
    return false;
};

// Auto-executar
setTimeout(autoConfigureSecureAI, 2000);