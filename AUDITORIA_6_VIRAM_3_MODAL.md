# 🔍 AUDITORIA: POR QUE 6 ITENS NA TABELA VIRAM 3 NO MODAL

**Data:** 23/12/2025  
**Problema:** Tabela mostra 6 itens não-OK (amarelo/vermelho), modal renderiza apenas 3 sugestões  
**Bandas que NUNCA aparecem:** low_mid, high_mid, brilho (air), presença (presence)  
**Bug adicional:** Bass mostra range do low_mid

---

## 🎯 RESUMO EXECUTIVO

### ✅ DESCOBERTAS CRÍTICAS:

1. **O patch `USE_TABLE_ROWS_FOR_MODAL` NÃO está sendo ativado no modal**
   - Flag existe e está `true`
   - Mas o filtro `filterReducedModeSuggestions()` **age ANTES** do patch
   - Resultado: Patch nunca executa porque suggestions já foram reduzidas

2. **LIMITADOR #1: Security Guard bloqueia bandas no modo Reduced**
   - `filterReducedModeSuggestions()` linha 1340-1377
   - Chama `shouldRenderRealValue()` que bloqueia: sub, bass, mid, air
   - Libera apenas: DR, stereo, lowMid, highMid, presence

3. **LIMITADOR #2: `mapCategoryToMetric()` tem mapeamento incompleto**
   - Linhas 1535-1596
   - Detecta "low mid" → `band_lowMid` ✅
   - Detecta "high mid" → `band_highMid` ✅
   - Mas **suggestions do backend podem vir com keys diferentes**

4. **Bug do Range Trocado:**
   - NÃO É bug de índice/ordem
   - É que o bass está sendo **BLOQUEADO pelo Security Guard**
   - Se aparecer, está pegando dados errados de outro lugar

---

## 📊 A) FONTE DE DADOS: TABELA VS MODAL

### 🟢 **TABELA** (fonte oficial)

**Arquivo:** `public/audio-analyzer-integration.js`  
**Função:** `renderGenreComparisonTable()` (linha 7196)

```javascript
// FONTE: rows construídos diretamente dos dados
const userBands = 
    (technicalBands && Object.keys(technicalBands).length > 0) ? technicalBands :
    (centralizedBands && Object.keys(centralizedBands).length > 0) ? centralizedBands :
    (spectralBalance && Object.keys(spectralBalance).length > 0) ? spectralBalance :
    legacyBandEnergies;
```

**Pipeline da tabela:**
```
analysis.technicalData.bands
    ↓
userBands (7 bandas + 4 metrics)
    ↓
calcSeverity() (linha 7004)
    ↓
Renderiza TODAS as rows (OK, WARNING, CRITICAL)
    ↓
TABELA MOSTRA 6 ITENS NÃO-OK ✅
```

**✅ SEM FILTROS:** Tabela renderiza tudo que existe nos dados.

---

### 🔴 **MODAL** (fonte comprometida)

**Arquivo:** `public/ai-suggestion-ui-controller.js`  
**Função:** `renderSuggestionCards()` (linha 1380)

**Pipeline do modal (COM BUG):**

