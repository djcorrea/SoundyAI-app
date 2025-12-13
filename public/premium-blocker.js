// 🛡️ BLOQUEIO INQUEBRÁVEL - MODO REDUCED
// Sistema de defesa em profundidade para bloquear funcionalidades premium
// NÃO ALTERA LÓGICA EXISTENTE - Apenas adiciona guards e interceptadores

(function() {
    'use strict';
    
    console.log('🛡️ [BLOCKER] Inicializando sistema de bloqueio inquebrável...');
    
    // ========================================
    // 🎯 CONFIGURAÇÃO
    // ========================================
    
    const CONFIG = {
        // ✅ Seletores ESPECÍFICOS dos 2 botões premium (IA e PDF)
        buttonSelectors: [
            'button[onclick*="sendModalAnalysisToChat"]',
            'button[onclick*="downloadModalAnalysis"]',
            '#btnAskAI',
            '#btnDownloadReport',
            'button[data-feature="ai-help"]',
            'button[data-feature="pdf-download"]'
        ],
        
        // Funções que devem ser guardadas
        guardsNeeded: [
            'sendModalAnalysisToChat',
            'downloadModalAnalysis',
            'generatePDF',
            'generateDetailedReport',
            'downloadReport',
            'createPDF',
            'exportPDF',
            'startPdfGeneration'
        ],
        
        // ⚠️ CRÍTICO: Removido 'keydown' para NÃO bloquear F5/F12/DevTools
        // Eventos a serem bloqueados (SOMENTE nos botões específicos)
        eventsToBlock: [
            'click',
            'mousedown',
            'pointerdown',
            'touchstart'
            // 'keydown' REMOVIDO - não pode bloquear atalhos do navegador!
        ]
    };
    
    // ========================================
    // 🔍 DETECÇÃO DE MODO
    // ========================================
    
    function isReducedMode() {
        // ✅ PRIORIDADE 1: Sistema de capabilities (mais preciso)
        if (window.PlanCapabilities) {
            // Bloquear se qualquer feature premium está bloqueada
            return window.PlanCapabilities.shouldBlockPremiumFeatures();
        }
        
        // ✅ PRIORIDADE 2: APP_MODE (fallback)
        if (window.APP_MODE === 'reduced') return true;
        
        // ✅ PRIORIDADE 3: Análise atual
        const analysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__;
        if (analysis) {
            if (analysis.analysisMode === 'reduced') return true;
            if (analysis.isReduced === true) return true;
        }
        
        return false;
    }
    
    // ========================================
    // 🎨 MODAL DE UPGRADE
    // ========================================
    
    const UpgradeModal = {
        element: null,
        currentFeature: null,
        
        init() {
            // Verificar se modal já existe
            this.element = document.getElementById('premiumBlockModal');
            
            if (!this.element) {
                // Criar modal se não existir
                this.createModal();
            }
            
            this.setupEventHandlers();
            console.log('✅ [BLOCKER] Modal de upgrade inicializado');
        },
        
        createModal() {
            const modalHTML = `
                <div id="premiumBlockModal" class="premium-block-modal" role="dialog" aria-modal="true" aria-labelledby="premiumBlockTitle">
                    <div class="premium-block-card">
                        <div class="premium-block-icon">🔒</div>
                        <h2 class="premium-block-title" id="premiumBlockTitle">Recurso Premium</h2>
                        <p class="premium-block-text" id="premiumBlockText">
                            Este recurso está disponível apenas para usuários com plano premium.
                            Faça upgrade para desbloquear todas as funcionalidades avançadas.
                        </p>
                        <div class="premium-block-buttons">
                            <button class="premium-block-btn premium-block-cta">
                                ✨ Ver Planos
                            </button>
                            <button class="premium-block-btn premium-block-close">
                                Agora não
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // Adicionar ao body
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            this.element = document.getElementById('premiumBlockModal');
            
            // Adicionar estilos inline se CSS externo não existir
            if (!document.getElementById('premiumBlockStyles')) {
                const style = document.createElement('style');
                style.id = 'premiumBlockStyles';
                style.textContent = `
                    .premium-block-modal {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        z-index: 999999;
                        background: rgba(0, 0, 0, 0.85);
                        backdrop-filter: blur(8px);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                        opacity: 0;
                        visibility: hidden;
                        transition: opacity 0.3s ease, visibility 0.3s ease;
                    }
                    .premium-block-modal.visible {
                        opacity: 1;
                        visibility: visible;
                    }
                    .premium-block-card {
                        position: relative;
                        max-width: 480px;
                        width: 100%;
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        border: 2px solid rgba(74, 144, 226, 0.3);
                        border-radius: 16px;
                        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                        padding: 40px 30px;
                        transform: scale(0.9);
                        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    }
                    .premium-block-modal.visible .premium-block-card {
                        transform: scale(1);
                    }
                    .premium-block-icon {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 64px;
                        height: 64px;
                        margin: 0 auto 24px;
                        background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
                        border-radius: 50%;
                        font-size: 32px;
                    }
                    .premium-block-title {
                        font-family: 'Orbitron', sans-serif;
                        font-size: 24px;
                        font-weight: 700;
                        color: #ffffff;
                        text-align: center;
                        margin: 0 0 16px 0;
                    }
                    .premium-block-text {
                        font-family: 'Poppins', sans-serif;
                        font-size: 16px;
                        color: rgba(255, 255, 255, 0.85);
                        text-align: center;
                        line-height: 1.6;
                        margin: 0 0 32px 0;
                    }
                    .premium-block-buttons {
                        display: flex;
                        gap: 12px;
                        flex-direction: column;
                    }
                    .premium-block-btn {
                        width: 100%;
                        padding: 14px 24px;
                        border: none;
                        border-radius: 8px;
                        font-family: 'Poppins', sans-serif;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    }
                    .premium-block-cta {
                        background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
                        color: #ffffff;
                        box-shadow: 0 4px 16px rgba(74, 144, 226, 0.4);
                    }
                    .premium-block-cta:hover {
                        background: linear-gradient(135deg, #5ba3ff 0%, #4a90e2 100%);
                        transform: translateY(-2px);
                    }
                    .premium-block-close {
                        background: rgba(255, 255, 255, 0.05);
                        color: rgba(255, 255, 255, 0.7);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                    }
                    .premium-block-close:hover {
                        background: rgba(255, 255, 255, 0.1);
                        color: rgba(255, 255, 255, 0.9);
                    }
                `;
                document.head.appendChild(style);
            }
        },
        
        setupEventHandlers() {
            // Botão "Ver Planos"
            const ctaBtn = this.element.querySelector('.premium-block-cta');
            if (ctaBtn) {
                ctaBtn.addEventListener('click', () => {
                    console.log('🔗 [BLOCKER] Redirecionando para planos.html');
                    window.location.href = 'planos.html';
                });
            }
            
            // Botão "Agora não"
            const closeBtn = this.element.querySelector('.premium-block-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.hide());
            }
            
            // Fechar ao clicar fora
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
        
        show(feature = 'premium') {
            if (!this.element) {
                console.error('❌ [BLOCKER] Modal não inicializado');
                return;
            }
            
            this.currentFeature = feature;
            
            // Personalizar mensagem por tipo de recurso
            const messages = {
                'ai': 'O assistente de IA está disponível apenas para usuários premium. Faça upgrade para receber ajuda personalizada.',
                'pdf': 'A geração de relatórios está disponível apenas para usuários premium. Faça upgrade para exportar suas análises.',
                'premium': 'Este recurso está disponível apenas para usuários premium. Faça upgrade para desbloquear todas as funcionalidades.'
            };
            
            const textEl = this.element.querySelector('.premium-block-text');
            if (textEl) {
                textEl.textContent = messages[feature] || messages['premium'];
            }
            
            console.warn(`🔒 [BLOCKER] Bloqueando recurso: ${feature}`);
            this.element.classList.add('visible');
        },
        
        hide() {
            if (this.element) {
                this.element.classList.remove('visible');
                console.log('🔓 [BLOCKER] Modal fechado');
            }
        },
        
        isVisible() {
            return this.element && this.element.classList.contains('visible');
        }
    };
    
    // ========================================
    // 🛡️ CAMADA 1: GUARDS NOS ENTRYPOINTS
    // ========================================
    
    const FunctionGuards = {
        originalFunctions: new Map(),
        
        install() {
            console.log('🛡️ [BLOCKER] Verificando guards nos entrypoints...');
            
            let guardsInstalled = 0;
            let guardsSkipped = 0;
            
            CONFIG.guardsNeeded.forEach(fnName => {
                if (typeof window[fnName] === 'function') {
                    // ⚠️ VERIFICAR SE JÁ EXISTE GUARD NATIVO
                    const fnSource = window[fnName].toString();
                    const hasNativeGuard = fnSource.includes('[PREMIUM-GUARD]') || 
                                         fnSource.includes('window.APP_MODE === \'reduced\'') ||
                                         fnSource.includes('GUARD: Bloquear');
                    
                    if (hasNativeGuard) {
                        console.log(`   ✅ Guard nativo detectado: ${fnName} (não sobrescrever)`);
                        guardsSkipped++;
                        return; // NÃO SOBRESCREVER - guard já existe nativamente
                    }
                    
                    // Armazenar função original
                    this.originalFunctions.set(fnName, window[fnName]);
                    
                    // Criar função com guard
                    window[fnName] = function(...args) {
                        // GUARD: Verificar modo
                        if (isReducedMode()) {
                            console.warn(`🔒 [BLOCKER] Função bloqueada: ${fnName} (modo reduced)`);
                            
                            // Determinar tipo de recurso
                            const feature = fnName.includes('PDF') || fnName.includes('download') || fnName.includes('report') 
                                ? 'pdf' 
                                : fnName.includes('Chat') || fnName.includes('AI') || fnName.includes('help')
                                    ? 'ai'
                                    : 'premium';
                            
                            UpgradeModal.show(feature);
                            return; // EARLY RETURN - não executa nada
                        }
                        
                        // Modo full: executar normalmente
                        const original = FunctionGuards.originalFunctions.get(fnName);
                        return original.apply(this, args);
                    };
                    
                    guardsInstalled++;
                    console.log(`   ✅ Guard wrapper instalado: ${fnName}`);
                } else {
                    console.log(`   ⚠️ Função não encontrada: ${fnName}`);
                }
            });
            
            console.log(`✅ [BLOCKER] ${guardsInstalled} guards instalados, ${guardsSkipped} nativos preservados\n`);
        },
        
        uninstall() {
            console.log('🔄 [BLOCKER] Removendo guards...');
            
            this.originalFunctions.forEach((original, fnName) => {
                if (window[fnName]) {
                    window[fnName] = original;
                }
            });
            
            this.originalFunctions.clear();
            console.log('✅ [BLOCKER] Guards removidos');
        }
    };
    
    // ========================================
    // 🛡️ CAMADA 2: BLOQUEADOR GLOBAL DE EVENTOS
    // ========================================
    
    const EventBlocker = {
        handlers: [],
        
        install() {
            console.log('🛡️ [BLOCKER] Instalando bloqueador global de eventos...');
            
            CONFIG.eventsToBlock.forEach(eventType => {
                const handler = (e) => {
                    // Verificar se estamos em modo reduced
                    if (!isReducedMode()) return;
                    
                    const target = e.target;
                    
                    // ✅ VERIFICAÇÃO ESTRITA: Apenas nos 2 botões específicos
                    const isRestrictedButton = CONFIG.buttonSelectors.some(selector => {
                        try {
                            return target.matches(selector) || target.closest(selector);
                        } catch (err) {
                            return false;
                        }
                    });
                    
                    // ✅ Verificação por texto ESPECÍFICA: SOMENTE "Pedir Ajuda à IA" ou "Baixar Relatório"
                    // NUNCA "Escolher gênero" ou qualquer outro botão
                    const text = target.textContent?.trim() || '';
                    const isAIButton = text.includes('Pedir Ajuda à IA') || text.includes('🤖 Pedir');
                    const isPDFButton = text.includes('Baixar Relatório') || text.includes('📄 Baixar');
                    const isRestrictedByText = isAIButton || isPDFButton;
                    
                    // ❌ NUNCA bloquear se for "Escolher gênero" ou elementos do modal de gênero
                    const isGenreButton = text.includes('Escolher') || text.includes('gênero') || text.includes('Gênero');
                    const isGenreModal = target.closest('#genreModal') || target.closest('.genre-');
                    
                    if (isGenreButton || isGenreModal) {
                        console.log(`✅ [BLOCKER] Permitido: botão de gênero não é restrito`);
                        return; // ✅ NUNCA bloquear gênero
                    }
                    
                    if (isRestrictedButton || isRestrictedByText) {
                        // BLOQUEAR TUDO
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        
                        console.warn(`🚫 [BLOCKER] Evento bloqueado: ${eventType} em modo reduced`);
                        console.log(`   Target:`, text);
                        console.log(`   Plan:`, window.currentModalAnalysis?.plan);
                        console.log(`   Mode:`, window.currentModalAnalysis?.analysisMode);
                        console.log(`   Features:`, window.currentModalAnalysis?.planFeatures);
                        
                        // Determinar tipo de recurso
                        const feature = isPDFButton ? 'pdf' : isAIButton ? 'ai' : 'premium';
                        
                        // Abrir modal (apenas uma vez por clique)
                        if (eventType === 'click' && !UpgradeModal.isVisible()) {
                            UpgradeModal.show(feature);
                        }
                    }
                };
                
                // Instalar em CAPTURING phase (executar ANTES de qualquer outro)
                document.addEventListener(eventType, handler, true);
                
                this.handlers.push({ eventType, handler });
            });
            
            console.log(`✅ [BLOCKER] ${CONFIG.eventsToBlock.length} tipos de eventos bloqueados\n`);
        },
        
        uninstall() {
            console.log('🔄 [BLOCKER] Removendo bloqueador de eventos...');
            
            this.handlers.forEach(({ eventType, handler }) => {
                document.removeEventListener(eventType, handler, true);
            });
            
            this.handlers = [];
            console.log('✅ [BLOCKER] Bloqueador removido');
        }
    };
    
    // ========================================
    // 🛡️ CAMADA 3: NEUTRALIZADOR DE BOTÕES
    // ========================================
    
    const ButtonNeutralizer = {
        neutralizedButtons: new Map(),
        
        neutralize() {
            if (!isReducedMode()) {
                console.log('✅ [BLOCKER] Modo FULL - botões mantidos intactos');
                return;
            }
            
            console.log('🛡️ [BLOCKER] Neutralizando botões em modo reduced...');
            
            let neutralized = 0;
            
            CONFIG.buttonSelectors.forEach(selector => {
                try {
                    const buttons = document.querySelectorAll(selector);
                    
                    buttons.forEach(btn => {
                        if (this.neutralizedButtons.has(btn)) return; // Já neutralizado
                        
                        // Armazenar estado original
                        const originalState = {
                            onclick: btn.onclick,
                            onclickAttr: btn.getAttribute('onclick')
                        };
                        this.neutralizedButtons.set(btn, originalState);
                        
                        // Remover onclick
                        btn.onclick = null;
                        btn.removeAttribute('onclick');
                        
                        // Clonar para remover listeners
                        const clean = btn.cloneNode(true);
                        btn.replaceWith(clean);
                        
                        // Adicionar novo handler
                        clean.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            
                            const text = clean.textContent?.trim() || '';
                            const feature = text.includes('Relatório') || text.includes('📄')
                                ? 'pdf'
                                : 'ai';
                            
                            console.warn(`🔒 [BLOCKER] Clique bloqueado em: ${text}`);
                            UpgradeModal.show(feature);
                        });
                        
                        // Atualizar referência
                        this.neutralizedButtons.delete(btn);
                        this.neutralizedButtons.set(clean, originalState);
                        
                        neutralized++;
                    });
                } catch (err) {
                    console.error(`❌ [BLOCKER] Erro ao neutralizar: ${selector}`, err);
                }
            });
            
            console.log(`✅ [BLOCKER] ${neutralized} botão(ões) neutralizado(s)\n`);
        },
        
        restore() {
            console.log('🔄 [BLOCKER] Restaurando botões...');
            // Recarregar página para garantir estado limpo
            window.location.reload();
        }
    };
    
    // ========================================
    // 🚀 INICIALIZAÇÃO
    // ========================================
    
    function initialize() {
        console.log('🚀 [BLOCKER] Inicializando sistema de bloqueio...\n');
        
        // 1. Inicializar modal
        UpgradeModal.init();
        
        // 2. Instalar guards nos entrypoints
        FunctionGuards.install();
        
        // 3. Instalar bloqueador global
        EventBlocker.install();
        
        // 4. Neutralizar botões (se reduced)
        setTimeout(() => {
            ButtonNeutralizer.neutralize();
        }, 500);
        
        // 5. Monitorar mudanças de modo
        watchModeChanges();
        
        // 6. Expor API de debug
        window.__BLOCKER_DEBUG__ = {
            isReducedMode,
            showModal: (feature) => UpgradeModal.show(feature),
            hideModal: () => UpgradeModal.hide(),
            checkMode: () => {
                const mode = isReducedMode() ? 'REDUCED' : 'FULL';
                console.log('🔍 Modo atual:', mode);
                console.log('🏷️ APP_MODE:', window.APP_MODE);
                console.log('📊 Análise:', window.currentModalAnalysis);
                return mode;
            },
            reinstall: () => {
                FunctionGuards.uninstall();
                EventBlocker.uninstall();
                FunctionGuards.install();
                EventBlocker.install();
                ButtonNeutralizer.neutralize();
            },
            uninstall: () => {
                FunctionGuards.uninstall();
                EventBlocker.uninstall();
                ButtonNeutralizer.restore();
            }
        };
        
        console.log('✅ [BLOCKER] Sistema de bloqueio ATIVO');
        console.log('🎯 Modo atual:', isReducedMode() ? 'REDUCED' : 'FULL');
        console.log('💡 Debug: window.__BLOCKER_DEBUG__\n');
    }
    
    function watchModeChanges() {
        let lastMode = isReducedMode();
        
        setInterval(() => {
            const currentMode = isReducedMode();
            
            if (currentMode !== lastMode) {
                console.log('🔄 [BLOCKER] Modo mudou:', 
                    lastMode ? 'REDUCED' : 'FULL', '→', 
                    currentMode ? 'REDUCED' : 'FULL'
                );
                
                if (currentMode) {
                    // Mudou para reduced: reinstalar proteções
                    ButtonNeutralizer.neutralize();
                } else {
                    // Mudou para full: recarregar
                    ButtonNeutralizer.restore();
                }
                
                lastMode = currentMode;
            }
        }, 1000);
    }
    
    // Auto-inicializar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
})();
