# 🛡️ Guardrails Specification: AutoMaster V1

**Versão:** 1.0  
**Data:** 09 de fevereiro de 2026  
**Responsável:** Audio Engineer + Backend Lead

---

## Introdução

Este documento define **guardrails mensuráveis e executáveis** para o AutoMaster V1.  
Cada guardrail especifica:
1. **O que mede** (métrica)
2. **Unidade de medida**
3. **Janela de análise** (tempo ou frames)
4. **Threshold** (limite aceitável)
5. **Método de cálculo robusto** (algoritmo, lib, fórmula)
6. **Ação** em caso de violação (FAIL job, fallback, warn)

---

## Tier System

### Tier 1: BLOQUEADOR 🔴
Violação → **job FAIL imediatamente**, não entregar áudio.  
Exemplo: Clipping, True Peak > 0.0 dBTP.

### Tier 2: FALLBACK 🟡
Violação → **tentar fallback conservador** (max 1 vez).  
Exemplo: DR abaixo do mínimo, LUFS muito longe do target.

### Tier 3: WARNING ⚠️
Violação → **entregar áudio mas avisar usuário**.  
Exemplo: Banda espectral 2 dB fora do target.

---

## 1. LUFS (Loudness Integrated)

### Definição
Loudness integrado conforme **ITU-R BS.1770-4**, medindo percepção de volume.

### Unidade
**LU** (Loudness Units) ou **LUFS** (equivalente a dBFS mas com K-weighting).

### Janela de Análise
**Áudio completo** (integrated loudness), usando gating absoluto (-70 LUFS) e relativo (-10 LU abaixo do loudness).

### Método de Cálculo Robusto

#### Opção A: FFmpeg (RECOMENDADO)
```bash
ffmpeg -i input.wav -af ebur128=framelog=verbose -f null -
```
Parse output:
```
I: -9.2 LUFS
```

**Pros:**
- Padrão da indústria
- Implementação verificada e auditada
- Usado por broadcasters (EBU, ATSC)

**Contras:**
- Depende de binary externo (FFmpeg)

#### Opção B: Biblioteca JS (loudness.js existente)
```javascript
// Reutilizar lib/audio/features/loudness.js
const { calculateLUFS } = require('./lib/audio/features/loudness.js');
const lufs = calculateLUFS(audioBuffer, sampleRate);
```

**Pros:**
- Já implementado no sistema
- Sem dependência externa

**Contras:**
- Precisa validação contra padrão (comparar com FFmpeg)

#### Escolha Recomendada
**Opção A (FFmpeg)** para AutoMaster, por confiabilidade.  
Manter Opção B para análise (já funciona).

### Thresholds por Modo

| Modo | Target LUFS | Tolerância | Tier | Ação |
|------|-------------|-----------|------|------|
| IMPACT | target_genre - 2 LU | ±1.0 LU | 🟡 Tier 2 | Se fora: fallback conservador |
| BALANCED | target_genre | ±1.0 LU | 🟡 Tier 2 | Se fora: fallback conservador |
| CLEAN | target_genre + 2 LU | ±1.0 LU | 🟡 Tier 2 | Se fora: fallback conservador |

**Exemplo:**
- Gênero: funk_mandela (target -9 LUFS)
- Modo IMPACT: target -7 LUFS, aceitar -8.0 a -6.0 LUFS
- Se resultado = -5.0 LUFS (muito alto): → fallback com gain -2 dB

### Código de Validação
```javascript
function validateLUFS(measuredLUFS, targetLUFS, mode) {
  const tolerance = 1.0; // LU
  const delta = Math.abs(measuredLUFS - targetLUFS);
  
  if (delta <= tolerance) {
    return { valid: true, severity: 'OK' };
  } else if (delta <= 2.0) {
    return { valid: false, severity: 'FALLBACK', message: `LUFS fora da tolerância (${measuredLUFS} vs ${targetLUFS})` };
  } else {
    return { valid: false, severity: 'FAIL', message: `LUFS muito longe do target (delta ${delta.toFixed(1)} LU)` };
  }
}
```

