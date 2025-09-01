# Audio Analyzer Feature Flags & Rollback Guide

Este documento lista todas as feature flags relacionadas ao sistema de análise de áudio (V1 + Fase 2 + melhorias Etapa 1/2) e como usá‑las / desativá‑las com segurança. Todas são definidas em `window` (antes da análise) e podem ser aplicadas via:
- Script inline antes de carregar `audio-analyzer.js` / `audio-analyzer-integration.js`
- Query params (algumas) conforme já suportado (`?adv=1&debug=1` etc.)

## Convenção
`true` liga, `false` desliga. Se “default” for “auto” significa que o código define `true` a menos que você force `false` explicitamente.

| Flag | Objetivo | Default | Risco ao ligar | Risco ao desligar | Rollback instantâneo |
|------|----------|---------|----------------|--------------------|----------------------|
| `SINGLE_STAGE_METRICS` | Calcula picos/clipping em um único passe unificado | true | Nenhum relevante | Volta duplicação potencial de cálculos | Definir `false` |
| `ENABLE_METRIC_INVARIANTS` | Força invariantes (TruePeak clamp, headroom, limpeza NaN) | true | Pode ajustar valores inesperados se dados ruins | Métricas incoerentes podem passar | `false` |
| `ENFORCE_TRUEPEAK_HEADROOM` | Sincroniza `headroomDb` com True Peak real | true | Sobrepor headroom legado | Headroom divergente | `false` |
| `USE_ADVANCED_METRICS` | Ativa adaptador avançado geral | auto (true) | Leve custo CPU | Métricas avançadas ausentes | `false` |
| `USE_ADVANCED_LOUDNESS` | Cálculo ITU (LUFS/LRA) | auto (true) | CPU extra | Sem LUFS/LRA corretos | `false` |
| `USE_ADVANCED_TRUEPEAK` | True Peak oversampled | auto (true) | CPU extra | Sem TP real/clipping TP | `false` |
| `USE_ADVANCED_SPECTRUM` | Bandas espectrais + sugestões | auto (true) | CPU extra em arquivos longos | Sem bandas / menos sugestões | `false` |
| `PREFER_ADVANCED_METRICS` | Permite sobrescrever valores base por avançados | true | Pode mascarar divergência de fallback | Retém valores menos precisos | `false` |
| `UNIFIED_TRUEPEAK_CLIP` | Usa contagem de clipping True Peak unificada | true | Pode mudar contagem vs legado | Contagem pode subestimar | `false` |
| `ENABLE_REF_BAND_NORMALIZATION` | Normaliza targets de bandas ao espaço medido quando escalas divergentes | false | Usuário pode achar alvo “móvel” | Alvos não comparáveis se escalas diferentes | `false` |
| `EXPOSE_NORMALIZED_REF_BANDS` | Expõe `technicalData.refBandTargetsNormalized` p/ debug | false | Apps externas podem depender indevidamente | Sem dados de debug | `false` |
| `SHOW_NORMALIZED_REF_TARGETS` | UI usa targets normalizados (se existirem) | false | Confusão sobre valor original | UI mostra escala bruta divergente | `false` |
| `PRE_NORMALIZE_REF_BANDS` | Marcação prévia de mismatch (metadado) | false | Nenhum | Perde hint para auditoria | `false` |
| `ENABLE_REF_ENRICHMENT` | Enriquecer refs (stereo fill, flags N/A) | true | Preenchimento pode não refletir dataset real | Campos faltantes em UI | `false` |
| `INVALIDATE_REF_CACHE_ON_GENRE_CHANGE` | Força recarregar refs ao trocar gênero | true | Carregamentos extras | Pode manter dados antigos | `false` |
| `REFS_BYPASS_CACHE` | Ignora cache por gênero sempre | false | Overhead de rede / parse | Pode usar versão desatualizada | `false` |
| `USE_LOG_BAND_ENERGIES` | Preferir variante log-proportion | false | Mudança leve de interpretação de dB | Usar somente escala ratio | `false` |
| `USE_SURGICAL_EQ` | Sugestões de EQ cirúrgico | true | Mais sugestões (ruído visual) | Perde detecção de ressonâncias | `false` |
| `SORT_SUGGESTIONS` | Reordena sugestões por prioridade | false | Ordem diferente do histórico | Ordem menos intuitiva | `false` |
| `FORCE_DEFAULT_GENRE` | Atribui gênero padrão se nenhum setado | (não setado) | Gênero errado aplicado | Sem fallback de gênero | Remover variável |
| `DEBUG_ANALYZER` | Logs detalhados | false | Ruído / performance | Menos visibilidade debug | `false` |

## Fluxo de Normalização de Bandas
1. Mede bandEnergies (escala log_ratio_db negativa usualmente).
2. Se maioria dos targets > 0 e medições todas <= 0, gera mapa linear para `refBandTargetsNormalized`.
3. Flags:
   - Calcular: `ENABLE_REF_BAND_NORMALIZATION`
   - Expor meta-info: `EXPOSE_NORMALIZED_REF_BANDS`
   - Usar na UI: `SHOW_NORMALIZED_REF_TARGETS`

## Preenchimento de stereo_target
- Tenta média dataset (`__refDerivedStats`) se disponível (marcado `__stereo_filled = 'dataset_avg'`).
- Senão heurística baseada no gênero (marcado `heuristic`).

## Invariantes Principais
- `samplePeakDb ≤ truePeakDbtp ≤ 0` (clamp)
- `headroomTruePeakDb = -truePeakDbtp`
- Remove métricas não finitas da saída (quando flag enable)

## Health Check / Consistência
Função utilitária (após carregamento):
```js
await window.__audioHealthCheck(file, { runs: 3 });
```
Retorno inclui spreads e lista de métricas com valores não finitos.

## Exemplo de Configuração Conservadora (produção inicial)
```html
<script>
  window.ENABLE_REF_BAND_NORMALIZATION = false;
  window.EXPOSE_NORMALIZED_REF_BANDS = false;
  window.SHOW_NORMALIZED_REF_TARGETS = false;
  window.DEBUG_ANALYZER = false;
</script>
```

## Estratégia de Rollback
1. Desligar apenas a flag da funcionalidade problemática.
2. Se problema persistir, desligar blocos (ex: todas as `USE_ADVANCED_*`).
3. Confirmar com `__audioHealthCheck` que não há NaN.

## Troubleshooting Rápido
| Sintoma | Ação |
|--------|------|
| True Peak > 0 inesperado | Verificar se `USE_ADVANCED_TRUEPEAK` ativo e input não clipado digitalmente; checar invariants log |
| Bandas todas fora do alvo pós normalização | Desligar `SHOW_NORMALIZED_REF_TARGETS` e comparar valores brutos |
| Headroom estranho | Checar se `ENFORCE_TRUEPEAK_HEADROOM` ativo; comparar `truePeakDbtp` |
| Muitas sugestões repetitivas | Desligar `USE_SURGICAL_EQ` ou `SORT_SUGGESTIONS` |

## Evoluções Futuras (planejado)
- Strict gating R128 configurável (limite custom ST vs Integrated) via nova flag.
- Persistência de estatísticas de referência em storage.
- Test harness automatizado.

---
Manter este arquivo atualizado a cada nova flag ou mudança de default.
