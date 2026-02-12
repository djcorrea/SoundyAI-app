# 🎚️ AUDITORIA COMPLETA: SoundyAI → AutoMaster V1
**Data:** 05 de fevereiro de 2026  
**Objetivo:** Auditoria técnica para evolução do produto para módulo de Masterização Automática (AutoMaster V1)  
**Escopo:** SOMENTE AUDITORIA - NÃO implementar nada ainda

---

## 📋 SUMÁRIO EXECUTIVO

### ✅ Conclusão Principal
O sistema SoundyAI **está pronto para evolução para AutoMaster V1** com arquitetura sólida e bem definida. A plataforma atual já possui:
- ✅ Pipeline de análise profissional completo e testado
- ✅ Sistema de targets por gênero maduro e calibrado
- ✅ Infraestrutura escalável (workers, filas, storage)
- ✅ Contratos de dados bem definidos e versionados
- ✅ Sistema de planos e gating funcional

### 🎯 Compatibilidade com AutoMaster V1
**EXCELENTE** - Arquitetura permite adicionar processamento de áudio sem refatorações críticas.  
**Risco:** Baixo, desde que seguido o plano de implementação proposto.

### 📊 Resumo de Gaps
| Categoria | Gap Identificado | Complexidade | Prioridade |
|-----------|-----------------|--------------|-----------|
| **Engine DSP** | Falta motor de processamento de áudio | Alta | P0 |
| **Rota/API** | Criar endpoint separado `/api/automaster` | Baixa | P0 |
| **Worker** | Isolar worker de processamento | Média | P0 |
| **Storage** | Sistema de versionamento de arquivos (original vs masterizado) | Baixa | P1 |
| **UI** | Criar fluxo separado para AutoMaster | Média | P1 |
| **Targets** | Adaptar targets para parâmetros de processamento | Média | P1 |
| **Segurança** | Validação de limites (clipping, distorção) | Alta | P0 |

---

## A) MAPA DO SISTEMA ATUAL

