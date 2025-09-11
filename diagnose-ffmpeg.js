// DIAGNÓSTICO: Verificar FFmpeg/FFprobe
import { spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStaticPkg from 'ffprobe-static';

console.log('🔧 DIAGNÓSTICO: FFmpeg/FFprobe');
console.log('==============================');

const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || (ffprobeStaticPkg && (ffprobeStaticPkg.path || ffprobeStaticPkg)) || 'ffprobe';

console.log(`📍 FFMPEG_PATH: ${FFMPEG_PATH}`);
console.log(`📍 FFPROBE_PATH: ${FFPROBE_PATH}`);

// Testar FFprobe version
async function testFFprobeVersion() {
  console.log('\n🧪 Testando FFprobe version...');
  
  return new Promise((resolve) => {
    const ffprobe = spawn(FFPROBE_PATH, ['-version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    
    let output = '';
    let error = '';
    
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ffprobe.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    ffprobe.on('close', (code) => {
      if (code === 0) {
        console.log('✅ FFprobe funcionando!');
        console.log(`📄 Version: ${output.split('\n')[0]}`);
        resolve(true);
      } else {
        console.log('❌ FFprobe falhou!');
        console.log(`📄 Erro: ${error}`);
        resolve(false);
      }
    });
    
    ffprobe.on('error', (err) => {
      console.log('❌ Erro ao executar FFprobe:', err.message);
      resolve(false);
    });
  });
}

// Testar FFmpeg version
async function testFFmpegVersion() {
  console.log('\n🧪 Testando FFmpeg version...');
  
  return new Promise((resolve) => {
    const ffmpeg = spawn(FFMPEG_PATH, ['-version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    
    let output = '';
    let error = '';
    
    ffmpeg.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ffmpeg.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log('✅ FFmpeg funcionando!');
        console.log(`📄 Version: ${output.split('\n')[0]}`);
        resolve(true);
      } else {
        console.log('❌ FFmpeg falhou!');
        console.log(`📄 Erro: ${error}`);
        resolve(false);
      }
    });
    
    ffmpeg.on('error', (err) => {
      console.log('❌ Erro ao executar FFmpeg:', err.message);
      resolve(false);
    });
  });
}

// Testar com arquivo simples
async function testWithSimpleFile() {
  console.log('\n🧪 Testando com arquivo simples via arquivo temporário...');
  
  try {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    
    // Criar arquivo WAV mínimo válido
    const sampleRate = 8000; // Sample rate baixo para teste
    const duration = 0.1; // 100ms
    const channels = 1;
    const samplesPerChannel = Math.floor(sampleRate * duration);
    
    const headerSize = 44;
    const dataSize = samplesPerChannel * channels * 2; // 16-bit
    const fileSize = headerSize + dataSize;
    
    const buffer = Buffer.alloc(fileSize);
    
    // WAV header mínimo
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(fileSize - 8, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * channels * 2, 28);
    buffer.writeUInt16LE(channels * 2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    
    // Dados silenciosos
    for (let i = 44; i < fileSize; i += 2) {
      buffer.writeInt16LE(0, i);
    }
    
    // Salvar em arquivo temporário
    const tempFile = path.join(os.tmpdir(), `test-${Date.now()}.wav`);
    fs.writeFileSync(tempFile, buffer);
    
    console.log(`📁 Arquivo criado: ${tempFile}`);
    console.log(`📦 Tamanho: ${fileSize} bytes`);
    
    // Testar FFprobe com arquivo
    return new Promise((resolve) => {
      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        tempFile
      ];
      
      const ffprobe = spawn(FFPROBE_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      
      let output = '';
      let error = '';
      
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ffprobe.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      ffprobe.on('close', (code) => {
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {
          // Ignorar erro de limpeza
        }
        
        if (code === 0) {
          try {
            const info = JSON.parse(output);
            const audioStream = info.streams?.find(s => s.codec_type === 'audio');
            
            if (audioStream) {
              console.log('✅ FFprobe leu metadados com sucesso!');
              console.log(`📊 Sample Rate: ${audioStream.sample_rate}`);
              console.log(`🎵 Channels: ${audioStream.channels}`);
              console.log(`⏰ Duration: ${info.format?.duration}`);
              resolve(true);
            } else {
              console.log('❌ Nenhum stream de áudio encontrado');
              resolve(false);
            }
          } catch (parseErr) {
            console.log('❌ Erro ao parsear JSON:', parseErr.message);
            console.log('📄 Output raw:', output);
            resolve(false);
          }
        } else {
          console.log('❌ FFprobe falhou com código:', code);
          console.log('📄 Erro:', error);
          resolve(false);
        }
      });
      
      ffprobe.on('error', (err) => {
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {
          // Ignorar erro de limpeza
        }
        console.log('❌ Erro ao executar FFprobe:', err.message);
        resolve(false);
      });
    });
    
  } catch (err) {
    console.log('❌ Erro no teste com arquivo:', err.message);
    return false;
  }
}

async function runDiagnostic() {
  const ffprobeTest = await testFFprobeVersion();
  const ffmpegTest = await testFFmpegVersion();
  const fileTest = await testWithSimpleFile();
  
  console.log('\n🏁 RESULTADO DO DIAGNÓSTICO');
  console.log('============================');
  console.log(`FFprobe: ${ffprobeTest ? '✅ OK' : '❌ FALHA'}`);
  console.log(`FFmpeg: ${ffmpegTest ? '✅ OK' : '❌ FALHA'}`);
  console.log(`Teste com arquivo: ${fileTest ? '✅ OK' : '❌ FALHA'}`);
  
  if (ffprobeTest && ffmpegTest && fileTest) {
    console.log('\n🎉 FFmpeg/FFprobe estão funcionando corretamente!');
    console.log('💡 O problema pode estar na implementação da função getAudioInfo');
  } else {
    console.log('\n💥 Problemas detectados com FFmpeg/FFprobe!');
    console.log('💡 Verificar instalação e caminhos');
  }
}

runDiagnostic().catch(console.error);
