/**
 * AutoMaster V1 - Wrapper de Orquestração
 * 
 * Camada de negócio que mapeia MODES para parâmetros técnicos
 * e chama o core DSP (automaster-v1.cjs).
 * 
 * NÃO duplica lógica de processamento.
 * NÃO adiciona EQ, saturação, fallback ou análise.
 * 
 * Uso:
 *   const { runAutomaster } = require('./run-automaster.cjs');
 *   await runAutomaster({ inputPath, outputPath, mode: "BALANCED" });
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================
// MAPEAMENTO DE MODOS
// ============================================================

const MODE_PRESETS = {
  STREAMING: {
    label: 'Streaming (Spotify, Apple Music)',
    targetLufs: -14,
    ceilingDbtp: -1.0,
    description: 'Conservador, com headroom para normalização de plataformas'
  },
  BALANCED: {
    label: 'Balanced (Padrão competitivo)',
    targetLufs: -11,
    ceilingDbtp: -0.8,
    description: 'Equilíbrio entre loudness e dinâmica'
  },
  IMPACT: {
    label: 'Impact (Alto impacto)',
    targetLufs: -9,
    ceilingDbtp: -0.5,
    description: 'Máxima loudness para funk, trap, EDM'
  }
};

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================

/**
 * Executa masterização com preset de modo.
 * 
 * @param {Object} options - Configuração
 * @param {string} options.inputPath - Caminho do WAV de entrada
 * @param {string} options.outputPath - Caminho do WAV de saída
 * @param {string} options.mode - Modo: "STREAMING" | "BALANCED" | "IMPACT"
 * @returns {Promise<{ success: true, duration: number, outputPath: string }>}
 * @throws {Error} Se validação falhar ou processamento falhar
 */
async function runAutomaster(options) {
  const startTime = Date.now();

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  AutoMaster V1 - Orquestração');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // 1. VALIDAÇÃO DE ENTRADA
  validateInput(options);

  const { inputPath, outputPath, mode } = options;
  const preset = MODE_PRESETS[mode];

  console.log('⚙️  Configuração:');
  console.log(`   Input:  ${inputPath}`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Mode:   ${mode} (${preset.label})`);
  console.log(`   LUFS:   ${preset.targetLufs} LUFS`);
  console.log(`   Ceiling: ${preset.ceilingDbtp} dBTP`);
  console.log('');

  // 2. CHAMAR O CORE DSP
  console.log('🎚️  Iniciando processamento DSP...');
  console.log('');

  try {
    await executeCoreEngine(inputPath, outputPath, preset.targetLufs, preset.ceilingDbtp);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const stats = fs.statSync(outputPath);
    const sizeKB = (stats.size / 1024).toFixed(2);

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MASTERIZAÇÃO CONCLUÍDA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Modo:    ${mode}`);
    console.log(`   Tempo:   ${duration}s`);
    console.log(`   Output:  ${outputPath}`);
    console.log(`   Tamanho: ${sizeKB} KB`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    return {
      success: true,
      duration: parseFloat(duration),
      outputPath,
      mode,
      preset: {
        lufs: preset.targetLufs,
        ceiling: preset.ceilingDbtp
      }
    };
  } catch (error) {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ ERRO NO PROCESSAMENTO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(error.message);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    throw error;
  }
}

// ============================================================
// VALIDAÇÃO
// ============================================================

function validateInput(options) {
  // Validar estrutura
  if (!options || typeof options !== 'object') {
    throw new Error('Parâmetro deve ser um objeto: { inputPath, outputPath, mode }');
  }

  const { inputPath, outputPath, mode } = options;

  // Validar inputPath
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('inputPath é obrigatório e deve ser string');
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo de entrada não encontrado: ${inputPath}`);
  }

  const inputExt = path.extname(inputPath).toLowerCase();
  if (inputExt !== '.wav') {
    throw new Error(`Input deve ser WAV (recebido: ${inputExt})`);
  }

  // Validar outputPath
  if (!outputPath || typeof outputPath !== 'string') {
    throw new Error('outputPath é obrigatório e deve ser string');
  }

  const outputExt = path.extname(outputPath).toLowerCase();
  if (outputExt !== '.wav') {
    throw new Error(`Output deve ser WAV (recebido: ${outputExt})`);
  }

  // Validar mode
  if (!mode || typeof mode !== 'string') {
    throw new Error('mode é obrigatório e deve ser string');
  }

  if (!MODE_PRESETS[mode]) {
    const validModes = Object.keys(MODE_PRESETS).join(', ');
    throw new Error(`Mode inválido: ${mode}. Valores permitidos: ${validModes}`);
  }
}

// ============================================================
// EXECUÇÃO DO CORE ENGINE
// ============================================================

function executeCoreEngine(inputPath, outputPath, targetLufs, ceilingDbtp) {
  return new Promise((resolve, reject) => {
    const corePath = path.join(__dirname, 'automaster-v1.cjs');

    // Verificar se o core existe
    if (!fs.existsSync(corePath)) {
      reject(new Error(`Core engine não encontrado: ${corePath}`));
      return;
    }

    const args = [
      corePath,
      inputPath,
      outputPath,
      targetLufs.toString(),
      ceilingDbtp.toString()
    ];

    const nodeProcess = execFile('node', args, {
      maxBuffer: 10 * 1024 * 1024,
      cwd: __dirname
    });

    let stdoutData = '';
    let stderrData = '';

    // Capturar stdout do core (logs do processamento)
    nodeProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdoutData += output;
      process.stdout.write(output); // Repassar logs em tempo real
    });

    // Capturar stderr do core (logs do FFmpeg)
    nodeProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      // FFmpeg usa stderr para progresso - não logar para não poluir
    });

    nodeProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout: stdoutData, stderr: stderrData });
      } else {
        reject(new Error(`Core engine falhou com código ${code}.\n${stdoutData}\n${stderrData}`));
      }
    });

    nodeProcess.on('error', (err) => {
      reject(new Error(`Erro ao executar core engine: ${err.message}`));
    });
  });
}

// ============================================================
// EXPORTAÇÃO
// ============================================================

module.exports = {
  runAutomaster,
  MODE_PRESETS
};

// ============================================================
// TESTE MANUAL (descomentar para rodar standalone)
// ============================================================

/*
// Para testar:
// 1. Gerar áudio de teste:
//    ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 3 test_input.wav
//
// 2. Descomentar o bloco abaixo e executar:
//    node run-automaster.cjs

(async () => {
  try {
    await runAutomaster({
      inputPath: 'test_input.wav',
      outputPath: 'test_out_streaming.wav',
      mode: 'STREAMING'
    });

    console.log('\n✅ Teste 1/3 concluído (STREAMING)\n');

    await runAutomaster({
      inputPath: 'test_input.wav',
      outputPath: 'test_out_balanced.wav',
      mode: 'BALANCED'
    });

    console.log('\n✅ Teste 2/3 concluído (BALANCED)\n');

    await runAutomaster({
      inputPath: 'test_input.wav',
      outputPath: 'test_out_impact.wav',
      mode: 'IMPACT'
    });

    console.log('\n✅ Teste 3/3 concluído (IMPACT)\n');
    console.log('🎉 Todos os modos testados com sucesso!\n');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    process.exit(1);
  }
})();
*/
