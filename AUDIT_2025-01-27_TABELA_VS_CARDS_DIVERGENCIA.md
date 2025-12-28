# 🔍 AUDITORIA TÉCNICA: Divergência TABELA vs CARDS de Sugestões

**Data:** 27 de Dezembro de 2025  
**Auditor:** Análise Automatizada  
**Status:** CONCLUÍDA (SEM CORREÇÕES - SOMENTE DIAGNÓSTICO)  
**Escopo:** Métricas principais (True Peak, LUFS, DR, LRA, Stereo)

---

## 📋 SEÇÃO 1: PIPELINE COMPLETO (Diagrama em Texto)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DE DADOS: TARGETS → RENDERIZAÇÃO                   │
└─────────────────────────────────────────────────────────────────────────────────┘

[1] FONTE DE TARGETS (JSON de Gênero)
    📁 work/refs/out/{genreId}.json
    │
    │  Formato JSON RAW:
    │  {
    │    "lufs_target": -7.2,
    │    "lufs_min": -9.5,
    │    "lufs_max": -3.1,
    │    "true_peak_target": -0.5,
    │    "true_peak_min": -3,
    │    "true_peak_max": 0,
    │    "dr_target": 6,
    │    ...
    │  }
    │
    ▼
[2] NORMALIZAÇÃO DE TARGETS
    📄 work/lib/audio/core/resolveTargets.js
    │
    │  Função: resolveTargets(genreId, mode, rawTargets)
    │  Converte formato JSON para estrutura normalizada:
    │  {
    │    lufs: { target, min, max },
    │    truePeak: { target, min, max, hardCap: 0.0 },
    │    dr: { target, min, max },
    │    ...
    │  }
    │
    ├──────────────────────────────┬────────────────────────────────────┐
    │                              │                                    │
    ▼                              ▼                                    ▼
[3a] MOTOR 1: TABELA          [3b] MOTOR 2: SUGESTÕES           [3c] AI ENRICHER
    📄 compareWithTargets.js       📄 problems-suggestions-v2.js      📄 suggestion-enricher.js
    │                              │                                    │
    │  Gera: comparisonResult      │  Gera: suggestions[]               │  Enriquece: suggestions[]
    │  {                           │  getMetricFromComparison()         │  mergeSuggestionsWithAI()
    │    rows: [{                  │     └─ Busca em comparisonResult   │     └─ PRESERVA currentValue,
    │      key, min, max,          │                                    │        targetRange, delta
    │      valueRaw, diff,         │  buildMetricSuggestion()           │        DO BASE
    │      severity, action        │     └─ Gera texto do card          │
    │    }]                        │                                    │
    │  }                           │                                    │
    │                              │                                    │
    ▼                              ▼                                    ▼
[4a] FRONTEND: TABELA         [4b] FRONTEND: CARDS              [4c] CARDS ENRIQUECIDOS
    renderGenreComparisonTable    renderSuggestionCards             renderAIEnrichedCard
    │                              │                                    │
    │  row.min, row.max           │  suggestion.targetValue            │  suggestion.problema
    │  row.targetText             │  suggestion.currentValue           │  suggestion.solucao
    │                              │                                    │
    └──────────────────────────────┴────────────────────────────────────┘
                                    │
                                    ▼
                            RENDERIZAÇÃO FINAL
```

---

## 📊 SEÇÃO 2: FONTES DE TARGETS (Tabela vs Sugestões) com Evidências

### 2.1 TABELA (MOTOR 1) - Fonte CORRETA

| Componente | Arquivo | Função | Linha(s) | Fonte de min/max |
|------------|---------|--------|----------|------------------|
| **Comparação** | `work/lib/audio/core/compareWithTargets.js` | `evaluateRangeMetric()` | 298-300 | `const { min, max, target } = target;` |
| **True Peak** | `work/lib/audio/core/compareWithTargets.js` | `evaluateTruePeak()` | 234-236 | `const { min, max } = target;` |
| **Output** | `work/lib/audio/core/compareWithTargets.js` | Row object | 365-375 | `min, max, targetText, valueRaw, diff, severity` |

**EVIDÊNCIA:** A tabela usa **DIRETAMENTE** `min` e `max` do objeto `targets` normalizado, que vem de `resolveTargets.js`, que converte do JSON de gênero.

```javascript
// compareWithTargets.js - Linha 298
const { min, max, target: targetValue } = target;

