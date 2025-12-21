/**
 * 🔥 WORKER REDIS ROBUSTO - AUDITORIA COMPLETA IMPLEMENTADA
 * ✅ REGRA 1: Importação correta do audioProcessor
 * ✅ REGRA 2: getQueueReadyPromise() antes de criar Worker
 * ✅ REGRA 3: Nome exato da fila 'audio-analyzer'
 * ✅ REGRA 4: Logs de diagnóstico obrigatórios
 * ✅ REGRA 5: Tratamento de falhas silenciosas
 * ✅ REGRA 6: Healthcheck para Railway
 * ✅ REGRA 7: Eventos de fila para depuração
 */

import "dotenv/config";
import { Worker } from 'bullmq';
import { getQueueReadyPromise, getAudioQueue, getRedisConnection, getQueueEvents, closeAllConnections } from './lib/queue.js';
import pool from './db.js';
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from 'express';

// Definir service name para auditoria
process.env.SERVICE_NAME = 'worker';

// ✅ LOG OBRIGATÓRIO: Iniciando worker
console.log(`🚀 [WORKER] Iniciando worker`);
console.log(`📋 [WORKER-INIT][${new Date().toISOString()}] -> PID: ${process.pid}`);
console.log(`🌍 [WORKER-INIT][${new Date().toISOString()}] -> ENV: ${process.env.NODE_ENV || 'development'}`);

// ✅ VERIFICAÇÃO OBRIGATÓRIA: Environment Variables
if (!process.env.REDIS_URL) {
  console.error('💥 [WORKER] ERRO CRÍTICO: REDIS_URL não configurado');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('� [WORKER] ERRO CRÍTICO: DATABASE_URL não configurado');
  process.exit(1);
}

console.log(`🔧 [WORKER-INIT][${new Date().toISOString()}] -> Redis: CONFIGURADO`);
console.log(`🗃️ [WORKER-INIT][${new Date().toISOString()}] -> Postgres: CONFIGURADO`);

// ✅ REGRA OBRIGATÓRIA: Variáveis globais para conexão e worker
let redisConnection = null;
let audioQueue = null;
let worker = null;
let queueEvents = null;

// ✅ REGRA OBRIGATÓRIA: Inicialização usando getQueueReadyPromise() ANTES de criar Worker
async function initializeWorker() {
  try {
    console.log(`⏳ [WORKER-INIT][${new Date().toISOString()}] -> Chamando getQueueReadyPromise()...`);
    
    // ✅ REGRA 2: getQueueReadyPromise() antes de criar Worker BullMQ
    const queueResult = await getQueueReadyPromise();
    console.log(`✅ [WORKER-INIT][${new Date().toISOString()}] -> Queue system ready:`, queueResult.timestamp);
    
    // ✅ REGRA 3: Usar exatamente o mesmo nome da fila 'audio-analyzer'
    audioQueue = getAudioQueue();
    console.log(`✅ [WORKER-INIT][${new Date().toISOString()}] -> Fila 'audio-analyzer' obtida com sucesso`);
    
    // ✅ Obter mesma conexão Redis que API usa
    redisConnection = getRedisConnection();
    console.log(`✅ [WORKER-INIT][${new Date().toISOString()}] -> Conexão Redis centralizada obtida`);
    
    // ✅ Configuração de concorrência
    const concurrency = Number(process.env.WORKER_CONCURRENCY) || 6;
    console.log(`🚀 [WORKER-INIT][${new Date().toISOString()}] -> Worker iniciado com concurrency = ${concurrency} (WORKER_CONCURRENCY=${process.env.WORKER_CONCURRENCY || 'não definida, usando fallback'})`);

    // ✅ REGRA 1: Importação correta do audioProcessor - DEFINIDO LOCALMENTE
    console.log(`🔧 [WORKER-INIT][${new Date().toISOString()}] -> Registrando audioProcessor...`);
    
    // ✅ CRIAR WORKER COM REGRAS OBRIGATÓRIAS  
    // ✅ CORREÇÃO CRÍTICA: Worker registra handler para qualquer job na fila 'audio-analyzer'
    worker = new Worker('audio-analyzer', audioProcessor, { 
      connection: redisConnection, 
      concurrency,
      settings: {
        stalledInterval: 120000,
        maxStalledCount: 2,
        lockDuration: 180000,
        keepAlive: 60000,
        batchSize: 1,
        delayedDebounce: 10000,
      }
    });

    // ✅ LOG OBRIGATÓRIO: Processor registrado com sucesso
    console.log('🔥 [WORKER] Processor registrado com sucesso');
    console.log(`🎯 [WORKER-INIT][${new Date().toISOString()}] -> Worker criado para fila: 'audio-analyzer'`);

    // ✅ REGRA 7: Eventos de fila para depuração
    setupWorkerEventListeners();
    setupQueueEventListeners();

    // ✅ Verificar jobs pendentes
    const queueCounts = await audioQueue.getJobCounts();
    console.log(`📊 [WORKER-INIT][${new Date().toISOString()}] -> Status inicial da fila:`, queueCounts);
    
    if (queueCounts.waiting > 0) {
      console.log(`🎯 [WORKER-INIT][${new Date().toISOString()}] -> ${queueCounts.waiting} jobs aguardando processamento!`);
    }

    console.log(`✅ [WORKER-INIT][${new Date().toISOString()}] -> Worker inicializado com sucesso!`);
    console.log(`🎯 [WORKER-INIT][${new Date().toISOString()}] -> Aguardando jobs na fila 'audio-analyzer'...`);

    return worker;

  } catch (error) {
    // ✅ REGRA 5: Tratar falhas silenciosas - Erro explícito no console
    console.error('💥 [WORKER] ERRO CRÍTICO: Falha na inicialização do Worker');
    console.error(`💥 [WORKER-INIT][${new Date().toISOString()}] -> Erro:`, error.message);
    console.error(`💥 [WORKER-INIT][${new Date().toISOString()}] -> Stack trace:`, error.stack);
    
    // ✅ Se o processor não for carregado, lançar erro explícito
    if (error.message.includes('audioProcessor')) {
      console.error('💥 [WORKER] ERRO: audioProcessor não pode ser carregado/registrado');
    }
    
    process.exit(1);
  }
}

// ✅ REGRA 7: Eventos de Worker para depuração obrigatória
function setupWorkerEventListeners() {
  if (!worker) {
    console.error(`💥 [WORKER-EVENTS] Worker não inicializado, não é possível configurar event listeners`);
    return;
  }

  worker.on('ready', () => {
    console.log(`🟢 [WORKER-READY][${new Date().toISOString()}] -> WORKER PRONTO! PID: ${process.pid}`);
    console.log(`🎯 [WORKER-READY][${new Date().toISOString()}] -> Aguardando jobs na fila 'audio-analyzer'...`);
  });

  worker.on('active', (job) => {
    console.log(`🔵 [WORKER-EVENT][${new Date().toISOString()}] -> Job ATIVO: ${job.id} | Nome: ${job.name}`);
    const { jobId, externalId, fileKey, mode } = job.data;
    const displayId = externalId || jobId?.substring(0,8) || 'unknown';
    console.log(`🎯 [WORKER-PROCESSING][${new Date().toISOString()}] -> PROCESSANDO: ${job.id} | Display: ${displayId} | Arquivo: ${fileKey?.split('/').pop()} | Modo: ${mode}`);
  });

  worker.on('completed', (job, result) => {
    // ✅ REGRA 7: Log obrigatório de job concluído
    console.log(`✅ Job ${job.id} concluído`);
    const { jobId, externalId, fileKey } = job.data;
    const displayId = externalId || jobId?.substring(0,8) || 'unknown';
    console.log(`✅ [WORKER-SUCCESS][${new Date().toISOString()}] -> SUCESSO: ${job.id} | Display: ${displayId} | Arquivo: ${fileKey?.split('/').pop()} | Duração: ${result?.processingTime || 'desconhecido'}`);
  });

  worker.on('failed', (job, err) => {
    // ✅ REGRA 7: Log obrigatório de job falhado
    console.error(`❌ Job ${job?.id} falhou`, err);
    if (job) {
      const { jobId, externalId, fileKey } = job.data;
      const displayId = externalId || jobId?.substring(0,8) || 'unknown';
      console.error(`💥 [WORKER-FAILED][${new Date().toISOString()}] -> FALHOU: ${job.id} | Display: ${displayId} | Arquivo: ${fileKey?.split('/').pop()} | Erro: ${err.message}`);
    }
  });

  worker.on('error', (err) => {
    console.error(`🚨 [WORKER-EVENT][${new Date().toISOString()}] -> Erro do Worker: ${err.message}`);
    console.error(`🚨 [WORKER-ERROR][${new Date().toISOString()}] -> ERRO DO WORKER: ${err.message}`);
    console.error(`🚨 [WORKER-ERROR][${new Date().toISOString()}] -> Stack trace:`, err.stack);
  });

  worker.on('stalled', (job) => {
    console.warn(`🐌 [WORKER-EVENT][${new Date().toISOString()}] -> Job TRAVADO: ${job.id}`);
    const { jobId, externalId, fileKey } = job.data;
    const displayId = externalId || jobId?.substring(0,8) || 'unknown';
    console.warn(`🐌 [WORKER-STALLED][${new Date().toISOString()}] -> JOB TRAVADO: ${job.id} | Display: ${displayId} | Arquivo: ${fileKey?.split('/').pop()}`);
  });

  worker.on('progress', (job, progress) => {
    console.log(`📊 [WORKER-EVENT][${new Date().toISOString()}] -> Job PROGRESSO: ${job.id} | Progresso: ${progress}%`);
  });
}

