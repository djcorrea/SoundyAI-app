# 🔒 AUDITORIA STRIPE - SoundyAI
## Relatório Completo de Implementação

**Data:** 03/01/2026  
**Status:** ✅ COMPLETO

---

## 📋 RESUMO DAS ALTERAÇÕES

### Arquivos Modificados:
| Arquivo | Alteração |
|---------|-----------|
| [work/lib/stripe/config.js](work/lib/stripe/config.js) | Price IDs hardcoded + função `getPlanFromPriceId()` |
| [work/api/stripe/create-checkout-session.js](work/api/stripe/create-checkout-session.js) | Adicionado `client_reference_id`, melhorado URLs |
| [work/api/webhook/stripe.js](work/api/webhook/stripe.js) | **REESCRITO** - Tratamento completo de 6 eventos |
| [work/lib/user/userPlans.js](work/lib/user/userPlans.js) | Nova função `downgradeToFree()`, `applySubscription()` com customerId |
| [.env.example](.env.example) | Price IDs reais + eventos adicionais |

### Arquivos Criados:
| Arquivo | Descrição |
|---------|-----------|
| [public/success.html](public/success.html) | Página de sucesso pós-pagamento |

---

## 💳 PRICE IDs CONFIGURADOS

```
PLUS: price_1SlHm6COXidjqeFinckOK8J9
PRO:  price_1SlIKMCOXidjqeFiTiPExXEb
```

> ⚠️ Estes IDs estão hardcoded como fallback no `config.js`. Para alterá-los, defina as variáveis de ambiente ou modifique o código.

---

## 🔐 VARIÁVEIS DE AMBIENTE (.env)

```bash
# STRIPE - OBRIGATÓRIAS
STRIPE_SECRET_KEY=sk_live_... (ou sk_test_... para testes)
STRIPE_WEBHOOK_SECRET=whsec_...

# STRIPE - OPCIONAIS (já tem fallback)
STRIPE_PRICE_ID_PLUS=price_1SlHm6COXidjqeFinckOK8J9
STRIPE_PRICE_ID_PRO=price_1SlIKMCOXidjqeFiTiPExXEb
STRIPE_SUCCESS_URL=https://seu-dominio.com/success.html?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://seu-dominio.com/planos.html?canceled=true
```

---

## 📡 WEBHOOK - EVENTOS TRATADOS

Configure o webhook no Stripe Dashboard para enviar os seguintes eventos:

| Evento | Ação no Sistema |
|--------|-----------------|
| `checkout.session.completed` | Ativa plano após pagamento inicial |
| `customer.subscription.created` | Log (ativação delegada ao checkout) |
| `customer.subscription.updated` | Atualiza status (active/past_due/canceled/unpaid) |
| `customer.subscription.deleted` | Cancela ou rebaixa para free |
| `invoice.payment_succeeded` | Renova assinatura mensal |
| `invoice.payment_failed` | Marca past_due ou rebaixa para free |

**URL do Webhook:** `https://seu-dominio.com/api/webhook/stripe`

---

## 🗄️ SCHEMA DO FIRESTORE

### Collection: `usuarios/{uid}`

```javascript
{
  // Campos de Plano
  plan: "free" | "plus" | "pro",
  
  // Dados da Assinatura Stripe
  subscription: {
    id: "sub_xxx",                    // Subscription ID
    customerId: "cus_xxx",            // Customer ID
    status: "active" | "past_due" | "canceled" | "expired",
    currentPeriodEnd: "2026-02-03T...",
    priceId: "price_xxx",
    updatedAt: "2026-01-03T...",
    
    // Se cancelado:
    canceledAt: "2026-01-03T...",
    
    // Se expirado:
    expiredAt: "2026-01-03T...",
    expiredReason: "unpaid" | "subscription_deleted_expired"
  },
  
  // Customer ID no nível do documento (para fácil consulta)
  stripeCustomerId: "cus_xxx",
  
  // Timestamps
  createdAt: "2025-12-01T...",
  updatedAt: "2026-01-03T...",
  
  // Contadores mensais (gerenciados por userPlans.js)
  messagesMonth: 0,
  analysesMonth: 0,
  billingMonth: "2026-01"
}
```

