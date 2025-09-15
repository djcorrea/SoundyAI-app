/**
 * 🔍 VERIFICAÇÃO RÁPIDA: Status dos Jobs + Métricas Espectrais
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
        
        // 🎯 Jobs mais recentes COM ANÁLISE DE MÉTRICAS
        console.log('\n🕐 JOBS MAIS RECENTES (com análise de métricas):');
        const recentJobs = await pool.query(`
            SELECT id, status, created_at, updated_at, result, filename
            FROM jobs 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        recentJobs.rows.forEach((job, index) => {
            const elapsed = Date.now() - new Date(job.created_at).getTime();
            const minutes = Math.floor(elapsed / 60000);
            
            let metricasInfo = 'NO_RESULT';
            if (job.result) {
                const metricasEspectrais = [
                    'spectralCentroidHz', 'spectralRolloffHz', 'spectralFlatness',
                    'frequenciaCentral', 'limiteAgudos85', 'bandEnergies'
                ];
                
                const metricasEncontradas = metricasEspectrais.filter(m => job.result[m] !== undefined);
                const totalMetricas = Object.keys(job.result).length;
                
                if (metricasEncontradas.length > 0) {
                    metricasInfo = `✅ ${metricasEncontradas.length}/${metricasEspectrais.length} métricas (${totalMetricas} total)`;
                } else {
                    metricasInfo = `⚠️ 0 métricas espectrais (${totalMetricas} total)`;
                }
            }
            
            console.log(`├─ [${index + 1}] ID:${job.id} | ${job.status} | ${metricasInfo} | ${minutes}min atrás`);
            if (job.filename) console.log(`│   📁 ${job.filename}`);
        });
        
        // 🎵 ANÁLISE DETALHADA DE MÉTRICAS
        console.log('\n🎵 ANÁLISE DE MÉTRICAS ESPECTRAIS:');
        const metricsAnalysis = await pool.query(`
            SELECT id, filename, result
            FROM jobs 
            WHERE status = 'completed' 
              AND result IS NOT NULL
              AND created_at > NOW() - INTERVAL '24 hours'
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        if (metricsAnalysis.rows.length === 0) {
            console.log('├─ ❌ Nenhum job completo com result nas últimas 24h');
        } else {
            metricsAnalysis.rows.forEach((job, index) => {
                const metricasEspectrais = [
                    'spectralCentroidHz', 'spectralRolloffHz', 'spectralFlatness',
                    'frequenciaCentral', 'limiteAgudos85', 'bandEnergies'
                ];
                
                const metricasStatus = {};
                metricasEspectrais.forEach(metrica => {
                    metricasStatus[metrica] = job.result[metrica] !== undefined;
                });
                
                const metricasPresentes = Object.values(metricasStatus).filter(Boolean).length;
                const statusIcon = metricasPresentes === metricasEspectrais.length ? '✅' : 
                                 metricasPresentes > 0 ? '⚠️' : '❌';
                
                console.log(`├─ ${statusIcon} [${index + 1}] ID:${job.id} | ${metricasPresentes}/${metricasEspectrais.length} métricas`);
                console.log(`│   📁 ${job.filename || 'sem nome'}`);
                
                // Mostrar quais métricas estão presentes/ausentes
                const presentes = metricasEspectrais.filter(m => metricasStatus[m]);
                const ausentes = metricasEspectrais.filter(m => !metricasStatus[m]);
                
                if (presentes.length > 0) {
                    console.log(`│   ✅ Presentes: ${presentes.join(', ')}`);
                }
                if (ausentes.length > 0) {
                    console.log(`│   ❌ Ausentes: ${ausentes.join(', ')}`);
                }
                console.log('│');
            });
        }
        
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

// 📡 Função para endpoint HTTP (se necessário)
async function checkJobsQuick() {
    try {
        const query = `
            SELECT 
                id,
                status,
                filename,
                created_at,
                result
            FROM jobs 
            WHERE status IN ('completed', 'processing')
            AND created_at > NOW() - INTERVAL '24 hours'
            ORDER BY created_at DESC 
            LIMIT 10
        `;
        
        const result = await pool.query(query);
        
        // Analisar métricas em cada job
        const jobsComAnalise = result.rows.map(job => {
            const analise = {
                id: job.id,
                status: job.status,
                filename: job.filename,
                created_at: job.created_at,
                temResult: !!job.result,
                metricas: {}
            };
            
            if (job.result) {
                const metricasEspectrais = [
                    'spectralCentroidHz', 'spectralRolloffHz', 'spectralFlatness',
                    'frequenciaCentral', 'limiteAgudos85', 'bandEnergies'
                ];
                
                metricasEspectrais.forEach(metrica => {
                    analise.metricas[metrica] = job.result[metrica] !== undefined;
                });
                
                analise.totalMetricas = Object.keys(job.result).length;
                analise.metricasEspectraisCount = metricasEspectrais.filter(m => analise.metricas[m]).length;
            }
            
            return analise;
        });
        
        return jobsComAnalise;
        
    } catch (error) {
        console.error('❌ [CHECK_JOBS_QUICK] Erro:', error);
        throw error;
    }
}

// Se executado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
    checkJobsStatus();
}

export { checkJobsQuick };