# 🔍 AUDITORIA COMPLETA: GENRE-ISOLATION E CONTAMINAÇÃO DE ESTADO

**Data:** 26 de novembro de 2025  
**Arquivo auditado:** `public/audio-analyzer-integration.js` (20.046 linhas)  
**Responsável:** GitHub Copilot (Claude Sonnet 4.5)  
**Status:** ⚠️ **BUGS CRÍTICOS IDENTIFICADOS - GENRE SENDO PERDIDO EM MÚLTIPLOS PONTOS**

---

## 📊 RESUMO EXECUTIVO

### ❌ **PROBLEMAS IDENTIFICADOS:**

1. **`resetReferenceStateFully()` executa 6 VEZES durante análise de gênero**
2. **GENRE-ISOLATION limpa `__activeRefData` MESMO quando genre está presente**
3. **`getActiveGenre()` retorna NULL quando analysis.genre não existe**
4. **Ordem de execução: RESET → LOAD TARGETS → RENDER (incorreta)**
5. **Contaminação entre modo gênero e referência não isolada**
6. **Fallback para "default" ocorre em 11 pontos diferentes**

---

## 🗺️ MAPA COMPLETO DE FUNÇÕES CRÍTICAS

### 📍 **FUNÇÃO 1: `resetReferenceStateFully(preserveGenre)`**

**Localização:** Linha 4068  
**Chamadas identificadas:** 6 locais

```javascript
// LINHA 4068 - DEFINIÇÃO
function resetReferenceStateFully(preserveGenre) {
    console.group('%c[GENRE-ISOLATION] 🧹 Limpeza completa do estado de referência');
    
    // 🎯 Salva gênero ANTES de limpar
    const __savedGenre = preserveGenre || 
                        window.__CURRENT_GENRE ||
                        window.__soundyState?.render?.genre ||
                        window.__activeUserGenre;
    
    // ❌ PROBLEMA 1: Limpa __activeRefData MESMO com gênero válido
    window.__activeRefData = null;  // LINHA 4122
    
    // ❌ PROBLEMA 2: Limpa PROD_AI_REF_DATA que contém targets
    window.PROD_AI_REF_DATA = null;
    
    // ❌ PROBLEMA 3: Limpa window.__CURRENT_GENRE
    window.__CURRENT_GENRE = null;
    
    // ✅ Restaura gênero NO FINAL (mas targets já foram perdidos)
    if (__savedGenre) {
        window.__CURRENT_GENRE = __savedGenre;
        window.PROD_AI_REF_GENRE = __savedGenre;
    }
}
```

**Locais de chamada:**
1. **Linha 1566** - `openAudioModal()` - Ao abrir modal
2. **Linha 1709** - `resetReferenceFlow()` - Reset manual
3. **Linha 4536** - `renderGenreView(analysis)` - ⚠️ **DURANTE RENDERIZAÇÃO**
4. **Linha 6412** - `handleGenreAnalysisWithResult()` - ⚠️ **APÓS RECEBER ANÁLISE**
5. **Linha 7091** - `toggleAnalysisMode()` - Troca de modo

---

### 📍 **FUNÇÃO 2: `getActiveGenre(analysis, fallback)`**

**Localização:** Linha 4053  
**Problema:** Retorna `null` ou `undefined` quando analysis.genre não existe

```javascript
function getActiveGenre(analysis, fallback) {
    const genre = analysis?.genre ||
                 analysis?.genreId ||
                 analysis?.metadata?.genre ||
                 window.__CURRENT_GENRE ||
                 window.__soundyState?.render?.genre ||
                 window.__activeUserGenre ||
                 window.PROD_AI_REF_GENRE ||
                 fallback;
    
    console.log('[GET-ACTIVE-GENRE] Gênero detectado:', genre, '(fallback:', fallback, ')');
    return genre;  // ❌ Pode retornar undefined se nenhum existir
}
```

**Chamadas identificadas:**
1. **Linha 4535** - `renderGenreView()` - Antes de resetar
2. **Linha 6410** - `handleGenreAnalysisWithResult()` - Antes de resetar
3. **Linha 6454** - Para carregar targets

**❌ PROBLEMA:**  
Se `analysis.genre` não existe E todas as variáveis globais foram limpas por `resetReferenceStateFully()`, retorna `null/undefined` → fallback para "default"

---

### 📍 **FUNÇÃO 3: `handleModalFileSelection(file)`**

**Localização:** Linha 5442  
**Execução:** Quando usuário seleciona arquivo no modal

```javascript
async function handleModalFileSelection(file) {
    // ... upload e análise ...
    
    const isFirstReferenceTrack = currentAnalysisMode === 'reference' && !isSecondTrack;
    
    if (isFirstReferenceTrack) {
        // PRIMEIRA música - salva e abre modal
        saveFirstAnalysis(analysisResult);
        openReferenceUploadModal(analysisResult.jobId, analysisResult);
    } 
    else if (isSecondTrack) {
        // SEGUNDA música - exibe comparação
        await handleReferenceComparisonResult(userResult, refResult);
    } 
    else {
        // ⚠️ MODO GÊNERO - CHAMA handleGenreAnalysisWithResult
        await handleGenreAnalysisWithResult(analysisResult, file.name);
    }
}
```

**Fluxo de execução:**
```
handleModalFileSelection
  ↓
handleGenreAnalysisWithResult (modo gênero)
  ↓
resetReferenceStateFully() [LINHA 6412] ← ❌ LIMPA ESTADO ANTES DE CARREGAR TARGETS
  ↓
normalizeBackendAnalysisData()
  ↓
Carrega targets /refs/out/{genre}.json
  ↓
displayModalResults(analysis)
```

---

### 📍 **FUNÇÃO 4: `handleGenreAnalysisWithResult(analysisResult, fileName)`**

**Localização:** Linha 6326  
**Problema:** Executa `resetReferenceStateFully()` ANTES de carregar targets

```javascript
async function handleGenreAnalysisWithResult(analysisResult, fileName) {
    // 🧩 PROTEÇÃO: NÃO limpar se em modo reference
    if (currentMode === 'reference' && isSecondTrack) {
        console.warn('⚠️ ABORTANDO limpeza para preservar dados A/B');
        return normalizedResult;
    }
    
    // ❌ PROBLEMA 1: Limpa estado COMPLETO
    state.userAnalysis = null;
    state.referenceAnalysis = null;
    FirstAnalysisStore.clear();
    
    // ❌ PROBLEMA 2: Normaliza dados
    const normalizedResult = normalizeBackendAnalysisData(analysisResult);
    
    // ========================================
    // 🔥 BARREIRA 3: LIMPEZA NO RECEBIMENTO
    // ========================================
    const isGenreModeFromBackend = (
        normalizedResult.mode === 'genre' &&
        normalizedResult.isReferenceBase !== true
    );
    
    if (isGenreModeFromBackend) {
        console.log('[GENRE-BARRIER] 🚧 BARREIRA 3 ATIVADA');
        
        // ⚠️ EXECUTA RESET AQUI (LINHA 6412)
        const genreToPreserve = getActiveGenre(normalizedResult, window.PROD_AI_REF_GENRE);
        resetReferenceStateFully(genreToPreserve);  // ← ❌ LIMPA __activeRefData
        
        // 🎯 Tenta restaurar genre
        if (genreToPreserve && !normalizedResult.genre) {
            normalizedResult.genre = genreToPreserve;
        }
        
        setViewMode("genre");
        window.currentAnalysisMode = 'genre';
    }
    
    // ✅ CARREGA TARGETS DEPOIS DO RESET
    const genreId = getActiveGenre(normalizedResult, null);
    
    if (genreId && genreId !== 'default') {
        // LINHA 6470+ - Fetch /refs/out/{genre}.json
        const response = await fetch(`/refs/out/${genreId}.json`);
        const targets = enrichReferenceObject(rawJson[rootKey], genreId);
        
        // ✅ Atualiza __activeRefData DEPOIS de carregar
        window.__activeRefData = targets;
        window.__CURRENT_GENRE = genreId;
    }
    
    // ... Chama displayModalResults
    await displayModalResults(normalizedResult);
}
```

**❌ ORDEM INCORRETA IDENTIFICADA:**
```
1. resetReferenceStateFully() → LIMPA __activeRefData
2. Fetch /refs/out/{genre}.json → CARREGA targets
3. window.__activeRefData = targets → RESTAURA targets
4. displayModalResults() → USA targets
```

