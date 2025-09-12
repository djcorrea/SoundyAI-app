/**
 * 🔬 INTERCEPTAÇÃO REAL: Dados do Railway
 * 
 * Vou interceptar um job real do backend para ver exatamente o que está sendo enviado
 */

import "dotenv/config";
import pkg from "pg";

const { Client } = pkg;

async function interceptRealJobData() {
    console.log("🔬 [INTERCEPTAÇÃO] Conectando ao Railway PostgreSQL...");
    
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
    });
    
    try {
        await client.connect();
        console.log("✅ Conectado ao banco Railway");
        
        // Buscar jobs recentes com resultado
        const result = await client.query(`
            SELECT id, file_key, mode, status, result, created_at, updated_at
            FROM jobs 
            WHERE result IS NOT NULL
            AND status = 'completed'
            ORDER BY updated_at DESC 
            LIMIT 3
        `);
        
        console.log(`📊 [INTERCEPTAÇÃO] Encontrados ${result.rows.length} jobs com resultado:`);
        
        result.rows.forEach((job, index) => {
            console.log(`\n🎯 JOB ${index + 1}:`);
            console.log(`  - ID: ${job.id}`);
            console.log(`  - FileKey: ${job.file_key}`);
            console.log(`  - Mode: ${job.mode}`);
            console.log(`  - Status: ${job.status}`);
            console.log(`  - Created: ${job.created_at}`);
            console.log(`  - Updated: ${job.updated_at}`);
            
            if (job.result) {
                console.log(`\n📋 RESULTADO COMPLETO DO JOB ${index + 1}:`);
                console.log(JSON.stringify(job.result, null, 2));
                
                // Análise específica das chaves
                console.log(`\n🔍 ANÁLISE DAS CHAVES DO JOB ${index + 1}:`);
                
                if (job.result.technicalData) {
                    const tech = job.result.technicalData;
                    console.log(`  technicalData keys:`, Object.keys(tech));
                    
                    // Verificar chaves críticas
                    const criticalKeys = [
                        'lufs_integrated', 'lufsIntegrated',
                        'true_peak', 'truePeak', 'truePeakDbtp',
                        'dynamic_range', 'dynamicRange',
                        'peak_db', 'peak', 'peakDb',
                        'rms_level', 'rms', 'rmsLevel',
                        'stereo_correlation', 'stereoCorrelation'
                    ];
                    
                    console.log(`\n  🎯 CHAVES CRÍTICAS:`);
                    criticalKeys.forEach(key => {
                        const value = tech[key];
                        const status = value !== undefined ? 
                            (Number.isFinite(value) ? `✅ ${value}` : `⚠️ ${value} (not finite)`) : 
                            '❌ AUSENTE';
                        console.log(`    ${key}: ${status}`);
                    });
                    
                    // Verificar spectral_balance
                    console.log(`\n  📊 SPECTRAL BALANCE:`);
                    if (tech.spectral_balance) {
                        console.log(`    spectral_balance:`, tech.spectral_balance);
                    } else {
                        console.log(`    spectral_balance: ❌ AUSENTE`);
                    }
                    
                    // Verificar tonalBalance
                    console.log(`\n  🎵 TONAL BALANCE:`);
                    if (tech.tonalBalance) {
                        console.log(`    tonalBalance keys:`, Object.keys(tech.tonalBalance));
                    } else {
                        console.log(`    tonalBalance: ❌ AUSENTE`);
                    }
                } else {
                    console.log(`  ❌ technicalData AUSENTE no resultado`);
                }
                
                // Verificar scores
                console.log(`\n  🏆 SCORES:`);
                const scoreKeys = ['score', 'overallScore', 'qualityOverall'];
                scoreKeys.forEach(key => {
                    const value = job.result[key];
                    const status = value !== undefined ? `✅ ${value}` : '❌ AUSENTE';
                    console.log(`    ${key}: ${status}`);
                });
                
                // Verificar classification
                console.log(`\n  🏷️ CLASSIFICATION:`);
                const classification = job.result.classification;
                console.log(`    classification: ${classification !== undefined ? `✅ ${classification}` : '❌ AUSENTE'}`);
                
            } else {
                console.log(`  ❌ RESULTADO NULL`);
            }
        });
        
        // Se encontrou jobs, analise o primeiro em detalhes
        if (result.rows.length > 0) {
            const firstJob = result.rows[0];
            console.log(`\n🔬 ========== ANÁLISE DETALHADA DO JOB MAIS RECENTE ==========`);
            console.log(`Job ID: ${firstJob.id}`);
            console.log(`Resultado completo para análise de contrato:`);
            
            // Simular o que o frontend receberia via polling
            const frontendPayload = {
                id: firstJob.id,
                fileKey: firstJob.file_key,
                mode: firstJob.mode,
                status: firstJob.status,
                result: firstJob.result,
                createdAt: firstJob.created_at,
                updatedAt: firstJob.updated_at
            };
            
            console.log(`\n📤 PAYLOAD QUE O FRONTEND RECEBE:`);
            console.log(JSON.stringify(frontendPayload, null, 2));
            
            return frontendPayload;
        }
        
    } catch (error) {
        console.error("❌ Erro durante interceptação:", error);
    } finally {
        await client.end();
    }
}

// Executar interceptação
interceptRealJobData();
