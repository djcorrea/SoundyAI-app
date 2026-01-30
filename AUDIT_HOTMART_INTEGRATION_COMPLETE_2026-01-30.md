# 🔍 AUDITORIA COMPLETA: INTEGRAÇÃO HOTMART → BACKEND → LIBERAÇÃO DE ACESSO

**Data:** 30/01/2026  
**Objetivo:** Mapear arquitetura atual e implementar mudança de 4 meses STUDIO → 1 mês PLUS  
**Status Atual:** 4 meses de acesso ao plano STUDIO  
**Meta:** 1 mês de acesso ao plano PLUS

---

## 📊 1. ARQUITETURA ATUAL MAPEADA

### 🔄 FLUXO COMPLETO

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FLUXO HOTMART → SoundyAI (ESTADO ATUAL)                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ 1. Cliente compra na Hotmart                                           │
│    └─► Produto: "Combo Curso + 4 meses SoundyAI"                       │
│                                                                         │
│ 2. Hotmart processa pagamento                                          │
│    └─► Status: PURCHASE_APPROVED, paid, completed, etc                 │
│                                                                         │
│ 3. Hotmart envia webhook POST                                          │
│    └─► URL: https://soundyai.com.br/api/webhook/hotmart                │
│    └─► Header: X-Hotmart-Hottok (validação HMAC)                       │
│                                                                         │
│ 4. Backend processa (api/webhook/hotmart.js)                           │
│    ├─► Valida assinatura (DESABILITADA temporariamente)                │
│    ├─► Verifica idempotência (hotmart_transactions)                    │
│    ├─► Busca/cria usuário no Firebase Auth                             │
│    ├─► Ativa plano STUDIO por 120 dias (4 meses) ⚠️                    │
│    ├─► Marca transação como processada                                 │
│    └─► Envia e-mail de onboarding                                      │
│                                                                         │
│ 5. Usuário acessa plataforma                                           │
│    └─► Plano: STUDIO                                                   │
│    └─► Expira em: 120 dias (4 meses)                                   │
│    └─► Campo: studioExpiresAt                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 2. ARQUIVOS MAPEADOS

### 🎯 ARQUIVO PRINCIPAL: `api/webhook/hotmart.js`

**Localização:** `c:\Users\DJ Correa\Desktop\Programação\SoundyAI\api\webhook\hotmart.js`

**Configurações Atuais:**
```javascript
// Linha 38
const STUDIO_DURATION_DAYS = 120; // 4 meses ⚠️ ALTERAR

// Linha 395-399 (dentro de processWebhookAsync)
const updatedUser = await applyPlan(user.uid, {
  plan: 'studio',  // ⚠️ ALTERAR PARA 'plus'
  durationDays: STUDIO_DURATION_DAYS
});

console.log(`✅ [HOTMART-ASYNC] Plano STUDIO ativado: ${user.uid} até ${updatedUser.studioExpiresAt}`);
```

**Funcionalidades Implementadas:**
- ✅ Validação HMAC (temporariamente desabilitada - linha ~490)
- ✅ Parse seguro do body (Buffer ou Object)
- ✅ Idempotência via collection `hotmart_transactions`
- ✅ Criação automática de usuário
- ✅ Ativação de plano via `applyPlan()`
- ✅ E-mail de onboarding

---

### 🔧 ARQUIVO DE LÓGICA: `work/lib/user/userPlans.js`

**Localização:** `c:\Users\DJ Correa\Desktop\Programação\SoundyAI\work\lib\user\userPlans.js`

**Função Principal:** `applyPlan()`

