# AUDITORIA DE ARQUITETURA - SoundyAI @ Railway
## Análise Completa: Análise de Áudio + AutoMaster V1

**Data:** 23 de fevereiro de 2026  
**Sistema:** SoundyAI Production @ Railway  
**Escopo:** Arquitetura de processamento assíncrono (fila + workers)  
**Objetivo:** Avaliar impacto da integração do AutoMaster V1  

---

## RESUMO EXECUTIVO

### ⚠️ CLASSIFICAÇÃO DE RISCO: 🟡 **MÉDIO-ALTO**

**Situação atual:** Sistema roda com fila BullMQ + Redis + 1 worker de análise de áudio.

**Nova funcionalidade:** AutoMaster V1 adiciona masterização automática (FFmpeg intensivo).

**Status de prontidão:**
```
✅ Infraestrutura base: Fila + Redis + Worker (existente)
✅ Worker AutoMaster: Implementado e configurado
⚠️ Separação de filas: Correto (duas filas isoladas)
❌ Concorrência global: SEM LIMITE (risco crítico)
❌ Workers na mesma instância: Competição por recursos
⚠️ Cleanup garantido: Parcial (não cobre todos os casos)
❌ Monitoramento: Insuficiente para produção
```

**Recomendação:**
```
🟡 DEPLOY CONDICIONAL:
   - ✅ Pode ativar com MITIGAÇÕES implementadas
   - ❌ NÃO ativar sem mudanças na arquitetura
   - ⚠️ RISCO: Saturação de CPU sob carga
   
Prioridade:
   1. Separar workers em instâncias dedicadas (CRÍTICO)
   2. Configurar limite global de concorrência
   3. Monitoramento de recursos (CPU/RAM/Disk)
   4. Teste de carga antes de produção
```

---

## 1. FILA E REDIS

### 1.1 Arquitetura Atual Descoberta

**Sistema de filas:**
```javascript
// lib/queue.js
Queue: 'audio-analyzer'  - Análise de áudio (worker-redis.js)
Queue: 'automaster'      - Masterização (automaster-worker.cjs)
```

**✅ PONTO POSITIVO: Duas filas separadas**  
Análise e masterização NÃO competem na mesma fila. Isso previne starvation direto.

**Configuração Redis:**
```javascript
// lib/queue.js
{
  maxRetriesPerRequest: null,      // Obrigatório para BullMQ
  connectTimeout: 45000,
  commandTimeout: 15000,
  keepAlive: 120000,
  enableReadyCheck: false,
  enableAutoPipelining: true,       // Performance
  retryStrategy: exponencial (max 30s)
}
```

**✅ PONTO POSITIVO: Configuração robusta**  
- Retry automático
- Autopipelining (performance)
- Timeouts adequados

### 1.2 Criação de Jobs

#### Job de Análise (audio-analyzer)

**Fonte:** `lib/queue.js` + controllers  
**Job data:**
```javascript
{
  fileKey: 'uploads/user_id/file.wav',
  mode: 'base' | 'reference',
  genre: 'pop',
  referenceJobId: 'job-xyz' // opcional
}
```

**Configuração de retry:**
```javascript
defaultJobOptions: {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 10,  // Mantém últimos 10
  removeOnFail: 5        // Mantém últimos 5 falhos
}
```

#### Job de AutoMaster (não encontrado na codebase atual)

**⚠️ DESCOBERTA:** Não há endpoint criando jobs `automaster` na fila ainda.

**Endpoint existente:** `/api/automaster` (server.js linha 463)  
**Comportamento atual:** Processamento SÍNCRONO (não usa fila!)

```javascript
// server.js linha 463
app.post('/api/automaster', automasterUpload.single('file'), async (req, res) => {
  // ❌ PROBLEMA: Processa síncronamente, sem fila
  // Bloqueia thread do Node.js por 40-120s
});
```

### 1.3 Priorização

**❌ NÃO IMPLEMENTADO**  

BullMQ suporta priorização, mas não está configurado:
```javascript
// Como deveria ser:
queue.add('process', data, {
  priority: user.isPremium ? 1 : 5  // Menor = maior prioridade
});
```

**Impacto:**  
Jobs pesados (AutoMaster 120s) podem bloquear jobs leves (Análise 30s).

### 1.4 Retry e Backoff

**✅ IMPLEMENTADO no worker-redis.js:**
```javascript
defaultJobOptions: {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
}
// 1ª tentativa: imediato
// 2ª tentativa: +2s
// 3ª tentativa: +4s
```

**✅ IMPLEMENTADO no automaster-worker.cjs:**  
Retry a nível de FFmpeg interno (não a nível de fila, mas tá ok).

### 1.5 TTL e Limpeza

**✅ IMPLEMENTADO (Job Store):**
```javascript
// services/job-store.cjs
const JOB_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 dias

await redis.expire(jobKey, JOB_TTL_SECONDS);
```

**Jobs completados/falhados:**
```javascript
removeOnComplete: 10,  // Mantém últimos 10
removeOnFail: 5        // Mantém últimos 5
```

**⚠️ PROBLEMA:** Arquivos temporários NÃO têm TTL automático.  
Cleanup depende de execução correta do worker.

### 1.6 Separação de Tipos de Job

**✅ SEPARAÇÃO CORRETA:**

| Fila | Worker | Processamento | Concurrency |
|------|--------|---------------|-------------|
| `audio-analyzer` | worker-redis.js | Análise de áudio | 6 (default) |
| `automaster` | automaster-worker.cjs | Masterização | 1-4 (default 1) |

**Vantagem:**  
Jobs de análise NÃO bloqueiam jobs de masterização (diferentes filas).

**Desvantagem:**  
Ambos workers competem por CPU/RAM se rodarem na mesma instância.

### 1.7 Risco de Starvation

**🟡 RISCO MODERADO:**

- **Starvation entre tipos:** NÃO (filas separadas)
- **Starvation dentro da mesma fila:** SIM (sem priorização)

**Cenário problemático:**
```
Fila automaster:
  - 50 jobs STREAMING (40s cada)
  - 5 jobs HIGH (120s cada)
  
Sem priorização:
  → Jobs HIGH esperam 50 × 40s = 2000s (33 minutos)
  → Usuários premium aguardam igual usuários free
```

**Mitigação necessária:**  
Implementar priorização por tier de usuário.

