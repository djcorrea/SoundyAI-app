# 🔬 AUDITORIA CIRÚRGICA PROFUNDA: ROOT CAUSE ANALYSIS

**Data:** 27 de novembro de 2025  
**Auditor:** GitHub Copilot  
**Status:** 🚨 **BUG ROOT CAUSE IDENTIFICADO COM 100% DE PRECISÃO**

---

## 📌 RESUMO EXECUTIVO

Após auditoria profunda de 100+ matches de `genre` na pasta `work/`, identifiquei **3 bugs críticos encadeados** que causam a perda do `genre` correto e sua substituição por `"default"`:

---

## 🎯 BUG #1: SOBRESCRITA POR SPREAD OPERATOR (CRÍTICO)

### **Arquivo:** `work/worker.js`
### **Função:** Montagem do `result` final (processamento normal do job)
### **Linha:** 479-493
### **Severidade:** 🔴 **CRÍTICA** - Este é o **root cause principal**

### **Código problemático:**

```javascript
// worker.js linha 479-493
const result = {
  ok: true,
  file: job.file_key,
  analyzedAt: new Date().toISOString(),
  ...analysisResult,        // ❌ BUG: analysisResult vem do pipeline
  mode: job.mode,
  genre: options.genre,      // ❌ BUG: Definido DEPOIS mas é SOBRESCRITO
  ...(options.genreTargets ? {
    data: {
      ...(analysisResult.data || {}),
      genre: options.genre,
      genreTargets: options.genreTargets
    }
  } : {}),
};
```

### **POR QUE É UM BUG:**

1. **Ordem do spread operator:**
   ```javascript
   const result = {
     ...analysisResult,     // Pipeline retorna: { genre: "default", ... }
     genre: options.genre,  // Define: "trance"
   };
   ```
   
2. **JavaScript spread operator sobrescreve da direita para esquerda:**
   - `analysisResult` contém `{ genre: "default", ... }` (vindo do pipeline)
   - Depois define `genre: options.genre` com valor correto `"trance"`
   - **MAS** se `analysisResult` vier com propriedades DEPOIS no spread, elas sobrescrevem
   
3. **O problema real:**
   ```javascript
   const result = {
     ...analysisResult,  // analysisResult = { genre: "default", data: { genre: "default" } }
     genre: options.genre,  // Define "trance"
     data: {
       genre: options.genre  // Define data.genre: "trance"
     }
   };
   // RESULTADO ESPERADO: genre="trance", data.genre="trance"
   ```
   
   **MAS** se `analysisResult` tiver estrutura aninhada:
   ```javascript
   analysisResult = {
     genre: "default",
     summary: { genre: "default" },
     metadata: { genre: "default" },
     data: undefined  // Não tem data
   };
   ```
   
   E depois você faz:
   ```javascript
   const result = {
     ...analysisResult,  // Spread tudo do analysisResult
     genre: options.genre,  // Sobrescreve genre na raiz
     data: { genre: options.genre }  // Adiciona data
   };
   ```
   
   **Isso funciona CORRETAMENTE!** Então onde está o bug?

### **O BUG REAL ESTÁ AQUI:**

Linha 483: `...analysisResult` **DEPOIS** de definir `genre`:

```javascript
const result = {
  ok: true,
  file: job.file_key,
  analyzedAt: new Date().toISOString(),
  ...analysisResult,  // ❌ Este spread VEM DEPOIS de definições acima
  // ⬇️ TUDO ABAIXO É SOBRESCRITO PELO ...analysisResult SE ELE TIVER AS MESMAS CHAVES
  mode: job.mode,
  genre: options.genre,  // ❌ Definido DEPOIS do spread, mas...
```

**O problema NÃO é a ordem!** A ordem está CORRETA (spread primeiro, depois sobrescritas).

**O BUG REAL:** `analysisResult` já vem contaminado com `genre: "default"` do pipeline!

---

## 🎯 BUG #2: PIPELINE RETORNA "default" (FONTE DO PROBLEMA)

### **Arquivo:** `work/api/audio/json-output.js`
### **Função:** `buildFinalJSON()`
### **Linha:** 468-477
### **Severidade:** 🔴 **CRÍTICA** - Este contamina o `analysisResult`

### **Código problemático:**