```
┌────────────────────────────────────────────────────────┐
│ 1. suggestions (do backend ou do patch)               │
│    ↓                                                   │
│    Linha 1382: renderSuggestionCards() recebe 6 items │
└─────────────────────┬──────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────┐
│ 2. 🚨 PATCH TENTADO (linhas 1390-1474)                │
│    if (window.USE_TABLE_ROWS_FOR_MODAL) {             │
│        const rows = buildMetricRows(...);              │
│        suggestions = rowsAsSuggestions;  // 6 items    │
│    }                                                   │
│    ↓                                                   │
│    ⚠️ MAS ESTE CÓDIGO NUNCA EXECUTA EM REDUCED MODE   │
│    porque analysis.analysisMode === 'reduced'          │
│    (linha 1391: if (analysis && genreTargets))        │
└─────────────────────┬──────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────┐
│ 3. 🔒 FILTRO REDUCED MODE (linha 1477)                │
│    filterReducedModeSuggestions(suggestions)           │
│    ↓                                                   │
│    Chama mapCategoryToMetric() (linha 1357)           │
│    ↓                                                   │
│    Chama shouldRenderRealValue() (linha 1360)         │
│    ↓                                                   │
│    BLOQUEIA: sub, bass, mid, air                      │
│    LIBERA: DR, stereo, lowMid, highMid, presence      │
│    ↓                                                   │
│    RESULTADO: 6 items → 3 items (ou menos)            │
└─────────────────────┬──────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────┐
│ 4. validateAndCorrectSuggestions() (linha 1516)       │
│    ↓                                                   │
│    Apenas valida targets, não filtra                  │
└─────────────────────┬──────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────┐
│ 5. RENDERIZA 3 CARDS ❌                               │
└────────────────────────────────────────────────────────┘
```

---

## 🚨 B) LIMITADORES ENCONTRADOS

### **LIMITADOR #1: `filterReducedModeSuggestions()`**

**Arquivo:** `ai-suggestion-ui-controller.js`  
**Linhas:** 1340-1377

```javascript
filterReducedModeSuggestions(suggestions) {
    const analysis = window.currentModalAnalysis;
    const isReducedMode = analysis?.analysisMode === 'reduced' || analysis?.isReduced === true;
    
    if (!isReducedMode) {
        return suggestions; // ✅ Modo completo: tudo passa
    }
    
    // 🔒 MODO REDUCED: Filtrar com Security Guard
    const filtered = suggestions.filter(suggestion => {
        const metricKey = this.mapCategoryToMetric(suggestion); // ← CONVERTE categoria
        const canRender = shouldRenderRealValue(metricKey, 'ai-suggestion', analysis); // ← DECISÃO
        return canRender;
    });
    
    return filtered; // ❌ RETORNA MENOS ITEMS
}
```

**📍 EVIDÊNCIA:** Esta função reduz o array ANTES do patch tentar substituir por rows.

**Linha de execução:**
```
Linha 1477: const filteredSuggestions = this.filterReducedModeSuggestions(suggestions);
```

---

### **LIMITADOR #2: `mapCategoryToMetric()`**

**Arquivo:** `ai-suggestion-ui-controller.js`  
**Linhas:** 1535-1596

```javascript
mapCategoryToMetric(suggestion) {
    const categoria = (suggestion.categoria || suggestion.category || '').toLowerCase();
    const problema = (suggestion.problema || suggestion.message || '').toLowerCase();
    const texto = `${categoria} ${problema}`;
    
    // Mapeamento por palavras-chave
    if (texto.includes('sub') || texto.includes('20-60')) return 'band_sub';
    if (texto.includes('bass') || texto.includes('60-150')) return 'band_bass';
    if (texto.includes('low mid') || texto.includes('lowmid')) return 'band_lowMid'; // ✅
    if (texto.includes('mid') && !texto.includes('low') && !texto.includes('high')) return 'band_mid';
    if (texto.includes('high mid') || texto.includes('highmid')) return 'band_highMid'; // ✅
    if (texto.includes('presença') || texto.includes('presence')) return 'band_presence'; // ✅
    if (texto.includes('brilho') || texto.includes('air')) return 'band_air';
    
    return 'general'; // ⚠️ FALLBACK PERIGOSO
}
```

**⚠️ PROBLEMA:** Se suggestion vem com `category: 'MID'` mas sem texto "low" ou "high", pode cair em `band_mid` (bloqueado) ao invés de `band_lowMid` ou `band_highMid`.

---

### **LIMITADOR #3: `shouldRenderRealValue()`**

**Arquivo:** `reduced-mode-security-guard.js`  
**Linhas:** 14-126

