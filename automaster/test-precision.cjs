#!/usr/bin/env node
/**
 * AutoMaster V1 - Teste de Precisão
 * 
 * Valida que o two-pass loudnorm atinge precisão técnica:
 *   - LUFS: ±0.1 LU do target
 *   - True Peak: <= ceiling + 0.05 dB
 * 
 * Testa os 3 modos principais:
 *   - STREAMING: -14 LUFS / -1.0 dBTP
 *   - BALANCED:  -11 LUFS / -0.8 dBTP
 *   - IMPACT:    -9 LUFS / -0.5 dBTP
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURAÇÃO DOS TESTES
// ============================================================

const TESTS = [
  { name: 'STREAMING', lufs: -14, ceiling: -1.0 },
  { name: 'BALANCED',  lufs: -11, ceiling: -0.8 },
  { name: 'IMPACT',    lufs: -9,  ceiling: -0.5 }
];

const TEST_INPUT = 'test_precision_input.wav';
const LUFS_TOLERANCE = 0.1;
const TP_TOLERANCE = 0.05;

// ============================================================
// GERAÇÃO DE ÁUDIO DE TESTE
// ============================================================

function generateTestAudio() {
  return new Promise((resolve, reject) => {
    console.log('🎵 Gerando áudio de teste (sine 440Hz, 30s)...');
    
    const args = [
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=30',
      '-ar', '44100',
      '-y',
      TEST_INPUT
    ];

    execFile('ffmpeg', args, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Erro ao gerar áudio: ${error.message}`));
        return;
      }
      
      console.log(`✅ Gerado: ${TEST_INPUT}`);
      console.log('');
      resolve();
    });
  });
}

// ============================================================
// EXECUÇÃO DE TESTE
// ============================================================

function runTest(testConfig) {
  return new Promise((resolve, reject) => {
    const outputFile = `test_precision_${testConfig.name.toLowerCase()}.wav`;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  TESTE: ${testConfig.name}`);
    console.log(`  Target: ${testConfig.lufs} LUFS / ${testConfig.ceiling} dBTP`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    const args = [
      path.join(__dirname, 'automaster-v1.cjs'),
      TEST_INPUT,
      outputFile,
      testConfig.lufs.toString(),
      testConfig.ceiling.toString()
    ];

    const startTime = Date.now();
    const nodeProcess = execFile('node', args, { 
      maxBuffer: 20 * 1024 * 1024,
      timeout: 180000 
    });

    let stdout = '';
    let stderr = '';

    nodeProcess.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text); // Repassar em tempo real
    });

    nodeProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    nodeProcess.on('close', (code) => {
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Extrair JSON do resultado
      const jsonMatch = stdout.match(/RESULT_JSON: (\{.*\})/);
      let result = null;
      
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[1]);
        } catch (e) {
          // Ignorar erro de parse
        }
      }

      if (code === 0 && result) {
        // Validar precisão
        const lufsPass = result.lufsError <= LUFS_TOLERANCE;
        const tpPass = result.finalTP <= (testConfig.ceiling + TP_TOLERANCE);
        const overallPass = lufsPass && tpPass;

        console.log('');
        console.log('┌─────────────────────────────────────────────────┐');
        console.log('│  RESULTADO DO TESTE                              │');
        console.log('└─────────────────────────────────────────────────┘');
        console.log(`  Status:         ${overallPass ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`  Tempo total:    ${totalTime}s`);
        console.log('');
        console.log('  LUFS:');
        console.log(`    Target:       ${testConfig.lufs} LUFS`);
        console.log(`    Final:        ${result.finalI.toFixed(2)} LUFS`);
        console.log(`    Erro:         ${result.lufsError.toFixed(3)} LU`);
        console.log(`    Tolerância:   ±${LUFS_TOLERANCE} LU`);
        console.log(`    Status:       ${lufsPass ? '✅ PASS' : '❌ FAIL'}`);
        console.log('');
        console.log('  TRUE PEAK:');
        console.log(`    Target:       ${testConfig.ceiling.toFixed(2)} dBTP`);
        console.log(`    Used:         ${result.usedTP.toFixed(2)} dBTP ${result.fallbackUsed ? '(fallback)' : ''}`);
        console.log(`    Final:        ${result.finalTP.toFixed(2)} dBTP`);
        console.log(`    Erro:         ${result.tpError >= 0 ? '+' : ''}${result.tpError.toFixed(3)} dB`);
        console.log(`    Máximo:       ${(testConfig.ceiling + TP_TOLERANCE).toFixed(2)} dBTP`);
        console.log(`    Status:       ${tpPass ? '✅ PASS' : '❌ FAIL'}`);
        console.log('');

        resolve({
          name: testConfig.name,
          pass: overallPass,
          lufsPass,
          tpPass,
          result,
          totalTime: parseFloat(totalTime),
          outputFile
        });
      } else {
        console.log('');
        console.log('❌ TESTE FALHOU');
        console.log(`   Exit code: ${code}`);
        if (stderr) {
          console.log(`   Stderr: ${stderr.substring(0, 500)}`);
        }
        console.log('');

        resolve({
          name: testConfig.name,
          pass: false,
          error: `Exit code ${code}`,
          totalTime: parseFloat(totalTime)
        });
      }
    });

    nodeProcess.on('error', (err) => {
      reject(new Error(`Erro ao executar teste: ${err.message}`));
    });
  });
}

// ============================================================
// LIMPEZA
// ============================================================

function cleanup() {
  const files = [TEST_INPUT];
  
  for (const test of TESTS) {
    files.push(`test_precision_${test.name.toLowerCase()}.wav`);
  }

  for (const file of files) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║  AutoMaster V1 - TESTE DE PRECISÃO               ║');
  console.log('║  Two-Pass Loudnorm + Pós-Validação               ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Limpar testes anteriores
    cleanup();

    // Gerar áudio de teste
    await generateTestAudio();

    // Executar todos os testes
    const results = [];
    
    for (const test of TESTS) {
      const result = await runTest(test);
      results.push(result);
    }

    // Relatório final
    console.log('');
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║  RELATÓRIO FINAL                                  ║');
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log('');

    let allPassed = true;
    
    for (const result of results) {
      const status = result.pass ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${result.name.padEnd(12)} ${status}  (${result.totalTime}s)`);
      
      if (result.pass && result.lufsPass !== undefined) {
        console.log(`    LUFS: ${result.lufsPass ? '✅' : '❌'}  TP: ${result.tpPass ? '✅' : '❌'}  Fallback: ${result.result.fallbackUsed ? 'Sim' : 'Não'}`);
      }
      
      if (!result.pass) {
        allPassed = false;
        if (result.error) {
          console.log(`    Erro: ${result.error}`);
        }
      }
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════');
    console.log(`  RESULTADO GERAL: ${allPassed ? '✅ TODOS OS TESTES PASSARAM' : '❌ ALGUNS TESTES FALHARAM'}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');

    // Limpar arquivos de teste
    console.log('🧹 Limpando arquivos de teste...');
    cleanup();
    console.log('✅ Limpeza concluída');
    console.log('');

    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('');
    console.error('❌ ERRO CRÍTICO:', error.message);
    console.error('');
    
    cleanup();
    process.exit(1);
  }
}

// Executar
main();
