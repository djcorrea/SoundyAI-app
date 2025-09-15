// 🔍 TESTE DE AUDITORIA - Métricas Espectrais no JSON Final
// Validar se as correções implementadas resolveram o problema de métricas espectrais ausentes

import { processAudioComplete } from './work/api/audio/pipeline-complete.js';
import fs from 'fs';

console.log('🔍 INICIANDO AUDITORIA DE MÉTRICAS ESPECTRAIS');

async function testSpectralMetricsInFinalJSON() {
  try {
    // Simular um arquivo de áudio pequeno (será substituído por um arquivo real)
    const mockAudioBuffer = new ArrayBuffer(44100 * 2 * 2); // 1 segundo, 44.1kHz, 16-bit, stereo
    
    console.log('📊 Processando áudio de teste...');
    
    // Processar com pipeline completo
    const result = await processAudioComplete(
      mockAudioBuffer, 
      'test-spectral-audit.wav',
      { 
        jobId: 'spectral-audit-001',
        genre: 'electronic'
      }
    );
    
    console.log('\n🎯 RESULTADO DA AUDITORIA:');
    
    // ===== VERIFICAR MÉTRICAS ESPECTRAIS NO NÍVEL RAIZ =====
    console.log('\n📊 MÉTRICAS ESPECTRAIS (nível raiz):');
    console.log('spectralCentroidHz:', result.spectralCentroidHz);
    console.log('spectralRolloffHz:', result.spectralRolloffHz);
    console.log('spectralBandwidthHz:', result.spectralBandwidthHz);
    console.log('spectralFlatness:', result.spectralFlatness);
    
    // ===== VERIFICAR SEÇÃO SPECTRAL =====
    console.log('\n🎵 SEÇÃO SPECTRAL:');
    if (result.spectral) {
      console.log('spectral.centroidHz:', result.spectral.centroidHz);
      console.log('spectral.rolloffHz:', result.spectral.rolloffHz);
      console.log('spectral.bandwidthHz:', result.spectral.bandwidthHz);
      console.log('spectral.flatness:', result.spectral.flatness);
      console.log('spectral.hasData:', result.spectral.hasData);
    } else {
      console.log('❌ Seção spectral NÃO ENCONTRADA');
    }
    
    // ===== VERIFICAR BANDAS ESPECTRAIS =====
    console.log('\n🌈 BANDAS ESPECTRAIS:');
    if (result.spectralBands) {
      console.log('spectralBands.hasData:', result.spectralBands.hasData);
      console.log('spectralBands.detailed:', !!result.spectralBands.detailed);
      console.log('spectralBands.simplified:', !!result.spectralBands.simplified);
      
      if (result.spectralBands.simplified) {
        console.log('  - sub:', result.spectralBands.simplified.sub);
        console.log('  - bass:', result.spectralBands.simplified.bass);
        console.log('  - mid:', result.spectralBands.simplified.mid);
        console.log('  - presence:', result.spectralBands.simplified.presence);
        console.log('  - air:', result.spectralBands.simplified.air);
      }
    } else {
      console.log('❌ Seção spectralBands NÃO ENCONTRADA');
    }
    
    // ===== VERIFICAR TECHNICALDATA =====
    console.log('\n📋 TECHNICAL DATA:');
    if (result.technicalData) {
      console.log('technicalData.spectralCentroid:', result.technicalData.spectralCentroid);
      console.log('technicalData.spectralCentroidHz:', result.technicalData.spectralCentroidHz);
      console.log('technicalData.spectralRolloff:', result.technicalData.spectralRolloff);
      console.log('technicalData.spectralRolloffHz:', result.technicalData.spectralRolloffHz);
      console.log('technicalData.bandEnergies:', !!result.technicalData.bandEnergies);
      console.log('technicalData.spectral_balance:', !!result.technicalData.spectral_balance);
    } else {
      console.log('❌ TechnicalData NÃO ENCONTRADA');
    }
    
    // ===== RESUMO DA AUDITORIA =====
    console.log('\n📝 RESUMO DA AUDITORIA:');
    
    const checksSpectral = [
      { name: 'spectralCentroidHz (raiz)', value: result.spectralCentroidHz },
      { name: 'spectralRolloffHz (raiz)', value: result.spectralRolloffHz },
      { name: 'spectral.centroidHz', value: result.spectral?.centroidHz },
      { name: 'spectral.rolloffHz', value: result.spectral?.rolloffHz },
      { name: 'technicalData.spectralCentroid', value: result.technicalData?.spectralCentroid },
      { name: 'technicalData.spectralCentroidHz', value: result.technicalData?.spectralCentroidHz },
    ];
    
    const checksSpectralBands = [
      { name: 'spectralBands.hasData', value: result.spectralBands?.hasData },
      { name: 'spectralBands.simplified', value: !!result.spectralBands?.simplified },
      { name: 'technicalData.bandEnergies', value: !!result.technicalData?.bandEnergies },
      { name: 'technicalData.spectral_balance', value: !!result.technicalData?.spectral_balance },
    ];
    
    console.log('\n✅ MÉTRICAS ESPECTRAIS:');
    checksSpectral.forEach(check => {
      const status = (check.value !== null && check.value !== undefined) ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${check.value}`);
    });
    
    console.log('\n🌈 BANDAS ESPECTRAIS:');
    checksSpectralBands.forEach(check => {
      const status = check.value ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${check.value}`);
    });
    
    // ===== SALVAR RESULTADO COMPLETO =====
    const resultFile = './test-spectral-audit-result.json';
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
    console.log(`\n💾 Resultado completo salvo em: ${resultFile}`);
    
    // ===== VERIFICAÇÃO FINAL =====
    const hasSpectralMetrics = checksSpectral.some(check => 
      check.value !== null && check.value !== undefined
    );
    const hasSpectralBands = checksSpectralBands.some(check => check.value);
    
    console.log('\n🏁 RESULTADO FINAL:');
    console.log(`Métricas Espectrais: ${hasSpectralMetrics ? '✅ PRESENTES' : '❌ AUSENTES'}`);
    console.log(`Bandas Espectrais: ${hasSpectralBands ? '✅ PRESENTES' : '❌ AUSENTES'}`);
    
    if (hasSpectralMetrics && hasSpectralBands) {
      console.log('\n🎉 AUDITORIA CONCLUÍDA: Problema das métricas espectrais CORRIGIDO!');
      return true;
    } else {
      console.log('\n⚠️ AUDITORIA CONCLUÍDA: Problema das métricas espectrais AINDA PRESENTE');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ ERRO NA AUDITORIA:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Executar teste
testSpectralMetricsInFinalJSON()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });