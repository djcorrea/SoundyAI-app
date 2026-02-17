# AutoMaster V1 - Gate de Aptidão + Rescue Mode

## Visão Geral

Sistema conservador de guardrails técnicos que **bloqueia** masterização quando o áudio de entrada não está tecnicamente apto, oferecendo um **Rescue Mode (gain-only)** seguro para criar headroom.

## Filosofia

- **Zero risco de degradação sonora**
- **Bloquear é melhor que "corrigir" com processamento arriscado**
- **Rescue Mode usa APENAS ganho** (volume), nunca limiter/compressor/EQ
- **Transparência total**: todas as decisões são explícitas e rastreáveis

---

## Componentes

### 1. `measure-audio.cjs`

**Objetivo**: Medir True Peak (dBTP) e Integrated Loudness (LUFS-I) usando FFmpeg loudnorm.

**Uso CLI**:
```bash
node automaster/measure-audio.cjs <input.wav>
```

**Saída JSON**:
```json
{
  "lufs_i": -13.15,
  "true_peak_db": -0.8
}
```

---

### 2. `check-aptitude.cjs`

**Objetivo**: Determinar se áudio está APTO para masterização segura.

**Regras Conservadoras**:
- Se `TPK_in > -1.0 dBTP` → **NÃO_APTA** (risco de clipping)
- Se `LUFS_I_in > (targetLUFS + 3.0)` → **NÃO_APTA** (já muito alto)
- Caso contrário → **APTA**

**Uso CLI**:
```bash
node automaster/check-aptitude.cjs <lufs_i> <true_peak_db> <target_lufs>
```

**Exemplo**:
```bash
node automaster/check-aptitude.cjs -6.81 -0.74 -11
```

**Saída JSON (NÃO_APTA)**:
```json
{
  "isApt": false,
  "reasons": [
    "TRUE_PEAK_TOO_HIGH (-0.74 dBTP > -1 dBTP)",
    "LUFS_TOO_HIGH (-6.81 LUFS > -8 LUFS)"
  ],
  "recommended_actions": [
    "RUN_RESCUE_GAIN_ONLY",
    "REUPLOAD_PREMASTER"
  ],
  "measured": {
    "lufs_i": -6.81,
    "true_peak_db": -0.74
  },
  "thresholds": {
    "tp_max": -1,
    "lufs_max": -8
  }
}
```

**Exit code**: `0` se APTA, `1` se NÃO_APTA

---

### 3. `rescue-mode.cjs`

**Objetivo**: Criar headroom técnico aplicando **APENAS ganho (volume)**.

**Filosofia**:
- NÃO usa limiter, compressor, EQ ou saturação
- APENAS atenuação por volume
- Se não resolver com ganho simples → **ABORTAR**

**Fluxo**:
1. Medir True Peak atual
2. Calcular ganho: `desired_tp (-1.2 dBTP) - TP_in`
3. Aplicar ganho negativo (se necessário)
4. Medir novamente
5. Se `TP_after > -1.0 dBTP` → **ABORT** (ISP/clipping não corrigível)
6. Se OK → retornar arquivo temporário

**Uso CLI**:
```bash
node automaster/rescue-mode.cjs <input.wav> <output_tmp.wav>
```

**Saída JSON (SUCESSO)**:
```json
{
  "status": "RESCUED",
  "message": "Headroom técnico criado com sucesso via gain-only.",
  "tp_before": -0.74,
  "tp_after": -1.2,
  "gain_applied_db": -0.46,
  "output_file": "bass_rescue.wav",
  "output_path": "/path/to/bass_rescue.wav"
}
```

**Saída JSON (ABORT)**:
```json
{
  "status": "ABORT_UNSAFE_INPUT",
  "message": "Arquivo possui picos inter-sample ou limitação prévia...",
  "tp_before": -0.2,
  "tp_after": -0.8,
  "gain_applied_db": -1.0,
  "output_file": null,
  "details": "Mesmo após atenuação, True Peak continua acima do limite."
}
```

**Exit code**: `0` se RESCUED/ALREADY_SAFE, `1` se ABORT

---

### 4. `master-pipeline.cjs` (atualizado)

**Novo parâmetro**: `--rescue`

