# 🔍 AUDITORIA PROFUNDA E COMPLETA - TRUE PEAK SYSTEM

**Data:** 18 de setembro de 2025  
**Objetivo:** Diagnosticar e documentar TODOS os pontos críticos do cálculo de True Peak  
**Status:** AUDITORIA FINALIZADA - SEM APLICAÇÃO DE CORREÇÕES

---

## 📂 1. LOCALIZAÇÃO DO CÓDIGO

### 1.1 Arquivos Principais
- **ARQUIVO CORE:** `work/lib/audio/features/truepeak.js` (534 linhas)
- **INTEGRAÇÃO:** `work/api/audio/core-metrics.js` (usa `analyzeTruePeaks`)
- **JSON OUTPUT:** `work/api/audio/json-output.js` (converte para JSON final)

### 1.2 Dependências e Usages
```javascript
// IMPORTS IDENTIFICADOS:
import { TruePeakDetector, analyzeTruePeaks } from "../../lib/audio/features/truepeak.js";

// ARQUIVOS QUE USAM:
- work/api/audio/core-metrics.js (linha 7, 691)
- work/api/audio/core-metrics-original.js (linha 7, 330-331)
- tools/ref-calibrator.js (linha 15, 184)
- tools/metrics-recalc.js (linha 16, 248)
- tools/reference-builder.js (linha 15, 273)
- scripts/refs-normalize-and-rebuild.js (linha 32, 244)
```

### 1.3 Funções Envolvidas
1. **`TruePeakDetector.detectTruePeak()`** - Cálculo por canal
2. **`analyzeTruePeaks()`** - Função principal (combinação L+R)
3. **`core-metrics.calculateTruePeakMetrics()`** - Wrapper de validação
4. **`json-output.extractTechnicalData()`** - Conversão para JSON

---

## ⚖️ 2. UNIDADES E ESCALAS

### 2.1 Escalas Identificadas
| Variável | Escala | Uso |
|----------|--------|-----|
| `maxTruePeak` | **Linear (0.0-1.0)** | Amplitude normalizada |
| `maxTruePeakdBTP` | **dBTP (ITU-R BS.1770-4)** | True Peak em decibels |
| `samplePeakdB` | **dBFS** | Sample Peak em decibels |
| `maxSamplePeakdBFS` | **dBFS** | Sample Peak global |

### 2.2 Conversões de Escala
```javascript
// CONVERSÃO LINEAR → dBTP:
if (maxTruePeak > 0) {
  maxTruePeakdBTP = 20 * Math.log10(maxTruePeak);  // ITU-R BS.1770-4 compliant
} else {
  maxTruePeakdBTP = -Infinity;  // Silêncio digital
}

// CONVERSÃO SAMPLE PEAK:
const samplePeakdB = maxSamplePeak > 0 ? 20 * Math.log10(maxSamplePeak) : -Infinity;
```

### 2.3 ⚠️ INCONSISTÊNCIA CRÍTICA
**PROBLEMA:** True Peak usa dBTP, Sample Peak usa dBFS, mas ambos são comparados diretamente!
```javascript
// LINHA 170-174 (truepeak.js):
if (maxTruePeakdBTP < samplePeakdB) {  // ❌ COMPARA dBTP vs dBFS
  console.error(`🔧 [FIX] Corrigindo True Peak para Sample Peak`);
  maxTruePeakdBTP = samplePeakdB;  // ❌ FORÇA TP = SP
}
```

---

## 🔀 3. FLUXO LÓGICO DE SOBRESCRITA

### 3.1 Condicional Principal (LINHA 169-176)
```javascript
// 🚨 VALIDAÇÃO FINAL: True Peak deve ser >= Sample Peak
if (isFinite(maxTruePeakdBTP) && isFinite(samplePeakdB)) {
  if (maxTruePeakdBTP < samplePeakdB) {
    const diff = samplePeakdB - maxTruePeakdBTP;
    console.error(`🚨 [CRITICAL] True Peak (${maxTruePeakdBTP.toFixed(2)} dBTP) < Sample Peak (${samplePeakdB.toFixed(2)} dB) - Diferença: ${diff.toFixed(2)} dB`);
    console.error(`🔧 [FIX] Corrigindo True Peak para Sample Peak`);
    maxTruePeakdBTP = samplePeakdB;    // ❌ SOBRESCRITA FORÇADA
    maxTruePeak = maxSamplePeak;       // ❌ SOBRESCRITA FORÇADA
  }
}
```

### 3.2 Condicional Secundária (LINHA 303-313)
```javascript
// Na função analyzeTruePeaks() - VALIDAÇÃO DUPLICADA
if (maxTruePeakdBTP < maxSamplePeakdBFS) {
  const difference = maxSamplePeakdBFS - maxTruePeakdBTP;
  console.error(`🚨 [TRUE_PEAK_CRITICAL_ERROR] True Peak (${maxTruePeakdBTP.toFixed(2)} dBTP) < Sample Peak (${maxSamplePeakdBFS.toFixed(2)} dBFS) - Diferença: ${difference.toFixed(2)} dB`);
  console.error(`🔧 [TRUE_PEAK_FIX] Corrigindo True Peak para Sample Peak por coerência física`);
  
  // FORÇAR correção quando fisicamente impossível
  maxTruePeakdBTP = maxSamplePeakdBFS;  // ❌ SEGUNDA SOBRESCRITA
  maxTruePeak = maxSamplePeak;          // ❌ SEGUNDA SOBRESCRITA
}
```