**Código Atual:**
```javascript
// Linha 437-473 (aproximado)
export async function applyPlan(uid, { plan, durationDays }) {
  console.log(`💳 [USER-PLANS] Aplicando plano ${plan} para ${uid} (${durationDays} dias)`);
  
  const ref = getDb().collection(USERS).doc(uid);
  await getOrCreateUser(uid);

  const now = Date.now();
  const expires = new Date(now + durationDays * 86400000).toISOString();

  const update = {
    plan,
    updatedAt: new Date().toISOString(),
  };

  // Para PLUS
  if (plan === "plus") {
    update.plusExpiresAt = expires;
    update.proExpiresAt = null;
    update.djExpiresAt = null;
    update.studioExpiresAt = null; // Limpar STUDIO
  }
  
  // Para PRO
  if (plan === "pro") {
    update.proExpiresAt = expires;
    update.plusExpiresAt = null;
    update.djExpiresAt = null;
    update.studioExpiresAt = null; // Limpar STUDIO
  }

  // Para STUDIO ⚠️ ESTE BLOCO ATUALMENTE É USADO
  if (plan === "studio") {
    update.studioExpiresAt = expires;
    update.plusExpiresAt = null;
    update.proExpiresAt = null;
    update.djExpiresAt = null;
  }

  await ref.update(update);
  
  const updatedUser = (await ref.get()).data();
  console.log(`✅ [USER-PLANS] Plano aplicado: ${uid} → ${plan} até ${expires}`);
  
  return updatedUser;
}
```

**Verificação de Expiração Automática:**
```javascript
// Linha 165-170 (dentro de normalizeUserDoc)
if (user.studioExpiresAt && Date.now() > new Date(user.studioExpiresAt).getTime() && user.plan === "studio") {
  console.log(`🎬 [USER-PLANS] Plano Studio expirado para: ${uid}`);
  user.plan = "free";
  changed = true;
}

// Similar para PLUS (linha 143-148)
if (user.plusExpiresAt && Date.now() > new Date(user.plusExpiresAt).getTime() && user.plan === "plus") {
  console.log(`🔻 [USER-PLANS] Plano Plus expirado para: ${uid}`);
  user.plan = "free";
  changed = true;
}
```

---

### 📧 ARQUIVO DE EMAIL: `lib/email/onboarding-email.js`

**Função:** `sendOnboardingEmail()`

**Chamada no webhook:**
```javascript
// Linha 420-428 (api/webhook/hotmart.js)
const emailResult = await sendOnboardingEmail({
  email: data.buyerEmail,
  name: data.buyerName,
  isNewUser: user.isNew,
  expiresAt: updatedUser.studioExpiresAt,  // ⚠️ MUDARÁ PARA plusExpiresAt
  transactionId: data.transactionId,
  planName: 'STUDIO'  // ⚠️ ALTERAR PARA 'PLUS'
});
```

---

### 🕐 JOB DE EXPIRAÇÃO: `lib/jobs/expire-plans.js`

**Localização:** `c:\Users\DJ Correa\Desktop\Programação\SoundyAI\lib\jobs\expire-plans.js`

**Status Atual:** ✅ JÁ IMPLEMENTADO

**Funcionalidades:**
- ✅ Verifica planos PRO expirados (proExpiresAt)
- ✅ Verifica planos PLUS expirados (plusExpiresAt)
- ❌ NÃO verifica planos STUDIO expirados (studioExpiresAt) ⚠️ PRECISA ADICIONAR

**Código Atual (PLUS):**
```javascript
// Linha 80-116
const plusExpiredQuery = db.collection(USERS_COLLECTION)
  .where('plan', '==', 'plus')
  .where('plusExpiresAt', '<=', now.toISOString());

const plusSnapshot = await plusExpiredQuery.get();

for (const doc of plusSnapshot.docs) {
  const userData = doc.data();
  const uid = doc.id;

  // Verificar se não é assinatura ativa
  if (userData.subscription?.status === 'active') {
    continue;
  }

  console.log(`🔻 [EXPIRE-JOB] Expirando PLUS: ${uid}`);
  
  await doc.ref.update({
    plan: 'free',
    plusExpiresAt: null,
    expiredAt: now.toISOString(),
    expiredPlan: 'plus',
    updatedAt: now.toISOString()
  });

  stats.plusExpired++;
  stats.expired++;
}
```

**Necessidade:** Adicionar verificação similar para STUDIO (mas não será mais necessário após mudança)

---

### ⚙️ CONFIGURAÇÃO DE PLANOS: `lib/permissions/plan-config.js`

