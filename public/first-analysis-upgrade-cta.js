// 🎯 FIRST ANALYSIS UPGRADE CTA - SoundyAI V2
// Sistema de CTA de upgrade inteligente para primeira análise FREE
// ✅ CORREÇÕES V2:
// - Dispara SOMENTE após análise completa renderizada
// - Intercepta TODOS os botões premium (PDF, IA, Chat, Correção)
// - Remove disparo prematuro em DOMContentLoaded/modais

(function() {
    'use strict';
    
    // ========================================
    // 🎯 CONFIGURAÇÃO
    // ========================================
    
    const CONFIG = {
        DEBUG: true,
        AUTO_OPEN_DELAY: 25000, // 25 segundos
        localStorageKey: 'soundy_first_analysis_cta_shown',
        firestoreField: 'hasCompletedFirstFreeAnalysis'
    };
    
    function debugLog(...args) {
        if (CONFIG.DEBUG) {
            console.log('%c[FIRST-CTA-V2]', 'color:#FF6B35;font-weight:bold;', ...args);
        }
    }
    
    function debugWarn(...args) {
        if (CONFIG.DEBUG) {
            console.warn('%c[FIRST-CTA-V2]', 'color:#FF6B35;font-weight:bold;', ...args);
        }
    }
    
    function debugError(...args) {
        console.error('%c[FIRST-CTA-V2]', 'color:#FF6B35;font-weight:bold;', ...args);
    }
    
    // ========================================
    // 🔐 PERSISTÊNCIA
    // ========================================
    
    const PersistenceManager = {
        _cachedStatus: null,
        
        async hasShownCTA() {
            if (this._cachedStatus !== null) return this._cachedStatus;
            
            const localValue = localStorage.getItem(CONFIG.localStorageKey);
            if (localValue === 'true') {
                this._cachedStatus = true;
                return true;
            }
            
            try {
                const user = await this._getCurrentUser();
                if (user && user[CONFIG.firestoreField] === true) {
                    this._cachedStatus = true;
                    localStorage.setItem(CONFIG.localStorageKey, 'true');
                    return true;
                }
            } catch (err) {
                debugWarn('⚠️ Erro ao verificar Firestore:', err);
            }
            
            this._cachedStatus = false;
            return false;
        },
        
        async markCTAShown() {
            debugLog('✅ Marcando CTA como mostrado...');
            this._cachedStatus = true;
            localStorage.setItem(CONFIG.localStorageKey, 'true');
            
            try {
                const uid = this._getCurrentUID();
                if (uid && window.firebase?.firestore) {
                    const db = window.firebase.firestore();
                    await db.collection('usuarios').doc(uid).update({
                        [CONFIG.firestoreField]: true,
                        firstFreeAnalysisCompletedAt: new Date().toISOString()
                    });
                    debugLog('✅ Firestore atualizado');
                }
            } catch (err) {
                debugWarn('⚠️ Erro ao atualizar Firestore:', err);
            }
        },
        
        _getCurrentUID() {
            if (window.firebase?.auth?.()?.currentUser?.uid) {
                return window.firebase.auth().currentUser.uid;
            }
            if (window.__SOUNDY_USER_UID__) return window.__SOUNDY_USER_UID__;
            if (window.currentUser?.uid) return window.currentUser.uid;
            return null;
        },
        
        async _getCurrentUser() {
            const uid = this._getCurrentUID();
            if (!uid || !window.firebase?.firestore) return null;
            
            try {
                const db = window.firebase.firestore();
                const doc = await db.collection('usuarios').doc(uid).get();
                return doc.exists ? doc.data() : null;
            } catch (err) {
                return null;
            }
        },
        
        resetCache() {
            this._cachedStatus = null;
        }
    };
    
    // ========================================
    // 🔍 DETECTOR DE CONTEXTO
    // ========================================
    
    const ContextDetector = {
        async isFirstFreeFullAnalysis() {
            const alreadyShown = await PersistenceManager.hasShownCTA();
            if (alreadyShown) {
                debugLog('❌ CTA já mostrado anteriormente');
                return false;
            }
            
            const analysis = this._getCurrentAnalysis();
            if (!analysis) {
                debugLog('❌ Nenhuma análise disponível');
                return false;
            }
            
            // Backend flag (mais confiável)
            if (analysis.isFirstFreeAnalysis === true) {
                debugLog('✅ Backend: É primeira análise FREE');
                return true;
            }
            
            if (analysis.hasCompletedFirstFreeAnalysis === true) {
                debugLog('❌ Backend: Já completou primeira análise');
                return false;
            }
            
            // Fallback: verificação manual
            const plan = analysis.plan || 'free';
            if (plan !== 'free') {
                debugLog(`❌ Plano não é FREE (${plan})`);
                return false;
            }
            
            const analysisMode = analysis.analysisMode || 'full';
            const isReduced = analysis.isReduced === true || analysisMode === 'reduced';
            if (isReduced) {
                debugLog('❌ Análise em modo REDUCED');
                return false;
            }
            
            debugLog('✅ É primeira análise FREE FULL');
            return true;
        },
        
        shouldInterceptButtons() {
            const analysis = this._getCurrentAnalysis();
            if (!analysis) return false;
            
            if (analysis.isFirstFreeAnalysis === true) {
                const alreadyShown = localStorage.getItem(CONFIG.localStorageKey) === 'true';
                return !alreadyShown;
            }
            
            if (analysis.hasCompletedFirstFreeAnalysis === true) return false;
            
            const plan = analysis.plan || 'free';
            if (plan !== 'free') return false;
            
            const analysisMode = analysis.analysisMode || 'full';
            const isReduced = analysis.isReduced === true || analysisMode === 'reduced';
            if (isReduced) return false;
            
            const alreadyShown = localStorage.getItem(CONFIG.localStorageKey) === 'true';
            return !alreadyShown;
        },
        
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
        ctaDismissedThisSession: false,
        
        init() {
            if (this.element) return;
            
            this._createModal();
            this._setupEventHandlers();
            debugLog('✅ Modal inicializado');
        },
        
        _createModal() {
            const modalHTML = `
                <div id="firstAnalysisUpgradeCTA" class="first-analysis-cta-overlay" role="dialog" aria-modal="true">
                    <div class="first-analysis-cta-card">
                        <button class="first-analysis-cta-close" aria-label="Fechar">&times;</button>
                        <div class="first-analysis-cta-icon">🚀</div>
                        <h2 class="first-analysis-cta-title">Quer destravar o próximo nível da sua análise?</h2>
                        <p class="first-analysis-cta-text">
                            Você já viu o diagnóstico. Agora destrave o <strong>plano de correção passo a passo</strong> 
                            e continue analisando <strong>sem limites</strong>.
                        </p>
                        <div class="first-analysis-cta-features">
                            <div class="cta-feature"><span>📋</span> Plano de correção personalizado</div>
                            <div class="cta-feature"><span>🤖</span> Assistente IA ilimitado</div>
                            <div class="cta-feature"><span>📄</span> Relatórios PDF profissionais</div>
                            <div class="cta-feature"><span>♾️</span> Análises ilimitadas</div>
                        </div>
                        <div class="first-analysis-cta-buttons">
                            <button class="first-analysis-cta-btn primary" id="firstAnalysisCtaUpgrade">✨ Ver Planos</button>
                            <button class="first-analysis-cta-btn secondary" id="firstAnalysisCtaContinue">Continuar grátis</button>
                        </div>
                        <p class="first-analysis-cta-disclaimer">* Cancele a qualquer momento. Sem compromisso.</p>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            this.element = document.getElementById('firstAnalysisUpgradeCTA');
            this._addStyles();
        },
        
        _addStyles() {
            if (document.getElementById('firstAnalysisCtaStyles')) return;
            
            const style = document.createElement('style');
            style.id = 'firstAnalysisCtaStyles';
            style.textContent = `
                .first-analysis-cta-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 999998;
                    background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px);
                    display: flex; align-items: center; justify-content: center; padding: 20px;
                    opacity: 0; visibility: hidden; transition: opacity 0.3s ease, visibility 0.3s ease;
                }
                .first-analysis-cta-overlay.visible { opacity: 1; visibility: visible; }
                .first-analysis-cta-card {
                    position: relative; max-width: 520px; width: 100%;
                    background: linear-gradient(145deg, #1a1f2e 0%, #0d1117 100%);
                    border: 1px solid rgba(255, 107, 53, 0.3); border-radius: 20px;
                    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6), 0 0 60px rgba(255, 107, 53, 0.1);
                    padding: 40px 35px; text-align: center;
                    transform: scale(0.9) translateY(20px);
                    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .first-analysis-cta-overlay.visible .first-analysis-cta-card { transform: scale(1) translateY(0); }
                .first-analysis-cta-close {
                    position: absolute; top: 15px; right: 18px; width: 32px; height: 32px;
                    background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 50%; color: rgba(255, 255, 255, 0.6); font-size: 20px;
                    cursor: pointer; transition: all 0.2s ease;
                }
                .first-analysis-cta-close:hover {
                    background: rgba(255, 107, 53, 0.2); color: #FF6B35; border-color: rgba(255, 107, 53, 0.3);
                }
                .first-analysis-cta-icon { font-size: 56px; margin-bottom: 20px; animation: pulse 2s infinite; }
                @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
                .first-analysis-cta-title {
                    font-family: 'Orbitron', sans-serif; font-size: 24px; font-weight: 700;
                    color: #ffffff; margin: 0 0 16px 0; line-height: 1.3;
                }
                .first-analysis-cta-text {
                    font-size: 16px; color: rgba(255, 255, 255, 0.8); line-height: 1.6; margin: 0 0 28px 0;
                }
                .first-analysis-cta-text strong { color: #FF6B35; }
                .first-analysis-cta-features {
                    display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 28px;
                }
                .cta-feature {
                    display: flex; align-items: center; gap: 10px; padding: 10px 12px;
                    background: rgba(255, 107, 53, 0.08); border: 1px solid rgba(255, 107, 53, 0.15);
                    border-radius: 10px; font-size: 13px; color: rgba(255, 255, 255, 0.9);
                }
                .first-analysis-cta-buttons { display: flex; flex-direction: column; gap: 12px; }
                .first-analysis-cta-btn {
                    width: 100%; padding: 16px 28px; border: none; border-radius: 12px;
                    font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;
                }
                .first-analysis-cta-btn.primary {
                    background: linear-gradient(135deg, #FF6B35 0%, #E85A24 100%); color: #ffffff;
                    box-shadow: 0 8px 24px rgba(255, 107, 53, 0.35);
                }
                .first-analysis-cta-btn.primary:hover {
                    background: linear-gradient(135deg, #FF7F50 0%, #FF6B35 100%);
                    transform: translateY(-2px); box-shadow: 0 12px 32px rgba(255, 107, 53, 0.45);
                }
                .first-analysis-cta-btn.secondary {
                    background: rgba(255, 255, 255, 0.03); color: rgba(255, 255, 255, 0.7);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .first-analysis-cta-btn.secondary:hover {
                    background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.9);
                }
                .first-analysis-cta-disclaimer { font-size: 12px; color: rgba(255, 255, 255, 0.4); margin: 16px 0 0 0; }
                @media (max-width: 600px) {
                    .first-analysis-cta-card { padding: 30px 20px; }
                    .first-analysis-cta-title { font-size: 20px; }
                    .first-analysis-cta-features { grid-template-columns: 1fr; }
                }
            `;
            document.head.appendChild(style);
        },
        
        _setupEventHandlers() {
            const upgradeBtn = this.element.querySelector('#firstAnalysisCtaUpgrade');
            if (upgradeBtn) {
                upgradeBtn.addEventListener('click', () => {
                    debugLog('🚀 Upgrade clicked');
                    PersistenceManager.markCTAShown();
                    if (window.GATracking?.trackEvent) {
                        window.GATracking.trackEvent('first_analysis_cta_upgrade_clicked');
                    }
                    window.location.href = 'planos.html';
                });
            }
            
            const continueBtn = this.element.querySelector('#firstAnalysisCtaContinue');
            if (continueBtn) {
                continueBtn.addEventListener('click', () => {
                    debugLog('👋 Continuar grátis clicked');
                    PersistenceManager.markCTAShown();
                    this.ctaDismissedThisSession = true;
                    if (window.GATracking?.trackEvent) {
                        window.GATracking.trackEvent('first_analysis_cta_dismissed');
                    }
                    this.hide();
                });
            }
            
            const closeBtn = this.element.querySelector('.first-analysis-cta-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.ctaDismissedThisSession = true;
                    this.hide();
                });
            }
            
            this.element.addEventListener('click', (e) => {
                if (e.target === this.element) {
                    this.ctaDismissedThisSession = true;
                    this.hide();
                }
            });
            
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isVisible) {
                    this.ctaDismissedThisSession = true;
                    this.hide();
                }
            });
        },
        
        show(source = 'auto') {
            if (!this.element) this.init();
            
            debugLog(`📢 Mostrando CTA (source: ${source})`);
            this.element.classList.add('visible');
            this.isVisible = true;
            
            if (window.GATracking?.trackEvent) {
                window.GATracking.trackEvent('first_analysis_cta_shown', { source });
            }
        },
        
        hide() {
            if (this.element) {
                this.element.classList.remove('visible');
                this.isVisible = false;
                debugLog('👋 CTA fechado');
            }
        },
        
        startAutoOpenTimer() {
            this.cancelAutoOpenTimer();
            
            debugLog(`⏱️ Timer iniciado (${CONFIG.AUTO_OPEN_DELAY / 1000}s)`);
            
            this.timerId = setTimeout(async () => {
                if (this.ctaDismissedThisSession) {
                    debugLog('❌ CTA dismissado nesta sessão');
                    return;
                }
                
                const shouldShow = await ContextDetector.isFirstFreeFullAnalysis();
                if (shouldShow) {
                    this.show('auto');
                } else {
                    debugLog('❌ Condições não atendidas');
                }
            }, CONFIG.AUTO_OPEN_DELAY);
        },
        
        cancelAutoOpenTimer() {
            if (this.timerId) {
                clearTimeout(this.timerId);
                this.timerId = null;
                debugLog('⏱️ Timer cancelado');
            }
        }
    };
    
    // ========================================
    // 🛡️ INTERCEPTADOR DE BOTÕES
    // ========================================
    
    const ButtonInterceptor = {
        install() {
            debugLog('🛡️ Instalando interceptadores...');
            
            // Interceptar funções globais
            this._wrapFunction('sendModalAnalysisToChat', 'IA');
            this._wrapFunction('downloadModalAnalysis', 'PDF');
            this._wrapFunction('handleCorrectionPlanClick', 'Correção');
            
            debugLog('✅ Interceptadores instalados');
        },
        
        _wrapFunction(funcName, label) {
            if (typeof window[funcName] !== 'function') {
                debugWarn(`⚠️ Função ${funcName} não encontrada`);
                return;
            }
            
            const original = window[funcName];
            
            window[funcName] = async function(...args) {
                debugLog(`🔍 Interceptando ${label}...`);
                
                // Verificar se deve interceptar
                const shouldIntercept = ContextDetector.shouldInterceptButtons();
                
                if (!shouldIntercept) {
                    debugLog(`✅ ${label} - Passar adiante`);
                    return await original.apply(this, args);
                }
                
                // Interceptar e mostrar CTA
                debugLog(`🚫 ${label} - BLOQUEADO`);
                
                if (window.GATracking?.trackEvent) {
                    window.GATracking.trackEvent('first_analysis_premium_button_blocked', {
                        button: label
                    });
                }
                
                UpgradeCtaModal.show('button');
                return; // Não executar função original
            };
            
            debugLog(`✅ ${funcName} wrapeado`);
        }
    };
    
    // ========================================
    // 🔗 INTEGRAÇÃO COM ANÁLISE
    // ========================================
    
    const AnalysisIntegration = {
        async onAnalysisRendered() {
            debugLog('🔔 ═══════════════════════════════════════════');
            debugLog('🔔 Análise renderizada - verificando contexto');
            debugLog('🔔 ═══════════════════════════════════════════');
            
            const shouldShow = await ContextDetector.isFirstFreeFullAnalysis();
            
            if (shouldShow) {
                debugLog('✅ INICIAR TIMER');
                UpgradeCtaModal.startAutoOpenTimer();
                ButtonInterceptor.install();
            } else {
                debugLog('❌ Não iniciar timer');
            }
        }
    };
    
    // ========================================
    // 🎬 INICIALIZAÇÃO - CONEXÃO COM ANÁLISE
    // ========================================
    
    function initialize() {
        debugLog('🚀 Inicializando sistema V2...');
        
        // 1. Inicializar modal (sem mostrar)
        UpgradeCtaModal.init();
        
        // 2. ✅ HOOK NO PONTO CERTO: Após displayModalResults terminar
        // Método 1: Wrapper direto na função displayModalResults
        if (typeof window.displayModalResults === 'function') {
            const originalDisplayModalResults = window.displayModalResults;
            
            window.displayModalResults = async function(analysis) {
                debugLog('═══════════════════════════════════════════');
                debugLog('🎯 displayModalResults INICIOU');
                debugLog('═══════════════════════════════════════════');
                
                // Executar função original
                const result = await originalDisplayModalResults.call(this, analysis);
                
                // ✅ APÓS renderização completa, aguardar DOM estabilizar
                setTimeout(() => {
                    debugLog('═══════════════════════════════════════════');
                    debugLog('✅ displayModalResults TERMINOU - DOM pronto');
                    debugLog('═══════════════════════════════════════════');
                    AnalysisIntegration.onAnalysisRendered();
                }, 1500); // 1.5s para garantir que tudo renderizou
                
                return result;
            };
            
            debugLog('✅ Hook instalado em displayModalResults');
        } else {
            debugWarn('⚠️ displayModalResults não encontrada');
        }
        
        // 3. Expor API de debug
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
        
        debugLog('✅ Sistema V2 inicializado');
        debugLog('💡 API: window.__FIRST_ANALYSIS_CTA__');
    }
    
    // ✅ AGUARDAR CARREGAMENTO COMPLETO antes de inicializar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Aguardar um pouco mais para garantir que displayModalResults existe
            setTimeout(initialize, 500);
        });
    } else {
        setTimeout(initialize, 500);
    }
    
})();
