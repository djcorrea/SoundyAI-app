#!/usr/bin/env pwsh
# 🧪 Script de Teste: Validar Ativação do Granular V1
# Para Windows PowerShell

Write-Host "🧪 TESTE: GRANULAR_V1 ENGINE" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar .env
Write-Host "1️⃣ Verificando configuração do .env..." -ForegroundColor Yellow
$envPath = ".env"

if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    if ($envContent -match "ANALYZER_ENGINE=granular_v1") {
        Write-Host "   ✅ ANALYZER_ENGINE=granular_v1 encontrado" -ForegroundColor Green
    } else {
        Write-Host "   ❌ ANALYZER_ENGINE=granular_v1 NÃO encontrado" -ForegroundColor Red
        Write-Host "   Adicione a linha: ANALYZER_ENGINE=granular_v1" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ Arquivo .env não encontrado" -ForegroundColor Red
}
Write-Host ""

# 2. Verificar imports no core-metrics.js
Write-Host "2️⃣ Verificando imports no core-metrics.js..." -ForegroundColor Yellow
$coreMetricsPath = "work\api\audio\core-metrics.js"

if (Test-Path $coreMetricsPath) {
    $coreContent = Get-Content $coreMetricsPath -Raw
    if ($coreContent -match "import.*analyzeGranularSpectralBands") {
        Write-Host "   ✅ Import de analyzeGranularSpectralBands encontrado" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Import de analyzeGranularSpectralBands NÃO encontrado" -ForegroundColor Red
    }
    
    if ($coreContent -match "async calculateSpectralBandsMetrics") {
        Write-Host "   ✅ Função calculateSpectralBandsMetrics encontrada" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Função calculateSpectralBandsMetrics NÃO encontrada" -ForegroundColor Red
    }
    
    if ($coreContent -match "async calculateGranularSubBands") {
        Write-Host "   ✅ Função calculateGranularSubBands encontrada" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Função calculateGranularSubBands NÃO encontrada" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ Arquivo core-metrics.js não encontrado" -ForegroundColor Red
}
Write-Host ""

# 3. Verificar json-output.js
Write-Host "3️⃣ Verificando json-output.js..." -ForegroundColor Yellow
$jsonOutputPath = "work\api\audio\json-output.js"

if (Test-Path $jsonOutputPath) {
    $jsonContent = Get-Content $jsonOutputPath -Raw
    if ($jsonContent -match "granular_v1") {
        Write-Host "   ✅ Estrutura granular_v1 encontrada no JSON output" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Estrutura granular_v1 NÃO encontrada no JSON output" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ Arquivo json-output.js não encontrado" -ForegroundColor Red
}
Write-Host ""

# 4. Verificar status do PM2
Write-Host "4️⃣ Verificando workers no PM2..." -ForegroundColor Yellow
$pm2Status = pm2 list 2>&1

if ($pm2Status -match "workers") {
    Write-Host "   ✅ Worker 'workers' encontrado no PM2" -ForegroundColor Green
    
    # Verificar se está online
    if ($pm2Status -match "online") {
        Write-Host "   ✅ Worker está ONLINE" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Worker NÃO está online" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️ Worker 'workers' não encontrado no PM2" -ForegroundColor Yellow
}
Write-Host ""

# 5. Sugestões
Write-Host "🚀 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "1. Reiniciar worker:" -ForegroundColor White
Write-Host "   pm2 restart workers" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Monitorar logs:" -ForegroundColor White
Write-Host "   pm2 logs workers --lines 100" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Procurar nos logs:" -ForegroundColor White
Write-Host "   ✅ [SPECTRAL_BANDS] Engine granular_v1 ativado" -ForegroundColor Gray
Write-Host "   🌈 [GRANULAR_V1] Iniciando análise granular" -ForegroundColor Gray
Write-Host "   ✅ [GRANULAR_V1] Análise concluída: X sub-bandas" -ForegroundColor Gray
Write-Host "   🌈 [JSON_OUTPUT] Incluindo campos granular_v1" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Fazer upload de áudio no frontend" -ForegroundColor White
Write-Host ""
Write-Host "5. Verificar JSON de resposta:" -ForegroundColor White
Write-Host "   - spectralBands.engineVersion: 'granular_v1'" -ForegroundColor Gray
Write-Host "   - spectralBands.granular: [13 sub-bandas]" -ForegroundColor Gray
Write-Host "   - spectralBands.suggestions: [sugestões]" -ForegroundColor Gray
Write-Host ""

Write-Host "📄 Documentação completa em:" -ForegroundColor Cyan
Write-Host "   - RESUMO_CORRECAO_GRANULAR_V1.md" -ForegroundColor Gray
Write-Host "   - CORRECAO_ROTEADOR_GRANULAR_V1.md" -ForegroundColor Gray
Write-Host ""
