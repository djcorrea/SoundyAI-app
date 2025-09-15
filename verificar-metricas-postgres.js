// verificar-metricas-postgres.js - Verificar se métricas espectrais estão no PostgreSQL

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function verificarMetricasPostgres() {
    try {
        console.log('🎵 VERIFICANDO MÉTRICAS ESPECTRAIS NO POSTGRESQL...\n');
        
        // Buscar jobs recentes com resultado
        const query = `
            SELECT id, file_name, status, created_at, result
            FROM jobs 
            WHERE result IS NOT NULL
            ORDER BY created_at DESC 
            LIMIT 5
        `;
        
        const result = await pool.query(query);
        console.log(`📊 Analisando ${result.rows.length} jobs com resultado...\n`);
        
        const metricasObrigatorias = [
            'spectralCentroidHz',
            'spectralRolloffHz', 
            'spectralFlatness',
            'bandEnergies',
            'frequenciaCentral',  // alias
            'limiteAgudos85'      // alias
        ];
        
        let totalJobsComMetricas = 0;
        
        result.rows.forEach((job, index) => {
            console.log(`🔍 [${index + 1}] Job ID: ${job.id}`);
            console.log(`📁 Arquivo: ${job.file_name || 'sem nome'}`);
            console.log(`📅 Data: ${new Date(job.created_at).toLocaleString()}`);
            
            if (!job.result) {
                console.log('❌ Sem resultado no job\n');
                return;
            }
            
            // Analisar métricas presentes
            const metricasPresentes = [];
            const metricasAusentes = [];
            
            metricasObrigatorias.forEach(metrica => {
                if (job.result[metrica] !== undefined) {
                    metricasPresentes.push(metrica);
                } else {
                    metricasAusentes.push(metrica);
                }
            });
            
            const totalMetricasNoJob = Object.keys(job.result).length;
            const percentualMetricas = Math.round((metricasPresentes.length / metricasObrigatorias.length) * 100);
            
            console.log(`📊 Métricas: ${metricasPresentes.length}/${metricasObrigatorias.length} (${percentualMetricas}%) | Total no job: ${totalMetricasNoJob}`);
            
            if (metricasPresentes.length > 0) {
                totalJobsComMetricas++;
                console.log(`✅ Presentes: ${metricasPresentes.join(', ')}`);
                
                // Mostrar valores das métricas espectrais
                const valores = {};
                metricasPresentes.forEach(metrica => {
                    const valor = job.result[metrica];
                    if (typeof valor === 'number') {
                        valores[metrica] = Math.round(valor * 100) / 100; // 2 casas decimais
                    } else if (typeof valor === 'object') {
                        valores[metrica] = 'Object';
                    } else {
                        valores[metrica] = valor;
                    }
                });
                console.log(`📈 Valores:`, valores);
            }
            
            if (metricasAusentes.length > 0) {
                console.log(`❌ Ausentes: ${metricasAusentes.join(', ')}`);
            }
            
            // Verificar se tem runId para rastreamento
            if (job.result.runId) {
                console.log(`🆔 RunID: ${job.result.runId}`);
            }
            
            console.log(''); // linha em branco
        });
        
        // Resumo final
        console.log('📋 RESUMO FINAL:');
        console.log(`├─ Jobs analisados: ${result.rows.length}`);
        console.log(`├─ Jobs com métricas espectrais: ${totalJobsComMetricas}`);
        console.log(`├─ Percentual de sucesso: ${Math.round((totalJobsComMetricas / result.rows.length) * 100)}%`);
        
        if (totalJobsComMetricas === result.rows.length) {
            console.log('└─ ✅ SUCESSO! Todos os jobs têm métricas espectrais!');
        } else if (totalJobsComMetricas > 0) {
            console.log(`└─ ⚠️ PARCIAL: ${totalJobsComMetricas}/${result.rows.length} jobs têm métricas`);
        } else {
            console.log('└─ ❌ PROBLEMA: Nenhum job tem métricas espectrais!');
        }
        
        await pool.end();
        
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

verificarMetricasPostgres();