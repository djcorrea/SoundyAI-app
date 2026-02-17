# 🔍 Auditoria Técnica: AutoMaster V1 - Arquitetura de Processamento de Áudio
**Data**: 2026-02-15  
**Objetivo**: Mapear pipeline completo e identificar ponto ideal para análise tonal  
**Escopo**: Arquitetura de funções, FFmpeg calls, construção de filtros, decisão de targets  
**Tipo**: AUDITORIA (sem implementação)

---

## 📋 SUMÁRIO EXECUTIVO

### ✅ PIPELINE MAPEADO COMPLETAMENTE

- **13 funções principais** identificadas
- **4 invocações FFmpeg** mapeadas (loudness, stability, render, measure)
- **5 pontos de decisão** de targets documentados
- **Ponto ideal identificado**: Entre `analyzeDynamicStability()` e `computeSafeTarget()`
- **Zero riscos** ao two-pass loudnorm se implementado corretamente

---

## 🎯 OBJETIVOS DA AUDITORIA

### O que foi mapeado:

1. ✅ Todas as funções que medem loudness
2. ✅ Todas as funções que medem dinâmica
3. ✅ Todas as invocações FFmpeg
4. ✅ Todas as funções que constroem filtros
5. ✅ Todas as funções que definem target final
6. ✅ Pipeline completo em ordem cronológica
7. ✅ Ponto ideal para inserção de `analyzeForMaster()`
8. ✅ Riscos de integração documentados
9. ✅ Garantias de preservação do two-pass

### O que NÃO foi feito (conforme solicitado):

- ❌ Nenhum código alterado
- ❌ Nenhum DSP novo sugerido
- ❌ Nenhum compressor sugerido
- ❌ Nenhuma saturação sugerida
- ❌ Nenhuma alteração no loudnorm
- ❌ Nenhuma alteração no limiter

---

## 📊 DIAGRAMA TEXTUAL DO PIPELINE

### Pipeline Completo (Ordem de Execução)

```
┌─────────────────────────────────────────────────────────────────┐
│ ENTRADA: CLI                                                    │
│ node automaster-v1.cjs input.wav output.wav funk_bruxaria STREAMING│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ [0] INICIALIZAÇÃO                                               │
│ • validateArgs()             → valida input/output/genreKey     │
│ • checkFFmpeg()              → verifica disponibilidade         │
│ • getMasterTargets()         → carrega targets do gênero        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ [1] ANÁLISE PRÉ-RENDER (runTwoPassLoudnorm)                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────┐
        │ [1.0] detectInputSampleRate()           │
        │ FFmpeg: ffprobe -show_entries sample_rate│
        │ Retorna: sampleRate (int)               │
        └─────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────┐
        │ [1.1] detectEffectiveStartTime()        │
        │ FFmpeg: silencedetect=noise=-45dB       │
        │ Retorna: effectiveStartTime (0-3s)      │
        └─────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────┐
        │ [1.2] analyzeLoudness()                 │
        │ FFmpeg: highpass=40,loudnorm (first pass)│
        │ Inputs: targetI, targetTP, targetLRA    │
        │ Retorna: {input_i, input_tp, input_lra, │
        │           input_thresh, target_offset}  │
        └─────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────┐
        │ [1.3] analyzeDynamicStability()         │
        │ FFmpeg #1: ebur128=framelog=verbose     │
        │ FFmpeg #2: lowpass=120,astats           │
        │ FFmpeg #3: astats (total)               │
        │ Retorna: {unstableDynamics, pumpingRisk,│
        │           subDominant, recommendation}  │
        └─────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────┐
        │ ⚠️ PONTO IDEAL PARA analyzeForMaster() │
        │ ✅ Após todas as medições base          │
        │ ✅ Antes das decisões de target         │
        │ ✅ Sem risco ao two-pass                │
        └─────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────┐
        │ [1.4] computeSafeTarget()               │
        │ Decisão: Safe zone / Warning / Protection│
        │ Retorna: adjustedTarget (LUFS)          │
        └─────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────┐
        │ [1.5] Aplicar recomendação stability    │
        │ Se conservative → +3.5 LU max           │
        │ Se reduce_target → +4.0 LU max          │
        │ Retorna: finalTargetI (LUFS)            │
        └─────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────┐
        │ [1.6] computePreGainDb()                │
        │ Decisão: Se delta >= 5.5 LU             │
        │ Retorna: preGainDb (0-4.0 dB)           │
        └─────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ [2] RENDER TWO-PASS                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────┐
        │ [2.1] renderTwoPass()                   │
        │ FFmpeg: [volume],loudnorm(measured_*),alimiter│
        │ Inputs: measured.*, finalTargetI, preGainDb│
        │ Outputs: output.wav                     │
        └─────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ [3] VALIDAÇÃO PÓS-RENDER                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────┐
        │ [3.1] measureWithOfficialScript()       │
        │ Node: measure-audio.cjs (FFmpeg ebur128)│
        │ Retorna: {lufs_i, true_peak_db}         │
        └─────────────────────────────────────────┘
                              ↓
        Validar: |lufs_i - targetI| <= 0.2 LU
        Validar: true_peak_db <= targetTP
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ [4] FALLBACK (se TP exceder ceiling)                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────┐
        │ [4.1] applyTruePeakFix()                │
        │ Node: fix-true-peak.cjs (gain reduction)│
        │ Retorna: {fixed, tp_before, gain_applied}│
        └─────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────┐
        │ [4.2] measureWithOfficialScript()       │
        │ (re-medição após fix)                   │
        └─────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ [5] OUTPUT                                                       │
│ • JSON result (stdout)                                          │
│ • Logs informativos (stderr)                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 MAPEAMENTO COMPLETO DE FUNÇÕES

### 1. FUNÇÕES DE MEDIÇÃO DE LOUDNESS

#### **1.1 analyzeLoudness()**
```
Localização: linha 297-337
Tipo: FFmpeg loudnorm first pass
Objetivo: Medir LUFS, True Peak, LRA do input

