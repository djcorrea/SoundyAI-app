require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 🎯 SISTEMA ROBUSTO DE RECUPERAÇÃO DE JOBS BACKEND

// 1. Endpoint para resetar job travado
async function resetJob(req, res) {
  const { jobId } = req.params;
  
  try {
    console.log(`🔄 Resetando job travado: ${jobId}`);
    
    const result = await pool.query(`
      UPDATE jobs 
      SET status = 'queued', 
          error = 'Resetado pelo sistema anti-travamento',
          updated_at = NOW()
      WHERE id = $1 AND status = 'processing'
      RETURNING id, status
    `, [jobId]);
    
    if (result.rows.length > 0) {
      console.log(`✅ Job ${jobId} resetado com sucesso`);
      res.json({ success: true, message: 'Job resetado com sucesso' });
    } else {
      console.log(`⚠️ Job ${jobId} não encontrado ou não está em processing`);
      res.status(404).json({ success: false, message: 'Job não encontrado ou não em processing' });
    }
    
  } catch (error) {
    console.error(`❌ Erro ao resetar job ${jobId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// 2. Endpoint para cancelar job travado
async function cancelJob(req, res) {
  const { jobId } = req.params;
  
  try {
    console.log(`❌ Cancelando job: ${jobId}`);
    
    const result = await pool.query(`
      UPDATE jobs 
      SET status = 'cancelled', 
          error = 'Cancelado por timeout do sistema',
          updated_at = NOW()
      WHERE id = $1 AND status IN ('processing', 'queued')
      RETURNING id, status
    `, [jobId]);
    
    if (result.rows.length > 0) {
      console.log(`✅ Job ${jobId} cancelado com sucesso`);
      res.json({ success: true, message: 'Job cancelado com sucesso' });
    } else {
      res.status(404).json({ success: false, message: 'Job não encontrado' });
    }
    
  } catch (error) {
    console.error(`❌ Erro ao cancelar job ${jobId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// 3. Watchdog automático - roda a cada 2 minutos
async function watchdogCleanup() {
  try {
    console.log('🐕 Watchdog: verificando jobs travados...');
    
    // Encontrar jobs em processing há mais de 5 minutos
    const stuckJobs = await pool.query(`
      SELECT id, file_key, created_at, updated_at
      FROM jobs 
      WHERE status = 'processing' 
      AND updated_at < NOW() - INTERVAL '5 minutes'
    `);
    
    if (stuckJobs.rows.length > 0) {
      console.log(`🚨 Watchdog: encontrou ${stuckJobs.rows.length} jobs travados`);
      
      for (const job of stuckJobs.rows) {
        console.log(`   🔄 Resetando job travado: ${job.id} (${job.file_key})`);
        
        await pool.query(`
          UPDATE jobs 
          SET status = 'queued', 
              error = 'Auto-resetado pelo watchdog (travado > 5min)',
              updated_at = NOW()
          WHERE id = $1
        `, [job.id]);
      }
      
      console.log(`✅ Watchdog: ${stuckJobs.rows.length} jobs resetados`);
    } else {
      console.log('✅ Watchdog: nenhum job travado encontrado');
    }
    
  } catch (error) {
    console.error('❌ Erro no watchdog:', error);
  }
}

// 4. Sistema de limpeza de jobs antigos
async function cleanupOldJobs() {
  try {
    console.log('🧹 Limpeza: removendo jobs antigos...');
    
    // Remover jobs concluídos há mais de 7 dias
    const cleanupResult = await pool.query(`
      DELETE FROM jobs 
      WHERE status IN ('done', 'completed', 'failed', 'cancelled', 'error')
      AND created_at < NOW() - INTERVAL '7 days'
    `);
    
    if (cleanupResult.rowCount > 0) {
      console.log(`🧹 Limpeza: removeu ${cleanupResult.rowCount} jobs antigos`);
    } else {
      console.log('✅ Limpeza: nenhum job antigo para remover');
    }
    
  } catch (error) {
    console.error('❌ Erro na limpeza:', error);
  }
}

// 5. Inicializar watchdog e limpeza automática
function startWatchdog() {
  console.log('🚀 Iniciando sistema watchdog robusto...');
  
  // Watchdog a cada 2 minutos
  setInterval(watchdogCleanup, 2 * 60 * 1000);
  
  // Limpeza a cada 6 horas
  setInterval(cleanupOldJobs, 6 * 60 * 60 * 1000);
  
  // Execução inicial
  watchdogCleanup();
  cleanupOldJobs();
  
  console.log('✅ Watchdog ativo - monitoramento anti-travamento iniciado');
}

// 6. Estatísticas de saúde do sistema
async function getSystemHealth() {
  try {
    const stats = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (NOW() - created_at))) / 60 as avg_age_minutes
      FROM jobs 
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY status
      ORDER BY count DESC
    `);
    
    const health = {
      timestamp: new Date().toISOString(),
      last24Hours: {},
      totalJobs24h: 0
    };
    
    stats.rows.forEach(row => {
      health.last24Hours[row.status] = {
        count: parseInt(row.count),
        avgAgeMinutes: parseFloat(row.avg_age_minutes || 0).toFixed(1)
      };
      health.totalJobs24h += parseInt(row.count);
    });
    
    // Verificar se há jobs travados agora
    const currentStuck = await pool.query(`
      SELECT COUNT(*) as stuck_count
      FROM jobs 
      WHERE status = 'processing' 
      AND updated_at < NOW() - INTERVAL '5 minutes'
    `);
    
    health.currentlyStuck = parseInt(currentStuck.rows[0].stuck_count);
    health.healthy = health.currentlyStuck === 0;
    
    return health;
    
  } catch (error) {
    return { 
      healthy: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  resetJob,
  cancelJob,
  watchdogCleanup,
  cleanupOldJobs,
  startWatchdog,
  getSystemHealth
};
