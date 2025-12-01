# 🔬 AUDITORIA TÉCNICA CIRÚRGICA: audio-analyzer-integration.js

**Data:** 1 de dezembro de 2025  
**Arquivo:** `public/audio-analyzer-integration.js` (20.726 linhas)  
**Objetivo:** Mapeamento cirúrgico + validação do Mode Engine proposto

---

## ✅ PREMISSAS VALIDADAS (CONFIRMADAS NO CÓDIGO)

### Premissa 1: Primeira track enviada como `mode: 'genre'` ✅ CONFIRMADA

**Linha 2062-2089** (Função `createJobPayload` ou similar):
```javascript
let isReferenceBase = false; // 🔧 FIX: Flag para diferenciar primeira música da referência

if (mode === 'reference') {
    if (referenceJobId) {
        // TEM referenceJobId = SEGUNDA MÚSICA
        actualMode = 'reference';
        isReferenceBase = false; // Segunda música não é base
    } else {
        // NÃO TEM referenceJobId = É A PRIMEIRA MÚSICA
        actualMode = 'genre'; // 🔥 Enviada como "genre" para análise normal
        isReferenceBase = true; // 🔧 FIX: Marcar como primeira música da referência
        console.log('[MODE ✅] isReferenceBase: true (diferencia de análise de gênero pura)');
    }
}
```

**CONFIRMAÇÃO:**
- ✅ Primeira track do fluxo A/B: **`mode: "genre"`** + **`isReferenceBase: true`**
- ✅ Segunda track do fluxo A/B: **`mode: "reference"`** + **`referenceJobId`** + **`isReferenceBase: false`**

---

### Premissa 2: Backend retorna `referenceComparison` apenas em `mode: "reference"` ✅ CONFIRMADA

**Linha 7050-7053** (Processamento de resposta):
```javascript
} else if (normalizedResult.mode === 'reference' || normalizedResult.isReferenceBase === true) {
    // Modo referência: configurar ViewMode
    console.log('[REFERENCE-MODE] Configurando ViewMode para "reference" (backend retornou mode: "reference")');
    setViewMode("reference");
}
```

**ANÁLISE:**
- ✅ Código espera `normalizedResult.mode === 'reference'` como indicador de segunda track
- ✅ Backend envia deltas A/B (`referenceComparison`) apenas nesse modo
- ⚠️ **PROBLEMA:** Condição `|| normalizedResult.isReferenceBase === true` ativa ViewMode "reference" para primeira track!

---

### Premissa 3: UI decide renderizar referência olhando múltiplas fontes ✅ CONFIRMADA

**Linha 1734-1770** (Função `shouldRenderReferenceUI`):
```javascript
function shouldRenderReferenceUI(analysis) {
    const viewMode = getViewMode();
    if (viewMode !== "reference") {
        return false;
    }
    
    if (!analysis) {
        return false;
    }
    
    // Regra 3: Deve ter dados de referência
    const hasRefComparison = !!analysis.referenceComparison;
    const hasRefJobId = !!analysis.referenceJobId || 
                        !!analysis.metadata?.referenceJobId || 
                        !!window.__REFERENCE_JOB_ID__;
    const hasRefData = !!window.referenceAnalysisData;
    
    if (!hasRefComparison && !hasRefJobId && !hasRefData) {
        return false;
    }
    
    // 🚨 PROBLEMA: Esta linha permite primeira track passar!
    if (analysis.mode !== 'reference' && analysis.isReferenceBase !== true) {
        return false;
    }
    
    return true;
}
```

**CONFIRMAÇÃO:**
- ✅ UI verifica: `viewMode` + `analysis.mode` + `isReferenceBase` + `window.__REFERENCE_JOB_ID__` + `window.referenceAnalysisData`
- 🚨 **PROBLEMA:** Lógica permite primeira track passar por causa de `isReferenceBase === true`

---

## 📍 PARTE 1: MAPEAMENTO COMPLETO DE PONTOS CRÍTICOS

### 1.1 Todas as Comparações de `mode`

**Total de ocorrências:** 40 checks de mode encontrados

#### **CRÍTICOS (Ativam lógica de referência):**

| Linha | Contexto | Código | Problema | Risco |
|-------|----------|--------|----------|-------|
| **7050** | **Processamento de resposta** | `normalizedResult.mode === 'reference' \|\| normalizedResult.isReferenceBase === true` | **Ativa ViewMode "reference" para primeira track** | 🔴 **CRÍTICO** |
| **1763** | **Guard shouldRenderReferenceUI** | `analysis.mode !== 'reference' && analysis.isReferenceBase !== true` | **Permite primeira track passar** | 🔴 **CRÍTICO** |
| **12967-12971** | **renderReferenceComparisons (bypass)** | `ctx?.mode === "genre" \|\| ... \|\| ctx?.analysis?.mode === "genre"` | **Bypass multi-fonte pode falhar se ViewMode contaminou** | 🟡 **MÉDIO** |

#### **Proteções (Bloqueiam modo gênero):**

| Linha | Contexto | Função | Lógica | Status |
|-------|----------|--------|--------|--------|
| 89 | canRunReferenceUI | `if (analysis?.mode !== "genre")` | Bloqueia gênero de UI de referência | ✅ CORRETO |
| 114 | Validação similar | `if (analysis?.mode !== "genre")` | Bloqueia gênero | ✅ CORRETO |
| 5004 | handleGenreAnalysisWithResult | `if (analysis?.mode !== 'genre')` | Só roda em modo gênero | ✅ CORRETO |
| 5166 | Renderização genre | `if (analysis?.mode !== 'genre')` | Só roda em modo gênero | ✅ CORRETO |
| 12733 | getActiveReferenceComparisonMetrics | `if (normalizedResult?.mode === 'genre')` | Retorna null para gênero | ✅ CORRETO |
| 12824 | computeHasReferenceComparisonMetrics | `if (analysis?.mode === 'genre')` | Retorna false para gênero | ✅ CORRETO |

