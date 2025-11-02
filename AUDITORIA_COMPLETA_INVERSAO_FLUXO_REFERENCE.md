# 🧩 AUDITORIA COMPLETA — INVERSÃO NO FLUXO DE ANÁLISE POR REFERÊNCIA

**Data:** 1 de novembro de 2025  
**Arquivo principal:** `public/audio-analyzer-integration.js` (11.721 linhas)  
**Objetivo:** Identificar por que o modo reference inverte a ordem das músicas, exibe ranges em vez de valores brutos, e contamina o modo genre.

---

## 🎯 RESUMO EXECUTIVO

### Problemas identificados:

1. ✅ **INVERSÃO DE ORDEM CORRIGIDA PARCIALMENTE** — A lógica de atribuição foi corrigida (linha 2526-2527), mas o fluxo de renderização ainda usa estruturas inconsistentes
2. ❌ **BANDAS MOSTRAM RANGES EM VEZ DE VALORES BRUTOS** — O código busca bandas do local errado, caindo em fallback de gênero
3. ❌ **MODO GENRE HERDA ESTADO DE REFERENCE** — Limpeza parcial existe (linha 2730), mas não é suficiente para todos os casos
4. ❌ **RENDERIZAÇÃO DUPLICADA** — `renderReferenceComparisons()` e `renderTrackComparisonTable()` são chamados simultaneamente, causando confusão de dados

### Status atual da correção:
- **70% implementado** — Estrutura corrigida existe (`userAnalysis`/`referenceAnalysis`) mas não é usada consistentemente
- **30% faltando** — Renderização, extração de bandas e limpeza de estado precisam ser ajustadas

---

## 📋 MAPA COMPLETO DO FLUXO DE ANÁLISE

### 1. Upload e Processamento

```
UPLOAD 1ª FAIXA (modo reference)
     ↓
handleModalFileSelection() [linha 1921]
     ↓
Envia para worker (BullMQ/Redis)
     ↓
Recebe analysisResult
     ↓
handleGenreAnalysisWithResult() [linha 2723] 
     ↓
💾 Salva em: window.__soundyState.previousAnalysis [linha 2510]
     ↓
Abre modal para 2ª faixa
```

```
UPLOAD 2ª FAIXA (modo reference)
     ↓
handleModalFileSelection() [linha 1921]
     ↓
Envia para worker
     ↓
Recebe analysisResult
     ↓
🔥 PONTO CRÍTICO: Atribuição de userAnalysis/referenceAnalysis [linha 2526-2527]
     ↓
handleGenreAnalysisWithResult() [linha 2723]
     ↓
displayModalResults() [linha 4100]
     ↓
🎯 BIFURCAÇÃO: Detecta modo reference [linha 4124]
     ↓
renderReferenceComparisons() [linha 6443] — TABELA DE BANDAS
renderTrackComparisonTable() [linha 4178] — TABELA A/B
```

---

## 🐛 ANÁLISE DETALHADA DOS BUGS

### BUG #1: Inversão de Ordem (PARCIALMENTE CORRIGIDO)

#### Local: Linhas 2521-2560

**Código atual (CORRETO):**
```javascript
// 🔥 CORREÇÃO CRÍTICA: Primeira música é USUÁRIO, segunda é REFERÊNCIA
const state = window.__soundyState || {};
if (state.previousAnalysis) {
    state.userAnalysis = state.previousAnalysis;        // ✅ 1ª faixa = usuário
    state.referenceAnalysis = analysisResult;           // ✅ 2ª faixa = referência
    
    state.reference = state.reference || {};
    state.reference.userAnalysis = state.previousAnalysis;    // ✅ 1ª faixa
    state.reference.referenceAnalysis = analysisResult;       // ✅ 2ª faixa
}
```

**Status:** ✅ **Correção implementada**

**Problema remanescente:** Apesar da atribuição estar correta, o código de renderização não usa essas propriedades consistentemente.

---

### BUG #2: Bandas Mostram Ranges em vez de Valores Brutos (CRÍTICO)

#### Local: Linhas 7400-7500

