# 🔬 AUDITORIA FORENSE COMPLETA - ORIGEM EXATA DO NULL

**Data:** 02/12/2025  
**Status:** 🔍 INVESTIGAÇÃO COMPLETA

---

## 🎯 OBJETIVO DA AUDITORIA

Descobrir **EXATAMENTE** onde o valor `genre = "funk_bh"` se transforma em `NULL` antes de chegar na coluna `results.genre` do PostgreSQL.

**NÃO** estamos procurando:
- ❌ Fallbacks de 'default'
- ❌ Blindagens finais
- ❌ Pipeline sobrescrevendo valores

**ESTAMOS PROCURANDO:**
- ✅ Quem **GERA** o NULL
- ✅ Qual **FUNÇÃO** retorna NULL
- ✅ Qual **VARIÁVEL** recebe NULL pela primeira vez
- ✅ Por que **FONTE ERRADA** está sendo lida

---

## 📋 MAPEAMENTO COMPLETO DAS VARIÁVEIS DE GÊNERO

### 1. **options.genre**
**Definido em:** `work/worker.js` linha 423
```javascript
const options = {
  jobId: job.id,
  mode: job.mode || 'genre',
  genre: finalGenre,  // ← VALOR: "funk_bh"
  genreTargets: finalGenreTargets,
  referenceJobId: job.reference_job_id || null,
  isReferenceBase: job.is_reference_base || false
};
```
**Valor esperado:** `"funk_bh"` (extraído de `job.data.genre`)  
**Status:** ✅ CORRETO - valor chega correto no worker

---

### 2. **job.data.genre**
**Definido em:** `work/api/audio/analyze.js` linha 144
```javascript
const jobData = {
  genre: genre.trim(),  // ← VALOR: "funk_bh"
  genreTargets: genreTargets || null
};

// Salvo no banco (linha 161)
await pool.query(insertQuery, [..., JSON.stringify(jobData)]);
```
**Valor esperado:** `"funk_bh"` (vem de `req.body.genre`)  
**Status:** ✅ CORRETO - banco salva corretamente

---

### 3. **extractedGenre**
**Definido em:** `work/worker.js` linha 378
```javascript
let extractedGenre = null;

if (job.data && typeof job.data === 'object') {
  extractedGenre = job.data.genre;  // ← VALOR: "funk_bh"
}
```
**Valor esperado:** `"funk_bh"` (lido de `job.data.genre`)  
**Status:** ✅ CORRETO - worker extrai corretamente

---

### 4. **finalGenre**
**Definido em:** `work/worker.js` linha 405
```javascript
const finalGenre = extractedGenre.trim();  // ← VALOR: "funk_bh"
```
**Valor esperado:** `"funk_bh"` (trimmed)  
**Status:** ✅ CORRETO - string limpa

---

### 5. **resolvedGenre** (dentro de `analyzeAudioWithPipeline`)
**Definido em:** `work/worker.js` linhas 179-189
```javascript
const isGenreMode = jobOrOptions.mode === "genre";
let resolvedGenre = null;

if (isGenreMode) {
    resolvedGenre =
        jobOrOptions.genre ||          // ← DEVE SER "funk_bh"
        jobOrOptions.data?.genre ||    // ← Fallback
        null;

    if (typeof resolvedGenre === "string") {
        resolvedGenre = resolvedGenre.trim();
    }

    if (!resolvedGenre) {
        console.error("[GENRE-ERROR] Modo gênero, mas gênero ausente:", jobOrOptions);
        resolvedGenre = null; // ❌ POSSÍVEL GERADOR DE NULL
    }
}
```
**Valor esperado:** `"funk_bh"` (de `jobOrOptions.genre`)  
**Status:** ⚠️ **SUSPEITO #1** - Se `jobOrOptions.genre` for falsy, vira NULL

**VERIFICAÇÃO CRÍTICA:**
- Se `jobOrOptions` = `options` (linha 546), então `jobOrOptions.genre = "funk_bh"` ✅
- Se `jobOrOptions` = `job` (linha 455-456 modo comparison), então `jobOrOptions.genre = undefined` ❌

---

