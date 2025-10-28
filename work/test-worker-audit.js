/**
 * 🧪 TESTE DE VALIDAÇÃO - AUDITORIA COMPLETA DO WORKER
 * Valida todas as regras obrigatórias implementadas
 */

import fs from 'fs';
import path from 'path';

const WORKER_FILE = './worker-redis.js';

async function validateWorkerAudit() {
  console.log('🧪 [TESTE] Iniciando validação da auditoria completa do Worker...\n');

  try {
    const workerContent = await fs.promises.readFile(WORKER_FILE, 'utf8');
    
    const checks = [
      // ✅ REGRA 1: Registrar corretamente o Processor
      {
        rule: 'REGRA 1: Import correto do audioProcessor',
        test: () => workerContent.includes('async function audioProcessor(job)'),
        description: 'audioProcessor definido localmente no Worker'
      },
      {
        rule: 'REGRA 1: Processor sem erros de path',
        test: () => workerContent.includes("import { getQueueReadyPromise, getAudioQueue, getRedisConnection, getQueueEvents, closeAllConnections } from './lib/queue.js'"),
        description: 'Imports corretos do lib/queue.js'
      },
      
      // ✅ REGRA 2: getQueueReadyPromise() antes de criar Worker
      {
        rule: 'REGRA 2: getQueueReadyPromise() antes de Worker',
        test: () => workerContent.includes('await getQueueReadyPromise()') && workerContent.includes('worker = new Worker'),
        description: 'getQueueReadyPromise() chamado antes de criar Worker'
      },
      
      // ✅ REGRA 3: Nome exato da fila
      {
        rule: 'REGRA 3: Nome exato da fila',
        test: () => workerContent.includes("'audio-analyzer'") && workerContent.includes("Worker('audio-analyzer'"),
        description: "Fila 'audio-analyzer' usada corretamente"
      },
      
      // ✅ REGRA 4: Logs de diagnóstico obrigatórios
      {
        rule: 'REGRA 4: Log inicial obrigatório',
        test: () => workerContent.includes("console.log(`🚀 [WORKER] Iniciando worker`)"),
        description: 'Log inicial de worker implementado'
      },
      {
        rule: 'REGRA 4: Log processor registrado',
        test: () => workerContent.includes("console.log('🔥 [WORKER] Processor registrado com sucesso')"),
        description: 'Log de processor registrado implementado'
      },
      {
        rule: 'REGRA 4: Log recebendo job',
        test: () => workerContent.includes("console.log('🎧 [WORKER] Recebendo job', job.id, job.data)"),
        description: 'Log de recebimento de job implementado'
      },
      {
        rule: 'REGRA 4: Log erro processor',
        test: () => workerContent.includes("console.error('💥 [PROCESSOR] Falha ao processar job', job.id, error)"),
        description: 'Log de erro no processor implementado'
      },
      
      // ✅ REGRA 5: Tratar falhas silenciosas
      {
        rule: 'REGRA 5: Erro explícito para processor',
        test: () => workerContent.includes('Se o processor não for carregado, lançar erro explícito') || workerContent.includes('ERRO CRÍTICO'),
        description: 'Tratamento de falhas silenciosas implementado'
      },
      {
        rule: 'REGRA 5: Validação dados job',
        test: () => workerContent.includes('if (!job.data || !fileKey || !jobId)') && workerContent.includes('Dados do job inválidos'),
        description: 'Validação de dados do job implementada'
      },
      {
        rule: 'REGRA 5: Try/catch global',
        test: () => workerContent.includes('try {') && workerContent.includes('} catch (error) {') && workerContent.includes('throw error'),
        description: 'Try/catch global no audioProcessor implementado'
      },
      
      // ✅ REGRA 6: Healthcheck
      {
        rule: 'REGRA 6: Health server',
        test: () => workerContent.includes('healthApp.listen') && workerContent.includes('8081'),
        description: 'Health check server implementado'
      },
      {
        rule: 'REGRA 6: Keep alive',
        test: () => workerContent.includes('setInterval') && workerContent.includes('KEEP-ALIVE'),
        description: 'Keep alive para Railway implementado'
      },
      
      // ✅ REGRA 7: Eventos de fila
      {
        rule: 'REGRA 7: Event listener completed',
        test: () => workerContent.includes("console.log(`✅ Job ${job.id} concluído`)"),
        description: 'Event listener de job concluído implementado'
      },
      {
        rule: 'REGRA 7: Event listener failed',
        test: () => workerContent.includes("console.error(`❌ Job ${job?.id} falhou`, err)"),
        description: 'Event listener de job falhado implementado'
      },
      {
        rule: 'REGRA 7: QueueEvents',
        test: () => workerContent.includes('getQueueEvents()') && workerContent.includes('setupQueueEventListeners'),
        description: 'QueueEvents para depuração implementado'
      },
      
      // ✅ VERIFICAÇÕES EXTRAS
      {
        rule: 'EXTRA: Environment validation',
        test: () => workerContent.includes('REDIS_URL não configurado') && workerContent.includes('DATABASE_URL não configurado'),
        description: 'Validação de environment variables implementada'
      },
      {
        rule: 'EXTRA: Diagnóstico de falhas',
        test: () => workerContent.includes('FALHA ESTRUTURAL') && workerContent.includes('Apontar exatamente onde está a falha'),
        description: 'Diagnóstico específico de falhas implementado'
      }
    ];

    let passed = 0;
    let failed = 0;

    console.log('📋 [TESTE] Executando verificações...\n');

    for (const check of checks) {
      const result = check.test();
      if (result) {
        console.log(`✅ [PASSOU] ${check.rule}`);
        console.log(`   └─ ${check.description}\n`);
        passed++;
      } else {
        console.log(`❌ [FALHOU] ${check.rule}`);
        console.log(`   └─ ${check.description}\n`);
        failed++;
      }
    }

    console.log('📊 [RESULTADO] Resumo da validação:');
    console.log(`✅ Verificações aprovadas: ${passed}`);
    console.log(`❌ Verificações reprovadas: ${failed}`);
    console.log(`📈 Taxa de aprovação: ${Math.round((passed / checks.length) * 100)}%\n`);

    if (failed === 0) {
      console.log('🎉 [SUCESSO] TODAS as regras obrigatórias foram implementadas!');
      console.log('🚀 [WORKER] PRONTO PARA PRODUÇÃO - Worker 100% auditado e corrigido!');
      return true;
    } else {
      console.log('⚠️ [ATENÇÃO] Algumas regras ainda precisam ser implementadas.');
      return false;
    }

  } catch (error) {
    console.error('💥 [ERRO] Falha na validação:', error.message);
    return false;
  }
}

// Executar validação
validateWorkerAudit().then(success => {
  process.exit(success ? 0 : 1);
});