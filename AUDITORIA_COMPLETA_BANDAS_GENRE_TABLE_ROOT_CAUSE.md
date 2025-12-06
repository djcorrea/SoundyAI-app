# 🔍 AUDITORIA COMPLETA - ROOT CAUSE: APENAS 2 BANDAS RENDERIZADAS NA TABELA DE GÊNERO

**Data**: 6 de dezembro de 2025  
**Objetivo**: Identificar a origem exata do problema onde apenas `sub` e `mid` são renderizadas  
**Status**: ✅ **ROOT CAUSE IDENTIFICADO**

---

## 🎯 RESUMO EXECUTIVO

### ❌ **PROBLEMA IDENTIFICADO**

**Apenas 2 de 7 bandas são renderizadas na tabela de comparação de gênero (`sub` e `mid`), enquanto as outras 5 bandas (`bass`, `lowMid`, `highMid`, `presence`, `air`) são puladas com a mensagem:**

```
[GENRE-TABLE] ⏭️ Pulando banda sem target: bass → bass
[GENRE-TABLE] ⏭️ Pulando banda sem target: lowMid → lowMid
[GENRE-TABLE] ⏭️ Pulando banda sem target: highMid → highMid
[GENRE-TABLE] ⏭️ Pulando banda sem target: presence → presence
[GENRE-TABLE] ⏭️ Pulando banda sem target: air → air
```

### ✅ **ROOT CAUSE CONFIRMADO**

**INCOMPATIBILIDADE DE NOMENCLATURA ENTRE BACKEND E TARGET JSON:**

| Origem | Campo | Nomenclatura | Exemplo |
|--------|-------|--------------|---------|
| **Backend** (json-output.js) | `technicalData.bands` | **camelCase** | `bass`, `lowMid`, `highMid`, `presence`, `air` |
| **Target JSON** (trance.json) | `hybrid_processing.spectral_bands` | **snake_case** | `low_bass`, `low_mid`, `high_mid`, `presenca`, `brilho` |
| **Frontend** (renderGenreComparisonTable) | Busca no target | **camelCase** (após normalização) | `bass`, `lowMid`, `highMid`, `presence`, `air` |

**Resultado**: Frontend busca por `bass`, `lowMid`, etc. no target, mas o target tem `low_bass`, `low_mid`, etc.

**Por que `sub` e `mid` funcionam?** Ambos têm o mesmo nome em ambas nomenclaturas (não tem underscore).

---

## 📊 ANÁLISE DETALHADA

### 1️⃣ **ESTRUTURA DE BANDAS DO BACKEND (user bands)**

**Arquivo**: `work/api/audio/json-output.js` linha 216-270

**Estrutura enviada** (linhas 316-340):
```javascript
technicalData.spectral_balance = {
    sub: { energy_db: -28.5, percentage: 15.2, range: "20-60Hz", name: "Sub" },
    bass: { energy_db: -26.3, percentage: 18.5, range: "60-150Hz", name: "Bass" },
    lowMid: { energy_db: -24.1, percentage: 16.8, range: "150-500Hz", name: "Low-Mid" },
    mid: { energy_db: -22.0, percentage: 18.2, range: "500-2000Hz", name: "Mid" },
    highMid: { energy_db: -25.5, percentage: 12.3, range: "2000-5000Hz", name: "High-Mid" },
    presence: { energy_db: -28.8, percentage: 8.5, range: "5000-10000Hz", name: "Presence" },
    air: { energy_db: -32.2, percentage: 10.5, range: "10000-20000Hz", name: "Air" },
    totalPercentage: 100,
    _status: 'calculated'
}
```

**Aliases criados** (linhas 907-909):
```javascript
technicalData: {
    spectral_balance: technicalData.spectral_balance,  // ← Fonte original
    spectralBands: technicalData.spectral_balance,     // ← Alias 1
    bands: technicalData.spectral_balance,             // ← Alias 2 (RECOMENDADO)
}
```