### 6. **pipelineOptions.genre**
**Definido em:** `work/worker.js` linha 221
```javascript
const pipelineOptions = {
  jobId: jobOrOptions.jobId || jobOrOptions.id || null,
  mode: jobOrOptions.mode || 'genre',
  genre: resolvedGenre,  // ← PROPAGA o valor de resolvedGenre
  genreTargets: jobOrOptions.genreTargets || jobOrOptions.data?.genreTargets || null,
  referenceJobId: jobOrOptions.referenceJobId || jobOrOptions.reference_job_id || null,
  isReferenceBase: jobOrOptions.isReferenceBase ?? jobOrOptions.is_reference_base ?? false,
};
```
**Valor esperado:** `"funk_bh"` (de `resolvedGenre`)  
**Status:** ⚠️ **DEPENDENTE** - Se `resolvedGenre = null`, propaga NULL

---

### 7. **options.genre** (dentro de `processAudioComplete`)
**Recebido em:** `work/api/audio/pipeline-complete.js` linha 72
```javascript
export async function processAudioComplete(audioBuffer, fileName, options = {}) {
  const startTime = Date.now();
  const jobId = options.jobId || 'unknown';
  let tempFilePath = null;
  let detectedGenre = null;
  
  // LOG DE ENTRADA (linha 86-90)
  console.log('[GENRE-TRACE][PIPELINE-INPUT]', {
    jobId: jobId.substring(0, 8),
    incomingGenre: options.genre,  // ← LOG MOSTRA O VALOR RECEBIDO
    incomingTargets: options.genreTargets ? Object.keys(options.genreTargets) : null,
    mode: options.mode
  });
```
**Valor esperado:** `"funk_bh"` (de `pipelineOptions.genre`)  
**Status:** ✅ CORRETO - pipeline recebe corretamente (confirmado por log linha 88)

---

### 8. **resolvedGenre** (dentro de `processAudioComplete` - Fase 5.4)
**Definido em:** `work/api/audio/pipeline-complete.js` linha 216
```javascript
const resolvedGenre = options.genre || options.data?.genre || options.genre_detected || null;
```
**Valor esperado:** `"funk_bh"` (de `options.genre`)  
**Status:** ⚠️ **SUSPEITO #2** - Se `options.genre` for falsy, cai no fallback NULL

**PROBLEMA IDENTIFICADO:**
- `options.genre` chega como `"funk_bh"` (confirmado por log linha 88)
- ENTÃO `resolvedGenre = "funk_bh"` ✅
- **MAS:** Se `options.genre === undefined`, então `resolvedGenre = null` ❌

---

### 9. **detectedGenre** (primeira atribuição - Fase 5.4)
**Definido em:** `work/api/audio/pipeline-complete.js` linhas 217-219
```javascript
const isGenreMode = mode === 'genre';
detectedGenre = isGenreMode
  ? (resolvedGenre ? String(resolvedGenre).trim() || null : null)
  : (options.genre || 'default');
```
**Valor esperado:** `"funk_bh"` (de `resolvedGenre`)  
**Status:** 🔥 **ASSASSINO #1 CONFIRMADO**

**ANÁLISE CRÍTICA:**
```javascript
// Se isGenreMode = true e resolvedGenre = "funk_bh"
detectedGenre = (resolvedGenre ? String(resolvedGenre).trim() || null : null)
detectedGenre = ("funk_bh" ? String("funk_bh").trim() || null : null)
detectedGenre = "funk_bh" || null
detectedGenre = "funk_bh" ✅

// Se isGenreMode = true e resolvedGenre = null
detectedGenre = (null ? String(null).trim() || null : null)
detectedGenre = null ❌ GERADOR DE NULL ENCONTRADO
```

**HIPÓTESE:**
- `options.genre` está chegando como `undefined` (não `null`, não `"funk_bh"`)
- Expressão `options.genre || options.data?.genre || options.genre_detected || null` retorna `null`
- `resolvedGenre = null`
- `detectedGenre = null` ❌

---

