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
     * 🤖 Configurar modelo de IA
     */
    setModel(modelName) {
        this.model = modelName || 'gpt-3.5-turbo';
        
        // Salvar no localStorage para persistência
        localStorage.setItem('soundyai_ai_model', this.model);
        
        console.log(`🤖 [AI-LAYER] Modelo atualizado: ${this.model}`);
        return this;
    }
    
    /**
     * 🚀 FUNÇÃO PRINCIPAL: Processar sugestões existentes com IA
     * Esta é a função chamada pelo sistema principal
     */
    async process(existingSuggestions, analysisContext) {
        const startTime = performance.now();
        const maxRetries = 3; // Máximo 3 tentativas para resposta completa
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🚀 [AI-LAYER] Tentativa ${attempt}/${maxRetries} - Processando ${existingSuggestions.length} sugestões`);
                
                // NOVO: Não precisa mais verificar API Key - backend que gerencia
                if (!existingSuggestions || existingSuggestions.length === 0) {
                    console.warn('⚠️ [AI-LAYER] Nenhuma sugestão para processar');
                    return existingSuggestions;
                }
                
                // Verificar cache (apenas na primeira tentativa)
                if (attempt === 1) {
                    const cacheKey = this.generateCacheKey(existingSuggestions, analysisContext);
                    const cached = this.getFromCache(cacheKey);
                    if (cached) {
                        this.stats.cacheHits++;
                        console.log('💾 [AI-LAYER] Resultado encontrado no cache');
                        return cached;
                    }
                }
                
                // Rate limiting
                await this.enforceRateLimit();
                
                // Preparar dados para o backend
                const simpleSuggestions = this.prepareSimpleSuggestions(existingSuggestions);
                const metrics = this.extractMetrics(analysisContext);
                const genre = this.extractGenreInfo(analysisContext).genre;
                
                // Chamar backend
                this.stats.totalRequests++;
                const backendResponse = await this.callBackendAPI(simpleSuggestions, metrics, genre);
                
                // Processar resposta do backend (vai rejeitar respostas parciais)
                const enhancedSuggestions = this.processBackendResponse(backendResponse, existingSuggestions);
                
                // ✅ Chegou até aqui = resposta completa aceita
                console.log(`🎯 [AI-LAYER] ✅ SUCESSO na tentativa ${attempt}: ${enhancedSuggestions.length} sugestões enriquecidas`);
                
                // Atualizar cache e estatísticas (apenas salvar quando bem-sucedido)
                if (attempt === 1) {
                    const cacheKey = this.generateCacheKey(existingSuggestions, analysisContext);
                    this.saveToCache(cacheKey, enhancedSuggestions);
                }
                this.stats.successfulRequests++;
                
                const responseTime = performance.now() - startTime;
                this.updateAverageResponseTime(responseTime);
                
                console.log(`🤖 [AI-LAYER] Processamento concluído em ${responseTime.toFixed(0)}ms`);
                
                return enhancedSuggestions;
                
            } catch (error) {
                lastError = error;
                this.stats.failedRequests++;
                
                // Detectar especificamente respostas parciais vs outros erros
                if (error.message.includes('Resposta parcial:')) {
                    console.warn(`⚠️ [AI-LAYER] Tentativa ${attempt}/${maxRetries}: Resposta parcial - ${error.message}`);
                    
                    // Se não é a última tentativa, aguardar um pouco antes da próxima
                    if (attempt < maxRetries) {
                        const waitTime = attempt * 500; // 500ms, 1000ms, 1500ms
                        console.log(`⏳ [AI-LAYER] Aguardando ${waitTime}ms antes da próxima tentativa...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }
                } else {
                    // Erro diferente de resposta parcial - não retry
                    console.error('❌ [AI-LAYER] Erro não-retry:', error);
                    break;
                }
            }
        }
        
        // Se chegou aqui, todas as tentativas falharam
        console.error(`❌ [AI-LAYER] FALHA após ${maxRetries} tentativas. Último erro:`, lastError);
        console.error('🛡️ [AI-LAYER] Backend IA falhou - não exibir sugestões brutas');
        throw lastError;
    }
    
    /**
     * 📝 Preparar sugestões simples para o backend
     */
    prepareSimpleSuggestions(existingSuggestions) {
        return existingSuggestions.map(suggestion => {
            // Extrair dados da sugestão original
            const problemText = suggestion.title || suggestion.message || suggestion.problem || 'Problema detectado';
            const actionText = suggestion.description || suggestion.action || suggestion.solution || 'Ajuste recomendado';
            
            // Determinar prioridade baseado no tipo ou gravidade
            let priority = suggestion.priority || 5;
            if (typeof priority !== 'number') {
                // Converter string para número
                if (priority === 'alta' || priority === 'high') priority = 8;
                else if (priority === 'média' || priority === 'medium') priority = 5;
                else if (priority === 'baixa' || priority === 'low') priority = 2;
                else priority = 5; // default
            }
            
            // Determinar confiança baseado no tipo de análise
            let confidence = suggestion.confidence || 0.9;
            if (suggestion.type?.includes('heuristic')) confidence = 0.9;
            else if (suggestion.type?.includes('reference')) confidence = 0.8;
            else if (suggestion.type?.includes('spectral')) confidence = 0.7;
            
            // Criar mensagem educativa mais específica
            let detailedMessage = problemText;
            let detailedAction = actionText;
            
            // Enriquecer baseado no tipo de problema
            if (suggestion.metric) {
                const metric = suggestion.metric.toLowerCase();
                if (metric.includes('lufs')) {
                    detailedMessage = `Loudness ${suggestion.currentValue ? 'atual: ' + suggestion.currentValue + ' LUFS' : 'fora do alvo'}`;
                    detailedAction = `Ajustar limitador para atingir o alvo ideal de ${suggestion.targetValue || '-14 LUFS'}`;
                } else if (metric.includes('peak')) {
                    detailedMessage = `True Peak ${suggestion.currentValue ? 'detectado: ' + suggestion.currentValue + ' dBTP' : 'acima do recomendado'}`;
                    detailedAction = `Reduzir ganho ou usar limitador para manter abaixo de ${suggestion.targetValue || '-1.0 dBTP'}`;
                } else if (metric.includes('dr') || metric.includes('dynamic')) {
                    detailedMessage = `Range dinâmico ${suggestion.currentValue ? 'atual: ' + suggestion.currentValue + ' LU' : 'inadequado para o gênero'}`;
                    detailedAction = `Ajustar compressão para atingir ${suggestion.targetValue || '6-8 LU'} de dinâmica`;
                }
            }
            
            return {
                message: detailedMessage,
                action: detailedAction,
                priority: Math.max(1, Math.min(10, priority)), // Garantir que está entre 1-10
                confidence: Math.max(0, Math.min(1, confidence)) // Garantir que está entre 0-1
            };
        });
    }

    /**
     * 🔄 Processar resposta do backend
     */
    processBackendResponse(backendResponse, originalSuggestions) {
        try {
            console.log('🔄 [AI-LAYER] Processando resposta do backend:', backendResponse);
            
            if (backendResponse.success && backendResponse.enhancedSuggestions) {
                const enhancedSuggestions = backendResponse.enhancedSuggestions;
                
                // 🚨 FILTRO: Rejeitar respostas parciais (só aceitar se tem todas as sugestões)
                if (enhancedSuggestions.length !== originalSuggestions.length) {
                    console.warn(`⚠️ [AI-LAYER] Resposta PARCIAL ignorada: recebido ${enhancedSuggestions.length}, esperado ${originalSuggestions.length}`);
                    throw new Error(`Resposta parcial: ${enhancedSuggestions.length}/${originalSuggestions.length} sugestões`);
                }
                
                console.log(`✅ [AI-LAYER] Resposta COMPLETA aceita: ${enhancedSuggestions.length} sugestões processadas`);
                
                // Converter formato do backend para formato esperado pelo frontend
                return enhancedSuggestions.map((backendSuggestion, index) => {
                    const originalSuggestion = originalSuggestions[index] || {};
                    
                    return {
                        // Manter dados originais
                        ...originalSuggestion,
                        
                        // Adicionar enriquecimento do backend
                        ai_enhanced: true,
                        ai_blocks: backendSuggestion.blocks || {},
                        ai_category: backendSuggestion.metadata?.processing_type || 'geral',
                        ai_priority: backendSuggestion.metadata?.priority === 'alta' ? 8 : 
                                   backendSuggestion.metadata?.priority === 'média' ? 5 : 3,
                        ai_technical_details: {
                            difficulty: backendSuggestion.metadata?.difficulty || 'intermediário',
                            frequency_range: backendSuggestion.metadata?.frequency_range || '',
                            tools_suggested: [backendSuggestion.blocks?.plugin || 'EQ/Compressor'].filter(Boolean)
                        },
                        
                        // Manter compatibilidade com sistema existente
                        title: backendSuggestion.blocks?.problem || originalSuggestion.title || originalSuggestion.message,
                        description: backendSuggestion.blocks?.solution || originalSuggestion.description || originalSuggestion.action
                    };
                });
            } else {
                console.warn('🤖 [AI-LAYER] Backend não retornou sugestões enriquecidas');
                throw new Error('Backend não forneceu sugestões válidas');
            }
            
        } catch (error) {
            console.error('❌ [AI-LAYER] Erro ao processar resposta do backend:', error);
            // NÃO USAR FALLBACK: Se backend falhou, reportar erro
            throw error;
        }
    }
    
    /**
     * 🎯 Extrair métricas principais para contexto da IA
     */
    extractMetrics(context) {
        const tech = context?.technicalData || {};
        
        // Formato esperado pelo backend
        return {
            // Métricas principais de loudness
            lufsIntegrated: tech.lufsIntegrated || tech.lufs || null,
            truePeakDbtp: tech.truePeakDbtp || tech.true_peak || null,
            dynamicRange: tech.dynamicRange || tech.dr || null,
            lra: tech.lra || null,
            
            // Métricas espectrais
            stereoCorrelation: tech.stereoCorrelation || tech.stereo || null,
            stereoWidth: tech.stereoWidth || null,
            spectralCentroid: tech.spectralCentroidHz || null,
            
            // Bandas espectrais no formato esperado pelo backend
            bands: this.extractBandEnergies(tech)
        };
    }

    /**
     * 🎵 Extrair bandas espectrais no formato esperado pelo backend
     */
    extractBandEnergies(tech) {
        if (!tech.bandEnergies) return null;
        
        // Converter para o formato esperado pelo backend
        const bandEnergies = tech.bandEnergies;
        const referenceTargets = window.__activeRefData?.bands || {};
        
        return {
            sub: {
                value: bandEnergies.sub?.rms_db || 0,
                ideal: referenceTargets.sub?.target || -16.0
            },
            bass: {
                value: bandEnergies.low_bass?.rms_db || 0,  
                ideal: referenceTargets.bass?.target || -17.8
            },
            lowMid: {
                value: bandEnergies.upper_bass?.rms_db || 0,
                ideal: referenceTargets.lowMid?.target || -18.2
            },
            mid: {
                value: bandEnergies.mid?.rms_db || 0,
                ideal: referenceTargets.mid?.target || -17.1
            },
            highMid: {
                value: bandEnergies.high_mid?.rms_db || 0,
                ideal: referenceTargets.highMid?.target || -20.8
            },
            presence: {
                value: bandEnergies.presenca?.rms_db || 0,
                ideal: referenceTargets.presence?.target || -34.6
            },
            air: {
                value: bandEnergies.brilho?.rms_db || 0,
                ideal: referenceTargets.air?.target || -25.5
            }
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
     * 🌐 Chamar API do Backend (corrigido para usar /api/suggestions)
     */
    async callBackendAPI(suggestions, metrics, genre) {
        console.log(`[AI-LAYER] 📤 Enviando payload com ${suggestions.length} sugestões:`, {
            suggestions: suggestions,
            metrics: metrics,
            genre: genre
        });

        const response = await fetch('/api/suggestions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                suggestions: suggestions,
                metrics: metrics,
                genre: genre
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[AI-LAYER] Erro na API do backend:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            throw new Error(`Backend API Error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        // 🔍 DIAGNÓSTICO: Verificar se resposta é parcial
        if (data.success && data.enhancedSuggestions) {
            const receivedCount = data.enhancedSuggestions.length;
            const expectedCount = suggestions.length;
            
            if (receivedCount !== expectedCount) {
                console.warn(`⚠️ [AI-LAYER] 📥 RESPOSTA PARCIAL detectada: recebido ${receivedCount}/${expectedCount} sugestões`);
            } else {
                console.log(`✅ [AI-LAYER] 📥 RESPOSTA COMPLETA recebida: ${receivedCount}/${expectedCount} sugestões`);
            }
        }
        
        console.log('[AI-LAYER] Resposta recebida:', data);
        
        return data;
    }
    
    /**
     * 🔄 Processar resposta da IA e mesclar com sugestões originais (LEGADO - mantido para compatibilidade)
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
            // NÃO USAR FALLBACK: Se processamento falhou, reportar erro
            throw error;
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