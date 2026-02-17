# AUTOMASTER V1 — Audit Técnico Completo

**Data:** 2026-02-06  
**Escopo:** Auditoria do funil AutoMaster V1 — targets, adapter, recomendação, orquestração  
**Status:** ✅ COMPLETE

---

## 1. Onde os Targets Vivem

### Fonte de Verdade: `work/refs/out/<genre>.json`

| Gênero | Arquivo | `lufs_target` |
|--------|---------|:------------:|
| progressive_trance | `progressive_trance.json` | -8.5 |
| funk_mandela | `funk_mandela.json` | -9.2 |
| funk_bruxaria | `funk_bruxaria.json` | -9.3 |
| edm | `edm.json` | -9.0 |
| funk_bh | `funk_bh.json` | varia |
| eletrofunk | `eletrofunk.json` | varia |
| funk_consciente | `funk_consciente.json` | varia |
| trap | `trap.json` | -10.5 |
| tech_house | `tech_house.json` | varia |
| fullon | `fullon.json` | varia |
| house | `house.json` | varia |
| brazilian_phonk | `brazilian_phonk.json` | varia |
| rap_drill | `rap_drill.json` | varia |
| **default** | `default.json` | fallback |

### Legacy Key Mappings (`genres.json`)

| Legacy Key | Resolve Para |
|-----------|-------------|
| trance | progressive_trance |
| funk_automotivo | edm |
| techno | fullon |
| phonk | rap_drill |

### Outras Cópias (NÃO são fonte de verdade)

- `public/refs/out/` — cópia pública (frontend)
- `backup-pre-logger/refs/out/` — backup histórico

**Regra:** O AutoMaster lê APENAS de `work/refs/out/`. Nunca escreve, nunca modifica.

---

## 2. Schema dos Targets

```json
{
  "<genreKey>": {
    "lufs_target": -10.5,
    "true_peak_target": -1.0,
    "dr_target": 8,
    "tol_lufs": 2.0,
    "tol_true_peak": 0.3,
    "tol_dr": 2.0,
    "bands": {
      "sub": { "min": -3, "max": 3, "weight": 0.8 },
      "low_bass": { ... },
      "upper_bass": { ... },
      "low_mid": { ... },
      "mid": { ... },
      "high_mid": { ... },
      "brilho": { ... },
      "presenca": { ... }
    },
    "hybrid_processing": {
      "enabled": true,
      "original_metrics": { ... },
      "genre_profile": { ... }
    },
    "legacy_compatibility": {
      "lufs_target": -10.5,
      "tol_lufs": 2.0,
      ...
    }
  }
}
```

**Campos usados pelo AutoMaster V1:**
- `lufs_target` → target LUFS para masterização
- `tol_lufs` → tolerância (fallback: 1.5 LU)
- **TP ceiling fixo -1.0 dBTP** (não vem do JSON)

---

## 3. Cadeia do Analisador (NÃO MODIFICADA)

```
genre-targets-loader.js → normalize-genre-targets.js → resolveTargets.js
    → compareWithTargets.js → metric-classifier.js → scoring.js (1315 linhas)
```

O AutoMaster V1 **NÃO interfere** nesta cadeia. Ele usa `targets-adapter.cjs` que lê diretamente os JSONs.

---

## 4. Componentes do AutoMaster V1

### 4.1 `targets-adapter.cjs`

**Finalidade:** Ler targets do gênero sem modificar nada.

- Entrada: `genreKey`, `mode`
- Saída: `{ genreKey, targetLufs, tpCeiling: -1.0, tolerances, source }`
- Resolve legacy keys via `genres.json`
- **O modo NÃO altera targetLufs** — só referência

### 4.2 `recommend-mode.cjs`

**Finalidade:** Recomendação determinística de modo baseada em métricas.

- Entrada: `lufs_i`, `true_peak_db`, `targetLufs`
- Saída: `{ recommended_mode, reason_codes, user_copy, safe_note }`
- Regras:
  - VERY_LOUD ou LOW_HEADROOM → STREAMING
  - LOUD → BALANCED
  - DYNAMIC + GOOD_HEADROOM → BALANCED (nota sobre IMPACT)
  - Default → BALANCED

### 4.3 `master-job.cjs` (Orquestrador)

**Finalidade:** Funil completo com duas fases.

#### Phase A: PRECHECK (sem crédito)

```
inputPath + genreKey + mode?
    → targets-adapter (genre targets)
    → measure-audio (métricas)
    → check-aptitude (gate, usa genre targetLufs)
    → recommend-mode (recomendação)
    → JSON com next_actions
```

**Contrato de saída:**
```json
{
  "phase": "PRECHECK",
  "ok": true,
  "genreKey": "trap",
  "targets": { "targetLufs": -10.5, "tpCeiling": -1 },
  "measured": { "lufs_i": -11.75, "true_peak_db": -1.03 },
  "aptitude": { "isApt": true, "reasons": [] },
  "recommendation": { "recommended_mode": "STREAMING", "reason_codes": [...], "user_copy": "..." },
  "next_actions": ["CONFIRM_MODE", "START_PROCESS"],
  "processing_ms": 5909
}
```

#### Phase C: PROCESS (consome crédito)

