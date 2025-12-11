# 🔴 AUDITORIA COMPLETA: BUG CRÍTICO IDENTIFICADO
**Data:** 10/12/2025  
**Status:** 🔴 BUG ROOT CAUSE IDENTIFICADO  
**Severidade:** CRÍTICA - Modo reduzido NUNCA funciona

---

## 🎯 RESUMO EXECUTIVO

O sistema de planos está funcionando **PARCIALMENTE**:
- ✅ `userPlans.js` retorna `mode: "reduced"` corretamente
- ✅ `analyze.js` monta `planContext` corretamente
- ✅ Redis recebe `planContext` no payload
- ✅ Worker extrai `planContext` do Redis
- ✅ Worker repassa `planContext` para o pipeline
- ✅ Pipeline aplica o filtro de modo reduzido
- ❌ **Worker NÃO inclui `analysisMode` no JSON salvo no banco**

---

## 🔍 FLUXO COMPLETO RASTREADO

### ✅ ETAPA 1: `userPlans.js` - Validação de Limites

**Arquivo:** `work/lib/user/userPlans.js`  
**Função:** `canUseAnalysis(uid)` (linha 272)

```javascript
// FREE após 3 análises:
return {
  allowed: true,
  mode: 'reduced',  // ✅ CORRETO
  user,
  remainingFull: 0,
};
```

**Status:** ✅ **CORRETO** - Retorna `mode: "reduced"` quando limite é atingido.

---

### ✅ ETAPA 2: `analyze.js` - Montagem do planContext

**Arquivo:** `work/api/audio/analyze.js`  
**Linhas:** 483, 558-562

```javascript
// Linha 483
const analysisMode = analysisCheck.mode; // "full" | "reduced"

// Linha 558-562
const planContext = {
  plan: analysisCheck.user.plan,
  analysisMode: analysisMode,  // ✅ CORRETO
  features: features,
  uid: uid
};
```

**Logs de auditoria:**
```javascript
console.log('🔥🔥🔥 [AUDIT-MODE] analysisMode value:', analysisMode);
console.log('🔥🔥🔥 [AUDIT-PLANCONTEXT] planContext.analysisMode:', planContext.analysisMode);
```

**Status:** ✅ **CORRETO** - `planContext.analysisMode` é montado com o valor correto.

---

### ✅ ETAPA 3: `analyze.js` → Redis

**Arquivo:** `work/api/audio/analyze.js`  
**Função:** `createJobInDatabase()` (linha 86)  
**Linhas:** 150-159

```javascript
const payloadParaRedis = {
  jobId: jobId,
  externalId: externalId,
  fileKey,
  fileName,
  mode,
  genre: genre,
  genreTargets: genreTargets,
  referenceJobId: referenceJobId,
  planContext: planContext  // ✅ CORRETO - Incluído no payload
};

const redisJob = await queue.add('process-audio', payloadParaRedis, {
  jobId: externalId,
  priority: 1,
  attempts: 3,
  // ...
});
```

**Status:** ✅ **CORRETO** - `planContext` é enviado ao Redis no payload.

---

### ✅ ETAPA 4: Worker - Extração do Redis

**Arquivo:** `work/worker.js`  
**Linhas:** 447-470

```javascript
// Linha 447-456: Extração
let extractedPlanContext = null;
if (job.data && typeof job.data === 'object') {
  extractedPlanContext = job.data.planContext;  // ✅ CORRETO
} else if (typeof job.data === 'string') {
  try {
    const parsed = JSON.parse(job.data);
    extractedPlanContext = parsed.planContext;  // ✅ CORRETO
  } catch (e) {
    console.warn('[PLAN-CONTEXT][WORKER] ⚠️ Falha ao extrair planContext:', e.message);
  }
}

// Linha 469-470: Logs de auditoria
console.log('🔥🔥🔥 [AUDIT-WORKER-PLANCONTEXT] extractedPlanContext?.analysisMode:', extractedPlanContext?.analysisMode);
```

**Status:** ✅ **CORRETO** - Worker extrai `planContext` corretamente do Redis.

---

### ✅ ETAPA 5: Worker → Pipeline

**Arquivo:** `work/worker.js`  
**Linhas:** 473-479

```javascript
const options = {
  jobId: job.id,
  reference: job?.reference || null,
  mode: job.mode || 'genre',
  genre: finalGenre,
  genreTargets: finalGenreTargets,
  referenceJobId: job.reference_job_id || null,
  isReferenceBase: job.is_reference_base || false,
  planContext: extractedPlanContext || null  // ✅ CORRETO
};
```

**Status:** ✅ **CORRETO** - `planContext` é repassado para o pipeline via `options`.

