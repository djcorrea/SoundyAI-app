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
     * Processar sugestões com IA - VERSÃO COMPLETA
     */
    async processWithAI(suggestions, metrics = {}, genre = null) {
        if (this.isProcessing) {
            console.log('⚠️ [AI-INTEGRATION] Processamento já em andamento');
            return;
        }
        
        console.log('🚀 [AI-INTEGRATION] Iniciando processamento COMPLETO com IA...', {
            suggestionsCount: suggestions?.length || 0,
            genre: genre || 'não especificado'
        });
        
        this.isProcessing = true;
        this.currentSuggestions = suggestions || [];
        
        // Show container and loading state
        this.showContainer();
        this.setLoadingState(true);
        this.updateStatus('processing', 'Processando todas as sugestões...');
        
        const startTime = Date.now();
        const originalCount = suggestions?.length || 0;
        let aiEnhancedCount = 0;
        let fallbackCount = 0;
        let processedSuggestions = [];
        
        try {
            // Processar TODAS as sugestões
            for (let i = 0; i < originalCount; i++) {
                const suggestion = suggestions[i];
                this.updateStatus('processing', `Processando ${i + 1}/${originalCount}...`);
                
                console.log(`🔄 [AI-PROCESSING] Processando sugestão ${i + 1}/${originalCount}:`, {
                    message: suggestion.message || suggestion.title,
                    action: suggestion.action || suggestion.description
                });
                
                try {
                    // Tentar processar com IA
                    const enhancedSuggestion = await this.processSingleSuggestion(suggestion, metrics, genre);
                    
                    if (enhancedSuggestion && enhancedSuggestion.aiEnhanced) {
                        processedSuggestions.push(enhancedSuggestion);
                        aiEnhancedCount++;
                        console.log(`✅ [AI-PROCESSING] Sugestão ${i + 1} enriquecida pela IA`);
                    } else {
                        // Fallback automático
                        const fallbackSuggestion = this.createFallbackSuggestion(suggestion);
                        processedSuggestions.push(fallbackSuggestion);
                        fallbackCount++;
                        console.log(`🔄 [AI-PROCESSING] Sugestão ${i + 1} usando fallback`);
                    }
                    
                } catch (suggestionError) {
                    console.warn(`⚠️ [AI-PROCESSING] Erro na sugestão ${i + 1}, usando fallback:`, suggestionError.message);
                    const fallbackSuggestion = this.createFallbackSuggestion(suggestion);
                    processedSuggestions.push(fallbackSuggestion);
                    fallbackCount++;
                }
                
                // Pequeno delay para não sobrecarregar a API
                if (i < originalCount - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            const processingTime = Date.now() - startTime;
            const source = aiEnhancedCount > 0 ? 'mixed' : 'fallback';
            
            // Log detalhado do processamento
            console.log('📊 [AI-INTEGRATION] Processamento COMPLETO finalizado:', {
                originalCount: originalCount,
                aiEnhancedCount: aiEnhancedCount,
                fallbackCount: fallbackCount,
                totalProcessed: processedSuggestions.length,
                processingTime: `${processingTime}ms`,
                successRate: `${Math.round((aiEnhancedCount / originalCount) * 100)}%`
            });
            
            // Garantir que TODAS as sugestões sejam exibidas
            if (processedSuggestions.length !== originalCount) {
                console.error('❌ [AI-INTEGRATION] ERRO: Número de sugestões processadas não confere!', {
                    expected: originalCount,
                    actual: processedSuggestions.length
                });
                
                // Fallback de emergência: usar todas as originais
                processedSuggestions = suggestions.map(s => this.createFallbackSuggestion(s));
                fallbackCount = originalCount;
                aiEnhancedCount = 0;
            }
            
            // Display ALL results
            this.displaySuggestions(processedSuggestions, source);
            this.updateStats(processedSuggestions.length, processingTime, source);
            
            if (aiEnhancedCount > 0) {
                this.updateStatus('success', `IA ativa: ${aiEnhancedCount}/${originalCount}`);
                this.retryAttempts = 0;
            } else {
                this.updateStatus('fallback', 'Modo básico');
                this.showFallbackNotice('IA indisponível - usando sugestões básicas');
            }
            
        } catch (error) {
            console.error('❌ [AI-INTEGRATION] Erro geral no processamento:', error);
            
            // Fallback TOTAL: exibir todas as sugestões originais
            const allFallbackSuggestions = suggestions.map(s => this.createFallbackSuggestion(s));
            this.displaySuggestions(allFallbackSuggestions, 'fallback');
            this.updateStatus('fallback', 'Modo básico');
            this.showFallbackNotice('Erro na IA. Exibindo todas as sugestões básicas.');
            this.updateStats(allFallbackSuggestions.length, Date.now() - startTime, 'fallback');
            
            console.log('🔄 [AI-INTEGRATION] Fallback TOTAL aplicado:', {
                originalCount: originalCount,
                fallbackCount: allFallbackSuggestions.length
            });
            
        } finally {
            this.setLoadingState(false);
            this.isProcessing = false;
        }
    }
    
    /**
     * Processar uma única sugestão com IA
     */
    async processSingleSuggestion(suggestion, metrics, genre) {
        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                suggestions: [suggestion], // Enviar UMA sugestão por vez
                metrics: metrics || {},
                genre: genre || 'geral'
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.enhancedSuggestions && data.enhancedSuggestions.length > 0) {
            return data.enhancedSuggestions[0]; // Retornar a primeira (e única) sugestão
        }
        
        return null;
    }
    
    /**
     * Criar sugestão fallback estruturada
     */
    createFallbackSuggestion(originalSuggestion) {
        return {
            blocks: {
                problem: `⚠️ ${originalSuggestion.message || originalSuggestion.title || 'Problema detectado'}`,
                cause: '🎯 Análise automática identificou desvio dos padrões técnicos de referência',
                solution: `🛠️ ${originalSuggestion.action || originalSuggestion.description || 'Ajuste recomendado pelo sistema'}`,
                tip: '💡 Monitore resultado em diferentes sistemas de reprodução para validar melhoria',
                plugin: '🎹 Use EQ nativo da sua DAW ou plugins gratuitos como ReaEQ (Reaper)',
                result: '✅ Melhoria na qualidade sonora geral e maior compatibilidade com padrões profissionais'
            },
            metadata: {
                priority: originalSuggestion.priority || 'média',
                difficulty: 'intermediário', 
                confidence: originalSuggestion.confidence || 0.7,
                frequency_range: originalSuggestion.frequency_range || 'amplo espectro',
                processing_type: 'Ajuste geral',
                genre_specific: 'Aplicável a todos os gêneros musicais'
            },
            aiEnhanced: false,
            fallbackApplied: true
        };
    }
    
    /**
     * Exibir sugestões no grid - VERSÃO COMPLETA
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
        
        // Contar tipos de sugestões
        const aiCount = suggestions.filter(s => s.aiEnhanced === true).length;
        const fallbackCount = suggestions.filter(s => s.aiEnhanced === false || s.fallbackApplied === true).length;
        
        console.log('📊 [AI-DISPLAY] Estatísticas de exibição:', {
            totalSuggestions: suggestions.length,
            aiEnhanced: aiCount,
            fallback: fallbackCount,
            source: source
        });
        
        // Generate cards - TODAS as sugestões
        suggestions.forEach((suggestion, index) => {
            const cardSource = suggestion.aiEnhanced === true ? 'ai' : 'fallback';
            const card = this.createSuggestionCard(suggestion, index, cardSource);
            this.elements.grid.appendChild(card);
        });
        
        // Show grid
        this.elements.grid.style.display = 'grid';
        
        // Animate cards
        this.animateCards();
        
        console.log(`✅ [AI-INTEGRATION] ${suggestions.length} sugestões exibidas (IA: ${aiCount}, Fallback: ${fallbackCount})`);
    }
    
    /**
     * Criar card de sugestão - VERSÃO MELHORADA
     */
    createSuggestionCard(suggestion, index, source) {
        const card = document.createElement('div');
        const isAIEnhanced = suggestion.aiEnhanced === true;
        const isFallback = suggestion.fallbackApplied === true || !isAIEnhanced;
        
        // Classes mais específicas
        card.className = `ai-suggestion-card ${isFallback ? 'ai-base-suggestion' : 'ai-enhanced-suggestion'}`;
        card.style.animationDelay = `${index * 0.1}s`;
        
        // Extract data
        const blocks = suggestion.blocks || this.createFallbackBlocks(suggestion);
        const metadata = suggestion.metadata || { priority: 'média', difficulty: 'intermediário' };
        
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
                
                <div class="ai-enhanced-indicator ${isAIEnhanced ? 'ai-enhanced' : 'fallback'}">
                    <span>${isAIEnhanced ? '🤖' : '⚙️'}</span>
                    <span>${isAIEnhanced ? 'IA' : 'Base'}</span>
                    ${metadata.confidence ? `<span class="confidence">${Math.round(metadata.confidence * 100)}%</span>` : ''}
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
            this.elements.time.textContent = `${Math.round(timeMs)}ms`;
        }
        
        if (this.elements.mode) {
            this.elements.mode.textContent = mode === 'ai' ? 'IA' : 'Base';
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