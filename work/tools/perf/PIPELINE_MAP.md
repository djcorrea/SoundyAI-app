# 🗺️ MAPA DO PIPELINE DE PROCESSAMENTO DE ÁUDIO

Diagrama completo com tempos estimados e pontos de instrumentação.

---

## 📊 PIPELINE COMPLETO (Visual)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SOUNDYAI AUDIO PIPELINE                            │
│                    Tempo Total Baseline: ~150s (2min30s)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  📥 FASE 5.1: DECODE (~2s, 1.3%)                                           │
│  Arquivo: work/api/audio/audio-decoder.js                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Ler buffer WAV                                                           │
│  • Decodificar metadata (music-metadata)                                    │
│  • Extrair canais PCM (Float32Array)                                        │
│  • Validar sample rate / channels                                           │
│                                                                              │
│  📊 Instrumentação: withPhase('PHASE_5_1_DECODE')                          │
│  🎯 Otimização: Decode cache (H4)                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  📐 FASE 5.2: SEGMENTATION (~5s, 3.3%)                                     │
│  Arquivo: work/api/audio/temporal-segmentation.js                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Criar frames FFT (4096 samples, hop 1024)                                │
│    └─ Janelamento Hann pré-aplicado                                        │
│  • Criar frames RMS (400ms blocks, hop 300ms)                               │
│  • Preservar canais originais                                               │
│                                                                              │
│  📊 Instrumentação: withPhase('PHASE_5_2_SEGMENTATION')                    │
│  🎯 Otimização: Janela Hann pré-calculada                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  🧮 FASE 5.3: CORE METRICS (~140s, 93.3%)                                  │
│  Arquivo: work/api/audio/core-metrics.js                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  🎚️ Normalização LUFS (-23 LU)                                       │  │
│  │  • Medir LUFS original                                                │  │
│  │  • Calcular ganho necessário                                          │  │
│  │  • Aplicar ganho linear                                               │  │
│  │  • Validar True Peak não excede -1 dBTP                               │  │
│  │                                                                        │  │
│  │  ⏱️ ~3s (2.0%)                                                         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│  ┌──────────────────────────────────┴───────────────────┐                  │
│  │                                                        │                  │
│  ▼                                                        ▼                  │
│  ┌──────────────────────────┐  ┌──────────────────────────────────────┐   │
│  │  🌈 FFT PROCESSING       │  │  🎵 BANDAS ESPECTRAIS (GARGALO #3)   │   │
│  │  (~21s, 14.0%)           │  │  (~32s, 21.3%)                        │   │
│  ├──────────────────────────┤  ├──────────────────────────────────────┤   │
│  │  • Loop frames (~1000)   │  │  • Sub (20-60 Hz)                     │   │
│  │  • FFT 4096 (FastFFT)    │  │  • Bass (60-150 Hz)                   │   │
│  │  • Magnitude L+R (RMS)   │  │  • Low-Mid (150-500 Hz)               │   │
│  │  • Phase spectrum        │  │  • Mid (500-2000 Hz)                  │   │
│  │  • 8 métricas:           │  │  • High-Mid (2000-5000 Hz)            │   │
│  │    - Centroid (Hz)       │  │  • Presence (5000-10000 Hz)           │   │
│  │    - Rolloff (Hz)        │  │  • Air (10000-20000 Hz)               │   │
│  │    - Bandwidth (Hz)      │  │                                        │   │
│  │    - Flatness            │  │  📊 measureAsync('SPECTRAL_BANDS')    │   │
│  │    - Crest               │  │  🎯 H2: Vetorizar, reuso buffers      │   │
│  │    - Spread              │  │  🎯 Esperado: -10s (-30%)             │   │
│  │    - Skewness            │  │                                        │   │
│  │    - Kurtosis            │  │                                        │   │
│  │                          │  │                                        │   │
│  │  📊 measureAsync(        │  │                                        │   │
│  │     'FFT_PROCESSING')    │  │                                        │   │
│  │  🎯 H3: Reuso de planos  │  │                                        │   │
│  └──────────────────────────┘  └──────────────────────────────────────┘   │
│                                      │                                       │
│  ┌──────────────────────────────────┴───────────────────┐                  │
│  │                                                        │                  │
│  ▼                                                        ▼                  │
│  ┌──────────────────────────┐  ┌──────────────────────────────────────┐   │
│  │  🎛️ LUFS ITU-R BS.1770-4 │  │  🏔️ TRUE PEAK FFmpeg                 │   │
│  │  (~16s, 10.7%)           │  │  (~8s, 5.3%)                          │   │
│  ├──────────────────────────┤  ├──────────────────────────────────────┤   │
│  │  • K-weighting filter    │  │  • Criar temp WAV                     │   │
│  │  • Block loudness (400ms)│  │  • FFmpeg ebur128 4x oversampling     │   │
│  │  • Gating (abs + rel)    │  │  • Parse output                       │   │
│  │  • Integrated loudness   │  │  • Cleanup temp file                  │   │
│  │  • LRA (loudness range)  │  │                                        │   │
│  │  • Short-term / Momentary│  │  📊 measureAsync('TRUE_PEAK')         │   │
│  │                          │  │                                        │   │
│  │  📊 measureAsync('LUFS') │  │                                        │   │
│  └──────────────────────────┘  └──────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  🎵 BPM DETECTION (GARGALO #1 + #2)                                  │  │
│  │  (~46s TOTAL, 30.2%)                                                  │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │  Método A: Advanced Onset Detection (~26s, 17.2%)              │ │  │
│  │  ├─────────────────────────────────────────────────────────────────┤ │  │
│  │  │  • Combinar canais L+R → mono (RMS)                             │ │  │
│  │  │  • Spectral flux analysis                                        │ │  │
│  │  │  • Onset detection (energia + threshold adaptativo)             │ │  │
│  │  │  • Histogram de intervalos                                       │ │  │
│  │  │  • BPM + confidence                                              │ │  │
│  │  │                                                                   │ │  │
│  │  │  📊 measureAsync('BPM_METHOD_A')                                 │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │  Método B: Autocorrelação (~20s, 13.0%)                         │ │  │
│  │  ├─────────────────────────────────────────────────────────────────┤ │  │
│  │  │  • Filtro passa-baixa (200 Hz)                                   │ │  │
│  │  │  • Downsampling 2x (performance)                                 │ │  │
│  │  │  • Autocorrelação normalizada                                    │ │  │
│  │  │  • Busca de picos no lag range                                   │ │  │
│  │  │  • BPM + confidence                                              │ │  │
│  │  │                                                                   │ │  │
│  │  │  📊 measureAsync('BPM_METHOD_B')                                 │ │  │
│  │  │  🎯 H1: Rodar só se confidence A < 0.5                          │ │  │
│  │  │  🎯 Esperado: -10s a -20s (-6% a -13%)                          │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │  Cross-Validation (~2s)                                          │ │  │
│  │  ├─────────────────────────────────────────────────────────────────┤ │  │
│  │  │  • Comparar A vs B                                               │ │  │
│  │  │  • Verificar concordância (±3 BPM)                               │ │  │
│  │  │  • Detectar relações harmônicas                                  │ │  │
│  │  │  • Consolidar resultado final                                    │ │  │
│  │  │                                                                   │ │  │
│  │  │  📊 measureAsync('BPM_CROSS_VALIDATION')                         │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                        │  │
│  │  📊 withPhase('BPM_DETECTION')                                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│  ┌──────────────────────────────────┴───────────────────┐                  │
│  │                                                        │                  │
│  ▼                                                        ▼                  │
│  ┌──────────────────────────┐  ┌──────────────────────────────────────┐   │
│  │  🎭 STEREO METRICS       │  │  📊 DYNAMICS METRICS                  │   │
│  │  (~1s, 0.7%)             │  │  (~1s, 0.7%)                          │   │
│  ├──────────────────────────┤  ├──────────────────────────────────────┤   │
│  │  • Correlation (-1 a +1) │  │  • Dynamic Range (DR)                 │   │
│  │  • Stereo Width (0 a 1)  │  │  • Crest Factor                       │   │
│  │  • Balance L/R           │  │  • RMS dB                             │   │
│  │                          │  │  • LRA (já calculado no LUFS)         │   │
│  │  📊 measureAsync(        │  │                                        │   │
│  │     'STEREO_METRICS')    │  │  📊 measureAsync('DYNAMICS')          │   │
│  └──────────────────────────┘  └──────────────────────────────────────┘   │
│                                      │                                       │
│  ┌──────────────────────────────────┴───────────────────────────────────┐  │
│  │  🔍 AUXILIARY METRICS (~2s, 1.3%)                                     │  │
│  ├────────────────────────────────────────────────────────────────────────┤│
│  │  • DC Offset (offset médio dos canais)                                ││
│  │  • Dominant Frequencies (3 picos principais)                           ││
│  │  • Spectral Uniformity (distribuição de energia)                       ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  📊 Instrumentação: withPhase('PHASE_5_3_CORE_METRICS')                    │
│  🎯 H5: Paralelizar LUFS + TP + Bandas (Promise.all)                      │
│  🎯 Esperado: -24s (-16%)                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  📄 FASE 5.4: JSON OUTPUT (~3s, 2.0%)                                      │
│  Arquivo: work/api/audio/json-output.js                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Scoring adaptativo por gênero                                            │
│  • Análise de problemas e sugestões V2                                      │
│  • Classificação de qualidade                                               │
│  • Serialização final                                                       │
│                                                                              │
│  📊 Instrumentação: withPhase('PHASE_5_4_JSON_OUTPUT')                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                            ✅ Resultado Final JSON
```

---

## 🎯 PONTOS DE INSTRUMENTAÇÃO (Ordem de Prioridade)

### 🔴 CRÍTICO (Medir Sempre)

1. **PHASE_5_1_DECODE**
   - `work/api/audio/pipeline-complete.js:45`
   
2. **PHASE_5_2_SEGMENTATION**
   - `work/api/audio/pipeline-complete.js:50`
   
3. **PHASE_5_3_CORE_METRICS**
   - `work/api/audio/pipeline-complete.js:55`
   
4. **BPM_METHOD_A**
   - `work/api/audio/core-metrics.js:850`
   
5. **BPM_METHOD_B**
   - `work/api/audio/core-metrics.js:870`
   
6. **SPECTRAL_BANDS**
   - `work/api/audio/core-metrics.js:620`

### 🟡 IMPORTANTE (Medir para Análise Detalhada)

7. **FFT_PROCESSING**
   - `work/api/audio/core-metrics.js:390`
   
8. **LUFS_CALCULATION**
   - `work/api/audio/core-metrics.js:520`
   
9. **TRUE_PEAK_CALCULATION**
   - `work/api/audio/core-metrics.js:570`

### 🟢 OPCIONAL (Medir se Suspeitar de Gargalo)

10. **SPECTRAL_CENTROID**
11. **STEREO_METRICS**
12. **DYNAMICS_METRICS**
13. **BPM_CROSS_VALIDATION**

---

## 📊 BREAKDOWN ESPERADO (Após Otimizações)

```
┌───────────────────────────────────────────────────────────────────┐
│  BASELINE (150s)              OTIMIZADO (68s)                     │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Decode:           2s  │       Decode:           2s  (cache)      │
│  Segmentation:     5s  │       Segmentation:     5s               │
│  FFT:             21s  │       FFT:             16s  (reuso)      │
│  Bandas:          32s  │       Bandas:          22s  (vetorizado) │
│  LUFS:            16s  ├──┐    LUFS:            16s               │
│  True Peak:        8s  │  │    True Peak:        8s  (paralelo)   │
│  Estéreo:          1s  │  │    Estéreo:          1s               │
│  Dinâmica:         1s  │  │    Dinâmica:         1s               │
│  Auxiliar:         2s  ├──┤    Auxiliar:         2s               │
│  BPM Método A:    26s  │  │    BPM Método A:    26s               │
│  BPM Método B:    20s  │  │    BPM Método B:     5s  (condicional)│
│  Cross-val:        2s  ├──┘    Cross-val:        1s               │
│  Agregação:        3s  │       Agregação:        2s               │
│  JSON Output:      3s  │       JSON Output:      3s               │
│  ───────────────────   │       ───────────────────                │
│  TOTAL:          150s  │       TOTAL:           68s (-55%)        │
│                        │                                           │
└───────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                   🎯 META ATINGIDA (≤75s)
```

---

## 🔍 GARGALOS IDENTIFICADOS

| # | Fase | Tempo (s) | % Total | Hipótese | Otimização | Ganho Est. |
|---|------|----------|---------|----------|-----------|-----------|
| 1 | BPM Método B | 20 | 13.0% | H1 | Condicional | -15s |
| 2 | BPM Método A | 26 | 17.2% | H1 | - | - |
| 3 | Bandas Espectrais | 32 | 21.3% | H2 | Vetorizar | -10s |
| 4 | FFT Processing | 21 | 14.0% | H3 | Reuso planos | -5s |
| 5 | LUFS Calculation | 16 | 10.7% | H5 | Paralelo | -16s* |
| 6 | True Peak | 8 | 5.3% | H5 | Paralelo | -8s* |

*Paralelização economiza o tempo do mais lento (Bandas: 22s após otimização)

---

## 📈 ROADMAP DE OTIMIZAÇÕES

```
Sprint 1: Instrumentação
├─ Adicionar withPhase() e measureAsync()
├─ Rodar baseline (3+ repetições)
└─ Confirmar gargalos
    └─ Ganho: 0s (apenas medição)

Sprint 2: BPM Condicional
├─ Rodar método B só se confidence A < 0.5
├─ Validar paridade (BPM ±0.5)
└─ PR: perf/otimizacao-bpm-condicional
    └─ Ganho: -10 a -15s (-6% a -10%)

Sprint 3: Bandas Vetorizadas
├─ Reutilizar buffers Float32Array
├─ Vetorizar loops com subarray + reduce
├─ Validar paridade (Bandas ±0.5pp)
└─ PR: perf/otimizacao-bandas-vetorizadas
    └─ Ganho: -10s (-6%)

Sprint 4: Paralelização
├─ Promise.all([LUFS, TP, Bandas])
├─ Validar paridade (todas métricas)
└─ PR: perf/otimizacao-paralela
    └─ Ganho: -24s (-16%)

Sprint 5: FFT Reuso (Opcional)
├─ Cache de planos FFT (se aplicável)
├─ Validar paridade (FFT ±50Hz)
└─ PR: perf/otimizacao-fft-reuso
    └─ Ganho: -5s (-3%)

RESULTADO FINAL: -54s (-36%) → Tempo: ~96s
SE ADICIONAR TODAS: -64s (-43%) → Tempo: ~86s
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Adicionar 3 WAVs em `audio-samples/`
- [ ] Rodar baseline: `npm run perf:baseline`
- [ ] Analisar `results/*/summary.md`
- [ ] Confirmar top 3 gargalos
- [ ] Instrumentar código (withPhase + measureAsync)
- [ ] Rodar baseline instrumentado
- [ ] Implementar BPM condicional
- [ ] Validar paridade BPM
- [ ] Implementar bandas vetorizadas
- [ ] Validar paridade bandas
- [ ] Implementar paralelização
- [ ] Validar paridade completa
- [ ] Criar PRs com changelog
- [ ] Merge e teste final
- [ ] Documentar ganhos

---

**Total de Fases**: 4 principais + 10 subfases críticas  
**Total de Medições**: ~15 pontos de instrumentação  
**Overhead de Instrumentação**: < 0.1% (desprezível)  
**Compatibilidade**: Node.js 18+, Windows PowerShell

---

Para visualizar este mapa durante o desenvolvimento, consulte:
- `QUICK_START.md` para implementação rápida
- `AUDIT_REPORT_INITIAL.md` para contexto completo
- `RESULTS_ANALYSIS_EXAMPLE.md` para interpretação de resultados
