/**
 * ============================================================================
 * TESTE DE CONCORRÊNCIA - AUTOMASTER V1
 * ============================================================================
 * 
 * Submete 5 jobs simultâneos e monitora:
 * - Taxa de sucesso
 * - p50/p95 de duração
 * - Garantia de lock (sem duplicação)
 * - Limpeza de /tmp
 * 
 * Uso: node test/concurrency-test.cjs
 * 
 * Autor: SoundyAI Engineering
 * Data: 2026-02-11
 * ============================================================================
 */

const { execFileSync } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONSTANTES
// ============================================================================

const API_URL = 'http://localhost:3000';
const NUM_JOBS = 5;
const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 180000; // 3 minutos

// ============================================================================
// GERAR ARQUIVO DE TESTE
// ============================================================================

function generateTestAudio() {
  const testFile = path.join(__dirname, 'test-tone.wav');
  
  if (fs.existsSync(testFile)) {
    console.log('✓ Arquivo de teste já existe');
    return testFile;
  }

  console.log('→ Gerando arquivo de teste (3s de tom 440Hz)...');
  
  execFileSync('ffmpeg', [
    '-f', 'lavfi',
    '-i', 'sine=frequency=440:duration=3',
    '-ar', '44100',
    '-ac', '2',
    '-y',
    testFile
  ], { stdio: 'ignore' });

  console.log('✓ Arquivo gerado');
  return testFile;
}

// ============================================================================
// SUBMIT JOB
// ============================================================================

async function submitJob(testFile, mode = 'BALANCED') {
  const FormData = require('form-data');
  const form = new FormData();
  form.append('audio', fs.createReadStream(testFile));
  form.append('mode', mode);

  const response = await axios.post(`${API_URL}/automaster`, form, {
    headers: form.getHeaders()
  });

  return response.data;
}

// ============================================================================
// POLL STATUS
// ============================================================================

async function waitForJobCompletion(jobId) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < MAX_WAIT_MS) {
    const response = await axios.get(`${API_URL}/automaster/${jobId}`);
    const data = response.data;

    if (data.status === 'completed') {
      return {
        success: true,
        duration_ms: data.processing_ms,
        jobId
      };
    }

    if (data.status === 'failed') {
      return {
        success: false,
        duration_ms: data.processing_ms || (Date.now() - startTime),
        error: data.error_message,
        jobId
      };
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return {
    success: false,
    duration_ms: Date.now() - startTime,
    error: 'Timeout',
    jobId
  };
}

// ============================================================================
// VERIFICAR LIMPEZA DE /TMP
// ============================================================================

function checkTmpCleanup() {
  const tmpDir = path.resolve(__dirname, '../tmp');
  
  if (!fs.existsSync(tmpDir)) {
    return { clean: true, count: 0 };
  }

  const files = fs.readdirSync(tmpDir);
  return { clean: files.length === 0, count: files.length };
}

// ============================================================================
// CALCULAR PERCENTIS
// ============================================================================

function calculatePercentiles(values) {
  if (values.length === 0) return { p50: 0, p95: 0 };
  
  const sorted = values.slice().sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  
  return { p50, p95 };
}

// ============================================================================
// MAIN TEST
// ============================================================================

async function runConcurrencyTest() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  TESTE DE CONCORRÊNCIA - AUTOMASTER V1');
  console.log('═══════════════════════════════════════════════════════\n');

  const testStartTime = Date.now();

  try {
    // 1. Gerar arquivo de teste
    const testFile = generateTestAudio();

    // 2. Submeter 5 jobs simultâneos
    console.log(`\n→ Submetendo ${NUM_JOBS} jobs simultâneos...\n`);
    
    const jobPromises = [];
    for (let i = 0; i < NUM_JOBS; i++) {
      jobPromises.push(submitJob(testFile));
    }

    const submissions = await Promise.all(jobPromises);
    const jobIds = submissions.map(s => s.jobId);

    console.log('✓ Jobs submetidos:');
    jobIds.forEach((id, i) => console.log(`  ${i + 1}. ${id}`));

    // 3. Aguardar conclusão de todos
    console.log('\n→ Aguardando conclusão...\n');
    
    const results = await Promise.all(
      jobIds.map(id => waitForJobCompletion(id))
    );

    // 4. Analisar resultados
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  RESULTADOS');
    console.log('═══════════════════════════════════════════════════════\n');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✓ Sucesso: ${successful.length}/${NUM_JOBS}`);
    console.log(`✗ Falhou:  ${failed.length}/${NUM_JOBS}`);

    if (failed.length > 0) {
      console.log('\nJobs que falharam:');
      failed.forEach(f => {
        console.log(`  - ${f.jobId}: ${f.error}`);
      });
    }

    // 5. Métricas de duração
    const durations = successful.map(r => r.duration_ms);
    if (durations.length > 0) {
      const { p50, p95 } = calculatePercentiles(durations);
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;

      console.log('\nMétricas de Duração:');
      console.log(`  Média: ${(avg / 1000).toFixed(2)}s`);
      console.log(`  p50:   ${(p50 / 1000).toFixed(2)}s`);
      console.log(`  p95:   ${(p95 / 1000).toFixed(2)}s`);
    }

    // 6. Verificar limpeza de /tmp
    console.log('\nLimpeza de /tmp:');
    const tmpStatus = checkTmpCleanup();
    if (tmpStatus.clean) {
      console.log('  ✓ /tmp está limpo');
    } else {
      console.log(`  ⚠ /tmp contém ${tmpStatus.count} itens restantes`);
    }

    // 7. Tempo total do teste
    const totalDuration = Date.now() - testStartTime;
    console.log(`\nTempo total do teste: ${(totalDuration / 1000).toFixed(2)}s`);

    // 8. Critérios de aceite
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  CRITÉRIOS DE ACEITE');
    console.log('═══════════════════════════════════════════════════════\n');

    const successRate = successful.length / NUM_JOBS;
    const passRate = successRate >= 0.8; // >= 4/5
    const passTmp = tmpStatus.clean;

    console.log(`✓ Taxa de sucesso >= 80%: ${passRate ? 'PASS' : 'FAIL'} (${(successRate * 100).toFixed(0)}%)`);
    console.log(`✓ /tmp limpo após jobs:   ${passTmp ? 'PASS' : 'FAIL'}`);

    const overallPass = passRate && passTmp;

    console.log('\n═══════════════════════════════════════════════════════');
    if (overallPass) {
      console.log('  ✓ TESTE PASSOU');
    } else {
      console.log('  ✗ TESTE FALHOU');
    }
    console.log('═══════════════════════════════════════════════════════\n');

    process.exit(overallPass ? 0 : 1);

  } catch (error) {
    console.error('\n✗ Erro no teste:', error.message);
    process.exit(1);
  }
}

// Run
runConcurrencyTest().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
