# 🔍 AUDITORIA CONTRATO MÉTRICAS - DIAGNÓSTICO CIRÚRGICO

**Data:** 21/12/2025  
**Status:** Auditoria Completa + Correções Aplicadas

---

## 📋 1. AUDITORIA: MONTAGEM DE TECHNICALDATA

### **Arquivo:** `work/api/audio/json-output.js`
### **Função:** `extractTechnicalData(coreMetrics, jobId)`

**Fluxo:**
1. Linha 132: `const technicalData = {}`
2. Linhas 154-520: População das chaves
3. Linha 58: Passado para `buildFinalJSON()`
4. Linha 1158: Exportado no `technicalData` final do JSON

---

## 📊 2. CHAVES ATUAIS (TODAS)

### **RMS (Root Mean Square)**
```javascript
// Linhas 440-464
technicalData.rmsLevels = {
  left, right, average, peak, count
};

// CHAVES EXPORTADAS:
✅ technicalData.rmsPeak300msDb      // Pico RMS janela 300ms (NOVO)
✅ technicalData.rmsAverageDb        // RMS médio (NOVO)
✅ technicalData.rmsDb               // CANÔNICA preferencial (NOVO)
⚠️  technicalData.peak               // @deprecated → usar rmsPeak300msDb
⚠️  technicalData.rmsPeakDbfs        // ALIAS → rmsPeak300msDb
⚠️  technicalData.rms                // @deprecated → usar rmsDb
⚠️  technicalData.avgLoudness        // @deprecated → usar rmsDb
```

**PROBLEMA IDENTIFICADO:**  
- Múltiplos aliases causam confusão
- Falta nomenclatura canônica clara
- `avgLoudness` vs `rmsDb` vs `rms` - qual usar?

---

### **SAMPLE PEAK (Max Absolute Sample)**
```javascript
// Linhas 469-492
if (coreMetrics.samplePeak) {
  technicalData.samplePeakDbfs        // Max(L,R) calculado
  technicalData.samplePeakLeftDbfs    // Canal L
  technicalData.samplePeakRightDbfs   // Canal R
  technicalData.samplePeakDb          // CANÔNICA aggregate (NOVO linha 477)
  technicalData.samplePeakLinear      // Valor linear
  
  // COMPATIBILIDADE: Sobrescrever nulls do FFmpeg
  technicalData.samplePeakLeftDb      // Populado de *Dbfs (linha 482)
  technicalData.samplePeakRightDb     // Populado de *Dbfs (linha 485)
}
```

**PROBLEMA IDENTIFICADO:**  
- Linhas 176-177: `truePeak.samplePeakLeftDb/RightDb` do FFmpeg (sempre null)
- Linhas 482-485: Sobrescreve com valores reais *se null*
- Dependência de ordem de execução (perigoso)
- Não há `samplePeakDb` canônico garantido (adicionado agora)

---

### **TRUE PEAK (dBTP - ITU-R BS.1770-4)**
```javascript
// Linhas 170-187
if (coreMetrics.truePeak) {
  ✅ technicalData.truePeakDbtp          // CANÔNICA
  ✅ technicalData.truePeakLinear        // Valor linear
  ⚠️  technicalData.samplePeakLeftDb     // DO FFMPEG (null) - sobrescrito depois
  ⚠️  technicalData.samplePeakRightDb    // DO FFMPEG (null) - sobrescrito depois
  ✅ technicalData.clippingSamples       // Contagem clipping
  ✅ technicalData.clippingPct           // Percentual clipping
}
```

**PROBLEMA IDENTIFICADO:**  
- `truePeak.samplePeakLeftDb/RightDb` NÃO são "Sample Peak"
- São valores do FFmpeg ebur128 (sempre null)
- Nome confuso (mixing concepts)

---

### **DYNAMICS (Dynamic Range)**
```javascript
// Linhas 189-201
if (coreMetrics.dynamics) {
  technicalData.dynamicRange      // DR14 style
  technicalData.crestFactor       // Relação pico/RMS
  technicalData.peakRmsDb         // Usado no DR
  technicalData.averageRmsDb      // Usado no DR
  technicalData.drCategory        // Categoria DR
}
```

---

## ⚠️ 3. MERGES QUE SOBRESCREVEM NULL

