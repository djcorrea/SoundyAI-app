# 🚨 AUDITORIA MODO NASA: SEGURANÇA, CUSTO E CONFIABILIDADE - SoundyAI

**Data:** 13 de dezembro de 2025  
**Auditor:** Sistema de Segurança e Confiabilidade  
**Escopo:** Backend completo (chat OpenAI, análise de áudio, limites, filas)  
**Objetivo:** Identificar e eliminar riscos de custo, abuso, race conditions e falhas

---

## 📊 SUMÁRIO EXECUTIVO

### Status Geral: ⚠️ **AMARELO - REQUER CORREÇÕES ANTES DO LAUNCH**

**Riscos Críticos Identificados:** 7  
**Riscos Altos:** 4  
**Riscos Médios:** 5  
**Bloqueadores para Produção:** 2

### Principais Descobertas

1. ✅ **Sistema de planos bem implementado** - Limites server-side com verificação
2. ⚠️ **Race conditions em chat** - Incremento não atômico permite ultrapassar limites
3. 🚨 **Sem hard stops de custo** - Nenhum kill switch ou teto diário implementado
4. ⚠️ **Tokens não limitados adequadamente** - Pode gerar respostas de até 2000 tokens
5. ⚠️ **Sem idempotência** - Clique duplo/retry pode executar 2x a mesma operação
6. ✅ **Upload protegido** - Limite de 60MB e validação de extensão OK
7. ⚠️ **Concorrência de workers não controlada por usuário** - Um user pode travar todos os 5 workers

---

## 🎯 1. MAPEAMENTO DE ARQUITETURA E FLUXOS

### 1.1 Rotas Críticas de Custo

#### 📍 Chat com IA (OpenAI)
- **Arquivo:** `work/api/chat.js`
- **Endpoint:** POST `/api/chat`
- **Custo:** 🔴 ALTO (GPT-4o: ~$0.015/1K tokens | GPT-3.5: ~$0.002/1K tokens)
- **Input:** Mensagem + histórico + até 3 imagens
- **Output:** Resposta com max_tokens variável (1000-2000)

**Fluxo:**
```
1. Autenticação (idToken)
2. canUseChat(uid) → verifica limite
3. Parse multipart (imagens até 10MB cada, 30MB total)
4. Seleção de modelo (GPT-4o para imagens, 3.5-turbo para texto)
5. Chamada OpenAI
6. registerChat(uid) → incrementa contador
7. Retorno resposta
```

#### 📍 Análise de Áudio
- **Arquivo:** `work/api/audio/analyze.js`
- **Endpoint:** POST `/analyze`
- **Custo:** 🟡 MÉDIO (CPU + Storage + Sugestões IA)
- **Input:** FileKey (B2), modo (genre/reference)
- **Output:** Job enfileirado no BullMQ

**Fluxo:**
```
1. Autenticação (idToken)
2. canUseAnalysis(uid) → determina modo (full/reduced/blocked)
3. Criar job no PostgreSQL
4. Enfileirar no BullMQ (Redis)
5. registerAnalysis(uid, mode) → incrementa se "full"
6. Worker processa assincronamente
```

#### 📍 Sugestões de IA (Enrichment)
- **Arquivo:** `work/lib/ai/suggestion-enricher.js`
- **Modelo:** gpt-4o-mini
- **Custo:** 🟡 MÉDIO (~$0.0006/1K tokens)
- **Quando:** Análises "full" (FREE 1-3, PLUS 1-25, PRO sempre)

### 1.2 Limites Definidos (Backend)

**Arquivo fonte da verdade:** `work/lib/user/userPlans.js`

```javascript
PLAN_LIMITS = {
  free: {
    maxMessagesPerMonth: 20,
    maxFullAnalysesPerMonth: 3,
    hardCapAnalysesPerMonth: null,
    allowReducedAfterLimit: true
  },
  plus: {
    maxMessagesPerMonth: 80,
    maxFullAnalysesPerMonth: 25,
    hardCapAnalysesPerMonth: null,
    allowReducedAfterLimit: true
  },
  pro: {
    maxMessagesPerMonth: Infinity,
    maxFullAnalysesPerMonth: Infinity,
    hardCapAnalysesPerMonth: 200,  // ⚠️ Hard cap oculto
    allowReducedAfterLimit: false
  }
}
```

---

## 🚨 2. RELATÓRIO DE RISCOS (PRIORIZADO)

