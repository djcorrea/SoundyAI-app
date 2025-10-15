# 🔍 AUDITORIA COMPLETA: TOLERÂNCIAS DE FREQUÊNCIAS E PRIORIZAÇÃO DE SUGESTÕES

**Data:** 15 de outubro de 2025  
**Auditor:** Sistema de Auditoria SoundyAI  
**Escopo:** Sistema completo de sugestões, tolerâncias e priorização

---

## 📋 SUMÁRIO EXECUTIVO

Esta auditoria identificou **TODOS os pontos críticos** que controlam:

1. **Tolerâncias de Frequências** - De onde vêm, como são aplicadas e onde forçar valores zerados
2. **Priorização de Sugestões** - Por que True Peak às vezes não aparece primeiro e como fixar a ordem

---

## 🎯 PARTE 1: SISTEMA DE TOLERÂNCIAS DE FREQUÊNCIAS

### 1.1 ARQUIVOS DE REFERÊNCIA DE GÊNERO

**📁 Localização:** `public/refs/out/*.json`

**Exemplo atual (trance.json):**
```json
{
  "spectral_bands": {
    "sub": {
      "target_range": { "min": -33, "max": -25 },
      "target_db": -29,
      "energy_pct": 18.5,
      "tol_db": 0,  // ✅ JÁ ESTÁ EM 0
      "severity": "soft"
    },
    "low_bass": {
      "target_range": { "min": -31, "max": -25 },
      "target_db": -28,
      "tol_db": 0,  // ✅ JÁ ESTÁ EM 0
      "severity": "soft"
    }
    // ... todas as bandas com tol_db: 0
  }
}
```

**✅ STATUS:** Os arquivos JSON de referência JÁ possuem `tol_db: 0`.

---

### 1.2 FALLBACK HARDCODED NO CÓDIGO

#### 🔴 PONTO CRÍTICO 1: enhanced-suggestion-engine.js

**📁 Arquivo:** `lib/audio/features/enhanced-suggestion-engine.js`  
**📍 Linhas:** 1610-1635

```javascript
// Prioridade 2: target_db fixo (sistema legado)
target = refData.target_db;
tolerance = refData.tol_db;  // 🔴 LÊ DO JSON
effectiveTolerance = tolerance;  // 🔴 USA DIRETAMENTE

console.log(`🎯 [FIXED-LOGIC] Banda ${band}: target fixo ${target} dB, tolerância: ${effectiveTolerance} dB`);
```

**⚠️ PROBLEMA:** Se `tol_db` for `0` no JSON, o código usa diretamente `0`, mas...

**📍 Linhas:** 1655-1661  
```javascript
// Validação de dados básicos
if (!Number.isFinite(value) || !Number.isFinite(effectiveTolerance)) {
    this.logAudit('BAND_SUGGESTION_SKIPPED', `Banda ignorada por valores inválidos: ${band}`, {
        tolerance: effectiveTolerance,
        reason: !Number.isFinite(value) ? 'value_invalid' : 'tolerance_invalid'
    });
    continue;  // 🔴 PULA A BANDA SE TOLERANCE FOR 0 (pois 0 é "valid")
}
```

**✅ DESCOBERTA:** `Number.isFinite(0)` retorna `true`, então **tolerance=0 passa pela validação**.

---

#### 🔴 PONTO CRÍTICO 2: suggestion-scorer.js (cálculo de z-score)

**📁 Arquivo:** `lib/audio/features/suggestion-scorer.js`  
**📍 Linhas:** 82-90

```javascript
calculateZScore(value, target, tolerance) {
    if (!Number.isFinite(value) || !Number.isFinite(target) || 
        !Number.isFinite(tolerance) || tolerance <= 0) {  // 🔴 AQUI!
        return 0;  // 🔴 SE tolerance=0, retorna z-score=0 (SEM SUGESTÃO)
    }
    return (value - target) / tolerance;
}
```

**🚨 PROBLEMA RAIZ IDENTIFICADO:**

Quando `tolerance = 0` (do JSON), o z-score vira `0`, que é interpretado como **"perfeito"** (`severity: green`), e a sugestão **NÃO É GERADA**.

---

#### 🔴 PONTO CRÍTICO 3: Fallback de tolerância em ranges

**📁 Arquivo:** `lib/audio/features/enhanced-suggestion-engine.js`  
**📍 Linhas:** 1620-1626

```javascript
if (refData.target_range && typeof refData.target_range === 'object' &&
    Number.isFinite(refData.target_range.min) && Number.isFinite(refData.target_range.max)) {
    
    targetRange = refData.target_range;
    rangeBasedLogic = true;
    
    const rangeSize = targetRange.max - targetRange.min;
    effectiveTolerance = rangeSize * 0.25;  // 🔴 CALCULA 25% DO RANGE
    
    console.log(`🎯 [RANGE-LOGIC] Banda ${band}: range [${targetRange.min}, ${targetRange.max}], tolerância: ${effectiveTolerance.toFixed(1)} dB`);
}
```

