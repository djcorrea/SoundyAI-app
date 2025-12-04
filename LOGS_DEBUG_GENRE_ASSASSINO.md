# 🔍 LOGS DE DEBUG: ENCONTRAR O ASSASSINO DO GENRE

## 📋 OBJETIVO

Identificar EXATAMENTE onde o campo `genre` está sendo perdido no fluxo:
```
Frontend → Controller → Redis → Worker → Pipeline → Results
```

---

## 🎯 LOGS ADICIONADOS

### 1️⃣ **[DEBUG-CONTROLLER-PAYLOAD]** - Controller (/api/audio/analyze)

**Arquivos modificados:**
- `api/audio/analyze.js` (linha ~105)
- `work/api/audio/analyze.js` (linha ~109)

**Log inserido ANTES de `queue.add()`:**
```javascript
console.log('\n\n===== [DEBUG-CONTROLLER-PAYLOAD] Payload que VAI para o Redis =====');
console.dir({
  jobId: jobId,
  externalId: externalId,
  fileKey,
  fileName,
  mode,
  referenceJobId: referenceJobId // (só em work/)
}, { depth: 10 });
console.log('===============================================================\n\n');
```

**O que este log vai mostrar:**
- Se `genre` está PRESENTE no payload que vai para o Redis
- Se `genreTargets` está PRESENTE no payload
- Se outros campos estão corretos (`mode`, `fileKey`, etc.)

**Interpretação:**

✅ **Se aparecer `genre: "funk_bh"`:**
- Controller está correto ✅
- Frontend enviou corretamente ✅
- Redis vai receber o gênero ✅
- Bug está DEPOIS (worker/pipeline)

❌ **Se aparecer `genre: undefined` ou genre não existir:**
- **ASSASSINO ENCONTRADO** 🎯
- Controller NÃO está enviando genre para o Redis
- Frontend pode estar enviando, mas controller não está repassando
- **FIX:** Adicionar `genre` no payload do `queue.add()`

---

### 2️⃣ **[DEBUG-WORKER-JOB.DATA]** - Worker (work/worker.js)

**Arquivo modificado:**
- `work/worker.js` (linha ~322)

**Log inserido NO INÍCIO de `processJob(job)`:**
```javascript
console.log('\n\n===== [DEBUG-WORKER-JOB.DATA] Recebido no Worker =====');
console.dir(job.data, { depth: 10 });
console.log('=======================================================\n\n');
```

**O que este log vai mostrar:**
- O que o Worker RECEBEU do Redis
- Se `job.data.genre` existe
- Se `job.data.genreTargets` existe
- Se outros campos chegaram corretamente

**Interpretação:**

✅ **Se aparecer `genre: "funk_bh"`:**
- Redis recebeu e preservou o gênero ✅
- Worker recebeu corretamente ✅
- Bug está DEPOIS (pipeline/output)