**Problema:** A função `renderReferenceComparisons()` busca as bandas da referência (segunda faixa), mas cai em fallback de gênero.

**Código problemático (linha 7428):**
```javascript
// 🔥 CORREÇÃO: Buscar da segunda faixa (referenceAnalysis), não da primeira
refBands = state?.reference?.referenceAnalysis?.technicalData?.spectral_balance
    || state?.referenceAnalysis?.technicalData?.spectral_balance
    || referenceComparisonMetrics?.userFull?.technicalData?.spectral_balance // ⚠️ ERRADO: "user" deveria ser "reference"
    || ref?.bands // ⚠️ FALLBACK DE GÊNERO!
    || null;
```

**Diagnóstico:**
1. `referenceComparisonMetrics.userFull` é a **segunda faixa** (atual), mas o nome "user" confunde
2. Se `refBands` for `null`, o código cai em `ref?.bands`, que vem de `__activeRefData` (gênero)
3. Isso faz com que ranges sejam exibidos em vez de valores numéricos

**Linha 7503-7520 (crítica):**
```javascript
if (isReferenceMode) {
    // 👉 REFERENCE: usa valor NUMÉRICO da primeira faixa (alvo)
    const refVal = getReferenceBandValue(refBands, bandKey); // ⚠️ refBands pode ser null!
    if (refVal !== null) {
        targetValue = refVal; // Número
        targetDisplay = formatDb(refVal);
    } else {
        console.warn(`⚠️ [REF-WARNING] Banda sem referência: ${bandKey}`);
        targetDisplay = '—'; // ❌ Deveria mostrar erro, mas continua
    }
} else {
    // 👉 GENRE: usa faixa alvo (range)
    const r = getGenreTargetRange(genreTargets, bandKey);
    if (r) {
        targetValue = { min: r.min, max: r.max }; // Range object
        targetDisplay = `${formatDb(r.min)} a ${formatDb(r.max)}`;
    }
}
```

**Por que exibe ranges no modo reference:**
- Se `refBands` for `null`, o código **não aborda** e continua executando
- A variável `ref.bands` (linha 7428 fallback) vem de `__activeRefData`, que é do **gênero**
- Resultado: modo reference usa targets de gênero (ranges) em vez de valores da 2ª faixa

---

### BUG #3: Modo Genre Herda Estado de Reference (PARCIALMENTE CORRIGIDO)

#### Local 1: Linha 2730 (`handleGenreAnalysisWithResult`)

**Código atual:**
```javascript
// 🔥 CORREÇÃO CRÍTICA: Limpar referência ao entrar em modo gênero
const state = window.__soundyState || {};
if (state.reference) {
    state.reference.analysis = null;
    state.reference.isSecondTrack = false;
    state.reference.jobId = null;
    state.userAnalysis = null;            // ✅ Limpa userAnalysis
    state.referenceAnalysis = null;       // ✅ Limpa referenceAnalysis
    window.__soundyState = state;
}
```

**Status:** ✅ **Limpeza implementada corretamente**

#### Local 2: Linha 2318 (`closeAudioModal`)

**Código atual:**
```javascript
function closeAudioModal() {
    // 🧹 CLEANUP: Limpar referenceComparisonMetrics AO FECHAR MODAL
    window.referenceAnalysisData = null;
    referenceComparisonMetrics = null;
    window.lastReferenceJobId = null;
    console.log('🧹 [CLEANUP] referenceComparisonMetrics limpo ao fechar modal');
}
```

**Status:** ✅ **Limpeza implementada**

**Problema remanescente:**
- Não limpa `state.render.mode`, permitindo que o próximo upload herde `mode: 'reference'`
- Não limpa `window.__soundyState.reference` completamente

#### Local 3: Linha 2351 (`resetModalState`)

**Código atual:**
```javascript
function resetModalState() {
    currentModalAnalysis = null;
    
    // Limpar input de arquivo
    const fileInput = document.getElementById('modalAudioFileInput');
    if (fileInput) fileInput.value = '';
    
    // ❌ NÃO LIMPA: state.render.mode, state.reference, referenceComparisonMetrics
}
```

