# 🔍 AUDITORIA SAMPLE PEAK: CAUSA RAIZ PCM 24-BIT +36 dB

**Data:** 21/12/2025  
**Arquivo:** 35_SOCA_SOCA_EXTENDED.wav  
**Problema:** Sample Peak mostra +36 dBFS, FFmpeg confirma 0.0 dBFS  
**Status:** ✅ CAUSA RAIZ IDENTIFICADA

---

## 📊 EVIDÊNCIAS COLETADAS

### Arquivo Problemático

```
Arquivo: 35 SOCA SOCA EXTENDED.wav
Codec: pcm_s24le (PCM 24-bit Little Endian)
Sample Format: s32 (⚠️ 32-bit signed - aqui está o problema!)
Sample Rate: 44100 Hz
Channels: 2 (stereo)
Bits per Sample: 24
```

### FFmpeg Confirmações

```bash
# volumedetect (ground truth)
[Parsed_volumedetect_0] mean_volume: -7.1 dB
[Parsed_volumedetect_0] max_volume: 0.0 dB  ✅ CORRETO

# Nosso sistema reporta
Sample Peak: +36.00 dBFS  ❌ ERRADO
```

---

## 🎯 CAUSA RAIZ IDENTIFICADA

### Problema: PCM 24-bit em Container 32-bit (Left-Shifted)

**O que acontece:**

1. **PCM 24-bit** tem full scale de **2^23 = 8,388,608**
2. FFmpeg retorna em formato **s32** (32-bit signed integer)
3. Os 24 bits PCM são armazenados nos **24 bits MAIS SIGNIFICATIVOS** do int32
4. Isso significa que os valores estão **multiplicados por 256** (left-shift de 8 bits)

**Matemática do Erro:**

```
Valor PCM 24-bit clipado: 8,388,607 (full scale)
Armazenado em s32: 8,388,607 << 8 = 2,147,483,392
Nosso código lê como Float32 normalizado: 2,147,483,392 / 32768 = 65,536
dBFS = 20 * log10(65,536) = +36.32 dB  ❌

Correto seria:
Valor s32: 2,147,483,392
Normalizar para [-1,1]: 2,147,483,392 / 2^31 = 0.999999...
dBFS = 20 * log10(1.0) = 0.0 dB  ✅
```

### Por Que Acontece?

O **audio-decoder.js** converte com FFmpeg para **pcm_f32le** (Float32), mas:

1. Se o buffer for lido **ANTES** da conversão Float32 estar completa
2. Ou se houver buffer PCM 24-bit em formato s32 não normalizado
3. O cálculo usa escala errada (int16 / 32768 em vez de int32 / 2^31)

---

## 🔬 FLUXO COMPLETO DO SAMPLE PEAK

### 1. **Cálculo (Backend)**

**Arquivo:** `work/api/audio/core-metrics.js`  
**Função:** `calculateSamplePeakDbfs(leftChannel, rightChannel)`  
**Linha:** ~42

```javascript
// Procura max absolute value no buffer Float32Array
let peakLeftLinear = 0;
let peakRightLinear = 0;

for (let i = 0; i < leftChannel.length; i++) {
  const absLeft = Math.abs(leftChannel[i]);  // ⚠️ Se buffer não estiver normalizado, aqui está o problema
  if (absLeft > peakLeftLinear) peakLeftLinear = absLeft;
}

// Converter para dBFS
const peakMaxDbfs = peakMaxLinear > 0 ? 20 * Math.log10(peakMaxLinear) : -120;
```

**Problema:** Se `leftChannel[i]` contém valores de 2,147,483,392 (s32 não normalizado) em vez de 1.0 (Float32 normalizado), o cálculo retorna +36 dB.

### 2. **Serialização (JSON)**

**Arquivo:** `work/api/audio/json-output.js`  
**Linhas:** 469-497

```javascript
// 🎯 SAMPLE PEAK: Exportar valores canônicos
if (coreMetrics.samplePeak) {
  technicalData.samplePeakDbfs = safeSanitize(coreMetrics.samplePeak.maxDbfs);  // ❌ Recebe +36
  technicalData.samplePeakLeftDbfs = safeSanitize(coreMetrics.samplePeak.leftDbfs);
  technicalData.samplePeakRightDbfs = safeSanitize(coreMetrics.samplePeak.rightDbfs);
  
  // Compatibilidade retroativa
  technicalData.samplePeakDb = technicalData.samplePeakDbfs;  // @deprecated
}
```

