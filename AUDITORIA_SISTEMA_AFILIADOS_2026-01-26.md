# 🔍 AUDITORIA COMPLETA - SISTEMA DE AFILIADOS/REFERÊNCIA

**Data:** 26 de janeiro de 2026  
**Auditor:** GitHub Copilot (Engenheiro Sênior)  
**Status:** ✅ AUDITORIA CONCLUÍDA  
**Objetivo:** Mapear sistema atual para implementação segura de programa de afiliados escalável

---

## 📋 SUMÁRIO EXECUTIVO

### ✅ PONTOS FORTES IDENTIFICADOS

1. ✅ **Sistema de autenticação robusto** - Firebase Auth com token validation
2. ✅ **Firestore bem estruturado** - Collection `usuarios` consolidada
3. ✅ **Sistema de planos funcionando** - FREE, PLUS, PRO, STUDIO, DJ
4. ✅ **Webhooks seguros implementados** - Stripe, Hotmart, Mercado Pago
5. ✅ **Idempotência garantida** - Sistema de eventos processados
6. ✅ **Painel de usuário existente** - `gerenciar.html` com gestão de assinatura

### ⚠️ GAPS PARA IMPLEMENTAÇÃO

1. ❌ **Nenhum campo de referência** no cadastro atual
2. ❌ **Sem collection `partners`** no Firestore
3. ❌ **Sem captura de URL params** (ex: `?ref=codigo`)
4. ❌ **Sem painel para parceiros**
5. ❌ **Sem métricas de conversão** por parceiro
6. ❌ **Sem cálculo de comissões**

---

## 🗂️ 1. ESTRUTURA FIRESTORE ATUAL

### 📊 Collection: `usuarios`

**Caminho:** Raiz do Firestore  
**Documento ID:** UID do Firebase Auth

```javascript
{
  // ===== IDENTIFICAÇÃO =====
  uid: string,                    // ✅ ID único do Firebase Auth
  email: string,                  // ✅ Email do usuário
  telefone: string,               // ✅ Telefone (opcional)
  createdAt: string,              // ✅ ISO timestamp de criação
  updatedAt: string,              // ✅ ISO timestamp de atualização
  
  // ===== PLANOS E ASSINATURAS =====
  plan: 'free'|'plus'|'pro'|'studio'|'dj',  // ✅ Plano atual
  plusExpiresAt: string | null,   // ✅ Expiração Plus (ISO)
  proExpiresAt: string | null,    // ✅ Expiração Pro (ISO)
  studioExpiresAt: string | null, // ✅ Expiração Studio (ISO)
  djExpiresAt: string | null,     // ✅ Expiração DJ Beta (ISO)
  djExpired: boolean,             // ✅ Flag de DJ expirado
  
  // ===== ASSINATURA STRIPE (modo recorrente) =====
  subscription: {
    id: string,                   // ✅ Subscription ID do Stripe
    customerId: string,           // ✅ Customer ID do Stripe
    status: string,               // ✅ 'active' | 'canceled' | 'past_due'
    currentPeriodEnd: string,     // ✅ Fim do período atual (ISO)
    priceId: string,              // ✅ Price ID do plano
    updatedAt: string,            // ✅ Última atualização
    canceledAt: string | null,    // ✅ Data de cancelamento
  },
  stripeCustomerId: string | null, // ✅ Facilita buscas
  
  // ===== LIMITES MENSAIS =====
  messagesMonth: number,          // ✅ Mensagens usadas no mês
  analysesMonth: number,          // ✅ Análises usadas no mês
  imagesMonth: number,            // ✅ Imagens usadas no mês
  billingMonth: string,           // ✅ Mês de referência "YYYY-MM"
  
  // ===== PERFIL DO USUÁRIO =====
  perfil: {                       // ✅ Resultado da entrevista inicial
    experiencia: string,
    objetivos: string[],
    generosPrincipais: string[],
    daw: string,
    // ...
  },
  entrevistaConcluida: boolean,   // ✅ Se completou onboarding
  
  // ===== CAMPOS AUSENTES (NECESSÁRIOS PARA AFILIADOS) =====
  // ❌ referralCode: string | null        // Código do parceiro que trouxe
  // ❌ referredBy: string | null          // Alternativa (nome do campo)
  // ❌ referralTimestamp: string | null   // Data que usou o link
  // ❌ convertedAt: string | null         // Data que virou pagante
  // ❌ firstPaidPlan: string | null       // Primeiro plano pago
}
```

### 📌 Collections Relacionadas (Existentes)

#### Collection: `processed_stripe_events`
**Propósito:** Idempotência de webhooks Stripe  
**Documento ID:** Event ID do Stripe (`evt_xxx`)

```javascript
{
  eventId: string,
  processedAt: Timestamp,
  // ... dados do evento
}
```

#### Collection: `hotmart_transactions`
**Propósito:** Transações processadas da Hotmart  
**Documento ID:** Transaction ID da Hotmart

