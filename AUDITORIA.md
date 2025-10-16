# 🎯 AUDITORIA TOTAL: Analisador de Áudio — Granular + Score + Sugestões por Sub-Banda

> **STATUS**: READ-ONLY | Data: 16/10/2025  
> **OBJETIVO**: Definir forma segura e minimalista de implementar sub-bandas granulares, curva de referência por gênero, normalização LUFS, score adaptativo e sugestões inteligentes.

---

## 📂 I. INVENTÁRIO COMPLETO DO SISTEMA

### 1.1 Backend/Worker (work/)

#### 🔴 PRIORIDADE CRÍTICA

**`work/index.js`** (Orquestrador principal)
- **Função**: Entry point do worker; gerencia fila de jobs, download S3, timeout, recovery de órfãos
- **Chama**: `processAudioComplete()` from `work/api/audio/pipeline-complete.js`
- **Responsabilidade**: Download → Pipeline → Update DB → Cleanup
- **Timeout**: 3min pipeline, 2min download
- **Recovery**: Marca jobs órfãos (>10min processing) como `queued`
- **Blacklist**: Marca arquivos com ≥3 falhas consecutivas

**`work/api/audio/pipeline-complete.js`** (Pipeline mestre - não lido mas inferido)
- **Função**: Orquestra Fases 5.1-5.4 (decode → segment → metrics → output)
- **Fluxo estimado**:
  1. Decode áudio (ffmpeg)
  2. Segment em frames FFT/RMS
  3. Core metrics (LUFS, TP, DR, espectro)
  4. JSON output + scoring

**`api/audio/core-metrics.js`** ⭐ NÚCLEO ESPECTRAL
- **Função**: Processador de métricas técnicas (Fase 5.3)
- **Classe**: `CoreMetricsProcessor`
- **Métodos principais**:
  - `processMetrics(segmentedAudio)`: Orquestra todas as métricas
  - `calculateFFTMetrics(framesFFT)`: FFT + 8 métricas espectrais
  - `calculateLUFSMetrics()`: ITU-R BS.1770-4
  - `calculateTruePeakMetrics()`: FFmpeg ebur128
  - `calculateStereoMetricsCorrect()`: Correlação/Width
  - `calculateSpectralBandsMetrics()`: 7 bandas profissionais
  - `calculateSpectralCentroidMetrics()`: Centro de massa em Hz

**Estrutura de dados (Fase 5.2 → 5.3)**:
```javascript
segmentedAudio = {
  framesFFT: {
    frames: [{ leftFFT: {magnitude, phase}, rightFFT: {magnitude, phase} }],
    count, frameSize, hopSize, windowType
  },
  framesRMS: { left: [...], right: [...], count },
  originalChannels: { left: Float32Array, right: Float32Array },
  timestamps: {...}
}
```

**Configurações críticas**:
```javascript
CORE_METRICS_CONFIG = {
  SAMPLE_RATE: 48000,
  FFT_SIZE: 4096,
  FFT_HOP_SIZE: 1024,
  WINDOW_TYPE: "hann",
  LUFS_BLOCK_DURATION_MS: 400,
  LUFS_SHORT_TERM_DURATION_MS: 3000,
  LUFS_ABSOLUTE_THRESHOLD: -70.0,
  LUFS_RELATIVE_THRESHOLD: -10.0
}
```

**`lib/audio/features/spectral-bands.js`** ⭐ BANDAS ESPECTRAIS
- **Classe**: `SpectralBandsCalculator` + `SpectralBandsAggregator`
- **Método**: `analyzeBands(leftMagnitude, rightMagnitude, frameIndex)`
- **Saída**:
  ```javascript
  {
    bands: {
      sub: { energy, energy_db, percentage, frequencyRange, name, status },
      bass: {...}, lowMid: {...}, mid: {...}, highMid: {...}, presence: {...}, air: {...}
    },
    totalEnergy, totalPercentage, algorithm, valid, framesUsed
  }
  ```