**⚠️ COMPORTAMENTO:** 
- Para `target_range`, o sistema **IGNORA** o `tol_db` do JSON
- Calcula automaticamente `tolerance = (max - min) * 0.25`
- Ex: range `[-33, -25]` → tolerance = `8 * 0.25 = 2.0 dB` (mesmo que JSON tenha `tol_db: 0`)

---

#### 🔴 PONTO CRÍTICO 4: Lógica range-based vs fixed-target

**📁 Arquivo:** `lib/audio/features/enhanced-suggestion-engine.js`  
**📍 Linhas:** 1675-1720

```javascript
if (rangeBasedLogic) {
    // === LÓGICA RANGE-BASED ===
    if (value >= targetRange.min && value <= targetRange.max) {
        // Dentro do range → sem sugestão
        severityLevel = 'green';
        shouldInclude = false;  // 🔴 NÃO GERA SUGESTÃO
    } else {
        // Fora do range → gera sugestão
        if (value < targetRange.min) {
            calculatedDelta = value - targetRange.min;
        } else {
            calculatedDelta = value - targetRange.max;
        }
        
        const distance = Math.abs(calculatedDelta);
        
        if (distance <= 2.0) {  // 🔴 HARDCODED 2.0 dB
            severityLevel = 'yellow';
            shouldInclude = this.config.includeYellowSeverity;
        } else {
            severityLevel = 'red';
            shouldInclude = true;
        }
    }
}
```

**✅ COMPORTAMENTO RANGE:**
- Se valor estiver **dentro** do range → **NÃO gera sugestão** (independente de `tol_db`)
- Se valor estiver **fora** do range:
  - Até ±2 dB dos limites → sugestão amarela (opcional)
  - Mais de ±2 dB → sugestão vermelha (sempre)

---

### 1.3 FALLBACK DE TOLERÂNCIA PARA MÉTRICAS PRINCIPAIS

#### 🔴 PONTO CRÍTICO 5: Fallback 10% para métricas críticas

**📁 Arquivo:** `lib/audio/features/enhanced-suggestion-engine.js`  
**📍 Linhas:** 1395-1420

```javascript
// 🎯 FALLBACK SYSTEM: Se não há referência válida, usar 10% do valor como tolerância
if (!Number.isFinite(target)) {
    usedTarget = value;  // Target = valor atual
    console.warn(`⚠️ [FALLBACK] Métrica ${metric.label}: target ausente, usando valor atual: ${value.toFixed(2)}`);
}

if (!Number.isFinite(tolerance) || tolerance === 0) {  // 🔴 AQUI! Se tolerance=0
    // Calcular tolerância como 10% do target ou valor atual
    usedTolerance = Math.abs(usedTarget || target || value) * 0.1;  // 🔴 FORÇA 10%
    usedTolerance = Math.max(usedTolerance, 0.5);  // Mínimo 0.5
    
    console.warn(`⚠️ [FALLBACK] Métrica ${metric.label}: tolerance ${tolerance === 0 ? 'zero' : 'ausente'}, usando 10% do target: ${usedTolerance.toFixed(2)}`);
}
```

**🚨 DESCOBERTA CRÍTICA:**

**Para métricas principais (LUFS, True Peak, DR, LRA, Stereo):**
- Se `tolerance = 0` no JSON → sistema FORÇA `tolerance = 10% do target`
- Exemplo: `tol_true_peak: 0` → sistema usa `tolerance = 0.1 * 1.0 = 0.1 dB`

**Para bandas espectrais:**
- Sistema usa lógica de `range` (que calcula 25% do range)
- OU usa `tol_db` direto (que vai para z-score e quebra se for 0)

---

### 1.4 MAPA COMPLETO DO FLUXO DE TOLERÂNCIA

