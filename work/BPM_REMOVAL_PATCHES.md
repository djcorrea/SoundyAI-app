# 🔧 PATCHES COMPLETOS - REMOÇÃO DE BPM

**Data**: 23 de outubro de 2025  
**Branch**: `perf/remove-bpm`

Patches prontos para aplicar via copy-paste ou ferramentas de patch.

---

## 📝 PATCH 1: `work/api/audio/core-metrics.js`

### Modificação 1: Linha 249-256 (Seção de Cálculo BPM)

**ANTES**:
```javascript
      // ========= CÁLCULO DE BPM =========
      let bpmMetrics = { bpm: null, bpmConfidence: null }; // ✅ CORREÇÃO: bmpMetrics → bpmMetrics
      try {
        bpmMetrics = this.calculateBpmMetrics(normalizedLeft, normalizedRight, { jobId });
        console.log('[SUCCESS] BPM calculado via método da classe');
      } catch (error) {
        console.log('[SKIP_METRIC] BPM: erro no método da classe -', error.message);
        bpmMetrics = { bpm: null, bpmConfidence: null, bpmSource: 'ERROR' }; // ✅ CORREÇÃO: incluir bpmSource
      }
```

**DEPOIS**:
```javascript
      // ========= BPM REMOVED - performance optimization =========
      // BPM calculation was the #1 bottleneck (30% of total time).
      // Removed to improve processing speed from ~150s to ~104s.
      // See BPM_REMOVAL_AUDIT.md for complete details.
      const bpmMetrics = { 
        bpm: null, 
        bpmConfidence: null, 
        bpmSource: 'DISABLED' 
      };
```

---

### Modificação 2: Linha 280-282 (Propriedades no Objeto Final)

**ANTES**:
```javascript
        bpm: bpmMetrics.bpm, // ✅ NOVO: Beats Per Minute
        bpmConfidence: bpmMetrics.bpmConfidence, // ✅ CORREÇÃO: BPM Confidence (corrigido bmpConfidence → bpmConfidence)
        bpmSource: bpmMetrics.bpmSource, // ✅ NOVO: Fonte do cálculo BPM (NORMAL, FALLBACK_STRICT, etc)
```

**DEPOIS**:
```javascript
        bpm: null, // BPM REMOVED - performance optimization (30% gain)
        bpmConfidence: null, // BPM REMOVED - performance optimization  
        bpmSource: 'DISABLED', // BPM REMOVED - performance optimization
```

---

### Modificação 3: Linha 1315-1770 (Remover 6 Métodos Completos)

**REMOVER COMPLETAMENTE** os seguintes métodos (455 linhas):

#### Método 1: `calculateBpmMetrics()` (linha 1315-1410)
**Remover desde**:
```javascript
  calculateBpmMetrics(leftChannel, rightChannel, options = {}) {
```
**Até** (linha 1410):
```javascript
  }
```

---

#### Método 2: `calculateMusicTempoBpm()` (linha 1413-1435)
**Remover desde**:
```javascript
  calculateMusicTempoBpm(signal, sampleRate, minBpm, maxBpm) {
```
**Até** (linha 1435):
```javascript
  }
```

---

#### Método 3: `calculateAdvancedOnsetBpm()` (linha 1437-1487)
**Remover desde**:
```javascript
  calculateAdvancedOnsetBpm(signal, sampleRate, minBpm, maxBpm) {
```
**Até** (linha 1487):
```javascript
  }
```

---

#### Método 4: `calculateAutocorrelationBpm()` (linha 1490-1563)
**Remover desde**:
```javascript
  calculateAutocorrelationBpm(signal, sampleRate, minBpm, maxBpm) {
```
**Até** (linha 1563):
```javascript
  }
```

---

#### Método 5: `calculateBpmFromOnsets()` (linha 1582-1625)
**Remover desde**:
```javascript
  calculateBpmFromOnsets(onsets, minBpm, maxBpm, sampleRate) {
```
**Até** (linha 1625):
```javascript
  }
```

---

#### Método 6: `crossValidateBpmResults()` (linha 1628-1770)
**Remover desde**:
```javascript
  crossValidateBpmResults(method1, method2) {
```
**Até** (linha 1770):
```javascript
  }
```

**Total removido**: ~455 linhas

---

## 📝 PATCH 2: `work/lib/audio/features/context-detector.js`

### Modificação 1: Linha 40-56 (Função `autocorrelateTempo()`)

