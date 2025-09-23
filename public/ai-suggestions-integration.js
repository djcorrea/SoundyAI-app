// 🚀 AI SUGGESTIONS INTEGRATION SYSTEM
// Sistema de integração das sugestões IA com o modal expandido

class AISuggestionsIntegration {
    constructor() {
        // 🔧 Detecta ambiente e configura URL correta
        const isLocalDevelopment = window.location.hostname === 'localhost' || 
                                   window.location.hostname === '127.0.0.1' ||
                                   window.location.port === '3000';
        
        this.apiEndpoint = isLocalDevelopment 
            ? 'http://localhost:8080/api/suggestions'  // Desenvolvimento
            : '/api/suggestions';                       // Produção (Railway)
            
        this.isProcessing = false;
        this.currentSuggestions = [];
        this.isExpanded = false;
        this.retryAttempts = 0;
        this.maxRetries = 3;
        
        console.log(`🚀 [AI-INTEGRATION] Sistema inicializado - Ambiente: ${isLocalDevelopment ? 'desenvolvimento' : 'produção'}`);
        console.log(`🔗 [AI-INTEGRATION] API URL: ${this.apiEndpoint}`);
        
        // Bind methods
        this.processWithAI = this.processWithAI.bind(this);
        this.displaySuggestions = this.displaySuggestions.bind(this);
        this.toggleExpanded = this.toggleExpanded.bind(this);
        
        // Initialize
        this.initialize();
    }
    
    initialize() {
        // Check if elements exist
        this.elements = {
            container: document.getElementById('aiSuggestionsExpanded'),
            loading: document.getElementById('aiExpandedLoading'),
            grid: document.getElementById('aiExpandedGrid'),
            fallbackNotice: document.getElementById('aiFallbackNotice'),
            status: document.getElementById('aiExpandedStatus'),
            statusText: document.querySelector('#aiExpandedStatus .ai-status-text'),
            statusDot: document.querySelector('#aiExpandedStatus .ai-status-dot'),
            count: document.getElementById('aiExpandedCount'),
            time: document.getElementById('aiExpandedTime'),
            mode: document.getElementById('aiExpandedMode'),
            toggleIcon: document.getElementById('aiExpandedToggleIcon')
        };
        
        // Validate required elements
        const requiredElements = ['container', 'loading', 'grid', 'status'];
        const missing = requiredElements.filter(key => !this.elements[key]);
        
        if (missing.length > 0) {
            console.error('❌ [AI-INTEGRATION] Elementos obrigatórios não encontrados:', missing);
            return false;
        }
        
        console.log('✅ [AI-INTEGRATION] Elementos validados com sucesso');
        return true;
    }
    
    /**
     * Processar sugestões com IA - TODAS as sugestões, sem fallback
     */
    async processWithAI(suggestions, metrics = {}, genre = null) {
        if (this.isProcessing) {
            console.log('⚠️ [AI-INTEGRATION] Processamento já em andamento');
            return;
        }

        // 🔍 VALIDAÇÃO CRÍTICA: Verificar se há sugestões válidas
        if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
            console.log('� [AI-INTEGRATION] Nenhuma sugestão detectada - exibindo mensagem informativa');
            
            this.isProcessing = true;
            this.currentSuggestions = [];
            
            // Mostrar container sem loading
            // TODO: simple modal removed by design (AI-only)
            // this.showContainer();
            console.log('🚫 [AI-INTEGRATION] Container aiSuggestionsExpanded desabilitado - usando apenas modal roxo');
            this.setLoadingState(false);
            this.updateStatus('info', 'Áudio analisado');
            this.hideFallbackNotice();
            
            // Exibir mensagem de nenhuma sugestão
            this.displayEmptyState('Nenhuma sugestão disponível para este arquivo');
            this.updateStats(0, 0, 'empty');
            
            this.isProcessing = false;
            return;
        }

        // 🔍 VALIDAÇÃO DO PAYLOAD: Garantir estrutura correta
        const validSuggestions = this.validateAndNormalizeSuggestions(suggestions);
        if (validSuggestions.length === 0) {
            console.warn('⚠️ [AI-INTEGRATION] Sugestões inválidas após validação');
            this.displayEmptyState('Sugestões detectadas são inválidas');
            return;
        }

        console.log('�🚀 [AI-INTEGRATION] Iniciando processamento COMPLETO com IA...', {
            suggestionsOriginais: suggestions.length,
            suggestionsValidas: validSuggestions.length,
            genre: genre || 'não especificado',
            metricas: Object.keys(metrics).length
        });
        
        this.isProcessing = true;
        this.currentSuggestions = validSuggestions;
        