**Localização:** `c:\Users\DJ Correa\Desktop\Programação\SoundyAI\lib\permissions\plan-config.js`

**Configuração do Combo Hotmart:**
```javascript
// Linha 497-510
export const HOTMART_COMBO = {
  id: 'hotmart-plus-4m',
  name: 'Combo Hotmart Plus 4 Meses',  // ⚠️ ALTERAR PARA 1 MÊS
  basePlan: 'plus',
  duration: 120, // 4 meses em dias ⚠️ ALTERAR PARA 30
  price: 157,
  features: {
    ...PLAN_LIMITS.plus.features,
    hotmartBadge: true
  }
};
```

---

## 🗄️ 3. BANCO DE DADOS (FIRESTORE)

### Collection: `usuarios`

**Campos Relevantes:**
```javascript
{
  uid: "abc123",                  // ID do usuário
  email: "user@example.com",
  plan: "studio",                 // ⚠️ Atualmente "studio", vai virar "plus"
  
  // Campos de expiração por plano
  plusExpiresAt: null,            // ⚠️ Será preenchido após mudança
  proExpiresAt: null,
  studioExpiresAt: "2026-05-30",  // ⚠️ Atualmente usado, não será mais
  djExpiresAt: null,
  
  // Informações de compra
  hotmartTransactionId: "HPM123456",
  origin: "hotmart",
  
  // Timestamps
  createdAt: "2026-01-30",
  updatedAt: "2026-01-30"
}
```

### Collection: `hotmart_transactions`

**Campos:**
```javascript
{
  transactionId: "HPM123456",     // ID único da transação (usado para idempotência)
  buyerEmail: "user@example.com",
  status: "processed",
  origin: "hotmart",
  productName: "Combo Curso + STUDIO",  // ⚠️ Pode atualizar descrição
  planApplied: "studio",          // ⚠️ Mudará para "plus"
  durationDays: 120,              // ⚠️ Mudará para 30
  expiresAt: "2026-05-30",        // ⚠️ Será 1 mês a partir da compra
  processedAt: "2026-01-30",
  rawData: "{...}"
}
```

---

## 📋 4. LIMITES DE PLANOS

### Plano STUDIO (Atual)
```javascript
studio: {
  maxMessagesPerMonth: Infinity,        // Ilimitado visualmente
  maxFullAnalysesPerMonth: Infinity,    // Ilimitado visualmente
  maxImagesPerMonth: 150,
  hardCapMessagesPerMonth: 400,         // Hard cap: 400 mensagens
  hardCapAnalysesPerMonth: 400,         // Hard cap: 400 análises
  allowReducedAfterLimit: false,        // Bloqueia após hard cap
  priorityQueue: true
}
```

### Plano PLUS (Novo Target)
```javascript
plus: {
  maxMessagesPerMonth: 80,              // 80 mensagens/mês
  maxFullAnalysesPerMonth: 20,          // 20 análises/mês
  hardCapAnalysesPerMonth: null,        // Sem hard cap, vira reduced
  allowReducedAfterLimit: true          // Continua com análises reduzidas
}
```

**Diferença:** PLUS é muito mais limitado que STUDIO (80 msgs vs infinito, 20 análises vs infinito)

---

## ⚙️ 5. SISTEMA DE EXPIRAÇÃO ATUAL

### ✅ Expiração Lazy (Ao Acessar)

**Arquivo:** `work/lib/user/userPlans.js`  
**Função:** `normalizeUserDoc()`

**Como Funciona:**
1. Usuário faz qualquer requisição autenticada
2. Sistema busca documento do usuário no Firestore
3. `normalizeUserDoc()` é chamado automaticamente
4. Verifica se `studioExpiresAt` < data atual
5. Se expirado → muda `plan` para `'free'`
6. Atualiza documento no Firestore

**Vantagens:**
- ✅ Não depende de cron/scheduler
- ✅ Funciona mesmo se job falhar
- ✅ Garante estado sempre correto na requisição

**Desvantagens:**
- ❌ Só expira quando usuário acessa
- ❌ Usuário não é notificado proativamente

