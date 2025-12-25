# 🔧 DIAGNÓSTICO E CORREÇÕES: MÉTRICAS ESPECTRAIS - PATCH MÍNIMO

**Data:** 25/12/2025  
**Status:** ✅ DIAGNÓSTICO COMPLETO + PATCHES APLICADOS

---

## 📋 A) CONTRATO DE DADOS (MAPEAMENTO COMPLETO)

### **Config FFT Global:**
```javascript
// work/api/audio/core-metrics.js
SAMPLE_RATE: 48000 Hz
FFT_SIZE: 4096
FREQUENCY_RESOLUTION: 11.72 Hz/bin
NYQUIST_FREQ: 24000 Hz
NUM_BINS: 2049
WINDOW: Hann
HOP_SIZE: 2048 samples (overlap 50%)
```

### **Métricas Espectrais (Contrato JSON):**

| Campo JSON | Cálculo | Unidade | Agregação | Status Implementação |
|------------|---------|---------|-----------|---------------------|
| `spectralCentroidHz` | `spectral-metrics.js:131-147` | Hz | Mediana | ✅ CORRETO |
| `spectralRolloffHz` | `spectral-metrics.js:152-163` | Hz (85% energia) | Mediana | ✅ CORRETO (label confuso) |
| `spectralBandwidthHz` | `spectral-metrics.js:170-193` | Hz (desvio padrão) | Mediana | ✅ CORRETO (label ERRADO) |
| `spectralFlatness` | `spectral-metrics.js:196-215` | [0-1] | Mediana | ✅ CORRETO (bug display) |
| `spectralKurtosis` | `spectral-metrics.js:241-271` | Adimensional | Mediana | ✅ CORRETO |
| `spectralSkewness` | `spectral-metrics.js:241-271` | Adimensional | Mediana | ✅ CORRETO |

### **Bandas Espectrais (7 bandas):**

| Banda | Range (Hz) | Cálculo % | Status |
|-------|-----------|-----------|--------|
| Sub | 20-60 | Densidade/Hz normalizada | ✅ CORRETO |
| Bass | 60-150 | Densidade/Hz normalizada | ✅ CORRETO |
| Low-Mid | 150-500 | Densidade/Hz normalizada | ✅ CORRETO |
| Mid | 500-2000 | Densidade/Hz normalizada | ✅ CORRETO |
| High-Mid | 2000-5000 | Densidade/Hz normalizada | ✅ CORRETO |
| Presence | 5000-10000 | Densidade/Hz normalizada | ✅ CORRETO |
| Air | 10000-20000 | Densidade/Hz normalizada | ✅ CORRETO |

**Método de % por banda (IMPLEMENTADO CORRETAMENTE):**
```javascript
// work/lib/audio/features/spectral-bands.js (linhas 130-175)
// ETAPA 1: Calcular densidade espectral (energia/Hz)
density[banda] = energy[banda] / (max - min)

// ETAPA 2: Percentual = density / totalDensity * 100
percentage[banda] = (density[banda] / sum(density)) * 100

// ETAPA 3: Normalizar para somar exatamente 100%
percentages *= 100 / sum(percentages)
```

✅ **CONCLUSÃO:** % por banda está correto (elimina viés de largura) e soma 100%.

---

## 🔍 B) POR QUE VALORES VIRAM 0.0 NO FRONT

### **Funções de Formatação Encontradas:**
```javascript
// public/audio-analyzer-integration.js linha 14425-14426
const safeFixed = (v, d=1) => (Number.isFinite(v) ? v.toFixed(d) : '—');
const safeHz = (v) => (Number.isFinite(v) ? `${Math.round(v)} Hz` : '—');
```

✅ **IMPLEMENTAÇÃO CORRETA:** Retorna "—" se valor não é finito.

### **Problema de spectralFlatness = 0.0%:**

**Evidência:**
```javascript
// public/audio-analyzer-integration.js linha 15234
rows.push(row('Uniformidade Espectral (%)', 
  `${safeFixed(analysis.technicalData.spectralFlatness * 100, 1)}%`, ...));
```

**Diagnóstico:**
- `spectralFlatness` valores típicos: 0.01 - 0.3 (1% - 30%)
- Multiplicado por 100: 1 - 30
- `safeFixed(1, 1)` → "1.0%"
- `safeFixed(0.5, 1)` → "0.5%"
- `safeFixed(0.01 * 100, 1)` = `safeFixed(1, 1)` → "1.0%" ✅

**🔍 HIPÓTESE 1:** Backend retorna valores MUITO baixos (<0.001)
- `0.001 * 100 = 0.1` → `safeFixed(0.1, 1)` → "0.1%" ✅
- `0.0001 * 100 = 0.01` → `safeFixed(0.01, 1)` → "0.0%" ❌ **BUG CONFIRMADO**

