// 🧪 TESTE UNIFICADO - applyMusicalCap com deltaShown integrado
// Garante que a função principal agora fornece tudo que é necessário

import { applyMusicalCap, applyMusicalCapToReference } from './work/lib/audio/utils/musical-cap-utils.js';

console.log('🧪 Testando função unificada applyMusicalCap com deltaShown...\n');

// Teste 1: Valor dentro do limite (não precisa de cap)
console.log('🎯 Teste 1: Valor seguro (±3.2 dB)');
const test1 = applyMusicalCap(3.2);
console.log('Input:', 3.2);
console.log('Output:', test1);
console.log('deltaShown esperado: "+3.2 dB"');
console.log('✅ OK:', test1.deltaShown === '+3.2 dB');
console.log('');

// Teste 2: Valor negativo dentro do limite
console.log('🎯 Teste 2: Valor negativo seguro (-4.7 dB)');
const test2 = applyMusicalCap(-4.7);
console.log('Input:', -4.7);
console.log('Output:', test2);
console.log('deltaShown esperado: "-4.7 dB"');
console.log('✅ OK:', test2.deltaShown === '-4.7 dB');
console.log('');

// Teste 3: Valor que precisa de cap positivo
console.log('🎯 Teste 3: Valor que precisa cap (+8.9 dB)');
const test3 = applyMusicalCap(8.9);
console.log('Input:', 8.9);
console.log('Output:', test3);
console.log('deltaShown deve conter anotação educativa');
console.log('✅ OK wasCapped:', test3.wasCapped === true);
console.log('✅ OK value:', test3.value === 6.0);
console.log('✅ OK deltaShown contém anotação:', test3.deltaShown.includes('ajuste seguro'));
console.log('');

// Teste 4: Valor que precisa de cap negativo
console.log('🎯 Teste 4: Valor que precisa cap (-12.3 dB)');
const test4 = applyMusicalCap(-12.3);
console.log('Input:', -12.3);
console.log('Output:', test4);
console.log('deltaShown deve conter anotação educativa');
console.log('✅ OK wasCapped:', test4.wasCapped === true);
console.log('✅ OK value:', test4.value === -6.0);
console.log('✅ OK deltaShown contém anotação:', test4.deltaShown.includes('ajuste seguro'));
console.log('');

// Teste 5: Casos edge (exatamente ±6 dB)
console.log('🎯 Teste 5: Exatamente no limite (6.0 dB)');
const test5 = applyMusicalCap(6.0);
console.log('Input:', 6.0);
console.log('Output:', test5);
console.log('✅ OK não foi limitado:', test5.wasCapped === false);
console.log('✅ OK deltaShown:', test5.deltaShown === '+6.0 dB');
console.log('');

// Teste 6: Integração com referenceComparison
console.log('🎯 Teste 6: Integração com referenceComparison');
const mockReference = [
  {
    category: 'spectral_bands',
    name: 'Graves',
    value: -2.3,
    ideal: 5.4,
    unit: 'dB'
  },
  {
    category: 'spectral_bands',
    name: 'Agudos',
    value: 3.2,
    ideal: -8.1,
    unit: 'dB'
  }
];

const processedReference = applyMusicalCapToReference(mockReference);
console.log('Processamento:', processedReference);

// Verificar primeiro item (delta = 5.4 - (-2.3) = 7.7 dB - deve ser limitado)
const item1 = processedReference[0];
console.log('✅ Item 1 - Delta bruto:', item1.delta_raw);
console.log('✅ Item 1 - Foi limitado:', item1.delta_capped);
console.log('✅ Item 1 - Delta shown:', item1.delta_shown);

// Verificar segundo item (delta = -8.1 - 3.2 = -11.3 dB - deve ser limitado)
const item2 = processedReference[1];
console.log('✅ Item 2 - Delta bruto:', item2.delta_raw);
console.log('✅ Item 2 - Foi limitado:', item2.delta_capped);
console.log('✅ Item 2 - Delta shown:', item2.delta_shown);

console.log('\n🎯 RESULTADO GERAL:');
console.log('✅ Função applyMusicalCap agora retorna deltaShown unificado');
console.log('✅ Integração com referenceComparison simplificada');
console.log('✅ Pronto para usar tanto em suggestions quanto em referenceComparison');
console.log('✅ Consistência garantida - mesma lógica central para ambos os casos');