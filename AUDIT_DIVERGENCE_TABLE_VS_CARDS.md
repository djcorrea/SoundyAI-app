# 🔍 AUDITORIA FORENSE: Divergência entre Tabela e Sugestões

**Data:** 2025-01-19  
**Objetivo:** Identificar por que os textos/valores das SUGESTÕES (cards) não usam os mesmos targets/valores da TABELA de comparação  
**Escopo:** Métricas principais (True Peak, LUFS, DR, LRA, Stereo) - Bandas funcionam corretamente  
**Modo:** SOMENTE AUDITORIA - SEM CORREÇÕES

---

## 📋 SEÇÃO 1: Mapeamento Completo do Pipeline

### 1.1 Fluxo de Execução (Ordem Cronológica)

```
┌─────────────────────────────────────────────────────────────────┐
│  FASE 1: CARREGAMENTO DE TARGETS                                │
└─────────────────────────────────────────────────────────────────┘
   ▼
[1] genre-targets-loader.js
    • loadGenreTargets() ou loadGenreTargetsFromWorker()
    • Carrega JSON de: public/refs/out/{genreId}.json
    • Fallback hardcoded: GENRE_THRESHOLDS (se JSON falha)
    • Saída: rawTargets (formato JSON raw)
   ▼
[2] resolveTargets.js
    • resolveTargets(genreId, mode, rawTargets)
    • Normaliza targets de múltiplos formatos
    • Aplica SAFE_DEFAULTS se ausente (com warning)
    • Aplica TRUE_PEAK_HARD_CAP = 0.0 (regra física)
    • Saída: targets{ _resolved:true, truePeak:{min,max,target}, lufs:{}, ... }

┌─────────────────────────────────────────────────────────────────┐
│  FASE 2: ANÁLISE DE ÁUDIO                                       │
└─────────────────────────────────────────────────────────────────┘
   ▼
[3] pipeline-complete.js (orchestrator)
    • decodeAudioFile() → segmentAudioTemporal() → calculateCoreMetrics()
    • Saída: metrics{ lufs, truePeak, dr, lra, stereo, bands:{...} }

┌─────────────────────────────────────────────────────────────────┐
│  FASE 3: MOTOR 1 - GERAÇÃO DA TABELA (FONTE ÚNICA DE VERDADE)   │
└─────────────────────────────────────────────────────────────────┘
   ▼
[4] compareWithTargets.js
    • compareWithTargets(metrics, targets)
    • Avalia cada métrica: evaluateRangeMetric(), evaluateTruePeak()
    • Compara valor medido vs [min, max] dos targets
    • Determina severity: OK | ATENÇÃO | ALTA | CRÍTICA
    • Saída: comparisonResult {
        rows: [ { key, label, value, valueRaw, min, max, target, diff, severity, action }, ... ],
        issues: [ { metric, severity, problemText, numbers }, ... ],
        score: 85.7
      }

┌─────────────────────────────────────────────────────────────────┐
│  FASE 4: MOTOR 2 - GERAÇÃO DE SUGESTÕES (TEXTO DOS CARDS)       │
└─────────────────────────────────────────────────────────────────┘
   ▼
[5] problems-suggestions-v2.js
    • analyzeProblemsAndSuggestionsV2(finalJSON, metadata)
    • finalJSON contém: metrics, targets, comparisonResult
    • Para cada métrica:
      - 🎯 NOVO PATH (ROOT FIX): getMetricFromComparison(comparisonResult, 'lufs')
        → Extrai { valueRaw, min, max, diff, severity } da TABELA
        → Passa para buildMetricSuggestion()
      
      - 🔄 FALLBACK LEGACY: Se comparisonResult ausente/incompleto
        → getMetricTarget('lufs', null, consolidatedData)
        → getRangeBounds(threshold) → calcula range de target±tolerance
        → calculateSeverity()
        → Passa para buildMetricSuggestion()
    
    • Saída: suggestions[ { metric, severity, message, currentValue, targetValue, delta }, ... ]
   ▼
[6] suggestion-text-builder.js
    • buildMetricSuggestion({ key, value, target, tolerance, min, max })
    • **PONTO CRÍTICO**: Aceita min/max REAIS ou calcula fallback
      ```javascript
      const rangeMin = (min !== undefined && min !== null) ? min : (target - tolerance);
      const rangeMax = (max !== undefined && max !== null) ? max : (target + tolerance);
      ```
    • Console log identifica fonte: 'target_range (REAL)' ou 'calculated (FALLBACK)'
    • Saída: { message, explanation, action } (texto legível para cards)

┌─────────────────────────────────────────────────────────────────┐
│  FASE 5: ENRIQUECIMENTO IA (OPCIONAL)                           │
└─────────────────────────────────────────────────────────────────┘
   ▼
[7] suggestion-enricher.js (worker.js ou worker-redis.js)
    • enrichSuggestionsWithAI(suggestions, metadata)
    • **NÃO MODIFICA VALORES NUMÉRICOS**
    • Adiciona: educationalContent, dawExamples, expectedResult
    • Saída: enrichedSuggestions (com aiEnhanced: true)

┌─────────────────────────────────────────────────────────────────┐
│  FASE 6: RENDERIZAÇÃO FRONTEND                                  │
└─────────────────────────────────────────────────────────────────┘
   ▼
[8a] TABELA: renderGenreComparisonTable() (audio-analyzer-integration.js)
     • Recebe comparisonResult.rows do backend
     • Renderiza cada row: label, value, targetText (min-max), severity, action
     • **USA DIRETAMENTE OS VALORES DE compareWithTargets.js**

[8b] CARDS: renderSuggestionItem() (audio-analyzer-integration.js)
     • Recebe analysis.suggestions do backend
     • Renderiza message, explanation, action de buildMetricSuggestion()
     • **USA TEXTO GERADO EM problems-suggestions-v2.js + suggestion-text-builder.js**
```

