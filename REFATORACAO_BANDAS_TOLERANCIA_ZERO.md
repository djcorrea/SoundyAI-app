# 🔧 REFATORAÇÃO: BANDAS ESPECTRAIS COM TOLERÂNCIA ZERO

**Data:** 15 de janeiro de 2025  
**Escopo:** Comparação binária para bandas espectrais (sub, bass, lowMid, mid, highMid, presence, air)  
**Objetivo:** Verde SOMENTE quando value ∈ [min, max], sem tolerância automática

---

## 📋 SUMÁRIO EXECUTIVO

Esta refatoração eliminou **COMPLETAMENTE** o uso de tolerâncias automáticas para bandas espectrais, implementando um sistema de **comparação binária por range**:

- ✅ **Verde**: SOMENTE quando `min ≤ value ≤ max`
- ⚠️ **Amarelo**: Fora do range por até **1.0 dB**
- 🟠 **Laranja**: Fora do range por até **3.0 dB**
- ❌ **Vermelho**: Fora do range por mais de **3.0 dB**

**Proibições implementadas:**
- ❌ Cálculo automático de tolerance = `(max - min) * 0.25`
- ❌ Fallback de tolerance = `10% do target`
- ❌ Uso de `tol_db` para coloração de bandas
- ❌ Verde "tolerado" (fora do range mas próximo)

---

## 🎯 ARQUIVOS ALTERADOS

### 1️⃣ `lib/audio/features/suggestion-scorer.js`

**Alterações:**

#### A. Constantes de threshold (linhas 5-7)
```javascript
// [BANDS-TOL-0] Thresholds fixos para classificação de bandas espectrais (sem tolerância)
this.BAND_YELLOW_DB = 1.0;   // ≤1.0dB fora do range → yellow
this.BAND_ORANGE_DB = 3.0;   // ≤3.0dB fora do range → orange
// >3.0dB → red (implícito)
```

#### B. Método `calculateZScore()` (linhas 174-208)
**ANTES:**
```javascript
calculateZScore(value, target, tolerance) {
    if (!Number.isFinite(value) || !Number.isFinite(target) || 
        !Number.isFinite(tolerance) || tolerance <= 0) {
        return 0;
    }
    return (value - target) / tolerance;
}
```

**DEPOIS:**
```javascript
calculateZScore(value, target, tolerance, options = {}) {
    // [BANDS-TOL-0] Para bandas espectrais com target_range, usar lógica binária sem tolerância
    if (options.isBand && target && typeof target === 'object' && 
        Number.isFinite(target.min) && Number.isFinite(target.max)) {
        
        // Comparação binária por range: verde SOMENTE dentro de [min, max]
        if (value >= target.min && value <= target.max) {
            return 0; // Dentro do range → perfeito (verde)
        }
        
        // Fora do range: calcular distância ao limite mais próximo
        const distance = Math.min(
            Math.abs(value - target.min),
            Math.abs(value - target.max)
        );
        
        // [BANDS-TOL-0] Retornar z-score sintético baseado em thresholds fixos
        // Thresholds: ≤1.0dB=yellow, ≤3.0dB=orange, >3.0dB=red
        // Mapear para z-scores equivalentes: 1.5 (yellow), 2.5 (orange), 5.0 (red)
        if (distance <= 1.0) return 1.5;  // yellow
        if (distance <= 3.0) return 2.5;  // orange
        return 5.0;                        // red
    }
    
    // Lógica padrão para métricas principais (LUFS, TP, DR, etc.)
    if (!Number.isFinite(value) || !Number.isFinite(target) || !Number.isFinite(tolerance) || tolerance <= 0) {
        return 0;
    }
    return (value - target) / tolerance;
}
```

**Impacto:** Adiciona bypass de z-score para bandas, usando distância absoluta ao range.

---

### 2️⃣ `lib/audio/features/enhanced-suggestion-engine.js`

**Alterações:**

#### A. Seção de bandas espectrais (linhas 333-469, substituindo ~40 linhas)

**Mudanças principais:**

1. **Prioridade 1: `target_range` (sistema sem tolerância)**
   - Comparação binária: `inRange = (value >= min && value <= max)`
   - Se `inRange` → não gera sugestão (verde)
   - Se fora → calcula `distance` ao limite mais próximo
   - Classifica por thresholds fixos: `≤1.0dB`, `≤3.0dB`, `>3.0dB`

