// 🔒 INTERCEPTOR DE BOTÕES PREMIUM - MODO REDUCED
// Sistema isolado de interceptação de cliques para funcionalidades premium
// NÃO ALTERA NENHUMA FUNÇÃO EXISTENTE - Apenas intercepta em modo reduced

(function() {
    'use strict';
    
    console.log('🔒 [INTERCEPTOR] Carregando sistema de interceptação...');
    
    // ========================================
    // 🎯 CONFIGURAÇÃO
    // ========================================
    
    // IDs dos botões que devem ser interceptados em modo reduced
    // ⚠️ AJUSTE CONFORME NECESSÁRIO - Atualmente usando onclick detectável
    const PREMIUM_BUTTON_SELECTORS = [
        'button[onclick*="sendModalAnalysisToChat"]',  // Botão "Pedir Ajuda à IA"
        'button[onclick*="downloadModalAnalysis"]'     // Botão "Baixar Relatório"
    ];
    
    // ========================================
    // 🔍 FUNÇÃO DE DETECÇÃO DE MODO
    // ========================================
    
    /**
     * Detecta se o sistema está em modo reduced
     * Compatível com a arquitetura existente do projeto
     */
    function isReducedMode() {
        // Método 1: Verificar análise atual no modal
        const currentAnalysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__;
        if (currentAnalysis) {
            if (currentAnalysis.analysisMode === 'reduced') return true;
            if (currentAnalysis.plan === 'free') return true;
            if (currentAnalysis.isReduced === true) return true;
        }
        
        // Método 2: Verificar flag global (se existir)
        if (window.APP_MODE === 'reduced') return true;
        
        // Método 3: Verificar plano do usuário (se existir)
        if (window.userPlan === 'free') return true;
        
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
                console.error('❌ [INTERCEPTOR] Modal de upgrade não encontrado no DOM');
                return false;
            }
            
            // Configurar botões do modal
            this.setupModalButtons();
            
            console.log('✅ [INTERCEPTOR] Modal de upgrade inicializado');
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
                    console.log('🔗 [INTERCEPTOR] Redirecionando para planos.html');
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
                console.error('❌ [INTERCEPTOR] Não é possível mostrar modal: elemento não inicializado');
                return;
            }
            
            console.log('🔓 [INTERCEPTOR] Exibindo modal de upgrade');
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
            
            console.log('🔒 [INTERCEPTOR] Ocultando modal de upgrade');
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
    // 🛡️ INTERCEPTADOR DE CLIQUES
    // ========================================
    
    /**
     * Intercepta cliques em botões premium quando em modo reduced
     * Usa capture phase para garantir execução ANTES de qualquer listener existente
     */
    function interceptPremiumClick(event) {
        // Verificar se estamos em modo reduced
        if (!isReducedMode()) {
            // Modo full: não fazer nada, deixar fluxo normal continuar
            return;
        }
        
        // Verificar se o clique foi em um botão premium
        const target = event.target.closest(PREMIUM_BUTTON_SELECTORS.join(','));
        if (!target) {
            // Não é um botão premium
            return;
        }
        
        // 🔒 MODO REDUCED DETECTADO - BLOQUEAR EXECUÇÃO
        console.warn('🔒 [INTERCEPTOR] Modo reduced detectado - bloqueando ação premium');
        console.log('🎯 [INTERCEPTOR] Botão interceptado:', target.textContent.trim());
        
        // Prevenir qualquer ação
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        // Mostrar modal de upgrade
        UpgradeModal.show();
    }
    
    // ========================================
    // 🚀 INICIALIZAÇÃO
    // ========================================
    
    /**
     * Inicializa o sistema de interceptação
     */
    function initializeInterceptor() {
        console.log('🚀 [INTERCEPTOR] Inicializando sistema...');
        
        // 1. Inicializar modal
        if (!UpgradeModal.init()) {
            console.error('❌ [INTERCEPTOR] Falha ao inicializar modal - interceptação desabilitada');
            return;
        }
        
        // 2. Instalar interceptador global (capture phase)
        document.addEventListener('click', interceptPremiumClick, true);
        console.log('✅ [INTERCEPTOR] Interceptador instalado (capture phase)');
        
        // 3. Log de configuração
        console.log('📋 [INTERCEPTOR] Botões monitorados:', PREMIUM_BUTTON_SELECTORS);
        console.log('🎯 [INTERCEPTOR] Modo atual:', isReducedMode() ? 'REDUCED' : 'FULL');
        
        // 4. Expor API global para debug (opcional)
        window.__INTERCEPTOR_DEBUG__ = {
            isReducedMode,
            showModal: () => UpgradeModal.show(),
            hideModal: () => UpgradeModal.hide(),
            checkMode: () => {
                console.log('🔍 Modo atual:', isReducedMode() ? 'REDUCED' : 'FULL');
                console.log('📊 Estado da análise:', window.currentModalAnalysis);
            }
        };
        
        console.log('✅ [INTERCEPTOR] Sistema ativo e funcional');
        console.log('💡 Debug disponível: window.__INTERCEPTOR_DEBUG__');
    }
    
    // ========================================
    // 🎬 AUTO-INICIALIZAÇÃO
    // ========================================
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeInterceptor);
    } else {
        initializeInterceptor();
    }
    
})();
