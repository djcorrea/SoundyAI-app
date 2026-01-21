/**
 * 🤖 Auto-Configuração da IA - SoundyAI
 * Configura automaticamente API Key e força interface IA aparecer
 */

console.log('🤖 [AI-AUTO-CONFIG] Inicializando configuração automática da IA...');

// Função para configurar API Key automaticamente
function autoConfigureAI() {
    try {
        // Verifica se aiConfigManager existe
        if (!window.aiConfigManager) {
            console.warn('⚠️ [AI-AUTO-CONFIG] aiConfigManager não encontrado, aguardando...');
            setTimeout(autoConfigureAI, 1000);
            return;
        }

        // Verifica se já está configurado
        const currentKey = window.aiConfigManager.getSetting('apiKey');
        if (currentKey && currentKey !== '' && currentKey !== 'null') {
            console.log('✅ [AI-AUTO-CONFIG] API Key já configurada:', currentKey.substring(0, 10) + '...');
            return;
        }

        // API Keys de teste comuns (você deve substituir por uma real)
        const testKeys = [
            // Adicione sua API Key real aqui se tiver
            'sk-test-key-for-demo-purposes-only', // Esta é só para demo
        ];

        // Verificar variáveis de ambiente do browser
        const globalKey = window.OPENAI_API_KEY || window.AI_API_KEY || 
                         localStorage.getItem('soundyai_openai_key') ||
                         sessionStorage.getItem('openai_api_key');

        let keyToUse = globalKey;

        if (!keyToUse) {
            console.log('🔍 [AI-AUTO-CONFIG] Nenhuma API Key encontrada, usando configuração base');
            // Configurar para mostrar interface mesmo sem API Key válida
            keyToUse = 'demo-mode';
        }

        // Configurar API Key
        window.aiConfigManager.updateSetting('apiKey', keyToUse);
        window.aiConfigManager.updateSetting('model', 'gpt-3.5-turbo');
        window.aiConfigManager.updateSetting('temperature', 0.7);
        window.aiConfigManager.updateSetting('maxTokens', 1000);

        console.log('✅ [AI-AUTO-CONFIG] Configuração aplicada:', {
            hasKey: !!keyToUse,
            keyPreview: keyToUse ? keyToUse.substring(0, 10) + '...' : 'N/A',
            model: 'gpt-3.5-turbo'
        });

        // Forçar atualização da interface
        if (window.aiUIController) {
            console.log('🚀 [AI-AUTO-CONFIG] Forçando atualização da interface IA...');
            
            // Criar dados simulados se necessário
            const mockAnalysis = {
                suggestions: [
                    { title: 'Configuração IA', description: 'Sistema IA configurado automaticamente' }
                ],
                _aiConfigured: true,
                _autoConfigured: true
            };

            setTimeout(() => {
                window.aiUIController.checkForAISuggestions(mockAnalysis, true);
            }, 500);
        }

    } catch (error) {
        console.error('❌ [AI-AUTO-CONFIG] Erro na configuração automática:', error);
    }
}

// Função para buscar API Key em várias fontes
function findAPIKey() {
    const sources = [
        () => window.OPENAI_API_KEY,
        () => window.AI_API_KEY,
        () => localStorage.getItem('soundyai_openai_key'),
        () => localStorage.getItem('openai_api_key'),
        () => sessionStorage.getItem('openai_api_key'),
        () => document.querySelector('meta[name="openai-key"]')?.content,
        () => document.querySelector('input[name="api-key"]')?.value,
    ];

    for (let i = 0; i < sources.length; i++) {
        try {
            const key = sources[i]();
            if (key && key.length > 20 && key.startsWith('sk-')) {
                console.log(`🔑 [AI-AUTO-CONFIG] API Key encontrada na fonte ${i + 1}`);
                return key;
            }
        } catch (e) {
            // Ignora erros de fontes individuais
        }
    }

    return null;
}

// Função para configurar API Key encontrada
function quickSetupAI(apiKey = null) {
    const key = apiKey || findAPIKey();
    
    if (key) {
        console.log('🔑 [AI-AUTO-CONFIG] Configurando API Key encontrada...');
        if (window.aiConfigManager) {
            window.aiConfigManager.updateSetting('apiKey', key);
            window.aiConfigManager.updateSetting('model', 'gpt-3.5-turbo');
            console.log('✅ [AI-AUTO-CONFIG] API Key configurada com sucesso!');
            return true;
        }
    }
    
    console.log('⚠️ [AI-AUTO-CONFIG] Nenhuma API Key válida encontrada');
    return false;
}

// Função para testar configuração
function testAIConfig() {
    console.log('🧪 [AI-AUTO-CONFIG] Testando configuração...');
    
    if (window.aiConfigManager) {
        const config = {
            apiKey: window.aiConfigManager.getSetting('apiKey'),
            model: window.aiConfigManager.getSetting('model'),
            temperature: window.aiConfigManager.getSetting('temperature')
        };
        
        console.log('📊 [AI-AUTO-CONFIG] Configuração atual:', {
            hasKey: !!config.apiKey,
            keyPreview: config.apiKey ? config.apiKey.substring(0, 10) + '...' : 'N/A',
            model: config.model,
            temperature: config.temperature
        });
        
        return config;
    }
    
    console.warn('❌ [AI-AUTO-CONFIG] aiConfigManager não disponível');
    return null;
}

// Exposer funções globalmente para debug
window.autoConfigureAI = autoConfigureAI;
window.quickSetupAI = quickSetupAI;
window.testAIConfig = testAIConfig;
window.findAPIKey = findAPIKey;

// Auto-executar quando carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoConfigureAI);
} else {
    // Se já carregou, executar após um delay
    setTimeout(autoConfigureAI, 1000);
}

console.log('✅ [AI-AUTO-CONFIG] Sistema de auto-configuração carregado!');
console.log('💡 [AI-AUTO-CONFIG] Funções disponíveis: autoConfigureAI(), quickSetupAI(), testAIConfig(), findAPIKey()');