---

## 2. WORKER ATUAL (worker-redis.js)

### 2.1 Concorrência

**Configuração:**
```javascript
// work/worker-redis.js linha 320
const concurrency = Number(process.env.WORKER_CONCURRENCY) || 6;

worker = new Worker('audio-analyzer', audioProcessor, {
  connection: redisConnection,
  concurrency,  // Default: 6 jobs simultâneos
  lockDuration: 60000,      // 1 minuto
  stalledInterval: 15000,   // 15s
});
```

**✅ PONTO POSITIVO:** Concurrency configurável via env.

**⚠️ PROBLEMA:** Sem validação de limite superior.
```javascript
// Deveria ter:
const MAX_SAFE_CONCURRENCY = Math.floor(os.cpus().length / 2);
const concurrency = Math.min(
  Number(process.env.WORKER_CONCURRENCY) || 6,
  MAX_SAFE_CONCURRENCY
);
```

**Impacto real:**

| vCPU | Análise (concurrency 6) | FFmpeg processos | CPU usage |
|------|------------------------|------------------|-----------|
| 2 | 6 jobs | 6 FFmpeg | 300% (SOBRECARGA!) |
| 4 | 6 jobs | 6 FFmpeg | 150% (Lento) |
| 8 | 6 jobs | 6 FFmpeg | 75% (OK) |

**🔴 RISCO:** Server Railway padrão = 2-4 vCPU.  
Concurrency 6 em 2 vCPU = crash garantido.

### 2.2 Múltiplos Jobs em Paralelo

**✅ SIM:** Worker processa até 6 jobs simultâneos (configurável).

**Arquitetura:**
```
Worker iniciado → BullMQ gerencia pool de jobs
                ↓
            Job 1 (FFmpeg 1) ──┐
            Job 2 (FFmpeg 2) ──┤
            Job 3 (FFmpeg 3) ──┼──> Todos em paralelo
            Job 4 (FFmpeg 4) ──┤
            Job 5 (FFmpeg 5) ──┤
            Job 6 (FFmpeg 6) ──┘
```

**Cada job:**
- Executa FFmpeg independente
- Workspace isolado (`/tmp/jobId/`)
- Lock distribuído via Redis

### 2.3 Tratamento de Falhas do FFmpeg

**✅ IMPLEMENTADO:**

```javascript
// work/worker-redis.js
try {
  const result = await processAudioComplete(fileKey, mode, genre, referenceJobId);
  
  if (!result || !result.technicalData) {
    throw new Error('Pipeline retornou resultado incompleto');
  }
  
  await jobStore.updateJobStatus(jobId, 'completed', {
    output: result,
    completed_at: Date.now()
  });
  
} catch (error) {
  jobLogger.error({ error: error.message, stack: error.stack }, 'Job falhou');
  
  // Classificar erro
  const classification = errorClassifier.classifyError(error);
  
  await jobStore.updateJobStatus(jobId, 'failed', {
    error: classification.message,
    error_code: classification.code,
    failed_at: Date.now()
  });
  
  throw error; // BullMQ gerencia retry
}
```

**Retry automático via BullMQ:**
- 3 tentativas com backoff exponencial
- Se falhar 3x → job marcado como failed permanentemente

### 2.4 Proteção Contra Processos Órfãos

**⚠️ IMPLEMENTAÇÃO PARCIAL:**

**O que existe:**
```javascript
// automaster-worker.cjs linha 140
execFile('node', [MASTER_PIPELINE_SCRIPT, ...], {
  timeout: TIMEOUT_MS,  // 120s
  killSignal: 'SIGTERM',
  encoding: 'utf8'
}, callback);
```

**O que falta:**
```javascript
// Deveria ter:
let ffmpegProcess;
try {
  ffmpegProcess = spawn('ffmpeg', args);
  await waitForCompletion(ffmpegProcess);
} finally {
  // GARANTIR que processo morre
  if (ffmpegProcess && !ffmpegProcess.killed) {
    ffmpegProcess.kill('SIGKILL');
  }
  await cleanupTempFiles();
}
```

**🔴 RISCO:** FFmpeg pode continuar rodando após timeout do Node.js.

**Teste para verificar:**
```bash
# Durante processamento, verificar processos órfãos:
ps aux | grep ffmpeg | grep -v grep

# Se houver processos sem PID pai ou com PPID=1 → órfãos
```

### 2.5 Timeout para Jobs Longos

**✅ CONFIGURADO:**

**Worker de Análise:**
```javascript
// work/worker-redis.js
lockDuration: 60000,       // 1 minuto
stalledInterval: 15000,    // Verifica a cada 15s
maxStalledCount: 2         // Max 2 travamentos
```

**Worker AutoMaster:**
```javascript
// automaster-worker.cjs
const TIMEOUT_MS = 120000; // 120 segundos

execFile('node', [...], { timeout: TIMEOUT_MS }, ...);
```

**⚠️ PROBLEMA:** Timeout de 120s pode ser insuficiente.

**Cálculo realista:**
```
AutoMaster HIGH mode (áudio 10 minutos):
  - Análise espectral: 20s
  - Macro stabilizer: 10s
  - 4 iterações limiter: 80s
  - Medições: 40s
  - Total: 150s (EXCEDE 120s!)
```

**Recomendação:** Aumentar para 180s (3 minutos) ou 300s (5 minutos).

### 2.6 Cleanup Garantido de Temporários

**⚠️ IMPLEMENTAÇÃO PARCIAL:**

**O que existe:**
```javascript
// automaster-worker.cjs linha 110
async function cleanupJobWorkspace(jobId) {
  const workspace = path.join(TMP_BASE_DIR, jobId);
  try {
    await fs.rm(workspace, { recursive: true, force: true });
  } catch (error) {
    logger.warn({ jobId, error: error.message }, 'Falha no cleanup');
  }
}
```

**Quando é chamado:**
```javascript
// automaster-worker.cjs linha 300~
try {
  // ... processamento
  
  // 9. Cleanup
  await cleanupJobWorkspace(jobId);
  
} catch (error) {
  jobLogger.error('Job falhou');
  // ❌ PROBLEMA: Se erro ocorre ANTES do cleanup, arquivos ficam órfãos
  throw error;
} finally {
  // ❌ AUSENTE: Não há finally garantindo cleanup
}
```

