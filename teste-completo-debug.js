/**
 * 🎯 TESTE COMPLETO: Servidor + Teste dos logs [DEBUG]
 * 
 * Este script inicia o servidor E executa o teste em sequência
 * para verificar se os logs [DEBUG] aparecem corretamente.
 */

import { spawn } from 'child_process';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let serverProcess;

async function startServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Iniciando servidor...');
    
    serverProcess = spawn('node', ['server.js'], {
      cwd: join(__dirname, 'work'),
      stdio: 'pipe'
    });

    let serverReady = false;

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      
      if (output.includes('SoundyAI API rodando na porta 3000') && !serverReady) {
        serverReady = true;
        setTimeout(() => resolve(), 2000); // Aguarda 2s após o servidor estar pronto
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`Stderr: ${data}`);
    });

    serverProcess.on('error', (error) => {
      reject(error);
    });

    // Timeout de 10 segundos
    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Timeout: Servidor não iniciou em 10 segundos'));
      }
    }, 10000);
  });
}

async function runTest() {
  console.log('\n🔍 EXECUTANDO TESTE DOS LOGS [DEBUG]');
  console.log('=====================================');
  console.log('\n🎯 Criando job para verificar logs estratégicos...\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/audio/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileKey: "debug-test/sample.wav",
        mode: "genre", 
        fileName: "sample.wav"
      })
    });

    const result = await response.json();

    console.log('\n📋 RESULTADO DO TESTE:');
    if (response.ok) {
      console.log('✅ JOB CRIADO COM SUCESSO!');
      console.log(`   Job ID: ${result.jobId}`);
    } else {
      console.log('❌ ERRO ao criar job:', result);
    }

    console.log('\n🔍 AGORA VERIFIQUE OS LOGS DO SERVIDOR ACIMA!');
    console.log('   Procure por esses logs em sequência:');
    console.log('   1. [DEBUG] Chegou no ponto antes do queue.add()');
    console.log('   2. [DEBUG] Passou do queue.add()');
    console.log('   3. [BACKEND] ✅ Job adicionado à fila Redis com ID: ...');
    
  } catch (error) {
    console.error('💥 ERRO na requisição:', error.message);
  }
}

async function main() {
  try {
    await startServer();
    await runTest();
    
    console.log('\n⏳ Aguardando 5 segundos para você ver os logs...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error('💥 ERRO:', error.message);
  } finally {
    if (serverProcess) {
      console.log('\n🛑 Encerrando servidor...');
      serverProcess.kill('SIGINT');
    }
    process.exit(0);
  }
}

// Capturar Ctrl+C para limpar o servidor
process.on('SIGINT', () => {
  if (serverProcess) {
    serverProcess.kill('SIGINT');
  }
  process.exit(0);
});

main().catch(console.error);