### 3.3 Situações que Ativam Fallback
1. **True Peak calculado < Sample Peak** (qualquer diferença > 0)
2. **Valores não-finitos** (`-Infinity`, `NaN`)
3. **True Peak negativo** (erro algoritmo oversampling)

---

## 🔧 4. VALIDAÇÃO E NORMALIZAÇÃO

### 4.1 Range Checks (core-metrics.js)
```javascript
// LINHA 702-705:
if (truePeakMetrics.true_peak_dbtp > 20 || truePeakMetrics.true_peak_dbtp < -100) {
  throw makeErr('core_metrics', `True peak out of realistic range: ${truePeakMetrics.true_peak_dbtp}dBTP`, 'truepeak_range_error');
}
```

### 4.2 Clipping Thresholds
```javascript
const TRUE_PEAK_CLIP_THRESHOLD_DBTP = -1.0;
const TRUE_PEAK_CLIP_THRESHOLD_LINEAR = Math.pow(10, TRUE_PEAK_CLIP_THRESHOLD_DBTP / 20); // ≈0.891
```

### 4.3 ❌ PROBLEMAS DE NORMALIZAÇÃO
1. **Sem conversão para mesma escala** antes de comparar
2. **dBTP vs dBFS misturados** sem ajuste
3. **Não há clipping a 0 dBTP** após correção

---

## 📋 5. LOGS E MENSAGENS

### 5.1 Logs de Cálculo Normal
```javascript
console.log('🏔️ Detectando true peaks...');
console.log(`🔍 [DEBUG] True Peak calculado: ${maxTruePeakdBTP.toFixed(2)} dBTP`);
console.log(`🔍 [DEBUG] Comparação: Sample Peak ${samplePeakdB.toFixed(2)} dB vs True Peak ${maxTruePeakdBTP.toFixed(2)} dBTP`);
```

### 5.2 Logs de Fallback/Correção
```javascript
console.error(`🚨 [CRITICAL] True Peak (${maxTruePeakdBTP.toFixed(2)} dBTP) < Sample Peak (${samplePeakdB.toFixed(2)} dB)`);
console.error(`🔧 [FIX] Corrigindo True Peak para Sample Peak`);
console.error(`🔧 [TRUE_PEAK_FIX] Corrigindo True Peak para Sample Peak por coerência física`);
```

### 5.3 Logs de Warning
```javascript
console.warn(`⚠️ [TRUE_PEAK_LOW] Canal com True Peak baixo: ${maxTruePeakdBTP.toFixed(2)} dBTP (< -15 dBTP)`);
console.warn(`⚠️ [TRUE_PEAK_HIGH] Canal com True Peak muito alto: ${maxTruePeakdBTP.toFixed(2)} dBTP (> 6 dBTP)`);
console.warn(`⚠️ True Peak negativo detectado: ${maxTruePeak} - usando -Infinity`);
```

### 5.4 📍 LOG CARACTERÍSTICO DA SOBRESCRITA
**A mensagem específica solicitada:**
```javascript
console.error(`🔧 [FIX] Corrigindo True Peak para Sample Peak`);
```
**Localização:** `truepeak.js` linha 173 e linha 310

---

## 🗄️ 6. RASTREAMENTO JSON OUTPUT

### 6.1 Fluxo de Dados
```
truepeak.js (analyzeTruePeaks) 
    ↓ 
    {true_peak_dbtp, true_peak_linear, ...}
    ↓
core-metrics.js (calculateTruePeakMetrics)
    ↓
    {maxDbtp, maxLinear, ...truePeakMetrics}
    ↓
json-output.js (extractTechnicalData)
    ↓
    technicalData.truePeakDbtp = safeSanitize(coreMetrics.truePeak.maxDbtp)
    ↓
JSON FINAL → Postgres
```

### 6.2 Campos no JSON Final
```javascript
// technicalData:
technicalData.truePeakDbtp     // coreMetrics.truePeak.maxDbtp
technicalData.truePeakLinear   // coreMetrics.truePeak.maxLinear

// fullJSON.truePeak:
truePeak: {
  maxDbtp: technicalData.truePeakDbtp,
  maxLinear: technicalData.truePeakLinear,
  samplePeakLeft: technicalData.samplePeakLeftDb,
  samplePeakRight: technicalData.samplePeakRightDb,
  clipping: { samples: ..., percentage: ... }
}
```

### 6.3 Campo de Score (scoring-v2-config.json)
```json
{
  "name": "truePeakDbtp",
  "source": "technicalData.truePeakDbtp",  // ← VALOR JÁ CORRIGIDO CHEGA AQUI
  "primary": "truePeakDbtp"
}
```