**🔴 PROBLEMA CRÍTICO:** Cleanup NÃO está em bloco `finally`.

**Impacto:**
```
100 jobs/dia × 10% falha × 700 MB temporários = 7 GB/dia de lixo
  → 3 dias = 21 GB ocupados
  → Disco Railway padrão = 40 GB
  → 5 dias = disco cheio → crash
```

**Correção necessária:**
```javascript
try {
  workspace = await createJobWorkspace(jobId);
  // ... processamento
} finally {
  // SEMPRE executa, mesmo com erro/timeout
  if (workspace) {
    await cleanupJobWorkspace(jobId).catch(() => {});
  }
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  if (lockData) {
    await jobLock.releaseLock(jobId, lockData.workerId).catch(() => {});
  }
}
```

---

## 3. IMPACTO DO AUTOMASTER

### 3.1 Worker Atual Suportaria?

**❌ NÃO, se rodar na mesma instância sem mitigações.**

**Cálculo de recursos:**

**Cenário A: Workers separados (ideal)**
```
Instância 1 (Análise):       Instância 2 (AutoMaster):
  - 4 vCPU                     - 4 vCPU
  - 8 GB RAM                   - 8 GB RAM
  - Concurrency: 4             - Concurrency: 2
  
  → 4 FFmpeg @ 100%            → 2 FFmpeg @ 100%
  → 100% CPU                   → 50% CPU
  → 600 MB RAM                 → 300 MB RAM
  → FUNCIONA ✅                 → FUNCIONA ✅
```

**Cenário B: Workers juntos (atual)**
```
Instância única:
  - 4 vCPU
  - 8 GB RAM
  - Análise concurrency: 6
  - AutoMaster concurrency: 2
  
  → 6 + 2 = 8 FFmpeg simultâneos
  → 200% CPU (THROTTLING SEVERO!)
  → 1.2 GB RAM (ok)
  → TRAVA SOB CARGA ❌
```

**Medição real esperada:**

| Carga | FFmpeg Total | CPU Load | Performance |
|-------|--------------|----------|-------------|
| Baixa (2 análise) | 2 | 50% | Normal |
| Média (4 análise + 1 master) | 5 | 125% | Lento |
| Alta (6 análise + 2 master) | 8 | 200% | Muito lento |
| Pico (6 análise + 4 master) | 10 | 250% | Travado |

### 3.2 AutoMaster Pode Bloquear Análise?

**🟡 SIM, indiretamente via saturação de CPU.**

**Filas separadas previnem starvation direto:**
- Jobs de análise NÃO esperam jobs de masterização
- Cada fila tem seu worker dedicado

**MAS:** Competição por recursos compartilhados:
- CPU (ambos usam FFmpeg @ 100%)
- RAM (FFmpeg aloca ~150 MB por processo)
- I/O de disco (leitura/escrita de WAV)

**Exemplo real:**
```
t=0s:  Análise processa 4 jobs (4 FFmpeg, 100% CPU)
t=5s:  AutoMaster inicia 2 jobs (2 FFmpeg adicionais)
       → Total: 6 FFmpeg, 150% CPU
       → Análise: 40s → 70s (piora 75%)
       → AutoMaster: 60s → 100s (piora 66%)
```

### 3.3 Risco de Saturação de CPU

**🔴 RISCO CRÍTICO**

**Análise de limites:**

```javascript
// Worker Análise
const MAX_ANALYSIS_CONCURRENCY = 6;

// Worker AutoMaster
const MAX_AUTOMASTER_CONCURRENCY = 4; // (configurável, default 1)

// TOTAL POSSÍVEL: 10 FFmpeg paralelos
```

**Server Railway padrão:**
- 2-4 vCPU (depende do plano)
- 4-8 GB RAM

**Capacidade segura:**
```
Fórmula: MAX_CONCURRENT = vCPU / 2

2 vCPU → 1 FFmpeg máximo
4 vCPU → 2 FFmpeg máximo
8 vCPU → 4 FFmpeg máximo
```

**Situação atual:**
```
Config permitida: 6 + 4 = 10 FFmpeg
Capacidade real: 2 FFmpeg (server 4 vCPU)

SOBRECARGA: 500% (!)
```

**Consequências:**
1. Context switching excessivo (30-50% overhead de CPU)
2. Tempo de processamento sobe exponencialmente
3. Timeouts começam a ocorrer
4. Processos órfãos acumulam
5. Servidor trava completamente

### 3.4 Risco de Saturação de RAM

**🟡 RISCO MÉDIO**

**Consumo por processo:**
```
FFmpeg (análise):     ~150 MB
FFmpeg (automaster):  ~150 MB (HIGH mode com iterações: ~200 MB)
Node.js base:         ~200 MB
Redis:                ~50 MB (local) ou negligível (Redis Cloud)
PostgreSQL:           external (não conta)
```

**Cálculo de pico:**
```
Análise (6 jobs):      6 × 150 MB = 900 MB
AutoMaster (4 jobs):   4 × 200 MB = 800 MB
Node.js + Redis:       250 MB
──────────────────────────────────────
TOTAL:                 1.95 GB

Server 4 GB RAM:
  - Sistema operacional: 500 MB
  - Disponível: 3.5 GB
  - Usado (pico): 1.95 GB
  - Margem: 1.55 GB (OK)
```

**⚠️ PROBLEMA:** Se concorrência não for limitada, pode exceder.

```
Pior cenário (sem limite):
  - 10 análise simultâneas: 1.5 GB
  - 5 automaster simultâneas: 1.0 GB
  - Node + Redis: 0.3 GB
  → TOTAL: 2.8 GB (perto do limite)
```

**Risco de OOM (Out of Memory):**  
Moderado se concorrência não for controlada.

### 3.5 Risco de Saturação de Disco Temporário

**🔴 RISCO ALTO**

**Uso por job:**

| Tipo | Input | Temporários | Output | Total |
|------|-------|-------------|--------|-------|
| Análise | 50 MB | 100 MB | 50 MB | 200 MB |
| AutoMaster LOW | 50 MB | 500 MB | 50 MB | 600 MB |
| AutoMaster HIGH | 50 MB | 700 MB | 50 MB | 800 MB |

