# 🔍 AUDITORIA COMPLETA - MODO REFERENCE

## 📊 MAPA DO FLUXO ATUAL

### 1. DATA CONTRACT (job.data)

**Campos definidos no endpoint `/analyze` (analyze.js:87-200):**
```javascript
{
  jobId: UUID,              // PostgreSQL primary key
  externalId: string,       // BullMQ job ID
  fileKey: string,
  fileName: string,
  mode: 'genre' | 'reference',  // Legacy field
  analysisType: 'genre' | 'reference',  // 🆕 Campo explícito
  referenceStage: 'base' | 'compare' | null,  // 🆕 Para reference
  genre: string | null,
  genreTargets: object | null,
  referenceJobId: UUID | null,  // ID da primeira música
  planContext: object
}
```

**Decisão de stage atual (analyze.js:490-494):**
```javascript
const finalReferenceStage = referenceStage || null;
```
❌ **BUG #1:** O backend NÃO está detectando automaticamente o stage. Está esperando que o FRONTEND envie `referenceStage`, mas o frontend pode não estar enviando corretamente.

---

### 2. VALIDAÇÃO NO BACKEND (analyze.js:620-640)

```javascript
if (finalAnalysisType === 'reference') {
  if (finalReferenceStage === 'compare' || referenceJobId) {
    if (!referenceJobId) {
      return res.status(400).json({
        error: 'referenceJobId é obrigatório para segunda track'
      });
    }
  }
}
```

✅ **OK:** Validação correta - só exige `referenceJobId` se for compare.

---

### 3. PIPELINE (pipeline-complete.js:431)

```javascript
referenceStage: options.referenceStage || 
  options.analysisType === 'reference' ? 
    (options.referenceJobId ? 'compare' : 'base') 
  : null
```

✅ **OK:** Pipeline detecta stage automaticamente baseado na presença de `referenceJobId`.

---

### 4. SUGGESTION ENGINE (pipeline-complete.js:539-542)

```javascript
if (mode !== 'genre') {
  console.log('[DEBUG-SUGGESTIONS] ⏭️ SKIP: Modo não é "genre"');
  // Define estruturas vazias
  finalJSON.problemsAnalysis = { problems: [], suggestions: [] };
  // ...
}
```

✅ **OK:** Suggestion Engine pula em reference mode.

**MAS...**

❌ **BUG #2:** O log mostra que está entrando no suggestion engine COM ERRO:
```
[SUGGESTION_ENGINE] Targets obrigatórios ausentes para gênero: default
```

Isso significa que o `if (mode !== 'genre')` **NÃO ESTÁ SENDO EXECUTADO**!

**Causa provável:** A variável `mode` está com valor incorreto quando chega no pipeline.

---

### 5. WORKER VALIDATION (worker-redis.js:487-508)

```javascript
const referenceStage = finalJSON.referenceStage || 
  finalJSON.metadata?.referenceStage || null;
const isCompareStage = (referenceStage === 'compare') || 
  (mode === 'reference' && referenceJobId);

if (isCompareStage) {
  if (!finalJSON.referenceComparison) {
    missing.push('referenceComparison (necessário para referenceStage=compare)');
  }
} else if (mode === 'reference') {
  console.log('[WORKER-VALIDATION] ⏭️ referenceComparison: NÃO OBRIGATÓRIO');
}
```

✅ **OK:** Validação stage-aware está correta.

❌ **BUG #3:** O erro do log mostra:
```
JSON incompleto: referenceComparison (necessário para referenceStage=compare)
```

Isso significa que o worker está identificando como `compare` quando deveria ser `base`.

**Causa provável:** O `finalJSON.referenceStage` está vindo como `'compare'` mesmo na primeira música.

---

### 6. DUPLO PROCESSAMENTO (worker-redis.js:168, analyze.js:168)

```javascript
// analyze.js - Configuração do job:
attempts: 3,  // ❌ BUG #4: Job pode tentar 3 vezes
backoff: {
  type: 'exponential',
  delay: 2000,
}
```

❌ **BUG #4:** Se o job falhar (por causa dos bugs acima), ele será automaticamente re-enfileirado até 3 vezes, causando:
- Logs duplicados
- Pipeline executando múltiplas vezes
- Rate limit estourando (500 logs/sec)

**Falta idempotência:** Não há verificação se o JobId já está sendo processado.

---

## 🚨 ROOT CAUSES IDENTIFICADAS

### 🔴 BUG #1: Frontend não envia `referenceStage`
**Evidência:**
```javascript
const finalReferenceStage = referenceStage || null;
```

O backend espera receber, mas não detecta automaticamente.

**Impacto:**
- `referenceStage` chega como `null` no worker
- Pipeline tenta detectar, mas pode falhar
- Worker valida incorretamente

---

### 🔴 BUG #2: Variável `mode` incorreta no pipeline
**Evidência:**
```
Worker inicia pipeline em reference com Genre: null
[SUGGESTION_ENGINE] Targets obrigatórios ausentes para gênero: default
```

O suggestion engine está rodando, logo `mode !== 'genre'` é falso.

**Causas possíveis:**
1. `mode` está vindo como `'genre'` ao invés de `'reference'`
2. Há duas variáveis `mode`: legacy `mode` e novo `analysisType`
3. Pipeline está usando `mode` errado

---

### 🔴 BUG #3: `referenceStage` sendo detectado como `'compare'` na primeira música
**Evidência:**
```
JSON incompleto: referenceComparison (necessário para referenceStage=compare)
```

