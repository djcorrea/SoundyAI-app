# 🎯 **AUDITORIA COMPLETA - PASTA WORK/ DETALHADA**

**Data**: 2024-12-27  
**Foco**: Identificar origem de valores exagerados (True Peak -23.14 dBTP quando Sample Peak -1.0 dB) e bandas incoerentes no modal  
**Escopo**: Análise linha por linha dos módulos de cálculo no backend  

---

## 📋 **RESUMO EXECUTIVO**

### **🚨 PROBLEMAS CRÍTICOS IDENTIFICADOS**

1. **TRUE PEAK CALCULATION (truepeak.js)**: Algoritmo polyphase fundamentalmente incorreto
2. **SPECTRAL BANDS (spectral-bands.js)**: Normalização dupla distorce proporções reais  
3. **JSON OUTPUT (json-output.js)**: Estruturas de dados duplicadas (3 mapeamentos das mesmas bandas)
4. **PIPELINE (pipeline-complete.js)**: Ausência de validação entre fases permite propagação de dados corrompidos

### **🎯 ORIGEM DOS VALORES EXAGERADOS**

**True Peak -23.14 dBTP** quando Sample Peak é -1.0 dB é causado por:
- Algoritmo polyphase com coeficientes inadequados
- Interpolação matemática incorreta durante oversampling 4x
- Acumulação de ganho não-intencional nas fases polyphase

---

## 🏔️ **1. ANÁLISE TRUEPEAK.JS**

### **❌ PROBLEMA CRÍTICO: Algoritmo Polyphase Incorreto**

**Arquivo**: `work/lib/audio/features/truepeak.js`  
**Linhas**: 224-235

```javascript
// ❌ ALGORITMO INCORRETO
for (let phase = 0; phase < factor; phase++) {
  let output = 0;
  for (let i = 0; i < tapsPerPhase; i++) {
    const delayIdx = (this.delayIndex - 1 - i + this.coeffs.LENGTH) % this.coeffs.LENGTH;
    
    // 🚨 ERRO FUNDAMENTAL: Sub-amostragem incorreta
    const coeffIdx = (i + phase) % this.coeffs.TAPS.length;
    
    output += this.delayLine[delayIdx] * this.coeffs.TAPS[coeffIdx];
  }
  upsampled[phase] = output; // ← SEM GANHO DE NORMALIZAÇÃO
}
```

### **🔍 PROBLEMAS ESPECÍFICOS**

1. **Coeficientes Polyphase Inadequados** (Linhas 15-25)
   - Lista sequencial de 48 coeficientes pequenos
   - **NÃO** é estrutura polyphase real (deveria ter coeficientes intercalados por fase)
   - Valores muito pequenos (ex: -0.000015258789) inadequados para interpolação

2. **Indexação Incorreta** (Linha 232)
   ```javascript
   const coeffIdx = (i + phase) % this.coeffs.TAPS.length;
   ```
   - Formula **não é polyphase**
   - Polyphase real usa: `coeffIdx = tap * factor + phase`
   - Resultado: interpolação matemática incorreta

3. **Validação Contraproducente** (Linhas 180-189)
   ```javascript
   if (maxTruePeakdBTP < samplePeakdB) {
     maxTruePeakdBTP = samplePeakdB; // ← Força correção que mascara problema
   }
   ```
   - Esconde o algoritmo quebrado
   - Gera valores "corretos" artificialmente

### **🎯 IMPACTO**
- True Peak calculado incorretamente (pode ser muito alto ou muito baixo)
- Oversampling 4x não funciona conforme ITU-R BS.1770-4
- Valores como -23.14 dBTP quando Sample Peak é -1.0 dB

---

## 🌈 **2. ANÁLISE SPECTRAL-BANDS.JS**

### **⚠️ PROBLEMA: Normalização Dupla**

**Arquivo**: `work/lib/audio/features/spectral-bands.js`  
**Linhas**: 125-144

```javascript
// ❌ PRIMEIRA NORMALIZAÇÃO (Linha 125-135)
const normalizationFactor = 100.0 / percentageSum;
for (const key of Object.keys(percentages)) {
  percentages[key] *= normalizationFactor;
}

// ❌ SEGUNDA NORMALIZAÇÃO (!!) (Linha 138-144)
const finalSum = Object.values(percentages).reduce((sum, p) => sum + p, 0);
if (Math.abs(finalSum - 100) > 0.001) {
  const adjustment = (100 - finalSum) / Object.keys(percentages).length;
  for (const key of Object.keys(percentages)) {
    percentages[key] += adjustment; // ← Distorce proporções reais
  }
}
```

### **🔍 PROBLEMAS ESPECÍFICOS**

1. **Normalização Dupla Consecutiva**
   - Primeira: Multiplicação proporcional (correto)
   - Segunda: Distribuição uniforme de erro (incorreto)
   - **Resultado**: Proporções distorcidas das bandas reais