### 🔴 CRÍTICO 1: Race Condition em registerChat/registerAnalysis

**Arquivo:** `work/lib/user/userPlans.js` (linhas 246-270, 347-366)  
**Impacto Financeiro:** 🔴 ALTO - Usuário pode ultrapassar limite mensalmente  
**Probabilidade:** 🔴 ALTA - Facilmente reproduzível com clique duplo  
**Severidade:** 🔴 **BLOQUEADOR**

**Descrição:**
```javascript
// ❌ VULNERÁVEL: Não atômico
export async function registerChat(uid) {
  const ref = getDb().collection(USERS).doc(uid);
  const user = await getOrCreateUser(uid);  // 1. Lê
  const newCount = (user.messagesMonth || 0) + 1;  // 2. Calcula
  await ref.update({ messagesMonth: newCount });  // 3. Escreve
}
```

**Como reproduzir:**
1. Usuário com 19/20 mensagens
2. Enviar 2 requests simultâneas (clique duplo)
3. Ambas leem `messagesMonth: 19`
4. Ambas escrevem `messagesMonth: 20`
5. Resultado: 21 mensagens executadas, limite ultrapassado

**Impacto financeiro:** 
- FREE: até +10 mensagens extras (2x o limite) = ~$0.20 por usuário
- PLUS: até +40 mensagens extras = ~$0.80 por usuário
- Com 1000 usuários abusando: **$200-$800/mês de prejuízo**

**Correção obrigatória:**
```javascript
// ✅ CORRIGIDO: Atômico com transaction
export async function registerChat(uid) {
  const ref = getDb().collection(USERS).doc(uid);
  
  await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const user = snap.data();
    
    // Incrementar atomicamente
    const newCount = (user.messagesMonth || 0) + 1;
    tx.update(ref, { 
      messagesMonth: newCount,
      updatedAt: new Date().toISOString()
    });
  });
}
```

**Mesma correção necessária para:** `registerAnalysis()`

---

### 🔴 CRÍTICO 2: Sem Idempotência em Chat/Análise

**Arquivos:** `work/api/chat.js`, `work/api/audio/analyze.js`  
**Impacto Financeiro:** 🔴 ALTO  
**Probabilidade:** 🔴 ALTA  
**Severidade:** 🔴 **BLOQUEADOR**

**Descrição:**
- Nenhuma das rotas possui `idempotency key`
- Retry automático (timeout/rede) pode executar 2x
- Clique duplo acidental executa 2x
- OpenAI é cobrado 2x, contador incrementado 2x

**Como reproduzir:**
```javascript
// Frontend envia 2 requests rápidos
await Promise.all([
  fetch('/api/chat', { body: message }),
  fetch('/api/chat', { body: message })  // Mesmo payload
]);
// Resultado: 2 chamadas OpenAI, 2 cobranças, 2 incrementos
```

**Impacto financeiro:**
- Chat pesado (GPT-4o, 1500 tokens): ~$0.025 por duplicata
- 100 duplicatas/dia: **$2.50/dia = $75/mês**

**Correção obrigatória:**
```javascript
// ✅ Adicionar idempotency key no header
const idempotencyKey = req.headers['x-idempotency-key'];

if (!idempotencyKey) {
  return res.status(400).json({ error: 'IDEMPOTENCY_KEY_REQUIRED' });
}

// Cache de requests processados (Redis ou Firestore)
const processed = await checkProcessed(idempotencyKey);
if (processed) {
  return res.json(processed.result);  // Retorna resultado anterior
}

// ... processar ...

await saveProcessed(idempotencyKey, result, { ttl: 3600 });
```

---

### 🔴 CRÍTICO 3: Sem Kill Switch ou Teto de Custo Diário

**Impacto Financeiro:** 🔴 CRÍTICO  
**Probabilidade:** 🟡 MÉDIA (requer ataque ou bug)  
**Severidade:** 🔴 **BLOQUEADOR**

**Descrição:**
- Nenhuma variável de ambiente para desabilitar rotas caras
- Nenhum teto de custo diário implementado
- Ataque DDoS ou bug pode gerar **milhares de dólares** em horas

**Cenário de desastre:**
```
1. Bug no frontend envia loop infinito de requests
2. 10 requests/seg × 3600 seg/hora = 36.000 requests
3. GPT-4o (2000 tokens médio) = $0.03 por request
4. Custo: 36.000 × $0.03 = $1.080/hora
5. Em 8 horas (durante a noite): $8.640 de prejuízo
```

