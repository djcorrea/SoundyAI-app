/**
 * 📊 SOUNDYAI - EXEMPLO DE INTEGRAÇÃO DE TRACKING EM PÁGINAS DE VENDAS
 * 
 * Este arquivo mostra como integrar o tracking em qualquer página de vendas/landing
 * que tenha botões CTAs apontando para checkout (Hotmart, Stripe, etc)
 * 
 * ✅ INSTRUÇÕES:
 * 1. Incluir tracking.js na página
 * 2. Adicionar event listeners nos botões CTA
 * 3. Chamar SoundyTracking.trackCTASalesToCheckout() antes da navegação
 * 
 * @version 1.0.0
 * @created 2026-01-20
 */

// ═══════════════════════════════════════════════════════════════════
// EXEMPLO 1: Botão CTA HTML com href direto
// ═══════════════════════════════════════════════════════════════════
/*
HTML:
<a href="https://pay.hotmart.com/SEU_PRODUTO" 
   class="cta-button" 
   id="btnCheckout">
   Garantir meu acesso agora
</a>

JavaScript:
*/
document.addEventListener('DOMContentLoaded', function() {
    const btnCheckout = document.getElementById('btnCheckout');
    
    if (btnCheckout) {
        btnCheckout.addEventListener('click', function(e) {
            // Prevenir navegação padrão temporariamente
            e.preventDefault();
            
            const checkoutUrl = this.href;
            
            // Rastrear evento (com delay mínimo para não atrasar UX)
            if (window.SoundyTracking && window.SoundyTracking.isEnabled()) {
                window.SoundyTracking.trackCTASalesToCheckout(checkoutUrl);
                console.log('📊 CTA → Checkout rastreado');
            }
            
            // Continuar navegação após delay mínimo (ou imediato)
            setTimeout(() => {
                window.location.href = checkoutUrl;
            }, 50); // 50ms não é perceptível ao usuário
        });
    }
});

// ═══════════════════════════════════════════════════════════════════
// EXEMPLO 2: Botão com JavaScript (window.location)
// ═══════════════════════════════════════════════════════════════════
/*
HTML:
<button onclick="goToCheckout()">
   Desbloquear acesso completo
</button>

JavaScript:
*/
function goToCheckout() {
    const checkoutUrl = 'https://pay.hotmart.com/SEU_PRODUTO';
    
    // Rastrear antes de redirecionar
    if (window.SoundyTracking && window.SoundyTracking.isEnabled()) {
        window.SoundyTracking.trackCTASalesToCheckout(checkoutUrl);
    }
    
    // Redirecionar
    setTimeout(() => {
        window.location.href = checkoutUrl;
    }, 50);
}

// ═══════════════════════════════════════════════════════════════════
// EXEMPLO 3: Múltiplos botões com mesma classe
// ═══════════════════════════════════════════════════════════════════
/*
HTML:
<a href="https://pay.hotmart.com/PRODUTO_BASICO" class="cta-checkout">Plano Básico</a>
<a href="https://pay.hotmart.com/PRODUTO_PRO" class="cta-checkout">Plano Pro</a>
<a href="https://pay.hotmart.com/PRODUTO_STUDIO" class="cta-checkout">Plano Studio</a>

JavaScript:
*/
document.addEventListener('DOMContentLoaded', function() {
    const checkoutButtons = document.querySelectorAll('.cta-checkout');
    
    checkoutButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const checkoutUrl = this.href;
            
            // Rastrear
            if (window.SoundyTracking && window.SoundyTracking.isEnabled()) {
                window.SoundyTracking.trackCTASalesToCheckout(checkoutUrl);
            }
            
            // Redirecionar
            setTimeout(() => {
                window.location.href = checkoutUrl;
            }, 50);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// EXEMPLO 4: Integração com frameworks (React/Vue/etc)
// ═══════════════════════════════════════════════════════════════════
/*
// React
function CheckoutButton({ plan, checkoutUrl }) {
    const handleClick = (e) => {
        e.preventDefault();
        
        if (window.SoundyTracking?.isEnabled()) {
            window.SoundyTracking.trackCTASalesToCheckout(checkoutUrl);
        }
        
        setTimeout(() => {
            window.location.href = checkoutUrl;
        }, 50);
    };
    
    return (
        <a href={checkoutUrl} onClick={handleClick}>
            Assinar {plan}
        </a>
    );
}

// Vue
export default {
    methods: {
        goToCheckout(checkoutUrl) {
            if (window.SoundyTracking?.isEnabled()) {
                window.SoundyTracking.trackCTASalesToCheckout(checkoutUrl);
            }
            
            setTimeout(() => {
                window.location.href = checkoutUrl;
            }, 50);
        }
    }
}
*/

// ═══════════════════════════════════════════════════════════════════
// EXEMPLO 5: Tracking de conversão completa (após Hotmart confirmar)
// ═══════════════════════════════════════════════════════════════════
/*
// Este código deve ser usado APENAS em backend (webhook Hotmart)
// ou em página de "obrigado" após confirmação de pagamento

// Backend (Node.js + Express)
app.post('/api/webhook/hotmart', async (req, res) => {
    const { transaction_id, status, price, currency } = req.body;
    
    // Validar assinatura Hotmart...
    
    if (status === 'approved') {
        // Enviar conversão via server-side ou registrar para envio posterior
        // (Necessita implementação via Google Ads Offline Conversions API)
        
        // Salvar em banco para envio posterior:
        await db.purchases.create({
            transactionId: transaction_id,
            value: price,
            currency: currency,
            tracked: false,
            createdAt: new Date()
        });
        
        res.status(200).send('OK');
    }
});

// Página de obrigado (após redirect do Hotmart)
// URL: /obrigado?transaction=XXXXX
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const transactionId = urlParams.get('transaction');
    
    if (transactionId && window.SoundyTracking?.isEnabled()) {
        // Enviar conversão de compra
        window.SoundyTracking.trackPurchase(
            transactionId,
            parseFloat(urlParams.get('value') || '0'),
            urlParams.get('currency') || 'BRL'
        );
    }
});
*/

// ═══════════════════════════════════════════════════════════════════
// 📋 CHECKLIST DE IMPLEMENTAÇÃO
// ═══════════════════════════════════════════════════════════════════
console.log(`
📊 TRACKING INTEGRATION CHECKLIST

✅ Passo 1: Incluir tracking.js na página
   <script src="/js/tracking.js" defer></script>

✅ Passo 2: Incluir Google Tag (gtag.js) no <head>
   <script async src="https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXX"></script>

✅ Passo 3: Configurar IDs do Google Ads
   SoundyTracking.configure({
       conversionId: 'AW-XXXXXXX',
       labels: {
           waitlist: 'LABEL_WAITLIST',
           ctaSales: 'LABEL_CTA_SALES',
           purchase: 'LABEL_PURCHASE'
       }
   });

✅ Passo 4: Adicionar event listeners nos botões CTA
   (Use um dos exemplos acima conforme sua estrutura)

✅ Passo 5: Testar com Google Tag Assistant
   - Abrir Chrome DevTools
   - Instalar extensão "Tag Assistant" (Google)
   - Verificar eventos disparando corretamente

✅ Passo 6: Validar conversões no Google Ads
   - Acessar Google Ads → Ferramentas → Conversões
   - Verificar se conversões estão sendo registradas
   - Aguardar até 24h para dados aparecerem
`);
