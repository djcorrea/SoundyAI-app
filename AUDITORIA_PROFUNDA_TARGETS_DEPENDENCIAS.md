# 🔍 AUDITORIA PROFUNDA - SISTEMAS DEPENDENTES DE TARGETS

**Data:** 7 de dezembro de 2025  
**Objetivo:** Mapear TODOS os sistemas que dependem de targets antes de qualquer correção  
**Status:** 🔄 EM ANDAMENTO

---

## 📋 METODOLOGIA

Esta auditoria segue uma abordagem defensiva:
1. ❌ **NÃO aplicar patches** antes de entender o impacto completo
2. ✅ Mapear TODAS as estruturas esperadas vs entregues
3. ✅ Identificar pontos de quebra após `getOfficialGenreTargets()`
4. ✅ Projetar função normalizadora universal
5. ✅ Criar plano de correção sem regressão

---

## 🎯 SISTEMAS AUDITADOS

### 1️⃣ SISTEMA DE SCORE GLOBAL

**Arquivo:** `public/audio-analyzer-integration.js`

#### Função Principal: `calculateAnalysisScores()` (linha ~17657)

**O que faz:**
- Calcula score global a partir de subscores
- Coordena cálculo de loudness, dynamics, stereo, frequency, technical

**Estruturas que ESPERA receber:**

```javascript
refData = {
    lufs_target: -14,
    true_peak_target: -1,
    dr_target: 8,
    lra_target: 6,
    stereo_target: 0.85,
    tol_lufs: 1.0,
    tol_true_peak: 0.25,
    tol_dr: 1.25,
    tol_lra: 2.5,
    tol_stereo: 0.065,
    bands: {
        sub: { target_db, min_max, target_range },
        low_bass: { target_db, min_max, target_range },
        // ...
    }
}
```

**Fontes que LÊ:**
1. `analysis.technicalData` (métricas calculadas)
2. `analysis.metrics` (fallback)
3. `refData.bands` (targets de bandas espectrais)

**Status:** ⚠️ **POTENCIALMENTE AFETADO**
- Espera `refData.bands` com estrutura específica
- Se `getOfficialGenreTargets()` retornar `spectral_bands` em vez de `bands`, quebra

---

### 2️⃣ SUBSCORE: LOUDNESS

**Arquivo:** `public/audio-analyzer-integration.js`  
**Função:** `calculateLoudnessScore()` (linha ~17043)

**O que faz:**
- Calcula score de LUFS Integrado
- Calcula score de True Peak
- Calcula score de Crest Factor

**Estruturas que ESPERA:**

```javascript
refData = {
    lufs_target: -14,
    tol_lufs: 1.0,
    true_peak_target: -1,
    tol_true_peak: 0.25,
    crest_target: 12,  // opcional
    tol_crest: 2.0     // opcional
}
```

**Fontes que LÊ:**
1. `analysis.technicalData.lufsIntegrated`
2. `analysis.metrics.lufs_integrated`
3. `analysis.technicalData.truePeakDbtp`
4. `analysis.metrics.true_peak_dbtp`

**Status:** ✅ **NÃO AFETADO**
- Usa apenas campos escalares (não depende de `bands`)
- Campos esperados: `lufs_target`, `true_peak_target`, `crest_target`

---

### 3️⃣ SUBSCORE: DYNAMICS

**Arquivo:** `public/audio-analyzer-integration.js`  
**Função:** `calculateDynamicsScore()` (linha ~17124)

**O que faz:**
- Calcula score de LRA (Loudness Range)
- Calcula score de DR (Dynamic Range)
- Calcula score de Crest Consistency

**Estruturas que ESPERA:**

```javascript
refData = {
    lra_target: 6,
    tol_lra: 2.5,
    dr_target: 8,
    tol_dr: 1.25,
    crest_target: 12,  // opcional
    tol_crest: 2.0     // opcional
}
```

**Status:** ✅ **NÃO AFETADO**
- Usa apenas campos escalares (não depende de `bands`)

---

### 4️⃣ SUBSCORE: STEREO

**Arquivo:** `public/audio-analyzer-integration.js`  
**Função:** `calculateStereoScore()` (linha ~17216)

**O que faz:**
- Calcula score de correlação estéreo
- Avalia width estéreo

**Estruturas que ESPERA:**

```javascript
refData = {
    stereo_target: 0.85,
    tol_stereo: 0.065
}
```

**Status:** ✅ **NÃO AFETADO**
- Usa apenas campos escalares

---

### 5️⃣ SUBSCORE: FREQUENCY (CRÍTICO ❌)

