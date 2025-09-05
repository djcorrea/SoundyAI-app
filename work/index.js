import pkg from "pg";

const { Client } = pkg;

// Conectar ao banco
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("✅ Worker conectado ao Postgres");

// Loop simples para pegar jobs
async function processJobs() {
  console.log("🔄 Worker verificando jobs...");

  // Pegar 1 job que esteja "queued"
  const res = await client.query(
    "SELECT * FROM jobs WHERE status = 'queued' LIMIT 1"
  );

  if (res.rows.length > 0) {
    const job = res.rows[0];
    console.log("📥 Peguei job:", job);

    // Simular processamento (fake)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Atualizar como concluído
    await client.query(
      "UPDATE jobs SET status = $1, result_key = $2, updated_at = NOW() WHERE id = $3",
      ["done", "results/fake.json", job.id]
    );

    console.log(`✅ Job ${job.id} processado!`);
  } else {
    console.log("📭 Nenhum job novo.");
  }
}

// Rodar a cada 5 segundos
setInterval(processJobs, 5000);
