# 🚀 Integração Stripe - Guia Rápido

## ✅ Status da Implementação

**Código:** ✅ COMPLETO  
**Testes:** ⚠️ PENDENTE  
**Deploy:** ⚠️ PENDENTE

---

## 📋 Pré-requisitos

1. Conta no Stripe (https://stripe.com)
2. Node.js 20.x instalado
3. Firebase configurado
4. Redis configurado

---

## 🔧 Configuração

### 1. Instalar Dependência Stripe

```bash
npm install stripe
```

### 2. Criar Produtos no Stripe Dashboard

1. Acesse: https://dashboard.stripe.com/test/products
2. Clique em **"+ New"**
3. Criar produto **"SoundyAI Plus"**:
   - Nome: SoundyAI Plus
   - Descrição: 80 mensagens + 25 análises mensais
   - Preço: [definir valor]
   - Tipo: One-time payment
   - Copiar **Price ID** (ex: `price_1xxxxx`)
4. Criar produto **"SoundyAI Pro"**:
   - Nome: SoundyAI Pro
   - Descrição: 300 mensagens + 500 análises mensais
   - Preço: [definir valor]
   - Tipo: One-time payment
   - Copiar **Price ID** (ex: `price_1yyyyy`)

### 3. Configurar Webhook no Stripe

1. Acesse: https://dashboard.stripe.com/test/webhooks
2. Clique em **"+ Add endpoint"**
3. URL: `https://seu-dominio.com/api/webhook/stripe`
4. Eventos: Selecionar **`checkout.session.completed`**
5. Copiar **Signing secret** (ex: `whsec_xxxxx`)

### 4. Configurar Variáveis de Ambiente

Adicionar ao `.env`:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_51xxxxx...
STRIPE_WEBHOOK_SECRET=whsec_xxxxx...
STRIPE_PRICE_ID_PLUS=price_1xxxxx
STRIPE_PRICE_ID_PRO=price_1yyyyy
STRIPE_SUCCESS_URL=https://seu-dominio.com/success?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://seu-dominio.com/cancel
```

---

## 🧪 Testes Locais

### 1. Instalar Stripe CLI

```bash
# Windows (via Scoop)
scoop install stripe

# MacOS
brew install stripe/stripe-cli/stripe

# Ou baixar de: https://github.com/stripe/stripe-cli/releases
```

### 2. Login no Stripe

```bash
stripe login
```

### 3. Iniciar Webhook Local

```bash
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

**Output esperado:**
```
> Ready! Your webhook signing secret is whsec_xxxxx (^C to quit)
```

Copiar o `whsec_xxxxx` e adicionar ao `.env` local.

### 4. Iniciar Servidor

```bash
npm start
```

**Output esperado:**
```
✅ [STRIPE CONFIG] SDK inicializado
✅ [STRIPE IDEMPOTENCY] Módulo carregado - Collection: processed_stripe_events
🚀 [API] SoundyAI API rodando na porta 3000
📍 [API] Endpoints: /api/stripe/*, /api/webhook/*, ...
```

### 5. Testar Checkout (Frontend)

```javascript
// Frontend: Solicitar checkout
const response = await fetch('/api/stripe/create-checkout-session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${firebaseToken}`,
  },
  body: JSON.stringify({ plan: 'plus' }),
});

const { sessionId, url } = await response.json();

// Redirecionar usuário para Stripe
window.location.href = url;
```

### 6. Usar Cartão de Teste

No Stripe Checkout, usar:
- **Cartão:** `4242 4242 4242 4242`
- **Validade:** Qualquer data futura (ex: 12/25)
- **CVC:** Qualquer 3 dígitos (ex: 123)
- **CEP:** Qualquer (ex: 12345)

### 7. Verificar Webhook

No terminal do `stripe listen`, você deve ver:

```
2025-12-14 12:34:56   --> checkout.session.completed [evt_xxxxx]
2025-12-14 12:34:56  <--  [200] POST http://localhost:3000/api/webhook/stripe [evt_xxxxx]
```

No terminal do servidor:

```
📨 [STRIPE WEBHOOK] Webhook recebido
🔐 [STRIPE WEBHOOK] Assinatura validada: checkout.session.completed | ID: evt_xxxxx
📋 [STRIPE WEBHOOK] Metadata: UID=firebase_uid | Plan=plus | Duration=30 dias
💎 [STRIPE WEBHOOK] Ativando plano: firebase_uid → plus (30 dias)
✅ [STRIPE WEBHOOK] Plano ativado com sucesso: firebase_uid → plus
✅ [STRIPE WEBHOOK] Evento processado com sucesso: evt_xxxxx
```

### 8. Verificar Firestore

```javascript
// Collection: usuarios
// Doc ID: firebase_uid
{
  plan: "plus",
  plusExpiresAt: "2025-01-13T12:34:56.000Z",
  proExpiresAt: null,
  updatedAt: "2025-12-14T12:34:56.000Z",
}