---

## 2. True Peak

### Definição
**Pico inter-sample** (overshoot entre samples digitais), calculado via oversampling.

### Unidade
**dBTP** (dB True Peak)

### Janela de Análise
**Áudio completo**, analisando todos os samples após oversampling 4x.

### Método de Cálculo Robusto

#### Opção A: FFmpeg ebur128 (RECOMENDADO)
```bash
ffmpeg -i input.wav -af ebur128=peak=true -f null -
```
Parse output:
```
Peak: -0.3 dBTP
```

**Pros:**
- Mesmo binary usado para LUFS (consistência)
- Algoritmo ITU-R BS.1770-4 oficial

**Contras:**
- Lento (oversampling 4x é custoso)

#### Opção B: Lib JS (truepeak-ffmpeg.js existente)
```javascript
// Reutilizar lib/audio/features/truepeak-ffmpeg.js
const truePeak = await calculateTruePeakFFmpeg(filePath);
```

**Pros:**
- Já implementado

**Contras:**
- Ainda depende de FFmpeg via exec

#### Escolha Recomendada
**Opção A** (chamar FFmpeg uma vez para LUFS+TP simultaneamente).

### Thresholds por Modo

| Modo | Ceiling (dBTP) | Tier | Ação |
|------|---------------|------|------|
| IMPACT | **-0.1** | 🔴 Tier 1 | Se TP > -0.1: **job FAIL** |
| BALANCED | **-0.3** | 🔴 Tier 1 | Se TP > -0.3: **job FAIL** |
| CLEAN | **-0.5** | 🔴 Tier 1 | Se TP > -0.5: **job FAIL** |

### ABSOLUTO HARD LIMIT

**QUALQUER modo:**
- Se `True Peak > 0.0 dBTP` → **job FAIL imediatamente**

### Código de Validação
```javascript
function validateTruePeak(measuredTP, mode) {
  const ceilings = {
    impact: -0.1,
    balanced: -0.3,
    clean: -0.5
  };
  
  const ceiling = ceilings[mode];
  
  // BLOQUEADOR ABSOLUTO
  if (measuredTP > 0.0) {
    return { valid: false, severity: 'CRITICAL', message: `CLIPPING DETECTADO: True Peak = ${measuredTP.toFixed(2)} dBTP` };
  }
  
  // CEILING DO MODO
  if (measuredTP > ceiling) {
    return { valid: false, severity: 'FAIL', message: `True Peak acima do ceiling (${measuredTP.toFixed(2)} vs ${ceiling} dBTP)` };
  }
  
  return { valid: true, severity: 'OK' };
}
```

---

## 3. Dynamic Range (DR)

### Definição
**TT-DR** (padrão Pleasurize Music Foundation), medindo diferença entre picos e loudness médio.

### Unidade
**dB**

### Janela de Análise
**Frames de 3 segundos** com hop de 1 segundo.

### Método de Cálculo Robusto

#### Fórmula TT-DR:
```
DR = Peak RMS (20% maiores frames) - Média RMS (todos os frames)
```

#### Algoritmo:
1. Dividir áudio em frames de 3s (hop 1s)
2. Calcular RMS de cada frame
3. Ordenar RMS em ordem decrescente
4. Peak RMS = média dos top 20% frames
5. Avg RMS = média de todos os frames
6. DR = 20 × log10(Peak RMS / Avg RMS)

#### Código de Referência:
```javascript
// Reutilizar lib/audio/features/dynamics-corrected.js
function calculateDR(audioBuffer, sampleRate) {
  const frameDuration = 3.0; // segundos
  const hopDuration = 1.0; // segundos
  const frameSize = Math.floor(frameDuration * sampleRate);
  const hopSize = Math.floor(hopDuration * sampleRate);
  
  const rmsValues = [];
  
  for (let i = 0; i + frameSize <= audioBuffer.length; i += hopSize) {
    const frame = audioBuffer.slice(i, i + frameSize);
    const rms = Math.sqrt(frame.reduce((sum, s) => sum + s * s, 0) / frame.length);
    rmsValues.push(rms);
  }
  
  rmsValues.sort((a, b) => b - a); // decrescente
  
  const top20Count = Math.ceil(rmsValues.length * 0.2);
  const peakRMS = rmsValues.slice(0, top20Count).reduce((sum, v) => sum + v, 0) / top20Count;
  const avgRMS = rmsValues.reduce((sum, v) => sum + v, 0) / rmsValues.length;
  
  const dr = 20 * Math.log10(peakRMS / avgRMS);
  return dr;
}
```

