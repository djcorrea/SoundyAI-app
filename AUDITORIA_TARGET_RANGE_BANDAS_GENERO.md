# 🔍 AUDITORIA COMPLETA - SUPORTE A FAIXAS (MIN/MAX) DAS BANDAS NO MODO GÊNERO

**Data**: 6 de dezembro de 2025  
**Objetivo**: Auditar como o sistema trata `target_range` (min_db/max_db) vs `target_db` para bandas espectrais  
**Status**: ✅ **AUDITORIA COMPLETADA**

---

## 🎯 RESUMO EXECUTIVO

### ✅ **DIAGNÓSTICO PRINCIPAL**

**O sistema JÁ TEM suporte completo a `target_range` (min/max) implementado em múltiplas camadas:**

1. ✅ **Backend** (scoring.js) - Função `scoreToleranceRange()` completa
2. ✅ **Cálculo de Score** (calculateFrequencyScore) - Lê `target_range` corretamente
3. ✅ **Renderização A/B** (renderReferenceComparison) - Usa `target_range` com formatação
4. ✅ **Targets JSON** (trance.json) - Todos têm `target_range` + `target_db` + `tol_db: 0`

### ❌ **PROBLEMA IDENTIFICADO**

**APENAS a tabela de comparação de gênero (`renderGenreComparisonTable`) está ignorando `target_range`:**

- ❌ Usa apenas `targetBand.target_db` (linha 5893)
- ❌ Usa apenas `targetBand.tol_db` (linha 5894)
- ❌ **NÃO lê `targetBand.target_range`**
- ❌ Calcula diferença como `valor - target_db` em vez de "distância até o range"

**Resultado**: Tabela de gênero mostra diferenças incorretas, severidades erradas, e ações inadequadas.

---

## 📋 SEÇÃO 1: ONDE O SISTEMA PEGA OS TARGETS DE BANDAS

### 1️⃣ **Arquivo: `public/refs/out/trance.json`**

**Estrutura dos targets** (linhas 15-90):

```json
{
  "trance": {
    "hybrid_processing": {
      "spectral_bands": {
        "sub": {
          "target_range": { "min": -30, "max": -26 },
          "target_db": -28,
          "energy_pct": 18.5,
          "tol_db": 0,
          "severity": "soft"
        },
        "low_bass": {
          "target_range": { "min": -29, "max": -25 },
          "target_db": -28,
          "tol_db": 0
        },
        "low_mid": {
          "target_range": { "min": -31, "max": -26 },
          "target_db": -28,
          "tol_db": 0
        },
        "mid": {
          "target_range": { "min": -36, "max": -28 },
          "target_db": -32,
          "tol_db": 0
        },
        "high_mid": {
          "target_range": { "min": -43, "max": -34 },
          "target_db": -38.5,
          "tol_db": 0
        },
        "brilho": {
          "target_range": { "min": -44, "max": -38 },
          "target_db": -41,
          "tol_db": 0
        },
        "presenca": {
          "target_range": { "min": -42, "max": -36 },
          "target_db": -38,
          "tol_db": 0
        }
      }
    }
  }
}
```

**✅ CONFIRMADO**:
- ✅ Todos os targets têm `target_range` com `min` e `max`
- ✅ Todos têm `target_db` (centro do range para fallback)
- ✅ Todos têm `tol_db: 0` (indicando que deve usar range width)

---

### 2️⃣ **Função: `enrichReferenceObject()` (linha 3241)**

**Responsabilidade**: Extrair `spectral_bands` de `hybrid_processing` e normalizar

**Código atual** (linhas 3273-3287):

```javascript
// Mapear spectral_bands (prioridade sobre legacy)
if (hybrid.spectral_bands && typeof hybrid.spectral_bands === 'object') {
    refObj.spectral_bands = hybrid.spectral_bands;
    
    // 🎯 CORREÇÃO CRÍTICA: Normalizar chaves de snake_case → camelCase
    if (!refObj.bands) {
        const normalizedBands = {};
        Object.keys(hybrid.spectral_bands).forEach(snakeKey => {
            const camelKey = normalizeGenreBandName(snakeKey);
            normalizedBands[camelKey] = hybrid.spectral_bands[snakeKey];
        });
        refObj.bands = normalizedBands;
        console.log('[ENRICH] 🎯 Bandas normalizadas:', Object.keys(normalizedBands));
    }
}
```

**✅ CONFIRMADO**:
- ✅ `target_range` é preservado ao copiar `spectral_bands` → `bands`
- ✅ Normalização só afeta as chaves (nomes das bandas), não os valores
- ✅ Estrutura completa (incluindo `target_range`) é mantida

