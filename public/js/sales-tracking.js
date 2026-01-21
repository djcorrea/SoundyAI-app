// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

/**
 * 🛒 SOUNDYAI - TRACKING DE PÁGINA DE VENDAS
 * 
 * Script para rastrear cliques em CTAs que levam ao checkout Hotmart.
 * Pode ser incluído em páginas externas (ex: musicaprofissional.com.br).
 * 
 * Dependências:
 * - tracking.js (módulo principal)
 * - tracking-config.js (configuração centralizada)
 * - Google Tag (gtag.js) já carregado na página
 * 
 * @version 1.0.0
 * @created 2026-01-20
 */

(function() {
    'use strict';
    
    log('🛒 [SALES-TRACKING] Módulo carregado');
    
    /**
     * Identifica e intercepta CTAs que levam para Hotmart
     */
    function setupSalesCTATracking() {
        // Aguardar tracking estar pronto
        if (!window.SoundyTracking || !window.SoundyTracking.isEnabled()) {
            warn('⚠️ [SALES-TRACKING] Sistema de tracking não disponível');
            return;
        }
        
        // Seletores de botões de checkout (ajustar conforme necessário)
        const selectors = [
            'a[href*="hotmart.com"]',
            'a[href*="pay.hotmart"]',
            'button[data-checkout-url]',
            '.checkout-btn',
            '.buy-now',
            '.cta-checkout'
        ];
        
        const buttons = document.querySelectorAll(selectors.join(','));
        
        if (buttons.length === 0) {
            warn('⚠️ [SALES-TRACKING] Nenhum botão de checkout encontrado');
            return;
        }
        
        log(`🎯 [SALES-TRACKING] ${buttons.length} botão(ões) de checkout encontrado(s)`);
        
        buttons.forEach((button, index) => {
            // Evitar múltiplos listeners no mesmo botão
            if (button.dataset.trackingInstalled) {
                return;
            }
            
            button.dataset.trackingInstalled = 'true';
            
            button.addEventListener('click', function(e) {
                // Prevenir navegação padrão temporariamente
                e.preventDefault();
                
                // Obter URL de checkout
                const checkoutUrl = this.href || this.dataset.checkoutUrl;
                
                if (!checkoutUrl) {
                    error('❌ [SALES-TRACKING] URL de checkout não encontrada');
                    return;
                }
                
                log(`🎯 [SALES-TRACKING] Clique detectado no botão ${index + 1}:`, checkoutUrl);
                
                // Rastrear evento
                try {
                    window.SoundyTracking.trackCTASalesToCheckout(checkoutUrl);
                    log('✅ [SALES-TRACKING] Evento enviado');
                } catch (error) {
                    error('❌ [SALES-TRACKING] Erro ao rastrear:', error);
                }
                
                // Usar sendBeacon se disponível (mais confiável)
                if (navigator.sendBeacon && window.dataLayer) {
                    // dataLayer já foi atualizado pelo tracking.js
                    log('📡 [SALES-TRACKING] Usando sendBeacon para garantia');
                }
                
                // Continuar navegação após delay mínimo
                setTimeout(() => {
                    window.location.href = checkoutUrl;
                }, 80); // 80ms é suficiente para enviar beacon
            });
        });
    }
    
    /**
     * Inicializar quando DOM estiver pronto
     */
    function init() {
        // Aguardar um pouco para garantir que tracking.js carregou
        setTimeout(setupSalesCTATracking, 100);
    }
    
    // Executar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
