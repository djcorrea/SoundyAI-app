# 🎯 Pipeline Único de Targets - IMPLEMENTAÇÃO COMPLETA

## Resumo

Este documento descreve a implementação do pipeline único para resolução de targets e comparação de métricas, garantindo que **TABELA**, **SUGESTÕES** e **SCORE** usem exatamente os mesmos dados.

---

## 🏗️ Arquitetura

### Módulos Criados

```
work/lib/audio/core/
├── resolveTargets.js      # Resolução centralizada de targets
├── compareWithTargets.js  # Comparação centralizada de métricas
├── index.js               # Exportações do módulo
└── validate-targets.test.js  # Testes golden scenarios
```

### Fluxo de Dados

```
Backend (json-output.js)
    │
    ├─→ resolveTargets(genreId, mode, rawTargets)
    │      │
    │      └─→ Formato canônico único
    │
    └─→ compareWithTargets(metrics, targets)
           │
           └─→ { rows, issues, score }
                  │
                  └─→ comparisonResult (campo JSON)
                        │
    ┌────────────────────┴────────────────────┐
    │                    │                    │
    ▼                    ▼                    ▼
  TABELA            SUGESTÕES             SCORE
(buildMetricRows)  (checkForAISuggestions)  (normalizeBackendAnalysis)
```

---

## 📁 Arquivos Modificados

### 1. Backend - `work/api/audio/json-output.js`

**Mudanças:**
- Import do novo módulo `resolveTargets`, `compareWithTargets`, `validateTargets`
- Novo campo `comparisonResult` em `buildFinalJSON()` contendo:
  - `rows` - Linhas formatadas para tabela
  - `issues` - Problemas detectados para sugestões
  - `score` - { total, classification, breakdown }

```javascript
comparisonResult: (() => {
  const resolvedTargets = resolveTargets(finalGenre, 'pista', options.genreTargets);
  const validation = validateTargets(resolvedTargets);
  const result = compareWithTargets(metricsForComparison, resolvedTargets);
  return result;
})()
```

### 2. Frontend Tabela - `public/audio-analyzer-integration.js`

**Mudanças:**
- `buildMetricRows()` agora usa `comparisonResult.rows` como PRIORIDADE 1
- Se `comparisonResult` disponível, retorna diretamente sem cálculo local
- Fallback para cálculo local apenas se backend não enviou dados

```javascript
const comparisonResult = analysis?.data?.comparisonResult;
if (comparisonResult && Array.isArray(comparisonResult.rows)) {
    return comparisonResult.rows; // FONTE ÚNICA
}
```

### 3. Frontend Sugestões - `public/ai-suggestion-ui-controller.js`

**Mudanças:**
- `checkForAISuggestions()` agora verifica `comparisonResult.issues` primeiro
- Novo método `mergeSuggestionsWithComparison()` para combinar textos IA com dados numéricos
- Invariante: Se `truePeak > 0`, severity **DEVE** ser `CRÍTICA`

```javascript
if (comparisonResult && Array.isArray(comparisonResult.issues)) {
    const mergedSuggestions = this.mergeSuggestionsWithComparison(
        extractedAI, 
        comparisonResult.issues
    );
    this.renderAISuggestions(mergedSuggestions, null, metrics);
    return;
}
```

### 4. Frontend Score - `public/audio-analyzer-integration.js`

**Mudanças:**
- `normalizeBackendAnalysisData()` agora prioriza `comparisonResult.score.total`
- Usa `comparisonResult.score.classification` se disponível
- Fallback para `backendData.score` apenas se pipeline não executou

```javascript
const comparisonScore = backendData.comparisonResult?.score;
if (comparisonScore && Number.isFinite(comparisonScore.total)) {
    normalized.qualityOverall = comparisonScore.total;
    normalized.classification = comparisonScore.classification;
}
```

---

## 🔒 Invariantes Garantidos

### TRUE_PEAK_HARD_CAP = 0.0 dBTP

```javascript
// Em TODOS os lugares:
if (truePeakValue > 0.0) {
    severity = 'CRÍTICA'; // OBRIGATÓRIO
}
```

**Locais com verificação:**
1. `compareWithTargets.js` - `evaluateTruePeak()`
2. `json-output.js` - Verificação de invariante no backend
3. `ai-suggestion-ui-controller.js` - Verificação em `checkForAISuggestions()` e `mergeSuggestionsWithComparison()`

### Níveis de Severidade

| Severidade | Descrição | Cor |
|------------|-----------|-----|
| OK | Dentro do target | Verde |
| ATENÇÃO | Desvio leve | Amarelo |
| ALTA | Desvio significativo | Laranja |
| CRÍTICA | Fora do aceitável / TP > 0 | Vermelho |

---

## 🧪 Testes Golden

Arquivo: `work/lib/audio/core/validate-targets.test.js`

### Cenário 1: Funk Mandela com TP > 0
```javascript
{
  metrics: { truePeak: 0.3 },
  expected: { severity: 'CRÍTICA' }
}
```

### Cenário 2: Progressive Trance com TP 1.7
```javascript
{
  metrics: { truePeak: 1.7 },
  expected: { severity: 'CRÍTICA' }
}
```

### Cenário 3: Métricas dentro do range
```javascript
{
  metrics: { lufs: -12, truePeak: -0.5, dr: 8 },
  expected: { allOK: true }
}
```

### Cenário 4: validateTargets guardrail
```javascript
// Verifica se targets são válidos antes de usar
const validation = validateTargets(targets);
if (!validation.valid) {
    console.error('Targets inválidos:', validation.errors);
}
```

---

## 🔄 Migração / Compatibilidade

### Retrocompatibilidade
- Se `comparisonResult` não existir, todos os componentes usam lógica legada
- Nenhuma quebra de funcionalidade existente
- Flags de controle permitem desabilitar pipeline se necessário

### Ordem de Prioridade (todos os componentes)

1. **PRIORIDADE 0**: `comparisonResult` (pipeline único)
2. **PRIORIDADE 1**: `targetProfile` / `referenceTargetsNormalized`
3. **PRIORIDADE 2**: `genreTargets` direto
4. **DESCARTADO**: Fallbacks globais (PROD_AI_REF_DATA, __activeRefData)

---

## 📋 Checklist de Verificação

- [x] `resolveTargets()` criado e exportado
- [x] `compareWithTargets()` criado e exportado
- [x] `validateTargets()` guardrail implementado
- [x] `TRUE_PEAK_HARD_CAP = 0.0` em constante exportada
- [x] Backend gera `comparisonResult` em JSON
- [x] Tabela usa `comparisonResult.rows`
- [x] Sugestões usam `comparisonResult.issues`
- [x] Score usa `comparisonResult.score.total`
- [x] Invariante TP > 0 = CRÍTICA verificado em 4 lugares
- [x] Testes golden criados
- [x] Documentação atualizada

---

## 🎯 Resultado Final

Agora **TABELA**, **SUGESTÕES** e **SCORE** consomem o **MESMO OBJETO** (`comparisonResult`), eliminando divergências de:
- Valores numéricos diferentes
- Severidades inconsistentes
- Classificações divergentes

O True Peak > 0.0 dBTP **SEMPRE** será marcado como `CRÍTICA` em todo o sistema.
