# 🔍 AUDITORIA COMPLETA: INTEGRAÇÃO MERCADO PAGO
**Data:** 14/12/2025  
**Auditor:** Backend Engineering SoundyAI  
**Objetivo:** Avaliar viabilidade da integração Mercado Pago  
**Status:** ⚠️ AUDITORIA CRÍTICA COMPLETA

---

## 📋 RESUMO EXECUTIVO

**Veredicto:** 🔴 **INTEGRAÇÃO INCOMPLETA E INSEGURA**

A integração atual do Mercado Pago **NÃO está pronta para produção** e apresenta **falhas críticas de segurança e arquitetura**. Existem **múltiplas versões do código** em locais diferentes, com **lógica duplicada** e **inconsistências graves**.

---

## 1️⃣ MAPEAMENTO COMPLETO (O QUE EXISTE)

### Arquivos Encontrados

| Arquivo | Localização | Status | Linhas |
|---------|-------------|--------|--------|
| `mercadopago.js` | `api/mercadopago.js` | 🟡 DUPLICADO | 86 |
| `mercadopago.js` | `work/api/mercadopago.js` | 🟡 DUPLICADO | 86 |
| `create-preference.js` | `api/create-preference.js` | 🟡 DUPLICADO | 61 |
| `create-preference.js` | `work/api/create-preference.js` | 🟡 DUPLICADO | 61 |
| `webhook.js` | `work/api/webhook.js` | ❌ GENÉRICO | 37 |
| `mercadopago.js` | `api/webhook/mercadopago.js` | ✅ ESTRUTURADO | 165 |

**Problema:** Existem **TRÊS LOCAIS** com código relacionado a Mercado Pago, todos com lógica diferente.

---

### SDK e Dependências

```json
// package.json
{
  "mercadopago": "^2.8.0"  // ✅ Instalado
}
```

**Status:** SDK instalado corretamente.

---

### Variáveis de Ambiente

**Esperadas na documentação:**
```bash
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxx
```

**Usadas no código:**
```javascript
// api/mercadopago.js + work/api/mercadopago.js
process.env.MP_ACCESS_TOKEN  // ❌ INCONSISTENTE

// api/webhook/mercadopago.js
process.env.MERCADOPAGO_ACCESS_TOKEN  // ❌ INCONSISTENTE
```

**🚨 ERRO CRÍTICO 1:** Variáveis de ambiente com **nomes diferentes** entre arquivos.

---

### Rotas Configuradas (server-old.js)

```javascript
// Linha 55
import mercadopagoRoute from "./api/mercadopago.js";

// Linha 67
app.use("/api/mercadopago", mercadopagoRoute);

// Linha 60
app.use("/api/webhook", webhookRoute);
```

**Rotas disponíveis:**
- `POST /api/mercadopago/create-preference` → Criar preferência
- `POST /api/mercadopago/webhook` → Receber notificações
- `POST /api/webhook` → Webhook genérico (conflito)

**🚨 ERRO CRÍTICO 2:** Duas rotas de webhook diferentes.

---

## 2️⃣ VALIDAÇÃO DE ARQUITETURA (CRÍTICO)

### Checklist de Segurança

| Princípio | Status | Localização | Gravidade |
|-----------|--------|-------------|-----------|
| ❌ Frontend NÃO ativa plano | **VIOLADO** | `api/mercadopago.js:70-88` | 🔴 CRÍTICA |
| ❌ Frontend NÃO escreve `plan` | **VIOLADO** | `api/mercadopago.js:75-81` | 🔴 CRÍTICA |
| ✅ Webhook ativa plano | **PARCIAL** | `api/webhook/mercadopago.js` existe | 🟡 MÉDIO |
| ❌ `applyPlan()` usado no webhook | **NÃO USADO** | Webhook escreve diretamente | 🔴 CRÍTICA |
| ❌ Idempotência existe | **NÃO EXISTE** | Nenhum arquivo | 🔴 CRÍTICA |
| ❌ Validação de status | **INCOMPLETA** | Apenas `approved` | 🟡 MÉDIO |
| ❌ Validação de assinatura | **NÃO EXISTE** | Nenhum arquivo | 🔴 CRÍTICA |
| ❌ NÃO confiar em redirect | **VIOLADO** | Redirect usado | 🔴 CRÍTICA |

