# Script para corrigir linha 2708 do audio-analyzer-integration.js

$filePath = "c:\Users\DJ Correa\Desktop\Programação\SoundyAI\public\audio-analyzer-integration.js"

# Ler todas as linhas
$lines = Get-Content $filePath -Encoding UTF8

# Encontrar e substituir as linhas 2708-2710
$foundIndex = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "await displayModalResults\(normalizedResult\);" -and $i -ge 2707 -and $i -le 2710) {
        $foundIndex = $i
        break
    }
}

if ($foundIndex -gt 0) {
    Write-Host "✅ Linha encontrada no índice: $foundIndex"
    
    # Criar novo conteúdo
    $newLines = @()
    
    # Adicionar linhas anteriores
    for ($i = 0; $i -lt $foundIndex; $i++) {
        $newLines += $lines[$i]
    }
    
    # Adicionar novo código
    $newLines += "            // 🔥 CORREÇÃO: Preparar dados para comparação A/B correta"
    $newLines += "            console.log('[REFERENCE-FLOW] Segunda música concluída');"
    $newLines += "            console.log('[REFERENCE-FLOW ✅] Montando comparação entre faixas');"
    $newLines += "            "
    $newLines += "            // Usar PRIMEIRA música como base do modal"
    $newLines += "            const userAnalysis = state.previousAnalysis || state.userAnalysis;"
    $newLines += "            const referenceAnalysisData = normalizedResult || state.referenceAnalysis;"
    $newLines += "            "
    $newLines += "            console.log('[REFERENCE-COMPARE] Valor = 1ª faixa:', userAnalysis?.fileName || userAnalysis?.metadata?.fileName);"
    $newLines += "            console.log('[REFERENCE-COMPARE] Alvo = 2ª faixa:', referenceAnalysisData?.fileName || referenceAnalysisData?.metadata?.fileName);"
    $newLines += "            "
    $newLines += "            // Marcar no normalizedResult que é modo referência com dados corretos"
    $newLines += "            normalizedResult._isReferenceMode = true;"
    $newLines += "            normalizedResult._userAnalysis = userAnalysis;"
    $newLines += "            normalizedResult._referenceAnalysis = referenceAnalysisData;"
    $newLines += "            "
    $newLines += "            await displayModalResults(normalizedResult);"
    $newLines += "            console.log('[FIX-REFERENCE] Modal aberto após segunda análise');"
    
    # Pular as linhas antigas (await displayModalResults e console.log)
    $skipIndex = $foundIndex + 1
    while ($skipIndex -lt $lines.Length -and $lines[$skipIndex] -match "console\.log\('\[FIX-REFERENCE\]") {
        $skipIndex++
    }
    
    # Adicionar linhas restantes
    for ($i = $skipIndex; $i -lt $lines.Length; $i++) {
        $newLines += $lines[$i]
    }
    
    # Salvar arquivo
    $newLines | Set-Content $filePath -Encoding UTF8
    
    Write-Host "✅ Arquivo modificado com sucesso!"
    Write-Host "Linhas adicionadas: 15"
    Write-Host "Linha original (índice $foundIndex): $($lines[$foundIndex])"
    
} else {
    Write-Host "❌ Linha não encontrada!"
}
