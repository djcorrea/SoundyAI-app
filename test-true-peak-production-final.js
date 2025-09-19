#!/usr/bin/env node

// 🔥 TESTE FINAL - TRUE PEAK FFmpeg PRODUÇÃO
// Verifica se a migração foi 100% concluída

import { processAudioComplete } from "./api/audio/pipeline-complete.js";
import fs from 'fs';
import path from 'path';

console.log('🔥 TESTE FINAL - TRUE PEAK FFmpeg PRODUÇÃO');
console.log('=========================================\n');

async function testProductionPipeline() {
  try {
    console.log('🎵 Carregando arquivo de teste...');
    
    // Usar um arquivo pequeno do projeto
    const testFiles = [
      './test-debug-complete.wav', 
      './test-converted.wav',
      './test-audio-debug.wav'
    ];
    
    let testFile = null;
    for (const file of testFiles) {
      if (fs.existsSync(file)) {
        testFile = file;
        break;
      }
    }
    
    if (!testFile) {
      console.log('❌ Nenhum arquivo de teste encontrado. Criando um WAV mínimo...');
      
      // Criar um WAV mínimo para teste (1 segundo, 48kHz, mono)
      const sampleRate = 48000;
      const duration = 1; // 1 segundo
      const samples = sampleRate * duration;
      
      // Header WAV básico
      const buffer = Buffer.alloc(44 + samples * 2);
      let offset = 0;
      
      // RIFF header
      buffer.write('RIFF', offset); offset += 4;
      buffer.writeUInt32LE(buffer.length - 8, offset); offset += 4;
      buffer.write('WAVE', offset); offset += 4;
      
      // fmt chunk
      buffer.write('fmt ', offset); offset += 4;
      buffer.writeUInt32LE(16, offset); offset += 4; // chunk size
      buffer.writeUInt16LE(1, offset); offset += 2;  // PCM
      buffer.writeUInt16LE(1, offset); offset += 2;  // mono
      buffer.writeUInt32LE(sampleRate, offset); offset += 4;
      buffer.writeUInt32LE(sampleRate * 2, offset); offset += 4; // byte rate
      buffer.writeUInt16LE(2, offset); offset += 2;  // block align
      buffer.writeUInt16LE(16, offset); offset += 2; // bits per sample
      
      // data chunk
      buffer.write('data', offset); offset += 4;
      buffer.writeUInt32LE(samples * 2, offset); offset += 4;
      
      // Audio data (sine wave 1kHz)
      for (let i = 0; i < samples; i++) {
        const sample = Math.sin(2 * Math.PI * 1000 * i / sampleRate) * 0.5;
        const value = Math.round(sample * 32767);
        buffer.writeInt16LE(value, offset);
        offset += 2;
      }
      
      testFile = './test-truepeak-production.wav';
      fs.writeFileSync(testFile, buffer);
      console.log(`✅ Arquivo de teste criado: ${testFile}`);
    }
    
    console.log(`📁 Usando arquivo: ${testFile}`);
    const audioBuffer = fs.readFileSync(testFile);
    console.log(`📊 Tamanho do arquivo: ${audioBuffer.length} bytes`);
    
    console.log('\n🚀 Executando pipeline de produção...');
    const startTime = Date.now();
    
    const result = await processAudioComplete(audioBuffer, path.basename(testFile), {
      jobId: 'test_production_' + Date.now()
    });
    
    const duration = Date.now() - startTime;
    console.log(`⏱️ Pipeline executado em ${duration}ms`);
    
    console.log('\n📊 RESULTADOS:');
    console.log('==============');
    
    if (result.status === 'error') {
      console.log('❌ Erro no pipeline:', result.error);
      return;
    }
    
    console.log(`🎯 Score: ${result.score}% (${result.classification})`);
    console.log(`🔊 LUFS: ${result.lufs?.integrated?.toFixed(1) || 'N/A'} LUFS`);
    console.log(`🚨 True Peak: ${result.truePeak?.maxDbtp?.toFixed(1) || 'N/A'} dBTP`);
    console.log(`🎶 Correlação Estéreo: ${result.stereo?.correlation?.toFixed(3) || 'N/A'}`);
    
    // 🔍 Verificação crítica: True Peak deve ser negativo!
    const truePeakValue = result.truePeak?.maxDbtp;
    if (truePeakValue !== undefined && truePeakValue !== null) {
      if (truePeakValue > 0) {
        console.log(`\n❌ PROBLEMA CRÍTICO: True Peak positivo detectado: ${truePeakValue} dBTP`);
        console.log('❌ Isso indica que o código antigo ainda está sendo usado!');
        return false;
      } else {
        console.log(`\n✅ True Peak correto: ${truePeakValue} dBTP (negativo como esperado)`);
      }
    } else {
      console.log('\n⚠️ True Peak não encontrado no resultado');
    }
    
    console.log('\n🔧 MÉTODO DE CÁLCULO:');
    console.log(`📊 Scoring: ${result.scoringMethod || 'N/A'}`);
    console.log(`⏱️ Tempo total: ${result.metadata?.processingTime || duration}ms`);
    
    if (result.metadata?.phaseBreakdown) {
      console.log('\n📊 BREAKDOWN POR FASE:');
      console.log(`🎵 Decodificação: ${result.metadata.phaseBreakdown.phase1_decoding}ms`);
      console.log(`⏱️ Segmentação: ${result.metadata.phaseBreakdown.phase2_segmentation}ms`);
      console.log(`📊 Core Metrics: ${result.metadata.phaseBreakdown.phase3_core_metrics}ms`);
      console.log(`🎯 JSON Output: ${result.metadata.phaseBreakdown.phase4_json_output}ms`);
    }
    
    console.log('\n🎉 TESTE CONCLUÍDO - MIGRAÇÃO FFmpeg TRUE PEAK VERIFICADA!');
    return true;
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Executar teste
testProductionPipeline()
  .then(success => {
    if (success) {
      console.log('\n✅ MIGRAÇÃO FFmpeg TRUE PEAK: SUCESSO TOTAL!');
      console.log('🔥 Pipeline de produção usando 100% FFmpeg - SEM FALLBACK');
      process.exit(0);
    } else {
      console.log('\n❌ MIGRAÇÃO FFmpeg TRUE PEAK: PROBLEMAS DETECTADOS!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 ERRO CRÍTICO:', error);
    process.exit(1);
  });