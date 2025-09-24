// 🥁 TESTE BPM NO PIPELINE WORK
// Teste para verificar se o BPM está sendo calculado no pipeline work (/api/audio/work/...)

import { readFileSync } from 'fs';
import { join } from 'path';

// Simular o pipeline work com dados de teste
async function testWorkBmp() {
  try {
    console.log('🧪 [TEST] Iniciando teste BPM no pipeline work...');

    // Importar função do pipeline work
    const { calculateCoreMetrics } = await import('./work/api/audio/core-metrics.js');
    const { generateJSONOutput } = await import('./work/api/audio/json-output.js');

    // Criar dados simulados (equivalente ao que vem da fase 5.2)
    const sampleRate = 48000;
    const duration = 2; // 2 segundos
    const samples = sampleRate * duration;
    
    // Criar um sinal com padrão rítmico simulado (120 BPM)
    const leftChannel = new Float32Array(samples);
    const rightChannel = new Float32Array(samples);
    
    const bmp120Interval = sampleRate / 2; // 120 BPM = 2 beats por segundo
    
    for (let i = 0; i < samples; i++) {
      // Adicionar picos a cada beat (simulando kick drum)
      if (i % bmp120Interval < 1000) { // Pico de 1000 amostras
        leftChannel[i] = 0.8 * Math.sin(2 * Math.PI * 60 * i / sampleRate); // 60Hz kick
        rightChannel[i] = leftChannel[i];
      } else {
        // Ruído de fundo baixo
        leftChannel[i] = 0.1 * (Math.random() - 0.5);
        rightChannel[i] = 0.1 * (Math.random() - 0.5);
      }
    }

    // Simular dados da fase 5.2 (segmentedAudio) com estrutura completa esperada
    const frameCount = 50; // Número de frames FFT/RMS
    
    const segmentedAudio = {
      // Canais originais (requeridos pelo pipeline work)
      originalChannels: { left: leftChannel, right: rightChannel },
      
      // Frames FFT simulados com estrutura completa esperada (objetos FFT)
      framesFFT: {
        count: frameCount,
        left: Array(frameCount).fill(null).map(() => {
          const magnitude = new Float32Array(2048);
          const phase = new Float32Array(2048);
          const real = new Float32Array(2048);
          const imag = new Float32Array(2048);
          
          // Popular com espectro simulado (pico em 60Hz para kick drum)
          for (let i = 0; i < 2048; i++) {
            const freq = (i * sampleRate) / (2 * 2048);
            if (freq >= 50 && freq <= 70) {
              magnitude[i] = 0.8; // Kick drum
              real[i] = 0.8;
            } else if (freq >= 1000 && freq <= 3000) {
              magnitude[i] = 0.3; // Mid
              real[i] = 0.3;
            } else {
              magnitude[i] = 0.1 * Math.random(); // Background
              real[i] = magnitude[i];
            }
            phase[i] = Math.random() * Math.PI * 2;
            imag[i] = real[i] * Math.sin(phase[i]);
          }
          
          return { magnitude, phase, real, imag };
        }),
        right: Array(frameCount).fill(null).map(() => {
          const magnitude = new Float32Array(2048);
          const phase = new Float32Array(2048);
          const real = new Float32Array(2048);
          const imag = new Float32Array(2048);
          
          for (let i = 0; i < 2048; i++) {
            const freq = (i * sampleRate) / (2 * 2048);
            if (freq >= 50 && freq <= 70) {
              magnitude[i] = 0.8;
              real[i] = 0.8;
            } else if (freq >= 1000 && freq <= 3000) {
              magnitude[i] = 0.3;
              real[i] = 0.3;
            } else {
              magnitude[i] = 0.1 * Math.random();
              real[i] = magnitude[i];
            }
            phase[i] = Math.random() * Math.PI * 2;
            imag[i] = real[i] * Math.sin(phase[i]);
          }
          
          return { magnitude, phase, real, imag };
        }),
        timestamps: Array(frameCount).fill(null).map((_, i) => i * 0.04) // 40ms por frame
      },
      
      // Frames RMS simulados
      framesRMS: {
        count: frameCount,
        left: Array(frameCount).fill(-20),
        right: Array(frameCount).fill(-20),
        average: Array(frameCount).fill(-20),
        peak: Array(frameCount).fill(-18)
      },
      
      // Timestamps
      timestamps: Array(frameCount).fill(null).map((_, i) => i * 0.04),
      
      // Metadata
      metadata: {
        sampleRate,
        channels: 2,
        duration,
        fileName: 'test-bpm-120.wav'
      }
    };

    console.log('🎵 [TEST] Dados simulados criados:', {
      samples,
      duration,
      expectedBmp: 120,
      leftChannelType: leftChannel.constructor.name,
      rightChannelType: rightChannel.constructor.name
    });

    // Criar arquivo temporário falso para True Peak
    const tempWavPath = './temp-test-bpm.wav';
    
    // Opções de teste
    const options = {
      jobId: 'test-work-bpm-001',
      fileName: 'test-bpm-120.wav',
      tempFilePath: tempWavPath
    };

    // FASE 5.3: Calcular core metrics (inclui BPM agora)
    console.log('🔄 [TEST] Executando calculateCoreMetrics...');
    let coreMetrics;
    try {
      coreMetrics = await calculateCoreMetrics(segmentedAudio, options);
    } catch (error) {
      // Se falhar no True Peak ou outras partes, ver se temos BPM nos logs
      console.log('❌ [TEST] Core metrics falhou, mas verificando logs para BPM...');
      console.log('Erro:', error.message);
      
      // Mesmo sem core metrics completos, verificar se há evidência de BPM nos logs
      console.log('🎯 [TEST] Procure por logs "[AUDIO] bmp_calculation" nas mensagens acima');
      console.log('🎯 [TEST] Procure por logs "[SUCCESS] BPM calculado" nas mensagens acima');
      console.log('🎯 [TEST] Se você viu esses logs, o BPM está funcionando!');
      
      return {
        success: false,
        error: error.message,
        bmpDetected: error.message.includes('tempFilePath') // Se falhou no True Peak, provavelmente chegou ao BPM
      };
    }

    console.log('✅ [TEST] Core metrics calculados:', {
      bmp: coreMetrics.bmp,
      bmpConfidence: coreMetrics.bmpConfidence,
      hasLufs: !!coreMetrics.lufs,
      hasTruePeak: !!coreMetrics.truePeak,
      hasStereo: !!coreMetrics.stereo
    });

    // FASE 5.4: Gerar JSON final
    console.log('🔄 [TEST] Executando generateJSONOutput...');
    const jsonOutput = generateJSONOutput(coreMetrics, null, segmentedAudio.metadata, options);

    console.log('✅ [TEST] JSON final gerado:', {
      hasTechnicalData: !!jsonOutput.technicalData,
      technicalDataBmp: jsonOutput.technicalData?.bmp,
      technicalDataBmpConfidence: jsonOutput.technicalData?.bmpConfidence,
      score: jsonOutput.score
    });

    // Verificar se BPM aparece no lugar correto para o modal
    console.log('🎯 [TEST] Verificação final - BPM no technicalData:');
    console.log('  - technicalData.bmp:', jsonOutput.technicalData?.bmp);
    console.log('  - technicalData.bmpConfidence:', jsonOutput.technicalData?.bmpConfidence);

    if (jsonOutput.technicalData?.bmp !== null && jsonOutput.technicalData?.bmp !== undefined) {
      console.log('🎉 [SUCCESS] BPM detectado no pipeline work!');
      console.log(`   Valor: ${jsonOutput.technicalData.bmp} BPM`);
      console.log(`   Confiança: ${jsonOutput.technicalData.bmpConfidence}`);
    } else {
      console.log('❌ [FAILED] BPM NÃO foi detectado no pipeline work');
    }

    return {
      success: jsonOutput.technicalData?.bmp !== null,
      bmp: jsonOutput.technicalData?.bmp,
      confidence: jsonOutput.technicalData?.bmpConfidence,
      fullJson: jsonOutput
    };

  } catch (error) {
    console.error('❌ [ERROR] Teste falhou:', error);
    console.error('Stack:', error.stack);
    return { success: false, error: error.message };
  }
}

// Executar teste
testWorkBmp().then(result => {
  console.log('\n📋 [SUMMARY] Resultado final do teste:', result.success ? '✅ PASSOU' : '❌ FALHOU');
  if (result.success) {
    console.log(`   BPM detectado: ${result.bmp}`);
    console.log(`   Confiança: ${result.confidence}`);
  }
}).catch(error => {
  console.error('❌ [FATAL] Erro na execução do teste:', error);
});