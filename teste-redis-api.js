/**
 * 🔧 TESTE RÁPIDO: Verificação da conexão Redis na API
 */

import "dotenv/config";
import { Queue } from 'bullmq';
import Redis from 'ioredis';

console.log('🔍 TESTE DE CONEXÃO REDIS API');
console.log('============================');
console.log('');
console.log('📋 Variáveis de ambiente:');
console.log(`   REDIS_URL: ${process.env.REDIS_URL}`);
console.log(`   REDIS_PASSWORD: ${process.env.REDIS_PASSWORD ? '***DEFINIDA***' : 'UNDEFINED'}`);
console.log('');

try {
  console.log('🚀 Criando conexão Redis...');
  
  const redisConnection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableAutoPipelining: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
  });

  const audioQueue = new Queue('audio-analyzer', { connection: redisConnection });

  redisConnection.on('connect', () => {
    console.log('✅ CONECTADO ao Redis!');
  });

  redisConnection.on('ready', () => {
    console.log('✅ Redis PRONTO para uso!');
    
    // Teste de adição de job
    console.log('🧪 Testando adição de job...');
    audioQueue.add('test', { message: 'teste de conexão' })
      .then((job) => {
        console.log(`✅ Job criado com sucesso! ID: ${job.id}`);
        process.exit(0);
      })
      .catch((err) => {
        console.error('❌ Erro ao criar job:', err.message);
        process.exit(1);
      });
  });

  redisConnection.on('error', (err) => {
    console.error('❌ ERRO Redis:', err.message);
    process.exit(1);
  });

  // Timeout de 15 segundos
  setTimeout(() => {
    console.error('❌ TIMEOUT: Conexão Redis não estabelecida em 15s');
    process.exit(1);
  }, 15000);

} catch (error) {
  console.error('💥 ERRO CRÍTICO:', error.message);
  process.exit(1);
}