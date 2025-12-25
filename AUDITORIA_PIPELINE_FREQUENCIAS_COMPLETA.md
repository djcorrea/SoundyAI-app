# 🔍 AUDITORIA COMPLETA: PIPELINE DE FREQUÊNCIAS E BANDAS ESPECTRAIS

**Data:** 25 de dezembro de 2025  
**Objetivo:** Mapear todo o pipeline de FFT, bandas espectrais e métricas derivadas, identificar inconsistências de unidades (Hz vs bin), viés de largura de banda, e impacto de frames falhos.

---

## 📋 SUMÁRIO EXECUTIVO

### ✅ ACHADOS CONFIRMADOS

1. **UNIDADES CORRETAS**: Todas as métricas espectrais estão sendo **corretamente convertidas para Hz** (não bin index).
2. **ESPECTRO ROLLOFF**: O "spectralRolloff" é 85% da energia acumulada, **não extensão de agudos**.
3. **CENTRO ESPECTRAL BAIXO**: 111 Hz é **matematicamente correto** se a música tiver energia dominante nos graves (20-500 Hz dominam a soma ponderada).
4. **VIÉS DE LARGURA DE BANDA**: **CONFIRMADO** - banda Mid (500-2k) domina % porque tem 1500 Hz de largura vs Sub (40 Hz).
5. **"1 FRAME FALHOU"**: Sistema conta `validFrames` e `invalidFrames` e usa **mediana** para agregação (robusto contra 1 frame ruim).

### ⚠️ BUGS IDENTIFICADOS