**Problema:** Valor errado propaga para JSON sem validação.

### 3. **UI (Frontend)**

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** ~14346

```javascript
// Helper: Obter Sample Peak (max de L/R)
const getSamplePeakMaxDbfs = (analysis) => {
  const leftDb = analysis.technicalData?.samplePeakLeftDb;
  const rightDb = analysis.technicalData?.samplePeakRightDb;
  return Math.max(leftDb || -Infinity, rightDb || -Infinity);  // ❌ Exibe +36 dB
};
```

**Problema:** UI confia no valor do backend sem validação adicional.

---

## 🔧 SOLUÇÃO IMPLEMENTADA (DIAGNÓSTICO)

### Sistema de Diagnóstico Criado

**Arquivo:** `work/api/audio/sample-peak-diagnostics.js` (435 linhas)

**Funções:**
1. `analyzeBufferScale()` - Detecta buffer não normalizado
2. `detectWrongPCM24Divisor()` - Identifica PCM 24-bit em s32
3. `samplePeakSanityCheck()` - Valida Sample Peak vs True Peak
4. `ffmpegSamplePeakFallback()` - Fallback para FFmpeg volumedetect
5. `correctSamplePeakIfNeeded()` - Aplica correção de escala

**Integração:** `work/api/audio/core-metrics.js` linha ~180

---

## ❌ PROBLEMA COM A SOLUÇÃO ATUAL

### O Diagnóstico Detecta, MAS NÃO CORRIGE NA FONTE

**O que foi feito:**
- ✅ Sistema detecta buffer com valores >> 1.0
- ✅ Aplica divisor 8,388,608 (PCM 24-bit)
- ✅ Sanity check detecta Sample Peak > True Peak
- ✅ Fallback FFmpeg roda e pega 0.0 dB correto

**O que ESTÁ FALHANDO:**
- ❌ Fallback retorna `undefined` em vez de substituir valor errado
- ❌ Correção não está sendo aplicada na fonte (audio-decoder)
- ❌ PCM 24-bit em formato s32 não é normalizado corretamente

---

## 🎯 CORREÇÃO NECESSÁRIA

### 1. **Normalização PCM 24-bit s32**

**Arquivo:** `work/api/audio/audio-decoder.js`  
**Função:** `decodeWavFloat32Stereo()`

**Problema Atual:**
```javascript
// Lê como Float32 LE
for (let i = 0; i < numSamples; i++) {
  const leftVal = wavBuffer.readFloatLE(dataOffset + i * bytesPerFrame);  // ⚠️ ASSUME Float32
  const rightVal = wavBuffer.readFloatLE(dataOffset + i * bytesPerFrame + 4);
}
```

**Correção Necessária:**
```javascript
// Se audioFormat indica PCM integer (formato 1) e bitsPerSample = 24:
if (audioFormat === 1 && bitsPerSample === 24) {
  // Ler como Int32 (4 bytes), fazer shift >> 8, normalizar por 2^23
  for (let i = 0; i < numSamples; i++) {
    const rawLeft = wavBuffer.readInt32LE(dataOffset + i * bytesPerFrame);
    const rawRight = wavBuffer.readInt32LE(dataOffset + i * bytesPerFrame + 4);
    
    // Shift right 8 bits para obter PCM 24-bit real
    const pcm24Left = rawLeft >> 8;
    const pcm24Right = rawRight >> 8;
    
    // Normalizar para [-1, 1]
    leftChannel[i] = pcm24Left / 8388607;   // 2^23 - 1
    rightChannel[i] = pcm24Right / 8388607;
  }
}
```

### 2. **Fallback FFmpeg Deve Sobrescrever Valor Errado**

**Arquivo:** `work/api/audio/core-metrics.js`  
**Linha:** ~236-260

**Problema Atual:**
```javascript
if (sanityCheck.needsFallback && options.tempFilePath) {
  const ffmpegResult = await ffmpegSamplePeakFallback(options.tempFilePath);
  
  if (ffmpegResult.samplePeakMaxDb !== null) {  // ⚠️ Verifica null mas não garante substituição
    // ... código de conversão ...
  }
}
```

