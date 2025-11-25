// work/index.js
import dotenv from "dotenv";
dotenv.config();
import pkg from "pg";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";

// ---------- Worker Health Monitoring ----------
let workerHealthy = true;
let lastHealthCheck = Date.now();

function updateWorkerHealth() {
  workerHealthy = true;
  lastHealthCheck = Date.now();
}

// Monitor de saúde a cada 30 segundos
setInterval(() => {
  const timeSinceLastCheck = Date.now() - lastHealthCheck;
  if (timeSinceLastCheck > 120000) { // 2 minutos sem health check
    console.error(`🚨 Worker unhealthy: ${timeSinceLastCheck}ms sem update`);
    workerHealthy = false;
  }
}, 30000);

// Tratamento de exceções não capturadas
process.on('uncaughtException', (err) => {
  console.error('🚨 UNCAUGHT EXCEPTION - Worker crashing:', err.message);
  console.error('📜 Stack:', err.stack);
  
  // Tentar cleanup de jobs órfãos antes de sair
  client.query(`
    UPDATE jobs 
    SET status = 'failed', 
        error = 'Worker crashed with uncaught exception: ${err.message}',
        updated_at = NOW()
    WHERE status = 'processing'
  `).catch(cleanupErr => {
    console.error('❌ Failed to cleanup jobs on crash:', cleanupErr);
  }).finally(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 UNHANDLED REJECTION:', reason);
  console.error('📍 Promise:', promise);
  // Não mata o worker imediatamente, mas registra o problema
  workerHealthy = false;
});

// ---------- Resolver __dirname ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Importar pipeline completo ----------
let processAudioComplete = null;

try {
  const imported = await import("../api/audio/pipeline-complete.js");
  processAudioComplete = imported.processAudioComplete;
  console.log("✅ Pipeline completo carregado com sucesso!");
} catch (err) {
  console.error("❌ CRÍTICO: Falha ao carregar pipeline:", err.message);
  console.log("🔍 Debug info:");
  console.log("   import.meta.url:", import.meta.url);
  console.log("   process.cwd():", process.cwd());
  console.log("   __dirname equivalent:", path.dirname(fileURLToPath(import.meta.url)));
  process.exit(1); // encerra só se pipeline não existir
}

// ---------- Conectar ao Postgres ----------
const { Client } = pkg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
});
await client.connect();
console.log("✅ Worker conectado ao Postgres");

// ---------- Configuração Backblaze ----------
console.log("🔍 Debug B2 Config:");
console.log("   B2_KEY_ID:", process.env.B2_KEY_ID);
console.log("   B2_APP_KEY:", process.env.B2_APP_KEY?.substring(0,10) + "...");
console.log("   B2_BUCKET_NAME:", process.env.B2_BUCKET_NAME);
console.log("   B2_ENDPOINT:", process.env.B2_ENDPOINT);

const s3 = new S3Client({
  endpoint: process.env.B2_ENDPOINT || "https://s3.us-east-005.backblazeb2.com",
  region: "us-east-005",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
  forcePathStyle: true,
});
const BUCKET_NAME = process.env.B2_BUCKET_NAME;

// ---------- Baixar arquivo do bucket ----------
async function downloadFileFromBucket(key) {
  console.log(`🔍 Tentando baixar: ${key}`);
  console.log(`🔍 Bucket: ${BUCKET_NAME}`);
  
  const localPath = path.join("/tmp", path.basename(key)); // Railway usa /tmp
  return new Promise(async (resolve, reject) => {
    try {
      const write = fs.createWriteStream(localPath);
      const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
      const response = await s3.send(command);
      const read = response.Body;

      // 🔥 TIMEOUT DE 2 MINUTOS - EVITA DOWNLOAD INFINITO
      const timeout = setTimeout(() => {
        write.destroy();
        if (read && read.destroy) read.destroy();
        reject(new Error(`Download timeout após 2 minutos para: ${key}`));
      }, 120000);

      read.on("error", (err) => {
        clearTimeout(timeout);
        console.error(`❌ Erro no stream de leitura para ${key}:`, err.message);
        console.error(`❌ Código do erro:`, err.code);
        console.error(`❌ Status:`, err.statusCode);
        reject(err);
      });
      write.on("error", (err) => {
        clearTimeout(timeout);
        console.error(`❌ Erro no stream de escrita para ${key}:`, err.message);
        reject(err);
      });
      write.on("finish", () => {
        clearTimeout(timeout);
        console.log(`✅ Download concluído para ${key}`);
        resolve(localPath);
      });

      read.pipe(write);
    } catch (err) {
      reject(err);
    }
  });
}

