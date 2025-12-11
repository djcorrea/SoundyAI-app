# 🔥 PATCH: AUDITORIA COMPLETA DO planContext
**Data:** 10/12/2025  
**Status:** ✅ LOGS DE AUDITORIA ADICIONADOS  
**Objetivo:** Rastrear o fluxo completo do `analysisMode` desde `analyze.js` até `pipeline-complete.js`

---

## 🎯 PROBLEMA RELATADO

**Sintoma:** Modo reduzido NÃO está ativando, mesmo quando usuário atinge limite.  
**Impacto:** Pipeline sempre retorna análise FULL, independente do limite do plano.  
**Hipótese:** `planContext.analysisMode` está chegando como `undefined` no pipeline.

---

## 🔍 ANÁLISE DO FLUXO

### ✅ ETAPA 1: `analyze.js` - Montagem do planContext

**Arquivo:** `work/api/audio/analyze.js`

**Linha 458:**
```javascript
const analysisCheck = await canUseAnalysis(uid);
```

**Linha 483:**
```javascript
const analysisMode = analysisCheck.mode; // "full" | "reduced"
```

**Linha 553-558:**
```javascript
const planContext = {
  plan: analysisCheck.user.plan,
  analysisMode: analysisMode,
  features: features,
  uid: uid
};
```

✅ **CÓDIGO ESTÁ CORRETO**: `analysisMode` é declarado na linha 483 e está no escopo correto.

---

### ✅ ETAPA 2: `createJobInDatabase()` - Envio ao Redis

**Arquivo:** `work/api/audio/analyze.js`  
**Linha 563:**
```javascript
const jobRecord = await createJobInDatabase(
  fileKey, mode, fileName, 
  referenceJobId, genre, genreTargets, 
  planContext // ✅ planContext sendo enviado
);
```

**Linha 86 (função createJobInDatabase):**
```javascript
async function createJobInDatabase(
  fileKey, mode, fileName, 
  referenceJobId = null, 
  genre = null, 
  genreTargets = null, 
  planContext = null  // ✅ parâmetro recebido
) {
```

**Linha 150 (payload para Redis):**
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
  planContext: planContext  // ✅ incluído no payload
};
```

✅ **CÓDIGO ESTÁ CORRETO**: `planContext` é enviado no payload para o Redis.

---

### ✅ ETAPA 3: `worker.js` - Extração do job.data

**Arquivo:** `work/worker.js`  
**Linha 447-456:**
```javascript
let extractedPlanContext = null;
if (job.data && typeof job.data === 'object') {
  extractedPlanContext = job.data.planContext;  // ✅ Extrai diretamente
} else if (typeof job.data === 'string') {
  try {
    const parsed = JSON.parse(job.data);
    extractedPlanContext = parsed.planContext;  // ✅ Parse se for string
  } catch (e) {
    console.warn('[PLAN-CONTEXT][WORKER] ⚠️ Falha ao extrair planContext:', e.message);
  }
}
```

**Linha 478:**
```javascript
const options = {
  jobId: job.id,
  mode: job.mode,
  genre: finalGenre,
  genreTargets: finalGenreTargets,
  referenceJobId: job.reference_job_id || null,
  isReferenceBase: job.is_reference_base || false,
  planContext: extractedPlanContext || null  // ✅ Repassado para options
};
```

✅ **CÓDIGO ESTÁ CORRETO**: Worker extrai e repassa `planContext` corretamente.

---

### ✅ ETAPA 4: `worker.js` → `analyzeAudioWithPipeline()` → pipeline

**Linha 241-244:**
```javascript
planContext:
  jobOrOptions.planContext ||
  jobOrOptions.data?.planContext ||
  null,
