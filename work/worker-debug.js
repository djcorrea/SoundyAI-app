// worker-debug.js - versão minimalista para debug
import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Worker debug iniciando...');
console.log('📁 __dirname:', __dirname);
console.log('📁 process.cwd():', process.cwd());

// Teste básico do express
const app = express();
const port = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.json({ status: 'Worker debug rodando', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`✅ Express rodando na porta ${port}`);
});

// Teste de import do pipeline
console.log('🧪 Testando import do pipeline...');
try {
  const imported = await import("./api/audio/pipeline-complete.js");
  console.log('✅ Pipeline importado com sucesso!');
  console.log('🔧 Exports:', Object.keys(imported));
} catch (err) {
  console.error('❌ ERRO no import do pipeline:', err.message);
  console.error('📜 Stack:', err.stack);
}

console.log('🎯 Worker debug finalizado');