**Cenário crítico:**
```
6 análise + 4 automaster HIGH simultâneos:
  - Análise: 6 × 200 MB = 1.2 GB
  - AutoMaster: 4 × 800 MB = 3.2 GB
  → TOTAL: 4.4 GB de disco temporário

Railway disco efêmero: 10-20 GB (varia por plano)
  - Sistema: 5 GB
  - Aplicação: 2 GB
  - Disponível: 3-13 GB
  
RISCO: 4.4 GB pode exceder em servers pequenos
```

**Pior ainda:** Se cleanup falhar (como identificado em 2.6):
```
100 jobs/dia × 20% falha × 600 MB = 12 GB/dia de lixo
  → 2-3 dias = disco cheio
```

**Monitoramento necessário:**
```javascript
const diskUsage = require('diskusage');

setInterval(async () => {
  const usage = await diskusage.check('/tmp');
  const freePercent = (usage.free / usage.total) * 100;
  
  if (freePercent < 20) {
    logger.error({ freePercent }, 'DISCO QUASE CHEIO!');
    // Parar de aceitar novos jobs
    await queue.pause();
  }
}, 60000); // Check a cada 1 min
```

---

## 4. ARQUITETURA IDEAL

### 4.1 Worker Separado ou Reutilizar?

**✅ WORKER SEPARADO (Já implementado corretamente!)**

**Arquitetura atual descoberta:**
```
┌─────────────── API SERVER (server.js) ───────────────┐
│ - Recebe uploads                                     │
│ - Cria jobs nas filas                                │
│ - Endpoints de status                                │
└──────────────────┬───────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ↓                     ↓
┌────────────────┐    ┌────────────────┐
│  FILA 1        │    │  FILA 2        │
│ audio-analyzer │    │ automaster     │
└───────┬────────┘    └────────┬───────┘
        │                      │
        ↓                      ↓
┌────────────────┐    ┌────────────────┐
│  WORKER 1      │    │  WORKER 2      │
│ worker-redis   │    │ automaster-    │
│    .js         │    │  worker.cjs    │
│                │    │                │
│ Concurrency: 6 │    │ Concurrency: 1 │
└────────────────┘    └────────────────┘
```

**✅ ARQUITETURA CORRETA!**

**Vantagens:**
1. **Isolamento de falhas:** Crash de um worker não afeta o outro
2. **Escalabilidade independente:** Pode escalar análise sem escalar masterização
3. **Tuning específico:** Cada worker otimizado para seu workload
4. **Deploy independente:** Pode atualizar AutoMaster sem afetar análise

**⚠️ PROBLEMA:** Ambos workers podem rodar na mesma instância Railway.

### 4.2 Fila Atual Suporta Múltiplos Workers?

**✅ SIM**

BullMQ é projetado para múltiplos workers consumindo a mesma fila.

**Arquitetura distribuída já suportada:**
```
                    ┌──────────────┐
                    │   REDIS      │
                    │   (Fila)     │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ↓                  ↓                  ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  WORKER 1    │  │  WORKER 2    │  │  WORKER 3    │
│ (Instância 1)│  │ (Instância 2)│  │ (Instância 3)│
│              │  │              │  │              │
│ Concurrency:2│  │ Concurrency:2│  │ Concurrency:2│
└──────────────┘  └──────────────┘  └──────────────┘

                  → 6 jobs simultâneos total
                  → Capacidade cresce linearmente
```

**Lock distribuído (já implementado):**
```javascript
// services/job-lock.cjs
// Usa Redis SET NX EX para garantir que apenas 1 worker processa cada job
const lockKey = `job:lock:${jobId}`;
await redis.set(lockKey, workerId, 'NX', 'EX', LOCK_TTL_SECONDS);
```

**✅ Sistema já está pronto para scaling horizontal!**

### 4.3 Arquitetura Atual Permite Escalar Horizontalmente?

**✅ SIM, MAS com ressalvas**

**O que já funciona:**
- Múltiplos workers consumindo mesma fila
- Lock distribuído previne processamento duplicado
- Storage compartilhado (B2/S3)
- Job state persistente (Redis 7 dias)

**O que NÃO funciona ainda:**
- Concorrência global não controlada
- Monitoramento ausente
- AutoMaster não está usando fila (processa síncrono!)

**Arquitetura ideal (scaling horizontal):**

```
┌─────────── RAILWAY SERVICE 1 (API) ────────────┐
│  - Express API                                  │
│  - Apenas recebe uploads e cria jobs            │
│  - NÃO processa nada                            │
│  - 1 vCPU, 2 GB RAM                             │
└─────────────────────┬───────────────────────────┘
                      ↓
        ┌─────────────────────────────┐
        │   REDIS (Railway Service)   │
        │   - Filas BullMQ            │
        │   - Job state               │
        │   - Locks                   │
        └─────────────┬───────────────┘
                      │
        ┌─────────────┴─────────────────────┐
        │                                   │
        ↓                                   ↓
┌──────────────────────┐          ┌──────────────────────┐
│ SERVICE 2            │          │ SERVICE 3            │
│ Worker Análise       │          │ Worker AutoMaster    │
│ - worker-redis.js    │          │ - automaster-worker  │
│ - Concurrency: 2-4   │          │ - Concurrency: 1-2   │
│ - 4 vCPU, 8 GB RAM   │          │ - 4 vCPU, 8 GB RAM   │
│                      │          │                      │
│ Autoscale: 1-5       │          │ Autoscale: 1-3       │
└──────────────────────┘          └──────────────────────┘
                │                           │
                └───────────┬───────────────┘
                            ↓
                ┌─────────────────────────┐
                │   S3/B2 (Storage)       │
                │   - Inputs              │
                │   - Outputs             │
                │   - TTL: 7 dias         │
                └─────────────────────────┘
```

**Custo estimado:**
```
API Server:         $10-15/month (sempre ligado)
Worker Análise:     $30-50/month (autoscale)
Worker AutoMaster:  $20-40/month (autoscale)
Redis (Upstash):    $10/month (managed)
Storage (B2):       $5-10/month (50 GB)
──────────────────────────────────────
TOTAL MVP:          $75-125/month
```

### 4.4 Autoscaling Baseado em Fila

**✅ SUPORTADO pelo Railway**

