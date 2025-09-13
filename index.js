// index.js - Servidor Web + Worker (Railway hybrid)
import "dotenv/config";
import express from "express";
import cors from "cors";
import pkg from "pg";
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as mm from "music-metadata";

// Importar rotas do servidor
import analyzeRoute from "./api/audio/analyze.js";
import jobsRoute from "./api/jobs/[id].js";
import presignRoute from "./api/presign.js";
import uploadAudioRoute from "./api/upload-audio.js";

console.log("🚀 Iniciando Servidor Web + Worker híbrido...");

// ---------- Resolver __dirname ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Pipeline para Railway ----------
let processAudioComplete = null;

// Função para carregar pipeline real
async function loadRealPipeline() {
  try {
    console.log("🔍 [RAILWAY-DEBUG] Tentando carregar pipeline real...");
    const { processAudioComplete: realPipeline } = await import("./api/audio/pipeline-complete.js");
    processAudioComplete = realPipeline;
    console.log("✅ [RAILWAY-DEBUG] Pipeline real carregado no Railway - SEM SIMULAÇÃO!");
    console.log("🎯 [RAILWAY-DEBUG] Função processAudioComplete confirmada:", typeof processAudioComplete);
    console.log("🚀 [RAILWAY-DEBUG] SISTEMA PRONTO PARA ANÁLISE REAL!");
  } catch (error) {
    console.error("❌ [RAILWAY-DEBUG] Erro ao carregar pipeline real:", error.message);
    console.error("🚨 [RAILWAY-DEBUG] Stack trace:", error.stack);
    
    // Fallback simples que retorna erro
    processAudioComplete = async function() {
      throw new Error("Pipeline real não carregou - verificar logs");
    };
  }
}

// Carregar pipeline no início
await loadRealPipeline();

// ---------- Conectar ao Postgres ----------
const { Client } = pkg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
});
await client.connect();
console.log("✅ Worker conectado ao Postgres");

// ---------- Configurar AWS S3 ----------
const s3 = new AWS.S3({
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
  endpoint: process.env.B2_ENDPOINT,
  s3ForcePathStyle: true,
});

console.log("🚀 Worker iniciado (versão raiz)");

// ---------- Loop principal do worker ----------
async function processJobs() {
  try {
    console.log("🔄 [RAILWAY-DEBUG] Worker verificando jobs...");
    const res = await client.query(`
      SELECT * FROM jobs 
      WHERE status IN ('pending', 'queued') 
      ORDER BY created_at ASC 
      LIMIT 1
    `);

    if (res.rows.length === 0) {
      console.log("📭 [RAILWAY-DEBUG] Nenhum job novo.");
      return;
    }

    const job = res.rows[0];
    console.log(`🎵 [RAILWAY-DEBUG] Processando job: ${job.id}`);

    // Marcar como processing
    await client.query(
      "UPDATE jobs SET status = 'processing', updated_at = NOW() WHERE id = $1",
      [job.id]
    );

    let result;
    
    if (processAudioComplete) {
      console.log("🎯 [RAILWAY-DEBUG] Usando pipeline real completo");
      
      try {
        // Download do arquivo
        const params = {
          Bucket: process.env.B2_BUCKET_NAME,
          Key: job.file_key,
        };
        
        console.log("📥 [RAILWAY-DEBUG] Baixando arquivo do bucket...");
        const data = await s3.getObject(params).promise();
        const audioBuffer = data.Body;
        
        console.log("🎵 [RAILWAY-DEBUG] Processando com pipeline completo...");
        result = await processAudioComplete(audioBuffer, job.filename || 'audio.wav', job.mode || 'electronic');
        
        console.log("✅ [RAILWAY-DEBUG] Pipeline completo processou com sucesso");
      } catch (pipelineError) {
        console.error("❌ [RAILWAY-DEBUG] Erro no pipeline:", pipelineError.message);
        throw pipelineError;
      }
    } else {
      console.error("🚨 [RAILWAY-DEBUG] ProcessAudioComplete não está definido!");
      throw new Error("Pipeline não carregado");
    }

    // Salvar resultado
    await client.query(
      `UPDATE jobs SET 
       status = 'completed',
       result = $1,
       updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(result), job.id]
    );

    console.log(`✅ [RAILWAY-DEBUG] Job ${job.id} concluído`);
    
  } catch (error) {
    console.error("❌ [RAILWAY-DEBUG] Erro processando job:", error.message);
    console.error("❌ [RAILWAY-DEBUG] Stack trace:", error.stack);
    
    if (res && res.rows[0]) {
      await client.query(
        "UPDATE jobs SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2",
        [error.message, res.rows[0].id]
      );
    }
  }
}

// ========== SERVIDOR WEB (Express) ==========
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Rotas API essenciais
app.use("/api/audio", analyzeRoute);
app.use("/api/jobs", jobsRoute);
app.use("/api", presignRoute);  // Rota de presign para uploads
app.use("/api/upload-audio", uploadAudioRoute);

// SPA Fallback
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Iniciar servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🌐 Servidor web rodando na porta ${PORT}`);
  console.log(`🚀 Worker iniciado em paralelo`);
});

// Worker em background
setInterval(processJobs, 5000);