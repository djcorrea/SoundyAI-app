const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:sLOtLyiiLvrkXlEqygUhbFjaVhdZdoJq@centerbeam.proxy.rlwy.net:44219/railway'
});

async function debugFailedJob(jobId) {
  try {
    console.log(`🔍 Debugando job: ${jobId}`);
    
    // Primeiro, listar todas as colunas da tabela
    const schemaResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'jobs'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 ESTRUTURA DA TABELA JOBS:');
    schemaResult.rows.forEach(col => {
      console.log(`├─ ${col.column_name}: ${col.data_type}`);
    });
    
    const result = await pool.query(
      'SELECT * FROM jobs WHERE id = $1',
      [jobId]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Job não encontrado');
      return;
    }
    
    const job = result.rows[0];
    console.log('\n📋 DETALHES DO JOB:');
    console.log(`├─ ID: ${job.id}`);
    console.log(`├─ Status: ${job.status}`);
    console.log(`├─ Criado: ${job.created_at}`);
    
    console.log('\n📊 TODAS AS COLUNAS:');
    Object.keys(job).forEach(key => {
      const value = job[key];
      console.log(`├─ ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao debugar job:', error);
  } finally {
    pool.end();
  }
}

// Usar argumento da linha de comando ou ID padrão
const jobId = process.argv[2] || '550e8400-e29b-41d4-a716-175790457232';
debugFailedJob(jobId);