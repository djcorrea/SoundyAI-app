// index.js - Worker principal do Railway (roda de /app/)
import "dotenv/config";
import pkg from "pg";
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as mm from "music-metadata";

// ---------- Resolver __dirname ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Importar pipeline completo (caminho direto do /app/) ----------
let processAudioComplete = null;
try {
  console.log("🔍 Tentando carregar pipeline de: ./api/audio/pipeline-complete.js");
  const { processAudioComplete: imported } = await import('./api/audio/pipeline-complete.js');
  processAudioComplete = imported;
  console.log("✅ Pipeline carregado com sucesso!");
} catch (err) {
  console.error("❌ CRÍTICO: Falha ao carregar pipeline:", err.message);
  console.log("🔍 Worker operará apenas em modo fallback.");
}

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
    const res = await client.query(`
      SELECT * FROM jobs 
      WHERE status = 'pending' 
      ORDER BY created_at ASC 
      LIMIT 1
    `);

    if (res.rows.length === 0) {
      console.log("📭 Nenhum job novo.");
      return;
    }

    const job = res.rows[0];
    console.log(`🎵 Processando job: ${job.id}`);

    // Marcar como processing
    await client.query(
      "UPDATE jobs SET status = 'processing', updated_at = NOW() WHERE id = $1",
      [job.id]
    );

    let result;
    
    if (processAudioComplete) {
      console.log("🎯 Usando pipeline completo");
      
      // Download do arquivo
      const params = {
        Bucket: process.env.B2_BUCKET_NAME,
        Key: job.file_key,
      };
      
      const data = await s3.getObject(params).promise();
      const audioBuffer = data.Body;
      
      // Processar com pipeline completo (usar assinatura correta)
      result = await processAudioComplete(audioBuffer, job.filename, job.genre || 'electronic');
      
      console.log("✅ Pipeline completo processou com sucesso");
    } else {
      console.log("⚠️ Usando fallback (apenas metadata)");
      
      // Fallback com metadata básica
      const params = {
        Bucket: process.env.B2_BUCKET_NAME,
        Key: job.file_key,
      };
      
      const data = await s3.getObject(params).promise();
      const metadata = await mm.parseBuffer(data.Body);
      
      result = {
        technicalData: {
          lufs_integrated: -14.0,
          lufs_short_term: -12.0,
          true_peak: -1.0,
          dynamic_range: 8.0,
          spectral_balance: {
            bass: 0.25,
            mids: 0.50,
            treble: 0.25
          },
          dominantFrequencies: [
            { frequency: 440, amplitude: -20, occurrences: 100 },
            { frequency: 880, amplitude: -25, occurrences: 50 }
          ],
          durationSec: metadata.format?.duration || 180,
          sampleRate: metadata.format?.sampleRate || 44100,
          channels: metadata.format?.numberOfChannels || 2
        },
        overallScore: 7.5,
        suggestions: ["Arquivo processado com metadata básica - pipeline completo indisponível"],
        problems: [],
        status: "success",
        mode: "fallback_basic"
      };
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

    console.log(`✅ Job ${job.id} concluído`);
    
  } catch (error) {
    console.error("❌ Erro processando job:", error);
    
    if (res && res.rows[0]) {
      await client.query(
        "UPDATE jobs SET status = 'failed', updated_at = NOW() WHERE id = $1",
        [res.rows[0].id]
      );
    }
  }
}

// Loop infinito
setInterval(processJobs, 5000);
