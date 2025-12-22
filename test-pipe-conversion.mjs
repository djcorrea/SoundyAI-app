/**
 * 🔍 TESTE: Conversão via pipe stdin (como no código real)
 */

import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import ffmpegStatic from 'ffmpeg-static';

const FFMPEG_PATH = ffmpegStatic || 'ffmpeg';

async function testPipeConversion() {
  console.log('🔍 TESTE: Conversão via pipe stdin\n');
  
  try {
    // Ler arquivo original
    const filePath = 'C:\\SET - DESANDE AUTOMOTIVO\\35 SOCA SOCA EXTENDED.wav';
    const inputBuffer = await readFile(filePath);
    
    console.log(`📁 Input: ${inputBuffer.length} bytes`);
    
    // Converter via pipe (como no código real)
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-nostdin',
      '-i', 'pipe:0',
      '-vn',
      '-ar', '48000',
      '-ac', '2',
      '-c:a', 'pcm_f32le',
      '-f', 'wav',
      'pipe:1'
    ];
    
    console.log(`\n🔧 Executando FFmpeg com args:`);
    console.log(`   ${args.join(' ')}`);
    
    const ff = spawn(FFMPEG_PATH, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    
    const chunks = [];
    let stderr = '';
    
    ff.stdout.on('data', chunk => chunks.push(chunk));
    ff.stderr.on('data', chunk => stderr += chunk.toString());
    
    ff.stdin.write(inputBuffer);
    ff.stdin.end();
    
    ff.on('close', (code) => {
      if (code !== 0) {
        console.error(`❌ FFmpeg falhou: ${stderr}`);
        return;
      }
      
      const outputBuffer = Buffer.concat(chunks);
      console.log(`\n✅ Conversão completa: ${outputBuffer.length} bytes`);
      
      // Parse output
      console.log(`\n📊 Analisando output...`);
      
      const riff = outputBuffer.toString('ascii', 0, 4);
      const wave = outputBuffer.toString('ascii', 8, 12);
      
      console.log(`   RIFF: ${riff}`);
      console.log(`   WAVE: ${wave}`);
      
      // Encontrar fmt
      let off = 12;
      while (off + 8 <= outputBuffer.length) {
        const id = outputBuffer.toString('ascii', off, off + 4);
        const sz = outputBuffer.readUInt32LE(off + 4);
        
        if (id === 'fmt ') {
          const fmtOffset = off + 8;
          const audioFormat = outputBuffer.readUInt16LE(fmtOffset + 0);
          const numChannels = outputBuffer.readUInt16LE(fmtOffset + 2);
          const sampleRate = outputBuffer.readUInt32LE(fmtOffset + 4);
          const bitsPerSample = outputBuffer.readUInt16LE(fmtOffset + 14);
          
          console.log(`\n📊 Formato:`);
          console.log(`   Audio Format: ${audioFormat} ${audioFormat === 3 ? '(Float)' : '(PCM Integer)'}`);
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
            const ptr = dataOffset + i * 8;
            const left = outputBuffer.readFloatLE(ptr);
            const right = outputBuffer.readFloatLE(ptr + 4);
            
            console.log(`   Sample ${i}: L=${left.toFixed(6)}, R=${right.toFixed(6)}`);
          }
          
          // Encontrar max absolute
          let maxAbsolute = 0;
          const numSamples = Math.floor(sz / 8);
          const samplesToCheck = Math.min(numSamples, 100000);
          
          for (let i = 0; i < samplesToCheck; i++) {
            const ptr = dataOffset + i * 8;
            const left = Math.abs(outputBuffer.readFloatLE(ptr));
            const right = Math.abs(outputBuffer.readFloatLE(ptr + 4));
            
            if (left > maxAbsolute) maxAbsolute = left;
            if (right > maxAbsolute) maxAbsolute = right;
          }
          
          const maxDb = maxAbsolute > 0 ? 20 * Math.log10(maxAbsolute) : -120;
          
          console.log(`\n📊 Análise (primeiros ${samplesToCheck} samples):`);
          console.log(`   Max Absolute: ${maxAbsolute.toFixed(6)}`);
          console.log(`   Max dB: ${maxDb.toFixed(2)} dBFS`);
          
          if (maxAbsolute > 1.1) {
            console.log(`   ❌ ERRO GRAVE: Valores muito acima de 1.0 (${maxAbsolute.toFixed(2)}x)`);
            console.log(`   🚨 PROBLEMA: Buffer NÃO está normalizado!`);
          } else if (maxAbsolute > 1.0) {
            console.log(`   ⚠️  ATENÇÃO: Valores ligeiramente > 1.0 (clipping permitido)`);
          } else {
            console.log(`   ✅ OK: Valores dentro de [-1, 1]`);
          }
          
          // Comparação esperada
          console.log(`\n📊 Comparação:`);
          console.log(`   FFmpeg volumedetect: 0.0 dB`);
          console.log(`   Nosso cálculo: ${maxDb.toFixed(2)} dBFS`);
          console.log(`   Diferença: ${Math.abs(maxDb - 0.0).toFixed(2)} dB`);
          
          if (Math.abs(maxDb - 0.0) < 0.2) {
            console.log(`   ✅ SUCESSO: Conversão correta!`);
          } else {
            console.log(`   ❌ FALHA: Conversão incorreta`);
          }
          
          break;
        }
        
        off += 8 + sz + (sz % 2);
      }
    });
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
  }
}

testPipeConversion().catch(console.error);