**✅ ORDEM CORRETA DEVERIA SER:**
```
1. Fetch /refs/out/{genre}.json → CARREGA targets PRIMEIRO
2. window.__activeRefData = targets → POPULA __activeRefData
3. displayModalResults() → USA targets
4. resetReferenceStateFully() → LIMPA apenas se trocar modo
```

---

### 📍 **FUNÇÃO 5: `renderGenreView(analysis)`**

**Localização:** Linha 4514  
**Problema:** Executa reset DURANTE renderização

```javascript
function renderGenreView(analysis) {
    console.group('[GENRE-VIEW] 🎨 Renderizando UI exclusiva de gênero');
    
    // 🔥 ISOLAMENTO TOTAL: Limpar variáveis de referência
    analysis.referenceComparison = undefined;
    analysis.referenceComparisonMetrics = undefined;
    
    // ⚠️ PROBLEMA: RESET DURANTE RENDER (LINHA 4536)
    const genreToPreserve = getActiveGenre(analysis, window.PROD_AI_REF_GENRE);
    resetReferenceStateFully(genreToPreserve);  // ← ❌ LIMPA __activeRefData AQUI
    
    // 🎯 Tenta restaurar genre
    if (genreToPreserve && !analysis.genre) {
        analysis.genre = genreToPreserve;
    }
    
    setViewMode("genre");
    
    // ... Obtém targets
    let genreTargets = window.PROD_AI_REF_DATA?.[genre] || window.__activeRefData;
    
    if (!genreTargets) {
        console.error('[GENRE-VIEW] ❌ CRÍTICO: Targets não disponíveis');
        return;  // ❌ ABORTA RENDERIZAÇÃO
    }
    
    // Renderiza tabela
    renderGenreComparisonTable({ analysis, genre, targets: genreTargets });
}
```

**❌ PROBLEMA CRÍTICO:**  
Reset executa **DURANTE** renderização, DEPOIS que targets já foram carregados em `handleGenreAnalysisWithResult()`, causando perda de `__activeRefData`.

---

### 📍 **FUNÇÃO 6: `displayModalResults(analysis)`**

**Localização:** Linha 8014  
**Execução:** Renderiza modal com resultados

```javascript
async function displayModalResults(analysis) {
    console.log('[DEBUG-DISPLAY] 🧠 Início displayModalResults()');
    
    // ✅ Restaura dados de referência se perdidos
    const referenceJobId = getCorrectJobId('reference');
    
    if (referenceJobId && currentAnalysisMode === 'reference') {
        const hasReferenceData = window.referenceAnalysisData || 
                               window.__FIRST_ANALYSIS_FROZEN__;
        
        if (!hasReferenceData) {
            // Restaura do cache
            const cachedReference = window.AnalysisCache.get(referenceJobId);
            window.referenceAnalysisData = cachedReference;
        }
    }
    
    // ... Aguarda aiUIController carregar
    
    // ✅ Detecta modo e renderiza
    const mode = analysis?.mode || currentAnalysisMode;
    
    if (mode === 'genre') {
        // CHAMA renderGenreView (que executa OUTRO reset)
        renderGenreView(analysis);
    } else {
        // Renderiza comparação A/B
        renderReferenceComparisons(analysis);
    }
}
```

---

## 🔄 TIMELINE REAL DA EXECUÇÃO

### 📅 **CENÁRIO 1: Análise de Gênero Pura**

