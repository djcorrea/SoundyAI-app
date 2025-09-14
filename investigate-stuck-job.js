/**
 * 🚨 INVESTIGAÇÃO DO JOB TRAVADO
 * 
 * Job ID: 8e6284d7-99bb-4ce3-a758-5de4c1182b63
 * Status: processing há 12+ minutos
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const STUCK_JOB_ID = '8e6284d7-99bb-4ce3-a758-5de4c1182b63';

async function investigateStuckJob() {
    try {
        console.log(`🚨 INVESTIGAÇÃO PROFUNDA DO JOB TRAVADO: ${STUCK_JOB_ID}`);
        console.log('=' .repeat(80));
        
        // 📊 Dados completos do job
        const jobData = await pool.query(`
            SELECT * FROM jobs WHERE id = $1
        `, [STUCK_JOB_ID]);
        
        if (jobData.rows.length === 0) {
            console.log('❌ Job não encontrado!');
            return;
        }
        
        const job = jobData.rows[0];
        
        console.log('\n📋 DADOS COMPLETOS DO JOB:');
        console.log('├─ ID:', job.id);
        console.log('├─ File Key:', job.file_key);
        console.log('├─ Mode:', job.mode);
        console.log('├─ Status:', job.status);
        console.log('├─ Created:', job.created_at);
        console.log('├─ Updated:', job.updated_at);
        console.log('├─ Completed:', job.completed_at || 'NULL');
        console.log('├─ Error:', job.error || 'NULL');
        console.log('├─ Has Result:', job.result ? 'SIM' : 'NÃO');
        
        const minutesStuck = (Date.now() - new Date(job.updated_at).getTime()) / 60000;
        console.log('└─ Tempo Travado:', Math.floor(minutesStuck), 'minutos');
        
        // 🔍 Teste direto da API
        console.log('\n🌐 TESTE DA API PARA ESTE JOB:');
        try {
            const response = await fetch(`http://localhost:3001/api/jobs/${STUCK_JOB_ID}`);
            const apiData = await response.json();
            
            console.log('├─ API Response Status:', response.status);
            console.log('├─ API Job Status:', apiData.status);
            console.log('├─ API Error:', apiData.error || 'NULL');
            console.log('├─ API Has Result:', apiData.result ? 'SIM' : 'NÃO');
            console.log('└─ API Raw Response:', JSON.stringify(apiData, null, 2));
            
        } catch (apiError) {
            console.log('❌ Erro ao testar API:', apiError.message);
        }
        
        // 🔧 SIMULAÇÃO DO WORKER - O que aconteceria se processássemos agora?
        console.log('\n🔧 SIMULAÇÃO: O que aconteceria se reprocessássemos este job?');
        
        // Verificar se o arquivo ainda existe no B2
        const fileKey = job.file_key;
        console.log('├─ File Key a ser processado:', fileKey);
        
        // Verificar se o job tem todas as info necessárias
        const hasRequiredData = fileKey && job.mode;
        console.log('├─ Tem dados necessários:', hasRequiredData ? 'SIM' : 'NÃO');
        console.log('└─ Pronto para reprocessamento:', hasRequiredData ? 'SIM' : 'NÃO');
        
        // 💡 PROPOSTA DE CORREÇÃO
        console.log('\n💡 PROPOSTAS DE CORREÇÃO:');
        console.log('1️⃣ Reprocessar o job (forçar worker a pegar novamente)');
        console.log('2️⃣ Marcar como failed e permitir retry');
        console.log('3️⃣ Investigar logs do worker durante o processamento');
        console.log('4️⃣ Verificar se arquivo ainda existe no B2');
        
        await pool.end();
        
    } catch (error) {
        console.error('❌ Erro na investigação:', error.message);
        await pool.end();
    }
}

investigateStuckJob();