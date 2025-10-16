# 🏗️ Arquitetura: Granular V1

## 📊 Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────────┐
│                        WORKER (work/index.js)                    │
│                                                                   │
│  1. Download audio do S3                                         │
│  2. Chamar pipeline completo                                     │
│  3. Salvar resultado no DB                                       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              PIPELINE (work/api/audio/pipeline-complete.js)      │
│                                                                   │
│  Fase 5.1: Decode (FFmpeg → AudioBuffer)                        │
│  Fase 5.2: Segmentation (AudioBuffer → framesFFT)               │
│  Fase 5.3: Core Metrics ◄── AQUI ENTRA O GRANULAR              │
│  Fase 5.4: JSON Output + Scoring                                │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│         CORE METRICS (work/api/audio/core-metrics.js)            │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  calculateSpectralBandsMetrics(framesFFT, options)      │   │
│  │                                                           │   │
│  │  🎯 FEATURE FLAG ROTEADOR                                │   │
│  │                                                           │   │
│  │  const engine = process.env.ANALYZER_ENGINE || 'legacy'  │   │
│  │                                                           │   │
│  │  if (engine === 'granular_v1') {                         │   │
│  │    ┌──────────────────────────────────────────────┐     │   │
│  │    │ calculateGranularSubBands()                   │     │   │
│  │    │                                                │     │   │
│  │    │ 1. Converter frames FFT                       │     │   │
│  │    │ 2. Import módulo granular                     │     │   │
│  │    │ 3. Executar análise                           │     │   │
│  │    │ 4. Retornar resultado                         │     │   │
│  │    └──────────────┬───────────────────────────────┘     │   │
│  │                   │                                       │   │
│  │                   ▼                                       │   │
│  │  } else { // legacy                                      │   │
│  │    ┌──────────────────────────────────────────────┐     │   │
│  │    │ calculateSpectralBandsLegacy()                │     │   │
│  │    │                                                │     │   │
│  │    │ 1. Usar SpectralBandsCalculator              │     │   │
│  │    │ 2. Calcular 7 bandas largas                  │     │   │
│  │    │ 3. Retornar bandas + percentages             │     │   │
│  │    └──────────────┬───────────────────────────────┘     │   │
│  │  }                │                                       │   │
│  └───────────────────┼───────────────────────────────────────┘   │
│                      │                                           │
│                      ▼                                           │
│                 RETORNAR spectralBandsResults                   │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│       GRANULAR MODULE (work/lib/audio/features/               │
│                        spectral-bands-granular.js)              │
│                                                                   │
│  ┌───────────────────────────────────────────────────────┐     │
│  │  analyzeGranularSpectralBands(framesFFT, reference)   │     │
│  │                                                         │     │
│  │  Para cada sub-banda (13 total):                       │     │
│  │    1. Converter range [Hz] → bins FFT                  │     │
│  │    2. Calcular energia RMS de todos os frames          │     │
│  │    3. Agregar usando mediana (robusto)                 │     │
│  │    4. Comparar com target ± σ                          │     │
│  │    5. Classificar: ideal/adjust/fix                    │     │
│  │                                                         │     │
│  │  Retorna:                                               │     │
│  │    - granular[]: 13 sub-bandas com status              │     │
│  │    - groups: 7 bandas principais agregadas             │     │
│  │    - suggestions[]: Ações recomendadas                 │     │
│  │    - metadata: Estatísticas de análise                 │     │
│  └───────────────────────────────────────────────────────┘     │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│         JSON OUTPUT (work/api/audio/json-output.js)              │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  buildFinalJSON(coreMetrics, ...)                       │   │
│  │                                                           │   │
│  │  Payload base (sempre presente):                         │   │
│  │    - score                                                │   │
│  │    - classification                                       │   │
│  │    - bands (7 principais)                                │   │
│  │    - technicalData (LUFS, TP, DR, etc.)                  │   │
│  │    - scoring                                              │   │
│  │                                                           │   │
│  │  🎯 CAMPOS ADITIVOS (spread operator)                    │   │
│  │                                                           │   │
│  │  ...(coreMetrics.spectralBands?.algorithm === 'granular_v1' && {│
│  │    engineVersion: 'granular_v1',                         │   │
│  │    granular: [...],      // 13 sub-bandas                │   │
│  │    suggestions: [...],   // Ações recomendadas           │   │
│  │    granularMetadata: {   // Estatísticas                 │   │
│  │      referenceGenre, schemaVersion, framesProcessed, ... │   │
│  │    }                                                      │   │
│  │  })                                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         PAYLOAD FINAL                            │
│                                                                   │
│  Legacy:                      Granular V1:                       │
│  {                            {                                  │
│    score: 74,                   score: 74,                       │
│    bands: {...},                bands: {...},                    │
│    technicalData: {...}         technicalData: {...},           │
│  }                              engineVersion: "granular_v1",    │
│                                 granular: [...],                 │
│                                 suggestions: [...]               │
│                               }                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Componentes Principais