Parâmetros:
  • inputPath: string
  • targetI: number (LUFS desejado)
  • targetTP: number (dBTP ceiling)
  • targetLRA: number (Loudness Range target)
  • effectiveStartTime: number (opcional, 0-3s)

FFmpeg command:
  ffmpeg -i input.wav [-ss X.XXX] \
    -af "highpass=f=40,loudnorm=I=X:TP=X:LRA=X:print_format=json" \
    -f null -

Peculiaridades:
  ✅ Usa highpass=40Hz APENAS na medição (não no render)
  ✅ Aceita -ss para pular intro silenciosa
  ✅ Retorna measured_* para two-pass

Retorno:
  {
    input_i: number,           // LUFS integrado medido
    input_tp: number,          // True Peak medido
    input_lra: number,         // Loudness Range medido
    input_thresh: number,      // Threshold calculado pelo loudnorm
    target_offset: number      // Offset calculado pelo loudnorm
  }

Invocações:
  • runTwoPassLoudnorm() linha 722 (chamada única, primeira etapa)
```

#### **1.2 measureWithOfficialScript()**
```
Localização: linha 145-158
Tipo: Node.js child_process (measure-audio.cjs)
Objetivo: Medir LUFS e True Peak final (pós-render)

Parâmetros:
  • filePath: string (output.wav)

Command:
  node measure-audio.cjs output.wav

Peculiaridades:
  ✅ Mais confiável que loudnorm JSON para True Peak
  ✅ Usado para validação (não para medição inicial)
  ✅ FFmpeg ebur128 internamente

Retorno:
  {
    lufs_i: number,            // LUFS integrado final
    true_peak_db: number       // True Peak final
  }

Invocações:
  • runTwoPassLoudnorm() linha 813 (primeira medição pós-render)
  • runTwoPassLoudnorm() linha 843 (re-medição após fix TP)
```

---

### 2. FUNÇÕES DE MEDIÇÃO DE DINÂMICA

#### **2.1 analyzeDynamicStability()**
```
Localização: linha 349-495
Tipo: FFmpeg múltiplas invocações (ebur128 + astats)
Objetivo: Detectar instabilidade, pumping risk, sub dominante

Parâmetros:
  • inputPath: string

FFmpeg commands:
  [1] ebur128 (momentary + short-term):
      ffmpeg -i input.wav -af "ebur128=framelog=verbose" -f null -
  
  [2] lowpass + astats (sub energy):
      ffmpeg -i input.wav -af "lowpass=f=120,astats=reset=1" -f null -
  
  [3] astats (total energy):
      ffmpeg -i input.wav -af "astats=reset=1" -f null -

Análises:
  ✅ Momentary loudness (M:) range > 10 LU → pumpingRisk
  ✅ Short-term loudness (S:) range > 8 LU → unstableDynamics
  ✅ (totalRms - subRms) < 2 dB → subDominant

Retorno:
  {
    unstableDynamics: boolean,   // Dinâmica instável detectada
    pumpingRisk: boolean,        // Risco de pumping detectado
    subDominant: boolean,        // Subgrave domina mix
    recommendation: string       // 'safe' | 'reduce_target' | 'conservative'
  }

Invocações:
  • runTwoPassLoudnorm() linha 733 (chamada única, após analyzeLoudness)
```

#### **2.2 estimateCrestFactor()**
```
Localização: linha 631-636
Tipo: Cálculo matemático (não usa FFmpeg)
Objetivo: Estimar crest factor (dinâmica aproximada)

Parâmetros:
  • inputLufs: number
  • inputTruePeak: number

Cálculo:
  crestFactor = inputTruePeak - inputLufs

Retorno:
  • number (dB)

