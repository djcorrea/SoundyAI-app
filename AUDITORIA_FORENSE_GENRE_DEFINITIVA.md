# 🔥 AUDITORIA FORENSE COMPLETA - GENRE PERDIDO

**Data:** 2 de dezembro de 2025  
**Status:** ✅ PATCH DEFINITIVO APLICADO  
**Arquivos Modificados:** `work/worker.js`

---

## 📋 SUMÁRIO EXECUTIVO

### **PROBLEMA REPORTADO:**
- `data.genre` → ✅ Correto (ex: "eletrofunk")
- `results.genre` → ❌ NULL ou "default"
- `results.data.genre` → ❌ NULL
- `analysis.genre` (frontend) → ⚠️ Às vezes correto, às vezes NULL

### **OBJETIVO:**
```sql
SELECT data->>'genre', results->>'genre', results->'data'->>'genre' FROM jobs;
```
**TODOS os campos devem retornar o MESMO gênero SEMPRE.**

---

## 🔍 AUDITORIA PONTO-A-PONTO

### **1️⃣ ENTRADA DO JOB (Frontend → Backend)**

**Arquivo:** `public/audio-analyzer-integration.js` (POST /analyze)

**✅ CORRETO:**
```javascript
const jobData = {
  genre: "eletrofunk",  // ✅ Gênero escolhido pelo usuário
  mode: "genre",
  genreTargets: {...}
};
```

**Salvo em:** `jobs.data` (PostgreSQL)
```json
{
  "genre": "eletrofunk",
  "mode": "genre"
}
```

**✅ CONCLUSÃO:** `job.data.genre` está CORRETO no banco.

---

### **2️⃣ WORKER PROCESSA JOB**

**Arquivo:** `work/worker.js`

#### **2.1 Extração inicial (linha ~400)**
```javascript
const options = {
  genre: job.data?.genre || job.payload?.genre,
  mode: job.mode,
  jobId: job.id
};
```

**✅ CORRETO:** `options.genre = "eletrofunk"`

#### **2.2 Pipeline recebe options (linha ~250)**
```javascript
const pipelineOptions = {
  genre: resolvedGenre,  // options.genre
  mode: jobOrOptions.mode,
  genreTargets: jobOrOptions.genreTargets
};

const finalJSON = await processAudioComplete(fileBuffer, filename, pipelineOptions);
```

**✅ CORRETO:** Pipeline recebe `genre: "eletrofunk"`

---

### **3️⃣ PIPELINE PROCESSA**

**Arquivo:** `work/api/audio/pipeline-complete.js`

#### **3.1 Resolução de genre (linha 216)**
```javascript
const resolvedGenre = options.genre || options.data?.genre || options.genre_detected || null;
```

**⚠️ SUSPEITA #1:** Se `options.genre` vier `undefined`, `resolvedGenre = null`

#### **3.2 Blindagem final (linha 647-653)**
```javascript
const safeGenre = (
  options.genre ||
  options.data?.genre ||
  null
);

finalJSON.genre = safeGenre;
finalJSON.summary.genre = safeGenre;
finalJSON.metadata.genre = safeGenre;
```

**✅ CORREÇÃO APLICADA:** Blindagem força `options.genre` sempre.

#### **3.3 Retorno do pipeline**
```javascript
return finalJSON; // { genre: "eletrofunk", summary: {...}, ... }
```

**🔍 PROBLEMA POTENCIAL:** Se `options.genre` não chegar, pipeline retorna `genre: null`

---

### **4️⃣ WORKER MONTA RESULTADO (ROOT CAUSE ENCONTRADO)**

**Arquivo:** `work/worker.js` (linha 550-600)

#### **4.1 Merge do resultado do pipeline (ANTES DO PATCH)**
```javascript
const result = {
  ...analysisResult,  // ← SPREAD copia tudo, incluindo genre: null se vier do pipeline
  genre: forcedGenre,
  summary: mergePreservingGenre(analysisResult.summary || {}, {}, forcedGenre)
};
```

**❌ PROBLEMA:** Se `analysisResult.genre = null`, spread copia e sobrescreve.

#### **4.2 Patch antigo (linha 789-819) - INSUFICIENTE**
```javascript
const genreFromJob = job.data?.genre ?? null;
if (genreFromJob) {
    result.genre = genreFromJob;
    result.summary.genre = genreFromJob;
    // ...
}
```

**❌ PROBLEMA:** Patch vem DEPOIS mas NÃO cria objeto separado para `results`.

#### **4.3 Serialização (linha 854)**
```javascript
const resultJSON = JSON.stringify(result);
```

**❌ PROBLEMA CRÍTICO:** Um ÚNICO JSON usado para `result` E `results`.

