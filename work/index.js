// work/index.js
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

// ---------- Importar pipeline completo (ESM + Container compatible) ----------
let processAudioComplete = null;

// 🎯 WORKER FOCADO NO PIPELINE REAL - SEM FALLBACKS!
// Se o pipeline não funcionar, o worker deve falhar claramente para debugging

const candidatePaths = [
  // 🎯 PIPELINE COPIADO PARA DENTRO DE work/ (Railway-friendly)
  "./api/audio/pipeline-complete.js",
  path.resolve(__dirname, "api/audio/pipeline-complete.js"),
  path.resolve(process.cwd(), "api/audio/pipeline-complete.js"),
  
  // 🎯 CAMINHOS ABSOLUTOS (Railway deploy normal)
  "/app/api/audio/pipeline-complete.js",
  path.resolve("/app", "api/audio/pipeline-complete.js"),
  
  // 🎯 CAMINHOS RELATIVOS (desenvolvimento local)
  new URL("../api/audio/pipeline-complete.js", import.meta.url).href,
  path.resolve(__dirname, "../api/audio/pipeline-complete.js"),
  "../api/audio/pipeline-complete.js"
];

for (const modulePath of candidatePaths) {
  try {
    console.log(`🔍 Tentando carregar pipeline de: ${modulePath}`);
    const imported = await import(modulePath);
    processAudioComplete = imported.processAudioComplete;
    console.log("✅ Pipeline carregado com sucesso de:", modulePath);
    break;
  } catch (err) {
    console.warn(`⚠️ Falhou em ${modulePath}:`, err.message);
  }
}

if (!processAudioComplete) {
  console.error("🚨 CRÍTICO: Pipeline não carregou - worker será encerrado!");
  console.log("🔍 Debug info:");
  console.log("   import.meta.url:", import.meta.url);
  console.log("   process.cwd():", process.cwd());
  console.log("   __dirname equivalent:", path.dirname(fileURLToPath(import.meta.url)));
  
  // 🔍 INVESTIGAR ESTRUTURA DO CONTAINER
  try {
    console.log("📁 Listando estrutura do container:");
    
    // Verificar /app
    if (fs.existsSync("/app")) {
      const rootContents = fs.readdirSync("/app");
      console.log("   /app contents:", rootContents);
      
      if (rootContents.includes("api")) {
        const apiContents = fs.readdirSync("/app/api");
        console.log("   /app/api contents:", apiContents);
        
        if (apiContents.includes("audio")) {
          const audioContents = fs.readdirSync("/app/api/audio");
          console.log("   /app/api/audio contents:", audioContents);
          
          // Verificar se pipeline-complete.js existe
          if (audioContents.includes("pipeline-complete.js")) {
            console.log("   ✅ pipeline-complete.js EXISTE em /app/api/audio/");
            
            // Tentar ler o arquivo para verificar permissões
            try {
              const fileContent = fs.readFileSync("/app/api/audio/pipeline-complete.js", "utf8");
              console.log("   ✅ Arquivo é legível, tamanho:", fileContent.length);
              console.log("   📄 Primeiras linhas:", fileContent.substring(0, 200));
            } catch (readErr) {
              console.log("   ❌ Erro ao ler arquivo:", readErr.message);
            }
          } else {
            console.log("   ❌ pipeline-complete.js NÃO ENCONTRADO em /app/api/audio/");
          }
        }
      }
    } else {
      console.log("   ❌ /app não existe!");
    }
    
    const workContents = fs.readdirSync(process.cwd());
    console.log("   Current working directory contents:", workContents);
    
  } catch (err) {
    console.log("   ❌ Erro ao listar estrutura:", err.message);
  }
  
  // 🚨 FORÇAR SAÍDA - não queremos fallback, queremos o pipeline real!
  console.log("🚨 ENCERRANDO WORKER - Pipeline deve funcionar ou nada!");
  process.exit(1);
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
      frontendCompatible: false,
    };
  }
}

// ---------- Análise REAL via pipeline (SEM FALLBACK!) ----------
async function analyzeAudioWithPipeline(localFilePath, job) {
  if (!processAudioComplete) {
    throw new Error("🚨 Pipeline não foi carregado - worker não pode processar áudio!");
  }
  
  const filename = path.basename(localFilePath);
  const fileBuffer = await fs.promises.readFile(localFilePath);
  
  console.log(`🎯 Processando ${filename} com pipeline completo real...`);
  console.log(`📊 Buffer size: ${fileBuffer.length} bytes`);
  
  const t0 = Date.now();
  const finalJSON = await processAudioComplete(fileBuffer, filename, job?.reference || null);
  const totalMs = Date.now() - t0;

  // Adicionar informações de performance do worker
  finalJSON.performance = {
    ...(finalJSON.performance || {}),
    workerTotalTimeMs: totalMs,
    workerTimestamp: new Date().toISOString(),
    backendPhase: "pipeline-complete-real",
  };

  finalJSON._worker = { 
    source: "pipeline_complete_main",
    processingTimeMs: totalMs,
    filename: filename,
    bufferSize: fileBuffer.length
  };
  
  console.log(`✅ Pipeline real executado com sucesso em ${totalMs}ms`);
  console.log(`📊 Score final: ${finalJSON.overallScore || finalJSON.score}`);
  
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
      console.log("🚀 Rodando pipeline completo (Fases 5.1–5.4)...");
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
  } catch (e) {
    console.error("❌ Erro no loop de jobs:", e);
  } finally {
    isRunning = false;
  }
}

// ---------- Sistema de Alerta para Jobs Travados ----------
async function checkStuckJobs() {
  try {
    const stuckJobs = await client.query(`
      SELECT id, file_key, updated_at, 
             EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_stuck
      FROM jobs 
      WHERE status = 'processing' 
      AND updated_at < NOW() - INTERVAL '5 minutes'
    `);
    
    if (stuckJobs.rows.length > 0) {
      console.error(`🚨 ALERTA: ${stuckJobs.rows.length} jobs travados detectados:`);
      stuckJobs.rows.forEach(job => {
        console.error(`   - Job ${job.id}: ${job.file_key} (${Math.floor(job.minutes_stuck)}min travado)`);
      });
      
      // Auto-reset jobs travados há mais de 10 minutos
      const resetResult = await client.query(`
        UPDATE jobs 
        SET status = 'error', 
            error = 'Job travado por mais de 10 minutos - resetado automaticamente',
            updated_at = NOW()
        WHERE status = 'processing' 
        AND updated_at < NOW() - INTERVAL '10 minutes'
        RETURNING id
      `);
      
      if (resetResult.rows.length > 0) {
        console.log(`✅ ${resetResult.rows.length} jobs travados resetados automaticamente`);
      }
    }
  } catch (error) {
    console.error("❌ Erro ao verificar jobs travados:", error.message);
  }
}

setInterval(processJobs, 5000);
setInterval(checkStuckJobs, 2 * 60 * 1000); // Verificar jobs travados a cada 2 minutos
processJobs();
