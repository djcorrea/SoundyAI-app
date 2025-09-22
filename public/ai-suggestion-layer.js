// 🤖 AI SUGGESTION LAYER - Camada Inteligente de Sugestões SoundyAI
// Sistema de pós-processamento que enriquece sugestões existentes com IA
// SEGURANÇA: Nunca substitui o sistema atual - apenas enriquece
// Baseado na auditoria: AUDITORIA_SISTEMA_SUGESTOES_COMPLETA.md

class AISuggestionLayer {
    constructor() {
        this.apiKey = null;
        this.model = 'gpt-3.5-turbo'; // Default, pode ser alterado para gpt-4 (Pro)
        this.maxRetries = 3;
        this.timeout = 10000; // 10 segundos
        this.rateLimitDelay = 1000; // 1 segundo entre chamadas
        this.lastRequestTime = 0;
        
        // Cache para evitar chamadas desnecessárias
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutos
        
        // Estatísticas para monitoramento
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            cacheHits: 0,
            averageResponseTime: 0
        };
        
        console.log('🤖 [AI-LAYER] Sistema de IA inicializado - Modo: ' + this.model);
        
        // Auto-configurar API key se disponível
        this.autoConfigureApiKey();
    }
    
    /**
     * 🔑 Auto-configuração da API Key
     * Procura por chave em variáveis globais ou localStorage
     */
    autoConfigureApiKey() {
        // Prioridade: variável global > localStorage > prompt do usuário
        const globalKey = window.OPENAI_API_KEY || window.AI_API_KEY;
        const storedKey = localStorage.getItem('soundyai_openai_key');
        
        if (globalKey) {
            this.apiKey = globalKey;
            console.log('🔑 [AI-LAYER] API Key encontrada em variáveis globais');
        } else if (storedKey) {
            this.apiKey = storedKey;
            console.log('🔑 [AI-LAYER] API Key encontrada no localStorage');
        } else {
            console.warn('⚠️ [AI-LAYER] API Key não encontrada. Use setApiKey() ou configure manualmente.');
        }
    }
    
    /**
     * 🔧 Configurar API Key manualmente
     */
    setApiKey(key, model = 'gpt-3.5-turbo') {
        this.apiKey = key;
        this.model = model;
        
        // Salvar no localStorage para persistência
        localStorage.setItem('soundyai_openai_key', key);
        localStorage.setItem('soundyai_ai_model', model);
        
        console.log(`🔑 [AI-LAYER] API Key configurada - Modelo: ${model}`);
    }
    
    /**
     * 🚀 FUNÇÃO PRINCIPAL: Processar sugestões existentes com IA
     * Esta é a função chamada pelo sistema principal
     */
    async process(existingSuggestions, analysisContext) {
        const startTime = performance.now();
        
        try {
            // Validações iniciais
            if (!this.apiKey) {
                console.warn('⚠️ [AI-LAYER] API Key não configurada - usando sugestões originais');
                return existingSuggestions;
            }
            
            if (!existingSuggestions || existingSuggestions.length === 0) {
                console.warn('⚠️ [AI-LAYER] Nenhuma sugestão para processar');
                return existingSuggestions;
            }
            
            // Verificar cache
            const cacheKey = this.generateCacheKey(existingSuggestions, analysisContext);
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                this.stats.cacheHits++;
                console.log('💾 [AI-LAYER] Resultado encontrado no cache');
                return cached;
            }
            
            // Rate limiting
            await this.enforceRateLimit();
            
            // Preparar dados para IA
            const aiInput = this.prepareAIInput(existingSuggestions, analysisContext);
            
            // Chamar IA
            this.stats.totalRequests++;
            const aiResponse = await this.callOpenAI(aiInput);
            
            // Processar resposta
            const enhancedSuggestions = this.processAIResponse(aiResponse, existingSuggestions);
            
            // Atualizar cache e estatísticas
            this.saveToCache(cacheKey, enhancedSuggestions);
            this.stats.successfulRequests++;
            
            const responseTime = performance.now() - startTime;
            this.updateAverageResponseTime(responseTime);
            
            console.log(`🤖 [AI-LAYER] Processamento concluído em ${responseTime.toFixed(0)}ms`);
            console.log(`📊 [AI-LAYER] ${existingSuggestions.length} → ${enhancedSuggestions.length} sugestões`);
            
            return enhancedSuggestions;
            
        } catch (error) {
            this.stats.failedRequests++;
            console.error('❌ [AI-LAYER] Erro no processamento:', error);
            
            // FALLBACK CRÍTICO: Sempre retornar sugestões originais em caso de erro
            console.log('🛡️ [AI-LAYER] Usando fallback - sugestões originais mantidas');
            return existingSuggestions;
        }
    }
    
    /**
     * 📝 Preparar input estruturado para a IA
     */
    prepareAIInput(suggestions, context) {
        // Extrair métricas principais do contexto
        const metrics = this.extractMetrics(context);
        
        // Extrair informações de gênero e referência
        const genreInfo = this.extractGenreInfo(context);
        
        // Categorizar sugestões por tipo
        const categorizedSuggestions = this.categorizeSuggestions(suggestions);
        
        return {
            role: "system",
            content: this.buildSystemPrompt(),
            user_input: {
                metrics: metrics,
                genre: genreInfo,
                suggestions: categorizedSuggestions,
                context: {
                    timestamp: new Date().toISOString(),
                    version: 'SoundyAI_v2.0_AI_Enhanced'
                }
            }
        };
    }
    
    /**
     * 🎯 Extrair métricas principais para contexto da IA
     */
    extractMetrics(context) {
        const tech = context?.technicalData || {};
        
        return {
            // Métricas principais de loudness
            lufs: tech.lufsIntegrated || tech.lufs || null,
            truePeak: tech.truePeakDbtp || tech.true_peak || null,
            dynamicRange: tech.dynamicRange || tech.dr || null,
            lra: tech.lra || null,
            
            // Métricas espectrais
            stereoCorrelation: tech.stereoCorrelation || tech.stereo || null,
            stereoWidth: tech.stereoWidth || null,
            spectralCentroid: tech.spectralCentroidHz || null,
            
            // Bandas espectrais (se disponíveis)
            bands: tech.bandEnergies ? {
                sub: tech.bandEnergies.sub?.rms_db,
                bass: tech.bandEnergies.low_bass?.rms_db,
                lowMid: tech.bandEnergies.upper_bass?.rms_db,
                mid: tech.bandEnergies.mid?.rms_db,
                highMid: tech.bandEnergies.high_mid?.rms_db,
                presence: tech.bandEnergies.presenca?.rms_db,
                air: tech.bandEnergies.brilho?.rms_db
            } : null,
            
            // Problemas detectados
            detectedIssues: this.extractDetectedIssues(context)
        };
    }
    
    /**
     * 🎵 Extrair informações de gênero e referência
     */
    extractGenreInfo(context) {
        return {
            genre: context?.genre || window.__activeRefGenre || 'unknown',
            referenceTargets: window.__activeRefData ? {
                lufs: window.__activeRefData.lufs_target,
                truePeak: window.__activeRefData.true_peak_target,
                dr: window.__activeRefData.dr_target,
                lra: window.__activeRefData.lra_target
            } : null
        };
    }
    
    /**
     * 📂 Categorizar sugestões por tipo para melhor processamento
     */
    categorizeSuggestions(suggestions) {
        const categories = {
            loudness: [],
            dynamics: [],
            spectral: [],
            stereo: [],
            technical: [],
            other: []
        };
        
        suggestions.forEach(suggestion => {
            const type = suggestion.type || '';
            const metric = suggestion.metric || '';
            const message = (suggestion.message || suggestion.problem || '').toLowerCase();
            
            if (type.includes('loudness') || metric.includes('lufs') || message.includes('lufs') || message.includes('volume')) {
                categories.loudness.push(suggestion);
            } else if (type.includes('dynamics') || metric.includes('dr') || message.includes('dinâmica') || message.includes('lra')) {
                categories.dynamics.push(suggestion);
            } else if (type.includes('spectral') || type.includes('band') || message.includes('banda') || message.includes('frequência')) {
                categories.spectral.push(suggestion);
            } else if (type.includes('stereo') || message.includes('estéreo') || message.includes('largura')) {
                categories.stereo.push(suggestion);
            } else if (message.includes('peak') || message.includes('pico') || message.includes('clipping')) {
                categories.technical.push(suggestion);
            } else {
                categories.other.push(suggestion);
            }
        });
        
        return categories;
    }
    
    /**
     * 🔍 Extrair problemas detectados pelo sistema heurístico
     */
    extractDetectedIssues(context) {
        const issues = [];
        
        // Verificar se há problemas detectados
        if (context?.problems && Array.isArray(context.problems)) {
            issues.push(...context.problems.map(p => p.type || p.message || p));
        }
        
        // Verificar sugestões heurísticas
        if (context?.suggestions) {
            context.suggestions.forEach(s => {
                if (s.type && s.type.startsWith('heuristic_')) {
                    issues.push(s.type.replace('heuristic_', ''));
                }
            });
        }
        
        return issues;
    }
    
    /**
     * 🎨 Construir prompt sistemático para a IA
     */
    buildSystemPrompt() {
        return `Você é um especialista em produção musical e masterização trabalhando no sistema SoundyAI. 

Sua função é analisar dados técnicos de áudio e sugestões de melhoria já geradas pelo sistema, e criar explicações educacionais estruturadas.

IMPORTANTE: Você deve retornar um JSON válido com este formato exato:

{
  "enhanced_suggestions": [
    {
      "id": "unique_id",
      "category": "loudness|dynamics|spectral|stereo|technical",
      "priority": 1-10,
      "blocks": {
        "problema": "⚠️ Descrição clara do problema técnico",
        "causa": "🎯 Explicação da causa provável",
        "solucao": "🛠️ Passos práticos específicos para resolver",
        "dica": "💡 Dica profissional ou contextual adicional"
      },
      "technical_details": {
        "frequency_range": "se aplicável",
        "tools_suggested": ["lista", "de", "ferramentas"],
        "difficulty": "iniciante|intermediário|avançado"
      }
    }
  ],
  "summary": {
    "total_issues": 0,
    "priority_distribution": {"high": 0, "medium": 0, "low": 0},
    "main_focus_areas": ["área1", "área2"]
  }
}

DIRETRIZES:
- Use linguagem educativa e amigável, como um mentor experiente
- Seja específico e prático nas soluções
- Mencione ferramentas e técnicas reais
- Adapte explicações ao nível técnico apropriado
- Foque no resultado musical, não apenas nos números
- Use termos em português brasileiro`;
    }
    
    /**
     * 🌐 Chamar API da OpenAI
     */
    async callOpenAI(input) {
        const requestBody = {
            model: this.model,
            messages: [
                {
                    role: "system",
                    content: input.content
                },
                {
                    role: "user", 
                    content: `Analise estes dados de áudio e sugestões, e crie explicações educacionais estruturadas:

MÉTRICAS TÉCNICAS:
${JSON.stringify(input.user_input.metrics, null, 2)}

GÊNERO MUSICAL:
${JSON.stringify(input.user_input.genre, null, 2)}

SUGESTÕES ATUAIS:
${JSON.stringify(input.user_input.suggestions, null, 2)}

Gere explicações educacionais seguindo exatamente o formato JSON especificado.`
                }
            ],
            max_tokens: 2000,
            temperature: 0.7,
            response_format: { type: "json_object" }
        };
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API Error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    }
    
    /**
     * 🔄 Processar resposta da IA e mesclar com sugestões originais
     */
    processAIResponse(aiResponse, originalSuggestions) {
        try {
            const parsedResponse = JSON.parse(aiResponse);
            const enhancedSuggestions = parsedResponse.enhanced_suggestions || [];
            
            // Criar sugestões enriquecidas mantendo estrutura original
            const processed = enhancedSuggestions.map((aiSuggestion, index) => {
                const originalSuggestion = originalSuggestions[index] || {};
                
                return {
                    // Manter dados originais
                    ...originalSuggestion,
                    
                    // Adicionar enriquecimento da IA
                    ai_enhanced: true,
                    ai_blocks: aiSuggestion.blocks,
                    ai_category: aiSuggestion.category,
                    ai_priority: aiSuggestion.priority,
                    ai_technical_details: aiSuggestion.technical_details,
                    
                    // Manter compatibilidade com sistema existente
                    title: aiSuggestion.blocks?.problema || originalSuggestion.title || originalSuggestion.message,
                    description: aiSuggestion.blocks?.solucao || originalSuggestion.description || originalSuggestion.action
                };
            });
            
            // Se há mais sugestões originais que processadas pela IA, manter as extras
            if (originalSuggestions.length > enhancedSuggestions.length) {
                const remaining = originalSuggestions.slice(enhancedSuggestions.length);
                processed.push(...remaining.map(s => ({...s, ai_enhanced: false})));
            }
            
            return processed;
            
        } catch (error) {
            console.error('❌ [AI-LAYER] Erro ao processar resposta da IA:', error);
            // Fallback: retornar sugestões originais
            return originalSuggestions.map(s => ({...s, ai_enhanced: false}));
        }
    }
    
    /**
     * ⏱️ Controle de rate limiting
     */
    async enforceRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.rateLimitDelay) {
            const waitTime = this.rateLimitDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastRequestTime = Date.now();
    }
    
    /**
     * 💾 Sistema de cache
     */
    generateCacheKey(suggestions, context) {
        const keyData = {
            suggestions: suggestions.map(s => s.type + '_' + (s.metric || '')).join('|'),
            lufs: context?.technicalData?.lufsIntegrated,
            genre: context?.genre || window.__activeRefGenre
        };
        
        return btoa(JSON.stringify(keyData)).slice(0, 32);
    }
    
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            return cached.data;
        }
        
        this.cache.delete(key);
        return null;
    }
    
    saveToCache(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
        
        // Limpar cache expirado
        if (this.cache.size > 50) {
            const oldestKeys = Array.from(this.cache.keys()).slice(0, 10);
            oldestKeys.forEach(k => this.cache.delete(k));
        }
    }
    
    /**
     * 📊 Atualizar estatísticas
     */
    updateAverageResponseTime(responseTime) {
        if (this.stats.averageResponseTime === 0) {
            this.stats.averageResponseTime = responseTime;
        } else {
            this.stats.averageResponseTime = (this.stats.averageResponseTime + responseTime) / 2;
        }
    }
    
    /**
     * 📈 Obter estatísticas de uso
     */
    getStats() {
        const successRate = this.stats.totalRequests > 0 ? 
            (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(1) : 0;
            
        return {
            ...this.stats,
            successRate: successRate + '%',
            cacheSize: this.cache.size,
            model: this.model,
            hasApiKey: !!this.apiKey
        };
    }
    
    /**
     * 🧹 Limpeza de recursos
     */
    cleanup() {
        this.cache.clear();
        console.log('🧹 [AI-LAYER] Cache limpo');
    }
}

