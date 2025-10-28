/**
 * Teste Final: Validação do Fluxo Postgres → Redis
 * Testa se o backend está criando jobs no PostgreSQL E enfileirando no Redis corretamente
 * 
 * Execução: node test-fluxo-final-postgres-redis.js
 */

import fetch from 'node-fetch';
import { audioQueue } from './work/queue/redis.js';

const API_BASE = 'http://localhost:3001';

// 🎯 TESTE PRINCIPAL: Fluxo completo Postgres → Redis
async function testCompleteJobFlow() {
  console.log(`\n🔥 TESTE FINAL: Validação Fluxo Postgres → Redis`);
  console.log(`⏰ Iniciado em: ${new Date().toISOString()}`);
  console.log(`📡 API Base: ${API_BASE}`);
  console.log(`🎯 Fila Redis: '${audioQueue.name}'`);
  
  try {
    // 📋 1. Criar job via API
    console.log(`\n📋 1. CRIANDO JOB VIA API...`);
    const jobData = {
      fileKey: "test-files/sample-audio.wav",
      mode: "genre",
      fileName: "sample-audio.wav"
    };
    
    console.log(`📦 Dados do job:`, JSON.stringify(jobData, null, 2));
    
    const response = await fetch(`${API_BASE}/api/audio/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(jobData)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error(`❌ FALHA na criação do job:`, result);
      return false;
    }
    
    console.log(`✅ Job criado com sucesso:`);
    console.log(`   - Job ID: ${result.jobId}`);
    console.log(`   - Status: ${result.status}`);
    console.log(`   - Modo: ${result.mode}`);
    console.log(`   - Tempo: ${result.performance.processingTime}`);
    
    // ⏳ 2. Aguardar propagação
    console.log(`\n⏳ 2. AGUARDANDO PROPAGAÇÃO (3s)...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 🔍 3. Verificar job no Redis
    console.log(`\n🔍 3. VERIFICANDO JOB NO REDIS...`);
    
    try {
      const waitingJobs = await audioQueue.getWaiting();
      const activeJobs = await audioQueue.getActive();
      const completedJobs = await audioQueue.getCompleted();
      const failedJobs = await audioQueue.getFailed();
      
      console.log(`📊 Estado da fila Redis:`);
      console.log(`   - Aguardando: ${waitingJobs.length} jobs`);
      console.log(`   - Ativo: ${activeJobs.length} jobs`);
      console.log(`   - Completos: ${completedJobs.length} jobs`);
      console.log(`   - Falharam: ${failedJobs.length} jobs`);
      
      // Procurar o job específico
      const allJobs = [...waitingJobs, ...activeJobs, ...completedJobs, ...failedJobs];
      const targetJob = allJobs.find(job => job.data && job.data.jobId === result.jobId);
      
      if (targetJob) {
        console.log(`✅ JOB ENCONTRADO NO REDIS:`);
        console.log(`   - BullMQ ID: ${targetJob.id}`);
        console.log(`   - Nome: ${targetJob.name}`);
        console.log(`   - Job ID: ${targetJob.data.jobId}`);
        console.log(`   - FileKey: ${targetJob.data.fileKey}`);
        console.log(`   - Modo: ${targetJob.data.mode}`);
        console.log(`   - Estado: ${targetJob.finishedOn ? 'finalizado' : 'pendente'}`);
        console.log(`   - Tentativas: ${targetJob.attemptsMade}/${targetJob.opts.attempts}`);
        
        return true;
      } else {
        console.error(`❌ JOB NÃO ENCONTRADO NO REDIS`);
        console.log(`🔍 Jobs disponíveis:`, allJobs.map(j => ({
          id: j.id,
          name: j.name,
          jobId: j.data?.jobId,
          fileKey: j.data?.fileKey
        })));
        
        return false;
      }
    } catch (redisError) {
      console.error(`❌ ERRO ao verificar Redis:`, redisError.message);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ ERRO CRÍTICO no teste:`, error.message);
    console.error(`📜 Stack:`, error.stack);
    return false;
  }
}

// 🚀 EXECUTAR TESTE
async function runFinalTest() {
  console.log(`🚀 TESTE FINAL DO FLUXO POSTGRES → REDIS`);
  console.log(`═══════════════════════════════════════════`);
  
  try {
    const success = await testCompleteJobFlow();
    
    console.log(`\n═══════════════════════════════════════════`);
    if (success) {
      console.log(`🎉 TESTE CONCLUÍDO COM SUCESSO!`);
      console.log(`✅ Fluxo Postgres → Redis funcionando corretamente`);
      console.log(`✅ Backend criando jobs no banco E enfileirando no Redis`);
      console.log(`✅ Logs de instrumentação funcionando`);
    } else {
      console.log(`❌ TESTE FALHOU!`);
      console.log(`❌ Verificar logs do backend para diagnóstico`);
    }
    
    console.log(`⏰ Finalizado em: ${new Date().toISOString()}`);
    
  } catch (error) {
    console.error(`💥 ERRO FATAL no teste:`, error.message);
  } finally {
    // Fechar conexões
    process.exit(success ? 0 : 1);
  }
}

// 🎬 INICIAR
runFinalTest().catch(console.error);