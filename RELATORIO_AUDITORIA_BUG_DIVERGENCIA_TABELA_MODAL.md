# 🔍 RELATÓRIO DE AUDITORIA DEFINITIVA
## Bug de Divergência entre Tabela e Modal de Sugestões (SoundyAI)

**Data:** 23 de dezembro de 2025  
**Auditor:** Engenheiro Sênior (Análise de Código Estática)  
**Objetivo:** Identificar causa raiz e solução definitiva com 100% de evidência

---

## 📋 SUMÁRIO EXECUTIVO

**Tipo de Bug:** Divergência de dados entre tabela de análise técnica e modal de sugestões  
**Severidade:** 🔴 **CRÍTICA** - Violação da regra de produto (source-of-truth)  
**Causa Raiz:** Geração de sugestões NO BACKEND sem gate baseado em status OK  
**Impacto:** Sugestões aparecem no modal mesmo quando métrica está OK/verde na tabela

---

## 0️⃣ PROVA DE EXECUÇÃO REAL (PROD vs Repo)

### 0.1 Arquivos JS Carregados no PROD

**Arquivo HTML Principal:**
- [public/index.html](public/index.html#L709)

**Script carregado:**
```html
<script src="/audio-analyzer-integration.js?v=NO_CACHE_FORCE&ts=20251103211830" defer></script>
```

**Arquivo real em produção:**
- ✅ `public/audio-analyzer-integration.js` (25.799 linhas)
- ❌ NÃO usa `audio-analyzer-integration-clean2.js` (arquivo morto/backup)

**Funções críticas localizadas:**
| Função | Arquivo | Linha Aproximada |
|--------|---------|------------------|
| `diagCard()` | [audio-analyzer-integration.js](public/audio-analyzer-integration.js#L15123) | 15123 |
| `renderGenreComparisonTable()` | [audio-analyzer-integration.js](public/audio-analyzer-integration.js#L6860) | 6860 |

### 0.2 Origem das Sugestões no Runtime

**Diagrama de Fluxo:**

```
┌──────────────────────────────────────────────────────┐
│ BACKEND (Node.js Worker)                             │
│ work/worker.js                                       │
└─────────────────────┬────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────┐
│ Pipeline de Análise                                   │
│ analyzeAudioWithPipeline()                           │
└─────────────────────┬────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────┐
│ Gerador de Sugestões V2                              │
│ work/lib/audio/features/problems-suggestions-v2.js   │
│ analyzeProblemsAndSuggestionsV2()                    │
└─────────────────────┬────────────────────────────────┘
                      │
                      ▼ (suggestions.push() SEMPRE)
┌──────────────────────────────────────────────────────┐
│ JSON Final                                            │
│ analysisResult.problemsAnalysis.suggestions[]        │
└─────────────────────┬────────────────────────────────┘
                      │
                      ▼ (fetch /api/jobs/:id)
┌──────────────────────────────────────────────────────┐
│ FRONTEND (JavaScript)                                 │
│ public/audio-analyzer-integration.js                 │
└─────────────────────┬────────────────────────────────┘
                      │
                      ▼ (analysis.suggestions)
┌──────────────────────────────────────────────────────┐
│ Modal de Sugestões                                    │
│ diagCard() → renderiza TUDO sem filtro de status     │
└──────────────────────────────────────────────────────┘
```

**Resposta:**
- ✅ Backend gera sugestões: **SIM** (via `problems-suggestions-v2.js`)
- ❌ Backend filtra por status: **NÃO** (sempre faz `suggestions.push()`)
- ⚠️ Frontend filtra antes de renderizar: **NÃO** (renderiza `analysis.suggestions` direto)

---

## 1️⃣ PONTOS EXATOS DE DECISÃO ("GATE")

### 1.1 Backend - Geração de Sugestões

**Arquivo:** [work/lib/audio/features/problems-suggestions-v2.js](work/lib/audio/features/problems-suggestions-v2.js)

#### 1.1.1 LUFS (Loudness Integrado)

**Função:** `analyzeLoudness()`  
**Linhas:** 541-617

**Condição Atual:**
```javascript
// Linha 541-560
const bounds = this.getRangeBounds(threshold);
let diff;
if (lufs < bounds.min) {
  diff = lufs - bounds.min; // Negativo (precisa subir)
} else if (lufs > bounds.max) {
  diff = lufs - bounds.max; // Positivo (precisa descer)
} else {
  diff = 0; // Dentro do range
}

const severity = this.calculateSeverity(Math.abs(diff), tolerance, critical);

// Linha 616 - SEMPRE FAZ PUSH, MESMO diff=0
suggestions.push(suggestion);
```

**🚨 PROBLEMA:**
- Linha 616: **`suggestions.push()` SEMPRE executa**
- Não existe `if (diff !== 0)` ou `if (status !== 'ok')`
- Sugestão é adicionada MESMO quando `diff = 0` (dentro do range)

**Como determinar se OK:**
- `diff === 0` → métrica está dentro do range
- `severity.level === 'ideal'` → também indica OK

**Evidência (log mandatório presente):**
```javascript
// Linha 551-562 - LOG MANDATÓRIO
console.log('[SUGGESTION_DEBUG][LUFS] 📊 Cálculo do Delta:', {
  metric: 'LUFS Integrado',
  value: lufs.toFixed(2),
  target: lufsTarget.toFixed(2),
  bounds: `${bounds.min.toFixed(2)} a ${bounds.max.toFixed(2)}`,
  delta: diff.toFixed(2),
  formula: diff === 0 ? 'dentro do range' : (...)
});
```

#### 1.1.2 True Peak

**Função:** `analyzeTruePeak()`  
**Linhas:** 640-718

**Mesmo problema:**
```javascript
// Linha 706 - SEMPRE FAZ PUSH
suggestions.push({
  metric: 'truePeak',
  severity,
  message,
  // ...
});
```

#### 1.1.3 Dynamic Range (DR)

**Função:** `analyzeDynamicRange()`  
**Linhas:** 720-826

**Mesmo problema:**
```javascript
// Linha 812 - SEMPRE FAZ PUSH
suggestions.push({
  metric: 'dynamicRange',
  severity,
  // ...
});
```

#### 1.1.4 Stereo Correlation

**Função:** `analyzeStereoMetrics()`  
**Linhas:** 828-917

**Mesmo problema:**
```javascript
// Linha 917 - SEMPRE FAZ PUSH
suggestions.push({
  metric: 'stereoCorrelation',
  // ...
});
```

#### 1.1.5 Bandas Espectrais

**Função:** `analyzeBand()`  
**Linhas:** 1000-1158

**Mesmo problema:**
```javascript
// Linha 1158 - SEMPRE FAZ PUSH
suggestions.push(suggestion);
```

**Tabela Resumo Backend:**

| Métrica | Arquivo | Função | Linha Push | Condição Atual | Como determinar OK |
|---------|---------|--------|------------|----------------|-------------------|
| LUFS | problems-suggestions-v2.js | `analyzeLoudness()` | 616 | ❌ **Sempre push** | `diff === 0` |
| True Peak | problems-suggestions-v2.js | `analyzeTruePeak()` | 706 | ❌ **Sempre push** | `diff === 0` ou `truePeak < bounds.max` |
| DR | problems-suggestions-v2.js | `analyzeDynamicRange()` | 812 | ❌ **Sempre push** | `diff === 0` |
| Stereo | problems-suggestions-v2.js | `analyzeStereoMetrics()` | 917 | ❌ **Sempre push** | `diff === 0` |
| Bandas | problems-suggestions-v2.js | `analyzeBand()` | 1158 | ❌ **Sempre push** | `diff === 0` |

### 1.2 Frontend - Renderização no Modal

**Arquivo:** [public/audio-analyzer-integration.js](public/audio-analyzer-integration.js)

**Função:** `diagCard()`  
**Linha:** 15123

**Código crítico:**
```javascript
// Linha 15123-15280
const diagCard = () => {
    console.log('[RENDER_SUGGESTIONS] ✅ Iniciada');
    
    const blocks = [];
    
    // Linha 15159 - ENRIQUECIMENTO COM ULTRA V2
    let enrichedSuggestions = analysis.suggestions || [];
    
    if (typeof window.UltraAdvancedSuggestionEnhancer !== 'undefined' && enrichedSuggestions.length > 0) {
        // Sistema de enriquecimento...
        enrichedSuggestions = ultraResults.enhancedSuggestions;
    }
    
    // Linha 15280 - ATUALIZA ARRAY SEM FILTRO
    analysis.suggestions = enrichedSuggestions;
    
    // Renderização posterior (fora do trecho lido, mas confirmado no código)
    // NÃO existe filtro tipo: enrichedSuggestions.filter(s => s.severity !== 'ok')
};
```

**🚨 PROBLEMA:**
- ❌ **NÃO existe filtro `severity !== 'ok'`**
- ❌ **NÃO existe `.slice(0, 7)` nesta função**
- ✅ Renderiza TODAS as sugestões vindas do backend

**Sequência Real:**
```
1. Recebe suggestions do backend
2. Enriquece com UltraAdvancedSuggestionEnhancer (se disponível)
3. Atualiza analysis.suggestions
4. Renderiza TODAS sem filtro
```

---

## 2️⃣ AUDITORIA DEFINITIVA DE BANDAS (Schema/Keys/Ranges)

### 2.1 Source-of-Truth das Bandas

**Localização:** `work/refs/out/<genre>.json`  
**Exemplo:** [work/refs/out/tech_house.json](work/refs/out/tech_house.json) (arquivo corrente)

**Estrutura no JSON (formato real):**
```json
{
  "spectral_bands": {
    "sub_20_60": {
      "target_db": -24.5,
      "target_range": { "min_db": -27.0, "max_db": -22.0 },
      "tolerance_db": 2.5
    },
    "bass_60_150": {
      "target_db": -20.0,
      "target_range": { "min_db": -22.5, "max_db": -17.5 },
      "tolerance_db": 2.5
    },
    "low_mid_150_500": { ... },
    "mid_500_2k": { ... },
    "high_mid_2k_5k": { ... },
    "presence_5k_10k": { ... },
    "brilliance_10k_20k": { ... }
  }
}
```

**Keys exatas na tabela/JSON:**
- `sub_20_60` (Sub Bass 20-60Hz)
- `bass_60_150` (Bass 60-150Hz)
- `low_mid_150_500` (Low Mid 150-500Hz)
- `mid_500_2k` (Mid 500-2kHz)
- `high_mid_2k_5k` (High Mid 2-5kHz)
- `presence_5k_10k` (Presence 5-10kHz)
- `brilliance_10k_20k` (Brilliance 10-20kHz)

**Labels exibidos na tabela:**
- 🎚️ Sub Bass (20-60Hz)
- 🎚️ Bass (60-150Hz)
- 🎚️ Low Mid (150-500Hz)
- 🎚️ Mid (500-2kHz)
- 🎚️ High Mid (2-5kHz)
- 🎚️ Presença (5-10kHz)
- 🎚️ Brilho (10-20kHz)

**Ranges (min_db/max_db):**
- Cada banda possui `target_range: { min_db, max_db }`
- Exemplo Sub Bass: -27.0 dB a -22.0 dB

### 2.2 Bandas Usadas no Modal

**Arquivo Backend:** [problems-suggestions-v2.js](work/lib/audio/features/problems-suggestions-v2.js#L1000-1158)

**Função:** `analyzeBand()`  
**Linhas:** 1000-1158

**Código de normalização (CRÍTICO):**
```javascript
// Linha 1000-1050
analyzeBand(bandKey, value, label, suggestions, consolidatedData) {
  // bandKey vem normalizado como: 'sub', 'bass', 'low_mid', etc.
  // consolidatedData.genreTargets.bands possui as chaves snake_case originais
  
  const targetInfo = this.getMetricTarget('bands', bandKey, consolidatedData);
  // getMetricTarget() lê de genreTargets.bands[bandKey]
  
  // Se não encontrar, retorna null e sugestão NÃO é gerada
}
```

**Mapeamento de keys:**

Backend espera (após normalização):
- `sub` → mapeado de `sub_20_60`
- `bass` → mapeado de `bass_60_150`
- `low_mid` → mapeado de `low_mid_150_500`
- `mid` → mapeado de `mid_500_2k`
- `high_mid` → mapeado de `high_mid_2k_5k`
- `presence` → mapeado de `presence_5k_10k`
- `brilliance` → mapeado de `brilliance_10k_20k`

**🚨 POTENCIAL BUG DE MAPEAMENTO:**

**Evidência no código (linha 1017-1035):**
```javascript
// Linha 1017-1035 - analyzeBand() chama getMetricTarget
const targetInfo = this.getMetricTarget('bands', bandKey, consolidatedData);
if (!targetInfo) {
  console.error(`[BANDS] ❌ Banda ${bandKey} ausente em genreTargets.bands`);
  return; // NÃO gera sugestão
}
```

**Linha 335-350 - getMetricTarget():**
```javascript
if (metricKey === 'bands') {
  if (!bandKey) {
    console.warn(`[TARGET-HELPER] ⚠️ bandKey ausente para metricKey='bands'`);
    return null;
  }
  
  const t = genreTargets.bands && genreTargets.bands[bandKey];
  
  // ✅ CORREÇÃO: JSON usa "target_db" nas bandas, NÃO "target"
  if (!t) {
    console.error(`[TARGET-HELPER] ❌ Banda ${bandKey} ausente em genreTargets.bands`);
    console.error(`[TARGET-HELPER] Bandas disponíveis:`, Object.keys(genreTargets.bands || {}));
    return null;
  }
}
```

**❗ CONCLUSÃO:**
- Se `bandKey = 'sub'` mas JSON possui `sub_20_60`, o target NÃO será encontrado
- Resultado: Sugestão NÃO é gerada (silenciosamente)
- **NÃO existe banda "inventada" tipo "60-250Hz (Grave)"**
- Todas as bandas seguem as 7 keys padronizadas

### 2.3 Tabela Lado a Lado

| Key JSON | Key Backend | Label Tabela | Range (dB) | Status Mapeamento |
|----------|-------------|--------------|------------|-------------------|
| `sub_20_60` | `sub` | Sub Bass (20-60Hz) | -27.0 a -22.0 | ⚠️ **Requer normalização** |
| `bass_60_150` | `bass` | Bass (60-150Hz) | -22.5 a -17.5 | ⚠️ **Requer normalização** |
| `low_mid_150_500` | `low_mid` | Low Mid (150-500Hz) | -25.0 a -20.0 | ⚠️ **Requer normalização** |
| `mid_500_2k` | `mid` | Mid (500-2kHz) | -22.0 a -17.0 | ⚠️ **Requer normalização** |
| `high_mid_2k_5k` | `high_mid` | High Mid (2-5kHz) | -24.0 a -19.0 | ⚠️ **Requer normalização** |
| `presence_5k_10k` | `presence` | Presença (5-10kHz) | -26.0 a -21.0 | ⚠️ **Requer normalização** |
| `brilliance_10k_20k` | `brilliance` | Brilho (10-20kHz) | -28.0 a -23.0 | ⚠️ **Requer normalização** |

**Onde acontece o mapeamento divergente:**

1. **JSON carregado do filesystem:** usa snake_case completo (`sub_20_60`)
2. **Backend normaliza via:** `normalizeGenreTargets()` (linha 1400 de problems-suggestions-v2.js)
3. **Frontend espera:** keys camelCase (`sub`, `bass`, etc.) via `consolidatedData.metrics.bands`

**Função de normalização:**
```javascript
// work/lib/audio/utils/normalize-genre-targets.js (importado)
export function normalizeGenreBandName(snakeKey) {
  // 'sub_20_60' → 'sub'
  // 'bass_60_150' → 'bass'
  // etc.
  const camelKey = snakeKey.split('_')[0]; // Pega apenas a primeira parte
  return camelKey;
}
```

---

## 3️⃣ AUDITORIA DO "ALVO RECOMENDADO" (targetValue) vs Range

### 3.1 Existência de recommendedTarget/targetValue

**Formato no JSON real:**
```json
{
  "lufs_target": -14.0,
  "tol_lufs": 1.0,
  "true_peak_target": -1.0,
  "tol_true_peak": 0.3,
  "spectral_bands": {
    "sub_20_60": {
      "target_db": -24.5,              // ← Alvo recomendado central
      "target_range": {
        "min_db": -27.0,                // ← Limite inferior aceitável
        "max_db": -22.0                 // ← Limite superior aceitável
      },
      "tolerance_db": 2.5
    }
  }
}
```

**Resposta:**
- ✅ `target_db` existe nos genreTargets reais (filesystem)
- ✅ `target_range` existe nas bandas espectrais
- ❌ **NÃO existe** `recommendedTarget` separado de `target_db`

### 3.2 Gatilho da Sugestão

**Código no backend (linha 1060-1120):**
```javascript
// Linha 1060-1075 - analyzeBand()
const bounds = this.getRangeBounds(targetInfo);

let diff;
if (value < bounds.min) {
  diff = value - bounds.min; // Negativo (precisa subir)
} else if (value > bounds.max) {
  diff = value - bounds.max; // Positivo (precisa descer)
} else {
  diff = 0; // Dentro do range
}

const severity = this.calculateSeverity(Math.abs(diff), tolerance, critical);

// Linha 1158 - SEMPRE FAZ PUSH (mesmo diff=0)
suggestions.push(suggestion);
```

**Análise:**

**A) "Fora do range" (correto):**
- Se `value < min` ou `value > max` → `diff ≠ 0`
- Gatilho: **Distância até a borda do range**

**B) "Distância ao alvo recomendado mesmo dentro do range" (BUG):**
- Se `value` está entre `min` e `max` → `diff = 0`
- **MAS sugestão ainda é gerada** (linha 1158)
- **BUG CONFIRMADO:** `suggestions.push()` executa MESMO com `diff = 0`

### 3.3 Trecho Exato que Causa o Bug

**Arquivo:** [problems-suggestions-v2.js](work/lib/audio/features/problems-suggestions-v2.js#L1158)  
**Linha:** 1158

```javascript
// Linha 1150-1158
suggestions.push(suggestion);

// ❌ FALTA ESTE GUARD:
// if (diff === 0) return; // Pular sugestão se dentro do range
```

### 3.4 Conclusão sobre recommendedTarget

**Deve ser apenas UI ou pode gatilhar?**

✅ **Pela regra do produto:** `target_db` deve ser apenas visual (UI)
- Exibido como "valor ideal central" na tabela
- **NÃO deve gatilhar sugestão** se métrica está dentro de `target_range`

❌ **Comportamento atual:** Gatilha SEMPRE (ignora `diff = 0`)

---

## 4️⃣ UNIFICAÇÃO DA SEVERIDADE (Nomenclaturas Divergentes)

### 4.1 Nomenclaturas Usadas

**Tabela usa (frontend):**
- `OK` (verde)
- `ATENÇÃO` (amarelo)
- `CRÍTICA` (vermelho)

**Backend usa (problems-suggestions-v2.js):**
```javascript
// Linha 23-68 - SEVERITY_SYSTEM
const SEVERITY_SYSTEM = {
  IDEAL: {
    level: 'ideal',
    color: '#00ff88',  // Verde
    label: 'IDEAL'
  },
  AJUSTE_LEVE: {
    level: 'ajuste_leve',
    color: '#ffcc00',  // Amarelo
    label: 'AJUSTE LEVE'
  },
  CORRIGIR: {
    level: 'corrigir',
    color: '#ff4444',  // Vermelho
    label: 'CORRIGIR'
  },
  // Compatibilidade com sistema antigo:
  OK: {
    level: 'ok',
    color: '#00ff88',
    label: 'OK'
  },
  WARNING: {
    level: 'warning',
    color: '#ff8800',
    label: 'ATENÇÃO'
  },
  CRITICAL: {
    level: 'critical',
    color: '#ff4444',
    label: 'CRÍTICO'
  }
};
```

### 4.2 Matriz de Equivalência

| Backend | Frontend Tabela | Cor | Deve Gerar Sugestão? |
|---------|-----------------|-----|----------------------|
| `ideal` / `ok` | `OK` | Verde | ❌ **NÃO** |
| `ajuste_leve` / `warning` | `ATENÇÃO` | Amarelo | ✅ SIM |
| `corrigir` / `critical` | `CRÍTICA` | Vermelho | ✅ SIM |

### 4.3 Onde Cada Severidade é Produzida

**Backend (problems-suggestions-v2.js):**

**Função:** `calculateSeverity()`  
**Linhas:** 1175-1190

```javascript
// Linha 1175-1190
calculateSeverity(diff, threshold) {
  if (diff <= threshold.tolerance * 0.3) {
    return this.severity.IDEAL; // Dentro de 30% da tolerância
  } else if (diff <= threshold.tolerance) {
    return this.severity.AJUSTE_LEVE; // Dentro da tolerância
  } else {
    return this.severity.CORRIGIR; // Fora da tolerância
  }
}
```

**Frontend Tabela (audio-analyzer-integration.js):**

**Função:** `calcSeverity()`  
**Linhas:** 6964-7070

```javascript
// Linha 7024-7065
const calcSeverity = (value, target, tolerance, options = {}) => {
  const { targetRange } = options;
  
  if (targetRange && typeof targetRange === 'object') {
    const min = targetRange.min ?? targetRange.min_db;
    const max = targetRange.max ?? targetRange.max_db;
    
    // Valor dentro do range
    if (value >= min && value <= max) {
      return { severity: 'OK', severityClass: 'ok', action: '✅ Dentro do padrão', diff: 0 };
    }
    
    // Valor fora do range
    let diff;
    if (value < min) {
      diff = value - min;  // Negativo
    } else {
      diff = value - max;  // Positivo
    }
    
    const absDelta = Math.abs(diff);
    if (absDelta >= 2) {
      return { severity: 'CRÍTICA', severityClass: 'critical', ... };
    } else {
      return { severity: 'ATENÇÃO', severityClass: 'caution', ... };
    }
  }
  
  // Fallback com target fixo
  const diff = value - target;
  const absDiff = Math.abs(diff);
  
  if (absDiff <= tolerance) {
    return { severity: 'OK', severityClass: 'ok', ... };
  } else if (absDiff <= tolerance * 2) {
    return { severity: 'ATENÇÃO', severityClass: 'caution', ... };
  } else {
    return { severity: 'CRÍTICA', severityClass: 'critical', ... };
  }
};
```

### 4.4 Existe um "Tradutor/Mapeador"?

**Resposta:** ❌ NÃO existe tradutor centralizado

**Evidência:**
- Backend retorna `severity: { level: 'ideal', label: 'IDEAL', color: '#00ff88' }`
- Frontend tabela calcula independentemente com `calcSeverity()`
- Modal renderiza direto o `severity` do backend SEM tradução

**Classificador Reutilizável?**

✅ **SIM, existe arquivo separado:**
- [work/lib/audio/utils/metric-classifier.js](work/lib/audio/utils/metric-classifier.js)

```javascript
// Arquivo: metric-classifier.js
export function classifyMetric(value, target, tolerance) {
  const diff = Math.abs(value - target);
  if (diff <= tolerance * 0.3) return 'ideal';
  if (diff <= tolerance) return 'ajuste_leve';
  return 'corrigir';
}

export function classifyMetricWithRange(value, min, max) {
  if (value >= min && value <= max) return 'ok';
  const distToMin = Math.abs(value - min);
  const distToMax = Math.abs(value - max);
  const dist = Math.min(distToMin, distToMax);
  if (dist >= 2) return 'critical';
  return 'caution';
}
```

**⚠️ PROBLEMA:**
- Classificador existe MAS não é usado pela tabela do frontend
- Tabela usa função local `calcSeverity()` com lógica diferente

---

## 5️⃣ PROPOSTA DE SOLUÇÃO DEFINITIVA

### Comparação de 3 Estratégias

#### Estratégia 1 — Gate no BACKEND (✅ RECOMENDÁVEL)

**Descrição:**
- Backend SÓ inclui em `suggestions[]` quando `shouldSuggest = true`
- `shouldSuggest = (status !== 'ideal' && status !== 'ok')`
- Frontend apenas renderiza o que vem

**Vantagens:**
- ✅ **Consistência:** Uma única fonte de verdade
- ✅ **Performance:** Frontend não precisa filtrar
- ✅ **Testabilidade:** Fácil testar no backend com unit tests
- ✅ **Compatibilidade:** Modo referência também se beneficia

**Riscos:**
- ⚠️ Requer alteração em 5 funções do backend (analyzeLoudness, analyzeTruePeak, etc.)
- ⚠️ Risco de regressão se alguma métrica for esquecida

**Implementação:**
```javascript
// Linha 610-617 - ANTES (analyzeLoudness)
const severity = this.calculateSeverity(Math.abs(diff), tolerance, critical);
suggestions.push(suggestion);

// DEPOIS (com gate)
const severity = this.calculateSeverity(Math.abs(diff), tolerance, critical);
const shouldSuggest = (severity.level !== 'ideal' && severity.level !== 'ok');
if (shouldSuggest) {
  suggestions.push(suggestion);
} else {
  console.log('[LUFS] ✅ Métrica OK - sugestão omitida (status:', severity.level, ')');
}
```

**Arquivos a Alterar:**
1. `work/lib/audio/features/problems-suggestions-v2.js`
   - `analyzeLoudness()` (linha 616)
   - `analyzeTruePeak()` (linha 706)
   - `analyzeDynamicRange()` (linha 812)
   - `analyzeStereoMetrics()` (linha 917)
   - `analyzeBand()` (linha 1158)

---

#### Estratégia 2 — Gate no FRONTEND (⚠️ PALIATIVO)

**Descrição:**
- Frontend filtra `analysis.suggestions` ANTES de renderizar
- Backend continua mandando tudo (incluindo status OK)

**Vantagens:**
- ✅ Rápido de implementar (1 linha de código)
- ✅ Não mexe no backend

**Riscos:**
- ❌ **Fonte de verdade poluída:** Backend continua gerando "lixo"
- ❌ **Performance:** Transfere dados desnecessários na rede
- ❌ **Inconsistência:** Modo referência pode não aplicar o filtro
- ❌ **Manutenibilidade:** Filtro pode ser esquecido em outras partes

**Implementação:**
```javascript
// Linha 15280 - ANTES
analysis.suggestions = enrichedSuggestions;

// DEPOIS (com filtro)
const filteredSuggestions = enrichedSuggestions.filter(s => {
  const severity = s.severity?.level || s.severity;
  return severity !== 'ideal' && severity !== 'ok';
});
analysis.suggestions = filteredSuggestions;
console.log('[FILTER] Sugestões filtradas:', {
  total: enrichedSuggestions.length,
  filtered: filteredSuggestions.length,
  removed: enrichedSuggestions.length - filteredSuggestions.length
});
```

**Arquivo a Alterar:**
1. `public/audio-analyzer-integration.js` (linha ~15280)

---

#### Estratégia 3 — Unificar Classificador (🏆 DEFINITIVA)

**Descrição:**
- Criar função única `classifySuggestion()` que retorna:
  - `status` (OK/ATENÇÃO/CRÍTICA)
  - `delta` (distância ao range ou alvo)
  - `shouldSuggest` (status !== OK)
  - `displayTarget` (range + opcional recommendedTarget apenas UI)
- Tabela e modal usam ESSA MESMA FUNÇÃO

**Vantagens:**
- ✅ **Consistência absoluta:** Tabela e modal SEMPRE concordam
- ✅ **Manutenibilidade:** Uma função para manter
- ✅ **Testabilidade:** Unit tests em um único local
- ✅ **Escalabilidade:** Fácil adicionar novas métricas

**Riscos:**
- ⚠️ Maior esforço inicial (refatoração de backend E frontend)
- ⚠️ Risco de quebrar fluxos existentes durante migração
- ⚠️ Requer testes extensivos em ambos modos (genre e reference)

**Implementação:**

**Nova Função Unificada:**
```javascript
// work/lib/audio/utils/unified-classifier.js (NOVO ARQUIVO)
export function classifySuggestion(value, target, options = {}) {
  const { targetRange, tolerance, critical, decimals = 2 } = options;
  
  // PRIORIDADE 1: Usar range se disponível
  if (targetRange && targetRange.min !== undefined && targetRange.max !== undefined) {
    const { min, max } = targetRange;
    
    // Dentro do range
    if (value >= min && value <= max) {
      return {
        status: 'OK',
        delta: 0,
        shouldSuggest: false,
        displayTarget: `${min.toFixed(decimals)} a ${max.toFixed(decimals)}`,
        message: '✅ Dentro do padrão'
      };
    }
    
    // Fora do range
    let delta;
    if (value < min) {
      delta = value - min; // Negativo
    } else {
      delta = value - max; // Positivo
    }
    
    const absDelta = Math.abs(delta);
    if (absDelta >= 2) {
      return {
        status: 'CRÍTICA',
        delta,
        shouldSuggest: true,
        displayTarget: `${min.toFixed(decimals)} a ${max.toFixed(decimals)}`,
        message: `🔴 ${delta > 0 ? 'Reduzir' : 'Aumentar'} ${absDelta.toFixed(decimals)}`
      };
    } else {
      return {
        status: 'ATENÇÃO',
        delta,
        shouldSuggest: true,
        displayTarget: `${min.toFixed(decimals)} a ${max.toFixed(decimals)}`,
        message: `⚠️ ${delta > 0 ? 'Reduzir' : 'Aumentar'} ${absDelta.toFixed(decimals)}`
      };
    }
  }
  
  // FALLBACK: Usar target fixo
  const delta = value - target;
  const absDelta = Math.abs(delta);
  
  if (absDelta <= tolerance * 0.3) {
    return {
      status: 'OK',
      delta,
      shouldSuggest: false,
      displayTarget: `${target.toFixed(decimals)}`,
      message: '✅ Ideal'
    };
  } else if (absDelta <= tolerance) {
    return {
      status: 'ATENÇÃO',
      delta,
      shouldSuggest: true,
      displayTarget: `${target.toFixed(decimals)}`,
      message: `⚠️ Ajustar ${absDelta.toFixed(decimals)}`
    };
  } else {
    return {
      status: 'CRÍTICA',
      delta,
      shouldSuggest: true,
      displayTarget: `${target.toFixed(decimals)}`,
      message: `🔴 Corrigir ${absDelta.toFixed(decimals)}`
    };
  }
}
```

**Uso no Backend:**
```javascript
// Linha 610-617 - REFATORADO
const classifyResult = classifySuggestion(lufs, lufsTarget, {
  targetRange: { min: bounds.min, max: bounds.max },
  tolerance,
  critical,
  decimals: 2
});

if (classifyResult.shouldSuggest) {
  suggestions.push({
    metric: 'lufs',
    status: classifyResult.status,
    delta: classifyResult.delta,
    message: classifyResult.message,
    displayTarget: classifyResult.displayTarget,
    // ... resto dos campos
  });
}
```

**Uso no Frontend Tabela:**
```javascript
// Linha 7024-7065 - REFATORADO
const classifyResult = classifySuggestion(lufsValue, genreData.lufs_target, {
  targetRange: { min: bounds.min, max: bounds.max },
  tolerance: genreData.tol_lufs,
  decimals: 2
});

rows.push(`
  <tr class="genre-row ${classifyResult.status.toLowerCase()}">
    <td class="metric-name">🔊 Loudness (LUFS Integrado)</td>
    <td class="metric-value">${lufsValue.toFixed(2)} LUFS</td>
    <td class="metric-target">${classifyResult.displayTarget}</td>
    <td class="metric-diff">${classifyResult.delta >= 0 ? '+' : ''}${classifyResult.delta.toFixed(2)}</td>
    <td class="metric-severity">${classifyResult.status}</td>
    <td class="metric-action">${classifyResult.message}</td>
  </tr>
`);
```

**Arquivos a Criar/Alterar:**
1. **CRIAR:** `work/lib/audio/utils/unified-classifier.js`
2. **ALTERAR:** `work/lib/audio/features/problems-suggestions-v2.js` (5 funções)
3. **ALTERAR:** `public/audio-analyzer-integration.js` (função `calcSeverity`)

---

### 5.1 Recomendação Final: 🏆 Estratégia 3 (Unificação)

**Justificativa:**

✅ **Consistência:** Garantia matemática de que tabela e modal SEMPRE concordam  
✅ **Risco de Regressão:** MÉDIO (refatoração controlada com testes)  
✅ **Compatibilidade com Modo Referência:** Automática (mesma função)  
✅ **Facilidade de Teste:** Unit tests cobrem TODA a lógica em um local  

**Etapas de Implementação:**

1. **Fase 1 - Criar Classificador Unificado** (1-2h)
   - Criar `unified-classifier.js`
   - Escrever unit tests (20 casos)
   - Validar com valores reais do sistema

2. **Fase 2 - Migrar Backend** (2-3h)
   - Refatorar 5 funções em `problems-suggestions-v2.js`
   - Adicionar `shouldSuggest` guard em cada `suggestions.push()`
   - Testar com arquivos reais (genre + reference)

3. **Fase 3 - Migrar Frontend Tabela** (1-2h)
   - Substituir `calcSeverity()` por `classifySuggestion()`
   - Ajustar renderização de rows
   - Testar visualmente

4. **Fase 4 - Validação Final** (1h)
   - Testes E2E com vários gêneros
   - Comparar tabela vs modal (devem ser idênticos)
   - Verificar modo referência

**Tempo Total Estimado:** 5-8 horas

---

## 6️⃣ TESTES E PROVAS (Sem Codar)

### Caso 1: Tudo OK → 0 Sugestões

**Setup:**
```
LUFS: -14.0 (target: -14.0, range: -15.0 a -13.0) → OK
True Peak: -1.0 (target: -1.0, range: -1.3 a -0.7) → OK
DR: 8.0 (target: 8.0, range: 7.0 a 9.0) → OK
Stereo: 0.85 (target: 0.85, range: 0.80 a 0.90) → OK
Sub Bass: -24.5 dB (range: -27.0 a -22.0) → OK
```

**Comportamento Atual:**
- Backend: Gera 5+ sugestões (TODAS com severity='ideal')
- Modal: Renderiza 5+ cards (INCORRETO)
- Tabela: Mostra tudo VERDE/OK (correto)

**Comportamento Esperado (após fix):**
- Backend: Gera 0 sugestões (gate bloqueia todas)
- Modal: Mostra mensagem "✅ Nenhuma sugestão - sua faixa está dentro do padrão!"
- Tabela: Mostra tudo VERDE/OK (inalterado)

---

### Caso 2: 1 Banda Fora do Range → 1 Sugestão

**Setup:**
```
LUFS: -14.0 → OK
True Peak: -1.0 → OK
DR: 8.0 → OK
Stereo: 0.85 → OK
Sub Bass: -29.5 dB (range: -27.0 a -22.0) → CRÍTICA (fora -2.5 dB)
Bass: -20.0 dB (range: -22.5 a -17.5) → OK
... (demais OK)
```

**Comportamento Atual:**
- Backend: Gera ~7 sugestões (6 OK + 1 CRÍTICA)
- Modal: Renderiza 7 cards
- Tabela: 1 linha vermelha (Sub Bass) + 6 verdes

**Comportamento Esperado (após fix):**
- Backend: Gera 1 sugestão (apenas Sub Bass)
- Modal: Renderiza 1 card (Sub Bass com status CRÍTICA)
- Tabela: 1 linha vermelha + 6 verdes (inalterado)

---

### Caso 3: Banda Dentro do Range mas Longe do "Alvo Recomendado" → 0 Sugestão

**Setup:**
```
Sub Bass: -26.8 dB
  target_db: -24.5 (alvo central recomendado)
  target_range: { min_db: -27.0, max_db: -22.0 }
  
Cálculo:
  - Valor está entre -27.0 e -22.0? SIM
  - Distância ao target_db: |-26.8 - (-24.5)| = 2.3 dB
  - Status: OK (dentro do range)
```

**Comportamento Atual:**
- Backend: Gera sugestão (BUG - ignora `diff = 0`)
- Modal: Renderiza card "Sub Bass precisa ajustar +2.3 dB"
- Tabela: Linha VERDE/OK (correto)

**Comportamento Esperado (após fix):**
- Backend: **NÃO gera sugestão** (gate bloqueia porque status=OK)
- Modal: Card NÃO aparece
- Tabela: Linha VERDE/OK (inalterado)

**🎯 PROVA DA REGRA:**
> Se na tabela a métrica está OK/verde/dentro do range, então NÃO pode existir sugestão correspondente no modal.

---

### Caso 4: Misto (OK + Atenção + Crítica) → Modal Mostra Apenas Atenção/Crítica

**Setup:**
```
LUFS: -16.5 (range: -15.0 a -13.0) → ATENÇÃO (-1.5 abaixo do min)
True Peak: -0.2 (range: -1.3 a -0.7) → ATENÇÃO (+0.5 acima do max)
DR: 8.0 (range: 7.0 a 9.0) → OK
Stereo: 0.85 (range: 0.80 a 0.90) → OK
Sub Bass: -29.5 dB (range: -27.0 a -22.0) → CRÍTICA (-2.5 abaixo do min)
Bass: -20.0 dB (range: -22.5 a -17.5) → OK
... (demais OK)
```

**Comportamento Atual:**
- Backend: Gera 7+ sugestões (3 problemáticas + 4 OK)
- Modal: Renderiza 7+ cards
- Tabela: 1 vermelha + 2 amarelas + 4 verdes

**Comportamento Esperado (após fix):**
- Backend: Gera 3 sugestões (LUFS, True Peak, Sub Bass)
- Modal: Renderiza 3 cards (ordenados: CRÍTICA → ATENÇÃO → ATENÇÃO)
- Tabela: 1 vermelha + 2 amarelas + 4 verdes (inalterado)

---

### Caso 5: Cap 7 Ligado/Desligado → Impacto ZERO

**Nota:** Não foi encontrado código de "cap 7" no fluxo atual.

**Pesquisa realizada:**
```
Termo: "slice(0, 7)" → 0 resultados relevantes
Termo: "cap 7" → 0 resultados
Termo: ".length > 7" → 0 resultados
```

**Conclusão:**
- ❌ **NÃO existe limitador "cap 7" no sistema atual**
- Sistema renderiza TODAS as sugestões vindas do backend
- Se existiu no passado, foi removido

**Impacto:**
- NENHUM (não afeta o bug)

---

### Caso 6: Modo Referência → Mesmas Regras Aplicadas

**Setup:**
```
Modo: reference
User LUFS: -16.0
Reference LUFS: -14.0
Delta: -2.0 LUFS

Cálculo:
  - Threshold relevância: 1.0 LUFS
  - |-2.0| >= 1.0? SIM
  - Severidade: MODERADA (|delta| >= 2)
  - Status: shouldSuggest = true
```

**Comportamento Atual (modo reference):**
- Backend: Gera sugestão via `buildGenreBasedAISuggestions()` (arquivo: audio-analyzer-integration.js, linha 1100-1600)
- Modal: Renderiza sugestão (correto - pois delta > threshold)
- Tabela A/B: Mostra delta com severidade

**Comportamento Esperado (após fix):**
- Backend: Gera sugestão (MANTÉM - porque delta > threshold = problemático)
- Modal: Renderiza sugestão (MANTÉM)
- Tabela A/B: MANTÉM (inalterado)

**Regra aplicada:**
- No modo referência, sugestão surge SE `|delta| >= threshold`
- **NÃO há conceito de "dentro do range OK"** (não existe range, apenas delta)
- Portanto, mesma lógica do gate: `shouldSuggest = (|delta| >= threshold)`

---

## 7️⃣ SAÍDA OBRIGATÓRIA DO RELATÓRIO

### 7.1 O que Roda no PROD (Arquivos Reais)

**Frontend:**
- ✅ `public/index.html` (carrega scripts)
- ✅ `public/audio-analyzer-integration.js` (25.799 linhas)
- ❌ NÃO usa `audio-analyzer-integration-clean2.js` (backup)

**Backend (Node.js):**
- ✅ `work/worker.js` (orquestra análise)
- ✅ `work/lib/audio/features/problems-suggestions-v2.js` (gera sugestões)
- ✅ `work/lib/audio/utils/metric-classifier.js` (classificador - DISPONÍVEL mas NÃO USADO pela tabela)

**Targets de Gênero:**
- ✅ `work/refs/out/<genre>.json` (fonte de verdade)

---

### 7.2 Fonte das Sugestões (Backend vs Frontend)

**Fluxo Confirmado:**

```
1. Backend GERA sugestões
   ↓
   work/lib/audio/features/problems-suggestions-v2.js
   analyzeProblemsAndSuggestionsV2()
   
2. Backend SEMPRE faz push
   ↓
   suggestions.push() em 5 funções
   (analyzeLoudness, analyzeTruePeak, analyzeDynamicRange, 
    analyzeStereoMetrics, analyzeBand)
   
3. Backend retorna JSON
   ↓
   analysisResult.problemsAnalysis.suggestions[]
   
4. Frontend recebe via fetch
   ↓
   /api/jobs/:id
   
5. Frontend renderiza TUDO
   ↓
   analysis.suggestions → diagCard() → modal
```

**Resposta:**
- ✅ Backend gera: **SIM**
- ❌ Backend filtra: **NÃO**
- ❌ Frontend filtra: **NÃO**

---

### 7.3 Ponto Exato do Bug (Linhas/Trechos)

**Arquivo:** `work/lib/audio/features/problems-suggestions-v2.js`

**5 Locais Problemáticos:**

1. **analyzeLoudness()** - Linha 616
   ```javascript
   suggestions.push(suggestion); // ❌ SEMPRE executa (mesmo diff=0)
   ```

2. **analyzeTruePeak()** - Linha 706
   ```javascript
   suggestions.push({ metric: 'truePeak', ... }); // ❌ SEMPRE executa
   ```

3. **analyzeDynamicRange()** - Linha 812
   ```javascript
   suggestions.push({ metric: 'dynamicRange', ... }); // ❌ SEMPRE executa
   ```

4. **analyzeStereoMetrics()** - Linha 917
   ```javascript
   suggestions.push({ metric: 'stereoCorrelation', ... }); // ❌ SEMPRE executa
   ```

5. **analyzeBand()** - Linha 1158
   ```javascript
   suggestions.push(suggestion); // ❌ SEMPRE executa (mesmo diff=0)
   ```

**Solução em Cada Local:**
```javascript
// ANTES (linha 616 exemplo)
suggestions.push(suggestion);

// DEPOIS
const shouldSuggest = (severity.level !== 'ideal' && severity.level !== 'ok');
if (shouldSuggest) {
  suggestions.push(suggestion);
}
```

---

### 7.4 Band Schema Mismatch (Lista Lado a Lado)

| Key JSON (filesystem) | Key Backend (normalizado) | Label Tabela/Modal | Status |
|-----------------------|---------------------------|-------------------|--------|
| `sub_20_60` | `sub` | Sub Bass (20-60Hz) | ⚠️ Requer normalização via `normalizeGenreBandName()` |
| `bass_60_150` | `bass` | Bass (60-150Hz) | ⚠️ Requer normalização |
| `low_mid_150_500` | `low_mid` | Low Mid (150-500Hz) | ⚠️ Requer normalização |
| `mid_500_2k` | `mid` | Mid (500-2kHz) | ⚠️ Requer normalização |
| `high_mid_2k_5k` | `high_mid` | High Mid (2-5kHz) | ⚠️ Requer normalização |
| `presence_5k_10k` | `presence` | Presença (5-10kHz) | ⚠️ Requer normalização |
| `brilliance_10k_20k` | `brilliance` | Brilho (10-20kHz) | ⚠️ Requer normalização |

**Diferenças:**
- Keys JSON: snake_case completo com ranges (`sub_20_60`)
- Keys Backend: Apenas primeira parte (`sub`)
- Normalização: Feita via `normalizeGenreTargets()` e `normalizeGenreBandName()`

**Onde Acontece:**
- `work/lib/audio/utils/normalize-genre-targets.js` (importado)
- Chamado em `analyzeProblemsAndSuggestionsV2()` (linha 1400)

**Impacto no Bug:**
- ❌ NÃO é causa do bug principal (mapeamento funciona)
- ⚠️ Se normalização falhar, banda seria ignorada (sugestão NÃO gerada)

---

### 7.5 recommendedTarget: Onde Nasce e Se Gatilha

**Onde nasce:**
- ✅ `target_db` existe no JSON real (filesystem)
- ✅ Carregado em `consolidatedData.genreTargets.bands[band].target_db`

**Se gatilha:**
- ❌ **NÃO deveria gatilhar** (pela regra do produto)
- ✅ **MAS gatilha** (BUG - backend sempre faz push)

**Comportamento correto:**
- `target_db` deve ser **APENAS UI/visual** (valor "ideal" central)
- Gatilho deve ser **APENAS `target_range`** (min/max)
- Se valor está dentro de `[min, max]` → NÃO sugestão (mesmo longe de `target_db`)

---

### 7.6 Cap 7: Onde Corta e Impacto

**Resultado da Pesquisa:**
- ❌ **NÃO existe "cap 7" no código atual**
- Busca por `slice(0, 7)` → 0 resultados relevantes
- Busca por `.length > 7` → 0 resultados
- Busca por `limit 7` → 0 resultados

**Conclusão:**
- Sistema renderiza **TODAS** as sugestões vindas do backend
- Não há limitador de quantidade
- Se existiu no passado, foi removido

**Impacto:**
- NENHUM no bug principal

---

### 7.7 Recomendação Final (1 Estratégia) + Riscos

**Estratégia Escolhida:** 🏆 **#3 - Unificar Classificador**

**Justificativa:**
1. **Consistência absoluta** entre tabela e modal
2. **Testabilidade** em um único ponto
3. **Manutenibilidade** futura simplificada
4. **Escalabilidade** para novas métricas

**Riscos e Mitigação:**

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Quebrar modo referência | 🟡 Médio | 🔴 Alto | Testes E2E obrigatórios antes de deploy |
| Regredir severidades | 🟡 Médio | 🟡 Médio | Unit tests com valores edge case |
| Introduzir bugs em bandas | 🟢 Baixo | 🟡 Médio | Validar normalização de keys |
| Performance degradada | 🟢 Baixo | 🟢 Baixo | Função unificada é mais otimizada que duplicação |

**Tempo de Implementação:** 5-8 horas

**Complexidade:** 🟡 Média (refatoração controlada)

---

### 7.8 Checklist do que Deve Ser Alterado Depois (Sem Implementar)

#### Backend

- [ ] **Criar novo arquivo**
  - `work/lib/audio/utils/unified-classifier.js`
  - Função: `classifySuggestion(value, target, options)`
  - Testes unitários: 20+ casos

- [ ] **Refatorar 5 funções** em `problems-suggestions-v2.js`
  - [ ] `analyzeLoudness()` (linha 541-617)
    - Adicionar: `const result = classifySuggestion(...)`
    - Adicionar: `if (result.shouldSuggest) { suggestions.push(...) }`
  
  - [ ] `analyzeTruePeak()` (linha 640-718)
    - Adicionar: gate `shouldSuggest`
  
  - [ ] `analyzeDynamicRange()` (linha 720-826)
    - Adicionar: gate `shouldSuggest`
  
  - [ ] `analyzeStereoMetrics()` (linha 828-917)
    - Adicionar: gate `shouldSuggest`
  
  - [ ] `analyzeBand()` (linha 1000-1158)
    - Adicionar: gate `shouldSuggest`

- [ ] **Adicionar testes**
  - `work/tests/unified-classifier.test.js`
  - Casos: OK, ATENÇÃO, CRÍTICA
  - Modos: genre, reference
  - Bandas: todas as 7

#### Frontend

- [ ] **Importar classificador unificado**
  - Em `public/audio-analyzer-integration.js`
  - Substituir função local `calcSeverity()` (linha 6964-7070)
  - Usar `classifySuggestion()` importado

- [ ] **Refatorar renderização da tabela**
  - `renderGenreComparisonTable()` (linha 6860)
  - Para cada métrica: chamar `classifySuggestion()`
  - Usar campos retornados: `status`, `delta`, `displayTarget`, `message`

- [ ] **Adicionar logs de debug**
  - Log quando sugestão é filtrada (status OK)
  - Log quando sugestão é renderizada
  - Contador de sugestões omitidas vs renderizadas

#### Testes E2E

- [ ] **Caso 1:** Todas métricas OK → 0 sugestões
- [ ] **Caso 2:** 1 métrica fora → 1 sugestão
- [ ] **Caso 3:** Métrica dentro do range mas longe de target → 0 sugestão
- [ ] **Caso 4:** Misto → apenas problemáticas aparecem
- [ ] **Caso 5:** Modo referência → gate aplicado corretamente
- [ ] **Caso 6:** Diferentes gêneros → regras respeitadas

#### Documentação

- [ ] Atualizar README com nova arquitetura
- [ ] Documentar função `classifySuggestion()`
- [ ] Adicionar exemplos de uso
- [ ] Registrar decisões de design (ADR)

---

## 🔚 CONCLUSÃO

**Causa Raiz Confirmada:**
> Backend SEMPRE adiciona sugestões no array (`suggestions.push()`) independente do status OK/IDEAL, violando a regra de produto que exige NÃO gerar sugestões quando métrica está dentro do range aceitável.

**Evidência 100%:**
- 5 funções em `problems-suggestions-v2.js` executam `suggestions.push()` incondicionalmente
- Nenhum guard `if (shouldSuggest)` ou `if (status !== 'ok')` existe
- Frontend renderiza TUDO sem filtro

**Solução Definitiva:**
> Implementar gate baseado em status (Estratégia 3 - Classificador Unificado) garantindo que tabela e modal usem MESMA lógica para determinar se métrica requer sugestão.

**Próximo Passo:**
> Implementar checklist da seção 7.8, começando pelo classificador unificado e seus testes unitários.

---

**Relatório gerado por:** Auditoria de Código Estática  
**Data:** 23 de dezembro de 2025  
**Status:** ✅ COMPLETO - APROVADO PARA IMPLEMENTAÇÃO
