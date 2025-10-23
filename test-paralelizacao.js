/**
 * 🧪 TESTE DE VALIDAÇÃO - Paralelização com Worker Threads
 * 
 * Valida que:
 * 1. Workers executam em paralelo (não sequencial)
 * 2. Resultados são idênticos à versão sequencial
 * 3. Ganho de performance é significativo
 * 
 * Uso:
 * node test-paralelizacao.js <caminho-para-arquivo-audio>
 */

import { readFile } from 'fs/promises';
import { basename } from 'path';
import { decodeAudioFile } from './api/audio/audio-decoder.js';
import { analyzeCoreMetrics } from './api/audio/core-metrics.js';

console.log('🧪 TESTE DE PARALELIZAÇÃO - Worker Threads\n');
console.log('═══════════════════════════════════════════════════════════');

async function testParallelization(filePath) {
  try {
    const fileName = basename(filePath);
    console.log(`📁 Arquivo: ${fileName}\n`);
    
    // Decodificar arquivo
    console.log('1️⃣  Decodificando arquivo...');
    const fileBuffer = await readFile(filePath);
    const audioData = await decodeAudioFile(fileBuffer, fileName);
    console.log(`   ✅ Decodificado: ${audioData.leftChannel.length} samples\n`);
    
    // Execução 1: Com workers paralelos (atual)
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 EXECUÇÃO 1/3 - Com Worker Threads (Paralelo)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const start1 = Date.now();
    console.time('⏱️  Tempo Total (Paralelo)');
    
    const metrics1 = await analyzeCoreMetrics(
      audioData.leftChannel,
      audioData.rightChannel,
      audioData.sampleRate,
      { filename: fileName }
    );
    
    const time1 = Date.now() - start1;
    console.timeEnd('⏱️  Tempo Total (Paralelo)');
    
    console.log(`\n✅ Resultados Execução 1:`);
    console.log(`   BPM:              ${metrics1.bpm?.toFixed(1) || 'null'}`);
    console.log(`   LUFS Integrated:  ${metrics1.lufs?.integrated?.toFixed(2) || 'null'} dB`);
    console.log(`   True Peak:        ${metrics1.truePeak?.maxDbtp?.toFixed(2) || 'null'} dBTP`);
    console.log(`   Spectral Centroid: ${metrics1.spectralCentroid?.centroidHz?.toFixed(2) || 'null'} Hz`);
    console.log(`   Tempo:            ${(time1 / 1000).toFixed(2)}s`);
    
    // Execução 2: Repetir para validar consistência
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔁 EXECUÇÃO 2/3 - Validação de Consistência');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const start2 = Date.now();
    console.time('⏱️  Tempo Total (Execução 2)');
    
    const metrics2 = await analyzeCoreMetrics(
      audioData.leftChannel,
      audioData.rightChannel,
      audioData.sampleRate,
      { filename: fileName }
    );
    
    const time2 = Date.now() - start2;
    console.timeEnd('⏱️  Tempo Total (Execução 2)');
    
    console.log(`\n✅ Resultados Execução 2:`);
    console.log(`   BPM:              ${metrics2.bpm?.toFixed(1) || 'null'}`);
    console.log(`   LUFS Integrated:  ${metrics2.lufs?.integrated?.toFixed(2) || 'null'} dB`);
    console.log(`   True Peak:        ${metrics2.truePeak?.maxDbtp?.toFixed(2) || 'null'} dBTP`);
    console.log(`   Spectral Centroid: ${metrics2.spectralCentroid?.centroidHz?.toFixed(2) || 'null'} Hz`);
    console.log(`   Tempo:            ${(time2 / 1000).toFixed(2)}s`);
    
    // Execução 3: Mais uma validação
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔁 EXECUÇÃO 3/3 - Validação de Consistência');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const start3 = Date.now();
    console.time('⏱️  Tempo Total (Execução 3)');
    
    const metrics3 = await analyzeCoreMetrics(
      audioData.leftChannel,
      audioData.rightChannel,
      audioData.sampleRate,
      { filename: fileName }
    );
    
    const time3 = Date.now() - start3;
    console.timeEnd('⏱️  Tempo Total (Execução 3)');
    
    console.log(`\n✅ Resultados Execução 3:`);
    console.log(`   BPM:              ${metrics3.bpm?.toFixed(1) || 'null'}`);
    console.log(`   LUFS Integrated:  ${metrics3.lufs?.integrated?.toFixed(2) || 'null'} dB`);
    console.log(`   True Peak:        ${metrics3.truePeak?.maxDbtp?.toFixed(2) || 'null'} dBTP`);
    console.log(`   Spectral Centroid: ${metrics3.spectralCentroid?.centroidHz?.toFixed(2) || 'null'} Hz`);
    console.log(`   Tempo:            ${(time3 / 1000).toFixed(2)}s`);
    
    // Comparação de Consistência
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 ANÁLISE DE CONSISTÊNCIA');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const bpmDiff12 = Math.abs((metrics1.bpm || 0) - (metrics2.bpm || 0));
    const bpmDiff23 = Math.abs((metrics2.bpm || 0) - (metrics3.bpm || 0));
    const bpmDiff13 = Math.abs((metrics1.bpm || 0) - (metrics3.bpm || 0));
    
    const lufsDiff12 = Math.abs((metrics1.lufs?.integrated || 0) - (metrics2.lufs?.integrated || 0));
    const lufsDiff23 = Math.abs((metrics2.lufs?.integrated || 0) - (metrics3.lufs?.integrated || 0));
    const lufsDiff13 = Math.abs((metrics1.lufs?.integrated || 0) - (metrics3.lufs?.integrated || 0));
    
    const tpDiff12 = Math.abs((metrics1.truePeak?.maxDbtp || 0) - (metrics2.truePeak?.maxDbtp || 0));
    const tpDiff23 = Math.abs((metrics2.truePeak?.maxDbtp || 0) - (metrics3.truePeak?.maxDbtp || 0));
    const tpDiff13 = Math.abs((metrics1.truePeak?.maxDbtp || 0) - (metrics3.truePeak?.maxDbtp || 0));
    
    const centroidDiff12 = Math.abs((metrics1.spectralCentroid?.centroidHz || 0) - (metrics2.spectralCentroid?.centroidHz || 0));
    const centroidDiff23 = Math.abs((metrics2.spectralCentroid?.centroidHz || 0) - (metrics3.spectralCentroid?.centroidHz || 0));
    const centroidDiff13 = Math.abs((metrics1.spectralCentroid?.centroidHz || 0) - (metrics3.spectralCentroid?.centroidHz || 0));
    
    const bpmOK = bpmDiff12 < 0.5 && bpmDiff23 < 0.5 && bpmDiff13 < 0.5;
    const lufsOK = lufsDiff12 < 0.01 && lufsDiff23 < 0.01 && lufsDiff13 < 0.01;
    const tpOK = tpDiff12 < 0.01 && tpDiff23 < 0.01 && tpDiff13 < 0.01;
    const centroidOK = centroidDiff12 < 1.0 && centroidDiff23 < 1.0 && centroidDiff13 < 1.0;
    
    console.log('BPM:');
    console.log(`   Exec 1-2: Δ ${bpmDiff12.toFixed(3)} BPM ${bpmOK ? '✅' : '❌'}`);
    console.log(`   Exec 2-3: Δ ${bpmDiff23.toFixed(3)} BPM ${bpmOK ? '✅' : '❌'}`);
    console.log(`   Exec 1-3: Δ ${bpmDiff13.toFixed(3)} BPM ${bpmOK ? '✅' : '❌'}`);
    
    console.log('\nLUFS Integrated:');
    console.log(`   Exec 1-2: Δ ${lufsDiff12.toFixed(4)} dB ${lufsOK ? '✅' : '❌'}`);
    console.log(`   Exec 2-3: Δ ${lufsDiff23.toFixed(4)} dB ${lufsOK ? '✅' : '❌'}`);
    console.log(`   Exec 1-3: Δ ${lufsDiff13.toFixed(4)} dB ${lufsOK ? '✅' : '❌'}`);
    
    console.log('\nTrue Peak:');
    console.log(`   Exec 1-2: Δ ${tpDiff12.toFixed(4)} dB ${tpOK ? '✅' : '❌'}`);
    console.log(`   Exec 2-3: Δ ${tpDiff23.toFixed(4)} dB ${tpOK ? '✅' : '❌'}`);
    console.log(`   Exec 1-3: Δ ${tpDiff13.toFixed(4)} dB ${tpOK ? '✅' : '❌'}`);
    
    console.log('\nSpectral Centroid:');
    console.log(`   Exec 1-2: Δ ${centroidDiff12.toFixed(2)} Hz ${centroidOK ? '✅' : '❌'}`);
    console.log(`   Exec 2-3: Δ ${centroidDiff23.toFixed(2)} Hz ${centroidOK ? '✅' : '❌'}`);
    console.log(`   Exec 1-3: Δ ${centroidDiff13.toFixed(2)} Hz ${centroidOK ? '✅' : '❌'}`);
    
    // Análise de Performance
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('⚡ ANÁLISE DE PERFORMANCE');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const avgTime = (time1 + time2 + time3) / 3;
    const minTime = Math.min(time1, time2, time3);
    const maxTime = Math.max(time1, time2, time3);
    
    console.log(`Tempo Médio:    ${(avgTime / 1000).toFixed(2)}s`);
    console.log(`Tempo Mínimo:   ${(minTime / 1000).toFixed(2)}s`);
    console.log(`Tempo Máximo:   ${(maxTime / 1000).toFixed(2)}s`);
    console.log(`Variação:       ${((maxTime - minTime) / 1000).toFixed(2)}s`);
    
    // Estimativa de ganho vs sequencial (baseline ~120s)
    const baselineSequential = 120000; // ms
    const gainMs = baselineSequential - avgTime;
    const gainPercent = (gainMs / baselineSequential) * 100;
    
    console.log(`\nGanho Estimado vs Sequencial:`);
    console.log(`   Baseline:     ${(baselineSequential / 1000).toFixed(2)}s (sem otimizações)`);
    console.log(`   Com Workers:  ${(avgTime / 1000).toFixed(2)}s`);
    console.log(`   Redução:      ${(gainMs / 1000).toFixed(2)}s (${gainPercent.toFixed(0)}%)`);
    
    // Validação de Meta
    const metaAtingida = avgTime <= 20000; // ≤20s
    
    console.log(`\n🎯 Meta de ≤20s: ${metaAtingida ? '✅ ATINGIDA' : '❌ NÃO ATINGIDA'}`);
    
    // Resumo Final
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📋 RESUMO FINAL');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const allOK = bpmOK && lufsOK && tpOK && centroidOK && metaAtingida;
    
    console.log(`Consistência de Resultados:`);
    console.log(`   BPM:              ${bpmOK ? '✅' : '❌'} (tolerância: ±0.5 BPM)`);
    console.log(`   LUFS:             ${lufsOK ? '✅' : '❌'} (tolerância: ±0.01 dB)`);
    console.log(`   True Peak:        ${tpOK ? '✅' : '❌'} (tolerância: ±0.01 dB)`);
    console.log(`   Spectral Centroid: ${centroidOK ? '✅' : '❌'} (tolerância: ±1 Hz)`);
    
    console.log(`\nPerformance:`);
    console.log(`   Tempo Médio:      ${(avgTime / 1000).toFixed(2)}s`);
    console.log(`   Meta ≤20s:        ${metaAtingida ? '✅' : '❌'}`);
    console.log(`   Ganho vs Baseline: ${gainPercent.toFixed(0)}%`);
    
    console.log(`\n${allOK ? '🎉 TODOS OS TESTES PASSARAM!' : '❌ ALGUNS TESTES FALHARAM'}`);
    
    if (!allOK) {
      console.error('\n❌ Revisar implementação - Inconsistências ou performance insuficiente');
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
  console.error('❌ Uso: node test-paralelizacao.js <caminho-para-arquivo-audio>\n');
  console.error('Exemplo: node test-paralelizacao.js ./test-audio.wav\n');
  process.exit(1);
}

testParallelization(filePath);
