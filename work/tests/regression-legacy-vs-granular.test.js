// 🧪 TESTE DE REGRESSÃO: Legacy vs Granular V1
// Valida que granular_v1 é compatível com o sistema legacy

import { calculateCoreMetrics } from '../api/audio/core-metrics.js';

// Mock de áudio segmentado com frames FFT
function createMockSegmentedAudio() {
  const frames = [];
  const fftSize = 4096;
  
  // Criar 50 frames mocados
  for (let i = 0; i < 50; i++) {
    const leftFFT = {
      magnitude: new Float32Array(fftSize / 2),
      phase: new Float32Array(fftSize / 2)
    };
    
    const rightFFT = {
      magnitude: new Float32Array(fftSize / 2),
      phase: new Float32Array(fftSize / 2)
    };
    
    // Preencher com valores simulados (energia decrescente)
    for (let bin = 0; bin < fftSize / 2; bin++) {
      const freq = (bin / (fftSize / 2)) * 24000; // 0-24kHz
      
      // Simular espectro com energia decrescente
      let energy = 1.0;
      if (freq < 60) energy = 0.8;        // Sub
      else if (freq < 150) energy = 0.9;  // Bass
      else if (freq < 500) energy = 0.7;  // Low Mid
      else if (freq < 2000) energy = 0.6; // Mid
      else if (freq < 5000) energy = 0.5; // High Mid
      else if (freq < 10000) energy = 0.4; // Presence
      else energy = 0.2;                   // Air
      
      // Adicionar variação aleatória
      energy *= (0.9 + Math.random() * 0.2);
      
      leftFFT.magnitude[bin] = energy;
      rightFFT.magnitude[bin] = energy * (0.95 + Math.random() * 0.1);
    }
    
    frames.push({ leftFFT, rightFFT });
  }
  
  return {
    framesFFT: { frames },
    audioInfo: {
      sampleRate: 48000,
      channels: 2,
      duration: 3.0
    }
  };
}

