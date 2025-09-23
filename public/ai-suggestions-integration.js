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
            console.warn('⚠️ [AI-INTEGRATION] Elementos não encontrados:', missing);
            return;
        }
        
        console.log('✅ [AI-INTEGRATION] Todos os elementos encontrados');
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Toggle expand/collapse
        if (this.elements.container) {
            const toggleBtn = this.elements.container.querySelector('.ai-toggle-btn');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', this.toggleExpanded);
            }
        }
    }
    
    // 🚀 FUNÇÃO PRINCIPAL: Processa sugestões com IA
    async processWithAI(suggestions, metrics, genre) {
        if (!suggestions || suggestions.length === 0) {
            console.warn('⚠️ [AI-INTEGRATION] Nenhuma sugestão recebida');
            return;
        }
        
        if (this.isProcessing) {
            console.log('⏳ [AI-INTEGRATION] Processamento já em andamento');
            return;
        }
        
        this.isProcessing = true;
        this.setLoadingState(true);
        
        const startTime = Date.now();
        
        console.log(`🎯 [AI-INTEGRATION] Processando ${suggestions.length} sugestões com IA`);
        console.log('📊 [AI-INTEGRATION] Métricas:', metrics);
        console.log('🎵 [AI-INTEGRATION] Gênero:', genre);
        
        try {
            // Validar e preparar payload
            const validSuggestions = this.validateSuggestions(suggestions);
            if (validSuggestions.length === 0) {
                throw new Error('Nenhuma sugestão válida para processar');
            }
            
            const payload = this.buildValidPayload(validSuggestions, metrics, genre);
            
            this.updateStatus('processing', 'Enviando para IA...');
            
            // Fazer chamada para API
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                timeout: 30000
            });
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('✅ [AI-INTEGRATION] Resposta da IA recebida:', result);
            
            // Processar resposta e exibir
            if (result.success && result.suggestions) {
                const enrichedSuggestions = this.mergeEnrichedSuggestions(validSuggestions, result.suggestions);
                this.updateStatus('ready', 'Sugestões aprimoradas pela IA');
                this.displaySuggestions(enrichedSuggestions, 'ai');
                this.updateStats(enrichedSuggestions.length, Date.now() - startTime, 'ai');
                
            } else {
                // Fallback para sugestões originais
                console.log('📋 [AI-INTEGRATION] IA retornou resultado inválido, usando sugestões originais');
                this.displaySuggestionsAsOriginal(validSuggestions);
            }
            
        } catch (error) {
            console.error('❌ [AI-INTEGRATION] Erro no processamento:', error);
            
            // Retry logic
            if (this.retryAttempts < this.maxRetries) {
                this.retryAttempts++;
                console.log(`🔄 [AI-INTEGRATION] Tentativa ${this.retryAttempts}/${this.maxRetries}`);
                
                this.updateStatus('processing', `Tentativa ${this.retryAttempts}...`);
                
                // Exponential backoff
                const delay = Math.pow(2, this.retryAttempts) * 1000;
                setTimeout(() => {
                    this.processWithAI(suggestions, metrics, genre);
                }, delay);
                
                return;
            }
            
            // Erro final - exibir sugestões originais como fallback
            console.log('🔄 [AI-INTEGRATION] Falha total - exibindo sugestões originais');
            this.displaySuggestionsAsOriginal(suggestions);
            
        } finally {
            this.setLoadingState(false);
            this.isProcessing = false;
            this.retryAttempts = 0; // Reset para próxima chamada
        }
    }
    
    displaySuggestionsAsOriginal(suggestions) {
        const validSuggestions = this.validateSuggestions(suggestions);
        this.updateStatus('ready', 'Sugestões locais (IA indisponível)');
        this.displaySuggestions(validSuggestions, 'local');
        this.updateStats(validSuggestions.length, Date.now(), 'local');
        this.showFallbackNotice('IA temporariamente indisponível. Exibindo análise local.');
    }

    // 📝 Validar e normalizar sugestões antes de enviar para IA
    validateSuggestions(suggestions) {
        if (!Array.isArray(suggestions)) {
            console.warn('⚠️ [AI-INTEGRATION] Sugestões não é array:', typeof suggestions);
            return [];
        }
        
        return suggestions.filter(suggestion => {
            // Validação básica
            if (!suggestion || typeof suggestion !== 'object') {
                return false;
            }
            
            // Deve ter categoria e texto
            if (!suggestion.category || !suggestion.text) {
                return false;
            }
            
            return true;
        });
    }
    
    // 🏗️ Construir payload válido para IA (modo ENRIQUECIMENTO)
    buildValidPayload(suggestions, metrics, genre) {
        return {
            mode: 'enhancement', // MODO CORRETO: enriquecer sugestões existentes
            suggestions: suggestions.map(s => ({
                category: s.category || 'general',
                text: s.text || '',
                severity: s.severity || 'medium',
                technical: s.technical || false
            })),
            context: {
                genre: genre || 'unknown',
                metrics: {
                    lufs: metrics?.lufs || 0,
                    peak: metrics?.peak || 0,
                    dynamics: metrics?.dynamics || 0,
                    frequencies: metrics?.frequencies || {}
                }
            },
            options: {
                educational: true,
                language: 'pt-BR',
                maxLength: 200
            }
        };
    }
    
    // 🔄 Mesclar sugestões originais com versões enriquecidas pela IA
    mergeEnrichedSuggestions(originalSuggestions, aiSuggestions) {
        if (!Array.isArray(aiSuggestions)) {
            console.warn('⚠️ [AI-INTEGRATION] IA retornou formato inválido');
            return originalSuggestions;
        }
        
        return originalSuggestions.map((original, index) => {
            const aiEnhanced = aiSuggestions[index];
            
            if (aiEnhanced && typeof aiEnhanced === 'object') {
                return {
                    ...original,
                    text: aiEnhanced.text || original.text,
                    explanation: aiEnhanced.explanation || '',
                    priority: aiEnhanced.priority || original.priority,
                    enhanced: true
                };
            }
            
            return {
                ...original,
                enhanced: false
            };
        });
    }
    
    // 🎨 Exibir sugestões no modal
    displaySuggestions(suggestions, mode = 'local') {
        if (!this.elements.grid) {
            console.error('❌ [AI-INTEGRATION] Grid não encontrado');
            return;
        }
        
        this.currentSuggestions = suggestions;
        
        // Limpar grid
        this.elements.grid.innerHTML = '';
        
        // Criar cards das sugestões
        suggestions.forEach((suggestion, index) => {
            const card = this.createSuggestionCard(suggestion, index, mode);
            this.elements.grid.appendChild(card);
        });
        
        console.log(`✅ [AI-INTEGRATION] ${suggestions.length} sugestões exibidas (modo: ${mode})`);
    }
    
    // 🃏 Criar card individual de sugestão
    createSuggestionCard(suggestion, index, mode) {
        const card = document.createElement('div');
        card.className = 'ai-suggestion-card';
        card.setAttribute('data-index', index);
        
        const enhancedBadge = suggestion.enhanced ? '<span class="ai-enhanced-badge">✨ IA</span>' : '';
        const priorityClass = this.getPriorityClass(suggestion.priority);
        
        card.innerHTML = `
            <div class="ai-card-header">
                <span class="ai-category ${suggestion.category}">${this.getCategoryIcon(suggestion.category)} ${this.getCategoryName(suggestion.category)}</span>
                ${enhancedBadge}
            </div>
            <div class="ai-card-content">
                <p class="ai-suggestion-text">${suggestion.text}</p>
                ${suggestion.explanation ? `<p class="ai-explanation">${suggestion.explanation}</p>` : ''}
            </div>
            <div class="ai-card-footer">
                <span class="ai-priority ${priorityClass}">${this.getPriorityText(suggestion.priority)}</span>
                <span class="ai-mode-badge">${mode === 'ai' ? '🤖 IA' : '🔧 Local'}</span>
            </div>
        `;
        
        return card;
    }
    
    // 🎭 Helpers para categorias e prioridades
    getCategoryIcon(category) {
        const icons = {
            frequency: '🎵',
            loudness: '🔊',
            dynamics: '📊',
            stereo: '🎧',
            general: '💡'
        };
        return icons[category] || '💡';
    }
    
    getCategoryName(category) {
        const names = {
            frequency: 'Frequência',
            loudness: 'Volume',
            dynamics: 'Dinâmica',
            stereo: 'Estéreo',
            general: 'Geral'
        };
        return names[category] || 'Geral';
    }
    
    getPriorityClass(priority) {
        const classes = {
            high: 'priority-high',
            medium: 'priority-medium',
            low: 'priority-low'
        };
        return classes[priority] || 'priority-medium';
    }
    
    getPriorityText(priority) {
        const texts = {
            high: 'Alta',
            medium: 'Média',
            low: 'Baixa'
        };
        return texts[priority] || 'Média';
    }
    
    // 🔄 Toggle expand/collapse
    toggleExpanded() {
        this.isExpanded = !this.isExpanded;
        
        if (this.elements.container) {
            this.elements.container.classList.toggle('expanded', this.isExpanded);
        }
        
        if (this.elements.toggleIcon) {
            this.elements.toggleIcon.textContent = this.isExpanded ? '−' : '+';
        }
        
        console.log(`🔄 [AI-INTEGRATION] Modal ${this.isExpanded ? 'expandido' : 'colapsado'}`);
    }
    
    // 🎯 Atualizar status
    updateStatus(state, message) {
        if (this.elements.statusText) {
            this.elements.statusText.textContent = message;
        }
        
        if (this.elements.statusDot) {
            this.elements.statusDot.className = `ai-status-dot status-${state}`;
        }
        
        console.log(`📊 [AI-INTEGRATION] Status: ${state} - ${message}`);
    }
    
    // 📈 Atualizar estatísticas
    updateStats(count, processingTime, mode) {
        if (this.elements.count) {
            this.elements.count.textContent = count;
        }
        
        if (this.elements.time) {
            this.elements.time.textContent = `${processingTime}ms`;
        }
        
        if (this.elements.mode) {
            this.elements.mode.textContent = mode === 'ai' ? 'IA' : 'Local';
        }
    }
    
    // ⚠️ Exibir aviso de fallback
    showFallbackNotice(message) {
        if (this.elements.fallbackNotice) {
            this.elements.fallbackNotice.textContent = message;
            this.elements.fallbackNotice.style.display = 'block';
            
            // Auto-hide após 5 segundos
            setTimeout(() => {
                if (this.elements.fallbackNotice) {
                    this.elements.fallbackNotice.style.display = 'none';
                }
            }, 5000);
        }
    }
    
    // 🔄 Estado de loading
    setLoadingState(isLoading) {
        if (this.elements.loading) {
            this.elements.loading.style.display = isLoading ? 'flex' : 'none';
        }
        
        if (this.elements.grid) {
            this.elements.grid.style.display = isLoading ? 'none' : 'grid';
        }
    }
}

// 🚀 Inicializar sistema quando DOM carregar
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar um pouco para garantir que outros scripts carregaram
    setTimeout(() => {
        if (typeof window.aiSuggestionsIntegration === 'undefined') {
            window.aiSuggestionsIntegration = new AISuggestionsIntegration();
            console.log('🎯 [AI-INTEGRATION] Sistema inicializado globalmente');
        }
    }, 1000);
});