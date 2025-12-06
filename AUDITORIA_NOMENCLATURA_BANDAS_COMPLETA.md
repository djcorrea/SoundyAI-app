# 🔥 AUDITORIA COMPLETA - INCONSISTÊNCIA DE NOMES DE BANDAS (GENRE MODE)

**Data**: 6 de dezembro de 2025  
**Objetivo**: Identificar EXATAMENTE onde os nomes de bandas se perdem entre Backend → Frontend → Tabela  
**Status**: ⚠️ **INCOMPATIBILIDADE CRÍTICA CONFIRMADA**

---

## 📊 SUMÁRIO EXECUTIVO

### ✅ DESCOBERTA PRINCIPAL:

**EXISTE UM MISMATCH TOTAL DE NOMENCLATURA ENTRE:**
1. **Backend (genreTargets)**: usa `snake_case` (low_bass, upper_bass, low_mid, high_mid, brilho, presenca)
2. **Backend (userBands)**: usa `camelCase` (sub, bass, lowMid, mid, highMid, presence, air)
3. **Frontend (normalização)**: tenta converter `snake_case` → `camelCase`
4. **Frontend (tabela)**: espera encontrar targets em `camelCase` mas recebe em `snake_case`

### 🔴 CAUSA RAIZ IDENTIFICADA:

**O loop de renderização funciona assim:**
1. Itera sobre `userBands` (camelCase: `bass`, `lowMid`, `highMid`, `presence`, `air`)
2. Normaliza para camelCase via `normalizeGenreBandName()` (ex: `bass` → `bass`)
3. Busca em `targetBands[targetKey]` esperando encontrar `bass`, `lowMid`, etc.
4. **MAS** `targetBands` contém `low_bass`, `low_mid`, `high_mid`, `brilho`, `presenca` (snake_case!)
5. `targetBands["bass"]` retorna `undefined` (não existe!)
6. `targetBands["lowMid"]` retorna `undefined` (não existe!)
7. Todas as bandas são puladas com "sem target"

---

## 🔍 ANÁLISE DETALHADA POR CAMADA

### 1️⃣ BACKEND - O QUE É ENVIADO

#### 📍 **Arquivo**: `work/api/audio/json-output.js` (Linhas 215-280)

**Bandas do Usuário** (`analysis.bands` ou `analysis.metrics.bands`):
```javascript
{
  sub: { energy_db: -28.5, percentage: 15.2, range: "20-60Hz" },
  bass: { energy_db: -26.3, percentage: 18.5, range: "60-150Hz" },
  lowMid: { energy_db: -24.1, percentage: 16.8, range: "150-500Hz" },
  mid: { energy_db: -22.0, percentage: 18.2, range: "500-2000Hz" },
  highMid: { energy_db: -25.5, percentage: 12.3, range: "2000-5000Hz" },
  presence: { energy_db: -28.8, percentage: 8.5, range: "5000-10000Hz" },
  air: { energy_db: -32.2, percentage: 10.5, range: "10000-20000Hz" }
}
```

**Nomenclatura**: ✅ **camelCase**  
**Fonte**: SpectralBandsAggregator do backend  
**Localização no JSON final**: `analysis.metrics.bands` ou `analysis.technicalData.bandEnergies`

---

#### 📍 **Arquivo**: `public/refs/trance.json` (Linha 1-136)

**Targets de Gênero** (`analysis.data.genreTargets`):
```javascript
{
  lufs_target: -10.5,
  true_peak_target: -0.9,
  dr_target: 6.8,
  lra_target: 6.0,
  stereo_target: 0.72,
  // ⚠️ BANDAS NA RAIZ (snake_case)
  sub: { target_db: -16, energy_pct: 18.5, tol_db: 2.5 },
  low_bass: { target_db: -17.8, energy_pct: 20.2, tol_db: 2.5 },
  upper_bass: { target_db: -19.5, energy_pct: 15.8, tol_db: 2.5 },
  low_mid: { target_db: -18.2, energy_pct: 16.5, tol_db: 2.5 },
  mid: { target_db: -17.1, energy_pct: 18.2, tol_db: 2.5 },
  high_mid: { target_db: -20.8, energy_pct: 8.1, tol_db: 2.5 },
  brilho: { target_db: -25.5, energy_pct: 2.5, tol_db: 2.5 },
  presenca: { target_db: -34.6, energy_pct: 0.12, tol_db: 2.5 }
}
```

