// 🧪 TESTE DE DIAGNÓSTICO DO AUDIO DECODER
// Verifica onde está o problema na decodificação

import fs from 'fs';
import { decodeAudioFile, checkFFmpegAvailable } from './api/audio/audio-decoder.js';

console.log('🧪 DIAGNÓSTICO DO AUDIO DECODER...\n');

async function diagnosticTest() {
  try {
    // 1. Verificar FFmpeg
    console.log('1️⃣ Verificando FFmpeg...');
    const ffmpegCheck = await checkFFmpegAvailable();
    console.log('FFmpeg disponível:', ffmpegCheck.ffmpeg);
    console.log('FFprobe disponível:', ffmpegCheck.ffprobe);
    console.log('FFmpeg path:', ffmpegCheck.FFMPEG_PATH);
    console.log('FFprobe path:', ffmpegCheck.FFPROBE_PATH);
    console.log('');
    
    // 2. Testar com arquivo menor
    console.log('2️⃣ Testando com arquivo menor...');
    const smallFile = './node_modules/node-wav/tests/file1.wav';
    
    if (!fs.existsSync(smallFile)) {
      throw new Error(`Arquivo pequeno não encontrado: ${smallFile}`);
    }
    
    const audioBuffer = fs.readFileSync(smallFile);
    console.log(`Arquivo carregado: ${audioBuffer.length} bytes`);
    
    // 3. Analisar o cabeçalho WAV atual
    console.log('3️⃣ Analisando cabeçalho WAV original...');
    const riff = audioBuffer.toString('ascii', 0, 4);
    const wave = audioBuffer.toString('ascii', 8, 12);
    const fileSize = audioBuffer.readUInt32LE(4);
    
    console.log(`RIFF: ${riff}`);
    console.log(`WAVE: ${wave}`);
    console.log(`File size: ${fileSize}`);
    
    // Buscar chunk fmt
    let fmtOffset = -1;
    let off = 12;
    while (off + 8 <= audioBuffer.length) {
      const id = audioBuffer.toString('ascii', off, off + 4);
      const sz = audioBuffer.readUInt32LE(off + 4);
      console.log(`Chunk: ${id}, size: ${sz}`);
      
      if (id === 'fmt ') {
        fmtOffset = off + 8;
        const audioFormat = audioBuffer.readUInt16LE(fmtOffset + 0);
        const numChannels = audioBuffer.readUInt16LE(fmtOffset + 2);
        const sampleRate = audioBuffer.readUInt32LE(fmtOffset + 4);
        const bitsPerSample = audioBuffer.readUInt16LE(fmtOffset + 14);
        
        console.log(`Audio format: ${audioFormat} (1=PCM, 3=Float)`);
        console.log(`Channels: ${numChannels}`);
        console.log(`Sample rate: ${sampleRate}`);
        console.log(`Bits per sample: ${bitsPerSample}`);
        break;
      }
      
      off += 8 + sz + (sz % 2); // alinhamento
    }
    console.log('');
    
    // 4. Tentar decodificar
    console.log('4️⃣ Tentando decodificar...');
    try {
      const result = await decodeAudioFile(audioBuffer, 'file1.wav');
      console.log('✅ Decodificação bem-sucedida!');
      console.log(`Sample rate: ${result.sampleRate}`);
      console.log(`Channels: ${result.numberOfChannels}`);
      console.log(`Duration: ${result.duration}s`);
      console.log(`Samples: ${result.length}`);
      console.log(`Left channel: ${result.leftChannel.length} samples`);
      console.log(`Right channel: ${result.rightChannel.length} samples`);
      console.log('');
      
      console.log('🎯 DECODER FUNCIONA CORRETAMENTE!');
      
    } catch (error) {
      console.error('❌ Erro na decodificação:', error.message);
      console.log('');
      
      // 5. Verificar se é problema de formato
      if (error.message.includes('FORMAT_ERROR')) {
        console.log('5️⃣ Problema de formato detectado. Testando conversão manual...');
        
        // O erro indica que o arquivo não é Float32 48kHz
        // Isso é normal - o FFmpeg deveria converter
        // Vamos verificar se o problema é na nossa lógica de conversão
        console.log('📋 ANÁLISE:');
        console.log('- O arquivo original não é Float32 48kHz (isso é normal)');
        console.log('- O FFmpeg deveria converter automaticamente');
        console.log('- Se está falhando, pode ser:');
        console.log('  a) Problema no comando FFmpeg');
        console.log('  b) Problema na leitura do WAV convertido');
        console.log('  c) FFmpeg não está gerando Float32 como esperado');
      }
    }
    
  } catch (error) {
    console.error('❌ ERRO GERAL:', error.message);
  }
}

diagnosticTest();
