/**
 * AutoMaster V1 - Wrapper de Orquestração
 * 
 * Camada de orquestração que mapeia MODES para parâmetros técnicos
 * e chama o core DSP (automaster-v1.cjs).
 * 
 * NÃO duplica lógica de processamento.
 * NÃO adiciona EQ, saturação, fallback ou análise.
 * 
 * Uso CLI:
 *   node run-automaster.cjs <input.wav> <output.wav> <MODE>
 * 
 * Uso Programático:
 *   const { runAutomaster } = require('./run-automaster.cjs');
 *   await runAutomaster({ inputPath, outputPath, mode: "MEDIUM" });
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
  LOW: {
    label: 'Low (Suave)',
    targetLufs: -14,
    ceilingDbtp: -1.0,
    description: 'Conservador, preserva dinâmica natural'
  },
  MEDIUM: {
    label: 'Medium (Padrão competitivo)',
    targetLufs: -11,
    ceilingDbtp: -0.8,
    description: 'Equilíbrio entre loudness e dinâmica'
  },
  HIGH: {
    label: 'High (Alto impacto)',
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
 * @param {string} options.mode - Modo: "STREAMING" | "LOW" | "MEDIUM" | "HIGH"
 * @returns {Promise<Object>} Resultado com métricas
 * @throws {Error} Se validação falhar ou processamento falhar
 */
async function runAutomaster(options) {
  const startTime = Date.now();
  const debug = process.env.DEBUG_PIPELINE === 'true';

  if (debug) {
    console.error('[DEBUG] AutoMaster V1 - Orquestracao');
  }

  // 1. VALIDAÇÃO DE ENTRADA
  validateInput(options);

  const { inputPath, outputPath, mode, strategy } = options;
  const preset = MODE_PRESETS[mode];

  if (debug) {
    console.error(`[DEBUG] Input: ${inputPath}`);
    console.error(`[DEBUG] Output: ${outputPath}`);
    console.error(`[DEBUG] Mode: ${mode} (${preset.label})`);
    console.error(`[DEBUG] LUFS: ${preset.targetLufs} LUFS`);
    console.error(`[DEBUG] Ceiling: ${preset.ceilingDbtp} dBTP`);
  }

  // 2. CHAMAR O CORE DSP
  if (debug) console.error('[DEBUG] Iniciando processamento DSP...');

  try {
    const coreResult = await executeCoreEngine(inputPath, outputPath, mode, strategy);

    const duration = Date.now() - startTime;
    const stats = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;
    const sizeKB = stats ? (stats.size / 1024).toFixed(2) : '0';

    if (debug) {
      console.error('[DEBUG] MASTERIZACAO CONCLUIDA');
      console.error(`[DEBUG] Modo: ${mode}`);
      console.error(`[DEBUG] Tempo: ${duration}ms`);
      console.error(`[DEBUG] Output: ${outputPath}`);
      console.error(`[DEBUG] Tamanho: ${sizeKB} KB`);
    }

    return {
      success: true,
      mode,
      strategy_used: strategy || null,
      target_lufs: preset.targetLufs,
      target_tp: preset.ceilingDbtp,
      final_lufs: coreResult.final_lufs,
      final_tp: coreResult.final_tp,
      duration_ms: duration,
      output_path: outputPath,
      output_size_kb: parseFloat(sizeKB),
      fallback_used: coreResult.fallback_used || false,
      impact_aborted: coreResult.impact_aborted || false,
      abort_reason: coreResult.abort_reason || null,
      mode_result: coreResult.mode_result || mode
    };
  } catch (error) {
    if (debug) {
      console.error('[DEBUG] ERRO NO PROCESSAMENTO');
    }
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

function executeCoreEngine(inputPath, outputPath, mode, strategy) {
  return new Promise((resolve, reject) => {
    const corePath = path.join(__dirname, 'automaster-v1.cjs');
    const debug = process.env.DEBUG_PIPELINE === 'true';

    // Verificar se o core existe
    if (!fs.existsSync(corePath)) {
      reject(new Error(`Core engine nao encontrado: ${corePath}`));
      return;
    }

    // Passar mode diretamente ao core — sem conversão
    const args = [
      corePath,
      inputPath,
      outputPath,
      mode
    ];

    if (strategy) {
      args.push(strategy);
    }

    const nodeProcess = execFile('node', args, {
      maxBuffer: 10 * 1024 * 1024,
      cwd: __dirname,
      env: Object.assign({}, process.env, { AUTOMASTER_STRATEGY: strategy || '' })
    });

    let stdoutData = '';
    let stderrData = '';

    // Capturar stdout (deve conter SOMENTE JSON)
    nodeProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    // Capturar stderr (logs de debug)
    nodeProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      if (debug) {
        process.stderr.write(data);
      }
    });

    nodeProcess.on('close', (code) => {
      if (code === 0) {
        // Validar se stdout começa com '{'
        const trimmed = stdoutData.trim();
        
        if (debug) {
          console.error('[DEBUG] Core stdout length:', trimmed.length);
          console.error('[DEBUG] Core stdout (first 200 chars):', trimmed.substring(0, 200));
          console.error('[DEBUG] Core stderr:', stderrData);
        }
        
        if (!trimmed) {
          reject(new Error('Core retornou stdout vazio'));
          return;
        }
        
        if (!trimmed.startsWith('{')) {
          reject(new Error(`Core retornou saida invalida (nao comeca com JSON). Primeiros 100 chars: ${trimmed.substring(0, 100)}`));
          return;
        }

        try {
          const result = JSON.parse(trimmed);
          
          if (debug) {
            console.error('[DEBUG] JSON parseado com sucesso:', JSON.stringify(result, null, 2));
          }
          
          resolve(result);
        } catch (parseError) {
          reject(new Error(`Erro ao parsear JSON do core: ${parseError.message}. Stdout length: ${trimmed.length}, First 200 chars: ${trimmed.substring(0, 200)}`));
        }
      } else {
        reject(new Error(`Core engine falhou com codigo ${code}. Stderr: ${stderrData}`));
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
// CLI
// ============================================================

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    const errMsg = 'Argumentos insuficientes. Uso: node run-automaster.cjs <inputPath> <outputPath> <MODE> [STRATEGY]. Modos validos: STREAMING, LOW, MEDIUM, HIGH';
    process.stdout.write(JSON.stringify({ ok: false, success: false, error: errMsg }) + '\n');
    process.exit(1);
  }

  const [inputPath, outputPath, mode, strategy] = args;

  runAutomaster({ inputPath, outputPath, mode, strategy })
    .then(result => {
      process.stdout.write(JSON.stringify(result) + '\n');
      process.exit(0);
    })
    .catch(error => {
      // BUG FIX: stdout DEVE receber JSON — console.error só vai p/ stderr
      process.stdout.write(JSON.stringify({ ok: false, success: false, error: error.message, stack: error.stack }) + '\n');
      process.exit(1);
    });
}
