// 🧪 TESTE SIMPLES - Métricas Espectrais

import { SpectralMetricsCalculator } from './work/lib/audio/features/spectral-metrics.js';

console.log('🧪 Teste simples das métricas espectrais...\n');

// Configurações
const sampleRate = 48000;
const fftSize = 4096;
const calculator = new SpectralMetricsCalculator(sampleRate, fftSize);

// Teste 1: Sinal senoidal 1kHz
console.log('🔬 Teste 1: Sinal senoidal 1kHz');
const magnitude1k = new Float32Array(Math.floor(fftSize / 2) + 1);
const frequencyResolution = sampleRate / fftSize;
const bin1k = Math.round(1000 / frequencyResolution);
magnitude1k[bin1k] = 1.0;

const result1k = calculator.calculateAllMetrics(magnitude1k);
console.log('Resultado:', JSON.stringify(result1k, null, 2));

// Teste 2: Silêncio
console.log('\n🔬 Teste 2: Silêncio');
const silenceMag = new Float32Array(Math.floor(fftSize / 2) + 1);
const resultSilence = calculator.calculateAllMetrics(silenceMag);
console.log('Resultado:', JSON.stringify(resultSilence, null, 2));

// Teste 3: Ruído branco
console.log('\n🔬 Teste 3: Ruído branco');
const whiteMag = new Float32Array(Math.floor(fftSize / 2) + 1);
for (let i = 1; i < whiteMag.length; i++) {
  whiteMag[i] = 1.0;
}
const resultWhite = calculator.calculateAllMetrics(whiteMag);
console.log('Resultado:', JSON.stringify(resultWhite, null, 2));

console.log('\n✅ Testes concluídos!');