// simular-upload-debug.js - Simular upload para capturar logs

// Como o sistema está rodando na porta 3000, vou fazer um request simulado
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function simularUploadDebug() {
  try {
    console.log('🔍 Simulando upload para capturar logs do core-metrics...');
    
    // Vou criar um arquivo de áudio pequeno simulado (só para testar)
    // Na verdade, vou fazer um POST direto para o endpoint que já existe
    
    console.log('📡 Fazendo request para o endpoint de upload...');
    
    // Como não temos um arquivo específico, vou verificar se há arquivos na pasta uploads
    const uploadsPath = './uploads';
    
    if (fs.existsSync(uploadsPath)) {
      const files = fs.readdirSync(uploadsPath);
      const audioFiles = files.filter(f => f.endsWith('.wav') || f.endsWith('.mp3'));
      
      if (audioFiles.length > 0) {
        const testFile = audioFiles[0];
        console.log(`📁 Usando arquivo existente: ${testFile}`);
        
        // Vou fazer um request simulado para reprocessar
        const response = await axios.post('http://localhost:3000/api/analyze', {
          file: `uploads/${testFile}`,
          mode: 'genre'
        }, {
          timeout: 30000
        });
        
        console.log('✅ Upload simulado enviado!');
        console.log('📊 Status:', response.status);
        console.log('📋 Response data:', response.data);
        
      } else {
        console.log('❌ Nenhum arquivo de áudio encontrado na pasta uploads');
      }
    } else {
      console.log('❌ Pasta uploads não encontrada');
    }
    
  } catch (error) {
    console.error('❌ Erro no upload simulado:', error.message);
    if (error.response) {
      console.error('📋 Response error:', error.response.data);
    }
  }
}

simularUploadDebug();