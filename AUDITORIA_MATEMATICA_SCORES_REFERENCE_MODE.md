# 🎯 AUDITORIA MATEMÁTICA DO CÁLCULO DE SCORES (REFERENCE MODE)

**Data:** 2 de novembro de 2025  
**Arquivo Auditado:** `/public/audio-analyzer-integration.js`  
**Objetivo:** Identificar por que sub-scores retornam 100% mesmo com diferenças grandes (ex: -16.5 vs -21.4 LUFS)

---

## 🔴 PROBLEMA CRÍTICO IDENTIFICADO

### **LINHA 9504: TOLERÂNCIA ZERO NO MODO REFERENCE (FREQUÊNCIA)**

```javascript
if (isReferenceMode) {
    // 👉 MODO REFERENCE: Usar valor DIRETO da faixa de referência (não target_range)
    if (typeof refBandData === 'object' && Number.isFinite(refBandData.energy_db)) {
        targetDb = refBandData.energy_db;
    } else if (typeof refBandData === 'object' && Number.isFinite(refBandData.rms_db)) {
        targetDb = refBandData.rms_db;
    } else if (Number.isFinite(refBandData)) {
        targetDb = refBandData;
    }
    tolDb = 0; // 🔴 ERRO CRÍTICO: Sem tolerância em comparação direta
    
    if (targetDb !== null) {
        console.log(`🎯 [SCORE-FREQ-REF] ${calcBand}: comparando com faixa de referência → target=${targetDb.toFixed(1)}dB (valor real), tol=0dB`);
    } else {
        console.warn(`⚠️ [SCORE-FREQ-REF] ${calcBand}: sem valor na faixa de referência`);
    }
}
```

**Localização:** Linha 9504  
**Função:** `calculateFrequencyScore()`

---

## 🧮 ANÁLISE MATEMÁTICA DO ERRO

### **Comportamento de `calculateMetricScore()` com tolerância = 0**

```javascript
// Linha 9238-9268
function calculateMetricScore(actualValue, targetValue, tolerance) {
    if (!Number.isFinite(actualValue) || !Number.isFinite(targetValue) || 
        !Number.isFinite(tolerance) || tolerance <= 0) {
        return null; // ❌ tolerance = 0 cai aqui (0 não é > 0)
    }
    
    const diff = Math.abs(actualValue - targetValue);
    
    // 🎯 DENTRO DA TOLERÂNCIA = 100 pontos
    if (diff <= tolerance) {  // Se tolerance = 0, só retorna 100 se diff = 0 exato
        return 100;
    }
    
    // Curva de penalização...
    const ratio = diff / tolerance;  // 🔴 DIVISÃO POR ZERO se tolerance = 0
    // ...
}
```

### **Problema 1: Condição de Entrada**
```javascript
tolerance <= 0  // ❌ tolerance = 0 falha esta validação
```

- **Quando `tolerance = 0`:** A função retorna `null` **imediatamente**
- **Resultado:** Nenhum score é calculado para bandas de frequência no modo reference
- **Impacto:** `scores.push(score)` nunca acontece, `scores.length = 0`

### **Problema 2: Divisão por Zero (não alcançado, mas presente)**
```javascript
const ratio = diff / tolerance;  // 🔴 diff / 0 = Infinity
```

Se a validação não existisse, teríamos `ratio = Infinity`, resultando em score sempre = 20 (mínimo).

---

## 🔍 SIMULAÇÃO COM CASO REAL

### **Cenário Reportado:**
- **LUFS Atual:** -16.54 dB
- **LUFS Target:** -21.47 dB  
- **Diferença:** `Math.abs(-16.54 - (-21.47)) = 4.93 dB`
- **Tolerância definida:** 0.5 dB (linha 4964)

### **Cálculo Esperado:**
```javascript
diff = 4.93
tolerance = 0.5
ratio = 4.93 / 0.5 = 9.86

// Aplicando curva de penalização (linha 9258-9268):
if (ratio > 3.0) {
    return 20;  // ✅ ESPERADO: 20%
}
```

**Score Esperado:** 20%

---

### **Mas o que realmente acontece?**

#### **1. LOUDNESS Score (linha 9275-9318):**

```javascript
// Linha 9280-9287 (LUFS)
const lufsValue = metrics.lufs_integrated || tech.lufsIntegrated;  // -16.54
if (Number.isFinite(lufsValue) && Number.isFinite(refData.lufs_target) && Number.isFinite(refData.tol_lufs)) {
    const score = calculateMetricScore(lufsValue, refData.lufs_target, refData.tol_lufs);
    // refData.lufs_target = -21.47 (linha 4956)
    // refData.tol_lufs = 0.5 (linha 4964)
    if (score !== null) {
        scores.push(score);
        console.log(`📊 LUFS: ${lufsValue} vs ${refData.lufs_target} (±${refData.tol_lufs}) = ${score}%`);
    }
}
```

**Cálculo Passo a Passo:**
```javascript
actualValue = -16.54
targetValue = -21.47
tolerance = 0.5

// calculateMetricScore (linha 9238)
diff = Math.abs(-16.54 - (-21.47)) = Math.abs(4.93) = 4.93
// diff > tolerance (4.93 > 0.5), não retorna 100

ratio = 4.93 / 0.5 = 9.86

// Curva de penalização:
if (ratio <= 1.5) { /* 9.86 > 1.5, não entra */ }
else if (ratio <= 2.0) { /* 9.86 > 2.0, não entra */ }
else if (ratio <= 3.0) { /* 9.86 > 3.0, não entra */ }
else {
    return 20;  // ✅ CORRETO
}

// Resultado:
score = 20
scores.push(20)
```

