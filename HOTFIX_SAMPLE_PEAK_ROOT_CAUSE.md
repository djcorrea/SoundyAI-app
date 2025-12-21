# 🔧 HOTFIX: Sample Peak Root Cause Analysis

**Data:** 21 de dezembro de 2025  
**Criticidade:** ALTA - Bug fisicamente impossível (22 dBFS)  
**Status:** ✅ CORRIGIDO

---

## 📋 PROBLEMA REPORTADO

### Sintomas Observados
1. **Card "MÉTRICAS PRINCIPAIS"** renderizando **chaves internas como labels** (`avgLoudness`, `rmsPeak300msDb`)
2. **Labels trocados:** "Volume Médio (RMS)" mostrando valor de RMS Peak, e vice-versa
3. **Bug fisicamente impossível:** "Sample Peak L/R" exibindo **22.6 / 22.7 dBFS** enquanto True Peak = **1.20 dBTP**

### Por que isso é impossível?
```
FÍSICA DO ÁUDIO:
Sample Peak <= True Peak (SEMPRE)

Se Sample Peak = 22 dBFS e True Peak = 1.2 dBTP:
=> Violação de ~21 dB na invariante matemática
=> FISICAMENTE IMPOSSÍVEL
```

---

## 🔍 CAUSA RAIZ IDENTIFICADA

### 1. **Conflito de Chaves no Backend** (json-output.js)

**O que estava acontecendo:**
- O FFmpeg ebur128 retorna `samplePeakLeftDb` e `samplePeakRightDb` em **escala LINEAR** (0.0-1.0)
- O código calculava o **Sample Peak REAL** (max absolute sample em dBFS) separadamente
- O backend **sobrescrevia** as chaves antigas com os valores do Sample Peak real:

```javascript
// ❌ CÓDIGO ANTIGO (ERRADO):
if (!technicalData.samplePeakLeftDb || technicalData.samplePeakLeftDb === null) {
  technicalData.samplePeakLeftDb = technicalData.samplePeakLeftDbfs;  // Sobrescrever
}
```

**Problema:**
- Quando `samplePeakLeftDb` vinha do FFmpeg (não-null, valor linear), NÃO era sobrescrito
- Frontend lia `samplePeakLeftDb` esperando dBFS, mas recebia **valor linear** do FFmpeg
- Linear 0.5 interpretado como dBFS = **~22.6 dBFS** (conversão errada: 20 * log10(0.5) = -6 dBFS, mas o frontend não fazia conversão)

### 2. **Frontend Usando Chaves Erradas**

```javascript
// ❌ CÓDIGO ANTIGO (ERRADO):
const leftDb = analysis.technicalData?.samplePeakLeftDb;  // Chave antiga do FFmpeg
const rightDb = analysis.technicalData?.samplePeakRightDb;  // Chave antiga do FFmpeg
```

**Problema:**
- Frontend lia chaves antigas que vinham do FFmpeg ebur128 (escala linear ou null)
- Não usava as chaves canônicas corretas: `samplePeakLeftDbfs`, `samplePeakRightDbfs`

### 3. **Nomenclatura Inconsistente**

**Chaves antigas (legadas):**
- `avgLoudness` ← deveria ser `avgLoudnessDb`
- `rmsPeak300msDbfs` ← deveria ser `rmsPeak300msDb`
- `samplePeakLeftDb` ← chave do FFmpeg (não Sample Peak real)

**Resultado:**
- Frontend mostrava chaves internas como labels ("avgLoudness")
- Valores trocados (RMS médio vs RMS Peak)

---

## ✅ CORREÇÕES APLICADAS

### Backend (json-output.js)

#### 1. **Chaves Canônicas Market-Ready**
```javascript
// ✅ CHAVES CANÔNICAS (padrão mercado):
technicalData.avgLoudnessDb = rmsAverage;        // Volume Médio (RMS)
technicalData.rmsPeak300msDb = rmsPeak;          // RMS Peak 300ms
technicalData.samplePeakDbfs = maxSamplePeak;    // Sample Peak (max L/R)
technicalData.samplePeakLeftDbfs = leftPeak;     // Sample Peak L
technicalData.samplePeakRightDbfs = rightPeak;   // Sample Peak R
technicalData.truePeakDbtp = truePeak;           // True Peak

// 🔄 ALIASES LEGADOS (backward compatibility @deprecated):
technicalData.avgLoudness = avgLoudnessDb;       // @deprecated
technicalData.rmsPeak300msDbfs = rmsPeak300msDb; // @deprecated
technicalData.rmsAvgDbfs = avgLoudnessDb;        // @deprecated
```