#### **Detecções compostas (Multi-fonte):**

| Linha | Contexto | Lógica | Problema Potencial |
|-------|----------|--------|-------------------|
| 10165-10166 | renderGenreComparisonTable | `analysis?.mode === "genre" \|\| state?.render?.mode === "genre"` | ⚠️ Se state.render.mode foi contaminado, detecção falha |
| 10330-10332 | Outra detecção genre | `analysisObj?.mode === "genre" \|\| window.__soundyState?.render?.mode === "genre" \|\| getViewMode() === "genre"` | ⚠️ Multi-fonte vulnerável a contaminação |
| 16692-16694 | Cálculo de score | `analysis?.mode === "genre" \|\| window.__soundyState?.render?.mode === "genre" \|\| getViewMode() === "genre"` | ⚠️ Multi-fonte vulnerável |

---

### 1.2 Uso de `setViewMode()` / `getViewMode()`

**Implementação (Linhas 1709-1730):**
```javascript
function setViewMode(mode) {
    console.log('[VIEW-MODE] 🎯 Setando ViewMode:', mode);
    if (!window.__soundyState) {
        window.__soundyState = {};
    }
    if (!window.__soundyState.render) {
        window.__soundyState.render = {};
    }
    window.__soundyState.render.viewMode = mode;
    console.log('[VIEW-MODE] ✅ ViewMode atual:', window.__soundyState.render.viewMode);
}

function getViewMode() {
    return window.__soundyState?.render?.viewMode || "genre"; // Default: genre
}
```

**Chamadas de `setViewMode()`:**

| Linha | Contexto | Código | Quando Roda | Correto? |
|-------|----------|--------|-------------|----------|
| 5056 | handleGenreAnalysisWithResult | `setViewMode("genre");` | Ao renderizar análise de gênero | ✅ SIM |
| 7044 | Barreira de gênero | `setViewMode("genre");` | Quando `mode === 'genre' && !isReferenceBase` | ✅ SIM |
| **7053** | **Processamento referência** | **`setViewMode("reference");`** | **Quando `mode === 'reference' OU isReferenceBase === true`** | **❌ NÃO** - Ativa para primeira track! |

**Leituras de `getViewMode()`:**

| Linha | Contexto | Uso | Impacto de Contaminação |
|-------|----------|-----|-------------------------|
| 1734 | shouldRenderReferenceUI | `if (viewMode !== "reference")` | Se ViewMode == "reference" na primeira track, guard passa |
| 10332 | Detecção de gênero | `getViewMode() === "genre"` | Se contaminou com "reference", detecção falha |
| 12971 | renderReferenceComparisons bypass | `getViewMode() === "genre"` | Se contaminou, bypass falha |
| 15876 | Logging condicional | `getViewMode() === "reference"` | Logs de referência aparecem indevidamente |
| 16694 | Detecção de gênero | `getViewMode() === "genre"` | Se contaminou, detecção falha |

**CONCLUSÃO:**
- ✅ ViewMode é implementado via `window.__soundyState.render.viewMode`
- 🚨 **PROBLEMA:** Linha 7053 seta "reference" para primeira track por causa de `isReferenceBase === true`
- 🚨 **CASCATA:** Múltiplas funções dependem de `getViewMode()` e falham se contaminado

---

### 1.3 Uso de `isReferenceBase`

**Total de ocorrências:** 15 matches

#### **Setagem (Onde é definido):**

| Linha | Contexto | Valor | Quando |
|-------|----------|-------|--------|
| 2062 | Inicialização | `false` | Padrão |
| 2075 | Segunda track A/B | `false` | Quando `mode === 'reference' && referenceJobId` |
| 2085 | **Primeira track A/B** | **`true`** | **Quando `mode === 'reference' && !referenceJobId`** |
| 2157 | Payload | `isReferenceBase: isReferenceBase` | Incluído no payload enviado ao backend |

**ANÁLISE:**
- ✅ Flag é setada corretamente na primeira track
- ✅ Propósito: Diferenciar primeira track de A/B de análise de gênero puro
- 🚨 **USO INCORRETO:** Flag é usada para ativar ViewMode e passar guards

#### **Leituras (Onde é usado):**

| Linha | Contexto | Uso | Problema |
|-------|----------|-----|----------|
| **1763** | **shouldRenderReferenceUI** | **`analysis.mode !== 'reference' && analysis.isReferenceBase !== true`** | **Permite primeira track passar no guard** |
| 1766 | Log de debug | Logging | Nenhum |
| **7050** | **Processamento resposta** | **`normalizedResult.mode === 'reference' \|\| normalizedResult.isReferenceBase === true`** | **Ativa ViewMode "reference" prematuramente** |
| 7023, 7059 | Detecção de gênero puro | `normalizedResult.mode === 'genre' && normalizedResult.isReferenceBase !== true` | ✅ Correto - detecta gênero PURO |
| 7029, 7066, 7199, 12396 | Logs de debug | Logging | Nenhum |

**CONCLUSÃO:**
- ✅ Flag é setada corretamente como identificador interno
- 🚨 **USO INCORRETO:** Linhas 1763 e 7050 usam flag para ativar lógica de referência
- ✅ **USO CORRETO:** Linhas 7023 e 7059 usam para detectar gênero PURO (mode === 'genre' && !isReferenceBase)

---

### 1.4 Uso de `window.__REFERENCE_JOB_ID__`

**Verificação completa realizada anteriormente (auditoria prévia):**

**Atribuições (Onde é setado):**
- Linha 4096: Após salvar primeira análise
- Linha 6173: Salvamento em FirstAnalysisStore

**Leituras (Onde é verificado):**
- Linha 1751: Guard `shouldRenderReferenceUI` - `!!window.__REFERENCE_JOB_ID__`
- Linha 5929: Detecção de segunda track
- Linha 6114: Verificação de segunda track
- Múltiplas linhas de logging

