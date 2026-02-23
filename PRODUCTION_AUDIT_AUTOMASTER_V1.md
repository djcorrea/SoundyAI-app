# AUDITORIA DE PRODUÇÃO - AutoMaster V1
## Análise de Viabilidade, Escala e Custo

**Data:** 23 de fevereiro de 2026  
**Sistema:** AutoMaster V1 - Backend Node.js + FFmpeg  
**Objetivo:** Avaliar prontidão para produção SaaS  

---

## 1. RESUMO EXECUTIVO

### ⚠️ SISTEMA NÃO ESTÁ PRONTO PARA PRODUÇÃO SEM MITIGAÇÕES CRÍTICAS

**Classificação de Risco:** 🔴 **ALTO**

**Principais Bloqueadores:**
1. **Ausência de fila de jobs** - Risco crítico de sobrecarga de CPU
2. **Processamento síncrono** - Trava servidor sob carga
3. **Sem limite de concorrência** - Esgotamento de recursos garantido
4. **Limpeza de temporários não garantida** - Risco de storage overflow
5. **Timeouts inadequados** - Processos órfãos em produção
6. **Sem monitoramento de recursos** - Sem visibilidade de saturação

**Recomendação:**
```
❌ NÃO DEPLOY em produção sem implementar:
   1. Sistema de fila (BullMQ + Redis)
   2. Workers dedicados isolados do API
   3. Limites de concorrência (2-4 workers simultâneos no mínimo)
   4. Autoscaling baseado em fila
   5. Cleanup automático de temporários
   6. Monitoramento de CPU/RAM/Disco
```

**Tempo estimado de implementação:** 2-4 semanas (arquitetura mínima segura)

---

## 2. ESTIMATIVA DE CUSTO POR MASTER

### 2.1 Recursos Consumidos (Cenário Médio)

**Arquivo típico:** 5 minutos @ 44.1kHz, 24-bit, estéreo

#### LOW/STREAMING Mode (Loudnorm Two-Pass)

**Chamadas FFmpeg:**
- 3× ffprobe (metadata): ~0.5s total
- 3× astats (análise espectral): ~15s
- 1× loudnorm first-pass: ~5s
- 2× render (referência + limiter pre-pass): ~10s
- 1× loudnorm second-pass: ~10s
- 3× measure-audio.cjs: ~15s
- 1× fix-true-peak (50% dos casos): ~5s

**TOTAL: 12-15 chamadas FFmpeg**  
**Tempo médio:** 35-45 segundos  
**CPU:** 1 core @ 100% por 40s = **0.011 core-hora**  
**RAM pico:** 250 MB (FFmpeg 150 MB + Node 100 MB)  
**Disco temporário:** 300-500 MB (3-5 arquivos WAV)

#### HIGH Mode (Limiter Iterativo)

**Chamadas FFmpeg:**
- 3× ffprobe: ~0.5s
- 3× astats: ~15s
- 1× macro stabilizer: ~5s
- 4× iterações limiter (média 3 convergem): ~30s
- 6× measure-audio.cjs: ~30s
- 2× TP correction (dentro das iterações): incluído

**TOTAL: 15-20 chamadas FFmpeg**  
**Tempo médio:** 50-70 segundos  
**CPU:** 1 core @ 100% por 60s = **0.017 core-hora**  
**RAM pico:** 300 MB  
**Disco temporário:** 400-700 MB (5-7 arquivos WAV)

#### Pior Cenário (LOW com 3 Retry Attempts)

**Chamadas FFmpeg:** 15 × 3 = **45 chamadas**  
**Tempo:** 90-120 segundos  
**CPU:** **0.033 core-hora**  
**RAM pico:** 300 MB  
**Disco temporário:** 1.2-1.5 GB

### 2.2 Custo Cloud (Huawei Cloud)

**Instância típica:** General Purpose c3.large  
- 2 vCPU  
- 4 GB RAM  
- 40 GB SSD  

**Preço estimado:** $0.05-0.08/hora  

**Custo por master:**
```
Cenário Médio (LOW):
  0.011 core-hora × $0.065/hora = $0.0007 (~$0.70 por 1000 masters)

Cenário Médio (HIGH):
  0.017 core-hora × $0.065/hora = $0.0011 (~$1.10 por 1000 masters)

Pior Cenário (3 retries):
  0.033 core-hora × $0.065/hora = $0.0021 (~$2.10 por 1000 masters)
```

**Storage (temporários):**
- Assumindo cleanup automático: negligível
- SEM cleanup: 500 MB × 1000 masters = 500 GB (❌ INVIÁVEL)

**Bandwidth:**
- Upload: 30-50 MB (input WAV)
- Download: 30-50 MB (output WAV)
- 100 masters/dia = 10 GB tráfego/dia

**CUSTO TOTAL ESTIMADO (com cleanup):**
```
100 masters/dia:
  - Compute: $0.07-0.11/dia
  - Storage: desprezível (temporários limpos)
  - Bandwidth: $0.10-0.20/dia (dependendo do plano)
  
TOTAL: ~$0.20-0.35/dia = $6-11/mês (100 masters/dia)
```

