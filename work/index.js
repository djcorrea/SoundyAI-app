// work/index.js
import "dotenv/config";
import pkg from "pg";
import AWS from "aws-sdk";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import * as mm from "music-metadata"; // fallback de metadata

const { Client } = pkg;

// ---------- util de caminho ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tenta localizar o pipeline em vários caminhos possíveis
async function loadPipeline() {
  const candidates = [
    // 1) pipeline copiado para dentro do service do worker (recomendado)
    path.join(__dirname, "pipeline/pipeline-complete.js"),
    // 2) monorepo: worker em work/ e pipeline fora
    path.join(__dirname, "../api/audio/pipeline-complete.js"),
    // 3) cwd do serviço
    path.join(process.cwd(), "api/audio/pipeline-complete.js"),
    // 4) outro relativo comum (caso seu build mova um nível)
    path.resolve(__dirname, "../../api/audio/pipeline-complete.js"),
  ];

  console.log("🔎 Procurando pipeline em:");
  candidates.forEach((p) => console.log("  -", p));

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const mod = await import(`file://${p}`);
        if (mod?.processAudioComplete) {
          console.log("✅ Pipeline carregado de:", p);
          return mod.processAudioComplete;
        } else {
          console.warn("⚠️ Módulo encontrado mas sem export processAudioComplete:", p);
        }
      }
    } catch (e) {
      console.warn("⚠️ Falha ao importar pipeline de", p, "->", e?.message);
    }
  }

  console.warn("⚠️ Pipeline completo NÃO encontrado neste serviço. Usarei fallback (metadata).");
  return null;
}

// ---------- Conectar ao Postgres ----------
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

// ---------- Util: baixar arquivo ----------
async function downloadFileFromBucket(key) {
  const localPath = path.join("/tmp", path.basename(key)); // Railway usa /tmp
  await fs.promises.mkdir(path.dirname(localPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const write = fs.createWriteStream(localPath);
    const read = s3.getObject({ Bucket: BUCKET_NAME, Key: key }).createReadStream();

    read.on("error", reject);
    write.on("error", reject);
    write.on("finish", () => {
      console.log(`📥 Arquivo baixado: ${localPath}`);
      resolve(localPath);
    });

    read.pipe(write);
  });
}

// ---------- Fallback: metadata mínima ----------
async function analyzeFallbackMetadata(localFilePath) {
  try {
    const meta = await mm.parseFile(localFilePath);
    return {
      status: "success",
      mode: "fallback_metadata",
      score: 50,
      classification: "Básico",
      scoringMethod: "error_fallback",
      technicalData: {
        durationSec: meta.format.duration || 0,
        sampleRate: meta.format.sampleRate || 44100,
        bitrate: meta.format.bitrate || null,
        channels: meta.format.numberOfChannels || 2,
      },
      warnings: ["Pipeline completo indisponível neste serviço. Resultado mínimo via metadata."],
      frontendCompatible: true,
      metadata: { processedAt: new Date().toISOString() },
    };
  } catch (err) {
    return {
      status: "error",
      error: {
        message: err?.message ?? String(err),
        type: "fallback_metadata_error",
        timestamp: new Date().toISOString(),
      },
      score: 50,
      classification: "Erro",
      technicalData: {},
      warnings: ["Falha também no fallback de metadata."],
      frontendCompatible: false,
    };
  }
}

// ---------- Análise via pipeline (se disponível) ----------
async function analyzeAudioWithPipeline(localFilePath, job, processAudioCompleteFn) {
  const filename = path.basename(localFilePath);
  const fileBuffer = await fs.promises.readFile(localFilePath);

  const t0 = Date.now();
  const finalJSON = await processAudioCompleteFn(fileBuffer, filename, {});
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
  try {
    await client.query(
      "UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2",
      ["processing", job.id]
    );

    localFilePath = await downloadFileFromBucket(job.file_key);
    console.log(`🎵 Arquivo pronto para análise: ${localFilePath}`);

    // Carrega pipeline de forma segura (sem quebrar o processo)
    const processAudioCompleteFn = await loadPipeline();

    let analysisResult;
    let usedFallback = false;

    try {
      if (!processAudioCompleteFn) throw new Error("PIPELINE_NOT_FOUND_IN_WORKER");
      console.log("🚀 Rodando pipeline completo...");
      analysisResult = await analyzeAudioWithPipeline(localFilePath, job, processAudioCompleteFn);
      console.log(
        `✅ Pipeline OK | score=${analysisResult?.score}, class=${analysisResult?.classification}`
      );
    } catch (pipelineErr) {
      console.error("⚠️ Pipeline indisponível/erro. Fallback ativado:", pipelineErr?.message);
      usedFallback = true;
      analysisResult = await analyzeFallbackMetadata(localFilePath);
    }

    const result = {
      ok: true,
      file: job.file_key,
      mode: job.mode,
      analyzedAt: new Date().toISOString(),
      usedFallback,
      ...analysisResult,
    };

    await client.query(
      "UPDATE jobs SET status = $1, result = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $3",
      ["done", JSON.stringify(result), job.id]
    );

    console.log(`✅ Job ${job.id} concluído (fallback=${usedFallback ? "yes" : "no"})`);
  } catch (err) {
    console.error("❌ Erro no job:", err);
    await client.query(
      "UPDATE jobs SET status = $1, error = $2, updated_at = NOW() WHERE id = $3",
      ["failed", err?.message ?? String(err), job.id]
    );
  } finally {
    if (localFilePath) {
      try {
        await fs.promises.unlink(localFilePath);
        console.log(`🧹 /tmp limpo: ${localFilePath}`);
      } catch (e) {
        console.warn("⚠️ Não foi possível remover arquivo temporário:", e?.message);
      }
    }
  }
}

// ---------- Loop ----------
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

// Evita crash por rejeições não tratadas (para não reiniciar container)
process.on("unhandledRejection", (reason) => {
  console.error("⚠️ UnhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️ UncaughtException:", err);
});