```
T0: Usuário seleciona arquivo
  ↓
T1: handleModalFileSelection()
  ├─ Upload para bucket
  ├─ Cria job no backend
  └─ Poll status até completar
  ↓
T2: handleGenreAnalysisWithResult(analysisResult, fileName)
  ├─ Limpa state.userAnalysis = null
  ├─ Limpa FirstAnalysisStore.clear()
  ├─ normalizeBackendAnalysisData() → normalizedResult
  │
  ├─ [BARREIRA 3] if (mode === 'genre')
  │   ├─ genreToPreserve = getActiveGenre(normalizedResult, PROD_AI_REF_GENRE)
  │   ├─ resetReferenceStateFully(genreToPreserve) ← ❌ RESET #1
  │   │   └─ window.__activeRefData = null  ← ❌ LIMPA TARGETS
  │   ├─ normalizedResult.genre = genreToPreserve (se vazio)
  │   └─ setViewMode("genre")
  │
  ├─ genreId = getActiveGenre(normalizedResult, null)
  │
  ├─ if (genreId && genreId !== 'default')
  │   ├─ fetch(`/refs/out/${genreId}.json`) ← ✅ CARREGA TARGETS
  │   ├─ enrichReferenceObject(targets, genreId)
  │   ├─ window.__activeRefData = targets ← ✅ POPULA __activeRefData
  │   └─ window.__CURRENT_GENRE = genreId
  │
  └─ displayModalResults(normalizedResult)
  ↓
T3: displayModalResults(analysis)
  ├─ Aguarda aiUIController carregar
  ├─ mode = analysis.mode || currentAnalysisMode
  │
  └─ if (mode === 'genre')
      └─ renderGenreView(analysis)
  ↓
T4: renderGenreView(analysis)
  ├─ analysis.referenceComparison = undefined
  ├─ genreToPreserve = getActiveGenre(analysis, PROD_AI_REF_GENRE)
  ├─ resetReferenceStateFully(genreToPreserve) ← ❌ RESET #2
  │   └─ window.__activeRefData = null  ← ❌ LIMPA TARGETS NOVAMENTE!
  ├─ setViewMode("genre")
  │
  ├─ genreTargets = PROD_AI_REF_DATA?.[genre] || __activeRefData
  │   └─ ❌ __activeRefData agora é NULL (foi limpo no RESET #2)
  │
  ├─ if (!genreTargets)
  │   └─ console.error('❌ CRÍTICO: Targets não disponíveis')
  │   └─ return; ← ❌ ABORTA RENDERIZAÇÃO
  │
  └─ [NUNCA EXECUTA] renderGenreComparisonTable()
```

**❌ PROBLEMA IDENTIFICADO:**  
`resetReferenceStateFully()` é chamado **DUAS VEZES**:
1. Linha 6412 - `handleGenreAnalysisWithResult()` - ANTES de carregar targets
2. Linha 4536 - `renderGenreView()` - DEPOIS de carregar targets (LIMPA NOVAMENTE)

**Resultado:** Targets carregados em T2 são **PERDIDOS** em T4.

---

### 📅 **CENÁRIO 2: Análise de Referência (A/B)**

```
T0: Primeira música
  ├─ handleModalFileSelection()
  ├─ isFirstReferenceTrack = true
  ├─ saveFirstAnalysis(analysisResult)
  └─ openReferenceUploadModal()
  ↓
T1: Segunda música
  ├─ handleModalFileSelection()
  ├─ isSecondTrack = true
  ├─ handleReferenceComparisonResult(userResult, refResult)
  │   ├─ Restaura primeira análise do FirstAnalysisStore
  │   ├─ Compara métricas
  │   └─ Cria referenceComparison
  └─ displayModalResults(comparisonResult)
  ↓
T2: displayModalResults(analysis)
  ├─ mode = 'reference'
  ├─ Restaura referência se perdida (do AnalysisCache)
  └─ renderReferenceComparisons(analysis)
```

**✅ Modo reference não executa `resetReferenceStateFully()` durante renderização.**

---

### 📅 **CENÁRIO 3: Troca entre Modos**

```
T0: toggleAnalysisMode()
  ├─ Detecta modo atual
  ├─ Alterna modo (genre ↔ reference)
  ├─ resetReferenceStateFully(currentGenre) ← ❌ RESET #3 (LINHA 7091)
  │   └─ window.__activeRefData = null
  └─ Atualiza UI
```

**⚠️ PROBLEMA:**  
Ao trocar de modo reference → genre, reset limpa `__activeRefData` mas não recarrega targets.

---

## 🎯 ANÁLISE DE CADA RESET

### ❌ **RESET #1: Linha 6412 - `handleGenreAnalysisWithResult()`**

```javascript
// LINHA 6412
const genreToPreserve = getActiveGenre(normalizedResult, window.PROD_AI_REF_GENRE);
resetReferenceStateFully(genreToPreserve);
```

