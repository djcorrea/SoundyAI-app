require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkJobs() {
  try {
    console.log('🔍 Verificando jobs na base...');
    
    const result = await pool.query(`
      SELECT id, status, created_at, file_key 
      FROM jobs 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log('📊 Jobs encontrados:', result.rows.length);
    result.rows.forEach(job => {
      console.log(`  - ID: ${job.id}, Status: ${job.status}, Arquivo: ${job.file_key}, Criado: ${job.created_at}`);
    });
    
    const count = await pool.query('SELECT COUNT(*) FROM jobs');
    console.log(`📈 Total de jobs na base: ${count.rows[0].count}`);
    
    // Verificar jobs por status
    const statusCount = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM jobs 
      GROUP BY status
    `);
    console.log('📊 Jobs por status:');
    statusCount.rows.forEach(row => {
      console.log(`  - ${row.status}: ${row.count}`);
    });
    
    await pool.end();
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

checkJobs();
