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
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("✅ Worker conectado ao Postgres");

// ---------- Configuração Backblaze ----------
const s3 = new AWS.S3({
  endpoint: "https://s3.us-east-005.backblazeb2.com",
  region: "us-east-005",
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY, // ajuste se sua env no Railway for B2_APPLICATION_KEY
  signatureVersion: "v4",
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME;

// ---------- Função para baixar arquivo ----------
async function downloadFileFromBucket(key) {
  const localPath = path.join("/tmp", path.basename(key)); // Railway/Node usa /tmp como pasta temporária
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

// ---------- Função para analisar áudio ----------
async function analyzeAudio(filePath) {
  const metadata = await mm.parseFile(filePath);
  const format = metadata.format;

  // ffprobe
  const probeData = await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  // 🔹 Adicionar placeholders dos campos que o frontend espera
  return {
    technicalData: {
      duration: format.duration || 0,
      sampleRate: format.sampleRate || 44100,
      bitRate: format.bitrate || null,
      channels: format.numberOfChannels || 2,
      codec: format.codec || "unknown",
      lufsIntegrated: -13.5,
      truePeakDbtp: -1.2,
    },
    tonalBalance: {
      sub: { rms_db: -12.5 },
      low: { rms_db: -10.2 },
      mid: { rms_db: -8.1 },
      high: { rms_db: -6.4 },
    },
    spectralData: {
      dominantFrequencies: [55, 110, 440, 880], // simulação
      spectralCentroid: 3500,
      spectralSpread: 1200,
    },
    diagnostics: {
      clipped: false,
      warnings: [],
    },
    probe: probeData,
  };
}

// ---------- Loop para processar jobs ----------
async function processJobs() {
  console.log("🔄 Worker verificando jobs...");

  const res = await client.query(
    "SELECT * FROM jobs WHERE status = 'queued' LIMIT 1"
  );

  if (res.rows.length > 0) {
    const job = res.rows[0];
    console.log("📥 Peguei job:", job);

    try {
      // Atualiza para "processing"
      await client.query(
        "UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2",
        ["processing", job.id]
      );

      // Baixar arquivo do bucket
      const localFilePath = await downloadFileFromBucket(job.file_key);

      console.log(`🎵 Arquivo pronto para processamento: ${localFilePath}`);

      // Analisar áudio
      const result = await analyzeAudio(localFilePath);

      // Atualiza job como finalizado no Postgres
      await client.query(
        "UPDATE jobs SET status = $1, result = $2, updated_at = NOW() WHERE id = $3",
        ["done", result, job.id]
      );

      console.log(`✅ Job ${job.id} concluído, resultado salvo no Postgres`);
    } catch (err) {
      console.error("❌ Erro ao processar job:", err);

      // Atualiza como erro
      await client.query(
        "UPDATE jobs SET status = $1, error = $2, updated_at = NOW() WHERE id = $3",
        ["failed", err.message, job.id]
      );
    }
  } else {
    console.log("📭 Nenhum job novo.");
  }
}

// ---------- Executa a cada 5s ----------
setInterval(processJobs, 5000);