// Collection: processed_stripe_events
// Doc ID: evt_xxxxx
{
  eventId: "evt_xxxxx",
  processedAt: Timestamp,
  uid: "firebase_uid",
  plan: "plus",
  sessionId: "cs_xxxxx",
  status: "success",
}
```

---

## 🚀 Deploy em Produção

### 1. Criar Produtos no Stripe (Live Mode)

1. Alternar para **Live mode** no Stripe Dashboard
2. Criar produtos idênticos (Plus e Pro)
3. Copiar **Price IDs de produção** (começam com `price_`)

### 2. Configurar Webhook (Live Mode)

1. Dashboard → Webhooks → Add endpoint
2. URL: `https://soundy.ai/api/webhook/stripe`
3. Evento: `checkout.session.completed`
4. Copiar **Signing secret de produção**

### 3. Atualizar Variáveis de Ambiente (Produção)

No Railway/Vercel:

```bash
STRIPE_SECRET_KEY=sk_live_51xxxxx...
STRIPE_WEBHOOK_SECRET=whsec_live_xxxxx...
STRIPE_PRICE_ID_PLUS=price_live_xxxxx
STRIPE_PRICE_ID_PRO=price_live_yyyyy
STRIPE_SUCCESS_URL=https://soundy.ai/success?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://soundy.ai/cancel
```

### 4. Deploy

```bash
git add .
git commit -m "feat: integração Stripe segura e completa"
git push origin main
```

### 5. Testar em Produção

1. Fazer pagamento real com valor mínimo (ex: R$ 1,00)
2. Verificar webhook recebido
3. Verificar plano ativado no Firestore
4. Reembolsar pagamento de teste no Stripe Dashboard

---

## 🔍 Monitoramento

### Logs Importantes

**Sucesso:**
```
✅ [STRIPE] Checkout Session criada: cs_xxxxx | UID: xxx | Plano: plus
🔐 [STRIPE WEBHOOK] Assinatura validada: checkout.session.completed
💎 [STRIPE WEBHOOK] Ativando plano: xxx → plus (30 dias)
✅ [STRIPE WEBHOOK] Plano ativado com sucesso
```

**Erro (idempotência):**
```
⏭️ [STRIPE WEBHOOK] Evento já processado: evt_xxxxx
```

**Erro (assinatura inválida):**
```
❌ [STRIPE WEBHOOK] Assinatura inválida: Webhook signature verification failed
```

**Erro (metadata incompleta):**
```
❌ [STRIPE WEBHOOK] Metadata incompleta: { uid: undefined }
```

### Stripe Dashboard

Monitorar em: https://dashboard.stripe.com/webhooks

- **Success rate:** Deve ser ~100%
- **Failed deliveries:** Investigar logs se > 0
- **Average response time:** Deve ser < 1s

---

## 📚 API Reference

### POST /api/stripe/create-checkout-session

**Headers:**
```
Authorization: Bearer <firebase_token>
Content-Type: application/json
```

**Body:**
```json
{
  "plan": "plus" | "pro"
}
```

**Response (200):**
```json
{
  "sessionId": "cs_test_xxxxx",
  "url": "https://checkout.stripe.com/c/pay/cs_test_xxxxx"
}
```

**Errors:**
- `401`: Token inválido
- `400`: Plano inválido
- `500`: Erro ao criar checkout

---

### POST /api/webhook/stripe

**Headers:**
```
stripe-signature: t=xxx,v1=yyy
Content-Type: application/json
```

**Body:** (enviado pelo Stripe)

**Response (200):**
```json
{
  "received": true
}
```

**Errors:**
- `400`: Assinatura inválida

---

## ❓ FAQ

**Q: Frontend pode ativar plano diretamente?**  
A: ❌ NÃO. Apenas webhook Stripe ativa via `applyPlan()`.

**Q: Webhook pode duplicar ativação?**  
A: ❌ NÃO. Sistema de idempotência previne duplicação.

**Q: Stripe envia webhook mesmo se navegador fechar?**  
A: ✅ SIM. Webhook é servidor → servidor (independente do frontend).

**Q: Como testar sem cartão real?**  
A: Use `4242 4242 4242 4242` (modo test).

**Q: Como cancelar assinatura?**  
A: Sistema atual é pagamento único (não recorrente). Plano expira automaticamente após 30 dias.

---

## 🆘 Suporte

- **Documentação completa:** `docs/STRIPE_INTEGRACAO_COMPLETA.md`
- **Logs de erro:** Verificar terminal do servidor
- **Stripe Dashboard:** https://dashboard.stripe.com
- **Stripe Docs:** https://stripe.com/docs/payments/checkout
