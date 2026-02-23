# AutoMaster V1 - Auditoria Técnica Completa

**Data:** 22 de fevereiro de 2026  
**Versão:** 1.0  
**Status:** Documentação de sistema em produção  

---

## 1. VISÃO GERAL DO SISTEMA

### 1.1 Objetivo

O AutoMaster V1 é um sistema de masterização automática baseado em análise de métricas técnicas reais do áudio. Seu objetivo é aumentar loudness de forma segura e previsível, sem comprometer qualidade ou dinâmica excessivamente.

### 1.2 Princípios Fundamentais

**Determinístico:**  
- Mesma entrada gera sempre a mesma saída
- Sem randomização ou IA não-determinística
- Decisões baseadas em regras matemáticas fixas

**Conservador:**  
- Prioriza qualidade sobre loudness máxima
- Nunca reduz LUFS (regra absoluta)
- Múltiplas camadas de proteção contra over-processing

**Previsível:**  
- Comportamento documentado e auditável
- Guardrails explícitos por modo
- Validação rigorosa de saída

### 1.3 Arquitetura Geral

```
Input Audio (WAV)
    ↓
┌───────────────────────────────────────┐
│   ANÁLISE DE MÉTRICAS                 │
│   - LUFS, True Peak, Crest Factor     │
│   - RMS, Sub-bass energy              │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│   MOTOR DE DECISÃO                    │
│   - Calcula target LUFS               │
│   - Aplica guardrails                 │
│   - Define estratégia                 │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│   PROCESSAMENTO DSP                   │
│   ┌─────────────────────────────────┐ │
│   │ LOW/STREAMING: Loudnorm 2-pass  │ │
│   │ HIGH: Limiter iterativo         │ │
│   └─────────────────────────────────┘ │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│   VALIDAÇÃO FINAL                     │
│   - LUFS tolerance: ±0.2 LU           │
│   - TP tolerance: +0.05 dB            │
│   - Retry logic (LOW/STREAMING)       │
└───────────────────────────────────────┘
    ↓
Output Audio (WAV)
```

---

## 2. FLUXO COMPLETO DO PROCESSAMENTO

### 2.1 Entrada do Áudio

**Validação:**
- Formato: WAV obrigatório
- Verificação de existência de arquivo
- Validação de modo (LOW, STREAMING, HIGH)
- Ceiling fixo: -1.0 dBTP

**Parâmetros aceitos:**
```bash
node automaster-v1.cjs <input.wav> <output.wav> <MODE>
```

### 2.2 Análise de Métricas (analyzeAudioMetrics)

**Métricas extraídas:**
- **LUFS (I):** Loudness integrado
- **True Peak (dBTP):** Pico digital real
- **Crest Factor (dB):** Diferença entre pico e RMS
- **RMS (dB):** Root Mean Square
- **Sub-bass energy:** Energia 20-80 Hz

**Método de análise:**
- Usa FFmpeg `loudnorm` first-pass
- Análise espectral FFmpeg `astats`
- Crest factor calculado: `peak_db - rms_db`
- Validação de sanidade em todas as métricas

**Fallbacks:**
- Crest Factor inválido → 12 dB (conservador)
- RMS ausente → LUFS - 3 dB
- Qualquer métrica fora de range → valor seguro

### 2.3 Motor de Decisão (decideGainWithinRange)

#### 2.3.1 Cálculo de Headroom Efetivo

```javascript
headroom = Math.abs(truePeak)  // Se TP = -1.5, headroom = 1.5 dB

limiterStressPermitido = {
  LOW: 2.0 dB,
  MEDIUM: 4.0 dB,
  HIGH: 6.0 dB
}

effectiveHeadroom = headroom + limiterStressPermitido
```

**Conceito:** O sistema reconhece que o limiter pode comprimir de forma controlada, então o headroom efetivo inclui margem para compressão aceitável.

#### 2.3.2 Regra Crítica Absoluta

```
SE targetLUFS < currentLUFS ENTÃO
  targetLUFS = currentLUFS  // Nunca reduz
  gainDB = 0
FIM
```

#### 2.3.3 Estratégias por Faixa de LUFS

**STREAMING Mode (target fixo):**
- Target: -14.0 LUFS (invariável)
- Ignora dinâmica, métrica e headroom
- Padrão broadcast/streaming

**LOW, MEDIUM, HIGH (dinâmico):**

**Faixa 1: Áudio muito baixo (< -50 LUFS)**
- Estratégia: Ganho máximo permitido pelo modo
- Objetivo: Recuperar sinais extremamente baixos

**Faixa 2: Áudio baixo (-50 a -25 LUFS)**
- Estratégia: Aumento agressivo mas controlado
- Usa effectiveHeadroom × multiplicador do modo

**Faixa 3: Áudio normal (-25 a -15 LUFS)**
- Estratégia: Balanceamento entre loudness e qualidade
- Usa cálculo dinâmico baseado em CF e headroom

**Faixa 4: Áudio alto (-15 a -8 LUFS)**
- Estratégia: Ajustes conservadores
- Incrementos pequenos (0.5-1.5 LU)

**Faixa 5: Áudio muito alto (> -8 LUFS)**
- Estratégia: Apenas correção mínima ou nenhuma
- Preserva caráter original

#### 2.3.4 Guardrails do Motor

**1. Headroom Crítico (<0.8 dB):**
```
shouldProcess = false
reason = "Headroom insuficiente"
```

**2. Ganho Imperceptível (<0.3 dB):**
```
shouldProcess = false
reason = "Mudança imperceptível"
```