// ---------- Análise REAL via pipeline ----------
async function analyzeAudioWithPipeline(localFilePath, job) {
  const filename = path.basename(localFilePath);
  
  try {
    const fileBuffer = await fs.promises.readFile(localFilePath);
    console.log(`📊 Arquivo lido: ${fileBuffer.length} bytes`);

    const t0 = Date.now();
    
    // 🔥 TIMEOUT DE 3 MINUTOS PARA EVITAR TRAVAMENTO
    const pipelinePromise = processAudioComplete(fileBuffer, filename, {
      jobId: job.id,
      reference: job?.reference || null
    });
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Pipeline timeout após 3 minutos para: ${filename}`));
      }, 180000); // 3 minutos (reduzido de 5)
    });

    console.log(`⚡ Iniciando processamento de ${filename}...`);
    const finalJSON = await Promise.race([pipelinePromise, timeoutPromise]);
    const totalMs = Date.now() - t0;
    
    console.log(`✅ Pipeline concluído em ${totalMs}ms`);

    finalJSON.performance = {
      ...(finalJSON.performance || {}),
      workerTotalTimeMs: totalMs,
      workerTimestamp: new Date().toISOString(),
      backendPhase: "5.1-5.4",
    };

    finalJSON._worker = { source: "pipeline_complete" };

    return finalJSON;
    
  } catch (error) {
    console.error(`❌ Erro crítico no pipeline para ${filename}:`, error.message);
    
    // 🔥 RETORNO DE SEGURANÇA - NÃO MATA O WORKER
    return {
      status: 'error',
      error: {
        message: error.message,
        type: 'worker_pipeline_error',
        phase: 'worker_processing',
        timestamp: new Date().toISOString()
      },
      score: 0,
      classification: 'Erro Crítico',
      scoringMethod: 'worker_error_fallback',
      metadata: {
        fileName: filename,
        fileSize: 0,
        sampleRate: 48000,
        channels: 2,
        duration: 0,
        processedAt: new Date().toISOString(),
        engineVersion: 'worker-error',
        pipelinePhase: 'error'
      },
      technicalData: {},
      warnings: [`Worker error: ${error.message}`],
      buildVersion: 'worker-error',
      frontendCompatible: false,
      _worker: { source: "pipeline_error", error: true }
    };
  }
}

// ---------- Processar 1 job ----------
async function processJob(job) {
  console.log("📥 Processando job:", job.id);

  let localFilePath = null;
  let heartbeatInterval = null;

  try {
    // 🔥 ATUALIZAR STATUS + VERIFICAR SE FUNCIONOU
    const updateResult = await client.query(
      "UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2",
      ["processing", job.id]
    );
    
    if (updateResult.rowCount === 0) {
      throw new Error(`Falha ao atualizar job ${job.id} para status 'processing'`);
    }

    // 🔥 HEARTBEAT A CADA 30 SEGUNDOS
    heartbeatInterval = setInterval(async () => {
      try {
        await client.query(
          "UPDATE jobs SET updated_at = NOW() WHERE id = $1 AND status = 'processing'",
          [job.id]
        );
        console.log(`💓 Heartbeat enviado para job ${job.id}`);
      } catch (err) {
        console.warn(`⚠️ Falha no heartbeat para job ${job.id}:`, err.message);
      }
    }, 30000);

    localFilePath = await downloadFileFromBucket(job.file_key);
    console.log(`🎵 Arquivo pronto para análise: ${localFilePath}`);

    // 🔍 VALIDAÇÃO BÁSICA DE ARQUIVO
    console.log(`🔍 [${job.id.substring(0,8)}] Validando arquivo antes do pipeline...`);
    const stats = await fs.promises.stat(localFilePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    if (stats.size < 1000) {
      throw new Error(`File too small: ${stats.size} bytes (minimum 1KB required)`);
    }
    
    if (fileSizeMB > 100) {
      throw new Error(`File too large: ${fileSizeMB.toFixed(2)} MB (maximum 100MB allowed)`);
    }
    
    console.log(`✅ [${job.id.substring(0,8)}] Arquivo validado (${fileSizeMB.toFixed(2)} MB)`);

    console.log("🚀 Rodando pipeline completo...");
    // Update health before intensive processing
    updateWorkerHealth();

    // ✅ DETECÇÃO DO MODO COMPARISON
    if (job.mode === "comparison") {
      console.log("🎧 [Worker] Iniciando análise comparativa entre faixas...");

      // Baixar arquivo de referência
      const refPath = await downloadFileFromBucket(job.reference_file_key);
      console.log(`🎵 Arquivo de referência pronto: ${refPath}`);

      // Analisar ambos os arquivos
      const userMetrics = await analyzeAudioWithPipeline(localFilePath, job);
      const refMetrics = await analyzeAudioWithPipeline(refPath, job);

      // Importar função de comparação
      const { compareMetrics } = await import("../api/audio/pipeline-complete.js");
      const comparison = await compareMetrics(userMetrics, refMetrics);

      // Salvar resultado comparativo
      const finalUpdateResult = await client.query(
        `UPDATE jobs SET results = $1, status = 'done', updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(comparison), job.id]
      );

      if (finalUpdateResult.rowCount === 0) {
        throw new Error(`Falha ao atualizar job de comparação ${job.id} para status 'done'`);
      }

      console.log("✅ [Worker] Job de comparação concluído:", job.id);
      
      // Limpar arquivo de referência
      try {
        await fs.promises.unlink(refPath);
      } catch (e) {
        console.warn("⚠️ Não foi possível remover arquivo de referência temporário:", e?.message);
      }
      
      updateWorkerHealth();
      return;
    }

    // Fluxo normal para jobs de análise única
    const analysisResult = await analyzeAudioWithPipeline(localFilePath, job);

    const result = {
      ok: true,
      file: job.file_key,
      mode: job.mode,
      analyzedAt: new Date().toISOString(),
      ...analysisResult,
    };

    // 🔥 ATUALIZAR STATUS FINAL + VERIFICAR SE FUNCIONOU
    const finalUpdateResult = await client.query(
      "UPDATE jobs SET status = $1, results = $2::json, completed_at = NOW(), updated_at = NOW() WHERE id = $3",
      ["done", JSON.stringify(result), job.id]
    );

    if (finalUpdateResult.rowCount === 0) {
      throw new Error(`Falha ao atualizar job ${job.id} para status 'done'`);
    }

    console.log(`✅ Job ${job.id} concluído e salvo no banco`);
    updateWorkerHealth(); // Marcar como healthy após sucesso
  } catch (err) {
    console.error("❌ Erro no job:", err);
    
    // 🔥 ATUALIZAR STATUS ERRO + VERIFICAR SE FUNCIONOU
    try {
      const errorUpdateResult = await client.query(
        "UPDATE jobs SET status = $1, error = $2, updated_at = NOW() WHERE id = $3",
        ["failed", err?.message ?? String(err), job.id]
      );
      
      if (errorUpdateResult.rowCount === 0) {
        console.error(`🚨 CRÍTICO: Falha ao atualizar job ${job.id} para status 'failed'`);
      }
    } catch (updateErr) {
      console.error(`🚨 CRÍTICO: Erro ao atualizar status de erro para job ${job.id}:`, updateErr);
    }
    // não mata o worker — deixa continuar processando próximos jobs
  } finally {
    // 🔥 PARAR HEARTBEAT
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    if (localFilePath) {
      try {
        await fs.promises.unlink(localFilePath);
      } catch (e) {
        console.warn("⚠️ Não foi possível remover arquivo temporário:", e?.message);
      }
    }
  }
}

