// 🎚️ TESTE DYNAMIC RANGE FIX
// Verifica se a implementação de Dynamic Range está funcionando

import { calculateCoreMetrics } from "./api/audio/core-metrics.js";
import { generateJSONOutput } from "./api/audio/json-output.js";

console.log("🧪 Testando implementação de Dynamic Range...");

// Simular dados de áudio segmentados (conforme esperado pela Fase 5.2)
// Usando áudio mais longo para garantir janelas suficientes para TT-DR
const audioLength = 48000 * 5; // 5 segundos a 48kHz
const mockSegmentedAudio = {
  framesFFT: [
    {
      magnitude: new Array(2048).fill(0).map(() => Math.random() * 0.1),
      phase: new Array(2048).fill(0).map(() => Math.random() * Math.PI * 2)
    }
  ],
  framesRMS: [
    { left: Math.random() * 0.1, right: Math.random() * 0.1, mid: Math.random() * 0.1 }
  ],
  // Gerar áudio com variações dinâmicas mais realistas
  originalLeft: new Float32Array(audioLength).fill(0).map((_, i) => {
    // Simular áudio com diferentes dinâmicas: seções quietas e altas
    const timePercent = i / audioLength;
    const dynamicVariation = timePercent < 0.3 ? 0.1 : timePercent < 0.7 ? 0.8 : 0.3;
    return (Math.random() - 0.5) * dynamicVariation;
  }),
  originalRight: new Float32Array(audioLength).fill(0).map((_, i) => {
    const timePercent = i / audioLength;
    const dynamicVariation = timePercent < 0.3 ? 0.12 : timePercent < 0.7 ? 0.75 : 0.35;
    return (Math.random() - 0.5) * dynamicVariation;
  }),
  sampleRate: 48000,
  duration: 5.0,
  numberOfChannels: 2,
  originalLength: audioLength
};

async function testDynamicRange() {
  try {
    console.log("📊 Calculando métricas core...");
    
    // Teste do calculateCoreMetrics com dynamics
    const coreMetrics = await calculateCoreMetrics(mockSegmentedAudio);
    
    console.log("✅ Core metrics calculados!");
    console.log("🔍 Estrutura dynamics:", {
      hasDynamics: !!(coreMetrics.dynamics),
      dynamicsKeys: coreMetrics.dynamics ? Object.keys(coreMetrics.dynamics) : [],
      ttDR: coreMetrics.dynamics?.tt_dr,
      dynamicRange: coreMetrics.dynamics?.dynamic_range,
      crestFactor: coreMetrics.dynamics?.crest_factor_db
    });
    
    // Teste do JSON Output
    console.log("📦 Gerando JSON final...");
    const jsonOutput = generateJSONOutput(coreMetrics, null, { 
      fileName: "test-audio.wav",
      fileSize: 48000 * 2 * 2  
    });
    
    console.log("✅ JSON Output gerado!");
    console.log("🔍 Dynamics no JSON:", {
      technicalData: {
        dynamicRange: jsonOutput.technicalData.dynamicRange,
        ttDR: jsonOutput.technicalData.ttDR,
        crestFactor: jsonOutput.technicalData.crestFactor
      },
      dynamicsSection: jsonOutput.dynamics ? {
        ttDR: jsonOutput.dynamics.ttDR,
        crestFactor: jsonOutput.dynamics.crestFactor,
        hasData: jsonOutput.dynamics.hasData
      } : "MISSING"
    });
    
    // Verificação crítica
    const hasBasicDR = !!(jsonOutput.technicalData.dynamicRange || jsonOutput.technicalData.ttDR);
    const hasDynamicsSection = !!(jsonOutput.dynamics && jsonOutput.dynamics.hasData);
    
    console.log("\n🎯 RESULTADO DO TESTE:");
    console.log(`   ✅ Core Metrics Dynamics: ${coreMetrics.dynamics ? '✓ OK' : '❌ FALTANDO'}`);
    console.log(`   ✅ JSON Technical Data: ${hasBasicDR ? '✓ OK' : '❌ FALTANDO'}`);
    console.log(`   ✅ JSON Dynamics Section: ${hasDynamicsSection ? '✓ OK' : '❌ FALTANDO'}`);
    
    if (hasBasicDR && hasDynamicsSection) {
      console.log("\n🏆 SUCESSO! Dynamic Range implementado corretamente!");
      console.log("   → Pipeline core-metrics.js: ✓");
      console.log("   → Extração json-output.js: ✓");
      console.log("   → Estrutura JSON final: ✓");
    } else {
      console.log("\n❌ PROBLEMA! Algumas métricas ainda estão faltando.");
    }
    
    return jsonOutput;
    
  } catch (error) {
    console.error("❌ Erro no teste:", error);
    console.error("Stack:", error.stack);
    return null;
  }
}

// Executar teste
testDynamicRange().then((result) => {
  if (result) {
    console.log("\n📄 JSON final salvo para análise:", {
      score: result.score,
      classification: result.classification,
      hasDynamics: !!(result.dynamics && result.dynamics.hasData)
    });
  }
  console.log("\n🏁 Teste concluído.");
}).catch(console.error);