# 🚨 AUDITORIA RMS - RELATÓRIO FINAL DE DIAGNÓSTICO

**Data:** 24 de outubro de 2025  
**Branch:** perf/remove-bpm  
**Auditor:** Sistema de Análise Técnica SoundyAI  
**Status:** ✅ **AUDITORIA CONCLUÍDA - LOGS INSTRUMENTADOS**

---

## 📋 SUMÁRIO EXECUTIVO

### 🎯 OBJETIVO
Identificar exatamente onde está a quebra no fluxo de cálculo e propagação do RMS (Volume Médio) que faz com que `technicalData.avgLoudness` chegue `null` ou `undefined` no frontend.

### ✅ RESULTADO
**Código RMS está INTACTO em todas as 4 fases do pipeline.**  
Adicionados **5 pontos de log** críticos para diagnóstico em tempo real.

### 🔍 PRINCIPAL SUSPEITA
**Valores RMS sendo calculados como `1e-8` (silêncio artificial)**, convertidos para `-160 dB`, e possivelmente tratados como inválidos no fluxo.

---

## 📊 MAPEAMENTO COMPLETO DO FLUXO RMS

```
┌─────────────────────────────────────────────────────────────────┐
│ FASE 5.2: TEMPORAL SEGMENTATION                                │
├─────────────────────────────────────────────────────────────────┤
│ Arquivo: work/api/audio/temporal-segmentation.js               │
│ Função: segmentChannelForRMS(audioData, channelName)           │
│ Linha: 150-191                                                  │
│                                                                 │
│ ALGORITMO:                                                      │
│  1. Itera por blocos de 300ms (14400 samples @ 48kHz)         │
│  2. Calcula RMS: sqrt(sumSquares / blockLength)               │
│  3. Valida: if (isFinite && rmsValue > 0)                     │
│     → rmsValues.push(rmsValue)                                │
│  4. Caso contrário (silêncio):                                │
│     → rmsValues.push(1e-8)  ⚠️ VALOR ARTIFICIAL               │
│                                                                 │
│ RETORNA: { frames: Float32Array[], rmsValues: number[] }       │
│                                                                 │
│ ✅ LOG ADICIONADO (linha 171):                                  │
│    console.log(`[DEBUG RMS CALC] Canal ${channelName},        │
│                 Bloco 0: rmsValue=${rmsValue}`)                │
│                                                                 │
│ ✅ LOG ADICIONADO (linha 189):                                  │
│    console.log(`[DEBUG RMS FINAL] Canal ${channelName}:       │
│                 primeiro RMS=${rmsValues[0]?.toFixed(6)}`)    │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 5.3: CORE METRICS                                          │
├─────────────────────────────────────────────────────────────────┤
│ Arquivo: work/api/audio/core-metrics.js                        │
│ Função: processRMSMetrics(framesRMS)                           │
│ Linha: 1221-1305                                                │
│                                                                 │
│ ENTRADA:                                                        │
│  framesRMS = {                                                 │
│    left: [0.05, 0.04, 0.06, ...],  // rmsValues do canal L   │
│    right: [0.04, 0.05, 0.05, ...], // rmsValues do canal R   │
│    count: 245                                                  │
│  }                                                             │
│                                                                 │
│ PROCESSAMENTO:                                                  │
│  1. Filtro: validFrames = frames.filter(val => val > 0 &&     │
│                                          isFinite(val))        │
│     ⚠️ 1e-8 PASSA NESTE FILTRO (1e-8 > 0 é true)              │
│                                                                 │
│  2. RMS Médio: (leftRMS + rightRMS) / 2                       │
│  3. Peak RMS: Math.max(...validLeftFrames, ...validRightFrames)│
│  4. Conversão dB: 20 * log10(rmsValue)                        │
│     - Se rmsValue = 1e-8 → -160 dB                           │
│     - Se rmsValue < 1e-6 → < -120 dB (muito baixo)           │
│     - Floor aplicado: -120 dB mínimo                          │
│                                                                 │
│ RETORNA:                                                        │
│  {                                                             │
│    left: -13.2,      // dB                                    │
│    right: -12.8,     // dB                                    │
│    average: -13.0,   // dB ← VALOR PRINCIPAL                 │
│    peak: -8.5,       // dB                                    │
│    count: 245                                                  │
│  }                                                             │
│                                                                 │
│ ✅ LOG ADICIONADO (linha 269-277):                              │
│    console.log(`[DEBUG CORE] Chamando processRMSMetrics`)     │
│    console.log(`[DEBUG CORE] processRMSMetrics retornou:`,    │
│                result)                                         │
│                                                                 │
│ ✅ LOG ADICIONADO (linha 1284):                                 │
│    console.log(`[DEBUG RMS RETURN] average=${averageRMSDb}    │
│                dB, validFrames=${validLeftFrames.length}`)    │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 5.4: JSON OUTPUT                                           │
├─────────────────────────────────────────────────────────────────┤
│ Arquivo: work/api/audio/json-output.js                         │
│ Função: extractTechnicalData(coreMetrics)                      │
│ Linha: 397-415                                                  │
│                                                                 │
│ ENTRADA:                                                        │
│  coreMetrics.rms = { left: -13.2, right: -12.8,               │
│                      average: -13.0, peak: -8.5, count: 245 }  │
│                                                                 │
│ PROCESSAMENTO:                                                  │
│  1. if (coreMetrics.rms) {  ← VALIDAÇÃO                       │
│  2.   technicalData.rmsLevels = {                             │
│         left: safeSanitize(coreMetrics.rms.left),             │
│         right: safeSanitize(coreMetrics.rms.right),           │
│         average: safeSanitize(coreMetrics.rms.average),       │
│         peak: safeSanitize(coreMetrics.rms.peak),             │
│         count: safeSanitize(coreMetrics.rms.count, 0)         │
│       }                                                        │
│  3.   technicalData.avgLoudness =                             │
│         technicalData.rmsLevels.average  ← ATRIBUIÇÃO FINAL   │
│                                                                 │
│ FUNÇÃO safeSanitize (linha 113-128):                           │
│  - Retorna null se value === null || undefined                │
│  - Retorna null se !isFinite(value) || isNaN(value)           │
│  - Arredonda: Math.round(value * 1000) / 1000                 │
│  - ⚠️ NÃO HÁ FILTRO POR MAGNITUDE (aceita -120 dB)            │
│                                                                 │
│ ✅ LOG ADICIONADO (linha 399):                                  │
│    console.log(`[DEBUG JSON RMS] coreMetrics.rms.average=     │
│                ${coreMetrics.rms.average}`)                    │
│                                                                 │
│ ✅ LOG ADICIONADO (linha 413):                                  │
│    console.log(`[DEBUG JSON FINAL]                            │
│                technicalData.avgLoudness=${...}`)             │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                        │
├─────────────────────────────────────────────────────────────────┤
│ Arquivo: public/audio-analyzer-integration.js                  │
│ Linha: 3937-3945                                                │
│                                                                 │
│ RECEBE: analysis.technicalData.avgLoudness                     │
│                                                                 │
│ FALLBACK EM CASCATA:                                           │
│  1. getMetric('rms_level', 'avgLoudness')                     │
│  2. analysis.technicalData?.avgLoudness                       │
│  3. analysis.technicalData?.averageRmsDb                      │
│  4. analysis.technicalData?.rmsLevels?.average                │
│  5. null                                                       │
│                                                                 │
│ RENDERIZAÇÃO:                                                   │
│  row('Volume Médio (RMS)', `${safeFixed(avgLoudness)} dBFS`)  │
│                                                                 │
│ safeFixed(value):                                              │
│  - Se null/undefined → retorna "—"                            │
│  - Se isFinite(value) → retorna value.toFixed(2)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚨 PRINCIPAIS SUSPEITAS IDENTIFICADAS

### 🔴 SUSPEITA #1: Silêncio Artificial (`1e-8`)

**Local:** `temporal-segmentation.js` linha 180-182

**Código:**
```javascript
if (isFinite(rmsValue) && rmsValue > 0) {
  rmsValues.push(rmsValue);
} else {
  rmsValues.push(1e-8);  // ⚠️ PROBLEMA
}
```

**Impacto:**
- Blocos de silêncio total recebem `1e-8` como RMS
- Convertido para dB: `20 * log10(1e-8) = -160 dB`
- Se todo o áudio for silencioso, **TODOS** os valores serão `-160 dB`
- Isso é **extremamente baixo** e pode ser tratado como inválido

**Cenário de Falha:**
1. Áudio muito comprimido → blocos ficam próximos de zero
2. `rmsValue ≈ 0` → cai no `else`
3. Todos os valores viram `1e-8`
4. RMS médio = `-160 dB` → Frontend exibe `—`

**Evidência:**
- Antes da remoção de BPM, isso funcionava → algo mudou na normalização?
- Áudio pode estar sendo normalizado de forma mais agressiva
- Ou o floor de `-120 dB` está rejeitando valores muito baixos

---

### 🟡 SUSPEITA #2: Floor de `-120 dB` Tratado como Null

**Local:** `core-metrics.js` linhas 1274-1275

**Código:**
```javascript
const averageRMSDb = averageRMS > 0 ? 20 * Math.log10(averageRMS) : -120;
const peakRMSDb = peakRMS > 0 ? 20 * Math.log10(peakRMS) : -120;
```

**Impacto:**
- Se `averageRMS === 0` → retorna `-120 dB`
- Se há validação posterior que rejeita `-120 dB` → vira `null`

**Cenário de Falha:**
1. Todos os `validFrames` são filtrados (nenhum passa)
2. `calculateArrayAverage([])` → retorna `0` ou `NaN`
3. `averageRMS = 0` → `averageRMSDb = -120`
4. Alguma validação trata `-120` como "placeholder inválido"

---

### 🟢 SUSPEITA #3: Filtro de Valores Válidos Remove Tudo

**Local:** `core-metrics.js` linha 1242

**Código:**
```javascript
const validLeftFrames = leftFrames.filter(val => val > 0 && isFinite(val));
```

**Impacto:**
- Se `leftFrames = [1e-8, 1e-8, 1e-8, ...]` (todos silêncio artificial)
- Filtro **NÃO remove** (1e-8 > 0 é true)
- MAS se houver `NaN` ou `Infinity` → remove

**Cenário de Falha:**
1. `segmentChannelForRMS` calcula RMS corretamente
2. Mas valores vêm como `NaN` ou `Infinity` por erro de cálculo
3. Filtro remove tudo
4. `validLeftFrames.length === 0` → retorna null

---

## 🔬 LOGS INSTRUMENTADOS PARA DIAGNÓSTICO

### Log #1: Cálculo RMS (Primeiro Bloco)
**Arquivo:** `temporal-segmentation.js:171`
```javascript
console.log(`[DEBUG RMS CALC] Canal ${channelName}, Bloco 0: rmsValue=${rmsValue}, isFinite=${isFinite(rmsValue)}, block.length=${block.length}`);
```

**O que buscar:**
- `rmsValue=0.000000001` → Silêncio artificial (PROBLEMA)
- `rmsValue=NaN` → Erro de cálculo (CRÍTICO)
- `rmsValue=0.05` → Normal (OK)

---

### Log #2: Valores Finais RMS (Por Canal)
**Arquivo:** `temporal-segmentation.js:189`
```javascript
console.log(`[DEBUG RMS FINAL] Canal ${channelName}: frames=${frames.length}, rmsValues=${rmsValues.length}, primeiro RMS=${rmsValues[0]?.toFixed(6)}, último RMS=${rmsValues[rmsValues.length-1]?.toFixed(6)}`);
```

**O que buscar:**
- `primeiro RMS=0.000001` → Todos os blocos são silêncio (PROBLEMA)
- `primeiro RMS=0.050000` → Valores normais (OK)
- `rmsValues=0` → Nenhum frame gerado (CRÍTICO)

---

### Log #3: Chamada processRMSMetrics
**Arquivo:** `core-metrics.js:269-277`
```javascript
console.log(`[DEBUG CORE] Chamando processRMSMetrics com segmentedAudio.framesRMS:`, {
  hasFramesRMS: !!segmentedAudio.framesRMS,
  hasLeft: !!segmentedAudio.framesRMS?.left,
  hasRight: !!segmentedAudio.framesRMS?.right,
  leftLength: segmentedAudio.framesRMS?.left?.length,
  rightLength: segmentedAudio.framesRMS?.right?.length,
  count: segmentedAudio.framesRMS?.count
});
const result = this.processRMSMetrics(segmentedAudio.framesRMS);
console.log(`[DEBUG CORE] processRMSMetrics retornou:`, result);
```

**O que buscar:**
- `leftLength=0` → framesRMS vazio (CRÍTICO)
- `result.average=null` → Processamento falhou (PROBLEMA)
- `result.average=-13.0` → OK

---

### Log #4: Retorno processRMSMetrics
**Arquivo:** `core-metrics.js:1284`
```javascript
console.log(`[DEBUG RMS RETURN] average=${averageRMSDb.toFixed(2)} dB, peak=${peakRMSDb.toFixed(2)} dB, validFrames L/R=${validLeftFrames.length}/${validRightFrames.length}`);
```

**O que buscar:**
- `average=-160.00 dB` → Silêncio artificial (PROBLEMA)
- `validFrames L/R=0/0` → Todos filtrados (CRÍTICO)
- `average=-13.00 dB` → OK

---

### Log #5: Propagação JSON
**Arquivo:** `json-output.js:399, 413`
```javascript
console.log(`[DEBUG JSON RMS] coreMetrics.rms.average=${coreMetrics.rms.average}, left=${coreMetrics.rms.left}, right=${coreMetrics.rms.right}, peak=${coreMetrics.rms.peak}`);
// ...
console.log(`[DEBUG JSON FINAL] technicalData.avgLoudness=${technicalData.avgLoudness}, technicalData.rms=${technicalData.rms}`);
```

**O que buscar:**
- `coreMetrics.rms.average=undefined` → Não foi calculado (CRÍTICO)
- `technicalData.avgLoudness=null` → safeSanitize rejeitou (PROBLEMA)
- `technicalData.avgLoudness=-13.0` → OK

---

## 🛠️ CORREÇÕES SUGERIDAS

### 🔧 CORREÇÃO #1: Remover Silêncio Artificial (1e-8)

**Arquivo:** `temporal-segmentation.js` linha 180-182

**ANTES:**
```javascript
if (isFinite(rmsValue) && rmsValue > 0) {
  rmsValues.push(rmsValue);
} else {
  rmsValues.push(1e-8);  // ⚠️ PROBLEMA
}
```

**DEPOIS:**
```javascript
// ✅ APENAS aceitar valores reais, não inventar silêncio
if (isFinite(rmsValue) && rmsValue > 1e-10) {  // Threshold mais realista
  rmsValues.push(rmsValue);
} else {
  // Para silêncio real, aceitar valores muito pequenos MAS reais
  // Se rmsValue calculado for 0, não inventar 1e-8
  if (rmsValue === 0 || !isFinite(rmsValue)) {
    rmsValues.push(1e-12);  // Silêncio real digital
  } else {
    rmsValues.push(rmsValue);  // Aceitar o valor calculado, mesmo que baixo
  }
}
```

---

### 🔧 CORREÇÃO #2: Adicionar Log de Validação em safeSanitize

**Arquivo:** `json-output.js` linha 113-128

**ADICIONAR:**
```javascript
function safeSanitize(value, fallback = null) {
  if (value === null || value === undefined) {
    console.log(`[SANITIZE] Valor null/undefined → fallback=${fallback}`);
    return fallback;
  }
  if (typeof value === 'number') {
    if (!isFinite(value) || isNaN(value)) {
      console.log(`[SANITIZE] Valor não-finito: ${value} → fallback=${fallback}`);
      return fallback;
    }
    // ✅ ACEITAR VALORES MUITO BAIXOS (-160 dB é válido para RMS)
    const sanitized = Math.round(value * 1000) / 1000;
    return sanitized;
  }
  // ... resto do código
}
```

---

### 🔧 CORREÇÃO #3: Proteger Contra Arrays Vazios

**Arquivo:** `core-metrics.js` linha 1242-1256

**ADICIONAR VALIDAÇÃO:**
```javascript
const validLeftFrames = leftFrames.filter(val => val > 0 && isFinite(val));
const validRightFrames = rightFrames.filter(val => val > 0 && isFinite(val));

