/**
 * 🎵 BULLMQ AUDIO WORKER - DISTRIBUTED PROCESSING
 * Worker distribuído para processamento de análise de áudio
 * Integra com pipeline existente sem modificações
 */

import { Worker } from 'bullmq';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// 🔑 Carregar configurações PRIMEIRO
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar pipeline de processamento existente
let processAudioComplete = null;
try {
  const { processAudioComplete: imported } = await import('../api/audio/pipeline-complete.js');
  processAudioComplete = imported;
  console.log("✅ [WORKER] Pipeline carregado com sucesso");
} catch (err) {
  console.error("❌ [WORKER] CRÍTICO: Falha ao carregar pipeline:", err.message);
  process.exit(1);
}

// 🔧 Configuração Redis usando variáveis específicas
const redisConfig = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  tls: {},
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
};

// Validar configuração Redis obrigatória
if (!redisConfig.host || !redisConfig.port) {
  console.error('❌ [WORKER] ERRO: REDIS_HOST e REDIS_PORT são obrigatórios');
  console.error('❌ [WORKER] Configuração atual:', {
    host: redisConfig.host || 'undefined',
    port: redisConfig.port || 'undefined',
    hasPassword: !!redisConfig.password
  });
  process.exit(1);
}

console.log(`🔧 [WORKER] Redis configurado: ${redisConfig.host}:${redisConfig.port}`);

/**
 * Handler de processamento de jobs
 * Mantém assinatura da pipeline existente
 */
async function processAudioJob(job) {
  const { fileKey, mode, fileName, requestId } = job.data;
  const startTime = Date.now();

  console.log(`🔄 [WORKER] Iniciando processamento: ${job.id}`);
  console.log(`📁 [WORKER] FileKey: ${fileKey}, Modo: ${mode}`);

  try {
    // Atualizar progresso
    await job.updateProgress(10);

    // Simular URL do arquivo (adapte conforme sua estrutura)
    // Se fileKey já é uma URL completa, use diretamente
    // Se é apenas a chave, construir URL do bucket
    const fileUrl = fileKey.startsWith('http') ? fileKey : 
                   `${process.env.B2_ENDPOINT}/${process.env.B2_BUCKET_NAME}/${fileKey}`;
    
    await job.updateProgress(25);

    // Baixar arquivo (se necessário) ou usar buffer diretamente
    // Adapte conforme sua implementação atual
    let audioBuffer;
    
    if (fileKey.startsWith('http')) {
      // Se for URL, fazer download
      const response = await fetch(fileUrl);
      audioBuffer = await response.arrayBuffer();
    } else {
      // Se for chave, usar método existente de download do S3
      // Importar função de download do worker-root.js se necessário
      throw new Error("Implementar download do S3 baseado em fileKey");
    }

    await job.updateProgress(50);

    // Invocar pipeline existente
    console.log(`🎯 [WORKER] Executando pipeline para: ${fileName || fileKey}`);
    
    const result = await processAudioComplete(
      audioBuffer, 
      fileName || fileKey, 
      { mode, reference: mode === 'reference' ? null : mode }
    );

    await job.updateProgress(90);

    // Validar resultado
    if (!result || typeof result !== 'object') {
      throw new Error('Pipeline retornou resultado inválido');
    }

    const processingTime = Date.now() - startTime;
    
    // Adicionar metadados do worker
    const finalResult = {
      ...result,
      _worker: {
        source: 'bullmq_worker',
        workerId: process.pid,
        processingTime,
        completedAt: new Date().toISOString(),
        requestId
      }
    };

    await job.updateProgress(100);

    console.log(`✅ [WORKER] Job ${job.id} concluído em ${processingTime}ms`);
    
    return finalResult;

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error(`❌ [WORKER] Job ${job.id} falhou após ${processingTime}ms:`, error.message);
    
    // Re-throw para BullMQ handle retry logic
    throw new Error(`Processamento falhou: ${error.message}`);
  }
}

// Criar worker
const worker = new Worker('audio-analysis', processAudioJob, {
  connection: redisConfig,
  concurrency: 4, // 🚀 AUMENTADO DE 2 PARA 4 (FFT paralelo permite mais concorrência)
  maxStalledCount: 1,
  stalledInterval: 30 * 1000, // 30 segundos
  maxmemoryPolicy: 'noeviction',
});

// Event listeners
worker.on('ready', () => {
  console.log(`🚀 [WORKER] Worker iniciado (PID: ${process.pid})`);
  console.log(`🔧 [WORKER] Concorrência: 4 jobs (FFT paralelo), Redis: ${redisConfig.host}:${redisConfig.port}`);
  console.log(`🎯 [WORKER] Total capacidade teórica: 12 workers × 4 jobs = 48 jobs simultâneos`);
});

worker.on('error', (error) => {
  console.error('❌ [WORKER] Erro no worker:', error);
});

worker.on('stalled', (jobId) => {
  console.warn(`⚠️ [WORKER] Job ${jobId} travado, sendo reconectado`);
});

worker.on('completed', (job) => {
  const processingTime = job.finishedOn - job.processedOn;
  console.log(`✅ [WORKER] Job ${job.id} completado em ${processingTime}ms`);
  
  // 🚀 Log performance para análise FFT paralelo
  if (processingTime) {
    console.log(`📊 [PERFORMANCE] Job duration: ${processingTime}ms (PID: ${process.pid})`);
  }
});

worker.on('failed', (job, error) => {
  console.error(`❌ [WORKER] Job ${job.id} falhou:`, error.message);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 [WORKER] Recebido SIGINT, encerrando worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 [WORKER] Recebido SIGTERM, encerrando worker...');
  await worker.close();
  process.exit(0);
});

console.log('🎵 [WORKER] BullMQ Audio Worker inicializado');