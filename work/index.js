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
      reject(err);
    });
    write.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    write.on("finish", () => {
      clearTimeout(timeout);
      resolve(localPath);
    });

    read.pipe(write);
  });
}

// ---------- Análise REAL via pipeline ----------
async function analyzeAudioWithPipeline(localFilePath, job) {
  const filename = path.basename(localFilePath);
  const fileBuffer = await fs.promises.readFile(localFilePath);

  const t0 = Date.now();
  
  // 🔥 TIMEOUT DE 5 MINUTOS - EVITA PIPELINE INFINITO
  const pipelinePromise = processAudioComplete(fileBuffer, filename, job?.reference || null);
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Pipeline timeout após 5 minutos para: ${filename}`));
    }, 300000); // 5 minutos
  });

  const finalJSON = await Promise.race([pipelinePromise, timeoutPromise]);
  const totalMs = Date.now() - t0;

  finalJSON.performance = {
    ...(finalJSON.performance || {}),
    workerTotalTimeMs: totalMs,
    workerTimestamp: new Date().toISOString(),
    backendPhase: "5.1-5.4",
  };

  finalJSON._worker = { source: "pipeline_complete" };

  return finalJSON;
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