**3. Limiter Stress Excessivo:**
```javascript
stressEstimate = gainNeeded - headroom
SE stressEstimate > MAX_LIMITER_STRESS[mode] ENTÃO
  Reduzir offset para caber no limite
FIM
```

**Limites de stress:**
- LOW: 1.5 dB
- MEDIUM: 3.0 dB
- HIGH: 4.5 dB
- HIGH_EXTENDED: 5.2 dB (CF > 12, headroom > 3)

**4. Ganho Máximo por Modo:**
- STREAMING: 20.0 dB
- LOW: 3.0 dB
- MEDIUM: 5.0 dB
- HIGH: 7.0 dB

#### 2.3.5 Global Caps (applyGlobalCaps)

**Camada final de segurança** aplicada após motor de decisão:

**Cap 1: Delta LUFS máximo**
- LOW: +7 LU
- MEDIUM: +9 LU
- HIGH: +13 LU
- STREAMING: +20 LU (sem limite prático)

**Cap 2: Offset relativo ao input**
```javascript
SE deltaLUFS > MAX_DELTA_BY_MODE[mode] ENTÃO
  targetLUFS = inputLUFS + MAX_DELTA_BY_MODE[mode]
  capped = true
FIM
```

**Cap 3: True Peak final**
```javascript
SE targetLUFS resultar em TP > -1.0 dBTP ENTÃO
  Reduzir target até TP <= -1.0 dBTP
FIM
```

### 2.4 Definição de Target

**Saída do motor de decisão:**
```javascript
{
  targetLUFS: -12.5,          // Target calculado
  gainDB: 5.2,                // Ganho necessário
  shouldProcess: true,        // Se deve processar
  reason: "...",              // Justificativa
  safe: true,                 // Se é seguro
  limiterStressEstimate: 3.1, // Stress do limiter
  confidenceScore: 0.85,      // Confiança (0-1)
  confidenceLabel: "HIGH"     // Label de confiança
}
```

**Target Lock:**
- Target é **locked** após motor de decisão
- Não pode ser recalculado no pipeline DSP
- Flag: `targetLockedByDecisionEngine = true`

### 2.5 Pipeline DSP por Modo

#### 2.5.1 Modo LOW/STREAMING - Loudnorm Two-Pass

**Filosofia:** UsaFFmpeg loudnorm two-pass para normalização precisa.

**Pipeline:**
```
Input
  ↓
[ETAPA 1] EQ + PreGain → Arquivo temporário (referência linear)
  ↓
[MEDIÇÃO] LUFS pré-limiter (reference_lufs_pre_limiter)
  ↓
[ETAPA 2] EQ + PreGain + Pre-limiter → Arquivo para loudnorm
  ↓
[PRE-LOUDNORM CEILING] TP > -2 dBTP? → Trim negativo
  ↓
[LOUDNORM FIRST-PASS] Análise de métricas
  ↓
[LOUDNORM SECOND-PASS] Render com measured_*
  ↓
[VALIDAÇÃO] LUFS ±0.2 LU, TP +0.05 dB
  ↓
[FALLBACK TP] Se TP > ceiling → fix-true-peak.cjs
  ↓
Output
```

**Componentes:**

**EQ Defensivo (se presente):**
- Atenuação de sub-grave excessivo
- Controle de harshness em altas

**Pre-Gain:**
- Aplicado antes de qualquer processamento
- Calculado pelo motor de decisão

**Pre-Limiter:**
- Limiter suave antes do loudnorm
- Evita que loudnorm receba picos extremos

**Ceiling Trim:**
- Se TP > -2 dBTP antes do loudnorm
- Aplica trim negativo com filtro `volume`
- Objetivo: Evitar inflação de envelope

**Loudnorm Two-Pass:**
```bash
# First-pass (análise)
ffmpeg -i input.wav -af loudnorm=print_format=json

# Second-pass (render)
ffmpeg -i input.wav -af loudnorm=
  measured_I=${measured_I}:
  measured_TP=${measured_TP}:
  measured_LRA=${measured_LRA}:
  measured_thresh=${measured_thresh}:
  offset=${offset}:
  linear=true:
  I=${targetLUFS}:
  TP=${ceiling}:
  LRA=${LRA_preservado}
```

#### 2.5.2 Modo HIGH - Limiter Iterativo

**Filosofia:** Bypass loudnorm, usa limiter direto com convergência iterativa.

**Pipeline:**
```
Input (com EQ + PreGain já aplicados)
  ↓
[STEP 0] Macro Dynamics Stabilizer
  → Compressor wideband (ratio 1.5:1)
  → Threshold: RMS + 1.5 dB
  → Attack: 30ms, Release: 180ms
  → Goal: Estabilizar volume jump quando bass entra
  ↓
[Base File Estabilizado] (não muda mais)
  ↓
[STEP 1] Calcular ganho inicial
  → preGainDB = targetLUFS - baseLUFS
  → Limitar entre [-6, +12] dB
  ↓
[STEP 2] Loop Iterativo (MAX 4 iterações)
  │
  ├─ Iteration 1:
  │   → baseFile + preGain + limiter(ceiling) → _iter1.wav
  │   → Medir LUFS
  │   → error = targetLUFS - measuredLUFS
  │   → Se |error| < 0.3 LU → CONVERGIDO
  │   → Senão: preGain += error × 0.7
  │
  ├─ Iteration 2: (usa preGain ajustado)
  │   → ...
  │
  └─ ...
  ↓
[STEP 3] Copiar última iteração para output final
  ↓
[STEP 4] Limpar arquivos temporários
  ↓
Output
```

