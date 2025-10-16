# 📋 PLAN: Implementação Granular V1 — Sub-Bandas + Score + Sugestões

> **MODO**: Incremental, Seguro, Com Roll-Back  
> **PRINCÍPIO**: Campos aditivos (zero quebra), Feature flag (A/B test), Testes de regressão

---

## 🎯 OBJETIVO FINAL

Introduzir análise granular de sub-bandas espectrais (step 20-30 Hz) com:
1. Comparação contra curva de referência por gênero (target ± σ)
2. Score agregado por grupo (7 bandas largas para compatibilidade)
3. Sugestões inteligentes (boost/cut + range + amount)
4. Feature flag (`ANALYZER_ENGINE`) para rodar lado a lado com legacy
5. Schemas versionados (JSON) para referências
6. Payload compatível (campos aditivos: `granular`, `suggestions`)

---

## 📐 ETAPAS DE IMPLEMENTAÇÃO

### ✅ **ETAPA 1: Schema de Referência Versionado** (1-2h)

**Objetivo**: Criar formato JSON para referências granulares por gênero.

**Arquivos**:
- **CRIAR**: `references/techno.v1.json`
- **CRIAR**: `references/schema-v1.spec.md` (documentação do formato)

**Conteúdo** (`references/techno.v1.json`):
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
    { "id": "bass_upper",    "range": [120, 150],  "target": -30.0, "toleranceSigma": 1.5 },
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
    "bass":     ["bass_low","bass_high","bass_upper"],
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
    "maxPerGroup": 3,
    "minRelevanceDb": 1.0,
    "language": "pt-BR"
  }
}
```

**Validação**:
```javascript
// Test: carregar e parsear
const ref = JSON.parse(fs.readFileSync('references/techno.v1.json'));
assert(ref.schemaVersion === 1);
assert(ref.bands.length > 0);
assert(ref.grouping.sub.includes('sub_low'));
```

**Impacto**: ZERO (apenas novo arquivo)  
**Risco**: Nenhum  
**Roll-back**: Deletar arquivo

---

### ✅ **ETAPA 2: Módulo de Análise Granular** (3-4h)

**Objetivo**: Criar calculadora de sub-bandas granulares sem tocar no código existente.

**Arquivos**:
- **CRIAR**: `lib/audio/features/spectral-bands-granular.js`
- **CRIAR**: `lib/audio/features/spectral-bands-granular.test.js` (testes unitários)

**Estrutura** (`spectral-bands-granular.js`):

```javascript
import { logAudio, makeErr } from '../error-handling.js';

/**
 * 🌈 Calculadora de Sub-Bandas Granulares
 */
export class GranularSpectralAnalyzer {
  
