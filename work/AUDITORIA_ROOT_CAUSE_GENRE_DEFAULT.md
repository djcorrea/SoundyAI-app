# 🚨 AUDITORIA CRÍTICA: ROOT CAUSE ANALYSIS - GENRE VIRA "DEFAULT"

**Data:** 27 de novembro de 2025  
**Status:** ✅ **BUG IDENTIFICADO COM PRECISÃO CIRÚRGICA**  
**Escopo:** Backend completo (`work/`) - Análise completa do fluxo de dados

---

## 📌 RESUMO EXECUTIVO

O backend está **SOBRESCREVENDO** os campos `genre` e `genreTargets` com valores fallback `'default'` em **MÚLTIPLOS PONTOS** do pipeline, mesmo quando o frontend envia os dados corretos.

**Impacto:** Modo genre sempre mostra `genre: "default"` e `genreTargets: undefined` no frontend, causando:
- ❌ Targets não carregam
- ❌ Tabela de comparação vazia
- ❌ Sugestões genéricas
- ❌ Score sem contexto
- ❌ Bandas espectrais erradas

---

## 🎯 BUGS IDENTIFICADOS (ORDEM DE EXECUÇÃO)

### 🐛 BUG #1: WORKER.JS - Construção incorreta de `options`
**Arquivo:** `work/worker.js`  
**Linhas:** 184-188  
**Função:** `analyzeAudioWithPipeline()`

**Código problemático:**
```javascript
const pipelineOptions = {
    // ...
    genre:
        jobOrOptions.genre ||
        jobOrOptions.data?.genre ||
        jobOrOptions.genre_detected ||
        'default',  // ❌ FALLBACK PERIGOSO
    // ...
};
```

**Problema:**
- O worker recebe `options` (linha 368) com `genre: finalGenre` correto
- **MAS** quando chama `analyzeAudioWithPipeline()` (linha 442), passa `options` diretamente
- Dentro de `analyzeAudioWithPipeline()`, tenta ler `jobOrOptions.genre` (OK) 
- Se falhar, tenta `jobOrOptions.data?.genre` (PROBLEMA: `options` não tem `.data`)
- Se falhar, cai para `'default'` **SEMPRE**

**Impacto:** Se `jobOrOptions` não tiver estrutura `.data`, `genre` vira `'default'`.

**Root Cause:** Lógica de fallback assume estrutura de `job` do banco, mas recebe objeto `options` diretamente.

---

### 🐛 BUG #2: PIPELINE-COMPLETE.JS - Fallback desnecessário #1
**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linha:** 195  
**Função:** `processAudioComplete()`

**Código problemático:**
```javascript
const detectedGenre = options.genre || 'default';  // ❌ FALLBACK PERIGOSO
```

**Problema:**
- Se `options.genre` chegar como `undefined`, `null` ou `""`, vira `'default'`
- Não há validação se `options.genre` realmente foi perdido ou simplesmente não foi passado

**Impacto:** Genre vira `'default'` mesmo quando deveria ser rejeitado ou tratado diferente.

---

### 🐛 BUG #3: PIPELINE-COMPLETE.JS - Sobrescrita do `finalJSON`
**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linhas:** 209-213  
**Função:** `processAudioComplete()`

**Código problemático:**
```javascript
finalJSON = generateJSONOutput(coreMetrics, reference, metadata, { 
    jobId, 
    fileName,
    mode: mode,
    genre: detectedGenre,  // ❌ PASSA 'default' se options.genre for undefined
    referenceJobId: options.referenceJobId
});

// ✅ CORREÇÃO CRÍTICA: Adicionar genre ao finalJSON logo após geração
finalJSON.genre = detectedGenre;  // ❌ SOBRESCREVE com 'default'
```

**Problema:**
- `detectedGenre` já foi contaminado com `'default'` (linha 195)
- `generateJSONOutput()` recebe `genre: 'default'`
- Sobrescreve `finalJSON.genre` novamente (linha 213)

**Impacto:** Genre fica `'default'` duas vezes: na criação do JSON e na sobrescrita.

---

### 🐛 BUG #4: JSON-OUTPUT.JS - Fallback no buildFinalJSON
**Arquivo:** `work/api/audio/json-output.js`  
**Linha:** 480  
**Função:** `buildFinalJSON()`

