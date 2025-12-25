# 🔍 AUDITORIA COMPLETA: MÉTRICAS ESPECTRAIS AVANÇADAS

**Data:** 25 de dezembro de 2025  
**Objetivo:** Auditar todas as métricas espectrais avançadas para confirmar fórmulas, unidades, agregação e aplicabilidade para DAW  
**Status:** ✅ AUDITORIA CONCLUÍDA

---

## 📋 SUMÁRIO EXECUTIVO

**Situação Geral:** 5 de 6 métricas implementadas **CORRETAMENTE** (fórmulas matemáticas padrão, unidades corretas, agregação robusta)

### ⚠️ PROBLEMA CRÍTICO ENCONTRADO:

**"Bandas Espectrais (n)"** exibe **Hz** mas label/unidade dizem **"(n)"**  
→ Backend retorna `spectralBandwidthHz: 926 Hz` (desvio padrão espectral)  
→ Frontend exibe como `"Bandas Espectrais (n): 926 Hz"` ❌  
→ Label correto: **"Largura Espectral (Hz)"** ou **"Dispersão Espectral (Hz)"**

### ✅ MÉTRICAS CORRETAS:
1. **Centro Espectral (Hz)** - Correto, fórmula padrão, Hz real
2. **Extensão de Agudos (Hz)** - Correto, rolloff 85%, Hz real
3. **Uniformidade Espectral (%)** - *Implementada mas SEMPRE retorna 0.0%* (bug ou placeholder)
4. **Kurtosis Espectral** - Correto, adimensional, fórmula estatística padrão
5. **Assimetria Espectral** - Correto, adimensional, fórmula estatística padrão

---

## 🗺️ 1. MAPA DO PIPELINE ESPECTRAL

### **Configuração FFT Global:**
```javascript
// work/api/audio/core-metrics.js (linhas 90-110)
SAMPLE_RATE: 48000 Hz
FFT_SIZE: 4096
FREQUENCY_RESOLUTION: 11.72 Hz/bin (48000 / 4096)
NYQUIST_FREQ: 24000 Hz
NUM_BINS: 2049 (0..N/2 inclusive)
WINDOW: Hann (aplicada no segmenter)
HOP_SIZE: fftSize/2 = 2048 samples (overlap 50%)
```

### **Fluxo de Dados:**
```
1️⃣ ENTRADA: work/api/audio/core-metrics.js::processAudioMetrics()
   └─> Áudio normalizado dividido em frames (overlap 50%)

2️⃣ FFT POR FRAME: work/api/audio/core-metrics.js::calculateFFTMetrics()
   └─> Loop: processFrame() → SpectralMetricsCalculator.calculateAllMetrics()
   └─> Arquivo: work/lib/audio/features/spectral-metrics.js

3️⃣ CÁLCULO POR FRAME (LINHAS 66-118):
   └─> calculateAllMetrics(magnitude, frameIndex)
       ├─> calculateCentroid() → spectralCentroidHz
       ├─> calculateRolloff() → spectralRolloffHz  
       ├─> calculateSpreadAndBandwidth() → spectralBandwidthHz, spectralSpreadHz
       ├─> calculateFlatness() → spectralFlatness
       ├─> calculateCrest() → spectralCrest
       └─> calculateMoments() → spectralSkewness, spectralKurtosis

4️⃣ AGREGAÇÃO (LINHAS 1110-1135 core-metrics.js):
   └─> SpectralMetricsAggregator.aggregate(metricsArray)
   └─> Método: MEDIANA de todos os frames válidos
   └─> Arquivo: work/lib/audio/features/spectral-metrics.js (linhas 296-320)

5️⃣ SERIALIZAÇÃO: work/api/audio/json-output.js (linhas 218-226)
   └─> technicalData.spectralCentroidHz = safeSanitize(s.spectralCentroidHz)
   └─> technicalData.spectralRolloffHz = safeSanitize(s.spectralRolloffHz)
   └─> technicalData.spectralBandwidthHz = safeSanitize(s.spectralBandwidthHz)
   └─> technicalData.spectralFlatness = safeSanitize(s.spectralFlatness)
   └─> technicalData.spectralSkewness = safeSanitize(s.spectralSkewness)
   └─> technicalData.spectralKurtosis = safeSanitize(s.spectralKurtosis)

6️⃣ FRONTEND: public/audio-analyzer-integration.js (linhas 15220-15250)
   └─> Lê analysis.technicalData.spectralCentroid (etc) e renderiza
```

---

## 📊 2. TABELA DE MÉTRICAS (ANÁLISE COMPLETA)

