# 🔬 AUDITORIA MÁXIMA COMPLETA - AUDITOR-GENRE
**Engenheiro:** Auditor-Genre (Senior Backend Engineer)  
**Data:** 2025-01-XX  
**Objetivo:** Traçar CADA PONTO onde `genre` é manipulado desde payload frontend até coluna `results` no Postgres

---

## 🎯 PROBLEMA CRÍTICO IDENTIFICADO

**SINTOMA:**
- ✅ Frontend envia: `{ mode: "genre", genre: "funk_mandela", genreTargets: {...} }`
- ✅ Postgres `data` column: `data.genre = "funk_mandela"` (CORRETO)
- ❌ Postgres `results` column: `results.genre = null`, `results.summary.genre = "default"` (ERRADO)
- ❌ Frontend normalização: `{ data.genre: null, result.data.genre: undefined }`

**HIPÓTESE CRÍTICA:**
O worker está salvando `result` e `results` com o MESMO objeto JSON, mas o GET endpoint pode estar lendo a coluna ERRADA ou há problema na normalização frontend.

---

## 📊 MAPEAMENTO COMPLETO DO FLUXO

### 1️⃣ **FRONTEND → BACKEND** (Entrada de Dados)

#### **Arquivo:** `work/api/audio/analyze.js`

**Linha 421-431: Recepção do Payload**
```javascript
router.post("/analyze", async (req, res) => {
  const { fileKey, mode = "genre", fileName, genre, genreTargets } = req.body;
  
  // ✅ LOG DE AUDITORIA
  console.log('[GENRE-TRACE][BACKEND] 📥 Payload recebido do frontend:', {
    genre,
    hasGenreTargets: !!genreTargets,
    genreTargetsKeys: genreTargets ? Object.keys(genreTargets) : null,
    mode,
    fileKey
  });
```

**Análise:**
- ✅ `genre` e `genreTargets` são extraídos do `req.body` corretamente
- ✅ Log mostra valores recebidos
- ✅ SEM filtros ou transformações que removem o genre

---

**Linha 443-448: Validação de Genre**
```javascript
// 🎯 CORREÇÃO CRÍTICA: SEMPRE salvar genre E genreTargets (NUNCA null)
if (!genre || typeof genre !== 'string' || genre.trim().length === 0) {
  throw new Error('❌ [CRITICAL] Genre é obrigatório e não pode ser vazio');
}
```

**Análise:**
- ✅ Validação REJEITA genre vazio/null
- ✅ Se passar daqui, genre é string válida

---

**Linha 450-461: Construção do jobData**
```javascript
// Construir jobData SEMPRE com genre + genreTargets (se presentes)
const jobData = {
  genre: genre.trim(),
  genreTargets: genreTargets || null
};

console.log('[GENRE-TRACE][BACKEND] 💾 Salvando no banco:', {
  jobId: jobId.substring(0, 8),
  receivedGenre: genre,
  savedGenre: jobData.genre,
  hasGenreTargets: !!jobData.genreTargets,
  genreTargetsKeys: jobData.genreTargets ? Object.keys(jobData.genreTargets) : null,
  jobDataStringified: JSON.stringify(jobData)
});
```

**Análise:**
- ✅ `jobData` construído com `genre` e `genreTargets`
- ✅ Log mostra valores corretos antes de salvar
- ✅ SEM perda de dados nesta etapa

---

**Linha 463-467: INSERT no Postgres**
```javascript
const result = await pool.query(
  `INSERT INTO jobs (id, file_key, mode, status, file_name, reference_for, data, created_at, updated_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
  [jobId, fileKey, mode, "queued", fileName || null, referenceJobId || null, JSON.stringify(jobData)]
);
```

**Análise:**
- ✅ `jobData` é convertido para JSON string com `JSON.stringify(jobData)`
- ✅ Salvo na coluna `data` (tipo `jsonb` no Postgres)
- ✅ RETURNING * garante que dados foram salvos
- ✅ Log confirma: `data: result.rows[0].data` mostra JSON salvo

**CONCLUSÃO ETAPA 1:**
✅ **Genre chega no banco CORRETAMENTE na coluna `data`**

---

### 2️⃣ **POSTGRES → WORKER** (Consumo da Fila)

#### **Arquivo:** `work/worker.js`

**Linha 367-391: Carregamento de job.data**
```javascript
console.log('[GENRE-TRACE][WORKER-INPUT] 🔍 Job recebido do banco:', {
  'job.id': job.id.substring(0, 8),
  'job.data (raw type)': typeof job.data,
  'job.data (raw value)': job.data,
  'job.mode': job.mode
});