**Uso CLI**:
```bash
# SEM rescue mode (bloqueia se NÃO_APTA)
node automaster/master-pipeline.cjs <input.wav> <output.wav> <MODE>

# COM rescue mode (tenta corrigir via gain-only)
node automaster/master-pipeline.cjs <input.wav> <output.wav> <MODE> --rescue
```

**Exemplo 1: Arquivo NÃO_APTA (sem rescue)**:
```bash
node automaster/master-pipeline.cjs "musicas/bass.wav" "out/bass.wav" BALANCED
```

**Saída**:
```json
{
  "ok": false,
  "status": "NOT_APT",
  "mode": "BALANCED",
  "reasons": ["TRUE_PEAK_TOO_HIGH (-0.74 dBTP > -1 dBTP)"],
  "measured": {
    "lufs_i": -6.81,
    "true_peak_db": -0.74
  },
  "recommended_actions": [
    "RUN_RESCUE_GAIN_ONLY",
    "REUPLOAD_PREMASTER"
  ],
  "processing_ms": 5107
}
```

**Exit code**: `1`

**Exemplo 2: Rescue Mode habilitado (sucesso)**:
```bash
node automaster/master-pipeline.cjs "musicas/bass.wav" "out/bass.wav" BALANCED --rescue
```

**Saída**:
```json
{
  "ok": true,
  "success": true,
  "mode": "BALANCED",
  "aptitude_check": {
    "isApt": false,
    "reasons": ["TRUE_PEAK_TOO_HIGH (-0.74 dBTP > -1 dBTP)"]
  },
  "rescue_mode_used": true,
  "rescue_result": {
    "status": "RESCUED",
    "tp_before": -0.74,
    "tp_after": -1.2,
    "gain_applied_db": -0.46
  },
  "final_decision": "DELIVERED_PRIMARY"
}
```

**Exit code**: `0`

---

## Casos de Uso

### Caso 1: Arquivo APTO (tudo OK)

```bash
# Medir
node automaster/measure-audio.cjs "input.wav"
# → {"lufs_i": -15.0, "true_peak_db": -3.5}

# Checar aptidão
node automaster/check-aptitude.cjs -15.0 -3.5 -11
# → {"isApt": true}

# Masterizar normalmente
node automaster/master-pipeline.cjs "input.wav" "output.wav" BALANCED
# → Sucesso, sem rescue mode necessário
```

---

### Caso 2: Arquivo NÃO_APTA → Bloquear

```bash
# Medir
node automaster/measure-audio.cjs "loud_input.wav"
# → {"lufs_i": -6.8, "true_peak_db": -0.7}

# Checar aptidão
node automaster/check-aptitude.cjs -6.8 -0.7 -11
# → {"isApt": false, "reasons": ["TRUE_PEAK_TOO_HIGH", "LUFS_TOO_HIGH"]}

# Tentar masterizar SEM rescue
node automaster/master-pipeline.cjs "loud_input.wav" "output.wav" BALANCED
# → Exit 1, status "NOT_APT", recomenda RUN_RESCUE_GAIN_ONLY
```

---

### Caso 3: Rescue Mode (sucesso)

```bash
# Executar pipeline COM rescue mode
node automaster/master-pipeline.cjs "loud_input.wav" "output.wav" BALANCED --rescue

# Fluxo interno:
# 1. Medir: LUFS -6.8, TP -0.7
# 2. Check aptitude: NÃO_APTA
# 3. Rescue mode: aplica gain -0.5 dB → TP passa para -1.2
# 4. Precheck no arquivo rescatado: OK
# 5. Masterização normal
# 6. Postcheck: OK
# → Sucesso, arquivo entregue
```

---

### Caso 4: Rescue Mode → ABORT (não corrigível)

```bash
# Arquivo com ISP/clipping severo
node automaster/master-pipeline.cjs "clipped.wav" "output.wav" BALANCED --rescue

# Fluxo interno:
# 1. Rescue mode aplica gain
# 2. Mede novamente: TP ainda > -1.0 dBTP
# 3. Status: ABORT_UNSAFE_INPUT
# → Exit 1, mensagem: "Reenvie pré-master sem processamento"
```

---

## Thresholds e Constantes

| Parâmetro | Valor | Localização |
|-----------|-------|-------------|
| **TP máximo aceitável** | `-1.0 dBTP` | `check-aptitude.cjs` |
| **LUFS margem** | `+3.0 LU` acima do target | `check-aptitude.cjs` |
| **Rescue TP desejado** | `-1.2 dBTP` | `rescue-mode.cjs` |
| **Rescue TP limite seguro** | `-1.0 dBTP` | `rescue-mode.cjs` |

