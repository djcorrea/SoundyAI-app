// worker-redis.js - WORKER REDIS EXCLUSIVO (ARQUITETURA REFATORADA)
// 🚀 ÚNICO RESPONSÁVEL POR PROCESSAMENTO - Legacy workers removidos

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
      // 🔍 LOGS DETALHADOS PARA DEBUG
      if (err.code === 'NoSuchKey') {
        console.error(`🚨 [WORKER-REDIS] ARQUIVO NÃO ENCONTRADO: ${key}`);
        console.error(`📁 [WORKER-REDIS] Verifique se o arquivo existe no bucket: ${BUCKET_NAME}`);
      }
      reject(new Error(`Arquivo não encontrado no Backblaze: ${key}`));
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

// ---------- Recovery de jobs órfãos (movido do index.js) ----------
async function recoverOrphanedJobs() {
  if (!pgConnected) {
    console.log(`🧪 [WORKER-REDIS] Postgres não disponível - pulando recovery`);
    return;
  }

  try {
    console.log("🔄 [WORKER-REDIS] Verificando jobs órfãos...");
    
    // 🚫 PRIMEIRO: Blacklist jobs problemáticos
    console.log("🚫 [WORKER-REDIS] Verificando jobs problemáticos para blacklist...");
    const problematicJobs = await pool.query(`
      SELECT file_key, COUNT(*) as failure_count, 
             ARRAY_AGG(id ORDER BY created_at DESC) as job_ids
      FROM jobs 
      WHERE error LIKE '%Recovered from orphaned state%' 
      OR error LIKE '%Pipeline timeout%'
      OR error LIKE '%FFmpeg%'
      OR error LIKE '%Memory%'
      GROUP BY file_key 
      HAVING COUNT(*) >= 3
    `);

    if (problematicJobs.rows.length > 0) {
      for (const row of problematicJobs.rows) {
        console.log(`🚫 [WORKER-REDIS] Blacklisting file: ${row.file_key} (${row.failure_count} failures)`);
        
        // Marcar todos os jobs relacionados como failed permanentemente
        await pool.query(`
          UPDATE jobs 
          SET status = 'failed', 
              error = $1, 
              updated_at = NOW()
          WHERE file_key = $2 
          AND status IN ('queued', 'processing')
        `, [
          `BLACKLISTED: File failed ${row.failure_count} times - likely corrupted/problematic`,
          row.file_key
        ]);
      }
      
      console.log(`🚫 [WORKER-REDIS] Blacklisted ${problematicJobs.rows.length} problematic files`);
    } else {
      console.log("✅ [WORKER-REDIS] Nenhum job problemático encontrado para blacklist");
    }
    
    // 🔄 DEPOIS: Recuperar jobs órfãos restantes (mas não blacklisted)
    const result = await pool.query(`
      UPDATE jobs 
      SET status = 'queued', updated_at = NOW(), error = 'Recovered from orphaned state by Redis worker'
      WHERE status = 'processing' 
      AND updated_at < NOW() - INTERVAL '10 minutes'
      AND error NOT LIKE '%BLACKLISTED%'
      RETURNING id, file_key
    `);

    if (result.rows.length > 0) {
      console.log(`🔄 [WORKER-REDIS] Recuperados ${result.rows.length} jobs órfãos:`, result.rows.map(r => r.id.substring(0,8)));
    }
  } catch (err) {
    console.error("❌ [WORKER-REDIS] Erro ao recuperar jobs órfãos:", err);
  }
}