---

### ✅ Expiração Batch (Job Agendado)

**Arquivo:** `lib/jobs/expire-plans.js`  
**Função:** `runExpirePlansJob()`

**Como Funciona:**
1. Job roda 1x por dia (ou mais)
2. Busca todos os usuários com plano ativo e data de expiração passada
3. Atualiza todos de uma vez para plano FREE
4. Registra em `expiredAt` e `expiredPlan`

**Status Atual:**
- ✅ Implementado para PLUS
- ✅ Implementado para PRO
- ❌ NÃO implementado para STUDIO ⚠️ PRECISA ADICIONAR (mas não será necessário após mudança)

**Vantagens:**
- ✅ Expira proativamente (usuário não precisa acessar)
- ✅ Processa em lote (eficiente)
- ✅ Logs centralizados

**Desvantagens:**
- ❌ Depende de agendamento externo (Railway Cron, Vercel Cron, etc)
- ❌ Se job falhar, expirações não acontecem

---

## ❌ 6. O QUE NÃO EXISTE (E PRECISAMOS IMPLEMENTAR)

### 🚨 1. Notificação de Expiração

**Status:** ❌ NÃO IMPLEMENTADO

**O que falta:**
- Email 3 dias antes de expirar
- Email no dia da expiração
- Banner no dashboard 5 dias antes
- Modal ao fazer login após expiração

---

### 🚨 2. CTA de Upgrade/Renovação

**Status:** ❌ NÃO IMPLEMENTADO

**O que falta:**
- Botão "Renovar Plano" no dashboard quando próximo de expirar
- Modal de upgrade após expiração com planos PRO e STUDIO
- Email com link direto para página de planos
- Desconto especial para renovação (opcional)

---

### 🚨 3. Verificação de STUDIO no Job de Expiração

**Status:** ❌ NÃO IMPLEMENTADO

**O que falta:**
- Adicionar query para `plan === 'studio'` e `studioExpiresAt <= now`
- Processar expirações de STUDIO assim como PLUS e PRO

---

## 🎯 7. MUDANÇAS NECESSÁRIAS

### 📝 Mudança 1: Duração 4 meses → 1 mês

**Arquivos a alterar:**

1. **`api/webhook/hotmart.js`** (linha 38)
   ```javascript
   // ANTES
   const STUDIO_DURATION_DAYS = 120; // 4 meses
   
   // DEPOIS
   const PLUS_DURATION_DAYS = 30; // 1 mês
   ```

2. **`lib/permissions/plan-config.js`** (linha 501)
   ```javascript
   // ANTES
   duration: 120, // 4 meses em dias
   
   // DEPOIS
   duration: 30, // 1 mês em dias
   ```

3. **`lib/permissions/plan-config.js`** (linha 499)
   ```javascript
   // ANTES
   name: 'Combo Hotmart Plus 4 Meses',
   
   // DEPOIS
   name: 'Combo Hotmart Plus 1 Mês',
   ```

4. **`server.js`** (linhas 161 e 243)
   ```javascript
   // ANTES
   // 🎓 HOTMART: Webhook para combo Curso + PRO 4 meses
   
   // DEPOIS
   // 🎓 HOTMART: Webhook para combo Curso + PLUS 1 mês
   ```

---

### 📝 Mudança 2: Plano STUDIO → PLUS

**Arquivos a alterar:**

1. **`api/webhook/hotmart.js`** (linha 2)
   ```javascript
   // ANTES
   * 🎓 WEBHOOK HOTMART - Integração Combo Curso + STUDIO 4 meses
   
   // DEPOIS
   * 🎓 WEBHOOK HOTMART - Integração Combo Curso + PLUS 1 mês
   ```

2. **`api/webhook/hotmart.js`** (linha 38)
   ```javascript
   // ANTES
   const STUDIO_DURATION_DAYS = 120;
   
   // DEPOIS
   const PLUS_DURATION_DAYS = 30;
   ```