### Thresholds por Modo

| Modo | DR Mínimo | Tier | Ação |
|------|-----------|------|------|
| IMPACT | **6 dB** | 🟡 Tier 2 | Se DR < 6: fallback com menos compressão |
| BALANCED | **7 dB** | 🟡 Tier 2 | Se DR < 7: fallback |
| CLEAN | **9 dB** | 🟡 Tier 2 | Se DR < 9: fallback |

### Código de Validação
```javascript
function validateDR(measuredDR, mode) {
  const minDR = {
    impact: 6,
    balanced: 7,
    clean: 9
  };
  
  const minimum = minDR[mode];
  
  if (measuredDR < minimum) {
    return { 
      valid: false, 
      severity: 'FALLBACK', 
      message: `DR muito baixo (${measuredDR.toFixed(1)} dB, mínimo ${minimum} dB para modo ${mode})` 
    };
  }
  
  if (measuredDR < minimum - 1) {
    return { 
      valid: false, 
      severity: 'FAIL', 
      message: `DR criticamente baixo (${measuredDR.toFixed(1)} dB)` 
    };
  }
  
  return { valid: true, severity: 'OK' };
}
```

---

## 4. Spectral Bands (Bandas Espectrais)

### Definição
Energia (RMS) em **8 bandas de frequência** após normalização LUFS a -23.

### Unidade
**dBFS** (relativo ao full scale)

### Janelas de Frequência

| Banda | Range (Hz) | Uso Típico |
|-------|-----------|------------|
| Sub | 20-60 | Sub-bass (sinta no peito) |
| Low Bass | 60-200 | Fundamental de bass, kick |
| Upper Bass | 200-500 | Warmth, body |
| Low Mid | 500-1k | Voz fundamental, snare |
| Mid | 1k-2k | Presença, clareza vocal |
| High Mid | 2k-4k | Brilho vocal, attack |
| Brilho | 4k-8k | Cymbals, air |
| Presença | 8k-20k | Sparkle, highs |

### Janela de Análise
**Áudio completo normalizado a -23 LUFS**, usando FFT com:
- Window: Hann
- Size: 4096 samples
- Hop: 1024 samples (75% overlap)

### Método de Cálculo Robusto

#### Algoritmo:
1. Normalizar áudio para -23 LUFS
2. Aplicar STFT (Short-Time Fourier Transform)
3. Para cada banda, filtrar bins correspondentes
4. Calcular RMS da banda em cada frame
5. RMS final = média RMS de todos os frames
6. Converter para dBFS: `20 × log10(RMS)`