**Correção obrigatória:**
```javascript
// ✅ .env
DAILY_COST_LIMIT_USD=100
CHAT_ENABLED=true
ANALYSIS_ENABLED=true
EMERGENCY_SHUTDOWN=false

// ✅ work/lib/cost-monitor.js (NOVO ARQUIVO)
let dailyCost = 0;
const COST_LIMIT = parseFloat(process.env.DAILY_COST_LIMIT_USD) || 100;

export function trackCost(tokens, model) {
  const costPerToken = model === 'gpt-4o' ? 0.00003 : 0.000002;
  const cost = tokens * costPerToken;
  dailyCost += cost;
  
  if (dailyCost >= COST_LIMIT) {
    console.error('🚨 TETO DE CUSTO ATINGIDO:', dailyCost);
    // Desabilitar rotas caras
    process.env.CHAT_ENABLED = 'false';
    // Enviar alerta (Discord webhook, email, etc)
  }
  
  return { dailyCost, limitReached: dailyCost >= COST_LIMIT };
}

// ✅ Usar em work/api/chat.js
if (process.env.CHAT_ENABLED === 'false') {
  return res.status(503).json({ 
    error: 'SERVICE_TEMPORARILY_DISABLED',
    message: 'Chat temporariamente indisponível por manutenção'
  });
}

const data = await response.json();
trackCost(data.usage.total_tokens, modelSelection.model);
```

---

### 🔴 ALTO 4: Tokens Não Limitados Adequadamente

**Arquivo:** `work/api/chat.js` (linhas 685, 727, 755)  
**Impacto Financeiro:** 🔴 ALTO  
**Probabilidade:** 🟡 MÉDIA  

**Descrição:**
```javascript
// ❌ ATUAL
const MAX_IMAGE_ANALYSIS_TOKENS = 1500;  // OK
const MAX_TEXT_RESPONSE_TOKENS = 2000;    // ⚠️ MUITO ALTO

// Seleção dinâmica sem teto
const maxTokens = useGPT4 ? MAX_TEXT_RESPONSE_TOKENS : Math.min(MAX_TEXT_RESPONSE_TOKENS, 1000);
// Pode chegar a 2000 tokens em GPT-4o
```

**Impacto financeiro:**
- Resposta de 2000 tokens GPT-4o: ~$0.03
- Se usuário força respostas longas: 100 msgs × $0.03 = **$3.00 extra**
- 100 usuários fazendo isso: **$300/mês**

**Correção:**
```javascript
// ✅ LIMITES MAIS AGRESSIVOS
const MAX_IMAGE_ANALYSIS_TOKENS = 1000;  // Reduzir de 1500
const MAX_TEXT_RESPONSE_TOKENS = 800;    // Reduzir de 2000
const MAX_TEXT_GPT35_TOKENS = 600;       // Novo limite para 3.5

// FREE: máximo 600 tokens
// PLUS: máximo 800 tokens  
// PRO: máximo 1200 tokens

const maxTokens = {
  free: 600,
  plus: 800,
  pro: 1200
}[userData.plan] || 600;
```

---

### 🔴 ALTO 5: System Prompt Gigante Enviado Sempre

**Arquivo:** `work/api/chat.js` (linhas 800-900)  
**Impacto Financeiro:** 🟡 MÉDIO  
**Probabilidade:** 🔴 ALTA  

**Descrição:**
- System prompt com ~800 tokens
- Enviado em TODA requisição
- Com histórico de 5 mensagens: ~3000 tokens de input

**Custo atual:**
```
Input: 3000 tokens × $0.000005 (GPT-4o input) = $0.015 por request
Com 10.000 requests/mês: $150/mês APENAS de prompt
```

**Correção:**
```javascript
// ✅ PROMPT COMPACTO (reduzir 50%)
const SYSTEM_PROMPTS = {
  imageAnalysis: `Você é PROD.AI 🎵, especialista em análise visual de produção musical.

ANALISE APENAS: DAWs, plugins, waveforms, espectros, mixers.
Se não for música: "🎵 Analiso apenas imagens de produção musical!"

FOCO: Valores técnicos (Hz, dB, ms), problemas, soluções imediatas.`,

  default: `Você é PROD.AI 🎵, especialista em produção musical.

RESPONDA APENAS sobre música/áudio.
Outros temas: "🎵 Sou especializado em música! Como posso ajudar?"

