import pkg from "pg";
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";

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

      // 👉 Aqui depois entra o processamento de áudio real
      console.log(`🎵 Arquivo pronto para processamento: ${localFilePath}`);

      // (Por enquanto só cria um JSON fake como placeholder do resultado)
      const resultKey = `results/${Date.now()}-result.json`;
      await s3
        .putObject({
          Bucket: BUCKET_NAME,
          Key: resultKey,
          Body: JSON.stringify({ ok: true, file: job.file_key }),
          ContentType: "application/json",
        })
        .promise();

      // Atualiza job como finalizado
      await client.query(
        "UPDATE jobs SET status = $1, result_key = $2, updated_at = NOW() WHERE id = $3",
        ["done", resultKey, job.id]
      );

      console.log(`✅ Job ${job.id} concluído, resultado em: ${resultKey}`);
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