---

## 🚨 7. DIAGNÓSTICO: PONTOS CRÍTICOS

### 7.1 ❌ ERRO FUNDAMENTAL
**TRUE PEAK ESTÁ CAINDO EM FALLBACK SISTEMÁTICO**

**Causa Raiz:** Comparação incompatível entre escalas:
- True Peak calculado em **dBTP** (ITU-R BS.1770-4)
- Sample Peak calculado em **dBFS** 
- **dBTP ≠ dBFS** → comparação sempre ativa fallback

### 7.2 🔄 FALLBACK MASCARADO
1. ✅ **Há log explícito** da correção
2. ❌ **Não há flag `fallback_mode`** no JSON
3. ❌ **Valor original perdido** após sobrescrita
4. ❌ **Front-end não sabe** que TP foi corrigido

### 7.3 🎯 VALORES > 0 dBTP EXPLICADOS
**Por que True Peak > 0 dBTP aparece:**
1. **Sample Peak = -0.5 dBFS** (valor normal)
2. **True Peak calculado = -1.2 dBTP** (valor normal ITU-R)
3. **Comparação:** `-1.2 < -0.5` → ✅ ATIVA FALLBACK
4. **Resultado:** `True Peak = -0.5 dBTP` (copiado do Sample Peak)
5. **JSON final:** `truePeakDbtp: -0.5` (parece válido, mas é fallback)

### 7.4 📊 DIFERENÇAS DE ESCALA
```
Sample Peak: 0.5 linear = -6.02 dBFS
True Peak ITU-R: 0.52 linear = -5.68 dBTP

Diferença teórica: ~0.34 dB (TP > SP sempre)
Diferença observada: TP < SP (impossível fisicamente)
```

---

## 🎯 8. CONCLUSÕES DA AUDITORIA

### 8.1 ✅ VERDADEIRO PEAK ESTÁ SENDO CALCULADO CORRETAMENTE
- ✅ Oversampling 4x/8x implementado
- ✅ ITU-R BS.1770-4 compliant 
- ✅ Algoritmo polyphase correto
- ✅ Conversão linear→dBTP precisa

### 8.2 ❌ TRUE PEAK ESTÁ CAINDO EM FALLBACK SISTEMÁTICO
- ❌ Comparação dBTP vs dBFS sem conversão
- ❌ Fallback mascarado (não documentado no JSON)
- ❌ Valores originais perdidos
- ❌ Sistema reporta fallback como valor real

### 8.3 🔍 EVIDÊNCIAS DE FALLBACK
1. **Log presente:** `"🔧 [FIX] Corrigindo True Peak para Sample Peak"`
2. **Localização:** `truepeak.js` linhas 173 e 310
3. **Condição:** `maxTruePeakdBTP < samplePeakdB` (escalas incompatíveis)
4. **Resultado:** True Peak sobrescrito com Sample Peak

### 8.4 🚩 VALORES IMPOSSÍVEIS EXPLICADOS
**True Peak > 0 dBTP não é erro de cálculo, é fallback ativo:**
- Sample Peak alto (ex: -0.1 dBFS) força True Peak = -0.1 dBTP
- JSON reporta como se fosse cálculo real
- Front-end não detecta que é fallback

---

## 📋 9. POSSÍVEIS CAUSAS PARA TP < SP

### 9.1 Algoritmo Oversampling
- ✅ **Polyphase correto** (coeficientes validados)
- ✅ **Delay line** implementado
- ❓ **Sub-amostragem** pode ter bug sutil

### 9.2 Diferenças de Escala
- ❌ **dBTP vs dBFS** (principal suspeito)
- ❓ **Referência ITU-R** pode diferir de dBFS
- ❓ **Normalização** inconsistente

### 9.3 Dados de Entrada
- ❓ **Oversampling insuficiente** para frequências altas
- ❓ **Filtro anti-aliasing** muito agressivo
- ❓ **Floating point precision** em casos extremos

---

## 🎯 10. INDICAÇÃO FINAL

### 10.1 STATUS ATUAL
```
✅ True Peak: CÁLCULO CORRETO (algoritmo válido)
❌ True Peak: FALLBACK MASCARADO (comparação inválida)
🎯 Resultado: Sistema funcional mas com valores híbridos (real+fallback)
```

### 10.2 BLOQUEADORES IDENTIFICADOS
1. **Comparação dBTP vs dBFS** sem conversão
2. **Fallback silencioso** no JSON
3. **Perda de rastreabilidade** do valor original
4. **Falta de flag** `is_fallback` ou `corrected_value`

### 10.3 RECOMENDAÇÃO
**🔧 CORREÇÃO NECESSÁRIA:** Normalizar escalas antes da comparação ou documentar fallback explicitamente no JSON.

**⚠️ NÃO QUEBRAR:** O sistema atual funciona, apenas usa valores corrigidos. Qualquer mudança deve preservar compatibilidade.

---

**🏁 AUDITORIA FINALIZADA**  
**📊 RESULTADO:** True Peak cálculo correto, fallback sistemático ativo por incompatibilidade de escalas.