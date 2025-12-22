// 🔍 DIAGNÓSTICO COMPLETO: Sample Peak PCM16
// Arquivo: "36 DJ ALEXIA, RODRIGO DO CN - CATUCADA FORTE.wav"
// FFmpeg: max_volume = -0.1 dB, Peak level = -0.101051 dB

import { readFileSync } from 'fs';
import { decodeAudioFile } from './work/api/audio/audio-decoder.js';

const testFilePath = 'C:\\SET - DESANDE AUTOMOTIVO\\36 DJ ALEXIA, RODRIGO DO CN - CATUCADA FORTE.wav';

async function testSamplePeakPCM16() {
  console.log('\n🔍 TESTE DIAGNÓSTICO: Sample Peak PCM16');
  console.log('=' .repeat(80));
  
  try {
    // Ler arquivo
    console.log(`📂 Lendo arquivo: ${testFilePath}`);
    const fileBuffer = readFileSync(testFilePath);
    console.log(`✅ Arquivo lido: ${fileBuffer.length} bytes`);
    
    // Decodificar com audio-decoder.js
    console.log(`\n🎵 Decodificando com audio-decoder.js...`);
    const audioBuffer = await decodeAudioFile(fileBuffer, '36_DJ_ALEXIA_RODRIGO_DO_CN_-_CATUCADA_FORTE.wav', {
      jobId: 'test-pcm16-diagnostic'
    });
    
    console.log(`✅ Decodificação completa:`);
    console.log(`   Sample Rate: ${audioBuffer.sampleRate} Hz`);
    console.log(`   Channels: ${audioBuffer.numberOfChannels}`);
    console.log(`   Samples per channel: ${audioBuffer.length}`);
    console.log(`   Duration: ${audioBuffer.duration.toFixed(2)}s`);
    
    // Analisar buffer manualmente
    console.log(`\n📊 Calculando Sample Peak manualmente...`);
    
    const leftChannel = audioBuffer.leftChannel;
    const rightChannel = audioBuffer.rightChannel;
    
    let maxAbsLeft = 0;
    let maxAbsRight = 0;
    let exactOneCount = 0;
    let nearOneCount = 0; // |x| >= 0.998
    
    for (let i = 0; i < leftChannel.length; i++) {
      const absL = Math.abs(leftChannel[i]);
      const absR = Math.abs(rightChannel[i]);
      
      if (absL > maxAbsLeft) maxAbsLeft = absL;
      if (absR > maxAbsRight) maxAbsRight = absR;
      
      // Contagem de clipping
      if (absL === 1.0) exactOneCount++;
      if (absR === 1.0) exactOneCount++;
      
      if (absL >= 0.998) nearOneCount++;
      if (absR >= 0.998) nearOneCount++;
    }
    
    const maxAbsOverall = Math.max(maxAbsLeft, maxAbsRight);
    
    // Converter para dB
    const leftDb = maxAbsLeft > 0 ? 20 * Math.log10(maxAbsLeft) : -120;
    const rightDb = maxAbsRight > 0 ? 20 * Math.log10(maxAbsRight) : -120;
    const overallDb = maxAbsOverall > 0 ? 20 * Math.log10(maxAbsOverall) : -120;
    
    console.log(`\n📊 RESULTADOS SAMPLE PEAK:`);
    console.log(`   Canal L: ${maxAbsLeft.toFixed(6)} linear = ${leftDb.toFixed(2)} dBFS`);
    console.log(`   Canal R: ${maxAbsRight.toFixed(6)} linear = ${rightDb.toFixed(2)} dBFS`);
    console.log(`   Max Overall: ${maxAbsOverall.toFixed(6)} linear = ${overallDb.toFixed(2)} dBFS`);
    
    console.log(`\n📊 ANÁLISE DE CLIPPING:`);
    console.log(`   Samples exatos em ±1.0: ${exactOneCount} (${(exactOneCount / (leftChannel.length * 2) * 100).toFixed(2)}%)`);
    console.log(`   Samples >= 0.998: ${nearOneCount} (${(nearOneCount / (leftChannel.length * 2) * 100).toFixed(2)}%)`);
    
    // Comparar com FFmpeg ground truth
    const ffmpegPeakDb = -0.101; // volumedetect
    const error = Math.abs(overallDb - ffmpegPeakDb);
    
    console.log(`\n📊 COMPARAÇÃO COM FFMPEG:`);
    console.log(`   FFmpeg volumedetect: ${ffmpegPeakDb.toFixed(3)} dB`);
    console.log(`   Nosso cálculo: ${overallDb.toFixed(3)} dBFS`);
    console.log(`   Diferença: ${error.toFixed(3)} dB`);
    
    if (error < 0.3) {
      console.log(`   ✅ SUCESSO: Erro < 0.3 dB (dentro da tolerância)`);
    } else if (error < 0.5) {
      console.log(`   ⚠️ ALERTA: Erro entre 0.3-0.5 dB (aceitável mas investigar)`);
    } else {
      console.log(`   ❌ FALHA: Erro > 0.5 dB (correção necessária!)`);
    }
    
    // 🔍 DIAGNÓSTICO FINAL
    console.log(`\n🔍 DIAGNÓSTICO:`);
    
    if (exactOneCount > leftChannel.length * 0.01) {
      console.log(`   ⚠️ Áudio tem ${(exactOneCount / (leftChannel.length * 2) * 100).toFixed(1)}% de samples clipados em full scale (±1.0)`);
      console.log(`   → Sistema está CORRETO em pular filtro DC para evitar overshoots`);
    } else if (maxAbsOverall >= 0.998) {
      console.log(`   ℹ️ Áudio tem pico perto de full scale (${(maxAbsOverall * 100).toFixed(2)}%)`);
      console.log(`   → Arquivo quase clipado mas não está em exato ±1.0`);
    } else {
      console.log(`   ℹ️ Áudio NÃO está clipado (pico ${(maxAbsOverall * 100).toFixed(2)}%)`);
      console.log(`   → Filtro DC pode ser aplicado sem problemas`);
    }
    
    if (error > 0.3) {
      console.log(`\n❌ PROBLEMA DETECTADO:`);
      console.log(`   O erro de ${error.toFixed(3)} dB sugere que:`);
      console.log(`   1. Buffer pode não estar normalizado corretamente`);
      console.log(`   2. Conversão FFmpeg pcm_f32le pode ter bug`);
      console.log(`   3. Filtro DC pode estar sendo aplicado incorretamente`);
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error(`\n❌ ERRO NO TESTE: ${error.message}`);
    console.error(error.stack);
  }
}

testSamplePeakPCM16();
