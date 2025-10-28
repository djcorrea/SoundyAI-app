/**
 * 🧪 TESTE DE VALIDAÇÃO: API analyze.js corrigida
 * Verifica se a implementação segue exatamente as regras especificadas
 */

import "dotenv/config";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 [TESTE] Validando correções na API analyze.js...\n');

async function validateCorrections() {
  try {
    const filePath = path.join(__dirname, 'work', 'api', 'audio', 'analyze.js');
    const content = fs.readFileSync(filePath, 'utf8');
    
    console.log('📋 [TESTE] 1. Verificando imports obrigatórios...');
    
    // ✅ Verificar imports corretos
    const hasCorrectImports = content.includes("import { getAudioQueue, getQueueReadyPromise } from '../../lib/queue.js'");
    console.log(`✅ [TESTE] Imports corretos: ${hasCorrectImports ? 'SIM' : 'NÃO'}`);
    
    console.log('\n📋 [TESTE] 2. Verificando inicialização global...');
    
    // ✅ Verificar inicialização global
    const hasQueueReady = content.includes('let queueReady = false;');
    const hasQueueInit = content.includes('const queueInit = (async () => {');
    const hasAwaitPromise = content.includes('await getQueueReadyPromise();');
    const hasSetReady = content.includes('queueReady = true;');
    
    console.log(`✅ [TESTE] let queueReady = false: ${hasQueueReady ? 'SIM' : 'NÃO'}`);
    console.log(`✅ [TESTE] const queueInit assíncrono: ${hasQueueInit ? 'SIM' : 'NÃO'}`);
    console.log(`✅ [TESTE] await getQueueReadyPromise(): ${hasAwaitPromise ? 'SIM' : 'NÃO'}`);
    console.log(`✅ [TESTE] queueReady = true: ${hasSetReady ? 'SIM' : 'NÃO'}`);
    
    console.log('\n📋 [TESTE] 3. Verificando handler da rota...');
    
    // ✅ Verificar verificação obrigatória
    const hasQueueCheck = content.includes('if (!queueReady)');
    const hasAwaitInit = content.includes('await queueInit;');
    const hasGetQueue = content.includes('const queue = getAudioQueue();');
    
    console.log(`✅ [TESTE] Verificação if (!queueReady): ${hasQueueCheck ? 'SIM' : 'NÃO'}`);
    console.log(`✅ [TESTE] await queueInit: ${hasAwaitInit ? 'SIM' : 'NÃO'}`);
    console.log(`✅ [TESTE] const queue = getAudioQueue(): ${hasGetQueue ? 'SIM' : 'NÃO'}`);
    
    console.log('\n📋 [TESTE] 4. Verificando logs de diagnóstico...');
    
    // ✅ Verificar logs obrigatórios
    const hasRouteLog = content.includes("console.log('🚀 [API] /analyze chamada');");
    const hasWaitLog = content.includes("console.log('⏳ [API] Aguardando fila inicializar...');");
    const hasEnqueueLog = content.includes("console.log('📩 [API] Enfileirando job...');");
    const hasSuccessLog = content.includes("console.log(`✅ [API] Job enfileirado com sucesso: ${redisJob.id}`);");
    
    console.log(`✅ [TESTE] Log rota chamada: ${hasRouteLog ? 'SIM' : 'NÃO'}`);
    console.log(`✅ [TESTE] Log aguardando fila: ${hasWaitLog ? 'SIM' : 'NÃO'}`);
    console.log(`✅ [TESTE] Log enfileirando: ${hasEnqueueLog ? 'SIM' : 'NÃO'}`);
    console.log(`✅ [TESTE] Log sucesso: ${hasSuccessLog ? 'SIM' : 'NÃO'}`);
    
    console.log('\n📋 [TESTE] 5. Verificando tratamento de erro...');
    
    // ✅ Verificar try/catch com status 500
    const hasTryCatch = content.includes('} catch (error) {');
    const hasErrorLog = content.includes("console.error('❌ [API] Erro na rota /analyze:', error.message);");
    const hasStatus500 = content.includes('res.status(500).json({');
    
    console.log(`✅ [TESTE] Try/catch presente: ${hasTryCatch ? 'SIM' : 'NÃO'}`);
    console.log(`✅ [TESTE] Log de erro: ${hasErrorLog ? 'SIM' : 'NÃO'}`);
    console.log(`✅ [TESTE] Status 500: ${hasStatus500 ? 'SIM' : 'NÃO'}`);
    
    console.log('\n📋 [TESTE] 6. Verificando preservação de funcionalidades...');
    
    // ✅ Verificar funcionalidades preservadas
    const hasFileKeyValidation = content.includes('if (!fileKey)');
    const hasFileTypeValidation = content.includes('validateFileType(fileKey)');
    const hasModeValidation = content.includes('if (!["genre", "reference"].includes(mode))');
    
    console.log(`✅ [TESTE] Validação fileKey: ${hasFileKeyValidation ? 'SIM' : 'NÃO'}`);
    console.log(`✅ [TESTE] Validação tipo arquivo: ${hasFileTypeValidation ? 'SIM' : 'NÃO'}`);
    console.log(`✅ [TESTE] Validação modo: ${hasModeValidation ? 'SIM' : 'NÃO'}`);
    
    // ✅ Calcular score
    const checks = [
      hasCorrectImports, hasQueueReady, hasQueueInit, hasAwaitPromise, hasSetReady,
      hasQueueCheck, hasAwaitInit, hasGetQueue, hasRouteLog, hasWaitLog,
      hasEnqueueLog, hasSuccessLog, hasTryCatch, hasErrorLog, hasStatus500,
      hasFileKeyValidation, hasFileTypeValidation, hasModeValidation
    ];
    
    const passed = checks.filter(Boolean).length;
    const total = checks.length;
    const score = Math.round((passed / total) * 100);
    
    console.log(`\n🎯 [TESTE] RESULTADO FINAL:`);
    console.log(`📊 [TESTE] Verificações passadas: ${passed}/${total}`);
    console.log(`🏆 [TESTE] Score: ${score}%`);
    
    if (score === 100) {
      console.log(`✅ [TESTE] PERFEITO! Todas as regras foram implementadas corretamente.`);
      console.log(`🚀 [TESTE] A API está pronta para eliminar travamentos em "aguardando processamento".`);
    } else if (score >= 90) {
      console.log(`✅ [TESTE] MUITO BOM! A maioria das regras foi implementada.`);
    } else {
      console.log(`⚠️ [TESTE] ATENÇÃO! Algumas regras importantes ainda precisam ser implementadas.`);
    }
    
    console.log(`\n🧪 [TESTE] EXEMPLO DE LOG ESPERADO:`);
    console.log(`🚀 [API] /analyze chamada`);
    console.log(`⏳ [API] Aguardando fila inicializar...`);
    console.log(`📩 [API] Enfileirando job...`);
    console.log(`✅ [API] Job enfileirado com sucesso: audio-xxx`);
    
  } catch (error) {
    console.error('💥 [TESTE] Erro ao validar:', error.message);
  }
}

// Executar validação
validateCorrections()
  .then(() => {
    console.log('\n🏁 [TESTE] Validação concluída!');
  })
  .catch((error) => {
    console.error('💥 [TESTE] Falha na validação:', error.message);
  });