3. **`api/webhook/hotmart.js`** (linha 388)
   ```javascript
   // ANTES
   console.log(`💳 [HOTMART-ASYNC] Ativando STUDIO para ${user.uid} (${STUDIO_DURATION_DAYS} dias)`);
   
   // DEPOIS
   console.log(`💳 [HOTMART-ASYNC] Ativando PLUS para ${user.uid} (${PLUS_DURATION_DAYS} dias)`);
   ```

4. **`api/webhook/hotmart.js`** (linha 390-393)
   ```javascript
   // ANTES
   const updatedUser = await applyPlan(user.uid, {
     plan: 'studio',
     durationDays: STUDIO_DURATION_DAYS
   });
   
   // DEPOIS
   const updatedUser = await applyPlan(user.uid, {
     plan: 'plus',
     durationDays: PLUS_DURATION_DAYS
   });
   ```

5. **`api/webhook/hotmart.js`** (linha 395)
   ```javascript
   // ANTES
   console.log(`✅ [HOTMART-ASYNC] Plano STUDIO ativado: ${user.uid} até ${updatedUser.studioExpiresAt}`);
   
   // DEPOIS
   console.log(`✅ [HOTMART-ASYNC] Plano PLUS ativado: ${user.uid} até ${updatedUser.plusExpiresAt}`);
   ```

6. **`api/webhook/hotmart.js`** (linha 412-419)
   ```javascript
   // ANTES
   await markTransactionProcessed(data.transactionId, {
     ...data,
     uid: user.uid,
     planApplied: 'studio',
     durationDays: STUDIO_DURATION_DAYS,
     expiresAt: updatedUser.studioExpiresAt
   });
   
   // DEPOIS
   await markTransactionProcessed(data.transactionId, {
     ...data,
     uid: user.uid,
     planApplied: 'plus',
     durationDays: PLUS_DURATION_DAYS,
     expiresAt: updatedUser.plusExpiresAt
   });
   ```

7. **`api/webhook/hotmart.js`** (linha 424-427)
   ```javascript
   // ANTES
   const emailResult = await sendOnboardingEmail({
     email: data.buyerEmail,
     name: data.buyerName,
     isNewUser: user.isNew,
     expiresAt: updatedUser.studioExpiresAt,
     transactionId: data.transactionId,
     planName: 'STUDIO'
   });
   
   // DEPOIS
   const emailResult = await sendOnboardingEmail({
     email: data.buyerEmail,
     name: data.buyerName,
     isNewUser: user.isNew,
     expiresAt: updatedUser.plusExpiresAt,
     transactionId: data.transactionId,
     planName: 'PLUS'
   });
   ```

---

### 📝 Mudança 3: Adicionar Verificação STUDIO no Job de Expiração

**Arquivo:** `lib/jobs/expire-plans.js`

**Adicionar após verificação de PLUS (após linha 116):**
```javascript
// ═══════════════════════════════════════════════════════════════
// PASSO 3: Buscar usuários STUDIO com studioExpiresAt expirado
// ═══════════════════════════════════════════════════════════════
console.log('🔍 [EXPIRE-JOB] Buscando planos STUDIO expirados...');

const studioExpiredQuery = db.collection(USERS_COLLECTION)
  .where('plan', '==', 'studio')
  .where('studioExpiresAt', '<=', now.toISOString());

const studioSnapshot = await studioExpiredQuery.get();

for (const doc of studioSnapshot.docs) {
  try {
    const userData = doc.data();
    const uid = doc.id;

    // Verificar se não é assinatura ativa
    if (userData.subscription?.status === 'active') {
      console.log(`⏭️ [EXPIRE-JOB] ${uid} tem assinatura ativa - ignorando`);
      continue;
    }

    console.log(`🔻 [EXPIRE-JOB] Expirando STUDIO: ${uid} (expirou em ${userData.studioExpiresAt})`);
    
    await doc.ref.update({
      plan: 'free',
      studioExpiresAt: null,
      expiredAt: now.toISOString(),
      expiredPlan: 'studio',
      updatedAt: now.toISOString()
    });

    stats.studioExpired++;
    stats.expired++;
  } catch (err) {
    console.error(`❌ [EXPIRE-JOB] Erro ao expirar ${doc.id}:`, err.message);
    stats.errors.push({ uid: doc.id, error: err.message });
  }
}
```

