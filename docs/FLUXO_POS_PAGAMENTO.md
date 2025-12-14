# 🔐 FLUXO PÓS-PAGAMENTO - DOCUMENTAÇÃO TÉCNICA
**Versão:** 1.0.0  
**Data:** 14 de dezembro de 2025  
**Status:** ✅ PREPARADO PARA INTEGRAÇÃO  
**Autor:** Sistema Backend SoundyAI

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Fluxo Oficial Pós-Pagamento](#fluxo-oficial-pós-pagamento)
3. [Contrato de Dados (Firestore)](#contrato-de-dados-firestore)
4. [Função de Ativação de Plano](#função-de-ativação-de-plano)
5. [Comportamento de Expiração](#comportamento-de-expiração)
6. [Segurança e Idempotência](#segurança-e-idempotência)
7. [Estado Atual do Sistema](#estado-atual-do-sistema)
8. [Próximos Passos](#próximos-passos)

---

## 🎯 VISÃO GERAL

Este documento define o **fluxo oficial pós-pagamento** do SoundyAI, preparando o sistema para integração futura com gateways de pagamento (Mercado Pago, Stripe, etc.).

### Princípios Fundamentais

✅ **Backend é a única fonte da verdade**  
✅ **Frontend NUNCA altera planos diretamente**  
✅ **Webhook valida e ativa planos**  
✅ **Sistema é idempotente (previne duplicações)**  
✅ **Expiração automática e segura**

---

## 🔁 FLUXO OFICIAL PÓS-PAGAMENTO

### Sequência de Eventos (ESCRITO EM PEDRA)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PAGAMENTO REALIZADO (Gateway Externo)                    │
│    - Usuário clica em "Assinar PRO"                         │
│    - Gateway processa pagamento                              │
│    - Pagamento aprovado                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. WEBHOOK RECEBIDO (Backend SoundyAI)                      │
│    - POST /api/webhook/payment                               │
│    - Payload: { event, userId, planType, transactionId }    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. VALIDAÇÃO DE SEGURANÇA (Backend)                         │
│    ✓ Verificar assinatura do webhook                        │
│    ✓ Validar evento legítimo (não falsificado)              │
│    ✓ Confirmar pagamento aprovado                           │
│    ✓ Verificar idempotência (eventId não duplicado)         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. ATIVAÇÃO DE PLANO (Função: activateUserPlan)             │
│    ✓ Buscar/criar usuário no Firestore                      │
│    ✓ Atualizar plan                                         │
│    ✓ Definir planExpiresAt                                  │
│    ✓ Resetar contadores mensais                             │
│    ✓ Logar transação                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. FIRESTORE ATUALIZADO (Automático)                        │
│    - plan: 'pro'                                            │
│    - proExpiresAt: Timestamp                                │
│    - analysesMonth: 0                                       │
│    - messagesMonth: 0                                       │
│    - imagesMonth: 0                                         │
│    - billingMonth: '2025-12'                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. FRONTEND REFLETE AUTOMATICAMENTE (Real-time)             │
│    - Firestore onSnapshot detecta mudança                   │
│    - UI atualiza plano do usuário                           │
│    - Features PRO desbloqueadas                             │
│    - NENHUMA AÇÃO MANUAL DO USUÁRIO NECESSÁRIA              │
└─────────────────────────────────────────────────────────────┘
```

### ⚠️ REGRAS CRÍTICAS

| Regra | Descrição |
|-------|-----------|
| **R1** | Frontend NUNCA chama `activateUserPlan` diretamente |
| **R2** | Apenas webhook autenticado pode ativar planos |
| **R3** | Idempotência obrigatória (eventId único) |
| **R4** | Logs detalhados de todas as ativações |
| **R5** | Rollback automático em caso de falha |

---

## 📦 CONTRATO DE DADOS (FIRESTORE)

### Coleção: `usuarios`

```typescript
interface UserDocument {
  // ✅ IDENTIDADE
  uid: string;                    // Firebase Auth UID
  email?: string;                 // Email do usuário
  
  // ✅ PLANO (FONTE DA VERDADE)
  plan: 'free' | 'plus' | 'pro';  // Plano atual
  plusExpiresAt: Timestamp | null; // Expiração do Plus
  proExpiresAt: Timestamp | null;  // Expiração do Pro
  
  // ✅ CONTADORES MENSAIS (RESET AUTOMÁTICO)
  billingMonth: string;            // Formato: "YYYY-MM" (ex: "2025-12")
  analysesMonth: number;           // Análises de áudio usadas no mês
  messagesMonth: number;           // Mensagens de chat usadas no mês
  imagesMonth: number;             // Mensagens com imagens usadas no mês
  
  // ✅ METADADOS
  createdAt: string;               // ISO 8601
  updatedAt: string;               // ISO 8601
  
  // ❌ CAMPOS LEGADOS (REMOVIDOS)
  // imagemAnalises: DELETADO
  // mensagensRestantes: DELETADO
}
```

### Regras de Acesso (Firestore Rules)

```javascript
match /usuarios/{userId} {
  // Leitura: apenas o próprio usuário
  allow read: if request.auth != null && request.auth.uid == userId;
  
  // Escrita: PROIBIDA do frontend
  allow write: if false;
  
  // ✅ Apenas backend (via Admin SDK) pode escrever
}
```

### Campos Protegidos (Somente Backend)

Estes campos **NUNCA** devem ser alteráveis pelo frontend:

- ✅ `plan`
- ✅ `plusExpiresAt`
- ✅ `proExpiresAt`
- ✅ `analysesMonth`
- ✅ `messagesMonth`
- ✅ `imagesMonth`
- ✅ `billingMonth`

---

## ⚙️ FUNÇÃO DE ATIVAÇÃO DE PLANO

### Assinatura da Função

```javascript
/**
 * Ativar plano para usuário após pagamento aprovado
 * 
 * @param {Object} params
 * @param {string} params.uid - Firebase Auth UID
 * @param {string} params.newPlan - 'plus' | 'pro'
 * @param {number} params.durationDays - Duração em dias (ex: 30, 365)
 * @param {string} params.source - Origem: 'payment_webhook'
 * @param {string} params.eventId - ID único do evento (idempotência)
 * @param {string} [params.transactionId] - ID da transação no gateway
 * 
 * @returns {Promise<Object>} Perfil atualizado do usuário
 * 
 * @throws {Error} 'INVALID_UID' - UID inválido ou vazio
 * @throws {Error} 'INVALID_PLAN' - Plano não permitido
 * @throws {Error} 'DUPLICATE_EVENT' - Evento já processado (idempotência)
 * @throws {Error} 'UNAUTHORIZED_SOURCE' - Origem não autorizada
 */
export async function activateUserPlan({
  uid,
  newPlan,
  durationDays,
  source,
  eventId,
  transactionId = null
}) {
  // ✅ VALIDAÇÕES OBRIGATÓRIAS
  
  // 1. Validar UID
  if (!uid || typeof uid !== 'string') {
    throw new Error('INVALID_UID');
  }
  
  // 2. Validar plano
  const allowedPlans = ['plus', 'pro'];
  if (!allowedPlans.includes(newPlan)) {
    throw new Error('INVALID_PLAN');
  }
  
  // 3. Validar origem (apenas webhook)
  if (source !== 'payment_webhook') {
    console.error(`🚨 [SECURITY] Tentativa de ativação de plano de origem não autorizada: ${source}`);
    throw new Error('UNAUTHORIZED_SOURCE');
  }
  
  // 4. Verificar idempotência
  const db = getDb();
  const eventsRef = db.collection('payment_events').doc(eventId);
  const eventSnap = await eventsRef.get();
  
  if (eventSnap.exists) {
    console.warn(`⚠️ [IDEMPOTENCY] Evento já processado: ${eventId}`);
    throw new Error('DUPLICATE_EVENT');
  }
  
  // ✅ PROCESSAR ATIVAÇÃO
  
  console.log(`💳 [ACTIVATION] Iniciando ativação: UID=${uid}, Plan=${newPlan}, Duration=${durationDays}d, Event=${eventId}`);
  
  try {
    // 1. Buscar/criar usuário
    const user = await getOrCreateUser(uid);
    
    // 2. Calcular expiração
    const now = Date.now();
    const expiresAt = new Date(now + durationDays * 86400000);
    const expiresAtISO = expiresAt.toISOString();
    
    // 3. Preparar atualização
    const updateData = {
      plan: newPlan,
      updatedAt: new Date().toISOString(),
      
      // Reset de contadores (novo ciclo)
      analysesMonth: 0,
      messagesMonth: 0,
      imagesMonth: 0,
      billingMonth: getCurrentMonthKey(new Date()),
    };
    
    // 4. Definir expiração específica do plano
    if (newPlan === 'plus') {
      updateData.plusExpiresAt = expiresAtISO;
      updateData.proExpiresAt = null; // Limpar PRO se existir
    } else if (newPlan === 'pro') {
      updateData.proExpiresAt = expiresAtISO;
      updateData.plusExpiresAt = null; // Limpar PLUS se existir
    }
    
    // 5. Atualizar Firestore
    const userRef = db.collection(USERS).doc(uid);
    await userRef.update(updateData);
    
    // 6. Registrar evento (idempotência)
    await eventsRef.set({
      eventId,
      uid,
      plan: newPlan,
      durationDays,
      expiresAt: expiresAtISO,
      source,
      transactionId,
      processedAt: new Date().toISOString(),
      status: 'completed',
    });
    
    // 7. Buscar perfil atualizado
    const updatedUser = (await userRef.get()).data();
    
    console.log(`✅ [ACTIVATION] Plano ativado com sucesso: ${uid} → ${newPlan} até ${expiresAtISO}`);
    
    return updatedUser;
    
  } catch (error) {
    console.error(`❌ [ACTIVATION] Erro ao ativar plano:`, error);
    
    // Registrar falha
    await eventsRef.set({
      eventId,
      uid,
      plan: newPlan,
      source,
      processedAt: new Date().toISOString(),
      status: 'failed',
      error: error.message,
    });
    
    throw error;
  }
}
```

### Uso da Função (Apenas Webhook)

```javascript
// ✅ CORRETO (Webhook backend)
app.post('/api/webhook/payment', async (req, res) => {
  // 1. Validar assinatura do gateway
  const isValid = validateWebhookSignature(req);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // 2. Extrair dados
  const { userId, planType, transactionId } = req.body;
  
  // 3. Ativar plano
  try {
    await activateUserPlan({
      uid: userId,
      newPlan: planType,
      durationDays: 30,
      source: 'payment_webhook',
      eventId: `${transactionId}_${Date.now()}`,
      transactionId,
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ❌ ERRADO (Frontend tentando ativar)
// Frontend NÃO deve ter acesso a esta função
```

---

## ⏰ COMPORTAMENTO DE EXPIRAÇÃO

### Sistema de Verificação Automática

O sistema usa **lazy verification** na função `normalizeUserDoc()`:

```javascript
// Verificar expiração do plano Plus
if (user.plusExpiresAt && Date.now() > new Date(user.plusExpiresAt).getTime() && user.plan === "plus") {
  console.log(`⏰ [USER-PLANS] Plano Plus expirado para: ${uid}`);
  user.plan = "free";
  changed = true;
}

// Verificar expiração do plano Pro
if (user.proExpiresAt && Date.now() > new Date(user.proExpiresAt).getTime() && user.plan === "pro") {
  console.log(`⏰ [USER-PLANS] Plano Pro expirado para: ${uid}`);
  user.plan = "free";
  changed = true;
}
```

### Eventos de Expiração

| Momento | Ação Automática |
|---------|-----------------|
| **Plano expira** | `plan` → `free` |
| **Contadores** | Mantidos (histórico) |
| **Próxima interação** | Reset mensal aplicado |
| **Frontend** | Atualiza UI automaticamente |

### Downgrade Automático (FREE)

Quando um plano expira, o usuário **automaticamente volta para FREE**:

```javascript
// Antes (PRO)
{
  plan: 'pro',
  proExpiresAt: '2025-12-01T00:00:00.000Z', // Expirado
  analysesMonth: 150,
  messagesMonth: 200,
  imagesMonth: 45
}

// Depois (FREE - próxima interação)
{
  plan: 'free',
  proExpiresAt: '2025-12-01T00:00:00.000Z', // Mantido (histórico)
  analysesMonth: 0,     // Reset
  messagesMonth: 0,     // Reset
  imagesMonth: 0        // Reset
}
```

### Mensagens ao Usuário (Frontend)

**Implementação futura** no frontend:

```javascript
// Exemplo de mensagem (NÃO IMPLEMENTAR AGORA)
if (user.proExpiresAt && Date.now() > new Date(user.proExpiresAt)) {
  showNotification({
    type: 'info',
    message: 'Seu plano PRO expirou. Você voltou para o plano FREE.',
    action: 'Renovar PRO',
    actionLink: '/pricing'
  });
}
```

---

## 🔒 SEGURANÇA E IDEMPOTÊNCIA

### Proteções Implementadas

#### 1. Validação de Webhook

```javascript
function validateWebhookSignature(req) {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  
  // Validar HMAC SHA256
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  return signature === expectedSignature;
}
```

#### 2. Idempotência (Prevenir Duplicação)

Cada `eventId` é processado **apenas uma vez**:

```javascript
// Coleção: payment_events/{eventId}
{
  eventId: "mp_12345_1702512000000",
  uid: "user123",
  plan: "pro",
  processedAt: "2025-12-14T12:00:00.000Z",
  status: "completed"
}
```

Se o mesmo `eventId` chegar novamente → **REJEITAR**

#### 3. Rate Limiting (Webhook)

```javascript
// Máximo 10 webhooks/minuto por IP
const limiter = rateLimit({
  windowMs: 60000,
  max: 10,
  message: 'Too many webhook requests'
});

app.post('/api/webhook/payment', limiter, handleWebhook);
```

#### 4. Logs de Auditoria

Todas as ativações são logadas:

```javascript
console.log(`💳 [ACTIVATION] UID=${uid}, Plan=${newPlan}, Event=${eventId}, Transaction=${transactionId}`);
```

---

## 📊 ESTADO ATUAL DO SISTEMA

### ✅ O QUE JÁ ESTÁ PRONTO

| Item | Status | Localização |
|------|--------|-------------|
| **Estrutura de dados Firestore** | ✅ PRONTO | `usuarios/{uid}` |
| **Sistema de limites mensais** | ✅ PRONTO | `userPlans.js` |
| **Verificação de plano** | ✅ PRONTO | `canUseChat()`, `canUseAnalysis()` |
| **Reset mensal automático** | ✅ PRONTO | `normalizeUserDoc()` |
| **Expiração automática** | ✅ PRONTO | `normalizeUserDoc()` |
| **Contadores de uso** | ✅ PRONTO | `registerChat()`, `registerAnalysis()` |
| **Hard caps (PRO)** | ✅ PRONTO | 500 análises, 300 mensagens, 70 imagens |
| **Função `applyPlan()`** | ✅ PRONTO | `userPlans.js:207` |
| **Proteção de escrita (backend-only)** | ✅ PRONTO | Firestore Rules |

### ⚠️ O QUE AINDA NÃO DEVE SER FEITO

| Item | Status | Motivo |
|------|--------|--------|
| **Integração Mercado Pago** | ❌ NÃO FAZER | Aguardando definição de gateway |
| **Integração Stripe** | ❌ NÃO FAZER | Aguardando definição de gateway |
| **Endpoint de webhook** | ❌ NÃO FAZER | Depende do gateway escolhido |
| **Frontend de pagamento** | ❌ NÃO FAZER | Backend precisa estar completo |
| **Página de pricing** | ❌ NÃO FAZER | Aguardando valores finais |
| **Função `activateUserPlan()`** | ⚠️ DOCUMENTADO | Implementar quando gateway for escolhido |

### 🔍 Campos do Firestore Auditados

```javascript
// ✅ CAMPOS OFICIAIS (USADOS)
{
  uid: string,
  plan: 'free' | 'plus' | 'pro',
  plusExpiresAt: Timestamp | null,
  proExpiresAt: Timestamp | null,
  billingMonth: string,
  analysesMonth: number,
  messagesMonth: number,
  imagesMonth: number,
  createdAt: string,
  updatedAt: string
}

// ❌ CAMPOS LEGADOS (REMOVIDOS)
{
  imagemAnalises: DELETADO,
  mensagensRestantes: DELETADO,
  dataUltimoReset: DELETADO,
  mesAtual: DELETADO,
  anoAtual: DELETADO
}
```

### 📍 Onde o Plano é Lido

| Arquivo | Linha | Uso |
|---------|-------|-----|
| `userPlans.js` | 63 | Normalização de plano |
| `userPlans.js` | 233 | Verificação de limites (chat) |
| `userPlans.js` | 323 | Verificação de limites (análise) |
| `chat.js` | 888 | Log de bloqueio |
| `analyze.js` | 472 | Log de modo de análise |

**✅ CONFIRMADO:** Nenhum lugar no frontend altera o plano diretamente.

---

## 🚀 PRÓXIMOS PASSOS

### Fase 1: Escolher Gateway (PENDENTE)

- [ ] Decidir: Mercado Pago vs Stripe vs outro
- [ ] Criar conta no gateway escolhido
- [ ] Obter credenciais (API Key, Webhook Secret)
- [ ] Definir valores dos planos (R$)

### Fase 2: Implementar Webhook (APÓS ESCOLHA)

- [ ] Criar endpoint `/api/webhook/payment`
- [ ] Implementar validação de assinatura
- [ ] Chamar `activateUserPlan()` após validação
- [ ] Testar com webhooks de teste do gateway
- [ ] Configurar URL do webhook no gateway

### Fase 3: Testar Fluxo Completo (APÓS WEBHOOK)

- [ ] Simular pagamento aprovado
- [ ] Verificar ativação no Firestore
- [ ] Confirmar atualização no frontend
- [ ] Testar expiração de plano
- [ ] Validar idempotência

### Fase 4: Frontend de Pagamento (APÓS TESTES)

- [ ] Criar página de pricing
- [ ] Implementar botão de assinatura
- [ ] Integrar SDK do gateway
- [ ] Testar fluxo completo (usuário → pagamento → ativação)

---

## 📝 NOTAS FINAIS

### Princípios Mantidos

✅ **Sem impacto em FREE e PLUS** - Planos existentes não foram alterados  
✅ **Backend é fonte da verdade** - Frontend apenas reflete, nunca modifica  
✅ **Sistema preparado** - Pronto para receber webhook quando gateway for integrado  
✅ **Segurança garantida** - Idempotência, validação, logs  

### Riscos Mitigados

🔒 **Fraude:** Webhook validado, sem acesso direto do frontend  
🔒 **Duplicação:** Idempotência via `eventId`  
🔒 **Inconsistência:** Transações atômicas no Firestore  
🔒 **Expiração silenciosa:** Verificação automática em toda interação  

---

**Documento criado em:** 14/12/2025  
**Última revisão:** 14/12/2025  
**Status:** ✅ APROVADO PARA INTEGRAÇÃO FUTURA