---

## 🔬 SEÇÃO 2: Fontes de Targets/Ranges por Componente

### 2.1 TABELA (Motor 1) - `compareWithTargets.js`

**Arquivo:** `work/lib/audio/core/compareWithTargets.js`  
**Função:** `evaluateRangeMetric(value, target, metricKey)`  
**Linhas:** 289-366

**Fonte dos dados:**
```javascript
const { min, max, target: targetValue } = target;  // Line ~300

// target vem de resolveTargets.js:
// targets.lufs = { target: -14.0, min: -15.0, max: -13.0 }
// targets.truePeak = { target: -1.0, min: -3.0, max: 0.0, hardCap: 0.0 }
```

**Output para TABELA:**
```javascript
row = {
  key: 'lufs',
  label: 'LUFS (Loudness)',
  value: '-16.2 LUFS',        // ✅ Valor medido
  valueRaw: -16.2,
  targetText: '-15.0 a -13.0 LUFS',  // ✅ Range do JSON
  target: -14.0,              // ✅ Target do JSON
  min: -15.0,                 // ✅ min do JSON
  max: -13.0,                 // ✅ max do JSON
  diff: -2.2,
  severity: 'ALTA',
  action: '🟡 Aumentar 1.2 LUFS'
}
```

**CONCLUSÃO:** Tabela usa **DIRETAMENTE** min/max/target dos JSONs carregados e normalizados.

---

### 2.2 SUGESTÕES (Motor 2) - `problems-suggestions-v2.js`

**Arquivo:** `work/lib/audio/features/problems-suggestions-v2.js`  
**Funções:** `analyzeLUFS()`, `analyzeTruePeak()`, `analyzeDynamicRange()`, `analyzeStereoMetrics()`

#### 2.2.1 Caminho NOVO (ROOT FIX) - Linhas 593-694

```javascript
// 🎯 UNIFICAÇÃO TABELA-CARDS: Tentar usar comparisonResult primeiro
const comparisonData = this.getMetricFromComparison(consolidatedData.comparisonResult, 'lufs');

if (comparisonData) {
  // ✅ USAR DADOS DA TABELA (FONTE ÚNICA DE VERDADE)
  lufs = comparisonData.valueRaw;      // -16.2
  bounds = { 
    min: comparisonData.min,           // -15.0 (do JSON)
    max: comparisonData.max            // -13.0 (do JSON)
  };
  diff = comparisonData.diff;          // -2.2
  severity = severityMap[comparisonData.severity];  // 'ALTA' → this.severity.WARNING
  
  // Passar para buildMetricSuggestion com min/max REAIS
  const textSuggestion = buildMetricSuggestion({
    key: 'lufs',
    value: lufs,                       // -16.2
    target: bounds.min + (bounds.max - bounds.min) / 2,  // -14.0 (calculado)
    tolerance: (bounds.max - bounds.min) / 2,           // 1.0
    min: bounds.min,                   // ✅ -15.0 (REAL do JSON)
    max: bounds.max                    // ✅ -13.0 (REAL do JSON)
  });
}
```

**Status:** ✅ Se comparisonResult disponível, usa valores IDÊNTICOS à tabela.

#### 2.2.2 Caminho LEGACY (FALLBACK) - Linhas 618-650

```javascript
} else {
  // 🔄 FALLBACK LEGACY: Usar lógica antiga se comparisonResult não disponível
  const targetInfo = this.getMetricTarget('lufs', null, consolidatedData);
  // targetInfo vem de:
  // - consolidatedData.genreTargets.lufs
  // - Normalizado por getMetricTarget() que usa thresholds locais
  
  lufs = metric.value;                 // -16.2
  const lufsTarget = targetInfo.target;      // -14.0
  const tolerance = targetInfo.tolerance;    // 2.0 (PADRÃO GENÉRICO!)
  
  const lufsThreshold = { 
    target: lufsTarget, 
    tolerance,
    min: targetInfo.min,               // ⚠️ PODE SER UNDEFINED
    max: targetInfo.max                // ⚠️ PODE SER UNDEFINED
  };
  
  bounds = this.getRangeBounds(lufsThreshold);  // CALCULA range se min/max ausente
  
  // getRangeBounds (linha ~1707):
  if (threshold.min !== undefined && threshold.max !== undefined) {
    return { min: threshold.min, max: threshold.max };  // ✅ USA REAIS
  } else {
    // ❌ FALLBACK: Calcula range como target ± tolerance
    return { 
      min: threshold.target - threshold.tolerance,  // -14.0 - 2.0 = -16.0
      max: threshold.target + threshold.tolerance   // -14.0 + 2.0 = -12.0
    };
  }
  
  // Passa para buildMetricSuggestion com valores CALCULADOS
  const textSuggestion = buildMetricSuggestion({
    key: 'lufs',
    value: lufs,
    target: lufsTarget,                // -14.0
    tolerance: tolerance,              // 2.0
    min: bounds.min,                   // ⚠️ -16.0 (CALCULADO, não do JSON!)
    max: bounds.max                    // ⚠️ -12.0 (CALCULADO, não do JSON!)
  });
}
```

**Status:** ⚠️ Se comparisonResult ausente/incompleto, usa getRangeBounds() que PODE calcular range de target±tolerance ao invés de usar min/max do JSON.

---

### 2.3 BUILDER DE TEXTO - `suggestion-text-builder.js`

**Arquivo:** `work/lib/audio/utils/suggestion-text-builder.js`  
**Função:** `buildMetricSuggestion({ key, value, target, tolerance, min, max })`  
**Linhas:** 60-72

```javascript
// ✅ USAR min/max REAIS se fornecidos, caso contrário calcular como fallback
const rangeMin = (min !== undefined && min !== null) ? min : (target - tolerance);
const rangeMax = (max !== undefined && max !== null) ? max : (target + tolerance);

console.log(`[BUILD-METRIC] 🔍 Range para ${key}:`, {
  receivedMin: min,
  receivedMax: max,
  calculatedMin: target - tolerance,
  calculatedMax: target + tolerance,
  usedMin: rangeMin,
  usedMax: rangeMax,
  source: (min !== undefined && max !== undefined) ? 'target_range (REAL)' : 'calculated (FALLBACK)'
});

// Texto gerado:
message = `${icon} ${label}\n`;
message += `• Seu valor: ${valueStr} ${unit}\n`;
message += `• Faixa ideal para este estilo: ${minStr} a ${maxStr} ${unit}\n`;  // ⚠️ USA rangeMin/rangeMax
message += `• Alvo recomendado: ${targetStr} ${unit}`;
```

