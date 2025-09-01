# ===============================================
# LIMPEZA FINAL DOS ULTIMOS ARQUIVOS DE TESTE
# ===============================================

Write-Host "=== REMOVENDO ULTIMOS ARQUIVOS DE TESTE ===" -ForegroundColor Yellow

$remainingTestFiles = @(
    "public\test-layout.html",
    "public\test-modal.html",
    "public\test-music-system.html",
    "public\test-quick-image.html",
    "public\test-signals-clean.js",
    "public\test-simple.html",
    "public\test-sistema.html",
    "public\test-super-simple.html",
    "public\test-v2-critical.html",
    "public\test-voice-errors.html"
)

$removedCount = 0
$totalSize = 0

foreach ($file in $remainingTestFiles) {
    $fullPath = Join-Path $PWD $file
    
    if (Test-Path $fullPath) {
        try {
            $size = (Get-Item $fullPath).Length
            Write-Host "Removendo: $file ($(($size/1KB).ToString('F2')) KB)" -ForegroundColor Red
            Remove-Item -Path $fullPath -Force
            $totalSize += $size
            $removedCount++
        }
        catch {
            Write-Host "ERRO ao remover $file : $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "=== RESULTADO ===" -ForegroundColor Green
Write-Host "Arquivos removidos: $removedCount" -ForegroundColor Green
Write-Host "Espaco liberado: $(($totalSize/1KB).ToString('F2')) KB" -ForegroundColor Green

# Verificacao final
$finalCheck = Get-ChildItem -Path "public" -Filter "*test*" -Force 2>$null
if ($finalCheck) {
    Write-Host ""
    Write-Host "AINDA RESTAM ARQUIVOS DE TESTE:" -ForegroundColor Yellow
    $finalCheck | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Gray }
} else {
    Write-Host ""
    Write-Host "TODOS OS ARQUIVOS DE TESTE FORAM REMOVIDOS!" -ForegroundColor Green
}
