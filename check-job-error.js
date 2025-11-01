#!/usr/bin/env node

import "dotenv/config";
import pkg from "pg";

const { Client } = pkg;

async function checkJobError() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Conectado ao PostgreSQL");

    // Buscar o erro do job de comparação mais recente
    const result = await client.query(`
      SELECT id, mode, status, error, file_key, reference_file_key, created_at
      FROM jobs 
      WHERE mode = 'comparison' AND status = 'failed'
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const job = result.rows[0];
      console.log("\n❌ ERRO DO JOB DE COMPARAÇÃO:");
      console.log("=====================================");
      console.log(`Job ID: ${job.id}`);
      console.log(`Status: ${job.status}`);
      console.log(`User File: ${job.file_key}`);
      console.log(`Ref File: ${job.reference_file_key}`);
      console.log(`Criado: ${job.created_at}`);
      console.log(`\nErro:`);
      console.log(job.error);
    } else {
      console.log("Nenhum job de comparação com falha encontrado.");
    }

    await client.end();

  } catch (error) {
    console.error("❌ Erro:", error.message);
  }
}

checkJobError();