```
inputPath + outputPath + genreKey + mode + rescue?
    → targets-adapter (genre targets)
    → measure-audio
    → check-aptitude (genre targetLufs)
    → rescue-mode (se autorizado e necessário)
    → automaster-v1.cjs (core DSP, com genre targetLufs + TP -1.0)
    → postcheck (modo) + genre-aware override
    → CLEAN fallback (se necessário, max 2 renders)
    → JSON com summary_user
```

**Contrato de saída (sucesso):**
```json
{
  "phase": "PROCESS",
  "ok": true,
  "status": "DELIVERED_PRIMARY",
  "mode": "BALANCED",
  "genreKey": "trap",
  "targets": { "targetLufs": -10.5, "tpCeiling": -1 },
  "render_count": 1,
  "summary_user": {
    "modo": "Balanced",
    "genero": "trap",
    "lufs_target": -10.5,
    "lufs_final": -10.61,
    "tp_final": -0.99,
    "decisao": "Entregue (render primário)"
  },
  "processing_ms": 30636
}
```

### 4.4 Genre-Aware Override

O `postcheck-audio.cjs` compara LUFS final contra `MODE_TARGETS` (BALANCED=-11, etc.).
Quando usamos genre targets (ex: funk_mandela=-9.2), o postcheck pode flagear "LUFS fora do alvo".

O `master-job.cjs` aplica um override:
1. **NUNCA sobrescreve ABORT** (tier1, segurança)
2. Se tier1 OK e LUFS final dentro da tolerância do gênero → **OK**
3. Caso contrário → mantém decisão original

**Isso evita modificar o postcheck.cjs existente** enquanto corrige o gap de targets.

---

## 5. Scripts Existentes (NÃO MODIFICADOS)

| Script | Finalidade | Contrato |
|--------|-----------|----------|
| `measure-audio.cjs` | Mede LUFS-I e True Peak via FFmpeg | `{ lufs_i, true_peak_db }` |
| `check-aptitude.cjs` | Gate conservador (TP > -1.0 ou LUFS > target+3) | `{ isApt, reasons, recommended_actions }` |
| `rescue-mode.cjs` | Gain-only para criar headroom (desired TP -1.2) | `{ status: RESCUED/ABORT_UNSAFE }` |
| `automaster-v1.cjs` | Core DSP two-pass loudnorm | `{ success, final_lufs, final_tp }` |
| `run-automaster.cjs` | Wrapper com MODE_PRESETS (legacy) | `{ success, mode, ... }` |
| `postcheck-audio.cjs` | Validação pós-render (3 tiers) | `{ status, recommended_action }` |
| `fix-true-peak.cjs` | Aplica ganho negativo para TP | `{ status: FIXED/OK }` |
| `precheck-audio.cjs` | Gate pré-análise (duração, SR, DR) | `{ status: BLOCKED/OK }` |

---

## 6. Regras Imutáveis V1

1. **TP ceiling = -1.0 dBTP** para TODOS os modos
2. **Modo NÃO altera targets** — só estratégia DSP
3. **Max 2 renders** por job (primary + CLEAN fallback)
4. **stdout = JSON puro** (SEMPRE, sem banners/emojis/logs)
5. **NÃO alterar** refs/out, analisador, scoring
6. **NÃO renomear** refs/out nem mover targets
7. **Erros vão para stderr** (JSON formatado)

---

## 7. Testes

Suite: `automaster/tests/test-automaster-suite.cjs`

```bash
node test-automaster-suite.cjs              # Testes rápidos (sem processamento)
node test-automaster-suite.cjs --with-audio  # Testes completos (requer WAV)
```

**Resultados (2026-02-06):** 23/23 passando ✅

| Categoria | Testes | Status |
|-----------|:------:|:------:|
| targets-adapter | 7 | ✅ |
| recommend-mode | 6 | ✅ |
| master-job (PRECHECK) | 7 | ✅ |
| master-job (PROCESS) | 3 | ✅ |

---

## 8. Fluxo Completo (Funil)

```
Seleção de Gênero → Upload WAV → PRECHECK (grátis)
    → Mostra recomendação ao usuário
    → Usuário confirma modo
    → PROCESS (consome crédito)
        → Rescue se necessário (com autorização)
        → Masterização (genre targets + modo DSP)
        → Postcheck + genre-aware override
        → CLEAN fallback se necessário
    → Preview → Entrega
```

---

## 9. Limitações Conhecidas (V1)

1. Postcheck usa `MODE_TARGETS` internamente — o override genre-aware compensa mas não é ideal
2. `run-automaster.cjs` usa presets fixos por modo — `master-job.cjs` chama `automaster-v1.cjs` diretamente
3. Métricas espectrais (bands, harsh_2_4k, sub_retention) retornam `not_available` no postcheck
4. Rescue mode só aplica ganho — não corrige limitação prévia ou ISP
5. Sem análise espectral pré-master (apenas LUFS-I + TP)

---

## 10. Arquivos Criados/Modificados

| Arquivo | Ação | Linhas |
|---------|------|:------:|
| `automaster/targets-adapter.cjs` | CRIADO | ~268 |
| `automaster/recommend-mode.cjs` | CRIADO | ~130 |
| `automaster/master-job.cjs` | CRIADO | ~530 |
| `automaster/tests/test-automaster-suite.cjs` | CRIADO | ~310 |
| `AUTOMASTER_AUDIT.md` | CRIADO | este arquivo |
| Todos os scripts existentes | **NÃO MODIFICADOS** | — |
| `work/refs/out/*` | **NÃO MODIFICADOS** | — |
