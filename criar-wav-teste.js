// criar-wav-teste.js - Criar arquivo WAV válido para teste

import fs from 'fs';

const sampleRate = 48000;
const duration = 0.5; // 0.5 segundos
const frequency = 1000; // 1kHz
const samples = Math.floor(sampleRate * duration);

console.log(`Criando WAV: ${sampleRate}Hz, ${duration}s, ${frequency}Hz tone`);

// Calcular tamanhos
const dataSize = samples * 4; // 2 canais * 2 bytes por sample
const fileSize = 36 + dataSize;

// Criar buffer
const buffer = Buffer.alloc(44 + dataSize);
let pos = 0;

// RIFF header
buffer.write('RIFF', pos); pos += 4;
buffer.writeUInt32LE(fileSize, pos); pos += 4;
buffer.write('WAVE', pos); pos += 4;

// fmt chunk
buffer.write('fmt ', pos); pos += 4;
buffer.writeUInt32LE(16, pos); pos += 4; // chunk size
buffer.writeUInt16LE(1, pos); pos += 2;  // audio format (PCM)
buffer.writeUInt16LE(2, pos); pos += 2;  // num channels (stereo)
buffer.writeUInt32LE(sampleRate, pos); pos += 4; // sample rate
buffer.writeUInt32LE(sampleRate * 4, pos); pos += 4; // byte rate
buffer.writeUInt16LE(4, pos); pos += 2;  // block align
buffer.writeUInt16LE(16, pos); pos += 2; // bits per sample

// data chunk header
buffer.write('data', pos); pos += 4;
buffer.writeUInt32LE(dataSize, pos); pos += 4;

// Audio data - tom de 1kHz
for (let i = 0; i < samples; i++) {
  const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 16383;
  const sampleInt = Math.round(sample);
  
  // Escrever para ambos os canais (stereo)
  buffer.writeInt16LE(sampleInt, pos);     // canal esquerdo
  buffer.writeInt16LE(sampleInt, pos + 2); // canal direito
  pos += 4;
}

// Salvar arquivo
fs.writeFileSync('test-upload.wav', buffer);
console.log(`✅ WAV criado: test-upload.wav (${(buffer.length / 1024).toFixed(1)}KB)`);
console.log(`📊 Conteúdo: ${samples} samples, ${duration}s, ${frequency}Hz tone`);