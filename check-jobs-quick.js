/**
 * 🔍 VERIFICAÇÃO RÁPIDA: Status dos Jobs
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkJobsStatus() {
    try {
        console.log('🔍 VERIFICANDO STATUS DOS JOBS NO BANCO...\n');
        
        // ✅ Count por status
        const statusCount = await pool.query(`
            SELECT status, COUNT(*) as count 
            FROM jobs 
            GROUP BY status 
            ORDER BY count DESC
        `);
        
        console.log('📊 DISTRIBUIÇÃO DE STATUS:');
        statusCount.rows.forEach(row => {
            console.log(`├─ ${row.status}: ${row.count} jobs`);
        });
        
        // 🎯 Jobs mais recentes
        console.log('\n🕐 JOBS MAIS RECENTES:');
        const recentJobs = await pool.query(`
            SELECT id, status, created_at, updated_at, 
                   CASE WHEN result IS NOT NULL THEN 'HAS_RESULT' ELSE 'NO_RESULT' END as result_status
            FROM jobs 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        recentJobs.rows.forEach((job, index) => {
            const elapsed = Date.now() - new Date(job.created_at).getTime();
            const minutes = Math.floor(elapsed / 60000);
            console.log(`├─ [${index + 1}] ID:${job.id} | ${job.status} | ${job.result_status} | ${minutes}min atrás`);
        });
        
        // 🚨 Jobs em processamento há muito tempo
        console.log('\n⚠️  JOBS POSSIVELMENTE TRAVADOS:');
        const stuckJobs = await pool.query(`
            SELECT id, status, created_at, updated_at,
                   EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_stuck
            FROM jobs 
            WHERE status IN ('processing', 'queued')
              AND updated_at < NOW() - INTERVAL '5 minutes'
            ORDER BY updated_at ASC
        `);
        
        if (stuckJobs.rows.length === 0) {
            console.log('├─ ✅ Nenhum job travado encontrado');
        } else {
            stuckJobs.rows.forEach(job => {
                console.log(`├─ 🚨 ID:${job.id} | ${job.status} | ${Math.floor(job.minutes_stuck)}min travado`);
            });
        }
        
        await pool.end();
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

checkJobsStatus();