// 🚀 AI CONFIGURATION MANAGER - Gerenciamento Avançado de Configurações da IA
// Sistema robusto de configuração, feature flags e fallbacks

class AIConfigurationManager {
    constructor() {
        this.isInitialized = false;
        this.settings = this.getDefaultSettings();
        this.featureFlags = this.getDefaultFeatureFlags();
        this.loadSavedSettings();
        
        console.log('🚀 [AI-Config] Gerenciador de configurações inicializado');
    }
    
    /**
     * 📋 Configurações padrão do sistema
     */
    getDefaultSettings() {
        return {
            // OpenAI API
            apiKey: '',
            model: 'gpt-3.5-turbo',
            maxTokens: 1500,
            temperature: 0.3,
            
            // Rate Limiting
            maxRequestsPerMinute: 10,
            timeoutMs: 15000,
            
            // Fallback
            fallbackMode: 'graceful', // 'graceful', 'aggressive', 'disabled'
            preserveOriginalSuggestions: true,
            
            // Cache
            enableCache: true,
            cacheExpirationHours: 24,
            maxCacheSize: 100,
            
            // UI
            enableGlassmorphism: true,
            animationsEnabled: true,
            compactMode: false,
            autoOpenModal: false,
            
            // Analytics
            enableAnalytics: true,
            trackUserInteractions: true,
            
            // Debug
            debugMode: false,
            verboseLogging: false
        };
    }
    
    /**
     * 🎛️ Feature flags padrão
     */
    getDefaultFeatureFlags() {
        return {
            // Core Features
            AI_SUGGESTION_LAYER_ENABLED: true,
            AI_ENHANCED_PROCESSING: true,
            AI_BATCH_PROCESSING: false,
            
            // Experimental Features
            AI_REAL_TIME_ANALYSIS: false,
            AI_VOICE_SYNTHESIS: false,
            AI_AUTO_MASTERING: false,
            
            // UI Features
            AI_FULL_MODAL: true,
            AI_COMPACT_VIEW: true,
            AI_CHAT_INTEGRATION: true,
            AI_EXPORT_FEATURES: true,
            
            // Safety Features
            FALLBACK_TO_ORIGINAL: true,
            PRESERVE_EXISTING_PIPELINE: true,
            SAFE_MODE: true,
            
            // Performance Features
            ASYNC_PROCESSING: true,
            WORKER_THREADS: false,
            LAZY_LOADING: true
        };
    }
    
    /**
     * 💾 Carregar configurações salvas
     */
    loadSavedSettings() {
        try {
            // Configurações do localStorage
            const savedSettings = localStorage.getItem('ai_suggestion_settings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                this.settings = { ...this.settings, ...parsed };
            }
            
            // Feature flags do localStorage
            const savedFlags = localStorage.getItem('ai_feature_flags');
            if (savedFlags) {
                const parsed = JSON.parse(savedFlags);
                this.featureFlags = { ...this.featureFlags, ...parsed };
            }
            
            // Aplicar flags globalmente
            this.applyFeatureFlags();
            
            console.log('💾 [AI-Config] Configurações carregadas:', {
                settingsCount: Object.keys(this.settings).length,
                flagsEnabled: Object.values(this.featureFlags).filter(f => f).length
            });
            
        } catch (error) {
            console.error('❌ [AI-Config] Erro ao carregar configurações:', error);
            this.resetToDefaults();
        }
    }
    
    /**
     * 🎯 Aplicar feature flags globalmente
     */
    applyFeatureFlags() {
        // Aplicar flags principais no window
        Object.entries(this.featureFlags).forEach(([flag, enabled]) => {
            window[flag] = enabled;
        });
        
        // Configurações especiais baseadas em flags
        if (!this.featureFlags.AI_SUGGESTION_LAYER_ENABLED) {
            this.disableAILayer();
        }
        
        if (this.featureFlags.SAFE_MODE) {
            this.enableSafeMode();
        }
        
        if (this.featureFlags.DEBUG_MODE) {
            this.enableDebugMode();
        }
    }
    
    /**
     * 💾 Salvar configurações
     */
    saveSettings() {
        try {
            localStorage.setItem('ai_suggestion_settings', JSON.stringify(this.settings));
            localStorage.setItem('ai_feature_flags', JSON.stringify(this.featureFlags));
            
            console.log('💾 [AI-Config] Configurações salvas com sucesso');
            return true;
            
        } catch (error) {
            console.error('❌ [AI-Config] Erro ao salvar configurações:', error);
            return false;
        }
    }
    