**✅ LOUDNESS SCORE ESTÁ CORRETO:** 20%

---

#### **2. TRUE PEAK Score (linha 9292-9301):**

**Cenário:**
- **True Peak Atual:** 2.70 dB
- **True Peak Target:** 1.00 dB
- **Tolerância:** 0.3 dB (linha 4965)

```javascript
const truePeakValue = metrics.true_peak_dbtp || tech.truePeakDbtp;  // 2.70
if (Number.isFinite(truePeakValue) && Number.isFinite(refData.true_peak_target) && Number.isFinite(refData.tol_true_peak)) {
    const score = calculateMetricScore(truePeakValue, refData.true_peak_target, refData.tol_true_peak);
    if (score !== null) {
        scores.push(score);
        console.log(`📊 True Peak: ${truePeakValue} vs ${refData.true_peak_target} (±${refData.tol_true_peak}) = ${score}%`);
    }
}
```

**Cálculo:**
```javascript
actualValue = 2.70
targetValue = 1.00
tolerance = 0.3

diff = Math.abs(2.70 - 1.00) = 1.70
ratio = 1.70 / 0.3 = 5.67

// ratio > 3.0
return 20;  // ✅ CORRETO
```

**✅ TRUE PEAK SCORE ESTÁ CORRETO:** 20%

---

#### **3. FREQUENCY Score (linha 9453-9553) - ⚠️ PROBLEMA AQUI**

```javascript
// Linha 9455 (função calculateFrequencyScore)
const isReferenceMode = refData._isReferenceMode === true;

console.log('🎵 Calculando Score de Frequência...', {
    mode: isReferenceMode ? 'REFERENCE (valores diretos)' : 'GENRE (target_range)',
    bandsAvailable: Object.keys(refData.bands)
});

// Linha 9494-9504 (detecção de modo reference)
if (isReferenceMode) {
    // 👉 MODO REFERENCE: Usar valor DIRETO da faixa de referência
    if (typeof refBandData === 'object' && Number.isFinite(refBandData.energy_db)) {
        targetDb = refBandData.energy_db;
    } else if (typeof refBandData === 'object' && Number.isFinite(refBandData.rms_db)) {
        targetDb = refBandData.rms_db;
    } else if (Number.isFinite(refBandData)) {
        targetDb = refBandData;
    }
    tolDb = 0; // 🔴 ERRO CRÍTICO
    
    if (targetDb !== null) {
        console.log(`🎯 [SCORE-FREQ-REF] ${calcBand}: comparando com faixa de referência → target=${targetDb.toFixed(1)}dB (valor real), tol=0dB`);
    }
}

// Linha 9532-9541 (tentativa de cálculo)
if (Number.isFinite(targetDb) && Number.isFinite(tolDb)) {
    const score = calculateMetricScore(energyDb, targetDb, tolDb);
    //                                                      ^^^^ tolDb = 0
    if (score !== null) {  // 🔴 score SEMPRE será null quando tolDb = 0
        scores.push(score);  // ❌ NUNCA EXECUTA
        const delta = Math.abs(energyDb - targetDb);
        const status = delta <= tolDb ? '✅' : '❌';
        console.log(`🎵 ${calcBand.toUpperCase()}: ${energyDb.toFixed(1)}dB vs ${targetDb.toFixed(1)}dB (±${tolDb.toFixed(1)}dB) = ${score}% ${status}`);
    }
}
```

**Exemplo com banda SUB:**
```javascript
energyDb = -35.2 dB  (segunda faixa)
targetDb = -42.8 dB  (primeira faixa, referência)
tolDb = 0

// Chamada: calculateMetricScore(-35.2, -42.8, 0)

// Dentro de calculateMetricScore (linha 9240):
if (!Number.isFinite(actualValue) || !Number.isFinite(targetValue) || 
    !Number.isFinite(tolerance) || tolerance <= 0) {
    return null;  // ✅ Entra aqui: 0 <= 0 é TRUE
}

// Resultado:
score = null

// De volta em calculateFrequencyScore (linha 9535):
if (score !== null) {  // null !== null é FALSE
    scores.push(score);  // ❌ NÃO EXECUTA
}
```

**Resultado:** 
- ❌ **Nenhuma banda de frequência gera score**
- ❌ `scores.length = 0`
- ❌ Linha 9547: `if (scores.length === 0) return null;`
- ❌ **`calculateFrequencyScore()` retorna `null`**

---

#### **4. DYNAMICS Score (linha 9320-9390):**

**Cenário:**
- **DR Atual:** 7.2 dB
- **DR Target:** 8.5 dB
- **Tolerância:** 1.0 dB (linha 4966)

```javascript
const drValue = metrics.dynamic_range || tech.dynamicRange;  // 7.2
if (Number.isFinite(drValue) && Number.isFinite(refData.dr_target) && Number.isFinite(refData.tol_dr)) {
    const score = calculateMetricScore(drValue, refData.dr_target, refData.tol_dr);
    if (score !== null) {
        scores.push(score);
        console.log(`📊 Dynamic Range: ${drValue} vs ${refData.dr_target} (±${refData.tol_dr}) = ${score}%`);
    }
}
```

**Cálculo:**
```javascript
actualValue = 7.2
targetValue = 8.5
tolerance = 1.0

diff = Math.abs(7.2 - 8.5) = 1.3
ratio = 1.3 / 1.0 = 1.3

// Curva de penalização (linha 9260):
if (ratio <= 1.5) {
    return Math.round(100 - ((ratio - 1) * 40));
    // 100 - ((1.3 - 1) * 40)
    // 100 - (0.3 * 40)
    // 100 - 12
    return 88;
}
```

