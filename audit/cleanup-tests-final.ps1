# ===============================================
# SCRIPT DE LIMPEZA FINAL - ARQUIVOS DE TESTE
# ===============================================

Write-Host "=== LIMPEZA FINAL - ARQUIVOS DE TESTE ===" -ForegroundColor Yellow

# Lista de arquivos de teste para remover
$testFiles = @(
    # Arquivos de teste HTML
    "public\test-complete-system.html",
    "public\test-complete-image-analysis.html",
    "public\test-config.html",
    "public\test-enhanced-system.html",
    "public\test-final-clean.html",
    "public\test-didactic-cards.html",
    "public\test-diagnostic.html",
    "public\test-definitivo.html",
    "public\test-console-errors.html",
    "public\test-image-analysis-real.html",
    "public\test-final-complete.html",
    "public\test-image-upload.html",
    "public\teste-escalabilidade.html",
    "public\teste-direto.html",
    "public\teste-ultra-simples.html",
    "public\teste-sistema-funcionando.html",
    "public\teste-diagnostico.html",
    "public\teste-cache-bypass.html",
    "public\teste-build-version-debug.html",
    
    # Diretorio de testes
    "public\test\",
    
    # Arquivos de debug (preservando debug-analyzer.js que e usado)
    "public\debug-simple.js",
    "public\debug-modal.html",
    "public\debug-image-system.html",
    "debug-sistema-bandas.html",
    
    # Backup folder completo
    ".backup-cleanup-2025-08-23_12-12-14\"
)

$removedCount = 0
$totalSize = 0

foreach ($file in $testFiles) {
    $fullPath = Join-Path $PWD $file
    
    if (Test-Path $fullPath) {
        try {
            # Calcular tamanho
            if (Test-Path $fullPath -PathType Container) {
                $size = (Get-ChildItem -Path $fullPath -Recurse -Force | Measure-Object -Property Length -Sum).Sum
                Write-Host "Removendo diretorio: $file ($(($size/1KB).ToString('F2')) KB)" -ForegroundColor Red
                Remove-Item -Path $fullPath -Recurse -Force
            } else {
                $size = (Get-Item $fullPath).Length
                Write-Host "Removendo arquivo: $file ($(($size/1KB).ToString('F2')) KB)" -ForegroundColor Red
                Remove-Item -Path $fullPath -Force
            }
            
            $totalSize += $size
            $removedCount++
        }
        catch {
            Write-Host "ERRO ao remover $file : $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Nao encontrado: $file" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=== RESULTADO DA LIMPEZA FINAL ===" -ForegroundColor Green
Write-Host "Arquivos/diretorios removidos: $removedCount" -ForegroundColor Green
Write-Host "Espaco liberado: $(($totalSize/1KB).ToString('F2')) KB" -ForegroundColor Green
Write-Host ""

# Verificar se ainda restam arquivos de teste
Write-Host "=== VERIFICANDO ARQUIVOS DE TESTE RESTANTES ===" -ForegroundColor Yellow

$remainingTests = Get-ChildItem -Path "public" -Filter "*test*" -Recurse -Force 2>$null
$remainingDebug = Get-ChildItem -Path "." -Filter "*debug*" -Recurse -Force | Where-Object { $_.Name -ne "debug-analyzer.js" } 2>$null

if ($remainingTests) {
    Write-Host "Arquivos de teste restantes:" -ForegroundColor Yellow
    $remainingTests | ForEach-Object { Write-Host "  - $($_.FullName)" -ForegroundColor Gray }
}

if ($remainingDebug) {
    Write-Host "Arquivos de debug restantes:" -ForegroundColor Yellow
    $remainingDebug | ForEach-Object { Write-Host "  - $($_.FullName)" -ForegroundColor Gray }
}

if (-not $remainingTests -and -not $remainingDebug) {
    Write-Host "Nenhum arquivo de teste/debug restante encontrado!" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== LIMPEZA FINAL CONCLUIDA ===" -ForegroundColor Green