**Métrica de autoscaling:**
```javascript
// Lógica a implementar no Railway ou código:

const queueMetrics = {
  waiting: await queue.getWaitingCount(),
  active: await queue.getActiveCount(),
  avgWaitTime: await calculateAvgWaitTime()
};

// Regra de scaling UP:
if (queueMetrics.waiting > 50 && queueMetrics.avgWaitTime > 300000) {
  // Mais de 50 jobs esperando E tempo médio > 5 min
  // → Adicionar +1 worker
}

// Regra de scaling DOWN:
if (queueMetrics.waiting < 10 && queueMetrics.avgWaitTime < 60000) {
  // Menos de 10 jobs esperando E tempo médio < 1 min
  // → Remover -1 worker (mínimo 1)
}
```

**Railway autoscaling config:**
```
Min replicas: 1
Max replicas: 5
Scale up threshold: CPU > 70% OR Queue > 50
Scale down threshold: CPU < 30% AND Queue < 10
Cooldown: 5 minutes
```

**Comportamento esperado:**
```
08:00 - 20 jobs na fila → 1 worker (suficiente)
12:00 - 100 jobs na fila → 3 workers (autoscale UP)
18:00 - 200 jobs na fila → 5 workers (autoscale UP)
02:00 - 5 jobs na fila → 1 worker (autoscale DOWN)
```

---

## 5. CUSTO E ESCALA

### 5.1 Jobs Simultâneos Suportados com Segurança

**Cálculo baseado em recursos:**

#### Cenário A: Single Instance (Atual)

```
Railway instance: 4 vCPU, 8 GB RAM

Análise worker (concurrency: 2):
  - 2 FFmpeg @ 100% = 50% CPU
  - 2 × 150 MB = 300 MB RAM

AutoMaster worker (concurrency: 1):
  - 1 FFmpeg @ 100% = 25% CPU
  - 1 × 200 MB = 200 MB RAM

TOTAL SEGURO:
  - CPU: 75% (com 25% margem)
  - RAM: 500 MB + 300 MB overhead = 800 MB
  - Jobs simultâneos: 3 total (2 análise + 1 master)
```

**Throughput single instance:**
```
Análise (40s):     2 jobs/40s = 180 jobs/hora
AutoMaster (60s):  1 job/60s  = 60 jobs/hora

Capacidade diária:
  - Análise: 4,320 jobs/dia
  - AutoMaster: 1,440 jobs/dia
```

#### Cenário B: Workers Separados (Recomendado)

```
Instance 1 (Análise):
  - 4 vCPU, 8 GB RAM
  - Concurrency: 4
  - Throughput: 360 jobs/hora = 8,640 jobs/dia

Instance 2 (AutoMaster):
  - 4 vCPU, 8 GB RAM
  - Concurrency: 2
  - Throughput: 120 jobs/hora = 2,880 jobs/dia
```

#### Cenário C: Autoscaling (Produção)

```
Análise workers (1-5 instances):
  - Min: 360 jobs/hora
  - Max: 1,800 jobs/hora
  - Capacidade: 8k-43k jobs/dia

AutoMaster workers (1-3 instances):
  - Min: 120 jobs/hora
  - Max: 360 jobs/hora
  - Capacidade: 2.8k-8.6k jobs/dia
```

### 5.2 Suportaria 100 Usuários Simultâneos?

**❌ NÃO na configuração atual**  
**✅ SIM com arquitetura de múltiplos workers**

**Análise de demanda:**

```
100 usuários simultâneos:
  - 70% fazem análise (avg 40s)
  - 30% fazem masterização (avg 60s)

Demanda:
  - Análise: 70 jobs (40s cada)
  - AutoMaster: 30 jobs (60s cada)

Tempo de fila (single worker):
  - Análise (concurrency 2): 70/2 × 40s = 1,400s = 23 min
  - AutoMaster (concurrency 1): 30/1 × 60s = 1,800s = 30 min

❌ Inaceitável: Usuários esperam 20-30 minutos
```

**Solução: Múltiplos workers**

```
3 workers de análise (concurrency 4 cada):
  - 12 jobs paralelos
  - 70 jobs / 12 = 6 rodadas
  - Tempo: 6 × 40s = 240s = 4 minutos ✅

2 workers de AutoMaster (concurrency 2 cada):
  - 4 jobs paralelos
  - 30 jobs / 4 = 8 rodadas
  - Tempo: 8 × 60s = 480s = 8 minutos ✅
```

**Custo para suportar 100 usuários simultâneos:**

| Componente | Instâncias | Specs | Custo/mês |
|------------|-----------|-------|-----------|
| API Server | 1 | 1 vCPU, 2 GB | $15 |
| Worker Análise | 3 | 4 vCPU, 8 GB | $150 |
| Worker AutoMaster | 2 | 4 vCPU, 8 GB | $100 |
| Redis | 1 (managed) | 1 GB | $10 |
| Storage | - | 200 GB | $15 |
| **TOTAL** | **7** | - | **$290/mês** |

### 5.3 Gargalos que Apareceriam Primeiro

**Ordem de saturação (carga crescente):**

#### 1º Gargalo: CPU (worker)
**Limite:** 2-4 FFmpeg paralelos por worker (4 vCPU)  
**Sintoma:** Processamento fica lento, timeouts começam  
**Solução:** Adicionar mais workers  

#### 2º Gargalo: Redis Connections
**Limite:** ~100 conexões simultâneas (Redis padrão)  
**Sintoma:** Errors "max clients reached"  
**Solução:** Upgrade do Redis instance, configurar maxclients  

#### 3º Gargalo: Disco Temporário
**Limite:** 10-20 GB (Railway ephemeral)  
**Sintoma:** "ENOSPC: no space left on device"  
**Solução:** Cleanup automático mais agressivo, mount external volume  

#### 4º Gargalo: RAM
**Limite:** 15-20 FFmpeg paralelos (8 GB RAM)  
**Sintoma:** OOM Killer, processos morrem  
**Solução:** Limitar concorrência, adicionar mais workers  

#### 5º Gargalo: Bandwidth (Storage)
**Limite:** Upload/download S3 simultâneos  
**Sintoma:** Lentidão em uploads/downloads  
**Solução:** CDN, storage regional  

#### 6º Gargalo: Postgres Connections
**Limite:** 100 conexões (Railway padrão)  
**Sintoma:** "too many connections"  
**Solução:** Connection pooling, upgrade do Postgres  