// Row gerada - Linha 365-375
const row = {
  key: metricKey,
  min,              // ✅ DIRETO do JSON normalizado
  max,              // ✅ DIRETO do JSON normalizado
  targetText: `${min.toFixed(1)} a ${max.toFixed(1)}${unit}`,
  ...
};
```

---

### 2.2 SUGESTÕES (MOTOR 2) - Fonte CORRIGIDA (mas com fallbacks)

| Componente | Arquivo | Função | Linha(s) | Fonte de min/max |
|------------|---------|--------|----------|------------------|
| **Extração SSOT** | `problems-suggestions-v2.js` | `getMetricFromComparison()` | 267-310 | Busca em `comparisonResult.rows[]` |
| **Análise LUFS** | `problems-suggestions-v2.js` | `analyzeLUFS()` | 591-592 | `this.getMetricFromComparison(comparisonResult, 'lufs')` |
| **Análise TP** | `problems-suggestions-v2.js` | `analyzeTruePeak()` | 671-672 | `this.getMetricFromComparison(comparisonResult, 'truePeak')` |
| **Análise DR** | `problems-suggestions-v2.js` | `analyzeDynamicRange()` | 771-772 | `this.getMetricFromComparison(comparisonResult, 'dr')` |
| **Análise Stereo** | `problems-suggestions-v2.js` | `analyzeStereoMetrics()` | 861-862 | `this.getMetricFromComparison(comparisonResult, 'stereo')` |
| **Text Builder** | `suggestion-text-builder.js` | `buildMetricSuggestion()` | 64-67 | Recebe `min, max` como parâmetros |

**EVIDÊNCIA - CÓDIGO ATUAL (PATH SSOT):**

```javascript
// problems-suggestions-v2.js - Linha 591-604
const comparisonData = this.getMetricFromComparison(consolidatedData.comparisonResult, 'lufs');

if (!comparisonData) {
  return; // ❌ PATH LEGACY REMOVIDO - não gera sugestão se comparisonResult ausente
}

// ✅ USAR DADOS DA TABELA (FONTE ÚNICA DE VERDADE)
const lufs = comparisonData.valueRaw;
const bounds = { min: comparisonData.min, max: comparisonData.max };  // ← SSOT
const diff = comparisonData.diff;
```

---

### 2.3 AI ENRICHER - Não Altera Valores Numéricos

| Componente | Arquivo | Função | Linha(s) | Comportamento |
|------------|---------|--------|----------|---------------|
| **Merge** | `suggestion-enricher.js` | `mergeSuggestionsWithAI()` | 1000-1006 | **PRESERVA** `currentValue, targetRange, targetMin, targetMax` do base |
| **Lock** | `suggestion-enricher.js` | Prompt rules | 700-750 | "NUMERIC LOCK - NUNCA retorne currentValue, targetRange, delta" |

**EVIDÊNCIA - NUMERIC LOCK:**

```javascript
// suggestion-enricher.js - Linha 1000-1006
const merged = {
  // 🔒 NUMERIC LOCK - Campos numéricos SEMPRE preservados do base
  currentValue: baseSug.currentValue,
  targetRange: baseSug.targetRange,
  targetMin: baseSug.targetMin,
  targetMax: baseSug.targetMax,
  deviationRatio: baseSug.deviationRatio,
  ...
};
```

---

## 🚨 SEÇÃO 3: PONTOS DE OVERWRITE/CONCORRÊNCIA

### 3.1 FALLBACK LEGADO em `getRangeBounds()` (AINDA EXISTE!)

**Arquivo:** `work/lib/audio/features/problems-suggestions-v2.js`  
**Linhas:** 160-250

**RISCO:** Embora o PATH LEGACY nas funções `analyze*()` tenha sido removido, a função `getRangeBounds()` ainda existe e pode ser chamada por código legado ou bandas:

```javascript
// Linha 217-248 - FALLBACK LEGADO AINDA EXISTE
// ⚠️ FALLBACK LEGADO: Calcular com target ± tolerance
if (typeof threshold.target !== 'number') {
  return { min: -100, max: 100 }; // Fallback extremo
}