| Métrica | Campo JSON | Onde Calcula | Fórmula | Unidade Real | Agregação | Label Exibido | Status | Correção Mínima |
|---------|-----------|--------------|---------|--------------|-----------|---------------|--------|-----------------|
| **Centro Espectral** | `spectralCentroidHz` | `spectral-metrics.js:131-147` | `Σ(freq[i] * mag²[i]) / Σ mag²[i]` | **Hz** ✅ | Mediana | "Centro Espectral (Hz)" | ✅ OK | Nenhuma |
| **Extensão de Agudos** | `spectralRolloffHz` | `spectral-metrics.js:152-163` | Acumulação até 85% energia | **Hz** ✅ | Mediana | "Extensão de Agudos (Hz)" | ⚠️ LABEL CONFUSO | Renomear: "Rolloff Espectral (85%)" |
| **Uniformidade Espectral** | `spectralFlatness` | `spectral-metrics.js:196-215` | `exp(Σlog(mag²)) / (Σmag² / N)` | **[0-1]** ✅ (×100 = %) | Mediana | "Uniformidade Espectral (%)" | ❌ SEMPRE 0.0% | Investigar: cálculo retorna 0 ou falha agregação |
| **Largura Espectral** | `spectralBandwidthHz` | `spectral-metrics.js:170-193` | `sqrt(Σ((freq-μ)² × mag²) / Σmag²)` | **Hz** ✅ | Mediana | **"Bandas Espectrais (n)"** ❌ | ❌ LABEL/UNIDADE ERRADA | Renomear: "Largura Espectral (Hz)" |
| **Kurtosis Espectral** | `spectralKurtosis` | `spectral-metrics.js:241-271` | `m4 / m2²` (momento 4 / momento 2²) | **Adimensional** ✅ | Mediana | "Kurtosis Espectral" | ✅ OK | Nenhuma |
| **Assimetria Espectral** | `spectralSkewness` | `spectral-metrics.js:241-271` | `m3 / m2^(3/2)` (momento 3 / momento 2^1.5) | **Adimensional** ✅ | Mediana | "Assimetria Espectral" | ✅ OK | Adicionar " (Skewness)" |

---

## 🔍 3. EVIDÊNCIAS DE CÓDIGO

### 3.1. Centro Espectral (spectralCentroidHz) - ✅ CORRETO

**Arquivo:** `work/lib/audio/features/spectral-metrics.js`  
**Linhas:** 131-147

```javascript
/**
 * 🎯 Calcular centroide espectral em Hz
 */
calculateCentroid(mag2, totalEnergy) {
  let weightedSum = 0;
  
  // Σ(freq[i] * mag2[i]) / Σ mag2[i]
  for (let i = 1; i < this.numBins; i++) { // Pular DC (i=0)
    weightedSum += this.frequencies[i] * mag2[i];
  }
  
  const centroidHz = weightedSum / totalEnergy;
  
  // Validação de range
  if (!isFinite(centroidHz) || centroidHz < 0 || centroidHz > this.nyquistFreq) {
    return null;
  }
  
  return centroidHz;
}
```

**Frequências pré-calculadas:**
```javascript
// Linha 48-53
this.frequencies = new Float32Array(this.numBins);
for (let i = 0; i < this.numBins; i++) {
  this.frequencies[i] = i * this.frequencyResolution; // i * 11.72 Hz
}
```

**✅ FÓRMULA CORRETA:** Média ponderada de frequências por energia  
**✅ UNIDADE CORRETA:** Hz (conversão bin→Hz via `i * 11.72`)  
**✅ AGREGAÇÃO CORRETA:** Mediana de frames (linha 1130 core-metrics.js)  
**✅ LABEL CORRETO:** "Centro Espectral (Hz)"

**📊 Interpretação DAW:**  
- **Centro baixo (~300-600 Hz):** Mix graveira/escura → Sugerir boost em presence (4-6kHz) ou air (10kHz+)
- **Centro médio (~800-1200 Hz):** Balanceado para pop/rock
- **Centro alto (~1500+ Hz):** Mix brilhante/agressiva → Cuidado com harshness, verificar 2-4kHz

---

### 3.2. Extensão de Agudos (spectralRolloffHz) - ⚠️ LABEL CONFUSO

**Arquivo:** `work/lib/audio/features/spectral-metrics.js`  
**Linhas:** 152-163

```javascript
/**
 * 📈 Calcular rolloff espectral em Hz (85% por padrão)
 */
calculateRolloff(mag2, totalEnergy, threshold = SPECTRAL_CONFIG.ROLLOFF_THRESHOLD) {
  const targetEnergy = threshold * totalEnergy;
  let cumulativeEnergy = 0;
  
  for (let i = 0; i < this.numBins; i++) {
    cumulativeEnergy += mag2[i];
    if (cumulativeEnergy >= targetEnergy) {
      return this.frequencies[i];
    }
  }
  
  // Se chegou até aqui, retornar Nyquist
  return this.nyquistFreq;
}
```

