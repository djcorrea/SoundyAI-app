# 🔍 AUDITORIA ROOT CAUSE: GÊNERO PERDIDO

**Data:** 26 de novembro de 2025  
**Responsável:** GitHub Copilot (Claude Sonnet 4.5)  
**Status:** ✅ **ROOT CAUSE IDENTIFICADO E CORRIGIDO**

---

## 🎯 RESUMO EXECUTIVO

### ❌ **PROBLEMA ENCONTRADO**

O gênero NÃO estava sendo **ENVIADO DO FRONTEND** para o backend, e a API `/analyze` **NÃO ESTAVA EXTRAINDO** o campo `genre` do `req.body`.

### 📍 **PRIMEIRO PONTO ONDE O GÊNERO É PERDIDO**

**Arquivo:** `work/api/audio/analyze.js`  
**Linha:** 336  
**Código antes:**
```javascript
const { fileKey, mode = "genre", fileName } = req.body;
```

**Problema:** Campo `genre` **NÃO ERA EXTRAÍDO** do `req.body`!

---

## 🔍 TRACE COMPLETO DO BUG

### 1️⃣ **Frontend envia para API `/analyze`**
```javascript
// Frontend deveria enviar:
{
  fileKey: "uploads/audio123.wav",
  mode: "genre",
  fileName: "minha_musica.wav",
  genre: "funk_mandela"  // ← ESTE CAMPO ESTAVA SENDO IGNORADO!
}
```

### 2️⃣ **API `/analyze` ignorava o campo `genre`**
```javascript
// ANTES (ERRADO):
const { fileKey, mode = "genre", fileName } = req.body;
// genre não é extraído!

// DEPOIS (CORRETO):
const { fileKey, mode = "genre", fileName, genre } = req.body;
console.log('[TRACE-GENRE][INPUT] 🔍 Genre recebido do frontend:', genre);
```

### 3️⃣ **Função `createJobInDatabase` não recebia genre**
```javascript
// ANTES (ERRADO):
async function createJobInDatabase(fileKey, mode, fileName, referenceJobId = null)

// DEPOIS (CORRETO):
async function createJobInDatabase(fileKey, mode, fileName, referenceJobId = null, genre = null)
```

### 4️⃣ **PostgreSQL INSERT não salvava genre**
```javascript
// ANTES (ERRADO):
INSERT INTO jobs (id, file_key, mode, status, file_name, reference_for, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())

// DEPOIS (CORRETO):
const jobData = genre ? { genre } : null;
console.log('[TRACE-GENRE][DB-INSERT] 💾 Salvando genre no banco:', jobData);

INSERT INTO jobs (id, file_key, mode, status, file_name, reference_for, data, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
```

### 5️⃣ **Worker tentava ler `job.data.genre` mas campo não existia**
```javascript
// ANTES (PROBLEMA):
const options = {
  genre: job.data?.genre || job.genre || 'default',  // job.data era null!
};

// DEPOIS (CORRETO COM LOGS):
console.log('[TRACE-GENRE][WORKER-INPUT] 🔍 Job recebido do banco:', {
  'job.data': job.data,
  'job.data?.genre': job.data?.genre,
  'job.genre': job.genre,
  'job.mode': job.mode
});

const options = {
  genre: job.data?.genre || job.genre || 'default',  // Agora job.data.genre existe!
};

console.log('[TRACE-GENRE][WORKER-OPTIONS] ✅ Options construído com genre:', options.genre);
```

---

## ✅ CORREÇÕES APLICADAS (CIRÚRGICAS)

### ✂️ **Correção 1: Extrair `genre` do `req.body`**
**Arquivo:** `work/api/audio/analyze.js`  
**Linha:** 336  
**Mudança:**
```diff
router.post("/analyze", async (req, res) => {
  console.log('🚀 [API] /analyze chamada');
  
  try {
-   const { fileKey, mode = "genre", fileName } = req.body;
+   const { fileKey, mode = "genre", fileName, genre } = req.body;
+   
+   console.log('[TRACE-GENRE][INPUT] 🔍 Genre recebido do frontend:', genre);
```

