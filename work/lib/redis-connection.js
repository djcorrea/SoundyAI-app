/**
 * 🔗 REDIS CONNECTION SINGLETON
 * Módulo centralizado para garantir que API e Worker usem a mesma conexão Redis
 * Evita divergências de connection pool que impedem processamento de jobs
 */

import Redis from 'ioredis';
import crypto from 'crypto';

// Configuração padronizada para todos os serviços
const REDIS_CONFIG = {
  maxRetriesPerRequest: null,      // ✅ Obrigatório para BullMQ
  lazyConnect: true,
  connectTimeout: 45000,
  commandTimeout: 15000,
  keepAlive: 120000,
  enableReadyCheck: false,
  enableAutoPipelining: true,
  family: 4,
  
  // Retry strategy robusto
  retryStrategy: (times) => {
    const delay = Math.min(times * 2000, 30000);
    console.log(`🔄 [REDIS] Retry attempt ${times}: ${delay}ms delay`);
    return delay;
  },
  
  retryDelayOnFailover: 2000,
};

// Singleton connection - garante uma única instância
let sharedConnection = null;
let connectionMetadata = null;

/**
 * Cria e retorna a conexão Redis compartilhada
 */
export const getRedisConnection = () => {
  if (!sharedConnection) {
    if (!process.env.REDIS_URL) {
      throw new Error('🚨 REDIS_URL environment variable not configured');
    }
    
    console.log(`🔗 [REDIS] Creating shared connection - PID: ${process.pid}`);
    console.log(`🔗 [REDIS] Service: ${process.env.SERVICE_NAME || 'unknown'}`);
    
    sharedConnection = new Redis(process.env.REDIS_URL, REDIS_CONFIG);
    
    // Audit connection establishment
    sharedConnection.on('connect', async () => {
      try {
        const clientId = await sharedConnection.client('id');
        const dbSize = await sharedConnection.dbsize();
        const urlHash = crypto.createHash('md5').update(process.env.REDIS_URL).digest('hex').substring(0, 8);
        
        connectionMetadata = {
          clientId,
          dbSize,
          urlHash,
          pid: process.pid,
          service: process.env.SERVICE_NAME || 'unknown',
          timestamp: new Date().toISOString()
        };
        
        console.log(`✅ [REDIS] Connected - Client ID: ${clientId} | DB Size: ${dbSize} | URL Hash: ${urlHash}`);
      } catch (err) {
        console.error(`🚨 [REDIS] Connection audit failed:`, err.message);
      }
    });
    
    sharedConnection.on('ready', () => {
      console.log(`🟢 [REDIS] Ready for operations - PID: ${process.pid}`);
    });
    
    sharedConnection.on('error', (err) => {
      console.error(`🚨 [REDIS] Connection error:`, err.message);
    });
    
    sharedConnection.on('reconnecting', (delay) => {
      console.log(`🔄 [REDIS] Reconnecting in ${delay}ms...`);
    });
    
    sharedConnection.on('end', () => {
      console.log(`🔌 [REDIS] Connection ended`);
    });
  }
  
  return sharedConnection;
};

/**
 * Retorna metadados da conexão para auditoria
 */
export const getConnectionMetadata = () => {
  return connectionMetadata;
};

/**
 * Teste de conectividade para diagnóstico
 */
export const testRedisConnection = async () => {
  try {
    const redis = getRedisConnection();
    const ping = await redis.ping();
    const info = await redis.info('server');
    const clientId = await redis.client('id');
    const dbSize = await redis.dbsize();
    
    const result = {
      status: 'healthy',
      ping: ping === 'PONG',
      clientId,
      dbSize,
      redisVersion: info.match(/redis_version:([\d.]+)/)?.[1] || 'unknown',
      pid: process.pid,
      service: process.env.SERVICE_NAME || 'unknown',
      timestamp: new Date().toISOString()
    };
    
    console.log(`🔍 [REDIS-TEST]`, result);
    return result;
  } catch (error) {
    const result = {
      status: 'unhealthy',
      error: error.message,
      pid: process.pid,
      service: process.env.SERVICE_NAME || 'unknown',
      timestamp: new Date().toISOString()
    };
    
    console.error(`💥 [REDIS-TEST]`, result);
    return result;
  }
};

/**
 * Graceful cleanup da conexão
 */
export const closeRedisConnection = async () => {
  if (sharedConnection) {
    console.log(`🔌 [REDIS] Closing connection - PID: ${process.pid}`);
    await sharedConnection.quit();
    sharedConnection = null;
    connectionMetadata = null;
  }
};

// Cleanup automático em shutdown
process.on('SIGINT', closeRedisConnection);
process.on('SIGTERM', closeRedisConnection);