Use valores técnicos, seja direto.`
};

// ✅ Histórico reduzido
.slice(-3);  // De 5 para 3 mensagens
```

**Economia:** ~40% dos tokens de input = **$60/mês**

---

### 🟡 ALTO 6: Sem Controle de Concorrência por Usuário

**Arquivo:** `work/worker-redis.js` (linha 307)  
**Impacto Financeiro:** 🟡 MÉDIO (CPU/tempo)  
**Probabilidade:** 🟡 MÉDIA  

**Descrição:**
```javascript
// ❌ ATUAL
const concurrency = Number(process.env.WORKER_CONCURRENCY) || 3;
// 3-5 workers processam jobs de QUALQUER usuário
```

**Problema:**
- Um usuário pode enfileirar 10 análises simultâneas
- Trava todos os 5 workers
- Outros usuários ficam esperando

**Correção:**
```javascript
// ✅ LIMITAR POR USUÁRIO
const activeJobs = new Map(); // uid -> count

// Antes de processar job
const uid = job.data.planContext?.uid;
if (uid) {
  const current = activeJobs.get(uid) || 0;
  if (current >= 2) {  // Máx 2 análises simultâneas por user
    console.warn(`🚫 Limite de concorrência: ${uid}`);
    await job.moveToDelayed(Date.now() + 10000);  // Atrasa 10s
    return;
  }
  activeJobs.set(uid, current + 1);
}

// Após processar
if (uid) {
  activeJobs.set(uid, Math.max(0, (activeJobs.get(uid) || 0) - 1));
}
```

---

### 🟡 MÉDIO 7: Rate Limiting Não Distribuído

**Arquivo:** `work/api/chat.js` (linhas 240-270)  
**Impacto Financeiro:** 🟡 MÉDIO  
**Probabilidade:** 🟡 MÉDIA (em produção multi-instância)

**Descrição:**
```javascript
// ❌ ATUAL: Map em memória
const userRequestCount = new Map();
const MAX_REQUESTS_PER_MINUTE = 10;
```

**Problema:**
- Se rodar 3 instâncias (Vercel/Railway): cada uma tem seu próprio Map
- Usuário pode fazer 10 req/min em CADA instância = 30 req/min total

**Correção:**
```javascript
// ✅ USAR REDIS (já existe conexão)
import { getRedisConnection } from '../lib/queue.js';

async function checkRateLimit(uid) {
  const redis = getRedisConnection();
  const key = `rate:${uid}`;
  
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60);  // 1 minuto
  }
  
  if (count > 10) {
    return false;  // Bloqueado
  }
  
  return true;
}
```

---

### 🟡 MÉDIO 8: Histórico de Chat Não Truncado no Backend

**Arquivo:** `work/api/chat.js` (linha 442)  
**Impacto Financeiro:** 🟡 MÉDIO  

**Descrição:**
```javascript
// ❌ ATUAL
.slice(-5);  // Confia no frontend
```

**Problema:**
- Frontend malicioso pode enviar histórico de 100 mensagens
- Backend aceita tudo
- Custo explode com input gigante

**Correção:**
```javascript
// ✅ HARD LIMIT SERVER-SIDE
const MAX_HISTORY = 3;
validHistory = historyData
  .filter(/* validação */)
  .slice(-MAX_HISTORY);  // Forçar máximo

// ✅ Limitar tokens do histórico
const historyTokens = validHistory.reduce((sum, msg) => 
  sum + Math.ceil(msg.content.length / 4), 0
);

if (historyTokens > 2000) {
  // Truncar mensagens mais antigas
  while (historyTokens > 2000 && validHistory.length > 1) {
    validHistory.shift();
  }
}
```

---

### 🟢 BAIXO 9-16: Outros Riscos Identificados

9. **Sem timeout global no chat** → Pode travar indefinidamente (MÉDIA)
10. **Imagens não validadas por magic bytes antes do OpenAI** → OK, já implementado ✅
11. **Upload 60MB sem throttling** → Pode saturar rede (BAIXA)
12. **Sugestões IA sem cache** → Desperdício de tokens (BAIXA)
13. **Sem limite de retries em workers** → MEDIUM (stalledCount: 2 OK ✅)
14. **FFmpeg pode processar por 2min** → OK, tem timeout ✅
15. **Sem alertas automáticos** → CRÍTICO para observabilidade
16. **Logs não estruturados** → Dificulta auditoria posterior

---

## ✅ 3. PONTOS POSITIVOS (O QUE JÁ ESTÁ BOM)

