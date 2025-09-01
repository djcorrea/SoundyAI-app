// Teste simples para verificar se funk_automotivo existe no sistema
console.log('=== Teste de Integração - Funk Automotivo ===\n');

// 1. Verificar se existe na pasta refs
import fs from 'fs';
import path from 'path';

const genreDir = 'refs/funk_automotivo/samples';
const genreJson = 'refs/out/funk_automotivo.json';

console.log('1. Verificando pasta de samples...');
if (fs.existsSync(genreDir)) {
  const files = fs.readdirSync(genreDir).filter(f => f.endsWith('.wav'));
  console.log(`✅ Pasta existe com ${files.length} arquivos WAV`);
  console.log(`   Exemplos: ${files.slice(0, 3).join(', ')}`);
} else {
  console.log('❌ Pasta de samples não encontrada');
}

console.log('\n2. Verificando JSON de referência...');
if (fs.existsSync(genreJson)) {
  const json = JSON.parse(fs.readFileSync(genreJson, 'utf8'));
  const funkData = json.funk_automotivo;
  console.log('✅ JSON existe com dados:');
  console.log(`   LUFS Target: ${funkData.lufs_target}`);
  console.log(`   True Peak Target: ${funkData.true_peak_target}`);
  console.log(`   Número de faixas: ${funkData.num_tracks}`);
  console.log(`   Bandas configuradas: ${Object.keys(funkData.bands).length}`);
} else {
  console.log('❌ JSON de referência não encontrado');
}

console.log('\n3. Verificando manifesto de gêneros...');
const manifestPath = 'refs/out/genres.json';
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const funkGenre = manifest.genres.find(g => g.key === 'funk_automotivo');
  if (funkGenre) {
    console.log('✅ Funk Automotivo registrado no manifesto');
    console.log(`   Label: ${funkGenre.label}`);
  } else {
    console.log('❌ Funk Automotivo não encontrado no manifesto');
  }
} else {
  console.log('❌ Manifesto de gêneros não encontrado');
}

console.log('\n=== Teste de Integração Concluído ===');
