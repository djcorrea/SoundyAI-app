# 📋 RESUMO DAS CORREÇÕES DSP - 29/12/2025

## ✅ CORREÇÕES APLICADAS

### 1. LRA (Loudness Range) — `loudness.js`

**Problema:** A função `calculateLoudnessMetricsV2()` retornava `lra: 0` fixo.

**Correção:** Restaurado cálculo EBU R128 usando `LUFSMeter.calculateR128LRA()`:
- Aplica K-weighting nos canais
- Calcula short-term loudness de 3 segundos
- Aplica gating absoluto (-70 LUFS) e relativo (integrated - 20 LU)
- Retorna P95 - P10 dos blocos válidos

**Localização:** `work/lib/audio/features/loudness.js` linhas 615-700

**Saída esperada:**
```javascript
{
  lra: 6.5, // Valor real em LU
  lra_meta: {
    algorithm: 'EBU_R128_V2',
    gated_count: 85,
    rel_threshold: -33.5,
    valid: true
  }
}
```

---

### 2. Uniformidade Espectral — `core-metrics.js`

**Problema:** Cálculo usava apenas o primeiro frame FFT, frequentemente silêncio ou transiente.

**Correção:** Agora processa até 500 frames FFT e agrega usando MEDIANA:
- Loop por todos os frames disponíveis
- Coleta coeficientes de variação válidos (CV > 0)
- Calcula mediana dos CVs
- Converte para porcentagem: `uniformityPercent = (1 - CV) * 100`

**Localização:** `work/api/audio/core-metrics.js` linhas 446-540

**Saída esperada:**
```javascript
{
  uniformityPercent: 65.2,
  uniformity: { coefficient: 0.348 },
  aggregation: {
    method: 'median',
    framesProcessed: 500,
    validFrames: 487
  },
  rating: 'good'
}
```

---

### 3. Export spectralUniformity — `json-output.js`

**Problema:** Campo `spectralUniformity` foi removido do export JSON.

**Correção:** Restaurado export com novos campos:
- `spectralUniformity` — valor normalizado [0-1]
- `spectralUniformityPercent` — valor em porcentagem [0-100]
- `spectralUniformityMeta` — metadados de agregação

**Localização:** `work/api/audio/json-output.js` linhas 577-610 e 1090-1095

---

## ✅ CORREÇÃO APLICADA (OPÇÃO C Aprovada)

### 4. Abertura Estéreo (Stereo Opening)

**Problema:** Fórmula anterior `width = 2 * Side / (Mid + Side)` amplificava valores gerando ~87% mesmo para material moderadamente aberto.

**Decisão:** OPÇÃO C aprovada → `abertura = 1 - |correlação|`

**Correção aplicada:**
- **`stereo-metrics.js`:** Nova função `calculateStereoOpening()` implementada
- **`core-metrics.js`:** `calculateStereoMetricsCorrect()` atualizado para incluir campos de opening
- **`json-output.js`:** Export de `stereoOpening`, `stereoOpeningPercent`, `stereoOpeningCategory`

**Lógica da fórmula:**
- Correlação = +1 (mono perfeito) → Abertura = 0% (totalmente fechado)
- Correlação = 0 (totalmente descorrelacionado) → Abertura = 100% (totalmente aberto)
- Correlação = -1 (fase invertida) → Abertura = 0% (problemas de fase)

**Categorização:**
| Abertura | Categoria | Significado |
|----------|-----------|-------------|
| 0-20% | mono | Praticamente mono |
| 20-40% | narrow | Imagem estéreo estreita |
| 40-60% | moderate | Abertura moderada |
| 60-80% | wide | Imagem estéreo ampla |
| 80-100% | very_wide | Muito aberto (verificar fase) |

**Saída esperada:**
```javascript
{
  stereoOpening: 0.65,
  stereoOpeningPercent: 65.0,
  stereoOpeningCategory: 'wide'
}
```

---

## 📊 VALORES ESPERADOS APÓS CORREÇÕES

| Métrica | Antes | Depois | Exemplo Típico |
|---------|-------|--------|----------------|
| LRA | 0.0 LU | 3-15 LU | Pop: 6-8 LU |
| Uniformidade Espectral | 0.0% | 30-90% | Mix balanceado: 60-70% |
| Correlação Estéreo | ~0.3 | ~0.3 | Sem mudança (correto) |
| Abertura Estéreo | ~87% | ~70% | Correlação 0.3 → 70% abertura |

---

## 🔍 COMO TESTAR

1. Processar um arquivo de áudio no backend
2. Verificar nos logs:
   - `[LRA_V2] ✅ LRA calculado: X.XX LU`
   - `[DEBUG_UNIFORMITY] ✅ Resultado agregado: { medianCoefficient, uniformityPercent }`
3. Verificar no JSON de saída:
   - `technicalData.lra` ≠ 0 (para áudio > 3 segundos)
   - `technicalData.spectralUniformityPercent` ≠ 0

---

## 📁 ARQUIVOS MODIFICADOS

```
work/lib/audio/features/loudness.js          (+45 linhas)
work/api/audio/core-metrics.js               (+65 linhas)
work/api/audio/json-output.js                (+30 linhas)
AUDITORIA_DSP_METRICAS_BACKEND_COMPLETA.md   (novo)
RESUMO_CORRECOES_DSP_2025-12-29.md           (novo)
```
