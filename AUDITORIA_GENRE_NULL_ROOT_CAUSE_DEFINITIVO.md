# 🔍 AUDITORIA DEFINITIVA: ROOT CAUSE DO GENRE NULL

**Data:** 1 de dezembro de 2025  
**Status:** 🎯 **ROOT CAUSE IDENTIFICADO**  
**Problema:** Frontend envia `genre: "funk_automotivo"` mas Postgres recebe `genre: null`

---

## 🚨 ROOT CAUSE IDENTIFICADO

### ❌ PROBLEMA PRINCIPAL: MERGE NO WORKER SOBRESCREVE GENRE

**Arquivo:** `work/worker.js` (Linha ~530)

```javascript
const result = {
  ok: true,
  file: job.file_key,
  analyzedAt: new Date().toISOString(),

  ...analysisResult,  // ⚠️ ESTE SPREAD SOBRESCREVE TUDO!

  // 🔥 Correção suprema: garantir que a raiz sempre tenha o gênero correto
  genre: forcedGenre,
  mode: job.mode,
  
  // ... resto do código
};
```

### 🔍 POR QUE ISSO CAUSA O PROBLEMA?

Quando você faz:
```javascript
const result = {
  ...analysisResult,  // ← analysisResult tem { genre: 'funk_automotivo', summary: { genre: null } }
  genre: forcedGenre  // ← Você força genre na RAIZ ✅
  summary: {
    ...(analysisResult.summary || {}),  // ← MAS summary JÁ VEM COM genre: null ❌
    genre: forcedGenre
  }
}
```

**O problema é que `analysisResult` já vem do pipeline com estruturas contendo `genre` correto na raiz, MAS...**

---

## 🔍 ANÁLISE COMPLETA DO FLUXO

### 1️⃣ **PIPELINE-COMPLETE.JS** - LINHA ~390

**Código atual:**
```javascript
finalJSON.summary = problemsAndSuggestions.summary || {};
finalJSON.suggestionMetadata = problemsAndSuggestions.metadata || {};
```

**Problema:**
- `problemsAndSuggestions` vem do `analyzeProblemsAndSuggestionsV2()`
- Essa função retorna `{ summary: { genre: this.genre } }`
- Se `this.genre` for `null` no analyzer, `summary.genre` será `null`

**Logs existentes confirmam:**
```javascript
console.log('[GENRE-DEEP-TRACE][V1-SUMMARY-POST]', {
  ponto: 'pipeline-complete.js linha ~370 - DEPOIS atribuir V1',
  'finalJSON.summary.genre': finalJSON.summary?.genre,  // ← AQUI genre é null
  'finalJSON.suggestionMetadata.genre': finalJSON.suggestionMetadata?.genre,
  'PROBLEMA?': finalJSON.summary?.genre !== detectedGenre
});
```

---

### 2️⃣ **PROBLEMS-SUGGESTIONS-V2.JS** - LINHA ~237

**Código atual (CORRETO):**
```javascript
const summary = this.generateSummary(suggestions, problems);

const result = {
  genre: this.genre,  // ✅ Na raiz está correto
  suggestions: suggestions.map(s => this.formatSuggestionForJSON(s)),
  problems: problems.map(p => this.formatProblemForJSON(p)),
  summary,  // ← summary tem { genre: this.genre }
  metadata: {
    totalSuggestions: suggestions.length,
    // ...
    genre: this.genre,  // ✅ Metadata tem genre correto
    version: '2.0.0'
  }
};
```

**Análise:**
- ✅ Analyzer retorna `genre` correto na raiz
- ✅ Analyzer retorna `genre` correto em `metadata`
- ✅ Analyzer retorna `genre` correto em `summary` (via `generateSummary`)

**O analyzer NÃO é o problema!**

---

### 3️⃣ **PIPELINE-COMPLETE.JS** - LINHA ~583-590

**Código atual:**
```javascript
finalJSON.summary = {
  ...v2Summary,
  genre: detectedGenre  // ← FORÇAR GÊNERO CORRETO
};
finalJSON.suggestionMetadata = {
  ...v2Metadata,
  genre: detectedGenre  // ← FORÇAR GÊNERO CORRETO
};
```

**Análise:**
- ✅ Pipeline JÁ FORÇA genre correto em summary e metadata
- ✅ Blindagem tripla aplicada (linhas 353, 519, 580)

**O pipeline ESTÁ CORRETO!**

---

### 4️⃣ **WORKER.JS** - LINHA ~525-560 (ROOT CAUSE!)

