# 🔬 AUDITORIA FORENSE COMPLETA — DIVERGÊNCIA TABELA vs CARDS (TP/LUFS/DR/STEREO)

**Data:** 2025-01-XX  
**Autor:** Copilot (Auditoria Forense - APENAS LEITURA)  
**Status:** ✅ RELATÓRIO FINAL - NENHUMA CORREÇÃO APLICADA

---

## 📋 SUMÁRIO EXECUTIVO

### Problema Reportado
> "A tabela 'Comparação com <gênero>' mostra valores corretos, mas os cards 'Análise Inteligente & Sugestões' mostram números DIVERGENTES para métricas globais (True Peak dBTP, LUFS integrado, DR, correlação stereo)."

### Diagnóstico Root Cause
**EXISTEM DOIS MOTORES DE CÁLCULO PARALELOS** que operam de forma independente:

| Motor | Arquivo | Função | Output |
|-------|---------|--------|--------|
| **MOTOR 1** (Tabela) | `compareWithTargets.js` | `compareWithTargets()` | `comparisonResult.rows` → **TABELA** |
| **MOTOR 2** (Cards) | `problems-suggestions-v2.js` | `analyzeTruePeak()`, `analyzeLUFS()`, etc. | `suggestions[]` → **CARDS** |

### Evidência da Divergência
```
TABELA (Motor 1):
└── Lê de: metricsForComparison { lufsIntegrated, truePeakDbtp, dynamicRange, stereoCorrelation }
└── Targets: resolveTargets(genre, 'pista', genreTargets)
└── Cálculo: evaluateRangeMetric() / evaluateTruePeak()

CARDS (Motor 2):
└── Lê de: consolidatedData.metrics.{ loudness.value, truePeak.value, dr.value, stereo.value }
└── Targets: consolidatedData.genreTargets (normalizado separadamente)
└── Cálculo: getRangeBounds() + calculateSeverity()
```

---

## 🎯 ETAPA 1: INVENTÁRIO DE MÓDULOS

### 1.1 Módulos que Tocam as 4 Métricas Globais

| Arquivo | Função/Responsabilidade | Métricas | Impacto |
|---------|------------------------|----------|---------|
| [compareWithTargets.js](work/lib/audio/core/compareWithTargets.js) | Motor 1 - Comparação centralizada | LUFS, TP, DR, Stereo | TABELA + SCORE |
| [problems-suggestions-v2.js](work/lib/audio/features/problems-suggestions-v2.js) | Motor 2 - Sugestões educativas | LUFS, TP, DR, Stereo | CARDS |
| [resolveTargets.js](work/lib/audio/core/resolveTargets.js) | Resolução de targets | LUFS, TP, DR, Stereo | Ambos |
| [json-output.js](work/api/audio/json-output.js) | Geração do JSON final | Todas | Pipeline |
| [ai-suggestion-ui-controller.js](public/ai-suggestion-ui-controller.js) | Renderização frontend | Todas | UI |

### 1.2 Caminhos de Dados para Cada Métrica

#### TRUE PEAK
```
Motor 1 (Tabela):
  technicalData.truePeakDbtp → metricsForComparison.truePeakDbtp 
    → normalizeMetrics() linha 487: getValue(['truePeak.value', 'truePeakDbtp', 'true_peak_dbtp'])
    → evaluateTruePeak() linha 223

Motor 2 (Cards):
  consolidatedData.metrics.truePeak.value
    → analyzeTruePeak() linha 706
    → getRangeBounds() linha 175
```

#### LUFS
```
Motor 1 (Tabela):
  technicalData.lufsIntegrated → metricsForComparison.lufsIntegrated
    → normalizeMetrics() linha 487: getValue(['loudness.value', 'lufsIntegrated', 'lufs_integrated'])
    → evaluateRangeMetric() linha 297

Motor 2 (Cards):
  consolidatedData.metrics.loudness.value
    → analyzeLUFS() linha 533
    → getRangeBounds() linha 175
```

#### DYNAMIC RANGE (DR)
```
Motor 1 (Tabela):
  technicalData.dynamicRange → metricsForComparison.dynamicRange
    → normalizeMetrics() linha 487: getValue(['dr.value', 'dynamicRange', 'dynamic_range'])
    → evaluateRangeMetric() linha 297

Motor 2 (Cards):
  consolidatedData.metrics.dr.value
    → analyzeDynamicRange() linha 851
    → getRangeBounds() linha 175
```

