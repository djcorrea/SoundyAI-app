// 🔍 TESTE BANDAS ESPECTRAIS
// Verificar por que não aparecem no modal

import { calculateCoreMetrics } from "./api/audio/core-metrics.js";
import { generateJSONOutput } from "./api/audio/json-output.js";

console.log("🔬 Testando bandas espectrais...");

// Simular dados com múltiplos frames para garantir espectro
const audioLength = 48000 * 3; // 3 segundos

// Estrutura correta esperada pelo core-metrics.js
const mockSegmentedAudio = {
  framesFFT: {
    count: 2,
    frameSize: 4096,
    hopSize: 1024,
    windowType: "hann",
    left: [
      new Float32Array(4096).fill(0).map(() => (Math.random() - 0.5) * 0.8),
      new Float32Array(4096).fill(0).map(() => (Math.random() - 0.5) * 0.8)
    ],
    right: [
      new Float32Array(4096).fill(0).map(() => (Math.random() - 0.5) * 0.8), 
      new Float32Array(4096).fill(0).map(() => (Math.random() - 0.5) * 0.8)
    ]
  },
  framesRMS: [
    { left: Math.random() * 0.2, right: Math.random() * 0.2, mid: Math.random() * 0.2 }
  ],
  originalLeft: new Float32Array(audioLength).fill(0).map(() => (Math.random() - 0.5) * 0.8),
  originalRight: new Float32Array(audioLength).fill(0).map(() => (Math.random() - 0.5) * 0.8),
  sampleRate: 48000,
  duration: 3.0,
  numberOfChannels: 2,
  originalLength: audioLength
};