// 🌍 Inicialização global e configuração de feature flags
(function() {
    'use strict';
    
    // Feature flag principal
    if (typeof window.AI_SUGGESTION_LAYER_ENABLED === 'undefined') {
        window.AI_SUGGESTION_LAYER_ENABLED = true; // Ativado por padrão
    }
    
    // Instância global
    window.aiSuggestionLayer = new AISuggestionLayer();
    
    // Função de configuração rápida para desenvolvedores
    window.configureAI = function(apiKey, model = 'gpt-3.5-turbo') {
        window.aiSuggestionLayer.setApiKey(apiKey, model);
        window.AI_SUGGESTION_LAYER_ENABLED = true;
        console.log('🤖 [AI-LAYER] Configuração concluída!');
    };
    
    // Função para alternar IA
    window.toggleAI = function(enabled = null) {
        window.AI_SUGGESTION_LAYER_ENABLED = enabled !== null ? enabled : !window.AI_SUGGESTION_LAYER_ENABLED;
        console.log(`🤖 [AI-LAYER] ${window.AI_SUGGESTION_LAYER_ENABLED ? 'ATIVADA' : 'DESATIVADA'}`);
        return window.AI_SUGGESTION_LAYER_ENABLED;
    };
    
    // Função para obter estatísticas
    window.getAIStats = function() {
        return window.aiSuggestionLayer.getStats();
    };
    
    // Logs de inicialização
    console.log('🤖 [AI-LAYER] Sistema carregado com sucesso');
    console.log('🔧 [AI-LAYER] Use configureAI("sua-api-key") para configurar');
    console.log('⚡ [AI-LAYER] Use toggleAI() para ativar/desativar');
    console.log('📊 [AI-LAYER] Use getAIStats() para ver estatísticas');
    
})();