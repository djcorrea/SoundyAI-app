// inserir-job-teste.js - Inserir job diretamente no PostgreSQL para forçar processamento

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function inserirJobTeste() {
    try {
        console.log('🔍 Inserindo job de teste no PostgreSQL...');
        
        // Inserir job de teste com arquivo que vai falhar (para demonstrar o processo)
        const query = `
            INSERT INTO jobs (id, file_key, status, mode, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            RETURNING id, file_key, status
        `;
        
        const jobId = `550e8400-e29b-41d4-a716-${Date.now().toString().substring(0, 12)}`;
        const fileKey = 'test-debug-file.wav'; // Arquivo que não existe, mas vai demonstrar o fluxo
        
        const result = await pool.query(query, [
            jobId,
            fileKey,
            'queued',
            'genre'
        ]);
        
        console.log('✅ Job de teste inserido:', result.rows[0]);
        console.log('📊 O worker deve pegar este job em ~5 segundos...');
        console.log('🔍 Aguarde logs do worker para ver o debug do core-metrics');
        
        await pool.end();
        
    } catch (error) {
        console.error('❌ Erro ao inserir job:', error);
        process.exit(1);
    }
}

inserirJobTeste();