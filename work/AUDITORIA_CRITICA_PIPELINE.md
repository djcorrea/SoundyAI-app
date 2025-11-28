# 🚨 AUDITORIA CRÍTICA: GÊNERO SENDO SUBSTITUÍDO POR "default"

**Data:** 28 de novembro de 2025  
**Status:** 🔴 **BUGS CRÍTICOS IDENTIFICADOS**

---

## 📍 BUGS IDENTIFICADOS (ORDEM DE SEVERIDADE)

### 🔴 **BUG #1: FALLBACK "default" EM MODO GENRE (CRÍTICO)**

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linhas:** 200, 340, 398

**Problema:**
```javascript
// LINHA 200 (Fase JSON Output)
const detectedGenre = isGenreMode
  ? ((resolvedGenre && String(resolvedGenre).trim()) || 'default')  // ❌ FALLBACK!
  : (options.genre || 'default');

// LINHA 340 (Core Metrics)
const detectedGenre = options.genre || options.reference?.genre || 'default';  // ❌ SEMPRE TEM FALLBACK

// LINHA 398 (Suggestions V2)
const detectedGenreV2 = (mode === 'genre')
  ? (resolvedGenreV2 && String(resolvedGenreV2).trim())  // ✅ Sem fallback aqui
  : (options.genre || 'default');  // ❌ Mas modo reference tem
```

**Por que é um bug:**

Quando `resolvedGenre` é `null`, `undefined` ou `""`:
```javascript
(null && String(null).trim()) || 'default'  // = 'default' ❌
```

**Impacto:**
- Se `options.genre` chegar como `null`, vira `"default"`
- Linha 340 SEMPRE aplica fallback (não respeita modo genre)

---

### 🔴 **BUG #2: CORE-METRICS NÃO RECEBE genreTargets**

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linha:** 155

**Problema:**
```javascript
// LINHA 155: Chamada para computeCoreMetrics
coreMetrics = await computeCoreMetrics(audioData, segmentedData, tempFilePath, {
  jobId,
  fileName,
  referenceJobId: options.referenceJobId,
  isReferenceBase: options.isReferenceBase,
  genre: options.genre,  // ✅ Passa genre
  mode: options.mode     // ✅ Passa mode
  // ❌ NÃO PASSA genreTargets!
});
```

**Por que é um bug:**

O `core-metrics.js` não recebe `genreTargets` customizados do usuário. Ele sempre carrega do filesystem ou usa hardcoded.

**Impacto:**
- Targets enviados pelo usuário são ignorados
- Análise usa targets errados

---

### 🔴 **BUG #3: PIPELINE LOG MOSTRA "default" EM VEZ DO VALOR REAL**

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linha:** 84

**Problema:**
```javascript
// LINHA 84
console.log('[MODE-FLOW] GENRE DETECTADO:', options.genre || 'default');
```

**Por que é um bug:**

Se `options.genre` for `null`, loga `"default"` mas isso mascara o problema real.

**Impacto:**
- Desenvolvedor vê "default" e pensa que está correto
- Debugging fica impossível

---

### 🔴 **BUG #4: genre-targets-loader REJEITA GÊNERO VÁLIDO**

**Arquivo:** `work/lib/audio/utils/genre-targets-loader.js`  
**Linha:** 50

**Problema:**
```javascript
// LINHA 50
if (!normalizedGenre || normalizedGenre === 'default' || normalizedGenre === 'unknown') {
  console.log(`[TARGETS] Gênero inválido ou default: "${genre}" - usando fallback hardcoded`);
  return null;  // ❌ RETORNA NULL = USA HARDCODED
}
```

**Por que é um bug:**

Se o pipeline passar `"default"` (por causa dos bugs anteriores), o loader retorna `null` e usa targets hardcoded genéricos.

**Impacto:**
- Análise usa targets errados
- Sugestões ficam genéricas

---

### 🔴 **BUG #5: SUGGESTIONS NÃO RECEBEM genreTargets CUSTOMIZADOS**

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linhas:** 289, 411

**Problema:**
```javascript
// LINHA 289 (Suggestions V1)
if (mode !== 'reference' && detectedGenre && detectedGenre !== 'default') {
  customTargets = loadGenreTargets(detectedGenre);  // ❌ Carrega do filesystem
  // ❌ NÃO USA options.genreTargets!
}

// LINHA 411 (Suggestions V2)
if (mode !== 'reference' && detectedGenreV2 && detectedGenreV2 !== 'default') {
  customTargetsV2 = loadGenreTargets(detectedGenreV2);  // ❌ Carrega do filesystem
  // ❌ NÃO USA options.genreTargets!
}
```