// ---------- Recovery de jobs órfãos ----------
async function recoverOrphanedJobs() {
  try {
    console.log("🔄 Verificando jobs órfãos...");
    
    // 🚫 PRIMEIRO: Blacklist jobs problemáticos
    console.log("🚫 Verificando jobs problemáticos para blacklist...");
    const problematicJobs = await client.query(`
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
        console.log(`🚫 Blacklisting file: ${row.file_key} (${row.failure_count} failures)`);
        
        // Marcar todos os jobs relacionados como failed permanentemente
        await client.query(`
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
      
      console.log(`🚫 Blacklisted ${problematicJobs.rows.length} problematic files`);
    } else {
      console.log("✅ Nenhum job problemático encontrado para blacklist");
    }
    
    // 🔄 DEPOIS: Recuperar jobs órfãos restantes (mas não blacklisted)
    const result = await client.query(`
      UPDATE jobs 
      SET status = 'queued', updated_at = NOW(), error = 'Recovered from orphaned state'
      WHERE status = 'processing' 
      AND updated_at < NOW() - INTERVAL '10 minutes'
      AND error NOT LIKE '%BLACKLISTED%'
      RETURNING id, file_key
    `);

    if (result.rows.length > 0) {
      console.log(`🔄 Recuperados ${result.rows.length} jobs órfãos:`, result.rows.map(r => r.id.substring(0,8)));
    }
  } catch (err) {
    console.error("❌ Erro ao recuperar jobs órfãos:", err);
  }
}

// 🔥 RECOVERY A CADA 5 MINUTOS
setInterval(recoverOrphanedJobs, 300000);
recoverOrphanedJobs(); // Executa na inicialização

// ---------- Loop de jobs ----------
let isRunning = false;
async function processJobs() {
  if (isRunning) return;
  isRunning = true;

  try {
    // 🔍 Verificar saúde do worker
    if (!workerHealthy) {
      console.warn("⚠️ Worker não está healthy - pulando cycle");
      return;
    }
    
    updateWorkerHealth(); // Update health check
    console.log("🔄 Worker verificando jobs...");
    const res = await client.query(
      "SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1"
    );

    if (res.rows.length > 0) {
      await processJob(res.rows[0]);
    } else {
      console.log("📭 Nenhum job novo.");
    }
  } catch (e) {
    console.error("❌ Erro no loop de jobs:", e);
  } finally {
    isRunning = false;
  }
}

setInterval(processJobs, 5000);
processJobs();

// ---------- Servidor Express para Railway ----------
const app = express();
const PORT = process.env.WORKER_PORT || 8081; // ✅ Usar porta diferente para o worker

app.get('/', (req, res) => {
  res.json({ 
    status: 'Worker rodando', 
    timestamp: new Date().toISOString(),
    worker: 'active'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    worker: 'active',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Worker + API rodando na porta ${PORT}`);
});