**Componentes:**

**Macro Dynamics Stabilizer:**
```javascript
// FFmpeg acompressor
threshold = RMS + 1.5dB
ratio = 1.5:1
attack = 30ms
release = 180ms
knee = 3dB
detection = rms
```

**Objetivo:** Reduzir perceived volume jump quando bass entra.  
**Não busca loudness**, apenas estabilidade de envelope.

**Render com Limiter:**
```javascript
// FFmpeg filter chain
volume=${preGainDB}dB,
alimiter=
  level_in=1.0:
  level_out=1.0:
  limit=${limitLinear}:
  attack=1:
  release=50:
  level=true  // CRITICAL: normalização ativa
```

**Proteção de True Peak:**
- Mede TP após cada aplicação de limiter
- Se TP > ceiling: reduz preGain em 1 dB e reaplica
- Máximo 2 tentativas

**Convergência:**
```javascript
const CONVERGENCE_THRESHOLD_LU = 0.3
const MAX_ITERATIONS = 4

error = targetLUFS - measuredLUFS
adjustment = error × 0.7  // 70% do erro

preGain += adjustment
preGain = clamp(preGain, -6.0, 12.0)  // Sanidade
```

**Vantagens do limiter iterativo:**
- Volume sobe imediatamente no 0:00
- Não reage a variações de bass (macro stabilizer controla)
- Loudness sólido e consistente
- Comportamento similar a limiter manual em DAW
- Sem pumping de loudnorm

### 2.6 Validação Final

#### 2.6.1 Critérios

**Métricas técnicas (bloqueiam se violadas):**
- LUFS Error: ±0.2 LU
- TP Error: +0.05 dB

**Métricas estéticas (geram apenas warnings):**
- Crest Factor drop
- Limiter stress
- Dynâmica colapsada

#### 2.6.2 Retry Logic

**HIGH Mode:**
- **Determinístico:** Single-pass execution
- Validação gera apenas warnings informativos
- Resultado sempre aceito como final
- Sem retry loop
- Sem fallback de TP

**LOW/STREAMING:**
- **Validação rigorosa:** Retry loop ativo
- Se validação falha:
  1. Reduzir target em 1.0 dB
  2. Reprocessar
  3. Repetir até 3 tentativas
- Se TP > ceiling:
  - Aplicar `fix-true-peak.cjs` (gain-only reduction)
  - Remedir

#### 2.6.3 Fallback Conservador

Se após 3 tentativas ainda não passou:
```javascript
targetLUFS = inputLUFS + 0.5
modeApplied = 'CONSERVATIVE_FALLBACK'
```

Processamento básico:
- Normalização suave
- Limiter ultra-conservador
- Sem buscar loudness competitiva

### 2.7 Geração do Output

**Formato de saída:**
- WAV PCM 24-bit
- Sample rate preservado do input
- Metadata mínima

**JSON de resultado (stdout):**
```json
{
  "success": true,
  "target_lufs": -12.5,
  "final_lufs": -12.3,
  "final_tp": -1.2,
  "lufs_error": 0.2,
  "tp_error": -0.2,
  "validation_passed": true,
  "fallback_used": false,
  "mode_result": "HIGH-LIMITER-DRIVEN",
  "confidence_score": 0.85,
  // ...
}
```

---

## 3. MOTOR DE DECISÃO (DECISION ENGINE)

### 3.1 Métricas Utilizadas

**Primárias:**
- **LUFS (I):** Loudness integrado total
- **True Peak (dBTP):** Pico digital real oversampled
- **Crest Factor (dB):** peak_db - rms_db (indicador de dinâmica)

**Secundárias:**
- **RMS (dB):** Energia média
- **Sub-bass energy:** Presença 20-80 Hz
- **LRA:** Loudness Range (usado mas não decisivo)

### 3.2 Cálculo de Headroom Efetivo

**Headroom inicial:**
```javascript
headroom = Math.abs(truePeak)
// Se TP = -3.5 dBTP → headroom = 3.5 dB
```

**Compressão aceitável do limiter:**
```javascript
limiterStressPermitido = {
  LOW: 2.0 dB,      // Conservador
  MEDIUM: 4.0 dB,   // Balanceado
  HIGH: 6.0 dB      // Agressivo
}
```

**Headroom efetivo:**
```javascript
effectiveHeadroom = headroom + limiterStressPermitido
```

**Conceito:** O sistema não trata TP inicial como limite absoluto. Reconhece que o limiter pode comprimir de forma controlada, então o headroom efetivo é maior.

### 3.3 Cálculo de Limiter Stress

```javascript
stressEstimate = Math.max(0, gainNeeded - headroom)
```

**Interpretação:**
- Se `gainNeeded = 8 dB` e `headroom = 3 dB`
- Então `stress = 5 dB`
- Significa: limiter precisa comprimir 5 dB além do headroom disponível

**Limites de stress:**
```javascript
MAX_LIMITER_STRESS = {
  LOW: 1.5 dB,
  MEDIUM: 3.0 dB,
  HIGH: 4.5 dB,
  HIGH_EXTENDED: 5.2 dB  // CF > 12, headroom > 3
}
```

**Ajuste por stress:**
```javascript
if (stressEstimate > MAX_LIMITER_STRESS[mode]) {
  const reduction = stressEstimate - MAX_LIMITER_STRESS[mode]
  safeOffset -= reduction
  targetLUFS = currentLUFS + safeOffset
}
```

