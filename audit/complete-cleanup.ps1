# Script de Limpeza COMPLETA - Todos os arquivos desnecessários
# Remove: relatórios, testes, debug, documentação de processo

Write-Host "🧹 LIMPEZA COMPLETA - Removendo TODOS os arquivos desnecessários"
Write-Host "⚠️ Esta operação vai remover centenas de arquivos de teste/debug/relatórios"

# Confirmar antes de prosseguir
$confirm = Read-Host "Tem certeza que deseja continuar? Digite 'SIM' para confirmar"
if ($confirm -ne "SIM") {
    Write-Host "Operacao cancelada"
    exit 0
}

$removedCount = 0
$removedSize = 0

Write-Host ""
Write-Host "📝 Removendo TODOS os relatórios (.md)..."

# TODOS os relatórios e documentação de processo
$allReports = @(
    "AUDITORIA_SCORE_GERAL.html",
    "CARDS_DIDATICOS_IMPLEMENTACAO.md",
    "CORRECAO_ANALISE_AUDIO_MODAL.md",
    "CORRECAO_BUG_MODO_REFERENCIA_FINAL.md",
    "CORRECAO_CHAT_BOTAO_PLUS_FINALIZADA.md",
    "CORRECAO_FINAL_INTERFACE_PRESERVADA.md",
    "CORRECAO_FINAL_MODO_REFERENCIA.md",
    "CORRECAO_FINAL_MODO_REFERENCIA_COMPLETA.md",
    "CORRECAO_FREQUENCIAS_APLICADA.md",
    "CORRECAO_FREQUENCIAS_BANDS.md",
    "CORRECAO_INCONSISTENCIA_CLIPPING.md",
    "CORRECAO_LAYOUT_IMPLEMENTACAO_IMAGENS.md",
    "CORRECAO_MODO_REFERENCIA_FINALIZADA.md",
    "CORRECAO_Score_Stereo.html",
    "CORRECAO_SISTEMA_IMAGENS_FINALIZADA.md",
    "CORRECOES_AUDITORIA_APLICADAS.md",
    "DIAGNOSTICO_MODO_REFERENCIA.md",
    "DIAGNOSTIC_PATCH.md",
    "ENHANCED_SYSTEM_IMPLEMENTATION.md",
    "ETAPA_1_CRITICAS_CONCLUIDA.md",
    "HOTFIX_SITE_RESTAURADO.md",
    "INVESTIGACAO_PROBLEMAS_TECNICOS.md",
    "LIMITE_60MB_SIMPLES.md",
    "LOG_FIXED_FLEX_IMPLEMENTATION.md",
    "PLANO_AUDITORIA_COMPLETA.md",
    "PLANO_ESCALABILIDADE_IMPLEMENTACAO.md",
    "POST_DEPLOY_CHECKLIST.md",
    "PROBLEMA_CRITICO_IDENTIFICADO.md",
    "PROBLEMA_RESOLVIDO_Score_vs_Interface.html",
    "README_MELHORIAS_FINAIS.md",
    "RELATORIO_AUDITORIA_SCORE_FINAL.md",
    "RELATORIO_AUDITORIA_SUGESTOES_CARD.md",
    "RELATORIO_CORRECAO_BANDAS_ESPECTAIS_FINAL.md",
    "RELATORIO_CORRECAO_BANDAS_ESPECTRAIS.md",
    "RELATORIO_CORRECAO_BUG_TOLERANCIA.md",
    "RELATORIO_CORRECAO_CLIPPING.md",
    "RELATORIO_CORRECAO_FINAL.md",
    "RELATORIO_CORRECAO_FINALIZADA.md",
    "RELATORIO_CORRECAO_FINAL_BANDAS.md",
    "RELATORIO_CORRECAO_LOGICA_FUNDAMENTAL.md",
    "RELATORIO_CORRECAO_SUGESTOES_IA.md",
    "RELATORIO_CORRECAO_TOTAL_FINALIZADA.md",
    "RELATORIO_CORRECOES_CRITICAS.md",
    "RELATORIO_FINAL_CORRECAO_BANDAS.md",
    "RELATORIO_FINAL_CORRECAO_BUG.md",
    "RELATORIO_FINAL_CORRECAO_SUBSCORES.md",
    "RELATORIO_FINAL_LABELS_V2.md",
    "RELATORIO_FUNK_MANDELA_V3.md",
    "RELATORIO_IMPLEMENTACAO_IMAGENS_CHAT.md",
    "RELATORIO_LABELS_AMIGAVEIS.md",
    "RELATORIO_LIMPEZA_FINAL.md",
    "RELATORIO_PADRONIZACAO_BANDAS_EQ.md",
    "RELATORIO_SISTEMA_EDUCATIVO_RESTAURADO.md",
    "RELATORIO_TESTES_FASE4.md",
    "RESUMO_DIAGNOSTICO.md",
    "SISTEMA_IMAGENS_FUNCIONANDO.md",
    "STATUS_LANCAMENTO_PRONTO.md",
    "TESTE_CORRECOES_IMPLEMENTADAS.md"
)