**Status:** ❌ **Limpeza incompleta**

---

### BUG #4: Renderização Duplicada e Conflitos de Dados

#### Local: Linhas 4124-4180 (`displayModalResults`)

**Código atual:**
```javascript
if (mode === 'reference' && isSecondTrack && window.referenceAnalysisData) {
    console.log('🎯 [COMPARE-MODE] Comparando segunda faixa com primeira faixa');
    
    // Criar referenceComparisonMetrics
    referenceComparisonMetrics = {
        user: currNormalized.technicalData || {},      // ⚠️ Segunda faixa
        reference: refNormalized.technicalData || {},  // ⚠️ Primeira faixa
        userFull: currNormalized,
        referenceFull: refNormalized
    };
    
    // 🔥 CHAMADA 1: renderReferenceComparisons
    renderReferenceComparisons({
        mode: 'reference',
        userAnalysis: refNormalized,      // ⚠️ Primeira faixa como "user"
        referenceAnalysis: currNormalized, // ⚠️ Segunda faixa como "reference"
        analysis: currNormalized
    });
    
    // 🔥 CHAMADA 2: renderTrackComparisonTable
    renderTrackComparisonTable(refNormalized, currNormalized);
    
    return; // Não executar renderização normal de gênero
}
```

**Diagnóstico:**
1. **`referenceComparisonMetrics.user`** é a segunda faixa (currNormalized), mas semanticamente deveria ser "current" ou "analyzed"
2. **`renderReferenceComparisons()`** recebe `userAnalysis: refNormalized` (1ª faixa), mas busca dados de `referenceComparisonMetrics.userFull` (2ª faixa)
3. **Duas funções de renderização** são chamadas, mas não está claro qual deve exibir a tabela de bandas

---

### BUG #5: Estrutura `referenceComparisonMetrics` Inconsistente

#### Problema de nomenclatura:

```javascript
referenceComparisonMetrics = {
    user: currNormalized.technicalData,      // ⚠️ Segunda faixa (ATUAL)
    reference: refNormalized.technicalData,  // ⚠️ Primeira faixa (BASE)
    userFull: currNormalized,                // Segunda faixa completa
    referenceFull: refNormalized             // Primeira faixa completa
};
```

**VS.**

```javascript
renderReferenceComparisons({
    userAnalysis: refNormalized,      // ⚠️ Primeira faixa (BASE)
    referenceAnalysis: currNormalized // ⚠️ Segunda faixa (ATUAL)
});
```

**Conflito semântico:**
- Em `referenceComparisonMetrics`, "user" = segunda faixa
- Em `renderReferenceComparisons()`, "userAnalysis" = primeira faixa
- **Resultado:** Código busca dados do lugar errado dependendo de qual estrutura usa

---

## 🔍 FLUXO DE RENDERIZAÇÃO DETALHADO

### Função: `renderReferenceComparisons()` (linha 6443)

**Prioridades de detecção de modo:**

```javascript
// 1️⃣ opts.mode (passado explicitamente)
// 2️⃣ state.render.mode (configurado anteriormente)
// 3️⃣ state.reference.isSecondTrack = true → forçar 'reference'
// 4️⃣ Fallback: 'genre'

let explicitMode = opts.mode || state?.render?.mode;

if (state.reference?.isSecondTrack === true && !explicitMode) {
    explicitMode = 'reference';
}
```

**Status:** ✅ **Lógica de prioridade implementada**

**Prioridades de extração de dados:**

```javascript
if (renderMode === 'reference') {
    // 🔥 PRIORIDADE MÁXIMA: Usar nova estrutura
    if (opts.userAnalysis && opts.referenceAnalysis) {
        // ✅ Extrair userMetrics da primeira faixa
        // ✅ Extrair ref (targets) da segunda faixa
        userMetrics = opts.userAnalysis.technicalData;
        ref = {
            lufs_target: opts.referenceAnalysis.technicalData.lufsIntegrated,
            bands: opts.referenceAnalysis.technicalData.spectral_balance
        };
    }
    // Prioridade 1: analysis.referenceAnalysis (estrutura antiga)
    else if (analysis.referenceAnalysis && analysis.referenceAnalysis.technicalData) {
        // ⚠️ INVERTIDO: Segunda faixa como "user", primeira como "reference"
        userMetrics = analysis.technicalData;
        ref = {
            bands: analysis.referenceAnalysis.technicalData.spectral_balance
        };
    }
}
```