Worker exige `referenceComparison`, logo detectou como `compare`.

**Causa provável:**
```javascript
// pipeline-complete.js:431
referenceStage: options.referenceJobId ? 'compare' : 'base'
```

Se `options.referenceJobId` não for exatamente `null` (pode ser string vazia, undefined, etc), detecta como `compare`.

---

### 🔴 BUG #4: Retry sem idempotência + Logs excessivos
**Evidência:**
- Railway rate limit estourando
- Mesmo JobId aparecendo múltiplas vezes nos logs

**Causa:**
- Job falha (por bugs acima)
- BullMQ re-enfileira (attempts: 3)
- Worker reprocessa
- Logs se multiplicam (3x ou mais)
- Rate limit estoura

---

## 🎯 CORREÇÕES NECESSÁRIAS

### ✅ CORREÇÃO #1: Auto-detecção de `referenceStage` no backend

**Arquivo:** `work/api/audio/analyze.js` (linha ~490)

```javascript
// ❌ ANTES:
const finalReferenceStage = referenceStage || null;

// ✅ DEPOIS:
let finalReferenceStage = referenceStage;

if (!finalReferenceStage && finalAnalysisType === 'reference') {
  // Auto-detectar stage baseado em referenceJobId
  finalReferenceStage = referenceJobId ? 'compare' : 'base';
  console.log(`[ANALYZE] 🎯 Auto-detectado referenceStage: ${finalReferenceStage}`);
}
```

**Impacto:** ✅ Stage sempre definido, mesmo se frontend não enviar.

---

### ✅ CORREÇÃO #2: Usar `analysisType` ao invés de `mode` no pipeline

**Arquivo:** `work/api/audio/pipeline-complete.js` (linha ~539)

```javascript
// ❌ ANTES:
if (mode !== 'genre') {

// ✅ DEPOIS:
const finalAnalysisType = options.analysisType || mode;
if (finalAnalysisType !== 'genre') {
```

**Justificativa:** Garantir que estamos usando o campo correto.

---

### ✅ CORREÇÃO #3: Validação rigorosa de `referenceJobId` no pipeline

**Arquivo:** `work/api/audio/pipeline-complete.js` (linha ~431)

```javascript
// ❌ ANTES:
referenceStage: options.referenceStage || 
  options.analysisType === 'reference' ? 
    (options.referenceJobId ? 'compare' : 'base') 
  : null

// ✅ DEPOIS:
referenceStage: options.referenceStage || 
  (options.analysisType === 'reference' ? 
    (options.referenceJobId && typeof options.referenceJobId === 'string' && options.referenceJobId.trim() !== '' 
      ? 'compare' 
      : 'base') 
  : null)
```

**Justificativa:** Evitar falsos positivos (string vazia, undefined, etc).

---

### ✅ CORREÇÃO #4: Idempotência no worker

**Arquivo:** `work/worker-redis.js` (antes da linha 1000)

```javascript
// ✅ NOVO: Verificar se job já está sendo processado
const processingKey = `job:processing:${jobId}`;
const isProcessing = await redisConnection.get(processingKey);

if (isProcessing) {
  console.warn(`⚠️ [IDEMPOTENCY] Job ${jobId} já está sendo processado. Pulando.`);
  return {
    success: false,
    error: 'Job already processing',
    jobId
  };
}

// Marcar como processing por 10 minutos
await redisConnection.setex(processingKey, 600, Date.now());
```

**Impacto:**  - ✅ Evita reprocessamento
- ✅ Reduz logs duplicados
- ✅ Rate limit não estoura

---

### ✅ CORREÇÃO #5: Reduzir tentativas de retry

**Arquivo:** `work/api/audio/analyze.js` (linha ~168)

```javascript
// ❌ ANTES:
attempts: 3,

// ✅ DEPOIS:
attempts: 1,  // Apenas 1 tentativa para evitar loops
```

**Justificativa:** Com idempotência, não precisamos de múltiplas tentativas automáticas.

---

### ✅ CORREÇÃO #6: Consolidar logs no pipeline

**Arquivo:** `work/api/audio/pipeline-complete.js` (várias linhas)

```javascript
// ✅ NOVO: Log consolidado ao invés de múltiplos logs
console.log('[PIPELINE] Estado:', {
  mode: finalAnalysisType,
  stage: referenceStage,
  hasReferenceJobId: !!options.referenceJobId,
  hasGenre: !!options.genre
});
```

**Impacto:** Reduz drasticamente volume de logs (de 50+ logs para 1-2 logs por etapa).

---

## 📋 PRÓXIMOS PASSOS

1. ✅ Aplicar CORREÇÃO #1 (auto-detecção)
2. ✅ Aplicar CORREÇÃO #2 (analysisType)
3. ✅ Aplicar CORREÇÃO #3 (validação rigorosa)
4. ✅ Aplicar CORREÇÃO #4 (idempotência)
5. ✅ Aplicar CORREÇÃO #5 (retry reduzido)
6. ✅ Aplicar CORREÇÃO #6 (logs consolidados)
7. ✅ Testar fluxo completo base → compare
8. ✅ Validar que genre mode não foi afetado

---

**Data:** 2025-01-17  
**Status:** 🔴 BUGS CRÍTICOS IDENTIFICADOS  
**Próximo:** Aplicar correções cirúrgicas