foreach ($file in $allReports) {
    if (Test-Path $file) {
        $fileSize = (Get-Item $file).Length
        Remove-Item $file -Force
        Write-Host "Removido: $file"
        $removedCount++
        $removedSize += $fileSize
    }
}

Write-Host ""
Write-Host "🐛 Removendo TODOS os arquivos de debug HTML..."

# TODOS os arquivos de debug HTML
$allDebugHtml = @(
    "correcao-definitiva.html",
    "debug-bandas-espectrais.html",
    "debug-pushrow-test.html",
    "diagnostic-sequencial.html",
    "sistema-bandas-padronizadas.html",
    "sistema-com-emergencia.html",
    "sistema-funcionando-corrigido.html",
    "test-ai-suggestions-friendly.html",
    "test-all-metrics.html",
    "test-api-url.html",
    "test-band-prefix-fix.html",
    "test-bandas-educativas.html",
    "test-bug-fix-validation.html",
    "test-chat-plus-button.html",
    "test-clipping-consistency.html",
    "test-clipping-debug.html",
    "test-clipping-fixes.html",
    "test-complete-system.html",
    "test-correcao-bug-tolerancia.html",
    "test-corrections.html",
    "test-critical-clipping-cards.html",
    "test-final-reference-fix.html",
    "test-final-working.html",
    "test-fixed-flex-structure.html",
    "test-friendly-labels-complete.html",
    "test-friendly-labels.html",
    "test-funk-mandela-v3.html",
    "test-genre-system.html",
    "test-image-final.html",
    "test-inverted-calculation.html",
    "test-logic-fixed.html",
    "test-mix-problems.html",
    "test-reference-logic.html",
    "test-reference-mode-final.html",
    "test-reference-mode.html",
    "test-sistema-completo-clipping.html",
    "test-smart-technical-problems.html",
    "test-spectral-bands-fix.html",
    "test-subscore-precision.html",
    "test-tolerancias-aumentadas.html",
    "test-upload-60mb.html",
    "test-upload-patch.html",
    "test-validation.html",
    "teste-chat-simples.html",
    "teste-correcao-direta.html",
    "teste-correcao-eq-final.html",
    "teste-direto-targets.html",
    "teste-direto.html",
    "teste-eq-labels-working.html",
    "teste-final-correcao-subscores.html",
    "teste-final-correcao.html",
    "teste-final.html",
    "teste-forcado-correcao.html",
    "teste-inline-definitivo.html",
    "teste-padronizacao-bandas.html",
    "teste-score-real.html",
    "teste-sistema-educativo-clipping.html",
    "teste-sistema-profissional.html",
    "teste-sistema-real.html",
    "teste-urgente-subscores.html",
    "teste-valores-corrigidos.html",
    "TESTE_MELHORIAS_SCORE.html",
    "URGENTE_Score_40_Incorreto.html",
    "validate-subscore-precision-final.html",
    "verificar-escalabilidade.html",
    "debug-targets-funk.html"
)