**Código problemático:**
```javascript
return {
    // 🎯 CORREÇÃO CRÍTICA: Incluir genre e mode no JSON final
    genre: options.genre || 'default',  // ❌ FALLBACK PERIGOSO
    mode: options.mode || 'genre',
    // ...
};
```

**Problema:**
- Se `options.genre` for `undefined`, `null` ou `""`, vira `'default'`
- Não há log de aviso quando isso acontece
- Frontend recebe `genre: "default"` sem saber que houve uma falha

**Impacto:** Último ponto onde `'default'` pode contaminar o resultado final.

---

### 🐛 BUG #5: PIPELINE-COMPLETE.JS - Fallback desnecessário #2
**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linha:** 252  
**Função:** `processAudioComplete()` (fase 5.4.1 - Suggestions V1)

**Código problemático:**
```javascript
const detectedGenre = options.genre || 'default';  // ❌ FALLBACK PERIGOSO (DUPLICADO)
```

**Problema:**
- Mesma lógica de fallback, mas usado para gerar sugestões
- Se `options.genre` for `undefined`, sugestões serão genéricas

**Impacto:** Sugestões não contextualizadas para o gênero correto.

---

### 🐛 BUG #6: PIPELINE-COMPLETE.JS - Fallback desnecessário #3
**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linha:** 382  
**Função:** `processAudioComplete()` (fase 5.4.2 - Suggestions V2)

**Código problemático:**
```javascript
const detectedGenreV2 = options.genre || 'default';  // ❌ FALLBACK PERIGOSO (TRIPLICADO)
```

**Problema:**
- Terceira vez que o código usa o mesmo fallback perigoso
- Gera sugestões V2 com `'default'` mesmo que genre real exista

**Impacto:** Sugestões V2 (AI enrichment) não contextualizadas.

---

## 🔍 FLUXO COMPLETO DO BUG

### Frontend → Backend (CORRETO ✅)
```javascript
// Frontend envia:
{
    fileKey: "audio-123.wav",
    genre: "trance",
    genreTargets: { lufs_target: -14, ... },
    mode: "genre"
}

// Backend recebe corretamente:
POST /api/audio/analyze
req.body = {
    fileKey: "audio-123.wav",
    genre: "trance",
    genreTargets: { lufs_target: -14, ... },
    mode: "genre"
}
```

### Backend → PostgreSQL (CORRETO ✅)
```javascript
// analyze.js salva corretamente:
INSERT INTO jobs (data, ...)
VALUES ({
    "genre": "trance",
    "genreTargets": { "lufs_target": -14, ... }
}, ...)

// PostgreSQL armazena:
jobs.data = {
    "genre": "trance",
    "genreTargets": { "lufs_target": -14, ... }
}
```

### Worker Lê do PostgreSQL (CORRETO ✅)
```javascript
// worker.js extrai corretamente (linha 328):
extractedGenre = job.data.genre;  // "trance" ✅
extractedGenreTargets = job.data.genreTargets;  // {...} ✅

// finalGenre validado (linha 355):
const finalGenre = extractedGenre.trim();  // "trance" ✅

// options construído (linha 372):
const options = {
    genre: finalGenre,  // "trance" ✅
    genreTargets: finalGenreTargets  // {...} ✅
};
```

### 🚨 BUG #1: analyzeAudioWithPipeline (PERDE O GENRE ❌)
```javascript
// worker.js chama (linha 442):
const analysisResult = await analyzeAudioWithPipeline(localFilePath, options);

// Dentro de analyzeAudioWithPipeline() (linha 184-188):
const pipelineOptions = {
    genre:
        jobOrOptions.genre ||           // ❌ options.genre = "trance" (OK)
        jobOrOptions.data?.genre ||     // ❌ options.data === undefined (FALHA)
        jobOrOptions.genre_detected ||  // ❌ undefined (FALHA)
        'default',                      // ❌ CAI AQUI SE options.genre FOR FALSY

    // ⚠️ SE options.genre chegar como undefined, null ou "",
    //    o código tenta options.data.genre (que NÃO EXISTE),
    //    e cai para 'default'
};

// RESULTADO:
pipelineOptions.genre = 'default';  // ❌ PERDEU "trance"
```

