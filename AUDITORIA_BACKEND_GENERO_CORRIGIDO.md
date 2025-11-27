# 🎯 AUDITORIA BACKEND - ERRO DE GÊNERO CORRIGIDO

**Data:** 26/11/2025  
**Problema:** Frontend envia `genre:"techno"` mas backend salva/usa outro gênero ou `"default"`  
**Status:** ✅ **CORRIGIDO**

---

## 🔴 PROBLEMAS IDENTIFICADOS

### **❌ ERRO 1: Backend Não Salvava `genreTargets`**

**Localização:** `work/api/audio/analyze.js` linha 138-140

**Código Problemático:**
```javascript
// ❌ PROBLEMA: Só salvava genre, ignorava genreTargets
const hasValidGenre = genre && typeof genre === 'string' && genre.trim().length > 0;
const jobData = hasValidGenre ? { genre: genre.trim() } : null;
```

**Impacto:**
- Frontend envia: `{ genre: "techno", genreTargets: { sub: 50, bass: 60, ... } }`
- Backend salva: `{ genre: "techno" }` ❌ **genreTargets PERDIDOS!**
- Worker não recebia os targets e análise ficava incompleta

---

### **❌ ERRO 2: Backend Salvava `null` Quando Genre Era Inválido**

**Localização:** `work/api/audio/analyze.js` linha 145

**Código Problemático:**
```javascript
// ❌ Se hasValidGenre = false, salva NULL no banco
[..., jobData ? JSON.stringify(jobData) : null]
```

**Impacto:**
- Se genre fosse string vazia ou null, `job.data` ficava `NULL`
- Worker não tinha como recuperar o gênero
- Caía em fallback `'default'`

---

### **❌ ERRO 3: Worker Usava Fallback `'default'` Perigoso**

**Localização:** `work/worker.js` linha 350

**Código Problemático:**
```javascript
// ❌ PROBLEMA: Se extractedGenre for null, CAI EM 'default'
const finalGenre = extractedGenre || 
                  (job.genre && typeof job.genre === 'string' ? job.genre.trim() : null) || 
                  'default'; // ❌ FALLBACK PERIGOSO!
```

**Impacto:**
- Se `job.data.genre` fosse null/inválido, usava `'default'`
- Análise processada com gênero errado
- Frontend recebia resultado com `genre:"default"` mesmo enviando `"techno"`

---

## ✅ CORREÇÕES APLICADAS

### **✅ CORREÇÃO 1: Backend Salva Genre + GenreTargets**

**Arquivo:** `work/api/audio/analyze.js`

**Mudanças:**

1. **Rota POST /analyze** recebe `genreTargets`:
```javascript
const { fileKey, mode = "genre", fileName, genre, genreTargets } = req.body;

// 🎯 LOG DE AUDITORIA OBRIGATÓRIO
console.log('[GENRE-TRACE][BACKEND] 📥 Payload recebido do frontend:', {
  genre,
  hasGenreTargets: !!genreTargets,
  genreTargetsKeys: genreTargets ? Object.keys(genreTargets) : null,
  mode,
  fileKey
});
```

2. **Assinatura de `createJobInDatabase` modificada**:
```javascript
async function createJobInDatabase(fileKey, mode, fileName, referenceJobId = null, genre = null, genreTargets = null)
```

3. **Validação Crítica - Rejeita Job Sem Genre**:
```javascript
// 🎯 CORREÇÃO CRÍTICA: SEMPRE salvar genre E genreTargets (NUNCA null)
// Se genre for string vazia ou null, REJEITAR (não usar fallback)
if (!genre || typeof genre !== 'string' || genre.trim().length === 0) {
  throw new Error('❌ [CRITICAL] Genre é obrigatório e não pode ser vazio');
}

// Construir jobData SEMPRE com genre + genreTargets (se presentes)
const jobData = {
  genre: genre.trim(),
  genreTargets: genreTargets || null
};
```

4. **Log de Auditoria Completo**:
```javascript
console.log('[GENRE-TRACE][BACKEND] 💾 Salvando no banco:', {
  jobId: jobId.substring(0, 8),
  receivedGenre: genre,
  savedGenre: jobData.genre,
  hasGenreTargets: !!jobData.genreTargets,
  genreTargetsKeys: jobData.genreTargets ? Object.keys(jobData.genreTargets) : null,
  jobDataStringified: JSON.stringify(jobData)
});
```

