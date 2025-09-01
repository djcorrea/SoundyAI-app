# Audio Metrics Mapping Inventory (Etapa 0)

Status: Inicial
Gerado em: {{TIMESTAMP}}

## Legenda
- Stage: pipeline stage/origem (ex: v1:basic, v2:loudness, ref:builder)
- Buffer Source: confirma se vem do mesmo buffer PCM base
- Units: unidades
- Window / Hop: tamanhos quando aplicável

## Métricas Principais (inicial)
(Preenchimento progressivo — será atualizado nas próximas iterações)

| Métrica | Arquivo/Função | Stage | SampleRate | Window / Hop | Unidades | Fonte Buffer Única | Observações |
|---------|----------------|-------|------------|--------------|----------|--------------------|-------------|
| LUFS Integrado | lib/audio/features/loudness.js :: LUFSMeter.calculateLUFS / applyGating | advanced:loudness | 48k assumido | 400ms blocks, 75% overlap | LUFS | Pending verificação multi-rate | Usa filtro K fixo 48k; gating abs -70 / rel -10 |
| LUFS Short-Term (median active) | loudness.js :: calculateShortTermLoudness + seleção mediana | advanced:loudness | 48k | 3s janela (base 400ms blocks) | LUFS | Yes | Mediana janelas ativas (>= -70 e >= Lint-10) |
| LUFS Momentary | loudness.js :: findMomentaryPeaks | advanced:loudness | 48k | 400ms | LUFS | Yes | Máx/Min/Avg dos blocks válidos |
| LRA (legacy) | loudness.js :: calculateLRA | advanced:loudness | 48k | 3s ST sequence | LU | Yes | Percentis 10-95 sem gating rel -20 |
| LRA (R128 opcional) | loudness.js :: calculateR128LRA | advanced:loudness | 48k | 3s ST, gating -70 & Lint-20 | LU | Yes | Ativado via window.USE_R128_LRA |
| True Peak (4x legacy / 8x upgrade) | truepeak.js :: TruePeakDetector.detectTruePeak | advanced:truepeak | 48k base → 192k / 384k interno | FIR 48 taps polyphase (legacy) / 192 taps windowed-sinc (upgrade) | dBTP | Yes | Upgrade via flags AUDIT_MODE + TP_UPGRADE; expõe oversampling_factor & true_peak_mode |
| Sample Peak | truepeak.js :: detectSampleClipping | advanced:truepeak | 48k | N/A | dBFS | Yes | Threshold 0.99 para clipping |
| Clipping Count (TP) | truepeak.js :: detectTruePeak | advanced:truepeak | 48k | N/A | count | Yes | Conta amostras > -1 dBTP linear |
| Stereo Correlation | public/audio-analyzer.js fallback loop | v1:fallback | Original do arquivo | Subsampling stride 512 | coef [-1,1] | Yes | Calculado se ausente do V2 |
| Stereo Width | public/audio-analyzer.js fallback / reference-builder stereoWidth01 | v1:fallback / ref:builder | 48k (builder) | Full buffer | 0..1 | Yes | width = side/mid RMS clamp |
| Balance L/R | public/audio-analyzer.js fallback | v1:fallback | File SR | Subsample 512 | -1..1 | Yes | Média amostral subsampled |
| Mono Compatibility | public/audio-analyzer.js (heurística) | v1:heuristic | File SR | N/A | categórico | Yes | Baseado em correlação |
| Spectral Centroid | spectrum.js :: calculateBasicFeatures / fallback simpleFFT | v2:spectral / v1:fallback | 48k / file SR | FFT 4096/2048; hop 1024 | Hz | Yes | STFT média vs fallback 2 janelas |
| Spectral Rolloff85 | spectrum.js :: calculateBasicFeatures / fallback simpleFFT (85%) | v2:spectral / v1:fallback | 48k | FFT 4096/hop1024 | Hz | Yes | 85% cumulative energy |
| Spectral Rolloff95/99 | spectrum.js :: calculateRolloffFeatures | v2:spectral | 48k | FFT 4096 | Hz | Yes | 90/95/99 também calculados internos |
| Spectral Rolloff50 | spectrum.js :: calculateBasicFeatures | v2:spectral | 48k | FFT 4096 | Hz | Yes | Novo (AUDIT_MODE); 50% cumulative energy |
| Spectral Flux | spectrum.js :: calculateSpectralFlux / fallback | v2:spectral / v1:fallback | 48k | Frame-to-frame STFT | normalized sum diff | Yes | v1 usa sqrt(sum(d^2))/N (difere de half-wave) |
| Spectral Flatness | spectrum.js envelope / fallback geo/arith | v2:spectral / v1:fallback | 48k | FFT window | ratio 0..1 | Yes | Fallback calcula geometric/arith mean |
| Harmonic Ratio | spectrum.js :: analyzeHarmonics | v2:spectral | 48k | STFT freq bins | ratio | Yes | Pico fundamental 80–1000 Hz + 6 harmônicos |
| Inharmonicity | spectrum.js :: analyzeHarmonics | v2:spectral | 48k | STFT | ratio | Yes | mean deviation normalized |
| THD Percent | spectrum.js :: analyzeHarmonics | v2:spectral | 48k | STFT | % | Yes | sqrt(sum(harmônicos)/fundamental)*100 (AUDIT_MODE) |
| Fundamental Freq | spectrum.js :: analyzeHarmonics | v2:spectral | 48k | STFT | Hz | Yes | 80–1000 Hz search |
| Spectral Tilt/Slope/Kurtosis | spectrum.js :: calculateSpectralEnvelope | v2:spectral | 48k | STFT | various | Yes | Regressão log-freq vs dB, etc. |
| Band Profiles (refs) | reference-builder.js :: computeBandProfile | ref:builder | 48k | Window 1s hop 0.5s | dB rel (band/global) | Yes | Usa mid mono; escala log10 sum ratio |
| Genre Targets (LUFS/LRA/TP/DR/Stereo) | reference-builder.js agregação final | ref:builder | 48k | Aggregation | targets + tol | Yes | mediana + MAD tol clamp |
| DR (atual = Crest) | public/audio-analyzer.js :: calculateDynamicRange | v1:basic | File SR | Full buffer | dB | Yes | DR = Peak dBFS - RMS dBFS (Crest) |
| Crest Factor (fallback) | public/audio-analyzer.js (peak-rms) | v1:basic | File SR | Full buffer | dB | Yes | Duplicado com DR atual |
| DC Offset | public/audio-analyzer.js (loop fallback) | v1:basic | File SR | Full buffer (stride 1) | linear | Yes | Média simples canal 0 (ou somado?) |
| Clipping Samples % | public/audio-analyzer.js (loop fallback) | v1:basic | File SR | Full buffer | % | Yes | Threshold 0.99 para sample clipping |
| Mix Score (legacy) | public/audio-analyzer.js scoring bloco | v1:scoring | N/A | N/A | 0–100 | Yes | computeMixScore (lib/audio/features/scoring.js) |

## Pendências de Mapeamento
- Rolloff50 não exposto.
- DR redefinido (P95 RMS 300ms - P10 RMS 300ms) inexistente. (Módulo dynamics.js criado; integração pendente sob flag)
- RMS por canal + Mid/Side não persistidos.
- True Peak: filtro 48 taps (precisa >=128) + estado entre blocos (atual single-pass). 
- THD% não implementado (harmonicRatio incompleto para THD).
- DC Offset por canal e pós-HPF não aplicado (usar HPF 20Hz antes).

## Próximos Passos
1. Completar verificação multi-sampleRate (true peak upgrade já dinâmico; loudness filtros ainda fixos 48k).
2. Integrar dynamics.js (dr_stat) preservando DR legacy (crest) e rotulando ambos.
3. Gerar versão detalhada com linha exata (linha do arquivo) após varredura ampliada.
4. Documentar flags (AUDIT_MODE, TP_UPGRADE, DR_REDEF etc.) em metrics-spec.md. (Concluído)

(Documento inicial – será enriquecido antes da Etapa 1.)
