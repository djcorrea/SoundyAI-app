/**
 * Teste simples para verificar se o JSON final está correto
 */

import { decodeAndPrepareAudio } from './work/lib/audio/decode.js';
import { segmentAudioTemporal } from './work/api/audio/temporal-segmentation.js';
import { calculateCoreMetrics } from './work/api/audio/core-metrics.js';
import { generateJSONOutput } from './work/api/audio/json-output.js';

async function testCompleteFlow() {
  console.log('🧪 TESTE: JSON Output Completo');
  
  try {
    // 1. Decode
    console.log('[1/4] Decodificando áudio...');
    const audioBuffer = await decodeAndPrepareAudio('test.wav', { jobId: 'test-json' });
    
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
      originalFileName: 'test.wav'
    };
    const jsonOutput = generateJSONOutput(coreMetrics, null, metadata, { 
      jobId: 'test-json'
    });
    
    // Verificar campos importantes
    console.log('\n📊 VERIFICAÇÃO DO JSON:');
    console.log(`✅ spectralBandsFrames: ${jsonOutput.spectralBandsFrames || 'null'}`);
    console.log(`✅ spectralCentroidFrames: ${jsonOutput.spectralCentroidFrames || 'null'}`);
    console.log(`✅ rmsValid: ${jsonOutput.rmsValid}`);
    console.log(`✅ spectralCentroidHz: ${jsonOutput.spectralCentroidHz || 'null'}`);
    console.log(`✅ spectralRolloffHz: ${jsonOutput.spectralRolloffHz || 'null'}`);
    console.log(`✅ lufsIntegrated: ${jsonOutput.lufsIntegrated || 'null'}`);
    console.log(`✅ truePeakDb: ${jsonOutput.truePeakDb || 'null'}`);
    console.log(`✅ correlation: ${jsonOutput.correlation || 'null'}`);
    
    // Verificar métricas espectrais estão não-null
    const spectralFields = [
      'spectralBandsFrames', 'spectralCentroidFrames', 'spectralCentroidHz', 
      'spectralRolloffHz', 'spectralBandwidthHz', 'spectralFlatness'
    ];
    
    let allValid = true;
    spectralFields.forEach(field => {
      if (jsonOutput[field] == null || jsonOutput[field] === 0) {
        console.log(`❌ ${field}: ${jsonOutput[field]} (INVÁLIDO)`);
        allValid = false;
      } else {
        console.log(`✅ ${field}: ${jsonOutput[field]}`);
      }
    });
    
    console.log(`\n📊 Resultado: ${allValid ? '✅ TODAS MÉTRICAS VÁLIDAS!' : '❌ ALGUMAS MÉTRICAS INVÁLIDAS'}`);
    
    // Mostrar tamanho do JSON
    const jsonString = JSON.stringify(jsonOutput);
    console.log(`📦 Tamanho JSON: ${Math.round(jsonString.length / 1024)}KB`);
    
    return jsonOutput;
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    throw error;
  }
}

testCompleteFlow().catch(console.error);