- **Bandas atuais** (7):
  - Sub: 20-60 Hz
  - Bass: 60-150 Hz
  - Low-Mid: 150-500 Hz
  - Mid: 500-2000 Hz
  - High-Mid: 2000-5000 Hz
  - Presence: 5000-10000 Hz
  - Air: 10000-20000 Hz

**`lib/audio/features/loudness.js`**
- **Classe**: `LUFSMeter`
- **Método**: `calculateLUFS(leftChannel, rightChannel)`
- **Saída**: `{ lufs_integrated, lufs_short_term, lufs_momentary, lra }`
- **Padrão**: ITU-R BS.1770-4 (K-weighting + gating)

**`lib/audio/features/truepeak-ffmpeg.js`**
- **Função**: `analyzeTruePeaksFFmpeg(left, right, sampleRate, tempFilePath)`
- **Método**: FFmpeg ebur128 filter (4x oversampling)
- **Saída**: `{ true_peak_dbtp, true_peak_linear, sample_peak_left_db, sample_peak_right_db }`

**`lib/audio/features/dynamics-corrected.js`**
- **Função**: `calculateDynamicsMetrics(left, right, sampleRate, lra)`
- **Método**: Janelas 300ms, hop 100ms, percentis 10º/90º
- **Saída**: `{ dynamicRange (DR), crestFactor, peakRmsDb, averageRmsDb, drCategory }`

**`lib/audio/features/stereo-metrics.js`**
- **Classe**: `StereoMetricsCalculator`
- **Método**: `analyzeStereoMetrics(leftChannel, rightChannel)`
- **Saída**: `{ correlation (-1 a +1), width (0 a 1), valid }`

**`lib/audio/features/spectral-metrics.js`**
- **Classe**: `SpectralMetricsCalculator` + `SpectralMetricsAggregator`
- **Método**: `calculateAllMetrics(magnitude, frameIndex)`
- **Saída** (8 métricas):
  - `spectralCentroidHz`, `spectralRolloffHz`, `spectralBandwidthHz`, `spectralSpreadHz`
  - `spectralFlatness`, `spectralCrest`, `spectralSkewness`, `spectralKurtosis`

**`lib/audio/features/normalization.js`**
- **Função**: `normalizeAudioToTargetLUFS({ leftChannel, rightChannel }, sampleRate, { targetLUFS })`
- **Método**: Medir LUFS atual → aplicar gain estático → verificar clipping
- **Saída**: `{ leftChannel, rightChannel, gainAppliedDB, originalLUFS, isSilence, hasClipping }`

**`lib/audio/features/scoring.js`**
- **Função**: `computeMixScore(technicalData, reference)`
- **Método**: Pesos iguais p/ 7 categorias (LUFS, TP, DR, LRA, Corr, Centroid, Bandas)
- **Saída**: `{ score, scorePct, classification, breakdown, penalties, reference }`

**`work/api/audio/json-output.js`** ⭐ SERIALIZAÇÃO FINAL
- **Função**: `generateJSONOutput(coreMetrics, reference, metadata, options)`
- **Método**: Extrai `technicalData` → chama scoring → monta payload final
- **Saída**: Estrutura JSON compatível com front (ver seção III.2)

---

### 1.2 Frontend (public/)

**`public/audio-analyzer.js`** e **`public/audio-analyzer-v2.js`**
- **Classe**: `AudioAnalyzer`
- **Método chave**: `analyzeAudioFile(file, options)`
- **Uso**: Análise client-side (demo/preview); não usado em produção
- **Bandas front**: Espera 7 bandas (Sub/Bass/Low-mid/Mid/High-mid/Presence/Air)

**`public/audio-analyzer-integration.js`**
- **Função**: Integração entre modal e engine
- **Método**: `updateReferenceSuggestions()`
- **Exibe**: 7 bandas no modal, status (green/yellow/red), score

**`public/ai-suggestions-futuristic.css`**
- **Responsável**: Estilo do modal de sugestões
- **Classes**: `.ai-suggestion-item`, `.suggestion-status-ideal`, etc.

---

### 1.3 Referências por gênero (public/refs/)