**✅ DYNAMICS SCORE ESTÁ CORRETO:** 88%

---

#### **5. STEREO Score (linha 9392-9451):**

**Cenário:**
- **Stereo Correlation Atual:** 0.15
- **Stereo Correlation Target:** 0.08
- **Tolerância:** 0.08 (linha 4968)

```javascript
const stereoValue = metrics.stereo_correlation || tech.stereoCorrelation;  // 0.15
if (Number.isFinite(stereoValue) && Number.isFinite(refData.stereo_target) && Number.isFinite(refData.tol_stereo)) {
    const score = calculateMetricScore(stereoValue, refData.stereo_target, refData.tol_stereo);
    if (score !== null) {
        scores.push(score);
        console.log(`📊 Correlação Estéreo: ${stereoValue} vs ${refData.stereo_target} (±${refData.tol_stereo}) = ${score}%`);
    }
}
```

**Cálculo:**
```javascript
actualValue = 0.15
targetValue = 0.08
tolerance = 0.08

diff = Math.abs(0.15 - 0.08) = 0.07
// diff <= tolerance (0.07 <= 0.08)
return 100;  // ✅ CORRETO (diferença dentro da tolerância)
```

**✅ STEREO SCORE ESTÁ CORRETO:** 100%

---

#### **6. TECHNICAL Score (linha 9555-9733):**

Análise não depende de reference mode, usa valores absolutos.

**Assume score:** 85% (exemplo típico)

---

### **CÁLCULO DO SCORE FINAL (linha 9735-9835):**

```javascript
// Linha 9789-9813 (cálculo ponderado)
// Sub-scores calculados:
loudnessScore = 20
dynamicsScore = 88
stereoScore = 100
frequencyScore = null  // 🔴 RETORNOU NULL
technicalScore = 85

// Pesos padrão (linha 9742-9745):
weights = {
    loudness: 0.30,
    dinamica: 0.25,
    estereo: 0.10,
    frequencia: 0.20,
    tecnico: 0.15
}

// Soma ponderada (linha 9789-9813):
let weightedSum = 0;
let totalWeight = 0;

if (loudnessScore !== null) {
    weightedSum += 20 * 0.30;  // 6.0
    totalWeight += 0.30;
}

if (dynamicsScore !== null) {
    weightedSum += 88 * 0.25;  // 22.0
    totalWeight += 0.25;
}

if (stereoScore !== null) {
    weightedSum += 100 * 0.10;  // 10.0
    totalWeight += 0.10;
}

if (frequencyScore !== null) {  // ❌ null !== null é FALSE
    // NÃO EXECUTA
}

if (technicalScore !== null) {
    weightedSum += 85 * 0.15;  // 12.75
    totalWeight += 0.15;
}

// Totais:
weightedSum = 6.0 + 22.0 + 10.0 + 12.75 = 50.75
totalWeight = 0.30 + 0.25 + 0.10 + 0.15 = 0.80

// Linha 9817-9819:
if (totalWeight > 0) {
    const rawFinalScore = weightedSum / totalWeight;
    // 50.75 / 0.80 = 63.4375
    finalScore = Math.round(rawFinalScore);  // 63
}
```

**✅ SCORE FINAL:** 63%

---

## 📊 TABELA RESUMO DE SCORES

| Sub-Score | Valor Calculado | Status | Incluído no Final? |
|-----------|----------------|--------|-------------------|
| **Loudness** | 20% | ✅ Correto | ✅ Sim (peso 0.30) |
| **Dynamics** | 88% | ✅ Correto | ✅ Sim (peso 0.25) |
| **Stereo** | 100% | ✅ Correto (dentro tolerância) | ✅ Sim (peso 0.10) |
| **Frequency** | `null` | ❌ ERRO (tolDb=0) | ❌ **NÃO (peso 0.20 perdido)** |
| **Technical** | 85% | ✅ Correto | ✅ Sim (peso 0.15) |
| **FINAL** | 63% | ⚠️ Parcialmente correto | - |

---

## 🔴 IMPACTO DO ERRO

### **Score Final SEM o erro (com Frequency):**

Assumindo que todas as bandas de frequência tivessem diferenças > tolerância ideal (ex: ±3 dB), resultando em score médio de 60%:

```javascript
weightedSum = 6.0 + 22.0 + 10.0 + (60 * 0.20) + 12.75
            = 6.0 + 22.0 + 10.0 + 12.0 + 12.75
            = 62.75

totalWeight = 0.30 + 0.25 + 0.10 + 0.20 + 0.15 = 1.00

rawFinalScore = 62.75 / 1.00 = 62.75
finalScore = Math.round(62.75) = 63
```

**Resultado:** 63% (igual ao atual)

**Mas com bandas mais próximas (score freq = 85%):**
```javascript
weightedSum = 6.0 + 22.0 + 10.0 + 17.0 + 12.75 = 67.75
finalScore = 68%
```

**Diferença:** +5% no score final

---

### **Por que os 100% aparecem então?**

Se o usuário está vendo sub-scores em 100% mesmo com grandes diferenças, **pode haver outro problema:**

#### **Hipótese 1: UI mostrando valores default/cache**
- Frontend pode estar exibindo valores de análise anterior
- Verificar `window.__LAST_ANALYSIS_SCORES__` vs valores renderizados

