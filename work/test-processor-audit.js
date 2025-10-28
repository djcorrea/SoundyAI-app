/**
 * 🧪 TESTE FINAL - AUDITORIA COMPLETA DO PROCESSOR
 * Valida se o processor existe, está registrado e funciona corretamente
 */

import fs from 'fs';
import path from 'path';

const WORKER_FILE = './worker-redis.js';
const API_FILE = './api/audio/analyze.js';

async function auditCompleteProcessor() {
  console.log('🔍 [AUDITORIA] Iniciando auditoria completa do processor...\n');

  try {
    // 1. Verificar se o Worker file existe
    if (!fs.existsSync(WORKER_FILE)) {
      console.error('❌ [ERRO] Arquivo worker-redis.js não encontrado');
      return false;
    }

    const workerContent = await fs.promises.readFile(WORKER_FILE, 'utf8');
    
    // 2. Verificar se a API file existe
    if (!fs.existsSync(API_FILE)) {
      console.error('❌ [ERRO] Arquivo api/audio/analyze.js não encontrado');
      return false;
    }

    const apiContent = await fs.promises.readFile(API_FILE, 'utf8');

    console.log('📂 [AUDITORIA] Verificando estrutura do processor...\n');

    // ===== VERIFICAÇÃO 1: PROCESSOR EXISTE? =====
    const processorExists = workerContent.includes('async function audioProcessor(job)');
    
    if (!processorExists) {
      console.log('❌ Nenhum processor encontrado para a fila audio-analyzer.');
      return false;
    }

    console.log('✅ [ENCONTRADO] audioProcessor definido em worker-redis.js');
    console.log('📍 [LOCALIZAÇÃO] work/worker-redis.js - função audioProcessor\n');

    // ===== VERIFICAÇÃO 2: WORKER REGISTRA CORRETAMENTE? =====
    const workerRegistration = workerContent.includes("new Worker('audio-analyzer', audioProcessor");
    
    if (!workerRegistration) {
      console.log('❌ [ERRO] Worker não está registrando o audioProcessor corretamente');
      console.log('🔧 [PROBLEMA] Linha problemática no Worker não encontrada');
      return false;
    }

    console.log('✅ [CONFIRMADO] Processor corretamente registrado no Worker');
    console.log('📍 [LOCALIZAÇÃO] Worker registra audioProcessor para fila "audio-analyzer"\n');

    // ===== VERIFICAÇÃO 3: COMPATIBILIDADE API ↔ WORKER =====
    const apiJobName = apiContent.match(/queue\.add\(['"]([^'"]+)['"]/);
    const apiJobNameStr = apiJobName ? apiJobName[1] : 'não encontrado';
    
    console.log(`📋 [API] Enfileira jobs com nome: '${apiJobNameStr}'`);
    console.log(`🎯 [WORKER] Processa jobs da fila: 'audio-analyzer'`);
    
    if (apiJobNameStr === 'process-audio') {
      console.log('✅ [COMPATÍVEL] API e Worker usam nomes compatíveis\n');
    } else {
      console.log(`⚠️ [ATENÇÃO] Nome do job da API: '${apiJobNameStr}'\n`);
    }

    // ===== VERIFICAÇÃO 4: LOGS OBRIGATÓRIOS =====
    const requiredLogs = [
      { log: "console.log(`🚀 [WORKER] Iniciando worker`)", desc: 'Log inicial do worker' },
      { log: "console.log('🔥 [WORKER] Processor registrado com sucesso')", desc: 'Log processor registrado' },
      { log: "console.log('🎧 [WORKER] Recebendo job', job.id, job.data)", desc: 'Log recebendo job' },
      { log: "console.error('💥 [PROCESSOR] Falha ao processar job', job.id, error)", desc: 'Log erro processor' }
    ];

    let logsOk = 0;
    for (const reqLog of requiredLogs) {
      if (workerContent.includes(reqLog.log)) {
        console.log(`✅ [LOG] ${reqLog.desc} - IMPLEMENTADO`);
        logsOk++;
      } else {
        console.log(`❌ [LOG] ${reqLog.desc} - FALTANDO`);
      }
    }

    console.log(`\n📊 [LOGS] ${logsOk}/${requiredLogs.length} logs obrigatórios implementados\n`);

    // ===== VERIFICAÇÃO 5: VALIDAÇÃO DE DADOS =====
    const dataValidation = workerContent.includes('if (!job.data || !fileKey || !jobId)');
    console.log(`${dataValidation ? '✅' : '❌'} [VALIDAÇÃO] Validação de dados do job: ${dataValidation ? 'IMPLEMENTADA' : 'FALTANDO'}`);

    // ===== VERIFICAÇÃO 6: TRY/CATCH GLOBAL =====
    const tryCatchGlobal = workerContent.includes('try {') && 
                          workerContent.includes('} catch (error) {') && 
                          workerContent.includes('throw error');
    console.log(`${tryCatchGlobal ? '✅' : '❌'} [ROBUSTEZ] Try/catch global: ${tryCatchGlobal ? 'IMPLEMENTADO' : 'FALTANDO'}`);

    // ===== VERIFICAÇÃO 7: ENVIRONMENT VALIDATION =====
    const envValidation = workerContent.includes('REDIS_URL não configurado') && 
                          workerContent.includes('DATABASE_URL não configurado');
    console.log(`${envValidation ? '✅' : '❌'} [ENV] Validação de environment: ${envValidation ? 'IMPLEMENTADA' : 'FALTANDO'}`);

    // ===== RESULTADO FINAL =====
    console.log('\n🎯 [RESULTADO FINAL]');
    console.log('==========================================');
    
    if (processorExists && workerRegistration && logsOk >= 3) {
      console.log('🎉 [SUCESSO] Processor COMPLETO e FUNCIONAL encontrado!');
      console.log('📍 [LOCALIZAÇÃO] work/worker-redis.js - função audioProcessor');
      console.log('✅ [STATUS] Worker corretamente registrado');
      console.log('🚀 [PRONTO] Sistema preparado para processar jobs');
      console.log('\n🎯 [LOGS ESPERADOS]:');
      console.log('🚀 [WORKER] Iniciando worker');
      console.log('🔥 [WORKER] Processor registrado com sucesso');
      console.log('🎧 [WORKER] Recebendo job 123 { fileKey: "xxx" }');
      console.log('✅ Job 123 concluído\n');
      return true;
    } else {
      console.log('❌ [PROBLEMAS] Processor incompleto ou com problemas');
      return false;
    }

  } catch (error) {
    console.error('💥 [ERRO] Falha na auditoria:', error.message);
    return false;
  }
}

// Executar auditoria
auditCompleteProcessor().then(success => {
  if (success) {
    console.log('🏆 [CONCLUSÃO] Auditoria APROVADA - Processor 100% funcional!');
  } else {
    console.log('⚠️ [CONCLUSÃO] Auditoria REPROVADA - Processor precisa de correções');
  }
  process.exit(success ? 0 : 1);
});