**Formato atual** (`eletronico.preview.json`):
```json
{
  "eletronico": {
    "version": "v2_lufs_norm",
    "lufs_target": -18,
    "tol_lufs": 1.9,
    "true_peak_target": -11.2,
    "tol_true_peak": 1,
    "dr_target": 12.7,
    "tol_dr": 2,
    "lra_target": 6.6,
    "tol_lra": 1.5,
    "stereo_target": 0.88,
    "tol_stereo": 0.15,
    "bands": {
      "sub": { "target_db": 31.2, "tol_db": 1.7, "energy_pct": 36.73, "severity": "soft" },
      "low_bass": { "target_db": 31.2, "tol_db": 1.5, "energy_pct": 37.24, "severity": "soft" },
      ...
    }
  }
}
```

**Observações**:
- Bandas em **dB** e **%** de energia
- Tolerâncias fixas (não curvas de distribuição)
- Sem sub-bandas granulares
- **Limitação**: Apenas 8 bandas largas

---

### 1.4 Análise TypeScript (analyzer/)

**`analyzer/core/spectralBalance.ts`**
- **Classe**: `SpectralBalanceAnalyzer`
- **Método**: `analyze(audioData: Float32Array)`
- **Configuração**: 
  ```typescript
  SpectralBalanceConfig = {
    bands: SpectralBandConfig[], // customizável
    sampleRate, fftSize, hopSize, windowType
  }
  ```
- **Saída**:
  ```typescript
  SpectralBalanceResult = {
    bands: SpectralBandResult[], // { name, hzLow, hzHigh, energy, energyPct, rmsDb }
    summary3Bands: { Low, Mid, High },
    totalEnergy, processedFrames, fftSize, sampleRate
  }
  ```
- **Uso**: Não integrado no pipeline (módulo isolado)

---

## 📊 II. FLUXO DE DADOS (DATAFLOW)

### 2.1 Pipeline Atual (Legacy - Bandas Largas)

```
[Upload] → [POST /api/audio/analyze]
  ↓
[Criar Job no DB] (status=queued)
  ↓
[Worker: work/index.js] (poll a cada 5s)
  ↓
[Download de S3] (timeout 2min)
  ↓
[processAudioComplete(buffer, filename, reference)]
  ↓
┌─────────────────────────────────────────┐
│ FASE 5.1: Decode (ffmpeg/sox)          │
│ → AudioBuffer { left, right, sr, dur }  │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ FASE 5.2: Segmentation                 │
│ → framesFFT (4096, hop 1024, Hann)     │
│ → framesRMS (janelas sobr overlap)      │
│ → originalChannels preservados          │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────┐
│ FASE 5.3: Core Metrics (core-metrics.js)           │
│ ┌─────────────────────────────────────────────┐     │
│ │ normalizeAudioToTargetLUFS(-23 LUFS)       │     │
│ └─────────────────────────────────────────────┘     │
│   ↓                                                 │
│ calculateFFTMetrics(framesFFT)                      │
│   → Magnitude spectrum (RMS L+R)                    │
│   → 8 métricas espectrais (centroid, rolloff, etc) │
│   → Agregação por mediana                           │
│   ↓                                                 │
│ calculateSpectralBandsMetrics(framesFFT)            │
│   → SpectralBandsCalculator.analyzeBands()          │
│   → 7 bandas: Sub/Bass/Low-mid/Mid/High-mid/        │
│                Presence/Air                          │
│   → Energia linear → % → dB                         │
│   → SpectralBandsAggregator (mediana multi-frame)   │
│   ↓                                                 │
│ calculateLUFSMetrics(left, right)                   │
│   → Gating ITU-R BS.1770-4                          │
│   → integrated, short-term, momentary, LRA          │
│   ↓                                                 │
│ calculateTruePeakMetrics(left, right, tempFile)     │
│   → FFmpeg ebur128 filter (4x oversampling)         │
│   ↓                                                 │
│ calculateStereoMetricsCorrect(left, right)          │
│   → Correlation, Width, Balance                     │
│   ↓                                                 │
│ calculateDynamicsMetrics(left, right)               │
│   → DR, Crest Factor, LRA                           │
│   ↓                                                 │
│ [RETORNA coreMetrics]                               │
└─────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ FASE 5.4: JSON Output + Scoring        │
│ → extractTechnicalData(coreMetrics)     │
│ → computeMixScore(techData, reference)  │
│ → buildFinalJSON(...)                   │
│ → Serialização compatível com front     │
└─────────────────────────────────────────┘
  ↓
[Salvar no DB] (status=done, result=JSON)
  ↓
[Frontend exibe 7 bandas + score]
```