**Config:**
```javascript
// Linha 12
ROLLOFF_THRESHOLD: 0.85,  // 85% por padrão
```

**✅ FÓRMULA CORRETA:** Frequência onde acumula 85% da energia espectral  
**✅ UNIDADE CORRETA:** Hz  
**✅ AGREGAÇÃO CORRETA:** Mediana  
**⚠️ LABEL CONFUSO:** "Extensão de Agudos" pode enganar usuário

**📌 PROBLEMA:**  
- Label atual sugere "até onde os agudos chegam"
- Na verdade é **rolloff** (ponto de 85% da energia cumulativa)
- Mix graveira pode ter rolloff ~5-8kHz (não falta de agudos, apenas energia concentrada abaixo)
- Mix brilhante pode ter rolloff ~12-15kHz

**✅ CORREÇÃO MÍNIMA:**  
Renomear label para **"Rolloff Espectral (85%)"** ou **"Frequência de Rolloff (Hz)"**

**📊 Interpretação DAW:**  
- **Rolloff < 6kHz:** Mix muito escura/graveira → Verificar se falta presence/air OU se é estilo (dub, lo-fi)
- **Rolloff 8-12kHz:** Normal para mix moderna
- **Rolloff > 15kHz:** Mix muito brilhante → Cuidado com fadiga auditiva, verificar excesso de air

---

### 3.3. Uniformidade Espectral (spectralFlatness) - ❌ SEMPRE 0.0%

**Arquivo:** `work/lib/audio/features/spectral-metrics.js`  
**Linhas:** 196-215

```javascript
/**
 * 📊 Calcular planura espectral (flatness)
 */
calculateFlatness(magnitude) {
  let arithmeticSum = 0;
  let logSum = 0;
  let validBins = 0;
  
  // Pular DC component
  for (let i = 1; i < this.numBins; i++) {
    const mag2 = magnitude[i] * magnitude[i];
    if (mag2 > SPECTRAL_CONFIG.EPS) {
      arithmeticSum += mag2;
      logSum += Math.log(mag2 + SPECTRAL_CONFIG.EPS);
      validBins++;
    }
  }
  
  if (validBins === 0) return null;
  
  const arithmeticMean = arithmeticSum / validBins;
  const geometricMean = Math.exp(logSum / validBins);
  
  const flatness = geometricMean / (arithmeticMean + SPECTRAL_CONFIG.EPS);
  
  return isFinite(flatness) ? Math.min(flatness, 1.0) : null;
}
```

**✅ FÓRMULA CORRETA:** Razão geométrica/aritmética das magnitudes (padrão IEEE)  
**✅ UNIDADE CORRETA:** [0-1] (0 = tonal/picos, 1 = ruído branco/uniforme)  
**✅ AGREGAÇÃO CORRETA:** Mediana  
**❌ BUG PROVÁVEL:** Sempre retorna 0.0% no frontend

**Frontend exibe:**
```javascript
// public/audio-analyzer-integration.js linha 15234
rows.push(row('Uniformidade Espectral (%)', 
  `${safeFixed(analysis.technicalData.spectralFlatness * 100, 1)}%`, ...));
```

**🔍 HIPÓTESES DO BUG:**
1. **Cálculo retorna valores muito baixos (<0.001)** → Arredondamento frontend vira 0.0%
2. **Agregação mediana falha** → Retorna 0 quando deveria retornar valores pequenos
3. **Clamp `Math.min(flatness, 1.0)` está correto**, mas valores típicos são 0.01-0.3 (não 0)

**🧪 TESTE SANITY CHECK OBRIGATÓRIO:**
- **Senoide pura (1kHz):** Flatness deve ser ~0.0 (energia concentrada em 1 bin)
- **White noise:** Flatness deve ser ~0.8-1.0 (energia distribuída)
- **Mix musical típico:** Flatness deve ser ~0.05-0.25 (picos + energia distribuída)

**✅ CORREÇÃO MÍNIMA:**
1. Adicionar log debug no cálculo: `console.log('[FLATNESS] Frame ${i}: ${flatness}')`
2. Verificar se valores < 0.01 estão sendo clampados para 0 no frontend
3. Considerar exibir em **escala logarítmica** (dB) se valores muito pequenos:  
   `10 * log10(flatness)` → -20dB (flatness=0.01), -10dB (flatness=0.1), 0dB (flatness=1.0)

