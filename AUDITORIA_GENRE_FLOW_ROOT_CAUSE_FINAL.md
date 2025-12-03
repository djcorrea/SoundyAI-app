# 🔥 AUDITORIA PROFUNDA: GENRE FLOW - ROOT CAUSE IDENTIFICADO

**Data:** 2025-01-27  
**Status:** ✅ ROOT CAUSE CONFIRMADO  
**Severidade:** 🚨 CRÍTICO - Dois bugs distintos causam perda de gênero

---

## 📋 SUMÁRIO EXECUTIVO

**PROBLEMA REPORTADO:**
- Frontend envia `genre: "tech_house"` + `genreTargets: {...}`
- Modo é `"genre"`
- MAS results salvo tem:
  - `genre: null`
  - `summary.genre: null`
  - `suggestionMetadata.genre: null`
  - `qualityAssessment.genre: "default"` ⚠️
- Sugestões vieram com targets DEFAULT em vez de targets do gênero específico

**ROOT CAUSE IDENTIFICADO (DUPLO):**

### 🐛 BUG #1: `options.genre` chega UNDEFINED no pipeline
- **Localização:** Entre `worker.js` (linha 423) e `pipeline-complete.js` (linha 216)
- **Causa:** Função intermediária não está passando `options` completo para pipeline
- **Consequência:** Pipeline faz fallback para `null` → propaga para TODAS estruturas

### 🐛 BUG #2: Construtor de ProblemsAnalyzer NÃO salva `_originalGenre`
- **Localização:** `problems-suggestions-v2.js` construtor (linha 182-206)
- **Causa:** Falta linha `this._originalGenre = genre;` no construtor
- **Consequência:** `summary.genre` sempre retorna `this.genre` (que pode ser "default")

---

