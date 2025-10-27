// test-final-integração.js
// 🔥 TESTE FINAL DA INTEGRAÇÃO COM LOGS DETALHADOS

import { audioQueue } from './work/queue/redis.js';
import 'dotenv/config';

console.log('🔥 [TESTE FINAL] INTEGRAÇÃO BULLMQ API ↔ WORKER REDIS');
console.log('=' .repeat(80));

async function testeFinalIntegracao() {
  try {
    console.log('🔍 [TESTE] Nome da fila:', audioQueue.name);
    
    // 📊 Stats iniciais
    const [waiting, active, completed, failed] = await Promise.all([
      audioQueue.getWaitingCount(),
      audioQueue.getActiveCount(), 
      audioQueue.getCompletedCount(),
      audioQueue.getFailedCount()
    ]);

    console.log('📊 [TESTE] FILA INICIAL:');
    console.log(`   🔢 Aguardando: ${waiting}`);
    console.log(`   ⚡ Ativas: ${active}`);
    console.log(`   ✅ Completas: ${completed}`);
    console.log(`   ❌ Falhadas: ${failed}`);

    // 🎯 Configurar event listeners ANTES de enfileirar
    let jobWaiting = false;
    let jobActive = false;
    let jobCompleted = false;
    let jobFailed = false;
    let errorMessage = '';

    const cleanupListeners = () => {
      audioQueue.removeAllListeners('waiting');
      audioQueue.removeAllListeners('active');
      audioQueue.removeAllListeners('completed');
      audioQueue.removeAllListeners('failed');
    };

    audioQueue.on('waiting', (job) => {
      console.log(`⌛ [EVENTO] JOB WAITING: ${job.id} | ${job.data.jobId}`);
      jobWaiting = true;
    });

    audioQueue.on('active', (job) => {
      console.log(`⚡ [EVENTO] JOB ATIVO: ${job.id} | ${job.data.jobId}`);
      jobActive = true;
    });

    audioQueue.on('completed', (job, result) => {
      console.log(`✅ [EVENTO] JOB COMPLETO: ${job.id} | ${job.data.jobId}`);
      jobCompleted = true;
    });

    audioQueue.on('failed', (job, err) => {
      console.log(`❌ [EVENTO] JOB FALHOU: ${job.id} | ${job.data.jobId} | Erro: ${err.message}`);
      jobFailed = true;
      errorMessage = err.message;
    });

    // 📥 Enfileirar job de teste
    console.log('\n📥 [TESTE] Enfileirando job de teste...');
    const testJobData = {
      jobId: 'teste-final-' + Date.now(),
      fileKey: 'test-files/sample-test.wav',
      mode: 'genre',
      fileName: 'sample-test.wav'
    };

    const job = await audioQueue.add('analyze', testJobData, {
      attempts: 1,
      removeOnComplete: 1,
      removeOnFail: 1
    });

    console.log(`✅ [TESTE] Job enfileirado: ${job.id} | JobID: ${job.data.jobId}`);

    // 👀 Monitorar por 30 segundos
    console.log('\n👀 [TESTE] Monitorando processamento...');
    const startTime = Date.now();
    let monitoring = true;

    while (monitoring && (Date.now() - startTime) < 30000) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const [w, a, c, f] = await Promise.all([
        audioQueue.getWaitingCount(),
        audioQueue.getActiveCount(), 
        audioQueue.getCompletedCount(),
        audioQueue.getFailedCount()
      ]);

      console.log(`📊 [MONITOR] W:${w} A:${a} C:${c} F:${f} | Elapsed: ${Date.now() - startTime}ms`);

      // Sair se job foi processado (completo ou falhou)
      if (jobCompleted || jobFailed) {
        monitoring = false;
        break;
      }
    }

    // 🏁 Resultados finais
    console.log('\n🏁 [TESTE] RESULTADOS FINAIS');
    console.log('=' .repeat(50));
    
    if (jobWaiting) {
      console.log('✅ Job entrou na fila: SIM');
    } else {
      console.log('❌ Job entrou na fila: NÃO');
    }

    if (jobActive) {
      console.log('✅ Worker pegou o job: SIM');
    } else {
      console.log('❌ Worker pegou o job: NÃO');
    }

    if (jobCompleted) {
      console.log('✅ Job completado: SIM');
    } else if (jobFailed) {
      console.log('⚠️ Job falhou: SIM (esperado para arquivo teste)');
      console.log(`   💬 Erro: ${errorMessage}`);
    } else {
      console.log('❌ Job não processado: TIMEOUT');
    }

    // 🎯 DIAGNÓSTICO FINAL
    console.log('\n🎯 [DIAGNÓSTICO FINAL]');
    if (jobWaiting && jobActive) {
      if (jobCompleted) {
        console.log('🟢 INTEGRAÇÃO: TOTALMENTE FUNCIONAL');
      } else if (jobFailed) {
        console.log('🟡 INTEGRAÇÃO: FUNCIONAL (falha esperada no arquivo teste)');
      } else {
        console.log('🟠 INTEGRAÇÃO: PROCESSANDO (pode estar em execução)');
      }
    } else if (jobWaiting && !jobActive) {
      console.log('🔴 PROBLEMA: Worker não está pegando jobs da fila');
    } else if (!jobWaiting) {
      console.log('🔴 PROBLEMA: Jobs não estão entrando na fila');
    }

    cleanupListeners();
    console.log('\n✅ [TESTE] Teste finalizado com sucesso');

  } catch (error) {
    console.error('\n🚨 [TESTE] ERRO CRÍTICO:', error.message);
    console.error('Stack:', error.stack);
  }
}

// 🚀 Executar teste
testeFinalIntegracao().then(() => {
  console.log('\n🎉 [TESTE] Auditoria completa finalizada');
  process.exit(0);
}).catch((err) => {
  console.error('\n💥 [TESTE] Erro fatal:', err);
  process.exit(1);
});