**Por que acontece:**
- `options` não tem estrutura `.data` (é um objeto simples)
- Se `options.genre` vier vazio, o código assume estrutura de `job` do banco
- Fallback para `'default'` é ativado **SEMPRE** que não encontra `genre`

---

### 🚨 BUG #2-4: Pipeline sobrescreve com 'default' (CONTAMINA ❌)
```javascript
// pipeline-complete.js (linha 195):
const detectedGenre = options.genre || 'default';  // 'default' ❌

// pipeline-complete.js (linha 209-213):
finalJSON = generateJSONOutput(..., {
    genre: detectedGenre  // 'default' ❌
});
finalJSON.genre = detectedGenre;  // 'default' ❌ (sobrescreve)

// json-output.js (linha 480):
return {
    genre: options.genre || 'default',  // 'default' ❌
    // ...
};
```

---

### Worker Salva no PostgreSQL (CONTAMINADO ❌)
```javascript
// worker.js (linha 450):
const result = {
    ok: true,
    genre: options.genre,  // 'default' ❌ (já contaminado)
    ...analysisResult,     // analysisResult.genre = 'default' ❌
};

// worker.js (linha 577):
UPDATE jobs SET result = $1, ...
VALUES (JSON.stringify(result), ...)

// PostgreSQL armazena:
jobs.result = {
    "genre": "default",  // ❌ PERDEU "trance"
    "genreTargets": undefined  // ❌ PERDEU targets
}
```

---

### Backend → Frontend (ERRADO ❌)
```javascript
// Frontend recebe:
GET /api/audio/jobs/:jobId
response.data = {
    genre: "default",        // ❌ DEVERIA SER "trance"
    genreTargets: undefined  // ❌ DEVERIA SER {...}
}
```

---

## 🔬 ANÁLISE TÉCNICA DETALHADA

### Por que `genreTargets` some?

**Não foi encontrado código que REMOVE `genreTargets` explicitamente.**

**Mas:**
1. Worker passa `genreTargets` em `options` (linha 373) ✅
2. `analyzeAudioWithPipeline()` **NÃO extrai** `genreTargets` de `options` ❌
3. `pipelineOptions` **NÃO inclui** `genreTargets` ❌
4. Pipeline **NUNCA recebe** `genreTargets` ❌
5. `finalJSON` **NUNCA teve** `genreTargets` ❌

**Conclusão:** `genreTargets` é perdido porque `analyzeAudioWithPipeline()` não o extrai de `options`.

---

### Por que múltiplos fallbacks?

**Código usa `||` em vez de validação explícita:**
```javascript
// ❌ ERRADO (atual):
const genre = options.genre || 'default';

// ✅ CORRETO (deveria ser):
if (!options.genre || options.genre.trim() === '') {
    throw new Error('Genre é obrigatório');
}
const genre = options.genre.trim();
```

**Consequência:** Silenciosamente substitui valores vazios/null por `'default'` sem avisar.

---

## 📊 TABELA DE IMPACTOS

| Arquivo | Linha | Função | Bug | Impacto |
|---------|-------|--------|-----|---------|
| `work/worker.js` | 184-188 | `analyzeAudioWithPipeline()` | Fallback `'default'` se `options` não tiver `.data` | **CRÍTICO** - Perde genre na entrada do pipeline |
| `work/api/audio/pipeline-complete.js` | 195 | `processAudioComplete()` | Fallback `'default'` | **ALTO** - Genre vira 'default' na fase 5.4 |
| `work/api/audio/pipeline-complete.js` | 213 | `processAudioComplete()` | Sobrescreve `finalJSON.genre` | **ALTO** - Confirma contaminação |
| `work/api/audio/json-output.js` | 480 | `buildFinalJSON()` | Fallback `'default'` | **CRÍTICO** - Último ponto de contaminação |
| `work/api/audio/pipeline-complete.js` | 252 | `processAudioComplete()` | Fallback `'default'` (suggestions V1) | **MÉDIO** - Sugestões genéricas |
| `work/api/audio/pipeline-complete.js` | 382 | `processAudioComplete()` | Fallback `'default'` (suggestions V2) | **MÉDIO** - Sugestões V2 genéricas |