---

### ERRO CRÍTICO 3: Webhook Inseguro

**Arquivo:** `api/mercadopago.js` (linhas 70-88)

```javascript
router.post("/webhook", async (req, res) => {
  const { type, data } = req.body;
  if (type === "payment") {
    const payment = data;
    const uid = payment.external_reference;
    if (payment.status === "approved") {
      // 🚨 PROBLEMA: Escreve diretamente no Firestore
      await db.collection("usuarios").doc(uid).set(
        {
          isPlus: true,        // ❌ Campo legado
          plano: "plus",       // ❌ Sobrescreve sem validação
          upgradedAt: new Date(),
        },
        { merge: true }
      );
    }
  }
  return res.sendStatus(200);
});
```

**Problemas identificados:**

1. ❌ **SEM validação de assinatura** → Qualquer POST pode ativar plano
2. ❌ **SEM idempotência** → Múltiplos webhooks ativam múltiplas vezes
3. ❌ **NÃO usa `applyPlan()`** → Ignora sistema oficial
4. ❌ **Usa campos legados** → `isPlus` em vez de `plan`
5. ❌ **Escreve diretamente `plan`** → Backend viola princípio
6. ❌ **NÃO valida se pagamento é real** → Aceita qualquer JSON

---

### ERRO CRÍTICO 4: Webhook Duplicado

**Arquivo:** `work/api/webhook.js` (linhas 12-33)

```javascript
router.post("/", async (req, res) => {
  const { type, data } = req.body;

  if (type === "payment" && data.status === "approved") {
    const uid = data.external_reference;
    await getDb()
      .collection("usuarios")
      .doc(uid)
      .set(
        {
          isPlus: true,
          plano: "plus",
          upgradedAt: new Date(),
        },
        { merge: true }
      );
  }

  return res.sendStatus(200);
});
```

**Problema:** Mesma lógica insegura, mas em arquivo diferente.

**🚨 ERRO CRÍTICO 5:** Dois webhooks com lógica duplicada e insegura.

---

### ERRO CRÍTICO 6: Webhook "Correto" Não Usado

**Arquivo:** `api/webhook/mercadopago.js` (linhas 75-150)

```javascript
router.post('/mercadopago', async (req, res) => {
  console.log('🔔 [WEBHOOK] Notificação recebida do Mercado Pago');

  try {
    const { type, data } = req.body;

    if (type !== 'payment') {
      return res.status(200).send('OK');
    }

    const paymentId = data?.id;
    
    // ✅ CORRETO: Busca detalhes do pagamento na API
    const paymentData = await getPaymentDetails(paymentId);
    
    if (paymentData.status !== 'approved') {
      return res.status(200).send('OK');
    }

    const uid = paymentData.external_reference;
    const planConfig = determinePlan(paymentData);
    
    // ✅ CORRETO: Usa applyPlan()
    await applyPlan(uid, planConfig);

    return res.status(200).json({ success: true });

  } catch (error) {
    // ✅ CORRETO: Retorna 200 mesmo em erro
    return res.status(200).json({ success: false });
  }
});
```

**Este arquivo está MELHOR**, mas:
- ❌ **Não está registrado no servidor**
- ❌ **Não tem validação de assinatura HMAC**
- ❌ **Não tem idempotência**
- ✅ Usa `applyPlan()` corretamente
- ✅ Busca detalhes na API do Mercado Pago

---

## 3️⃣ SIMULAÇÃO DE FLUXO REAL

### Fluxo Atual (INSEGURO)

```
1. Usuário clica em "Assinar Plus"
   ↓
2. Frontend chama POST /api/mercadopago/create-preference
   ↓
3. Backend cria preferência no Mercado Pago
   ↓
4. Frontend recebe init_point (URL de pagamento)
   ↓
5. Usuário é redirecionado para Mercado Pago
   ↓
6. Usuário paga no Mercado Pago
   ↓
7. Mercado Pago envia webhook para:
   → POST /api/mercadopago/webhook OU
   → POST /api/webhook
   ↓
8. Backend recebe webhook e:
   ❌ NÃO valida assinatura
   ❌ NÃO verifica se pagamento é real
   ❌ ESCREVE diretamente no Firestore
   ❌ NÃO usa applyPlan()
   ↓
9. Plano ativado (inseguro)
```

