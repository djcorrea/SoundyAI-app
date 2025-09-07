// Teste funcional completo - demonstração que a refatoração funcionou
import express from 'express';
import analyzeRoute from './api/audio/analyze.js';

const app = express();
const PORT = 3333;

// Middleware
app.use(express.json());

// Registrar a rota refatorada
app.use('/api/audio', analyzeRoute);

// Rota de status
app.get('/status', (req, res) => {
  res.json({ 
    status: 'online', 
    message: 'Servidor funcionando com rota refatorada',
    routes: [
      'GET /status',
      'POST /api/audio/analyze'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 TESTE: Servidor rodando na porta ${PORT}`);
  console.log(`📡 Status: http://localhost:${PORT}/status`);
  console.log(`🎯 Rota: POST http://localhost:${PORT}/api/audio/analyze`);
  
  // Fazer um teste automático após 1 segundo
  setTimeout(async () => {
    try {
      console.log('\n🧪 EXECUTANDO TESTE AUTOMÁTICO...');
      
      const testPayload = {
        fileKey: "uploads/teste_automatico.wav",
        mode: "genre",
        fileName: "teste_automatico.wav"
      };
      
      const response = await fetch(`http://localhost:${PORT}/api/audio/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });
      
      const result = await response.json();
      
      console.log('✅ RESULTADO DO TESTE:');
      console.log(`   Status: ${response.status}`);
      console.log(`   Success: ${result.success}`);
      console.log(`   Job ID: ${result.jobId}`);
      console.log(`   File Key: ${result.fileKey}`);
      console.log(`   Mode: ${result.mode}`);
      console.log(`   Created At: ${result.createdAt}`);
      
      if (result.success && result.jobId && result.fileKey === testPayload.fileKey) {
        console.log('\n🎉 SUCESSO TOTAL! A refatoração está funcionando perfeitamente!');
      } else {
        console.log('\n⚠️ Algum problema na resposta');
      }
      
    } catch (error) {
      console.error('❌ Erro no teste:', error.message);
    }
  }, 1000);
});