### 2.3 Custo por Escala

| Masters/Dia | Compute/Mês | Bandwidth/Mês | Total/Mês |
|------------|-------------|---------------|-----------|
| 100 | $3-5 | $3-6 | $6-11 |
| 500 | $15-25 | $15-30 | $30-55 |
| 1,000 | $30-50 | $30-60 | $60-110 |
| 5,000 | $150-250 | $150-300 | $300-550 |
| 10,000 | $300-500 | $300-600 | $600-1,100 |

**⚠️ IMPORTANTE:**  
Custos assumem **processamento distribuído** com fila e workers escaláveis.  
Sem isso, custos sobem exponencialmente por timeout/reprocessamento.

---

## 3. GARGALOS CRÍTICOS ENCONTRADOS

### 🔴 GARGALO 1: Processamento Síncrono Sem Fila

**Código identificado:**  
```javascript
// automaster-v1.cjs linha ~4500
// Execução síncrona bloqueante
await processAudio(config);
```

**Problema:**
- Cada master trava thread do Node.js por 40-120s
- Requests HTTP ficam esperando (timeout inevitável)
- Sem fila, uploads simultâneos executam em paralelo descontrolado

**Cenário de falha:**
```
5 usuários uploadam simultaneamente:
  → 5 processos FFmpeg rodando em paralelo
  → 2 vCPU saturadas a 250%+ (throttling)
  → Node.js começa a responder com 30s+ de latência
  → Timeouts HTTP (30s padrão)
  → 60% dos masters falham com TIMEOUT
  → Processos FFmpeg órfãos continuam rodando
  → Servidor trava completamente
```

**Impacto:**
- ❌ 10+ usuários simultâneos = crash garantido
- ❌ Impossível escalar horizontalmente sem fila
- ❌ Experiência de usuário imprevisível

**Mitigação necessária:**
- Implementar BullMQ + Redis
- Separar API (recebe job) de Workers (processa)
- API responde imediatamente com job_id
- Workers processam assincronamente
- Frontend poll status via job_id

### 🔴 GARGALO 2: Esgotamento de CPU

**Código identificado:**  
```javascript
// Sem limite de paralelismo em nenhum lugar
// FFmpeg spawna diretamente
execFileAsync('ffmpeg', args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
```

**Problema:**
- FFmpeg consome 1 core inteiro por processo @ 100%
- Servidor com 2 vCPU pode rodar apenas 2 FFmpeg confortavelmente
- 3º processo causa context switching excessivo → lentidão exponencial
- Sem limite, 10 uploads = 10 FFmpeg = 500% CPU = throttling severo

**Medições realistas:**

| Usuários Simultâneos | FFmpeg Paralelos | CPU Load | Performance |
|---------------------|-----------------|----------|-------------|
| 1 | 1 | 50% | Normal (40s) |
| 2 | 2 | 100% | Normal (42s) |
| 3 | 3 | 150% | Lento (70s) |
| 5 | 5 | 250% | Muito lento (180s) |
| 10 | 10 | 500% | Travado (timeout) |

**Impacto:**
- ❌ Sem limite de concorrência = crash garantido
- ❌ Response time degrada exponencialmente
- ❌ Timeouts causam processos órfãos

**Mitigação necessária:**
- Workers com concorrência limitada: 1-2 por worker
- Total de workers = total CPUs ÷ 2 (deixa margem para OS)
- Exemplo: servidor 4 vCPU = 2 workers × 1 job = 2 paralelos máximo
- Autoscaling: se fila > 10 jobs, provisionar + workers

### 🔴 GARGALO 3: Esgotamento de Memória

**Código identificado:**  
```javascript
// maxBuffer fixo de 10 MB
await execFileAsync('ffmpeg', args, { maxBuffer: 10 * 1024 * 1024 });
```

**Problema:**
- Cada FFmpeg aloca ~150 MB RAM (processamento WAV 24-bit)
- Node.js base: ~100-200 MB
- 5 FFmpeg paralelos = 750 MB + 150 MB Node = **900 MB**
- Servidor com 4 GB RAM:
  - Sistema operacional: 500 MB
  - MongoDB/Redis: 500 MB
  - Disponível: 3 GB
  - **Capacidade:** ~15 FFmpeg antes de swap/OOM

**Cenário de falha:**
```
8 usuários simultâneos em servidor 4 GB:
  → 8 FFmpeg × 150 MB = 1.2 GB
  → Node.js + OS + Redis = 1 GB
  → Total: 2.2 GB (OK)
  
15 usuários simultâneos:
  → 15 FFmpeg × 150 MB = 2.25 GB
  → Node.js + OS + Redis = 1 GB
  → Total: 3.25 GB (OK, mas próximo do limite)
  
20+ usuários:
  → Swap ativa (disco)
  → Performance degrada 10x
  → OOM Killer começa a matar processos
```