### 2.2 Pontos de Gancho para Granular V1

**Injeção proposta** (antes da agregação):

```
calculateSpectralBandsMetrics(framesFFT) [ATUAL]
  ↓
  [NOVO: if ANALYZER_ENGINE === 'granular_v1']
    ↓
  calculateGranularSubBands(framesFFT, genreRef)
    → Sub-bandas com passo configurável (ex: 20 Hz)
    → Comparação com target ± σ (curva de referência)
    → Cálculo de deviation = energy - target
    → Status: ideal/adjust/fix (baseado em σ)
    → Agregação → bandas largas (7 grupos)
    ↓
  buildSuggestionsFromSubBands(subBands)
    → Filtrar status !== 'ideal'
    → Gerar mensagens acionáveis (boost/cut + range + amount)
    ↓
  serializePayloadCompat(engineVersion='granular_v1')
    → Campos legacy (7 bandas) para compatibilidade
    → Campo adicional 'granular' com sub-bandas detalhadas
    → Campo 'suggestions' com mensagens inteligentes
```

**Arquivos a modificar**:
1. `lib/audio/features/spectral-bands-granular.js` (NOVO)
2. `api/audio/core-metrics.js` (adicionar ramo condicional)
3. `work/api/audio/json-output.js` (adicionar campos `granular` e `suggestions`)

---

## 🧪 III. DIAGNÓSTICO TÉCNICO (FRANQUEZA TOTAL)

### 3.1 Fragilidades Atuais

✅ **Confirmado** (análise de código):

1. **Bandas largas e pouco granulares**
   - Sub: 40 Hz de span (20-60)
   - Bass: 90 Hz de span (60-150)
   - Sensibilidade baixa para problemas localizados (ex: 80 Hz isolado)

2. **Comparação por energia total (média)**
   - `calculateBandEnergies()` soma toda a energia da banda
   - Não detecta "buracos" internos (ex: 100-120 Hz faltando em Bass)

3. **Normalização LUFS antes da comparação**
   - ✅ **EXISTE**: `normalizeAudioToTargetLUFS(-23 LUFS)` em `core-metrics.js:91`
   - **Método**: Gain estático aplicado aos canais
   - **Problema**: Normalização global, não por banda

4. **Hard-codes (bandas/targets)**
   - Bandas definidas em `lib/audio/features/spectral-bands.js:16-22`
   - Referências em JSON (`public/refs/*.json`)
   - **Risco**: Mudanças requerem tocar múltiplos arquivos

5. **Smoothing temporal**
   - ✅ **EXISTE**: `SpectralBandsAggregator.aggregate()` usa **mediana** de múltiplos frames
   - **Impacto**: Atenua variações rápidas (bom p/ estabilidade, ruim p/ detecção de transientes)
   - **Configuração**: Não explícita (depende de `actualFrames` em spectral-balance.ts)

6. **Acoplamento entre cálculo, pontuação e serialização**
   - `core-metrics.js` → `json-output.js` → `scoring.js` (cadeia rígida)
   - **Desacoplamento necessário**: Separar extração, scoring e serialização

### 3.2 Falsos "Ideais" (Ranges Permissivos)

**Exemplo** (`eletronico.preview.json`):
- Sub: `target_db: 31.2`, `tol_db: 1.7` → Range: **29.5 a 32.9 dB**
- Bass: `target_db: 31.2`, `tol_db: 1.5` → Range: **29.7 a 32.7 dB**

**Problema**: Tolerâncias largas (~3 dB) permitem desvios significativos sem penalização.

