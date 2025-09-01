#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Verificar valores reais de uma faixa específica do funk_mandela
async function debugValoresReais() {
  console.log('🔍 DEBUG: Verificando valores reais das faixas processadas...\n');
  
  // Ler arquivo de preview
  const previewPath = './public/refs/out/funk_mandela.preview.json';
  
  if (!fs.existsSync(previewPath)) {
    console.log('❌ Arquivo preview não encontrado:', previewPath);
    return;
  }
  
  const preview = JSON.parse(fs.readFileSync(previewPath, 'utf8'));
  console.log('📊 Dados do gênero funk_mandela:');
  console.log('- Número de faixas:', preview.funk_mandela.num_tracks);
  console.log('- Versão:', preview.funk_mandela.version);
  console.log('- Método de agregação:', preview.funk_mandela.aggregation_method);
  
  // Verificar valores finais (targets)
  const targets = preview.funk_mandela.flexible;
  console.log('\n🎯 TARGETS CALCULADOS:');
  console.log('- LUFS target:', targets.lufs_target, 'LUFS');
  console.log('- True Peak target:', targets.true_peak_target, 'dBTP');
  console.log('- DR target:', targets.dr_target, 'dB');
  
  console.log('\n🎵 BANDAS ESPECTRAIS:');
  const bands = targets.bands;
  for (const [bandName, data] of Object.entries(bands)) {
    console.log(`- ${bandName}: ${data.target_db} dB (energia: ${data.energy_pct}%)`);
  }
  
  // Verificar se existem faixas individuais processadas no preview
  console.log('\n📁 Verificando se há dados individuais das faixas...');
  
  // Tentar ler dados brutos de processamento
  const outDir = './public/refs/out';
  const files = fs.readdirSync(outDir).filter(f => f.includes('funk_mandela') && !f.includes('preview'));
  
  if (files.length > 0) {
    console.log('📄 Arquivos relacionados encontrados:', files);
    
    // Ler primeiro arquivo encontrado
    const firstFile = path.join(outDir, files[0]);
    if (fs.existsSync(firstFile)) {
      const data = JSON.parse(fs.readFileSync(firstFile, 'utf8'));
      console.log('\n🔍 Dados de exemplo de uma faixa:');
      console.log(JSON.stringify(data, null, 2).substring(0, 500) + '...');
    }
  }
  
  // Verificar REFs originais para comparação
  console.log('\n📚 Verificando REFs originais...');
  const refsPath = './public/refs/funk_mandela.json';
  if (fs.existsSync(refsPath)) {
    const originalRefs = JSON.parse(fs.readFileSync(refsPath, 'utf8'));
    console.log('- LUFS alvo original:', originalRefs.funk_mandela.flexible?.lufs_target);
    console.log('- True Peak alvo original:', originalRefs.funk_mandela.flexible?.true_peak_target);
    
    if (originalRefs.funk_mandela.flexible?.bands) {
      console.log('- Bandas originais (primeiras 3):');
      const bandEntries = Object.entries(originalRefs.funk_mandela.flexible.bands).slice(0, 3);
      for (const [name, data] of bandEntries) {
        console.log(`  ${name}: ${data.target_db} dB`);
      }
    }
  } else {
    console.log('❌ Arquivo de referências originais não encontrado');
  }
}

debugValoresReais().catch(console.error);