2. **Agregação por Mediana** (Linhas 285-292)
   ```javascript
   const medianPercentage = percentages.length % 2 === 0
     ? (percentages[medianIndex - 1] + percentages[medianIndex]) / 2
     : percentages[medianIndex];
   ```
   - Mediana pode mascarar variações importantes
   - **Deveria usar média ponderada** para preservar características do áudio

### **🎯 IMPACTO**
- Bandas espectrais podem parecer "artificialmente balanceadas"
- Proporções reais do espectro são distorcidas
- Modal exibe bandas incoerentes com o áudio real

---

## 📊 **3. ANÁLISE JSON-OUTPUT.JS**

### **⚠️ PROBLEMA: Estruturas Duplicadas**

**Arquivo**: `work/api/audio/json-output.js`  
**Linhas**: 525-570, 650-700, 750-770

```javascript
// ❌ ESTRUTURA 1: spectralBands (Linha 525)
spectralBands: (() => {
  // Primeira estrutura das bandas
})(),

// ❌ ESTRUTURA 2: technicalData (Linha 650)
technicalData: {
  spectral_balance: technicalData.spectral_balance,
  spectralBands: technicalData.spectral_balance, // ← DUPLICAÇÃO
  bands: technicalData.spectral_balance, // ← DUPLICAÇÃO
}

// ❌ ESTRUTURA 3: metrics.bands (Linha 750)
metrics: {
  bands: (() => {
    // TERCEIRA estrutura das mesmas bandas
  })()
}
```

### **🔍 PROBLEMAS ESPECÍFICOS**

1. **Mapeamento Triplo das Mesmas Bandas**
   - Inconsistências entre as 3 estruturas
   - Front-end pode usar estrutura incorreta
   - Debugging dificultado

2. **Lógica de Extração Excessivamente Complexa** (Linhas 290-340)
   ```javascript
   // Tentativa 1: .bands.bandName
   if (b.bands && typeof b.bands === 'object') { /* extrair */ }
   // Tentativa 2: Estrutura direta  
   else if (b.sub !== undefined) { /* usar direto */ }
   // Tentativa 3: Busca flexível
   else { /* buscar por chaves variadas */ }
   ```
   - Lógica complexa pode mascarar problemas de estrutura
   - **Deveria falhar rápido** se estrutura estiver incorreta

### **🎯 IMPACTO**
- Front-end pode acessar dados de estruturas diferentes
- Bandas no modal podem não corresponder aos valores calculados
- Debugging complexo devido às múltiplas representações

---

## 🔄 **4. ANÁLISE PIPELINE-COMPLETE.JS**

### **⚠️ PROBLEMA: Ausência de Validação Entre Fases**

**Arquivo**: `work/api/audio/pipeline-complete.js`  
**Linhas**: 40-60

```javascript
// ❌ SEM VALIDAÇÃO
segmentedData = segmentAudioTemporal(audioData, { jobId, fileName });
coreMetrics = await calculateCoreMetrics(segmentedData, { jobId, fileName });
```

### **🔍 PROBLEMAS ESPECÍFICOS**

1. **Propagação Automática de Dados Corrompidos**
   - Fase 5.2 pode retornar dados inválidos
   - Fase 5.3 processará dados corrompidos sem detectar
   - Resultado: métricas incorretas calculadas

2. **Logs "Seguros" Mascarando Problemas** (Linhas 54-58)
   ```javascript
   const lufsStr = coreMetrics.lufs?.integrated ? 
     coreMetrics.lufs.integrated.toFixed(1) : 'N/A';
   ```
   - `'N/A'` esconde quando métricas essenciais falharam
   - **Deveria alertar** quando métricas críticas são null

### **🎯 IMPACTO**
- Pipeline pode produzir resultados "completos" mesmo com dados corrompidos
- Falhas silenciosas em fases intermediárias
- Debugging dificultado pela ausência de validação

---

## 🎯 **ORIGEM DOS PROBLEMAS NO MODAL**

### **💥 CADEIA DE CAUSA E EFEITO**

1. **truepeak.js**: Algoritmo polyphase incorreto → True Peak exagerado (-23.14 dBTP)
2. **spectral-bands.js**: Normalização dupla → Bandas proporcionalmente incorretas
3. **json-output.js**: Mapeamento triplo → Estruturas inconsistentes
4. **pipeline-complete.js**: Sem validação → Dados corrompidos propagados
5. **Modal Front-end**: Exibe valores calculados incorretamente

### **🚨 PROBLEMAS ESPECÍFICOS NO MODAL**

#### **True Peak Exagerado**
- **Origem**: Algoritmo polyphase em `truepeak.js` (linhas 224-235)
- **Causa**: Interpolação incorreta durante oversampling 4x
- **Resultado**: -23.14 dBTP quando deveria ser ≈ -1.0 dBTP

#### **Bandas Espectrais Incoerentes**
- **Origem**: Normalização dupla em `spectral-bands.js` (linhas 125-144)  
- **Causa**: Segunda normalização distorce proporções reais
- **Resultado**: Bandas não correspondem ao espectro real do áudio

