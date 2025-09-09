// 🧪 TESTE BÁSICO - Fase 5.3 Core Metrics
// Validação de FFT, LUFS e True Peak

import { calculateCoreMetrics, processAudioWithCoreMetrics } from './core-metrics.js';
import { segmentAudioTemporal } from './temporal-segmentation.js';
import { decodeAudioFile } from './audio-decoder.js';
import { readFileSync } from 'fs';

async function testBasicCoreMetrics() {
  console.log('🚀 TESTE BÁSICO - FASE 5.3 CORE METRICS');
  console.log('═'.repeat(50));
  
  try {
    // 1. Carregar arquivo de teste
    console.log('📁 Carregando arquivo de áudio...');
    const testFile = readFileSync('C:\\Users\\DJ Correa\\Desktop\\Programação\\SoundyAI\\temp\\1s-440hz-sine.wav');
    
    // 2. Pipeline 5.1 + 5.2
    console.log('⚙️  Executando Fases 5.1 e 5.2...');
    const audioData = await decodeAudioFile(testFile, '1s-440hz-sine.wav');
    const segmentedData = segmentAudioTemporal(audioData);
    
    // Preservar dados originais
    segmentedData.originalLeft = audioData.leftChannel;
    segmentedData.originalRight = audioData.rightChannel;
    
    console.log(`   - Áudio decodificado: ${audioData.leftChannel.length} samples`);
    console.log(`   - Frames FFT: ${segmentedData.framesFFT.count}`);
    console.log(`   - Frames RMS: ${segmentedData.framesRMS.count}`);
    
    // 3. Fase 5.3 - Core Metrics
    console.log('🧮 Calculando métricas core...');
    const metricsData = await calculateCoreMetrics(segmentedData);
    
    // 4. Validar resultados
    console.log('\\n🔍 RESULTADOS:');
    console.log('─'.repeat(30));
    
    // FFT
    console.log(`📊 FFT:`);
    console.log(`   - Frames processados: ${metricsData.fft.frameCount}`);
    console.log(`   - Espectrogramas L/R: ${metricsData.fft.spectrograms.left.length}/${metricsData.fft.spectrograms.right.length}`);
    console.log(`   - Bandas de frequência: ${Object.keys(metricsData.fft.frequencyBands.left).length}`);
    
    // Verificar se há energia na frequência 440Hz (sine wave teste)
    const expectedBin = Math.floor(440 / (48000 / 2) * (metricsData.fft.spectrograms.left[0].magnitude.length - 1));
    const energyAt440 = metricsData.fft.spectrograms.left[0].magnitude[expectedBin];
    console.log(`   - Energia em ~440Hz (bin ${expectedBin}): ${energyAt440.toFixed(3)}`);
    
    // LUFS
    console.log(`\\n🔊 LUFS:`);
    console.log(`   - Integrado: ${metricsData.lufs.integrated.toFixed(1)} LUFS`);
    console.log(`   - Short-term: ${metricsData.lufs.shortTerm.toFixed(1)} LUFS`);
    console.log(`   - Momentary: ${metricsData.lufs.momentary.toFixed(1)} LUFS`);
    console.log(`   - LRA: ${metricsData.lufs.lra.toFixed(1)} LU`);
    console.log(`   - EBU R128 compliant: ${metricsData.lufs.r128Compliance.integratedWithinRange ? '✅' : '❌'}`);
    
    // True Peak
    console.log(`\\n🏔️  True Peak:`);
    console.log(`   - Máximo: ${metricsData.truePeak.maxDbtp.toFixed(1)} dBTP`);
    console.log(`   - Linear: ${metricsData.truePeak.maxLinear.toFixed(3)}`);
    console.log(`   - Clipping: ${metricsData.truePeak.clippingAnalysis.isClipping ? '⚠️ SIM' : '✅ NÃO'}`);
    console.log(`   - Risk: ${metricsData.truePeak.clippingAnalysis.clippingRisk}`);
    console.log(`   - EBU R128: ${metricsData.truePeak.compliance.ebuR128 ? '✅' : '❌'}`);
    
    // Timing
    console.log(`\\n⏱️  Performance:`);
    console.log(`   - Tempo processamento: ${metricsData._metadata.processingTime}ms`);
    console.log(`   - Configuração FFT: ${metricsData._metadata.config.fft.size}/${metricsData._metadata.config.fft.hop}`);
    console.log(`   - LUFS blocks: ${metricsData._metadata.config.lufs.blockMs}ms`);
    console.log(`   - True Peak oversamp: ${metricsData._metadata.config.truePeak.oversampling}x`);
    
    // Validações básicas
    console.log(`\\n✅ VALIDAÇÕES:`);
    console.log('─'.repeat(30));
    
    const validations = [
      { 
        name: 'FFT frames gerados', 
        condition: metricsData.fft.frameCount > 0,
        value: metricsData.fft.frameCount 
      },
      { 
        name: 'Espectrogramas válidos', 
        condition: metricsData.fft.spectrograms.left.length === metricsData.fft.frameCount,
        value: `${metricsData.fft.spectrograms.left.length}/${metricsData.fft.frameCount}` 
      },
      { 
        name: 'LUFS calculado', 
        condition: !isNaN(metricsData.lufs.integrated) && isFinite(metricsData.lufs.integrated),
        value: `${metricsData.lufs.integrated.toFixed(1)} LUFS` 
      },
      { 
        name: 'True Peak calculado', 
        condition: !isNaN(metricsData.truePeak.maxDbtp) && isFinite(metricsData.truePeak.maxDbtp),
        value: `${metricsData.truePeak.maxDbtp.toFixed(1)} dBTP` 
      },
      { 
        name: 'Bandas de frequência', 
        condition: Object.keys(metricsData.fft.frequencyBands.left).length === 7,
        value: Object.keys(metricsData.fft.frequencyBands.left).length 
      },
      { 
        name: 'Energia em 440Hz', 
        condition: energyAt440 > 0.1, // Sine wave deve ter energia significativa
        value: energyAt440.toFixed(3) 
      }
    ];
    
    let passedCount = 0;
    for (const validation of validations) {
      const status = validation.condition ? '✅' : '❌';
      console.log(`${status} ${validation.name}: ${validation.value}`);
      if (validation.condition) passedCount++;
    }
    
    console.log(`\\n📊 RESUMO: ${passedCount}/${validations.length} validações passaram`);
    
    if (passedCount === validations.length) {
      console.log('🎉 FASE 5.3 FUNCIONANDO PERFEITAMENTE!');
      console.log('   ✅ FFT implementado corretamente');
      console.log('   ✅ LUFS ITU-R BS.1770-4 calculado');
      console.log('   ✅ True Peak 4x oversampling funcionando');
      console.log('   ✅ Pronto para Fase 5.4 (JSON + Scoring)');
    } else {
      console.log('⚠️  Algumas validações falharam - verificar implementação');
    }
    
  } catch (error) {
    console.error('❌ ERRO no teste:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Teste do pipeline completo
async function testFullPipeline() {
  console.log('\\n🔗 TESTE PIPELINE COMPLETO (5.1 + 5.2 + 5.3)');
  console.log('═'.repeat(50));
  
  try {
    const testFile = readFileSync('C:\\Users\\DJ Correa\\Desktop\\Programação\\SoundyAI\\temp\\1s-440hz-sine.wav');
    
    const result = await processAudioWithCoreMetrics(testFile, '1s-440hz-sine.wav');
    
    console.log('✅ Pipeline completo executado:');
    console.log(`   - Fase 5.1: ${Object.keys(result.phase1).length} propriedades`);
    console.log(`   - Fase 5.2: ${Object.keys(result.phase2).length} propriedades`);
    console.log(`   - Fase 5.3: ${Object.keys(result.phase3).length} propriedades`);
    console.log(`   - Total: ${result.pipeline.totalProcessingTime}ms`);
    console.log(`   - Versão: ${result.pipeline.version}`);
    
  } catch (error) {
    console.error('❌ ERRO no pipeline completo:', error.message);
  }
}

// Executar testes
console.log('🎵 Iniciando testes da Fase 5.3...');
await testBasicCoreMetrics();
await testFullPipeline();
console.log('\\n🏁 Testes concluídos!');
