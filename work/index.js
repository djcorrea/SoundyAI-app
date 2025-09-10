// work/index.js
import "dotenv/config";
import pkg from "pg";
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import * as mm from "music-metadata";   // metadata básica (duração, sampleRate etc.)
import ffmpeg from "fluent-ffmpeg";     // para conversão e análises futuras

const { Client } = pkg;

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

// ---------- Função para baixar arquivo ----------
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

// ---------- Função auxiliar: análise mínima ----------
async function analyzeAudio(localFilePath) {
  try {
    const meta = await mm.parseFile(localFilePath);
    const duration = meta.format.duration || 0;
    const sampleRate = meta.format.sampleRate || 44100;
    const bitrate = meta.format.bitrate || null;
    const numberOfChannels = meta.format.numberOfChannels || 2;

    // ⚠️ Aqui você pode plugar FFT/Meyda/ffmpeg para spectral, loudness etc.
    // Exemplo de retorno mínimo compatível com o frontend:
    return {
      technicalData: {
        dominantFrequencies: [],   // precisa de FFT real
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
        durationSec: duration,
        sampleRate,
        bitrate,
        channels: numberOfChannels
      },
      problems: [],
      suggestions: []
    };
  } catch (err) {
    console.error("❌ Erro em analyzeAudio:", err);
    return {
      technicalData: {
        dominantFrequencies: [],
        durationSec: null
      },
      problems: [],
      suggestions: []
    };
  }
}

// ---------- Processar 1 job ----------
async function processJob(job) {
  console.log("📥 Processando job:", job.id);

  try {
    await client.query(
      "UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2",
      ["processing", job.id]
    );

    const localFilePath = await downloadFileFromBucket(job.file_key);
    console.log(`🎵 Arquivo pronto para análise: ${localFilePath}`);

    // 🔍 Executa análise mínima
    const analysisResult = await analyzeAudio(localFilePath);

    const result = {
      ok: true,
      file: job.file_key,
      mode: job.mode,
      analyzedAt: new Date().toISOString(),
      ...analysisResult
    };

    await client.query(
      "UPDATE jobs SET status = $1, result = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $3",
      ["done", JSON.stringify(result), job.id]
    );

    console.log(`✅ Job ${job.id} concluído`);
  } catch (err) {
    console.error("❌ Erro no job:", err);
    await client.query(
      "UPDATE jobs SET status = $1, error = $2, updated_at = NOW() WHERE id = $3",
      ["failed", err?.message ?? String(err), job.id]
    );
  }
}

// ---------- Loop para buscar jobs (com lock) ----------
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