  constructor(sampleRate = 48000, fftSize = 4096) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.frequencyResolution = sampleRate / fftSize;
  }
  
  /**
   * Calcular energia de sub-bandas granulares
   * @param {Float32Array} magnitude - Espectro de magnitude (já calculado)
   * @param {Array} bandsConfig - Array de { id, range: [min, max], target, toleranceSigma }
   * @returns {Array} Sub-bands com { id, range, energy, energyDb, deviation, status }
   */
  analyzeGranularBands(magnitude, bandsConfig) {
    const results = [];
    
    for (const band of bandsConfig) {
      const [minFreq, maxFreq] = band.range;
      const minBin = Math.floor(minFreq / this.frequencyResolution);
      const maxBin = Math.ceil(maxFreq / this.frequencyResolution);
      
      // Calcular energia da sub-banda
      let energy = 0;
      let binCount = 0;
      for (let bin = minBin; bin <= maxBin && bin < magnitude.length; bin++) {
        energy += magnitude[bin] * magnitude[bin]; // |X|²
        binCount++;
      }
      
      if (binCount === 0) continue;
      
      // RMS da sub-banda
      const rms = Math.sqrt(energy / binCount);
      const energyDb = 10 * Math.log10(Math.max(rms, 1e-12));
      
      // Calcular desvio
      const deviation = energyDb - band.target;
      
      // Status baseado em σ
      const status = this.calculateStatus(deviation, band.toleranceSigma);
      
      results.push({
        id: band.id,
        range: band.range,
        energy: rms,
        energyDb: Number(energyDb.toFixed(1)),
        target: band.target,
        deviation: Number(deviation.toFixed(1)),
        status
      });
    }
    
    return results;
  }
  
  /**
   * Status baseado em desvio e sigma
   */
  calculateStatus(deviation, sigma) {
    const absDeviation = Math.abs(deviation);
    if (absDeviation <= sigma) return "ideal";
    if (absDeviation <= sigma * 2.0) return "adjust";
    return "fix";
  }
  
  /**
   * Agregar sub-bandas em grupos (7 bandas largas)
   */
  aggregateToGroups(subBands, grouping, weights, thresholds) {
    const groups = {};
    
    for (const [groupName, subBandIds] of Object.entries(grouping)) {
      const groupBands = subBands.filter(b => subBandIds.includes(b.id));
      
      if (groupBands.length === 0) {
        groups[groupName] = { status: "unknown", score: null };
        continue;
      }
      
      // Calcular score médio do grupo (weighted)
      const totalWeight = groupBands.reduce((sum, b) => sum + weights[b.status], 0);
      const avgWeight = totalWeight / groupBands.length;
      
      // Determinar cor (green/yellow/red)
      let color;
      if (avgWeight <= thresholds.greenMax) color = "green";
      else if (avgWeight <= thresholds.yellowMax) color = "yellow";
      else color = "red";
      
      groups[groupName] = {
        status: color,
        score: Number(avgWeight.toFixed(2))
      };
    }
    
    return groups;
  }
  
  /**
   * Gerar sugestões inteligentes
   */
  generateSuggestions(subBands, config = {}) {
    const {
      minDbStep = 1.0,
      maxDbStep = 4.0,
      maxPerGroup = 3,
      minRelevanceDb = 1.0,
      language = 'pt-BR'
    } = config;
    
    const suggestions = subBands
      .filter(b => b.status !== 'ideal')
      .filter(b => Math.abs(b.deviation) >= minRelevanceDb) // Filtrar apenas relevantes
      .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation)) // Maior desvio primeiro
      .slice(0, maxPerGroup * 7) // Limitar total (maxPerGroup * 7 grupos)
      .map(b => {
        const type = b.deviation < 0 ? "boost" : "cut";
        const amount = this.calculateAdjustmentAmount(b.deviation, minDbStep, maxDbStep);
        const message = this.buildMessage(type, b.range, amount, language);
        
        return {
          freq_range: b.range,
          type,
          amount,
          message,
          deviation: b.deviation,
          metric: 'frequency_balance',
          priority: Math.abs(b.deviation) > 3 ? 'high' : 'medium'
        };
      });
    
    return suggestions;
  }
  
  /**
   * Calcular quantidade de ajuste (dB)
   */
  calculateAdjustmentAmount(deviation, minDb, maxDb) {
    const absDeviation = Math.abs(deviation);
    // Mapeamento linear: 0-6 dB de desvio → minDb-maxDb de ajuste
    const amount = minDb + (absDeviation / 6) * (maxDb - minDb);
    return Number(Math.max(minDb, Math.min(maxDb, amount)).toFixed(1));
  }
  
  /**
   * Construir mensagem de sugestão
   */
  buildMessage(type, range, amount, language) {
    const [min, max] = range;
    
    if (language === 'pt-BR') {
      if (type === 'boost') {
        return `Falta energia em ${min}–${max} Hz — reforçar ~${amount} dB.`;
      } else {
        return `Excesso em ${min}–${max} Hz — reduzir ~${amount} dB.`;
      }
    }
    
    // Fallback EN
    if (type === 'boost') {
      return `Lacking energy at ${min}–${max} Hz — boost ~${amount} dB.`;
    } else {
      return `Excess at ${min}–${max} Hz — cut ~${amount} dB.`;
    }
  }
}

/**
 * Função auxiliar para integração com pipeline
 */