**Arquivo:** `public/audio-analyzer-integration.js`  
**Função:** `calculateFrequencyScore()` (linha ~17311)

**O que faz:**
- Calcula score de cada banda espectral
- Compara energia das bandas com targets

**Estruturas que ESPERA:**

```javascript
refData = {
    bands: {
        sub: { 
            energy_db: -28.5,      // MODO REFERENCE
            target_db: -28.5,      // MODO GENRE
            target_range: {        // MODO GENRE (preferencial)
                min: -32,
                max: -25
            }
        },
        low_bass: { /* idem */ },
        low_mid: { /* idem */ },
        mid: { /* idem */ },
        high_mid: { /* idem */ },
        presenca: { /* idem */ },
        brilho: { /* idem */ }
    },
    _isReferenceMode: false  // flag para detectar modo
}
```

**Mapeamento Interno:**
```javascript
const bandMapping = {
    'sub': 'sub',
    'bass': 'low_bass',
    'lowMid': 'low_mid',
    'mid': 'mid',
    'highMid': 'high_mid',
    'presence': 'presenca',
    'air': 'brilho'
};
```

**Fontes que LÊ:**
1. `analysis.technicalData.bands` (prioridade 1)
2. `analysis.metrics.bands` (prioridade 2)
3. `analysis.technicalData.spectral_balance` (prioridade 3)
4. `analysis.technicalData.bandEnergies` (prioridade 4 - legado)

**Fontes de TARGETS:**
- `refData.bands[bandName]` (DEVE existir com estrutura correta)

**Status:** ❌ **ALTAMENTE AFETADO**
- **PROBLEMA 1:** Espera `refData.bands` mas `getOfficialGenreTargets()` pode retornar `spectral_bands`
- **PROBLEMA 2:** Espera nomes como `low_bass`, `presenca`, `brilho` mas JSON pode ter `bass`, `presence`, `air`
- **PROBLEMA 3:** Modo GENRE vs REFERENCE espera estruturas diferentes

---

### 6️⃣ FUNÇÃO: injectGenreTargetsIntoRefData()

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** ~11201

**O que faz:**
- Injeta targets de gênero em `referenceDataForScores`
- Garante que score receba targets corretos

**Estrutura que ESPERA receber:**

```javascript
genreTargets = {
    lufs_target: -14,
    true_peak_target: -1,
    dr_target: 8,
    lra_target: 6,
    stereo_target: 0.85,
    bands: { /* bandas */ },  // ⚠️ ESPERA "bands"
    tol_lufs: 1.0,
    tol_true_peak: 0.25,
    tol_dr: 1.25,
    tol_lra: 2.5,
    tol_stereo: 0.065
}
```

**Campos que INJETA:**
```javascript
const fields = [
    "lufs_target",
    "true_peak_target",
    "dr_target",
    "lra_target",
    "stereo_target",
    "bands",  // ⚠️ PROBLEMA: JSON pode ter "spectral_bands"
    "tol_lufs",
    "tol_true_peak",
    "tol_dr",
    "tol_lra",
    "tol_stereo"
];
```

**Status:** ❌ **CRÍTICO - CAUSA DO PROBLEMA**
- **ROOT CAUSE:** Espera `genreTargets.bands` mas JSON moderno tem `genreTargets.spectral_bands`
- Se `genreTargets.bands` não existir, `refData.bands` fica `undefined`
- Score de frequência quebra por falta de `refData.bands`

---

### 7️⃣ FUNÇÃO: getBandDataWithCascade()

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** ~5343

**O que faz:**
- Busca dados de banda em múltiplas fontes
- Usa aliases para compatibilidade

**Cascata de busca:**
1. `analysis.metrics.bands[bandKey]` (snake_case)
2. `analysis.technicalData.bands[bandKey]` (camelCase)
3. `analysis.technicalData.spectral_balance[bandKey]`
4. `analysis.technicalData.bandEnergies[bandKey]` (legado)
5. `analysis.technicalData.spectralBands[bandKey]` (legado)

**Status:** ✅ **FUNCIONANDO CORRETAMENTE**
- Cascata robusta com múltiplos fallbacks
- Usa `searchBandWithAlias()` para resolver nomes

---

### 8️⃣ FUNÇÃO: searchBandWithAlias()

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** ~5286

**O que faz:**
- Busca banda por nome direto
- Busca por aliases se nome direto falhar