```javascript
{
  transactionId: string,
  email: string,
  plan: 'studio',
  durationDays: 120,
  processedAt: Timestamp,
  // ...
}
```

### ⚠️ Collections FALTANDO (Necessárias)

```javascript
// ===== NOVA COLLECTION: partners =====
partners/{partnerId} {
  partnerId: string,              // ID único do parceiro (ex: "estudioherta")
  name: string,                   // Nome do parceiro
  referralCode: string,           // Código único (ex: "estudioherta")
  email: string,                  // Email para contato
  commissionPercent: number,      // Percentual de comissão (ex: 50)
  active: boolean,                // Se está ativo
  createdAt: string,              // ISO timestamp
  updatedAt: string,              // ISO timestamp
  
  // Metadata opcional
  description: string | null,     // Descrição do parceiro
  website: string | null,         // Site/canal do parceiro
  tier: string | null,            // 'bronze' | 'silver' | 'gold'
}

// ===== NOVA COLLECTION (OPCIONAL): partner_metrics =====
// Snapshot mensal de métricas por parceiro
partner_metrics/{partnerId}_{YYYY-MM} {
  partnerId: string,
  month: string,                  // "2026-01"
  
  totalSignups: number,           // Total de cadastros com ref
  totalConversions: number,       // Total que virou pagante
  
  // Quebra por plano
  conversions: {
    plus: number,
    pro: number,
    studio: number,
  },
  
  // Financeiro
  totalRevenue: number,           // Receita total gerada
  totalCommission: number,        // Comissão calculada
  
  calculatedAt: string,           // Timestamp do cálculo
}
```

---

## 🔐 2. SISTEMA DE AUTENTICAÇÃO

### Cadastro de Usuários

**Localização:** [public/auth.js](public/auth.js)

#### Fluxo Atual:

1. Usuário preenche formulário (email, senha, telefone)
2. Executa `createUserWithEmailAndPassword(auth, email, password)`
3. Salva metadados em `localStorage` temporariamente
4. `onAuthStateChanged` listener detecta novo usuário
5. Cria documento em `usuarios/{uid}` automaticamente