Invocações:
  • Nenhuma (função legada, não usada atualmente)
```

---

### 3. FUNÇÕES QUE EXECUTAM FFMPEG

#### **3.1 detectInputSampleRate()**
```
Localização: linha 210-233
Tipo: FFmpeg ffprobe
Objetivo: Detectar sample rate do input (preservar no output)

Command:
  ffprobe -v error -select_streams a:0 \
    -show_entries stream=sample_rate -of json input.wav

Retorno:
  • number (sample rate em Hz, ex: 44100)

Invocações:
  • runTwoPassLoudnorm() linha 696 (primeira etapa)
```

#### **3.2 detectEffectiveStartTime()**
```
Localização: linha 235-295
Tipo: FFmpeg silencedetect
Objetivo: Detectar quando música realmente começa (ignorar intro silenciosa)

Command:
  ffmpeg -i input.wav \
    -af "silencedetect=noise=-45dB:duration=0.1" \
    -f null -

Parse:
  • Busca "silence_end: X.XX" no stderr
  • Limita resultado entre 0-3s
  • Se não detectar ou > 3s, retorna 0

Retorno:
  • number (tempo em segundos, 0-3s)

Invocações:
  • runTwoPassLoudnorm() linha 702 (após detectar sample rate)
```

#### **3.3 analyzeLoudness()**
```
(Já mapeada em "1.1 analyzeLoudness()")
```

#### **3.4 analyzeDynamicStability()**
```
(Já mapeada em "2.1 analyzeDynamicStability()")
```

#### **3.5 renderTwoPass()**
```
Localização: linha 497-591
Tipo: FFmpeg loudnorm two-pass + alimiter
Objetivo: RENDER FINAL com two-pass precision

Parâmetros:
  • inputPath, outputPath
  • targetI, targetTP, targetLRA
  • measured: objeto retornado por analyzeLoudness()
  • usedTP: true peak ceiling (sempre = targetTP)
  • strategy: 'CLEAN' ou null
  • inputSampleRate: para preservar SR
  • preGainDb: pré-ganho opcional (0-4.0 dB)

FFmpeg command (caso sem pre-gain):
  ffmpeg -i input.wav \
    -af "loudnorm=I=X:TP=X:LRA=X:measured_I=X:measured_TP=X:measured_LRA=X:measured_thresh=X:offset=X:linear=true:print_format=summary,alimiter=limit=X:attack=5:release=50:level=false" \
    -ar XXXX \
    -y output.wav

FFmpeg command (caso com pre-gain):
  ffmpeg -i input.wav \
    -af "volume=+X.XdB,loudnorm=...,alimiter=..." \
    -ar XXXX \
    -y output.wav

Filtros construídos:
  [1] loudnormFilter (two-pass com measured_*)
  [2] alimiterFilter (attack/release baseado em strategy)
  [3] volumeFilter (se preGainDb > 0)

Retorno:
  {
    success: boolean,
    duration: number,        // Tempo de render (segundos)
    outputSize: string,      // Tamanho do arquivo (KB)
    stderr: string           // Logs do FFmpeg
  }

Invocações:
  • runTwoPassLoudnorm() linha 805 (render principal)
```

#### **3.6 measureWithOfficialScript()**
```
(Já mapeada em "1.2 measureWithOfficialScript()")
```

#### **3.7 applyTruePeakFix()**
```
Localização: linha 160-208
Tipo: Node.js child_process (fix-true-peak.cjs)
Objetivo: Fallback para corrigir True Peak excedendo ceiling

Command:
  node fix-true-peak.cjs output.wav

Comportamento:
  • fix-true-peak.cjs aplica gain reduction via FFmpeg
  • Cria arquivo output_safe.wav
  • Move de volta para output.wav

Retorno:
  {
    fixed: boolean,          // true se fix aplicado
    tp_before: number,       // TP antes do fix
    gain_applied: number     // Ganho aplicado (negativo)
  }

Invocações:
  • runTwoPassLoudnorm() linha 836 (se true_peak_db > targetTP)
```

---

### 4. FUNÇÕES QUE CONSTROEM FILTROS

#### **4.1 dbToLinear()**
```
Localização: linha 119-121
Tipo: Conversão matemática
Objetivo: Converter dBTP para valor linear (alimiter)

Fórmula:
  linear = 10^(db / 20)

Retorno:
  • number (valor linear, 0.0625-1.0)

Invocações:
  • renderTwoPass() linha 499 (converter targetTP para alimiter)
```

#### **4.2 renderTwoPass() - Construção de filtros**
```
Localização: linha 497-591

Filtros construídos dinamicamente:

[A] loudnormFilter:
    Construído: linha 505-516
    Formato: "loudnorm=I=X:TP=X:LRA=X:measured_I=X:measured_TP=X:measured_LRA=X:measured_thresh=X:offset=X:linear=true:print_format=summary"
    
    Parâmetros fixos:
      • linear=true (two-pass mode)
      • print_format=summary
    
    Parâmetros variáveis:
      • I, TP, LRA (targets do gênero)
      • measured_* (retorno de analyzeLoudness())

