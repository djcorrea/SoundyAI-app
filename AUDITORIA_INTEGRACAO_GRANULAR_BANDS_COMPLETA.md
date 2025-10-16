# 🔍 AUDITORIA COMPLETA: Integração Granular V1 com Sistema Legacy

**Data**: 16 de outubro de 2025  
**Objetivo**: Mapear todos os pontos críticos de integração entre granular_v1 e sistema legacy para garantir compatibilidade total com frontend e scoring.

---

## 📋 ETAPA 1: INVENTÁRIO DE ARQUIVOS

### Arquivos Core do Sistema Espectral

#### 1. **work/lib/audio/features/spectral-bands-granular.js** (550 linhas)
- **Função principal**: `analyzeGranularSpectralBands(framesFFT, reference)`
- **Retorna**:
  ```javascript
  {
    algorithm: 'granular_v1',
    groups: { sub, bass, low_mid, mid, high_mid, presence, air },
    granular: [13 sub-bandas],
    suggestions: [array de sugestões],
    // metadata...
  }
  ```
- **Funções auxiliares**:
  - `aggregateSubBandsIntoGroups()` → Linhas 265-305
  - `buildSuggestions()` → Linhas 310-390
- **Status**: ✅ Implementado, testado, sintaxe validada

#### 2. **work/lib/audio/features/spectral-bands.js** (429 linhas)
- **Classe**: `SpectralBandsCalculator` → Linhas 30-287
- **Classe**: `SpectralBandsAggregator` → Linhas 313-418
- **Função principal**: `analyzeBands(leftMag, rightMag, frameIndex)`
- **Retorna**:
  ```javascript
  {
    bands: {
      sub: { energy_db, percentage, frequencyRange, name, status },
      bass: { ... },
      // ... 7 bandas
    },
    totalPercentage: 100.0,
    algorithm: 'RMS_7_Band_Normalized',
    valid: true
  }
  ```
- **Método agregação**: `SpectralBandsAggregator.aggregate(bandsArray)` → Linha 318
  - Usa **mediana** de múltiplos frames
  - Retorna estrutura com `.bands.{bandName}`

#### 3. **work/api/audio/core-metrics.js** (2049 linhas)
- **Função chave**: `calculateSpectralBandsMetrics(framesFFT, options)` → Linha 848
- **Roteador condicional** (linha ~854):
  ```javascript
  const engine = process.env.ANALYZER_ENGINE || 'legacy';
  if (engine === 'granular_v1') {
    return await this.calculateGranularSubBands(framesFFT, options);
  }
  // Legacy path...
  ```
- **Nova função**: `calculateGranularSubBands(framesFFT, options)` → Linha 1920
  - Converte estrutura de frames
  - Importa dinamicamente módulo granular
  - Retorna resultado completo
- **Legacy preservado**: 100% do código original mantido

#### 4. **work/api/audio/json-output.js** (1086 linhas)
- **Função chave**: `extractTechnicalData(coreMetrics, reference)` → Linha 158
- **Extração de bandas** (linhas 192-268):
  - Condição: `if (coreMetrics.spectralBands?.bands)`
  - Acessa: `b.bands.sub.energy_db`, `b.bands.sub.percentage`
  - Estrutura final: `technicalData.spectral_balance`
- **Campos aditivos granular** (linhas 781-803):
  ```javascript
  ...(coreMetrics.spectralBands?.algorithm === 'granular_v1' && {
    engineVersion: coreMetrics.spectralBands.algorithm,
    granular: coreMetrics.spectralBands.granular || [],
    suggestions: coreMetrics.spectralBands.suggestions || [],
    granularMetadata: { /* stats */ }
  })
  ```
- **⚠️ PONTO CRÍTICO**: Linha 350 - `hasBands: !!(coreMetrics.spectralBands?.bands)`

#### 5. **work/lib/audio/features/scoring.js** (1229 linhas)
- **Função principal**: `computeMixScore(technicalData, reference)` → Linha ~380
- **Uso de bandas** (linhas 540-590):
  ```javascript
  if (reference?.spectral_bands) {
    for (const [band, refBand] of Object.entries(reference.spectral_bands)) {
      const val = metrics.spectral_balance?.[band]?.energy_db;
      
      // Sistema de ranges (NOVO)
      if (refBand.target_range) {
        addMetric('tonal', `band_${band}`, val, target, tol, { 
          target_range: refBand.target_range 
        });
      }
      // Sistema fixo (LEGADO)
      else if (refBand.target_db) {
        addMetric('tonal', `band_${band}`, val, refBand.target_db, tol);
      }
    }
  }
  ```
- **Função auxiliar**: `scoreToleranceRange(value, targetRange, fallback, tol)` → Linha 149
- **Sistema de pesos**: Linha 665 - `band_high_mid: 0.14`, `band_low_bass: 0.08`, etc.

---

