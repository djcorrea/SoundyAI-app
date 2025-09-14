require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkJobErrors() {
  try {
    console.log('🔍 Verificando jobs com erro...');
    
    // Jobs com erro
    const errorResult = await pool.query(`
      SELECT id, status, error, created_at, file_key, updated_at
      FROM jobs 
      WHERE status IN ('error', 'failed')
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log('\n❌ Jobs com erro:');
    errorResult.rows.forEach(job => {
      console.log(`- ID: ${job.id.substring(0,8)}`);
      console.log(`  Status: ${job.status}`);
      console.log(`  Arquivo: ${job.file_key}`);
      console.log(`  Erro: ${job.error}`);
      console.log(`  Criado: ${new Date(job.created_at).toLocaleString()}`);
      console.log('');
    });

    // Jobs em processing há muito tempo
    const stuckResult = await pool.query(`
      SELECT id, status, created_at, updated_at, file_key
      FROM jobs 
      WHERE status = 'processing'
      AND updated_at < NOW() - INTERVAL '5 minutes'
      ORDER BY created_at DESC
    `);
    
    console.log('\n⏰ Jobs presos em processing (>5min):');
    stuckResult.rows.forEach(job => {
      console.log(`- ID: ${job.id.substring(0,8)}`);
      console.log(`  Arquivo: ${job.file_key}`);
      console.log(`  Criado: ${new Date(job.created_at).toLocaleString()}`);
      console.log(`  Atualizado: ${new Date(job.updated_at).toLocaleString()}`);
      console.log('');
    });

    await pool.end();
  } catch (err) {
    console.error('Erro:', err);
  }
}

checkJobErrors();