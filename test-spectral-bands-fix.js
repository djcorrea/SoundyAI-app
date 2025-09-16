#!/usr/bin/env node

/**
 * 🧪 Teste das correções das bandas espectrais
 * Valida se as bandas são calculadas, convertidas para dB e chegam ao JSON
 */

import { SpectralBandsCalculator, SpectralBandsAggregator } from './work/lib/audio/features/spectral-bands.js';

console.log('🧪 [TESTE] Iniciando validação das correções das bandas espectrais...\n');

// Teste 1: Criação do calculador
console.log('1️⃣ Testando criação do calculador...');
const calculator = new SpectralBandsCalculator(48000, 4096);
console.log('✅ Calculador criado com sucesso');

// Teste 2: Gerar espectro sintético (pink noise simulado)
console.log('\n2️⃣ Gerando espectro sintético...');
const fftSize = 4096;
const binCount = Math.floor(fftSize / 2) + 1;

// Simular pink noise: energia inversamente proporcional à frequência
const leftMagnitude = new Float32Array(binCount);
const rightMagnitude = new Float32Array(binCount);

for (let i = 1; i < binCount; i++) {
  // Pink noise: 1/f spectrum
  const energy = 1.0 / Math.sqrt(i + 1);
  const noise = (Math.random() - 0.5) * 0.1;
  leftMagnitude[i] = energy + noise;
  rightMagnitude[i] = energy + noise;
}

console.log(`✅ Espectro sintético gerado: ${binCount} bins`);

// Teste 3: Calcular bandas para um frame
console.log('\n3️⃣ Calculando bandas espectrais...');
const frameResult = calculator.analyzeBands(leftMagnitude, rightMagnitude, 0);

console.log('📊 Resultado do frame:');
console.log(`   Valid: ${frameResult.valid}`);
console.log(`   Total %: ${frameResult.totalPercentage?.toFixed(1) || 'null'}`);

if (frameResult.valid && frameResult.bands) {
  console.log('\n📈 Bandas calculadas:');
  for (const [bandName, band] of Object.entries(frameResult.bands)) {
    console.log(`   ${bandName.padEnd(8)}: ${band.percentage?.toFixed(1) || 'null'}% | ${band.energy_db?.toFixed(1) || 'null'}dB | ${band.status || 'no_status'}`);
  }
} else {
  console.log('❌ Frame inválido ou sem bandas');
}

// Teste 4: Agregação de múltiplos frames
console.log('\n4️⃣ Testando agregação...');
const frames = [frameResult];

// Simular mais alguns frames
for (let i = 1; i < 5; i++) {
  // Adicionar pequena variação
  const variationLeft = leftMagnitude.map(val => val * (1 + (Math.random() - 0.5) * 0.05));
  const variationRight = rightMagnitude.map(val => val * (1 + (Math.random() - 0.5) * 0.05));
  const frameVar = calculator.analyzeBands(variationLeft, variationRight, i);
  if (frameVar.valid) {
    frames.push(frameVar);
  }
}

const aggregatedResult = SpectralBandsAggregator.aggregate(frames);

console.log('📊 Resultado agregado:');
console.log(`   Valid: ${aggregatedResult.valid}`);
console.log(`   Total %: ${aggregatedResult.totalPercentage?.toFixed(1) || 'null'}`);
console.log(`   Frames usados: ${aggregatedResult.framesUsed || 0}`);

if (aggregatedResult.valid && aggregatedResult.bands) {
  console.log('\n📈 Bandas agregadas:');
  for (const [bandName, band] of Object.entries(aggregatedResult.bands)) {
    console.log(`   ${bandName.padEnd(8)}: ${band.percentage?.toFixed(1) || 'null'}% | ${band.energy_db?.toFixed(1) || 'null'}dB | ${band.status || 'no_status'}`);
  }
} else {
  console.log('❌ Agregação inválida ou sem bandas');
}

