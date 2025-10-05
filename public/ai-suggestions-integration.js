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
        // 🔍 AUDITORIA PASSO 1: ENTRADA DO ENHANCED ENGINE
        console.group('🔍 [AUDITORIA] ENTRADA DO ENHANCED ENGINE');
        console.log('📥 Sugestões recebidas:', {
            total: suggestions?.length || 0,
            isArray: Array.isArray(suggestions),
            type: typeof suggestions,
            sample: suggestions?.slice(0, 2) || null
        });
        
        if (suggestions && Array.isArray(suggestions)) {
            suggestions.forEach((sug, index) => {
                console.log(`📋 Sugestão ${index + 1}:`, {
                    message: sug.message || sug.issue || sug.title || 'SEM MENSAGEM',
                    action: sug.action || sug.solution || sug.description || 'SEM AÇÃO',
                    priority: sug.priority || 'SEM PRIORIDADE',
                    confidence: sug.confidence || 'SEM CONFIDENCE',
                    keys: Object.keys(sug)
                });
            });
        }
        console.groupEnd();

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
            this.showContainer();
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
        this.showContainer();
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
            
            // 🔍 AUDITORIA PASSO 2: CONSTRUÇÃO DO PAYLOAD
            console.group('� [AUDITORIA] CONSTRUÇÃO DO PAYLOAD');
            console.log('📦 Payload completo para /api/suggestions:', payload);
            console.log('📊 Estrutura do payload:', {
                genre: payload.genre,
                suggestionsCount: payload.suggestions ? payload.suggestions.length : 0,
                suggestionsArray: payload.suggestions || null,
                metricsKeys: Object.keys(payload.metrics || {}),
                metricsContent: payload.metrics
            });
            
            if (payload.suggestions) {
                payload.suggestions.forEach((sug, index) => {
                    console.log(`📋 Payload Sugestão ${index + 1}:`, {
                        message: sug.message,
                        action: sug.action,
                        priority: sug.priority,
                        confidence: sug.confidence
                    });
                });
            }
            console.groupEnd();
            
            // ✅ VALIDAÇÃO DE PAYLOAD ANTES DE ENVIAR
            if (!payload.suggestions || payload.suggestions.length === 0) {
                console.warn('⚠️ [AI-INTEGRATION] Payload sem sugestões válidas - usando fallback');
                throw new Error('PAYLOAD_INVALID: Nenhuma sugestão válida para análise');
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
            
            // 🔍 AUDITORIA PASSO 3: RESPOSTA DO BACKEND
            console.group('🔍 [AUDITORIA] RESPOSTA DO BACKEND');
            console.log('🔄 Response completa:', data);
            console.log('📊 Análise da resposta:', {
                success: data.success,
                source: data.source,
                suggestionsOriginais: validSuggestions?.length || 0,
                enhancedSuggestionsTotal: data.enhancedSuggestions?.length || 0,
                processingTime: `${processingTime}ms`
            });
            
            if (data.enhancedSuggestions) {
                data.enhancedSuggestions.forEach((sug, index) => {
                    console.log(`📋 Backend Sugestão ${index + 1}:`, {
                        hasBlocks: !!sug.blocks,
                        blocksKeys: sug.blocks ? Object.keys(sug.blocks) : null,
                        metadata: sug.metadata || null,
                        priority: sug.metadata?.priority || 'N/A'
                    });
                });
            }
            console.groupEnd();
            
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
            
            // 🎯 PASSO 4: USO EXCLUSIVO DAS SUGESTÕES ENRIQUECIDAS
            const finalSuggestions = (Array.isArray(data.enhancedSuggestions) ? data.enhancedSuggestions : [])
                .map(s => ({ ...s, ai_enhanced: true }));

            console.group('🔍 [AUDITORIA] PASSO 4: SUGESTÕES ENRIQUECIDAS (SEM MERGE)');
            console.log('✅ Usando apenas enhancedSuggestions do backend:', {
                enhancedCount: finalSuggestions.length,
                processingTime: `${processingTime}ms`
            });
            finalSuggestions.forEach((sug, index) => {
                console.log(`📋 Enhanced Sugestão ${index + 1}:`, {
                    ai_enhanced: true,
                    keys: Object.keys(sug)
                });
            });
            console.groupEnd();

            // � PASSO 5: EXIBIÇÃO NO UI (apenas enriquecidas)
            console.group('🔍 [AUDITORIA] EXIBIÇÃO NO UI');
            console.log('[AI-UI] Renderizando sugestões enriquecidas:', finalSuggestions.length);
            finalSuggestions.forEach((sug, index) => {
                console.log(`🎨 UI Sugestão ${index + 1}:`, {
                    ai_enhanced: true
                });
            });
            console.groupEnd();

            this.displaySuggestions(finalSuggestions, 'ai');
            this.updateStats(finalSuggestions.length, processingTime, 'ai');
            this.hideFallbackNotice();
            
        } catch (error) {
            console.error('❌ [AI-INTEGRATION] Erro crítico no processamento:', error);
            
            // Se for erro de payload inválido, não tentar retry - exibir erro
            if (error.message.includes('PAYLOAD_INVALID')) {
                console.log('🔄 [AI-INTEGRATION] Payload inválido - não exibir sugestões brutas');
                this.updateStatus('error', 'Payload inválido');
                this.displayEmptyState('Erro no formato dos dados. Tente analisar novamente.');
                this.showFallbackNotice('Erro interno detectado. Recarregue a página.');
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
            
            // Erro final - NÃO EXIBIR SUGESTÕES BRUTAS
            console.error('🚫 [AI-INTEGRATION] FALHA TOTAL - Backend IA não funcionou');
            this.updateStatus('error', 'Sistema de IA indisponível');
            this.displayEmptyState('Sistema de sugestões inteligentes temporariamente indisponível');
            this.showFallbackNotice('IA temporariamente indisponível. Tente novamente em alguns minutos.');
            
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
        // 🎯 FORMATO CORRETO: Montar array de sugestões detalhadas
        const formattedSuggestions = suggestions.map((suggestion, index) => {
            // Extrair dados da sugestão normalizada
            const problemText = suggestion.issue || suggestion.message || suggestion.title || 'Problema detectado';
            const actionText = suggestion.solution || suggestion.action || suggestion.description || 'Ajuste recomendado';
            
            // Determinar prioridade (1=alta, 2=média, 3=baixa)
            let priority = suggestion.priority || 2;
            if (typeof priority !== 'number') {
                if (priority === 'alta' || priority === 'high') priority = 1;
                else if (priority === 'média' || priority === 'medium') priority = 2; 
                else if (priority === 'baixa' || priority === 'low') priority = 3;
                else priority = 2;
            }
            
            // Garantir que priority está no range correto (1-3)
            priority = Math.max(1, Math.min(3, Math.floor(priority)));
            
            return {
                message: problemText,
                action: actionText, 
                priority: priority,
                confidence: suggestion.confidence || 0.8
            };
        });
        
        // Normalizar métricas para formato backend
        const normalizedMetrics = this.normalizeMetricsForBackend(metrics);
        
        const payload = {
            suggestions: formattedSuggestions,
            metrics: normalizedMetrics,
            genre: genre || window.__activeRefGenre || 'geral'
        };

        console.log('📦 [AI-INTEGRATION] Payload para backend construído:', {
            suggestionsCount: payload.suggestions.length,
            genre: payload.genre,
            hasMetrics: !!payload.metrics,
            firstSuggestion: payload.suggestions[0] || null
        });

        return payload;
    }
    
    /**
     * Normalizar métricas para formato do backend
     */
    normalizeMetricsForBackend(metrics) {
        if (!metrics) return {};
        
        const normalized = {
            lufsIntegrated: metrics.lufsIntegrated || metrics.lufs || null,
            truePeakDbtp: metrics.truePeakDbtp || metrics.truePeak || metrics.true_peak || null,
            dynamicRange: metrics.dynamicRange || metrics.dr || null,
            lra: metrics.lra || null,
            stereoCorrelation: metrics.stereoCorrelation || metrics.stereo || null
        };
        
        // Adicionar bandas se disponíveis
        if (metrics.bandEnergies) {
            const bandEnergies = metrics.bandEnergies;
            const referenceTargets = window.__activeRefData?.bands || {};
            
            normalized.bands = {
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
        
        return normalized;
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
    mergeAISuggestionsWithOriginals(originalSuggestions, aiEnhancedSuggestions) {
        console.log('[AI-MERGE] Iniciando merge de sugestões:', {
            originais: originalSuggestions?.length || 0,
            enriquecidas: aiEnhancedSuggestions?.length || 0
        });

        // Se não há sugestões originais, retorna array vazio
        if (!originalSuggestions || !Array.isArray(originalSuggestions)) {
            console.warn('[AI-MERGE] ⚠️ Sugestões originais inválidas');
            return [];
        }

        // Se não há sugestões enriquecidas da IA, retorna as originais
        if (!aiEnhancedSuggestions || !Array.isArray(aiEnhancedSuggestions)) {
            console.log('[AI-MERGE] 📋 Sem sugestões IA, retornando originais:', originalSuggestions.length);
            return originalSuggestions.map(s => ({...s, ai_enhanced: false}));
        }

        console.log('[AI-MERGE] 🤖 Processando enriquecimento com IA:', aiEnhancedSuggestions.length);

        // Mesclar sugestões enriquecidas com as originais
        const mergedSuggestions = [];

        for (let i = 0; i < Math.max(originalSuggestions.length, aiEnhancedSuggestions.length); i++) {
            const originalSuggestion = originalSuggestions[i];
            const aiSuggestion = aiEnhancedSuggestions[i];

            if (originalSuggestion && aiSuggestion) {
                // Caso 1: Temos ambas - mesclar
                const merged = {
                    ...originalSuggestion,
                    ai_enhanced: true,
                    ai_blocks: aiSuggestion.blocks || {},
                    ai_category: aiSuggestion.metadata?.processing_type || 'geral',
                    ai_priority: this.mapPriorityFromBackend(aiSuggestion.metadata?.priority),
                    ai_technical_details: {
                        difficulty: aiSuggestion.metadata?.difficulty || 'intermediário',
                        frequency_range: aiSuggestion.metadata?.frequency_range || '',
                        tools_suggested: this.extractToolsFromBlocks(aiSuggestion.blocks)
                    },
                    // Atualizar título e descrição com versões enriquecidas se disponível
                    title: aiSuggestion.blocks?.problem || originalSuggestion.title || originalSuggestion.message,
                    description: aiSuggestion.blocks?.solution || originalSuggestion.description || originalSuggestion.action
                };
                
                mergedSuggestions.push(merged);
                console.log(`[AI-MERGE] ✅ Sugestão ${i + 1} enriquecida com IA`);
                
            } else if (originalSuggestion) {
                // Caso 2: Só temos a original - manter sem enriquecimento
                mergedSuggestions.push({
                    ...originalSuggestion,
                    ai_enhanced: false
                });
                console.log(`[AI-MERGE] 📋 Sugestão ${i + 1} mantida original`);
                
            } else if (aiSuggestion) {
                // Caso 3: Só temos a da IA - criar nova sugestão
                const newSuggestion = {
                    ai_enhanced: true,
                    ai_blocks: aiSuggestion.blocks || {},
                    ai_category: aiSuggestion.metadata?.processing_type || 'geral',
                    ai_priority: this.mapPriorityFromBackend(aiSuggestion.metadata?.priority),
                    ai_technical_details: {
                        difficulty: aiSuggestion.metadata?.difficulty || 'intermediário',
                        frequency_range: aiSuggestion.metadata?.frequency_range || '',
                        tools_suggested: this.extractToolsFromBlocks(aiSuggestion.blocks)
                    },
                    title: aiSuggestion.blocks?.problem || 'Sugestão da IA',
                    description: aiSuggestion.blocks?.solution || 'Melhoria recomendada'
                };
                
                mergedSuggestions.push(newSuggestion);
                console.log(`[AI-MERGE] ✨ Nova sugestão ${i + 1} criada pela IA`);
            }
        }

        console.log('[AI-MERGE] 📈 Merge concluído:', {
            total: mergedSuggestions.length,
            enriquecidas: mergedSuggestions.filter(s => s.ai_enhanced).length,
            originais: mergedSuggestions.filter(s => !s.ai_enhanced).length
        });

        return mergedSuggestions;
    }
    
    /**
     * Mapear prioridade do backend para número
     */
    mapPriorityFromBackend(priority) {
        if (!priority) return 5;
        if (priority === 'alta' || priority === 'high') return 8;
        if (priority === 'média' || priority === 'medium') return 5;
        if (priority === 'baixa' || priority === 'low') return 2;
        return 5;
    }
    
    /**
     * Extrair ferramentas dos blocos da IA
     */
    extractToolsFromBlocks(blocks) {
        if (!blocks) return ['EQ/Compressor'];
        
        const tools = [];
        if (blocks.plugin) tools.push(blocks.plugin);
        if (blocks.tip && blocks.tip.includes('EQ')) tools.push('EQ');
        if (blocks.tip && blocks.tip.includes('compressor')) tools.push('Compressor');
        if (blocks.solution && blocks.solution.includes('limiter')) tools.push('Limiter');
        
        return tools.length > 0 ? tools : ['EQ/Compressor'];
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
            <div class="ai-info-text" style="margin-top: 18px; padding: 12px 16px; text-align: center; font-size: 0.9rem; color: #ccc; line-height: 1.4; font-style: italic; border-top: 1px solid rgba(255, 255, 255, 0.1); opacity: 0.85;">
                <p style="margin: 0;">
                    As métricas e sugestões são baseadas em ciência de áudio e referências reais do gênero.<br>
                    Porém, música é arte: cada produtor pode querer características diferentes.<br>
                    Use estas dicas como um guia de referência, não como uma regra absoluta.
                </p>
            </div>
        `;

        this.elements.grid.style.display = 'block';
        console.log('📋 [AI-INTEGRATION] Estado vazio exibido:', message);
    }
    
    /**
     * Exibir sugestões no grid
     */
    displaySuggestions(suggestions, source = 'ai') {
        // 🔍 AUDITORIA PASSO 6: RENDERIZAÇÃO FINAL
        console.group('🔍 [AUDITORIA] RENDERIZAÇÃO FINAL');
        console.log('[AI-UI] Renderizando sugestões enriquecidas:', suggestions?.length || 0);
        console.log('🖥️ displaySuggestions chamado com:', {
            totalSuggestions: suggestions?.length || 0,
            source: source,
            isArray: Array.isArray(suggestions),
            hasGridElement: !!this.elements.grid
        });
        
        if (suggestions && Array.isArray(suggestions)) {
            suggestions.forEach((sug, index) => {
                console.log(`🖥️ Renderizando Sugestão ${index + 1}:`, {
                    ai_enhanced: true,
                    title: sug.title || sug.message || 'N/A',
                    hasAiBlocks: !!sug.ai_blocks,
                    willRenderAsCard: true
                });
            });
        }
        console.groupEnd();
        
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
                <div class="ai-info-text" style="margin-top: 18px; padding: 12px 16px; text-align: center; font-size: 0.9rem; color: #ccc; line-height: 1.4; font-style: italic; border-top: 1px solid rgba(255, 255, 255, 0.1); opacity: 0.85;">
                    <p style="margin: 0;">
                        As métricas e sugestões são baseadas em ciência de áudio e referências reais do gênero.<br>
                        Porém, música é arte: cada produtor pode querer características diferentes.<br>
                        Use estas dicas como um guia de referência, não como uma regra absoluta.
                    </p>
                </div>
            `;
            return;
        }
        
        // Generate cards
        // 🔍 AUDITORIA: Contando cards criados
        let cardsCreated = 0;
        suggestions.forEach((suggestion, index) => {
            const card = this.createSuggestionCard(suggestion, index, source);
            this.elements.grid.appendChild(card);
            cardsCreated++;
            
            console.log(`🖥️ Card ${cardsCreated} criado para:`, {
                index: index,
                ai_enhanced: suggestion.ai_enhanced,
                cardElement: !!card,
                appendedToGrid: true
            });
        });
        
        console.log('🔍 [AUDITORIA] CARDS FINAIS CRIADOS:', {
            totalCards: cardsCreated,
            gridChildren: this.elements.grid.children.length,
            suggestionsReceived: suggestions.length
        });
        
        // Show grid
        this.elements.grid.style.display = 'grid';
        
        // Adicionar texto informativo após as sugestões
        const infoText = document.createElement('div');
        infoText.className = 'ai-info-text';
        infoText.style.cssText = `
            margin-top: 18px;
            padding: 12px 16px;
            text-align: center;
            font-size: 0.9rem;
            color: #ccc;
            line-height: 1.4;
            font-style: italic;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            opacity: 0.85;
            animation: fadeInInfo 0.6s ease forwards;
            grid-column: 1 / -1;
        `;
        infoText.innerHTML = `
            <p style="margin: 0;">
                As métricas e sugestões são baseadas em ciência de áudio e referências reais do gênero.<br>
                Porém, música é arte: cada produtor pode querer características diferentes.<br>
                Use estas dicas como um guia de referência, não como uma regra absoluta.
            </p>
        `;
        this.elements.grid.appendChild(infoText);
        
        // Animate cards
        this.animateCards();
        
        console.log(`✅ [AI-INTEGRATION] ${suggestions.length} sugestões exibidas (fonte: ${source})`);
        
        // 🔍 AUDITORIA: RELATÓRIO FINAL COMPLETO
        console.group('🔍 [AUDITORIA] RELATÓRIO FINAL COMPLETO');
        console.log('📊 RESUMO DO FLUXO DE SUGESTÕES:');
        console.log('═══════════════════════════════════════');
        console.log('🔗 PASSO 0: INTERCEPTAÇÃO INICIAL - Verifique logs acima');
        console.log('🚀 PASSO ULTRA: ULTRA ENHANCER - Verifique logs acima');  
        console.log('📥 PASSO 1: ENTRADA ENHANCED ENGINE - Verifique logs acima');
        console.log('📦 PASSO 2: CONSTRUÇÃO PAYLOAD - Verifique logs acima');
        console.log('🔄 PASSO 3: RESPOSTA BACKEND - Verifique logs acima');
        console.log('🔀 PASSO 4: MERGE SUGESTÕES - Verifique logs acima');
        console.log('🎨 PASSO 5: EXIBIÇÃO UI - Verifique logs acima');
        console.log('🖥️ PASSO 6: RENDERIZAÇÃO FINAL - Verifique logs acima');
        console.log('═══════════════════════════════════════');
        console.log('🎯 PONTOS CRÍTICOS A VERIFICAR:');
        console.log('   1. Se PASSO 0 mostra 12 sugestões interceptadas');
        console.log('   2. Se PASSO 1 recebe 12 sugestões válidas');
        console.log('   3. Se PASSO 2 envia payload com 12 sugestões');
        console.log('   4. Se PASSO 3 recebe resposta com sugestões do backend');
        console.log('   5. Se PASSO 4 merge mantém todas as sugestões');
        console.log('   6. Se PASSO 6 renderiza todas as sugestões recebidas');
        console.log('═══════════════════════════════════════');
        console.log('⚠️ SE ENCONTRAR REDUÇÃO DE 12→3:');
        console.log('   • Verifique qual PASSO mostra a redução');
        console.log('   • A redução pode ocorrer em qualquer passo');
        console.log('   • Logs mostram entrada/saída de cada função');
        console.groupEnd();
    }
    
    /**
     * Criar card de sugestão
     */
    createSuggestionCard(suggestion, index, source) {
        const card = document.createElement('div');
        card.className = `ai-suggestion-card ${source === 'fallback' ? 'ai-base-suggestion' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;
        
        // Extract data (campos enriquecidos diretos)
        const blocks = {
            problem: suggestion.problema || suggestion.blocks?.problem,
            cause: suggestion.causa || suggestion.blocks?.cause,
            solution: suggestion.solucao || suggestion.blocks?.solution,
            tip: suggestion.dica_extra || suggestion.blocks?.tip,
            plugin: suggestion.plugin || suggestion.blocks?.plugin,
            result: suggestion.resultado || suggestion.blocks?.result
        };
        const metadata = suggestion.metadata || { priority: 'média', difficulty: 'intermediário' };
        const isAIEnhanced = true;
        
        card.innerHTML = `
            <div class="ai-suggestion-blocks">
                ${blocks.problem ? this.createBlock('problema', blocks.problem) : ''}
                ${blocks.cause ? this.createBlock('causa', blocks.cause) : ''}
                ${blocks.solution ? this.createBlock('solucao', blocks.solution) : ''}
                ${blocks.tip ? this.createBlock('dica', blocks.tip) : ''}
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
                // 🔍 AUDITORIA PASSO 0: INTERCEPTAÇÃO INICIAL
                console.group('🔍 [AUDITORIA] INTERCEPTAÇÃO INICIAL');
                console.log('🔗 [AI-INTEGRATION] displayModalResults interceptado:', {
                    hasAnalysis: !!analysis,
                    hasSuggestions: !!(analysis && analysis.suggestions),
                    suggestionsCount: analysis?.suggestions?.length || 0,
                    analysisKeys: analysis ? Object.keys(analysis) : null
                });
                
                if (analysis && analysis.suggestions) {
                    analysis.suggestions.forEach((sug, index) => {
                        console.log(`🔗 Intercepted Sugestão ${index + 1}:`, {
                            message: sug.message || sug.issue || sug.title || 'N/A',
                            action: sug.action || sug.solution || sug.description || 'N/A',
                            keys: Object.keys(sug)
                        });
                    });
                }
                console.groupEnd();
                
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