#!/usr/bin/env node

// Script robusto para forçar refresh das referências
const fs = require('fs');
const path = require('path');

console.log('🔄 Forçando refresh das referências...\n');

// 1. Verificar e corrigir arquivos JSON
const refsDir = './public/refs/out';
const files = fs.readdirSync(refsDir).filter(f => f.endsWith('.json') && !f.includes('backup') && !f.includes('preview'));

console.log('📁 Verificando arquivos de referência:', files.length);

for (const file of files) {
  const filePath = path.join(refsDir, file);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
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
  } catch (error) {
    console.log(`❌ Erro em ${file}: ${error.message}`);
    console.log(`   Pulando arquivo corrompido...`);
  }
}

// 2. Verificar especificamente o funk_mandela
console.log('\n🎯 VERIFICAÇÃO DOS VALORES CORRIGIDOS:');
try {
  const funkMandela = JSON.parse(fs.readFileSync('./public/refs/out/funk_mandela.json', 'utf8'));
  const bands = funkMandela.funk_mandela.flexible.bands;

  console.log('📊 Bandas espectrais do funk_mandela (valores corrigidos):');
  for (const [bandName, data] of Object.entries(bands)) {
    console.log(`- ${bandName}: ${data.target_db} dB (energia: ${data.energy_pct}%)`);
  }
} catch (error) {
  console.log('❌ Erro ao ler funk_mandela.json:', error.message);
}

// 3. Atualizar cache-bust global
const cacheBustPath = './cache-bust.txt';
const timestamp = Date.now();
fs.writeFileSync(cacheBustPath, `refs-updated-${timestamp}\n`);
console.log(`\n🔄 Cache bust atualizado: ${timestamp}`);

console.log('\n✅ Refresh concluído! A interface deve agora mostrar os valores corrigidos.');
console.log('💡 Se os valores ainda não atualizaram, faça hard refresh (Ctrl+Shift+R) na interface.');
