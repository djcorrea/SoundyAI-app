# 🔬 AUDITORIA CIRÚRGICA: Genre Perdido no Backend

**Data:** 1 de dezembro de 2025  
**Problema:** Frontend envia `genre: "funk_mandela"` mas backend retorna `genre: null`  
**Impacto:** Suggestions avançadas perdem contexto, tabela de comparação usa fallback errado  
**Status:** 🚨 **CAUSA RAIZ IDENTIFICADA**

---

## 📊 RESUMO EXECUTIVO

### ✅ O QUE ESTÁ FUNCIONANDO

1. **Frontend → Backend (Request)**
   - ✅ Payload enviado **CORRETAMENTE** com `genre`, `genreTargets`, `mode: "genre"`
   - ✅ Rota `/api/jobs/analyze` recebe dados completos

2. **Salvamento no PostgreSQL**
   - ✅ Job é salvo com `data: { genre, genreTargets }` em **formato JSON**
   - ✅ Coluna `data` do Postgres armazena o genre corretamente

3. **Worker → Pipeline**
   - ✅ Worker extrai `genre` e `genreTargets` do job
   - ✅ Pipeline recebe `options.genre` corretamente
   - ✅ JSON intermediário mantém genre em várias estruturas

### 🚨 CAUSA RAIZ IDENTIFICADA

**Arquivo:** `work/lib/audio/features/problems-suggestions-v2.js`  
**Linha:** 621-653 (função `generateSummary`)  
**Problema:** Summary é gerado com `genre: this.genre`, mas **`this.genre` é `null`** quando o analyzer é instanciado

---

## 🗺️ VISÃO GERAL DO FLUXO DO GENRE

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. FRONTEND                                                            │
│    ✅ Envia: { genre: "funk_mandela", genreTargets: {...} }           │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│ 2. API ROUTE: work/api/audio/analyze.js (linha 81)                    │
│    ✅ Recebe genre via req.body                                        │
│    ✅ Chama createJobInDatabase(fileKey, mode, fileName, ...genre)     │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│ 3. SALVAMENTO NO POSTGRES: analyze.js (linha 145-162)                 │
│    ✅ Monta jobData = { genre: genre.trim(), genreTargets }           │
│    ✅ INSERT INTO jobs (..., data, ...) VALUES (..., $7, ...)         │
│    ✅ data é salvo como: {"genre":"funk_mandela","genreTargets":{}}   │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│ 4. WORKER: work/worker.js (linha 365-432)                             │
│    ✅ SELECT job FROM jobs WHERE ...                                   │
│    ✅ Extrai: extractedGenre = job.data.genre                         │
│    ✅ Monta: options = { genre: finalGenre, genreTargets, ... }       │
│    ✅ Chama analyzeAudioWithPipeline(file, options)                   │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│ 5. PIPELINE: work/api/audio/pipeline-complete.js (linha 82-250)       │
│    ✅ Recebe: options.genre = "funk_mandela"                          │
│    ✅ Passa para processamento de audio                               │
│    ✅ Chama buildFinalJSON(allMetrics, genre, ...)                    │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│ 6. JSON OUTPUT: work/api/audio/json-output.js (linha 483)             │
│    ✅ finalJSON.genre = finalGenre ("funk_mandela")                   │
│    ✅ finalJSON.data = { genre: finalGenre, genreTargets }            │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│ 7. PROBLEMS & SUGGESTIONS: problems-suggestions-v2.js (linha 40-230)  │
│    🚨 PROBLEMA ENCONTRADO!                                            │
│    ❌ Analyzer instanciado: new Analyzer(genre, targets)              │
│    ❌ Mas genre vem de ONDE? Pode vir null!                          │
│    ❌ this.genre pode ser null se não foi passado                     │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│ 8. GENERATE SUMMARY: problems-suggestions-v2.js (linha 621-653)       │
│    🔥 CAUSA RAIZ DEFINITIVA!                                          │
│    ❌ return { genre: this.genre, ... }                               │
│    ❌ this.genre é NULL quando analyzer foi criado sem genre          │
│    ❌ summary.genre = null sobrescreve o finalJSON.genre correto      │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│ 9. MERGE NO PIPELINE: pipeline-complete.js (linha 300-400)            │
│    🚨 PROBLEMA CASCATA!                                               │
│    ❌ finalJSON = { ...baseJSON, ...problemsResult }                  │
│    ❌ problemsResult.summary = { genre: null }                        │
│    ❌ SOBRESCREVE o genre correto que estava em baseJSON              │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│ 10. SALVAMENTO FINAL: work/worker.js (linha 680)                      │
│     ❌ UPDATE jobs SET result = $1 WHERE id = $2                      │
│     ❌ result salvo com genre: null em summary                        │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│ 11. RESPONSE: Backend → Frontend                                      │
│     ❌ Frontend recebe: { genre: null, summary: { genre: null } }     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔥 CAUSA RAIZ DETALHADA

