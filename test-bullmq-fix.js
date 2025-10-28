/**
 * 🧪 TESTE AUTOMÁTICO - CORREÇÃO BULLMQ
 * Verifica se a arquitetura foi corrigida corretamente
 */

import "dotenv/config";

console.log('🧪 [TESTE] Iniciando verificação da correção BullMQ...\n');

// ✅ 1. VERIFICAR REDIS_URL
console.log('1️⃣ VERIFICANDO REDIS_URL:');
if (process.env.REDIS_URL) {
  const maskedUrl = process.env.REDIS_URL.replace(/:[^:]*@/, ':***@');
  console.log(`✅ REDIS_URL configurada: ${maskedUrl}`);
} else {
  console.log('❌ REDIS_URL não configurada!');
  process.exit(1);
}

// ✅ 2. VERIFICAR DEPENDÊNCIAS
console.log('\n2️⃣ VERIFICANDO DEPENDÊNCIAS:');
try {
  const { Queue } = await import('bullmq');
  const Redis = await import('ioredis');
  console.log('✅ BullMQ importado com sucesso');
  console.log('✅ ioredis importado com sucesso');
} catch (error) {
  console.log('❌ Erro ao importar dependências:', error.message);
  process.exit(1);
}

// ✅ 3. VERIFICAR MÓDULO QUEUE
console.log('\n3️⃣ VERIFICANDO MÓDULO QUEUE:');
try {
  const { getAudioQueue, getQueueReadyPromise } = await import('./lib/queue.js');
  console.log('✅ Módulo queue.js importado com sucesso');
  
  // Testar inicialização
  await getQueueReadyPromise();
  const queue = getAudioQueue();
  console.log(`✅ Fila '${queue.name}' inicializada com sucesso`);
  
} catch (error) {
  console.log('❌ Erro ao importar/inicializar queue:', error.message);
  process.exit(1);
}

// ✅ 4. VERIFICAR API ANALYZE
console.log('\n4️⃣ VERIFICANDO API ANALYZE:');
try {
  const fs = await import('fs');
  const analyzeContent = fs.readFileSync('./api/audio/analyze.js', 'utf8');
  
  if (analyzeContent.includes('getAudioQueue')) {
    console.log('✅ API analyze.js tem BullMQ importado');
  } else {
    console.log('❌ API analyze.js NÃO tem BullMQ!');
    process.exit(1);
  }
  
  if (analyzeContent.includes("queue.add('process-audio'")) {
    console.log('✅ API usa queue.add() corretamente');
  } else {
    console.log('❌ API NÃO usa queue.add()!');
    process.exit(1);
  }
  
} catch (error) {
  console.log('❌ Erro ao verificar API:', error.message);
  process.exit(1);
}

console.log('\n🎉 TODOS OS TESTES PASSARAM!');
console.log('🚀 Arquitetura BullMQ corrigida com sucesso!');
console.log('\n📋 PRÓXIMOS PASSOS:');
console.log('1. Fazer commit das mudanças');
console.log('2. Deploy no Railway');
console.log('3. Iniciar Worker: cd work && node worker-redis.js');
console.log('4. Testar API: npm run test-job');

process.exit(0);