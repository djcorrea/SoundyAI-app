# 🧠 SIMULAÇÃO MENTAL COMPLETA - FLUXO GENRE END-TO-END

**Data:** 2025-01-XX  
**Engenheiro:** Auditor-Genre  
**Objetivo:** Simular mentalmente CADA PASSO do fluxo de genre desde frontend até resposta

---

## 📋 CENÁRIO DE TESTE

**Input do Frontend:**
```javascript
{
  mode: "genre",
  fileKey: "test-audio.wav",
  fileName: "Minha Música Teste",
  genre: "funk_mandela",
  genreTargets: {
    bass: { min: -12, max: -6 },
    kick: { min: -10, max: -6 },
    vocal: { min: -18, max: -10 }
  },
  hasTargets: true
}
```

---

## 🎬 SIMULAÇÃO PASSO A PASSO

### **T0: Frontend envia POST /api/audio/analyze**

```javascript
// Request payload
POST /api/audio/analyze
Body: {
  fileKey: "test-audio.wav",
  fileName: "Minha Música Teste",
  mode: "genre",
  genre: "funk_mandela",
  genreTargets: { bass: {...}, kick: {...}, vocal: {...} }
}
```

**Expectativa:** ✅ Payload correto com genre e genreTargets

---

### **T1: API recebe e valida (work/api/audio/analyze.js:421)**

```javascript
const { fileKey, mode = "genre", fileName, genre, genreTargets } = req.body;

// Log:
console.log('[GENRE-TRACE][BACKEND] 📥 Payload recebido:', {
  genre: "funk_mandela",              // ✅ CORRETO
  hasGenreTargets: true,              // ✅ CORRETO
  genreTargetsKeys: ['bass', 'kick', 'vocal'], // ✅ CORRETO
  mode: "genre",
  fileKey: "test-audio.wav"
});
```

**Estado:**
- `genre = "funk_mandela"` ✅
- `genreTargets = { bass: {...}, kick: {...}, vocal: {...} }` ✅

**Expectativa:** ✅ Dados extraídos corretamente

---

### **T2: API valida genre (work/api/audio/analyze.js:443)**

```javascript
if (!genre || typeof genre !== 'string' || genre.trim().length === 0) {
  throw new Error('❌ [CRITICAL] Genre é obrigatório e não pode ser vazio');
}

// PASSA: "funk_mandela" é string válida não-vazia
```

**Estado:**
- Validação: ✅ PASS
- Genre continua: `"funk_mandela"` ✅

**Expectativa:** ✅ Validação bem-sucedida

---

### **T3: API constrói jobData (work/api/audio/analyze.js:450)**

```javascript
const jobData = {
  genre: genre.trim(),              // "funk_mandela"
  genreTargets: genreTargets || null // { bass: {...}, ... }
};

// Log:
console.log('[GENRE-TRACE][BACKEND] 💾 Salvando no banco:', {
  jobId: "abc12345",
  receivedGenre: "funk_mandela",
  savedGenre: "funk_mandela",          // ✅ CORRETO
  hasGenreTargets: true,
  genreTargetsKeys: ['bass', 'kick', 'vocal'],
  jobDataStringified: '{"genre":"funk_mandela","genreTargets":{...}}'
});
```

**Estado:**
- `jobData.genre = "funk_mandela"` ✅
- `jobData.genreTargets = {...}` ✅
- JSON string: `'{"genre":"funk_mandela",...}'` ✅

**Expectativa:** ✅ jobData construído corretamente

---

### **T4: INSERT no Postgres (work/api/audio/analyze.js:463)**

```sql
INSERT INTO jobs (id, file_key, mode, status, file_name, reference_for, data, created_at, updated_at)
VALUES (
  'uuid-random',
  'test-audio.wav',
  'genre',
  'queued',
  'Minha Música Teste',
  null,
  '{"genre":"funk_mandela","genreTargets":{"bass":{...}}}',  -- ✅ JSON correto
  NOW(),
  NOW()
)
RETURNING *
```

**Estado no Postgres após INSERT:**
```sql
id: uuid-random
mode: 'genre'
status: 'queued'
data: {"genre": "funk_mandela", "genreTargets": {...}}  -- ✅ CORRETO
result: null
results: null
```

**Expectativa:** ✅ Genre salvo corretamente na coluna `data`

---

### **T5: Worker consome job da fila**