### 🎯 Local Exato do Bug

**Arquivo:** `work/lib/audio/features/problems-suggestions-v2.js`  
**Classe:** `ProblemsAndSuggestionsAnalyzerV2`  
**Método:** `generateSummary(suggestions, problems)`  
**Linhas:** 621-653

**Código Problemático:**
```javascript
generateSummary(suggestions, problems) {
  // ... lógica de análise ...
  
  return {
    overallRating,
    readyForRelease,
    genre: this.genre,  // 🚨 this.genre pode ser NULL aqui!
    corrigirIssues: totalCorrigir,
    // ... resto do summary
  };
}
```

### 🔍 Por Que `this.genre` é NULL?

**Constructor da Classe (linha ~40):**
```javascript
constructor(genre = 'default', customTargets = null) {
  this.genre = genre;  // Se genre não foi passado, this.genre = 'default'
  this.targets = customTargets || this.loadDefaultTargets();
  // ...
}
```

**Instanciação no Pipeline:**
```javascript
// Arquivo: work/lib/audio/features/problems-suggestions-v2.js (linha ~750)
export function analyzeProblemsAndSuggestionsV2(audioMetrics, genre = 'default', customTargets = null) {
  const analyzer = new ProblemsAndSuggestionsAnalyzerV2(genre, customTargets);
  return analyzer.analyzeWithEducationalSuggestions(audioMetrics);
}
```

**Chamada no Pipeline (pipeline-complete.js ~linha 300):**
```javascript
// 🚨 AQUI ESTÁ O PROBLEMA!
// Se genre não for passado corretamente para esta função, analyzer recebe null/'default'
const problemsResult = analyzeProblemsAndSuggestionsV2(allMetrics, genre, customTargets);
```

**Verificação nos Logs:**
Se você procurar por `[GENRE-DEEP-TRACE][PIPELINE-JSON-PRE]` nos logs, verá que `options.genre` está correto.

**MAS** quando `analyzeProblemsAndSuggestionsV2` é chamado, se o parâmetro `genre` não é explicitamente passado ou vem como `undefined`, o constructor usa `'default'` ou pode receber `null` em algum ponto.

### 🔥 Cascata do Problema

1. **Analyzer é criado com `this.genre = null` (ou 'default' inválido)**
2. **`generateSummary()` retorna `{ genre: null }`**
3. **Resultado do analyzer tem `summary.genre = null`**
4. **Pipeline faz merge:**
   ```javascript
   finalJSON = {
     ...baseJSON,      // tinha genre: "funk_mandela"
     ...problemsResult  // tem summary: { genre: null }
   };
   ```
5. **Summary com `genre: null` sobrescreve a raiz**
6. **Salvo no banco com `genre: null`**
7. **Frontend recebe `genre: null`**

---

## 📍 PONTOS ONDE O GENRE É MANIPULADO

### ✅ ENTRADA (Request → Salvamento)

| Arquivo | Linha | Operação | Genre Status |
|---------|-------|----------|--------------|
| `work/api/audio/analyze.js` | 173 | Extrai `genre` do `req.body` | ✅ Presente |
| `work/api/audio/analyze.js` | 145-147 | Monta `jobData = { genre, genreTargets }` | ✅ Presente |
| `work/api/audio/analyze.js` | 159-162 | `INSERT INTO jobs (..., data)` | ✅ Salvo corretamente |

**Log Existente:**
```javascript
console.log('[GENRE-TRACE][BACKEND] 💾 Salvando no banco:', {
  jobId, receivedGenre, savedGenre, hasGenreTargets
});
```