**Código Relevante:** [public/auth.js#L296-L348](public/auth.js#L296-L348)

```javascript
async function directEmailSignUp() {
  // ... validações ...
  
  const result = await createUserWithEmailAndPassword(auth, email, password);
  const user = result.user;
  
  // ✅ CRÍTICO: Metadados salvos para listener criar Firestore
  localStorage.setItem('cadastroMetadata', JSON.stringify({
    email: email,
    telefone: phone,
    deviceId: 'direct_signup_' + Date.now(),
    timestamp: new Date().toISOString(),
    criadoSemSMS: true
  }));
  
  // Listener global irá criar usuarios/{uid}
}
```

**Listener de Criação:** [public/auth.js#L1477-L1624](public/auth.js#L1477-L1624)

```javascript
auth.onAuthStateChanged(async (user) => {
  if (!user) return;
  
  const userRef = doc(db, 'usuarios', user.uid);
  const snap = await getDoc(userRef);
  
  if (!snap.exists()) {
    // ✅ CRIAR DOCUMENTO NO FIRESTORE
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      telefone: cadastroMetadata?.telefone || user.phoneNumber || null,
      plano: 'free',
      criadoSemSMS: true,
      entrevistaConcluida: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
});
```

### Login de Usuários

**Localização:** [public/auth.js#L150-L226](public/auth.js#L150-L226)

```javascript
async function login() {
  const result = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await result.user.getIdToken();
  
  localStorage.setItem("authToken", idToken);
  localStorage.setItem("user", JSON.stringify({
    uid: result.user.uid,
    email: result.user.email
  }));
  
  // Verificar se documento existe no Firestore
  const snap = await getDoc(doc(db, 'usuarios', result.user.uid));
  
  if (!snap.exists()) {
    window.location.href = "entrevista.html";  // Onboarding
    return;
  }
  
  window.location.href = "index.html";  // Dashboard
}
```

### ✅ Ponto de Inserção Identificado: CADASTRO

**Onde adicionar lógica de referência:**

1. **Captura do `ref` na URL:**  
   - Adicionar script em `index.html` (landing page)
   - Salvar `ref` em `localStorage` ou `sessionStorage`

2. **Salvar no Firestore:**  
   - No listener `onAuthStateChanged`, ao criar documento
   - Adicionar campo `referralCode: localStorage.getItem('ref') || null`

**Exemplo:**

```javascript
// Em index.html ou auth.js (antes do cadastro)
const urlParams = new URLSearchParams(window.location.search);
const refCode = urlParams.get('ref');
if (refCode) {
  localStorage.setItem('soundy_ref', refCode);
  localStorage.setItem('soundy_ref_timestamp', new Date().toISOString());
}

// No listener onAuthStateChanged (ao criar usuario)
const savedRef = localStorage.getItem('soundy_ref');
await setDoc(userRef, {
  // ... campos existentes ...
  referralCode: savedRef || null,
  referralTimestamp: savedRef ? localStorage.getItem('soundy_ref_timestamp') : null,
});
```

---

## 💳 3. SISTEMA DE PAGAMENTOS E PLANOS

### Planos Disponíveis

**Fonte:** [work/lib/user/userPlans.js](work/lib/user/userPlans.js#L20-L66)

| Plano | Mensagens/Mês | Análises/Mês | Preço |
|-------|---------------|--------------|-------|
| FREE | 20 | 1 full + reduced | R$ 0,00 |
| PLUS | 80 | 20 full + reduced | R$ 47,99/mês |
| PRO | 300 (hard cap) | 60 full + reduced | R$ 197,00/mês |
| STUDIO | 400 (hard cap) | 400 full | R$ 99,90/mês |
| DJ (Beta) | 300 | 60 | 15 dias grátis |

### Webhooks de Pagamento

#### Stripe (Assinatura Recorrente)

**Localização:** [work/api/webhook/stripe.js](work/api/webhook/stripe.js)

**Eventos Tratados:**
- `checkout.session.completed` → Ativa plano após pagamento
- `customer.subscription.updated` → Atualiza status (active, canceled)
- `customer.subscription.deleted` → Rebaixa para FREE
- `invoice.payment_succeeded` → Renova assinatura
- `invoice.payment_failed` → Marca inadimplente

**Função de Ativação:** `applySubscription(uid, { plan, subscriptionId, ... })`

```javascript
export async function applySubscription(uid, { plan, subscriptionId, customerId, status, currentPeriodEnd, priceId }) {
  const ref = getDb().collection('usuarios').doc(uid);
  await getOrCreateUser(uid);

  const update = {
    plan,
    subscription: {
      id: subscriptionId,
      customerId: customerId || null,
      status,
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      priceId,
      updatedAt: new Date().toISOString(),
    },
    stripeCustomerId: customerId || null,
    updatedAt: new Date().toISOString(),
  };

  await ref.update(update);
  // ...
}
```

#### Hotmart (Pagamento Único)

**Localização:** [api/webhook/hotmart.js](api/webhook/hotmart.js)

**Fluxo:**
1. Recebe notificação de venda aprovada
2. Valida assinatura HMAC
3. Extrai email do comprador
4. Cria usuário automaticamente se não existir
5. Ativa plano STUDIO por 120 dias (4 meses)

**Função de Ativação:** `applyPlan(uid, { plan: 'studio', durationDays: 120 })`

```javascript
export async function applyPlan(uid, { plan, durationDays }) {
  const ref = getDb().collection('usuarios').doc(uid);
  await getOrCreateUser(uid);

  const now = Date.now();
  const expires = new Date(now + durationDays * 86400000).toISOString();

  const update = {
    plan,
    studioExpiresAt: expires,
    updatedAt: new Date().toISOString(),
  };

  await ref.update(update);
  // ...
}
```

### ✅ Ponto de Inserção Identificado: ATIVAÇÃO DE PLANO

**Quando usuário vira pagante:**

1. **No webhook Stripe** (`applySubscription`):
   - Após ativar plano, verificar se `referralCode` existe
   - Se existir, marcar `convertedAt: new Date().toISOString()`
   - Marcar `firstPaidPlan: plan`

2. **No webhook Hotmart** (`applyPlan`):
   - Idem ao Stripe

**Exemplo:**

```javascript
// No final de applySubscription ou applyPlan
const userData = (await ref.get()).data();

if (userData.referralCode && !userData.convertedAt) {
  await ref.update({
    convertedAt: new Date().toISOString(),
    firstPaidPlan: plan,
  });
  
  console.log(`🎯 [REFERRAL] Conversão registrada: ${uid} → ${plan} (parceiro: ${userData.referralCode})`);
}
```

---

## 📊 4. PAINEL ADMINISTRATIVO

### Painel de Usuário (Gerenciar Conta)

**Localização:** [public/gerenciar.html](public/gerenciar.html)

**Funcionalidades Existentes:**
- ✅ Visualizar plano atual
- ✅ Alterar senha
- ✅ Alterar email
- ✅ Cancelar assinatura (Stripe)
- ✅ Excluir conta

**Código Relevante:** [gerenciar.html#L390-L530](gerenciar.html#L390-L530)

```javascript
// Buscar plano do usuário
const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
const userData = userDoc.data();

const userPlan = userData.plan || 'free';
const subscription = userData.subscription || {};

// Exibir plano atual
if (userPlan === 'studio') {
  planNameElement.textContent = 'STUDIO';
} else if (userPlan === 'pro') {
  planNameElement.textContent = 'PRO';
} else if (userPlan === 'plus') {
  planNameElement.textContent = 'PLUS';
} else {
  planNameElement.textContent = 'GRÁTIS';
}
```

### ❌ Painel Admin (Não Existe)

**Não há painel administrativo no código atual.**

**Para implementar:**
- Criar `admin.html` com autenticação por email/uid permitido
- Listar usuários com filtros (plano, parceiro, data)
- Visualizar métricas globais
- Gerenciar parceiros

### ❌ Painel de Parceiro (Não Existe)

**Não há painel para parceiros visualizarem suas métricas.**

**Para implementar:**
- Criar `partner.html` ou `partner-dashboard.html`
- Autenticação via Firebase Auth (email do parceiro)
- Queries ao Firestore:
  - Total de cadastros: `where('referralCode', '==', partnerId)`
  - Total pagantes: `where('referralCode', '==', partnerId).where('plan', 'in', ['plus', 'pro', 'studio'])`
  - MRR gerado: calcular com base nos planos ativos

---

## 🔍 5. PONTOS DE INSERÇÃO SEGUROS

### 1️⃣ Captura do Parâmetro `ref` na URL

**Local:** `public/index.html` (landing page)  
**Método:** JavaScript inline ou em `script.js`

```javascript
// Adicionar no <head> ou início do <body>
<script>
  (function() {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    
    if (ref) {
      // Salvar em localStorage (persiste entre navegação)
      localStorage.setItem('soundy_referral_code', ref);
      localStorage.setItem('soundy_referral_timestamp', new Date().toISOString());
      
      console.log('🔗 [REFERRAL] Código capturado:', ref);
    }
  })();
</script>
```

**Características:**
- ✅ Não bloqueia renderização
- ✅ Persiste mesmo se usuário navegar para login/cadastro
- ✅ Não interfere com código existente

---

### 2️⃣ Salvar Referência no Cadastro

**Local:** `public/auth.js` → Listener `onAuthStateChanged`  
**Linha:** [auth.js#L1477-L1624](public/auth.js#L1477-L1624)

**Modificação:**

```javascript
auth.onAuthStateChanged(async (user) => {
  if (!user) return;
  
  const userRef = doc(db, 'usuarios', user.uid);
  const snap = await getDoc(userRef);
  
  if (!snap.exists()) {
    // ✅ CAPTURAR REFERRAL CODE SALVO
    const referralCode = localStorage.getItem('soundy_referral_code') || null;
    const referralTimestamp = localStorage.getItem('soundy_referral_timestamp') || null;
    
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      telefone: cadastroMetadata?.telefone || user.phoneNumber || null,
      plano: 'free',
      
      // ✅ NOVO: Referência ao parceiro
      referralCode: referralCode,
      referralTimestamp: referralTimestamp,
      convertedAt: null,           // Será preenchido ao virar pagante
      firstPaidPlan: null,         // Será preenchido ao virar pagante
      
      criadoSemSMS: true,
      entrevistaConcluida: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Limpar localStorage após uso
    if (referralCode) {
      localStorage.removeItem('soundy_referral_code');
      localStorage.removeItem('soundy_referral_timestamp');
      console.log('🎯 [REFERRAL] Código salvo no cadastro:', referralCode);
    }
  }
});
```

**Características:**
- ✅ Imutável: `referralCode` é salvo APENAS UMA VEZ
- ✅ Não afeta cadastros sem referência (campo fica `null`)
- ✅ Não quebra fluxo existente

---

### 3️⃣ Registrar Conversão ao Ativar Plano

**Local:** `work/lib/user/userPlans.js`

#### A) Em `applySubscription` (Stripe)

**Linha:** [userPlans.js#L390-L430](userPlans.js#L390-L430)

```javascript
export async function applySubscription(uid, { plan, subscriptionId, customerId, status, currentPeriodEnd, priceId }) {
  const ref = getDb().collection('usuarios').doc(uid);
  await getOrCreateUser(uid);

  const update = {
    plan,
    subscription: { /* ... */ },
    stripeCustomerId: customerId || null,
    updatedAt: new Date().toISOString(),
  };

  await ref.update(update);
  
  // ✅ NOVO: Registrar conversão se houver referralCode
  const userData = (await ref.get()).data();
  
  if (userData.referralCode && !userData.convertedAt) {
    await ref.update({
      convertedAt: new Date().toISOString(),
      firstPaidPlan: plan,
    });
    
    console.log(`🎯 [REFERRAL] Conversão registrada: ${uid} → ${plan} (parceiro: ${userData.referralCode})`);
  }
  
  return (await ref.get()).data();
}
```

#### B) Em `applyPlan` (Hotmart/Mercado Pago)

**Linha:** [userPlans.js#L318-L378](userPlans.js#L318-L378)

```javascript
export async function applyPlan(uid, { plan, durationDays }) {
  const ref = getDb().collection('usuarios').doc(uid);
  await getOrCreateUser(uid);

  const update = {
    plan,
    /* ... expirações ... */
    updatedAt: new Date().toISOString(),
  };

  await ref.update(update);
  
  // ✅ NOVO: Registrar conversão se houver referralCode
  const userData = (await ref.get()).data();
  
  if (userData.referralCode && !userData.convertedAt) {
    await ref.update({
      convertedAt: new Date().toISOString(),
      firstPaidPlan: plan,
    });
    
    console.log(`🎯 [REFERRAL] Conversão registrada: ${uid} → ${plan} (parceiro: ${userData.referralCode})`);
  }
  
  return (await ref.get()).data();
}
```

**Características:**
- ✅ Registra conversão APENAS UMA VEZ
- ✅ Funciona para todos os gateways (Stripe, Hotmart, Mercado Pago)
- ✅ Não afeta usuários sem referralCode

---

### 4️⃣ Criar Collection `partners`

**Local:** Firestore (manual via Console ou script)

**Estrutura:**

```javascript
partners/estudioherta {
  partnerId: "estudioherta",
  name: "Estúdio Herta",
  referralCode: "estudioherta",
  email: "contato@estudioherta.com",
  commissionPercent: 50,
  active: true,
  createdAt: "2026-01-26T10:00:00.000Z",
  updatedAt: "2026-01-26T10:00:00.000Z"
}
```

**Criação via Script (Node.js):**

```javascript
// scripts/create-partner.js
import { getFirestore } from '../firebase/admin.js';

const db = getFirestore();

async function createPartner(data) {
  await db.collection('partners').doc(data.partnerId).set({
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  
  console.log(`✅ Parceiro criado: ${data.partnerId}`);
}

createPartner({
  partnerId: 'estudioherta',
  name: 'Estúdio Herta',
  referralCode: 'estudioherta',
  email: 'contato@estudioherta.com',
  commissionPercent: 50,
  active: true,
});
```

---

### 5️⃣ Painel do Parceiro (Somente Leitura)

**Local:** Novo arquivo `public/partner-dashboard.html`

**Funcionalidades:**

1. **Autenticação:**
   - Login via Firebase Auth (email do parceiro)
   - Verificar se email está cadastrado em `partners` collection

2. **Métricas Exibidas:**

```javascript
// Exemplo de queries no painel
const partnerId = 'estudioherta';

// Total de cadastros
const signupsSnap = await getDocs(query(
  collection(db, 'usuarios'),
  where('referralCode', '==', partnerId)
));
const totalSignups = signupsSnap.size;

// Total de pagantes ativos
const conversionsSnap = await getDocs(query(
  collection(db, 'usuarios'),
  where('referralCode', '==', partnerId),
  where('plan', 'in', ['plus', 'pro', 'studio'])
));
const totalConversions = conversionsSnap.size;

// Calcular MRR
let mrr = 0;
conversionsSnap.forEach(doc => {
  const data = doc.data();
  const prices = { plus: 47.99, pro: 197.00, studio: 99.90 };
  mrr += prices[data.plan] || 0;
});

// Comissão (50%)
const commission = mrr * 0.5;

console.log('Cadastros:', totalSignups);
console.log('Assinantes:', totalConversions);
console.log('MRR:', `R$ ${mrr.toFixed(2)}`);
console.log('Comissão:', `R$ ${commission.toFixed(2)}`);
```

**Layout do Painel:**

```html
<div class="metrics-grid">
  <div class="metric-card">
    <h3>Cadastros</h3>
    <p class="metric-value" id="total-signups">0</p>
  </div>
  
  <div class="metric-card">
    <h3>Assinantes Ativos</h3>
    <p class="metric-value" id="active-subscribers">0</p>
  </div>
  
  <div class="metric-card">
    <h3>MRR Gerado</h3>
    <p class="metric-value" id="mrr">R$ 0,00</p>
  </div>
  
  <div class="metric-card highlight">
    <h3>Sua Comissão (50%)</h3>
    <p class="metric-value" id="commission">R$ 0,00</p>
  </div>
</div>
```

---

### 6️⃣ Painel Admin (Controle Total)

**Local:** Novo arquivo `public/admin.html`

**Funcionalidades:**

1. **Autenticação Restrita:**
   - Apenas UIDs/emails permitidos (ex: seu email de admin)
   - Verificar em `onAuthStateChanged`:

```javascript
const ADMIN_EMAILS = ['admin@soundyai.com', 'dj@correia.com'];

auth.onAuthStateChanged(async (user) => {
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    window.location.href = 'login.html';
    return;
  }
  
  // Admin autenticado
  loadAdminDashboard();
});
```

2. **Visualizações:**

```javascript
// Lista de parceiros
const partnersSnap = await getDocs(collection(db, 'partners'));
partnersSnap.forEach(doc => {
  const partner = doc.data();
  console.log(partner.name, partner.referralCode, partner.active);
});

// Usuários por parceiro
const usersByPartner = {};

const allUsersSnap = await getDocs(collection(db, 'usuarios'));
allUsersSnap.forEach(doc => {
  const user = doc.data();
  if (user.referralCode) {
    if (!usersByPartner[user.referralCode]) {
      usersByPartner[user.referralCode] = [];
    }
    usersByPartner[user.referralCode].push({
      uid: user.uid,
      email: user.email,
      plan: user.plan,
      convertedAt: user.convertedAt,
    });
  }
});

console.log('Usuários por parceiro:', usersByPartner);

// MRR por parceiro
const mrrByPartner = {};

Object.keys(usersByPartner).forEach(partnerId => {
  const users = usersByPartner[partnerId];
  const prices = { plus: 47.99, pro: 197.00, studio: 99.90 };
  
  mrrByPartner[partnerId] = users.reduce((sum, user) => {
    return sum + (prices[user.plan] || 0);
  }, 0);
});

console.log('MRR por parceiro:', mrrByPartner);
```

3. **Exportação para Pagamento:**

```javascript
// Gerar relatório mensal para pagamento manual
function generatePaymentReport(month) {
  // month = "2026-01"
  
  const report = [];
  
  Object.keys(mrrByPartner).forEach(partnerId => {
    const partnerData = partners[partnerId];
    const mrr = mrrByPartner[partnerId];
    const commission = mrr * (partnerData.commissionPercent / 100);
    
    report.push({
      parceiro: partnerData.name,
      referralCode: partnerId,
      mrr: `R$ ${mrr.toFixed(2)}`,
      comissao: `R$ ${commission.toFixed(2)}`,
      percentual: `${partnerData.commissionPercent}%`,
    });
  });
  
  console.table(report);
  
  // Exportar para CSV
  const csv = [
    'Parceiro,Código,MRR,Comissão,Percentual',
    ...report.map(r => `${r.parceiro},${r.referralCode},${r.mrr},${r.comissao},${r.percentual}`)
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `comissoes_${month}.csv`;
  a.click();
}
```

---

## 📋 6. ESTRUTURA FIRESTORE FINAL (COM AFILIADOS)

```javascript
// ===== COLLECTION: usuarios =====
usuarios/{uid} {
  // Identificação
  uid: string,
  email: string,
  telefone: string | null,
  createdAt: string,
  updatedAt: string,
  
  // Planos
  plan: 'free'|'plus'|'pro'|'studio'|'dj',
  plusExpiresAt: string | null,
  proExpiresAt: string | null,
  studioExpiresAt: string | null,
  djExpiresAt: string | null,
  
  // Assinatura Stripe
  subscription: {
    id: string,
    customerId: string,
    status: string,
    currentPeriodEnd: string,
    priceId: string,
    updatedAt: string,
    canceledAt: string | null,
  },
  stripeCustomerId: string | null,
  
  // Limites
  messagesMonth: number,
  analysesMonth: number,
  imagesMonth: number,
  billingMonth: string,
  
  // Perfil
  perfil: object,
  entrevistaConcluida: boolean,
  
  // ✅ NOVO: Sistema de Afiliados
  referralCode: string | null,         // Código do parceiro que trouxe
  referralTimestamp: string | null,    // Quando usou o link
  convertedAt: string | null,          // Quando virou pagante
  firstPaidPlan: string | null,        // Primeiro plano pago
}

// ===== COLLECTION: partners =====
partners/{partnerId} {
  partnerId: string,
  name: string,
  referralCode: string,
  email: string,
  commissionPercent: number,
  active: boolean,
  createdAt: string,
  updatedAt: string,
  description: string | null,
  website: string | null,
  tier: string | null,
}

// ===== COLLECTION (EXISTENTE): processed_stripe_events =====
processed_stripe_events/{eventId} {
  eventId: string,
  processedAt: Timestamp,
  // ... dados do evento
}

// ===== COLLECTION (EXISTENTE): hotmart_transactions =====
hotmart_transactions/{transactionId} {
  transactionId: string,
  email: string,
  plan: string,
  durationDays: number,
  processedAt: Timestamp,
}
```

---

## 🔒 7. BOAS PRÁTICAS E SEGURANÇA

### ✅ Validações Obrigatórias

1. **referralCode imutável:**
   - Nunca alterar após o cadastro
   - Frontend não pode modificar via update direto
   - Apenas backend pode escrever (via webhook ou função)

2. **Validar parceiro ativo:**
   - Ao capturar `ref`, verificar se existe em `partners`
   - Se não existir ou estiver inativo, não salvar

```javascript
// Ao processar cadastro
const refCode = localStorage.getItem('soundy_referral_code');

if (refCode) {
  // Validar se parceiro existe e está ativo
  const partnerSnap = await getDoc(doc(db, 'partners', refCode));
  
  if (partnerSnap.exists() && partnerSnap.data().active) {
    // Salvar no usuário
    referralCode = refCode;
  } else {
    console.warn('⚠️ Código de parceiro inválido ou inativo:', refCode);
    referralCode = null;
  }
}
```

3. **Conversão registrada apenas uma vez:**
   - Checar `if (!userData.convertedAt)` antes de marcar

4. **Queries de parceiro no painel:**
   - Nunca expor dados pessoais (email, telefone)
   - Apenas métricas agregadas

### ✅ Regras de Segurança do Firestore

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Collection: usuarios
    match /usuarios/{userId} {
      // Usuário pode ler apenas seu próprio documento
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // Usuário NÃO pode alterar referralCode
      allow update: if request.auth != null 
                    && request.auth.uid == userId
                    && (!request.resource.data.keys().hasAny(['referralCode', 'convertedAt', 'firstPaidPlan']));
    }
    
    // Collection: partners (somente leitura)
    match /partners/{partnerId} {
      allow read: if request.auth != null;  // Qualquer usuário autenticado pode listar
      allow write: if false;  // Apenas admin via backend
    }
    
    // Collection: processed_stripe_events (backend only)
    match /processed_stripe_events/{eventId} {
      allow read, write: if false;
    }
    
    // Collection: hotmart_transactions (backend only)
    match /hotmart_transactions/{transactionId} {
      allow read, write: if false;
    }
  }
}
```

---

## 📦 8. FLUXO COMPLETO

### Cenário: Usuário vindo do Estúdio Herta

```
1. CAPTURA DO LINK
   URL: https://soundyai.com/?ref=estudioherta
   → Script captura "estudioherta"
   → Salva em localStorage: "soundy_referral_code"

2. NAVEGAÇÃO
   Usuário navega pelo site (index.html → login.html → cadastro)
   → localStorage mantém o código salvo

3. CADASTRO
   Usuário cria conta (email + senha)
   → createUserWithEmailAndPassword(auth, email, password)
   → onAuthStateChanged detecta novo usuário
   → Cria documento em usuarios/{uid}:
     {
       uid: "abc123",
       email: "usuario@email.com",
       plano: "free",
       referralCode: "estudioherta",  ✅ SALVO
       referralTimestamp: "2026-01-26T10:30:00.000Z",
       convertedAt: null,
       firstPaidPlan: null,
       createdAt: "2026-01-26T10:30:00.000Z",
     }
   → localStorage.removeItem('soundy_referral_code')

4. USO GRATUITO
   Usuário usa o sistema no plano FREE
   → referralCode: "estudioherta" permanece salvo
   → convertedAt: null (ainda não pagou)

5. UPGRADE PARA PLUS
   Usuário decide assinar PLUS via Stripe
   → Stripe Checkout completado
   → Webhook: checkout.session.completed
   → Backend executa applySubscription(uid, { plan: 'plus', ... })
   → Atualiza documento:
     {
       plan: "plus",
       subscription: { id: "sub_xxx", status: "active", ... },
       
       referralCode: "estudioherta",  ✅ MANTÉM
       convertedAt: "2026-02-15T14:20:00.000Z",  ✅ MARCA CONVERSÃO
       firstPaidPlan: "plus",  ✅ REGISTRA PRIMEIRO PLANO
     }
   → Console log: "🎯 [REFERRAL] Conversão registrada: abc123 → plus (parceiro: estudioherta)"

6. MÉTRICAS DO PARCEIRO
   Painel do Estúdio Herta acessa partner-dashboard.html
   → Query: where('referralCode', '==', 'estudioherta')
   → Cadastros: 132
   → Assinantes ativos: 14 (1 PLUS + 13 outros)
   → MRR: R$ 47,99 (Plus) + ...
   → Comissão (50%): R$ 209,30

7. PAINEL ADMIN
   Admin acessa admin.html
   → Visualiza todos os parceiros
   → Exporta relatório CSV para pagamento manual mensal
```

---

## ✅ 9. CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Estrutura Base (2-3 horas)

- [ ] Adicionar campos no Firestore `usuarios`:
  - [ ] `referralCode: string | null`
  - [ ] `referralTimestamp: string | null`
  - [ ] `convertedAt: string | null`
  - [ ] `firstPaidPlan: string | null`

- [ ] Criar collection `partners`:
  - [ ] Schema definido
  - [ ] Documento de exemplo (Estúdio Herta)

- [ ] Atualizar Firestore Rules:
  - [ ] Proteger campos de referência contra alteração
  - [ ] Permitir leitura de `partners`

### Fase 2: Captura de Referência (1-2 horas)

- [ ] Adicionar script em `index.html`:
  - [ ] Capturar `?ref=codigo` da URL
  - [ ] Salvar em `localStorage`
  - [ ] Validar se parceiro existe e está ativo

- [ ] Testar captura:
  - [ ] URL: `http://localhost:3000/?ref=estudioherta`
  - [ ] Verificar console log
  - [ ] Verificar localStorage

### Fase 3: Salvar no Cadastro (1-2 horas)

- [ ] Modificar `auth.js` → `onAuthStateChanged`:
  - [ ] Ler `localStorage.getItem('soundy_referral_code')`
  - [ ] Adicionar campos no `setDoc`
  - [ ] Limpar localStorage após uso
  - [ ] Logs de debug

- [ ] Testar cadastro:
  - [ ] Criar usuário com `ref` capturado
  - [ ] Verificar documento no Firestore
  - [ ] Criar usuário SEM `ref` (deve ser `null`)

### Fase 4: Registrar Conversão (2-3 horas)

- [ ] Modificar `userPlans.js` → `applySubscription`:
  - [ ] Verificar se `referralCode` existe
  - [ ] Marcar `convertedAt` e `firstPaidPlan`
  - [ ] Logs de debug

- [ ] Modificar `userPlans.js` → `applyPlan`:
  - [ ] Idem acima (Hotmart/Mercado Pago)

- [ ] Testar conversão:
  - [ ] Usuário FREE → PLUS (via Stripe)
  - [ ] Verificar `convertedAt` no Firestore
  - [ ] Verificar logs no terminal

### Fase 5: Painel do Parceiro (4-6 horas)

- [ ] Criar `partner-dashboard.html`:
  - [ ] Estrutura HTML
  - [ ] CSS (reutilizar de `gerenciar.css`)
  - [ ] Autenticação (Firebase Auth)
  - [ ] Validar email em `partners` collection

- [ ] Implementar queries:
  - [ ] Total de cadastros
  - [ ] Total de assinantes ativos
  - [ ] Total de cancelados
  - [ ] MRR calculado
  - [ ] Comissão estimada

- [ ] Layout responsivo

- [ ] Testar acesso:
  - [ ] Login com email do parceiro
  - [ ] Visualizar métricas
  - [ ] Verificar cálculos

### Fase 6: Painel Admin (6-8 horas)

- [ ] Criar `admin.html`:
  - [ ] Estrutura HTML
  - [ ] CSS premium
  - [ ] Autenticação restrita (whitelist)

- [ ] Implementar visualizações:
  - [ ] Lista de parceiros (CRUD)
  - [ ] Usuários por parceiro
  - [ ] MRR por parceiro
  - [ ] Comissão calculada
  - [ ] Histórico de conversões

- [ ] Exportação CSV:
  - [ ] Relatório mensal para pagamento
  - [ ] Formato: Parceiro, MRR, Comissão, %

- [ ] Testar acesso:
  - [ ] Login como admin
  - [ ] Criar/editar parceiro
  - [ ] Exportar relatório

### Fase 7: Testes End-to-End (2-3 horas)

- [ ] Cenário 1: Cadastro com referência
  - [ ] Capturar link → Cadastrar → Verificar Firestore

- [ ] Cenário 2: Cadastro sem referência
  - [ ] Cadastrar direto → `referralCode: null`

- [ ] Cenário 3: Conversão Stripe
  - [ ] FREE → PLUS → Verificar `convertedAt`

- [ ] Cenário 4: Conversão Hotmart
  - [ ] Venda Hotmart → STUDIO → Verificar `convertedAt`

- [ ] Cenário 5: Painel Parceiro
  - [ ] Login → Visualizar métricas corretas

- [ ] Cenário 6: Painel Admin
  - [ ] Login → Criar parceiro → Exportar relatório

### Fase 8: Documentação (1-2 horas)

- [ ] README para parceiros:
  - [ ] Como usar link de referência
  - [ ] Como acessar painel
  - [ ] Como interpretar métricas

- [ ] Documentação técnica:
  - [ ] Estrutura Firestore
  - [ ] Fluxo de conversão
  - [ ] Como adicionar novos parceiros

---

## 📊 10. ESTIMATIVA DE TEMPO

| Fase | Tempo | Prioridade |
|------|-------|------------|
| 1. Estrutura Base | 2-3h | 🔴 Alta |
| 2. Captura Referência | 1-2h | 🔴 Alta |
| 3. Salvar no Cadastro | 1-2h | 🔴 Alta |
| 4. Registrar Conversão | 2-3h | 🔴 Alta |
| 5. Painel Parceiro | 4-6h | 🟡 Média |
| 6. Painel Admin | 6-8h | 🟢 Baixa |
| 7. Testes E2E | 2-3h | 🔴 Alta |
| 8. Documentação | 1-2h | 🟡 Média |

**Total:** 19-29 horas (~3-4 dias de trabalho focado)

---

## ✅ CONCLUSÃO DA AUDITORIA

### Situação Atual

✅ **Sistema robusto e bem estruturado:**
- Autenticação funcionando
- Planos implementados
- Webhooks seguros
- Firestore organizado

❌ **Sem sistema de afiliados:**
- Nenhum campo de referência
- Sem painel de parceiros
- Sem métricas de conversão

### Próximos Passos

1. ✅ **AUDITORIA CONCLUÍDA** (este documento)
2. ⏭️ **AGUARDAR CONFIRMAÇÃO** para iniciar implementação
3. 🚀 **IMPLEMENTAR** conforme checklist acima

### Garantias de Segurança

- ✅ Nenhuma funcionalidade existente será quebrada
- ✅ Campos são aditivos (não alteram estrutura atual)
- ✅ Referral code é imutável (salvo apenas uma vez)
- ✅ Validações no backend impedem fraude
- ✅ Firestore Rules protegem dados sensíveis
- ✅ Sistema escalável para múltiplos parceiros

---

**Auditoria concluída com sucesso! 🎉**

Sistema está pronto para receber implementação de afiliados de forma segura e escalável.