## 📊 ETAPA 2: MAPEAMENTO DE SÍMBOLOS E OCORRÊNCIAS

### `spectralBands` - Objeto principal

| Arquivo | Linha | Contexto | Papel |
|---------|-------|----------|-------|
| core-metrics.js | 262 | `spectralBands: spectralBandsResults` | Atribuição no resultado |
| core-metrics.js | 848 | `calculateSpectralBandsMetrics()` | Função de cálculo |
| json-output.js | 192 | `if (coreMetrics.spectralBands?.bands)` | Condição de acesso |
| json-output.js | 348 | `hasSpectralBands: !!coreMetrics.spectralBands` | Debug |
| json-output.js | 781 | `coreMetrics.spectralBands?.algorithm === 'granular_v1'` | Condição aditiva |

### `.bands` - Estrutura de 7 bandas

| Arquivo | Linha | Expressão | Resultado Esperado |
|---------|-------|-----------|-------------------|
| spectral-bands.js | 146 | `return { bands: bandsData, ... }` | Objeto com 7 chaves |
| spectral-bands-granular.js | 237 | `groups: groups` | ⚠️ **NÃO TEM `.bands`** |
| core-metrics.js | 929 | `bandsKeys: result.bands ? Object.keys(result.bands)` | Debug |
| json-output.js | 192 | `if (coreMetrics.spectralBands?.bands)` | ✅ Legacy funciona |
| json-output.js | 209 | `if (b.bands && typeof b.bands === 'object')` | Acesso às bandas |
| json-output.js | 213 | `b.bands.sub?.energy_db` | Extração de valores |

### `.groups` - **PROBLEMA IDENTIFICADO**

| Arquivo | Linha | Expressão | Valor |
|---------|-------|-----------|-------|
| spectral-bands-granular.js | 237 | `groups: groups` | `{ sub: {status, score}, bass: {...}, ... }` |
| spectral-bands-granular.js | 295 | `groups[groupName] = { status, score, ... }` | Estrutura diferente |
| core-metrics.js | 1995 | `groupsCount: Object.keys(granularResult.groups).length` | Debug (7) |

### `computeMixScore` - Função de scoring

| Arquivo | Linha | Contexto |
|---------|-------|----------|
| json-output.js | 50 | `const scoringResult = computeMixScore(technicalData, reference)` | Chamada |
| scoring.js | ~380 | `function computeMixScore(technicalData, reference)` | Definição |
| scoring.js | 550 | `const val = metrics.spectral_balance?.[band]?.energy_db` | Acesso a bandas |

---

## 🔍 ETAPA 3: CHAVES ESPERADAS PELO FRONT

### Payload Final (json-output.js, linhas 755-804)

```javascript
return {
  score: scoringResult.scorePct,
  classification: scoringResult.classification,
  
  // ✅ BANDAS LEGADAS (sempre presentes)
  bands: technicalData.spectral_balance, // { sub, bass, lowMid, mid, highMid, presence, air }
  
  // ✅ CAMPOS ADITIVOS GRANULAR (apenas se engine = granular_v1)
  ...(coreMetrics.spectralBands?.algorithm === 'granular_v1' && {
    engineVersion: 'granular_v1',
    granular: [...], // 13 sub-bandas
    suggestions: [...], // Sugestões inteligentes
    granularMetadata: { /* stats */ }
  }),
  
  // Restante do payload...
}
```

### Estrutura `bands` Esperada

```javascript
{
  "sub": {
    "energy_db": -28.3,
    "percentage": 15.2,
    "range": "20-60Hz",
    "name": "Sub",
    "status": "calculated"
  },
  "bass": { /* similar */ },
  "lowMid": { /* similar */ },
  "mid": { /* similar */ },
  "highMid": { /* similar */ },
  "presence": { /* similar */ },
  "air": { /* similar */ }
}
```

### ⚠️ **PROBLEMA CRÍTICO IDENTIFICADO**

**Granular retorna `.groups`, mas frontend/scoring espera `.bands`**

```javascript
// ❌ GRANULAR ATUAL (ERRADO)
{
  algorithm: 'granular_v1',
  groups: {
    sub: { status: 'green', score: 0.0, subBandsCount: 2, description: "..." }
  }
}

// ✅ LEGACY (CORRETO)
{
  bands: {
    sub: { energy_db: -28.3, percentage: 15.2, range: "20-60Hz", name: "Sub", status: "calculated" }
  }
}

// ✅ SOLUÇÃO: Granular deve ter AMBOS
{
  algorithm: 'granular_v1',
  bands: { sub: {...}, bass: {...}, ... }, // ← ADICIONAR
  groups: { sub: {...}, bass: {...}, ... }, // ← manter para compatibilidade interna
  granular: [...],
  suggestions: [...]
}
```

---

## 🚨 ETAPA 4: ANÁLISE DA CONDIÇÃO `[SPECTRAL_BANDS] Condição de acesso falhou`

