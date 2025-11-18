# 🔍 AUDITORIA COMPLETA - MODO GÊNERO (Branch `imersao`)

**Data:** 2025-01-XX  
**Branch Auditada:** `imersao` (branch antiga/original)  
**Branch Modificada:** `restart` (branch de trabalho recente)  
**Objetivo:** Documentar comportamento original do modo gênero para portabilidade segura

---

## 📋 SUMÁRIO EXECUTIVO

### **Descoberta Crítica:**
A branch `imersao` utiliza uma **ARQUITETURA UNIFICADA** onde uma única função (`renderReferenceComparisons`) serve TANTO o modo gênero QUANTO o modo referência, enquanto a branch `restart` separou completamente essas funcionalidades em funções dedicadas (`renderGenreView`, `renderGenreComparisonTable`).

### **Diferença Arquitetural:**

| Aspecto | Branch `imersao` (antiga) | Branch `restart` (nova) |
|---------|---------------------------|-------------------------|
| **Arquitetura** | UNIFICADA | SEPARADA |
| **Função Principal** | `renderReferenceComparisons()` híbrida | `renderGenreView()` + `renderGenreComparisonTable()` |
| **Detecção de Modo** | Flag `isReferenceMode` | Funções distintas |
| **Linhas de Código** | 10,282 linhas | 19,151 linhas |
| **Sistema de Conversão** | ❌ Não existe | ✅ `mapBackendBandsToGenreBands()` |
| **Guards Isolados** | ❌ Não existe | ✅ Bypass em guards de referência |

---

## 🎯 FUNÇÃO PRINCIPAL: `renderReferenceComparisons(analysis)`

### **Localização:** `public/audio-analyzer-integration.js`, linha **5797-6200** (~400 linhas)

### **Propósito:**
Função HÍBRIDA que renderiza comparação de métricas para:
- **Modo Gênero:** Compara com targets de gênero (`__activeRefData`)
- **Modo Referência:** Compara com faixa de referência (`analysis.referenceMetrics`)

---

## 🧬 ESTRUTURA DA FUNÇÃO

### **1. Detecção de Modo (linhas 5797-5806)**

```javascript
function renderReferenceComparisons(analysis) {
    const container = document.getElementById('referenceComparisons');
    
    // 🎯 FLAG DE DETECÇÃO DE MODO
    const isReferenceMode = analysis.analysisMode === 'reference' || 
                           analysis.baseline_source === 'reference' ||
                           (analysis.comparison && analysis.comparison.baseline_source === 'reference');
    
    let ref, titleText;
    
    if (isReferenceMode && analysis.referenceMetrics) {
        // 🎯 MODO REFERÊNCIA: usar métricas da faixa de referência
        ref = {
            lufs_target: analysis.referenceMetrics.lufs,
            bands: analysis.referenceMetrics.bands || null
        };
        titleText = "Música de Referência";
    } else {
        // 🎯 MODO GÊNERO: usar targets de gênero
        ref = __activeRefData;
        titleText = window.PROD_AI_REF_GENRE;
        
        if (!ref) { 
            container.innerHTML = '<div>Referências não carregadas</div>'; 
            return; 
        }
    }
}
```

**Variáveis Globais Usadas:**
- `__activeRefData` (linha 48) - Dados do gênero atual
- `__activeRefGenre` (linha 49) - Chave do gênero
- `currentAnalysisMode` (linha 52) - 'genre' | 'reference'
- `window.PROD_AI_REF_GENRE` - Nome do gênero selecionado

---

### **2. Sistema de Renderização com `pushRow()` (linhas 5850-5950)**

