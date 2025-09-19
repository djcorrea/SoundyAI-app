# 🔍 AUDITORIA COMPLETA - TRUE PEAK IMPLEMENTATION

**Data:** 18 de setembro de 2025  
**Arquivo:** `work/lib/audio/features/truepeak.js`  
**Objetivo:** Análise linha por linha para identificar bugs no cálculo de True Peak

---

## 📋 1. ALGORITMO USADO PARA TRUE PEAK

### ✅ CONFIRMAÇÃO: IMPLEMENTA OVERSAMPLING FIR POLYPHASE REAL
**Não é apenas Sample Peak.** O código implementa genuinamente oversampling polyphase:

```javascript
// LINHA 83-91: Classe TruePeakDetector
class TruePeakDetector {
  constructor(sampleRate = 48000) {
    this.coeffs = this.upgradeEnabled ? getUpgradedCoeffs() : POLYPHASE_COEFFS;
    this.upsampleRate = sampleRate * this.coeffs.UPSAMPLING_FACTOR; // 192kHz ou 384kHz
    this.delayLine = new Float32Array(this.coeffs.LENGTH);
  }
```

**Fatores de oversampling disponíveis:**
- **Legacy:** 4× (48kHz → 192kHz) com 48 taps
- **Upgrade:** 8× (48kHz → 384kHz) com 192 taps (flag TP_UPGRADE)

### 🚨 BUG CRÍTICO NO ALGORITMO POLYPHASE (LINHA 218-241)

```javascript
// 🚨 ALGORITMO INCORRETO - LINHA 235:
const coeffIdx = (i + phase) % this.coeffs.TAPS.length;
```

**PROBLEMA:** Esta implementação está **COMPLETAMENTE ERRADA** para polyphase filtering:

1. **Deveria ser:** `coeffIdx = phase * tapsPerPhase + i` (coeficientes organizados por fase)
2. **Está fazendo:** `coeffIdx = (i + phase) % totalTaps` (circulação linear incorreta)

**Consequência:** O oversampling não está interpolando corretamente entre amostras. Está apenas aplicando uma versão atrasada do mesmo filtro linear para todas as fases.

---

## 📊 2. COEFICIENTES FIR (POLYPHASE_COEFFS)

### ✅ ORGANIZAÇÃO: LISTA LINEAR (NÃO POR FASE)
```javascript
// LINHA 10-23: Coeficientes do filtro FIR (48 taps)
const POLYPHASE_COEFFS = {
  TAPS: [0.0, -0.000015258789, -0.000015258789, ...], // 48 coeficientes
  LENGTH: 48,
  UPSAMPLING_FACTOR: 4
};
```

**ESTRUTURA:** Os coeficientes estão organizados como **lista linear**, não por fase. Isto é correto para implementação polyphase adequada, mas o algoritmo está usando-os incorretamente.

### ✅ NORMALIZAÇÃO: IMPLEMENTADA CORRETAMENTE
```javascript
// LINHA 55-56: Normalização para ganho unitário
const sum = taps.reduce((a, b) => a + b, 0);
for (let i = 0; i < taps.length; i++) taps[i] /= sum;
```

**Ganho DC:** Normalizado para 1.0 ✅

### ❌ SUFICIÊNCIA PARA INTERPOLAÇÃO
**PROBLEMA:** Mesmo com coeficientes corretos, o algoritmo polyphase errado impede interpolação adequada entre amostras.

---

## 📐 3. VALIDAÇÃO E CORREÇÕES FORÇADAS

### 🚨 TRECHOS QUE FORÇAM TRUEPEAK = SAMPLEPEAK

#### A) LINHA 176-188: Primeira correção forçada
```javascript
if (maxTruePeakdBTP < samplePeakDbtp) {
  console.warn(`🔧 [TRUE_PEAK_FALLBACK] Usando True Peak máximo entre calculado e sample peak`);
  maxTruePeakdBTP = Math.max(maxTruePeakdBTP, samplePeakDbtp); // ✅ Math.max (corrigido)
}
```

#### B) LINHA 324-336: Segunda correção forçada
```javascript
if (maxTruePeakdBTP < maxSamplePeakdBTP) {
  console.warn(`🔧 [TRUE_PEAK_FALLBACK] Usando True Peak máximo entre calculado e sample peak por coerência física`);
  maxTruePeakdBTP = Math.max(maxTruePeakdBTP, maxSamplePeakdBTP); // ✅ Math.max (corrigido)
}
```

**OBSERVAÇÃO:** As correções foram aplicadas para usar `Math.max()` em vez de sobrescrita direta.

### ❌ FALLBACK RETORNANDO 0.00 dBTP FIXO
**NÃO ENCONTRADO:** Não há código que retorna 0.00 dBTP como valor fixo de fallback.

### ✅ LIMITAÇÃO PARA > 0 dBTP
```javascript
// LINHA 180-184: Limitação a 0 dBTP máximo
if (maxTruePeakdBTP > 0.0) {
  console.warn(`⚠️ [TRUE_PEAK_CLIPPING] Resultado ${maxTruePeakdBTP.toFixed(2)} dBTP > 0 - limitando a 0 dBTP`);
  maxTruePeakdBTP = 0.0;
  maxTruePeak = 1.0;
}
```

---

## 🔢 4. CONVERSÃO PARA dBTP

