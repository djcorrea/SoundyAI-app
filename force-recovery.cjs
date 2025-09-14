require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function forceRecoveryOrphanedJobs() {
  try {
    console.log('🔄 Forçando recovery de jobs órfãos...');
    
    // Recuperar jobs órfãos (mais de 5 minutos sem atualização)
    const result = await pool.query(`
      UPDATE jobs 
      SET status = 'queued', updated_at = NOW(), error = 'Recovered from orphaned state - manual recovery'
      WHERE status = 'processing' 
      AND updated_at < NOW() - INTERVAL '5 minutes'
      RETURNING id, file_key
    `);

    if (result.rows.length > 0) {
      console.log(`✅ Recuperados ${result.rows.length} jobs órfãos:`);
      result.rows.forEach(job => {
        console.log(`   - ${job.id.substring(0, 8)}: ${job.file_key}`);
      });
    } else {
      console.log('📭 Nenhum job órfão encontrado para recovery');
    }

    await pool.end();
  } catch (err) {
    console.error('❌ Erro no recovery:', err);
  }
}

forceRecoveryOrphanedJobs();