❌ **Se aparecer `genre: undefined` ou genre não existir:**
- **ASSASSINO CONFIRMADO** 🎯
- Redis NUNCA recebeu o gênero
- Controller não enviou (ver log #1)
- **FIX:** Corrigir payload no controller

---

### 3️⃣ **[DEBUG-PIPELINE-GENRE]** - Pipeline (api/audio/pipeline-complete.js)

**Arquivos modificados:**
- `api/audio/pipeline-complete.js` (linha ~13)
- `work/api/audio/pipeline-complete.js` (linha ~73)

**Log inserido NO INÍCIO de `processAudioComplete()`:**
```javascript
console.log('\n\n===== [DEBUG-PIPELINE-GENRE] Início do pipeline =====');
console.log('mode:', options.mode);
console.log('genre (options.genre):', options.genre);
console.log('finalGenre:', options.finalGenre);
console.log('selectedGenre:', options.selectedGenre);
console.log('genreTargets:', options.genreTargets ? Object.keys(options.genreTargets) : null);
console.log('jobId:', jobId); // (só em work/)
console.log('=====================================================\n\n');
```

**O que este log vai mostrar:**
- Se `options.genre` chegou no pipeline
- Se `options.genreTargets` chegou no pipeline
- Se `mode` está correto
- Quais propriedades o pipeline está vendo

**Interpretação:**

✅ **Se aparecer `genre: "funk_bh"`:**
- Pipeline recebeu o gênero ✅
- Worker passou corretamente ✅
- Bug está em PROCESSAMENTO INTERNO (validação/output)

❌ **Se aparecer `genre: undefined`:**
- **ASSASSINO LOCALIZADO** 🎯
- Worker não passou `options.genre` para o pipeline
- **FIX:** Verificar `analyzeAudioWithPipeline()` no worker

❓ **Se aparecer outras propriedades preenchidas mas `genre: undefined`:**
- Worker está montando `options` mas não incluindo `genre`
- **FIX:** Adicionar `genre: job.data.genre` no objeto `options`

---

## 🔬 FLUXO DE DIAGNÓSTICO

### Cenário 1: Genre nunca sai do controller
```
[DEBUG-CONTROLLER-PAYLOAD] ❌ genre: undefined
[DEBUG-WORKER-JOB.DATA] ❌ genre: undefined
[DEBUG-PIPELINE-GENRE] ❌ genre: undefined
```

**ROOT CAUSE:** Controller não está enviando `genre` no payload do Redis

**FIX:**
```javascript
// Em api/audio/analyze.js (linha ~109)
const redisJob = await queue.add('process-audio', {
  jobId: jobId,
  externalId: externalId,
  fileKey,
  fileName,
  mode,
  genre: req.body.genre,           // ← ADICIONAR
  genreTargets: req.body.genreTargets // ← ADICIONAR
}, { ... });
```

---

### Cenário 2: Genre sai do controller mas não chega no worker
```
[DEBUG-CONTROLLER-PAYLOAD] ✅ genre: "funk_bh"
[DEBUG-WORKER-JOB.DATA] ❌ genre: undefined
[DEBUG-PIPELINE-GENRE] ❌ genre: undefined
```

**ROOT CAUSE:** Redis não está preservando o campo ou worker não está lendo corretamente

**FIX:**
- Verificar configuração do Redis
- Verificar serialização do BullMQ
- Verificar se `job.data` tem outros campos (se sim, Redis está funcionando)

---

### Cenário 3: Genre chega no worker mas não no pipeline
```
[DEBUG-CONTROLLER-PAYLOAD] ✅ genre: "funk_bh"
[DEBUG-WORKER-JOB.DATA] ✅ genre: "funk_bh"
[DEBUG-PIPELINE-GENRE] ❌ genre: undefined
```

**ROOT CAUSE:** Worker não está passando `genre` no objeto `options` para o pipeline

**FIX:**
```javascript
// Em work/worker.js (linha ~380)
const options = {
  jobId: job.id,
  mode: job.mode,
  genre: job.data.genre,              // ← ADICIONAR
  genreTargets: job.data.genreTargets, // ← ADICIONAR
  // ... outros campos
};

const analysisResult = await analyzeAudioWithPipeline(localFilePath, options);
```

---

### Cenário 4: Genre chega no pipeline mas erro persiste
```
[DEBUG-CONTROLLER-PAYLOAD] ✅ genre: "funk_bh"
[DEBUG-WORKER-JOB.DATA] ✅ genre: "funk_bh"
[DEBUG-PIPELINE-GENRE] ✅ genre: "funk_bh"
[GENRE-ERROR] ❌ Pipeline recebeu modo genre SEM gênero válido
```

**ROOT CAUSE:** Validação do pipeline está buscando genre em lugar errado

**FIX:**
```javascript
// Em api/audio/pipeline-complete.js ou json-output.js
// ANTES:
const genre = options.data?.genre || null;

// DEPOIS:
const genre = options.genre || options.data?.genre || null;
```

---

## 📊 EXEMPLO DE SAÍDA ESPERADA (SUCESSO)

### Console do Controller:
```
===== [DEBUG-CONTROLLER-PAYLOAD] Payload que VAI para o Redis =====
{
  jobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  externalId: 'audio-1733270400000-a1b2c3d4',
  fileKey: 'uploads/audio-12345.mp3',
  fileName: 'minha_musica.mp3',
  mode: 'genre',
  genre: 'funk_bh',
  genreTargets: {
    subBass: { min: -18, ideal: -15, max: -12 },
    bass: { min: -12, ideal: -10, max: -8 },
    ...
  }
}
===============================================================
```

### Console do Worker:
```
===== [DEBUG-WORKER-JOB.DATA] Recebido no Worker =====
{
  jobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  externalId: 'audio-1733270400000-a1b2c3d4',
  fileKey: 'uploads/audio-12345.mp3',
  fileName: 'minha_musica.mp3',
  mode: 'genre',
  genre: 'funk_bh',
  genreTargets: {
    subBass: { min: -18, ideal: -15, max: -12 },
    bass: { min: -12, ideal: -10, max: -8 },
    ...
  }
}
=======================================================
```

### Console do Pipeline:
```
===== [DEBUG-PIPELINE-GENRE] Início do pipeline =====
mode: genre
genre (options.genre): funk_bh
finalGenre: undefined
selectedGenre: undefined
genreTargets: [ 'subBass', 'bass', 'lowMids', 'highMids', 'presence', 'brilliance' ]
jobId: a1b2c3d4
=====================================================
```

---

## 🎯 COMO USAR ESSES LOGS

### 1. Fazer UMA análise de teste:
- Selecionar gênero "Funk (BH)"
- Fazer upload de um arquivo
- Observar os 3 logs no console

### 2. Comparar os logs:

**Primeiro:** `[DEBUG-CONTROLLER-PAYLOAD]`
- Genre está presente? → Controller OK ✅
- Genre não está presente? → **BUG NO CONTROLLER** ❌

**Segundo:** `[DEBUG-WORKER-JOB.DATA]`
- Genre está presente? → Redis/Worker OK ✅
- Genre não está presente mas estava no controller? → **BUG NO REDIS/WORKER** ❌

**Terceiro:** `[DEBUG-PIPELINE-GENRE]`
- Genre está presente? → Pipeline recebeu OK ✅
- Genre não está presente mas estava no worker? → **BUG NA PASSAGEM WORKER→PIPELINE** ❌

### 3. Identificar o assassino:

Se **TODOS os 3 logs** mostrarem `genre: undefined`:
- 🎯 **ASSASSINO:** Controller não está enviando `genre` para o Redis
- 🔧 **FIX:** Adicionar `genre` no payload do `queue.add()`

Se **só o log #1** mostrar `genre: "funk_bh"` mas #2 e #3 mostrarem `undefined`:
- 🎯 **ASSASSINO:** Redis não está preservando ou worker não está lendo
- 🔧 **FIX:** Verificar configuração Redis/BullMQ

Se **logs #1 e #2** mostrarem `genre: "funk_bh"` mas #3 mostrar `undefined`:
- 🎯 **ASSASSINO:** Worker não está passando `genre` para o pipeline
- 🔧 **FIX:** Adicionar `genre: job.data.genre` no objeto `options`

Se **TODOS os 3 logs** mostrarem `genre: "funk_bh"` mas erro persiste:
- 🎯 **ASSASSINO:** Validação do pipeline está buscando em lugar errado
- 🔧 **FIX:** Corrigir validação para usar `options.genre` ao invés de `options.data?.genre`

---

## ✅ RESUMO DE ARQUIVOS MODIFICADOS

### 1. Controller (adicionar log antes de `queue.add`)
- ✅ `api/audio/analyze.js` (linha ~105)
- ✅ `work/api/audio/analyze.js` (linha ~109)

### 2. Worker (adicionar log início de `processJob`)
- ✅ `work/worker.js` (linha ~322)

### 3. Pipeline (adicionar log início de `processAudioComplete`)
- ✅ `api/audio/pipeline-complete.js` (linha ~13)
- ✅ `work/api/audio/pipeline-complete.js` (linha ~73)

---

## 🚀 PRÓXIMOS PASSOS

1. **Fazer deploy** com esses logs
2. **Fazer UMA análise de teste** com gênero selecionado
3. **Capturar os 3 logs** do console
4. **Identificar onde genre vira undefined**
5. **Aplicar o FIX apropriado** baseado no cenário

---

**Data:** 3 de dezembro de 2025  
**Versão:** Debug Logs v1.0