### 1. Feature Flag (Environment Variable)

```bash
# .env
ANALYZER_ENGINE=legacy       # Modo padrão (original)
ANALYZER_ENGINE=granular_v1  # Modo granular (novo)
```

**Responsabilidade**: Controlar qual engine de análise espectral usar.

### 2. Roteador Condicional (core-metrics.js)

```javascript
async calculateSpectralBandsMetrics(framesFFT, options) {
  const engine = process.env.ANALYZER_ENGINE || 'legacy';
  
  if (engine === 'granular_v1') {
    return await this.calculateGranularSubBands(framesFFT, options);
  }
  
  // Legacy: código original inalterado
  return await this.calculateSpectralBandsLegacy(framesFFT, options);
}
```

**Responsabilidade**: Decidir qual caminho de análise seguir.

### 3. Módulo Granular (spectral-bands-granular.js)

```javascript
export async function analyzeGranularSpectralBands(framesFFT, reference) {
  // 1. Dividir espectro em 13 sub-bandas
  // 2. Calcular energia RMS por sub-banda
  // 3. Comparar com target ± σ
  // 4. Classificar status (ideal/adjust/fix)
  // 5. Agregar em 7 grupos principais
  // 6. Gerar sugestões inteligentes
  
  return {
    algorithm: 'granular_v1',
    groups: {...},
    granular: [...],
    suggestions: [...]
  };
}
```

**Responsabilidade**: Executar análise granular e gerar sugestões.

### 4. Payload Builder (json-output.js)

```javascript
function buildFinalJSON(coreMetrics, ...) {
  return {
    // Campos base (sempre presentes)
    score: ...,
    bands: ...,
    technicalData: ...,
    
    // Campos aditivos (somente se granular_v1)
    ...(coreMetrics.spectralBands?.algorithm === 'granular_v1' && {
      engineVersion: 'granular_v1',
      granular: [...],
      suggestions: [...]
    })
  };
}
```

**Responsabilidade**: Montar payload final com compatibilidade.

---

## 📦 Estrutura de Dados

### Sub-banda (Granular)

```javascript
{
  id: "sub_high",              // Identificador único
  range: [40, 60],             // Faixa de frequência (Hz)
  energyDb: -32.1,             // Energia medida (dB)
  target: -29.0,               // Target esperado (dB)
  toleranceSigma: 1.5,         // Tolerância (σ)
  deviation: -3.1,             // Desvio vs target (dB)
  deviationSigmas: 2.07,       // Desvio em unidades de σ
  status: "adjust",            // ideal | adjust | fix
  description: "Sub-bass alto" // Descrição (opcional)
}
```

### Grupo (Banda Principal)

```javascript
// Legacy
{
  energy_db: -28.3,
  percentage: 15.2,
  status: "calculated"
}

// Granular V1
{
  status: "yellow",            // green | yellow | red
  score: 1.0,                  // Score agregado (0-3)
  subBandsCount: 2,            // Quantidade de sub-bandas
  description: "Desvio moderado"
}
```

### Sugestão

```javascript
{
  priority: "high",            // high | medium | low
  freq_range: [40, 60],        // Faixa afetada (Hz)
  type: "boost",               // boost | cut
  amount: 2.5,                 // Quantidade (dB)
  metric: "frequency_balance", // Tipo de métrica
  deviation: -3.1,             // Desvio original
  message: "Falta energia..."  // Mensagem em português
}
```

---

## 🔄 Fluxo de Decisão