---

### O Que Impede Fraude?

**NADA.**

Qualquer pessoa pode:
1. Fazer um POST para `/api/mercadopago/webhook`
2. Enviar JSON:
   ```json
   {
     "type": "payment",
     "data": {
       "status": "approved",
       "external_reference": "UID_DA_VITIMA"
     }
   }
   ```
3. **Plano ativado gratuitamente** ❌

**🚨 VULNERABILIDADE CRÍTICA:** Sistema aceita webhooks sem validação.

---

## 4️⃣ DECISÃO TÉCNICA

### Análise de Reaproveitamento

| Componente | Reaproveitável? | Estado |
|------------|-----------------|--------|
| SDK Mercado Pago | ✅ SIM | Já instalado |
| `create-preference` | ⚠️ PARCIAL | Precisa ajustes |
| Webhook atual | ❌ NÃO | Completamente inseguro |
| `api/webhook/mercadopago.js` | ⚠️ PARCIAL | Base boa, falta segurança |
| Variáveis de ambiente | ❌ NÃO | Inconsistentes |
| Rotas do servidor | ⚠️ PARCIAL | Duplicadas |

---

### Esforço para Corrigir Mercado Pago

| Tarefa | Esforço | Risco |
|--------|---------|-------|
| Unificar código duplicado | MÉDIO | BAIXO |
| Implementar validação de assinatura | ALTO | MÉDIO |
| Implementar idempotência | MÉDIO | BAIXO |
| Testar em sandbox | ALTO | MÉDIO |
| Corrigir variáveis de ambiente | BAIXO | BAIXO |
| Limpar código legado | MÉDIO | MÉDIO |

**Total:** ALTO ESFORÇO

---

### Alternativa: Stripe

| Aspecto | Mercado Pago (atual) | Stripe |
|---------|----------------------|--------|
| Código existente | Inseguro e duplicado | Zero (começar limpo) |
| Validação de webhook | Difícil (HMAC manual) | Nativa (SDK) |
| Idempotência | Manual | Nativa (Idempotency-Key) |
| Documentação | Regular | Excelente |
| Sandbox | Complicado | Simples |
| Suporte | Médio | Excelente |
| SDK Node.js | Desatualizado | Moderno |
| Integração com Firebase | Manual | Extensão oficial |

---

### Recomendação Final

🔴 **DESCARTAR MERCADO PAGO E MIGRAR PARA STRIPE**

**Motivos:**

1. ✅ **Código atual está completamente comprometido**
   - Múltiplas versões duplicadas
   - Webhooks inseguros
   - Não usa `applyPlan()`

2. ✅ **Stripe é mais seguro por padrão**
   - Validação de webhook nativa
   - Idempotência nativa
   - SDK moderno e bem mantido

3. ✅ **Menos trabalho total**
   - Começar do zero com Stripe: ~2-3 dias
   - Corrigir Mercado Pago: ~4-5 dias + riscos

4. ✅ **Mercado internacional**
   - Stripe funciona globalmente
   - Mercado Pago é regional

5. ✅ **Documentação e comunidade**
   - Stripe tem exemplos prontos
   - Firebase tem extensão oficial para Stripe

---

## 5️⃣ CHECKLIST DO QUE FALTA (SE INSISTIR EM MERCADO PAGO)

### Webhook Seguro

- [ ] **Validação de assinatura HMAC**
  - Mercado Pago envia `x-signature` e `x-request-id`
  - Calcular HMAC com secret
  - Validar antes de processar

- [ ] **Buscar detalhes na API**
  - Usar `payment.id` para buscar em `GET /v1/payments/{id}`
  - Não confiar apenas no webhook body

- [ ] **Idempotência**
  - Criar tabela `processed_payments` no PostgreSQL
  - Armazenar `payment_id` processados
  - Verificar antes de aplicar plano

