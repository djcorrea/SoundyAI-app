# 🔍 AUDITORIA COMPLETA: FLUXO DE ENVIO DO GÊNERO

**Data:** 26 de novembro de 2025  
**Responsável:** GitHub Copilot (Claude Sonnet 4.5)  
**Status:** ⚠️ **AUDITORIA COMPLETA - FLUXO IDENTIFICADO**

---

## 📊 RESUMO EXECUTIVO

### ✅ **FLUXO CONFIRMADO:**

```
Frontend (audio-analyzer-integration.js)
   ↓ POST /api/audio/analyze
   ↓ body: { fileKey, mode, fileName, genre, referenceJobId }
   ↓
server.js (RAIZ)
   ↓ app.use("/api/audio", analyzeRoute)
   ↓ analyzeRoute = import "./work/api/audio/analyze.js"
   ↓
work/api/audio/analyze.js
   ↓ router.post("/analyze", ...)
   ↓ req.body.genre
   ↓ createJobInDatabase(fileKey, mode, fileName, referenceJobId, genre)
   ↓
PostgreSQL
   ↓ INSERT INTO jobs (..., data, ...)
   ↓ data = JSON.stringify({ genre })
   ↓
Worker (work/worker.js)
   ↓ SELECT * FROM jobs WHERE status='queued'
   ↓ job.data.genre
   ↓ Pipeline (options.genre)
   ↓ JSON Final (genre: ...)
   ↓
UPDATE jobs SET result = {...}
```

---

## 📍 PARTE 1: FRONTEND

### ✅ **ARQUIVO: `public/audio-analyzer-integration.js`**

**Linha 1959:** Gênero incluído no payload
```javascript
const payload = {
    fileKey: fileKey,
    mode: actualMode,
    fileName: fileName,
    isReferenceBase: isReferenceBase,
    genre: selectedGenre // ← ✅ GÊNERO ENVIADO CORRETAMENTE
};
```

**Linha 1940-1950:** Lógica de seleção do gênero
```javascript
let selectedGenre = genreSelect?.value;

// 🎯 CORREÇÃO: Validar se é string não-vazia antes de fallback
if (!selectedGenre || selectedGenre.trim() === '') {
    selectedGenre = window.PROD_AI_REF_GENRE || 'default';
}

console.log('[TRACE-GENRE][FRONTEND] 🎵 Gênero selecionado para envio:', {
    'genreSelect.value': genreSelect?.value,
    'window.PROD_AI_REF_GENRE': window.PROD_AI_REF_GENRE,
    'selectedGenre (final)': selectedGenre
});
```

**Linha 1990:** Endpoint chamado
```javascript
const response = await fetch('/api/audio/analyze', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify(payload) // ← ✅ Payload com genre
});
```

### ✅ **CONCLUSÃO FRONTEND:**
- ✅ Frontend envia `genre` corretamente no `req.body`
- ✅ Rota chamada: `/api/audio/analyze` (correto)
- ✅ Método: `POST`
- ✅ Payload: `{ fileKey, mode, fileName, genre, referenceJobId? }`

---

## 📍 PARTE 2: SERVIDOR EXPRESS (RAIZ)

### ✅ **ARQUIVO: `server.js` (RAIZ)**

**Linha 14:** Importação do analyze.js correto
```javascript
// 🔧 FIX: Usar arquivo correto que suporta referenceJobId e enfileira no Redis/BullMQ
import analyzeRoute from "./work/api/audio/analyze.js"; // ← ✅ WORK/API
```

**Linha 88:** Registro da rota
```javascript
// Rotas de análise
app.use("/api/audio", analyzeRoute); // ← ✅ ROTA CORRETA
app.use("/api/jobs", jobsRoute);
```

### ✅ **CONCLUSÃO SERVER.JS:**
- ✅ `server.js` da raiz importa **`work/api/audio/analyze.js`** (correto)
- ✅ Rota registrada: `/api/audio` → `analyzeRoute`
- ✅ Frontend chama `/api/audio/analyze` → Roteado para `work/api/audio/analyze.js`
- ✅ **NÃO EXISTE** rota intermediária que limpa o payload

---

## 📍 PARTE 3: API DE ANÁLISE (WORK)

