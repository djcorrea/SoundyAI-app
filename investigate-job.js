// 🔍 INVESTIGAR JOB ESPECÍFICO
// Verifica detalhes do job que acabou de falhar

import "dotenv/config";
import pkg from "pg";
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

console.log("🔍 Investigando job mais recente...");

async function investigateRecentJob() {
  try {
    await client.connect();
    console.log("✅ Conectado ao banco");

    // Verificar o job mais recente
    const recentJob = await client.query(`
      SELECT id, file_key, file_name, status, error, result, created_at, updated_at
      FROM jobs 
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    if (recentJob.rows.length > 0) {
      const job = recentJob.rows[0];
      console.log("\n📊 JOB MAIS RECENTE:");
      console.log(`   ID: ${job.id}`);
      console.log(`   File: ${job.file_name || job.file_key}`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Criado: ${job.created_at}`);
      console.log(`   Atualizado: ${job.updated_at}`);
      
      if (job.error) {
        console.log(`   ❌ Erro: ${job.error}`);
      }
      
      if (job.result) {
        console.log("\n📋 RESULTADO:");
        const result = typeof job.result === 'string' ? JSON.parse(job.result) : job.result;
        console.log(`   Score: ${result.score}`);
        console.log(`   Classification: ${result.classification}`);
        console.log(`   Scoring Method: ${result.scoringMethod}`);
        
        if (result.error) {
          console.log(`   ❌ Erro no resultado: ${JSON.stringify(result.error, null, 2)}`);
        }
        
        if (result.metadata) {
          console.log(`   📊 Metadata: ${JSON.stringify(result.metadata, null, 2)}`);
        }
        
        console.log("\n🔍 DIAGNÓSTICO:");
        
        if (result.score === 0) {
          console.log("❌ Score 0 indica falha no processamento");
        }
        
        if (result.classification === 'Erro Crítico') {
          console.log("❌ Classificação de erro crítico");
        }
        
        if (result.scoringMethod?.includes('fallback')) {
          console.log("❌ Método de scoring é fallback - pipeline falhou");
        }
        
        if (result.frontendCompatible === false) {
          console.log("❌ Não é compatível com frontend");
        }
      }
    }

    // Verificar jobs com erro nas últimas 2 horas
    console.log("\n🔍 JOBS COM ERRO RECENTES:");
    const errorJobs = await client.query(`
      SELECT id, file_name, status, error, created_at
      FROM jobs 
      WHERE created_at > NOW() - INTERVAL '2 hours'
      AND (status = 'failed' OR error IS NOT NULL)
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (errorJobs.rows.length > 0) {
      errorJobs.rows.forEach(job => {
        console.log(`   - ${job.id.substring(0,8)}: ${job.status} - ${job.error?.substring(0, 100)}...`);
      });
    } else {
      console.log("   ✅ Nenhum job com erro encontrado");
    }

    // Verificar se o worker está rodando
    console.log("\n💓 VERIFICAR WORKER:");
    const processingJobs = await client.query(`
      SELECT id, created_at, updated_at,
             EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_ago
      FROM jobs 
      WHERE status = 'processing'
      ORDER BY updated_at DESC
    `);

    if (processingJobs.rows.length > 0) {
      console.log(`   ⚠️ ${processingJobs.rows.length} jobs em processing:`);
      processingJobs.rows.forEach(job => {
        const minutesAgo = parseFloat(job.minutes_ago) || 0;
        console.log(`   - ${job.id.substring(0,8)}: ${minutesAgo.toFixed(1)}min atrás`);
      });
    } else {
      console.log("   ✅ Nenhum job em processing");
    }

  } catch (error) {
    console.error("❌ Erro:", error.message);
  } finally {
    await client.end();
  }
}

investigateRecentJob().catch(console.error);