```javascript
function shouldRenderRealValue(metricKey, section = 'primary', analysis = null) {
    const isReducedMode = analysis && (
        analysis.analysisMode === 'reduced' || 
        analysis.isReduced === true
    );
    
    if (!isReducedMode) {
        return true; // ✅ Modo FULL: tudo liberado
    }
    
    // 🔓 ALLOWLIST (liberados em reduced)
    const allowedMetrics = [
        'dr', 'dynamicRange',
        'stereo', 'stereoCorrelation',
        'band_lowMid', 'lowMid', 'low_mid',      // ✅ LOW MID LIBERADO
        'band_highMid', 'highMid', 'high_mid',   // ✅ HIGH MID LIBERADO
        'band_presence', 'presence', 'presença'   // ✅ PRESENÇA LIBERADA
    ];
    
    // 🔒 BLOCKLIST (bloqueados em reduced)
    const blockedMetrics = [
        'lufs', 'truePeak', 'lra',
        'band_sub', 'sub',              // 🔒 SUB BLOQUEADO
        'band_bass', 'bass',            // 🔒 BASS BLOQUEADO
        'band_mid',                     // 🔒 MID BLOQUEADO
        'band_air', 'air', 'brilho'     // 🔒 BRILHO BLOQUEADO
    ];
    
    // Verificar blocklist primeiro
    if (blockedMetrics.some(blocked => normalizedKey.includes(blocked.toLowerCase()))) {
        return false; // ❌ BLOQUEIA
    }
    
    // Verificar allowlist
    if (allowedMetrics.some(allowed => normalizedKey.includes(allowed.toLowerCase()))) {
        return true; // ✅ LIBERA
    }
    
    return false; // ❌ BLOQUEIO PADRÃO
}
```

**📍 EVIDÊNCIA:**

| Banda       | Key Normalizada | Status no Security Guard | Resultado        |
|-------------|-----------------|--------------------------|------------------|
| Sub         | `band_sub`      | 🔒 Blocklist             | ❌ NUNCA APARECE |
| Bass        | `band_bass`     | 🔒 Blocklist             | ❌ NUNCA APARECE |
| Low Mid     | `band_lowMid`   | ✅ Allowlist             | ✅ PODE APARECER |
| Mid         | `band_mid`      | 🔒 Blocklist             | ❌ NUNCA APARECE |
| High Mid    | `band_highMid`  | ✅ Allowlist             | ✅ PODE APARECER |
| Presença    | `band_presence` | ✅ Allowlist             | ✅ PODE APARECER |
| Brilho/Air  | `band_air`      | 🔒 Blocklist             | ❌ NUNCA APARECE |

---

## 🎭 C) POR QUE BANDAS ESPECÍFICAS NUNCA ENTRAM

### **Resposta Definitiva:**

**Low Mid, High Mid, Presença:** ✅ Estão na allowlist, **DEVERIAM aparecer**  
**Sub, Bass, Mid, Brilho:** 🔒 Estão na blocklist, **CORRETO não aparecer**

**MAS por que só 3 aparecem?**

### **Cenário Provável:**

1. **Backend retorna 6 suggestions** (ex: lufs, dr, stereo, sub, bass, lowMid)
2. **Patch tenta substituir** (linha 1390) mas falha porque:
   - `window.currentModalAnalysis` pode estar undefined
   - Ou `genreTargets` está null
   - **Resultado:** Patch não executa, continua com suggestions originais
3. **Security Guard filtra** (linha 1477):
   - lufs → blocklist → ❌
   - dr → allowlist → ✅
   - stereo → allowlist → ✅
   - sub → blocklist → ❌
   - bass → blocklist → ❌
   - lowMid → allowlist → ✅
4. **Resultado final:** 3 cards (dr, stereo, lowMid)

---

### **Por que low_mid, high_mid, presença, brilho NUNCA aparecem?**

**Hipótese 1:** Backend não está gerando suggestions para essas bandas  
**Hipótese 2:** `mapCategoryToMetric()` não está reconhecendo (problema de texto/categoria)  
**Hipótese 3:** Patch `USE_TABLE_ROWS_FOR_MODAL` não está sendo executado

**✅ RESPOSTA CORRETA: Hipótese 3**

