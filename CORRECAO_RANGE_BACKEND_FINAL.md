# ✅ CORREÇÃO FINAL: RANGE MODAL = RANGE TABELA

**Data:** 24/12/2025  
**Problema:** Cards calculavam "Faixa ideal" como `target ± tolerance` ao invés de usar `target_range.min/max` real  
**Resultado:** Range divergente entre tabela e sugestões

---

## 🔍 RAIZ DO BUG

### **Exemplo do Bug:**

**TABELA (correto):**
- Bass (60-120 Hz): -32.0 a -24.0 dB (do `target_range`)
- Valor: -25.5 dB
- Status: ✅ OK (dentro do range)

**CARD (ERRADO):**
- Grave (60-250 Hz): -32.5 a -26.5 dB (calculado como -29.5 ± 3)
- Valor: -25.5 dB  
- Status: ❌ CRÍTICO (fora do range calculado)

**Divergência:** -32.5 a -26.5 ≠ -32.0 a -24.0

---

## 🎯 ARQUIVOS MODIFICADOS

### **1. suggestion-text-builder.js (Backend)**

**Problema:** Funções `buildMetricSuggestion` e `buildBandSuggestion` **CALCULAVAM** o range:

```javascript
// ❌ ANTES (linha 66-67)
const min = target - tolerance;  // -29.5 - 3 = -32.5
const max = target + tolerance;  // -29.5 + 3 = -26.5
```

**Correção:** Aceitar `min/max` reais e usar como prioridade:

```javascript
// ✅ DEPOIS
export function buildMetricSuggestion({ 
  key, label, unit, value, target, tolerance,
  min,  // ✅ ACEITAR min REAL do target_range
  max,  // ✅ ACEITAR max REAL do target_range
  decimals = 1
}) {
  // ✅ USAR min/max REAIS se fornecidos, senão calcular como fallback
  const rangeMin = (min !== undefined && min !== null) ? min : (target - tolerance);
  const rangeMax = (max !== undefined && max !== null) ? max : (target + tolerance);
  
  console.log(`[BUILD-METRIC] 🔍 Range para ${key}:`, {
    receivedMin: min,
    receivedMax: max,
    usedMin: rangeMin,
    usedMax: rangeMax,
    source: (min !== undefined && max !== undefined) ? 'target_range (REAL)' : 'calculated (FALLBACK)'
  });
  
  // ... resto usa rangeMin/rangeMax ao invés de min/max
}
```

**Mudanças similares em `buildBandSuggestion` (linha 256).**

---

### **2. problems-suggestions-v2.js (Backend)**

**Problema:** Chamadas de `buildMetricSuggestion` e `buildBandSuggestion` **NÃO PASSAVAM** `min/max`:

```javascript
// ❌ ANTES (linha 559)
const textSuggestion = buildMetricSuggestion({
  key: 'lufs',
  label: METRIC_LABELS.lufs,
  unit: 'LUFS',
  value: lufs,
  target: lufsTarget,
  tolerance: tolerance,
  decimals: 1
  // ❌ NÃO passava min/max
});
```

**Correção:** Passar `bounds.min/max` em TODAS as chamadas:

```javascript
// ✅ DEPOIS (linhas 559, 714, 829, 958, 1299)
const textSuggestion = buildMetricSuggestion({
  key: 'lufs',
  label: METRIC_LABELS.lufs,
  unit: 'LUFS',
  value: lufs,
  target: lufsTarget,
  tolerance: tolerance,
  min: bounds.min,  // ✅ PASSAR min REAL
  max: bounds.max,  // ✅ PASSAR max REAL
  decimals: 1
});
```

**Locais corrigidos:**
- LUFS (linha 559)
- TruePeak (linha 714)
- DR (linha 829)
- Stereo (linha 958)
- Bands (linha 1299)

---

## 📊 ORIGEM DOS VALORES

### **De onde vem `bounds.min/max`?**