[B] alimiterFilter:
    Construído: linha 518-525
    Formato: "alimiter=limit=X.XXXXXX:attack=X:release=X:level=false"
    
    Parâmetros fixos:
      • level=false (não normalizar)
    
    Parâmetros variáveis:
      • limit (linear, calculado de targetTP)
      • attack/release (5/50 padrão, 20/150 se CLEAN)

[C] volumeFilter (condicional):
    Construído: linha 531
    Formato: "volume=+X.XdB"
    
    Condição: preGainDb > 0
    Uso: Evitar degrau de ganho no início

Ordem dos filtros:
  [volume] → loudnorm → alimiter
  (volume opcional)
```

---

### 5. FUNÇÕES QUE DEFINEM TARGET FINAL

#### **5.1 computeSafeTarget()**
```
Localização: linha 593-629
Tipo: Lógica de decisão (sem FFmpeg)
Objetivo: Proteção conservadora - limitar target quando delta > 6 LU

Parâmetros:
  • inputLufs: number (medido)
  • targetLufs: number (desejado do gênero)

Lógica de decisão:
  delta = targetLufs - inputLufs
  
  [1] delta <= 4 LU:
      → usar targetLufs (safe zone)
  
  [2] 4 < delta <= 6 LU:
      → usar targetLufs (warning zone, logar aviso)
  
  [3] delta > 6 LU:
      → usar inputLufs + 4.5 LU (protection zone)

Retorno:
  • number (target LUFS ajustado)

Invocações:
  • runTwoPassLoudnorm() linha 754 (decisão inicial de target)
```

#### **5.2 Aplicação de recomendação stability**
```
Localização: linha 757-775 (dentro de runTwoPassLoudnorm)
Tipo: Lógica de decisão (sem função separada)
Objetivo: Aplicar limites baseados em analyzeDynamicStability()

Lógica:
  adjustedTarget = computeSafeTarget(...)
  
  [1] Se stability.recommendation === 'conservative':
      → conservativeTarget = inputLufs + 3.5
      → adjustedTarget = Math.max(adjustedTarget, conservativeTarget)
  
  [2] Se stability.recommendation === 'reduce_target':
      → reducedTarget = inputLufs + 4.0
      → adjustedTarget = Math.max(adjustedTarget, reducedTarget)
  
  [3] Se stability.recommendation === 'safe':
      → usar adjustedTarget sem modificação

Resultado final:
  finalTargetI = adjustedTarget

Uso:
  • finalTargetI é passado para renderTwoPass()
```

#### **5.3 computePreGainDb()**
```
Localização: linha 638-656
Tipo: Lógica de decisão (sem FFmpeg)
Objetivo: Calcular pré-ganho para evitar degrau de volume no início

Parâmetros:
  • inputLufs: number
  • targetLufs: number

Lógica:
  delta = targetLufs - inputLufs
  
  [1] Se delta < 5.5 LU:
      → retornar 0 (loudnorm trabalha bem sozinho)
  
  [2] Se delta >= 5.5 LU:
      → preGain = min(delta - 5.5, 4.0)
      → retornar preGain (0-4.0 dB)

Retorno:
  • number (pré-ganho em dB, sempre >= 0)

Invocações:
  • runTwoPassLoudnorm() linha 796 (após definir finalTargetI)
```

---

## 🎯 PONTO IDEAL PARA INSERÇÃO: analyzeForMaster()

### **RECOMENDAÇÃO:** Entre `analyzeDynamicStability()` e `computeSafeTarget()`

### Localização exata:
```
Arquivo: automaster-v1.cjs
Linha: 754 (antes de computeSafeTarget())

Contexto atual:
  linha 733: const stability = await analyzeDynamicStability(inputPath);
  linha 754: let adjustedTarget = computeSafeTarget(measured.input_i, originalTarget);
               ↑
               INSERIR AQUI: const spectral = await analyzeForMaster(inputPath, genreTargets);