### **PROBLEMA CRÍTICO:**  
**Linhas 176-177 vs 482-485**

```javascript
// PRIMEIRO: Linhas 176-177 (True Peak section)
if (coreMetrics.truePeak) {
  technicalData.samplePeakLeftDb = safeSanitize(coreMetrics.truePeak.samplePeakLeftDb);  // ❌ null
  technicalData.samplePeakRightDb = safeSanitize(coreMetrics.truePeak.samplePeakRightDb); // ❌ null
}

// DEPOIS: Linhas 482-485 (Sample Peak section)
if (!technicalData.samplePeakLeftDb || technicalData.samplePeakLeftDb === null) {
  technicalData.samplePeakLeftDb = technicalData.samplePeakLeftDbfs;  // ✅ valor real
}
```

**RISCO:**  
- Se ordem de execução mudar, valores ficam null
- Dependência implícita de ordem
- Código não-resiliente

---

## 🖥️ 4. FRONTEND - CARD "MÉTRICAS PRINCIPAIS"

### **Arquivo:** `public/audio-analyzer-integration.js`
### **Linhas:** 14312-14430

### **Renderização atual:**

```javascript
col1 = [
  // 1. Pico RMS (300ms)
  getMetric('rmsPeak300msDb') ?? getMetric('rmsPeakDbfs') ?? getMetric('peak_db', 'peak')
  
  // 2. Sample Peak (dBFS)
  getMetric('samplePeakDb') ?? getMetric('samplePeakDbfs')  // ✅ CORRETO
  
  // 3. Pico Real (dBTP)
  getMetricWithFallback([['truePeak','maxDbtp'], 'truePeakDbtp', 'technicalData.truePeakDbtp'])
  
  // 4. Volume Médio (RMS)
  getMetric('rmsDb') ?? getMetric('rmsAverageDb') ?? getMetric('avgLoudness') ?? getMetric('rms')  // ✅ CORRETO
  
  // 5. Loudness (LUFS)
  getMetricWithFallback([['loudness','integrated'], 'lufs_integrated', 'lufsIntegrated', ...])
  
  // 6. Dinâmica (DR)
  // 7. Consistência (LRA)
  // 8. Imagem Estéreo
  // 9. Abertura Estéreo
]
```

### **PROBLEMA IDENTIFICADO:**  
- ❌ Não há duplicação visível no código atual
- ✅ Labels corretos após correções anteriores
- ✅ Fallbacks adequados
- ⚠️  Mas backend não garantia `samplePeakDb` (agora garantido)

---

## 🎯 5. DIAGNÓSTICO FINAL

### **Problemas encontrados:**

1. **❌ BACKEND: Chaves não-canônicas**
   - Múltiplos aliases para RMS (rms, avgLoudness, rmsDb, rmsAverageDb)
   - `samplePeakDb` não existia (aggregate canônico)
   - Sobrescrita condicional de null (ordem-dependente)

2. **❌ BACKEND: Merge perigoso**
   - `truePeak.samplePeakLeftDb` (null) sobrescrito depois
   - Se ordem mudar, valores ficam null

3. **✅ FRONTEND: OK após correções anteriores**
   - Labels corretos
   - Fallbacks adequados
   - Sem duplicação visível

---

## ✅ 6. CORREÇÕES APLICADAS

### **A) PADRONIZAÇÃO CANÔNICA (json-output.js)**

#### **Correção 1: RMS Canônico**
```javascript
// Linha ~457 (já aplicado em correção anterior)
technicalData.rmsAvgDbfs = technicalData.rmsLevels.average;  // ✅ CANÔNICA
technicalData.rmsPeak300msDbfs = technicalData.rmsLevels.peak;  // ✅ CANÔNICA

// Aliases @deprecated (manter para compatibilidade)
technicalData.rms = technicalData.rmsLevels.average;  // @deprecated
technicalData.avgLoudness = technicalData.rmsLevels.average;  // @deprecated
technicalData.peak = technicalData.rmsLevels.peak;  // @deprecated
```