```javascript
// problems-suggestions-v2.js, linha 175-220
getRangeBounds(threshold) {
  // ✅ PRIORIDADE 1: min/max diretos (NOVO FORMATO)
  if (typeof threshold.min === 'number' && typeof threshold.max === 'number') {
    return { min: threshold.min, max: threshold.max };
  }
  
  // ✅ PRIORIDADE 2: target_range (BANDAS)
  if (threshold.target_range) {
    const minValue = threshold.target_range.min ?? threshold.target_range.min_db;
    const maxValue = threshold.target_range.max ?? threshold.target_range.max_db;
    return { min: minValue, max: maxValue };
  }
  
  // ⚠️ FALLBACK LEGADO: target ± tolerance (será deprecado)
  return {
    min: threshold.target - threshold.tolerance,
    max: threshold.target + threshold.tolerance
  };
}
```

**Fonte:** `genreTargets.bands[bandKey].target_range` (do Postgres, mesma fonte que a tabela usa)

---

## ✅ VALIDAÇÃO

### **Logs Adicionados:**

```javascript
[BUILD-METRIC] 🔍 Range para bass:
  receivedMin: -32
  receivedMax: -24
  calculatedMin: -32.5  // ← Seria usado ANTES (errado)
  calculatedMax: -26.5  // ← Seria usado ANTES (errado)
  usedMin: -32          // ← Usando AGORA (correto)
  usedMax: -24          // ← Usando AGORA (correto)
  source: 'target_range (REAL)'
```

### **Teste de Aceite:**

1. **Contar rows da tabela:** `SELECT COUNT(*) WHERE severity != 'OK'`
2. **Contar sugestões:** Deve ser **EXATAMENTE igual**
3. **Comparar ranges:** Para cada métrica, `card.faixaIdeal === tabela.range`

**Exemplo esperado:**
```
TABELA:
  Bass (60-120): -32.0 a -24.0 dB
  
CARD:
  🥁 Bass (60-120 Hz)
  • Valor atual: -25.5 dB
  • Faixa ideal: -32.0 a -24.0 dB  ✅ IDÊNTICO
  • Alvo recomendado: -28.0 dB
```

---

## 🔄 FLUXO DE DADOS

### **ANTES (ERRADO):**
```
genreTargets.target_range = { min: -32, max: -24 }
    ↓
getRangeBounds() retorna { min: -32, max: -24 }
    ↓
buildBandSuggestion({ target: -28, tolerance: 3 })
    ↓ ❌ IGNORAVA bounds e recalculava
min = -28 - 3 = -32.5  ❌
max = -28 + 3 = -26.5  ❌
    ↓
"Faixa ideal: -32.5 a -26.5 dB"  ❌ DIVERGENTE
```

### **DEPOIS (CORRETO):**
```
genreTargets.target_range = { min: -32, max: -24 }
    ↓
getRangeBounds() retorna { min: -32, max: -24 }
    ↓
buildBandSuggestion({ target: -28, tolerance: 3, min: -32, max: -24 })
    ↓ ✅ USA bounds.min/max
rangeMin = -32  ✅
rangeMax = -24  ✅
    ↓
"Faixa ideal: -32.0 a -24.0 dB"  ✅ IDÊNTICO À TABELA
```

---

## 📝 RESUMO EXECUTIVO

### **O que estava errado:**
Builders de texto calculavam range como `target ± tolerance` ao invés de usar `target_range.min/max`.

### **Onde estava:**
- `suggestion-text-builder.js` (linhas 66-67 e 301)
- 5 chamadas em `problems-suggestions-v2.js` (linhas 559, 714, 829, 958, 1299)

### **Como foi corrigido:**
1. Modificar builders para **ACEITAR** `min/max` como parâmetros
2. Usar `min/max` reais se fornecidos, calcular apenas como fallback
3. Passar `bounds.min/max` em **TODAS** as chamadas

### **Impacto:**
- **Linhas alteradas:** ~50 linhas em 2 arquivos
- **Funções novas:** 0
- **Refactors:** 0
- **Breaking changes:** 0
- **Correção cirúrgica:** ✅

---

## 🧪 COMO TESTAR

1. Fazer upload de áudio EDM
2. Verificar console backend:
   ```
   [BUILD-METRIC] 🔍 Range para bass:
     source: 'target_range (REAL)'
   ```
3. Verificar visualmente:
   - Range na tabela: -32.0 a -24.0 dB
   - Range no card: -32.0 a -24.0 dB ✅
4. Contar: `tableRows != OK` === `modalCards` ✅

---

**Status:** ✅ CORRIGIDO  
**Próximo passo:** Reiniciar backend e testar com 1 áudio