**ANTES**:
```javascript
function autocorrelateTempo(x, time) {
  if (!x || x.length < 100 || !time || time.length !== x.length) return null;
  const dt = time.length > 1 ? (time[1] - time[0]) : 0.01;
  const minBPM=60, maxBPM=200;
  const results=[];
  for(let bpm=minBPM; bpm<=maxBPM; bpm+=0.5){
    const periodSec = 60/bpm; const lag = Math.round(periodSec/dt); if(lag<=1 || lag>=x.length-1) continue;
    let sum=0, sumSq=0, corr=0;
    for(let i=0; i<x.length-lag; i++){ const a=x[i], b=x[i+lag]; sum+=a; sumSq+=a*a; corr+=a*b; }
    const n=x.length-lag; const mean=sum/n; const variance=Math.max(1e-9, sumSq/n - mean*mean);
    const r = (corr/n - mean*mean) / variance;
    results.push({ bpm, r });
  }
  if (!results.length) return null;
  results.sort((a,b)=>b.r-a.r); const best=results[0];
  const avg=results.slice(0,10).reduce((s,x)=>s+x.r,0)/Math.min(10, results.length);
  const conf = Math.min(0.99, Math.max(0, (best.r / (avg+0.01))*0.5));
  return { bpm: best.bpm, confidence: +conf.toFixed(3), bestR: best.r };
}
```

**DEPOIS**:
```javascript
function autocorrelateTempo(x, time) {
  // BPM REMOVED - performance optimization (30% gain)
  // This function previously calculated BPM via autocorrelation.
  // Now returns null to maintain API compatibility.
  // See BPM_REMOVAL_AUDIT.md for details.
  return { bpm: null, confidence: null, bestR: null };
}
```

---

### Modificação 2: Linha 124-133 (Uso da Função)

**ANTES**:
```javascript
    if(audioBuffer.duration < 2) return { bpm:null, bpmConfidence:null, key:null, keyConfidence:null, arrangementDensity:{ onsetRate:null, windowRmsMean:null }, _skipped:true };
    const env = [...Array(nFrames)].map((_,i) => { const start=i*hop, end=Math.min(start+fftSize, lm); let sum=0; for(let j=start; j<end; j++){ sum += Math.abs(left[j]); } return sum/(end-start); });
    const time = [...Array(nFrames)].map((_,i) => (i * hop) / sampleRate);
    const tempoRes = autocorrelateTempo(env, time) || { bpm:null, confidence:null };
    // ... key detection ...
    return {
      bpm: tempoRes.bpm ? +tempoRes.bpm.toFixed(2) : null,
      bpmConfidence: tempoRes.confidence,
      key: keyRes.key,
      keyConfidence: keyRes.confidence,
      arrangementDensity: { onsetRate: +onsetRate.toFixed(3), windowRmsMean: +winRMS.toFixed(4) }
    };
```

**DEPOIS**:
```javascript
    if(audioBuffer.duration < 2) return { bpm:null, bpmConfidence:null, key:null, keyConfidence:null, arrangementDensity:{ onsetRate:null, windowRmsMean:null }, _skipped:true };
    const env = [...Array(nFrames)].map((_,i) => { const start=i*hop, end=Math.min(start+fftSize, lm); let sum=0; for(let j=start; j<end; j++){ sum += Math.abs(left[j]); } return sum/(end-start); });
    const time = [...Array(nFrames)].map((_,i) => (i * hop) / sampleRate);
    
    // BPM REMOVED - performance optimization
    // const tempoRes = autocorrelateTempo(env, time) || { bpm:null, confidence:null };
    
    // ... key detection ...
    return {
      bpm: null, // BPM REMOVED - performance optimization
      bpmConfidence: null, // BPM REMOVED - performance optimization
      key: keyRes.key,
      keyConfidence: keyRes.confidence,
      arrangementDensity: { onsetRate: +onsetRate.toFixed(3), windowRmsMean: +winRMS.toFixed(4) }
    };
```

---

## 📝 PATCH 3: `work/lib/audio/features/reference-matcher.js`

### Modificação 1: Linha 36-39 (Distância BPM)

**ANTES**:
```javascript
  if (Number.isFinite(sample.bpm) && Number.isFinite(ref.bpm)) {
    const diff = Math.abs(sample.bpm - ref.bpm);
    d += weights.bpm * Math.min(1, diff / 20); wSum += weights.bpm;
  }
```

**DEPOIS**:
```javascript
  // BPM REMOVED - performance optimization
  // BPM distance calculation disabled as BPM is always null
  // if (Number.isFinite(sample.bpm) && Number.isFinite(ref.bpm)) {
  //   const diff = Math.abs(sample.bpm - ref.bpm);
  //   d += weights.bpm * Math.min(1, diff / 20); wSum += weights.bpm;
  // }
```

---

### Modificação 2: Linha 75 (Peso de BPM)

