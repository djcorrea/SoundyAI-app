// Teste da rota refatorada /api/audio/analyze

const testData = {
  fileKey: "uploads/teste.wav",
  mode: "genre", 
  fileName: "teste.wav"
};

const BASE_URL = 'http://localhost:3001';

console.log('🧪 Testando POST /api/audio/analyze...');
console.log('Dados:', JSON.stringify(testData, null, 2));

// Primeiro testar se o servidor está respondendo
try {
  console.log('\n🔍 Testando conectividade básica...');
  const healthResponse = await fetch(`${BASE_URL}/`);
  const healthData = await healthResponse.json();
  console.log('✅ Servidor ativo - Status:', healthResponse.status);
  console.log('📋 Resposta:', healthData);
} catch (error) {
  console.error('❌ Servidor não está respondendo:', error.message);
  process.exit(1);
}

// Agora testar a rota de análise
try {
  console.log('\n🎯 Testando rota de análise...');
  const response = await fetch(`${BASE_URL}/api/audio/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testData)
  });
  
  console.log('📡 Status HTTP:', response.status);
  console.log('📋 Headers:', Object.fromEntries(response.headers.entries()));
  
  const result = await response.json();
  console.log('📄 Resposta:', JSON.stringify(result, null, 2));
  
  // Verificar se o formato está correto
  if (result.success && result.jobId && result.fileKey) {
    console.log('\n✅ SUCESSO! Formato da resposta está correto.');
    console.log(`🆔 Job ID: ${result.jobId}`);
    console.log(`📁 File Key: ${result.fileKey}`);
    console.log(`🎵 Mode: ${result.mode}`);
    console.log(`📅 Created At: ${result.createdAt}`);
  } else {
    console.log('\n⚠️ Resposta não está no formato esperado.');
  }
  
} catch (error) {
  console.error('❌ Erro na requisição:', error.message);
}
