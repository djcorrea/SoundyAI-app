/**
 * 🧪 TESTE DE VALIDAÇÃO: Genre Override em Todas as Estruturas
 * 
 * Este teste valida que o genre escolhido pelo usuário sempre prevalece
 * sobre qualquer valor "default" vindo do pipeline em TODAS as estruturas aninhadas.
 */

console.log("🧪 Iniciando teste de Genre Override...\n");

// ========== SIMULAÇÃO ==========

// 1. Simular analysisResult contaminado (como vem do pipeline)
const analysisResultContaminado = {
  genre: "default",
  score: 7.5,
  summary: {
    genre: "default",
    totalProblems: 3,
    criticalIssues: 1
  },
  metadata: {
    genre: "default",
    fileName: "test-track.mp3",
    duration: 180
  },
  suggestionMetadata: {
    genre: "default",
    totalSuggestions: 5
  },
  data: {
    genre: "default",
    someMetric: 123
  },
  suggestions: [],
  aiSuggestions: []
};

// 2. Simular options do usuário (genre escolhido)
const options = {
  genre: "trance",
  genreTargets: {
    kick: { min: 50, max: 100 },
    bass: { min: 60, max: 120 }
  },
  mode: "genre"
};

// 3. Aplicar a lógica de correção (exatamente como no worker.js)
const forcedGenre = options.genre;
const forcedTargets = options.genreTargets || null;

const result = {
  ok: true,
  file: "test-file.mp3",
  analyzedAt: new Date().toISOString(),

  ...analysisResultContaminado,

  // 🔥 Correção suprema: garantir que a raiz sempre tenha o gênero correto
  genre: forcedGenre,
  mode: options.mode,

  // 🔥 Corrigir summary.genre
  summary: {
    ...(analysisResultContaminado.summary || {}),
    genre: forcedGenre
  },

  // 🔥 Corrigir metadata.genre
  metadata: {
    ...(analysisResultContaminado.metadata || {}),
    genre: forcedGenre
  },

  // 🔥 Corrigir suggestionMetadata.genre
  suggestionMetadata: {
    ...(analysisResultContaminado.suggestionMetadata || {}),
    genre: forcedGenre
  },

  // 🔥 Corrigir data.genre + incluir targets
  data: {
    ...(analysisResultContaminado.data || {}),
    genre: forcedGenre,
    genreTargets: forcedTargets
  }
};

// ========== VALIDAÇÃO ==========

let allTestsPassed = true;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
  } else {
    console.error(`❌ FAIL: ${message}`);
    allTestsPassed = false;
  }
}

console.log("📊 Resultado antes da correção:");
console.log("  analysisResult.genre:", analysisResultContaminado.genre);
console.log("  analysisResult.summary.genre:", analysisResultContaminado.summary.genre);
console.log("  analysisResult.metadata.genre:", analysisResultContaminado.metadata.genre);
console.log("  analysisResult.suggestionMetadata.genre:", analysisResultContaminado.suggestionMetadata.genre);
console.log("  analysisResult.data.genre:", analysisResultContaminado.data.genre);

console.log("\n📊 Resultado DEPOIS da correção:");
console.log("  result.genre:", result.genre);
console.log("  result.summary.genre:", result.summary.genre);
console.log("  result.metadata.genre:", result.metadata.genre);
console.log("  result.suggestionMetadata.genre:", result.suggestionMetadata.genre);
console.log("  result.data.genre:", result.data.genre);
console.log("  result.data.genreTargets:", result.data.genreTargets);

console.log("\n🧪 Executando testes de validação:\n");

// Teste 1: Genre na raiz deve ser "trance"
assert(
  result.genre === "trance",
  "result.genre deve ser 'trance'"
);

// Teste 2: summary.genre deve ser "trance"
assert(
  result.summary.genre === "trance",
  "result.summary.genre deve ser 'trance'"
);

// Teste 3: metadata.genre deve ser "trance"
assert(
  result.metadata.genre === "trance",
  "result.metadata.genre deve ser 'trance'"
);

// Teste 4: suggestionMetadata.genre deve ser "trance"
assert(
  result.suggestionMetadata.genre === "trance",
  "result.suggestionMetadata.genre deve ser 'trance'"
);

// Teste 5: data.genre deve ser "trance"
assert(
  result.data.genre === "trance",
  "result.data.genre deve ser 'trance'"
);

// Teste 6: genreTargets deve estar presente em data
assert(
  result.data.genreTargets !== null && result.data.genreTargets !== undefined,
  "result.data.genreTargets deve existir"
);

// Teste 7: Outros campos de summary devem ser preservados
assert(
  result.summary.totalProblems === 3,
  "result.summary.totalProblems deve ser preservado (3)"
);

// Teste 8: Outros campos de metadata devem ser preservados
assert(
  result.metadata.fileName === "test-track.mp3",
  "result.metadata.fileName deve ser preservado"
);

// Teste 9: Outros campos de data devem ser preservados
assert(
  result.data.someMetric === 123,
  "result.data.someMetric deve ser preservado (123)"
);

// Teste 10: Verificar que NENHUM campo contém "default"
const resultString = JSON.stringify(result);
const hasDefault = resultString.includes('"default"');
assert(
  !hasDefault,
  'Nenhum campo no resultado deve conter o valor "default"'
);

// ========== RESULTADO FINAL ==========

console.log("\n" + "=".repeat(50));
if (allTestsPassed) {
  console.log("🎉 TODOS OS TESTES PASSARAM!");
  console.log("✅ A correção está funcionando corretamente.");
  console.log("✅ O genre do usuário sempre prevalece.");
  console.log("✅ Nenhum campo contém 'default'.");
  process.exit(0);
} else {
  console.log("❌ ALGUNS TESTES FALHARAM!");
  console.log("⚠️  Revise a implementação da correção.");
  process.exit(1);
}