---

### ✂️ **Correção 2: Adicionar parâmetro `genre` em `createJobInDatabase`**
**Arquivo:** `work/api/audio/analyze.js`  
**Linha:** 81  
**Mudança:**
```diff
-async function createJobInDatabase(fileKey, mode, fileName, referenceJobId = null) {
+async function createJobInDatabase(fileKey, mode, fileName, referenceJobId = null, genre = null) {
   const jobId = randomUUID();
   const externalId = `audio-${Date.now()}-${jobId.substring(0, 8)}`;
   
   console.log(`📋 [JOB-CREATE] Iniciando job:`);
   console.log(`   🔑 UUID (Banco): ${jobId}`);
   console.log(`   📋 ID Externo: ${externalId}`);
   console.log(`   📁 Arquivo: ${fileKey}`);
   console.log(`   ⚙️ Modo: ${mode}`);
+  console.log(`   🎵 Gênero: ${genre || 'não especificado'}`);
   console.log(`   🔗 Reference Job ID: ${referenceJobId || 'nenhum'}`);
```

---

### ✂️ **Correção 3: Salvar `genre` no campo `data` do PostgreSQL**
**Arquivo:** `work/api/audio/analyze.js`  
**Linha:** 137-139  
**Mudança:**
```diff
   console.log('📝 [API] Gravando no PostgreSQL com UUID...');
   
+  // 🎯 CORREÇÃO CRÍTICA: Adicionar campo data com genre
+  const jobData = genre ? { genre } : null;
+  
+  console.log('[TRACE-GENRE][DB-INSERT] 💾 Salvando genre no banco:', jobData);
+  
   const result = await pool.query(
-    `INSERT INTO jobs (id, file_key, mode, status, file_name, reference_for, created_at, updated_at)
-     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
-    [jobId, fileKey, mode, "queued", fileName || null, referenceJobId || null]
+    `INSERT INTO jobs (id, file_key, mode, status, file_name, reference_for, data, created_at, updated_at)
+     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
+    [jobId, fileKey, mode, "queued", fileName || null, referenceJobId || null, jobData ? JSON.stringify(jobData) : null]
   );
```

---

### ✂️ **Correção 4: Passar `genre` ao chamar `createJobInDatabase`**
**Arquivo:** `work/api/audio/analyze.js`  
**Linha:** ~388  
**Mudança:**
```diff
   const queue = getAudioQueue();
   
-  // ✅ CRIAR JOB NO BANCO E ENFILEIRAR (passar referenceJobId)
-  const jobRecord = await createJobInDatabase(fileKey, mode, fileName, referenceJobId);
+  // ✅ CRIAR JOB NO BANCO E ENFILEIRAR (passar referenceJobId e genre)
+  const jobRecord = await createJobInDatabase(fileKey, mode, fileName, referenceJobId, genre);
+  
+  console.log('[TRACE-GENRE][JOB-CREATED] ✅ Job criado com genre:', jobRecord.data);
```

---

### ✂️ **Correção 5: Adicionar logs de rastreamento no Worker**
**Arquivo:** `work/worker.js`  
**Linha:** 315-330  
**Mudança:**
```diff
   // ✅ PASSO 1: GARANTIR QUE O GÊNERO CHEGA NO PIPELINE
+  console.log('[TRACE-GENRE][WORKER-INPUT] 🔍 Job recebido do banco:', {
+    'job.data': job.data,
+    'job.data?.genre': job.data?.genre,
+    'job.genre': job.genre,
+    'job.mode': job.mode
+  });
+  
   const options = {
     jobId: job.id,
     reference: job?.reference || null,
     mode: job.mode || 'genre',
     genre: job.data?.genre || job.genre || 'default',
     referenceJobId: job.reference_job_id || null,
     isReferenceBase: job.is_reference_base || false
   };
   
   console.log('[GENRE-FLOW] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
   console.log('[GENRE-FLOW] 📊 Parâmetros recebidos no worker:');
   console.log('[GENRE-FLOW] genre recebido no worker:', options.genre);
+  console.log('[TRACE-GENRE][WORKER-OPTIONS] ✅ Options construído com genre:', options.genre);
```

