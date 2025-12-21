# 🎯 AUDITORIA COMPLETA: Métricas Principais - Correção Final

**Data:** 21/12/2025  
**Objetivo:** Deixar o CORE das métricas 100% consistente e market-ready (sem quebrar nada)

---

## 📊 A) AUDITORIA TÉCNICA

### 1️⃣ **Onde o Sample Peak é calculado**

**Arquivo:** `work/api/audio/core-metrics.js`  
**Função:** `calculateSamplePeakDbfs(leftChannel, rightChannel)` (linhas 27-83)  
**Localização da chamada:** Linha 159

```javascript
samplePeakMetrics = calculateSamplePeakDbfs(leftChannel, rightChannel);
```

**Retorna:**
```javascript
{
  left: peakLeftLinear,
  right: peakRightLinear,
  max: peakMaxLinear,
  leftDbfs: peakLeftDbfs,    // ✅ Canal esquerdo em dBFS
  rightDbfs: peakRightDbfs,  // ✅ Canal direito em dBFS
  maxDbfs: peakMaxDbfs       // ✅ Max(L,R) em dBFS
}
```

**Estado:** ✅ **FUNCIONAL** - Cálculo correto do max absolute sample por canal

---

### 2️⃣ **Onde technicalData é montado**

**Arquivo:** `work/api/audio/json-output.js`  
**Função:** `extractTechnicalData(coreMetrics, basicMetrics)`  
**Seções relevantes:**

#### **Sample Peak** (linhas 467-489):
```javascript
if (coreMetrics.samplePeak) {
  technicalData.samplePeakDbfs = safeSanitize(coreMetrics.samplePeak.maxDbfs);
  technicalData.samplePeakLeftDbfs = safeSanitize(coreMetrics.samplePeak.leftDbfs);
  technicalData.samplePeakRightDbfs = safeSanitize(coreMetrics.samplePeak.rightDbfs);
  
  // 🔄 COMPATIBILIDADE: Popular chaves antigas com valores reais
  if (!technicalData.samplePeakLeftDb || technicalData.samplePeakLeftDb === null) {
    technicalData.samplePeakLeftDb = technicalData.samplePeakLeftDbfs;
  }
  if (!technicalData.samplePeakRightDb || technicalData.samplePeakRightDb === null) {
    technicalData.samplePeakRightDb = technicalData.samplePeakRightDbfs;
  }
}
```

**❌ PROBLEMA IDENTIFICADO:**  
- Não existe `technicalData.samplePeakDb` (aggregate key)
- Frontend está calculando `max(L,R)` manualmente (linha 14321-14340)
- Deveria exportar a chave **market-ready** `samplePeakDb` para simplificar frontend

#### **RMS Peak** (linhas 453-460):
```javascript
if (coreMetrics.rms && coreMetrics.rms.peak) {
  technicalData.rmsPeak300msDb = technicalData.rmsLevels.peak;
  technicalData.peak = technicalData.rmsLevels.peak;  // @deprecated
  technicalData.rmsPeakDbfs = technicalData.rmsLevels.peak; // alias
}
```

**✅ ESTADO:** Funcional, mas com múltiplos aliases (confuso)

#### **RMS Average** (linhas 454-460):
```javascript
technicalData.rmsAverageDb = technicalData.rmsLevels.average;
technicalData.rms = technicalData.rmsLevels.average;
technicalData.avgLoudness = technicalData.rmsLevels.average; // alias
```

**✅ ESTADO:** Funcional, mas com múltiplos aliases

#### **True Peak** (linhas 174-187):
```javascript
if (coreMetrics.truePeak) {
  technicalData.truePeakDbtp = safeSanitize(coreMetrics.truePeak.maxDbtp);
  technicalData.samplePeakLeftDb = safeSanitize(coreMetrics.truePeak.samplePeakLeftDb); // ❌ FFmpeg (null)
  technicalData.samplePeakRightDb = safeSanitize(coreMetrics.truePeak.samplePeakRightDb); // ❌ FFmpeg (null)
}
```

**❌ PROBLEMA:** As chaves `samplePeakLeftDb/RightDb` aqui vêm do FFmpeg ebur128 e são sempre null, sendo sobrescritas depois pela compatibilidade (linhas 474-479)

---

### 3️⃣ **JSON final e possíveis sobrescritas null**

**Origem do problema:**  
1. **Linhas 176-177** (json-output.js): Exportam `samplePeakLeftDb/RightDb` do FFmpeg (null)
2. **Linhas 474-479** (json-output.js): Sobrescrevem com valores reais *se forem null*
3. **Resultado:** As chaves ficam populadas, MAS é um fluxo indireto e confuso

**❌ PROBLEMA:**  
- Dependência de ordem de execução (sobrescrita condicional)
- Não existe `technicalData.samplePeakDb` (aggregate)
- Frontend precisa calcular `max(L,R)` manualmente

---

### 4️⃣ **Frontend - Card "Métricas Principais"**

