/**
 * 🎯 SOUNDYAI - CONFIGURAÇÃO CENTRALIZADA DE TRACKING
 * 
 * ⚠️ IMPORTANTE: Preencher os IDs reais antes do deploy!
 * 
 * Como obter os IDs:
 * 1. Acessar https://ads.google.com/
 * 2. Menu: Ferramentas → Medição → Conversões
 * 3. Criar/copiar os IDs conforme abaixo
 * 
 * @version 1.0.0
 * @updated 2026-01-20
 */

(function() {
    'use strict';
    
    // ═══════════════════════════════════════════════════════════════════
    // 🔑 CONFIGURAÇÃO - PREENCHER COM IDS REAIS
    // ═══════════════════════════════════════════════════════════════════
    
    const TRACKING_CONFIG = {
        // ⚠️ ID DA CONTA GOOGLE ADS (formato: AW-XXXXXXXXXXX)
        // Onde encontrar: Google Ads → Ferramentas → Conversões → Qualquer conversão
        conversionId: 'AW-REPLACE_WITH_YOUR_ID',
        
        // ⚠️ LABELS DAS CONVERSÕES
        labels: {
            // Lead: cadastro na lista de espera
            // Criar conversão: Nome "Lista de Espera" | Categoria: Lead | Valor: 0
            waitlistSignup: 'REPLACE_WITH_WAITLIST_LABEL',
            
            // Clique para checkout Hotmart
            // Criar conversão: Nome "Checkout Click" | Categoria: Outro | Valor: 0
            checkoutClick: 'REPLACE_WITH_CHECKOUT_LABEL',
            
            // Compra (futuro - postback Hotmart)
            // Criar conversão: Nome "Compra" | Categoria: Compra | Valor: dinâmico
            purchase: 'REPLACE_WITH_PURCHASE_LABEL'
        },
        
        // Debug mode (logs no console)
        debug: window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.search.includes('debug=true')
    };
    
    // ═══════════════════════════════════════════════════════════════════
    // 🚀 INICIALIZAÇÃO AUTOMÁTICA
    // ═══════════════════════════════════════════════════════════════════
    
    // Aguardar tracking.js carregar
    function initTracking() {
        if (window.SoundyTracking) {
            // Configurar sistema
            window.SoundyTracking.configure({
                conversionId: TRACKING_CONFIG.conversionId,
                labels: {
                    waitlist: TRACKING_CONFIG.labels.waitlistSignup,
                    ctaDemo: '', // Não usado por enquanto
                    ctaSales: TRACKING_CONFIG.labels.checkoutClick,
                    purchase: TRACKING_CONFIG.labels.purchase
                }
            });
            
            // Ativar debug se necessário
            if (TRACKING_CONFIG.debug) {
                window.SoundyTracking.setDebug(true);
                console.log('🎯 [TRACKING-CONFIG] Debug mode ativado');
            }
            
            console.log('✅ [TRACKING-CONFIG] Sistema configurado com sucesso');
            
            // Verificar se IDs foram preenchidos
            if (TRACKING_CONFIG.conversionId.includes('REPLACE_WITH')) {
                console.warn('⚠️ [TRACKING-CONFIG] IDs ainda não foram preenchidos! Ver TRACKING_SETUP.md');
            }
        } else {
            console.error('❌ [TRACKING-CONFIG] SoundyTracking não encontrado. Incluir tracking.js antes deste arquivo.');
        }
    }
    
    // Inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTracking);
    } else {
        initTracking();
    }
    
})();
