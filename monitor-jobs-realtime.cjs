require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function monitorJobsInRealTime() {
  console.log('🔍 Monitorando jobs em tempo real...\n');
  
  let previousState = new Map();
  
  setInterval(async () => {
    try {
      const result = await pool.query(`
        SELECT id, status, created_at, updated_at,
               EXTRACT(EPOCH FROM (NOW() - created_at)) as age_seconds,
               EXTRACT(EPOCH FROM (NOW() - updated_at)) as last_update_seconds
        FROM jobs 
        WHERE status IN ('processing', 'queued')
        ORDER BY created_at DESC
        LIMIT 3
      `);
      
      console.clear();
      console.log('🔍 MONITOR JOBS EM TEMPO REAL');
      console.log('=====================================');
      console.log(`Timestamp: ${new Date().toLocaleTimeString()}\n`);
      
      result.rows.forEach(job => {
        const id = job.id.substring(0, 8);
        const prev = previousState.get(job.id);
        const statusChanged = prev && prev.status !== job.status;
        const recentUpdate = job.last_update_seconds < 10;
        
        console.log(`📋 Job ${id} | ${job.status.toUpperCase()}`);
        console.log(`   Idade: ${Math.floor(job.age_seconds)}s`);
        console.log(`   Última atualização: ${Math.floor(job.last_update_seconds)}s atrás`);
        
        if (statusChanged) {
          console.log(`   🔄 MUDOU: ${prev.status} → ${job.status}`);
        }
        
        if (recentUpdate) {
          console.log(`   💓 ATIVO (atualizado recentemente)`);
        } else if (job.last_update_seconds > 60) {
          console.log(`   ⚠️ POSSIVELMENTE TRAVADO`);
        }
        
        console.log('');
        
        previousState.set(job.id, {
          status: job.status,
          updated_at: job.updated_at
        });
      });
      
    } catch (err) {
      console.error('Erro no monitor:', err.message);
    }
  }, 5000); // Atualiza a cada 5 segundos
}

console.log('Iniciando monitor...');
monitorJobsInRealTime();