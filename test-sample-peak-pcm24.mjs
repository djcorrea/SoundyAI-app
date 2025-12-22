/**
 * 🔍 TESTE DIAGNÓSTICO: PCM 24-bit Sample Peak
 * Objetivo: Testar arquivo "35 SOCA SOCA EXTENDED.wav" e verificar se o problema de +36 dB persiste
 */

import { decodeAudioFile } from './work/api/audio/audio-decoder.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function testSamplePeakPCM24() {
  console.log('🔍 TESTE DIAGNÓSTICO: Sample Peak PCM 24-bit\n');
  console.log('='.repeat(80));
  
  try {
    // Ler arquivo problemático
    const filePath = 'C:\\SET - DESANDE AUTOMOTIVO\\35 SOCA SOCA EXTENDED.wav';
    console.log(`📁 Lendo arquivo: ${filePath}`);
    
    const fileBuffer = await readFile(filePath);
    console.log(`✅ Arquivo lido: ${fileBuffer.length} bytes`);
    
    // Decodificar com nosso sistema
    console.log(`\n📊 Decodificando com audio-decoder.js...`);
    const audioData = await decodeAudioFile(fileBuffer, '35_SOCA_SOCA_EXTENDED.wav', { jobId: 'test' });
    
    console.log(`✅ Decodificação completa:`);
    console.log(`   Sample Rate: ${audioData.sampleRate} Hz`);
    console.log(`   Channels: ${audioData.numberOfChannels}`);
    console.log(`   Samples per channel: ${audioData.length}`);
    console.log(`   Duration: ${audioData.duration.toFixed(2)}s`);
    
    // Calcular Sample Peak manualmente
    console.log(`\n📊 Calculando Sample Peak manualmente...`);
    
    const leftChannel = audioData.leftChannel;
    const rightChannel = audioData.rightChannel;
    
    // Encontrar max absolute value
    let maxLeft = 0;
    let maxRight = 0;
    
    for (let i = 0; i < leftChannel.length; i++) {
      const absLeft = Math.abs(leftChannel[i]);
      const absRight = Math.abs(rightChannel[i]);
      
      if (absLeft > maxLeft) maxLeft = absLeft;
      if (absRight > maxRight) maxRight = absRight;
    }
    
    const maxOverall = Math.max(maxLeft, maxRight);
    
    // Converter para dB
    const maxLeftDb = maxLeft > 0 ? 20 * Math.log10(maxLeft) : -120;
    const maxRightDb = maxRight > 0 ? 20 * Math.log10(maxRight) : -120;
    const maxOverallDb = maxOverall > 0 ? 20 * Math.log10(maxOverall) : -120;
    
    console.log(`\n📊 RESULTADOS SAMPLE PEAK:`);
    console.log(`   Canal L: ${maxLeft.toFixed(6)} linear = ${maxLeftDb.toFixed(2)} dBFS`);
    console.log(`   Canal R: ${maxRight.toFixed(6)} linear = ${maxRightDb.toFixed(2)} dBFS`);
    console.log(`   Max Overall: ${maxOverall.toFixed(6)} linear = ${maxOverallDb.toFixed(2)} dBFS`);
    
    // Análise do buffer
    console.log(`\n🔍 ANÁLISE DO BUFFER:`);
    
    // Contar valores fora de [-1, 1]
    let outOfRangeCount = 0;
    let maxAbsolute = 0;
    
    for (let i = 0; i < leftChannel.length; i++) {
      const absL = Math.abs(leftChannel[i]);
      const absR = Math.abs(rightChannel[i]);
      
      if (absL > maxAbsolute) maxAbsolute = absL;
      if (absR > maxAbsolute) maxAbsolute = absR;
      
      if (absL > 1.0 || absR > 1.0) {
        outOfRangeCount++;
        
        // Log primeiros 10 valores fora de range
        if (outOfRangeCount <= 10) {
          console.log(`   Sample ${i}: L=${leftChannel[i].toFixed(6)}, R=${rightChannel[i].toFixed(6)} ⚠️  FORA DE RANGE`);
        }
      }
    }
    
    console.log(`\n📊 ESTATÍSTICAS:`);
    console.log(`   Total de samples: ${leftChannel.length}`);
    console.log(`   Out of range [-1, 1]: ${outOfRangeCount} (${(outOfRangeCount / leftChannel.length * 100).toFixed(2)}%)`);
    console.log(`   Max absolute value: ${maxAbsolute.toFixed(6)}`);
    
    // Diagnóstico
    console.log(`\n🎯 DIAGNÓSTICO:`);
    
    if (maxAbsolute > 1.0) {
      console.log(`   ❌ ERRO: Buffer contém valores > 1.0 (max=${maxAbsolute.toFixed(6)})`);
      console.log(`   🔧 CAUSA: Provável erro na conversão FFmpeg ou leitura do buffer`);
      
      if (maxAbsolute > 1e6) {
        console.log(`   🚨 CRÍTICO: Valores em escala PCM inteiro (${maxAbsolute.toFixed(0)})`);
        console.log(`   🔧 CORREÇÃO: Divisor necessário = ${maxAbsolute.toFixed(0)}`);
      }
    } else if (Math.abs(maxOverallDb - 0.0) < 0.2) {
      console.log(`   ✅ OK: Sample Peak ≈ 0 dBFS (arquivo clipado conforme esperado)`);
    } else {
      console.log(`   ⚠️  ATENÇÃO: Sample Peak = ${maxOverallDb.toFixed(2)} dBFS`);
      console.log(`   📋 ESPERADO: ≈ 0.0 dBFS (FFmpeg volumedetect confirma max_volume=0.0 dB)`);
    }
    
    // Comparação com FFmpeg
    console.log(`\n📊 COMPARAÇÃO COM FFMPEG:`);
    console.log(`   FFmpeg volumedetect: max_volume = 0.0 dB`);
    console.log(`   Nosso cálculo: ${maxOverallDb.toFixed(2)} dBFS`);
    console.log(`   Diferença: ${Math.abs(maxOverallDb - 0.0).toFixed(2)} dB`);
    
    if (Math.abs(maxOverallDb - 0.0) < 0.2) {
      console.log(`   ✅ SUCESSO: Erro < 0.2 dB (dentro da tolerância)`);
    } else {
      console.log(`   ❌ FALHA: Erro > 0.2 dB`);
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error(error.stack);
  }
}

// Executar teste
testSamplePeakPCM24().catch(console.error);