**Status:** 🔄 Aceita min/max fornecidos, MAS se undefined/null, recalcula de target±tolerance (fallback duplo).

---

### 2.4 DEFAULTS E FALLBACKS - Múltiplas Camadas

#### Camada 1: `resolveTargets.js` (SAFE_DEFAULTS)
```javascript
const SAFE_DEFAULTS = {
  truePeak: { target: -1.0, min: -3.0, max: 0.0 },
  lufs: { target: -14.0, min: -15.0, max: -13.0 },
  dr: { target: 8.0, min: 6.0, max: 12.0 },
  lra: { target: 7.0, min: 5.0, max: 10.0 },
  stereo: { target: 0.7, min: 0.3, max: 0.95 }
};
// ✅ Usado APENAS se JSON não tem target para métrica
// ✅ Gera WARNING no console
```

#### Camada 2: `genre-targets-loader.js` (GENRE_THRESHOLDS)
```javascript
const GENRE_THRESHOLDS = {
  default: {
    lufs: { target: -14, tolerance: 2, critical: 3 },
    truePeak: { target: -1, tolerance: 1.5, critical: 0 },
    dr: { target: 8, tolerance: 2, critical: 4 },
    // ... (formato ANTIGO sem min/max explícito)
  },
  funk_mandela: { ... },
  trance: { ... }
};
// ⚠️ Usado se loadGenreTargetsFromWorker() falha
// ⚠️ Não tem min/max, só target + tolerance
```

#### Camada 3: `problems-suggestions-v2.js` (getRangeBounds)
```javascript
getRangeBounds(threshold) {
  if (threshold.min !== undefined && threshold.max !== undefined) {
    return { min: threshold.min, max: threshold.max };
  } else {
    // ❌ CALCULA range de target ± tolerance
    return { 
      min: threshold.target - threshold.tolerance,
      max: threshold.target + threshold.tolerance 
    };
  }
}
```

#### Camada 4: `suggestion-text-builder.js` (recálculo inline)
```javascript
const rangeMin = (min !== undefined && min !== null) ? min : (target - tolerance);
const rangeMax = (max !== undefined && max !== null) ? max : (target + tolerance);
```

---

## 🚨 SEÇÃO 3: Pontos de Divergência (ROOT CAUSE)

### 3.1 Divergência Principal: Ativação do Path Legacy

**CENÁRIO ATUAL (ROOT FIX implementado):**

```javascript
// Em problems-suggestions-v2.js, linha 1830:
comparisonResult: finalJSON?.comparisonResult || null
```

✅ ROOT FIX passou comparisonResult de Motor 1 para Motor 2  
✅ Código consome comparisonResult via getMetricFromComparison()

**PORÉM:**

```javascript
// Linha 268-271:
getMetricFromComparison(comparisonResult, metricKey) {
  if (!comparisonResult || !comparisonResult.rows) {
    return null;  // ⚠️ ATIVA FALLBACK LEGACY
  }
  // ...
}
```

**GATILHOS PARA FALLBACK LEGACY:**

1. **comparisonResult é `null` ou `undefined`**
   - Causa: Erro em compareWithTargets()
   - Causa: finalJSON não tem comparisonResult

2. **comparisonResult.rows é `null` ou `undefined`**
   - Causa: compareWithTargets() retornou objeto incompleto
   - Causa: rows foi consumido/deletado em processamento anterior

3. **Métrica não encontrada em rows[]**
   ```javascript
   const row = comparisonResult.rows.find(r => r.key === normalizedKey);
   if (!row) {
     return null;  // ⚠️ ATIVA FALLBACK LEGACY para esta métrica
   }
   ```
   - Causa: Key mismatch (ex: 'truePeak' no JSON vs 'true_peak' em rows)
   - Causa: Métrica não avaliada em compareWithTargets (sem target no JSON)

