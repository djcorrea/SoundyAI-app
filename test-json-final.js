import { segmentAudioTemporal } from './work/api/audio/temporal-segmentation.js';
import { calculateCoreMetrics } from './work/api/audio/core-metrics.js';
import { generateJSONOutput } from './work/api/audio/json-output.js';

console.log('🧪 TESTE: JSON Output Final - Métricas Corrigidas');

async function testFinalJSON() {
  try {
    // Simulando dados de áudio (baseado nos testes anteriores)
    console.log('[1/4] Usando dados de teste...');
    
    const leftChannel = new Float32Array(48000);
    const rightChannel = new Float32Array(48000);
    
    // Gerar dados simulados que sabemos que funcionam
    for (let i = 0; i < 48000; i++) {
      leftChannel[i] = Math.sin(2 * Math.PI * 440 * i / 48000) * 0.5; // 440 Hz left
      rightChannel[i] = Math.sin(2 * Math.PI * 880 * i / 48000) * 0.3; // 880 Hz right  
    }
    
    const audioBuffer = {
      sampleRate: 48000,
      length: 48000, // 1 segundo
      numberOfChannels: 2,
      duration: 1.0, // Adicionar duration em segundos
      leftChannel,
      rightChannel,
      getChannelData: (channel) => {
        return channel === 0 ? leftChannel : rightChannel;
      }
    };

    // 2. Segmentação temporal
    console.log('[2/4] Segmentação temporal...');
    const segmentedAudio = await segmentAudioTemporal(audioBuffer, { jobId: 'test-json' });

    // 3. Core metrics
    console.log('[3/4] Calculando core metrics...');
    const coreMetrics = await calculateCoreMetrics(segmentedAudio, { jobId: 'test-json' });

    // 4. JSON output
    console.log('[4/4] Criando JSON output...');
    const metadata = { 
      fileName: 'test.wav',
      originalFileName: 'test.wav',
      duration: 1.0,
      sampleRate: 48000,
      channels: 2
    };
    const jsonOutput = generateJSONOutput(coreMetrics, null, metadata, { 
      jobId: 'test-json'
    });

    // Verificar campos importantes
    console.log('\n📊 VERIFICAÇÃO PRINCIPAL:');
    console.log(`✅ spectralBandsFrames: ${jsonOutput.processing?.spectralBandsFrames || 'MISSING'}`);
    console.log(`✅ spectralCentroidFrames: ${jsonOutput.processing?.spectralCentroidFrames || 'MISSING'}`);
    console.log(`✅ rmsValid: ${jsonOutput.processing?.rmsValid || 'MISSING'}`);
    console.log(`✅ fftFrames: ${jsonOutput.processing?.fftFrames || 'MISSING'}`);

    // Verificar métricas espectrais
    console.log('\n🎵 MÉTRICAS ESPECTRAIS:');
    console.log(`✅ spectralCentroid: ${jsonOutput.spectral?.centroidHz || 'MISSING'}`);
    console.log(`✅ spectralRolloff: ${jsonOutput.spectral?.rolloffHz || 'MISSING'}`);
    console.log(`✅ spectralFlatness: ${jsonOutput.spectral?.flatness || 'MISSING'}`);

    // Verificar bandas espectrais
    console.log('\n🎶 BANDAS ESPECTRAIS:');
    const bands = jsonOutput.spectralBands?.detailed || {};
    console.log(`✅ Sub: ${bands.sub?.rms_db || 'MISSING'}`);
    console.log(`✅ Bass: ${bands.low_bass?.rms_db || 'MISSING'}`);
    console.log(`✅ Mid: ${bands.mid?.rms_db || 'MISSING'}`);
    console.log(`✅ Treble: ${bands.brilho?.rms_db || 'MISSING'}`);

    // Verificar RMS
    console.log('\n📊 RMS:');
    console.log(`✅ RMS Left: ${jsonOutput.rms?.left || 'MISSING'}`);
    console.log(`✅ RMS Right: ${jsonOutput.rms?.right || 'MISSING'}`);
    console.log(`✅ RMS Average: ${jsonOutput.rms?.average || 'MISSING'}`);
    console.log(`✅ RMS Frame Count: ${jsonOutput.rms?.frameCount || 'MISSING'}`);

    // Verificar scores e categorias
    console.log('\n🏆 SCORE E QUALIDADE:');
    console.log(`✅ Score: ${jsonOutput.score || 'MISSING'}`);
    console.log(`✅ Classification: ${jsonOutput.classification || 'MISSING'}`);
    console.log(`✅ LUFS: ${jsonOutput.loudness?.integrated || 'MISSING'}`);
    console.log(`✅ True Peak: ${jsonOutput.truePeak?.maxDbtp || 'MISSING'}`);

    // Status final
    const allValid = [
      jsonOutput.processing?.spectralBandsFrames > 0,
      jsonOutput.processing?.spectralCentroidFrames > 0,
      jsonOutput.processing?.rmsValid === true,
      jsonOutput.spectral?.centroidHz != null,
      jsonOutput.rms?.average != null,
      jsonOutput.score != null
    ].every(Boolean);

    console.log(`\n📊 RESULTADO FINAL: ${allValid ? '✅ TODAS CORREÇÕES FUNCIONANDO!' : '❌ ALGUMAS MÉTRICAS AINDA NULAS'}`);
    
    // Mostrar tamanho do JSON
    const jsonString = JSON.stringify(jsonOutput);
    console.log(`📦 Tamanho JSON: ${Math.round(jsonString.length / 1024)}KB`);

    return jsonOutput;

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    throw error;
  }
}

testFinalJSON().catch(console.error);