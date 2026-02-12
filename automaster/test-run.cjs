/**
 * AutoMaster V1 – Camada de Orquestração
 * Mapeia modos de negócio → parâmetros técnicos
 * Chama o core DSP (automaster-v1.cjs) de forma segura
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

// ============================
// Configuração dos modos V1
// ============================

const MODES = {
  STREAMING: {
    label: 'Streaming (Spotify, Apple Music)',
    lufs: -14,
    ceiling: -1.0
  },
  BALANCED: {
    label: 'Balanced (Default)',
    lufs: -11,
    ceiling: -0.8
  },
  IMPACT: {
    label: 'Impact / Club',
    lufs: -9,
    ceiling: -0.5
  }
};

// ============================
// Função principal
// ============================

function runAutomaster(options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const { inputPath, outputPath, mode } = options;

      // ---------- Validações ----------
      if (!inputPath || !outputPath || !mode) {
        throw new Error('Parâmetros obrigatórios: inputPath, outputPath, mode');
      }

      if (!MODES[mode]) {
        throw new Error(`Modo inválido: ${mode}`);
      }

      // ---------- Normalização de paths (CRÍTICO) ----------
      const resolvedInput = path.resolve(inputPath);
      const resolvedOutput = path.resolve(outputPath);

      if (!fs.existsSync(resolvedInput)) {
        throw new Error(`Arquivo de entrada não encontrado: ${resolvedInput}`);
      }

      // ---------- Parâmetros técnicos ----------
      const { lufs, ceiling, label } = MODES[mode];

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('  AutoMaster V1 - Orquestração');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⚙️  Configuração:');
      console.log('   Input:  ', resolvedInput);
      console.log('   Output: ', resolvedOutput);
      console.log(`   Mode:   ${mode} (${label})`);
      console.log(`   LUFS:   ${lufs} LUFS`);
      console.log(`   Ceiling: ${ceiling} dBTP`);
      console.log('\n🎚️  Iniciando processamento DSP...\n');

      // ---------- Caminho do core ----------
      const corePath = path.resolve(__dirname, 'automaster-v1.cjs');

      // ---------- Argumentos do core ----------
      const args = [
        corePath,
        resolvedInput,
        resolvedOutput,
        String(lufs),
        String(ceiling)
      ];

      // ---------- Execução ----------
      const child = execFile(
        'node',
        args,
        { windowsHide: true },
        (error) => {
          if (error) {
            return reject(
              new Error(`Core engine falhou: ${error.message}`)
            );
          }
        }
      );

      child.stdout.on('data', (data) => {
        process.stdout.write(data.toString());
      });

      child.stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });

      child.on('exit', (code) => {
        if (code !== 0) {
          return reject(
            new Error(`Core engine falhou com código ${code}`)
          );
        }

        resolve({
          success: true,
          mode,
          lufs,
          ceiling,
          input: resolvedInput,
          output: resolvedOutput
        });
      });

    } catch (err) {
      reject(err);
    }
  });
}

// ============================
// Export
// ============================

module.exports = {
  runAutomaster,
  MODES
};

// ============================
// Teste direto (node run-automaster.cjs)
// ============================

if (require.main === module) {
  (async () => {
    try {
      await runAutomaster({
        inputPath: 'test_input.wav',
        outputPath: 'out_streaming.wav',
        mode: 'STREAMING'
      });

      await runAutomaster({
        inputPath: 'test_input.wav',
        outputPath: 'out_balanced.wav',
        mode: 'BALANCED'
      });

      await runAutomaster({
        inputPath: 'test_input.wav',
        outputPath: 'out_impact.wav',
        mode: 'IMPACT'
      });

      console.log('\n✅ Teste completo dos modos finalizado.\n');
    } catch (err) {
      console.error('\n❌ ERRO NO TESTE:', err.message);
      process.exit(1);
    }
  })();
}
