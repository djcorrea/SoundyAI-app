# 🚨 AUDITORIA COMPLETA: ROOT CAUSE - DIVERGÊNCIA ENTRE TABELA E SUGESTÕES

**Data**: 2025-12-07  
**Objetivo**: Identificar por que sugestões usam valores diferentes da tabela  
**Status**: ✅ **CAUSA RAIZ ENCONTRADA**

---

## 🎯 SINTOMA RELATADO

### Problema Observado
```
Na tabela, o SUB está:
- valor = –20.5 dB
- target_range = –32 a –25 dB
- diff correto = +4.5 dB

Porém a sugestão enriquecida diz que está OK ou que a diferença é outra.
```

### Logs do Backend (Corretos)
```javascript
genreTargets.low_bass.target_range: { min: -31, max: -25 }
genreTargets.low_bass.target_db: -28
genreTargets.low_bass.energy_pct: 24.8
```

### Conclusão do Usuário
> "O cálculo da sugestão e o cálculo da tabela estão usando fontes diferentes."

---

## 🔍 MAPA COMPLETO DO FLUXO DE DADOS

### FASE 1: Carregamento dos Targets (Backend)

**Arquivo**: `work/lib/audio/utils/genre-targets-loader.js`

#### Função `loadGenreTargets(genre)` (linha 46)
```javascript
// 1. Normaliza nome do gênero (ex: "Funk Mandela" → "funk_mandela")
const normalizedGenre = normalizeGenreName(genre);

// 2. Verifica cache
if (targetsCache.has(normalizedGenre)) {
    return targetsCache.get(normalizedGenre);
}

// 3. Carrega JSON do filesystem
const jsonPath = path.resolve(__dirname, '../../../../public/refs/out', `${normalizedGenre}.json`);

// 4. Extrai targets (prioriza legacy_compatibility)
const rawTargets = genreData.legacy_compatibility || genreData.hybrid_processing || genreData;

// 5. Converte para formato interno
const convertedTargets = convertToInternalFormat(rawTargets, normalizedGenre);
```

#### Função `convertToInternalFormat(rawTargets, genre)` (linha 264)
```javascript
const converted = {};

// Converter LUFS
if (isFiniteNumber(rawTargets.lufs_target)) {
    converted.lufs = {
        target: rawTargets.lufs_target,
        tolerance: rawTargets.tol_lufs || 2.5,
        critical: (rawTargets.tol_lufs || 2.5) * 1.5
    };
}

// Converter True Peak, DR, Stereo...

// 🎼 BANDAS ESPECTRAIS - PONTO CRÍTICO!
if (rawTargets.bands && typeof rawTargets.bands === 'object') {
    for (const [bandKey, bandData] of Object.entries(rawTargets.bands)) {
        const internalBandName = BAND_MAPPING[bandKey] || bandKey;
        
        // ❌ PROBLEMA: Adiciona DIRETO no objeto converted, não em converted.bands!
        converted[internalBandName] = {
            target: target,
            tolerance: tolerance,
            critical: tolerance * 1.5,
            target_range: bandData.target_range || null  // ✅ target_range é preservado aqui
        };
    }
}

return converted;
```

#### Estrutura REAL Retornada
```javascript
{
  // Métricas principais
  lufs: { target: -10.5, tolerance: 2.5, critical: 3.75 },
  truePeak: { target: -1.0, tolerance: 1.0, critical: 1.5 },
  dr: { target: 9.0, tolerance: 3.0, critical: 4.5 },
  stereo: { target: 0.85, tolerance: 0.25, critical: 0.375 },
  
  // ❌ BANDAS DIRETO NO NÍVEL RAIZ (não em .bands!)
  sub: { 
    target: -33, 
    tolerance: 1.75, 
    critical: 2.625, 
    target_range: { min: -38, max: -28 } 
  },
  low_bass: { 
    target: -28, 
    tolerance: 1.75, 
    critical: 2.625, 
    target_range: { min: -32, max: -24 } 
  },
  bass: { ... },
  // ... todas as outras bandas DIRETO no raiz
}
```

---

### FASE 2: Pipeline de Análise (Backend)

**Arquivo**: `work/api/audio/pipeline-complete.js`

#### Carregamento do `customTargets` (linha 375)
```javascript
// Modo genre: carregar targets do filesystem
if (mode !== 'reference' && detectedGenre && detectedGenre !== 'default') {
    customTargets = await loadGenreTargets(detectedGenre);  // ✅ Retorna estrutura sem .bands
    
    console.log('[TARGET-DEBUG] customTargets keys:', Object.keys(customTargets));
    // Output: ["lufs", "truePeak", "dr", "stereo", "sub", "low_bass", "bass", ...]
}
```

