// test-worker-flow.js - TESTE DEDICADO WORKER REDIS
import "dotenv/config";
import { spawn } from 'child_process';
import { audioQueue } from './work/queue/redis.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 [WORKER-FLOW] Iniciando teste focado no worker Redis...');

let workerProcess = null;

async function startWorker() {
  return new Promise((resolve, reject) => {
    console.log('🚀 [WORKER-FLOW] Iniciando worker...');
    
    workerProcess = spawn('node', ['worker-redis.js'], {
      cwd: path.join(__dirname, 'work'),
      stdio: 'pipe'
    });

    let workerReady = false;

    workerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[WORKER] ${output.trim()}`);
      
      if (output.includes('WORKER ÚNICO PRONTO') && !workerReady) {
        workerReady = true;
        console.log('✅ [WORKER-FLOW] Worker pronto para processar jobs!');
        resolve();
      }
    });

    workerProcess.stderr.on('data', (data) => {
      console.error(`[WORKER ERROR] ${data.toString().trim()}`);
    });

    workerProcess.on('error', (error) => {
      console.error('❌ [WORKER-FLOW] Erro ao iniciar worker:', error.message);
      reject(error);
    });

    // Timeout de 30 segundos para o worker iniciar
    setTimeout(() => {
      if (!workerReady) {
        reject(new Error('Worker não inicializou em 30 segundos'));
      }
    }, 30000);
  });
}

async function testJobProcessing() {
  console.log('📥 [WORKER-FLOW] Testando processamento de job...');
  
  const job = await audioQueue.add('analyze', {
    jobId: 'worker-flow-test-' + Date.now(),
    fileKey: 'uploads/test.wav',
    mode: 'genre',
    fileName: 'test.wav'
  });

  console.log(`📋 [WORKER-FLOW] Job enfileirado: ID=${job.id}`);
  
  // Monitorar por 30 segundos
  for (let i = 0; i < 30; i++) {
    const waiting = await audioQueue.getWaitingCount();
    const active = await audioQueue.getActiveCount();
    const completed = await audioQueue.getCompletedCount();
    const failed = await audioQueue.getFailedCount();
    
    console.log(`📊 [WORKER-FLOW] ${i+1}s: W:${waiting} A:${active} C:${completed} F:${failed}`);
    
    if (completed > 0) {
      console.log(`🎉 [WORKER-FLOW] JOB COMPLETED! Worker processou com sucesso!`);
      return true;
    }
    
    if (failed > 0) {
      console.log(`❌ [WORKER-FLOW] JOB FAILED! Worker falhou no processamento.`);
      return false;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`⏰ [WORKER-FLOW] Timeout - Job não foi processado em 30 segundos`);
  return false;
}

async function cleanup() {
  if (workerProcess) {
    console.log('🧹 [WORKER-FLOW] Encerrando worker...');
    workerProcess.kill('SIGTERM');
    workerProcess = null;
  }
}

async function runWorkerFlowTest() {
  try {
    await startWorker();
    await new Promise(resolve => setTimeout(resolve, 3000)); // Aguardar worker estabilizar
    const success = await testJobProcessing();
    
    if (success) {
      console.log('🎯 [WORKER-FLOW] ✅ TESTE PASSOU - Worker processa jobs corretamente!');
    } else {
      console.log('🎯 [WORKER-FLOW] ❌ TESTE FALHOU - Worker não processa jobs');
    }
    
  } catch (error) {
    console.error('❌ [WORKER-FLOW] Erro no teste:', error.message);
  } finally {
    await cleanup();
  }
}

// Garantir cleanup no exit
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

runWorkerFlowTest().catch(console.error);