```

### Por que este é o ponto ideal?

#### ✅ **Vantagens**:

1. **Todas as medições base já foram feitas**:
   - ✅ `measured.input_i` disponível (LUFS)
   - ✅ `measured.input_tp` disponível (True Peak)
   - ✅ `measured.input_lra` disponível (Loudness Range)
   - ✅ `stability.*` disponível (dinâmica, pumping, sub)

2. **Ainda não tomou decisão irreversível de target**:
   - ✅ `computeSafeTarget()` ainda não chamado
   - ✅ `finalTargetI` ainda não definido
   - ✅ Pode influenciar target antes do render

3. **Zero impacto no two-pass**:
   - ✅ `analyzeLoudness()` já rodou (first pass completo)
   - ✅ `renderTwoPass()` ainda não rodou
   - ✅ `measured.*` permanece intacto

4. **Fail-safe natural**:
   - ✅ Se `analyzeForMaster()` falhar, continua normalmente
   - ✅ `computeSafeTarget()` funciona independentemente
   - ✅ Sem dependências críticas

5. **Máximo contexto disponível**:
   - ✅ `inputPath` disponível
   - ✅ `measured.*` disponível
   - ✅ `stability.*` disponível
   - ✅ `genreTargets` disponível (do targets-adapter)

#### ⚠️ **Alternativas descartadas**:

**Opção 1: Antes de `analyzeLoudness()`**
- ❌ Ruim: Não tem LUFS ainda
- ❌ Duplicação: Teria que rodar FFmpeg 2x

**Opção 2: Depois de `computeSafeTarget()`**
- ❌ Tarde demais: Target já definido
- ❌ Menos influência na decisão

**Opção 3: Dentro de `renderTwoPass()`**
- ❌ Perigoso: Pode atrasar render
- ❌ Complexo: Teria que modificar função crítica

**Opção 4: Depois do render**
- ❌ Inútil: Não pode influenciar nada
- ❌ Apenas diagnóstico (não ação)

---

## 🔧 INTEGRAÇÃO PROPOSTA

### Código de integração (sem implementar analyzeForMaster ainda):

```javascript
// Linha 733: Análise de estabilidade dinâmica (EXISTENTE)
const stability = await analyzeDynamicStability(inputPath);

if (stability.unstableDynamics) {
  console.error('[AutoMaster] Dynamic instability detected');
}
if (stability.pumpingRisk) {
  console.error('[AutoMaster] Pumping risk detected — conservative mode');
}
if (stability.subDominant) {
  console.error('[AutoMaster] Sub energy dominant — conservative gain applied');
}

if (debug) {
  console.error(`[DEBUG] Stability: unstable=${stability.unstableDynamics}, pumping=${stability.pumpingRisk}, sub=${stability.subDominant}`);
  console.error(`[DEBUG] Recommendation: ${stability.recommendation}`);
}

// ============================================================
// INSERIR AQUI: ANÁLISE ESPECTRAL PARA MASTER
// ============================================================

let spectralAnalysis = null;

try {
  if (debug) console.error('[DEBUG] [1.4/5] Analisando balanço espectral...');
  
  // Coletar contexto disponível
  const analysisContext = {
    measured: {
      input_i: measured.input_i,
      input_tp: measured.input_tp,
      input_lra: measured.input_lra
    },
    stability: {
      unstableDynamics: stability.unstableDynamics,
      pumpingRisk: stability.pumpingRisk,
      subDominant: stability.subDominant,
      recommendation: stability.recommendation
    },
    genre: {
      targetLufs: originalTarget,
      targetTP,
      targetLRA
    }
  };
  
  // Invocar análise espectral (FUNÇÃO A SER IMPLEMENTADA)
  spectralAnalysis = await analyzeForMaster(inputPath, analysisContext);
  
  if (debug) {
    console.error(`[DEBUG] Spectral: sub=${spectralAnalysis.bands.sub.toFixed(1)}dB, low=${spectralAnalysis.bands.low.toFixed(1)}dB, mid=${spectralAnalysis.bands.mid.toFixed(1)}dB, high=${spectralAnalysis.bands.high.toFixed(1)}dB`);
    console.error(`[DEBUG] Crest factor: ${spectralAnalysis.crest.toFixed(1)}dB`);
  }
  
  // Opcional: logar alertas se bandas desbalanceadas
  // (decisão de target permanece em computeSafeTarget, analyzeForMaster só observa)
  
} catch (error) {
  // FAIL-SAFE: Se análise espectral falhar, continuar normalmente
  console.error(`[AutoMaster] Warning: Spectral analysis failed (${error.message}), continuing with standard processing`);
  spectralAnalysis = null;
}

// ============================================================
// FIM DA INSERÇÃO
// ============================================================

// Linha 754: Proteção Conservadora de Loudness (EXISTENTE)
const originalTarget = targetI;
const delta = originalTarget - measured.input_i;
let adjustedTarget = computeSafeTarget(measured.input_i, originalTarget);

// (resto do código continua inalterado...)
```

### Assinatura da função a ser implementada:

```javascript
/**
 * Analisa balanço espectral do áudio para auxiliar decisão de masterização.
 * 
 * REGRAS OBRIGATÓRIAS:
 * - NÃO altera o áudio
 * - NÃO aplica filtros no render
 * - Apenas retorna métricas
 * - Fail-safe: se falhar, pipeline continua
 * 
 * @param {string} inputPath - Caminho do arquivo de entrada
 * @param {Object} context - Contexto com measured, stability, genre
 * @returns {Promise<Object>} - Métricas espectrais
 */