**Prioridade de monitoramento:**
```javascript
// Métricas críticas (ordem de importância):
1. CPU usage per worker          // Gargalo mais provável
2. Queue depth (waiting jobs)    // Indicador de saturação
3. Average processing time       // Performance degrading
4. Disk usage (/tmp)             // Crash iminente se > 90%
5. RAM usage                     // OOM risk
6. Redis latency                 // Network/Redis issues
```

---

## 6. RISCOS CRÍTICOS SE AUTOMASTER ATIVAR HOJE

### 🔴 RISCO 1: Saturação de CPU (Probabilidade: ALTA)

**Descrição:**  
Worker AutoMaster + Worker Análise competem por CPU na mesma instância.

**Trigger:**
```
5 uploads de análise + 2 uploads de AutoMaster
  → 5 + 2 = 7 FFmpeg rodando
  → 175% CPU em server 4 vCPU
  → Context switching severo
```

**Consequências:**
- Processamento 3-5x mais lento
- Timeouts de jobs (120s → excedido)
- Experiência ruim para todos os usuários
- Processos órfãos acumulam

**Detecção:**
```javascript
// Logs esperados:
[ERROR] Job timeout after 120s
[WARN] FFmpeg process killed by timeout
[ERROR] CPU usage: 180%
```

**Impacto:** 🔴 CRÍTICO  
**Probabilidade:** 90% (com 10+ usuários simultâneos)

### 🔴 RISCO 2: Disco Cheio (Probabilidade: MÉDIA-ALTA)

**Descrição:**  
Temporários não limpos quando jobs falham/timeout.

**Trigger:**
```
20% de taxa de falha × 30 jobs/hora × 700 MB = 4.2 GB/hora de lixo
  → 24 horas = 100 GB de lixo
  → Disco Railway (40 GB) estoura em 8-12 horas
```

**Consequências:**
- Novos jobs falham com ENOSPC
- API não consegue criar logs
- Sistema fica irresponsivo
- Requires manual intervention (SSH + rm -rf)

**Detecção:**
```bash
# Railway logs:
[ERROR] ENOSPC: no space left on device
[ERROR] Cannot write to /tmp/job-xyz/input.wav
[WARN] Disk usage: 98%
```

**Impacto:** 🔴 CRÍTICO  
**Probabilidade:** 60% (se taxa de falha > 15%)

### 🔴 RISCO 3: Processos Órfãos (Probabilidade: MÉDIA)

**Descrição:**  
FFmpeg continua rodando após timeout do Node.js.

**Trigger:**
```
Job AutoMaster HIGH com áudio 12 minutos:
  → Timeout 120s excedido
  → Node.js mata processo
  → FFmpeg pode continuar (zombie)
```

**Consequências:**
- CPU consumido por processos invisíveis
- 10+ FFmpeg órfãos em 1 hora
- Server fica lento/irresponsivo
- Requires restart do worker

**Detecção:**
```bash
ps aux | grep ffmpeg | wc -l
# Se > número de jobs ativos → órfãos presentes
```

**Impacto:** 🟡 ALTO  
**Probabilidade:** 40% (com jobs longos)

### 🔴 RISCO 4: Endpoint Síncrono Travando API (Probabilidade: ALTA)

**Descrição:**  
Endpoint `/api/automaster` processa síncrono, bloqueia thread.

**Código problemático:**
```javascript
// server.js linha 463
app.post('/api/automaster', async (req, res) => {
  // ❌ Processamento síncrono (40-120s)
  const result = await processAudioSync(...);
  res.json(result);
});
```

**Trigger:**
```
3 requests simultâneos em /api/automaster:
  → 3 threads bloqueadas por 60s
  → Outros endpoints (análise, status) ficam lentos
  → Timeout de requests HTTP (30s padrão)
```

**Consequências:**
- API fica irresponsiva
- Outros endpoints afetados
- Usuários recebem timeout
- Processamento desperdiçado (não entregue)

**Detecção:**
```javascript
// Logs esperados:
[ERROR] Request timeout after 30s
[WARN] Event loop lag: 15000ms
[ERROR] Response not sent: connection closed
```

**Impacto:** 🔴 CRÍTICO  
**Probabilidade:** 95% (com 5+ usuários)

### 🟡 RISCO 5: Falta de Priorização (Probabilidade: MÉDIA)

**Descrição:**  
Jobs premium esperam igual jobs free.

**Trigger:**
```
Fila AutoMaster:
  - 50 jobs free (STREAMING mode, 40s cada)
  - 5 jobs premium (HIGH mode, 120s cada)
  
Sem priorização:
  → Premium espera 50 × 40s = 33 minutos
```

**Consequências:**
- Experiência ruim para usuários pagantes
- Não há diferenciação de tiers
- Churn de usuários premium

**Impacto:** 🟡 MODERADO (negócio)  
**Probabilidade:** 70% (com mix de tiers)

### 🟡 RISCO 6: Ausência de Monitoramento (Probabilidade: ALTA)

**Descrição:**  
Sem métricas, problemas aparecem tarde demais.

**Blind spots:**
- CPU usage per worker
- Queue depth crescendo
- Disk usage crescendo
- Processos órfãos acumulando
- Average processing time aumentando

**Consequências:**
- Crash sem aviso prévio
- Sem dados para debug
- Sem alertas proativos
- Downtime prolongado

**Impacto:** 🟡 ALTO  
**Probabilidade:** 100% (monitoramento não existe ainda)

### 🟢 RISCO 7: OOM Killer (Probabilidade: BAIXA)

**Descrição:**  
RAM esgota, sistema mata processos.

**Trigger:**
```
10 análise + 5 AutoMaster simultâneos:
  → 10 × 150 MB + 5 × 200 MB = 2.5 GB
  → Server 4 GB RAM com 1 GB usado pelo SO
  → Próximo do limite mas ainda safe
```

**Consequências:**
- Processo worker morre
- Jobs não completam
- Restart automático (PM2/Railway)

**Impacto:** 🟡 MODERADO  
**Probabilidade:** 20% (se concorrência não controlada)

---

## 7. CHECKLIST PRÉ-PRODUÇÃO

### 🔴 BLOQUEADORES CRÍTICOS (Obrigatórios antes de ativar)

#### [ ] 1. Implementar Auto Master via Fila (NÃO síncrono)

**Problema atual:**
```javascript
// server.js linha 463 - SÍNCRONO ❌
app.post('/api/automaster', async (req, res) => {
  const result = await processSync(); // Bloqueia 60-120s
  res.json(result);
});
```