export function analyzeGranularSpectralBands(
  leftMagnitude,
  rightMagnitude,
  referenceConfig,
  sampleRate = 48000,
  fftSize = 4096
) {
  const analyzer = new GranularSpectralAnalyzer(sampleRate, fftSize);
  
  // Calcular magnitude RMS (mesmo método do legacy)
  const magnitude = new Float32Array(leftMagnitude.length);
  for (let i = 0; i < magnitude.length; i++) {
    const leftEnergy = leftMagnitude[i] * leftMagnitude[i];
    const rightEnergy = rightMagnitude[i] * rightMagnitude[i];
    magnitude[i] = Math.sqrt((leftEnergy + rightEnergy) / 2);
  }
  
  // Analisar sub-bandas
  const subBands = analyzer.analyzeGranularBands(magnitude, referenceConfig.bands);
  
  // Agregar em grupos
  const groups = analyzer.aggregateToGroups(
    subBands,
    referenceConfig.grouping,
    referenceConfig.severity.weights,
    referenceConfig.severity.thresholds
  );
  
  // Gerar sugestões
  const suggestions = analyzer.generateSuggestions(subBands, referenceConfig.suggestions);
  
  return {
    subBands,
    groups,
    suggestions,
    algorithm: 'granular_v1',
    referenceGenre: referenceConfig.genre,
    schemaVersion: referenceConfig.schemaVersion
  };
}

console.log('🌈 Granular Spectral Analyzer carregado - Sub-bandas com target ± σ');
```

**Testes** (`spectral-bands-granular.test.js`):
```javascript
import { GranularSpectralAnalyzer } from './spectral-bands-granular.js';
import assert from 'assert';

// Test 1: Inicialização
const analyzer = new GranularSpectralAnalyzer(48000, 4096);
assert.strictEqual(analyzer.frequencyResolution, 48000 / 4096);

// Test 2: Status por desvio
assert.strictEqual(analyzer.calculateStatus(0.5, 1.5), 'ideal');
assert.strictEqual(analyzer.calculateStatus(2.0, 1.5), 'adjust');
assert.strictEqual(analyzer.calculateStatus(4.0, 1.5), 'fix');

// Test 3: Adjustment amount
assert.strictEqual(analyzer.calculateAdjustmentAmount(0, 1, 4), 1.0);
assert.strictEqual(analyzer.calculateAdjustmentAmount(6, 1, 4), 4.0);
assert.strictEqual(analyzer.calculateAdjustmentAmount(3, 1, 4), 2.5);

console.log('✅ Todos os testes passaram');
```

**Impacto**: ZERO (módulo isolado)  
**Risco**: Nenhum  
**Roll-back**: Deletar arquivo

---

### ✅ **ETAPA 3: Feature Flag e Integração em Core Metrics** (2-3h)

**Objetivo**: Adicionar ramo condicional para rodar granular vs legacy.

**Arquivos**:
- **MODIFICAR**: `api/audio/core-metrics.js` (adicionar método `calculateGranularSubBands`)
- **MODIFICAR**: `.env` (adicionar `ANALYZER_ENGINE=legacy`)

**Mudanças em `api/audio/core-metrics.js`**:

```javascript
// ADICIONAR no topo
import { analyzeGranularSpectralBands } from '../../lib/audio/features/spectral-bands-granular.js';
import fs from 'fs';
import path from 'path';

// ADICIONAR método na classe CoreMetricsProcessor
class CoreMetricsProcessor {
  // ... (código existente)
  