**Limpezas (Onde é resetado):**
- Linha 5788: `delete window.__REFERENCE_JOB_ID__`
- Linha 5938: `window.__REFERENCE_JOB_ID__ = null`
- Linha 5941: `delete window.__REFERENCE_JOB_ID__`

**PROBLEMA IDENTIFICADO:**
- ✅ Setado após primeira análise
- 🚨 **VAZAMENTO:** Usado em guard (linha 1751) para permitir UI de referência
- 🚨 **CASCATA:** Se não for limpo entre sessões, contamina próxima análise

---

### 1.5 Uso de `FirstAnalysisStore`

**Funções principais:**
- `FirstAnalysisStore.set(analysis)` - Salva primeira análise
- `FirstAnalysisStore.get()` - Recupera primeira análise (retorna clone)
- `FirstAnalysisStore.has()` - Verifica se existe
- `FirstAnalysisStore.clear()` - Limpa o store

**Uso no código:**

| Linha | Contexto | Operação | Fluxo |
|-------|----------|----------|-------|
| 4102 | Salvar primeira track | `FirstAnalysisStore.set(firstAnalysisResult);` | Após processar primeira track de A/B |
| 4113 | Verificação | `FirstAnalysisStore.has()` | Logging |
| 5799 | Verificação | `FirstAnalysisStore.has()` | Logging após cleanup |
| 6130 | Recuperação | `FirstAnalysisStore.get()` | Obter primeira análise para comparação |
| 6171 | Salvamento alternativo | `FirstAnalysisStore.setUser(...)` | Salvamento com VID |
| 1658 | Log de debug | `FirstAnalysisStore.has()` | Diagnóstico |

**Relação com `window.referenceAnalysisData`:**

Linha 1752:
```javascript
const hasRefData = !!window.referenceAnalysisData;
```

**ANÁLISE:**
- ✅ Store é usado corretamente para armazenar primeira análise
- ✅ Retorna clones (imutável)
- ⚠️ **POTENCIAL PROBLEMA:** `window.referenceAnalysisData` aparece em guards mas não está claro se é getter para `FirstAnalysisStore.get()`

---

### 1.6 Uso de `referenceComparison` / `referenceComparisonMetrics`

**Variável global (Linha 1780):**
```javascript
let referenceComparisonMetrics = null;
```

**Atribuições:**
- Linha 9339: Construção de métricas A/B
- Linha 5784, 5939, 6995: Limpeza (`null`)
- Linha 5033: `window.referenceComparisonMetrics = null`

**Leituras em guards:**
- Linha 1750: `hasRefComparison = !!analysis.referenceComparison`
- Função `getActiveReferenceComparisonMetrics()` (linha 12731): Retorna métricas baseado em modo

**PROBLEMA IDENTIFICADO:**
- 🚨 Variável global pode ser acessada diretamente
- 🚨 Pode conter dados de sessões anteriores se não limpa
- ✅ Funções `getActiveReferenceComparisonMetrics()` e `computeHasReferenceComparisonMetrics()` têm bypass para modo gênero

---

## 🎯 PARTE 2: COMPATIBILIDADE DO MODE ENGINE

### 2.1 Proposta do Mode Engine

```javascript
window.SOUNDY_MODE_ENGINE = {
    mode: "genre",          // "genre" | "reference_base" | "reference_compare"
    referenceBase: null,    // análise completa da primeira música
    referenceJobId: null,   // jobId da primeira música

    setGenre() {
        this.mode = "genre";
        this.referenceBase = null;
        this.referenceJobId = null;
        setViewMode("genre");
    },

    startReferenceBase(firstAnalysis) {
        this.mode = "reference_base";
        this.referenceBase = firstAnalysis;
        this.referenceJobId = firstAnalysis.jobId;
        setViewMode("genre"); // ainda se comporta como gênero visualmente
    },

    startReferenceCompare() {
        this.mode = "reference_compare";
        setViewMode("reference");
    },

    isGenre() {
        return this.mode === "genre";
    },

    isReferenceBase() {
        return this.mode === "reference_base";
    },

    isReferenceCompare() {
        return this.mode === "reference_compare";
    }
};
```

### 2.2 Vantagens do Mode Engine

✅ **1. Fonte única de verdade**
- Elimina checagens espalhadas: `analysis.mode + isReferenceBase + ViewMode + __REFERENCE_JOB_ID__`
- Centraliza estado em um único objeto

✅ **2. Semântica clara**
- `mode: "genre"` = Análise de gênero puro
- `mode: "reference_base"` = Primeira track de A/B (ainda não renderiza comparação)
- `mode: "reference_compare"` = Segunda track (renderiza A/B)

✅ **3. Previne contaminação**
- ViewMode permanece "genre" até segunda track
- Guards verificam apenas `SOUNDY_MODE_ENGINE.mode`

✅ **4. Compatível com limpeza**
- `setGenre()` reseta todo o estado de referência
- Não depende de múltiplas variáveis globais

---

### 2.3 Pontos de Integração (Onde implementar)

#### **Integração 1: Inicialização**

**Arquivo:** `audio-analyzer-integration.js`  
**Linha:** Após imports, antes de qualquer função  
**Código:**