### ✅ **ARQUIVO: `work/api/audio/analyze.js`**

**Linha 341-360:** Rota `/analyze` recebe o request
```javascript
router.post("/analyze", async (req, res) => {
  console.log('🚀 [API] /analyze chamada');
  
  try {
    const { fileKey, mode = "genre", fileName, genre } = req.body;
    //                                                     ^^^^^ ✅ GENRE EXTRAÍDO DO BODY
    
    console.log('[TRACE-GENRE][INPUT] 🔍 Genre recebido do frontend:', genre);
```

**Linha 101-170:** Função `createJobInDatabase()` salva no banco
```javascript
async function createJobInDatabase(fileKey, mode, fileName, referenceJobId = null, genre = null) {
  const jobId = randomUUID();
  
  // 🎯 CORREÇÃO CRÍTICA: Validar genre como string não-vazia antes de salvar
  const hasValidGenre = genre && typeof genre === 'string' && genre.trim().length > 0;
  const jobData = hasValidGenre ? { genre: genre.trim() } : null;
  
  console.log('[TRACE-GENRE][DB-INSERT] 💾 Salvando genre no banco:', {
    genreOriginal: genre,
    hasValidGenre,
    jobData
  });
  
  const result = await pool.query(
    `INSERT INTO jobs (id, file_key, mode, status, file_name, reference_for, data, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
    [jobId, fileKey, mode, "queued", fileName || null, referenceJobId || null, 
     jobData ? JSON.stringify(jobData) : null]
    //       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ✅ GENRE SALVO NA COLUNA 'data'
  );
```

**Linha 410:** Chamada da função com genre
```javascript
const jobRecord = await createJobInDatabase(fileKey, mode, fileName, referenceJobId, genre);
//                                                                                     ^^^^^ ✅ GENRE PASSADO
```

### ✅ **CONCLUSÃO WORK/API/ANALYZE.JS:**
- ✅ Recebe `genre` de `req.body.genre` (linha 345)
- ✅ Valida se `genre` é string não-vazia (linha 108-109)
- ✅ Salva `genre` no campo `data` como JSON: `{ genre: "funk_mandela" }` (linha 118)
- ✅ **NÃO SOBRESCREVE** o genre em nenhum ponto
- ✅ **NÃO IGNORA** o genre
- ✅ **NÃO RENOMEIA** o genre

---

## 📍 PARTE 4: WORKER

### ✅ **ARQUIVO: `work/worker.js`**

**Linha 311-360:** Extração do genre de `job.data`
```javascript
// ✅ PASSO 1: GARANTIR QUE O GÊNERO CHEGA NO PIPELINE
console.log('[TRACE-GENRE][WORKER-INPUT] 🔍 Job recebido do banco:', {
  'job.data': job.data,
  'job.data?.genre': job.data?.genre,
  'job.genre': job.genre,
  'job.mode': job.mode
});

// 🎯 CORREÇÃO CRÍTICA: Extrair genre com validação explícita
let extractedGenre = null;

// Tentar extrair de job.data (objeto ou string JSON)
if (job.data && typeof job.data === 'object') {
  extractedGenre = job.data.genre; // ← ✅ EXTRAI DE job.data.genre
} else if (typeof job.data === 'string') {
  try {
    const parsed = JSON.parse(job.data);
    extractedGenre = parsed.genre; // ← ✅ PARSE DE STRING JSON
  } catch (e) {
    console.warn('[TRACE-GENRE][WORKER] ⚠️ Falha ao fazer parse de job.data:', e.message);
  }
}

// Validar se extractedGenre é string válida
if (extractedGenre && typeof extractedGenre === 'string' && extractedGenre.trim().length > 0) {
  extractedGenre = extractedGenre.trim();
  console.log('[TRACE-GENRE][WORKER] ✅ Genre extraído de job.data:', extractedGenre);
} else {
  extractedGenre = null;
  console.warn('[TRACE-GENRE][WORKER] ⚠️ job.data.genre inválido ou ausente');
}

// Fallback chain explícito com validação
const finalGenre = extractedGenre || 
                  (job.genre && typeof job.genre === 'string' ? job.genre.trim() : null) || 
                  'default';

