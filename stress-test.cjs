/**
 * STRESS TEST - Teste de Concorrência de Análise de Áudio
 * 
 * COMO USAR:
 * 1. Cole seu Firebase ID Token na constante firebaseToken abaixo
 * 2. Execute: node stress-test.js
 * 
 * O QUE O SCRIPT FAZ:
 * - Dispara 50 análises de áudio simultâneas contra produção
 * - Loga cada requisição (índice, status, tempo)
 * - Mostra resumo final (sucessos, erros, tempo total)
 */

const fs = require('fs');
const https = require('https');
const { URL } = require('url');

// ============= CONFIGURAÇÃO =============
const CONFIG = {
  // URL da API de produção (endpoint real usado pelo frontend)
  apiUrl: 'https://www.soundyai.com.br/api/audio/analyze',
  
  // Firebase ID Token (COLE SEU TOKEN AQUI)
  firebaseToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImQ4Mjg5MmZhMzJlY2QxM2E0ZTBhZWZlNjI4ZGQ5YWFlM2FiYThlMWUiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vcHJvZGFpLTU4NDM2IiwiYXVkIjoicHJvZGFpLTU4NDM2IiwiYXV0aF90aW1lIjoxNzY3NzE3NzczLCJ1c2VyX2lkIjoiNnZRcnNyMGFhb2h6UHNVdVVyTkF4Z0dSbVRTMiIsInN1YiI6IjZ2UXJzcjBhYW9oelBzVXVVck5BeGdHUm1UUzIiLCJpYXQiOjE3Njc3MTc3NzMsImV4cCI6MTc2NzcyMTM3MywiZW1haWwiOiJ0ZXN0ZWFuYWxpc2VAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbInRlc3RlYW5hbGlzZUBnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.xpj7F0G7lqo9Tqh7vpiHCjh7f-CXjl2z0xFKD1ZhP0p8p1xIwwU9oGllPK0RIEfkvQ4qKBPdwDv1-o81E-7cc96kms_f3HbggKTkkeZy66y4ux-at5mRv51_cwbYQQjQlWmPvDr6iuvG1tkOwp6rtyNhq36Lx33AQ1SNtWrKpmOWAWHCdWuaDwcJNvF5wYIHiQJSwOTwk-QVAUTHZIzujjghg-90GXctfVqjafZpCHiDF4870qLJDiYEYfZ2K56ojNMZTqYT2NavBRNn5pRT8QXSQvotvsEVi91np0dxNf9HGkQw_qPupB2SbyTGTf1OqC4v986wgvdGPIdpHk5rZA',
  
  // Caminho do arquivo de áudio local (Windows)
  audioFilePath: 'C:\\SET - DESANDE AUTOMOTIVO\\1 ABERTURA DESANDE AUTOMOTIVO.wav',
  
  // Número de requisições simultâneas
  totalRequests: 50
};

// ============= FUNÇÕES =============

/**
 * Envia uma requisição de análise
 */
async function sendAnalysisRequest(index) {
  const startTime = Date.now();
  
  try {
    // Ler o arquivo de áudio
    const audioBuffer = fs.readFileSync(CONFIG.audioFilePath);
    const boundary = `----WebKitFormBoundary${Date.now()}${Math.random().toString(36).substring(2)}`;
    
    // Construir corpo multipart/form-data manualmente
    const parts = [];
    
    // Adicionar o campo 'audio' com o arquivo
    parts.push(`--${boundary}\r\n`);
    parts.push('Content-Disposition: form-data; name="audio"; filename="audio.wav"\r\n');
    parts.push('Content-Type: audio/wav\r\n\r\n');
    parts.push(audioBuffer);
    parts.push('\r\n');
    parts.push(`--${boundary}--\r\n`);
    
    // Concatenar todas as partes
    const bodyBuffer = Buffer.concat([
      Buffer.from(parts[0]),
      Buffer.from(parts[1]),
      Buffer.from(parts[2]),
      parts[3],
      Buffer.from(parts[4]),
      Buffer.from(parts[5])
    ]);
    
    // Fazer a requisição
    const response = await new Promise((resolve, reject) => {
      const url = new URL(CONFIG.apiUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.firebaseToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuffer.length
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            data: data
          });
        });
      });
      
      req.on('error', reject);
      req.write(bodyBuffer);
      req.end();
    });
    
    const duration = Date.now() - startTime;
    
    return {
      index,
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      duration,
      error: null
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      index,
      success: false,
      status: 0,
      duration,
      error: error.message
    };
  }
}

/**
 * Executa o teste de estresse
 */
