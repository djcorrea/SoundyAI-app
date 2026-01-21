// test-userplans-import.js
// 🧪 TESTE: Verificar se userPlans.js consegue importar environment.js

console.log('🧪 [TEST] Testando import de userPlans.js...');

try {
  // Carregar .env primeiro (simular Railway)
  await import('dotenv/config');
  
  console.log('📂 [TEST] Importando work/lib/user/userPlans.js...');
  const userPlans = await import('./work/lib/user/userPlans.js');
  
  console.log('✅ [TEST] Import bem-sucedido!');
  console.log('📦 [TEST] Funções exportadas:', Object.keys(userPlans));
  
  console.log('✅ [TEST] userPlans.js carregou corretamente!');
  process.exit(0);
  
} catch (error) {
  console.error('❌ [TEST] FALHA no import de userPlans.js:');
  console.error('   Erro:', error.message);
  console.error('   Stack:', error.stack);
  
  if (error.code === 'ERR_MODULE_NOT_FOUND') {
    console.error('\n🔍 [DEBUG] Módulo não encontrado. Verifique:');
    console.error('   1. O arquivo existe?');
    console.error('   2. O caminho relativo está correto?');
    console.error('   3. A extensão .js está presente?');
  }
  
  process.exit(1);
}