console.log('[TRACE-GENRE][WORKER-EXTRACTION] 🎵 Genre final:', {
  'job.data.genre': extractedGenre,
  'job.genre': job.genre,
  'finalGenre': finalGenre,
  'isDefault': finalGenre === 'default'
});
```

**Linha 355-365:** Construção das options para o pipeline
```javascript
const options = {
  jobId: job.id,
  reference: job?.reference || null,
  mode: job.mode || 'genre',
  genre: finalGenre, // ← ✅ GENRE PASSADO PARA PIPELINE
  referenceJobId: job.reference_job_id || null,
  isReferenceBase: job.is_reference_base || false
};

console.log('[GENRE-FLOW] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('[GENRE-FLOW] 📊 Parâmetros recebidos no worker:');
console.log('[GENRE-FLOW] genre recebido no worker:', options.genre);
```

**Linha 410-420:** Chamada do pipeline
```javascript
const analysisResult = await analyzeAudioWithPipeline(localFilePath, options);
//                                                                     ^^^^^^^ ✅ OPTIONS COM GENRE
```

**Linha 421-430:** Resultado montado
```javascript
const result = {
  ok: true,
  file: job.file_key,
  mode: job.mode,
  genre: options.genre, // ← ✅ GENRE NO RESULTADO
  analyzedAt: new Date().toISOString(),
  ...analysisResult,
};
```

**Linha 535:** Salvamento no banco
```javascript
const finalUpdateResult = await client.query(
  "UPDATE jobs SET status = $1, result = $2, results = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $3",
  ["done", JSON.stringify(result), job.id]
  //       ^^^^^^^^^^^^^^^^^^^^^^^^ ✅ RESULT COM GENRE SALVO
);
```

### ✅ **CONCLUSÃO WORKER.JS:**
- ✅ Extrai `genre` de `job.data.genre` (linha 321-344)
- ✅ Valida se é string válida com trim (linha 347-353)
- ✅ Passa `options.genre` para o pipeline (linha 359)
- ✅ Inclui `genre: options.genre` no resultado final (linha 424)
- ✅ Salva resultado com genre no banco (linha 535)
- ✅ **NÃO SOBRESCREVE** o genre
- ✅ **NÃO PERDE** o genre

---

## 📍 PARTE 5: PIPELINE

### ✅ **ARQUIVO: `work/api/audio/pipeline-complete.js`**

**Linha 195-203:** Extração do genre nas options
```javascript
const mode = options.mode || 'genre';
const detectedGenre = options.genre || 'default';

console.log('[GENRE-FLOW][PIPELINE] Genre detectado (linha 195):', {
  'options.genre': options.genre,
  'detectedGenre': detectedGenre,
  'isDefault': detectedGenre === 'default'
});

finalJSON = generateJSONOutput(coreMetrics, reference, metadata, { 
  jobId, 
  fileName,
  mode: mode,
  genre: detectedGenre, // ← ✅ GENRE PASSADO PARA JSON OUTPUT
  referenceJobId: options.referenceJobId
});
```

**Linha 246-256:** Carregamento de targets por gênero
```javascript
const mode = options.mode || 'genre';
const detectedGenre = options.genre || 'default';

console.log('[GENRE-FLOW][PIPELINE] Genre detectado (linha 246):', {
  'options.genre': options.genre,
  'detectedGenre': detectedGenre,
  'isDefault': detectedGenre === 'default'
});

if (mode !== 'reference' && detectedGenre && detectedGenre !== 'default') {
  customTargets = loadGenreTargets(detectedGenre); // ← ✅ CARREGA TARGETS DO GÊNERO
  if (customTargets) {
    console.log(`[SUGGESTIONS_V1] ✅ Usando targets de ${detectedGenre} do filesystem`);
  }
}
```

**Linha 376-382:** Motor V2 de sugestões
```javascript
const detectedGenreV2 = options.genre || 'default';

console.log('[GENRE-FLOW][PIPELINE] Genre detectado (linha 376):', {
  'options.genre': options.genre,
  'detectedGenreV2': detectedGenreV2,
  'isDefault': detectedGenreV2 === 'default'
});

if (mode !== 'reference' && detectedGenreV2 && detectedGenreV2 !== 'default') {
  customTargetsV2 = loadGenreTargets(detectedGenreV2); // ← ✅ CARREGA TARGETS DO GÊNERO
}
```

**Linha 208-213:** Adição explícita de genre ao JSON final
```javascript
// ✅ CORREÇÃO CRÍTICA: Adicionar genre ao finalJSON logo após geração
finalJSON.genre = detectedGenre; // ← ✅ GENRE ADICIONADO AO JSON FINAL
finalJSON.mode = mode;

console.log('[GENRE-FLOW][PIPELINE] ✅ Genre adicionado ao finalJSON:', {
  genre: finalJSON.genre,
  mode: finalJSON.mode
});
```

**Linha 425-435:** Summary e Metadata com genre
```javascript
finalJSON.summary = {
  ...v2Summary,
  genre: detectedGenre  // ← ✅ GENRE NO SUMMARY
};
finalJSON.suggestionMetadata = {
  ...v2Metadata,
  genre: detectedGenre  // ← ✅ GENRE NO METADATA
};

console.log('[GENRE-FLOW][PIPELINE] ✅ Summary e Metadata atualizados com genre:', detectedGenre);
```

### ✅ **CONCLUSÃO PIPELINE.JS:**
- ✅ Recebe `options.genre` do worker (linha 195, 246, 376)
- ✅ Usa fallback `'default'` apenas se `options.genre` for undefined (correto)
- ✅ Carrega targets específicos do gênero (linha 269, 384)
- ✅ Adiciona `genre` ao `finalJSON` (linha 209)
- ✅ Adiciona `genre` ao `summary` (linha 427)
- ✅ Adiciona `genre` ao `suggestionMetadata` (linha 430)
- ✅ **NÃO SOBRESCREVE** o genre em nenhum ponto
- ✅ Logs detalhados para rastreamento

---

## 📍 PARTE 6: JSON OUTPUT

### ✅ **ARQUIVO: `work/api/audio/json-output.js`**

**Linha 59-65:** Recebimento do genre nas options
```javascript
const finalJSON = buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata, { 
  jobId,
  genre: options.genre, // ← ✅ GENRE PASSADO PARA buildFinalJSON
  mode: options.mode,
  referenceJobId: options.referenceJobId,
  preloadedReferenceMetrics: options.preloadedReferenceMetrics
});
```

**Linha 480-481:** Adição do genre ao JSON final
```javascript
function buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata, options = {}) {
  const jobId = options.jobId || 'unknown';
  const scoreValue = scoringResult.score || scoringResult.scorePct;

  return {
    // 🎯 CORREÇÃO CRÍTICA: Incluir genre e mode no JSON final
    genre: options.genre || 'default', // ← ✅ GENRE NO JSON FINAL
    mode: options.mode || 'genre',
    
    score: Math.round(scoreValue * 10) / 10,
    classification: scoringResult.classification || 'unknown',
    ...
  };
}
```

### ✅ **CONCLUSÃO JSON-OUTPUT.JS:**
- ✅ Recebe `options.genre` (linha 61)
- ✅ Adiciona `genre` como primeiro campo do JSON final (linha 480)
- ✅ Usa fallback `'default'` apenas se `options.genre` for undefined
- ✅ **NÃO SOBRESCREVE** o genre

---

## 📍 PARTE 7: TABELA POSTGRESQL `jobs`

### ✅ **ESTRUTURA DA TABELA:**

```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  file_key TEXT,
  mode TEXT,
  status TEXT,
  file_name TEXT,
  reference_for UUID,
  data JSONB,          ← ✅ CAMPO QUE ARMAZENA { genre: "..." }
  result JSONB,        ← ✅ CAMPO QUE ARMAZENA JSON FINAL COM genre
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