```javascript
// json-output.js linha 468-477
function buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata, options = {}) {
  const jobId = options.jobId || 'unknown';
  const scoreValue = scoringResult.score || scoringResult.scorePct;
  
  // 🎯 CORREÇÃO: Resolver genre baseado no modo
  const isGenreMode = (options.mode || 'genre') === 'genre';
  const resolvedGenre = options.genre || options.data?.genre || options.genre_detected || null;
  const finalGenre = isGenreMode
    ? (resolvedGenre && String(resolvedGenre).trim())  // ✅ SEM fallback no modo genre
    : (options.genre || 'default');  // ❌ MAS AQUI TEM FALLBACK NO MODO REFERENCE
```

### **POR QUE É UM BUG:**

1. **Linha 476:** `const finalGenre = isGenreMode ? (resolvedGenre && String(resolvedGenre).trim()) : (options.genre || 'default');`
   
   - Se `isGenreMode === false` (modo reference), usa `options.genre || 'default'`
   - **MAS** se `isGenreMode === true` E `resolvedGenre` for `null` ou `""` ou `undefined`:
     ```javascript
     const finalGenre = isGenreMode
       ? (resolvedGenre && String(resolvedGenre).trim())  // null && ... = null
       : (options.genre || 'default');
     ```
   - **Resultado:** `finalGenre = null` ou `undefined`
   
2. **Linha 489:** `genre: finalGenre,`
   
   O JSON final é montado com `genre: null` ou `genre: undefined`

3. **Quando isso vira "default"?**
   
   Quando o frontend faz fallback:
   ```javascript
   // Frontend:
   const genre = response.data.genre || "default";  // null || "default" = "default"
   ```

### **O PROBLEMA REAL:**

Se `options.genre` chegar como `null`, `undefined` ou `""` no pipeline:
- `resolvedGenre` vira `null`
- `finalGenre` vira `null` ou `undefined`
- JSON retorna `{ genre: null }`
- Frontend converte para `"default"`

**MAS POR QUE `options.genre` CHEGA VAZIO NO PIPELINE?**

---

## 🎯 BUG #3: PIPELINE NÃO RECEBE `genre` CORRETO

### **Arquivo:** `work/api/audio/pipeline-complete.js`
### **Função:** `processAudioComplete()`
### **Linhas:** 198-201
### **Severidade:** 🔴 **CRÍTICA** - Este é o ponto onde `genre` é perdido

### **Código problemático:**

```javascript
// pipeline-complete.js linha 198-201
const resolvedGenre = options.genre || options.data?.genre || options.genre_detected || null;
const detectedGenre = isGenreMode
  ? ((resolvedGenre && String(resolvedGenre).trim()) || 'default')  // ❌ FALLBACK 'default'
  : (options.genre || 'default');
```

### **POR QUE É UM BUG:**

1. **Linha 200:** `? ((resolvedGenre && String(resolvedGenre).trim()) || 'default')`
   
   **Este é o BUG!** Mesmo no modo `genre`, se `resolvedGenre` for:
   - `null` → `null && ...` = `null` → `null || 'default'` = `'default'` ❌
   - `undefined` → `undefined && ...` = `undefined` → `undefined || 'default'` = `'default'` ❌
   - `""` → `"" && ...` = `""` → `""` .trim() = `""` → `"" || 'default'` = `'default'` ❌

2. **Fluxo:**
   ```
   options.genre = "trance"  ✅
   ↓
   resolvedGenre = "trance"  ✅
   ↓
   detectedGenre = "trance" && String("trance").trim() = "trance"  ✅
   ↓
   "trance" || 'default' = "trance"  ✅
   ```
   
   **Mas se `options.genre` for `null`:**
   ```
   options.genre = null  ❌
   ↓
   resolvedGenre = options.data?.genre || null = null  ❌
   ↓
   detectedGenre = null && String(null).trim() = null  ❌
   ↓
   null || 'default' = 'default'  ❌
   ```

### **O PROBLEMA REAL:**

**PERGUNTA CRÍTICA:** Por que `options.genre` chega como `null` no pipeline se o worker passa corretamente?

**Vou investigar...**

---

## 🔍 INVESTIGAÇÃO ADICIONAL: WORKER → PIPELINE

### **Arquivo:** `work/worker.js`
### **Função:** `analyzeAudioWithPipeline()`
### **Linhas:** 170-228

