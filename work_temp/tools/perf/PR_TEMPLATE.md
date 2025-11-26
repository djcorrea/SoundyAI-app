# 📋 TEMPLATE DE PR - Otimização de Performance

**Use este template ao criar PRs de otimização de performance.**

---

## 🎯 Título do PR

**Formato**: `perf: [nome-da-otimizacao] - Redução de Xms (Y%)`

**Exemplos**:
- `perf: BPM condicional - Redução de 10234ms (6.7%)`
- `perf: Bandas vetorizadas - Redução de 9876ms (6.5%)`
- `perf: Paralelização LUFS/TP/Bandas - Redução de 24456ms (16.1%)`

---

## 📝 Descrição

### Contexto
[Descrever o problema de performance identificado]

**Exemplo**:
```
O sistema atual roda dois métodos de detecção de BPM sequencialmente 
(Advanced Onset + Autocorrelação), consumindo ~46s (30% do tempo total).
Em muitos casos, o primeiro método já fornece resultado confiável.
```

### Solução Implementada
[Descrever a otimização aplicada]

**Exemplo**:
```
Implementado BPM condicional: o método B (autocorrelação) só é executado 
se a confiança do método A for < 0.5. Isso mantém a robustez em casos 
difíceis e economiza tempo nos casos simples (~60% das análises).
```

### Arquivos Alterados
- [ ] `work/api/audio/core-metrics.js` - Lógica condicional
- [ ] `work/tools/perf/bench.config.json` - Experimento adicionado
- [ ] Outros (listar)

---

## 📊 Resultados de Performance

### Benchmark Comparativo

| Métrica | Baseline | Otimizado | Ganho | Ganho (%) |
|---------|---------|-----------|-------|-----------|
| **Tempo Total (médio)** | 152341 ms | 142107 ms | -10234 ms | -6.7% |
| **P95** | 155432 ms | 144321 ms | -11111 ms | -7.1% |
| **P99** | 157234 ms | 146123 ms | -11111 ms | -7.1% |
| **Desvio Padrão** | 2341 ms | 2123 ms | -218 ms | -9.3% |

### Breakdown Detalhado

| Fase | Baseline (ms) | Otimizado (ms) | Ganho (ms) |
|------|--------------|----------------|-----------|
| DECODE | 2456 | 2456 | 0 |
| SEGMENTATION | 5234 | 5234 | 0 |
| FFT_PROCESSING | 21234 | 21234 | 0 |
| SPECTRAL_BANDS | 32456 | 32456 | 0 |
| LUFS_CALCULATION | 16234 | 16234 | 0 |
| TRUE_PEAK | 8234 | 8234 | 0 |
| **BPM_METHOD_A** | 26234 | 26234 | 0 |
| **BPM_METHOD_B** | 19876 | 9642 | **-10234** ⬅️ |
| STEREO_METRICS | 1234 | 1234 | 0 |
| JSON_OUTPUT | 4773 | 4773 | 0 |

### Configuração do Experimento

```json
{
  "experimentName": "bpm-conditional",
  "testFile": "medium-3min.wav",
  "repetitions": 3,
  "flags": {
    "bpmMethodA": true,
    "bpmMethodB": "conditional"
  }
}
```

### Comandos para Reproduzir

```powershell
# 1. Rodar baseline
cd work
npm run perf:baseline

# 2. Rodar experimento otimizado
npm run perf:exp -- --experiment=bpm-conditional

# 3. Validar paridade
npm run perf:parity results/baseline/results.json results/latest/results.json
```

---

## ✅ Validação de Paridade

### Relatório de Paridade

**Resultado**: ✅ **PASS** (todas as métricas dentro das tolerâncias)

| Métrica | Baseline | Otimizado | Diff | Diff% | Tolerância | Status |
|---------|---------|-----------|------|-------|------------|--------|
| LUFS Integrated | -15.234 | -15.238 | 0.004 | 0.03% | ±0.10 LU | ✅ PASS |
| True Peak dBTP | -0.543 | -0.545 | 0.002 | 0.37% | ±0.10 dBTP | ✅ PASS |
| Dynamic Range | 12.456 | 12.461 | 0.005 | 0.04% | ±0.20 dB | ✅ PASS |
| RMS Average | -18.234 | -18.237 | 0.003 | 0.02% | ±0.20 dB | ✅ PASS |
| Spectral Band: sub | 8.234 | 8.239 | 0.005 | 0.06% | ±0.5 pp | ✅ PASS |
| Spectral Band: bass | 15.678 | 15.681 | 0.003 | 0.02% | ±0.5 pp | ✅ PASS |
| ... | ... | ... | ... | ... | ... | ... |
| **BPM** | 128.5 | 128.3 | **0.2** | 0.16% | ±0.5 BPM | ✅ **PASS** |

