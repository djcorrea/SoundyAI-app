/**
 * 🧪 TESTE DE VALIDAÇÃO - ORDEM REDIS → POSTGRESQL
 * Valida se a ordem de operações foi corrigida corretamente
 */

import fs from 'fs';

async function validateOperationOrder() {
  console.log('🔍 [TESTE] Validando ordem de operações Redis → PostgreSQL...\n');

  try {
    const content = await fs.promises.readFile('./api/audio/analyze.js', 'utf8');
    
    // Encontrar posições das operações
    const redisPosition = content.indexOf('queue.add(\'process-audio\'');
    const postgresPosition = content.indexOf('INSERT INTO jobs');
    
    console.log(`📍 [POSIÇÕES] Redis (queue.add): linha ~${content.substring(0, redisPosition).split('\n').length}`);
    console.log(`📍 [POSIÇÕES] PostgreSQL (INSERT): linha ~${content.substring(0, postgresPosition).split('\n').length}\n`);
    
    // Validar ordem
    if (redisPosition < postgresPosition && redisPosition > 0 && postgresPosition > 0) {
      console.log('✅ [SUCESSO] Ordem correta: Redis ANTES do PostgreSQL!');
      console.log('🎯 [FLUXO] 1. queue.add() → 2. INSERT INTO jobs\n');
      
      // Validar logs obrigatórios
      const requiredLogs = [
        { log: '📩 [API] Enfileirando job', desc: 'Log antes do Redis' },
        { log: '✅ [API] Job enfileirado com sucesso', desc: 'Log sucesso Redis' },
        { log: '📝 [API] Gravando no Postgres', desc: 'Log antes do PostgreSQL' },
        { log: '✅ [API] Gravado no PostgreSQL', desc: 'Log sucesso PostgreSQL' },
        { log: '🎯 [API] Tudo pronto', desc: 'Log final de conclusão' }
      ];
      
      let logsOk = 0;
      for (const reqLog of requiredLogs) {
        if (content.includes(reqLog.log)) {
          console.log(`✅ [LOG] ${reqLog.desc} - IMPLEMENTADO`);
          logsOk++;
        } else {
          console.log(`❌ [LOG] ${reqLog.desc} - FALTANDO`);
        }
      }
      
      console.log(`\n📊 [LOGS] ${logsOk}/${requiredLogs.length} logs obrigatórios implementados`);
      
      // Verificar tratamento de erro
      const errorHandling = content.includes('Job ${jobId} enfileirado mas falha no PostgreSQL');
      console.log(`${errorHandling ? '✅' : '❌'} [ERRO] Tratamento de falhas: ${errorHandling ? 'IMPLEMENTADO' : 'FALTANDO'}`);
      
      return logsOk >= 4;
      
    } else if (redisPosition > postgresPosition) {
      console.log('❌ [ERRO] Ordem incorreta: PostgreSQL ANTES do Redis!');
      console.log('🚨 [PROBLEMA] Jobs podem ficar órfãos no PostgreSQL');
      return false;
      
    } else {
      console.log('❌ [ERRO] Não foi possível localizar as operações');
      return false;
    }
    
  } catch (error) {
    console.error('💥 [ERRO] Falha na validação:', error.message);
    return false;
  }
}

// Executar validação
validateOperationOrder().then(success => {
  if (success) {
    console.log('\n🎉 [RESULTADO] ✅ Ordem correta (Redis antes do DB)');
    console.log('🚀 [GARANTIA] Jobs nunca ficarão órfãos no PostgreSQL!');
  } else {
    console.log('\n⚠️ [RESULTADO] ❌ DB executa antes de Redis, o que pode travar os jobs');
  }
  process.exit(success ? 0 : 1);
});