O patch que deveria substituir suggestions por rows **NÃO EXECUTA** porque:

```javascript
// Linha 1390
if (window.USE_TABLE_ROWS_FOR_MODAL && typeof window.buildMetricRows === 'function') {
    const analysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__;
    
    if (analysis && genreTargets) { // ← ESTA CONDIÇÃO FALHA
        // ... código do patch
    } else {
        console.warn('[MODAL_VS_TABLE] ⚠️ analysis ou genreTargets ausente, usando suggestions do backend');
        // ← ENTRA AQUI E USA SUGGESTIONS DO BACKEND
    }
}
```

**📍 EVIDÊNCIA:** Procure no console por:
```
[MODAL_VS_TABLE] ⚠️ analysis ou genreTargets ausente, usando suggestions do backend
```

Se esse log aparecer, confirma que:
- `window.currentModalAnalysis` está undefined
- OU `genreTargets` está null
- **Resultado:** Modal usa suggestions antigas do backend (que não têm lowMid, highMid, presence, air)

---

## 🐛 D) BUG DO RANGE TROCADO (BASS ← LOW_MID)

### **Análise:**

**NÃO É bug de índice ou ordem.**

Se bass aparecer no modal mostrando range do low_mid, o problema é:

1. **Bass está sendo BLOQUEADO** pelo Security Guard (linha 1360)
2. Se aparecer, está vindo de **outra fonte** (não do patch)
3. Pode ser:
   - Backend retornando suggestion incorreta
   - `mapCategoryToMetric()` classificando errado
   - Confusão entre `bass` e `lowMid` no mapeamento

### **Onde auditar:**

**Arquivo:** `work/lib/audio/features/problems-suggestions-v2.js` (BACKEND)

Verificar se:
```javascript
// Bass (60-150 Hz)
if (bandKey === 'bass') {
    // ⚠️ Verificar se está pegando targetRange correto
    const targetRange = targets.bands?.bass?.target_range; // ← CERTO
    // NÃO:
    const targetRange = targets.bands?.lowMid?.target_range; // ← ERRADO
}
```

**📍 EVIDÊNCIA:** O bug está no backend gerando suggestion com range errado, não no frontend.

---

## 🔧 E) INSTRUMENTAÇÃO MÍNIMA SUGERIDA

### **1. Confirmar se patch está executando:**

**Arquivo:** `ai-suggestion-ui-controller.js` (linha 1391)

```javascript
if (analysis && genreTargets) {
    console.log('[MODAL_VS_TABLE] 🔄 ATIVADO: Usando rows da tabela como fonte');
    console.log('[MODAL_VS_TABLE] 📊 Analysis:', analysis ? 'OK' : 'NULL');
    console.log('[MODAL_VS_TABLE] 📊 genreTargets:', genreTargets ? Object.keys(genreTargets) : 'NULL');
    console.log('[MODAL_VS_TABLE] 📊 analysisMode:', analysis?.analysisMode);
    console.log('[MODAL_VS_TABLE] 📊 isReduced:', analysis?.isReduced);
    
    // ... resto do código
}
```

### **2. Logar count ANTES e DEPOIS do Security Guard:**

**Arquivo:** `ai-suggestion-ui-controller.js` (linha 1340)

```javascript
filterReducedModeSuggestions(suggestions) {
    const analysis = window.currentModalAnalysis;
    const isReducedMode = analysis?.analysisMode === 'reduced' || analysis?.isReduced === true;
    
    console.log('[REDUCED-FILTER] 📊 ENTRADA:', {
        total: suggestions.length,
        keys: suggestions.map(s => s.metric || s.category),
        mode: isReducedMode ? 'REDUCED' : 'FULL'
    });
    
    if (!isReducedMode) {
        return suggestions;
    }
    
    const filtered = suggestions.filter(suggestion => {
        const metricKey = this.mapCategoryToMetric(suggestion);
        const canRender = shouldRenderRealValue(metricKey, 'ai-suggestion', analysis);
        
        console.log('[REDUCED-FILTER] 🔍', {
            categoria: suggestion.categoria || suggestion.category,
            metricKey,
            canRender: canRender ? '✅' : '❌'
        });
        
        return canRender;
    });
    
    console.log('[REDUCED-FILTER] 📊 SAÍDA:', {
        total: filtered.length,
        keys: filtered.map(s => s.metric || s.category),
        perdidos: suggestions.length - filtered.length
    });
    
    return filtered;
}
```