```

✅ **CÓDIGO ESTÁ CORRETO**: `planContext` é propagado para `pipelineOptions`.

---

### ✅ ETAPA 5: `pipeline-complete.js` - Validação do modo

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linha 1422:**
```javascript
const planContext = options.planContext || null;
```

**Linha 1432:**
```javascript
if (planContext.analysisMode === 'reduced') {
  console.log('[PLAN-FILTER] ⚠️ MODO REDUZIDO ATIVADO');
  // ...aplicar neutralização...
}
```

✅ **CÓDIGO ESTÁ CORRETO**: Verificação está correta, mas condição pode não estar sendo satisfeita.

---

## 🔥 LOGS DE AUDITORIA ADICIONADOS

Para descobrir **ONDE** o `analysisMode` está sendo perdido ou modificado, foram adicionados logs detalhados:

### 📍 PONTO 1: `analyze.js` - Após `canUseAnalysis()`

**Linhas 489-492 (ADICIONADAS):**
```javascript
console.log('🔥🔥🔥 [AUDIT-MODE] analysisMode type:', typeof analysisMode);
console.log('🔥🔥🔥 [AUDIT-MODE] analysisMode value:', analysisMode);
console.log('🔥🔥🔥 [AUDIT-MODE] analysisMode === "reduced":', analysisMode === 'reduced');
console.log('🔥🔥🔥 [AUDIT-MODE] analysisCheck.mode:', analysisCheck.mode);
```

**O QUE VALIDA:**
- Se `analysisMode` é realmente "reduced" ou está chegando como outra coisa
- Se o tipo está correto (string)
- Se `canUseAnalysis()` está retornando o valor esperado

---

### 📍 PONTO 2: `analyze.js` - Após montar `planContext`

**Linhas 562-565 (ADICIONADAS):**
```javascript
console.log('🔥🔥🔥 [AUDIT-PLANCONTEXT] planContext.analysisMode:', planContext.analysisMode);
console.log('🔥🔥🔥 [AUDIT-PLANCONTEXT] typeof planContext.analysisMode:', typeof planContext.analysisMode);
console.log('🔥🔥🔥 [AUDIT-PLANCONTEXT] planContext completo:', JSON.stringify(planContext, null, 2));
```

**O QUE VALIDA:**
- Se `planContext.analysisMode` está correto antes de enviar ao Redis
- Se há serialização correta do objeto
- Se todos os campos estão presentes

---

### 📍 PONTO 3: `worker.js` - Após extrair `planContext` do Redis

**Linhas 468-471 (ADICIONADAS):**
```javascript
console.log('🔥🔥🔥 [AUDIT-WORKER-PLANCONTEXT] extractedPlanContext:', extractedPlanContext);
console.log('🔥🔥🔥 [AUDIT-WORKER-PLANCONTEXT] extractedPlanContext?.analysisMode:', extractedPlanContext?.analysisMode);
console.log('🔥🔥🔥 [AUDIT-WORKER-PLANCONTEXT] typeof:', typeof extractedPlanContext?.analysisMode);
```

**O QUE VALIDA:**
- Se Redis está retornando `planContext` corretamente
- Se `analysisMode` sobreviveu à serialização/desserialização
- Se o worker está lendo o campo correto

---

### 📍 PONTO 4: `pipeline-complete.js` - Antes da validação

**Linhas 1425-1430 (ADICIONADAS):**
```javascript
console.log('🔥🔥🔥 [AUDIT-PIPELINE] options.planContext:', options.planContext);
console.log('🔥🔥🔥 [AUDIT-PIPELINE] planContext:', planContext);
console.log('🔥🔥🔥 [AUDIT-PIPELINE] planContext?.analysisMode:', planContext?.analysisMode);
console.log('🔥🔥🔥 [AUDIT-PIPELINE] typeof planContext?.analysisMode:', typeof planContext?.analysisMode);
console.log('🔥🔥🔥 [AUDIT-PIPELINE] planContext?.analysisMode === "reduced":', planContext?.analysisMode === 'reduced');
```

**O QUE VALIDA:**
- Se `planContext` chegou ao pipeline
- Se `analysisMode` está presente e com valor correto
- Se a comparação `=== 'reduced'` está falhando por algum motivo (tipo, espaços, etc.)

---

## 🧪 TESTE MANUAL

### 📝 PREPARAÇÃO:

1. **Criar usuário FREE com limite atingido no Firestore:**
```javascript
{
  uid: "test-reduced-mode",
  email: "test@soundyai.com",
  plan: "free",
  analysesMonth: 3,  // ← Já usou as 3 análises
  messagesMonth: 0,
  billingMonth: "2025-12",  // Mês atual
  createdAt: Timestamp.now()
}
```

2. **Fazer login com este usuário no frontend**

3. **Fazer upload de um áudio qualquer**

---

### 📊 LOGS ESPERADOS:

```
[ANALYZE] canUseAnalysis result: { allowed: true, mode: "reduced", remainingFull: 0, ... }

🔥🔥🔥 [AUDIT-MODE] analysisMode type: string
🔥🔥🔥 [AUDIT-MODE] analysisMode value: reduced
🔥🔥🔥 [AUDIT-MODE] analysisMode === "reduced": true
🔥🔥🔥 [AUDIT-MODE] analysisCheck.mode: reduced

📊 [ANALYZE] Plan Context montado: { plan: "free", analysisMode: "reduced", features: {...}, uid: "test-reduced-mode" }