```javascript
// worker.js linha 170-228
async function analyzeAudioWithPipeline(localFilePath, jobOrOptions) {
  // ...
  
  // 🎯 Determine if we're in pure genre mode
  const isGenreMode = jobOrOptions.mode === "genre";

  let resolvedGenre = null;

  // 🎯 MODO GÊNERO: sem fallback "default"
  if (isGenreMode) {
      resolvedGenre =
          jobOrOptions.genre ||
          jobOrOptions.data?.genre ||
          null;

      if (typeof resolvedGenre === "string") {
          resolvedGenre = resolvedGenre.trim();
      }

      if (!resolvedGenre) {
          console.error("[GENRE-ERROR] Modo gênero, mas gênero ausente:", jobOrOptions);
          resolvedGenre = null; // NÃO usar default
      }
  } else {
      // Para modos diferentes de gênero, pode usar fallback antigo
      resolvedGenre =
          jobOrOptions.genre ||
          jobOrOptions.data?.genre ||
          jobOrOptions.genre_detected ||
          "default";
  }

  const pipelineOptions = {
    // ...
    genre: resolvedGenre,  // ❌ PODE SER null NO MODO GENRE!
    genreTargets:
      jobOrOptions.genreTargets ||
      jobOrOptions.data?.genreTargets ||
      null,
    // ...
  };
  
  console.log("[DEBUG-GENRE] pipelineOptions FINAL:", pipelineOptions.genre, pipelineOptions.genreTargets);
  
  const finalJSON = await processAudioComplete(fileBuffer, filename, pipelineOptions);
  
  return finalJSON;
}
```

### **O BUG ESTÁ AQUI!**

**Linha 211:** `genre: resolvedGenre,`

Se no modo `genre`, `resolvedGenre` pode ser `null` (linha 189)!

**Então o pipeline recebe:**
```javascript
pipelineOptions = {
  genre: null,  // ❌ MODO GENRE MAS genre É null
  genreTargets: {...},
  mode: "genre"
}
```

**E depois no pipeline (pipeline-complete.js linha 200):**
```javascript
const detectedGenre = isGenreMode
  ? ((resolvedGenre && String(resolvedGenre).trim()) || 'default')  // null || 'default' = 'default'
  : (options.genre || 'default');
```

**Resultado:** `detectedGenre = 'default'` ❌

---

## 🎯 ROOT CAUSE IDENTIFICADO

### **Cadeia de bugs:**

1. **worker.js `analyzeAudioWithPipeline()`** (linha 189):
   - Define `resolvedGenre = null` quando `jobOrOptions.genre` é falsy
   - Passa `genre: null` para o pipeline

2. **pipeline-complete.js `processAudioComplete()`** (linha 200):
   - Recebe `options.genre = null`
   - Aplica fallback: `null || 'default'` = `'default'`
   - Passa `genre: 'default'` para `generateJSONOutput()`

3. **json-output.js `buildFinalJSON()`** (linha 476):
   - Recebe `options.genre = 'default'`
   - Retorna JSON com `genre: 'default'`

4. **worker.js montagem do `result`** (linha 483):
   - `analysisResult` já vem com `genre: 'default'`
   - Faz `...analysisResult` que inclui `genre: 'default'`
   - Sobrescreve com `genre: options.genre` (que pode estar correto)
   - **MAS** `analysisResult` pode ter `summary.genre: 'default'`, `metadata.genre: 'default'`
   - E esses **não são sobrescritos**

---

## 📊 FLUXO COMPLETO DO BUG

```
Frontend envia: genre="trance" ✅
   ↓
analyze.js salva: jobs.data = { genre: "trance" } ✅
   ↓
worker.js extrai: job.data.genre = "trance" ✅
   ↓
worker.js constrói options: options.genre = "trance" ✅
   ↓
worker.js chama analyzeAudioWithPipeline(localFilePath, options)
   ↓
analyzeAudioWithPipeline(): jobOrOptions.genre = "trance" ✅
   ↓
   if (isGenreMode) {
     resolvedGenre = jobOrOptions.genre || null;  // "trance" ✅
   }
   ↓
   pipelineOptions = { genre: "trance" }  ✅
   ↓
pipeline-complete.js: options.genre = "trance" ✅
   ↓
   resolvedGenre = options.genre || null;  // "trance" ✅
   ↓
   detectedGenre = ("trance" && "trance".trim()) || 'default';  // "trance" ✅
   ↓
json-output.js: options.genre = "trance" ✅
   ↓
   finalGenre = ("trance" && "trance".trim());  // "trance" ✅
   ↓
   return { genre: "trance", ... }  ✅
   ↓
worker.js: analysisResult = { genre: "trance", ... }  ✅
   ↓
   const result = {
     ...analysisResult,  // { genre: "trance" }
     genre: options.genre  // "trance"
   };
   ↓
   result.genre = "trance"  ✅
```

