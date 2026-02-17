const path = require('path');
const { runMasterPipeline } = require('../automaster/master-pipeline.cjs');

const input = path.resolve(__dirname, '..', 'musicas', 'you loudnes.wav');
const output = path.resolve(__dirname, 'out', 'you_loudnes_out.wav');

(async () => {
  try {
    const res = await runMasterPipeline({ inputPath: input, outputPath: output, mode: 'BALANCED' });
    console.log('RESULT:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('ERROR CAUGHT:', err && err.stack ? err.stack : String(err));
    process.exit(1);
  }
})();