**Arquivo:** `public/audio-analyzer-integration.js` (linhas 14300-14410)

#### **Pico RMS (300ms)** - Linha 14311-14320:
```javascript
const rmsPeakValue = getMetric('rmsPeak300msDb') ?? getMetric('rmsPeakDbfs') ?? getMetric('peak_db', 'peak');
return row('Pico RMS (300ms)', `${safeFixed(rmsPeakValue)} dB`, 'rmsPeak300msDb');
```
**✅ ESTADO:** Correto - Label e fallback adequados

#### **Sample Peak (dBFS)** - Linha 14321-14345:
```javascript
const leftDb = getMetric('samplePeakLeftDb') ?? getMetric('samplePeakLeftDbfs');
const rightDb = getMetric('samplePeakRightDb') ?? getMetric('samplePeakRightDbfs');
let spValue = (leftDb != null && rightDb != null) ? Math.max(leftDb, rightDb) : ...;
return row('Sample Peak (dBFS)', `${safeFixed(spValue, 1)} dBFS ...`, 'samplePeakDbfs');
```
**❌ PROBLEMA:** Frontend calculando `max(L,R)` - deveria buscar key direta `samplePeakDb`

#### **Volume Médio (RMS)** - Linha 14381-14406:
```javascript
const rmsValue = getMetricWithFallback([
  ['energy', 'rms'],
  'avgLoudness',
  'rms',
  'technicalData.avgLoudness',
  'technicalData.rms'
]);
return row('Volume Médio (RMS)', `${safeFixed(rmsValue, 1)} dBFS`, 'avgLoudness', 'rms');
```
**⚠️ CONFUSÃO:** Label correto, mas usa `avgLoudness` (alias legado)

#### **Labels (friendly-labels.js)** - Linhas 38-41:
```javascript
'Peak': 'Pico RMS (300ms)',
'peak': 'Pico RMS (300ms)',
'RMS': 'Volume Médio (energia)',
'rms': 'Volume Médio (energia)',
```
**❌ PROBLEMA:** Label "Volume Médio (energia)" está tecnicamente errado  
- RMS é energia média **ao quadrado** (power)
- Label deveria ser "Volume Médio (RMS)" ou apenas "RMS Average"

---

## 🔧 B) CORREÇÕES MÍNIMAS A APLICAR

### **Backend (json-output.js)**

#### 1. Adicionar `technicalData.samplePeakDb` (aggregate):
```javascript
if (coreMetrics.samplePeak) {
  technicalData.samplePeakDbfs = safeSanitize(coreMetrics.samplePeak.maxDbfs);
  technicalData.samplePeakLeftDbfs = safeSanitize(coreMetrics.samplePeak.leftDbfs);
  technicalData.samplePeakRightDbfs = safeSanitize(coreMetrics.samplePeak.rightDbfs);
  
  // 🎯 NOVO: Chave aggregate market-ready
  technicalData.samplePeakDb = technicalData.samplePeakDbfs; // ✅ Max(L,R) já calculado
  
  // 🔄 Compatibilidade: popular chaves antigas
  if (!technicalData.samplePeakLeftDb || technicalData.samplePeakLeftDb === null) {
    technicalData.samplePeakLeftDb = technicalData.samplePeakLeftDbfs;
  }
  if (!technicalData.samplePeakRightDb || technicalData.samplePeakRightDb === null) {
    technicalData.samplePeakRightDb = technicalData.samplePeakRightDbfs;
  }
}
```

#### 2. Adicionar `technicalData.rmsDb` (preferencial sobre aliases):
```javascript
if (coreMetrics.rms && coreMetrics.rms.average) {
  technicalData.rmsDb = technicalData.rmsLevels.average; // ✅ Chave preferencial
  technicalData.rmsAverageDb = technicalData.rmsLevels.average; // alias
  technicalData.rms = technicalData.rmsLevels.average; // @deprecated
  technicalData.avgLoudness = technicalData.rmsLevels.average; // @deprecated
}
```

#### 3. Adicionar log de verificação final:
```javascript
// 🎯 LOG FINAL: Métricas market-ready
console.log('[METRICS-EXPORT] 📊 Métricas principais:', {
  samplePeakDb: technicalData.samplePeakDb,
  samplePeakLeftDb: technicalData.samplePeakLeftDb,
  samplePeakRightDb: technicalData.samplePeakRightDb,
  rmsPeak300msDb: technicalData.rmsPeak300msDb,
  rmsDb: technicalData.rmsDb,
  truePeakDbtp: technicalData.truePeakDbtp
});
```

---

### **Frontend (audio-analyzer-integration.js)**