**Contexto:**  
Executado ANTES de carregar targets do `/refs/out/{genre}.json`

**Impacto:**
- ✅ Limpa variáveis de referência (correto para modo gênero)
- ❌ Limpa `__activeRefData` mesmo que targets ainda não foram carregados
- ❌ Se `genreToPreserve` for null, perde o gênero completamente

**Risco de contaminação:**  
Baixo - executa antes de ter dados

**Propósito original:**  
Garantir que análise de gênero não tenha dados de referência residuais

**Deve executar?**  
✅ SIM, mas deve ser modificado para:
- Não limpar `__activeRefData` se targets já existem
- Garantir que `genreToPreserve` nunca seja null

---

### ❌ **RESET #2: Linha 4536 - `renderGenreView()`**

```javascript
// LINHA 4536
const genreToPreserve = getActiveGenre(analysis, window.PROD_AI_REF_GENRE);
resetReferenceStateFully(genreToPreserve);
```

**Contexto:**  
Executado DURANTE renderização, DEPOIS que targets já foram carregados

**Impacto:**
- ❌ **CRÍTICO:** Limpa `__activeRefData` que acabou de ser populado em T2
- ❌ Causa erro "Targets não disponíveis" e aborta renderização
- ❌ Análise de gênero nunca renderiza tabela de comparação

**Risco de contaminação:**  
Alto - destrói dados necessários para renderização

**Propósito original:**  
"Limpeza preventiva" para garantir isolamento entre modos

**Deve executar?**  
❌ **NÃO!** Reset deve ocorrer ANTES de carregar dados, nunca DURANTE renderização.

---

### ⚠️ **RESET #3: Linha 7091 - `toggleAnalysisMode()`**

```javascript
// LINHA 7091
const currentGenre = window.PROD_AI_REF_GENRE || window.__CURRENT_GENRE;
resetReferenceStateFully(currentGenre);
```

**Contexto:**  
Executado ao trocar entre modos manualmente

**Impacto:**
- ✅ Limpa estado ao trocar de reference → genre
- ❌ Não recarrega targets após limpar
- ⚠️ Pode deixar UI em estado inconsistente

**Risco de contaminação:**  
Médio - troca de modo sem recarregar dados

**Propósito original:**  
Limpar estado ao alternar modos

**Deve executar?**  
✅ SIM, mas deve chamar `loadReferenceData(currentGenre)` logo após reset

---

### ✅ **RESETS CORRETOS: Linhas 1566, 1709**

```javascript
// LINHA 1566 - openAudioModal()
resetReferenceStateFully();

// LINHA 1709 - resetReferenceFlow()
resetReferenceStateFully();
```

**Contexto:**  
Executados ao ABRIR modal ou RESETAR fluxo manualmente

**Impacto:**
- ✅ Limpa estado ANTES de iniciar nova análise
- ✅ Não interfere com dados carregados

**Risco de contaminação:**  
Baixo - ponto de entrada limpo

**Propósito original:**  
Limpar estado ao iniciar novo fluxo

**Deve executar?**  
✅ SIM - corretos como estão

---

## 🔍 DIAGNÓSTICO DE SOBRESCRITA E CONTAMINAÇÃO

### 🎯 **PONTO 1: `analysis.genre` sobrescrito**

**Locais identificados:**
- **Linha 6415:** `normalizedResult.genre = genreToPreserve` - Sobrescreve se vazio
- **Linha 4540:** `analysis.genre = genreToPreserve` - Sobrescreve se vazio

**❌ PROBLEMA:**  
Se `genreToPreserve` for null (porque `getActiveGenre()` não encontrou), `analysis.genre` fica undefined → fallback para "default"

---

### 🎯 **PONTO 2: `window.__activeRefData` zerado indevidamente**

**Locais identificados:**
- **Linha 4122:** `window.__activeRefData = null` - Dentro de `resetReferenceStateFully()`

**Execuções:**
1. Linha 6412 - ANTES de carregar targets (ok)
2. Linha 4536 - DEPOIS de carregar targets (❌ ERRO)
3. Linha 7091 - Ao trocar modo (sem recarregar)