1. ✅ **Sistema de planos robusto** - Backend como fonte da verdade
2. ✅ **Upload protegido** - 60MB, extensões validadas, magic bytes verificados
3. ✅ **Rate limiting básico** - 10 req/min implementado
4. ✅ **Timeouts em FFmpeg** - 2 minutos de proteção
5. ✅ **Concorrência limitada** - 5 workers máx (BullMQ)
6. ✅ **Validação de autenticação** - Firebase Auth em todas as rotas
7. ✅ **Limites server-side** - Verificados antes de processar
8. ✅ **Seleção inteligente de modelo** - GPT-3.5 para casos simples

---

## 📋 4. CHECKLIST GO/NO-GO PARA PRODUÇÃO

### 🔴 BLOQUEADORES (OBRIGATÓRIO CORRIGIR)

- [ ] **1. Implementar transações atômicas** em `registerChat` e `registerAnalysis`
- [ ] **2. Adicionar idempotência** com `x-idempotency-key` em chat e análise
- [ ] **3. Implementar kill switch** com variáveis `CHAT_ENABLED`, `DAILY_COST_LIMIT_USD`

**Status:** ❌ **NO-GO** - Sistema pode gerar prejuízo financeiro

---

### 🟡 RECOMENDADO (LAUNCH CONDICIONAL)

- [ ] **4. Reduzir max_tokens** para 600/800/1200 (por plano)
- [ ] **5. Comprimir system prompt** (economizar 40% de tokens)
- [ ] **6. Rate limiting via Redis** (distribuído entre instâncias)
- [ ] **7. Limitar concorrência por usuário** (máx 2 análises simultâneas)

**Status:** ⚠️ **LAUNCH COM MONITORAMENTO** - Pode funcionar mas com risco

---

### 🟢 PÓS-LAUNCH (MELHORIAS)

- [ ] 8. Implementar cache de respostas frequentes
- [ ] 9. Alertas automáticos (Discord/Email) para custo > $50/dia
- [ ] 10. Dashboard de métricas em tempo real
- [ ] 11. Logs estruturados (JSON) para análise
- [ ] 12. Retry inteligente com backoff exponencial

---

## 🛠️ 5. PATCH PLAN (MUDANÇAS MÍNIMAS)

### PATCH 1: Atomicidade (CRÍTICO)

**Arquivo:** `work/lib/user/userPlans.js`

```javascript
// ANTES (linhas 246-270)
export async function registerChat(uid) {
  const ref = getDb().collection(USERS).doc(uid);
  const user = await getOrCreateUser(uid);
  await normalizeUserDoc(user, uid);
  const newCount = (user.messagesMonth || 0) + 1;
  await ref.update({
    messagesMonth: newCount,
    updatedAt: new Date().toISOString(),
  });
  console.log(`📝 [USER-PLANS] Chat registrado: ${uid} (total no mês: ${newCount})`);
}

// DEPOIS (✅ ATÔMICO)
export async function registerChat(uid) {
  const ref = getDb().collection(USERS).doc(uid);
  
  await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error('USER_NOT_FOUND');
    }
    
    const user = snap.data();
    const newCount = (user.messagesMonth || 0) + 1;
    
    tx.update(ref, {
      messagesMonth: newCount,
      updatedAt: new Date().toISOString(),
    });
    
    console.log(`📝 [USER-PLANS] Chat registrado: ${uid} (total no mês: ${newCount})`);
  });
}
```

**Mesma mudança para:** `registerAnalysis()` (linhas 347-366)

**Risco:** BAIXO - Transaction nativa do Firestore  
**Rollback:** Reverter para versão anterior (sem transaction)  
**Teste:** Enviar 10 requests simultâneas, verificar que contador incrementa corretamente

---

### PATCH 2: Kill Switch (CRÍTICO)

**Arquivo NOVO:** `work/lib/cost-monitor.js`