**Por que é um bug:**

O pipeline SEMPRE carrega targets do filesystem, ignorando os `genreTargets` enviados pelo usuário em `job.data`.

**Impacto:**
- Targets customizados do usuário são completamente ignorados
- Análise usa targets desatualizados do filesystem

---

## 📊 FLUXO ATUAL (COM BUGS)

```
Frontend envia: genre="trance", genreTargets={...} ✅
   ↓
job.data salvo no Postgres: { genre: "trance", genreTargets: {...} } ✅
   ↓
worker.js extrai: options.genre = "trance", options.genreTargets = {...} ✅
   ↓
analyzeAudioWithPipeline() passa: pipelineOptions.genre = "trance" ✅
   ↓
processAudioComplete() recebe: options.genre = "trance" ✅
   ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 AQUI COMEÇA O PROBLEMA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ↓
LINHA 155: computeCoreMetrics() recebe:
  options.genre = "trance" ✅
  options.genreTargets = undefined ❌ (NÃO PASSADO)
   ↓
LINHA 340 (core-metrics.js): 
  detectedGenre = options.genre || 'default'  // Se genre=null → 'default' ❌
   ↓
LINHA 200 (pipeline-complete.js):
  detectedGenre = (resolvedGenre && trim()) || 'default'  // Se null → 'default' ❌
   ↓
LINHA 289: customTargets = loadGenreTargets('default')  // ❌ CARREGA ERRADO
   ↓
LINHA 340: problemsAnalysis = analyzeProblemsV2(metrics, 'default', null)  // ❌
   ↓
generateJSONOutput() recebe: genre = 'default' ❌
   ↓
buildFinalJSON() retorna: { genre: 'default', summary: {genre: null} } ❌
   ↓
worker.js tenta sobrescrever, MAS summary/metadata já têm 'default' ❌
   ↓
Salvo no Postgres: result.genre = 'trance', summary.genre = 'default' ❌
```

---

## 🎯 CORREÇÕES OBRIGATÓRIAS

### **Correção #1: REMOVER FALLBACK "default" NO MODO GENRE**

**Arquivos:** `pipeline-complete.js` linhas 200, 262, 399

**ANTES:**
```javascript
const detectedGenre = isGenreMode
  ? ((resolvedGenre && String(resolvedGenre).trim()) || 'default')  // ❌
  : (options.genre || 'default');
```

**DEPOIS:**
```javascript
const detectedGenre = isGenreMode
  ? (resolvedGenre && String(resolvedGenre).trim())  // ✅ SEM fallback
  : (options.genre || 'default');  // Modo reference pode ter fallback
```

---

### **Correção #2: PASSAR genreTargets PARA computeCoreMetrics**

**Arquivo:** `pipeline-complete.js` linha 155

**ANTES:**
```javascript
coreMetrics = await computeCoreMetrics(audioData, segmentedData, tempFilePath, {
  jobId,
  fileName,
  referenceJobId: options.referenceJobId,
  isReferenceBase: options.isReferenceBase,
  genre: options.genre,
  mode: options.mode
  // ❌ FALTA genreTargets
});
```

**DEPOIS:**
```javascript
coreMetrics = await computeCoreMetrics(audioData, segmentedData, tempFilePath, {
  jobId,
  fileName,
  referenceJobId: options.referenceJobId,
  isReferenceBase: options.isReferenceBase,
  genre: options.genre,
  genreTargets: options.genreTargets,  // 🔥 ADICIONAR
  mode: options.mode
});
```

---

### **Correção #3: USAR genreTargets DO USUÁRIO EM VEZ DO FILESYSTEM**

**Arquivo:** `pipeline-complete.js` linhas 289, 411

**ANTES:**
```javascript
// LINHA 289
if (mode !== 'reference' && detectedGenre && detectedGenre !== 'default') {
  customTargets = loadGenreTargets(detectedGenre);  // ❌ FILESYSTEM
}
```

**DEPOIS:**
```javascript
// LINHA 289
if (mode !== 'reference' && detectedGenre && detectedGenre !== 'default') {
  // 🔥 PRIORIZAR genreTargets do usuário
  customTargets = options.genreTargets || loadGenreTargets(detectedGenre);
  
  if (options.genreTargets) {
    console.log(`[V1-SYSTEM] 🎯 Usando targets CUSTOMIZADOS do usuário`);
  } else if (customTargets) {
    console.log(`[V1-SYSTEM] 📂 Usando targets de ${detectedGenre} do filesystem`);
  } else {
    console.log(`[V1-SYSTEM] 📋 Usando targets hardcoded para ${detectedGenre}`);
  }
}
```

