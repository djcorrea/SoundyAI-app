/**
 * 🎯 MÓDULO CTA DE UPGRADE - PRIMEIRA ANÁLISE FREE
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * OBJETIVO:
 * Exibir CTA de upgrade inteligente que aparece SOMENTE na primeira análise FULL
 * de usuários FREE, sem quebrar nenhuma lógica existente (especialmente reduced mode)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * CONDIÇÕES PARA EXIBIR O CTA:
 * 
 * ✅ Usuário está no plano FREE
 * ✅ É a PRIMEIRA análise da vida do usuário
 * ✅ A análise atual está em modo FULL (não reduced)
 * ✅ O resultado foi completamente renderizado na tela
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * COMPORTAMENTOS:
 * 
 * 1. TIMER AUTOMÁTICO: Após 25 segundos da renderização completa
 * 2. INTERCEPTAÇÃO DE BOTÕES PREMIUM: 
 *    - Gerar plano de correção
 *    - Gerar relatório PDF
 *    - Pedir ajuda IA
 * 3. PERSISTÊNCIA: Usa Firestore para marcar primeira análise completa
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

(function() {
    'use strict';
    
    const log = (...args) => debugLog('[FIRST-ANALYSIS-CTA]', ...args);
    const warn = (...args) => debugWarn('[FIRST-ANALYSIS-CTA]', ...args);
    const error = (...args) => debugError('[FIRST-ANALYSIS-CTA]', ...args);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ESTADO GLOBAL DO MÓDULO
    // ═══════════════════════════════════════════════════════════════════════════
    
    const state = {
        ctaShown: false,              // CTA já foi exibido nesta sessão?
        ctaDismissed: false,          // Usuário clicou em "Continuar grátis"?
        timerActive: false,           // Timer de 25s está rodando?
        timerId: null,                // ID do timer para cancelamento
        buttonsIntercepted: false,    // Botões premium já foram interceptados?
        renderComplete: false         // Renderização completa confirmada?
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // VERIFICAÇÕES DE ELEGIBILIDADE
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Verifica se o usuário é elegível para o CTA
     * @returns {Promise<boolean>}
     */
    async function isEligibleForCTA() {
        try {
            log('🔍 Verificando elegibilidade para CTA...');
            
            // 1. Verificar se análise atual existe e está completa
            const analysis = window.__CURRENT_ANALYSIS__ || 
                           window.currentModalAnalysis || 
                           window.__soundyAI?.analysis;
            
            if (!analysis) {
                log('❌ Nenhuma análise encontrada');
                return false;
            }
            
            // 2. Verificar se é modo FULL (não reduced)
            const isReduced = analysis.analysisMode === 'reduced' || analysis.isReduced === true;
            if (isReduced) {
                log('❌ Análise está em modo REDUCED - CTA não deve aparecer');
                return false;
            }
            
            // 3. Verificar se é plano FREE
            const userPlan = analysis.plan || 'free';
            if (userPlan !== 'free') {
                log('❌ Usuário não está no plano FREE:', userPlan);
                return false;
            }
            
            // 4. Verificar autenticação
            const auth = window.firebase?.auth?.();
            const user = auth?.currentUser;
            
            if (!user) {
                log('❌ Usuário não autenticado');
                return false;
            }
            
            // 5. Verificar no Firestore se é a primeira análise
            const isFirstAnalysis = await checkIfFirstAnalysis(user.uid);
            
            if (!isFirstAnalysis) {
                log('❌ Não é a primeira análise do usuário');
                return false;
            }
            
            log('✅ Usuário é elegível para CTA!', {
                plan: userPlan,
                analysisMode: analysis.analysisMode,
                isFirstAnalysis: true
            });
            
            return true;
            
        } catch (err) {
            error('❌ Erro ao verificar elegibilidade:', err);
            return false;
        }
    }
    
    /**
     * Verifica no Firestore se é a primeira análise do usuário
     * @param {string} uid - ID do usuário
     * @returns {Promise<boolean>}
     */
    async function checkIfFirstAnalysis(uid) {
        try {
            const db = window.firebase?.firestore?.();
            if (!db) {
                warn('⚠️ Firestore não disponível, usando fallback localStorage');
                return checkFirstAnalysisFallback(uid);
            }
            
            const userDoc = await db.collection('users').doc(uid).get();
            
            if (!userDoc.exists) {
                log('✅ Documento do usuário não existe - é a primeira análise');
                return true;
            }
            
            const userData = userDoc.data();
            
            // Verifica se já completou a primeira análise free
            if (userData.hasCompletedFirstFreeAnalysis === true) {
                log('❌ hasCompletedFirstFreeAnalysis = true');
                return false;
            }
            
            // Se analysesMonth > 0, não é primeira análise
            if (userData.analysesMonth && userData.analysesMonth > 0) {
                log('❌ analysesMonth > 0:', userData.analysesMonth);
                return false;
            }
            
            log('✅ É a primeira análise do usuário');
            return true;
            
        } catch (err) {
            error('❌ Erro ao verificar Firestore:', err);
            return checkFirstAnalysisFallback(uid);
        }
    }
    
    /**
     * Fallback usando localStorage quando Firestore não está disponível
     * @param {string} uid - ID do usuário
     * @returns {boolean}
     */
    function checkFirstAnalysisFallback(uid) {
        try {
            const key = `firstAnalysisCTA_${uid}`;
            const stored = localStorage.getItem(key);
            
            if (stored === 'completed') {
                log('❌ [FALLBACK] Primeira análise já foi completada (localStorage)');
                return false;
            }
            
            log('✅ [FALLBACK] É a primeira análise (localStorage)');
            return true;
            
        } catch (err) {
            error('❌ Erro no fallback localStorage:', err);
            return false;
        }
    }
    
    /**
     * Marca a primeira análise como completada no Firestore
     * @param {string} uid - ID do usuário
     */
    async function markFirstAnalysisCompleted(uid) {
        try {
            const db = window.firebase?.firestore?.();
            
            if (db) {
                await db.collection('users').doc(uid).set({
                    hasCompletedFirstFreeAnalysis: true,
                    firstAnalysisCompletedAt: window.firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                
                log('✅ Primeira análise marcada como completada no Firestore');
            }
            
            // Fallback localStorage
            const key = `firstAnalysisCTA_${uid}`;
            localStorage.setItem(key, 'completed');
            
        } catch (err) {
            error('❌ Erro ao marcar primeira análise:', err);
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // EXIBIÇÃO DO CTA
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Renderiza e exibe o modal CTA
     */
    function showCTA() {
        if (state.ctaShown || state.ctaDismissed) {
            log('⏭️ CTA já foi exibido ou dispensado');
            return;
        }
        
        log('🎯 Exibindo CTA de upgrade...');
        
        // Criar HTML do modal
        const html = `
            <div class="first-analysis-cta-overlay" id="firstAnalysisCTAOverlay">
                <div class="first-analysis-cta-modal">
                    <div class="first-analysis-cta-icon">🚀</div>
                    
                    <div class="first-analysis-cta-badge">Primeira análise concluída!</div>
                    
                    <h2 class="first-analysis-cta-title">
                        Quer destravar o próximo nível da sua análise?
                    </h2>
                    
                    <p class="first-analysis-cta-text">
                        Você já viu o diagnóstico. Agora destrave o plano de correção passo a passo 
                        e continue analisando sem limites.
                    </p>
                    
                    <div class="first-analysis-cta-buttons">
                        <a href="/planos.html" class="first-analysis-cta-btn primary" id="ctaBtnUpgrade">
                            ✨ Ver Planos
                        </a>
                        <button class="first-analysis-cta-btn secondary" id="ctaBtnDismiss">
                            Continuar Grátis
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Inserir no DOM
        document.body.insertAdjacentHTML('beforeend', html);
        
        // Adicionar event listeners
        const btnDismiss = document.getElementById('ctaBtnDismiss');
        const btnUpgrade = document.getElementById('ctaBtnUpgrade');
        
        if (btnDismiss) {
            btnDismiss.addEventListener('click', dismissCTA);
        }
        
        if (btnUpgrade) {
            btnUpgrade.addEventListener('click', () => {
                log('✅ Usuário clicou em "Ver Planos"');
                // Link direto para /planos.html
            });
        }
        
        state.ctaShown = true;
        
        log('✅ CTA exibido com sucesso');
    }
    
    /**
     * Fecha o CTA quando usuário clica em "Continuar Grátis"
     */
    function dismissCTA() {
        log('✅ Usuário clicou em "Continuar Grátis"');
        
        const overlay = document.getElementById('firstAnalysisCTAOverlay');
        
        if (overlay) {
            // Animação de saída
            overlay.classList.add('hiding');
            
            setTimeout(() => {
                overlay.remove();
                log('✅ CTA removido do DOM');
            }, 300);
        }
        
        state.ctaDismissed = true;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // TIMER AUTOMÁTICO
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Inicia timer de 25 segundos para exibir CTA automaticamente
     */
    function startAutoTimer() {
        if (state.timerActive || state.ctaShown || state.ctaDismissed) {
            return;
        }
        
        log('⏱️ Iniciando timer de 25 segundos...');
        
        state.timerActive = true;
        
        state.timerId = setTimeout(async () => {
            log('⏰ Timer de 25s finalizado!');
            
            const eligible = await isEligibleForCTA();
            
            if (eligible && !state.ctaDismissed) {
                showCTA();
            }
            
            state.timerActive = false;
        }, 25000); // 25 segundos
    }
    
    /**
     * Cancela o timer se necessário
     */
    function cancelTimer() {
        if (state.timerId) {
            clearTimeout(state.timerId);
            state.timerId = null;
            state.timerActive = false;
            log('❌ Timer cancelado');
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // INTERCEPTAÇÃO DE BOTÕES PREMIUM
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Intercepta cliques nos botões premium para exibir CTA
     */
    function interceptPremiumButtons() {
        if (state.buttonsIntercepted) {
            return;
        }
        
        log('🔒 Interceptando botões premium...');
        
        // Botões a interceptar (esvaziado: botões removidos do modal)
        const buttonSelectors = [];
        
        buttonSelectors.forEach(selector => {
            const button = document.querySelector(selector);
            
            if (button) {
                // Adicionar evento que previne ação original
                button.addEventListener('click', async function(event) {
                    // Verificar se é elegível
                    const eligible = await isEligibleForCTA();
                    
                    if (eligible && !state.ctaDismissed) {
                        log('🚫 Bloqueando botão premium:', selector);
                        event.stopImmediatePropagation();
                        event.preventDefault();
                        
                        // Cancelar timer automático se estiver rodando
                        cancelTimer();
                        
                        // Exibir CTA imediatamente
                        showCTA();
                        
                        return false;
                    }
                }, true); // useCapture = true para interceptar antes de outros handlers
                
                log('✅ Botão interceptado:', selector);
            }
        });
        
        state.buttonsIntercepted = true;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // DETECÇÃO DE RENDERIZAÇÃO COMPLETA
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Monitora quando a renderização está completa
     */
    function monitorRenderCompletion() {
        log('👀 Monitorando renderização completa...');
        
        // Observer para detectar quando o container de resultados está visível
        const resultsContainer = document.getElementById('audioAnalysisResults');
        
        if (!resultsContainer) {
            warn('⚠️ Container de resultados não encontrado');
            return;
        }
        
        // Se já está visível, ativar imediatamente
        if (resultsContainer.style.display !== 'none' && resultsContainer.offsetHeight > 0) {
            onRenderComplete();
            return;
        }
        
        // Observer para detectar quando ficar visível
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    if (resultsContainer.style.display !== 'none' && resultsContainer.offsetHeight > 0) {
                        onRenderComplete();
                        observer.disconnect();
                        break;
                    }
                }
            }
        });
        
        observer.observe(resultsContainer, {
            attributes: true,
            attributeFilter: ['style']
        });
    }
    
    /**
     * Chamado quando renderização está completa
     */
    async function onRenderComplete() {
        if (state.renderComplete) {
            return;
        }
        
        log('✅ Renderização completa detectada!');
        state.renderComplete = true;
        
        // Verificar elegibilidade
        const eligible = await isEligibleForCTA();
        
        if (!eligible) {
            log('❌ Não elegível - abortando');
            return;
        }
        
        // Interceptar botões premium
        interceptPremiumButtons();
        
        // Iniciar timer de 25 segundos
        startAutoTimer();
        
        // Marcar primeira análise como completada
        const auth = window.firebase?.auth?.();
        const user = auth?.currentUser;
        
        if (user) {
            await markFirstAnalysisCompleted(user.uid);
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // INICIALIZAÇÃO DO MÓDULO
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Inicializa o módulo CTA
     */
    function init() {
        log('🚀 Inicializando módulo First Analysis CTA...');
        
        // Aguardar DOM estar pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }
        
        // Aguardar Firebase estar pronto
        const checkFirebase = setInterval(() => {
            if (window.firebase?.auth && window.firebase?.firestore) {
                clearInterval(checkFirebase);
                
                log('✅ Firebase pronto');
                
                // Monitorar renderização
                monitorRenderCompletion();
            }
        }, 100);
        
        // Timeout de segurança (10 segundos)
        setTimeout(() => {
            clearInterval(checkFirebase);
            
            if (!window.firebase?.auth) {
                warn('⚠️ Firebase não inicializou a tempo - usando fallback');
                monitorRenderCompletion();
            }
        }, 10000);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // EXPOR FUNÇÕES GLOBAIS PARA DEBUG
    // ═══════════════════════════════════════════════════════════════════════════
    
    window.FirstAnalysisCTA = {
        showCTA,
        dismissCTA,
        isEligibleForCTA,
        state: () => ({ ...state })
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // AUTO-INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════════════════════
    
    init();
    
})();