  /**
   * 🌈 Calcular sub-bandas granulares (Granular V1)
   */
  async calculateGranularSubBands(framesFFT, options = {}) {
    const { jobId, reference } = options;
    
    try {
      logAudio('spectral_granular', 'start', { jobId, hasReference: !!reference });
      
      // Carregar referência granular
      let referenceConfig = null;
      if (reference && reference.genre) {
        const refPath = path.join(process.cwd(), 'references', `${reference.genre}.v1.json`);
        if (fs.existsSync(refPath)) {
          referenceConfig = JSON.parse(fs.readFileSync(refPath, 'utf8'));
        }
      }
      
      // Fallback: usar schema default (techno)
      if (!referenceConfig) {
        const defaultPath = path.join(process.cwd(), 'references', 'techno.v1.json');
        referenceConfig = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
        logAudio('spectral_granular', 'using_default', { genre: 'techno' });
      }
      
      if (!framesFFT || !framesFFT.frames || framesFFT.frames.length === 0) {
        logAudio('spectral_granular', 'no_frames', { jobId });
        return this.getGranularNullResult();
      }
      
      // Processar múltiplos frames e agregar
      const allSubBands = [];
      const allGroups = [];
      
      for (let frameIndex = 0; frameIndex < Math.min(framesFFT.frames.length, 50); frameIndex++) {
        const frame = framesFFT.frames[frameIndex];
        
        if (frame.leftFFT?.magnitude && frame.rightFFT?.magnitude) {
          const result = analyzeGranularSpectralBands(
            frame.leftFFT.magnitude,
            frame.rightFFT.magnitude,
            referenceConfig
          );
          
          allSubBands.push(...result.subBands);
          allGroups.push(result.groups);
        }
      }
      
      // Agregar resultados de múltiplos frames (mediana)
      const aggregatedSubBands = this.aggregateSubBandsMultiFrame(allSubBands, referenceConfig);
      const aggregatedGroups = this.aggregateGroupsMultiFrame(allGroups);
      
      // Gerar sugestões a partir das sub-bandas agregadas
      const analyzer = new (await import('../../lib/audio/features/spectral-bands-granular.js')).GranularSpectralAnalyzer();
      const suggestions = analyzer.generateSuggestions(aggregatedSubBands, referenceConfig.suggestions);
      
      logAudio('spectral_granular', 'completed', {
        subBands: aggregatedSubBands.length,
        suggestions: suggestions.length,
        jobId
      });
      
      return {
        granular: aggregatedSubBands,
        bands: aggregatedGroups, // Compatibilidade com json-output
        suggestions,
        algorithm: 'granular_v1',
        referenceGenre: referenceConfig.genre,
        schemaVersion: referenceConfig.schemaVersion,
        valid: true
      };
      
    } catch (error) {
      logAudio('spectral_granular', 'error', { error: error.message, jobId });
      return this.getGranularNullResult();
    }
  }
  
  /**
   * Agregador de sub-bandas multi-frame (mediana)
   */
  aggregateSubBandsMultiFrame(allSubBands, referenceConfig) {
    const grouped = {};
    
    // Agrupar por id
    for (const band of allSubBands) {
      if (!grouped[band.id]) grouped[band.id] = [];
      grouped[band.id].push(band);
    }
    
    // Calcular mediana para cada grupo
    const aggregated = [];
    for (const bandConfig of referenceConfig.bands) {
      const bandId = bandConfig.id;
      const instances = grouped[bandId] || [];
      
      if (instances.length === 0) continue;
      
      // Mediana de energyDb
      const energyDbs = instances.map(b => b.energyDb).sort((a, b) => a - b);
      const medianIndex = Math.floor(energyDbs.length / 2);
      const medianEnergyDb = energyDbs.length % 2 === 0
        ? (energyDbs[medianIndex - 1] + energyDbs[medianIndex]) / 2
        : energyDbs[medianIndex];
      
      const deviation = medianEnergyDb - bandConfig.target;
      const status = instances[0].status; // Usar status do primeiro (já calculado)
      
      aggregated.push({
        id: bandId,
        range: bandConfig.range,
        energyDb: Number(medianEnergyDb.toFixed(1)),
        target: bandConfig.target,
        deviation: Number(deviation.toFixed(1)),
        status
      });
    }
    
    return aggregated;
  }
  
  /**
   * Agregador de grupos multi-frame (média)
   */
  aggregateGroupsMultiFrame(allGroups) {
    const keys = Object.keys(allGroups[0] || {});
    const aggregated = {};
    
    for (const key of keys) {
      const scores = allGroups.map(g => g[key].score).filter(s => s !== null);
      const avgScore = scores.length > 0
        ? scores.reduce((sum, s) => sum + s, 0) / scores.length
        : null;
      
      let status = 'unknown';
      if (avgScore !== null) {
        if (avgScore <= 0) status = 'green';
        else if (avgScore <= 1.5) status = 'yellow';
        else status = 'red';
      }
      
      aggregated[key] = {
        status,
        score: avgScore !== null ? Number(avgScore.toFixed(2)) : null
      };
    }
    
    return aggregated;
  }
  
