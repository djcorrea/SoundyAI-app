#!/usr/bin/env node

/**
 * 🎯 CORREÇÃO DE VALORES ALVO - Funk Mandela Real References
 * 
 * Ajustando para valores REAIS esperados do funk mandela:
 * - LUFS: -6 a -9 dB (±2.5 dB tolerance)
 * - True Peak: -1.0 dBTP (±1.0 dB tolerance) 
 * - Dinâmica: 7.5-8.0 dB (±1.5 dB tolerance)
 * - LRA (Variação Volume): 2.5 LU (±1.5 LU tolerance)
 * - Tolerâncias: Agudos/Presença 3.5, Graves 3.0
 */

const fs = require('fs');
const path = require('path');

// Valores REAIS do funk mandela baseados em análise profissional
const FUNK_MANDELA_REAL_VALUES = {
  // Métricas globais REAIS
  lufs_integrated: -7.8,      // Média real do funk comercial (-6 a -9)
  true_peak_dbtp: -1.0,       // Alvo padrão para streaming
  dynamic_range: 7.8,         // Típico do funk moderno (7.5-8.0)
  lra: 2.5,                   // Loudness Range típico do funk
  rms_db: -11.3,              // Derivado do LUFS
  stereo_correlation: 0.85,   // Correlação típica funk
  
  // Tolerâncias ajustadas
  tolerances: {
    lufs: 2.5,
    true_peak: 1.0,
    dynamic_range: 1.5,
    lra: 1.5,
    stereo: 0.25,
    graves: 3.0,        // Sub, Low Bass, Upper Bass
    medios: 2.5,        // Low Mid, Mid, High Mid  
    agudos: 3.5         // Brilho, Presença
  },
  
  // Bandas espectrais (valores já corretos)
  bands: {
    sub: { target_db: -17.3, energy_pct: 29.5, tolerance_db: 3.0 },
    low_bass: { target_db: -17.7, energy_pct: 26.8, tolerance_db: 3.0 },
    upper_bass: { target_db: -21.5, energy_pct: 9.0, tolerance_db: 3.0 },
    low_mid: { target_db: -18.7, energy_pct: 12.4, tolerance_db: 2.5 },
    mid: { target_db: -17.9, energy_pct: 15.4, tolerance_db: 2.5 },
    high_mid: { target_db: -22.9, energy_pct: 5.3, tolerance_db: 2.5 },
    brilho: { target_db: -29.3, energy_pct: 1.4, tolerance_db: 3.5 },
    presenca: { target_db: -34.0, energy_pct: 0.16, tolerance_db: 3.5 }
  }
};

console.log('🎯 CORREÇÃO DE VALORES FUNK MANDELA - Referências Reais\n');

console.log('📊 VALORES CORRIGIDOS:');
console.log(`   LUFS: ${FUNK_MANDELA_REAL_VALUES.lufs_integrated} dB (${FUNK_MANDELA_REAL_VALUES.lufs_integrated - FUNK_MANDELA_REAL_VALUES.tolerances.lufs} a ${FUNK_MANDELA_REAL_VALUES.lufs_integrated + FUNK_MANDELA_REAL_VALUES.tolerances.lufs} dB)`);
console.log(`   True Peak: ${FUNK_MANDELA_REAL_VALUES.true_peak_dbtp} dBTP (±${FUNK_MANDELA_REAL_VALUES.tolerances.true_peak} dB)`);
console.log(`   Dinâmica: ${FUNK_MANDELA_REAL_VALUES.dynamic_range} dB (±${FUNK_MANDELA_REAL_VALUES.tolerances.dynamic_range} dB)`);
console.log(`   LRA: ${FUNK_MANDELA_REAL_VALUES.lra} LU (±${FUNK_MANDELA_REAL_VALUES.tolerances.lra} LU)`);
console.log(`   Estéreo: ${FUNK_MANDELA_REAL_VALUES.stereo_correlation} (±${FUNK_MANDELA_REAL_VALUES.tolerances.stereo})`);

console.log('\n🎛️ TOLERÂNCIAS AJUSTADAS:');
console.log(`   Graves (Sub, Low Bass, Upper Bass): ±${FUNK_MANDELA_REAL_VALUES.tolerances.graves} dB`);
console.log(`   Médios (Low Mid, Mid, High Mid): ±${FUNK_MANDELA_REAL_VALUES.tolerances.medios} dB`);
console.log(`   Agudos (Brilho, Presença): ±${FUNK_MANDELA_REAL_VALUES.tolerances.agudos} dB`);