```
┌───────────────────┐
│ Upload de Áudio   │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ Pipeline Phase    │
│ 5.1: Decode       │
│ 5.2: Segment      │
└────────┬──────────┘
         │
         ▼
┌────────────────────────┐
│ Phase 5.3:             │
│ Core Metrics           │
│                        │
│ calculateSpectral...() │
└────────┬───────────────┘
         │
         ▼
    ╔═══════════════════════╗
    ║ ANALYZER_ENGINE ?     ║
    ╚═══════╦═══════════════╝
            │
    ┌───────┴────────┐
    │                │
    ▼                ▼
┌────────┐      ┌──────────┐
│ legacy │      │granular_v1│
└───┬────┘      └────┬─────┘
    │                │
    ▼                ▼
┌─────────────┐ ┌──────────────────┐
│ 7 bandas    │ │ 13 sub-bandas    │
│ largas      │ │ + sugestões      │
│ (20-20kHz)  │ │ (20-30 Hz step)  │
└──────┬──────┘ └────┬─────────────┘
       │             │
       └─────┬───────┘
             │
             ▼
    ┌─────────────────┐
    │ JSON Output     │
    │ buildFinalJSON()│
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ Payload Final   │
    │ - Legacy fields │
    │ + Granular (opt)│
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ Frontend        │
    │ Renderização    │
    └─────────────────┘
```

---

## 🧮 Algoritmo de Classificação

### Status por Sub-banda

```javascript
function statusFromDeviation(deviation, sigma) {
  const abs = Math.abs(deviation);
  
  if (abs <= sigma)       return 'ideal';   // Verde: dentro de 1σ
  if (abs <= sigma * 2)   return 'adjust';  // Amarelo: entre 1σ e 2σ
  return 'fix';                              // Vermelho: acima de 2σ
}
```

### Score por Grupo

```javascript
function scoreByGroup(subBands, weights) {
  const points = subBands.reduce((acc, sub) => {
    return acc + weights[sub.status];  // ideal=0, adjust=1, fix=3
  }, 0);
  
  const avgScore = points / subBands.length;
  
  // Determinar cor
  if (avgScore <= 0)    return 'green';   // Ideal
  if (avgScore <= 1.5)  return 'yellow';  // Moderado
  return 'red';                           // Problema
}
```

### Prioridade de Sugestões

```javascript
function getPriority(status) {
  if (status === 'fix')    return 'high';    // Problema crítico
  if (status === 'adjust') return 'medium';  // Ajuste leve
  return 'low';                              // Otimização
}
```

---

## 🔒 Pontos de Segurança

### 1. Validação de Entrada

```javascript
if (!framesFFT || !framesFFT.frames || framesFFT.frames.length === 0) {
  console.error('❌ Sem frames FFT');
  return getFallbackStructure();  // Estrutura vazia mas válida
}
```

### 2. Tratamento de Erros

```javascript
try {
  const result = await analyzeGranularSpectralBands(...);
  return result;
} catch (error) {
  console.error('❌ Erro na análise granular:', error);
  return {
    algorithm: 'granular_v1',
    groups: getNullBands(),
    granular: [],
    suggestions: [],
    valid: false,
    error: error.message
  };
}
```

### 3. Preservação Legacy

```javascript
// ❌ NUNCA faça isso
delete legacyFunction();

// ✅ SEMPRE adicione condicionalmente
if (engine === 'granular_v1') {
  newFunction();
} else {
  legacyFunction();  // Preservado
}
```

### 4. Campos Aditivos

```javascript
// ❌ NUNCA sobrescreva campos
bands: granularBands  // Quebra compatibilidade!

// ✅ SEMPRE use spread operator
...( condition && { newField: value } )  // Adiciona sem quebrar
```

---

## 📊 Métricas de Monitoramento

### Performance

- **Latência adicional**: Esperado +15% vs legacy
- **Memória**: Esperado +10% vs legacy
- **Payload size**: Esperado +25% vs legacy

### Qualidade

- **LUFS**: Deve ser idêntico (Δ < 0.01)
- **True Peak**: Deve ser idêntico (Δ < 0.01)
- **Dynamic Range**: Deve ser idêntico (Δ < 0.1)

### Logs a Monitorar

```
🚀 [SPECTRAL_BANDS] Engine granular_v1 ativado
🔍 [GRANULAR_V1] Frames convertidos: 1028
✅ [GRANULAR_V1] Análise concluída: 13 sub-bandas
```

---

## 🎯 Resumo Técnico

| Aspecto | Descrição |
|---------|-----------|
| **Arquitetura** | Modular, isolada, baseada em feature flag |
| **Compatibilidade** | 100% retrocompatível via spread operator |
| **Reversibilidade** | Rollback instantâneo mudando variável env |
| **Performance** | +15% latência, +10% memória (aceitável) |
| **Qualidade** | Métricas fundamentais inalteradas |
| **Segurança** | Validação + tratamento de erros + fallback |

---

**🏗️ Arquitetura robusta, testável e pronta para produção!**