### 3.4 Decisão de Target LUFS

#### 3.4.1 STREAMING Mode (Fixo)

```javascript
targetLUFS = -14.0  // Invariável
gainDB = targetLUFS - currentLUFS
```

Ignora:
- Dinâmica
- Headroom
- Crest Factor
- Limiter stress

Objetivo: Compliance absoluto com padrão broadcast/streaming.

#### 3.4.2 LOW/MEDIUM/HIGH (Dinâmico)

**Estratégia por faixa de LUFS:**

**< -50 LUFS (extremamente baixo):**
```javascript
strategy = "RECOVERY_MODE"
offset = maxOffsetLU[mode]  // Ganho máximo permitido
```

**-50 a -25 LUFS (baixo):**
```javascript
strategy = "AGGRESSIVE_INCREASE"
multiplier = { LOW: 0.5, MEDIUM: 0.7, HIGH: 0.9 }
offset = effectiveHeadroom × multiplier
```

**-25 a -15 LUFS (normal):**
```javascript
strategy = "BALANCED_INCREASE"

if (crestFactor > 12 && headroom > 3) {
  // Alta dinâmica: pode aumentar mais
  offset = effectiveHeadroom × 0.6
} else if (crestFactor < 8 && mode === LOW) {
  // Baixa dinâmica: preservar
  offset = 1.0  // Máximo 1 dB
} else {
  // Balanceado
  offset = effectiveHeadroom × 0.4
}
```

**-15 a -8 LUFS (alto):**
```javascript
strategy = "CONSERVATIVE_ADJUSTMENT"

if (HIGH && crestFactor > 12 && headroom > 2) {
  // HIGH pode buscar loudness competitiva
  offset = min(3.0, effectiveHeadroom × 0.5)
} else {
  // Outros modos: incremento pequeno
  offset = min(1.5, effectiveHeadroom × 0.25)
}
```

**> -8 LUFS (muito alto):**
```javascript
strategy = "MINIMAL_OR_SKIP"
offset = 0.5 ou 0  // Quase nenhum processamento
```

### 3.5 Aplicação de Caps e Proteções

**Sequência de aplicação:**

1. **Motor de decisão** calcula target inicial
2. **Validação de stress** ajusta se necessário
3. **Clamp para não reduzir:** `if (target < current) target = current`
4. **Global Caps** aplica hard limits
5. **Target Lock** congela valor final

**Global Caps (camada final):**

```javascript
// Cap 1: Delta máximo do modo
deltaLUFS = targetLUFS - inputLUFS
if (deltaLUFS > MAX_DELTA_BY_MODE[mode]) {
  targetLUFS = inputLUFS + MAX_DELTA_BY_MODE[mode]
  capped = true
  cap_reason = "MAX_DELTA_EXCEEDED"
}

// Cap 2: Limites absolutos de LUFS final
if (targetLUFS < ABSOLUTE_MIN_LUFS) {
  targetLUFS = ABSOLUTE_MIN_LUFS
  capped = true
}

if (targetLUFS > ABSOLUTE_MAX_LUFS) {
  targetLUFS = ABSOLUTE_MAX_LUFS
  capped = true
}

// Cap 3: True Peak projetado
projectedTP = inputTP + gainDB
if (projectedTP > -1.0) {
  // Reduzir target até TP ficar seguro
  targetLUFS = calcular_target_safe_para_TP()
  capped = true
  cap_reason = "TP_CEILING_PROTECTION"
}
```

---

## 4. PIPELINE DSP (PROCESSAMENTO DE SINAL)

### 4.1 Estabilizador Macro (HIGH Mode apenas)

**Função:** Prevenir perceived volume jump quando bass entra.

**Implementação:**
```
FFmpeg acompressor
  - threshold: RMS + 1.5 dB
  - ratio: 1.5:1 (suave)
  - attack: 30ms (rápido para bass)
  - release: 180ms (suave, sem pumping)
  - knee: 3 dB (transição suave)
  - detection: RMS (wideband)
  - makeup: 0 dB (sem compensação de ganho)
```

**Objetivo acústico:**
- Compressor **não busca loudness**
- Busca **estabilidade de envelope**
- Engaja preventivamente antes do bass
- Redução esperada: 1-2 dB em bass entry
- Transição transparente entre intro e drop

**Quando aplicar:**
- Apenas HIGH mode
- Antes do limiter iterativo
- Sobre áudio com EQ + PreGain

### 4.2 EQ Defensivo (Se presente)

**Nota:** O código auditado não mostra EQ defensivo explícito no pipeline atual. Se implementado futuramente, seria aplicado antes de qualquer ganho.

**Função típica de EQ defensivo:**
- Atenuar sub-grave excessivo (< 30 Hz)
- Controlar harshness (6-8 kHz)
- Prevenir problemas antes do limiter

### 4.3 Pre-Gain

**Aplicação:**
- Calculado pelo motor de decisão
- Aplicado via filtro FFmpeg `volume`
- Antes de qualquer compressão/limiting

**Formula:**
```javascript
preGainDB = targetLUFS - inputLUFS
preGainDB = clamp(preGainDB, 0, MAX_GAIN_DB[mode])
```

**Limites por modo:**
- STREAMING: 20.0 dB (sem limite prático)
- LOW: 3.0 dB
- MEDIUM: 5.0 dB
- HIGH: 7.0 dB

### 4.4 Pre-Limiter (LOW/STREAMING)

