# 🔧 AUDITORIA BACKEND - Correção de Alias de Bandas PT↔EN

## 📋 RESUMO DO PROBLEMA

### Sintoma
- aiSuggestions não continha sugestões para bandas **presence** e **air**
- Mesmo quando `problemKeys` incluía essas bandas, as sugestões não eram geradas
- Usuário via: `problemKeys: ['bass','lowMid','presence']` mas `aiSuggestionKeys: ['truePeak','lufs','dr','bass','lowMid']`

### Causa Raiz Identificada
**Mismatch de nomenclatura PT↔EN nas chaves de banda:**

| Origem | Formato | Exemplo |
|--------|---------|---------|
| `spectralBands` (métricas) | Inglês/camelCase | `presence`, `air`, `lowMid`, `highMid` |
| `genreTargets` (JSON gêneros) | Português/snake_case | `presenca`, `brilho`, `low_mid`, `high_mid` |
| `baseWeights` (scoring) | Misto | `band_presenca`, `band_brilho` |

Quando o código fazia `metrics.bandEnergies[band]` onde `band = 'presenca'`, não encontrava nada porque a chave real é `'presence'`.

---

## ✅ CORREÇÕES APLICADAS

### 1. scoring.js - Normalização de Banda
**Arquivo:** `work/lib/audio/features/scoring.js`

**Adicionado (início do arquivo):**
```javascript
// 🎯 NORMALIZAÇÃO DE CHAVES DE BANDA - Resolve mismatch PT↔EN
const BAND_ALIASES = {
  // Português → Inglês (canônico)
  'presenca': 'presence',
  'brilho': 'air',
  // Snake_case → camelCase
  'low_mid': 'lowMid',
  'high_mid': 'highMid',
  // Inverso Inglês → Português (para lookup em targets PT)
  'presence': 'presenca',
  'air': 'brilho',
  'lowMid': 'low_mid',
  'highMid': 'high_mid'
};

function normalizeBandKey(key) { ... }
function getBandWithAlias(obj, bandKey) { ... }
```

**Corrigido (linha ~600):**
```javascript
// ANTES (quebrava)
const mBand = metrics.bandEnergies[band];

// DEPOIS (funciona com aliases)
const mBand = getBandWithAlias(metrics.bandEnergies, band);
```

**Corrigido (baseWeights):**
```javascript
// ANTES: Apenas nomes PT
band_presenca: 0.12,
band_brilho: 0.12,

// DEPOIS: Ambos os formatos para garantir match
band_presence: 0.12,
band_presenca: 0.12,  // alias PT
band_air: 0.12,
band_brilho: 0.12,    // alias PT
```

---

### 2. pipeline-complete.js - Normalização na Geração de Sugestões
**Arquivo:** `work/api/audio/pipeline-complete.js`

**Adicionado (após imports):**
```javascript
const BAND_ALIASES = { ... }; // Mesmo mapa de aliases
function normalizeBandKey(key) { ... }
function getBandWithAlias(obj, bandKey) { ... }
```

**Corrigido (função getBandValue):**
```javascript
// ANTES (quebrava)
const bands = technicalData.spectralBands;
if (!bands || !bands[bandKey]) return null;

// DEPOIS (funciona com aliases)
const bands = technicalData.spectralBands;
const bandData = getBandWithAlias(bands, bandKey);
if (!bandData) return null;
```

**Corrigido (busca em genreTargets):**
```javascript
// ANTES
if (genreTargets?.bands?.[bandKey]?.target_range) { ... }

// DEPOIS (com aliases)
const bandTargetFromBands = getBandWithAlias(genreTargets?.bands, bandKey);
if (bandTargetFromBands?.target_range) { ... }
```

---

## 🔄 FLUXO CORRIGIDO

```
1. genreTargets.bands contém: { presenca: {...}, brilho: {...} }
2. spectralBands contém: { presence: {...}, air: {...} }
3. scoring.js itera sobre genreTargets.bands:
   - band = 'presenca'
   - getBandWithAlias(metrics.bandEnergies, 'presenca')
   - Tenta 'presenca' → não encontra
   - Normaliza para 'presence' → ENCONTRA! ✅
   - addMetric('tonal', 'band_presence', ...) // usa nome canônico EN
4. penalties geradas com: { key: 'band_presence', ... }
5. generateAdvancedSuggestionsFromScoring processa penalty 'band_presence'
6. getBandValue usa aliases para buscar dados
7. Sugestão gerada para presence! ✅
```

---

## 📊 ARQUIVOS MODIFICADOS

| Arquivo | Linhas Alteradas | Tipo de Mudança |
|---------|------------------|-----------------|
| `work/lib/audio/features/scoring.js` | +56 novas linhas, ~10 modificadas | Adiciona funções de alias + corrige lookup |
| `work/api/audio/pipeline-complete.js` | +56 novas linhas, ~30 modificadas | Adiciona funções de alias + corrige getBandValue |

---

## 🧪 TESTE ESPERADO

Após estas correções, uma análise de áudio com gênero que tenha:
```json
{
  "bands": {
    "presenca": { "target_range": { "min": -25, "max": -18 } },
    "brilho": { "target_range": { "min": -30, "max": -22 } }
  }
}
```

Deve gerar aiSuggestions para:
- ✅ `presence` (se fora do range)
- ✅ `air` (se fora do range)
- ✅ Todas as outras bandas já funcionavam

---

## 📝 NOTAS TÉCNICAS

1. **Formato canônico adotado:** Inglês/camelCase (`presence`, `air`, `lowMid`, `highMid`)
2. **Compatibilidade:** Ambos os formatos (PT e EN) funcionam em qualquer lookup
3. **Zero breaking changes:** Código existente continua funcionando
4. **Logs de auditoria:** Mensagens `[SCORING_BAND_ALIAS]` e `[AUDIT-GETBAND]` indicam qual caminho foi usado

---

**Data:** 2025-01-XX  
**Correção por:** GitHub Copilot (Claude Opus 4.5)
