# Score Engine V3 - Documentação Técnica

## Visão Geral

O **Score Engine V3** é o novo sistema de scoring do SoundyAI que substitui o sistema anterior de pesos iguais por um sistema baseado em **target + range** com suporte a **gêneros** e **modos**.

### Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `config/scoring-v3-weights.json` | Configuração de pesos por gênero e modo |
| `lib/audio/features/score-engine-v3.js` | Engine principal de cálculo |
| `lib/audio/features/score-engine-v3.test.js` | Testes unitários |

### Diferenças V3 vs Sistema Atual

| Aspecto | Sistema Atual | V3 |
|---------|---------------|-----|
| Pesos | Iguais (~7.7% cada) | Por gênero + modo |
| Scoring | Tolerância simétrica | Target + Range (fora=0) |
| Gates | Definidos mas não aplicados | TRUE_PEAK_CRITICAL ativo |
| Bandas Tonais | Não entram no score final | 25% do peso (tonal subscore) |
| Modos | Não diferenciados | streaming / pista / reference |

---

## Conceitos Principais

### 1. Score por Target + Range

```
      score
        │
   100 ─┤         ▄▄▄▄▄
        │       ▄▀     ▀▄
        │      ▄         ▄
    50 ─┤    ▄▀           ▀▄
        │   ▄               ▄
        │  ▀                 ▀
     0 ─┼──┬───┬─────┬───┬───┬─→ valor
          min  ↓     ↓   max
              target
```

- **No target exato** → Score = 100
- **Dentro do range [min, max]** → Score decresce suavemente
- **FORA do range** → Score = 0 (diferença crucial do sistema atual!)

### 2. TRUE PEAK GATE (Regra Crítica)

```
┌─────────────────────────────────────────────────────────┐
│ TRUE PEAK > 0 dBTP = GATE CRÍTICO                       │
│                                                         │
│ Ações automáticas:                                      │
│ • peaksScore = 0                                        │
│ • technicalScore = 0                                    │
│ • loudnessScore ≤ 20                                    │
│ • finalScore ≤ 35                                       │
│ • classification = "Inaceitável"                        │
└─────────────────────────────────────────────────────────┘
```

### 3. Subscores

O V3 calcula 6 subscores ponderados:

| Subscore | Peso Padrão | Métricas |
|----------|-------------|----------|
| `peaks` | 25% | True Peak, Clipping |
| `loudness` | 20% | LUFS, LRA |
| `tonal` | 25% | Bandas de frequência (sub, low_bass, etc.) |
| `dynamics` | 15% | DR, Crest Factor |
| `stereo` | 10% | Width, Correlation, Balance |
| `technical` | 5% | DC Offset, Centroid, Flatness |

### 4. Modos

Os pesos são ajustados por modo:

| Modo | Foco Principal |
|------|----------------|
| `streaming` | True Peak estrito (-1 dBTP), LUFS controlado |
| `pista` | Loudness alto permitido, TP até 0 dBTP |
| `reference` | Pesos neutros, sem ajustes |

---

## Uso

### Ativar V3 (Feature Flag)

```javascript
// No console do browser:
window.enableScoreV3();   // Ativa V3
window.disableScoreV3();  // Volta ao sistema atual
```

### Calcular Score V3 Diretamente

```javascript
// Async
const result = await window.computeScoreV3(technicalData, referenceData, 'streaming', 'funk_mandela');
console.log(result.scorePct, result.subscores, result.gatesApplied);
```

### Comparar V3 vs Atual

```javascript
const comparison = await window.compareScoreV3(technicalData, referenceData, 'streaming', 'funk_mandela');
console.log('Atual:', comparison.current.scorePct);
console.log('V3:', comparison.v3.scorePct);
console.log('Delta:', comparison.delta);
```

### Rodar Testes

```javascript
window.ScoreEngineV3Tests.runAll();
```

---

## Estrutura do Resultado V3

