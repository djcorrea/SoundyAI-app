# ⚡ GUIA RÁPIDO DE IMPLEMENTAÇÃO - Performance Audit

## 🚀 Setup Inicial (5 minutos)

### 1. Adicionar Áudios de Teste
```powershell
# Copiar 3 arquivos WAV para:
work/tools/perf/audio-samples/short-30s.wav      # ~30s
work/tools/perf/audio-samples/medium-3min.wav    # ~3min
work/tools/perf/audio-samples/long-5min.wav      # ~5min
```

### 2. Rodar Baseline
```powershell
cd work
npm run perf:baseline
```

**Resultado**: `work/tools/perf/results/YYYY-MM-DD_HH-mm-ss/summary.md`

---

## 📊 Analisar Resultados (10 minutos)

### Abrir `summary.md`

**Procurar**:
1. Tempo total médio (linha "baseline")
2. Breakdown por fase (tabela detalhada)
3. Top 3 fases mais lentas

**Exemplo**:
```
| Fase                 | Média (ms) | P95 (ms) |
|---------------------|-----------|----------|
| BPM_METHOD_A        | 25000     | 26000    | ← GARGALO #1
| BPM_METHOD_B        | 20000     | 21000    | ← GARGALO #2
| SPECTRAL_BANDS      | 30000     | 32000    | ← GARGALO #3
| FFT_PROCESSING      | 20000     | 21000    |
| LUFS_CALCULATION    | 15000     | 16000    |
| TRUE_PEAK           | 8000      | 8500     |
```

### Validar Hipóteses

**H1: BPM em duplicidade (>25%)**
- Se `BPM_METHOD_A + BPM_METHOD_B > 40% do total` → **VERDADEIRO**

**H2: Bandas espectrais (alocações excessivas)**
- Se `SPECTRAL_BANDS > 20% do total` → **VERDADEIRO**

**H3-H5**: Validar após instrumentar subfases específicas

---

## 🔧 Instrumentar Código (30 minutos)

### Passo 1: Importar Sistema

Adicionar no topo de `work/api/audio/core-metrics.js`:

```javascript
import { withPhase, measureAsync, configureInstrumentation } from '../../tools/perf/instrumentation.js';
```

### Passo 2: Configurar no Pipeline

Em `work/api/audio/pipeline-complete.js`:

```javascript
export async function processAudioComplete(audioBuffer, fileName, options = {}) {
  const jobId = options.jobId || 'unknown';
  
  // ✅ ADICIONAR ESTA LINHA
  configureInstrumentation({ enabled: process.env.PERF_AUDIT === 'true', jobId });
  
  // ... resto do código
}
```

### Passo 3: Envolver Fases Principais

**ANTES**:
```javascript
const lufsMetrics = await calculateLUFSMetrics(normalizedLeft, normalizedRight, { jobId });
```

**DEPOIS**:
```javascript
const lufsMetrics = await measureAsync('LUFS_CALCULATION', async () => {
  return await calculateLUFSMetrics(normalizedLeft, normalizedRight, { jobId });
}, { samples: normalizedLeft.length });
```

### Passo 4: BPM com Métodos Separados

**ANTES**:
```javascript
const musicTempoBpm = this.calculateMusicTempoBpm(...);
const autocorrBpm = this.calculateAutocorrelationBpm(...);
```

**DEPOIS**:
```javascript
const musicTempoBpm = await measureAsync('BPM_METHOD_A', async () => {
  return this.calculateMusicTempoBpm(...);
}, { method: 'music-tempo' });

const autocorrBpm = await measureAsync('BPM_METHOD_B', async () => {
  return this.calculateAutocorrelationBpm(...);
}, { method: 'autocorrelation' });
```

### Passo 5: Testar Instrumentação

```powershell
# Rodar com flag de performance
$env:PERF_AUDIT="true"
npm run perf:baseline
```

**Verificar**: `summary.md` deve ter breakdown detalhado com `BPM_METHOD_A`, `BPM_METHOD_B`, etc.

---

## 🎯 Implementar Otimizações

### Otimização 1: BPM Condicional (30 minutos)

**Branch**: `perf/otimizacao-bpm-condicional`

**Arquivo**: `work/api/audio/core-metrics.js`

**Mudança**:

```javascript
// ANTES: Rodar ambos sempre
const musicTempoBpm = await measureAsync('BPM_METHOD_A', ...);
const autocorrBpm = await measureAsync('BPM_METHOD_B', ...);

// DEPOIS: Método B apenas se confiança A < 0.5
const musicTempoBpm = await measureAsync('BPM_METHOD_A', ...);

let autocorrBpm = { bpm: null, confidence: 0 };
if (musicTempoBpm.confidence < 0.5) {
  autocorrBpm = await measureAsync('BPM_METHOD_B', ...);
}
```

**Testar**:
```powershell
npm run perf:exp -- --experiment=bpm-conditional
```

**Validar Paridade**:
```powershell
npm run perf:parity results/baseline/results.json results/latest/results.json
```