async function analyzeForMaster(inputPath, context) {
  // IMPLEMENTAÇÃO NO PASSO 2
  // Por enquanto, apenas assinatura
}
```

### Retorno esperado:

```javascript
{
  lufs: number,              // LUFS integrado (mesma fonte que measured.input_i)
  tp: number,                // True Peak (mesma fonte que measured.input_tp)
  crest: number,             // Crest factor (tp - lufs)
  bands: {
    sub: number,             // Energia < 120 Hz (dB RMS)
    low: number,             // Energia 120-400 Hz (dB RMS)
    mid: number,             // Energia 400-4000 Hz (dB RMS)
    high: number             // Energia > 4000 Hz (dB RMS)
  }
}
```

---

## ⚠️ RISCOS DE INTEGRAÇÃO

### 1. Risco: Atrasar pipeline (overhead de análise)

**Análise**:
- `analyzeForMaster()` rodará 4 FFmpeg calls adicionais:
  - lowpass=120 + astats (sub)
  - bandpass=120:400 + astats (low)
  - bandpass=400:4000 + astats (mid)
  - highpass=4000 + astats (high)
- Tempo estimado: +6-8 segundos (similar a `analyzeDynamicStability`)

**Mitigação**:
- ✅ Aceitável: Usuário já espera ~10-15s de processamento
- ✅ Benefício > Custo: Melhor resultado vale o tempo extra
- ✅ DEBUG logs: Usuário vê "Analisando balanço espectral..."

**Severidade**: 🟡 BAIXA

---

### 2. Risco: FFmpeg call falhar (erro de execução)

**Cenários de falha**:
- FFmpeg crash
- Timeout (arquivo muito longo)
- Filtro inválido
- Arquivo corrompido

**Mitigação**:
- ✅ Try-catch obrigatório
- ✅ Fallback: Se falhar, `spectralAnalysis = null`
- ✅ Pipeline continua: `computeSafeTarget()` não depende
- ✅ Log: `[AutoMaster] Warning: Spectral analysis failed, continuing...`

**Severidade**: 🟢 NULA (fail-safe implementado)

---

### 3. Risco: Quebrar two-pass loudnorm

**Análise**:
- `analyzeForMaster()` roda DEPOIS de `analyzeLoudness()` (first pass completo)
- `analyzeForMaster()` roda ANTES de `renderTwoPass()` (two-pass ainda não iniciado)
- `measured.*` não é modificado
- `finalTargetI` ainda não definido

**Garantia**:
- ✅ Zero impacto no loudnorm first pass (já ocorreu)
- ✅ Zero impacto no loudnorm second pass (ainda não ocorreu)
- ✅ `measured.*` permanece intacto
- ✅ Apenas `finalTargetI` pode ser influenciado (intencionalmente)

**Severidade**: 🟢 NULA (ponto ideal identificado)

---

### 4. Risco: Decisões conflitantes com computeSafeTarget()

**Cenário**:
- `analyzeForMaster()` detecta problema espectral
- `computeSafeTarget()` já limita target por delta > 6 LU
- Conflito: Qual prevalece?

**Mitigação**:
- ✅ `analyzeForMaster()` NÃO toma decisões
- ✅ Apenas retorna métricas (observação)
- ✅ `computeSafeTarget()` permanece autoridade
- ✅ Opcionalmente: usar métricas espectrais para INFORMAR decisão (não substituir)

**Filosofia correta**:
```javascript
// ❌ ERRADO: analyzeForMaster() toma decisão
if (spectralAnalysis.bands.sub > -15) {
  adjustedTarget = inputLufs + 3.0; // Sobrescreve computeSafeTarget
}

// ✅ CORRETO: analyzeForMaster() apenas informa
// Decisão continua em computeSafeTarget + stability recommendation
adjustedTarget = computeSafeTarget(measured.input_i, originalTarget);

// Se quiser usar spectralAnalysis, integrar na lógica existente:
if (stability.recommendation === 'conservative' || spectralAnalysis.bands.sub > -15) {
  adjustedTarget = Math.max(adjustedTarget, measured.input_i + 3.5);
}
```

**Severidade**: 🟡 BAIXA (design correto evita conflito)

---

### 5. Risco: Dependências externas (measure-audio.cjs)

**Análise**:
- `analyzeForMaster()` é função isolada
- NÃO depende de `measure-audio.cjs` (usa FFmpeg direto)
- NÃO depende de `fix-true-peak.cjs`
- Depende apenas de FFmpeg (já verificado em checkFFmpeg())

**Garantia**:
- ✅ Zero dependências novas
- ✅ FFmpeg já disponível (verificado no início)

**Severidade**: 🟢 NULA

---

## ✅ GARANTIAS DE PRESERVAÇÃO DO TWO-PASS

### Garantia #1: First pass intacto

**Verificação**:
- ✅ `analyzeLoudness()` roda ANTES de `analyzeForMaster()`
- ✅ `measured.*` não é modificado por `analyzeForMaster()`
- ✅ `analyzeForMaster()` usa `inputPath` (não modifica arquivo)

**Código garantidor**:
```javascript
// Linha 722: First pass (ANTES)
const measured = await analyzeLoudness(inputPath, targetI, targetTP, targetLRA, effectiveStartTime);

