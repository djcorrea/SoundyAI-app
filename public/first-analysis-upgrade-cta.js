// 🎯 FIRST ANALYSIS UPGRADE CTA - SoundyAI V5 (BLOQUEIO INCONTORNÁVEL)
// Sistema de bloqueio ABSOLUTO de funcionalidades premium na primeira análise FREE
// ✅ GARANTIAS V5:
// - LOCK GLOBAL persistente (não pode ser removido acidentalmente)
// - Blur PERMANENTE até upgrade real de plano
// - MutationObserver re-aplica lock se removido
// - "Continuar grátis" NÃO remove blur (apenas fecha modal)
// - Interceptação em 2 camadas (capture + override global)
// - Logs completos de tentativas de contorno

(function() {
    'use strict';
    
    // ========================================
    // 🔒 ESTADO GLOBAL PERSISTENTE (LOCK)
    // ========================================
    
    window.FIRST_ANALYSIS_LOCK = {
        active: false,
        reason: '',
        appliedAt: null,
        
        activate(reason) {
            this.active = true;
            this.reason = reason;
            this.appliedAt = new Date().toISOString();
            console.log('%c[FIRST-ANALYSIS-LOCK] aplicado', 
                'color:#FF0000;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;',
                `Razão: ${reason}`);
        },
        
        deactivate(reason) {
            // ⚠️ Lock só pode ser removido por upgrade de plano
            if (reason !== 'UPGRADE_TO_PAID_PLAN') {
                const stack = new Error().stack;
                console.warn('%c[FIRST-ANALYSIS-LOCK] tentativa de remover bloqueio IGNORADA', 
                    'color:#FF0000;font-weight:bold;background:#FFFF00;padding:4px 8px;border-radius:4px;',
                    `Tentativa: ${reason}`,
                    `Stack:`, stack);
                return false;
            }
            
            this.active = false;
            this.reason = '';
            console.log('%c[FIRST-ANALYSIS-LOCK] removido (UPGRADE)', 
                'color:#00FF00;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;');
            return true;
        },
        
        isLocked() {
            return this.active === true;
        }
    };
    
    // ========================================
    // 🎯 CONFIGURAÇÃO
    // ========================================
    
    const CONFIG = {
        DEBUG: true,
        AUTO_OPEN_DELAY: 35000, // 35 segundos
        localStorageKey: 'soundy_first_analysis_cta_shown',
        firestoreField: 'hasCompletedFirstFreeAnalysis',
        
        // ✅ SELETORES EXPANDIDOS para capturar TODAS as sugestões
        suggestionsSelectors: [
            // Cards de sugestões
            '.enhanced-card',
            '.ultra-advanced-v2',
            '.suggestion-item',
            '.diag-item',
            '.problem-card',
            
            // Containers de sugestões
            '#ai-suggestions-section',
            '.ai-suggestions-container',
            '#aiSuggestionsContainer',
            '#aiSuggestionsExpanded',
            '.suggestions-list',
            '.suggestions-section',
            '.diag-section',
            
            // Grids e wrappers
            '[class*="suggestion"]',
            '[class*="diag"]',
            '[id*="suggestion"]'
        ],
        
        // IDs/Seletores dos botões premium
        premiumButtonSelectors: [
            '#btn-ask-ai',
            '#btnAskAI',
            'button[onclick*="sendModalAnalysisToChat"]',
            '[data-action="ask-ai"]',
            '#btn-download-pdf',
            '#btnDownloadPDF',
            'button[onclick*="downloadModalAnalysis"]',
            '[data-action="download-pdf"]',
            '#btn-correction-plan',
            'button[onclick*="handleCorrectionPlanClick"]',
            '[data-action="correction-plan"]'
        ]
    };
    
    // ========================================
    // 📊 LOGS CLAROS E ESPECÍFICOS
    // ========================================
    
    function logAction(action, details = '') {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const message = `[FIRST-ANALYSIS-CTA] ${action}`;
        console.log(`%c${message}${details ? ' → ' + details : ''}`, 
            'color:#FF6B35;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;');
    }
    
    function logLockReapplied(reason = '') {
        console.log('%c[FIRST-ANALYSIS-LOCK] reaplicado', 
            'color:#FF6B35;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;',
            reason ? `Razão: ${reason}` : '');
    }
    
    function debugLog(...args) {
        if (CONFIG.DEBUG) {
            console.log('%c[FIRST-CTA-V4]', 'color:#FF6B35;font-weight:bold;', ...args);
        }
    }
    
    // ========================================
    // 🔐 PERSISTÊNCIA
    // ========================================
    
    const PersistenceManager = {
        _cachedStatus: null,
        
        hasShownCTA() {
            // Verificação SÍNCRONA para bloqueio imediato
            if (this._cachedStatus !== null) return this._cachedStatus;
            
            const localValue = localStorage.getItem(CONFIG.localStorageKey);
            if (localValue === 'true') {
                this._cachedStatus = true;
                return true;
            }
            
            this._cachedStatus = false;
            return false;
        },
        
        async hasShownCTAAsync() {
            if (this._cachedStatus !== null) return this._cachedStatus;
            
            const localValue = localStorage.getItem(CONFIG.localStorageKey);
            if (localValue === 'true') {
                this._cachedStatus = true;
                return true;
            }
            
            try {
                const uid = this._getCurrentUID();
                if (uid && window.firebase?.firestore) {
                    const db = window.firebase.firestore();
                    const doc = await db.collection('usuarios').doc(uid).get();
                    if (doc.exists && doc.data()[CONFIG.firestoreField] === true) {
                        this._cachedStatus = true;
                        localStorage.setItem(CONFIG.localStorageKey, 'true');
                        return true;
                    }
                }
            } catch (err) {
                debugLog('⚠️ Erro ao verificar Firestore:', err);
            }
            
            this._cachedStatus = false;
            return false;
        },
        
        markCTAShown() {
            debugLog('✅ Marcando CTA como mostrado...');
            this._cachedStatus = true;
            localStorage.setItem(CONFIG.localStorageKey, 'true');
            
            // Atualizar Firestore em background
            try {
                const uid = this._getCurrentUID();
                if (uid && window.firebase?.firestore) {
                    const db = window.firebase.firestore();
                    db.collection('usuarios').doc(uid).update({
                        [CONFIG.firestoreField]: true,
                        firstFreeAnalysisCompletedAt: new Date().toISOString()
                    }).catch(err => debugLog('⚠️ Erro Firestore:', err));
                }
            } catch (err) {
                debugLog('⚠️ Erro ao atualizar Firestore:', err);
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
        
        resetCache() {
            this._cachedStatus = null;
        }
    };
    
    // ========================================
    // 🔍 DETECTOR DE CONTEXTO (SÍNCRONO)
    // ========================================
    
    const ContextDetector = {
        // ✅ VERIFICAÇÃO SÍNCRONA para bloqueio imediato
        isFirstFreeFullAnalysisSync() {
            // Já mostrou CTA?
            if (PersistenceManager.hasShownCTA()) {
                return false;
            }
            
            const analysis = this._getCurrentAnalysis();
            if (!analysis) return false;
            
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
        
        async isFirstFreeFullAnalysisAsync() {
            if (await PersistenceManager.hasShownCTAAsync()) {
                debugLog('❌ CTA já mostrado anteriormente');
                return false;
            }
            
            const analysis = this._getCurrentAnalysis();
            if (!analysis) {
                debugLog('❌ Nenhuma análise disponível');
                return false;
            }
            
            if (analysis.isFirstFreeAnalysis === true) {
                debugLog('✅ Backend: É primeira análise FREE');
                return true;
            }
            
            if (analysis.hasCompletedFirstFreeAnalysis === true) {
                debugLog('❌ Backend: Já completou primeira análise');
                return false;
            }
            
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
            
            console.log('%c[CTA-DEBUG] ✅ Modal inserido no DOM', 'color:#00FF00;font-weight:bold;');
            // Adicionar estilos e finalizar criação do modal
            this._addStyles();
        },

        _addStyles() {
            if (document.getElementById('firstAnalysisCtaStylesV4')) return;
            
            const style = document.createElement('style');
            style.id = 'firstAnalysisCtaStylesV4';
            style.textContent = `
                /* MODAL CTA OVERLAY */
                .first-analysis-cta-overlay {
                    position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; z-index: 999999 !important;
                    background: rgba(0, 0, 0, 0.85) !important; backdrop-filter: blur(10px) !important;
                    display: flex !important; align-items: center !important; justify-content: center !important; padding: 20px !important;
                    opacity: 0 !important; visibility: hidden !important; transition: opacity 0.3s ease, visibility 0.3s ease !important;
                }
                .first-analysis-cta-overlay.visible { opacity: 1 !important; visibility: visible !important; }
                
                .first-analysis-cta-card {
                    position: relative !important; max-width: 520px !important; width: 100% !important;
                    background: linear-gradient(145deg, #1a1f2e 0%, #0d1117 100%) !important;
                    border: 1px solid rgba(255, 107, 53, 0.3) !important; border-radius: 20px !important;
                    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6), 0 0 60px rgba(255, 107, 53, 0.1) !important;
                    padding: 40px 35px !important; text-align: center !important;
                    transform: scale(0.9) translateY(20px) !important;
                    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
                }
                .first-analysis-cta-overlay.visible .first-analysis-cta-card { transform: scale(1) translateY(0) !important; }
                
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
                   BLUR FORÇADO NAS SUGESTÕES
                   ======================================== */
                .first-analysis-suggestions-blocked {
                    position: relative !important;
                    overflow: hidden !important;
                    min-height: 200px;
                }
                
                .first-analysis-suggestions-blocked > * {
                    filter: blur(8px) !important;
                    -webkit-filter: blur(8px) !important;
                    pointer-events: none !important;
                    user-select: none !important;
                }
                
                .first-analysis-suggestions-blocked > .suggestions-block-overlay {
                    filter: none !important;
                    -webkit-filter: none !important;
                    pointer-events: auto !important;
                }
                
                .suggestions-block-overlay {
                    position: absolute !important;
                    top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
                    background: rgba(0, 0, 0, 0.6) !important;
                    backdrop-filter: blur(4px) !important;
                    -webkit-backdrop-filter: blur(4px) !important;
                    z-index: 100 !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    border-radius: inherit !important;
                }
                
                .suggestions-block-content {
                    background: linear-gradient(145deg, rgba(26, 31, 46, 0.98), rgba(13, 17, 23, 0.98));
                    border: 1px solid rgba(255, 107, 53, 0.4);
                    border-radius: 16px;
                    padding: 28px 36px;
                    text-align: center;
                    max-width: 400px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
                }
                .suggestions-block-content .block-icon { font-size: 48px; margin-bottom: 16px; }
                .suggestions-block-content .block-title {
                    font-family: 'Orbitron', sans-serif; font-size: 18px; font-weight: 600;
                    color: #fff; margin: 0 0 12px 0;
                }
                .suggestions-block-content .block-text {
                    font-size: 14px; color: rgba(255, 255, 255, 0.7);
                    line-height: 1.5; margin: 0 0 20px 0;
                }
                .suggestions-block-content .block-btn {
                    display: inline-block; padding: 14px 28px;
                    background: linear-gradient(135deg, #FF6B35, #E85A24);
                    color: #fff; border: none; border-radius: 10px;
                    font-size: 15px; font-weight: 600; cursor: pointer;
                    transition: all 0.3s ease; text-decoration: none;
                }
                .suggestions-block-content .block-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(255, 107, 53, 0.4);
                }
                
                @media (max-width: 600px) {
                    .first-analysis-cta-card { padding: 30px 20px; }
                    .first-analysis-cta-title { font-size: 18px; }
                    .first-analysis-cta-features { grid-template-columns: 1fr; }
                    .suggestions-block-content { padding: 20px; max-width: 300px; }
                }
            `;
            document.head.appendChild(style);
        },
        
        _setupEventHandlers() {
            const upgradeBtn = this.element.querySelector('#firstAnalysisCtaUpgrade');
            if (upgradeBtn) {
                upgradeBtn.addEventListener('click', () => {
                    debugLog('🚀 Upgrade clicked - abrindo em nova aba');
                    PersistenceManager.markCTAShown();
                    // ✅ NOVA GUIA com noopener/noreferrer
                    window.open('planos.html', '_blank', 'noopener,noreferrer');
                    this.hide();
                });
            }
            
            const continueBtn = this.element.querySelector('#firstAnalysisCtaContinue');
            if (continueBtn) {
                continueBtn.addEventListener('click', () => {
                    debugLog('👋 Continuar grátis clicked');
                    PersistenceManager.markCTAShown();
                    this.hide();
                    // ⚠️ CRÍTICO: NÃO REMOVE BLUR - Lock permanece ativo
                    // SuggestionsBlocker.removeBlur(); // ❌ REMOVIDO
                    // ButtonBlocker.restore(); // ❌ REMOVIDO
                    debugLog('⚠️ Lock permanece ativo após fechar CTA');
                });
            }
            
            const closeBtn = this.element.querySelector('.first-analysis-cta-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.hide());
            }
            
            this.element.addEventListener('click', (e) => {
                if (e.target === this.element) this.hide();
            });
            
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isVisible) this.hide();
            });
        },
        
        show(source = 'auto') {
            if (!this.element) this.init();
            
            logAction(`CTA exibido`, source);
            
            // FORÇA DISPLAY E VISIBILIDADE DIRETAMENTE
            this.element.style.display = 'flex';
            this.element.style.opacity = '1';
            this.element.style.visibility = 'visible';
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
            }
        },
        
        startAutoOpenTimer() {
            this.cancelAutoOpenTimer();
            debugLog(`⏱️ Timer iniciado (${CONFIG.AUTO_OPEN_DELAY / 1000}s)`);
            
            this.timerId = setTimeout(async () => {
                const shouldShow = await ContextDetector.isFirstFreeFullAnalysisAsync();
                if (shouldShow) {
                    this.show('Timer (35s)');
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
    // 🌫️ BLOQUEADOR DE SUGESTÕES (BLUR FORÇADO)
    // ========================================
    
    const SuggestionsBlocker = {
        blocked: false,
        targetContainer: null,
        
        applyBlur() {
            if (this.blocked) return;
            
            debugLog('🌫️ Aplicando blur FORÇADO nas sugestões...');
            
            // Encontrar o container principal do modal
            const modal = document.getElementById('audioAnalysisModal');
            const modalContent = modal?.querySelector('.modal-content, .modal-body, [class*="modal-content"]');
            
            if (!modalContent) {
                debugLog('⚠️ Modal content não encontrado, tentando novamente em 1s...');
                setTimeout(() => this.applyBlur(), 1000);
                return;
            }
            
            // Encontrar TODAS as sugestões dentro do modal
            let suggestionsContainer = null;
            
            // Tentar encontrar container de sugestões existente
            for (const selector of CONFIG.suggestionsSelectors) {
                const found = modalContent.querySelector(selector);
                if (found) {
                    // Encontrar o pai mais próximo que engloba várias sugestões
                    suggestionsContainer = found.closest('.diag-section') || 
                                          found.closest('.suggestions-section') ||
                                          found.closest('[class*="suggestion"]') ||
                                          found.parentElement;
                    if (suggestionsContainer) break;
                }
            }
            
            // Se não encontrou, buscar cards diretamente
            if (!suggestionsContainer) {
                const cards = modalContent.querySelectorAll('.enhanced-card, .diag-item, .suggestion-item');
                if (cards.length > 0) {
                    suggestionsContainer = cards[0].parentElement;
                }
            }
            
            if (!suggestionsContainer) {
                debugLog('⚠️ Nenhum container de sugestões encontrado');
                return;
            }
            
            this.targetContainer = suggestionsContainer;
            
            // Aplicar classe de bloqueio
            suggestionsContainer.classList.add('first-analysis-suggestions-blocked');
            
            // Criar overlay de bloqueio
            const overlay = document.createElement('div');
            overlay.className = 'suggestions-block-overlay';
            overlay.innerHTML = `
                <div class="suggestions-block-content">
                    <div class="block-icon">🔒</div>
                    <h3 class="block-title">Sugestões de Melhoria Bloqueadas</h3>
                    <p class="block-text">
                        Desbloqueie as sugestões inteligentes da IA para ver como melhorar sua mix de forma profissional.
                    </p>
                    <button class="block-btn" id="suggestionsUnlockBtn">✨ Desbloquear Agora</button>
                </div>
            `;
            
            suggestionsContainer.appendChild(overlay);
            
            // Handler do botão
            const unlockBtn = overlay.querySelector('#suggestionsUnlockBtn');
            if (unlockBtn) {
                unlockBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // ✅ LOG CLARO
                    logAction('CTA exibido', 'Overlay nas sugestões');
                    UpgradeCtaModal.show('Overlay nas sugestões');
                });
            }
            
            this.blocked = true;
            
            // ✅ LOG CLARO
            logAction('Sugestões bloqueadas com blur');
            
            // ✅ Iniciar vigilância (MutationObserver + setInterval)
            this._startLockVigilance();
        },
        
        removeBlur(reason = 'unknown') {
            // ⚠️ Só permite remover se Lock global permitir
            if (window.FIRST_ANALYSIS_LOCK.isLocked()) {
                if (!window.FIRST_ANALYSIS_LOCK.deactivate(reason)) {
                    debugLog('❌ Tentativa de remover blur BLOQUEADA');
                    return false;
                }
            }
            
            debugLog('🌫️ Removendo blur das sugestões...');
            
            document.querySelectorAll('.first-analysis-suggestions-blocked').forEach(el => {
                el.classList.remove('first-analysis-suggestions-blocked');
            });
            
            document.querySelectorAll('.suggestions-block-overlay').forEach(el => {
                el.remove();
            });
            
            this.blocked = false;
            this.targetContainer = null;
            
            // Parar vigilância
            this._stopLockVigilance();
            
            return true;
        },
        
        // ✅ VIGILÂNCIA: Re-aplica lock se removido
        _startLockVigilance() {
            if (this._vigilanceInterval || this._vigilanceObserver) return;
            
            debugLog('👁️ Iniciando vigilância de lock...');
            
            // setInterval leve por 60s
            let checks = 0;
            this._vigilanceInterval = setInterval(() => {
                if (!window.FIRST_ANALYSIS_LOCK.isLocked()) return;
                
                if (this.targetContainer && !this.targetContainer.classList.contains('first-analysis-suggestions-blocked')) {
                    logLockReapplied('Lock removido detectado via setInterval');
                    this.targetContainer.classList.add('first-analysis-suggestions-blocked');
                    
                    // Re-criar overlay se sumiu
                    if (!this.targetContainer.querySelector('.suggestions-block-overlay')) {
                        this._recreateOverlay();
                    }
                }
                
                checks++;
                if (checks >= 120) { // 60s (500ms * 120)
                    clearInterval(this._vigilanceInterval);
                    this._vigilanceInterval = null;
                }
            }, 500);
            
            // MutationObserver para mudanças no DOM
            if (this.targetContainer) {
                this._vigilanceObserver = new MutationObserver((mutations) => {
                    if (!window.FIRST_ANALYSIS_LOCK.isLocked()) return;
                    
                    const hasClass = this.targetContainer.classList.contains('first-analysis-suggestions-blocked');
                    if (!hasClass) {
                        logLockReapplied('Lock removido detectado via MutationObserver');
                        this.targetContainer.classList.add('first-analysis-suggestions-blocked');
                    }
                    
                    const hasOverlay = this.targetContainer.querySelector('.suggestions-block-overlay');
                    if (!hasOverlay) {
                        this._recreateOverlay();
                    }
                });
                
                this._vigilanceObserver.observe(this.targetContainer, {
                    attributes: true,
                    attributeFilter: ['class'],
                    childList: true,
                    subtree: false
                });
            }
        },
        
        _stopLockVigilance() {
            if (this._vigilanceInterval) {
                clearInterval(this._vigilanceInterval);
                this._vigilanceInterval = null;
            }
            if (this._vigilanceObserver) {
                this._vigilanceObserver.disconnect();
                this._vigilanceObserver = null;
            }
            debugLog('👁️ Vigilância de lock interrompida');
        },
        
        _recreateOverlay() {
            if (!this.targetContainer) return;
            
            const overlay = document.createElement('div');
            overlay.className = 'suggestions-block-overlay';
            overlay.innerHTML = `
                <div class="suggestions-block-content">
                    <div class="block-icon">🔒</div>
                    <h3 class="block-title">Sugestões de Melhoria Bloqueadas</h3>
                    <p class="block-text">
                        Desbloqueie as sugestões inteligentes da IA para ver como melhorar sua mix de forma profissional.
                    </p>
                    <button class="block-btn" id="suggestionsUnlockBtn">✨ Desbloquear Agora</button>
                </div>
            `;
            
            this.targetContainer.appendChild(overlay);
            
            const unlockBtn = overlay.querySelector('#suggestionsUnlockBtn');
            if (unlockBtn) {
                unlockBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    logAction('CTA exibido', 'Overlay nas sugestões');
                    UpgradeCtaModal.show('Overlay nas sugestões');
                });
            }
        }
    };
    
    // ========================================
    // 🛡️ BLOQUEADOR DE BOTÕES PREMIUM
    // ========================================
    
    const ButtonBlocker = {
        originalFunctions: {},
        captureHandlers: [],
        
        install() {
            debugLog('🛡️ Instalando bloqueio de botões premium...');
            
            // 1. Substituir funções globais
            this._overrideFunction('sendModalAnalysisToChat', 'Pedir ajuda à IA');
            this._overrideFunction('downloadModalAnalysis', 'Baixar relatório PDF');
            this._overrideFunction('handleCorrectionPlanClick', 'Plano de Correção');
            
            // 2. Adicionar event listeners de CAPTURA nos botões
            this._installCaptureListeners();
            
            debugLog('✅ Bloqueio de botões instalado');
        },
        
        _overrideFunction(funcName, label) {
            if (typeof window[funcName] !== 'function') {
                debugLog(`⚠️ Função ${funcName} não encontrada`);
                return;
            }
            
            // Salvar original
            this.originalFunctions[funcName] = window[funcName];
            
            // Substituir com bloqueio
            window[funcName] = function(...args) {
                // Verificação SÍNCRONA para bloqueio imediato
                if (window.FIRST_ANALYSIS_LOCK.isLocked() || ContextDetector.isFirstFreeFullAnalysisSync()) {
                    // ✅ LOG CLARO
                    if (funcName === 'sendModalAnalysisToChat') {
                        console.log('%c[FIRST-ANALYSIS-CTA] intercept IA click -> CTA', 
                            'color:#FF6B35;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;');
                    } else if (funcName === 'downloadModalAnalysis') {
                        console.log('%c[FIRST-ANALYSIS-CTA] intercept PDF click -> CTA', 
                            'color:#FF6B35;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;');
                    }
                    logAction(`Botão ${label.toUpperCase()} bloqueado`, 'CTA exibido');
                    UpgradeCtaModal.show(`Botão ${label}`);
                    return; // ❌ NÃO EXECUTA
                }
                
                // Executar normalmente
                return ButtonBlocker.originalFunctions[funcName].apply(this, args);
            };
            
            debugLog(`✅ ${funcName} substituída com bloqueio`);
        },
        
        _installCaptureListeners() {
            // Event delegation GLOBAL em capture phase
            const globalHandler = (e) => {
                if (!window.FIRST_ANALYSIS_LOCK.isLocked() && !ContextDetector.isFirstFreeFullAnalysisSync()) {
                    return; // Não interceptar se não estiver bloqueado
                }
                
                const target = e.target.closest('button');
                if (!target) return;
                
                const targetText = target.textContent?.toLowerCase() || '';
                const targetOnclick = target.getAttribute('onclick') || '';
                const targetId = target.id || '';
                
                // Detectar botão IA
                if (targetText.includes('pedir ajuda') || 
                    targetText.includes('ajuda ia') ||
                    targetText.includes('ask ai') ||
                    targetOnclick.includes('sendModalAnalysisToChat') ||
                    targetId.includes('ask-ai') ||
                    targetId.includes('btnAskAI')) {
                    
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    console.log('%c[FIRST-ANALYSIS-CTA] intercept IA click -> CTA', 
                        'color:#FF6B35;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;');
                    logAction('Botão IA bloqueado via capture', 'CTA exibido');
                    UpgradeCtaModal.show('Botão IA');
                    return false;
                }
                
                // Detectar botão PDF
                if (targetText.includes('pdf') || 
                    targetText.includes('relatório') ||
                    targetText.includes('download') ||
                    targetOnclick.includes('downloadModalAnalysis') ||
                    targetId.includes('download-pdf') ||
                    targetId.includes('btnDownloadPDF')) {
                    
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    console.log('%c[FIRST-ANALYSIS-CTA] intercept PDF click -> CTA', 
                        'color:#FF6B35;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;');
                    logAction('Botão PDF bloqueado via capture', 'CTA exibido');
                    UpgradeCtaModal.show('Botão PDF');
                    return false;
                }
                
                // Detectar outros botões premium por seletor
                for (const selector of CONFIG.premiumButtonSelectors) {
                    if (target.matches(selector)) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        
                        const label = target.textContent?.trim() || 'Premium';
                        logAction(`Botão "${label}" bloqueado via capture`, 'CTA exibido');
                        UpgradeCtaModal.show(`Botão: ${label}`);
                        return false;
                    }
                }
            };
            
            // Adicionar ao document em CAPTURE PHASE
            document.addEventListener('click', globalHandler, { capture: true });
            this.globalCaptureHandler = globalHandler;
            
            debugLog('✅ Event delegation global instalado');
            
            // Fallback: listeners diretos nos botões
            setTimeout(() => {
                CONFIG.premiumButtonSelectors.forEach(selector => {
                    const buttons = document.querySelectorAll(selector);
                    buttons.forEach(btn => {
                        const handler = (e) => {
                            if (window.FIRST_ANALYSIS_LOCK.isLocked() || ContextDetector.isFirstFreeFullAnalysisSync()) {
                                e.preventDefault();
                                e.stopPropagation();
                                e.stopImmediatePropagation();
                                
                                const label = btn.textContent?.trim() || 'Premium';
                                logAction(`Botão "${label}" bloqueado`, 'CTA exibido');
                                UpgradeCtaModal.show(`Botão clicado: ${label}`);
                                return false;
                            }
                        };
                        
                        // Capture phase para garantir que executamos ANTES
                        btn.addEventListener('click', handler, { capture: true });
                        this.captureHandlers.push({ btn, handler });
                    });
                });
            }, 1000);
        },
        
        restore(reason = 'unknown') {
            // ⚠️ Só permite restaurar se Lock global permitir
            if (window.FIRST_ANALYSIS_LOCK.isLocked()) {
                if (!window.FIRST_ANALYSIS_LOCK.deactivate(reason)) {
                    debugLog('❌ Tentativa de restaurar botões BLOQUEADA');
                    return false;
                }
            }
            
            debugLog('🔓 Restaurando funções originais...');
            
            // Restaurar funções
            for (const [funcName, original] of Object.entries(this.originalFunctions)) {
                if (typeof original === 'function') {
                    window[funcName] = original;
                }
            }
            this.originalFunctions = {};
            
            // Remover capture handlers diretos
            this.captureHandlers.forEach(({ btn, handler }) => {
                btn.removeEventListener('click', handler, { capture: true });
            });
            this.captureHandlers = [];
            
            // Remover global handler
            if (this.globalCaptureHandler) {
                document.removeEventListener('click', this.globalCaptureHandler, { capture: true });
                this.globalCaptureHandler = null;
            }
            
            return true;
        }
    };
    
    // ========================================
    // 🔗 INTEGRAÇÃO COM ANÁLISE
    // ========================================
    
    const AnalysisIntegration = {
        async onAnalysisRendered() {
            debugLog('🔔 ═══════════════════════════════════════════');
            debugLog('🔔 Análise renderizada - verificando contexto');
            
            const shouldApply = await ContextDetector.isFirstFreeFullAnalysisAsync();
            
            if (shouldApply) {
                debugLog('✅ PRIMEIRA ANÁLISE FREE FULL DETECTADA');
                
                // 0. ATIVAR LOCK GLOBAL
                window.FIRST_ANALYSIS_LOCK.activate('Primeira análise FREE FULL detectada');
                
                // 1. Instalar bloqueio nos botões IMEDIATAMENTE
                ButtonBlocker.install();
                
                // 2. Aplicar blur nas sugestões após renderização completa
                setTimeout(() => {
                    SuggestionsBlocker.applyBlur();
                }, 2000);
                
                // 3. Tentar novamente após mais tempo
                setTimeout(() => {
                    if (!SuggestionsBlocker.blocked) {
                        SuggestionsBlocker.applyBlur();
                    }
                }, 4000);
                
                // 4. Iniciar timer
                UpgradeCtaModal.startAutoOpenTimer();
                
            } else {
                debugLog('❌ Não é primeira análise FREE FULL');
            }
        }
    };
    
    // ========================================
    // 🎬 INICIALIZAÇÃO
    // ========================================
    
    function initialize() {
        debugLog('🚀 ═══════════════════════════════════════════');
        debugLog('🚀 Inicializando FIRST ANALYSIS CTA V5 (BLOQUEIO INCONTORNÁVEL)...');
        
        // 1. Inicializar modal
        UpgradeCtaModal.init();
        
        // 2. Função para instalar hook (reutilizável)
        function installHook() {
            if (typeof window.displayModalResults === 'function') {
                const original = window.displayModalResults;
                
                // Evitar hook duplicado
                if (original.__FIRST_CTA_HOOKED__) {
                    debugLog('⚠️ Hook já instalado anteriormente');
                    return true;
                }
                
                window.displayModalResults = async function(analysis) {
                    debugLog('🎯 displayModalResults chamado');
                    
                    const result = await original.call(this, analysis);
                    
                    setTimeout(() => {
                        AnalysisIntegration.onAnalysisRendered();
                    }, 1500);
                    
                    return result;
                };
                
                // Marcar como hooked
                window.displayModalResults.__FIRST_CTA_HOOKED__ = true;
                
                debugLog('✅ Hook instalado em displayModalResults');
                return true;
            }
            return false;
        }
        
        // 2.1. Verificar se displayModalResults JÁ EXISTE (lazy-load concluído antes do CTA)
        if (installHook()) {
            debugLog('🎯 displayModalResults já disponível - hook instalado imediatamente');
        } else {
            // 2.2. Aguardar evento canônico displayModalResultsReady
            debugLog('👂 Aguardando evento soundy:displayModalResultsReady...');
            window.addEventListener('soundy:displayModalResultsReady', () => {
                debugLog('📢 Evento soundy:displayModalResultsReady recebido');
                installHook();
            }, { once: true });
        }
        
        // 3. Expor API de debug + UNLOCK para upgrade
        window.__FIRST_ANALYSIS_CTA__ = {
            showCTA: () => UpgradeCtaModal.show('MANUAL (debug)'),
            hideCTA: () => UpgradeCtaModal.hide(),
            checkContext: () => ContextDetector.isFirstFreeFullAnalysisAsync(),
            checkContextSync: () => ContextDetector.isFirstFreeFullAnalysisSync(),
            applyBlur: () => SuggestionsBlocker.applyBlur(),
            removeBlur: () => SuggestionsBlocker.removeBlur('UPGRADE_TO_PAID_PLAN'),
            restoreButtons: () => ButtonBlocker.restore('UPGRADE_TO_PAID_PLAN'),
            
            // ⚠️ CRÍTICO: Função para desbloquear após upgrade REAL de plano
            unlockAfterUpgrade: () => {
                debugLog('🔓 UNLOCK após upgrade de plano...');
                const unlocked = window.FIRST_ANALYSIS_LOCK.deactivate('UPGRADE_TO_PAID_PLAN');
                if (unlocked) {
                    SuggestionsBlocker.removeBlur('UPGRADE_TO_PAID_PLAN');
                    ButtonBlocker.restore('UPGRADE_TO_PAID_PLAN');
                    debugLog('✅ Conteúdo desbloqueado completamente');
                    return true;
                }
                return false;
            },
            
            resetCache: () => {
                PersistenceManager.resetCache();
                localStorage.removeItem(CONFIG.localStorageKey);
                window.FIRST_ANALYSIS_LOCK.deactivate('UPGRADE_TO_PAID_PLAN');
                debugLog('✅ Cache resetado');
            },
            
            getStatus: async () => ({
                isFirstFreeFullAnalysis: await ContextDetector.isFirstFreeFullAnalysisAsync(),
                lockActive: window.FIRST_ANALYSIS_LOCK.isLocked(),
                lockReason: window.FIRST_ANALYSIS_LOCK.reason,
                blurApplied: SuggestionsBlocker.blocked,
                ctaVisible: UpgradeCtaModal.isVisible,
                hasShownCTA: PersistenceManager.hasShownCTA()
            }),
            
            VERSION: '5.0'
        };
        
        debugLog('✅ Sistema V5 inicializado (BLOQUEIO INCONTORNÁVEL)');
        debugLog('💡 API: window.__FIRST_ANALYSIS_CTA__');
        debugLog('🔓 Para desbloquear após upgrade: window.__FIRST_ANALYSIS_CTA__.unlockAfterUpgrade()');
    }
    
    // Inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(initialize, 500));
    } else {
        setTimeout(initialize, 500);
    }
    
})();