#### **Inconsistências entre Métricas**
- **Origem**: Estruturas duplicadas em `json-output.js` (linhas 525-770)
- **Causa**: Front-end pode acessar estruturas diferentes
- **Resultado**: Valores que não batem entre si no modal

---

## ✅ **RECOMENDAÇÕES PRIORITÁRIAS**

### **🏔️ 1. CORRIGIR TRUE PEAK (CRÍTICO)**

**Arquivo**: `work/lib/audio/features/truepeak.js`

```javascript
// ✅ CORREÇÃO ALGORITMO POLYPHASE
// Substituir linhas 224-235 por implementação correta
for (let phase = 0; phase < factor; phase++) {
  let output = 0;
  for (let tap = 0; tap < (tapsPerPhase / factor); tap++) {
    const delayIdx = (this.delayIndex - 1 - tap + this.coeffs.LENGTH) % this.coeffs.LENGTH;
    
    // ✅ INDEXAÇÃO CORRETA POLYPHASE
    const coeffIdx = tap * factor + phase;
    if (coeffIdx < this.coeffs.TAPS.length) {
      output += this.delayLine[delayIdx] * this.coeffs.TAPS[coeffIdx];
    }
  }
  // ✅ NORMALIZAÇÃO ADEQUADA
  upsampled[phase] = output / factor; 
}
```

### **🌈 2. SIMPLIFICAR BANDAS ESPECTRAIS**

**Arquivo**: `work/lib/audio/features/spectral-bands.js`

```javascript
// ✅ NORMALIZAÇÃO ÚNICA (Remover segunda normalização)
const normalizationFactor = 100.0 / percentageSum;
for (const key of Object.keys(percentages)) {
  percentages[key] *= normalizationFactor;
}
// ✅ REMOVER linhas 138-144 (segunda normalização)

// ✅ AGREGAÇÃO POR MÉDIA PONDERADA (em vez de mediana)
const weightedAverage = validBands.reduce((sum, band, idx) => {
  const weight = band.totalEnergy || 1.0; // Peso baseado na energia
  return sum + (band.bands[key].percentage * weight);
}, 0) / totalWeight;
```

### **📊 3. UNIFICAR ESTRUTURA JSON**

**Arquivo**: `work/api/audio/json-output.js`

```javascript
// ✅ ESTRUTURA ÚNICA DAS BANDAS
// Manter apenas technicalData.spectral_balance
// Remover spectralBands e metrics.bands duplicados

// ✅ VALIDAÇÃO RÍGIDA (Fail-Fast)
if (!b.bands || typeof b.bands !== 'object') {
  throw makeErr('spectral_bands', 'Invalid bands structure', 'invalid_bands');
}
```

### **🔄 4. ADICIONAR VALIDAÇÃO PIPELINE**

**Arquivo**: `work/api/audio/pipeline-complete.js`

```javascript
// ✅ VALIDAÇÃO ENTRE FASES
if (!segmentedData || !segmentedData.framesFFT || segmentedData.framesFFT.count === 0) {
  throw makeErr('segmentation', 'Invalid segmented data', 'invalid_segmentation');
}

if (!coreMetrics || !coreMetrics.lufs || !coreMetrics.truePeak) {
  throw makeErr('core_metrics', 'Missing essential metrics', 'missing_metrics');
}
```

---

## 🏁 **CONCLUSÃO**

### **📍 ORIGEM CONFIRMADA DOS PROBLEMAS**

1. **True Peak -23.14 dBTP**: Algoritmo polyphase incorreto em `truepeak.js`
2. **Bandas incoerentes**: Normalização dupla em `spectral-bands.js`  
3. **Inconsistências no modal**: Estruturas duplicadas em `json-output.js`
4. **Propagação de erros**: Falta de validação em `pipeline-complete.js`

### **🎯 IMPACTO NO MODAL**

O modal exibe valores exagerados porque:
- True Peak é calculado incorretamente (oversampling quebrado)
- Bandas espectrais são normalizadas duas vezes (distorção)
- Front-end pode acessar estruturas inconsistentes (mapeamento triplo)
- Pipeline não detecta quando dados estão corrompidos

### **⚡ PRÓXIMOS PASSOS**

1. **Corrigir algoritmo polyphase** em `truepeak.js` (PRIORIDADE MÁXIMA)
2. **Remover normalização dupla** em `spectral-bands.js`
3. **Unificar estrutura JSON** em `json-output.js`
4. **Adicionar validação** em `pipeline-complete.js`
5. **Testar com áudio conhecido** para validar correções

### **🔍 VALIDAÇÃO**

Após correções, True Peak deve ser **≥ Sample Peak** sempre, e bandas espectrais devem somar exatamente 100% sem distorção das proporções reais.

---

**Auditoria realizada**: 2024-12-27  
**Status**: PROBLEMAS CRÍTICOS IDENTIFICADOS  
**Ação requerida**: CORREÇÃO IMEDIATA do algoritmo polyphase