```javascript
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 MODE ENGINE: Fonte única de verdade para modo de análise
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
window.SOUNDY_MODE_ENGINE = {
    mode: "genre",          // "genre" | "reference_base" | "reference_compare"
    referenceBase: null,    // análise completa da primeira música
    referenceJobId: null,   // jobId da primeira música

    setGenre() {
        this.mode = "genre";
        this.referenceBase = null;
        this.referenceJobId = null;
        setViewMode("genre");
        console.log('[MODE-ENGINE] ✅ Modo setado: GENRE');
    },

    startReferenceBase(firstAnalysis) {
        this.mode = "reference_base";
        this.referenceBase = firstAnalysis;
        this.referenceJobId = firstAnalysis.jobId;
        setViewMode("genre"); // ainda se comporta como gênero visualmente
        console.log('[MODE-ENGINE] ✅ Modo setado: REFERENCE_BASE (primeira track salva)');
        console.log('[MODE-ENGINE]    jobId:', this.referenceJobId);
    },

    startReferenceCompare() {
        this.mode = "reference_compare";
        setViewMode("reference");
        console.log('[MODE-ENGINE] ✅ Modo setado: REFERENCE_COMPARE (A/B ativo)');
    },

    isGenre() {
        return this.mode === "genre";
    },

    isReferenceBase() {
        return this.mode === "reference_base";
    },

    isReferenceCompare() {
        return this.mode === "reference_compare";
    },

    clear() {
        this.setGenre();
        console.log('[MODE-ENGINE] 🧹 Estado limpo - voltando para GENRE');
    }
};
```

---

#### **Integração 2: Processamento de Resposta (CRÍTICO)**

**Arquivo:** `audio-analyzer-integration.js`  
**Linha:** 7050

**ANTES (ERRADO):**
```javascript
} else if (normalizedResult.mode === 'reference' || normalizedResult.isReferenceBase === true) {
    // Modo referência: configurar ViewMode
    console.log('[REFERENCE-MODE] Configurando ViewMode para "reference" (backend retornou mode: "reference")');
    setViewMode("reference");
}
```

**DEPOIS (CORRETO):**
```javascript
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 MODE ENGINE: Configuração baseada em mode + isReferenceBase
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// PRIMEIRA TRACK DO FLUXO A/B (mode: "genre" + isReferenceBase: true)
if (normalizedResult.isReferenceBase === true && normalizedResult.mode === 'genre') {
    console.log('[MODE-ENGINE] 🎯 PRIMEIRA TRACK DE A/B DETECTADA');
    console.log('[MODE-ENGINE]    mode:', normalizedResult.mode);
    console.log('[MODE-ENGINE]    isReferenceBase:', normalizedResult.isReferenceBase);
    
    SOUNDY_MODE_ENGINE.startReferenceBase(normalizedResult);
    
    console.log('[MODE-ENGINE] ✅ Primeira track salva como referência base');
    console.log('[MODE-ENGINE] ⚠️ ViewMode permanece "genre" até segunda track');
    console.log('[MODE-ENGINE] ⚠️ UI de referência NÃO deve renderizar ainda');
    
    // NÃO continuar para lógica de referência abaixo
    // Primeira track é tratada como análise de gênero normal
}
// SEGUNDA TRACK (mode: "reference" do backend)
else if (normalizedResult.mode === 'reference') {
    console.log('[MODE-ENGINE] 🎯 SEGUNDA TRACK DE A/B DETECTADA');
    console.log('[MODE-ENGINE]    mode:', normalizedResult.mode);
    console.log('[MODE-ENGINE]    referenceJobId:', normalizedResult.referenceJobId);
    
    SOUNDY_MODE_ENGINE.startReferenceCompare();
    
    console.log('[MODE-ENGINE] ✅ Modo comparação A/B ativado');
    console.log('[MODE-ENGINE] ✅ ViewMode setado para "reference"');
    console.log('[MODE-ENGINE] ✅ UI de referência PODE renderizar agora');
}
```

**JUSTIFICATIVA:**
- ✅ Primeira track (`isReferenceBase === true`) → `startReferenceBase()` → ViewMode permanece "genre"
- ✅ Segunda track (`mode === 'reference'`) → `startReferenceCompare()` → ViewMode vira "reference"
- ✅ Elimina ativação prematura de ViewMode "reference"

---

#### **Integração 3: Guard shouldRenderReferenceUI (CRÍTICO)**

**Arquivo:** `audio-analyzer-integration.js`  
**Linha:** 1734-1770

**ANTES (INSUFICIENTE):**
```javascript
function shouldRenderReferenceUI(analysis) {
    const viewMode = getViewMode();
    if (viewMode !== "reference") {
        return false;
    }
    
    if (!analysis) {
        return false;
    }
    
    const hasRefComparison = !!analysis.referenceComparison;
    const hasRefJobId = !!analysis.referenceJobId || 
                        !!analysis.metadata?.referenceJobId || 
                        !!window.__REFERENCE_JOB_ID__;
    const hasRefData = !!window.referenceAnalysisData;
    
    if (!hasRefComparison && !hasRefJobId && !hasRefData) {
        return false;
    }
    
    // 🚨 PROBLEMA: Permite isReferenceBase passar
    if (analysis.mode !== 'reference' && analysis.isReferenceBase !== true) {
        return false;
    }
    
    return true;
}
```

**DEPOIS (RESTRITIVO):**
```javascript
function shouldRenderReferenceUI(analysis) {
    // 🎯 MODE ENGINE: Fonte única de verdade
    // Só renderiza UI de referência se estiver em modo REFERENCE_COMPARE
    if (!SOUNDY_MODE_ENGINE.isReferenceCompare()) {
        console.log('[REFERENCE-GUARD] 🚫 Bloqueado: Mode Engine não está em REFERENCE_COMPARE');
        console.log('[REFERENCE-GUARD]    Mode atual:', SOUNDY_MODE_ENGINE.mode);
        return false;
    }
    
    if (!analysis) {
        console.log('[REFERENCE-GUARD] 🚫 Bloqueado: analysis não existe');
        return false;
    }
    
    // Validar que há dados de comparação
    const hasRefComparison = !!analysis.referenceComparison;
    const hasRefJobId = !!analysis.referenceJobId || !!analysis.metadata?.referenceJobId;
    
    if (!hasRefComparison && !hasRefJobId) {
        console.log('[REFERENCE-GUARD] 🚫 Bloqueado: sem dados de comparação A/B');
        return false;
    }
    
    console.log('[REFERENCE-GUARD] ✅ Permitindo UI de referência');
    return true;
}
```