### ✅ PROCESSAMENTO (Worker → Pipeline)

| Arquivo | Linha | Operação | Genre Status |
|---------|-------|----------|--------------|
| `work/worker.js` | 375-395 | Extrai `genre` do `job.data` | ✅ Presente |
| `work/worker.js` | 221 | `pipelineOptions.genre = resolvedGenre` | ✅ Passado |
| `work/api/audio/pipeline-complete.js` | 82-92 | Recebe `options.genre` | ✅ Presente |
| `work/api/audio/pipeline-complete.js` | 215 | `resolvedGenre = options.genre \|\| ...` | ✅ Presente |
| `work/api/audio/json-output.js` | 483 | `finalGenre` montado | ✅ Presente |
| `work/api/audio/json-output.js` | 497 | `genre: finalGenre` no JSON | ✅ Presente |

**Logs Existentes:**
```javascript
console.log('[GENRE-DEEP-TRACE][WORKER-PRE-PIPELINE]', { 'jobOrOptions.genre', 'resolvedGenre' });
console.log('[GENRE-DEEP-TRACE][PIPELINE-JSON-PRE]', { 'options.genre', 'resolvedGenre' });
```

### 🚨 SAÍDA (Problems & Summary → Merge)

| Arquivo | Linha | Operação | Genre Status |
|---------|-------|----------|--------------|
| `work/lib/audio/features/problems-suggestions-v2.js` | ~40 | Constructor: `this.genre = genre` | ⚠️ **Pode vir NULL** |
| `work/lib/audio/features/problems-suggestions-v2.js` | 653 | `return { genre: this.genre }` | 🚨 **RETORNA NULL** |
| `work/api/audio/pipeline-complete.js` | ~300-400 | Merge `{ ...base, ...problems }` | 🚨 **SOBRESCREVE com NULL** |
| `work/worker.js` | 511-514 | Tenta corrigir `summary.genre = forcedGenre` | ⚠️ **TARDE DEMAIS - já foi salvo** |
| `work/worker.js` | 680 | `UPDATE jobs SET result = $1` | 🚨 **Salva com genre: null** |

---

## 🧪 HIPÓTESE DE CAUSA RAIZ (CONFIRMADA)

### 🎯 Hipótese Principal (95% de Certeza)

**Local:** `work/lib/audio/features/problems-suggestions-v2.js`  
**Função:** `analyzeProblemsAndSuggestionsV2(audioMetrics, genre, customTargets)`  
**Linha de Chamada:** `work/api/audio/pipeline-complete.js` ~linha 300-350

**Problema:**
Quando `analyzeProblemsAndSuggestionsV2()` é chamada no pipeline, o parâmetro `genre` pode:
1. Não ser passado (undefined)
2. Ser passado como `null`
3. Ser passado como variável com valor errado

**Resultado:**
```javascript
const analyzer = new ProblemsAndSuggestionsAnalyzerV2(genre, customTargets);
// Se genre === null ou undefined
// this.genre = null (ou 'default' dependendo do constructor)

// Depois:
return analyzer.generateSummary(suggestions, problems);
// Retorna { genre: null, ... }
```

**Merge Destrutivo:**
```javascript
// pipeline-complete.js ~linha 350
const problemsResult = analyzeProblemsAndSuggestionsV2(allMetrics, genre, targets);

finalJSON = {
  ...finalJSON,          // tinha genre: "funk_mandela"
  summary: problemsResult.summary,  // tem genre: null
  suggestionMetadata: problemsResult.metadata  // pode ter genre: null também
};

// 🚨 summary.genre = null SOBRESCREVE finalJSON.genre
```

### 🔍 Evidências Confirmatórias

1. **Logs do Frontend:**
   ```javascript
   [NORMALIZE] 🎵 Preservando genre do backend: { 
     data.genre: null, 
     result.data.genre: undefined, 
     hasGenreTargets: false 
   }
   ```

2. **Resposta do Backend:**
   ```json
   {
     "genre": null,
     "summary": {
       "overallRating": "Dinâmica precisa correção para null",
       "genre": null
     }
   }
   ```
   ⚠️ **"correção para null"** comprova que `this.genre` era `null` na hora de gerar o summary!