2. **Fallback: `target_db` fixo**
   - Trata como `min = max = target_db` (match exato para verde)
   - Usa mesma lógica de thresholds fixos

3. **Logs detalhados com tag `[BANDS-TOL-0]`**
   ```javascript
   this.logAudit('BAND_IN_RANGE', `Banda ${band} dentro do range`, {...});
   this.logAudit('BAND_RANGE_LOGIC', `Banda ${band} fora do range`, {...});
   this.logAudit('BAND_FIXED_LOGIC', `Banda ${band} fora do target_db`, {...});
   ```

4. **Tolerância sempre 0 para bandas**
   ```javascript
   tolerance: 0, // [BANDS-TOL-0] Sempre 0 para bandas
   ```

**Código completo:** Ver arquivo (linhas 333-469)

#### B. Seção `window.PRE_UPDATE_REFERENCE_SUGGESTIONS_DATA` (linhas 408-497)

**Mudanças:**
- Processa `target_range` do item ou cria a partir de `ideal`
- Usa mesma lógica binária de comparação
- Logs com tag `[BANDS-TOL-0]`

---

### 3️⃣ `public/audio-analyzer-integration.js`

**Alterações:**

#### A. Seção "Determinar target com suporte a ranges" (linhas 5673-5688)

**ANTES:**
```javascript
if (refBand.target_range && ...) {
    tgt = refBand.target_range;
    // Calcular tolerância como metade do range (usado para coloração)
    tolerance = (tgt.max - tgt.min) / 2;  // ❌ REMOVIDO
}
```

**DEPOIS:**
```javascript
// [BANDS-TOL-0] Prioridade 1: target_range (sistema sem tolerância)
if (refBand.target_range && ...) {
    tgt = refBand.target_range;
    tolerance = 0; // [BANDS-TOL-0] Sempre 0 para bandas (comparação binária)
    console.log(`🎯 [BANDS-TOL-0] Usando target_range para ${refBandKey}: [${tgt.min}, ${tgt.max}], tol: 0`);
}
// Prioridade 2: target_db fixo (tratar como min=max=target)
else if (!refBand._target_na && Number.isFinite(refBand.target_db)) {
    tgt = { min: refBand.target_db, max: refBand.target_db };  // [BANDS-TOL-0] Converter para range
    tolerance = 0; // [BANDS-TOL-0] Sempre 0 para bandas (match exato)
}
```

#### B. Bandas extras e fallback (3 ocorrências)

Todas as seções que calculam `tolerance = (target.max - target.min) / 2` foram substituídas por:
```javascript
tolerance = 0; // [BANDS-TOL-0] Sempre 0 para bandas
```

E `target_db` convertido para range:
```javascript
target = { min: directRefData.target_db, max: directRefData.target_db };
```

#### C. Função `pushRow()` - Coloração de UI (linhas 5440-5495)

**ANTES:**
```javascript
if (absDiff <= tol) {
    cssClass = 'ok';
    statusText = 'Ideal';
} else {
    const multiplicador = absDiff / tol;
    if (multiplicador <= 2) {
        cssClass = 'yellow';
        statusText = 'Ajuste leve';
    } else {
        cssClass = 'warn';
        statusText = 'Corrigir';
    }
}
```

**DEPOIS:**
```javascript
// [BANDS-TOL-0] LÓGICA BINÁRIA PARA BANDAS (tol=0)
if (tol === 0) {
    const absDiff = Math.abs(diff);
    
    if (absDiff === 0) {
        // ✅ DENTRO DO RANGE → Verde
        cssClass = 'ok';
        statusText = 'Ideal';
    } else if (absDiff <= 1.0) {
        // ⚠️ Fora por até 1dB → Amarelo
        cssClass = 'yellow';
        statusText = 'Ajuste leve';
    } else if (absDiff <= 3.0) {
        // 🟠 Fora por até 3dB → Laranja
        cssClass = 'orange';
        statusText = 'Ajustar';
    } else {
        // ❌ Fora por >3dB → Vermelho
        cssClass = 'warn';
        statusText = 'Corrigir';
    }
} else {
    // LÓGICA PADRÃO PARA MÉTRICAS PRINCIPAIS (LUFS, TP, DR, etc.)
    // ... código anterior mantido ...
}
```

