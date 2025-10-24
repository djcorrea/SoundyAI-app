# 🎯 SCRIPT AUTOMATIZADO - REMOÇÃO DE BPM
# Data: 23 de outubro de 2025
# Objetivo: Aplicar todas as mudanças de forma segura e automatizada

Write-Host "🎯 REMOÇÃO DE BPM - SCRIPT AUTOMATIZADO" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Verificar se estamos no diretório correto
if (!(Test-Path "api/audio/core-metrics.js")) {
    Write-Host "❌ Erro: Execute este script no diretório work/" -ForegroundColor Red
    exit 1
}

# 1. Criar branch
Write-Host "📦 1. Criando branch perf/remove-bpm..." -ForegroundColor Yellow
git checkout -b perf/remove-bpm
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Branch já existe ou erro ao criar. Continuando..." -ForegroundColor Yellow
}

Write-Host "✅ Branch criado" -ForegroundColor Green
Write-Host ""

# 2. Backup dos arquivos originais
Write-Host "💾 2. Criando backups dos arquivos..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = ".backup_bpm_removal_$timestamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$filesToBackup = @(
    "api/audio/core-metrics.js",
    "lib/audio/features/context-detector.js",
    "lib/audio/features/reference-matcher.js",
    "tools/perf/verify-parity.js",
    "tools/perf/INSTRUMENTATION_EXAMPLE.js"
)

foreach ($file in $filesToBackup) {
    if (Test-Path $file) {
        $destPath = Join-Path $backupDir $file
        $destDir = Split-Path $destPath -Parent
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        Copy-Item $file $destPath -Force
        Write-Host "   ✅ Backup: $file" -ForegroundColor Green
    }
}

Write-Host "✅ Backups salvos em: $backupDir" -ForegroundColor Green
Write-Host ""

# 3. Informar usuário sobre modificações manuais necessárias
Write-Host "⚠️  3. MODIFICAÇÕES NECESSÁRIAS (Manual ou via Editor):" -ForegroundColor Yellow
Write-Host ""
Write-Host "📝 Arquivo: api/audio/core-metrics.js" -ForegroundColor Cyan
Write-Host "   ┣━ Linha 249-256: Substituir seção BPM por:"
Write-Host '   ┃  // ========= BPM REMOVED - performance optimization =========' -ForegroundColor Gray
Write-Host '   ┃  const bpmMetrics = { bpm: null, bpmConfidence: null, bpmSource: "DISABLED" };' -ForegroundColor Gray
Write-Host ""
Write-Host "   ┣━ Linha 280-282: Substituir por:"
Write-Host '   ┃  bpm: null, // BPM REMOVED - performance optimization' -ForegroundColor Gray
Write-Host '   ┃  bpmConfidence: null, // BPM REMOVED - performance optimization' -ForegroundColor Gray
Write-Host '   ┃  bpmSource: "DISABLED", // BPM REMOVED - performance optimization' -ForegroundColor Gray
Write-Host ""
Write-Host "   ┗━ Linha 1315-1770: Remover 6 métodos (~455 linhas):" -ForegroundColor Red
Write-Host "      • calculateBpmMetrics() (linha 1315-1410)" -ForegroundColor Red
Write-Host "      • calculateMusicTempoBpm() (linha 1413-1435)" -ForegroundColor Red
Write-Host "      • calculateAdvancedOnsetBpm() (linha 1437-1487)" -ForegroundColor Red
Write-Host "      • calculateAutocorrelationBpm() (linha 1490-1563)" -ForegroundColor Red
Write-Host "      • calculateBpmFromOnsets() (linha 1582-1625)" -ForegroundColor Red
Write-Host "      • crossValidateBpmResults() (linha 1628-1770)" -ForegroundColor Red
Write-Host ""

Write-Host "📝 Arquivo: lib/audio/features/context-detector.js" -ForegroundColor Cyan
Write-Host "   ┣━ Linha 40-56: Substituir função autocorrelateTempo() por:"
Write-Host '   ┃  function autocorrelateTempo(x, time) {' -ForegroundColor Gray
Write-Host '   ┃    return { bpm: null, confidence: null, bestR: null };' -ForegroundColor Gray
Write-Host '   ┃  }' -ForegroundColor Gray
Write-Host ""
Write-Host "   ┗━ Linha 124-133: Retornar valores fixos:"
Write-Host '   ┃  bpm: null, // BPM REMOVED' -ForegroundColor Gray
Write-Host '   ┃  bpmConfidence: null, // BPM REMOVED' -ForegroundColor Gray
Write-Host ""

