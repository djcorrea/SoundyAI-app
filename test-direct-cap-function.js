// 🔍 TESTE DIRETO - applyMusicalCapToReference funcionando
// Testa diretamente a função com dados simulados da interface

import { applyMusicalCapToReference } from './work/lib/audio/utils/musical-cap-utils.js';

console.log('🔍 TESTE DIRETO: Função applyMusicalCapToReference...\n');

// Dados similares aos da interface (valores que você está vendo)
const mockReferenceData = [
  // Valores LUFS (não devem ser capados)
  {
    metric: "Variação de Volume (consistência)",
    value: 13.27,
    ideal: 2.50,
    unit: "LU",
    status: "⚠️ AJUSTAR",
    category: "other"
  },
  
  // Bandas espectrais (devem ser capadas)
  {
    metric: "sub (20-60Hz)",
    value: -14.30,
    ideal: -17.30,
    unit: "dB",
    status: "✅ IDEAL",
    category: "spectral_bands"
  },
  {
    metric: "bass (60-150Hz)",
    value: -21.70,
    ideal: -17.70,
    unit: "dB",
    status: "⚠️ AJUSTAR",
    category: "spectral_bands"
  },
  {
    metric: "low-mid (150-500Hz)",
    value: -26.20,
    ideal: -18.70,
    unit: "dB",
    status: "❌ CORRIGIR",
    category: "spectral_bands"
  },
  {
    metric: "mid (500-2kHz)",
    value: -31.20,
    ideal: -17.90,
    unit: "dB",
    status: "❌ CORRIGIR", 
    category: "spectral_bands"
  },
  {
    metric: "high-mid (2-5kHz)",
    value: -35.40,
    ideal: -22.90,
    unit: "dB",
    status: "❌ CORRIGIR",
    category: "spectral_bands"
  },
  {
    metric: "air (10-20kHz)",
    value: -45.70,
    ideal: -29.30,
    unit: "dB",
    status: "❌ CORRIGIR",
    category: "spectral_bands"
  },
  {
    metric: "presence (5-10kHz)",
    value: -39.00,
    ideal: -34.00,
    unit: "dB",
    status: "⚠️ AJUSTAR",
    category: "spectral_bands"
  }
];

console.log('📊 DADOS ORIGINAIS:');
console.log('─'.repeat(70));
mockReferenceData.forEach((item, i) => {
  if (item.category === 'spectral_bands') {
    const deltaOriginal = item.ideal - item.value;
    console.log(`${i + 1}. ${item.metric}: ${deltaOriginal.toFixed(1)} dB (original)`);
  }
});

console.log('\n🎯 APLICANDO CAPS...');
const processedData = applyMusicalCapToReference(mockReferenceData);

console.log('\n📊 DADOS PROCESSADOS:');
console.log('─'.repeat(70));

processedData.forEach((item, i) => {
  console.log(`${i + 1}. ${item.metric}:`);
  
  if (item.category === 'spectral_bands') {
    console.log(`   📈 Delta bruto: ${item.delta_real?.toFixed(1) || 'N/A'} dB`);
    console.log(`   ✅ Delta exibido: ${item.delta_shown?.toFixed(1) || 'N/A'} dB`);
    console.log(`   🚩 Foi capado: ${item.delta_capped ? 'SIM' : 'NÃO'}`);
    if (item.note) {
      console.log(`   📝 Nota: ${item.note}`);
    }
  } else {
    console.log(`   🔹 Categoria: ${item.category} (sem cap)`);
  }
  console.log('');
});

// Verificação crítica
console.log('🔍 VERIFICAÇÃO CRÍTICA:');
console.log('─'.repeat(70));

const spectralItems = processedData.filter(item => item.category === 'spectral_bands');
const hasExceedingValues = spectralItems.some(item => Math.abs(item.delta_shown || 0) > 6);

console.log(`Total de bandas espectrais: ${spectralItems.length}`);
console.log(`Algum valor excede ±6 dB: ${hasExceedingValues ? '❌ SIM' : '✅ NÃO'}`);

if (hasExceedingValues) {
  console.log('\n❌ VALORES PROBLEMÁTICOS:');
  spectralItems.forEach(item => {
    if (Math.abs(item.delta_shown || 0) > 6) {
      console.log(`   - ${item.metric}: ${item.delta_shown.toFixed(1)} dB`);
    }
  });
} else {
  console.log('\n✅ TODOS OS VALORES ESTÃO DENTRO DO LIMITE ±6 dB');
}

console.log('\n🎯 CONCLUSÃO:');
console.log('─'.repeat(70));
if (hasExceedingValues) {
  console.log('❌ A função NÃO está funcionando corretamente');
  console.log('   Ainda há valores > ±6 dB sendo retornados');
} else {
  console.log('✅ A função ESTÁ funcionando corretamente no backend');
  console.log('   Problema está no frontend ou na conexão entre eles');
  console.log('');
  console.log('🔧 POSSÍVEIS CAUSAS:');
  console.log('   1. Frontend está usando campo errado (delta_real vs delta_shown)');
  console.log('   2. Cache do browser precisa ser limpo');
  console.log('   3. Frontend não está recebendo dados atualizados');
  console.log('   4. As bandas espectrais não estão sendo processadas no pipeline real');
}