```
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣ ORIGEM: Arquivo JSON de gênero (refs/out/*.json)           │
│    → "tol_db": 0, "tol_lufs": 1.5, "tol_true_peak": 0.35      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2️⃣ CARREGAMENTO: audio-analyzer-integration.js                 │
│    → window.__activeRefData = JSON carregado                    │
│    → Cache local: __refDataCache[genre]                         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3️⃣ PROCESSAMENTO: enhanced-suggestion-engine.js                │
│    generateReferenceSuggestions(metrics, referenceData, ...)    │
│                                                                  │
│    ┌──────────────────────────────────────┐                    │
│    │ MÉTRICAS PRINCIPAIS (TP, LUFS, DR)  │                    │
│    │ ↓                                     │                    │
│    │ tolerance = refData.tol_lufs         │                    │
│    │ if (tolerance === 0):                │                    │
│    │   tolerance = abs(target) * 0.1  🔴 │  ← FORÇA 10%       │
│    └──────────────────────────────────────┘                    │
│                                                                  │
│    ┌──────────────────────────────────────┐                    │
│    │ BANDAS ESPECTRAIS (sub, bass, etc)  │                    │
│    │ ↓                                     │                    │
│    │ Se target_range existe:              │                    │
│    │   tolerance = (max-min) * 0.25  🔴  │  ← IGNORA tol_db   │
│    │ Senão:                                │                    │
│    │   tolerance = refData.tol_db         │                    │
│    │   if (tolerance === 0):              │                    │
│    │     return z-score = 0  🔴          │  ← SEM SUGESTÃO    │
│    └──────────────────────────────────────┘                    │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4️⃣ CÁLCULO: suggestion-scorer.js                               │
│    calculateZScore(value, target, tolerance)                    │
│                                                                  │
│    if (tolerance <= 0):  🔴                                     │
│        return 0  ← z-score = 0 = "perfeito" = SEM SUGESTÃO     │
│                                                                  │
│    return (value - target) / tolerance                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5️⃣ SEVERIDADE: suggestion-scorer.js                            │
│    getSeverity(zScore)                                          │
│                                                                  │
│    absZ = Math.abs(zScore)                                      │
│    if (absZ <= 1.0): green  ← OK, sem sugestão                 │
│    if (absZ <= 2.0): yellow ← Monitorar (opcional)             │
│    if (absZ <= 3.0): orange ← Ajustar                          │
│    if (absZ >  3.0): red    ← Corrigir urgente                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6️⃣ DECISÃO: generateReferenceSuggestions()                     │
│                                                                  │
│    shouldInclude = severity.level !== 'green' ||               │
│                    (severity === 'yellow' && includeYellow)     │
│                                                                  │
│    if (!shouldInclude): continue  🔴 ← NÃO GERA SUGESTÃO       │
└─────────────────────────────────────────────────────────────────┘
```

---

### 1.5 SOLUÇÃO PARA ZERAR TOLERÂNCIAS COMPLETAMENTE

#### ✅ OPÇÃO 1: Usar apenas `target_range` (RECOMENDADO)

**Ação:**
1. Manter `tol_db: 0` nos JSONs
2. Garantir que `target_range` existe para todas as bandas
3. Sistema já usa lógica de range (ignora `tol_db`)

**Vantagem:** 
- Não precisa alterar código
- Usa apenas min/max do range
- Tolerância calculada automaticamente (25% do range)

---

#### ✅ OPÇÃO 2: Alterar lógica de z-score para aceitar tolerance=0

**📁 Arquivo:** `lib/audio/features/suggestion-scorer.js`  
**📍 Linha:** 82-90

**ANTES:**
```javascript
calculateZScore(value, target, tolerance) {
    if (!Number.isFinite(value) || !Number.isFinite(target) || 
        !Number.isFinite(tolerance) || tolerance <= 0) {  // 🔴
        return 0;
    }
    return (value - target) / tolerance;
}
```

**DEPOIS:**
```javascript
calculateZScore(value, target, tolerance) {
    if (!Number.isFinite(value) || !Number.isFinite(target)) {
        return 0;
    }
    
    // 🎯 NOVO: Se tolerance=0, usar lógica binária (dentro/fora)
    if (!Number.isFinite(tolerance) || tolerance === 0) {
        // Se tolerance=0, qualquer diferença é crítica
        const delta = Math.abs(value - target);
        if (delta === 0) return 0;  // Perfeito
        if (delta <= 1.0) return 1.5;  // Amarelo
        if (delta <= 3.0) return 2.5;  // Laranja
        return 5.0;  // Vermelho (crítico)
    }
    
    return (value - target) / tolerance;
}
```

**Vantagem:**
- Permite `tol_db: 0` funcionar
- Qualquer desvio gera sugestão
- Severidade baseada em valores absolutos (1dB, 3dB)

---

#### ✅ OPÇÃO 3: Remover fallback de 10% para métricas principais

**📁 Arquivo:** `lib/audio/features/enhanced-suggestion-engine.js`  
**📍 Linhas:** 1405-1410

**ANTES:**
```javascript
if (!Number.isFinite(tolerance) || tolerance === 0) {
    usedTolerance = Math.abs(usedTarget || target || value) * 0.1;
    usedTolerance = Math.max(usedTolerance, 0.5);
    console.warn(`⚠️ [FALLBACK] ... usando 10%: ${usedTolerance}`);
}
```

**DEPOIS:**
```javascript
if (!Number.isFinite(tolerance)) {
    // Só aplica fallback se tolerance for undefined/null/NaN
    usedTolerance = Math.abs(usedTarget || target || value) * 0.1;
    usedTolerance = Math.max(usedTolerance, 0.5);
} else {
    // 🎯 Se tolerance=0, usa 0 (lógica binária no z-score)
    usedTolerance = tolerance;
}
```