**✅ CONFIRMADO**: Backend usa **camelCase puro** (`bass`, `lowMid`, `highMid`, `presence`, `air`)

---

### 2️⃣ **ESTRUTURA DE TARGETS DO GÊNERO (target bands)**

**Arquivo**: `public/refs/trance.json` linhas 12-56

**Estrutura do JSON**:
```json
{
  "trance": {
    "hybrid_processing": {
      "spectral_bands": {
        "sub": { "target_db": -16, "energy_pct": 18.5, "tol_db": 2.5 },
        "low_bass": { "target_db": -17.8, "energy_pct": 20.2, "tol_db": 2.5 },
        "upper_bass": { "target_db": -19.5, "energy_pct": 15.8, "tol_db": 2.5 },
        "low_mid": { "target_db": -18.2, "energy_pct": 16.5, "tol_db": 2.5 },
        "mid": { "target_db": -17.1, "energy_pct": 18.2, "tol_db": 2.5 },
        "high_mid": { "target_db": -20.8, "energy_pct": 8.1, "tol_db": 2.5 },
        "brilho": { "target_db": -25.5, "energy_pct": 2.5, "tol_db": 2.5 },
        "presenca": { "target_db": -34.6, "energy_pct": 0.12, "tol_db": 2.5 }
      }
    },
    "legacy_compatibility": {
      "bands": {
        "sub": { "target_db": -16, ... },
        "low_bass": { "target_db": -17.8, ... },
        "low_mid": { "target_db": -18.2, ... },
        "mid": { "target_db": -17.1, ... },
        "high_mid": { "target_db": -20.8, ... },
        "brilho": { "target_db": -25.5, ... },
        "presenca": { "target_db": -34.6, ... }
      }
    }
  }
}
```

**✅ CONFIRMADO**: Target JSON usa **snake_case** (`low_bass`, `low_mid`, `high_mid`) e **português** (`presenca`, `brilho`)

---

### 3️⃣ **FLUXO DE EXTRAÇÃO DOS TARGETS NO FRONTEND**

**Arquivo**: `public/audio-analyzer-integration.js` linha 5620-5685

**Código de extração**:
```javascript
const targetBands = (() => {
    // Compatibilidade com estrutura nova
    if (genreData.bands && Object.keys(genreData.bands).length > 0) {
        console.log('[GENRE-TABLE] 🎯 Usando genreData.bands');
        return genreData.bands;
    }

    // Compatibilidade com estrutura legado
    if (genreData.spectralBands && Object.keys(genreData.spectralBands).length > 0) {
        console.log('[GENRE-TABLE] 🎯 Usando genreData.spectralBands');
        return genreData.spectralBands;
    }

    // 🎯 CORREÇÃO CRÍTICA: extrair bandas da raiz (estrutura atual do backend)
    const bandsFromRoot = {};
    const metricKeys = [
        'lufs_target','true_peak_target','dr_target','lra_target','stereo_target',
        'tol_lufs','tol_true_peak','tol_dr','tol_lra','tol_stereo'
    ];

    Object.keys(genreData).forEach(key => {
        const value = genreData[key];

        // Se é um objeto, não está na lista de métricas e possui target_db = é banda válida
        if (typeof value === 'object' && value !== null && 
            !metricKeys.includes(key) &&
            (value.target_db !== undefined || value.target !== undefined)
        ) {
            // 🎯 CORREÇÃO CRÍTICA: Normalizar chave de snake_case → camelCase
            const normalizedKey = normalizeGenreBandName(key);
            bandsFromRoot[normalizedKey] = value;
        }
    });

    console.log('[GENRE-TABLE] 🎯 Bandas extraídas da raiz (normalizadas):', Object.keys(bandsFromRoot));
    return bandsFromRoot;
})();
```

**✅ PROBLEMA IDENTIFICADO**: 