foreach ($file in $allDebugHtml) {
    if (Test-Path $file) {
        $fileSize = (Get-Item $file).Length
        Remove-Item $file -Force
        Write-Host "Removido: $file"
        $removedCount++
        $removedSize += $fileSize
    }
}

Write-Host ""
Write-Host "📜 Removendo TODOS os scripts de teste JS..."

# TODOS os scripts de teste
$allTestScripts = @(
    "correcao-emergencia.js",
    "critical-subscore-fix.js",
    "debug-score.js",
    "debug-server.js",
    "debug-temp-v2-scoring.js",
    "fix-bandas-direto.js",
    "fix-subscore-definitivo.js",
    "fix_prompts.js",
    "performance-fix.js",
    "simple-server.js",
    "simple-test-server.js",
    "temp-v2.js",
    "test-chat-api.js",
    "test-endpoint-direct.js",
    "test-openai-direct.js",
    "test-server.js",
    "teste-analise-precisa.js",
    "teste-caso-atual.js",
    "teste-consistencia-scores.js",
    "teste-correcao-validacao.js",
    "teste-deteccao-eq-extremo.js",
    "teste-nao-duplicacao.js",
    "update-funk-mandela-v3.js",
    "validate-fixed-flex.js",
    "validate-system.js"
)

foreach ($file in $allTestScripts) {
    if (Test-Path $file) {
        $fileSize = (Get-Item $file).Length
        Remove-Item $file -Force
        Write-Host "Removido: $file"
        $removedCount++
        $removedSize += $fileSize
    }
}

Write-Host ""
Write-Host "🗂️ Removendo arquivos diversos de teste..."

# Arquivos diversos
$miscFiles = @(
    "performance-fix.css",
    "test-audio.mp3",
    "test-api-acceptance.sh",
    "teste-final.ps1",
    "metrics-spec.md",
    ".audit-temp-files.txt"
)

foreach ($file in $miscFiles) {
    if (Test-Path $file) {
        $fileSize = (Get-Item $file).Length
        Remove-Item $file -Force
        Write-Host "Removido: $file"
        $removedCount++
        $removedSize += $fileSize
    }
}

Write-Host ""
Write-Host "📁 Removendo diretórios de teste vazios..."

# Diretórios que podem estar vazios
$testDirs = @("analyzer", "docs", "out", "tests")
foreach ($dir in $testDirs) {
    if (Test-Path $dir) {
        $items = Get-ChildItem $dir -Recurse
        if ($items.Count -eq 0) {
            Remove-Item $dir -Recurse -Force
            Write-Host "Removido diretorio vazio: $dir"
        } else {
            Write-Host "Mantido $dir (nao vazio)"
        }
    }
}

Write-Host ""
Write-Host "Limpeza COMPLETA concluida!"
Write-Host "Arquivos removidos: $removedCount"
Write-Host "Espaco liberado: $([math]::Round($removedSize/1KB, 2)) KB"

Write-Host ""
Write-Host "Verificando arquivos criticos preservados..."
if (Test-Path "debug-analyzer.js") { Write-Host "debug-analyzer.js - PRESERVADO" }
if (Test-Path "dev-server.js") { Write-Host "dev-server.js - PRESERVADO" }
if (Test-Path "dev-server-fixed.js") { Write-Host "dev-server-fixed.js - PRESERVADO" }
if (Test-Path "server.js") { Write-Host "server.js - PRESERVADO" }
if (Test-Path "public\index.html") { Write-Host "public\index.html - PRESERVADO" }
if (Test-Path "package.json") { Write-Host "package.json - PRESERVADO" }

Write-Host ""
Write-Host "LIMPEZA COMPLETA CONCLUIDA COM SUCESSO!"
