// testar-pipeline-direto.js - Executar pipeline diretamente para debug

import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);

// Simular buffer de áudio WAV básico para teste
function criarAudioTeste() {
  // Criar um arquivo WAV com 1 segundo de tom de 1000Hz
  const sampleRate = 48000; // Como especificado nas instruções
  const duration = 1; // 1 segundo
  const frequency = 1000; // 1kHz
  const samples = sampleRate * duration;
  
  const left = new Float32Array(samples);
  const right = new Float32Array(samples);
  
  for (let i = 0; i < samples; i++) {
    const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
    left[i] = sample;
    right[i] = sample;
  }
  
  return {
    leftChannel: left,
    rightChannel: right,
    sampleRate,
    channels: 2,
    duration,
    metadata: {
      fileName: 'teste-direto.wav',
      sampleRate,
      channels: 2,
      duration
    }
  };
}

async function testarPipelineCompleto() {
  try {
    console.log('🔍 TESTE: Executando pipeline completo diretamente...\n');
    
    const audioData = criarAudioTeste();
    console.log(`📊 Áudio criado: ${audioData.sampleRate}Hz, ${audioData.channels}ch, ${audioData.duration}s`);
    
    // Importar módulos do pipeline
    console.log('📦 Importando módulos do pipeline...');
    
    const { segmentAudioTemporal } = await import('./api/audio/temporal-segmentation.js');
    const { calculateCoreMetrics } = await import('./api/audio/core-metrics.js');
    const { generateJSONOutput } = await import('./api/audio/json-output.js');
    
    console.log('✅ Módulos importados com sucesso!\n');
    
    // FASE 5.2: Segmentação
    console.log('⏱️ FASE 5.2: Segmentação Temporal...');
    const segmentedData = segmentAudioTemporal(audioData);
    console.log(`✅ Segmentação concluída - FFT frames: ${segmentedData.framesFFT.left.length}, RMS frames: ${segmentedData.framesRMS.left.length}\n`);
    
    // FASE 5.3: Core Metrics
    console.log('📊 FASE 5.3: Core Metrics...');
    const coreMetrics = await calculateCoreMetrics(segmentedData);
    console.log('✅ Core Metrics concluído\n');
    
    // DEBUG: Estrutura do coreMetrics
    console.log('🔍 === ESTRUTURA DO CORE METRICS ===');
    console.log('📋 Top-level keys:', Object.keys(coreMetrics));
    console.log('📋 coreMetrics.fft exists:', !!coreMetrics.fft);
    
    if (coreMetrics.fft) {
      console.log('📋 coreMetrics.fft keys:', Object.keys(coreMetrics.fft));
      console.log('📋 coreMetrics.fft.aggregated exists:', !!coreMetrics.fft.aggregated);
      
      if (coreMetrics.fft.aggregated) {
        console.log('📋 coreMetrics.fft.aggregated keys:', Object.keys(coreMetrics.fft.aggregated));
        if (coreMetrics.fft.aggregated.spectralCentroidHz) {
          console.log('✅ spectralCentroidHz found:', coreMetrics.fft.aggregated.spectralCentroidHz);
        } else {
          console.log('❌ spectralCentroidHz NOT FOUND in aggregated');
        }
      } else {
        console.log('❌ coreMetrics.fft.aggregated é undefined/null');
      }
    } else {
      console.log('❌ coreMetrics.fft é undefined/null');
    }
    console.log('');
    
    // FASE 5.4: JSON Output  
    console.log('📄 FASE 5.4: JSON Output...');
    const finalResult = generateJSONOutput(coreMetrics, null, audioData.metadata);
    console.log('✅ JSON Output concluído\n');
    
    // Análise do resultado final
    console.log('🎯 === ANÁLISE DO RESULTADO FINAL ===');
    console.log('📊 Total de campos no resultado:', Object.keys(finalResult).length);
    
    if (finalResult.technicalData) {
      console.log('📊 Total de campos no technicalData:', Object.keys(finalResult.technicalData).length);
      
      // Verificar métricas espectrais específicas
      const metricasEspectrais = [
        'spectralCentroidHz', 'spectralRolloffHz', 'spectralFlatness',
        'frequenciaCentral', 'limiteAgudos85', 'bandEnergies'
      ];
      
      console.log('\n🎵 MÉTRICAS ESPECTRAIS NO RESULTADO FINAL:');
      metricasEspectrais.forEach(metrica => {
        if (finalResult.technicalData[metrica] !== undefined) {
          const valor = finalResult.technicalData[metrica];
          const valorStr = typeof valor === 'object' ? `Object[${Object.keys(valor).length}]` : valor;
          console.log(`✅ ${metrica}: ${valorStr}`);
        } else {
          console.log(`❌ ${metrica}: AUSENTE`);
        }
      });
      
      // Verificar se chegaria ao PostgreSQL igual
      console.log('\n📊 COMPARAÇÃO COM POSTGRESQL:');
      const metricasPresentes = metricasEspectrais.filter(m => finalResult.technicalData[m] !== undefined);
      console.log(`├─ Métricas espectrais encontradas: ${metricasPresentes.length}/${metricasEspectrais.length}`);
      console.log(`├─ Total de campos technicalData: ${Object.keys(finalResult.technicalData).length}`);
      console.log(`└─ Resultado PostgreSQL esperado: ${metricasPresentes.length > 0 ? '✅ COM métricas' : '❌ SEM métricas'}`);
      
    } else {
      console.log('❌ technicalData não encontrado no resultado final!');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste do pipeline:', error.message);
    console.error('❌ Stack:', error.stack);
  }
}

testarPipelineCompleto();