require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function analyzeJobBehavior() {
  try {
    console.log('🔍 Analisando comportamento dos jobs...\n');
    
    // 1. Jobs em processing agora
    const processing = await pool.query(`
      SELECT id, file_key, created_at, updated_at, 
             EXTRACT(EPOCH FROM (NOW() - created_at)) as seconds_since_created,
             EXTRACT(EPOCH FROM (NOW() - updated_at)) as seconds_since_updated
      FROM jobs 
      WHERE status = 'processing'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('🔄 Jobs em PROCESSING:');
    processing.rows.forEach(job => {
      console.log(`- ID: ${job.id.substring(0,8)}`);
      console.log(`  Arquivo: ${job.file_key}`);
      console.log(`  Criado há: ${Math.floor(job.seconds_since_created)}s`);
      console.log(`  Última atualização há: ${Math.floor(job.seconds_since_updated)}s`);
      console.log('');
    });

    // 2. Últimos jobs que falharam
    const recent_failed = await pool.query(`
      SELECT id, file_key, error, created_at, updated_at,
             EXTRACT(EPOCH FROM (updated_at - created_at)) as processing_duration
      FROM jobs 
      WHERE status IN ('failed', 'error')
      AND created_at > NOW() - INTERVAL '2 hours'
      ORDER BY created_at DESC
      LIMIT 3
    `);
    
    console.log('❌ Jobs que falharam recentemente:');
    recent_failed.rows.forEach(job => {
      console.log(`- ID: ${job.id.substring(0,8)}`);
      console.log(`  Arquivo: ${job.file_key}`);
      console.log(`  Erro: ${job.error}`);
      console.log(`  Duração antes de falhar: ${Math.floor(job.processing_duration)}s`);
      console.log('');
    });

    // 3. Jobs bem-sucedidos para comparação
    const successful = await pool.query(`
      SELECT id, file_key, created_at, completed_at,
             EXTRACT(EPOCH FROM (completed_at - created_at)) as processing_duration
      FROM jobs 
      WHERE status = 'done'
      ORDER BY completed_at DESC
      LIMIT 3
    `);
    
    console.log('✅ Jobs bem-sucedidos para comparação:');
    successful.rows.forEach(job => {
      console.log(`- ID: ${job.id.substring(0,8)}`);
      console.log(`  Arquivo: ${job.file_key}`);
      console.log(`  Duração total: ${Math.floor(job.processing_duration)}s`);
      console.log('');
    });

    await pool.end();
  } catch (err) {
    console.error('Erro:', err);
  }
}

analyzeJobBehavior();