Write-Host "📝 Arquivo: lib/audio/features/reference-matcher.js" -ForegroundColor Cyan
Write-Host "   ┣━ Linha 36-39: Comentar cálculo de distância BPM"
Write-Host "   ┗━ Linha 75: Ajustar peso de BPM para 0"
Write-Host ""

Write-Host "📝 Arquivo: tools/perf/verify-parity.js" -ForegroundColor Cyan
Write-Host "   ┣━ Linha 37: Comentar tolerância BPM"
Write-Host "   ┗━ Linha 176-181: Comentar validação BPM"
Write-Host ""

Write-Host "📝 Arquivo: tools/perf/INSTRUMENTATION_EXAMPLE.js" -ForegroundColor Cyan
Write-Host "   ┗━ Linha 98: Adicionar nota de deprecação"
Write-Host ""

# 4. Aguardar confirmação do usuário
Write-Host "⏸️  PAUSE: Aplique as modificações acima manualmente." -ForegroundColor Yellow
Write-Host "   Use o arquivo BPM_REMOVAL_AUDIT.md como guia detalhado." -ForegroundColor Yellow
Write-Host ""
$confirmation = Read-Host "Pressione ENTER quando concluir as modificações (ou Ctrl+C para cancelar)"

# 5. Validação de sintaxe
Write-Host ""
Write-Host "🔍 4. Validando sintaxe dos arquivos modificados..." -ForegroundColor Yellow
$hasErrors = $false

foreach ($file in $filesToBackup) {
    if ($file -like "*.js") {
        Write-Host "   Validando: $file" -ForegroundColor Gray
        node --check $file 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ $file" -ForegroundColor Green
        } else {
            Write-Host "   ❌ $file tem erros de sintaxe" -ForegroundColor Red
            $hasErrors = $true
        }
    }
}

if ($hasErrors) {
    Write-Host ""
    Write-Host "❌ Erros de sintaxe detectados. Corrija antes de continuar." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Todos os arquivos passaram na validação de sintaxe" -ForegroundColor Green
Write-Host ""

# 6. Commit das mudanças
Write-Host "💾 5. Commitando mudanças..." -ForegroundColor Yellow
git add .
git commit -m "perf: Remove BPM calculation for 30% performance gain

- Remove calculateBpmMetrics and all BPM methods (~455 lines)
- Disable BPM in context-detector.js
- Remove BPM distance from reference-matcher.js
- Update verify-parity.js to skip BPM validation

BREAKING CHANGE: BPM metrics now always return null

Performance:
- Before: ~150s
- After: ~104s (expected)
- Gain: -46s (-30%)

Files modified:
- work/api/audio/core-metrics.js
- work/lib/audio/features/context-detector.js
- work/lib/audio/features/reference-matcher.js
- work/tools/perf/verify-parity.js
- work/tools/perf/INSTRUMENTATION_EXAMPLE.js

See BPM_REMOVAL_AUDIT.md for complete details."

Write-Host "✅ Mudanças commitadas" -ForegroundColor Green
Write-Host ""

# 7. Instruções finais
Write-Host "🎉 REMOÇÃO DE BPM CONCLUÍDA!" -ForegroundColor Green
Write-Host "═══════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "📋 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  Testar pipeline completo:" -ForegroundColor Yellow
Write-Host "   node api/audio/pipeline-complete.js" -ForegroundColor Gray
Write-Host "   (ou) node test-pipeline-complete.js" -ForegroundColor Gray
Write-Host ""
Write-Host "2️⃣  Rodar benchmark de performance:" -ForegroundColor Yellow
Write-Host "   npm run perf:baseline" -ForegroundColor Gray
Write-Host "   (esperar ~7-10min, comparar com baseline anterior)" -ForegroundColor Gray
Write-Host ""
Write-Host "3️⃣  Validar paridade de outras métricas:" -ForegroundColor Yellow
Write-Host "   npm run perf:parity results/before.json results/after.json" -ForegroundColor Gray
Write-Host "   (garantir PASS em LUFS, Peak, RMS, DR, Bandas, etc.)" -ForegroundColor Gray
Write-Host ""
Write-Host "4️⃣  Criar Pull Request:" -ForegroundColor Yellow
Write-Host "   git push origin perf/remove-bpm" -ForegroundColor Gray
Write-Host "   (anexar BPM_REMOVAL_AUDIT.md e resultados de benchmark)" -ForegroundColor Gray
Write-Host ""
Write-Host "📂 BACKUPS SALVOS EM:" -ForegroundColor Cyan
Write-Host "   $backupDir" -ForegroundColor Gray
Write-Host "   (Use para rollback se necessário)" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 DOCUMENTAÇÃO COMPLETA:" -ForegroundColor Cyan
Write-Host "   work/BPM_REMOVAL_AUDIT.md" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Script concluído com sucesso!" -ForegroundColor Green
