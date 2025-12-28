# Score Engine V3.6 - SINGLE SOURCE OF TRUTH
## Auditoria e Correção Completa

**Data:** 2025-01-28
**Versão:** V3.6-SINGLE-SOURCE

---

## 🎯 PROBLEMA IDENTIFICADO

O sistema anterior (V3.4/V3.5) tinha múltiplas funções calculando severidade/score de formas DIFERENTES:
1. `calcMetricScore` interno ao `computeScoreV3`
2. `calcSeverity` interno ao `buildMetricRows`  
3. `calculateMetricScore` global
4. `calculateMetricScoreWithBounds` global

Isso causava:
- Tabela mostrando CRÍTICA mas subscores permanecendo altos
- Gates aplicados ao score FINAL (não aos subscores)
- Score inflado mesmo com métricas críticas

---

## ✅ SOLUÇÃO IMPLEMENTADA

### 1. Função Canônica: `window.evaluateMetric()`

```javascript
window.evaluateMetric(metricKey, measuredValue, targetSpec)
// Retorna: { score, severity, diff, reason, deviationRatio, status }
```

Esta é a **ÚNICA** função que deve ser usada para avaliar métricas em:
- Tabela (`buildMetricRows`)
- Subscores
- Gates
- Sugestões

### 2. Helper para Tabela: `window.evaluateMetricForTable()`

Converte o resultado de `evaluateMetric` para o formato esperado pela tabela:
```javascript
// Retorna: { severity, severityClass, action, diff, score }
```

### 3. Gates nos SUBSCORES (não no final)

**Antes (V3.5):**
```
raw = média dos subscores
gatePenalty = soma das penalidades
final = raw - gatePenalty  ❌ Gates no final
```

**Agora (V3.6):**
```
subScoresRaw = médias sem gates
subscores = subScoresRaw com caps aplicados  ✅ Gates nos subscores
raw = média de subScoresRaw
final = média de subscores (já com gates)
```

### 4. Mapeamento Métrica → Subscore

```javascript
METRIC_TO_SUBSCORE = {
    lufs, rms → loudness
    truePeak, samplePeak, clipping, dcOffset → technical
    dr, crest, lra → dynamics
    correlation, width → stereo
    sub, bass, lowMid, mid, highMid, air, presence → frequency
}
```

---

## 📊 CURVA DE SEVERIDADE (evaluateMetric)

| deviationRatio | Score | Severidade |
|----------------|-------|------------|
| ≤ 1.0x         | 100%  | OK         |
| 1.0x - 1.5x    | 85-100% | ATENÇÃO  |
| 1.5x - 2.0x    | 65-85%  | ALTA     |
| 2.0x - 3.0x    | 35-65%  | CRÍTICA  |
| > 3.0x         | 20-35%  | CRÍTICA  |

---

## 🚪 GATES (Caps nos Subscores)

### TRUE_PEAK_GATE
- **Condição:** truePeak > max (ex: > -1.0 dBTP)
- **Cap:** `max(35, 95 - excess × 20)`
- **Aplica em:** Technical subscore

### CLIPPING_GATE
- **Condição:** clipping > 0.5%
- **Cap:** `max(30, 80 - (clipping - 0.5) × 10)`
- **Aplica em:** Technical subscore

### LUFS_HIGH_GATE
- **Condição:** lufs > max
- **Cap:** `max(50, 95 - excess × 7.5)`
- **Aplica em:** Loudness subscore

---

## 🧪 TESTES

Execute no console:
```javascript
window.__testScoreV3Scenarios()
```

### Cenário A: True Peak CRÍTICO (+2.0 dBTP)
- ✅ TRUE_PEAK_GATE deve ser triggered
- ✅ Technical subscore deve ser capeado (< subScoresRaw.technical)
- ✅ evaluateMetric(truePeak).severity = CRÍTICA

### Cenário B: Sub/Bass CRÍTICOS
- ✅ Frequency subscore ≤ 40
- ✅ evaluateMetric(sub).severity = CRÍTICA
- ✅ evaluateMetric(bass).severity = CRÍTICA

### Cenário C: Tudo OK
- ✅ Score ≥ 85
- ✅ Nenhum gate triggered

---

## 📁 ARQUIVOS MODIFICADOS

- `public/audio-analyzer-integration.js`
  - Nova função `evaluateMetric` (linha ~23100)
  - Nova função `evaluateMetricForTable` (linha ~23220)
  - Novo `computeScoreV3` com gates nos subscores (linha ~23350)
  - `calcSeverity` em `buildMetricRows` agora usa `evaluateMetricForTable`
  - Novos testes em `__testScoreV3Scenarios`

---

## 🔍 DEBUG ESTRUTURADO

O retorno de `computeScoreV3` agora inclui:

```javascript
{
    raw,                  // Score sem gates
    final,                // Score com gates nos subscores
    subscores,            // Com gates aplicados
    subScoresRaw,         // Sem gates (para debug)
    gatesTriggered,       // Array com detalhes de cada gate
    metricEvaluations,    // Resultado de evaluateMetric para cada métrica
    debug: {
        mode,
        measured,
        targets,
        weights,
        version: 'V3.6-SINGLE-SOURCE'
    }
}
```

---

## ✨ BENEFÍCIOS

1. **Single Source of Truth:** Tabela, subscores e gates usam mesma função
2. **Gates nos subscores:** Problema crítico afeta apenas o subscore relevante
3. **Debug estruturado:** Fácil identificar onde está o problema
4. **Testes automatizados:** Verificar comportamento com cenários conhecidos
5. **Compatibilidade:** Mantém formato de retorno para código existente
