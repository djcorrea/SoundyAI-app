// test-progress-tracking.js - Testar sistema de progress tracking
import "dotenv/config";
import fs from "fs";
import fetch from "node-fetch";

console.log('🧪 TESTE: Sistema de Progress Tracking');
console.log('=====================================');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

// Função para criar arquivo de teste WAV
function createTestWAV() {
  const sampleRate = 44100;
  const duration = 2; // 2 segundos
  const channels = 2;
  const samplesPerChannel = sampleRate * duration;
  
  const headerSize = 44;
  const dataSize = samplesPerChannel * channels * 2; // 16-bit
  const fileSize = headerSize + dataSize;
  
  const buffer = Buffer.alloc(fileSize);
  
  // WAV header
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
  
  // Gerar dados de áudio (seno)
  let dataOffset = 44;
  for (let i = 0; i < samplesPerChannel; i++) {
    const t = i / sampleRate;
    const leftSample = Math.sin(2 * Math.PI * 440 * t) * 0.3;
    const rightSample = Math.sin(2 * Math.PI * 880 * t) * 0.2;
    
    buffer.writeInt16LE(Math.round(leftSample * 32767), dataOffset);
    dataOffset += 2;
    buffer.writeInt16LE(Math.round(rightSample * 32767), dataOffset);
    dataOffset += 2;
  }
  
  return buffer;
}

async function testProgressTracking() {
  try {
    console.log('📁 1. Criando arquivo de teste...');
    const testFile = createTestWAV();
    fs.writeFileSync('test-progress.wav', testFile);
    console.log('✅ Arquivo criado: test-progress.wav (44.1kHz, Estéreo, 2s)');
    
    console.log('🌐 2. Obtendo URL de upload...');
    const presignedResponse = await fetch(`${SERVER_URL}/api/upload/presigned`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'test-progress.wav',
        fileType: 'audio/wav'
      })
    });
    
    if (!presignedResponse.ok) {
      throw new Error(`Erro ao obter URL presigned: ${presignedResponse.status}`);
    }
    
    const { uploadUrl, fileKey } = await presignedResponse.json();
    console.log(`✅ URL presigned obtida: ${fileKey}`);
    
    console.log('⬆️ 3. Fazendo upload...');
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: testFile,
      headers: { 'Content-Type': 'audio/wav' }
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`Erro no upload: ${uploadResponse.status}`);
    }
    
    console.log('✅ Upload concluído');
    
    console.log('🔄 4. Criando job de análise...');
    const jobResponse = await fetch(`${SERVER_URL}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileKey: fileKey,
        mode: 'genre',
        fileName: 'test-progress.wav'
      })
    });
    
    if (!jobResponse.ok) {
      throw new Error(`Erro ao criar job: ${jobResponse.status}`);
    }
    
    const { jobId } = await jobResponse.json();
    console.log(`✅ Job criado: ${jobId}`);
    
    console.log('📊 5. Monitorando progresso...');
    let lastProgress = -1;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutos
    
    while (attempts < maxAttempts) {
      attempts++;
      
      const statusResponse = await fetch(`${SERVER_URL}/api/jobs/${jobId}`);
      if (!statusResponse.ok) {
        throw new Error(`Erro ao verificar status: ${statusResponse.status}`);
      }
      
      const job = await statusResponse.json();
      
      // Log do progresso
      if (job.progress !== null && job.progress !== lastProgress) {
        console.log(`📊 Progress: ${job.progress}% - ${job.progressMessage || 'Processando...'}`);
        lastProgress = job.progress;
      }
      
      // Status completo
      if (job.status === 'completed') {
        console.log('✅ Job concluído!');
        console.log(`🎯 Score final: ${job.result?.score || 'N/A'}%`);
        console.log(`📊 Progresso final: ${job.progress}%`);
        
        if (job.progress === 100) {
          console.log('🎉 TESTE PASSOU: Progresso chegou em 100%');
        } else {
          console.log(`❌ TESTE FALHOU: Progresso final foi ${job.progress}%, esperado 100%`);
        }
        
        break;
      }
      
      if (job.status === 'failed' || job.status === 'error') {
        throw new Error(`Job falhou: ${job.error}`);
      }
      
      // Aguardar antes da próxima verificação
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    if (attempts >= maxAttempts) {
      throw new Error('Timeout: Job não foi concluído em 5 minutos');
    }
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message);
    throw error;
  } finally {
    // Limpar arquivo de teste
    try {
      fs.unlinkSync('test-progress.wav');
      console.log('🧹 Arquivo de teste removido');
    } catch (e) {
      // Ignorar erro de limpeza
    }
  }
}

// Executar teste
testProgressTracking()
  .then(() => {
    console.log('\n🎉 TESTE DE PROGRESS TRACKING CONCLUÍDO COM SUCESSO!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 TESTE DE PROGRESS TRACKING FALHOU:', error);
    process.exit(1);
  });