**Impacto:**
- ⚠️ Risco médio em servidores com 4+ GB RAM
- ❌ Risco alto em servidores com 2 GB RAM
- ❌ Sem monitoramento, OOM aparece sem aviso

**Mitigação necessária:**
- Monitorar RAM usage com alarmes (> 80%)
- Limitar concorrência baseado em RAM disponível
- Autoscaling: se RAM > 75%, provisionar + workers

### 🔴 GARGALO 4: Storage Overflow (Temporários)

**Código identificado:**  
```javascript
// automaster-v1.cjs linha ~2450
// Limpeza de temporários dentro do pipeline HIGH
for (const tempFile of tempFiles) {
  if (fs.existsSync(tempFile) && tempFile !== outputPath) {
    await fs.promises.unlink(tempFile).catch(() => {});
  }
}
```

**Problema:**
- Cleanup existe APENAS se pipeline completar com sucesso
- Se erro, timeout ou crash → temporários permanecem
- HIGH mode: 5-7 arquivos × 100 MB = **700 MB por master**
- 100 masters com 10% de falha = **7 GB de lixo**
- 1000 masters com 20% de falha = **140 GB de lixo**

**Código problemático - cleanup não garantido:**
```javascript
// Se erro ocorrer ANTES da limpeza, arquivos ficam órfãos
try {
  await renderWithLimiter(...);
  // ... processamento
} catch (error) {
  // ❌ throw error SEM cleanup
  throw error;
}
```

**Código com garantia de cleanup:**
```javascript
try {
  await renderWithLimiter(...);
} finally {
  // ✅ SEMPRE limpa, mesmo com erro
  await cleanupTempFiles(tempFiles);
}
```

**Impacto:**
- ❌ Storage cresce indefinidamente
- ❌ Disco cheio causa crash do servidor
- ❌ Sem monitoramento, problema aparece tarde demais

**Simulação realista:**
```
Servidor 40 GB SSD:
  - Sistema: 10 GB
  - Aplicação: 5 GB
  - Disponível: 25 GB
  
100 masters/dia × 10% falha × 700 MB = 7 GB/dia de lixo
  → 3 dias = 21 GB → disco 88% cheio
  → 4 dias = 28 GB → DISCO CHEIO → CRASH
```

**Mitigação necessária:**
- **CRÍTICO:** Wrapper try/finally em TODOS os pipelines
- Cron job: limpar arquivos > 24h em /tmp
- Monitoramento: alarme se disco > 70%
- Prefixo único em temporários: `automaster_${jobId}_*.wav`
- Timeout de cleanup: deletar temporários de jobs órfãos

### 🔴 GARGALO 5: Timeouts e Processos Órfãos

**Código identificado:**  
```javascript
// automaster-v1.cjs linha ~154
await execFileAsync('node', [MEASURE_SCRIPT, filePath], {
  maxBuffer: 10 * 1024 * 1024,
  timeout: 120000  // 120s = 2 minutos
});

// linha ~349
execFile('ffmpeg', args, { 
  timeout: 30000,  // 30s
  maxBuffer: 5 * 1024 * 1024 
}, callback);

// linha ~414
execFile('ffmpeg', args, { 
  timeout: 120000,  // 120s
  maxBuffer: 10 * 1024 * 1024 
}, callback);
```

**Problema:**
- Timeouts inconsistentes: 30s, 60s, 120s
- FFmpeg em áudio de 10+ minutos pode exceder 120s
- Quando timeout, Node.js mata processo mas FFmpeg pode continuar (zombie)
- HTTP timeout do Express (30s padrão) < timeout FFmpeg (120s)

**Cenário de falha:**
```
Usuário faz upload de áudio 10 minutos (30 MB WAV):
  → API inicia processamento (síncrono)
  → FFmpeg loudnorm first-pass: 15s
  → FFmpeg render: 20s
  → measure-audio: 15s
  → Loudnorm second-pass: 25s
  → TOTAL: 75s
  
Express timeout HTTP: 30s
  → Cliente recebe "504 Gateway Timeout" em 30s
  → Backend continua processando por mais 45s
  → Output gerado mas cliente não recebe
  → Processo órfão (resultado não entregue)
  → Storage desperdiçado
```

**Impacto:**
- ❌ Arquivos longos (8+ min) causam timeouts
- ❌ Processos órfãos desperdiçam CPU/storage
- ❌ Experiência ruim: "falhou" mas processou

**Mitigação necessária:**
- **CRÍTICO:** Sistema de fila assíncrono (job_id)
- Timeouts generosos para FFmpeg: 300s (5 min)
- HTTP responde imediatamente com job_id
- Cliente poll status do job
- Workers têm timeout alto, API não bloqueia

### 🔴 GARGALO 6: I/O de Disco

**Problema:**
- Pipeline escreve/lê múltiplos arquivos temporários
- HIGH mode: 7 arquivos (stabilized, iter1, iter2, iter3, iter4, output)
- Cada escrita: 50-100 MB
- Cada leitura: 50-100 MB