### Localização Exata

**Arquivo**: `work/api/audio/json-output.js`  
**Linha**: 354  
**Função**: `extractTechnicalData(coreMetrics, reference)`

### Condição que Falha

```javascript
// Linha 192
if (coreMetrics.spectralBands?.bands) {
  const b = coreMetrics.spectralBands;
  // ... extração de bandas
} else {
  // Linha 342-360: ELSE BLOCK (erro)
  const debugInfo = {
    hasSpectralBands: !!coreMetrics.spectralBands,
    spectralBandsKeys: coreMetrics.spectralBands ? Object.keys(coreMetrics.spectralBands) : null,
    hasBands: !!(coreMetrics.spectralBands?.bands),  // ← AQUI: false para granular
    hasAggregated: !!(coreMetrics.spectralBands?.aggregated)
  };
  
  console.warn('⚠️ [SPECTRAL_BANDS] Condição de acesso falhou:', debugInfo);
  // ... retorna null para todas as bandas
}
```

### Por que Falha com Granular V1?

1. **Granular retorna**: `{ algorithm: 'granular_v1', groups: {...}, granular: [...] }`
2. **Condição verifica**: `coreMetrics.spectralBands?.bands`
3. **Resultado**: `undefined` → condição falha
4. **Consequência**: `hasBands = false` → scoring não roda → interface quebra

### Debug Esperado com Granular V1 Atual

```javascript
{
  hasSpectralBands: true,
  spectralBandsKeys: ['algorithm', 'groups', 'granular', 'suggestions', 'referenceGenre', ...],
  hasBands: false,  // ← PROBLEMA!
  hasAggregated: false
}
```

---

## 🔧 ETAPA 5: PONTOS DE INJEÇÃO PARA COMPATIBILIDADE

### **SOLUÇÃO 1: Adicionar `.bands` no retorno do Granular (RECOMENDADO)**

**Arquivo**: `work/lib/audio/features/spectral-bands-granular.js`  
**Função**: `aggregateSubBandsIntoGroups(subBandResults, grouping, severity)`  
**Linha**: ~295 (dentro do loop de grupos)

```javascript
function aggregateSubBandsIntoGroups(subBandResults, grouping, severity) {
  const groups = {};
  const bands = {}; // ← ADICIONAR
  const weights = severity.weights;
  const thresholds = severity.thresholds;

  for (const [groupName, subBandIds] of Object.entries(grouping)) {
    const subBands = subBandResults.filter(s => subBandIds.includes(s.id));

    if (subBands.length === 0) {
      groups[groupName] = {
        status: 'green',
        score: 0.0,
        subBandsCount: 0
      };
      
      // ✅ ADICIONAR: Banda legada compatível
      bands[groupName] = {
        energy_db: null,
        percentage: null,
        range: getFrequencyRangeForGroup(groupName),
        name: formatGroupName(groupName),
        status: 'not_calculated'
      };
      continue;
    }

    // Calcular score médio
    const totalPoints = subBands.reduce((acc, s) => acc + weights[s.status], 0);
    const avgScore = totalPoints / subBands.length;

    // Determinar cor
    let color = 'green';
    if (avgScore > thresholds.yellowMax) color = 'red';
    else if (avgScore > thresholds.greenMax) color = 'yellow';

    groups[groupName] = {
      status: color,
      score: parseFloat(avgScore.toFixed(2)),
      subBandsCount: subBands.length,
      description: `${groupName.replace('_', '-')} ${color === 'green' ? 'ideal' : color === 'yellow' ? 'com desvio moderado' : 'com excesso/falta significativo'}`
    };
    
    // ✅ ADICIONAR: Banda legada compatível
    // Calcular energia média das sub-bandas deste grupo
    const avgEnergyDb = subBands.reduce((sum, s) => sum + s.energyDb, 0) / subBands.length;
    
    // Calcular percentage estimado (pode ser melhorado)
    const totalEnergy = subBandResults.reduce((sum, s) => sum + Math.pow(10, s.energyDb / 10), 0);
    const groupEnergy = subBands.reduce((sum, s) => sum + Math.pow(10, s.energyDb / 10), 0);
    const percentage = (groupEnergy / totalEnergy) * 100;
    
    bands[groupName] = {
      energy_db: parseFloat(avgEnergyDb.toFixed(1)),
      percentage: parseFloat(percentage.toFixed(2)),
      range: getFrequencyRangeForGroup(groupName),
      name: formatGroupName(groupName),
      status: 'calculated'
    };
  }

  return { groups, bands }; // ← RETORNAR AMBOS
}

// ✅ FUNÇÕES AUXILIARES
function getFrequencyRangeForGroup(groupName) {
  const ranges = {
    'sub': '20-60Hz',
    'bass': '60-150Hz',
    'low_mid': '150-500Hz',
    'mid': '500-2000Hz',
    'high_mid': '2000-5000Hz',
    'presence': '5000-10000Hz',
    'air': '10000-20000Hz'
  };
  return ranges[groupName] || 'Unknown';
}

function formatGroupName(groupName) {
  const names = {
    'sub': 'Sub',
    'bass': 'Bass',
    'low_mid': 'Low-Mid',
    'mid': 'Mid',
    'high_mid': 'High-Mid',
    'presence': 'Presence',
    'air': 'Air'
  };
  return names[groupName] || groupName;
}
```

