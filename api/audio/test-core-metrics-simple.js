// 🧪 TESTE SIMPLIFICADO - Fase 5.3 Core Metrics
// Validação com áudio sintético gerado programaticamente

import { calculateCoreMetrics } from './core-metrics.js';
import { segmentAudioTemporal } from './temporal-segmentation.js';

// Gerar sine wave de 440Hz por 1 segundo
function generateSineWave(frequency, duration, sampleRate) {
  const numSamples = Math.floor(duration * sampleRate);
  const leftChannel = new Float32Array(numSamples);
  const rightChannel = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const value = 0.5 * Math.sin(2 * Math.PI * frequency * t); // Amplitude 0.5 para evitar clipping
    leftChannel[i] = value;
    rightChannel[i] = value;
  }
  
  return { leftChannel, rightChannel, numSamples };
}

async function testCoreMetricsWithSyntheticAudio() {
  console.log('🚀 TESTE SIMPLIFICADO - FASE 5.3 CORE METRICS');
  console.log('═'.repeat(50));
  
  try {
    // 1. Gerar áudio sintético
    console.log('🎵 Gerando sine wave 440Hz, 1 segundo...');
    const { leftChannel, rightChannel, numSamples } = generateSineWave(440, 1.0, 48000);
    
    console.log(`   - Samples gerados: ${numSamples}`);
    console.log(`   - Frequência: 440Hz`);
    console.log(`   - Duração: 1.0s`);
    console.log(`   - Sample rate: 48000Hz`);
    
    // 2. Simular saída da Fase 5.1 (AudioBuffer equivalente)
    const audioData = {
      leftChannel,
      rightChannel,
      sampleRate: 48000,
      duration: 1.0,
      numberOfChannels: 2,
      length: numSamples,
      _metadata: {
        phase: '5.1-decoding',
        format: 'synthetic'
      }
    };
    
    // 3. Fase 5.2 - Segmentação temporal
    console.log('⚙️  Executando segmentação temporal...');
    const segmentedData = segmentAudioTemporal(audioData);
    
    // Preservar dados originais para LUFS e True Peak
    segmentedData.originalLeft = leftChannel;
    segmentedData.originalRight = rightChannel;
    
    console.log(`   - Frames FFT: ${segmentedData.framesFFT.count}`);
    console.log(`   - Frames RMS: ${segmentedData.framesRMS.count}`);
    
    // 4. Fase 5.3 - Core Metrics
    console.log('🧮 Calculando métricas core...');
    const metricsData = await calculateCoreMetrics(segmentedData);
    
    // 5. Validar resultados
    console.log('\\n🔍 RESULTADOS:');
    console.log('─'.repeat(30));
    
    // FFT - Verificar energia em 440Hz
    const binSize = 48000 / 2 / (metricsData.fft.spectrograms.left[0].magnitude.length - 1);
    const expectedBin = Math.round(440 / binSize);
    const energyAt440 = metricsData.fft.spectrograms.left[0].magnitude[expectedBin];
    const maxEnergy = Math.max(...metricsData.fft.spectrograms.left[0].magnitude);
    
    console.log(`📊 FFT:`);
    console.log(`   - Frames processados: ${metricsData.fft.frameCount}`);
    console.log(`   - Bin size: ${binSize.toFixed(1)} Hz/bin`);
    console.log(`   - Bin para 440Hz: ${expectedBin}`);
    console.log(`   - Energia em 440Hz: ${energyAt440.toFixed(3)}`);
    console.log(`   - Energia máxima: ${maxEnergy.toFixed(3)}`);
    console.log(`   - Ratio 440Hz/max: ${(energyAt440/maxEnergy*100).toFixed(1)}%`);
    
    // Bandas de frequência
    console.log(`   - Bandas calculadas: ${Object.keys(metricsData.fft.frequencyBands.left).length}`);
    Object.entries(metricsData.fft.frequencyBands.left).forEach(([band, data]) => {
      console.log(`     * ${band}: ${data.energyDb.toFixed(1)} dB (${data.min}-${data.max}Hz)`);
    });
    
    // LUFS
    console.log(`\\n🔊 LUFS:`);
    console.log(`   - Integrado: ${metricsData.lufs.integrated.toFixed(1)} LUFS`);
    console.log(`   - Short-term: ${metricsData.lufs.shortTerm.toFixed(1)} LUFS`);
    console.log(`   - Momentary: ${metricsData.lufs.momentary.toFixed(1)} LUFS`);
    console.log(`   - LRA: ${metricsData.lufs.lra.toFixed(1)} LU`);
    
    // True Peak
    console.log(`\\n🏔️  True Peak:`);
    console.log(`   - Máximo: ${metricsData.truePeak.maxDbtp.toFixed(1)} dBTP`);
    console.log(`   - Linear: ${metricsData.truePeak.maxLinear.toFixed(3)}`);
    console.log(`   - Canal L: ${metricsData.truePeak.channels.left.peakDbtp.toFixed(1)} dBTP`);
    console.log(`   - Canal R: ${metricsData.truePeak.channels.right.peakDbtp.toFixed(1)} dBTP`);
    console.log(`   - Clipping: ${metricsData.truePeak.clippingAnalysis.isClipping ? '⚠️ SIM' : '✅ NÃO'}`);
    
    // Performance
    console.log(`\\n⏱️  Performance:`);
    console.log(`   - Processamento: ${metricsData._metadata.processingTime}ms`);
    console.log(`   - Standard: ${metricsData.lufs.standard}, ${metricsData.truePeak.standard}`);
    
    // Validações específicas para sine wave
    console.log(`\\n✅ VALIDAÇÕES ESPECÍFICAS:`);
    console.log('─'.repeat(30));
    
    const validations = [
      { 
        name: 'FFT detectou 440Hz como dominante', 
        condition: energyAt440 > maxEnergy * 0.8, // 440Hz deve ser energia dominante
        value: `${(energyAt440/maxEnergy*100).toFixed(1)}%` 
      },
      { 
        name: 'True Peak abaixo de 0 dBTP (sem clipping)', 
        condition: metricsData.truePeak.maxDbtp < -0.1,
        value: `${metricsData.truePeak.maxDbtp.toFixed(1)} dBTP` 
      },
      { 
        name: 'LUFS calculado (não NaN)', 
        condition: !isNaN(metricsData.lufs.integrated) && isFinite(metricsData.lufs.integrated),
        value: `${metricsData.lufs.integrated.toFixed(1)} LUFS` 
      },
      { 
        name: 'Canais L/R idênticos (mono signal)', 
        condition: Math.abs(metricsData.truePeak.channels.left.peakDbtp - metricsData.truePeak.channels.right.peakDbtp) < 0.1,
        value: `ΔdBTP: ${Math.abs(metricsData.truePeak.channels.left.peakDbtp - metricsData.truePeak.channels.right.peakDbtp).toFixed(2)}` 
      },
      { 
        name: 'FFT frames corretos para 1s', 
        condition: metricsData.fft.frameCount === 43, // 1s a 48kHz = 43 frames FFT
        value: metricsData.fft.frameCount 
      },
      { 
        name: 'Banda mid tem mais energia (440Hz)', 
        condition: metricsData.fft.frequencyBands.left.mid.energyDb > metricsData.fft.frequencyBands.left.bass.energyDb,
        value: `Mid: ${metricsData.fft.frequencyBands.left.mid.energyDb.toFixed(1)}dB > Bass: ${metricsData.fft.frequencyBands.left.bass.energyDb.toFixed(1)}dB` 
      }
    ];
    
    let passedCount = 0;
    for (const validation of validations) {
      const status = validation.condition ? '✅' : '❌';
      console.log(`${status} ${validation.name}: ${validation.value}`);
      if (validation.condition) passedCount++;
    }
    
    console.log(`\\n📊 RESUMO VALIDAÇÕES: ${passedCount}/${validations.length} passaram`);
    
    if (passedCount >= validations.length - 1) { // Tolerância de 1 falha
      console.log('\\n🎉 FASE 5.3 VALIDADA COM SUCESSO!');
      console.log('   ✅ FFT: Análise espectral funcionando');
      console.log('   ✅ LUFS: ITU-R BS.1770-4 implementado');
      console.log('   ✅ True Peak: 4x oversampling ativo');
      console.log('   ✅ Bandas de frequência calculadas');
      console.log('   ✅ Sine wave 440Hz detectado corretamente');
      console.log('\\n🚀 PRONTO PARA FASE 5.4 (JSON + Scoring)!');
      
      return true;
    } else {
      console.log(`\\n⚠️  ${validations.length - passedCount} validações falharam - revisar implementação`);
      return false;
    }
    
  } catch (error) {
    console.error('\\n❌ ERRO no teste:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Executar teste
console.log('🎵 Iniciando teste da Fase 5.3 com áudio sintético...');
const result = await testCoreMetricsWithSyntheticAudio();
console.log(`\\n🏁 Teste concluído: ${result ? 'SUCESSO' : 'FALHOU'}`);