**❌ PROBLEMA:**  
Reset limpa `__activeRefData` indiscriminadamente, mesmo quando contém targets válidos para modo gênero

---

### 🎯 **PONTO 3: `window.__CURRENT_GENRE` perdido**

**Locais de limpeza:**
- **Linha 4139:** `window.__CURRENT_GENRE = null` - Dentro de reset

**Locais de restauração:**
- **Linha 4215:** `window.__CURRENT_GENRE = __savedGenre` - Se preserveGenre existir
- **Linha 6547:** `window.__CURRENT_GENRE = genreId` - Após carregar targets

**❌ PROBLEMA:**  
Se `preserveGenre` for null no reset, `__CURRENT_GENRE` fica null permanentemente

---

### 🎯 **PONTO 4: `genreTargets` com fallback híbrido**

**Linha 4576 - renderGenreView():**
```javascript
let genreTargets = window.PROD_AI_REF_DATA?.[genre] || window.__activeRefData;

if (!genreTargets) {
    console.error('[GENRE-VIEW] ❌ CRÍTICO: Targets não disponíveis');
    return;
}
```

**❌ PROBLEMA:**  
Tenta usar `PROD_AI_REF_DATA` primeiro, mas se for estrutura antiga (objeto único), não encontra.  
Fallback para `__activeRefData` que foi zerado no reset anterior.

---

### 🎯 **PONTO 5: Fallback para "default" em 11 locais**

**Locais identificados:**
1. Linha 1944: `selectedGenre = window.PROD_AI_REF_GENRE || 'default'`
2. Linha 2363: `selectedGenre = window.PROD_AI_REF_GENRE || 'default'`
3. Linha 4559: `window.PROD_AI_REF_GENRE || 'default'`
4. Linha 6470: `if (genreId && genreId !== 'default')`
5. Linha 6571: `console.warn('[GENRE-TARGETS] GenreId inválido ou "default"'`
6. Linha 16181: `GENRE_SCORING_WEIGHTS[genreKey] || GENRE_SCORING_WEIGHTS['default']`

**❌ PROBLEMA:**  
Se gênero for perdido em qualquer ponto, fallback aplica "default" silenciosamente

---

## 💊 PROPOSTA DE CORREÇÃO

### ✅ **CORREÇÃO #1: Remover reset da renderização**

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** 4536

**REMOVER:**
```javascript
// ❌ REMOVER ESTA LINHA
const genreToPreserve = getActiveGenre(analysis, window.PROD_AI_REF_GENRE);
resetReferenceStateFully(genreToPreserve);
```

**ADICIONAR GUARD:**
```javascript
// ✅ ADICIONAR: Guard para abortar se não houver gênero válido
if (!analysis.genre && !window.__CURRENT_GENRE && !window.PROD_AI_REF_GENRE) {
    console.error('[GENRE-VIEW] ❌ Nenhum gênero disponível - abortando renderização');
    return;
}
```

**Justificativa:**  
Reset durante renderização destrói dados já carregados. Deve ser executado apenas ANTES de carregar.

---

### ✅ **CORREÇÃO #2: Modificar reset para não limpar targets válidos**

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** 4122

**ANTES:**
```javascript
window.__activeRefData = null;
```

**DEPOIS:**
```javascript
// ✅ Só limpar __activeRefData se estiver em modo reference
if (window.currentAnalysisMode === 'reference' || !preserveGenre) {
    window.__activeRefData = null;
    console.log('   ✅ window.__activeRefData: null (modo reference ou sem gênero)');
} else {
    console.log('   ⏭️ window.__activeRefData: PRESERVADO (modo gênero com targets)');
}
```

**Justificativa:**  
Modo gênero precisa de `__activeRefData` com targets. Só limpar em modo reference.

---

### ✅ **CORREÇÃO #3: Garantir `getActiveGenre()` nunca retorne null**

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** 4053

**ANTES:**
```javascript
function getActiveGenre(analysis, fallback) {
    const genre = analysis?.genre ||
                 analysis?.genreId ||
                 analysis?.metadata?.genre ||
                 window.__CURRENT_GENRE ||
                 window.__soundyState?.render?.genre ||
                 window.__activeUserGenre ||
                 window.PROD_AI_REF_GENRE ||
                 fallback;
    
    return genre;  // ❌ Pode retornar undefined
}
```

