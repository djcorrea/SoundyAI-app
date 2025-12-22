/**
 * 🔍 TESTE: Analisar chunk fmt extensible
 */

import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import ffmpegStatic from 'ffmpeg-static';

const FFMPEG_PATH = ffmpegStatic || 'ffmpeg';

async function analyzeFmtChunk() {
  console.log('🔍 TESTE: Análise do chunk fmt extensible\n');
  
  try {
    // Ler arquivo original e converter
    const filePath = 'C:\\SET - DESANDE AUTOMOTIVO\\35 SOCA SOCA EXTENDED.wav';
    const inputBuffer = await readFile(filePath);
    
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
    
    const ff = spawn(FFMPEG_PATH, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    
    const chunks = [];
    ff.stdout.on('data', chunk => chunks.push(chunk));
    ff.stdin.write(inputBuffer);
    ff.stdin.end();
    
    ff.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ Conversão falhou');
        return;
      }
      
      const wav = Buffer.concat(chunks);
      console.log(`✅ WAV convertido: ${wav.length} bytes\n`);
      
      // Encontrar chunk fmt
      let off = 12;
      while (off + 8 <= wav.length) {
        const id = wav.toString('ascii', off, off + 4);
        const sz = wav.readUInt32LE(off + 4);
        
        if (id === 'fmt ') {
          const fmtOffset = off + 8;
          console.log(`📊 Chunk fmt encontrado:`);
          console.log(`   Offset: ${fmtOffset}`);
          console.log(`   Size: ${sz} bytes`);
          
          const audioFormat = wav.readUInt16LE(fmtOffset + 0);
          const numChannels = wav.readUInt16LE(fmtOffset + 2);
          const sampleRate = wav.readUInt32LE(fmtOffset + 4);
          const byteRate = wav.readUInt32LE(fmtOffset + 8);
          const blockAlign = wav.readUInt16LE(fmtOffset + 12);
          const bitsPerSample = wav.readUInt16LE(fmtOffset + 14);
          
          console.log(`\n📋 Campos padrão (16 bytes):`);
          console.log(`   Audio Format: ${audioFormat} ${audioFormat === 3 ? '(Float)' : audioFormat === 1 ? '(PCM Int)' : audioFormat === 65534 ? '(Extensible)' : '(Unknown)'}`);
          console.log(`   Channels: ${numChannels}`);
          console.log(`   Sample Rate: ${sampleRate} Hz`);
          console.log(`   Byte Rate: ${byteRate}`);
          console.log(`   Block Align: ${blockAlign}`);
          console.log(`   Bits Per Sample: ${bitsPerSample}`);
          
          // Se extensible, tem campos adicionais
          if (audioFormat === 65534 && sz >= 40) {
            const cbSize = wav.readUInt16LE(fmtOffset + 16);
            console.log(`\n📋 Campos extensible:`);
            console.log(`   cbSize: ${cbSize}`);
            
            if (cbSize >= 22) {
              const validBitsPerSample = wav.readUInt16LE(fmtOffset + 18);
              const channelMask = wav.readUInt32LE(fmtOffset + 20);
              
              // GUID (16 bytes) começa em fmtOffset + 24
              const guid = [];
              for (let i = 0; i < 16; i++) {
                guid.push(wav.readUInt8(fmtOffset + 24 + i).toString(16).padStart(2, '0'));
              }
              
              console.log(`   Valid Bits Per Sample: ${validBitsPerSample}`);
              console.log(`   Channel Mask: 0x${channelMask.toString(16)}`);
              console.log(`   SubFormat GUID: ${guid.join('')}`);
              
              // GUID para Float32 PCM: 00000003-0000-0010-8000-00aa00389b71
              const float32Guid = '0300000000001000800000aa00389b71';
              // GUID para PCM Integer: 00000001-0000-0010-8000-00aa00389b71
              const pcmIntGuid = '0100000000001000800000aa00389b71';
              
              const guidStr = guid.join('');
              
              if (guidStr === float32Guid) {
                console.log(`   ✅ SubFormat: Float32 PCM`);
              } else if (guidStr === pcmIntGuid) {
                console.log(`   ❌ SubFormat: PCM INTEGER (não Float!)`);
              } else {
                console.log(`   ⚠️  SubFormat: Desconhecido`);
              }
            }
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

analyzeFmtChunk().catch(console.error);