**Arquivo**: `results/parity-reports/parity-report-YYYY-MM-DD_HH-mm-ss.md`

### Casos de Teste

- [x] **Short (30s)**: BPM detectado corretamente, confiança alta (método B não rodou)
- [x] **Medium (3min)**: BPM detectado corretamente, 40% dos casos rodou método B
- [x] **Long (5min)**: BPM detectado corretamente, 55% dos casos rodou método B

---

## 🔍 Análise de Impacto

### Prós
- ✅ Redução de 6.7% no tempo total
- ✅ Maior redução em casos simples (confidence alta)
- ✅ Mantém robustez em casos difíceis
- ✅ Sem alteração na API pública
- ✅ Paridade completa (PASS)

### Contras
- ⚠️ Método B pode não rodar em alguns casos (esperado)
- ⚠️ Lógica condicional adiciona overhead mínimo (~5ms)

### Trade-offs
- **Performance vs Robustez**: Equilibrado (mantém robustez quando necessário)
- **Complexidade**: Lógica condicional simples, fácil de manter
- **Risco**: Baixo (validado com paridade e múltiplos casos de teste)

---

## 🧪 Testes Realizados

### Testes Unitários
- [x] Método A retorna confiança > 0.5 → Método B não executa
- [x] Método A retorna confiança < 0.5 → Método B executa
- [x] Cross-validation funciona corretamente em ambos os casos

### Testes de Integração
- [x] Pipeline completo com BPM condicional
- [x] JSON output correto com campo `bpmSource`
- [x] Sem regressões em outras features

### Testes de Performance
- [x] Baseline vs Otimizado (3 repetições)
- [x] Estabilidade (desvio padrão < 3%)
- [x] Percentis (P95, P99) dentro do esperado

---

## 📚 Documentação Atualizada

- [x] `README.md` - Experimento `bpm-conditional` documentado
- [x] `PIPELINE_MAP.md` - Diagrama atualizado
- [x] `AUDIT_REPORT_INITIAL.md` - Hipótese H1 validada
- [x] `bench.config.json` - Experimento adicionado

---

## 🎯 Próximos Passos

Após este PR:
1. [ ] Implementar otimização de bandas vetorizadas (esperado: -10s)
2. [ ] Implementar paralelização LUFS/TP/Bandas (esperado: -24s)
3. [ ] Considerar FFT optimization (esperado: -5s)

---

## 📎 Anexos

### Gráficos de Performance

```
Tempo Total por Experimento

Baseline:   ████████████████████████████████████████ 152.3s
Otimizado:  ██████████████████████████████████       142.1s (-6.7%)

Breakdown BPM

Método A:   ██████████████████████████ 26.2s (ambos)
Método B:   ████████████████████ 19.9s (baseline)
Método B:   ██████████ 9.6s (condicional, 48% dos casos)
```

### Logs de Execução (Exemplo)

```
[RUNNER] === Iniciando análise: bpm-conditional-medium-run1 ===
[RUNNER] Arquivo: medium-3min.wav
[BPM] Music-tempo: 128.5 BPM (conf: 0.87)
[BPM] Confiança > 0.5 → Método B não será executado
[BPM] Final: 128.5 BPM (fonte: music-tempo)
[RUNNER] ✅ Análise completa em 142107ms
```

---

## ✅ Checklist de PR

- [x] Código implementado e testado
- [x] Benchmark executado (3+ repetições)
- [x] Paridade validada (PASS)
- [x] Documentação atualizada
- [x] Testes unitários e de integração
- [x] Changelog com ganho de ms e %
- [x] Anexar relatórios de paridade
- [x] Sem regressões em features existentes

---

## 🔖 Labels

- `performance` - Otimização de performance
- `audio-pipeline` - Pipeline de processamento de áudio
- `validated` - Paridade validada
- `ready-to-merge` - Pronto para merge

---

## 📝 Notas Adicionais

[Qualquer informação adicional relevante]

**Exemplo**:
```
Esta otimização é parte de uma série de melhorias de performance 
visando reduzir o tempo total de análise de ~150s para ≤75s.

Outras otimizações planejadas:
- Bandas vetorizadas (esperado: -10s)
- Paralelização (esperado: -24s)
- FFT optimization (esperado: -5s)

Meta final: ~101s (-33% vs baseline)
```

---

**Revisores sugeridos**: @equipe-audio, @tech-lead  
**Milestone**: Performance Optimization Sprint 2  
**Relacionado**: #ISSUE-123, #ISSUE-456

---

**Template Version**: 1.0.0  
**Last Updated**: 23 de outubro de 2025