// ✅ PROTEÇÃO: Se não houver frames válidos, usar valores brutos (sem filtro)
const useLeft = validLeftFrames.length > 0 ? validLeftFrames : leftFrames.filter(isFinite);
const useRight = validRightFrames.length > 0 ? validRightFrames : rightFrames.filter(isFinite);

if (useLeft.length === 0 || useRight.length === 0) {
  logAudio('core_metrics', 'rms_no_valid_frames_after_fallback', {
    originalLeft: leftFrames.length,
    originalRight: rightFrames.length,
    validLeft: validLeftFrames.length,
    validRight: validRightFrames.length
  });
  return { left: null, right: null, average: null, peak: null, count: framesRMS.count };
}

const leftRMS = this.calculateArrayAverage(useLeft);
const rightRMS = this.calculateArrayAverage(useRight);
```

---

## 📝 PRÓXIMOS PASSOS

### 1️⃣ EXECUTAR TESTE COM LOGS

```bash
cd work
node worker.js
```

Processar um áudio e capturar logs:
```bash
node worker.js > logs_rms_debug.txt 2>&1
```

### 2️⃣ ANALISAR LOGS

```bash
# Buscar padrão de falha
grep "DEBUG RMS" logs_rms_debug.txt
grep "DEBUG CORE" logs_rms_debug.txt
grep "DEBUG JSON" logs_rms_debug.txt
```

### 3️⃣ IDENTIFICAR PONTO EXATO DA FALHA

**Se logs mostrarem:**
- `rmsValue=0.000001` → PROBLEMA: Silêncio artificial
- `leftLength=0` → PROBLEMA: framesRMS vazio
- `average=null` → PROBLEMA: Processamento falhou
- `avgLoudness=null` → PROBLEMA: safeSanitize rejeitou

### 4️⃣ APLICAR CORREÇÃO ESPECÍFICA

Baseado no log, aplicar uma das correções sugeridas acima.

---

## 📊 CHECKLIST DE DIAGNÓSTICO

Ao analisar os logs, verificar:

- [ ] `[DEBUG RMS CALC]` mostra `rmsValue` realista (> 0.001)
- [ ] `[DEBUG RMS FINAL]` mostra arrays com tamanho > 0
- [ ] `[DEBUG CORE]` mostra `leftLength` e `rightLength` > 0
- [ ] `[DEBUG RMS RETURN]` mostra `average` entre -60 e -10 dB
- [ ] `[DEBUG JSON RMS]` mostra `coreMetrics.rms.average` numérico
- [ ] `[DEBUG JSON FINAL]` mostra `technicalData.avgLoudness` **NÃO NULL**

---

## 🎯 CONCLUSÃO

### ✅ CÓDIGO RMS ESTÁ INTACTO
Todas as 4 fases do pipeline possuem código funcional para RMS.

### ⚠️ PROBLEMA PROVÁVEL
Valores RMS sendo calculados como silêncio artificial (`1e-8`), convertidos para `-160 dB`, e sendo rejeitados como inválidos.

### 🛠️ SOLUÇÃO PROPOSTA
1. Remover lógica de `1e-8` para silêncio
2. Aceitar valores RMS reais, mesmo que muito baixos
3. Adicionar logs para capturar o ponto exato da falha
4. Validar que `safeSanitize` não está rejeitando `-120 dB`

### 📈 RESULTADO ESPERADO
Após aplicar logs e rodar teste, identificar **EXATAMENTE** onde `avgLoudness` vira `null`.

---

**AUDITORIA FINALIZADA - AGUARDANDO EXECUÇÃO DE TESTES COM LOGS**
