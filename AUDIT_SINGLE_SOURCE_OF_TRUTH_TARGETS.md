# 🎯 AUDITORIA: FONTE ÚNICA DA VERDADE PARA TARGETS

**Data:** 2025-01-15  
**Objetivo:** Eliminar divergências entre tabela, score e sugestões garantindo que TODOS usem o MESMO "target normalizado" vindo do backend.

---

## 📋 RESUMO DAS IMPLEMENTAÇÕES

### T1) Backend: normalize-genre-targets.js ✅

**Arquivo:** `work/lib/audio/utils/normalize-genre-targets.js`

**Mudanças:**
- Estrutura normalizada com `{ metrics: {...}, bands: {...}, _normalized: true, _version: '2.0.0' }`
- Constante `TRUE_PEAK_HARD_CAP = 0.0` dBTP (hard cap físico)
- **Funções exportadas:**
  - `normalizeGenreTargets(rawTargets)` - Normaliza formato JSON → formato único
  - `validateNormalizedTargets(targets)` - Valida estrutura normalizada
  - `calculateMetricSeverity(metricKey, value, normalizedTargets)` - **FONTE ÚNICA** de severidade para métricas
  - `calculateBandSeverity(bandKey, value, normalizedTargets)` - **FONTE ÚNICA** de severidade para bandas

**Regra Especial True Peak:**
```javascript
if (value > TRUE_PEAK_HARD_CAP) {
    return { severity: 'CRÍTICA', delta: value - TRUE_PEAK_HARD_CAP, ... };
}
```

---

### T2) Backend: Scoring e Sugestões ✅

**Arquivos:**
- `work/api/audio/pipeline-complete.js` - Já usa `normalizeGenreTargets()` no consolidatedData
- `work/lib/audio/features/problems-suggestions-v2.js` - Já importa e usa a função de normalização

---

### T3) Backend: Incluir normalizedTargets no JSON ✅

**Arquivo:** `work/api/audio/json-output.js`

**Novo campo no `data`:**
```javascript
referenceTargetsNormalized: {
    _normalized: true,
    _version: '2.0.0',
    metrics: {
        lufs: { target, min, max, tolerance, unit },
        truePeak: { target, min, max, tolerance, warnFrom, hardCap: 0.0, unit },
        dr: { target, min, max, tolerance, unit },
        stereo: { target, min, max, tolerance, unit }
    },
    bands: { sub: {...}, bass: {...}, ... },
    preCalculatedSeverities: {
        metrics: {
            lufs: { severity, delta, action },
            truePeak: { severity, delta, action },
            dr: { severity, delta, action },
            stereo: { severity, delta, action }
        },
        bands: {
            sub: { severity, delta, action },
            bass: { severity, delta, action },
            // ...
        }
    }
}
```

---

### T4) Frontend: Usar referenceTargetsNormalized ✅

**Arquivo:** `public/audio-analyzer-integration.js`

**Novas funções:**
```javascript
// Extrai targets normalizados do analysis
getNormalizedTargetsFromAnalysis(analysis)

// Obtém severidade pré-calculada para métrica
getSeverityFromNormalized(normalizedTargets, metricKey)

// Obtém severidade pré-calculada para banda
getBandSeverityFromNormalized(normalizedTargets, bandKey)

// Calcula severidade de True Peak localmente (fallback)
calculateTruePeakSeverityLocal(value, targets)
```

**Mudanças em `buildMetricRows()`:**
- Detecta se `referenceTargetsNormalized` está disponível no início
- Para cada métrica (LUFS, True Peak, DR, Stereo):
  1. Tenta usar `preCalculatedSeverities.metrics.{metric}` do backend
  2. Fallback: calcula localmente com `calcSeverity()`
- Para cada banda:
  1. Tenta usar `preCalculatedSeverities.bands.{band}` do backend
  2. Fallback: calcula localmente

---

### T5) Regra True Peak > 0 = CRÍTICA ✅

**Implementado em:**
1. `normalize-genre-targets.js` → `calculateMetricSeverity('truePeak', ...)`
2. `json-output.js` → Pré-calcula e envia no JSON
3. `audio-analyzer-integration.js` → `calculateTruePeakSeverityLocal()`

**Regra:**
```
truePeak > 0.0 dBTP => severidade = 'CRÍTICA'
truePeak.max NUNCA pode ser > 0.0 (hardCap aplicado em todos os caminhos)
```

---