**Modificar função principal**: `analyzeGranularSpectralBands()` → Linha ~237

```javascript
// Linha 234 (antes do return)
const aggregationResult = aggregateSubBandsIntoGroups(subBandResults, grouping, severity);

// Retornar resultado completo
return {
  algorithm: 'granular_v1',
  referenceGenre: reference?.genre || 'techno',
  schemaVersion: reference?.schemaVersion || 1,
  lufsNormalization: true,
  framesProcessed: framesFFT.length,
  aggregationMethod: 'median',
  bands: aggregationResult.bands, // ← ADICIONAR
  groups: aggregationResult.groups, // ← manter
  granular: subBandResults,
  suggestions: suggestions,
  subBandsTotal: subBandResults.length,
  subBandsIdeal: subBandResults.filter(s => s.status === 'ideal').length,
  subBandsAdjust: subBandResults.filter(s => s.status === 'adjust').length,
  subBandsFix: subBandResults.filter(s => s.status === 'fix').length
};
```

### **ALTERNATIVA 2: Modificar json-output.js para aceitar `.groups`**

**Arquivo**: `work/api/audio/json-output.js`  
**Linha**: 192

```javascript
// ❌ ATUAL (apenas .bands)
if (coreMetrics.spectralBands?.bands) {
  const b = coreMetrics.spectralBands;
  // ...
}

// ✅ CORRIGIDO (aceitar .bands OU .groups)
const spectralSource = coreMetrics.spectralBands?.bands || coreMetrics.spectralBands?.groups;

if (spectralSource) {
  const b = coreMetrics.spectralBands;
  const isGranular = b.algorithm === 'granular_v1';
  
  // Converter .groups para formato .bands se necessário
  if (isGranular && !b.bands && b.groups) {
    // Mapear groups → bands
    const convertedBands = {};
    for (const [key, group] of Object.entries(b.groups)) {
      convertedBands[key] = {
        energy_db: null, // Não disponível em groups
        percentage: null, // Calcular se necessário
        range: getFrequencyRangeForGroup(key),
        name: formatGroupName(key),
        status: group.status === 'green' ? 'calculated' : 'adjust'
      };
    }
    technicalData.spectral_balance = convertedBands;
  } else {
    // Usar estrutura .bands normal
    technicalData.spectral_balance = {
      sub: {
        energy_db: safeSanitize(spectralSource.sub?.energy_db),
        percentage: safeSanitize(spectralSource.sub?.percentage),
        // ...
      }
      // ... restante
    };
  }
}
```

**⚠️ Problema**: Esta solução é mais frágil e não resolve o scoring que precisa de `energy_db`.

---

## 📈 ETAPA 6: ROTA DE SCORING

### Como `bands` é Usado no Scoring

**Arquivo**: `work/lib/audio/features/scoring.js`  
**Função**: `computeMixScore(technicalData, reference)`

#### 1. Extração de Valores (linha ~550)

```javascript
if (reference?.spectral_bands) {
  for (const [band, refBand] of Object.entries(reference.spectral_bands)) {
    const val = metrics.spectral_balance?.[band]?.energy_db; // ← PRECISA de energy_db
    
    if (!Number.isFinite(val)) continue; // ← Se null, ignora métrica
    
    // Adicionar métrica ao scoring
    addMetric('tonal', `band_${band}`, val, refBand.target_db, tol);
  }
}
```

#### 2. Cálculo de Score (linha ~405)

```javascript
function addMetric(category, key, value, target, tol, opts = {}) {
  if (!Number.isFinite(value) || value === -Infinity) return; // ← EARLY EXIT
  if (!Number.isFinite(target)) return;
  
  // Calcular score...
  const s = scoreTolerance(value, target, tol);
  
  perMetric.push({ 
    category, 
    key, 
    value, 
    target, 
    tol, 
    score: s 
  });
}
```

### Por que `hasBands: false` Interrompe o Fluxo?

1. **json-output.js (linha 192)**: Condição `if (coreMetrics.spectralBands?.bands)` falha
2. **Consequência**: `technicalData.spectral_balance` recebe valores `null`:
   ```javascript
   {
     sub: { energy_db: null, percentage: null, status: "not_calculated" },
     // ... todas as bandas null
   }
   ```