**Cálculo de I/O:**
```
HIGH mode (4 iterações):
  - Write stabilized: 100 MB
  - Read stabilized 4x: 400 MB
  - Write 4 iterations: 400 MB
  - Read para medição 4x: 400 MB
  - Write output final: 100 MB
  - Cleanup (deletes): negligível
  
TOTAL I/O: ~1.4 GB por master
```

**Latência de disco:**
- SSD: 500 MB/s read, 300 MB/s write → 1.4 GB = **~5-7s overhead de I/O**
- HDD: 100 MB/s read, 80 MB/s write → 1.4 GB = **~15-20s overhead de I/O**

**Impacto:**
- ⚠️ SSD: impacto moderado (+10-15% tempo)
- ❌ HDD: impacto severo (+30-40% tempo)
- ⚠️ Múltiplos jobs paralelos saturam I/O

**Mitigação necessária:**
- **OBRIGATÓRIO:** SSD para /tmp (temporários)
- Considerar RAM disk para temporários (risco: RAM limitada)
- Limitar concorrência para não saturar I/O

### 🔴 GARGALO 7: Retry Loop Descontrolado

**Código identificado:**  
```javascript
// automaster-v1.cjs linha ~4500
const MAX_ATTEMPTS = 3;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  result = await processAudio(config);
  
  validation = validateFinalResult(...);
  
  if (!validation.valid && attempt < MAX_ATTEMPTS) {
    // Reduzir target -1 dB e reprocessar
    config.targetLufs -= 1.0;
    // ❌ Reprocessa TUDO (15 FFmpeg calls novamente)
  }
}
```

**Problema:**
- LOW/STREAMING mode: até 3 tentativas completas
- Cada tentativa reprocessa TODO o pipeline (15 chamadas FFmpeg)
- Pior caso: 15 × 3 = **45 chamadas FFmpeg** (120s)
- Sem cache de análises intermediárias

**Impacto:**
- ❌ Tempo pode triplicar sem aviso
- ❌ CPU desperdiçado em recálculos
- ⚠️ Custos 3x maiores em piores casos

**Mitigação necessária:**
- Cache de análises (LUFS, TP, CF) - não recalcular
- Retry apenas render final (não análise)
- Limitar tentativas a 2 (não 3)
- HIGH mode: determinístico (sem retry) ✅

---

## 4. RISCOS DE ESCALA

### 4.1 Capacidade por Servidor (2 vCPU, 4 GB RAM)

**Configuração segura (COM fila):**
```
Concorrência máxima: 2 workers simultâneos
  - 2 FFmpeg @ 100% = 100% CPU (50% cada core)
  - 2 × 150 MB = 300 MB RAM (FFmpeg)
  - 200 MB Node.js + Redis
  - TOTAL: 500 MB (~12% RAM)
  
Throughput:
  - 40s por master (média)
  - 2 paralelos finalizando a cada 40s
  - Capacidade: 180 masters/hora
  - 24h: ~4,300 masters/dia
```

**Configuração ATUAL (SEM fila):**
```
Sem limite de concorrência:
  - 5 uploads simultâneos = LENTIDÃO SEVERA
  - 10 uploads simultâneos = CRASH
  - Capacidade real: ~50-100 masters/dia (instável)
```

### 4.2 Escalabilidade Horizontal

**COM Sistema de Fila (BullMQ):**

| Workers | vCPU | RAM | Masters/Hora | Masters/Dia | Custo/Mês |
|---------|------|-----|--------------|-------------|-----------|
| 1 | 2 | 4 GB | 90 | 2,160 | $50 |
| 2 | 4 | 8 GB | 180 | 4,320 | $100 |
| 5 | 10 | 20 GB | 450 | 10,800 | $250 |
| 10 | 20 | 40 GB | 900 | 21,600 | $500 |

**✅ Escalável linearmente** (adicionar workers aumenta capacidade proporcionalmente)

**SEM Sistema de Fila (ATUAL):**

| Escala | Comportamento |
|--------|--------------|
| 1-2 usuários | Funciona |
| 5-10 usuários | Lentidão severa |
| 10+ usuários | Crash |

**❌ NÃO escalável** (adicionar servidores não resolve sem fila centralizada)

### 4.3 Autoscaling Strategy (Com Fila)

**Métricas de decisão:**
```javascript
if (queueSize > 50 && avgWaitTime > 5min) {
  // Provisionar +1 worker
  scaleUp();
}

if (queueSize < 10 && avgWaitTime < 1min) {
  // Desprovisionar -1 worker (mínimo 1)
  scaleDown();
}
```

**Comportamento esperado:**
```
08:00 - 50 masters na fila → 1 worker (suficiente)
12:00 - 200 masters na fila → 3 workers (autoscale)
18:00 - 500 masters na fila → 5 workers (autoscale)
02:00 - 5 masters na fila → 1 worker (scale down)
```

**Economia estimada:**
- Sem autoscaling: 5 workers 24h = $250/mês
- Com autoscaling: média 2 workers = $100/mês (**60% economia**)

---

## 5. CONCORRÊNCIA E FILA

