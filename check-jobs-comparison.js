#!/usr/bin/env node

import "dotenv/config";
import pkg from "pg";

const { Client } = pkg;

async function checkJobs() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Conectado ao PostgreSQL");

    // Buscar jobs recentes ordenados por data
    const result = await client.query(`
      SELECT id, mode, status, file_name, created_at, error,
             CASE 
               WHEN result IS NOT NULL THEN 'Sim' 
               ELSE 'Não' 
             END as has_result
      FROM jobs 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    console.log("\n🔍 JOBS RECENTES:");
    console.log("=====================================");
    
    result.rows.forEach((job, index) => {
      console.log(`\n${index + 1}. Job ID: ${job.id.substring(0, 8)}...`);
      console.log(`   Modo: ${job.mode}`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Nome: ${job.file_name || 'N/A'}`);
      console.log(`   Resultado: ${job.has_result}`);
      console.log(`   Criado: ${job.created_at}`);
      if (job.error) {
        console.log(`   Erro: ${job.error}`);
      }
    });

    // Verificar especificamente jobs de comparação
    const comparisonJobs = await client.query(`
      SELECT id, mode, status, file_key, reference_file_key, created_at,
             CASE 
               WHEN result IS NOT NULL THEN 'Sim' 
               ELSE 'Não' 
             END as has_result
      FROM jobs 
      WHERE mode = 'comparison'
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    console.log("\n🎧 JOBS DE COMPARAÇÃO:");
    console.log("=====================================");
    
    if (comparisonJobs.rows.length > 0) {
      comparisonJobs.rows.forEach((job, index) => {
        console.log(`\n${index + 1}. Job ID: ${job.id.substring(0, 8)}...`);
        console.log(`   Status: ${job.status}`);
        console.log(`   User File: ${job.file_key}`);
        console.log(`   Ref File: ${job.reference_file_key}`);
        console.log(`   Resultado: ${job.has_result}`);
        console.log(`   Criado: ${job.created_at}`);
      });
    } else {
      console.log("Nenhum job de comparação encontrado.");
    }

    await client.end();

  } catch (error) {
    console.error("❌ Erro:", error.message);
  }
}

checkJobs();