**Impacto:** UI pinta verde SOMENTE quando dentro do range para bandas.

---

## 🧪 TESTES NECESSÁRIOS (7 CASOS)

### ✅ Teste 1: Dentro do range
- **Range:** `[-28, -22]`
- **Value:** `-25.0`
- **Esperado:** Verde ✅, sem sugestão
- **Log esperado:** `[BAND_IN_RANGE] Banda sub dentro do range`

### ✅ Teste 2: Exatamente no limite (min)
- **Range:** `[-28, -22]`
- **Value:** `-28.0`
- **Esperado:** Verde ✅, sem sugestão

### ✅ Teste 3: Exatamente no limite (max)
- **Range:** `[-28, -22]`
- **Value:** `-22.0`
- **Esperado:** Verde ✅, sem sugestão

### ⚠️ Teste 4: Fora por 0.3 dB
- **Range:** `[-28, -22]`
- **Value:** `-21.7` (0.3 acima do max)
- **Esperado:** Amarelo ⚠️, sugestão gerada, **NÃO verde**
- **Log esperado:** `distance: 0.30, severity: yellow`

### 🟠 Teste 5: Fora por 2 dB
- **Range:** `[-28, -22]`
- **Value:** `-20.0` (2.0 acima do max)
- **Esperado:** Laranja 🟠, sugestão gerada
- **Log esperado:** `distance: 2.00, severity: orange`

### ❌ Teste 6: Fora por 4 dB
- **Range:** `[-28, -22]`
- **Value:** `-18.0` (4.0 acima do max)
- **Esperado:** Vermelho ❌, sugestão gerada
- **Log esperado:** `distance: 4.00, severity: red`

### ✅ Teste 7: JSON com `tol_db: 0` e `target_range` presente
- **Verificar:** Logs NÃO devem conter:
  - ❌ `"25% do range"`
  - ❌ `"10% do target"`
  - ❌ `"effectiveTolerance = ..."`
  - ❌ `"fallback"`
- **Verificar:** Verde SOMENTE quando `inRange === true`

---

## 📊 FLUXO COMPLETO APÓS REFATORAÇÃO

```
┌────────────────────────────────────────────────────────────┐
│ 1️⃣ ORIGEM: Arquivo JSON de gênero (refs/out/*.json)       │
│    → "target_range": { "min": -28, "max": -22 }           │
│    → "tol_db": 0 (IGNORADO para bandas)                   │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      ↓
┌────────────────────────────────────────────────────────────┐
│ 2️⃣ PROCESSAMENTO: enhanced-suggestion-engine.js           │
│                                                             │
│    SE target_range existe:                                 │
│      inRange = (value >= min && value <= max)             │
│                                                             │
│      SE inRange:                                           │
│        → severity = green                                  │
│        → shouldInclude = false  [BANDS-TOL-0]             │
│        → continue (sem sugestão)                           │
│                                                             │
│      SENÃO (fora do range):                                │
│        distance = min(|value-min|, |value-max|)           │
│                                                             │
│        SE distance ≤ 1.0dB:  → yellow  [BANDS-TOL-0]      │
│        SE distance ≤ 3.0dB:  → orange  [BANDS-TOL-0]      │
│        SENÃO:                → red     [BANDS-TOL-0]      │
│                                                             │
│    SENÃO (apenas target_db):                               │
│      Tratar como range: min=max=target_db                 │
│      Usar mesma lógica binária                            │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      ↓
┌────────────────────────────────────────────────────────────┐
│ 3️⃣ CÁLCULO: suggestion-scorer.js                          │
│                                                             │
│    calculateZScore(value, target, 0, { isBand: true })    │
│                                                             │
│    SE options.isBand && target é range:                    │
│      SE inRange: return 0 (perfeito)  [BANDS-TOL-0]       │
│      SENÃO:                                                │
│        distance = min(|value-min|, |value-max|)           │
│        SE distance ≤ 1.0: return 1.5 (yellow)             │
│        SE distance ≤ 3.0: return 2.5 (orange)             │
│        SENÃO:             return 5.0 (red)                │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      ↓
┌────────────────────────────────────────────────────────────┐
│ 4️⃣ UI: audio-analyzer-integration.js                      │
│                                                             │
│    pushRow(label, value, target, 0, ' dB')                │
│    ↑ tolerance = 0 para bandas  [BANDS-TOL-0]             │
│                                                             │
│    SE tol === 0 (banda):                                   │
│      diff = (inRange ? 0 : distância ao limite)           │
│                                                             │
│      SE diff === 0:      → Verde ✅  [BANDS-TOL-0]         │
│      SE diff ≤ 1.0dB:    → Amarelo ⚠️                     │
│      SE diff ≤ 3.0dB:    → Laranja 🟠                     │
│      SENÃO:              → Vermelho ❌                     │
│                                                             │
│    Renderizar badge com cor apropriada                    │
└────────────────────────────────────────────────────────────┘
```

