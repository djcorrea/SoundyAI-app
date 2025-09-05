import pkg from "pg";
import AWS from "aws-sdk";

const { Client } = pkg;

// Banco (DATABASE_URL vem das variáveis de ambiente do Railway)
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Bucket (S3 ou R2)
const s3 = new AWS.S3({
  region: process.env.S3_REGION,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
});

async function main() {
  await client.connect();
  console.log("Worker conectado ao Postgres ✅");

  while (true) {
    // 1. Buscar job pendente
    const { rows } = await client.query(
      "SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1"
    );

    if (rows.length === 0) {
      await new Promise((r) => setTimeout(r, 5000)); // espera 5s
      continue;
    }

    const job = rows[0];
    console.log("Processando job:", job.id);

    try {
      // 2. Atualizar status
      await client.query("UPDATE jobs SET status = 'processing' WHERE id = $1", [job.id]);

      // 3. Baixar arquivo do bucket
      const fileKey = job.file_key;
      const file = await s3.getObject({
        Bucket: process.env.S3_BUCKET,
        Key: fileKey,
      }).promise();

      // 👉 Aqui entra seu processamento de áudio futuramente
      console.log(`Arquivo ${fileKey} baixado (${file.Body.length} bytes)`);

      // 4. Gerar resultado (JSON de exemplo)
      const resultKey = `results/${job.id}.json`;
      await s3.putObject({
        Bucket: process.env.S3_BUCKET,
        Key: resultKey,
        Body: JSON.stringify({ sucesso: true, jobId: job.id }),
        ContentType: "application/json",
      }).promise();

      // 5. Atualizar job como done
      await client.query(
        "UPDATE jobs SET status = 'done', result_key = $1 WHERE id = $2",
        [resultKey, job.id]
      );

      console.log(`Job ${job.id} concluído ✅`);

    } catch (err) {
      console.error("Erro no job:", err);
      await client.query(
        "UPDATE jobs SET status = 'error', error = $1 WHERE id = $2",
        [err.message, job.id]
      );
    }
  }
}

main().catch(console.error);