  /**
   * Resultado nulo para granular
   */
  getGranularNullResult() {
    return {
      granular: [],
      bands: {},
      suggestions: [],
      algorithm: 'granular_v1',
      valid: false
    };
  }
  
  /**
   * 🌈 Calcular bandas espectrais (ROTEADOR: legacy vs granular)
   */
  async calculateSpectralBandsMetrics(framesFFT, options = {}) {
    const engine = process.env.ANALYZER_ENGINE || 'legacy';
    const { jobId } = options;
    
    logAudio('spectral_bands', 'engine_selection', { engine, jobId });
    
    if (engine === 'granular_v1') {
      return await this.calculateGranularSubBands(framesFFT, options);
    }
    
    // Legacy: 7 bandas largas (código existente)
    return await this.calculateSpectralBandsLegacy(framesFFT, options);
  }
  
  /**
   * Renomear método existente para legacy
   */
  async calculateSpectralBandsLegacy(framesFFT, options = {}) {
    // CÓDIGO EXISTENTE (copiar de calculateSpectralBandsMetrics atual)
    const { jobId } = options;
    // ... (código original)
  }
}
```

**Mudanças em `.env`**:
```bash
# Feature flag: legacy | granular_v1
ANALYZER_ENGINE=legacy
```

**Testes manuais**:
1. Com `ANALYZER_ENGINE=legacy`: Verificar payload sem campos `granular` e `suggestions`
2. Com `ANALYZER_ENGINE=granular_v1`: Verificar payload com campos adicionais

**Impacto**: Baixo (apenas adiciona ramo condicional)  
**Risco**: Médio (se feature flag não funcionar, cai em erro)  
**Roll-back**: Setar `ANALYZER_ENGINE=legacy` e remover imports

---

### ✅ **ETAPA 4: Atualizar JSON Output** (1-2h)

**Objetivo**: Serializar campos `granular` e `suggestions` no payload final.

**Arquivos**:
- **MODIFICAR**: `work/api/audio/json-output.js` (adicionar campos em `buildFinalJSON`)

**Mudanças**:

```javascript
// Em buildFinalJSON()
function buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata, options = {}) {
  const { jobId } = options;
  
  // ... (código existente para legacy fields)
  
  const finalJSON = {
    // ... (campos existentes)
    
    // ADICIONAR: Campos granulares (se disponíveis)
    ...(coreMetrics.spectralBands?.granular && {
      granular: coreMetrics.spectralBands.granular.map(b => ({
        id: b.id,
        range: b.range,
        energyDb: b.energyDb,
        target: b.target,
        deviation: b.deviation,
        status: b.status
      }))
    }),
    
    ...(coreMetrics.spectralBands?.suggestions && {
      suggestions: FORCE_TYPE_FIELD(coreMetrics.spectralBands.suggestions)
    }),
    
    // ADICIONAR: Engine version para debug
    engineVersion: coreMetrics.spectralBands?.algorithm || 'legacy',
    
    // ... (resto do código existente)
  };
  
  return finalJSON;
}
```

**Validação**:
```javascript
// Test: verificar campos aditivos
const payload = buildFinalJSON(mockCoreMetrics, ...);
if (process.env.ANALYZER_ENGINE === 'granular_v1') {
  assert(payload.granular);
  assert(payload.suggestions);
  assert(payload.engineVersion === 'granular_v1');
}
```

**Impacto**: Baixo (campos aditivos)  
**Risco**: Nenhum (front ignora campos desconhecidos)  
**Roll-back**: Remover bloco `...(coreMetrics.spectralBands?.granular && ...)`

---

### ✅ **ETAPA 5: Testes de Regressão** (2-3h)

**Objetivo**: Garantir que métricas LUFS/TP/DR/LRA/Correlação não mudaram.

**Arquivos**:
- **CRIAR**: `test/regression-granular.test.js`
- **USAR**: 3-5 tracks Techno (samples existentes)

**Estrutura do teste**:

```javascript
import { processAudioComplete } from '../work/api/audio/pipeline-complete.js';
import assert from 'assert';
import fs from 'fs';

const TEST_FILES = [
  'test/samples/techno-club-001.wav',
  'test/samples/techno-festival-002.wav',
  'test/samples/techno-bright-003.wav'
];

