// test-environment-import.js
// 🧪 TESTE: Verificar se o módulo environment.js pode ser carregado

console.log('🧪 [TEST] Iniciando teste de import do environment.js...');

try {
  // Simular import de diferentes locais
  console.log('📂 [TEST] Testando import de work/api/...');
  const { detectEnvironment, getCorsConfig, getAllowedOrigins } = await import('./work/config/environment.js');
  
  console.log('✅ [TEST] Import bem-sucedido!');
  
  // Testar funções
  const env = detectEnvironment();
  console.log('🌍 [TEST] Ambiente detectado:', env);
  
  const origins = getAllowedOrigins(env);
  console.log('🌐 [TEST] Origens permitidas:', origins.length, 'domínios');
  
  const corsConfig = getCorsConfig(env);
  console.log('⚙️ [TEST] CORS config gerado:', typeof corsConfig.origin === 'function' ? 'função dinâmica' : 'estático');
  
  console.log('✅ [TEST] Todos os testes passaram!');
  process.exit(0);
  
} catch (error) {
  console.error('❌ [TEST] FALHA no import:');
  console.error('   Erro:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
}