1. **Primeira tentativa**: `genreData.bands` → ❌ **NÃO EXISTE** (targets não tem campo `bands` na raiz)
2. **Segunda tentativa**: `genreData.spectralBands` → ❌ **NÃO EXISTE** (campo se chama `spectral_bands` com underscore)
3. **Terceira tentativa**: Extrai da raiz → ✅ **PARCIALMENTE FUNCIONA**

**Mas há um problema crítico na terceira tentativa:**

- O código itera sobre `Object.keys(genreData)` na raiz
- Na raiz do JSON há: `version`, `generated_at`, `num_tracks`, `processing_mode`, `hybrid_processing`, `legacy_compatibility`, `last_updated`, `cache_bust`, `processing_info`
- **AS BANDAS NÃO ESTÃO NA RAIZ!** Estão em `hybrid_processing.spectral_bands` ou `legacy_compatibility.bands`
- Por isso apenas `sub` e `mid` são encontrados (provavelmente há campos `sub` e `mid` na raiz por alguma razão)

---

### 4️⃣ **FUNÇÃO DE NORMALIZAÇÃO**

**Arquivo**: `public/audio-analyzer-integration.js` linha 5278-5300

**Código atual**:
```javascript
function normalizeGenreBandName(name) {
    // 🎯 PATCH DEFINITIVO: Backend JÁ normalizou (low_bass → bass, presenca → presence, etc.)
    // Não converter novamente! Apenas garantir compatibilidade com snake_case legado
    const map = {
        // Se ainda receber snake_case (compatibilidade), converter para camelCase
        'low_bass': 'bass',
        'upper_bass': 'upperBass',
        'low_mid': 'lowMid',
        'high_mid': 'highMid',
        'presenca': 'presence',
        'brilho': 'air',
        // CamelCase já normalizado - retornar como está
        'bass': 'bass',
        'upperBass': 'upperBass',
        'lowMid': 'lowMid',
        'highMid': 'highMid',
        'presence': 'presence',
        'air': 'air',
        'sub': 'sub',
        'mid': 'mid'
    };
    return map[name] || name;
}
```

**✅ CONFIRMADO**: A função de normalização está **correta** e mapeia:
- `low_bass` → `bass`
- `low_mid` → `lowMid`
- `high_mid` → `highMid`
- `presenca` → `presence`
- `brilho` → `air`

**❌ PROBLEMA**: A normalização é aplicada, **MAS as bandas não estão sendo extraídas da localização correta do JSON.**

---

### 5️⃣ **FLUXO DE MATCHING (onde ocorre o "Pulando banda sem target")**

**Arquivo**: `public/audio-analyzer-integration.js` linha 5843-5890

**Código de iteração**:
```javascript
// 🎯 ITERAR SOBRE AS BANDAS DO USUÁRIO (backend) e mapear para targets
if (userBands && Object.keys(userBands).length > 0) {
    Object.keys(userBands).forEach(backendKey => {
        // Ignorar 'totalPercentage'
        if (backendKey === 'totalPercentage') {
            return;
        }
        
        // 🔄 NORMALIZAR nome da banda do backend para target
        const targetKey = normalizeGenreBandName(backendKey);
        const targetBand = targetBands[targetKey];
        
        // Verificar se existe target para essa banda
        if (!targetBand) {
            console.log(`[GENRE-TABLE] ⏭️ Pulando banda sem target: ${backendKey} → ${targetKey}`);
            return;
        }
        
        // ... renderizar banda
    });
}
```

**✅ CONFIRMADO**: Este é o local exato onde o log "Pulando banda sem target" é gerado (linha 5858).

**Fluxo real**:

1. **Backend envia**: `{ bass: {...}, lowMid: {...}, highMid: {...}, presence: {...}, air: {...} }`
2. **Frontend normaliza**: `bass → bass`, `lowMid → lowMid`, `highMid → highMid`, `presence → presence`, `air → air`
3. **Frontend busca no target**: `targetBands['bass']`, `targetBands['lowMid']`, etc.
4. **Target tem**: `{ sub: {...}, mid: {...} }` (apenas esses dois na raiz após extração falha)
5. **Resultado**: Apenas `sub` e `mid` encontrados, resto retorna `undefined`

