require('dotenv').config();
/**
 * ============================================================================
 * AUTOMASTER WORKER - PROCESSADOR BULLMQ
 * ============================================================================
 * 
 * Worker BullMQ stateless para processamento distribuído de masterização.
 * - Concurrency controlado via env (max 4)
 * - Timeout 120s
 * - Isolamento por job
 * - Storage persistente (R2/S3)
 * - Cleanup automático
 * - Pronto para scaling horizontal
 * 
 * Autor: SoundyAI Engineering
 * Data: 2026-02-11
 * Versão: 5.0.0 (Production-Ready)
 * 
 * GARANTIAS:
 * - NÃO altera core DSP
 * - Stateless total
 * - Seguro para múltiplas instâncias
 * 
 * ============================================================================
 */

const { Worker } = require('bullmq');
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const redis = require('./redis-connection.cjs');
const storageService = require('../services/storage-service.cjs');
const { createServiceLogger, createJobLogger } = require('../services/logger.cjs');

const execFileAsync = promisify(execFile);

// ============================================================================
// LOGGER
// ============================================================================

const logger = createServiceLogger('automaster-worker');

// ============================================================================
// CONSTANTES
// ============================================================================

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '1', 10);
const TIMEOUT_MS = 120000; // 120 segundos
const MASTER_PIPELINE_SCRIPT = path.resolve(__dirname, '../automaster/master-pipeline.cjs');
const TMP_BASE_DIR = path.resolve(__dirname, '../tmp');

const JOB_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

// ============================================================================
// VALIDAÇÃO DE CONFIGURAÇÃO NO BOOT
// ============================================================================

if (WORKER_CONCURRENCY < 1 || WORKER_CONCURRENCY > 4) {
  logger.error({ concurrency: WORKER_CONCURRENCY }, 'WORKER_CONCURRENCY inválido (deve ser 1-4)');
  process.exit(1);
}

logger.info({ concurrency: WORKER_CONCURRENCY, timeout: TIMEOUT_MS }, 'Worker configurado');

// ============================================================================
// GARANTIR DIRETÓRIOS
// ============================================================================

function ensureDirectories() {
  if (!fsSync.existsSync(TMP_BASE_DIR)) {
    fsSync.mkdirSync(TMP_BASE_DIR, { recursive: true });
  }
}

ensureDirectories();

// ============================================================================
// VALIDAÇÕES
// ============================================================================

function validateJobData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Job data inválido');
  }

  const { jobId, inputKey, mode, userId } = data;

  if (!jobId || typeof jobId !== 'string' || !JOB_ID_REGEX.test(jobId)) {
    throw new Error('jobId inválido');
  }

  if (!inputKey || typeof inputKey !== 'string') {
    throw new Error('inputKey inválido');
  }

  if (!['STREAMING', 'BALANCED', 'IMPACT'].includes(mode)) {
    throw new Error(`mode inválido: ${mode}`);
  }

  return { jobId, inputKey, mode, userId };
}

// ============================================================================
// WORKSPACE ISOLADO
// ============================================================================

async function createJobWorkspace(jobId) {
  const workspace = path.join(TMP_BASE_DIR, jobId);
  await fs.mkdir(workspace, { recursive: true });
  return workspace;
}

async function cleanupJobWorkspace(jobId) {
  const workspace = path.join(TMP_BASE_DIR, jobId);
  try {
    await fs.rm(workspace, { recursive: true, force: true });
  } catch (error) {
    logger.warn({ jobId, error: error.message }, 'Falha no cleanup');
  }
}

// ============================================================================
// EXECUÇÃO DO PIPELINE
// ============================================================================

