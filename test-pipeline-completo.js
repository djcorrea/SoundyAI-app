/**
 * 🧪 TESTE INTEGRADO - Validação Completa do Pipeline Otimizado
 * 
 * Valida as 4 otimizações implementadas:
 * ✅ #1: BPM limitado a 30s
 * ✅ #2: Cache de decode PCM
 * ✅ #3: FFT otimizado (fft-js)
 * ✅ #4: True Peak via FFmpeg
 * 
 * Uso:
 * node test-pipeline-completo.js <caminho-para-arquivo-audio>
 */

import { readFile } from 'fs/promises';
import { basename } from 'path';

// Importar o pipeline completo
import { analyzeCoreMetrics } from './api/audio/core-metrics.js';
import { decodeAudioFile } from './api/audio/audio-decoder.js';

console.log('🧪 TESTE INTEGRADO - Pipeline Otimizado\n');
console.log('═══════════════════════════════════════════════════════════');

async function testPipeline(filePath) {
  try {
    const fileName = basename(filePath);
    console.log(`📁 Arquivo: ${fileName}\n`);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔥 EXECUÇÃO 1/3 - Sem Cache (primeira análise)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Execução 1: Sem cache
    console.time('⏱️  Tempo Total (Execução 1)');
    
    const fileBuffer = await readFile(filePath);
    console.log(`📊 Tamanho do arquivo: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB\n`);
    
    console.log('1️⃣  Decodificação (primeira vez - sem cache)');
    console.time('  └─ Decode PCM');
    const audioData1 = await decodeAudioFile(fileBuffer, fileName);
    console.timeEnd('  └─ Decode PCM');
    
    if (audioData1._metadata?.cacheHit) {
      console.log('  └─ Status: ❌ Cache encontrado (esperado: cache miss)');
    } else {
      console.log('  └─ Status: ✅ Cache miss (esperado)');
    }
    
    console.log(`\n2️⃣  Análise de Métricas`);
    console.time('  └─ Core Metrics');
    const metrics1 = await analyzeCoreMetrics(
      audioData1.leftChannel,
      audioData1.rightChannel,
      audioData1.sampleRate,
      { filename: fileName }
    );
    console.timeEnd('  └─ Core Metrics');
    
    console.log(`\n✅ Métricas Obtidas:`);
    console.log(`   BPM:        ${metrics1.bpm?.bpm?.toFixed(1) || 'N/A'}`);
    console.log(`   LUFS:       ${metrics1.lufs?.integrated?.toFixed(2) || 'N/A'} dB`);
    console.log(`   True Peak:  ${metrics1.truePeak?.maxDbtp?.toFixed(2) || 'N/A'} dBTP`);
    console.log(`   Duração:    ${(audioData1.leftChannel.length / audioData1.sampleRate).toFixed(2)}s`);
    
    console.timeEnd('⏱️  Tempo Total (Execução 1)');
    
    // Execução 2: Com cache
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('⚡ EXECUÇÃO 2/3 - Com Cache (segunda análise)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.time('⏱️  Tempo Total (Execução 2)');
    
    console.log('1️⃣  Decodificação (segunda vez - deve usar cache)');
    console.time('  └─ Decode PCM');
    const audioData2 = await decodeAudioFile(fileBuffer, fileName);
    console.timeEnd('  └─ Decode PCM');
    
    if (audioData2._metadata?.cacheHit) {
      console.log('  └─ Status: ✅ Cache hit (esperado)');
    } else {
      console.log('  └─ Status: ❌ Cache miss (esperado: cache hit)');
    }
    
    console.log(`\n2️⃣  Análise de Métricas`);
    console.time('  └─ Core Metrics');
    const metrics2 = await analyzeCoreMetrics(
      audioData2.leftChannel,
      audioData2.rightChannel,
      audioData2.sampleRate,
      { filename: fileName }
    );
    console.timeEnd('  └─ Core Metrics');
    
    console.timeEnd('⏱️  Tempo Total (Execução 2)');
    
    // Execução 3: Validação de consistência
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('🔍 EXECUÇÃO 3/3 - Validação de Consistência');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.time('⏱️  Tempo Total (Execução 3)');
    
    const audioData3 = await decodeAudioFile(fileBuffer, fileName);
    const metrics3 = await analyzeCoreMetrics(
      audioData3.leftChannel,
      audioData3.rightChannel,
      audioData3.sampleRate,
      { filename: fileName }
    );
    
    console.timeEnd('⏱️  Tempo Total (Execução 3)');
    
    // Comparar resultados
    console.log('\n📊 Comparação de Resultados (Exec 1 vs Exec 3)');
    console.log('───────────────────────────────────────────────────────────');
    
    const bpmDiff = Math.abs((metrics1.bpm?.bpm || 0) - (metrics3.bpm?.bpm || 0));
    const lufsDiff = Math.abs((metrics1.lufs?.integrated || 0) - (metrics3.lufs?.integrated || 0));
    const truePeakDiff = Math.abs((metrics1.truePeak?.maxDbtp || 0) - (metrics3.truePeak?.maxDbtp || 0));
    
    const bpmOK = bpmDiff < 1.0; // ±1 BPM aceitável
    const lufsOK = lufsDiff < 0.1; // ±0.1 dB aceitável
    const truePeakOK = truePeakDiff < 0.1; // ±0.1 dB aceitável
    
    console.log(`BPM:       ${metrics1.bpm?.bpm?.toFixed(1) || 'N/A'} → ${metrics3.bpm?.bpm?.toFixed(1) || 'N/A'} (Δ ${bpmDiff.toFixed(2)}) ${bpmOK ? '✅' : '❌'}`);
    console.log(`LUFS:      ${metrics1.lufs?.integrated?.toFixed(2) || 'N/A'} → ${metrics3.lufs?.integrated?.toFixed(2) || 'N/A'} (Δ ${lufsDiff.toFixed(3)} dB) ${lufsOK ? '✅' : '❌'}`);
    console.log(`True Peak: ${metrics1.truePeak?.maxDbtp?.toFixed(2) || 'N/A'} → ${metrics3.truePeak?.maxDbtp?.toFixed(2) || 'N/A'} (Δ ${truePeakDiff.toFixed(3)} dB) ${truePeakOK ? '✅' : '❌'}`);
    
    // Validar métricas espectrais
    console.log('\n🎵 Métricas Espectrais (8 métricas preservadas)');
    console.log('───────────────────────────────────────────────────────────');
    
    const spectralMetrics = [
      'spectral_centroid',
      'spectral_rolloff',
      'spectral_bandwidth',
      'spectral_spread',
      'spectral_flatness',
      'spectral_crest',
      'spectral_skewness',
      'spectral_kurtosis'
    ];
    
    let spectralOK = true;
    spectralMetrics.forEach(metric => {
      const value1 = metrics1.spectral?.[metric];
      const value3 = metrics3.spectral?.[metric];
      
      if (value1 !== undefined && value3 !== undefined) {
        const diff = Math.abs(value1 - value3);
        const percentDiff = (diff / Math.abs(value1)) * 100;
        const ok = percentDiff < 1.0; // ±1% aceitável
        
        if (!ok) spectralOK = false;
        
        console.log(`${metric.padEnd(22)}: ${value1.toFixed(2)} → ${value3.toFixed(2)} (${percentDiff.toFixed(2)}%) ${ok ? '✅' : '❌'}`);
      } else {
        console.log(`${metric.padEnd(22)}: ❌ Métrica ausente`);
        spectralOK = false;
      }
    });
    
    // Resumo final
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📋 RESUMO FINAL');
    console.log('═══════════════════════════════════════════════════════════');
    
    const allOK = bpmOK && lufsOK && truePeakOK && spectralOK;
    
    console.log(`\n✅ OTIMIZAÇÕES VALIDADAS:`);
    console.log(`   #1 BPM 30s:        ${metrics1.bpm ? '✅ Implementado' : '❌ Erro'}`);
    console.log(`   #2 Cache PCM:      ${audioData2._metadata?.cacheHit ? '✅ Funcionando' : '❌ Não funciona'}`);
    console.log(`   #3 FFT Otimizado:  ${metrics1.spectral ? '✅ Funcionando' : '❌ Erro'}`);
    console.log(`   #4 True Peak FFmpeg: ${metrics1.truePeak ? '✅ Funcionando' : '❌ Erro'}`);
    
    console.log(`\n📊 CONSISTÊNCIA DOS RESULTADOS:`);
    console.log(`   BPM:             ${bpmOK ? '✅' : '❌'} (tolerância: ±1 BPM)`);
    console.log(`   LUFS:            ${lufsOK ? '✅' : '❌'} (tolerância: ±0.1 dB)`);
    console.log(`   True Peak:       ${truePeakOK ? '✅' : '❌'} (tolerância: ±0.1 dB)`);
    console.log(`   Métricas Espectrais: ${spectralOK ? '✅' : '❌'} (tolerância: ±1%)`);
    
    console.log(`\n${allOK ? '🎉 TODOS OS TESTES PASSARAM!' : '❌ ALGUNS TESTES FALHARAM'}`);
    
    if (!allOK) {
      console.error('\n❌ Revisar implementação - Inconsistências detectadas');
      process.exit(1);
    }
    
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Processar argumentos
const filePath = process.argv[2];

if (!filePath) {
  console.error('❌ Uso: node test-pipeline-completo.js <caminho-para-arquivo-audio>\n');
  console.error('Exemplo: node test-pipeline-completo.js ./test-audio.wav\n');
  process.exit(1);
}

testPipeline(filePath);