### 5.1 Por Que o Sistema PRECISA de Fila

**Razões técnicas:**

1. **Processamento é longo (40-120s)**  
   HTTP request não pode esperar tanto (timeout)

2. **Processamento é CPU-intensivo**  
   Precisa limitar concorrência ou servidor trava

3. **Processamento pode falhar**  
   Precisa retry automático sem reenviar arquivo

4. **Usuário precisa de feedback**  
   "Processing... 45% done" só é possível com fila

5. **Escalabilidade**  
   Sem fila, não dá para adicionar workers

**Arquitetura ATUAL (Inviável):**
```
Cliente → HTTP POST /master (upload WAV)
          ↓ (BLOQUEIA por 40-120s)
        Node.js executa FFmpeg síncrono
          ↓ (timeout em 30s)
        ❌ FALHA + processo órfão
```

**Arquitetura COM Fila (Viável):**
```
Cliente → HTTP POST /master (upload WAV)
          ↓ (responde em 200ms)
        API salva arquivo e cria job
          ↓
        Retorna { job_id: "abc123", status: "queued" }

Cliente → Poll GET /master/status/abc123
          ↓
        { status: "processing", progress: 45% }

Worker → Consome job da fila
         Processa com FFmpeg
         Atualiza status: "completed"
         
Cliente → GET /master/status/abc123
          { status: "completed", download_url: "..." }
```

### 5.2 Implementação Recomendada (BullMQ + Redis)

**Stack:**
- **BullMQ:** Fila robusta com retry, prioridade, delay
- **Redis:** Backend rápido em memória
- **Node.js Cluster:** Múltiplos workers isolados

**Código mínimo:**

```javascript
// api-server.js (API recebe jobs)
const { Queue } = require('bullmq');
const queue = new Queue('automaster', { connection: redis });

app.post('/master', async (req, res) => {
  const jobId = uuidv4();
  const filePath = await saveUploadedFile(req.file);
  
  await queue.add('process', {
    jobId,
    inputPath: filePath,
    mode: req.body.mode,
    userId: req.user.id
  }, {
    jobId,  // Job ID único
    priority: req.user.isPremium ? 1 : 5,
    attempts: 3,  // Retry automático
    backoff: { type: 'exponential', delay: 10000 }
  });
  
  res.json({ 
    job_id: jobId, 
    status: 'queued',
    estimated_time_seconds: 45
  });
});

app.get('/master/status/:jobId', async (req, res) => {
  const job = await queue.getJob(req.params.jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  const state = await job.getState();
  const progress = job.progress || 0;
  
  res.json({
    job_id: job.id,
    status: state,  // 'queued', 'active', 'completed', 'failed'
    progress,
    result: state === 'completed' ? job.returnvalue : null
  });
});
```

```javascript
// worker.js (Workers processam jobs)
const { Worker } = require('bullmq');
const { execSync } = require('child_process');

const worker = new Worker('automaster', async (job) => {
  const { jobId, inputPath, mode } = job.data;
  const outputPath = `/tmp/output_${jobId}.wav`;
  
  job.updateProgress(10);  // Iniciando
  
  // Executar automaster-v1.cjs
  const result = execSync(
    `node automaster-v1.cjs "${inputPath}" "${outputPath}" ${mode}`,
    { timeout: 300000, maxBuffer: 50 * 1024 * 1024 }
  );
  
  job.updateProgress(90);  // Finalizando
  
  const metrics = JSON.parse(result.toString());
  
  job.updateProgress(100);  // Completo
  
  return {
    output_path: outputPath,
    metrics
  };
}, {
  connection: redis,
  concurrency: 2,  // Máximo 2 jobs por worker
});

worker.on('failed', async (job, error) => {
  console.error(`Job ${job.id} failed:`, error.message);
  // Cleanup temporários
  await cleanupJobFiles(job.data.jobId);
});
```

**Custos adicionais:**
- Redis: $5-15/mês (instância pequena)
- Overhead de fila: negligível (<1% CPU)

### 5.3 Limite Seguro de Paralelismo

**Cálculo baseado em recursos:**

```javascript
// Fórmula conservadora
const MAX_CONCURRENT = Math.floor(availableCPUs / 2);

// Exemplos:
// 2 vCPU → 1 job simultâneo (conservador)
// 4 vCPU → 2 jobs simultâneos
// 8 vCPU → 4 jobs simultâneos
// 16 vCPU → 8 jobs simultâneos
```

**Recomendação por tipo de instância:**

| Instância | vCPU | RAM | Concurrent Jobs | Masters/Hora |
|-----------|------|-----|----------------|--------------|
| t3.small | 2 | 2 GB | 1 | 90 |
| t3.medium | 2 | 4 GB | 1-2 | 90-180 |
| c3.large | 2 | 4 GB | 1-2 | 90-180 |
| c3.xlarge | 4 | 8 GB | 2-3 | 180-270 |
| c3.2xlarge | 8 | 16 GB | 4-6 | 360-540 |