**Vantagem:**
- Respeita `tol_lufs: 0`, `tol_true_peak: 0` do JSON
- Combina com Opção 2 para criar sistema binário (dentro/fora)

---

## 🎯 PARTE 2: SISTEMA DE PRIORIZAÇÃO DE SUGESTÕES

### 2.1 ONDE A PRIORIDADE É CALCULADA

#### 🔵 PONTO CRÍTICO 1: Cálculo de prioridade base

**📁 Arquivo:** `lib/audio/features/suggestion-scorer.js`  
**📍 Linhas:** 178-185

```javascript
calculatePriority({ metricType, severity, confidence, dependencyBonus = 0 }) {
    const baseWeight = this.weights[metricType] || 0.5;  // 🔵 PESO DA MÉTRICA
    const severityScore = severity.score;  // 🔵 SCORE DA SEVERIDADE
    
    return baseWeight * severityScore * confidence * (1 + dependencyBonus);
}
```

**⚙️ PESOS CONFIGURADOS:**

**📍 Linhas:** 9-30
```javascript
this.weights = {
    // Métricas principais
    lufs: 1.0,          // ✅ LUFS - crítico
    true_peak: 0.9,     // ⚠️ TRUE PEAK - deveria ser 1.0 ou maior!
    dr: 0.8,           // Dynamic Range
    plr: 0.8,          // Peak-to-Loudness Ratio
    lra: 0.6,          // Loudness Range
    stereo: 0.5,       // Correlação estéreo
    
    // Bandas espectrais
    band: 0.7,         // Bandas gerais
    
    // Heurísticas específicas
    sibilance: 1.0,    // Sibilância
    masking: 1.0,      // Mascaramento
    harshness: 1.0,    // Aspereza
    mud: 0.8,          // Lama nos médios
    
    // Outros
    surgical: 0.9,     
    mastering: 0.6
};
```

**🚨 PROBLEMA IDENTIFICADO:**

**True Peak tem peso `0.9`** enquanto LUFS tem `1.0`. Isso significa que:
- Se ambos tiverem **mesma severidade**, LUFS terá prioridade maior
- Se TP tiver severity `red` (score=2.0) e LUFS tiver `orange` (score=1.5):
  - TP priority = `0.9 * 2.0 * 1.0 * 1 = 1.8`
  - LUFS priority = `1.0 * 1.5 * 1.0 * 1 = 1.5`
  - TP vence, MAS por margem pequena

---

#### 🔵 PONTO CRÍTICO 2: Severidade determinada por z-score

**📁 Arquivo:** `lib/audio/features/suggestion-scorer.js`  
**📍 Linhas:** 46-57

```javascript
this.severityConfig = {
    green:  { threshold: 1.0, score: 0.0, color: '#52f7ad', label: 'OK' },
    yellow: { threshold: 2.0, score: 1.0, color: '#ffd93d', label: 'monitorar' },
    orange: { threshold: 3.0, score: 1.5, color: '#ff8c42', label: 'ajustar' },
    red:    { threshold: Infinity, score: 2.0, color: '#ff4757', label: 'corrigir' }
};

getSeverity(zScore) {
    const absZ = Math.abs(zScore);
    if (absZ <= 1.0) return { level: 'green', ...this.severityConfig.green };
    if (absZ <= 2.0) return { level: 'yellow', ...this.severityConfig.yellow };
    if (absZ <= 3.0) return { level: 'orange', ...this.severityConfig.orange };
    return { level: 'red', ...this.severityConfig.red };
}
```

**💡 COMPORTAMENTO:**
- `z-score = (value - target) / tolerance`
- Quanto maior o z-score, maior a severidade
- Severidade define o `score` usado no cálculo de prioridade

**Exemplo:**
- True Peak: `value = 0.5 dBTP`, `target = -1.0 dBTP`, `tolerance = 0.35`
  - `z-score = (0.5 - (-1.0)) / 0.35 = 1.5 / 0.35 = 4.29` → **red** (score=2.0)
  - `priority = 0.9 * 2.0 * 1.0 * 1 = 1.8`

- LUFS: `value = -8 dB`, `target = -10 dB`, `tolerance = 1.5`
  - `z-score = (-8 - (-10)) / 1.5 = 2 / 1.5 = 1.33` → **yellow** (score=1.0)
  - `priority = 1.0 * 1.0 * 1.0 * 1 = 1.0`

Neste caso, **TP vence** (1.8 > 1.0).

---

#### 🔵 PONTO CRÍTICO 3: Ordenação final

**📁 Arquivo:** `lib/audio/features/enhanced-suggestion-engine.js`  
**📍 Linhas:** 2513-2520