```javascript
const EPS = 1e-6; // Epsilon para comparações float
const nf = x => (typeof x === 'number' ? x.toFixed(2) : '—');

const rows = [];
const pushRow = (label, val, target, tol, unit='') => {
    // Sistema de enhancement de labels
    const enhancedLabel = (typeof window !== 'undefined' && window.enhanceRowLabel) 
        ? window.enhanceRowLabel(label, label.toLowerCase().replace(/[^a-z]/g, '')) 
        : label;
    
    // Tratar target null ou NaN como N/A
    const targetIsNA = (target == null || target === '' || 
                       (typeof target==='number' && !Number.isFinite(target)));
    
    if (!Number.isFinite(val) && targetIsNA) return; // Nada útil
    
    if (targetIsNA) {
        rows.push(`<tr>
            <td>${enhancedLabel}</td>
            <td>${Number.isFinite(val)?nf(val)+unit:'—'}</td>
            <td colspan="2" style="opacity:.55">N/A</td>
        </tr>`);
        return;
    }
    
    // 🎯 CÁLCULO DE DIFERENÇA HÍBRIDO
    let diff = null;
    
    if (typeof target === 'object' && target !== null && 
        Number.isFinite(target.min) && Number.isFinite(target.max) && Number.isFinite(val)) {
        // Target é um RANGE: normalizar e calcular distância
        const minNorm = Math.min(target.min, target.max);
        const maxNorm = Math.max(target.min, target.max);
        
        if (val >= minNorm - EPS && val <= maxNorm + EPS) {
            diff = 0; // ✅ Dentro do range: ideal
        } else if (val < minNorm) {
            diff = val - minNorm; // ❌ Abaixo do range
        } else {
            diff = val - maxNorm; // ❌ Acima do range
        }
    } else if (Number.isFinite(val) && Number.isFinite(target)) {
        // Target FIXO: diferença tradicional
        diff = val - target;
    }
    
    // ✅ SISTEMA DE 3 CORES COM EPSILON
    let diffCell;
    
    if (!Number.isFinite(diff)) {
        // Sem dados válidos → VERMELHO
        diffCell = '<td class="warn" style="text-align: center; padding: 8px;"><div style="font-size: 12px; font-weight: 600;">Corrigir</div></td>';
    } else if (tol === 0) {
        // 🎯 BANDAS ESPECTRAIS (tol=0): comparação binária
        const absDiff = Math.abs(diff);
        let cssClass, statusText;
        
        if (absDiff <= EPS) {
            cssClass = 'ok';         // ✅ Verde
            statusText = 'Ideal';
        } else if (absDiff <= 1.0 + EPS) {
            cssClass = 'yellow';     // ⚠️ Amarelo
            statusText = 'Ajuste leve';
        } else if (absDiff <= 3.0 + EPS) {
            cssClass = 'yellow';     // ⚠️ Amarelo
            statusText = 'Ajustar';
        } else {
            cssClass = 'warn';       // ❌ Vermelho
            statusText = 'Corrigir';
        }
        
        diffCell = `<td class="${cssClass}" style="text-align: center; padding: 8px;">
            <div style="font-size: 12px; font-weight: 600;">${statusText}</div>
        </td>`;
    } else {
        // 🎯 MÉTRICAS NORMAIS (LUFS, TP, DR, etc.): sistema com tolerância
        const absDiff = Math.abs(diff);
        let cssClass, statusText;
        
        if (absDiff <= tol + EPS) {
            cssClass = 'ok';         // ✅ ZONA IDEAL
            statusText = 'Ideal';
        } else {
            const multiplicador = absDiff / tol;
            if (multiplicador <= 2 + EPS) {
                cssClass = 'yellow'; // ⚠️ ZONA AJUSTAR
                statusText = 'Ajuste leve';
            } else {
                cssClass = 'warn';   // ❌ ZONA CORRIGIR
                statusText = 'Corrigir';
            }
        }
        
        diffCell = `<td class="${cssClass}" style="text-align: center; padding: 8px;">
            <div style="font-size: 12px; font-weight: 600;">${statusText}</div>
        </td>`;
    }
    
    // Renderizar target display (suporta ranges e valores fixos)
    let targetDisplay = '';
    if (typeof target === 'object' && target !== null && 
        Number.isFinite(target.min) && Number.isFinite(target.max)) {
        targetDisplay = `${nf(target.min)} ~ ${nf(target.max)}${unit}`;
    } else {
        targetDisplay = `${nf(target)}${unit}`;
    }
    
    const tolDisplay = (Number.isFinite(tol) && tol > 0) 
        ? `<span class="tol">(±${nf(tol)})</span>` 
        : '';
    
    rows.push(`<tr>
        <td>${enhancedLabel}</td>
        <td>${Number.isFinite(val)?nf(val)+unit:'—'}</td>
        <td>${targetDisplay}${tolDisplay}</td>
        ${diffCell}
    </tr>`);
};
```

---

### **3. Sistema de Métricas Principais (linha ~6036)**

