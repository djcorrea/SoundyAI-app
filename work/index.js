// work/index.js
import "dotenv/config";
import pkg from "pg";
import AWS from "aws-sdk";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import * as mm from "music-metadata"; // fallback de metadata

const { Client } = pkg;

// 🛠️ Corrigir caminhos ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ Importa dinamicamente o pipeline completo (Fases 5.1–5.4)
const { processAudioComplete } = await import(
  pathToFileURL(path.join(__dirname, "../api/audio/pipeline-complete.js")).href
);

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

// ---------- Util: baixar arquivo do bucket ----------
async function downloadFileFromBucket(key) {
  const localPath = path.join("/tmp", path.basename(key)); // Railway usa /tmp
  await fs.promises.mkdir(path.dirname(localPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const write = fs.createWriteStream(localPath);
    const read = s3.getObject({ Bucket: BUCKET_NAME, Key: key }).createReadStream();

    read.on("error", (err) => {
      console.error("❌ Erro no stream de leitura S3:", err);
      reject(err);
    });

    write.on("error", (err) => {
      console.error("❌ Erro no stream de escrita local:", err);
      reject(err);
    });

    write.on("finish", () => {
      console.log(`📥 Arquivo baixado: ${localPath}`);
      resolve(localPath);
    });

    read.pipe(write);
  });
}

// ---------- Fallback: análise mínima via music-metadata ----------
async function analyzeFallbackMetadata(localFilePath) {
  try {
    const meta = await mm.parseFile(localFilePath);
    const duration = meta.format.duration || 0;
    const sampleRate = meta.format.sampleRate || 44100;
    const bitrate = meta.format.bitrate || null;
    const numberOfChannels = meta.format.numberOfChannels || 2;

    return {
      status: "success",
      mode: "fallback_metadata",
      score: 50,
      classification: "Básico",
      scoringMethod: "error_fallback",
      technicalData: {
        durationSec: duration,
        sampleRate,
        bitrate,
        channels: numberOfChannels,
        dominantFrequencies: [],
        spectralCentroid: null,
        spectralRolloff85: null,
        spectralRolloff50: null,
        spectralFlatness: null,
        headroomDb: null,
        headroomTruePeakDb: null,
        samplePeakLeftDb: null,
        samplePeakRightDb: null,
        tonalBalance: {},
        bandEnergies: {},
      },
      warnings: ["Pipeline completo indisponível. Resultado mínimo via metadata."],
      frontendCompatible: true,
      metadata: {
        processedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    console.error("❌ Erro no fallback metadata:", err);
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

// ---------- Análise REAL via pipeline (5.1–5.4) ----------
async function analyzeAudioWithPipeline(localFilePath, job) {
  const filename = path.basename(localFilePath);
  const fileBuffer = await fs.promises.readFile(localFilePath);

  const options = {}; // Placeholder para referência, configs, etc.

  const t0 = Date.now();
  const finalJSON = await processAudioComplete(fileBuffer, filename, options);
  const totalMs = Date.now() - t0;

  // Garantir compatibilidade visual + log de performance
  finalJSON.performance = {
    ...(finalJSON.performance || {}),
    workerTotalTimeMs: totalMs,
    workerTimestamp: new Date().toISOString(),
    backendPhase: "5.1-5.4",
  };

  // Tag opcional para UI saber que veio do pipeline
  finalJSON._worker = {
    source: "pipeline_complete",
  };

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

    let analysisResult;
    let usedFallback = false;

    try {
      // ✅ Tenta pipeline completo
      console.log("🚀 Rodando pipeline completo (Fases 5.1–5.4)...");
      analysisResult = await analyzeAudioWithPipeline(localFilePath, job);
      console.log(
        `✅ Pipeline completo OK | score=${analysisResult?.score}, class=${analysisResult?.classification}`
      );
    } catch (pipelineErr) {
      console.error("⚠️ Falha no pipeline completo. Ativando fallback:", pipelineErr?.message);
      usedFallback = true;
      analysisResult = await analyzeFallbackMetadata(localFilePath);
    }

    const result = {
      ok: true,
      file: job.file_key,
      mode: job.mode,
      analyzedAt: new Date().toISOString(),
      usedFallback,
      ...analysisResult, // <- UI recebe tudo pronto
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
    // Limpeza do arquivo local
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

// ---------- Loop para buscar jobs (com lock simples) ----------
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