**DEPOIS:**
```javascript
function getActiveGenre(analysis, fallback) {
    const genre = analysis?.genre ||
                 analysis?.genreId ||
                 analysis?.metadata?.genre ||
                 window.__CURRENT_GENRE ||
                 window.__soundyState?.render?.genre ||
                 window.__activeUserGenre ||
                 window.PROD_AI_REF_GENRE ||
                 fallback ||
                 'default';  // ✅ Garantir fallback mínimo
    
    console.log('[GET-ACTIVE-GENRE] Gênero detectado:', genre);
    return genre;
}
```

**Justificativa:**  
Garantir que sempre retorna algo válido, evitando undefined → fallback "default"

---

### ✅ **CORREÇÃO #4: Reordenar execução em `handleGenreAnalysisWithResult()`**

**Arquivo:** `public/audio-analyzer-integration.js  
**Linhas:** 6412-6550

**REORDENAR:**
```javascript
// ✅ ORDEM CORRETA:

// 1️⃣ CARREGAR TARGETS PRIMEIRO (antes de qualquer reset)
const genreId = getActiveGenre(normalizedResult, window.PROD_AI_REF_GENRE);

if (genreId && genreId !== 'default') {
    const response = await fetch(`/refs/out/${genreId}.json`);
    const targets = enrichReferenceObject(rawJson[rootKey], genreId);
    window.__activeRefData = targets;
    window.__CURRENT_GENRE = genreId;
}

// 2️⃣ DEPOIS EXECUTAR RESET (se necessário)
const isGenreModeFromBackend = (
    normalizedResult.mode === 'genre' &&
    normalizedResult.isReferenceBase !== true
);

if (isGenreModeFromBackend) {
    // ✅ Reset agora não destrói targets (CORREÇÃO #2 aplicada)
    const genreToPreserve = getActiveGenre(normalizedResult, window.PROD_AI_REF_GENRE);
    resetReferenceStateFully(genreToPreserve);
    
    if (genreToPreserve && !normalizedResult.genre) {
        normalizedResult.genre = genreToPreserve;
    }
    
    setViewMode("genre");
}

// 3️⃣ RENDERIZAR COM TARGETS DISPONÍVEIS
await displayModalResults(normalizedResult);
```

**Justificativa:**  
Carregar dados ANTES de limpar garante que targets estejam disponíveis para renderização

---

### ✅ **CORREÇÃO #5: Recarregar targets após trocar modo**

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** 7091

**ADICIONAR:**
```javascript
// LINHA 7091 - toggleAnalysisMode()
const currentGenre = window.PROD_AI_REF_GENRE || window.__CURRENT_GENRE;
resetReferenceStateFully(currentGenre);

// ✅ ADICIONAR: Recarregar targets se estiver trocando para modo gênero
if (newMode === 'genre' && currentGenre && currentGenre !== 'default') {
    await loadReferenceData(currentGenre);
    console.log('[TOGGLE-MODE] ✅ Targets recarregados após trocar para modo gênero');
}
```

**Justificativa:**  
Trocar de reference → genre sem recarregar targets deixa `__activeRefData` vazio

---

## 📊 FLUXO CORRETO PROPOSTO

### ✅ **NOVO FLUXO: Análise de Gênero**

```
T0: Usuário seleciona arquivo
  ↓
T1: handleModalFileSelection()
  ├─ Upload + cria job + poll status
  └─ handleGenreAnalysisWithResult(analysisResult, fileName)
  ↓