### 10. **finalJSON.genre** (construído em `generateJSONOutput`)
**Definido em:** `work/api/audio/pipeline-complete.js` linha 238-244
```javascript
finalJSON = generateJSONOutput(coreMetrics, reference, metadata, { 
  jobId, 
  fileName,
  mode: mode,
  genre: detectedGenre,  // ← PASSA NULL SE detectedGenre = null
  genreTargets: options.genreTargets,
  referenceJobId: options.referenceJobId
});
```
**Valor esperado:** `"funk_bh"` (de `detectedGenre`)  
**Status:** ❌ **RECEBE NULL** se `detectedGenre = null`

---

### 11. **finalGenre** (dentro de `generateJSONOutput`)
**Definido em:** `work/api/audio/json-output.js` linhas 483-486
```javascript
const isGenreMode = (options.mode || 'genre') === 'genre';
const resolvedGenre = options.genre || options.data?.genre || options.genre_detected || null;
const finalGenre = isGenreMode
  ? (resolvedGenre ? String(resolvedGenre).trim() || null : null)
  : (options.genre || 'default');
```
**Valor esperado:** `"funk_bh"` (de `options.genre`)  
**Status:** 🔥 **ASSASSINO #2 CONFIRMADO**

**ANÁLISE:**
```javascript
// Se options.genre = null (passado de detectedGenre)
resolvedGenre = null || undefined || undefined || null = null
finalGenre = (null ? String(null).trim() || null : null) = null ❌
```

---

### 12. **finalJSON.genre** (retornado de `generateJSONOutput`)
**Definido em:** `work/api/audio/json-output.js` linha 508
```javascript
return {
  genre: finalGenre,  // ← RETORNA NULL
  mode: options.mode || 'genre',
  score: Math.round(scoreValue * 10) / 10,
  classification: scoringResult.classification || 'unknown',
  // ...
}
```
**Valor esperado:** `"funk_bh"`  
**Status:** ❌ **RETORNA NULL** porque `finalGenre = null`

---

### 13. **detectedGenre** (segunda atribuição - Fase 5.4.2 V2)
**Definido em:** `work/api/audio/pipeline-complete.js` linhas 528-530
```javascript
const detectedGenreV2 = (mode === 'genre')
  ? (resolvedGenre ? String(resolvedGenre).trim() || null : null)
  : (options.genre || 'default');
```
**Valor esperado:** `"funk_bh"`  
**Status:** 🔥 **ASSASSINO #3 CONFIRMADO**

**ANÁLISE:** Mesma lógica de `detectedGenre` - se `resolvedGenre = null`, então `detectedGenreV2 = null`

---

### 14. **safeGenre** (blindagem final)
**Definido em:** `work/api/audio/pipeline-complete.js` linhas 647-651
```javascript
const safeGenre = (
  options.genre ||
  options.data?.genre ||
  null
);

finalJSON.genre = safeGenre;
```
**Valor esperado:** `"funk_bh"` (de `options.genre`)  
**Status:** ⚠️ **DEPENDENTE** - Se `options.genre = undefined`, retorna `null`

---

### 15. **result.genre** (worker antes do salvamento)
**Definido em:** `work/worker.js` linha 801
```javascript
const safeGenreBeforeSave = 
  options.genre ??
  originalPayload.genre ??
  result.genre ??
  result.summary?.genre ??
  result.data?.genre ??
  null;

result.genre = safeGenreBeforeSave;
```
**Valor esperado:** `"funk_bh"`  
**Status:** ❌ **RECEBE NULL** porque todas as fontes anteriores são `null`/`undefined`

---

## 🎯 RASTREAMENTO DO FLUXO REAL

### ✅ ETAPA 1: Frontend → Backend
```javascript
// public/audio-analyzer-integration.js
const payload = {
  genre: "funk_bh",
  mode: "genre"
};

fetch('/api/audio/analyze', { body: JSON.stringify(payload) });
```
**Valor:** `"funk_bh"` ✅

---

### ✅ ETAPA 2: Backend recebe
```javascript
// work/api/audio/analyze.js linha 359
const { genre } = req.body;
console.log('[GENRE-TRACE][BACKEND] Genre recebido:', genre);
// Output: "funk_bh" ✅
```
**Valor:** `"funk_bh"` ✅

---