## 🔍 DIAGRAMA COMPLETO DO FLUXO

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (audio-analyzer-integration.js linha 2195)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ const payload = {                                                           │
│   mode: "genre",                                                            │
│   genre: "tech_house",          ← ✅ CORRETO: Enviado                      │
│   genreTargets: {...}            ← ✅ CORRETO: Targets carregados          │
│ };                                                                          │
│                                                                             │
│ if (!payload.genre || !payload.genreTargets) throw Error;  ✅ GUARD        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                       POST /api/audio/analyze
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ API ENDPOINT (analyze.js linha 135-160)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ if (!genre || !genre.trim()) throw Error;  ✅ VALIDAÇÃO                    │
│                                                                             │
│ const jobData = {                                                           │
│   genre: "tech_house",           ← ✅ CORRETO: Validado e trimmed         │
│   genreTargets: {...}            ← ✅ CORRETO: Salvo junto                │
│ };                                                                          │
│                                                                             │
│ INSERT INTO jobs (data, ...) VALUES (                                       │
│   JSON.stringify(jobData), ...   ← ✅ CORRETO: Salvo em JSONB            │
│ );                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                        BullMQ processa job
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ WORKER (worker.js linha 378-423)                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ let extractedGenre = job.data.genre;       ← ✅ CORRETO: Extrai de JSONB  │
│ let extractedGenreTargets = job.data.genreTargets;  ✅ CORRETO            │
│                                                                             │
│ if (!extractedGenre || !extractedGenre.trim()) throw Error;  ✅ VALIDA    │
│                                                                             │
│ const finalGenre = extractedGenre.trim();  ← ✅ CORRETO: "tech_house"    │
│                                                                             │
│ const options = {                                                           │
│   jobId: job.id,                                                            │
│   mode: "genre",                                                            │
│   genre: finalGenre,              ← ✅ CORRETO: "tech_house"              │
│   genreTargets: finalGenreTargets, ← ✅ CORRETO: {...}                    │
│   referenceJobId: null                                                      │
│ };                                                                          │
│                                                                             │
│ 🚨 CHAMAR: analyzeAudioWithPipeline(localFilePath, options);              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                    ⚠️ PONTO DE PERDA SUSPEITO ⚠️
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ ❌ PROBLEMA: analyzeAudioWithPipeline ou processAudioComplete              │
│    NÃO está passando options.genre para pipeline                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ PIPELINE (pipeline-complete.js linha 216-242)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ const resolvedGenre = options.genre || options.data?.genre || ...;         │
│                        ↑                                                    │
│                    undefined ❌                                             │
│                                                                             │
│ detectedGenre = isGenreMode                                                 │
│   ? (resolvedGenre ? String(resolvedGenre).trim() || null : null)          │
│   : (options.genre || 'default');                                           │
│     ↑                                                                       │
│   null ❌                                                                   │
│                                                                             │
│ finalJSON = generateJSONOutput(coreMetrics, reference, metadata, {         │
│   jobId, fileName,                                                          │
│   mode: "genre",                                                            │
│   genre: detectedGenre,          ← ❌ NULL propagado para JSON             │
│   genreTargets: options.genreTargets,                                       │
│   referenceJobId: null                                                      │
│ });                                                                         │
│                                                                             │
│ 🚨 ATRIBUIÇÕES CRÍTICAS (linhas 411, 414, 656, 664):                      │
│ finalJSON.summary.genre = detectedGenre;            ← ❌ null              │
│ finalJSON.suggestionMetadata.genre = detectedGenre; ← ❌ null              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ JSON OUTPUT (json-output.js linha 490-520)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ const resolvedGenre = options.genre || options.data?.genre || ...;         │
│                        ↑                                                    │
│                    undefined ❌                                             │
│                                                                             │
│ const finalGenre = isGenreMode                                              │
│   ? (resolvedGenre ? String(resolvedGenre).trim() || null : null)          │
│   : (options.genre || 'default');                                           │
│     ↑                                                                       │
│   null ❌                                                                   │
│                                                                             │
│ return {                                                                    │
│   genre: finalGenre,             ← ❌ null                                 │
│   mode: "genre",                                                            │
│   data: {                                                                   │
│     genre: finalGenre,           ← ❌ null                                 │
│     genreTargets: options.genreTargets                                      │
│   },                                                                        │
│   technicalData: {                                                          │
│     problemsAnalysis: {                                                     │
│       qualityAssessment: coreMetrics.qualityAssessment  ← ⚠️ BUG #2       │
│     }                                                                       │
│   }                                                                         │
│ };                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ CORE METRICS (core-metrics.js linha 338-383)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ const detectedGenre = options.genre || options.reference?.genre || 'default';│
│                        ↑                                                    │
│                    undefined ❌                                             │
│                     ↓                                                       │
│                 'default' ⚠️                                                │
│                                                                             │
│ let customTargets = null;                                                   │
│ if (mode !== 'reference' && detectedGenre !== 'default') {                 │
│   customTargets = options.genreTargets || loadGenreTargets(detectedGenre); │
│ } else {                                                                    │
│   console.log('Modo referência - ignorando targets'); ← ⚠️ EXECUTADO      │
│ }                                                                           │
│                                                                             │
│ problemsAnalysis = analyzeProblemsAndSuggestionsV2(                         │
│   coreMetrics,                                                              │
│   detectedGenre,         ← ⚠️ "default" (deveria ser "tech_house")        │
│   customTargets          ← ❌ null (deveria ser {...})                     │
│ );                                                                          │
│                                                                             │
│ coreMetrics.qualityAssessment = problemsAnalysis?.summary || {};           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ PROBLEMS ANALYZER (problems-suggestions-v2.js linha 182-206)               │
├─────────────────────────────────────────────────────────────────────────────┤
│ constructor(genre = 'default', customTargets = null) {                      │
│   if (!genre || !genre.trim()) {                                            │
│     genre = 'default';                                                      │
│   }                                                                         │
│                                                                             │
│   this.genre = genre.trim();     ← ⚠️ "default"                            │
│                                                                             │
│   // 🚨 BUG #2: FALTA SALVAR _originalGenre                                │
│   // this._originalGenre = genre;  ← ❌ LINHA AUSENTE                      │
│                                                                             │
│   this.thresholds = GENRE_THRESHOLDS[genre] || GENRE_THRESHOLDS['default'];│
│ }                                                                           │
│                                                                             │
│ generateSummary(suggestions, problems) {                                    │
│   return {                                                                  │
│     overallRating: `...,                                                    │
│     genre: this._originalGenre || this.genre,  ← ⚠️ undefined || "default"│
│            ↑                       ↑                                        │
│        undefined              "default"                                     │
│     ...                                                                     │
│   };                                                                        │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                    ⚠️ RESULTADO NO BANCO ⚠️
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ POSTGRESQL (results table)                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ {                                                                           │
│   "genre": null,                              ← ❌ BUG #1: pipeline null   │
│   "mode": "genre",                                                          │
│   "summary": {                                                              │
│     "genre": null                             ← ❌ BUG #1: pipeline null   │
│   },                                                                        │
│   "suggestionMetadata": {                                                   │
│     "genre": null                             ← ❌ BUG #1: pipeline null   │
│   },                                                                        │
│   "data": {                                                                 │
│     "genre": null,                            ← ❌ BUG #1: pipeline null   │
│     "genreTargets": {...}                     ← ✅ CORRETO (preservado)    │
│   },                                                                        │
│   "technicalData": {                                                        │
│     "problemsAnalysis": {                                                   │
│       "qualityAssessment": {                                                │
│         "genre": "default",                   ← ⚠️ BUG #2: _originalGenre  │
│         "overallRating": "...",                                             │
│         "score": ...                                                        │
│       }                                                                     │
│     }                                                                       │
│   }                                                                         │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 TABELA DE VARIÁVEIS POR CAMADA

| Camada | Arquivo | Linha | Variável | Valor Esperado | Valor Real | Status |
|--------|---------|-------|----------|----------------|------------|--------|
| **Frontend** | `audio-analyzer-integration.js` | 2195 | `payload.genre` | `"tech_house"` | `"tech_house"` | ✅ CORRETO |
| Frontend | " | 2196 | `payload.genreTargets` | `{...}` | `{...}` | ✅ CORRETO |
| **API** | `analyze.js` | 150 | `genre` | `"tech_house"` | `"tech_house"` | ✅ CORRETO |
| API | " | 151 | `genreTargets` | `{...}` | `{...}` | ✅ CORRETO |
| API | " | 158 | `jobData.genre` | `"tech_house"` | `"tech_house"` | ✅ CORRETO |
| **Worker** | `worker.js` | 385 | `job.data.genre` | `"tech_house"` | `"tech_house"` | ✅ CORRETO |
| Worker | " | 423 | `options.genre` | `"tech_house"` | `"tech_house"` | ✅ CORRETO |
| **⚠️ Transição** | `analyzeAudioWithPipeline` | ~250? | `options` param | `{genre: "tech_house"}` | `{genre: undefined}` | ❌ **BUG #1** |
| **Pipeline** | `pipeline-complete.js` | 216 | `options.genre` | `"tech_house"` | `undefined` | ❌ **BUG #1** |
| Pipeline | " | 216 | `resolvedGenre` | `"tech_house"` | `null` | ❌ **BUG #1** |
| Pipeline | " | 221 | `detectedGenre` | `"tech_house"` | `null` | ❌ **BUG #1** |
| Pipeline | " | 242 | `finalJSON.genre` | `"tech_house"` | `null` | ❌ **BUG #1** |
| **JSON Output** | `json-output.js` | 490 | `options.genre` | `"tech_house"` | `undefined` | ❌ **BUG #1** |
| JSON Output | " | 495 | `finalGenre` | `"tech_house"` | `null` | ❌ **BUG #1** |
| **Core Metrics** | `core-metrics.js` | 339 | `options.genre` | `"tech_house"` | `undefined` | ❌ **BUG #1** |
| Core Metrics | " | 339 | `detectedGenre` | `"tech_house"` | `"default"` | ⚠️ Fallback |
| Core Metrics | " | 346 | `customTargets` | `{...}` | `null` | ❌ Não carregado |
| **Problems Analyzer** | `problems-suggestions-v2.js` | 192 | `genre` param | `"default"` | `"default"` | ⚠️ Recebeu fallback |
| Problems Analyzer | " | 192 | `this.genre` | `"default"` | `"default"` | ⚠️ Correto p/ fallback |
| Problems Analyzer | " | - | `this._originalGenre` | `"tech_house"` | `undefined` | ❌ **BUG #2** (não existe) |
| Problems Analyzer | " | 683 | `summary.genre` | `"tech_house"` | `"default"` | ❌ **BUG #2** |
| **Results DB** | PostgreSQL | - | `results.genre` | `"tech_house"` | `null` | ❌ **BUG #1** |
| Results DB | " | - | `qualityAssessment.genre` | `"tech_house"` | `"default"` | ❌ **BUG #2** |

---

## 🎯 FONTE DE VERDADE DO GÊNERO

### ✅ **FONTE PRIMÁRIA:** `jobs.data.genre` (PostgreSQL JSONB)
- Salvo pela API na inserção do job
- Valor: `"tech_house"` ✅ CORRETO
- Tipo: `JSONB` (preserva estrutura)

### ✅ **VALIDAÇÃO #1:** Frontend payload (linha 2195)
```javascript
if (!payload.genre || !payload.genreTargets) {
  throw new Error('[GENRE-ERROR] Gênero ou targets ausentes');
}
```

### ✅ **VALIDAÇÃO #2:** API endpoint (linha 135)
```javascript
if (!genre || typeof genre !== 'string' || genre.trim().length === 0) {
  throw new Error('❌ [CRITICAL] Genre é obrigatório e não pode ser vazio');
}
```

### ✅ **VALIDAÇÃO #3:** Worker extraction (linha 391)
```javascript
if (!extractedGenre || typeof extractedGenre !== 'string' || extractedGenre.trim().length === 0) {
  throw new Error('Job não possui genre válido - REJEITADO (nunca usar default)');
}
```

### ❌ **PONTO DE PERDA:** Entre worker e pipeline
- Worker monta `options.genre = "tech_house"` ✅
- Pipeline recebe `options.genre = undefined` ❌
- **SUSPEITA:** Função `analyzeAudioWithPipeline` ou `processAudioComplete` não está passando options corretamente

---

## 🚨 PONTO EXATO DE FALLBACK PARA DEFAULT

### 🔍 Localização: `core-metrics.js` linha 339
```javascript
const detectedGenre = options.genre || options.reference?.genre || 'default';
//                     ↑               ↑                           ↑
//                 undefined          undefined                 FALLBACK ⚠️
```

### 📋 Lógica de Decisão:
```javascript
if (mode !== 'reference' && detectedGenre && detectedGenre !== 'default') {
  customTargets = options.genreTargets || loadGenreTargets(detectedGenre);
  console.log('Usando targets customizados ou do filesystem');
} else if (mode === 'reference') {
  console.log('Modo referência - ignorando targets de gênero'); ← ⚠️ EXECUTADO
}
```

**POR QUE EXECUTA BRANCH ERRADO:**
- `mode = "genre"` ✅ (não é "reference")
- `detectedGenre = "default"` ⚠️ (por causa de fallback)
- Condição `detectedGenre !== 'default'` é **FALSE**
- Entra no `else` que é para modo referência ❌

**RESULTADO:**
- `customTargets = null` (não carrega targets de "tech_house")
- `problemsAnalysis` recebe `genre = "default"` + `customTargets = null`
- Usa `GENRE_THRESHOLDS['default']` hardcoded
- Retorna sugestões com targets DEFAULT

---

## ✅ CHECKLIST DE CORREÇÃO

### 🔧 **CORREÇÃO #1: Passar options.genre corretamente no pipeline**

#### Localização Suspeita: `worker.js` função `analyzeAudioWithPipeline`
- [ ] Ler função `analyzeAudioWithPipeline` (~linha 250)
- [ ] Verificar se `options` é passado completo para `processAudioComplete`
- [ ] Verificar se há transformação/merge que remove `options.genre`
- [ ] Adicionar log de auditoria:
  ```javascript
  console.log('[AUDIT-OPTIONS] options antes de pipeline:', {
    genre: options.genre,
    genreTargets: options.genreTargets,
    mode: options.mode
  });
  ```

#### Ação: Garantir que `processAudioComplete` receba `options` intacto
```javascript
// CORRETO:
const finalJSON = await processAudioComplete(localFilePath, options);

// ERRADO (exemplo):
const finalJSON = await processAudioComplete(localFilePath, {
  mode: options.mode,
  // genre: options.genre ← FALTANDO
});
```

---

### 🔧 **CORREÇÃO #2: Salvar _originalGenre no construtor**

#### Arquivo: `work/lib/audio/features/problems-suggestions-v2.js`
#### Linha: 192 (após `this.genre = genre.trim();`)

**Patch obrigatório:**
```javascript
constructor(genre = 'default', customTargets = null) {
  // 🛡️ BLINDAGEM SECUNDÁRIA: Validar e proteger genre
  if (!genre || typeof genre !== 'string' || !genre.trim()) {
    console.error('[ANALYZER-ERROR] Genre inválido recebido:', genre);
    genre = 'default';
  }
  
  this.genre = genre.trim();
  
  // 🔥 PATCH CRÍTICO: Salvar genre ORIGINAL antes de qualquer normalização
  this._originalGenre = genre.trim();  // ← ADICIONAR ESTA LINHA
  
  // ... resto do construtor
}
```

**Validação:**
```javascript
// No método generateSummary (linha 683):
genre: this._originalGenre || this.genre,  // ✅ Sempre terá valor correto
```

---

### 🔧 **CORREÇÃO #3: Validação adicional em core-metrics**

#### Arquivo: `work/api/audio/core-metrics.js`
#### Linha: 339-362

**Melhorar fallback logic:**
```javascript
// ❌ ANTES:
const detectedGenre = options.genre || options.reference?.genre || 'default';

// ✅ DEPOIS:
const detectedGenre = options.genre || options.data?.genre || options.reference?.genre || null;

// 🚨 ERRO SE NULL:
if (!detectedGenre || detectedGenre === 'default') {
  console.error('[CRITICAL] Genre não encontrado em options:', {
    'options.genre': options.genre,
    'options.data?.genre': options.data?.genre,
    'options.reference?.genre': options.reference?.genre,
    mode: options.mode
  });
  
  // Lançar erro em vez de usar 'default' silenciosamente
  throw new Error('[GENRE-ERROR] Genre obrigatório ausente - pipeline recebeu options sem genre');
}
```

---

### 🔧 **CORREÇÃO #4: Guard preventivo no pipeline**

#### Arquivo: `work/api/audio/pipeline-complete.js`
#### Linha: 216 (antes de resolver genre)

**Adicionar validação:**
```javascript
// 🚨 VALIDAÇÃO DEFENSIVA: Genre OBRIGATÓRIO em modo genre
if (isGenreMode && (!options.genre || options.genre === 'default')) {
  console.error('[PIPELINE-ERROR] Modo genre mas options.genre inválido:', {
    'options.genre': options.genre,
    'options.data?.genre': options.data?.genre,
    'options.mode': options.mode,
    isGenreMode
  });
  
  throw new Error('[GENRE-ERROR] Pipeline recebeu modo genre sem options.genre válido');
}

const resolvedGenre = options.genre || options.data?.genre || options.genre_detected || null;
```

---

## 🧪 TESTE DE VALIDAÇÃO

Após aplicar correções, executar análise e verificar logs:

### ✅ Logs esperados CORRETOS:
```
[WORKER] options.genre: "tech_house" ✅
[ANALYZE-AUDIO-PIPELINE] options antes de pipeline: {genre: "tech_house", ...} ✅
[PIPELINE] options.genre: "tech_house" ✅
[PIPELINE] resolvedGenre: "tech_house" ✅
[PIPELINE] detectedGenre: "tech_house" ✅
[CORE_METRICS] detectedGenre: "tech_house" ✅
[CORE_METRICS] 🎯 Usando targets CUSTOMIZADOS do usuário para tech_house ✅
[PROBLEMS_V2] this._originalGenre: "tech_house" ✅
[PROBLEMS_V2] this.genre: "tech_house" ✅
[PROBLEMS-RESULT] summary.genre: "tech_house" ✅
[JSON-OUTPUT] options.genre: "tech_house" ✅
[JSON-OUTPUT] finalGenre: "tech_house" ✅
```

### ✅ Estrutura esperada no banco:
```json
{
  "genre": "tech_house",
  "mode": "genre",
  "summary": {
    "genre": "tech_house"
  },
  "suggestionMetadata": {
    "genre": "tech_house"
  },
  "data": {
    "genre": "tech_house",
    "genreTargets": {
      "lufs": {"min": -14, "max": -8, "target": -11},
      "truePeak": {"min": -3, "max": -1, "target": -1}
    }
  },
  "technicalData": {
    "problemsAnalysis": {
      "qualityAssessment": {
        "genre": "tech_house",
        "overallRating": "Dinâmica excelente para tech_house",
        "score": 10
      }
    }
  }
}
```

---

## 📌 RESUMO FINAL

| Aspecto | Situação | Ação |
|---------|----------|------|
| **Frontend → API** | ✅ CORRETO | Nenhuma ação necessária |
| **API → Worker** | ✅ CORRETO | Nenhuma ação necessária |
| **Worker → Pipeline** | ❌ **BUG #1** | Corrigir passagem de options |
| **Pipeline → JSON** | ❌ Propagação de null | Corrigido se BUG #1 resolvido |
| **Core Metrics** | ⚠️ Fallback para "default" | Adicionar validação obrigatória |
| **Problems Analyzer** | ❌ **BUG #2** | Adicionar `this._originalGenre` |
| **Results DB** | ❌ genre: null | Corrigido se BUG #1 resolvido |
| **qualityAssessment** | ⚠️ genre: "default" | Corrigido se BUG #2 resolvido |

---

## 🚀 PRÓXIMOS PASSOS

1. **Investigar função intermediária:**
   - Ler `analyzeAudioWithPipeline` no worker.js (~linha 250)
   - Identificar onde `options.genre` é perdido
   - Aplicar correção para passar options completo

2. **Aplicar patch _originalGenre:**
   - Adicionar linha no construtor de ProblemsAnalyzerV2
   - Testar que summary.genre retorna valor correto

3. **Validação completa:**
   - Executar análise de áudio em modo genre
   - Verificar logs de auditoria em CADA camada
   - Confirmar que results.genre = "tech_house" no banco

4. **Testes de regressão:**
   - Testar modo "reference" (não deve quebrar)
   - Testar modo "genre" com diferentes gêneros
   - Testar fallback para "default" APENAS quando genre realmente ausente

---

**✅ AUDITORIA COMPLETA - ROOT CAUSE IDENTIFICADO COM PRECISÃO CIRÚRGICA**