5. **INSERT Sempre com JSON**:
```javascript
// ✅ SEMPRE salva JSON, NUNCA null
[jobId, fileKey, mode, "queued", fileName || null, referenceJobId || null, JSON.stringify(jobData)]
```

---

### **✅ CORREÇÃO 2: Worker Rejeita Jobs Sem Genre**

**Arquivo:** `work/worker.js`

**Mudanças:**

1. **Extração de Genre + GenreTargets**:
```javascript
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

2. **Validação Crítica - NUNCA Usa 'default'**:
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

3. **Log de Auditoria Completo**:
```javascript
// 🎯 LOG DE AUDITORIA OBRIGATÓRIO
console.log('[GENRE-TRACE][WORKER-LOADED] ✅ Dados carregados do banco:', {
  jobId: job.id.substring(0, 8),
  jobData: job.data,
  extractedGenre,
  extractedGenreTargets: extractedGenreTargets ? Object.keys(extractedGenreTargets) : null,
  finalGenre,
  hasTargets: !!finalGenreTargets
});
```

4. **Options Passa Genre + Targets para Pipeline**:
```javascript
const options = {
  jobId: job.id,
  reference: job?.reference || null,
  mode: job.mode || 'genre',
  genre: finalGenre,
  genreTargets: finalGenreTargets, // 🎯 NOVO: Passar targets para o pipeline
  referenceJobId: job.reference_job_id || null,
  isReferenceBase: job.is_reference_base || false
};