---

### 3️⃣ **Função: `renderGenreComparisonTable()` (linha 5645)**

**Extração de targets normalizada** (linhas 5645-5688):

```javascript
const targetBands = (() => {
    // 🎯 PRIORIDADE 1: spectral_bands (estrutura correta do JSON com snake_case)
    if (genreData.spectral_bands && typeof genreData.spectral_bands === 'object' && Object.keys(genreData.spectral_bands).length > 0) {
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
    
    // 🎯 PRIORIDADE 2: bands (já normalizado via enrichReferenceObject)
    if (genreData.bands && Object.keys(genreData.bands).length > 0) {
        console.log('[GENRE-TABLE] 🎯 Usando genreData.bands (já normalizado)');
        return genreData.bands;
    }
    
    // ... fallback
})();
```

**✅ CONFIRMADO**:
- ✅ Extrai bandas corretamente de `spectral_bands`
- ✅ Normaliza chaves (snake_case → camelCase)
- ✅ **PRESERVA `target_range` completo em cada banda**

**❌ PROBLEMA**: Depois de extrair, a função **NÃO USA `target_range`**!

---

## 📋 SEÇÃO 2: ONDE O SISTEMA CALCULA DIFERENÇA DAS BANDAS

### 1️⃣ **Backend: `work/lib/audio/features/scoring.js`**

#### **Função: `scoreToleranceRange()` (linhas 100-150)**

**Sistema completo de cálculo de score por range:**

```javascript
function scoreToleranceRange(metricValue, targetRange, fallbackTarget = null, tol = null) {
  if (!Number.isFinite(metricValue)) return null;
  
  // 🔧 SUPORTE A RANGE: Se target_range definido, usar sistema de intervalo
  if (targetRange && typeof targetRange === 'object' && 
      Number.isFinite(targetRange.min) && Number.isFinite(targetRange.max)) {
    
    const { min, max } = targetRange;
    
    // ✅ DENTRO DO RANGE: Score máximo (verde)
    if (metricValue >= min && metricValue <= max) {
      return 1.0; // Score perfeito
    }
    
    // ❌ FORA DO RANGE: Penalização proporcional baseada na distância
    let distance;
    if (metricValue < min) {
      distance = min - metricValue; // Distância abaixo do mínimo
    } else {
      distance = metricValue - max; // Distância acima do máximo
    }
    
    // 📉 CURVA DE PENALIZAÇÃO SUAVE
    const rangeWidth = max - min;
    const defaultTolerance = rangeWidth * 0.25;
    const tolerance = Number.isFinite(tol) && tol > 0 ? tol : defaultTolerance;
    
    if (distance <= tolerance) {
      // Dentro da tolerância: score 0.5-1.0 (amarelo/verde)
      return 1.0 - (distance / tolerance) * 0.5;
    } else if (distance <= tolerance * 2) {
      // Fora da tolerância mas não crítico: score 0.2-0.5 (amarelo/vermelho)
      return 0.5 - (distance - tolerance) / tolerance * 0.3;
    } else {
      // Muito fora: score mínimo 0.1-0.2 (vermelho)
      return Math.max(0.1, 0.2 - (distance - tolerance * 2) / (tolerance * 3) * 0.1);
    }
  }
  
  // 🔄 FALLBACK: Se não tem range, usar sistema antigo com target fixo
  if (Number.isFinite(fallbackTarget)) {
    return scoreTolerance(metricValue, fallbackTarget, tol || 1);
  }
  
  return null;
}
```

**✅ LÓGICA CORRETA**:
- ✅ Se `valor >= min && valor <= max` → **DENTRO** → Score 1.0 (verde)
- ✅ Se `valor < min` → Calcula distância abaixo do mínimo
- ✅ Se `valor > max` → Calcula distância acima do máximo
- ✅ Penalização proporcional baseada na distância fora do range
- ✅ Tolerância padrão = 25% da largura do range

---

#### **Função: `addMetric()` com suporte a `target_range` (linhas 412-450)**

**Código**:

```javascript
function addMetric(category, key, value, target, tol, opts = {}) {
    if (!Number.isFinite(value) || value === -Infinity) return;
    if (!Number.isFinite(target)) return;
    if (!Number.isFinite(tol) || tol <= 0) tol = DEFAULT_TARGETS[key]?.tol || 1;
    
    // 🎯 NOVA LÓGICA: Suporte a target_range nas opções
    let s;
    if (opts.target_range && typeof opts.target_range === 'object') {
      // Sistema de intervalos: qualquer valor dentro do range = score máximo
      s = scoreToleranceRange(value, opts.target_range, target, tol);
      console.log(`[SCORING_RANGE] ${key}: valor=${value}, range=[${opts.target_range.min}, ${opts.target_range.max}], score=${s?.toFixed(3)}`);
    } else {
      // Sistema antigo: target fixo + tolerância
      s = scoreTolerance(value, target, tol, !!opts.invert);
    }
    
    if (s == null) return;
    
    // Determinar status (OK / BAIXO / ALTO) e severidade
    let status = 'OK';
    let severity = null;
    let n = 0; // ratio de desvio
    
    if (opts.target_range) {
      // 🎯 LÓGICA DE STATUS PARA RANGES
      const { min, max } = opts.target_range;
      if (value >= min && value <= max) {
        status = 'OK';
        n = 0;
      } else {
        const rangeWidth = max - min;
        const tolerance = Number.isFinite(tol) ? tol : rangeWidth * 0.25;
        
        if (value < min) {
          status = 'BAIXO';
          n = (min - value) / tolerance;
        } else {
          status = 'ALTO';
          n = (value - max) / tolerance;
        }
      }
      
      // Severidade baseada em n (ratio de desvio)
      if (n === 0) severity = null;
      else if (n <= 1) severity = 'LEVE';
      else if (n <= 2) severity = 'MÉDIA';
      else if (n <= 3) severity = 'ALTA';
      else severity = 'CRÍTICA';
    }
    // ... resto da lógica
}
```

**✅ CONFIRMADO**:
- ✅ Detecta automaticamente se `opts.target_range` existe
- ✅ Usa `scoreToleranceRange()` para calcular score
- ✅ Calcula status correto (OK/BAIXO/ALTO)
- ✅ Severidade baseada em distância do range, não de target fixo

---

#### **Uso em bandas espectrais** (linhas 545-570):

```javascript
if (refBand.target_range && typeof refBand.target_range === 'object' && 
    Number.isFinite(refBand.target_range.min) && Number.isFinite(refBand.target_range.max)) {
  
  // ✅ Sistema de intervalos
  const target = (refBand.target_range.min + refBand.target_range.max) / 2;
  const tol = Number.isFinite(refBand.tol_db) ? refBand.tol_db : Math.abs(refBand.target_range.max - refBand.target_range.min) * 0.25;
  
  addMetric('tonal', `band_${band}`, val, target, tol, { 
    target_range: refBand.target_range,
    tolMin: null, 
    tolMax: null 
  });
  
  console.log(`[SCORING_BAND_RANGE] ${band}: valor=${val}, range=[${refBand.target_range.min}, ${refBand.target_range.max}], target_fallback=${target}, tol=${tol}`);
  
} else if (Number.isFinite(refBand?.target_db)) {
  // 🔄 Sistema antigo: target_db fixo
  addMetric('tonal', `band_${band}`, val, refBand.target_db, tolAvg, { tolMin, tolMax });
}
```

**✅ CONFIRMADO**: Backend prioriza `target_range` sobre `target_db`

---

### 2️⃣ **Frontend: `calculateFrequencyScore()` (linha 17230)**

**Código** (linhas 17235-17250):

```javascript
// 👉 MODO GENRE: Usar target_range dos targets de gênero
if (refBandData.target_range && typeof refBandData.target_range === 'object' &&
    Number.isFinite(refBandData.target_range.min) && Number.isFinite(refBandData.target_range.max)) {
    // Novo sistema: calcular alvo e tolerância a partir do range
    targetDb = (refBandData.target_range.min + refBandData.target_range.max) / 2;
    tolDb = (refBandData.target_range.max - refBandData.target_range.min) / 2;
    console.log(`🎯 [SCORE-FREQ-GENRE] ${calcBand}: usando target_range [${refBandData.target_range.min}, ${refBandData.target_range.max}] → target=${targetDb.toFixed(1)}dB, tol=${tolDb.toFixed(1)}dB`);
} else if (Number.isFinite(refBandData.target_db) && Number.isFinite(refBandData.tol_db)) {
    // Sistema legado
    targetDb = refBandData.target_db;
    tolDb = refBandData.tol_db;
    console.log(`🎯 [SCORE-FREQ-GENRE] ${calcBand}: usando target_db=${targetDb}dB, tol_db=${tolDb}dB`);
}

// Calcular score individual da banda
if (Number.isFinite(targetDb) && Number.isFinite(tolDb)) {
    const score = calculateMetricScore(energyDb, targetDb, tolDb);
    if (score !== null) {
        scores.push(score);
        const delta = Math.abs(energyDb - targetDb);
        const status = delta <= tolDb ? '✅' : '❌';
        console.log(`🎵 ${calcBand.toUpperCase()}: ${energyDb.toFixed(1)}dB vs ${targetDb.toFixed(1)}dB (±${tolDb.toFixed(1)}dB) = ${score}% ${status}`);
    }
}
```