---

### ✅ ETAPA 6: Pipeline - Aplicação do Filtro

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linhas:** 1422-1540

```javascript
// Linha 1422
const planContext = options.planContext || null;

// Linha 1432-1540: Filtro de modo reduzido
if (planContext.analysisMode === 'reduced') {
  console.log('[PLAN-FILTER] ⚠️ MODO REDUZIDO ATIVADO');
  
  // Neutraliza bands, suggestions, spectrum, etc.
  finalJSON.bands = { ... };  // Valores "-"
  finalJSON.suggestions = [];
  finalJSON.aiSuggestions = [];
  // ...
  
  finalJSON.analysisMode = 'reduced';  // ✅ CORRETO
  finalJSON.isReduced = true;
}

// Linha 1535
return finalJSON;
```

**Status:** ✅ **CORRETO** - Pipeline aplica o filtro E adiciona `analysisMode: "reduced"` no JSON.

---

### ❌ ETAPA 7: Worker - Salvamento no Banco (BUG CRÍTICO)

**Arquivo:** `work/worker.js`  
**Linhas:** 1030-1146

**O QUE ACONTECE:**

1. **Pipeline retorna** `analysisResult` com:
   ```javascript
   {
     analysisMode: "reduced",
     isReduced: true,
     bands: { ... },
     suggestions: [],
     // ... resto dos dados
   }
   ```

2. **Worker cria objeto `result`** (linha 747-809):
   ```javascript
   const result = {
     ok: true,
     file: job.file_key,
     genre: forcedGenre,
     mode: job.mode,
     summary: mergePreservingGenre(...),
     metadata: mergePreservingGenre(...),
     data: mergePreservingGenre(...),
     suggestions: analysisResult.suggestions || [],
     aiSuggestions: analysisResult.aiSuggestions || [],
     // ... outros campos
   };
   ```

3. **Worker cria objeto `resultsForDb`** (linha 1030-1146):
   ```javascript
   const resultsForDb = {
     genre: genreFromJob,
     mode: result.mode || job.mode || 'genre',
     score: result.score ?? 0,
     classification: result.classification || 'Análise Concluída',
     data: { ... },
     summary: { ... },
     metadata: { ... },
     suggestionMetadata: { ... },
     technicalData: result.technicalData,
     suggestions: result.suggestions || [],
     aiSuggestions: result.aiSuggestions || [],
     // ... outros campos
     
     // ❌ BUG: analysisMode NÃO está aqui!
     // ❌ BUG: isReduced NÃO está aqui!
   };
   ```

4. **Worker salva no banco** (linha ~1250):
   ```javascript
   const resultsJSON = JSON.stringify(resultsForDb);
   
   await client.query(
     `UPDATE jobs SET result = $1, results = $1, status = 'done', updated_at = NOW() WHERE id = $2`,
     [resultsJSON, job.id]
   );
   ```

---

## 🔴 ROOT CAUSE IDENTIFICADO

### **BUG:** Worker não copia `analysisMode` do `analysisResult` para `resultsForDb`

**Localização exata:** `work/worker.js`, linhas 1030-1146

**O que está faltando:**
```javascript
const resultsForDb = {
  // ... campos existentes ...
  
  // ❌ FALTANDO:
  analysisMode: result.analysisMode || analysisResult.analysisMode || 'full',
  isReduced: result.isReduced || analysisResult.isReduced || false,
};
```

**Por que isso acontece:**

1. Pipeline adiciona `analysisMode: "reduced"` no `finalJSON`
2. `finalJSON` é retornado como `analysisResult`
3. Worker cria objeto `result` mas **NÃO copia** `analysisMode` explicitamente
4. Worker cria objeto `resultsForDb` mas **NÃO inclui** `analysisMode`
5. Banco recebe JSON **SEM** `analysisMode`
6. Frontend recebe `jobResult` **SEM** `analysisMode` → assume `mode: "full"`

---

## 📊 IMPACTO DO BUG

### **1. Sistema de limites inútil**
- Usuários FREE recebem análise FULL após 3 análises
- Nenhum incentivo para upgrade
- Perda de receita

### **2. Custos computacionais**
- Processamento FULL mesmo em modo reduzido
- IA sempre ativada (embora suggestions sejam arrays vazios)
- Dados espectrais sempre gerados (embora sejam null)

### **3. Experiência inconsistente**
- Pipeline gera JSON reduzido corretamente
- Mas `analysisMode` se perde antes de salvar no banco
- Frontend não sabe que é modo reduzido
- Usuário pode ficar confuso

---

## ✅ CORREÇÃO NECESSÁRIA