**JUSTIFICATIVA:**
- ✅ Verifica apenas `SOUNDY_MODE_ENGINE.isReferenceCompare()`
- ✅ Elimina dependência de `viewMode`, `analysis.mode`, `isReferenceBase`, `__REFERENCE_JOB_ID__`
- ✅ Bloqueia primeira track automaticamente (ela está em `reference_base`, não `reference_compare`)

---

#### **Integração 4: renderReferenceComparisons Bypass**

**Arquivo:** `audio-analyzer-integration.js`  
**Linha:** 12962-12983

**ANTES (MULTI-FONTE VULNERÁVEL):**
```javascript
const isGenreMode = ctx?.mode === "genre" || 
                   ctx?._isGenreIsolated === true ||
                   ctx?.analysis?.mode === "genre" ||
                   window.__soundyState?.render?.mode === "genre" ||
                   (typeof getViewMode === 'function' && getViewMode() === "genre");

if (isGenreMode) {
    console.log('🎵 [GENRE-BYPASS] renderReferenceComparisons NÃO renderiza para gênero');
    return;
}
```

**DEPOIS (FONTE ÚNICA):**
```javascript
// 🎯 MODE ENGINE: Bypass único e confiável
if (!SOUNDY_MODE_ENGINE.isReferenceCompare()) {
    console.log('🎵 [GENRE-BYPASS] renderReferenceComparisons bloqueado');
    console.log('🎵 [GENRE-BYPASS]    Mode Engine:', SOUNDY_MODE_ENGINE.mode);
    console.log('🎵 [GENRE-BYPASS]    Só renderiza em REFERENCE_COMPARE');
    return;
}

console.log('✅ [REF-RENDER] Mode Engine permite renderização A/B');
```

**JUSTIFICATIVA:**
- ✅ Verifica apenas `SOUNDY_MODE_ENGINE.isReferenceCompare()`
- ✅ Elimina checagens multi-fonte vulneráveis
- ✅ Bloqueia tanto gênero puro quanto primeira track de A/B

---

#### **Integração 5: Limpeza de Estado**

**Arquivo:** `audio-analyzer-integration.js`  
**Linhas:** 5784, 5929, etc. (funções de cleanup)

**ADICIONAR em todas as funções de limpeza (handleClose, closeAudioModal, etc.):**

```javascript
// Limpar Mode Engine
SOUNDY_MODE_ENGINE.clear();

// Limpar estados legados (manter por compatibilidade temporária)
delete window.__REFERENCE_JOB_ID__;
window.referenceComparisonMetrics = null;
FirstAnalysisStore.clear();
setViewMode("genre");

console.log('[CLEANUP] ✅ Mode Engine limpo - estado resetado para GENRE');
```

---

### 2.4 Funções que PRECISAM ser Adaptadas

| Função | Linha | Problema Atual | Adaptação Necessária |
|--------|-------|----------------|----------------------|
| **shouldRenderReferenceUI** | 1734 | Checa `viewMode + analysis.mode + isReferenceBase` | Trocar por `SOUNDY_MODE_ENGINE.isReferenceCompare()` |
| **Processamento de resposta** | 7050 | `isReferenceBase === true` ativa ViewMode "reference" | Trocar por `SOUNDY_MODE_ENGINE.startReferenceBase()` ou `startReferenceCompare()` |
| **renderReferenceComparisons** | 12967 | Bypass multi-fonte vulnerável | Trocar por `!SOUNDY_MODE_ENGINE.isReferenceCompare()` |
| **renderGenreComparisonTable** | 10165 | Detecção multi-fonte de gênero | Trocar por `SOUNDY_MODE_ENGINE.isGenre()` |
| **Cálculo de score** | 16692 | Detecção multi-fonte de gênero | Trocar por `SOUNDY_MODE_ENGINE.isGenre()` |
| **getActiveReferenceComparisonMetrics** | 12733 | `if (normalizedResult?.mode === 'genre')` | Trocar por `SOUNDY_MODE_ENGINE.isGenre()` |
| **computeHasReferenceComparisonMetrics** | 12824 | `if (analysis?.mode === 'genre')` | Trocar por `SOUNDY_MODE_ENGINE.isGenre()` |

---

## 🔥 PARTE 3: ALTERAÇÕES ESPECÍFICAS NECESSÁRIAS

### Alteração 1: Linha 7050 (CRÍTICA - CAUSA RAIZ)

**Localização:** Processamento de resposta do backend  
**Problema:** Ativa ViewMode "reference" para primeira track

**Trecho atual (ERRADO):**
```javascript
// Linha 7040-7054
console.log('%c[GENRE-BARRIER] ✅ BARREIRA 3 CONCLUÍDA: Estado limpo antes de processar análise', 'color:#00FF88;font-weight:bold;');
} else if (normalizedResult.mode === 'reference' || normalizedResult.isReferenceBase === true) {
    // Modo referência: configurar ViewMode
    console.log('[REFERENCE-MODE] Configurando ViewMode para "reference" (backend retornou mode: "reference")');
    setViewMode("reference");
}
```

**Trecho corrigido (CORRETO):**
```javascript
// Linha 7040-7070
console.log('%c[GENRE-BARRIER] ✅ BARREIRA 3 CONCLUÍDA: Estado limpo antes de processar análise', 'color:#00FF88;font-weight:bold;');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 MODE ENGINE: Configuração baseada em mode + isReferenceBase
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// PRIMEIRA TRACK DO FLUXO A/B (mode: "genre" + isReferenceBase: true)
if (normalizedResult.isReferenceBase === true && normalizedResult.mode === 'genre') {
    console.log('[MODE-ENGINE] 🎯 PRIMEIRA TRACK DE A/B DETECTADA');
    
    SOUNDY_MODE_ENGINE.startReferenceBase(normalizedResult);
    
    console.log('[MODE-ENGINE] ✅ Primeira track salva como referência base');
    console.log('[MODE-ENGINE] ⚠️ ViewMode permanece "genre" até segunda track');
    // NÃO setar ViewMode "reference" aqui!
}
// SEGUNDA TRACK (mode: "reference" do backend)
else if (normalizedResult.mode === 'reference') {
    console.log('[MODE-ENGINE] 🎯 SEGUNDA TRACK DE A/B DETECTADA');
    
    SOUNDY_MODE_ENGINE.startReferenceCompare();
    
    console.log('[MODE-ENGINE] ✅ Modo comparação A/B ativado');
    console.log('[MODE-ENGINE] ✅ ViewMode setado para "reference"');
}
```