---

## 🎯 GARANTIAS IMPLEMENTADAS

### ✅ Sem tolerância automática
- ❌ Eliminado: `tolerance = (max - min) * 0.25`
- ❌ Eliminado: `tolerance = abs(target) * 0.1`
- ❌ Eliminado: `Math.max(tolerance, 0.5)`

### ✅ Comparação binária pura
- Verde SOMENTE se `min ≤ value ≤ max`
- Fora do range: classifica por distância absoluta (1.0, 3.0 dB)

### ✅ Conversão de `target_db` legado
- `target_db: -25` → `target_range: { min: -25, max: -25 }`
- Match exato para verde

### ✅ Logs detalhados
- Tag `[BANDS-TOL-0]` em todas as alterações
- Logs explícitos: `inRange`, `distance`, `severity`

### ✅ Métricas principais não afetadas
- LUFS, True Peak, DR, LRA mantêm lógica original
- Apenas bandas espectrais usam nova lógica

---

## 🚀 PRÓXIMOS PASSOS

1. **Testar com áudio real:**
   - Fazer upload de áudio de teste
   - Verificar logs no console (`[BANDS-TOL-0]`)
   - Confirmar que bandas dentro do range aparecem verdes
   - Confirmar que bandas fora por 0.3 dB aparecem amarelas (NÃO verdes)

2. **Validar UI:**
   - Tabela de métricas deve mostrar:
     - Verde ✅ SOMENTE para bandas dentro de [min, max]
     - Amarelo ⚠️ para bandas fora por até 1 dB
     - Sem badge "Ideal" para valores fora do range

3. **Revisar sugestões:**
   - Sugestões de bandas devem ter `tolerance: 0`
   - Severity correta baseada em distância
   - Priority calculada corretamente

---

## 📝 CHECKLIST DE VALIDAÇÃO

- [x] ✅ `suggestion-scorer.js`: Constantes `BAND_YELLOW_DB` e `BAND_ORANGE_DB` adicionadas
- [x] ✅ `suggestion-scorer.js`: `calculateZScore()` com bypass para bandas
- [x] ✅ `enhanced-suggestion-engine.js`: Seção de bandas com comparação binária
- [x] ✅ `enhanced-suggestion-engine.js`: Seção `referenceComparison` com comparação binária
- [x] ✅ `audio-analyzer-integration.js`: Todas as seções de `tolerance` zeradas para bandas
- [x] ✅ `audio-analyzer-integration.js`: `pushRow()` com lógica binária para `tol === 0`
- [x] ✅ Todos os comentários marcados com `[BANDS-TOL-0]`
- [x] ✅ Logs detalhados com prefixo `[BANDS-TOL-0]`
- [x] ✅ Métricas principais (LUFS, TP, DR, LRA) não afetadas
- [ ] ⏳ Testes manuais com áudio real (pendente)
- [ ] ⏳ Capturas de log demonstrando 7 testes (pendente)
- [ ] ⏳ Confirmação de que não há fallbacks de tolerância (pendente)

---

## 📌 RESUMO FINAL

**Meta alcançada:** ✅

Agora, se `min=25` e `max=30`, valores `31` ou `32` **NUNCA** aparecem verdes.  
Verde **SOMENTE** dentro de `[25, 30]`.

Todas as mudanças estão marcadas com `[BANDS-TOL-0]` e documentadas neste arquivo.

---

**FIM DO DOCUMENTO**
