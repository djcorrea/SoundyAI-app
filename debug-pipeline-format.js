// 🔍 SCRIPT DE DEBUG: Analisar formato de saída do pipeline
// Verificar se normalizeBackendAnalysisData está recebendo dados corretos

console.log('🔍 Simulando dados do pipeline vs dados esperados pelo frontend...\n');

// Dados que o pipeline produz (baseado nos logs)
const pipelineData = {
  // Score do pipeline
  score: 92.9,
  classification: 'professional',
  
  // Estrutura do pipeline (baseada em json-output.js)
  loudness: {
    integrated: -19.691307874020087,
    shortTerm: -19.2,
    momentary: -18.8,
    lra: 2.9058398666753575,
    unit: "LUFS"
  },
  
  truePeak: {
    maxDbtp: 11.33198327259689,
    maxLinear: 0.88542,
    unit: "dBTP"
  },
  
  stereo: {
    correlation: 0.817,
    balance: 0,
    width: 0.5,
    isMonoCompatible: false,
    hasPhaseIssues: false
  },
  
  metadata: {
    fileName: 'test_audio.wav',
    fileSize: 1234567,
    processingTime: 2543,
    timestamp: new Date().toISOString(),
    jobId: '48264a53-e5b7-445a-a71e-85a4f7b08ff2'
  }
};

// Dados que a UI está mostrando (inconsistentes)
const uiDisplayedData = {
  score: 99.9,
  truePeak: { maxDbtp: -1.1, maxLinear: 0.88 },
  loudness: { integrated: -17.2, lra: 4.9 },
  stereo: { correlation: 0.839 }
};

console.log('📊 DADOS DO PIPELINE (corretos):');
console.log('  Score:', pipelineData.score);
console.log('  True Peak dBTP:', pipelineData.truePeak.maxDbtp);
console.log('  LUFS Integrated:', pipelineData.loudness.integrated);
console.log('  Stereo Correlation:', pipelineData.stereo.correlation);

console.log('\n🖥️ DADOS EXIBIDOS NA UI (incorretos):');
console.log('  Score:', uiDisplayedData.score);
console.log('  True Peak dBTP:', uiDisplayedData.truePeak.maxDbtp);
console.log('  LUFS Integrated:', uiDisplayedData.loudness.integrated);
console.log('  Stereo Correlation:', uiDisplayedData.stereo.correlation);

console.log('\n🚨 DISCREPÂNCIAS IDENTIFICADAS:');
console.log('  Score:', `${pipelineData.score}% ➜ ${uiDisplayedData.score}% (diferença: ${(uiDisplayedData.score - pipelineData.score).toFixed(1)}%)`);
console.log('  True Peak:', `${pipelineData.truePeak.maxDbtp}dBTP ➜ ${uiDisplayedData.truePeak.maxDbtp}dBTP (diferença: ${(uiDisplayedData.truePeak.maxDbtp - pipelineData.truePeak.maxDbtp).toFixed(1)}dB)`);
console.log('  LUFS:', `${pipelineData.loudness.integrated.toFixed(1)}LUFS ➜ ${uiDisplayedData.loudness.integrated}LUFS (diferença: ${(uiDisplayedData.loudness.integrated - pipelineData.loudness.integrated).toFixed(1)}dB)`);
console.log('  Stereo:', `${pipelineData.stereo.correlation.toFixed(3)} ➜ ${uiDisplayedData.stereo.correlation} (diferença: ${(uiDisplayedData.stereo.correlation - pipelineData.stereo.correlation).toFixed(3)})`);

console.log('\n🔧 SIMULANDO normalizeBackendAnalysisData...');

// Simular o que acontece na função normalizeBackendAnalysisData
function simulateNormalization(backendData) {
  console.log('📥 Dados recebidos pelo normalizeBackendAnalysisData:', JSON.stringify(backendData, null, 2).substring(0, 300) + '...');
  
  // A função está procurando por estas chaves:
  const source = backendData.technicalData || backendData.metrics || backendData;
  
  console.log('\n🔍 Checando mapeamento de campos:');
  console.log('  source.peak:', source.peak || 'UNDEFINED');
  console.log('  source.peak_db:', source.peak_db || 'UNDEFINED'); 
  console.log('  source.peakLevel:', source.peakLevel || 'UNDEFINED');
  console.log('  source.lufsIntegrated:', source.lufsIntegrated || 'UNDEFINED');
  console.log('  source.lufs_integrated:', source.lufs_integrated || 'UNDEFINED');
  console.log('  source.lufs:', source.lufs || 'UNDEFINED');
  console.log('  source.stereoCorrelation:', source.stereoCorrelation || 'UNDEFINED');
  console.log('  source.stereo_correlation:', source.stereo_correlation || 'UNDEFINED');
  
  // Como está estruturado no pipeline, a função NÃO vai encontrar os dados!
  console.log('\n❌ PROBLEMA: normalizeBackendAnalysisData não encontra dados no formato correto!');
  console.log('   Os dados do pipeline estão em: backendData.loudness.integrated');
  console.log('   Mas a função procura em: source.lufsIntegrated ou source.lufs_integrated');
}

simulateNormalization(pipelineData);

console.log('\n💡 SOLUÇÃO NECESSÁRIA:');
console.log('1. Ajustar normalizeBackendAnalysisData para ler formato correto do pipeline');
console.log('2. OU ajustar json-output.js para usar nomes de campo compatíveis');
console.log('3. OU criar um adapter entre pipeline ➜ normalização');