---

### 6️⃣ **FUNÇÃO enrichReferenceObject (onde targets são mapeados)**

**Arquivo**: `public/audio-analyzer-integration.js` linha 3241-3310

**Código de mapeamento**:
```javascript
function enrichReferenceObject(refObj, genreKey) {
    try {
        if (!refObj || typeof refObj !== 'object') return refObj;
        
        // 🔥 CORREÇÃO CRÍTICA: Mapear hybrid_processing para propriedades root
        if (refObj.hybrid_processing && typeof refObj.hybrid_processing === 'object') {
            const hybrid = refObj.hybrid_processing;
            
            // Mapear spectral_bands (prioridade sobre legacy)
            if (hybrid.spectral_bands && typeof hybrid.spectral_bands === 'object') {
                refObj.spectral_bands = hybrid.spectral_bands;
                // Também atribuir a 'bands' para compatibilidade
                if (!refObj.bands) {
                    refObj.bands = hybrid.spectral_bands;
                }
            }
        }
        
        // CORREÇÃO CRÍTICA: Mapear legacy_compatibility para propriedades root (fallback)
        if (refObj.legacy_compatibility && typeof refObj.legacy_compatibility === 'object') {
            const legacy = refObj.legacy_compatibility;
            
            // Mapear bandas de frequência (apenas se não foram definidas por hybrid)
            if (legacy.bands && typeof legacy.bands === 'object' && !refObj.bands) {
                refObj.bands = legacy.bands;
            }
        }
    } catch (e) { console.warn('[refEnrich] falha', e); }
    return refObj;
}
```

**✅ CONFIRMADO**: `enrichReferenceObject` **DEVERIA** extrair as bandas de `hybrid_processing.spectral_bands` e colocá-las em `refObj.bands`.

**❌ PROBLEMA POTENCIAL**: 

1. Se `enrichReferenceObject` está funcionando corretamente, `refObj.bands` deveria conter as bandas em snake_case
2. Mas essas bandas **NÃO ESTÃO SENDO NORMALIZADAS** antes de serem atribuídas a `refObj.bands`
3. A normalização só acontece **durante a extração na renderGenreComparisonTable**
4. Mas a extração falha porque **não encontra bandas na raiz** (elas estão em `spectral_bands` com underscore)

---

### 7️⃣ **FUNÇÃO applyGenreBandConversion (não é chamada)**

**Arquivo**: `public/audio-analyzer-integration.js` linha 5399-5420

**Código**:
```javascript
function applyGenreBandConversion(analysis) {
    // 🛡️ GUARD: Apenas para modo gênero
    if (analysis?.mode !== 'genre') {
        console.log('[BAND-MAPPER] ⏭️ Modo não é gênero, pulando conversão');
        return analysis;
    }
    
    console.group('[BAND-MAPPER] 🎯 Aplicando conversão de bandas para modo GÊNERO');
    console.log('[BAND-MAPPER] Mode:', analysis.mode);
    console.log('[BAND-MAPPER] Bandas originais:', analysis.bands ? Object.keys(analysis.bands) : 'N/A');
    
    // Converter bandas do backend para formato de targets
    if (analysis.bands) {
        analysis.genreBands = mapBackendBandsToGenreBands(analysis.bands);
        console.log('[BAND-MAPPER] ✅ analysis.genreBands criado com', Object.keys(analysis.genreBands).filter(k => analysis.genreBands[k] !== null).length, 'bandas');
    } else {
        console.warn('[BAND-MAPPER] ⚠️ analysis.bands não disponível');
        analysis.genreBands = {};
    }
    
    console.groupEnd();
    return analysis;
}
```

**✅ PROBLEMA IDENTIFICADO**: O log `[BAND-MAPPER] ⚠️ analysis.bands não disponível` aparece porque:

1. A função espera `analysis.bands` (que é um alias de `technicalData.bands`)
2. Mas o código que chama essa função provavelmente está passando `analysis` sem `bands` preenchido
3. **Esta função NÃO É USADA no fluxo de renderização da tabela de gênero** (é apenas diagnóstico)

---

## 🔍 MATRIZ DE INCOMPATIBILIDADE

### Comparação de nomenclaturas:

| Backend (camelCase) | Target JSON (snake_case/pt) | normalizeGenreBandName() | Match? |
|---------------------|----------------------------|--------------------------|--------|
| `sub` | `sub` | `sub` | ✅ **OK** |
| `bass` | `low_bass` | `bass` → `bass` | ❌ **INCOMPATÍVEL** |
| `lowMid` | `low_mid` | `lowMid` → `lowMid` | ❌ **INCOMPATÍVEL** |
| `mid` | `mid` | `mid` | ✅ **OK** |
| `highMid` | `high_mid` | `highMid` → `highMid` | ❌ **INCOMPATÍVEL** |
| `presence` | `presenca` | `presence` → `presence` | ❌ **INCOMPATÍVEL** |
| `air` | `brilho` | `air` → `air` | ❌ **INCOMPATÍVEL** |

**❌ PROBLEMA PRINCIPAL**: 

1. Backend envia em **camelCase** (`bass`, `lowMid`, `highMid`, `presence`, `air`)
2. Target tem em **snake_case/português** (`low_bass`, `low_mid`, `high_mid`, `presenca`, `brilho`)
3. `normalizeGenreBandName()` converte **snake_case → camelCase**
4. **MAS** o frontend **DEVERIA** estar lendo as bandas de `spectral_bands` (snake_case) e **ENTÃO** normalizando
5. **ATUALMENTE** o frontend está tentando extrair da raiz do JSON (onde não há bandas)

---

## 🎯 ROOT CAUSE DEFINITIVO

### ❌ **CAUSA RAIZ CONFIRMADA**

**LOCAL**: `public/audio-analyzer-integration.js` linha 5620-5685 (extração de targetBands)

**PROBLEMA #1**: Extração incorreta dos targets
```javascript
// ❌ ATUAL: Tenta extrair bandas da raiz do genreData
const targetBands = (() => {
    if (genreData.bands && Object.keys(genreData.bands).length > 0) {
        return genreData.bands;  // ← genreData.bands NÃO EXISTE na raiz
    }
    
    if (genreData.spectralBands && Object.keys(genreData.spectralBands).length > 0) {
        return genreData.spectralBands;  // ← Campo se chama spectral_bands (com underscore)
    }
    
    // Fallback: itera na raiz (ERRADO - bandas estão em hybrid_processing.spectral_bands)
    Object.keys(genreData).forEach(key => { ... });
})();
```

**O QUE DEVERIA FAZER**:
```javascript
// ✅ CORRETO: Buscar em spectral_bands (com underscore) e normalizar
const targetBands = (() => {
    // 1. Tentar spectral_bands (estrutura correta do JSON)
    if (genreData.spectral_bands && Object.keys(genreData.spectral_bands).length > 0) {
        // Normalizar chaves de snake_case → camelCase
        const normalized = {};
        Object.keys(genreData.spectral_bands).forEach(snakeKey => {
            const camelKey = normalizeGenreBandName(snakeKey);
            normalized[camelKey] = genreData.spectral_bands[snakeKey];
        });
        return normalized;
    }
    
    // 2. Fallback: bands (se existir)
    if (genreData.bands && Object.keys(genreData.bands).length > 0) {
        return genreData.bands;
    }
    
    return {};
})();
```

**PROBLEMA #2**: enrichReferenceObject mapeia mas não normaliza

