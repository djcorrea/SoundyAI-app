// debug-fallback-AGORA.js - DESCOBRIR ONDE CARALHO ESTÁ FALHANDO
import "dotenv/config";
import pkg from "pg";

const { Client } = pkg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
});
await client.connect();

console.log("🔥 DEBUGANDO FALLBACK - VAMOS RESOLVER ESSA MERDA AGORA!");

// Pegar job mais recente que deveria ter análise real
const jobQuery = await client.query(`
  SELECT id, file_key, status, result, error, created_at 
  FROM jobs 
  WHERE created_at > NOW() - INTERVAL '24 hours'
  ORDER BY created_at DESC 
  LIMIT 5
`);

console.log(`\n📊 JOBS RECENTES (últimas 24h):`);
for (const job of jobQuery.rows) {
  console.log(`\n🎵 JOB: ${job.id.substring(0,8)}`);
  console.log(`   📁 File: ${job.file_key}`);
  console.log(`   📊 Status: ${job.status}`);
  console.log(`   📅 Created: ${job.created_at}`);
  
  if (job.result) {
    const result = typeof job.result === 'string' ? JSON.parse(job.result) : job.result;
    console.log(`   🎯 Score: ${result.score || 'N/A'}`);
    console.log(`   📈 Scoring Method: ${result.scoringMethod || 'N/A'}`);
    console.log(`   🔧 Engine: ${result.metadata?.engineVersion || 'N/A'}`);
    console.log(`   📊 Pipeline Phase: ${result.metadata?.pipelinePhase || 'N/A'}`);
    
    // VERIFICAR SE TEM DADOS REAIS
    if (result.technicalData) {
      const hasLUFS = result.technicalData.lufs !== undefined;
      const hasTruePeak = result.technicalData.truePeak !== undefined;
      const hasSpectral = result.technicalData.spectralBalance !== undefined;
      
      console.log(`   🎚️ LUFS Real: ${hasLUFS ? '✅ SIM' : '❌ NÃO'}`);
      console.log(`   📊 True Peak: ${hasTruePeak ? '✅ SIM' : '❌ NÃO'}`);
      console.log(`   🌈 Spectral: ${hasSpectral ? '✅ SIM' : '❌ NÃO'}`);
      
      if (hasLUFS) {
        console.log(`      🎚️ LUFS Value: ${result.technicalData.lufs}`);
      }
      if (hasTruePeak) {
        console.log(`      📊 True Peak: ${result.technicalData.truePeak}`);
      }
    }
    
    if (result._worker) {
      console.log(`   🤖 Worker Source: ${result._worker.source}`);
      console.log(`   ⚠️ Worker Error: ${result._worker.error || 'N/A'}`);
    }
    
    if (result.warnings && result.warnings.length > 0) {
      console.log(`   ⚠️ Warnings: ${result.warnings.join(', ')}`);
    }
  }
  
  if (job.error) {
    console.log(`   ❌ Error: ${job.error}`);
  }
}

// VERIFICAR WORKER STATUS NO RAILWAY
console.log(`\n🚀 VERIFICANDO SE WORKER ESTÁ VIVO...`);

// Verificar jobs em processing há muito tempo
const stuckJobs = await client.query(`
  SELECT id, file_key, status, updated_at, 
         EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_stuck
  FROM jobs 
  WHERE status = 'processing' 
  AND updated_at < NOW() - INTERVAL '5 minutes'
  ORDER BY updated_at ASC
`);

if (stuckJobs.rows.length > 0) {
  console.log(`\n🚨 JOBS TRAVADOS EM PROCESSING:`);
  for (const job of stuckJobs.rows) {
    console.log(`   💀 ${job.id.substring(0,8)} - ${Math.floor(job.minutes_stuck)} min travado`);
  }
} else {
  console.log(`\n✅ Nenhum job travado em processing`);
}

// Verificar últimos jobs que falharam
const failedJobs = await client.query(`
  SELECT id, file_key, error, updated_at
  FROM jobs 
  WHERE status = 'failed'
  AND updated_at > NOW() - INTERVAL '2 hours'
  ORDER BY updated_at DESC
  LIMIT 3
`);

if (failedJobs.rows.length > 0) {
  console.log(`\n💀 JOBS QUE FALHARAM (últimas 2h):`);
  for (const job of failedJobs.rows) {
    console.log(`   ❌ ${job.id.substring(0,8)}: ${job.error}`);
  }
}

await client.end();
console.log(`\n🎯 ANÁLISE COMPLETA - VAMOS CORRIGIR ESSA MERDA!`);