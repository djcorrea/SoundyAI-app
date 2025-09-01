# Script de Limpeza Segura - Corrigido
# Remove apenas documentação e arquivos temporários
# Data: 2025-08-23

Write-Host "Iniciando limpeza segura..."
Write-Host "Arquivos a remover: documentacao e debug apenas"

# Confirmar antes de prosseguir
$confirm = Read-Host "Deseja continuar com a limpeza? (s/N)"
if ($confirm -ne "s" -and $confirm -ne "S") {
    Write-Host "Operacao cancelada"
    exit 0
}

$removedCount = 0
$removedSize = 0

Write-Host "Removendo arquivos de documentacao..."

# Lista dos arquivos mais seguros para remover (documentação)
$docsToRemove = @(
    "ANALISE_FEEDBACK_DJ_SISTEMA_COMPLETO.md",
    "AUDITORIA_ANALYZER_COMPLETA.md",
    "AUDITORIA_COMPLETA_SISTEMA_AUDIO.md",
    "AUDITORIA_ESCALABILIDADE_COMPLETA.md",
    "AUDITORIA_MODO_REFERENCIA_FREQUENCIAS.md",
    "AUDITORIA_TECNICA_IMAGENS.md",
    "PATCH_A_INFRAESTRUTURA.md",
    "PATCH_B_NORMALIZACAO.md",
    "PATCH_C_OBSERVABILIDADE.md",
    "ATUALIZACAO_PROBLEMAS_MIX.md",
    "IMPLEMENTACAO_ESCALABILIDADE_COMPLETA.md",
    "IMPLEMENTACAO_SISTEMA_IMAGENS.md",
    "VERIFICACAO_ESCALABILIDADE_COMPLETA.md",
    "CONFIGURACAO_VERCEL_FIREBASE.md"
)

foreach ($file in $docsToRemove) {
    if (Test-Path $file) {
        $fileSize = (Get-Item $file).Length
        Remove-Item $file -Force
        Write-Host "Removido: $file"
        $removedCount++
        $removedSize += $fileSize
    }
}

Write-Host ""
Write-Host "Removendo arquivos HTML de debug..."

# Arquivos HTML de debug
$debugHtmlToRemove = @(
    "debug-analyzer-completo.html",
    "debug-subscore-precision.html",
    "debug-score-breakdown.html",
    "diagnostic-chat.html",
    "cache-diagnostic.html",
    "debug-upload-api.html",
    "critical-error-report.html",
    "debug-technical-problems.html",
    "validation-test.html",
    "debug-score-calculation.html",
    "debug-score-vs-interface.html",
    "debug-valores-problema.html",
    "debug-score-real-40.html",
    "debug-suggestion-logic.html",
    "correcao-aplicada.html",
    "debug-interpretation.html",
    "correcao-analise-espectral.html"
)

foreach ($file in $debugHtmlToRemove) {
    if (Test-Path $file) {
        $fileSize = (Get-Item $file).Length
        Remove-Item $file -Force
        Write-Host "Removido: $file"
        $removedCount++
        $removedSize += $fileSize
    }
}

Write-Host ""
Write-Host "Removendo scripts temporarios..."

# Scripts temporários seguros
$scriptsToRemove = @(
    "configurar-vercel-emergencia.ps1",
    "configurar-vercel-emergencia.sh",
    "limpar-deployments.ps1",
    "limpar-simples.ps1",
    "deploy-trigger.js"
)

foreach ($file in $scriptsToRemove) {
    if (Test-Path $file) {
        $fileSize = (Get-Item $file).Length
        Remove-Item $file -Force
        Write-Host "Removido: $file"
        $removedCount++
        $removedSize += $fileSize
    }
}

Write-Host ""
Write-Host "Removendo arquivos de texto temporarios..."

# Arquivos de texto temporários
$textFilesToRemove = @(
    "builder-trance.txt",
    "calibration-report-trance.txt",
    "cache-bust.txt"
)

foreach ($file in $textFilesToRemove) {
    if (Test-Path $file) {
        $fileSize = (Get-Item $file).Length
        Remove-Item $file -Force
        Write-Host "Removido: $file"
        $removedCount++
        $removedSize += $fileSize
    }
}

Write-Host ""
Write-Host "Limpeza concluida!"
Write-Host "Arquivos removidos: $removedCount"
Write-Host "Espaco liberado: $([math]::Round($removedSize/1KB, 2)) KB"

Write-Host ""
Write-Host "Verificando arquivos criticos preservados..."
if (Test-Path "debug-analyzer.js") { Write-Host "debug-analyzer.js - PRESERVADO" }
if (Test-Path "dev-server.js") { Write-Host "dev-server.js - PRESERVADO" }
if (Test-Path "public\index.html") { Write-Host "public\index.html - PRESERVADO" }
if (Test-Path "package.json") { Write-Host "package.json - PRESERVADO" }

Write-Host ""
Write-Host "Limpeza segura concluida com sucesso!"