async function runRegressionTests() {
  console.log('🧪 Iniciando testes de regressão granular_v1 vs legacy');
  
  for (const filePath of TEST_FILES) {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = filePath.split('/').pop();
    
    // Test 1: Legacy
    process.env.ANALYZER_ENGINE = 'legacy';
    const legacyResult = await processAudioComplete(fileBuffer, fileName, null);
    
    // Test 2: Granular V1
    process.env.ANALYZER_ENGINE = 'granular_v1';
    const granularResult = await processAudioComplete(fileBuffer, fileName, {
      genre: 'techno'
    });
    
    // Verificar métricas críticas (tolerância 0.1%)
    const tolerance = 0.001;
    
    assert(
      Math.abs(granularResult.technicalData.lufsIntegrated - legacyResult.technicalData.lufsIntegrated) < tolerance,
      `LUFS Integrated mismatch: ${granularResult.technicalData.lufsIntegrated} vs ${legacyResult.technicalData.lufsIntegrated}`
    );
    
    assert(
      Math.abs(granularResult.technicalData.truePeakDbtp - legacyResult.technicalData.truePeakDbtp) < tolerance,
      `True Peak mismatch`
    );
    
    assert(
      Math.abs(granularResult.technicalData.dynamicRange - legacyResult.technicalData.dynamicRange) < tolerance,
      `DR mismatch`
    );
    
    assert(
      Math.abs(granularResult.technicalData.lra - legacyResult.technicalData.lra) < tolerance,
      `LRA mismatch`
    );
    
    assert(
      Math.abs(granularResult.technicalData.stereoCorrelation - legacyResult.technicalData.stereoCorrelation) < tolerance,
      `Stereo Correlation mismatch`
    );
    
    // Verificar campos aditivos (granular_v1)
    assert(granularResult.granular, 'Missing granular field');
    assert(granularResult.suggestions, 'Missing suggestions field');
    assert(granularResult.engineVersion === 'granular_v1', 'Wrong engine version');
    
    // Verificar compatibilidade de bandas (7 grupos devem existir em ambos)
    const legacyBands = Object.keys(legacyResult.bands);
    const granularBands = Object.keys(granularResult.bands);
    assert.deepStrictEqual(legacyBands.sort(), granularBands.sort(), 'Band keys mismatch');
    
    console.log(`✅ ${fileName}: Regressão OK`);
  }
  
  console.log('✅ Todos os testes de regressão passaram');
}

runRegressionTests().catch(err => {
  console.error('❌ Teste de regressão falhou:', err);
  process.exit(1);
});
```

**Execução**:
```bash
node test/regression-granular.test.js
```

**Critérios de aceitação**:
- Tolerância ≤ 0.1% para LUFS/TP/DR/LRA/Correlação
- Campos `granular` e `suggestions` presentes em granular_v1
- Campos legacy (7 bandas) idênticos em estrutura

**Impacto**: ZERO (apenas testes)  
**Risco**: Nenhum  
**Roll-back**: N/A

---

### ✅ **ETAPA 6: Testes de Contrato (API)** (1-2h)

**Objetivo**: Verificar que payload do granular_v1 não quebra front.

**Arquivos**:
- **CRIAR**: `test/contract-granular.test.js`

**Estrutura**:

```javascript
import assert from 'assert';

// Mock de payload granular_v1
const granularPayload = {
  engineVersion: 'granular_v1',
  bands: {
    sub: { status: 'yellow', score: 1.0 },
    bass: { status: 'green', score: 0.0 },
    // ... (7 bandas)
  },
  granular: [
    { id: 'sub_low', range: [20, 40], energyDb: -28.3, deviation: 0.2, status: 'ideal' }
  ],
  suggestions: [
    { freq_range: [50, 70], type: 'boost', amount: 2.5, message: '...', metric: 'frequency_balance' }
  ],
  technicalData: {
    lufsIntegrated: -10.2,
    truePeakDbtp: -1.3
  },
  score: 74,
  classification: 'Bom'
};

// Test 1: Campos legacy presentes
assert(granularPayload.bands);
assert(granularPayload.bands.sub);
assert(granularPayload.technicalData);
assert(granularPayload.score);