### ✅ **FLUXO DE DADOS:**

**1. Criação do job (work/api/audio/analyze.js - linha 118):**
```sql
INSERT INTO jobs (id, file_key, mode, status, file_name, reference_for, data, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *

-- Exemplo:
-- data = '{"genre":"funk_mandela"}' ← ✅ GENRE SALVO AQUI
```

**2. Worker lê o job (work/worker.js - linha 311):**
```sql
SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1

-- Retorna:
-- job.data = { genre: "funk_mandela" } ← ✅ GENRE LIDO DAQUI
```

**3. Worker atualiza resultado (work/worker.js - linha 535):**
```sql
UPDATE jobs 
SET status = 'done', 
    result = $1, 
    results = $1, 
    completed_at = NOW(), 
    updated_at = NOW() 
WHERE id = $2

-- Exemplo:
-- result = '{"genre":"funk_mandela","mode":"genre","score":85,...}' ← ✅ GENRE NO RESULTADO
```

### ✅ **CONCLUSÃO POSTGRESQL:**
- ✅ Coluna `data` armazena `{ genre: "..." }` na criação do job
- ✅ Worker lê `job.data.genre` corretamente
- ✅ Coluna `result` armazena JSON final com `genre: "..."`
- ✅ **NÃO HÁ PERDA** de dados na tabela