#### Código de Referência:
```javascript
// Reutilizar lib/audio/features/spectral-bands.js
const bands = {
  sub: { min: 20, max: 60 },
  low_bass: { min: 60, max: 200 },
  upper_bass: { min: 200, max: 500 },
  low_mid: { min: 500, max: 1000 },
  mid: { min: 1000, max: 2000 },
  high_mid: { min: 2000, max: 4000 },
  brilho: { min: 4000, max: 8000 },
  presenca: { min: 8000, max: 20000 }
};

function calculateSpectralBands(audioBuffer, sampleRate) {
  // Normalizar a -23 LUFS primeiro
  const normalizedBuffer = normalizeLUFS(audioBuffer, sampleRate, -23.0);
  
  const fftSize = 4096;
  const hopSize = 1024;
  const window = hannWindow(fftSize);
  
  const bandEnergies = {};
  for (const bandName in bands) {
    bandEnergies[bandName] = [];
  }
  
  for (let i = 0; i + fftSize <= normalizedBuffer.length; i += hopSize) {
    const frame = normalizedBuffer.slice(i, i + fftSize);
    const windowed = frame.map((s, idx) => s * window[idx]);
    const fftResult = fft(windowed);
    
    for (const bandName in bands) {
      const { min, max } = bands[bandName];
      const minBin = Math.floor(min * fftSize / sampleRate);
      const maxBin = Math.ceil(max * fftSize / sampleRate);
      
      let energy = 0;
      for (let bin = minBin; bin <= maxBin; bin++) {
        energy += fftResult[bin] * fftResult[bin];
      }
      energy = Math.sqrt(energy / (maxBin - minBin + 1));
      bandEnergies[bandName].push(energy);
    }
  }
  
  // RMS médio de cada banda
  const bandLevels = {};
  for (const bandName in bandEnergies) {
    const rms = Math.sqrt(
      bandEnergies[bandName].reduce((sum, e) => sum + e * e, 0) / bandEnergies[bandName].length
    );
    bandLevels[bandName] = 20 * Math.log10(rms);
  }
  
  return bandLevels;
}
```

### Thresholds por Banda

**Depende do gênero** (targets definidos no JSON do gênero).

**Tolerância geral:**
- **±6 dB** (padrão)
- Algumas bandas têm tolerância específica (ver `work/refs/out/<genre>.json`)

**Exemplo: funk_mandela**
```json
{
  "sub": { "target_db": -22.75, "tol_db": 6 },
  "low_bass": { "target_db": -23.5, "tol_db": 5.5 },
  "mid": { "target_db": -26.8, "tol_db": 6 }
}
```

### Tier por Delta

| Delta (dB) | Tier | Ação |
|-----------|------|------|
| ≤ tolerância do gênero | ✅ OK | Nenhuma |
| > tolerância, ≤ tolerância×1.5 | ⚠️ Tier 3 | WARNING (entregar mas avisar) |
| > tolerância×1.5 | 🟡 Tier 2 | FALLBACK (re-processar com EQ mais suave) |

### Código de Validação
```javascript
function validateBands(measuredBands, targetBands) {
  const warnings = [];
  const errors = [];
  
  for (const bandName in targetBands) {
    const target = targetBands[bandName];
    const measured = measuredBands[bandName];
    const delta = Math.abs(measured - target.target_db);
    
    if (delta > target.tol_db * 1.5) {
      errors.push(`${bandName}: ${delta.toFixed(1)} dB fora (limite ${target.tol_db * 1.5} dB)`);
    } else if (delta > target.tol_db) {
      warnings.push(`${bandName}: ${delta.toFixed(1)} dB fora da tolerância ideal`);
    }
  }
  
  if (errors.length > 0) {
    return { valid: false, severity: 'FALLBACK', warnings, errors };
  } else if (warnings.length > 0) {
    return { valid: true, severity: 'WARNING', warnings };
  } else {
    return { valid: true, severity: 'OK' };
  }
}
```

---

## 5. Stereo Correlation

### Definição
**Correlação de fase** entre canais L e R, indicando width e mono-compatibility.

### Unidade
**Adimensional** (range: -1 a +1)
- +1 = mono perfeito (L = R)
- 0 = descorrelacionado total
- -1 = fase invertida (L = -R)

### Janela de Análise
**Áudio completo**.

### Método de Cálculo Robusto

#### Fórmula:
```
correlation = Σ(L[i] × R[i]) / √(Σ(L[i]²) × Σ(R[i]²))
```

#### Código:
```javascript
function calculateStereoCorrelation(leftChannel, rightChannel) {
  if (leftChannel.length !== rightChannel.length) {
    throw new Error('Channels must have same length');
  }
  
  let sumLR = 0;
  let sumL2 = 0;
  let sumR2 = 0;
  
  for (let i = 0; i < leftChannel.length; i++) {
    sumLR += leftChannel[i] * rightChannel[i];
    sumL2 += leftChannel[i] * leftChannel[i];
    sumR2 += rightChannel[i] * rightChannel[i];
  }
  
  const correlation = sumLR / Math.sqrt(sumL2 * sumR2);
  return correlation;
}
```