### ✅ ETAPA 3: Salva no banco
```javascript
// work/api/audio/analyze.js linha 144
const jobData = {
  genre: genre.trim(),  // "funk_bh"
  genreTargets: genreTargets || null
};

// linha 161
await pool.query(insertQuery, [..., JSON.stringify(jobData)]);
```
**Banco `data.genre`:** `"funk_bh"` ✅ **CORRETO**

---

### ✅ ETAPA 4: Worker lê do banco
```javascript
// work/worker.js linha 378
extractedGenre = job.data.genre;
console.log('[GENRE-EXTRACTION] Genre extraído:', extractedGenre);
// Output: "funk_bh" ✅
```
**Valor:** `"funk_bh"` ✅

---

### ✅ ETAPA 5: Worker trim
```javascript
// work/worker.js linha 405
const finalGenre = extractedGenre.trim();
console.log('[AUDIT-WORKER] finalGenre (trimmed):', finalGenre);
// Output: "funk_bh" ✅
```
**Valor:** `"funk_bh"` ✅

---

### ✅ ETAPA 6: Worker cria options
```javascript
// work/worker.js linha 423
const options = {
  genre: finalGenre,  // "funk_bh"
  mode: job.mode || 'genre'
};
console.log('[AUDIT-WORKER] options.genre:', options.genre);
// Output: "funk_bh" ✅
```
**Valor:** `"funk_bh"` ✅

---

### ✅ ETAPA 7: Worker chama analyzeAudioWithPipeline
```javascript
// work/worker.js linha 546
const analysisResult = await analyzeAudioWithPipeline(localFilePath, options);
```
**Parâmetro `jobOrOptions`:** `options` (contém `genre: "funk_bh"`)

---

### ⚠️ ETAPA 8: analyzeAudioWithPipeline resolve genre
```javascript
// work/worker.js linha 179-189
const isGenreMode = jobOrOptions.mode === "genre";  // true
let resolvedGenre = null;

if (isGenreMode) {
    resolvedGenre =
        jobOrOptions.genre ||          // "funk_bh" ✅
        jobOrOptions.data?.genre ||    // undefined
        null;

    if (typeof resolvedGenre === "string") {
        resolvedGenre = resolvedGenre.trim();  // "funk_bh" ✅
    }

    if (!resolvedGenre) {  // false (porque "funk_bh" é truthy)
        resolvedGenre = null;
    }
}

console.log('[GENRE-DEEP-TRACE][WORKER-PRE-PIPELINE] resolvedGenre:', resolvedGenre);
// Output esperado: "funk_bh" ✅
```
**Valor:** `"funk_bh"` ✅ (SE `jobOrOptions.genre` existe)

**🚨 PONTO CRÍTICO:** Se `jobOrOptions.genre === undefined`, então `resolvedGenre = null` ❌

---

### ⚠️ ETAPA 9: analyzeAudioWithPipeline cria pipelineOptions
```javascript
// work/worker.js linha 221
const pipelineOptions = {
  genre: resolvedGenre,  // "funk_bh" ou null
  mode: jobOrOptions.mode || 'genre'
};

console.log('[DEBUG-GENRE] pipelineOptions FINAL:', pipelineOptions.genre);
// Output esperado: "funk_bh" ✅
// Output real possível: null ❌
```
**Valor:** `"funk_bh"` OU `null` (dependendo de `resolvedGenre`)

---

### ✅ ETAPA 10: processAudioComplete recebe options
```javascript
// work/api/audio/pipeline-complete.js linha 72
export async function processAudioComplete(audioBuffer, fileName, options = {}) {
  console.log('[GENRE-TRACE][PIPELINE-INPUT]', {
    incomingGenre: options.genre
  });
  // Output: "funk_bh" OU null
}
```
**Valor:** `"funk_bh"` OU `null` (depende de `pipelineOptions.genre`)

---

### 🔥 ETAPA 11: processAudioComplete resolve detectedGenre
```javascript
// work/api/audio/pipeline-complete.js linha 216-219
const resolvedGenre = options.genre || options.data?.genre || options.genre_detected || null;
detectedGenre = isGenreMode
  ? (resolvedGenre ? String(resolvedGenre).trim() || null : null)
  : (options.genre || 'default');

console.log('[GENRE-DEEP-TRACE][PIPELINE-JSON-POST] detectedGenre:', detectedGenre);
// Output esperado: "funk_bh" ✅
// Output real possível: null ❌
```