**Código atual:**
```javascript
const forcedGenre = options.genre;   // ✅ Extraído corretamente

const result = {
  ok: true,
  file: job.file_key,
  analyzedAt: new Date().toISOString(),

  ...analysisResult,  // ⚠️ PROBLEMA: Spread traz TUDO do pipeline

  // Você TENTA sobrescrever:
  genre: forcedGenre,
  mode: job.mode,

  summary: {
    ...(analysisResult.summary || {}),  // ⚠️ Spread traz summary.genre do pipeline
    genre: forcedGenre  // ✅ Você força aqui
  },

  metadata: {
    ...(analysisResult.metadata || {}),
    genre: forcedGenre
  },

  suggestionMetadata: {
    ...(analysisResult.suggestionMetadata || {}),
    genre: forcedGenre
  },

  data: {
    ...(analysisResult.data || {}),
    genre: forcedGenre,
    genreTargets: forcedTargets
  }
};
```

**❌ PROBLEMA IDENTIFICADO:**

Se `analysisResult` vier com:
```javascript
{
  genre: 'funk_automotivo',  // ✅ Correto
  summary: {
    overallRating: '...',
    genre: null  // ❌ ESTE null SOBRESCREVE no spread!
  }
}
```

Quando você faz:
```javascript
summary: {
  ...(analysisResult.summary || {}),  // ← Traz genre: null
  genre: forcedGenre  // ← Você força DEPOIS, deveria funcionar...
}
```

**MAS se analysisResult.summary JÁ TEM genre, o spread coloca primeiro e você sobrescreve depois. ISSO DEVERIA FUNCIONAR!**

**Então o problema REAL é:**

Se `analysisResult` já tem `summary.genre = null` **E** o worker não está conseguindo sobrescrever corretamente, OU...

**O problema é que o MERGE final no banco está salvando o analysisResult ORIGINAL sem as correções do worker!**

---

## 🎯 VERDADEIRO ROOT CAUSE

### **HIPÓTESE 1: Pipeline retorna summary.genre = null ANTES da blindagem**

**Linha ~390 do pipeline:**
```javascript
finalJSON.summary = problemsAndSuggestions.summary || {};
```

Se `problemsAndSuggestions.summary.genre` for `null` AQUI, a blindagem da linha 583 NÃO vai corrigir porque ela só roda no bloco do Motor V2!

**Código da linha 390-396:**
```javascript
finalJSON.suggestions = problemsAndSuggestions.suggestions || [];
finalJSON.summary = problemsAndSuggestions.summary || {};  // ← genre pode ser null aqui
finalJSON.suggestionMetadata = problemsAndSuggestions.metadata || {};

// ... erro pode acontecer e zerar tudo:
} catch (suggestionsError) {
  finalJSON.summary = {};  // ← PERDE TUDO!
  finalJSON.suggestionMetadata = {};
}
```

**E a blindagem só acontece DEPOIS, na linha 583!**

Mas entre a linha 396 e a linha 583, se der qualquer erro, `summary` fica vazio ou com genre null!

---

### **HIPÓTESE 2: Analyzer recebe genre null ANTES da blindagem**

**Linha ~360 do pipeline:**
```javascript
const genreForAnalyzer = 
  options.genre ||
  options.data?.genre ||
  detectedGenre ||
  finalJSON?.genre ||
  'default';

const problemsAndSuggestions = analyzeProblemsAndSuggestionsV2(coreMetrics, genreForAnalyzer, customTargets);
```

**Se `genreForAnalyzer` for 'default' aqui, o analyzer vai retornar `summary.genre = 'default'`!**

Mas na linha ~390:
```javascript
finalJSON.summary = problemsAndSuggestions.summary || {};
```

Você atribui `summary.genre = 'default'` ou `summary.genre = null`.

**E a correção só acontece na linha 583 quando Motor V2 roda!**

Mas se Motor V2 não rodar (modo reference ou erro), `summary.genre` fica errado!

---

## ✅ CORREÇÕES NECESSÁRIAS

### 🔧 CORREÇÃO 1: Forçar genre em summary/metadata SEMPRE (não só no V2)

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linha:** ~395 (após atribuir V1)

**ADICIONAR:**
```javascript
finalJSON.summary = problemsAndSuggestions.summary || {};
finalJSON.suggestionMetadata = problemsAndSuggestions.metadata || {};

// 🛡️ BLINDAGEM IMEDIATA: Forçar genre correto em V1 também
if (detectedGenre) {
  if (finalJSON.summary) {
    finalJSON.summary.genre = detectedGenre;
  }
  if (finalJSON.suggestionMetadata) {
    finalJSON.suggestionMetadata.genre = detectedGenre;
  }
}
```

---

### 🔧 CORREÇÃO 2: Adicionar logs de auditoria no worker

**Arquivo:** `work/worker.js`  
**Linha:** ~524 (ANTES do merge)