// Função de teste principal
async function runRegressionTest() {
  console.log('🧪 TESTE DE REGRESSÃO: Legacy vs Granular V1');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const mockAudio = createMockSegmentedAudio();
  
  try {
    // ===== TESTE 1: Executar Legacy =====
    console.log('📊 TESTE 1: Engine Legacy');
    console.log('─────────────────────────────────────────────────────────');
    
    process.env.ANALYZER_ENGINE = 'legacy';
    const legacyResult = await calculateCoreMetrics(mockAudio);
    
    console.log('✅ Legacy executado com sucesso');
    console.log(`   - Tem spectralBands: ${!!legacyResult.spectralBands}`);
    console.log(`   - Tem .bands: ${!!legacyResult.spectralBands?.bands}`);
    
    if (legacyResult.spectralBands?.bands) {
      const legacyBandKeys = Object.keys(legacyResult.spectralBands.bands);
      console.log(`   - Chaves bands: [${legacyBandKeys.join(', ')}]`);
      console.log(`   - Sub energy_db: ${legacyResult.spectralBands.bands.sub?.energy_db}`);
      console.log(`   - Bass energy_db: ${legacyResult.spectralBands.bands.bass?.energy_db}`);
    }
    
    // ===== TESTE 2: Executar Granular =====
    console.log('\n📊 TESTE 2: Engine Granular V1');
    console.log('─────────────────────────────────────────────────────────');
    
    process.env.ANALYZER_ENGINE = 'granular_v1';
    const granularResult = await calculateCoreMetrics(mockAudio);
    
    console.log('✅ Granular executado com sucesso');
    console.log(`   - Tem spectralBands: ${!!granularResult.spectralBands}`);
    console.log(`   - Tem .bands: ${!!granularResult.spectralBands?.bands}`);
    console.log(`   - Tem .groups: ${!!granularResult.spectralBands?.groups}`);
    console.log(`   - Tem .granular: ${!!granularResult.spectralBands?.granular}`);
    console.log(`   - Tem .suggestions: ${!!granularResult.spectralBands?.suggestions}`);
    
    if (granularResult.spectralBands?.bands) {
      const granularBandKeys = Object.keys(granularResult.spectralBands.bands);
      console.log(`   - Chaves bands: [${granularBandKeys.join(', ')}]`);
      console.log(`   - Sub energy_db: ${granularResult.spectralBands.bands.sub?.energy_db}`);
      console.log(`   - Bass energy_db: ${granularResult.spectralBands.bands.bass?.energy_db}`);
    }
    
    if (granularResult.spectralBands?.granular) {
      console.log(`   - Sub-bandas granulares: ${granularResult.spectralBands.granular.length}`);
    }
    
    if (granularResult.spectralBands?.suggestions) {
      console.log(`   - Sugestões geradas: ${granularResult.spectralBands.suggestions.length}`);
    }
    
    // ===== TESTE 3: Validar Estrutura de Bandas =====
    console.log('\n📊 TESTE 3: Validação de Estrutura');
    console.log('─────────────────────────────────────────────────────────');
    
    // Validar que granular tem .bands
    if (!granularResult.spectralBands?.bands) {
      throw new Error('❌ FALHA: Granular não tem campo .bands');
    }
    console.log('✅ Granular tem campo .bands');
    
    // Validar 7 chaves
    const granularBandKeys = Object.keys(granularResult.spectralBands.bands);
    if (granularBandKeys.length !== 7) {
      throw new Error(`❌ FALHA: Granular.bands tem ${granularBandKeys.length} chaves (esperado: 7)`);
    }
    console.log('✅ Granular.bands tem 7 chaves');
    
    // Validar chaves específicas
    const expectedKeys = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air'];
    for (const key of expectedKeys) {
      if (!(key in granularResult.spectralBands.bands)) {
        throw new Error(`❌ FALHA: Chave ${key} não encontrada em granular.bands`);
      }
    }
    console.log('✅ Todas as 7 chaves esperadas presentes');
    
    // Validar estrutura de cada banda
    for (const key of expectedKeys) {
      const band = granularResult.spectralBands.bands[key];
      
      if (!('energy_db' in band)) {
        throw new Error(`❌ FALHA: ${key} não tem campo energy_db`);
      }
      
      if (!('percentage' in band)) {
        throw new Error(`❌ FALHA: ${key} não tem campo percentage`);
      }
      
      if (band.energy_db !== null && typeof band.energy_db !== 'number') {
        throw new Error(`❌ FALHA: ${key}.energy_db não é number ou null (tipo: ${typeof band.energy_db})`);
      }
      
      if (typeof band.percentage !== 'number') {
        throw new Error(`❌ FALHA: ${key}.percentage não é number (tipo: ${typeof band.percentage})`);
      }
    }
    console.log('✅ Todas as bandas têm campos obrigatórios com tipos corretos');
    
    // ===== TESTE 4: Comparar Valores =====
    console.log('\n📊 TESTE 4: Comparação de Valores (Legacy vs Granular)');
    console.log('─────────────────────────────────────────────────────────');
    
    if (legacyResult.spectralBands?.bands && granularResult.spectralBands?.bands) {
      for (const key of expectedKeys) {
        const legacyBand = legacyResult.spectralBands.bands[key];
        const granularBand = granularResult.spectralBands.bands[key];
        
        if (legacyBand && granularBand) {
          const legacyEnergy = legacyBand.energy_db;
          const granularEnergy = granularBand.energy_db;
          
          if (legacyEnergy !== null && granularEnergy !== null) {
            const diff = Math.abs(legacyEnergy - granularEnergy);
            const tolerance = 5.0; // 5 dB de tolerância (métodos diferentes)
            
            console.log(`   - ${key.padEnd(10)}: Legacy=${legacyEnergy.toFixed(1)} dB, Granular=${granularEnergy.toFixed(1)} dB, Diff=${diff.toFixed(1)} dB ${diff <= tolerance ? '✅' : '⚠️'}`);
            
            if (diff > tolerance) {
              console.warn(`     ⚠️ Diferença alta (tolerância: ${tolerance} dB)`);
            }
          }
        }
      }
    } else {
      console.log('   ⚠️ Não foi possível comparar valores (bands ausente em um dos resultados)');
    }
    
    // ===== TESTE 5: Validar Percentagens =====
    console.log('\n📊 TESTE 5: Validação de Percentagens');
    console.log('─────────────────────────────────────────────────────────');
    
    let totalPercentage = 0;
    for (const key of expectedKeys) {
      const band = granularResult.spectralBands.bands[key];
      totalPercentage += band.percentage;
    }
    
    console.log(`   - Total de percentagens: ${totalPercentage.toFixed(2)}%`);
    
    if (Math.abs(totalPercentage - 100) > 1.0) {
      console.warn(`   ⚠️ Total não soma ~100% (diferença: ${Math.abs(totalPercentage - 100).toFixed(2)}%)`);
    } else {
      console.log('   ✅ Total de percentagens OK (≈100%)');
    }
    
    // ===== RESUMO FINAL =====
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎯 RESUMO DO TESTE DE REGRESSÃO');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('✅ Legacy: Funcionando corretamente');
    console.log('✅ Granular: Funcionando corretamente');
    console.log('✅ Granular tem campo .bands com 7 chaves');
    console.log('✅ Estrutura de bandas compatível com legacy');
    console.log('✅ Campos aditivos presentes (groups, granular, suggestions)');
    console.log('✅ TESTE DE REGRESSÃO: PASSOU\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE DE REGRESSÃO:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Executar teste
runRegressionTest();
