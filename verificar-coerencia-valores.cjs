#!/usr/bin/env node

// Script para verificar se os valores precisam de conversão
const fs = require('fs');

console.log('🔍 VERIFICAÇÃO DE COERÊNCIA DOS VALORES\n');

// Ler dados funk_mandela
const funkMandela = JSON.parse(fs.readFileSync('./public/refs/out/funk_mandela.json', 'utf8'));
const bands = funkMandela.funk_mandela.legacy_compatibility.bands;

console.log('📊 VALORES ATUAIS DAS BANDAS:');
for (const [name, data] of Object.entries(bands)) {
  console.log(`- ${name}: ${data.target_db} dB (energia: ${data.energy_pct}%)`);
}

console.log('\n🧮 ANÁLISE DE COERÊNCIA:');

// Verificar se há uma relação matemática consistente
const energyPercentages = Object.values(bands).map(b => b.energy_pct);
const targetDbs = Object.values(bands).map(b => b.target_db);

const totalEnergyPct = energyPercentages.reduce((sum, val) => sum + val, 0);
console.log(`- Soma total de energia: ${totalEnergyPct.toFixed(2)}%`);

if (totalEnergyPct > 99 && totalEnergyPct < 101) {
  console.log('✅ Soma de energia coerente (~100%)');
} else {
  console.log('❌ Soma de energia incoerente');
}

// Verificar se values dB fazem sentido proporcionalmente
console.log('\n📈 ANÁLISE PROPORCIONAL:');
for (const [name, data] of Object.entries(bands)) {
  // Converter energia % para dB relativo (teoria)
  const expectedDb = 10 * Math.log10(data.energy_pct / 100);
  const actualDb = data.target_db;
  const difference = actualDb - expectedDb;
  
  console.log(`${name}:`);
  console.log(`  Energia: ${data.energy_pct}% → esperado: ${expectedDb.toFixed(1)} dB`);
  console.log(`  Atual: ${actualDb} dB → diferença: ${difference.toFixed(1)} dB`);
}

// Verificar se há um offset consistente
const differences = [];
for (const [name, data] of Object.entries(bands)) {
  const expectedDb = 10 * Math.log10(data.energy_pct / 100);
  const actualDb = data.target_db;
  differences.push(actualDb - expectedDb);
}

const avgDifference = differences.reduce((sum, val) => sum + val, 0) / differences.length;
console.log(`\n🎯 OFFSET MÉDIO: ${avgDifference.toFixed(1)} dB`);

if (Math.abs(avgDifference - differences[0]) < 2) {
  console.log('✅ Offset consistente - pode ser uma normalização válida');
} else {
  console.log('❌ Offset inconsistente - pode indicar erro matemático');
}

// Verificar se valores são plausíveis para material normalizado a -18 LUFS
console.log('\n💡 DIAGNÓSTICO FINAL:');
console.log('Para áudio normalizado a -18 LUFS:');
console.log('- Bandas espectrais tipicamente variam de -30 a -5 dB absolutos');
console.log('- Valores atuais (28, 27.5 dB) parecem estar em escala relativa');
console.log('- Isso pode ser correto SE a interface souber interpretar como relativos');

// Sugestão
console.log('\n💭 POSSÍVEL SOLUÇÃO:');
console.log('Os valores podem estar corretos, mas a interface pode precisar:');
console.log('1. Aplicar offset de referência para display');
console.log('2. Converter de escala relativa para absoluta');
console.log('3. Ou apenas mostrar como "relativos ao gênero" em vez de dB absolutos');