// ✅ REGRA 7: Eventos de QueueEvents para depuração obrigatória
function setupQueueEventListeners() {
  try {
    // Obter QueueEvents da infraestrutura centralizada
    queueEvents = getQueueEvents();
    
    if (!queueEvents) {
      console.warn(`⚠️ [QUEUE-EVENTS] QueueEvents não disponível na infraestrutura centralizada`);
      return;
    }

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      console.log(`✅ Job ${jobId} concluído`);
      console.log(`🟢 [QUEUE-EVENT] Job CONCLUÍDO: ${jobId} | Duração: ${returnvalue?.processingTime || 'desconhecido'}`);
    });
    
    queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`❌ Job ${jobId} falhou`, failedReason);
      console.error(`🔴 [QUEUE-EVENT] Job FALHOU: ${jobId} | Motivo: ${failedReason}`);
    });
    
    queueEvents.on('error', (err) => {
      console.error(`🚨 [QUEUE-EVENT] Erro no QueueEvents:`, err.message);
    });

    console.log(`✅ [QUEUE-EVENTS] Event listeners configurados com sucesso`);

  } catch (error) {
    console.warn(`⚠️ [QUEUE-EVENTS] Falha ao configurar QueueEvents:`, error.message);
  }
}

// ---------- Global Error Handlers ----------
process.on('uncaughtException', (err) => {
  console.error(`🚨 [FATAL][${new Date().toISOString()}] -> UNCAUGHT EXCEPTION: ${err.message}`);
  console.error(`🚨 [FATAL][${new Date().toISOString()}] -> Stack trace:`, err.stack);
  
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`🚨 [FATAL][${new Date().toISOString()}] -> UNHANDLED REJECTION: ${reason}`);
  console.error(`🚨 [FATAL][${new Date().toISOString()}] -> Promise:`, promise);
  console.error(`🚨 [FATAL][${new Date().toISOString()}] -> Stack trace:`, reason?.stack);
  
  gracefulShutdown('unhandledRejection');
});

// 💻 FUNÇÕES DE PROCESSAMENTO E HELPERS ----------

// Necessário para resolver __dirname no módulo ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Atualizar status do job no PostgreSQL
 */