**Nomenclatura**: ❌ **snake_case**  
**Fonte**: Arquivos JSON em `public/refs/`  
**Localização no JSON final**: `analysis.data.genreTargets` (raiz do objeto)

---

### 2️⃣ FRONTEND - FUNÇÃO DE NORMALIZAÇÃO

#### 📍 **Arquivo**: `public/audio-analyzer-integration.js` (Linhas 5278-5305)

**Função**: `normalizeGenreBandName(name)`

```javascript
function normalizeGenreBandName(name) {
    const map = {
        // ✅ Snake_case → camelCase (CONVERSÃO)
        'low_bass': 'bass',
        'upper_bass': 'upperBass',
        'low_mid': 'lowMid',
        'high_mid': 'highMid',
        'presenca': 'presence',
        'brilho': 'air',
        
        // ✅ CamelCase → camelCase (IDENTIDADE)
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

**O que essa função faz:**
- ✅ Converte `low_bass` → `bass`
- ✅ Converte `upper_bass` → `upperBass`
- ✅ Converte `low_mid` → `lowMid`
- ✅ Converte `high_mid` → `highMid`
- ✅ Converte `presenca` → `presence`
- ✅ Converte `brilho` → `air`
- ✅ Mantém `sub` → `sub`
- ✅ Mantém `mid` → `mid`

**Propósito**: Normalizar nomes de bandas para **camelCase**  
**Uso**: Chamada dentro do loop de renderização (linha 5807)

---

### 3️⃣ FRONTEND - LOOP DE RENDERIZAÇÃO

#### 📍 **Arquivo**: `public/audio-analyzer-integration.js` (Linhas 5799-5870)

**Fluxo do Loop**:

```javascript
// 1️⃣ Itera sobre BANDAS DO USUÁRIO (camelCase)
Object.keys(userBands).forEach(backendKey => {
    // backendKey = "bass", "lowMid", "highMid", "presence", "air"
    
    // 2️⃣ Normaliza o nome (já está em camelCase, então não muda)
    const targetKey = normalizeGenreBandName(backendKey);
    // targetKey = "bass", "lowMid", "highMid", "presence", "air"
    
    // 3️⃣ Busca target em targetBands usando targetKey
    const targetBand = targetBands[targetKey];
    // ❌ targetBands["bass"] = undefined (não existe!)
    // ❌ targetBands["lowMid"] = undefined (não existe!)
    // ❌ targetBands["highMid"] = undefined (não existe!)
    // ❌ targetBands["presence"] = undefined (não existe!)
    // ❌ targetBands["air"] = undefined (não existe!)
    
    // 4️⃣ Verifica se target existe
    if (!targetBand) {
        console.log(`[GENRE-TABLE] ⏭️ Pulando banda sem target: ${backendKey} → ${targetKey}`);
        return; // ❌ PULA TODAS AS BANDAS!
    }
```

**Resultado**:
```
[GENRE-TABLE] ⏭️ Pulando banda sem target: bass → bass
[GENRE-TABLE] ⏭️ Pulando banda sem target: lowMid → lowMid
[GENRE-TABLE] ⏭️ Pulando banda sem target: highMid → highMid
[GENRE-TABLE] ⏭️ Pulando banda sem target: presence → presence
[GENRE-TABLE] ⏭️ Pulando banda sem target: air → air
```

**NENHUMA BANDA É RENDERIZADA!**

---

## 🎯 TABELA DE CORRESPONDÊNCIAS (MISMATCH CONFIRMADO)

| Backend genreTargets<br/>(snake_case) | Backend userBands<br/>(camelCase) | Frontend normaliza<br/>(targetKey) | targetBands procura | MATCH? | Motivo |
|---------------------------------------|-----------------------------------|-----------------------------------|---------------------|--------|--------|
| `sub` | `sub` | `sub` → `sub` | `targetBands["sub"]` | ✅ **SIM** | Nome igual em todos |
| `low_bass` | `bass` | `bass` → `bass` | `targetBands["bass"]` | ❌ **NÃO** | Target usa `low_bass`, procura `bass` |
| `upper_bass` | *(não existe)* | *(não chega)* | *(não procura)* | ❌ **NÃO** | userBands não tem upperBass |
| `low_mid` | `lowMid` | `lowMid` → `lowMid` | `targetBands["lowMid"]` | ❌ **NÃO** | Target usa `low_mid`, procura `lowMid` |
| `mid` | `mid` | `mid` → `mid` | `targetBands["mid"]` | ✅ **SIM** | Nome igual em todos |
| `high_mid` | `highMid` | `highMid` → `highMid` | `targetBands["highMid"]` | ❌ **NÃO** | Target usa `high_mid`, procura `highMid` |
| `brilho` | `air` | `air` → `air` | `targetBands["air"]` | ❌ **NÃO** | Target usa `brilho`, procura `air` |
| `presenca` | `presence` | `presence` → `presence` | `targetBands["presence"]` | ❌ **NÃO** | Target usa `presenca`, procura `presence` |

---

## 🔴 BANDAS QUE QUEBRAM E POR QUÊ

### ❌ **Banda: BASS / LOW_BASS**
- **userBands**: `bass` (camelCase)
- **targetBands**: `low_bass` (snake_case)
- **Loop procura**: `targetBands["bass"]` → `undefined`
- **Por quê**: Nome diferente no target (low_bass ≠ bass)

### ❌ **Banda: LOWMID / LOW_MID**
- **userBands**: `lowMid` (camelCase)
- **targetBands**: `low_mid` (snake_case)
- **Loop procura**: `targetBands["lowMid"]` → `undefined`
- **Por quê**: Nome diferente no target (low_mid ≠ lowMid)

### ❌ **Banda: HIGHMID / HIGH_MID**
- **userBands**: `highMid` (camelCase)
- **targetBands**: `high_mid` (snake_case)
- **Loop procura**: `targetBands["highMid"]` → `undefined`
- **Por quê**: Nome diferente no target (high_mid ≠ highMid)

### ❌ **Banda: AIR / BRILHO**
- **userBands**: `air` (camelCase)
- **targetBands**: `brilho` (snake_case)
- **Loop procura**: `targetBands["air"]` → `undefined`
- **Por quê**: Nome completamente diferente (brilho ≠ air)

### ❌ **Banda: PRESENCE / PRESENCA**
- **userBands**: `presence` (camelCase)
- **targetBands**: `presenca` (snake_case)
- **Loop procura**: `targetBands["presence"]` → `undefined`
- **Por quê**: Nome diferente (presenca ≠ presence)

### ✅ **Banda: SUB**
- **userBands**: `sub`
- **targetBands**: `sub`
- **Loop procura**: `targetBands["sub"]` → ✅ **ENCONTRA**
- **Por quê**: Nome idêntico em todos os lugares

### ✅ **Banda: MID**
- **userBands**: `mid`
- **targetBands**: `mid`
- **Loop procura**: `targetBands["mid"]` → ✅ **ENCONTRA**
- **Por quê**: Nome idêntico em todos os lugares

### ❌ **Banda: UPPERBASS / UPPER_BASS**
- **userBands**: *(não existe - backend não envia)*
- **targetBands**: `upper_bass` (snake_case)
- **Loop procura**: *(nunca procura)*
- **Por quê**: Backend não gera banda upperBass, mas target tem upper_bass

---

## 🔍 ONDE O FLUXO SE PERDE

### 📍 **PONTO DE QUEBRA #1**: Extração de `targetBands` (Linha 5605-5642)

```javascript
const targetBands = (() => {
    // Compatibilidade com estrutura nova
    if (genreData.bands && Object.keys(genreData.bands).length > 0) {
        return genreData.bands; // ❌ Não entra aqui (genreData.bands não existe)
    }

    // Compatibilidade com estrutura legado
    if (genreData.spectralBands && Object.keys(genreData.spectralBands).length > 0) {
        return genreData.spectralBands; // ❌ Não entra aqui (genreData.spectralBands não existe)
    }

    // 🎯 CORREÇÃO CRÍTICA: extrair bandas da raiz
    const bandsFromRoot = {};
    const metricKeys = [
        'lufs_target','true_peak_target','dr_target','lra_target','stereo_target',
        'tol_lufs','tol_true_peak','tol_dr','tol_lra','tol_stereo'
    ];

    Object.keys(genreData).forEach(key => {
        const value = genreData[key];
        if (typeof value === 'object' && value !== null && 
            !metricKeys.includes(key) &&
            (value.target_db !== undefined || value.target !== undefined)
        ) {
            bandsFromRoot[key] = value; // ✅ Adiciona bandas da raiz
        }
    });

    return bandsFromRoot; // ✅ Retorna: { sub, low_bass, upper_bass, low_mid, mid, high_mid, brilho, presenca }
})();
```

**O que retorna**:
```javascript
targetBands = {
    sub: { target_db: -16, ... },
    low_bass: { target_db: -17.8, ... },    // ❌ snake_case
    upper_bass: { target_db: -19.5, ... },  // ❌ snake_case
    low_mid: { target_db: -18.2, ... },     // ❌ snake_case
    mid: { target_db: -17.1, ... },
    high_mid: { target_db: -20.8, ... },    // ❌ snake_case
    brilho: { target_db: -25.5, ... },      // ❌ nome português
    presenca: { target_db: -34.6, ... }     // ❌ nome português
}
```

**Problema**: `targetBands` contém bandas em **snake_case** e **português**!

---

### 📍 **PONTO DE QUEBRA #2**: Loop de renderização (Linha 5799-5870)

```javascript
Object.keys(userBands).forEach(backendKey => {
    // backendKey = "bass", "lowMid", "highMid", "presence", "air" (camelCase)
    
    const targetKey = normalizeGenreBandName(backendKey);
    // targetKey = "bass", "lowMid", "highMid", "presence", "air" (não muda!)
    
    const targetBand = targetBands[targetKey];
    // ❌ targetBands["bass"] = undefined (target tem "low_bass", não "bass")
    // ❌ targetBands["lowMid"] = undefined (target tem "low_mid", não "lowMid")
    // ❌ targetBands["highMid"] = undefined (target tem "high_mid", não "highMid")
    // ❌ targetBands["presence"] = undefined (target tem "presenca", não "presence")
    // ❌ targetBands["air"] = undefined (target tem "brilho", não "air")
    
    if (!targetBand) {
        console.log(`[GENRE-TABLE] ⏭️ Pulando banda sem target: ${backendKey} → ${targetKey}`);
        return; // ❌ TODAS AS BANDAS SÃO PULADAS!
    }
```

**Problema**: Loop usa `userBands` (camelCase) para procurar em `targetBands` (snake_case).

---

## 🔧 ONDE A NORMALIZAÇÃO DEVERIA ACONTECER (MAS NÃO ESTÁ)

### ❌ **PROBLEMA**: `normalizeGenreBandName()` é chamada no lugar errado!

**Função atual** (Linha 5807):
```javascript
const targetKey = normalizeGenreBandName(backendKey);
```

**O que acontece**:
- `backendKey = "bass"` (já em camelCase)
- `normalizeGenreBandName("bass")` retorna `"bass"` (não muda!)
- Procura `targetBands["bass"]` → não encontra (target tem `"low_bass"`)

**O que DEVERIA acontecer**:
- Normalizar as **CHAVES DE `targetBands`** de snake_case → camelCase
- OU procurar usando o **nome original em snake_case**

---

## 🎯 ESTRUTURA CORRETA A SER USADA

### ✅ **CONFIRMADO**: A estrutura correta é:

**Backend envia**:
```javascript
analysis.data.genreTargets = {
    lufs_target: -10.5,
    // ... métricas principais
    
    // ⚠️ Bandas na RAIZ (não em .bands ou .spectralBands)
    sub: { target_db: -16, ... },
    low_bass: { target_db: -17.8, ... },
    // ...
}
```

**Frontend deve**:
1. ✅ Extrair bandas da raiz de `genreTargets` (não de `.bands`)
2. ❌ **MAS** precisa normalizar as chaves para camelCase ANTES de usar
3. ❌ **OU** usar normalização reversa (camelCase → snake_case) ao procurar

---

## 🩹 SOLUÇÃO (DIAGNÓSTICO APENAS - NÃO APLICAR)

### 🎯 **OPÇÃO 1**: Normalizar `targetBands` ao extrair (Recomendada)

Quando extrair bandas da raiz, converter chaves de snake_case → camelCase:

```javascript
const bandsFromRoot = {};
Object.keys(genreData).forEach(key => {
    const value = genreData[key];
    if (typeof value === 'object' && value !== null && 
        !metricKeys.includes(key) &&
        (value.target_db !== undefined || value.target !== undefined)
    ) {
        // ✅ Normalizar chave AQUI
        const normalizedKey = normalizeGenreBandName(key);
        bandsFromRoot[normalizedKey] = value;
    }
});
```

**Resultado**:
```javascript
targetBands = {
    sub: { target_db: -16, ... },
    bass: { target_db: -17.8, ... },          // ✅ normalizado de low_bass
    upperBass: { target_db: -19.5, ... },     // ✅ normalizado de upper_bass
    lowMid: { target_db: -18.2, ... },        // ✅ normalizado de low_mid
    mid: { target_db: -17.1, ... },
    highMid: { target_db: -20.8, ... },       // ✅ normalizado de high_mid
    air: { target_db: -25.5, ... },           // ✅ normalizado de brilho
    presence: { target_db: -34.6, ... }       // ✅ normalizado de presenca
}
```

**Agora o loop funciona**:
```javascript
const targetKey = normalizeGenreBandName(backendKey); // "bass" → "bass"
const targetBand = targetBands[targetKey];            // targetBands["bass"] ✅ ENCONTRA!
```

---

### 🎯 **OPÇÃO 2**: Buscar usando nome reverso (Alternativa)

No loop, buscar usando tanto camelCase quanto snake_case:

```javascript
const targetKey = normalizeGenreBandName(backendKey);
let targetBand = targetBands[targetKey];

// Se não encontrar, tentar nome original em snake_case
if (!targetBand) {
    const reverseMap = {
        'bass': 'low_bass',
        'upperBass': 'upper_bass',
        'lowMid': 'low_mid',
        'highMid': 'high_mid',
        'air': 'brilho',
        'presence': 'presenca'
    };
    const snakeCaseKey = reverseMap[targetKey] || targetKey;
    targetBand = targetBands[snakeCaseKey];
}
```

**Desvantagem**: Código duplicado e menos eficiente.

---

## 📊 VALIDAÇÃO FINAL

### ✅ **CONFIRMADO**: Problema é de nomenclatura

| Item | Status |
|------|--------|
| Backend envia dados corretos? | ✅ SIM |
| Frontend recebe dados corretos? | ✅ SIM |
| Estrutura de dados está correta? | ✅ SIM |
| Bandas estão na raiz de genreTargets? | ✅ SIM |
| Loop itera sobre userBands correto? | ✅ SIM |
| Normalização funciona? | ⚠️ PARCIAL |
| Normalização é chamada no lugar certo? | ❌ NÃO |
| targetBands tem chaves corretas? | ❌ NÃO (snake_case) |
| Loop encontra targets? | ❌ NÃO (mismatch de nomes) |

---

## 🎯 RESUMO DA CAUSA RAIZ

### 🔴 **PROBLEMA PRINCIPAL**:

**`targetBands` contém chaves em snake_case** (`low_bass`, `low_mid`, `high_mid`, `brilho`, `presenca`)  
**Loop procura em camelCase** (`bass`, `lowMid`, `highMid`, `air`, `presence`)  
**Resultado**: `targetBands[camelCase]` retorna `undefined` → todas as bandas são puladas

### ✅ **SOLUÇÃO CONFIRMADA**:

**Normalizar as CHAVES de `targetBands`** ao extrair da raiz:
- `low_bass` → `bass`
- `upper_bass` → `upperBass`
- `low_mid` → `lowMid`
- `high_mid` → `highMid`
- `brilho` → `air`
- `presenca` → `presence`

**Onde aplicar**: Linha 5620-5640 (extração de `bandsFromRoot`)

---

## 📝 PRÓXIMOS PASSOS (NÃO EXECUTAR AINDA)

1. ⏸️ **Validar este diagnóstico** com desenvolvedor
2. ✅ **Confirmar que Opção 1 é a correta** (normalizar ao extrair)
3. ✅ **Aplicar patch na extração de targetBands** (linha 5620)
4. ✅ **Testar com áudio real**
5. ✅ **Verificar logs de correspondências**
6. ✅ **Confirmar que todas as 8 bandas são renderizadas**

---

**FIM DA AUDITORIA**