**✅ CONFIRMADO**:
- ✅ **PRIORIZA `target_range`** se existir
- ✅ Calcula `targetDb` como centro do range (min+max)/2
- ✅ Calcula `tolDb` como metade da largura do range (max-min)/2
- ✅ Fallback para `target_db` fixo se range não existir

**📊 STATUS**: Função usada para **cálculo de score geral**, não para renderização da tabela

---

### 3️⃣ **Frontend: `renderReferenceComparison()` (linha 15680)**

**Código** (linhas 15685-15700):

```javascript
// Prioridade 1: target_range (usar helpers para formatação e tolerância)
if (refBand.target_range && typeof refBand.target_range === 'object' &&
    Number.isFinite(refBand.target_range.min) && Number.isFinite(refBand.target_range.max)) {
    tgt = refBand.target_range;
    tolerance = deriveTolerance(tgt, 2.0);
    console.log(`🎯 [BANDS-FORMAT] Usando target_range para ${refBandKey}: ${formatTarget(tgt)}, tol: ${tolerance.toFixed(2)}`);
}
// Prioridade 2: target_db fixo
else if (!refBand._target_na && Number.isFinite(refBand.target_db)) {
    tgt = refBand.target_db;
    tolerance = deriveTolerance(tgt, 2.0);
    console.log(`🎯 [BANDS-FORMAT] Usando target_db fixo para ${refBandKey}: ${formatTarget(tgt)}, tol: ${tolerance.toFixed(2)}`);
}
```

**✅ CONFIRMADO**:
- ✅ **PRIORIZA `target_range`** se existir
- ✅ Usa helper `formatTarget()` para exibir range como "[-30, -26]"
- ✅ Usa helper `deriveTolerance()` para calcular tolerância do range
- ✅ Fallback para `target_db` fixo

**📊 STATUS**: Função usada para **renderização de comparação A/B e Reference**, não para tabela de gênero

---

## 📋 SEÇÃO 3: ONDE A TABELA DO GÊNERO MONTA CADA LINHA

### ❌ **PROBLEMA CRÍTICO IDENTIFICADO**

**Arquivo**: `public/audio-analyzer-integration.js`  
**Função**: `renderGenreComparisonTable()`  
**Linhas**: 5860-5920

**Código ATUAL** (INCORRETO):

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
        
        // ❌ PROBLEMA #1: Verifica apenas target_db
        if (targetBand.target_db === null || targetBand.target_db === undefined) {
            console.log(`[GENRE-TABLE] ⏭️ Pulando banda com target null: ${targetKey}`);
            return;
        }
        
        const bandData = userBands[backendKey];
        const energyDb = bandData.energy_db ?? bandData.rms_db ?? (typeof bandData === 'number' ? bandData : null);
        
        if (!Number.isFinite(energyDb)) {
            console.log(`[GENRE-TABLE] 🔇 Banda sem valor válido: ${backendKey}`);
            return;
        }
        
        // ❌ PROBLEMA #2: Usa apenas target_db fixo
        const targetValue = targetBand.target_db;
        const tolerance = targetBand.tol_db || 2.0;
        
        // ❌ PROBLEMA #3: calcSeverity usa sistema de target fixo
        const result = calcSeverity(energyDb, targetValue, tolerance);
        
        const nomeAmigavel = nomesBandas[targetKey] || targetKey;
        
        rows.push(`
            <tr class="genre-row ${result.severityClass}">
                <td class="metric-name">${nomeAmigavel}</td>
                <td class="metric-value">${energyDb.toFixed(2)} dB</td>
                <td class="metric-target">${targetValue.toFixed(1)} dB</td>
                <td class="metric-diff ${result.diff >= 0 ? 'positive' : 'negative'}">${result.diff >= 0 ? '+' : ''}${result.diff.toFixed(2)} dB</td>
                <td class="metric-severity ${result.severityClass}">${result.severity}</td>
                <td class="metric-action ${result.severityClass}">${result.action}</td>
            </tr>
        `);
        bandsCount++;
        console.log(`[GENRE-TABLE] ✅ ${nomeAmigavel}: ${energyDb.toFixed(2)} dB | Target: ${targetValue.toFixed(1)} | ${result.severity}`);
    });
}
```

### ❌ **PROBLEMAS ESPECÍFICOS**

#### **Problema #1**: Não verifica `target_range`

**Linha 5880-5883**:
```javascript
if (targetBand.target_db === null || targetBand.target_db === undefined) {
    console.log(`[GENRE-TABLE] ⏭️ Pulando banda com target null: ${targetKey}`);
    return;
}
```

**DEVERIA SER**:
```javascript
// Verificar se tem target_range OU target_db
const hasTargetRange = targetBand.target_range && 
                       Number.isFinite(targetBand.target_range.min) && 
                       Number.isFinite(targetBand.target_range.max);
