// debug-campos-postgres.js - Ver exatamente quais campos estão sendo salvos

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function debugCamposPostgres() {
    try {
        console.log('🔍 DEBUG: Campos salvos no PostgreSQL...\n');
        
        const result = await pool.query(`
            SELECT id, file_name, created_at, result
            FROM jobs 
            WHERE result IS NOT NULL
            ORDER BY created_at DESC 
            LIMIT 2
        `);
        
        result.rows.forEach((job, index) => {
            console.log(`🔍 [${index + 1}] Job ID: ${job.id}`);
            console.log(`📁 Arquivo: ${job.file_name}`);
            console.log(`📅 Data: ${new Date(job.created_at).toLocaleString()}`);
            
            if (job.result) {
                const campos = Object.keys(job.result).sort();
                console.log(`📊 Total de campos: ${campos.length}`);
                console.log('📋 Campos presentes:');
                
                campos.forEach((campo, i) => {
                    const valor = job.result[campo];
                    let valorInfo = '';
                    
                    if (typeof valor === 'number') {
                        valorInfo = `= ${Math.round(valor * 1000) / 1000}`;
                    } else if (typeof valor === 'boolean') {
                        valorInfo = `= ${valor}`;
                    } else if (typeof valor === 'string') {
                        valorInfo = `= "${valor.length > 20 ? valor.substring(0, 20) + '...' : valor}"`;
                    } else if (typeof valor === 'object' && valor !== null) {
                        if (Array.isArray(valor)) {
                            valorInfo = `= Array[${valor.length}]`;
                        } else {
                            valorInfo = `= Object{${Object.keys(valor).length} keys}`;
                        }
                    } else {
                        valorInfo = `= ${valor}`;
                    }
                    
                    console.log(`├─ [${String(i + 1).padStart(2, '0')}] ${campo} ${valorInfo}`);
                });
            }
            
            console.log(''); // linha em branco
        });
        
        await pool.end();
        
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

debugCamposPostgres();