4. **min ou max ausente em row**
   ```javascript
   if (typeof row.min !== 'number' || typeof row.max !== 'number') {
     return null;  // ⚠️ ATIVA FALLBACK LEGACY
   }
   ```

---

### 3.2 Divergência Secundária: Fallback no Text Builder

**MESMO QUANDO comparisonResult está presente**, se `getRangeBounds()` ou código legacy não passou min/max:

```javascript
// problems-suggestions-v2.js - Path Legacy
const targetInfo = this.getMetricTarget('lufs', null, consolidatedData);
// targetInfo pode ter: { target, tolerance, critical }
// MAS NÃO TER: { min, max }

const lufsThreshold = { 
  target: lufsTarget, 
  tolerance,
  min: targetInfo.min,  // ⚠️ undefined
  max: targetInfo.max   // ⚠️ undefined
};

bounds = this.getRangeBounds(lufsThreshold);
// Se min/max undefined, getRangeBounds CALCULA:
// bounds = { min: -16.0, max: -12.0 }  // target ± tolerance

// Passa para builder:
buildMetricSuggestion({
  min: bounds.min,   // -16.0 (CALCULADO)
  max: bounds.max    // -12.0 (CALCULADO)
});
```

**E então em suggestion-text-builder.js:**
```javascript
// Recebe min: -16.0, max: -12.0
const rangeMin = (min !== undefined && min !== null) ? min : (target - tolerance);
// rangeMin = -16.0 (aceita o valor CALCULADO, não REAL)

message += `• Faixa ideal para este estilo: ${minStr} a ${maxStr} ${unit}\n`;
// "Faixa ideal para este estilo: -16.0 a -12.0 LUFS"
```

**ENQUANTO A TABELA MOSTRA:**
```javascript
targetText: '-15.0 a -13.0 LUFS'  // ✅ Do JSON real
```

---

### 3.3 Divergência Terciária: Streaming Mode Override

**Arquivo:** `problems-suggestions-v2.js`  
**Linhas:** 1793-1813

```javascript
// 🎚️ OVERRIDE STREAMING: Se modo for 'streaming', forçar LUFS=-14 e TP=-1
if (analysisMode === 'streaming') {
  if (effectiveTargets.lufs) {
    effectiveTargets.lufs.target = -14.0;
    effectiveTargets.lufs.min = -15.0;
    effectiveTargets.lufs.max = -13.0;
  }
  if (effectiveTargets.truePeak) {
    effectiveTargets.truePeak.target = -1.0;
    effectiveTargets.truePeak.min = -3.0;
    effectiveTargets.truePeak.max = 0.0;
  }
}
```

⚠️ Este override acontece ANTES de consolidatedData ser criado  
⚠️ Se comparisonResult foi gerado com targets ORIGINAIS, mas consolidatedData tem targets OVERRIDED, há divergência

---

## 🎯 SEÇÃO 4: Conclusão e Especificação SSOT

### 4.1 Root Cause Summary

**Causa 1 (Principal):** Path Legacy ativo quando comparisonResult ausente/incompleto/malformado  
**Causa 2 (Secundária):** getRangeBounds() e text-builder recalculam ranges de target±tolerance quando min/max undefined  
**Causa 3 (Terciária):** Streaming override pode criar targets diferentes entre compareWithTargets e problems-suggestions-v2  
**Causa 4 (Estrutural):** Múltiplas camadas de fallback silencioso sem log crítico

### 4.2 Evidências de Ativação do Path Legacy

**Logs esperados se path NOVO funcionando:**
```
[LUFS] ✅ Usando comparisonResult para extração de bounds
[BUILD-METRIC] 🔍 Range para lufs: { ..., source: 'target_range (REAL)' }
```

**Logs indicando path LEGACY:**
```
[LUFS] ❌ consolidatedData.genreTargets.lufs ausente - pulando sugestão
[BUILD-METRIC] 🔍 Range para lufs: { ..., source: 'calculated (FALLBACK)' }
```

### 4.3 Especificação SSOT (Single Source of Truth)

#### Princípio Arquitetural

