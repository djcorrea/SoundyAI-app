/* ============================================================================ */
/* 🔒 SISTEMA DE INTERCEPTAÇÃO DE BOTÕES - MODO REDUCED                        */
/* Bloqueia funcionalidades premium sem alterar código existente               */
/* ============================================================================ */

(function() {
    'use strict';
    
    console.log('🔒 Sistema de interceptação de botões - CARREGANDO...');
    
    /* ========================================================================== */
    /* CONFIGURAÇÃO                                                               */
    /* ========================================================================== */
    
    // Verificar se a variável global APP_MODE existe, caso contrário, usar plano do usuário
    const getAppMode = () => {
        // Prioridade 1: Variável global explícita
        if (window.APP_MODE) {
            return window.APP_MODE;
        }
        
        // Prioridade 2: Verificar plano do usuário via variável global
        if (window.currentUserPlan) {
            return window.currentUserPlan === 'gratis' ? 'reduced' : 'full';
        }
        
        // Fallback: modo full (não bloqueia)
        return 'full';
    };
    
    // Função auxiliar para verificar modo reduced
    const isReducedMode = () => {
        return getAppMode() === 'reduced' || getAppMode() === 'gratis';
    };
    
    /* ========================================================================== */
    /* CONTROLE DO MODAL                                                          */
    /* ========================================================================== */
    
    let modalElement = null;
    
    // Criar modal dinamicamente se não existir
    const createModal = () => {
        if (modalElement) return modalElement;
        
        const overlay = document.createElement('div');
        overlay.className = 'upgrade-modal-overlay';
        overlay.id = 'upgradeModalOverlay';
        
        overlay.innerHTML = `
            <div class="upgrade-modal-container" role="dialog" aria-labelledby="upgradeModalTitle" aria-describedby="upgradeModalText">
                <div class="upgrade-modal-icon">🔒</div>
                
                <h2 class="upgrade-modal-title" id="upgradeModalTitle">
                    Recurso Premium
                    <span class="upgrade-modal-badge">PLUS</span>
                </h2>
                
                <p class="upgrade-modal-text" id="upgradeModalText">
                    Este recurso faz parte do <strong>Plano Plus</strong>.<br>
                    Faça upgrade para ter acesso ilimitado a todas as funcionalidades.
                </p>
                
                <div class="upgrade-modal-buttons">
                    <a href="planos.html" class="upgrade-modal-btn upgrade-modal-btn-primary" id="upgradeModalGoToPlans">
                        ⭐ Ver Planos e Fazer Upgrade
                    </a>
                    <button class="upgrade-modal-btn upgrade-modal-btn-secondary" id="upgradeModalClose">
                        Agora não
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        modalElement = overlay;
        
        // Adicionar listeners
        const closeBtn = overlay.querySelector('#upgradeModalClose');
        closeBtn.addEventListener('click', closeModal);
        
        // Fechar ao clicar fora do modal
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });
        
        // Fechar com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('active')) {
                closeModal();
            }
        });
        
        console.log('✅ Modal de upgrade criado');
        return modalElement;
    };
    
    // Abrir modal
    const openModal = () => {
        const modal = createModal();
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevenir scroll
        console.log('🔓 Modal de upgrade aberto');
    };
    
    // Fechar modal
    const closeModal = () => {
        if (modalElement) {
            modalElement.classList.remove('active');
            document.body.style.overflow = ''; // Restaurar scroll
            console.log('🔒 Modal de upgrade fechado');
        }
    };
    
    /* ========================================================================== */
    /* SISTEMA DE INTERCEPTAÇÃO                                                   */
    /* ========================================================================== */
    
    // IDs dos botões que devem ser bloqueados
    // ⚠️ AJUSTE AQUI: Caso os IDs reais sejam diferentes
    const BLOCKED_BUTTON_SELECTORS = [
        // Seletor por onclick (usado no HTML atual)
        'button[onclick*="sendModalAnalysisToChat"]',
        'button[onclick*="downloadModalAnalysis"]'
    ];
    
    // Handler de interceptação
    const interceptClickHandler = (event) => {
        // Verificar se está em modo reduced
        if (!isReducedMode()) {
            // Modo full: não fazer nada, deixar fluxo normal acontecer
            return;
        }
        
        // Verificar se o elemento clicado é um dos botões bloqueados
        const clickedElement = event.target.closest('button');
        if (!clickedElement) return;
        
        // Verificar se o botão está na lista de bloqueados
        const isBlocked = BLOCKED_BUTTON_SELECTORS.some(selector => {
            return clickedElement.matches(selector);
        });
        
        if (isBlocked) {
            // BLOQUEAR: Impedir execução de qualquer listener
            event.preventDefault();
            event.stopImmediatePropagation();
            
            console.log('🚫 Clique bloqueado em modo reduced:', clickedElement);
            
            // Abrir modal de upgrade
            openModal();
        }
    };
    
    /* ========================================================================== */
    /* INICIALIZAÇÃO                                                              */
    /* ========================================================================== */
    
    const initialize = () => {
        // Adicionar interceptador na fase de captura (antes de qualquer outro listener)
        document.addEventListener('click', interceptClickHandler, true);
        
        console.log('✅ Sistema de interceptação inicializado');
        console.log('📊 Modo atual:', getAppMode());
        console.log('🔒 Botões bloqueados:', BLOCKED_BUTTON_SELECTORS.length);
        
        // Expor funções globalmente para debug/testes
        window.upgradeModal = {
            open: openModal,
            close: closeModal,
            isReducedMode: isReducedMode,
            getMode: getAppMode
        };
    };
    
    // Inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    console.log('🔒 Sistema de interceptação de botões - CARREGADO');
    
})();

/* ============================================================================ */
/* 🧪 FUNÇÕES DE DEBUG/TESTE (disponíveis no console)                          */
/* ============================================================================ */

// Testar modal: window.upgradeModal.open()
// Verificar modo: window.upgradeModal.getMode()
// Verificar se está bloqueado: window.upgradeModal.isReducedMode()
