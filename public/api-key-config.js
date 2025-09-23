/**
 * 🔐 Configurador de API Key - SoundyAI
 * 
 * INSTRUÇÕES PARA O USUÁRIO:
 * 1. Se você tem uma API Key da OpenAI, substitua "SUA_API_KEY_AQUI" pela sua chave real
 * 2. Se não tem, pode usar o sistema em modo demo
 * 
 * Para obter uma API Key:
 * 1. Acesse: https://platform.openai.com/api-keys
 * 2. Faça login na sua conta OpenAI
 * 3. Clique em "Create new secret key"
 * 4. Copie a chave que começa com "sk-"
 * 5. Cole aqui substituindo "SUA_API_KEY_AQUI"
 */

// 🔑 ADICIONE SUA API KEY AQUI:
const OPENAI_API_KEY = 'SUA_API_KEY_AQUI'; // <-- Substitua por sua API Key real

console.log('🔐 [API-KEY-CONFIG] Inicializando configurador de API Key...');

function configureUserAPIKey() {
    try {
        // Verifica se a API Key foi configurada
        if (OPENAI_API_KEY && OPENAI_API_KEY !== 'SUA_API_KEY_AQUI' && OPENAI_API_KEY.startsWith('sk-')) {
            console.log('🔑 [API-KEY-CONFIG] API Key encontrada, configurando...');
            
            // Esperar o aiConfigManager carregar
            if (window.aiConfigManager) {
                window.aiConfigManager.updateSetting('apiKey', OPENAI_API_KEY);
                window.aiConfigManager.updateSetting('model', 'gpt-3.5-turbo');
                console.log('✅ [API-KEY-CONFIG] API Key configurada com sucesso!');
                
                // Salvar no localStorage para persistir
                localStorage.setItem('soundyai_openai_key', OPENAI_API_KEY);
                
                return true;
            } else {
                console.log('⏳ [API-KEY-CONFIG] Aguardando aiConfigManager...');
                setTimeout(configureUserAPIKey, 1000);
                return false;
            }
        } else {
            console.log('⚠️ [API-KEY-CONFIG] API Key não configurada - usando modo demo');
            console.log('💡 [API-KEY-CONFIG] Para configurar, edite o arquivo api-key-config.js');
            
            // Configurar modo demo
            if (window.aiConfigManager) {
                window.aiConfigManager.updateSetting('apiKey', 'demo-mode');
                window.aiConfigManager.updateSetting('model', 'gpt-3.5-turbo');
            }
            
            return false;
        }
    } catch (error) {
        console.error('❌ [API-KEY-CONFIG] Erro ao configurar API Key:', error);
        return false;
    }
}

// Função para o usuário configurar API Key via console
function setAPIKey(apiKey) {
    if (!apiKey || !apiKey.startsWith('sk-')) {
        console.error('❌ [API-KEY-CONFIG] API Key inválida. Deve começar com "sk-"');
        return false;
    }
    
    if (window.aiConfigManager) {
        window.aiConfigManager.updateSetting('apiKey', apiKey);
        localStorage.setItem('soundyai_openai_key', apiKey);
        console.log('✅ [API-KEY-CONFIG] API Key configurada via console!');
        return true;
    } else {
        console.error('❌ [API-KEY-CONFIG] aiConfigManager não disponível');
        return false;
    }
}

// Função para remover API Key
function removeAPIKey() {
    if (window.aiConfigManager) {
        window.aiConfigManager.updateSetting('apiKey', '');
        localStorage.removeItem('soundyai_openai_key');
        console.log('🗑️ [API-KEY-CONFIG] API Key removida');
        return true;
    }
    return false;
}

// Função para verificar status
function checkAPIKeyStatus() {
    const stored = localStorage.getItem('soundyai_openai_key');
    const current = window.aiConfigManager?.getSetting('apiKey');
    
    console.log('📊 [API-KEY-CONFIG] Status:', {
        hasStored: !!stored,
        hasCurrent: !!current,
        isValid: current && current.startsWith('sk-'),
        keyPreview: current ? current.substring(0, 10) + '...' : 'N/A'
    });
    
    return {
        hasKey: !!current,
        isValid: current && current.startsWith('sk-'),
        preview: current ? current.substring(0, 10) + '...' : 'N/A'
    };
}

// Expor funções globalmente
window.setAPIKey = setAPIKey;
window.removeAPIKey = removeAPIKey;
window.checkAPIKeyStatus = checkAPIKeyStatus;

// Auto-executar configuração
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(configureUserAPIKey, 2000);
    });
} else {
    setTimeout(configureUserAPIKey, 2000);
}

console.log('✅ [API-KEY-CONFIG] Configurador carregado!');
console.log('💡 [API-KEY-CONFIG] Funções disponíveis:');
console.log('   - setAPIKey("sk-your-key-here") - Configurar API Key');
console.log('   - removeAPIKey() - Remover API Key');
console.log('   - checkAPIKeyStatus() - Verificar status');