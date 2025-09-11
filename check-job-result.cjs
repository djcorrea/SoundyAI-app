require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkJobResult() {
  try {
    const result = await pool.query(`
      SELECT id, status, result, error 
      FROM jobs 
      WHERE id = $1
    `, ['9778d677-0002-4349-8e69-f3d95adfd644']);
    
    if (result.rows.length > 0) {
      const job = result.rows[0];
      console.log('📊 Job Status:', job.status);
      console.log('❌ Job Error:', job.error);
      
      if (job.result) {
        console.log('📊 Raw Result Type:', typeof job.result);
        console.log('📊 Raw Result Keys:', Object.keys(job.result));
        console.log('✅ Job Result (complete):', JSON.stringify(job.result, null, 2));
      } else {
        console.log('❌ Sem resultado no job');
      }
    } else {
      console.log('❌ Job não encontrado');
    }
    
    await pool.end();
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

checkJobResult();
