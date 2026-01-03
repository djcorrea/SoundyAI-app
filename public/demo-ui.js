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
 * - Único CTA → Checkout
 * 
 * @version 2.0.0
 * @created 2026-01-02
 */

(function() {
    'use strict';

    // Aguardar demo-core.js carregar
    if (!window.SoundyDemo) {
        console.error('❌ [DEMO-UI] demo-core.js não carregado!');
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
     * - Único CTA → Checkout
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
        
        console.log(`🔥 [DEMO-UI] Exibindo modal de conversão (motivo: ${reason})`);
        
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
                    
                    <!-- CTA Secundário - Voltar para página do produto (EM CIMA) -->
                    <button class="demo-cta-secondary" id="demoSecondaryButton" style="pointer-events: auto;">
                        <span>${CONFIG.texts.ctaSecondary}</span>
                    </button>
                    
                    <!-- Selo de segurança -->
                    <p class="demo-security-badge">${CONFIG.texts.securityBadge}</p>
                    
                    <!-- CTA Principal - Checkout (EM BAIXO) -->
                    <button class="demo-cta-button" id="demoCTAButton" style="pointer-events: auto;">
                        <span>${CONFIG.texts.ctaButton}</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
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
        
        // Evento do botão principal (checkout)
        document.getElementById('demoCTAButton').addEventListener('click', () => {
            DEMO.redirectToCheckout(reason);
        });
        
        // Evento do botão secundário (voltar para página do produto)
        document.getElementById('demoSecondaryButton').addEventListener('click', () => {
            window.location.href = CONFIG.productPageUrl || 'https://soundyai.com.br';
        });
        
        // 🔴 IMPORTANTE: Prevenir qualquer interação fora do modal
        modal.addEventListener('click', (e) => {
            // Só permitir clique nos botões CTA
            const isMainCTA = e.target.id === 'demoCTAButton' || e.target.closest('#demoCTAButton');
            const isSecondaryCTA = e.target.id === 'demoSecondaryButton' || e.target.closest('#demoSecondaryButton');
            if (!isMainCTA && !isSecondaryCTA) {
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
        
        console.log('🔥 [DEMO-UI] Modal de conversão exibido - BLOQUEANTE');
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
            
            .demo-cta-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                width: 100%;
                padding: 20px 36px;
                font-family: 'Orbitron', 'Segoe UI', sans-serif;
                font-size: 1.15rem;
                font-weight: 700;
                color: #ffffff;
                background: linear-gradient(135deg, #bc13fe 0%, #00f3ff 100%);
                border: none;
                border-radius: 14px;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                box-shadow: 0 8px 25px rgba(188, 19, 254, 0.4);
            }
            
            .demo-cta-button:hover {
                transform: translateY(-3px);
                box-shadow: 
                    0 15px 40px rgba(188, 19, 254, 0.5),
                    0 0 30px rgba(0, 243, 255, 0.4);
            }
            
            .demo-cta-button:active {
                transform: translateY(-1px);
            }
            
            .demo-cta-button svg {
                flex-shrink: 0;
                animation: demoArrow 1.5s infinite;
            }
            
            @keyframes demoArrow {
                0%, 100% { transform: translateX(0); }
                50% { transform: translateX(5px); }
            }
            
            .demo-security-badge {
                font-family: 'Rajdhani', 'Segoe UI', sans-serif;
                font-size: 0.9rem;
                color: #7a7a9a;
                margin: 20px 0 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            
            /* Botão secundário - Voltar para página do produto */
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
                
                .demo-cta-button {
                    padding: 18px 28px;
                    font-size: 1rem;
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
        console.log(`🛒 [DEMO-UI] Redirecionando para checkout (motivo: ${reason})`);
        
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
            console.log('📊 [DEMO-UI] Dados de conversão:', conversionData);
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
        console.log('✅ [DEMO-UI] Checkout URL atualizada:', url);
    };

    console.log('🔥 [DEMO-UI] Módulo UI carregado');

})();