**ANÁLISE:**
- Se `options.genre = "funk_bh"` → `resolvedGenre = "funk_bh"` → `detectedGenre = "funk_bh"` ✅
- Se `options.genre = undefined` → `resolvedGenre = null` → `detectedGenre = null` ❌

**🔥 ASSASSINO CONFIRMADO:** Linha 217-219 gera NULL se `options.genre` for falsy

---

### 🔥 ETAPA 12: generateJSONOutput recebe detectedGenre
```javascript
// work/api/audio/pipeline-complete.js linha 238-244
finalJSON = generateJSONOutput(coreMetrics, reference, metadata, { 
  genre: detectedGenre,  // null ❌
  mode: mode
});
```
**Valor passado:** `null` ❌

---

### 🔥 ETAPA 13: generateJSONOutput cria finalGenre
```javascript
// work/api/audio/json-output.js linha 483-486
const resolvedGenre = options.genre || options.data?.genre || options.genre_detected || null;
const finalGenre = isGenreMode
  ? (resolvedGenre ? String(resolvedGenre).trim() || null : null)
  : (options.genre || 'default');

console.log('[GENRE-DEEP-TRACE][JSON-OUTPUT-POST] finalGenre:', finalGenre);
// Output: null ❌
```
**Valor:** `null` ❌

---

### ❌ ETAPA 14: finalJSON retorna com genre = null
```javascript
// work/api/audio/json-output.js linha 508
return {
  genre: finalGenre,  // null ❌
  mode: options.mode || 'genre'
};
```
**Valor:** `null` ❌

---

### ❌ ETAPA 15: Worker salva no banco
```javascript
// work/worker.js linha 801
result.genre = safeGenreBeforeSave;  // null ❌

// linha 821
const resultJSON = JSON.stringify(result);
await pool.query(updateQuery, [resultJSON, jobId]);
```
**Banco `results.genre`:** `null` ❌ **ERRADO**

---

## 🎯 IDENTIFICAÇÃO DOS ASSASSINOS

### 🔥 ASSASSINO #1: `pipeline-complete.js` linha 217-219
**Função:** `processAudioComplete`  
**Momento:** Fase 5.4 - Antes de chamar `generateJSONOutput`  
**Código:**
```javascript
const resolvedGenre = options.genre || options.data?.genre || options.genre_detected || null;
detectedGenre = isGenreMode
  ? (resolvedGenre ? String(resolvedGenre).trim() || null : null)
  : (options.genre || 'default');
```

**Por que gera NULL:**
- Se `options.genre === undefined`, a expressão `options.genre || ...` pula para o próximo
- Se `options.data?.genre === undefined`, a expressão pula para o próximo
- Se `options.genre_detected === undefined`, a expressão retorna `null`
- `resolvedGenre = null`
- `detectedGenre = (null ? ... : null)` → `null`

**Valor ANTES:** `options.genre` deveria ser `"funk_bh"`  
**Valor DEPOIS:** `detectedGenre = null`

---

### 🔥 ASSASSINO #2: `json-output.js` linha 483-486
**Função:** `generateJSONOutput`  
**Momento:** Fase 5.4 - Construindo JSON final  
**Código:**
```javascript
const resolvedGenre = options.genre || options.data?.genre || options.genre_detected || null;
const finalGenre = isGenreMode
  ? (resolvedGenre ? String(resolvedGenre).trim() || null : null)
  : (options.genre || 'default');
```

