require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function monitorJobsProgress() {
    let checkCount = 0;
    const maxChecks = 20; // 10 minutos (30s cada)
    
    console.log('🔍 Monitorando progresso dos jobs em processing...\n');
    
    while (checkCount < maxChecks) {
        try {
            const result = await pool.query(`
                SELECT 
                    id,
                    file_key,
                    status,
                    created_at,
                    updated_at,
                    completed_at,
                    progress,
                    progress_message,
                    result,
                    error,
                    EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_total,
                    EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_no_update
                FROM jobs 
                WHERE status = 'processing'
                ORDER BY created_at DESC
            `);
            
            const timestamp = new Date().toLocaleTimeString();
            console.log(`\n⏰ [${timestamp}] Jobs em processing: ${result.rows.length}`);
            
            if (result.rows.length === 0) {
                console.log('✅ Todos os jobs foram processados!');
                break;
            }
            
            result.rows.forEach((job, index) => {
                const shortId = job.id.substring(0, 8);
                const minutesTotal = job.minutes_total ? job.minutes_total.toFixed(1) : 'N/A';
                const minutesNoUpdate = job.minutes_no_update ? job.minutes_no_update.toFixed(1) : 'N/A';
                
                console.log(`   ${index + 1}. ${shortId}: ${minutesTotal}min total, ${minutesNoUpdate}min sem update`);
                
                if (job.result) {
                    console.log(`      📊 RESULTADO PRESENTE! Checking...`);
                    try {
                        const resultObj = typeof job.result === 'string' ? JSON.parse(job.result) : job.result;
                        console.log(`      ✅ Score: ${resultObj.score || 'N/A'}`);
                    } catch (e) {
                        console.log(`      ❌ Erro ao parsear resultado`);
                    }
                }
                
                if (job.error) {
                    console.log(`      ❌ ERRO: ${job.error.substring(0, 100)}...`);
                }
            });
            
            checkCount++;
            if (checkCount < maxChecks) {
                console.log(`\n💤 Aguardando 30s... (check ${checkCount}/${maxChecks})`);
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
            
        } catch (error) {
            console.error(`❌ Erro no monitoramento:`, error.message);
            await new Promise(resolve => setTimeout(resolve, 30000));
            checkCount++;
        }
    }
    
    console.log('\n🏁 Monitoramento finalizado.');
    await pool.end();
}

monitorJobsProgress();