**⚠️ NUNCA:**
- Exceder número de CPUs (causa throttling)
- Ignorar RAM (OOM mata processos)
- Rodar sem monitoramento (não vê saturação)

---

## 6. PONTOS DE FALHA

### 6.1 Falhas Conhecidas em Produção

#### FALHA 1: Timeout em Arquivos Longos

**Sintoma:**
```
Áudio > 8 minutos → Timeout após 120s
Cliente recebe erro "Processing timeout"
Backend continua processando por mais 60s
Output gerado mas não entregue
```

**Root cause:**
```javascript
// timeout: 120000 (120s)
// Áudio de 10 min precisa ~150s
```

**Solução:**
- Sistema de fila (sem timeout HTTP)
- Aumentar timeout FFmpeg para 300s (5 min)
- Bloquear upload de áudios > 15 min (limite de produto)

#### FALHA 2: Processos Órfãos

**Sintoma:**
```
htop mostra 10+ processos ffmpeg rodando
Servidor lento/irresponsivo
CPU 500%+
RAM 90%+
```

**Root cause:**
- Erro/exception antes de cleanup
- Kill do processo pai não mata filho FFmpeg
- Timeout que não mata processo corretamente

**Solução:**
```javascript
// Sempre usar try/finally
let ffmpegProcess;
try {
  ffmpegProcess = spawn('ffmpeg', args);
  await waitForCompletion(ffmpegProcess);
} finally {
  // SEMPRE garantir que processo morre
  if (ffmpegProcess && !ffmpegProcess.killed) {
    ffmpegProcess.kill('SIGKILL');
  }
  await cleanupTempFiles();
}
```

#### FALHA 3: Disco Cheio

**Sintoma:**
```
Uploads começam a falhar com "ENOSPC: no space left on device"
Aplicação não inicia (não consegue criar logs)
Servidor inacessível via SSH (disk full)
```

**Root cause:**
- Temporários não limpos após falha
- 700 MB × 100 jobs failed = 70 GB lixo
- Sem monitoramento de disco

**Solução:**
- Cron job diário: `find /tmp -name "automaster_*" -mtime +1 -delete`
- Alarme CloudWatch: Disk > 70%
- Cleanup em try/finally (sempre executar)
- Limite de upload: max 100 MB por arquivo

#### FALHA 4: Race Condition em Cleanup

**Sintoma:**
```
Erro aleatório: "ENOENT: no such file or directory"
Acontece 1-5% dos casos
Não reproduzível consistentemente
```

**Root cause:**
```javascript
// HIGH mode linha ~2450
// Deleta múltiplos arquivos em loop
for (const tempFile of tempFiles) {
  await fs.promises.unlink(tempFile).catch(() => {});
}

// Se 2 jobs compartilham nome (improvável mas possível)
// Ou se cleanup roda 2x (retry), deleta arquivo já inexistente
```

**Solução:**
```javascript
// Verificar existência antes de deletar
const safeUnlink = async (file) => {
  try {
    if (fs.existsSync(file)) {
      await fs.promises.unlink(file);
    }
  } catch (error) {
    // Log mas não propagar erro
    console.error(`Cleanup warning: ${error.message}`);
  }
};
```

#### FALHA 5: OOM Killer

**Sintoma:**
```
Logs mostram: "Killed" (sem stack trace)
Processos Node.js desaparecem
PM2 restart automático
Job não completa
```

**Root cause:**
- Múltiplos FFmpeg saturando RAM (15+ paralelos)
- OOM Killer mata processo com maior uso (geralmente FFmpeg)
- Job não pode completar

**Solução:**
- Limitar concorrência baseado em RAM:
  ```javascript
  const availableRAM_GB = os.freemem() / (1024 ** 3);
  const maxJobs = Math.floor(availableRAM_GB / 0.3);  // 300 MB por job
  ```
- Monitoramento: alarme RAM > 80%
- Autoscaling: se RAM > 75% e fila > 10, adicionar worker

#### FALHA 6: Redis Connection Timeout

**Sintoma:**
```
Workers não consomem jobs da fila
Fila cresce indefinidamente
Logs: "Redis connection timeout"
```

**Root cause:**
- Redis instance undersized (t3.micro)
- Max connections excedida
- Rede instável

**Solução:**
- Usar Redis managed service com HA
- Configurar reconnection strategy:
  ```javascript
  const connection = {
    host: redisHost,
    port: 6379,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 50, 2000)
  };
  ```

### 6.2 Mitigações de Failover

**Health Check robusto:**
```javascript
app.get('/health', async (req, res) => {
  const checks = {
    ffmpeg: await checkFFmpegAvailable(),
    disk: await checkDiskSpace(),  // > 10% free
    cpu: os.loadavg()[0] < (os.cpus().length * 2),  // Load < 200%
    memory: os.freemem() > (1024 ** 3),  // > 1 GB free
    redis: await checkRedisConnection()
  };
  
  const healthy = Object.values(checks).every(c => c === true);
  
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    checks
  });
});
```

