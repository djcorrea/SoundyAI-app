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
    `, ['e789a85f-104d-4c86-b06f-48624d031492']);
    
    if (result.rows.length > 0) {
      const job = result.rows[0];
      console.log('📊 Job Status:', job.status);
      console.log('❌ Job Error:', job.error);
      
      if (job.result) {
        const parsedResult = JSON.parse(job.result);
        console.log('✅ Job Result:', JSON.stringify(parsedResult, null, 2));
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
