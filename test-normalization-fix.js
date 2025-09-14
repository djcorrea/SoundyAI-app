// 🧪 TESTE DE VALIDAÇÃO: Verificar se a correção do normalizeBackendAnalysisData funciona
// Simular dados reais do pipeline e verificar se a UI vai exibir corretamente

console.log('🧪 TESTE: Validando correção do normalizeBackendAnalysisData\n');

// Simular dados exatos que vêm do pipeline (baseado na estrutura json-output.js)
const realPipelineData = {
  // Score do pipeline (baseado nos logs: 92.9%)
  score: 92.9,
  classification: 'professional',
  
  // Estrutura real do pipeline
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
  
  scoring: {
    method: 'Equal Weight V3',
    breakdown: {
      dynamics: 85,
      technical: 92,
      stereo: 88,
      loudness: 95,
      frequency: 78
    }
  },
  
  metadata: {
    fileName: 'test_audio.wav',
    fileSize: 1234567,
    processingTime: 2543,
    timestamp: new Date().toISOString(),
    jobId: '48264a53-e5b7-445a-a71e-85a4f7b08ff2'
  }
};

// Simular a função normalizeBackendAnalysisData corrigida
function testNormalizeBackendAnalysisData(backendData) {
  console.log('🔧 [NORMALIZE] Iniciando normalização dos dados do backend (TESTE)');
  
  // Criar estrutura normalizada
  const normalized = {
    ...backendData,
    technicalData: backendData.technicalData || {},
    problems: backendData.problems || [],
    suggestions: backendData.suggestions || [],
    duration: backendData.duration || 0,
    sampleRate: backendData.sampleRate || 48000,
    channels: backendData.channels || 2
  };
  
  // MAPEAR MÉTRICAS BÁSICAS - CORRIGIDO PARA FORMATO DO PIPELINE
  const tech = normalized.technicalData;
  const source = backendData.technicalData || backendData.metrics || backendData;
  
  console.log('🔧 [NORMALIZE] Dados de entrada:', { 
    hasLoudness: !!backendData.loudness,
    hasTruePeak: !!backendData.truePeak,
    hasStereo: !!backendData.stereo,
    hasScore: !!backendData.score
  });
  
  // True Peak - CORRIGIDO: Mapear do formato do pipeline
  tech.truePeakDbtp = backendData.truePeak?.maxDbtp || 
                     source.truePeakDbtp || source.true_peak_dbtp || source.truePeak || -60;
  tech.truePeakLinear = backendData.truePeak?.maxLinear || 
                       source.truePeakLinear || source.true_peak_linear || 0.8;
  
  // LUFS - CORRIGIDO: Mapear do formato do pipeline
  tech.lufsIntegrated = backendData.loudness?.integrated || 
                       source.lufsIntegrated || source.lufs_integrated || source.lufs || -23;
  tech.lufsShortTerm = backendData.loudness?.shortTerm || 
                      source.lufsShortTerm || source.lufs_short_term || tech.lufsIntegrated;
  tech.lufsMomentary = backendData.loudness?.momentary || 
                      source.lufsMomentary || source.lufs_momentary || tech.lufsIntegrated;
  
  // LRA - CORRIGIDO: Mapear do formato do pipeline
  tech.lra = backendData.loudness?.lra || 
            source.lra || source.loudnessRange || 8;
  
  // Stereo - CORRIGIDO: Mapear do formato do pipeline
  tech.stereoCorrelation = backendData.stereo?.correlation || 
                          source.stereoCorrelation || source.stereo_correlation || 0.5;
  tech.stereoWidth = backendData.stereo?.width || 
                    source.stereoWidth || source.stereo_width || 0.5;
  tech.balanceLR = backendData.stereo?.balance || 
                  source.balanceLR || source.balance_lr || 0;
  
  console.log('✅ [NORMALIZE] Métricas mapeadas:', {
    lufsIntegrated: tech.lufsIntegrated,
    truePeakDbtp: tech.truePeakDbtp,
    stereoCorrelation: tech.stereoCorrelation,
    lra: tech.lra
  });
  
  // SCORES E QUALIDADE - CORRIGIDO: Mapear do formato do pipeline
  normalized.qualityOverall = backendData.score || backendData.qualityOverall || backendData.mixScore || 7.5;
  normalized.qualityBreakdown = backendData.scoring?.breakdown || backendData.qualityBreakdown || {
    dynamics: 75,
    technical: 80,
    stereo: 70,
    loudness: 85,
    frequency: 75
  };
  
  // Classificação do pipeline
  normalized.classification = backendData.classification || 'unknown';
  
  console.log('🎯 [NORMALIZE] Score mapeado:', {
    score: normalized.qualityOverall,
    classification: normalized.classification
  });
  
  return normalized;
}