#### **4.4 UPDATE no banco (linha 882)**
```javascript
await client.query(
  "UPDATE jobs SET status = $1, result = $2, results = $2, ...",
  ["done", resultJSON, job.id]
);
```

**❌ ROOT CAUSE:** Mesmo `resultJSON` usado em AMBOS os campos!  
Se `result.genre = null` antes do stringify, AMBOS ficam NULL.

---

## 🎯 PATCH DEFINITIVO APLICADO

### **SOLUÇÃO: Criar `resultsForDb` SEPARADO**

**Arquivo:** `work/worker.js` (linha ~790-900)

```javascript
// 🎯 PASSO 1: Extrair genre com prioridade absoluta
const genreFromJob =
  job.data?.genre ||
  job.payload?.genre ||
  options.genre ||
  result?.genre ||
  result?.data?.genre ||
  result?.summary?.genre ||
  result?.metadata?.genre ||
  null;

// 🎯 PASSO 2: Forçar no objeto result (compatibilidade)
if (genreFromJob) {
    result.genre = genreFromJob;
    result.summary.genre = genreFromJob;
    result.data.genre = genreFromJob;
    // ... todas estruturas
}

// 🎯 PASSO 3: Criar resultsForDb SEPARADO
const resultsForDb = {
  genre: genreFromJob,  // ✅ GARANTIA ABSOLUTA
  
  data: {
    genre: genreFromJob,
    genreTargets: result.data?.genreTargets || null,
    ...result.data
  },
  
  summary: {
    genre: genreFromJob,
    ...result.summary
  },
  
  metadata: {
    genre: genreFromJob,
    ...result.metadata
  },
  
  suggestionMetadata: {
    genre: genreFromJob,
    ...result.suggestionMetadata
  },
  
  // ✅ Todas as métricas
  score: result.score ?? 0,
  loudness: result.loudness || {},
  truePeak: result.truePeak || {},
  bands: result.bands || {},
  suggestions: result.suggestions || [],
  aiSuggestions: result.aiSuggestions || [],
  problemsAnalysis: result.problemsAnalysis || {},
  
  // ✅ Metadata adicional
  ok: true,
  file: job.file_key,
  analyzedAt: new Date().toISOString(),
  mode: result.mode || job.mode || 'genre'
};

// 🎯 PASSO 4: Serializar SEPARADAMENTE
const resultJSON = JSON.stringify(result);       // Para campo 'result'
const resultsJSON = JSON.stringify(resultsForDb); // Para campo 'results' ✅

// 🎯 PASSO 5: UPDATE com JSONs separados
await client.query(
  `UPDATE jobs 
   SET status = $1, 
       result = $2, 
       results = $3,  -- ✅ JSON SEPARADO!
       completed_at = NOW(), 
       updated_at = NOW() 
   WHERE id = $4`,
  ["done", resultJSON, resultsJSON, job.id]
);

// 🎯 PASSO 6: VALIDAÇÃO IMEDIATA
const verifyDB = await client.query(
  `SELECT 
     data->>'genre' AS data_genre,
     results->>'genre' AS results_genre,
     results->'data'->>'genre' AS results_data_genre,
     results->'summary'->>'genre' AS results_summary_genre,
     result->>'genre' AS result_genre
   FROM jobs 
   WHERE id = $1`,
  [job.id]
);

// ✅ VERIFICAR se TODOS os campos == genreFromJob
const allMatch = 
  verifyDB.rows[0]?.data_genre === genreFromJob &&
  verifyDB.rows[0]?.results_genre === genreFromJob &&
  verifyDB.rows[0]?.results_data_genre === genreFromJob;

if (!allMatch) {
  console.error("🚨 GENRE INCONSISTENTE!");
} else {
  console.log("✅ GENRE CORRETO EM TODOS OS CAMPOS!");
}
```

---

## ✅ GARANTIAS DO PATCH

### **1️⃣ Priorização correta:**
```javascript
const genreFromJob =
  job.data?.genre ||        // ✅ 1ª prioridade (fonte oficial)
  job.payload?.genre ||     // ✅ 2ª prioridade (fallback)
  options.genre ||          // ✅ 3ª prioridade (worker)
  result?.genre ||          // ✅ 4ª prioridade (pipeline)
  null;                     // ✅ 5ª prioridade (explícito)
```

### **2️⃣ Objeto separado:**
- `result` → usado para campo `result` (compatibilidade)
- `resultsForDb` → usado para campo `results` (GARANTIA)

### **3️⃣ Genre em TODAS as estruturas:**
```javascript
resultsForDb = {
  genre: genreFromJob,           // ✅ Raiz
  data: { genre: genreFromJob },         // ✅ data.genre
  summary: { genre: genreFromJob },      // ✅ summary.genre
  metadata: { genre: genreFromJob },     // ✅ metadata.genre
  suggestionMetadata: { genre: genreFromJob } // ✅ suggestionMetadata.genre
}
```