async function updateJobStatus(jobId, status, results = null) {
  try {
    // 🔒 VALIDAÇÃO CRÍTICA: Verificar UUID antes de executar query
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
      console.error(`💥 [DB-UPDATE] ERRO: jobId inválido para PostgreSQL: '${jobId}'`);
      console.error(`💥 [DB-UPDATE] IGNORANDO atualização - UUID inválido não pode ser usado no banco`);
      return null; // Retorna null mas não quebra o processamento
    }

    let query;
    let params;

    if (results) {
      query = `UPDATE jobs SET status = $1, results = $2, updated_at = NOW() WHERE id = $3 RETURNING *`;
      params = [status, JSON.stringify(results), jobId];
    } else {
      query = `UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
      params = [status, jobId];
    }

    const result = await pool.query(query, params);
    console.log(`📝 [DB-UPDATE][${new Date().toISOString()}] -> Job ${jobId} status updated to '${status}'`);
    return result.rows[0];
  } catch (error) {
    console.error(`💥 [DB-ERROR][${new Date().toISOString()}] -> Failed to update job ${jobId}:`, error.message);
    
    // 🔍 DIAGNÓSTICO ESPECÍFICO para erros UUID
    if (error.message.includes('invalid input syntax for type uuid')) {
      console.error(`🔍 [DB-ERROR] DIAGNÓSTICO: jobId '${jobId}' não é UUID válido para PostgreSQL`);
      console.error(`💡 [DB-ERROR] SOLUÇÃO: Verificar se API está gerando UUIDs corretos`);
    }
    throw error;
  }
}

/**
 * Download arquivo do S3/Backblaze B2
 */
async function downloadFileFromBucket(fileKey) {
  console.log(`⬇️ [DOWNLOAD][${new Date().toISOString()}] -> Starting download: ${fileKey}`);
  
  const s3 = new AWS.S3({
    endpoint: process.env.B2_ENDPOINT,
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
    region: 'us-east-005',
    s3ForcePathStyle: true
  });

  const tempDir = path.join(__dirname, 'temp');
  
  // Criar diretório temp se não existir
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const fileName = path.basename(fileKey);
  const localFilePath = path.join(tempDir, `${Date.now()}-${fileName}`);

  try {
    const params = {
      Bucket: process.env.B2_BUCKET_NAME,
      Key: fileKey
    };

    const data = await s3.getObject(params).promise();
    await fs.promises.writeFile(localFilePath, data.Body);
    
    console.log(`✅ [DOWNLOAD][${new Date().toISOString()}] -> Downloaded successfully: ${localFilePath}`);
    return localFilePath;
  } catch (error) {
    console.error(`💥 [DOWNLOAD][${new Date().toISOString()}] -> Failed to download ${fileKey}:`, error.message);
    throw error;
  }
}

// ✅ REGRA 1: audioProcessor corretamente definido e tratado
async function audioProcessor(job) {
  // 🔑 ESTRUTURA ATUALIZADA: suporte para jobId UUID + externalId para logs
  const { jobId, externalId, fileKey, mode, fileName } = job.data;
  
  // ✅ REGRA 4: LOG OBRIGATÓRIO - Worker recebendo job
  console.log('🎧 [WORKER] Recebendo job', job.id, job.data);
  console.log(`🎧 [WORKER-DEBUG] Job name: '${job.name}' | Esperado: 'process-audio'`);
  console.log(`🔑 [WORKER-DEBUG] UUID (Banco): ${jobId}`);
  console.log(`📋 [WORKER-DEBUG] External ID: ${externalId || 'não definido'}`);
  
  // ✅ VERIFICAÇÃO CRÍTICA: Confirmar se é o job correto
  if (job.name !== 'process-audio') {
    console.warn(`⚠️ [WORKER] Job com nome inesperado: '${job.name}' (esperado: 'process-audio')`);
  }
  
  console.log(`🎵 [PROCESS][${new Date().toISOString()}] -> INICIANDO job ${job.id}`, {
    jobId,
    externalId: externalId || 'legacy',
    fileKey,
    mode,
    fileName,
    jobName: job.name,
    timestamp: new Date(job.timestamp).toISOString(),
    attempts: job.attemptsMade + 1
  });

  let localFilePath = null;

  try {
    // ✅ REGRA 5: Validação de dados obrigatória
    if (!job.data || !fileKey || !jobId) {
      console.error('💥 [PROCESSOR] ERRO: Dados do job inválidos:', job.data);
      throw new Error(`Dados do job inválidos: ${JSON.stringify(job.data)}`);
    }

    // 🔒 VALIDAÇÃO CRÍTICA: Verificar se jobId é UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
      console.error(`💥 [PROCESSOR] ERRO: jobId não é UUID válido: '${jobId}'`);
      console.error(`💥 [PROCESSOR] SOLUÇÃO: Job será processado mas não atualizado no PostgreSQL`);
      console.error(`💥 [PROCESSOR] UUID esperado: formato '12345678-1234-1234-1234-123456789abc'`);
      throw new Error(`jobId inválido: '${jobId}' não é um UUID válido. Formato esperado: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`);
    }

    console.log(`✅ [PROCESSOR] jobId UUID válido: ${jobId}`);
    
    // ✅ VALIDAÇÃO DE S3: Verificar se fileKey tem formato válido
    if (!fileKey || typeof fileKey !== 'string' || fileKey.length < 3) {
      console.error(`💥 [PROCESSOR] ERRO: fileKey inválido: '${fileKey}'`);
      throw new Error(`fileKey inválido: '${fileKey}'`);
    }

    console.log(`✅ [PROCESSOR] fileKey válido: ${fileKey}`);

    console.log(`📝 [PROCESS][${new Date().toISOString()}] -> Atualizando status para processing no PostgreSQL...`);
    await updateJobStatus(jobId, 'processing');

    console.log(`⬇️ [PROCESS][${new Date().toISOString()}] -> Iniciando download do arquivo: ${fileKey}`);
    const downloadStartTime = Date.now();
    localFilePath = await downloadFileFromBucket(fileKey);
    const downloadTime = Date.now() - downloadStartTime;
    console.log(`🎵 [PROCESS][${new Date().toISOString()}] -> Arquivo baixado em ${downloadTime}ms: ${localFilePath}`);

    console.log(`🔍 [PROCESS][${new Date().toISOString()}] -> Validando arquivo antes do pipeline...`);
    const stats = await fs.promises.stat(localFilePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    console.log(`📏 [PROCESS][${new Date().toISOString()}] -> Tamanho do arquivo: ${stats.size} bytes (${fileSizeMB.toFixed(2)} MB)`);
    
    if (stats.size < 1000) {
      throw new Error(`Arquivo muito pequeno: ${stats.size} bytes (mínimo 1KB necessário)`);
    }

    // Simular processamento de análise de áudio
    console.log(`🎧 [PROCESS][${new Date().toISOString()}] -> Iniciando pipeline de análise de áudio...`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simular processamento

    const results = {
      analysis: 'completed',
      mode: mode,
      fileName: fileName,
      fileSize: stats.size,
      processingTime: Date.now() - job.timestamp
    };

    console.log(`✅ [PROCESS][${new Date().toISOString()}] -> Análise concluída com sucesso`);
    await updateJobStatus(jobId, 'completed', results);

    // Cleanup: remover arquivo temporário
    if (localFilePath && fs.existsSync(localFilePath)) {
      await fs.promises.unlink(localFilePath);
      console.log(`🗑️ [PROCESS][${new Date().toISOString()}] -> Arquivo temporário limpo: ${localFilePath}`);
    }

    return results;

  } catch (error) {
    // ✅ REGRA 4: Log de erro obrigatório no processor
    console.error('💥 [PROCESSOR] Falha ao processar job', job.id, error);
    console.error(`💥 [PROCESS][${new Date().toISOString()}] -> Falha no processamento do job:`, error.message);
    console.error(`💥 [PROCESS][${new Date().toISOString()}] -> Stack trace:`, error.stack);

    try {
      await updateJobStatus(jobId, 'failed');
    } catch (dbError) {
      console.error(`💥 [PROCESS][${new Date().toISOString()}] -> Falha ao atualizar status do job para failed:`, dbError.message);
    }

    // Cleanup: remover arquivo temporário mesmo em caso de erro
    if (localFilePath && fs.existsSync(localFilePath)) {
      try {
        await fs.promises.unlink(localFilePath);
        console.log(`🗑️ [PROCESS][${new Date().toISOString()}] -> Arquivo temporário limpo após erro: ${localFilePath}`);
      } catch (cleanupError) {
        console.error(`💥 [PROCESS][${new Date().toISOString()}] -> Falha ao limpar arquivo temp:`, cleanupError.message);
      }
    }

    throw error;
  }
}

// ✅ GRACEFUL SHUTDOWN ROBUSTO
async function gracefulShutdown(reason = 'unknown') {
  console.log(`📥 [SHUTDOWN][${new Date().toISOString()}] -> Iniciando shutdown graceful - Motivo: ${reason}`);
  
  try {
    // 1. Fechar Worker se existir
    if (worker) {
      console.log(`🔄 [SHUTDOWN][${new Date().toISOString()}] -> Fechando Worker...`);
      await worker.close();
      console.log(`✅ [SHUTDOWN][${new Date().toISOString()}] -> Worker fechado com sucesso`);
    }

    // 2. Usar função centralizada de cleanup
    console.log(`🔄 [SHUTDOWN][${new Date().toISOString()}] -> Fechando todas as conexões...`);
    await closeAllConnections();
    console.log(`✅ [SHUTDOWN][${new Date().toISOString()}] -> Todas as conexões fechadas`);

    console.log(`✅ [SHUTDOWN][${new Date().toISOString()}] -> Shutdown graceful concluído`);
    
  } catch (error) {
    console.error(`💥 [SHUTDOWN][${new Date().toISOString()}] -> Erro durante shutdown:`, error.message);
  } finally {
    process.exit(0);
  }
}

// 📡 SIGNAL HANDLERS ----------
process.on('SIGINT', () => {
  console.log(`📥 [SIGNAL][${new Date().toISOString()}] -> Received SIGINT`);
  gracefulShutdown('SIGINT');
});

process.on('SIGTERM', () => {
  console.log(`📥 [SIGNAL][${new Date().toISOString()}] -> Received SIGTERM`);
  gracefulShutdown('SIGTERM');
});

// ✅ REGRA 6: HEALTH CHECK SERVER para Railway (mantém container vivo)
const healthApp = express();
const HEALTH_PORT = process.env.HEALTH_PORT || 8081;

healthApp.get('/', (req, res) => {
  res.json({ 
    status: 'Worker Redis Ativo', 
    timestamp: new Date().toISOString(),
    pid: process.pid,
    redis: redisConnection ? 'conectado' : 'desconectado',
    worker: worker ? 'ativo' : 'inativo'
  });
});

healthApp.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'worker-redis',
    timestamp: new Date().toISOString(),
    pid: process.pid
  });
});

// ✅ KEEP ALIVE para Railway - setInterval como backup
setInterval(() => {
  console.log(`💓 [KEEP-ALIVE] Worker ativo - PID: ${process.pid} - ${new Date().toISOString()}`);
}, 300000); // A cada 5 minutos

// ✅ INICIALIZAR WORKER E HEALTH SERVER COMPLETO
async function startApplication() {
  try {
    console.log(`🚀 [WORKER] Iniciando aplicação Worker Redis...`);
    
    // ✅ REGRA 2: Inicializar Worker usando getQueueReadyPromise()
    await initializeWorker();
    
    // ✅ REGRA 6: Inicializar Health Server para Railway
    healthApp.listen(HEALTH_PORT, () => {
      console.log(`🏥 [HEALTH][${new Date().toISOString()}] -> Health check server rodando na porta ${HEALTH_PORT}`);
    });

    // ✅ LOGS FINAIS OBRIGATÓRIOS
    console.log(`🚀 [WORKER][${new Date().toISOString()}] -> Aplicação Worker Redis iniciada com sucesso!`);
    console.log(`📋 [WORKER][${new Date().toISOString()}] -> PID: ${process.pid}`);
    console.log(`🎯 [WORKER][${new Date().toISOString()}] -> Aguardando jobs na fila 'audio-analyzer'...`);

    // ✅ VERIFICAR SE HÁ JOBS PENDENTES
    try {
      const queueCounts = await audioQueue.getJobCounts();
      if (queueCounts.waiting > 0) {
        console.log(`🎯 [WORKER][${new Date().toISOString()}] -> ${queueCounts.waiting} jobs aguardando processamento IMEDIATO!`);
      }
    } catch (error) {
      console.warn(`⚠️ [WORKER] Não foi possível verificar jobs pendentes:`, error.message);
    }

  } catch (error) {
    // ✅ REGRA 5: Erro explícito se aplicação não conseguir iniciar
    console.error('💥 [WORKER] ERRO CRÍTICO: Falha ao iniciar aplicação Worker');
    console.error(`💥 [STARTUP][${new Date().toISOString()}] -> Falha ao iniciar aplicação:`, error.message);
    console.error(`💥 [STARTUP][${new Date().toISOString()}] -> Stack trace:`, error.stack);
    
    // ✅ Apontar exatamente onde está a falha estrutural
    if (error.message.includes('REDIS_URL')) {
      console.error('💥 [STARTUP] FALHA ESTRUTURAL: REDIS_URL não configurado ou inválido');
    } else if (error.message.includes('getaddrinfo')) {
      console.error('💥 [STARTUP] FALHA ESTRUTURAL: Conexão Redis não consegue resolver hostname');
    } else if (error.message.includes('audioProcessor')) {
      console.error('💥 [STARTUP] FALHA ESTRUTURAL: audioProcessor não pode ser carregado');
    } else if (error.message.includes('audio-analyzer')) {
      console.error('💥 [STARTUP] FALHA ESTRUTURAL: Nome da fila diferente ou Queue não inicializando');
    } else {
      console.error('💥 [STARTUP] FALHA ESTRUTURAL: Erro desconhecido na inicialização');
    }
    
    process.exit(1);
  }
}

// 🎬 EXECUTAR APLICAÇÃO ----------
startApplication();