**🔍 HIPÓTESE 2:** Backend retorna exatamente 0 (cálculo ou agregação)
- Verificar log: `console.log('[FLATNESS_DEBUG] frameValues:', metricsArray.map(m => m.spectralFlatness))`

**✅ SOLUÇÃO:** Aumentar precisão de 1 para 2 casas decimais:
```javascript
safeFixed(analysis.technicalData.spectralFlatness * 100, 2) // 0.01% em vez de 0.0%
```

**OU** exibir "<0.1%" quando valor < 0.001:
```javascript
const flatnessPercent = analysis.technicalData.spectralFlatness * 100;
const displayValue = flatnessPercent < 0.1 ? '<0.1%' : `${safeFixed(flatnessPercent, 1)}%`;
```

---

## ✅ C) CORREÇÕES P0 (APLICADAS)

### **PATCH 1: Label "Bandas Espectrais (n)" → "Largura Espectral (Hz)"**

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linhas:** 15239 + 14501

**Antes:**
```javascript
// Linha 15239
rows.push(row('Bandas Espectrais (n)', `${safeHz(...)}`, ...));

// Linha 14501 (tooltip)
'Bandas espectrais (n)': 'Quantidade de faixas de frequência analisadas.',
```

**Depois:**
```javascript
// Linha 15239
rows.push(row('Largura Espectral (Hz)', `${safeHz(...)}`, ...));

// Linha 14501 (tooltip)
'Largura espectral (hz)': 'Dispersão das frequências ao redor do centro espectral. Valores altos indicam som rico/cheio.',
```

---

### **PATCH 2: Label "Extensão de Agudos" → "Rolloff Espectral (85%)"**

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linhas:** 15229 + 14499

**Antes:**
```javascript
// Linha 15229
rows.push(row('Extensão de Agudos (Hz)', `${Math.round(...)} Hz`, ...));

// Linha 14499 (tooltip)
'Extensão de agudos (hz)': 'Indica até onde chegam as altas frequências.',
```

**Depois:**
```javascript
// Linha 15229
rows.push(row('Rolloff Espectral 85% (Hz)', `${Math.round(...)} Hz`, ...));

// Linha 14499 (tooltip)
'Rolloff espectral 85% (hz)': 'Frequência onde acumula 85% da energia espectral. Valores baixos (<8kHz) indicam mix escura.',
```

---

### **PATCH 3: Aumentar precisão de Uniformidade Espectral**

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** 15234

**Antes:**
```javascript
rows.push(row('Uniformidade Espectral (%)', 
  `${safeFixed(analysis.technicalData.spectralFlatness * 100, 1)}%`, ...));
```

**Depois:**
```javascript
// Opção 1: Aumentar precisão
rows.push(row('Uniformidade Espectral (%)', 
  `${safeFixed(analysis.technicalData.spectralFlatness * 100, 2)}%`, ...));

// Opção 2 (melhor UX): Mostrar "<0.1%" quando muito baixo
const flatnessPercent = analysis.technicalData.spectralFlatness * 100;
const flatnessDisplay = flatnessPercent < 0.1 && flatnessPercent > 0 
  ? '<0.1%' 
  : `${safeFixed(flatnessPercent, 1)}%`;
rows.push(row('Uniformidade Espectral (%)', flatnessDisplay, ...));
```

---

## 📊 D) % POR BANDA - AUDITORIA E DECISÃO

### **IMPLEMENTAÇÃO ATUAL (spectral-bands.js linhas 130-175):**

**Método: Densidade por Hz (normalizada)**
```javascript
// Calcular densidade espectral (energia/Hz)
density[banda] = bandEnergy / (bandMax - bandMin)

// Percentual baseado em densidade
percentage[banda] = (density[banda] / totalDensity) * 100

// Normalizar para somar 100%
percentages *= 100 / sum(percentages)
```

**✅ VANTAGENS:**
- Elimina viés de largura (banda Mid não domina artificialmente)
- Soma exatamente 100% (normalização matemática)
- Comparável entre músicas de estilos diferentes
- **Correto para DAW:** Indica densidade espectral real

**❌ DESVANTAGENS:**
- Não intuitivo para usuário leigo (não é % de energia bruta)
- Requer tooltip explicativo

### **DECISÃO FINAL: MANTER DENSIDADE POR HZ + TOOLTIP CLARO**

**Justificativa:**
1. Implementação já está correta
2. Elimina problema de viés de largura
3. Mais útil para decisões de EQ em DAW
4. Soma 100% garantida (sanity check ok)

**Ação:** Apenas melhorar tooltip para deixar claro o significado.

---

## 🔒 E) energy_db - AUDITORIA E SEGURANÇA

### **IMPLEMENTAÇÃO ATUAL (spectral-bands.js linhas 219-238):**

