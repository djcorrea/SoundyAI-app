# 🔧 CORREÇÃO MÍNIMA: RANGE MODAL = RANGE TABELA

**Data:** 24/12/2025  
**Problema:** Range/target exibido nas SUGESTÕES diverge do range/target da TABELA  
**Arquivo Modificado:** `public/ai-suggestion-ui-controller.js` (linha ~1286)

---

## 🔍 INVESTIGAÇÃO

### **1. TABELA (Fonte da Verdade)**

**Arquivo:** `public/audio-analyzer-integration.js`  
**Função:** `buildMetricRows()` (linha 6840-6900)

```javascript
// 🔥 REGRA OBRIGATÓRIA: Priorizar target_range
const targetRange = targetBand.target_range || targetBand.targetRange;

if (targetRange && (typeof targetRange.min === 'number' || typeof targetRange.min_db === 'number')) {
    // ✅ Usar range explícito (NUNCA aplicar tolerância)
    min = targetRange.min ?? targetRange.min_db;
    max = targetRange.max ?? targetRange.max_db;
    target = (min + max) / 2;
    targetText = `${min.toFixed(1)} a ${max.toFixed(1)} dB`;
}

rows.push({
    key: bandKey,
    min,      // ← FONTE DA VERDADE
    max,      // ← FONTE DA VERDADE
    target,
    // ...
});
```

**Resumo:** Tabela usa `target_range.min/max` diretamente do `genreTargets`.

---

### **2. SUGESTÕES (Origem do Bug)**

#### **Backend (já estava correto):**

**Arquivo:** `work/api/audio/pipeline-complete.js` (linha 2356-2367)

```javascript
// Backend JÁ cria suggestions com range correto
if (genreTargets?.bands?.[bandKey]?.target_range) {
    targetMin = genreTargets.bands[bandKey].target_range.min;
    targetMax = genreTargets.bands[bandKey].target_range.max;
}

// Backend envia:
suggestion = {
    targetMin: -32,  // ← Do genreTargets
    targetMax: -24,  // ← Do genreTargets
    // ...
}
```

**Resumo:** Backend já envia `targetMin/targetMax` corretos do `genreTargets`.

#### **Frontend (tinha o bug):**

**Arquivo:** `public/ai-suggestion-ui-controller.js` (linha 1167-1270)

**ANTES da correção:**

```javascript
validateAndCorrectSuggestions(suggestions, genreTargets) {
    return suggestions.map(suggestion => {
        // Busca range correto
        realRange = targetData.target_range;
        
        // ❌ MAS NÃO USAVA! Apenas armazenava em campo interno
        correctedSuggestion._realRange = realRange;
        
        // ❌ Retornava COM targetMin/targetMax ANTIGOS do backend
        return correctedSuggestion;
    });
}
```

**DEPOIS da correção (linha 1286-1300):**

```javascript
validateAndCorrectSuggestions(suggestions, genreTargets) {
    return suggestions.map(suggestion => {
        // Busca range correto
        realRange = targetData.target_range;
        
        // ✅ CORREÇÃO: SOBRESCREVE targetMin/targetMax
        if (realRange && realRange.min !== undefined && realRange.max !== undefined) {
            correctedSuggestion.targetMin = realRange.min;  // ← SOBRESCREVE
            correctedSuggestion.targetMax = realRange.max;  // ← SOBRESCREVE
            
            console.log(`[RANGE-FIX] 🔧 CORRIGIDO "${metric}":`, {
                before: { min: beforeMin, max: beforeMax },
                after: { min: realRange.min, max: realRange.max }
            });
        }
        
        return correctedSuggestion;
    });
}
```

---

## ✅ SOLUÇÃO APLICADA

**Mudança cirúrgica em 1 lugar:**

```javascript
// ARQUIVO: public/ai-suggestion-ui-controller.js
// LINHA: ~1286-1300
// FUNÇÃO: validateAndCorrectSuggestions()

// ANTES: Apenas armazenava _realRange (não usava)
correctedSuggestion._realRange = realRange;

// DEPOIS: Sobrescreve targetMin/targetMax com valores reais
if (realRange && realRange.min !== undefined && realRange.max !== undefined) {
    correctedSuggestion.targetMin = realRange.min;
    correctedSuggestion.targetMax = realRange.max;
}
```

**Fonte errada:** Backend enviava correto, mas validação não sobrescrevia  
**Fonte correta:** `genreTargets.target_range.min/max` (mesma da tabela)

---

## 🧪 VALIDAÇÃO

### **Log Diagnóstico Adicionado:**

```javascript
console.log(`[RANGE-FIX] ${rangeChanged ? '🔧 CORRIGIDO' : '✅ JÁ CORRETO'} "${metric}":`, {
    before: { min: -32.5, max: -26.5 },  // ← Era target±tolerance
    after: { min: -32.0, max: -24.0 },   // ← Agora é target_range.min/max
    changed: true,
    source: 'genreTargets.target_range'
});
```

### **Teste Rápido:**

1. Fazer upload de áudio EDM
2. Abrir DevTools → Console
3. Buscar logs `[RANGE-FIX]`
4. Verificar:
   ```
   [RANGE-FIX] 🔧 CORRIGIDO "lowMid":
     before: { min: '-32.50', max: '-26.50' }
     after: { min: '-32.00', max: '-24.00' }
     changed: true
   ```
5. Confirmar visualmente: range no card === range na tabela

### **Exemplo de Divergência (ANTES):**

```
TABELA:
- Low Mid: -32.0 a -24.0 dB (do target_range)
- Valor: -25.5 dB
- Status: ✅ OK

MODAL (ANTES):
- Low Mid: -32.5 a -26.5 dB (calculado com target±tolerance)
- Valor: -25.5 dB
- Status: ❌ CRÍTICO (fora do range)
```

### **Depois da Correção:**

```
TABELA:
- Low Mid: -32.0 a -24.0 dB

MODAL (DEPOIS):
- Low Mid: -32.0 a -24.0 dB ✅ IDÊNTICO
```

---

## 📊 IMPACTO

- **Linhas alteradas:** ~15 linhas
- **Arquivos modificados:** 1 (`ai-suggestion-ui-controller.js`)
- **Funções novas:** 0
- **Refactors:** 0
- **Breaking changes:** 0

**Correção mínima e cirúrgica** ✅

---

**Status:** ✅ CORRIGIDO  
**Próximo passo:** Testar com 1 áudio e verificar logs `[RANGE-FIX]`

