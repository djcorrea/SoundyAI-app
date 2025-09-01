#!/usr/bin/env node

// Script para corrigir valores das bandas espectrais
const fs = require('fs');

console.log('🔧 CORREÇÃO DOS VALORES DAS BANDAS ESPECTRAIS\n');

// Função para calcular dB relativo baseado na energia %
function calculateRealisticDbFromEnergy(energyPct) {
  // Para material normalizado a -18 LUFS, usar uma escala realista
  // Bandas dominantes (>20%): -8 a -12 dB
  // Bandas médias (10-20%): -12 a -18 dB  
  // Bandas menores (5-10%): -18 a -25 dB
  // Bandas pequenas (<5%): -25 a -35 dB
  
  if (energyPct > 20) {
    return -18 + (10 * Math.log10(energyPct / 25)); // Escala para bandas dominantes
  } else if (energyPct > 10) {
    return -18 + (8 * Math.log10(energyPct / 15)); // Escala para bandas médias
  } else if (energyPct > 5) {
    return -22 + (6 * Math.log10(energyPct / 7.5)); // Escala para bandas menores
  } else {
    return -28 + (5 * Math.log10(energyPct / 2.5)); // Escala para bandas pequenas
  }
}

// Ler e corrigir cada arquivo de gênero
const genres = ['funk_mandela', 'eletronico', 'funk_bruxaria', 'trance'];

for (const genre of genres) {
  const filePath = `./public/refs/out/${genre}.json`;
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Arquivo não encontrado: ${filePath}`);
    continue;
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const genreData = data[genre];
  
  if (!genreData) {
    console.log(`❌ Dados do gênero não encontrados: ${genre}`);
    continue;
  }
  
  // Encontrar bandas (pode estar em legacy_compatibility ou outra seção)
  let bandsLocation = null;
  let bandsData = null;
  
  if (genreData.legacy_compatibility?.bands) {
    bandsLocation = 'legacy_compatibility.bands';
    bandsData = genreData.legacy_compatibility.bands;
  }
  
  if (!bandsData) {
    console.log(`❌ Bandas não encontradas em: ${genre}`);
    continue;
  }
  
  console.log(`🎵 Corrigindo ${genre}:`);
  
  // Backup dos valores originais
  const originalValues = {};
  for (const [bandName, bandData] of Object.entries(bandsData)) {
    originalValues[bandName] = bandData.target_db;
  }
  
  // Aplicar correção
  for (const [bandName, bandData] of Object.entries(bandsData)) {
    const originalDb = bandData.target_db;
    const energyPct = bandData.energy_pct;
    const correctedDb = calculateRealisticDbFromEnergy(energyPct);
    
    // Arredondar para 1 casa decimal
    bandData.target_db = parseFloat(correctedDb.toFixed(1));
    
    console.log(`  ${bandName}: ${originalDb} dB → ${bandData.target_db} dB (energia: ${energyPct}%)`);
  }
  
  // Atualizar timestamp
  genreData.last_updated = new Date().toISOString();
  genreData.cache_bust = Date.now();
  
  // Adicionar metadados da correção
  if (!genreData.normalization_info) {
    genreData.normalization_info = {};
  }
  genreData.normalization_info.bands_corrected = true;
  genreData.normalization_info.correction_date = new Date().toISOString();
  genreData.normalization_info.correction_method = 'realistic_db_from_energy_pct';
  
  // Salvar arquivo corrigido
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`✅ ${genre} corrigido e salvo`);
}

console.log('\n🎯 CORREÇÃO CONCLUÍDA!');
console.log('Os valores agora são dB absolutos plausíveis para material normalizado a -18 LUFS.');
console.log('Faça hard refresh (Ctrl+Shift+R) na interface para ver os valores corrigidos.');
