# 🎬 CHANGELOG: HOTMART CURSO → PLANO STUDIO

**Data:** 2026-01-06  
**Versão:** 1.1.0  
**Tipo:** Alteração de Produto  

---

## 📋 RESUMO DA MUDANÇA

**ANTES:** Compra do Curso Hotmart concedia plano **PRO** (120 dias)  
**AGORA:** Compra do Curso Hotmart concede plano **STUDIO** (120 dias)

**Motivo:** Atualização do produto comercializado pela Hotmart.

---

## ✅ ARQUIVOS ALTERADOS

### 1. [api/webhook/hotmart.js](api/webhook/hotmart.js)

**Mudanças:**
- ✅ Header: "Combo Curso + PRO" → "Combo Curso + STUDIO"
- ✅ Constante: `PRO_DURATION_DAYS` → `STUDIO_DURATION_DAYS`
- ✅ Plano aplicado: `plan: 'pro'` → `plan: 'studio'`
- ✅ Campo de expiração: `proExpiresAt` → `studioExpiresAt`
- ✅ Logs: "Ativando PRO" → "Ativando STUDIO"
- ✅ Registro de transação: `planApplied: 'pro'` → `planApplied: 'studio'`

**Diff crítico:**
```javascript
// ANTES:
const PRO_DURATION_DAYS = 120;
const updatedUser = await applyPlan(user.uid, {
  plan: 'pro',
  durationDays: PRO_DURATION_DAYS
});

// AGORA:
const STUDIO_DURATION_DAYS = 120;
const updatedUser = await applyPlan(user.uid, {
  plan: 'studio',
  durationDays: STUDIO_DURATION_DAYS
});
```

---

### 2. [work/lib/user/userPlans.js](work/lib/user/userPlans.js)

**Mudanças:**
- ✅ Adicionada verificação de expiração para `studioExpiresAt`
- ✅ Adicionado campo `studioExpiresAt` na normalização do usuário
- ✅ Adicionado suporte completo ao plano `studio` na função `applyPlan()`
- ✅ Limpeza de `studioExpiresAt` ao ativar outros planos (plus/pro/dj)
- ✅ Atualizado JSDoc da função `applyPlan` para incluir 'studio'

**Diff crítico:**
```javascript
// ADICIONADO: Verificação de expiração STUDIO
if (user.studioExpiresAt && Date.now() > new Date(user.studioExpiresAt).getTime() && user.plan === "studio") {
  console.log(`🎬 [USER-PLANS] Plano Studio expirado para: ${uid}`);
  user.plan = "free";
  changed = true;
}

// ADICIONADO: Suporte a ativação do plano STUDIO
if (plan === "studio") {
  update.studioExpiresAt = expires;
  update.plusExpiresAt = null;
  update.proExpiresAt = null;
  update.djExpiresAt = null;
}
```

---

## 🔄 COMPATIBILIDADE E REGRAS

### ✅ Prioridade de planos (mantida)

1. **Studio** > Pro > Plus > Free
2. Ao ativar STUDIO:
   - Limpa `plusExpiresAt`
   - Limpa `proExpiresAt`
   - Limpa `djExpiresAt`
3. Não rebaixa usuário de STUDIO para PRO/PLUS

### ✅ Idempotência (mantida)

- Transação Hotmart processada apenas UMA vez
- Collection: `hotmart_transactions`
- Campo: `transactionId`

### ✅ Limites do plano STUDIO

