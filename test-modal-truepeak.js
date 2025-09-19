#!/usr/bin/env node
/**
 * 🧪 TESTE ESPECÍFICO - Modal True Peak
 * 
 * Verifica se o modal agora recebe valores de placeholder em vez da implementação antiga
 */

import { analyzeTruePeaks } from "./work/lib/audio/features/truepeak.js";

console.log("🧪 TESTE: Modal True Peak - Verificação de Placeholder");
console.log("=" .repeat(60));

async function testModalTruePeak() {
  // Simular áudio com nível específico para verificar os valores
  const sampleRate = 48000;
  const samples = 1024; // Pequeno para teste rápido
  
  // Gerar tom de -12dB (0.25 amplitude)
  const leftChannel = new Float32Array(samples);
  const rightChannel = new Float32Array(samples);
  
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const freq = 1000; // 1kHz
    const amplitude = 0.25; // -12dB
    
    leftChannel[i] = amplitude * Math.sin(2 * Math.PI * freq * t);
    rightChannel[i] = amplitude * Math.sin(2 * Math.PI * freq * t);
  }
  
  console.log(`📊 Teste: ${samples} samples, ${sampleRate}Hz, 1kHz tone @ -12dB`);
  
  // Chamar análise True Peak
  const result = await analyzeTruePeaks(leftChannel, rightChannel, sampleRate);
  
  console.log("\n🔍 RESULTADO DO MODAL:");
  console.log("  true_peak_dbtp:", result.true_peak_dbtp);
  console.log("  maxDbtp:", result.maxDbtp);
  console.log("  _ffmpeg_integration_status:", result._ffmpeg_integration_status);
  
  console.log("\n✅ VALIDAÇÃO MODAL:");
  
  // Verificar se são placeholders baseados em sample peak
  const expectedSamplePeak = 20 * Math.log10(0.25); // -12.04dB
  
  if (result._ffmpeg_integration_status === 'pending') {
    console.log("  ✅ Status: PLACEHOLDER MODE (correto)");
  } else {
    console.log("  ❌ Status: NÃO É PLACEHOLDER!");
  }
  
  if (Math.abs(result.true_peak_dbtp - expectedSamplePeak) < 0.1) {
    console.log("  ✅ Valor: Usando Sample Peak como fallback (correto)");
  } else {
    console.log("  ❌ Valor: NÃO é sample peak! Pode ser implementação antiga!");
  }
  
  console.log("\n🎯 CONCLUSÃO:");
  if (result._ffmpeg_integration_status === 'pending') {
    console.log("  🟢 SUCESSO: Modal receberá valores PLACEHOLDER");
    console.log("  📱 Frontend mostrará sample peak até integração FFmpeg");
    console.log("  ⚠️  True Peak fields aguardando FFmpeg (comportamento esperado)");
  } else {
    console.log("  🔴 PROBLEMA: Modal ainda pode estar usando implementação antiga!");
    console.log("  🔧 Verificar se existe outro arquivo truepeak.js sendo usado");
  }
}

testModalTruePeak().catch(console.error);