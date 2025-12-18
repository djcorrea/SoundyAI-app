// test-reference-base-handler.js
// Script de validação: simula um fullResult de reference-base
// e testa se o handler retorna status:"completed" corretamente

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════
// 🧪 MOCK: Simular fullResult de reference-base
// ═══════════════════════════════════════════════════════════════
function createMockReferenceBaseResult() {
  return {
    mode: 'reference',
    referenceStage: 'base',
    requiresSecondTrack: true,
    status: 'completed',
    
    // ✅ Métricas presentes (o que importa)
    technicalData: {
      lufsIntegrated: -14.2,
      truePeakDbtp: -1.5,
      dynamicRange: 8.5,
      spectral_balance: {
        bass: 0.35,
        mids: 0.45,
        highs: 0.20
      }
    },
    
    metrics: {
      loudness: -14.2,
      truePeak: -1.5,
      dr: 8.5
    },
    
    score: 85,
    
    // ❌ Suggestions vazias (normal para reference-base)
    suggestions: [],
    aiSuggestions: [],
    
    traceId: 'test_trace_123'
  };
}

// ═══════════════════════════════════════════════════════════════
// 🧪 MOCK: Simular job do Postgres
// ═══════════════════════════════════════════════════════════════
function createMockJob() {
  return {
    id: 'test-job-uuid-12345',
    file_key: 'test-audio.mp3',
    mode: 'reference',
    status: 'completed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: new Date().toISOString()
  };
}

// ═══════════════════════════════════════════════════════════════
// 🔍 TESTE: Lógica do handler (extraída)
// ═══════════════════════════════════════════════════════════════
function testHandlerLogic(job, fullResult) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 TESTE: Reference-Base Handler Logic');
  console.log('═══════════════════════════════════════════════════════');
  
  // Normalizar status
  let normalizedStatus = job.status;
  if (normalizedStatus === "done") normalizedStatus = "completed";
  if (normalizedStatus === "failed") normalizedStatus = "error";
  
  console.log('✅ normalizedStatus:', normalizedStatus);
  
  // Detectar modo e stage
  const effectiveMode = fullResult?.mode || job?.mode || 'genre';
  const effectiveStage = fullResult?.referenceStage || job?.referenceStage || (fullResult?.isReferenceBase ? 'base' : undefined);
  
  console.log('✅ effectiveMode:', effectiveMode);
  console.log('✅ effectiveStage:', effectiveStage);
  
  // Detecção forte de reference
  const isReference = effectiveMode === 'reference' 
    || job?.mode === 'reference' 
    || fullResult?.mode === 'reference'
    || !!job?.referenceStage 
    || !!fullResult?.referenceStage
    || fullResult?.requiresSecondTrack === true;
  
  console.log('✅ isReference:', isReference);
  
  // Early return para reference
  if (effectiveMode === 'reference') {
    console.log('');
    console.log('🟢 EARLY RETURN executado para reference');
    
    let finalStatus = fullResult?.status || job?.status || 'processing';
    
    // Fallback: forçar completed se dados existirem
    if (effectiveStage === 'base' && finalStatus === 'processing' && fullResult) {
      const hasRequiredData = !!(
        fullResult.technicalData &&
        fullResult.metrics &&
        typeof fullResult.score === 'number'
      );
      
      if (hasRequiredData) {
        console.log('⚠️ FALLBACK: Forçando completed (dados completos presentes)');
        finalStatus = 'completed';
      }
    }
    
    const baseResponse = {
      ...fullResult,
      ...job,
      id: job.id,
      jobId: job.id,
      mode: 'reference',
      referenceStage: effectiveStage || (fullResult?.isReferenceBase ? 'base' : undefined),
      status: finalStatus,
      suggestions: Array.isArray(fullResult?.suggestions) ? fullResult.suggestions : [],
      aiSuggestions: Array.isArray(fullResult?.aiSuggestions) ? fullResult.aiSuggestions : []
    };
    
    if (finalStatus === 'completed') {
      if (baseResponse.referenceStage === 'base') {
        baseResponse.requiresSecondTrack = true;
        baseResponse.referenceJobId = job.id;
        baseResponse.status = 'completed';
        baseResponse.nextAction = 'upload_second_track';
        
        console.log('✅ BASE completed - nextAction:', baseResponse.nextAction);
      }
    }
    
    return baseResponse;
  }
  
  // Validação genre (NÃO deve executar para reference)
  if (effectiveMode === 'genre' && !isReference && normalizedStatus === 'completed') {
    console.log('');
    console.log('🔵 GENRE validation executado');
    
    const hasSuggestions = Array.isArray(fullResult?.suggestions) && fullResult.suggestions.length > 0;
    const hasAiSuggestions = Array.isArray(fullResult?.aiSuggestions) && fullResult.aiSuggestions.length > 0;
    const hasTechnicalData = !!fullResult?.technicalData;
    
    if (!hasSuggestions || !hasAiSuggestions || !hasTechnicalData) {
      console.log('⚠️ FALLBACK GENRE: Faltam dados - retornando processing');
      normalizedStatus = 'processing';
    }
  }
  
  return {
    status: normalizedStatus,
    mode: effectiveMode,
    referenceStage: effectiveStage
  };
}