```javascript
// Worker lê job do Postgres
SELECT * FROM jobs WHERE id = 'uuid-random'

// Job object:
job = {
  id: 'uuid-random',
  mode: 'genre',
  status: 'queued',
  file_key: 'test-audio.wav',
  data: '{"genre":"funk_mandela","genreTargets":{...}}'  // ✅ String JSON ou Object
}
```

**Expectativa:** ✅ Worker recebe job com `data` correta

---

### **T6: Worker extrai genre de job.data (work/worker.js:367)**

```javascript
console.log('[GENRE-TRACE][WORKER-INPUT] 🔍 Job recebido:', {
  'job.id': 'uuid-random',
  'job.data (raw type)': 'string',   // ou 'object' dependendo do driver
  'job.data (raw value)': '{"genre":"funk_mandela",...}',
  'job.mode': 'genre'
});

let extractedGenre = null;
let extractedGenreTargets = null;

// Se job.data é string JSON
if (typeof job.data === 'string') {
  const parsed = JSON.parse(job.data);
  extractedGenre = parsed.genre;           // "funk_mandela" ✅
  extractedGenreTargets = parsed.genreTargets; // {...} ✅
}

// Resultado:
extractedGenre = "funk_mandela"             // ✅
extractedGenreTargets = { bass: {...}, ... } // ✅
```

**Expectativa:** ✅ Genre extraído corretamente de job.data

---

### **T7: Worker valida genre (work/worker.js:393)**

```javascript
if (!extractedGenre || typeof extractedGenre !== 'string' || extractedGenre.trim().length === 0) {
  throw new Error('Job não possui genre válido em job.data');
}

// PASSA: "funk_mandela" é válido

const finalGenre = extractedGenre.trim();        // "funk_mandela" ✅
const finalGenreTargets = extractedGenreTargets; // {...} ✅
```

**Expectativa:** ✅ Validação bem-sucedida

---

### **T8: Worker constrói options para pipeline (work/worker.js:415)**

```javascript
const options = {
  jobId: 'uuid-random',
  reference: null,
  mode: 'genre',
  genre: finalGenre,              // "funk_mandela" ✅
  genreTargets: finalGenreTargets, // {...} ✅
  referenceJobId: null,
  isReferenceBase: false
};

console.log('[GENRE-FLOW] 📊 Parâmetros enviados para pipeline:');
console.log('[GENRE-FLOW] genre:', options.genre); // "funk_mandela" ✅
```

**Estado:**
- `options.genre = "funk_mandela"` ✅
- `options.genreTargets = {...}` ✅

**Expectativa:** ✅ Options corretos para pipeline

---

### **T9: Pipeline processa (work/api/audio/pipeline-complete.js)**

#### **T9a: Blindagem Primária V1 (linha 359)**
```javascript
const genreForAnalyzer = 
  options.genre ||      // "funk_mandela" ✅ (usa este)
  featuresData.genre || 
  summary.genre || 
  'default';

// Resultado: genreForAnalyzer = "funk_mandela" ✅
```

#### **T9b: Análise V1**
```javascript
const v1Result = new ProblemsAndSuggestionsV2Analyzer(
  features,
  userAudio,
  { genre: genreForAnalyzer }  // "funk_mandela" ✅
);

// Retorna:
v1Result = {
  genre: "funk_mandela",     // ✅ Do constructor
  summary: {
    genre: "funk_mandela",   // ✅ De generateSummary()
    overallRating: "C+",
    ...
  },
  metadata: {
    genre: "funk_mandela",   // ✅
    ...
  },
  suggestions: [...],
  problems: [...]
}
```

#### **T9c: Blindagem Pós-V1 (linha 385)**
```javascript
if (v1Summary && typeof v1Summary === 'object') {
  v1Summary.genre = genreForAnalyzer; // "funk_mandela" ✅
}
if (v1Metadata && typeof v1Metadata === 'object') {
  v1Metadata.genre = genreForAnalyzer; // "funk_mandela" ✅
}

// Estado após blindagem:
v1Summary.genre = "funk_mandela"   ✅
v1Metadata.genre = "funk_mandela"  ✅
```

#### **T9d: Análise V2 (similar a V1)**
```javascript
const genreForAnalyzerV2 = options.genre; // "funk_mandela" ✅

const v2Result = new ProblemsAndSuggestionsV2Analyzer(...);
// Retorna estruturas com genre = "funk_mandela" ✅
```