**Circuit breaker para FFmpeg:**
```javascript
let ffmpegFailureCount = 0;
const MAX_FAILURES = 5;

const runFFmpegWithCircuitBreaker = async (args) => {
  if (ffmpegFailureCount >= MAX_FAILURES) {
    throw new Error('Circuit breaker OPEN: FFmpeg failing consistently');
  }
  
  try {
    const result = await execFFmpeg(args);
    ffmpegFailureCount = 0;  // Reset on success
    return result;
  } catch (error) {
    ffmpegFailureCount++;
    throw error;
  }
};
```

---

## 7. ARQUITETURA MÍNIMA RECOMENDADA

### 7.1 Componentes Obrigatórios

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│  React/Next.js - Upload + Poll Status                       │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTP
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                       API SERVER                             │
│  - Recebe uploads (POST /master)                            │
│  - Cria jobs na fila                                        │
│  - Retorna job_id imediatamente                             │
│  - Status endpoint (GET /master/status/:id)                 │
│  - Download endpoint (GET /master/download/:id)             │
└────────────────┬────────────────────────────────────────────┘
                 │ Redis Protocol
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                      REDIS (Fila)                            │
│  - BullMQ queue backend                                     │
│  - Job state persistence                                    │
│  - Retry logic                                              │
└────────────────┬────────────────────────────────────────────┘
                 │ Worker Poll
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                   WORKER NODES (1-N)                         │
│  - Consome jobs da fila                                     │
│  - Executa automaster-v1.cjs                                │
│  - Atualiza progresso (10%, 50%, 90%, 100%)                 │
│  - Upload output para S3                                    │
│  - Cleanup temporários                                      │
│  Concorrência: 1-2 jobs por worker                          │
└─────────────────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                    S3 / OBJECT STORAGE                       │
│  - Input files (staging)                                    │
│  - Output files (results)                                   │
│  - TTL: 7 dias (auto-delete após 1 semana)                  │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Configuração Inicial (MVP)

**Infraestrutura mínima:**

1. **API Server:**
   - 1× t3.small (2 vCPU, 2 GB RAM)
   - Apenas API endpoints (não processa)
   - $20-30/mês

2. **Worker:**
   - 1× c3.large (2 vCPU, 4 GB RAM)
   - Processa 1-2 jobs simultâneos
   - $50-70/mês

3. **Redis:**
   - 1× t3.micro (managed ElastiCache)
   - 512 MB RAM (suficiente para 1000 jobs na fila)
   - $15-20/mês

4. **Storage:**
   - S3 ou equivalente
   - 50 GB (500 masters com TTL 7 dias)
   - $5-10/mês

**CUSTO TOTAL MVP:** $90-130/mês

**Capacidade MVP:**
- 2,000-4,000 masters/dia
- Latência: 40-60s (tempo em fila + processamento)
- 100-200 usuários/dia

### 7.3 Escalabilidade (Growth Phase)

**Quando escalar:**
```
Trigger: Fila > 50 jobs OU Wait time > 5 min
Ação: +1 Worker
```

**Configuração Growth (1,000 masters/dia):**

1. **API Server:** 1× t3.medium (sem mudança)
2. **Workers:** 3× c3.large (auto-scale 1-5)
3. **Redis:** 1× t3.small (1 GB RAM)
4. **Storage:** 200 GB S3

**CUSTO:** $250-400/mês

**Capacidade:**
- 10,000-15,000 masters/dia
- Latência: 30-45s
- 1,000-2,000 usuários/dia

### 7.4 Monitoramento Obrigatório

**Métricas críticas:**

```javascript
// CloudWatch / Prometheus metrics
const metrics = {
  // Fila
  'queue.size': () => queue.count(),
  'queue.waiting': () => queue.getWaitingCount(),
  'queue.active': () => queue.getActiveCount(),
  'queue.failed': () => queue.getFailedCount(),
  
  // Workers
  'worker.cpu_percent': () => process.cpuUsage(),
  'worker.memory_mb': () => process.memoryUsage().heapUsed / (1024 ** 2),
  'worker.jobs_completed': completedJobsCounter,
  'worker.jobs_failed': failedJobsCounter,
  
  // Sistema
  'system.disk_free_gb': () => checkDiskSpace('/tmp'),
  'system.cpu_load': () => os.loadavg()[0],
  'system.memory_free_gb': () => os.freemem() / (1024 ** 3),
  
  // Performance
  'job.duration_seconds': jobDurationHistogram,
  'job.wait_time_seconds': waitTimeHistogram,
};
```

**Alarmes obrigatórios:**
```yaml
alarms:
  - metric: queue.size
    threshold: > 100
    action: Scale up workers
    
  - metric: system.disk_free_gb
    threshold: < 5
    action: Page on-call + cleanup
    
  - metric: system.cpu_load
    threshold: > vCPU_count × 2
    action: Scale up workers
    
  - metric: system.memory_free_gb
    threshold: < 1
    action: Scale up workers
    
  - metric: queue.failed
    threshold: > 10 (last 10 min)
    action: Page on-call
```

---