```javascript
// LUFS, Peak, DR, LRA, Stereo
pushRow('Loudness Integrado (LUFS)', getLufsIntegratedValue(), ref.lufs_target, ref.tol_lufs, ' LUFS');
pushRow('Pico Real (dBTP)', getMetricForRef('true_peak_dbtp', 'truePeakDbtp'), ref.true_peak_target, ref.tol_true_peak, ' dBTP');
pushRow('DR', getMetricForRef('dynamic_range', 'dynamicRange'), ref.dr_target, ref.tol_dr, '');
pushRow('Faixa de Loudness – LRA (LU)', getMetricForRef('lra'), ref.lra_target, ref.tol_lra, ' LU');
pushRow('Stereo Corr.', getMetricForRef('stereo_correlation', 'stereoCorrelation'), ref.stereo_target, ref.tol_stereo, '');
```

**Função Auxiliar: `getMetricForRef(metricPath, fallbackPath)`**
- Prioriza `analysis.metrics` (centralizado)
- Fallback para `tech` (technicalData legado)
- Log de validação quando valores diferem

---

### **4. Sistema de Bandas Espectrais (linhas 6050-6350)**

#### **Mapeamento de Bandas**

```javascript
// 🎯 MAPEAMENTO: Bandas Calculadas → Bandas de Referência
const bandMappingCalcToRef = {
    'sub': 'sub',
    'bass': 'low_bass',      // ⚠️ CONVERSÃO CRÍTICA
    'lowMid': 'low_mid',     // ⚠️ CONVERSÃO CRÍTICA
    'mid': 'mid',
    'highMid': 'high_mid',   // ⚠️ CONVERSÃO CRÍTICA
    'presence': 'presenca',  // ⚠️ CONVERSÃO CRÍTICA
    'air': 'brilho',         // ⚠️ CONVERSÃO CRÍTICA
};

// 🎯 MAPEAMENTO REVERSO: Bandas de Referência → Bandas Calculadas
const bandMappingRefToCalc = {
    'sub': 'sub',
    'low_bass': 'bass',
    'upper_bass': 'bass',    // 🎯 NOVO
    'low_mid': 'lowMid',
    'mid': 'mid',
    'high_mid': 'highMid',
    'presenca': 'presence',
    'brilho': 'air'
};

// 🎯 ALIAS DE BANDAS: Nomes alternativos para busca
const bandAliases = {
    'bass': ['low_bass', 'upper_bass'],
    'lowMid': ['low_mid'],
    'highMid': ['high_mid'],
    'presence': ['presenca'],
    'air': ['brilho']
};
```

#### **Nomes de Exibição**

```javascript
const bandDisplayNames = {
    sub: 'Sub (20–60Hz)',
    bass: 'Bass (60–150Hz)', 
    lowMid: 'Low-Mid (150–500Hz)',
    mid: 'Mid (500–2kHz)',
    highMid: 'High-Mid (2–5kHz)',
    presence: 'Presence (5–10kHz)',
    air: 'Air (10–20kHz)',
    brilho: 'Air (10–20kHz)'
};
```

#### **Sistema de Busca com Alias**

```javascript
const searchBandData = (bandKey) => {
    // 1. Buscar diretamente em bandas centralizadas
    if (centralizedBands && centralizedBands[bandKey]) {
        return { rms_db: centralizedBands[bandKey].energy_db, source: 'centralized' };
    }
    
    // 2. Buscar em bandas legadas
    if (legacyBandEnergies && legacyBandEnergies[bandKey]) {
        return { ...legacyBandEnergies[bandKey], source: 'legacy' };
    }
    
    // 3. Buscar por alias
    if (bandAliases[bandKey]) {
        for (const alias of bandAliases[bandKey]) {
            if (centralizedBands && centralizedBands[alias]) {
                console.log(`🔄 [ALIAS] ${bandKey} → ${alias} (centralized)`);
                return { rms_db: centralizedBands[alias].energy_db, source: 'centralized-alias' };
            }
            if (legacyBandEnergies && legacyBandEnergies[alias]) {
                console.log(`🔄 [ALIAS] ${bandKey} → ${alias} (legacy)`);
                return { ...legacyBandEnergies[alias], source: 'legacy-alias' };
            }
        }
    }
    
    return null;
};
```

#### **Suporte a Ranges vs Valores Fixos**