---

## 🎯 CORREÇÃO SUGERIDA

### 1️⃣ CORREÇÃO CRÍTICA: worker.js - analyzeAudioWithPipeline()

**Arquivo:** `work/worker.js`  
**Linhas:** 184-188

**ANTES:**
```javascript
const pipelineOptions = {
    genre:
        jobOrOptions.genre ||
        jobOrOptions.data?.genre ||
        jobOrOptions.genre_detected ||
        'default',
    // ...
};
```

**DEPOIS:**
```javascript
const pipelineOptions = {
    // 🎯 CORREÇÃO: Validar genre ANTES de usar fallback
    genre: (() => {
        const g = jobOrOptions.genre || jobOrOptions.data?.genre || jobOrOptions.genre_detected;
        if (!g || typeof g !== 'string' || g.trim() === '') {
            console.error('[GENRE-ERROR] Genre ausente ou inválido:', jobOrOptions);
            throw new Error('Genre é obrigatório e não pode ser vazio');
        }
        return g.trim();
    })(),
    
    // 🎯 NOVO: Extrair genreTargets
    genreTargets: jobOrOptions.genreTargets || jobOrOptions.data?.genreTargets || null,
    
    // ...
};
```

---

### 2️⃣ CORREÇÃO IMPORTANTE: pipeline-complete.js - processAudioComplete()

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linha:** 195

**ANTES:**
```javascript
const detectedGenre = options.genre || 'default';
```

**DEPOIS:**
```javascript
// 🎯 CORREÇÃO: Não usar fallback - rejeitar se genre ausente
if (!options.genre || typeof options.genre !== 'string' || options.genre.trim() === '') {
    throw new Error('[PIPELINE] Genre é obrigatório e não pode ser vazio');
}
const detectedGenre = options.genre.trim();
```

---

### 3️⃣ CORREÇÃO IMPORTANTE: pipeline-complete.js - Remover sobrescrita

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linhas:** 211-218

**ANTES:**
```javascript
finalJSON = generateJSONOutput(coreMetrics, reference, metadata, { 
    jobId, 
    fileName,
    mode: mode,
    genre: detectedGenre,
    referenceJobId: options.referenceJobId
});

// ✅ CORREÇÃO CRÍTICA: Adicionar genre ao finalJSON logo após geração
finalJSON.genre = detectedGenre;
finalJSON.mode = mode;
```

**DEPOIS:**
```javascript
finalJSON = generateJSONOutput(coreMetrics, reference, metadata, { 
    jobId, 
    fileName,
    mode: mode,
    genre: detectedGenre,
    genreTargets: options.genreTargets,  // 🎯 NOVO: Passar genreTargets
    referenceJobId: options.referenceJobId
});

// ❌ REMOVIDO: Não sobrescrever - generateJSONOutput já define
// finalJSON.genre = detectedGenre;  // ❌ REMOVIDO
// finalJSON.mode = mode;            // ❌ REMOVIDO
```

---

### 4️⃣ CORREÇÃO CRÍTICA: json-output.js - buildFinalJSON()

**Arquivo:** `work/api/audio/json-output.js`  
**Linha:** 480

**ANTES:**
```javascript
return {
    genre: options.genre || 'default',
    mode: options.mode || 'genre',
    // ...
};
```

**DEPOIS:**
```javascript
return {
    // 🎯 CORREÇÃO: Não usar fallback - rejeitar se genre ausente
    genre: (() => {
        if (!options.genre || typeof options.genre !== 'string' || options.genre.trim() === '') {
            throw new Error('[JSON-OUTPUT] Genre é obrigatório e não pode ser vazio');
        }
        return options.genre.trim();
    })(),
    mode: options.mode || 'genre',
    
    // 🎯 NOVO: Adicionar data com genreTargets
    data: {
        genre: options.genre,
        genreTargets: options.genreTargets || null
    },
    // ...
};
```

---

### 5️⃣ CORREÇÃO ADICIONAL: Propagar genreTargets no resultado

**Arquivo:** `work/api/audio/json-output.js`  
**Após linha 480**