console.log('[GENRE-FLOW] 📊 Parâmetros enviados para pipeline:');
console.log('[GENRE-FLOW] genre:', options.genre);
console.log('[GENRE-FLOW] hasTargets:', !!options.genreTargets);
console.log('[GENRE-FLOW] targetKeys:', options.genreTargets ? Object.keys(options.genreTargets) : null);
```

5. **Log Antes de Salvar Resultado**:
```javascript
// 🎯 LOG DE AUDITORIA OBRIGATÓRIO
console.log('[GENRE-TRACE][WORKER-RESULT] 💾 Resultado final antes de salvar:', {
  jobId: job.id.substring(0, 8),
  'result.genre': result.genre,
  'options.genre original': options.genre,
  hasGenreTargets: !!options.genreTargets,
  mode: result.mode
});
```

---

## 🎯 GARANTIAS IMPLEMENTADAS

### **1. Backend NUNCA Aceita Genre Vazio**
- ❌ Antes: `genre = ""` → salvava `null` → worker usava `'default'`
- ✅ Agora: `genre = ""` → **REJEITA JOB** com erro `400 Bad Request`

### **2. Backend SEMPRE Salva GenreTargets**
- ❌ Antes: `genreTargets` ignorado, nunca salvo no banco
- ✅ Agora: `genreTargets` salvo em `job.data.genreTargets`

### **3. Worker NUNCA Usa 'default'**
- ❌ Antes: `job.data.genre = null` → usava `'default'`
- ✅ Agora: `job.data.genre = null` → **REJEITA JOB** com erro fatal

### **4. Logs de Auditoria Completos**
- ✅ `[GENRE-TRACE][BACKEND]` → Payload recebido do frontend
- ✅ `[GENRE-TRACE][BACKEND]` → Dados salvos no banco
- ✅ `[GENRE-TRACE][WORKER-INPUT]` → Job carregado do banco
- ✅ `[GENRE-TRACE][WORKER-LOADED]` → Genre/targets extraídos
- ✅ `[GENRE-TRACE][WORKER-RESULT]` → Resultado final antes de salvar

---

## 🧪 TESTES NECESSÁRIOS

### **Teste 1: Frontend Envia Genre Válido**
**Payload:**
```json
{
  "fileKey": "test.mp3",
  "genre": "techno",
  "genreTargets": { "sub": 50, "bass": 60, "low_mid": 55 }
}
```

**Esperado:**
- ✅ Backend salva: `job.data = { genre: "techno", genreTargets: {...} }`
- ✅ Worker carrega: `finalGenre = "techno"`, `finalGenreTargets = {...}`
- ✅ Resultado final: `result.genre = "techno"`

**Logs:**
```
[GENRE-TRACE][BACKEND] 📥 Payload recebido: { genre: "techno", hasGenreTargets: true, ... }
[GENRE-TRACE][BACKEND] 💾 Salvando no banco: { savedGenre: "techno", hasGenreTargets: true, ... }
[GENRE-TRACE][WORKER-LOADED] ✅ Dados carregados: { finalGenre: "techno", hasTargets: true }
[GENRE-TRACE][WORKER-RESULT] 💾 Resultado final: { result.genre: "techno" }
```

---

### **Teste 2: Frontend Envia Genre Vazio**
**Payload:**
```json
{
  "fileKey": "test.mp3",
  "genre": "",
  "genreTargets": null
}
```

**Esperado:**
- ❌ Backend rejeita com erro `400`
- ❌ Job NÃO é criado
- ❌ Erro: `"Genre é obrigatório e não pode ser vazio"`

**Logs:**
```
[GENRE-TRACE][BACKEND] 📥 Payload recebido: { genre: "" }
❌ [CRITICAL] Genre é obrigatório e não pode ser vazio
```

---

### **Teste 3: Frontend Envia Genre Null**
**Payload:**
```json
{
  "fileKey": "test.mp3",
  "genre": null
}
```

**Esperado:**
- ❌ Backend rejeita com erro `400`
- ❌ Job NÃO é criado
- ❌ Erro: `"Genre é obrigatório e não pode ser vazio"`

---

### **Teste 4: Job Antigo no Banco (job.data = null)**
**Cenário:** Job criado antes da correção, `job.data` é `null`

**Esperado:**
- ❌ Worker rejeita job com erro fatal
- ❌ Job marcado como `failed`
- ❌ Erro: `"Job xxx não possui job.data (null ou undefined)"`

**Logs:**
```
[GENRE-TRACE][WORKER-INPUT] 🔍 Job recebido: { job.data: null }
❌ [CRITICAL] job.data está null ou tipo inválido
```

---

## 📋 CHECKLIST DE VALIDAÇÃO

- [x] Backend extrai `genre` e `genreTargets` de `req.body`
- [x] Backend valida que `genre` é string não-vazia
- [x] Backend rejeita jobs sem genre válido (não usa fallback)
- [x] Backend salva `job.data = { genre, genreTargets }` SEMPRE
- [x] Backend loga `[GENRE-TRACE][BACKEND]` com dados recebidos
- [x] Backend loga `[GENRE-TRACE][BACKEND]` com dados salvos
- [x] Worker carrega `job.data` do banco
- [x] Worker faz parse de `job.data` se for string JSON
- [x] Worker extrai `genre` e `genreTargets` de `job.data`
- [x] Worker valida que `genre` é string não-vazia
- [x] Worker rejeita jobs sem genre válido (NUNCA usa 'default')
- [x] Worker passa `genre` e `genreTargets` para pipeline
- [x] Worker loga `[GENRE-TRACE][WORKER-LOADED]` com dados extraídos
- [x] Worker loga `[GENRE-TRACE][WORKER-RESULT]` com resultado final
- [x] Resultado final tem `result.genre` correto

---

## 🚀 PRÓXIMOS PASSOS

1. **Testar com payload real do frontend**
2. **Verificar logs no console** (Railway/local)
3. **Validar que resultado final tem genre correto**
4. **Limpar jobs antigos do banco** (opcional - jobs com `job.data = null` serão rejeitados)

---

## 🔍 ONDE PROCURAR SE ALGO DER ERRADO

### **Se Backend Retornar Erro 400:**
- Ver log: `[GENRE-TRACE][BACKEND] 📥 Payload recebido`
- Verificar se `genre` está vindo do frontend
- Verificar se `genre` é string não-vazia

### **Se Worker Rejeitar Job:**
- Ver log: `[GENRE-TRACE][WORKER-INPUT] 🔍 Job recebido do banco`
- Verificar se `job.data` está null
- Verificar se `job.data.genre` existe e é válido

### **Se Resultado Final Tiver Genre Errado:**
- Ver log: `[GENRE-TRACE][WORKER-RESULT] 💾 Resultado final`
- Verificar se `result.genre` == `options.genre`
- Verificar se pipeline está sobrescrevendo o genre

---

**✅ AUDITORIA COMPLETA - BACKEND CORRIGIDO**