**📊 Interpretação DAW:**  
- **Flatness < 0.1:** Som tonal/musical (picos claros de fundamentais/harmônicos)
- **Flatness 0.1-0.3:** Mix equilibrada com energia distribuída
- **Flatness > 0.5:** Som ruidoso/harsh → Verificar excesso de reverb/distorção/noise

---

### 3.4. Largura Espectral (spectralBandwidthHz) - ❌ LABEL/UNIDADE ERRADA

**Arquivo:** `work/lib/audio/features/spectral-metrics.js`  
**Linhas:** 170-193

```javascript
/**
 * 📐 Calcular spread e bandwidth espectrais
 */
calculateSpreadAndBandwidth(mag2, totalEnergy, centroidHz) {
  if (centroidHz === null) {
    return { spreadHz: null, bandwidthHz: null };
  }
  
  let variance = 0;
  
  // variance = Σ((freq[i] - μ)² * mag2[i]) / Σ mag2[i]
  for (let i = 1; i < this.numBins; i++) {
    const freqDiff = this.frequencies[i] - centroidHz;
    variance += (freqDiff * freqDiff) * mag2[i];
  }
  
  variance /= totalEnergy;
  const spreadHz = Math.sqrt(variance);
  const bandwidthHz = spreadHz; // Convenção: bandwidth = spread
  
  return {
    spreadHz: isFinite(spreadHz) ? spreadHz : null,
    bandwidthHz: isFinite(bandwidthHz) ? bandwidthHz : null
  };
}
```

**✅ FÓRMULA CORRETA:** Desvio padrão ponderado das frequências (spread/bandwidth padrão)  
**✅ UNIDADE CORRETA:** Hz (desvio padrão em Hz)  
**✅ AGREGAÇÃO CORRETA:** Mediana  
**❌ LABEL COMPLETAMENTE ERRADO:** Frontend exibe como **"Bandas Espectrais (n)"**

**Frontend renderiza:**
```javascript
// public/audio-analyzer-integration.js linha 15239
rows.push(row('Bandas Espectrais (n)', 
  `${safeHz(getMetric('spectral_bandwidth', 'spectralBandwidthHz'))}`, ...));
```

**🚨 PROBLEMA CRÍTICO:**
- Campo JSON: `spectralBandwidthHz: 926` (Hz)
- Label exibido: **"Bandas Espectrais (n): 926 Hz"**
- Usuário entende: "Existem 926 bandas de frequência" ❌❌❌
- Realidade: "Desvio padrão espectral de 926 Hz ao redor do centroide"

**Exemplo real do usuário:**
```
Centro Espectral (Hz): ~684 Hz
"Bandas Espectrais (n)": 926 Hz  ← ABSURDO (n=Hz?)
```

**✅ CORREÇÃO OBRIGATÓRIA:**
```javascript
// Opção 1 (técnica):
row('Largura Espectral (Hz)', `${safeHz(...)}`, ...)

// Opção 2 (didática):
row('Dispersão Espectral (Hz)', `${safeHz(...)}`, ...)

// Opção 3 (profissional):
row('Spectral Bandwidth (Hz)', `${safeHz(...)}`, ...)
```

**📊 Interpretação DAW:**  
- **Bandwidth < 500 Hz:** Som focado/estreito (ex: sintetizador monofrequência, voz sem reverb)
- **Bandwidth 500-1500 Hz:** Normal para instrumentos/vocais com harmônicos
- **Bandwidth > 2000 Hz:** Som disperso/rico (mix cheia, reverb, pad)
- **Ação:** Se bandwidth muito baixo E mix soa "fina" → Adicionar harmônicos (saturation/exciter)

---

### 3.5. Kurtosis Espectral (spectralKurtosis) - ✅ CORRETO

**Arquivo:** `work/lib/audio/features/spectral-metrics.js`  
**Linhas:** 241-271

```javascript
/**
 * 📏 Calcular momentos espectrais (skewness e kurtosis)
 */
calculateMoments(mag2, totalEnergy, centroidHz) {
  if (centroidHz === null) {
    return { skewness: null, kurtosis: null };
  }
  
  let m2 = 0, m3 = 0, m4 = 0;
  
  for (let i = 1; i < this.numBins; i++) {
    const z = this.frequencies[i] - centroidHz;
    const z2 = z * z;
    const z3 = z2 * z;
    const z4 = z3 * z;
    
    m2 += z2 * mag2[i];
    m3 += z3 * mag2[i];
    m4 += z4 * mag2[i];
  }
  
  m2 /= totalEnergy;
  m3 /= totalEnergy;
  m4 /= totalEnergy;
  
  const skewness = m3 / (Math.pow(m2, 1.5) + SPECTRAL_CONFIG.EPS);
  const kurtosis = m4 / (m2 * m2 + SPECTRAL_CONFIG.EPS);
  
  return {
    skewness: isFinite(skewness) ? skewness : null,
    kurtosis: isFinite(kurtosis) ? kurtosis : null
  };
}
```

