// 🔄 MONITOR DE LOOP INFINITO
// Monitora jobs em tempo real para detectar ciclos

import "dotenv/config";
import pkg from "pg";
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

console.log("🔄 Iniciando monitor de loop infinito...");
console.log("   Pressione Ctrl+C para parar");

let previousStatus = new Map();

async function monitorJobs() {
  try {
    await client.connect();
    console.log("✅ Conectado ao banco - iniciando monitoramento\n");

    const monitor = setInterval(async () => {
      try {
        // Verificar jobs ativos
        const activeJobs = await client.query(`
          SELECT id, file_name, status, error, created_at, updated_at,
                 EXTRACT(EPOCH FROM (NOW() - created_at))/60 as total_minutes,
                 EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_since_update
          FROM jobs 
          WHERE status IN ('queued', 'processing')
          OR created_at > NOW() - INTERVAL '10 minutes'
          ORDER BY created_at DESC
          LIMIT 10
        `);

        const now = new Date().toLocaleTimeString();
        console.log(`\n⏰ ${now} - Status dos Jobs:`);
        
        if (activeJobs.rows.length === 0) {
          console.log("   ✅ Nenhum job ativo");
        }

        const currentStatus = new Map();
        
        activeJobs.rows.forEach(job => {
          const id = job.id.substring(0, 8);
          const fileName = job.file_name ? job.file_name.substring(0, 50) + '...' : 'unknown';
          const totalMin = parseFloat(job.total_minutes) || 0;
          const updateMin = parseFloat(job.minutes_since_update) || 0;
          
          const statusInfo = {
            status: job.status,
            totalMin: totalMin.toFixed(1),
            updateMin: updateMin.toFixed(1),
            error: job.error ? job.error.substring(0, 50) + '...' : null
          };
          
          currentStatus.set(id, statusInfo);
          
          // Detectar mudanças
          const previous = previousStatus.get(id);
          let changeIndicator = '';
          
          if (!previous) {
            changeIndicator = '🆕 NOVO';
          } else if (previous.status !== statusInfo.status) {
            changeIndicator = `🔄 ${previous.status} → ${statusInfo.status}`;
          } else if (statusInfo.status === 'processing' && updateMin > 5) {
            changeIndicator = '⚠️ SEM UPDATE';
          } else if (statusInfo.status === 'processing' && totalMin > 10) {
            changeIndicator = '🚨 MUITO TEMPO';
          }
          
          console.log(`   ${id}: ${statusInfo.status} | ${statusInfo.totalMin}min total | ${statusInfo.updateMin}min ago ${changeIndicator}`);
          if (statusInfo.error) {
            console.log(`     ❌ ${statusInfo.error}`);
          }
        });

        // Detectar possível loop
        const processingJobs = activeJobs.rows.filter(job => job.status === 'processing');
        const oldProcessingJobs = processingJobs.filter(job => parseFloat(job.minutes_since_update) > 5);
        
        if (oldProcessingJobs.length > 0) {
          console.log(`\n🚨 ALERTA: ${oldProcessingJobs.length} jobs possivelmente órfãos:`);
          oldProcessingJobs.forEach(job => {
            const id = job.id.substring(0, 8);
            const minutes = parseFloat(job.minutes_since_update) || 0;
            console.log(`   - ${id}: ${minutes.toFixed(1)}min sem heartbeat`);
          });
        }

        // Verificar jobs que acabaram de falhar
        const recentFailed = await client.query(`
          SELECT id, status, error, updated_at
          FROM jobs 
          WHERE updated_at > NOW() - INTERVAL '2 minutes'
          AND status = 'failed'
          ORDER BY updated_at DESC
          LIMIT 3
        `);

        if (recentFailed.rows.length > 0) {
          console.log(`\n❌ FALHAS RECENTES (últimos 2min):`);
          recentFailed.rows.forEach(job => {
            const id = job.id.substring(0, 8);
            console.log(`   - ${id}: ${job.error?.substring(0, 80)}...`);
          });
        }

        previousStatus = currentStatus;

      } catch (error) {
        console.error(`❌ Erro no monitor: ${error.message}`);
      }
    }, 15000); // A cada 15 segundos

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n👋 Parando monitor...');
      clearInterval(monitor);
      client.end();
      process.exit(0);
    });

  } catch (error) {
    console.error("❌ Erro:", error.message);
    process.exit(1);
  }
}

monitorJobs().catch(console.error);