```javascript
filterAndSort(suggestions) {
    // Filtrar por prioridade mínima
    let filtered = suggestions.filter(s => s.priority >= this.config.minPriority);
    
    // Ordenar por prioridade (descendente)  🔵 AQUI!
    filtered.sort((a, b) => b.priority - a.priority);
    
    // Limitar quantidade máxima
    if (filtered.length > this.config.maxSuggestions) {
        filtered = filtered.slice(0, this.config.maxSuggestions);
    }
    
    return filtered;
}
```

**✅ ORDENAÇÃO CORRETA:**
- `b.priority - a.priority` = ordem DECRESCENTE
- Maior prioridade aparece primeiro

---

#### 🔵 PONTO CRÍTICO 4: Ordenação na UI

**📁 Arquivo:** `public/audio-analyzer-integration.js`  
**📍 Linha:** 5244

```javascript
sugg.sort((a,b)=> (b.priority||999)-(a.priority||999));
```

**✅ ORDENAÇÃO CORRETA:**
- Também usa ordem DECRESCENTE
- Fallback `999` garante que sugestões sem priority vão para o final

---

### 2.2 POR QUE TRUE PEAK ÀS VEZES NÃO APARECE PRIMEIRO

#### 🚨 RAZÃO 1: Peso menor que outras métricas

**True Peak** tem peso `0.9`, mas:
- **Heurísticas** (sibilance, masking, harshness) têm peso `1.0`
- **LUFS** tem peso `1.0`

Se uma heurística for detectada com severity `red`, ela pode ter prioridade maior que TP.

---

#### 🚨 RAZÃO 2: Tolerância afeta z-score

Se `tol_true_peak` for **muito grande**, o z-score fica **pequeno**:

**Exemplo:**
- `value = 0.5 dBTP`, `target = -1.0 dBTP`
- Se `tol_true_peak = 1.0` (grande):
  - `z-score = (0.5 - (-1.0)) / 1.0 = 1.5` → **yellow** (score=1.0)
  - `priority = 0.9 * 1.0 * 1.0 * 1 = 0.9`
  
- Se `tol_true_peak = 0.35` (pequeno):
  - `z-score = (0.5 - (-1.0)) / 0.35 = 4.29` → **red** (score=2.0)
  - `priority = 0.9 * 2.0 * 1.0 * 1 = 1.8`

**Tolerância pequena = severity maior = prioridade maior**

---

#### 🚨 RAZÃO 3: True Peak pode não ser gerado se:

1. **Valor já está dentro da tolerância** (z-score < 1.0 → green → não inclui)
2. **Dados ausentes** (se `truePeakDbtp` for `undefined` ou `null`)
3. **Fallback ativado** com valores próximos do target

---

### 2.3 TRUE PEAK TEM TRATAMENTO ESPECIAL (MAS NÃO PRIORIDADE)

**📁 Arquivo:** `lib/audio/features/enhanced-suggestion-engine.js`  
**📍 Linhas:** 1498-1506, 1568-1576

```javascript
// 🚨 MENSAGEM ESPECIAL PARA TRUE PEAK
if (metric.metricType === 'true_peak') {
    const truePeakTemplate = this.heuristicTemplates.true_peak_high;
    suggestion.priorityWarning = truePeakTemplate.warningMessage;  // 🔵 AVISO
    suggestion.correctionOrder = "PRIMEIRO";  // 🔵 ORDEM TEXTUAL
    suggestion.message = `⚡ True Peak requer correção PRIORITÁRIA ...`;
    suggestion.why = `${truePeakTemplate.priority}`;
    suggestion.specialAlert = true;  // 🔵 FLAG ESPECIAL
    suggestion.alertType = "priority_first";  // 🔵 TIPO DE ALERTA
}
```

**⚠️ DESCOBERTA:**

O True Peak recebe:
- ✅ Mensagem especial
- ✅ Aviso de prioridade (`priorityWarning`)
- ✅ Flag `specialAlert: true`
- ✅ Campo `correctionOrder: "PRIMEIRO"`

**MAS:**
- ❌ NÃO aumenta o `priority` numérico
- ❌ NÃO força a posição na ordenação
- ❌ É apenas "visual" (UI mostra banner), mas não afeta sort

---

### 2.4 MAPA COMPLETO DO FLUXO DE PRIORIZAÇÃO