### **Arquivo:** `work/worker.js`  
### **Localização:** Linha ~1030 (criação de `resultsForDb`)

**ADICIONAR os campos faltantes:**

```javascript
const resultsForDb = {
  // ✅ GARANTIA ABSOLUTA: Genre correto na raiz
  genre: genreFromJob,
  
  // ✅ Mode, score e classification
  mode: result.mode || job.mode || 'genre',
  score: result.score ?? 0,
  classification: result.classification || 'Análise Concluída',
  scoringMethod: result.scoringMethod || 'default',
  
  // 🔥 CORREÇÃO CRÍTICA: Adicionar analysisMode e isReduced
  analysisMode: result.analysisMode || analysisResult.analysisMode || 'full',
  isReduced: result.isReduced || analysisResult.isReduced || false,
  
  // ✅ Data com genre garantido
  data: {
    genre: genreFromJob,
    genreTargets: (() => {
      // ... código existente ...
    })(),
    ...result.data
  },
  
  // ... resto dos campos existentes ...
};
```

---

## 🧪 VALIDAÇÃO DA CORREÇÃO

### **Teste 1: Usuário FREE com 3+ análises**

**Setup:**
```json
{
  "uid": "test-reduced",
  "plan": "free",
  "analysesMonth": 3,
  "billingMonth": "2025-12"
}
```

**Logs esperados após correção:**
```
[ANALYZE] canUseAnalysis result: { mode: "reduced", remainingFull: 0 }
[ANALYZE] planContext.analysisMode: reduced
[WORKER] extractedPlanContext?.analysisMode: reduced
[PLAN-FILTER] ⚠️ MODO REDUZIDO ATIVADO
[WORKER] resultsForDb.analysisMode: reduced
[WORKER] resultsForDb.isReduced: true
[DB-SAVE] Salvando com analysisMode: reduced
```

**JSON salvo no banco:**
```json
{
  "analysisMode": "reduced",
  "isReduced": true,
  "mode": "genre",
  "score": 85,
  "bands": { "sub": { "db": "-", ... } },
  "suggestions": [],
  "limitWarning": "Você atingiu o limite..."
}
```

---

## 📋 CHECKLIST DE CORREÇÃO

- [ ] Adicionar `analysisMode` no objeto `resultsForDb` (worker.js linha ~1030)
- [ ] Adicionar `isReduced` no objeto `resultsForDb`
- [ ] Validar que `analysisResult.analysisMode` é copiado corretamente
- [ ] Adicionar log de auditoria: `console.log('[WORKER] resultsForDb.analysisMode:', resultsForDb.analysisMode)`
- [ ] Testar com usuário FREE (3+ análises)
- [ ] Verificar JSON no banco contém `analysisMode: "reduced"`
- [ ] Confirmar frontend recebe `analysisMode` corretamente
- [ ] Validar que limitWarning é exibido

---

## 🎯 PRÓXIMOS PASSOS

1. ✅ **Aplicar patch no worker.js** (adicionar 2 linhas)
2. 🔄 **Validar sintaxe** (0 erros esperados)
3. 🔄 **Testar com usuário FREE**
4. 🔄 **Verificar logs completos**
5. 🔄 **Confirmar JSON no banco**
6. 🔄 **Validar frontend**
7. 🔄 **Deploy em produção**

---

## 📊 RESUMO DA AUDITORIA

| Componente | Status | Problema |
|-----------|--------|----------|
| `userPlans.js` | ✅ CORRETO | Retorna `mode: "reduced"` corretamente |
| `analyze.js` (montagem) | ✅ CORRETO | Monta `planContext` corretamente |
| `analyze.js` (Redis) | ✅ CORRETO | Envia `planContext` ao Redis |
| `worker.js` (extração) | ✅ CORRETO | Extrai `planContext` do Redis |
| `worker.js` (pipeline) | ✅ CORRETO | Repassa `planContext` ao pipeline |
| `pipeline-complete.js` | ✅ CORRETO | Aplica filtro de modo reduzido |
| `worker.js` (salvamento) | ❌ **BUG CRÍTICO** | NÃO inclui `analysisMode` no JSON salvo |

**CAUSA RAIZ:**  
Worker não copia `analysisMode` e `isReduced` do `analysisResult` para o objeto `resultsForDb` antes de salvar no banco.

**CORREÇÃO:**  
Adicionar 2 linhas no `resultsForDb`:
```javascript
analysisMode: result.analysisMode || analysisResult.analysisMode || 'full',
isReduced: result.isReduced || analysisResult.isReduced || false,
```

---

**FIM DA AUDITORIA - BUG IDENTIFICADO**
