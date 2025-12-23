# 🔧 CORREÇÃO: Cobertura 100% de Métricas Não-OK + Debug de Ranges

**Data:** 23 de dezembro de 2025  
**Objetivo:** Diagnosticar e corrigir por que bandas com severidade ATENÇÃO/CRÍTICA não geram sugestões

---

## 📋 PROBLEMA IDENTIFICADO

Após a correção anterior que bloqueou sugestões OK (correto), surgiram 2 problemas:

### 1. **Bandas não geram sugestões mesmo quando ATENÇÃO/CRÍTICA:**
- Brilho (10k-20kHz) → `brilliance`
- Presença (5k-10kHz) → `presence`  
- High Mid (2k-5kHz) → `high_mid`
- Low Mid (150-500Hz) → `low_mid`

### 2. **Inconsistência de range:**
- **Tabela** mostra range (ex.: -30 a -26 dB)
- **Sugestão** mostra outro range (ex.: -31 a -25 dB)
- **Causa**: Sugestão calculando `target ± tolerance` ao invés de usar `min/max` do target_range

---

## 🔍 DIAGNÓSTICO REALIZADO

### Auditoria do Código

**Arquivo:** `work/lib/audio/features/problems-suggestions-v2.js`

**Funções Analisadas:**

1. **`getRangeBounds(threshold)`** (linha 171-242)
   - **Problema detectado:** Verificava `threshold.target_range.min` e `threshold.target_range.max`
   - **MAS** o JSON pode ter `min_db` e `max_db` em alguns casos
   - **Solução:** Suporte a ambos formatos (`min/max` e `min_db/max_db`)

2. **`analyzeBand(bandKey, value, bandName, suggestions, consolidatedData)`** (linha 1094+)
   - **Gate implementado:** `if (rawDelta === 0) return;`
   - **Cálculo de delta:** Baseado em `bounds` (min/max do range)
   - **Possível problema:** Se `bounds` estiver incorreto, `rawDelta` será calculado errado

3. **`analyzeSpectralBands()`** (linha 998+)
   - Chama `analyzeBand()` para cada banda se `Number.isFinite(value)`
   - Bandas analisadas: `sub`, `bass`, `low_mid`, `mid`, `high_mid`, `presence`, `brilliance`

---

## ✅ CORREÇÕES APLICADAS

### 1. Suporte Duplo de Formato em `getRangeBounds`

**Antes:**
```javascript
if (threshold.target_range && 
    typeof threshold.target_range.min === 'number' && 
    typeof threshold.target_range.max === 'number') {
  return {
    min: threshold.target_range.min,
    max: threshold.target_range.max
  };
}
```

**Depois:**
```javascript
if (threshold.target_range) {
  const minValue = threshold.target_range.min ?? threshold.target_range.min_db;
  const maxValue = threshold.target_range.max ?? threshold.target_range.max_db;
  
  if (typeof minValue === 'number' && typeof maxValue === 'number') {
    console.log('[RANGE_BOUNDS] ✅ Usando target_range:', {
      min: minValue,
      max: maxValue,
      originalKeys: Object.keys(threshold.target_range)
    });
    return { min: minValue, max: maxValue };
  }
}
```

**Impacto:** Garante que ranges sejam lidos corretamente do JSON, evitando fallback para `target ± tolerance`.

---

### 2. Logs de Debug Extensivos

#### A) **Inventário Completo de Bandas** (início de `analyzeSpectralBands`)

```javascript
console.log('[BANDS][INVENTORY] 📊 INVENTÁRIO COMPLETO:');
Object.keys(bands).forEach(key => {
  const band = bands[key];
  const target = consolidatedData.genreTargets?.bands?.[key];
  console.log(`[BANDS][INVENTORY] 📍 ${key}:`, {
    hasValue: Number.isFinite(band?.value),
    value: band?.value?.toFixed(2),
    hasTarget: !!target,
    target_db: target?.target_db?.toFixed(2),
    target_range: target?.target_range ? 
      `${target.target_range.min?.toFixed(2)} a ${target.target_range.max?.toFixed(2)}` : 
      'MISSING',
    will_analyze: Number.isFinite(band?.value) && !!target
  });
});
```

**O que mostra:**
- Todas as bandas disponíveis em `consolidatedData.metrics.bands`
- Se cada banda tem valor medido
- Se cada banda tem target no `genreTargets`
- Se a banda será analisada (tem valor + target)

#### B) **Debug Completo Antes do Gate** (em `analyzeBand`)

```javascript
console.log(`[DEBUG_GATE][BAND_${bandKey.toUpperCase()}] 🔬 Análise:`, {
  measured: measured.toFixed(2),
  target: target.toFixed(2),
  bounds: { min: bounds.min.toFixed(2), max: bounds.max.toFixed(2) },
  rawDelta: rawDelta.toFixed(4),
  rawDeltaIsZero: rawDelta === 0,
  severityLevel: severity.level,
  willPass: rawDelta !== 0,
  formula: measured < bounds.min ? 
    `${measured.toFixed(2)} < ${bounds.min.toFixed(2)} → delta = ${rawDelta.toFixed(2)}` :
    measured > bounds.max ? 
    `${measured.toFixed(2)} > ${bounds.max.toFixed(2)} → delta = ${rawDelta.toFixed(2)}` :
    `${bounds.min.toFixed(2)} ≤ ${measured.toFixed(2)} ≤ ${bounds.max.toFixed(2)} → delta = 0`
});
```

**O que mostra:**
- Valor medido vs target vs bounds
- Cálculo exato do `rawDelta`
- Se vai passar pelo gate (`rawDelta !== 0`)
- Fórmula usada no cálculo

#### C) **Confirmação de Passagem pelo Gate**

```javascript
if (rawDelta === 0) {
  console.log('[SUGGESTION_GATE] ✅ OMITIDA (banda OK)');
  return;
}

console.log(`[DEBUG_GATE][BAND_${bandKey}] ✅ PASSOU - gerando sugestão`, {
  bandKey,
  rawDelta: rawDelta.toFixed(2),
  severity: severity.level
});

suggestions.push(suggestion);
```

#### D) **Resumo Final** (fim de `analyzeSpectralBands`)

```javascript
const bandSuggestions = suggestions.filter(s => s.metric?.startsWith('band_'));
console.log('[BANDS][SUMMARY] 📊 RESUMO DE SUGESTÕES:');
console.log('[BANDS][SUMMARY] Total:', bandSuggestions.length);
bandSuggestions.forEach(s => {
  console.log(`[BANDS][SUMMARY] ✅ ${s.metric}:`, {
    severity: s.severity?.level,
    delta: s.deltaNum?.toFixed(2),
    status: s.status
  });
});
```

**O que mostra:**
- Quantas sugestões de bandas foram geradas no total
- Detalhes de cada uma (severidade, delta, status)

---

## 🧪 COMO VALIDAR

### Passo 1: Fazer upload de áudio com bandas problemáticas

**Esperar logs:**
```
[BANDS][INVENTORY] 📊 INVENTÁRIO COMPLETO:
[BANDS][INVENTORY] 📍 sub: { hasValue: true, value: -28.50, hasTarget: true, ... }
[BANDS][INVENTORY] 📍 low_mid: { hasValue: true, value: -35.20, hasTarget: true, ... }
[BANDS][INVENTORY] 📍 high_mid: { hasValue: true, value: -22.10, hasTarget: true, ... }
[BANDS][INVENTORY] 📍 presence: { hasValue: true, value: -30.40, hasTarget: true, ... }
[BANDS][INVENTORY] 📍 brilliance: { hasValue: true, value: -31.80, hasTarget: true, ... }
```

### Passo 2: Verificar análise individual de cada banda

**Exemplo LOW_MID fora do range:**
```
[DEBUG_GATE][BAND_LOW_MID] 🔬 Análise:
  measured: -35.20
  target: -30.00
  bounds: { min: -33.00, max: -27.00 }
  rawDelta: -2.20
  rawDeltaIsZero: false
  severityLevel: ajuste_leve
  willPass: true
  formula: -35.20 < -33.00 → delta = -2.20

[DEBUG_GATE][BAND_LOW_MID] ✅ PASSOU - gerando sugestão
```

**Exemplo BRILLIANCE dentro do range (OK):**
```
[DEBUG_GATE][BAND_BRILLIANCE] 🔬 Análise:
  measured: -28.50
  target: -28.00
  bounds: { min: -31.00, max: -25.00 }
  rawDelta: 0.0000
  rawDeltaIsZero: true
  willPass: false
  formula: -31.00 ≤ -28.50 ≤ -25.00 → delta = 0

[SUGGESTION_GATE] ✅ OMITIDA (banda OK)
```

### Passo 3: Verificar resumo final

```
[BANDS][SUMMARY] 📊 RESUMO DE SUGESTÕES:
[BANDS][SUMMARY] Total: 2
[BANDS][SUMMARY] ✅ band_sub: { severity: critical, delta: -3.50, status: low }
[BANDS][SUMMARY] ✅ band_low_mid: { severity: ajuste_leve, delta: -2.20, status: low }
```

---

## 🎯 CHECKLIST DE VALIDAÇÃO

**Cenário 1: Banda OK (dentro do range)**
- [ ] Log `[BANDS][INVENTORY]` mostra banda com `will_analyze: true`
- [ ] Log `[DEBUG_GATE]` mostra `rawDelta: 0.0000`
- [ ] Log `[SUGGESTION_GATE] ✅ OMITIDA` aparece
- [ ] Log `[BANDS][SUMMARY]` NÃO inclui essa banda
- [ ] Modal NÃO mostra card para essa banda
- [ ] Tabela mostra linha verde/OK

**Cenário 2: Banda ATENÇÃO/CRÍTICA (fora do range)**
- [ ] Log `[BANDS][INVENTORY]` mostra banda com `will_analyze: true`
- [ ] Log `[DEBUG_GATE]` mostra `rawDelta: != 0` (ex.: -2.20)
- [ ] Log `[DEBUG_GATE] ✅ PASSOU` aparece
- [ ] Log `[BANDS][SUMMARY]` INCLUI essa banda com severidade correta
- [ ] Modal MOSTRA card para essa banda
- [ ] Tabela mostra linha amarela/vermelha

**Cenário 3: Range consistente entre tabela e sugestão**
- [ ] Log `[RANGE_BOUNDS]` mostra `source: 'target_range'` (NÃO 'calculado_legacy')
- [ ] Bounds no log batem com range da tabela
- [ ] Card da sugestão exibe mesmo range da linha da tabela

---

## 🐛 POSSÍVEIS PROBLEMAS E DIAGNÓSTICO

### Problema: Banda não aparece no inventário

**Diagnóstico:**
```
[BANDS][INVENTORY] 📍 presence: { hasValue: false, ... }
```

**Causa:** `consolidatedData.metrics.bands.presence.value` está `undefined` ou não é número

**Solução:** Verificar pipeline de extração de métricas espectrais

---

### Problema: Banda aparece no inventário mas não é analisada

**Diagnóstico:**
```
[BANDS][INVENTORY] 📍 presence: { hasValue: true, hasTarget: false, will_analyze: false }
```

**Causa:** `consolidatedData.genreTargets.bands.presence` está ausente

**Solução:** Verificar se genreTarget foi carregado corretamente do JSON

---

### Problema: rawDelta é 0 mas banda está CRÍTICA na tabela

**Diagnóstico:**
```
[DEBUG_GATE][BAND_PRESENCE] 🔬 Análise:
  measured: -35.50
  bounds: { min: -40.00, max: -30.00 }  ← Range errado!
  rawDelta: 0.0000  ← Calculado errado
```

**Causa:** `bounds` está incorreto (muito largo, engloba valor medido)

**Solução:** 
1. Verificar log `[RANGE_BOUNDS]` para ver qual método foi usado
2. Se `source: 'calculado_legacy'`, o `target_range` não foi encontrado
3. Verificar estrutura do JSON: deve ter `target_range: { min: X, max: Y }`

---

### Problema: Range da sugestão difere do range da tabela

**Diagnóstico:**
```
[RANGE_BOUNDS] ⚠️ FALLBACK LEGADO: Calculando com target ± tolerance
[RANGE_BOUNDS] Cálculo: { target: -28.5, tolerance: 3.0, min: -31.5, max: -25.5, source: 'calculado_legacy' }
```

**Causa:** `getRangeBounds` não encontrou `target_range` e calculou artificialmente

**Solução:**
1. Verificar se genreTarget tem `target_range` com `min` e `max` (ou `min_db` e `max_db`)
2. Se não, atualizar JSON para incluir ranges explícitos

---

## 📁 ARQUIVOS ALTERADOS

### `work/lib/audio/features/problems-suggestions-v2.js`

**Função:** `getRangeBounds()`  
**Linha:** ~186-198  
**Mudança:** Suporte a `min_db/max_db` além de `min/max`

**Função:** `analyzeSpectralBands()`  
**Linha:** ~1010-1025  
**Mudança:** Log de inventário completo no início

**Função:** `analyzeSpectralBands()` (fim)  
**Linha:** ~1077-1089  
**Mudança:** Log de resumo de sugestões geradas

**Função:** `analyzeBand()`  
**Linha:** ~1220-1245  
**Mudança:** Log de debug completo antes do gate + confirmação de passagem

---

## 🎯 PRÓXIMOS PASSOS

1. **Fazer upload de áudio** com pelo menos 1 banda fora do range
2. **Capturar logs** do console (filtrar por `[BANDS]` e `[DEBUG_GATE]`)
3. **Enviar logs** para análise se problema persistir
4. **Verificar consistência** de ranges entre tabela e modal

---

## 📊 EXPLICAÇÃO TÉCNICA

### Por que agora vai gerar sugestões para brilho/presença/low_mid/high_mid?

**Antes:**
- `getRangeBounds` podia não encontrar `target_range` corretamente
- Calculava ranges artificiais com `target ± tolerance`
- Ranges incorretos levavam a `rawDelta = 0` mesmo quando banda estava fora

**Depois:**
- `getRangeBounds` suporta `min/max` E `min_db/max_db`
- Logs mostram exatamente qual método foi usado
- Se range correto for carregado, `rawDelta` será calculado corretamente
- Gate permitirá passagem se `rawDelta !== 0`

### Por que o range do sub ficou idêntico à tabela?

**Antes:**
- Sugestão: `targetValue: "${bounds.min} a ${bounds.max}"`
- `bounds` vinha de `target ± tolerance` (FALLBACK)
- Tabela: usava `target_range.min` e `target_range.max` do JSON
- **Divergência:** Fontes diferentes!

**Depois:**
- Sugestão: `targetValue: "${bounds.min} a ${bounds.max}"`
- `bounds` vem de `target_range.min/max` (PRIORIDADE)
- Tabela: usa mesma fonte (`target_range`)
- **Consistência:** Mesma fonte!

---

**Status:** ✅ CORREÇÕES APLICADAS - AGUARDANDO LOGS PARA VALIDAÇÃO