**Função:** Limiter suave antes do loudnorm.

**Objetivo acústico:**
- Prevenir que loudnorm receba picos extremos
- Evitar que loudnorm precise comprimir demais
- Reduz risco de pumping no loudnorm

**Implementação (inferida do pipeline):**
```
alimiter=
  level_in=1.0:
  level_out=1.0:
  limit=0.891:  // -1 dBTP linear
  attack=5:
  release=50
```

### 4.5 Ceiling Trim (pré-loudnorm)

**Condição de ativação:**
```javascript
if (truePeak > -2.0 dBTP) {
  // Aplicar trim negativo
}
```

**Função:** Garantir que loudnorm não receba áudio com TP > -2 dBTP.

**Objetivo acústico:**
- Prevenir inflação de envelope no loudnorm
- Loudnorm funciona melhor com TP conservador
- Evita overshooting de picos

**Implementação:**
```javascript
trimDB = truePeak - (-2.0)  // Se TP = -0.5, trim = 1.5 dB
ffmpeg -i input.wav -af "volume=-${trimDB}dB" output.wav
```

### 4.6 Loudnorm Two-Pass (LOW/STREAMING)

**First-Pass (Análise):**
```bash
ffmpeg -i input.wav -af loudnorm=
  I=${targetLUFS}:
  TP=${ceiling}:
  LRA=${LRA}:
  print_format=json
  -f null -
```

**Extrai:**
- measured_I
- measured_TP
- measured_LRA
- measured_thresh
- offset

**Second-Pass (Render):**
```bash
ffmpeg -i input.wav -af loudnorm=
  measured_I=${measured_I}:
  measured_TP=${measured_TP}:
  measured_LRA=${measured_LRA}:
  measured_thresh=${measured_thresh}:
  offset=${offset}:
  linear=true:
  I=${targetLUFS}:
  TP=${ceiling}:
  LRA=${LRA}
  output.wav
```

**Objetivo acústico:**
- Normalização precisa de LUFS
- Preservação de dinâmica (LRA mantido)
- True Peak control embarcado
- Redistribuição inteligente de energia

**Limitações conhecidas:**
- Pode causar pumping em bass-heavy tracks
- Latência global (look-ahead)
- Volume rise gradual (não imediato)

### 4.7 Limiter Iterativo (HIGH Mode)

**Loop de convergência:**

```javascript
for (let i = 0; i < MAX_ITERATIONS; i++) {
  // 1. Aplicar ganho + limiter
  await renderWithLimiter(baseFile, preGainDB, ceiling, ...)
  
  // 2. Medir LUFS
  measuredLUFS = await measureLUFS(outputFile)
  
  // 3. Calcular erro
  error = targetLUFS - measuredLUFS
  
  // 4. Convergiu?
  if (Math.abs(error) < 0.3) break
  
  // 5. Ajustar ganho
  preGainDB += error × 0.7  // 70% do erro
  preGainDB = clamp(preGainDB, -6, 12)
}
```

**Parâmetros:**
- MAX_ITERATIONS: 4
- CONVERGENCE_THRESHOLD: 0.3 LU
- Adjustment factor: 70% do erro
- Ganho bounds: [-6, +12] dB

**Objetivo acústico:**
- Volume sobe imediatamente no 0:00 (sem look-ahead)
- Loudness sólido e consistente ao longo da track
- Sem pumping reativo (compressor macro previne)
- Comportamento similar a limiter manual em DAW

**FFmpeg filter:**
```
volume=${preGainDB}dB,
alimiter=
  level_in=1.0:
  level_out=1.0:
  limit=${limitLinear}:
  attack=1:
  release=50:
  level=true  // Normalização ativa
```

**Proteção de True Peak:**
```javascript
// Após aplicar limiter, medir TP
if (finalTP > ceiling) {
  // Reduzir preGain em 1 dB
  preGainDB -= 1.0
  // Reaplicar limiter (máx 2 tentativas)
}
```

---

## 5. SISTEMA DE SEGURANÇA (GUARDRAILS)

### 5.1 Limites de Ganho

**Por modo:**
```javascript
MAX_GAIN_DB = {
  STREAMING: 20.0 dB,  // Sem limite prático
  LOW: 3.0 dB,         // Conservador
  MEDIUM: 5.0 dB,      // Balanceado
  HIGH: 7.0 dB         // Agressivo
}
```

**Aplicação:** Hard clamp no ganho calculado pelo motor.

### 5.2 Limites de LUFS Delta

**Por modo (Global Caps):**
```javascript
MAX_DELTA_BY_MODE = {
  STREAMING: 20.0 LU,  // Sem limite
  LOW: 7.0 LU,
  MEDIUM: 9.0 LU,
  HIGH: 13.0 LU
}
```

**Aplicação:** Após motor de decisão, antes do processamento.

### 5.3 Limites de Limiter Stress

**Por modo:**
```javascript
MAX_LIMITER_STRESS = {
  LOW: 1.5 dB,
  MEDIUM: 3.0 dB,
  HIGH: 4.5 dB,
  HIGH_EXTENDED: 5.2 dB  // CF > 12, headroom > 3
}
```

**Cálculo:**
```javascript
stressEstimate = Math.max(0, gainNeeded - headroom)
if (stressEstimate > MAX_LIMITER_STRESS[mode]) {
  // Reduzir offset automaticamente
}
```

### 5.4 Limites de True Peak

**Ceiling fixo:** -1.0 dBTP