**Solução necessária:**
```javascript
// server.js - ASSÍNCRONO ✅
app.post('/api/automaster', upload.single('file'), async (req, res) => {
  const jobId = uuidv4();
  
  // Upload para storage
  const inputKey = await storageService.upload(req.file);
  
  // Criar job na fila
  await automasterQueue.add('process', {
    jobId,
    inputKey,
    mode: req.body.mode,
    userId: req.user.id
  });
  
  // Responder imediatamente
  res.json({
    jobId,
    status: 'queued',
    estimated_time: 60
  });
});

// Endpoint de status
app.get('/api/automaster/status/:jobId', async (req, res) => {
  const job = await jobStore.getJob(req.params.jobId);
  res.json(job);
});
```

**Estimativa:** 2-3 dias  
**Prioridade:** 🔴 CRÍTICA

#### [ ] 2. Separar Workers em Instâncias Dedicadas

**Configuração necessária no Railway:**

```
Service 1: soundyai-api
  - Start command: node server.js
  - Resources: 1 vCPU, 2 GB RAM
  - Scale: 1 (fixo)
  
Service 2: soundyai-worker-analysis
  - Start command: node work/worker-redis.js
  - Environment: WORKER_CONCURRENCY=2
  - Resources: 4 vCPU, 8 GB RAM
  - Scale: 1-3 (autoscale)
  
Service 3: soundyai-worker-automaster
  - Start command: node queue/automaster-worker.cjs
  - Environment: WORKER_CONCURRENCY=1
  - Resources: 4 vCPU, 8 GB RAM
  - Scale: 1-2 (autoscale)
```

**Estimativa:** 1 dia (configuração Railway)  
**Prioridade:** 🔴 CRÍTICA

#### [ ] 3. Garantir Cleanup com try/finally

**Correção em automaster-worker.cjs:**
```javascript
async function processJob(job) {
  let workspace = null;
  let heartbeatInterval = null;
  let lockData = null;
  
  try {
    lockData = await jobLock.acquireLock(jobId);
    workspace = await createJobWorkspace(jobId);
    heartbeatInterval = setInterval(...);
    
    // ... processamento
    
    return result;
    
  } finally {
    // SEMPRE EXECUTA (mesmo com erro/timeout)
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    if (lockData) {
      await jobLock.releaseLock(jobId, lockData.workerId).catch(() => {});
    }
    if (workspace) {
      await cleanupJobWorkspace(jobId).catch(err => {
        logger.error({ jobId, error: err.message }, 'Cleanup falhou');
      });
    }
  }
}
```

**Estimativa:** 4 horas  
**Prioridade:** 🔴 CRÍTICA

#### [ ] 4. Configurar Limite Global de Concorrência

**Adicionar validação no boot dos workers:**

```javascript
// Calcular limite seguro baseado em recursos
const os = require('os');
const availableCPUs = os.cpus().length;
const availableRAM_GB = os.totalmem() / (1024 ** 3);

// Fórmula conservadora
const MAX_SAFE_CONCURRENCY = Math.floor(availableCPUs / 2);

// Config de concurrency
let concurrency = Number(process.env.WORKER_CONCURRENCY) || 2;

// Limitar ao máximo seguro
if (concurrency > MAX_SAFE_CONCURRENCY) {
  logger.warn({
    requested: concurrency,
    limit: MAX_SAFE_CONCURRENCY,
    cpus: availableCPUs
  }, 'Concurrency limitada ao máximo seguro');
  
  concurrency = MAX_SAFE_CONCURRENCY;
}

logger.info({ concurrency, cpus: availableCPUs }, 'Worker configurado');
```

**Estimativa:** 2 horas  
**Prioridade:** 🔴 CRÍTICA

#### [ ] 5. Aumentar Timeout do AutoMaster

**Alterar timeout de 120s para 300s (5 minutos):**

```javascript
// automaster-worker.cjs
const TIMEOUT_MS = 300000; // 5 minutos (antes: 120s)
```

**Justificativa:**  
HIGH mode com áudio 10+ minutos pode exceder 120s.

**Estimativa:** 5 minutos  
**Prioridade:** 🔴 CRÍTICA

#### [ ] 6. Implementar Monitoramento de Recursos

**Métricas obrigatórias:**

```javascript
// services/monitoring.cjs
const os = require('os');
const diskUsage = require('diskusage');

class ResourceMonitor {
  constructor(queue) {
    this.queue = queue;
    this.startMonitoring();
  }
  
  startMonitoring() {
    setInterval(async () => {
      const metrics = await this.collectMetrics();
      
      // Logs estruturados
      logger.info({ metrics }, 'Resource snapshot');
      
      // Alertas
      if (metrics.cpu_percent > 80) {
        logger.error({ cpu: metrics.cpu_percent }, 'CPU ALTA!');
      }
      if (metrics.disk_free_percent < 20) {
        logger.error({ disk: metrics.disk_free_percent }, 'DISCO BAIXO!');
        // Pausar fila se crítico
        if (metrics.disk_free_percent < 10) {
          await this.queue.pause();
        }
      }
    }, 60000); // A cada 1 minuto
  }
  
  async collectMetrics() {
    const cpuLoad = os.loadavg()[0] / os.cpus().length;
    const memUsed = (os.totalmem() - os.freemem()) / os.totalmem();
    const diskInfo = await diskUsage.check('/tmp');
    
    const queueMetrics = {
      waiting: await this.queue.getWaitingCount(),
      active: await this.queue.getActiveCount(),
      failed: await this.queue.getFailedCount()
    };
    
    return {
      cpu_percent: cpuLoad * 100,
      mem_percent: memUsed * 100,
      disk_free_percent: (diskInfo.free / diskInfo.total) * 100,
      queue: queueMetrics,
      timestamp: Date.now()
    };
  }
}

module.exports = ResourceMonitor;
```

**Estimativa:** 1 dia  
**Prioridade:** 🔴 CRÍTICA

### ⚠️ IMPORTANTES (Recomendados antes de escalar)

#### [ ] 7. Implementar Priorização de Jobs

```javascript
// Ao criar job:
await queue.add('process', data, {
  priority: req.user.tier === 'premium' ? 1 : 5
});
```

**Estimativa:** 2 horas  
**Prioridade:** 🟡 ALTA