const hasTargetDb = Number.isFinite(targetBand.target_db);

if (!hasTargetRange && !hasTargetDb) {
    console.log(`[GENRE-TABLE] ⏭️ Pulando banda sem target válido: ${targetKey}`);
    return;
}
```

---

#### **Problema #2**: Usa apenas `target_db` fixo

**Linha 5893-5894**:
```javascript
const targetValue = targetBand.target_db;
const tolerance = targetBand.tol_db || 2.0;
```

**DEVERIA SER**:
```javascript
let targetValue, tolerance, targetRange = null;

// PRIORIZAR target_range
if (targetBand.target_range && 
    Number.isFinite(targetBand.target_range.min) && 
    Number.isFinite(targetBand.target_range.max)) {
    
    targetRange = targetBand.target_range;
    targetValue = (targetRange.min + targetRange.max) / 2; // Centro do range
    tolerance = (targetRange.max - targetRange.min) / 2;    // Metade da largura
    
    console.log(`[GENRE-TABLE] 🎯 ${targetKey}: usando range [${targetRange.min}, ${targetRange.max}]`);
} else {
    // FALLBACK: target_db fixo
    targetValue = targetBand.target_db;
    tolerance = targetBand.tol_db || 2.0;
    
    console.log(`[GENRE-TABLE] 🎯 ${targetKey}: usando target_db fixo ${targetValue}`);
}
```

---

#### **Problema #3**: `calcSeverity()` calcula diferença errada

**Função atual** (linhas 5706-5730):

```javascript
const calcSeverity = (value, target, tolerance) => {
    if (target === null || target === undefined || !Number.isFinite(value)) {
        return { severity: 'N/A', severityClass: 'na', action: 'Sem dados' };
    }
    
    // ❌ PROBLEMA: Calcula diferença como (valor - target fixo)
    const diff = value - target;
    const absDiff = Math.abs(diff);
    
    if (absDiff <= tolerance) {
        return { severity: 'OK', severityClass: 'ok', action: '✅ Dentro do padrão', diff };
    } else if (absDiff <= tolerance * 2) {
        const action = diff > 0 ? `⚠️ Reduzir ${absDiff.toFixed(1)}` : `⚠️ Aumentar ${absDiff.toFixed(1)}`;
        return { severity: 'ATENÇÃO', severityClass: 'caution', action, diff };
    } else if (absDiff <= tolerance * 3) {
        const action = diff > 0 ? `🟡 Reduzir ${absDiff.toFixed(1)}` : `🟡 Aumentar ${absDiff.toFixed(1)}`;
        return { severity: 'ALTA', severityClass: 'warning', action, diff };
    } else {
        const action = diff > 0 ? `🔴 Reduzir ${absDiff.toFixed(1)}` : `🔴 Aumentar ${absDiff.toFixed(1)}`;
        return { severity: 'CRÍTICA', severityClass: 'critical', action, diff };
    }
};
```

**O QUE DEVERIA FAZER COM `target_range`**:

```javascript
const calcSeverity = (value, target, tolerance, targetRange = null) => {
    if (!Number.isFinite(value)) {
        return { severity: 'N/A', severityClass: 'na', action: 'Sem dados', diff: 0 };
    }
    
    let diff, absDiff;
    
    // 🎯 SE TEM RANGE: calcular distância até o range
    if (targetRange && Number.isFinite(targetRange.min) && Number.isFinite(targetRange.max)) {
        const { min, max } = targetRange;
        
        // DENTRO DO RANGE: diff = 0
        if (value >= min && value <= max) {
            diff = 0;
            absDiff = 0;
        }
        // ABAIXO DO RANGE: diff negativo (distância até min)
        else if (value < min) {
            diff = value - min; // Negativo
            absDiff = min - value;
        }
        // ACIMA DO RANGE: diff positivo (distância até max)
        else {
            diff = value - max; // Positivo
            absDiff = value - max;
        }
    }
    // 🔄 SE NÃO TEM RANGE: usar target fixo (lógica antiga)
    else {
        if (target === null || target === undefined) {
            return { severity: 'N/A', severityClass: 'na', action: 'Sem dados', diff: 0 };
        }
        diff = value - target;
        absDiff = Math.abs(diff);
    }
    
    // ✅ LÓGICA DE SEVERIDADE (mesma para ambos os casos)
    if (absDiff <= tolerance) {
        return { severity: 'OK', severityClass: 'ok', action: '✅ Dentro do padrão', diff };
    } else if (absDiff <= tolerance * 2) {
        const action = diff > 0 ? `⚠️ Reduzir ${absDiff.toFixed(1)}` : `⚠️ Aumentar ${absDiff.toFixed(1)}`;
        return { severity: 'ATENÇÃO', severityClass: 'caution', action, diff };
    } else if (absDiff <= tolerance * 3) {
        const action = diff > 0 ? `🟡 Reduzir ${absDiff.toFixed(1)}` : `🟡 Aumentar ${absDiff.toFixed(1)}`;
        return { severity: 'ALTA', severityClass: 'warning', action, diff };
    } else {
        const action = diff > 0 ? `🔴 Reduzir ${absDiff.toFixed(1)}` : `🔴 Aumentar ${absDiff.toFixed(1)}`;
        return { severity: 'CRÍTICA', severityClass: 'critical', action, diff };
    }
};
```

---

#### **Problema #4**: Coluna "Alvo" mostra apenas `target_db`

**Linha 5903**:
```javascript
<td class="metric-target">${targetValue.toFixed(1)} dB</td>
```

**DEVERIA MOSTRAR RANGE**:
```javascript
<td class="metric-target">${targetRange ? `[${targetRange.min}, ${targetRange.max}]` : targetValue.toFixed(1)} dB</td>
```

**Exemplo**:
- ❌ Atual: `Target: -28.0 dB`
- ✅ Correto: `Target: [-30, -26] dB`

---

## 📋 SEÇÃO 4: FUNÇÕES RELACIONADAS ESCONDIDAS

### ✅ **FUNÇÕES ENCONTRADAS (JÁ IMPLEMENTADAS)**

| Função | Local | Status | Uso |
|--------|-------|--------|-----|
| `scoreToleranceRange()` | `work/lib/audio/features/scoring.js:100` | ✅ **IMPLEMENTADA** | Backend - cálculo de score |
| `addMetric()` com `target_range` | `work/lib/audio/features/scoring.js:412` | ✅ **IMPLEMENTADA** | Backend - adição de métrica com range |
| `calculateFrequencyScore()` | `public/audio-analyzer-integration.js:17235` | ✅ **USA `target_range`** | Frontend - score geral |
| `renderReferenceComparison()` | `public/audio-analyzer-integration.js:15685` | ✅ **USA `target_range`** | Frontend - comparação A/B |
| `formatTarget()` | `public/audio-analyzer-integration.js` | ✅ **IMPLEMENTADA** | Helper - formata range como string |
| `deriveTolerance()` | `public/audio-analyzer-integration.js` | ✅ **IMPLEMENTADA** | Helper - calcula tolerância de range |

### ❌ **FUNÇÕES NÃO ENCONTRADAS**

| Função Buscada | Status |
|----------------|--------|
| `evaluateBand` | ❌ Não existe |
| `calculateBandSeverity` | ❌ Não existe |
| `rangeCheck` | ❌ Não existe |
| `inRange` | ❌ Não existe |
| `evaluateFrequencyBand` | ❌ Não existe |

**Conclusão**: Não há funções antigas comentadas ou perdidas. O suporte a `target_range` foi implementado corretamente em **scoring.js** e **calculateFrequencyScore**, mas **nunca foi implementado em `renderGenreComparisonTable`**.

---

## 📋 SEÇÃO 5: DIAGNÓSTICO FINAL

### ✅ **CONFIRMAÇÕES**

| Item | Status | Observação |
|------|--------|------------|
| Backend envia `target_range` | ✅ **SIM** | Todos os targets em trance.json têm min/max |
| Backend calcula score com range | ✅ **SIM** | `scoreToleranceRange()` implementada e funcional |
| Frontend `calculateFrequencyScore()` usa range | ✅ **SIM** | Prioriza `target_range` sobre `target_db` |
| Frontend `renderReferenceComparison()` usa range | ✅ **SIM** | Renderiza ranges com formatação correta |
| Tabela de gênero usa `target_range` | ❌ **NÃO** | **ÚNICO LUGAR QUE NÃO USA** |

### ❌ **PROBLEMAS NA TABELA DE GÊNERO**

1. ❌ **Não verifica `target_range`**: Só olha `target_db`
2. ❌ **Não prioriza `target_range`**: Usa `target_db` mesmo quando range existe
3. ❌ **Calcula diferença errada**: `valor - target_db` em vez de "distância até o range"
4. ❌ **Exibe target errado**: Mostra `-28.0 dB` em vez de `[-30, -26] dB`
5. ❌ **Severidade incorreta**: Baseada em distância de target fixo, não de range

### ✅ **BACKEND ESTÁ CORRETO**

- ✅ JSONs têm `target_range` + `target_db` + `tol_db: 0`
- ✅ `tol_db: 0` indica "ignore tolerância fixa, use range width"
- ✅ Scoring usa `scoreToleranceRange()` corretamente
- ✅ Sistema de cálculo de score está funcional

### ❌ **FRONTEND TABELA ESTÁ INCORRETO**

- ❌ Ignora `target_range` completamente
- ❌ Usa apenas `target_db` (fallback)
- ❌ Calcula diferença como se fosse target fixo
- ❌ Mostra severidade e ações baseadas em lógica errada

---

## 📋 SEÇÃO 6: SUGESTÃO TÉCNICA

### 🎯 **RECOMENDAÇÃO: CORRIGIR CÁLCULO ATUAL**

**Não é necessário "ativar função existente" - a função já existe em outros lugares.**  
**Não é necessário "reescrever o bloco da tabela" - a estrutura está correta.**

**✅ SOLUÇÃO: Adaptar `calcSeverity()` e uso de targets na tabela de gênero**

---

### 🔧 **IMPLEMENTAÇÃO RECOMENDADA**

#### **Passo 1: Atualizar `calcSeverity()` para suportar ranges**

**Local**: `public/audio-analyzer-integration.js` linha 5706

**Mudança**: Adicionar parâmetro opcional `targetRange` e calcular distância corretamente

```javascript
const calcSeverity = (value, target, tolerance, targetRange = null) => {
    if (!Number.isFinite(value)) {
        return { severity: 'N/A', severityClass: 'na', action: 'Sem dados', diff: 0 };
    }
    
    let diff, absDiff;
    
    // 🎯 SE TEM RANGE: calcular distância até o range
    if (targetRange && Number.isFinite(targetRange.min) && Number.isFinite(targetRange.max)) {
        const { min, max } = targetRange;
        
        if (value >= min && value <= max) {
            diff = 0;
            absDiff = 0;
        } else if (value < min) {
            diff = value - min;
            absDiff = min - value;
        } else {
            diff = value - max;
            absDiff = value - max;
        }
    }
    // 🔄 SE NÃO TEM RANGE: usar target fixo
    else {
        if (target === null || target === undefined) {
            return { severity: 'N/A', severityClass: 'na', action: 'Sem dados', diff: 0 };
        }
        diff = value - target;
        absDiff = Math.abs(diff);
    }
    
    // ✅ Lógica de severidade (mantida igual)
    if (absDiff <= tolerance) {
        return { severity: 'OK', severityClass: 'ok', action: '✅ Dentro do padrão', diff };
    } else if (absDiff <= tolerance * 2) {
        const action = diff > 0 ? `⚠️ Reduzir ${absDiff.toFixed(1)}` : `⚠️ Aumentar ${absDiff.toFixed(1)}`;
        return { severity: 'ATENÇÃO', severityClass: 'caution', action, diff };
    } else if (absDiff <= tolerance * 3) {
        const action = diff > 0 ? `🟡 Reduzir ${absDiff.toFixed(1)}` : `🟡 Aumentar ${absDiff.toFixed(1)}`;
        return { severity: 'ALTA', severityClass: 'warning', action, diff };
    } else {
        const action = diff > 0 ? `🔴 Reduzir ${absDiff.toFixed(1)}` : `🔴 Aumentar ${absDiff.toFixed(1)}`;
        return { severity: 'CRÍTICA', severityClass: 'critical', action, diff };
    }
};
```

---

#### **Passo 2: Atualizar iteração de bandas para priorizar `target_range`**

**Local**: `public/audio-analyzer-integration.js` linha 5893-5895

**Mudança**: Detectar `target_range` e calcular target/tolerance corretos

```javascript
// 🎯 PRIORIZAR target_range sobre target_db
let targetValue, tolerance, targetRange = null;