#### 1. Simplificar Sample Peak (usar key direta):
```javascript
// 🎯 Sample Peak (dBFS) - CORRIGIDO: usar key direta
(() => {
  const spValue = getMetric('samplePeakDb') ?? getMetric('samplePeakDbfs');
  
  if (spValue === null || spValue === undefined) {
    console.warn('[METRICS-FIX] Sample Peak não disponível');
    return '';
  }
  if (!Number.isFinite(spValue)) {
    console.warn('[METRICS-FIX] Sample Peak valor inválido:', spValue);
    return '';
  }
  
  const spStatus = getTruePeakStatus(spValue);
  console.log('[METRICS-FIX] Sample Peak renderizado:', spValue, 'dBFS');
  return row('Sample Peak (dBFS)', `${safeFixed(spValue, 1)} dBFS <span class="${spStatus.class}">${spStatus.status}</span>`, 'samplePeakDb');
})(),
```

#### 2. Usar `rmsDb` preferencial (manter fallback):
```javascript
// 🎯 Volume Médio (RMS) - CORRIGIDO: usar rmsDb preferencial
(() => {
  const rmsValue = getMetric('rmsDb') ?? getMetric('rmsAverageDb') ?? getMetric('avgLoudness') ?? getMetric('rms');
  
  if (rmsValue === null || rmsValue === undefined) {
    return row('Volume Médio (RMS)', `0.0 dBFS`, 'rmsDb');
  }
  if (!Number.isFinite(rmsValue)) {
    return row('Volume Médio (RMS)', `0.0 dBFS`, 'rmsDb');
  }
  
  console.log('[METRICS-FIX] RMS Average renderizado:', rmsValue, 'dBFS');
  return row('Volume Médio (RMS)', `${safeFixed(rmsValue, 1)} dBFS`, 'rmsDb');
})(),
```

---

### **Labels (friendly-labels.js)**

#### 1. Corrigir label "Volume Médio":
```javascript
'RMS': 'Volume Médio (RMS)',  // Era: 'Volume Médio (energia)'
'rms': 'Volume Médio (RMS)',  // Era: 'Volume Médio (energia)'
```

---

## 📝 C) RESUMO DAS MUDANÇAS

### **Arquivos alterados:**
1. `work/api/audio/json-output.js` (3 mudanças)
2. `public/audio-analyzer-integration.js` (2 mudanças)
3. `public/friendly-labels.js` (1 mudança)

### **Chaves novas/corrigidas no JSON final:**
- ✅ `technicalData.samplePeakDb` (aggregate max(L,R))
- ✅ `technicalData.rmsDb` (preferencial)
- ✅ Mantém todas chaves legadas (backward compat)

### **Labels corrigidos:**
- ✅ "Sample Peak (dBFS)" → usa `samplePeakDb` direto
- ✅ "Volume Médio (RMS)" → usa `rmsDb` preferencial, label correto

---

## ✅ D) CHECKLIST DE VALIDAÇÃO

### **1. Backend - Verificar JSON final:**
```bash
# Processar 1 áudio e ver o log:
[METRICS-EXPORT] 📊 Métricas principais: {
  samplePeakDb: -0.5,           // ✅ Deve estar presente e != null
  samplePeakLeftDb: -0.6,       // ✅ Deve estar presente
  samplePeakRightDb: -0.5,      // ✅ Deve estar presente
  rmsPeak300msDb: -6.6,         // ✅ Deve estar presente (RMS Peak 300ms)
  rmsDb: -18.2,                 // ✅ Deve estar presente (RMS Average)
  truePeakDbtp: -0.3            // ✅ Deve estar presente
}
```

### **2. Frontend - Card "Métricas Principais":**
```
✅ "Sample Peak (dBFS)" mostra ~0 a -1 dBFS (próximo de 0)
✅ "Pico RMS (300ms)" mostra ~-6 a -10 dB (janelas 300ms)
✅ "Pico Real (dBTP)" mostra valor >= Sample Peak
✅ "Volume Médio (RMS)" mostra ~-18 a -24 dBFS (energia média)
✅ Sem valores null ou NaN
✅ Labels corretos (sem "energia" incorreto)
```

### **3. Console logs - Sem erros:**
```
✅ Nenhum "[METRICS-FIX] Sample Peak não disponível"
✅ Nenhum "valor inválido" ou NaN
✅ Log "[METRICS-FIX] Sample Peak renderizado: X.X dBFS"
✅ Log "[METRICS-FIX] RMS Average renderizado: X.X dBFS"
```

---

## 🎯 RESULTADO ESPERADO

**Antes:**
- ❌ Sample Peak calculando `max(L,R)` no frontend
- ❌ "Volume Médio (energia)" label incorreto
- ❌ Múltiplos aliases confusos (avgLoudness, rms, rmsAverageDb)
- ❌ `samplePeakDb` não existia (aggregate)

**Depois:**
- ✅ Sample Peak usa key direta `samplePeakDb` (backend calcula)
- ✅ "Volume Médio (RMS)" label correto
- ✅ Chaves preferenciais claras: `samplePeakDb`, `rmsDb`, `rmsPeak300msDb`, `truePeakDbtp`
- ✅ Backward compat mantida (aliases legados preservados)
- ✅ Logs de verificação claros
- ✅ Frontend simplificado (sem cálculos manuais)

---

**Status:** Pronto para aplicar correções cirúrgicas ✅