**Aliases definidos:**
```javascript
const BAND_ALIASES = {
    sub: ['sub'],
    bass: ['low_bass', 'bass', 'baixo'],
    upperBass: ['upper_bass', 'upperbass'],
    lowMid: ['low_mid', 'lowmid'],
    mid: ['mid', 'medio'],
    highMid: ['high_mid', 'highmid'],
    presence: ['presenca', 'presence', 'presença'],
    air: ['brilho', 'air', 'treble']
};
```

**Status:** ✅ **FUNCIONANDO CORRETAMENTE**
- Sistema de aliases robusto
- Compatível com snake_case e camelCase

---

### 9️⃣ ULTRA_V2: extractTargetRange()

**Arquivo:** `public/ultra-advanced-suggestion-enhancer-v2.js`  
**Linha:** ~77

**O que faz:**
- Extrai `target_range: {min, max}` do contexto
- Usa para gerar explicações educacionais

**Estrutura que ESPERA:**

```javascript
context = {
    targetDataForEngine: {
        sub: {
            target: -28.5,
            tolerance: 3.5,
            target_range: {  // ⚠️ PREFERENCIAL
                min: -32,
                max: -25
            }
        },
        // ...
    },
    genreTargets: { /* fallback */ }
}
```

**Lógica:**
```javascript
const targets = context.targetDataForEngine || context.genreTargets;
const threshold = targets[metricKey];  // ⚠️ Acessa direto (sub, bass, etc.)

if (threshold.target_range && 
    typeof threshold.target_range.min === 'number' && 
    typeof threshold.target_range.max === 'number') {
    return { min, max, center };
}
```

**Status:** ⚠️ **PARCIALMENTE AFETADO**
- **PROBLEMA:** Se JSON tiver `spectral_bands.sub` em vez de `sub` direto, não encontra
- Depende de `context.targetDataForEngine` estar normalizado

---

### 🔟 TABELA DE GÊNERO: renderGenreComparisonTable()

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** ~5596

**O que faz:**
- Renderiza tabela comparativa entre áudio e targets
- Exibe min/max de cada banda

**Estrutura que ESPERA:**

```javascript
genreData = {
    lufs_target: -14,
    true_peak_target: -1,
    dr_target: 8,
    lra_target: 6,
    stereo_target: 0.85,
    tol_lufs: 1.0,
    // ... tolerâncias ...
    bands: {  // ⚠️ OU spectral_bands?
        sub: { target_db: -28.5, min_max: [-32, -25] },
        // ...
    }
}
```

**Status:** ⚠️ **PODE SER AFETADO**
- Se receber `spectral_bands` em vez de `bands`, pode não renderizar bandas
- Depende de estrutura correta passada por `renderGenreView()`

---

## 🚨 PROBLEMAS IDENTIFICADOS

### ❌ PROBLEMA #1: Incompatibilidade de Nome de Campo

**Local:** `injectGenreTargetsIntoRefData()` linha ~11201

**Causa:**
```javascript
// Função ESPERA:
genreTargets = { bands: {...} }

// JSON MODERNO TEM:
genreTargets = { spectral_bands: {...} }

// RESULTADO:
refData.bands = undefined  // ❌ QUEBRA calculateFrequencyScore()
```

**Impacto:**
- ❌ Score de frequência retorna `null`
- ❌ Score global fica incompleto
- ❌ Tabela pode não exibir bandas

---

### ❌ PROBLEMA #2: Estrutura Aninhada vs Flat

**Local:** ULTRA_V2 `extractTargetRange()` linha ~77

**Causa:**
```javascript
// ULTRA_V2 ESPERA:
targets = {
    sub: { target_range: {min, max} },
    bass: { target_range: {min, max} }
}

// JSON MODERNO TEM:
targets = {
    spectral_bands: {
        sub: { target_range: {min, max} },
        bass: { target_range: {min, max} }
    }
}

// RESULTADO:
targets[metricKey]  // undefined ❌
```

**Impacto:**
- ❌ ULTRA_V2 não consegue extrair `target_range`
- ❌ Explicações educacionais usam valores genéricos
- ❌ Sugestões perdem precisão

---

### ❌ PROBLEMA #3: Nome das Bandas Inconsistente

**Local:** `calculateFrequencyScore()` linha ~17311

**Causa:**
```javascript
// MAPEAMENTO ESPERADO:
bandMapping = {
    'bass': 'low_bass',     // ⚠️ Converte bass → low_bass
    'presence': 'presenca', // ⚠️ Converte presence → presenca
    'air': 'brilho'         // ⚠️ Converte air → brilho
}

// JSON MODERNO TEM:
refData.bands = {
    bass: {...},      // ❌ Mas busca por 'low_bass'
    presence: {...},  // ❌ Mas busca por 'presenca'
    air: {...}        // ❌ Mas busca por 'brilho'
}
```