// 🔥 RECOVERY A CADA 5 MINUTOS - Movido do index.js
setInterval(recoverOrphanedJobs, 300000);
recoverOrphanedJobs(); // Executa na inicialização
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
  console.log(`🚀 [WORKER-REDIS] INICIANDO processamento job ${job.id} (${jobId}) - ${fileKey}`);

  let localFilePath = null;

  try {
    // Atualizar status para processing
    console.log(`📝 [WORKER-REDIS] Atualizando status para processing...`);
    await updateJobStatus(jobId, 'processing');

    // Download do arquivo
    console.log(`⬇️ [WORKER-REDIS] Iniciando download do arquivo: ${fileKey}`);
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
    console.log(`💾 [WORKER-REDIS] Salvando resultado no banco...`);
    await updateJobStatus(jobId, 'done', result);

    console.log(`✅ [WORKER-REDIS] Job ${job.id} (${jobId}) concluído com sucesso`);
    return result;

  } catch (error) {
    console.error(`❌ [WORKER-REDIS] ERRO CRÍTICO no job ${job.id} (${jobId}):`, error.message);
    console.error(`📍 [WORKER-REDIS] Stack trace:`, error.stack);
    
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
console.log(`🏭 [WORKER-REDIS] 🚀 ÚNICO WORKER RESPONSÁVEL - Concorrência: ${concurrency}`);
console.log(`🏗️ [WORKER-REDIS] Arquitetura: Redis Workers Only (Legacy worker desabilitado)`);

const worker = createWorker('audio-analyzer', audioProcessor, concurrency);

// ---------- Event Listeners OTIMIZADOS - Logs estruturados ----------
worker.on('ready', () => {
  console.log(`🟢 [WORKER-REDIS] 🚀 WORKER ÚNICO PRONTO! PID: ${process.pid}, Concorrência: ${concurrency}`);
  console.log(`✅ [WORKER-REDIS] Arquitetura: Redis-only (sem conflitos legacy)`);
});

// 🚀 OTIMIZAÇÃO: Logs mais informativos para debugging
worker.on('active', (job) => {
  const { jobId, fileKey } = job.data;
  console.log(`🎯 [WORKER-REDIS] 🧠 PROCESSANDO: ${job.id} | JobID: ${jobId?.substring(0,8)} | File: ${fileKey?.split('/').pop()}`);
});

worker.on('completed', (job, result) => {
  const { jobId, fileKey } = job.data;
  const duration = Date.now() - job.timestamp;
  console.log(`✅ [WORKER-REDIS] 🎉 CONCLUÍDO: ${job.id} | JobID: ${jobId?.substring(0,8)} | Tempo: ${duration}ms | File: ${fileKey?.split('/').pop()}`);
});

worker.on('failed', (job, err) => {
  const { jobId, fileKey } = job.data;
  console.error(`❌ [WORKER-REDIS] 💥 FALHADO: ${job.id} | JobID: ${jobId?.substring(0,8)} | File: ${fileKey?.split('/').pop()} | Erro: ${err.message}`);
});

worker.on('error', (err) => {
  console.error(`🚨 [WORKER-REDIS] Erro no worker:`, err.message);
});

// ---------- Monitoramento de performance OTIMIZADO - Stats da fila ----------
setInterval(async () => {
  try {
    // 🔥 STATS SIMPLIFICADAS - Apenas contadores essenciais para reduzir requests
    const stats = await getQueueStats();
    console.log(`📊 [WORKER-REDIS] 📈 FILA: ${stats.waiting} aguardando | ${stats.active} ativas | ${stats.completed} completas | ${stats.failed} falhadas | PID: ${process.pid}`);
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

console.log(`🚀 [WORKER-REDIS] 🎯 Worker Redis EXCLUSIVO iniciado! PID: ${process.pid}`);
console.log(`🏗️ [WORKER-REDIS] Arquitetura: Redis Workers Only - Legacy worker desabilitado`);
console.log(`⚡ [WORKER-REDIS] Pronto para processar ${concurrency} jobs simultâneos por worker`);

// ---------- Health Check Server para Railway ----------
import express from 'express';
const healthApp = express();
const HEALTH_PORT = process.env.HEALTH_PORT || 8081; // Mudado para 8081

healthApp.get('/', (req, res) => {
  res.json({ 
    status: 'Worker Redis ativo', 
    timestamp: new Date().toISOString(),
    pid: process.pid,
    concurrency: concurrency,
    architecture: 'redis-workers-only'
  });
});

healthApp.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    worker: 'redis-active',
    timestamp: new Date().toISOString(),
    pid: process.pid
  });
});

healthApp.listen(HEALTH_PORT, () => {
  console.log(`🏥 [WORKER-REDIS] Health check server rodando na porta ${HEALTH_PORT}`);
});