**Proteção 1 (pré-loudnorm):**
```javascript
if (truePeak > -2.0 dBTP) {
  // Aplicar ceiling trim
}
```

**Proteção 2 (limiter iterativo):**
```javascript
if (finalTP > ceiling) {
  // Reduzir preGain e reaplicar
}
```

**Proteção 3 (fallback):**
```javascript
if (finalTP > ceiling && mode !== HIGH) {
  // Aplicar fix-true-peak.cjs
}
```

### 5.5 Tolerâncias de Validação

**Técnicas (bloqueiam processamento):**
- LUFS: ±0.2 LU
- TP: +0.05 dB

**Estéticas (apenas warnings):**
- Crest Factor drop
- Limiter stress
- Dynâmica colapsada

### 5.6 Fallback Logic

**Condições de ativação:**
1. Headroom < 0.8 dB → Não processar
2. Ganho < 0.3 dB → Não processar
3. Validação falhou 3x → Conservative fallback
4. Erro de execução → Fallback para loudnorm (HIGH mode)

**Conservative fallback:**
```javascript
targetLUFS = inputLUFS + 0.5
modeApplied = 'CONSERVATIVE_FALLBACK'
```

### 5.7 Validação Determinística (HIGH)

**Comportamento:**
- Single-pass execution (sem retry loop)
- Validação gera apenas warnings informativos
- Resultado sempre aceito como final
- Sem fallback de True Peak
- Fallback APENAS em caso de erro de execução

**Objetivo:** Previsibilidade e consistência absoluta do HIGH mode.

---

## 6. COMPORTAMENTO POR MODO

### 6.1 STREAMING Mode

**Objetivo sonoro:**  
Compliance absoluto com padrão -14 LUFS broadcast/streaming.

**Target:**  
Fixo em -14.0 LUFS (invariável).

**Características:**
- Ignora dinâmica do input
- Ignora headroom
- Ignora crest factor
- Sempre processa para -14 LUFS
- Ganho máximo: 20 dB (sem limite prático)

**Pipeline:**  
Loudnorm two-pass padrão.

**Proteções:**
- Ceiling TP: -1.0 dBTP
- Validação rigorosa com retry loop
- Fallback de TP se necessário

**Quando usar:**
- Entrega para Spotify, YouTube, broadcast
- Compliance mandatório
- Não importa estética, apenas padrão

### 6.2 LOW Mode

**Objetivo sonoro:**  
Preservação máxima de dinâmica com aumento conservador de loudness.

**Target:**  
Dinâmico, calculado por faixas de LUFS com multiplicadores conservadores.

**Características:**
- Max offset: 4.0 LU
- Max gain: 3.0 dB
- Max stress: 1.5 dB
- Max delta: 7.0 LU (Global Caps)

**Estratégia típica:**
- Faixa normal (-25 a -15): effectiveHeadroom × 0.5
- Faixa alta (-15 a -8): incremento de 0.5-1.0 LU
- Prioriza qualidade sobre competitividade

**Pipeline:**  
Loudnorm two-pass padrão.

**Proteções:**
- Stress limiter ultra-conservador
- Validação rigorosa com retry loop
- Fallback de TP agressivo

**Quando usar:**
- Gêneros acústicos (jazz, clássico, folk)
- Preservar nuances e transientes
- Client valoriza dinâmica sobre loudness

### 6.3 MEDIUM Mode

**Objetivo sonoro:**  
Balanceamento entre loudness competitiva e preservação de qualidade.

**Target:**  
Dinâmico, calculado por faixas de LUFS com multiplicadores balanceados.

**Características:**
- Max offset: 8.0 LU
- Max gain: 5.0 dB
- Max stress: 3.0 dB
- Max delta: 9.0 LU (Global Caps)

**Estratégia típica:**
- Faixa normal (-25 a -15): effectiveHeadroom × 0.7
- Faixa alta (-15 a -8): incremento de 1.0-1.5 LU
- Busca loudness perceptível sem degradação

**Pipeline:**  
Loudnorm two-pass padrão.

**Proteções:**
- Stress limiter moderado
- Validação rigorosa com retry loop
- Fallback de TP moderado

**Quando usar:**
- Maioria dos gêneros (rock, pop, indie)
- Balanceamento geral
- Default recomendado

### 6.4 HIGH Mode

**Objetivo sonoro:**  
Loudness competitiva para streaming moderno, com estabilidade de envelope.

**Target:**  
Dinâmico, range típico -11 a -10 LUFS (pode chegar a -8 LUFS com extensão).

**Características:**
- Max offset: 12.0 LU
- Max gain: 7.0 dB
- Max stress: 4.5 dB (padrão), 5.2 dB (extended)
- Max delta: 13.0 LU (Global Caps)

**Estratégia típica:**
- Faixa normal (-25 a -15): effectiveHeadroom × 0.9
- Faixa alta (-15 a -8): busca -11 LUFS
- Extensão dinâmica: +2 LU se CF > 12 e headroom > 3

**Pipeline EXCLUSIVO:**  
Limiter iterativo (bypass loudnorm).

**Estágios únicos:**
1. **Macro Dynamics Stabilizer** (compressor wideband)
2. **Limiter iterativo com convergência** (4 iterações)
3. **Proteção de TP integrada** no render

**Proteções HIGH:**
- **Validação determinística:** Single-pass, sem retry
- **Sem fallback de TP:** Resultado aceito como final
- **Fallback de execução:** Apenas se erro crítico
- **Compressor macro:** Previne volume jump no bass

