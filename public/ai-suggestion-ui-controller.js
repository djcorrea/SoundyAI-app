// 🎨 AI SUGGESTION UI CONTROLLER - Controle da Interface de Sugestões IA
// Sistema de interface futurista para exibição de sugestões educativas

/**
 * 🎨 Controlador de Interface para Sugestões de IA
 */
class AISuggestionUIController {
    constructor() {
        this.isInitialized = false;
        this.currentSuggestions = [];
        this.isFullModalOpen = false;
        this.animationQueue = [];
        this.lastAnalysisJobId = null; // 🔧 Rastrear última análise processada
        this.lastAnalysisTimestamp = null; // 🔧 Timestamp da última análise
        
        // FIX: Timer para debounce de checkForAISuggestions
        this.__debounceTimer = null;
        
        // Elementos DOM
        this.elements = {
            aiSection: null,
            aiContent: null,
            aiStatusBadge: null,
            aiModelBadge: null,
            fullModal: null,
            fullModalContent: null,
            aiStatsCount: null,
            aiStatsModel: null,
            aiStatsTime: null
        };
        
        console.log('🎨 [AI-UI] Controlador de interface inicializado');
        
        // Auto-inicializar quando DOM estiver pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }
    
    /**
     * 🔒 NORMALIZAÇÃO RADICAL - MODO REDUCED (ZERO STRINGS)
     * 
     * Modo Reduced: Retorna APENAS { type: 'locked', metricKey }
     * Modo Full: Retorna objeto completo com textos
     * 
     * ⚠️ CRÍTICO: No modo reduced, NENHUMA string de texto pode existir
     */
    normalizeSuggestionForRender(suggestion, analysisMode) {
        if (!suggestion) return null;
        
        // 🔒 MODO REDUCED: RETORNAR APENAS TYPE + METRIC
        if (analysisMode === 'reduced') {
            console.log('[NORMALIZE] 🔒 REDUCED: Retornando apenas type=locked');
            
            // ❌ NENHUMA STRING DE TEXTO
            // ✅ APENAS type e metricKey
            return {
                type: 'locked',
                metricKey: suggestion.metric || suggestion.categoria || 'general',
                categoria: suggestion.categoria || 'Geral', // Apenas para UI (não é texto de sugestão)
                nivel: suggestion.nivel || 'média' // Apenas para UI
            };
        }
        
        // ✅ MODO FULL: RETORNAR TUDO
        console.log('[NORMALIZE] ✅ FULL: Objeto completo com textos');
        return {
            type: 'full',
            ...suggestion
        };
    }
    
    /**
     * 🔒 RENDERIZAR PLACEHOLDER VAZIO (SEM TEXTO NO DOM)
     * Retorna elemento DOM VAZIO - texto vem via CSS ::before
     * ⚠️ Inspect Element NÃO mostra pseudo-elements
     */
    renderBlockedNode() {
        const span = document.createElement('span');
        span.className = 'secure-placeholder';
        span.setAttribute('aria-hidden', 'true');
        span.setAttribute('data-blocked', 'true');
        // ⚠️ NÃO ADICIONAR textContent - elemento VAZIO
        // Texto visual vem via CSS .secure-placeholder::before
        return span;
    }
    
    /**
     * 🔒 RENDERIZAR CARD BLOQUEADO (SEM TEXTO NO DOM)
     * Retorna HTML com elementos vazios - texto via CSS
     */
    renderBlockedCard() {
        const card = document.createElement('div');
        card.className = 'ai-block blocked-block';
        card.setAttribute('data-blocked', 'true');
        
        const content = document.createElement('div');
        content.className = 'ai-block-content';
        
        const placeholder = this.renderBlockedNode();
        content.appendChild(placeholder);
        
        card.appendChild(content);
        return card;
    }
    
    /**
     * 🔐 RENDERIZAR CONTEÚDO SEGURO (SECURITY GUARD)
     * Camada adicional de proteção - garante que texto nunca vaze no DOM
     * 
     * @param {string|null} content - Conteúdo a ser renderizado
     * @param {boolean} isReducedMode - Se está em modo reduced
     * @returns {string} HTML seguro (placeholder ou conteúdo real)
     */
    renderSecureTextContent(content, isReducedMode) {
        // 🔒 MODO REDUCED: Sempre retornar placeholder
        if (isReducedMode || content === null || content === undefined) {
            console.log('[SECURE-TEXT] 🔒 BLOCKED: Retornando placeholder');
            return '<span class="blocked-value">•••• 🔒</span>';
        }
        
        // ✅ MODO FULL: Retornar conteúdo real
        console.log('[SECURE-TEXT] ✅ FULL: Texto real');
        return content;
    }
    
    /**
     * 🔐 FUNÇÃO CENTRAL DE RENDERIZAÇÃO - CREATEELEMENT APENAS
     * 
     * ❌ PROIBIDO: innerHTML, template literals
     * ✅ OBRIGATÓRIO: document.createElement, textContent
     * 
     * @param {Object} normalized - Sugestão normalizada
     * @param {string} title - Título do bloco
     * @param {string} blockClass - Classe CSS
     * @returns {HTMLElement} Elemento DOM
     */
    renderSuggestionBlock(normalized, title, blockClass) {
        console.log('[RENDER-BLOCK] 🔐 Rendering:', { type: normalized.type, blockClass });
        
        // Criar container do bloco
        const block = document.createElement('div');
        block.className = `ai-block ${blockClass}`;
        
        // Criar título
        const titleDiv = document.createElement('div');
        titleDiv.className = 'ai-block-title';
        titleDiv.textContent = title; // ✅ textContent (não innerHTML)
        
        // Criar conteúdo
        const contentDiv = document.createElement('div');
        contentDiv.className = 'ai-block-content';
        
        // 🔒 MODO LOCKED: Apenas placeholder
        if (normalized.type === 'locked') {
            console.log('[RENDER-BLOCK] 🔒 LOCKED: Renderizando placeholder');
            
            block.classList.add('blocked-block');
            
            const placeholder = document.createElement('span');
            placeholder.className = 'blocked-value';
            placeholder.textContent = '🔒 Disponível no plano Pro'; // ✅ textContent
            
            contentDiv.appendChild(placeholder);
        }
        // ✅ MODO FULL: Texto real
        else if (normalized.type === 'full') {
            console.log('[RENDER-BLOCK] ✅ FULL: Renderizando texto real');
            
            // Determinar qual propriedade usar baseado no blockClass
            let textContent = '';
            
            if (blockClass.includes('problema')) {
                textContent = normalized.problema || normalized.message || 'Problema não especificado';
            } else if (blockClass.includes('causa')) {
                textContent = normalized.causaProvavel || 'Causa não analisada';
            } else if (blockClass.includes('solucao')) {
                textContent = normalized.solucao || normalized.action || 'Solução não especificada';
            } else if (blockClass.includes('plugin')) {
                textContent = normalized.pluginRecomendado || 'Não especificado';
            } else if (blockClass.includes('dica')) {
                textContent = normalized.dicaExtra || '';
            } else if (blockClass.includes('parametros')) {
                textContent = normalized.parametros || '';
            }
            
            contentDiv.textContent = textContent; // ✅ textContent (não innerHTML)
        }
        
        // Montar estrutura
        block.appendChild(titleDiv);
        block.appendChild(contentDiv);
        
        return block; // ✅ Retorna HTMLElement (não string)
    }
    
    /**
     * 🚀 Inicializar controlador
     */
    initialize() {
        try {
            this.cacheElements();
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            this.isInitialized = true;
            
            console.log('🎨 [AI-UI] Interface inicializada com sucesso');
            
            // Auto-detectar se há sugestões IA para exibir
            this.checkForExistingAISuggestions();
            
        } catch (error) {
            console.error('❌ [AI-UI] Erro na inicialização:', error);
        }
    }
    
    /**
     * 📦 Cache dos elementos DOM
     */
    cacheElements() {
        // 🔍 [AI-SUGGESTIONS-FIX] Apontar para IDs corretos do index.html
        this.elements = {
            // ✅ Elementos principais do modal expandido
            aiSection: document.getElementById('aiSuggestionsExpanded'),
            aiContent: document.getElementById('aiExpandedGrid'),
            
            // ✅ Status e indicadores
            aiStatusBadge: document.getElementById('aiExpandedStatus'),
            aiModelBadge: document.getElementById('aiModelBadge'), // Pode não existir
            
            // ✅ Modal completo (fullscreen)
            fullModal: document.getElementById('aiSuggestionsFullModal'), // Pode não existir
            fullModalContent: document.getElementById('aiFullModalContent'), // Pode não existir
            
            // ✅ Elementos auxiliares
            aiStatsCount: document.getElementById('aiStatsCount'), // Pode não existir
            aiStatsModel: document.getElementById('aiStatsModel'), // Pode não existir
            aiStatsTime: document.getElementById('aiStatsTime'), // Pode não existir
            
            // 🆕 Novos elementos do HTML atual
            aiLoading: document.getElementById('aiExpandedLoading'),
            aiFallbackNotice: document.getElementById('aiFallbackNotice')
        };
        
        // Verificar se elementos CRÍTICOS existem
        const criticalElements = ['aiSection', 'aiContent'];
        const missingCritical = criticalElements.filter(key => !this.elements[key]);
        
        if (missingCritical.length > 0) {
            console.error('❌ [AI-UI] Elementos DOM CRÍTICOS não encontrados:', missingCritical);
            console.error('❌ [AI-UI] Sugestões da IA NÃO serão exibidas!');
            console.error('❌ [AI-UI] Verifique se os IDs existem no index.html:', {
                aiSuggestionsExpanded: !!document.getElementById('aiSuggestionsExpanded'),
                aiExpandedGrid: !!document.getElementById('aiExpandedGrid')
            });
        } else {
            console.log('✅ [AI-UI] Elementos DOM críticos encontrados:', {
                aiSection: !!this.elements.aiSection,
                aiContent: !!this.elements.aiContent
            });
        }
        
        // Log de elementos opcionais ausentes (não bloqueantes)
        const allMissing = Object.entries(this.elements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);
            
        if (allMissing.length > 0) {
            console.warn('⚠️ [AI-UI] Elementos DOM opcionais não encontrados:', allMissing);
        }
    }
    
    /**
     * 🎧 Configurar event listeners
     */
    setupEventListeners() {
        // Fechar modal ao clicar no backdrop
        if (this.elements.fullModal) {
            this.elements.fullModal.addEventListener('click', (e) => {
                if (e.target === this.elements.fullModal || e.target.classList.contains('ai-full-modal-backdrop')) {
                    this.closeFullModal();
                }
            });
        }
        
        // Detectar mudanças na análise atual
        if (typeof window !== 'undefined') {
            // Observer para mudanças no currentModalAnalysis
            let lastAnalysis = null;
            setInterval(() => {
                if (window.currentModalAnalysis && window.currentModalAnalysis !== lastAnalysis) {
                    lastAnalysis = window.currentModalAnalysis;
                    this.checkForAISuggestions(window.currentModalAnalysis);
                }
            }, 1000);
        }
    }
    
    /**
     * ⌨️ Configurar atalhos de teclado
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // ESC para fechar modal
            if (e.key === 'Escape' && this.isFullModalOpen) {
                this.closeFullModal();
            }
            
            // Ctrl/Cmd + I para toggle IA
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                this.toggleAILayer();
            }
            
            // F para fullscreen das sugestões (quando seção visível)
            if (e.key === 'f' && this.elements.aiSection?.style.display !== 'none') {
                e.preventDefault();
                this.openFullModal();
            }
        });
    }
    
    /**
     * 🔍 Verificar sugestões IA existentes
     */
    checkForExistingAISuggestions() {
        if (window.currentModalAnalysis) {
            this.checkForAISuggestions(window.currentModalAnalysis);
        }
    }
    
    /**
     * 🔄 Resetar estado de sugestões IA
     * Limpa cache local e estado interno sem afetar renderização atual
     */
    resetAISuggestionState() {
        console.log('%c[AI-UI][RESET] 🔄 Resetando estado de sugestões IA', 'color:#FF9500;font-weight:bold;');
        
        // Limpar cache de análise anterior
        this.lastAnalysisJobId = null;
        this.lastAnalysisTimestamp = null;
        
        // NÃO limpar currentSuggestions (mantém renderização visual)
        // NÃO limpar elementos DOM (preserva estrutura)
        
        console.log('[AI-UI][RESET] ✅ Estado interno resetado');
        console.log('[AI-UI][RESET] ℹ️  Renderização visual preservada');
    }
    
    /**
     * 🛡️ FIX: Reset seguro que previne race condition
     * Protege renderização concluída em modo reference
     */
    safeResetAIState() {
        console.log('%c[AI-UI][SAFE-RESET] 🔍 Verificando se reset é seguro...', 'color:#00C9FF;font-weight:bold;');
        
        // FIX: Se análise está em modo reference (comparação A/B), nunca resetar após render
        const currentMode = window.__CURRENT_ANALYSIS_MODE__;
        if (currentMode === 'reference') {
            console.warn('%c[AI-UI][SAFE-RESET] 🧊 Reset bloqueado: modo reference ativo', 'color:#FFA500;font-weight:bold;');
            return;
        }
        
        // FIX: Se renderização já foi concluída, não resetar (previne Safari bug)
        if (window.__AI_RENDER_COMPLETED__ === true) {
            console.warn('%c[AI-UI][SAFE-RESET] 🧊 Reset bloqueado: renderização já concluída', 'color:#FFA500;font-weight:bold;');
            return;
        }
        
        // Reset normal permitido
        console.log('%c[AI-UI][SAFE-RESET] ✅ Reset permitido', 'color:#00FF88;font-weight:bold;');
        this.resetAISuggestionState();
    }
    
    /**
     * 🤖 Verificar e processar sugestões IA
     */
    /**
     * 🔍 Extrair aiSuggestions de qualquer nível do objeto analysis
     * Suporta: camelCase, snake_case, strings JSON, aninhamento profundo
     * Busca recursiva garante detecção em qualquer estrutura
     * 🔧 PRIORIDADE: userAnalysis.aiSuggestions (comparações A vs B)
     */
    extractAISuggestions(analysis) {
        console.log('[AI-EXTRACT] 🔍 Iniciando busca por aiSuggestions (profundidade total)...');
        if (!analysis || typeof analysis !== 'object') return [];

        // 🎯 PRIORIDADE 1: analysis.aiSuggestions (nível raiz - backend envia aqui)
        if (Array.isArray(analysis.aiSuggestions) && analysis.aiSuggestions.length > 0) {
            console.log(`%c[AI-FIX] ✅ Campo aiSuggestions detectado em: NÍVEL RAIZ`, 'color:#00FF88;font-weight:bold;');
            console.log(`%c[AI-FIX] 📊 Quantidade total: ${analysis.aiSuggestions.length}`, 'color:#00FF88;font-weight:bold;');
            console.log(`[AI-EXTRACT] 🔍 Primeira sugestão:`, {
                categoria: analysis.aiSuggestions[0]?.categoria,
                problema: analysis.aiSuggestions[0]?.problema?.substring(0, 60),
                aiEnhanced: analysis.aiSuggestions[0]?.aiEnhanced
            });
            return analysis.aiSuggestions;
        }

        // 🎯 PRIORIDADE 2: userAnalysis.aiSuggestions (comparações A vs B)
        if (Array.isArray(analysis.userAnalysis?.aiSuggestions) && analysis.userAnalysis.aiSuggestions.length > 0) {
            console.log(`%c[AI-FIX] ✅ Campo aiSuggestions detectado em: userAnalysis`, 'color:#00FF88;font-weight:bold;');
            console.log(`%c[AI-FIX] 📊 Quantidade total: ${analysis.userAnalysis.aiSuggestions.length}`, 'color:#00FF88;font-weight:bold;');
            console.log(`[AI-EXTRACT] 🔍 Primeira sugestão:`, {
                categoria: analysis.userAnalysis.aiSuggestions[0]?.categoria,
                problema: analysis.userAnalysis.aiSuggestions[0]?.problema?.substring(0, 60)
            });
            return analysis.userAnalysis.aiSuggestions;
        }
        
        // 🎯 PRIORIDADE 3: referenceAnalysis.aiSuggestions
        if (Array.isArray(analysis.referenceAnalysis?.aiSuggestions) && analysis.referenceAnalysis.aiSuggestions.length > 0) {
            console.log(`%c[AI-FIX] ✅ Campo aiSuggestions detectado em: referenceAnalysis`, 'color:#00FF88;font-weight:bold;');
            console.log(`%c[AI-FIX] 📊 Quantidade total: ${analysis.referenceAnalysis.aiSuggestions.length}`, 'color:#00FF88;font-weight:bold;');
            return analysis.referenceAnalysis.aiSuggestions;
        }
        
        // 🎯 PRIORIDADE 4: analysis.suggestions (fallback genérico)
        if (Array.isArray(analysis.suggestions) && analysis.suggestions.length > 0) {
            // Verificar se são sugestões IA (com aiEnhanced ou campos específicos)
            const hasAIFields = analysis.suggestions.some(s => 
                s.aiEnhanced === true || 
                (s.categoria && s.problema && s.solucao)
            );
            
            if (hasAIFields) {
                console.log(`%c[AI-FIX] ✅ Campo aiSuggestions detectado em: suggestions (fallback)`, 'color:#FFD700;font-weight:bold;');
                console.log(`%c[AI-FIX] 📊 Quantidade total: ${analysis.suggestions.length}`, 'color:#FFD700;font-weight:bold;');
                return analysis.suggestions;
            }
        }

        // 🔹 Função auxiliar de busca recursiva (fallback)
        const deepSearch = (obj, path = '') => {
            if (!obj || typeof obj !== 'object') return null;

            // Verifica variantes possíveis (camelCase e snake_case)
            if (Array.isArray(obj.aiSuggestions) && obj.aiSuggestions.length > 0) {
                console.log(`%c[AI-EXTRACT] ✅ Encontrado em caminho: ${path || 'raiz'}.aiSuggestions`, 'color:#00FF88;');
                return obj.aiSuggestions;
            }
            if (Array.isArray(obj.ai_suggestions) && obj.ai_suggestions.length > 0) {
                console.log(`%c[AI-EXTRACT] ✅ Encontrado em caminho: ${path || 'raiz'}.ai_suggestions (snake_case)`, 'color:#00FF88;');
                return obj.ai_suggestions;
            }

            // Detecta se veio stringificado
            if (typeof obj.aiSuggestions === 'string') {
                try {
                    const parsed = JSON.parse(obj.aiSuggestions);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        console.log(`%c[AI-EXTRACT] ✅ Encontrado stringificado em: ${path || 'raiz'}.aiSuggestions`, 'color:#00FF88;');
                        return parsed;
                    }
                } catch (err) {
                    console.warn('[AI-EXTRACT] ⚠️ Falha ao parsear aiSuggestions stringificado:', err.message);
                }
            }
            if (typeof obj.ai_suggestions === 'string') {
                try {
                    const parsed = JSON.parse(obj.ai_suggestions);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        console.log(`%c[AI-EXTRACT] ✅ Encontrado stringificado em: ${path || 'raiz'}.ai_suggestions`, 'color:#00FF88;');
                        return parsed;
                    }
                } catch (err) {
                    console.warn('[AI-EXTRACT] ⚠️ Falha ao parsear ai_suggestions stringificado:', err.message);
                }
            }

            // Busca recursiva em todos os objetos filhos
            for (const key in obj) {
                const val = obj[key];
                if (val && typeof val === 'object') {
                    const found = deepSearch(val, path ? `${path}.${key}` : key);
                    if (found) return found;
                }
            }
            return null;
        };