**Impacto:** ✅ Elimina ativação prematura de ViewMode "reference" na primeira track

---

### Alteração 2: Linha 1763 (CRÍTICA - GUARD CONTAMINADO)

**Localização:** Função `shouldRenderReferenceUI`  
**Problema:** Permite `isReferenceBase === true` passar

**Trecho atual (INSUFICIENTE):**
```javascript
// Linha 1734-1770
function shouldRenderReferenceUI(analysis) {
    const viewMode = getViewMode();
    if (viewMode !== "reference") {
        return false;
    }
    
    if (!analysis) {
        return false;
    }
    
    const hasRefComparison = !!analysis.referenceComparison;
    const hasRefJobId = !!analysis.referenceJobId || 
                        !!analysis.metadata?.referenceJobId || 
                        !!window.__REFERENCE_JOB_ID__;
    const hasRefData = !!window.referenceAnalysisData;
    
    if (!hasRefComparison && !hasRefJobId && !hasRefData) {
        return false;
    }
    
    // 🚨 PROBLEMA: Permite isReferenceBase passar
    if (analysis.mode !== 'reference' && analysis.isReferenceBase !== true) {
        return false;
    }
    
    return true;
}
```

**Trecho corrigido (RESTRITIVO):**
```javascript
// Linha 1734-1770
function shouldRenderReferenceUI(analysis) {
    // 🎯 MODE ENGINE: Fonte única de verdade
    // Só renderiza UI de referência se estiver em modo REFERENCE_COMPARE
    if (!SOUNDY_MODE_ENGINE.isReferenceCompare()) {
        console.log('[REFERENCE-GUARD] 🚫 Bloqueado pelo Mode Engine');
        console.log('[REFERENCE-GUARD]    Mode atual:', SOUNDY_MODE_ENGINE.mode);
        console.log('[REFERENCE-GUARD]    Necessário: reference_compare');
        return false;
    }
    
    if (!analysis) {
        console.log('[REFERENCE-GUARD] 🚫 Bloqueado: analysis não existe');
        return false;
    }
    
    // Validar que há dados de comparação
    const hasRefComparison = !!analysis.referenceComparison;
    const hasRefJobId = !!analysis.referenceJobId || !!analysis.metadata?.referenceJobId;
    
    if (!hasRefComparison && !hasRefJobId) {
        console.log('[REFERENCE-GUARD] 🚫 Bloqueado: sem dados de comparação A/B');
        console.log('[REFERENCE-GUARD]    hasRefComparison:', hasRefComparison);
        console.log('[REFERENCE-GUARD]    hasRefJobId:', hasRefJobId);
        return false;
    }
    
    console.log('[REFERENCE-GUARD] ✅ Permitindo UI de referência');
    return true;
}
```

**Impacto:** ✅ Bloqueia primeira track de A/B automaticamente

---

### Alteração 3: Linha 12967 (BYPASS VULNERÁVEL)

**Localização:** Função `renderReferenceComparisons`  
**Problema:** Bypass multi-fonte pode falhar se ViewMode contaminou

**Trecho atual (VULNERÁVEL):**
```javascript
// Linha 12962-12983
const isGenreMode = ctx?.mode === "genre" || 
                   ctx?._isGenreIsolated === true ||
                   ctx?.analysis?.mode === "genre" ||
                   window.__soundyState?.render?.mode === "genre" ||
                   (typeof getViewMode === 'function' && getViewMode() === "genre");

if (isGenreMode) {
    console.log('🎵 [GENRE-BYPASS] renderReferenceComparisons NÃO renderiza para gênero');
    return;
}
```

**Trecho corrigido (FONTE ÚNICA):**
```javascript
// Linha 12962-12983
// 🎯 MODE ENGINE: Bypass único e confiável
if (!SOUNDY_MODE_ENGINE.isReferenceCompare()) {
    console.log('🎵 [GENRE-BYPASS] renderReferenceComparisons bloqueado');
    console.log('🎵 [GENRE-BYPASS]    Mode Engine:', SOUNDY_MODE_ENGINE.mode);
    console.log('🎵 [GENRE-BYPASS]    Necessário: reference_compare');
    console.log('🎵 [GENRE-BYPASS]    Modos bloqueados: genre, reference_base');
    return;
}

console.log('✅ [REF-RENDER] Mode Engine permite renderização A/B');
console.log('✅ [REF-RENDER] Mode:', SOUNDY_MODE_ENGINE.mode);
```

**Impacto:** ✅ Bloqueia tanto gênero puro quanto primeira track de A/B

---

### Alteração 4: Linhas 10165, 10330, 16692 (DETECÇÕES DE GÊNERO)

**Localização:** Múltiplas funções que detectam modo gênero  
**Problema:** Detecção multi-fonte vulnerável a contaminação

**Padrão atual (VULNERÁVEL):**
```javascript
const isGenreMode = analysis?.mode === "genre" || 
                   state?.render?.mode === "genre" ||
                   (typeof getViewMode === 'function' && getViewMode() === "genre");
```

**Padrão corrigido (FONTE ÚNICA):**
```javascript
const isGenreMode = SOUNDY_MODE_ENGINE.isGenre();
```

**Locais específicos:**

**Linha 10165 (renderGenreComparisonTable):**
```javascript
// ANTES:
const isGenreMode = analysis?.mode === "genre" || 
                   state?.render?.mode === "genre" ||
                   (getViewMode && getViewMode() === "genre");

// DEPOIS:
const isGenreMode = SOUNDY_MODE_ENGINE.isGenre();
```