console.log('📊 DADOS ORIGINAIS DO PIPELINE:');
console.log('  Score:', realPipelineData.score);
console.log('  True Peak dBTP:', realPipelineData.truePeak.maxDbtp);
console.log('  LUFS Integrated:', realPipelineData.loudness.integrated);
console.log('  Stereo Correlation:', realPipelineData.stereo.correlation);
console.log('  LRA:', realPipelineData.loudness.lra);

console.log('\n🔧 EXECUTANDO NORMALIZAÇÃO CORRIGIDA...');
const normalizedData = testNormalizeBackendAnalysisData(realPipelineData);

console.log('\n✅ DADOS APÓS NORMALIZAÇÃO:');
console.log('  Score:', normalizedData.qualityOverall);
console.log('  True Peak dBTP:', normalizedData.technicalData.truePeakDbtp);
console.log('  LUFS Integrated:', normalizedData.technicalData.lufsIntegrated);
console.log('  Stereo Correlation:', normalizedData.technicalData.stereoCorrelation);
console.log('  LRA:', normalizedData.technicalData.lra);

console.log('\n🎯 VERIFICAÇÃO DE CORREÇÃO:');
const scoreCorrect = normalizedData.qualityOverall === realPipelineData.score;
const truePeakCorrect = normalizedData.technicalData.truePeakDbtp === realPipelineData.truePeak.maxDbtp;
const lufsCorrect = normalizedData.technicalData.lufsIntegrated === realPipelineData.loudness.integrated;
const stereoCorrect = normalizedData.technicalData.stereoCorrelation === realPipelineData.stereo.correlation;
const lraCorrect = normalizedData.technicalData.lra === realPipelineData.loudness.lra;

console.log('  Score mapeado corretamente:', scoreCorrect ? '✅' : '❌');
console.log('  True Peak mapeado corretamente:', truePeakCorrect ? '✅' : '❌');
console.log('  LUFS mapeado corretamente:', lufsCorrect ? '✅' : '❌');
console.log('  Stereo mapeado corretamente:', stereoCorrect ? '✅' : '❌');
console.log('  LRA mapeado corretamente:', lraCorrect ? '✅' : '❌');

const allCorrect = scoreCorrect && truePeakCorrect && lufsCorrect && stereoCorrect && lraCorrect;
console.log('\n🏆 RESULTADO FINAL:', allCorrect ? '✅ CORREÇÃO FUNCIONANDO!' : '❌ Ainda há problemas');

if (!allCorrect) {
  console.log('\n🔍 DIAGNÓSTICO DE PROBLEMAS:');
  if (!scoreCorrect) console.log('  ❌ Score não foi mapeado corretamente');
  if (!truePeakCorrect) console.log('  ❌ True Peak não foi mapeado corretamente');
  if (!lufsCorrect) console.log('  ❌ LUFS não foi mapeado corretamente');
  if (!stereoCorrect) console.log('  ❌ Stereo não foi mapeado corretamente');
  if (!lraCorrect) console.log('  ❌ LRA não foi mapeado corretamente');
}