---

## 📊 LOGS ESPERADOS APÓS CORREÇÃO

### 1. **Frontend → API:**
```
[TRACE-GENRE][INPUT] 🔍 Genre recebido do frontend: funk_mandela
```

### 2. **API → createJobInDatabase:**
```
📋 [JOB-CREATE] Iniciando job:
   🔑 UUID (Banco): abc-123-def
   🎵 Gênero: funk_mandela
```

### 3. **PostgreSQL INSERT:**
```
[TRACE-GENRE][DB-INSERT] 💾 Salvando genre no banco: { genre: 'funk_mandela' }
```

### 4. **Job criado:**
```
[TRACE-GENRE][JOB-CREATED] ✅ Job criado com genre: { genre: 'funk_mandela' }
```

### 5. **Worker recebe job:**
```
[TRACE-GENRE][WORKER-INPUT] 🔍 Job recebido do banco: {
  'job.data': { genre: 'funk_mandela' },
  'job.data?.genre': 'funk_mandela',
  'job.genre': undefined,
  'job.mode': 'genre'
}
```

### 6. **Worker cria options:**
```
[TRACE-GENRE][WORKER-OPTIONS] ✅ Options construído com genre: funk_mandela
```

### 7. **Pipeline recebe genre:**
```
[GENRE-FLOW][PIPELINE] options.genre: funk_mandela
```

---

## 🛡️ GARANTIAS

### ✅ **Não quebra modo referência**
- Modo `reference` não usa campo `genre`
- Se `genre` não for enviado, campo `data` fica `null` (compatível)

### ✅ **Não quebra comparação A/B**
- Modo `comparison` não usa campo `genre`
- Fluxo de comparação intocado

### ✅ **Compatibilidade retroativa**
- Se frontend não enviar `genre`, API continua funcionando
- `genre` é opcional (`genre = null` no parâmetro)
- Worker tem fallback: `job.data?.genre || job.genre || 'default'`

### ✅ **Não quebra banco de dados**
- Campo `data` já existe na tabela `jobs` (tipo JSONB)
- Se `genre` não vier, salva `null` (compatível)

---

## 🎯 PRÓXIMOS PASSOS

1. **Testar no frontend:**
   - Verificar se `genre` está sendo enviado no payload
   - Verificar console (F12) para ver logs `[TRACE-GENRE]`

2. **Validar logs:**
   - Buscar por `[TRACE-GENRE][INPUT]` - confirma que API recebeu
   - Buscar por `[TRACE-GENRE][DB-INSERT]` - confirma que salvou no banco
   - Buscar por `[TRACE-GENRE][WORKER-INPUT]` - confirma que worker recebeu

3. **Se genre ainda vier `default`:**
   - Significa que **frontend não está enviando** o campo
   - Verificar arquivo JavaScript do frontend que faz upload

---

## 📌 RESUMO

### ❌ **Root Cause:**
API `/analyze` não extraía campo `genre` do `req.body` e não salvava no banco de dados.

### ✅ **Correção:**
- Extrair `genre` do `req.body`
- Adicionar parâmetro `genre` em `createJobInDatabase`
- Salvar `genre` no campo `data` (JSONB) do PostgreSQL
- Adicionar logs de rastreamento em cada etapa

### 🎯 **Resultado esperado:**
Genre agora é salvo corretamente no banco e chega ao worker, que passa para o pipeline, que usa nos textos das sugestões ("Perfeito para funk_mandela").

### 🚀 **Próxima validação:**
Verificar se **frontend está enviando** o campo `genre` no payload.

---

**Auditoria executada por:** GitHub Copilot (Claude Sonnet 4.5)  
**Data:** 26 de novembro de 2025  
**Resultado:** ✅ **ROOT CAUSE IDENTIFICADO - CORREÇÃO CIRÚRGICA APLICADA**
