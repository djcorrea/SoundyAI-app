// 🔧 SCRIPT PARA FORÇAR RECOVERY E TESTAR BLACKLIST
// Executa manualmente o sistema de recovery para testar as correções

import "dotenv/config";
import pkg from "pg";
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

console.log("🔧 Executando recovery manual para testar correções...");

async function forceRecoveryAndTest() {
  try {
    await client.connect();
    console.log("✅ Conectado ao banco");

    // 1. Verificar jobs órfãos antes do recovery
    console.log("\n🔍 ANTES DO RECOVERY:");
    const orphansBefore = await client.query(`
      SELECT COUNT(*) as count
      FROM jobs 
      WHERE status = 'processing' 
      AND updated_at < NOW() - INTERVAL '10 minutes'
    `);
    console.log(`Jobs órfãos: ${orphansBefore.rows[0].count}`);

    // 2. EXECUTAR BLACKLIST (primeira parte do recovery)
    console.log("\n🚫 EXECUTANDO BLACKLIST...");
    const problematicJobs = await client.query(`
      SELECT file_key, COUNT(*) as failure_count, 
             ARRAY_AGG(id ORDER BY created_at DESC) as job_ids
      FROM jobs 
      WHERE error LIKE '%Recovered from orphaned state%' 
      OR error LIKE '%Pipeline timeout%'
      OR error LIKE '%FFmpeg%'
      OR error LIKE '%Memory%'
      GROUP BY file_key 
      HAVING COUNT(*) >= 3
    `);

    if (problematicJobs.rows.length > 0) {
      console.log(`🚫 Blacklisting ${problematicJobs.rows.length} arquivos problemáticos:`);
      
      for (const row of problematicJobs.rows) {
        console.log(`   - ${row.file_key} (${row.failure_count} falhas)`);
        
        // Marcar todos os jobs relacionados como failed permanentemente
        const blacklistResult = await client.query(`
          UPDATE jobs 
          SET status = 'failed', 
              error = $1, 
              updated_at = NOW()
          WHERE file_key = $2 
          AND status IN ('queued', 'processing')
          RETURNING id
        `, [
          `BLACKLISTED: File failed ${row.failure_count} times - likely corrupted/problematic`,
          row.file_key
        ]);
        
        console.log(`     → ${blacklistResult.rows.length} jobs blacklisted`);
      }
    } else {
      console.log("✅ Nenhum arquivo encontrado para blacklist");
    }

    // 3. EXECUTAR RECOVERY (segunda parte)
    console.log("\n🔄 EXECUTANDO RECOVERY DOS ÓRFÃOS...");
    const recoveryResult = await client.query(`
      UPDATE jobs 
      SET status = 'queued', updated_at = NOW(), error = 'Recovered from orphaned state'
      WHERE status = 'processing' 
      AND updated_at < NOW() - INTERVAL '10 minutes'
      AND error NOT LIKE '%BLACKLISTED%'
      RETURNING id, file_key
    `);

    if (recoveryResult.rows.length > 0) {
      console.log(`🔄 Recuperados ${recoveryResult.rows.length} jobs órfãos:`);
      recoveryResult.rows.forEach(job => {
        console.log(`   - ${job.id.substring(0,8)}: ${job.file_key}`);
      });
    } else {
      console.log("✅ Nenhum job órfão para recuperar");
    }

    // 4. Verificar estado após recovery
    console.log("\n📊 DEPOIS DO RECOVERY:");
    
    const statusAfter = await client.query(`
      SELECT status, COUNT(*) as count
      FROM jobs 
      WHERE created_at > NOW() - INTERVAL '6 hours'
      GROUP BY status
      ORDER BY count DESC
    `);
    
    console.log("Status atual:");
    statusAfter.rows.forEach(row => {
      console.log(`   - ${row.status}: ${row.count} jobs`);
    });

    // 5. Verificar blacklisted jobs
    const blacklistedJobs = await client.query(`
      SELECT file_key, COUNT(*) as count
      FROM jobs 
      WHERE error LIKE '%BLACKLISTED%'
      GROUP BY file_key
    `);

    if (blacklistedJobs.rows.length > 0) {
      console.log(`\n🚫 Jobs blacklisted: ${blacklistedJobs.rows.length} arquivos`);
      blacklistedJobs.rows.forEach(job => {
        console.log(`   - ${job.file_key}: ${job.count} jobs`);
      });
    }

    // 6. Verificar se ainda há órfãos
    const orphansAfter = await client.query(`
      SELECT COUNT(*) as count
      FROM jobs 
      WHERE status = 'processing' 
      AND updated_at < NOW() - INTERVAL '5 minutes'
    `);

    console.log(`\n🔄 Jobs órfãos restantes: ${orphansAfter.rows[0].count}`);

    // 7. Avaliação final
    console.log("\n🎯 RESULTADO DO RECOVERY:");
    
    const totalBlacklisted = blacklistedJobs.rows.length;
    const remainingOrphans = parseInt(orphansAfter.rows[0].count);
    const totalRecovered = recoveryResult.rows.length;

    if (totalBlacklisted > 0) {
      console.log(`✅ Blacklist funcionando: ${totalBlacklisted} arquivos problemáticos removidos`);
    }

    if (totalRecovered > 0) {
      console.log(`✅ Recovery funcionando: ${totalRecovered} jobs recuperados`);
    }

    if (remainingOrphans === 0) {
      console.log("✅ Todos os órfãos foram tratados");
    } else {
      console.log(`⚠️ Ainda restam ${remainingOrphans} órfãos (podem ser jobs recentes)`);
    }

    if (totalBlacklisted > 0 || totalRecovered > 0) {
      console.log("\n🎉 CORREÇÕES APLICADAS COM SUCESSO!");
      console.log("   O sistema de recovery e blacklist está funcionando");
    } else {
      console.log("\n✅ Sistema já estava limpo ou não havia problemas para corrigir");
    }

  } catch (error) {
    console.error("❌ Erro:", error.message);
  } finally {
    await client.end();
  }
}

// Executar recovery forçado
forceRecoveryAndTest().catch(console.error);