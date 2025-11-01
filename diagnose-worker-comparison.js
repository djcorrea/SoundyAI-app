#!/usr/bin/env node

/**
 * 🐛 DIAGNÓSTICO DETALHADO: Worker de Comparação
 * Monitora logs do worker em tempo real
 */

import "dotenv/config";
import pkg from 'pg';
const { Pool } = pkg;

const dbPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'soundyai',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'your_password',
});

async function checkWorkerLogs() {
  console.log("🔍 DIAGNÓSTICO DO WORKER - MODO COMPARAÇÃO");
  console.log("==========================================");

  try {
    console.log('\n📊 Verificando funcionalidade do import dinâmico...');
    
    // Testar import da função compareMetrics
    try {
      const { compareMetrics } = await import("./WORK/api/audio/pipeline-complete.js");
      console.log('✅ Import da compareMetrics: SUCESSO');
      
      // Testar se a função existe
      if (typeof compareMetrics === 'function') {
        console.log('✅ compareMetrics é uma função válida');
      } else {
        console.log('❌ compareMetrics não é uma função:', typeof compareMetrics);
      }
      
    } catch (importError) {
      console.log('❌ Erro no import da compareMetrics:', importError.message);
    }

    console.log('\n🗄️ Verificando jobs de comparação ativos...');
    
    const activeComparison = await dbPool.query(`
      SELECT 
        id, status, mode, file_key, reference_file_key, 
        created_at, updated_at, error
      FROM jobs 
      WHERE mode = 'comparison' 
      AND status IN ('pending', 'processing', 'failed')
      ORDER BY created_at DESC 
      LIMIT 3
    `);

    if (activeComparison.rows.length === 0) {
      console.log('ℹ️ Nenhum job de comparação ativo encontrado.');
      return;
    }

    console.log(`\n🎧 Jobs de comparação encontrados: ${activeComparison.rows.length}`);
    
    for (const job of activeComparison.rows) {
      console.log(`\n📄 Job ${job.id}:`);
      console.log(`   Status: ${job.status}`);
      console.log(`   User File: ${job.file_key}`);
      console.log(`   Ref File: ${job.reference_file_key}`);
      console.log(`   Criado: ${job.created_at}`);
      console.log(`   Atualizado: ${job.updated_at}`);
      console.log(`   Erro: ${job.error || 'Nenhum'}`);
    }

    // Verificar se temos arquivos válidos
    console.log('\n🔍 Verificando existência dos arquivos...');
    
    const latestJob = activeComparison.rows[0];
    console.log(`\n📁 Arquivos do job ${latestJob.id}:`);
    console.log(`   User: ${latestJob.file_key}`);
    console.log(`   Ref: ${latestJob.reference_file_key}`);

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error.message);
  } finally {
    await dbPool.end();
  }
}

// Executar diagnóstico
checkWorkerLogs().catch(console.error);