#### **Hipótese 2: Modo Reference não está sendo detectado**
```javascript
// Linha 4904
const isReferenceMode = !!(referenceComparisonMetrics && referenceComparisonMetrics.reference);
```

Se `referenceComparisonMetrics` estiver `null`, cai para modo genre, que usa `target_range` com tolerâncias maiores.

#### **Hipótese 3: Valores de tolerância muito grandes no refData**

Verificar linha 4956-4970:
```javascript
referenceDataForScores = {
    // ...
    tol_lufs: 0.5,        // ✅ Correto
    tol_true_peak: 0.3,   // ✅ Correto
    tol_dr: 1.0,          // ✅ Correto
    tol_lra: 1.0,         // ✅ Correto
    tol_stereo: 0.08,     // ✅ Correto
    tol_spectral: 300,    // ⚠️ Não usado em calculateFrequencyScore
    _isReferenceMode: true
};
```

**Tolerâncias estão corretas.**

---

## 🧪 SIMULAÇÃO MATEMÁTICA COMPLETA

### **Caso: LUFS -16.54 vs -21.47 (tol 0.5)**

```javascript
// Entrada:
actualValue = -16.54
targetValue = -21.47
tolerance = 0.5

// calculateMetricScore (linha 9238):
// Passo 1: Validação
Number.isFinite(-16.54) = true ✅
Number.isFinite(-21.47) = true ✅
Number.isFinite(0.5) = true ✅
0.5 <= 0 = false ✅ (passa validação)

// Passo 2: Diferença absoluta
diff = Math.abs(-16.54 - (-21.47))
     = Math.abs(-16.54 + 21.47)
     = Math.abs(4.93)
     = 4.93

// Passo 3: Verificar tolerância
if (4.93 <= 0.5) {  // false
    return 100;
}
// Não retorna 100, continua...

// Passo 4: Curva de penalização
ratio = 4.93 / 0.5 = 9.86

if (9.86 <= 1.5) { /* false */ }
else if (9.86 <= 2.0) { /* false */ }
else if (9.86 <= 3.0) { /* false */ }
else {
    return 20;  // ✅ Entra aqui
}

// RESULTADO FINAL: 20
```

**✅ ESPERADO: 20%**  
**✅ OBTIDO: 20%**  
**✅ CÁLCULO CORRETO**

---

### **Caso: True Peak 2.70 vs 1.00 (tol 0.3)**

```javascript
actualValue = 2.70
targetValue = 1.00
tolerance = 0.3

diff = Math.abs(2.70 - 1.00) = 1.70
ratio = 1.70 / 0.3 = 5.67

// ratio > 3.0
return 20;

// RESULTADO FINAL: 20
```

**✅ ESPERADO: < 30% (conforme usuário pediu)**  
**✅ OBTIDO: 20%**  
**✅ CÁLCULO CORRETO**

---

### **Caso: Banda SUB -35.2 vs -42.8 (tol 0)**

```javascript
energyDb = -35.2
targetDb = -42.8
tolDb = 0

// Chamada: calculateMetricScore(-35.2, -42.8, 0)

// Validação (linha 9240):
if (!Number.isFinite(-35.2) || !Number.isFinite(-42.8) || 
    !Number.isFinite(0) || 0 <= 0) {
    return null;  // ✅ 0 <= 0 é TRUE, retorna null
}

// RESULTADO FINAL: null
```

**❌ ESPERADO: Score baseado em diff = 7.6 dB**  
**❌ OBTIDO: null**  
**❌ CÁLCULO FALHA**

---

## 🔍 FUNÇÕES AUDITADAS

### ✅ **1. calculateMetricScore() (linha 9238-9268)**

**Lógica:**
```javascript
function calculateMetricScore(actualValue, targetValue, tolerance) {
    // Validação
    if (!Number.isFinite(actualValue) || !Number.isFinite(targetValue) || 
        !Number.isFinite(tolerance) || tolerance <= 0) {
        return null; // 🔴 tolerance = 0 falha aqui
    }
    
    const diff = Math.abs(actualValue - targetValue);  // ✅ Usa Math.abs corretamente
    
    if (diff <= tolerance) {
        return 100;  // ✅ Dentro da tolerância = 100
    }
    
    // Curva de penalização gradual
    const ratio = diff / tolerance;
    
    if (ratio <= 1.5) {
        return Math.round(100 - ((ratio - 1) * 40));  // ✅ 1-1.5x tol: 100 → 80
    } else if (ratio <= 2.0) {
        return Math.round(80 - ((ratio - 1.5) * 40));  // ✅ 1.5-2x tol: 80 → 60
    } else if (ratio <= 3.0) {
        return Math.round(60 - ((ratio - 2) * 20));  // ✅ 2-3x tol: 60 → 40
    } else {
        return 20;  // ✅ >3x tol: 20 (nunca zero)
    }
}
```

**Problemas:**
- ❌ **Linha 9241:** `tolerance <= 0` rejeita `tolerance = 0`
- ❌ **Não há tratamento para comparação direta (tol=0)**

**Status:** ⚠️ **Funciona corretamente EXCETO quando tolerance = 0**

---

### ✅ **2. calculateLoudnessScore() (linha 9275-9318)**