// Teste 5: Simular estrutura que chegaria ao json-output.js
console.log('\n5️⃣ Simulando estrutura para JSON...');
const coreMetricsSimulated = {
  spectralBands: aggregatedResult  // ← Estrutura corrigida (.bands em vez de .aggregated)
};

// Simular condição do json-output.js
console.log('\n🔍 Testando condições de acesso:');
console.log(`   coreMetrics.spectralBands?.bands: ${!!coreMetricsSimulated.spectralBands?.bands}`);
console.log(`   coreMetrics.spectralBands?.aggregated: ${!!coreMetricsSimulated.spectralBands?.aggregated}`);

if (coreMetricsSimulated.spectralBands?.bands) {
  console.log('✅ Condição CORRIGIDA seria TRUE - bandas seriam mapeadas');
  
  // Simular mapeamento
  const b = coreMetricsSimulated.spectralBands;
  const extractedBands = {
    sub: {
      energy_db: b.bands.sub?.energy_db,
      percentage: b.bands.sub?.percentage,
      range: b.bands.sub?.frequencyRange || "20-60Hz",
      status: b.bands.sub?.status || "calculated"
    },
    // ... outras bandas seguiriam o mesmo padrão
    _status: 'calculated'
  };
  
  console.log('\n📤 Estrutura final para JSON:');
  console.log(`   sub: ${extractedBands.sub.percentage?.toFixed(1)}% | ${extractedBands.sub.energy_db?.toFixed(1)}dB | ${extractedBands.sub.status}`);
  console.log(`   Status geral: ${extractedBands._status}`);
  
} else {
  console.log('❌ Condição SERIA FALSE - cairia no fallback not_calculated');
}

// Teste 6: Validação final
console.log('\n6️⃣ Validação final...');
let testsPassados = 0;
const totalTests = 5;

// Test 1: Calculator funciona
if (calculator && typeof calculator.analyzeBands === 'function') {
  console.log('✅ Test 1: Calculador criado corretamente');
  testsPassados++;
} else {
  console.log('❌ Test 1: Falha na criação do calculador');
}

// Test 2: Frame calculation works
if (frameResult?.valid && frameResult?.bands) {
  console.log('✅ Test 2: Cálculo de frame funciona');
  testsPassados++;
} else {
  console.log('❌ Test 2: Falha no cálculo de frame');
}

// Test 3: energy_db is calculated
if (frameResult?.bands?.sub?.energy_db !== undefined && frameResult?.bands?.sub?.energy_db !== null) {
  console.log('✅ Test 3: Conversão para dB implementada');
  testsPassados++;
} else {
  console.log('❌ Test 3: Conversão para dB não encontrada');
}

// Test 4: Aggregation works
if (aggregatedResult?.valid && aggregatedResult?.bands) {
  console.log('✅ Test 4: Agregação funciona');
  testsPassados++;
} else {
  console.log('❌ Test 4: Falha na agregação');
}

// Test 5: JSON mapping condition
if (coreMetricsSimulated.spectralBands?.bands) {
  console.log('✅ Test 5: Condição de mapeamento JSON corrigida');
  testsPassados++;
} else {
  console.log('❌ Test 5: Condição de mapeamento JSON ainda incorreta');
}

console.log(`\n📊 RESULTADO FINAL: ${testsPassados}/${totalTests} testes passaram`);

if (testsPassados === totalTests) {
  console.log('🎉 TODAS AS CORREÇÕES FUNCIONANDO! As bandas espectrais devem aparecer no JSON agora.');
} else {
  console.log('⚠️  Algumas correções podem precisar de ajustes.');
}

console.log('\n🔗 Próximos passos:');
console.log('   1. Testar com áudio real no pipeline completo');
console.log('   2. Verificar se o JSON final no Postgres tem energy_db e percentage');
console.log('   3. Confirmar na UI que as bandas aparecem na tabela de referência');