```javascript
// Prioridade 1: target_range (sistema sem tolerância automática)
if (refBand.target_range && typeof refBand.target_range === 'object' &&
    Number.isFinite(refBand.target_range.min) && Number.isFinite(refBand.target_range.max)) {
    tgt = refBand.target_range;
    tolerance = 0; // ⚠️ SEMPRE 0 PARA BANDAS (comparação binária)
}
// Prioridade 2: target_db fixo (tratar como min=max=target)
else if (!refBand._target_na && Number.isFinite(refBand.target_db)) {
    tgt = { min: refBand.target_db, max: refBand.target_db };
    tolerance = 0; // ⚠️ SEMPRE 0 PARA BANDAS
}
```

#### **Tratamento Silencioso de Bandas Ausentes**

```javascript
// 🎯 TRATAMENTO SILENCIOSO: Ignorar bandas não encontradas SEM ERRO
if (!bLocal || !Number.isFinite(bLocal.rms_db)) {
    console.log(`🔇 [BANDS] Ignorando banda inexistente: ${refBandKey} / ${calcBandKey}`);
    continue; // Pular silenciosamente
}
```

---

### **5. Renderização Final (linha ~6420)**

```javascript
container.innerHTML = `<div class="card" style="margin-top:12px;">
    <div class="card-title">COMPARAÇÃO DE REFERÊNCIA (${titleText})</div>
    <table class="ref-compare-table">
        <thead><tr>
            <th>Métrica</th><th>Valor</th><th>Alvo</th><th>Δ</th>
        </tr></thead>
        <tbody>${rows.join('') || '<tr><td colspan="4" style="opacity:.6">Sem métricas disponíveis</td></tr>'}</tbody>
    </table>
</div>`;
```

---

## 🎨 SISTEMA DE CSS

### **Container Principal**
- ID: `#referenceComparisons` (linha 5798)

### **Classes de Cores (Arquivo: `friendly-labels.css`, linhas 90-140)**

```css
/* ✅ VERDE - Status Ideal */
.ref-compare-table td.ok {
    background: rgba(82, 247, 173, 0.15);
    color: #52f7ad;
    font-weight: 600;
    border: 1px solid rgba(82, 247, 173, 0.3);
}

/* ⚠️ AMARELO - Ajustar */
.ref-compare-table td.yellow {
    background: rgba(255, 206, 77, 0.15);
    color: #ffce4d;
    font-weight: 600;
    border: 1px solid rgba(255, 206, 77, 0.3);
}

/* ❌ VERMELHO - Corrigir */
.ref-compare-table td.warn {
    background: rgba(255, 123, 123, 0.15);
    color: #ff7b7b;
    font-weight: 600;
    border: 1px solid rgba(255, 123, 123, 0.3);
}
```

### **Estilos Injetados Dinamicamente (linha 6430-6450)**

