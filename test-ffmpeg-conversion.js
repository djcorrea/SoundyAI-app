// 🧪 TESTE DE CONVERSÃO FFMPEG
// Verifica o que o FFmpeg está produzindo

import fs from 'fs';
import { spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';

console.log('🧪 TESTE DE CONVERSÃO FFMPEG...\n');

const FFMPEG_PATH = ffmpegStatic;

async function testFFmpegConversion() {
  try {
    console.log('1️⃣ Carregando arquivo de teste...');
    const inputFile = './node_modules/node-wav/tests/file1.wav';
    const inputBuffer = fs.readFileSync(inputFile);
    console.log(`Arquivo original: ${inputBuffer.length} bytes`);
    
    console.log('2️⃣ Executando conversão FFmpeg...');
    
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-nostdin',
      '-i', 'pipe:0',        // entrada via stdin
      '-vn',
      '-ar', '48000',        // 48kHz
      '-ac', '2',            // estéreo
      '-c:a', 'pcm_f32le',   // Float32 LE
      '-f', 'wav',
      'pipe:1'               // saída via stdout
    ];
    
    console.log('Comando FFmpeg:', FFMPEG_PATH, args.join(' '));
    
    const result = await new Promise((resolve, reject) => {
      const ff = spawn(FFMPEG_PATH, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stderr = '';
      const chunks = [];
      
      ff.stdout.on('data', (d) => chunks.push(d));
      ff.stderr.on('data', (d) => (stderr += d?.toString?.() || ''));
      
      ff.on('error', (err) => {
        reject(new Error(`FFMPEG_SPAWN_ERROR: ${err.message}`));
      });
      
      ff.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFMPEG_ERROR: code=${code} msg=${stderr || '(sem stderr)'}`));
          return;
        }
        resolve({ output: Buffer.concat(chunks), stderr });
      });
      
      // Envia o arquivo para o stdin do ffmpeg
      try {
        ff.stdin.write(inputBuffer);
        ff.stdin.end();
      } catch (err) {
        reject(new Error(`FFMPEG_STDIN_ERROR: ${err.message}`));
      }
    });
    
    console.log(`✅ FFmpeg executado com sucesso!`);
    console.log(`Saída: ${result.output.length} bytes`);
    if (result.stderr) console.log(`Stderr: ${result.stderr}`);
    
    console.log('3️⃣ Analisando WAV convertido...');
    const wav = result.output;
    
    // Verificar cabeçalho
    const riff = wav.toString('ascii', 0, 4);
    const wave = wav.toString('ascii', 8, 12);
    console.log(`RIFF: ${riff}`);
    console.log(`WAVE: ${wave}`);
    
    // Encontrar chunk fmt
    let fmtOffset = -1;
    let dataOffset = -1;
    let off = 12;
    
    while (off + 8 <= wav.length) {
      const id = wav.toString('ascii', off, off + 4);
      const sz = wav.readUInt32LE(off + 4);
      console.log(`Chunk: ${id}, size: ${sz}`);
      
      if (id === 'fmt ') {
        fmtOffset = off + 8;
        console.log(`fmt offset: ${fmtOffset}`);
        
        // Ler formato
        const audioFormat = wav.readUInt16LE(fmtOffset + 0);
        const numChannels = wav.readUInt16LE(fmtOffset + 2);
        const sampleRate = wav.readUInt32LE(fmtOffset + 4);
        const bitsPerSample = wav.readUInt16LE(fmtOffset + 14);
        
        console.log(`Audio format: ${audioFormat} (esperado: 3)`);
        console.log(`Channels: ${numChannels} (esperado: 2)`);
        console.log(`Sample rate: ${sampleRate} (esperado: 48000)`);
        console.log(`Bits per sample: ${bitsPerSample} (esperado: 32)`);
        
        if (audioFormat === 3 && numChannels === 2 && sampleRate === 48000 && bitsPerSample === 32) {
          console.log('✅ Formato correto!');
        } else {
          console.log('❌ Formato incorreto!');
        }
        
      } else if (id === 'data') {
        dataOffset = off + 8;
        console.log(`data offset: ${dataOffset}, size: ${sz}`);
      }
      
      off += 8 + sz + (sz % 2);
    }
    
    // Salvar para inspeção
    fs.writeFileSync('./test-converted.wav', wav);
    console.log('💾 WAV convertido salvo em test-converted.wav');
    
    console.log('4️⃣ Testando leitura de samples...');
    if (fmtOffset >= 0 && dataOffset >= 0) {
      // Ler alguns samples para verificar
      const bytesPerSample = 4; // Float32
      const frameBytes = 2 * bytesPerSample; // estéreo
      const numSamples = Math.min(10, Math.floor((wav.length - dataOffset) / frameBytes));
      
      console.log(`Lendo ${numSamples} samples...`);
      
      let ptr = dataOffset;
      for (let i = 0; i < numSamples; i++) {
        const l = wav.readFloatLE(ptr);
        const r = wav.readFloatLE(ptr + 4);
        console.log(`Sample ${i}: L=${l.toFixed(6)}, R=${r.toFixed(6)}`);
        ptr += frameBytes;
      }
      
      console.log('✅ Samples lidos com sucesso!');
    }
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
  }
}

testFFmpegConversion();
