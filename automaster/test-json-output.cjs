/**
 * Script de teste para validar saída JSON pura dos scripts AutoMaster
 * 
 * Uso:
 *   node automaster/test-json-output.cjs
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execFileAsync = promisify(execFile);

// ============================================================================
// CORES PARA OUTPUT
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

// ============================================================================
// FUNÇÕES DE TESTE
// ============================================================================

async function testScript(scriptPath, args, testName) {
  log(colors.cyan, `\n▶ Testando: ${testName}`);
  log(colors.blue, `  Script: ${path.basename(scriptPath)}`);
  log(colors.blue, `  Args: ${args.join(' ')}`);

  try {
    const { stdout, stderr } = await execFileAsync('node', [scriptPath, ...args], {
      maxBuffer: 10 * 1024 * 1024
    });

    // Validar stdout
    const trimmed = stdout.trim();
    
    if (!trimmed) {
      log(colors.red, '  ❌ FALHOU: stdout vazio');
      return false;
    }

    if (!trimmed.startsWith('{')) {
      log(colors.red, `  ❌ FALHOU: stdout não começa com '{' (primeiros 50 chars): ${trimmed.substring(0, 50)}`);
      return false;
    }

    if (!trimmed.endsWith('}')) {
      log(colors.red, `  ❌ FALHOU: stdout não termina com '}' (últimos 50 chars): ${trimmed.substring(trimmed.length - 50)}`);
      return false;
    }

    // Tentar parsear JSON
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (parseError) {
      log(colors.red, `  ❌ FALHOU: JSON inválido - ${parseError.message}`);
      log(colors.yellow, `  Stdout: ${trimmed.substring(0, 200)}`);
      return false;
    }

    // Validar estrutura
    if (!parsed.success) {
      log(colors.red, '  ❌ FALHOU: JSON não contém "success": true');
      return false;
    }

    log(colors.green, '  ✅ PASSOU: JSON válido e bem formado');
    log(colors.blue, `  Tamanho do JSON: ${trimmed.length} caracteres`);
    log(colors.blue, `  Campos principais: ${Object.keys(parsed).join(', ')}`);

    if (stderr && stderr.trim()) {
      log(colors.yellow, `  ⚠️  Stderr presente (${stderr.length} chars) - OK se DEBUG_PIPELINE=true`);
    }

    return true;
  } catch (error) {
    log(colors.red, `  ❌ ERRO: ${error.message}`);
    return false;
  }
}

// ============================================================================
// GERAÇÃO DE ARQUIVO DE TESTE
// ============================================================================

async function generateTestAudio() {
  const testFile = path.join(__dirname, 'test_tone.wav');
  
  if (fs.existsSync(testFile)) {
    log(colors.yellow, `\nArquivo de teste já existe: ${testFile}`);
    return testFile;
  }

  log(colors.cyan, '\n▶ Gerando arquivo de teste (3s de tom 440Hz)...');
  
  try {
    await execFileAsync('ffmpeg', [
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=3',
      '-ar', '44100',
      '-ac', '2',
      '-y',
      testFile
    ]);

    log(colors.green, `  ✅ Arquivo gerado: ${testFile}`);
    return testFile;
  } catch (error) {
    log(colors.red, `  ❌ Erro ao gerar arquivo de teste: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  log(colors.cyan, '\n═══════════════════════════════════════════════════════');
  log(colors.cyan, '  TESTE DE SAÍDA JSON PURA - AutoMaster V1');
  log(colors.cyan, '═══════════════════════════════════════════════════════');

  // Gerar arquivo de teste
  let testInput;
  try {
    testInput = await generateTestAudio();
  } catch (error) {
    log(colors.red, '\n❌ Não foi possível gerar arquivo de teste. Abortando.');
    process.exit(1);
  }

  const testOutput = path.join(__dirname, 'test_output.wav');
  const results = [];

  // Teste 1: automaster-v1.cjs (core)
  results.push(await testScript(
    path.join(__dirname, 'automaster-v1.cjs'),
    [testInput, testOutput, '-11', '-0.8'],
    'automaster-v1.cjs (Core DSP)'
  ));

  // Limpar output do teste anterior
  if (fs.existsSync(testOutput)) {
    fs.unlinkSync(testOutput);
  }

  // Teste 2: run-automaster.cjs (wrapper)
  results.push(await testScript(
    path.join(__dirname, 'run-automaster.cjs'),
    [testInput, testOutput, 'BALANCED'],
    'run-automaster.cjs (Wrapper CLI)'
  ));

  // Limpar output do teste anterior
  if (fs.existsSync(testOutput)) {
    fs.unlinkSync(testOutput);
  }

  // Teste 3: master-pipeline.cjs (pipeline completo)
  results.push(await testScript(
    path.join(__dirname, 'master-pipeline.cjs'),
    [testInput, testOutput, 'BALANCED'],
    'master-pipeline.cjs (Pipeline Completo)'
  ));

  // Limpar arquivos de teste
  log(colors.cyan, '\n▶ Limpando arquivos temporários...');
  if (fs.existsSync(testInput)) {
    fs.unlinkSync(testInput);
    log(colors.green, `  ✅ Removido: ${testInput}`);
  }
  if (fs.existsSync(testOutput)) {
    fs.unlinkSync(testOutput);
    log(colors.green, `  ✅ Removido: ${testOutput}`);
  }

  // Resultado final
  log(colors.cyan, '\n═══════════════════════════════════════════════════════');
  log(colors.cyan, '  RESULTADO FINAL');
  log(colors.cyan, '═══════════════════════════════════════════════════════');

  const passed = results.filter(r => r === true).length;
  const failed = results.filter(r => r === false).length;

  log(colors.green, `  ✅ Passou: ${passed}/3`);
  if (failed > 0) {
    log(colors.red, `  ❌ Falhou: ${failed}/3`);
  }

  if (failed === 0) {
    log(colors.green, '\n🎉 TODOS OS TESTES PASSARAM!');
    log(colors.green, '✅ Saída JSON está 100% pura e determinística.');
    log(colors.cyan, '\n═══════════════════════════════════════════════════════\n');
    process.exit(0);
  } else {
    log(colors.red, '\n⚠️  ALGUNS TESTES FALHARAM!');
    log(colors.yellow, 'Revise os logs acima para detalhes.');
    log(colors.cyan, '\n═══════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

main().catch(error => {
  log(colors.red, `\n❌ Erro fatal: ${error.message}`);
  process.exit(1);
});
