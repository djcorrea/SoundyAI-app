require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixStuckJob() {
  try {
    console.log('🔧 Corrigindo job travado...');
    
    // Identificar jobs em processing há mais de 10 minutos
    const stuckJobs = await pool.query(`
      SELECT id, status, created_at, file_key 
      FROM jobs 
      WHERE status = 'processing' 
      AND created_at < NOW() - INTERVAL '10 minutes'
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 Jobs travados encontrados: ${stuckJobs.rows.length}`);
    
    if (stuckJobs.rows.length > 0) {
      for (const job of stuckJobs.rows) {
        console.log(`  - Corrigindo job: ${job.id} (${job.file_key})`);
        
        // Atualizar status para 'error' com informação do problema
        await pool.query(`
          UPDATE jobs 
          SET status = 'error', 
              error_message = 'Job travado em processing - corrigido automaticamente',
              updated_at = NOW()
          WHERE id = $1
        `, [job.id]);
        
        console.log(`  ✅ Job ${job.id} marcado como erro`);
      }
      
      console.log('🎉 Todos os jobs travados foram corrigidos!');
    } else {
      console.log('✅ Nenhum job travado encontrado');
    }
    
    // Verificar status atual
    const statusCount = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM jobs 
      GROUP BY status
    `);
    console.log('\n📊 Status atual dos jobs:');
    statusCount.rows.forEach(row => {
      console.log(`  - ${row.status}: ${row.count}`);
    });
    
    await pool.end();
  } catch (err) {
    console.error('❌ Erro:', err.message);
    await pool.end();
  }
}

fixStuckJob();