**Proposta Granular V1**: Usar `toleranceSigma` (ex: 1.5σ) em curva de distribuição:
- Dentro de 1σ → `ideal`
- Dentro de 2σ → `adjust`
- Fora de 2σ → `fix`

---

## 🧱 IV. PROPOSTA DE ARQUITETURA (COMPATÍVEL E SEGURA)

### 4.1 Schema de Referência por Gênero (v1)

**Arquivo**: `references/techno.v1.json`

```json
{
  "schemaVersion": 1,
  "genre": "techno",
  "lufsNormalization": true,
  "stepHz": 20,
  "bands": [
    { "id": "sub_low",       "range": [20, 40],    "target": -28.0, "toleranceSigma": 1.5 },
    { "id": "sub_high",      "range": [40, 60],    "target": -29.0, "toleranceSigma": 1.5 },
    { "id": "bass_low",      "range": [60, 90],    "target": -28.5, "toleranceSigma": 1.5 },
    { "id": "bass_high",     "range": [90, 120],   "target": -29.5, "toleranceSigma": 1.5 },
    { "id": "lowmid_low",    "range": [150, 300],  "target": -31.0, "toleranceSigma": 1.5 },
    { "id": "lowmid_high",   "range": [300, 500],  "target": -33.0, "toleranceSigma": 1.5 },
    { "id": "mid_low",       "range": [500, 1000], "target": -31.0, "toleranceSigma": 1.5 },
    { "id": "mid_high",      "range": [1000, 2000],"target": -33.0, "toleranceSigma": 1.5 },
    { "id": "highmid_low",   "range": [2000, 3500],"target": -34.0, "toleranceSigma": 1.5 },
    { "id": "highmid_high",  "range": [3500, 5000],"target": -36.0, "toleranceSigma": 1.5 },
    { "id": "presence",      "range": [5000,10000],"target": -40.0, "toleranceSigma": 2.0 },
    { "id": "air",           "range": [10000,20000],"target": -42.0,"toleranceSigma": 2.0 }
  ],
  "grouping": {
    "sub":      ["sub_low","sub_high"],
    "bass":     ["bass_low","bass_high"],
    "low_mid":  ["lowmid_low","lowmid_high"],
    "mid":      ["mid_low","mid_high"],
    "high_mid": ["highmid_low","highmid_high"],
    "presence": ["presence"],
    "air":      ["air"]
  },
  "severity": {
    "weights": { "ideal": 0, "adjust": 1, "fix": 3 },
    "thresholds": { "greenMax": 0, "yellowMax": 1.5 }
  },
  "suggestions": {
    "minDbStep": 1.0,
    "maxDbStep": 4.0,
    "language": "pt-BR"
  }
}
```

### 4.2 Lógica de Normalização, Desvio e Status (Pseudocódigo)

```javascript
// Entrada: audioBuffer normalizado a -23 LUFS (já feito em core-metrics.js)
const LU = -23; // LUFS integrado (pós-normalização)

// Função de status por desvio
function statusFromDeviation(dev, sigma = 1.5) {
  const a = Math.abs(dev);
  if (a <= sigma)        return "ideal";
  if (a <= sigma * 2.0)  return "adjust";
  return "fix";
}

// Calcular score por grupo (agregação das sub-bandas)
function scoreByGroup(results, grouping, weights, thresholds) {
  const out = {};
  for (const [group, ids] of Object.entries(grouping)) {
    const subs = results.filter(r => ids.includes(r.id));
    const points = subs.reduce((acc, s) => acc + weights[s.status], 0);
    const avg = points / subs.length;
    const color =
      avg <= thresholds.greenMax ? "green" :
      avg <= thresholds.yellowMax ? "yellow" : "red";
    out[group] = { status: color, score: +avg.toFixed(2) };
  }
  return out;
}
```

### 4.3 Sugestões a partir das Sub-Bandas