if (targetBand.target_range && 
    Number.isFinite(targetBand.target_range.min) && 
    Number.isFinite(targetBand.target_range.max)) {
    
    targetRange = targetBand.target_range;
    targetValue = (targetRange.min + targetRange.max) / 2;
    tolerance = (targetRange.max - targetRange.min) / 2;
    
    console.log(`[GENRE-TABLE] 🎯 ${targetKey}: range [${targetRange.min}, ${targetRange.max}], center=${targetValue.toFixed(1)}, width=${tolerance.toFixed(1)}`);
} else if (Number.isFinite(targetBand.target_db)) {
    targetValue = targetBand.target_db;
    tolerance = targetBand.tol_db || 2.0;
    
    console.log(`[GENRE-TABLE] 🎯 ${targetKey}: target_db=${targetValue}, tol_db=${tolerance}`);
} else {
    console.log(`[GENRE-TABLE] ⏭️ Pulando banda sem target válido: ${targetKey}`);
    return;
}

// ✅ Passar targetRange para calcSeverity
const result = calcSeverity(energyDb, targetValue, tolerance, targetRange);
```

---

#### **Passo 3: Atualizar coluna "Alvo" para mostrar range**

**Local**: `public/audio-analyzer-integration.js` linha 5903

**Mudança**: Mostrar `[-30, -26]` em vez de `-28.0`

```javascript
<td class="metric-target">${targetRange ? `[${targetRange.min}, ${targetRange.max}]` : targetValue.toFixed(1)} dB</td>
```

---

### 📊 **IMPACTO DA CORREÇÃO**

#### **Antes** (comportamento atual - INCORRETO):

| Banda | Valor | Target | Diff | Severidade | Razão |
|-------|-------|--------|------|------------|-------|
| Sub | -26.0 | -28.0 | +2.0 | ⚠️ ATENÇÃO | Diferença de 2dB do target fixo |
| Bass | -24.0 | -28.0 | +4.0 | 🟡 ALTA | Diferença de 4dB do target fixo |

**Problema**: Sub -26dB está **DENTRO do range [-30, -26]** mas é marcado como ATENÇÃO!

---

#### **Depois** (comportamento correto):

| Banda | Valor | Target | Diff | Severidade | Razão |
|-------|-------|--------|------|------------|-------|
| Sub | -26.0 | [-30, -26] | 0.0 | ✅ OK | Dentro do range |
| Bass | -24.0 | [-29, -25] | +1.0 | ⚠️ ATENÇÃO | 1dB acima do máximo |

**Solução**: Sub -26dB é corretamente identificado como **DENTRO** do range!

---

### 🎯 **VALIDAÇÃO ESPERADA**

Após a correção, a tabela deve:

1. ✅ Mostrar ranges como `[-30, -26]` na coluna "Alvo"
2. ✅ Calcular diferença como distância até o range (0 se dentro)
3. ✅ Marcar como OK qualquer valor dentro do range
4. ✅ Mostrar severidade baseada na distância fora do range, não do center
5. ✅ Ações sugeridas devem refletir "quanto fora do range" está

---

## 📊 RESUMO FINAL

### ✅ **O QUE JÁ EXISTE E FUNCIONA**

1. ✅ **Backend scoring completo** com `scoreToleranceRange()`
2. ✅ **Frontend calculateFrequencyScore()** usa `target_range`
3. ✅ **Frontend renderReferenceComparison()** usa `target_range`
4. ✅ **Targets JSON** têm `target_range` em todas as bandas
5. ✅ **Sistema de helpers** (`formatTarget`, `deriveTolerance`) funcionais

### ❌ **O QUE ESTÁ QUEBRADO**

1. ❌ **Apenas `renderGenreComparisonTable()`** ignora `target_range`
2. ❌ Usa apenas `target_db` fixo (fallback inadequado)
3. ❌ Calcula diferença errada (valor - target em vez de distância até range)
4. ❌ Mostra severidades incorretas
5. ❌ Exibe targets incorretos (número fixo em vez de range)

### 🎯 **SOLUÇÃO RECOMENDADA**

**"CORRIGIR CÁLCULO ATUAL"** em `renderGenreComparisonTable()`:

1. ✅ Atualizar `calcSeverity()` para aceitar `targetRange` opcional
2. ✅ Priorizar `target_range` sobre `target_db` ao extrair targets
3. ✅ Calcular distância até o range corretamente
4. ✅ Exibir range na coluna "Alvo"

**Impacto**: ✅ Cirúrgico - apenas 3 mudanças pequenas  
**Risco**: ✅ Baixo - mantém compatibilidade com targets legados sem range  
**Resultado**: ✅ Tabela de gênero alinhada com resto do sistema

---

**FIM DA AUDITORIA**