const effectiveTolerance = threshold.tolerance || 0;
return {
  min: threshold.target - threshold.tolerance,  // ❌ CALCULADO, não do JSON
  max: threshold.target + threshold.tolerance   // ❌ CALCULADO, não do JSON
};
```

**IMPACTO:** Se algum código chamar `getRangeBounds()` com threshold sem `min/max` explícitos, usará `target ± tolerance` que **NÃO bate com os valores do JSON**.

---

### 3.2 SAFE_DEFAULTS em `resolveTargets.js`

**Arquivo:** `work/lib/audio/core/resolveTargets.js`  
**Linhas:** 36-43

```javascript
const SAFE_DEFAULTS = {
  truePeak: { target: -1.0, min: -3.0, max: 0.0, warnFrom: -0.5 },
  lufs: { target: -14.0, min: -15.0, max: -13.0 },
  dr: { target: 8.0, min: 6.0, max: 12.0 },
  ...
};
```

**RISCO:** Se o JSON de gênero não tiver uma métrica, usa SAFE_DEFAULTS que podem ser **diferentes** dos valores esperados para aquele gênero.

---

### 3.3 suggestion-text-builder.js - Fallback Residual

**Arquivo:** `work/lib/audio/utils/suggestion-text-builder.js`  
**Linhas:** 64-67

```javascript
// 🎯 SSOT: min/max são OBRIGATÓRIOS - vêm de comparisonResult.rows
// ❌ PATH LEGACY REMOVIDO - Se min/max não estiverem definidos, usar valores safe defaults
const rangeMin = (typeof min === 'number') ? min : (target - (tolerance || 2));
const rangeMax = (typeof max === 'number') ? max : (target + (tolerance || 2));
```

**RISCO:** Se `min/max` não forem passados como números, **AINDA RECALCULA** usando `target ± tolerance`.

---

### 3.4 AI Enricher Prompt - Cálculo de Range LEGACY

**Arquivo:** `work/lib/ai/suggestion-enricher.js`  
**Linhas:** 510-526

```javascript
// TRUE PEAK
if (targets.truePeak) {
  if (typeof targets.truePeak.min === 'number' && typeof targets.truePeak.max === 'number') {
    prompt += `- **True Peak**: Range oficial ${targets.truePeak.min.toFixed(1)} a ${targets.truePeak.max.toFixed(1)} dBTP`;
  } else if (targets.truePeak.target !== undefined) {
    const tol = targets.truePeak.tolerance || 0.3;
    prompt += `- **True Peak**: ... (range: ${(targets.truePeak.target - tol).toFixed(1)} a ${(targets.truePeak.target + tol).toFixed(1)}) [LEGACY]\n`;
    //                                        ❌ CALCULADO                          ❌ CALCULADO
  }
}
```

**RISCO:** Se o contexto passado para o AI Enricher não tiver `min/max` explícitos, o prompt enviado para a IA terá ranges **CALCULADOS de target±tolerance**, e a IA pode gerar texto com esses valores errados.

---

## 🎯 SEÇÃO 4: CONCLUSÃO (Causa Raiz) + Especificação SSOT

### 4.1 CAUSA RAIZ IDENTIFICADA

**O sistema agora funciona corretamente QUANDO:**
- `comparisonResult` está presente e completo
- `comparisonResult.rows[]` tem a métrica com `min, max` como números válidos

**DIVERGÊNCIA AINDA OCORRE QUANDO:**

| Cenário | Onde Ocorre | Resultado |
|---------|-------------|-----------|
| `comparisonResult` é `null` | `getMetricFromComparison()` retorna `null` | Sugestão **não é gerada** (fail-safe) |
| `min/max` ausente em row | `buildMetricSuggestion()` linha 64-67 | Recalcula `target ± tolerance` |
| customTargets sem `min/max` | AI Enricher prompt | Envia range calculado para IA |
| JSON de gênero incompleto | `resolveTargets.js` SAFE_DEFAULTS | Usa valores genéricos |

---

### 4.2 EVIDÊNCIA DE VALORES NO JSON REAL

**Exemplo: `funk_mandela.json`**

```json
{
  "true_peak_target": -0.5,
  "true_peak_min": -3,        // ✅ EXPLÍCITO
  "true_peak_max": 0,         // ✅ EXPLÍCITO
  
  "lufs_target": -7.2,
  "lufs_min": -9.5,           // ✅ EXPLÍCITO
  "lufs_max": -3.1,           // ✅ EXPLÍCITO
  
  "dr_target": 6,
  "dr_min": 3.6,              // ✅ EXPLÍCITO
  "dr_max": 11.7,             // ✅ EXPLÍCITO
}
```

**CONCLUSÃO:** O JSON **TEM** `min/max` explícitos, então a divergência NÃO deveria ocorrer se o pipeline estiver correto.

---

### 4.3 ESPECIFICAÇÃO SSOT (Single Source of Truth)

#### Arquitetura Recomendada

```
┌─────────────────────────────────────────────────────────────────┐
│              FONTE ÚNICA DE VERDADE (SSOT)                      │
│                                                                 │
│   compareWithTargets.js  →  comparisonResult.rows[]             │
│                                                                 │
│   Cada row contém:                                              │
│   { key, min, max, target, valueRaw, diff, severity, action }   │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   [TABELA]              [CARDS]              [AI ENRICHER]
   row.min              row.min              row.min
   row.max              row.max              row.max
   row.targetText       row.targetText       row.targetText
        │                     │                     │
        └─────────────────────┴─────────────────────┘
                              │
                              ▼
                    ✅ VALORES IDÊNTICOS
