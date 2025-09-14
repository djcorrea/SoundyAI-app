const { Client } = require('pg');

const connectionString = 'postgresql://postgres:bRANSvBWFNbVyJAhqYjBWJdlmXpzFqNO@junction.proxy.rlwy.net:45419/railway';

async function investigateCurrentJob() {
    const client = new Client({ connectionString });
    
    try {
        await client.connect();
        console.log('🔍 Investigando job atual...\n');
        
        // Job atual e01e4b96
        const jobId = 'e01e4b96-339c-45c7-871e-f7265fdec0d2';
        
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
                result,
                error_details,
                processing_method,
                run_id,
                reference,
                EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_total,
                EXTRACT(EPOCH FROM (NOW() - COALESCE(last_heartbeat, started_at)))/60 as minutes_no_heartbeat
            FROM audio_analysis_jobs 
            WHERE id = $1
        `;
        
        const result = await client.query(query, [jobId]);
        
        if (result.rows.length === 0) {
            console.log('❌ Job não encontrado');
            return;
        }
        
        const job = result.rows[0];
        console.log('📋 DETALHES DO JOB ATUAL:');
        console.log(`   ID: ${job.id}`);
        console.log(`   Arquivo: ${job.filename}`);
        console.log(`   Status: ${job.status}`);
        console.log(`   Duração áudio: ${job.audio_duration}s`);
        console.log(`   Método: ${job.processing_method}`);
        console.log(`   Run ID: ${job.run_id}`);
        console.log(`   Reference: ${job.reference}`);
        console.log(`   Criado: ${job.created_at}`);
        console.log(`   Iniciado: ${job.started_at}`);
        console.log(`   Último heartbeat: ${job.last_heartbeat}`);
        console.log(`   Tempo total: ${job.minutes_total?.toFixed(1)} min`);
        console.log(`   Sem heartbeat há: ${job.minutes_no_heartbeat?.toFixed(1)} min`);
        
        console.log('\n🔍 ANÁLISE DO RESULTADO:');
        if (job.result) {
            try {
                const result = JSON.parse(job.result);
                console.log(`   Score: ${result.score || 'N/A'}`);
                console.log(`   LUFS: ${result.loudness?.lufs || 'N/A'}`);
                console.log(`   True Peak: ${result.loudness?.truePeak || 'N/A'}`);
                console.log(`   Dynamics Range: ${result.dynamics?.range || 'N/A'}`);
                console.log(`   Bass Score: ${result.frequency?.bassScore || 'N/A'}`);
                console.log(`   Mid Score: ${result.frequency?.midScore || 'N/A'}`);
                console.log(`   High Score: ${result.frequency?.highScore || 'N/A'}`);
                
                if (result.score === 0) {
                    console.log('⚠️ SCORE ZERO - POSSÍVEL FALLBACK!');
                }
            } catch (e) {
                console.log('   ❌ Erro ao parsear resultado:', e.message);
            }
        } else {
            console.log('   📝 Resultado ainda não disponível');
        }
        
        console.log('\n🔍 DETALHES DO ERRO:');
        if (job.error_details) {
            try {
                const error = JSON.parse(job.error_details);
                console.log('   📝 Error details:', JSON.stringify(error, null, 2));
            } catch (e) {
                console.log('   📝 Error details (raw):', job.error_details);
            }
        } else {
            console.log('   ✅ Nenhum erro registrado');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.end();
    }
}

investigateCurrentJob();