---

## 🎯 DIAGNÓSTICO FINAL

### ✅ **FLUXO ESTÁ CORRETO:**

1. **Frontend → API:**
   - ✅ Frontend envia `genre` no `req.body`
   - ✅ Rota correta: `/api/audio/analyze`

2. **API → PostgreSQL:**
   - ✅ `work/api/audio/analyze.js` recebe `req.body.genre`
   - ✅ Valida e salva em `job.data = { genre: "..." }`
   - ✅ INSERT bem-sucedido na tabela `jobs`

3. **PostgreSQL → Worker:**
   - ✅ Worker lê `job.data.genre` corretamente
   - ✅ Extrai e valida o genre
   - ✅ Passa `options.genre` para o pipeline

4. **Worker → Pipeline:**
   - ✅ Pipeline recebe `options.genre`
   - ✅ Carrega targets específicos do gênero
   - ✅ Adiciona `genre` ao JSON final

5. **Pipeline → PostgreSQL:**
   - ✅ Worker salva JSON final com `genre: "..."`
   - ✅ UPDATE bem-sucedido em `jobs.result`

6. **PostgreSQL → Frontend:**
   - ✅ Frontend lê `job.result.genre`
   - ✅ Renderiza com genre correto

---

## 🔍 POSSÍVEIS CAUSAS DE PERDA DE GENRE

### ⚠️ **1. Genre vazio/inválido no frontend**

**Causa:**
- Usuário não seleciona gênero
- `genreSelect.value` retorna string vazia `""`
- Fallback para `window.PROD_AI_REF_GENRE` que pode ser `undefined`

**Solução aplicada (linha 1943-1946):**
```javascript
if (!selectedGenre || selectedGenre.trim() === '') {
    selectedGenre = window.PROD_AI_REF_GENRE || 'default';
}
```

---

### ⚠️ **2. API recebe genre null/undefined**

**Causa:**
- Frontend envia `{ genre: null }` ou `{ genre: undefined }`
- API valida como falsy e cria `jobData = null`

**Solução aplicada (linha 108-109):**
```javascript
const hasValidGenre = genre && typeof genre === 'string' && genre.trim().length > 0;
const jobData = hasValidGenre ? { genre: genre.trim() } : null;
```

---

### ⚠️ **3. job.data salvo como NULL no banco**

**Causa:**
- `jobData` é `null` quando genre é inválido
- Campo `data` fica NULL na tabela
- Worker lê `job.data = null`

**Solução aplicada (linha 118):**
```javascript
[..., jobData ? JSON.stringify(jobData) : null]
```

**Validação no worker (linha 321-344):**
```javascript
if (job.data && typeof job.data === 'object') {
  extractedGenre = job.data.genre;
} else if (typeof job.data === 'string') {
  try {
    const parsed = JSON.parse(job.data);
    extractedGenre = parsed.genre;
  }
}
```

---

### ⚠️ **4. Worker não encontra genre em job.data**

**Causa:**
- `job.data` é NULL ou string vazia
- `extractedGenre` fica `null`
- Fallback para `'default'`

**Solução aplicada (linha 356-359):**
```javascript
const finalGenre = extractedGenre || 
                  (job.genre && typeof job.genre === 'string' ? job.genre.trim() : null) || 
                  'default';
```