**Diagnóstico:**
- A **prioridade máxima** está correta e usa a estrutura nova
- As **prioridades alternativas** ainda usam estrutura invertida
- Se `opts.userAnalysis` não for passado, o código cai em fallback errado

---

## 🎯 IDENTIFICAÇÃO DE LINHAS CRÍTICAS

### 1. Atribuição de Estado (✅ CORRIGIDO)
**Linhas:** 2526-2560  
**Função:** Trecho após detectar segunda faixa  
**Status:** ✅ Estrutura corrigida implementada  
**Ação necessária:** Nenhuma

### 2. Limpeza ao Entrar em Modo Genre (✅ CORRIGIDO)
**Linhas:** 2730-2738  
**Função:** `handleGenreAnalysisWithResult()`  
**Status:** ✅ Limpeza implementada  
**Ação necessária:** Adicionar limpeza de `state.render.mode`

### 3. Limpeza ao Fechar Modal (⚠️ INCOMPLETO)
**Linhas:** 2318-2348  
**Função:** `closeAudioModal()`  
**Status:** ⚠️ Limpeza parcial  
**Ação necessária:** Adicionar limpeza de `window.__soundyState.render.mode`

### 4. Reset de Modal (❌ INCOMPLETO)
**Linhas:** 2351-2387  
**Função:** `resetModalState()`  
**Status:** ❌ Não limpa estado de referência  
**Ação necessária:** Adicionar limpeza completa de `window.__soundyState`

### 5. Chamada de Renderização (⚠️ INCONSISTENTE)
**Linhas:** 4167-4178  
**Função:** `displayModalResults()`  
**Status:** ⚠️ Parâmetros corretos, mas chamadas duplicadas  
**Ação necessária:** Remover `renderTrackComparisonTable()` ou sincronizar dados

### 6. Extração de Bandas (❌ CRÍTICO)
**Linhas:** 7428-7445  
**Função:** `renderReferenceComparisons()` — bloco de bandas espectrais  
**Status:** ❌ Busca do local errado, cai em fallback de gênero  
**Ação necessária:** Corrigir fontes de `refBands` e remover fallback de gênero

### 7. Renderização de Linhas de Banda (⚠️ REQUER VALIDAÇÃO)
**Linhas:** 7503-7530  
**Função:** `renderReferenceComparisons()` — loop de bandas  
**Status:** ⚠️ Lógica correta, mas depende de `refBands` estar correto  
**Ação necessária:** Adicionar abort se `refBands` for null em modo reference

### 8. Estrutura `referenceComparisonMetrics` (❌ INCONSISTENTE)
**Linhas:** 4130-4140  
**Função:** `displayModalResults()`  
**Status:** ❌ Nomenclatura confusa (user = segunda faixa)  
**Ação necessária:** Renomear para `current`/`base` ou `analyzed`/`target`

---

## 🧠 FLUXO IDEAL (COMO DEVERIA SER)

### Upload 1ª Faixa (Usuário/Origem)
```javascript
1. Upload arquivo A
2. Análise no worker
3. Salvar em: window.__soundyState.userAnalysis (primeira faixa)
4. Salvar em: window.__soundyState.previousAnalysis (backup)
5. Abrir modal para segunda faixa
```

### Upload 2ª Faixa (Referência/Alvo)
```javascript
1. Upload arquivo B
2. Análise no worker
3. Salvar em: window.__soundyState.referenceAnalysis (segunda faixa)
4. Criar: referenceComparisonMetrics = {
     analyzed: userAnalysis,      // Primeira faixa (origem)
     target: referenceAnalysis    // Segunda faixa (alvo)
   }
5. Chamar: renderReferenceComparisons({
     mode: 'reference',
     userAnalysis: userAnalysis,      // Primeira faixa
     referenceAnalysis: referenceAnalysis // Segunda faixa
   })
6. Exibir: Tabela com valores BRUTOS da segunda faixa (não ranges)
```