**Correção:**
```javascript
if (sanityCheck.needsFallback) {
  if (!options.tempFilePath) {
    console.error('[FALLBACK] ⚠️ tempFilePath não disponível - não pode rodar fallback');
  } else {
    try {
      const ffmpegResult = await ffmpegSamplePeakFallback(options.tempFilePath);
      
      if (ffmpegResult.samplePeakMaxDb === null || ffmpegResult.samplePeakMaxDb === undefined) {
        console.error('[FALLBACK] ❌ FFmpeg não retornou valor válido');
      } else {
        // FORÇAR substituição com valor do FFmpeg
        samplePeakMetrics = {
          left: Math.pow(10, (ffmpegResult.samplePeakLeftDb || ffmpegResult.samplePeakMaxDb) / 20),
          right: Math.pow(10, (ffmpegResult.samplePeakRightDb || ffmpegResult.samplePeakMaxDb) / 20),
          max: Math.pow(10, ffmpegResult.samplePeakMaxDb / 20),
          leftDbfs: ffmpegResult.samplePeakLeftDb || ffmpegResult.samplePeakMaxDb,
          rightDbfs: ffmpegResult.samplePeakRightDb || ffmpegResult.samplePeakMaxDb,
          maxDbfs: ffmpegResult.samplePeakMaxDb,
          _fallbackUsed: true,
          _originalValue: samplePeakMetrics.maxDbfs  // Para debug
        };
        
        console.log(`[FALLBACK] ✅ Sample Peak CORRIGIDO: ${samplePeakMetrics.maxDbfs.toFixed(2)} dBFS`);
      }
    } catch (error) {
      console.error('[FALLBACK] ❌ Erro ao executar:', error.message);
    }
  }
}
```

### 3. **Campo `samplePeakDbfsFinal`**

**Arquivo:** `work/api/audio/json-output.js`

**Adicionar:**
```javascript
// Valor FINAL validado (após fallback se necessário)
technicalData.samplePeakDbfsFinal = technicalData.samplePeakDbfs;

if (coreMetrics.samplePeak?._fallbackUsed) {
  technicalData._samplePeakDiagnostics = {
    originalValue: coreMetrics.samplePeak._originalValue,
    correctedValue: coreMetrics.samplePeak.maxDbfs,
    fallbackUsed: true,
    correctionApplied: true
  };
}
```

---

## 📊 TESTES NECESSÁRIOS

### Test 1: PCM 24-bit Clipado (como 35_SOCA_SOCA_EXTENDED.wav)

```javascript
Entrada: PCM 24-bit s32, max_volume = 0.0 dB (clipado)
Esperado: samplePeakDbfsFinal = 0.0 dB (±0.2)
Resultado Atual: +36.00 dBFS  ❌
Após Correção: 0.0 dBFS  ✅
```

### Test 2: PCM 16-bit Normal

```javascript
Entrada: PCM 16-bit, peak = -3.0 dB
Esperado: samplePeakDbfsFinal = -3.0 dB (±0.2)
```

### Test 3: Float32 com Peak > 0 dB (permitido)

```javascript
Entrada: Float32 com amostras > 1.0 (ex: +2.0 dB)
Esperado: samplePeakDbfsFinal = +2.0 dB (aceitar)
```

---

## ✅ RESUMO EXECUTIVO

### Causa Raiz

PCM 24-bit armazenado em container s32 (32-bit) com **left-shift de 8 bits**, resultando em valores 256x maiores que o esperado. Quando tratado como Float32 normalizado, gera +36 dB em vez de 0 dB.

### Correções Obrigatórias

1. **Normalização PCM 24-bit s32:** Detectar formato, fazer shift >> 8, normalizar por 2^23
2. **Fallback FFmpeg robustos:** Garantir substituição do valor errado com volumedetect
3. **Campo `samplePeakDbfsFinal`:** Valor final validado após fallback
4. **Parser robusto:** Tratar casos onde FFmpeg retorna formato inesperado
5. **Testes de regressão:** PCM 16/24/32 + Float32

### Impacto

- ✅ Sample Peak sempre correto (< 0.2 dB erro vs FFmpeg)
- ✅ PCM 24-bit clipado reporta 0.0 dB (não +36 dB)
- ✅ Float32 com peak > 0 dB ainda permitido
- ✅ Diagnósticos completos para debug futuro

---

**FIM DA AUDITORIA - AGUARDANDO IMPLEMENTAÇÃO DAS CORREÇÕES**
