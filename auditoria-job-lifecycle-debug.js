/**
 * 🎯 AUDITORIA JOB LIFECYCLE: DEBUG COMPLETO
 * 
 * Teste específico para rastrear um job desde processamento até API resposta
 * Descobrir exatamente onde jobs ficam "travados" em "processing"
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// 🔍 Função para monitorar um job específico
async function monitorJobLifecycle(jobId) {
    console.log(`\n🎯 INICIANDO MONITORAMENTO DO JOB ${jobId}`);
    console.log('=' .repeat(80));
    
    let lastStatus = null;
    let attempts = 0;
    const maxAttempts = 150; // 5 minutos
    
    const startTime = Date.now();
    
    while (attempts < maxAttempts) {
        attempts++;
        
        try {
            // 📊 Status direto do banco
            const dbResult = await pool.query(
                `SELECT id, status, result, error, created_at, updated_at, completed_at 
                 FROM jobs WHERE id = $1`, 
                [jobId]
            );
            
            if (dbResult.rows.length === 0) {
                console.log(`❌ Job ${jobId} não encontrado no banco`);
                break;
            }
            
            const job = dbResult.rows[0];
            const currentStatus = job.status;
            
            // 📝 Log apenas quando status muda
            if (currentStatus !== lastStatus) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                
                console.log(`\n[${elapsed}s] 📊 MUDANÇA DE STATUS: ${lastStatus || 'INICIAL'} → ${currentStatus}`);
                console.log(`├─ ID: ${job.id}`);
                console.log(`├─ Created: ${job.created_at}`);
                console.log(`├─ Updated: ${job.updated_at}`);
                console.log(`├─ Completed: ${job.completed_at || 'NULL'}`);
                console.log(`├─ Has Result: ${job.result ? 'SIM' : 'NÃO'}`);
                console.log(`├─ Has Error: ${job.error ? 'SIM' : 'NÃO'}`);
                
                if (job.result) {
                    try {
                        const resultObj = typeof job.result === 'string' ? JSON.parse(job.result) : job.result;
                        console.log(`├─ Score: ${resultObj.finalData?.score || 'N/A'}`);
                        console.log(`├─ Classification: ${resultObj.finalData?.classification || 'N/A'}`);
                    } catch (e) {
                        console.log(`├─ Result Parse Error: ${e.message}`);
                    }
                }
                
                if (job.error) {
                    console.log(`└─ Error: ${job.error}`);
                } else {
                    console.log(`└─ No Error`);
                }
                
                lastStatus = currentStatus;
            }
            
            // 🎯 Status finais - parar monitoramento
            if (['done', 'completed', 'failed', 'error'].includes(currentStatus)) {
                console.log(`\n✅ JOB FINALIZADO EM ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
                
                // 🔍 Teste direto da API
                console.log('\n🌐 TESTANDO RESPOSTA DA API...');
                try {
                    const apiResponse = await fetch(`http://localhost:3001/api/jobs/${jobId}`);
                    const apiData = await apiResponse.json();
                    
                    console.log('├─ API Status Code:', apiResponse.status);
                    console.log('├─ API Job Status:', apiData.status);
                    console.log('├─ API Has Result:', apiData.result ? 'SIM' : 'NÃO');
                    console.log('└─ Status Mapping OK:', currentStatus === 'done' && apiData.status === 'completed' ? 'SIM' : 'NÃO');
                    
                } catch (apiError) {
                    console.log('❌ Erro na API:', apiError.message);
                }
                
                break;
            }
            
        } catch (error) {
            console.log(`❌ Erro ao consultar job ${jobId}:`, error.message);
            break;
        }
        
        // ⏱️ Aguardar 2s antes da próxima verificação
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    if (attempts >= maxAttempts) {
        console.log(`\n⏰ TIMEOUT: Job ${jobId} não finalizou em 5 minutos`);
    }
}

// 🚀 Função para pegar o job mais recente em processamento
async function getLatestProcessingJob() {
    try {
        const result = await pool.query(
            `SELECT id, status, created_at 
             FROM jobs 
             WHERE status IN ('queued', 'processing') 
             ORDER BY created_at DESC 
             LIMIT 1`
        );
        
        if (result.rows.length > 0) {
            return result.rows[0];
        }
        
        return null;
    } catch (error) {
        console.error('❌ Erro ao buscar job em processamento:', error);
        return null;
    }
}

// 🎬 Execução principal
async function main() {
    console.log('🔍 AUDITORIA COMPLETA DO CICLO DE VIDA DOS JOBS');
    console.log('=' .repeat(80));
    
    // 1️⃣ Buscar job mais recente
    const latestJob = await getLatestProcessingJob();
    
    if (!latestJob) {
        console.log('📭 Nenhum job em processamento encontrado.');
        console.log('💡 Crie um novo job através da interface para monitorar.');
        process.exit(0);
    }
    
    console.log(`\n🎯 JOB ENCONTRADO:`);
    console.log(`├─ ID: ${latestJob.id}`);
    console.log(`├─ Status: ${latestJob.status}`);
    console.log(`└─ Created: ${latestJob.created_at}`);
    
    // 2️⃣ Monitorar o job
    await monitorJobLifecycle(latestJob.id);
    
    // 3️⃣ Fechar conexão
    await pool.end();
    console.log('\n👋 Auditoria finalizada.');
}

// 🚀 Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { monitorJobLifecycle, getLatestProcessingJob };