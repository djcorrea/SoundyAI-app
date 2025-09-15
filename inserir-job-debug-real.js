// Inserir job para capturar debug logs do worker em production
import "dotenv/config";
import pkg from "pg";

const { Client } = pkg;

async function insertDebugJob() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("✅ Conectado ao PostgreSQL Railway");

  try {
    // Usar um arquivo que já existe no bucket (baseado no job que funcionou)
    const jobId = '993e8400-e29b-41d4-a716-446790457232';
    const fileKey = 'uploads/1757901888763.wav'; // Arquivo que funcionou antes
    
    const insertQuery = `
      INSERT INTO jobs (id, file_key, file_name, mode, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, file_key, status;
    `;
    
    const result = await client.query(insertQuery, [
      jobId,
      fileKey,
      'AQUECIMENTO 2015 - DEBUG TEST',
      'genre',
      'queued'
    ]);
    
    console.log('✅ Job de debug inserido com sucesso:');
    console.log('├─ ID:', result.rows[0].id);
    console.log('├─ Arquivo:', result.rows[0].file_key);
    console.log('└─ Status:', result.rows[0].status);
    console.log('\n🔍 Agora monitore os logs do worker para ver a estrutura coreMetrics!');
    
  } catch (error) {
    console.error('❌ Erro ao inserir job:', error);
  } finally {
    await client.end();
  }
}

insertDebugJob();