### ✅ CONVERSÃO CORRETA: 20 * log10(valor_linear)
```javascript
// LINHA 149: ITU-R BS.1770-4 compliant
if (maxTruePeak > 0) {
  maxTruePeakdBTP = 20 * Math.log10(maxTruePeak);
}
```

### ✅ RETORNA EM dBTP E LINEAR
```javascript
// LINHA 195-196: Valores retornados
return {
  true_peak_linear: maxTruePeak,    // Valor linear
  true_peak_dbtp: maxTruePeakdBTP, // Valor em dBTP
```

**CONFORMIDADE:** ✅ ITU-R BS.1770-4 compliant

---

## 🔗 5. INTEGRAÇÃO COM JSON/OUTPUT

### ✅ FLUXO DE DADOS IDENTIFICADO:
```
truepeak.js (detectTruePeak) 
    ↓ {true_peak_dbtp}
core-metrics.js (calculateTruePeakMetrics)
    ↓ {maxDbtp: truePeakMetrics.true_peak_dbtp}
json-output.js (extractTechnicalData)
    ↓ technicalData.truePeakDbtp = safeSanitize(coreMetrics.truePeak.maxDbtp)
    ↓ JSON FINAL
```

### ✅ VALOR NO JSON É O CALCULADO
**LINHA 127 (json-output.js):**
```javascript
technicalData.truePeakDbtp = safeSanitize(coreMetrics.truePeak.maxDbtp);
```

**CONFIRMAÇÃO:** O valor no JSON final é exatamente o calculado pelo True Peak, sem truncamento ou sobrescrita adicional.

---

## 📝 6. LOGS E TESTES AUTOMÁTICOS

### ✅ LOGS PARA TRUE PEAK < SAMPLE PEAK
```javascript
// LINHA 175: Log específico
console.error(`🚨 [CRITICAL] True Peak (${maxTruePeakdBTP.toFixed(2)} dBTP) < Sample Peak...`);
console.warn(`🔧 [TRUE_PEAK_FALLBACK] Usando True Peak máximo entre calculado e sample peak`);
```

### ✅ TESTES COM SINAIS DE REFERÊNCIA
**LINHAS 448-518:** Implementa testes automáticos com:
- Seno -1 dBFS → espera ~-1 dBTP
- Seno -20 dBFS → espera ~-20 dBTP  
- Silêncio digital → espera -Infinity
- Clipping intencional → espera ~0 dBTP

### ✅ VALIDAÇÃO AUTOMATIZADA
```javascript
// LINHA 480: Suite de validação completa
function runTruePeakValidationSuite() {
  // Executa todos os testes e reporta precisão
}
```

---

## 🎯 7. IDENTIFICAÇÃO DOS BUGS

### 🚨 BUG PRINCIPAL: ALGORITMO POLYPHASE INCORRETO

**LOCALIZAÇÃO:** Linha 235
```javascript
// ❌ ERRADO:
const coeffIdx = (i + phase) % this.coeffs.TAPS.length;

// ✅ DEVERIA SER:
const coeffIdx = phase + i * this.coeffs.UPSAMPLING_FACTOR;
```

**IMPACTO:** O True Peak calculado é **substancialmente menor** que deveria ser, forçando fallback constante para Sample Peak.

### 🔍 EVIDÊNCIA DO BUG:
No teste executado anteriormente, vimos:
```
Sample Peak: -6.02 dB
True Peak calculado: -12.14 dBTP  ← 6dB MENOR QUE DEVERIA SER
Resultado final: -6.02 dBTP (fallback ativo)
```

**EXPLICAÇÃO:** Com algoritmo polyphase correto, True Peak deveria ser ≥ Sample Peak (ex: -5.8 dBTP), mas o algoritmo errado produz -12.14 dBTP, forçando fallback.

---

## 📋 8. ANÁLISE FINAL

### ✅ CONFIRMAÇÕES:
1. **True Peak está sendo calculado com oversampling** (não é apenas Sample Peak)
2. **Conversão para dBTP está correta** (20 * log10)
3. **Integração com JSON está preservada** (valor calculado chega intacto)
4. **Validação de range está implementada** (limitação a 0 dBTP)
5. **Logs e testes estão presentes**

### 🚨 BUG IDENTIFICADO:
**O algoritmo polyphase está implementado incorretamente**, resultando em True Peak artificialmente baixo que força fallback constante para Sample Peak.

### 🎯 ORIGEM DO PROBLEMA:
**O 0.00 dBTP não vem de truncamento JSON ou fallback fixo.** Vem do Sample Peak sendo copiado quando True Peak calculado é menor devido ao bug no algoritmo.

### 📊 IMPACTO:
- True Peak funcional mas impreciso
- Fallback mascarado como valor real
- Valores aparentemente corretos mas derivados de Sample Peak
- Sistema reporta valores plausíveis mas não genuinamente calculados

---

## 🔧 CONCLUSÃO DA AUDITORIA

**STATUS:** True Peak implementa oversampling real, mas com **algoritmo polyphase defeituoso** que produz valores incorretos, forçando dependência de fallback para Sample Peak.

**LOCALIZAÇÃO DO BUG:** Linha 235 - `coeffIdx = (i + phase) % this.coeffs.TAPS.length`

**SEVERIDADE:** CRÍTICA - Sistema funciona mas não produz True Peak genuíno na maioria dos casos.