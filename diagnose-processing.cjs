require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function diagnoseProcessing() {
  try {
    console.log('🔍 DIAGNÓSTICO COMPLETO - PROCESSAMENTO TRAVADO');
    console.log('============================================\n');
    
    // 1. Jobs em processing há mais tempo
    console.log('1️⃣ JOBS EM PROCESSING (ordenados por tempo):');
    const processingJobs = await pool.query(`
      SELECT id, status, created_at, updated_at, file_key, error, 
             EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as minutes_since_created,
             EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 as minutes_since_updated
      FROM jobs 
      WHERE status = 'processing' 
      ORDER BY created_at ASC
    `);
    
    if (processingJobs.rows.length === 0) {
      console.log('✅ Nenhum job em processing travado');
    } else {
      processingJobs.rows.forEach(job => {
        console.log(`   📊 Job: ${job.id}`);
        console.log(`      📁 Arquivo: ${job.file_key}`);
        console.log(`      ⏱️ Criado há: ${parseFloat(job.minutes_since_created || 0).toFixed(1)} minutos`);
        console.log(`      🔄 Última atualização há: ${parseFloat(job.minutes_since_updated || 0).toFixed(1)} minutos`);
        console.log(`      ❌ Erro: ${job.error || 'nenhum'}`);
        console.log('');
      });
    }
    
    // 2. Últimos jobs concluídos para comparação
    console.log('2️⃣ ÚLTIMOS JOBS CONCLUÍDOS (para comparação):');
    const completedJobs = await pool.query(`
      SELECT id, status, created_at, completed_at, file_key,
             EXTRACT(EPOCH FROM (completed_at - created_at)) as processing_seconds
      FROM jobs 
      WHERE status IN ('done', 'completed') 
      ORDER BY completed_at DESC 
      LIMIT 5
    `);
    
    completedJobs.rows.forEach(job => {
      console.log(`   ✅ Job: ${job.id}`);
      console.log(`      📁 Arquivo: ${job.file_key}`);
      console.log(`      ⏱️ Tempo de processamento: ${job.processing_seconds ? parseFloat(job.processing_seconds).toFixed(1) : 'N/A'}s`);
      console.log(`      📅 Concluído: ${job.completed_at}`);
      console.log('');
    });
    
    // 3. Jobs que falharam recentemente
    console.log('3️⃣ JOBS QUE FALHARAM RECENTEMENTE:');
    const failedJobs = await pool.query(`
      SELECT id, status, created_at, updated_at, file_key, error
      FROM jobs 
      WHERE status IN ('failed', 'error') 
      ORDER BY updated_at DESC 
      LIMIT 3
    `);
    
    if (failedJobs.rows.length === 0) {
      console.log('✅ Nenhum job falhou recentemente');
    } else {
      failedJobs.rows.forEach(job => {
        console.log(`   ❌ Job: ${job.id}`);
        console.log(`      📁 Arquivo: ${job.file_key}`);
        console.log(`      🔄 Atualizado: ${job.updated_at}`);
        console.log(`      💥 Erro: ${job.error}`);
        console.log('');
      });
    }
    
    // 4. Estatísticas gerais por tempo
    console.log('4️⃣ ESTATÍSTICAS DE TEMPO DE PROCESSAMENTO:');
    const timeStats = await pool.query(`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_processing_seconds,
        MAX(EXTRACT(EPOCH FROM (completed_at - created_at))) as max_processing_seconds,
        MIN(EXTRACT(EPOCH FROM (completed_at - created_at))) as min_processing_seconds,
        COUNT(*) as completed_jobs
      FROM jobs 
      WHERE status IN ('done', 'completed') 
      AND completed_at IS NOT NULL
      AND created_at > NOW() - INTERVAL '24 hours'
    `);
    
    if (timeStats.rows[0].completed_jobs > 0) {
      const stats = timeStats.rows[0];
      console.log(`   📊 Jobs concluídos (24h): ${stats.completed_jobs}`);
      console.log(`   ⏱️ Tempo médio: ${parseFloat(stats.avg_processing_seconds || 0).toFixed(1)}s`);
      console.log(`   🏃 Mais rápido: ${parseFloat(stats.min_processing_seconds || 0).toFixed(1)}s`);
      console.log(`   🐌 Mais lento: ${parseFloat(stats.max_processing_seconds || 0).toFixed(1)}s`);
    } else {
      console.log('   ⚠️ Nenhum job concluído nas últimas 24h');
    }
    
    console.log('\n============================================');
    console.log('🎯 ANÁLISE:');
    
    if (processingJobs.rows.length > 0) {
      const oldestJob = processingJobs.rows[0];
      if (parseFloat(oldestJob.minutes_since_updated || 0) > 10) {
        console.log('🚨 PROBLEMA IDENTIFICADO: Job travado há mais de 10 minutos');
        console.log(`   📊 Job mais antigo: ${parseFloat(oldestJob.minutes_since_updated || 0).toFixed(1)} min sem atualização`);
        console.log('   🔧 CAUSAS POSSÍVEIS:');
        console.log('      - Worker Railway não está rodando');
        console.log('      - Pipeline travou em alguma fase (FFT, LUFS, True Peak)');
        console.log('      - Problema de memória/CPU no Railway');
        console.log('      - Arquivo corrompido/muito grande');
        console.log('      - FFmpeg não conseguiu decodificar');
      } else {
        console.log('✅ Jobs em processing parecem estar progredindo normalmente');
      }
    }
    
    await pool.end();
  } catch (err) {
    console.error('❌ Erro no diagnóstico:', err.message);
    await pool.end();
  }
}

diagnoseProcessing();
