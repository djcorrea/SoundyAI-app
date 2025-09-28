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
        
        // 🎯 SISTEMA DE AUDITORIA: Detectar conflitos de renderização
        this.setupAuditSystem();
        
        // 🎯 SISTEMA DE GARANTIA: Função global para forçar ordem correta
        this.setupOrderGuarantee();
        
        return true;
    }
    
    setupAuditSystem() {
        // Observar mudanças no grid para detectar renderizações externas
        if (this.elements.grid && window.MutationObserver) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        const aiIntegrationActive = Array.from(mutation.addedNodes).some(node => 
                            node.nodeType === 1 && node.classList && node.classList.contains('ai-suggestion-card')
                        );
                        
                        if (!aiIntegrationActive && mutation.addedNodes.length > 0) {
                            console.warn('⚠️ [AUDITORIA] Renderização externa detectada no grid!', {
                                addedNodes: mutation.addedNodes.length,
                                source: 'unknown-system',
                                grid: this.elements.grid.id
                            });
                        }
                    }
                });
            });
            
            observer.observe(this.elements.grid, { childList: true, subtree: true });
            console.log('🔍 [AUDITORIA] Sistema de monitoramento de renderização ativo');
        }
    }

    verificarECorrigirOrdemVisual(suggestions) {
        console.log('🚨 [EMERGÊNCIA] Verificando ordem visual no DOM...');
        
        if (!this.elements.grid || !suggestions || suggestions.length === 0) {
            console.warn('⚠️ [EMERGÊNCIA] Grid ou sugestões não disponíveis para verificação visual');
            return;
        }
        
        const domCards = Array.from(this.elements.grid.children);
        if (domCards.length === 0) {
            console.warn('⚠️ [EMERGÊNCIA] Nenhum card encontrado no DOM');
            return;
        }
        
        console.log(`📊 [EMERGÊNCIA] Verificando ${domCards.length} cards no DOM...`);
        
        // Verificar se True Peak está em primeiro
        let truePeakFirst = false;
        let problemasEncontrados = [];
        
        domCards.forEach((card, index) => {
            const text = card.textContent || card.innerText || '';
            const isPeak = card.dataset.type?.includes('true_peak')
                         || card.dataset.type?.includes('reference_true_peak')
                         || card.dataset.priority === '10';
            const priority = card.dataset.priority || 'unknown';
            
            if (isPeak) {
                if (index === 0) {
                    truePeakFirst = true;
                    console.log('✅ [EMERGÊNCIA] True Peak está em primeiro lugar visual!');
                } else {
                    problemasEncontrados.push(`True Peak encontrado na posição ${index + 1} (deveria ser 1)`);
                }
            }
            
            console.log(`📋 [EMERGÊNCIA] Card ${index + 1}: ${isPeak ? '🔴 TRUE PEAK' : '🟢 OUTRO'} (priority: ${priority})`);
        });
        
        // Se True Peak não está primeiro, forçar correção
        if (!truePeakFirst && problemasEncontrados.length > 0) {
            console.error('❌ [EMERGÊNCIA] PROBLEMA VISUAL DETECTADO:', problemasEncontrados);
            
            // 🚨 CORREÇÃO FORÇADA: Reorganizar DOM
            this.forcarReorganizacaoDOM(suggestions);
            
        } else if (truePeakFirst) {
            console.log('✅ [EMERGÊNCIA] Ordem visual está CORRETA!');
            
            // Adicionar marcação visual para debug
            const firstCard = domCards[0];
            if (firstCard) {
                firstCard.style.border = '3px solid #4CAF50';
                firstCard.style.boxShadow = '0 0 15px rgba(76, 175, 80, 0.5)';
                console.log('🎯 [EMERGÊNCIA] Primeiro card marcado visualmente (verde = correto)');
            }
        }
    }

    forcarReorganizacaoDOM(suggestions) {
        console.warn('🚨 [EMERGÊNCIA] Aplicando reorganização forçada do DOM...');
        
        // 🎯 VERIFICAÇÃO INTELIGENTE: Só reordenar se necessário
        const domCards = Array.from(this.elements.grid.children);
        const allHavePriority = domCards.every(c => c.dataset.priority && c.dataset.priority !== 'unknown');
        
        if (allHavePriority) {
            console.log('✅ [ORDEM] Cards já possuem prioridade válida, mantendo ordem calculada');
            return;
        }
        
        console.log('⚠️ [ORDEM] Cards sem prioridade detectados, aplicando reorganização...');
        
        // Ordenar sugestões por prioridade
        const suggestionsOrdenadas = [...suggestions].sort((a, b) => {
            return (b.priority || 0) - (a.priority || 0);
        });
        
        // Limpar grid
        this.elements.grid.innerHTML = '';
        
        // Recriar cards na ordem correta
        suggestionsOrdenadas.forEach((suggestion, index) => {
            const card = this.createSuggestionCard(suggestion, index, 'emergency-fix');
            this.elements.grid.appendChild(card);
            
            // Marcar visualmente para debug
            if (index === 0) {
                card.style.border = '3px solid #ff9800';
                card.style.boxShadow = '0 0 15px rgba(255, 152, 0, 0.7)';
                console.log('🚨 [EMERGÊNCIA] Primeiro card corrigido e marcado (laranja = correção aplicada)');
            }
        });
        
        console.log('✅ [EMERGÊNCIA] DOM reorganizado! True Peak deve estar primeiro agora.');
        
        // Verificar novamente após correção
        setTimeout(() => {
            const primeiroCard = this.elements.grid.children[0];
            if (primeiroCard) {
                const text = primeiroCard.textContent || '';
                const isPeak = text.toLowerCase().includes('peak') || text.toLowerCase().includes('true peak');
                
                if (isPeak) {
                    console.log('🎉 [EMERGÊNCIA] SUCESSO! True Peak agora está primeiro após correção!');
                } else {
                    console.error('❌ [EMERGÊNCIA] FALHA! True Peak ainda não está primeiro mesmo após correção!');
                }
            }
        }, 50);
    }
    
    setupOrderGuarantee() {
        // 🎯 FUNÇÃO GLOBAL: Garantir ordem correta das sugestões
        window.forceCorrectSuggestionsOrder = (suggestions) => {
            if (!Array.isArray(suggestions)) return suggestions;
            
            console.log('🎯 [ORDER-GUARANTEE] Aplicando ordem correta forçada');
            
            // Definir ordem técnica correta
            const typeOrder = {
                'reference_true_peak': 10,
                'heuristic_true_peak': 10,
                'true_peak': 10,
                'reference_loudness': 8,
                'heuristic_lufs': 8,
                'lufs': 8,
                'reference_dynamics': 6,
                'reference_lra': 6,
                'heuristic_lra': 6,
                'dr': 6,
                'lra': 6,
                'reference_stereo': 4,
                'heuristic_stereo': 4,
                'stereo': 4,
                'band_adjust': 2,
                'reference_band_comparison': 2,
                'heuristic_spectral_imbalance': 2
            };
            
            // Aplicar prioridades baseadas no tipo + prioridade original
            const ordered = suggestions.map(sug => {
                const basePriority = typeOrder[sug.type] || typeOrder[sug.metric] || 1;
                const originalPriority = parseFloat(sug.priority) || 1;
                
                // Usar a maior prioridade entre tipo e original
                sug.priority = Math.max(basePriority, originalPriority);
                return sug;
            }).sort((a, b) => {
                const priorityA = parseFloat(a.priority) || 1;
                const priorityB = parseFloat(b.priority) || 1;
                return priorityB - priorityA; // Ordem decrescente
            });
            
            console.log('🎯 [ORDER-GUARANTEE] Ordem aplicada:', 
                ordered.slice(0, 5).map(s => `${s.type || s.metric}(${s.priority})`).join(' → '));
            
            return ordered;
        };
        
        console.log('🎯 [ORDER-GUARANTEE] Sistema de garantia de ordem criado globalmente');
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

        // 🚀 CACHE INTELIGENTE: Evitar processamento duplicado
        const suggestionsHash = window.generateSuggestionsHash(suggestions);
        console.log('🔍 [AI-INTEGRATION] Hash Debug:', {
            currentHash: suggestionsHash,
            lastHash: window.lastProcessedHash,
            suggestionsCount: suggestions.length,
            firstSuggestion: suggestions[0]?.message || 'N/A'
        });
        
        if (window.lastProcessedHash === suggestionsHash) {
            console.log('🎯 [AI-INTEGRATION] Sugestões idênticas já processadas - usando cache');
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
        // [TP-FIX] Não interromper o fluxo se há métricas disponíveis (pode ter True Peak)
        const hasAtLeastOne = validSuggestions && validSuggestions.length > 0;
        if (!hasAtLeastOne) {
            console.warn('[TP-FIX] Nenhuma sugestão "forte" pós-validação; seguindo com fluxo para exibir TP via fallback de render.');
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
        this.updateStatus('processing', `🤖 Enriquecendo ${validSuggestions.length} sugestões com IA...`);
        
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
            
            // 🎯 PASSO 4: MERGE INTELIGENTE - PRESERVAR DETALHES ORIGINAIS + ENRIQUECIMENTO IA
            const enhancedFromAI = Array.isArray(data.enhancedSuggestions) ? data.enhancedSuggestions : [];
            
            // 🔗 COMBINAR: Detalhes técnicos originais + Enriquecimento da IA
            let finalSuggestions = validSuggestions.map((original, index) => {
                const enhanced = enhancedFromAI[index] || {};
                
                // Preservar dados técnicos originais + adicionar enriquecimento IA
                return {
                    ...original,          // Valores dB, plugins, ações específicas
                    ...enhanced,          // Enriquecimento da IA (se houver)
                    ai_enhanced: true,
                    
                    // Garantir que valores técnicos originais não sejam perdidos
                    message: original.message || enhanced.message || original.issue,
                    action: original.action || enhanced.action || original.solution,
                    priority: original.priority || enhanced.metadata?.priority_score || 1
                };
            });

            // 🎯 GARANTIA DE ORDEM: Usar sistema global para forçar ordem correta
            if (window.forceCorrectSuggestionsOrder) {
                finalSuggestions = window.forceCorrectSuggestionsOrder(finalSuggestions);
                console.log('🎯 [AI-INTEGRATION] Ordem forçada aplicada via sistema global');
            } else {
                // Fallback: Ordenação local
                finalSuggestions = finalSuggestions.sort((a, b) => {
                    const priorityA = parseFloat(a.priority) || 1;
                    const priorityB = parseFloat(b.priority) || 1;
                    
                    // True Peak tem priority 10 - deve vir PRIMEIRO (ordem decrescente)
                    return priorityB - priorityA;
                });
                console.log('🎯 [AI-INTEGRATION] Ordem aplicada via fallback local');
            }

            console.group('🔍 [AUDITORIA] PASSO 4: MERGE INTELIGENTE COM PRESERVAÇÃO DE DETALHES');
            console.log('✅ Combinando detalhes originais + enriquecimento IA:', {
                originaisCount: validSuggestions.length,
                enhancedCount: enhancedFromAI.length,
                finalCount: finalSuggestions.length,
                processingTime: `${processingTime}ms`
            });
            console.log('🎯 ORDENAÇÃO APLICADA: Priority numérica decrescente (True Peak primeiro)');
            finalSuggestions.forEach((sug, index) => {
                console.log(`📋 Final Sugestão ${index + 1}:`, {
                    ai_enhanced: true,
                    priority: sug.priority,
                    message: (sug.message || '').substring(0, 60) + '...',
                    action: (sug.action || '').substring(0, 40) + '...',
                    preservedOriginal: !!(sug.message && sug.action)
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

            console.debug('[TP-FIX] TP presente pós-merge?', finalSuggestions.some(s => s.type === 'reference_true_peak'));
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
     * [TP-FIX] Helper: extrai texto legível sem destruir a estrutura original
     */
    __extractBlocksText(blocks) {
        if (!blocks) return [];
        if (Array.isArray(blocks)) {
            return blocks
                .map(b => (typeof b === 'string' ? b : (b && (b.content || b.text)) || ''))
                .filter(Boolean);
        }
        // suporte a objeto com subcampos (ex.: {problem, cause, solution})
        const candidates = ['problem','cause','solution','tip','plugin','result','problema','causa','solucao'];
        return candidates.map(k => blocks[k]).flatMap(v => {
            if (!v) return [];
            if (Array.isArray(v)) return v.map(x => (typeof x === 'string' ? x : x?.content || x?.text || '')).filter(Boolean);
            return [typeof v === 'string' ? v : v?.content || v?.text || ''].filter(Boolean);
        }).filter(Boolean);
    }

    /**
     * Validar e normalizar sugestões antes de enviar para IA
     * [TP-FIX] Agora não-destrutiva, preserva todos os campos originais
     */
    validateAndNormalizeSuggestions(suggestions) {
        if (!Array.isArray(suggestions)) {
            console.warn('⚠️ [AI-INTEGRATION] Sugestões não são array:', typeof suggestions);
            return [];
        }

        const out = [];
        for (const s of (suggestions || [])) {
            if (!s) continue;

            // mantém tudo que já existe
            const clone = { ...s };

            // preserva prioridade e tipo
            if (clone.type === 'reference_true_peak' && (clone.priority == null || Number.isNaN(clone.priority))) {
                clone.priority = 10; // manter prioridade alta para TP
            }

            // derive conteúdos legíveis sem destruir campos
            const blocksText = this.__extractBlocksText(clone.blocks);
            clone.__blocksText = blocksText; // apenas para render fallback

            // checagem mínima (não destrutiva)
            const hasAnyText =
                !!clone.title || !!clone.message || !!clone.issue ||
                (Array.isArray(blocksText) && blocksText.length > 0);

            if (!hasAnyText) {
                console.warn('[TP-FIX] Sugestão sem conteúdo mínimo, mantendo para merge mas marcando como low-visibility:', clone.type || clone.metric);
                clone.__lowVisibility = true; // não descartar
            }

            out.push(clone);
        }

        console.log('✅ [TP-FIX] Sugestões validadas (não-destrutiva):', {
            original: suggestions.length,
            processadas: out.length,
            lowVisibility: out.filter(s => s.__lowVisibility).length,
            truePeakPresente: out.some(s => s.type === 'reference_true_peak')
        });

        return out;
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
            
            // Determinar prioridade (valores altos = alta prioridade, como sistema principal)
            let priority = suggestion.priority || 5;
            if (typeof priority !== 'number') {
                if (priority === 'alta' || priority === 'high') priority = 8;
                else if (priority === 'média' || priority === 'medium') priority = 5; 
                else if (priority === 'baixa' || priority === 'low') priority = 2;
                else priority = 5;
            }
            
            // Garantir que priority está no range correto (1-10, compatível com sistema principal)
            priority = Math.max(1, Math.min(10, Math.floor(priority)));
            
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
    /**
     * [TP-FIX] Gera chave estável para identificar sugestões
     */
    __keyOf(s) {
        const v = s?.id || s?.type || s?.metric || s?.title || s?.message || s?.issue || '';
        return String(v).toLowerCase().replace(/\s+/g,'_').slice(0,80);
    }

    mergeAISuggestionsWithOriginals(originalSuggestions, aiEnhancedSuggestions) {
        console.log('[AI-MERGE] Iniciando merge de sugestões:', {
            originais: originalSuggestions?.length || 0,
            enriquecidas: aiEnhancedSuggestions?.length || 0
        });

        // [TP-FIX] Merge por chave estável, não por índice
        const byKey = new Map();
        
        // Primeira passada: registrar sugestões originais
        for (const s of originalSuggestions || []) {
            if (!s) continue;
            byKey.set(this.__keyOf(s), { ...s });
        }
        
        // Segunda passada: merge com sugestões da IA
        for (const a of aiEnhancedSuggestions || []) {
            if (!a) continue;
            const k = this.__keyOf(a);
            const base = byKey.get(k) || {};
            
            // merge cuidadoso
            const merged = {
                ...base,
                ...a,
                type: base.type || a.type,                // preserva tipo original se existir
                priority: Number.isFinite(base.priority) ? base.priority : a.priority,
                blocks: base.blocks ?? a.blocks,          // nunca zere blocks se o original tem
                ai_enhanced: true,
                ai_blocks: a.blocks || {},
                ai_category: a.metadata?.processing_type || 'geral',
                ai_priority: this.mapPriorityFromBackend(a.metadata?.priority),
                ai_technical_details: {
                    difficulty: a.metadata?.difficulty || 'intermediário',
                    frequency_range: a.metadata?.frequency_range || '',
                    tools_suggested: this.extractToolsFromBlocks(a.blocks)
                },
                // 🎯 PRESERVAR valores específicos de dB das sugestões originais
                title: base.title || base.message || a.blocks?.problem,
                description: base.description || base.action || a.blocks?.solution,
                // Adicionar blocos IA como enriquecimento adicional
                ai_enrichment: {
                    problem_analysis: a.blocks?.problem,
                    enhanced_solution: a.blocks?.solution,
                    professional_tip: a.blocks?.tip,
                    recommended_plugin: a.blocks?.plugin
                }
            };
            
            // mantenha também __blocksText se existir em qualquer lado
            merged.__blocksText = base.__blocksText || a.__blocksText || merged.__blocksText;
            byKey.set(k, merged);
        }
        
        // Se não há sugestões originais, adicionar as não-matched da IA
        if (!originalSuggestions || originalSuggestions.length === 0) {
            for (const a of aiEnhancedSuggestions || []) {
                if (!a) continue;
                const k = this.__keyOf(a);
                if (!byKey.has(k)) {
                    const newSuggestion = {
                        ...a,
                        ai_enhanced: true,
                        ai_blocks: a.blocks || {},
                        ai_category: a.metadata?.processing_type || 'geral',
                        title: a.blocks?.problem || 'Sugestão da IA',
                        description: a.blocks?.solution || 'Melhoria recomendada'
                    };
                    byKey.set(k, newSuggestion);
                }
            }
        }

        // [TP-FIX] ordene por prioridade numérica desc (True Peak primeiro)
        const result = [...byKey.values()]
            .sort((a,b)=>(Number(b?.priority)||0)-(Number(a?.priority)||0));

        console.log('[TP-FIX] Merge concluído por chave estável:', {
            total: result.length,
            enriquecidas: result.filter(s => s.ai_enhanced).length,
            originais: result.filter(s => !s.ai_enhanced).length,
            truePeakPresente: result.some(s => s.type === 'reference_true_peak')
        });

        return result;
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
        // 🔍 AUDITORIA PASSO 6: RENDERIZAÇÃO FINAL
        console.group('🔍 [AUDITORIA] RENDERIZAÇÃO FINAL');
        console.log('[AI-UI] Renderizando sugestões enriquecidas:', suggestions?.length || 0);
        console.debug('[TP-FIX] TP presente antes da renderização?', suggestions?.some(s => s.type === 'reference_true_peak'));
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
            `;
            return;
        }
        
        // 🎯 ORDENAÇÃO FINAL GARANTIDA: Garantir ordem correta antes da renderização
        console.log('🎯 [ORDEM-FINAL] Aplicando ordenação final garantida...');
        
        const suggestionsOrdenadas = [...suggestions].sort((a, b) => {
            // Ordenar por prioridade decrescente (maior prioridade primeiro)
            const priorityA = a.priority || a.ai_priority || 0;
            const priorityB = b.priority || b.ai_priority || 0;
            return priorityB - priorityA;
        });
        
        console.log('🎯 [ORDEM-FINAL] Ordem aplicada:');
        suggestionsOrdenadas.forEach((sug, index) => {
            const priority = sug.priority || sug.ai_priority || 0;
            const type = sug.type || 'unknown';
            const message = (sug.message || sug.title || '').substring(0, 30);
            console.log(`  ${index + 1}. Priority ${priority} (${type}): ${message}...`);
        });

        // Generate cards COM ORDEM CORRETA
        // 🔍 AUDITORIA: Contando cards criados
        let cardsCreated = 0;
        suggestionsOrdenadas.forEach((suggestion, index) => {
            const card = this.createSuggestionCard(suggestion, index, source);
            this.elements.grid.appendChild(card);
            cardsCreated++;
            
            console.log(`🖥️ Card ${cardsCreated} criado para:`, {
                originalIndex: suggestions.indexOf(suggestion),
                orderedIndex: index,
                ai_enhanced: suggestion.ai_enhanced,
                priority: suggestion.priority || suggestion.ai_priority,
                message: (suggestion.message || '').substring(0, 40) + '...',
                cardElement: !!card,
                appendedToGrid: true
            });
        });
        
        // 🎯 AUDITORIA VISUAL: Confirmar ordem dos cards renderizados (ORDENADOS)
        console.group('🎯 [AUDITORIA] ORDEM FINAL DOS CARDS RENDERIZADOS');
        console.log('📊 Ordem dos cards no DOM (deve ser TP → LUFS → DR → LRA → Stereo → Bandas):');
        suggestionsOrdenadas.forEach((sug, index) => {
            const priority = sug.priority || sug.ai_priority || 0;
            const priorityEmoji = priority >= 9 ? '🔴' : priority >= 5 ? '🟡' : '🟢';
            console.log(`${priorityEmoji} Card ${index + 1}: Priority ${priority} - ${(sug.message || '').substring(0, 50)}...`);
        });
        console.groupEnd();
        
        console.log('🔍 [AUDITORIA] CARDS FINAIS CRIADOS:', {
            totalCards: cardsCreated,
            gridChildren: this.elements.grid.children.length,
            suggestionsReceived: suggestions.length
        });

        // 🚨 CORREÇÃO VISUAL DE EMERGÊNCIA: Verificar ordem real no DOM e corrigir se necessário
        setTimeout(() => {
            this.verificarECorrigirOrdemVisual(suggestionsOrdenadas);
        }, 100); // Pequeno delay para garantir que DOM está atualizado
        
        // Show grid
        this.elements.grid.style.display = 'grid';
        
        // 🎯 MARCAÇÃO VISUAL: Identificar que AI Integration está ativo
        this.elements.grid.style.border = '2px solid #4CAF50';
        this.elements.grid.style.boxShadow = '0 0 10px rgba(76, 175, 80, 0.3)';
        
        // Animate cards
        this.animateCards();
        
        console.log(`✅ [AI-INTEGRATION] ${suggestions.length} sugestões exibidas (fonte: ${source})`);
        console.log('🎯 [AI-INTEGRATION] SISTEMA PRINCIPAL ATIVO - Sugestões renderizadas no #aiExpandedGrid');
        
        // 💾 SALVAR HASH PARA CACHE
        if (source === 'ai') {
            window.lastProcessedHash = window.generateSuggestionsHash(suggestions);
            console.log('💾 [AI-INTEGRATION] Hash do cache salvo:', window.lastProcessedHash);
        }
        
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
        
        // 🎯 PRESERVAR PRIORIDADE ORIGINAL da sugestão do Enhanced Engine
        let originalPriority = 'média'; // fallback
        if (suggestion.priority) {
            if (typeof suggestion.priority === 'number') {
                if (suggestion.priority >= 8) originalPriority = 'alta';
                else if (suggestion.priority >= 5) originalPriority = 'média';
                else originalPriority = 'baixa';
            } else {
                originalPriority = suggestion.priority;
            }
        }
        
        const metadata = suggestion.metadata || { 
            priority: originalPriority, 
            difficulty: suggestion.difficulty || 'intermediário' 
        };
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
        
        // 🎯 ATRIBUTOS DE CONTROLE: Adicionar data attributes para detecção robusta
        card.dataset.priority = suggestion.priority || suggestion.ai_priority || '0';
        card.dataset.type = suggestion.type || suggestion.metric || 'unknown';
        card.dataset.index = index;
        card.id = `suggestion-${card.dataset.type}-${index}`;
        
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
        // 🔒 PROTEÇÃO: Evitar múltiplas integrações
        if (window.displayModalResults?.__aiIntegrationHooked) {
            console.log('🔒 [AI-INTEGRATION] Sistema já integrado - pulando dupla integração');
            return;
        }
        
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
                        console.log('🔗 [AI-INTEGRATION] Timeout executado - verificando processamento');
                        console.log('🔗 aiIntegration existe?', !!window.aiIntegration);
                        console.log('🔗 isProcessing?', window.aiIntegration?.isProcessing);
                        console.log('🔗 Sugestões para processar:', analysis.suggestions?.length || 0);
                        
                        if (window.aiIntegration && !window.aiIntegration.isProcessing) {
                            console.log('🚀 [AI-INTEGRATION] Iniciando processamento IA das sugestões...');
                            window.aiIntegration.processWithAI(analysis.suggestions, metrics, genre);
                        } else {
                            console.warn('⚠️ [AI-INTEGRATION] Processamento bloqueado:', {
                                hasAiIntegration: !!window.aiIntegration,
                                isProcessing: window.aiIntegration?.isProcessing
                            });
                        }
                    }, 100);
                }
                
                return result;
            };
            
            // 🔒 MARCAR COMO INTEGRADO
            window.displayModalResults.__aiIntegrationHooked = true;
            
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
        // CRITICAL: Expose as aiIntegration for the interceptor
        window.aiIntegration = aiSuggestionsSystem;
        
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

/**
 * 🔄 Gerar hash para cache de sugestões
 */
window.generateSuggestionsHash = function(suggestions) {
    const hashString = suggestions.map(s => 
        `${s.message || ''}:${s.action || ''}:${s.priority || 0}`
    ).join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < hashString.length; i++) {
        const char = hashString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
};

window.sendAISuggestionsToChat = function() {
    // This would integrate with the existing chat system
    console.log('💬 [AI-INTEGRATION] Funcionalidade de chat em desenvolvimento');
    alert('Funcionalidade de discussão com IA será implementada em breve.');
};

console.log('📦 [AI-INTEGRATION] Módulo carregado - aguardando inicialização');

/*
[TP-FIX] CASOS DE TESTE PARA TRUE PEAK

Caso A (formato novo):
[{ type:'reference_true_peak', priority:10, blocks:[{content:'True Peak: -2.1 dBTP | Target: -1.0 dBTP | Score: 8.5'}] }]

Caso B (formato antigo):
[{ type:'reference_true_peak', priority:10, blocks:['True Peak acima do alvo - ajustar limitador'] }]

Caso C (sem blocks, só message):
[{ type:'reference_true_peak', priority:10, message:'True Peak crítico detectado' }]

Resultado esperado nos três: card visível, TP no topo.

Para testar:
1. Abra o DevTools
2. Execute: aiIntegration.processWithAI(CASO_A, {}, 'electronic')
3. Verifique se True Peak aparece no modal
4. Confirme presença dos logs [TP-FIX]
*/

// Exportar classe para uso global
window.AISuggestionIntegration = AISuggestionsIntegration;
window.AISuggestionsIntegration = AISuggestionsIntegration;