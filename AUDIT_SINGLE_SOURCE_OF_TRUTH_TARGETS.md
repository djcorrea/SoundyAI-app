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
| **TABELA** | `targetProfile` ou `referenceTargetsNormalized` | audio-analyzer-integration.js | ~7105 | ✅ Corrigido |
| **SUGESTÕES** | `targetProfile` (sem fallbacks) | ai-suggestion-ui-controller.js | ~855 | ✅ Corrigido |
| **BACKEND** | `targetProfile` + `normalizeGenreTargets()` | json-output.js | ~1102 | ✅ Novo campo |
| **PIPELINE** | `consolidatedData.genreTargets` | pipeline-complete.js | ~661 | ✅ Correto |

---

## ✅ CORREÇÕES APLICADAS (27/12/2025)

### 1. Backend: Novo campo `targetProfile` (json-output.js)

```javascript
targetProfile: {
    _version: '1.0.0',
    _source: 'backend',
    _genre: 'funk_mandela',
    
    truePeak: {
        tp_min: -3.0,
        tp_warn_from: -0.1,
        tp_target: -1.0,
        tp_max: 0.0  // SEMPRE 0.0 (hard cap físico)
    },
    
    lufs: { target: -8.5, min: -10.5, max: -6.5 },
    dr: { target: 6.0, min: 4.0, max: 9.0 },
    lra: null,
    stereo: null,
    
    bands: {
        sub: { min: -27, max: -18, target: -22.5 },
        bass: { min: -26.5, max: -19, target: -22.75 },
        // ... outras bandas
    },
    
    preCalculatedSeverities: {
        truePeak: { severity: 'CRÍTICA', delta: 3.9, action: '🔴 CLIPPING!' },
        lufs: { severity: 'OK', delta: 0 },
        // ...
    }
}
```

### 2. Frontend: getNormalizedTargetsFromAnalysis (audio-analyzer-integration.js)

- PRIORIDADE 1: `analysis.data.targetProfile` (novo)
- PRIORIDADE 2: `analysis.data.referenceTargetsNormalized` (formato anterior)
- ❌ REMOVIDO: Fallbacks para `PROD_AI_REF_DATA`, `__activeRefData`

### 3. Frontend: ai-suggestion-ui-controller.js

```javascript
// ANTES (problemático):
const genreTargets = getCorrectTargets(analysis); // ❌ Fallbacks para globals

// DEPOIS (corrigido):
let genreTargets = null;
if (analysis?.data?.targetProfile) {
    genreTargets = analysis.data.targetProfile; // ✅ Fonte única
} else if (analysis?.data?.referenceTargetsNormalized) {
    genreTargets = analysis.data.referenceTargetsNormalized;
}
// ❌ REMOVIDO: Fallbacks para PROD_AI_REF_DATA
```

### 4. Frontend: Nova função evaluateMetricFromTargetProfile

Função centralizada que:
- Usa severidades pré-calculadas do backend quando disponíveis
- Calcula localmente com mesma lógica do backend como fallback
- GARANTE: True Peak > 0 dBTP = SEMPRE CRÍTICA

---

## ✅ VALIDAÇÃO

Para testar a implementação:

1. **Analisar arquivo com gênero definido**
2. **Verificar no console:**
   ```
   [NORMALIZED-TARGETS] ✅ Usando targetProfile do backend (FONTE ÚNICA)
   [AI-UI][TARGETS] ✅ Usando analysis.data.targetProfile (FONTE ÚNICA)
   [AI-UI][TARGET-PROFILE] 🎯 TARGETS USADOS NAS SUGESTÕES:
   ```

3. **Verificar JSON retornado:**
   - Campo `data.targetProfile` presente
   - `targetProfile.truePeak.tp_max` = 0.0 sempre
   - `targetProfile.preCalculatedSeverities.truePeak.severity = 'CRÍTICA'` se valor > 0

---

## 🧪 TESTE MANUAL OBRIGATÓRIO

### Teste 1: Funk Mandela com True Peak > 0

1. Analisar arquivo de **Funk Mandela** com True Peak > 0 dBTP
2. Verificar:
   - **TABELA:** True Peak deve mostrar CRÍTICA (vermelho)
   - **SUGESTÕES:** Deve haver card de True Peak com severidade CRÍTICA
   - **Console:** `[AI-UI][INVARIANT] 🚨 TRUE PEAK > 0 dBTP DETECTADO!`

### Teste 2: Progressive Trance após Funk Mandela

1. Analisar arquivo de **Progressive Trance** (sem clipping)
2. Verificar:
   - **Console:** `[AI-UI][TARGET-PROFILE] Genre: progressive_trance` (NÃO funk_mandela)
   - **Targets:** Devem ser de Trance (LUFS -8.5, não -8.5 de Mandela)
   - **Sem state leak:** Sugestões NÃO devem usar targets do Mandela

### O que verificar no Console:

```
// ANTES (problemático):
[TARGETS] 📦 Usando PROD_AI_REF_DATA[genre] como fallback  // ❌ STATE LEAK!

// DEPOIS (correto):
[NORMALIZED-TARGETS] ✅ Usando targetProfile do backend    // ✅ FONTE ÚNICA
[AI-UI][TARGET-PROFILE] Genre: progressive_trance          // ✅ Gênero correto
```

---

## 🔐 GARANTIAS

1. **True Peak > 0 dBTP SEMPRE mostra CRÍTICA** (tabela, score, sugestões)
2. **Fonte única:** `targetProfile` no backend centraliza toda lógica
3. **Sem divergências:** Frontend usa APENAS `targetProfile` ou `referenceTargetsNormalized`
4. **Sem state leak:** Removidos fallbacks para `PROD_AI_REF_DATA`, `__activeRefData`
5. **Fallback seguro:** Se backend não enviar, frontend calcula localmente com mesma lógica

---

## 📁 ARQUIVOS MODIFICADOS

| Arquivo | Mudança |
|---------|---------|
| `work/lib/audio/utils/normalize-genre-targets.js` | Funções `calculateMetricSeverity`, `calculateBandSeverity` |
| `work/api/audio/json-output.js` | Campo `referenceTargetsNormalized` com severidades pré-calculadas |
| `public/audio-analyzer-integration.js` | `buildMetricRows()` usa severidades do backend |
