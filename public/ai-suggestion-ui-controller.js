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
        this.elements = {
            aiSection: document.getElementById('aiSuggestionsSection'),
            aiContent: document.getElementById('aiSuggestionsContent'),
            aiStatusBadge: document.getElementById('aiStatusBadge'),
            aiModelBadge: document.getElementById('aiModelBadge'),
            fullModal: document.getElementById('aiSuggestionsFullModal'),
            fullModalContent: document.getElementById('aiFullModalContent'),
            aiStatsCount: document.getElementById('aiStatsCount'),
            aiStatsModel: document.getElementById('aiStatsModel'),
            aiStatsTime: document.getElementById('aiStatsTime')
        };
        
        // Verificar se elementos existem
        const missingElements = Object.entries(this.elements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);
            
        if (missingElements.length > 0) {
            console.warn('⚠️ [AI-UI] Elementos DOM não encontrados:', missingElements);
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
     * 🤖 Verificar e processar sugestões IA
     */
    checkForAISuggestions(analysis) {
        if (!analysis || !analysis.suggestions) return;
        
        // Verificar se há sugestões enriquecidas com IA
        const aiSuggestions = analysis.suggestions.filter(s => s.ai_enhanced === true);
        
        if (aiSuggestions.length > 0) {
            console.log(`🤖 [AI-UI] ${aiSuggestions.length} sugestões IA detectadas`);
            this.displayAISuggestions(aiSuggestions, analysis);
        } else {
            // 🚀 FORÇA EXIBIÇÃO: Mesmo sem IA configurada, mostrar interface com sugestões base
            if (analysis.suggestions && analysis.suggestions.length > 0) {
                console.log(`🤖 [AI-UI] Exibindo ${analysis.suggestions.length} sugestões base (IA não configurada)`);
                this.displayBaseSuggestions(analysis.suggestions, analysis);
            } else {
                this.hideAISection();
            }
        }
    }
    
    /**
     * 🎨 Exibir sugestões IA na interface
     */
    displayAISuggestions(suggestions, analysis) {
        if (!this.elements.aiSection) return;
        
        this.currentSuggestions = suggestions;
        
        // Mostrar seção
        this.elements.aiSection.style.display = 'block';
        this.elements.aiSection.classList.add('ai-fade-in');
        
        // Atualizar status
        this.updateStatus('success', `${suggestions.length} sugestões geradas`);
        
        // Atualizar modelo
        this.updateModelBadge();
        
        // Renderizar preview compacto
        this.renderCompactPreview(suggestions);
        
        // Adicionar botão para expandir
        this.addExpandButton();
        
        console.log('🎨 [AI-UI] Sugestões IA exibidas na interface');
    }
    
    /**
     * 🎨 Exibir sugestões base (sem IA) na interface
     */
    displayBaseSuggestions(suggestions, analysis) {
        if (!this.elements.aiSection) return;
        
        this.currentSuggestions = suggestions;
        
        // Mostrar seção
        this.elements.aiSection.style.display = 'block';
        this.elements.aiSection.classList.add('ai-fade-in');
        
        // Atualizar status para indicar que IA não está configurada
        this.updateStatus('disabled', 'IA não configurada - sugestões base');
        
        // Atualizar modelo
        if (this.elements.aiModelBadge) {
            this.elements.aiModelBadge.textContent = 'BASE';
        }
        
        // Renderizar preview compacto das sugestões base
        this.renderCompactPreview(suggestions, true);
        
        // Adicionar botão para expandir
        this.addExpandButton();
        
        // Adicionar mensagem para configurar IA
        this.addConfigPrompt();
        
        console.log('🎨 [AI-UI] Sugestões base exibidas (IA não configurada)');
    }
    
    /**
     * 📋 Renderizar preview compacto das sugestões
     */
    renderCompactPreview(suggestions, isBaseSuggestions = false) {
        if (!this.elements.aiContent) return;
        
        const preview = suggestions.slice(0, 3); // Máximo 3 no preview
        const hasMore = suggestions.length > 3;
        
        let html = preview.map((suggestion, index) => {
            const category = suggestion.ai_category || suggestion.category || 'geral';
            const priority = suggestion.ai_priority || suggestion.priority || 5;
            const problemText = suggestion.ai_blocks?.problema || suggestion.title || suggestion.message || suggestion.original;
            const solutionText = suggestion.ai_blocks?.solucao || suggestion.description || suggestion.action || suggestion.educationalTitle;
            
            // Se for sugestão base, usar formato simples
            if (isBaseSuggestions) {
                return `
                    <div class="ai-suggestion-card ai-compact ai-base-suggestion ai-new" style="animation-delay: ${index * 0.1}s">
                        <div class="ai-suggestion-header">
                            <span class="ai-suggestion-category">${category}</span>
                            <div class="ai-suggestion-priority base">${priority}</div>
                        </div>
                        
                        <div class="ai-suggestion-preview">
                            <div class="ai-block ai-block-problema">
                                <div class="ai-block-title">⚠️ Problema</div>
                                <div class="ai-block-content">${problemText}</div>
                            </div>
                            
                            <div class="ai-block ai-block-solucao">
                                <div class="ai-block-title">🛠️ Solução</div>
                                <div class="ai-block-content">${solutionText}</div>
                            </div>
                        </div>
                        
                        <div class="ai-base-notice">
                            💡 Configure API Key para sugestões inteligentes
                        </div>
                    </div>
                `;
            }
            
            return `
                <div class="ai-suggestion-card ai-compact ai-new" style="animation-delay: ${index * 0.1}s">
                    <div class="ai-suggestion-header">
                        <span class="ai-suggestion-category">${category}</span>
                        <div class="ai-suggestion-priority ${this.getPriorityClass(priority)}">${priority}</div>
                    </div>
                    
                    <div class="ai-suggestion-preview">
                        <div class="ai-block ai-block-problema">
                            <div class="ai-block-title">⚠️ Problema</div>
                            <div class="ai-block-content">${problemText}</div>
                        </div>
                        
                        <div class="ai-block ai-block-solucao">
                            <div class="ai-block-title">🛠️ Solução</div>
                            <div class="ai-block-content">${solutionText}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        if (hasMore) {
            html += `
                <div class="ai-more-suggestions">
                    <button class="action-btn primary" onclick="aiUIController.openFullModal()">
                        Ver todas as ${suggestions.length} sugestões
                    </button>
                </div>
            `;
        }
        
        this.elements.aiContent.innerHTML = html;
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
        if (!this.elements.aiStatusBadge) return;
        
        const statusIcon = this.elements.aiStatusBadge.querySelector('.ai-status-icon');
        const statusText = this.elements.aiStatusBadge.querySelector('.ai-status-text');
        
        // Remover classes anteriores
        this.elements.aiStatusBadge.className = 'ai-status-badge ' + type;
        
        // Atualizar conteúdo
        if (statusIcon) {
            const icons = {
                processing: '🔄',
                success: '✅',
                error: '❌',
                disabled: '⏸️'
            };
            statusIcon.textContent = icons[type] || '📡';
        }
        
        if (statusText) {
            statusText.textContent = message;
        }
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
        let summary = `Analisei seu áudio e a IA gerou ${this.currentSuggestions.length} sugestões específicas:\n\n`;
        
        this.currentSuggestions.slice(0, 5).forEach((suggestion, index) => {
            const problema = suggestion.ai_blocks?.problema || suggestion.message;
            const solucao = suggestion.ai_blocks?.solucao || suggestion.action;
            
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
    
    // Aguardar carregamento da camada de IA (com fallback)
    const initUI = () => {
        // Tentar inicializar mesmo sem aiSuggestionLayer (modo compatibilidade)
        if (typeof window.aiSuggestionLayer !== 'undefined' || document.readyState === 'complete') {
            if (!window.aiUIController) {
                window.aiUIController = new AISuggestionUIController();
                console.log('🎨 [AI-UI] Sistema de interface inicializado globalmente');
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