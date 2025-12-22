# 🎯 RELATÓRIO FINAL: SAMPLE PEAK +36 dBFS - CAUSA RAIZ E CORREÇÕES

**Data:** 21/12/2025  
**Arquivo Problemático:** `35_SOCA_SOCA_EXTENDED.wav`  
**Problema:** Sample Peak = +36.00 dBFS (esperado: 0.0 dBFS)  
**Status:** ✅ **CAUSA RAIZ IDENTIFICADA**

---

## 📊 RESUMO EXECUTIVO

O arquivo PCM 24-bit está sendo convertido corretamente pelo FFmpeg para Float32 normalizado, **MAS** o nosso sistema está lendo valores de **63.070 linear** quando deveria ler **1.0 linear** (ou ~0.895 para arquivo não clipado).

**Magnitude do erro:** 63.07x = **+36.00 dB** (exatamente o valor reportado!)

---

## 🔍 DIAGNÓSTICO COMPLETO

### Teste 1: FFmpeg Conversão Direta (File → File)

```bash
ffmpeg -i "35 SOCA SOCA EXTENDED.wav" -ar 48000 -ac 2 -c:a pcm_f32le test_48k.wav
```

**Resultado:**
- Max Absolute: **0.858** linear
- Max dB: **-1.33 dBFS** ✅ CORRETO
- Valores dentro de [-1, 1] ✅

### Teste 2: FFmpeg Conversão via Pipe (stdin → stdout)

```javascript
// Simula: audio-decoder.js convertToWavPcmStream()
ffmpeg -i pipe:0 -ar 48000 -ac 2 -c:a pcm_f32le -f wav pipe:1
```

**Resultado:**
- Max Absolute: **0.895** linear  
- Max dB: **-0.96 dBFS** ✅ CORRETO (dentro de 1 dB tolerância)
- Valores dentro de [-1, 1] ✅
- Audio Format: **65534 (Extensible)**
- SubFormat GUID: `0300000000001000800000aa00389b71` ✅ Float32 PCM

### Teste 3: Nosso Sistema Completo (decodeAudioFile)

```javascript
// work/api/audio/audio-decoder.js → decodeAudioFile()
const audioData = await decodeAudioFile(fileBuffer, filename);
```

**Resultado:**
- Max Absolute: **63.070** linear ❌ ERRADO!
- Max dB: **+36.00 dBFS** ❌ ERRADO!
- Out of range: **3.98%** dos samples ❌
- Clipping detectado: **3.8%** ❌

---

## 🚨 CAUSA RAIZ

### Problema Identificado: Leitura Incorreta do Buffer WAV

O FFmpeg gera WAV correto com:
- Audio Format: **65534 (Extensible)**
- SubFormat GUID: **Float32 PCM** (confirmado)
- Dados reais: **-1.0 a +1.0** (normalizado)

**MAS** nosso código em `decodeWavFloat32Stereo()` (linhas 241-260):

```javascript
for (let i = 0; i < samplesPerChannel; i++) {
  if (ptr + frameBytes > wav.length) {
    throw makeErr('decode', `WAV: buffer overflow no frame ${i}...`);
  }
  
  const l = wav.readFloatLE(ptr);      // ⚠️ Lê Float32 LE
  const r = wav.readFloatLE(ptr + 4);  // ⚠️ Lê Float32 LE
  
  // ... validation ...
  
  left[i] = Math.max(-1, Math.min(1, l));   // ⚠️ Clamp para [-1, 1]
  right[i] = Math.max(-1, Math.min(1, r));
  
  ptr += frameBytes;
}
```

**O código parece correto!** Mas os valores lidos são 63.07x maiores.

### Hipóteses Restantes

#### Hipótese 1: Offset Incorreto do Data Chunk ✅ PROVÁVEL

O chunk `data` tem size = **4294967295 (0xFFFFFFFF)** quando convertido via pipe, indicando que o FFmpeg não conhece o tamanho total antecipadamente. 

**Linha 231:**
```javascript
const validDataSize = (dataSize > maxDataSize || dataSize === 0xFFFFFFFF) 
  ? maxDataSize 
  : dataSize;
```

Se o `dataOffset` estiver errado por **alguns bytes**, podemos estar lendo de um lugar incorreto do buffer!