async function testSpectralBands() {
  try {
    console.log("📊 Calculando métricas core...");
    const coreMetrics = await calculateCoreMetrics(mockSegmentedAudio);
    
    console.log("\n🔍 ANÁLISE DAS ESTRUTURAS ESPECTRAIS:");
    
    // 1. FFT frequencyBands (para bandEnergies)
    console.log("1️⃣ FFT frequencyBands:", {
      hasFFT: !!(coreMetrics.fft),
      hasFrequencyBands: !!(coreMetrics.fft?.frequencyBands),
      hasLeft: !!(coreMetrics.fft?.frequencyBands?.left),
      leftBands: coreMetrics.fft?.frequencyBands?.left ? Object.keys(coreMetrics.fft.frequencyBands.left) : [],
      sampleData: coreMetrics.fft?.frequencyBands?.left?.subBass ? {
        min: coreMetrics.fft.frequencyBands.left.subBass.min,
        max: coreMetrics.fft.frequencyBands.left.subBass.max,
        energy: coreMetrics.fft.frequencyBands.left.subBass.energy
      } : null
    });
    
    // DEBUG ADICIONAL: Verificar condição exata do json-output.js
    console.log("🔍 DEBUG FFT CONDITION:");
    console.log("  coreMetrics.fft:", !!coreMetrics.fft);
    console.log("  coreMetrics.fft?.frequencyBands:", !!(coreMetrics.fft?.frequencyBands));
    console.log("  coreMetrics.fft?.frequencyBands?.left:", !!(coreMetrics.fft?.frequencyBands?.left));
    console.log("  Condition result:", !!(coreMetrics.fft?.frequencyBands?.left));
    if (coreMetrics.fft?.frequencyBands?.left) {
      console.log("  First band entry:", Object.entries(coreMetrics.fft.frequencyBands.left)[0]);
    }
    
    // 2. SpectralBands aggregated (para spectral_balance)
    console.log("2️⃣ SpectralBands aggregated:", {
      hasSpectralBands: !!(coreMetrics.spectralBands),
      hasAggregated: !!(coreMetrics.spectralBands?.aggregated),
      aggregatedKeys: coreMetrics.spectralBands?.aggregated ? Object.keys(coreMetrics.spectralBands.aggregated) : [],
      processedFrames: coreMetrics.spectralBands?.aggregated?.processedFrames,
      sampleValues: coreMetrics.spectralBands?.aggregated ? {
        sub: coreMetrics.spectralBands.aggregated.sub,
        bass: coreMetrics.spectralBands.aggregated.bass,
        mid: coreMetrics.spectralBands.aggregated.mid
      } : null
    });
    
    console.log("\n📦 Gerando JSON...");
    const jsonOutput = generateJSONOutput(coreMetrics, null, { 
      fileName: "test-spectral.wav",
      fileSize: audioLength * 2 * 2  
    });
    
    console.log("\n📋 JSON FINAL - ESPECTRAL:");
    console.log("✅ technicalData.bandEnergies:", {
      exists: !!(jsonOutput.technicalData.bandEnergies),
      keys: jsonOutput.technicalData.bandEnergies ? Object.keys(jsonOutput.technicalData.bandEnergies) : [],
      sample: jsonOutput.technicalData.bandEnergies ? Object.values(jsonOutput.technicalData.bandEnergies)[0] : null
    });
    
    console.log("✅ technicalData.spectral_balance:", {
      exists: !!(jsonOutput.technicalData.spectral_balance),
      keys: jsonOutput.technicalData.spectral_balance ? Object.keys(jsonOutput.technicalData.spectral_balance) : [],
      values: jsonOutput.technicalData.spectral_balance
    });
    
    console.log("✅ spectralBands seção:", {
      exists: !!(jsonOutput.spectralBands),
      hasData: jsonOutput.spectralBands?.hasData,
      processedFrames: jsonOutput.spectralBands?.processedFrames,
      detailedKeys: jsonOutput.spectralBands?.detailed ? Object.keys(jsonOutput.spectralBands.detailed) : [],
      simplifiedKeys: jsonOutput.spectralBands?.simplified ? Object.keys(jsonOutput.spectralBands.simplified) : []
    });
    
    console.log("✅ frequencyBands no technicalData:", {
      exists: !!(jsonOutput.technicalData.frequencyBands),
      keys: jsonOutput.technicalData.frequencyBands ? Object.keys(jsonOutput.technicalData.frequencyBands) : []
    });
    
    // Verificar se alguma das estruturas está vazia
    const hasBandEnergies = jsonOutput.technicalData.bandEnergies && Object.keys(jsonOutput.technicalData.bandEnergies).length > 0;
    const hasSpectralBalance = jsonOutput.technicalData.spectral_balance && Object.keys(jsonOutput.technicalData.spectral_balance).length > 0;
    const hasFrequencyBands = jsonOutput.technicalData.frequencyBands && Object.keys(jsonOutput.technicalData.frequencyBands).length > 0;
    
    console.log("\n🎯 DIAGNÓSTICO FINAL:");
    console.log(`   🔵 bandEnergies (FFT): ${hasBandEnergies ? '✓ OK' : '❌ VAZIO'}`);
    console.log(`   🔵 spectral_balance (SpectralBands): ${hasSpectralBalance ? '✓ OK' : '❌ VAZIO'}`);  
    console.log(`   🔵 frequencyBands (legacy): ${hasFrequencyBands ? '✓ OK' : '❌ VAZIO'}`);
    console.log(`   🔵 spectralBands.hasData: ${jsonOutput.spectralBands?.hasData ? '✓ OK' : '❌ FALSE'}`);
    
    if (!hasBandEnergies && !hasSpectralBalance && !hasFrequencyBands) {
      console.log("\n❌ PROBLEMA: Nenhuma estrutura espectral foi gerada!");
      console.log("   → Investigar core-metrics.js: calculateFFTMetrics() e processamento de spectralBands");
    } else {
      console.log("\n✅ Pelo menos uma estrutura foi gerada com sucesso!");
    }
    
    return jsonOutput;
    
  } catch (error) {
    console.error("❌ Erro no teste:", error);
    console.error("Stack:", error.stack);
    return null;
  }
}

// Executar teste
testSpectralBands().then((result) => {
  console.log("\n🏁 Teste concluído.");
}).catch(console.error);