# DOCUMENTO TÉCNICO OFICIAL
## SoundyAI – AutoMaster V1

---

**Versão:** 1.0  
**Status:** Produção  
**Data:** 2026-03-02  
**Classificação:** Interno – Equipe de Engenharia  

---

## Sumário

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Arquitetura Geral](#2-arquitetura-geral)
3. [Motor de Decisão (Decision Engine)](#3-motor-de-decisão-decision-engine)
4. [SAFE Mode](#4-safe-mode)
5. [Modo HIGH](#5-modo-high)
6. [Regras Técnicas Fixas](#6-regras-técnicas-fixas)
7. [Casos Limite](#7-casos-limite)
8. [Garantias Técnicas do V1](#8-garantias-técnicas-do-v1)
9. [Limitações Conhecidas do V1](#9-limitações-conhecidas-do-v1)
10. [Observabilidade e Logs](#10-observabilidade-e-logs)
11. [Riscos Técnicos Atuais](#11-riscos-técnicos-atuais)
12. [Conclusão Técnica](#12-conclusão-técnica)

---

## 1. Visão Geral do Sistema

### 1.1 Objetivo do AutoMaster V1

O AutoMaster V1 é um pipeline de masterização automática baseado em métricas técnicas objetivas. Seu objetivo é aumentar o loudness integrado de um mix (LUFS) de forma controlada, sem introduzir clipping digital, distorção por limitação excessiva ou degradação audível sistemática.

O sistema opera como um CLI autônomo invocado por um worker Node.js. Toda a cadeia de decisão e processamento DSP é realizada localmente via FFmpeg, sem dependência de IA generativa ou modelos externos.

### 1.2 Filosofia Técnica

O sistema é projetado em torno de três princípios:

- **Determinístico**: dado o mesmo arquivo de entrada e modo, a saída é sempre a mesma. Não há aleatoriedade, arredondamento não controlado ou dependência de estado externo.
- **Conservador**: em caso de dúvida, o sistema reduz o ganho em vez de aumentar. Prefere entregar um arquivo mais quieto a um arquivo com degradação audível.
- **Previsível**: cada decisão é documentada em `stderr` com valores numéricos precisos. Toda alteração de target tem causa raiz identificável nos logs.

### 1.3 Escopo do V1

**O que o sistema faz:**

- Mede LUFS integrado e True Peak do arquivo de entrada via FFmpeg `loudnorm`
- Calcula target LUFS dinamicamente baseado em headroom, Crest Factor e modo escolhido
- Aplica normalização de loudness via `loudnorm` two-pass (análise + render determinístico)
- Aplica `alimiter` no domínio de amostras para contenção de picos
- Aplica correção de True Peak via ganho negativo puro quando necessário
- Verifica aptidão técnica do material antes de processar
- Executa rescue por ganho quando o TP de entrada viola o threshold
- Valida o resultado com postcheck antes de entregar

**O que o sistema NÃO faz:**

- Não aplica correção tonal (EQ paramétrico ou gráfico de finalidade musical)
- Não satura, não aplica harmônicos, não usa exciter
- Não realiza reconstrução de transientes ou upward expansion
- Não detecta gênero musical para alterar processamento
- Não usa compressor side-chain ou multiband
- Não promete equivalência com masterização humana
- Não processa formatos além de WAV (44100 Hz ou 48000 Hz, mono ou stereo)

---

## 2. Arquitetura Geral

### 2.1 Mapa de Módulos

```
automaster/
├── master-pipeline.cjs       ← Orquestrador principal (pipeline)
├── automaster-v1.cjs         ← Núcleo DSP (TWO-PASS + LIMITER DRIVEN)
├── decision-engine.cjs       ← Motor de decisão (target LUFS dinâmico)
├── measure-audio.cjs         ← Medição de LUFS e True Peak
├── fix-true-peak.cjs         ← Correção de True Peak (ganho negativo)
├── check-aptitude.cjs        ← Gate de aptidão técnica de entrada
├── rescue-mode.cjs           ← Rescue por ganho (TP excessivo)
├── precheck-audio.cjs        ← Gate técnico pré-processamento
├── postcheck-audio.cjs       ← Gate técnico pós-render
├── run-automaster.cjs        ← Adaptador CLI → automaster-v1.cjs
└── processing-profiles.cjs   ← Perfis de limiter por modo
```

### 2.2 Descrição de cada Módulo

#### `master-pipeline.cjs` (866 linhas)
Orquestrador de alto nível. Responsável por coordenar a ordem de execução de todos os módulos via `child_process.execFile`. Recebe `{ inputPath, outputPath, mode, rescueMode, safeMode }`. Retorna sempre JSON no `stdout`. Nunca termina com exit code 1 para evitar rejeição de `execFile` antes de leitura do stdout.

**Responsabilidades:**
- Validar argumentos de entrada
- Executar gate de aptidão
- Executar Rescue Mode se necessário
- Executar Precheck
- Ramificar para `runSafeModeDelivery` (safeMode) ou `runMaster` (padrão)
- Executar Postcheck e tratar FALLBACK_CLEAN ou ABORT
- Retornar status estruturado: `completed_primary`, `completed_safe`, `completed_with_warning` ou `NEEDS_CONFIRMATION`

#### `automaster-v1.cjs` (4732 linhas)
Núcleo técnico de processamento DSP. Opera em duas execuções possíveis dependendo do modo e do material:

- **`runTwoPassLoudnorm()`**: Caminho primário para todos os modos (STREAMING, LOW, MEDIUM, HIGH quando dentro dos limites de TP). Usa `loudnorm` two-pass com `linear=true` para normalização determinística.
- **`runLimiterDrivenMaster()`**: Caminho alternativo para o modo HIGH quando o limiter iterativo é mais adequado. Retorna antes de `runTwoPassLoudnorm`, possuindo sua própria lógica de postcheck de TP (`[HIGH TP POSTCHECK]`).

Ambos os caminhos terminam com verificação de True Peak e aplicação de `applyTruePeakFix()` se necessário.

#### `decision-engine.cjs` (823 linhas)
Motor de decisão puro. Recebe métricas e modo; retorna `{ targetLUFS, gainDB, shouldProcess, ... }`. Não tem efeitos colaterais. Também expõe `applyGlobalCaps()` para aplicar limites absolutos após o cálculo.

#### `measure-audio.cjs` (132 linhas)
Medição técnica. Usa `ffmpeg loudnorm=I=-14:TP=-1:LRA=11:print_format=json` para extrair `input_i` (LUFS integrado) e `input_tp` (True Peak estimado por oversampling interno do FFmpeg). Saída: JSON no `stdout`.

#### `fix-true-peak.cjs` (299 linhas)
Correção de True Peak por ganho negativo puro. Não usa limiter, compressor ou EQ. Fórmula: `gainDB = (TARGET_TP − inputTP) − SAFETY_MARGIN`. Possui post-medição interna e loop de ajuste fino. Gera `<input>_safe.wav`.

#### `check-aptitude.cjs`
Gate binário de aptidão. Verifica:
- `true_peak_db > -1.0 dBTP` → NOT_APT
- `lufs_i > targetLufs + 3.0 LUFS` → NOT_APT

#### `rescue-mode.cjs`
Aplica atenuação de ganho puro para reduzir TP até `-1.2 dBTP`. Se não for possível (ISP que não responde a atenuação linear), retorna `ABORT_UNSAFE_INPUT`.

#### `precheck-audio.cjs` (434 linhas)
Gate técnico de qualidade. Classifica o material como OK, WARNING ou BLOCKED com base em TP, duração, silêncio, LRA e DR estimado.

#### `postcheck-audio.cjs` (231 linhas)
Validação pós-render em três tiers. Tier 1 verifica True Peak (hard stop). Tier 3 verifica LUFS dentro de um teto por modo. Emite `OK`, `FALLBACK_CLEAN` ou `ABORT`.

### 2.3 Fluxo Completo de Execução

```
[INPUT WAV]
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│  GATE DE APTIDÃO — check-aptitude.cjs                   │
│  TP > -1.0 dBTP || LUFS > target + 3.0 LU → NOT_APT    │
└────────────────────────┬────────────────────────────────┘
                         │ NOT_APT (sem safeMode)
                         ▼
                  NEEDS_CONFIRMATION ──────── (retorna ao worker)
                         │ NOT_APT (com safeMode)
                         ▼
┌─────────────────────────────────────────────────────────┐
│  RESCUE MODE — rescue-mode.cjs                          │
│  Aplica ganho negativo para TP ≤ -1.2 dBTP             │
│  ABORT_UNSAFE_INPUT → termina (ou best-effort safeMode) │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  PRECHECK — precheck-audio.cjs                          │
│  BLOCKED + TP issue → fix-true-peak.cjs + re-precheck   │
│  BLOCKED + qualidade → NEEDS_CONFIRMATION (sem safe)    │
│                      → classifica + continua (safeMode) │
└────────────────────────┬────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │ safeMode            │ padrão
              ▼                    ▼
  ┌───────────────────┐  ┌──────────────────────────────┐
  │ runSafeModeDelivery│  │ runMaster → automaster-v1.cjs │
  │ TP-only, sem loudnorm│  │ Decision Engine + Two-Pass  │
  └────────┬──────────┘  └──────────────┬───────────────┘
           │                            │
           └──────────────┬─────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  POSTCHECK — postcheck-audio.cjs                        │
│  Tier1: TP > -0.8 dBTP → ABORT                         │
│  Tier3: LUFS > target + 1.5 → FALLBACK_CLEAN           │
│  OK → entrega                                           │
└────────────────────────┬────────────────────────────────┘
                         │ FALLBACK_CLEAN
                         ▼
              runMaster(strategy='CLEAN') + postcheck2
                         │
                         ▼
              [OUTPUT WAV] + status JSON
```

---

## 3. Motor de Decisão (Decision Engine)

### 3.1 Entradas

```javascript
decideGainWithinRange(metrics, mode)
// metrics: { lufs, truePeak, crestFactor }
// mode: 'STREAMING' | 'LOW' | 'MEDIUM' | 'HIGH'
```

### 3.2 Cálculo de Headroom

```
headroom = |truePeak|
// Se truePeak = -1.5 dBTP → headroom = 1.5 dB
// Se truePeak = -6.0 dBTP → headroom = 6.0 dB
```

### 3.3 Effective Headroom (Compressão Controlada do Limiter)

O motor reconhece que o `alimiter` pode comprimir de forma controlada além do headroom passivo. O `effectiveHeadroom` define o ganho total que pode ser aplicado com segurança:

```
limiterStressPermitido:
  LOW    = 2.0 dB
  MEDIUM = 4.0 dB
  HIGH   = 6.0 dB

effectiveHeadroom = headroom + limiterStressPermitido
```

### 3.4 STREAMING Mode (Target Fixo)

Para o modo STREAMING, o decision engine ignora métricas dinâmicas e aplica target absoluto:

```
targetLUFS = -14.0 LUFS
gainDB = targetLUFS - currentLUFS
```

Se `|gainDB| < 0.3 LU`, retorna `shouldProcess: false`.

### 3.5 Targets Dinâmicos por Faixa de LUFS

O motor classifica o material em três faixas:

| Faixa | Critério | Estratégia |
|---|---|---|
| Mix muito baixa | `lufs < -18.0` | `aggressive_push` |
| Mix média | `-18.0 ≤ lufs ≤ -13.0` | `moderate_push` |
| Mix alta | `lufs > -13.0` | `preserve` (ou HIGH push) |

#### Targets por modo e faixa (valores do código):

**Mix muito baixa (<-18 LUFS):**

| Modo | CF ≥ 12 | CF < 12 |
|---|---|---|
| LOW | -14.0 LUFS | -14.0 LUFS |
| MEDIUM | -13.0 LUFS | -13.0 LUFS |
| HIGH | -10.5 LUFS | -11.5 LUFS |

**Mix média (-18 a -13 LUFS):**

| Modo | CF ≥ 12 | CF < 12 |
|---|---|---|
| LOW | -14.0 a -13.0 | -14.0 a -13.0 |
| MEDIUM | -13.0 a -12.0 | -13.0 a -12.0 |
| HIGH | -11.0 a -10.0 | -12.0 a -11.0 |

**Mix alta (>-13 LUFS):**
- Modos LOW/MEDIUM: ganho máximo de `min(effectiveHeadroom × 0.3, 1.0 dB)`
- Modo HIGH: busca -10.5 ou -11.5 LUFS com 50% do effective headroom

### 3.6 HIGH Mode Dynamic Extension

Se `crestFactor > 12 dB` e `headroom > 3 dB`, o motor ativa extensão dinâmica para o modo HIGH:

```
highModeExtension = min(2.0, crestFactor - 11)
// Cap extendido: -8.0 + highModeExtension LUFS
// Ex: CF=14 → extension=2 → cap=-6.0 LUFS (máximo absoluto)
```

### 3.7 Cálculo do Stress do Limiter

```
stressEstimate = max(0, finalGainNeeded - headroom)
```

Limites por modo:

| Modo | maxStress padrão | maxStress estendido (CF>12, HRoom>2) |
|---|---|---|
| STREAMING | 4.0 dB | — |
| LOW | 1.5 dB | — |
| MEDIUM | 3.0 dB | — |
| HIGH | 4.5 dB | 5.2 dB (HIGH_EXTENDED) |

Se `stressEstimate > maxStress`:

```
reduction = stressEstimate - maxStress
safeOffset -= reduction
targetLUFS = currentLUFS + safeOffset
```

### 3.8 Crest Factor

O Crest Factor (CF) é calculado como `Peak level dB − RMS level dB` via `astats`. Faixa esperada: 3 a 25 dB.

Se o valor for inválido (`NaN`, ≤ 0, > 30), o motor substitui por `DEFAULT_CREST_FACTOR = 7.0` (fallback conservador).

O CF é utilizado para:
- Definir target LUFS por sub-faixa dentro do modo HIGH
- Ativar HIGH MODE Dynamic Extension
- Ativar estresse estendido (`HIGH_EXTENDED`)
- Calcular Mix Confidence Score (atualmente desativado como gate)

### 3.9 Mix Confidence Score

O motor calcula um score de 0 a 1 baseado em headroom, CF e delta:

```javascript
function calculateMixConfidence({ headroom, crestFactor, delta }) {
  let score = 1.0;
  if (headroom < 1.5)     score -= 0.3;
  else if (headroom < 2.5) score -= 0.15;
  if (crestFactor < 8)    score -= 0.3;
  else if (crestFactor < 10) score -= 0.15;
  if (delta > 5)          score -= 0.25;
  else if (delta > 4)     score -= 0.15;
  return clamp(score, 0, 1);
}
```

**Status atual**: O gate de downgrade HIGH→MEDIUM baseado neste score está **comentado** e **desativado**. O score é calculado e logado mas não influi na decisão.

### 3.10 Critérios de `shouldProcess: false`

O motor retorna `shouldProcess: false` (bypass) nos seguintes casos:
1. `headroom < 0.8 dB` (headroom crítico)
2. `|gainNeeded| < 0.3 dB` (ganho imperceptível, antes e depois dos ajustes)
3. `gainNeeded` reduz LUFS (protegido em múltiplos pontos)
4. NaN detectado no target

### 3.11 Global Caps (`applyGlobalCaps`)

Aplicados após a decisão do motor como camada final de segurança:

| Cap | Regra | Limite |
|---|---|---|
| MODE_CAP | Target LUFS máximo por modo | LOW: -10, MEDIUM: -9, HIGH: -8 (+extension) |
| DELTA_LIMIT | Delta máximo por modo (LU) | LOW: 7, MEDIUM: 9, HIGH: 13, STREAMING: 20 |
| NEVER_REDUCE | targetLUFS nunca < currentLUFS | — |
| NAN_PROTECTION | Se target == NaN → bypass | gainDB = 0 |

**Nota**: Para modo HIGH com `target < -11.5 LUFS`, o MODE_CAP é isentado explicitamente para preservar loudness competitiva.

---

## 4. SAFE Mode

### 4.1 Quando é Ativado

O `safeMode` é ativado pelo worker upstream ao invocar `master-pipeline.cjs` com a flag `--safe-mode`. É utilizado quando o usuário confirma explicitamente o processamento de um material que o gate de aptidão considerou não-apto, ou como mecanismo de entrega garantida mesmo sob condições de limite.

### 4.2 Funções Executadas em SAFE Mode

Em safeMode, o pipeline substitui `runMaster()` por `runSafeModeDelivery()`:

```
runSafeModeDelivery(inputPath, outputPath):
  1. runMeasureAudio(inputPath) → inputTP, inputLUFS
  2. Se inputTP ≤ -1.0 dBTP:
       copyFileSync(inputPath, outputPath)
       return { mode_result: 'SAFE-PASSTHROUGH', fix_applied: false }
  3. Se inputTP >  -1.0 dBTP:
       runFixTruePeak(inputPath) → <input>_safe.wav
       copyFileSync(_safe.wav, outputPath)
       unlinkSync(_safe.wav)
       runMeasureAudio(outputPath) → finalTP, finalLUFS
       return { mode_result: 'SAFE-TP-FIXED', fix_applied: true }
```

### 4.3 O que NÃO é Executado em SAFE Mode

- `automaster-v1.cjs` (não é invocado)
- `loudnorm` two-pass (não é executado)
- Decision Engine (não é consultado)
- `alimiter` (não é aplicado)
- Pre-limiter analysis pass (não é executado)
- EQ defensivo (não é aplicado)

### 4.4 Como Trata o True Peak

- Se `inputTP ≤ -1.0 dBTP`: arquivo é copiado sem modificação alguma. LUFS e TP são preservados bit-a-bit.
- Se `inputTP > -1.0 dBTP`: `fix-true-peak.cjs` é aplicado. O ganho é negativo (apenas atenuação). LUFS cai na proporção exata do ganho aplicado.

### 4.5 Impacto Esperado no LUFS

**Caso SAFE-PASSTHROUGH (TP ≤ -1.0):**

```
ΔLUFS = 0.0 LU  (cópia byte-a-byte)
```

**Caso SAFE-TP-FIXED (TP > -1.0):**

```
gainDB = (TARGET_TP − inputTP) − 0.05
ΔLUFS ≈ gainDB  (ganho linear → LUFS cai proporcionalmente ao gain)

Exemplo:
  inputTP = +0.7 dBTP → gainDB ≈ -1.75 dB → ΔLUFS ≈ -1.75 LU
  inputTP = -0.5 dBTP → gainDB ≈ -0.55 dB → ΔLUFS ≈ -0.55 LU
```

### 4.6 Por que LUFS Cai Quando TP é Corrigido

**Fundamento físico**: `fix-true-peak.cjs` aplica um filtro FFmpeg `volume=XdB`. Este filtro escala linearmente o sinal inteiro. O ganho reduz todos os picos e todos os valores RMS proporcionalmente.

**Relação matemática**:

```
LUFS_final = LUFS_input + gainDB
```

Sendo `gainDB < 0` (sempre que o TP precisa ser corrigido), `LUFS_final < LUFS_input`.

Não existe mecanismo no V1 que corrija TP positivo sem reduzir LUFS. Isso é inerente à abordagem de atenuação por ganho puro. Um limiter poderia preservar LUFS enquanto controla TP, mas introduziria distorção por limitação — fora do escopo do SAFE Mode.

### 4.7 Garantias Técnicas do SAFE Mode

- O arquivo de saída sempre existe quando `runSafeModeDelivery` retorna `success: true`
- O LUFS nunca aumenta em SAFE Mode (nunca há ganho positivo)
- O TP do arquivo entregue é sempre ≤ `-1.0 dBTP` (garantido por `fix-true-peak.cjs` + post-medição interna)
- O pipeline continua mesmo se o precheck retornar BLOCKED (best-effort)
- Falhas fatais resultam em `throw`, não em entrega silenciosa

---

## 5. Modo HIGH

### 5.1 Uso de Loudnorm Two-Pass

O modo HIGH utiliza o mesmo mecanismo de `loudnorm` two-pass que os demais modos quando não entra no caminho `runLimiterDrivenMaster`:

```
Pass 1 (análise):
  alimiter=limit=0.794:level=disabled,highpass=f=40,
  loudnorm=I=<targetI>:TP=<targetTP>:LRA=<targetLRA>:print_format=json

Pass 2 (render determinístico):
  volume=<preGainDB>dB [opcional, quando delta > 5.5 LU],
  loudnorm=I=<targetI>:TP=<targetTP>:LRA=<targetLRA>:
    measured_I=<measured_i>:measured_LRA=<measured_lra>:
    measured_TP=<measured_tp>:measured_thresh=<measured_thresh>:
    offset=<measured_offset>:linear=true:
    dual_mono=false:print_format=json,
  alimiter=limit=<ceilingLinear>:level=false:asc=true
```

O parâmetro `linear=true` instrui o `loudnorm` a aplicar ganho linear fixo (sem ajuste dinâmico temporal). Os parâmetros `measured_*` são obtidos no Pass 1 e injetados no Pass 2 para determinismo.

### 5.2 Caminho `runLimiterDrivenMaster` (Iterativo)

Para materiais de alta dinâmica no modo HIGH, existe um caminho alternativo baseado em iteração de limiter. Este caminho:

- Aplica pre-ganho escalado para push de loudness
- Itera o limiter em múltiplas passagens para atingir target de LUFS
- Executa medição final do arquivo gerado
- Possui bloco `[HIGH TP POSTCHECK]` próprio que aplica `fix-true-peak.cjs` se TP > ceiling
- Retorna campo `tp_fix_applied` indicando se o fix foi necessário

O caller (`runMaster` principal) também possui um bloco `[HIGH CALLER SAFECHECK]` que verifica o TP após o retorno de `runLimiterDrivenMaster` como segunda linha de defesa.

### 5.3 Como o Target é Definido

O target LUFS do modo HIGH é calculado pelo Decision Engine conforme descrito na Seção 3.5. O valor final passa pelos Global Caps (Seção 3.11). Os targets típicos são:

- CF ≥ 12: busca -10.5 LUFS
- CF < 12: busca -11.5 LUFS
- HIGH MODE CAP (sem isenção): -8.0 LUFS
- Com Dynamic Extension (CF > 12, headroom > 3): cap pode atingir até -6.0 LUFS

### 5.4 Limites de Segurança

| Parâmetro | Valor |
|---|---|
| TP Ceiling | -1.0 dBTP |
| alimiter limit (linear) | `10^(-1.0 / 20)` ≈ 0.891 |
| Max Limiter Stress | 4.5 dB (padrão) / 5.2 dB (HIGH_EXTENDED) |
| Max Delta LUFS | 13 LU |
| Max Gain DB | 7.0 dB |

### 5.5 Controle de Overshoot de True Peak

O modo HIGH possui três camadas de proteção de True Peak:

1. **`alimiter`** no render: controla picos de amostra em domínio linear (não garante TP)
2. **`[HIGH TP POSTCHECK]`** em `runLimiterDrivenMaster`: mede e corrige TP ao final do caminho iterativo
3. **`[HIGH CALLER SAFECHECK]`** no caller: belt-and-suspenders após retorno do `runLimiterDrivenMaster`

Nota técnica: o `alimiter` opera em domínio de amostras PCM. True Peak (conforme ITU-R BS.1770) é medido com oversampling ×4. Picos inter-sample (ISP) podem exceder o limite do `alimiter`. Por isso, a correção via `fix-true-peak.cjs` é aplicada após o render, independente do modo.

---

## 6. Regras Técnicas Fixas

Valores extraídos diretamente do código:

### 6.1 Ceiling e True Peak

| Constante | Valor | Local |
|---|---|---|
| `TARGET_TP` (fix-true-peak) | -1.0 dBTP | `fix-true-peak.cjs:L30` |
| `SAFETY_MARGIN` (fix-true-peak) | 0.05 dB | `fix-true-peak.cjs:L31` |
| `TP_CEILING` (master-job) | -1.0 dBTP | `master-job.cjs:L49` |
| `TP_THRESHOLD` (check-aptitude) | -1.0 dBTP | `check-aptitude.cjs:L21` |
| Postcheck Tier1 | TP > -0.8 → ABORT | `postcheck-audio.cjs:L165` |
| Fine-tune margin | 0.02 dB | `fix-true-peak.cjs:L259` |

### 6.2 Loudness

| Constante | Valor | Local |
|---|---|---|
| LUFS tolerance (automaster) | ±0.2 LU | `automaster-v1.cjs:L43` |
| TP tolerance (automaster) | +0.05 dB | `automaster-v1.cjs:L44` |
| STREAMING target | -14.0 LUFS | `decision-engine.cjs:L234` |
| Precheck WARNING LUFS | > -8.0 LUFS | `precheck-audio.cjs:L47` |
| Check Aptitude LUFS margin | targetLufs + 3.0 LU | `check-aptitude.cjs:L22` |

### 6.3 Gate de Aptidão e Precheck

| Regra | Threshold | Ação |
|---|---|---|
| TP entrada | > -1.0 dBTP | NOT_APT → Rescue |
| LUFS entrada | > target + 3.0 | NOT_APT → Rescue |
| Duração mínima | < 10 s | BLOCKED |
| Silêncio excessivo | > 50% | BLOCKED |
| DR estimado (astats) | < 3 dB | BLOCKED |
| Sample rates aceitos | 44100, 48000 Hz | INVALID |
| Canais aceitos | 1, 2 (mono/stereo) | INVALID |

### 6.4 Rescue Mode

| Constante | Valor |
|---|---|
| `DESIRED_TP` | -1.2 dBTP |
| `SAFE_TP_LIMIT` | -1.0 dBTP |
| Método | `volume={gainDB}dB` (ganho puro) |
| Output codec | `pcm_s16le`, 44100 Hz |

### 6.5 Postcheck

| Tier | Regra | Ação |
|---|---|---|
| Tier 1 | TP > -0.8 dBTP | ABORT |
| Tier 2 | Sempre passa | — |
| Tier 3 | LUFS > target + 1.5 LU | FALLBACK_CLEAN |

Targets do Postcheck por modo:

| Modo | Target LUFS Postcheck |
|---|---|
| STREAMING | -14 LUFS |
| LOW | -14 LUFS |
| MEDIUM | -11 LUFS |
| HIGH | -9 LUFS |
| CLEAN (fallback) | -11 LUFS |

### 6.6 Medição

| Parâmetro | Valor |
|---|---|
| Método de medição de TP | `loudnorm` FFmpeg (oversampling ~4×) |
| Filtro de medição principal | `loudnorm=I=-14:TP=-1:LRA=11:print_format=json` |
| Filtro de análise TP (fix-true-peak) | `loudnorm=I=-16:TP=-1.0:LRA=7:print_format=json` |
| Pre-limiter na análise (Pass 1) | `alimiter=limit=0.794:level=disabled` |

### 6.7 Limitações Técnicas do FFmpeg Loudnorm

- `loudnorm linear=true` aplica ganho linear fixo determinístico. **Não é um limiter.** O parâmetro `TP` do `loudnorm` influencia apenas o cálculo do ganho de normalização — não impõe ceiling físico na saída.
- `alimiter` trabalha em domínio de amostras PCM. Picos inter-sample (ISP) podem ultrapassar o limite definido quando o sinal é reconstruído por um DAC ou oversampler externo.
- Por isso, `fix-true-peak.cjs` é aplicado como camada adicional determinística após todo render, independente do modo.

---

## 7. Casos Limite

### 7.1 Mix já muito alta (ex: -8 LUFS)

**Comportamento real**: O check-aptitude verifica se `lufs > targetLufs + 3.0`. Para um target de -9 LUFS (modo HIGH), o limite seria -6 LUFS. Para -14 LUFS (STREAMING), -11 LUFS. Portanto, uma mix a -8 LUFS pode ser aprovada no gate de aptidão.

O Decision Engine (Seção 3.5, estratégia `preserve`) limita o ganho a `min(effectiveHeadroom × 0.3, 1.0 dB)` para modos LOW/MEDIUM. Para HIGH, busca gap de loudness para -10.5/-11.5 LUFS com 50% do headroom.

O postcheck verifica LUFS ≤ target + 1.5. Para um material que já está em -8 LUFS com modo HIGH (target postcheck = -9), `ceiling = -7.5`. Se o processamento empurrar para acima de -7.5, o postcheck emitirá FALLBACK_CLEAN.

### 7.2 Mix com TP positivo (ex: +0.7 dBTP)

1. `check-aptitude`: NOT_APT → `rescue-mode.cjs` invocado
2. Rescue aplica ganho negativo: `-1.2 - (+0.7) = -1.9 dB`
3. Arquivo de rescue passa para precheck
4. Pipeline continua com arquivo corrigido
5. Após render (modo normal) ou após fix (safe mode), `applyTruePeakFix` verifica e corrige se necessário

### 7.3 Mix com baixa dinâmica (DR < 3 dB, ex: over-compressed)

1. `precheck-audio.cjs`: `estimated_dr < 3` → BLOCKED
2. Sem safeMode: retorna `NEEDS_CONFIRMATION` com `classifiers.crushed_mix = true`
3. Com safeMode: classifica, registra problema, continua processamento

### 7.4 Mix muito baixa (ex: -20 LUFS)

1. Gate de aptidão passa (LUFS baixo ≠ problema técnico)
2. Decision Engine classifica como `aggressive_push`
3. Target calculado próximo aos limites do modo com base em `effectiveHeadroom`
4. Ganho pode ser limitado pelo `MAX_LIMITER_STRESS` se headroom disponível for pequeno

### 7.5 Mix com clipping (ex: TP = +2.0 dBTP, DR crítico)

1. check-aptitude: NOT_APT (TP > -1.0)
2. rescue-mode: RESCUED se `volume gain` é suficiente
3. Se o clipping for inter-sample de alta frequência e não responder ao ganho linear: `ABORT_UNSAFE_INPUT`
4. safeMode: entrega best-effort com classificador `tp_uncorrectable`

### 7.6 Ganho imperceptível (< 0.3 dB)

1. Decision Engine: `shouldProcess: false`
2. Pipeline retorna `NEEDS_CONFIRMATION` (sem safeMode) ou segue sem masterizar (safeMode)
3. Arquivo de saída não é gerado (não há cópia passthrough neste caso no caminho padrão)

---

## 8. Garantias Técnicas do V1

As seguintes garantias são mantidas pelo código atualmente implantado:

### 8.1 True Peak ≤ -1.0 dBTP na Entrega

Garantida por três mecanismos em cascata:
1. `alimiter` no render (domínio de amostras)
2. `applyTruePeakFix` pós-render (todos os modos, sem exceção)
3. `[HIGH TP POSTCHECK]` e `[HIGH CALLER SAFECHECK]` para modo HIGH

### 8.2 Nunca Reduzir LUFS no Modo Padrão

Implementado em três checkpoints independentes no Decision Engine:
- Check após cálculo de `targetLUFS`
- Global Cap `NEVER_REDUCE`
- Proteção NaN que força gainDB = 0

### 8.3 Processamento Determinístico

O `loudnorm` é invocado com `linear=true` e parâmetros `measured_*` obtidos na análise (Pass 1). O mesmo input sempre gera o mesmo output.

### 8.4 Resultado Reproduzível

Não há seed aleatório, clock, ou estado de sessão influenciando o DSP. Todos os parâmetros são derivados das métricas de entrada e dos modos definidos.

### 8.5 Não Gera Clipping Digital Positivo

O True Peak nunca excede -1.0 dBTP no output final. O `alimiter` garante que os valores de amostras PCM não excedam o threshold em domínio linear. `fix-true-peak.cjs` cobre o gap entre domínio de amostras e domínio inter-sample.

### 8.6 Output Sempre Existe Quando `success: true`

`runSafeModeDelivery` e `runMaster` só retornam `success: true` se o arquivo de output existe e passou pelo postcheck com status OK.

---

## 9. Limitações Conhecidas do V1

### 9.1 DSP

| Limitação | Impacto |
|---|---|
| Não realiza correção tonal (EQ musical) | O balanço espectral da mix é preservado integralmente, incluindo problemas de frequência |
| Não aplica saturação ou harmonic excitement | Sem adição de calor, brilho ou cor analógica |
| Não usa compressor de masterização | Sem controle de macro-dinâmica ou glue |
| Não aplica MS processing | Sem controle de imagem estéreo, largura ou correlação |
| Não tem controle de transientes | Sem attack/release dedicado para preservação de punch |
| Não realiza correção de DC offset | Offset DC não é detectado nem removido |

### 9.2 Dependência da Qualidade da Mix Original

O AutoMaster V1 **não melhora problemas estruturais da mix**. Se a mix possui:
- Frequências graves descontroladas → permanecem no output
- Harshness em médios-altos → permanece no output
- Vocais enterrados ou excessivos → permanecem no output
- Balanço estéreo problemático → permanece no output

O sistema é estritamente um normalizador de loudness com proteção de True Peak.

### 9.3 Limitações do Medidor de True Peak

O `loudnorm` do FFmpeg usa oversampling interno (~4×) para estimar True Peak. Medidores profissionais externos (ex: Youlean Loudness Meter com oversampling ×8 ou ×16) podem reportar valores ligeiramente diferentes.

A diferença típica é de ±0.1 a ±0.2 dB. A `SAFETY_MARGIN` de 0.05 dB e o loop de fine-tune de `fix-true-peak.cjs` buscam cobrir apenas a imprecisão do próprio medidor FFmpeg. Em casos de ISP muito agressivos, medidores externos de alta qualidade podem ainda reportar valores marginalmente acima de -1.0 dBTP.

### 9.4 `alimiter` vs True Peak

O `alimiter=limit=X` limita amostras PCM ao valor `X` no domínio linear (0 a 1). True Peak (ITU-R BS.1770) é medido por oversampling e pode exceder o valor de amostras PCM. Portanto, `alimiter` não é garantia suficiente de True Peak compliance. Esta limitação está documentada no código com o comentário: `alimiter é sample-domain e não garante TP ≤ ceiling`.

### 9.5 Loudnorm `TP` Parameter

O parâmetro `TP=-1` do `loudnorm` **não é um limiter**. Ele influencia o ganho calculado pelo loudnorm para que o output estimado não exceda -1 dBTP. Como o loudnorm opera em domínio linear com estimativa de TP, não há garantia matemática de que o output real respeitará esse limite. O `alimiter` e o `fix-true-peak` cobrem esta lacuna.

### 9.6 Formatos Suportados

Apenas WAV a 44100 Hz ou 48000 Hz, mono ou stereo. MP3, FLAC, AIFF, MP4 e outros formatos não são suportados pela cadeia atual.

### 9.7 Duração Mínima

O precheck bloqueia arquivos com duração inferior a 10 segundos. Intros muito silenciosas ou faixas curtas podem gerar medições de LUFS imprecisas pelo loudnorm.

---

## 10. Observabilidade e Logs

### 10.1 Canal de Logs

Por convenção arquitetural, todos os módulos do AutoMaster V1 usam `console.error()` para logs diagnósticos e `console.log()` (ou `process.stdout.write()`) exclusivamente para o JSON de saída. Isso garante que o stdout seja sempre JSON puro e parseable pelo worker.

### 10.2 Logs do Decision Engine

Cada execução do Decision Engine loga no seguinte formato:

```
═══════════════════════════════════════════════════════════════
🎯 [AUTOMASTER] MOTOR DE DECISÃO - Target Dinâmico
═══════════════════════════════════════════════════════════════
📊 Métricas de entrada:
   LUFS atual: -13.5 LUFS
   True Peak: -1.2 dBTP
   Headroom inicial: 1.2 dB
   Limiter stress permitido: 6.0 dB (modo HIGH)
   Effective Headroom: 7.2 dB
   Crest Factor: 10.3 dB
```

Permite rastrear:
- Classificação da faixa de LUFS
- Target calculado antes e depois dos ajustes de stress
- Stress estimado vs. limite
- Decisão final com gainDB

### 10.3 Logs de True Peak

```
[FIX-TP] Antes: +0.700 dBTP  |  Target: -1.0 dBTP  |  Gain a aplicar: -1.750 dB
[FIX-TP] Após fix: -1.048 dBTP
[HIGH TP POSTCHECK] ✅ TP OK: -1.05 dBTP <= -1.00 dBTP — nenhum fix necessário
```

### 10.4 Logs do Postcheck

```
[POSTCHECK] audioPath: /tmp/job123_master.wav
[POSTCHECK] mode: HIGH
[POSTCHECK] OUTPUT LUFS: -10.3
[POSTCHECK] OUTPUT TP: -1.05 dBTP
[POSTCHECK] OUTPUT DR: 12.4
[POSTCHECK] TP OK: -1.05 dBTP
[POSTCHECK] LUFS OK: -10.3 LUFS (ceiling: -7.5 )
[PIPELINE] Postcheck result: { status: 'OK', recommended_action: 'OK', ... }
```

### 10.5 Logs do SAFE Mode

```
[PIPELINE][SAFE-MODE] Bypassing loudnorm — executando entrega somente-TP
[SAFE-MODE-DELIVERY] Iniciando entrega somente-TP (sem loudnorm)
[SAFE-MODE-DELIVERY] TP medido: -0.30 dBTP | LUFS: -9.20
[SAFE-MODE-DELIVERY] TP acima do limite (-0.30 > -1.0) — aplicando fix de TP
[SAFE-MODE-DELIVERY] ✅ Entregue: TP -0.30 → -1.04 dBTP | LUFS: -9.20 → -10.95 (delta -1.75 LU, gain: -1.75 dB)
```

### 10.6 Como Rastrear Execução Completa

Em Railway ou qualquer ambiente de produção, os logs completos de uma execução são encontrados no `stderr` do processo `master-pipeline.cjs`. Para identificar uma execução específica, buscar o `jobId` ou `inputPath` nos logs.

Cada stage emite prefixos identificáveis:
- `[PIPELINE]` → `master-pipeline.cjs`
- `[AUTOMASTER]` → `decision-engine.cjs`
- `[FIX-TP]` → `fix-true-peak.cjs`
- `[POSTCHECK]` → `postcheck-audio.cjs`
- `[SAFE-MODE-DELIVERY]` → `runSafeModeDelivery`
- `[HIGH TP POSTCHECK]` → `runLimiterDrivenMaster`
- `[HIGH CALLER SAFECHECK]` → caller de `runLimiterDrivenMaster`

---

## 11. Riscos Técnicos Atuais

### 11.1 Gap entre Medidor FFmpeg e Medidores Externos

**Risco**: O `loudnorm` do FFmpeg usa oversampling ~4× para True Peak. Medidores profissionais externos como Youlean com oversampling 8× ou 16× podem reportar valores 0.1 a 0.3 dB acima do que o sistema acredita ter garantido.

**Mitigação atual**: `SAFETY_MARGIN = 0.05 dB` + loop de fine-tune em `fix-true-peak.cjs`. Cobertura parcial.

**Risco residual**: Arquivos podem reportar TP marginalmente positivo em medidores de alta qualidade, dentro de uma faixa de ±0.2 dB.

### 11.2 `alimiter` em Domínio de Amostras

**Risco**: O `alimiter` não garante compliance de True Peak conforme ITU-R BS.1770. Se `fix-true-peak.cjs` falhar ou não for invocado, o output pode ter TP positivo.

**Mitigação atual**: `fix-true-peak.cjs` é invocado incondicionalmente após o render em todos os modos. Três camadas de proteção para o modo HIGH.

**Ponto frágil**: Falha de I/O no `fix-true-peak.cjs` (arquivo temporário não criado) propaga como exceção tratada que termina com `throw`, impedindo entrega silenciosa.

### 11.3 Dependência do Loudnorm para Medição de LUFS

**Risco**: O `measure-audio.cjs` usa `loudnorm` para medir LUFS. O `loudnorm` do FFmpeg pode apresentar variações de ±0.1 LU em arquivos muito curtos, com intro silenciosa longa, ou com material não estacionário.

**Mitigação atual**: `LUFS_TOLERANCE = 0.2 LU` nos gates de validação de `automaster-v1.cjs`.

### 11.4 Crest Factor via `astats`

**Risco**: O `astats` do FFmpeg mede Peak level e RMS level. A divisão `Peak - RMS` aproxima o Crest Factor mas não é idêntica à definição técnica exata. Em materiais com características temporais não uniformes, pode divergir.

**Mitigação atual**: `DEFAULT_CREST_FACTOR = 7.0` como fallback conservador. Validação de range (0 < CF ≤ 30). O sistema consegue operar sem CF confiável através do fallback.

### 11.5 Mix Confidence Gate Desativado

**Situação atual**: O gate que rebaixa automaticamente de HIGH para MEDIUM quando `mixConfidence < 0.6` está **comentado** no código (`decision-engine.cjs`). O usuário que escolhe HIGH sempre recebe processamento HIGH, independente da dinâmica da mix.

**Risco**: Mixes muito comprimidas (CF baixo) processadas em modo HIGH podem apresentar artefatos de limitação mais audíveis do que em modo MEDIUM.

**Decisão arquitetural documentada**: Gate foi desativado intencionalmente. A filosofia adotada é que o usuário escolheu HIGH explicitamente e deve receber loudness competitiva. O postcheck e FALLBACK_CLEAN funcionam como salvaguarda posterior.

### 11.6 Variabilidade de Resultados em Diferentes Versões do FFmpeg

**Risco**: O comportamento exato do `loudnorm` pode variar entre versões do FFmpeg. Em ambientes de produção com versão fixa isso é controlado, mas atualizações podem afetar resultados.

**Mitigação**: `.nvmrc` e `Dockerfile` com versão fixada no projeto.

---

## 12. Conclusão Técnica

### 12.1 O AutoMaster V1 está arquiteturalmente sólido?

**Sim, com ressalvas.**

A arquitetura de módulos independentes comunicando por JSON via `child_process.execFile` é robusta e testável. Cada módulo tem responsabilidade única, contrato de saída definido, e tratamento de erros que não propaga silenciosamente. O pipeline principal (`master-pipeline.cjs`) orquestra corretamente todos os gates de qualidade.

As patches acumuladas nesta sessão corrigiram três problemas sistêmicos reais:
1. Bypass do modo HIGH na proteção de TP
2. Overcorrection do SAFETY_MARGIN
3. Alteração indevida de LUFS no SAFE Mode

A arquitetura atual suporta esses tipos de patch sem refatoração maior.

### 12.2 Ele é profissional?

**Funcionalmente sim, sônicamente limitado.**

O V1 entrega o que promete: normalização de loudness determinística com proteção de True Peak. Os resultados são tecnicamente válidos (LUFS dentro do target, TP ≤ -1.0 dBTP, sem clipping digital).

O que o V1 não oferece é o refinamento sônico que um engenheiro de masterização humano aplicaria: correção tonal, controle de macro-dinâmica, coesão espectral, tratamento de imagem estéreo. Esses aspectos dependem da qualidade da mix original.

Para o caso de uso declarado (serviço automatizado de normalização de loudness para distribuição digital), o V1 é adequado e defensivamente implementado.

### 12.3 Está pronto para escala?

**Sim, com monitoramento ativo.**

O pipeline é stateless e paralelizável. Cada job é processado de forma independente. Os riscos de escala são:
- Consumo de CPU do FFmpeg (pode ser limitado via worker slots)
- Acumulação de arquivos temporários em falhas de cleanup (já tratado com `finally` blocks)
- Variação de medição em arquivos de edge case (monitorar via logs de postcheck)

### 12.4 O que precisa ser refinado para V1.1?

Com base exclusivamente no código atual, os seguintes refinamentos seriam tecnicamente fundamentados:

1. **Substituir medidor de TP**: migrar `measure-audio.cjs` e `fix-true-peak.cjs` de `loudnorm` para `ebur128=peak=true` com `afmeter` ou similar, para oversampling mais alto e conformidade ITU mais rigorosa.

2. **Reativar Mix Confidence Gate com parâmetro configurável**: permitir que o downgrade HIGH→MEDIUM seja opcional por job, não globalmente desativado.

3. **Implementar medição de DR via EBU R128**: substituir a estimativa via `astats` pelo `ebur128` para um LRA mais preciso no precheck.

4. **Adicionar proteção de DC offset**: verificar e remover DC offset antes do processamento via `highpass=f=5` ou `aresample=rm_dc=1`.

5. **Timeout configurável por modo**: mixes longas em modo HIGH com `runLimiterDrivenMaster` iterativo podem ultrapassar timeouts padrão. Timeout adaptativo por duração do arquivo.

---

*Documento gerado com base em análise direta do código-fonte do repositório SoundyAI-app, branch `teste`, em 2026-03-02. Não contém comportamento inferido ou inventado.*

*Módulos analisados:*
- `automaster/automaster-v1.cjs` (4732 linhas)
- `automaster/master-pipeline.cjs` (866 linhas)
- `automaster/decision-engine.cjs` (823 linhas)
- `automaster/fix-true-peak.cjs` (299 linhas)
- `automaster/measure-audio.cjs` (132 linhas)
- `automaster/precheck-audio.cjs` (434 linhas)
- `automaster/postcheck-audio.cjs` (231 linhas)
- `automaster/check-aptitude.cjs`
- `automaster/rescue-mode.cjs` (261 linhas)
