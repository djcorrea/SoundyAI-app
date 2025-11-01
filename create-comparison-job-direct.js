// create-comparison-job-direct.js - Criar job de comparação direto no banco
import "dotenv/config";
import pg from "pg";
import { randomUUID } from "crypto";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createComparisonJob() {
  console.log("🎯 Criando job de comparação direto no banco...\n");

  const jobId = randomUUID();
  // Usar arquivo real que existe no bucket
  const userFileKey = "uploads/DJ_TOPO_QUEM_NAO_QUER_SOU_EU_mastered_1730397160052.wav";
  const referenceFileKey = "uploads/DJ_TOPO_QUEM_NAO_QUER_SOU_EU_mastered_1730397160052.wav";

  try {
    const result = await pool.query(
      `INSERT INTO jobs (id, file_key, reference_file_key, mode, status, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) 
       RETURNING *`,
      [jobId, userFileKey, referenceFileKey, 'comparison', 'queued']
    );

    console.log("✅ Job criado com sucesso!");
    console.log(`   JobID: ${jobId}`);
    console.log(`   Mode: ${result.rows[0].mode}`);
    console.log(`   Status: ${result.rows[0].status}`);
    console.log(`   User File: ${userFileKey.split('/').pop()}`);
    console.log(`   Reference File: ${referenceFileKey.split('/').pop()}\n`);

    console.log("🔍 Aguardando worker processar...\n");

    // Monitorar por 2 minutos
    for (let i = 0; i < 60; i++) {
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
        
        const finalResult = await pool.query(
          "SELECT result FROM jobs WHERE id = $1",
          [jobId]
        );
        
        const resultData = finalResult.rows[0].result;
        
        if (resultData?.comparison) {
          console.log("\n✅ Dados de comparação gerados:");
          console.log(JSON.stringify(resultData.comparison, null, 2));
        } else {
          console.log("\n⚠️ Campo 'comparison' não encontrado no resultado");
        }
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

createComparisonJob();
