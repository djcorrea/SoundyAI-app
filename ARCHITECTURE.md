# AutoMaster V1 - Arquitetura SaaS

## 🏗️ Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTE (Browser/App)                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTP POST /automaster
                            │ (multipart/form-data + mode)
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      EXPRESS API (Port 3000)                     │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ upload-route │  │ status-route │  │    multer    │          │
│  │  POST /      │  │   GET /:id   │  │  (120MB max) │          │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘          │
│         │                  │                                      │
│         │ 1. Save to       │ 4. Query status                     │
│         │ storage/input    │                                      │
│         │                  │                                      │
│         │ 2. Validate      │                                      │
│         │ duration         │                                      │
│         │ (ffprobe)        │                                      │
│         │                  │                                      │
│         │ 3. Enqueue       │                                      │
│         ↓                  ↓                                      │
└─────────┼──────────────────┼──────────────────────────────────────┘
          │                  │
          │                  │
          ↓                  ↓
┌─────────────────────────────────────────────────────────────────┐
│                      REDIS (BullMQ Queue)                        │
│                                                                   │
│  Queue: "automaster"                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ waiting  │→ │  active  │→ │completed │  │  failed  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                   │
│  Config:                                                         │
│  - attempts: 2                                                   │
│  - backoff: exponential (5s)                                     │
│  - timeout: 120s                                                 │
│  - removeOnComplete: true (1h)                                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ Worker polls queue
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                    WORKER (BullMQ Processor)                     │
│                                                                   │
│  Concurrency: 2-8 (configurable)                                │
│  Timeout: 90s per job                                            │
│                                                                   │
│  ┌───────────────────────────────────────────────────────┐      │
│  │  JOB PROCESSING FLOW                                  │      │
│  │                                                        │      │
│  │  1. Validate job data (jobId, paths, mode)           │      │
│  │  2. Create isolated workspace: tmp/{jobId}/           │      │
│  │  3. Copy input → tmp/{jobId}/input.wav                │      │
│  │  4. Execute master-pipeline.cjs ──────────┐           │      │
│  │  5. Validate output exists                │           │      │
│  │  6. Copy result → storage/output/         │           │      │
│  │  7. Cleanup tmp/{jobId}/                  │           │      │
│  │  8. Return result to Redis                │           │      │
│  └───────────────────────────────────────────┼───────────┘      │
└────────────────────────────────────────────┼──────────────────┘
                                             │
                                             │ execFile
                                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CORE DSP (Node.js Scripts)                    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ master-pipeline.cjs                                  │       │
│  │                                                       │       │
│  │  1. Precheck (precheck-audio.cjs)                   │       │
│  │     ↓                                                │       │
│  │  2. Fix True Peak (if needed)                       │       │
│  │     ↓                                                │       │
│  │  3. Masterize (automaster-v1.cjs) ────────┐         │       │
│  │     ↓                                      │         │       │
│  │  4. Return JSON result                     │         │       │
│  └────────────────────────────────────────────┼─────────┘       │
│                                               │                  │
│  ┌────────────────────────────────────────────┼─────────┐       │
│  │ automaster-v1.cjs (DSP Engine)            │         │       │
│  │                                            │         │       │
│  │  FFmpeg Process:                          │         │       │
│  │  1. Two-pass loudnorm (analysis + render) │         │       │
│  │  2. True Peak limiter (alimiter)          │         │       │
│  │  3. Post-validation (±0.2 LU, +0.05 dB)   │         │       │
│  │  4. Fallback if needed (-0.2 dB ceiling)  │         │       │
│  └────────────────────────────────────────────┘         │       │
│                                                          │       │
│                                               ┌──────────▼─────┐ │
│                                               │     FFmpeg     │ │
│                                               │  (loudnorm +   │ │
│                                               │   alimiter)    │ │
│                                               └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Estrutura de Diretórios

```
SoundyAI/
├── automaster/                  # Core DSP (NÃO MODIFICADO)
│   ├── automaster-v1.cjs       # Two-pass loudnorm engine
│   ├── master-pipeline.cjs     # Orchestrator (precheck + fix + master)
│   ├── precheck-audio.cjs      # Gate técnico
│   ├── fix-true-peak.cjs       # Correção de TP
│   └── run-automaster.cjs      # Wrapper de modos
│
├── queue/                       # BullMQ Infrastructure (NOVO)
│   ├── redis-connection.cjs    # Redis singleton
│   ├── automaster-queue.cjs    # Queue definition
│   └── automaster-worker.cjs   # Worker processor
│
├── api/                         # Express API (NOVO)
│   ├── server.cjs              # Express server
│   ├── upload-route.cjs        # POST /automaster
│   └── job-status-route.cjs    # GET /automaster/:jobId
│
├── storage/                     # Persistent Storage (NOVO)
│   ├── input/                  # Uploads (UUID.wav)
│   └── output/                 # Results ({jobId}_master.wav)
│
├── tmp/                         # Temporary Workspaces (NOVO)
│   └── {jobId}/                # Isolated workspace per job
│       ├── input.wav
│       └── result.wav
│
├── README-INFRA.md             # Infrastructure documentation
├── DEPLOYMENT-CHECKLIST.md     # Deployment checklist
└── test-saas-integration.cjs   # Integration test
```