Conforme [work/lib/user/userPlans.js](work/lib/user/userPlans.js#L44-L56):

```javascript
studio: {
  maxMessagesPerMonth: Infinity,        // Ilimitado visualmente
  maxFullAnalysesPerMonth: Infinity,    // Ilimitado visualmente
  maxImagesPerMonth: 150,               
  hardCapMessagesPerMonth: 400,         // Hard cap técnico
  hardCapAnalysesPerMonth: 400,         // Hard cap técnico
  allowReducedAfterLimit: false,        // Bloqueia após hard cap
  priorityQueue: true,                  // Prioridade de processamento
}
```

---

## 🧪 TESTES OBRIGATÓRIOS

### A) Webhook Hotmart - Novo usuário
```bash
curl -X POST http://localhost:3000/api/webhook/hotmart \
  -H "Content-Type: application/json" \
  -H "X-Hotmart-Hottok: SEU_TOKEN" \
  -d '{
    "event": "PURCHASE_APPROVED",
    "data": {
      "buyer": {
        "email": "teste@exemplo.com",
        "name": "Teste Usuario"
      },
      "purchase": {
        "transaction": "TEST_123",
        "status": "APPROVED"
      }
    }
  }'
```

**Resultado esperado:**
1. ✅ Usuário criado no Firebase Auth
2. ✅ Documento criado em `usuarios` com:
   - `plan: 'studio'`
   - `studioExpiresAt: [data + 120 dias]`
3. ✅ Transação registrada em `hotmart_transactions`
4. ✅ E-mail de onboarding enviado

### B) Webhook Hotmart - Usuário existente (PRO)
**Cenário:** Usuário com PRO ativo compra curso  
**Resultado esperado:**
- ✅ `plan` muda de 'pro' para 'studio'
- ✅ `studioExpiresAt` definido (+120 dias)
- ✅ `proExpiresAt` limpo (null)
- ✅ Não cria duplicação

### C) Idempotência
**Cenário:** Mesmo webhook enviado 2x  
**Resultado esperado:**
- ✅ 1ª chamada: processa normalmente
- ✅ 2ª chamada: logado como "já processada", não altera dados

### D) Verificar no Firestore
```javascript
// Buscar documento do usuário
db.collection('usuarios').doc(uid).get()

// Campos esperados após compra:
{
  plan: 'studio',
  studioExpiresAt: '2026-05-06T...',
  proExpiresAt: null,
  plusExpiresAt: null,
  analysesMonth: 0,
  messagesMonth: 0,
  // ...
}
```

---

## 🚨 PONTOS DE ATENÇÃO

### ✅ Não afetado (mantido como está)

1. **Plano PRO mensal via Mercado Pago/Stripe** → continua concedendo PRO
2. **Plano PLUS** → não alterado
3. **DJ Beta** → não alterado
4. **Sistema de limites** → não alterado
5. **Sistema de capabilities** → já suporta STUDIO (implementado anteriormente)

### ⚠️ E-mails genéricos

O arquivo [lib/email/onboarding-email.js](lib/email/onboarding-email.js) é genérico e usado por vários webhooks (Hotmart, Mercado Pago, etc). As referências a "PRO" no e-mail foram mantidas como estão porque:
- O e-mail não sabe qual plano foi concedido (recebe apenas `expiresAt`)
- Alterar para "STUDIO" quebraria e-mails de outros webhooks que concedem PRO
- Solução futura: passar `planName` como parâmetro no e-mail

---

## 📊 IMPACTO

| Componente | Impacto | Status |
|------------|---------|--------|
| Webhook Hotmart | ✅ Alterado | OK |
| Função `applyPlan` | ✅ Estendida | OK |
| Sistema de expiração | ✅ Estendido | OK |
| Normalização de usuário | ✅ Estendida | OK |
| Limites do plano | ✅ Já existente | OK |
| Capabilities front-end | ✅ Já existente | OK |
| E-mails | ⚠️ Genérico | Manter |
| Outros webhooks | ✅ Não afetado | OK |

---

## 🔍 COMMITS RELACIONADOS

- `feat(hotmart): trocar plano PRO → STUDIO no curso (120 dias)`
- `feat(userPlans): adicionar suporte completo ao plano STUDIO`
- `docs: atualizar changelog HOTMART STUDIO 2026-01-06`

---

## 👤 RESPONSÁVEL

**Implementação:** GitHub Copilot  
**Aprovação:** Equipe SoundyAI  
**Data:** 2026-01-06