### 📐 Diagrama de Fluxo (Upload → Análise → Resultados → UI)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (HTML/JS)                                │
│  - index.html (main app)                                                 │
│  - audio-analyzer-integration.js (controller principal)                 │
│  - scoring/display de resultados (tabela, cards, modal)                 │
└───────────────────────┬──────────────────────────────────────────────────┘
                        │ 1. Upload de áudio
                        │ POST /api/audio/presign (obter URL assinada)
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SERVIDOR EXPRESS (server.js)                          │
│  - Porta: 3000 (dev), Railway (prod)                                    │
│  - CORS: Configurado por ambiente                                       │
│  - Middlewares: express.json, cors, rate limiting                       │
└───────────────────────┬──────────────────────────────────────────────────┘
                        │ 2. Upload direto ao B2 via presigned URL
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKBLAZE B2 (Storage)                                │
│  - Bucket: configurado via .env                                         │
│  - Arquivos: *.wav, *.flac, *.mp3 (max 150MB)                          │
│  - Chave: uploads/<uuid>/<filename>                                     │
└───────────────────────┬──────────────────────────────────────────────────┘
                        │ 3. Após upload, frontend chama análise
                        │ POST /api/audio/analyze
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              ROTA DE ANÁLISE (work/api/audio/analyze.js)                │
│                                                                          │
│  ✅ VALIDAÇÕES:                                                          │
│     - Firebase Auth (uid)                                               │
│     - Plano do usuário (canUseAnalysis)                                 │
│     - Rate limiting (Redis)                                             │
│     - Tipo de arquivo (.wav, .flac, .mp3)                              │
│                                                                          │
│  ✅ GATING POR PLANO:                                                    │
│     - FREE: 1 análise full/mês → reduced mode                          │
│     - PLUS: 20 análises full/mês → reduced mode                        │
│     - PRO: 60 análises full/mês → reduced mode                         │
│     - STUDIO: 400 análises full/mês → hard cap                         │
│                                                                          │
│  ✅ CRIAÇÃO DO JOB:                                                      │
│     1. Gera UUID para jobId (PostgreSQL)                               │
│     2. Enfileira no Redis (BullMQ) → queue: 'audio-analyzer'           │
│     3. Insere registro no PostgreSQL (tabela: jobs)                    │
│     4. Retorna jobId ao frontend                                       │
└───────────────────────┬──────────────────────────────────────────────────┘
                        │ 4. Job enfileirado no Redis
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    REDIS/BULLMQ (Upstash)                                │
│  - Queue: 'audio-analyzer'                                              │
│  - Concorrência: 5 workers simultâneos                                  │
│  - Retry: 3 tentativas                                                  │
│  - Timeout: 2 minutos                                                   │
└───────────────────────┬──────────────────────────────────────────────────┘
                        │ 5. Worker pega job da fila
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    WORKER (work/worker.js)                               │
│                                                                          │
│  ✅ PROCESSAMENTO:                                                       │
│     1. Download do arquivo do B2                                       │
│     2. Chamada do pipeline completo                                    │
│     3. Atualização do status no PostgreSQL                             │
│     4. Enriquecimento com IA (opcional)                                │
│     5. Salvamento do resultado final                                   │
│                                                                          │
│  ✅ ISOLAMENTO:                                                          │
│     - Processo separado do servidor                                    │
│     - Pode rodar em máquina diferente                                  │
│     - Fail-safe: crashes não derrubam o servidor                       │
└───────────────────────┬──────────────────────────────────────────────────┘
                        │ 6. Processamento via pipeline
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│            PIPELINE COMPLETO (api/audio/pipeline-complete.js)            │
│                                                                          │
│  🎯 FASE 5.1: DECODIFICAÇÃO (audio-decoder.js)                          │
│     - Suporta: WAV, FLAC, MP3                                          │
│     - Output: PCM Float32Array (normalizado [-1, 1])                   │
│     - Sample rate: mantém original ou reamostra para 48kHz             │
│                                                                          │
│  🎯 FASE 5.2: SEGMENTAÇÃO TEMPORAL (temporal-segmentation.js)           │
│     - FFT frames: janelas 4096 samples, hop 1024                       │
│     - RMS frames: janelas 300ms, hop 100ms (overlap 75%)               │
│     - Windowing: Hann window                                           │
│                                                                          │
│  🎯 FASE 5.3: CORE METRICS (core-metrics.js)                            │
│     ┌──────────────────────────────────────────────────────┐           │
│     │ BUFFER RAW (original):                               │           │
│     │  - LUFS ITU-R BS.1770-4 (K-weighting)               │           │
│     │  - True Peak (FFmpeg ebur128, 4x oversampling)      │           │
│     │  - Dynamic Range (TT-DR: Peak RMS - Avg RMS)        │           │
│     │  - LRA (Loudness Range Analysis)                    │           │
│     │  - RMS Average / Peak                               │           │
│     │  - Sample Peak L/R                                  │           │
│     └──────────────────────────────────────────────────────┘           │
│     ↓ NORMALIZAÇÃO a -23 LUFS                                          │
│     ┌──────────────────────────────────────────────────────┐           │
│     │ BUFFER NORMALIZADO:                                  │           │
│     │  - Bandas Espectrais (8 bandas) em dBFS             │           │
│     │  - Spectral Centroid / Rolloff / Flatness           │           │
│     │  - Stereo Analysis (correlation, width, balance)    │           │
│     │  - FFT Aggregated Metrics                           │           │
│     │  - DC Offset                                        │           │
│     └──────────────────────────────────────────────────────┘           │
│                                                                          │
│  🎯 FASE 5.4: JSON OUTPUT + SCORING (json-output.js)                    │
│     - Monta technicalData completo                                     │
│     - Carrega targets do gênero (work/refs/out/<genre>.json)          │
│     - Calcula deltas (valor - target)                                 │
│     - Computa score (0-100) via scoring.js                            │
│     - Gera sugestões priorizadas                                      │
│     - Retorna JSON completo                                           │
└───────────────────────┬──────────────────────────────────────────────────┘
                        │ 7. JSON completo retorna ao worker
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PERSISTÊNCIA (PostgreSQL)                             │
│  - Tabela: jobs                                                         │
│  - Campos:                                                              │
│    • id (uuid)                                                          │
│    • file_key (B2 path)                                                │
│    • status (pending → processing → completed/failed)                  │
│    • result (JSONB) ← TODO o JSON aqui                                │
│    • genre (TEXT)                                                       │
│    • mode (genre/reference/comparison)                                 │
│    • user_id (Firebase UID)                                            │
│    • created_at / updated_at                                           │
└───────────────────────┬──────────────────────────────────────────────────┘
                        │ 8. Frontend faz polling via GET /api/jobs/:id
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ROTA DE STATUS (api/jobs/[id].js)                    │
│  - Retorna status + result do job                                      │
│  - Frontend atualiza UI conforme status                                │
│  - Quando completed: exibe resultados completos                        │
└───────────────────────┬──────────────────────────────────────────────────┘
                        │ 9. Renderização dos resultados
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    UI DE RESULTADOS (Frontend)                           │
│                                                                          │
│  ✅ COMPONENTES PRINCIPAIS:                                              │
│     - Score circular (0-100%) + classificação                          │
│     - Tabela de métricas vs targets vs deltas                          │
│     - Cards de métricas principais                                     │
│     - Modal de detalhes (bandas, stereo, etc.)                         │
│     - Sistema de sugestões priorizadas                                 │
│     - Chatbot contextual (recebe métricas/deltas)                      │
│     - Botão de download de PDF                                         │
│                                                                          │
│  ✅ MODO COMPARAÇÃO:                                                     │
│     - Tabela lado-a-lado (track vs reference)                         │
│     - Deltas coloridos (verde/amarelo/vermelho)                        │
│     - Sugestões baseadas nas diferenças                                │
└──────────────────────────────────────────────────────────────────────────┘
```

### 📁 Principais Arquivos e Responsabilidades

#### **Backend (Node.js + Express)**

| Arquivo | Responsabilidade | Linhas | Status |
|---------|-----------------|--------|--------|
| `server.js` | Servidor principal, rotas, CORS, validação de env | 1004 | ✅ Produção |
| `work/api/audio/analyze.js` | Endpoint de análise, autenticação, gating, enfileiramento | 988 | ✅ Produção |
| `work/worker.js` | Worker BullMQ, download B2, pipeline, persistência | 1480 | ✅ Produção |
| `api/audio/pipeline-complete.js` | Orquestração 4 fases (decode → segment → metrics → json) | ~1800 | ✅ Produção |
| `api/audio/audio-decoder.js` | Decodificação WAV/FLAC/MP3 → PCM Float32 | ~400 | ✅ Produção |
| `api/audio/temporal-segmentation.js` | FFT + RMS frames (janelamento, hop, overlap) | ~300 | ✅ Produção |
| `api/audio/core-metrics.js` | Cálculo LUFS/TruePeak/DR/Bandas/Stereo | ~1500 | ✅ Produção |
| `api/audio/json-output.js` | Montagem JSON final + scoring + sugestões | 606 | ✅ Produção |
| `lib/audio/features/loudness.js` | LUFS ITU-R BS.1770-4 (K-weighting, gating) | ~500 | ✅ Produção |
| `lib/audio/features/truepeak-ffmpeg.js` | True Peak via FFmpeg ebur128 (4x oversampling) | ~300 | ✅ Produção |
| `lib/audio/features/dynamics-corrected.js` | Dynamic Range, Crest Factor, RMS | ~200 | ✅ Produção |
| `lib/audio/features/spectral-bands.js` | 8 bandas espectrais em dBFS | ~400 | ✅ Produção |
| `lib/audio/features/scoring.js` | Cálculo de score 0-100 baseado em deltas | ~600 | ✅ Produção |
| `work/lib/user/userPlans.js` | Sistema de planos, limites mensais, gating | 1188 | ✅ Produção |
| `work/lib/queue.js` | Configuração BullMQ + Redis (Upstash) | ~300 | ✅ Produção |
| `work/db.js` | Pool PostgreSQL (Railway/Supabase) | ~100 | ✅ Produção |

#### **Frontend (HTML/JS)**

| Arquivo | Responsabilidade | Linhas | Status |
|---------|-----------------|--------|--------|
| `public/index.html` | App principal (análise de áudio) | ~2000 | ✅ Produção |
| `public/audio-analyzer-integration.js` | Controller: upload, polling, renderização | ~5600 | ✅ Produção |
| `public/planos.html` | Página de upgrade de planos | ~1500 | ✅ Produção |
| `public/landing.html` | Landing page | ~800 | ✅ Produção |

#### **Targets e Referências**

| Arquivo | Responsabilidade | Formato | Status |
|---------|-----------------|---------|--------|
| `work/refs/out/<genre>.json` | Targets calibrados por gênero (10+ tracks reais) | JSON | ✅ Produção |
| `work/refs/out/genres.json` | Lista de gêneros disponíveis | JSON | ✅ Produção |

**Exemplo de target:** `work/refs/out/funk_mandela.json`
```json
{
  "funk_mandela": {
    "version": "v2_hybrid_safe",
    "num_tracks": 10,
    "lufs_target": -9.2,
    "true_peak_target": -0.5,
    "dr_target": 9,
    "lra_target": 4,
    "stereo_target": 0.85,
    "tol_lufs": 3.2,
    "tol_true_peak": 1.5,
    "tol_dr": 6,
    "tol_lra": 4,
    "tol_stereo": 0.25,
    "bands": {
      "sub": { "target_db": -22.75, "tol_db": 6, "target_range": { "min": -33.3, "max": -17.2 } },
      "low_bass": { "target_db": -23.5, "tol_db": 5.5, "target_range": { "min": -29.9, "max": -19.1 } },
      "upper_bass": { "target_db": -23.5, "tol_db": 3.5, "target_range": { "min": -28.9, "max": -19.1 } },
      "low_mid": { "target_db": -25.6, "tol_db": 3, "target_range": { "min": -32.2, "max": -21.5 } },
      "mid": { "target_db": -26.8, "tol_db": 6, "target_range": { "min": -31.5, "max": -24.1 } },
      "high_mid": { "target_db": -31.5, "tol_db": 6, "target_range": { "min": -36.6, "max": -28.4 } },
      "brilho": { "target_db": -38.7, "tol_db": 3, "target_range": { "min": -46.3, "max": -33.1 } },
      "presenca": { "target_db": -37.4, "tol_db": 3, "target_range": { "min": -44.8, "max": -32.0 } }
    }
  }
}
```

---

## B) GAP ANALYSIS (O que falta para AutoMaster V1)

### ✅ O QUE JÁ EXISTE E PODE SER REUTILIZADO

| Recurso | Status Atual | Reuso AutoMaster | Observações |
|---------|--------------|------------------|-------------|
| **Pipeline de Análise** | ✅ Completo | ✅ 100% | Reutilizar análise completa ANTES do processamento |
| **Targets por Gênero** | ✅ Completo | ✅ 90% | Adaptar targets para parâmetros de DSP |
| **Sistema de Deltas** | ✅ Funcional | ✅ 100% | Usar deltas para calcular ganhos/cortes necessários |
| **Upload/Storage B2** | ✅ Funcional | ✅ 100% | Mesmo sistema, adicionar versionamento |
| **Autenticação Firebase** | ✅ Funcional | ✅ 100% | Mesmo sistema de auth |
| **Sistema de Planos** | ✅ Funcional | ⚠️ 80% | Adicionar "créditos de mastering" (novo limite) |
| **Workers/Filas BullMQ** | ✅ Funcional | ✅ 90% | Criar fila separada 'automaster' |
| **PostgreSQL Jobs** | ✅ Funcional | ✅ 95% | Adicionar campos para masterização |
| **Frontend/UI** | ✅ Completo | ⚠️ 50% | Criar novo fluxo separado para AutoMaster |

### ❌ O QUE PRECISA SER CRIADO DO ZERO

| Componente | Descrição | Complexidade | Prioridade |
|-----------|-----------|--------------|-----------|
| **Engine DSP** | Motor de processamento de áudio (limiter, compressor, EQ, loudness) | 🔴 ALTA | P0 |
| **Rota `/api/automaster`** | Endpoint separado para mastering | 🟢 BAIXA | P0 |
| **Worker AutoMaster** | Worker dedicado (separado do analyzer) | 🟡 MÉDIA | P0 |
| **Sistema de Modos** | Lógica para IMPACTO / BALANCEADO / LIMPO | 🟡 MÉDIA | P0 |
| **Validador de Segurança** | Hard limits (clipping, distorção, DR mínimo) | 🟡 MÉDIA | P0 |
| **Ajuste Dinâmico de Targets** | Modificar targets baseado no modo escolhido | 🟡 MÉDIA | P1 |
| **Versionamento de Arquivos** | Salvar original + masterizado + metadados | 🟢 BAIXA | P1 |
| **UI AutoMaster** | Página dedicada (separada da análise) | 🟡 MÉDIA | P1 |
| **Download WAV** | Sistema de download do arquivo masterizado | 🟢 BAIXA | P1 |
| **Comparação A/B** | Antes vs Depois (player integrado) | 🟡 MÉDIA | P2 |

### ⚠️ O QUE PRECISA SER ISOLADO/REFATORADO ANTES

| Componente | Problema Atual | Refatoração Necessária | Complexidade |
|-----------|---------------|----------------------|--------------|
| **Targets** | Mistura análise + UI | Separar `targets-analysis.json` vs `targets-mastering.json` | 🟢 BAIXA |
| **Scoring** | Monolítico em `scoring.js` | Extrair núcleo (permitir usar sem UI logic) | 🟡 MÉDIA |
| **Worker** | 1 worker faz tudo | Separar workers: `analyzer` vs `automaster` | 🟡 MÉDIA |
| **Storage Paths** | Flat structure | Criar hierarquia: `original/`, `mastered/`, `temp/` | 🟢 BAIXA |

---

## C) PROPOSTA DE ARQUITETURA DO AUTOMASTER V1

### 🎯 Fluxo Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. USUÁRIO ESCOLHE GÊNERO (manual, sem auto-detecção)              │
└────────────────────────────┬────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. USUÁRIO FAZ UPLOAD DO ÁUDIO (igual ao fluxo atual)              │
│    - POST /api/audio/presign → Upload B2                           │
└────────────────────────────┬────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. SISTEMA RODA ANÁLISE COMPLETA (reutiliza pipeline atual)        │
│    - POST /api/audio/analyze (mode=genre)                          │
│    - Retorna: métricas + targets + deltas + score + sugestões      │
└────────────────────────────┬────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. USUÁRIO VÊ RESULTADOS DA ANÁLISE (UI atual)                     │
│    - Score, tabela, sugestões, etc.                                │
└────────────────────────────┬────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. USUÁRIO CLICA "MASTERIZAR AUTOMATICAMENTE" (novo botão)         │
│    - Abre modal com 3 opções de modo:                              │
│      • IMPACTO (mais alto, punch, agressivo)                       │
│      • BALANCEADO (default, segue targets com segurança)           │
│      • LIMPO/STREAMING (conservador, TP seguro, menos agressivo)   │
└────────────────────────────┬────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. BACKEND CRIA JOB DE MASTERING                                   │
│    - POST /api/automaster                                          │
│    - Payload: { analysisJobId, mode, genre }                       │
│    - Enfileira na queue 'automaster'                               │
└────────────────────────────┬────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. WORKER AUTOMASTER PROCESSA                                      │
│    - Baixa áudio original do B2                                    │
│    - Carrega análise do job anterior                               │
│    - Carrega targets + deltas                                      │
│    - Aplica processamento via ENGINE DSP                           │
│    - Valida segurança (clipping, distorção)                        │
│    - Salva arquivo masterizado no B2                               │
└────────────────────────────┬────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 8. UI AUTOMASTER (nova página)                                     │
│    - Player A/B (antes vs depois)                                  │
│    - Métricas antes vs depois (tabela comparativa)                 │
│    - Botão de download WAV                                         │
│    - Botão "Re-masterizar" (testar outro modo)                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 📡 Contratos de Entrada/Saída

#### **POST /api/automaster** (criar job de mastering)

**Request:**
```json
{
  "analysisJobId": "uuid-da-analise-anterior",
  "mode": "balanced",  // "impact" | "balanced" | "clean"
  "genre": "funk_mandela",
  "originalFileKey": "uploads/uuid/audio.wav"
}
```

**Response (HTTP 201):**
```json
{
  "masteringJobId": "novo-uuid",
  "status": "pending",
  "estimatedTime": "60s",
  "creditsUsed": 1,
  "creditsRemaining": 9
}
```

#### **GET /api/automaster/:jobId** (polling status)

**Response (processing):**
```json
{
  "jobId": "uuid",
  "status": "processing",
  "stage": "applying_eq",  // "analyzing" | "normalizing" | "applying_eq" | "limiting" | "exporting"
  "progress": 45
}
```

**Response (completed):**
```json
{
  "jobId": "uuid",
  "status": "completed",
  "originalFileKey": "uploads/uuid/original.wav",
  "masteredFileKey": "mastered/uuid/funk_mandela_impact.wav",
  "downloadUrl": "https://presigned-url...",
  "metadata": {
    "mode": "impact",
    "genre": "funk_mandela",
    "processingTime": 58,
    "engineVersion": "automaster-v1.0"
  },
  "before": {
    "lufs": -13.2,
    "truePeak": -0.8,
    "dr": 7.5
  },
  "after": {
    "lufs": -9.2,
    "truePeak": -0.3,
    "dr": 9.0
  },
  "appliedProcessing": [
    { "type": "normalization", "params": { "targetLUFS": -9.2 } },
    { "type": "eq", "bands": [ /* ... */ ] },
    { "type": "compression", "params": { "ratio": 3.5, "threshold": -18, "knee": 6 } },
    { "type": "limiting", "params": { "ceiling": -0.3, "release": 50 } }
  ]
}
```

### 🎛️ Sistema de 3 Modos (Como alteram parâmetros/targets)

| Parâmetro | IMPACTO | BALANCEADO (default) | LIMPO/STREAMING |
|-----------|---------|----------------------|-----------------|
| **Target LUFS** | `target - 2 LU` (ex: -7 LUFS p/ funk) | `target` (ex: -9 LUFS) | `target + 2 LU` (ex: -11 LUFS) |
| **True Peak Ceiling** | `-0.1 dBTP` (bem próximo) | `-0.3 dBTP` (seguro) | `-0.5 dBTP` (conservador) |
| **Compression Ratio** | `4:1` (mais punch) | `3:1` (balanceado) | `2:1` (suave) |
| **Makeup Gain** | `+1 dB` (mais alto) | `0 dB` | `-0.5 dB` (mais baixo) |
| **EQ Aggressiveness** | `bandas ±3 dB` | `bandas ±2 dB` | `bandas ±1 dB` |
| **Limiter Attack** | `1 ms` (rápido/firme) | `3 ms` | `5 ms` (suave) |
| **Limiter Release** | `30 ms` (curto) | `50 ms` | `100 ms` (longo/natural) |
| **Min DR Allowed** | `6 dB` (pode comprimir bem) | `7 dB` | `9 dB` (preserva dinâmica) |

**Lógica de ajuste:**
```javascript
// Pseudocódigo
function calculateTargetsForMode(genreTargets, mode) {
  const baseTargets = genreTargets; // ex: funk_mandela
  
  switch(mode) {
    case 'impact':
      return {
        lufs: baseTargets.lufs_target - 2,  // -7 LUFS
        truePeak: -0.1,
        dr: Math.max(baseTargets.dr_target - 2, 6),
        compression: { ratio: 4, threshold: -20 },
        limiter: { ceiling: -0.1, attack: 1, release: 30 }
      };
    
    case 'clean':
      return {
        lufs: baseTargets.lufs_target + 2,  // -11 LUFS
        truePeak: -0.5,
        dr: Math.max(baseTargets.dr_target + 1, 9),
        compression: { ratio: 2, threshold: -16 },
        limiter: { ceiling: -0.5, attack: 5, release: 100 }
      };
    
    case 'balanced':
    default:
      return {
        lufs: baseTargets.lufs_target,     // -9 LUFS
        truePeak: -0.3,
        dr: baseTargets.dr_target,
        compression: { ratio: 3, threshold: -18 },
        limiter: { ceiling: -0.3, attack: 3, release: 50 }
      };
  }
}
```

### 🔧 Proposta de ENGINE DSP (AutoMaster V1)

**Arquitetura modular:**
```
lib/automaster/
  ├── engine.js (orquestrador principal)
  ├── processors/
  │   ├── normalizer.js (LUFS normalization)
  │   ├── eq.js (8-band parametric EQ)
  │   ├── compressor.js (multiband ou sidechain)
  │   ├── limiter.js (lookahead brickwall limiter)
  │   ├── stereo-enhancer.js (width, correlation)
  │   └── validator.js (safety checks)
  ├── utils/
  │   ├── audio-buffer.js (conversões Float32/WAV)
  │   ├── fft.js (reutilizar do pipeline atual)
  │   └── iir-filters.js (filtros IIR para EQ)
  └── config/
      └── presets.json (parâmetros dos 3 modos)
