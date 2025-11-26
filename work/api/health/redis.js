// api/health/redis.js - HEALTH CHECK REDIS CENTRALIZADO
// 🔧 Endpoint para monitorar conexão Redis e sincronização API/Worker

import express from "express";
import { getRedisConnection, testRedisConnection, getConnectionMetadata } from '../../lib/redis-connection.js';

const router = express.Router();

// 🔍 GET /health/redis - Status detalhado da conexão Redis
router.get('/redis', async (req, res) => {
  try {
    console.log(`[HEALTH-REDIS][${new Date().toISOString()}] -> 🔍 Verificando status Redis...`);
    
    const startTime = Date.now();
    
    // Teste de conectividade
    const connectionTest = await testRedisConnection();
    
    // Metadata da conexão
    const metadata = getConnectionMetadata();
    
    // Informações da conexão atual
    const redisConnection = getRedisConnection();
    const redisStatus = redisConnection.status;
    
    // Teste de latência
    const latencyTest = await redisConnection.ping();
    const responseTime = Date.now() - startTime;
    
    // Verificar chaves BullMQ
    const bullKeys = await redisConnection.keys('bull:audio-analyzer:*');
    const bullQueueInfo = {
      totalKeys: bullKeys.length,
      metaKeys: bullKeys.filter(k => k.includes(':meta')).length,
      waitingKeys: bullKeys.filter(k => k.includes(':waiting')).length,
      activeKeys: bullKeys.filter(k => k.includes(':active')).length,
      completedKeys: bullKeys.filter(k => k.includes(':completed')).length,
      failedKeys: bullKeys.filter(k => k.includes(':failed')).length,
      stalledKeys: bullKeys.filter(k => k.includes(':stalled-check')).length
    };
    
    // Informações de memória Redis
    const memoryInfo = await redisConnection.memory('usage');
    
    const healthData = {
      status: connectionTest.connected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      connection: {
        status: redisStatus,
        metadata: metadata,
        latency: typeof latencyTest === 'string' && latencyTest === 'PONG' ? 'OK' : latencyTest,
        responseTime: `${responseTime}ms`
      },
      bullmq: {
        queue: 'audio-analyzer',
        ...bullQueueInfo,
        keysFound: bullKeys.slice(0, 10) // Primeiras 10 chaves para debug
      },
      memory: {
        usage: memoryInfo || 'N/A'
      },
      test: connectionTest
    };
    
    console.log(`[HEALTH-REDIS][${new Date().toISOString()}] -> ✅ Status coletado: ${healthData.status}`);
    
    // Status HTTP baseado na conectividade
    const httpStatus = connectionTest.connected ? 200 : 503;
    
    res.status(httpStatus).json(healthData);
    
  } catch (error) {
    console.error(`[HEALTH-REDIS][${new Date().toISOString()}] -> 🚨 Erro no health check:`, error);
    
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN'
      },
      connection: {
        status: 'failed'
      }
    });
  }
});

// 🔄 GET /health/redis/sync - Teste de sincronização API/Worker
router.get('/redis/sync', async (req, res) => {
  try {
    console.log(`[HEALTH-SYNC][${new Date().toISOString()}] -> 🔄 Testando sincronização API/Worker...`);
    
    const redisConnection = getRedisConnection();
    const testKey = `sync-test:${Date.now()}`;
    const testData = {
      source: 'api',
      timestamp: new Date().toISOString(),
      pid: process.pid,
      service: process.env.SERVICE_NAME || 'api'
    };
    
    // SET dados de teste
    await redisConnection.set(testKey, JSON.stringify(testData), 'EX', 30);
    
    // GET dados para verificar consistência
    const retrievedData = await redisConnection.get(testKey);
    const parsed = JSON.parse(retrievedData);
    
    // TTL para confirmar expiração
    const ttl = await redisConnection.ttl(testKey);
    
    // Cleanup
    await redisConnection.del(testKey);
    
    const syncData = {
      status: 'synced',
      timestamp: new Date().toISOString(),
      test: {
        key: testKey,
        dataWritten: testData,
        dataRead: parsed,
        consistent: JSON.stringify(testData) === JSON.stringify(parsed),
        ttl: `${ttl}s`
      },
      connection: getConnectionMetadata()
    };
    
    console.log(`[HEALTH-SYNC][${new Date().toISOString()}] -> ✅ Sync test: ${syncData.test.consistent ? 'PASSED' : 'FAILED'}`);
    
    res.status(200).json(syncData);
    
  } catch (error) {
    console.error(`[HEALTH-SYNC][${new Date().toISOString()}] -> 🚨 Erro no sync test:`, error);
    
    res.status(500).json({
      status: 'sync-failed',
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        code: error.code || 'SYNC_ERROR'
      }
    });
  }
});

export default router;