```javascript
function buildSuggestions(subBands, locale = "pt-BR") {
  return subBands
    .filter(b => b.status !== "ideal")
    .map(b => {
      const type = b.deviation < 0 ? "boost" : "cut";
      const amount = clamp(mapAbs(b.deviation, 0, 6, 1, 4), 1, 4);
      const msg = (type === "boost")
        ? `Falta energia em ${b.range[0]}–${b.range[1]} Hz — reforçar ~${amount} dB.`
        : `Excesso em ${b.range[0]}–${b.range[1]} Hz — reduzir ~${amount} dB.`;
      return {
        freq_range: b.range,
        type,
        amount,
        message: msg,
        deviation: b.deviation,
        metric: 'frequency_balance'
      };
    });
}
```

### 4.4 Feature Flag e Compatibilidade

**Variável de ambiente**:
```bash
ANALYZER_ENGINE=legacy|granular_v1
```

**Em `api/audio/core-metrics.js`**:
```javascript
async calculateSpectralBandsMetrics(framesFFT, options) {
  const engine = process.env.ANALYZER_ENGINE || 'legacy';
  
  if (engine === 'granular_v1') {
    return await this.calculateGranularSubBands(framesFFT, options);
  }
  
  // Legacy: 7 bandas largas
  return await this.calculateSpectralBandsLegacy(framesFFT, options);
}
```

**Contrato de payload** (sem quebra):
```json
{
  "engineVersion": "granular_v1",
  "bands": {
    "sub":      { "status": "yellow", "score": 1.0 },
    "bass":     { "status": "green",  "score": 0.0 },
    ...
  },
  "suggestions": [
    { "freq_range": [50, 70], "type": "boost", "amount": 2.5, "message": "..." }
  ],
  "granular": [
    { "id": "sub_low", "range": [20, 40], "energy": -28.3, "deviation": 0.2, "status": "ideal" }
  ]
}
```

---

## 📋 V. CHECKLIST DE DÚVIDAS (NÃO PERGUNTAR AGORA)

1. **Custo computacional**: FFT reprocessamento vs cache?
2. **Dataset de calibração**: Como construir curvas target/σ por gênero?
3. **Step Hz ideal**: 20 Hz? 30 Hz? Adaptativo por região de frequência?
4. **Smoothing temporal**: Manter mediana ou usar média móvel?
5. **Limites de sugestões**: Máx 3 por grupo? Top desvios absolutos?
6. **i18n**: Mensagens em PT-BR/EN — armazenar onde (JSON externo)?
7. **Validação A/B**: Quantas tracks para test de regressão?
8. **Threshold de silêncio**: MIN_ENERGY_THRESHOLD = 1e-12 é suficiente?
9. **Normalização por banda**: Vale a pena ou global é suficiente?
10. **Versionamento de schemas**: Migração de v1 → v2 automática?

---

## 🛠️ VI. RISCOS & MITIGAÇÃO

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| **Tudo sai "ideal"** (tolerâncias grandes) | Médio | Alto | σ pequeno (1.0-2.0), step Hz razoável (20-30 Hz), validação com dataset Techno diverso |
| **CPU ↑** (FFT por sub-banda) | Alto | Médio | Reuso de bins FFT existentes (CRITICAL), agregação vetorial, step adaptativo nos agudos, cache |
| **Quebra de contrato** (front não entende payload) | Baixo | Crítico | Campos aditivos somente (`granular`, `suggestions`), front ignora campos desconhecidos |
| **Texto confuso** (sugestões) | Médio | Médio | Mensagens curtas, PT-BR simples, foco em ação (boost/cut + faixa), teste com leigos |
| **Overfeedback** (muitas sugestões) | Alto | Médio | Limitar a 3 sugestões por grupo (maior \|deviation\|), threshold de relevância (mínimo 1 dB) |
| **TP/LUFS/DR/LRA alterados** | Baixo | Crítico | Usar mesmas funções existentes (sem mudança), testes de regressão numérica |

---

## 📄 VII. CONTRATOS DE SAÍDA (EXEMPLOS)

### 7.1 `contracts/example-payload.v1.json`