```

**Ordem de processamento (pipeline DSP):**
```
1. CARREGA ÁUDIO ORIGINAL (Float32Array)
   ↓
2. ANALISA (reutiliza análise prévia ou recalcula)
   ↓
3. CALCULA DELTAS (valor - target)
   ↓
4. NORMALIZA LUFS (aproxima do target, mas ainda abaixo)
   ↓
5. APLICA EQ (corrige bandas espectrais)
   ↓ (recalcula métricas espectrais)
   ↓
6. APLICA COMPRESSÃO (ajusta DR para target)
   ↓ (recalcula dinâmica)
   ↓
7. APLICA LIMITER (atinge target LUFS + TP ceiling)
   ↓ (recalcula LUFS/TP)
   ↓
8. VALIDA SEGURANÇA (clipping, distorção, DR mínimo)
   ↓ (se falhar → rollback parcial)
   ↓
9. EXPORTA WAV (Float32 → PCM 24-bit)
   ↓
10. SALVA NO B2 (mastered/<uuid>/<filename>)
```

**Validação de Segurança (Hard Limits):**
```javascript
function validateMasteredAudio(audio, mode) {
  const analysis = quickAnalyze(audio); // LUFS/TP/DR rápidos
  
  const errors = [];
  
  // ❌ CLIPPING ABSOLUTO
  if (analysis.truePeak > 0.0) {
    errors.push('TRUE_PEAK_CLIPPING');
  }
  
  // ❌ TRUE PEAK ACIMA DO CEILING DO MODO
  const ceilings = { impact: -0.1, balanced: -0.3, clean: -0.5 };
  if (analysis.truePeak > ceilings[mode]) {
    errors.push('TRUE_PEAK_ABOVE_CEILING');
  }
  
  // ❌ DYNAMIC RANGE MUITO BAIXO
  const minDR = { impact: 6, balanced: 7, clean: 9 };
  if (analysis.dr < minDR[mode]) {
    errors.push('DYNAMIC_RANGE_TOO_LOW');
  }
  
  // ❌ DISTORÇÃO (THD > 1%)
  if (analysis.thd > 0.01) {
    errors.push('DISTORTION_DETECTED');
  }
  
  // ⚠️ LUFS LONGE DO TARGET (tolerância ±1 LU)
  const targetLUFS = calculateTargetLUFS(mode);
  if (Math.abs(analysis.lufs - targetLUFS) > 1.0) {
    errors.push('LUFS_OUTSIDE_TOLERANCE');
  }
  
  return { valid: errors.length === 0, errors };
}
```

### 📦 Isolamento/Separação de Concerns

**Worker separado:**
```javascript
// work/automaster-worker.js (NOVO arquivo)
import { Worker } from 'bullmq';
import { getMasteringQueue } from '../lib/queue.js';
import { processAutoMaster } from '../lib/automaster/engine.js';