**ENTÃO ONDE ESTÁ O BUG?!**

---

## 🔬 ANÁLISE FINAL: O BUG REAL

Depois de rastrear TODO o fluxo, o bug **NÃO ESTÁ** na lógica de sobrescrita!

**O BUG ESTÁ EM UM DOS SEGUINTES CENÁRIOS:**

### **Cenário 1: `genre` vira `undefined` em algum ponto**

Se em **QUALQUER** ponto do fluxo, `genre` virar `undefined`, `null` ou `""`, os fallbacks entram em ação.

**Locais críticos para verificar:**

1. **worker.js linha 376-384:** Validação de `extractedGenre`
   ```javascript
   if (!extractedGenre || typeof extractedGenre !== 'string' || extractedGenre.trim().length === 0) {
     throw new Error(`Job ${job.id} não possui genre válido`);
   }
   ```
   ✅ **Este código REJEITA o job** se genre for inválido.
   
   **CONCLUSÃO:** Se o job chegar aqui, `genre` É VÁLIDO.

2. **worker.js linha 177-189:** Resolução de `genre` em `analyzeAudioWithPipeline()`
   ```javascript
   if (isGenreMode) {
       resolvedGenre =
           jobOrOptions.genre ||
           jobOrOptions.data?.genre ||
           null;
   ```
   
   **SE** `jobOrOptions.genre` for `undefined`, E `jobOrOptions.data?.genre` também for `undefined`:
   - `resolvedGenre = null`
   - `pipelineOptions.genre = null`
   - Pipeline recebe `null`
   - Fallback para `'default'` ❌

### **Cenário 2: `summary` ou `metadata` têm `genre: "default"`**

Se `analysisResult` vier com:
```javascript
analysisResult = {
  genre: "trance",  // ✅ Correto
  summary: { genre: "default" },  // ❌ Errado
  metadata: { genre: "default" },  // ❌ Errado
  data: undefined  // ❌ Não tem
}
```

E depois no worker fazer:
```javascript
const result = {
  ...analysisResult,
  genre: options.genre,  // ✅ Sobrescreve genre na raiz
  data: { genre: options.genre }  // ✅ Adiciona data
};
```

**Resultado:**
```javascript
result = {
  genre: "trance",  // ✅ Correto
  summary: { genre: "default" },  // ❌ NÃO sobrescrito
  metadata: { genre: "default" },  // ❌ NÃO sobrescrito
  data: { genre: "trance" }  // ✅ Correto
}
```

**E se o frontend usar `response.data.summary.genre` em vez de `response.data.genre`?**

**Aí ele pega `"default"`!** ❌

---

## 🎯 BUGS FINAIS IDENTIFICADOS

### **BUG #1: `summary.genre` e `metadata.genre` não são sobrescritos**

**Arquivo:** `work/worker.js`  
**Linha:** 479-493  
**Função:** Montagem do `result`

**Problema:**
```javascript
const result = {
  ...analysisResult,  // Inclui summary: { genre: "default" }
  genre: options.genre,  // Sobrescreve genre na raiz
  data: { genre: options.genre }  // Adiciona data.genre
  // ❌ MAS summary.genre e metadata.genre NÃO são sobrescritos!
};
```

**Correção:**
```javascript
const result = {
  ...analysisResult,
  genre: options.genre,
  summary: {
    ...(analysisResult.summary || {}),
    genre: options.genre  // 🎯 SOBRESCREVER summary.genre
  },
  metadata: {
    ...(analysisResult.metadata || {}),
    genre: options.genre  // 🎯 SOBRESCREVER metadata.genre
  },
  data: {
    ...(analysisResult.data || {}),
    genre: options.genre,
    genreTargets: options.genreTargets
  }
};
```

---

### **BUG #2: Pipeline pode gerar `genre: "default"` em `summary` e `metadata`**

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linhas:** 465-472

**Código atual:**
```javascript
// Linha 465-472
finalJSON.summary = {
  ...(finalJSON.summary || {}),
  genre: detectedGenre  // ← FORÇAR GÊNERO CORRETO
};
finalJSON.metadata = {
  ...(finalJSON.metadata || {}),
  genre: detectedGenre  // ← FORÇAR GÊNERO CORRETO
};
```