3. **scoring.js (linha ~550)**: `val = metrics.spectral_balance?.[band]?.energy_db` → `null`
4. **scoring.js (linha 407)**: `if (!Number.isFinite(value))` → `return` (early exit)
5. **Resultado**: Nenhuma métrica de banda adicionada ao scoring
6. **Score final**: Calculado apenas com LUFS, TP, DR, LRA → **incompleto**

### Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────┐
│ core-metrics.js                                             │
│  calculateSpectralBandsMetrics()                            │
│   ├─ engine === 'legacy'                                    │
│   │   └─> { bands: {...}, totalPercentage, valid }  ✅     │
│   │                                                          │
│   └─ engine === 'granular_v1'                               │
│       └─> { groups: {...}, granular: [...] }  ❌ SEM BANDS │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────────┐
│ json-output.js                                              │
│  extractTechnicalData()                                     │
│   if (coreMetrics.spectralBands?.bands) {  ← FALHA         │
│     // Extrai bandas                                        │
│   } else {                                                  │
│     technicalData.spectral_balance = {                     │
│       sub: { energy_db: null, ... }  ← NULLS               │
│     }                                                        │
│     hasBands: false  ← MARCA COMO FALHA                    │
│   }                                                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────────┐
│ scoring.js                                                  │
│  computeMixScore(technicalData, reference)                 │
│   const val = metrics.spectral_balance?.[band]?.energy_db; │
│   // val = null                                             │
│                                                              │
│   if (!Number.isFinite(val)) return;  ← EARLY EXIT         │
│                                                              │
│   // Banda NÃO É ADICIONADA ao scoring                     │
│   // Score calculado SEM bandas espectrais                 │
└─────────────────────────────────────────────────────────────┘
                   │
                   v
         ❌ SCORE INCOMPLETO
         ❌ UI NÃO EXIBE BANDAS
```

---

## 📦 ETAPA 7: PAYLOAD FINAL

### Estrutura Atual (Legacy)

```javascript
{
  "score": 85.3,
  "classification": "Profissional",
  "bands": {
    "sub": { "energy_db": -28.3, "percentage": 15.2, "range": "20-60Hz", "name": "Sub", "status": "calculated" },
    "bass": { "energy_db": -29.1, "percentage": 22.5, "range": "60-150Hz", "name": "Bass", "status": "calculated" },
    // ... 5 bandas restantes
  },
  "technicalData": {
    "spectral_balance": { /* mesmo que bands */ }
  }
}
```

### Estrutura Desejada (Granular V1)

```javascript
{
  "score": 85.3,
  "classification": "Profissional",
  
  // ✅ BANDAS PRINCIPAIS (compatível com legacy)
  "bands": {
    "sub": { "energy_db": -28.5, "percentage": 14.8, "range": "20-60Hz", "name": "Sub", "status": "calculated" },
    "bass": { "energy_db": -29.2, "percentage": 23.1, "range": "60-150Hz", "name": "Bass", "status": "calculated" },
    // ... 5 bandas restantes
  },
  
  // ✅ CAMPOS ADITIVOS GRANULAR
  "engineVersion": "granular_v1",
  "granular": [
    {
      "id": "sub_low",
      "range": [20, 40],
      "energyDb": -28.3,
      "target": -28.0,
      "deviation": -0.3,
      "deviationSigmas": 0.2,
      "status": "ideal"
    },
    {
      "id": "sub_high",
      "range": [40, 60],
      "energyDb": -32.1,
      "target": -29.0,
      "deviation": -3.1,
      "deviationSigmas": 2.07,
      "status": "adjust"
    }
    // ... 11 sub-bandas restantes
  ],
  "suggestions": [
    {
      "priority": "high",
      "freq_range": [40, 60],
      "type": "boost",
      "amount": 2.5,
      "metric": "frequency_balance",
      "deviation": -3.1,
      "message": "Falta energia em 40–60 Hz — reforçar ~2.5 dB (harmônicos do kick)."
    }
    // ... outras sugestões
  ],
  "granularMetadata": {
    "referenceGenre": "techno",
    "schemaVersion": 1,
    "framesProcessed": 1028,
    "subBandsTotal": 13,
    "subBandsIdeal": 9,
    "subBandsAdjust": 2,
    "subBandsFix": 2
  },
  
  "technicalData": {
    "spectral_balance": { /* mesmo que bands */ }
  }
}
```

### Onde Inserir no Código

**Arquivo**: `work/api/audio/json-output.js`  
**Função**: `buildFinalJSON(technicalData, scoringResult, metadata, coreMetrics, reference)`  
**Linha**: 755-804

```javascript
return {
  score: scoringResult.scorePct,
  classification: scoringResult.classification,
  
  // ✅ Bandas principais (sempre presentes)
  bands: technicalData.spectral_balance,
  
  // ✅ Campos aditivos (já implementado, mas só funciona se bands existir)
  ...(coreMetrics.spectralBands?.algorithm === 'granular_v1' && {
    engineVersion: coreMetrics.spectralBands.algorithm,
    granular: coreMetrics.spectralBands.granular || [],
    suggestions: coreMetrics.spectralBands.suggestions || [],
    granularMetadata: {
      referenceGenre: coreMetrics.spectralBands.referenceGenre,
      schemaVersion: coreMetrics.spectralBands.schemaVersion,
      lufsNormalization: coreMetrics.spectralBands.lufsNormalization,
      framesProcessed: coreMetrics.spectralBands.framesProcessed,
      aggregationMethod: coreMetrics.spectralBands.aggregationMethod,
      subBandsTotal: coreMetrics.spectralBands.subBandsTotal,
      subBandsIdeal: coreMetrics.spectralBands.subBandsIdeal,
      subBandsAdjust: coreMetrics.spectralBands.subBandsAdjust,
      subBandsFix: coreMetrics.spectralBands.subBandsFix
    }
  }),
  
  // Restante do payload...
}
```

---

## 🛠️ ETAPA 8: PLANO DE IMPLEMENTAÇÃO SEGURO

### **PASSO 1: Adicionar Cálculo de `.bands` no Granular**

**Arquivo**: `work/lib/audio/features/spectral-bands-granular.js`  
**Linha**: ~270 (função `aggregateSubBandsIntoGroups`)

**O que fazer**:
1. Adicionar variável `const bands = {};` no início da função
2. Dentro do loop de grupos, calcular `energy_db` e `percentage`
3. Adicionar funções auxiliares `getFrequencyRangeForGroup()` e `formatGroupName()`
4. Retornar `{ groups, bands }` em vez de apenas `groups`

**Teste**:
```bash
node work/tests/spectral-bands-granular.test.js
```

**Validação**: Resultado deve ter `.bands` com 7 chaves e valores numéricos.

---

### **PASSO 2: Atualizar Chamada em `analyzeGranularSpectralBands`**

**Arquivo**: `work/lib/audio/features/spectral-bands-granular.js`  
**Linha**: ~234

**O que fazer**:
```javascript
// Antes
const groups = aggregateSubBandsIntoGroups(subBandResults, grouping, severity);

