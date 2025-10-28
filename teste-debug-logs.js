/**
 * 🎯 TESTE ESPECÍFICO: Validação dos logs [DEBUG]
 * 
 * Este script testa se os logs estratégicos estão aparecendo:
 * - [DEBUG] Chegou no ponto antes do queue.add()
 * - [DEBUG] Passou do queue.add() 
 * 
 * Execução: node teste-debug-logs.js
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000';

async function testDebugLogs() {
  console.log('🔍 TESTE DOS LOGS [DEBUG]');
  console.log('==========================');
  console.log('');
  console.log('🎯 Criando job para verificar os logs estratégicos...');
  console.log('');
  console.log('⚠️  OBSERVE NO TERMINAL DO BACKEND:');
  console.log('   ✅ [DEBUG] Chegou no ponto antes do queue.add()');
  console.log('   ✅ [DEBUG] Passou do queue.add()');
  console.log('   ✅ [BACKEND] ✅ Job adicionado à fila Redis com ID: ...');
  console.log('');
  console.log('🚨 SE NÃO APARECER:');
  console.log('   ❌ Apenas o primeiro [DEBUG] = erro dentro de queue.add()');
  console.log('   ❌ Nenhum [DEBUG] = código inserido no lugar errado');
  console.log('   ❌ Os dois [DEBUG] mas nada no worker = fila/conexão diferente');
  console.log('');
  console.log('🔥 EXECUTANDO TESTE...');
  console.log('');

  try {
    const response = await fetch(`${API_BASE}/api/audio/analyze`, {
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

    if (response.ok) {
      console.log('✅ JOB CRIADO COM SUCESSO!');
      console.log(`   Job ID: ${result.jobId}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Modo: ${result.mode}`);
      console.log('');
      console.log('🔍 AGORA VERIFIQUE OS LOGS DO BACKEND ACIMA!');
      console.log('   Devem aparecer exatamente esses 3 logs em sequência:');
      console.log('   1. [DEBUG] Chegou no ponto antes do queue.add()');
      console.log('   2. [DEBUG] Passou do queue.add()');
      console.log('   3. [BACKEND] ✅ Job adicionado à fila Redis com ID: ...');
      console.log('');
      console.log('👀 E NO WORKER (se estiver rodando):');
      console.log('   - [EVENT] WAITING -> Job ...');
      console.log('   - [EVENT] ACTIVE -> Job ...');
      
    } else {
      console.error('❌ ERRO ao criar job:', result);
      console.log('');
      console.log('🔍 MAS AINDA ASSIM, VERIFIQUE SE OS LOGS [DEBUG] APARECEM:');
      console.log('');
      console.log('✅ SE APARECER APENAS:');
      console.log('   [DEBUG] Chegou no ponto antes do queue.add()');
      console.log('   ❌ Significa que teve erro dentro do queue.add()');
      console.log('');
      console.log('✅ SE APARECEREM OS DOIS [DEBUG]:');
      console.log('   [DEBUG] Chegou no ponto antes do queue.add()');
      console.log('   [DEBUG] Passou do queue.add()');
      console.log('   ✅ O queue.add() funcionou! Erro é em outro lugar (DB, etc)');
      console.log('');
      console.log('❌ SE NÃO APARECER NENHUM [DEBUG]:');
      console.log('   ❌ Código foi inserido no lugar errado');
    }

  } catch (error) {
    console.error('💥 ERRO na requisição:', error.message);
  }
}

// 🚀 EXECUTAR TESTE
testDebugLogs().catch(console.error);