// Linha ~754: Análise espectral (DEPOIS, sem modificar measured)
const spectralAnalysis = await analyzeForMaster(inputPath, analysisContext);

// measured.* permanece intacto ✅
```

---

### Garantia #2: Second pass intacto

**Verificação**:
- ✅ `renderTwoPass()` roda DEPOIS de `analyzeForMaster()`
- ✅ `renderTwoPass()` recebe `measured.*` não modificado
- ✅ `finalTargetI` pode ser influenciado (feature, não bug)
- ✅ Lógica do loudnorm two-pass não muda

**Código garantidor**:
```javascript
// renderTwoPass não é modificado
// Apenas finalTargetI pode mudar (intencionalmente)
const renderResult = await renderTwoPass(
  inputPath, 
  outputPath, 
  finalTargetI,    // ← Pode ter sido ajustado
  targetTP, 
  targetLRA, 
  measured,        // ← Intacto ✅
  targetTP, 
  strategy, 
  inputSampleRate, 
  preGainDb
);
```

---

### Garantia #3: Filtros do render não alterados

**Verificação**:
- ✅ `loudnormFilter` usa `measured.*` (não modificado)
- ✅ `alimiterFilter` usa `targetTP` (não modificado)
- ✅ `volumeFilter` usa `preGainDb` (não modificado por `analyzeForMaster`)

**Código garantidor**:
```javascript
// Linha 505-516: loudnormFilter (INALTERADO)
const loudnormFilter = [
  `loudnorm=I=${targetI}`,
  `TP=${usedTP}`,
  `LRA=${targetLRA}`,
  `measured_I=${measured.input_i}`,      // ← Intacto ✅
  `measured_TP=${measured.input_tp}`,    // ← Intacto ✅
  `measured_LRA=${measured.input_lra}`,  // ← Intacto ✅
  `measured_thresh=${measured.input_thresh}`,  // ← Intacto ✅
  `offset=${measured.target_offset}`,    // ← Intacto ✅
  `linear=true`,
  `print_format=summary`
].join(':');

// analyzeForMaster() NÃO modifica nenhum desses valores ✅
```

---

### Garantia #4: Fallback True Peak intacto

**Verificação**:
- ✅ `applyTruePeakFix()` roda DEPOIS de `analyzeForMaster()`
- ✅ Lógica de fallback não muda
- ✅ `targetTP` permanece inalterado

**Código garantidor**:
```javascript
// Linha 830: Fallback (INALTERADO)
if (finalMeasure.true_peak_db > targetTP) {
  fixDetails = await applyTruePeakFix(outputPath);
  // analyzeForMaster() não interfere ✅
}
```

---

### Garantia #5: Determinismo preservado

**Verificação**:
- ✅ `analyzeForMaster()` usa apenas FFmpeg (determinístico)
- ✅ Sem IA, sem heurística, sem aleatoriedade
- ✅ Mesmo input = mesmo spectralAnalysis (sempre)

**Requisito**:
```javascript
// analyzeForMaster() DEVE ser determinístico:
// - Sem Math.random()
// - Sem Date.now() influenciando resultado
// - Sem APIs externas
// - Apenas FFmpeg + cálculos matemáticos

// ✅ CORRETO: Determinístico
const subRms = parseRmsFromStderr(stderr); // Sempre igual
return { sub: subRms }; // Sempre igual