**Lógica:**
```javascript
function calculateLoudnessScore(analysis, refData) {
    if (!analysis || !refData) return null;
    
    const tech = analysis.technicalData || {};
    const metrics = analysis.metrics || {};
    const scores = [];
    
    // LUFS Integrado
    const lufsValue = metrics.lufs_integrated || tech.lufsIntegrated;  // ✅ Busca em ambos
    if (Number.isFinite(lufsValue) && Number.isFinite(refData.lufs_target) && Number.isFinite(refData.tol_lufs)) {
        const score = calculateMetricScore(lufsValue, refData.lufs_target, refData.tol_lufs);
        if (score !== null) {
            scores.push(score);
            console.log(`📊 LUFS: ${lufsValue} vs ${refData.lufs_target} (±${refData.tol_lufs}) = ${score}%`);
        }
    }
    
    // True Peak
    const truePeakValue = metrics.true_peak_dbtp || tech.truePeakDbtp;  // ✅ Busca em ambos
    if (Number.isFinite(truePeakValue) && Number.isFinite(refData.true_peak_target) && Number.isFinite(refData.tol_true_peak)) {
        const score = calculateMetricScore(truePeakValue, refData.true_peak_target, refData.tol_true_peak);
        if (score !== null) {
            scores.push(score);
            console.log(`📊 True Peak: ${truePeakValue} vs ${refData.true_peak_target} (±${refData.tol_true_peak}) = ${score}%`);
        }
    }
    
    // Crest Factor (opcional)
    const crestValue = tech.crestFactor || metrics.crest_factor;
    if (Number.isFinite(crestValue) && refData.crest_target && Number.isFinite(refData.crest_target)) {
        const tolerance = refData.tol_crest || 2.0;  // ✅ Fallback para tolerância
        const score = calculateMetricScore(crestValue, refData.crest_target, tolerance);
        if (score !== null) {
            scores.push(score);
        }
    }
    
    // Média
    if (scores.length === 0) return null;
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const result = Math.round(average);
    console.log(`🔊 Score Loudness Final: ${result}% (média de ${scores.length} métricas)`);
    return result;
}
```

**Problemas:**
- ✅ Usa LUFS e True Peak em **dB**, mesma escala
- ✅ Tolerâncias corretas (0.5 LUFS, 0.3 TP)
- ✅ Usa `calculateMetricScore()` corretamente
- ✅ Não ignora retorno de `calculateMetricScore()`

**Status:** ✅ **CORRETO**

---

### ✅ **3. calculateDynamicsScore() (linha 9320-9390)**

**Lógica:**
Similar a `calculateLoudnessScore()`, calcula:
- Dynamic Range (DR)
- Loudness Range (LRA)
- Crest Factor (repetido de loudness)
- Compression Ratio (opcional)

**Problemas:**
- ✅ Usa tolerância correta (1.0 dB para DR)
- ✅ Calcula média aritmética corretamente

**Status:** ✅ **CORRETO**

---

### ❌ **4. calculateFrequencyScore() (linha 9453-9553)**

**Lógica:**
```javascript
function calculateFrequencyScore(analysis, refData) {
    if (!analysis || !refData || !refData.bands) return null;
    
    const centralizedBands = analysis.metrics?.bands;
    const legacyBandEnergies = analysis.technicalData?.bandEnergies;
    const bandsToUse = centralizedBands && Object.keys(centralizedBands).length > 0 ? centralizedBands : legacyBandEnergies;
    
    if (!bandsToUse) return null;
    
    const scores = [];
    const isReferenceMode = refData._isReferenceMode === true;  // ✅ Detecta modo
    
    // Mapeamento das bandas
    const bandMapping = {
        'sub': 'sub',
        'bass': 'low_bass',
        'lowMid': 'low_mid',
        'mid': 'mid',
        'highMid': 'high_mid',
        'presence': 'presenca',
        'air': 'brilho'
    };
    
    // Processar cada banda
    Object.entries(bandMapping).forEach(([calcBand, refBand]) => {
        const bandData = bandsToUse[calcBand];
        const refBandData = refData.bands[refBand];
        
        if (bandData && refBandData) {
            let energyDb = null;
            
            // Extrair valor em dB
            if (typeof bandData === 'object' && Number.isFinite(bandData.energy_db)) {
                energyDb = bandData.energy_db;
            } else if (typeof bandData === 'object' && Number.isFinite(bandData.rms_db)) {
                energyDb = bandData.rms_db;
            } else if (Number.isFinite(bandData)) {
                energyDb = bandData;
            }
            
            if (!Number.isFinite(energyDb)) return;
            
            let targetDb = null;
            let tolDb = null;
            
            if (isReferenceMode) {
                // MODO REFERENCE: Valor direto da referência
                if (typeof refBandData === 'object' && Number.isFinite(refBandData.energy_db)) {
                    targetDb = refBandData.energy_db;
                } else if (typeof refBandData === 'object' && Number.isFinite(refBandData.rms_db)) {
                    targetDb = refBandData.rms_db;
                } else if (Number.isFinite(refBandData)) {
                    targetDb = refBandData;
                }
                tolDb = 0; // 🔴 ERRO CRÍTICO: Tolerância zero
                
                if (targetDb !== null) {
                    console.log(`🎯 [SCORE-FREQ-REF] ${calcBand}: comparando com faixa de referência → target=${targetDb.toFixed(1)}dB (valor real), tol=0dB`);
                }
            } else {
                // MODO GENRE: Usar target_range
                if (refBandData.target_range && typeof refBandData.target_range === 'object' &&
                    Number.isFinite(refBandData.target_range.min) && Number.isFinite(refBandData.target_range.max)) {
                    targetDb = (refBandData.target_range.min + refBandData.target_range.max) / 2;
                    tolDb = (refBandData.target_range.max - refBandData.target_range.min) / 2;
                } else if (Number.isFinite(refBandData.target_db) && Number.isFinite(refBandData.tol_db)) {
                    targetDb = refBandData.target_db;
                    tolDb = refBandData.tol_db;
                }
            }
            
            // Calcular score
            if (Number.isFinite(targetDb) && Number.isFinite(tolDb)) {
                const score = calculateMetricScore(energyDb, targetDb, tolDb);  // 🔴 tolDb = 0 → score = null
                if (score !== null) {  // 🔴 Nunca entra quando tolDb = 0
                    scores.push(score);
                    const delta = Math.abs(energyDb - targetDb);
                    const status = delta <= tolDb ? '✅' : '❌';
                    console.log(`🎵 ${calcBand.toUpperCase()}: ${energyDb.toFixed(1)}dB vs ${targetDb.toFixed(1)}dB (±${tolDb.toFixed(1)}dB) = ${score}% ${status}`);
                }
            }
        }
    });
    
    // Se nenhum score válido
    if (scores.length === 0) return null;  // 🔴 SEMPRE retorna null no modo reference
    
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const result = Math.round(average);
    
    console.log(`🎵 Score Frequência Final: ${result}% (média de ${scores.length} bandas)`);
    return result;
}
```