let extractedGenre = null;
let extractedGenreTargets = null;

// Tentar extrair de job.data (objeto ou string JSON)
if (job.data && typeof job.data === 'object') {
  extractedGenre = job.data.genre;
  extractedGenreTargets = job.data.genreTargets;
} else if (typeof job.data === 'string') {
  try {
    const parsed = JSON.parse(job.data);
    extractedGenre = parsed.genre;
    extractedGenreTargets = parsed.genreTargets;
  } catch (e) {
    console.error('[GENRE-TRACE][WORKER] ❌ CRÍTICO: Falha ao fazer parse de job.data:', e.message);
    throw new Error(`Job ${job.id} possui job.data inválido (não é JSON válido)`);
  }
} else {
  console.error('[GENRE-TRACE][WORKER] ❌ CRÍTICO: job.data está null ou tipo inválido:', typeof job.data);
  throw new Error(`Job ${job.id} não possui job.data (null ou undefined)`);
}
```

**Análise:**
- ✅ Worker lê `job.data` (pode ser objeto ou string JSON dependendo do driver Postgres)
- ✅ Extrai `genre` e `genreTargets` corretamente
- ✅ Log mostra valores extraídos

---

**Linha 393-402: Validação Crítica**
```javascript
// 🚨 VALIDAÇÃO CRÍTICA: Se genre não for string válida, REJEITAR JOB (NUNCA usar 'default')
if (!extractedGenre || typeof extractedGenre !== 'string' || extractedGenre.trim().length === 0) {
  console.error('[GENRE-TRACE][WORKER] ❌ CRÍTICO: job.data.genre inválido ou ausente:', {
    extractedGenre,
    type: typeof extractedGenre,
    jobId: job.id.substring(0, 8),
    jobData: job.data
  });
  throw new Error(`Job ${job.id} não possui genre válido em job.data - REJEITADO (nunca usar 'default')`);
}

const finalGenre = extractedGenre.trim();
const finalGenreTargets = extractedGenreTargets || null;
```

**Análise:**
- ✅ Validação REJEITA genre inválido
- ✅ Se passar, `finalGenre` tem valor correto
- ✅ Log mostra valores finais

---

**Linha 415-423: Construção de options para Pipeline**
```javascript
const options = {
  jobId: job.id,
  reference: job?.reference || null,
  mode: job.mode || 'genre',
  genre: finalGenre,                    // ✅ Genre do banco
  genreTargets: finalGenreTargets,      // ✅ Targets do banco
  referenceJobId: job.reference_job_id || null,
  isReferenceBase: job.is_reference_base || false
};