---

## 🚀 8. NOVAS FUNCIONALIDADES A IMPLEMENTAR

### ✅ 1. Sistema de Notificação Pré-Expiração

**Arquivo Novo:** `lib/email/expiration-notice.js`

**Funcionalidades:**
- ✅ Email 7 dias antes de expirar
- ✅ Email 3 dias antes de expirar
- ✅ Email no dia da expiração
- ✅ Link direto para página de planos

**Exemplo de Email:**
```html
Olá, [Nome]!

Seu plano PLUS expira em 3 dias (dia 02/02/2026).

Para continuar aproveitando:
- 80 mensagens de chat por mês
- 20 análises completas por mês
- Sugestões avançadas de IA

[Renovar Agora] [Ver Outros Planos]
```

---

### ✅ 2. Job de Notificação

**Arquivo Novo:** `lib/jobs/notify-expiration.js`

**Funcionalidades:**
- Roda 1x por dia (junto com job de expiração)
- Busca usuários com expiração em 7, 3 e 1 dia
- Envia email apropriado
- Marca como notificado para não enviar duplicado

**Campos novos no Firestore:**
```javascript
{
  plan: "plus",
  plusExpiresAt: "2026-02-05",
  expirationNotifications: {
    day7: true,    // Email enviado 7 dias antes
    day3: true,    // Email enviado 3 dias antes
    day0: true     // Email enviado no dia
  }
}
```

---

### ✅ 3. Banner no Dashboard

**Arquivo:** Frontend (index.html ou dashboard component)

**Exibir banner se:**
```javascript
const daysUntilExpiration = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

if (daysUntilExpiration <= 5 && daysUntilExpiration > 0) {
  // Exibir banner amarelo
  showBanner(`Seu plano expira em ${daysUntilExpiration} dias`, 'warning');
}

if (daysUntilExpiration === 0) {
  // Exibir banner vermelho
  showBanner('Seu plano expira hoje!', 'error');
}

if (daysUntilExpiration < 0) {
  // Exibir banner vermelho pós-expiração
  showBanner('Seu plano expirou. Renove para continuar.', 'error');
}
```

---

### ✅ 4. Modal de Upgrade Pós-Expiração

**Arquivo:** Frontend (modal component)

**Exibir modal ao fazer login se:**
```javascript
if (user.plan === 'free' && user.expiredPlan === 'plus') {
  showModal({
    title: 'Seu plano PLUS expirou',
    message: 'Renove agora e continue com todos os recursos premium!',
    ctas: [
      { text: 'Renovar PLUS (1 mês)', action: 'upgrade-plus' },
      { text: 'Ver Plano PRO', action: 'upgrade-pro' },
      { text: 'Ver Plano STUDIO', action: 'upgrade-studio' }
    ]
  });
}
```

---

## 📊 9. COMPATIBILIDADE COM COMPRAS ANTIGAS

### 🔒 REGRA: NÃO AFETAR COMPRAS ANTIGAS

**Garantia:**
- Usuários que já têm STUDIO continuam com STUDIO até expirar
- Campo `studioExpiresAt` permanece válido
- Sistema verifica expiração normalmente
- Após expiração → vai para FREE normalmente

**Implementação:**
- Mudanças no webhook só afetam **NOVAS** compras
- Documentos antigos não são alterados
- Lógica de expiração funciona para ambos os casos

**Exemplo:**
```javascript
// Usuário antigo (comprou antes de 30/01/2026)
{
  plan: "studio",
  studioExpiresAt: "2026-05-01",  // Mantém os 4 meses
  hotmartTransactionId: "HPM_OLD_123"
}

// Usuário novo (comprou após 30/01/2026)
{
  plan: "plus",
  plusExpiresAt: "2026-03-01",    // Recebe 1 mês
  hotmartTransactionId: "HPM_NEW_456"
}
```

---