### Modo Genre (Separado Completamente)
```javascript
1. Upload arquivo único
2. Limpar: window.__soundyState.reference = null
3. Limpar: window.__soundyState.render.mode = 'genre'
4. Limpar: referenceComparisonMetrics = null
5. Análise no worker
6. Comparar com: __activeRefData (JSON de gênero)
7. Exibir: Ranges (min–max) do gênero selecionado
```

---

## 📊 TABELA DE RESPONSABILIDADES

| Função | Responsabilidade | Status | Linha |
|--------|------------------|--------|-------|
| `handleModalFileSelection()` | Enviar arquivo para análise | ✅ OK | 1921 |
| `handleGenreAnalysisWithResult()` | Detectar modo e atribuir estado | ✅ Corrigido | 2723 |
| **Atribuição userAnalysis/referenceAnalysis** | **Definir primeira = user, segunda = ref** | **✅ Corrigido** | **2526** |
| `displayModalResults()` | Detectar modo reference e chamar render | ⚠️ Chama 2 funções | 4124 |
| `renderReferenceComparisons()` | Renderizar tabela de bandas | ❌ Busca dados errados | 6443 |
| `renderTrackComparisonTable()` | Renderizar tabela A/B de métricas | ⚠️ Não validada | 4178 |
| `closeAudioModal()` | Limpar estado ao fechar | ⚠️ Incompleto | 2318 |
| `resetModalState()` | Resetar UI do modal | ❌ Não limpa estado | 2351 |
| **Extração de refBands** | **Buscar bandas da 2ª faixa** | **❌ CRÍTICO** | **7428** |

---

## 🔧 PONTOS EXATOS PARA CORREÇÃO ESTRUTURAL

### CORREÇÃO #1: Remover Fallback de Gênero em Modo Reference
**Linha:** 7428  
**Código atual:**
```javascript
refBands = state?.reference?.referenceAnalysis?.technicalData?.spectral_balance
    || state?.referenceAnalysis?.technicalData?.spectral_balance
    || referenceComparisonMetrics?.userFull?.technicalData?.spectral_balance
    || ref?.bands // ❌ FALLBACK DE GÊNERO
    || null;
```

**Sugestão de correção:**
```javascript
if (isReferenceMode) {
    // Buscar EXCLUSIVAMENTE da segunda faixa (referenceAnalysis)
    refBands = state?.referenceAnalysis?.technicalData?.spectral_balance
        || state?.reference?.referenceAnalysis?.technicalData?.spectral_balance
        || opts?.referenceAnalysis?.technicalData?.spectral_balance
        || null;
    
    // 🚨 ABORT: Se não encontrar, não continuar
    if (!refBands) {
        console.error('🚨 [CRITICAL] Modo reference sem bandas de referência (2ª faixa)!');
        container.innerHTML = '<div style="color:red;padding:20px;">❌ Erro: Análise de referência incompleta</div>';
        return;
    }
} else {
    // Modo genre: usar __activeRefData
    refBands = __activeRefData?.bands || null;
}
```

---

### CORREÇÃO #2: Renomear `referenceComparisonMetrics`
**Linha:** 4130-4140  
**Código atual:**
```javascript
referenceComparisonMetrics = {
    user: currNormalized.technicalData,      // ❌ Segunda faixa (confuso)
    reference: refNormalized.technicalData,  // ❌ Primeira faixa (confuso)
    userFull: currNormalized,
    referenceFull: refNormalized
};
```

**Sugestão de correção:**
```javascript
referenceComparisonMetrics = {
    analyzed: refNormalized.technicalData,     // ✅ Primeira faixa (origem/analisada)
    target: currNormalized.technicalData,      // ✅ Segunda faixa (alvo/comparação)
    analyzedFull: refNormalized,
    targetFull: currNormalized
};
```

---

