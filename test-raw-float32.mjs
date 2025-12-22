/**
 * 🔍 TESTE RAW: Ler WAV Float32 convertido pelo FFmpeg diretamente
 */

import { readFile } from 'fs/promises';

async function testRawFloat32() {
  console.log('🔍 TESTE RAW: Leitura direta de Float32\n');
  
  try {
    const wavPath = 'C:\\SET - DESANDE AUTOMOTIVO\\test_48k.wav';
    const wav = await readFile(wavPath);
    
    console.log(`📁 Arquivo: ${wavPath}`);
    console.log(`📊 Tamanho: ${wav.length} bytes`);
    
    // Parse WAV header
    const riff = wav.toString('ascii', 0, 4);
    const wave = wav.toString('ascii', 8, 12);
    
    console.log(`\n📋 Headers:`);
    console.log(`   RIFF: ${riff}`);
    console.log(`   WAVE: ${wave}`);
    
    // Encontrar chunk fmt
    let off = 12;
    while (off + 8 <= wav.length) {
      const id = wav.toString('ascii', off, off + 4);
      const sz = wav.readUInt32LE(off + 4);
      
      if (id === 'fmt ') {
        const fmtOffset = off + 8;
        const audioFormat = wav.readUInt16LE(fmtOffset + 0);
        const numChannels = wav.readUInt16LE(fmtOffset + 2);
        const sampleRate = wav.readUInt32LE(fmtOffset + 4);
        const bitsPerSample = wav.readUInt16LE(fmtOffset + 14);
        
        console.log(`\n📊 Formato:`);
        console.log(`   Audio Format: ${audioFormat} ${audioFormat === 3 ? '(Float)' : audioFormat === 1 ? '(PCM Integer)' : '(Unknown)'}`);
        console.log(`   Channels: ${numChannels}`);
        console.log(`   Sample Rate: ${sampleRate} Hz`);
        console.log(`   Bits Per Sample: ${bitsPerSample}`);
      }
      
      if (id === 'data') {
        const dataOffset = off + 8;
        console.log(`\n📊 Data Chunk:`);
        console.log(`   Offset: ${dataOffset}`);
        console.log(`   Size: ${sz} bytes`);
        
        // Ler primeiros 10 samples
        console.log(`\n📊 Primeiros 10 samples (Float32 LE):`);
        
        for (let i = 0; i < 10; i++) {
          const ptr = dataOffset + i * 8; // 2 canais * 4 bytes
          const left = wav.readFloatLE(ptr);
          const right = wav.readFloatLE(ptr + 4);
          
          console.log(`   Sample ${i}: L=${left.toFixed(6)}, R=${right.toFixed(6)}`);
        }
        
        // Encontrar max absolute
        let maxAbsolute = 0;
        const numSamples = Math.floor(sz / 8);
        
        for (let i = 0; i < Math.min(numSamples, 10000); i++) {
          const ptr = dataOffset + i * 8;
          const left = Math.abs(wav.readFloatLE(ptr));
          const right = Math.abs(wav.readFloatLE(ptr + 4));
          
          if (left > maxAbsolute) maxAbsolute = left;
          if (right > maxAbsolute) maxAbsolute = right;
        }
        
        const maxDb = maxAbsolute > 0 ? 20 * Math.log10(maxAbsolute) : -120;
        
        console.log(`\n📊 Análise (primeiros 10000 samples):`);
        console.log(`   Max Absolute: ${maxAbsolute.toFixed(6)}`);
        console.log(`   Max dB: ${maxDb.toFixed(2)} dBFS`);
        
        if (maxAbsolute > 1.0) {
          console.log(`   ❌ ERRO: Valores > 1.0 (não normalizado!)`);
        } else {
          console.log(`   ✅ OK: Valores dentro de [-1, 1]`);
        }
        
        break;
      }
      
      off += 8 + sz + (sz % 2);
    }
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
  }
}

testRawFloat32().catch(console.error);