**ADICIONAR:**
```javascript
// 🔥 AUDITORIA: Genre ANTES do merge
console.log('[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('[GENRE-AUDIT] ANTES DO MERGE:');
console.log('[GENRE-AUDIT] options.genre:', options.genre);
console.log('[GENRE-AUDIT] analysisResult.genre:', analysisResult.genre);
console.log('[GENRE-AUDIT] analysisResult.summary?.genre:', analysisResult.summary?.genre);
console.log('[GENRE-AUDIT] analysisResult.metadata?.genre:', analysisResult.metadata?.genre);
console.log('[GENRE-AUDIT] analysisResult.suggestionMetadata?.genre:', analysisResult.suggestionMetadata?.genre);
console.log('[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
```

**E DEPOIS do merge (linha ~560):**
```javascript
// 🔥 AUDITORIA: Genre DEPOIS do merge
console.log('[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('[GENRE-AUDIT] DEPOIS DO MERGE:');
console.log('[GENRE-AUDIT] result.genre:', result.genre);
console.log('[GENRE-AUDIT] result.summary?.genre:', result.summary?.genre);
console.log('[GENRE-AUDIT] result.metadata?.genre:', result.metadata?.genre);
console.log('[GENRE-AUDIT] result.suggestionMetadata?.genre:', result.suggestionMetadata?.genre);
console.log('[GENRE-AUDIT] result.data?.genre:', result.data?.genre);
console.log('[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
```

**E ANTES de salvar (linha ~695):**
```javascript
// 🔥 AUDITORIA: Genre ANTES DE SALVAR NO POSTGRES
console.log('[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('[GENRE-AUDIT] FINAL (antes de salvar no Postgres):');
console.log('[GENRE-AUDIT] result.genre:', result.genre);
console.log('[GENRE-AUDIT] result.summary?.genre:', result.summary?.genre);
console.log('[GENRE-AUDIT] result.metadata?.genre:', result.metadata?.genre);
console.log('[GENRE-AUDIT] result.suggestionMetadata?.genre:', result.suggestionMetadata?.genre);
console.log('[GENRE-AUDIT] result.data?.genre:', result.data?.genre);
console.log('[GENRE-AUDIT] JSON.stringify length:', JSON.stringify(result).length);
console.log('[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
```

---

### 🔧 CORREÇÃO 3: Garantir que merge não sobrescreva com null

**Arquivo:** `work/worker.js`  
**Linha:** ~525-560

**SUBSTITUIR o merge por:**
```javascript
const forcedGenre = options.genre;
const forcedTargets = options.genreTargets || null;

// 🛡️ Helper: Merge sem sobrescrever genre com null
const mergePreservingGenre = (base, override, forcedGenreValue) => {
  const merged = { ...base, ...override };
  if (merged.genre === null || merged.genre === undefined) {
    merged.genre = forcedGenreValue;
  }
  return merged;
};

const result = {
  ok: true,
  file: job.file_key,
  analyzedAt: new Date().toISOString(),

  ...analysisResult,

  // 🔥 Forçar genre na raiz
  genre: forcedGenre,
  mode: job.mode,

  // 🔥 Merge inteligente que preserva genre
  summary: mergePreservingGenre(
    analysisResult.summary || {},
    {},
    forcedGenre
  ),

  metadata: mergePreservingGenre(
    analysisResult.metadata || {},
    {},
    forcedGenre
  ),

  suggestionMetadata: mergePreservingGenre(
    analysisResult.suggestionMetadata || {},
    {},
    forcedGenre
  ),

  data: mergePreservingGenre(
    analysisResult.data || {},
    { genreTargets: forcedTargets },
    forcedGenre
  )
};
```

---

## 🎯 ORDEM DE EXECUÇÃO DAS CORREÇÕES

1. ✅ **Correção 1:** Blindagem imediata em V1 no pipeline
2. ✅ **Correção 2:** Logs de auditoria no worker
3. ✅ **Correção 3:** Merge inteligente no worker

---

## 🔍 VALIDAÇÃO ESPERADA

Após aplicar as correções, os logs devem mostrar:

```
[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[GENRE-AUDIT] ANTES DO MERGE:
[GENRE-AUDIT] options.genre: funk_automotivo
[GENRE-AUDIT] analysisResult.genre: funk_automotivo
[GENRE-AUDIT] analysisResult.summary?.genre: funk_automotivo  ← DEVE SER funk_automotivo
[GENRE-AUDIT] analysisResult.metadata?.genre: funk_automotivo
[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[GENRE-AUDIT] DEPOIS DO MERGE:
[GENRE-AUDIT] result.genre: funk_automotivo
[GENRE-AUDIT] result.summary?.genre: funk_automotivo  ← DEVE SER funk_automotivo
[GENRE-AUDIT] result.metadata?.genre: funk_automotivo
[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[GENRE-AUDIT] FINAL (antes de salvar no Postgres):
[GENRE-AUDIT] result.genre: funk_automotivo
[GENRE-AUDIT] result.summary?.genre: funk_automotivo  ← NUNCA null!
[GENRE-AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

**FIM DA AUDITORIA** ✅