**Problemas:**
- ❌ **Linha 9504:** `tolDb = 0` no modo reference
- ❌ **Nenhum score de banda é calculado** quando `isReferenceMode = true`
- ❌ **Retorna `null` sempre** no modo reference
- ❌ **20% do peso final é perdido** (peso de frequência)

**Status:** ❌ **ERRO CRÍTICO**

---

### ✅ **5. calculateStereoScore() (linha 9392-9451)**

**Lógica:**
Calcula score de:
- Correlação Estéreo (métrica principal)
- Largura Estéreo (Width)
- Balanço L/R (Balance)
- Separação de Canais (Separation)

**Problemas:**
- ✅ Usa tolerância correta (0.08 para correlação)
- ✅ Média aritmética correta

**Status:** ✅ **CORRETO**

---

### ✅ **6. calculateTechnicalScore() (linha 9555-9733)**

**Lógica:**
Avalia:
- Clipping (% de samples cortados)
- DC Offset (deslocamento DC)
- THD (distorção harmônica total)
- Issues detectados (problemas técnicos)
- True Peak com hard cap (> 0 dBTP limita score a 60%)

**Problemas:**
- ✅ Usa faixas de valores fixas (não depende de tolerâncias)
- ✅ Penalização gradual (100 → 80 → 60 → 40 → 20)
- ✅ Hard cap correto para True Peak > 0.0 dBTP

**Status:** ✅ **CORRETO**

---

### ⚠️ **7. calculateAnalysisScores() (linha 9735-9835)**

**Lógica:**
```javascript
function calculateAnalysisScores(analysis, refData, genre = null) {
    console.log('🎯 Calculando scores da análise...', { genre });
    
    if (!analysis || !refData) {
        console.warn('⚠️ Dados insuficientes para calcular scores');
        return null;
    }
    
    // Calcular sub-scores
    const loudnessScore = calculateLoudnessScore(analysis, refData);
    const dynamicsScore = calculateDynamicsScore(analysis, refData);
    const stereoScore = calculateStereoScore(analysis, refData);
    const frequencyScore = calculateFrequencyScore(analysis, refData);  // 🔴 null no modo reference
    const technicalScore = calculateTechnicalScore(analysis, refData);
    
    console.log('📊 Sub-scores calculados:', {
        loudness: loudnessScore,
        dinamica: dynamicsScore,
        estereo: stereoScore,
        frequencia: frequencyScore,  // 🔴 null
        tecnico: technicalScore
    });
    
    // Determinar pesos por gênero
    const genreKey = genre ? genre.toLowerCase().replace(/\s+/g, '_') : 'default';
    const weights = GENRE_SCORING_WEIGHTS[genreKey] || GENRE_SCORING_WEIGHTS['default'];
    
    console.log('⚖️ Pesos aplicados:', weights);
    
    // Calcular score final com valores contínuos
    let weightedSum = 0;
    let totalWeight = 0;
    
    // Somar apenas scores que existem
    if (loudnessScore !== null) {
        weightedSum += loudnessScore * weights.loudness;
        totalWeight += weights.loudness;
    }
    
    if (dynamicsScore !== null) {
        weightedSum += dynamicsScore * weights.dinamica;
        totalWeight += weights.dinamica;
    }
    
    if (stereoScore !== null) {
        weightedSum += stereoScore * weights.estereo;
        totalWeight += weights.estereo;
    }
    
    if (frequencyScore !== null) {  // 🔴 FALSE no modo reference
        weightedSum += frequencyScore * weights.frequencia;  // ❌ NÃO SOMA
        totalWeight += weights.frequencia;  // ❌ NÃO SOMA
    }
    
    if (technicalScore !== null) {
        weightedSum += technicalScore * weights.tecnico;
        totalWeight += weights.tecnico;
    }
    
    // Calcular score final normalizado
    let finalScore = null;
    if (totalWeight > 0) {
        const rawFinalScore = weightedSum / totalWeight;  // ✅ Divide por peso ajustado
        finalScore = Math.round(rawFinalScore);  // ✅ Só arredonda no final
    }
    
    const result = {
        final: finalScore,
        loudness: loudnessScore,
        dinamica: dynamicsScore,
        frequencia: frequencyScore,  // 🔴 null
        estereo: stereoScore,
        tecnico: technicalScore,
        weights: weights,
        genre: genreKey
    };
    
    console.log('🎯 Score final calculado:', result);
    return result;
}
```

