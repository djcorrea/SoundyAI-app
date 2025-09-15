// debug-objetos-aninhados.js - Ver conteúdo dos objetos spectral e technicalData

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function debugObjetosAninhados() {
    try {
        console.log('🔍 DEBUG: Conteúdo dos objetos spectral e technicalData...\n');
        
        const result = await pool.query(`
            SELECT id, file_name, result
            FROM jobs 
            WHERE result IS NOT NULL
            ORDER BY created_at DESC 
            LIMIT 1
        `);
        
        const job = result.rows[0];
        console.log(`🔍 Job ID: ${job.id}`);
        console.log(`📁 Arquivo: ${job.file_name}\n`);
        
        if (job.result) {
            // 1. Verificar objeto spectral
            if (job.result.spectral) {
                console.log('🎵 OBJETO SPECTRAL:');
                console.log(JSON.stringify(job.result.spectral, null, 2));
                console.log('');
            }
            
            // 2. Verificar objeto spectralBands
            if (job.result.spectralBands) {
                console.log('🎶 OBJETO SPECTRAL BANDS:');
                console.log(JSON.stringify(job.result.spectralBands, null, 2));
                console.log('');
            }
            
            // 3. Verificar objeto technicalData (primeiros 20 campos)
            if (job.result.technicalData) {
                console.log('🔧 OBJETO TECHNICAL DATA (primeiros campos):');
                const technicalKeys = Object.keys(job.result.technicalData).slice(0, 20);
                const technicalSample = {};
                technicalKeys.forEach(key => {
                    technicalSample[key] = job.result.technicalData[key];
                });
                console.log(JSON.stringify(technicalSample, null, 2));
                console.log('');
                
                // Buscar especificamente por métricas espectrais no technicalData
                const spectralKeysFound = Object.keys(job.result.technicalData).filter(key => 
                    key.includes('spectral') || 
                    key.includes('Spectral') ||
                    key.includes('frequency') ||
                    key.includes('Frequency') ||
                    key.includes('band') ||
                    key.includes('Band')
                );
                
                if (spectralKeysFound.length > 0) {
                    console.log('🎯 MÉTRICAS ESPECTRAIS ENCONTRADAS NO TECHNICAL DATA:');
                    spectralKeysFound.forEach(key => {
                        console.log(`├─ ${key}: ${job.result.technicalData[key]}`);
                    });
                    console.log('');
                }
            }
            
            // 4. Buscar pelos campos específicos que esperamos
            const metricasEsperadas = [
                'spectralCentroidHz', 'spectralRolloffHz', 'spectralFlatness',
                'frequenciaCentral', 'limiteAgudos85', 'bandEnergies'
            ];
            
            console.log('🎯 BUSCA POR MÉTRICAS ESPERADAS:');
            
            // Buscar no nível raiz
            const encontradasRaiz = metricasEsperadas.filter(m => job.result[m] !== undefined);
            if (encontradasRaiz.length > 0) {
                console.log(`✅ No nível raiz: ${encontradasRaiz.join(', ')}`);
            }
            
            // Buscar no spectral
            if (job.result.spectral) {
                const encontradasSpectral = metricasEsperadas.filter(m => job.result.spectral[m] !== undefined);
                if (encontradasSpectral.length > 0) {
                    console.log(`✅ Em spectral: ${encontradasSpectral.join(', ')}`);
                }
            }
            
            // Buscar no technicalData
            if (job.result.technicalData) {
                const encontradasTechnical = metricasEsperadas.filter(m => job.result.technicalData[m] !== undefined);
                if (encontradasTechnical.length > 0) {
                    console.log(`✅ Em technicalData: ${encontradasTechnical.join(', ')}`);
                }
            }
            
            console.log('');
        }
        
        await pool.end();
        
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

debugObjetosAninhados();