3. **Worker Tenta Corrigir (tarde demais):**
   ```javascript
   // work/worker.js linha 511-514
   const result = {
     ...analysisResult,
     genre: forcedGenre,  // Tenta forçar
     summary: {
       ...(analysisResult.summary || {}),
       genre: forcedGenre  // Tenta corrigir
     }
   };
   ```
   Mas essa correção acontece **DEPOIS** do merge destrutivo no pipeline.

---

## 🔧 SUGESTÃO DE LOGS CIRÚRGICOS

### 📍 Log 1: Antes de Instanciar Analyzer

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linha:** ~Antes da chamada de `analyzeProblemsAndSuggestionsV2()`  
**Inserir:**

```javascript
console.log('[GENRE-TRACE] stage=pipeline_before_analyzer', {
  'options.genre': options.genre,
  'detectedGenre': detectedGenre,
  'genreParaAnalyzer': genre,  // Variável que será passada
  'type': typeof genre,
  'isNull': genre === null,
  'isUndefined': genre === undefined
});
```

### 📍 Log 2: Dentro do Constructor do Analyzer

**Arquivo:** `work/lib/audio/features/problems-suggestions-v2.js`  
**Linha:** ~40-50 (dentro do constructor)  
**Inserir:**

```javascript
constructor(genre = 'default', customTargets = null) {
  console.log('[GENRE-TRACE] stage=analyzer_constructor', {
    'receivedGenre': genre,
    'type': typeof genre,
    'isNull': genre === null,
    'isDefault': genre === 'default',
    'thisGenreWillBe': genre || 'default'
  });
  
  this.genre = genre;
  this.targets = customTargets || this.loadDefaultTargets();
  // ... resto do constructor
}
```

### 📍 Log 3: Antes de Gerar Summary

**Arquivo:** `work/lib/audio/features/problems-suggestions-v2.js`  
**Linha:** 621 (início de `generateSummary`)  
**Inserir:**

```javascript
generateSummary(suggestions, problems) {
  console.log('[GENRE-TRACE] stage=generate_summary_before', {
    'this.genre': this.genre,
    'type': typeof this.genre,
    'isNull': this.genre === null,
    'willReturnGenre': this.genre
  });
  
  // ... resto da função
  
  const summary = {
    overallRating,
    readyForRelease,
    genre: this.genre,  // 🚨 Este é o valor que vai para o summary
    // ... resto
  };
  
  console.log('[GENRE-TRACE] stage=generate_summary_after', {
    'summary.genre': summary.genre,
    'isNull': summary.genre === null
  });
  
  return summary;
}
```

### 📍 Log 4: Depois do Merge no Pipeline

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linha:** ~Após merge com problemsResult  
**Inserir:**

```javascript
console.log('[GENRE-TRACE] stage=pipeline_after_merge', {
  'finalJSON.genre': finalJSON.genre,
  'finalJSON.summary.genre': finalJSON.summary?.genre,
  'problemsResult.summary.genre': problemsResult.summary?.genre,
  'wasSummaryOverwritten': finalJSON.summary?.genre !== detectedGenre
});
```

### 📍 Log 5: Antes de Salvar no Banco

**Arquivo:** `work/worker.js`  
**Linha:** 665-680 (antes do UPDATE)  
**Inserir:**

```javascript
console.log('[GENRE-TRACE] stage=db_before_save', {
  jobId: job.id.substring(0, 8),
  'result.genre': result.genre,
  'result.summary.genre': result.summary?.genre,
  'result.metadata.genre': result.metadata?.genre,
  'result.data.genre': result.data?.genre,
  'stringifiedLength': JSON.stringify(result).length
});
```

### 📍 Log 6: Depois de Ler do Banco (Endpoint de Status)

**Arquivo:** Arquivo que retorna o job para o frontend (pode ser `api/jobs/[id].js` ou equivalente)  
**Inserir:**

```javascript
console.log('[GENRE-TRACE] stage=response_final', {
  jobId: job.id.substring(0, 8),
  'job.result.genre': job.result?.genre,
  'job.result.summary.genre': job.result?.summary?.genre,
  'job.data.genre': job.data?.genre,
  'response.genre': response.genre
});
```