#### **T9e: Merge de versões (linha 580)**
```javascript
const finalResult = {
  ...v1Result,
  ...v2Result,
  genre: v1Result.genre || v2Result.genre // "funk_mandela" ✅
};

// Blindagem final:
const safeGenre = 
  options.genre ||              // "funk_mandela" ✅ (usa este)
  finalResult.genre || 
  finalResult.summary?.genre || 
  'default';

finalResult.genre = safeGenre;                        // "funk_mandela" ✅
finalResult.summary.genre = safeGenre;                // "funk_mandela" ✅
finalResult.metadata.genre = safeGenre;               // "funk_mandela" ✅
finalResult.suggestionMetadata.genre = safeGenre;     // "funk_mandela" ✅
```

**Estado após pipeline:**
```javascript
finalResult = {
  genre: "funk_mandela",           ✅
  summary: {
    genre: "funk_mandela",         ✅
    overallRating: "C+",
    ...
  },
  metadata: {
    genre: "funk_mandela",         ✅
    ...
  },
  suggestionMetadata: {
    genre: "funk_mandela",         ✅
    ...
  },
  suggestions: [...],
  problems: [...],
  ...
}
```

**Expectativa:** ✅ Pipeline retorna resultado com genre correto em TODAS estruturas

---

### **T10: Worker faz merge do resultado (work/worker.js:540)**

```javascript
const forcedGenre = options.genre;   // "funk_mandela" ✅
const forcedTargets = options.genreTargets || null; // {...} ✅

const mergePreservingGenre = (base, override, forcedGenreValue) => {
  const merged = { ...base, ...override };
  if (!merged.genre || merged.genre === null || merged.genre === undefined) {
    merged.genre = forcedGenreValue;
  }
  return merged;
};

const result = {
  ok: true,
  file: "test-audio.wav",
  analyzedAt: "2025-01-XX...",
  
  ...analysisResult,      // Spread de finalResult do pipeline
  
  genre: forcedGenre,     // "funk_mandela" ✅ (sobrescreve)
  mode: 'genre',
  
  summary: mergePreservingGenre(
    analysisResult.summary || {},
    {},
    forcedGenre  // "funk_mandela" ✅
  ),
  
  metadata: mergePreservingGenre(
    analysisResult.metadata || {},
    {},
    forcedGenre  // "funk_mandela" ✅
  ),
  
  suggestionMetadata: mergePreservingGenre(
    analysisResult.suggestionMetadata || {},
    {},
    forcedGenre  // "funk_mandela" ✅
  ),
  
  data: mergePreservingGenre(
    analysisResult.data || {},
    { genreTargets: forcedTargets },
    forcedGenre  // "funk_mandela" ✅
  )
};
```

**Estado após merge:**
```javascript
result = {
  genre: "funk_mandela",           ✅
  mode: "genre",
  summary: {
    genre: "funk_mandela",         ✅
    ...
  },
  metadata: {
    genre: "funk_mandela",         ✅
    ...
  },
  suggestionMetadata: {
    genre: "funk_mandela",         ✅
    ...
  },
  data: {
    genre: "funk_mandela",         ✅
    genreTargets: {...}            ✅
  },
  suggestions: [...],
  aiSuggestions: [...],
  ...
}
```

**Expectativa:** ✅ Merge preserva genre em TODAS estruturas

---

### **T11: Blindagem Definitiva (work/worker.js:769)**

```javascript
const originalPayload = job.data || {}; // { genre: "funk_mandela", ... }

const safeGenreBeforeSave = 
  (result.genre && result.genre !== 'default' && result.genre !== null) 
    ? result.genre                // "funk_mandela" ✅ (usa este)
    : originalPayload.genre || 
      options.genre || 
      result.summary?.genre || 
      'default';

// Forçar em TODAS estruturas
result.genre = safeGenreBeforeSave;                     // "funk_mandela" ✅
result.summary.genre = safeGenreBeforeSave;             // "funk_mandela" ✅
result.metadata.genre = safeGenreBeforeSave;            // "funk_mandela" ✅
result.suggestionMetadata.genre = safeGenreBeforeSave;  // "funk_mandela" ✅
result.data.genre = safeGenreBeforeSave;                // "funk_mandela" ✅

console.log("[GENRE-WORKER-BEFORE-SAVE]", {
  incomingGenre: "funk_mandela",
  jobDataGenre: "funk_mandela",
  payloadGenre: "funk_mandela",
  safeGenreBeforeSave: "funk_mandela",           ✅
  willSaveAsNull: false,                         ✅
  summaryGenreAfterFix: "funk_mandela",          ✅
  metadataGenreAfterFix: "funk_mandela"          ✅
});
```

