// Teste de verificação do PostgreSQL
const testData = {
  fileKey: "uploads/teste_postgres.wav",
  mode: "genre", 
  fileName: "teste_postgres.wav"
};

console.log('🧪 Testando POST /api/audio/analyze com PostgreSQL...');
console.log('Dados:', JSON.stringify(testData, null, 2));

try {
  const response = await fetch('http://localhost:8080/api/audio/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testData)
  });
  
  const result = await response.json();
  
  console.log('\n✅ RESULTADO:');
  console.log(`   Status: ${response.status}`);
  console.log(`   Success: ${result.success}`);
  console.log(`   Job ID: ${result.jobId}`);
  console.log(`   File Key: ${result.fileKey}`);
  console.log(`   Created At: ${result.createdAt}`);
  console.log(`   Processing Time: ${result.performance?.processingTime}`);
  
  if (result.success) {
    console.log('\n🎉 PostgreSQL integrado com sucesso!');
  }
  
} catch (error) {
  console.error('❌ Erro:', error.message);
}