```

#### Regras Obrigatórias

1. **compareWithTargets.js é a ÚNICA fonte de min/max/target/diff/severity**
   - Nunca calcular `target ± tolerance` em nenhum outro lugar
   - Sempre usar valores do JSON via `resolveTargets.js`

2. **problems-suggestions-v2.js DEVE consumir APENAS `comparisonResult.rows[]`**
   - ✅ Já implementado via `getMetricFromComparison()`
   - ⚠️ `getRangeBounds()` deve ser removido ou marcado como DEPRECATED

3. **suggestion-text-builder.js NÃO deve ter fallback de cálculo**
   - ⚠️ Linha 64-67 ainda tem fallback
   - Deve lançar erro se `min/max` não forem números

4. **AI Enricher deve receber `min/max` explícitos no contexto**
   - ⚠️ Prompt ainda calcula `target ± tolerance` como fallback
   - Deve exigir `customTargets` com `min/max` obrigatórios

5. **JSONs de gênero DEVEM ter `min/max` explícitos para todas as métricas**
   - ✅ `funk_mandela.json` já tem
   - Validar todos os JSONs em `work/refs/out/`

---

## 📁 SEÇÃO 5: LISTA DE ARQUIVOS CANDIDATOS PARA CORREÇÃO

### Prioridade CRÍTICA

| Arquivo | Ação Necessária |
|---------|-----------------|
| `work/lib/audio/features/problems-suggestions-v2.js` | Remover `getRangeBounds()` ou transformar em erro se `min/max` ausentes |
| `work/lib/audio/utils/suggestion-text-builder.js` | Remover fallback linha 64-67, lançar erro se `min/max` inválidos |
| `work/lib/ai/suggestion-enricher.js` | Remover cálculo `target ± tolerance` no prompt (linhas 510-550) |

### Prioridade ALTA

| Arquivo | Ação Necessária |
|---------|-----------------|
| `work/lib/audio/core/resolveTargets.js` | Logar ERRO (não warning) quando SAFE_DEFAULTS usado |
| `work/refs/out/*.json` | Validar que TODOS têm `min/max` para LUFS/TP/DR/LRA/Stereo |

### Prioridade MÉDIA

| Arquivo | Ação Necessária |
|---------|-----------------|
| `public/ai-suggestion-ui-controller.js` | Verificar se usa `targetRange` corretamente dos dados do backend |
| `work/worker.js` / `work/worker-redis.js` | Garantir que `comparisonResult` é passado para `analyzeProblemsAndSuggestionsV2()` |

---

## 📊 SUMÁRIO EXECUTIVO

### O que foi corrigido (ROOT FIX anterior)

- ✅ PATH LEGACY removido de `analyzeLUFS()`, `analyzeTruePeak()`, `analyzeDynamicRange()`, `analyzeStereoMetrics()`
- ✅ Funções agora retornam sem gerar sugestão se `comparisonResult` ausente (fail-safe)
- ✅ `getMetricFromComparison()` extrai dados da TABELA para os CARDS

### O que AINDA pode causar divergência

1. **`getRangeBounds()` ainda existe** e calcula `target ± tolerance`
2. **`buildMetricSuggestion()` tem fallback** que recalcula se `min/max` inválidos
3. **AI Enricher prompt** ainda calcula ranges como fallback
4. **SAFE_DEFAULTS** podem ser usados se JSON incompleto

### Recomendação Final

**Para GARANTIR SSOT 100%:**
1. Transformar todos os fallbacks em ERROS CRÍTICOS
2. Validar JSONs de gênero na inicialização
3. Remover qualquer código que calcule `target ± tolerance`
4. Passar `comparisonResult.rows[]` diretamente para o frontend como fonte única

---

**FIM DA AUDITORIA**  
*Documento gerado automaticamente em: 27/12/2025*