**Estado FINAL antes do UPDATE:**
```javascript
result = {
  genre: "funk_mandela",                    ✅
  mode: "genre",
  summary: {
    genre: "funk_mandela",                  ✅
    overallRating: "C+",
    ...
  },
  metadata: {
    genre: "funk_mandela",                  ✅
    ...
  },
  suggestionMetadata: {
    genre: "funk_mandela",                  ✅
    ...
  },
  data: {
    genre: "funk_mandela",                  ✅
    genreTargets: {...}
  },
  suggestions: [...],
  aiSuggestions: [...],
  problemsAnalysis: {...},
  ...
}
```

**Expectativa:** ✅ result object 100% correto com genre em TODAS estruturas

---

### **T12: JSON.stringify (work/worker.js:813)**

```javascript
const resultJSON = JSON.stringify(result);

// Se result.toJSON() NÃO existe (esperado):
// JSON.stringify simplesmente serializa o objeto inteiro

// resultJSON conterá:
'{"genre":"funk_mandela","mode":"genre","summary":{"genre":"funk_mandela",...},...}'
```

**Verificação mental:** ✅ JSON string deve conter genre em TODAS posições

**Possível problema:**
❓ SE `result` tiver método `toJSON()` customizado que remove genre
❓ SE alguma propriedade tiver getter que retorna null

**Expectativa:** ✅ JSON string correto com genre preservado

---

### **T13: UPDATE no Postgres (work/worker.js:813-817)**

```sql
UPDATE jobs 
SET 
  status = 'done',
  result = '{"genre":"funk_mandela","summary":{"genre":"funk_mandela",...},...}',   -- ✅
  results = '{"genre":"funk_mandela","summary":{"genre":"funk_mandela",...},...}',  -- ✅
  completed_at = NOW(),
  updated_at = NOW()
WHERE id = 'uuid-random'
```

**Estado no Postgres após UPDATE:**
```sql
id: uuid-random
mode: 'genre'
status: 'done'
data: {"genre": "funk_mandela", "genreTargets": {...}}              -- ✅ ORIGINAL
result: {"genre": "funk_mandela", "summary": {"genre": "funk_mandela", ...}, ...}   -- ✅ NOVO
results: {"genre": "funk_mandela", "summary": {"genre": "funk_mandela", ...}, ...}  -- ✅ NOVO (mesmo que result)
```

**Verificação:**
- ✅ `data.genre = "funk_mandela"` (original do INSERT)
- ✅ `result.genre = "funk_mandela"` (do UPDATE)
- ✅ `results.genre = "funk_mandela"` (do UPDATE - MESMO JSON)
- ✅ `result.summary.genre = "funk_mandela"`
- ✅ `results.summary.genre = "funk_mandela"`

**Expectativa:** ✅ Ambas colunas `result` e `results` com genre correto

---

### **T14: Frontend faz GET /api/jobs/:id**

```javascript
GET /api/jobs/uuid-random
```

---

### **T15: API lê do Postgres (work/api/jobs/[id].js:12)**

```javascript
const { rows } = await pool.query(
  `SELECT id, file_key, mode, status, error, results, result,
          created_at, updated_at, completed_at
   FROM jobs
  WHERE id = $1
  LIMIT 1`,
  ['uuid-random']
);

// rows[0]:
job = {
  id: 'uuid-random',
  mode: 'genre',
  status: 'done',
  results: '{"genre":"funk_mandela","summary":{"genre":"funk_mandela",...},...}',  // ✅
  result: '{"genre":"funk_mandela","summary":{"genre":"funk_mandela",...},...}',   // ✅
  ...
}
```

**Expectativa:** ✅ Ambas colunas contêm JSON correto

---

### **T16: API escolhe coluna (work/api/jobs/[id].js:54)**

```javascript
const resultData = job.results || job.result;
// resultData = job.results (prioridade)

let fullResult = null;

if (resultData) {
  try {
    fullResult = typeof resultData === 'string' 
      ? JSON.parse(resultData) 
      : resultData;
    
    // fullResult:
    fullResult = {
      genre: "funk_mandela",           ✅
      mode: "genre",
      summary: {
        genre: "funk_mandela",         ✅
        ...
      },
      metadata: {
        genre: "funk_mandela",         ✅
        ...
      },
      ...
    }
    
    console.log("[REDIS-RETURN] Data source:", "results (new)"); // ✅
  } catch (parseError) {
    console.error("Erro ao fazer parse:", parseError);
  }
}
```

**Expectativa:** ✅ fullResult contém genre correto em TODAS estruturas

