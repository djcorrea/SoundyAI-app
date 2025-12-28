# 🔧 AUDIT: Score System V3.3 - Correções Completas

**Data:** 2025-12-28  
**Versão:** 3.3.0  
**Status:** ✅ CORRIGIDO

---

## 📋 PROBLEMAS IDENTIFICADOS E CORRIGIDOS

### 1. FrequencyScore usando apenas 2 bandas

**Sintoma:** Log mostrava "Score Frequência Final: 89% (média de 2 bandas)" apesar de várias bandas disponíveis.

**Causa Raiz:**
- Mapeamento rígido de chaves (`bandMapping`) não reconhecia aliases
- Chaves como `lowMid` não mapeavam para `low_mid`
- Chaves de gênero (`presenca`) não mapeavam para `presence`

**Correção:**
- Criado módulo `band-key-aliases.js` com sistema centralizado de aliases
- `calculateFrequencyScore` reescrito para usar aliases
- Logs detalhados: `bandsUsedForScore`, `targetsFoundPerBand`, `reason` para ignorados

**Arquivo:** [band-key-aliases.js](public/lib/audio/utils/band-key-aliases.js)

---

### 2. TRUE_PEAK_WARNING disparando em TP=-1.0 dBTP

**Sintoma:** WARNING disparava em TP=-1.0 que é o target padrão para streaming.

**Causa Raiz:**
```javascript
// CÓDIGO ANTIGO (BUG):
if (truePeak > -0.1 && truePeak <= criticalThreshold) {
```

O threshold estava fixo em `-0.1` para todos os modos, ignorando o target dinâmico.

**Correção:**
```javascript
// CÓDIGO CORRIGIDO (V3.3):
const warningThreshold = Math.min(target + 0.3, max);
if (truePeak > warningThreshold && truePeak <= criticalThreshold) {
```

Para streaming (`target=-1.0`, `max=-1.0`):
- `warningThreshold = min(-1.0 + 0.3, -1.0) = -1.0`
- Condição: `TP > -1.0 AND TP <= 0` → **nunca satisfeita para TP=-1.0** ✅

**Arquivos corrigidos:**
- [public/lib/audio/features/score-engine-v3.js](public/lib/audio/features/score-engine-v3.js#L200-L210)
- [lib/audio/features/score-engine-v3.js](lib/audio/features/score-engine-v3.js#L200-L210)

---

### 3. Duas fontes de score conflitantes

**Sintoma:** `audio-analyzer-integration.js` logava score diferente de `scoring.js V3`.

**Correção:**
- Gates V3 integrados em `__safeCalculateAnalysisScores()` (linha ~15380)
- Fonte única: `calculateAnalysisScores()` → gates V3 → score final
- Logs identificam claramente a pipeline

---

## 📁 ARQUIVOS MODIFICADOS

| Arquivo | Modificação |
|---------|-------------|
| `public/lib/audio/utils/band-key-aliases.js` | **NOVO** - Sistema de aliases de bandas |
| `public/lib/audio/features/score-engine-v3.js` | Corrigido TRUE_PEAK_WARNING threshold |
| `lib/audio/features/score-engine-v3.js` | Corrigido TRUE_PEAK_WARNING threshold |
| `public/lib/audio/features/scoring.js` | Adicionado `testScoreSanity()`, atualizado `testScoringGates()` |
| `public/audio-analyzer-integration.js` | Reescrito `calculateFrequencyScore()` com aliases |
| `public/index.html` | Adicionado load de `band-key-aliases.js`, versões atualizadas |

---

## 🧪 FUNÇÕES DE TESTE

### `window.testScoringGates()`
Valida apenas os hard gates do True Peak:
- TP +4.7 → CRITICAL ✅
- TP -1.0 → sem gate ✅
- Clipping 10% → SEVERE ✅
- LUFS -6 → EXCESSIVE ✅

### `window.testScoreSanity()`
Valida todo o sistema de scores:
1. **True Peak Gates**: TP=-1.0 sem WARNING, TP=+0.5 com CRITICAL
2. **Aliases de Bandas**: lowMid→low_mid, presenca→presence, etc
3. **Frequência com 7 bandas**: Mapeamento completo
4. **Consistência de Scores**: subscores + final válidos

---

## 📊 SISTEMA DE ALIASES DE BANDAS

| Chave Canônica | Aliases Reconhecidos |
|----------------|---------------------|
| `sub` | sub, sub_bass, subBass |
| `bass` | bass, low_bass, lowBass, graves |
| `low_mid` | low_mid, lowMid, médio_grave |
| `mid` | mid, mids, médio |
| `high_mid` | high_mid, highMid, upper_mid |
| `presence` | presence, presenca, vocal |
| `brilho` | brilho, air, brilliance, highs |

**Meta Keys (ignoradas):** totalPercentage, _status, timestamp, _source

---

## ✅ COMO VALIDAR

1. Abra o console do navegador (F12)
2. Execute:
```javascript
window.testScoreSanity()
```

**Resultado esperado:**
```
📊 RESULTADO FINAL: 4/4 testes passaram
🎉 SISTEMA DE SCORES OK!
```

3. Para teste detalhado de gates:
```javascript
window.testScoringGates()
```

---

## 📝 LOGS DE DIAGNÓSTICO

Após análise, procure no console:

```
🎵 [FREQ-SCORE-V3.3] Calculando Score de Frequência
📊 Bandas do usuário (raw): [...]
📊 Bandas de referência (raw): [...]
✅ SUB: -25.0dB vs -25.0dB (±3.0) = 100%
...
📋 RESUMO: { bandsUsedForScore: [...], bandsUsedCount: 7, ... }
🎵 Score Frequência Final: XX% (média de 7 bandas)
🎵 Bandas usadas: [sub, bass, low_mid, mid, high_mid, presence, brilho]
```

---

**Responsável:** GitHub Copilot  
**Revisão:** Pendente