### Thresholds

| Range | Significado | Tier | Ação |
|-------|------------|------|------|
| > 0.9 | Quase mono, width estreito | ⚠️ Tier 3 | WARNING (pode ser intencional) |
| 0.7 - 0.9 | Normal/bom | ✅ OK | Nenhuma |
| 0.4 - 0.7 | Wide, pode ter phase issues | ⚠️ Tier 3 | WARNING |
| < 0.4 | Muito descorrelacionado | 🟡 Tier 2 | FALLBACK ou FAIL |
| < 0 | Fase invertida | 🔴 Tier 1 | **FAIL** (grave problema) |

### Código de Validação
```javascript
function validateStereoCorrelation(correlation) {
  if (correlation < 0) {
    return { valid: false, severity: 'FAIL', message: 'Fase invertida detectada (correlation negativa)' };
  }
  
  if (correlation < 0.4) {
    return { valid: false, severity: 'FALLBACK', message: `Correlation muito baixa (${correlation.toFixed(2)})` };
  }
  
  if (correlation < 0.7 || correlation > 0.9) {
    return { valid: true, severity: 'WARNING', message: `Correlation fora do ideal (${correlation.toFixed(2)})` };
  }
  
  return { valid: true, severity: 'OK' };
}
```

---

## 6. Sample Clipping

### Definição
**Samples acima de +1.0 ou abaixo de -1.0** (após normalização float32).

### Unidade
**Contagem de samples** ou **% do áudio total**.

### Janela de Análise
**Áudio completo**.

### Método de Cálculo Robusto

#### Algoritmo:
```javascript
function detectClipping(audioBuffer) {
  let clippedSamples = 0;
  
  for (let i = 0; i < audioBuffer.length; i++) {
    if (Math.abs(audioBuffer[i]) > 1.0) {
      clippedSamples++;
    }
  }
  
  const clippingPercentage = (clippedSamples / audioBuffer.length) * 100;
  
  return {
    clippedSamples,
    clippingPercentage,
    hasClipping: clippedSamples > 0
  };
}
```

### Thresholds

| Clipping % | Tier | Ação |
|-----------|------|------|
| 0% | ✅ OK | Nenhuma |
| > 0% | 🔴 Tier 1 | **job FAIL** (qualquer clipping é inaceitável) |

### Código de Validação
```javascript
function validateClipping(audioBuffer) {
  const result = detectClipping(audioBuffer);
  
  if (result.hasClipping) {
    return { 
      valid: false, 
      severity: 'CRITICAL', 
      message: `Clipping detectado: ${result.clippedSamples} samples (${result.clippingPercentage.toFixed(4)}%)` 
    };
  }
  
  return { valid: true, severity: 'OK' };
}
```

---

## 7. Total Harmonic Distortion (THD)

### Definição
**Distorção harmônica total**, medindo proporção de harmônicos artificiais vs fundamental.

### Unidade
**%** (percentual de energia em harmônicos)

### Janela de Análise
**Áudio completo** (ou tone de teste: sine 1kHz).

### Método de Cálculo Robusto

#### Algoritmo (com tone de teste):
1. Gerar sine 1kHz puro
2. Processar via engine DSP
3. Fazer FFT do resultado
4. Medir energia no fundamental (1kHz)
5. Medir energia em harmônicos (2kHz, 3kHz, 4kHz, ...)
6. `THD = √(Σ harmônicos²) / fundamental`