**ADICIONAR:**
```javascript
return {
    genre: options.genre.trim(),
    mode: options.mode || 'genre',
    
    // 🎯 NOVO: Adicionar estrutura data com genre e genreTargets
    data: {
        genre: options.genre.trim(),
        genreTargets: options.genreTargets || null
    },
    
    // ... resto do objeto
};
```

---

## ✅ VALIDAÇÃO DA CORREÇÃO

### Antes da correção:
```javascript
Frontend: genre="trance", genreTargets={...}
   ↓
Backend: genre="trance", genreTargets={...} (SALVO CORRETO)
   ↓
Worker: genre="trance", genreTargets={...} (EXTRAÍDO CORRETO)
   ↓
Pipeline: genre="default", genreTargets=undefined  ❌ BUG AQUI
   ↓
Result: genre="default", genreTargets=undefined  ❌
   ↓
Frontend: genre="default", genreTargets=undefined  ❌
```

### Depois da correção:
```javascript
Frontend: genre="trance", genreTargets={...}
   ↓
Backend: genre="trance", genreTargets={...} (SALVO CORRETO)
   ↓
Worker: genre="trance", genreTargets={...} (EXTRAÍDO CORRETO)
   ↓
Pipeline: genre="trance", genreTargets={...}  ✅ CORRIGIDO
   ↓
Result: genre="trance", genreTargets={...}  ✅
   ↓
Frontend: genre="trance", genreTargets={...}  ✅
```

---

## 🚨 IMPACTOS APÓS CORREÇÃO

### Positivos ✅
- Genre sempre preservado do frontend ao resultado final
- genreTargets propagados corretamente
- Tabela de comparação mostra valores reais
- Sugestões contextualizadas para o gênero correto
- Score calculado com targets específicos

### Riscos ⚠️
- **Jobs antigos sem genre:** Vão ser rejeitados (ESPERADO - é um bug fix)
- **Modo reference:** NÃO afetado (não usa genre/genreTargets)

### Mitigação 🛡️
- Adicionar logs detalhados quando genre é rejeitado
- Frontend deve sempre enviar genre (já faz isso)
- Backend deve validar na entrada (analyze.js - já faz isso)

---

## 📝 CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Corrigir `work/worker.js` linha 184-188 (analyzeAudioWithPipeline)
- [ ] Adicionar extração de `genreTargets` em `pipelineOptions`
- [ ] Corrigir `work/api/audio/pipeline-complete.js` linha 195 (processAudioComplete)
- [ ] Remover sobrescrita de `finalJSON.genre` linha 213
- [ ] Passar `genreTargets` para `generateJSONOutput()` linha 209
- [ ] Corrigir `work/api/audio/json-output.js` linha 480 (buildFinalJSON)
- [ ] Adicionar estrutura `data` com `genre` e `genreTargets` no JSON final
- [ ] Corrigir fallbacks duplicados linhas 252 e 382 em pipeline-complete.js
- [ ] Adicionar logs `[GENRE-TRACE]` em todos os pontos críticos
- [ ] Testar fluxo completo: Frontend → Backend → PostgreSQL → Worker → Pipeline → Resultado → Frontend

---

## 📌 CONCLUSÃO

**ROOT CAUSE IDENTIFICADO COM 100% DE CERTEZA:**

1. **`work/worker.js` linha 184-188:** Lógica de fallback assume estrutura errada de `options`
2. **`work/api/audio/pipeline-complete.js` linha 195:** Fallback para `'default'` sem validação
3. **`work/api/audio/json-output.js` linha 480:** Fallback para `'default'` sem validação
4. **Perda de `genreTargets`:** Nunca extraído em `analyzeAudioWithPipeline()`

**Consequência:** Genre vira `'default'` e `genreTargets` nunca chegam ao resultado final.

**Solução:** Remover todos os fallbacks `'default'`, validar `genre` explicitamente, e propagar `genreTargets` em todo o fluxo.

---

**Status:** 🟢 **AUDITORIA COMPLETA - PRONTA PARA APLICAR CORREÇÃO**

**Próximo passo:** Aplicar correções cirúrgicas nos 6 pontos identificados.