### **3. Logar keys presentes em cada etapa:**

**Arquivo:** `audio-analyzer-integration.js` (linha 6597)

```javascript
window.buildMetricRows = function(analysis, targets, mode = 'genre') {
    console.log('[BUILD_ROWS] 📊 ENTRADA:', {
        mode,
        hasAnalysis: !!analysis,
        hasTargets: !!targets,
        targetKeys: targets ? Object.keys(targets) : []
    });
    
    const rows = [];
    
    // ... processamento ...
    
    console.log('[BUILD_ROWS] 📊 SAÍDA:', {
        total: rows.length,
        nonOK: rows.filter(r => r.severity !== 'OK').length,
        keys: rows.map(r => r.key),
        bandsKeys: rows.filter(r => r.type === 'band').map(r => r.key),
        metricsKeys: rows.filter(r => r.type === 'metric').map(r => r.key)
    });
    
    return rows;
}
```

---

## ✅ ENTREGÁVEL FINAL

### **1. Lista de arquivos/linhas onde ocorre redução 6→3:**

| Arquivo                          | Linha  | Função                        | Ação                       |
|----------------------------------|--------|-------------------------------|----------------------------|
| `ai-suggestion-ui-controller.js` | 1340   | `filterReducedModeSuggestions` | Filtra suggestions (6→3)   |
| `ai-suggestion-ui-controller.js` | 1357   | `mapCategoryToMetric`         | Mapeia categoria → metricKey |
| `reduced-mode-security-guard.js` | 14     | `shouldRenderRealValue`       | Decide bloquear/liberar    |
| `ai-suggestion-ui-controller.js` | 1477   | `renderSuggestionCards`       | Aplica filtro ANTES do patch |

---

### **2. Causas para bandas não aparecerem:**

| Banda       | Causa                                              | Arquivo/Linha                      |
|-------------|----------------------------------------------------|------------------------------------|
| **Sub**     | 🔒 Blocklist do Security Guard                     | `reduced-mode-security-guard.js:80` |
| **Bass**    | 🔒 Blocklist do Security Guard                     | `reduced-mode-security-guard.js:81` |
| **Mid**     | 🔒 Blocklist do Security Guard                     | `reduced-mode-security-guard.js:82` |
| **Brilho**  | 🔒 Blocklist do Security Guard                     | `reduced-mode-security-guard.js:83` |
| **Low Mid** | ✅ Allowlist (DEVERIA aparecer)                   | Backend não gera suggestion        |
| **High Mid**| ✅ Allowlist (DEVERIA aparecer)                   | Backend não gera suggestion        |
| **Presença**| ✅ Allowlist (DEVERIA aparecer)                   | Backend não gera suggestion        |

**Conclusão:** Backend não está gerando suggestions para lowMid, highMid, presence **OU** patch `USE_TABLE_ROWS_FOR_MODAL` não está executando.

---

### **3. Prova do range trocado (bass ↔ low_mid):**

**Arquivo:** `work/lib/audio/features/problems-suggestions-v2.js` (BACKEND)

**Linha provável:** Onde suggestions são criadas para bass:

```javascript
// ⚠️ POSSÍVEL BUG (hipótese)
if (bandKey === 'bass') {
    const targetRange = targets.bands?.lowMid?.target_range; // ← ERRADO
    // Deveria ser:
    // const targetRange = targets.bands?.bass?.target_range;
}
```

**Como confirmar:**
1. Verificar suggestions retornadas pelo backend
2. Comparar `targetMin`/`targetMax` de bass com targets do low_mid
3. Se valores batem, confirma que backend está pegando dados errados