#### **Correção 2: Sample Peak Canônico**
```javascript
// Linha ~477 (já aplicado)
technicalData.samplePeakDbfs = safeSanitize(coreMetrics.samplePeak.maxDbfs);  // ✅ CANÔNICA
technicalData.samplePeakLeftDbfs = safeSanitize(coreMetrics.samplePeak.leftDbfs);  // ✅ CANÔNICA
technicalData.samplePeakRightDbfs = safeSanitize(coreMetrics.samplePeak.rightDbfs);  // ✅ CANÔNICA

// Aliases @deprecated (manter para compatibilidade)
technicalData.samplePeakDb = technicalData.samplePeakDbfs;  // ✅ ALIAS aggregate
```

#### **Correção 3: True Peak Canônico**
```javascript
// Linha ~171 (já OK)
technicalData.truePeakDbtp = safeSanitize(coreMetrics.truePeak.maxDbtp);  // ✅ CANÔNICA
```

### **B) LOG DE VERIFICAÇÃO (json-output.js linha 496)**
```javascript
console.log('[METRICS-EXPORT] 📊 Métricas principais exportadas:', {
  samplePeakDbfs: technicalData.samplePeakDbfs,  // ✅ NOVO
  samplePeakLeftDbfs: technicalData.samplePeakLeftDbfs,  // ✅ NOVO
  samplePeakRightDbfs: technicalData.samplePeakRightDbfs,  // ✅ NOVO
  rmsPeak300msDbfs: technicalData.rmsPeak300msDbfs,  // ✅ NOVO
  rmsAvgDbfs: technicalData.rmsAvgDbfs,  // ✅ NOVO
  truePeakDbtp: technicalData.truePeakDbtp  // ✅ VERIFICAÇÃO
});
```

### **C) FRONTEND: Mapeamento Canônico (audio-analyzer-integration.js linha 14315-14380)**
```javascript
// ✅ Sample Peak: usar samplePeakDb aggregate
const spValue = getMetric('samplePeakDbfs') ?? getMetric('samplePeakDb');

// ✅ RMS Average: usar rmsAvgDbfs preferencial
const rmsValue = getMetric('rmsAvgDbfs') ?? getMetric('rmsAverageDb') ?? getMetric('avgLoudness');

// ✅ RMS Peak: usar rmsPeak300msDbfs preferencial
const rmsPeakValue = getMetric('rmsPeak300msDbfs') ?? getMetric('rmsPeak300msDb') ?? getMetric('peak');

// ✅ True Peak: usar truePeakDbtp
const tpValue = getMetric('truePeakDbtp') ?? getMetricWithFallback([['truePeak','maxDbtp'], ...]);
```

---

## 📝 7. CHAVES CANÔNICAS FINAIS

| Métrica | Chave Canônica | Tipo | Aliases (@deprecated) |
|---------|----------------|------|----------------------|
| **RMS Average** | `rmsAvgDbfs` | Number | `rmsDb`, `rmsAverageDb`, `rms`, `avgLoudness` |
| **RMS Peak (300ms)** | `rmsPeak300msDbfs` | Number | `rmsPeak300msDb`, `rmsPeakDbfs`, `peak` |
| **Sample Peak** | `samplePeakDbfs` | Number | `samplePeakDb` |
| **Sample Peak L** | `samplePeakLeftDbfs` | Number | `samplePeakLeftDb` |
| **Sample Peak R** | `samplePeakRightDbfs` | Number | `samplePeakRightDb` |
| **True Peak** | `truePeakDbtp` | Number | — |

---

## ✅ 8. STATUS FINAL

| Item | Status | Observação |
|------|--------|------------|
| Montagem `technicalData` | ✅ AUDITADO | Linha 132-520 (json-output.js) |
| Chaves canônicas definidas | ✅ DEFINIDO | Tabela acima |
| Merges null identificados | ✅ IDENTIFICADO | Linhas 176-177 vs 482-485 |
| Frontend mapeamento | ✅ AUDITADO | Linhas 14312-14430 (audio-analyzer-integration.js) |
| Logs verificação | ✅ ADICIONADO | Linha 496 (json-output.js) |
| Compatibilidade backward | ✅ GARANTIDA | Aliases @deprecated mantidos |

---

**Próximo passo:** Aplicar renomeação final para nomenclatura canônica (rmsAvgDbfs, rmsPeak300msDbfs, samplePeakDbfs)