## 📊 FLUXO DE DADOS

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Worker)                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  work/refs/out/{genre}.json                                             │
│         │                                                               │
│         ▼                                                               │
│  normalizeGenreTargets(rawTargets)  [normalize-genre-targets.js]        │
│         │                                                               │
│         ▼                                                               │
│  { metrics: {...}, bands: {...}, _normalized: true }                    │
│         │                                                               │
│         ├─────────────────────────────────────────────┐                 │
│         │                                             │                 │
│         ▼                                             ▼                 │
│  problems-suggestions-v2.js              json-output.js                 │
│  (usa getMetricTarget)                   (gera referenceTargetsNormalized)│
│         │                                             │                 │
│         ▼                                             ▼                 │
│  consolidatedData.genreTargets      data.referenceTargetsNormalized     │
│         │                                   + preCalculatedSeverities   │
└─────────┴─────────────────────────────────────────────┴─────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  analysis.data.referenceTargetsNormalized                               │
│         │                                                               │
│         ▼                                                               │
│  getNormalizedTargetsFromAnalysis(analysis)                             │
│         │                                                               │
│         ├─────────────────────────────────────────────┐                 │
│         │                                             │                 │
│         ▼                                             ▼                 │
│  buildMetricRows()                          calculateLoudnessScore()    │
│  (usa preCalculatedSeverities)              calculateDynamicsScore()    │
│         │                                             │                 │
│         ▼                                             ▼                 │
│  TABELA (rows com severidade)               SCORE (pontuação)           │
│         │                                             │                 │
│         └─────────────────────────────────────────────┘                 │
│                                    │                                    │
│                                    ▼                                    │
│                            SUGESTÕES (UI)                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔴 AUDITORIA ATUALIZADA (27/12/2025) - PROBLEMA IDENTIFICADO

### MAPA: TABELA vs SUGESTÕES - DIVERGÊNCIA DE FONTES

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    🔴 PONTO DE DIVERGÊNCIA IDENTIFICADO                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────┐   ┌─────────────────────────────┐  │
│  │        📊 TABELA                │   │      💡 SUGESTÕES           │  │
│  ├─────────────────────────────────┤   ├─────────────────────────────┤  │
│  │                                 │   │                             │  │
│  │ FONTE:                          │   │ FONTE:                      │  │
│  │ • referenceTargetsNormalized    │   │ • getCorrectTargets()       │  │
│  │   (do backend via json-output)  │   │   com FALLBACKS:            │  │
│  │                                 │   │   - PROD_AI_REF_DATA[genre] │  │
│  │ ARQUIVO:                        │   │   - window.__activeRefData  │  │
│  │ • audio-analyzer-integration.js │   │                             │  │
│  │   buildMetricRows() linha ~7095 │   │ STATUS: ❌ PROBLEMÁTICO     │  │
│  │                                 │   │ Fallbacks podem ser de      │  │
│  │ STATUS: ✅ Correto              │   │ análises ANTERIORES!        │  │
│  │ Usa targets do backend          │   │                             │  │
│  └─────────────────────────────────┘   └─────────────────────────────┘  │
│                                                                         │
│  ⚠️ CONSEQUÊNCIA:                                                       │
│  • Tabela mostra targets de Funk Mandela                               │
│  • Sugestões usam targets de Progressive Trance (análise anterior)     │
│  • Severidades divergem (CRÍTICA vs OK para mesma métrica)             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### FONTES DE TARGETS (AUDITORIA)

| Local | Fonte | Arquivo | Linha | Status |
|-------|-------|---------|-------|--------|
| **TABELA** | `referenceTargetsNormalized` | audio-analyzer-integration.js | ~7105 | ✅ Correto |
| **SUGESTÕES** | `getCorrectTargets()` → fallbacks | ai-suggestion-ui-controller.js | ~851 | ❌ State leak |
| **BACKEND** | `normalizeGenreTargets()` | json-output.js | ~1102 | ✅ Correto |
| **PIPELINE** | `consolidatedData.genreTargets` | pipeline-complete.js | ~661 | ✅ Correto |

---

## ✅ VALIDAÇÃO

Para testar a implementação:

1. **Analisar arquivo com gênero definido**
2. **Verificar no console:**
   ```
   [BUILD_ROWS] ✅ Usando referenceTargetsNormalized do backend
   [BUILD_ROWS] ✅ LUFS: severidade do backend = OK
   [BUILD_ROWS] ✅ True Peak: severidade do backend = CRÍTICA (se > 0)
   ```

3. **Verificar JSON retornado:**
   - Campo `data.referenceTargetsNormalized` presente
   - `truePeak.max` ≤ 0.0 sempre
   - `preCalculatedSeverities.metrics.truePeak.severity = 'CRÍTICA'` se valor > 0

---

## 🔐 GARANTIAS

1. **True Peak > 0 dBTP SEMPRE mostra CRÍTICA** (tabela, score, sugestões)
2. **Fonte única:** `normalize-genre-targets.js` centraliza toda lógica de normalização
3. **Sem divergências:** Frontend usa severidades pré-calculadas do backend
4. **Fallback seguro:** Se backend não enviar, frontend calcula localmente com mesma lógica

---

## 📁 ARQUIVOS MODIFICADOS

| Arquivo | Mudança |
|---------|---------|
| `work/lib/audio/utils/normalize-genre-targets.js` | Funções `calculateMetricSeverity`, `calculateBandSeverity` |
| `work/api/audio/json-output.js` | Campo `referenceTargetsNormalized` com severidades pré-calculadas |
| `public/audio-analyzer-integration.js` | `buildMetricRows()` usa severidades do backend |