**Quando usar:**
- EDM, hip-hop, pop comercial
- Competição no streaming
- Mix já controlada
- Cliente prioriza loudness competitiva

**Contraindicações:**
- Gêneros acústicos
- Dinâmica extrema (orquestra)
- Mix com transientes delicados

---

## 7. LIMITAÇÕES ATUAIS DO SISTEMA

### 7.1 Dependência de Densidade da Mix

**Limitação:**  
O sistema depende fortemente de Crest Factor e headroom disponível no input. Mixes já densas (CF < 8 dB) têm margem muito limitada para aumento.

**Consequência:**
- Mixes com CF baixo resultam em targets conservadores
- Impossibilidade de criar loudness competitiva se o input já está limitado
- Diferença de resultado entre mix aberta (CF 14) e mix fechada (CF 6)

**Exemplo:**
```
Input A: -18 LUFS, CF 14 dB → Target HIGH: -10 LUFS (ganho 8 dB)
Input B: -18 LUFS, CF 6 dB → Target HIGH: -14 LUFS (ganho 4 dB)
```

### 7.2 Incapacidade de Criar Loudness Artificial

**Limitação:**  
O sistema não cria loudness quando não há headroom. É um "maximizador de headroom disponível", não um "criador de loudness".

**Consequência:**
- Não pode competir com masters que usaram saturação/distorção criativa
- Não pode "densificar" uma mix aberta demais
- Limitado pelo envelope original do input

**Exemplo:**
```
Input com CF 16 dB (muito aberto):
  - Limiter comprime 6 dB de picos
  - Resultado: CF 10 dB, loudness moderada
  - Impossível chegar a -8 LUFS sem saturação
```

### 7.3 Ausência de Saturação Inteligente

**Limitação:**  
Não há saturação harmônica controlada para "engrossar" o som ou criar loudness percebida.

**Consequência:**
- Som pode ficar "limpo demais" em comparação com masters comerciais
- Falta de "cola" harmônica
- Impossibilidade de competir com loudness de masters saturados

**Mercado:**
- Ozone, FabFilter Pro-L2 usam saturação inteligente
- Masters comerciais aplicam 1-3% THD estratégico
- AutoMaster V1 é 100% clean (0% THD)

### 7.4 Ausência de Multiband Dynamics

**Limitação:**  
Limiter/compressor são fullband (wideband). Não há controle independente por faixa de frequência.

**Consequência:**
- Bass excessivo pode forçar compressão excessiva de médios/agudos
- Impossibilidade de "abrir espaço" para vocal comprimindo apenas bass
- Menos controle cirúrgico sobre mix desbalanceadas

**Mercado:**
- Ozone: 4-band dynamics
- Waves L3: 5-band limiter
- AutoMaster V1: fullband apenas

### 7.5 Ausência de Glue Compression

**Limitação:**  
Não há compressor de "cola" (glue) para unificar elementos da mix.

**Consequência:**
- Mix pode manter separação excessiva entre elementos
- Falta de coesão sonora típica de master comercial
- Impossibilidade de criar "punch" controlado

**Nota:** Macro Dynamics Stabilizer do HIGH mode não é glue compressor, é apenas estabilizador de envelope.

### 7.6 Latência de Análise

**Limitação:**  
Two-pass loudnorm requer passagem completa de análise antes de processa r.

**Consequência:**
- Tempo de processamento ~2x duração do áudio
- Não é adequado para tempo real
- Custo computacional elevado para arquivos longos

**HIGH mode:** Mais rápido (sem first-pass), mas ainda não é real-time.

### 7.7 Ausência de Spectral Processing

**Limitação:**  
Não há análise/processamento espectral (FFT-based).

**Consequência:**
- Impossibilidade de corrigir resonâncias específicas
- Impossibilidade de fazer de-essing inteligente
- Impossibilidade de controle cirúrgico de faixas problemáticas

**Mercado:**
- iZotope Ozone: Match EQ, spectral shaper
- FabFilter Pro-Q3: dynamic EQ espectral
- AutoMaster V1: EQ defensivo básico (se presente)

### 7.8 Sem Análise de Gênero/Contexto

**Limitação:**  
Não há detecção de gênero ou contexto musical.

**Consequência:**
- Tratamento idêntico para jazz e EDM (exceto por mode)
- Impossibilidade de aplicar estratégias específicas de gênero
- User precisa escolher mode manualmente

**Mercado:**
- LANDR: Detecção de gênero + perfis específicos
- eMastered: ML para contexto musical
- AutoMaster V1: Agnóstico de gênero (by design)

### 7.9 Sem Stereo Enhancement

**Limitação:**  
Não há processamento de imagem estéreo.

**Consequência:**
- Preserva width original (bom para alguns casos)
- Impossibilidade de "abrir" mix mono
- Impossibilidade de corrigir desbalanceamento L/R

**Mercado:**
- Ozone: Stereo imager
- Waves S1: Stereo width control
- AutoMaster V1: Mono/stereo preservado

### 7.10 Limitação de Formato

**Limitação:**  
Apenas WAV input/output.

**Consequência:**
- Necessita conversão prévia de MP3/FLAC/etc
- Não integra direto com bibliotecas de streaming
- Overhead de conversão para users

**Nota:** Limitação intencional por simplicidade e qualidade.

---

## 8. RESUMO TÉCNICO FINAL

### 8.1 Nível Atual do AutoMaster V1

**Categoria:** Maximizador de loudness baseado em headroom, com motor de decisão conservador.