return {
  // ...
  groups: groups,
  // ...
};

// Depois
const { groups, bands } = aggregateSubBandsIntoGroups(subBandResults, grouping, severity);

return {
  // ...
  bands: bands,  // ← ADICIONAR
  groups: groups,
  // ...
};
```

**Teste**: Mesmo teste anterior deve passar com `.bands` presente.

---

### **PASSO 3: Atualizar Testes Unitários**

**Arquivo**: `work/tests/spectral-bands-granular.test.js`  
**Linha**: ~141

**O que fazer**:
```javascript
// Adicionar validação de .bands
assert(result.bands, 'Deve ter campo bands');
assert(Object.keys(result.bands).length === 7, 'Bands deve ter 7 chaves');
assert(result.bands.sub, 'Deve ter banda sub');
assert(Number.isFinite(result.bands.sub.energy_db), 'Sub deve ter energy_db numérico');
assert(Number.isFinite(result.bands.sub.percentage), 'Sub deve ter percentage numérico');
```

---

### **PASSO 4: Teste de Regressão (Legacy vs Granular)**

**Criar arquivo**: `work/tests/regression-legacy-vs-granular.test.js`

```javascript
import { calculateCoreMetrics } from '../api/audio/core-metrics.js';

async function testRegressionLegacyVsGranular() {
  // Mock de áudio
  const mockSegmentedAudio = {
    framesFFT: [
      // ... frames mocados
    ]
  };

  // 1. Executar legacy
  process.env.ANALYZER_ENGINE = 'legacy';
  const legacyResult = await calculateCoreMetrics(mockSegmentedAudio);

  // 2. Executar granular
  process.env.ANALYZER_ENGINE = 'granular_v1';
  const granularResult = await calculateCoreMetrics(mockSegmentedAudio);

  // 3. Comparar estruturas
  console.log('✅ TESTE DE REGRESSÃO');
  console.log('');
  console.log('Legacy:');
  console.log('  - Tem .bands:', !!legacyResult.spectralBands.bands);
  console.log('  - Chaves bands:', Object.keys(legacyResult.spectralBands.bands || {}));
  console.log('');
  console.log('Granular:');
  console.log('  - Tem .bands:', !!granularResult.spectralBands.bands);
  console.log('  - Chaves bands:', Object.keys(granularResult.spectralBands.bands || {}));
  console.log('  - Tem .groups:', !!granularResult.spectralBands.groups);
  console.log('  - Tem .granular:', !!granularResult.spectralBands.granular);
  console.log('  - Tem .suggestions:', !!granularResult.spectralBands.suggestions);

  // 4. Validar compatibilidade
  assert(granularResult.spectralBands.bands, 'Granular deve ter .bands');
  assert(Object.keys(granularResult.spectralBands.bands).length === 7, 'Granular.bands deve ter 7 chaves');
  
  // 5. Comparar energy_db
  const legacySubEnergy = legacyResult.spectralBands.bands.sub.energy_db;
  const granularSubEnergy = granularResult.spectralBands.bands.sub.energy_db;
  const diff = Math.abs(legacySubEnergy - granularSubEnergy);
  
  console.log('');
  console.log('Comparação energy_db (sub):');
  console.log('  - Legacy:', legacySubEnergy);
  console.log('  - Granular:', granularSubEnergy);
  console.log('  - Diferença:', diff.toFixed(2), 'dB');
  
  // Tolerância de 3 dB (aceitável devido a métodos diferentes)
  assert(diff < 3.0, `Diferença em sub.energy_db deve ser < 3 dB (atual: ${diff.toFixed(2)})`);
}

