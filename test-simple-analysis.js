// test-simple-analysis.js - Teste de análise simples com arquivo fictício
import "dotenv/config";
import pg from "pg";
import { randomUUID } from "crypto";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createSimpleAnalysisJob() {
  console.log("🎯 Criando job de análise simples (modo genre)...\n");

  const jobId = randomUUID();
  // Usar um fileKey fictício para teste
  const fileKey = "uploads/test_simple_analysis.wav";

  try {
    const result = await pool.query(
      `INSERT INTO jobs (id, file_key, mode, status, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, NOW(), NOW()) 
       RETURNING *`,
      [jobId, fileKey, 'genre', 'queued']
    );

    console.log("✅ Job criado com sucesso!");
    console.log(`   JobID: ${jobId}`);
    console.log(`   Mode: ${result.rows[0].mode}`);
    console.log(`   Status: ${result.rows[0].status}`);
    console.log(`   File: ${fileKey}\n`);

    console.log("🔍 Aguardando worker processar...\n");

    // Monitorar por 1 minuto
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const check = await pool.query(
        "SELECT status, error FROM jobs WHERE id = $1",
        [jobId]
      );

      const job = check.rows[0];
      const timestamp = new Date().toISOString().substring(11, 19);
      console.log(`[${timestamp}] Status: ${job.status}`);

      if (job.status === 'done') {
        console.log("\n🎉 JOB CONCLUÍDO!");
        break;
      }

      if (job.status === 'failed') {
        console.log("\n❌ JOB FALHOU!");
        console.log("Erro:", job.error);
        break;
      }
    }

  } catch (error) {
    console.error("❌ Erro:", error.message);
  } finally {
    await pool.end();
  }
}

createSimpleAnalysisJob();
