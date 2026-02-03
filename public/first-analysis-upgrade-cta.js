// 🎯 FIRST ANALYSIS UPGRADE CTA - SoundyAI V3
// Sistema completo de CTA de upgrade para primeira análise FREE
// ✅ FUNCIONALIDADES V3:
// - Timer de 35 segundos
// - Ver Planos abre em nova aba
// - Blur overlay nas sugestões inteligentes
// - Bloqueio total dos botões IA/PDF
// - Logs específicos nos 3 pontos de disparo

(function() {
    'use strict';
    
    // ========================================
    // 🎯 CONFIGURAÇÃO
    // ========================================
    
    const CONFIG = {
        DEBUG: true,
        AUTO_OPEN_DELAY: 35000, // 35 segundos (aumentado de 25s)
        localStorageKey: 'soundy_first_analysis_cta_shown',
        firestoreField: 'hasCompletedFirstFreeAnalysis',
        
        // Seletores para sugestões inteligentes
        suggestionsSelectors: [
            '.enhanced-card',
            '.ultra-advanced-v2',
            '#ai-suggestions-section',
            '.ai-suggestions-container',
            '#aiSuggestionsContainer',
            '.suggestion-item',
            '.suggestions-list',
            '.suggestions-section'
        ]
    };
    
    // ========================================
    // 📊 LOGS ESPECÍFICOS (apenas nos 3 pontos)
    // ========================================
    
    function logCtaShown(source) {
        const timestamp = new Date().toISOString();
        const message = `[FIRST-CTA] ✅ CTA exibido por: ${source}`;
        
        console.log('%c' + message, 'color:#FF6B35;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;');
        console.log('%c[FIRST-CTA] Timestamp: ' + timestamp, 'color:#888;');
        
        // GA4 tracking
        if (window.GATracking?.trackEvent) {
            window.GATracking.trackEvent('first_analysis_cta_shown', { 
                source,
                timestamp 
            });
        }
    }
    
    function debugLog(...args) {
        if (CONFIG.DEBUG) {
            console.log('%c[FIRST-CTA-V3]', 'color:#FF6B35;font-weight:bold;', ...args);
        }
    }
    
    function debugWarn(...args) {
        if (CONFIG.DEBUG) {
            console.warn('%c[FIRST-CTA-V3]', 'color:#FF6B35;font-weight:bold;', ...args);
        }
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
            
            // Verificar se já mostrou o CTA
            const alreadyShown = localStorage.getItem(CONFIG.localStorageKey) === 'true';
            if (alreadyShown) return false;
            
            // Backend flag
            if (analysis.isFirstFreeAnalysis === true) return true;
            if (analysis.hasCompletedFirstFreeAnalysis === true) return false;
            
            // Fallback manual
            const plan = analysis.plan || 'free';
            if (plan !== 'free') return false;
            
            const analysisMode = analysis.analysisMode || 'full';
            const isReduced = analysis.isReduced === true || analysisMode === 'reduced';
            if (isReduced) return false;
            
            return true;
        },
        
        _getCurrentAnalysis() {
            return window.currentModalAnalysis || 
                   window.__CURRENT_ANALYSIS__ || 
                   window.__soundyAI?.analysis ||
                   window.__LAST_ANALYSIS_RESULT__;
        }
    };
    
    // ========================================
    // 🪟 MODAL CTA PRINCIPAL
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
            debugLog('✅ Modal CTA inicializado');
        },
        
        _createModal() {
            const modalHTML = `
                <div id="firstAnalysisUpgradeCTA" class="first-analysis-cta-overlay" role="dialog" aria-modal="true">
                    <div class="first-analysis-cta-card">
                        <button class="first-analysis-cta-close" aria-label="Fechar">&times;</button>
                        <div class="first-analysis-cta-icon">🚀</div>
                        <h2 class="first-analysis-cta-title">Desbloqueie melhorias profissionais da IA</h2>
                        <p class="first-analysis-cta-text">
                            Você já viu o diagnóstico completo. Agora destrave o <strong>plano de correção personalizado</strong>, 
                            <strong>relatórios PDF profissionais</strong> e <strong>assistente IA ilimitado</strong>.
                        </p>
                        <div class="first-analysis-cta-features">
                            <div class="cta-feature"><span>📋</span> Plano de correção passo a passo</div>
                            <div class="cta-feature"><span>🤖</span> Assistente IA ilimitado</div>
                            <div class="cta-feature"><span>📄</span> Relatórios PDF profissionais</div>
                            <div class="cta-feature"><span>♾️</span> Análises sem limite</div>
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
                /* ========================================
                   MODAL CTA OVERLAY
                   ======================================== */
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
                    cursor: pointer; transition: all 0.2s ease; line-height: 30px;
                }
                .first-analysis-cta-close:hover {
                    background: rgba(255, 107, 53, 0.2); color: #FF6B35; border-color: rgba(255, 107, 53, 0.3);
                }
                
                .first-analysis-cta-icon { font-size: 56px; margin-bottom: 20px; animation: ctaPulse 2s infinite; }
                @keyframes ctaPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
                
                .first-analysis-cta-title {
                    font-family: 'Orbitron', 'Inter', sans-serif; font-size: 22px; font-weight: 700;
                    color: #ffffff; margin: 0 0 16px 0; line-height: 1.3;
                }
                .first-analysis-cta-text {
                    font-size: 15px; color: rgba(255, 255, 255, 0.8); line-height: 1.6; margin: 0 0 28px 0;
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
                
                /* ========================================
                   BLUR OVERLAY NAS SUGESTÕES
                   ======================================== */
                .first-analysis-blur-wrapper {
                    position: relative !important;
                    overflow: hidden !important;
                }
                .first-analysis-blur-wrapper::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0, 0, 0, 0.3);
                    backdrop-filter: blur(6px);
                    -webkit-backdrop-filter: blur(6px);
                    z-index: 10;
                    pointer-events: none;
                    border-radius: inherit;
                }
                
                .suggestions-upgrade-overlay {
                    position: absolute !important;
                    top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 20;
                    background: linear-gradient(145deg, rgba(26, 31, 46, 0.95), rgba(13, 17, 23, 0.95));
                    border: 1px solid rgba(255, 107, 53, 0.4);
                    border-radius: 16px;
                    padding: 24px 32px;
                    text-align: center;
                    max-width: 380px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                }
                .suggestions-upgrade-overlay .overlay-icon {
                    font-size: 40px;
                    margin-bottom: 12px;
                }
                .suggestions-upgrade-overlay .overlay-title {
                    font-family: 'Orbitron', sans-serif;
                    font-size: 16px;
                    font-weight: 600;
                    color: #fff;
                    margin: 0 0 8px 0;
                }
                .suggestions-upgrade-overlay .overlay-text {
                    font-size: 13px;
                    color: rgba(255, 255, 255, 0.7);
                    line-height: 1.5;
                    margin: 0 0 16px 0;
                }
                .suggestions-upgrade-overlay .overlay-btn {
                    display: inline-block;
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #FF6B35, #E85A24);
                    color: #fff;
                    border: none;
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .suggestions-upgrade-overlay .overlay-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(255, 107, 53, 0.4);
                }
                
                @media (max-width: 600px) {
                    .first-analysis-cta-card { padding: 30px 20px; }
                    .first-analysis-cta-title { font-size: 18px; }
                    .first-analysis-cta-features { grid-template-columns: 1fr; }
                    .suggestions-upgrade-overlay { padding: 20px; max-width: 300px; }
                }
            `;
            document.head.appendChild(style);
        },
        
        _setupEventHandlers() {
            // ✅ Botão "Ver Planos" - Abre em NOVA ABA
            const upgradeBtn = this.element.querySelector('#firstAnalysisCtaUpgrade');
            if (upgradeBtn) {
                upgradeBtn.addEventListener('click', () => {
                    debugLog('🚀 Upgrade clicked - abrindo em nova aba');
                    PersistenceManager.markCTAShown();
                    if (window.GATracking?.trackEvent) {
                        window.GATracking.trackEvent('first_analysis_cta_upgrade_clicked');
                    }
                    // ✅ NOVA ABA (window.open)
                    window.open('planos.html', '_blank');
                    this.hide();
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
                    // Remover blur das sugestões ao continuar grátis
                    SuggestionsBlurManager.removeBlur();
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
            
            // ✅ LOG ESPECÍFICO #1, #2, #3
            logCtaShown(source);
            
            this.element.classList.add('visible');
            this.isVisible = true;
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
                    // ✅ LOG ESPECÍFICO #1: CTA exibido por TEMPO
                    this.show('TEMPO (35s)');
                } else {
                    debugLog('❌ Condições não atendidas');
                }
            }, CONFIG.AUTO_OPEN_DELAY);
        },
        
        cancelAutoOpenTimer() {
            if (this.timerId) {
                clearTimeout(this.timerId);
                this.timerId = null;
            }
        }
    };
    
    // ========================================
    // 🌫️ GERENCIADOR DE BLUR NAS SUGESTÕES
    // ========================================
    
    const SuggestionsBlurManager = {
        blurApplied: false,
        
        applyBlur() {
            if (this.blurApplied) return;
            
            debugLog('🌫️ Aplicando blur nas sugestões...');
            
            // Encontrar containers de sugestões
            let suggestionsFound = false;
            
            for (const selector of CONFIG.suggestionsSelectors) {
                const elements = document.querySelectorAll(selector);
                
                elements.forEach(el => {
                    // Não aplicar blur em elementos já processados
                    if (el.closest('.first-analysis-blur-wrapper')) return;
                    if (el.classList.contains('first-analysis-blur-wrapper')) return;
                    
                    // Aplicar wrapper de blur
                    el.classList.add('first-analysis-blur-wrapper');
                    suggestionsFound = true;
                    
                    // Adicionar overlay CTA sobre as sugestões (apenas no primeiro container principal)
                    if (!document.querySelector('.suggestions-upgrade-overlay')) {
                        const overlay = document.createElement('div');
                        overlay.className = 'suggestions-upgrade-overlay';
                        overlay.innerHTML = `
                            <div class="overlay-icon">🔒</div>
                            <h3 class="overlay-title">Sugestões de Melhoria Bloqueadas</h3>
                            <p class="overlay-text">
                                Desbloqueie as sugestões inteligentes da IA para ver como 
                                melhorar sua mix de forma profissional.
                            </p>
                            <button class="overlay-btn" onclick="window.__FIRST_ANALYSIS_CTA__.showCTA()">
                                ✨ Desbloquear Agora
                            </button>
                        `;
                        el.appendChild(overlay);
                        
                        // Handler para o botão do overlay
                        overlay.querySelector('.overlay-btn').addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // ✅ LOG ESPECÍFICO #3: CTA exibido por OVERLAY nas sugestões
                            UpgradeCtaModal.show('OVERLAY nas sugestões');
                        });
                    }
                });
            }
            
            if (suggestionsFound) {
                this.blurApplied = true;
                debugLog('✅ Blur aplicado nas sugestões');
                
                // ✅ LOG ESPECÍFICO #3
                logCtaShown('OVERLAY nas sugestões (blur aplicado)');
            } else {
                debugLog('⚠️ Nenhum container de sugestões encontrado para blur');
            }
        },
        
        removeBlur() {
            debugLog('🌫️ Removendo blur das sugestões...');
            
            // Remover classe de blur
            document.querySelectorAll('.first-analysis-blur-wrapper').forEach(el => {
                el.classList.remove('first-analysis-blur-wrapper');
            });
            
            // Remover overlay
            document.querySelectorAll('.suggestions-upgrade-overlay').forEach(el => {
                el.remove();
            });
            
            this.blurApplied = false;
            debugLog('✅ Blur removido');
        }
    };
    
    // ========================================
    // 🛡️ INTERCEPTADOR DE BOTÕES PREMIUM
    // ========================================
    
    const ButtonInterceptor = {
        originalFunctions: {},
        
        install() {
            debugLog('🛡️ Instalando interceptadores de botões premium...');
            
            // ✅ Bloquear completamente: sendModalAnalysisToChat (Pedir ajuda IA)
            this._blockFunction('sendModalAnalysisToChat', 'Pedir ajuda à IA');
            
            // ✅ Bloquear completamente: downloadModalAnalysis (Gerar PDF)
            this._blockFunction('downloadModalAnalysis', 'Gerar relatório PDF');
            
            // Interceptar também: handleCorrectionPlanClick (Plano de Correção)
            this._blockFunction('handleCorrectionPlanClick', 'Plano de Correção');
            
            debugLog('✅ Interceptadores de botões instalados');
        },
        
        _blockFunction(funcName, label) {
            if (typeof window[funcName] !== 'function') {
                debugWarn(`⚠️ Função ${funcName} não encontrada`);
                return;
            }
            
            // Salvar original
            this.originalFunctions[funcName] = window[funcName];
            
            // Substituir por bloqueio
            window[funcName] = async function(...args) {
                debugLog(`🔍 Verificando bloqueio para: ${label}`);
                
                const shouldBlock = ContextDetector.shouldInterceptButtons();
                
                if (!shouldBlock) {
                    // Não é primeira análise free - executar normalmente
                    debugLog(`✅ ${label} - Executando normalmente`);
                    return await ButtonInterceptor.originalFunctions[funcName].apply(this, args);
                }
                
                // ✅ BLOQUEIO TOTAL: Mostrar CTA em vez de executar
                debugLog(`🚫 ${label} - BLOQUEADO (primeira análise FREE)`);
                
                // ✅ LOG ESPECÍFICO #2: CTA exibido por BLOQUEIO DE BOTÃO
                UpgradeCtaModal.show(`BLOQUEIO DE BOTÃO: ${label}`);
                
                if (window.GATracking?.trackEvent) {
                    window.GATracking.trackEvent('first_analysis_premium_button_blocked', {
                        button: label
                    });
                }
                
                // ❌ NÃO EXECUTA A FUNÇÃO ORIGINAL
                return;
            };
            
            debugLog(`✅ ${funcName} bloqueado na primeira análise FREE`);
        },
        
        restore() {
            debugLog('🔓 Restaurando funções originais...');
            
            for (const [funcName, original] of Object.entries(this.originalFunctions)) {
                if (typeof original === 'function') {
                    window[funcName] = original;
                    debugLog(`✅ ${funcName} restaurado`);
                }
            }
            
            this.originalFunctions = {};
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
            
            const shouldApply = await ContextDetector.isFirstFreeFullAnalysis();
            
            if (shouldApply) {
                debugLog('✅ PRIMEIRA ANÁLISE FREE FULL DETECTADA');
                debugLog('✅ Aplicando sistema de CTA completo...');
                
                // 1. Iniciar timer de 35 segundos
                UpgradeCtaModal.startAutoOpenTimer();
                
                // 2. Instalar bloqueio nos botões premium
                ButtonInterceptor.install();
                
                // 3. Aplicar blur nas sugestões (após um pequeno delay para garantir renderização)
                setTimeout(() => {
                    SuggestionsBlurManager.applyBlur();
                }, 2000);
                
            } else {
                debugLog('❌ Não é primeira análise FREE FULL - sistema CTA não aplicado');
            }
        }
    };
    
    // ========================================
    // 🎬 INICIALIZAÇÃO
    // ========================================
    
    function initialize() {
        debugLog('🚀 ═══════════════════════════════════════════');
        debugLog('🚀 Inicializando FIRST ANALYSIS CTA V3...');
        debugLog('🚀 ═══════════════════════════════════════════');
        
        // 1. Inicializar modal (sem mostrar)
        UpgradeCtaModal.init();
        
        // 2. Hook em displayModalResults
        if (typeof window.displayModalResults === 'function') {
            const originalDisplayModalResults = window.displayModalResults;
            
            window.displayModalResults = async function(analysis) {
                debugLog('🎯 displayModalResults chamado');
                
                // Executar função original
                const result = await originalDisplayModalResults.call(this, analysis);
                
                // Após renderização completa, verificar e aplicar CTA
                setTimeout(() => {
                    debugLog('✅ displayModalResults concluído - verificando CTA...');
                    AnalysisIntegration.onAnalysisRendered();
                }, 1500);
                
                return result;
            };
            
            debugLog('✅ Hook instalado em displayModalResults');
        } else {
            debugWarn('⚠️ displayModalResults não encontrada - tentando novamente em 2s');
            setTimeout(() => {
                if (typeof window.displayModalResults === 'function') {
                    initialize();
                }
            }, 2000);
            return;
        }
        
        // 3. Expor API de debug
        window.__FIRST_ANALYSIS_CTA__ = {
            showCTA: () => UpgradeCtaModal.show('MANUAL (debug)'),
            hideCTA: () => UpgradeCtaModal.hide(),
            checkContext: () => ContextDetector.isFirstFreeFullAnalysis(),
            applyBlur: () => SuggestionsBlurManager.applyBlur(),
            removeBlur: () => SuggestionsBlurManager.removeBlur(),
            restoreButtons: () => ButtonInterceptor.restore(),
            resetCache: () => {
                PersistenceManager.resetCache();
                localStorage.removeItem(CONFIG.localStorageKey);
                debugLog('✅ Cache resetado');
            },
            getStatus: async () => ({
                hasShown: await PersistenceManager.hasShownCTA(),
                isFirstFreeFullAnalysis: await ContextDetector.isFirstFreeFullAnalysis(),
                ctaDismissedThisSession: UpgradeCtaModal.ctaDismissedThisSession,
                blurApplied: SuggestionsBlurManager.blurApplied,
                timerActive: UpgradeCtaModal.timerId !== null
            }),
            VERSION: '3.0'
        };
        
        debugLog('✅ Sistema V3 inicializado com sucesso');
        debugLog('💡 API de debug: window.__FIRST_ANALYSIS_CTA__');
        debugLog('📋 Funcionalidades:');
        debugLog('   - Timer: 35 segundos');
        debugLog('   - Ver Planos: abre em nova aba');
        debugLog('   - Blur: aplicado nas sugestões');
        debugLog('   - Botões IA/PDF: totalmente bloqueados');
    }
    
    // Aguardar carregamento completo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initialize, 500);
        });
    } else {
        setTimeout(initialize, 500);
    }
    
})();
