// 🧪 TESTE DA NOVA IMPLEMENTAÇÃO FFMPEG TRUE PEAK
// Verificar se a substituição completa está funcionando

import { analyzeTruePeaksFFmpeg } from './work/lib/audio/features/truepeak-ffmpeg.js';
import fs from 'fs';
import path from 'path';

console.log('🧪 [FFMPEG_TP_TEST] Iniciando teste da nova implementação FFmpeg...');

// Mock de canais de áudio para teste
const mockChannels = {
  left: new Float32Array(1024).map((_, i) => Math.sin(2 * Math.PI * 440 * i / 48000) * 0.5),
  right: new Float32Array(1024).map((_, i) => Math.sin(2 * Math.PI * 440 * i / 48000) * 0.5)
};

console.log('📊 [FFMPEG_TP_TEST] Canais mock criados:', {
  leftLength: mockChannels.left.length,
  rightLength: mockChannels.right.length,
  leftMax: Math.max(...mockChannels.left.map(Math.abs)),
  rightMax: Math.max(...mockChannels.right.map(Math.abs))
});

// Criar arquivo WAV temporário para teste
const testWavPath = './test_sine_wave.wav';

// Header WAV simples para o teste (44.1kHz, 16-bit, stereo, 1 segundo)
function createSimpleWav() {
  const sampleRate = 44100;
  const numChannels = 2;
  const bitsPerSample = 16;
  const duration = 1; // 1 segundo
  const numSamples = sampleRate * duration * numChannels;
  
  // Header WAV (44 bytes)
  const buffer = Buffer.alloc(44 + numSamples * 2);
  let offset = 0;
  
  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(36 + numSamples * 2, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;
  
  // fmt chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4; // fmt chunk size
  buffer.writeUInt16LE(1, offset); offset += 2; // PCM format
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, offset); offset += 4;
  buffer.writeUInt16LE(numChannels * bitsPerSample / 8, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
  
  // data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(numSamples * 2, offset); offset += 4;
  
  // Audio data - tom de 1kHz com amplitude -6dBFS (~0.5)
  for (let i = 0; i < numSamples / 2; i++) {
    const sample = Math.sin(2 * Math.PI * 1000 * i / sampleRate) * 0.5;
    const sampleInt = Math.round(sample * 32767);
    
    // Left channel
    buffer.writeInt16LE(sampleInt, offset);
    offset += 2;
    
    // Right channel  
    buffer.writeInt16LE(sampleInt, offset);
    offset += 2;
  }
  
  return buffer;
}

async function testFFmpegTruePeak() {
  try {
    console.log('🎵 [FFMPEG_TP_TEST] Criando arquivo WAV de teste...');
    
    // Criar arquivo WAV temporário
    const wavBuffer = createSimpleWav();
    fs.writeFileSync(testWavPath, wavBuffer);
    
    console.log(`✅ [FFMPEG_TP_TEST] Arquivo WAV criado: ${testWavPath} (${wavBuffer.length} bytes)`);
    
    // Testar a nova função FFmpeg
    console.log('🔍 [FFMPEG_TP_TEST] Testando analyzeTruePeaksFFmpeg...');
    
    const result = await analyzeTruePeaksFFmpeg(
      mockChannels.left,
      mockChannels.right,
      44100,
      testWavPath
    );
    
    console.log('✅ [FFMPEG_TP_TEST] Resultado obtido:');
    console.log('📊 [FFMPEG_TP_TEST] Campos principais:');
    console.log(`  - truePeakDbtp: ${result.truePeakDbtp}`);
    console.log(`  - true_peak_dbtp: ${result.true_peak_dbtp}`);
    console.log(`  - maxDbtp: ${result.maxDbtp}`);
    console.log(`  - truePeakLinear: ${result.truePeakLinear}`);
    console.log(`  - maxLinear: ${result.maxLinear}`);
    
    console.log('🔧 [FFMPEG_TP_TEST] Metadata:');
    console.log(`  - Método: ${result.true_peak_mode}`);
    console.log(`  - Processamento: ${result.processing_time}ms`);
    console.log(`  - Broadcast compliant: ${result.broadcast_compliant ? '✅' : '❌'}`);
    console.log(`  - Excede -1dBTP: ${result.exceeds_minus1dbtp ? '⚠️' : '✅'}`);
    
    if (result.error) {
      console.log(`❌ [FFMPEG_TP_TEST] Erro: ${result.error}`);
    }
    
    if (result.warnings && result.warnings.length > 0) {
      console.log('⚠️ [FFMPEG_TP_TEST] Warnings:', result.warnings);
    }
    
    // Verificar compatibilidade com formato antigo
    console.log('🔍 [FFMPEG_TP_TEST] Verificando compatibilidade de campos...');
    
    const requiredFields = [
      'truePeakDbtp', 'true_peak_dbtp', 'maxDbtp', 
      'truePeakLinear', 'maxLinear', 'processing_time'
    ];
    
    const missingFields = requiredFields.filter(field => result[field] === undefined);
    
    if (missingFields.length === 0) {
      console.log('✅ [FFMPEG_TP_TEST] Todos os campos necessários estão presentes');
    } else {
      console.log('❌ [FFMPEG_TP_TEST] Campos faltando:', missingFields);
    }
    
    // Verificar valores esperados para tom de 1kHz a -6dBFS
    if (result.truePeakDbtp !== null) {
      const expectedRange = { min: -8, max: -4 }; // Range esperado para -6dBFS
      
      if (result.truePeakDbtp >= expectedRange.min && result.truePeakDbtp <= expectedRange.max) {
        console.log(`✅ [FFMPEG_TP_TEST] True Peak dentro do range esperado (${expectedRange.min} a ${expectedRange.max} dBTP)`);
      } else {
        console.log(`⚠️ [FFMPEG_TP_TEST] True Peak fora do range esperado: ${result.truePeakDbtp} dBTP`);
      }
    } else {
      console.log('❌ [FFMPEG_TP_TEST] True Peak é null - FFmpeg falhou');
    }
    
  } catch (error) {
    console.error('💥 [FFMPEG_TP_TEST] Erro no teste:', error.message);
    console.error('📍 [FFMPEG_TP_TEST] Stack:', error.stack);
  } finally {
    // Limpar arquivo temporário
    try {
      if (fs.existsSync(testWavPath)) {
        fs.unlinkSync(testWavPath);
        console.log('🗑️ [FFMPEG_TP_TEST] Arquivo temporário removido');
      }
    } catch (cleanupError) {
      console.warn('⚠️ [FFMPEG_TP_TEST] Erro ao limpar arquivo:', cleanupError.message);
    }
  }
}

// Executar teste
testFFmpegTruePeak()
  .then(() => {
    console.log('🏁 [FFMPEG_TP_TEST] Teste concluído');
  })
  .catch(error => {
    console.error('💥 [FFMPEG_TP_TEST] Teste falhou:', error.message);
    process.exit(1);
  });
