// 🎯 FIRST ANALYSIS UPGRADE CTA - SoundyAI
// Sistema de CTA de upgrade inteligente para primeira análise FREE
// ✅ REGRAS:
// - Aparece SOMENTE na PRIMEIRA análise FULL do plano FREE
// - Não aparece para planos pagos
// - Não aparece nas análises seguintes (reduced mode)
// - Timer de 25 segundos após renderização completa
// - Intercepta botões premium (PDF, IA, Correção) apenas na primeira análise

(function() {
    'use strict';
    
    // ========================================
    // 🎯 CONFIGURAÇÃO
    // ========================================
    
    const CONFIG = {
        DEBUG: true, // Ativar logs de debug
        
        // Timer para auto-abrir CTA (em ms) - 25 segundos
        AUTO_OPEN_DELAY: 25000,
        
        // Botões premium que devem ser interceptados
        premiumButtonSelectors: [
            '#btnAskAI',
            '#btnDownloadReport',
            '#btnGenerateCorrectionPlan',
            'button[onclick*="sendModalAnalysisToChat"]',
            'button[onclick*="downloadModalAnalysis"]',
            'button[onclick*="handleCorrectionPlanClick"]',
            'button[onclick*="generatePDF"]'
        ],
        
        // Chave localStorage para persistência
        localStorageKey: 'soundy_first_analysis_cta_shown',
        
        // Chave Firestore para persistência
        firestoreField: 'hasCompletedFirstFreeAnalysis'
    };
    
    // ========================================
    // 🔍 LOGGING CONDICIONAL
    // ========================================
    
    function debugLog(...args) {
        if (CONFIG.DEBUG) {
            console.log('%c[FIRST-ANALYSIS-CTA]', 'color:#FF6B35;font-weight:bold;', ...args);
        }
    }
    
    function debugWarn(...args) {
        if (CONFIG.DEBUG) {
            console.warn('%c[FIRST-ANALYSIS-CTA]', 'color:#FF6B35;font-weight:bold;', ...args);
        }
    }
    
    function debugError(...args) {
        console.error('%c[FIRST-ANALYSIS-CTA]', 'color:#FF6B35;font-weight:bold;', ...args);
    }
    
    // ========================================
    // 🔐 PERSISTÊNCIA DE ESTADO
    // ========================================
    
    const PersistenceManager = {
        // Cache local para evitar múltiplas chamadas
        _cachedStatus: null,
        
        /**
         * Verifica se o CTA já foi mostrado (primeira análise já feita)
         * @returns {Promise<boolean>} true se já mostrou, false se não
         */
        async hasShownCTA() {
            // 1. Verificar cache primeiro
            if (this._cachedStatus !== null) {
                debugLog('📦 Status do cache:', this._cachedStatus);
                return this._cachedStatus;
            }
            
            // 2. Verificar localStorage (fallback rápido)
            const localValue = localStorage.getItem(CONFIG.localStorageKey);
            if (localValue === 'true') {
                debugLog('📦 CTA já mostrado (localStorage)');
                this._cachedStatus = true;
                return true;
            }
            
            // 3. Verificar Firestore (fonte principal)
            try {
                const user = await this._getCurrentUser();
                if (user && user[CONFIG.firestoreField] === true) {
                    debugLog('📦 CTA já mostrado (Firestore)');
                    this._cachedStatus = true;
                    // Sincronizar localStorage
                    localStorage.setItem(CONFIG.localStorageKey, 'true');
                    return true;
                }
            } catch (err) {
                debugWarn('⚠️ Erro ao verificar Firestore:', err);
            }
            
            debugLog('📦 CTA ainda não foi mostrado');
            this._cachedStatus = false;
            return false;
        },
        
        /**
         * Marca que o CTA foi mostrado
         * @returns {Promise<void>}
         */
        async markCTAShown() {
            debugLog('✅ Marcando CTA como mostrado...');
            
            // 1. Atualizar cache imediatamente
            this._cachedStatus = true;
            
            // 2. Atualizar localStorage (sempre)
            localStorage.setItem(CONFIG.localStorageKey, 'true');
            
            // 3. Atualizar Firestore (assíncrono)
            try {
                const uid = this._getCurrentUID();
                if (uid && window.firebase?.firestore) {
                    const db = window.firebase.firestore();
                    await db.collection('usuarios').doc(uid).update({
                        [CONFIG.firestoreField]: true,
                        firstFreeAnalysisCompletedAt: new Date().toISOString()
                    });
                    debugLog('✅ Firestore atualizado com sucesso');
                }
            } catch (err) {
                debugWarn('⚠️ Erro ao atualizar Firestore (não crítico):', err);
            }
        },
        
        /**
         * Obtém UID do usuário atual
         * @returns {string|null}
         */
        _getCurrentUID() {
            // Tentar múltiplas fontes
            if (window.firebase?.auth?.()?.currentUser?.uid) {
                return window.firebase.auth().currentUser.uid;
            }
            if (window.__SOUNDY_USER_UID__) {
                return window.__SOUNDY_USER_UID__;
            }
            if (window.currentUser?.uid) {
                return window.currentUser.uid;
            }
            return null;
        },
        
        /**
         * Obtém dados do usuário atual do Firestore
         * @returns {Promise<Object|null>}
         */
        async _getCurrentUser() {
            const uid = this._getCurrentUID();
            if (!uid || !window.firebase?.firestore) {
                return null;
            }
            
            try {
                const db = window.firebase.firestore();
                const doc = await db.collection('usuarios').doc(uid).get();
                return doc.exists ? doc.data() : null;
            } catch (err) {
                debugWarn('⚠️ Erro ao buscar usuário:', err);
                return null;
            }
        },
        
        /**
         * Reseta o cache (para debug)
         */
        resetCache() {
            this._cachedStatus = null;
            debugLog('🔄 Cache resetado');
        }
    };
    
    // ========================================
    // 🎯 DETECTOR DE CONTEXTO
    // ========================================
    
    const ContextDetector = {
        /**
         * Verifica se é a primeira análise FREE em modo FULL
         * @returns {Promise<boolean>}
         */
        async isFirstFreeFullAnalysis() {
            // 1. Verificar se CTA já foi mostrado
            const alreadyShown = await PersistenceManager.hasShownCTA();
            if (alreadyShown) {
                debugLog('❌ CTA já foi mostrado anteriormente');
                return false;
            }
            
            // 2. Obter análise atual
            const analysis = this._getCurrentAnalysis();
            if (!analysis) {
                debugLog('❌ Nenhuma análise disponível');
                return false;
            }
            
            // 3. ✅ NOVA VERIFICAÇÃO: Usar flag do backend se disponível
            if (analysis.isFirstFreeAnalysis === true) {
                debugLog('✅ Backend informou: É primeira análise FREE');
                return true;
            }
            
            // 4. Verificar se backend disse que NÃO é primeira análise
            if (analysis.hasCompletedFirstFreeAnalysis === true) {
                debugLog('❌ Backend informou: Já completou primeira análise');
                return false;
            }
            
            // 5. Fallback: Verificar manualmente se é plano FREE
            const plan = analysis.plan || 'free';
            if (plan !== 'free') {
                debugLog(`❌ Plano não é FREE (${plan})`);
                return false;
            }
            
            // 6. Verificar se é modo FULL (não reduced)
            const analysisMode = analysis.analysisMode || 'full';
            const isReduced = analysis.isReduced === true || analysisMode === 'reduced';
            if (isReduced) {
                debugLog('❌ Análise em modo REDUCED');
                return false;
            }
            
            // 7. Todas as condições atendidas
            debugLog('✅ É primeira análise FREE FULL - CTA deve ser exibido');
            return true;
        },
        
        /**
         * Verifica apenas se o contexto atual permite interceptação de botões
         * (sem verificar se CTA já foi mostrado)
         * @returns {boolean}
         */
        shouldInterceptButtons() {
            const analysis = this._getCurrentAnalysis();
            if (!analysis) return false;
            
            // ✅ NOVA VERIFICAÇÃO: Usar flag do backend se disponível
            if (analysis.isFirstFreeAnalysis === true) {
                // Verificar se CTA já foi mostrado (sem async para uso síncrono)
                const alreadyShown = localStorage.getItem(CONFIG.localStorageKey) === 'true';
                return !alreadyShown;
            }
            
            // Backend disse que NÃO é primeira análise
            if (analysis.hasCompletedFirstFreeAnalysis === true) {
                return false;
            }
            
            const plan = analysis.plan || 'free';
            if (plan !== 'free') return false;
            
            const analysisMode = analysis.analysisMode || 'full';
            const isReduced = analysis.isReduced === true || analysisMode === 'reduced';
            if (isReduced) return false;
            
            // Verificar se CTA já foi mostrado (sem async para uso síncrono)
            const alreadyShown = localStorage.getItem(CONFIG.localStorageKey) === 'true';
            if (alreadyShown) return false;
            
            return true;
        },
        
        /**
         * Obtém a análise atual de múltiplas fontes
         * @returns {Object|null}
         */
        _getCurrentAnalysis() {
            return window.currentModalAnalysis || 
                   window.__CURRENT_ANALYSIS__ || 
                   window.__soundyAI?.analysis ||
                   window.__LAST_ANALYSIS_RESULT__;
        }
    };
    
    // ========================================
    // 🪟 MODAL CTA
    // ========================================
    
    const UpgradeCtaModal = {
        element: null,
        timerId: null,
        isVisible: false,
        ctaDismissedThisSession: false, // Flag para não reabrir automaticamente
        
        /**
         * Inicializa o modal
         */
        init() {
            if (this.element) {
                debugLog('✅ Modal já inicializado');
                return;
            }
            
            this._createModal();
            this._setupEventHandlers();
            debugLog('✅ Modal de CTA inicializado');
        },
        
        /**
         * Cria o HTML do modal
         */
        _createModal() {
            const modalHTML = `
                <div id="firstAnalysisUpgradeCTA" class="first-analysis-cta-overlay" role="dialog" aria-modal="true" aria-labelledby="firstAnalysisCtaTitle">
                    <div class="first-analysis-cta-card">
                        <button class="first-analysis-cta-close" aria-label="Fechar">&times;</button>
                        
                        <div class="first-analysis-cta-icon">🚀</div>
                        
                        <h2 class="first-analysis-cta-title" id="firstAnalysisCtaTitle">
                            Quer destravar o próximo nível da sua análise?
                        </h2>
                        
                        <p class="first-analysis-cta-text">
                            Você já viu o diagnóstico. Agora destrave o <strong>plano de correção passo a passo</strong> 
                            e continue analisando <strong>sem limites</strong>.
                        </p>
                        
                        <div class="first-analysis-cta-features">
                            <div class="cta-feature">
                                <span class="cta-feature-icon">📋</span>
                                <span>Plano de correção personalizado</span>
                            </div>
                            <div class="cta-feature">
                                <span class="cta-feature-icon">🤖</span>
                                <span>Assistente IA ilimitado</span>
                            </div>
                            <div class="cta-feature">
                                <span class="cta-feature-icon">📄</span>
                                <span>Relatórios PDF profissionais</span>
                            </div>
                            <div class="cta-feature">
                                <span class="cta-feature-icon">♾️</span>
                                <span>Análises ilimitadas</span>
                            </div>
                        </div>
                        
                        <div class="first-analysis-cta-buttons">
                            <button class="first-analysis-cta-btn first-analysis-cta-primary" id="firstAnalysisCtaUpgrade">
                                ✨ Ver Planos
                            </button>
                            <button class="first-analysis-cta-btn first-analysis-cta-secondary" id="firstAnalysisCtaContinue">
                                Continuar grátis
                            </button>
                        </div>
                        
                        <p class="first-analysis-cta-disclaimer">
                            * Cancele a qualquer momento. Sem compromisso.
                        </p>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            this.element = document.getElementById('firstAnalysisUpgradeCTA');
            
            // Adicionar estilos
            this._addStyles();
        },
        
        /**
         * Adiciona estilos CSS
         */
        _addStyles() {
            if (document.getElementById('firstAnalysisCtaStyles')) return;
            
            const style = document.createElement('style');
            style.id = 'firstAnalysisCtaStyles';
            style.textContent = `
                .first-analysis-cta-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 999998;
                    background: rgba(0, 0, 0, 0.75);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.3s ease, visibility 0.3s ease;
                }
                
                .first-analysis-cta-overlay.visible {
                    opacity: 1;
                    visibility: visible;
                }
                
                .first-analysis-cta-card {
                    position: relative;
                    max-width: 520px;
                    width: 100%;
                    background: linear-gradient(145deg, #1a1f2e 0%, #0d1117 100%);
                    border: 1px solid rgba(255, 107, 53, 0.3);
                    border-radius: 20px;
                    box-shadow: 
                        0 25px 80px rgba(0, 0, 0, 0.6),
                        0 0 60px rgba(255, 107, 53, 0.1),
                        inset 0 1px 0 rgba(255, 255, 255, 0.05);
                    padding: 40px 35px;
                    transform: scale(0.9) translateY(20px);
                    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                    text-align: center;
                }
                
                .first-analysis-cta-overlay.visible .first-analysis-cta-card {
                    transform: scale(1) translateY(0);
                }
                
                .first-analysis-cta-close {
                    position: absolute;
                    top: 15px;
                    right: 18px;
                    width: 32px;
                    height: 32px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 50%;
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 20px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                }
                
                .first-analysis-cta-close:hover {
                    background: rgba(255, 107, 53, 0.2);
                    color: #FF6B35;
                    border-color: rgba(255, 107, 53, 0.3);
                }
                
                .first-analysis-cta-icon {
                    font-size: 56px;
                    margin-bottom: 20px;
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
                
                .first-analysis-cta-title {
                    font-family: 'Orbitron', 'Rajdhani', sans-serif;
                    font-size: 24px;
                    font-weight: 700;
                    color: #ffffff;
                    margin: 0 0 16px 0;
                    line-height: 1.3;
                }
                
                .first-analysis-cta-text {
                    font-family: 'Poppins', 'Inter', sans-serif;
                    font-size: 16px;
                    color: rgba(255, 255, 255, 0.8);
                    line-height: 1.6;
                    margin: 0 0 28px 0;
                }
                
                .first-analysis-cta-text strong {
                    color: #FF6B35;
                }
                
                .first-analysis-cta-features {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                    margin-bottom: 28px;
                    text-align: left;
                }
                
                .cta-feature {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    background: rgba(255, 107, 53, 0.08);
                    border: 1px solid rgba(255, 107, 53, 0.15);
                    border-radius: 10px;
                    font-size: 13px;
                    color: rgba(255, 255, 255, 0.9);
                    transition: all 0.2s ease;
                }
                
                .cta-feature:hover {
                    background: rgba(255, 107, 53, 0.12);
                    border-color: rgba(255, 107, 53, 0.25);
                }
                
                .cta-feature-icon {
                    font-size: 18px;
                }
                
                .first-analysis-cta-buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .first-analysis-cta-btn {
                    width: 100%;
                    padding: 16px 28px;
                    border: none;
                    border-radius: 12px;
                    font-family: 'Poppins', 'Inter', sans-serif;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                
                .first-analysis-cta-primary {
                    background: linear-gradient(135deg, #FF6B35 0%, #E85A24 100%);
                    color: #ffffff;
                    box-shadow: 
                        0 8px 24px rgba(255, 107, 53, 0.35),
                        inset 0 1px 0 rgba(255, 255, 255, 0.2);
                }
                
                .first-analysis-cta-primary:hover {
                    background: linear-gradient(135deg, #FF7F50 0%, #FF6B35 100%);
                    transform: translateY(-2px);
                    box-shadow: 
                        0 12px 32px rgba(255, 107, 53, 0.45),
                        inset 0 1px 0 rgba(255, 255, 255, 0.25);
                }
                
                .first-analysis-cta-secondary {
                    background: rgba(255, 255, 255, 0.03);
                    color: rgba(255, 255, 255, 0.7);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .first-analysis-cta-secondary:hover {
                    background: rgba(255, 255, 255, 0.06);
                    color: rgba(255, 255, 255, 0.9);
                    border-color: rgba(255, 255, 255, 0.15);
                }
                
                .first-analysis-cta-disclaimer {
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.4);
                    margin: 16px 0 0 0;
                }
                
                /* Responsivo */
                @media (max-width: 600px) {
                    .first-analysis-cta-card {
                        padding: 30px 20px;
                    }
                    
                    .first-analysis-cta-title {
                        font-size: 20px;
                    }
                    
                    .first-analysis-cta-text {
                        font-size: 14px;
                    }
                    
                    .first-analysis-cta-features {
                        grid-template-columns: 1fr;
                    }
                }
            `;
            document.head.appendChild(style);
        },
        
        /**
         * Configura event handlers
         */
        _setupEventHandlers() {
            // Botão "Ver Planos"
            const upgradeBtn = this.element.querySelector('#firstAnalysisCtaUpgrade');
            if (upgradeBtn) {
                upgradeBtn.addEventListener('click', () => {
                    debugLog('🚀 Clicou em Ver Planos');
                    
                    // Marcar CTA como mostrado
                    PersistenceManager.markCTAShown();
                    
                    // Tracking GA4
                    if (window.GATracking?.trackEvent) {
                        window.GATracking.trackEvent('first_analysis_cta_upgrade_clicked');
                    }
                    
                    // Redirecionar
                    window.location.href = 'planos.html';
                });
            }
            
            // Botão "Continuar grátis"
            const continueBtn = this.element.querySelector('#firstAnalysisCtaContinue');
            if (continueBtn) {
                continueBtn.addEventListener('click', () => {
                    debugLog('👋 Clicou em Continuar grátis');
                    
                    // Marcar que CTA foi mostrado e dismissado
                    PersistenceManager.markCTAShown();
                    this.ctaDismissedThisSession = true;
                    
                    // Tracking GA4
                    if (window.GATracking?.trackEvent) {
                        window.GATracking.trackEvent('first_analysis_cta_dismissed');
                    }
                    
                    // Fechar modal
                    this.hide();
                });
            }
            
            // Botão X
            const closeBtn = this.element.querySelector('.first-analysis-cta-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.ctaDismissedThisSession = true;
                    this.hide();
                });
            }
            
            // Clique fora do card
            this.element.addEventListener('click', (e) => {
                if (e.target === this.element) {
                    this.ctaDismissedThisSession = true;
                    this.hide();
                }
            });
            
            // ESC para fechar
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isVisible) {
                    this.ctaDismissedThisSession = true;
                    this.hide();
                }
            });
        },
        
        /**
         * Mostra o modal
         * @param {string} source - Fonte que abriu o modal ('auto' ou 'button')
         */
        show(source = 'auto') {
            if (!this.element) {
                this.init();
            }
            
            debugLog(`📢 Mostrando CTA (source: ${source})`);
            this.element.classList.add('visible');
            this.isVisible = true;
            
            // Tracking GA4
            if (window.GATracking?.trackEvent) {
                window.GATracking.trackEvent('first_analysis_cta_shown', { source });
            }
        },
        
        /**
         * Esconde o modal
         */
        hide() {
            if (this.element) {
                this.element.classList.remove('visible');
                this.isVisible = false;
                debugLog('👋 CTA fechado');
            }
        },
        
        /**
         * Inicia timer para auto-abrir
         */
        startAutoOpenTimer() {
            // Cancelar timer anterior se existir
            this.cancelAutoOpenTimer();
            
            debugLog(`⏱️ Iniciando timer de ${CONFIG.AUTO_OPEN_DELAY / 1000}s para auto-abrir CTA`);
            
            this.timerId = setTimeout(async () => {
                // Verificar se ainda deve mostrar
                if (this.ctaDismissedThisSession) {
                    debugLog('❌ CTA foi dismissado nesta sessão - não mostrar automaticamente');
                    return;
                }
                
                const shouldShow = await ContextDetector.isFirstFreeFullAnalysis();
                if (shouldShow) {
                    this.show('auto');
                } else {
                    debugLog('❌ Condições para CTA não atendidas - não mostrar');
                }
            }, CONFIG.AUTO_OPEN_DELAY);
        },
        
        /**
         * Cancela timer de auto-abrir
         */
        cancelAutoOpenTimer() {
            if (this.timerId) {
                clearTimeout(this.timerId);
                this.timerId = null;
                debugLog('⏱️ Timer de auto-abrir cancelado');
            }
        }
    };
    
    // ========================================
    // 🛡️ INTERCEPTADOR DE BOTÕES PREMIUM
    // ========================================
    
    const PremiumButtonInterceptor = {
        interceptedButtons: new WeakMap(),
        originalHandlers: new Map(),
        
        /**
         * Instala interceptadores em todos os botões premium
         */
        install() {
            debugLog('🛡️ Instalando interceptadores de botões premium...');
            
            // Instalar em todos os botões configurados
            CONFIG.premiumButtonSelectors.forEach(selector => {
                try {
                    const buttons = document.querySelectorAll(selector);
                    buttons.forEach(btn => this._interceptButton(btn));
                } catch (err) {
                    debugWarn(`⚠️ Erro ao selecionar ${selector}:`, err);
                }
            });
            
            // Observar novos botões que possam ser adicionados dinamicamente
            this._observeNewButtons();
            
            debugLog('✅ Interceptadores instalados');
        },
        
        /**
         * Intercepta um botão específico
         * @param {HTMLElement} button
         */
        _interceptButton(button) {
            if (this.interceptedButtons.has(button)) {
                return; // Já interceptado
            }
            
            const buttonText = button.textContent?.trim() || '';
            const buttonId = button.id || button.getAttribute('onclick') || buttonText.slice(0, 20);
            
            debugLog(`🎯 Interceptando botão: ${buttonId}`);
            
            // Guardar estado original
            this.interceptedButtons.set(button, {
                onclick: button.onclick,
                onclickAttr: button.getAttribute('onclick')
            });
            
            // Adicionar listener de interceptação (capturing phase)
            button.addEventListener('click', this._createInterceptHandler(buttonId), true);
        },
        
        /**
         * Cria handler de interceptação
         * @param {string} buttonId - ID para logging
         * @returns {Function}
         */
        _createInterceptHandler(buttonId) {
            return async (e) => {
                // Verificar se deve interceptar
                const shouldIntercept = ContextDetector.shouldInterceptButtons();
                const alreadyShown = localStorage.getItem(CONFIG.localStorageKey) === 'true';
                
                debugLog(`🔍 Verificando interceptação para ${buttonId}:`, {
                    shouldIntercept,
                    alreadyShown,
                    ctaDismissed: UpgradeCtaModal.ctaDismissedThisSession
                });
                
                if (!shouldIntercept || alreadyShown) {
                    debugLog('✅ Não interceptar - deixando passar');
                    return; // Deixar passar normalmente
                }
                
                // ✅ INTERCEPTAR
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                debugLog(`🚫 Botão interceptado: ${buttonId}`);
                
                // Mostrar CTA
                UpgradeCtaModal.show('button');
                
                // Tracking GA4
                if (window.GATracking?.trackEvent) {
                    window.GATracking.trackEvent('first_analysis_premium_button_blocked', {
                        button: buttonId
                    });
                }
            };
        },
        
        /**
         * Observa novos botões adicionados ao DOM
         */
        _observeNewButtons() {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType !== Node.ELEMENT_NODE) return;
                        
                        // Verificar se é um botão premium
                        CONFIG.premiumButtonSelectors.forEach(selector => {
                            try {
                                if (node.matches && node.matches(selector)) {
                                    this._interceptButton(node);
                                }
                                // Verificar descendentes
                                const descendants = node.querySelectorAll?.(selector);
                                descendants?.forEach(btn => this._interceptButton(btn));
                            } catch (err) {
                                // Selector inválido, ignorar
                            }
                        });
                    });
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    };
    
    // ========================================
    // 🎯 INTEGRAÇÃO COM ANÁLISE
    // ========================================
    
    const AnalysisIntegration = {
        /**
         * Hook que deve ser chamado quando a análise termina de renderizar
         */
        async onAnalysisRendered() {
            debugLog('🔔 Análise renderizada - verificando se deve mostrar CTA');
            
            const shouldShow = await ContextDetector.isFirstFreeFullAnalysis();
            
            if (shouldShow) {
                debugLog('✅ Condições atendidas - iniciando timer para CTA');
                UpgradeCtaModal.startAutoOpenTimer();
                PremiumButtonInterceptor.install();
            } else {
                debugLog('❌ Condições não atendidas - CTA não será mostrado');
            }
        }
    };
    
    // ========================================
    // 🚀 INICIALIZAÇÃO
    // ========================================
    
    function initialize() {
        debugLog('🚀 Inicializando sistema de First Analysis Upgrade CTA...');
        
        // 1. Inicializar modal
        UpgradeCtaModal.init();
        
        // 2. Hook no sistema de renderização de análise
        const originalDisplayModalResults = window.displayModalResults;
        
        if (typeof window.displayModalResults === 'function') {
            // Wrapper para detectar quando análise termina de renderizar
            const hookTimeout = null;
            
            // Observar quando modal de análise fica visível
            const analysisModal = document.getElementById('audioAnalysisModal');
            if (analysisModal) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.attributeName === 'style' || mutation.attributeName === 'class') {
                            const isVisible = analysisModal.style.display !== 'none' && 
                                            !analysisModal.classList.contains('hidden');
                            
                            if (isVisible) {
                                // Análise renderizada - aguardar um pouco para garantir que DOM está pronto
                                setTimeout(() => {
                                    AnalysisIntegration.onAnalysisRendered();
                                }, 1500); // 1.5s após modal visível
                            }
                        }
                    });
                });
                
                observer.observe(analysisModal, {
                    attributes: true,
                    attributeFilter: ['style', 'class']
                });
            }
        }
        
        // 3. Expor API para debug
        window.__FIRST_ANALYSIS_CTA__ = {
            showCTA: () => UpgradeCtaModal.show('manual'),
            hideCTA: () => UpgradeCtaModal.hide(),
            checkContext: () => ContextDetector.isFirstFreeFullAnalysis(),
            resetCache: () => {
                PersistenceManager.resetCache();
                localStorage.removeItem(CONFIG.localStorageKey);
            },
            getStatus: async () => ({
                hasShown: await PersistenceManager.hasShownCTA(),
                isFirstFreeFullAnalysis: await ContextDetector.isFirstFreeFullAnalysis(),
                ctaDismissedThisSession: UpgradeCtaModal.ctaDismissedThisSession
            })
        };
        
        debugLog('✅ Sistema de First Analysis Upgrade CTA inicializado');
        debugLog('💡 API de debug: window.__FIRST_ANALYSIS_CTA__');
    }
    
    // ========================================
    // 🎬 AUTO-INICIALIZAÇÃO
    // ========================================
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
})();