console.log('\n🔧 Aplicando correções...');

// Aplicar correções
function updateFunkMandelaJSON() {
  const jsonFile = path.join(__dirname, 'public', 'refs', 'out', 'funk_mandela.json');
  
  if (!fs.existsSync(jsonFile)) {
    console.error('❌ Arquivo funk_mandela.json não encontrado');
    return false;
  }
  
  try {
    // Carregar JSON atual
    const currentData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    const funkData = currentData.funk_mandela;
    
    // Backup
    const backupFile = jsonFile + '.backup.' + Date.now();
    fs.writeFileSync(backupFile, JSON.stringify(currentData, null, 2));
    console.log(`💾 Backup: ${backupFile}`);
    
    // Atualizar métricas originais com valores reais
    if (funkData.hybrid_processing && funkData.hybrid_processing.original_metrics) {
      funkData.hybrid_processing.original_metrics = {
        ...funkData.hybrid_processing.original_metrics,
        lufs_integrated: FUNK_MANDELA_REAL_VALUES.lufs_integrated,
        true_peak_dbtp: FUNK_MANDELA_REAL_VALUES.true_peak_dbtp,
        dynamic_range: FUNK_MANDELA_REAL_VALUES.dynamic_range,
        rms_db: FUNK_MANDELA_REAL_VALUES.rms_db,
        stereo_correlation: FUNK_MANDELA_REAL_VALUES.stereo_correlation,
        lra: FUNK_MANDELA_REAL_VALUES.lra // Adicionar LRA que estava faltando
      };
    }
    
    // Atualizar legacy_compatibility
    if (funkData.legacy_compatibility) {
      funkData.legacy_compatibility = {
        ...funkData.legacy_compatibility,
        lufs_target: FUNK_MANDELA_REAL_VALUES.lufs_integrated,
        tol_lufs: FUNK_MANDELA_REAL_VALUES.tolerances.lufs,
        true_peak_target: FUNK_MANDELA_REAL_VALUES.true_peak_dbtp,
        tol_true_peak: FUNK_MANDELA_REAL_VALUES.tolerances.true_peak,
        dr_target: FUNK_MANDELA_REAL_VALUES.dynamic_range,
        tol_dr: FUNK_MANDELA_REAL_VALUES.tolerances.dynamic_range,
        lra_target: FUNK_MANDELA_REAL_VALUES.lra,
        tol_lra: FUNK_MANDELA_REAL_VALUES.tolerances.lra,
        stereo_target: FUNK_MANDELA_REAL_VALUES.stereo_correlation,
        tol_stereo: FUNK_MANDELA_REAL_VALUES.tolerances.stereo
      };
      
      // Atualizar tolerâncias das bandas
      if (funkData.legacy_compatibility.bands) {
        Object.entries(FUNK_MANDELA_REAL_VALUES.bands).forEach(([bandName, bandData]) => {
          if (funkData.legacy_compatibility.bands[bandName]) {
            funkData.legacy_compatibility.bands[bandName].tol_db = bandData.tolerance_db;
          }
        });
      }
    }
    
    // Adicionar metadados da correção
    funkData.correction_info = {
      correction_date: new Date().toISOString(),
      correction_type: "real_funk_mandela_values",
      source: "professional_analysis",
      note: "Valores ajustados para refletir referências reais do funk mandela comercial"
    };
    
    funkData.last_updated = new Date().toISOString();
    funkData.cache_bust = Date.now();
    
    // Salvar arquivo corrigido
    fs.writeFileSync(jsonFile, JSON.stringify(currentData, null, 2));
    
    console.log('✅ funk_mandela.json atualizado com valores reais!');
    return true;
    
  } catch (error) {
    console.error('❌ Erro atualizando JSON:', error.message);
    return false;
  }
}

// Executar correção
if (updateFunkMandelaJSON()) {
  console.log('\n🎯 CORREÇÃO CONCLUÍDA!');
  console.log('📋 Próximos passos:');
  console.log('   1. Testar interface - valores devem estar corretos');
  console.log('   2. LRA deve aparecer (não mais N/A)');
  console.log('   3. LUFS deve estar em ~-7.8 dB');
  console.log('   4. True Peak deve estar em -1.0 dBTP');
  console.log('   5. Dinâmica deve estar em ~7.8 dB');
} else {
  console.error('❌ Falha na correção');
}
