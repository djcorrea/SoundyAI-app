// 🛡️ BLOQUEIO INQUEBRÁVEL - MODO REDUCED V2
// Sistema de defesa em profundidade para bloquear funcionalidades premium
// NÃO ALTERA LÓGICA EXISTENTE - Apenas adiciona guards e interceptadores

(function() {
    'use strict';
    
    // ========================================
    // 🎯 CONFIGURAÇÃO
    // ========================================
    
    const CONFIG = {
        // 🔇 DEBUG: false = silencioso, true = logs detalhados
        DEBUG: false,
        
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
    
    // Cache do último estado para só logar em mudança
    let lastBlockState = null;
    let lastPlan = null;
    
    // Log condicional
    function debugLog(...args) {
        if (CONFIG.DEBUG) {
            log(...args);
        }
    }
    
    // ========================================
    // 🔍 DETECÇÃO DE MODO (COM EARLY-RETURN)
    // ========================================
    
    /**
     * Verifica se deve bloquear features premium
     * REGRA CRÍTICA: SEM análise válida = SEM bloqueio
     * @returns {boolean} true se deve bloquear, false se pode executar
     */
    function isReducedMode() {
        // 🚫 CRITICAL: Buscar análise de TODAS as fontes possíveis
        const analysis = window.currentModalAnalysis || 
                        window.__CURRENT_ANALYSIS__ || 
                        window.__soundyAI?.analysis ||
                        window.__LAST_ANALYSIS_RESULT__;
        
        if (!analysis || typeof analysis !== 'object') {
            // Só loga se estado mudou
            if (lastBlockState !== 'no-analysis') {
                lastBlockState = 'no-analysis';
                debugLog('⚠️ [BLOCKER] Nenhuma análise carregada - permitindo acesso');
            }
            return false; // ✅ SEM BLOQUEIO quando não há análise
        }
        
        // Só loga detalhes se plano mudou
        if (lastPlan !== analysis.plan) {
            lastPlan = analysis.plan;
            debugLog('🔍 [BLOCKER] Análise encontrada:', {
                plan: analysis.plan,
                analysisMode: analysis.analysisMode,
                isReduced: analysis.isReduced
            });
        }
        
        // ✅ PRIORIDADE 1: Verificar flags explícitos da análise
        if (analysis.isReduced === true) {
            if (lastBlockState !== 'reduced-flag') {
                lastBlockState = 'reduced-flag';
                debugLog('🔒 [BLOCKER] Modo REDUCED detectado (isReduced: true)');
            }
            return true;
        }
        
        if (analysis.analysisMode === 'reduced') {
            if (lastBlockState !== 'reduced-mode') {
                lastBlockState = 'reduced-mode';
                debugLog('🔒 [BLOCKER] Modo REDUCED detectado (analysisMode: reduced)');
            }
            return true;
        }
        
        // ✅ PRIORIDADE 2: Plus sempre bloqueia IA/PDF (mesmo em modo full)
        if (analysis.plan === 'plus') {
            if (lastBlockState !== 'plus-blocked') {
                lastBlockState = 'plus-blocked';
                debugLog('🔒 [BLOCKER] Plano PLUS detectado - IA/PDF bloqueados');
            }
            return true; // Plus nunca tem IA/PDF
        }
        
        // ✅ PRIORIDADE 3: Free em modo FULL não bloqueia (trial)
        if (analysis.plan === 'free' && analysis.analysisMode === 'full') {
            if (lastBlockState !== 'free-trial') {
                lastBlockState = 'free-trial';
                debugLog('🎁 [BLOCKER] FREE TRIAL (modo FULL) - permitindo acesso');
            }
            return false; // Free trial tem tudo
        }
        
        // ✅ FALLBACK: Pro, DJ Beta ou STUDIO sempre liberado
        // ✅ ATUALIZADO 2026-01-06: STUDIO adicionado
        if (analysis.plan === 'pro' || analysis.plan === 'dj' || analysis.plan === 'studio') {
            if (lastBlockState !== 'premium-allowed') {
                lastBlockState = 'premium-allowed';
                debugLog('✅ [BLOCKER] Plano PRO/DJ/STUDIO - acesso total');
            }
            return false;
        }
        
        // ⚠️ Se chegou aqui e não identificou, não bloqueia por segurança
        if (lastBlockState !== 'undefined-allowed') {
            lastBlockState = 'undefined-allowed';
            debugLog('⚠️ [BLOCKER] Estado indefinido - permitindo acesso por segurança');
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
            debugLog('✅ [BLOCKER] Modal de upgrade inicializado');
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
                    debugLog('🔗 [BLOCKER] Redirecionando para planos.html');
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
                error('❌ [BLOCKER] Modal não inicializado');
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
            
            warn(`🔒 [BLOCKER] Bloqueando recurso: ${feature}`);
            this.element.classList.add('visible');
        },
        
        hide() {
            if (this.element) {
                this.element.classList.remove('visible');
                debugLog('🔓 [BLOCKER] Modal fechado');
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
            debugLog('🛡️ [BLOCKER] Verificando guards nos entrypoints...');
            
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
                        debugLog(`   ✅ Guard nativo detectado: ${fnName} (não sobrescrever)`);
                        guardsSkipped++;
                        return; // NÃO SOBRESCREVER - guard já existe nativamente
                    }
                    
                    // Armazenar função original
                    this.originalFunctions.set(fnName, window[fnName]);
                    
                    // Criar função com guard
                    window[fnName] = function(...args) {
                        // 🚫 CRITICAL: Verificar se há análise válida
                        const analysis = window.currentModalAnalysis || 
                                        window.__CURRENT_ANALYSIS__ || 
                                        window.__soundyAI?.analysis ||
                                        window.__LAST_ANALYSIS_RESULT__;
                        
                        if (!analysis || typeof analysis !== 'object') {
                            debugLog(`⚠️ [BLOCKER] ${fnName}: Nenhuma análise carregada - executando normalmente`);
                            const original = FunctionGuards.originalFunctions.get(fnName);
                            return original.apply(this, args);
                        }
                        
                        // GUARD: Verificar modo
                        if (isReducedMode()) {
                            debugLog(`🔒 [BLOCKER] Função bloqueada: ${fnName}`);
                            debugLog(`   Plan: ${analysis.plan}, Mode: ${analysis.analysisMode}, isReduced: ${analysis.isReduced}`);
                            
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
                        debugLog(`✅ [BLOCKER] ${fnName}: Executando normalmente (modo FULL)`);
                        const original = FunctionGuards.originalFunctions.get(fnName);
                        return original.apply(this, args);
                    };
                    
                    guardsInstalled++;
                    debugLog(`   ✅ Guard wrapper instalado: ${fnName}`);
                } else {
                    debugLog(`   ⚠️ Função não encontrada: ${fnName}`);
                }
            });
            
            debugLog(`✅ [BLOCKER] ${guardsInstalled} guards instalados, ${guardsSkipped} nativos preservados\n`);
        },
        
        uninstall() {
            debugLog('🔄 [BLOCKER] Removendo guards...');
            
            this.originalFunctions.forEach((original, fnName) => {
                if (window[fnName]) {
                    window[fnName] = original;
                }
            });
            
            this.originalFunctions.clear();
            debugLog('✅ [BLOCKER] Guards removidos');
        }
    };
    
    // ========================================
    // 🛡️ CAMADA 2: BLOQUEADOR GLOBAL DE EVENTOS
    // ========================================
    
    const EventBlocker = {
        handlers: [],
        
        install() {
            debugLog('🛡️ [BLOCKER] Instalando bloqueador global de eventos...');
            
            CONFIG.eventsToBlock.forEach(eventType => {
                const handler = (e) => {
                    // 🚫 CRITICAL: Verificar análise válida ANTES de qualquer lógica
                    const analysis = window.currentModalAnalysis || 
                                    window.__CURRENT_ANALYSIS__ || 
                                    window.__soundyAI?.analysis ||
                                    window.__LAST_ANALYSIS_RESULT__;
                    
                    if (!analysis || typeof analysis !== 'object') {
                        // SEM análise carregada = SEM bloqueio
                        return;
                    }
                    
                    const target = e.target;
                    const text = target.textContent?.trim() || '';
                    
                    // ❌ NUNCA bloquear gênero, dropdowns, inputs gerais
                    const isGenreButton = text.includes('Escolher') || text.includes('gênero') || text.includes('Gênero');
                    const isGenreModal = target.closest('#genreModal') || target.closest('.genre-');
                    const isSelect = target.closest('select') || target.tagName === 'SELECT';
                    const isInput = target.closest('input') || target.tagName === 'INPUT';
                    
                    if (isGenreButton || isGenreModal || isSelect || isInput) {
                        return; // ✅ NUNCA bloquear esses elementos
                    }
                    
                    // ✅ VERIFICAÇÃO ESTRITA: Apenas botões IA e PDF
                    const isAIButton = text.includes('Pedir Ajuda à IA') || text.includes('🤖 Pedir');
                    const isPDFButton = text.includes('Baixar Relatório') || text.includes('📄 Baixar');
                    
                    if (!isAIButton && !isPDFButton) {
                        // Não é botão restrito, permitir
                        return;
                    }
                    
                    // ✅ Verificar seletores específicos também
                    const isRestrictedButton = CONFIG.buttonSelectors.some(selector => {
                        try {
                            return target.matches(selector) || target.closest(selector);
                        } catch (err) {
                            return false;
                        }
                    });
                    
                    if (!isRestrictedButton && !isAIButton && !isPDFButton) {
                        return; // Não é botão restrito
                    }
                    
                    // 🔍 Verificar se deve bloquear baseado na análise atual
                    const shouldBlock = isReducedMode();
                    
                    if (!shouldBlock) {
                        debugLog(`✅ [BLOCKER] Permitido: ${text}`);
                        debugLog(`   Plan: ${analysis.plan}, Mode: ${analysis.analysisMode}, isReduced: ${analysis.isReduced}`);
                        return; // ✅ Modo FULL ou Pro - permitir
                    }
                    
                    // 🚫 BLOQUEAR: Análise em reduced ou Plus
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    warn(`🚫 [BLOCKER] Evento bloqueado: ${eventType}`);
                    debugLog(`   Target: ${text}`);
                    debugLog(`   Plan: ${analysis.plan}`);
                    debugLog(`   Mode: ${analysis.analysisMode}`);
                    debugLog(`   isReduced: ${analysis.isReduced}`);
                    debugLog(`   Features:`, analysis.planFeatures);
                    
                    // Determinar tipo de recurso
                    const feature = isPDFButton ? 'pdf' : isAIButton ? 'ai' : 'premium';
                    
                    // Abrir modal (apenas uma vez por clique)
                    if (eventType === 'click' && !UpgradeModal.isVisible()) {
                        UpgradeModal.show(feature);
                    }
                };
                
                // Instalar em CAPTURING phase (executar ANTES de qualquer outro)
                document.addEventListener(eventType, handler, true);
                
                this.handlers.push({ eventType, handler });
            });
            
            debugLog(`✅ [BLOCKER] ${CONFIG.eventsToBlock.length} tipos de eventos bloqueados\n`);
        },
        
        uninstall() {
            debugLog('🔄 [BLOCKER] Removendo bloqueador de eventos...');
            
            this.handlers.forEach(({ eventType, handler }) => {
                document.removeEventListener(eventType, handler, true);
            });
            
            this.handlers = [];
            debugLog('✅ [BLOCKER] Bloqueador removido');
        }
    };
    
    // ========================================
    // 🛡️ CAMADA 3: NEUTRALIZADOR DE BOTÕES
    // ========================================
    
    const ButtonNeutralizer = {
        neutralizedButtons: new Map(),
        
        neutralize() {
            // 🚫 CRITICAL: Verificar análise válida antes de neutralizar
            const analysis = window.currentModalAnalysis || 
                            window.__CURRENT_ANALYSIS__ || 
                            window.__soundyAI?.analysis ||
                            window.__LAST_ANALYSIS_RESULT__;
            
            if (!analysis || typeof analysis !== 'object') {
                debugLog('⚠️ [BLOCKER] Nenhuma análise carregada - botões mantidos intactos');
                return;
            }
            
            if (!isReducedMode()) {
                debugLog('✅ [BLOCKER] Modo FULL - botões mantidos intactos');
                return;
            }
            
            debugLog('🛡️ [BLOCKER] Neutralizando botões em modo reduced...');
            debugLog(`   Plan: ${analysis.plan}, Mode: ${analysis.analysisMode}, isReduced: ${analysis.isReduced}`);
            
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
                            
                            warn(`🔒 [BLOCKER] Clique bloqueado em: ${text}`);
                            UpgradeModal.show(feature);
                        });
                        
                        // Atualizar referência
                        this.neutralizedButtons.delete(btn);
                        this.neutralizedButtons.set(clean, originalState);
                        
                        neutralized++;
                    });
                } catch (err) {
                    error(`❌ [BLOCKER] Erro ao neutralizar: ${selector}`, err);
                }
            });
            
            debugLog(`✅ [BLOCKER] ${neutralized} botão(ões) neutralizado(s)\n`);
        },
        
        restore() {
            debugLog('🔄 [BLOCKER] Restaurando botões...');
            // Recarregar página para garantir estado limpo
            window.location.reload();
        }
    };
    
    // ========================================
    // 🚀 INICIALIZAÇÃO
    // ========================================
    
    function initialize() {
        // Log silencioso - só no DEBUG
        debugLog('🚀 [BLOCKER] Inicializando sistema de bloqueio...\n');
        
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
                // checkMode sempre loga (chamado manualmente)
                log('🔍 Modo atual:', mode);
                log('🏷️ APP_MODE:', window.APP_MODE);
                log('📊 Análise:', window.currentModalAnalysis);
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
        
        debugLog('✅ [BLOCKER] Sistema de bloqueio ATIVO');
        debugLog('🎯 Modo atual:', isReducedMode() ? 'REDUCED' : 'FULL');
        debugLog('💡 Debug: window.__BLOCKER_DEBUG__\n');
    }
    
    function watchModeChanges() {
        let lastMode = isReducedMode();
        
        setInterval(() => {
            const currentMode = isReducedMode();
            
            if (currentMode !== lastMode) {
                // Log apenas em mudança real de modo (importante)
                log('🔄 [BLOCKER] Modo mudou:', 
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