#### STEREO CORRELATION
```
Motor 1 (Tabela):
  technicalData.stereoCorrelation → metricsForComparison.stereoCorrelation
    → normalizeMetrics() linha 487: getValue(['stereo.value', 'stereoCorrelation', 'stereo_correlation'])
    → evaluateRangeMetric() linha 297

Motor 2 (Cards):
  consolidatedData.metrics.stereo.value
    → analyzeStereoMetrics() linha 984
    → getRangeBounds() linha 175
```

---

## 🎯 ETAPA 2: FONTE DA VERDADE — TABELA

### 2.1 Fluxo de Dados para Tabela

```
[json-output.js]
    │
    ├─► technicalData.lufsIntegrated
    ├─► technicalData.truePeakDbtp  
    ├─► technicalData.dynamicRange
    ├─► technicalData.stereoCorrelation
    │
    └─► comparisonResult: (() => {
            const resolvedTargets = resolveTargets(finalGenre, 'pista', options.genreTargets);
            const metricsForComparison = {
                lufsIntegrated: technicalData.lufsIntegrated,
                truePeakDbtp: technicalData.truePeakDbtp,
                dynamicRange: technicalData.dynamicRange,
                stereoCorrelation: technicalData.stereoCorrelation,
                spectralBands: technicalData.spectral_balance
            };
            const result = compareWithTargets(metricsForComparison, resolvedTargets);
            return result;  // { rows, issues, score }
        })()
```