```json
{
  "engineVersion": "granular_v1",
  "bands": {
    "sub":      { "status": "yellow", "score": 1.0 },
    "bass":     { "status": "green",  "score": 0.0 },
    "low_mid":  { "status": "green",  "score": 0.0 },
    "mid":      { "status": "red",    "score": 2.6 },
    "high_mid": { "status": "green",  "score": 0.0 },
    "presence": { "status": "yellow", "score": 1.2 },
    "air":      { "status": "green",  "score": 0.0 }
  },
  "suggestions": [
    { "freq_range": [50, 70], "type": "boost", "amount": 2.5, "message": "Falta punch (55–70 Hz).", "metric": "frequency_balance" },
    { "freq_range": [1500, 2000], "type": "cut", "amount": 3.0, "message": "Presença excessiva (1.5–2 kHz).", "metric": "frequency_balance" }
  ],
  "granular": [
    { "id": "sub_low", "range": [20, 40], "energy": -28.3, "deviation": 0.2,  "status": "ideal" },
    { "id": "sub_high","range": [40, 60], "energy": -33.1, "deviation": -3.1, "status": "adjust" },
    { "id": "mid_high","range": [1000,2000], "energy": -29.0, "deviation": 3.5, "status": "fix" }
  ],
  "technicalData": {
    "lufsIntegrated": -10.2,
    "truePeakDbtp": -1.3,
    "dynamicRange": 12.4,
    "lra": 6.8,
    "stereoCorrelation": 0.88
  },
  "score": 74,
  "classification": "Bom"
}
```

### 7.2 `contracts/example-telemetry.json` (logs internos)

```json
{
  "input": { "duration_s": 214, "sr": 48000 },
  "fft": { "window": 4096, "hop": 1024, "windowFn": "hann" },
  "lufs": { "integrated": -10.2 },
  "ref": { "genre": "techno", "schemaVersion": 1 },
  "scoring": {
    "weights": { "ideal": 0, "adjust": 1, "fix": 3 },
    "thresholds": { "greenMax": 0, "yellowMax": 1.5 }
  },
  "groups7": {
    "sub": { "points": 4, "count": 4, "avg": 1.0, "color": "yellow" }
  }
}
```

---

## 🎯 VIII. ANÁLISE DE BANDAS ESPECTRAIS ATUAIS

### Código Crítico em `spectral-bands.js`

```javascript
const SPECTRAL_BANDS = {
  sub: { min: 20, max: 60 },
  bass: { min: 60, max: 150 },
  lowMid: { min: 150, max: 500 },
  mid: { min: 500, max: 2000 },
  highMid: { min: 2000, max: 5000 },
  presence: { min: 5000, max: 10000 },
  air: { min: 10000, max: 20000 }
};
```

**Limitações**:
1. Span variável (Sub: 40 Hz vs Presence: 5000 Hz)
2. Energia total por banda sem granularidade interna
3. Comparação: `(energia / totalEnergy) * 100` → % linear
4. Conversão para dB: `10 * log10(bandRMS / referenceLevel)`

**Proposta Granular**:
- Subdividir cada banda em passos de 20-30 Hz
- Manter agregação para compatibilidade (7 grupos)
- Adicionar campo `granular` com sub-bandas detalhadas

---

## 🚀 IX. SUMÁRIO EXECUTIVO

### 9.1 Estado Atual

✅ **Funcionando**:
- Pipeline robusto (Fases 5.1-5.4)
- LUFS ITU-R BS.1770-4 correto
- True Peak FFmpeg (4x oversampling)
- 7 bandas espectrais com soma = 100%
- Normalização a -23 LUFS pré-análise
- Scoring com pesos iguais (7 categorias)

❌ **Limitações**:
- Bandas largas (sensibilidade baixa)
- Comparação por energia total (não detecta "buracos")
- Tolerâncias fixas (não curvas de distribuição)
- Sugestões básicas (não específicas por sub-banda)
- Hard-codes (difícil manutenção)

### 9.2 Proposta Granular V1

**Objetivo**: Aumentar sensibilidade espectral sem quebrar compatibilidade.