**Aplicar mesma lógica na linha 411 para V2.**

---

### **Correção #4: USAR genreTargets NO CORE-METRICS**

**Arquivo:** `core-metrics.js` linha 347

**ANTES:**
```javascript
// LINHA 347
if (mode !== 'reference' && detectedGenre && detectedGenre !== 'default') {
  customTargets = loadGenreTargets(detectedGenre);  // ❌ FILESYSTEM
}
```

**DEPOIS:**
```javascript
// LINHA 347
if (mode !== 'reference' && detectedGenre && detectedGenre !== 'default') {
  // 🔥 PRIORIZAR genreTargets do usuário
  customTargets = options.genreTargets || loadGenreTargets(detectedGenre);
  
  if (options.genreTargets) {
    console.log(`[CORE_METRICS] 🎯 Usando targets CUSTOMIZADOS do usuário`);
  } else if (customTargets) {
    console.log(`[CORE_METRICS] 📂 Usando targets de ${detectedGenre} do filesystem`);
  } else {
    console.log(`[CORE_METRICS] 📋 Usando targets hardcoded para ${detectedGenre}`);
  }
}
```

---

### **Correção #5: ADICIONAR LOGS DE RASTREAMENTO**

**Arquivo:** `pipeline-complete.js` linhas 75-85

**ADICIONAR:**
```javascript
// 🔥 LOG OBRIGATÓRIO: ENTRADA DO PIPELINE
console.log('[GENRE-TRACE][PIPELINE-INPUT]', {
  jobId: jobId.substring(0, 8),
  incomingGenre: options.genre,
  incomingTargets: options.genreTargets ? Object.keys(options.genreTargets) : null,
  mode: options.mode
});
```

**Arquivo:** `pipeline-complete.js` linha ~820 (após finalJSON ser montado)

**ADICIONAR:**
```javascript
// 🔥 LOG OBRIGATÓRIO: SAÍDA DO PIPELINE
console.log('[GENRE-TRACE][PIPELINE-OUTPUT]', {
  jobId: jobId.substring(0, 8),
  resultGenre: finalJSON.genre,
  summaryGenre: finalJSON.summary?.genre,
  metadataGenre: finalJSON.metadata?.genre,
  suggestionMetadataGenre: finalJSON.suggestionMetadata?.genre
});
```

---

## 📋 CHECKLIST DE CORREÇÕES

- [ ] Remover fallback "default" na linha 200 (pipeline-complete.js)
- [ ] Remover fallback "default" na linha 262 (pipeline-complete.js)  
- [ ] Remover fallback "default" na linha 399 (pipeline-complete.js)
- [ ] Passar genreTargets para computeCoreMetrics (linha 155)
- [ ] Usar genreTargets do usuário na linha 289 (Suggestions V1)
- [ ] Usar genreTargets do usuário na linha 411 (Suggestions V2)
- [ ] Usar genreTargets do usuário no core-metrics.js (linha 347)
- [ ] Adicionar log [GENRE-TRACE][PIPELINE-INPUT] no início
- [ ] Adicionar log [GENRE-TRACE][PIPELINE-OUTPUT] no final
- [ ] Corrigir log da linha 84 para não mascarar null

---

## 🎯 RESULTADO ESPERADO APÓS CORREÇÕES

```
Frontend envia: genre="trance", genreTargets={...} ✅
   ↓
processAudioComplete() recebe: options.genre="trance", options.genreTargets={...} ✅
   ↓
computeCoreMetrics() recebe: options.genre="trance", options.genreTargets={...} ✅
   ↓
analyzeProblemsV2() usa: genre="trance", customTargets={...do usuário} ✅
   ↓
generateJSONOutput() recebe: genre="trance" ✅
   ↓
buildFinalJSON() retorna: { genre: "trance", summary: {genre: "trance"} } ✅
   ↓
worker.js sobrescreve TODOS os nested: genre="trance" em tudo ✅
   ↓
Salvo no Postgres: TUDO com genre="trance", ZERO "default" ✅
```

---

**Status:** 🔴 **5 BUGS CRÍTICOS IDENTIFICADOS - CORREÇÕES PRONTAS PARA APLICAR**