#### Geração de Sugestões (linha 991/1009)
```javascript
// Sistema avançado de sugestões
finalJSON.suggestions = generateAdvancedSuggestionsFromScoring(
    coreMetrics,           // ✅ Contém spectralBands com valores corretos
    coreMetrics.scoring,   // ✅ Contém penalties
    genre,                 // ✅ Nome do gênero
    mode,                  // ✅ "genre"
    customTargets          // ❌ PROBLEMA: Estrutura sem .bands
);
```

---

### FASE 3: Geração de Sugestões (Backend)

**Arquivo**: `work/api/audio/pipeline-complete.js`

#### Função `generateAdvancedSuggestionsFromScoring()` (linha 1621)
```javascript
function generateAdvancedSuggestionsFromScoring(technicalData, scoring, genre, mode, genreTargets) {
    console.log(`[ADVANCED-SUGGEST] genreTargets disponíveis: ${genreTargets ? 'SIM' : 'NÃO'}`);
    
    const suggestions = [];
    const penalties = scoring?.penalties || [];
    
    for (const penalty of penalties) {
        const { key, n, status, severity } = penalty;
        
        // Pular métricas OK
        if (status === 'OK') continue;
        
        const isBand = !knowledge && (bandKnowledge[key] || key.includes('_db'));
        
        if (isBand) {
            // 🔧 BANDA ESPECTRAL - PONTO CRÍTICO!
            const bandKey = key.replace('_db', '');
            const bandData = getBandValue(technicalData, bandKey, genreTargets);  // ❌ AQUI!
            
            if (!bandData) continue;
            
            const { value, targetMin, targetMax } = bandData;
            // ... construir sugestão com targetMin e targetMax
        }
    }
    
    return suggestions;
}
```

#### Função `getBandValue()` (linha 2026) - **🚨 ROOT CAUSE EXATA**
```javascript
function getBandValue(technicalData, bandKey, genreTargets) {
    const bands = technicalData.spectralBands;
    if (!bands || !bands[bandKey]) return null;
    
    const bandData = bands[bandKey];
    const value = bandData.energy_db;  // ✅ Valor CORRETO de -20.5 dB
    if (!Number.isFinite(value)) return null;
    
    let targetMin, targetMax;
    
    // 🎯 TENTATIVA DE LER TARGET RANGE REAL
    if (genreTargets?.bands?.[bandKey]?.target_range) {  // ❌ SEMPRE FALSE!
        targetMin = genreTargets.bands[bandKey].target_range.min;
        targetMax = genreTargets.bands[bandKey].target_range.max;
        console.log(`[ADVANCED-SUGGEST] ✅ Usando range REAL para ${bandKey}: [${targetMin}, ${targetMax}]`);
    } else {
        // ❌ FALLBACK HARDCODED (SEMPRE EXECUTADO!)
        const fallbackRanges = {
            sub: { min: -38, max: -28 },
            bass: { min: -31, max: -25 },
            low_bass: { min: -32, max: -24 },  // ❌ VALORES GENÉRICOS!
            upper_bass: { min: -33, max: -26 },
            // ... outros fallbacks
        };
        const range = fallbackRanges[bandKey];
        if (!range) return null;
        targetMin = range.min;  // ❌ USA FALLBACK EM VEZ DO REAL
        targetMax = range.max;  // ❌ USA FALLBACK EM VEZ DO REAL
    }
    
    return { value, targetMin, targetMax };
}
```

---

## 🚨 CAUSA RAIZ IDENTIFICADA

### Problema 1: Estrutura Incompatível

**O que `loadGenreTargets()` retorna:**
```javascript
{
  lufs: {...},
  sub: { target_range: { min: -38, max: -28 } },      // ❌ Banda no nível RAIZ
  low_bass: { target_range: { min: -32, max: -24 } }  // ❌ Banda no nível RAIZ
}
```

**O que `getBandValue()` espera:**
```javascript
{
  lufs: {...},
  bands: {  // ❌ NÃO EXISTE!
    sub: { target_range: { min: -38, max: -28 } },
    low_bass: { target_range: { min: -32, max: -24 } }
  }
}
```

### Problema 2: Condição Sempre Falha

**Linha 2037 do `pipeline-complete.js`:**
```javascript
if (genreTargets?.bands?.[bandKey]?.target_range) {
    // ❌ NUNCA ENTRA AQUI porque genreTargets.bands NÃO EXISTE
}
```