---

## 🧪 COMO TESTAR

### 1. Configurar Stripe CLI (local)

```bash
# Instalar Stripe CLI
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe

# Login
stripe login

# Encaminhar webhooks para localhost
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

### 2. Iniciar Servidor Local

```bash
npm run dev
# ou
node server.js
```

### 3. Testar Checkout

1. Acesse `http://localhost:3000/planos.html`
2. Faça login com Firebase
3. Clique em "Assinar Plus" ou "Começar no Pro"
4. Use cartão de teste: `4242 4242 4242 4242` (qualquer data futura, qualquer CVC)
5. Complete o checkout

### 4. Verificar Webhook

O Stripe CLI mostrará os eventos recebidos:
```
2026-01-03 12:00:00   --> checkout.session.completed [evt_xxx]
2026-01-03 12:00:00  <--  [200] POST /api/webhook/stripe
```

### 5. Verificar Firestore

No Firebase Console, verifique:
- `usuarios/{uid}` → campo `plan` deve ser "plus" ou "pro"
- `usuarios/{uid}` → campo `subscription.status` deve ser "active"
- `processed_stripe_events/{evt_xxx}` → evento registrado (idempotência)

### 6. Simular Eventos

```bash
# Simular falha de pagamento
stripe trigger invoice.payment_failed

# Simular cancelamento
stripe trigger customer.subscription.deleted

# Simular renovação
stripe trigger invoice.payment_succeeded
```

---

## 🛡️ SEGURANÇA IMPLEMENTADA

| Verificação | Local |
|-------------|-------|
| ✅ Token Firebase validado | `create-checkout-session.js` |
| ✅ Assinatura HMAC do webhook | `webhook/stripe.js` |
| ✅ Idempotência de eventos | `idempotency.js` + Firestore |
| ✅ client_reference_id como fallback | `create-checkout-session.js` |
| ✅ Metadata em session + subscription | `create-checkout-session.js` |
| ✅ Não libera por querystring | `success.html` apenas mostra status |

---

## ⚠️ PONTOS DE ATENÇÃO

### 1. **Ambiente TEST vs LIVE**
- Certifique-se de que `STRIPE_SECRET_KEY` e os Price IDs são do **mesmo ambiente**
- Test: `sk_test_...`, `price_test_...`
- Live: `sk_live_...`, `price_live_...`

### 2. **Webhook em Produção**
- Configure o webhook no Dashboard do Stripe para apontar para sua URL de produção
- Use o signing secret específico desse endpoint

### 3. **Railway/Vercel**
- O webhook usa `express.raw()` que já está configurado no `server.js`
- Se usar Vercel Serverless, adapte para API Routes (não necessário se usando Express)

### 4. **Grace Period**
- `past_due` mantém acesso (grace period do Stripe)
- `unpaid` rebaixa para free
- Configure políticas de retry no Dashboard do Stripe

---

## 📊 FLUXO VISUAL

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│    Stripe    │
│ planos.html  │     │ create-sess  │     │   Checkout   │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                  ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Firestore   │◀────│   Webhook    │◀────│   Eventos    │
│  usuarios/   │     │  /stripe.js  │     │ Stripe API   │
└──────────────┘     └──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐
│ success.html │
│ (read-only)  │
└──────────────┘
```

---

## ✅ CHECKLIST FINAL

- [x] Price IDs corretos (Plus + Pro)
- [x] Checkout session com metadata (uid, plan)
- [x] client_reference_id como fallback
- [x] Webhook valida assinatura HMAC
- [x] Idempotência implementada
- [x] 6 eventos tratados
- [x] applySubscription salva customerId
- [x] downgradeToFree para inadimplência
- [x] cancelSubscription mantém até fim do período
- [x] success.html não libera plano
- [x] success.html escuta Firestore em tempo real
- [x] .env.example atualizado

---

**Implementação completa. O sistema está pronto para produção após configurar as variáveis de ambiente.**
