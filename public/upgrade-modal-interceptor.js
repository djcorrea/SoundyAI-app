// 🔒 INTERCEPTOR DE BOTÕES PREMIUM - MODO REDUCED
// Sistema de neutralização de handlers inline para funcionalidades premium
// REMOVE onclick inline e listeners existentes em modo reduced
// NÃO ALTERA NENHUMA FUNÇÃO EXISTENTE - Apenas neutraliza execução

(function() {
    'use strict';
    
    log('🔒 [INTERCEPTOR] Carregando sistema de neutralização...');
    
    // ========================================
    // 🎯 CONFIGURAÇÃO
    // ========================================
    
    // Seletores dos botões que devem ser neutralizados em modo reduced
    const PREMIUM_BUTTON_SELECTORS = [
        'button[onclick*="sendModalAnalysisToChat"]',  // Botão "Pedir Ajuda à IA"
        'button[onclick*="downloadModalAnalysis"]'     // Botão "Baixar Relatório"
    ];
    
    // Armazenar referências dos handlers originais (para possível restauração)
    const originalHandlers = new Map();
    
    // ========================================
    // 🔍 FUNÇÃO DE DETECÇÃO DE MODO
    // ========================================
    
    /**
     * Detecta se o sistema está em modo reduced
     * PRIORIDADE: window.PlanCapabilities > APP_MODE
     */
    function isReducedMode() {
        // ✅ Método 1: Sistema de capabilities (PRIORIDADE)
        if (window.PlanCapabilities) {
            return window.PlanCapabilities.shouldBlockPremiumFeatures();
        }
        
        // ✅ Método 2: Flag global APP_MODE
        if (window.APP_MODE === 'reduced') return true;
        
        // ✅ Método 3: Verificar análise atual no modal
        const currentAnalysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__;
        if (currentAnalysis) {
            if (currentAnalysis.analysisMode === 'reduced') return true;
            if (currentAnalysis.isReduced === true) return true;
        }
        
        // Default: modo full (não bloquear)
        return false;
    }
    
    // ========================================
    // 🎨 CONTROLE DO MODAL DE UPGRADE
    // ========================================
    
    const UpgradeModal = {
        element: null,
        
        /**
         * Inicializa o modal de upgrade
         */
        init() {
            this.element = document.getElementById('upgradeModal');
            if (!this.element) {
                error('❌ [INTERCEPTOR] Modal de upgrade não encontrado no DOM');
                return false;
            }
            
            // Configurar botões do modal
            this.setupModalButtons();
            
            log('✅ [INTERCEPTOR] Modal de upgrade inicializado');
            return true;
        },
        
        /**
         * Configura os botões do modal
         */
        setupModalButtons() {
            // Botão "Ver Planos"
            const viewPlansBtn = this.element.querySelector('.upgrade-modal-cta');
            if (viewPlansBtn) {
                viewPlansBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    log('🔗 [INTERCEPTOR] Redirecionando para planos.html');
                    window.location.href = 'planos.html';
                });
            }
            
            // Botão "Agora não" (fechar)
            const closeBtn = this.element.querySelector('.upgrade-modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.hide();
                });
            }
            
            // Fechar ao clicar fora do modal
            this.element.addEventListener('click', (e) => {
                if (e.target === this.element) {
                    this.hide();
                }
            });
            
            // Fechar com ESC
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isVisible()) {
                    this.hide();
                }
            });
        },
        
        /**
         * Exibe o modal de upgrade
         */
        show() {
            if (!this.element) {
                error('❌ [INTERCEPTOR] Não é possível mostrar modal: elemento não inicializado');
                return;
            }
            
            log('🔓 [INTERCEPTOR] Exibindo modal de upgrade');
            this.element.classList.add('visible');
            
            // Acessibilidade: focar no modal
            const firstFocusable = this.element.querySelector('button');
            if (firstFocusable) {
                setTimeout(() => firstFocusable.focus(), 100);
            }
        },
        
        /**
         * Oculta o modal de upgrade
         */
        hide() {
            if (!this.element) return;
            
            log('🔒 [INTERCEPTOR] Ocultando modal de upgrade');
            this.element.classList.remove('visible');
        },
        
        /**
         * Verifica se o modal está visível
         */
        isVisible() {
            return this.element && this.element.classList.contains('visible');
        }
    };
    
    // ========================================
    // 🛡️ NEUTRALIZADOR DE HANDLERS INLINE
    // ========================================
    
    /**
     * Neutraliza onclick inline e remove TODOS os listeners de um botão
     * Usa técnica de clonagem para garantir limpeza total
     */
    function neutralizeButton(button) {
        if (!button) return null;
        
        // 1. Armazenar handler original (para debug/restauração)
        if (button.onclick) {
            originalHandlers.set(button, button.onclick);
            log('📦 [INTERCEPTOR] Handler original armazenado:', button.textContent.trim());
        }
        
        // 2. Remover onclick inline
        button.onclick = null;
        button.removeAttribute('onclick');
        
        // 3. CLONAR o nó para remover TODOS os listeners invisíveis
        const cleanButton = button.cloneNode(true);
        
        // 4. Substituir botão original pelo clone limpo
        button.parentNode.replaceChild(cleanButton, button);
        
        // 5. Adicionar novo handler de upgrade
        cleanButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            warn('🔒 [INTERCEPTOR] Ação premium bloqueada em modo reduced');
            log('🎯 [INTERCEPTOR] Botão:', cleanButton.textContent.trim());
            
            // Mostrar modal de upgrade
            UpgradeModal.show();
        });
        
        log('✅ [INTERCEPTOR] Botão neutralizado:', cleanButton.textContent.trim());
        
        return cleanButton;
    }
    
    /**
     * Neutraliza todos os botões premium quando em modo reduced
     */
    function neutralizeAllPremiumButtons() {
        if (!isReducedMode()) {
            log('✅ [INTERCEPTOR] Modo FULL detectado - botões mantidos intactos');
            return;
        }
        
        warn('🔒 [INTERCEPTOR] Modo REDUCED detectado - neutralizando botões premium...');
        
        let neutralizedCount = 0;
        
        PREMIUM_BUTTON_SELECTORS.forEach(selector => {
            const buttons = document.querySelectorAll(selector);
            
            buttons.forEach(button => {
                neutralizeButton(button);
                neutralizedCount++;
            });
        });
        
        if (neutralizedCount > 0) {
            log(`✅ [INTERCEPTOR] ${neutralizedCount} botão(ões) neutralizado(s) com sucesso`);
        } else {
            warn('⚠️ [INTERCEPTOR] Nenhum botão premium encontrado para neutralizar');
        }
    }
    
    /**
     * Restaura botões ao estado original (para modo full)
     * Útil para debugging ou mudança dinâmica de modo
     */
    function restoreAllButtons() {
        log('🔄 [INTERCEPTOR] Restaurando botões ao estado original...');
        
        // Esta função recarrega a página para garantir estado limpo
        // Alternativa: implementar lógica de restauração manual se necessário
        window.location.reload();
    }
    
    // ========================================
    // 🚀 INICIALIZAÇÃO
    // ========================================
    
    /**
     * Inicializa o sistema de interceptação
     */
    function initializeInterceptor() {
        log('🚀 [INTERCEPTOR] Inicializando sistema de neutralização...');
        
        // 1. Inicializar modal
        if (!UpgradeModal.init()) {
            error('❌ [INTERCEPTOR] Falha ao inicializar modal - sistema desabilitado');
            return;
        }
        
        // 2. Verificar modo atual
        const currentMode = isReducedMode() ? 'REDUCED' : 'FULL';
        log('🎯 [INTERCEPTOR] Modo detectado:', currentMode);
        
        // 3. Neutralizar botões se em modo reduced
        neutralizeAllPremiumButtons();
        
        // 4. Log de configuração
        log('📋 [INTERCEPTOR] Botões monitorados:', PREMIUM_BUTTON_SELECTORS);
        
        // 5. Expor API global para debug
        window.__INTERCEPTOR_DEBUG__ = {
            isReducedMode,
            showModal: () => UpgradeModal.show(),
            hideModal: () => UpgradeModal.hide(),
            neutralizeButtons: neutralizeAllPremiumButtons,
            restoreButtons: restoreAllButtons,
            checkMode: () => {
                const mode = isReducedMode() ? 'REDUCED' : 'FULL';
                log('🔍 Modo atual:', mode);
                log('📊 Estado da análise:', window.currentModalAnalysis);
                log('🏷️ APP_MODE:', window.APP_MODE);
                return mode;
            },
            getOriginalHandlers: () => {
                console.table(Array.from(originalHandlers.entries()).map(([btn, handler]) => ({
                    button: btn.textContent?.trim() || 'Unknown',
                    hasHandler: !!handler
                })));
            }
        };
        
        log('✅ [INTERCEPTOR] Sistema ativo e funcional');
        log('💡 Debug disponível: window.__INTERCEPTOR_DEBUG__');
    }
    
    // ========================================
    // 🔄 OBSERVADOR DE MUDANÇAS DE MODO
    // ========================================
    
    /**
     * Monitora mudanças no modo e re-aplica neutralização se necessário
     * Útil se o modo mudar dinamicamente (ex: após login/upgrade)
     */
    function watchModeChanges() {
        let lastMode = isReducedMode();
        
        setInterval(() => {
            const currentMode = isReducedMode();
            
            if (currentMode !== lastMode) {
                log('🔄 [INTERCEPTOR] Mudança de modo detectada:', 
                    lastMode ? 'REDUCED' : 'FULL', '→', 
                    currentMode ? 'REDUCED' : 'FULL'
                );
                
                if (currentMode) {
                    // Mudou para reduced: neutralizar botões
                    neutralizeAllPremiumButtons();
                } else {
                    // Mudou para full: recarregar página para restaurar
                    log('🔄 [INTERCEPTOR] Modo FULL ativado - recarregando para restaurar estado...');
                    setTimeout(() => window.location.reload(), 500);
                }
                
                lastMode = currentMode;
            }
        }, 1000); // Verificar a cada 1 segundo
    }
    
    // ========================================
    // 🎬 AUTO-INICIALIZAÇÃO
    // ========================================
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeInterceptor();
            watchModeChanges();
        });
    } else {
        initializeInterceptor();
        watchModeChanges();
    }
    
})();
