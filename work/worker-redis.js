// worker-redis.js
import "dotenv/config";
import { createWorker, getQueueStats } from './queue/redis.js';
import pool from './db.js';
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ---------- Importar pipeline completo ----------
let processAudioComplete = null;

try {
  const imported = await import("./api/audio/pipeline-complete.js");
  processAudioComplete = imported.processAudioComplete;
  console.log("✅ [WORKER-REDIS] Pipeline completo carregado com sucesso!");
} catch (err) {
  console.error("❌ [WORKER-REDIS] CRÍTICO: Falha ao carregar pipeline:", err.message);
  process.exit(1);
}

// ---------- Resolver __dirname ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Verificar conexão Postgres via Singleton ----------
let pgConnected = false;
try {
  // Testar conexão com o pool Singleton
  const testResult = await pool.query('SELECT NOW()');
  pgConnected = true;
  console.log("✅ [WORKER-REDIS] Conectado ao Postgres via Singleton Pool");
} catch (err) {
  console.warn("⚠️ [WORKER-REDIS] Postgres não disponível:", err.message);
  console.log("🧪 [WORKER-REDIS] Continuando em modo mock sem Postgres");
}

// ---------- Configuração Backblaze ----------
console.log("🔍 [WORKER-REDIS] Debug B2 Config:");
console.log("   B2_KEY_ID:", process.env.B2_KEY_ID);
console.log("   B2_APP_KEY:", process.env.B2_APP_KEY?.substring(0,10) + "...");
console.log("   B2_BUCKET_NAME:", process.env.B2_BUCKET_NAME);
console.log("   B2_ENDPOINT:", process.env.B2_ENDPOINT);

const s3 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT || "https://s3.us-east-005.backblazeb2.com",
  region: "us-east-005",
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
  signatureVersion: "v4",
});
const BUCKET_NAME = process.env.B2_BUCKET_NAME;

// ---------- Baixar arquivo do bucket ----------
async function downloadFileFromBucket(key) {
  console.log(`🔍 [WORKER-REDIS] Tentando baixar: ${key}`);
  console.log(`🔍 [WORKER-REDIS] Bucket: ${BUCKET_NAME}`);
  
  const tempDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(__dirname, 'temp');
  await fs.promises.mkdir(tempDir, { recursive: true });
  
  const localPath = path.join(tempDir, `${Date.now()}_${path.basename(key)}`);

  return new Promise((resolve, reject) => {
    const write = fs.createWriteStream(localPath);
    const read = s3.getObject({ Bucket: BUCKET_NAME, Key: key }).createReadStream();

    // 🔥 TIMEOUT DE 2 MINUTOS - EVITA DOWNLOAD INFINITO
    const timeout = setTimeout(() => {
      write.destroy();
      read.destroy();
      reject(new Error(`Download timeout após 2 minutos para: ${key}`));
    }, 120000);

    read.on("error", (err) => {
      clearTimeout(timeout);
      console.error(`❌ [WORKER-REDIS] Erro no stream de leitura para ${key}:`, err.message);
      reject(err);
    });
    write.on("error", (err) => {
      clearTimeout(timeout);
      console.error(`❌ [WORKER-REDIS] Erro no stream de escrita para ${key}:`, err.message);
      reject(err);
    });
    write.on("finish", () => {
      clearTimeout(timeout);
      console.log(`✅ [WORKER-REDIS] Download concluído para ${key}`);
      resolve(localPath);
    });

    read.pipe(write);
  });
}

