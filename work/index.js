// work/index.js
import "dotenv/config";
import pkg from "pg";
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";

// ---------- Resolver __dirname ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Importar pipeline completo ----------
let processAudioComplete = null;

try {
  const imported = await import("./api/audio/pipeline-complete.js");
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
  console.log(`🔍 Tentando baixar: ${key}`);
  console.log(`🔍 Bucket: ${BUCKET_NAME}`);
  
  const localPath = path.join("/tmp", path.basename(key)); // Railway usa /tmp
  await fs.promises.mkdir(path.dirname(localPath), { recursive: true });

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
    const pipelinePromise = processAudioComplete(fileBuffer, filename, job?.reference || null);
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

    console.log("🚀 Rodando pipeline completo...");
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
      "UPDATE jobs SET status = $1, result = $2::jsonb, completed_at = NOW(), updated_at = NOW() WHERE id = $3",
      ["done", JSON.stringify(result), job.id]
    );

    if (finalUpdateResult.rowCount === 0) {
      throw new Error(`Falha ao atualizar job ${job.id} para status 'done'`);
    }

    console.log(`✅ Job ${job.id} concluído e salvo no banco`);
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
    
    // Jobs "processing" há mais de 10 minutos = órfãos
    const result = await client.query(`
      UPDATE jobs 
      SET status = 'queued', updated_at = NOW(), error = 'Recovered from orphaned state'
      WHERE status = 'processing' 
      AND updated_at < NOW() - INTERVAL '10 minutes'
      RETURNING id
    `);

    if (result.rows.length > 0) {
      console.log(`🔄 Recuperados ${result.rows.length} jobs órfãos:`, result.rows.map(r => r.id));
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
const PORT = process.env.PORT || 8080;

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