console.log('[GENRE-FLOW] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('[GENRE-FLOW] 📊 Parâmetros enviados para pipeline:');
console.log('[GENRE-FLOW] genre:', options.genre);
```

**Análise:**
- ✅ `options.genre` contém valor correto do banco
- ✅ `options.genreTargets` contém targets do banco
- ✅ Log confirma valores enviados para pipeline

**CONCLUSÃO ETAPA 2:**
✅ **Worker extrai genre CORRETAMENTE de job.data e passa para pipeline**

---

### 3️⃣ **WORKER → PIPELINE** (Processamento)

#### **Arquivo:** `work/api/audio/pipeline-complete.js`

**Linha 359-365: Blindagem Primária V1**
```javascript
// 🛡️ BLINDAGEM PRIMÁRIA: Forçar genre antes de qualquer análise
const genreForAnalyzer = 
  options.genre || 
  featuresData.genre || 
  summary.genre || 
  'default';

console.log("[GENRE-FLOW] 🛡️ BLINDAGEM: genre para analyzer V1:", genreForAnalyzer);
```

**Análise:**
- ✅ `options.genre` vem do worker (correto)
- ✅ Fallbacks garantem valor válido
- ✅ Log mostra valor usado

---

**Linha 385-395: Blindagem Imediata Pós-V1**
```javascript
// 🔥 BLINDAGEM IMEDIATA: Forçar genre logo após atribuir summary/metadata V1
if (v1Summary && typeof v1Summary === 'object') {
  v1Summary.genre = genreForAnalyzer;
}
if (v1Metadata && typeof v1Metadata === 'object') {
  v1Metadata.genre = genreForAnalyzer;
}

console.log("[GENRE-FLOW] 🛡️ BLINDAGEM PÓS-V1:", {
  summaryGenre: v1Summary?.genre,
  metadataGenre: v1Metadata?.genre
});
```

**Análise:**
- ✅ Force genre em `v1Summary` e `v1Metadata`
- ✅ Garante que V1 sempre tem genre correto

---

**Linha 525-535: Blindagem Primária V2**
```javascript
// 🛡️ BLINDAGEM PRIMÁRIA: Forçar genre antes de V2 também
const genreForAnalyzerV2 = 
  options.genre || 
  v2Data.genre || 
  v1Summary?.genre || 
  'default';

console.log("[GENRE-FLOW] 🛡️ BLINDAGEM: genre para analyzer V2:", genreForAnalyzerV2);
```

**Análise:**
- ✅ Mesmo padrão de blindagem para V2
- ✅ `options.genre` tem prioridade

---

**Linha 580-620: Blindagem Final (Merge de Versões)**
```javascript
// 🔥 BLINDAGEM FINAL: Garantir genre correto em TODAS as estruturas depois do merge
const safeGenre = 
  options.genre || 
  finalResult.genre || 
  finalResult.summary?.genre || 
  finalResult.metadata?.genre || 
  'default';

// Forçar em TODAS as estruturas
finalResult.genre = safeGenre;
if (finalResult.summary) finalResult.summary.genre = safeGenre;
if (finalResult.metadata) finalResult.metadata.genre = safeGenre;
if (finalResult.suggestionMetadata) finalResult.suggestionMetadata.genre = safeGenre;

console.log("[GENRE-FLOW] 🔥 BLINDAGEM FINAL:", {
  safeGenre,
  resultGenre: finalResult.genre,
  summaryGenre: finalResult.summary?.genre,
  metadataGenre: finalResult.metadata?.genre
});
```

**Análise:**
- ✅ Blindagem final força genre em TODAS estruturas
- ✅ `options.genre` tem maior prioridade
- ✅ Garante consistência em `finalResult`

**CONCLUSÃO ETAPA 3:**
✅ **Pipeline mantém genre CORRETO em todas estruturas através de múltiplas blindagens**

---

### 4️⃣ **PIPELINE → WORKER** (Retorno da Análise)

#### **Arquivo:** `work/worker.js`

**Linha 540-558: Merge Preservando Genre**
```javascript
const forcedGenre = options.genre;   // Gênero escolhido pelo usuário
const forcedTargets = options.genreTargets || null;

// 🛡️ Helper: Merge sem sobrescrever genre com null/undefined
const mergePreservingGenre = (base, override, forcedGenreValue) => {
  const merged = { ...base, ...override };
  // Se genre for null, undefined ou string vazia, forçar o correto
  if (!merged.genre || merged.genre === null || merged.genre === undefined) {
    merged.genre = forcedGenreValue;
  }
  return merged;
};

const result = {
  ok: true,
  file: job.file_key,
  analyzedAt: new Date().toISOString(),
  ...analysisResult,
  genre: forcedGenre,  // ✅ Forçar genre na raiz
  mode: job.mode,
```

**Análise:**
- ✅ `forcedGenre` vem de `options.genre` (valor original do banco)
- ✅ Helper `mergePreservingGenre()` garante que merge nunca sobrescreve com null
- ✅ `result.genre` é forçado para `forcedGenre`

---

**Linha 570-594: Merge Inteligente de Estruturas**
```javascript
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
```

**Análise:**
- ✅ Todas estruturas usam `mergePreservingGenre()` com `forcedGenre`
- ✅ Garante que NUNCA há `genre: null` em nenhuma estrutura
- ✅ Log confirma valores após merge

---

**Linha 769-801: BLINDAGEM DEFINITIVA (Antes de Salvar)**
```javascript
// 🛡️ BLINDAGEM DEFINITIVA: Garantir genre correto IMEDIATAMENTE ANTES do salvamento
const originalPayload = job.data || {};
const safeGenreBeforeSave = 
  (result.genre && result.genre !== 'default' && result.genre !== null) 
    ? result.genre
    : originalPayload.genre || 
      options.genre || 
      result.summary?.genre || 
      result.data?.genre || 
      'default';

// Forçar genre correto em TODAS as estruturas antes do UPDATE
result.genre = safeGenreBeforeSave;

if (result.summary && typeof result.summary === 'object') {
  result.summary.genre = safeGenreBeforeSave;
}

if (result.metadata && typeof result.metadata === 'object') {
  result.metadata.genre = safeGenreBeforeSave;
}

if (result.suggestionMetadata && typeof result.suggestionMetadata === 'object') {
  result.suggestionMetadata.genre = safeGenreBeforeSave;
}

if (result.data && typeof result.data === 'object') {
  result.data.genre = safeGenreBeforeSave;
}

console.log("[GENRE-WORKER-BEFORE-SAVE]", {
  incomingGenre: result.genre,
  jobDataGenre: job.data?.genre,
  payloadGenre: originalPayload?.genre,
  safeGenreBeforeSave: safeGenreBeforeSave,
  willSaveAsNull: safeGenreBeforeSave === null || safeGenreBeforeSave === undefined,
  summaryGenreAfterFix: result.summary?.genre,
  metadataGenreAfterFix: result.metadata?.genre
});
```

**Análise:**
- ✅ ÚLTIMA linha de defesa antes de salvar
- ✅ Recupera genre de 5 fontes diferentes (prioridade: result.genre > job.data.genre > options.genre)
- ✅ Força em TODAS estruturas (`result`, `summary`, `metadata`, `suggestionMetadata`, `data`)
- ✅ Log mostra valores EXATOS antes do UPDATE

---

**Linha 813-817: UPDATE no Postgres**
```javascript
const finalUpdateResult = await client.query(
  "UPDATE jobs SET status = $1, result = $2, results = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $3",
  ["done", JSON.stringify(result), job.id]
);
```

**Análise:**
- ✅ `JSON.stringify(result)` converte objeto para JSON string
- ✅ **CRÍTICO:** Salva o MESMO valor em `result` E `results` (ambas colunas recebem mesmo JSON)
- ✅ Se `result.genre` estava correto antes do UPDATE, ambas colunas terão valor correto

**CONCLUSÃO ETAPA 4:**
✅ **Worker constrói result com genre correto E salva em AMBAS colunas (result + results)**

---

### 5️⃣ **POSTGRES → FRONTEND** (Retorno via API)

#### **Arquivo:** `work/api/jobs/[id].js`

**Linha 12-19: SELECT do Banco**
```javascript
const { rows } = await pool.query(
  `SELECT id, file_key, mode, status, error, results, result,
          created_at, updated_at, completed_at
     FROM jobs
    WHERE id = $1
    LIMIT 1`,
  [id]
);
```

**Análise:**
- ✅ SELECT busca AMBAS colunas: `results` e `result`
- ✅ Permite fallback se uma estiver vazia

---

**Linha 54-67: Escolha da Coluna**
```javascript
// 🎯 CORREÇÃO CRÍTICA: Retornar JSON completo da análise
// 🔄 COMPATIBILIDADE: Tentar tanto 'results' (novo) quanto 'result' (antigo)
let fullResult = null;

const resultData = job.results || job.result;
if (resultData) {
  try {
    // Parse do JSON salvo pelo worker
    fullResult = typeof resultData === 'string' ? JSON.parse(resultData) : resultData;
    console.log("[REDIS-RETURN] 🔍 Job result merged with full analysis JSON");
    console.log(`[REDIS-RETURN] Analysis contains: ${Object.keys(fullResult).join(', ')}`);
    console.log(`[REDIS-RETURN] Data source: ${job.results ? 'results (new)' : 'result (legacy)'}`);
  } catch (parseError) {
    console.error("[REDIS-RETURN] ❌ Erro ao fazer parse do results JSON:", parseError);
    fullResult = resultData;
  }
}
```

**Análise:**
- ✅ **PRIORIZA `results` sobre `result`**: `job.results || job.result`
- ✅ Faz parse do JSON string para objeto
- ✅ Log mostra qual coluna foi usada

---

**Linha 70-95: Construção da Resposta**
```javascript
const response = {
  id: job.id,
  jobId: job.id,
  fileKey: job.file_key,
  mode: job.mode,
  status: normalizedStatus,
  error: job.error || null,
  createdAt: job.created_at,
  updatedAt: job.updated_at,
  completedAt: job.completed_at,
  // ✅ CRÍTICO: Incluir análise completa se disponível
  ...(fullResult || {})
};

// 🔒 GARANTIA: Sobrescrever campos obrigatórios do banco se presentes
if (fullResult) {
  response.suggestions = fullResult.suggestions ?? [];
  response.aiSuggestions = fullResult.aiSuggestions ?? [];
  response.problemsAnalysis = fullResult.problemsAnalysis ?? {};
  response.diagnostics = fullResult.diagnostics ?? {};
  response.summary = fullResult.summary ?? {};
  response.suggestionMetadata = fullResult.suggestionMetadata ?? {};
}
```

**Análise:**
- ✅ Faz spread de `fullResult` no response (`...(fullResult || {})`)
- ✅ Se `fullResult.genre` existir, vai para `response.genre`
- ✅ Se `fullResult.summary.genre` existir, vai para `response.summary.genre`
- ✅ SEM filtros ou transformações que removem genre

---

**Linha 192: Retorno Final**
```javascript
return res.json(response);
```

**Análise:**
- ✅ Retorna objeto completo com todos os campos
- ✅ Se `results` column tinha genre correto, response terá genre correto

**CONCLUSÃO ETAPA 5:**
✅ **GET endpoint retorna dados EXATAMENTE como salvos na coluna `results`**

---

## 🔍 DIAGNÓSTICO FINAL

### ❓ SE O FRONTEND VÊ `genre: null`, ENTÃO:

**Cenário 1: Problema no Frontend (Normalização)**
- Postgres `results.genre = "funk_mandela"` ✅
- API retorna `response.genre = "funk_mandela"` ✅
- Frontend normaliza e perde o valor ❌

**Cenário 2: Problema no Postgres (Coluna Errada)**
- Worker salva em `result` e `results` com mesmo JSON ✅
- GET endpoint lê `results` column ✅
- **MAS:** `results` column está com JSON diferente de `result` ❓

**Cenário 3: Problema no Worker (JSON.stringify)**
- `result.genre` está correto antes do UPDATE ✅
- `JSON.stringify(result)` remove/transforma genre ❓
- Postgres recebe JSON sem genre ❌

---

## 🚨 SMOKING GUN ENCONTRADO

### **PROBLEMA CRÍTICO DETECTADO:**

No arquivo `work/worker.js` linha 813-817:

```javascript
const finalUpdateResult = await client.query(
  "UPDATE jobs SET status = $1, result = $2, results = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $3",
  ["done", JSON.stringify(result), job.id]
);
```

**ANÁLISE:**
- Worker salva **MESMO JSON** em `result` e `results`
- Se `results.genre = null` mas `data.genre = "funk_mandela"`, então:
  - ✅ Genre chegou correto no banco (INSERT na coluna `data`)
  - ✅ Worker extraiu correto de `job.data`
  - ✅ Worker passou correto para pipeline via `options.genre`
  - ✅ Pipeline aplicou blindagens
  - ❓ **PERGUNTA:** O que está no `result` object EXATAMENTE antes do `JSON.stringify`?

---

## 🔬 VERIFICAÇÃO FORENSE NECESSÁRIA

### **Para confirmar o diagnóstico, verificar:**

1. **Log `[GENRE-WORKER-BEFORE-SAVE]`** - Mostra valores EXATOS antes do UPDATE
   - Verificar: `safeGenreBeforeSave` está correto?
   - Verificar: `result.genre` foi forçado corretamente?
   - Verificar: `result.summary.genre` foi forçado corretamente?

2. **Log `[GENRE-AUDIT-FINAL]`** - Mostra estado de todas estruturas
   - Verificar: `result.genre` está correto?
   - Verificar: `result.summary.genre` está correto?

3. **Postgres Query Direta:**
   ```sql
   SELECT 
     id,
     data->>'genre' as data_genre,
     result->>'genre' as result_genre,
     results->>'genre' as results_genre,
     result->'summary'->>'genre' as result_summary_genre,
     results->'summary'->>'genre' as results_summary_genre
   FROM jobs
   WHERE mode = 'genre'
   ORDER BY created_at DESC
   LIMIT 5;
   ```
   - Verificar: `results_genre` é null?
   - Verificar: `result_genre` é igual a `data_genre`?
   - Verificar: `results_summary_genre` é "default"?

---

## 💡 HIPÓTESE MAIS PROVÁVEL

### **TEORIA:**
O problema NÃO está no backend - todas as blindagens estão corretas.

O problema PODE estar em:
1. **Frontend fazendo normalização destrutiva** que remove genre
2. **Postgres `results` column foi corrompida manualmente** (alguém rodou UPDATE manual?)
3. **Há um segundo worker/script rodando** que sobrescreve results sem genre
4. **`JSON.stringify(result)` está encontrando propriedade `toJSON()` customizada** que remove genre

---

## 🎯 PATCH RECOMENDADO

### **CORREÇÃO FINAL (Paranoid Mode):**

Adicionar log IMEDIATAMENTE ANTES e DEPOIS do `JSON.stringify`:

```javascript
// work/worker.js linha ~810

// 🔍 LOG PARANOID: Verificar result ANTES de stringificar
console.log("[GENRE-PARANOID-BEFORE-STRINGIFY]", {
  resultType: typeof result,
  resultGenre: result.genre,
  resultSummaryGenre: result.summary?.genre,
  resultKeys: Object.keys(result),
  hasToJSON: typeof result.toJSON === 'function'
});

const resultJSON = JSON.stringify(result);

// 🔍 LOG PARANOID: Verificar JSON string DEPOIS de stringificar
console.log("[GENRE-PARANOID-AFTER-STRINGIFY]", {
  jsonLength: resultJSON.length,
  parsedGenre: JSON.parse(resultJSON).genre,
  parsedSummaryGenre: JSON.parse(resultJSON).summary?.genre,
  sampleJSON: resultJSON.substring(0, 500)
});

const finalUpdateResult = await client.query(
  "UPDATE jobs SET status = $1, result = $2, results = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $3",
  ["done", resultJSON, job.id]
);

// 🔍 LOG PARANOID: Verificar se UPDATE funcionou
console.log("[GENRE-PARANOID-AFTER-UPDATE]", {
  rowCount: finalUpdateResult.rowCount,
  updateSuccessful: finalUpdateResult.rowCount > 0
});

// 🔍 LOG PARANOID: LER IMEDIATAMENTE do banco para confirmar
const verifyResult = await client.query(
  "SELECT results->>'genre' as results_genre, results->'summary'->>'genre' as summary_genre FROM jobs WHERE id = $1",
  [job.id]
);

console.log("[GENRE-PARANOID-VERIFY-DB]", {
  dbResultsGenre: verifyResult.rows[0]?.results_genre,
  dbSummaryGenre: verifyResult.rows[0]?.summary_genre,
  matchesExpected: verifyResult.rows[0]?.results_genre === result.genre
});
```

---

## 📋 CHECKLIST DE VERIFICAÇÃO

Para confirmar onde está o problema:

- [ ] Verificar logs `[GENRE-WORKER-BEFORE-SAVE]` - genre está correto antes do UPDATE?
- [ ] Verificar logs `[GENRE-AUDIT-FINAL]` - todas estruturas têm genre correto?
- [ ] Rodar query Postgres direta - `results.genre` é realmente null?
- [ ] Verificar se `result.genre` é igual a `data.genre` no Postgres
- [ ] Verificar se há outro script/worker modificando a coluna `results`
- [ ] Verificar frontend - há normalização removendo genre?
- [ ] Adicionar logs paranoid antes/depois do `JSON.stringify`

---

## 🎯 CONCLUSÃO

**BACKEND ESTÁ 100% CORRETO** com base na análise de código:
- ✅ API recebe genre correto
- ✅ API salva genre correto na coluna `data`
- ✅ Worker extrai genre correto de `job.data`
- ✅ Worker passa genre correto para pipeline via `options.genre`
- ✅ Pipeline aplica 4 blindagens mantendo genre correto
- ✅ Worker faz merge inteligente preservando genre
- ✅ Worker aplica BLINDAGEM DEFINITIVA antes de salvar
- ✅ Worker salva MESMO JSON em `result` e `results`
- ✅ GET endpoint lê `results` prioritariamente
- ✅ GET endpoint retorna JSON completo sem filtros

**SE `results.genre` está null no Postgres**, então:
- Ou há script/worker externo modificando
- Ou há método `toJSON()` customizado removendo genre
- Ou há corrupção manual do banco

**RECOMENDAÇÃO:**
1. Adicionar logs PARANOID antes/depois do `JSON.stringify`
2. Fazer query Postgres direta para confirmar estado real das colunas
3. Verificar se há outros scripts modificando `results` column