// Test 2: Campos aditivos presentes
assert(granularPayload.granular);
assert(granularPayload.suggestions);
assert(granularPayload.engineVersion === 'granular_v1');

// Test 3: Estrutura de sugestões
for (const suggestion of granularPayload.suggestions) {
  assert(suggestion.freq_range);
  assert(suggestion.type);
  assert(suggestion.amount);
  assert(suggestion.message);
  assert(suggestion.metric);
}

// Test 4: Front ignora campos desconhecidos (simular)
const frontCompatibleFields = [
  'bands',
  'technicalData',
  'score',
  'classification',
  'suggestions' // Novo, mas front pode processar opcionalmente
];

for (const field of frontCompatibleFields) {
  assert(granularPayload[field], `Missing expected field: ${field}`);
}

console.log('✅ Contrato granular_v1 válido e compatível');
```

**Execução**:
```bash
node test/contract-granular.test.js
```

**Impacto**: ZERO (apenas testes)  
**Risco**: Nenhum  
**Roll-back**: N/A

---

### ✅ **ETAPA 7: Documentação** (1h)

**Objetivo**: Documentar schema, feature flag e formato de payload.

**Arquivos**:
- **CRIAR**: `references/README.md`
- **CRIAR**: `docs/GRANULAR_V1.md`

**Conteúdo** (`references/README.md`):

```markdown
# 📚 Referências por Gênero — Granular V1

## Formato do Schema (v1)

Cada arquivo de referência contém:

- **schemaVersion**: Versão do formato (1)
- **genre**: Nome do gênero (ex: `techno`)
- **lufsNormalization**: Se deve normalizar para -23 LUFS antes da comparação
- **stepHz**: Passo de sub-bandas (20-30 Hz recomendado)
- **bands**: Array de sub-bandas com:
  - `id`: Identificador único (ex: `sub_low`)
  - `range`: [minHz, maxHz]
  - `target`: Energia alvo em dB (relativo ao RMS global)
  - `toleranceSigma`: Desvio padrão aceitável (σ)
- **grouping**: Mapeamento de sub-bandas → 7 grupos (compatibilidade front)
- **severity**: Pesos e thresholds para scoring
- **suggestions**: Configuração de mensagens (min/max dB, limite por grupo, idioma)

## Calibração

Valores `target` e `toleranceSigma` devem ser obtidos de dataset:
1. Analisar 20+ tracks profissionais do gênero
2. Calcular média e σ de energia por sub-banda
3. Ajustar manualmente para tolerância desejada

## Exemplo: Techno

Ver `techno.v1.json` para referência completa.
```

**Conteúdo** (`docs/GRANULAR_V1.md`):

```markdown
# 🌈 Granular V1: Sub-Bandas Espectrais Inteligentes

## Visão Geral

Sistema de análise espectral granular com:
- Sub-bandas configuráveis (step 20-30 Hz)
- Comparação com curva de referência por gênero (target ± σ)
- Score agregado (7 grupos para compatibilidade)
- Sugestões inteligentes (boost/cut + range + amount)

## Feature Flag

```bash
# .env
ANALYZER_ENGINE=legacy        # Default (7 bandas largas)
ANALYZER_ENGINE=granular_v1   # Ativa análise granular
```

## Payload Estrutura

### Campos Legacy (mantidos)
```json
{
  "bands": { ... },           // 7 bandas (sub/bass/low_mid/mid/high_mid/presence/air)
  "technicalData": { ... },   // LUFS, TP, DR, LRA, Correlação
  "score": 74,
  "classification": "Bom"
}
```

### Campos Aditivos (granular_v1)
```json
{
  "engineVersion": "granular_v1",
  "granular": [
    { "id": "sub_low", "range": [20, 40], "energyDb": -28.3, "deviation": 0.2, "status": "ideal" }
  ],
  "suggestions": [
    { "freq_range": [50, 70], "type": "boost", "amount": 2.5, "message": "...", "metric": "frequency_balance" }
  ]
}
```

## Migração

