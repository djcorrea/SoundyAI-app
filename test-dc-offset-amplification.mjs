/**
 * 🔍 TESTE: Verificar se removeDCOffset está amplificando
 */

import { removeDCOffset } from './work/lib/audio/error-handling.js';

function testRemoveDCOffset() {
  console.log('🔍 TESTE: removeDCOffset amplificação\n');
  
  // Criar sinal de teste simples: valores 0.8 (sem DC offset)
  const testSignal = new Float32Array(1000);
  testSignal.fill(0.8);
  
  console.log(`📊 Sinal original:`);
  console.log(`   Todos os valores: 0.8`);
  console.log(`   Max: 0.8`);
  
  // Aplicar removeDCOffset
  const processed = removeDCOffset(testSignal, 48000, 20);
  
  // Encontrar max no resultado
  let maxProcessed = 0;
  for (let i = 0; i < processed.length; i++) {
    const abs = Math.abs(processed[i]);
    if (abs > maxProcessed) maxProcessed = abs;
  }
  
  console.log(`\n📊 Sinal processado:`);
  console.log(`   Max Absolute: ${maxProcessed.toFixed(6)}`);
  console.log(`   Primeiros 10 valores:`);
  for (let i = 0; i < 10; i++) {
    console.log(`      [${i}]: ${processed[i].toFixed(6)}`);
  }
  
  if (maxProcessed > 1.0) {
    console.log(`\n❌ PROBLEMA: removeDCOffset AMPLIFICOU o sinal!`);
    console.log(`   Original: 0.8`);
    console.log(`   Processado: ${maxProcessed.toFixed(6)}`);
    console.log(`   Amplificação: ${(maxProcessed / 0.8).toFixed(2)}x`);
  } else {
    console.log(`\n✅ OK: removeDCOffset não amplificou`);
  }
}

testRemoveDCOffset();
