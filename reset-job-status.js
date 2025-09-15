// Reset job status from processing to queued
import "dotenv/config";
import pkg from "pg";

const { Client } = pkg;

async function resetJob(jobId) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("✅ Conectado ao PostgreSQL Railway");

  try {
    const updateQuery = `
      UPDATE jobs 
      SET status = 'queued', updated_at = NOW()
      WHERE id = $1 AND status = 'processing'
      RETURNING id, status;
    `;
    
    const result = await client.query(updateQuery, [jobId]);
    
    if (result.rows.length > 0) {
      console.log('✅ Job resetado com sucesso:');
      console.log('├─ ID:', result.rows[0].id);
      console.log('└─ Status:', result.rows[0].status);
    } else {
      console.log('❌ Job não encontrado ou não estava em processing');
    }
    
  } catch (error) {
    console.error('❌ Erro ao resetar job:', error);
  } finally {
    await client.end();
  }
}

// Usar argumento da linha de comando ou ID do job travado
const jobId = process.argv[2] || 'ee32445a-3452-460d-950b-30a58a696dee';
resetJob(jobId);