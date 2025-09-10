/**
 * 🔍 DEBUG: Análise byte-por-byte dos chunks
 */

import fs from 'fs';

function hexDump(buffer, start, length) {
  const slice = buffer.slice(start, start + length);
  let result = '';
  for (let i = 0; i < slice.length; i++) {
    result += slice[i].toString(16).padStart(2, '0') + ' ';
    if ((i + 1) % 16 === 0) result += '\n';
  }
  return result;
}

function analyzeWavBytes() {
  const wav = fs.readFileSync('./tests/test-sine-48k.wav');
  console.log(`📦 Total: ${wav.length} bytes\n`);
  
  console.log('🔍 RIFF Header (0-11):');
  console.log(hexDump(wav, 0, 12));
  console.log(`RIFF: "${wav.toString('ascii', 0, 4)}"`);
  console.log(`Size: ${wav.readUInt32LE(4)} (hex: ${wav.readUInt32LE(4).toString(16)})`);
  console.log(`WAVE: "${wav.toString('ascii', 8, 12)}"\n`);
  
  console.log('🔍 fmt Chunk (12-31):');
  console.log(hexDump(wav, 12, 20));
  console.log(`ID: "${wav.toString('ascii', 12, 16)}"`);
  console.log(`Size: ${wav.readUInt32LE(16)} (hex: ${wav.readUInt32LE(16).toString(16)})`);
  console.log(`Audio Format: ${wav.readUInt16LE(20)}`);
  console.log(`Channels: ${wav.readUInt16LE(22)}\n`);
  
  console.log('🔍 Bytes ao redor do fmt size (14-18):');
  console.log(hexDump(wav, 14, 8));
  console.log(`Lendo como LE UInt32 no offset 16: ${wav.readUInt32LE(16)}`);
  console.log(`Lendo como BE UInt32 no offset 16: ${wav.readUInt32BE(16)}`);
  console.log(`Bytes individuais: [${Array.from(wav.slice(16, 20)).map(b => b.toString(16)).join(', ')}]\n`);
  
  // Vamos procurar manualmente o próximo chunk
  console.log('🔍 Procurando próximo chunk após fmt...');
  for (let i = 30; i < 100; i += 1) {
    const id = wav.toString('ascii', i, i + 4);
    if (['fact', 'LIST', 'data'].includes(id)) {
      console.log(`📦 Chunk "${id}" encontrado no offset ${i}`);
      console.log(`   Size: ${wav.readUInt32LE(i + 4)}`);
      console.log(`   Hex dump:`, hexDump(wav, i, 12));
    }
  }
}

analyzeWavBytes();