---

## Mapeamento de Modos → Target LUFS

| Modo | Target LUFS |
|------|-------------|
| **STREAMING** | `-14 LUFS` |
| **BALANCED** | `-11 LUFS` |
| **IMPACT** | `-9 LUFS` |

---

## Testes Executados

### Teste 1: Arquivo "you loudnes.wav"
- **Medição**: LUFS `-13.15`, TP `-0.8`
- **Aptitude**: NÃO_APTA (TP muito alto)
- **Rescue**: TP `-0.8` → `-1.2` (ganho `-0.4 dB`)
- **Resultado**: Arquivo rescatado criado com sucesso

### Teste 2: Arquivo "bass sequencia do soca soca.wav"
- **Medição**: LUFS `-6.81`, TP `-0.74`
- **Aptitude**: NÃO_APTA (TP alto + LUFS alto)
- **Rescue**: TP `-0.74` → `-1.2` (ganho `-0.46 dB`)
- **Pipeline com --rescue**: **SUCESSO**
  - Precheck após rescue: WARNING (LUFS `-7.27`, TP `-1.2`)
  - Masterização: LUFS final `-11`, TP final `-4.93`
  - Postcheck: OK
  - Final decision: DELIVERED_PRIMARY

### Teste 3: Pipeline SEM rescue mode
- **Input**: "bass sequencia do soca soca.wav"
- **Resultado**: Status `NOT_APT`, exit code `1`
- **Recomendações**: `RUN_RESCUE_GAIN_ONLY`, `REUPLOAD_PREMASTER`

---

## Integração com Backend/UI

### Fluxo Recomendado

1. **Upload do arquivo WAV**
2. **Medir e checar aptidão** (via `measure-audio.cjs` + `check-aptitude.cjs`)
3. Se **APTA**: masterizar normalmente
4. Se **NÃO_APTA**:
   - Exibir mensagem ao usuário:
     - "Seu áudio possui True Peak muito alto (-0.7 dBTP)"
     - "Recomendamos: reenviar pré-master OU tentar Rescue Mode (gain-only)"
   - Oferecer botão: **"Tentar Rescue Mode"**
5. Se usuário aceitar Rescue Mode:
   - Executar pipeline com `--rescue`
   - Se **RESCUED**: masterizar e entregar
   - Se **ABORT_UNSAFE_INPUT**: exibir erro e pedir reupload

---

## Garantias

✅ **Zero risco de degradação sonora**: Rescue Mode usa APENAS ganho  
✅ **Bloqueio conservador**: Preferimos bloquear a "corrigir" de forma arriscada  
✅ **Transparência total**: Todas as decisões e métricas são rastreáveis  
✅ **Determínistico**: Mesmo input → mesmo output  
✅ **Sem IA ou heurística criativa**: Apenas regras técnicas claras  

---

## Comandos Rápidos

```bash
# Medir áudio
node automaster/measure-audio.cjs "input.wav"

# Checar aptidão (BALANCED = target -11 LUFS)
node automaster/check-aptitude.cjs <lufs> <tp> -11

# Rescue mode standalone
node automaster/rescue-mode.cjs "input.wav" "output_rescue.wav"

# Pipeline completo SEM rescue
node automaster/master-pipeline.cjs "input.wav" "output.wav" BALANCED

# Pipeline completo COM rescue
node automaster/master-pipeline.cjs "input.wav" "output.wav" BALANCED --rescue
```

---

## Arquivos Criados/Modificados

### Novos arquivos:
- `automaster/measure-audio.cjs`
- `automaster/check-aptitude.cjs`
- `automaster/rescue-mode.cjs`

### Arquivos modificados:
- `automaster/master-pipeline.cjs`

### Arquivos NÃO modificados (mantidos):
- `automaster/precheck-audio.cjs`
- `automaster/fix-true-peak.cjs`
- `automaster/run-automaster.cjs`
- `automaster/automaster-v1.cjs`
- `automaster/postcheck-audio.cjs`

---

**Implementado por**: GitHub Copilot  
**Data**: 12 de fevereiro de 2026  
**Versão**: AutoMaster V1 + Gate de Aptidão + Rescue Mode
