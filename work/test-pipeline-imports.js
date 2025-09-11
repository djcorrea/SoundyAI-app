// 🔍 TESTE DE IMPORTAÇÃO DO PIPELINE
// Teste direto para verificar onde está falhando a importação

import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🔍 Testando importações do pipeline...");
console.log("📁 Current directory:", process.cwd());
console.log("📁 __dirname:", __dirname);

// Testar cada dependência individualmente
async function testImports() {
  const tests = [
    "../api/audio/audio-decoder.js",
    "../api/audio/temporal-segmentation.js", 
    "../api/audio/core-metrics.js",
    "../api/audio/json-output.js",
    "../api/audio/pipeline-complete.js"
  ];
  
  for (const modulePath of tests) {
    try {
      console.log(`🧪 Testando: ${modulePath}`);
      const module = await import(modulePath);
      console.log(`✅ Sucesso: ${modulePath}`, Object.keys(module));
    } catch (err) {
      console.error(`❌ Falhou: ${modulePath}`, err.message);
      
      // Testar caminho absoluto
      try {
        const absolutePath = path.resolve(__dirname, modulePath);
        console.log(`🧪 Tentando caminho absoluto: ${absolutePath}`);
        const module = await import(absolutePath);
        console.log(`✅ Sucesso (absoluto): ${absolutePath}`, Object.keys(module));
      } catch (absErr) {
        console.error(`❌ Falhou (absoluto): ${modulePath}`, absErr.message);
      }
    }
  }
}

testImports().catch(console.error);