**ANTES**:
```javascript
    const weights = { bpm: 2, density: 1.2, fingerprint: 3, subgenre: 0.8 };
```

**DEPOIS**:
```javascript
    const weights = { 
      bpm: 0, // BPM REMOVED - no longer used in distance calculation
      density: 1.2, 
      fingerprint: 3, 
      subgenre: 0.8 
    };
```

---

## 📝 PATCH 4: `work/tools/perf/verify-parity.js`

### Modificação 1: Linha 37 (Tolerância)

**ANTES**:
```javascript
  // BPM
  bpm: 0.5,                    // ±0.5 BPM
```

**DEPOIS**:
```javascript
  // BPM REMOVED - no longer validated
  // bpm: 0.5,                 // ±0.5 BPM (DISABLED)
```

---

### Modificação 2: Linha 176-181 (Validação)

**ANTES**:
```javascript
  // BPM
  validateMetric(
    'BPM',
    baseline.bpm,
    optimized.bpm,
    TOLERANCES.bpm
  );
```

**DEPOIS**:
```javascript
  // BPM REMOVED - no longer validated
  // validateMetric(
  //   'BPM',
  //   baseline.bpm,
  //   optimized.bpm,
  //   TOLERANCES.bpm
  // );
```

---

## 📝 PATCH 5: `work/tools/perf/INSTRUMENTATION_EXAMPLE.js`

### Modificação: Linha 98 (Nota de Deprecação)

**ANTES**:
```javascript
/**
 * EXEMPLO: INSTRUMENTAR BPM COM MÉTODOS SEPARADOS
 * 
 * Este exemplo mostra como instrumentar o cálculo de BPM com medições
 * detalhadas para cada método (onset detection, autocorrelação, cross-validation).
 */
```

**DEPOIS**:
```javascript
/**
 * ⚠️ DEPRECATED: BPM calculation removed for performance optimization
 * 
 * BPM was the #1 bottleneck consuming 30% of processing time.
 * This example is kept for historical reference only.
 * 
 * See BPM_REMOVAL_AUDIT.md for complete details.
 * Branch: perf/remove-bpm
 * Date: 2025-10-23
 * 
 * EXEMPLO: INSTRUMENTAR BPM COM MÉTODOS SEPARADOS (NÃO MAIS USADO)
 * 
 * Este exemplo mostra como instrumentar o cálculo de BPM com medições
 * detalhadas para cada método (onset detection, autocorrelação, cross-validation).
 */
```

---

## ✅ APLICAÇÃO RÁPIDA VIA GIT PATCH

Se preferir aplicar via git patch format:

### Criar arquivo de patch
```powershell
# Copiar cada patch acima para arquivos separados:
# patch1-core-metrics.patch
# patch2-context-detector.patch
# patch3-reference-matcher.patch
# patch4-verify-parity.patch
# patch5-instrumentation-example.patch
```

### Aplicar patches
```powershell
git apply patch1-core-metrics.patch
git apply patch2-context-detector.patch
git apply patch3-reference-matcher.patch
git apply patch4-verify-parity.patch
git apply patch5-instrumentation-example.patch
```

---

## 📋 CHECKLIST DE APLICAÇÃO

Após aplicar cada patch, marque:

- [ ] **Patch 1**: `core-metrics.js` modificado
  - [ ] Seção BPM substituída (linha 249-256)
  - [ ] Propriedades ajustadas (linha 280-282)
  - [ ] 6 métodos removidos (linha 1315-1770)
  
- [ ] **Patch 2**: `context-detector.js` modificado
  - [ ] Função `autocorrelateTempo()` simplificada
  - [ ] Retorno ajustado para `bpm: null`
  
- [ ] **Patch 3**: `reference-matcher.js` modificado
  - [ ] Distância BPM comentada
  - [ ] Peso BPM ajustado para 0
  
- [ ] **Patch 4**: `verify-parity.js` modificado
  - [ ] Tolerância BPM comentada
  - [ ] Validação BPM comentada
  
- [ ] **Patch 5**: `INSTRUMENTATION_EXAMPLE.js` modificado
  - [ ] Nota de deprecação adicionada

---

## ✅ VALIDAÇÃO FINAL

Após aplicar todos os patches:

```powershell
# Validar sintaxe
node --check api/audio/core-metrics.js
node --check lib/audio/features/context-detector.js
node --check lib/audio/features/reference-matcher.js
node --check tools/perf/verify-parity.js

# Testar execução
node api/audio/pipeline-complete.js
```

---

**Patches completos por**: GitHub Copilot  
**Data**: 23 de outubro de 2025  
**Branch**: `perf/remove-bpm`