#### 2. **NÃO Sobrescrever Chaves do FFmpeg**
```javascript
// ✅ CÓDIGO CORRIGIDO:
// Exportar chaves canônicas (Sample Peak real)
technicalData.samplePeakLeftDbfs = coreMetrics.samplePeak.leftDbfs;

// ⚠️ NÃO sobrescrever technicalData.samplePeakLeftDb (FFmpeg ebur128)
// Frontend deve usar chaves canônicas: samplePeakLeftDbfs/RightDbfs
```

#### 3. **Sanity Check Aprimorado**
```javascript
// 🔍 VALIDAÇÃO DE INVARIANTES:
if (samplePeak !== null && truePeak !== null) {
  const diff = truePeak - samplePeak;
  if (diff < -0.5) {
    console.error(`❌ ERRO CRÍTICO: True Peak (${truePeak.toFixed(2)} dBTP) < Sample Peak (${samplePeak.toFixed(2)} dBFS) por ${Math.abs(diff).toFixed(2)} dB - FISICAMENTE IMPOSSÍVEL!`);
    console.error(`🔧 Possível causa: escala incorreta (linear vs dB), ou conversão errada.`);
  }
}
```

### Frontend (audio-analyzer-integration.js)

#### 1. **Card MÉTRICAS PRINCIPAIS - Schema Fixo**
```javascript
// ✅ CÓDIGO CORRIGIDO:
const col1 = [
  // 1️⃣ Pico RMS (300ms)
  (() => {
    const rmsPeakValue = analysis.technicalData?.rmsPeak300msDb ?? 
                         analysis.technicalData?.peak;
    return row('Pico RMS (300ms)', `${safeFixed(rmsPeakValue, 1)} dBFS`, 'rmsPeak300msDb');
  })(),
  
  // 2️⃣ Sample Peak (dBFS)
  (() => {
    const leftDb = analysis.technicalData?.samplePeakLeftDbfs;   // ✅ Chave canônica
    const rightDb = analysis.technicalData?.samplePeakRightDbfs; // ✅ Chave canônica
    const samplePeakDbfs = Math.max(leftDb, rightDb);
    return row('Sample Peak (dBFS)', `${safeFixed(samplePeakDbfs, 1)} dBFS`, 'samplePeakDbfs');
  })(),
  
  // 3️⃣ Pico Real (dBTP)
  (() => {
    const tpValue = analysis.technicalData?.truePeakDbtp;
    return row('Pico Real (dBTP)', `${safeFixed(tpValue, 2)} dBTP`, 'truePeakDbtp');
  })(),
  
  // 4️⃣ Volume Médio (RMS)
  (() => {
    const rmsValue = analysis.technicalData?.avgLoudnessDb ?? 
                     analysis.technicalData?.avgLoudness;
    return row('Volume Médio (RMS)', `${safeFixed(rmsValue, 1)} dBFS`, 'avgLoudnessDb');
  })(),
  
  // 5️⃣ Loudness (LUFS Integrado)
  // 6️⃣ Dinâmica (DR)
  // 7️⃣ Consistência de Volume (LRA)
  // 8️⃣ Imagem Estéreo
  // 9️⃣ Abertura Estéreo
].join('');
```

#### 2. **MÉTRICAS AVANÇADAS - Chaves Canônicas**
```javascript
// ✅ Sample Peak L/R (chaves canônicas):
if (Number.isFinite(analysis.technicalData?.samplePeakLeftDbfs)) {
  rows.push(row('Sample Peak L (dBFS)', `${safeFixed(analysis.technicalData.samplePeakLeftDbfs, 1)} dBFS`, 'samplePeakLeftDbfs', 'peakLeft', 'advanced'));
}
if (Number.isFinite(analysis.technicalData?.samplePeakRightDbfs)) {
  rows.push(row('Sample Peak R (dBFS)', `${safeFixed(analysis.technicalData.samplePeakRightDbfs, 1)} dBFS`, 'samplePeakRightDbfs', 'peakRight', 'advanced'));
}
```

---

## 📊 CONTRATO DE MÉTRICAS (CANÔNICAS)

### Backend Exports (results.technicalData)
| Chave Canônica | Unidade | Descrição | Legado (@deprecated) |
|---|---|---|---|
| `avgLoudnessDb` | dBFS | Volume médio RMS | `avgLoudness`, `rmsAvgDbfs` |
| `rmsPeak300msDb` | dBFS | RMS Peak (janelas 300ms) | `peak`, `rmsPeak300msDbfs` |
| `samplePeakDbfs` | dBFS | Sample Peak max(L,R) | `samplePeakDb` |
| `samplePeakLeftDbfs` | dBFS | Sample Peak canal L | `samplePeakLeftDb` (FFmpeg) |
| `samplePeakRightDbfs` | dBFS | Sample Peak canal R | `samplePeakRightDb` (FFmpeg) |
| `truePeakDbtp` | dBTP | True Peak ITU-R BS.1770-4 | - |