#### Código:
```javascript
function calculateTHD(audioBuffer, sampleRate, fundamentalFreq = 1000) {
  const fftSize = 8192;
  const fftResult = fft(audioBuffer.slice(0, fftSize));
  
  const fundamentalBin = Math.round(fundamentalFreq * fftSize / sampleRate);
  const fundamentalEnergy = fftResult[fundamentalBin] * fftResult[fundamentalBin];
  
  let harmonicsEnergy = 0;
  for (let n = 2; n <= 10; n++) { // até 10º harmônico
    const harmonicBin = Math.round(n * fundamentalFreq * fftSize / sampleRate);
    if (harmonicBin < fftResult.length) {
      harmonicsEnergy += fftResult[harmonicBin] * fftResult[harmonicBin];
    }
  }
  
  const thd = Math.sqrt(harmonicsEnergy) / Math.sqrt(fundamentalEnergy);
  return thd * 100; // em %
}
```

### Thresholds

| THD % | Tier | Ação |
|-------|------|------|
| < 0.5% | ✅ Excelente | OK |
| 0.5-1.0% | ✅ Aceitável | OK |
| 1.0-3.0% | ⚠️ Tier 3 | WARNING (audível em alguns casos) |
| > 3.0% | 🟡 Tier 2 | FALLBACK (reduzir agressividade) |

### Código de Validação
```javascript
function validateTHD(thd) {
  if (thd > 3.0) {
    return { valid: false, severity: 'FALLBACK', message: `THD muito alto (${thd.toFixed(2)}%)` };
  }
  
  if (thd > 1.0) {
    return { valid: true, severity: 'WARNING', message: `THD elevado (${thd.toFixed(2)}%)` };
  }
  
  return { valid: true, severity: 'OK' };
}
```

---

## 8. Arquivo Corrompido / Silêncio

### Definição
Arquivo masterizado resultou em **silêncio** ou **arquivo inválido**.

### Unidade
**Boolean** (válido/inválido)

### Método de Cálculo Robusto

#### Checks:
```javascript
function validateOutputFile(audioBuffer, sampleRate, expectedDuration) {
  // 1. Check se buffer não está vazio
  if (audioBuffer.length === 0) {
    return { valid: false, severity: 'CRITICAL', message: 'Áudio vazio' };
  }
  
  // 2. Check se não é só silêncio
  const rms = Math.sqrt(audioBuffer.reduce((sum, s) => sum + s * s, 0) / audioBuffer.length);
  const rmsDB = 20 * Math.log10(rms);
  if (rmsDB < -70) { // silêncio (< -70 dBFS)
    return { valid: false, severity: 'CRITICAL', message: 'Áudio resultante é silêncio' };
  }
  
  // 3. Check duração mínima
  const duration = audioBuffer.length / sampleRate;
  if (duration < 1.0) {
    return { valid: false, severity: 'CRITICAL', message: `Áudio muito curto (${duration.toFixed(1)}s)` };
  }
  
  // 4. Check se duração bate com esperado
  if (Math.abs(duration - expectedDuration) > 0.5) {
    return { valid: false, severity: 'WARNING', message: 'Duração difere do original' };
  }
  
  return { valid: true, severity: 'OK' };
}
```

### Tier

| Condição | Tier | Ação |
|----------|------|------|
| Silêncio (RMS < -70 dBFS) | 🔴 Tier 1 | **job FAIL** |
| Duração < 1s | 🔴 Tier 1 | **job FAIL** |
| Duração difere muito | ⚠️ Tier 3 | WARNING |

---

## 9. Renders Infinitos (Fallback Loop)

### Definição
**Número de tentativas de render** para o mesmo job.

### Unidade
**Contagem** (integer)

### Threshold

| Tentativas | Tier | Ação |
|-----------|------|------|
| 1 (primeira) | - | Processar normalmente |
| 2 (fallback) | ⚠️ | Tentar render conservador |
| ≥ 3 | 🔴 Tier 1 | **ABORTAR job** com erro explicativo |

### Código de Validação
```javascript
function validateRenderAttempts(jobId, attemptCount) {
  const MAX_ATTEMPTS = 2;
  
  if (attemptCount > MAX_ATTEMPTS) {
    return { 
      valid: false, 
      severity: 'CRITICAL', 
      message: `Job ${jobId} excedeu número máximo de renders (${MAX_ATTEMPTS}). Abortando.` 
    };
  }
  
  if (attemptCount === MAX_ATTEMPTS) {
    return { 
      valid: true, 
      severity: 'WARNING', 
      message: `Job ${jobId} no fallback final (tentativa ${attemptCount}/${MAX_ATTEMPTS})` 
    };
  }
  
  return { valid: true, severity: 'OK' };
}
```

