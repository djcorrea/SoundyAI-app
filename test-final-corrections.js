// 🧪 TESTE DAS CORREÇÕES DE LOOP INFINITO - VERIFICAÇÃO FINAL
// Script para verificar se as correções implementadas resolvem o problema

import "dotenv/config";
import pkg from "pg";
const { Client } = pkg;

// Conectar ao banco
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

console.log("🧪 Iniciando testes das correções implementadas...");

async function testFinalCorrections() {
  try {
    await client.connect();
    console.log("✅ Conectado ao banco");

    // 1. Verificar jobs blacklisted
    console.log("\n🚫 Teste 1: Verificando jobs blacklisted...");
    const blacklistedJobs = await client.query(`
      SELECT file_key, status, error, created_at 
      FROM jobs 
      WHERE error LIKE '%BLACKLISTED%'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`📊 Encontrados ${blacklistedJobs.rows.length} jobs blacklisted`);
    if (blacklistedJobs.rows.length > 0) {
      blacklistedJobs.rows.forEach(job => {
        console.log(`   - ${job.file_key}: ${job.status}`);
      });
    }

    // 2. Verificar jobs problemáticos que deveriam ser blacklisted
    console.log("\n🔍 Teste 2: Procurando jobs problemáticos ativos...");
    const problematicActive = await client.query(`
      SELECT file_key, COUNT(*) as failure_count, 
             STRING_AGG(DISTINCT status, ', ') as statuses
      FROM jobs 
      WHERE (error LIKE '%Recovered from orphaned state%' 
             OR error LIKE '%Pipeline timeout%'
             OR error LIKE '%FFmpeg%')
      AND status IN ('queued', 'processing')
      GROUP BY file_key
      HAVING COUNT(*) >= 2
      ORDER BY failure_count DESC
    `);

    if (problematicActive.rows.length > 0) {
      console.log(`⚠️ Encontrados ${problematicActive.rows.length} arquivos ainda problemáticos:`);
      problematicActive.rows.forEach(job => {
        console.log(`   - ${job.file_key}: ${job.failure_count} falhas, status: ${job.statuses}`);
      });
    } else {
      console.log("✅ Nenhum arquivo problemático ativo encontrado");
    }

    // 3. Verificar jobs órfãos atuais
    console.log("\n🔄 Teste 3: Verificando jobs órfãos atuais...");
    const orphanJobs = await client.query(`
      SELECT id, file_key, status, created_at, updated_at,
             EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_stuck
      FROM jobs 
      WHERE status = 'processing' 
      AND updated_at < NOW() - INTERVAL '5 minutes'
      ORDER BY updated_at ASC
    `);

    if (orphanJobs.rows.length > 0) {
      console.log(`⚠️ Encontrados ${orphanJobs.rows.length} jobs potencialmente órfãos:`);
      orphanJobs.rows.forEach(job => {
        const minutesStuck = parseFloat(job.minutes_stuck) || 0;
        console.log(`   - ${job.id.substring(0,8)}: ${minutesStuck.toFixed(1)}min stuck`);
      });
    } else {
      console.log("✅ Nenhum job órfão encontrado");
    }

    // 4. Status geral dos jobs recentes
    console.log("\n📊 Teste 4: Status geral dos jobs recentes...");
    const statusSummary = await client.query(`
      SELECT status, COUNT(*) as count
      FROM jobs 
      WHERE created_at > NOW() - INTERVAL '6 hours'
      GROUP BY status
      ORDER BY count DESC
    `);

    console.log("Status das últimas 6h:");
    statusSummary.rows.forEach(row => {
      console.log(`   - ${row.status}: ${row.count} jobs`);
    });

    // 5. Verificar se há loops infinitos ativos
    console.log("\n🔁 Teste 5: Detectando possíveis loops infinitos...");
    const possibleLoops = await client.query(`
      SELECT file_key, 
             COUNT(*) as total_jobs,
             COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
             COUNT(CASE WHEN status IN ('queued', 'processing') THEN 1 END) as active_jobs,
             MAX(created_at) as last_attempt
      FROM jobs 
      WHERE created_at > NOW() - INTERVAL '2 hours'
      GROUP BY file_key
      HAVING COUNT(*) > 5
      ORDER BY total_jobs DESC
    `);

    if (possibleLoops.rows.length > 0) {
      console.log(`⚠️ Possíveis loops detectados: ${possibleLoops.rows.length}`);
      possibleLoops.rows.forEach(loop => {
        console.log(`   - ${loop.file_key}: ${loop.total_jobs} jobs (${loop.active_jobs} ativos, ${loop.failed_jobs} falharam)`);
      });
    } else {
      console.log("✅ Nenhum loop infinito detectado");
    }

    console.log("\n🎯 AVALIAÇÃO FINAL:");
    
    const totalBlacklisted = blacklistedJobs.rows.length;
    const activeProblematic = problematicActive.rows.length;
    const currentOrphans = orphanJobs.rows.length;
    const possibleLoopsCount = possibleLoops.rows.length;

    let score = 0;
    let maxScore = 4;

    if (totalBlacklisted > 0) {
      console.log("✅ Sistema de blacklist está funcionando");
      score++;
    } else {
      console.log("⚠️ Nenhum job blacklisted encontrado (pode estar OK se não houve problemas)");
    }

    if (activeProblematic === 0) {
      console.log("✅ Não há jobs problemáticos ativos");
      score++;
    } else {
      console.log(`❌ ${activeProblematic} jobs problemáticos ainda ativos`);
    }

    if (currentOrphans === 0) {
      console.log("✅ Não há jobs órfãos atuais");
      score++;
    } else {
      console.log(`❌ ${currentOrphans} jobs órfãos detectados`);
    }

    if (possibleLoopsCount === 0) {
      console.log("✅ Nenhum loop infinito detectado");
      score++;
    } else {
      console.log(`❌ ${possibleLoopsCount} possíveis loops ainda ativos`);
    }

    console.log(`\n📈 SCORE: ${score}/${maxScore}`);

    if (score === maxScore) {
      console.log("🎉 CORREÇÕES TOTALMENTE EFETIVAS!");
      console.log("   Sistema está estável e sem loops infinitos");
    } else if (score >= maxScore * 0.75) {
      console.log("✅ CORREÇÕES MAJORITARIAMENTE EFETIVAS");
      console.log("   Sistema melhorou significativamente");
    } else {
      console.log("⚠️ CORREÇÕES PARCIAIS");
      console.log("   Ainda há problemas que precisam de atenção");
    }

  } catch (error) {
    console.error("❌ Erro no teste:", error.message);
  } finally {
    await client.end();
  }
}

// Executar testes
testFinalCorrections().catch(console.error);