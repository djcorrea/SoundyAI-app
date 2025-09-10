/**
 * 🔍 DEBUG: Análise detalhada de headers WAV
 */

import fs from 'fs';

function debugWavHeaders(filePath) {
  console.log(`\n🔍 Analisando: ${filePath}`);
  
  const wav = fs.readFileSync(filePath);
  console.log(`📦 Tamanho total: ${wav.length} bytes\n`);
  
  // Headers RIFF/WAVE
  const riff = wav.toString('ascii', 0, 4);
  const fileSize = wav.readUInt32LE(4);  // deve ser length - 8
  const wave = wav.toString('ascii', 8, 12);
  
  console.log(`📄 RIFF: "${riff}"`);
  console.log(`📏 File size declarado: ${fileSize} (real: ${wav.length - 8})`);
  console.log(`🌊 WAVE: "${wave}"\n`);
  
  // Procurar chunks
  let off = 12;
  let chunkCount = 0;
  
  while (off + 8 <= wav.length && chunkCount < 10) {
    const id = wav.toString('ascii', off, off + 4);
    const sz = wav.readUInt32LE(off + 4);
    const payloadStart = off + 8;
    const next = payloadStart + sz + (sz % 2);
    
    console.log(`📦 Chunk "${id}":`);
    console.log(`   Offset: ${off}`);
    console.log(`   Size: ${sz} bytes`);
    console.log(`   Payload: ${payloadStart} - ${payloadStart + sz - 1}`);
    console.log(`   Next chunk: ${next}\n`);
    
    if (id === 'fmt ') {
      const audioFormat = wav.readUInt16LE(payloadStart + 0);
      const numChannels = wav.readUInt16LE(payloadStart + 2);
      const sampleRate = wav.readUInt32LE(payloadStart + 4);
      const byteRate = wav.readUInt32LE(payloadStart + 8);
      const blockAlign = wav.readUInt16LE(payloadStart + 12);
      const bitsPerSample = wav.readUInt16LE(payloadStart + 14);
      
      console.log(`   🎵 Audio Format: ${audioFormat} (3=Float, 65534=Extensible)`);
      console.log(`   📢 Canais: ${numChannels}`);
      console.log(`   🔊 Sample Rate: ${sampleRate} Hz`);
      console.log(`   📊 Byte Rate: ${byteRate}`);
      console.log(`   🔀 Block Align: ${blockAlign}`);
      console.log(`   🎯 Bits/Sample: ${bitsPerSample}\n`);
    }
    
    if (id === 'data') {
      const bytesPerSample = 4; // Float32
      const numChannels = 2;    // Stereo
      const frameBytes = numChannels * bytesPerSample;
      const totalFrames = Math.floor(sz / frameBytes);
      
      console.log(`   🔢 Bytes por sample: ${bytesPerSample}`);
      console.log(`   📐 Frame bytes: ${frameBytes}`);
      console.log(`   🎬 Total frames: ${totalFrames}`);
      console.log(`   📏 Data size: ${sz} bytes`);
      console.log(`   🎯 Máximo offset: ${payloadStart + sz - 1}`);
      console.log(`   ⚠️ Último frame offset seria: ${payloadStart + (totalFrames - 1) * frameBytes}`);
      
      // Teste: será que o último frame cabe?
      const lastFrameStart = payloadStart + (totalFrames - 1) * frameBytes;
      const lastFrameEnd = lastFrameStart + frameBytes - 1;
      
      console.log(`   🔍 Último frame: ${lastFrameStart} - ${lastFrameEnd}`);
      console.log(`   ✅ Cabe no buffer? ${lastFrameEnd < wav.length ? 'SIM' : 'NÃO'}`);
      
      if (lastFrameEnd >= wav.length) {
        console.log(`   ❌ OVERFLOW! Último byte seria ${lastFrameEnd}, mas buffer tem apenas ${wav.length - 1}`);
      }
      
      break;
    }
    
    off = next;
    chunkCount++;
  }
}

// Teste com arquivo sine
try {
  debugWavHeaders('./tests/test-sine-48k.wav');
} catch (err) {
  console.error('❌ Erro:', err.message);
}