        const result = deepSearch(analysis);
        if (Array.isArray(result) && result.length > 0) {
            console.log(`%c[AI-EXTRACT] ✅ Encontradas ${result.length} sugestões enriquecidas`, 'color:#00FF88;');
            console.log('[AI-EXTRACT] Sample primeira sugestão:', {
                problema: result[0]?.problema?.substring(0, 50),
                aiEnhanced: result[0]?.aiEnhanced,
                categoria: result[0]?.categoria
            });
            return result;
        }

        console.log('%c[AI-EXTRACT] ❌ Nenhum aiSuggestions encontrado (nem ai_suggestions nem stringificado)', 'color:#FF5555;');
        return [];
    }
    
    /**
     * 🕐 FIX: Wrapper com debounce para prevenir múltiplas chamadas simultâneas (Safari bug)
     */
    checkForAISuggestions(analysis, retryCount = 0) {
        // 🚫 GUARD: Impede segunda chamada após renderização concluída
        if (window.__AI_RENDER_COMPLETED__ === true) {
            console.warn('%c[AI-GUARD] 🔒 Renderização já concluída — ignorando chamada duplicada de checkForAISuggestions()', 'color:#FF9500;font-weight:bold;');
            console.log('[AI-GUARD] Status recebido:', analysis?.status);
            console.log('[AI-GUARD] aiSuggestions:', Array.isArray(analysis?.aiSuggestions) ? analysis.aiSuggestions.length : 'undefined');
            console.log('[AI-GUARD] window.__AI_RENDER_COMPLETED__:', window.__AI_RENDER_COMPLETED__);
            return; // ✅ BLOQUEIA segunda chamada
        }
        
        // FIX: Debounce de 400ms para prevenir race condition no Safari
        if (this.__debounceTimer) {
            clearTimeout(this.__debounceTimer);
        }
        
        this.__debounceTimer = setTimeout(() => {
            this.__runCheckForAISuggestions(analysis, retryCount);
        }, 400);
    }
    
    /**
     * 🤖 FIX: Função interna que executa a verificação real
     */
    __runCheckForAISuggestions(analysis, retryCount = 0) {
        // FIX: Reset automático SEGURO com proteção contra race condition
        const currentJobId = analysis?.jobId || analysis?.userAnalysis?.jobId || window.__CURRENT_JOB_ID__;
        if (currentJobId && currentJobId !== this.lastAnalysisJobId) {
            console.log('%c[AI-UI][RESET] 🔄 Nova análise detectada - executando reset seguro', 'color:#FF9500;font-weight:bold;');
            console.log('[AI-UI][RESET] JobId anterior:', this.lastAnalysisJobId);
            console.log('[AI-UI][RESET] JobId novo:', currentJobId);
            
            // FIX: Usar safeResetAIState() em vez de resetAISuggestionState()
            this.safeResetAIState();
        }
        
        // �🔬 PROTEÇÃO: Priorizar sugestões comparativas A vs B
        const hasComparativeSuggestions = (
            analysis?.mode === "compare" || 
            (Array.isArray(analysis?.aiSuggestions) && analysis.aiSuggestions.length > 0 && analysis.aiSuggestions[0]?.categoria?.includes('vs'))
        );
        
        if (hasComparativeSuggestions) {
            console.log('%c[AI-FRONT] 🔬 Modo comparativo detectado - BLOQUEANDO geração por gênero', 'color:#FF00FF;font-weight:bold;');
            console.log('[AI-FRONT] ℹ️ Sugestões existentes:', {
                quantidade: analysis.aiSuggestions?.length,
                categorias: analysis.aiSuggestions?.map(s => s.categoria).slice(0, 3)
            });
        }
        
        // 🧩 ETAPA 1 — AUDITORIA PROFUNDA DE LOCALIZAÇÃO
        console.groupCollapsed('%c[AUDITORIA:AI-SUGGESTIONS] 🔍 Localização do campo aiSuggestions', 'color:#8F5BFF;font-weight:bold;');
        const keys = Object.keys(analysis || {});
        console.log('%c🔑 Chaves de nível 1:', 'color:#FFD700;', keys);
        console.log('%c🧩 Contém referenceAnalysis?', 'color:#00C9FF;', !!analysis?.referenceAnalysis);
        console.log('%c🧩 Contém userAnalysis?', 'color:#00C9FF;', !!analysis?.userAnalysis);
        console.log('%c🧩 Contém metadata?', 'color:#00C9FF;', !!analysis?.metadata);
        console.log('%c🧩 Contém data?', 'color:#00C9FF;', !!analysis?.data);
        console.log('%c🧩 aiSuggestions diretas:', 'color:#00FF88;', Array.isArray(analysis?.aiSuggestions));
        console.log('%c🧩 ai_suggestions diretas:', 'color:#00FF88;', Array.isArray(analysis?.ai_suggestions));
        console.log('%c🎯 userAnalysis.aiSuggestions:', 'color:#00FF88;font-weight:bold;', Array.isArray(analysis?.userAnalysis?.aiSuggestions) ? `${analysis.userAnalysis.aiSuggestions.length} sugestões` : '❌');
        console.log('%c🔬 Modo comparativo?', 'color:#FF00FF;', hasComparativeSuggestions);
        console.groupEnd();
        
        // 🧩 PARTE 1 — AUDITORIA PROFUNDA (Início de `checkForAISuggestions`)
        // 🧩 PARTE 1 — AUDITORIA PROFUNDA
        console.groupCollapsed('%c[AUDITORIA:AI-FRONT] 🔍 Iniciando Auditoria Profunda de aiSuggestions', 'color:#8F5BFF;font-weight:bold;');
        console.log('%c[AI-AUDIT] 🔹 Análise recebida:', 'color:#00C9FF;', analysis);
        console.log('%c[AI-AUDIT] 🔹 Chaves de nível 1:', 'color:#FFD700;', Object.keys(analysis || {}));
        console.log('%c[AI-AUDIT] 🔹 referenceAnalysis?', 'color:#FFA500;', !!analysis?.referenceAnalysis);
        console.log('%c[AI-AUDIT] 🔹 userAnalysis?', 'color:#FFA500;', !!analysis?.userAnalysis);
        console.log('%c[AI-AUDIT] 🔹 aiSuggestions no topo?', 'color:#00FF88;', Array.isArray(analysis?.aiSuggestions) ? analysis.aiSuggestions.length : '❌');
        console.log('%c[AI-AUDIT] 🔹 aiSuggestions em referenceAnalysis?', 'color:#00FF88;', Array.isArray(analysis?.referenceAnalysis?.aiSuggestions) ? analysis.referenceAnalysis.aiSuggestions.length : '❌');
        console.log('%c[AI-AUDIT] 🔹 aiSuggestions em userAnalysis?', 'color:#00FF88;', Array.isArray(analysis?.userAnalysis?.aiSuggestions) ? analysis.userAnalysis.aiSuggestions.length : '❌');
        console.groupEnd();
        
        // 🧩 PARTE 3 — AJUSTE DO STATUS (PREVENIR BLOQUEIO DO SPINNER)
        // 🩵 Corrige status ausente herdado do subobjeto
        if (!analysis.status && analysis.referenceAnalysis?.status) {
            analysis.status = analysis.referenceAnalysis.status;
            console.log('%c[AI-FRONT][STATUS-FIX] 🔁 Status herdado de referenceAnalysis:', 'color:#00FFFF;', analysis.status);
        }
        
        // 🎯 LOGS DE AUDITORIA VISUAL
        console.log('%c[AI-FRONT][AUDIT] 🚀 Iniciando checkForAISuggestions()', 'color:#8F5BFF; font-weight:bold;');
        console.log('%c[AI-FRONT][AUDIT] Status recebido:', 'color:#00C9FF;', analysis?.status);
        console.log('%c[AI-FRONT][AUDIT] aiSuggestions:', 'color:#FFD700;', Array.isArray(analysis?.aiSuggestions) ? analysis.aiSuggestions.length : '❌ none');
        
        // 🔍 AUDITORIA PROFUNDA COM LOGS VISUAIS
        console.group('%c🔍 [AI-FRONT AUDITORIA] Iniciando verificação do sistema de IA', 'color:#8F5BFF;font-weight:bold;font-size:14px');
        console.time('⏱️ Tempo total até renderização');
        
        console.log('%c📩 [STEP 1] JSON recebido do backend', 'color:#00C9FF;font-weight:bold', analysis);
        console.log('%c📦 Campos principais:', 'color:#00C9FF', analysis ? Object.keys(analysis) : []);
        
        console.log('[AI-UI][AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[AI-UI][AUDIT] 🔍 VERIFICAÇÃO DE aiSuggestions');
        console.log('[AI-UI][AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[AI-UI][AUDIT] analysis.aiSuggestions:', analysis?.aiSuggestions);
        console.log('[AI-UI][AUDIT] analysis.suggestions:', analysis?.suggestions);
        console.log('[AI-UI][AUDIT] AI lengths:', {
            ai: analysis?.aiSuggestions?.length || 0,
            base: analysis?.suggestions?.length || 0
        });
        console.log('[AI-UI][AUDIT] Analysis completo:', {
            hasAnalysis: !!analysis,
            mode: analysis?.mode,
            status: analysis?.status,
            keys: analysis ? Object.keys(analysis).slice(0, 15) : []
        });
        
        // 🔄 ETAPA 2: Polling automático até status 'completed'
        // 🔧 CORREÇÃO: Permitir renderização se aiSuggestions existir, mesmo sem status
        
        // � EXTRAÇÃO ROBUSTA: Buscar aiSuggestions em todos os níveis possíveis
        const extractedAI = this.extractAISuggestions(analysis);
        console.log('%c📊 [STEP 2] Quantidade detectada:', 'color:#00FF88;font-weight:bold', extractedAI.length);
        console.log('[AI-FRONT][EXTRACT-RESULT] Extraídas:', extractedAI.length, 'sugestões');
        
        // 🔧 CORREÇÃO: Bypass de status se aiSuggestions existir
        const hasValidAISuggestions = Array.isArray(extractedAI) && extractedAI.length > 0;
        
        if (!analysis.status && !hasValidAISuggestions) {
            console.warn('%c[AI-FRONT][BYPASS] ⚠️ Status undefined e sem aiSuggestions - ignorando', 'color:#FF9500;');
            // Continua verificando outras condições
        } else if (!analysis.status && hasValidAISuggestions) {
            console.warn('%c[AI-FRONT][BYPASS] ✅ Status undefined mas aiSuggestions presente - continuando renderização', 'color:#00FF88;font-weight:bold;');
            analysis.status = 'completed'; // Força status para evitar bloqueios posteriores
        }
        
        // Se ainda está processando E não tem sugestões, aguardar
        if (analysis?.status === 'processing' && !hasValidAISuggestions) {
            if (retryCount >= 10) {
                console.error('[AI-FRONT] ❌ Timeout: 10 tentativas de polling excedidas');
                this.showLoadingState('Tempo limite excedido. Recarregue a página.');
                return;
            }
            
            console.log('[AI-FRONT] 🕐 IA ainda processando, tentando novamente em 3s...');
            console.log('[AI-FRONT] Tentativa:', retryCount + 1, '/ 10');
            
            // Exibir estado de loading
            this.showLoadingState('Aguardando análise da IA...');
            
            // Aguardar 3s e consultar novamente
            setTimeout(() => {
                console.log('[AI-FRONT] 🔄 Reconsultando análise após 3s...');
                
                // Buscar análise atualizada do backend
                const jobId = analysis?.id || analysis?.jobId;
                if (jobId) {
                    fetch(`/api/jobs/${jobId}`)
                        .then(res => res.json())
                        .then(updatedAnalysis => {
                            console.log('[AI-FRONT] 📥 Análise atualizada recebida:', {
                                status: updatedAnalysis.status,
                                aiSuggestions: updatedAnalysis.aiSuggestions?.length
                            });
                            this.checkForAISuggestions(updatedAnalysis, retryCount + 1);
                        })
                        .catch(err => {
                            console.error('[AI-FRONT] ❌ Erro ao reconsultar:', err);
                            this.showLoadingState('Erro ao consultar análise.');
                        });
                } else {
                    console.error('[AI-FRONT] ❌ ID do job não encontrado para polling');
                }
            }, 3000);
            
            return; // ✅ PARAR AQUI e aguardar
        }
        
        // 🧠 AUDITORIA COMPLETA: Log dos dados recebidos
        console.log('[AUDIT:AI-FRONT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[AUDIT:AI-FRONT] Objeto completo recebido:', {
            mode: analysis?.mode,
            status: analysis?.status,
            keys: analysis ? Object.keys(analysis).slice(0, 20) : [],
            aiSuggestions_direct: analysis?.aiSuggestions?.length,
            aiSuggestions_result: analysis?.result?.aiSuggestions?.length,
            aiSuggestions_data: analysis?.data?.aiSuggestions?.length,
            suggestions: analysis?.suggestions?.length
        });
        console.log('[AUDIT:AI-FRONT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // 🧠 Bypass inteligente: se já há sugestões, ignora o status "processing"
        if (Array.isArray(extractedAI) && extractedAI.length > 0) {
            console.log('%c[AI-FRONT][BYPASS] ✅ aiSuggestions detectadas — ignorando status "processing"', 'color:#00FF88;font-weight:bold;');
            
            // FIX: Resetar flag de render completado para nova análise
            window.__AI_RENDER_COMPLETED__ = false;
            
            // FIX: Atualizar lastAnalysisJobId ANTES da renderização (previne race condition)
            this.lastAnalysisJobId = analysis?.jobId || window.__CURRENT_JOB_ID__;
            this.lastAnalysisTimestamp = Date.now();
            console.log('%c[AI-FIX] 🔒 lastAnalysisJobId atualizado ANTES do render:', 'color:#00FF88;font-weight:bold;', this.lastAnalysisJobId);
            
            // 🧩 ETAPA 3 — GARANTIR QUE NÃO SAIA DO MODO "IA ENRIQUECIDA"
            analysis.hasEnriched = true;
            console.log('%c[AI-FRONT] 💜 Modo IA Enriquecida confirmado (%d sugestões)', 'color:#B279FF;font-weight:bold;', extractedAI.length);
            
            // 🧩 PARTE 4 — AUDITORIA FINAL DE RENDERIZAÇÃO
            console.groupCollapsed('%c[AI-FRONT][RENDER-AUDIT] 🎨 Auditoria Final de Renderização', 'color:#8F5BFF;font-weight:bold;');
            console.log('%c[RENDER-AUDIT] Quantidade de sugestões extraídas:', 'color:#00FF88;', extractedAI.length);
            console.log('%c[RENDER-AUDIT] Primeiro item:', 'color:#FFD700;', extractedAI[0]);
            console.groupEnd();
            
            // Garante que o spinner suma mesmo sem status "completed"
            if (this.elements.aiLoading) {
                this.elements.aiLoading.style.display = 'none';
                console.log('%c[AI-FRONT][SPINNER] 🟢 Ocultando spinner automaticamente', 'color:#FFD700;');
            }

            // ✅ EXTRAIR METRICS E TARGETS de analysis.data
            // Campos reais: analysis.data.metrics e analysis.data.genreTargets
            const metrics = analysis?.data?.metrics || null;
            const genreTargets = typeof getCorrectTargets === 'function' 
                ? getCorrectTargets(analysis) 
                : (analysis?.data?.genreTargets || null);
            
            if (!metrics) {
                console.error('[AI-UI][VALIDATION] ❌ analysis.data.metrics não encontrado');
                console.warn('[AI-UI][VALIDATION] ⚠️ Sugestões não serão validadas');
            }
            
            if (!genreTargets) {
                console.error('[AI-UI][VALIDATION] ❌ analysis.data.genreTargets não encontrado (POSTGRES)');
                console.warn('[AI-UI][VALIDATION] ⚠️ Sugestões não serão validadas - podem exibir valores incorretos');
                console.warn('[AI-UI][VALIDATION] analysis keys:', analysis ? Object.keys(analysis) : null);
                console.warn('[AI-UI][VALIDATION] analysis.data:', !!analysis?.data);
            }
            
            if (metrics && genreTargets) {
                console.log('[AI-UI][VALIDATION] ✅ Metrics e Targets encontrados');
                console.log('[AI-UI][VALIDATION] 📍 Fonte: analysis.data.metrics + analysis.data.genreTargets');
                console.log('[AI-UI][VALIDATION] Metrics:', {
                    loudness: metrics.loudness?.value,
                    truePeak: metrics.truePeak?.value,
                    dr: metrics.dr?.value,
                    stereo: metrics.stereo?.value
                });
                console.log('[AI-UI][VALIDATION] Targets:', {
                    lufs: genreTargets.lufs?.target,
                    truePeak: genreTargets.truePeak?.target,
                    dr: genreTargets.dr?.target,
                    stereo: genreTargets.stereo?.target
                });
            }

            // Renderiza com metrics e genreTargets para validação
            this.renderAISuggestions(extractedAI, genreTargets, metrics);
            
            // FIX: Marcar renderização como concluída APÓS render
            window.__AI_RENDER_COMPLETED__ = true;
            console.log('%c[AI-FIX] ✅ window.__AI_RENDER_COMPLETED__ = true', 'color:#00FF88;font-weight:bold;');
            
            // 🔍 AUDITORIA AUTOMÁTICA: Verificar estado após renderização
            console.group('%c[AUDITORIA:RESET-CHECK] 🔍 Estado após renderização', 'color:#FF9500;font-weight:bold;');
            console.log('   currentJobId:', window.__CURRENT_JOB_ID__);
            console.log('   referenceJobId:', window.__REFERENCE_JOB_ID__);
            console.log('   hasAISuggestions:', !!(extractedAI?.length));
            console.log('   aiSuggestionsLength:', extractedAI?.length || 0);
            console.log('   localStorageReference:', localStorage.getItem('referenceJobId'));
            console.log('   lastAnalysisJobId:', this.lastAnalysisJobId);
            console.log('   renderCompleted:', window.__AI_RENDER_COMPLETED__);
            console.log('   🔄 IDs são diferentes?', window.__CURRENT_JOB_ID__ !== this.lastAnalysisJobId ? '✅ Sim (correto)' : '⚠️ Não (possível cache)');
            console.groupEnd();
            
            return;
        }
        
        // 🚨 RENDERIZAÇÃO FORÇADA PARA DEBUG
        if (extractedAI.length > 0) {
            console.log('%c✅ [STEP 3] Sugestões detectadas, preparando renderização...', 'color:#00FF88;font-weight:bold');
            console.log('%c🧠 Primeira sugestão:', 'color:#FFD700', extractedAI[0]);
            
            // Tentar múltiplos seletores para encontrar o container
            const containerSelectors = [
                '#ai-suggestion-container',
                '.ai-suggestions-container',
                '#aiSuggestionsContainer',
                '.ai-content',
                '#ai-content'
            ];
            
            let container = null;
            for (const selector of containerSelectors) {
                container = document.querySelector(selector);
                if (container) {
                    console.log(`%c🎯 [DEBUG] Container encontrado com seletor: ${selector}`, 'color:#FFD700', container);
                    break;
                }
            }
            
            if (!container && this.elements?.aiContent) {
                container = this.elements.aiContent;
                console.log('%c🎯 [DEBUG] Usando this.elements.aiContent', 'color:#FFD700', container);
            }
            
            if (container) {
                // 🔥 RENDERIZAÇÃO FORÇADA MANUAL (COM SECURITY GUARD)
                console.log('%c🔥 [STEP 4-DEBUG] Tentando renderização forçada manual...', 'color:#FF4444;font-weight:bold');
                
                // 🔐 SECURITY GUARD: Proteger renderização de fallback
                const analysis = window.currentModalAnalysis || { analysisMode: 'full' };
                const isReducedMode = analysis && (
                    analysis.analysisMode === 'reduced' || 
                    analysis.plan === 'free' ||
                    analysis.isReduced === true
                );
                
                console.log('[FALLBACK-RENDER] 🔐 Security:', { isReducedMode, analysis });
                
                // Mapear categoria para métrica
                const metricKey = this.mapCategoryToMetric(extractedAI[0]);
                const canRender = !isReducedMode || (typeof shouldRenderRealValue === 'function' 
                    ? shouldRenderRealValue(metricKey, 'ai-suggestion', analysis)
                    : false);
                
                console.log('[FALLBACK-RENDER] 🔐 Decision:', { metricKey, canRender });
                
                // 🔒 SE BLOQUEADO: Usar apenas placeholder, NÃO acessar texto
                let problema, causa, solucao, plugin;
                
                if (!canRender) {
                    console.log('[FALLBACK-RENDER] 🔒 BLOCKED: Usando apenas placeholders');
                    const securePlaceholder = '<span class="blocked-value">🔒 Disponível no plano Pro</span>';
                    problema = securePlaceholder;
                    causa = securePlaceholder;
                    solucao = securePlaceholder;
                    plugin = securePlaceholder;
                } else {
                    console.log('[FALLBACK-RENDER] ✅ FULL MODE: Acessando texto real');
                    problema = extractedAI[0].problema || extractedAI[0].message || '—';
                    causa = extractedAI[0].causaProvavel || '—';
                    solucao = extractedAI[0].solucao || extractedAI[0].action || '—';
                    plugin = extractedAI[0].pluginRecomendado || '—';
                }
                
                const forcedHTML = `
                    <div class="ai-suggestion-card ${!canRender ? 'blocked-card' : ''}" style="
                        padding: 20px;
                        margin: 10px;
                        border: 2px solid #00FF88;
                        border-radius: 8px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    ">
                        <h3 style="margin: 0 0 15px 0; font-size: 18px;">
                            🎯 ${extractedAI[0].categoria || 'Sugestão Técnica'}
                        </h3>
                        <p style="margin: 10px 0;"><b>⚠️ Problema:</b> ${problema}</p>
                        <p style="margin: 10px 0;"><b>🔍 Causa:</b> ${causa}</p>
                        <p style="margin: 10px 0;"><b>🛠️ Solução:</b> ${solucao}</p>
                        <p style="margin: 10px 0;"><b>🔌 Plugin:</b> ${plugin}</p>
                        <p style="margin: 15px 0 0 0; font-size: 12px; opacity: 0.8;">
                            ${canRender ? '✅' : '🔒'} Renderizado em ${new Date().toLocaleTimeString()}
                        </p>
                    </div>
                `;
                
                container.innerHTML = forcedHTML;
                container.style.display = 'block';
                
                console.log('%c🟢 [STEP 4] Card renderizado manualmente com sucesso!', 'color:#00FF88;font-weight:bold;font-size:16px');
                console.timeEnd('⏱️ Tempo total até renderização');
                
                // Ocultar loading
                const loadingElements = document.querySelectorAll('.ai-loading, [class*="loading"], [class*="spinner"]');
                loadingElements.forEach(el => {
                    el.style.display = 'none';
                    el.classList.add('hidden');
                });
                
                console.log('%c🎉 RENDERIZAÇÃO FORÇADA COMPLETA - Monitorando por 5s...', 'color:#FFD700;font-weight:bold;font-size:14px');
                
                // Monitorar se algo limpa o container
                let cleanupAttempts = 0;
                const monitorInterval = setInterval(() => {
                    if (!container.innerHTML.includes('Renderizado manualmente')) {
                        cleanupAttempts++;
                        console.error(`%c🚨 [ALERTA] Container foi limpo! Tentativa: ${cleanupAttempts}`, 'color:#FF0000;font-weight:bold;font-size:14px');
                        console.trace('Stack trace do cleanup');
                    }
                }, 500);
                
                setTimeout(() => {
                    clearInterval(monitorInterval);
                    if (cleanupAttempts === 0) {
                        console.log('%c✅ [SUCESSO] Container mantido intacto por 5s', 'color:#00FF88;font-weight:bold');
                    } else {
                        console.error(`%c❌ [FALHA] Container foi limpo ${cleanupAttempts} vezes`, 'color:#FF0000;font-weight:bold');
                    }
                    console.groupEnd();
                }, 5000);
                
                return; // Parar aqui para não executar lógica normal
            } else {
                console.error('%c🚨 [ERRO] Container de IA não encontrado no DOM.', 'color:#FF0000;font-weight:bold');
                console.log('Seletores tentados:', containerSelectors);
                console.log('this.elements:', this.elements);
            }
        } else {
            console.warn('%c⚠️ [STEP 5] Nenhuma sugestão detectada', 'color:#FFA500;font-weight:bold', 'status:', analysis?.status);
        }
        
        // �🛡️ VALIDAÇÃO: Verificar se há aiSuggestions válidas e enriquecidas
        let suggestionsToUse = [];
        
        const hasValidAI = extractedAI.length > 0;
        const hasEnriched = hasValidAI && extractedAI.some(s => 
            s.aiEnhanced === true || s.enrichmentStatus === 'success'
        );
        
        console.log('[AI-FRONT][CHECK]', { 
            hasValidAI, 
            hasEnriched, 
            mode: analysis?.mode,
            count: extractedAI.length
        });
        
        if (hasValidAI && hasEnriched) {
            // ✅ Renderizar APENAS as sugestões da IA enriquecidas
            suggestionsToUse = extractedAI;
            console.log('[AI-FRONT] ✅ IA detectada, renderizando sugestões...');
            console.log('[AI-FRONT] 🟢 Renderizando', suggestionsToUse.length, 'cards de IA');
            
            // Ocultar loading state
            if (this.elements.aiSection) {
                this.elements.aiSection.style.display = 'block';
            }
            
            // ✅ RENDERIZAR sugestões IA (PATCH: passar genreTargets resolvido anteriormente)
            this.renderAISuggestions(suggestionsToUse, genreTargets);
            return; // ✅ PARAR AQUI
        } else if (hasValidAI && !hasEnriched) {
            // ⚠️ Tem aiSuggestions mas não estão enriquecidas
            console.warn('[AI-FRONT] ⚠️ aiSuggestions encontradas mas sem flag aiEnhanced');
            console.warn('[AI-FRONT] Renderizando mesmo assim (pode ser formato legado)');
            
            suggestionsToUse = extractedAI;
            this.renderAISuggestions(suggestionsToUse, genreTargets); // 🔧 PATCH: passar genreTargets
            return;
        } else {
            // 🚫 Evita fallback para métricas genéricas
            console.log('[AI-FRONT] ⚠️ Nenhuma IA válida detectada');
            console.log('[AI-FRONT] hasValidAI:', hasValidAI);
            console.log('[AI-FRONT] hasEnriched:', hasEnriched);
            console.log('[AI-FRONT] 🚫 Ocultando cards genéricos');
            
            // 🔧 CORREÇÃO CRÍTICA: Ocultar loading antes de retornar
            if (this.elements.aiLoading) {
                this.elements.aiLoading.style.display = 'none';
                console.log('[AI-FIX] ✅ Loading ocultado (sem sugestões válidas)');
            }
            
            // Ocultar seção de sugestões
            if (this.elements.aiSection) {
                this.elements.aiSection.style.display = 'none';
            }
            
            // Exibir estado de aguardo (se disponível)
            if (typeof this.displayWaitingForReferenceState === 'function') {
                this.displayWaitingForReferenceState();
            }
            
            return; // ✅ NÃO RENDERIZAR NADA
        }
    }
    
    /**
     * 🎨 Renderizar sugestões IA (UNIFIED - funciona com base e AI)
     * @param {Array} suggestions - Array de sugestões
     * @param {Object} genreTargets - Targets do gênero para validação
     */
    renderAISuggestions(suggestions, genreTargets = null, metrics = null) {
        // � ETAPA 1 — AUDITORIA DE RENDERIZAÇÃO VISUAL
        console.groupCollapsed('%c[AUDITORIA_RENDER] 🎨 Verificando Renderização de AI Cards', 'color:#8F5BFF;font-weight:bold;');
        console.log('%c[AI-RENDER-AUDIT] Sugestões recebidas:', 'color:#FFD700;', suggestions?.length);
        console.log('%c[AI-RENDER-AUDIT] Modo atual:', 'color:#00C9FF;', suggestions?.[0]?.aiEnhanced ? 'IA Enriquecida' : 'Base');
        console.log('%c[AI-RENDER-AUDIT] Container principal:', 'color:#00FF88;', this.elements.aiContent);
        console.log('%c[AI-RENDER-AUDIT] HTML antes do insert:', 'color:#FFA500;', this.elements.aiContent?.innerHTML?.slice(0, 120));
        console.groupEnd();
        
        // �🧠 PARTE 4: Proteção extra no renderizador
        if (!suggestions || suggestions.length === 0) {
            console.warn('%c[AI-FRONT][RENDER] ⚠️ Nenhuma sugestão recebida para renderizar', 'color:#FFA500;');
            return;
        }

        console.log('%c[AI-FRONT][RENDER] 🟢 Renderizando', 'color:#00FF88;', suggestions.length, 'sugestão(ões)');
        
        console.log('[AI-UI][RENDER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[AI-UI][RENDER] 🎨 INICIANDO RENDERIZAÇÃO');
        console.log('[AI-UI][RENDER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[AI-UI][RENDER] Container encontrado:', !!this.elements.aiSection);
        console.log('[AI-UI][RENDER] Sugestões recebidas:', suggestions?.length || 0);
        
        console.log('[AI-UI][RENDER] 🟢 Renderizando', suggestions.length, 'sugestão(ões)');
        console.log('[AI-UI][RENDER] Sample primeira sugestão:', {
            problema: suggestions[0]?.problema?.substring(0, 50) || suggestions[0]?.message?.substring(0, 50),
            categoria: suggestions[0]?.categoria,
            aiEnhanced: suggestions[0]?.aiEnhanced
        });
        
        if (!this.elements.aiSection || !this.elements.aiContent) {
            console.error('[AI-UI][RENDER] ❌ Elementos DOM não encontrados!');
            console.error('[AI-UI][RENDER] aiSection:', !!this.elements.aiSection);
            console.error('[AI-UI][RENDER] aiContent:', !!this.elements.aiContent);
            return;
        }
        
        this.currentSuggestions = suggestions;
        
        // Esconder loading
        if (this.elements.aiLoading) {
            this.elements.aiLoading.style.display = 'none';
        }
        
        // Mostrar seção principal
        this.elements.aiSection.style.display = 'block';
        this.elements.aiSection.classList.add('ai-fade-in');
        
        // Mostrar grid de conteúdo
        this.elements.aiContent.style.display = 'grid';
        
        // Verificar se são sugestões IA ou base
        const aiEnhancedCount = suggestions.filter(s => s.aiEnhanced === true).length;
        const isAIEnriched = aiEnhancedCount > 0;
        
        // 🧩 ETAPA 2 — CORREÇÃO DE TEMPLATE
        // 🚀 Forçar template correto se for IA enriquecida
        if (isAIEnriched || suggestions?.[0]?.aiEnhanced) {
            console.log('%c[AI-RENDER-FIX] 🔧 Modo IA Enriquecida detectado — forçando template AI', 'color:#00FF88;');
            this.currentTemplate = 'ai'; // força o template estilizado
        } else {
            console.log('%c[AI-RENDER-FIX] ⚠️ Modo genérico ativo (sem IA específica)', 'color:#FFA500;');
        }
        
        console.log('[AI-UI][RENDER] Tipo de sugestões:', {
            total: suggestions.length,
            aiEnhanced: aiEnhancedCount,
            isEnriched: isAIEnriched
        });
        
        // 🔒 Filtrar sugestões para Reduced Mode ANTES de atualizar status
        const analysis = window.currentModalAnalysis;
        const isReducedMode = analysis?.analysisMode === 'reduced' || analysis?.plan === 'free';
        const displayCount = isReducedMode 
            ? Math.min(suggestions.length, 2) // Máximo de 2 no modo reduced
            : suggestions.length;
        
        // Atualizar status com contagem correta
        if (isAIEnriched) {
            const statusText = isReducedMode 
                ? `${displayCount} sugestões disponíveis (modo gratuito)`
                : `${suggestions.length} sugestões IA enriquecidas`;
            this.updateStatus('success', statusText);
            console.log('[AI-UI][RENDER] ✅ Status:', statusText);
        } else {
            this.updateStatus('success', `${displayCount} sugestões disponíveis`);
            console.log('[AI-UI][RENDER] ✅ Status: Sugestões base');
        }
        
        // Atualizar modelo
        if (this.elements.aiModelBadge) {
            this.elements.aiModelBadge.textContent = isAIEnriched ? 'GPT-4O-MINI' : 'BASE';
        }
        
        // Renderizar cards
        this.renderSuggestionCards(suggestions, isAIEnriched, genreTargets);
        
        // 🧩 ETAPA 4 — FORÇAR REVALIDAÇÃO DE CLASSES NO DOM
        setTimeout(() => {
            const cards = this.elements.aiContent?.querySelectorAll('.ai-suggestion-card');
            console.log('%c[AI-RENDER-VERIFY] 🔍 Cards detectados no DOM:', 'color:#00FF88;', cards?.length);
            if (!cards || cards.length === 0) {
                console.warn('[AI-RENDER-VERIFY] ❌ Nenhum card detectado — revalidando template');
                this.currentTemplate = 'ai';
                this.renderSuggestionCards(suggestions, true, genreTargets); // força renderização IA
            } else {
                console.log('%c[AI-RENDER-VERIFY] ✅ Cards validados com sucesso!', 'color:#00FF88;');
                
                // FIX: Marcar renderização como DEFINITIVAMENTE concluída após validação DOM
                window.__AI_RENDER_COMPLETED__ = true;
                console.log('%c[AI-FIX] 🔒 Renderização validada e marcada como concluída', 'color:#00FF88;font-weight:bold;');
            }
        }, 300);
        
        console.log('[AI-UI][RENDER] ✅ Renderização concluída!');
        console.log('[AI-UI][RENDER] Cards renderizados:', this.elements.aiContent.children.length);
    }
    
    /**
     * 🔧 Normalizar nome de métrica para mapeamento consistente (FRONTEND)
     * Reconhece variações como "dynamicRange", "dynamic_range", "DR", "stereoCorrelation", etc.
     * @param {string} metricName - Nome bruto da métrica
     * @returns {string|null} Nome normalizado ou null
     */
    normalizeMetricNameForUI(metricName) {
        if (!metricName) return null;
        const key = String(metricName).toLowerCase().replace(/\s|_/g, "");

        if (key.includes("lufs")) return "lufs";
        if (key.includes("truepeak") || key.includes("dbtp") || key.includes("tp")) return "truePeak";
        if (key.includes("dynamicrange") || key === "dr") return "dr";
        if (key.includes("stereocorrelation") || key.includes("stereo")) return "stereo";

        return null;
    }
    
    /**
     * ✅ VALIDAR E CORRIGIR SUGESTÕES COM TARGETS REAIS
     * Garante que valores "ideal" exibidos correspondem aos targets do JSON
     * 🎯 USA EXCLUSIVAMENTE: analysis.data.genreTargets (Postgres)
     */
    validateAndCorrectSuggestions(suggestions, genreTargets) {
        if (!genreTargets || !Array.isArray(suggestions)) {
            console.warn('[AI-UI][VALIDATION] ⚠️ genreTargets não fornecido - validação ignorada');
            return suggestions;
        }
        
        console.log('[AI-UI][VALIDATION] 🔍 Validando', suggestions.length, 'sugestões contra targets reais (Postgres)');
        console.log('[AI-UI][VALIDATION] 📊 Estrutura genreTargets:', {
            hasLufs: !!genreTargets.lufs,
            hasTruePeak: !!genreTargets.truePeak,
            hasDr: !!genreTargets.dr,
            hasBands: !!genreTargets.bands,
            keys: Object.keys(genreTargets)
        });
        
        return suggestions.map(suggestion => {
            // 🔐 SECURITY NOTE: Este acesso é apenas para MAPEAMENTO de categoria,
            // NÃO para renderização. O texto nunca entra no DOM aqui.
            // Renderização real acontece em renderAIEnrichedCard/renderBaseSuggestionCard
            // que possuem Security Guard próprio.
            let metric = suggestion.metric || suggestion.category || this.guessMetricFromText(suggestion.problema || suggestion.message);
            
            // 🔧 Normalizar métrica (reconhece "dynamicRange", "stereoCorrelation", etc)
            const normalizedMetric = this.normalizeMetricNameForUI(metric);
            if (normalizedMetric) {
                metric = normalizedMetric;
                console.log('[AI-UI][VALIDATION] 🔧 Métrica normalizada:', suggestion.metric, '→', metric);
            }
            
            if (!metric || metric === 'info') {
                return suggestion; // Sugestões informativas não precisam validação
            }
            
            // 🔧 Obter target real do JSON usando EXCLUSIVAMENTE genreTargets (Postgres)
            let targetData = null;
            let realTarget = null;
            let realRange = null;
            
            // Tentar estrutura aninhada primeiro: genreTargets.lufs.target
            if (genreTargets[metric] && typeof genreTargets[metric] === 'object') {
                targetData = genreTargets[metric];
                realTarget = targetData.target_db || targetData.target;
                realRange = targetData.target_range;
            }
            // Tentar dentro de bands: genreTargets.bands.sub.target_db
            else if (genreTargets.bands && genreTargets.bands[metric]) {
                targetData = genreTargets.bands[metric];
                realTarget = targetData.target_db || targetData.target;
                realRange = targetData.target_range;
            }
            // Fallback: estrutura plana legada
            else if (typeof genreTargets[metric + '_target'] === 'number') {
                realTarget = genreTargets[metric + '_target'];
            }
            
            if (!realTarget && !realRange) {
                console.warn(`[AI-UI][VALIDATION] ⚠️ Target não encontrado para métrica "${metric}"`);
                return suggestion;
            }
            
            console.log(`[AI-UI][VALIDATION] ✅ Target encontrado para "${metric}":`, { realTarget, realRange });
            
            // Corrigir textos que mencionam valores "ideal" incorretos
            const correctedSuggestion = { ...suggestion };
            
            // Regex para encontrar padrões como "ideal: -14 dB" ou "target: -29 dB"
            const idealRegex = /(ideal|target|alvo|objetivo):\s*[-+]?\d+\.?\d*\s*(dB|LUFS)/gi;
            
            ['problema', 'message', 'causaProvavel', 'solucao', 'action'].forEach(field => {
                if (correctedSuggestion[field] && typeof correctedSuggestion[field] === 'string') {
                    const original = correctedSuggestion[field];
                    const corrected = original.replace(idealRegex, (match) => {
                        if (realTarget) {
                            return match.replace(/[-+]?\d+\.?\d*/, realTarget.toFixed(1));
                        }
                        return match; // Manter original se não tiver target
                    });
                    
                    if (original !== corrected) {
                        console.log(`[AI-UI][VALIDATION] 🔧 Corrigido "${metric}":`, {
                            original: original.substring(0, 60) + '...',
                            corrected: corrected.substring(0, 60) + '...'
                        });
                        correctedSuggestion[field] = corrected;
                    }
                }
            });
            
            // Adicionar badge de conformidade
            correctedSuggestion._validated = true;
            correctedSuggestion._realTarget = realTarget;
            correctedSuggestion._realRange = realRange;
            
            return correctedSuggestion;
        });
    }
    
    /**
     * 🔍 Inferir métrica do texto da sugestão
     */
    guessMetricFromText(text) {
        if (!text) return 'unknown';
        
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('lufs') || lowerText.includes('loudness')) return 'lufs';
        if (lowerText.includes('true peak') || lowerText.includes('truepeak')) return 'truePeak';
        if (lowerText.includes('dynamic range') || lowerText.includes('dr')) return 'dr';
        if (lowerText.includes('sub') || lowerText.includes('20-60')) return 'sub';
        if (lowerText.includes('bass') || lowerText.includes('60-150')) return 'bass';
        if (lowerText.includes('low mid') || lowerText.includes('150-500')) return 'lowMid';
        if (lowerText.includes('mid') && !lowerText.includes('high')) return 'mid';
        if (lowerText.includes('high mid') || lowerText.includes('2-5khz')) return 'highMid';
        if (lowerText.includes('presença') || lowerText.includes('presence')) return 'presenca';
        if (lowerText.includes('brilho') || lowerText.includes('air')) return 'brilho';
        
        return 'unknown';
    }
    
    /**
     * 🔧 NOVO: Construir mensagem de problema padrão baseada em BaseSuggestion
     * @param {Object} suggestion - Objeto BaseSuggestion
     * @returns {string} Mensagem de problema formatada
     */
    buildDefaultProblemMessage(suggestion) {
        const { label, value, target, delta, direction, severity } = suggestion;
        
        if (!label || !Number.isFinite(value) || !Number.isFinite(target)) {
            return suggestion.observation || suggestion.message || 'Problema não especificado';
        }
        
        const valueStr = value.toFixed(1);
        const targetStr = target.toFixed(1);
        const deltaStr = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
        
        let intensifier = '';
        if (severity === 'critical') intensifier = 'muito ';
        else if (severity === 'warning') intensifier = 'levemente ';
        
        const directionText = direction === 'high' ? 'alto' : direction === 'low' ? 'baixo' : 'adequado';
        
        if (direction === 'ok') {
            return `${label} dentro do range esperado: ${valueStr} dB (alvo: ${targetStr} dB)`;
        }
        
        return `${label} ${intensifier}${directionText}: ${valueStr} dB (alvo: ${targetStr} dB, diferença: ${deltaStr} dB)`;
    }

    /**
     * 🔧 NOVO: Construir mensagem de solução padrão baseada em BaseSuggestion
     * @param {Object} suggestion - Objeto BaseSuggestion
     * @returns {string} Mensagem de solução formatada
     */
    buildDefaultSolutionMessage(suggestion) {
        const { label, delta, direction } = suggestion;
        
        if (!label || !Number.isFinite(delta) || direction === 'ok') {
            return suggestion.recommendation || suggestion.action || 'Mantenha os ajustes atuais';
        }
        
        const absDelta = Math.abs(delta);
        const adjustmentDb = Math.min(absDelta, 6).toFixed(1);
        const actionVerb = direction === 'high' ? 'Reduza' : 'Aumente';
        
        return `${actionVerb} aproximadamente ${adjustmentDb} dB em ${label} com EQ suave.`;
    }
    
    /**
     * � Filtrar sugestões para Reduced Mode
     * Apenas "Estéreo" e "Dinâmica" são renderizadas
     * @param {Array} suggestions - Array de sugestões
     * @returns {Array} Sugestões filtradas
     */
    filterReducedModeSuggestions(suggestions) {
        // Verificar se analysis está em modo reduced
        const analysis = window.currentModalAnalysis;
        const isReducedMode = analysis?.analysisMode === 'reduced' || analysis?.plan === 'free';
        
        if (!isReducedMode) {
            console.log('[REDUCED-FILTER] ✅ Modo completo - todas as sugestões permitidas');
            return suggestions;
        }
        
        console.log('[REDUCED-FILTER] 🔒 Modo Reduced detectado - filtrando sugestões...');
        console.log('[REDUCED-FILTER] Total de sugestões:', suggestions.length);
        
        // 🔐 Usar Security Guard para decisão de filtragem
        const filtered = suggestions.filter(suggestion => {
            // Mapear categoria para métrica
            const metricKey = this.mapCategoryToMetric(suggestion);
            
            // Usar Security Guard para verificar se pode renderizar
            const canRender = typeof shouldRenderRealValue === 'function'
                ? shouldRenderRealValue(metricKey, 'ai-suggestion', analysis)
                : true;
            
            if (canRender) {
                console.log('[REDUCED-FILTER] ✅ Sugestão permitida:', suggestion.categoria || suggestion.category || suggestion.label);
            } else {
                console.log('[REDUCED-FILTER] 🚫 Sugestão bloqueada:', suggestion.categoria || suggestion.category || suggestion.label);
            }
            
            return canRender;
        });
        
        console.log('[REDUCED-FILTER] 📊 Resultado: ', filtered.length, '/', suggestions.length, 'sugestões renderizadas');
        
        return filtered;
    }
    
    /**
     * 📋 Renderizar cards de sugestões (UNIFIED)
     */
    renderSuggestionCards(suggestions, isAIEnriched = false, genreTargets = null) {
        if (!this.elements.aiContent) return;
        
        console.log('[AI-UI][RENDER] 📋 Renderizando', suggestions.length, 'cards');
        console.log('[AI-UI][RENDER] Modo:', isAIEnriched ? 'IA Enriquecida' : 'Base');
        console.log('[AI-UI][RENDER] genreTargets:', genreTargets ? 'presente' : 'ausente');
        
        // 🔒 FILTRAR SUGESTÕES PARA REDUCED MODE (antes da validação)
        const filteredSuggestions = this.filterReducedModeSuggestions(suggestions);
        
        if (filteredSuggestions.length === 0) {
            console.warn('[AI-UI][RENDER] ⚠️ Nenhuma sugestão após filtragem Reduced Mode');
            // Exibir mensagem de upgrade
            this.elements.aiContent.innerHTML = `
                <div class="ai-reduced-notice" style="
                    padding: 24px;
                    text-align: center;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-radius: 12px;
                    margin: 20px 0;
                ">
                    <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
                    <h3 style="margin: 0 0 12px 0;">Sugestões IA Limitadas</h3>
                    <p style="margin: 0; opacity: 0.9;">
                        No plano gratuito, você tem acesso apenas às sugestões de <b>Estéreo</b> e <b>Dinâmica</b>.
                        Faça upgrade para acessar todas as sugestões técnicas avançadas.
                    </p>
                    <button style="
                        margin-top: 20px;
                        padding: 12px 24px;
                        background: white;
                        color: #667eea;
                        border: none;
                        border-radius: 8px;
                        font-weight: bold;
                        cursor: pointer;
                    " onclick="window.location.href='/planos.html'">
                        Ver Planos
                    </button>
                </div>
            `;
            return;
        }
        
        // ✅ VALIDAR SUGESTÕES CONTRA TARGETS REAIS
        const validatedSuggestions = this.validateAndCorrectSuggestions(filteredSuggestions, genreTargets);
        
        // 🔐 RENDERIZAR COM CREATEELEMENT (NÃO innerHTML)
        console.log('[AI-UI][RENDER] 🔐 Renderizando com createElement');
        
        // Limpar conteúdo existente
        this.elements.aiContent.innerHTML = '';
        
        // Renderizar cada card e adicionar ao DOM
        validatedSuggestions.forEach((suggestion, index) => {
            let cardElement;
            
            if (isAIEnriched) {
                cardElement = this.renderAIEnrichedCard(suggestion, index, genreTargets);
            } else {
                cardElement = this.renderBaseSuggestionCard(suggestion, index, genreTargets);
            }
            
            // ✅ appendChild (NÃO innerHTML)
            this.elements.aiContent.appendChild(cardElement);
        });
        
        console.log('[AI-UI][RENDER] ✅ Cards inseridos no DOM com appendChild');
    }
    
    /**
     * 🔐 Mapear categoria de sugestão para métrica do Security Guard
     */
    mapCategoryToMetric(suggestion) {
        const categoria = (suggestion.categoria || suggestion.category || '').toLowerCase();
        const problema = (suggestion.problema || suggestion.message || '').toLowerCase();
        const texto = `${categoria} ${problema}`;
        
        console.log('[SECURITY-MAP] 🔍 Mapeando categoria:', { categoria, problema, texto });
        
        // Mapeamento de palavras-chave para métricas
        if (texto.includes('loudness') || texto.includes('lufs')) {
            console.log('[SECURITY-MAP] ✅ Detectado: LUFS (bloqueado)');
            return 'lufs';
        }
        if (texto.includes('true peak') || texto.includes('truepeak') || texto.includes('tp')) {
            console.log('[SECURITY-MAP] ✅ Detectado: True Peak (bloqueado)');
            return 'truePeak';
        }
        if (texto.includes('lra') || texto.includes('loudness range')) {
            console.log('[SECURITY-MAP] ✅ Detectado: LRA (bloqueado)');
            return 'lra';
        }
        if (texto.includes('dr') || texto.includes('dinâmica') || texto.includes('dynamic')) {
            console.log('[SECURITY-MAP] ✅ Detectado: DR (liberado)');
            return 'dr';
        }
        if (texto.includes('estéreo') || texto.includes('stereo') || texto.includes('correlação')) {
            console.log('[SECURITY-MAP] ✅ Detectado: Estéreo (liberado)');
            return 'stereo';
        }
        if (texto.includes('sub') || texto.includes('20-60')) {
            console.log('[SECURITY-MAP] ✅ Detectado: Sub (bloqueado)');
            return 'band_sub';
        }
        if (texto.includes('bass') || texto.includes('60-150') || texto.includes('graves')) {
            console.log('[SECURITY-MAP] ✅ Detectado: Bass (bloqueado)');
            return 'band_bass';
        }
        if (texto.includes('low mid') || texto.includes('150-500') || texto.includes('lowmid')) {
            console.log('[SECURITY-MAP] ✅ Detectado: Low Mid (liberado)');
            return 'band_lowMid';
        }
        if (texto.includes('mid') && !texto.includes('low') && !texto.includes('high')) {
            console.log('[SECURITY-MAP] ✅ Detectado: Mid (bloqueado)');
            return 'band_mid';
        }
        if (texto.includes('high mid') || texto.includes('500-2k') || texto.includes('highmid')) {
            console.log('[SECURITY-MAP] ✅ Detectado: High Mid (liberado)');
            return 'band_highMid';
        }
        if (texto.includes('presença') || texto.includes('presence') || texto.includes('2k-5k')) {
            console.log('[SECURITY-MAP] ✅ Detectado: Presença (liberado)');
            return 'band_presence';
        }
        if (texto.includes('brilho') || texto.includes('air') || texto.includes('5k+')) {
            console.log('[SECURITY-MAP] ✅ Detectado: Brilho/Air (bloqueado)');
            return 'band_air';
        }
        
        console.log('[SECURITY-MAP] ⚠️ Categoria não mapeada - usando general');
        return 'general';
    }
    
    /**
     * 🎴 Renderizar card de sugestão IA enriquecida
     */
    renderAIEnrichedCard(suggestion, index, genreTargets = null) {
        const categoria = suggestion.categoria || suggestion.category || 'Geral';
        const nivel = suggestion.nivel || suggestion.priority || 'média';
        
        // � SECURITY GUARD: Verificar se deve renderizar conteúdo real
        // 🔐 SECURITY GUARD: Mapear categoria para métrica
        const metricKey = this.mapCategoryToMetric(suggestion);
        const analysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__ || { analysisMode: 'full' };
        
        console.log('[AI-CARD] 🔐 Security Check:', { 
            categoria, 
            metricKey, 
            analysisMode: analysis?.analysisMode
        });
        
        // 🔐 DETERMINAR MODO DE ANÁLISE
        const analysisMode = analysis?.analysisMode || 'full';
        const isReduced = analysisMode === 'reduced';
        
        // 🔐 NORMALIZAR DADOS ANTES DE RENDERIZAR
        // Se reduced: content = null (NUNCA passar texto real)
        // Se full: content = texto real
        const normalized = this.normalizeSuggestionForRender(suggestion, analysisMode);
        
        console.log('[AI-CARD] 🔐 Normalized:', { 
            isReduced, 
            hasBlocked: normalized.__blocked,
            problema: normalized.problema === null ? 'NULL' : 'EXISTS'
        });
        
        // 🔒 SE BLOQUEADO: Card sem texto no DOM
        if (normalized.__blocked) {
            console.log('[AI-CARD] 🔒 BLOCKED: Card sem texto (estrutura + placeholder)');
            
            return `
                <div class="ai-suggestion-card ai-enriched blocked-card" style="animation-delay: ${index * 0.1}s" data-index="${index}" data-blocked="true">
                    <div class="ai-suggestion-header">
                        <span class="ai-suggestion-category">${categoria}</span>
                        <div class="ai-suggestion-priority ${this.getPriorityClass(nivel)}">${nivel}</div>
                    </div>
                    <div class="ai-suggestion-content">
                        ${this.renderSuggestionBlock({
                            type: 'problem',
                            content: normalized.problema,
                            analysisMode: analysisMode,
                            title: '⚠️ Problema',
                            blockClass: 'ai-block-problema'
                        })}
                        ${this.renderSuggestionBlock({
                            type: 'cause',
                            content: normalized.causaProvavel,
                            analysisMode: analysisMode,
                            title: '🎯 Causa Provável',
                            blockClass: 'ai-block-causa'
                        })}
                        ${this.renderSuggestionBlock({
                            type: 'solution',
                            content: normalized.solucao,
                            analysisMode: analysisMode,
                            title: '🛠️ Solução',
                            blockClass: 'ai-block-solucao'
                        })}
                        ${this.renderSuggestionBlock({
                            type: 'plugin',
                            content: normalized.pluginRecomendado,
                            analysisMode: analysisMode,
                            title: '🎛️ Plugin',
                            blockClass: 'ai-block-plugin'
                        })}
                    </div>
                    <div class="ai-pro-badge"></div>
                </div>
            `;
        }
        
        // ✅ FULL MODE: Renderizar com texto real
        console.log('[AI-CARD] ✅ FULL: Texto completo');
        
        const problema = suggestion.problema || 
                        (suggestion.aiEnhanced === false && suggestion.observation 
                            ? this.buildDefaultProblemMessage(suggestion)
                            : suggestion.message || 'Problema não especificado');
        
        const causaProvavel = suggestion.causaProvavel || 'Causa não analisada';
        
        const solucao = suggestion.solucao || 
                       (suggestion.aiEnhanced === false && suggestion.recommendation
                           ? this.buildDefaultSolutionMessage(suggestion)
                           : suggestion.action || 'Solução não especificada');
        
        const plugin = suggestion.pluginRecomendado || 'Não especificado';
        const dica = suggestion.dicaExtra || null;
        const parametros = suggestion.parametros || null;
        
        // Badge de validação
        const isValidated = suggestion._validated === true;
        const realTarget = suggestion._realTarget;
        const validationBadge = (isValidated && realTarget !== undefined) 
            ? `<div class="ai-validation-badge" title="Target validado: ${realTarget.toFixed(1)} dB">✓ Validado</div>` 
            : '';
        
        return `
            <div class="ai-suggestion-card ai-enriched ai-new ${isValidated ? 'validated' : ''}" style="animation-delay: ${index * 0.1}s" data-index="${index}">
                <div class="ai-suggestion-header">
                    <span class="ai-suggestion-category">${categoria}</span>
                    <div class="ai-suggestion-priority ${this.getPriorityClass(nivel)}">${nivel}</div>
                    ${validationBadge}
                </div>
                
                <div class="ai-suggestion-content">
                    ${this.renderSuggestionBlock({
                        type: 'problem',
                        content: problema,
                        analysisMode: 'full',
                        title: '⚠️ Problema',
                        blockClass: 'ai-block-problema'
                    })}
                    ${this.renderSuggestionBlock({
                        type: 'cause',
                        content: causaProvavel,
                        analysisMode: 'full',
                        title: '🎯 Causa Provável',
                        blockClass: 'ai-block-causa'
                    })}
                    ${this.renderSuggestionBlock({
                        type: 'solution',
                        content: solucao,
                        analysisMode: 'full',
                        title: '🛠️ Solução',
                        blockClass: 'ai-block-solucao'
                    })}
                    ${this.renderSuggestionBlock({
                        type: 'plugin',
                        content: plugin,
                        analysisMode: 'full',
                        title: '🎛️ Plugin Recomendado',
                        blockClass: 'ai-block-plugin'
                    })}
                    
                    ${dica ? this.renderSuggestionBlock({
                        type: 'tip',
                        content: dica,
                        analysisMode: 'full',
                        title: '💡 Dica Extra',
                        blockClass: 'ai-block-dica'
                    }) : ''}
                    
                    ${parametros ? this.renderSuggestionBlock({
                        type: 'parameters',
                        content: parametros,
                        analysisMode: 'full',
                        title: '⚙️ Parâmetros',
                        blockClass: 'ai-block-parametros'
                    }) : ''}
                </div>
                
                <div class="ai-enrichment-badge">
                    <span class="ai-badge-icon">🤖</span>
                    <span class="ai-badge-text">Enriquecido por IA</span>
                </div>
            </div>
        `;
    }
    
    /**
     * 🎴 Renderizar card de sugestão base
     */
    renderBaseSuggestionCard(suggestion, index, genreTargets = null) {
        // 🔐 DETERMINAR MODO DE ANÁLISE
        const analysis = window.currentModalAnalysis || window.currentAnalysisData || null;
        const analysisMode = analysis?.analysisMode || 'full';
        
        console.log('[AI-BASE-CARD] 🔐 Mode:', { analysisMode });
        
        const category = suggestion.category || suggestion.type || 'Geral';
        const priority = suggestion.priority || 5;
        
        // 🔐 NORMALIZAR DADOS
        const normalized = this.normalizeSuggestionForRender(suggestion, analysisMode);
        
        // 🔒 SE BLOQUEADO: Card sem texto no DOM
        if (normalized.__blocked) {
            console.log('[AI-BASE-CARD] 🔒 BLOCKED: Card sem texto (estrutura + placeholder)');
            
            return `
                <div class="ai-suggestion-card ai-base blocked-card" style="animation-delay: ${index * 0.1}s" data-index="${index}" data-blocked="true">
                    <div class="ai-suggestion-header">
                        <span class="ai-suggestion-category">${category}</span>
                        <div class="ai-suggestion-priority ${this.getPriorityClass(priority)}">${priority}</div>
                    </div>
                    
                    <div class="ai-suggestion-content">
                        ${this.renderSuggestionBlock({
                            type: 'observation',
                            content: normalized.message,
                            analysisMode: analysisMode,
                            title: '⚠️ Observação',
                            blockClass: 'ai-block-problema'
                        })}
                        ${this.renderSuggestionBlock({
                            type: 'recommendation',
                            content: normalized.action,
                            analysisMode: analysisMode,
                            title: '🛠️ Recomendação',
                            blockClass: 'ai-block-solucao'
                        })}
                    </div>
                    
                    <div class="ai-base-notice">💡 Configure API Key OpenAI</div>
                </div>
            `;
        }
        
        // ✅ MODO FULL: Renderizar com texto real
        console.log('[AI-BASE-CARD] ✅ FULL: Renderizando texto completo');
        
        const message = suggestion.message || suggestion.title || 'Mensagem não especificada';
        const action = suggestion.action || suggestion.description || 'Ação não especificada';
        
        // Badge de validação
        const isValidated = suggestion._validated === true;
        const realTarget = suggestion._realTarget;
        const validationBadge = (isValidated && realTarget !== undefined) 
            ? `<div class="ai-validation-badge" title="Target validado: ${realTarget.toFixed(1)} dB">✓ Validado</div>` 
            : '';
        
        return `
            <div class="ai-suggestion-card ai-base ai-new ${isValidated ? 'validated' : ''}" style="animation-delay: ${index * 0.1}s" data-index="${index}">
                <div class="ai-suggestion-header">
                    <span class="ai-suggestion-category">${category}</span>
                    <div class="ai-suggestion-priority ${this.getPriorityClass(priority)}">${priority}</div>
                    ${validationBadge}
                </div>
                
                <div class="ai-suggestion-content">
                    ${this.renderSuggestionBlock({
                        type: 'observation',
                        content: message,
                        analysisMode: 'full',
                        title: '⚠️ Observação',
                        blockClass: 'ai-block-problema'
                    })}
                    ${this.renderSuggestionBlock({
                        type: 'recommendation',
                        content: action,
                        analysisMode: 'full',
                        title: '🛠️ Recomendação',
                        blockClass: 'ai-block-solucao'
                    })}
                </div>
                
                <div class="ai-base-notice">
                    💡 Configure API Key OpenAI para análise inteligente
                </div>
            </div>
        `;
    }
    
    /**
     * � Exibir estado de espera para faixa de referência
     */
    displayWaitingForReferenceState() {
        if (!this.elements.aiSection || !this.elements.aiContent) {
            console.warn('[UI-GUARD] ⚠️ Elementos aiSection/aiContent não encontrados');
            return;
        }
        
        console.log('[UI-GUARD] 🎧 Exibindo estado de espera para comparação');
        
        this.elements.aiSection.style.display = 'block';
        this.elements.aiContent.innerHTML = `
            <div style="
                grid-column: 1 / -1;
                text-align: center;
                padding: 60px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 16px;
                color: white;
            ">
                <div style="font-size: 64px; margin-bottom: 20px;">🎵</div>
                <h3 style="font-size: 24px; margin: 0 0 16px 0; font-weight: 600;">
                    Análise Base Concluída
                </h3>
                <p style="font-size: 16px; margin: 0 0 24px 0; opacity: 0.9;">
                    Esta é a faixa de referência (A).
                </p>
                <p style="font-size: 16px; margin: 0 0 12px 0; font-weight: 500;">
                    Para ver sugestões comparativas:
                </p>
                <ol style="
                    display: inline-block;
                    text-align: left;
                    font-size: 15px;
                    line-height: 1.8;
                    margin: 0 0 24px 0;
                    padding-left: 20px;
                ">
                    <li>Envie uma segunda faixa (B) para comparação</li>
                    <li>Selecione esta análise como referência</li>
                    <li>A IA gerará sugestões detalhadas A vs B</li>
                </ol>
                <div style="
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 24px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                ">
                    <span>💡</span>
                    <span>Aguardando comparação</span>
                </div>
            </div>
        `;
    }
    
    /**
     * �🎨 DEPRECATED: Método antigo mantido para compatibilidade
     */
    displayAISuggestions(suggestions, analysis) {
        console.warn('[AI-UI] displayAISuggestions() DEPRECATED - use renderAISuggestions()');
        this.renderAISuggestions(suggestions);
    }
    
    /**
     * 🎨 DEPRECATED: Método antigo mantido para compatibilidade
     */
    displayBaseSuggestions(suggestions, analysis) {
        console.warn('[AI-UI] displayBaseSuggestions() DEPRECATED - use renderAISuggestions()');
        this.renderAISuggestions(suggestions);
    }
    
    /**
     * 📋 DEPRECATED: Método antigo mantido para compatibilidade
     */
    renderCompactPreview(suggestions, isBaseSuggestions = false) {
        console.warn('[AI-UI] renderCompactPreview() DEPRECATED - use renderSuggestionCards()');
        this.renderSuggestionCards(suggestions, !isBaseSuggestions);
    }
    
    /**
     * 💡 Adicionar prompt de configuração para sugestões base
     */
    addConfigPrompt() {
        if (!this.elements.aiContent) return;
        
        const configPrompt = document.createElement('div');
        configPrompt.className = 'ai-config-prompt';
        configPrompt.innerHTML = `
            <div class="ai-config-message">
                <span class="ai-config-icon">🚀</span>
                <div class="ai-config-text">
                    <strong>Quer sugestões mais inteligentes?</strong>
                    <p>Configure sua API Key da OpenAI para receber análises detalhadas com IA</p>
                </div>
                <button class="action-btn primary" onclick="aiUIController.showQuickConfig()">
                    ⚙️ Configurar IA
                </button>
            </div>
        `;
        
        this.elements.aiContent.appendChild(configPrompt);
    }
    
    /**
     * 🔘 Adicionar botão de expandir
     */
    addExpandButton() {
        if (!this.elements.aiContent) return;
        
        const expandBtn = document.createElement('button');
        expandBtn.className = 'action-btn secondary ai-expand-btn';
        expandBtn.innerHTML = '🔍 Ver Detalhes Completos';
        expandBtn.onclick = () => this.openFullModal();
        
        this.elements.aiContent.appendChild(expandBtn);
    }
    
    /**
     * 🖥️ Abrir modal em tela cheia
     */
    openFullModal() {
        if (!this.elements.fullModal || !this.currentSuggestions.length) return;
        
        // Renderizar conteúdo completo
        this.renderFullSuggestions(this.currentSuggestions);
        
        // Exibir modal
        this.elements.fullModal.style.display = 'flex';
        setTimeout(() => {
            this.elements.fullModal.classList.add('show');
        }, 10);
        
        this.isFullModalOpen = true;
        document.body.style.overflow = 'hidden';
        
        // Atualizar estatísticas
        this.updateFullModalStats();
        
        console.log('🖥️ [AI-UI] Modal full aberto');
    }
    
    /**
     * ❌ Fechar modal em tela cheia
     */
    closeFullModal() {
        if (!this.elements.fullModal) return;
        
        this.elements.fullModal.classList.remove('show');
        setTimeout(() => {
            this.elements.fullModal.style.display = 'none';
        }, 300);
        
        this.isFullModalOpen = false;
        document.body.style.overflow = '';
        
        console.log('❌ [AI-UI] Modal full fechado');
    }
    
    /**
     * 🎯 Renderizar sugestões completas no modal
     */
    renderFullSuggestions(suggestions) {
        if (!this.elements.fullModalContent) return;
        
        const gridHtml = suggestions.map((suggestion, index) => {
            return this.renderFullSuggestionCard(suggestion, index);
        }).join('');
        
        this.elements.fullModalContent.innerHTML = `
            <div class="ai-suggestions-grid">
                ${gridHtml}
            </div>
        `;
    }
    
    /**
     * 🎴 Renderizar card completo de sugestão
     */
    renderFullSuggestionCard(suggestion, index) {
        // 🔐 SECURITY GUARD: Verificar modo PRIMEIRO
        const metricKey = this.mapCategoryToMetric(suggestion);
        const analysis = window.currentModalAnalysis || { analysisMode: 'full' };
        
        const canRender = typeof shouldRenderRealValue === 'function' 
            ? shouldRenderRealValue(metricKey, 'ai-suggestion', analysis)
            : true;
        
        console.log('[AI-FULL-CARD] 🔐 Decision:', { metricKey, canRender, mode: analysis?.analysisMode });
        
        // 🔒 SE BLOQUEADO: Return placeholder SEM acessar ai_blocks
        if (!canRender) {
            console.log('[AI-FULL-CARD] 🔒 BLOCKED: Placeholder estático');
            const category = suggestion.ai_category || 'geral';
            const priority = suggestion.ai_priority || 5;
            
            return `
                <div class="ai-suggestion-card blocked-card" style="animation-delay: ${index * 0.1}s">
                    <span class="ai-suggestion-category">${category}</span>
                    <div class="ai-suggestion-priority ${this.getPriorityClass(priority)}">${priority}</div>
                    
                    <div class="ai-suggestion-blocks">
                        <div class="ai-block blocked-block">
                            <div class="ai-block-title">⚠️ Conteúdo</div>
                            <div class="ai-block-content"><span class="blocked-value">🔒 Disponível no plano Pro</span></div>
                        </div>
                    </div>
                    
                    <div class="ai-pro-badge">⭐ Plano Pro</div>
                </div>
            `;
        }
        
        // ✅ FULL MODE: Acessa ai_blocks normalmente
        console.log('[AI-FULL-CARD] ✅ FULL: Texto completo');
        
        const category = suggestion.ai_category || 'geral';
        const priority = suggestion.ai_priority || 5;
        const blocks = suggestion.ai_blocks || {};
        const technical = suggestion.ai_technical_details || {};
        
        const blocksHtml = Object.entries(blocks).map(([key, content]) => {
            const icons = {
                problema: '⚠️',
                causa: '🎯',
                solucao: '🛠️',
                dica: '💡'
            };
            
            return `
                <div class="ai-block ai-block-${key}">
                    <div class="ai-block-title">${icons[key] || '📝'} ${key.charAt(0).toUpperCase() + key.slice(1)}</div>
                    <div class="ai-block-content">${content}</div>
                </div>
            `;
        }).join('');
        
        const technicalHtml = technical.tools_suggested ? `
            <div class="ai-technical-details">
                <div class="ai-tech-row">
                    <span class="ai-tech-label">Dificuldade:</span>
                    <span class="ai-tech-value">${technical.difficulty || 'Intermediário'}</span>
                </div>
                ${technical.frequency_range ? `
                    <div class="ai-tech-row">
                        <span class="ai-tech-label">Frequência:</span>
                        <span class="ai-tech-value">${technical.frequency_range}</span>
                    </div>
                ` : ''}
                <div class="ai-tools-list">
                    ${technical.tools_suggested.map(tool => `
                        <span class="ai-tool-tag">${tool}</span>
                    `).join('')}
                </div>
            </div>
        ` : '';
        
        return `
            <div class="ai-suggestion-card ai-new" style="animation-delay: ${index * 0.1}s">
                <span class="ai-suggestion-category">${category}</span>
                <div class="ai-suggestion-priority ${this.getPriorityClass(priority)}">${priority}</div>
                
                <div class="ai-suggestion-blocks">
                    ${blocksHtml}
                </div>
                
                ${technicalHtml}
            </div>
        `;
    }
    
    /**
     * 📊 Atualizar estatísticas do modal
     */
    updateFullModalStats() {
        if (this.elements.aiStatsCount) {
            this.elements.aiStatsCount.textContent = this.currentSuggestions.length;
        }
        
        if (this.elements.aiStatsModel && window.aiSuggestionLayer) {
            this.elements.aiStatsModel.textContent = window.aiSuggestionLayer.model.toUpperCase();
        }
        
        if (this.elements.aiStatsTime && window.aiSuggestionLayer) {
            const stats = window.aiSuggestionLayer.getStats();
            this.elements.aiStatsTime.textContent = `${stats.averageResponseTime.toFixed(0)}ms`;
        }
    }
    
    /**
     * 🎯 Obter classe CSS para prioridade
     */
    getPriorityClass(priority) {
        if (priority >= 8) return 'high';
        if (priority >= 5) return 'medium';
        return 'low';
    }
    
    /**
     * 📱 Atualizar status da IA
     */
    updateStatus(type, message) {
        console.log('[AI-STATUS] Atualizando status:', { type, message });
        
        if (!this.elements.aiStatusBadge) {
            console.warn('[AI-STATUS] ⚠️ aiStatusBadge não encontrado');
            return;
        }
        
        // Buscar elementos filhos (se existirem)
        const statusDot = this.elements.aiStatusBadge.querySelector('.ai-status-dot');
        const statusText = this.elements.aiStatusBadge.querySelector('.ai-status-text');
        
        console.log('[AI-STATUS] Elementos encontrados:', {
            statusDot: !!statusDot,
            statusText: !!statusText
        });
        
        // Remover classes anteriores
        this.elements.aiStatusBadge.className = 'ai-status-indicator ' + type;
        
        // Atualizar dot (se existir)
        if (statusDot) {
            // Classes de cor para o dot
            const dotClasses = {
                processing: 'pulsing',
                success: 'success',
                error: 'error',
                disabled: 'disabled'
            };
            statusDot.className = 'ai-status-dot ' + (dotClasses[type] || '');
        }
        
        // Atualizar texto (se existir)
        if (statusText) {
            statusText.textContent = message;
        }
        
        console.log('[AI-STATUS] ✅ Status atualizado para:', type);
    }
    
    /**
     * 🏷️ Atualizar badge do modelo
     */
    updateModelBadge() {
        if (!this.elements.aiModelBadge || !window.aiSuggestionLayer) return;
        
        this.elements.aiModelBadge.textContent = window.aiSuggestionLayer.model.toUpperCase();
    }
    
    /**
     * 🙈 Ocultar seção de IA
     */
    hideAISection() {
        if (this.elements.aiSection) {
            this.elements.aiSection.style.display = 'none';
        }
    }
    
    /**
     * 📭 Exibir estado vazio com mensagem amigável
     */
    displayEmptySuggestionsState() {
        console.log('[AI-SUGGESTIONS] 📭 Exibindo estado vazio com mensagem amigável');
        
        if (!this.elements.aiSection || !this.elements.aiContent) {
            console.error('[AI-SUGGESTIONS] ❌ Elementos DOM não encontrados para estado vazio');
            return;
        }
        
        // Esconder loading
        if (this.elements.aiLoading) {
            this.elements.aiLoading.style.display = 'none';
        }
        
        // Mostrar seção
        this.elements.aiSection.style.display = 'block';
        this.elements.aiContent.style.display = 'block';
        
        // Renderizar mensagem amigável
        this.elements.aiContent.innerHTML = `
            <div class="ai-empty-state" style="
                padding: 30px;
                text-align: center;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 8px;
                border: 1px dashed rgba(255, 255, 255, 0.1);
            ">
                <div style="font-size: 48px; margin-bottom: 15px;">✨</div>
                <h3 style="color: #52f7ad; margin-bottom: 10px;">Análise Completa</h3>
                <p style="color: #aaa; margin-bottom: 20px;">
                    Suas métricas de áudio foram analisadas com sucesso.<br>
                    Revise os cards de métricas acima para detalhes técnicos.
                </p>
                <div style="font-size: 12px; color: #666; margin-top: 20px;">
                    💡 Configure uma API Key da OpenAI para receber sugestões inteligentes personalizadas
                </div>
            </div>
        `;
        
        console.log('[AI-SUGGESTIONS] ✅ Estado vazio renderizado');
    }
    
    /**
     * 🕐 Exibir estado de carregamento durante polling
     * Função que estava faltando - referenciada mas não implementada
     */
    showLoadingState(message = 'Aguardando análise da IA...') {
        if (!this.elements.aiSection) {
            console.warn('[AI-UI] showLoadingState: aiSection não encontrado');
            return;
        }
        
        this.elements.aiSection.style.display = 'block';
        
        // Se aiLoading existe, apenas atualizar mensagem
        if (this.elements.aiLoading) {
            this.elements.aiLoading.style.display = 'block';
            const messageEl = this.elements.aiLoading.querySelector('p');
            if (messageEl) {
                messageEl.textContent = message;
            }
            return;
        }
        
        // Fallback: renderizar no aiContent
        if (this.elements.aiContent) {
            this.elements.aiContent.innerHTML = `
                <div style="
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 60px 20px;
                    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                    border-radius: 16px;
                    color: white;
                ">
                    <div style="font-size: 48px; animation: pulse 1.5s ease-in-out infinite;">
                        🤖
                    </div>
                    <h3>Conectando com sistema de IA</h3>
                    <p>${message}</p>
                    <div style="animation: spin 1s linear infinite;">
                        Processando...
                    </div>
                </div>
                <style>
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                    @keyframes pulse {
                        0%, 100% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.1); opacity: 0.8; }
                    }
                </style>
            `;
        }
    }
    
    /**
     * 🔄 Toggle da camada de IA
     */
    toggleAILayer() {
        if (typeof window.toggleAI === 'function') {
            const isEnabled = window.toggleAI();
            
            if (isEnabled) {
                this.updateStatus('success', 'IA ativada');
                this.checkForExistingAISuggestions();
            } else {
                this.updateStatus('disabled', 'IA desativada');
                this.hideAISection();
            }
            
            // Atualizar texto do botão
            const toggleBtn = document.getElementById('aiToggleText');
            if (toggleBtn) {
                toggleBtn.textContent = isEnabled ? 'Desativar IA' : 'Ativar IA';
            }
        }
    }
    
    /**
     * 💾 Download das sugestões IA
     */
    downloadAISuggestions() {
        if (!this.currentSuggestions.length) return;
        
        const report = this.generateAISuggestionsReport();
        const blob = new Blob([report], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `sugestoes-ia-${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('💾 [AI-UI] Relatório de sugestões IA baixado');
    }
    
    /**
     * 📄 Gerar relatório das sugestões IA
     */
    generateAISuggestionsReport() {
        const timestamp = new Date().toLocaleString('pt-BR');
        
        let report = `# 🤖 Relatório de Sugestões Inteligentes SoundyAI\n\n`;
        report += `**Gerado em:** ${timestamp}\n`;
        report += `**Total de sugestões:** ${this.currentSuggestions.length}\n`;
        report += `**Modelo de IA:** ${window.aiSuggestionLayer?.model || 'N/A'}\n\n`;
        
        this.currentSuggestions.forEach((suggestion, index) => {
            const blocks = suggestion.ai_blocks || {};
            const technical = suggestion.ai_technical_details || {};
            
            report += `## ${index + 1}. ${suggestion.ai_category || 'Sugestão'}\n\n`;
            
            if (blocks.problema) {
                report += `### ⚠️ Problema\n${blocks.problema}\n\n`;
            }
            
            if (blocks.causa) {
                report += `### 🎯 Causa\n${blocks.causa}\n\n`;
            }
            
            if (blocks.solucao) {
                report += `### 🛠️ Solução\n${blocks.solucao}\n\n`;
            }
            
            if (blocks.dica) {
                report += `### 💡 Dica\n${blocks.dica}\n\n`;
            }
            
            if (technical.tools_suggested) {
                report += `**Ferramentas recomendadas:** ${technical.tools_suggested.join(', ')}\n\n`;
            }
            
            report += `---\n\n`;
        });
        
        return report;
    }
    
    /**
     * 💬 Enviar sugestões para chat
     */
    sendAISuggestionsToChat() {
        if (!this.currentSuggestions.length) return;
        
        const summary = this.generateChatSummary();
        
        // Integrar com sistema de chat existente
        if (typeof window.sendModalAnalysisToChat === 'function') {
            // Usar sistema existente como base
            window.sendModalAnalysisToChat();
        } else if (window.prodAIChatbot) {
            const message = `🤖 Sugestões Inteligentes de Áudio:\n\n${summary}`;
            window.prodAIChatbot.sendMessage(message);
        }
        
        console.log('💬 [AI-UI] Sugestões enviadas para chat');
    }
    
    /**
     * 📝 Gerar resumo para chat
     */
    generateChatSummary() {
        // 🔐 SECURITY: Verificar modo reduced
        const analysis = window.currentModalAnalysis || { analysisMode: 'full' };
        const isReducedMode = analysis && (
            analysis.analysisMode === 'reduced' || 
            analysis.plan === 'free' ||
            analysis.isReduced === true
        );
        
        // 🔒 SE BLOQUEADO: Retornar mensagem genérica
        if (isReducedMode) {
            console.log('[CHAT-SUMMARY] 🔒 BLOCKED: Resumo genérico');
            return `Analisei seu áudio e identifiquei ${this.currentSuggestions.length} pontos de melhoria.\n\n🔒 Upgrade para o plano Pro para ver sugestões detalhadas da IA.`;
        }
        
        // ✅ FULL MODE: Gerar resumo completo
        let summary = `Analisei seu áudio e a IA gerou ${this.currentSuggestions.length} sugestões específicas:\n\n`;
        
        this.currentSuggestions.slice(0, 5).forEach((suggestion, index) => {
            // 🔐 NORMALIZAR SUGESTÃO
            const normalized = this.normalizeSuggestionForRender(suggestion, analysis.analysisMode);
            
            // 🔒 SE BLOQUEADO: NÃO ACESSAR TEXTO
            if (normalized.__blocked) {
                summary += `${index + 1}. **${suggestion.ai_category || 'Métrica Bloqueada'}**\n`;
                summary += `   🔒 Conteúdo disponível no plano Pro\n\n`;
                return;
            }
            
            // ✅ FULL MODE: Acessar texto real
            const problema = suggestion.ai_blocks?.problema || suggestion.problema || suggestion.message;
            const solucao = suggestion.ai_blocks?.solucao || suggestion.solucao || suggestion.action;
            
            summary += `${index + 1}. **${suggestion.ai_category || 'Problema'}**\n`;
            summary += `   Problema: ${problema}\n`;
            summary += `   Solução: ${solucao}\n\n`;
        });
        
        if (this.currentSuggestions.length > 5) {
            summary += `... e mais ${this.currentSuggestions.length - 5} sugestões.\n\n`;
        }
        
        summary += 'Você pode me ajudar a implementar essas melhorias?';
        
        return summary;
    }
    
    /**
     * 🎛️ Exibir configuração rápida
     */
    showQuickConfig() {
        // Implementar overlay de configuração rápida
        const configHtml = `
            <div class="ai-quick-config show">
                <div class="ai-config-title">⚙️ Configuração Rápida da IA</div>
                
                <input type="password" 
                       class="ai-config-input" 
                       id="aiApiKeyInput" 
                       placeholder="Sua API Key da OpenAI"
                       value="">
                
                <select class="ai-config-input" id="aiModelSelect">
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Padrão)</option>
                    <option value="gpt-4">GPT-4 (Pro)</option>
                </select>
                
                <div class="ai-config-actions">
                    <button class="ai-config-btn" onclick="aiUIController.cancelConfig()">Cancelar</button>
                    <button class="ai-config-btn" onclick="aiUIController.saveConfig()">Salvar</button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', configHtml);
    }
    
    /**
     * 💾 Salvar configuração
     */
    saveConfig() {
        const apiKey = document.getElementById('aiApiKeyInput')?.value;
        const model = document.getElementById('aiModelSelect')?.value;
        
        if (apiKey && window.aiSuggestionLayer) {
            window.aiSuggestionLayer.setApiKey(apiKey, model);
            this.updateStatus('success', 'Configuração salva');
            this.updateModelBadge();
        }
        
        this.cancelConfig();
    }
    
    /**
     * ❌ Cancelar configuração
     */
    cancelConfig() {
        const configEl = document.querySelector('.ai-quick-config');
        if (configEl) {
            configEl.remove();
        }
    }
    
    /**
     * 📊 Obter estatísticas da UI
     */
    getUIStats() {
        return {
            isInitialized: this.isInitialized,
            currentSuggestionsCount: this.currentSuggestions.length,
            isFullModalOpen: this.isFullModalOpen,
            elementsFound: Object.values(this.elements).filter(el => el).length,
            totalElements: Object.keys(this.elements).length
        };
    }

    /**
     * 🎯 Atualizar interface com análise (método compatibilidade)
     */
    updateUI(analysis) {
        console.log('🎯 [AI-UI] updateUI chamado:', {
            hasAnalysis: !!analysis,
            suggestionCount: analysis?.suggestions?.length || 0
        });
        
        // Redirecionar para checkForAISuggestions que é o método principal
        if (analysis) {
            this.checkForAISuggestions(analysis);
        }
    }

    /**
     * 🎯 Vincular análise (método compatibilidade)
     */
    bindAnalysis(analysis) {
        console.log('🎯 [AI-UI] bindAnalysis chamado:', {
            hasAnalysis: !!analysis,
            analysisKeys: analysis ? Object.keys(analysis) : null
        });
        
        // Armazenar análise globalmente para acesso posterior
        if (analysis) {
            window.currentModalAnalysis = analysis;
            // Processar sugestões se disponíveis
            this.checkForAISuggestions(analysis);
        }
    }

    /**
     * 🎯 Esconder seção IA (método compatibilidade)
     */
    hideAISection() {
        if (this.elements.aiSection) {
            this.elements.aiSection.style.display = 'none';
            console.log('🎯 [AI-UI] Seção IA ocultada');
        }
    }

    /**
     * 🎨 Renderizar cards de métricas (compatibilidade com audio-analyzer-integration.js)
     * @param {Object} payload - { mode: 'single'|'reference', user: analysis, reference?: analysis }
     */
    renderMetricCards(payload) {
        console.log('[AUDITORIA] ✅ renderMetricCards chamado com payload:', {
            mode: payload?.mode,
            hasUser: !!payload?.user,
            hasReference: !!payload?.reference,
            userFile: payload?.user?.metadata?.fileName || payload?.user?.fileName,
            refFile: payload?.reference?.metadata?.fileName || payload?.reference?.fileName
        });

        // Esta função é chamada pelo audio-analyzer-integration.js
        // Por enquanto, apenas loga os dados recebidos
        // TODO: Implementar renderização real dos cards de métricas
        
        if (!payload) {
            console.warn('[AI-UI] renderMetricCards: payload vazio');
            return;
        }

        // Armazenar análise atual globalmente
        if (payload.mode === 'single') {
            window.currentModalAnalysis = payload.user;
        } else if (payload.mode === 'reference') {
            window.currentModalAnalysis = {
                mode: 'reference',
                userAnalysis: payload.user,
                referenceAnalysis: payload.reference
            };
        }

        console.log('[AI-UI] renderMetricCards: Dados armazenados em window.currentModalAnalysis');
    }

    /**
     * 🎯 Renderizar seção de score (compatibilidade com audio-analyzer-integration.js)
     * @param {Object} payload - { mode: 'single'|'reference', user: analysis, reference?: analysis }
     */
    renderScoreSection(payload) {
        console.log('[AUDITORIA] ✅ renderScoreSection chamado com payload:', {
            mode: payload?.mode,
            hasUser: !!payload?.user,
            hasReference: !!payload?.reference
        });

        // Esta função é chamada pelo audio-analyzer-integration.js
        // Por enquanto, apenas loga os dados recebidos
        // TODO: Implementar renderização real da seção de score
        
        if (!payload) {
            console.warn('[AI-UI] renderScoreSection: payload vazio');
            return;
        }

        console.log('[AI-UI] renderScoreSection: Score calculado e pronto para renderização');
    }

    /**
     * 💡 Renderizar sugestões (compatibilidade com audio-analyzer-integration.js)
     * @param {Object} payload - { mode: 'single'|'reference', user: analysis, reference?: analysis }
     */
    renderSuggestions(payload) {
        console.log('[AUDITORIA] ✅ renderSuggestions chamado com payload:', {
            mode: payload?.mode,
            hasUser: !!payload?.user,
            hasReference: !!payload?.reference,
            hasTargets: !!payload?.targets,
            suggestionCount: payload?.user?.suggestions?.length || 0
        });

        // Esta função é chamada pelo audio-analyzer-integration.js
        // Delega para checkForAISuggestions se houver sugestões
        
        if (!payload || !payload.user) {
            console.warn('[AI-UI] renderSuggestions: payload ou user vazio');
            return;
        }

        // 🩹 PATCH: Detectar modo gênero e armazenar targets para futuras validações
        const mode = payload.mode || payload.user.mode || 'single';
        const hasGenreTargets = !!(payload.targets || payload.user.data?.genreTargets);
        
        if (mode === 'genre' && hasGenreTargets) {
            console.log('[AI-UI] 🎯 Modo GÊNERO detectado com targets:', {
                mode,
                hasTargets: hasGenreTargets,
                targetsKeys: payload.targets ? Object.keys(payload.targets) : 
                            payload.user.data?.genreTargets ? Object.keys(payload.user.data.genreTargets) : null
            });
            
            // Armazenar targets no payload do usuário para uso futuro
            payload.user.__genreTargets = payload.targets || payload.user.data?.genreTargets;
        } else if (mode === 'genre' && !hasGenreTargets) {
            console.warn('[AI-UI] ⚠️ Modo GÊNERO sem targets - validação de comparação DESABILITADA');
            console.warn('[AI-UI] ✅ Sugestões e métricas serão exibidas normalmente');
        }

        // Verificar se há sugestões para exibir
        if (payload.user.suggestions && payload.user.suggestions.length > 0) {
            console.log('[AI-UI] renderSuggestions: Delegando para checkForAISuggestions');
            this.checkForAISuggestions(payload.user);
        } else {
            console.log('[AI-UI] renderSuggestions: Nenhuma sugestão disponível');
            this.hideAISection();
        }
    }

    /**
     * 🏆 Renderizar score final no topo (compatibilidade com audio-analyzer-integration.js)
     * @param {Object} payload - { mode: 'single'|'reference', user: analysis, reference?: analysis }
     */
    renderFinalScoreAtTop(payload) {
        console.log('[AUDITORIA] ✅ renderFinalScoreAtTop chamado com payload:', {
            mode: payload?.mode,
            hasUser: !!payload?.user,
            hasReference: !!payload?.reference,
            userScore: payload?.user?.score || payload?.user?.finalScore
        });

        // Esta função é chamada pelo audio-analyzer-integration.js
        // Por enquanto, apenas loga os dados recebidos
        // TODO: Implementar renderização real do score no topo
        
        if (!payload || !payload.user) {
            console.warn('[AI-UI] renderFinalScoreAtTop: payload ou user vazio');
            return;
        }

        const score = payload.user.score || payload.user.finalScore || 0;
        console.log('[AI-UI] renderFinalScoreAtTop: Score final =', score);
    }
}

// 🌍 Funções globais para integração com HTML

/**
 * 🔄 Toggle da camada de IA (global)
 */
window.toggleAILayer = function() {
    if (window.aiUIController) {
        window.aiUIController.toggleAILayer();
    }
};

/**
 * ❌ Fechar modal full (global)
 */
window.closeAIFullModal = function() {
    if (window.aiUIController) {
        window.aiUIController.closeFullModal();
    }
};

/**
 * 💾 Download sugestões IA (global)
 */
window.downloadAISuggestions = function() {
    if (window.aiUIController) {
        window.aiUIController.downloadAISuggestions();
    }
};

/**
 * 💬 Enviar sugestões para chat (global)
 */
window.sendAISuggestionsToChat = function() {
    if (window.aiUIController) {
        window.aiUIController.sendAISuggestionsToChat();
    }
};

/**
 * ⚙️ Configuração rápida (global)
 */
window.showAIQuickConfig = function() {
    if (window.aiUIController) {
        window.aiUIController.showQuickConfig();
    }
};

// 🚀 Inicialização automática
(function() {
    'use strict';
    
    // Exportar a classe para window
    window.AISuggestionUIController = AISuggestionUIController;
    
    // Aguardar carregamento da camada de IA (com fallback)
    const initUI = () => {
        // Tentar inicializar mesmo sem aiSuggestionLayer (modo compatibilidade)
        if (typeof window.aiSuggestionLayer !== 'undefined' || document.readyState === 'complete') {
            if (!window.aiUIController) {
                window.aiUIController = new AISuggestionUIController();
                console.log('🎨 [AI-UI] Sistema de interface inicializado globalmente');
                
                // ========================================
                // ✅ AUDITORIA COMPLETA DE FUNÇÕES
                // ========================================
                console.log('[AUDITORIA] Controlador principal de UI detectado em: ai-suggestion-ui-controller.js');
                
                const requiredFunctions = [
                    'renderMetricCards',
                    'renderScoreSection',
                    'renderSuggestions',
                    'renderFinalScoreAtTop',
                    'checkForAISuggestions'
                ];
                
                const missingFunctions = requiredFunctions.filter(
                    fn => typeof window.aiUIController[fn] !== 'function'
                );
                
                if (missingFunctions.length === 0) {
                    console.log('[COMPAT] ✅ Todas as funções esperadas estão presentes:', requiredFunctions);
                    console.log('[COMPAT] aiUIController pronto para uso sem gambiarra');
                } else {
                    console.error('[COMPAT-VERIFY] ❌ Funções ausentes no controlador de UI:', missingFunctions);
                }
            }
        } else {
            setTimeout(initUI, 100);
        }
    };
    
    // Iniciar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }
    
})();

// ========================================
// ✅ REGISTRO GLOBAL DO CONTROLADOR DE UI
// ========================================
(function ensureAIUIControllerExists() {
    try {
        if (typeof window.aiUIController === 'undefined') {
            window.aiUIController = {
                renderMetricCards: () => console.log('[SAFE] renderMetricCards placeholder'),
                renderScoreSection: () => console.log('[SAFE] renderScoreSection placeholder'),
                renderSuggestions: () => console.log('[SAFE] renderSuggestions placeholder'),
                renderFinalScoreAtTop: () => console.log('[SAFE] renderFinalScoreAtTop placeholder'),
                checkForAISuggestions: () => console.log('[SAFE] checkForAISuggestions placeholder'),
                __ready: true
            };
            console.warn('[SAFE-REGISTER] aiUIController não inicializado pelo módulo principal — fallback ativado.');
        } else {
            window.aiUIController.__ready = true;
            console.log('[SAFE-REGISTER] ✅ aiUIController pronto.');
        }
    } catch (error) {
        console.error('[ERROR] ❌ Falha ao inicializar aiUIController:', error);
        console.error('[ERROR] Stack trace:', error.stack);
        
        // Criar fallback de emergência mesmo com erro
        window.aiUIController = {
            renderMetricCards: () => console.error('[EMERGENCY] renderMetricCards - sistema falhou'),
            renderScoreSection: () => console.error('[EMERGENCY] renderScoreSection - sistema falhou'),
            renderSuggestions: () => console.error('[EMERGENCY] renderSuggestions - sistema falhou'),
            renderFinalScoreAtTop: () => console.error('[EMERGENCY] renderFinalScoreAtTop - sistema falhou'),
            checkForAISuggestions: () => console.error('[EMERGENCY] checkForAISuggestions - sistema falhou'),
            __ready: false,
            __error: error
        };
    }
})();