```javascript
{
  scorePct: 78.5,                    // Score final (0-100)
  method: 'v3',                      // Identificador do método
  version: '3.0.0',
  mode: 'streaming',                 // Modo usado
  genreId: 'funk_mandela',          // Gênero usado
  
  subscores: {
    peaks: { score: 85, truePeakScore: 90, clippingScore: 100, ... },
    loudness: { score: 72, lufsScore: 70, lraScore: 80, ... },
    tonal: { score: 80, bandScores: {...}, totalBandsEvaluated: 6 },
    dynamics: { score: 75, drScore: 80, crestScore: 70 },
    stereo: { score: 82, widthScore: 85, correlationScore: 80, balanceScore: 90 },
    technical: { score: 95, dcScore: 100, centroidScore: 90 }
  },
  
  weights: {
    peaks: 28.5,      // Peso efetivo após ajuste de modo
    loudness: 22.1,
    tonal: 22.5,
    dynamics: 13.5,
    stereo: 9.0,
    technical: 4.4
  },
  
  gatesApplied: [
    // Se houver gates ativados:
    // { type: 'TRUE_PEAK_CRITICAL', reason: '...', actions: [...] }
  ],
  
  classification: {
    level: 'pronto_streaming',
    label: 'Pronto para Streaming',
    icon: '✅',
    score: 78.5
  },
  
  debug: {
    computeTime: '12.5ms',
    configLoaded: true,
    genreConfigFound: true,
    bandsSpecFound: true
  }
}
```

---

## Configuração de Gêneros

### Exemplo: funk_mandela

```json
{
  "funk_mandela": {
    "description": "Funk pesado com sub dominante, loudness alto",
    "subscore_weights": {
      "peaks": 20,
      "loudness": 25,
      "tonal": 30,      // Maior peso em bandas tonais
      "dynamics": 10,
      "stereo": 10,
      "technical": 5
    },
    "tonal_band_weights": {
      "sub": 30,        // SUB é muito importante
      "low_bass": 25,
      "upper_bass": 15,
      "low_mid": 10,
      "mid": 10,
      "high_mid": 5,
      "brilho": 3,
      "presenca": 2
    },
    "mode_overrides": {
      "streaming": {
        "true_peak": { "target": -1.0, "min": -2.5, "max": -0.5 },
        "lufs": { "target": -9.0, "min": -12.0, "max": -7.0 }
      },
      "pista": {
        "true_peak": { "target": -0.3, "min": -1.0, "max": 0.0 },
        "lufs": { "target": -8.0, "min": -10.0, "max": -6.0 }
      }
    }
  }
}
```

---

## Gates Implementados

| Gate | Threshold | Ações |
|------|-----------|-------|
| `TRUE_PEAK_CRITICAL` | TP > 0.0 dBTP | peaks=0, technical=0, final≤35 |
| `TRUE_PEAK_WARNING` | -0.1 < TP ≤ 0 | peaks≤30, final≤70 |
| `CLIPPING_SEVERE` | Clipping > 5% | peaks≤30, technical≤40, final≤50 |
| `DC_OFFSET_HIGH` | DC > 5% | technical-=20, final-=10 |

---

## Integração com Sistema Atual

O V3 foi integrado de forma **não-invasiva**:

1. **Feature Flag**: `window.SCORE_ENGINE_VERSION = "v3"` ativa o V3
2. **Fallback Automático**: Se V3 falhar, usa sistema atual
3. **Compatibilidade**: Resultado V3 é adaptado para formato atual
4. **Gradual**: Pode ser ativado apenas para testes

### Fluxo de Decisão

```
computeMixScore()
    │
    ├─► SCORE_ENGINE_VERSION === "v3"?
    │       │
    │       ├─► SIM: Tenta computeScoreV3()
    │       │           │
    │       │           ├─► Sucesso: Retorna resultado V3
    │       │           └─► Falha: Fallback para atual
    │       │
    │       └─► NÃO: Usa sistema atual
    │
    └─► Retorna resultado
```

---

## Próximos Passos

1. **Testes em Produção**: Ativar V3 para um subset de usuários
2. **Validação com Referências**: Testar com masters profissionais
3. **Ajuste de Pesos**: Refinar pesos por gênero baseado em feedback
4. **Migração Gradual**: Se validado, tornar V3 o padrão

---

## Checklist de Validação

- [x] `scoreByTargetRange()` - Score 100 no target, 0 fora do range
- [x] `scoreTruePeak()` - Gate ativo quando TP > 0
- [x] Subscores calculados corretamente
- [x] Pesos ajustados por modo
- [x] Gates aplicados ao score final
- [x] Classificação baseada em score e gates
- [x] Fallback para sistema atual se V3 falhar
- [x] Testes unitários passando

---

**Versão**: 3.0.0  
**Data**: 2025-01-28  
**Autor**: SoundyAI Engineering
