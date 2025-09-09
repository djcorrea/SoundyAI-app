import "dotenv/config.js";
import pkg from "pg";
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import mm from "music-metadata";
import ffmpeg from "fluent-ffmpeg";

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
  const file = fs.createWriteStream(localPath);

  return new Promise((resolve, reject) => {
    s3.getObject({ Bucket: BUCKET_NAME, Key: key })
      .createReadStream()
      .on("end", () => {
        console.log(`📥 Arquivo baixado: ${localPath}`);
        resolve(localPath);
      })
      .on("error", (err) => {
        console.error("❌ Erro ao baixar arquivo:", err);
        reject(err);
      })
      .pipe(file);
  });
}
// ---------- Processar 1 job ----------
async function processJob(job) {
  console.log("📥 Processando job:", job.id);

  try {
    // Atualiza para "processing"
    await client.query(
      "UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2",
      ["processing", job.id]
    );

    // Baixar arquivo do bucket
    const localFilePath = await downloadFileFromBucket(job.file_key);

    // 👉 Aqui depois entra seu pipeline real de análise de áudio
    console.log(`🎵 Arquivo pronto para análise: ${localFilePath}`);

    // (Por enquanto: resultado fake em JSON)
    const result = {
      ok: true,
      file: job.file_key,
      mode: job.mode,
      analyzedAt: new Date().toISOString(),
    };

    // Salva resultado no banco
    await client.query(
      "UPDATE jobs SET status = $1, result = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $3",
      ["done", JSON.stringify(result), job.id]
    );

    console.log(`✅ Job ${job.id} concluído`);
  } catch (err) {
    console.error("❌ Erro no job:", err);

    await client.query(
      "UPDATE jobs SET status = $1, error = $2, updated_at = NOW() WHERE id = $3",
      ["failed", err.message, job.id]
    );
  }
}

// ---------- Loop para buscar jobs ----------
async function processJobs() {
  console.log("🔄 Worker verificando jobs...");

  const res = await client.query(
    "SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1"
  );

  if (res.rows.length > 0) {

    await processJob(res.rows[0]);
  } else {
    console.log("📭 Nenhum job novo.");
  }
}

// ---------- Executa a cada 5s ----------
setInterval(processJobs, 5000);