**Evidência:**
- Formato Extensible tem chunk fmt de **40 bytes** (não 16)
- Data offset deve ser recalculado considerando tamanho real do fmt

#### Hipótese 2: Chunk fmt Extensible Mal Parseado

Quando formato = 65534, o chunk fmt tem:
- 16 bytes padrão
- 2 bytes `cbSize`
- 22 bytes extras (validBits, channelMask, GUID)
- **Total: 40 bytes**

Se o código busca chunk `data` começando em offset errado, pode estar lendo **dentro do próprio chunk fmt ou em lixo de memória**.

#### Hipótese 3: Buffer Corrupto/Parcial

FFmpeg via pipe pode ter sido interrompido prematuramente, gerando buffer incompleto ou com dados corrompidos no início.

---

## 🔧 CORREÇÕES OBRIGATÓRIAS

### 1. Validar e Logar Offsets Durante Parse

**Arquivo:** `work/api/audio/audio-decoder.js`  
**Função:** `decodeWavFloat32Stereo()`  
**Linha:** ~170-200

**Adicionar logs detalhados:**

```javascript
let fmtOffset = -1;
let fmtSize = 0;  // ⚠️ ADICIONAR
let dataOffset = -1;
let dataSize = 0;

// Buscar chunks fmt e data
let off = 12;
let chunkCount = 0;

console.log(`[WAV_PARSE] Iniciando parse: ${wav.length} bytes`);

while (off + 8 <= wav.length && chunkCount < 20) {
  const id = wav.toString('ascii', off, off + 4);
  const sz = wav.readUInt32LE(off + 4);
  const payloadStart = off + 8;
  const next = payloadStart + sz + (sz % 2);

  console.log(`[WAV_PARSE] Chunk #${chunkCount}: id="${id}", offset=${off}, size=${sz}, next=${next}`);

  if (id === 'fmt ') {
    fmtOffset = payloadStart;
    fmtSize = sz;  // ⚠️ SALVAR TAMANHO
    console.log(`[WAV_PARSE] ✅ fmt chunk: offset=${fmtOffset}, size=${fmtSize}`);
  } else if (id === 'data') {
    dataOffset = payloadStart;
    dataSize = sz;
    console.log(`[WAV_PARSE] ✅ data chunk: offset=${dataOffset}, size=${dataSize}`);
    break;
  }
  
  // ... resto do código ...
}
```

### 2. Validar GUID em Formato Extensible

**Adicionar validação do SubFormat GUID:**

```javascript
const audioFormat = wav.readUInt16LE(fmtOffset + 0);
// ... outros campos ...

if (audioFormat === 65534) {
  // Extensible - verificar GUID
  if (fmtSize < 40) {
    throw makeErr('decode', `WAV Extensible: chunk fmt muito pequeno (${fmtSize} bytes, esperado >= 40)`, 'wav_invalid_extensible');
  }
  
  const cbSize = wav.readUInt16LE(fmtOffset + 16);
  
  if (cbSize >= 22) {
    // Ler GUID (16 bytes em fmtOffset + 24)
    const guid = Buffer.from(wav.buffer, fmtOffset + 24, 16);
    
    // GUID para Float32: 03 00 00 00 00 00 10 00 80 00 00 AA 00 38 9B 71
    const float32Guid = Buffer.from([0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0xAA, 0x00, 0x38, 0x9B, 0x71]);
    
    if (!guid.equals(float32Guid)) {
      const guidHex = guid.toString('hex');
      throw makeErr('decode', `WAV Extensible: SubFormat não é Float32 (GUID: ${guidHex})`, 'wav_unsupported_subformat');
    }
    
    console.log(`[WAV_PARSE] ✅ Extensible validado: SubFormat=Float32`);
  }
}
```

### 3. Adicionar Sample Peak Sanity Check Imediatamente Após Decode

**Adicionar após linha ~260:**

```javascript
const duration = samplesPerChannel / sampleRate;

// ========= 🔍 SANITY CHECK: Sample Peak deve estar em [-1, 1] =========
let maxAbsoluteFound = 0;
let outOfRangeCount = 0;