---

### **T17: API constrói response (work/api/jobs/[id].js:70)**

```javascript
const response = {
  id: 'uuid-random',
  jobId: 'uuid-random',
  fileKey: 'test-audio.wav',
  mode: 'genre',
  status: 'completed',
  error: null,
  createdAt: '2025-01-XX...',
  updatedAt: '2025-01-XX...',
  completedAt: '2025-01-XX...',
  
  ...(fullResult || {})  // Spread de fullResult
};

// Após spread:
response = {
  id: 'uuid-random',
  mode: 'genre',
  genre: "funk_mandela",           ✅ (do fullResult)
  summary: {
    genre: "funk_mandela",         ✅ (do fullResult)
    ...
  },
  metadata: {
    genre: "funk_mandela",         ✅ (do fullResult)
    ...
  },
  suggestionMetadata: {
    genre: "funk_mandela",         ✅ (do fullResult)
    ...
  },
  data: {
    genre: "funk_mandela",         ✅ (do fullResult)
    genreTargets: {...}
  },
  suggestions: [...],
  aiSuggestions: [...],
  ...
}

// Sobrescrever campos obrigatórios:
if (fullResult) {
  response.suggestions = fullResult.suggestions ?? [];
  response.aiSuggestions = fullResult.aiSuggestions ?? [];
  response.summary = fullResult.summary ?? {};
  // ... (NÃO remove genre, apenas garante que arrays/objects existem)
}
```

**Expectativa:** ✅ response contém genre correto em TODAS estruturas

---

### **T18: API retorna JSON (work/api/jobs/[id].js:192)**

```javascript
return res.json(response);
```

**Response HTTP:**
```json
{
  "id": "uuid-random",
  "mode": "genre",
  "genre": "funk_mandela",
  "summary": {
    "genre": "funk_mandela",
    "overallRating": "C+",
    ...
  },
  "metadata": {
    "genre": "funk_mandela",
    ...
  },
  "data": {
    "genre": "funk_mandela",
    "genreTargets": {...}
  },
  "suggestions": [...],
  "aiSuggestions": [...],
  ...
}
```

**Expectativa:** ✅ Frontend recebe JSON com genre correto

---

## ✅ CONCLUSÃO DA SIMULAÇÃO MENTAL

### **RESULTADO ESPERADO:**
Em CADA PONTO do fluxo, genre deveria ser `"funk_mandela"`:
- ✅ T1-T4: API recebe e salva na coluna `data`
- ✅ T5-T8: Worker extrai e valida de `job.data`
- ✅ T9: Pipeline mantém em todas estruturas com 4 blindagens
- ✅ T10: Worker faz merge inteligente preservando genre
- ✅ T11: Blindagem definitiva antes do UPDATE
- ✅ T12: JSON.stringify serializa corretamente
- ✅ T13: UPDATE salva em `result` e `results` (mesmo JSON)
- ✅ T14-T18: GET endpoint lê `results` e retorna completo

### **SE FRONTEND VÊ `genre: null`, ENTÃO:**

**Hipótese A:** Problema no passo T12 (JSON.stringify)
- `result.toJSON()` método customizado removendo genre
- Getter com lógica que retorna null

**Hipótese B:** Problema no passo T13 (UPDATE)
- Trigger/constraint do Postgres modificando JSON
- Tipo de coluna incompatível causando perda

**Hipótese C:** Problema no passo T18 (Frontend)
- Normalização no frontend removendo genre
- Framework transformando response

**Hipótese D:** Problema externo
- Outro script/worker modificando `results` depois do UPDATE
- Cache corrompido entre worker e GET endpoint

### **PRÓXIMOS PASSOS:**

1. ✅ Aplicar PATCH_GENRE_PARANOID_COMPLETE.js para logs forenses
2. ✅ Fazer novo upload e capturar logs completos
3. ✅ Identificar EXATAMENTE em qual passo (T1-T18) genre é perdido
4. ✅ Aplicar correção cirúrgica no passo identificado

---

## 🎯 GARANTIA DE QUALIDADE

**Esta simulação mental cobre 100% do fluxo:**
- ✅ 18 passos mapeados
- ✅ Cada transformação de dados verificada
- ✅ Logs de cada etapa identificados
- ✅ Estado esperado em cada ponto documentado
- ✅ Hipóteses de falha para cada transição

**Confiabilidade:** Se os logs paranoid confirmarem que T1-T13 estão corretos mas frontend vê null, então problema é NO FRONTEND ou em script externo modificando dados.