testRegressionLegacyVsGranular().catch(err => {
  console.error('❌ Erro no teste de regressão:', err);
  process.exit(1);
});
```

**Executar**:
```bash
node work/tests/regression-legacy-vs-granular.test.js
```

---

### **PASSO 5: Teste de Scoring**

**Criar arquivo**: `work/tests/scoring-with-granular.test.js`

```javascript
import { computeMixScore } from '../lib/audio/features/scoring.js';
import referenceData from '../../references/techno.v1.json';

function testScoringWithGranular() {
  // Mock technicalData com structure granular
  const technicalData = {
    lufsIntegrated: -12.5,
    truePeakDbtp: -1.2,
    spectral_balance: {
      sub: { energy_db: -28.5, percentage: 14.8, status: 'calculated' },
      bass: { energy_db: -29.2, percentage: 23.1, status: 'calculated' },
      low_mid: { energy_db: -32.1, percentage: 18.3, status: 'calculated' },
      mid: { energy_db: -34.5, percentage: 16.2, status: 'calculated' },
      high_mid: { energy_db: -36.8, percentage: 14.5, status: 'calculated' },
      presence: { energy_db: -38.2, percentage: 10.1, status: 'calculated' },
      air: { energy_db: -42.5, percentage: 3.0, status: 'calculated' }
    }
  };

  // Executar scoring
  const result = computeMixScore(technicalData, referenceData);

  console.log('✅ TESTE DE SCORING COM GRANULAR');
  console.log('');
  console.log('Score:', result.scorePct);
  console.log('Classification:', result.classification);
  console.log('Métricas processadas:', result.perMetric.length);
  console.log('');
  console.log('Bandas no scoring:');
  const bandMetrics = result.perMetric.filter(m => m.key.startsWith('band_'));
  bandMetrics.forEach(m => {
    console.log(`  - ${m.key}: value=${m.value}, target=${m.target}, score=${m.scorePct}%`);
  });

  // Validações
  assert(result.scorePct > 0, 'Score deve ser > 0');
  assert(bandMetrics.length === 7, 'Deve ter processado 7 bandas');
  assert(bandMetrics.every(m => Number.isFinite(m.value)), 'Todas as bandas devem ter valores numéricos');
}