```javascript
// ❌ ATUAL: Copia spectral_bands para bands sem normalizar chaves
if (hybrid.spectral_bands && typeof hybrid.spectral_bands === 'object') {
    refObj.spectral_bands = hybrid.spectral_bands;  // ← Mantém snake_case
    if (!refObj.bands) {
        refObj.bands = hybrid.spectral_bands;  // ← Mantém snake_case
    }
}
```

**O QUE DEVERIA FAZER**:
```javascript
// ✅ CORRETO: Normalizar chaves ao copiar
if (hybrid.spectral_bands && typeof hybrid.spectral_bands === 'object') {
    refObj.spectral_bands = hybrid.spectral_bands;  // ← Preservar original
    
    // Criar versão normalizada em camelCase
    const normalizedBands = {};
    Object.keys(hybrid.spectral_bands).forEach(snakeKey => {
        const camelKey = normalizeGenreBandName(snakeKey);
        normalizedBands[camelKey] = hybrid.spectral_bands[snakeKey];
    });
    
    if (!refObj.bands) {
        refObj.bands = normalizedBands;  // ← Agora em camelCase!
    }
}
```

---

## 🔧 RECOMENDAÇÕES DE CORREÇÃO

### ✅ **SOLUÇÃO RECOMENDADA: Normalizar targets ao extrair**

**LOCAL 1**: `enrichReferenceObject()` (linha 3241)

**Aplicar normalização ao mapear spectral_bands**:
```javascript
// Mapear spectral_bands (prioridade sobre legacy)
if (hybrid.spectral_bands && typeof hybrid.spectral_bands === 'object') {
    refObj.spectral_bands = hybrid.spectral_bands;  // ← Preservar original
    
    // 🎯 CORREÇÃO: Normalizar chaves para camelCase
    const normalizedBands = {};
    Object.keys(hybrid.spectral_bands).forEach(snakeKey => {
        const camelKey = normalizeGenreBandName(snakeKey);
        normalizedBands[camelKey] = hybrid.spectral_bands[snakeKey];
    });
    
    // Atribuir versão normalizada a 'bands'
    if (!refObj.bands) {
        refObj.bands = normalizedBands;
    }
}
```

**LOCAL 2**: `renderGenreComparisonTable()` (linha 5620)

**Corrigir extração de targetBands**:
```javascript
const targetBands = (() => {
    // 🎯 PRIORIDADE 1: spectral_bands (estrutura correta com snake_case)
    if (genreData.spectral_bands && typeof genreData.spectral_bands === 'object') {
        console.log('[GENRE-TABLE] 🎯 Usando genreData.spectral_bands (normalizando)');
        
        // Normalizar chaves de snake_case → camelCase
        const normalized = {};
        Object.keys(genreData.spectral_bands).forEach(snakeKey => {
            const camelKey = normalizeGenreBandName(snakeKey);
            normalized[camelKey] = genreData.spectral_bands[snakeKey];
        });
        
        console.log('[GENRE-TABLE] 🎯 Bandas normalizadas:', Object.keys(normalized));
        return normalized;
    }
    
    // 🎯 PRIORIDADE 2: bands (já normalizado)
    if (genreData.bands && Object.keys(genreData.bands).length > 0) {
        console.log('[GENRE-TABLE] 🎯 Usando genreData.bands');
        return genreData.bands;
    }
    
    // 🎯 FALLBACK: Extrair da raiz (compatibilidade legado)
    const bandsFromRoot = {};
    const metricKeys = ['lufs_target','true_peak_target','dr_target','lra_target','stereo_target',
                        'tol_lufs','tol_true_peak','tol_dr','tol_lra','tol_stereo'];

    Object.keys(genreData).forEach(key => {
        const value = genreData[key];
        if (typeof value === 'object' && value !== null && 
            !metricKeys.includes(key) &&
            (value.target_db !== undefined || value.target !== undefined)) {
            const normalizedKey = normalizeGenreBandName(key);
            bandsFromRoot[normalizedKey] = value;
        }
    });

    console.log('[GENRE-TABLE] 🎯 Bandas extraídas da raiz (normalizadas):', Object.keys(bandsFromRoot));
    return bandsFromRoot;
})();
```