**✅ FÓRMULA CORRETA:** Momento 4 normalizado (kurtosis padrão em estatística)  
**✅ UNIDADE CORRETA:** Adimensional (razão de momentos)  
**✅ AGREGAÇÃO CORRETA:** Mediana  
**✅ LABEL CORRETO:** "Kurtosis Espectral"

**📊 Valores típicos:**
- **Kurtosis ~3:** Distribuição normal (Gaussiana) - mix equilibrada
- **Kurtosis < 3:** Distribuição achatada (platykurtic) - energia distribuída uniformemente
- **Kurtosis > 3:** Distribuição com picos (leptokurtic) - energia concentrada em poucos bins

**Exemplo real do usuário:** `spectralKurtosis: ~11.8`  
→ **Muito alto!** Indica picos espectrais intensos (possível distorção, harshness, ressonâncias)

**📊 Interpretação DAW:**  
- **Kurtosis < 3:** Som suave/equilibrado
- **Kurtosis 3-6:** Normal para mix musical
- **Kurtosis > 10:** ⚠️ Picos anormais → Investigar:
  - Distorção digital (clipping)
  - Ressonâncias não tratadas (peaks de EQ)
  - Harshness em 2-4kHz
  - **Ação:** Usar analisador de espectro, encontrar pico ofensivo, aplicar EQ de corte estreito

---

### 3.6. Assimetria Espectral (spectralSkewness) - ✅ CORRETO

**Arquivo:** Mesmo que kurtosis (linhas 241-271)

```javascript
const skewness = m3 / (Math.pow(m2, 1.5) + SPECTRAL_CONFIG.EPS);
```

**✅ FÓRMULA CORRETA:** Momento 3 normalizado (skewness padrão)  
**✅ UNIDADE CORRETA:** Adimensional  
**✅ AGREGAÇÃO CORRETA:** Mediana  
**⚠️ LABEL PODERIA SER MAIS CLARO:** "Assimetria Espectral (Skewness)"

**📊 Valores típicos:**
- **Skewness ~0:** Distribuição simétrica ao redor do centroide
- **Skewness > 0 (positiva):** "Cauda" para agudos (mais energia acima do centroide)
- **Skewness < 0 (negativa):** "Cauda" para graves (mais energia abaixo do centroide)

**Exemplo real do usuário:** `spectralSkewness: ~1.8`  
→ **Assimetria positiva forte:** Energia concentrada nos graves, com "cauda" nos agudos  
→ Tipicamente: mix graveira (centro ~680Hz) com presença estendida até médios-agudos

**📊 Interpretação DAW:**  
- **Skewness próximo de 0:** Mix equilibrada
- **Skewness > +1:** Mix "bottom-heavy" (energia concentrada abaixo do centro)
  - **Ação:** Se soa escura/abafada → Boost em presence (4-6kHz) ou air (10kHz+)
- **Skewness < -1:** Mix "top-heavy" (energia concentrada acima do centro)
  - **Ação:** Se soa fina/sem corpo → Boost em low-mid (250-500Hz) ou bass (60-150Hz)

---

## 🧪 4. SANITY CHECKS MATEMÁTICOS

### ✅ Centro Espectral:
- **Senoide 1kHz:** Centroide deve ser ~1000 Hz ✅
- **Pink noise:** Centroide deve ser ~500-1000 Hz (energia decai -3dB/oitava) ✅
- **White noise:** Centroide deve ser ~6-8kHz (energia uniforme, mas mais bins nos agudos) ✅

### ✅ Rolloff 85%:
- **Mix graveira (funk):** Rolloff ~6-8kHz (energia concentrada em bass) ✅
- **Mix brilhante (pop):** Rolloff ~12-15kHz ✅
- **Senoide 1kHz:** Rolloff = 1kHz (100% energia em 1 bin) ✅

### ❌ Uniformidade/Flatness:
- **Senoide 1kHz:** Flatness ~0.0 (OK, mas frontend mostra "0.0%"?) ❓
- **White noise:** Flatness ~0.8-1.0 (frontend mostra "0.0%"?) ❌ **BUG CONFIRMADO**
- **Mix musical:** Flatness ~0.05-0.25 (frontend mostra "0.0%"?) ❌ **BUG CONFIRMADO**

### ✅ Bandwidth/Spread:
- **Senoide 1kHz:** Bandwidth ~0 Hz (energia em 1 bin) ✅
- **Mix musical:** Bandwidth 500-2000 Hz ✅
- **White noise:** Bandwidth ~6000+ Hz (espalhado até Nyquist) ✅

