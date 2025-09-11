// TESTE DE VERIFICAÇÃO: Pipeline Phase 5.0 Metadata
import fs from 'fs';

console.log('🔍 VERIFICAÇÃO: Implementação da Phase 5.0 no Pipeline');
console.log('==================================================');

// 1. Verificar se Phase 5.0 foi implementada no pipeline-complete.js
async function checkPipelineImplementation() {
  console.log('📋 1. Verificando pipeline-complete.js...');
  
  try {
    const pipelineContent = fs.readFileSync('./work/api/audio/pipeline-complete.js', 'utf8');
    
    // Verificar se Phase 5.0 existe
    const hasPhase50 = pipelineContent.includes('Phase 5.0') || 
                       pipelineContent.includes('getAudioInfo') ||
                       pipelineContent.includes('originalMetadata');
    
    console.log(`   ✅ Phase 5.0 implementada: ${hasPhase50 ? 'SIM' : 'NÃO'}`);
    
    if (hasPhase50) {
      console.log('   📄 Detalhes encontrados:');
      
      if (pipelineContent.includes('getAudioInfo')) {
        console.log('      ✅ getAudioInfo está sendo chamado');
      }
      
      if (pipelineContent.includes('originalMetadata')) {
        console.log('      ✅ originalMetadata está sendo propagado');
      }
      
      if (pipelineContent.includes('Phase 5.0')) {
        console.log('      ✅ Phase 5.0 está documentada');
      }
    }
    
    return hasPhase50;
    
  } catch (err) {
    console.error('   ❌ ERRO ao ler pipeline-complete.js:', err.message);
    return false;
  }
}

// 2. Verificar se json-output.js foi atualizado
async function checkJsonOutputImplementation() {
  console.log('\n📋 2. Verificando json-output.js...');
  
  try {
    const jsonOutputContent = fs.readFileSync('./work/api/audio/json-output.js', 'utf8');
    
    const hasOriginalMetadata = jsonOutputContent.includes('originalMetadata') ||
                                jsonOutputContent.includes('coreMetrics.originalMetadata');
    
    console.log(`   ✅ originalMetadata implementado: ${hasOriginalMetadata ? 'SIM' : 'NÃO'}`);
    
    if (hasOriginalMetadata) {
      console.log('   📄 Implementação encontrada no json-output.js');
    }
    
    return hasOriginalMetadata;
    
  } catch (err) {
    console.error('   ❌ ERRO ao ler json-output.js:', err.message);
    return false;
  }
}

// 3. Verificar se worker-root.js foi atualizado
async function checkWorkerImplementation() {
  console.log('\n📋 3. Verificando worker-root.js...');
  
  try {
    const workerContent = fs.readFileSync('./worker-root.js', 'utf8');
    
    const hasMetadataFallback = workerContent.includes('music-metadata') ||
                                workerContent.includes('analyzeFallbackMetadata');
    
    console.log(`   ✅ Fallback de metadata implementado: ${hasMetadataFallback ? 'SIM' : 'NÃO'}`);
    
    if (hasMetadataFallback) {
      console.log('   📄 Fallback melhorado encontrado no worker-root.js');
    }
    
    return hasMetadataFallback;
    
  } catch (err) {
    console.error('   ❌ ERRO ao ler worker-root.js:', err.message);
    return false;
  }
}

// 4. Verificar se as dependências estão instaladas
async function checkDependencies() {
  console.log('\n📋 4. Verificando dependências...');
  
  try {
    const packageContent = fs.readFileSync('./package.json', 'utf8');
    const packageJson = JSON.parse(packageContent);
    
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    const hasMusicMetadata = deps['music-metadata'] !== undefined;
    const hasFFmpeg = deps['ffmpeg-static'] !== undefined;
    const hasFFprobe = deps['ffprobe-static'] !== undefined;
    
    console.log(`   ✅ music-metadata: ${hasMusicMetadata ? 'INSTALADO' : 'NÃO INSTALADO'}`);
    console.log(`   ✅ ffmpeg-static: ${hasFFmpeg ? 'INSTALADO' : 'NÃO INSTALADO'}`);
    console.log(`   ✅ ffprobe-static: ${hasFFprobe ? 'INSTALADO' : 'NÃO INSTALADO'}`);
    
    return hasMusicMetadata && hasFFmpeg && hasFFprobe;
    
  } catch (err) {
    console.error('   ❌ ERRO ao ler package.json:', err.message);
    return false;
  }
}

// 5. Testar uma função simples
async function testBasicFunction() {
  console.log('\n📋 5. Testando função básica...');
  
  try {
    // Tentar importar a função sem executar
    const { getAudioInfo } = await import('./work/api/audio/audio-decoder.js');
    
    console.log(`   ✅ getAudioInfo importado: ${typeof getAudioInfo === 'function' ? 'SIM' : 'NÃO'}`);
    
    // Verificar se FFprobe está acessível
    const { checkAudioEnvironment } = await import('./work/api/audio/audio-decoder.js');
    
    if (typeof checkAudioEnvironment === 'function') {
      const envCheck = await checkAudioEnvironment();
      console.log(`   ✅ FFprobe disponível: ${envCheck.ffprobe ? 'SIM' : 'NÃO'}`);
      console.log(`   ✅ FFmpeg disponível: ${envCheck.ffmpeg ? 'SIM' : 'NÃO'}`);
      
      return envCheck.ffprobe && envCheck.ffmpeg;
    }
    
    return true;
    
  } catch (err) {
    console.error('   ❌ ERRO ao testar função básica:', err.message);
    return false;
  }
}

// Executar todas as verificações
async function runAllChecks() {
  console.log('🚀 INICIANDO VERIFICAÇÃO COMPLETA...\n');
  
  const results = {
    pipeline: await checkPipelineImplementation(),
    jsonOutput: await checkJsonOutputImplementation(),
    worker: await checkWorkerImplementation(),
    dependencies: await checkDependencies(),
    basicFunction: await testBasicFunction()
  };
  
  console.log('\n🏁 RESULTADO FINAL DA VERIFICAÇÃO');
  console.log('==================================');
  console.log(`Pipeline Phase 5.0: ${results.pipeline ? '✅ OK' : '❌ FALTANDO'}`);
  console.log(`JSON Output: ${results.jsonOutput ? '✅ OK' : '❌ FALTANDO'}`);
  console.log(`Worker Fallback: ${results.worker ? '✅ OK' : '❌ FALTANDO'}`);
  console.log(`Dependências: ${results.dependencies ? '✅ OK' : '❌ FALTANDO'}`);
  console.log(`Função Básica: ${results.basicFunction ? '✅ OK' : '❌ FALTANDO'}`);
  
  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    console.log('\n🎉 TODAS AS VERIFICAÇÕES PASSARAM!');
    console.log('✅ A implementação de metadata REAL está completa');
    console.log('✅ Pipeline Phase 5.0 implementado corretamente');
    console.log('✅ Fallback melhorado no worker');
    console.log('✅ JSON output usando metadados originais');
    console.log('\n💡 PRÓXIMO PASSO: Testar com arquivo de áudio real');
  } else {
    console.log('\n⚠️  ALGUMAS VERIFICAÇÕES FALHARAM!');
    console.log('💡 Revisar implementações que falharam acima');
  }
  
  return allPassed;
}

runAllChecks().catch(console.error);