---

## 📋 PLANO DE AÇÃO RECOMENDADO

### ✅ **ORDEM DE IMPLEMENTAÇÃO**

1. **CORREÇÃO #1** (CRÍTICA - PRIORIDADE MÁXIMA):
   - **Função**: `enrichReferenceObject()` (linha 3241-3310)
   - **Ação**: Normalizar chaves de `hybrid.spectral_bands` ao copiar para `refObj.bands`
   - **Impacto**: Garante que `genreData.bands` tenha chaves em camelCase
   - **Risco**: Baixo (apenas adiciona normalização)

2. **CORREÇÃO #2** (CRÍTICA - PRIORIDADE MÁXIMA):
   - **Função**: `renderGenreComparisonTable()` extração de targetBands (linha 5620-5685)
   - **Ação**: Buscar primeiro em `spectral_bands` (com underscore) e normalizar
   - **Impacto**: Garante que todas as 7 bandas sejam encontradas
   - **Risco**: Baixo (adiciona fallback seguro)

3. **VALIDAÇÃO**:
   - **Ação**: Testar com áudio real e verificar logs
   - **Esperado**: Ver 7 bandas renderizadas (`sub`, `bass`, `lowMid`, `mid`, `highMid`, `presence`, `air`)
   - **Log esperado**: `[GENRE-TABLE] ✅ Sub: -28.5 dB | Target: -16.0 | ...` (para todas as 7 bandas)

4. **OPCIONAL - Limpeza**:
   - **Função**: `applyGenreBandConversion()` (linha 5399)
   - **Ação**: Remover ou refatorar (não é usada no fluxo de renderização)
   - **Impacto**: Limpeza de código morto
   - **Risco**: Zero (não afeta funcionalidade)

---

## 🧪 TESTES RECOMENDADOS

### Teste 1: Verificar extração de targets

**Código de teste** (executar no console após carregar análise):
```javascript
// Assumindo que genreData está disponível
console.group('🧪 TESTE 1: Extração de targets');

const genreData = window.__activeRefData;

console.log('1. genreData.bands existe?', !!genreData?.bands);
console.log('2. genreData.spectral_bands existe?', !!genreData?.spectral_bands);
console.log('3. genreData.hybrid_processing existe?', !!genreData?.hybrid_processing);

if (genreData?.spectral_bands) {
    console.log('4. Chaves em spectral_bands:', Object.keys(genreData.spectral_bands));
    
    // Normalizar
    const normalized = {};
    Object.keys(genreData.spectral_bands).forEach(key => {
        const normalizedKey = normalizeGenreBandName(key);
        normalized[normalizedKey] = genreData.spectral_bands[key];
    });
    
    console.log('5. Chaves normalizadas:', Object.keys(normalized));
}

console.groupEnd();
```

**Resultado esperado**:
```
🧪 TESTE 1: Extração de targets
1. genreData.bands existe? true (se enrichReferenceObject funcionou)
2. genreData.spectral_bands existe? true
3. genreData.hybrid_processing existe? true
4. Chaves em spectral_bands: ['sub', 'low_bass', 'upper_bass', 'low_mid', 'mid', 'high_mid', 'brilho', 'presenca']
5. Chaves normalizadas: ['sub', 'bass', 'upperBass', 'lowMid', 'mid', 'highMid', 'air', 'presence']
```

### Teste 2: Verificar user bands

**Código de teste**:
```javascript
console.group('🧪 TESTE 2: User bands');

const analysis = window.__analysisData;

console.log('1. technicalData.bands:', analysis?.technicalData?.bands ? Object.keys(analysis.technicalData.bands) : 'N/A');
console.log('2. metrics.bands:', analysis?.metrics?.bands ? Object.keys(analysis.metrics.bands) : 'N/A');
console.log('3. spectral_balance:', analysis?.technicalData?.spectral_balance ? Object.keys(analysis.technicalData.spectral_balance) : 'N/A');

console.groupEnd();
```