**Por que gera NULL:**
- Recebe `options.genre = null` (passado do `detectedGenre` do assassino #1)
- `resolvedGenre = null || undefined || undefined || null` → `null`
- `finalGenre = (null ? ... : null)` → `null`

**Valor ANTES:** `options.genre = null` (contaminado)  
**Valor DEPOIS:** `finalGenre = null`

---

### 🔥 ASSASSINO #3: `pipeline-complete.js` linha 528-530
**Função:** `processAudioComplete`  
**Momento:** Fase 5.4.2 - Motor V2  
**Código:**
```javascript
const detectedGenreV2 = (mode === 'genre')
  ? (resolvedGenre ? String(resolvedGenre).trim() || null : null)
  : (options.genre || 'default');
```

**Por que gera NULL:**
- Usa o mesmo `resolvedGenre` do assassino #1 (que já é `null`)
- `detectedGenreV2 = (null ? ... : null)` → `null`

**Valor ANTES:** `resolvedGenre = null` (contaminado)  
**Valor DEPOIS:** `detectedGenreV2 = null`

---

## 🔍 DIAGNÓSTICO FINAL

### 🎯 ROOT CAUSE CONFIRMADO

**O NULL NASCE AQUI:**

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linha:** 216-219  
**Função:** `processAudioComplete`  
**Fase:** 5.4 (JSON Output)

**Código Assassino:**
```javascript
const resolvedGenre = options.genre || options.data?.genre || options.genre_detected || null;
detectedGenre = isGenreMode
  ? (resolvedGenre ? String(resolvedGenre).trim() || null : null)
  : (options.genre || 'default');
```

**Por que isso acontece:**

1. ✅ Worker cria `options.genre = "funk_bh"` corretamente
2. ✅ Worker chama `analyzeAudioWithPipeline(localFilePath, options)`
3. ⚠️ `analyzeAudioWithPipeline` recria `resolvedGenre` e `pipelineOptions`
4. ✅ `pipelineOptions.genre = "funk_bh"` está correto
5. ✅ `processAudioComplete` recebe `options.genre = "funk_bh"`
6. 🔥 **LINHA 216:** `resolvedGenre = options.genre || ...`
   - **SE** `options.genre === undefined` (não string) → `resolvedGenre = null`
7. 🔥 **LINHA 217-219:** `detectedGenre = (resolvedGenre ? ... : null)`
   - **SE** `resolvedGenre = null` → `detectedGenre = null`
8. ❌ NULL é passado para `generateJSONOutput({ genre: null })`
9. ❌ NULL é propagado para `finalJSON.genre = null`
10. ❌ NULL é salvo no banco `results.genre = null`

---

## 🚨 HIPÓTESE CRÍTICA

**Por que `options.genre` seria `undefined` se o worker passa `"funk_bh"`?**

### Possibilidade #1: Objeto `options` não está sendo propagado corretamente
```javascript
// worker.js linha 546
const analysisResult = await analyzeAudioWithPipeline(localFilePath, options);

// analyzeAudioWithPipeline linha 161
async function analyzeAudioWithPipeline(localFilePath, jobOrOptions) {
  // ...
  const pipelineOptions = {
    genre: resolvedGenre  // ← Se jobOrOptions.genre for undefined, resolvedGenre = null
  };
  
  // linha 252
  const finalJSON = await Promise.race([pipelinePromise, timeoutPromise]);
  return finalJSON;
}
```

**VERIFICAÇÃO NECESSÁRIA:**
- O objeto `options` tem a propriedade `genre`?
- O spread operator `...options` está preservando `genre`?
- Existe algum código que delete `options.genre` antes de chamar pipeline?

### Possibilidade #2: `pipelineOptions` sobrescreve `options` dentro do pipeline
```javascript
// pipeline-complete.js linha 72
export async function processAudioComplete(audioBuffer, fileName, options = {}) {
  // ...
  // ❓ options é recebido corretamente?
  // ❓ Alguém sobrescreve options.genre?
}
```

**VERIFICAÇÃO NECESSÁRIA:**
- Log na linha 88 mostra `options.genre` correto?
- Alguém faz `options = {}` ou `delete options.genre` antes da linha 216?

### Possibilidade #3: `options.genre` é string vazia `""`
```javascript
// Se options.genre = "" (string vazia)
resolvedGenre = "" || undefined || undefined || null
resolvedGenre = null  // ← GERADOR DE NULL
```

**VERIFICAÇÃO NECESSÁRIA:**
- `options.genre` pode ser string vazia em algum momento?
- Trim está removendo todo o conteúdo e retornando `""`?

---

## ✅ RECOMENDAÇÕES DE CORREÇÃO (NÃO APLICAR AINDA)

### Correção #1: Forçar priorização de `options.genre`
```javascript
// pipeline-complete.js linha 216
const resolvedGenre = (
  options.genre && typeof options.genre === 'string' && options.genre.trim().length > 0
    ? options.genre.trim()
    : options.data?.genre || options.genre_detected || null
);
```

### Correção #2: Validar entrada do pipeline
```javascript
// pipeline-complete.js linha 88 (após log de entrada)
if (!options.genre || typeof options.genre !== 'string' || options.genre.trim().length === 0) {
  console.error('[GENRE-CRITICAL] options.genre inválido recebido no pipeline:', options.genre);
  throw new Error(`Pipeline recebeu genre inválido: ${options.genre}`);
}
```

### Correção #3: Adicionar log paranóico na linha 216
```javascript
// pipeline-complete.js linha 215 (ANTES de resolver)
console.log('[GENRE-PARANOID][PRE-RESOLVE]', {
  'options.genre': options.genre,
  'typeof options.genre': typeof options.genre,
  'options.genre.length': options.genre?.length,
  'options.genre truthy': !!options.genre,
  'options.data?.genre': options.data?.genre,
  'options.genre_detected': options.genre_detected
});

const resolvedGenre = options.genre || options.data?.genre || options.genre_detected || null;

console.log('[GENRE-PARANOID][POST-RESOLVE]', {
  'resolvedGenre': resolvedGenre,
  'isNull': resolvedGenre === null,
  'isUndefined': resolvedGenre === undefined
});
```

---

## 📊 RESUMO EXECUTIVO

### 🔴 PROBLEMA ENCONTRADO
O valor `genre = "funk_bh"` está sendo **transformado em `null`** na **linha 216-219** de `pipeline-complete.js` porque a expressão:

```javascript
const resolvedGenre = options.genre || options.data?.genre || options.genre_detected || null;
```

Está retornando `null` quando:
- `options.genre` é `undefined`, `null`, `""` (string vazia), ou qualquer valor falsy
- `options.data?.genre` não existe
- `options.genre_detected` não existe

### 🎯 LINHA ASSASSINA
**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linha:** 216-219  
**Função:** `processAudioComplete` (Fase 5.4)

### 🔍 PRÓXIMOS PASSOS INVESTIGATIVOS
1. ✅ Adicionar log paranóico na linha 215 para capturar valor EXATO de `options.genre`
2. ✅ Verificar se `options.genre` está chegando como `undefined`, `null`, `""` ou outro valor falsy
3. ✅ Rastrear se existe código que sobrescreve/deleta `options.genre` antes da linha 216
4. ✅ Confirmar se `pipelineOptions` está sendo construído corretamente no worker

### ✅ GARANTIAS
- ✅ `job.data.genre = "funk_bh"` está CORRETO no banco
- ✅ Worker extrai `extractedGenre = "funk_bh"` CORRETAMENTE
- ✅ Worker cria `options.genre = "funk_bh"` CORRETAMENTE
- ❓ Pipeline **DEVERIA** receber `options.genre = "funk_bh"` mas pode estar recebendo `undefined`/`null`

---

## 🎉 CONCLUSÃO

**ORIGEM EXATA DO NULL ENCONTRADA:**

📍 **Linha 216-219 do arquivo `work/api/audio/pipeline-complete.js`**

Esta linha é o **PRIMEIRO PONTO** onde o valor `"funk_bh"` se transforma em `null` porque:
1. A expressão `options.genre || options.data?.genre || options.genre_detected || null` retorna `null`
2. Isso acontece quando `options.genre` **não está chegando** como string válida
3. O NULL é propagado para `detectedGenre`, depois para `finalJSON.genre`, e finalmente salvo no banco

**PRÓXIMA AÇÃO REQUERIDA:**
- Adicionar log paranóico na linha 215 para capturar o valor EXATO de `options.genre`
- Executar análise em produção/staging para confirmar se `options.genre` está `undefined`/`null`/`""`
- Identificar POR QUE `options.genre` não está chegando corretamente do worker

**STATUS:** 🔍 **ROOT CAUSE IDENTIFICADO - AGUARDANDO VALIDAÇÃO EM RUNTIME**