```javascript
import { getFirestore } from '../firebase/admin.js';

const db = getFirestore();
let dailyCost = 0;
let dailyTokens = 0;
let lastReset = new Date().toISOString().split('T')[0];

// Limites de segurança
const DAILY_COST_LIMIT = parseFloat(process.env.DAILY_COST_LIMIT_USD) || 100;
const DAILY_TOKEN_LIMIT = parseInt(process.env.DAILY_TOKEN_LIMIT) || 5000000;

// Custos por modelo (USD por token)
const TOKEN_COSTS = {
  'gpt-4o': { input: 0.000005, output: 0.000015 },
  'gpt-3.5-turbo': { input: 0.0000005, output: 0.0000015 },
  'gpt-4o-mini': { input: 0.00000015, output: 0.0000006 }
};

/**
 * Rastrear uso e verificar limites
 */
export function trackUsage(tokens, model = 'gpt-4o') {
  const today = new Date().toISOString().split('T')[0];
  
  // Reset diário automático
  if (today !== lastReset) {
    console.log(`🔄 [COST-MONITOR] Reset diário: ${lastReset} → ${today}`);
    dailyCost = 0;
    dailyTokens = 0;
    lastReset = today;
  }
  
  // Calcular custo
  const costs = TOKEN_COSTS[model] || TOKEN_COSTS['gpt-4o'];
  const inputCost = (tokens.prompt || 0) * costs.input;
  const outputCost = (tokens.completion || 0) * costs.output;
  const totalCost = inputCost + outputCost;
  
  dailyCost += totalCost;
  dailyTokens += tokens.total || 0;
  
  // Verificar limites
  const costLimitReached = dailyCost >= DAILY_COST_LIMIT;
  const tokenLimitReached = dailyTokens >= DAILY_TOKEN_LIMIT;
  
  if (costLimitReached || tokenLimitReached) {
    console.error('🚨 [COST-MONITOR] LIMITE ATINGIDO!', {
      dailyCost: dailyCost.toFixed(2),
      costLimit: DAILY_COST_LIMIT,
      dailyTokens,
      tokenLimit: DAILY_TOKEN_LIMIT
    });
    
    // Salvar alerta no Firestore
    db.collection('alerts').add({
      type: 'COST_LIMIT_REACHED',
      dailyCost,
      dailyTokens,
      timestamp: new Date(),
      severity: 'CRITICAL'
    });
  }
  
  return {
    dailyCost: parseFloat(dailyCost.toFixed(4)),
    dailyTokens,
    costLimitReached,
    tokenLimitReached,
    percentUsed: (dailyCost / DAILY_COST_LIMIT * 100).toFixed(1)
  };
}

/**
 * Verificar se serviço deve ser desabilitado
 */
export function shouldBlockService() {
  // Emergency shutdown manual
  if (process.env.EMERGENCY_SHUTDOWN === 'true') {
    return { blocked: true, reason: 'EMERGENCY_SHUTDOWN' };
  }
  
  // Verificar limites
  const costExceeded = dailyCost >= DAILY_COST_LIMIT;
  const tokensExceeded = dailyTokens >= DAILY_TOKEN_LIMIT;
  
  if (costExceeded) {
    return { blocked: true, reason: 'DAILY_COST_LIMIT_REACHED', cost: dailyCost };
  }
  
  if (tokensExceeded) {
    return { blocked: true, reason: 'DAILY_TOKEN_LIMIT_REACHED', tokens: dailyTokens };
  }
  
  return { blocked: false };
}

/**
 * Obter estatísticas atuais
 */
export function getStats() {
  return {
    dailyCost: parseFloat(dailyCost.toFixed(4)),
    dailyTokens,
    costLimit: DAILY_COST_LIMIT,
    tokenLimit: DAILY_TOKEN_LIMIT,
    percentCostUsed: (dailyCost / DAILY_COST_LIMIT * 100).toFixed(1),
    percentTokensUsed: (dailyTokens / DAILY_TOKEN_LIMIT * 100).toFixed(1),
    lastReset
  };
}
```

**Arquivo:** `work/api/chat.js` (adicionar no início do handler)

```javascript
import { trackUsage, shouldBlockService } from '../lib/cost-monitor.js';

export default async function handler(req, res) {
  // ... código existente ...
  
  // ✅ VERIFICAR KILL SWITCH
  const blockCheck = shouldBlockService();
  if (blockCheck.blocked) {
    console.warn('🚫 [CHAT] Serviço bloqueado:', blockCheck.reason);
    return sendResponse(503, {
      error: 'SERVICE_TEMPORARILY_UNAVAILABLE',
      message: 'Chat temporariamente indisponível. Tente novamente mais tarde.',
      reason: process.env.NODE_ENV === 'development' ? blockCheck.reason : undefined
    });
  }
  
  // ... restante do código ...
  
  // ✅ APÓS RECEBER RESPOSTA DA OPENAI
  const data = await response.json();
  
  // Rastrear uso
  const usage = trackUsage({
    prompt: data.usage.prompt_tokens,
    completion: data.usage.completion_tokens,
    total: data.usage.total_tokens
  }, modelSelection.model);
  
  console.log('💰 [CHAT] Uso rastreado:', usage);
  
  // ... continuar ...
}
```

