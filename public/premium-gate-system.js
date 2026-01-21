// 🔒 SISTEMA DE GATE PREMIUM - BLOQUEIO COMPLETO
// Implementação com defesa em profundidade: modal + wrappers + sobrescrita

(function initPremiumGateSystem() {
    'use strict';
    
    log('🔒 [PREMIUM-GATE] Inicializando sistema de bloqueio...');
    
    // ==============================================
    // PASSO A: MODAL DE UPGRADE
    // ==============================================
    
    function createUpgradeModal() {
        // Verificar se já existe
        if (document.getElementById('premiumUpgradeModal')) {
            log('🔒 [PREMIUM-GATE] Modal já existe');
            return;
        }
        
        const modalHTML = `
            <div id="premiumUpgradeModal" class="premium-upgrade-modal" style="display: none;">
                <div class="premium-upgrade-overlay"></div>
                <div class="premium-upgrade-card">
                    <div class="premium-upgrade-icon">🔒</div>
                    <h2 class="premium-upgrade-title">Recurso Premium</h2>
                    <p class="premium-upgrade-text" id="premiumUpgradeText">
                        Para usar este recurso, faça upgrade para o plano premium.
                    </p>
                    <div class="premium-upgrade-buttons">
                        <button class="premium-upgrade-btn premium-upgrade-primary" id="premiumUpgradeCTA">
                            ✨ Ver Planos
                        </button>
                        <button class="premium-upgrade-btn premium-upgrade-secondary" id="premiumUpgradeClose">
                            Agora não
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const styleCSS = `
            <style id="premiumUpgradeStyles">
                .premium-upgrade-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 999999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.2s ease;
                }
                
                .premium-upgrade-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(4px);
                }
                
                .premium-upgrade-card {
                    position: relative;
                    max-width: 440px;
                    width: 90%;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border: 2px solid rgba(74, 144, 226, 0.4);
                    border-radius: 20px;
                    padding: 40px 30px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
                    animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                
                .premium-upgrade-icon {
                    font-size: 48px;
                    text-align: center;
                    margin-bottom: 20px;
                    animation: pulse 2s infinite;
                }
                
                .premium-upgrade-title {
                    font-family: 'Orbitron', sans-serif;
                    font-size: 26px;
                    font-weight: 700;
                    color: #ffffff;
                    text-align: center;
                    margin: 0 0 16px 0;
                }
                
                .premium-upgrade-text {
                    font-family: 'Poppins', sans-serif;
                    font-size: 16px;
                    color: rgba(255, 255, 255, 0.85);
                    text-align: center;
                    line-height: 1.6;
                    margin: 0 0 32px 0;
                }
                
                .premium-upgrade-buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .premium-upgrade-btn {
                    width: 100%;
                    padding: 14px 24px;
                    border: none;
                    border-radius: 10px;
                    font-family: 'Poppins', sans-serif;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                
                .premium-upgrade-primary {
                    background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
                    color: #ffffff;
                    box-shadow: 0 4px 15px rgba(74, 144, 226, 0.4);
                }
                
                .premium-upgrade-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(74, 144, 226, 0.6);
                }
                
                .premium-upgrade-secondary {
                    background: rgba(255, 255, 255, 0.1);
                    color: rgba(255, 255, 255, 0.7);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                
                .premium-upgrade-secondary:hover {
                    background: rgba(255, 255, 255, 0.15);
                    color: rgba(255, 255, 255, 0.9);
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slideUp {
                    from { 
                        transform: translateY(30px);
                        opacity: 0;
                    }
                    to { 
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
            </style>
        `;
        
        // Injetar CSS
        document.head.insertAdjacentHTML('beforeend', styleCSS);
        
        // Injetar HTML
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Adicionar event listeners
        const modal = document.getElementById('premiumUpgradeModal');
        const ctaBtn = document.getElementById('premiumUpgradeCTA');
        const closeBtn = document.getElementById('premiumUpgradeClose');
        const overlay = modal.querySelector('.premium-upgrade-overlay');
        
        ctaBtn.addEventListener('click', () => {
            window.location.href = '/planos.html';
        });
        
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            log('🔒 [UPGRADE MODAL] closed');
        });
        
        overlay.addEventListener('click', () => {
            modal.style.display = 'none';
            log('🔒 [UPGRADE MODAL] closed');
        });
        
        log('🔒 [PREMIUM-GATE] Modal criado com sucesso');
    }
    
    // ==============================================
    // PASSO B: DETECTAR MODO REDUCED
    // ==============================================
    
    function getCurrentAnalysis() {
        // 🚫 CRITICAL: Buscar análise de TODAS as fontes possíveis (sincronizado com premium-blocker.js)
        const analysis = window.currentModalAnalysis ||      // ✅ Principal (exposta em audio-analyzer-integration.js)
                        window.__CURRENT_ANALYSIS__ ||       // ✅ Alias secundário
                        window.__soundyAI?.analysis ||       // ✅ Namespace unificado
                        window.__LAST_ANALYSIS_RESULT__;     // ✅ Backup para PDF
        
        return analysis && typeof analysis === 'object' ? analysis : null;
    }
    
    function isReducedMode() {
        // 🚫 CRITICAL: Buscar análise de TODAS as fontes (sincronizado com premium-blocker.js)
        const analysis = window.currentModalAnalysis ||
                        window.__CURRENT_ANALYSIS__ ||
                        window.__soundyAI?.analysis ||
                        window.__LAST_ANALYSIS_RESULT__;
        
        // ✅ Sem análise = permitir (early return)
        if (!analysis || typeof analysis !== 'object') {
            log('⚠️ [GATE] Nenhuma análise carregada - permitindo acesso');
            return false;
        }
        
        // ✅ Log diagnóstico (sincronizado com premium-blocker.js)
        log('🔍 [GATE] Análise encontrada:', {
            plan: analysis.plan,
            analysisMode: analysis.analysisMode,
            isReduced: analysis.isReduced,
            features: analysis.planFeatures
        });
        
        // 🚫 CRITICAL: Prioridade 1 - isReduced explícito
        if (analysis.isReduced === true) {
            log('🔒 [GATE] Modo REDUCED detectado (isReduced: true)');
            return true;
        }
        
        // 🚫 CRITICAL: Prioridade 2 - analysisMode === 'reduced'
        if (analysis.analysisMode === 'reduced') {
            log('🔒 [GATE] Modo REDUCED detectado (analysisMode: reduced)');
            return true;
        }
        
        // 🚫 CRITICAL: Prioridade 3 - Plano PLUS (NUNCA tem IA/PDF)
        if (analysis.plan === 'plus') {
            log('🔒 [GATE] Plano PLUS detectado - IA/PDF bloqueados');
            return true;
        }
        
        // ✅ FREE TRIAL: Se FREE + analysisMode === 'full' → PERMITIR
        if (analysis.plan === 'free' && analysis.analysisMode === 'full') {
            log('🎁 [GATE] FREE TRIAL (modo FULL) - permitindo acesso');
            return false;
        }
        
        // ✅ PRO ou qualquer outro plano em modo full → PERMITIR
        log('✅ [GATE] Plano válido - permitindo acesso');
        return false;
    }
    
    function openUpgradeModal(feature) {
        log('[UPGRADE MODAL] opened');
        
        // 🔐 NOVO: Usar EntitlementsHandler se disponível (para features PRO-only)
        if (window.EntitlementsHandler && ['reference', 'correctionPlan', 'pdf', 'askAI'].includes(feature)) {
            log('[UPGRADE MODAL] Delegando para EntitlementsHandler');
            window.EntitlementsHandler.showUpgradeModal(feature, 'plus'); // Assumir plus se está no reduced
            return;
        }
        
        const modal = document.getElementById('premiumUpgradeModal');
        const textEl = document.getElementById('premiumUpgradeText');
        
        if (!modal) {
            error('🔒 [PREMIUM-GATE] Modal não encontrado!');
            return;
        }
        
        // Personalizar mensagem
        // ✅ ATUALIZADO 2026-01-06: correctionPlan agora é STUDIO only
        const messages = {
            'ai': 'A funcionalidade "Pedir Ajuda à IA" está disponível apenas para usuários premium. Faça upgrade para receber assistência personalizada.',
            'askAI': 'A funcionalidade "Pedir Ajuda à IA" está disponível apenas para usuários premium. Faça upgrade para receber assistência personalizada.',
            'pdf': 'A funcionalidade "Baixar Relatório" está disponível apenas para usuários premium. Faça upgrade para exportar suas análises.',
            'reference': 'O Modo Referência está disponível apenas para usuários PRO ou superior. Faça upgrade para comparar seu áudio com referências profissionais.',
            'correctionPlan': 'O Plano de Correção está disponível apenas para usuários STUDIO. Faça upgrade para o STUDIO e receba um guia passo a passo personalizado.'
        };
        
        if (textEl && messages[feature]) {
            textEl.textContent = messages[feature];
        }
        
        modal.style.display = 'flex';
        
        // ✅ Debug info (sincronizado com premium-blocker.js)
        const analysis = window.currentModalAnalysis ||
                        window.__CURRENT_ANALYSIS__ ||
                        window.__soundyAI?.analysis ||
                        window.__LAST_ANALYSIS_RESULT__;
        
        warn('[GATE] bloqueado:', feature, {
            plan: analysis?.plan,
            analysisMode: analysis?.analysisMode,
            isReduced: analysis?.isReduced,
            features: analysis?.planFeatures
        });
    }
    
    // ==============================================
    // PASSO C e D: WRAPPERS GATED
    // ==============================================
    
    function installGatedWrappers() {
        log('🔒 [PREMIUM-GATE] Instalando wrappers...');
        
        // Preservar funções originais
        window.__orig_sendModalAnalysisToChat = window.sendModalAnalysisToChat;
        window.__orig_downloadModalAnalysis = window.downloadModalAnalysis;
        
        // Criar wrappers gated
        window.gatedSendModalAnalysisToChat = function(...args) {
            if (isReducedMode()) {
                openUpgradeModal('ai');
                return false;
            }
            
            log('[GATE] permitido: ai');
            
            if (typeof window.__orig_sendModalAnalysisToChat === 'function') {
                return window.__orig_sendModalAnalysisToChat.apply(this, args);
            }
        };
        
        window.gatedDownloadModalAnalysis = function(...args) {
            if (isReducedMode()) {
                openUpgradeModal('pdf');
                return false;
            }
            
            log('[GATE] permitido: pdf');
            
            if (typeof window.__orig_downloadModalAnalysis === 'function') {
                return window.__orig_downloadModalAnalysis.apply(this, args);
            }
        };
        
        log('🔒 [PREMIUM-GATE] Wrappers instalados');
    }
    
    // ==============================================
    // PASSO E: DEFESA EM PROFUNDIDADE
    // ==============================================
    
    function installDeepDefense() {
        log('🔒 [PREMIUM-GATE] Instalando defesa em profundidade...');
        
        // Sobrescrever funções originais também
        window.sendModalAnalysisToChat = function(...args) {
            if (isReducedMode()) {
                openUpgradeModal('ai');
                return;
            }
            
            log('[GATE] permitido: ai (direct call)');
            
            if (typeof window.__orig_sendModalAnalysisToChat === 'function') {
                return window.__orig_sendModalAnalysisToChat.apply(this, args);
            }
        };
        
        window.downloadModalAnalysis = function(...args) {
            if (isReducedMode()) {
                openUpgradeModal('pdf');
                return;
            }
            
            log('[GATE] permitido: pdf (direct call)');
            
            if (typeof window.__orig_downloadModalAnalysis === 'function') {
                return window.__orig_downloadModalAnalysis.apply(this, args);
            }
        };
        
        log('🔒 [PREMIUM-GATE] Defesa em profundidade instalada');
    }
    
    // ==============================================
    // PASSO D: SUBSTITUIR ONCLICKS NO HTML
    // ==============================================
    
    function replaceHTMLOnclicks() {
        log('🔒 [PREMIUM-GATE] Substituindo onclicks no HTML...');
        
        // Localizar botões pelo onclick atual
        const buttons = document.querySelectorAll('button[onclick]');
        let replaced = 0;
        
        buttons.forEach(btn => {
            const onclick = btn.getAttribute('onclick');
            
            if (onclick.includes('sendModalAnalysisToChat')) {
                btn.setAttribute('onclick', 'return gatedSendModalAnalysisToChat()');
                log('   ✅ Substituído: sendModalAnalysisToChat → gatedSendModalAnalysisToChat');
                replaced++;
            }
            
            if (onclick.includes('downloadModalAnalysis')) {
                btn.setAttribute('onclick', 'return gatedDownloadModalAnalysis()');
                log('   ✅ Substituído: downloadModalAnalysis → gatedDownloadModalAnalysis');
                replaced++;
            }
        });
        
        log(`🔒 [PREMIUM-GATE] ${replaced} onclicks substituídos`);
    }
    
    // ==============================================
    // INICIALIZAÇÃO
    // ==============================================
    
    function init() {
        // Esperar DOM estar pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }
        
        // Executar passos
        createUpgradeModal();
        installGatedWrappers();
        installDeepDefense();
        replaceHTMLOnclicks();
        
        log('✅ [PREMIUM-GATE] Sistema de bloqueio ativo');
        
        // Debug info
        log('🔍 [PREMIUM-GATE] Estado atual:', {
            APP_MODE: window.APP_MODE,
            isReduced: isReducedMode(),
            currentAnalysis: getCurrentAnalysis()
        });
    }
    
    // Iniciar
    init();
})();
