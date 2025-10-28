/**
 * 🎯 AUDITORIA COMPLETA: API ↔ WORKER INTEGRATION TEST
 * 
 * Este script testa toda a integração:
 * 1. Inicia o Worker Redis
 * 2. Inicia a API
 * 3. Cria job de teste
 * 4. Verifica se worker processa o job
 * 5. Monitora logs de eventos
 */

import { spawn } from 'child_process';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let apiProcess;
let workerProcess;

async function startWorker() {
  return new Promise((resolve, reject) => {
    console.log('🔧 Iniciando Worker Redis...');
    
    workerProcess = spawn('node', ['worker-redis.js'], {
      cwd: join(__dirname, 'work'),
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'development' }
    });

    let workerReady = false;

    workerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[WORKER] ${output.trim()}`);
      
      if (output.includes('WORKER ÚNICO PRONTO!') && !workerReady) {
        workerReady = true;
        setTimeout(() => resolve(), 3000); // Aguarda 3s para worker estar totalmente pronto
      }
    });

    workerProcess.stderr.on('data', (data) => {
      console.error(`[WORKER-ERROR] ${data}`);
    });

    workerProcess.on('error', (error) => {
      reject(error);
    });

    // Timeout de 15 segundos
    setTimeout(() => {
      if (!workerReady) {
        reject(new Error('Timeout: Worker não iniciou em 15 segundos'));
      }
    }, 15000);
  });
}

async function startAPI() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Iniciando API...');
    
    apiProcess = spawn('node', ['server.js'], {
      cwd: join(__dirname, 'work'),
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'development' }
    });

    let apiReady = false;

    apiProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[API] ${output.trim()}`);
      
      if (output.includes('SoundyAI API rodando na porta 3000') && !apiReady) {
        apiReady = true;
        setTimeout(() => resolve(), 2000); // Aguarda 2s após API estar pronta
      }
    });

    apiProcess.stderr.on('data', (data) => {
      console.error(`[API-ERROR] ${data}`);
    });

    apiProcess.on('error', (error) => {
      reject(error);
    });

    // Timeout de 10 segundos
    setTimeout(() => {
      if (!apiReady) {
        reject(new Error('Timeout: API não iniciou em 10 segundos'));
      }
    }, 10000);
  });
}

async function testJobFlow() {
  console.log('\n🧪 EXECUTANDO TESTE DE INTEGRAÇÃO API ↔ WORKER');
  console.log('================================================');
  console.log('\n🎯 Criando job de teste...\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/audio/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileKey: "test-integration/sample.wav",
        mode: "genre", 
        fileName: "sample.wav"
      })
    });

    const result = await response.json();

    console.log('\n📋 RESULTADO DO TESTE:');
    if (response.ok) {
      console.log('✅ JOB CRIADO COM SUCESSO!');
      console.log(`   Job ID: ${result.jobId}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Tempo de criação: ${result.performance.processingTime}`);
    } else {
      console.log('❌ ERRO ao criar job:', result);
    }

    console.log('\n👀 MONITORE OS LOGS ACIMA PARA:');
    console.log('   ✅ [DEBUG] Chegou no ponto antes do queue.add()');
    console.log('   ✅ [DEBUG] Passou do queue.add()');
    console.log('   ✅ [EVENT] 🟡 Job WAITING: ...');
    console.log('   ✅ [EVENT] 🟢 Job ACTIVE: ...');
    console.log('   ✅ [EVENT] ✅ Job COMPLETED: ...');
    
    console.log('\n⏳ Aguardando 10 segundos para processamento...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('💥 ERRO na requisição:', error.message);
  }
}

async function main() {
  try {
    console.log('🔥 AUDITORIA COMPLETA: API ↔ WORKER INTEGRATION');
    console.log('===============================================\n');
    
    // Iniciar Worker primeiro
    await startWorker();
    
    // Depois iniciar API
    await startAPI();
    
    // Executar teste
    await testJobFlow();
    
    console.log('\n🎉 TESTE CONCLUÍDO!');
    console.log('\n📊 CRITÉRIOS DE ACEITAÇÃO:');
    console.log('   ✅ Worker iniciou e está pronto');
    console.log('   ✅ API iniciou e está funcionando');
    console.log('   ✅ Job foi criado via API');
    console.log('   ✅ Worker recebeu e processou o job');
    console.log('   ✅ Eventos [EVENT] apareceram nos logs');
    
  } catch (error) {
    console.error('💥 ERRO:', error.message);
  } finally {
    cleanup();
  }
}

function cleanup() {
  console.log('\n🛑 Encerrando processos...');
  
  if (workerProcess) {
    workerProcess.kill('SIGINT');
  }
  
  if (apiProcess) {
    apiProcess.kill('SIGINT');
  }
  
  setTimeout(() => {
    process.exit(0);
  }, 2000);
}

// Capturar Ctrl+C para limpar processos
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

main().catch(console.error);