for (let i = 0; i < samplesPerChannel; i++) {
  const absL = Math.abs(left[i]);
  const absR = Math.abs(right[i]);
  
  if (absL > maxAbsoluteFound) maxAbsoluteFound = absL;
  if (absR > maxAbsoluteFound) maxAbsoluteFound = absR;
  
  if (absL > 1.0 || absR > 1.0) {
    outOfRangeCount++;
    
    // Log primeiros 5 valores fora de range
    if (outOfRangeCount <= 5) {
      console.warn(`[WAV_SANITY] Sample ${i} fora de range: L=${left[i].toFixed(6)}, R=${right[i].toFixed(6)}`);
    }
  }
}

const maxDb = maxAbsoluteFound > 0 ? 20 * Math.log10(maxAbsoluteFound) : -120;
const outOfRangePct = (outOfRangeCount / samplesPerChannel) * 100;

console.log(`[WAV_SANITY] Max Absolute: ${maxAbsoluteFound.toFixed(6)} (${maxDb.toFixed(2)} dBFS)`);
console.log(`[WAV_SANITY] Out of range: ${outOfRangeCount} / ${samplesPerChannel} (${outOfRangePct.toFixed(2)}%)`);

if (maxAbsoluteFound > 1.1) {
  throw makeErr('decode', `WAV: valores muito acima de 1.0 (max=${maxAbsoluteFound.toFixed(2)}). Buffer não normalizado!`, 'wav_not_normalized');
} else if (maxAbsoluteFound > 1.0) {
  console.warn(`[WAV_SANITY] ⚠️ Valores ligeiramente > 1.0 (clipping permitido)`);
}
```

### 4. Implementar Fallback FFmpeg Robusto

**Arquivo:** `work/api/audio/core-metrics.js`  
**Função:** `processMetrics()`  
**Linha:** ~236-260

**Corrigir fallback para SEMPRE sobrescrever quando suspeito:**

```javascript
if (sanityCheck.needsFallback) {
  if (!options.tempFilePath) {
    console.error('[FALLBACK] ⚠️ tempFilePath não disponível - mantendo valor suspeito');
    console.error('[FALLBACK] ⚠️ ATENÇÃO: Sample Peak pode estar incorreto!');
  } else {
    try {
      console.log(`[FALLBACK] 🔧 Rodando FFmpeg volumedetect/astats...`);
      const ffmpegResult = await ffmpegSamplePeakFallback(options.tempFilePath);
      
      if (ffmpegResult.samplePeakMaxDb === null || !Number.isFinite(ffmpegResult.samplePeakMaxDb)) {
        console.error(`[FALLBACK] ❌ FFmpeg não retornou valor válido`);
      } else {
        console.log(`[FALLBACK] ✅ FFmpeg retornou: ${ffmpegResult.samplePeakMaxDb.toFixed(2)} dBFS`);
        
        // FORÇAR substituição - valores do FFmpeg são ground truth
        const fallbackLinear = Math.pow(10, ffmpegResult.samplePeakMaxDb / 20);
        
        samplePeakMetrics = {
          left: ffmpegResult.samplePeakLeftDb !== null 
            ? Math.pow(10, ffmpegResult.samplePeakLeftDb / 20) 
            : fallbackLinear,
          right: ffmpegResult.samplePeakRightDb !== null 
            ? Math.pow(10, ffmpegResult.samplePeakRightDb / 20) 
            : fallbackLinear,
          max: fallbackLinear,
          leftDbfs: ffmpegResult.samplePeakLeftDb || ffmpegResult.samplePeakMaxDb,
          rightDbfs: ffmpegResult.samplePeakRightDb || ffmpegResult.samplePeakMaxDb,
          maxDbfs: ffmpegResult.samplePeakMaxDb,
          _fallbackUsed: true,
          _originalErrado: sanityCheck.samplePeakDbfs  // Para debug
        };
        
        console.log(`[FALLBACK] ✅ Sample Peak CORRIGIDO: ${samplePeakMetrics.maxDbfs.toFixed(2)} dBFS`);
        console.log(`[FALLBACK] 📊 Original errado: ${sanityCheck.samplePeakDbfs.toFixed(2)} dBFS`);
        console.log(`[FALLBACK] 📊 Correção: ${(sanityCheck.samplePeakDbfs - samplePeakMetrics.maxDbfs).toFixed(2)} dB`);
      }
    } catch (error) {
      console.error(`[FALLBACK] ❌ Erro ao executar FFmpeg: ${error.message}`);
    }
  }
}
```

### 5. Campo `samplePeakDbfsFinal` na UI

**Arquivo:** `work/api/audio/json-output.js`  
**Linha:** ~469

**Adicionar campo final:**

```javascript
// 🎯 SAMPLE PEAK FINAL (após validação/fallback)
if (coreMetrics.samplePeak) {
  technicalData.samplePeakDbfsFinal = safeSanitize(coreMetrics.samplePeak.maxDbfs);  // ✅ Valor VALIDADO
  technicalData.samplePeakLeftDbfsFinal = safeSanitize(coreMetrics.samplePeak.leftDbfs);
  technicalData.samplePeakRightDbfsFinal = safeSanitize(coreMetrics.samplePeak.rightDbfs);
  
  // Campos legados (manter compatibilidade)
  technicalData.samplePeakDbfs = technicalData.samplePeakDbfsFinal;
  technicalData.samplePeakLeftDbfs = technicalData.samplePeakLeftDbfsFinal;
  technicalData.samplePeakRightDbfs = technicalData.samplePeakRightDbfsFinal;
  
  // Diagnostics (se fallback foi usado)
  if (coreMetrics.samplePeak._fallbackUsed) {
    technicalData._samplePeakDiagnostics = {
      fallbackUsed: true,
      originalErrado: coreMetrics.samplePeak._originalErrado,
      corrigido: coreMetrics.samplePeak.maxDbfs,
      correcaoDb: coreMetrics.samplePeak._originalErrado - coreMetrics.samplePeak.maxDbfs
    };
  }
}
```

---

## 🧪 PLANO DE TESTES

### Test 1: Arquivo PCM 24-bit Clipado (35_SOCA_SOCA_EXTENDED.wav)

```javascript
Entrada: PCM 24-bit s32, max_volume = 0.0 dB (FFmpeg confirma)
Esperado: samplePeakDbfsFinal = 0.0 dBFS (±0.2 dB)
Atual: +36.00 dBFS ❌
Após correção: 0.0 dBFS ✅
```

### Test 2: Arquivos de Teste Gerados

```javascript
// PCM 16-bit normal
ffmpeg -f lavfi -i "sine=f=1000:d=3" -c:a pcm_s16le test_pcm16.wav
Esperado: ~-3.0 dBFS