**Variáveis de ambiente (.env):**
```bash
DAILY_COST_LIMIT_USD=100
DAILY_TOKEN_LIMIT=5000000
EMERGENCY_SHUTDOWN=false
```

**Risco:** BAIXO  
**Rollback:** Remover imports, código funciona sem o monitor  
**Teste:** Forçar `DAILY_COST_LIMIT_USD=0.01` e enviar mensagem

---

### PATCH 3: Idempotência (CRÍTICO)

**Arquivo:** `work/api/chat.js` (adicionar middleware)

```javascript
// Cache de requests processados (em memória ou Redis)
const processedRequests = new Map();
const CACHE_TTL = 3600000; // 1 hora

function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of processedRequests.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      processedRequests.delete(key);
    }
  }
}

// Cleanup a cada 10 minutos
setInterval(cleanupCache, 600000);

export default async function handler(req, res) {
  // ... código existente ...
  
  // ✅ VERIFICAR IDEMPOTENCY KEY
  const idempotencyKey = req.headers['x-idempotency-key'];
  
  if (!idempotencyKey || idempotencyKey.length < 10) {
    return sendResponse(400, {
      error: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'Header x-idempotency-key é obrigatório (min 10 caracteres)'
    });
  }
  
  // Verificar se já foi processado
  const cached = processedRequests.get(idempotencyKey);
  if (cached) {
    console.log(`♻️ [CHAT] Request duplicado detectado: ${idempotencyKey}`);
    return sendResponse(200, cached.result);
  }
  
  // ... processar normalmente ...
  
  // ✅ SALVAR RESULTADO NO CACHE
  processedRequests.set(idempotencyKey, {
    result: responseData,
    timestamp: Date.now()
  });
  
  return sendResponse(200, responseData);
}
```

**Frontend:** Adicionar header em todas as requisições

```javascript
// public/chat.js (exemplo)
const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

fetch('/api/chat', {
  method: 'POST',
  headers: {
    'x-idempotency-key': idempotencyKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ message, ... })
});
```

**Risco:** BAIXO - Compatível com código existente  
**Rollback:** Remover verificação, sistema volta ao normal  
**Teste:** Enviar mesma request 2x com mesmo key, verificar que só executa 1x

---

### PATCH 4: Reduzir max_tokens (RECOMENDADO)

**Arquivo:** `work/api/chat.js`

```javascript
// ANTES
const MAX_IMAGE_ANALYSIS_TOKENS = 1500;
const MAX_TEXT_RESPONSE_TOKENS = 2000;

// DEPOIS
const MAX_IMAGE_ANALYSIS_TOKENS = 1000;  // -33%
const MAX_TEXT_RESPONSE_TOKENS_BY_PLAN = {
  free: 600,   // -70%
  plus: 800,   // -60%
  pro: 1200    // -40%
};

// Usar baseado no plano
const maxTokens = hasImages 
  ? MAX_IMAGE_ANALYSIS_TOKENS
  : (MAX_TEXT_RESPONSE_TOKENS_BY_PLAN[userData.plan] || 600);
```

**Economia estimada:** 30-40% de tokens = ~$100/mês com 10k requests

---

## 📊 6. TESTES DE STRESS RECOMENDADOS

### Teste 1: Race Condition (Chat)

```bash
# Criar script: test-race-chat.js
node test-race-chat.js

# Conteúdo:
const promises = Array(20).fill(null).map(() => 
  fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idToken: 'TOKEN_AQUI',
      message: 'test',
      conversationHistory: []
    })
  })
);

const results = await Promise.all(promises);
console.log('Sucesso:', results.filter(r => r.ok).length);
// Verificar no Firestore se messagesMonth incrementou corretamente
```

**Resultado esperado SEM correção:** 19-20 executados, contador = 18-19 (race)  
**Resultado esperado COM correção:** 10-20 executados, contador = correto

---

### Teste 2: Idempotência