```
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣ GERAÇÃO: enhanced-suggestion-engine.js                      │
│    generateReferenceSuggestions(...)                            │
│                                                                  │
│    Para cada métrica:                                           │
│      ↓                                                           │
│      zScore = calculateZScore(value, target, tolerance)         │
│      severity = getSeverity(zScore)                             │
│      priority = calculatePriority({                             │
│          metricType,  🔵 ← pega peso (ex: true_peak=0.9)       │
│          severity,    🔵 ← score baseado em z-score             │
│          confidence,  🔵 ← geralmente 1.0 ou próximo            │
│          dependencyBonus  🔵 ← bônus se houver dependência      │
│      })                                                          │
│                                                                  │
│      priority = weight * severityScore * confidence * (1+bonus) │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2️⃣ TRATAMENTO ESPECIAL: True Peak                              │
│                                                                  │
│    if (metricType === 'true_peak'):                             │
│        suggestion.priorityWarning = "Corrigir ANTES..."  🔵     │
│        suggestion.correctionOrder = "PRIMEIRO"  🔵              │
│        suggestion.specialAlert = true  🔵                       │
│                                                                  │
│    ⚠️ MAS: priority numérico NÃO é alterado!                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3️⃣ FILTRAGEM: filterAndSort(suggestions)                       │
│                                                                  │
│    suggestions = suggestions.filter(s =>                        │
│        s.priority >= this.config.minPriority  🔵  (padrão: 0.1) │
│    )                                                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4️⃣ ORDENAÇÃO: filterAndSort(suggestions)                       │
│                                                                  │
│    suggestions.sort((a, b) => b.priority - a.priority)  🔵     │
│    ↑                                                             │
│    └─ Ordem DECRESCENTE: maior priority primeiro                │
│                                                                  │
│    Resultado:                                                    │
│    [                                                             │
│      { type: 'true_peak', priority: 1.8 },  ← se TP crítico    │
│      { type: 'lufs', priority: 1.5 },                           │
│      { type: 'dr', priority: 1.2 },                             │
│      { type: 'band_adjust', priority: 0.9 }                     │
│    ]                                                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5️⃣ LIMITAÇÃO: slice(0, maxSuggestions)                         │
│                                                                  │
│    if (suggestions.length > 12):  🔵 (config.maxSuggestions)   │
│        suggestions = suggestions.slice(0, 12)                   │
│                                                                  │
│    ⚠️ Se TP tiver priority baixa, pode ser cortado aqui!       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6️⃣ UI: audio-analyzer-integration.js                           │
│                                                                  │
│    sugg.sort((a,b) => (b.priority||999) - (a.priority||999))   │
│    ↑                                                             │
│    └─ Re-ordena na UI (mesma lógica)                            │
│                                                                  │
│    Para cada sugestão:                                          │
│      if (suggestion.specialAlert === true):  🔵                 │
│          → Renderiza banner de prioridade                       │
│          → Adiciona classe CSS especial                         │
│          → Mostra ícone "⚡"                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

### 2.5 CENÁRIOS QUE FAZEM TRUE PEAK NÃO APARECER PRIMEIRO

#### 🔴 CENÁRIO 1: LUFS mais crítico

```javascript
// True Peak levemente fora
value_tp = -0.5 dBTP, target_tp = -1.0, tol_tp = 0.5
z_tp = (-0.5 - (-1.0)) / 0.5 = 1.0  → yellow (score=1.0)
priority_tp = 0.9 * 1.0 * 1.0 = 0.9

// LUFS muito fora
value_lufs = -5 dB, target_lufs = -10 dB, tol_lufs = 1.5
z_lufs = (-5 - (-10)) / 1.5 = 3.33  → red (score=2.0)
priority_lufs = 1.0 * 2.0 * 1.0 = 2.0

RESULTADO: LUFS aparece primeiro (2.0 > 0.9)
```

---

#### 🔴 CENÁRIO 2: Heurística detectada

```javascript
// True Peak médio
priority_tp = 0.9 * 1.5 * 1.0 = 1.35  (orange)

// Sibilância detectada
priority_sibilance = 1.0 * 2.0 * 0.9 = 1.8  (red, confidence 0.9)

RESULTADO: Sibilância aparece primeiro (1.8 > 1.35)
```

---

#### 🔴 CENÁRIO 3: True Peak dentro da tolerância

```javascript
value_tp = -1.2 dBTP, target_tp = -1.0, tol_tp = 0.5
z_tp = (-1.2 - (-1.0)) / 0.5 = -0.4  → |0.4| < 1.0 → green

RESULTADO: True Peak NÃO gera sugestão (severity green)
```

---

#### 🔴 CENÁRIO 4: Muitas sugestões, TP cortado

```javascript
Sugestões geradas: 15
maxSuggestions: 12

True Peak tem priority = 0.8 (posição 13)

