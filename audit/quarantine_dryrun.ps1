# Script de Quarentena - Dry Run
# Data: 2025-08-23T15:00:06.695Z
# Total de arquivos: 0

Write-Host "🔍 Iniciando quarentena dry-run..."
Write-Host "📁 Criando diretório de quarentena..."
New-Item -ItemType Directory -Path ".quarantine" -Force | Out-Null

Write-Host "🧪 Testando build..."
npm run build
$buildResult = $LASTEXITCODE

if ($buildResult -eq 0) {
    Write-Host "✅ Build passou! Quarentena bem-sucedida."
} else {
    Write-Host "❌ Build falhou! Revertendo mudanças..."
    if (Test-Path ".quarantine") {
        Get-ChildItem ".quarantine" -Recurse -File | ForEach-Object {
            $originalPath = $_.FullName -replace [regex]::Escape((Resolve-Path ".quarantine").Path + "\\"), ""
            $originalDir = Split-Path $originalPath -Parent
            if ($originalDir) {
                New-Item -ItemType Directory -Path $originalDir -Force | Out-Null
            }
            Move-Item $_.FullName $originalPath -Force
            Write-Host "↩️ Revertido: $originalPath"
        }
        Remove-Item ".quarantine" -Recurse -Force
    }
    exit 1
}

Write-Host "🎉 Quarentena concluída com sucesso!"
Write-Host "💡 Para reverter: Execute o script de restore ou mova arquivos de .quarantine de volta"