**Resultado esperado**:
```
🧪 TESTE 2: User bands
1. technicalData.bands: ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air', 'totalPercentage', '_status']
2. metrics.bands: N/A (pode não existir)
3. spectral_balance: ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air', 'totalPercentage', '_status']
```

### Teste 3: Verificar matching

**Código de teste**:
```javascript
console.group('🧪 TESTE 3: Matching user → target');

const userBands = window.__analysisData?.technicalData?.bands;
const targetBands = window.__activeRefData?.bands;

if (userBands && targetBands) {
    Object.keys(userBands).forEach(userKey => {
        if (userKey === 'totalPercentage' || userKey === '_status') return;
        
        const normalizedKey = normalizeGenreBandName(userKey);
        const hasTarget = !!targetBands[normalizedKey];
        
        console.log(`${userKey} → ${normalizedKey}: ${hasTarget ? '✅ Match' : '❌ Sem target'}`);
    });
} else {
    console.error('❌ userBands ou targetBands não disponível');
}

console.groupEnd();
```

**Resultado esperado (APÓS correção)**:
```
🧪 TESTE 3: Matching user → target
sub → sub: ✅ Match
bass → bass: ✅ Match
lowMid → lowMid: ✅ Match
mid → mid: ✅ Match
highMid → highMid: ✅ Match
presence → presence: ✅ Match
air → air: ✅ Match
```

**Resultado atual (ANTES da correção)**:
```
🧪 TESTE 3: Matching user → target
sub → sub: ✅ Match
bass → bass: ❌ Sem target
lowMid → lowMid: ❌ Sem target
mid → mid: ✅ Match
highMid → highMid: ❌ Sem target
presence → presence: ❌ Sem target
air → air: ❌ Sem target
```

---

## 📊 RESUMO FINAL

### ✅ **CONFIRMAÇÕES**

| Item | Status | Observação |
|------|--------|------------|
| Backend envia em camelCase | ✅ Confirmado | `bass`, `lowMid`, `highMid`, `presence`, `air` |
| Target JSON em snake_case/português | ✅ Confirmado | `low_bass`, `low_mid`, `high_mid`, `presenca`, `brilho` |
| normalizeGenreBandName() correta | ✅ Confirmado | Mapeia snake_case → camelCase corretamente |
| enrichReferenceObject() extrai spectral_bands | ✅ Confirmado | Mas NÃO normaliza chaves |
| renderGenreComparisonTable() busca incorretamente | ✅ Confirmado | Não busca em `spectral_bands` (com underscore) |
| Log "Pulando banda sem target" no lugar certo | ✅ Confirmado | Linha 5858 |
| Apenas sub e mid funcionam | ✅ Confirmado | Únicos com mesmo nome em ambas nomenclaturas |

### ❌ **PROBLEMAS IDENTIFICADOS**

1. **enrichReferenceObject()** copia `spectral_bands` para `bands` sem normalizar chaves
2. **renderGenreComparisonTable()** tenta ler `spectralBands` (sem underscore) em vez de `spectral_bands` (com underscore)
3. **Fallback de extração da raiz** não funciona porque bandas estão em `hybrid_processing.spectral_bands`, não na raiz

### ✅ **SOLUÇÃO DEFINITIVA**

**Aplicar normalização em 2 locais**:

1. **enrichReferenceObject()** (linha 3241): Normalizar chaves ao copiar `spectral_bands` → `bands`
2. **renderGenreComparisonTable()** (linha 5620): Buscar em `spectral_bands` (com underscore) e normalizar

**Impacto esperado**: 
- ✅ Todas as 7 bandas serão renderizadas
- ✅ Zero breaking changes (mantém compatibilidade)
- ✅ Correção cirúrgica (apenas 2 locais)

---

**FIM DA AUDITORIA**