// ---------- Análise REAL via pipeline ----------
async function analyzeAudioWithPipeline(localFilePath, jobData) {
  const filename = path.basename(localFilePath);
  
  try {
    const fileBuffer = await fs.promises.readFile(localFilePath);
    console.log(`📊 [WORKER-REDIS] Arquivo lido: ${fileBuffer.length} bytes`);

    const t0 = Date.now();
    
    // 🔥 TIMEOUT DE 3 MINUTOS PARA EVITAR TRAVAMENTO
    const pipelinePromise = processAudioComplete(fileBuffer, filename, {
      jobId: jobData.jobId,
      reference: jobData?.reference || null
    });
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Pipeline timeout após 3 minutos para: ${filename}`));
      }, 180000);
    });

    console.log(`⚡ [WORKER-REDIS] Iniciando processamento de ${filename}...`);
    const finalJSON = await Promise.race([pipelinePromise, timeoutPromise]);
    const totalMs = Date.now() - t0;
    
    console.log(`✅ [WORKER-REDIS] Pipeline concluído em ${totalMs}ms`);

    finalJSON.performance = {
      ...(finalJSON.performance || {}),
      workerTotalTimeMs: totalMs,
      workerTimestamp: new Date().toISOString(),
      backendPhase: "5.1-5.4-redis",
      workerId: process.pid
    };

    finalJSON._worker = { 
      source: "pipeline_complete", 
      redis: true,
      pid: process.pid
    };

    return finalJSON;
    
  } catch (error) {
    console.error(`❌ [WORKER-REDIS] Erro crítico no pipeline para ${filename}:`, error.message);
    
    // 🔥 RETORNO DE SEGURANÇA
    return {
      status: 'error',
      error: {
        message: error.message,
        type: 'worker_pipeline_error',
        phase: 'worker_redis_processing',
        timestamp: new Date().toISOString()
      },
      score: 0,
      classification: 'Erro Crítico',
      scoringMethod: 'worker_redis_error_fallback',
      metadata: {
        fileName: filename,
        fileSize: 0,
        sampleRate: 48000,
        channels: 2,
        duration: 0,
        processedAt: new Date().toISOString(),
        engineVersion: 'worker-redis-error',
        pipelinePhase: 'error'
      },
      technicalData: {},
      warnings: [`Worker Redis error: ${error.message}`],
      buildVersion: 'worker-redis-error',
      frontendCompatible: false,
      _worker: { 
        source: "pipeline_error", 
        error: true, 
        redis: true,
        pid: process.pid
      }
    };
  }
}

// ---------- Atualizar status no Postgres (se disponível) ----------
async function updateJobStatus(jobId, status, data = null, error = null) {
  if (!pgConnected) {
    console.log(`🧪 [WORKER-REDIS] Mock update: ${jobId} -> ${status}`);
    return;
  }

  try {
    if (status === 'processing') {
      await pool.query(
        "UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2",
        [status, jobId]
      );
    } else if (status === 'done') {
      await pool.query(
        "UPDATE jobs SET status = $1, result = $2::jsonb, completed_at = NOW(), updated_at = NOW() WHERE id = $3",
        [status, JSON.stringify(data), jobId]
      );
    } else if (status === 'failed') {
      await pool.query(
        "UPDATE jobs SET status = $1, error = $2, updated_at = NOW() WHERE id = $3",
        [status, error, jobId]
      );
    }
    console.log(`✅ [WORKER-REDIS] Status atualizado no Postgres: ${jobId} -> ${status}`);
  } catch (err) {
    console.error(`❌ [WORKER-REDIS] Erro ao atualizar status no Postgres:`, err.message);
  }
}

// ---------- Processor do BullMQ ----------
async function audioProcessor(job) {
  const { jobId, fileKey, mode, fileName } = job.data;
  console.log(`🚀 [WORKER-REDIS] Processando job ${job.id} (${jobId}) - ${fileKey}`);

  let localFilePath = null;

  try {
    // Atualizar status para processing
    await updateJobStatus(jobId, 'processing');

    // Download do arquivo
    localFilePath = await downloadFileFromBucket(fileKey);
    console.log(`🎵 [WORKER-REDIS] Arquivo pronto para análise: ${localFilePath}`);

    // 🔍 VALIDAÇÃO BÁSICA DE ARQUIVO
    console.log(`🔍 [WORKER-REDIS] Validando arquivo antes do pipeline...`);
    const stats = await fs.promises.stat(localFilePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    if (stats.size < 1000) {
      throw new Error(`File too small: ${stats.size} bytes (minimum 1KB required)`);
    }
    
    if (fileSizeMB > 100) {
      throw new Error(`File too large: ${fileSizeMB.toFixed(2)} MB (maximum 100MB allowed)`);
    }
    
    console.log(`✅ [WORKER-REDIS] Arquivo validado (${fileSizeMB.toFixed(2)} MB)`);

    // Executar pipeline
    console.log("🚀 [WORKER-REDIS] Rodando pipeline completo...");
    const analysisResult = await analyzeAudioWithPipeline(localFilePath, job.data);

    const result = {
      ok: true,
      file: fileKey,
      mode: mode,
      analyzedAt: new Date().toISOString(),
      workerId: process.pid,
      redis: true,
      ...analysisResult,
    };

    // Atualizar status para done
    await updateJobStatus(jobId, 'done', result);

    console.log(`✅ [WORKER-REDIS] Job ${job.id} (${jobId}) concluído com sucesso`);
    return result;

  } catch (error) {
    console.error(`❌ [WORKER-REDIS] Erro no job ${job.id} (${jobId}):`, error.message);
    
    // Atualizar status para failed
    await updateJobStatus(jobId, 'failed', null, error.message);
    
    throw error; // BullMQ vai marcar como failed automaticamente
  } finally {
    // Limpar arquivo temporário
    if (localFilePath) {
      try {
        await fs.promises.unlink(localFilePath);
        console.log(`🗑️ [WORKER-REDIS] Arquivo temporário removido: ${path.basename(localFilePath)}`);
      } catch (e) {
        console.warn("⚠️ [WORKER-REDIS] Não foi possível remover arquivo temporário:", e?.message);
      }
    }
  }
}

// ---------- Criar Worker BullMQ ----------
const concurrency = Number(process.env.WORKER_CONCURRENCY) || 5;
console.log(`🏭 [WORKER-REDIS] Iniciando worker com concorrência: ${concurrency}`);

const worker = createWorker('audio-analyzer', audioProcessor, concurrency);

// ---------- Event Listeners OTIMIZADOS - Logs mínimos ----------
worker.on('ready', () => {
  console.log(`🟢 [WORKER-REDIS] Worker pronto! PID: ${process.pid}, Concorrência: ${concurrency}`);
});

// 🚀 OTIMIZAÇÃO: Combinar logs de active/completed para reduzir output
worker.on('active', (job) => {
  // Log simplificado - apenas info essencial
  const { jobId } = job.data;
  console.log(`🎯 [WORKER-REDIS] Processando: ${job.id} (${jobId})`);
});

worker.on('completed', (job, result) => {
  // Log simplificado - apenas info essencial
  const { jobId } = job.data;
  console.log(`✅ [WORKER-REDIS] Concluído: ${job.id} (${jobId})`);
});

worker.on('failed', (job, err) => {
  // Manter log de erro completo para debugging
  const { jobId } = job.data;
  console.error(`❌ [WORKER-REDIS] Falhado: ${job.id} (${jobId}) - ${err.message}`);
});

worker.on('error', (err) => {
  console.error(`🚨 [WORKER-REDIS] Erro no worker:`, err.message);
});

// ---------- Monitoramento de performance OTIMIZADO - REDUZ REQUESTS REDIS ----------
setInterval(async () => {
  try {
    // 🔥 STATS SIMPLIFICADAS - Apenas contadores essenciais para reduzir requests
    const stats = await getQueueStats();
    console.log(`📊 [WORKER-REDIS] Fila: ${stats.waiting} aguardando, ${stats.active} ativas, ${stats.completed} completas, ${stats.failed} falhadas`);
  } catch (err) {
    console.warn('⚠️ [WORKER-REDIS] Erro ao obter stats da fila:', err.message);
  }
}, 180000); // 🚀 OTIMIZADO: A cada 3 minutos (era 30s) - 6x MENOS requests Redis

// ---------- Graceful Shutdown ----------
process.on('SIGINT', async () => {
  console.log('📥 [WORKER-REDIS] Recebido SIGINT, encerrando worker...');
  await worker.close();
  // O pool Singleton será fechado quando todos os workers terminarem
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('📥 [WORKER-REDIS] Recebido SIGTERM, encerrando worker...');
  await worker.close();
  // O pool Singleton será fechado quando todos os workers terminarem
  process.exit(0);
});

// Tratamento de exceções não capturadas
process.on('uncaughtException', async (err) => {
  console.error('🚨 [WORKER-REDIS] UNCAUGHT EXCEPTION:', err.message);
  console.error('📜 Stack:', err.stack);
  
  try {
    await worker.close();
  } catch (closeErr) {
    console.error('❌ [WORKER-REDIS] Erro ao fechar conexões:', closeErr);
  }
  
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 [WORKER-REDIS] UNHANDLED REJECTION:', reason);
  console.error('📍 Promise:', promise);
});

console.log(`🚀 [WORKER-REDIS] Worker Redis iniciado! PID: ${process.pid}`);