// LIMPEZA EMERGENCIAL DE JOBS ÓRFÃOS
// Para resolver jobs presos em "processing" que impedem análise real

require("dotenv/config");
const { Client } = require("pg");

async function cleanOrphanedJobs() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });
  
  try {
    await client.connect();
    console.log("✅ Conectado ao banco para limpeza");

    // 1. Verificar jobs órfãos (em processing há mais de 10 minutos)
    const orphanedJobs = await client.query(`
      SELECT id, file_key, created_at, updated_at, 
             EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_stuck
      FROM jobs 
      WHERE status = 'processing' 
      AND updated_at < NOW() - INTERVAL '10 minutes'
      ORDER BY updated_at ASC
    `);

    console.log(`🔍 Encontrados ${orphanedJobs.rows.length} jobs órfãos:`);
    
    for (const job of orphanedJobs.rows) {
      console.log(`  - ${job.id.substring(0,8)}: ${job.file_key} (${Math.round(job.minutes_stuck)} min presos)`);
    }

    if (orphanedJobs.rows.length === 0) {
      console.log("✅ Nenhum job órfão encontrado");
      return;
    }

    // 2. Resetar jobs órfãos para queued
    const resetResult = await client.query(`
      UPDATE jobs 
      SET status = 'queued', 
          updated_at = NOW(), 
          error = 'Auto-recovered from orphaned processing state'
      WHERE status = 'processing' 
      AND updated_at < NOW() - INTERVAL '10 minutes'
      RETURNING id, file_key
    `);

    console.log(`🔄 Resetados ${resetResult.rows.length} jobs para queued`);
    
    for (const job of resetResult.rows) {
      console.log(`  ✅ ${job.id.substring(0,8)}: ${job.file_key}`);
    }

    // 3. Verificar status final
    const statusCheck = await client.query(`
      SELECT status, COUNT(*) as count
      FROM jobs 
      GROUP BY status
      ORDER BY status
    `);

    console.log(`📊 Status final dos jobs:`);
    for (const row of statusCheck.rows) {
      console.log(`  - ${row.status}: ${row.count}`);
    }

  } catch (error) {
    console.error("❌ Erro na limpeza:", error);
  } finally {
    await client.end();
  }
}

// Executar limpeza
cleanOrphanedJobs()
  .then(() => {
    console.log("\n✅ Limpeza concluída. Agora os novos jobs devem ser processados corretamente!");
    process.exit(0);
  })
  .catch(error => {
    console.error("❌ Falha na limpeza:", error);
    process.exit(1);
  });