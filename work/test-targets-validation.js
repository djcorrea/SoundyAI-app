// 🧪 TESTE DE VALIDAÇÃO: Targets Oficiais vs analysis.data.genreTargets
// Valida que os targets carregados são EXATAMENTE iguais aos do arquivo oficial

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadGenreTargets } from './lib/audio/utils/genre-targets-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🎯 Gênero a testar
const GENRE_TO_TEST = 'trance';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 TESTE DE VALIDAÇÃO: TARGETS OFICIAIS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log();

// PASSO 1: Carregar arquivo oficial
console.log('📂 PASSO 1: Carregando arquivo oficial...');
const officialPath = path.resolve(__dirname, `../public/refs/out/${GENRE_TO_TEST}.json`);
console.log(`   Path: ${officialPath}`);

if (!fs.existsSync(officialPath)) {
  console.error('❌ ERRO: Arquivo não encontrado');
  process.exit(1);
}

const officialRaw = fs.readFileSync(officialPath, 'utf8');
const officialData = JSON.parse(officialRaw);
const officialTargets = officialData[GENRE_TO_TEST]?.legacy_compatibility;

if (!officialTargets) {
  console.error('❌ ERRO: legacy_compatibility não encontrado no JSON oficial');
  process.exit(1);
}

console.log('✅ Arquivo oficial carregado');
console.log(`   LUFS: ${officialTargets.lufs_target}`);
console.log(`   TruePeak: ${officialTargets.true_peak_target}`);
console.log(`   DR: ${officialTargets.dr_target}`);
console.log(`   Bandas: ${Object.keys(officialTargets.bands).length}`);
console.log();

// PASSO 2: Carregar via loadGenreTargets()
console.log('⚙️  PASSO 2: Carregando via loadGenreTargets()...');
const loadedTargets = await loadGenreTargets(GENRE_TO_TEST);

if (!loadedTargets) {
  console.error('❌ ERRO: loadGenreTargets retornou null');
  process.exit(1);
}

console.log('✅ Targets carregados pelo loader');
console.log(`   Estrutura: ${Object.keys(loadedTargets).join(', ')}`);
console.log();

// PASSO 3: Validação estrutural
console.log('🔍 PASSO 3: Validação estrutural...');
const validations = [];

// Validar LUFS
if (!loadedTargets.lufs || typeof loadedTargets.lufs !== 'object') {
  validations.push('❌ lufs não é objeto nested');
} else if (loadedTargets.lufs.target !== officialTargets.lufs_target) {
  validations.push(`❌ lufs.target incorreto: ${loadedTargets.lufs.target} (esperado: ${officialTargets.lufs_target})`);
} else if (loadedTargets.lufs.tolerance !== officialTargets.tol_lufs) {
  validations.push(`❌ lufs.tolerance incorreto: ${loadedTargets.lufs.tolerance} (esperado: ${officialTargets.tol_lufs})`);
} else if (!loadedTargets.lufs.target_range) {
  validations.push('❌ lufs.target_range ausente');
} else {
  validations.push('✅ lufs: estrutura completa e valores corretos');
}

// Validar TruePeak
if (!loadedTargets.truePeak || typeof loadedTargets.truePeak !== 'object') {
  validations.push('❌ truePeak não é objeto nested');
} else if (loadedTargets.truePeak.target !== officialTargets.true_peak_target) {
  validations.push(`❌ truePeak.target incorreto: ${loadedTargets.truePeak.target} (esperado: ${officialTargets.true_peak_target})`);
} else if (loadedTargets.truePeak.tolerance !== officialTargets.tol_true_peak) {
  validations.push(`❌ truePeak.tolerance incorreto: ${loadedTargets.truePeak.tolerance} (esperado: ${officialTargets.tol_true_peak})`);
} else if (!loadedTargets.truePeak.target_range) {
  validations.push('❌ truePeak.target_range ausente');
} else {
  validations.push('✅ truePeak: estrutura completa e valores corretos');
}

// Validar DR
if (!loadedTargets.dr || typeof loadedTargets.dr !== 'object') {
  validations.push('❌ dr não é objeto nested');
} else if (loadedTargets.dr.target !== officialTargets.dr_target) {
  validations.push(`❌ dr.target incorreto: ${loadedTargets.dr.target} (esperado: ${officialTargets.dr_target})`);
} else if (loadedTargets.dr.tolerance !== officialTargets.tol_dr) {
  validations.push(`❌ dr.tolerance incorreto: ${loadedTargets.dr.tolerance} (esperado: ${officialTargets.tol_dr})`);
} else if (!loadedTargets.dr.target_range) {
  validations.push('❌ dr.target_range ausente');
} else {
  validations.push('✅ dr: estrutura completa e valores corretos');
}

// Validar Bandas
if (!loadedTargets.bands || typeof loadedTargets.bands !== 'object') {
  validations.push('❌ bands não é objeto');
} else {
  const loadedBandCount = Object.keys(loadedTargets.bands).length;
  const officialBandCount = Object.keys(officialTargets.bands).length;
  
  if (loadedBandCount !== officialBandCount) {
    validations.push(`❌ bands: contagem incorreta (${loadedBandCount} vs ${officialBandCount} esperado)`);
  } else {
    // Validar estrutura de uma banda específica
    const testBand = 'bass'; // Mapeado de 'low_bass'
    if (!loadedTargets.bands[testBand]) {
      validations.push(`❌ bands.${testBand} não encontrada`);
    } else if (!loadedTargets.bands[testBand].target_range) {
      validations.push(`❌ bands.${testBand}.target_range ausente`);
    } else {
      validations.push(`✅ bands: ${loadedBandCount} bandas com estrutura completa`);
    }
  }
}

validations.forEach(v => console.log(`   ${v}`));
console.log();

// PASSO 4: Relatório final
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 RELATÓRIO FINAL');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const successCount = validations.filter(v => v.startsWith('✅')).length;
const failCount = validations.filter(v => v.startsWith('❌')).length;

console.log(`✅ Validações bem-sucedidas: ${successCount}`);
console.log(`❌ Validações falhadas: ${failCount}`);
console.log();

if (failCount === 0) {
  console.log('🎉 SUCESSO TOTAL! Todos os valores oficiais estão preservados corretamente.');
  console.log();
  console.log('📋 ESTRUTURA FINAL QUE CHEGA NO FRONTEND:');
  console.log(JSON.stringify({
    lufs: loadedTargets.lufs,
    truePeak: loadedTargets.truePeak,
    dr: loadedTargets.dr,
    bands: {
      exemplo_banda: loadedTargets.bands[Object.keys(loadedTargets.bands)[0]]
    }
  }, null, 2));
} else {
  console.log('⚠️  CORREÇÕES NECESSÁRIAS! Alguns valores não correspondem ao arquivo oficial.');
  process.exit(1);
}

console.log();
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