        // Show container and loading state
        // TODO: simple modal removed by design (AI-only)
        // this.showContainer();
        console.log('🚫 [AI-INTEGRATION] Container aiSuggestionsExpanded desabilitado - usando apenas modal roxo');
        this.setLoadingState(true);
        this.updateStatus('processing', `Processando ${validSuggestions.length} sugestões...`);
        
        const startTime = Date.now();
        const allEnhancedSuggestions = [];
        let aiSuccessCount = 0;
        let aiErrorCount = 0;
        
        try {
            console.log('📋 [AI-INTEGRATION] Enviando TODAS as sugestões para IA:', validSuggestions.length);

            // 🔍 MONTAGEM DO PAYLOAD VÁLIDO
            const payload = this.buildValidPayload(validSuggestions, metrics, genre);
            console.log('📦 [AI-INTEGRATION] Payload construído:', {
                genre: payload.genre,
                metricsKeys: Object.keys(payload.metrics),
                detectedIssuesCount: payload.detectedIssues ? payload.detectedIssues.length : 0,
                contextSuggestionsCount: payload.suggestionsContext ? payload.suggestionsContext.length : 0
            });
            
            // ✅ VALIDAÇÃO DE PAYLOAD ANTES DE ENVIAR
            if (!payload.detectedIssues || payload.detectedIssues.length === 0) {
                console.warn('⚠️ [AI-INTEGRATION] Payload sem problemas detectados - usando fallback');
                throw new Error('PAYLOAD_INVALID: Nenhum problema detectado para análise');
            }
            
            // Enviar para a IA
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const processingTime = Date.now() - startTime;
            
            console.log('📊 [AI-INTEGRATION] Resposta completa da IA:', {
                success: data.success,
                source: data.source,
                suggestionsRecebidas: suggestions?.length || 0,
                suggestionsEnriquecidas: data.enhancedSuggestions?.length || 0,
                processingTime: `${processingTime}ms`
            });
            
            if (data.source === 'ai' && data.enhancedSuggestions?.length > 0) {
                aiSuccessCount = data.enhancedSuggestions.length;
                allEnhancedSuggestions.push(...data.enhancedSuggestions);
                
                console.log('✅ [AI-INTEGRATION] IA processou com sucesso:', {
                    total: aiSuccessCount,
                    exemploBlocos: data.enhancedSuggestions[0]?.blocks ? Object.keys(data.enhancedSuggestions[0].blocks) : 'N/A'
                });
                
                this.updateStatus('success', `IA processou ${aiSuccessCount} sugestões`);
            } else {
                console.error('❌ [AI-INTEGRATION] IA não retornou sugestões válidas:', {
                    source: data.source,
                    message: data.message,
                    error: data.error
                });
                aiErrorCount = suggestions?.length || 0;
                this.updateStatus('error', 'IA não respondeu corretamente');
            }
            
            // 🎯 MERGE INTELIGENTE: Sempre preservar TODAS as sugestões originais
            const mergedSuggestions = this.mergeAISuggestionsWithOriginals(validSuggestions, allEnhancedSuggestions);
            
            // Log final detalhado
            console.log('📈 [AI-INTEGRATION] RESULTADO FINAL:', {
                suggestionsOriginais: validSuggestions.length,
                suggestionsEnriquecidas: allEnhancedSuggestions.length,
                suggestionsFinais: mergedSuggestions.length,
                sucessosIA: aiSuccessCount,
                errosIA: aiErrorCount,
                tempoTotal: `${processingTime}ms`,
                fonteFinal: data.source
            });
            
            // ✅ SEMPRE exibir TODAS as sugestões (originais + enriquecidas)
            this.displaySuggestions(mergedSuggestions, allEnhancedSuggestions.length > 0 ? 'ai' : 'local');
            this.updateStats(mergedSuggestions.length, processingTime, allEnhancedSuggestions.length > 0 ? 'ai' : 'local');
            this.hideFallbackNotice();
            
        } catch (error) {
            console.error('❌ [AI-INTEGRATION] Erro crítico no processamento:', error);
            
            // Se for erro de payload inválido, não tentar retry - exibir sugestões originais
            if (error.message.includes('PAYLOAD_INVALID')) {
                console.log('🔄 [AI-INTEGRATION] Payload inválido - exibindo sugestões originais');
                this.updateStatus('ready', 'Sugestões locais');
                this.displaySuggestions(validSuggestions, 'local');
                this.updateStats(validSuggestions.length, Date.now() - startTime, 'local');
                this.hideFallbackNotice();
                return;
            }
            
            // Se der erro, tentar retry apenas para erros de conexão
            if (this.retryAttempts < this.maxRetries) {
                this.retryAttempts++;
                console.log(`🔄 [AI-INTEGRATION] Tentativa ${this.retryAttempts}/${this.maxRetries}...`);
                
                this.updateStatus('processing', `Tentativa ${this.retryAttempts}...`);
                
                // Exponential backoff
                const delay = Math.pow(2, this.retryAttempts) * 1000;
                setTimeout(() => {
                    this.processWithAI(suggestions, metrics, genre);
                }, delay);
                
                return;
            }
            
            // Erro final - exibir sugestões originais como fallback
            console.error('🚫 [AI-INTEGRATION] FALHA TOTAL - exibindo sugestões originais');
            this.updateStatus('ready', 'Sugestões locais (IA indisponível)');
            this.displaySuggestions(validSuggestions, 'local');
            this.updateStats(validSuggestions.length, Date.now() - startTime, 'local');
            this.showFallbackNotice('IA temporariamente indisponível. Exibindo análise local.');
            
        } finally {
            this.setLoadingState(false);
            this.isProcessing = false;
            this.retryAttempts = 0; // Reset para próxima chamada
        }
    }

    /**
     * Validar e normalizar sugestões antes de enviar para IA
     */
    validateAndNormalizeSuggestions(suggestions) {
        if (!Array.isArray(suggestions)) {
            console.warn('⚠️ [AI-INTEGRATION] Sugestões não são array:', typeof suggestions);
            return [];
        }

        const validSuggestions = suggestions.filter(suggestion => {
            // Validar se tem pelo menos message ou issue
            const hasContent = suggestion && (suggestion.message || suggestion.issue || suggestion.title);
            
            if (!hasContent) {
                console.warn('⚠️ [AI-INTEGRATION] Sugestão inválida (sem conteúdo):', suggestion);
                return false;
            }

            return true;
        }).map(suggestion => {
            // Normalizar estrutura para o formato esperado pelo backend
            return {
                metric: suggestion.metric || suggestion.type || 'geral',
                issue: suggestion.issue || suggestion.message || suggestion.title || 'Problema detectado',
                solution: suggestion.solution || suggestion.action || suggestion.description || 'Ajuste recomendado',
                priority: suggestion.priority || 5,
                confidence: suggestion.confidence || 0.7
            };
        });

        console.log('✅ [AI-INTEGRATION] Sugestões validadas:', {
            original: suggestions.length,
            valid: validSuggestions.length,
            filtered: suggestions.length - validSuggestions.length
        });

        return validSuggestions;
    }

    /**
     * Construir payload válido para o backend - FOCADO EM PROBLEMAS DETECTADOS
     */
    buildValidPayload(suggestions, metrics, genre) {
        // Em vez de enviar sugestões prontas, vamos enviar os PROBLEMAS DETECTADOS
        const detectedIssues = this.extractDetectedIssues(suggestions, metrics);
        
        // Estrutura base do payload focada nos PROBLEMAS
        const payload = {
            genre: genre || 'geral',
            metrics: this.normalizeMetrics(metrics),
            detectedIssues: detectedIssues,
            analysisContext: {
                totalIssues: detectedIssues.length,
                severityDistribution: this.categorizeSeverity(detectedIssues),
                primaryConcerns: this.identifyPrimaryConcerns(detectedIssues)
            },
            // Manter suggestions para compatibilidade, mas marcar como contexto
            suggestionsContext: suggestions.map(s => ({
                category: s.category,
                metric: s.metric,
                priority: s.priority
            }))
        };

        console.log('📦 [AI-INTEGRATION] Payload focado em PROBLEMAS construído:', {
            genre: payload.genre,
            detectedIssues: payload.detectedIssues.length,
            primaryConcerns: payload.analysisContext.primaryConcerns,
            contextSuggestions: payload.suggestionsContext.length
        });

        return payload;
    }

    /**
     * Extrair problemas detectados das sugestões e métricas
     */
    extractDetectedIssues(suggestions, metrics) {
        const issues = [];
        
        console.log('🔍 [AI-DEBUG] Analisando sugestões recebidas:', {
            total: suggestions.length,
            primeiraSugestao: suggestions[0],
            estrutura: suggestions.length > 0 ? Object.keys(suggestions[0]) : 'N/A'
        });
        
        // 1. Extrair problemas das sugestões existentes
        suggestions.forEach((suggestion, index) => {
            console.log(`🔍 [AI-DEBUG] Sugestão ${index}:`, {
                hasType: !!suggestion.type,
                hasMessage: !!suggestion.message,
                hasText: !!suggestion.text,
                hasAction: !!suggestion.action,
                hasPriority: !!suggestion.priority,
                type: suggestion.type,
                message: suggestion.message?.substring(0, 50) + '...',
                todasChaves: Object.keys(suggestion)
            });
            
            // CORRIGIDO: mapear campos reais das sugestões do Enhanced Engine
            const issueType = suggestion.type || suggestion.category || 'unknown';
            const description = suggestion.message || suggestion.text || suggestion.description || suggestion.action;
            
            if (issueType && description) {
                const issue = {
                    type: issueType,
                    description: description,
                    severity: this.mapPriorityToSeverity(suggestion.priority || 1.0),
                    metric: suggestion.metricType || suggestion.metric || issueType,
                    source: 'suggestion_engine'
                };
                issues.push(issue);
                console.log(`✅ [AI-DEBUG] Issue adicionado:`, issue);
            } else {
                console.log(`❌ [AI-DEBUG] Sugestão ${index} rejeitada:`, {
                    type: issueType,
                    description: !!description,
                    hasMappableFields: !!(suggestion.message || suggestion.text || suggestion.action)
                });
            }
        });

        // 2. FALLBACK: Se poucos issues foram detectados, criar com base em campos genéricos
        if (issues.length === 0 && suggestions.length > 0) {
            console.log('🔄 [AI-FALLBACK] Aplicando lógica de fallback para detectar problemas...');
            
            suggestions.forEach((suggestion, index) => {
                const fallbackIssue = {
                    type: 'audio_optimization',
                    description: suggestion.message || suggestion.text || suggestion.action || `Sugestão de melhoria ${index + 1}`,
                    severity: this.mapPriorityToSeverity(suggestion.priority || 1.0),
                    metric: 'general',
                    source: 'fallback_detection'
                };
                issues.push(fallbackIssue);
                console.log(`🔄 [AI-FALLBACK] Issue criado:`, fallbackIssue);
            });
        }

        // 3. Detectar problemas diretamente das métricas
        const metricIssues = this.detectMetricIssues(metrics);
        issues.push(...metricIssues);

        console.log('🔍 [AI-INTEGRATION] Problemas detectados:', {
            fromSuggestions: suggestions.length,
            fromMetrics: metricIssues.length,
            total: issues.length
        });

        return issues;
    }

    /**
     * Detectar problemas diretamente das métricas
     */
    detectMetricIssues(metrics) {
        const issues = [];
        
        // Verificar loudness
        if (metrics.loudness !== undefined && metrics.loudness.target !== undefined) {
            const current = metrics.loudness.value || metrics.loudness;
            const target = metrics.loudness.target;
            const tolerance = metrics.loudness.tolerance || 1.0;
            const deviation = Math.abs(current - target);
            
            if (deviation > tolerance) {
                issues.push({
                    type: 'loudness',
                    description: `Loudness atual (${current} LUFS) ${current > target ? 'acima' : 'abaixo'} do target (${target} LUFS)`,
                    severity: deviation > tolerance * 2 ? 'high' : 'medium',
                    metric: 'loudness',
                    currentValue: current,
                    targetValue: target,
                    deviation: deviation,
                    source: 'metrics_analysis'
                });
            }
        }

        // Verificar true peak
        if (metrics.truePeak !== undefined && metrics.truePeak.target !== undefined) {
            const current = metrics.truePeak.value || metrics.truePeak;
            const target = metrics.truePeak.target;
            const tolerance = metrics.truePeak.tolerance || 0.5;
            const deviation = Math.abs(current - target);
            
            if (deviation > tolerance) {
                issues.push({
                    type: 'truePeak',
                    description: `True Peak atual (${current} dB) ${current > target ? 'acima' : 'abaixo'} do target (${target} dB)`,
                    severity: deviation > tolerance * 2 ? 'high' : 'medium',
                    metric: 'truePeak',
                    currentValue: current,
                    targetValue: target,
                    deviation: deviation,
                    source: 'metrics_analysis'
                });
            }
        }

        return issues;
    }

    /**
     * Mapear prioridade para severidade
     */
    mapPriorityToSeverity(priority) {
        const mapping = {
            'urgent': 'high',
            'high': 'high',
            'medium': 'medium',
            'low': 'low'
        };
        return mapping[priority] || 'medium';
    }

    /**
     * Categorizar severidade dos problemas
     */
    categorizeSeverity(issues) {
        const distribution = { high: 0, medium: 0, low: 0 };
        issues.forEach(issue => {
            distribution[issue.severity] = (distribution[issue.severity] || 0) + 1;
        });
        return distribution;
    }

    /**
     * Identificar principais preocupações
     */
    identifyPrimaryConcerns(issues) {
        return issues
            .filter(issue => issue.severity === 'high')
            .map(issue => issue.type)
            .slice(0, 3); // Top 3 concerns
    }

    /**
     * Mescla as sugestões originais com as respostas da IA
     * Preserva TODAS as sugestões originais e enriquece com dados da IA
     */
    mergeAISuggestionsWithOriginals(originalSuggestions, aiResponse) {
        console.log('[AI-MERGE] Iniciando merge de sugestões:', {
            originais: originalSuggestions?.length || 0,
            aiResponse: aiResponse ? 'presente' : 'ausente'
        });

        // Se não há sugestões originais, retorna array vazio
        if (!originalSuggestions || !Array.isArray(originalSuggestions)) {
            console.warn('[AI-MERGE] ⚠️ Sugestões originais inválidas');
            return [];
        }

        // Se não há resposta da IA, retorna as originais
        if (!aiResponse || !aiResponse.suggestions || !Array.isArray(aiResponse.suggestions)) {
            console.log('[AI-MERGE] 📋 Sem resposta IA válida, retornando originais:', originalSuggestions.length);
            return originalSuggestions;
        }

        console.log('[AI-MERGE] 🤖 Processando enriquecimento com IA:', aiResponse.suggestions.length);

        // Cria cópia das sugestões originais para não modificar o array original
        const mergedSuggestions = [...originalSuggestions];

        // Para cada sugestão da IA, tenta encontrar correspondência nas originais
        aiResponse.suggestions.forEach((aiSuggestion, index) => {
            console.log(`[AI-MERGE] Processando sugestão IA ${index + 1}:`, aiSuggestion.title || aiSuggestion.category);

            // Busca por correspondência usando múltiplos critérios
            const matchIndex = mergedSuggestions.findIndex(original => {
                // Critério 1: Título exato
                if (aiSuggestion.title && original.title === aiSuggestion.title) {
                    return true;
                }
                
                // Critério 2: Categoria
                if (aiSuggestion.category && original.category === aiSuggestion.category) {
                    return true;
                }
                
                // Critério 3: Type/metric
                if (aiSuggestion.type && original.type === aiSuggestion.type) {
                    return true;
                }
                
                // Critério 4: Metric name
                if (aiSuggestion.metric && original.metric === aiSuggestion.metric) {
                    return true;
                }

                return false;
            });

            if (matchIndex !== -1) {
                // Encontrou correspondência - enriquece a sugestão original
                console.log(`[AI-MERGE] ✅ Match encontrado no índice ${matchIndex}`);
                
                const originalSuggestion = mergedSuggestions[matchIndex];
                
                // Enriquece com dados da IA, preservando dados originais importantes
                mergedSuggestions[matchIndex] = {
                    ...originalSuggestion, // Mantém todos os dados originais
                    
                    // Enriquece com dados da IA quando disponíveis
                    ...(aiSuggestion.title && { aiTitle: aiSuggestion.title }),
                    ...(aiSuggestion.description && { aiDescription: aiSuggestion.description }),
                    ...(aiSuggestion.solution && { aiSolution: aiSuggestion.solution }),
                    ...(aiSuggestion.priority && { aiPriority: aiSuggestion.priority }),
                    ...(aiSuggestion.rationale && { aiRationale: aiSuggestion.rationale }),
                    ...(aiSuggestion.techniques && { aiTechniques: aiSuggestion.techniques }),
                    
                    // Marca como enriquecida pela IA
                    aiEnhanced: true,
                    aiEnhancedAt: new Date().toISOString()
                };
                
                console.log(`[AI-MERGE] 🎯 Sugestão ${matchIndex} enriquecida com IA`);
            } else {
                // Não encontrou correspondência - adiciona como nova sugestão
                console.log('[AI-MERGE] ➕ Adicionando nova sugestão da IA');
                
                mergedSuggestions.push({
                    ...aiSuggestion,
                    isAIGenerated: true,
                    aiEnhanced: true,
                    aiEnhancedAt: new Date().toISOString(),
                    // Garante que tenha campos obrigatórios
                    title: aiSuggestion.title || 'Sugestão da IA',
                    description: aiSuggestion.description || 'Sugestão gerada pela inteligência artificial',
                    category: aiSuggestion.category || 'ai-generated',
                    priority: aiSuggestion.priority || 'medium'
                });
            }
        });

        console.log('[AI-MERGE] 🎉 Merge concluído:', {
            originais: originalSuggestions.length,
            finais: mergedSuggestions.length,
            enriquecidas: mergedSuggestions.filter(s => s.aiEnhanced).length,
            novasIA: mergedSuggestions.filter(s => s.isAIGenerated).length
        });

        return mergedSuggestions;
    }

    /**
     * Normalizar métricas para o formato esperado
     */
    normalizeMetrics(metrics) {
        if (!metrics || typeof metrics !== 'object') {
            return {};
        }

        const normalized = {};

        // Métricas principais
        if (metrics.loudness !== undefined) {
            normalized.loudness = {
                value: metrics.loudness,
                target: metrics.loudnessTarget || -8.3,
                tolerance: metrics.loudnessTolerance || 1.22
            };
        }

        if (metrics.truePeak !== undefined) {
            normalized.truePeak = {
                value: metrics.truePeak,
                target: metrics.truePeakTarget || -1,
                tolerance: metrics.truePeakTolerance || 0.5
            };
        }

        if (metrics.dynamicRange !== undefined) {
            normalized.dynamicRange = {
                value: metrics.dynamicRange,
                target: metrics.dynamicRangeTarget || 10.1,
                tolerance: metrics.dynamicRangeTolerance || 1.35
            };
        }

        // Bandas espectrais
        if (metrics.bands || metrics.spectralBands) {
            const bands = metrics.bands || metrics.spectralBands || {};
            normalized.bands = {};

            const bandMapping = {
                bass: { target: 13.3, tolerance: 2.36 },
                lowMid: { target: 8.8, tolerance: 2.07 },
                mid: { target: 2.5, tolerance: 1.81 },
                highMid: { target: -6.7, tolerance: 1.52 },
                presence: { target: -22.7, tolerance: 3.47 },
                air: { target: -13.1, tolerance: 2.38 }
            };

            Object.keys(bandMapping).forEach(band => {
                if (bands[band] !== undefined) {
                    normalized.bands[band] = {
                        value: bands[band],
                        target: bandMapping[band].target,
                        tolerance: bandMapping[band].tolerance
                    };
                }
            });
        }

        // Fallback para métricas diretas
        Object.keys(metrics).forEach(key => {
            if (!normalized[key] && typeof metrics[key] === 'number') {
                normalized[key] = metrics[key];
            }
        });

        return normalized;
    }

    /**
     * Exibir estado vazio quando não há sugestões
     */
    displayEmptyState(message) {
        if (!this.elements.grid) {
            console.error('❌ [AI-INTEGRATION] Grid element not found');
            return;
        }

        this.elements.grid.innerHTML = `
            <div class="ai-suggestions-empty">
                <div class="ai-empty-icon">✅</div>
                <h3>Áudio Analisado com Sucesso</h3>
                <p>${message}</p>
                <div class="ai-empty-details">
                    <small>Isso significa que seu áudio está dentro dos padrões de qualidade para o gênero selecionado.</small>
                </div>
            </div>
        `;

        this.elements.grid.style.display = 'block';
        console.log('📋 [AI-INTEGRATION] Estado vazio exibido:', message);
    }
    
    /**
     * Exibir sugestões no grid
     */
    displaySuggestions(suggestions, source = 'ai') {
        if (!this.elements.grid) {
            console.error('❌ [AI-INTEGRATION] Grid element not found');
            return;
        }
        
        // Clear grid
        this.elements.grid.innerHTML = '';
        
        if (!suggestions || suggestions.length === 0) {
            this.elements.grid.innerHTML = `
                <div class="ai-suggestions-empty">
                    <p>Nenhuma sugestão disponível no momento.</p>
                </div>
            `;
            return;
        }
        
        // Generate cards
        suggestions.forEach((suggestion, index) => {
            const card = this.createSuggestionCard(suggestion, index, source);
            this.elements.grid.appendChild(card);
        });
        
        // Show grid
        this.elements.grid.style.display = 'grid';
        
        // Animate cards
        this.animateCards();
        
        console.log(`✅ [AI-INTEGRATION] ${suggestions.length} sugestões exibidas (fonte: ${source})`);
    }
    
    /**
     * Criar card de sugestão
     */
    createSuggestionCard(suggestion, index, source) {
        const card = document.createElement('div');
        card.className = `ai-suggestion-card ${source === 'fallback' ? 'ai-base-suggestion' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;
        
        // Extract data
        const blocks = suggestion.blocks || this.createFallbackBlocks(suggestion);
        const metadata = suggestion.metadata || { priority: 'média', difficulty: 'intermediário' };
        const isAIEnhanced = suggestion.aiEnhanced !== false && source === 'ai';
        
        card.innerHTML = `
            <div class="ai-suggestion-blocks">
                ${this.createBlock('problema', blocks.problem)}
                ${this.createBlock('causa', blocks.cause)}
                ${this.createBlock('solucao', blocks.solution)}
                ${this.createBlock('dica', blocks.tip)}
                ${blocks.plugin ? this.createBlock('plugin', blocks.plugin) : ''}
                ${blocks.result ? this.createBlock('resultado', blocks.result) : ''}
            </div>
            
            <div class="ai-suggestion-metadata">
                <div class="ai-metadata-badges">
                    <span class="ai-badge priority-${metadata.priority?.toLowerCase() || 'media'}">
                        ${metadata.priority || 'Média'}
                    </span>
                    <span class="ai-badge difficulty">
                        ${metadata.difficulty || 'Intermediário'}
                    </span>
                    ${metadata.genre_specific ? `<span class="ai-badge genre">${metadata.genre_specific}</span>` : ''}
                </div>
                
                <div class="ai-enhanced-indicator ${isAIEnhanced ? '' : 'fallback'}">
                    <span>${isAIEnhanced ? '🤖' : '⚙️'}</span>
                    <span>${isAIEnhanced ? 'IA' : 'Base'}</span>
                </div>
            </div>
        `;
        
        return card;
    }
    
    /**
     * Criar bloco de conteúdo
     */
    createBlock(type, content) {
        const icons = {
            problema: '⚠️',
            causa: '🎯',
            solucao: '🛠️',
            dica: '💡',
            plugin: '🎹',
            resultado: '✅'
        };
        
        const titles = {
            problema: 'Problema',
            causa: 'Causa Provável',
            solucao: 'Solução Prática',
            dica: 'Dica Extra',
            plugin: 'Plugin/Ferramenta',
            resultado: 'Resultado Esperado'
        };
        
        return `
            <div class="ai-block ai-block-${type}">
                <div class="ai-block-title">
                    <span>${icons[type]}</span>
                    <strong>${titles[type]}</strong>
                </div>
                <div class="ai-block-content">${content || 'Informação não disponível'}</div>
            </div>
        `;
    }
    
    /**
     * Criar blocos de fallback para sugestões sem IA
     */
    createFallbackBlocks(suggestion) {
        return {
            problem: `⚠️ ${suggestion.message || suggestion.title || 'Problema detectado na análise'}`,
            cause: '🎯 Análise automática detectou desvio dos padrões de referência',
            solution: `🛠️ ${suggestion.action || suggestion.description || 'Ajuste recomendado pelo sistema'}`,
            tip: '💡 Monitore o resultado em diferentes sistemas de áudio para validar a melhoria',
            plugin: '🎹 Use EQ nativo da sua DAW ou plugins gratuitos como ReaEQ',
            result: '✅ Melhoria na qualidade sonora e maior compatibilidade profissional'
        };
    }
    
    /**
     * Animar cards
     */
    animateCards() {
        const cards = this.elements.grid.querySelectorAll('.ai-suggestion-card');
        cards.forEach((card, index) => {
            card.classList.add('ai-new');
            setTimeout(() => {
                card.classList.remove('ai-new');
            }, 600 + (index * 100));
        });
    }
    
    /**
     * Mostrar container
     */
    showContainer() {
        if (this.elements.container) {
            this.elements.container.style.display = 'block';
            this.elements.container.classList.add('expanding');
            
            setTimeout(() => {
                this.elements.container.classList.remove('expanding');
            }, 500);
        }
    }
    
    /**
     * Ocultar container
     */
    hideContainer() {
        if (this.elements.container) {
            this.elements.container.classList.add('collapsing');
            
            setTimeout(() => {
                this.elements.container.style.display = 'none';
                this.elements.container.classList.remove('collapsing');
            }, 500);
        }
    }
    
    /**
     * Controlar estado de loading
     */
    setLoadingState(isLoading) {
        if (this.elements.loading) {
            this.elements.loading.style.display = isLoading ? 'flex' : 'none';
        }
        
        if (this.elements.grid) {
            this.elements.grid.style.display = isLoading ? 'none' : 'grid';
        }
    }
    
    /**
     * Atualizar status
     */
    updateStatus(type, text) {
        if (this.elements.status) {
            this.elements.status.className = `ai-status-indicator ${type}`;
        }
        
        if (this.elements.statusText) {
            this.elements.statusText.textContent = text;
        }
    }
    
    /**
     * Atualizar estatísticas
     */
    updateStats(count, timeMs, mode) {
        if (this.elements.count) {
            this.elements.count.textContent = count.toString();
        }
        
        if (this.elements.time) {
            this.elements.time.textContent = timeMs > 0 ? `${Math.round(timeMs)}ms` : '-';
        }
        
        if (this.elements.mode) {
            const modeMap = {
                'ai': 'IA',
                'empty': 'OK',
                'error': 'Erro',
                'fallback': 'Base'
            };
            this.elements.mode.textContent = modeMap[mode] || mode;
        }
    }
    
    /**
     * Mostrar aviso de fallback
     */
    showFallbackNotice(message) {
        if (this.elements.fallbackNotice) {
            this.elements.fallbackNotice.style.display = 'flex';
            
            const contentElement = this.elements.fallbackNotice.querySelector('.ai-fallback-content p');
            if (contentElement && message) {
                contentElement.textContent = message;
            }
        }
    }
    
    /**
     * Ocultar aviso de fallback
     */
    hideFallbackNotice() {
        if (this.elements.fallbackNotice) {
            this.elements.fallbackNotice.style.display = 'none';
        }
    }
    
    /**
     * Toggle do modal expandido
     */
    toggleExpanded() {
        this.isExpanded = !this.isExpanded;
        
        if (this.elements.toggleIcon) {
            this.elements.toggleIcon.textContent = this.isExpanded ? '↙' : '↗';
        }
        
        // Here you could implement fullscreen modal logic if needed
        console.log(`📱 [AI-INTEGRATION] Toggle expandido: ${this.isExpanded ? 'expandido' : 'compacto'}`);
    }
    
    /**
     * Integração com sistema existente
     */
    integrateWithExistingSystem() {
        // Hook into displayModalResults to trigger AI processing
        const originalDisplayModalResults = window.displayModalResults;
        
        if (typeof originalDisplayModalResults === 'function') {
            window.displayModalResults = (analysis) => {
                // Call original function first
                const result = originalDisplayModalResults.call(this, analysis);
                
                // Extract suggestions and trigger AI processing
                if (analysis && analysis.suggestions) {
                    const genre = analysis.metadata?.genre || analysis.genre || window.PROD_AI_REF_GENRE;
                    const metrics = analysis.technicalData || {};
                    
                    console.log('🔗 [AI-INTEGRATION] Interceptando sugestões para processamento IA');
                    
                    // Delay slightly to ensure modal is rendered
                    setTimeout(() => {
                        this.processWithAI(analysis.suggestions, metrics, genre);
                    }, 100);
                }
                
                return result;
            };
            
            console.log('✅ [AI-INTEGRATION] Integração com displayModalResults configurada');
        } else {
            console.warn('⚠️ [AI-INTEGRATION] displayModalResults não encontrada - aguardando...');
            
            // Retry in 1 second
            setTimeout(() => {
                this.integrateWithExistingSystem();
            }, 1000);
        }
    }
}

// Initialize AI system
let aiSuggestionsSystem;

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAISuggestions);
} else {
    initializeAISuggestions();
}

function initializeAISuggestions() {
    try {
        aiSuggestionsSystem = new AISuggestionsIntegration();
        
        // Integrate with existing system
        aiSuggestionsSystem.integrateWithExistingSystem();
        
        // Expose globally for manual testing
        window.aiSuggestionsSystem = aiSuggestionsSystem;
        
        console.log('🚀 [AI-INTEGRATION] Sistema iniciado e pronto para uso');
        
    } catch (error) {
        console.error('❌ [AI-INTEGRATION] Erro na inicialização:', error);
    }
}

// Global functions for UI interactions
window.toggleAIExpanded = function() {
    if (aiSuggestionsSystem) {
        aiSuggestionsSystem.toggleExpanded();
    }
};

window.downloadAISuggestionsReport = function() {
    if (aiSuggestionsSystem && aiSuggestionsSystem.currentSuggestions.length > 0) {
        const suggestions = aiSuggestionsSystem.currentSuggestions;
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        
        const report = {
            timestamp: new Date().toISOString(),
            suggestions: suggestions,
            metadata: {
                count: suggestions.length,
                source: 'SoundyAI - Sistema de Sugestões IA',
                version: '1.0.0'
            }
        };
        
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `soundyai-suggestions-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('📄 [AI-INTEGRATION] Relatório de sugestões exportado');
    } else {
        alert('Nenhuma sugestão disponível para exportar.');
    }
};

window.sendAISuggestionsToChat = function() {
    // This would integrate with the existing chat system
    console.log('💬 [AI-INTEGRATION] Funcionalidade de chat em desenvolvimento');
    alert('Funcionalidade de discussão com IA será implementada em breve.');
};

console.log('📦 [AI-INTEGRATION] Módulo carregado - aguardando inicialização');

// Exportar classe para uso global
window.AISuggestionIntegration = AISuggestionsIntegration;
window.AISuggestionsIntegration = AISuggestionsIntegration;