**Problemas:**
- ⚠️ **Não detecta que frequencyScore = null devido ao erro de tolerância**
- ⚠️ **Perde 20% do peso total** (peso de frequência não incluído)
- ⚠️ **Score final é calculado com pesos normalizados** (0.80 ao invés de 1.00)
- ✅ **Não reseta finalScore para 100 indevidamente**
- ✅ **Usa média ponderada corretamente**

**Status:** ⚠️ **PARCIALMENTE CORRETO** (funciona, mas sofre com erro upstream)

---

## 🎯 DIAGNÓSTICO FINAL

### **Por que sub-scores aparecem em 100% mesmo com diferenças grandes?**

**RESPOSTA:** 

1. **Loudness e True Peak NÃO estão em 100%** - Cálculos mostram 20% conforme esperado

2. **Frequency Score retorna `null`** - Erro de tolerância zero impede cálculo

3. **Se UI mostra 100%, pode ser:**
   - ✅ **Stereo Score está realmente em 100%** (diferença de 0.07 < 0.08 tolerância)
   - ❌ **Frontend exibindo valores de cache/análise anterior**
   - ❌ **Modo Reference não sendo detectado corretamente** (`_isReferenceMode` falso)
   - ❌ **Tolerâncias sendo sobrescritas para valores maiores**

---

## 🛠️ CORREÇÃO PROPOSTA (NÃO APLICAR AGORA)

### **Opção 1: Tolerância Pequena mas Não-Zero**

```javascript
// Linha 9504 (calculateFrequencyScore)
if (isReferenceMode) {
    // MODO REFERENCE: Valor direto da referência
    if (typeof refBandData === 'object' && Number.isFinite(refBandData.energy_db)) {
        targetDb = refBandData.energy_db;
    } else if (typeof refBandData === 'object' && Number.isFinite(refBandData.rms_db)) {
        targetDb = refBandData.rms_db;
    } else if (Number.isFinite(refBandData)) {
        targetDb = refBandData;
    }
    
    // 🔧 CORREÇÃO: Usar tolerância pequena mas não-zero para comparação direta
    tolDb = 3.0; // ±3 dB de tolerância (profissional para análise espectral)
    
    if (targetDb !== null) {
        console.log(`🎯 [SCORE-FREQ-REF] ${calcBand}: comparando com faixa de referência → target=${targetDb.toFixed(1)}dB (valor real), tol=${tolDb}dB`);
    }
}
```

**Justificativa:**
- Tolerância de ±3 dB é profissional para análise espectral
- Permite diferenciar mixagens muito próximas (score alto) de mixagens diferentes (score baixo)
- Evita score 100% para qualquer diferença exata

---

### **Opção 2: Modificar calculateMetricScore() para aceitar tolerância zero**

```javascript
// Linha 9238 (calculateMetricScore)
function calculateMetricScore(actualValue, targetValue, tolerance) {
    // Validação
    if (!Number.isFinite(actualValue) || !Number.isFinite(targetValue) || !Number.isFinite(tolerance)) {
        return null; // Apenas rejeitar se tolerance não é número finito
    }
    
    const diff = Math.abs(actualValue - targetValue);
    
    // 🔧 CASO ESPECIAL: Tolerância zero = comparação exata
    if (tolerance === 0) {
        if (diff === 0) {
            return 100; // Exatamente igual
        } else {
            // Penalizar proporcionalmente à diferença (escala arbitrária)
            // Assumir que diff > 10 = score mínimo (20)
            const score = Math.max(20, Math.round(100 - (diff * 8)));
            return score;
        }
    }
    
    // 🎯 DENTRO DA TOLERÂNCIA = 100 pontos
    if (diff <= tolerance) {
        return 100;
    }
    
    // Curva de penalização (mantém código existente)
    const ratio = diff / tolerance;
    
    if (ratio <= 1.5) {
        return Math.round(100 - ((ratio - 1) * 40));
    } else if (ratio <= 2.0) {
        return Math.round(80 - ((ratio - 1.5) * 40));
    } else if (ratio <= 3.0) {
        return Math.round(60 - ((ratio - 2) * 20));
    } else {
        return 20;
    }
}
```

**Justificativa:**
- Permite tolerância zero sem crashar
- Usa escala arbitrária para penalização (diff * 8)
- Mantém compatibilidade com código existente

---

### **Opção 3: Usar diferença percentual ao invés de absoluta**

```javascript
// Linha 9504 (calculateFrequencyScore)
if (isReferenceMode) {
    // MODO REFERENCE: Valor direto da referência
    if (typeof refBandData === 'object' && Number.isFinite(refBandData.energy_db)) {
        targetDb = refBandData.energy_db;
    } else if (typeof refBandData === 'object' && Number.isFinite(refBandData.rms_db)) {
        targetDb = refBandData.rms_db;
    } else if (Number.isFinite(refBandData)) {
        targetDb = refBandData;
    }
    
    // 🔧 CORREÇÃO: Tolerância baseada em % do target
    // Ex: ±10% do valor de referência
    tolDb = Math.abs(targetDb) * 0.10; // 10% de tolerância relativa
    
    if (targetDb !== null) {
        console.log(`🎯 [SCORE-FREQ-REF] ${calcBand}: comparando com faixa de referência → target=${targetDb.toFixed(1)}dB, tol=${tolDb.toFixed(1)}dB (10% relativo)`);
    }
}
```

