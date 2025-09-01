#!/usr/bin/env node

// Análise detalhada dos valores das bandas espectrais
const fs = require('fs');

console.log('🔍 ANÁLISE DETALHADA DOS VALORES DAS BANDAS\n');

// Ler dados atuais
const funkMandela = JSON.parse(fs.readFileSync('./public/refs/out/funk_mandela.json', 'utf8'));

// Encontrar onde estão os dados das bandas
console.log('📊 Estrutura do arquivo funk_mandela.json:');
console.log('- Chaves principais:', Object.keys(funkMandela));

if (funkMandela.funk_mandela) {
  console.log('- Chaves em funk_mandela:', Object.keys(funkMandela.funk_mandela));
  
  // Procurar por bandas em diferentes locais
  const data = funkMandela.funk_mandela;
  
  if (data.bands) {
    console.log('\n🎵 BANDAS ENCONTRADAS EM ROOT:');
    showBands(data.bands);
  }
  
  if (data.flexible && data.flexible.bands) {
    console.log('\n🎵 BANDAS ENCONTRADAS EM FLEXIBLE:');
    showBands(data.flexible.bands);
  }
  
  // Procurar por legacy_compatibility
  if (data.legacy_compatibility) {
    console.log('\n📜 LEGACY_COMPATIBILITY:');
    const legacy = data.legacy_compatibility;
    console.log('- LUFS target:', legacy.lufs_target);
    console.log('- True Peak target:', legacy.true_peak_target);
    console.log('- DR target:', legacy.dr_target);
  }
  
  // Procurar outras seções com bandas
  console.log('\n🔍 Procurando por outras seções com dados espectrais...');
  searchForBands(data, '', 0);
}

function showBands(bands) {
  for (const [name, data] of Object.entries(bands)) {
    console.log(`  ${name}: ${data.target_db} dB (energia: ${data.energy_pct}%)`);
  }
}

function searchForBands(obj, path, depth) {
  if (depth > 3) return; // Evitar recursão infinita
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    if (typeof value === 'object' && value !== null) {
      if (key === 'bands' && value.sub) {
        console.log(`  📍 Bandas encontradas em: ${currentPath}`);
        showBands(value);
      } else if (!Array.isArray(value)) {
        searchForBands(value, currentPath, depth + 1);
      }
    }
  }
}

// Verificar também os valores originais vs processados
console.log('\n🔄 VERIFICAÇÃO DE CONVERSÃO:');
console.log('Para áudio normalizado a -18 LUFS, espero bandas entre -30 a -5 dB absolutos');
console.log('Valores atuais parecem estar em escala diferente...\n');

// Verificar se há algum fator de conversão ou offset
console.log('💡 DIAGNÓSTICO:');
console.log('Se os valores mostram 27.5 dB mas deveriam ser ~-12 dB:');
console.log('- Diferença: ~40 dB');
console.log('- Possível offset ou erro de referência');
console.log('- Pode ser que precisa converter de energia % para dB correto');