## 🔄 Fluxo de Dados Completo

### 1. Upload (Cliente → API)

```
Cliente envia arquivo WAV + mode
    ↓
API valida:
  - Extensão .wav
  - Tamanho ≤ 120MB
  - Duração ≤ 15 min (ffprobe)
    ↓
Salva em storage/input/{UUID}.wav
    ↓
Enfileira job no Redis:
  {
    jobId: UUID,
    inputPath: storage/input/{UUID}.wav,
    outputPath: storage/output/{UUID}_master.wav,
    mode: "BALANCED"
  }
    ↓
Retorna: { jobId, status: "queued" }
```

### 2. Processing (Worker → Core DSP)

```
Worker poll Redis queue
    ↓
Pega próximo job (concurrency control)
    ↓
Cria workspace: tmp/{jobId}/
    ↓
Copia input → tmp/{jobId}/input.wav
    ↓
Executa master-pipeline.cjs:
  tmp/{jobId}/input.wav → tmp/{jobId}/result.wav
    ↓
master-pipeline executa:
  1. precheck-audio.cjs (validação)
  2. fix-true-peak.cjs (se TP alto)
  3. automaster-v1.cjs (two-pass loudnorm)
    ↓
automaster-v1.cjs executa FFmpeg:
  - loudnorm pass 1 (analysis)
  - loudnorm pass 2 (render) + alimiter
  - Post-validation (±0.2 LU LUFS, +0.05 dB TP)
  - Fallback se necessário
    ↓
Copia resultado → storage/output/{jobId}_master.wav
    ↓
Limpa tmp/{jobId}/
    ↓
Atualiza job no Redis: status="completed"
```

### 3. Polling (Cliente → API)

```
Cliente faz GET /automaster/{jobId}
    ↓
API consulta Redis
    ↓
Retorna status:
  - waiting: Na fila
  - active: Processando (progress %)
  - completed: Finalizado (+ resultado)
  - failed: Erro (+ mensagem)
```

## 🌐 Deploy em Produção (Railway)

### Serviços

1. **Redis** (Managed Database)
   - Provisionado automaticamente
   - URL: `REDIS_URL`

2. **API** (Railway Service)
   - Image: Node.js 18
   - Start: `node api/server.cjs`
   - Port: 3000 (exposed)
   - Scaling: Horizontal (múltiplas instâncias)

3. **Worker** (Railway Service)
   - Image: Node.js 18
   - Start: `node queue/automaster-worker.cjs`
   - Concurrency: 4
   - Scaling: Horizontal (múltiplos workers)

### Comunicação

```
API ←→ Redis ←→ Worker
 ↑               ↓
 │           Core DSP
 │               ↓
 └── Storage ────┘
```

### Variáveis de Ambiente

| Serviço | Variáveis | Valores |
|---------|-----------|---------|
| Redis | - | Auto-configurado |
| API | `REDIS_URL`, `PORT`, `MAX_FILE_MB`, `MAX_DURATION_MINUTES` | Railway fornece |
| Worker | `REDIS_URL`, `WORKER_CONCURRENCY` | Railway fornece |

## 🔒 Segurança e Isolamento

### Job Isolation

Cada job tem workspace isolado:
```
tmp/
├── job-abc123/
│   ├── input.wav    (cópia isolada)
│   └── result.wav   (output temporário)
├── job-def456/
│   ├── input.wav
│   └── result.wav
└── job-ghi789/
    ├── input.wav
    └── result.wav
```

- Nenhum job sobrescreve outro
- Cleanup automático após processamento
- Sem race conditions
- Stateless (múltiplas instâncias seguras)

### Validações em Cascata

1. **Upload (API)**
   - Extensão WAV
   - Tamanho ≤ 120MB
   - Duração ≤ 15min via ffprobe

2. **Worker**
   - jobId regex `/^[a-zA-Z0-9_-]+$/`
   - Input exists
   - Mode válido

3. **Pipeline**
   - precheck-audio.cjs (gate técnico)
   - True Peak, LUFS, LRA, Duration, Silence

4. **DSP**
   - Post-validation (precision)
   - Fallback se fora de tolerância

## 📊 Métricas de Performance

### Targets

- **Latência API:** < 100ms (upload)
- **Throughput:** 50-100 jobs/hora (4 workers)
- **Tempo médio:** 15-30s/job
- **Taxa de sucesso:** > 98%

### Bottlenecks

1. FFmpeg (CPU-bound) → Scale workers
2. Redis (memory) → Upgrade instance
3. Storage I/O → Usar SSD

## 🚨 Failure Handling

### Worker Crash

- Redis mantém job como "stalled"
- Outro worker pega após timeout
- Retry automático (2 tentativas)

### API Crash

- Jobs em fila não afetados
- Workers continuam processando
- Stateless: reiniciar API sem perda

### Redis Crash

- Workers aguardam reconexão
- Retry strategy (backoff exponencial)
- Jobs em memória podem ser perdidos (usar persistência)

---

**SoundyAI Engineering • 2026**