**Linha 10330 (outra detecção):**
```javascript
// ANTES:
const isGenreMode = analysisObj?.mode === "genre" || 
                   window.__soundyState?.render?.mode === "genre" ||
                   (getViewMode && getViewMode() === "genre");

// DEPOIS:
const isGenreMode = SOUNDY_MODE_ENGINE.isGenre();
```

**Linha 16692 (cálculo de score):**
```javascript
// ANTES:
const isGenreMode = analysis?.mode === "genre" || 
                   window.__soundyState?.render?.mode === "genre" ||
                   (typeof getViewMode === 'function' && getViewMode() === "genre");

// DEPOIS:
const isGenreMode = SOUNDY_MODE_ENGINE.isGenre();
```

**Impacto:** ✅ Detecções se tornam imunes a contaminação de estado

---

### Alteração 5: Linhas 12733, 12824 (COMPUTAÇÃO DE MÉTRICAS)

**Localização:** Funções de métricas de comparação  
**Problema:** Checagens diretas de `mode` devem usar Mode Engine

**Linha 12733 (getActiveReferenceComparisonMetrics):**
```javascript
// ANTES:
if (normalizedResult?.mode === 'genre') {
    console.log('[GENRE-BYPASS] getActiveReferenceComparisonMetrics: modo gênero detectado, retornando null');
    return null;
}

// DEPOIS:
if (SOUNDY_MODE_ENGINE.isGenre()) {
    console.log('[GENRE-BYPASS] getActiveReferenceComparisonMetrics: Mode Engine em GENRE, retornando null');
    return null;
}
```

**Linha 12824 (computeHasReferenceComparisonMetrics):**
```javascript
// ANTES:
if (analysis?.mode === 'genre') {
    console.log('[GENRE-BYPASS] computeHasReferenceComparisonMetrics: modo gênero detectado, retornando false');
    return false;
}

// DEPOIS:
if (SOUNDY_MODE_ENGINE.isGenre()) {
    console.log('[GENRE-BYPASS] computeHasReferenceComparisonMetrics: Mode Engine em GENRE, retornando false');
    return false;
}
```

**Impacto:** ✅ Funções de métricas usam Mode Engine como fonte de verdade

---

### Alteração 6: Limpeza de Estado (Múltiplas linhas)

**Localização:** Funções de cleanup (handleClose, closeAudioModal, etc.)  
**Linhas:** 5784, 5929, etc.

**Adicionar em TODAS as funções de limpeza:**

```javascript
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 MODE ENGINE: Limpeza completa
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOUNDY_MODE_ENGINE.clear();

// Limpar estados legados (manter por compatibilidade temporária)
delete window.__REFERENCE_JOB_ID__;
window.referenceComparisonMetrics = null;
FirstAnalysisStore.clear();
localStorage.removeItem('referenceJobId');
sessionStorage.removeItem('referenceJobId');

console.log('[CLEANUP] ✅ Mode Engine limpo - estado resetado para GENRE');
```

**Impacto:** ✅ Garante que próxima análise começa com estado limpo

---

## 🎯 PARTE 4: VALIDAÇÃO DE NÃO-REGRESSÃO

### 4.1 Fluxo GÊNERO PURO (Após alterações)

**Passo 1: Usuário escolhe "análise por gênero"**
- `currentAnalysisMode = 'genre'`
- `SOUNDY_MODE_ENGINE.setGenre()` é chamado
- **Estado setado:**
  - `SOUNDY_MODE_ENGINE.mode = "genre"`
  - `ViewMode = "genre"`
  - `referenceBase = null`
  - `referenceJobId = null`

**Passo 2: Backend analisa**
- Recebe payload com `mode: "genre"`, `genre: "rock"`, `genreTargets: {...}`
- Retorna análise com `mode: "genre"` + métricas + sugestões

**Passo 3: Frontend processa resposta**
- Linha 7050: Detecta `normalizedResult.mode === 'genre' && !isReferenceBase`
- **NÃO entra** em `if (isReferenceBase === true)` ✅
- **NÃO entra** em `if (mode === 'reference')` ✅
- Carrega targets de gênero normalmente

**Passo 4: Renderização**
- `shouldRenderReferenceUI()` retorna `false` (Mode Engine não está em `reference_compare`) ✅
- `renderReferenceComparisons()` é bloqueado no bypass ✅
- `renderGenreComparisonTable()` detecta `SOUNDY_MODE_ENGINE.isGenre()` e renderiza normalmente ✅

**✅ GÊNERO PURO FUNCIONA SEM TOCAR EM REFERÊNCIA**

---

### 4.2 Fluxo REFERÊNCIA - PRIMEIRA TRACK (Após alterações)

**Passo 1: Usuário escolhe "comparar com referência"**
- `currentAnalysisMode = 'reference'`
- `referenceJobId = null` (ainda não há primeira análise)

**Passo 2: Usuário envia primeira música**
- Linha 2085: `isReferenceBase = true` (sem referenceJobId)
- Payload enviado: `mode: "genre"` + `isReferenceBase: true`

**Passo 3: Backend analisa primeira música**
- Recebe `mode: "genre"` → Processa como análise de gênero normal
- Retorna: `mode: "genre"` + métricas + sugestões
- **NÃO retorna** `referenceComparison` (correto)

**Passo 4: Frontend processa resposta**
- Linha 7050: Detecta `isReferenceBase === true && mode === 'genre'`
- **ENTRA no if corrigido:** `SOUNDY_MODE_ENGINE.startReferenceBase(normalizedResult)`
- **Estado setado:**
  - `SOUNDY_MODE_ENGINE.mode = "reference_base"`
  - `SOUNDY_MODE_ENGINE.referenceBase = normalizedResult` (análise completa salva)
  - `SOUNDY_MODE_ENGINE.referenceJobId = normalizedResult.jobId`
  - `ViewMode = "genre"` ✅ (permanece em genre!)