**Esperado**: Redução de ~20s, paridade PASS

---

### Otimização 2: Bandas Vetorizadas (60 minutos)

**Branch**: `perf/otimizacao-bandas-vetorizadas`

**Arquivo**: `work/lib/audio/features/spectral-bands.js`

**Mudanças**:

1. **Pré-alocar buffers** (evitar `new Float32Array` no loop):

```javascript
class SpectralBandsCalculator {
  constructor(sampleRate, fftSize) {
    // ...
    // ✅ ADICIONAR: Pre-alocar buffer reutilizável
    this._rmsBuffer = new Float32Array(fftSize / 2);
  }
  
  calculateMagnitudeRMS(leftMagnitude, rightMagnitude) {
    // ❌ ANTES: const rmsSpectrum = new Float32Array(length);
    // ✅ DEPOIS: Reutilizar buffer
    const rmsSpectrum = this._rmsBuffer;
    
    for (let i = 0; i < length; i++) {
      // ... cálculo RMS
    }
    
    return rmsSpectrum;
  }
}
```

2. **Vetorizar loops** (usar operações em bloco):

```javascript
// ❌ ANTES: Loop explícito
for (let bin = minBin; bin <= maxBin; bin++) {
  energy += magnitude[bin] * magnitude[bin];
}

// ✅ DEPOIS: Usar subarray e reduce (mais rápido)
const bandSlice = magnitude.subarray(minBin, maxBin + 1);
const energy = bandSlice.reduce((sum, val) => sum + val * val, 0);
```

**Testar**:
```powershell
npm run perf:exp -- --experiment=bands-impl-opt
```

**Validar Paridade**:
```powershell
npm run perf:parity results/baseline/results.json results/latest/results.json
```

**Esperado**: Redução de ~10s, paridade PASS (±0.5pp)

---

### Otimização 3: Paralelização (45 minutos)

**Branch**: `perf/otimizacao-paralela`

**Arquivo**: `work/api/audio/core-metrics.js`

**Mudança**:

```javascript
// ❌ ANTES: Sequencial
const lufsMetrics = await calculateLUFSMetrics(...);
const truePeakMetrics = await calculateTruePeakMetrics(...);
const spectralBandsResults = await calculateSpectralBandsMetrics(...);

// ✅ DEPOIS: Paralelo (Promise.all)
const [lufsMetrics, truePeakMetrics, spectralBandsResults] = await Promise.all([
  measureAsync('LUFS_CALCULATION', () => calculateLUFSMetrics(...)),
  measureAsync('TRUE_PEAK_CALCULATION', () => calculateTruePeakMetrics(...)),
  measureAsync('SPECTRAL_BANDS', () => calculateSpectralBandsMetrics(...))
]);
```

**Testar**:
```powershell
npm run perf:exp -- --experiment=parallel
```

**Validar Paridade**:
```powershell
npm run perf:parity results/baseline/results.json results/latest/results.json
```

**Esperado**: Redução de ~30-40s (depende de CPUs), paridade PASS

---

## 📋 Checklist de Entrega

### Branch `perf/auditoria-instrumentacao`
- [ ] Código instrumentado (withPhase + measureAsync)
- [ ] Baseline rodado (3+ repetições)
- [ ] `AUDIT_REPORT_INITIAL.md` atualizado
- [ ] PR criado com relatório de gargalos

### Branch `perf/otimizacao-bpm-condicional`
- [ ] Código otimizado (BPM método B condicional)
- [ ] Experimento rodado
- [ ] Paridade validada (PASS)
- [ ] PR com changelog: "Redução de Xms (~Y%)"

### Branch `perf/otimizacao-bandas-vetorizadas`
- [ ] Código otimizado (buffers reutilizáveis, loops vetorizados)
- [ ] Experimento rodado
- [ ] Paridade validada (PASS com ±0.5pp)
- [ ] PR com changelog

### Branch `perf/otimizacao-paralela`
- [ ] Código otimizado (Promise.all para LUFS/TP/Bandas)
- [ ] Experimento rodado
- [ ] Paridade validada (PASS)
- [ ] PR com changelog

---

## 🎯 Meta Final

**Redução esperada**:
- BPM Condicional: ~20s (-13%)
- Bandas Vetorizadas: ~10s (-7%)
- Paralelização: ~30s (-20%)
- **TOTAL**: ~60s (-40%)

**Tempo final**: ~90s (objetivo: ≤ 75s)

**Se precisar mais**: Considerar FFT optimization, decode cache ou remover método B do BPM completamente (se paridade permitir).

---

## 📞 Suporte

- **Documentação Completa**: `work/tools/perf/README.md`
- **Exemplos de Código**: `work/tools/perf/INSTRUMENTATION_EXAMPLE.js`
- **Relatório Inicial**: `work/tools/perf/AUDIT_REPORT_INITIAL.md`
- **Configuração**: `work/tools/perf/bench.config.json`

---

**Boa sorte com a auditoria! 🚀**