```
┌────────────────────────────────────────────────────┐
│  SINGLE SOURCE OF TRUTH: comparisonResult.rows[]   │
│  Gerado por: compareWithTargets.js (Motor 1)       │
└────────────────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
    [TABELA]                        [CARDS]
renderGenreComparisonTable    renderSuggestionItem
  └─ row.min, row.max          └─ sug.message
     row.targetText               (gerado de min/max)
```

#### Regras Obrigatórias

1. **compareWithTargets.js é a ÚNICA fonte de truth para valores numéricos**
   - min, max, target, diff, severity
   - Sempre usa targets resolvidos de JSONs (via resolveTargets.js)
   - Nunca calcula ranges - usa diretamente { min, max } de targets

2. **problems-suggestions-v2.js DEVE SEMPRE consumir comparisonResult**
   - Path NOVO é obrigatório
   - Path LEGACY deve ser REMOVIDO ou tornar-se erro crítico
   - Nunca recalcular bounds/ranges - extrair de row.min/row.max

3. **suggestion-text-builder.js NUNCA deve recalcular ranges**
   - min/max devem ser obrigatórios (não opcionais)
   - Se undefined, retornar erro, não calcular fallback

4. **resolveTargets.js é a ÚNICA fonte de targets normalizados**
   - Usado por compareWithTargets.js
   - Se JSON não tem min/max, usar SAFE_DEFAULTS COM WARNING EXPLÍCITO
   - Nunca usar target±tolerance silenciosamente

5. **Streaming overrides devem ser aplicados ANTES de compareWithTargets()**
   - Modificar targets ANTES de passar para Motor 1
   - Nunca override após comparisonResult gerado

---

## 📁 SEÇÃO 5: Arquivos Candidatos para Correção

### Prioridade CRÍTICA (eliminar path legacy)

1. **`work/lib/audio/features/problems-suggestions-v2.js`**
   - **Linhas:** 618-650 (analyzeLUFS legacy), 748-795 (analyzeTruePeak legacy), 888-935 (analyzeDR legacy), 1015-1055 (analyzeStereo legacy)
   - **Ação:** Transformar fallback legacy em erro crítico + log de diagnóstico
   - **Comentários existentes:** `// 🔄 FALLBACK LEGACY: Usar lógica antiga se comparisonResult não disponível`

2. **`work/lib/audio/utils/suggestion-text-builder.js`**
   - **Linhas:** 60-72
   - **Ação:** Tornar min/max obrigatórios, remover cálculo de fallback
   - **Validação:** `if (min === undefined || max === undefined) throw new Error(...)`

### Prioridade ALTA (diagnóstico e validação)

3. **`work/lib/audio/features/problems-suggestions-v2.js`**
   - **Linha:** 268 (getMetricFromComparison)
   - **Ação:** Adicionar log crítico quando retorna null
   - **Log:** `console.error('[CRÍTICO] comparisonResult ausente para ${metricKey} - AUDITORIA NECESSÁRIA')`

4. **`work/lib/audio/core/resolveTargets.js`**
   - **Linha:** 39 (SAFE_DEFAULTS)
   - **Ação:** Log CRÍTICO (não warning) quando SAFE_DEFAULTS usado
   - **Ação:** Validar que JSON sempre tenha min/max explícitos

5. **`work/api/audio/pipeline-complete.js`**
   - **Linhas:** 1793-1813 (streaming override)
   - **Ação:** Mover override para ANTES de chamar compareWithTargets
   - **Garantir:** targets passados para compareWithTargets já têm override aplicado

### Prioridade MÉDIA (cleanup e documentação)

6. **`work/lib/audio/features/problems-suggestions-v2.js`**
   - **Linha:** 1707 (getRangeBounds)
   - **Ação:** Marcar como DEPRECATED, nunca deve ser usado no novo sistema
   - **Ou:** Transformar em erro crítico se min/max undefined

7. **`work/lib/audio/utils/genre-targets-loader.js`**
   - **GENRE_THRESHOLDS hardcoded**
   - **Ação:** Adicionar log CRÍTICO se usado (indica falha no carregamento de JSON)

---

## 🔍 SEÇÃO 6: Validação e Checklist de Diagnóstico

### Quando USER reportar divergência, verificar:

**Checklist de Auditoria:**

- [ ] Verificar console logs: `[BUILD-METRIC] ... source: 'target_range (REAL)'` ou `'calculated (FALLBACK)'`
- [ ] Verificar se comparisonResult tem rows[] no payload JSON
- [ ] Verificar se rows[].min e rows[].max são números válidos
- [ ] Verificar se key de métrica em rows[] bate com esperado ('lufs', 'truePeak', 'dr', 'lra', 'stereo')
- [ ] Verificar se modo é 'streaming' e se override foi aplicado
- [ ] Verificar se JSON de gênero tem min/max explícitos para todas as métricas
- [ ] Verificar se SAFE_DEFAULTS foi usado (log de warning)
- [ ] Verificar se GENRE_THRESHOLDS foi usado (log de fallback)
- [ ] Verificar se path LEGACY foi ativado (comentários `// 🔄 FALLBACK LEGACY`)
- [ ] Comparar valores TABELA vs CARDS lado a lado

**Comando de Diagnóstico Rápido:**

```javascript
// No console do navegador:
console.table(analysis.comparisonResult?.rows);
console.table(analysis.suggestions.map(s => ({ 
  metric: s.metric, 
  targetValue: s.targetValue,
  message: s.message.split('\n')[2] // Linha de range
})));
```

---

## 📊 SEÇÃO 7: Exemplo de Divergência Concreta

### Cenário: LUFS mostra valores diferentes

**JSON carregado (funk_mandela.json):**
```json
{
  "lufs_target": -12.5,
  "lufs_min": -13.5,
  "lufs_max": -11.5
}
```

**TABELA (Motor 1 - compareWithTargets.js):**
```javascript
row = {
  label: 'LUFS (Loudness)',
  value: '-14.2 LUFS',
  targetText: '-13.5 a -11.5 LUFS',  // ✅ Do JSON
  min: -13.5,
  max: -11.5,
  target: -12.5,
  severity: 'ALTA'
}
```

**CARDS (Motor 2 - se path LEGACY ativo):**
```javascript
// getMetricTarget retorna:
{ target: -12.5, tolerance: 2.0, min: undefined, max: undefined }

// getRangeBounds calcula:
bounds = { min: -14.5, max: -10.5 }  // target ± tolerance

// buildMetricSuggestion gera:
message = `
🎚️ LUFS (Loudness)
• Seu valor: -14.2 LUFS
• Faixa ideal para este estilo: -14.5 a -10.5 LUFS  ❌ ERRADO
• Alvo recomendado: -12.5 LUFS
`
```

**ESPERADO (Motor 2 - se path NOVO funcionar):**
```javascript
// getMetricFromComparison retorna:
{ valueRaw: -14.2, min: -13.5, max: -11.5, target: -12.5, diff: -1.7, severity: 'ALTA' }

// buildMetricSuggestion recebe min/max REAIS:
message = `
🎚️ LUFS (Loudness)
• Seu valor: -14.2 LUFS
• Faixa ideal para este estilo: -13.5 a -11.5 LUFS  ✅ CORRETO
• Alvo recomendado: -12.5 LUFS
`
```

---

## 🎯 Conclusão Final

**CAUSA RAIZ CONFIRMADA:**

O path LEGACY (fallback) em `problems-suggestions-v2.js` está sendo ativado devido a:
1. comparisonResult ausente/malformado OU
2. min/max ausente em row OU
3. Key mismatch entre rows[] e getMetricFromComparison()

Quando ativado, usa `getRangeBounds()` que calcula range de `target ± tolerance` ao invés de usar min/max do JSON.

`suggestion-text-builder.js` aceita esses valores calculados e os exibe nos cards, criando divergência com a tabela.

**SOLUÇÃO ARQUITETURAL:**

Eliminar path LEGACY e tornar `comparisonResult` obrigatório. Se ausente, falhar com erro crítico + diagnóstico, não usar fallback silencioso.

---

**FIM DA AUDITORIA**  
Documento gerado em: 2025-01-19  
Próxima ação recomendada: Implementar correções nos arquivos de Prioridade CRÍTICA conforme SEÇÃO 5