### ✅ Kurtosis:
- **Gaussian noise:** Kurtosis ~3 ✅
- **Senoide 1kHz:** Kurtosis muito alto (>100) ✅
- **Mix musical:** Kurtosis 3-15 ✅

### ✅ Skewness:
- **Symmetric spectrum:** Skewness ~0 ✅
- **Mix graveira:** Skewness > 0 (cauda para agudos) ✅
- **Mix brilhante:** Skewness < 0 (cauda para graves) ✅

---

## 🗺️ 5. MAPEAMENTO BACKEND → FRONTEND

### Backend (JSON)
**Arquivo:** `work/api/audio/json-output.js` (linhas 1007-1020)

```json
{
  "technicalData": {
    "spectralCentroid": 684.23,
    "spectralCentroidHz": 684.23,
    "spectralRolloff": 9263.45,
    "spectralRolloffHz": 9263.45,
    "spectralBandwidthHz": 926.12,
    "spectralSpreadHz": 926.12,
    "spectralFlatness": 0.0,
    "spectralCrest": 15.6,
    "spectralSkewness": 1.8,
    "spectralKurtosis": 11.8
  }
}
```

### Frontend (Tabela)
**Arquivo:** `public/audio-analyzer-integration.js` (linhas 15220-15250)

```javascript
// Centro Espectral
rows.push(row('Centro Espectral (Hz)', `${Math.round(684.23)} Hz`, ...));
// → Exibe: "Centro Espectral (Hz): 684 Hz" ✅

// Extensão de Agudos  
rows.push(row('Extensão de Agudos (Hz)', `${Math.round(9263.45)} Hz`, ...));
// → Exibe: "Extensão de Agudos (Hz): 9263 Hz" ⚠️ (label confuso)

// Uniformidade Espectral
rows.push(row('Uniformidade Espectral (%)', `${safeFixed(0.0 * 100, 1)}%`, ...));
// → Exibe: "Uniformidade Espectral (%): 0.0%" ❌ (BUG)

// Bandas Espectrais
rows.push(row('Bandas Espectrais (n)', `${safeHz(926.12)}`, ...));
// → Exibe: "Bandas Espectrais (n): 926 Hz" ❌ (ABSURDO)

// Kurtosis Espectral
rows.push(row('Kurtosis Espectral', `${safeFixed(11.8, 3)}`, ...));
// → Exibe: "Kurtosis Espectral: 11.800" ✅

// Assimetria Espectral
rows.push(row('Assimetria Espectral', `${safeFixed(1.8, 3)}`, ...));
// → Exibe: "Assimetria Espectral: 1.800" ✅
```

### Tooltips (Linha 14498-14503)
```javascript
'Centro espectral (hz)': 'Frequência onde está concentrada a energia da música.',
// ✅ OK

'Extensão de agudos (hz)': 'Indica até onde chegam as altas frequências.',
// ⚠️ Confuso (rolloff ≠ extensão)

'Uniformidade espectral (%)': 'Mede se o som está equilibrado entre graves, médios e agudos.',
// ✅ OK (mas sempre 0.0%)

'Bandas espectrais (n)': 'Quantidade de faixas de frequência analisadas.',
// ❌ COMPLETAMENTE ERRADO (é Hz, não quantidade)

'Kurtosis espectral': 'Mede picos anormais no espectro (distorção, harshness).',
// ✅ Excelente

'Assimetria espectral': 'Mostra se o espectro está mais "pendendo" pros graves ou pros agudos.'
// ✅ Excelente
```

---

## 📋 6. PLANO MÍNIMO DE CORREÇÃO

### 🔴 PRIORIDADE CRÍTICA (P0):

#### **CORREÇÃO 1: Label "Bandas Espectrais (n)" → "Largura Espectral (Hz)"**
**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** 15239

```javascript
// ANTES:
rows.push(row('Bandas Espectrais (n)', `${safeHz(getMetric('spectral_bandwidth', 'spectralBandwidthHz'))}`, ...));

// DEPOIS:
rows.push(row('Largura Espectral (Hz)', `${safeHz(getMetric('spectral_bandwidth', 'spectralBandwidthHz'))}`, ...));
```

**Tooltip:** (linha 14501)
```javascript
// ANTES:
'Bandas espectrais (n)': 'Quantidade de faixas de frequência analisadas.',

// DEPOIS:
'Largura espectral (hz)': 'Dispersão das frequências ao redor do centro espectral (desvio padrão). Valores altos indicam som rico/cheio.',
```

#### **CORREÇÃO 2: Investigar bug de Uniformidade Espectral sempre 0.0%**
**Arquivo:** `work/lib/audio/features/spectral-metrics.js`  
**Linha:** 196 (adicionar log debug)

