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
            
            // 🔍 AUDITORIA PRÉ-MERGE: Ver exatamente o que veio da API
            console.log('[AUDIT-PRE-MERGE] data.enhancedSuggestions da API:', JSON.stringify(data.enhancedSuggestions, null, 2));
            console.log('[AUDIT-PRE-MERGE] validSuggestions para merge:', JSON.stringify(validSuggestions, null, 2));
            
            // 🎯 PASSO 4: MERGE AVANÇADO COM BUSCA EM METADATA
            const merged = data.enhancedSuggestions.map((s, i) => {
                const original = validSuggestions[i] || {};
                const meta = s.metadata || {};
                const content = meta.content || {};
                const inner = meta.inner || {};
                const originalData = meta.originalData || {};
                const data = meta.data || {};
                const enriched = meta.enriched || {};

                // Busca recursiva ampla - PRIORIDADE CORRETA
                const resolvedMessage =
                    s.message ||                           // 🎯 PRIORIDADE 1: Resposta direta da IA
                    original.message ||                    // 📋 PRIORIDADE 2: Sugestão original  
                    meta.message ||                        // 🔍 metadata.message
                    (meta.original && meta.original.message) || // ⚡ metadata.original.message
                    (meta.enriched && meta.enriched.message) || // ✨ metadata.enriched.message
                    data.message ||                        // 📊 metadata.data.message
                    originalData.message ||                // 🗂️ metadata.originalData.message
                    (content.original && content.original.message) || // 🏗️ metadata.content.original.message
                    (content.enriched && content.enriched.message) || // 🎨 metadata.content.enriched.message
                    (inner.original && inner.original.message) ||     // 🏠 metadata.inner.original.message
                    (inner.enriched && inner.enriched.message) ||     // 💎 metadata.inner.enriched.message
                    (original.original && typeof original.original === "string" ? original.original : null);

                const resolvedAction =
                    s.action ||                           // 🎯 PRIORIDADE 1: Action direta da IA
                    original.action ||                    // 📋 PRIORIDADE 2: Action original
                    meta.action ||                        // 🔍 metadata.action
                    (meta.original && meta.original.action) || // ⚡ metadata.original.action
                    (meta.enriched && meta.enriched.action) || // ✨ metadata.enriched.action
                    data.action ||                        // 📊 metadata.data.action
                    originalData.action ||                // 🗂️ metadata.originalData.action
                    (content.original && content.original.action) || // 🏗️ metadata.content.original.action
                    (content.enriched && content.enriched.action) || // 🎨 metadata.content.enriched.action
                    (inner.original && inner.original.action) ||     // 🏠 metadata.inner.original.action
                    (inner.enriched && inner.enriched.action) ||     // 💎 metadata.inner.enriched.action
                    (original.originalAction && typeof original.originalAction === "string" ? original.originalAction : null);

                return {
                    ai_enhanced: true,
                    ...original,
                    ...s,
                    hasOriginalMessage: !!resolvedMessage,
                    messageSource: resolvedMessage ? "restored" : "fallback",
                    message: resolvedMessage || "⚠️ Mensagem perdida na integração.",
                    title: resolvedMessage || "⚠️ Mensagem perdida na integração.",
                    action: resolvedAction,
                    priority: s.priority || original.priority || 1,
                    confidence: s.confidence || original.confidence || 0.9,
                };
            });
            
            // 🎯 ORDENAÇÃO: True Peak sempre no topo
            const finalSuggestions = merged.sort((a, b) => {
                if (a.message?.includes("True Peak") && !b.message?.includes("True Peak")) return -1;
                if (!a.message?.includes("True Peak") && b.message?.includes("True Peak")) return 1;
                return (a.priority || 1) - (b.priority || 1);
            });

            console.group('🔍 [AUDITORIA] PASSO 4: MERGE ROBUSTO COM PRIORIDADE CORRETA');
            console.log('✅ Merge realizado com PRIORIDADE CORRETA (s.message primeiro):', {
                enhancedCount: finalSuggestions.length,
                originalCount: validSuggestions.length,
                processingTime: `${processingTime}ms`,
                searchPriority: [
                    '🎯 s.message (IA direta)', 
                    '📋 original.message (sugestão base)', 
                    '🔍 meta.message', 
                    '⚡ meta.original.message', 
                    '✨ meta.enriched.message',
                    '📊 data.message',
                    '🗂️ originalData.message',
                    '🏗️ content.original.message', 
                    '🎨 content.enriched.message',
                    '🏠 inner.original.message',
                    '💎 inner.enriched.message',
                    '🔄 original.original'
                ]
            });
            finalSuggestions.forEach((sug, index) => {
                const isTruePeak = sug.message?.includes("True Peak");
                console.log(`📋 Merged Sugestão ${index + 1}${isTruePeak ? ' ⚡ TRUE PEAK' : ''}:`, {
                    ai_enhanced: sug.ai_enhanced,
                    hasOriginalMessage: sug.hasOriginalMessage,
                    messageSource: sug.messageSource,
                    messagePreview: sug.message?.substring(0, 60) + '...',
                    actionPreview: sug.action?.substring(0, 40) + '...' || 'N/A',
                    priority: sug.priority,
                    isTruePeak: isTruePeak,
                    hasTitle: !!sug.title,
                    titleMatchesMessage: sug.title === sug.message
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
        console.log('[AUDIT-PRE] validateAndNormalizeSuggestions - ENTRADA:', JSON.stringify(suggestions, null, 2));
        
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
            // 🔧 PRESERVAR TODOS OS CAMPOS ORIGINAIS + Normalizar estrutura para backend
            return {
                // 🎯 CAMPOS ORIGINAIS PRESERVADOS (CRÍTICO!)
                ...suggestion,
                
                // 📋 CAMPOS NORMALIZADOS PARA BACKEND (sem sobrescrever originais)
                metric: suggestion.metric || suggestion.type || 'geral',
                issue: suggestion.issue || suggestion.message || suggestion.title || 'Problema detectado',
                solution: suggestion.solution || suggestion.action || suggestion.description || 'Ajuste recomendado',
                priority: suggestion.priority || 5,
                confidence: suggestion.confidence || 0.7,
                
                // 🛡️ GARANTIR QUE CAMPOS CRÍTICOS NUNCA SEJAM UNDEFINED
                message: suggestion.message || suggestion.issue || suggestion.title,
                action: suggestion.action || suggestion.solution || suggestion.description,
                title: suggestion.title || suggestion.message || suggestion.issue
            };
        });

        console.log('[AUDIT-POST] validateAndNormalizeSuggestions - SAÍDA:', JSON.stringify(validSuggestions, null, 2));
        console.log('✅ [AI-INTEGRATION] Sugestões validadas E PRESERVADAS:', {
            original: suggestions.length,
            valid: validSuggestions.length,
            filtered: suggestions.length - validSuggestions.length,
            preservedFields: validSuggestions.map(s => ({ 
                hasMessage: !!s.message, 
                hasAction: !!s.action,
                hasTitle: !!s.title,
                messagePreview: s.message?.substring(0, 50) + '...' 
            }))
        });

        return validSuggestions;
    }

    /**
     * Construir payload válido para o backend - FOCADO EM PROBLEMAS DETECTADOS
     */
    buildValidPayload(suggestions, metrics, genre) {
        console.log('[AUDIT-PRE] buildValidPayload - ENTRADA:', JSON.stringify(suggestions, null, 2));
        
        // 🎯 FORMATO CORRETO: Montar array de sugestões detalhadas
        const formattedSuggestions = suggestions.map((suggestion, index) => {
            // Extrair dados da sugestão normalizada (PRESERVANDO CAMPOS ORIGINAIS)
            const problemText = suggestion.message || suggestion.issue || suggestion.title || 'Problema detectado';
            const actionText = suggestion.action || suggestion.solution || suggestion.description || 'Ajuste recomendado';
            
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
                // 🔧 USAR CAMPOS ORIGINAIS COMO PRIORIDADE
                message: problemText,
                action: actionText, 
                priority: priority,
                confidence: suggestion.confidence || 0.8,
                
                // 🛡️ PRESERVAR CAMPOS ORIGINAIS PARA RETORNO
                originalMessage: suggestion.message,
                originalAction: suggestion.action,
                originalTitle: suggestion.title
            };
        });
        
        // Normalizar métricas para formato backend
        const normalizedMetrics = this.normalizeMetricsForBackend(metrics);
        
        const payload = {
            suggestions: formattedSuggestions,
            metrics: normalizedMetrics,
            genre: genre || window.__activeRefGenre || 'geral'
        };

        console.log('[AUDIT-POST] buildValidPayload - SAÍDA:', JSON.stringify(payload, null, 2));
        console.log('📦 [AI-INTEGRATION] Payload para backend construído COM PRESERVAÇÃO:', {
            suggestionsCount: payload.suggestions.length,
            genre: payload.genre,
            hasMetrics: !!payload.metrics,
            firstSuggestion: payload.suggestions[0] || null,
            preservedMessages: payload.suggestions.map(s => ({ 
                message: s.message, 
                originalMessage: s.originalMessage,
                hasOriginal: !!s.originalMessage 
            }))
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
        
        // 🎯 CORRIGIDO: Priorizar centralizedBands > bands > bandEnergies
        // PRIORIDADE 1: metrics.centralizedBands (estrutura unificada)
        // PRIORIDADE 2: metrics.bands (estrutura direta)
        // PRIORIDADE 3: metrics.bandEnergies (estrutura legada)
        
        const centralizedBands = metrics.centralizedBands;
        const directBands = metrics.bands;
        const bandEnergies = metrics.bandEnergies;
        
        console.log('🔍 [NORMALIZE-METRICS] Fontes de bandas disponíveis:', {
            hasCentralizedBands: !!centralizedBands,
            hasDirectBands: !!directBands,
            hasBandEnergies: !!bandEnergies
        });
        
        if (centralizedBands || directBands || bandEnergies) {
            const referenceTargets = window.__activeRefData?.bands || {};
            let sourceData = null;
            let sourceName = '';
            
            // 🎯 PRIORIDADE 1: centralizedBands
            if (centralizedBands && typeof centralizedBands === 'object') {
                sourceData = centralizedBands;
                sourceName = 'centralizedBands';
                console.log('✅ [NORMALIZE-METRICS] Usando centralizedBands como fonte principal');
            }
            // PRIORIDADE 2: bands
            else if (directBands && typeof directBands === 'object') {
                sourceData = directBands;
                sourceName = 'bands';
                console.log('✅ [NORMALIZE-METRICS] Usando bands como fonte');
            }
            // PRIORIDADE 3: bandEnergies
            else if (bandEnergies && typeof bandEnergies === 'object') {
                sourceData = bandEnergies;
                sourceName = 'bandEnergies';
                console.log('✅ [NORMALIZE-METRICS] Usando bandEnergies como fonte (legado)');
            }
            
            if (sourceData) {
                console.log(`🔍 [NORMALIZE-METRICS] Dados de ${sourceName}:`, {
                    keys: Object.keys(sourceData),
                    sample: Object.keys(sourceData).slice(0, 3).reduce((acc, k) => {
                        acc[k] = sourceData[k];
                        return acc;
                    }, {})
                });
                
                // Helper universal para extrair valor real de banda
                const getBandValue = (bandData, bandKey) => {
                    if (!bandData) return null;
                    
                    // Estrutura objeto { rms_db: valor } ou { value: valor }
                    if (typeof bandData === 'object') {
                        const value = bandData.rms_db || bandData.value || bandData.energy_db;
                        return Number.isFinite(value) ? value : null;
                    }
                    
                    // Valor direto (número)
                    if (Number.isFinite(bandData)) {
                        return bandData;
                    }
                    
                    return null;
                };
                
                // Montar objeto bands apenas com valores reais
                const bands = {};
                
                // Mapeamento expandido para cobrir todas as variações
                const bandMapping = [
                    { key: 'sub', sources: ['sub', 'subBass', 'sub_bass'], ideal: -16.0 },
                    { key: 'bass', sources: ['bass', 'low_bass', 'lowBass'], ideal: -17.8 },
                    { key: 'lowMid', sources: ['lowMid', 'low_mid', 'upper_bass', 'upperBass'], ideal: -18.2 },
                    { key: 'mid', sources: ['mid', 'mids', 'middle'], ideal: -17.1 },
                    { key: 'highMid', sources: ['highMid', 'high_mid', 'highmid'], ideal: -20.8 },
                    { key: 'presence', sources: ['presence', 'presenca'], ideal: -34.6 },
                    { key: 'air', sources: ['air', 'brilho', 'brilliance', 'treble', 'high'], ideal: -25.5 }
                ];
                
                bandMapping.forEach(({ key, sources, ideal }) => {
                    let value = null;
                    let foundSource = null;
                    
                    // Tentar todas as variações de nome
                    for (const source of sources) {
                        const bandData = sourceData[source];
                        if (bandData !== undefined) {
                            value = getBandValue(bandData, source);
                            if (value !== null) {
                                foundSource = source;
                                break;
                            }
                        }
                    }
                    
                    if (value !== null) {
                        bands[key] = {
                            value: value,
                            ideal: referenceTargets[key]?.target || ideal
                        };
                        console.log(`✅ [NORMALIZE-METRICS] Banda ${key} (source: ${foundSource}) adicionada: ${value} dB (ideal: ${bands[key].ideal})`);
                    } else {
                        console.warn(`⚠️ [NORMALIZE-METRICS] Banda ${key} (tentou: ${sources.join(', ')}) não possui valor real - IGNORADA`);
                    }
                });
                
                // Só adicionar bands se pelo menos uma banda tiver valor
                if (Object.keys(bands).length > 0) {
                    normalized.bands = bands;
                    console.log(`✅ [NORMALIZE-METRICS] ${Object.keys(bands).length}/7 bandas com valores reais incluídas no payload`);
                } else {
                    console.warn('⚠️ [NORMALIZE-METRICS] Nenhuma banda com valor real detectada - bands não incluído no payload');
                }
            }
        } else {
            console.warn('⚠️ [NORMALIZE-METRICS] Nenhuma fonte de bandas disponível (centralizedBands, bands ou bandEnergies)');
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
        `;

        this.elements.grid.style.display = 'block';
        console.log('📋 [AI-INTEGRATION] Estado vazio exibido:', message);
    }
    
    /**
     * Exibir sugestões no grid
     */
    displaySuggestions(suggestions, source = 'ai') {
        // � CORREÇÃO: Garantir que title seja igual a message se não existir
        if (suggestions && Array.isArray(suggestions)) {
            suggestions.forEach((s) => {
                if (!s.title && s.message) {
                    s.title = s.message;
                }
            });
        }
        
        // �🔍 AUDITORIA PASSO 6: RENDERIZAÇÃO FINAL
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
                const isTruePeak = sug.message?.includes("True Peak");
                console.log(`🖥️ Renderizando Sugestão ${index + 1}${isTruePeak ? ' ⚡ TRUE PEAK' : ''}:`, {
                    ai_enhanced: sug.ai_enhanced,
                    hasOriginalMessage: sug.hasOriginalMessage,
                    messageSource: sug.messageSource,
                    title: sug.title || 'N/A',
                    message: sug.message || 'N/A',
                    action: sug.action || 'N/A',
                    titleEqualsMessage: sug.title === sug.message,
                    willUseMessageAsFallback: !sug.problema && !sug.blocks?.problem && !!sug.message,
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
        
        // 🚨 DEBUG: Verificar se priority-banners foram renderizados
        setTimeout(() => {
            console.log('[DEBUG] Banners renderizados:', document.querySelectorAll('.priority-banner').length);
            const banners = document.querySelectorAll('.priority-banner');
            banners.forEach((banner, idx) => {
                console.log(`[DEBUG] Banner ${idx + 1}:`, banner.textContent);
            });
        }, 1500);
        
        // 🧠 PATCH: Exibir banner de correção prioritária no card do True Peak
        setTimeout(() => {
            const cards = document.querySelectorAll('.ai-suggestion-card');
            let count = 0;

            cards.forEach(card => {
                const cardText = card.innerText.toLowerCase();
                const hasTruePeak =
                    cardText.includes('true peak') ||
                    cardText.includes('true-peak') ||
                    cardText.includes('truepeak') ||
                    cardText.includes('correção prioritária');

                if (hasTruePeak && !card.querySelector('.priority-banner')) {
                    const banner = document.createElement('div');
                    banner.className = 'priority-banner';
                    banner.innerHTML = `
                        <div class="priority-icon">⚡</div>
                        <div class="priority-text">
                            Correção Prioritária: reduza o True Peak antes de outros ajustes
                        </div>
                    `;
                    card.prepend(banner);
                    count++;
                }
            });

            console.log(`✅ [PATCH_UI] Banners de correção prioritária aplicados: ${count}`);
        }, 700);
    }
    
    /**
     * Criar card de sugestão
     */
    createSuggestionCard(suggestion, index, source) {
        const card = document.createElement('div');
        card.className = `ai-suggestion-card ${source === 'fallback' ? 'ai-base-suggestion' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;
        
        // � PRIORITY BANNER: Renderização dinâmica para priorityWarning
        if (suggestion.priorityWarning) {
            console.log('[UI] priorityWarning detectado:', suggestion.priorityWarning);
            
            const priorityBanner = document.createElement('div');
            priorityBanner.className = 'priority-banner';
            priorityBanner.innerHTML = `
                <div class="priority-icon">⚡</div>
                <div class="priority-text">${suggestion.priorityWarning}</div>
            `;
            
            // Insere no topo do card antes dos outros blocos
            card.appendChild(priorityBanner);
        }
        
        // �🔹 BLOCO INTELIGENTE DA IA: Exibir campos diretos da IA antes dos blocos tradicionais
        let aiSummaryHTML = '';
        if (suggestion.message && !suggestion.problema) {
            const summaryParts = [];
            
            // Título principal (message ou title)
            if (suggestion.title || suggestion.message) {
                summaryParts.push(`<h4>${suggestion.title || suggestion.message}</h4>`);
            }
            
            // Contexto e explicação
            if (suggestion.why) {
                summaryParts.push(`<p class="why"><strong>Por quê:</strong> ${suggestion.why}</p>`);
            }
            
            if (suggestion.context) {
                summaryParts.push(`<p class="context"><strong>Contexto:</strong> ${suggestion.context}</p>`);
            }
            
            // Aviso prioritário
            if (suggestion.priorityWarning) {
                summaryParts.push(`<p class="priority"><strong>⚠️ Aviso:</strong> ${suggestion.priorityWarning}</p>`);
            }
            
            // Ação sugerida
            if (suggestion.action) {
                summaryParts.push(`<p class="action"><strong>🎯 Ação:</strong> ${suggestion.action}</p>`);
            }
            
            // Plugin recomendado
            if (suggestion.plugin && !suggestion.blocks?.plugin) {
                summaryParts.push(`<p class="plugin"><strong>🧩 Plugin:</strong> ${suggestion.plugin}</p>`);
            }
            
            if (summaryParts.length > 0) {
                aiSummaryHTML = `
                    <div class="ai-summary-block">
                        ${summaryParts.join('')}
                    </div>
                `;
            }
        }
        
        // Extract data (campos enriquecidos diretos + fallback para suggestion.message)
        const blocks = {
            problem: suggestion.problema || suggestion.blocks?.problem || (suggestion.message && suggestion.message.includes("True Peak") ? suggestion.message : null),
            cause: suggestion.causa || suggestion.blocks?.cause,
            solution: suggestion.solucao || suggestion.blocks?.solution || suggestion.action,
            tip: suggestion.dica_extra || suggestion.blocks?.tip,
            plugin: suggestion.plugin || suggestion.blocks?.plugin,
            result: suggestion.resultado || suggestion.blocks?.result
        };
        
        // 🔧 FALLBACK CRÍTICO: Se não há blocos específicos, usar message/title como problema principal
        if (!blocks.problem && !blocks.solution && !blocks.cause) {
            blocks.problem = suggestion.message || suggestion.title || "⚠️ Conteúdo não disponível";
            if (suggestion.action) {
                blocks.solution = suggestion.action;
            }
        }
        
        const metadata = suggestion.metadata || { priority: 'média', difficulty: 'intermediário' };
        const isAIEnhanced = true;
        
        card.innerHTML = `
            ${aiSummaryHTML}
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
        const safeAttachDisplayModal = () => {
            if (typeof window.displayModalResults !== "function") {
                console.warn("[SAFE_INTERCEPT_WAIT] Aguardando função displayModalResults...");
                setTimeout(safeAttachDisplayModal, 300);
                return;
            }

            const original = window.displayModalResults;
            window.displayModalResults = (data) => {
                console.log("[SAFE_INTERCEPT] displayModalResults interceptado (ai-suggestions)", data);

                // 🔒 NÃO sobrescreve userAnalysis nem referenceAnalysis
                if (data?.mode === "reference" && data.userAnalysis && data.referenceAnalysis) {
                    console.log("[SAFE_INTERCEPT] Preservando estrutura A/B");
                    const result = original.call(this, data);
                    
                    // Processar sugestões mesmo em modo reference
                    if (data && data.suggestions) {
                        const genre = data.metadata?.genre || data.genre || window.PROD_AI_REF_GENRE;
                        const metrics = data.technicalData || {};
                        
                        console.log('🔗 [AI-INTEGRATION] Processando sugestões (modo reference)');
                        setTimeout(() => {
                            this.processWithAI(data.suggestions, metrics, genre);
                        }, 100);
                    }
                    
                    return result;
                }

                const merged = {
                    ...data,
                    userAnalysis: data.userAnalysis || window.__soundyState?.previousAnalysis,
                    referenceAnalysis: data.referenceAnalysis || data.analysis,
                };
                
                // 🔍 AUDITORIA PASSO 0: INTERCEPTAÇÃO INICIAL
                console.group('🔍 [AUDITORIA] INTERCEPTAÇÃO INICIAL');
                console.log('🔗 [AI-INTEGRATION] displayModalResults interceptado:', {
                    hasAnalysis: !!merged,
                    hasSuggestions: !!(merged && merged.suggestions),
                    suggestionsCount: merged?.suggestions?.length || 0,
                    analysisKeys: merged ? Object.keys(merged) : null
                });
                
                if (merged && merged.suggestions) {
                    merged.suggestions.forEach((sug, index) => {
                        console.log(`🔗 Intercepted Sugestão ${index + 1}:`, {
                            message: sug.message || sug.issue || sug.title || 'N/A',
                            action: sug.action || sug.solution || sug.description || 'N/A',
                            keys: Object.keys(sug)
                        });
                    });
                }
                console.groupEnd();
                
                // Call original function first
                const result = original.call(this, merged);
                
                // Extract suggestions and trigger AI processing
                if (merged && merged.suggestions) {
                    const genre = merged.metadata?.genre || merged.genre || window.PROD_AI_REF_GENRE;
                    const metrics = merged.technicalData || {};
                    
                    console.log('🔗 [AI-INTEGRATION] Interceptando sugestões para processamento IA');
                    
                    // Delay slightly to ensure modal is rendered
                    setTimeout(() => {
                        this.processWithAI(merged.suggestions, metrics, genre);
                    }, 100);
                }
                
                return result;
            };
            
            console.log('✅ [AI-INTEGRATION] Integração com displayModalResults configurada');
        };
        
        safeAttachDisplayModal();
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