### Problema 3: Fallback Sempre Executado

**Linha 2042-2059:**
```javascript
else {
    // ❌ SEMPRE CAI AQUI - USA VALORES HARDCODED GENÉRICOS
    const fallbackRanges = {
        sub: { min: -38, max: -28 },
        low_bass: { min: -32, max: -24 },  // ← Valores diferentes do JSON!
        // ...
    };
}
```

---

## 📊 FLUXO DETALHADO DO PROBLEMA

### Exemplo Concreto: Banda `low_bass`

#### 1. Backend Carrega JSON Correto
```javascript
// public/refs/out/funk_mandela.json
{
  "funk_mandela": {
    "legacy_compatibility": {
      "bands": {
        "low_bass": {
          "target_db": -28,
          "target_range": { "min": -31, "max": -25 },  // ✅ VALORES CORRETOS
          "tol_db": 1.75
        }
      }
    }
  }
}
```

#### 2. `convertToInternalFormat()` Achata Estrutura
```javascript
converted["low_bass"] = {
  target: -28,
  tolerance: 1.75,
  critical: 2.625,
  target_range: { min: -31, max: -25 }  // ✅ Preservado mas no nível errado
};

// Retorna:
{
  lufs: {...},
  low_bass: { target_range: { min: -31, max: -25 } }  // ❌ No nível raiz, não em .bands
}
```

#### 3. `getBandValue()` Procura no Lugar Errado
```javascript
// technicalData.spectralBands.low_bass.energy_db = -20.5 dB ✅
// genreTargets.low_bass.target_range = { min: -31, max: -25 } ✅

// MAS o código procura:
if (genreTargets?.bands?.low_bass?.target_range) {  // ❌ .bands não existe!
    // Nunca entra aqui
}

// Então usa fallback:
targetMin = -32;  // ❌ Diferente de -31 do JSON
targetMax = -24;  // ❌ Diferente de -25 do JSON
```

#### 4. Sugestão Gerada com Valores Errados
```javascript
// Valor real: -20.5 dB
// Range correto do JSON: [-31, -25]
// Range usado (fallback): [-32, -24]

// Cálculo com range correto:
// -20.5 está ACIMA de -25 (máximo)
// Diferença: -20.5 - (-25) = +4.5 dB ✅ CORRETO

// Cálculo com fallback:
// -20.5 está ACIMA de -24 (máximo do fallback)
// Diferença: -20.5 - (-24) = +3.5 dB ❌ INCORRETO
```

---

## 🗺️ MAPA VISUAL DO FLUXO

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CARREGAMENTO DE TARGETS (Backend)                        │
├─────────────────────────────────────────────────────────────┤
│ loadGenreTargets("funk_mandela")                            │
│   ↓                                                          │
│ ✅ Lê: public/refs/out/funk_mandela.json                    │
│   ↓                                                          │
│ ✅ Extrai: legacy_compatibility.bands.low_bass              │
│   {                                                          │
│     target_db: -28,                                          │
│     target_range: { min: -31, max: -25 } ✅                 │
│   }                                                          │
│   ↓                                                          │
│ convertToInternalFormat()                                    │
│   ↓                                                          │
│ ❌ Retorna estrutura ACHATADA:                              │
│   {                                                          │
│     lufs: {...},                                             │
│     low_bass: { target_range: { min: -31, max: -25 } }     │
│   }                                                          │
│   (Não tem .bands!)                                          │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. PIPELINE DE ANÁLISE (Backend)                            │
├─────────────────────────────────────────────────────────────┤
│ const customTargets = await loadGenreTargets(genre);        │
│   ↓                                                          │
│ ✅ customTargets = { lufs, low_bass, ... } (sem .bands)    │
│   ↓                                                          │
│ generateAdvancedSuggestionsFromScoring(..., customTargets)  │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. GERAÇÃO DE SUGESTÕES (Backend)                           │
├─────────────────────────────────────────────────────────────┤
│ getBandValue(technicalData, "low_bass", genreTargets)       │
│   ↓                                                          │
│ ✅ Lê valor correto: energy_db = -20.5 dB                  │
│   ↓                                                          │
│ ❌ TENTA LER: genreTargets.bands.low_bass.target_range     │
│    (mas .bands não existe!)                                  │
│   ↓                                                          │
│ ❌ CAI NO FALLBACK HARDCODED:                               │
│    targetMin = -32 (deveria ser -31)                         │
│    targetMax = -24 (deveria ser -25)                         │
│   ↓                                                          │
│ ❌ Calcula delta com valores errados                        │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. RESULTADO FINAL                                           │
├─────────────────────────────────────────────────────────────┤
│ Sugestão gerada:                                             │
│   currentValue: "-20.5 dB" ✅                               │
│   targetRange: "-32 a -24 dB" ❌ (deveria ser -31 a -25)   │
│   delta: "+3.5 dB" ❌ (deveria ser +4.5)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔎 CONFIRMAÇÃO DA CAUSA RAIZ