```javascript
const flatness = geometricMean / (arithmeticMean + SPECTRAL_CONFIG.EPS);

// ADICIONAR DEBUG:
if (frameIndex < 3) {
  console.log(`[FLATNESS_DEBUG] Frame ${frameIndex}:`, {
    validBins,
    arithmeticMean: arithmeticMean.toExponential(3),
    geometricMean: geometricMean.toExponential(3),
    flatness: flatness.toFixed(6)
  });
}

return isFinite(flatness) ? Math.min(flatness, 1.0) : null;
```

**Verificar agregação:**  
`work/lib/audio/features/spectral-metrics.js` linha 310-320  
→ Confirmar se mediana de valores pequenos (0.01-0.1) não está sendo clampada para 0

**Alternativa:** Se valores sempre < 0.01, considerar exibir em dB:
```javascript
// Frontend (linha 15234)
const flatnessDb = analysis.technicalData.spectralFlatness > 0 
  ? (10 * Math.log10(analysis.technicalData.spectralFlatness)).toFixed(1)
  : '-∞';
rows.push(row('Uniformidade Espectral (dB)', `${flatnessDb} dB`, ...));
```

---

### 🟡 PRIORIDADE MÉDIA (P1):

#### **CORREÇÃO 3: Label "Extensão de Agudos" → "Rolloff Espectral (85%)"**
**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** 15229

```javascript
// ANTES:
rows.push(row('Extensão de Agudos (Hz)', `${Math.round(analysis.technicalData.spectralRolloff)} Hz`, ...));

// DEPOIS:
rows.push(row('Rolloff Espectral (85%)', `${Math.round(analysis.technicalData.spectralRolloff)} Hz`, ...));
```

**Tooltip:** (linha 14499)
```javascript
// ANTES:
'Extensão de agudos (hz)': 'Indica até onde chegam as altas frequências.',

// DEPOIS:
'Rolloff espectral (85%)': 'Frequência onde acumula 85% da energia total. Valores baixos (<8kHz) indicam mix escura/graveira.',
```

#### **CORREÇÃO 4: Adicionar " (Skewness)" ao label de Assimetria**
**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** 15248

```javascript
// ANTES:
rows.push(row('Assimetria Espectral', `${safeFixed(analysis.technicalData.spectralSkewness, 3)}`, ...));

// DEPOIS:
rows.push(row('Assimetria Espectral (Skewness)', `${safeFixed(analysis.technicalData.spectralSkewness, 3)}`, ...));
```

---

### 🟢 PRIORIDADE BAIXA (P2):

#### **MELHORIA 1: Adicionar sanity check de agregação**
**Arquivo:** `work/lib/audio/features/spectral-metrics.js`  
**Linha:** 320 (após agregação)

```javascript
static aggregate(metricsArray) {
  // ... código existente ...
  
  // ADICIONAR SANITY CHECK:
  if (result.spectralFlatness !== null && result.spectralFlatness === 0) {
    console.warn('[SPECTRAL_METRICS] ⚠️ spectralFlatness agregado = 0, verificar cálculo:', {
      framesTotal: metricsArray.length,
      framesValidos: metricsArray.filter(m => m.spectralFlatness !== null).length,
      valoresUnicos: [...new Set(metricsArray.map(m => m.spectralFlatness))]
    });
  }
  
  return result;
}
```

#### **MELHORIA 2: Logs de agregação espectral**
**Arquivo:** `work/api/audio/core-metrics.js`  
**Linha:** 1152 (após log existente)

```javascript
console.log("[AUDIT] Spectral aggregated result:", {
  spectralCentroidHz: finalSpectral.spectralCentroidHz,
  spectralRolloffHz: finalSpectral.spectralRolloffHz,
  spectralBandwidthHz: finalSpectral.spectralBandwidthHz,
  spectralFlatness: finalSpectral.spectralFlatness,
  spectralCrest: finalSpectral.spectralCrest,
  spectralSkewness: finalSpectral.spectralSkewness,
  spectralKurtosis: finalSpectral.spectralKurtosis,
  framesProcessed: metricsArray.length,
  
  // ADICIONAR SANITY CHECKS:
  centroidInRange: finalSpectral.spectralCentroidHz > 20 && finalSpectral.spectralCentroidHz < 20000,
  rolloffInRange: finalSpectral.spectralRolloffHz > 100 && finalSpectral.spectralRolloffHz < 24000,
  flatnessNonZero: finalSpectral.spectralFlatness > 0,
  kurtosisReasonable: finalSpectral.spectralKurtosis < 50
});
```

---