- [ ] **Usar `applyPlan()`**
  - Remover código que escreve diretamente no Firestore
  - Chamar `applyPlan(uid, { plan, durationDays })`

- [ ] **Mapeamento de status**
  - `approved` → Ativar plano
  - `rejected` → Log de falha
  - `pending` → Aguardar
  - `cancelled` → Não ativar

---

### Segurança Mínima

- [ ] **Rate limiting no webhook**
  - Aplicar `webhookLimiter` (já existe)

- [ ] **Logs obrigatórios**
  - Toda tentativa de ativação
  - Toda validação de assinatura
  - Toda busca na API do Mercado Pago

- [ ] **Tratamento de erro**
  - SEMPRE retornar 200 (evitar reenvios)
  - Logar erro mas não bloquear

---

### Variáveis de Ambiente

- [ ] **Unificar nomes**
  - Decidir: `MP_ACCESS_TOKEN` OU `MERCADOPAGO_ACCESS_TOKEN`
  - Atualizar TODOS os arquivos

- [ ] **Adicionar secret**
  - `MP_WEBHOOK_SECRET` para HMAC

- [ ] **Configurar em produção**
  - Railway/Vercel precisa das variáveis

---

### Testes Obrigatórios

- [ ] **Sandbox Mercado Pago**
  - Criar conta de teste
  - Gerar tokens de teste
  - Simular pagamentos

- [ ] **Teste de webhook**
  - Usar Mercado Pago Webhook Simulator
  - Validar assinatura
  - Validar idempotência

- [ ] **Teste de fraude**
  - Tentar POST direto sem assinatura
  - Verificar se bloqueia

---

### Limpeza de Código

- [ ] **Remover duplicatas**
  - Escolher UMA versão
  - Deletar as outras

- [ ] **Remover código legado**
  - `isPlus` → usar apenas `plan`
  - Atualizar frontend

- [ ] **Unificar rotas**
  - Decidir: `/api/mercadopago/webhook` OU `/api/webhook/mercadopago`
  - Remover a outra

---

## 6️⃣ OUTPUT FINAL

### ⚠️ STATUS MERCADO PAGO

- **Pronto para produção?** 🔴 **NÃO**
- **Risco técnico:** 🔴 **ALTO**
- **Recomendação:** 🔴 **DESCARTAR**
- **Esforço restante estimado:** 🔴 **ALTO** (4-5 dias)

---

### ✅ RECOMENDAÇÃO: STRIPE

- **Pronto para produção?** 🟡 **NÃO (ainda não implementado)**
- **Risco técnico:** 🟢 **BAIXO**
- **Recomendação:** ✅ **IMPLEMENTAR**
- **Esforço estimado:** 🟢 **MÉDIO** (2-3 dias)

---

### 📊 Comparação de Esforço

| Tarefa | Mercado Pago | Stripe |
|--------|--------------|--------|
| Limpar código existente | 1 dia | 0 (começar limpo) |
| Implementar webhook seguro | 2 dias | 1 dia (SDK facilita) |
| Implementar validação | 1 dia | 0.5 dia (nativo) |
| Testes em sandbox | 0.5 dia | 0.5 dia |
| Deploy e validação | 0.5 dia | 0.5 dia |
| **TOTAL** | **5 dias** | **2.5 dias** |

---

### 🎯 Decisão Final

**DESCARTAR MERCADO PAGO**

**Motivos técnicos objetivos:**

1. ❌ Código atual está comprometido (inseguro)
2. ❌ Múltiplas versões duplicadas
3. ❌ Mais trabalho corrigir do que começar do zero
4. ✅ Stripe é mais seguro por padrão
5. ✅ Stripe tem melhor suporte e documentação
6. ✅ Stripe escala globalmente

**Próximo passo:** Implementar Stripe do zero com arquitetura correta desde o início.

---

**Auditoria realizada em:** 14/12/2025  
**Auditor:** Backend Engineering SoundyAI  
**Status:** ✅ AUDITORIA COMPLETA  
**Decisão:** 🔴 **DESCARTAR MERCADO PAGO → IMPLEMENTAR STRIPE**