### Por que a tabela mostra valores corretos?

A **tabela** lê `data.genreTargets` que vem do backend:
```javascript
// Frontend: normalizeBackendAnalysisData()
data: {
    genreTargets: data.data?.genreTargets ||  // ✅ Estrutura original do JSON
                  result?.data?.genreTargets ||
                  null
}
```

A tabela acessa:
```javascript
genreTargets.low_bass.target_range.min  // ✅ -31 (correto)
genreTargets.low_bass.target_range.max  // ✅ -25 (correto)
```

### Por que as sugestões mostram valores errados?

As **sugestões** são geradas por `getBandValue()` que:
1. Recebe `customTargets` retornado por `loadGenreTargets()`
2. Tenta acessar `customTargets.bands.low_bass` (não existe)
3. Cai no fallback hardcoded com valores genéricos

---

## 📝 RESUMO EXECUTIVO

### Causa Raiz Única
**`convertToInternalFormat()` achata a estrutura de bandas no nível raiz, mas `getBandValue()` espera que as bandas estejam em `genreTargets.bands`.**

### Ponto Exato da Falha
**Arquivo**: `work/api/audio/pipeline-complete.js`  
**Linha**: 2037  
**Código**:
```javascript
if (genreTargets?.bands?.[bandKey]?.target_range) {
    // ❌ NUNCA ENTRA AQUI - genreTargets.bands não existe
}
```

### Consequência
- ✅ `technicalData.spectralBands.low_bass.energy_db` = -20.5 dB (correto)
- ✅ `genreTargets.low_bass.target_range` = { min: -31, max: -25 } (existe mas não é acessado)
- ❌ Código usa fallback: { min: -32, max: -24 } (valores genéricos)
- ❌ Sugestão mostra range incorreto e delta incorreto

### Por que os Logs Mostram Dados Corretos?
Os logs mostram `genreTargets.low_bass.target_range: { min: -31, max: -25 }` porque o objeto **existe** e está correto, mas o código está **procurando no caminho errado** (`genreTargets.bands.low_bass` em vez de `genreTargets.low_bass`).

---

## ✅ VALIDAÇÃO DA AUDITORIA

### Fontes de Divergência Identificadas

| Item | Fonte para Tabela | Fonte para Sugestão | Diverge? |
|------|-------------------|---------------------|----------|
| **Valor atual** | `spectralBands.low_bass.energy_db` | `spectralBands.low_bass.energy_db` | ✅ NÃO |
| **Target range** | `genreTargets.low_bass.target_range` | Fallback hardcoded | ❌ SIM |
| **Delta** | Calculado com range correto | Calculado com fallback | ❌ SIM |

### Confirmação Final
- ✅ O sistema está pegando o valor atual do lugar correto
- ❌ O sistema está pegando o target range do lugar errado (fallback)
- ✅ O merge Redis/Postgres está correto (não é o problema)
- ✅ O `genreTargets` chega correto no pipeline (estrutura é o problema)

---

## 🎯 SOLUÇÃO NECESSÁRIA (NÃO IMPLEMENTADA)

### Opção 1: Corrigir Acesso no `getBandValue()`
Mudar linha 2037 de:
```javascript
if (genreTargets?.bands?.[bandKey]?.target_range) {
```
Para:
```javascript
if (genreTargets?.[bandKey]?.target_range) {  // ✅ Sem .bands
```

### Opção 2: Corrigir Estrutura no `convertToInternalFormat()`
Criar sub-objeto `bands`:
```javascript
converted.bands = converted.bands || {};
converted.bands[internalBandName] = {
    target: target,
    tolerance: tolerance,
    critical: tolerance * 1.5,
    target_range: bandData.target_range || null
};
```

---

## 📌 CONCLUSÃO

**ROOT CAUSE CONFIRMADO**:  
A função `getBandValue()` procura bandas em `genreTargets.bands[bandKey]`, mas a função `convertToInternalFormat()` coloca as bandas diretamente em `genreTargets[bandKey]`, causando falha na condição e forçando uso de valores hardcoded genéricos em vez dos valores específicos do gênero.

**O valor correto existe no sistema, mas não é acessado devido a incompatibilidade estrutural entre loader e consumer.**
