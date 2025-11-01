#!/usr/bin/env node

/**
 * 🧪 TESTE REAL: Modo de Comparação com arquivos existentes
 * Usa arquivos que já foram processados anteriormente
 */

import "dotenv/config";

// URL base da API
const BASE_URL = "http://localhost:3000";

async function testRealComparisonMode() {
  console.log("🧪 TESTE REAL: Modo de Comparação");
  console.log("=====================================");

  try {
    // Usar arquivos que já existem no bucket (baseado nos jobs que vimos)
    const testData = {
      userFileKey: "uploads/DJ_TOPO_QUEM_NAO_QUER_SOU_EU_mastered_1730397160052.wav",
      referenceFileKey: "uploads/4_Piano_Magico_DJ_Correa_MC_Lipivox_e_MC_Baiano_1730396617014.wav", 
      userFileName: "DJ_TOPO_QUEM_NAO_QUER_SOU_EU.wav",
      refFileName: "Piano_Magico_Referencia.wav"
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
    
    const result = await response.json();
    console.log('📄 Resposta:', JSON.stringify(result, null, 2));
    
    // Verificar se o formato está correto
    if (result.success && result.jobId && result.mode === "comparison") {
      console.log('\n✅ SUCESSO! Rota /compare funcionando com arquivos reais.');
      console.log(`🆔 Job ID: ${result.jobId}`);
      console.log(`🎧 Mode: ${result.mode}`);
      
      console.log('\n🔍 Aguardando processamento...');
      console.log('💡 Este teste usa arquivos reais do bucket, deve processar corretamente.');
      console.log(`💡 Execute: node check-jobs-comparison.js para acompanhar o progresso.`);
      
    } else {
      console.log('\n⚠️ Resposta não está no formato esperado.');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Executar teste
testRealComparisonMode().catch(console.error);