    /**
     * ⚙️ Atualizar configuração específica
     */
    updateSetting(key, value) {
        if (this.settings.hasOwnProperty(key)) {
            const oldValue = this.settings[key];
            this.settings[key] = value;
            
            // Aplicar mudança se necessário
            this.onSettingChanged(key, value, oldValue);
            
            // Auto-salvar
            this.saveSettings();
            
            console.log(`⚙️ [AI-Config] Configuração atualizada: ${key} = ${value}`);
            return true;
        }
        
        console.warn(`⚠️ [AI-Config] Configuração não encontrada: ${key}`);
        return false;
    }
    
    /**
     * 🎛️ Toggle feature flag
     */
    toggleFeatureFlag(flag) {
        if (this.featureFlags.hasOwnProperty(flag)) {
            const newValue = !this.featureFlags[flag];
            this.featureFlags[flag] = newValue;
            
            // Aplicar globalmente
            window[flag] = newValue;
            
            // Aplicar mudanças especiais
            this.onFeatureFlagChanged(flag, newValue);
            
            // Auto-salvar
            this.saveSettings();
            
            console.log(`🎛️ [AI-Config] Feature flag alterado: ${flag} = ${newValue}`);
            return newValue;
        }
        
        console.warn(`⚠️ [AI-Config] Feature flag não encontrado: ${flag}`);
        return false;
    }
    
    /**
     * 🔄 Callback para mudanças de configuração
     */
    onSettingChanged(key, newValue, oldValue) {
        switch (key) {
            case 'apiKey':
                if (window.aiSuggestionLayer && newValue) {
                    window.aiSuggestionLayer.setApiKey(newValue);
                }
                break;
                
            case 'model':
                if (window.aiSuggestionLayer) {
                    window.aiSuggestionLayer.setModel(newValue);
                }
                break;
                
            case 'debugMode':
                if (newValue) {
                    this.enableDebugMode();
                } else {
                    this.disableDebugMode();
                }
                break;
                
            case 'enableCache':
                if (window.aiSuggestionLayer) {
                    window.aiSuggestionLayer.setCacheEnabled(newValue);
                }
                break;
                
            case 'enableGlassmorphism':
                this.updateUITheme();
                break;
        }
    }
    
    /**
     * 🎯 Callback para mudanças de feature flags
     */
    onFeatureFlagChanged(flag, enabled) {
        switch (flag) {
            case 'AI_SUGGESTION_LAYER_ENABLED':
                if (enabled) {
                    this.enableAILayer();
                } else {
                    this.disableAILayer();
                }
                break;
                
            case 'SAFE_MODE':
                if (enabled) {
                    this.enableSafeMode();
                } else {
                    this.disableSafeMode();
                }
                break;
                
            case 'AI_FULL_MODAL':
                this.updateUIFeatures();
                break;
                
            case 'FALLBACK_TO_ORIGINAL':
                if (window.aiSuggestionLayer) {
                    window.aiSuggestionLayer.setFallbackEnabled(enabled);
                }
                break;
        }
    }
    
    /**
     * 🛡️ Habilitar modo seguro
     */
    enableSafeMode() {
        // Configurações conservadoras
        this.settings.preserveOriginalSuggestions = true;
        this.settings.fallbackMode = 'graceful';
        this.settings.maxRequestsPerMinute = 5;
        this.settings.timeoutMs = 10000;
        
        // Flags de segurança
        this.featureFlags.PRESERVE_EXISTING_PIPELINE = true;
        this.featureFlags.FALLBACK_TO_ORIGINAL = true;
        this.featureFlags.AI_BATCH_PROCESSING = false;
        
        console.log('🛡️ [AI-Config] Modo seguro ativado');
    }
    
    /**
     * 🚫 Desabilitar modo seguro
     */
    disableSafeMode() {
        // Restaurar configurações padrão
        const defaults = this.getDefaultSettings();
        this.settings.maxRequestsPerMinute = defaults.maxRequestsPerMinute;
        this.settings.timeoutMs = defaults.timeoutMs;
        
        console.log('🚫 [AI-Config] Modo seguro desativado');
    }
    