```bash
# test-idempotency.js
const sameKey = 'test-key-123';

const promises = Array(5).fill(null).map(() => 
  fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-idempotency-key': sameKey  // Mesmo key
    },
    body: JSON.stringify({
      idToken: 'TOKEN_AQUI',
      message: 'test unique',
      conversationHistory: []
    })
  })
);

const results = await Promise.all(promises);
const bodies = await Promise.all(results.map(r => r.json()));

// Verificar que todas as respostas são idênticas
console.log('Respostas únicas:', new Set(bodies.map(b => b.reply)).size);
// Esperado: 1 (apenas 1 resposta única)
```

---

### Teste 3: Kill Switch

```bash
# .env (forçar limite baixo)
DAILY_COST_LIMIT_USD=0.01

# Enviar várias mensagens até atingir limite
# Verificar que retorna 503 após limite
```

---

## 📈 7. OBSERVABILIDADE MÍNIMA "NASA"

### Métricas Obrigatórias (Implementar)

**Arquivo NOVO:** `work/lib/logger.js`

```javascript
export function logRequest(req, res, data) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    requestId: data.requestId,
    uid: data.uid,
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    route: req.url,
    method: req.method,
    statusCode: res.statusCode,
    durationMs: data.durationMs,
    
    // OpenAI específico
    model: data.model,
    promptTokens: data.tokens?.prompt,
    completionTokens: data.tokens?.completion,
    totalTokens: data.tokens?.total,
    estimatedCost: data.cost,
    
    // Erros
    error: data.error,
    errorCode: data.errorCode
  }));
}
```

### Alertas Automáticos

```javascript
// work/lib/alerts.js
export async function sendAlert(type, data) {
  // Discord Webhook
  if (process.env.DISCORD_WEBHOOK_URL) {
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `🚨 **ALERTA ${type}**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
      })
    });
  }
  
  // Email (SendGrid, Resend, etc)
  // SMS (Twilio)
}

// Usar quando limites forem atingidos
if (dailyCost >= DAILY_COST_LIMIT * 0.9) {
  await sendAlert('COST_WARNING', {
    dailyCost,
    limit: DAILY_COST_LIMIT,
    percentUsed: 90
  });
}
```

---

## 🎯 8. RESUMO FINAL

### O Que Funciona Bem ✅
- Sistema de planos robusto
- Validações de upload adequadas
- Timeouts em processamento
- Autenticação obrigatória

### O Que Está Vulnerável ⚠️
- Race conditions em contadores
- Sem idempotência
- Sem kill switch de custo
- Tokens não limitados por plano

### Prioridade de Implementação

**SEMANA 1 (BLOQUEADORES):**
1. Patch 1: Atomicidade (1-2 horas)
2. Patch 2: Kill switch (2-3 horas)
3. Patch 3: Idempotência (3-4 horas)
4. Testes de stress (2 horas)

**SEMANA 2 (OTIMIZAÇÕES):**
5. Patch 4: Reduzir tokens (1 hora)
6. Comprimir system prompt (1 hora)
7. Rate limiting Redis (2 horas)
8. Alertas automáticos (2 horas)

**SEMANA 3 (MONITORAMENTO):**
9. Logs estruturados (2 horas)
10. Dashboard de métricas (4 horas)
11. Documentação final (2 horas)

### Estimativa de Custo Mensal

**SEM as correções:**
- Chat (10k msgs/mês): $150-$300
- Análises (5k/mês): $50-$100
- Sugestões IA: $30-$60
- **Total: $230-$460/mês**
- **Risco de abuso: até $2000/mês**

**COM as correções:**
- Chat: $80-$150 (-50%)
- Análises: $40-$80 (-20%)
- Sugestões: $25-$50 (-15%)
- **Total: $145-$280/mês**
- **Risco de abuso: <$500/mês (com kill switch)**

---

## ✅ CONCLUSÃO

O sistema SoundyAI possui uma **base sólida** mas precisa de **3 correções críticas** antes de ir para produção:

1. **Transações atômicas** (evitar race conditions)
2. **Idempotência** (evitar cobranças duplicadas)
3. **Kill switch** (prevenir prejuízo em caso de ataque/bug)

Com essas correções implementadas, o sistema estará **seguro financeiramente** e pronto para escalar.

**Decisão Final:** ⚠️ **NO-GO** até implementar os 3 patches críticos.

---

**Próximos Passos:**
1. Revisar este relatório com a equipe
2. Priorizar correções (patches 1-3 são obrigatórios)
3. Implementar mudanças em ambiente de staging
4. Executar testes de stress
5. Deploy gradual em produção com monitoramento intenso

**Documento gerado em:** 13/12/2025  
**Revisão recomendada:** Após cada deploy de correção