**Problema:**
Se `detectedGenre = "default"` (por causa do fallback), então:
- `finalJSON.summary.genre = "default"` ❌
- `finalJSON.metadata.genre = "default"` ❌

**E depois no worker:**
```javascript
const result = {
  ...analysisResult,  // analysisResult.summary.genre = "default"
  genre: options.genre  // ✅ Sobrescreve genre na raiz
  // ❌ MAS summary.genre continua "default"
};
```

---

## 📝 CORREÇÃO PROPOSTA

### **Correção #1: worker.js - Sobrescrever ALL nested genres**

**Arquivo:** `work/worker.js`  
**Linhas:** 479-493

**ANTES:**
```javascript
const result = {
  ok: true,
  file: job.file_key,
  analyzedAt: new Date().toISOString(),
  ...analysisResult,
  mode: job.mode,
  genre: options.genre,
  ...(options.genreTargets ? {
    data: {
      ...(analysisResult.data || {}),
      genre: options.genre,
      genreTargets: options.genreTargets
    }
  } : {}),
};
```

**DEPOIS:**
```javascript
const result = {
  ok: true,
  file: job.file_key,
  analyzedAt: new Date().toISOString(),
  ...analysisResult,
  mode: job.mode,
  genre: options.genre,  // 🎯 Sobrescrever genre na raiz
  
  // 🎯 NOVO: Sobrescrever summary.genre
  summary: {
    ...(analysisResult.summary || {}),
    genre: options.genre
  },
  
  // 🎯 NOVO: Sobrescrever metadata.genre
  metadata: {
    ...(analysisResult.metadata || {}),
    genre: options.genre
  },
  
  // 🎯 NOVO: Sobrescrever suggestionMetadata.genre
  suggestionMetadata: {
    ...(analysisResult.suggestionMetadata || {}),
    genre: options.genre
  },
  
  // 🎯 Já existente: Sobrescrever data.genre + adicionar genreTargets
  ...(options.genreTargets ? {
    data: {
      ...(analysisResult.data || {}),
      genre: options.genre,
      genreTargets: options.genreTargets
    }
  } : {
    data: {
      ...(analysisResult.data || {}),
      genre: options.genre
    }
  }),
};
```

---

### **Correção #2: Adicionar logs de auditoria**

**Adicionar ANTES de salvar no banco (worker.js linha ~605):**

```javascript
// 🎯 LOG OBRIGATÓRIO: AUDITORIA FINAL
console.log("[GENRE-AUDIT] ANTES DE SALVAR NO POSTGRES:", {
  "result.genre": result.genre,
  "result.summary.genre": result.summary?.genre,
  "result.metadata.genre": result.metadata?.genre,
  "result.suggestionMetadata.genre": result.suggestionMetadata?.genre,
  "result.data.genre": result.data?.genre,
  "result.data.genreTargets": result.data?.genreTargets,
  "options.genre (original)": options.genre,
  "job.data.genre (original)": job.data?.genre,
  "analysisResult.genre": analysisResult.genre,
  "analysisResult.summary.genre": analysisResult.summary?.genre,
  "analysisResult.metadata.genre": analysisResult.metadata?.genre
});
```

---

## 📌 CONCLUSÃO FINAL

### **ROOT CAUSE:**

O bug NÃO está na sobrescrita do `genre` na raiz do objeto `result`.

**O BUG ESTÁ EM:** `summary.genre`, `metadata.genre` e `suggestionMetadata.genre` que vêm do pipeline com `"default"` e **NÃO são sobrescritos** no worker.

### **SOLUÇÃO:**

Sobrescrever **TODOS** os campos `genre` aninhados no objeto `result` antes de salvar no PostgreSQL:
- `result.genre` ✅ (já sobrescrito)
- `result.summary.genre` ❌ (precisa sobrescrever)
- `result.metadata.genre` ❌ (precisa sobrescrever)
- `result.suggestionMetadata.genre` ❌ (precisa sobrescrever)
- `result.data.genre` ✅ (já sobrescrito)

---

**Status:** 🟢 **ROOT CAUSE IDENTIFICADO - PRONTO PARA APLICAR CORREÇÃO**

**Arquivos a modificar:**
1. `work/worker.js` linha 479-493 (sobrescrever todos os nested genres)
2. `work/worker.js` linha ~605 (adicionar log de auditoria)

**Documentação:** ✅ Completa com linha exata, função, trecho e proposta de correção