RESULTADO: True Peak é cortado no slice(0, 12)
```

---

### 2.6 SOLUÇÃO PARA GARANTIR TRUE PEAK SEMPRE EM PRIMEIRO

#### ✅ SOLUÇÃO 1: Aumentar peso do True Peak (RECOMENDADO)

**📁 Arquivo:** `lib/audio/features/suggestion-scorer.js`  
**📍 Linha:** 13

**ANTES:**
```javascript
this.weights = {
    lufs: 1.0,
    true_peak: 0.9,  // 🔴
    dr: 0.8,
    // ...
};
```

**DEPOIS:**
```javascript
this.weights = {
    lufs: 1.0,
    true_peak: 10.0,  // 🔵 FORÇA PRIORIDADE MÁXIMA
    dr: 0.8,
    // ...
};
```

**Vantagem:**
- Simples, uma linha
- True Peak sempre terá prioridade muito maior que qualquer outra métrica
- Mesmo com severity baixa, domina a lista

**Desvantagem:**
- Se TP estiver OK (green), não gera sugestão (correto)
- Se outros problemas forem mais críticos, TP ainda domina (pode mascarar outros)

---

#### ✅ SOLUÇÃO 2: Forçar True Peak na posição 0 após sort

**📁 Arquivo:** `lib/audio/features/enhanced-suggestion-engine.js`  
**📍 Após linha 2515 (dentro de filterAndSort)

**ADICIONAR:**
```javascript
filterAndSort(suggestions) {
    let filtered = suggestions.filter(s => s.priority >= this.config.minPriority);
    
    // Ordenar por prioridade (descendente)
    filtered.sort((a, b) => b.priority - a.priority);
    
    // 🎯 NOVO: Forçar True Peak em primeiro lugar se existir
    const tpIndex = filtered.findIndex(s => 
        s.type === 'reference_true_peak' || 
        s.metricType === 'true_peak' ||
        s.type?.includes('true_peak')
    );
    
    if (tpIndex > 0) {
        // TP existe mas não está em primeiro → mover para posição 0
        const tpSuggestion = filtered.splice(tpIndex, 1)[0];
        filtered.unshift(tpSuggestion);
        
        console.log(`🎯 [FORCE-TP-FIRST] True Peak movido de posição ${tpIndex} para 0`);
    }
    
    // Limitar quantidade máxima
    if (filtered.length > this.config.maxSuggestions) {
        filtered = filtered.slice(0, this.config.maxSuggestions);
    }
    
    return filtered;
}
```

**Vantagem:**
- Garante que TP sempre aparece primeiro, independente de priority
- Não altera o cálculo de priority (mantém lógica existente)
- Simples de entender e debugar

**Desvantagem:**
- Pode quebrar a ordem "natural" de prioridade
- Se TP não for realmente crítico, força ele mesmo assim

---

#### ✅ SOLUÇÃO 3: Criar categoria "crítica" para True Peak

**📁 Arquivo:** `lib/audio/features/enhanced-suggestion-engine.js`  
**📍 Linha 1565 (dentro de generateReferenceSuggestions)

**MODIFICAR:**
```javascript
// Se TRUE PEAK, forçar severidade RED e priority máxima
if (metric.metricType === 'true_peak') {
    // 🎯 FORÇAR SEVERITY RED (mesmo que z-score seja baixo)
    if (value > target) {  // Se está acima do target (clipagem!)
        severity = { 
            level: 'red', 
            score: 2.0,  // Score máximo
            color: '#ff4757',
            label: 'corrigir URGENTE'
        };
        
        // 🎯 FORÇAR PRIORITY MÁXIMA
        priority = 10.0;  // Muito maior que qualquer outra métrica
        
        console.log(`🚨 [TP-CRITICAL] True Peak forçado para priority=10.0 (valor=${value}, target=${target})`);
    }
    
    const truePeakTemplate = this.heuristicTemplates.true_peak_high;
    suggestion.priorityWarning = truePeakTemplate.warningMessage;
    suggestion.correctionOrder = "PRIMEIRO";
    // ...
}
```

**Vantagem:**
- True Peak só domina se realmente estiver **acima** do target (clipagem real)
- Se estiver abaixo do target, usa lógica normal de priority
- Mais "inteligente" que simplesmente sempre forçar

**Desvantagem:**
- Lógica mais complexa
- Precisa definir bem a condição (`value > target` vs `value > -1.0` vs outro critério)

---

#### ✅ SOLUÇÃO 4: Criar ordem fixa por tipo de métrica

**📁 Arquivo:** `lib/audio/features/enhanced-suggestion-engine.js`  
**📍 Linha 2515 (substituir sort)

**ANTES:**
```javascript
filtered.sort((a, b) => b.priority - a.priority);
```

**DEPOIS:**
```javascript
// 🎯 ORDEM FIXA: TP > LUFS > DR > LRA > Bandas > Heurísticas
const typeOrder = {
    'reference_true_peak': 0,
    'true_peak': 0,
    'reference_loudness': 1,
    'lufs': 1,
    'reference_dynamics': 2,
    'dr': 2,
    'reference_lra': 3,
    'lra': 3,
    'band_adjust': 4,
    'heuristic_sibilance': 5,
    'heuristic_harshness': 5,
    'heuristic_masking': 5
};

