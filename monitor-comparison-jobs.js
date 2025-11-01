#!/usr/bin/env node

/**
 * 🚨 MONITORAMENTO REAL-TIME: Jobs de Comparação
 * Monitora jobs em tempo real
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

let lastCheckedTime = new Date();

async function monitorJobs() {
  try {
    // Buscar jobs atualizados desde a última verificação
    const result = await dbPool.query(`
      SELECT 
        id, status, mode, file_key, reference_file_key, 
        created_at, updated_at, error,
        CASE 
          WHEN result IS NOT NULL THEN 'Sim'
          ELSE 'Não'
        END as has_result
      FROM jobs 
      WHERE mode = 'comparison' 
        AND updated_at > $1
      ORDER BY updated_at DESC 
      LIMIT 5
    `, [lastCheckedTime]);

    if (result.rows.length > 0) {
      console.log(`\n🔔 [${new Date().toISOString()}] NOVOS UPDATES:`);
      console.log("=====================================");
      
      for (const job of result.rows) {
        console.log(`📄 Job ${job.id.substring(0, 8)}...`);
        console.log(`   Status: ${job.status}`);
        console.log(`   User: ${path.basename(job.file_key)}`);
        console.log(`   Ref: ${path.basename(job.reference_file_key)}`);
        console.log(`   Resultado: ${job.has_result}`);
        console.log(`   Erro: ${job.error || 'Nenhum'}`);
        console.log(`   Atualizado: ${job.updated_at}`);
        console.log("");
      }
      
      lastCheckedTime = new Date();
    }
    
  } catch (error) {
    console.error('❌ Erro no monitoramento:', error.message);
  }
}

console.log("🔍 MONITOR DE JOBS DE COMPARAÇÃO");
console.log("================================");
console.log("🚀 Monitoring iniciado... (CTRL+C para parar)");
console.log(`⏰ Última verificação: ${lastCheckedTime.toISOString()}`);

// Executar a cada 2 segundos
const interval = setInterval(monitorJobs, 2000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Parando monitor...');
  clearInterval(interval);
  dbPool.end();
  process.exit(0);
});

// Import necessário para path
import path from 'path';