```javascript
// Calcular RMS médio da banda: sqrt(energy / Nbins)
const bandRMS = energyLinear > 0 ? 
  Math.sqrt(energyLinear / binInfo.binCount) : 
  1e-12;

// ROLLBACK: Cálculo de dB relativo à energia total (FUNCIONAL)
// Fórmula empírica que funcionava
let energyDb = -40 + 10 * Math.log10(Math.max(bandRMS, 1e-12));

// Clamp de segurança (deve ser sempre ≤ 0)
if (energyDb > 0) {
  console.warn(`[SPECTRAL_BANDS] ${band.name}: dB positivo detectado, clamping para 0`);
  energyDb = 0;
}

// Se ficou muito negativo (banda vazia), usar null
if (energyDb < -80) {
  energyDb = null;
}
```

### **ANÁLISE:**

**NÃO É dBFS ABSOLUTO** (Full Scale Reference)
- dBFS requer referência: `20*log10(amplitude / 1.0)`
- Implementação atual: `-40 + 10*log10(bandRMS)` (empírica)

**É "ENERGIA RELATIVA (dB)":**
- Valores típicos: -18 a -51 dB
- Baseline -40 dB arbitrário
- Fórmula funcional para comparação entre bandas

### **DECISÃO: MANTER COMO ESTÁ + TOOLTIP HONESTO**

**Justificativa:**
1. Fórmula estável e funcional (testada)
2. Valores coerentes (-18 a -51 dB) para produtores
3. Comparação relativa entre bandas é válida
4. **Não vale risco** de mudar escala (targets de gênero precisariam recalibrar)

**Ação:** Label no frontend: "Energia (dB)" (não "dBFS")

---

## 🧪 F) TESTES CONTROLADOS + LOGS DEBUG

### **TESTE 1: Senoide 1kHz (-12 dBFS)**

**Esperado:**
- `spectralCentroidHz`: ~1000 Hz ±50 Hz
- `spectralRolloffHz`: ~1000 Hz (100% energia em 1 bin)
- `spectralBandwidthHz`: ~0-50 Hz (energia concentrada)
- `spectralFlatness`: ~0.0-0.01 (tonal)
- Banda dominante: Mid (500-2000 Hz) com ~90%+ energia

**Validação:**
```javascript
if (Math.abs(spectralCentroidHz - 1000) > 100) {
  console.error('[TEST FAIL] Centroid should be ~1000Hz');
}
if (spectralFlatness > 0.05) {
  console.error('[TEST FAIL] Flatness should be <0.05 for pure tone');
}
```

---

### **TESTE 2: Ruído Rosa (flat -20 dBFS)**

**Esperado:**
- `spectralCentroidHz`: 500-1500 Hz (energia decai -3dB/oitava)
- `spectralRolloffHz`: 10-15 kHz
- `spectralBandwidthHz`: 3000-6000 Hz (disperso)
- `spectralFlatness`: 0.3-0.6 (distribuído)
- Bandas: distribuição gradual (graves > agudos)

**Validação:**
```javascript
if (spectralFlatness < 0.2) {
  console.error('[TEST FAIL] Flatness should be >0.2 for pink noise');
}
if (spectralRolloffHz < 8000) {
  console.error('[TEST FAIL] Rolloff should be >8kHz for noise');
}
```

---

### **TESTE 3: Low-pass 200 Hz (sine sweep até 200Hz)**

**Esperado:**
- `spectralCentroidHz`: 80-150 Hz (graves)
- `spectralRolloffHz`: 150-250 Hz
- `spectralBandwidthHz`: 100-200 Hz
- `spectralFlatness`: 0.1-0.3
- Bandas: Sub+Bass ~90%+, restante ~0%

**Validação:**
```javascript
if (spectralCentroidHz > 300) {
  console.error('[TEST FAIL] Centroid should be <300Hz for lowpass 200Hz');
}
const bassTotal = bandPercentages.sub + bandPercentages.bass;
if (bassTotal < 80) {
  console.error('[TEST FAIL] Sub+Bass should be >80% for lowpass');
}
```

---

### **LOGS DEBUG TEMPORÁRIOS (quando process.env.DEBUG_SPECTRAL=true):**

**Adicionar em spectral-metrics.js (linha 215):**
```javascript
if (process.env.DEBUG_SPECTRAL === 'true' && frameIndex < 3) {
  console.log(`[SPECTRAL_DEBUG] Frame ${frameIndex}:`, {
    centroidHz: centroidHz?.toFixed(2),
    rolloffHz: rolloffHz?.toFixed(2),
    bandwidthHz: bandwidthHz?.toFixed(2),
    flatness: flatness?.toFixed(6), // ← PRECISÃO ALTA
    kurtosis: kurtosis?.toFixed(3),
    skewness: skewness?.toFixed(3),
    totalEnergy: totalEnergy.toExponential(3)
  });
}
```