**Arquivo:** [json-output.js#L1325-L1367](work/api/audio/json-output.js#L1325-L1367)

### 2.2 Função `compareWithTargets()` — MOTOR 1

```javascript
// compareWithTargets.js linha 75
export function compareWithTargets(metrics, targets) {
    // 1️⃣ Normaliza métricas de múltiplos formatos
    const normalizedMetrics = normalizeMetrics(metrics);
    
    // 2️⃣ Avalia cada métrica
    // LUFS
    if (normalizedMetrics.lufs !== null && targets.lufs) {
        const result = evaluateRangeMetric(normalizedMetrics.lufs, targets.lufs, 'lufs');
        rows.push(result.row);
        if (result.issue) issues.push(result.issue);
    }
    
    // TRUE PEAK (REGRA ESPECIAL)
    if (normalizedMetrics.truePeak !== null && targets.truePeak) {
        const result = evaluateTruePeak(normalizedMetrics.truePeak, targets.truePeak);
        rows.push(result.row);
        if (result.issue) issues.push(result.issue);
    }
    
    // DR, Stereo, Bandas...
    return { rows, issues, score };
}
```

**Arquivo:** [compareWithTargets.js#L75-L200](work/lib/audio/core/compareWithTargets.js#L75-L200)

### 2.3 Valores Exatos Usados pela Tabela

| Métrica | Fonte Exata | Linha |
|---------|-------------|-------|
| LUFS | `technicalData.lufsIntegrated` | json-output.js:1336 |
| True Peak | `technicalData.truePeakDbtp` | json-output.js:1337 |
| DR | `technicalData.dynamicRange` | json-output.js:1338 |
| Stereo | `technicalData.stereoCorrelation` | json-output.js:1339 |

---

## 🎯 ETAPA 3: FONTE DA VERDADE — CARDS

### 3.1 Fluxo de Dados para Cards

```
[json-output.js]
    │
    ├─► data.metrics: {
    │       loudness: { value: technicalData.lufsIntegrated, unit: 'LUFS' },
    │       truePeak: { value: technicalData.truePeakDbtp, unit: 'dBTP' },
    │       dr: { value: technicalData.dynamicRange, unit: 'dB' },
    │       stereo: { value: technicalData.stereoCorrelation, unit: 'correlation' }
    │   }
    │
    └─► analyzeProblemsAndSuggestionsV2(audioMetrics, genre, customTargets, finalJSON)
            │
            └─► ProblemsAndSuggestionsAnalyzerV2.analyzeWithEducationalSuggestions(consolidatedData)
                    │
                    ├─► analyzeLUFS(suggestions, problems, consolidatedData)
                    ├─► analyzeTruePeak(suggestions, problems, consolidatedData)
                    ├─► analyzeDynamicRange(suggestions, problems, consolidatedData)
                    └─► analyzeStereoMetrics(suggestions, problems, consolidatedData)
```

**Arquivo:** [json-output.js#L1270-L1310](work/api/audio/json-output.js#L1270-L1310)

### 3.2 Funções de Análise — MOTOR 2

```javascript
// problems-suggestions-v2.js linha 533
analyzeLUFS(suggestions, problems, consolidatedData) {
    // ✅ Lê valor de consolidatedData.metrics
    const metric = consolidatedData.metrics && consolidatedData.metrics.loudness;
    const lufs = metric.value;  // ← VALOR USADO
    
    // ✅ Lê target de consolidatedData.genreTargets
    const targetInfo = this.getMetricTarget('lufs', null, consolidatedData);
    const lufsTarget = targetInfo.target;
    
    // ✅ Calcula bounds com getRangeBounds()
    const lufsThreshold = { 
        target: lufsTarget, 
        tolerance, 
        min: targetInfo.min,
        max: targetInfo.max
    };
    const bounds = this.getRangeBounds(lufsThreshold);
    
    // ✅ Gera sugestão com valores
    const suggestion = {
        currentValue: `${lufs.toFixed(1)} LUFS`,
        targetValue: `${bounds.min.toFixed(1)} a ${bounds.max.toFixed(1)} LUFS`,
        delta: diff.toFixed(1)
    };
}
```

**Arquivo:** [problems-suggestions-v2.js#L533-L700](work/lib/audio/features/problems-suggestions-v2.js#L533-L700)

### 3.3 Valores Exatos Usados pelos Cards

| Métrica | Fonte Exata | Linha |
|---------|-------------|-------|
| LUFS | `consolidatedData.metrics.loudness.value` | problems-suggestions-v2.js:552 |
| True Peak | `consolidatedData.metrics.truePeak.value` | problems-suggestions-v2.js:725 |
| DR | `consolidatedData.metrics.dr.value` | problems-suggestions-v2.js:869 |
| Stereo | `consolidatedData.metrics.stereo.value` | problems-suggestions-v2.js:1002 |

---

## 🎯 ETAPA 4: IDENTIFICAÇÃO DOS "DOIS MOTORES"

### 4.1 Comparação Direta

| Aspecto | MOTOR 1 (compareWithTargets) | MOTOR 2 (problems-suggestions-v2) |
|---------|------------------------------|-----------------------------------|
| **Arquivo** | `work/lib/audio/core/compareWithTargets.js` | `work/lib/audio/features/problems-suggestions-v2.js` |
| **Entrada de Métricas** | `metricsForComparison` (objeto flat) | `consolidatedData.metrics` (objeto nested) |
| **Normalização de Métricas** | `normalizeMetrics()` linha 470 | Manual em cada `analyze*()` |
| **Entrada de Targets** | `resolveTargets()` output | `normalizeGenreTargets()` output |
| **Cálculo de Range** | `evaluateRangeMetric()` / `evaluateTruePeak()` | `getRangeBounds()` linha 175 |
| **Output** | `{ rows, issues, score }` | `suggestions[]` |
| **Consumidor** | Tabela de comparação | Cards de sugestões |

### 4.2 🚨 PONTO DE DIVERGÊNCIA IDENTIFICADO

**O problema está na CONVERSÃO DE TARGETS:**

```javascript
// MOTOR 1 - compareWithTargets.js usa targets resolvidos diretamente
const resolvedTargets = resolveTargets(finalGenre, 'pista', options.genreTargets);
// resolvedTargets.lufs = { target: -7.2, min: -8.2, max: -6.2, ... }

// MOTOR 2 - problems-suggestions-v2.js normaliza NOVAMENTE
effectiveTargets = normalizeGenreTargets(effectiveTargets);
// E depois usa getRangeBounds() que pode calcular min/max diferente!
```

**Arquivo problemático:** [problems-suggestions-v2.js#L1787-L1800](work/lib/audio/features/problems-suggestions-v2.js#L1787-L1800)

### 4.3 Evidência: `getRangeBounds()` vs `evaluateRangeMetric()`

```javascript
// problems-suggestions-v2.js linha 175 - getRangeBounds()
getRangeBounds(threshold) {
    // PRIORIDADE 1: min/max diretos
    if (typeof threshold.min === 'number' && typeof threshold.max === 'number') {
        return { min: threshold.min, max: threshold.max };
    }
    
    // PRIORIDADE 2: target_range (bandas)
    if (threshold.target_range) { ... }
    
    // FALLBACK LEGADO: target ± tolerance
    return {
        min: threshold.target - threshold.tolerance,
        max: threshold.target + threshold.tolerance
    };
}

// compareWithTargets.js linha 297 - evaluateRangeMetric()
function evaluateRangeMetric(value, target, metricKey) {
    const { min, max, target: targetValue } = target;
    // USA MIN/MAX DIRETAMENTE, SEM FALLBACK
}
```

**🔴 DIVERGÊNCIA CONFIRMADA:**
- `compareWithTargets.js` usa `target.min` e `target.max` diretamente
- `problems-suggestions-v2.js` pode cair no fallback `target ± tolerance` se `min/max` não estiverem presentes no formato esperado

---

## 🎯 ETAPA 5: AUDITORIA DE HARDCODED RANGES

### 5.1 Constantes Hardcoded Encontradas

| Constante | Arquivo | Linha | Valor |
|-----------|---------|-------|-------|
| `TRUE_PEAK_HARD_CAP` | resolveTargets.js | 33 | `0.0` |
| `TRUE_PEAK_HARD_CAP` | problems-suggestions-v2.js | 768 | `0.0` |
| `SAFE_DEFAULTS.lufs` | resolveTargets.js | 35-43 | `{ target: -14, min: -16, max: -12 }` |
| `SAFE_DEFAULTS.truePeak` | resolveTargets.js | 44-50 | `{ target: -1.5, min: -3, max: -1 }` |

### 5.2 Análise de SAFE_DEFAULTS

```javascript
// resolveTargets.js linha 35-72
const SAFE_DEFAULTS = {
  lufs: { target: -14, min: -16, max: -12, tolerance: 1.0, critical: 1.5 },
  truePeak: { target: -1.5, min: -3, max: -1, tolerance: 0.5, critical: 0.75, hardCap: 0.0 },
  dr: { target: 8, min: 6, max: 12, tolerance: 1.0, critical: 1.5 },
  stereo: { target: 0.8, min: 0.5, max: 1.0, tolerance: 0.1, critical: 0.15 }
};
```

**⚠️ RISCO:** Se `genreTargets` estiver malformado, o sistema pode cair em `SAFE_DEFAULTS` que são valores genéricos, não específicos do gênero.

---

## 🎯 ETAPA 6: AUDITORIA DO MODE (STREAMING/PISTA)

### 6.1 Streaming Override no Motor 2

```javascript
// problems-suggestions-v2.js linha 1806-1826
const soundDestination = finalJSON?.soundDestination || 'pista';
if (soundDestination === 'streaming') {
    // Override LUFS para streaming
    effectiveTargets.lufs.target = -14;
    effectiveTargets.lufs.min = -14;
    effectiveTargets.lufs.max = -14;
    
    // Override True Peak para streaming
    effectiveTargets.truePeak.target = -1.0;
    effectiveTargets.truePeak.min = -1.5;
    effectiveTargets.truePeak.max = -1.0;
}
```

### 6.2 Streaming Override no Motor 1

```javascript
// resolveTargets.js linha 155-175
if (mode === 'streaming') {
    if (!resolved.lufs) resolved.lufs = {};
    resolved.lufs.target = -14;
    resolved.lufs.min = -14;
    resolved.lufs.max = -14;
    // ... similar para truePeak
}
```

**✅ AMBOS aplicam override de streaming, mas em momentos diferentes do pipeline.**

---

## 🎯 ETAPA 7: AUDITORIA DO AI ENRICHMENT

### 7.1 Fluxo de AI Suggestions

```
Backend:
  analyzeProblemsAndSuggestionsV2() → suggestions[]
    │
    ├─► finalJSON.suggestions = suggestions
    │
    └─► AI Layer (se ativo)
            │
            └─► finalJSON.aiSuggestions = enrichedSuggestions

Frontend:
  ai-suggestion-ui-controller.js
    │
    ├─► checkForAISuggestions(analysis)
    │       └─► Usa analysis.aiSuggestions OU analysis.suggestions
    │
    └─► renderSuggestionCards(suggestions, isAIEnriched, genreTargets)
            └─► Filtra sugestões OK com isMetricOK()
```

### 7.2 Risco de Divergência no Frontend

```javascript
// ai-suggestion-ui-controller.js linha 1799-1843
const isMetricOK = (metric, genreTargets, analysis) => {
    const globalMetrics = {
        'lufs': { 
            value: technicalData.lufsIntegrated,  // ← Lê de technicalData
            target: genreTargets.lufs_target,     // ← Formato diferente!
            tol: genreTargets.tol_lufs || 1.0 
        },
        // ...
    };
    
    const diff = Math.abs(m.value - m.target);
    return diff <= m.tol;  // ← Cálculo DIFERENTE do backend!
};
```

**🔴 PROBLEMA:** O frontend usa `genreTargets.lufs_target` (formato flat) enquanto o backend pode usar `genreTargets.lufs.target` (formato nested) após normalização.

---

## 🎯 ETAPA 8: CONCLUSÃO — ROOT CAUSE

### 8.1 Causa Raiz Principal

> **A divergência ocorre porque DOIS MOTORES INDEPENDENTES calculam os mesmos dados com lógicas ligeiramente diferentes.**

### 8.2 Fluxo Visual da Divergência

```
                    ┌─────────────────────────────────────────────────────────┐
                    │              json-output.js                              │
                    │                                                          │
                    │  technicalData { lufsIntegrated, truePeakDbtp, ... }    │
                    │                                                          │
                    │  data.metrics { loudness.value, truePeak.value, ... }   │
                    │                                                          │
                    │  genreTargets { lufs_target, true_peak_target, ... }    │
                    └──────────────────────┬──────────────────────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────────────────┐
                    │                      │                                   │
                    ▼                      ▼                                   │
    ┌───────────────────────────┐    ┌──────────────────────────────────┐     │
    │     MOTOR 1               │    │       MOTOR 2                     │     │
    │   compareWithTargets()    │    │   problems-suggestions-v2.js     │     │
    │                           │    │                                   │     │
    │ ① resolveTargets()        │    │ ① normalizeGenreTargets()        │     │
    │    ↓                      │    │    ↓                              │     │
    │ ② metricsForComparison    │    │ ② consolidatedData.metrics       │     │
    │    ↓                      │    │    ↓                              │     │
    │ ③ evaluateRangeMetric()   │    │ ③ getRangeBounds()               │ ◄───┼── DIFERENÇA!
    │    ↓                      │    │    ↓                              │     │
    │ OUTPUT: { rows, issues }  │    │ OUTPUT: suggestions[]             │     │
    │                           │    │                                   │     │
    └───────────────────────────┘    └──────────────────────────────────┘     │
                    │                                   │                      │
                    ▼                                   ▼                      │
    ┌───────────────────────────┐    ┌──────────────────────────────────┐     │
    │        TABELA             │    │         CARDS                     │     │
    │   "Comparação com X"      │    │   "Análise Inteligente"          │     │
    │   ✅ CORRETO              │    │   ❌ DIVERGENTE                   │     │
    └───────────────────────────┘    └──────────────────────────────────┘     │
                                                                               │
                    └──────────────────────────────────────────────────────────┘
```

### 8.3 Pontos Específicos de Divergência

| # | Ponto | Motor 1 | Motor 2 | Impacto |
|---|-------|---------|---------|---------|
| 1 | Normalização de Targets | `resolveTargets()` | `normalizeGenreTargets()` | Pode gerar min/max diferentes |
| 2 | Cálculo de Range | `target.min` / `target.max` direto | `getRangeBounds()` com fallback | Fallback pode calcular range errado |
| 3 | Formato de Output | `targetText: "X a Y LUFS"` | `targetValue: "X a Y LUFS"` | Campos diferentes |
| 4 | Consumo no Frontend | `comparisonResult.rows` | `suggestions[]` | Dois arrays separados |

---

## 🎯 ETAPA 9: PLANO DE CORREÇÃO (SEM IMPLEMENTAR)

### 9.1 Solução Proposta: UNIFICAR OS MOTORES

#### Opção A: Motor 2 usa output do Motor 1
```
[Proposta]
1. Motor 1 (compareWithTargets) continua gerando { rows, issues, score }
2. Motor 2 (problems-suggestions-v2) LEIA comparisonResult.issues em vez de calcular novamente
3. Motor 2 apenas ENRIQUECE as issues com texto educativo

[Vantagem]
- Zero divergência numérica
- Mesmos valores em tabela e cards

[Desvantagem]  
- Refatoração significativa no Motor 2
```

#### Opção B: Motor 2 usa mesmas funções do Motor 1
```
[Proposta]
1. Extrair evaluateRangeMetric() e evaluateTruePeak() para módulo compartilhado
2. Motor 2 importa e usa essas funções
3. Ambos geram mesmos números

[Vantagem]
- Reutilização de código
- Manutenção mais fácil

[Desvantagem]
- Ainda há dois motores (complexidade)
```

#### Opção C (RECOMENDADA): Frontend usa comparisonResult.issues
```
[Proposta]
1. Backend: compareWithTargets() já gera issues com números corretos
2. Backend: analyzeProblemsAndSuggestionsV2() adiciona APENAS texto educativo
3. Frontend: renderSuggestionCards() usa comparisonResult.issues como fonte ÚNICA

[Implementação]
- ai-suggestion-ui-controller.js linha 1788:
  // ANTES
  const originalSuggestions = analysis?.aiSuggestions || analysis?.suggestions || suggestions || [];
  
  // DEPOIS  
  const originalSuggestions = analysis?.comparisonResult?.issues || analysis?.aiSuggestions || [];

[Vantagem]
- Menor mudança no código
- Garantia matemática: Tabela = Cards

[Desvantagem]
- issues precisa ter campos de texto (message, explanation, action)
```

### 9.2 Arquivos que Precisam de Correção

| Arquivo | Tipo de Mudança | Prioridade |
|---------|-----------------|------------|
| `problems-suggestions-v2.js` | Ler `comparisonResult.issues` em vez de recalcular | ALTA |
| `ai-suggestion-ui-controller.js` | Consumir `comparisonResult.issues` | ALTA |
| `json-output.js` | Garantir `issues` tem campos de texto | MÉDIA |
| `compareWithTargets.js` | Adicionar campos `message`, `explanation`, `action` a `issues` | MÉDIA |

### 9.3 Testes de Validação Pós-Correção

```javascript
// Teste de paridade
test('Tabela e Cards mostram mesmos números', () => {
    const analysis = runFullPipeline(audioFile, 'funk_mandela');
    
    const tableTP = analysis.comparisonResult.rows.find(r => r.key === 'truePeak').valueRaw;
    const cardTP = parseFloat(analysis.suggestions.find(s => s.metric === 'truePeak').currentValue);
    
    expect(tableTP).toBeCloseTo(cardTP, 1);
});
```

---

## 📊 SUMÁRIO DE EVIDÊNCIAS

| # | Evidência | Arquivo | Linha |
|---|-----------|---------|-------|
| 1 | Motor 1 usa `metricsForComparison` | json-output.js | 1336-1340 |
| 2 | Motor 1 usa `evaluateRangeMetric()` | compareWithTargets.js | 297 |
| 3 | Motor 2 usa `consolidatedData.metrics` | problems-suggestions-v2.js | 552 |
| 4 | Motor 2 usa `getRangeBounds()` | problems-suggestions-v2.js | 175 |
| 5 | `getRangeBounds()` tem fallback legacy | problems-suggestions-v2.js | 223-240 |
| 6 | Frontend pode usar formato diferente | ai-suggestion-ui-controller.js | 1799-1810 |

---

## ✅ CONCLUSÃO FINAL

### O que está acontecendo:
1. A **TABELA** usa o Motor 1 (`compareWithTargets`) que calcula corretamente usando `resolveTargets()` + `evaluateRangeMetric()`
2. Os **CARDS** usam o Motor 2 (`problems-suggestions-v2`) que pode calcular ranges diferentes via `getRangeBounds()` com fallback legacy
3. Ambos lêem os mesmos VALORES de métricas (`lufsIntegrated`, `truePeakDbtp`, etc.)
4. A divergência está nos TARGETS usados para comparação, não nos valores medidos

### Por que isso acontece:
- Dois sistemas evoluíram independentemente
- `getRangeBounds()` tem fallback `target ± tolerance` que pode gerar ranges diferentes
- `normalizeGenreTargets()` e `resolveTargets()` podem produzir estruturas ligeiramente diferentes

### Solução recomendada:
**Fazer os CARDS consumirem `comparisonResult.issues` do Motor 1 em vez de calcular novamente no Motor 2.**

---

**FIM DO RELATÓRIO FORENSE**

*Este documento foi gerado automaticamente como auditoria de código. Nenhuma correção foi aplicada.*