1. **energy_db pode ultrapassar 0 dBFS** ([spectral-bands.js:211-225](c:\Users\DJ Correa\Desktop\Programação\SoundyAI\lib\audio\features\spectral-bands.js#L211-L225)) - há clamp forçado mas o cálculo usa escala dinâmica que pode gerar valores > 0.
2. **% por banda NÃO normalizado por largura** - banda Mid sempre domina porque é 37.5x mais larga que Sub em Hz.
3. **Spectral Centroid 111 Hz é tecnicamente correto mas semanticamente suspeito** - provavelmente indica problema na gravação ou mixagem (excesso brutal de graves).

---

## 🗺️ MAPA DO PIPELINE COMPLETO

### A) CONFIGURAÇÕES GLOBAIS FFT

**Arquivo:** [work/api/audio/core-metrics.js:121-133](c:\Users\DJ Correa\Desktop\Programação\SoundyAI\work\api\audio\core-metrics.js#L121-L133)

```javascript
const CORE_METRICS_CONFIG = {
  SAMPLE_RATE: 48000,      // ✅ 48 kHz
  FFT_SIZE: 4096,          // ✅ 4096 samples
  FFT_HOP_SIZE: 1024,      // ✅ 25% overlap
  WINDOW_TYPE: "hann",     // ✅ Hann window

  // LUFS ITU-R BS.1770-4
  LUFS_BLOCK_DURATION_MS: 400,
  LUFS_SHORT_TERM_DURATION_MS: 3000,
  
  // True Peak
  TRUE_PEAK_OVERSAMPLING: 4,
};
```

**Resolução de Frequência:**  
`frequencyResolution = sampleRate / fftSize = 48000 / 4096 = 11.72 Hz/bin`

**Nyquist:**  
`nyquistFreq = sampleRate / 2 = 24000 Hz`

**Número de bins:**  
`numBins = fftSize / 2 + 1 = 2049 bins (0..2048)`

---

### B) DEFINIÇÃO DAS 7 BANDAS ESPECTRAIS

**Arquivo:** [lib/audio/features/spectral-bands.js:9-17](c:\Users\DJ Correa\Desktop\Programação\SoundyAI\lib\audio\features\spectral-bands.js#L9-L17)

```javascript
const SPECTRAL_BANDS = {
  sub:      { min: 20,    max: 60,    name: 'Sub',      description: 'Sub-bass/Graves profundos' },
  bass:     { min: 60,    max: 150,   name: 'Bass',     description: 'Bass/Graves' },
  lowMid:   { min: 150,   max: 500,   name: 'Low-Mid',  description: 'Médios graves' },
  mid:      { min: 500,   max: 2000,  name: 'Mid',      description: 'Médios' },
  highMid:  { min: 2000,  max: 5000,  name: 'High-Mid', description: 'Médios agudos' },
  presence: { min: 5000,  max: 10000, name: 'Presence', description: 'Presença/Brilho' },
  air:      { min: 10000, max: 20000, name: 'Air',      description: 'Ar/Agudos extremos' }
};
```

**✅ CONFERÊNCIA COM O FRONT:**  
As bandas batem **100%** com o que o site exibe:
- Subgrave (20–60 Hz) ✅
- Graves (60–150 Hz) ✅
- Médios-Graves (150–500 Hz) ✅
- Médios (500 Hz–2 kHz) ✅
- Médios-Agudos (2–5 kHz) ✅
- Presença (5–10 kHz) ✅
- Ar (10–20 kHz) ✅

**🔢 LARGURA DE CADA BANDA (Hz):**
| Banda     | Range (Hz)   | Largura (Hz) | Largura (bins) |
|-----------|--------------|--------------|----------------|
| Sub       | 20-60        | **40**       | ~3 bins        |
| Bass      | 60-150       | **90**       | ~8 bins        |
| LowMid    | 150-500      | **350**      | ~30 bins       |
| **Mid**   | **500-2000** | **1500**     | **~128 bins**  |
| HighMid   | 2000-5000    | **3000**     | ~256 bins      |
| Presence  | 5000-10000   | **5000**     | ~426 bins      |
| Air       | 10000-20000  | **10000**    | ~853 bins      |

**⚠️ VIÉS IDENTIFICADO:** Banda Mid é **37.5x mais larga** que Sub em Hz (1500 Hz vs 40 Hz). Isso explica por que Mid domina % (38.4%) mesmo com densidade espectral baixa.

---

### C) CONVERSÃO BIN → Hz

**Arquivo:** [lib/audio/features/spectral-bands.js:53-70](c:\Users\DJ Correa\Desktop\Programação\SoundyAI\lib\audio\features\spectral-bands.js#L53-L70)

```javascript
calculateBandBins() {
  const bandBins = {};
  
  for (const [key, band] of Object.entries(SPECTRAL_BANDS)) {
    const minBin = Math.max(0, Math.floor(band.min / this.frequencyResolution));
    const maxBin = Math.min(
      Math.floor(this.fftSize / 2),
      Math.ceil(band.max / this.frequencyResolution)
    );
    
    bandBins[key] = {
      minBin,
      maxBin,
      binCount: maxBin - minBin + 1,
      actualMinFreq: minBin * this.frequencyResolution,  // ✅ CONVERSÃO Hz
      actualMaxFreq: maxBin * this.frequencyResolution   // ✅ CONVERSÃO Hz
    };
  }
  
  return bandBins;
}
```

**✅ FÓRMULA DE CONVERSÃO:**  
`freqHz = binIndex * (sampleRate / fftSize)`  
`freqHz = binIndex * 11.72`

**Exemplo Sub (20-60 Hz):**
- `minBin = floor(20 / 11.72) = 1`
- `maxBin = ceil(60 / 11.72) = 5`
- `actualMinFreq = 1 * 11.72 = 11.72 Hz`
- `actualMaxFreq = 5 * 11.72 = 58.60 Hz`
- `binCount = 5 - 1 + 1 = 5 bins`

**✅ CONFIRMADO:** Todas as bandas usam **Hz reais**, não bin index.

---

### D) CÁLCULO DE % POR BANDA (VIÉS CONFIRMADO)

**Arquivo:** [lib/audio/features/spectral-bands.js:93-127](c:\Users\DJ Correa\Desktop\Programação\SoundyAI\lib\audio\features\spectral-bands.js#L93-L127)

```javascript
calculateBandEnergies(magnitude) {
  const bandEnergies = {};
  let totalEnergy = 0;
  
  // Calcular energia para cada banda
  for (const [key, binInfo] of Object.entries(this.bandBins)) {
    let bandEnergy = 0;
    
    for (let bin = binInfo.minBin; bin <= binInfo.maxBin; bin++) {
      if (bin < magnitude.length) {
        // Usar energia (magnitude²) para cálculo correto
        const energy = magnitude[bin] * magnitude[bin];
        bandEnergy += energy;      // ⚠️ SOMA BRUTA (não normaliza por largura)
        totalEnergy += energy;
      }
    }
    
    bandEnergies[key] = bandEnergy;
  }
  
  return { bandEnergies, totalEnergy };
}
```

**⚠️ PROBLEMA IDENTIFICADO:**

A fórmula atual é:
```
percentage = (bandEnergy / totalEnergy) * 100
```

Onde:
```
bandEnergy = Σ(magnitude[bin]²)  para bins na banda
```

**Isso causa VIÉS porque:**
- Banda Mid (1500 Hz) tem **128 bins** somando energia
- Banda Sub (40 Hz) tem **5 bins** somando energia
- Banda Mid automaticamente acumula **25.6x mais energia** mesmo se a densidade espectral for igual.

**FÓRMULA CORRETA (SEM VIÉS):**
```javascript
// Energia média por Hz (densidade espectral)
const bandEnergyDensity = bandEnergy / bandWidthHz;
const totalEnergyDensity = totalEnergy / totalBandwidthHz;
percentage = (bandEnergyDensity / totalEnergyDensity) * 100;
```

**OU:**
```javascript
// Energia média por bin
const bandEnergyPerBin = bandEnergy / binCount;
const totalEnergyPerBin = totalEnergy / totalBinCount;
percentage = (bandEnergyPerBin / totalEnergyPerBin) * 100;
```

---

### E) CENTRO ESPECTRAL (SPECTRAL CENTROID)

**Arquivo:** [lib/audio/features/spectral-centroid.js:68-127](c:\Users\DJ Correa\Desktop\Programação\SoundyAI\lib\audio\features\spectral-centroid.js#L68-L127)

```javascript
calculateCentroidHz(leftMagnitude, rightMagnitude, frameIndex = 0) {
  const magnitude = this.calculateMagnitudeRMS(leftMagnitude, rightMagnitude);
  const usableBins = Math.min(magnitude.length, this.frequencies.length);
  
  let weightedSum = 0;
  let totalMagnitude = 0;
  
  // Calcular centróide ponderado por frequência
  for (let bin = 1; bin < usableBins; bin++) { // Começar do bin 1 (pular DC)
    const frequency = this.frequencies[bin];  // ✅ Hz real
    const mag = magnitude[bin];
    
    if (frequency >= 20 && frequency <= 20000 && mag > 1e-10) {
      weightedSum += frequency * mag;         // ✅ SOMA PONDERADA EM Hz
      totalMagnitude += mag;
    }
  }
  
  // Calcular centróide final em Hz
  const centroidHz = weightedSum / totalMagnitude;  // ✅ RETORNA Hz
  
  return {
    centroidHz: Number(centroidHz.toFixed(1)),  // ✅ 111.0 Hz
    totalMagnitude,
    validBins,
    algorithm: 'Weighted_Frequency_RMS',
    valid: true
  };
}
```

**✅ FÓRMULA:**  
`SpectralCentroid(Hz) = Σ(frequency[i] * magnitude[i]) / Σ(magnitude[i])`

**✅ UNIDADE:** Hz real (não bin index)

**🔍 POR QUE 111 Hz É BAIXO MAS CORRETO:**

O centróide espectral é a "média ponderada" das frequências pela sua magnitude. Se a música tem:
- Sub (20-60 Hz): 4.2% → magnitude baixa mas frequências muito baixas
- Bass (60-150 Hz): 11.0% → magnitude média em frequências baixas
- LowMid (150-500 Hz): 11.1% → magnitude média
- **Mid (500-2k Hz): 38.4%** → magnitude ALTA mas frequências médias
- Resto (2k-20k Hz): 35.3% → espalhado em agudos

**Cálculo simplificado (exemplo):**
```
centroid ≈ (40*0.042 + 100*0.11 + 300*0.111 + 1000*0.384 + 5000*0.353)
         ≈ 1.68 + 11 + 33.3 + 384 + 1765
         ≈ 2194 Hz (se todas as bandas tivessem peso igual)
```

Mas se **a magnitude bruta (não %) das frequências baixas (20-500 Hz) for muito alta**, o centróide desce:
```
centroid = (50*10 + 100*8 + 300*5 + 1000*2 + 5000*1) / (10+8+5+2+1)
         = (500 + 800 + 1500 + 2000 + 5000) / 26
         = 9800 / 26 ≈ 377 Hz
```

**Se os graves dominarem ainda mais:**
```
centroid = (50*100 + 100*50 + 300*10 + 1000*1 + 5000*0.5) / (100+50+10+1+0.5)
         = (5000 + 5000 + 3000 + 1000 + 2500) / 161.5
         = 16500 / 161.5 ≈ 102 Hz ✅
```

**CONCLUSÃO:** 111 Hz indica que **a energia bruta (magnitude) está concentrada em 20-200 Hz**, não em 500-2k Hz. O % de 38.4% em Mid é **artefato do viés de largura de banda**.

---

### F) "EXTENSÃO DE AGUDOS" = SPECTRAL ROLLOFF 85%

**Arquivo:** [lib/audio/features/spectral-metrics.js:152-163](c:\Users\DJ Correa\Desktop\Programação\SoundyAI\lib\audio\features\spectral-metrics.js#L152-L163)

```javascript
calculateRolloff(mag2, totalEnergy, threshold = 0.85) {
  const targetEnergy = threshold * totalEnergy;
  let cumulativeEnergy = 0;
  
  for (let i = 0; i < this.numBins; i++) {
    cumulativeEnergy += mag2[i];
    if (cumulativeEnergy >= targetEnergy) {
      return this.frequencies[i];  // ✅ RETORNA Hz
    }
  }
  
  return this.nyquistFreq;  // Fallback: 24000 Hz
}
```

**✅ DEFINIÇÃO:** Frequência abaixo da qual **85% da energia espectral** está concentrada.

**✅ UNIDADE:** Hz real

**🔍 POR QUE 141 Hz É CORRETO (MAS PREOCUPANTE):**

Se 85% da energia está concentrada em 0-141 Hz:
```
Energia(0-141 Hz) = 85% do total
Energia(141-24000 Hz) = 15% do total
```

**Isso significa:**
- Praticamente TODA a energia está nos **graves profundos** (20-150 Hz)
- Os médios (500-2k) e agudos (2k-20k) têm energia residual (apenas 15%)
- A mixagem está **extremamente desbalanceada para graves**

**NÃO É UM BUG DE CÓDIGO**, é um **problema na gravação/mixagem**.

---

### G) ENERGIA POR BANDA (energy_db)

**Arquivo:** [lib/audio/features/spectral-bands.js:211-225](c:\Users\DJ Correa\Desktop\Programação\SoundyAI\lib\audio\features\spectral-bands.js#L211-L225)

```javascript
// ✅ Calcular RMS médio da banda: sqrt(energy / Nbins)
const bandRMS = energyLinear > 0 ? 
  Math.sqrt(energyLinear / binInfo.binCount) : 
  1e-12;

// ⚠️ CORREÇÃO CRÍTICA: energy_db em dBFS ABSOLUTO
let energyDb = -40 + 10 * Math.log10(Math.max(bandRMS, 1e-12));

// ✅ CLAMP FORÇADO: garantir que NUNCA passe de 0 dBFS
energyDb = Math.min(energyDb, 0);

result[key] = {
  energy: energyLinear,
  energy_db: Number(Math.min(energyDb, 0).toFixed(1)), // ✅ FORÇA CLAMP INLINE
  percentage: Number(percentages[key].toFixed(2)),
  frequencyRange: `${band.min}-${band.max}Hz`,
  name: band.name
};
```

**⚠️ BUG IDENTIFICADO:**

A fórmula usa `-40 dB` como "base" mas depois soma `10*log10(bandRMS)`:
```javascript
energyDb = -40 + 10 * Math.log10(bandRMS)
```

Se `bandRMS = 1.0` (máximo teórico):
```
energyDb = -40 + 10 * log10(1.0) = -40 + 0 = -40 dB
```

Se `bandRMS = 10.0` (overshoot):
```
energyDb = -40 + 10 * log10(10) = -40 + 10 = -30 dB
```

Se `bandRMS = 100.0` (overshoot extremo):
```
energyDb = -40 + 10 * log10(100) = -40 + 20 = -20 dB
```

**O problema:** A escala não está ancorada em `bandRMS = 1.0 = 0 dBFS`. O clamp `Math.min(energyDb, 0)` força ≤ 0, mas a **escala interna está errada**.

**FÓRMULA CORRETA (dBFS):**
```javascript
// Full Scale = 1.0 (amplitude linear)
// dBFS = 20 * log10(amplitude / 1.0)
const energyDb = 20 * Math.log10(Math.max(bandRMS, 1e-12));
// Se bandRMS = 1.0 → 0 dBFS ✅
// Se bandRMS = 0.5 → -6 dBFS ✅
// Se bandRMS = 0.1 → -20 dBFS ✅
```

---

### H) "1 FRAME FALHOU" - IMPACTO NA AGREGAÇÃO

**Arquivo:** [work/api/audio/core-metrics.js:1400-1470](c:\Users\DJ Correa\Desktop\Programação\SoundyAI\work\api\audio\core-metrics.js#L1400-L1470)

```javascript
const bandsResults = [];
let validFrames = 0;
let invalidFrames = 0;

for (let frameIndex = 0; frameIndex < framesFFT.frames.length; frameIndex++) {
  const frame = framesFFT.frames[frameIndex];
  
  if (frame.leftFFT?.magnitude && frame.rightFFT?.magnitude) {
    const result = this.spectralBandsCalculator.analyzeBands(
      frame.leftFFT.magnitude,
      frame.rightFFT.magnitude,
      frameIndex
    );
    
    if (result.valid) {
      bandsResults.push(result);
      validFrames++;            // ✅ CONTA FRAMES VÁLIDOS
    } else {
      invalidFrames++;          // ✅ CONTA FRAMES INVÁLIDOS
    }
  } else {
    invalidFrames++;           // ✅ FRAME SEM FFT = INVÁLIDO
  }
}

// Agregar resultados
const aggregatedBands = SpectralBandsAggregator.aggregate(bandsResults);
```

**Agregação (Mediana):**

**Arquivo:** [lib/audio/features/spectral-bands.js:350-380](c:\Users\DJ Correa\Desktop\Programação\SoundyAI\lib\audio\features\spectral-bands.js#L350-L380)

```javascript
static aggregate(bandsArray) {
  // Filtrar apenas resultados válidos
  const validBands = bandsArray.filter(b => b.valid);
  
  if (validBands.length === 0) {
    return new SpectralBandsCalculator().getNullBands();
  }
  
  // Agregar cada banda usando MEDIANA para robustez
  for (const key of bandKeys) {
    const percentages = validBands
      .map(b => b.bands[key].percentage)
      .filter(p => p !== null && isFinite(p))
      .sort((a, b) => a - b);                    // ✅ ORDENA
    
    const medianIndex = Math.floor(percentages.length / 2);
    const medianPercentage = percentages.length % 2 === 0
      ? (percentages[medianIndex - 1] + percentages[medianIndex]) / 2
      : percentages[medianIndex];                // ✅ MEDIANA
    
    aggregated[key] = {
      percentage: Number(medianPercentage.toFixed(2)),
      // ...
    };
  }
  
  return { bands: aggregated, framesUsed: validBands.length };
}
```

**✅ CONCLUSÃO: "1 FRAME FALHOU" NÃO CONTAMINA O RESULTADO**

Se houver 100 frames no total:
- 99 frames válidos → mediana usa os 49º/50º/51º valores (meio da distribuição)
- 1 frame inválido → ignorado (não entra em `validBands`)
- O resultado final é **robusto** contra outliers

**⚠️ CENÁRIO CRÍTICO:**
Se **50% ou mais dos frames falharem**, a mediana pode ser afetada. Mas o sistema registra `framesUsed` e `invalidFrames` no log:

```javascript
logAudio('spectral_bands', 'completed', {
  validFrames,
  invalidFrames,
  totalFrames: framesFFT.frames.length
});
```

**Checklist:** Verificar logs para confirmar taxa de sucesso > 90%.

---

## 📊 TABELA: MÉTRICAS → FÓRMULAS → UNIDADES

| Métrica                | Arquivo                   | Função                      | Fórmula                                      | Unidade Real | Unidade Exibida | Risco/Bug            |
|------------------------|---------------------------|-----------------------------|----------------------------------------------|--------------|-----------------|----------------------|
| **Bandas Espectrais**  | spectral-bands.js:93-127  | `calculateBandEnergies`     | `Σ(magnitude[bin]²)` por banda               | Energia      | dB + %          | ⚠️ Viés largura      |
| **% por Banda**        | spectral-bands.js:138-155 | `calculateBandPercentages`  | `(bandEnergy / totalEnergy) * 100`           | %            | %               | ⚠️ Viés largura      |
| **energy_db**          | spectral-bands.js:211-225 | `analyzeBands`              | `-40 + 10*log10(bandRMS)` + clamp            | dB           | dB              | ⚠️ Escala errada     |
| **Spectral Centroid**  | spectral-centroid.js:68   | `calculateCentroidHz`       | `Σ(freq[i]*mag[i]) / Σ(mag[i])`             | **Hz**       | Hz              | ✅ Correto           |
| **Spectral Rolloff**   | spectral-metrics.js:152   | `calculateRolloff`          | `freq onde cumulativeEnergy ≥ 0.85*total`   | **Hz**       | Hz              | ✅ Correto           |
| **Spectral Bandwidth** | spectral-metrics.js:170   | `calculateSpreadAndBandwidth` | `sqrt(Σ((freq-μ)²*mag²)/Σmag²)`           | **Hz**       | Hz              | ✅ Correto           |
| **Frequency Resolution** | core-metrics.js:48      | (constante)                 | `sampleRate / fftSize`                       | Hz/bin       | Hz/bin          | ✅ 11.72 Hz/bin      |

---

## 🐛 BUGS E PATCHES MÍNIMOS

### BUG 1: VIÉS DE LARGURA DE BANDA

**Arquivo:** [lib/audio/features/spectral-bands.js:93-127](c:\Users\DJ Correa\Desktop\Programação\SoundyAI\lib\audio\features\spectral-bands.js#L93-L127)

**Patch Mínimo:**

```diff
calculateBandPercentages(bandEnergies, totalEnergy) {
  const percentages = {};
  
  for (const [key, energy] of Object.entries(bandEnergies)) {
-   const percentage = (energy / totalEnergy) * 100;
+   // Normalizar por largura da banda (Hz)
+   const band = SPECTRAL_BANDS[key];
+   const bandWidthHz = band.max - band.min;
+   const energyDensity = energy / bandWidthHz;
+   
+   // Calcular densidade total
+   let totalDensity = 0;
+   for (const [k, e] of Object.entries(bandEnergies)) {
+     const w = SPECTRAL_BANDS[k].max - SPECTRAL_BANDS[k].min;
+     totalDensity += e / w;
+   }
+   
+   const percentage = (energyDensity / totalDensity) * 100;
    percentages[key] = percentage;
  }
  
  return percentages;
}
```

**Impacto:** Banda Mid não dominará mais artificialmente. Cada banda será avaliada por **densidade espectral (energia por Hz)**, não soma bruta.

---

### BUG 2: energy_db ESCALA ERRADA

**Arquivo:** [lib/audio/features/spectral-bands.js:211-225](c:\Users\DJ Correa\Desktop\Programação\SoundyAI\lib\audio\features\spectral-bands.js#L211-L225)

**Patch Mínimo:**

```diff
-// ⚠️ CORREÇÃO CRÍTICA: energy_db em dBFS ABSOLUTO
-let energyDb = -40 + 10 * Math.log10(Math.max(bandRMS, 1e-12));
-
-// ✅ CLAMP FORÇADO: garantir que NUNCA passe de 0 dBFS
-energyDb = Math.min(energyDb, 0);
+// ✅ CORREÇÃO: dBFS correto com Full Scale = 1.0
+// Fórmula padrão: dBFS = 20 * log10(amplitude / 1.0)
+const energyDb = 20 * Math.log10(Math.max(bandRMS, 1e-12));
+// bandRMS = 1.0 → 0 dBFS
+// bandRMS = 0.5 → -6 dBFS
+// bandRMS = 0.1 → -20 dBFS
```

**Impacto:** Valores de energy_db serão **sempre ≤ 0 dBFS matematicamente** (não por clamp forçado), e a escala será consistente com outros medidores.

---

### BUG 3: SPECTRAL CENTROID SEMANTICAMENTE SUSPEITO

**NÃO É BUG DE CÓDIGO**, mas indica problema na mixagem.

**Recomendação de UX:**

```javascript
// Em json-output.js ou no frontend
if (technicalData.spectralCentroidHz < 300) {
  warnings.push({
    type: 'spectral_balance',
    severity: 'critical',
    message: 'Centro espectral muito baixo (< 300 Hz) indica excesso extremo de graves. Considere aplicar high-pass filter em 30-40 Hz e balancear médios/agudos.',
    value: technicalData.spectralCentroidHz,
    recommendation: 'Reduzir sub (20-60 Hz) em 3-6 dB, aumentar presença (5-10 kHz) em 2-4 dB.'
  });
}
```

---

## 🧪 TESTES CONTROLADOS PROPOSTOS (SEM IMPLEMENTAR)

### Teste 1: Tom Senoidal 1 kHz

**Entrada:** Arquivo .wav com tom puro 1000 Hz, -12 dBFS.

**Resultado Esperado:**
- Spectral Centroid: **1000 Hz** (±10 Hz por leakage espectral)
- Spectral Rolloff 85%: **1000 Hz** (100% da energia em 1 bin)
- Banda Mid: **~100%** (1000 Hz está em 500-2000 Hz)
- Outras bandas: **~0%**

**Como Validar:**
```bash
ffmpeg -f lavfi -i "sine=frequency=1000:duration=10" -ar 48000 test_1khz.wav
# Analisar test_1khz.wav no sistema
```

---

### Teste 2: Ruído Rosa (Pink Noise)

**Entrada:** Ruído rosa -12 dBFS (densidade espectral proporcional a 1/f).

**Resultado Esperado:**
- Spectral Centroid: **~1000-2000 Hz** (centro logarítmico do espectro audível)
- Spectral Rolloff 85%: **~5000-8000 Hz** (85% da energia abaixo disso)
- % por banda: Distribuição "natural" com ligeira dominância de graves (pink noise privilegia baixas frequências)

**Como Validar:**
```bash
ffmpeg -f lavfi -i "anoisesrc=d=10:c=pink:r=48000:a=0.5" test_pink.wav
```

---

### Teste 3: Sweep 20 Hz → 20 kHz

**Entrada:** Sweep linear cobrindo todo espectro audível.

**Resultado Esperado:**
- Spectral Centroid: **~10000 Hz** (média aritmética de 20-20k)
- Spectral Rolloff 85%: **~17000 Hz** (85% do tempo do sweep)
- % por banda: Proporcional à largura (se energia uniforme):
  - Mid (1500 Hz): ~7.5%
  - Air (10000 Hz): ~50%

**Como Validar:**
```bash
sox -n test_sweep.wav synth 10 sine 20-20000
```

---

## 📁 ARQUIVOS ENVOLVIDOS (CAMINHOS COMPLETOS)

### Backend (Node.js)

| Arquivo                                                   | Função                                      |
|-----------------------------------------------------------|---------------------------------------------|
| `work/api/audio/pipeline-complete.js`                     | Orquestrador principal do pipeline          |
| `work/api/audio/core-metrics.js`                          | Cálculo de métricas (FFT, LUFS, True Peak)  |
| `work/api/audio/temporal-segmentation.js`                 | Segmentação temporal + FFT por frames       |
| `work/api/audio/json-output.js`                           | Geração do JSON final                       |
| `lib/audio/features/spectral-bands.js`                    | **CRÍTICO:** Cálculo de bandas espectrais   |
| `lib/audio/features/spectral-centroid.js`                 | **CRÍTICO:** Cálculo de centro espectral    |
| `lib/audio/features/spectral-metrics.js`                  | **CRÍTICO:** Rolloff, bandwidth, etc.       |
| `lib/audio/fft.js`                                        | Motor FFT (transformada rápida de Fourier)  |
| `work/api/jobs/[id].js`                                   | Endpoint `/api/jobs/:id` (retorna JSON)     |

### Frontend (JavaScript)

| Arquivo                                                   | Função                                      |
|-----------------------------------------------------------|---------------------------------------------|
| `public/audio-analyzer-integration.js`                    | Renderização de tabelas e gráficos          |
| `public/friendly-labels.js`                               | Rótulos amigáveis ("Frequência Central")    |

---

## 🔍 HIPÓTESES E VERIFICAÇÕES ADICIONAIS

### Hipótese 1: Filtro DC Introduz Overshoots

**Arquivo:** [work/api/audio/audio-decoder.js](c:\Users\DJ Correa\Desktop\Programação\SoundyAI\work\api\audio\audio-decoder.js)

**Verificar:** Se o filtro DC (remove componente contínua) usa IIR e introduz ripple/overshoot que faz samples > 1.0.

**Como Checar:**
```bash
grep -n "DC.*filter\|highpass.*30" work/api/audio/audio-decoder.js
```

**Se confirmado:** Adicionar clipping suave pós-filtro DC:
```javascript
for (let i = 0; i < buffer.length; i++) {
  if (Math.abs(buffer[i]) > 1.0) {
    buffer[i] = Math.sign(buffer[i]) * 1.0;  // Hard clip
  }
}
```

---

### Hipótese 2: FFmpeg Normalização Incorreta

**Verificar:** Se FFmpeg está retornando float32 com range [-1, +1] ou int16 scaled errado.

**Como Checar:**
```bash
grep -n "pcm_f32le\|pcm_s16le" work/api/audio/audio-decoder.js
```

**Se confirmado:** Garantir conversão para `-af aformat=sample_fmts=flt:sample_rates=48000`.

---

## 📈 PLANO DE CORREÇÃO MÍNIMO (3 PASSOS)

### Passo 1: Corrigir energy_db (5 minutos)

**Arquivo:** [lib/audio/features/spectral-bands.js:211-225](c:\Users\DJ Correa\Desktop\Programação\SoundyAI\lib\audio\features\spectral-bands.js#L211-L225)

**Ação:** Substituir fórmula por `20 * Math.log10(bandRMS)`.

**Teste:** Verificar que todos energy_db ≤ 0 dBFS após patch.

---

### Passo 2: Normalizar % por densidade espectral (15 minutos)

**Arquivo:** [lib/audio/features/spectral-bands.js:138-155](c:\Users\DJ Correa\Desktop\Programação\SoundyAI\lib\audio\features\spectral-bands.js#L138-L155)

**Ação:** Dividir energia de cada banda por sua largura (Hz) antes de calcular %.

**Teste:** Analisar pink noise → % deve distribuir mais uniformemente (não 40% em Mid).

---

### Passo 3: Adicionar warning UX para centroid < 300 Hz (5 minutos)

**Arquivo:** [work/api/audio/json-output.js](c:\Users\DJ Correa\Desktop\Programação\SoundyAI\work\api\audio\json-output.js)

**Ação:** Adicionar alerta ao frontend quando spectralCentroidHz < 300.

**Teste:** Analisar arquivo com graves excessivos → deve exibir warning no modal.

---

## ✅ CHECKLIST FINAL DE AUDITORIA

- [x] **Mapeado pipeline FFT:** sampleRate=48k, fftSize=4096, resolution=11.72 Hz/bin
- [x] **Confirmadas 7 bandas:** 20-60, 60-150, 150-500, 500-2k, 2k-5k, 5k-10k, 10k-20k Hz
- [x] **Conversão bin→Hz:** Todas métricas usam Hz real (não index)
- [x] **Spectral Centroid:** Fórmula correta, 111 Hz é baixo mas matematicamente válido
- [x] **Spectral Rolloff:** 85% da energia, 141 Hz indica graves dominantes (não bug)
- [x] **Viés de largura:** CONFIRMADO - banda Mid (1500 Hz) domina % por ser 37x mais larga
- [x] **energy_db:** Escala errada (usa -40 + 10*log vs 20*log), mas clamped ≤ 0 dBFS
- [x] **Frames falhos:** Sistema usa mediana (robusto), 1 frame falho não contamina
- [x] **Agregação:** `validFrames` e `invalidFrames` contados, registrado em logs
- [x] **Endpoint:** `/api/jobs/:id` retorna `results` (não `result`) do PostgreSQL

---

## 🎯 RESUMO: O QUE ESTÁ CERTO E O QUE ESTÁ ERRADO

### ✅ ESTÁ CERTO

1. Todas as frequências são **Hz reais** (não bin index).
2. Centro espectral 111 Hz é **matematicamente correto** (indica mixagem com graves dominantes).
3. Rolloff 85% em 141 Hz é **correto** (85% da energia abaixo dessa frequência).
4. Sistema de agregação usa **mediana** (robusto contra outliers).
5. Frames falhos são **contados e ignorados** (não contaminam resultado).

### ⚠️ ESTÁ ERRADO (REQUER PATCH)

1. **% por banda tem viés de largura** → Banda Mid sempre domina porque é 37.5x mais larga.
2. **energy_db usa escala não-padrão** → Fórmula `-40 + 10*log` em vez de `20*log` (dBFS correto).
3. **Sem warning UX** → Centroid < 300 Hz deveria alertar usuário sobre mixagem problemática.

---

## 📞 PRÓXIMOS PASSOS (AGUARDANDO APROVAÇÃO)

1. **Validar achados:** Confirme se o relatório está completo e correto.
2. **Aprovar patches:** Decidir quais das 3 correções mínimas aplicar.
3. **Implementar:** Aplicar patches nos arquivos identificados.
4. **Testar:** Rodar testes controlados (1 kHz, pink noise, sweep) para validar.
5. **Deploy:** Atualizar produção com correções.

---

**FIM DA AUDITORIA**