### **4️⃣ Validação imediata:**
```sql
SELECT 
  data->>'genre' AS data_genre,
  results->>'genre' AS results_genre,
  results->'data'->>'genre' AS results_data_genre
FROM jobs 
WHERE id = $1;
```

**EXPECTATIVA:**
```
data_genre       | results_genre | results_data_genre
-----------------|---------------|-------------------
eletrofunk       | eletrofunk    | eletrofunk
```

### **5️⃣ Logs paranóicos:**
- `[GENRE-PATCH-V2]` → Extração de genre
- `[GENRE-PARANOID][PRE-UPDATE]` → Antes do UPDATE
- `[GENRE-PARANOID][POST-UPDATE]` → Verificação no banco

---

## 🧪 TESTE DE VALIDAÇÃO

### **Executar após análise:**

```sql
-- 1️⃣ Verificar job mais recente
SELECT 
  id,
  data->>'genre' AS data_genre,
  results->>'genre' AS results_genre,
  results->'data'->>'genre' AS results_data_genre,
  results->'summary'->>'genre' AS results_summary_genre,
  result->>'genre' AS result_genre
FROM jobs 
ORDER BY created_at DESC 
LIMIT 1;
```

**RESULTADO ESPERADO:**
```
| id   | data_genre | results_genre | results_data_genre | results_summary_genre | result_genre |
|------|------------|---------------|--------------------|-----------------------|--------------|
| uuid | eletrofunk | eletrofunk    | eletrofunk         | eletrofunk            | eletrofunk   |
```

### **Se QUALQUER campo estiver NULL:**
1. Verificar logs `[GENRE-PATCH-V2]` no worker
2. Verificar logs `[GENRE-PARANOID][POST-UPDATE]`
3. Conferir se `job.data.genre` estava presente

---

## 📊 DIFERENÇAS DO PATCH

### **ANTES:**
```javascript
// ❌ Um único objeto
const resultJSON = JSON.stringify(result);

// ❌ Mesmo JSON em ambos campos
UPDATE jobs SET result = $1, results = $1 WHERE id = $2
```

### **DEPOIS:**
```javascript
// ✅ Dois objetos separados
const resultJSON = JSON.stringify(result);
const resultsJSON = JSON.stringify(resultsForDb);

// ✅ JSONs diferentes
UPDATE jobs SET result = $1, results = $2 WHERE id = $3
```

---

## 🎯 CHECKLIST DE ACEITE

Para considerar o fix ACEITO, verificar:

- [ ] `data->>'genre'` retorna gênero correto (ex: "eletrofunk")
- [ ] `results->>'genre'` retorna gênero correto (NÃO NULL)
- [ ] `results->'data'->>'genre'` retorna gênero correto
- [ ] `results->'summary'->>'genre'` retorna gênero correto
- [ ] `results->'metadata'->>'genre'` retorna gênero correto
- [ ] `result->>'genre'` retorna gênero correto
- [ ] Logs `[GENRE-PARANOID][POST-UPDATE]` mostram ✅ sucesso
- [ ] Frontend recebe `analysis.genre` correto
- [ ] Frontend recebe `analysis.data.genre` correto

**SE TODOS OS ITENS FOREM ✅ → PATCH DEFINITIVO FUNCIONOU!**

---

## 📝 NOTAS FINAIS

### **Arquivos modificados:**
1. ✅ `work/worker.js` (linhas ~790-950)
   - Criação de `resultsForDb` separado
   - Priorização de genre com fallbacks
   - UPDATE com `resultsJSON` separado
   - Validação imediata no banco

### **Arquivos NÃO modificados (já corrigidos anteriormente):**
1. ✅ `work/api/audio/pipeline-complete.js` (linha 647-653)
   - Blindagem final já aplicada
2. ✅ `public/audio-analyzer-integration.js` (linha 19511-19520)
   - Spread ANTES, atribuição DEPOIS (corrigido)

### **Comportamento esperado:**
1. User escolhe "eletrofunk" no modal
2. Frontend envia `{genre: "eletrofunk"}` para POST /analyze
3. Backend salva em `jobs.data = {genre: "eletrofunk"}`
4. Worker extrai `genreFromJob = "eletrofunk"`
5. Worker cria `resultsForDb = {genre: "eletrofunk", data: {genre: "eletrofunk"}, ...}`
6. Worker salva `results = resultsJSON` (com genre correto)
7. Banco retorna `results.genre = "eletrofunk"` ✅
8. Frontend lê `analysis.genre = "eletrofunk"` ✅

**FIM DA AUDITORIA FORENSE - PATCH DEFINITIVO APLICADO**