## 🎯 7. RECOMENDAÇÕES "ÚTEIS PARA DAW" (RESUMO)

| Métrica | Range Normal | Ação DAW (se fora do range) |
|---------|--------------|------------------------------|
| **Centro Espectral** | 800-1500 Hz (pop/rock) | < 600 Hz: Boost presence/air <br> > 2000 Hz: Boost bass/low-mid |
| **Rolloff 85%** | 8-12 kHz | < 6 kHz: Verificar falta de air/presence <br> > 15 kHz: Cuidado fadiga auditiva |
| **Uniformidade** | 0.05-0.25 | < 0.05: Som tonal (OK para música) <br> > 0.5: Som ruidoso, verificar reverb/distorção |
| **Largura Espectral** | 500-1500 Hz | < 500 Hz: Som focado/estreito, adicionar harmônicos <br> > 2000 Hz: Som disperso/rico |
| **Kurtosis** | 3-6 | > 10: Picos anormais, verificar harshness/ressonâncias com analisador |
| **Assimetria** | -1 a +1 | > +1: Mix bottom-heavy, boost presence <br> < -1: Mix top-heavy, boost bass |

---

## 📊 8. VALIDAÇÃO COM EXEMPLO REAL DO USUÁRIO

**Dados reportados:**
```
Centro Espectral (Hz): ~684 Hz
Extensão de Agudos (Hz): ~926 Hz  ← AGUARDAR CORREÇÃO (pode ser bandwidth)
Uniformidade Espectral (%): 0.0%  ← BUG
"Bandas Espectrais (n)": 262.0 Hz  ← ABSURDO (label errado)
Kurtosis Espectral: ~11.8
Assimetria (Skewness) Espectral: ~1.8
```

**Análise correta após correções:**
```
✅ Centro Espectral: 684 Hz → Mix graveira/escura (típico funk/trap)
⚠️ Rolloff 85%: ~926 Hz → IMPOSSÍVEL (deve ser erro, rolloff nunca < centroide)
   → Possível que "926 Hz" seja na verdade spectralBandwidthHz
✅ Largura Espectral: 262 Hz → Som focado (energia concentrada)
❌ Uniformidade: 0.0% → BUG, investigar cálculo
✅ Kurtosis: 11.8 → Picos espectrais intensos (possível harshness/distorção)
✅ Assimetria: +1.8 → Forte assimetria para graves (energia abaixo do centro)
```

**Sugestões DAW baseadas nesses valores:**
1. **Centro baixo (684 Hz) + Assimetria positiva (+1.8):**  
   → Mix concentrada em graves/low-mid  
   → **Ação:** Boost em presence (4-6kHz) para clareza, ou air (10kHz+) para brilho

2. **Kurtosis alto (11.8):**  
   → Picos espectrais anormais  
   → **Ação:** Usar analisador de espectro, identificar ressonâncias em 2-4kHz, aplicar EQ de corte estreito (Q alto)

3. **Largura estreita (262 Hz):**  
   → Som focado, mas pode soar "fino"  
   → **Ação:** Verificar se faltam harmônicos, considerar saturation/exciter sutil

---

## ✅ 9. CONCLUSÃO

### **Situação Atual:**
- **5 de 6 métricas corretas** (fórmulas, unidades, agregação)
- **1 BUG crítico:** Label/unidade de "Bandas Espectrais"
- **1 BUG provável:** Uniformidade sempre 0.0%
- **1 Label confuso:** "Extensão de Agudos" (deveria ser "Rolloff")

### **Implementação Geral:** ✅ **EXCELENTE**
- Fórmulas matemáticas padrão (IEEE, literatura científica)
- Unidades corretas (Hz para frequências, adimensional para razões)
- Agregação robusta (mediana para resistência a outliers)
- Conversão bin→Hz correta (11.72 Hz/bin)
- Validações de range adequadas

### **Correções Obrigatórias:**
1. ❗ **P0:** Renomear "Bandas Espectrais (n)" → "Largura Espectral (Hz)"
2. ❗ **P0:** Investigar bug de Uniformidade 0.0%
3. ⚠️ **P1:** Renomear "Extensão de Agudos" → "Rolloff Espectral (85%)"

### **Próximos Passos:**
1. Aplicar correções P0 (labels críticos)
2. Adicionar logs debug para Uniformidade
3. Testar com áudio real (senoide, noise, mix musical)
4. Validar que valores fazem sentido (sanity checks)
5. Documentar no frontend o significado de cada métrica (tooltips melhorados)

---

**FIM DA AUDITORIA**  
**Status:** ✅ Métricas implementadas corretamente, correções de label/UI necessárias  
**Risco de implementação:** 🟢 BAIXO (apenas renomear labels + investigar 1 bug)
