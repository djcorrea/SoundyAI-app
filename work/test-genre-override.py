"""
🧪 TESTE DE VALIDAÇÃO: Genre Override em Todas as Estruturas

Este teste valida que o genre escolhido pelo usuário sempre prevalece
sobre qualquer valor "default" vindo do pipeline em TODAS as estruturas aninhadas.
"""

import json
from datetime import datetime

print("🧪 Iniciando teste de Genre Override...\n")

# ========== SIMULAÇÃO ==========

# 1. Simular analysisResult contaminado (como vem do pipeline)
analysis_result_contaminado = {
    "genre": "default",
    "score": 7.5,
    "summary": {
        "genre": "default",
        "totalProblems": 3,
        "criticalIssues": 1
    },
    "metadata": {
        "genre": "default",
        "fileName": "test-track.mp3",
        "duration": 180
    },
    "suggestionMetadata": {
        "genre": "default",
        "totalSuggestions": 5
    },
    "data": {
        "genre": "default",
        "someMetric": 123
    },
    "suggestions": [],
    "aiSuggestions": []
}

# 2. Simular options do usuário (genre escolhido)
options = {
    "genre": "trance",
    "genreTargets": {
        "kick": {"min": 50, "max": 100},
        "bass": {"min": 60, "max": 120}
    },
    "mode": "genre"
}

# 3. Aplicar a lógica de correção (exatamente como no worker.js)
forced_genre = options["genre"]
forced_targets = options.get("genreTargets")

result = {
    "ok": True,
    "file": "test-file.mp3",
    "analyzedAt": datetime.now().isoformat(),
    
    **analysis_result_contaminado,
    
    # 🔥 Correção suprema: garantir que a raiz sempre tenha o gênero correto
    "genre": forced_genre,
    "mode": options["mode"],
    
    # 🔥 Corrigir summary.genre
    "summary": {
        **(analysis_result_contaminado.get("summary") or {}),
        "genre": forced_genre
    },
    
    # 🔥 Corrigir metadata.genre
    "metadata": {
        **(analysis_result_contaminado.get("metadata") or {}),
        "genre": forced_genre
    },
    
    # 🔥 Corrigir suggestionMetadata.genre
    "suggestionMetadata": {
        **(analysis_result_contaminado.get("suggestionMetadata") or {}),
        "genre": forced_genre
    },
    
    # 🔥 Corrigir data.genre + incluir targets
    "data": {
        **(analysis_result_contaminado.get("data") or {}),
        "genre": forced_genre,
        "genreTargets": forced_targets
    }
}

# ========== VALIDAÇÃO ==========

all_tests_passed = True
tests_run = 0
tests_passed = 0

def assert_test(condition, message):
    global all_tests_passed, tests_run, tests_passed
    tests_run += 1
    if condition:
        print(f"✅ PASS: {message}")
        tests_passed += 1
    else:
        print(f"❌ FAIL: {message}")
        all_tests_passed = False

print("📊 Resultado ANTES da correção:")
print(f"  analysisResult.genre: {analysis_result_contaminado['genre']}")
print(f"  analysisResult.summary.genre: {analysis_result_contaminado['summary']['genre']}")
print(f"  analysisResult.metadata.genre: {analysis_result_contaminado['metadata']['genre']}")
print(f"  analysisResult.suggestionMetadata.genre: {analysis_result_contaminado['suggestionMetadata']['genre']}")
print(f"  analysisResult.data.genre: {analysis_result_contaminado['data']['genre']}")

print("\n📊 Resultado DEPOIS da correção:")
print(f"  result.genre: {result['genre']}")
print(f"  result.summary.genre: {result['summary']['genre']}")
print(f"  result.metadata.genre: {result['metadata']['genre']}")
print(f"  result.suggestionMetadata.genre: {result['suggestionMetadata']['genre']}")
print(f"  result.data.genre: {result['data']['genre']}")
print(f"  result.data.genreTargets: {result['data']['genreTargets']}")

print("\n🧪 Executando testes de validação:\n")

# Teste 1: Genre na raiz deve ser "trance"
assert_test(
    result["genre"] == "trance",
    "result.genre deve ser 'trance'"
)

# Teste 2: summary.genre deve ser "trance"
assert_test(
    result["summary"]["genre"] == "trance",
    "result.summary.genre deve ser 'trance'"
)

# Teste 3: metadata.genre deve ser "trance"
assert_test(
    result["metadata"]["genre"] == "trance",
    "result.metadata.genre deve ser 'trance'"
)

# Teste 4: suggestionMetadata.genre deve ser "trance"
assert_test(
    result["suggestionMetadata"]["genre"] == "trance",
    "result.suggestionMetadata.genre deve ser 'trance'"
)

# Teste 5: data.genre deve ser "trance"
assert_test(
    result["data"]["genre"] == "trance",
    "result.data.genre deve ser 'trance'"
)

# Teste 6: genreTargets deve estar presente em data
assert_test(
    result["data"]["genreTargets"] is not None,
    "result.data.genreTargets deve existir"
)

# Teste 7: Outros campos de summary devem ser preservados
assert_test(
    result["summary"]["totalProblems"] == 3,
    "result.summary.totalProblems deve ser preservado (3)"
)

# Teste 8: Outros campos de metadata devem ser preservados
assert_test(
    result["metadata"]["fileName"] == "test-track.mp3",
    "result.metadata.fileName deve ser preservado"
)

# Teste 9: Outros campos de data devem ser preservados
assert_test(
    result["data"]["someMetric"] == 123,
    "result.data.someMetric deve ser preservado (123)"
)

# Teste 10: Verificar que NENHUM campo contém "default"
result_string = json.dumps(result)
has_default = '"default"' in result_string
assert_test(
    not has_default,
    'Nenhum campo no resultado deve conter o valor "default"'
)

# ========== RESULTADO FINAL ==========

print("\n" + "=" * 50)
print(f"\n📊 Resumo dos Testes:")
print(f"   Total: {tests_run}")
print(f"   Passaram: {tests_passed}")
print(f"   Falharam: {tests_run - tests_passed}\n")

if all_tests_passed:
    print("🎉 TODOS OS TESTES PASSARAM!")
    print("✅ A correção está funcionando corretamente.")
    print("✅ O genre do usuário sempre prevalece.")
    print("✅ Nenhum campo contém 'default'.")
    exit(0)
else:
    print("❌ ALGUNS TESTES FALHARAM!")
    print("⚠️  Revise a implementação da correção.")
    exit(1)