async function runStressTest() {
  console.log('='.repeat(60));
  console.log('🔥 STRESS TEST - ANÁLISE DE ÁUDIO');
  console.log('='.repeat(60));
  console.log(`API: ${CONFIG.apiUrl}`);
  console.log(`Arquivo: ${CONFIG.audioFilePath}`);
  console.log(`Total de requisições: ${CONFIG.totalRequests}`);
  console.log('='.repeat(60));
  console.log('');
  
  // Validar configuração
  if (!fs.existsSync(CONFIG.audioFilePath)) {
    console.error(`❌ ERRO: Arquivo de áudio não encontrado: ${CONFIG.audioFilePath}`);
    console.error('   Verifique o caminho no script.');
    process.exit(1);
  }
  
  if (CONFIG.firebaseToken === 'SEU_FIREBASE_TOKEN_AQUI' || !CONFIG.firebaseToken) {
    console.error('❌ ERRO: Configure o Firebase Token no script');
    console.error('   Cole seu token na constante firebaseToken no topo do arquivo.');
    process.exit(1);
  }
  
  // Validar tamanho do arquivo
  const stats = fs.statSync(CONFIG.audioFilePath);
  const fileSizeMB = stats.size / (1024 * 1024);
  console.log(`📁 Tamanho do arquivo: ${fileSizeMB.toFixed(2)} MB`);
  
  if (fileSizeMB > 100) {
    console.warn('⚠️  AVISO: Arquivo grande pode causar timeout nas requisições.');
  }
  
  console.log('🚀 Disparando requisições...\n');
  
  const startTime = Date.now();
  
  // Criar array de promises
  const promises = [];
  for (let i = 1; i <= CONFIG.totalRequests; i++) {
    promises.push(sendAnalysisRequest(i));
  }
  
  // Disparar todas simultaneamente
  const results = await Promise.allSettled(promises);
  
  const totalDuration = Date.now() - startTime;
  
  // Processar resultados
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTADOS INDIVIDUAIS');
  console.log('='.repeat(60) + '\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      const data = result.value;
      const icon = data.success ? '✅' : '❌';
      const status = data.success ? 'SUCESSO' : 'ERRO';
      
      console.log(`${icon} [${data.index}/${CONFIG.totalRequests}] ${status} - Status: ${data.status} - Tempo: ${data.duration}ms`);
      
      if (data.error) {
        console.log(`   └─ Erro: ${data.error}`);
      }
      
      if (data.success) {
        successCount++;
      } else {
        errorCount++;
      }
    } else {
      console.log(`❌ [${idx + 1}/${CONFIG.totalRequests}] ERRO - ${result.reason}`);
      errorCount++;
    }
  });
  
  // Calcular estatísticas de tempo
  const successfulResults = results
    .filter(r => r.status === 'fulfilled' && r.value.success)
    .map(r => r.value.duration);
  
  const avgDuration = successfulResults.length > 0
    ? successfulResults.reduce((a, b) => a + b, 0) / successfulResults.length
    : 0;
  
  const minDuration = successfulResults.length > 0
    ? Math.min(...successfulResults)
    : 0;
  
  const maxDuration = successfulResults.length > 0
    ? Math.max(...successfulResults)
    : 0;
  
  // Resumo final
  console.log('\n' + '='.repeat(60));
  console.log('📈 RESUMO FINAL');
  console.log('='.repeat(60));
  console.log(`Total disparadas:     ${CONFIG.totalRequests}`);
  console.log(`✅ Sucesso:           ${successCount} (${(successCount/CONFIG.totalRequests*100).toFixed(1)}%)`);
  console.log(`❌ Erro:              ${errorCount} (${(errorCount/CONFIG.totalRequests*100).toFixed(1)}%)`);
  console.log(`⏱️  Tempo total:       ${(totalDuration/1000).toFixed(2)}s`);
  console.log(`⚡ Tempo médio:       ${avgDuration.toFixed(0)}ms`);
  console.log(`⚡ Tempo mínimo:      ${minDuration.toFixed(0)}ms`);
  console.log(`⚡ Tempo máximo:      ${maxDuration.toFixed(0)}ms`);
  console.log('='.repeat(60));
  
  // Status final
  if (successCount === CONFIG.totalRequests) {
    console.log('\n🎉 TESTE PASSOU! Todas as requisições foram bem-sucedidas.');
    console.log('   O backend está lidando corretamente com 50 análises simultâneas.');
  } else if (successCount > 0) {
    console.log(`\n⚠️  TESTE PARCIAL: ${successCount} sucesso, ${errorCount} falhas.`);
    console.log('   Revise os logs acima para identificar os erros.');
  } else {
    console.log('\n💥 TESTE FALHOU! Todas as requisições falharam.');
    console.log('   Verifique: token, endpoint, conectividade, backend em produção.');
  }
}

// ============= EXECUÇÃO =============

runStressTest().catch(error => {
  console.error('\n💥 ERRO FATAL:', error);
  process.exit(1);
});