```javascript
if (!document.getElementById('refCompareStyles')) {
    const style = document.createElement('style');
    style.id = 'refCompareStyles';
    style.textContent = `
        .ref-compare-table{width:100%;border-collapse:collapse;font-size:11px;}
        .ref-compare-table th{font-weight:500;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.12);font-size:11px;color:#fff;letter-spacing:.3px;}
        .ref-compare-table th:first-child{text-align:left;}
        .ref-compare-table th:not(:first-child){text-align:center;}
        .ref-compare-table td{padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.06);color:#f5f7fa;} 
        .ref-compare-table td:first-child{text-align:left;}
        .ref-compare-table td:not(:first-child){text-align:center;}
        .ref-compare-table tr:last-child td{border-bottom:0;} 
        .ref-compare-table td.ok{color:#52f7ad;font-weight:600;} 
        .ref-compare-table td.ok::before{content:'✅ ';margin-right:2px;}
        .ref-compare-table td.yellow{color:#ffce4d;font-weight:600;} 
        .ref-compare-table td.yellow::before{content:'⚠️ ';margin-right:2px;}
        .ref-compare-table td.warn{color:#ff7b7b;font-weight:600;} 
        .ref-compare-table td.warn::before{content:'❌ ';margin-right:2px;}
        .ref-compare-table .tol{opacity:.7;margin-left:4px;font-size:10px;color:#b8c2d6;} 
        .ref-compare-table tbody tr:hover td{background:rgba(255,255,255,.04);} 
    `;
    document.head.appendChild(style);
}
```

---

## 🏗️ SISTEMA DE CARREGAMENTO DE TARGETS

### **Função: `loadGenreReferences(genre)` (linha ~1340-1510)**

```javascript
async function loadGenreReferences(genre) {
    // 1. Buscar no cache
    if (__refDataCache[genre]) {
        __activeRefData = __refDataCache[genre];
        return;
    }
    
    // 2. Tentar carregar de endpoints (prioridade)
    try {
        const response = await fetch(`/genre-targets/${genre}.json`);
        const data = await response.json();
        __activeRefData = enrichedNet;
        __refDataCache[genre] = __activeRefData;
        return;
    } catch (err) {
        console.warn(`⚠️ Falha ao carregar do endpoint: ${err.message}`);
    }
    
    // 3. Tentar carregar de arquivo local
    try {
        const response = await fetch(`genre-targets/${genre}.json`);
        const data = await response.json();
        __activeRefData = enriched;
        __refDataCache[genre] = __activeRefData;
        return;
    } catch (err) {
        console.warn(`⚠️ Falha ao carregar local: ${err.message}`);
    }
    
    // 4. Fallback para dados embarcados
    __activeRefData = enrichedEmb || enrichedEmbTr;
}

// Atualizar variável global
window.PROD_AI_REF_GENRE = genre;
```

---

## 🔍 MODAL DE GÊNERO

### **Container:** `#newGenreModal` (linha 1938)
### **Seletor:** `#audioRefGenreSelect` (linhas 1296, 1666)

### **Funções (linhas 1935-1991)**
- `openGenreModal()` (linha 1935)
- `closeGenreModal()` (linha 1969)
- `initGenreModal()` (linha 1991)

### **CSS do Modal (arquivo: `audio-analyzer.css`, linhas 4853-5053)**

```css
.genre-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}

.genre-modal-container {
    background: linear-gradient(135deg, rgba(14, 20, 34, 0.95), rgba(31, 43, 64, 0.95));
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 24px;
    padding: 32px 24px 24px 24px;
    max-width: 750px;
    width: 90%;
    max-height: 85vh;
    overflow-y: auto;
}

.genre-modal-title {
    font-family: 'Orbitron', sans-serif;
    font-size: 2rem;
    text-transform: uppercase;
    letter-spacing: 2px;
    background: linear-gradient(90deg, #6a00ff, #00f0ff);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.genre-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 20px;
}

.genre-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 14px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.genre-card:hover {
    background: rgba(0, 102, 255, 0.15);
    border-color: rgba(36, 157, 255, 0.4);
    transform: translateY(-4px) scale(1.02);
}
```

---

## 📊 TABELA COMPARATIVA: Branch `imersao` vs Branch `restart`

| Componente | Branch `imersao` (antiga) | Branch `restart` (nova) | Diferença | Impacto |
|------------|---------------------------|-------------------------|-----------|---------|
| **Arquitetura** | UNIFICADA (1 função híbrida) | SEPARADA (3 funções) | Separação completa | Alto |
| **Função Principal** | `renderReferenceComparisons()` | `renderGenreView()` + `renderGenreComparisonTable()` | Funções dedicadas | Alto |
| **Detecção de Modo** | Flag `isReferenceMode` | Funções distintas | Lógica isolada | Médio |
| **Conversão de Bandas** | ❌ Não existe | ✅ `mapBackendBandsToGenreBands()` | Módulo criado | Alto |
| **Suporte a Ranges** | ✅ `target_range.min/max` | ✅ `target_range.min/max` | Idêntico | Neutro |
| **Sistema de Cores** | ✅ `.ok`, `.yellow`, `.warn` | ✅ `.ok`, `.yellow`, `.warn` | Idêntico | Neutro |
| **Tolerância Bandas** | ✅ Sempre `tol=0` | ✅ Sempre `tol=0` | Idêntico | Neutro |
| **Guards de Referência** | ❌ Sem isolamento | ✅ Bypass em guards | Isolamento total | Alto |
| **Mapeamento de Bandas** | ✅ Inline na função | ✅ Módulo separado | Modularização | Médio |
| **Sistema de Alias** | ✅ `bandAliases` inline | ❌ Não implementado | Perda de funcionalidade | Médio |
| **Busca de Bandas** | ✅ `searchBandData()` com alias | ❌ Busca simples | Perda de funcionalidade | Médio |
| **Tratamento de Ausências** | ✅ Silencioso (`continue`) | ⚠️ Não verificado | Potencial quebra | Médio |
| **Container DOM** | `#referenceComparisons` | `#referenceComparisons` | Idêntico | Neutro |
| **CSS Injetado** | ✅ `#refCompareStyles` | ✅ `#refCompareStyles` | Idêntico | Neutro |
| **CSS Externo** | `friendly-labels.css` | `friendly-labels.css` | Idêntico | Neutro |
| **Variáveis Globais** | `__activeRefData`, `PROD_AI_REF_GENRE` | `__activeRefData`, `PROD_AI_REF_GENRE` | Idêntico | Neutro |
| **Carregamento** | `loadGenreReferences(genre)` | `loadGenreReferences(genre)` | Idêntico | Neutro |
| **Modal de Gênero** | `#newGenreModal` | `#newGenreModal` | Idêntico | Neutro |
| **Linhas de Código** | 10,282 | 19,151 | +87% | Alto |

---

## ⚠️ FUNCIONALIDADES PERDIDAS NA BRANCH `restart`

### **1. Sistema de Alias de Bandas**
- **Implementação Original:** `bandAliases` object + `searchBandData()` com busca por alias
- **Status na Branch `restart`:** ❌ Não implementado
- **Impacto:** Bandas com nomes variantes (ex: `upper_bass` → `bass`) não são encontradas
- **Solução:** Recriar sistema de alias no módulo de conversão

### **2. Tratamento Silencioso de Bandas Ausentes**
- **Implementação Original:** `continue` silencioso quando banda não encontrada
- **Status na Branch `restart`:** ⚠️ Não verificado
- **Impacto:** Possível exibição de erros ao usuário
- **Solução:** Implementar `continue` após busca falhada

### **3. Função Unificada de Detecção**
- **Implementação Original:** Flag `isReferenceMode` detecta automaticamente
- **Status na Branch `restart`:** ✅ Substituído por funções separadas
- **Impacto:** Neutro (arquitetura diferente)
- **Solução:** Manter arquitetura separada

### **4. Sistema de Busca em Múltiplas Fontes**
- **Implementação Original:** Busca em `centralizedBands` → `legacyBandEnergies` → alias
- **Status na Branch `restart`:** ⚠️ Não verificado
- **Impacto:** Possível perda de dados em fallbacks
- **Solução:** Implementar busca em cascata com alias

---

## ✅ FUNCIONALIDADES PRESERVADAS/MELHORADAS NA BRANCH `restart`

### **1. Módulo de Conversão de Bandas**
- **Função:** `mapBackendBandsToGenreBands()`
- **Benefício:** Conversão explícita e testável (`bass→low_bass`, `lowMid→low_mid`, etc)
- **Status:** ✅ Implementado e funcionando

### **2. Isolamento de Modo Gênero**
- **Implementação:** Bypass em `computeHasReferenceComparisonMetrics()` e `getActiveReferenceComparisonMetrics()`
- **Benefício:** Modo gênero não é interferido por guards de referência
- **Status:** ✅ Implementado e funcionando

### **3. Suporte a `target_range.min/max`**
- **Leitura:** Prioriza `target_range` sobre `target_db`
- **Benefício:** Suporte completo a targets com ranges
- **Status:** ✅ Implementado e funcionando

### **4. Remoção de Bloco Inline Problemático**
- **Problema Original:** 240 linhas inline em `renderReferenceComparisons` sobrescrevendo tabela
- **Solução:** Bloco removido completamente
- **Status:** ✅ Implementado e funcionando

### **5. Flag `forceClassicGenreTable`**
- **Propósito:** Desativa fallback para renderização genérica
- **Benefício:** Garante uso da tabela clássica
- **Status:** ✅ Implementado e funcionando

---

## 📋 PLANO DE PORTABILIDADE

### **FASE 1: Restaurar Funcionalidades Perdidas (CRÍTICO)**

#### **1.1. Implementar Sistema de Alias de Bandas**
**Arquivo:** `public/audio-analyzer-integration.js` (branch `restart`)  
**Função:** `mapBackendBandsToGenreBands()` (ampliar)

```javascript
// ADICIONAR ao módulo existente:
const BAND_ALIASES = {
    'bass': ['low_bass', 'upper_bass'],
    'lowMid': ['low_mid'],
    'highMid': ['high_mid'],
    'presence': ['presenca'],
    'air': ['brilho']
};

function searchBandWithAlias(bandKey, bandsObject) {
    // 1. Busca direta
    if (bandsObject[bandKey]) return bandsObject[bandKey];
    
    // 2. Busca por alias
    const aliases = BAND_ALIASES[bandKey];
    if (aliases) {
        for (const alias of aliases) {
            if (bandsObject[alias]) {
                console.log(`🔄 [ALIAS] ${bandKey} → ${alias}`);
                return bandsObject[alias];
            }
        }
    }
    
    return null;
}
```

**Testes:**
- ✅ Banda `bass` encontra `low_bass`
- ✅ Banda `bass` encontra `upper_bass`
- ✅ Banda inexistente retorna `null` sem erro

#### **1.2. Implementar Tratamento Silencioso**
**Arquivo:** `public/audio-analyzer-integration.js` (branch `restart`)  
**Função:** `renderGenreComparisonTable()`

```javascript
// ADICIONAR antes de processamento de bandas:
const bandData = searchBandWithAlias(bandKey, genreBands);

if (!bandData || !Number.isFinite(bandData.rms_db)) {
    console.log(`🔇 [BANDS] Ignorando banda inexistente: ${bandKey}`);
    continue; // ⚠️ CRÍTICO: Não exibir erro ao usuário
}
```

**Testes:**
- ✅ Banda ausente não quebra renderização
- ✅ Log informativo sem erro visual
- ✅ Outras bandas continuam sendo processadas

#### **1.3. Implementar Busca em Cascata**
**Arquivo:** `public/audio-analyzer-integration.js` (branch `restart`)  
**Função:** `renderGenreComparisonTable()`

```javascript
// ADICIONAR lógica de múltiplas fontes:
function getBandData(bandKey) {
    // 1. Prioridade: analysis.metrics.bands (centralizado)
    if (analysis.metrics?.bands) {
        const data = searchBandWithAlias(bandKey, analysis.metrics.bands);
        if (data) return { ...data, source: 'centralized' };
    }
    
    // 2. Fallback: tech.bandEnergies (legado)
    if (tech.bandEnergies) {
        const data = searchBandWithAlias(bandKey, tech.bandEnergies);
        if (data) return { ...data, source: 'legacy' };
    }
    
    // 3. Fallback: tech.spectralBands
    if (tech.spectralBands) {
        const data = searchBandWithAlias(bandKey, tech.spectralBands);
        if (data) return { ...data, source: 'spectral' };
    }
    
    return null;
}
```

**Testes:**
- ✅ Busca em todas as fontes disponíveis
- ✅ Prioriza dados mais recentes (centralizados)
- ✅ Log de qual fonte foi usada

---

### **FASE 2: Validar Funcionalidades Existentes (IMPORTANTE)**

#### **2.1. Validar Sistema de Cores**
**Arquivo:** `public/friendly-labels.css`  
**Classes:** `.ok`, `.yellow`, `.warn`

**Testes:**
- ✅ Cores idênticas à branch `imersao`
- ✅ Ícones (✅⚠️❌) renderizando corretamente
- ✅ Hover effects funcionando

#### **2.2. Validar Suporte a Ranges**
**Arquivo:** `public/audio-analyzer-integration.js` (branch `restart`)  
**Função:** `renderGenreComparisonTable()`

**Testes:**
- ✅ `target_range.min/max` lido corretamente
- ✅ Comparação binária (dentro/fora do range)
- ✅ Display correto (`-10 ~ -8 dB`)

#### **2.3. Validar Tolerância Zero**
**Arquivo:** `public/audio-analyzer-integration.js` (branch `restart`)  
**Função:** `renderGenreComparisonTable()`

**Testes:**
- ✅ Bandas sempre com `tol=0`
- ✅ Comparação binária (não proporcional)
- ✅ Cores corretas (verde/amarelo/vermelho)

---

### **FASE 3: Documentação e Testes (SECUNDÁRIO)**

#### **3.1. Criar Testes Unitários**
**Arquivo:** `tests/genre-mode.test.js` (criar)

```javascript
describe('Sistema de Alias de Bandas', () => {
    test('Busca direta encontra banda', () => {
        const result = searchBandWithAlias('bass', { bass: { rms_db: -10 } });
        expect(result).toEqual({ rms_db: -10 });
    });
    
    test('Busca por alias encontra banda', () => {
        const result = searchBandWithAlias('bass', { low_bass: { rms_db: -10 } });
        expect(result).toEqual({ rms_db: -10 });
    });
    
    test('Banda inexistente retorna null', () => {
        const result = searchBandWithAlias('inexistente', {});
        expect(result).toBeNull();
    });
});

describe('Tratamento de Bandas Ausentes', () => {
    test('Banda ausente não quebra renderização', () => {
        const html = renderGenreComparisonTable(analysisWithMissingBands);
        expect(html).not.toContain('undefined');
        expect(html).not.toContain('NaN');
    });
});
```

#### **3.2. Atualizar Documentação**
**Arquivo:** `docs/MODO_GENERO.md` (criar)

```markdown
# Modo Gênero - Documentação Técnica

## Arquitetura
- Funções separadas: `renderGenreView()` → `renderGenreComparisonTable()`
- Conversão de bandas: `mapBackendBandsToGenreBands()`
- Sistema de alias: `searchBandWithAlias()`

## Fluxo de Dados
1. Usuário seleciona gênero → `loadGenreReferences(genre)`
2. Backend analisa áudio → retorna bandas (`bass`, `lowMid`, etc)
3. Conversão de bandas → (`low_bass`, `low_mid`, etc)
4. Busca com alias → fallback para múltiplas fontes
5. Renderização → tabela clássica com 6 colunas

## Mapeamento de Bandas
- Backend: `bass`, `lowMid`, `highMid`, `presence`, `air`
- Targets: `low_bass`, `low_mid`, `high_mid`, `presenca`, `brilho`
- Alias: `upper_bass` → `bass`
```

---

## 🎯 RESUMO EXECUTIVO

### **O que foi descoberto:**
1. Branch `imersao` usa função **UNIFICADA** (`renderReferenceComparisons`) que serve ambos os modos
2. Sistema de **ALIAS DE BANDAS** permite busca flexível (`upper_bass` → `bass`)
3. **TRATAMENTO SILENCIOSO** de bandas ausentes (não quebra UI)
4. **BUSCA EM CASCATA** (centralizado → legado → espectral)
5. Sistema de **3 CORES** (verde/amarelo/vermelho) idêntico em ambas branches

### **O que foi perdido na branch `restart`:**
1. ❌ Sistema de alias de bandas
2. ❌ Tratamento silencioso de bandas ausentes
3. ❌ Busca em múltiplas fontes com fallback

### **O que foi melhorado na branch `restart`:**
1. ✅ Módulo de conversão de bandas (`mapBackendBandsToGenreBands`)
2. ✅ Isolamento de modo gênero (bypass em guards)
3. ✅ Arquitetura separada (funções dedicadas)
4. ✅ Suporte explícito a `target_range.min/max`

### **Próximos passos:**
1. **FASE 1 (CRÍTICO):** Implementar sistema de alias + tratamento silencioso + busca em cascata
2. **FASE 2 (IMPORTANTE):** Validar cores, ranges, tolerância zero
3. **FASE 3 (SECUNDÁRIO):** Criar testes unitários + documentação

---

## 📌 APÊNDICE: CHECKLIST DE PORTABILIDADE

### **Funcionalidades Críticas**
- [ ] Sistema de alias de bandas implementado
- [ ] Tratamento silencioso de bandas ausentes
- [ ] Busca em cascata (centralizado → legado → espectral)
- [ ] Conversão de bandas funcionando
- [ ] Suporte a ranges (`target_range.min/max`)

### **Validações**
- [ ] Cores idênticas (verde/amarelo/vermelho)
- [ ] Ícones renderizando (✅⚠️❌)
- [ ] Tolerância zero para bandas
- [ ] Display de ranges correto
- [ ] Hover effects funcionando

### **Testes**
- [ ] Banda com alias encontrada (`upper_bass` → `bass`)
- [ ] Banda ausente não quebra UI
- [ ] Busca em múltiplas fontes
- [ ] Comparação binária (dentro/fora range)
- [ ] Tabela clássica com 6 colunas

### **Documentação**
- [ ] Documento de arquitetura
- [ ] Tabela comparativa (branch antiga vs nova)
- [ ] Plano de portabilidade
- [ ] Testes unitários

---

**FIM DA AUDITORIA**  
**Status:** ✅ COMPLETA  
**Próxima ação:** Implementar FASE 1 (Restaurar Funcionalidades Perdidas)