async function executePipeline(isolatedInput, isolatedOutput, mode, jobLogger) {
  jobLogger.info({ mode }, 'Executando pipeline');
  
  const { stdout, stderr } = await execFileAsync(
    'node',
    [MASTER_PIPELINE_SCRIPT, isolatedInput, isolatedOutput, mode],
    {
      timeout: TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      killSignal: 'SIGTERM'
    }
  );

  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

// ============================================================================
// PROCESSOR
// ============================================================================

async function processJob(job) {
  const startTime = Date.now();
  const { jobId, inputKey, mode, userId } = validateJobData(job.data);

  const jobLogger = createJobLogger(jobId, { mode, userId });
  jobLogger.info('Job iniciado');

  let workspace;

  try {
    // 1. Criar workspace isolado (10%)
    await job.updateProgress(10);
    workspace = await createJobWorkspace(jobId);
    const isolatedInput = path.join(workspace, 'input.wav');
    const isolatedOutput = path.join(workspace, 'result.wav');
    jobLogger.info({ workspace }, 'Workspace criado');

    // 2. Download input do storage (25%)
    await job.updateProgress(25);
    await storageService.downloadToFile(inputKey, isolatedInput);
    jobLogger.info({ inputKey }, 'Input baixado do storage');

    // 3. Executar pipeline (50%)
    await job.updateProgress(50);
    const result = await executePipeline(isolatedInput, isolatedOutput, mode, jobLogger);

    // Parse resultado
    let pipelineResult;
    try {
      pipelineResult = JSON.parse(result.stdout);
    } catch (parseError) {
      throw new Error(`Pipeline retornou JSON inválido: ${parseError.message}`);
    }

    if (pipelineResult.status !== 'SUCCESS') {
      throw new Error(`Pipeline falhou: ${JSON.stringify(pipelineResult)}`);
    }

    jobLogger.info({ result: pipelineResult }, 'Pipeline concluído');

    // 4. Verificar output (80%)
    await job.updateProgress(80);
    try {
      await fs.access(isolatedOutput);
    } catch {
      throw new Error('Pipeline não gerou arquivo de output');
    }

    // 5. Upload output para storage (90%)
    await job.updateProgress(90);
    const outputKey = await storageService.uploadOutput(isolatedOutput, jobId);
    jobLogger.info({ outputKey }, 'Output enviado ao storage');

    // 6. Cleanup (95%)
    await job.updateProgress(95);
    await cleanupJobWorkspace(jobId);

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    // 7. Concluído (100%)
    await job.updateProgress(100);

    jobLogger.info({ duration_ms: durationMs }, 'Job concluído');

    return {
      success: true,
      jobId,
      duration_ms: durationMs,
      output_key: outputKey,
      pipeline_result: pipelineResult
    };

  } catch (error) {
    // Cleanup em caso de erro
    if (workspace) {
      await cleanupJobWorkspace(jobId);
    }

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    jobLogger.error({ error: error.message, duration_ms: durationMs }, 'Job falhou');

    // Re-throw para BullMQ tratar retry
    throw new Error(`Job ${jobId} falhou: ${error.message}`);
  }
}

// ============================================================================
// WORKER BULLMQ
// ============================================================================

const worker = new Worker('automaster', processJob, {
  connection: redis,
  concurrency: WORKER_CONCURRENCY
});

worker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, duration_ms: result.duration_ms }, 'Job concluído');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job.id, error: err.message }, 'Job falhou');
});

worker.on('error', (err) => {
  logger.error({ error: err.message }, 'Erro interno do worker');
});

worker.on('ready', () => {
  logger.info({ concurrency: WORKER_CONCURRENCY }, 'Worker pronto');
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    logger.warn('Shutdown já em andamento');
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, 'Iniciando graceful shutdown');

  try {
    // 1. Pausar consumo da fila
    await worker.pause();
    logger.info('Fila pausada, aguardando jobs ativos');

    // 2. Aguardar jobs ativos finalizarem
    await worker.close();
    logger.info('Todos os jobs ativos finalizados');

    // 3. Fechar conexão Redis
    await redis.quit();
    logger.info('Conexão Redis encerrada');

    logger.info('Shutdown completo');
    process.exit(0);
  } catch (error) {
    logger.error({ error: error.message }, 'Erro durante shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

logger.info({
  concurrency: WORKER_CONCURRENCY,
  timeout_ms: TIMEOUT_MS,
  tmp_dir: TMP_BASE_DIR
}, 'AutoMaster Worker iniciado');

module.exports = worker;
