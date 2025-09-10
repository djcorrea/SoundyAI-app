// 🧪 TESTE COMPLETO DO PIPELINE DE ANÁLISE DE ÁUDIO
// Valida se todas as fases funcionam corretamente

import fs from 'fs';
import path from 'path';
import { processAudioComplete } from './api/audio/pipeline-complete.js';

console.log('🧪 INICIANDO TESTE COMPLETO DO PIPELINE...\n');

// Gerar um arquivo WAV de teste simples (1 segundo, 1kHz, 48kHz estéreo)
function generateTestWav() {
  const sampleRate = 48000;
  const duration = 1.0;
  const frequency = 1000;
  const samples = Math.floor(sampleRate * duration);
  
  // Header WAV (44 bytes)
  const headerSize = 44;
  const dataSize = samples * 4; // 2 channels * 2 bytes per sample
  const fileSize = headerSize + dataSize;
  
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  
  // WAV Header
  let offset = 0;
  
  // "RIFF"
  view.setUint32(offset, 0x52494646, false); offset += 4;
  // File size - 8
  view.setUint32(offset, fileSize - 8, true); offset += 4;
  // "WAVE"
  view.setUint32(offset, 0x57415645, false); offset += 4;
  // "fmt "
  view.setUint32(offset, 0x666d7420, false); offset += 4;
  // fmt chunk size
  view.setUint32(offset, 16, true); offset += 4;
  // Audio format (1 = PCM)
  view.setUint16(offset, 1, true); offset += 2;
  // Channels
  view.setUint16(offset, 2, true); offset += 2;
  // Sample rate
  view.setUint32(offset, sampleRate, true); offset += 4;
  // Byte rate
  view.setUint32(offset, sampleRate * 4, true); offset += 4;
  // Block align
  view.setUint16(offset, 4, true); offset += 2;
  // Bits per sample
  view.setUint16(offset, 16, true); offset += 2;
  // "data"
  view.setUint32(offset, 0x64617461, false); offset += 4;
  // Data chunk size
  view.setUint32(offset, dataSize, true); offset += 4;
  
  // Audio data (1kHz sine wave)
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.5; // -6dB
    const intSample = Math.round(sample * 32767);
    
    // Left channel
    view.setInt16(offset, intSample, true); offset += 2;
    // Right channel  
    view.setInt16(offset, intSample, true); offset += 2;
  }
  
  return new Uint8Array(buffer);
}

async function testPipeline() {
  try {
    console.log('📁 Carregando arquivo WAV de teste (sine 48kHz)...');
    const testFile = './tests/test-sine-48k.wav';
    
    if (!fs.existsSync(testFile)) {
      throw new Error(`Arquivo de teste não encontrado: ${testFile}`);
    }
    
    const audioBuffer = fs.readFileSync(testFile);
    console.log(`✅ WAV carregado: ${audioBuffer.length} bytes`);
    console.log(`🔍 É Buffer? ${Buffer.isBuffer(audioBuffer)}\n`);
    
    console.log('🚀 Executando pipeline completo...');
    const startTime = Date.now();
    
    const result = await processAudioComplete(audioBuffer, 'test-sine-48k.wav', {});
    
    const totalTime = Date.now() - startTime;
    console.log(`⏱️ Pipeline executado em ${totalTime}ms\n`);
    
    // Validações
    console.log('🔍 VALIDANDO RESULTADO:');
    
    // Status
    console.log(`   ✅ Status: ${result.status || 'success'}`);
    
    // Score
    if (typeof result.score === 'number') {
      console.log(`   ✅ Score: ${result.score}% (${result.classification})`);
    } else {
      console.log(`   ❌ Score inválido: ${result.score}`);
    }
    
    // Technical Data
    if (result.technicalData) {
      const tech = result.technicalData;
      console.log('   📊 Technical Data:');
      console.log(`      LUFS: ${tech.lufsIntegrated} LUFS`);
      console.log(`      True Peak: ${tech.truePeakDbtp} dBTP`);
      console.log(`      Correlação: ${tech.stereoCorrelation}`);
      console.log(`      DR: ${tech.dynamicRange}`);
      console.log(`      LRA: ${tech.lra} LU`);
      
      // Bandas espectrais
      if (tech.frequencyBands) {
        const bands = Object.keys(tech.frequencyBands);
        console.log(`      Bandas: ${bands.length} bandas (${bands.join(', ')})`);
      } else {
        console.log('      ❌ Bandas espectrais ausentes');
      }
    } else {
      console.log('   ❌ Technical Data ausente');
    }
    
    // Metadata
    if (result.metadata) {
      console.log(`   ✅ Metadata: ${result.metadata.engineVersion}`);
      console.log(`   ✅ Processamento: ${result.metadata.processingTime}ms`);
    } else {
      console.log('   ❌ Metadata ausente');
    }
    
    // Arrays esperados pela UI
    console.log('   🔍 Arrays para UI:');
    if (Array.isArray(result.references?.applied)) {
      console.log(`      ✅ references.applied: ${result.references.applied.length} items`);
    } else {
      console.log('      ⚠️ references.applied não é array ou ausente');
    }
    
    if (Array.isArray(result.references?.library)) {
      console.log(`      ✅ references.library: ${result.references.library.length} items`);
    } else {
      console.log('      ⚠️ references.library não é array ou ausente');
    }
    
    if (Array.isArray(result.problems)) {
      console.log(`      ✅ problems: ${result.problems.length} items`);
    } else {
      console.log('      ⚠️ problems não é array ou ausente');
    }
    
    if (Array.isArray(result.suggestions)) {
      console.log(`      ✅ suggestions: ${result.suggestions.length} items`);
    } else {
      console.log('      ⚠️ suggestions não é array ou ausente');
    }
    
    // Serialização JSON
    try {
      const jsonStr = JSON.stringify(result);
      console.log(`   ✅ JSON serializável: ${jsonStr.length} chars`);
    } catch (e) {
      console.log(`   ❌ JSON não serializável: ${e.message}`);
    }
    
    console.log('\n🎯 RESUMO DO TESTE:');
    if (result.status === 'success' && 
        typeof result.score === 'number' && 
        result.technicalData &&
        typeof result.technicalData.lufsIntegrated === 'number') {
      console.log('✅ PIPELINE FUNCIONANDO CORRETAMENTE!');
      console.log('   - Todas as fases executaram');
      console.log('   - Métricas calculadas com sucesso');
      console.log('   - JSON estruturado corretamente');
    } else {
      console.log('❌ PIPELINE COM PROBLEMAS!');
      console.log('   - Verifique logs de erro acima');
    }
    
    // Salvar resultado para inspeção
    fs.writeFileSync('./test-pipeline-result.json', JSON.stringify(result, null, 2));
    console.log('💾 Resultado salvo em test-pipeline-result.json');
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testPipeline();