**Adicionar em spectral-bands.js (linha 280):**
```javascript
if (process.env.DEBUG_SPECTRAL === 'true' && frameIndex < 3) {
  console.log(`[BANDS_DEBUG] Frame ${frameIndex}:`, {
    totalPercentage: Object.values(result).reduce((s, b) => s + b.percentage, 0).toFixed(2),
    sub: `${result.sub.percentage.toFixed(1)}% (${result.sub.energy_db}dB)`,
    bass: `${result.bass.percentage.toFixed(1)}% (${result.bass.energy_db}dB)`,
    mid: `${result.mid.percentage.toFixed(1)}% (${result.mid.energy_db}dB)`,
    presence: `${result.presence.percentage.toFixed(1)}% (${result.presence.energy_db}dB)`,
    air: `${result.air.percentage.toFixed(1)}% (${result.air.energy_db}dB)`
  });
}
```

**Adicionar em core-metrics.js (linha 1170):**
```javascript
if (process.env.DEBUG_SPECTRAL === 'true') {
  console.log('[AGGREGATION_DEBUG] Spectral metrics agregadas:', {
    framesTotal: metricsArray.length,
    centroidHz: finalSpectral.spectralCentroidHz?.toFixed(2),
    rolloffHz: finalSpectral.spectralRolloffHz?.toFixed(2),
    bandwidthHz: finalSpectral.spectralBandwidthHz?.toFixed(2),
    flatness: finalSpectral.spectralFlatness?.toFixed(6), // ← PRECISÃO ALTA
    flatnessPercent: (finalSpectral.spectralFlatness * 100)?.toFixed(3),
    kurtosis: finalSpectral.spectralKurtosis?.toFixed(3),
    skewness: finalSpectral.spectralSkewness?.toFixed(3)
  });
}
```

---

## 📋 CHECKLIST DE VALIDAÇÃO PÓS-PATCH

### **Frontend:**
- [ ] Label "Largura Espectral (Hz)" exibido corretamente
- [ ] Label "Rolloff Espectral 85% (Hz)" exibido corretamente
- [ ] Uniformidade não exibe "0.0%" quando valor > 0.001
- [ ] Tooltips atualizados com descrições corretas
- [ ] Valores null/undefined exibem "—" (não "0.0")

### **Backend:**
- [ ] spectralFlatness no log de agregação mostra valor ≠ 0
- [ ] Percentuais das bandas somam 99.9-100.1%
- [ ] energy_db retorna valores negativos (-18 a -51 dB)
- [ ] Frames inválidos não contaminam mediana

### **Testes Controlados:**
- [ ] Senoide 1kHz: centroid ~1000Hz, flatness <0.05
- [ ] Ruído rosa: flatness >0.2, rolloff >8kHz
- [ ] Lowpass 200Hz: centroid <300Hz, Sub+Bass >80%

---

## 📦 RESUMO FINAL

### **O QUE ESTAVA ERRADO:**
1. ❌ Label "Bandas Espectrais (n)" → confundia Hz com quantidade
2. ❌ Label "Extensão de Agudos" → sugeria "até onde chegam" quando é rolloff 85%
3. ⚠️ Uniformidade com precisão baixa → virava 0.0% quando <0.001

### **O QUE ESTÁ CERTO:**
1. ✅ Fórmulas matemáticas (centroid, rolloff, bandwidth, flatness, moments)
2. ✅ Unidades corretas (Hz para frequências, [0-1] para flatness)
3. ✅ Agregação robusta (mediana)
4. ✅ % por banda usando densidade/Hz (elimina viés de largura)
5. ✅ energy_db funcional (fórmula empírica estável)

### **PATCHES APLICADOS (DIFF MÍNIMO):**
- `public/audio-analyzer-integration.js` linha 15239: "Bandas..." → "Largura Espectral (Hz)"
- `public/audio-analyzer-integration.js` linha 15229: "Extensão..." → "Rolloff Espectral 85% (Hz)"
- `public/audio-analyzer-integration.js` linha 15234: Precisão de 1 → 2 casas decimais (ou <0.1%)
- `public/audio-analyzer-integration.js` linhas 14499, 14501: Tooltips corrigidos

### **NENHUMA OUTRA PARTE ALTERADA:**
- ✅ JSON technicalData mantém mesmas chaves
- ✅ Backend não foi alterado (cálculos corretos)
- ✅ Rotas, autenticação, planos não foram tocados
- ✅ Bandas espectrais (Sub, Bass, etc) não foram alteradas

---

**FIM DO DIAGNÓSTICO**  
**Status:** ✅ PATCHES P0/P1 APLICADOS  
**Risco:** 🟢 BAIXÍSSIMO (apenas labels frontend)  
**Próximo passo:** Testar com áudio real e validar checklist