**Sofisticação técnica:**
- ⭐⭐⭐⭐☆ (4/5) - Análise de métricas robusta
- ⭐⭐⭐☆☆ (3/5) - Processamento DSP (fullband apenas)
- ⭐⭐⭐⭐⭐ (5/5) - Guardrails e segurança
- ⭐⭐⭐⭐☆ (4/5) - Previsibilidade e determinismo
- ⭐⭐☆☆☆ (2/5) - Sofisticação sonora (sem saturação, sem multiband)

**Comparação de mercado:**
```
AutoMaster V1: Maximizador conservador (headroom-driven)
LANDR Basic: Similaridade alta (loudness normalization)
iZotope Ozone Elements: Superior (multiband, spectral)
FabFilter Pro-L2: Superior (saturação, oversampling avançado)
Waves Abbey Road TG: Superior (emulação analógica, saturação)
```

### 8.2 Público-Alvo Confiável

**Ideal para:**

1. **Podcasts e audiobooks**
   - STREAMING mode (-14 LUFS) perfeito
   - Sem necessidade de loudness competitiva
   - Prioriza clareza e consistência

2. **Demos e rough mixes**
   - LOW/MEDIUM adequados
   - Não precisa competir comercialmente
   - Objetivo: tornar audível, não competitivo

3. **Broadcast/streaming compliance**
   - STREAMING mode garante -14 LUFS exato
   - Sem risco de rejeição por loudness excessiva
   - Determinístico e auditável

4. **Produtores em aprendizado**
   - Motor conservador ensina headroom
   - Feedback transparente (logs detalhados)
   - Não mascara problemas da mix

**Limitado para:**

1. **Masters comerciais competitivos**
   - Falta saturação para densidade
   - Falta multiband para controle cirúrgico
   - Som pode ficar "limpo demais"

2. **Gêneros de alta loudness (EDM, hip-hop)**
   - HIGH mode ajuda, mas não compete com saturação comercial
   - Impossível atingir -6 LUFS RMS típico de EDM sem degradação

3. **Mixes desbalanceadas**
   - Sem EQ corretivo avançado
   - Sem multiband para rebalancear
   - Motor apenas maximiza, não corrige

4. **Trabalhos de mastering profissional**
   - Falta humanização e nuance
   - Falta ferramentas criativas (saturação, stereo, etc)
   - Abordagem algorítmica vs artística

### 8.3 Posicionamento no Mercado de IA Mastering

**Tier 1 (Premium/Professional):**
- iZotope Ozone (AI-assisted, multiband, spectral)
- FabFilter mixing suite (manual mas sofisticado)
- Waves mastering bundle (emulação analógica)

**Tier 2 (Prosumer/Semi-Pro):**
- LANDR Pro (ML, gênero-aware, saturação)
- eMastered (ML, análise contextual)
- CloudBounce (preset-based, multiband)

**Tier 3 (Entry/Utility):** ← **AutoMaster V1 está aqui**
- LANDR Basic
- BandLab Mastering
- Algoritmos de normalização avançados

**Posição do AutoMaster V1:**
```
Tier 3+: "Maximizador inteligente com guardrails profissionais"
```

**Diferenciais positivos:**
- ✅ Determinístico (reproduzível)
- ✅ Conservador (não degrada)
- ✅ Transparente (logs detalhados)
- ✅ Open-source (auditável)
- ✅ Gratuito

**Gaps para Tier 2:**
- ❌ Sem saturação inteligente
- ❌ Sem multiband dynamics
- ❌ Sem análise de gênero
- ❌ Sem processamento estéreo
- ❌ Sem espectral processing

### 8.4 Filosofia do Sistema

**"Quality-First Loudness Maximization"**

O AutoMaster V1 opera sob o princípio de que:
1. **Qualidade > Loudness competitiva**
2. **Previsibilidade > Resultados surpreendentes**
3. **Conservadorismo > Agressividade**
4. **Matematicamente correto > Esteticamente ousado**

**Não tenta:**
- Competir com masters saturados comerciais
- "Consertar" mixes ruins
- Criar densidade artificial
- Imitar som de hardware analógico

**Faz bem:**
- Maximizar headroom disponível
- Proteger dinâmica importante
- Entregar loudness segura e previsível
- Compliance com padrões broadcast/streaming

### 8.5 Próximos Passos Lógicos (Não implementados)

**Para mover para Tier 2:**
1. Saturação harmônica controlada (0.5-2% THD)
2. Multiband dynamics (3-4 bandas)
3. Glue compression profissional
4. Spectral de-essing/de-harshness
5. Stereo enhancement inteligente

**Para manter filosofia conservadora:**
- Todos features devem ser controláveis e auditáveis
- Manter determinismo
- Não adicionar "mágica" não-explicável
- Logs detalhados de cada processamento

---

## CONCLUSÃO

O **AutoMaster V1** é um sistema de masterização automática **tecnicamente sólido**, **matematicamente correto** e **altamente previsível**. 

Seu valor está na **segurança**, **transparência** e **determinismo**, não na sofisticação sonora ou competitividade comercial.

É uma ferramenta **confiável para compliance** (STREAMING mode) e **maximização conservadora de headroom** (LOW/MEDIUM/HIGH), mas **não substitui** um mastering engineer profissional ou ferramentas de Tier 1/2 para trabalhos comerciais competitivos.

**Posicionamento correto:** "Loudness normalization inteligente com proteção de qualidade", não "AI mastering engine competitivo".

---

**Fim da Auditoria Técnica**  
**AutoMaster V1 - SoundyAI**