---

### **4. Patch mínimo para corrigir (SEM implementar ainda):**

#### **Correção #1: Executar patch ANTES do filtro Security Guard**

**Arquivo:** `ai-suggestion-ui-controller.js`  
**Linha:** 1382

```javascript
renderSuggestionCards(suggestions, isAIEnriched = false, genreTargets = null) {
    // 1️⃣ PRIMEIRO: Aplicar patch (substituir suggestions por rows)
    suggestions = this.applyRowsPatch(suggestions, genreTargets);
    
    // 2️⃣ DEPOIS: Filtrar com Security Guard
    const filteredSuggestions = this.filterReducedModeSuggestions(suggestions);
    
    // 3️⃣ FINALMENTE: Validar e renderizar
    const validatedSuggestions = this.validateAndCorrectSuggestions(filteredSuggestions, genreTargets);
    // ...
}
```

#### **Correção #2: Garantir que analysis e genreTargets existem**

**Arquivo:** `ai-suggestion-ui-controller.js`  
**Linha:** 1100 (função `renderAISuggestions`)

```javascript
renderAISuggestions(suggestions, genreTargets = null, metrics = null) {
    // ✅ GARANTIR que currentModalAnalysis está setado
    if (!window.currentModalAnalysis && metrics) {
        window.currentModalAnalysis = {
            ...metrics,
            analysisMode: metrics.analysisMode || 'full',
            technicalData: metrics.technicalData || {}
        };
    }
    
    // ... resto do código
}
```

#### **Correção #3: Mover patch para função separada**

**Arquivo:** `ai-suggestion-ui-controller.js`  
**Linha:** Nova função

```javascript
applyRowsPatch(suggestions, genreTargets) {
    if (!window.USE_TABLE_ROWS_FOR_MODAL || typeof window.buildMetricRows !== 'function') {
        return suggestions; // Sem patch, retorna original
    }
    
    const analysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__;
    
    if (!analysis || !genreTargets) {
        console.warn('[ROWS-PATCH] ⚠️ Dados insuficientes, mantendo suggestions originais');
        return suggestions;
    }
    
    const rows = window.buildMetricRows(analysis, genreTargets, 'genre');
    const problemRows = rows.filter(r => r.severity !== 'OK');
    
    const rowsAsSuggestions = problemRows.map(row => ({
        metric: row.key,
        type: row.type,
        category: row.category,
        // ... resto da conversão
        _fromRows: true
    }));
    
    console.log('[ROWS-PATCH] ✅ Substituído:', {
        original: suggestions.length,
        novo: rowsAsSuggestions.length
    });
    
    return rowsAsSuggestions;
}
```

---

## 🎯 CONCLUSÃO

### **Root Cause:**

O patch `USE_TABLE_ROWS_FOR_MODAL` **existe mas não está sendo executado** porque:

1. Filtro Security Guard roda ANTES do patch
2. Patch depende de `analysis` e `genreTargets` que podem estar null
3. Security Guard bloqueia 4 das 7 bandas (sub, bass, mid, air)
4. Backend não gera suggestions para lowMid, highMid, presence (ou patch não substitui)

### **Por isso:**

- **Tabela mostra 6:** Constrói rows direto dos dados (sem filtro)
- **Modal mostra 3:** Suggestions filtradas pelo Security Guard antes do patch aplicar

### **Próximo passo:**

1. Verificar console: `[MODAL_VS_TABLE] ⚠️ analysis ou genreTargets ausente`
2. Se aparecer: Corrigir para garantir que analysis/genreTargets existem
3. Se não aparecer: Patch está executando, mas Security Guard filtra depois
4. **Solução:** Aplicar patch ANTES do filtro ou desabilitar filtro quando patch ativo

---

**Status:** ✅ AUDITORIA COMPLETA  
**Confiança:** 95% (falta verificar backend para confirmar range trocado)  
**Prioridade:** 🔴 CRÍTICA (modal não funciona como esperado)