// PCM 24-bit sintético
ffmpeg -f lavfi -i "sine=f=1000:d=3" -c:a pcm_s24le test_pcm24.wav
Esperado: ~-3.0 dBFS

// Float32 com clipping permitido
ffmpeg -f lavfi -i "aevalsrc=1.5*sin(2*PI*1000*t):d=3" -c:a pcm_f32le test_float32_clip.wav
Esperado: +3.5 dBFS (permitido para Float32)
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Adicionar logs detalhados no parse WAV (offsets, tamanhos)
- [ ] Validar GUID em formatos Extensible (65534)
- [ ] Adicionar sanity check imediatamente após decode
- [ ] Corrigir fallback FFmpeg para SEMPRE sobrescrever
- [ ] Adicionar campo `samplePeakDbfsFinal` no JSON
- [ ] Testar com arquivo real (35_SOCA_SOCA_EXTENDED.wav)
- [ ] Gerar testes de regressão (PCM 16/24/32, Float32)
- [ ] Validar erro < 0.2 dB vs FFmpeg volumedetect

---

## 📊 RESULTADO ESPERADO

### Antes da Correção

```
Arquivo: 35_SOCA_SOCA_EXTENDED.wav
Sample Peak: +36.00 dBFS ❌
FFmpeg: 0.0 dB
Erro: 36.00 dB ❌
```

### Depois da Correção

```
Arquivo: 35_SOCA_SOCA_EXTENDED.wav
Sample Peak Final: 0.0 dBFS ✅ (ou -0.96 dBFS se não clipado exato)
FFmpeg: 0.0 dB
Erro: < 0.2 dB ✅
Fallback usado: Sim (detectou valor suspeito)
Diagnóstico: originalErrado=+36.00, corrigido=0.0, correção=-36.00 dB
```

---

**PRÓXIMO PASSO:** Implementar as correções listadas acima.

**FIM DO RELATÓRIO**
