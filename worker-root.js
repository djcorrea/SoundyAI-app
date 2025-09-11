// worker-root.js - Worker na raiz do projeto
import "dotenv/config";
import pkg from "pg";
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as mm from "music-metadata"; // fallback de metadata

// ---------- Resolver __dirname ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Importar pipeline completo (caminho direto) ----------
let processAudioComplete = null;
try {
  const { processAudioComplete: imported } = await import('./api/audio/pipeline-complete.js');
  processAudioComplete = imported;
  console.log("✅ Pipeline carregado com sucesso do caminho direto");
} catch (err) {
  console.error("❌ CRÍTICO: Falha ao carregar pipeline:", err.message);
  console.log("🔍 Tentando fallback para modo metadata...");
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

    read.on("error", (err) => {
      console.error("❌ Erro no stream de leitura S3:", err);
      reject(err);
    });

    write.on("error", (err) => {
      console.error("❌ Erro no stream de escrita local:", err);
      reject(err);
    });

    write.on("finish", () => {
      console.log(`✅ Arquivo baixado: ${localPath}`);
      resolve(localPath);
    });

    read.pipe(write);
  });
}

// ---------- Fallback: análise via metadata REAL ----------
async function analyzeFallbackMetadata(localFilePath) {
  try {
    console.log(`🔧 [FALLBACK] Extraindo metadados REAIS via music-metadata de: ${localFilePath}`);
    const metadata = await mm.parseFile(localFilePath);
    
    // ✅ EXTRAIR METADADOS ORIGINAIS REAIS
    const sampleRate = metadata.format.sampleRate || 48000;
    const channels = metadata.format.numberOfChannels || 2;
    const duration = metadata.format.duration || 0;
    const bitrate = metadata.format.bitrate || 0;
    const codec = metadata.format.codec || 'unknown';
    const format = metadata.format.container || metadata.format.tagTypes?.[0] || 'unknown';
    
    console.log(`🔧 [FALLBACK] Metadados extraídos:`, {
      sampleRate, channels, duration, bitrate, codec, format
    });
    
    return {
      ok: true,
      mode: "fallback_metadata",
      status: "success",
      qualityOverall: 5.0, // Score neutro para fallback
      score: 5.0,
      scoringMethod: "error_fallback",
      processingTime: 50,
      technicalData: {
        // ✅ METADADOS REAIS ORIGINAIS em technicalData
        sampleRate: sampleRate,
        channels: channels,
        duration: duration,
        bitrate: bitrate,
        codec: codec,
        format: format,
        // Métricas padrão de fallback
        lufsIntegrated: -14.0,
        truePeakDbtp: -1.0,
        dynamicRange: 8.0
      },
      metadata: { // ✅ METADADOS REAIS ORIGINAIS em metadata
        sampleRate: sampleRate,
        channels: channels,
        duration: duration,
        bitrate: bitrate,
        codec: codec,
        format: format,
        processedAt: new Date().toISOString(),
        engineVersion: "fallback-metadata-real",
        pipelinePhase: "fallback"
      },
      warnings: ["Pipeline completo indisponível. Resultado com metadados reais via music-metadata."],
    };
  } catch (err) {
    console.error("❌ Erro no fallback metadata:", err);
    return {
      status: "error",
      error: {
        message: err.message,
        type: "fallback_metadata_error",
      },
      metadata: { // ✅ CORREÇÃO: garantir metadata mesmo em caso de erro
        sampleRate: 48000,
        channels: 2,
        duration: 0,
        bitrate: 0,
        codec: 'unknown',
        format: 'unknown',
        processedAt: new Date().toISOString(),
        engineVersion: "fallback-error",
        pipelinePhase: "error"
      }
    };
  }
}

// ---------- Análise com pipeline completo ----------
async function analyzeAudioWithPipeline(localFilePath, job) {
  if (!processAudioComplete) {
    console.warn("⚠️ Pipeline indisponível, caindo no fallback...");
    return analyzeFallbackMetadata(localFilePath);
  }

  const filename = path.basename(localFilePath);
  const fileBuffer = await fs.promises.readFile(localFilePath);

  const t0 = Date.now();
  const finalJSON = await processAudioComplete(fileBuffer, filename, job?.reference || null);
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
    // Atualizar status para "processing"
    await client.query(
      "UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2",
      ["processing", job.id]
    );

    // Baixar arquivo
    localFilePath = await downloadFileFromBucket(job.file_key);

    // Analisar áudio
    let analysisResult;
    let usedFallback = false;

    try {
      analysisResult = await analyzeAudioWithPipeline(localFilePath, job);
      if (analysisResult?.mode === "fallback_metadata") usedFallback = true;
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
      ...analysisResult,
    };

    await client.query(
      "UPDATE jobs SET status = $1, result = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $3",
      ["completed", JSON.stringify(result), job.id]
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
  } catch (err) {
    console.error("❌ Erro no loop de jobs:", err);
  } finally {
    isRunning = false;
  }
}

// ---------- Iniciar worker ----------
console.log("🚀 Worker iniciado (versão root)");
setInterval(processJobs, 5000); // Check a cada 5 segundos
processJobs(); // Primeira execução imediata
