// TESTE SIMPLIFICADO: Verificar função getAudioInfo
import { getAudioInfo } from './work/api/audio/audio-decoder.js';
import fs from 'fs';
import path from 'path';

console.log('🔍 TESTE SIMPLIFICADO: Verificação da função getAudioInfo');
console.log('========================================================');

// Função para encontrar um arquivo de áudio existente no sistema
async function findExistingAudioFile() {
  // Procurar por arquivos de áudio comuns no diretório
  const commonPaths = [
    'test.wav',
    'test.mp3',
    'sample.wav',
    'exemplo.wav',
    './uploads/test.wav'
  ];
  
  for (const filePath of commonPaths) {
    try {
      if (fs.existsSync(filePath)) {
        console.log(`📁 Arquivo encontrado: ${filePath}`);
        return filePath;
      }
    } catch (err) {
      // Continuar procurando
    }
  }
  
  return null;
}

async function testGetAudioInfo() {
  try {
    console.log('🔎 Procurando arquivo de áudio existente...');
    
    const existingFile = await findExistingAudioFile();
    
    if (existingFile) {
      console.log(`✅ Arquivo encontrado: ${existingFile}`);
      console.log('🔍 Testando getAudioInfo...');
      
      const fileBuffer = fs.readFileSync(existingFile);
      const audioInfo = await getAudioInfo(fileBuffer, existingFile);
      
      console.log('📊 METADADOS EXTRAÍDOS:');
      console.log('======================');
      console.log(`Sample Rate: ${audioInfo.sampleRate} Hz`);
      console.log(`Channels: ${audioInfo.channels}`);
      console.log(`Duration: ${audioInfo.duration} segundos`);
      console.log(`Codec: ${audioInfo.codec || 'N/A'}`);
      console.log(`Format: ${audioInfo.format || 'N/A'}`);
      console.log(`Bitrate: ${audioInfo.bitrate || 'N/A'}`);
      
      console.log('\n✅ getAudioInfo está funcionando!');
      return true;
      
    } else {
      console.log('❌ Nenhum arquivo de áudio encontrado no diretório');
      console.log('💡 Vou criar um arquivo WAV simples para teste...');
      
      // Criar arquivo WAV mínimo
      const sampleRate = 44100;
      const duration = 1; // 1 segundo
      const channels = 2;
      const samplesPerChannel = sampleRate * duration;
      
      // WAV header simples
      const headerSize = 44;
      const dataSize = samplesPerChannel * channels * 2; // 16-bit
      const fileSize = headerSize + dataSize;
      
      const buffer = Buffer.alloc(fileSize);
      
      // RIFF header
      buffer.write('RIFF', 0);
      buffer.writeUInt32LE(fileSize - 8, 4);
      buffer.write('WAVE', 8);
      
      // fmt chunk
      buffer.write('fmt ', 12);
      buffer.writeUInt32LE(16, 16);
      buffer.writeUInt16LE(1, 20); // PCM
      buffer.writeUInt16LE(channels, 22);
      buffer.writeUInt32LE(sampleRate, 24);
      buffer.writeUInt32LE(sampleRate * channels * 2, 28);
      buffer.writeUInt16LE(channels * 2, 32);
      buffer.writeUInt16LE(16, 34);
      
      // data chunk
      buffer.write('data', 36);
      buffer.writeUInt32LE(dataSize, 40);
      
      // Salvar arquivo temporário
      fs.writeFileSync('temp-test.wav', buffer);
      console.log('📁 Arquivo temporário criado: temp-test.wav');
      
      try {
        console.log('🔍 Testando getAudioInfo com arquivo criado...');
        const audioInfo = await getAudioInfo(buffer, 'temp-test.wav');
        
        console.log('📊 METADADOS EXTRAÍDOS:');
        console.log('======================');
        console.log(`Sample Rate: ${audioInfo.sampleRate} Hz (esperado: 44100)`);
        console.log(`Channels: ${audioInfo.channels} (esperado: 2)`);
        console.log(`Duration: ${audioInfo.duration} segundos (esperado: ~1)`);
        console.log(`Codec: ${audioInfo.codec || 'N/A'}`);
        console.log(`Format: ${audioInfo.format || 'N/A'}`);
        
        // Limpar arquivo temporário
        fs.unlinkSync('temp-test.wav');
        
        const isCorrect = audioInfo.sampleRate === 44100 && 
                         audioInfo.channels === 2 && 
                         Math.abs(audioInfo.duration - 1) < 0.1;
        
        if (isCorrect) {
          console.log('\n🎉 SUCESSO: Metadados extraídos corretamente!');
          return true;
        } else {
          console.log('\n❌ FALHA: Metadados não coincidem com o esperado');
          return false;
        }
        
      } catch (err) {
        console.error('❌ ERRO ao testar getAudioInfo:', err.message);
        
        // Limpar arquivo temporário mesmo em caso de erro
        try {
          fs.unlinkSync('temp-test.wav');
        } catch (cleanupErr) {
          // Ignorar erro de limpeza
        }
        
        return false;
      }
    }
    
  } catch (error) {
    console.error('❌ ERRO GERAL:', error.message);
    return false;
  }
}

// Testar também se as funções estão sendo exportadas
async function testImports() {
  console.log('\n🔧 TESTE DE IMPORTS');
  console.log('==================');
  
  try {
    const { processAudioComplete } = await import('./work/api/audio/pipeline-complete.js');
    console.log('✅ processAudioComplete importado');
    
    const { getAudioInfo } = await import('./work/api/audio/audio-decoder.js');
    console.log('✅ getAudioInfo importado');
    
    console.log(`✅ Tipo de getAudioInfo: ${typeof getAudioInfo}`);
    
    return true;
  } catch (err) {
    console.error('❌ ERRO de import:', err.message);
    return false;
  }
}

async function runSimpleTest() {
  const importTest = await testImports();
  
  if (importTest) {
    const audioTest = await testGetAudioInfo();
    
    console.log('\n🏁 RESULTADO FINAL');
    console.log('=================');
    console.log(`Imports: ${importTest ? '✅ OK' : '❌ FALHA'}`);
    console.log(`getAudioInfo: ${audioTest ? '✅ OK' : '❌ FALHA'}`);
    
    if (importTest && audioTest) {
      console.log('\n🎊 TESTE BÁSICO PASSOU!');
      console.log('✅ getAudioInfo está extraindo metadados corretamente');
    } else {
      console.log('\n💥 TESTE BÁSICO FALHOU!');
    }
  }
}

runSimpleTest().catch(console.error);