🔥🔥🔥 [AUDIT-PLANCONTEXT] planContext.analysisMode: reduced
🔥🔥🔥 [AUDIT-PLANCONTEXT] typeof planContext.analysisMode: string
🔥🔥🔥 [AUDIT-PLANCONTEXT] planContext completo: {
  "plan": "free",
  "analysisMode": "reduced",
  "features": { ... },
  "uid": "test-reduced-mode"
}

[AUDIT-WORKER] job.data.planContext: PRESENTE

🔥🔥🔥 [AUDIT-WORKER-PLANCONTEXT] extractedPlanContext: { plan: "free", analysisMode: "reduced", ... }
🔥🔥🔥 [AUDIT-WORKER-PLANCONTEXT] extractedPlanContext?.analysisMode: reduced
🔥🔥🔥 [AUDIT-WORKER-PLANCONTEXT] typeof: string

🔥🔥🔥 [AUDIT-PIPELINE] options.planContext: { plan: "free", analysisMode: "reduced", ... }
🔥🔥🔥 [AUDIT-PIPELINE] planContext: { plan: "free", analysisMode: "reduced", ... }
🔥🔥🔥 [AUDIT-PIPELINE] planContext?.analysisMode: reduced
🔥🔥🔥 [AUDIT-PIPELINE] typeof planContext?.analysisMode: string
🔥🔥🔥 [AUDIT-PIPELINE] planContext?.analysisMode === "reduced": true

[PLAN-FILTER] ⚠️ MODO REDUZIDO ATIVADO - Aplicando valores neutros
[PLAN-FILTER] ✅ Bandas neutralizadas: 10 bandas
[PLAN-FILTER] ✅ Sugestões limpas (arrays vazios)
[PLAN-FILTER] ✅ problemsAnalysis limpo (estrutura mínima)
[PLAN-FILTER] ✅ Dados espectrais limpos (null explícito)
[PLAN-FILTER] ✅ Modo reduzido aplicado - Estrutura preservada, valores neutralizados
```

---

### ❌ LOGS SE HOUVER PROBLEMA:

Se algum log mostrar `undefined`, identificar o ponto exato:

**Exemplo 1: `analysisMode` undefined no analyze.js**
```
🔥🔥🔥 [AUDIT-MODE] analysisMode value: undefined
🔥🔥🔥 [AUDIT-MODE] analysisCheck.mode: reduced  ← canUseAnalysis retorna correto
```
**Causa:** Variável `analysisMode` não está recebendo `analysisCheck.mode`.

---

**Exemplo 2: `planContext` undefined no worker**
```
[AUDIT-WORKER] job.data.planContext: AUSENTE
🔥🔥🔥 [AUDIT-WORKER-PLANCONTEXT] extractedPlanContext: null
```
**Causa:** Redis não está armazenando `planContext` ou worker não consegue extrair.

---

**Exemplo 3: `analysisMode` undefined no pipeline**
```
🔥🔥🔥 [AUDIT-PIPELINE] planContext?.analysisMode: undefined
🔥🔥🔥 [AUDIT-PIPELINE] planContext?.analysisMode === "reduced": false
```
**Causa:** `planContext` chega ao pipeline, mas sem o campo `analysisMode`.

---

## 📋 ARQUIVOS MODIFICADOS

### 1. `work/api/audio/analyze.js`
- ✅ Linhas 489-492: Logs de auditoria após `canUseAnalysis()`
- ✅ Linhas 562-565: Logs de auditoria após montar `planContext`

### 2. `work/worker.js`
- ✅ Linhas 468-471: Logs de auditoria após extrair `planContext`

### 3. `work/api/audio/pipeline-complete.js`
- ✅ Linhas 1425-1430: Logs de auditoria antes da validação de modo reduzido

---

## 🎯 PRÓXIMOS PASSOS

1. ✅ **Aplicar logs de auditoria** (CONCLUÍDO)
2. ✅ **Validar sintaxe** (0 erros)
3. 🔄 **Executar teste manual** com usuário FREE (3+ análises)
4. 🔄 **Analisar logs completos** para identificar ponto de falha
5. 🔄 **Aplicar correção cirúrgica** no ponto exato onde `analysisMode` é perdido
6. 🔄 **Validar modo reduzido funcionando**
7. 🔄 **Remover logs temporários** após confirmação

---

## ✅ VALIDAÇÃO ATUAL

- ✅ 0 erros de sintaxe em 3 arquivos
- ✅ Logs de auditoria adicionados em 4 pontos críticos
- ✅ Código original preservado (apenas logs adicionados)
- ✅ Estrutura de fluxo validada (teoria está correta)
- 🔄 **AGUARDANDO TESTE REAL** para identificar ponto de falha

---

**FIM DO PATCH**
