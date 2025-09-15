// upload-test-debug.js - Fazer upload via API para capturar logs

import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch';

async function uploadTestDebug() {
  try {
    console.log('🔍 Criando arquivo WAV de teste...');
    
    // Criar um arquivo WAV com um pouco de áudio (1 segundo de silêncio a 44100Hz)
    const sampleRate = 44100;
    const duration = 1; // 1 segundo
    const samples = sampleRate * duration;
    const dataSize = samples * 2; // 16-bit samples
    const fileSize = 44 + dataSize; // Header + data
    
    const buffer = Buffer.alloc(44 + dataSize);
    let offset = 0;
    
    // RIFF header
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
    buffer.write('WAVE', offset); offset += 4;
    
    // fmt chunk
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // fmt chunk size
    buffer.writeUInt16LE(1, offset); offset += 2;  // Audio format (PCM)
    buffer.writeUInt16LE(1, offset); offset += 2;  // Number of channels (mono)
    buffer.writeUInt32LE(sampleRate, offset); offset += 4; // Sample rate
    buffer.writeUInt32LE(sampleRate * 2, offset); offset += 4; // Byte rate
    buffer.writeUInt16LE(2, offset); offset += 2;  // Block align
    buffer.writeUInt16LE(16, offset); offset += 2; // Bits per sample
    
    // data chunk
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataSize, offset); offset += 4;
    
    // Audio data (silence)
    for (let i = 0; i < samples; i++) {
      buffer.writeInt16LE(0, offset);
      offset += 2;
    }
    
    const testFilePath = './test-audio-debug.wav';
    fs.writeFileSync(testFilePath, buffer);
    console.log(`✅ Arquivo de teste criado: ${testFilePath} (${(buffer.length / 1024).toFixed(1)}KB)`);
    
    // Criar FormData para upload
    const form = new FormData();
    form.append('audio', fs.createReadStream(testFilePath));
    form.append('mode', 'genre');
    
    console.log('📡 Enviando upload para http://localhost:8080/upload...');
    
    const response = await fetch('http://localhost:8080/upload', {
      method: 'POST',
      body: form,
      timeout: 60000
    });
    
    console.log('✅ Upload enviado!');
    console.log('📊 Status:', response.status);
    console.log('� Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseData = await response.text();
    console.log('� Response:', responseData.substring(0, 500) + (responseData.length > 500 ? '...' : ''));
    
    // Limpar arquivo de teste
    fs.unlinkSync(testFilePath);
    console.log('🧹 Arquivo de teste removido');
    
  } catch (error) {
    console.error('❌ Erro no upload:', error.message);
    console.error('❌ Stack:', error.stack);
  }
}

uploadTestDebug();