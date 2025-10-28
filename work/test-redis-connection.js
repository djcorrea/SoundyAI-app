// test-redis-connection.js - TESTE DA CONEXÃO REDIS CENTRALIZADA
// 🔧 Verifica se API e Worker usam a mesma conexão Redis

import "dotenv/config";
import { getRedisConnection, testRedisConnection, getConnectionMetadata } from './lib/redis-connection.js';

console.log(`[TEST-REDIS][${new Date().toISOString()}] -> 🚀 INICIANDO TESTE DE CONEXÃO CENTRALIZADA...`);

async function testRedisIntegration() {
  try {
    console.log(`[TEST-REDIS][${new Date().toISOString()}] -> 📋 TESTE 1: Obtendo conexão centralizada...`);
    
    // Simular API obtendo conexão
    process.env.SERVICE_NAME = 'api-test';
    const apiConnection = getRedisConnection();
    const apiMetadata = getConnectionMetadata();
    console.log(`[TEST-REDIS][${new Date().toISOString()}] -> 🌐 API Connection:`, apiMetadata);

    // Simular Worker obtendo conexão
    process.env.SERVICE_NAME = 'worker-test';
    const workerConnection = getRedisConnection();
    const workerMetadata = getConnectionMetadata();
    console.log(`[TEST-REDIS][${new Date().toISOString()}] -> ⚙️ Worker Connection:`, workerMetadata);

    // Verificar se são a mesma instância
    const sameConnection = apiConnection === workerConnection;
    console.log(`[TEST-REDIS][${new Date().toISOString()}] -> ✅ Mesma instância? ${sameConnection ? 'SIM' : 'NÃO'}`);

    console.log(`[TEST-REDIS][${new Date().toISOString()}] -> 📋 TESTE 2: Testando conectividade...`);
    const connectionTest = await testRedisConnection();
    console.log(`[TEST-REDIS][${new Date().toISOString()}] -> 🔍 Connection Test:`, connectionTest);

    console.log(`[TEST-REDIS][${new Date().toISOString()}] -> 📋 TESTE 3: Testando operações Redis...`);
    
    // Teste básico de SET/GET
    const testKey = `test:${Date.now()}`;
    const testValue = JSON.stringify({ service: 'test', timestamp: new Date().toISOString() });
    
    await apiConnection.set(testKey, testValue, 'EX', 60); // Expira em 60s
    const retrievedValue = await workerConnection.get(testKey);
    
    console.log(`[TEST-REDIS][${new Date().toISOString()}] -> 📝 SET (API): ${testKey} = ${testValue}`);
    console.log(`[TEST-REDIS][${new Date().toISOString()}] -> 📖 GET (Worker): ${testKey} = ${retrievedValue}`);
    
    const dataMatches = testValue === retrievedValue;
    console.log(`[TEST-REDIS][${new Date().toISOString()}] -> ✅ Dados consistentes? ${dataMatches ? 'SIM' : 'NÃO'}`);

    // Limpeza do teste
    await apiConnection.del(testKey);
    console.log(`[TEST-REDIS][${new Date().toISOString()}] -> 🧹 Cleanup: Teste key removida`);

    console.log(`[TEST-REDIS][${new Date().toISOString()}] -> 📋 TESTE 4: Verificando chaves BullMQ...`);
    const bullKeys = await apiConnection.keys('bull:audio-analyzer:*');
    console.log(`[TEST-REDIS][${new Date().toISOString()}] -> 🔑 BullMQ Keys encontradas: ${bullKeys.length}`);
    bullKeys.forEach(key => {
      console.log(`[TEST-REDIS][${new Date().toISOString()}] ->   - ${key}`);
    });

    console.log(`[TEST-REDIS][${new Date().toISOString()}] -> ✅ TODOS OS TESTES CONCLUÍDOS COM SUCESSO!`);
    
  } catch (error) {
    console.error(`[TEST-REDIS][${new Date().toISOString()}] -> 🚨 ERRO NO TESTE:`, error);
  } finally {
    // Cleanup das conexões
    const redisConnection = getRedisConnection();
    await redisConnection.quit();
    console.log(`[TEST-REDIS][${new Date().toISOString()}] -> 🔚 Teste finalizado e conexões limpas`);
    process.exit(0);
  }
}

// Executar teste
testRedisIntegration();