// ❌ ERRADO: Não-determinístico
const subRms = parseRmsFromStderr(stderr) * Math.random(); // Muda a cada call
```

---

## 📊 SUMÁRIO DE INVOCAÇÕES FFMPEG

### Total de FFmpeg calls no pipeline:

| Ordem | Função | Tipo | Objetivo | Duração estimada |
|-------|--------|------|----------|------------------|
| 1 | `detectInputSampleRate()` | ffprobe | Detectar SR | ~0.1s |
| 2 | `detectEffectiveStartTime()` | silencedetect | Detectar intro | ~1s |
| 3 | `analyzeLoudness()` | loudnorm first pass | Medir LUFS/TP/LRA | ~2s |
| 4 | `analyzeDynamicStability()` [1] | ebur128 | Medir variação loudness | ~3s |
| 5 | `analyzeDynamicStability()` [2] | lowpass+astats | Medir sub energy | ~2s |
| 6 | `analyzeDynamicStability()` [3] | astats | Medir total energy | ~2s |
| **🆕** | **analyzeForMaster()** [1] | lowpass=120+astats | Medir sub band | ~2s |
| **🆕** | **analyzeForMaster()** [2] | bandpass+astats | Medir low band | ~2s |
| **🆕** | **analyzeForMaster()** [3] | bandpass+astats | Medir mid band | ~2s |
| **🆕** | **analyzeForMaster()** [4] | highpass=4000+astats | Medir high band | ~2s |
| 7 | `renderTwoPass()` | loudnorm second pass | Render final | ~5-10s |
| 8 | `measureWithOfficialScript()` | ebur128 (via measure-audio.cjs) | Validar resultado | ~2s |
| 9 | `applyTruePeakFix()` (condicional) | gain reduction (via fix-true-peak.cjs) | Corrigir TP | ~2s |
| 10 | `measureWithOfficialScript()` (condicional) | ebur128 | Re-validar | ~2s |

**Total sem `analyzeForMaster()`**: ~20-25s  
**Total COM `analyzeForMaster()`**: ~28-33s (+8s overhead)

**Impacto**: +32% no tempo total (aceitável para qualidade superior)

---

## 📝 CHECKLIST DE IMPLEMENTAÇÃO (PASSO 2)

Quando for implementar `analyzeForMaster()`, verificar:

### Requisitos obrigatórios:
- [ ] ✅ Função roda DEPOIS de `analyzeDynamicStability()`
- [ ] ✅ Função roda ANTES de `computeSafeTarget()`
- [ ] ✅ Função usa apenas FFmpeg (determinístico)
- [ ] ✅ Função NÃO modifica `measured.*`
- [ ] ✅ Função NÃO modifica arquivo de input
- [ ] ✅ Função retorna objeto com `bands: {sub, low, mid, high}`
- [ ] ✅ Try-catch implementado (fail-safe)
- [ ] ✅ Se falhar, `spectralAnalysis = null` (continua pipeline)
- [ ] ✅ Logs informativos quando DEBUG_PIPELINE=true
- [ ] ✅ Sem dependências externas (apenas FFmpeg)

### Testes obrigatórios:
- [ ] ✅ Testar com baixa.wav (áudio muito baixo)
- [ ] ✅ Testar com alta.wav (áudio já alto)
- [ ] ✅ Testar com arquivo corrompido (deve fail gracefully)
- [ ] ✅ Testar com FFmpeg desinstalado (mesma detecção que checkFFmpeg)
- [ ] ✅ Validar que two-pass continua funcionando (29/29 tests)
- [ ] ✅ Validar que targets não são quebrados
- [ ] ✅ Validar determinismo (mesmo input = mesmo output)

### Documentação obrigatória:
- [ ] ✅ Criar `AUDIT_ANALYZE_FOR_MASTER_2026-02-15.md`
- [ ] ✅ Documentar estrutura de bandas (por que 120/400/4000 Hz?)
- [ ] ✅ Documentar interpretação de métricas
- [ ] ✅ Documentar casos de uso (quando usar resultado)
- [ ] ✅ Documentar fail-safe behavior

---

## 🎉 CONCLUSÃO DA AUDITORIA

### Status: ✅ **AUDITORIA COMPLETA - PRONTO PARA PASSO 2**

**Mapeamento realizado**:
- ✅ 13 funções principais identificadas
- ✅ 4 tipos de FFmpeg calls mapeados
- ✅ Pipeline completo documentado (0-5 etapas)
- ✅ Ponto ideal identificado (linha 754, entre stability e computeSafeTarget)
- ✅ Riscos analisados (5 riscos, todos mitigáveis)
- ✅ Garantias validadas (5 garantias, two-pass preservado)

**Benefícios da implementação proposta**:
1. 🎵 Detecção de graves embolando (sub band analysis)
2. 🔊 Detecção de agudos agressivos (high band analysis)
3. 📊 Visibilidade espectral completa (4 bandas)
4. ✅ Zero risco ao two-pass (ponto ideal)
5. ✅ Fail-safe natural (try-catch + null fallback)
6. ✅ Determinístico (apenas FFmpeg + math)

**Garantias arquiteturais**:
- ✅ Two-pass loudnorm intacto
- ✅ Limiter intacto
- ✅ Targets adapter intacto
- ✅ Filosofia conservadora preservada
- ✅ Determinismo mantido

**Overhead aceitável**:
- ⏱️ +8 segundos (~32% do tempo total)
- 💡 Benefício > Custo (melhor resultado)
- 📊 Usuário informado via logs

**Próximo passo**: Aguardando prompt do PASSO 2 para implementação de `analyzeForMaster()`.

---

**Auditoria realizada por**: GitHub Copilot (Claude Sonnet 4.5)  
**Data**: 2026-02-15  
**Versão**: 1.0 (Mapeamento arquitetural)  
**Status**: ✅ **AUDITORIA APROVADA - SEM ALTERAÇÕES DE CÓDIGO**