    /**
     * 🤖 Habilitar camada de IA
     */
    enableAILayer() {
        this.featureFlags.AI_SUGGESTION_LAYER_ENABLED = true;
        window.AI_SUGGESTION_LAYER_ENABLED = true;
        
        // Inicializar camada se necessário
        if (window.aiSuggestionLayer) {
            window.aiSuggestionLayer.enable();
        }
        
        // Atualizar UI
        if (window.aiUIController) {
            window.aiUIController.updateStatus('success', 'IA ativada');
        }
        
        console.log('🤖 [AI-Config] Camada de IA habilitada');
    }
    
    /**
     * 🚫 Desabilitar camada de IA
     */
    disableAILayer() {
        this.featureFlags.AI_SUGGESTION_LAYER_ENABLED = false;
        window.AI_SUGGESTION_LAYER_ENABLED = false;
        
        // Desabilitar camada
        if (window.aiSuggestionLayer) {
            window.aiSuggestionLayer.disable();
        }
        
        // Atualizar UI
        if (window.aiUIController) {
            window.aiUIController.updateStatus('disabled', 'IA desativada');
            window.aiUIController.hideAISection();
        }
        
        console.log('🚫 [AI-Config] Camada de IA desabilitada');
    }
    
    /**
     * 🐛 Habilitar modo debug
     */
    enableDebugMode() {
        this.settings.debugMode = true;
        this.settings.verboseLogging = true;
        window.AI_DEBUG_MODE = true;
        
        // Configurar console mais verboso
        if (window.aiSuggestionLayer) {
            window.aiSuggestionLayer.setDebugMode(true);
        }
        
        console.log('🐛 [AI-Config] Modo debug ativado');
    }
    
    /**
     * 🔇 Desabilitar modo debug
     */
    disableDebugMode() {
        this.settings.debugMode = false;
        this.settings.verboseLogging = false;
        window.AI_DEBUG_MODE = false;
        
        if (window.aiSuggestionLayer) {
            window.aiSuggestionLayer.setDebugMode(false);
        }
        
        console.log('🔇 [AI-Config] Modo debug desativado');
    }
    
    /**
     * 🎨 Atualizar tema da UI
     */
    updateUITheme() {
        const body = document.body;
        
        if (this.settings.enableGlassmorphism) {
            body.classList.add('ai-glassmorphism-enabled');
        } else {
            body.classList.remove('ai-glassmorphism-enabled');
        }
        
        if (this.settings.compactMode) {
            body.classList.add('ai-compact-mode');
        } else {
            body.classList.remove('ai-compact-mode');
        }
    }
    
    /**
     * 🧩 Atualizar recursos da UI
     */
    updateUIFeatures() {
        // Esconder/mostrar elementos baseado em flags
        const elements = {
            fullModal: document.getElementById('aiSuggestionsFullModal'),
            compactView: document.querySelector('.ai-suggestions-compact'),
            exportBtn: document.querySelector('.ai-export-btn')
        };
        
        if (elements.fullModal) {
            elements.fullModal.style.display = this.featureFlags.AI_FULL_MODAL ? 'flex' : 'none';
        }
        
        if (elements.exportBtn) {
            elements.exportBtn.style.display = this.featureFlags.AI_EXPORT_FEATURES ? 'block' : 'none';
        }
    }
    
    /**
     * 🔄 Resetar para configurações padrão
     */
    resetToDefaults() {
        this.settings = this.getDefaultSettings();
        this.featureFlags = this.getDefaultFeatureFlags();
        this.applyFeatureFlags();
        this.saveSettings();
        
        console.log('🔄 [AI-Config] Configurações resetadas para padrão');
    }
    
    /**
     * 🗂️ Exportar configurações
     */
    exportConfiguration() {
        const config = {
            settings: this.settings,
            featureFlags: this.featureFlags,
            exportedAt: new Date().toISOString(),
            version: '1.0.0'
        };
        
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-config-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('🗂️ [AI-Config] Configurações exportadas');
    }
    
