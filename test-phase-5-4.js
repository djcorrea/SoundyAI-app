// 🧪 TESTE ESPECÍFICO FASE 5.4 - JSON OUTPUT + SCORING
// Valida se o scoring Equal Weight V3 está funcionando corretamente

import { processAudioComplete, calculateAudioScore, validatePipeline } from "./api/audio/pipeline-complete.js";
import fs from "fs";
import path from "path";

console.log('🧪 Teste da Fase 5.4 - JSON Output + Scoring iniciado');

async function testPhase54() {
  console.log('\n📊 TESTE 1: Validação do Pipeline Completo');
  
  // Teste básico de validação
  const isValid = await validatePipeline();
  console.log(`✅ Pipeline válido: ${isValid ? 'SIM' : 'NÃO'}`);
  
  if (!isValid) {
    console.error('❌ Pipeline inválido, abortando testes');
    return;
  }

  console.log('\n🎵 TESTE 2: Arquivo Real - Música');
  
  try {
    const testFile = path.join(process.cwd(), 'tests', 'musica.flac');
    
    if (!fs.existsSync(testFile)) {
      console.log('⚠️ Arquivo de teste não encontrado, usando arquivo alternativo');
      // Procurar qualquer arquivo de áudio
      const testDir = path.join(process.cwd(), 'tests');
      const files = fs.readdirSync(testDir).filter(f => f.endsWith('.wav') || f.endsWith('.flac'));
      
      if (files.length === 0) {
        console.error('❌ Nenhum arquivo de teste encontrado');
        return;
      }
      
      console.log(`📁 Usando arquivo: ${files[0]}`);
      await testAudioFile(path.join(testDir, files[0]));
    } else {
      await testAudioFile(testFile);
    }

  } catch (error) {
    console.error('❌ Erro no teste de arquivo real:', error);
  }

  console.log('\n🔬 TESTE 3: Validação Específica do Scoring');
  await testScoringValidation();

  console.log('\n📊 TESTE 4: Performance e Tempo');
  await testPerformance();

  console.log('\n✅ Todos os testes da Fase 5.4 concluídos');
}

async function testAudioFile(filePath) {
  console.log(`🎵 Testando arquivo: ${path.basename(filePath)}`);
  
  const startTime = Date.now();
  const fileBuffer = fs.readFileSync(filePath);
  
  // Teste pipeline completo
  const result = await processAudioComplete(fileBuffer, path.basename(filePath));
  const totalTime = Date.now() - startTime;
  
  console.log('📊 RESULTADOS:');
  console.log(`  Score: ${result.score}% (${result.classification})`);
  console.log(`  Método: ${result.scoringMethod}`);
  console.log(`  LUFS: ${result.technicalData.lufsIntegrated?.toFixed(2)} LUFS`);
  console.log(`  True Peak: ${result.technicalData.truePeakDbtp?.toFixed(2)} dBTP`);
  console.log(`  Correlação: ${result.technicalData.stereoCorrelation?.toFixed(3)}`);
  console.log(`  Bandas FFT: ${Object.keys(result.technicalData.frequencyBands || {}).length}`);
  console.log(`  Tempo total: ${totalTime}ms`);
  console.log(`  Status: ${result.status}`);
  console.log(`  Warnings: ${result.warnings?.length || 0}`);

  // Validações críticas
  const validations = [
    { name: 'Score válido', pass: Number.isFinite(result.score) && result.score >= 0 && result.score <= 100 },
    { name: 'Classificação presente', pass: !!result.classification && result.classification !== 'undefined' },
    { name: 'Método Equal Weight V3', pass: result.scoringMethod === 'equal_weight_v3' || result.scoringMethod.includes('fallback') },
    { name: 'LUFS finito', pass: Number.isFinite(result.technicalData.lufsIntegrated) },
    { name: 'True Peak finito', pass: Number.isFinite(result.technicalData.truePeakDbtp) },
    { name: 'Correlação finita', pass: Number.isFinite(result.technicalData.stereoCorrelation) },
    { name: 'JSON serializável', pass: !!JSON.stringify(result) },
    { name: 'Status success', pass: result.status === 'success' },
    { name: 'Metadados completos', pass: !!result.metadata && !!result.metadata.fileName },
    { name: 'Technical data completo', pass: !!result.technicalData && Object.keys(result.technicalData).length > 5 }
  ];

  const passed = validations.filter(v => v.pass).length;
  const total = validations.length;
  
  console.log(`\n🎯 VALIDAÇÕES: ${passed}/${total} (${(passed/total*100).toFixed(1)}%)`);
  
  validations.forEach(v => {
    console.log(`  ${v.pass ? '✅' : '❌'} ${v.name}`);
  });

  if (passed === total) {
    console.log('🎉 ARQUIVO PASSOU EM TODOS OS TESTES!');
  } else {
    console.log(`⚠️ ${total - passed} validações falharam`);
  }

  // Salvar resultado para análise
  const outputPath = path.join(process.cwd(), 'tests', `${path.basename(filePath)}.phase54.json`);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`💾 Resultado salvo em: ${path.basename(outputPath)}`);

  return { passed, total, result };
}