---

## Orquestração Final: Validador Unificado

```javascript
async function validateMasteredAudio(
  masteredAudioPath,
  mode,
  genreTargets,
  originalDurationSeconds,
  attemptCount
) {
  const results = {
    passed: true,
    warnings: [],
    errors: [],
    severity: 'OK'
  };
  
  // 1. Load áudio
  const audioBuffer = await loadWAV(masteredAudioPath);
  const sampleRate = 48000; // assumindo
  
  // 2. Validar arquivo básico
  const fileCheck = validateOutputFile(audioBuffer, sampleRate, originalDurationSeconds);
  if (!fileCheck.valid && fileCheck.severity === 'CRITICAL') {
    results.passed = false;
    results.errors.push(fileCheck.message);
    results.severity = 'CRITICAL';
    return results; // FAIL early
  }
  
  // 3. Validar clipping
  const clippingCheck = validateClipping(audioBuffer);
  if (!clippingCheck.valid) {
    results.passed = false;
    results.errors.push(clippingCheck.message);
    results.severity = 'CRITICAL';
    return results; // FAIL early
  }
  
  // 4. Calcular e validar métricas principais
  const lufs = await calculateLUFSFFmpeg(masteredAudioPath);
  const truePeak = await calculateTruePeakFFmpeg(masteredAudioPath);
  const dr = calculateDR(audioBuffer, sampleRate);
  
  const lufsCheck = validateLUFS(lufs, genreTargets.lufs_target, mode);
  const tpCheck = validateTruePeak(truePeak, mode);
  const drCheck = validateDR(dr, mode);
  
  // 5. Agregar resultados
  [lufsCheck, tpCheck, drCheck].forEach(check => {
    if (!check.valid) {
      if (check.severity === 'FAIL' || check.severity === 'CRITICAL') {
        results.passed = false;
        results.errors.push(check.message);
        results.severity = check.severity;
      } else if (check.severity === 'FALLBACK') {
        results.passed = false;
        results.errors.push(check.message);
        results.severity = 'FALLBACK';
      } else if (check.severity === 'WARNING') {
        results.warnings.push(check.message);
        if (results.severity === 'OK') results.severity = 'WARNING';
      }
    }
  });
  
  // 6. Validar tentativas
  const attemptsCheck = validateRenderAttempts(jobId, attemptCount);
  if (!attemptsCheck.valid) {
    results.passed = false;
    results.errors.push(attemptsCheck.message);
    results.severity = 'CRITICAL';
  }
  
  return results;
}
```

---

## Resumo de Ações por Severidade

| Severity | Descrição | Ação no Worker | Ação no Frontend |
|----------|-----------|----------------|------------------|
| **OK** ✅ | Tudo dentro dos limites | Entregar áudio, salvar no B2 | Mostrar resultado normal |
| **WARNING** ⚠️ | Fora do ideal mas aceitável | Entregar áudio + avisos no campo `warnings` | Mostrar alerta amarelo: "Resultado aceitável mas com ressalvas" |
| **FALLBACK** 🟡 | Violação de guardrail Tier 2 | Se attemptCount=1: re-renderizar com parâmetros conservadores. Se attemptCount=2: FAIL. | Mostrar "Re-processando com configuração mais segura..." |
| **FAIL** 🔴 | Violação de guardrail Tier 1 | NÃO entregar áudio. Marcar job como `failed`. | Mostrar erro claro: "Master não atendeu requisitos de segurança" |
| **CRITICAL** 🔴 | Erro grave (clipping, tentativas excedidas) | ABORTAR job imediatamente. | Mostrar erro crítico + sugerir suporte |

---

**Última revisão:** 09/02/2026  
**Próxima atualização:** Após implementação da engine DSP (validar valores empíricos)
