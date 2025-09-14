/**
 * 🔧 RESET JOB TRAVADO
 * 
 * Resetar job travado de "processing" para "queued"
 * para que o worker possa processá-lo novamente
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const STUCK_JOB_ID = '8e6284d7-99bb-4ce3-a758-5de4c1182b63';

async function resetStuckJob() {
    try {
        console.log(`🔧 RESETANDO JOB TRAVADO: ${STUCK_JOB_ID}`);
        console.log('=' .repeat(60));
        
        // 1️⃣ Status atual
        const before = await pool.query(
            'SELECT id, status, updated_at FROM jobs WHERE id = $1',
            [STUCK_JOB_ID]
        );
        
        if (before.rows.length === 0) {
            console.log('❌ Job não encontrado!');
            return;
        }
        
        console.log('📊 ANTES:');
        console.log('├─ Status:', before.rows[0].status);
        console.log('└─ Updated:', before.rows[0].updated_at);
        
        // 2️⃣ Reset para queued
        const resetResult = await pool.query(`
            UPDATE jobs 
            SET status = 'queued', 
                updated_at = NOW(),
                error = NULL
            WHERE id = $1
            RETURNING status, updated_at
        `, [STUCK_JOB_ID]);
        
        console.log('\n🔄 RESET EXECUTADO:');
        console.log('├─ Rows affected:', resetResult.rowCount);
        console.log('├─ New status:', resetResult.rows[0].status);
        console.log('└─ New updated_at:', resetResult.rows[0].updated_at);
        
        // 3️⃣ Verificação
        const after = await pool.query(
            'SELECT id, status, updated_at FROM jobs WHERE id = $1',
            [STUCK_JOB_ID]
        );
        
        console.log('\n✅ APÓS RESET:');
        console.log('├─ Status:', after.rows[0].status);
        console.log('└─ Updated:', after.rows[0].updated_at);
        
        console.log('\n🎯 PRÓXIMOS PASSOS:');
        console.log('1. Worker deve pegar o job automaticamente');
        console.log('2. Job deve ser processado com o pipeline corrigido');
        console.log('3. Status deve mudar para "done" quando completo');
        
        await pool.end();
        
    } catch (error) {
        console.error('❌ Erro ao resetar job:', error.message);
        await pool.end();
    }
}

resetStuckJob();