    /**
     * 📥 Importar configurações
     */
    importConfiguration(configFile) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    
                    // Validar estrutura
                    if (config.settings && config.featureFlags) {
                        this.settings = { ...this.settings, ...config.settings };
                        this.featureFlags = { ...this.featureFlags, ...config.featureFlags };
                        
                        this.applyFeatureFlags();
                        this.saveSettings();
                        
                        console.log('📥 [AI-Config] Configurações importadas com sucesso');
                        resolve(true);
                    } else {
                        throw new Error('Formato de arquivo inválido');
                    }
                    
                } catch (error) {
                    console.error('❌ [AI-Config] Erro ao importar configurações:', error);
                    reject(error);
                }
            };
            
            reader.readAsText(configFile);
        });
    }
    
    /**
     * 🔍 Validar configuração
     */
    validateConfiguration() {
        const issues = [];
        
        // Validar API Key
        if (!this.settings.apiKey || this.settings.apiKey.length < 10) {
            issues.push('API Key da OpenAI inválida ou não configurada');
        }
        
        // Validar modelo
        const validModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'];
        if (!validModels.includes(this.settings.model)) {
            issues.push(`Modelo inválido: ${this.settings.model}`);
        }
        
        // Validar rate limiting
        if (this.settings.maxRequestsPerMinute < 1 || this.settings.maxRequestsPerMinute > 60) {
            issues.push('Rate limiting fora do intervalo válido (1-60)');
        }
        
        // Validar timeout
        if (this.settings.timeoutMs < 5000 || this.settings.timeoutMs > 60000) {
            issues.push('Timeout fora do intervalo válido (5s-60s)');
        }
        
        return {
            isValid: issues.length === 0,
            issues: issues
        };
    }
    
    /**
     * 📊 Obter estatísticas da configuração
     */
    getConfigurationStats() {
        const validation = this.validateConfiguration();
        const enabledFlags = Object.values(this.featureFlags).filter(f => f).length;
        
        return {
            isConfigured: !!this.settings.apiKey,
            isValid: validation.isValid,
            issues: validation.issues,
            enabledFeatures: enabledFlags,
            totalFeatures: Object.keys(this.featureFlags).length,
            safeMode: this.featureFlags.SAFE_MODE,
            debugMode: this.settings.debugMode,
            cacheEnabled: this.settings.enableCache,
            lastSaved: localStorage.getItem('ai_config_last_saved') || 'Nunca'
        };
    }
    
    /**
     * 🛠️ Obter configuração específica
     */
    getSetting(key) {
        return this.settings[key];
    }
    
    /**
     * 🎛️ Obter feature flag específica
     */
    getFeatureFlag(flag) {
        return this.featureFlags[flag];
    }
    
    /**
     * 📋 Obter todas as configurações
     */
    getAllSettings() {
        return { ...this.settings };
    }
    
    /**
     * 🎯 Obter todas as feature flags
     */
    getAllFeatureFlags() {
        return { ...this.featureFlags };
    }
}

// 🌍 Funções globais para controle de configuração

/**
 * 🤖 Toggle global da IA
 */
window.toggleAI = function() {
    if (window.aiConfigManager) {
        return window.aiConfigManager.toggleFeatureFlag('AI_SUGGESTION_LAYER_ENABLED');
    }
    return false;
};

/**
 * 🛡️ Toggle modo seguro
 */
window.toggleSafeMode = function() {
    if (window.aiConfigManager) {
        return window.aiConfigManager.toggleFeatureFlag('SAFE_MODE');
    }
    return false;
};

/**
 * 🐛 Toggle modo debug
 */
window.toggleDebugMode = function() {
    if (window.aiConfigManager) {
        return window.aiConfigManager.toggleFeatureFlag('DEBUG_MODE');
    }
    return false;
};

/**
 * ⚙️ Configuração rápida
 */
window.quickConfigureAI = function(apiKey, model = 'gpt-3.5-turbo') {
    if (window.aiConfigManager) {
        window.aiConfigManager.updateSetting('apiKey', apiKey);
        window.aiConfigManager.updateSetting('model', model);
        return true;
    }
    return false;
};

/**
 * 📊 Verificar status da configuração
 */
window.getAIConfigStatus = function() {
    if (window.aiConfigManager) {
        return window.aiConfigManager.getConfigurationStats();
    }
    return { isConfigured: false, isValid: false };
};

// 🚀 Inicialização automática
(function() {
    'use strict';
    
    // Criar instância global do gerenciador
    window.aiConfigManager = new AIConfigurationManager();
    
    console.log('🚀 [AI-Config] Sistema de configuração inicializado globalmente');
    
    // Marcar timestamp da última inicialização
    localStorage.setItem('ai_config_last_saved', new Date().toISOString());
    
})();