**Abordagem**:
1. Sub-bandas granulares (step 20-30 Hz)
2. Comparação com `target ± σ` (curva de referência)
3. Status: ideal/adjust/fix (baseado em desvios)
4. Agregação → 7 grupos (compatibilidade front)
5. Sugestões inteligentes (boost/cut + range + amount)
6. Feature flag (`ANALYZER_ENGINE=granular_v1`)
7. Campos aditivos no payload (`granular`, `suggestions`)

**Vantagens**:
- Zero quebra no front (campos legacy mantidos)
- Sensibilidade granular (detecta problemas localizados)
- Mensagens acionáveis (leigos entendem)
- Calibragem futura por dataset (target/σ atualizáveis)

---

## 📚 X. TABELA DE FUNÇÕES/ASSINATURAS

| Arquivo | Função/Classe | Assinatura | Retorno | Quem Chama | Quem É Chamado |
|---------|---------------|------------|---------|------------|----------------|
| `work/index.js` | `processJob(job)` | `async (job)` | `void` | `processJobs()` (loop) | `processAudioComplete()`, `downloadFileFromBucket()` |
| `api/audio/core-metrics.js` | `CoreMetricsProcessor.processMetrics` | `async (segmentedAudio, options)` | `coreMetrics` | `pipeline-complete.js` | `calculateFFTMetrics()`, `calculateLUFSMetrics()`, etc. |
| `api/audio/core-metrics.js` | `calculateFFTMetrics` | `async (framesFFT, options)` | `fftResults` | `processMetrics()` | `SpectralMetricsCalculator.calculateAllMetrics()` |
| `lib/audio/features/spectral-bands.js` | `SpectralBandsCalculator.analyzeBands` | `(leftMag, rightMag, frameIndex)` | `{ bands, totalEnergy, valid }` | `calculateSpectralBandsMetrics()` | `calculateMagnitudeRMS()`, `calculateBandEnergies()` |
| `lib/audio/features/spectral-bands.js` | `SpectralBandsAggregator.aggregate` | `static (bandsArray)` | `{ bands, totalPercentage, valid }` | `calculateSpectralBandsMetrics()` | Mediana de frames |
| `lib/audio/features/loudness.js` | `LUFSMeter.calculateLUFS` | `(leftChannel, rightChannel)` | `{ lufs_integrated, lra, ... }` | `calculateLUFSMetrics()` | `calculateBlockLoudness()`, `applyGating()` |
| `lib/audio/features/scoring.js` | `computeMixScore` | `(technicalData, reference)` | `{ score, classification, breakdown }` | `generateJSONOutput()` | Cálculos internos de categoria |
| `work/api/audio/json-output.js` | `generateJSONOutput` | `(coreMetrics, reference, metadata, options)` | `finalJSON` | `pipeline-complete.js` | `extractTechnicalData()`, `computeMixScore()`, `buildFinalJSON()` |

---

## ⚙️ XI. CONFIGURAÇÕES CRÍTICAS

```javascript
// FFT/Análise Espectral
SAMPLE_RATE: 48000          // Hz
FFT_SIZE: 4096              // Samples (resolução ~11.7 Hz)
FFT_HOP_SIZE: 1024          // Samples (sobreposição 75%)
WINDOW_TYPE: "hann"         // Janela (Hann)

// LUFS
LUFS_BLOCK_DURATION_MS: 400      // Blocos de 400ms (ITU-R BS.1770-4)
LUFS_SHORT_TERM_DURATION_MS: 3000 // Short-term 3s
LUFS_ABSOLUTE_THRESHOLD: -70.0    // dB
LUFS_RELATIVE_THRESHOLD: -10.0    // dB

// True Peak
TRUE_PEAK_OVERSAMPLING: 4         // FFmpeg ebur128

// Normalização
TARGET_LUFS: -23.0               // LUFS alvo para normalização

// Spectral Bands
MIN_ENERGY_THRESHOLD: 1e-12      // Limiar de silêncio
PERCENTAGE_PRECISION: 2          // Casas decimais (%)
```

---

**FIM DA AUDITORIA**

> **Próximos passos**: Ver arquivo `PLAN.md` para etapas de implementação.
