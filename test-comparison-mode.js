#!/usr/bin/env node

/**
 * 🧪 TESTE RÁPIDO: MODO COMPARAÇÃO
 * Testa se a nova rota /compare e o modo comparison funcionam
 */

import "dotenv/config";

// URL base da API
const BASE_URL = "http://localhost:3000";

async function testComparisonMode() {
  console.log("🧪 TESTE: Modo de Comparação");
  console.log("=====================================");

  try {
    // Dados de teste - simular fileKeys válidos
    const testData = {
      userFileKey: "uploads/test_user_audio.wav",
      referenceFileKey: "uploads/test_reference_audio.wav", 
      userFileName: "minha_musica.wav",
      refFileName: "referencia.wav"
    };

    console.log("📡 Enviando para /api/audio/compare...");
    console.log("📋 Dados:", JSON.stringify(testData, null, 2));

    const response = await fetch(`${BASE_URL}/api/audio/compare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    console.log('📡 Status HTTP:', response.status);
    console.log('📋 Headers:', Object.fromEntries(response.headers.entries()));
    
    const result = await response.json();
    console.log('📄 Resposta:', JSON.stringify(result, null, 2));
    
    // Verificar se o formato está correto
    if (result.success && result.jobId && result.mode === "comparison") {
      console.log('\n✅ SUCESSO! Rota /compare funcionando.');
      console.log(`🆔 Job ID: ${result.jobId}`);
      console.log(`🎧 Mode: ${result.mode}`);
      
      console.log('\n🔍 Aguardando processamento...');
      console.log('💡 Verifique o worker.js para logs do processamento comparativo.');
      
    } else {
      console.log('\n⚠️ Resposta não está no formato esperado.');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Executar teste
testComparisonMode().catch(console.error);