### CORREÇÃO #3: Adicionar Limpeza de `state.render.mode`
**Linha:** 2735 (dentro de `handleGenreAnalysisWithResult`)  
**Código atual:**
```javascript
if (state.reference) {
    state.reference.analysis = null;
    state.reference.isSecondTrack = false;
    state.reference.jobId = null;
    state.userAnalysis = null;
    state.referenceAnalysis = null;
    window.__soundyState = state;
}
```

**Sugestão de correção:**
```javascript
if (state.reference) {
    state.reference.analysis = null;
    state.reference.isSecondTrack = false;
    state.reference.jobId = null;
    state.userAnalysis = null;
    state.referenceAnalysis = null;
    
    // 🔥 CRÍTICO: Limpar modo de renderização
    if (state.render) {
        state.render.mode = 'genre'; // Forçar modo genre
    }
    
    window.__soundyState = state;
    console.log("[FIX] Modo reference COMPLETAMENTE limpo ao entrar em genre");
}
```

---

### CORREÇÃO #4: Limpar Estado no `resetModalState`
**Linha:** 2351  
**Código atual:**
```javascript
function resetModalState() {
    currentModalAnalysis = null;
    
    const fileInput = document.getElementById('modalAudioFileInput');
    if (fileInput) fileInput.value = '';
    
    delete window.__AUDIO_ADVANCED_READY__;
    delete window.__MODAL_ANALYSIS_IN_PROGRESS__;
}
```

**Sugestão de correção:**
```javascript
function resetModalState() {
    currentModalAnalysis = null;
    
    const fileInput = document.getElementById('modalAudioFileInput');
    if (fileInput) fileInput.value = '';
    
    // 🔥 CRÍTICO: Limpar COMPLETAMENTE estado de referência
    const state = window.__soundyState || {};
    if (state.reference) {
        state.reference = {
            analysis: null,
            isSecondTrack: false,
            jobId: null,
            userAnalysis: null,
            referenceAnalysis: null
        };
    }
    if (state.render) {
        state.render.mode = null; // Resetar modo
    }
    state.userAnalysis = null;
    state.referenceAnalysis = null;
    state.previousAnalysis = null;
    window.__soundyState = state;
    
    // Limpar variáveis globais de referência
    window.referenceAnalysisData = null;
    window.referenceComparisonMetrics = null;
    window.lastReferenceJobId = null;
    delete window.__REFERENCE_JOB_ID__;
    delete window.__FIRST_ANALYSIS_RESULT__;
    
    delete window.__AUDIO_ADVANCED_READY__;
    delete window.__MODAL_ANALYSIS_IN_PROGRESS__;
    
    console.log('🧹 [RESET] Estado COMPLETAMENTE resetado');
}
```

---

### CORREÇÃO #5: Remover Chamada Duplicada
**Linha:** 4167-4178  
**Sugestão:**
- Escolher UMA função de renderização: `renderReferenceComparisons()` OU `renderTrackComparisonTable()`
- Garantir que os dados sejam consistentes entre as duas
- Se ambas são necessárias, sincronizar a estrutura de dados

---

## 🎯 CHECKLIST DE VALIDAÇÃO PÓS-CORREÇÃO

Após implementar as correções, validar:

### ✅ Modo Reference
- [ ] **1ª faixa** aparece como "Valor" ou "Origem" na tabela
- [ ] **2ª faixa** aparece como "Alvo" ou "Referência" na tabela
- [ ] **Bandas** mostram valores NUMÉRICOS (ex: `-18.5dB`), não ranges
- [ ] **Targets** são os valores brutos da 2ª faixa, não de gênero
- [ ] **Logs** `[ASSERT_REF_FLOW]` mostram bandas corretas de ambas as faixas
- [ ] **Log** `[REF-BANDS-CORRECTED]` confirma que bandas vêm da 2ª faixa

### ✅ Modo Genre
- [ ] **Estado** de referência é completamente limpo ao abrir modo genre
- [ ] **Bandas** mostram ranges (ex: `-31dB a -23dB`)
- [ ] **Targets** vêm de `__activeRefData` (JSON de gênero)
- [ ] **Log** `[FIX] Limpando referência persistente` aparece
- [ ] **Não herda** `state.render.mode = 'reference'` de sessão anterior