## ✅ 10. CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Mudanças Essenciais (OBRIGATÓRIO)
- [ ] Alterar `STUDIO_DURATION_DAYS` de 120 para 30 e renomear para `PLUS_DURATION_DAYS`
- [ ] Alterar plano de `'studio'` para `'plus'` no webhook
- [ ] Atualizar todos os logs e mensagens
- [ ] Alterar `planName: 'STUDIO'` para `'PLUS'` no email
- [ ] Atualizar `HOTMART_COMBO.duration` de 120 para 30
- [ ] Atualizar `HOTMART_COMBO.name` para "1 Mês"
- [ ] Testar webhook em ambiente de desenvolvimento

### Fase 2: Sistema de Expiração (RECOMENDADO)
- [ ] Adicionar verificação de STUDIO no job de expiração
- [ ] Atualizar stats do job para incluir `studioExpired`
- [ ] Testar job de expiração localmente
- [ ] Configurar agendamento no Railway/Render (1x por dia)

### Fase 3: Notificações (NOVO - OPCIONAL MAS RECOMENDADO)
- [ ] Criar `lib/email/expiration-notice.js`
- [ ] Implementar templates de email (7, 3, 1 dia)
- [ ] Criar `lib/jobs/notify-expiration.js`
- [ ] Adicionar campo `expirationNotifications` no Firestore
- [ ] Testar envio de emails
- [ ] Configurar agendamento do job de notificação

### Fase 4: CTAs de Upgrade (NOVO - RECOMENDADO)
- [ ] Criar componente de banner de expiração
- [ ] Implementar lógica de exibição (5 dias antes)
- [ ] Criar modal de upgrade pós-expiração
- [ ] Adicionar botões de renovação no dashboard
- [ ] Testar fluxo completo de expiração + upgrade

### Fase 5: Testes e Deploy
- [ ] Testar webhook com payload fake
- [ ] Verificar idempotência
- [ ] Testar criação de usuário novo
- [ ] Testar ativação de plano PLUS
- [ ] Verificar campo `plusExpiresAt` no Firestore
- [ ] Testar e-mail de onboarding
- [ ] Fazer deploy no Railway
- [ ] Atualizar webhook na Hotmart (se necessário)
- [ ] Monitorar logs de produção

---

## 🎓 11. CONSIDERAÇÕES FINAIS

### ✅ Pontos Fortes da Implementação Atual

1. **Idempotência Robusta**: Transação processada apenas 1x
2. **Expiração Lazy**: Garante estado correto sem depender de cron
3. **Criação Automática de Usuário**: Sem fricção para comprador
4. **Job de Expiração Batch**: Processa expirados proativamente
5. **Sistema de Referência**: Rastreamento de origem já implementado

### ⚠️ Pontos de Atenção

1. **Validação HMAC Desabilitada**: Reabilitar após confirmar funcionamento
2. **Job de Expiração**: Precisa de agendamento externo (Railway Cron)
3. **Sem Notificações**: Usuário só descobre ao acessar (resolver na Fase 3)
4. **Email Secundário**: Falha no email não bloqueia ativação (correto)

### 🎯 Recomendações

1. **Prioridade ALTA**: Implementar Fases 1 e 2 (mudanças essenciais + job)
2. **Prioridade MÉDIA**: Implementar Fase 3 (notificações de expiração)
3. **Prioridade BAIXA**: Implementar Fase 4 (CTAs de upgrade - opcional mas melhora conversão)

---

## 📚 12. REFERÊNCIAS

### Documentos Relacionados
- `CHANGELOG_HOTMART_STUDIO_2026-01-06.md` - Última mudança (PRO → STUDIO)
- `docs/HOTMART_INTEGRATION.md` - Documentação original
- `docs/HOTMART_AUDIT_COMPLETE.md` - Auditoria anterior

### Arquivos Críticos
- `api/webhook/hotmart.js` - Webhook principal
- `work/lib/user/userPlans.js` - Lógica de planos
- `lib/jobs/expire-plans.js` - Job de expiração
- `lib/permissions/plan-config.js` - Configuração de planos

---

**Auditoria Completa - Pronta para Implementação** ✅
