const { Client } = require('pg');

const connectionString = 'postgresql://postgres:bRANSvBWFNbVyJAhqYjBWJdlmXpzFqNO@junction.proxy.rlwy.net:45419/railway';

async function investigateProcessingJobs() {
    const client = new Client({ connectionString });
    
    try {
        await client.connect();
        console.log('🔍 Investigando jobs em processing...\n');
        
        const query = `
            SELECT 
                id,
                filename,
                status,
                created_at,
                started_at,
                completed_at,
                last_heartbeat,
                audio_duration,
                processing_method,
                run_id,
                reference,
                EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_total,
                EXTRACT(EPOCH FROM (NOW() - COALESCE(last_heartbeat, started_at)))/60 as minutes_no_heartbeat
            FROM audio_analysis_jobs 
            WHERE status = 'processing'
            ORDER BY created_at DESC
        `;
        
        const result = await client.query(query);
        
        console.log(`📋 JOBS EM PROCESSING (${result.rows.length}):\n`);
        
        for (const job of result.rows) {
            console.log(`🔄 JOB: ${job.id.substring(0, 8)}...`);
            console.log(`   Arquivo: ${job.filename}`);
            console.log(`   Duração: ${job.audio_duration}s`);
            console.log(`   Método: ${job.processing_method}`);
            console.log(`   Run ID: ${job.run_id}`);
            console.log(`   Reference: ${job.reference}`);
            console.log(`   Criado: ${job.created_at}`);
            console.log(`   Iniciado: ${job.started_at}`);
            console.log(`   Último heartbeat: ${job.last_heartbeat}`);
            console.log(`   Tempo total: ${job.minutes_total?.toFixed(1)} min`);
            console.log(`   Sem heartbeat há: ${job.minutes_no_heartbeat?.toFixed(1)} min`);
            
            if (job.minutes_no_heartbeat > 5) {
                console.log('   🚨 POSSÍVEL JOB ÓRFÃO!');
            }
            console.log('');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.end();
    }
}

investigateProcessingJobs();