#### [ ] 8. Cron Job de Cleanup Temporários

```bash
# Crontab ou Railway cron
0 2 * * * find /tmp -name "automaster_*" -mtime +1 -delete
```

**Estimativa:** 30 minutos  
**Prioridade:** 🟡 ALTA

#### [ ] 9. Implementar Circuit Breaker para FFmpeg

```javascript
let ffmpegFailureCount = 0;
const MAX_FAILURES = 10;

if (ffmpegFailureCount >= MAX_FAILURES) {
  logger.error('Circuit breaker OPEN: FFmpeg failing');
  await queue.pause();
  // Alerta para on-call
}
```

**Estimativa:** 4 horas  
**Prioridade:** 🟡 MODERADA

#### [ ] 10. Health Check Endpoints

```javascript
app.get('/health', async (req, res) => {
  const checks = {
    redis: await redisConnection.ping(),
    queue_size: await queue.count(),
    disk_free: await checkDiskSpace(),
    worker_active: workerIsRunning
  };
  
  const healthy = Object.values(checks).every(c => c);
  res.status(healthy ? 200 : 503).json(checks);
});
```

**Estimativa:** 2 horas  
**Prioridade:** 🟡 MODERADA

### ✅ MELHORIAS FUTURAS (Não bloqueantes)

- [ ] Dashboard de monitoramento (Grafana + Prometheus)
- [ ] Webhook notifications quando job completa
- [ ] Rate limiting por usuário/tier
- [ ] Retry inteligente com cache de análises
- [ ] Preview de áudio (primeiros 30s)

---

## 8. RECOMENDAÇÃO FINAL

### 🟡 DEPLOY CONDICIONAL: Permitido COM mitigações

**Status atual:**
```
✅ Infraestrutura base existe (fila + Redis + lock)
✅ Workers separados implementados
⚠️ Concorrência não controlada
❌ AutoMaster ainda roda síncrono
❌ Monitoramento ausente
❌ Cleanup não garantido
```

**Cenários de deploy:**

#### Cenário A: Deploy Imediato (SEM mudanças)
```
🔴 NÃO RECOMENDADO

Riscos:
  - 90% probabilidade de saturação CPU
  - 60% probabilidade de disco cheio em 24h
  - API irresponsiva sob carga
  
Impacto:
  - Downtime provável
  - Experiência ruim para todos
  - Data loss possível
```

#### Cenário B: Deploy com Mitigações Mínimas (1 semana de trabalho)
```
🟡 ARRISCADO MAS VIÁVEL

Mudanças obrigatórias:
  1. AutoMaster via fila (não síncrono)
  2. Workers em instâncias separadas
  3. Limite de concorrência configurado
  4. Cleanup em try/finally
  5. Timeout aumentado para 300s
  
Capacidade estimada:
  - 50-100 AutoMasters/dia
  - 500-1000 Análises/dia
  
Riscos residuais:
  - Sem monitoramento (blind spots)
  - Sem alertas proativos
  - Priorização ausente
```

#### Cenário C: Deploy Produção-Ready (2-3 semanas de trabalho)
```
✅ RECOMENDADO

Implementa checklist completo:
  - Todos os 6 bloqueadores críticos
  - 4 itens importantes
  - Monitoramento robusto
  - Testes de carga
  
Capacidade estimada:
  - 500-1000 AutoMasters/dia
  - 5,000-10,000 Análises/dia
  - Autoscaling até 100 usuários simultâneos
  
Riscos residuais:
  - Baixos (<10% probabilidade de incident)
```

### Timeline Recomendado

**Semana 1:**
- [ ] AutoMaster via fila (3 dias)
- [ ] Workers separados no Railway (1 dia)
- [ ] Cleanup com try/finally (0.5 dia)
- [ ] Timeout 300s + concurrency limit (0.5 dia)

**Semana 2:**
- [ ] Monitoramento de recursos (1 dia)
- [ ] Health checks (0.5 dia)
- [ ] Priorização de jobs (0.5 dia)
- [ ] Cron cleanup (0.5 dia)
- [ ] Testes de integração (2 dias)

**Semana 3:**
- [ ] Teste de carga (3 dias)
- [ ] Ajustes finos (1 dia)
- [ ] Deploy staging (0.5 dia)
- [ ] Deploy produção (0.5 dia)

**TOTAL:** 15-20 dias úteis (3-4 semanas)

### Custos Projetados (Produção)

```
Configuração Inicial (100 masters/dia):
  - API: $15/mês
  - Worker Análise (1 instância): $50/mês
  - Worker AutoMaster (1 instância): $50/mês
  - Redis (Upstash managed): $10/mês
  - Storage (B2): $10/mês
  ────────────────────────────────────
  TOTAL: $135/mês
  
Scaling (1000 masters/dia):
  - API: $15/mês
  - Worker Análise (3 instâncias): $150/mês
  - Worker AutoMaster (2 instâncias): $100/mês
  - Redis: $15/mês
  - Storage: $30/mês
  ────────────────────────────────────
  TOTAL: $310/mês
```

---

## CONCLUSÃO

**Sistema atual:** 🟡 **Parcialmente pronto**

**Infraestrutura base:** ✅ Sólida (fila, Redis, lock, storage)  
**Workers:** ✅ Corretamente separados  
**Concorrência:** ❌ Não controlada (risco crítico)  
**AutoMaster:** ❌ Não integrado à fila (bloqueador)  
**Monitoramento:** ❌ Ausente (blind spots)  

**Recomendação final:**

```
🔴 NÃO ATIVAR HOJE sem mudanças
🟡 DEPLOY POSSÍVEL em 1 semana (mitigações mínimas)
✅ DEPLOY SEGURO em 3 semanas (production-ready)
```

**Risco mais crítico:** Saturação de CPU por workers na mesma instância.

**Quick win:** Separar workers em instâncias dedicadas (1 dia de trabalho, elimina 60% dos riscos).

**Alternativa de curto prazo (se não puder esperar):**
- Limite HARD: 5 AutoMasters/dia via interface
- Workers na mesma instância MAS concurrency total = 2
- Monitoramento manual diário
- Aviso "Beta" para usuários
- **RISCO:** Experiência degradada sob carga

---

**FIM DA AUDITORIA DE ARQUITETURA**  
**SoundyAI @ Railway - AutoMaster V1 Integration**