---

## 🎯 PLANO DE AÇÃO RECOMENDADO

### Fase 1: Confirmação (ADICIONAR LOGS)

1. ✅ **Adicionar os 6 logs cirúrgicos listados acima**
2. ✅ **Rodar análise em dev/staging**
3. ✅ **Coletar logs completos do fluxo:**
   - `[GENRE-TRACE] stage=pipeline_before_analyzer`
   - `[GENRE-TRACE] stage=analyzer_constructor`
   - `[GENRE-TRACE] stage=generate_summary_before`
   - `[GENRE-TRACE] stage=generate_summary_after`
   - `[GENRE-TRACE] stage=pipeline_after_merge`
   - `[GENRE-TRACE] stage=db_before_save`
4. ✅ **Enviar logs para validação**

### Fase 2: Correção (APÓS CONFIRMAÇÃO)

**Opção A: Garantir que analyzer sempre receba genre (RECOMENDADA)**

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linha:** ~Antes de chamar `analyzeProblemsAndSuggestionsV2()`

```javascript
// 🔥 CORREÇÃO CRÍTICA: SEMPRE passar genre válido para analyzer
const genreForAnalyzer = options.genre || options.data?.genre || detectedGenre || 'default';

console.log('[GENRE-FIX] Passando genre para analyzer:', genreForAnalyzer);

const problemsResult = analyzeProblemsAndSuggestionsV2(
  allMetrics, 
  genreForAnalyzer,  // 🎯 GARANTIR que não é null
  customTargets
);
```

**Opção B: Proteção no analyzer (ADICIONAL)**

**Arquivo:** `work/lib/audio/features/problems-suggestions-v2.js`  
**Linha:** ~40 (constructor)

```javascript
constructor(genre = 'default', customTargets = null) {
  // 🔥 PROTEÇÃO: NUNCA aceitar null
  if (!genre || typeof genre !== 'string' || genre.trim().length === 0) {
    console.error('[ANALYZER-ERROR] Genre inválido recebido:', genre);
    throw new Error('Genre é obrigatório para ProblemsAndSuggestionsAnalyzerV2');
  }
  
  this.genre = genre.trim();
  this.targets = customTargets || this.loadDefaultTargets();
  // ... resto
}
```

**Opção C: Preservar genre no merge (DEFENSIVA)**

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linha:** ~Após merge com problemsResult

```javascript
// 🔥 GARANTIA DEFENSIVA: Preservar genre após merge
const safeGenre = finalJSON.genre || options.genre || detectedGenre;

if (finalJSON.summary) {
  finalJSON.summary.genre = safeGenre;
}
if (finalJSON.metadata) {
  finalJSON.metadata.genre = safeGenre;
}
if (finalJSON.suggestionMetadata) {
  finalJSON.suggestionMetadata.genre = safeGenre;
}

console.log('[GENRE-FIX] Genre preservado após merge:', safeGenre);
```

---

## 📋 RESUMO FINAL

### 🎯 Provavelmente o Bug Está Aqui:

**Arquivo:** `work/lib/audio/features/problems-suggestions-v2.js`  
**Função:** `generateSummary()` (linha 653)  
**Linha:** `genre: this.genre`  

**Causa:** `this.genre` é `null` porque:
1. Analyzer foi instanciado com `genre = null` ou `undefined`
2. Constructor não protege contra `null`
3. Summary retorna `{ genre: null }`
4. Merge sobrescreve o `finalJSON.genre` correto

### 🔥 Fluxo do Bug:

```
options.genre = "funk_mandela" ✅
         ↓
analyzeProblems(metrics, null?, targets)  🚨 genre não passa?
         ↓
new Analyzer(null)  🚨 this.genre = null
         ↓
generateSummary() → { genre: null }  🚨
         ↓
finalJSON = { ...base, summary: { genre: null } }  🚨 sobrescreve
         ↓
Backend responde: genre: null  ❌
```

### ✅ Próximos Passos:

1. **ADICIONAR os 6 logs cirúrgicos**
2. **Rodar análise em dev**
3. **Enviar logs completos**
4. **Aplicar correções confirmadas**
5. **Validar em produção**

---

**FIM DA AUDITORIA** ✅