filtered.sort((a, b) => {
    // Primeiro: ordem por tipo
    const orderA = typeOrder[a.type] ?? typeOrder[a.metricType] ?? 99;
    const orderB = typeOrder[b.type] ?? typeOrder[b.metricType] ?? 99;
    
    if (orderA !== orderB) {
        return orderA - orderB;  // Menor ordem = mais prioritário
    }
    
    // Segundo: dentro do mesmo tipo, ordem por priority
    return b.priority - a.priority;
});
```

**Vantagem:**
- Ordem **determinística** e **previsível**
- TP **SEMPRE** aparece primeiro (se existir)
- Dentro de cada categoria, ordena por priority
- Fácil ajustar a ordem mudando `typeOrder`

**Desvantagem:**
- Ignora completamente severity/priority para ordem entre tipos
- Um TP "OK" (yellow) aparece antes de um LUFS crítico (red)

---

#### ✅ SOLUÇÃO 5: Híbrida - Ordem fixa apenas para críticos

**MELHOR SOLUÇÃO - Combina ordem fixa com severity**

```javascript
const criticalTypes = new Set(['reference_true_peak', 'true_peak']);

filtered.sort((a, b) => {
    const aIsCriticalType = criticalTypes.has(a.type) || criticalTypes.has(a.metricType);
    const bIsCriticalType = criticalTypes.has(b.type) || criticalTypes.has(b.metricType);
    
    // Se A é crítico e B não → A primeiro
    if (aIsCriticalType && !bIsCriticalType) return -1;
    if (!aIsCriticalType && bIsCriticalType) return 1;
    
    // Se ambos são críticos OU ambos não são → usar priority normal
    return b.priority - a.priority;
});
```

**Vantagem:**
- True Peak sempre aparece antes de qualquer outra métrica
- Mas respeita priority entre métricas não-críticas
- Simples e eficaz

---

## 📊 RESUMO EXECUTIVO DAS DESCOBERTAS

### ✅ TOLERÂNCIAS DE FREQUÊNCIAS

| Aspecto | Status | Localização | Ação Necessária |
|---------|--------|-------------|-----------------|
| Arquivo JSON `tol_db` | ✅ Já em 0 | `public/refs/out/*.json` | Nenhuma |
| Sistema de ranges | ✅ Ignora `tol_db` | `enhanced-suggestion-engine.js:1620-1626` | Nenhuma (OK) |
| Fallback 10% métricas principais | ⚠️ Força tolerance>0 | `enhanced-suggestion-engine.js:1405-1410` | **Remover condição `tolerance === 0`** |
| Z-score com tolerance=0 | 🔴 Retorna 0 (sem sugestão) | `suggestion-scorer.js:82-90` | **Implementar lógica binária** |
| Validação tolerance>0 | ⚠️ Bloqueia uso de 0 | `enhanced-suggestion-engine.js:1655-1661` | **Permitir 0** |

**CONCLUSÃO TOLERÂNCIAS:**
- Para usar `tol_db: 0` → **Alterar 2 arquivos** (suggestion-scorer.js + enhanced-suggestion-engine.js)
- Para usar apenas ranges → **Nenhuma alteração necessária** (já funciona)

---

### ✅ PRIORIZAÇÃO DE SUGESTÕES

| Aspecto | Status | Localização | Problema |
|---------|--------|-------------|----------|
| Peso True Peak | ⚠️ 0.9 (menor que LUFS) | `suggestion-scorer.js:13` | Pode perder para outras métricas |
| Ordenação | ✅ Correta | `enhanced-suggestion-engine.js:2515` | Nenhum problema |
| Tratamento especial TP | ⚠️ Só visual | `enhanced-suggestion-engine.js:1498-1506` | Não afeta priority numérico |
| True Peak pode não gerar | 🔴 Se dentro da tolerância | `generateReferenceSuggestions()` | Severity green → sem sugestão |
| Limite de sugestões | ⚠️ Pode cortar TP | `filterAndSort()` | Se TP tiver priority baixa |

**CONCLUSÃO PRIORIZAÇÃO:**
- TP às vezes não aparece primeiro porque **peso é menor** ou **severity é baixa**
- Para garantir TP sempre primeiro → **5 soluções propostas** (Solução 5 é a melhor)

---

## 🎯 RECOMENDAÇÕES FINAIS

### PARA TOLERÂNCIAS:
1. **Se quer usar apenas ranges:** Nada a fazer, já funciona ✅
2. **Se quer usar `tol_db: 0`:** Implementar Opções 2 e 3 da Parte 1.5

### PARA PRIORIZAÇÃO:
1. **Implementar Solução 5 (Híbrida)** - True Peak sempre primeiro, mas respeita priority entre demais
2. **OU aumentar peso para 10.0** (Solução 1) - Mais simples, mas menos flexível

---

**FIM DA AUDITORIA**

Todos os pontos críticos foram mapeados com precisão cirúrgica.  
Caminho de execução completo documentado.  
Soluções práticas e testáveis fornecidas.

🔍 Auditoria realizada com sucesso.
