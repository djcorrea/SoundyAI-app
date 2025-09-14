require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function investigateProcessingJobs() {
    try {
        console.log('🔍 Investigando jobs em processing...\n');
        
        const query = `
            SELECT 
                id,
                file_key,
                file_name,
                mode,
                status,
                result,
                error,
                created_at,
                updated_at,
                completed_at,
                progress,
                progress_message,
                EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_total,
                EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_no_update
            FROM jobs 
            WHERE status = 'processing'
            ORDER BY created_at DESC
        `;
        
        const result = await pool.query(query);
        
        console.log(`📋 JOBS EM PROCESSING (${result.rows.length}):\n`);
        
        for (const job of result.rows) {
            console.log(`🔄 JOB: ${job.id.substring(0, 8)}...`);
            console.log(`   Arquivo: ${job.file_key}`);
            console.log(`   Nome: ${job.file_name?.substring(0, 80)}...`);
            console.log(`   Modo: ${job.mode}`);
            console.log(`   Progress: ${job.progress}%`);
            console.log(`   Progress Message: ${job.progress_message}`);
            console.log(`   Criado: ${job.created_at}`);
            console.log(`   Atualizado: ${job.updated_at}`);
            console.log(`   Completado: ${job.completed_at}`);
            console.log(`   Tempo total: ${job.minutes_total ? job.minutes_total.toFixed(1) : 'N/A'} min`);
            console.log(`   Sem update há: ${job.minutes_no_update ? job.minutes_no_update.toFixed(1) : 'N/A'} min`);
            
            if (job.minutes_no_update && job.minutes_no_update > 5) {
                console.log('   🚨 POSSÍVEL JOB ÓRFÃO - SEM UPDATE HÁ MAIS DE 5 MIN!');
            }
            
            if (job.result) {
                console.log('   📋 RESULTADO PRESENTE:');
                try {
                    const resultObj = typeof job.result === 'string' ? JSON.parse(job.result) : job.result;
                    console.log(`      Score: ${resultObj.score || 'N/A'}`);
                    if (resultObj.score === 0) {
                        console.log('      ⚠️ SCORE ZERO - POSSÍVEL FALLBACK!');
                    }
                } catch (e) {
                    console.log('      ❌ Erro ao parsear resultado');
                }
            } else {
                console.log('   📝 Resultado ainda não disponível');
            }
            
            if (job.error) {
                console.log(`   ❌ ERRO: ${job.error}`);
            }
            
            console.log('');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

investigateProcessingJobs();