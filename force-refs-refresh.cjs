#!/usr/bin/env node

// Script para forçar refresh das referências na interface
const fs = require('fs');
const path = require('path');

console.log('🔄 Forçando refresh das referências...\n');

// 1. Atualizar timestamp nos arquivos JSON
const refsDir = './public/refs/out';
const files = fs.readdirSync(refsDir).filter(f => f.endsWith('.json') && !f.includes('backup') && !f.includes('preview'));

console.log('📁 Arquivos de referência encontrados:', files.length);

for (const file of files) {
  const filePath = path.join(refsDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // Encontrar a chave principal (nome do gênero)
  const genreKey = Object.keys(data)[0];
  if (data[genreKey]) {
    // Atualizar timestamp para forçar reload
    data[genreKey].last_updated = new Date().toISOString();
    data[genreKey].cache_bust = Date.now();
    
    // Escrever de volta
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`✅ Atualizado: ${file}`);
  }
}

// 2. Atualizar cache-bust global
const cacheBustPath = './cache-bust.txt';
const timestamp = Date.now();
fs.writeFileSync(cacheBustPath, `refs-updated-${timestamp}\n`);
console.log(`🔄 Cache bust atualizado: ${timestamp}`);

// 3. Verificar os novos valores nas bandas espectrais
console.log('\n🎯 VERIFICAÇÃO DOS VALORES CORRIGIDOS:');
const funkMandela = JSON.parse(fs.readFileSync('./public/refs/out/funk_mandela.json', 'utf8'));
const bands = funkMandela.funk_mandela.flexible.bands;

console.log('📊 Bandas espectrais do funk_mandela (valores corrigidos):');
for (const [bandName, data] of Object.entries(bands)) {
  console.log(`- ${bandName}: ${data.target_db} dB (energia: ${data.energy_pct}%)`);
}

console.log('\n✅ Refresh concluído! A interface deve agora mostrar os valores corrigidos.');
console.log('💡 Se os valores ainda não atualizaram, faça hard refresh (Ctrl+Shift+R) na interface.');