const worker = new Worker('automaster', async (job) => {
  const { analysisJobId, mode, genre, originalFileKey } = job.data;
  
  // 1. Baixa áudio do B2
  const audioBuffer = await downloadFromB2(originalFileKey);
  
  // 2. Carrega análise anterior
  const analysis = await loadAnalysisFromDB(analysisJobId);
  
  // 3. Carrega targets do gênero
  const targets = await loadGenreTargets(genre);
  
  // 4. Processa via engine
  const result = await processAutoMaster(audioBuffer, {
    analysis,
    targets,
    mode,
    genre
  });
  
  // 5. Salva arquivo masterizado no B2
  const masteredKey = await uploadToB2(result.audioBuffer, `mastered/${job.id}/${genre}_${mode}.wav`);
  
  // 6. Retorna metadados + comparação
  return {
    masteredKey,
    before: analysis.technicalData,
    after: result.finalMetrics,
    appliedProcessing: result.steps
  };
}, {
  connection: getRedisConnection(),
  concurrency: 2, // menos que analyzer (processamento mais pesado)
  limiter: {
    max: 5,
    duration: 60000 // max 5 masterings por minuto
  }
});
```

**Rota separada:**
```javascript
// work/api/automaster/create.js (NOVO arquivo)
export default async function handler(req, res) {
  // Validação de plano
  const uid = await validateFirebaseToken(req);
  const plan = await getUserPlan(uid);
  
  if (!['plus', 'pro', 'studio'].includes(plan)) {
    return res.status(403).json({ error: 'PLAN_REQUIRED', requiredPlan: 'plus' });
  }
  
  // Verificar créditos de mastering
  const credits = await getMasteringCredits(uid);
  if (credits.remaining <= 0) {
    return res.status(429).json({ error: 'NO_CREDITS', creditsRemaining: 0 });
  }
  
  // Criar job
  const { analysisJobId, mode, genre } = req.body;
  const queue = getMasteringQueue();
  const job = await queue.add('process-automaster', {
    analysisJobId,
    mode,
    genre,
    uid
  });
  
  // Decrementar créditos
  await decrementMasteringCredits(uid);
  
  return res.status(201).json({
    masteringJobId: job.id,
    status: 'pending',
    creditsRemaining: credits.remaining - 1
  });
}
```

### 🛡️ Segurança e Robustez

**Idempotência:**
- Usar jobId como chave única (evita reprocessar)
- Se job já existe com status `completed` → retornar resultado cacheado

**Rate Limiting:**
- Redis rate limiter: max 5 masterings por usuário por hora
- PLUS: 10 masterings/mês
- PRO: 30 masterings/mês
- STUDIO: 100 masterings/mês

**Validação de Arquivo:**
- Aceitar apenas resultados de análise válida prévia
- Tamanho máximo: 150MB (igual ao atual)
- Duração máxima: 10 minutos (evitar custos excessivos de processamento)
- Formatos: WAV, FLAC (MP3 não recomendado para mastering)

**Logs/Observabilidade:**
- Logs estruturados em cada etapa do engine
- Métricas de tempo por fase (normalize, eq, compress, limit)
- Alertas se validação falhar (Slack/email)
- Dashboard de filas (BullMQ Board)

---

## D) CHECKLIST DE IMPLEMENTAÇÃO (SEM IMPLEMENTAR)

### 🚀 FASE 0: PREPARAÇÃO (Antes de começar qualquer código)

- [ ] **0.1** Criar branch separada `feat/automaster-v1`
- [ ] **0.2** Backup completo do banco de dados (PostgreSQL)
- [ ] **0.3** Definir métricas de sucesso (ex: TP < -0.1 em 95% dos casos, DR dentro de ±1 dB do target)
- [ ] **0.4** Criar documento de especificação técnica detalhada do ENGINE DSP
- [ ] **0.5** Decidir se vai usar libs existentes (ex: `sox`, `ffmpeg filters`) ou implementar do zero
- [ ] **0.6** Testar performance de processamento com arquivos grandes (10min WAV = ~600MB)

**Riscos:** Escolha errada de libs DSP pode gerar dependências pesadas ou gargalos de performance.  
**Mitigação:** Fazer POC (Proof of Concept) com 3 abordagens diferentes antes de commit.

**Complexidade:** 🟡 MÉDIA  
**Estimativa:** 3-5 dias

---

### 🔧 FASE 1: ENGINE DSP (Core do AutoMaster)

#### **P0 - Alta Prioridade**

- [ ] **1.1** Criar estrutura `lib/automaster/` com módulos separados
  - [ ] `engine.js` (orquestrador)
  - [ ] `processors/normalizer.js`
  - [ ] `processors/eq.js`
  - [ ] `processors/compressor.js`
  - [ ] `processors/limiter.js`
  - [ ] `processors/validator.js`

- [ ] **1.2** Implementar **Normalizer** (LUFS normalization)
  - [ ] Calcular ganho necessário para atingir target LUFS
  - [ ] Aplicar ganho linear ao buffer
  - [ ] Recalcular LUFS para validar

- [ ] **1.3** Implementar **Limiter** (brickwall com lookahead)
  - [ ] Lookahead buffer (5-10ms)
  - [ ] True Peak limiting (via oversampling)
  - [ ] Release adaptativo (baseado no material)

- [ ] **1.4** Implementar **Validator** (safety checks)
  - [ ] Clipping detection
  - [ ] DR mínimo check
  - [ ] Distortion check (THD)

#### **P1 - Média Prioridade**

- [ ] **1.5** Implementar **EQ** (8-band parametric)
  - [ ] Filtros IIR (biquad)
  - [ ] Ganhos calculados a partir de deltas espectrais
  - [ ] Smoothing (evitar ajustes muito bruscos)

- [ ] **1.6** Implementar **Compressor** (dinâmica)
  - [ ] Multiband ou sidechain
  - [ ] Attack/Release adaptativos
  - [ ] Knee configurável

#### **P2 - Baixa Prioridade**

- [ ] **1.7** Implementar **Stereo Enhancer** (width, correlation)
- [ ] **1.8** Implementar **De-esser** (opcional, para vocal)

**Riscos:** Engine DSP é o coração do produto. Se não funcionar bem, nada funciona.  
**Mitigação:** Testes unitários com arquivos de referência (pink noise, sine waves, tracks reais).

**Complexidade:** 🔴 ALTA  
**Estimativa:** 15-20 dias

---

### 📡 FASE 2: API E BACKEND

#### **P0 - Alta Prioridade**

- [ ] **2.1** Criar rota `POST /api/automaster`
  - [ ] Validação de payload
  - [ ] Autenticação Firebase
  - [ ] Gating por plano (PLUS+)
  - [ ] Verificação de créditos
  - [ ] Enfileiramento no BullMQ

- [ ] **2.2** Criar rota `GET /api/automaster/:jobId`
  - [ ] Retornar status do job
  - [ ] Se completed: retornar presigned URL do arquivo masterizado

- [ ] **2.3** Criar worker `work/automaster-worker.js`
  - [ ] Processamento isolado
  - [ ] Download do áudio original
  - [ ] Carregamento da análise prévia
  - [ ] Chamada do engine
  - [ ] Upload do resultado para B2
  - [ ] Atualização do status no PostgreSQL

- [ ] **2.4** Criar fila separada `automaster` no BullMQ
  - [ ] Concorrência: 2 workers
  - [ ] Timeout: 5 minutos
  - [ ] Retry: 2 tentativas

#### **P1 - Média Prioridade**

- [ ] **2.5** Adicionar campos na tabela `jobs` do PostgreSQL
  - [ ] `mastering_mode` (impact/balanced/clean)
  - [ ] `mastered_file_key` (path B2)
  - [ ] `before_metrics` (JSONB)
  - [ ] `after_metrics` (JSONB)
  - [ ] `applied_processing` (JSONB)

- [ ] **2.6** Criar sistema de créditos de mastering
  - [ ] Tabela `mastering_credits` (uid, remaining, reset_at)
  - [ ] Função `decrementMasteringCredits(uid)`
  - [ ] Reset mensal automático

**Riscos:** Concorrência de 2 workers pode ser insuficiente ou excessiva.  
**Mitigação:** Monitorar filas e ajustar dinamicamente.

**Complexidade:** 🟡 MÉDIA  
**Estimativa:** 7-10 dias

---

### 🎨 FASE 3: FRONTEND/UI

#### **P1 - Média Prioridade**

- [ ] **3.1** Adicionar botão "Masterizar Automaticamente" na página de resultados
  - [ ] Apenas para planos PLUS+
  - [ ] Modal de seleção de modo (IMPACTO / BALANCEADO / LIMPO)

- [ ] **3.2** Criar página `automaster-results.html`
  - [ ] Player A/B (before vs after)
  - [ ] Tabela comparativa de métricas
  - [ ] Botão de download WAV
  - [ ] Botão "Re-masterizar" (testar outro modo)

- [ ] **3.3** Implementar polling de status
  - [ ] GET /api/automaster/:jobId a cada 2s
  - [ ] Progress bar com stages (analyzing, eq, limiting, etc.)

#### **P2 - Baixa Prioridade**

- [ ] **3.4** Adicionar visualizadores de forma de onda (before vs after)
- [ ] **3.5** Adicionar espectrograma (before vs after)

**Riscos:** Player A/B pode ter problemas de sincronização.  
**Mitigação:** Usar Web Audio API com precisão de sample.

**Complexidade:** 🟡 MÉDIA  
**Estimativa:** 5-7 dias

---

### 🗂️ FASE 4: STORAGE E VERSIONAMENTO

#### **P1 - Média Prioridade**

- [ ] **4.1** Criar hierarquia de pastas no B2:
  - `uploads/<uuid>/original.wav` (já existe)
  - `mastered/<uuid>/<genre>_<mode>.wav` (novo)
  - `temp/<uuid>/` (processamento intermediário)

- [ ] **4.2** Implementar limpeza automática de arquivos temporários
  - [ ] Após 24h, deletar `/temp/<uuid>/`
  - [ ] Após 30 dias, deletar `/mastered/<uuid>/` (opcional, dependendo do plano)

**Riscos:** Custos de storage podem crescer rapidamente.  
**Mitigação:** Política de retenção clara e dashboard de uso.

**Complexidade:** 🟢 BAIXA  
**Estimativa:** 2-3 dias

---

### 🎯 FASE 5: TARGETS E MODOS

#### **P1 - Média Prioridade**

- [ ] **5.1** Criar `targets-mastering.json` separado de `targets-analysis.json`
  - [ ] Incluir parâmetros de DSP (compression ratio, limiter attack/release, etc.)
  - [ ] Um arquivo por gênero (ex: `funk_mandela-mastering.json`)

- [ ] **5.2** Implementar função `calculateTargetsForMode(genreTargets, mode)`
  - [ ] Ajustar LUFS: impact (-2), balanced (0), clean (+2)
  - [ ] Ajustar TP ceiling: -0.1 / -0.3 / -0.5
  - [ ] Ajustar DR mínimo: 6 / 7 / 9

**Riscos:** Targets muito agressivos podem gerar distorção.  
**Mitigação:** Testes A/B com produtores reais.

**Complexidade:** 🟡 MÉDIA  
**Estimativa:** 3-4 dias

---

### 🔐 FASE 6: SEGURANÇA E VALIDAÇÃO

#### **P0 - Alta Prioridade**

- [ ] **6.1** Implementar rate limiting específico para mastering
  - [ ] Redis: max 5 jobs por usuário por hora
  - [ ] Retornar erro 429 se exceder

- [ ] **6.2** Implementar validação de hard limits
  - [ ] True Peak NUNCA > 0.0 dBTP
  - [ ] DR NUNCA < limite mínimo do modo
  - [ ] Se validação falhar → rollback e retornar erro claro

- [ ] **6.3** Implementar idempotência
  - [ ] Se jobId já existe e status=completed → retornar resultado cacheado
  - [ ] Evitar reprocessar a mesma requisição

**Riscos:** Ataques DDoS de jobs de mastering (muito custoso).  
**Mitigação:** Rate limiting + captcha para free users.

**Complexidade:** 🟡 MÉDIA  
**Estimativa:** 3-4 dias

---

### 📊 FASE 7: OBSERVABILIDADE E LOGS

#### **P1 - Média Prioridade**

- [ ] **7.1** Adicionar logs estruturados em cada fase do engine
  - [ ] `[AUTOMASTER][NORMALIZE]`, `[AUTOMASTER][EQ]`, etc.
  - [ ] Tempo de cada fase

- [ ] **7.2** Criar dashboard BullMQ Board (visualização de filas)
  - [ ] Monitorar jobs pending/processing/completed/failed
  - [ ] Alertas se fila > 50 jobs

- [ ] **7.3** Adicionar métricas ao banco
  - [ ] Tabela `automaster_stats` (jobs por dia, tempo médio, taxa de sucesso)

**Riscos:** Logs muito verbosos podem custar caro.  
**Mitigação:** Apenas em dev; em prod, logs estruturados com níveis (info, warn, error).

**Complexidade:** 🟢 BAIXA  
**Estimativa:** 2-3 dias

---

### 🧪 FASE 8: TESTES E VALIDAÇÃO

#### **P0 - Alta Prioridade**

- [ ] **8.1** Testes unitários do engine
  - [ ] Pink noise → deve ter espectro plano após EQ
  - [ ] Sine wave 1kHz → não deve distorcer
  - [ ] Arquivo já masterizado → não deve over-processar

- [ ] **8.2** Testes de integração (end-to-end)
  - [ ] Upload → Análise → AutoMaster → Download
  - [ ] Validar que áudio final tem TP < ceiling

- [ ] **8.3** Testes A/B com produtores reais
  - [ ] 10 tracks de referência
  - [ ] Comparar AutoMaster vs Master manual
  - [ ] Coletar feedback qualitativo

**Riscos:** Testes A/B podem revelar que engine não soa "profissional".  
**Mitigação:** Iterar rapidamente com feedback real.

**Complexidade:** 🟡 MÉDIA  
**Estimativa:** 5-7 dias

---

### 🚀 FASE 9: DEPLOY E ROLLOUT

#### **P0 - Alta Prioridade**

- [ ] **9.1** Deploy em ambiente de staging (Railway)
  - [ ] Testar com dados de produção (cópia)
  - [ ] Validar performance (tempo de processamento < 60s)

- [ ] **9.2** Beta privado (10-20 usuários PRO)
  - [ ] Coletar feedback
  - [ ] Monitorar custos de processamento

- [ ] **9.3** Ajustes baseados no beta

- [ ] **9.4** Deploy em produção
  - [ ] Ativar feature flag `AUTOMASTER_ENABLED=true`
  - [ ] Monitorar primeiras 100 análises

**Riscos:** Custos de processamento podem explodir.  
**Mitigação:** Hard cap de 400 masterings/mês para STUDIO.

**Complexidade:** 🟡 MÉDIA  
**Estimativa:** 3-5 dias

---

## 📊 RESUMO DE COMPLEXIDADE E ESTIMATIVAS

| Fase | Descrição | Complexidade | Estimativa | Prioridade |
|------|-----------|--------------|-----------|-----------|
| 0 | Preparação | 🟡 Média | 3-5 dias | P0 |
| 1 | Engine DSP | 🔴 Alta | 15-20 dias | P0 |
| 2 | API e Backend | 🟡 Média | 7-10 dias | P0 |
| 3 | Frontend/UI | 🟡 Média | 5-7 dias | P1 |
| 4 | Storage | 🟢 Baixa | 2-3 dias | P1 |
| 5 | Targets e Modos | 🟡 Média | 3-4 dias | P1 |
| 6 | Segurança | 🟡 Média | 3-4 dias | P0 |
| 7 | Observabilidade | 🟢 Baixa | 2-3 dias | P1 |
| 8 | Testes | 🟡 Média | 5-7 dias | P0 |
| 9 | Deploy | 🟡 Média | 3-5 dias | P0 |

**TOTAL:** 48-68 dias úteis (~2-3 meses com 1 desenvolvedor full-time)

---

## E) PERGUNTAS TÉCNICAS QUE PRECISO RESPONDER

### ❓ Sobre DSP e Processamento

1. **Libs DSP:** Vamos usar libs prontas (ex: `sox`, `ffmpeg filters`) ou implementar filtros/compressores do zero em JS?  
   → **Sugestão:** Usar `ffmpeg` com filtros customizados (já usamos para True Peak) para ganhar tempo.

2. **Formato interno:** Processar tudo em Float32Array ou converter para buffer de lib específica?  
   → **Sugestão:** Manter Float32Array (mesma base do pipeline atual).

3. **Multiband vs Single-band Compression:** Qual abordagem para compression?  
   → **Sugestão:** Começar com single-band (mais simples), evoluir para multiband no V2.

### ❓ Sobre Targets e Calibração

4. **Targets de mastering:** Devo criar novos JSONs de targets especificamente para mastering ou adaptar os atuais?  
   → **Sugestão:** Criar separados (`*-mastering.json`) com parâmetros de DSP incluídos.

5. **Validação de targets:** Como validar se os targets de mastering estão corretos sem feedback de produtores?  
   → **Sugestão:** Beta privado obrigatório com produtores experientes antes de lançar.

### ❓ Sobre Performance e Custos

6. **Tempo de processamento:** Qual o tempo aceitável para masterizar 1 faixa de 3 minutos?  
   → **Sugestão:** Target < 60s (2x tempo real).

7. **Custos de processamento:** Quanto vai custar processar 1000 masterings/mês (CPU + storage)?  
   → **Análise necessária:** Rodar POC e medir na Railway.

### ❓ Sobre UX e Produto

8. **Free users:** AutoMaster vai estar disponível para FREE ou apenas PLUS+?  
   → **Sugestão:** PLUS+ apenas (evitar abuso, incentivar upgrade).

9. **Re-masterização:** Se usuário não gostar do resultado, pode re-masterizar de graça ou consome novo crédito?  
   → **Sugestão:** Limitado: 2 tentativas grátis por faixa (total 3 renders).

10. **Download original:** Usuário pode baixar o arquivo original que fez upload?  
    → **Sugestão:** Sim, mas apenas por 30 dias (política de retenção).

### ❓ Sobre Futuro (Plugin/DAW)

11. **Separação do engine:** Como garantir que o engine pode rodar fora do backend (ex: em plugin VST)?  
    → **Sugestão:** Engine 100% isolado em `lib/automaster/` sem dependências de banco/redis.

12. **API versionada:** Como garantir compatibilidade backward quando fizer updates no engine?  
    → **Sugestão:** Versionamento semântico (`engineVersion: "v1.0.0"`) e manter engines antigos por 6 meses.

---

## ✅ CRITÉRIOS DE SUCESSO

### Técnicos (Validação Objetiva)

- [ ] **True Peak:** 99% dos áudios masterizados têm TP < ceiling do modo escolhido
- [ ] **LUFS:** 95% dos áudios atingem target ±1 LU
- [ ] **Dynamic Range:** 90% respeitam DR mínimo do modo
- [ ] **Clipping:** 0% de clipping audível (samples > 1.0)
- [ ] **Performance:** 90% dos jobs completam em < 60s
- [ ] **Uptime:** 99.5% de disponibilidade da fila AutoMaster

### Qualitativos (Validação Subjetiva)

- [ ] **Feedback beta:** 80% dos usuários beta aprovam o resultado
- [ ] **A/B Test:** 70% dos produtores preferem AutoMaster vs master genérico
- [ ] **Re-masterização:** Taxa de re-masterização < 30% (indica que 1ª tentativa é boa)

### Negócio

- [ ] **Conversão:** 20% dos usuários FREE fazem upgrade para PLUS após testar demo do AutoMaster
- [ ] **Uso:** 50% dos usuários PLUS usam AutoMaster pelo menos 1x/mês
- [ ] **Custo:** Custo total de processamento < $5 por 100 masterings

---

## 🎯 RECOMENDAÇÕES FINAIS

### ✅ PODE PROSSEGUIR COM CONFIANÇA

O sistema SoundyAI está **maduro e bem arquitetado** para receber o AutoMaster V1. Principais pontos fortes:
- Pipeline de análise sólido e testado
- Targets calibrados com tracks reais
- Infraestrutura escalável (workers, filas, storage)
- Contratos de dados bem definidos

### ⚠️ PONTOS DE ATENÇÃO

1. **Engine DSP é crítico:** Investir tempo significativo em testes A/B reais
2. **Custos de processamento:** Monitorar de perto, pode crescer rápido
3. **Feedback de usuários:** Beta privado é OBRIGATÓRIO antes de lançar
4. **Qualidade vs Agressividade:** Balance difícil, pode levar iterações

### 📋 PRÓXIMOS PASSOS IMEDIATOS (NÃO IMPLEMENTAR AINDA)

1. ✅ Revisar este documento de auditoria com time técnico
2. ✅ Decidir sobre libs DSP (POC com 3 abordagens)
3. ✅ Criar documento de especificação técnica do ENGINE DSP
4. ✅ Definir métricas de sucesso detalhadas
5. ✅ Recrutar 10-20 produtores para beta privado
6. ✅ Fazer estimativa de custos de infraestrutura
7. ✅ Criar roadmap detalhado com milestones

---

**FIM DA AUDITORIA**  
**Status:** ✅ COMPLETO  
**Próxima ação:** Aguardar aprovação para iniciar implementação