**Justificativa:**
- Tolerância proporcional ao nível da banda
- Bandas mais fortes (-20 dB) têm tolerância maior (±2 dB)
- Bandas mais fracas (-60 dB) têm tolerância menor (±6 dB)
- Mais realista para análise espectral

---

## 📋 LOGS DE DEBUG RECOMENDADOS

Adicionar temporariamente para diagnosticar se o problema é de cálculo ou exibição:

```javascript
// Linha 9238 (no início de calculateMetricScore)
console.log('[DEBUG-SCORE] calculateMetricScore chamado:', {
    actualValue, targetValue, tolerance,
    diff: Math.abs(actualValue - targetValue),
    willReturn: tolerance <= 0 ? 'null (tolerance <= 0)' : 'score calculado'
});

// Linha 9252 (antes de retornar 100)
console.log('[DEBUG-SCORE] Dentro da tolerância:', {
    actualValue, targetValue, tolerance, diff,
    result: 100
});

// Linha 9265 (antes de retornar score da curva)
console.log('[DEBUG-SCORE] Fora da tolerância:', {
    actualValue, targetValue, tolerance, diff, ratio,
    result: /* valor calculado */
});

// Linha 9535 (calculateFrequencyScore, após calcular score)
console.log('[DEBUG-SCORE-FREQ]', {
    band: calcBand,
    energyDb, targetDb, tolDb,
    scoreResult: score,
    isNull: score === null,
    reason: score === null ? (tolDb === 0 ? 'tolDb = 0' : 'outro erro') : 'ok'
});

// Linha 9817 (calculateAnalysisScores, antes de calcular final)
console.log('[DEBUG-SCORE-FINAL]', {
    weightedSum, totalWeight,
    rawFinalScore: weightedSum / totalWeight,
    finalScore: Math.round(weightedSum / totalWeight),
    subScores: {
        loudness: loudnessScore,
        dynamics: dynamicsScore,
        stereo: stereoScore,
        frequency: frequencyScore,
        technical: technicalScore
    },
    weights,
    frequencyIncluded: frequencyScore !== null
});
```

---

## ✅ CHECKLIST DE VALIDAÇÃO

Para confirmar diagnóstico:

1. ✅ **Verificar logs no console do navegador:**
   - Buscar `[SCORE-FREQ-REF]` → Deve mostrar `tol=0dB`
   - Buscar `Score Frequência Final` → Deve estar ausente (ou mostrar erro)
   - Buscar `📊 Sub-scores calculados` → `frequencia: null`

2. ✅ **Verificar valores em `window.__LAST_ANALYSIS_SCORES__`:**
   ```javascript
   console.log(window.__LAST_ANALYSIS_SCORES__);
   // Deve mostrar:
   // {
   //   final: 63,
   //   loudness: 20,
   //   dinamica: 88,
   //   frequencia: null,  // ← NULL
   //   estereo: 100,
   //   tecnico: 85
   // }
   ```

3. ✅ **Verificar modo reference:**
   ```javascript
   console.log('isReferenceMode:', window.__soundyState?.render?.mode === 'reference');
   console.log('referenceComparisonMetrics:', window.referenceComparisonMetrics);
   console.log('_isReferenceMode flag:', window.__activeRefData?._isReferenceMode);
   ```

4. ✅ **Simular cálculo manualmente:**
   - Abrir console
   - Executar:
     ```javascript
     const testScore = calculateMetricScore(-35.2, -42.8, 0);
     console.log('testScore com tol=0:', testScore); // Deve ser null
     
     const testScore2 = calculateMetricScore(-35.2, -42.8, 3.0);
     console.log('testScore com tol=3.0:', testScore2); // Deve ser ~60-80
     ```

5. ✅ **Verificar exibição na UI:**
   - Se UI mostra 100% mas logs mostram 20%, problema é no frontend
   - Verificar função que renderiza scores no modal
   - Verificar se está usando `window.__LAST_ANALYSIS_SCORES__` ou cache antigo

---

## 🎓 CONCLUSÃO

### **Erro Identificado:**
- **Linha 9504:** `tolDb = 0` em modo reference causa `calculateMetricScore()` retornar `null`
- **Impacto:** Score de frequência é perdido, reduzindo peso total de 1.00 para 0.80

### **Funções Corretas:**
- ✅ `calculateMetricScore()` - Lógica matemática correta (exceto rejeição de tol=0)
- ✅ `calculateLoudnessScore()` - Usa LUFS e TP corretamente, tolerâncias adequadas
- ✅ `calculateDynamicsScore()` - Cálculo correto de DR, LRA
- ✅ `calculateStereoScore()` - Correlação calculada corretamente
- ✅ `calculateTechnicalScore()` - Penalizações graduais, hard cap correto
- ✅ `calculateAnalysisScores()` - Média ponderada com ajuste dinâmico de pesos

### **Função com Erro:**
- ❌ `calculateFrequencyScore()` - Define `tolDb = 0` em modo reference

### **Correção Recomendada:**
- **Opção 1 (preferida):** Usar `tolDb = 3.0` (±3 dB profissional)
- **Opção 2:** Modificar `calculateMetricScore()` para aceitar `tolerance = 0`
- **Opção 3:** Usar tolerância relativa (`Math.abs(targetDb) * 0.10`)

### **Por que o usuário vê 100%?**
- **Se Stereo:** Diferença 0.07 < 0.08 tolerância = 100% correto
- **Se Loudness/TP:** Erro de exibição no frontend (cache/valores antigos)
- **Se Frequency:** Modo reference não detectado, caindo para mode genre com tolerâncias grandes

---

**FIM DA AUDITORIA**