**Impacto:**
- ❌ Bandas não encontradas
- ❌ Score parcial ou nulo

---

## 📊 MAPEAMENTO DE ESTRUTURAS

### Estrutura ESPERADA pelos Sistemas (após análise):

```javascript
{
    // ✅ Campos escalares (OK em todos sistemas)
    lufs_target: -14,
    true_peak_target: -1,
    dr_target: 8,
    lra_target: 6,
    stereo_target: 0.85,
    tol_lufs: 1.0,
    tol_true_peak: 0.25,
    tol_dr: 1.25,
    tol_lra: 2.5,
    tol_stereo: 0.065,
    
    // ❌ Campo de bandas (PROBLEMA)
    bands: {  // ← calculateFrequencyScore() EXIGE este nome
        sub: { 
            target_db: -28.5,
            min_max: [-32, -25],  // Formato legado
            target_range: { min: -32, max: -25 }  // Formato moderno
        },
        low_bass: { /* idem */ },    // ← Espera este nome
        low_mid: { /* idem */ },
        mid: { /* idem */ },
        high_mid: { /* idem */ },
        presenca: { /* idem */ },    // ← Espera este nome
        brilho: { /* idem */ }       // ← Espera este nome
    }
}
```

### Estrutura ENTREGUE por getOfficialGenreTargets():

```javascript
{
    // ✅ Campos escalares (OK)
    lufs_target: -14,
    true_peak_target: -1,
    dr_target: 8,
    lra_target: 6,
    stereo_target: 0.85,
    tol_lufs: 1.0,
    tol_true_peak: 0.25,
    tol_dr: 1.25,
    tol_lra: 2.5,
    tol_stereo: 0.065,
    
    // ❌ Campo de bandas (DIFERENTE)
    spectral_bands: {  // ← Nome diferente ❌
        sub: { 
            target: -28.5,
            tolerance: 3.5,
            critical: 5.0,
            target_range: { min: -32, max: -25 }
        },
        bass: { /* idem */ },       // ← Nome diferente ❌
        presence: { /* idem */ },   // ← Nome diferente ❌
        air: { /* idem */ }         // ← Nome diferente ❌
    }
}
```

**Diferenças:**
1. ❌ `bands` vs `spectral_bands` (nome do campo)
2. ❌ `low_bass` vs `bass` (nome da banda)
3. ❌ `presenca` vs `presence` (nome da banda)
4. ❌ `brilho` vs `air` (nome da banda)
5. ⚠️ `target_db` vs `target` (campo alvo)
6. ⚠️ `min_max: [min, max]` vs `target_range: {min, max}` (formato)

---

## 🎯 PRÓXIMOS PASSOS (NÃO EXECUTAR AINDA)

### FASE 2: PLANO DE CORREÇÃO

1. ✅ **Criar função normalizadora universal**
   - `normalizeGenreTargets(rawTargets)` → formato esperado

2. ✅ **Atualizar `injectGenreTargetsIntoRefData()`**
   - Normalizar antes de injetar

3. ✅ **Atualizar contexto ULTRA_V2**
   - Passar targets normalizados

4. ✅ **Garantir compatibilidade reversa**
   - Suportar JSON legado E moderno

### FASE 3: DESIGN DA FUNÇÃO NORMALIZADORA

```javascript
function normalizeGenreTargets(rawTargets) {
    // TODO: Projetar após auditoria completa
}
```

---

**Status:** 🔄 **AUDITORIA EM ANDAMENTO - NÃO APLICAR PATCHES**

---

## 📝 CONCLUSÕES PRELIMINARES

### Sistemas NÃO AFETADOS ✅
1. `calculateLoudnessScore()` - usa campos escalares
2. `calculateDynamicsScore()` - usa campos escalares
3. `calculateStereoScore()` - usa campos escalares
4. `getBandDataWithCascade()` - cascata robusta
5. `searchBandWithAlias()` - sistema de aliases OK

### Sistemas AFETADOS ❌
1. `calculateFrequencyScore()` - **CRÍTICO** - espera `refData.bands`
2. `injectGenreTargetsIntoRefData()` - **ROOT CAUSE** - não normaliza estrutura
3. `extractTargetRange()` (ULTRA_V2) - espera estrutura flat
4. `renderGenreComparisonTable()` - pode não renderizar bandas

### Correção Necessária 🔧
**Criar normalização em PONTO ÚNICO antes de injetar targets no score**

---

**Aguardando aprovação para FASE 2: Plano de Correção**