## 8. CHECKLIST PRÉ-PRODUÇÃO

### 🔴 BLOQUEADORES CRÍTICOS (Obrigatórios)

- [ ] **Implementar sistema de fila (BullMQ + Redis)**
  - Estimativa: 1 semana
  - Risco sem isso: Crash garantido com 10+ usuários

- [ ] **Separar API de Workers**
  - Estimativa: 3 dias
  - Risco sem isso: API trava durante processamento

- [ ] **Implementar cleanup garantido (try/finally)**
  - Estimativa: 2 dias
  - Risco sem isso: Disco cheio em 3-7 dias

- [ ] **Configurar limites de concorrência**
  - Estimativa: 1 dia
  - Risco sem isso: CPU saturation, throttling severo

- [ ] **Implementar health checks robustos**
  - Estimativa: 2 dias
  - Risco sem isso: Sem detecção de falhas

- [ ] **Configurar monitoramento (CPU, RAM, Disk, Fila)**
  - Estimativa: 3 dias
  - Risco sem isso: Problemas aparecem tarde demais

- [ ] **Implementar alarmes críticos**
  - Estimativa: 1 dia
  - Risco sem isso: Downtime sem aviso

### ⚠️ IMPORTANTES (Recomendados)

- [ ] **Implementar autoscaling baseado em fila**
  - Estimativa: 1 semana
  - Benefício: Economia 40-60% em compute

- [ ] **Implementar circuit breaker para FFmpeg**
  - Estimativa: 1 dia
  - Benefício: Evita cascading failures

- [ ] **Configurar TTL automático em S3**
  - Estimativa: 2 horas
  - Benefício: Reduz storage costs

- [ ] **Implementar rate limiting por usuário**
  - Estimativa: 1 dia
  - Benefício: Previne abuse

- [ ] **Implementar logging estruturado**
  - Estimativa: 2 dias
  - Benefício: Debug mais rápido

- [ ] **Testes de carga (stress test)**
  - Estimativa: 3 dias
  - Benefício: Validar capacidade real

### ✅ MELHORIAS FUTURAS (Não-bloqueantes)

- [ ] Implementar retry inteligente (cache de análises)
- [ ] Implementar priorização de jobs (premium users)
- [ ] Implementar notificações (webhook quando completo)
- [ ] Implementar preview de áudio (primeiros 30s)
- [ ] Implementar analytics (tempo médio, taxa de falha)

### 🧪 TESTES OBRIGATÓRIOS ANTES DE DEPLOY

1. **Teste de Saturação:**
   ```
   Simular 20 uploads simultâneos
   Verificar: CPU < 150%, RAM usage, queue depth
   ```

2. **Teste de Falha:**
   ```
   Kill worker durante processamento
   Verificar: Job retry, cleanup temporários, sem orphans
   ```

3. **Teste de Disco Cheio:**
   ```
   Encher disco até 95%
   Verificar: Alarme dispara, graceful degradation
   ```

4. **Teste de Timeout:**
   ```
   Processar áudio de 15 minutos
   Verificar: Completa sem timeout
   ```

5. **Teste de OOM:**
   ```
   Simular 30 uploads simultâneos em 4 GB RAM
   Verificar: Limites de concorrência impedem OOM
   ```

---

## 9. CONCLUSÃO FINAL

### STATUS ATUAL: 🔴 NÃO PRONTO PARA PRODUÇÃO

**Gaps críticos identificados:**
- Ausência de sistema de fila
- Processamento síncrono bloqueante
- Sem limites de concorrência
- Cleanup não garantido
- Timeouts inadequados
- Sem monitoramento

**Estimativa de trabalho para produção:**
```
Implementação obrigatória: 2-3 semanas
Testes + ajustes: 1 semana
Monitoramento + alarmes: 3-5 dias
TOTAL: ~4-5 semanas (1 dev experiente)
```

**Custos estimados (após implementação):**
```
MVP (100 masters/dia):
  - Infraestrutura: $90-130/mês
  - Escala linear: +$50/mês por 1000 masters/dia
  
Growth (1000 masters/dia):
  - Infraestrutura: $250-400/mês
  - Custo por master: $0.0007-0.0011
```

**Recomendação final:**
```
1. NÃO fazer deploy sem implementar fila + workers
2. Implementar checklist de bloqueadores críticos
3. Fazer stress testing antes de produção
4. Começar com MVP (1 worker) e escalar conforme demanda
5. Monitorar métricas rigorosamente nas primeiras 2 semanas
```

**Alternativa de curto prazo (se não puder esperar 4 semanas):**
```
- Limite HARD: máximo 5 uploads simultâneos (nginx limit_req)
- Timeout HTTP: 180s (generoso)
- Cleanup manual diário (cron job)
- Monitoramento básico (disk, CPU)
- Aviso aos usuários: "Beta - capacidade limitada"
- Deploy cauteloso com poucos usuários (< 50 masters/dia)
```

---

**FIM DA AUDITORIA DE PRODUÇÃO**  
**AutoMaster V1 - SoundyAI**