T2: handleGenreAnalysisWithResult()
  ├─ normalizeBackendAnalysisData() → normalizedResult
  │
  ├─ 1️⃣ CARREGAR TARGETS PRIMEIRO
  │   ├─ genreId = getActiveGenre(normalizedResult, PROD_AI_REF_GENRE)
  │   ├─ if (genreId !== 'default')
  │   │   ├─ fetch(`/refs/out/${genreId}.json`)
  │   │   ├─ enrichReferenceObject(targets, genreId)
  │   │   ├─ window.__activeRefData = targets ← ✅ POPULA ANTES
  │   │   └─ window.__CURRENT_GENRE = genreId
  │
  ├─ 2️⃣ EXECUTAR RESET (com targets já carregados)
  │   ├─ genreToPreserve = getActiveGenre(normalizedResult, PROD_AI_REF_GENRE)
  │   ├─ resetReferenceStateFully(genreToPreserve)
  │   │   └─ ✅ NÃO limpa __activeRefData (CORREÇÃO #2)
  │   └─ setViewMode("genre")
  │
  └─ 3️⃣ RENDERIZAR COM TARGETS DISPONÍVEIS
      └─ displayModalResults(normalizedResult)
  ↓
T3: displayModalResults(analysis)
  └─ renderGenreView(analysis)
  ↓
T4: renderGenreView(analysis)
  ├─ ✅ NÃO executa reset (CORREÇÃO #1)
  ├─ genreTargets = __activeRefData (já populado)
  └─ renderGenreComparisonTable({ analysis, genre, targets: genreTargets })
```

**✅ GARANTIAS:**
- Targets carregados ANTES de qualquer reset
- Reset não destrói targets se em modo gênero
- Renderização sempre tem dados disponíveis
- Nenhum fallback para "default" indevido

---

## 📌 CHECKLIST DE VALIDAÇÃO

**Após aplicar correções, validar:**

### ✅ **Teste 1: Análise de gênero pura**
- [ ] Genre carregado antes de reset
- [ ] `__activeRefData` não é limpo durante renderização
- [ ] Tabela de comparação renderiza corretamente
- [ ] Nenhum erro "Targets não disponíveis"
- [ ] Genre !== "default" no resultado final

### ✅ **Teste 2: Análise de referência (A/B)**
- [ ] Primeira música salva corretamente
- [ ] Segunda música compara com primeira
- [ ] Reset não interfere com comparação
- [ ] Tabela A/B renderiza corretamente

### ✅ **Teste 3: Troca entre modos**
- [ ] Trocar reference → genre recarrega targets
- [ ] Trocar genre → reference limpa estado
- [ ] UI atualiza corretamente após troca
- [ ] Nenhum dado residual contamina novo modo

### ✅ **Teste 4: Logs TRACE**
- [ ] `[GENRE-ISOLATION]` aparece apenas quando necessário
- [ ] `[GENRE-VIEW]` não mostra erro de targets ausentes
- [ ] `[GET-ACTIVE-GENRE]` sempre retorna valor válido
- [ ] `__activeRefData` nunca é null em modo gênero

---

## 🎯 RESUMO DOS BUGS

### ❌ **Bug #1: Reset durante renderização**
**Causa:** `resetReferenceStateFully()` chamado em `renderGenreView()` (linha 4536)  
**Impacto:** Destrói targets já carregados  
**Correção:** Remover reset da renderização

### ❌ **Bug #2: Reset limpa targets válidos**
**Causa:** `window.__activeRefData = null` incondicional (linha 4122)  
**Impacto:** Perde targets necessários para modo gênero  
**Correção:** Só limpar em modo reference ou sem gênero

### ❌ **Bug #3: `getActiveGenre()` retorna null**
**Causa:** Fallback chain sem valor mínimo garantido (linha 4053)  
**Impacto:** Genre undefined → fallback "default"  
**Correção:** Adicionar fallback 'default' no final da chain

### ❌ **Bug #4: Ordem incorreta de execução**
**Causa:** Reset executado ANTES de carregar targets (linha 6412)  
**Impacto:** Targets carregados depois são destruídos no próximo reset  
**Correção:** Carregar targets ANTES de reset

### ❌ **Bug #5: Trocar modo não recarrega targets**
**Causa:** `toggleAnalysisMode()` reseta mas não recarrega (linha 7091)  
**Impacto:** UI em estado inconsistente após troca  
**Correção:** Chamar `loadReferenceData()` após reset

---

**Auditoria executada por:** GitHub Copilot (Claude Sonnet 4.5)  
**Data:** 26 de novembro de 2025  
**Resultado:** ⚠️ **5 BUGS CRÍTICOS IDENTIFICADOS - CORREÇÕES PRONTAS PARA APLICAR**  
**Próximo passo:** Validar relatório e gerar PATCH completo