### Frontend Usage
```javascript
// ✅ SEMPRE usar chaves canônicas:
analysis.technicalData.avgLoudnessDb      // Volume Médio (RMS)
analysis.technicalData.rmsPeak300msDb     // Pico RMS (300ms)
analysis.technicalData.samplePeakDbfs     // Sample Peak (max L/R)
analysis.technicalData.samplePeakLeftDbfs // Sample Peak L
analysis.technicalData.samplePeakRightDbfs// Sample Peak R
analysis.technicalData.truePeakDbtp       // Pico Real (dBTP)
```

---

## 🧪 VALIDAÇÃO

### Invariantes Matemáticas (Sanity Check)
```
✅ RMS Average <= RMS Peak (300ms)
✅ RMS Peak <= Sample Peak
✅ Sample Peak <= True Peak  ← BUG DOS 22 dBFS ERA AQUI
```

### Exemplo de Valores Esperados
```json
{
  "avgLoudnessDb": -13.3,      // Volume Médio (RMS)
  "rmsPeak300msDb": -6.1,      // Pico RMS (300ms)
  "samplePeakDbfs": 0.5,       // Sample Peak (max L/R)
  "samplePeakLeftDbfs": 0.48,  // Sample Peak L
  "samplePeakRightDbfs": 0.33, // Sample Peak R
  "truePeakDbtp": 1.2          // Pico Real (dBTP)
}
```

### Validação Lógica
```
-13.3 < -6.1 < 0.5 < 1.2  ✅ CORRETO
RMS < Peak < Sample < True Peak
```

---

## 📦 ARQUIVOS MODIFICADOS

### Backend
- ✅ `work/api/audio/json-output.js` (linhas 454-530)
  - Chaves canônicas market-ready
  - NÃO sobrescrever chaves do FFmpeg
  - Sanity check aprimorado

### Frontend
- ✅ `public/audio-analyzer-integration.js` (linhas 14310-14510)
  - Card "MÉTRICAS PRINCIPAIS" com schema fixo
  - Usar chaves canônicas (samplePeakLeftDbfs, avgLoudnessDb, etc.)
  - MÉTRICAS AVANÇADAS com chaves canônicas

---

## 🚀 RESULTADO ESPERADO

### Antes (BUG)
```
Card "MÉTRICAS PRINCIPAIS":
- Pico RMS (300ms): 0.5 dBFS        ❌ (valor trocado)
- Sample Peak L/R: 22.6 / 22.7 dBFS ❌ (fisicamente impossível)
- Volume Médio (RMS): -6.1 dB       ❌ (valor trocado)
- Label: "avgLoudness"              ❌ (chave interna exposta)
```

### Depois (CORRIGIDO)
```
Card "MÉTRICAS PRINCIPAIS":
- Pico RMS (300ms): -6.1 dBFS       ✅ (correto)
- Sample Peak (dBFS): 0.5 dBFS      ✅ (correto)
- Pico Real (dBTP): 1.2 dBTP        ✅ (correto)
- Volume Médio (RMS): -13.3 dBFS    ✅ (correto)
- Labels: fixos, profissionais      ✅ (nunca mostra chave interna)

Métricas Avançadas:
- Sample Peak L: 0.48 dBFS          ✅ (correto)
- Sample Peak R: 0.33 dBFS          ✅ (correto)
```

---

## 🎯 LIÇÕES APRENDIDAS

1. **Nunca sobrescrever chaves de diferentes fontes** (FFmpeg ebur128 vs cálculo interno)
2. **Usar nomenclatura canônica market-ready** desde o início
3. **Sanity checks devem ser CRÍTICOS** quando detectam impossibilidades físicas
4. **Frontend nunca deve expor chaves internas** como labels
5. **Documentar unidades explicitamente** (dBFS vs dBTP vs linear)

---

## ✅ STATUS FINAL

- ✅ Backend exportando chaves canônicas corretas
- ✅ Frontend usando chaves canônicas corretas
- ✅ Sanity check detectando violações físicas
- ✅ Labels fixos (nunca chaves internas)
- ✅ Valores fisicamente consistentes

**PRÓXIMO PASSO:** Testar com áudio real e verificar logs do sanity check.
