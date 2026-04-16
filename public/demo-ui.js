/**
 * 🔥 SOUNDYAI - DEMO UI
 * 
 * Módulo de interface: modal de conversão, redirect checkout
 * Parte 3/3 do sistema de Demo de Venda
 * 
 * CARACTERÍSTICAS DO MODAL:
 * - BLOQUEANTE (sem botão fechar)
 * - Aparece IMEDIATAMENTE após limite
 * - position: fixed, z-index máximo
 * - overflow: hidden no body
 * - Único CTA → Voltar para página do produto
 * 
 * @version 2.1.0
 * @updated 2026-01-07 - Removido botão de checkout
 * @created 2026-01-02
 */

(function() {
    'use strict';

    // Aguardar demo-core.js carregar
    if (!window.SoundyDemo) {
        error('❌ [DEMO-UI] demo-core.js não carregado!');
        return;
    }

    const DEMO = window.SoundyDemo;
    const CONFIG = DEMO.config;

    // ═══════════════════════════════════════════════════════════
    // 🪟 MODAL DE CONVERSÃO (BLOQUEANTE)
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Mostra modal de conversão BLOQUEANTE
     * 
     * @param {string} reason - Motivo do bloqueio: 'analysis_limit' | 'chat_limit' | 'forced_block'
     * 
     * CARACTERÍSTICAS:
     * - Sem botão de fechar (NÃO EXISTE)
     * - Não fecha clicando fora
     * - Único CTA → Voltar para página do produto
     * - Aparece IMEDIATAMENTE
     * - Bloqueia scroll e interação com UI
     */
    DEMO.showConversionModal = function(reason = 'limit_reached') {
        // Evitar duplicação
        if (DEMO.modalShown) {
            const existing = document.getElementById('demoConversionModal');
            if (existing) {
                existing.style.display = 'flex';
                return;
            }
        }
        
        log(`🔥 [DEMO-UI] Exibindo modal de conversão (motivo: ${reason})`);
        
        DEMO.modalShown = true;
        
        // 🔴 CRÍTICO: Bloquear TUDO imediatamente
        document.body.style.overflow = 'hidden';
        document.body.style.pointerEvents = 'none';
        
        const modal = document.createElement('div');
        modal.id = 'demoConversionModal';
        modal.className = 'demo-conversion-modal-overlay';
        modal.setAttribute('data-reason', reason);
        
        // 🔴 TEXTO FINAL APROVADO - NÃO ALTERAR
        modal.innerHTML = `
            <div class="demo-conversion-modal">
                <div class="demo-conversion-modal-content">
                    <!-- Ícone de sucesso -->
                    <div class="demo-modal-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 12l2 2 4-4"></path>
                            <circle cx="12" cy="12" r="10"></circle>
                        </svg>
                    </div>
                    
                    <!-- Título APROVADO -->
                    <h2 class="demo-modal-title">${CONFIG.texts.title}</h2>
                    
                    <!-- Subtítulo APROVADO -->
                    <p class="demo-modal-subtitle">${CONFIG.texts.subtitle}</p>
                    
                    <!-- Botão "Voltar" - único CTA disponível -->
                    <button class="demo-cta-secondary" id="demoSecondaryButton" style="pointer-events: auto;">
                        <span>${CONFIG.texts.ctaSecondary}</span>
                    </button>
                </div>
            </div>
        `;
        
        // Injetar estilos se não existirem
        if (!document.getElementById('demoModalStyles')) {
            const styles = document.createElement('style');
            styles.id = 'demoModalStyles';
            styles.textContent = getDemoModalStyles();
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(modal);
        
        // Evento do botão "Voltar" (único CTA disponível)
        document.getElementById('demoSecondaryButton').addEventListener('click', () => {
            // ═══════════════════════════════════════════════════════════
            // 📊 TRACKING: CTA Demo → Página de Vendas
            // ═══════════════════════════════════════════════════════════
            if (window.SoundyTracking && window.SoundyTracking.isEnabled()) {
                try {
                    window.SoundyTracking.trackCTADemoToSales(window.location.href);
                    log('📊 CTA Demo → Vendas rastreado');
                } catch (trackingError) {
                    warn('⚠️ Erro no tracking (não crítico):', trackingError);
                }
            }
            
            // Navegação (não atrasar)
            window.location.href = CONFIG.productPageUrl || 'https://musicaprofissional.com.br/';
        });
        
        // 🔴 IMPORTANTE: Prevenir qualquer interação fora do modal
        modal.addEventListener('click', (e) => {
            // Só permitir clique no botão "Voltar"
            const isSecondaryCTA = e.target.id === 'demoSecondaryButton' || e.target.closest('#demoSecondaryButton');
            if (!isSecondaryCTA) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        // Prevenir Escape e outras teclas
        const preventKeys = (e) => {
            if (DEMO.modalShown) {
                // Bloquear Escape, Tab, etc
                if (['Escape', 'Tab'].includes(e.key)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        };
        document.addEventListener('keydown', preventKeys, true);
        
        log('🔥 [DEMO-UI] Modal de conversão exibido - BLOQUEANTE');
    };

    /**
     * Retorna CSS do modal com z-index MÁXIMO
     */
    function getDemoModalStyles() {
        return `
            /* 🔴 Z-INDEX MÁXIMO para garantir que está acima de TUDO */
            .demo-conversion-modal-overlay {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background: rgba(0, 0, 0, 0.98) !important;
                backdrop-filter: blur(15px) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                z-index: 2147483647 !important; /* Máximo possível */
                animation: demoFadeIn 0.3s ease !important;
                pointer-events: auto !important;
            }
            
            @keyframes demoFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .demo-conversion-modal {
                background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
                border: 2px solid rgba(188, 19, 254, 0.5);
                border-radius: 20px;
                padding: 48px 40px;
                max-width: 500px;
                width: 90%;
                text-align: center;
                box-shadow: 
                    0 0 80px rgba(188, 19, 254, 0.3),
                    0 0 120px rgba(0, 243, 255, 0.15),
                    0 25px 50px rgba(0, 0, 0, 0.5);
                animation: demoSlideUp 0.4s ease;
                pointer-events: auto;
            }
            
            @keyframes demoSlideUp {
                from { 
                    opacity: 0; 
                    transform: translateY(30px) scale(0.95); 
                }
                to { 
                    opacity: 1; 
                    transform: translateY(0) scale(1); 
                }
            }
            
            .demo-modal-icon {
                width: 88px;
                height: 88px;
                margin: 0 auto 28px;
                background: linear-gradient(135deg, #00f3ff 0%, #bc13fe 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: demoPulse 2s infinite;
            }
            
            @keyframes demoPulse {
                0%, 100% { 
                    box-shadow: 0 0 30px rgba(0, 243, 255, 0.5); 
                }
                50% { 
                    box-shadow: 0 0 50px rgba(188, 19, 254, 0.7); 
                }
            }
            
            .demo-modal-icon svg {
                width: 44px;
                height: 44px;
                stroke: white;
            }
            
            .demo-modal-title {
                font-family: 'Rajdhani', 'Segoe UI', sans-serif;
                font-size: 2rem;
                font-weight: 700;
                color: #ffffff;
                margin: 0 0 16px;
                line-height: 1.3;
                text-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
            }
            
            .demo-modal-subtitle {
                font-family: 'Rajdhani', 'Segoe UI', sans-serif;
                font-size: 1.15rem;
                color: #b0b0d0;
                margin: 0 0 36px;
                line-height: 1.6;
            }
            
            /* Botão "Voltar" - único CTA disponível */
            .demo-cta-secondary {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                padding: 14px 24px;
                font-family: 'Rajdhani', 'Segoe UI', sans-serif;
                font-size: 0.95rem;
                font-weight: 600;
                color: #b0b0d0;
                background: transparent;
                border: 1px solid rgba(176, 176, 208, 0.3);
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.3s ease;
                margin-top: 8px;
            }
            
            .demo-cta-secondary:hover {
                color: #ffffff;
                border-color: rgba(0, 243, 255, 0.5);
                background: rgba(0, 243, 255, 0.1);
            }
            
            /* Responsivo */
            @media (max-width: 480px) {
                .demo-conversion-modal {
                    padding: 36px 24px;
                    margin: 20px;
                    border-radius: 16px;
                }
                
                .demo-modal-icon {
                    width: 72px;
                    height: 72px;
                }
                
                .demo-modal-icon svg {
                    width: 36px;
                    height: 36px;
                }
                
                .demo-modal-title {
                    font-size: 1.6rem;
                }
                
                .demo-modal-subtitle {
                    font-size: 1.05rem;
                }
            }
        `;
    }

    // ═══════════════════════════════════════════════════════════
    // 🛒 REDIRECT PARA CHECKOUT (CENTRALIZADO)
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Redireciona para checkout
     * 
     * @param {string} reason - 'analysis_limit' | 'chat_limit' | 'forced_block'
     * 
     * FUNÇÃO ÚNICA E CENTRALIZADA para redirect
     * Registra motivo para analytics futuro
     */
    DEMO.redirectToCheckout = function(reason = 'unknown') {
        log(`🛒 [DEMO-UI] Redirecionando para checkout (motivo: ${reason})`);
        
        // Registrar dados de conversão (para analytics futuro)
        const conversionData = {
            reason: reason,
            timestamp: new Date().toISOString(),
            visitorId: DEMO.visitorId,
            analysesUsed: DEMO.data?.analyses_used || 0,
            messagesUsed: DEMO.data?.messages_used || 0,
        };
        
        // Salvar dados de conversão
        if (DEMO.data) {
            DEMO.data.converted = true;
            DEMO.data.conversion_reason = reason;
            DEMO.data.conversion_time = conversionData.timestamp;
            DEMO._saveDemoData(DEMO.data);
        }
        
        // Tentar enviar para analytics (fire and forget)
        try {
            // Futuro: enviar para backend/analytics
            log('📊 [DEMO-UI] Dados de conversão:', conversionData);
        } catch (e) {
            // Silencioso - não bloquear redirect
        }
        
        // 🔴 REDIRECT EFETIVO
        window.location.href = CONFIG.checkoutUrl;
    };

    /**
     * Atualiza URL de checkout (para configuração dinâmica)
     */
    DEMO.setCheckoutUrl = function(url) {
        CONFIG.checkoutUrl = url;
        log('✅ [DEMO-UI] Checkout URL atualizada:', url);
    };

    // ═══════════════════════════════════════════════════════════
    // 🎉 CTA NÃO-BLOQUEANTE APÓS PRIMEIRA ANÁLISE
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Exibe banner CTA não-bloqueante após primeira análise
     * NÃO impede visualização do resultado
     * Aparece no topo e rodapé da interface
     * 
     * CARACTERÍSTICAS:
     * - Permite scroll completo da página
     * - Não bloqueia interação
     * - Aparece SEMPRE após primeira análise (garantia de conversão)
     * - Design não-intrusivo mas visível
     * 
     * @version 2.0.0
     * @updated 2026-01-27 - Removido sessionStorage, garantir exibição sempre
     * @created 2026-01-22
     */
    DEMO.showFirstAnalysisCTA = function() {
        // � DEBUG: Log completo do estado
        console.group('🎉 [DEMO-UI] Tentando exibir CTA de primeira análise');
        debugLog('DEMO.isActive:', DEMO.isActive);
        debugLog('DEMO.data:', DEMO.data);
        debugLog('analyses_used:', DEMO.data?.analyses_used);
        debugLog('Banner já existe?', !!document.querySelector('.demo-first-analysis-banner'));
        
        // 🔴 CRÍTICO: Verificar se está realmente em modo demo
        if (!DEMO.isActive) {
            debugWarn('⚠️ [DEMO-UI] Não está em modo demo, CTA não será exibido');
            console.groupEnd();
            return;
        }
        
        // 🔴 CRÍTICO: Evitar duplicação DOM (se já existe, não criar novamente)
        if (document.querySelector('.demo-first-analysis-banner')) {
            debugLog('ℹ️ [DEMO-UI] CTA de primeira análise já está no DOM');
            console.groupEnd();
            return;
        }
        
        // 🔴 MELHORADO: Aceitar analyses_used === 1 OU análises <= limite
        // Isso garante exibição mesmo se houver race condition
        const analysesUsed = DEMO.data?.analyses_used || 0;
        if (analysesUsed !== 1 && analysesUsed > 1) {
            debugWarn('⚠️ [DEMO-UI] Não é a primeira análise, CTA não será exibido. analyses_used:', analysesUsed);
            console.groupEnd();
            return;
        }
        
        debugLog('✅ [DEMO-UI] Todas validações passaram! Exibindo CTA...');
        console.groupEnd();
        
        log('🎉 [DEMO-UI] Exibindo CTA não-bloqueante de primeira análise');
        
        // Criar banner superior
        const topBanner = createFirstAnalysisBanner('top');
        document.body.insertBefore(topBanner, document.body.firstChild);
        
        // Criar banner inferior
        const bottomBanner = createFirstAnalysisBanner('bottom');
        document.body.appendChild(bottomBanner);
        
        // Adicionar estilos se não existirem
        if (!document.getElementById('demoFirstAnalysisCTAStyles')) {
            const styles = document.createElement('style');
            styles.id = 'demoFirstAnalysisCTAStyles';
            styles.textContent = getFirstAnalysisCTAStyles();
            document.head.appendChild(styles);
        }
        
        // Animar entrada após um pequeno delay
        setTimeout(() => {
            topBanner.style.transform = 'translateY(0)';
            topBanner.style.opacity = '1';
            bottomBanner.style.transform = 'translateY(0)';
            bottomBanner.style.opacity = '1';
        }, 500);
        
        log('✅ [DEMO-UI] Banners CTA de primeira análise exibidos');
    };
    
    /**
     * Cria banner de CTA (top ou bottom)
     */
    function createFirstAnalysisBanner(position) {
        const banner = document.createElement('div');
        banner.className = `demo-first-analysis-banner demo-first-analysis-banner-${position}`;
        banner.setAttribute('data-position', position);
        
        banner.innerHTML = `
            <div class="demo-first-analysis-content">
                <div class="demo-first-analysis-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 12l2 2 4-4"></path>
                        <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                </div>
                <div class="demo-first-analysis-text">
                    <h3>⚠️ Análise teste concluída</h3>
                    <p>O que você viu é só 30% do diagnóstico real. Descubra como ter acesso completo e ilimitado.</p>
                </div>
                <button class="demo-first-analysis-button" onclick="window.SoundyDemo._handleFirstAnalysisCTAClick()">
                    Desbloquear acesso completo
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                </button>
            </div>
        `;
        
        return banner;
    }
    
    /**
     * Handler do clique no CTA de primeira análise
     */
    DEMO._handleFirstAnalysisCTAClick = function() {
        log('🎯 [DEMO-UI] CTA de primeira análise clicado');
        
        // Tracking
        if (window.SoundyTracking && window.SoundyTracking.isEnabled()) {
            try {
                window.SoundyTracking.trackCTADemoToSales(window.location.href, 'first_analysis_cta');
                log('📊 CTA primeira análise → Vendas rastreado');
            } catch (trackingError) {
                warn('⚠️ Erro no tracking (não crítico):', trackingError);
            }
        }
        
        // Redirecionar para página do produto com âncora #oferta
        window.location.href = (CONFIG.productPageUrl || 'https://musicaprofissional.com.br/') + '#oferta';
    };
    
    /**
     * Retorna CSS dos banners de primeira análise
     */
    function getFirstAnalysisCTAStyles() {
        return `
            /* Banners de CTA após primeira análise */
            .demo-first-analysis-banner {
                position: fixed;
                left: 0;
                right: 0;
                z-index: 999999;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border: 2px solid rgba(188, 19, 254, 0.5);
                box-shadow: 0 4px 20px rgba(188, 19, 254, 0.3);
                padding: 20px;
                opacity: 0;
                transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .demo-first-analysis-banner-top {
                top: 0;
                transform: translateY(-100%);
                border-bottom-left-radius: 12px;
                border-bottom-right-radius: 12px;
                border-top: none;
            }
            
            .demo-first-analysis-banner-bottom {
                bottom: 0;
                transform: translateY(100%);
                border-top-left-radius: 12px;
                border-top-right-radius: 12px;
                border-bottom: none;
            }
            
            .demo-first-analysis-content {
                max-width: 1200px;
                margin: 0 auto;
                display: flex;
                align-items: center;
                gap: 20px;
                flex-wrap: wrap;
                justify-content: center;
            }
            
            .demo-first-analysis-icon {
                width: 48px;
                height: 48px;
                background: linear-gradient(135deg, #00f3ff 0%, #bc13fe 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                animation: demoPulseSmall 2s infinite;
            }
            
            @keyframes demoPulseSmall {
                0%, 100% { 
                    box-shadow: 0 0 15px rgba(0, 243, 255, 0.5); 
                }
                50% { 
                    box-shadow: 0 0 25px rgba(188, 19, 254, 0.7); 
                }
            }
            
            .demo-first-analysis-icon svg {
                width: 24px;
                height: 24px;
                stroke: white;
            }
            
            .demo-first-analysis-text {
                flex: 1;
                min-width: 300px;
                text-align: left;
            }
            
            .demo-first-analysis-text h3 {
                font-family: 'Rajdhani', 'Segoe UI', sans-serif;
                font-size: 1.4rem;
                font-weight: 700;
                color: #ffffff;
                margin: 0 0 6px 0;
                line-height: 1.3;
            }
            
            .demo-first-analysis-text p {
                font-family: 'Rajdhani', 'Segoe UI', sans-serif;
                font-size: 1rem;
                color: #b0b0d0;
                margin: 0;
                line-height: 1.5;
            }
            
            .demo-first-analysis-button {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 14px 28px;
                font-family: 'Rajdhani', 'Segoe UI', sans-serif;
                font-size: 1.05rem;
                font-weight: 700;
                color: #ffffff;
                background: linear-gradient(135deg, #00f3ff 0%, #bc13fe 100%);
                border: none;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.3s ease;
                flex-shrink: 0;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .demo-first-analysis-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 25px rgba(188, 19, 254, 0.6);
            }
            
            .demo-first-analysis-button svg {
                width: 16px;
                height: 16px;
                stroke: white;
            }
            
            /* Responsivo */
            @media (max-width: 768px) {
                .demo-first-analysis-banner {
                    padding: 16px;
                }
                
                .demo-first-analysis-content {
                    flex-direction: column;
                    text-align: center;
                    gap: 16px;
                }
                
                .demo-first-analysis-text {
                    text-align: center;
                    min-width: auto;
                }
                
                .demo-first-analysis-text h3 {
                    font-size: 1.2rem;
                }
                
                .demo-first-analysis-text p {
                    font-size: 0.95rem;
                }
                
                .demo-first-analysis-button {
                    width: 100%;
                    justify-content: center;
                    padding: 12px 20px;
                    font-size: 1rem;
                }
                
                .demo-first-analysis-icon {
                    width: 40px;
                    height: 40px;
                }
                
                .demo-first-analysis-icon svg {
                    width: 20px;
                    height: 20px;
                }
            }
        `;
    }

    log('🔥 [DEMO-UI] Módulo UI carregado');

})();