testScoringWithGranular();
```

**Executar**:
```bash
node work/tests/scoring-with-granular.test.js
```

---

### **PASSO 6: Validação de Sintaxe**

```bash
# Validar arquivos modificados
npx eslint work/lib/audio/features/spectral-bands-granular.js
npx eslint work/tests/spectral-bands-granular.test.js
```

---

### **PASSO 7: Deploy em Staging**

1. Commit das alterações:
```bash
git add work/lib/audio/features/spectral-bands-granular.js
git add work/tests/spectral-bands-granular.test.js
git add work/tests/regression-legacy-vs-granular.test.js
git add work/tests/scoring-with-granular.test.js
git commit -m "feat(granular): add .bands field for frontend/scoring compatibility"
```

2. Deploy em staging:
```bash
git push origin staging
```

3. Ativar granular_v1 em staging:
```bash
# .env em staging
ANALYZER_ENGINE=granular_v1
```

4. Processar 10-20 tracks e validar:
   - ✅ Payload tem `bands` com 7 chaves
   - ✅ Score é calculado corretamente
   - ✅ UI exibe bandas
   - ✅ Não há erros no console

---

### **PASSO 8: Rollback (se necessário)**

```bash
# .env
ANALYZER_ENGINE=legacy
```

**Ou reverter commit**:
```bash
git revert HEAD
git push origin staging
```

---

## 🎯 ETAPA 9: GARANTIA DE COMPATIBILIDADE

### Checklist Final

#### ✅ Com Granular V1 Ativo

- [ ] `bands` aparece no payload
- [ ] `bands` tem 7 chaves: sub, bass, low_mid, mid, high_mid, presence, air
- [ ] Cada banda tem: `energy_db`, `percentage`, `range`, `name`, `status`
- [ ] `energy_db` é numérico e finito
- [ ] `percentage` é numérico e finito
- [ ] `computeMixScore` processa as 7 bandas
- [ ] `hasBands = true` no log
- [ ] UI exibe bandas corretamente
- [ ] Score é calculado com bandas espectrais
- [ ] Campos aditivos presentes: `engineVersion`, `granular`, `suggestions`

#### ✅ Com Legacy Ativo (Rollback)

- [ ] `ANALYZER_ENGINE=legacy` retorna ao comportamento original
- [ ] `bands` continua aparecendo
- [ ] Estrutura idêntica ao sistema anterior
- [ ] Nenhum campo `granular` ou `suggestions` presente
- [ ] Score idêntico ao anterior
- [ ] Logs não mostram nenhuma referência a granular_v1

---

## 📌 RESPOSTA FINAL

> **"Qual é o mínimo conjunto de alterações necessárias para que o granular_v1 funcione no front com score e bandas visíveis, mantendo rollback instantâneo via flag?"**

### Resposta Técnica

**ÚNICA MODIFICAÇÃO NECESSÁRIA**: Adicionar campo `.bands` ao retorno do módulo granular.

**Arquivos a modificar**: 1 (um)

**Linhas a adicionar**: ~80 linhas (incluindo funções auxiliares)

**Tempo estimado**: 30 minutos

---

### Implementação Mínima

**Arquivo**: `work/lib/audio/features/spectral-bands-granular.js`

**Modificações**:

1. **Função `aggregateSubBandsIntoGroups` (linha ~270)**:
   - Adicionar cálculo de `energy_db` e `percentage` para cada grupo
   - Retornar `{ groups, bands }` em vez de apenas `groups`

2. **Função `analyzeGranularSpectralBands` (linha ~234)**:
   - Desestruturar retorno: `const { groups, bands } = aggregateSubBandsIntoGroups(...)`
   - Adicionar `bands` ao objeto de retorno

3. **Funções auxiliares (fim do arquivo, ~linha 420)**:
   ```javascript
   function getFrequencyRangeForGroup(groupName) { /* ... */ }
   function formatGroupName(groupName) { /* ... */ }
   ```

**Total**: ~80 linhas de código em 1 arquivo.

---

### Por Que Esta Solução é Mínima e Segura?

1. **Isolada**: Modifica apenas o módulo granular, zero impacto no legacy
2. **Aditiva**: Adiciona `.bands` sem remover `.groups` (compatibilidade interna mantida)
3. **Reversível**: Feature flag `ANALYZER_ENGINE=legacy` desativa instantaneamente
4. **Compatível**: `.bands` tem mesma estrutura que o legacy espera
5. **Testável**: Pode ser validada com testes unitários antes do deploy

---

### Fluxo Pós-Implementação

```
┌─────────────────────────────────────────────────────────────┐
│ ANALYZER_ENGINE=granular_v1                                 │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────────┐
│ calculateGranularSubBands()                                 │
│  └─> analyzeGranularSpectralBands()                        │
│       └─> aggregateSubBandsIntoGroups()                    │
│            └─> { groups: {...}, bands: {...} }  ✅         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────────┐
│ Retorno para core-metrics.js                               │
│  {                                                           │
│    algorithm: 'granular_v1',                                │
│    bands: { sub: {energy_db, percentage, ...}, ... },  ✅  │
│    groups: { sub: {status, score, ...}, ... },             │
│    granular: [...],                                         │
│    suggestions: [...]                                       │
│  }                                                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────────┐
│ json-output.js                                              │
│  if (coreMetrics.spectralBands?.bands) {  ✅ PASSA         │
│    technicalData.spectral_balance = {                      │
│      sub: { energy_db: -28.5, percentage: 14.8 },  ✅     │
│      // ... 6 bandas restantes                             │
│    }                                                         │
│    hasBands: true  ✅                                       │
│  }                                                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────────┐
│ scoring.js                                                  │
│  const val = metrics.spectral_balance?.[band]?.energy_db;  │
│  // val = -28.5  ✅                                         │
│                                                              │
│  addMetric('tonal', 'band_sub', -28.5, -28.0, 1.5);  ✅   │
│  // Score calculado COM bandas espectrais  ✅              │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   v
         ✅ SCORE COMPLETO
         ✅ UI EXIBE BANDAS
         ✅ SUGESTÕES DISPONÍVEIS
```

---

### Conclusão

**Problema identificado**: Granular retorna `.groups` mas frontend/scoring espera `.bands`.

**Solução**: Adicionar cálculo de `.bands` no módulo granular (80 linhas em 1 arquivo).

**Resultado**: Sistema 100% compatível com legacy, score correto, UI funcional, rollback instantâneo.

**Próximo passo**: Implementar PASSO 1 do plano acima e executar testes de validação.

---

**🎯 FIM DA AUDITORIA**