1. **Fase 1**: Rodar lado a lado (legacy e granular_v1) com mesmas tracks
2. **Fase 2**: Validar métricas críticas (LUFS/TP/DR/LRA) inalteradas
3. **Fase 3**: Ativar granular_v1 em produção com feature flag
4. **Fase 4**: Deprecar legacy após validação completa

## Roll-Back Plan

Em caso de problemas:
1. Setar `ANALYZER_ENGINE=legacy` em `.env`
2. Restart workers
3. Payload volta ao formato original (sem campos `granular` e `suggestions`)
```

**Impacto**: ZERO (apenas docs)  
**Risco**: Nenhum  
**Roll-back**: N/A

---

## 📊 MATRIZ DE TESTES

| Tipo | Cobertura | Ferramentas | Critérios de Aceitação |
|------|-----------|-------------|------------------------|
| **Unit** | Funções isoladas (status, adjustment amount, message builder) | `spectral-bands-granular.test.js` | Todos os casos passam |
| **Integration** | Pipeline completo (decode → granular → json) | `regression-granular.test.js` | Métricas inalteradas (tolerância 0.1%) |
| **Contract** | Payload API | `contract-granular.test.js` | Campos legacy + aditivos presentes |
| **Regressão A/B** | Legacy vs Granular V1 (mesma track) | Manual (3-5 tracks Techno) | Bandas largas coerentes, score ± 5 pontos |
| **Performance** | Latência FFT reuse | Benchmark (tempo de processamento) | ↑ ≤ 15% vs legacy |

---

## 🚀 DATASETS SUGERIDOS

### Validação Inicial (3-5 tracks)
- **Club Techno**: Deep, punch nos graves (60-120 Hz)
- **Festival Techno**: Brilho, presença alta (5-10 kHz)
- **Dark Techno**: Sub-bass dominante (20-60 Hz)
- **Outlier Bright**: Agudos excessivos (simular erro)
- **Outlier Boomy**: Graves excessivos (simular erro)

### Calibração Futura (20+ tracks)
- Analisar com legacy + granular_v1
- Extrair média e σ por sub-banda
- Gerar `techno.v1.json` com targets calibrados

---

## ⚠️ PONTOS DE ATENÇÃO

1. **FFT Reuse Crítico**: Não recalcular FFT (usar `framesFFT.frames[i].leftFFT.magnitude` direto)
2. **Normalização Global**: Aplicada em `core-metrics.js` antes de chegar em spectral-bands (não refazer)
3. **Agregação Multi-Frame**: Usar **mediana** (não média) para robustez contra outliers
4. **Threshold de Relevância**: Filtrar sugestões com `|deviation| < 1.0 dB` para evitar ruído
5. **i18n**: Armazenar mensagens em schema (campo `language`) para fácil tradução

---

## 📈 MÉTRICAS DE ACEITAÇÃO

| Métrica | Valor Esperado | Método de Medição |
|---------|---------------|-------------------|
| **LUFS/TP/DR/LRA** | Idêntico ao legacy (tolerância 0.1%) | Testes de regressão |
| **Latência** | ↑ ≤ 15% vs legacy | Benchmark (tempo de processamento) |
| **Payload Size** | ↑ ≤ 30% vs legacy | `JSON.stringify(payload).length` |
| **Score Coerência** | ± 5 pontos vs legacy | Comparação A/B manual |
| **Sugestões Válidas** | ≥ 80% acionáveis (leigos entendem) | Teste com usuários |

---

## 🔄 ROLL-BACK PLAN

### Cenário 1: CPU ↑ > 20%
**Ação**: Setar `ANALYZER_ENGINE=legacy` e investigar gargalo (provavelmente FFT reprocess)

### Cenário 2: Payload incompatível
**Ação**: Remover campos `granular` e `suggestions` de `json-output.js`, restart workers

### Cenário 3: Métricas divergentes
**Ação**: Verificar se normalização foi aplicada 2x (debug `core-metrics.js`)

### Cenário 4: Tudo sai "ideal"
**Ação**: Reduzir `toleranceSigma` no schema (ex: 1.5 → 1.0) e reprocessar

---

**FIM DO PLANO**

> **Próximos passos**: Executar etapas 1-7 em ordem. Validar cada etapa antes de prosseguir.