async function testScoringValidation() {
  console.log('🔬 Validando precisão do scoring...');
  
  try {
    // Teste com arquivo conhecido
    const testFile = path.join(process.cwd(), 'tests', 'seno-1khz.wav');
    
    if (fs.existsSync(testFile)) {
      const fileBuffer = fs.readFileSync(testFile);
      
      // Calcular score 3 vezes para verificar consistência
      const scores = [];
      for (let i = 0; i < 3; i++) {
        const scoreResult = await calculateAudioScore(fileBuffer, 'seno-1khz.wav');
        scores.push(scoreResult.score);
        console.log(`  Execução ${i + 1}: ${scoreResult.score}% (${scoreResult.classification})`);
      }
      
      // Verificar consistência
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      const variation = maxScore - minScore;
      
      console.log(`📊 Variação entre execuções: ${variation.toFixed(2)}%`);
      
      if (variation < 0.1) {
        console.log('✅ Scoring consistente (variação < 0.1%)');
      } else if (variation < 1.0) {
        console.log('⚠️ Scoring moderadamente consistente (variação < 1.0%)');
      } else {
        console.log('❌ Scoring inconsistente (variação >= 1.0%)');
      }
      
    } else {
      console.log('⚠️ Arquivo de teste seno-1khz.wav não encontrado, pulando teste de consistência');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste de scoring:', error);
  }
}

async function testPerformance() {
  console.log('⚡ Testando performance...');
  
  try {
    // Procurar arquivo menor para teste de performance
    const testDir = path.join(process.cwd(), 'tests');
    const files = fs.readdirSync(testDir).filter(f => f.endsWith('.wav') || f.endsWith('.flac'));
    
    if (files.length === 0) {
      console.log('⚠️ Nenhum arquivo encontrado para teste de performance');
      return;
    }
    
    // Usar o primeiro arquivo encontrado
    const testFile = path.join(testDir, files[0]);
    const fileBuffer = fs.readFileSync(testFile);
    const fileSize = fileBuffer.length;
    
    console.log(`📁 Arquivo teste: ${files[0]} (${(fileSize/1024/1024).toFixed(2)}MB)`);
    
    // Executar 3 vezes e medir performance
    const times = [];
    for (let i = 0; i < 3; i++) {
      const startTime = Date.now();
      const result = await processAudioComplete(fileBuffer, files[0]);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      times.push(processingTime);
      
      console.log(`  Execução ${i + 1}: ${processingTime}ms (${result.score}%)`);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log(`📊 Performance:`);
    console.log(`  Tempo médio: ${avgTime.toFixed(0)}ms`);
    console.log(`  Tempo mínimo: ${minTime}ms`);
    console.log(`  Tempo máximo: ${maxTime}ms`);
    console.log(`  MB/s: ${(fileSize/1024/1024/avgTime*1000).toFixed(2)}`);
    
    // Avaliar performance
    const mbPerSecond = fileSize/1024/1024/avgTime*1000;
    if (mbPerSecond > 10) {
      console.log('✅ Performance excelente (>10 MB/s)');
    } else if (mbPerSecond > 5) {
      console.log('✅ Performance boa (>5 MB/s)');
    } else if (mbPerSecond > 1) {
      console.log('⚠️ Performance moderada (>1 MB/s)');
    } else {
      console.log('❌ Performance baixa (<1 MB/s)');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste de performance:', error);
  }
}

// Executar testes
testPhase54().catch(error => {
  console.error('❌ Erro nos testes da Fase 5.4:', error);
  process.exit(1);
});