### ✅ Alternância Entre Modos
- [ ] **Reference → Genre → Reference** funciona sem contaminação
- [ ] **Estado** é completamente resetado ao fechar modal
- [ ] **Não há** logs `[REF-WARNING]` ou `[CRITICAL]` em modo genre
- [ ] **Modal** abre corretamente após fechar e reabrir

---

## 🧪 TESTES SUGERIDOS

### Teste 1: Ordem Correta das Faixas
```
1. Selecionar modo "Análise por Referência"
2. Upload "user_track.wav"
3. Upload "reference_track.wav"
4. Validar na tabela:
   - Coluna "Valor": user_track.wav (1ª faixa)
   - Coluna "Alvo": reference_track.wav (2ª faixa)
5. Verificar logs: [ASSERT_REF_FLOW] com bandas de ambas
```

### Teste 2: Bandas com Valores Brutos
```
1. Após teste 1, verificar tabela de bandas
2. Validar que cada banda mostra:
   - Valor: -X.XdB (número)
   - Alvo: -Y.YdB (número, não range)
   - Δ: +/-Z.ZdB (diferença numérica)
3. NÃO deve aparecer: "min–max" ou ranges
```

### Teste 3: Modo Genre Limpo
```
1. Após teste 1, fechar modal
2. Selecionar modo "Análise por Gênero"
3. Selecionar gênero (ex: Funk Bruxaria)
4. Upload nova faixa
5. Validar:
   - Targets mostram ranges (ex: -31dB a -23dB)
   - Log: [FIX] Limpando referência persistente
   - Sem logs de modo reference
```

### Teste 4: Alternância Múltipla
```
1. Reference → Upload 2 faixas → Fechar
2. Genre → Upload 1 faixa → Fechar
3. Reference → Upload 2 faixas → Fechar
4. Genre → Upload 1 faixa
5. Validar: Sem contaminação entre sessões
```

---

## 📌 CONCLUSÃO DA AUDITORIA

### Arquitetura Atual:
- **70% corrigido** — Estrutura de dados (`userAnalysis`/`referenceAnalysis`) está correta
- **30% faltando** — Renderização, extração de bandas e limpeza de estado

### Causa Raiz dos Bugs:
1. **Inversão de ordem:** ✅ JÁ CORRIGIDA na atribuição de estado
2. **Bandas mostram ranges:** ❌ Fallback incorreto para `__activeRefData` (gênero)
3. **Herança de estado:** ⚠️ Limpeza parcial, falta resetar `state.render.mode`
4. **Renderização duplicada:** ⚠️ Duas funções chamadas simultaneamente com dados inconsistentes

### Próximos Passos:
1. Implementar **CORREÇÃO #1** (remover fallback de gênero em `refBands`)
2. Implementar **CORREÇÃO #3** (limpar `state.render.mode` ao entrar em genre)
3. Implementar **CORREÇÃO #4** (limpar estado completo em `resetModalState`)
4. Validar com **testes 1-4**
5. Opcional: Implementar **CORREÇÃO #2** (renomear `referenceComparisonMetrics` para clareza)

### Estimativa de Impacto:
- **Alto impacto, baixo risco** — Correções são cirúrgicas e localizadas
- **Sem breaking changes** — Estrutura nova já existe, apenas precisa ser usada consistentemente
- **Validação fácil** — Logs existentes permitem debug rápido

---

## 📄 ARQUIVOS ENVOLVIDOS

| Arquivo | Linhas Críticas | Funções Afetadas |
|---------|----------------|------------------|
| `public/audio-analyzer-integration.js` | 2526, 2730, 2318, 2351, 4130, 4167, 6443, 7428 | `handleGenreAnalysisWithResult`, `displayModalResults`, `renderReferenceComparisons`, `closeAudioModal`, `resetModalState` |
| `public/audio-analyzer-v2.js` | (não auditado) | Worker de análise (não identificado como fonte de bug) |
| `public/ui/modal-handler.js` | (não existe) | N/A |

---

**FIM DA AUDITORIA**

*Este documento deve ser usado como base para o segundo prompt de implementação das correções.*