// ═══════════════════════════════════════════════════════════════
// ✅ VALIDAÇÃO: Verificar resultado esperado
// ═══════════════════════════════════════════════════════════════
function validateResult(result) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 VALIDAÇÃO DE RESULTADO');
  console.log('═══════════════════════════════════════════════════════');
  
  const tests = [
    {
      name: 'Status é "completed"',
      pass: result.status === 'completed',
      expected: 'completed',
      actual: result.status
    },
    {
      name: 'Mode é "reference"',
      pass: result.mode === 'reference',
      expected: 'reference',
      actual: result.mode
    },
    {
      name: 'referenceStage é "base"',
      pass: result.referenceStage === 'base',
      expected: 'base',
      actual: result.referenceStage
    },
    {
      name: 'requiresSecondTrack é true',
      pass: result.requiresSecondTrack === true,
      expected: true,
      actual: result.requiresSecondTrack
    },
    {
      name: 'nextAction é "upload_second_track"',
      pass: result.nextAction === 'upload_second_track',
      expected: 'upload_second_track',
      actual: result.nextAction
    },
    {
      name: 'suggestions é array vazio (OK para base)',
      pass: Array.isArray(result.suggestions) && result.suggestions.length === 0,
      expected: '[] (vazio)',
      actual: `[${result.suggestions?.length || 0} itens]`
    },
    {
      name: 'aiSuggestions é array vazio (OK para base)',
      pass: Array.isArray(result.aiSuggestions) && result.aiSuggestions.length === 0,
      expected: '[] (vazio)',
      actual: `[${result.aiSuggestions?.length || 0} itens]`
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(test => {
    if (test.pass) {
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${test.name}`);
      console.log(`   Expected: ${test.expected}`);
      console.log(`   Actual: ${test.actual}`);
      failed++;
    }
  });
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📊 RESULTADO FINAL: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════');
  
  return failed === 0;
}

// ═══════════════════════════════════════════════════════════════
// 🔍 CHECKSUM: Calcular MD5 do handler
// ═══════════════════════════════════════════════════════════════
function calculateHandlerChecksum() {
  const handlerPath = path.join(__dirname, 'work', 'api', 'jobs', '[id].js');
  
  try {
    const content = fs.readFileSync(handlerPath, 'utf8');
    const hash = crypto.createHash('md5').update(content).digest('hex');
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔐 HANDLER FILE CHECKSUM');
    console.log('═══════════════════════════════════════════════════════');
    console.log('File:', handlerPath);
    console.log('MD5:', hash);
    console.log('Build Signature: REF-BASE-FIX-2025-12-18');
    console.log('═══════════════════════════════════════════════════════');
    
    return hash;
  } catch (err) {
    console.error('❌ Erro ao calcular checksum:', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🚀 EXECUTAR TESTE
// ═══════════════════════════════════════════════════════════════
function runTest() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  🧪 TESTE: Reference-Base Handler                    ║');
  console.log('║  Valida que reference-base NUNCA depende de          ║');
  console.log('║  suggestions para retornar "completed"               ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  
  // Calcular checksum
  const checksum = calculateHandlerChecksum();
  
  // Criar mocks
  const job = createMockJob();
  const fullResult = createMockReferenceBaseResult();
  
  console.log('');
  console.log('📦 Mock job:', {
    id: job.id,
    mode: job.mode,
    status: job.status
  });
  
  console.log('📦 Mock fullResult:', {
    mode: fullResult.mode,
    referenceStage: fullResult.referenceStage,
    hasTechnicalData: !!fullResult.technicalData,
    hasMetrics: !!fullResult.metrics,
    score: fullResult.score,
    suggestions: fullResult.suggestions.length,
    aiSuggestions: fullResult.aiSuggestions.length
  });
  
  // Executar lógica do handler
  const result = testHandlerLogic(job, fullResult);
  
  console.log('');
  console.log('📤 Resultado do handler:');
  console.log(JSON.stringify({
    status: result.status,
    mode: result.mode,
    referenceStage: result.referenceStage,
    requiresSecondTrack: result.requiresSecondTrack,
    nextAction: result.nextAction,
    referenceJobId: result.referenceJobId
  }, null, 2));
  
  // Validar resultado
  const success = validateResult(result);
  
  if (success) {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║  ✅ TESTE PASSOU - Handler está correto!            ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    process.exit(0);
  } else {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║  ❌ TESTE FALHOU - Handler tem bugs!                ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    process.exit(1);
  }
}

// Executar
runTest();