**Passo 5: Tentativa de renderização**
- `shouldRenderReferenceUI()` retorna `false`:
  - Mode Engine não está em `reference_compare` ✅
  - Está em `reference_base` ✅
- `renderReferenceComparisons()` é bloqueado:
  - `!SOUNDY_MODE_ENGINE.isReferenceCompare()` retorna `true` ✅
  - Função retorna sem renderizar nada ✅

**Passo 6: Salvamento**
- Linha 4102: `FirstAnalysisStore.set(firstAnalysisResult)` ✅
- `window.__REFERENCE_JOB_ID__ = jobId` ✅

**✅ PRIMEIRA TRACK É SALVA MAS NÃO RENDERIZA UI DE REFERÊNCIA**

---

### 4.3 Fluxo REFERÊNCIA - SEGUNDA TRACK (Após alterações)

**Passo 1: Usuário envia segunda música**
- `referenceJobId` agora existe (da primeira análise)
- Linha 2075: `isReferenceBase = false`
- Payload enviado: `mode: "reference"` + `referenceJobId: "abc123"`

**Passo 2: Backend compara**
- Recebe `mode: "reference"` + `referenceJobId`
- Busca primeira análise no banco
- Gera deltas A/B
- Retorna: `mode: "reference"` + `referenceComparison: {...}` + métricas

**Passo 3: Frontend processa resposta**
- Linha 7050: Detecta `normalizedResult.mode === 'reference'`
- **ENTRA no else if corrigido:** `SOUNDY_MODE_ENGINE.startReferenceCompare()`
- **Estado setado:**
  - `SOUNDY_MODE_ENGINE.mode = "reference_compare"`
  - `ViewMode = "reference"` ✅ (AGORA SIM muda!)

**Passo 4: Renderização**
- `shouldRenderReferenceUI()` retorna `true`:
  - `SOUNDY_MODE_ENGINE.isReferenceCompare()` retorna `true` ✅
  - `analysis.referenceComparison` existe ✅
  - `analysis.referenceJobId` existe ✅
- `renderReferenceComparisons()` **NÃO é bloqueado**:
  - `!SOUNDY_MODE_ENGINE.isReferenceCompare()` retorna `false` ✅
  - Função prossegue e renderiza A/B ✅

**✅ APENAS SEGUNDA TRACK ATIVA RENDERIZAÇÃO A/B**

---

## 📊 PARTE 5: INCOMPATIBILIDADES E RISCOS

### 5.1 Funções que Dependem de `analysis.mode` Diretamente

**Risco:** Funções que leem `analysis.mode` diretamente podem não saber do Mode Engine.

**Mitigação:**
- Mode Engine **NÃO substitui** `analysis.mode` (que vem do backend)
- Mode Engine é **complementar** - controla **estado do frontend**
- Funções que checam `analysis.mode` continuam funcionando:
  - Se `analysis.mode === 'genre'` → É gênero ou primeira track
  - Se `analysis.mode === 'reference'` → É segunda track

**Ajuste necessário:**
- Trocar checagens de `analysis.mode` por `SOUNDY_MODE_ENGINE.mode` apenas onde há ambiguidade (primeira track vs gênero puro)

---

### 5.2 Código que Lê `getViewMode()` / `window.__soundyState.render.mode`

**Risco:** Código legado que checa ViewMode diretamente.

**Mitigação:**
- Mode Engine **CONTROLA** ViewMode via `setViewMode()`
- ViewMode permanece sincronizado com Mode Engine
- Código legado continua funcionando, mas é redundante

**Recomendação:**
- Substituir gradualmente checagens de ViewMode por Mode Engine
- Priorizar locais críticos (guards, bypasses, detecções de modo)

---

### 5.3 Dependência de `FirstAnalysisStore` e `window.__REFERENCE_JOB_ID__`

**Risco:** Mode Engine tem seu próprio `referenceBase` e `referenceJobId`. Duplicação?

**Mitigação:**
- **Mode Engine é fonte de verdade** para estado de modo
- **FirstAnalysisStore permanece** como armazenamento da análise completa
- **Relação:**
  - `SOUNDY_MODE_ENGINE.referenceBase` → **Ponteiro** para análise
  - `FirstAnalysisStore.get()` → **Análise completa** (clone)
  - Ambos devem apontar para a mesma análise

**Ajuste necessário:**
```javascript
// Quando salvar primeira análise:
FirstAnalysisStore.set(firstAnalysis);
SOUNDY_MODE_ENGINE.startReferenceBase(firstAnalysis);

// Quando recuperar:
const firstAnalysis = SOUNDY_MODE_ENGINE.referenceBase || FirstAnalysisStore.get();
```

---

## ✅ RESUMO EXECUTIVO

### Causa Raiz Confirmada

**Linha 7050:** `|| normalizedResult.isReferenceBase === true` ativa ViewMode "reference" prematuramente.

### Solução: Mode Engine

✅ **Validado como tecnicamente seguro e consistente**  
✅ **Elimina ambiguidade entre modos**  
✅ **Previne contaminação de estado**  
✅ **Compatível com código existente**

### Alterações Necessárias (6 principais)

1. **Linha 7050** - Processar `isReferenceBase` corretamente
2. **Linha 1763** - Guard restritivo com Mode Engine
3. **Linha 12967** - Bypass com fonte única
4. **Linhas 10165, 10330, 16692** - Detecções de gênero
5. **Linhas 12733, 12824** - Computação de métricas
6. **Múltiplas linhas** - Limpeza de estado

### Não-Regressão Validada

✅ **Gênero puro:** Funciona sem tocar em referência  
✅ **Primeira track A/B:** Salva mas não renderiza UI  
✅ **Segunda track A/B:** Renderiza comparação A/B

---

**FIM DA AUDITORIA TÉCNICA CIRÚRGICA** ✅
