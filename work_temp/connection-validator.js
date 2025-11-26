// connection-validator.js - VALIDAR SE API E WORKER USAM MESMA CONEXÃO
// 🔍 Verifica Client ID, URL hash e metadados de conexão

import "dotenv/config";
import { getRedisConnection, testRedisConnection, getConnectionMetadata } from './lib/redis-connection.js';

console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> 🔍 VALIDANDO CONEXÕES API/WORKER...`);

async function validateConnections() {
  try {
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> 📋 SIMULANDO CONEXÃO DA API...`);
    
    // 🌐 Simular conexão da API
    process.env.SERVICE_NAME = 'api-validator';
    const apiConnection = getRedisConnection();
    const apiTest = await testRedisConnection();
    const apiMetadata = getConnectionMetadata();
    
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> 🌐 API Connection Test:`, apiTest);
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> 📊 API Metadata:`, apiMetadata);
    
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> 📋 SIMULANDO CONEXÃO DO WORKER...`);
    
    // ⚙️ Simular conexão do Worker
    process.env.SERVICE_NAME = 'worker-validator';
    const workerConnection = getRedisConnection();
    const workerTest = await testRedisConnection();
    const workerMetadata = getConnectionMetadata();
    
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> ⚙️ Worker Connection Test:`, workerTest);
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> 📊 Worker Metadata:`, workerMetadata);
    
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> 📋 ANÁLISE COMPARATIVA...`);
    
    // ✅ Verificações críticas
    const sameInstance = apiConnection === workerConnection;
    const sameClientId = apiTest.clientId === workerTest.clientId;
    const sameRedisVersion = apiTest.redisVersion === workerTest.redisVersion;
    const sameDbSize = apiTest.dbSize === workerTest.dbSize;
    
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> 🔍 RESULTADOS:`);
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] ->   ✅ Mesma instância JS: ${sameInstance ? 'SIM' : 'NÃO'}`);
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] ->   🆔 Mesmo Client ID: ${sameClientId ? 'SIM' : 'NÃO'} (${apiTest.clientId} vs ${workerTest.clientId})`);
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] ->   📊 Mesmo DB Size: ${sameDbSize ? 'SIM' : 'NÃO'} (${apiTest.dbSize} vs ${workerTest.dbSize})`);
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] ->   🔢 Mesma versão Redis: ${sameRedisVersion ? 'SIM' : 'NÃO'} (${apiTest.redisVersion} vs ${workerTest.redisVersion})`);
    
    // 🎯 Teste de operação cruzada
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> 📋 TESTE DE OPERAÇÃO CRUZADA...`);
    
    const testKey = `connection-test:${Date.now()}`;
    const testValue = JSON.stringify({
      source: 'api-validator',
      timestamp: new Date().toISOString(),
      clientId: apiTest.clientId
    });
    
    // API escreve
    await apiConnection.set(testKey, testValue, 'EX', 30);
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> 📝 API escreveu: ${testKey}`);
    
    // Worker lê
    const readValue = await workerConnection.get(testKey);
    const dataMatch = testValue === readValue;
    
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> 📖 Worker leu: ${readValue ? 'DADOS ENCONTRADOS' : 'NADA'}`);
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> ✅ Dados consistentes: ${dataMatch ? 'SIM' : 'NÃO'}`);
    
    // Cleanup
    await apiConnection.del(testKey);
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> 🧹 Teste key removida`);
    
    // 🏆 Veredito final
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> 🏆 VEREDITO FINAL:`);
    
    if (sameInstance && sameClientId && dataMatch) {
      console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> ✅ API E WORKER USAM A MESMA CONEXÃO REDIS!`);
      console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> 🎯 Conexão centralizada funcionando corretamente`);
    } else {
      console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> ❌ API E WORKER USANDO CONEXÕES DIFERENTES!`);
      console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> 🚨 PROBLEMA DE ISOLAMENTO DETECTADO`);
      
      if (!sameInstance) console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] ->   - Instâncias JS diferentes`);
      if (!sameClientId) console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] ->   - Client IDs diferentes`);
      if (!dataMatch) console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] ->   - Dados não compartilhados`);
    }
    
    // 🔑 Environment audit
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> 🔧 ENVIRONMENT AUDIT:`);
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] ->   REDIS_URL: ${process.env.REDIS_URL?.substring(0, 50)}...`);
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] ->   NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
    console.log(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] ->   PID: ${process.pid}`);
    
  } catch (error) {
    console.error(`[CONNECTION-VALIDATOR][${new Date().toISOString()}] -> 🚨 ERRO NA VALIDAÇÃO:`, error);
  } finally {
    process.exit(0);
  }
}

// Executar validação
validateConnections();