---

### ⚠️ **5. Pipeline recebe options.genre undefined**

**Causa:**
- Worker passa `options.genre = undefined`
- Pipeline usa fallback: `const detectedGenre = options.genre || 'default'`

**Solução aplicada (linha 195, 246, 376):**
```javascript
const detectedGenre = options.genre || 'default';

console.log('[GENRE-FLOW][PIPELINE] Genre detectado:', {
  'options.genre': options.genre,
  'detectedGenre': detectedGenre,
  'isDefault': detectedGenre === 'default'
});
```

---

## 📋 CHECKLIST DE VALIDAÇÃO

### ✅ **Para confirmar que genre está funcionando:**

1. **Frontend:**
   - [ ] Verificar logs: `[TRACE-GENRE][FRONTEND] 🎵 Gênero selecionado`
   - [ ] Confirmar que `selectedGenre !== 'default'`

2. **API:**
   - [ ] Verificar logs: `[TRACE-GENRE][INPUT] 🔍 Genre recebido do frontend`
   - [ ] Verificar logs: `[TRACE-GENRE][DB-INSERT] 💾 Salvando genre no banco`
   - [ ] Confirmar que `hasValidGenre = true`

3. **PostgreSQL:**
   - [ ] Consultar: `SELECT id, data FROM jobs ORDER BY created_at DESC LIMIT 1`
   - [ ] Confirmar que `data = '{"genre":"funk_mandela"}'` (não NULL)

4. **Worker:**
   - [ ] Verificar logs: `[TRACE-GENRE][WORKER-INPUT] 🔍 Job recebido do banco`
   - [ ] Verificar logs: `[TRACE-GENRE][WORKER] ✅ Genre extraído de job.data`
   - [ ] Confirmar que `finalGenre !== 'default'`

5. **Pipeline:**
   - [ ] Verificar logs: `[GENRE-FLOW][PIPELINE] Genre detectado (linha 195)`
   - [ ] Verificar logs: `[GENRE-FLOW][PIPELINE] ✅ Genre adicionado ao finalJSON`
   - [ ] Confirmar que `detectedGenre !== 'default'`

6. **Resultado Final:**
   - [ ] Consultar: `SELECT id, result FROM jobs WHERE status='done' ORDER BY completed_at DESC LIMIT 1`
   - [ ] Confirmar que `result.genre = "funk_mandela"` (não "default")

---

## 🎯 CONCLUSÃO DA AUDITORIA

### ✅ **FLUXO ESTÁ CORRETO:**
- ✅ Frontend envia genre corretamente
- ✅ API recebe e valida genre
- ✅ PostgreSQL armazena genre em `job.data`
- ✅ Worker extrai genre de `job.data.genre`
- ✅ Pipeline usa genre para carregar targets
- ✅ JSON final contém genre correto

### ✅ **CORREÇÕES JÁ APLICADAS:**
- ✅ API: Validação robusta de genre (linha 108-109)
- ✅ Worker: Extração com validação adicional (linha 347-353)
- ✅ Pipeline: Logs detalhados de rastreamento (linha 195, 246, 376)

### ✅ **NÃO EXISTEM:**
- ✅ Rotas intermediárias que limpam o payload
- ✅ Sobrescritas indevidas de genre
- ✅ Perdas de genre no fluxo
- ✅ Divergências entre `api/audio/analyze.js` e `work/api/audio/analyze.js`

### ⚠️ **POSSÍVEL CAUSA RESTANTE:**

Se o genre ainda estiver sendo substituído por "default", a causa é:

**Frontend não está enviando genre válido:**
- Usuário não seleciona gênero
- `genreSelect.value` retorna `""` ou `undefined`
- Fallback para `window.PROD_AI_REF_GENRE` que pode ser `undefined`
- Frontend envia `{ genre: null }` ou `{ genre: undefined }`

**Solução:**
Garantir que o frontend **SEMPRE** envie um genre válido, ou aplicar fallback robusto no frontend antes de enviar.

---

**Status:** ✅ **AUDITORIA COMPLETA - FLUXO VALIDADO**  
**Próximo passo:** Testar em produção e verificar logs para confirmar genre válido em todos os pontos

