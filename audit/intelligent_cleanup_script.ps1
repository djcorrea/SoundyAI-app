# Script de Limpeza Inteligente
# Remove apenas documentação e arquivos temporários
# Data: 2025-08-23T15:08:40.530Z

Write-Host "🧹 Iniciando limpeza inteligente..."
Write-Host "📁 Arquivos a remover: 185"
Write-Host "💾 Espaço a liberar: 848.26 KB"

# Confirmar antes de prosseguir
$confirm = Read-Host "Deseja continuar? (s/N)"
if ($confirm -ne "s" -and $confirm -ne "S") {
    Write-Host "❌ Operação cancelada"
    exit 0
}

$removedCount = 0
$removedSize = 0

# Documentação: audit/unused_files_report.json
if (Test-Path "audit/unused_files_report.json") {
    $fileSize = (Get-Item "audit/unused_files_report.json").Length
    Remove-Item "audit/unused_files_report.json" -Force
    Write-Host "✅ Removido: audit/unused_files_report.json ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: audit/unused_files_report.json"
}

# Documentação: PATCH_C_OBSERVABILIDADE.md
if (Test-Path "PATCH_C_OBSERVABILIDADE.md") {
    $fileSize = (Get-Item "PATCH_C_OBSERVABILIDADE.md").Length
    Remove-Item "PATCH_C_OBSERVABILIDADE.md" -Force
    Write-Host "✅ Removido: PATCH_C_OBSERVABILIDADE.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: PATCH_C_OBSERVABILIDADE.md"
}

# Documentação: audit/unused_files_report.md
if (Test-Path "audit/unused_files_report.md") {
    $fileSize = (Get-Item "audit/unused_files_report.md").Length
    Remove-Item "audit/unused_files_report.md" -Force
    Write-Host "✅ Removido: audit/unused_files_report.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: audit/unused_files_report.md"
}

# Debug HTML: debug-analyzer-completo.html
if (Test-Path "debug-analyzer-completo.html") {
    $fileSize = (Get-Item "debug-analyzer-completo.html").Length
    Remove-Item "debug-analyzer-completo.html" -Force
    Write-Host "✅ Removido: debug-analyzer-completo.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-analyzer-completo.html"
}

# Documentação: PATCH_B_NORMALIZACAO.md
if (Test-Path "PATCH_B_NORMALIZACAO.md") {
    $fileSize = (Get-Item "PATCH_B_NORMALIZACAO.md").Length
    Remove-Item "PATCH_B_NORMALIZACAO.md" -Force
    Write-Host "✅ Removido: PATCH_B_NORMALIZACAO.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: PATCH_B_NORMALIZACAO.md"
}

# Documentação: AUDITORIA_TECNICA_IMAGENS.md
if (Test-Path "AUDITORIA_TECNICA_IMAGENS.md") {
    $fileSize = (Get-Item "AUDITORIA_TECNICA_IMAGENS.md").Length
    Remove-Item "AUDITORIA_TECNICA_IMAGENS.md" -Force
    Write-Host "✅ Removido: AUDITORIA_TECNICA_IMAGENS.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: AUDITORIA_TECNICA_IMAGENS.md"
}

# Documentação: audit/analyze-files.js
if (Test-Path "audit/analyze-files.js") {
    $fileSize = (Get-Item "audit/analyze-files.js").Length
    Remove-Item "audit/analyze-files.js" -Force
    Write-Host "✅ Removido: audit/analyze-files.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: audit/analyze-files.js"
}

# Debug HTML: debug-subscore-precision.html
if (Test-Path "debug-subscore-precision.html") {
    $fileSize = (Get-Item "debug-subscore-precision.html").Length
    Remove-Item "debug-subscore-precision.html" -Force
    Write-Host "✅ Removido: debug-subscore-precision.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-subscore-precision.html"
}

# Documentação: PATCH_A_INFRAESTRUTURA.md
if (Test-Path "PATCH_A_INFRAESTRUTURA.md") {
    $fileSize = (Get-Item "PATCH_A_INFRAESTRUTURA.md").Length
    Remove-Item "PATCH_A_INFRAESTRUTURA.md" -Force
    Write-Host "✅ Removido: PATCH_A_INFRAESTRUTURA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: PATCH_A_INFRAESTRUTURA.md"
}

# Debug HTML: debug-score-breakdown.html
if (Test-Path "debug-score-breakdown.html") {
    $fileSize = (Get-Item "debug-score-breakdown.html").Length
    Remove-Item "debug-score-breakdown.html" -Force
    Write-Host "✅ Removido: debug-score-breakdown.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-score-breakdown.html"
}

# Documentação: audit/safe-cleanup-analyzer.js
if (Test-Path "audit/safe-cleanup-analyzer.js") {
    $fileSize = (Get-Item "audit/safe-cleanup-analyzer.js").Length
    Remove-Item "audit/safe-cleanup-analyzer.js" -Force
    Write-Host "✅ Removido: audit/safe-cleanup-analyzer.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: audit/safe-cleanup-analyzer.js"
}

# Debug HTML: diagnostic-chat.html
if (Test-Path "diagnostic-chat.html") {
    $fileSize = (Get-Item "diagnostic-chat.html").Length
    Remove-Item "diagnostic-chat.html" -Force
    Write-Host "✅ Removido: diagnostic-chat.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: diagnostic-chat.html"
}

# Documentação: audit/safe_removal_data.json
if (Test-Path "audit/safe_removal_data.json") {
    $fileSize = (Get-Item "audit/safe_removal_data.json").Length
    Remove-Item "audit/safe_removal_data.json" -Force
    Write-Host "✅ Removido: audit/safe_removal_data.json ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: audit/safe_removal_data.json"
}

# Documentação: audit/intelligent-cleanup.js
if (Test-Path "audit/intelligent-cleanup.js") {
    $fileSize = (Get-Item "audit/intelligent-cleanup.js").Length
    Remove-Item "audit/intelligent-cleanup.js" -Force
    Write-Host "✅ Removido: audit/intelligent-cleanup.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: audit/intelligent-cleanup.js"
}

# Debug HTML: cache-diagnostic.html
if (Test-Path "cache-diagnostic.html") {
    $fileSize = (Get-Item "cache-diagnostic.html").Length
    Remove-Item "cache-diagnostic.html" -Force
    Write-Host "✅ Removido: cache-diagnostic.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: cache-diagnostic.html"
}

# Documentação: PLANO_ESCALABILIDADE_IMPLEMENTACAO.md
if (Test-Path "PLANO_ESCALABILIDADE_IMPLEMENTACAO.md") {
    $fileSize = (Get-Item "PLANO_ESCALABILIDADE_IMPLEMENTACAO.md").Length
    Remove-Item "PLANO_ESCALABILIDADE_IMPLEMENTACAO.md" -Force
    Write-Host "✅ Removido: PLANO_ESCALABILIDADE_IMPLEMENTACAO.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: PLANO_ESCALABILIDADE_IMPLEMENTACAO.md"
}

# Debug HTML: debug-upload-api.html
if (Test-Path "debug-upload-api.html") {
    $fileSize = (Get-Item "debug-upload-api.html").Length
    Remove-Item "debug-upload-api.html" -Force
    Write-Host "✅ Removido: debug-upload-api.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-upload-api.html"
}

# Debug HTML: critical-error-report.html
if (Test-Path "critical-error-report.html") {
    $fileSize = (Get-Item "critical-error-report.html").Length
    Remove-Item "critical-error-report.html" -Force
    Write-Host "✅ Removido: critical-error-report.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: critical-error-report.html"
}

# Documentação: audit/safe_removal_report.md
if (Test-Path "audit/safe_removal_report.md") {
    $fileSize = (Get-Item "audit/safe_removal_report.md").Length
    Remove-Item "audit/safe_removal_report.md" -Force
    Write-Host "✅ Removido: audit/safe_removal_report.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: audit/safe_removal_report.md"
}

# Documentação: AUDITORIA_ANALYZER_COMPLETA.md
if (Test-Path "AUDITORIA_ANALYZER_COMPLETA.md") {
    $fileSize = (Get-Item "AUDITORIA_ANALYZER_COMPLETA.md").Length
    Remove-Item "AUDITORIA_ANALYZER_COMPLETA.md" -Force
    Write-Host "✅ Removido: AUDITORIA_ANALYZER_COMPLETA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: AUDITORIA_ANALYZER_COMPLETA.md"
}

# Documentação: RELATORIO_AUDITORIA_SUGESTOES_CARD.md
if (Test-Path "RELATORIO_AUDITORIA_SUGESTOES_CARD.md") {
    $fileSize = (Get-Item "RELATORIO_AUDITORIA_SUGESTOES_CARD.md").Length
    Remove-Item "RELATORIO_AUDITORIA_SUGESTOES_CARD.md" -Force
    Write-Host "✅ Removido: RELATORIO_AUDITORIA_SUGESTOES_CARD.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_AUDITORIA_SUGESTOES_CARD.md"
}

# Documentação: RELATORIO_CORRECOES_CRITICAS.md
if (Test-Path "RELATORIO_CORRECOES_CRITICAS.md") {
    $fileSize = (Get-Item "RELATORIO_CORRECOES_CRITICAS.md").Length
    Remove-Item "RELATORIO_CORRECOES_CRITICAS.md" -Force
    Write-Host "✅ Removido: RELATORIO_CORRECOES_CRITICAS.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_CORRECOES_CRITICAS.md"
}

# Documentação: IMPLEMENTACAO_SISTEMA_IMAGENS.md
if (Test-Path "IMPLEMENTACAO_SISTEMA_IMAGENS.md") {
    $fileSize = (Get-Item "IMPLEMENTACAO_SISTEMA_IMAGENS.md").Length
    Remove-Item "IMPLEMENTACAO_SISTEMA_IMAGENS.md" -Force
    Write-Host "✅ Removido: IMPLEMENTACAO_SISTEMA_IMAGENS.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: IMPLEMENTACAO_SISTEMA_IMAGENS.md"
}

# Documentação: AUDITORIA_COMPLETA_SISTEMA_AUDIO.md
if (Test-Path "AUDITORIA_COMPLETA_SISTEMA_AUDIO.md") {
    $fileSize = (Get-Item "AUDITORIA_COMPLETA_SISTEMA_AUDIO.md").Length
    Remove-Item "AUDITORIA_COMPLETA_SISTEMA_AUDIO.md" -Force
    Write-Host "✅ Removido: AUDITORIA_COMPLETA_SISTEMA_AUDIO.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: AUDITORIA_COMPLETA_SISTEMA_AUDIO.md"
}

# Debug HTML: debug-technical-problems.html
if (Test-Path "debug-technical-problems.html") {
    $fileSize = (Get-Item "debug-technical-problems.html").Length
    Remove-Item "debug-technical-problems.html" -Force
    Write-Host "✅ Removido: debug-technical-problems.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-technical-problems.html"
}

# Documentação: ANALISE_FEEDBACK_DJ_SISTEMA_COMPLETO.md
if (Test-Path "ANALISE_FEEDBACK_DJ_SISTEMA_COMPLETO.md") {
    $fileSize = (Get-Item "ANALISE_FEEDBACK_DJ_SISTEMA_COMPLETO.md").Length
    Remove-Item "ANALISE_FEEDBACK_DJ_SISTEMA_COMPLETO.md" -Force
    Write-Host "✅ Removido: ANALISE_FEEDBACK_DJ_SISTEMA_COMPLETO.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: ANALISE_FEEDBACK_DJ_SISTEMA_COMPLETO.md"
}

# Debug HTML: validation-test.html
if (Test-Path "validation-test.html") {
    $fileSize = (Get-Item "validation-test.html").Length
    Remove-Item "validation-test.html" -Force
    Write-Host "✅ Removido: validation-test.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: validation-test.html"
}

# Documentação: LOG_FIXED_FLEX_IMPLEMENTATION.md
if (Test-Path "LOG_FIXED_FLEX_IMPLEMENTATION.md") {
    $fileSize = (Get-Item "LOG_FIXED_FLEX_IMPLEMENTATION.md").Length
    Remove-Item "LOG_FIXED_FLEX_IMPLEMENTATION.md" -Force
    Write-Host "✅ Removido: LOG_FIXED_FLEX_IMPLEMENTATION.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: LOG_FIXED_FLEX_IMPLEMENTATION.md"
}

# Documentação: RELATORIO_AUDITORIA_SCORE_FINAL.md
if (Test-Path "RELATORIO_AUDITORIA_SCORE_FINAL.md") {
    $fileSize = (Get-Item "RELATORIO_AUDITORIA_SCORE_FINAL.md").Length
    Remove-Item "RELATORIO_AUDITORIA_SCORE_FINAL.md" -Force
    Write-Host "✅ Removido: RELATORIO_AUDITORIA_SCORE_FINAL.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_AUDITORIA_SCORE_FINAL.md"
}

# Debug HTML: debug-score-calculation.html
if (Test-Path "debug-score-calculation.html") {
    $fileSize = (Get-Item "debug-score-calculation.html").Length
    Remove-Item "debug-score-calculation.html" -Force
    Write-Host "✅ Removido: debug-score-calculation.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-score-calculation.html"
}

# Debug HTML: debug-score-vs-interface.html
if (Test-Path "debug-score-vs-interface.html") {
    $fileSize = (Get-Item "debug-score-vs-interface.html").Length
    Remove-Item "debug-score-vs-interface.html" -Force
    Write-Host "✅ Removido: debug-score-vs-interface.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-score-vs-interface.html"
}

# Documentação: RELATORIO_FINAL_CORRECAO_SUBSCORES.md
if (Test-Path "RELATORIO_FINAL_CORRECAO_SUBSCORES.md") {
    $fileSize = (Get-Item "RELATORIO_FINAL_CORRECAO_SUBSCORES.md").Length
    Remove-Item "RELATORIO_FINAL_CORRECAO_SUBSCORES.md" -Force
    Write-Host "✅ Removido: RELATORIO_FINAL_CORRECAO_SUBSCORES.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_FINAL_CORRECAO_SUBSCORES.md"
}

# Documentação: RELATORIO_CORRECAO_BANDAS_ESPECTAIS_FINAL.md
if (Test-Path "RELATORIO_CORRECAO_BANDAS_ESPECTAIS_FINAL.md") {
    $fileSize = (Get-Item "RELATORIO_CORRECAO_BANDAS_ESPECTAIS_FINAL.md").Length
    Remove-Item "RELATORIO_CORRECAO_BANDAS_ESPECTAIS_FINAL.md" -Force
    Write-Host "✅ Removido: RELATORIO_CORRECAO_BANDAS_ESPECTAIS_FINAL.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_CORRECAO_BANDAS_ESPECTAIS_FINAL.md"
}

# Documentação: IMPLEMENTACAO_ESCALABILIDADE_COMPLETA.md
if (Test-Path "IMPLEMENTACAO_ESCALABILIDADE_COMPLETA.md") {
    $fileSize = (Get-Item "IMPLEMENTACAO_ESCALABILIDADE_COMPLETA.md").Length
    Remove-Item "IMPLEMENTACAO_ESCALABILIDADE_COMPLETA.md" -Force
    Write-Host "✅ Removido: IMPLEMENTACAO_ESCALABILIDADE_COMPLETA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: IMPLEMENTACAO_ESCALABILIDADE_COMPLETA.md"
}

# Documentação: GUIA_DEBUG_SISTEMA_COMPLETO.md
if (Test-Path "GUIA_DEBUG_SISTEMA_COMPLETO.md") {
    $fileSize = (Get-Item "GUIA_DEBUG_SISTEMA_COMPLETO.md").Length
    Remove-Item "GUIA_DEBUG_SISTEMA_COMPLETO.md" -Force
    Write-Host "✅ Removido: GUIA_DEBUG_SISTEMA_COMPLETO.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: GUIA_DEBUG_SISTEMA_COMPLETO.md"
}

# Documentação: RELATORIO_FINAL_CORRECAO_BUG.md
if (Test-Path "RELATORIO_FINAL_CORRECAO_BUG.md") {
    $fileSize = (Get-Item "RELATORIO_FINAL_CORRECAO_BUG.md").Length
    Remove-Item "RELATORIO_FINAL_CORRECAO_BUG.md" -Force
    Write-Host "✅ Removido: RELATORIO_FINAL_CORRECAO_BUG.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_FINAL_CORRECAO_BUG.md"
}

# Documentação: DIAGNOSTICO_MODO_REFERENCIA.md
if (Test-Path "DIAGNOSTICO_MODO_REFERENCIA.md") {
    $fileSize = (Get-Item "DIAGNOSTICO_MODO_REFERENCIA.md").Length
    Remove-Item "DIAGNOSTICO_MODO_REFERENCIA.md" -Force
    Write-Host "✅ Removido: DIAGNOSTICO_MODO_REFERENCIA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: DIAGNOSTICO_MODO_REFERENCIA.md"
}

# Documentação: UPLOAD_60MB_IMPLEMENTATION.md
if (Test-Path "UPLOAD_60MB_IMPLEMENTATION.md") {
    $fileSize = (Get-Item "UPLOAD_60MB_IMPLEMENTATION.md").Length
    Remove-Item "UPLOAD_60MB_IMPLEMENTATION.md" -Force
    Write-Host "✅ Removido: UPLOAD_60MB_IMPLEMENTATION.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: UPLOAD_60MB_IMPLEMENTATION.md"
}

# Documentação: VERIFICACAO_ESCALABILIDADE_COMPLETA.md
if (Test-Path "VERIFICACAO_ESCALABILIDADE_COMPLETA.md") {
    $fileSize = (Get-Item "VERIFICACAO_ESCALABILIDADE_COMPLETA.md").Length
    Remove-Item "VERIFICACAO_ESCALABILIDADE_COMPLETA.md" -Force
    Write-Host "✅ Removido: VERIFICACAO_ESCALABILIDADE_COMPLETA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: VERIFICACAO_ESCALABILIDADE_COMPLETA.md"
}

# Documentação: AUDITORIA_MODO_REFERENCIA_FREQUENCIAS.md
if (Test-Path "AUDITORIA_MODO_REFERENCIA_FREQUENCIAS.md") {
    $fileSize = (Get-Item "AUDITORIA_MODO_REFERENCIA_FREQUENCIAS.md").Length
    Remove-Item "AUDITORIA_MODO_REFERENCIA_FREQUENCIAS.md" -Force
    Write-Host "✅ Removido: AUDITORIA_MODO_REFERENCIA_FREQUENCIAS.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: AUDITORIA_MODO_REFERENCIA_FREQUENCIAS.md"
}

# Documentação: RELATORIO_CORRECAO_CLIPPING.md
if (Test-Path "RELATORIO_CORRECAO_CLIPPING.md") {
    $fileSize = (Get-Item "RELATORIO_CORRECAO_CLIPPING.md").Length
    Remove-Item "RELATORIO_CORRECAO_CLIPPING.md" -Force
    Write-Host "✅ Removido: RELATORIO_CORRECAO_CLIPPING.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_CORRECAO_CLIPPING.md"
}

# Documentação: ETAPA_1_CRITICAS_CONCLUIDA.md
if (Test-Path "ETAPA_1_CRITICAS_CONCLUIDA.md") {
    $fileSize = (Get-Item "ETAPA_1_CRITICAS_CONCLUIDA.md").Length
    Remove-Item "ETAPA_1_CRITICAS_CONCLUIDA.md" -Force
    Write-Host "✅ Removido: ETAPA_1_CRITICAS_CONCLUIDA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: ETAPA_1_CRITICAS_CONCLUIDA.md"
}

# Documentação: CONFIGURACAO_VERCEL_FIREBASE.md
if (Test-Path "CONFIGURACAO_VERCEL_FIREBASE.md") {
    $fileSize = (Get-Item "CONFIGURACAO_VERCEL_FIREBASE.md").Length
    Remove-Item "CONFIGURACAO_VERCEL_FIREBASE.md" -Force
    Write-Host "✅ Removido: CONFIGURACAO_VERCEL_FIREBASE.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CONFIGURACAO_VERCEL_FIREBASE.md"
}

# Documentação: RELATORIO_FINAL_LABELS_V2.md
if (Test-Path "RELATORIO_FINAL_LABELS_V2.md") {
    $fileSize = (Get-Item "RELATORIO_FINAL_LABELS_V2.md").Length
    Remove-Item "RELATORIO_FINAL_LABELS_V2.md" -Force
    Write-Host "✅ Removido: RELATORIO_FINAL_LABELS_V2.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_FINAL_LABELS_V2.md"
}

# Documentação: CORRECAO_JSON_INPUT_ERROR.md
if (Test-Path "CORRECAO_JSON_INPUT_ERROR.md") {
    $fileSize = (Get-Item "CORRECAO_JSON_INPUT_ERROR.md").Length
    Remove-Item "CORRECAO_JSON_INPUT_ERROR.md" -Force
    Write-Host "✅ Removido: CORRECAO_JSON_INPUT_ERROR.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CORRECAO_JSON_INPUT_ERROR.md"
}

# Documentação: AUDITORIA_ESCALABILIDADE_COMPLETA.md
if (Test-Path "AUDITORIA_ESCALABILIDADE_COMPLETA.md") {
    $fileSize = (Get-Item "AUDITORIA_ESCALABILIDADE_COMPLETA.md").Length
    Remove-Item "AUDITORIA_ESCALABILIDADE_COMPLETA.md" -Force
    Write-Host "✅ Removido: AUDITORIA_ESCALABILIDADE_COMPLETA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: AUDITORIA_ESCALABILIDADE_COMPLETA.md"
}

# Documentação: RELATORIO_FUNK_MANDELA_V3.md
if (Test-Path "RELATORIO_FUNK_MANDELA_V3.md") {
    $fileSize = (Get-Item "RELATORIO_FUNK_MANDELA_V3.md").Length
    Remove-Item "RELATORIO_FUNK_MANDELA_V3.md" -Force
    Write-Host "✅ Removido: RELATORIO_FUNK_MANDELA_V3.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_FUNK_MANDELA_V3.md"
}

# Documentação: STATUS_LANCAMENTO_PRONTO.md
if (Test-Path "STATUS_LANCAMENTO_PRONTO.md") {
    $fileSize = (Get-Item "STATUS_LANCAMENTO_PRONTO.md").Length
    Remove-Item "STATUS_LANCAMENTO_PRONTO.md" -Force
    Write-Host "✅ Removido: STATUS_LANCAMENTO_PRONTO.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: STATUS_LANCAMENTO_PRONTO.md"
}

# Documentação: CORRECAO_FINAL_MODO_REFERENCIA.md
if (Test-Path "CORRECAO_FINAL_MODO_REFERENCIA.md") {
    $fileSize = (Get-Item "CORRECAO_FINAL_MODO_REFERENCIA.md").Length
    Remove-Item "CORRECAO_FINAL_MODO_REFERENCIA.md" -Force
    Write-Host "✅ Removido: CORRECAO_FINAL_MODO_REFERENCIA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CORRECAO_FINAL_MODO_REFERENCIA.md"
}

# Script Temporário: configurar-vercel-emergencia.ps1
if (Test-Path "configurar-vercel-emergencia.ps1") {
    $fileSize = (Get-Item "configurar-vercel-emergencia.ps1").Length
    Remove-Item "configurar-vercel-emergencia.ps1" -Force
    Write-Host "✅ Removido: configurar-vercel-emergencia.ps1 ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: configurar-vercel-emergencia.ps1"
}

# Debug HTML: debug-valores-problema.html
if (Test-Path "debug-valores-problema.html") {
    $fileSize = (Get-Item "debug-valores-problema.html").Length
    Remove-Item "debug-valores-problema.html" -Force
    Write-Host "✅ Removido: debug-valores-problema.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-valores-problema.html"
}

# Documentação: PLANO_AUDITORIA_COMPLETA.md
if (Test-Path "PLANO_AUDITORIA_COMPLETA.md") {
    $fileSize = (Get-Item "PLANO_AUDITORIA_COMPLETA.md").Length
    Remove-Item "PLANO_AUDITORIA_COMPLETA.md" -Force
    Write-Host "✅ Removido: PLANO_AUDITORIA_COMPLETA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: PLANO_AUDITORIA_COMPLETA.md"
}

# Documentação: RELATORIO_SISTEMA_EDUCATIVO_RESTAURADO.md
if (Test-Path "RELATORIO_SISTEMA_EDUCATIVO_RESTAURADO.md") {
    $fileSize = (Get-Item "RELATORIO_SISTEMA_EDUCATIVO_RESTAURADO.md").Length
    Remove-Item "RELATORIO_SISTEMA_EDUCATIVO_RESTAURADO.md" -Force
    Write-Host "✅ Removido: RELATORIO_SISTEMA_EDUCATIVO_RESTAURADO.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_SISTEMA_EDUCATIVO_RESTAURADO.md"
}

# Documentação: RELATORIO_LABELS_AMIGAVEIS.md
if (Test-Path "RELATORIO_LABELS_AMIGAVEIS.md") {
    $fileSize = (Get-Item "RELATORIO_LABELS_AMIGAVEIS.md").Length
    Remove-Item "RELATORIO_LABELS_AMIGAVEIS.md" -Force
    Write-Host "✅ Removido: RELATORIO_LABELS_AMIGAVEIS.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_LABELS_AMIGAVEIS.md"
}

# Documentação: RELATORIO_TESTES_FASE4.md
if (Test-Path "RELATORIO_TESTES_FASE4.md") {
    $fileSize = (Get-Item "RELATORIO_TESTES_FASE4.md").Length
    Remove-Item "RELATORIO_TESTES_FASE4.md" -Force
    Write-Host "✅ Removido: RELATORIO_TESTES_FASE4.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_TESTES_FASE4.md"
}

# Documentação: CORRECAO_ANALISE_AUDIO_MODAL.md
if (Test-Path "CORRECAO_ANALISE_AUDIO_MODAL.md") {
    $fileSize = (Get-Item "CORRECAO_ANALISE_AUDIO_MODAL.md").Length
    Remove-Item "CORRECAO_ANALISE_AUDIO_MODAL.md" -Force
    Write-Host "✅ Removido: CORRECAO_ANALISE_AUDIO_MODAL.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CORRECAO_ANALISE_AUDIO_MODAL.md"
}

# Debug HTML: debug-score-real-40.html
if (Test-Path "debug-score-real-40.html") {
    $fileSize = (Get-Item "debug-score-real-40.html").Length
    Remove-Item "debug-score-real-40.html" -Force
    Write-Host "✅ Removido: debug-score-real-40.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-score-real-40.html"
}

# Documentação: RELATORIO_CORRECAO_TOTAL_FINALIZADA.md
if (Test-Path "RELATORIO_CORRECAO_TOTAL_FINALIZADA.md") {
    $fileSize = (Get-Item "RELATORIO_CORRECAO_TOTAL_FINALIZADA.md").Length
    Remove-Item "RELATORIO_CORRECAO_TOTAL_FINALIZADA.md" -Force
    Write-Host "✅ Removido: RELATORIO_CORRECAO_TOTAL_FINALIZADA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_CORRECAO_TOTAL_FINALIZADA.md"
}

# Documentação: CORRECAO_BUG_MODO_REFERENCIA_FINAL.md
if (Test-Path "CORRECAO_BUG_MODO_REFERENCIA_FINAL.md") {
    $fileSize = (Get-Item "CORRECAO_BUG_MODO_REFERENCIA_FINAL.md").Length
    Remove-Item "CORRECAO_BUG_MODO_REFERENCIA_FINAL.md" -Force
    Write-Host "✅ Removido: CORRECAO_BUG_MODO_REFERENCIA_FINAL.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CORRECAO_BUG_MODO_REFERENCIA_FINAL.md"
}

# Documentação: TESTE_CORRECOES_IMPLEMENTADAS.md
if (Test-Path "TESTE_CORRECOES_IMPLEMENTADAS.md") {
    $fileSize = (Get-Item "TESTE_CORRECOES_IMPLEMENTADAS.md").Length
    Remove-Item "TESTE_CORRECOES_IMPLEMENTADAS.md" -Force
    Write-Host "✅ Removido: TESTE_CORRECOES_IMPLEMENTADAS.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: TESTE_CORRECOES_IMPLEMENTADAS.md"
}

# Documentação: HOTFIX_SITE_RESTAURADO.md
if (Test-Path "HOTFIX_SITE_RESTAURADO.md") {
    $fileSize = (Get-Item "HOTFIX_SITE_RESTAURADO.md").Length
    Remove-Item "HOTFIX_SITE_RESTAURADO.md" -Force
    Write-Host "✅ Removido: HOTFIX_SITE_RESTAURADO.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: HOTFIX_SITE_RESTAURADO.md"
}

# Documentação: CORRECAO_MODO_REFERENCIA_FINALIZADA.md
if (Test-Path "CORRECAO_MODO_REFERENCIA_FINALIZADA.md") {
    $fileSize = (Get-Item "CORRECAO_MODO_REFERENCIA_FINALIZADA.md").Length
    Remove-Item "CORRECAO_MODO_REFERENCIA_FINALIZADA.md" -Force
    Write-Host "✅ Removido: CORRECAO_MODO_REFERENCIA_FINALIZADA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CORRECAO_MODO_REFERENCIA_FINALIZADA.md"
}

# Debug HTML: debug-suggestion-logic.html
if (Test-Path "debug-suggestion-logic.html") {
    $fileSize = (Get-Item "debug-suggestion-logic.html").Length
    Remove-Item "debug-suggestion-logic.html" -Force
    Write-Host "✅ Removido: debug-suggestion-logic.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-suggestion-logic.html"
}

# Documentação: RELATORIO_CORRECAO_FINALIZADA.md
if (Test-Path "RELATORIO_CORRECAO_FINALIZADA.md") {
    $fileSize = (Get-Item "RELATORIO_CORRECAO_FINALIZADA.md").Length
    Remove-Item "RELATORIO_CORRECAO_FINALIZADA.md" -Force
    Write-Host "✅ Removido: RELATORIO_CORRECAO_FINALIZADA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_CORRECAO_FINALIZADA.md"
}

# Documentação: CORRECAO_FREQUENCIAS_APLICADA.md
if (Test-Path "CORRECAO_FREQUENCIAS_APLICADA.md") {
    $fileSize = (Get-Item "CORRECAO_FREQUENCIAS_APLICADA.md").Length
    Remove-Item "CORRECAO_FREQUENCIAS_APLICADA.md" -Force
    Write-Host "✅ Removido: CORRECAO_FREQUENCIAS_APLICADA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CORRECAO_FREQUENCIAS_APLICADA.md"
}

# Debug HTML: correcao-aplicada.html
if (Test-Path "correcao-aplicada.html") {
    $fileSize = (Get-Item "correcao-aplicada.html").Length
    Remove-Item "correcao-aplicada.html" -Force
    Write-Host "✅ Removido: correcao-aplicada.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: correcao-aplicada.html"
}

# Documentação: RESUMO_DIAGNOSTICO.md
if (Test-Path "RESUMO_DIAGNOSTICO.md") {
    $fileSize = (Get-Item "RESUMO_DIAGNOSTICO.md").Length
    Remove-Item "RESUMO_DIAGNOSTICO.md" -Force
    Write-Host "✅ Removido: RESUMO_DIAGNOSTICO.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RESUMO_DIAGNOSTICO.md"
}

# Documentação: CORRECAO_CHAT_BOTAO_PLUS_FINALIZADA.md
if (Test-Path "CORRECAO_CHAT_BOTAO_PLUS_FINALIZADA.md") {
    $fileSize = (Get-Item "CORRECAO_CHAT_BOTAO_PLUS_FINALIZADA.md").Length
    Remove-Item "CORRECAO_CHAT_BOTAO_PLUS_FINALIZADA.md" -Force
    Write-Host "✅ Removido: CORRECAO_CHAT_BOTAO_PLUS_FINALIZADA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CORRECAO_CHAT_BOTAO_PLUS_FINALIZADA.md"
}

# Documentação: INVESTIGACAO_PROBLEMAS_TECNICOS.md
if (Test-Path "INVESTIGACAO_PROBLEMAS_TECNICOS.md") {
    $fileSize = (Get-Item "INVESTIGACAO_PROBLEMAS_TECNICOS.md").Length
    Remove-Item "INVESTIGACAO_PROBLEMAS_TECNICOS.md" -Force
    Write-Host "✅ Removido: INVESTIGACAO_PROBLEMAS_TECNICOS.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: INVESTIGACAO_PROBLEMAS_TECNICOS.md"
}

# Documentação: CORRECAO_FINAL_INTERFACE_PRESERVADA.md
if (Test-Path "CORRECAO_FINAL_INTERFACE_PRESERVADA.md") {
    $fileSize = (Get-Item "CORRECAO_FINAL_INTERFACE_PRESERVADA.md").Length
    Remove-Item "CORRECAO_FINAL_INTERFACE_PRESERVADA.md" -Force
    Write-Host "✅ Removido: CORRECAO_FINAL_INTERFACE_PRESERVADA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CORRECAO_FINAL_INTERFACE_PRESERVADA.md"
}

# Debug HTML: debug-interpretation.html
if (Test-Path "debug-interpretation.html") {
    $fileSize = (Get-Item "debug-interpretation.html").Length
    Remove-Item "debug-interpretation.html" -Force
    Write-Host "✅ Removido: debug-interpretation.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-interpretation.html"
}

# Documentação: RELATORIO_CORRECAO_SUGESTOES_IA.md
if (Test-Path "RELATORIO_CORRECAO_SUGESTOES_IA.md") {
    $fileSize = (Get-Item "RELATORIO_CORRECAO_SUGESTOES_IA.md").Length
    Remove-Item "RELATORIO_CORRECAO_SUGESTOES_IA.md" -Force
    Write-Host "✅ Removido: RELATORIO_CORRECAO_SUGESTOES_IA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_CORRECAO_SUGESTOES_IA.md"
}

# Documentação: CORRECAO_FREQUENCIAS_BANDS.md
if (Test-Path "CORRECAO_FREQUENCIAS_BANDS.md") {
    $fileSize = (Get-Item "CORRECAO_FREQUENCIAS_BANDS.md").Length
    Remove-Item "CORRECAO_FREQUENCIAS_BANDS.md" -Force
    Write-Host "✅ Removido: CORRECAO_FREQUENCIAS_BANDS.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CORRECAO_FREQUENCIAS_BANDS.md"
}

# Script Temporário: configurar-vercel-emergencia.sh
if (Test-Path "configurar-vercel-emergencia.sh") {
    $fileSize = (Get-Item "configurar-vercel-emergencia.sh").Length
    Remove-Item "configurar-vercel-emergencia.sh" -Force
    Write-Host "✅ Removido: configurar-vercel-emergencia.sh ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: configurar-vercel-emergencia.sh"
}

# Debug HTML: correcao-analise-espectral.html
if (Test-Path "correcao-analise-espectral.html") {
    $fileSize = (Get-Item "correcao-analise-espectral.html").Length
    Remove-Item "correcao-analise-espectral.html" -Force
    Write-Host "✅ Removido: correcao-analise-espectral.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: correcao-analise-espectral.html"
}

# Documentação: RELATORIO_CORRECAO_FINAL_BANDAS.md
if (Test-Path "RELATORIO_CORRECAO_FINAL_BANDAS.md") {
    $fileSize = (Get-Item "RELATORIO_CORRECAO_FINAL_BANDAS.md").Length
    Remove-Item "RELATORIO_CORRECAO_FINAL_BANDAS.md" -Force
    Write-Host "✅ Removido: RELATORIO_CORRECAO_FINAL_BANDAS.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_CORRECAO_FINAL_BANDAS.md"
}

# Documentação: RELATORIO_CORRECAO_LOGICA_FUNDAMENTAL.md
if (Test-Path "RELATORIO_CORRECAO_LOGICA_FUNDAMENTAL.md") {
    $fileSize = (Get-Item "RELATORIO_CORRECAO_LOGICA_FUNDAMENTAL.md").Length
    Remove-Item "RELATORIO_CORRECAO_LOGICA_FUNDAMENTAL.md" -Force
    Write-Host "✅ Removido: RELATORIO_CORRECAO_LOGICA_FUNDAMENTAL.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_CORRECAO_LOGICA_FUNDAMENTAL.md"
}

# Documentação: ATUALIZACAO_PROBLEMAS_MIX.md
if (Test-Path "ATUALIZACAO_PROBLEMAS_MIX.md") {
    $fileSize = (Get-Item "ATUALIZACAO_PROBLEMAS_MIX.md").Length
    Remove-Item "ATUALIZACAO_PROBLEMAS_MIX.md" -Force
    Write-Host "✅ Removido: ATUALIZACAO_PROBLEMAS_MIX.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: ATUALIZACAO_PROBLEMAS_MIX.md"
}

# Documentação: LIMITE_60MB_SIMPLES.md
if (Test-Path "LIMITE_60MB_SIMPLES.md") {
    $fileSize = (Get-Item "LIMITE_60MB_SIMPLES.md").Length
    Remove-Item "LIMITE_60MB_SIMPLES.md" -Force
    Write-Host "✅ Removido: LIMITE_60MB_SIMPLES.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: LIMITE_60MB_SIMPLES.md"
}

# Script Temporário: limpar-deployments.ps1
if (Test-Path "limpar-deployments.ps1") {
    $fileSize = (Get-Item "limpar-deployments.ps1").Length
    Remove-Item "limpar-deployments.ps1" -Force
    Write-Host "✅ Removido: limpar-deployments.ps1 ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: limpar-deployments.ps1"
}

# Documentação: audit/quarantine_dryrun.ps1
if (Test-Path "audit/quarantine_dryrun.ps1") {
    $fileSize = (Get-Item "audit/quarantine_dryrun.ps1").Length
    Remove-Item "audit/quarantine_dryrun.ps1" -Force
    Write-Host "✅ Removido: audit/quarantine_dryrun.ps1 ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: audit/quarantine_dryrun.ps1"
}

# Documentação: POST_DEPLOY_CHECKLIST.md
if (Test-Path "POST_DEPLOY_CHECKLIST.md") {
    $fileSize = (Get-Item "POST_DEPLOY_CHECKLIST.md").Length
    Remove-Item "POST_DEPLOY_CHECKLIST.md" -Force
    Write-Host "✅ Removido: POST_DEPLOY_CHECKLIST.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: POST_DEPLOY_CHECKLIST.md"
}

# Documentação: audit/safe_removal_script.ps1
if (Test-Path "audit/safe_removal_script.ps1") {
    $fileSize = (Get-Item "audit/safe_removal_script.ps1").Length
    Remove-Item "audit/safe_removal_script.ps1" -Force
    Write-Host "✅ Removido: audit/safe_removal_script.ps1 ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: audit/safe_removal_script.ps1"
}

# Script Temporário: deploy-trigger.js
if (Test-Path "deploy-trigger.js") {
    $fileSize = (Get-Item "deploy-trigger.js").Length
    Remove-Item "deploy-trigger.js" -Force
    Write-Host "✅ Removido: deploy-trigger.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: deploy-trigger.js"
}

# Script Temporário: limpar-simples.ps1
if (Test-Path "limpar-simples.ps1") {
    $fileSize = (Get-Item "limpar-simples.ps1").Length
    Remove-Item "limpar-simples.ps1" -Force
    Write-Host "✅ Removido: limpar-simples.ps1 ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: limpar-simples.ps1"
}

# Script Temporário: .vercelignore
if (Test-Path ".vercelignore") {
    $fileSize = (Get-Item ".vercelignore").Length
    Remove-Item ".vercelignore" -Force
    Write-Host "✅ Removido: .vercelignore ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: .vercelignore"
}

# Script Temporário: cache-bust.txt
if (Test-Path "cache-bust.txt") {
    $fileSize = (Get-Item "cache-bust.txt").Length
    Remove-Item "cache-bust.txt" -Force
    Write-Host "✅ Removido: cache-bust.txt ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: cache-bust.txt"
}

# Arquivo Temporário: cache-bust.txt
if (Test-Path "cache-bust.txt") {
    $fileSize = (Get-Item "cache-bust.txt").Length
    Remove-Item "cache-bust.txt" -Force
    Write-Host "✅ Removido: cache-bust.txt ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: cache-bust.txt"
}

# Documentação: ANALISE_IMAGENS_100_FUNCIONANDO.md
if (Test-Path "ANALISE_IMAGENS_100_FUNCIONANDO.md") {
    $fileSize = (Get-Item "ANALISE_IMAGENS_100_FUNCIONANDO.md").Length
    Remove-Item "ANALISE_IMAGENS_100_FUNCIONANDO.md" -Force
    Write-Host "✅ Removido: ANALISE_IMAGENS_100_FUNCIONANDO.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: ANALISE_IMAGENS_100_FUNCIONANDO.md"
}

# Documentação: ANALISE_IMAGENS_FUNCIONANDO.md
if (Test-Path "ANALISE_IMAGENS_FUNCIONANDO.md") {
    $fileSize = (Get-Item "ANALISE_IMAGENS_FUNCIONANDO.md").Length
    Remove-Item "ANALISE_IMAGENS_FUNCIONANDO.md" -Force
    Write-Host "✅ Removido: ANALISE_IMAGENS_FUNCIONANDO.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: ANALISE_IMAGENS_FUNCIONANDO.md"
}

# Documentação: CHECKLIST_ANALISE_IMAGENS.md
if (Test-Path "CHECKLIST_ANALISE_IMAGENS.md") {
    $fileSize = (Get-Item "CHECKLIST_ANALISE_IMAGENS.md").Length
    Remove-Item "CHECKLIST_ANALISE_IMAGENS.md" -Force
    Write-Host "✅ Removido: CHECKLIST_ANALISE_IMAGENS.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CHECKLIST_ANALISE_IMAGENS.md"
}

# Documentação: CHECKLIST_COMPLETO_SISTEMA_IMAGENS.md
if (Test-Path "CHECKLIST_COMPLETO_SISTEMA_IMAGENS.md") {
    $fileSize = (Get-Item "CHECKLIST_COMPLETO_SISTEMA_IMAGENS.md").Length
    Remove-Item "CHECKLIST_COMPLETO_SISTEMA_IMAGENS.md" -Force
    Write-Host "✅ Removido: CHECKLIST_COMPLETO_SISTEMA_IMAGENS.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CHECKLIST_COMPLETO_SISTEMA_IMAGENS.md"
}

# Documentação: CONFIGURACAO_CHAVES_COMPLETA.md
if (Test-Path "CONFIGURACAO_CHAVES_COMPLETA.md") {
    $fileSize = (Get-Item "CONFIGURACAO_CHAVES_COMPLETA.md").Length
    Remove-Item "CONFIGURACAO_CHAVES_COMPLETA.md" -Force
    Write-Host "✅ Removido: CONFIGURACAO_CHAVES_COMPLETA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CONFIGURACAO_CHAVES_COMPLETA.md"
}

# Documentação: CONFIGURACAO_SISTEMA_IMAGENS.md
if (Test-Path "CONFIGURACAO_SISTEMA_IMAGENS.md") {
    $fileSize = (Get-Item "CONFIGURACAO_SISTEMA_IMAGENS.md").Length
    Remove-Item "CONFIGURACAO_SISTEMA_IMAGENS.md" -Force
    Write-Host "✅ Removido: CONFIGURACAO_SISTEMA_IMAGENS.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CONFIGURACAO_SISTEMA_IMAGENS.md"
}

# Documentação: CORRECAO_ERROS_FIREBASE_FINALIZADA.md
if (Test-Path "CORRECAO_ERROS_FIREBASE_FINALIZADA.md") {
    $fileSize = (Get-Item "CORRECAO_ERROS_FIREBASE_FINALIZADA.md").Length
    Remove-Item "CORRECAO_ERROS_FIREBASE_FINALIZADA.md" -Force
    Write-Host "✅ Removido: CORRECAO_ERROS_FIREBASE_FINALIZADA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CORRECAO_ERROS_FIREBASE_FINALIZADA.md"
}

# Documentação: CORRECAO_FINAL_BANDAS_ESPECTRAIS.md
if (Test-Path "CORRECAO_FINAL_BANDAS_ESPECTRAIS.md") {
    $fileSize = (Get-Item "CORRECAO_FINAL_BANDAS_ESPECTRAIS.md").Length
    Remove-Item "CORRECAO_FINAL_BANDAS_ESPECTRAIS.md" -Force
    Write-Host "✅ Removido: CORRECAO_FINAL_BANDAS_ESPECTRAIS.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CORRECAO_FINAL_BANDAS_ESPECTRAIS.md"
}

# Documentação: CORRECAO_FINAL_MODO_REFERENCIA_COMPLETA.md
if (Test-Path "CORRECAO_FINAL_MODO_REFERENCIA_COMPLETA.md") {
    $fileSize = (Get-Item "CORRECAO_FINAL_MODO_REFERENCIA_COMPLETA.md").Length
    Remove-Item "CORRECAO_FINAL_MODO_REFERENCIA_COMPLETA.md" -Force
    Write-Host "✅ Removido: CORRECAO_FINAL_MODO_REFERENCIA_COMPLETA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CORRECAO_FINAL_MODO_REFERENCIA_COMPLETA.md"
}

# Documentação: CORRECAO_INCONSISTENCIA_CLIPPING.md
if (Test-Path "CORRECAO_INCONSISTENCIA_CLIPPING.md") {
    $fileSize = (Get-Item "CORRECAO_INCONSISTENCIA_CLIPPING.md").Length
    Remove-Item "CORRECAO_INCONSISTENCIA_CLIPPING.md" -Force
    Write-Host "✅ Removido: CORRECAO_INCONSISTENCIA_CLIPPING.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CORRECAO_INCONSISTENCIA_CLIPPING.md"
}

# Documentação: CORRECAO_LAYOUT_IMPLEMENTACAO_IMAGENS.md
if (Test-Path "CORRECAO_LAYOUT_IMPLEMENTACAO_IMAGENS.md") {
    $fileSize = (Get-Item "CORRECAO_LAYOUT_IMPLEMENTACAO_IMAGENS.md").Length
    Remove-Item "CORRECAO_LAYOUT_IMPLEMENTACAO_IMAGENS.md" -Force
    Write-Host "✅ Removido: CORRECAO_LAYOUT_IMPLEMENTACAO_IMAGENS.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CORRECAO_LAYOUT_IMPLEMENTACAO_IMAGENS.md"
}

# Documentação: CORRECAO_SISTEMA_IMAGENS_FINALIZADA.md
if (Test-Path "CORRECAO_SISTEMA_IMAGENS_FINALIZADA.md") {
    $fileSize = (Get-Item "CORRECAO_SISTEMA_IMAGENS_FINALIZADA.md").Length
    Remove-Item "CORRECAO_SISTEMA_IMAGENS_FINALIZADA.md" -Force
    Write-Host "✅ Removido: CORRECAO_SISTEMA_IMAGENS_FINALIZADA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: CORRECAO_SISTEMA_IMAGENS_FINALIZADA.md"
}

# Documentação: FINAL_DIAGNOSTIC_REPORT.md
if (Test-Path "FINAL_DIAGNOSTIC_REPORT.md") {
    $fileSize = (Get-Item "FINAL_DIAGNOSTIC_REPORT.md").Length
    Remove-Item "FINAL_DIAGNOSTIC_REPORT.md" -Force
    Write-Host "✅ Removido: FINAL_DIAGNOSTIC_REPORT.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: FINAL_DIAGNOSTIC_REPORT.md"
}

# Documentação: GUIA_CONFIGURACAO_FINAL.md
if (Test-Path "GUIA_CONFIGURACAO_FINAL.md") {
    $fileSize = (Get-Item "GUIA_CONFIGURACAO_FINAL.md").Length
    Remove-Item "GUIA_CONFIGURACAO_FINAL.md" -Force
    Write-Host "✅ Removido: GUIA_CONFIGURACAO_FINAL.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: GUIA_CONFIGURACAO_FINAL.md"
}

# Documentação: PROBLEMA_CRITICO_IDENTIFICADO.md
if (Test-Path "PROBLEMA_CRITICO_IDENTIFICADO.md") {
    $fileSize = (Get-Item "PROBLEMA_CRITICO_IDENTIFICADO.md").Length
    Remove-Item "PROBLEMA_CRITICO_IDENTIFICADO.md" -Force
    Write-Host "✅ Removido: PROBLEMA_CRITICO_IDENTIFICADO.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: PROBLEMA_CRITICO_IDENTIFICADO.md"
}

# Documentação: RELATORIO_CORRECAO_BANDAS_ESPECTRAIS.md
if (Test-Path "RELATORIO_CORRECAO_BANDAS_ESPECTRAIS.md") {
    $fileSize = (Get-Item "RELATORIO_CORRECAO_BANDAS_ESPECTRAIS.md").Length
    Remove-Item "RELATORIO_CORRECAO_BANDAS_ESPECTRAIS.md" -Force
    Write-Host "✅ Removido: RELATORIO_CORRECAO_BANDAS_ESPECTRAIS.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_CORRECAO_BANDAS_ESPECTRAIS.md"
}

# Documentação: RELATORIO_CORRECAO_BUG_TOLERANCIA.md
if (Test-Path "RELATORIO_CORRECAO_BUG_TOLERANCIA.md") {
    $fileSize = (Get-Item "RELATORIO_CORRECAO_BUG_TOLERANCIA.md").Length
    Remove-Item "RELATORIO_CORRECAO_BUG_TOLERANCIA.md" -Force
    Write-Host "✅ Removido: RELATORIO_CORRECAO_BUG_TOLERANCIA.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_CORRECAO_BUG_TOLERANCIA.md"
}

# Documentação: RELATORIO_CORRECAO_FINAL.md
if (Test-Path "RELATORIO_CORRECAO_FINAL.md") {
    $fileSize = (Get-Item "RELATORIO_CORRECAO_FINAL.md").Length
    Remove-Item "RELATORIO_CORRECAO_FINAL.md" -Force
    Write-Host "✅ Removido: RELATORIO_CORRECAO_FINAL.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_CORRECAO_FINAL.md"
}

# Documentação: RELATORIO_FINAL_CORRECAO_BANDAS.md
if (Test-Path "RELATORIO_FINAL_CORRECAO_BANDAS.md") {
    $fileSize = (Get-Item "RELATORIO_FINAL_CORRECAO_BANDAS.md").Length
    Remove-Item "RELATORIO_FINAL_CORRECAO_BANDAS.md" -Force
    Write-Host "✅ Removido: RELATORIO_FINAL_CORRECAO_BANDAS.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_FINAL_CORRECAO_BANDAS.md"
}

# Documentação: RELATORIO_IMPLEMENTACAO_IMAGENS_CHAT.md
if (Test-Path "RELATORIO_IMPLEMENTACAO_IMAGENS_CHAT.md") {
    $fileSize = (Get-Item "RELATORIO_IMPLEMENTACAO_IMAGENS_CHAT.md").Length
    Remove-Item "RELATORIO_IMPLEMENTACAO_IMAGENS_CHAT.md" -Force
    Write-Host "✅ Removido: RELATORIO_IMPLEMENTACAO_IMAGENS_CHAT.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_IMPLEMENTACAO_IMAGENS_CHAT.md"
}

# Documentação: RELATORIO_PADRONIZACAO_BANDAS_EQ.md
if (Test-Path "RELATORIO_PADRONIZACAO_BANDAS_EQ.md") {
    $fileSize = (Get-Item "RELATORIO_PADRONIZACAO_BANDAS_EQ.md").Length
    Remove-Item "RELATORIO_PADRONIZACAO_BANDAS_EQ.md" -Force
    Write-Host "✅ Removido: RELATORIO_PADRONIZACAO_BANDAS_EQ.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: RELATORIO_PADRONIZACAO_BANDAS_EQ.md"
}

# Documentação: SISTEMA_FUNCIONANDO_COMPLETO.md
if (Test-Path "SISTEMA_FUNCIONANDO_COMPLETO.md") {
    $fileSize = (Get-Item "SISTEMA_FUNCIONANDO_COMPLETO.md").Length
    Remove-Item "SISTEMA_FUNCIONANDO_COMPLETO.md" -Force
    Write-Host "✅ Removido: SISTEMA_FUNCIONANDO_COMPLETO.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: SISTEMA_FUNCIONANDO_COMPLETO.md"
}

# Documentação: SISTEMA_IMAGENS_FUNCIONANDO.md
if (Test-Path "SISTEMA_IMAGENS_FUNCIONANDO.md") {
    $fileSize = (Get-Item "SISTEMA_IMAGENS_FUNCIONANDO.md").Length
    Remove-Item "SISTEMA_IMAGENS_FUNCIONANDO.md" -Force
    Write-Host "✅ Removido: SISTEMA_IMAGENS_FUNCIONANDO.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: SISTEMA_IMAGENS_FUNCIONANDO.md"
}

# Debug HTML: correcao-definitiva.html
if (Test-Path "correcao-definitiva.html") {
    $fileSize = (Get-Item "correcao-definitiva.html").Length
    Remove-Item "correcao-definitiva.html" -Force
    Write-Host "✅ Removido: correcao-definitiva.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: correcao-definitiva.html"
}

# Debug HTML: debug-bandas-espectrais.html
if (Test-Path "debug-bandas-espectrais.html") {
    $fileSize = (Get-Item "debug-bandas-espectrais.html").Length
    Remove-Item "debug-bandas-espectrais.html" -Force
    Write-Host "✅ Removido: debug-bandas-espectrais.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-bandas-espectrais.html"
}

# Debug HTML: debug-pushrow-test.html
if (Test-Path "debug-pushrow-test.html") {
    $fileSize = (Get-Item "debug-pushrow-test.html").Length
    Remove-Item "debug-pushrow-test.html" -Force
    Write-Host "✅ Removido: debug-pushrow-test.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-pushrow-test.html"
}

# Debug HTML: debug-sistema-bandas.html
if (Test-Path "debug-sistema-bandas.html") {
    $fileSize = (Get-Item "debug-sistema-bandas.html").Length
    Remove-Item "debug-sistema-bandas.html" -Force
    Write-Host "✅ Removido: debug-sistema-bandas.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-sistema-bandas.html"
}

# Debug HTML: debug-targets-funk.html
if (Test-Path "debug-targets-funk.html") {
    $fileSize = (Get-Item "debug-targets-funk.html").Length
    Remove-Item "debug-targets-funk.html" -Force
    Write-Host "✅ Removido: debug-targets-funk.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-targets-funk.html"
}

# Debug HTML: diagnostic-sequencial.html
if (Test-Path "diagnostic-sequencial.html") {
    $fileSize = (Get-Item "diagnostic-sequencial.html").Length
    Remove-Item "diagnostic-sequencial.html" -Force
    Write-Host "✅ Removido: diagnostic-sequencial.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: diagnostic-sequencial.html"
}

# Script Temporário: analyzer/core/bands.ts
if (Test-Path "analyzer/core/bands.ts") {
    $fileSize = (Get-Item "analyzer/core/bands.ts").Length
    Remove-Item "analyzer/core/bands.ts" -Force
    Write-Host "✅ Removido: analyzer/core/bands.ts ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: analyzer/core/bands.ts"
}

# Script Temporário: analyzer/core/loudness.ts
if (Test-Path "analyzer/core/loudness.ts") {
    $fileSize = (Get-Item "analyzer/core/loudness.ts").Length
    Remove-Item "analyzer/core/loudness.ts" -Force
    Write-Host "✅ Removido: analyzer/core/loudness.ts ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: analyzer/core/loudness.ts"
}

# Script Temporário: analyzer/index.ts
if (Test-Path "analyzer/index.ts") {
    $fileSize = (Get-Item "analyzer/index.ts").Length
    Remove-Item "analyzer/index.ts" -Force
    Write-Host "✅ Removido: analyzer/index.ts ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: analyzer/index.ts"
}

# Script Temporário: analyzer/integration-example.ts
if (Test-Path "analyzer/integration-example.ts") {
    $fileSize = (Get-Item "analyzer/integration-example.ts").Length
    Remove-Item "analyzer/integration-example.ts" -Force
    Write-Host "✅ Removido: analyzer/integration-example.ts ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: analyzer/integration-example.ts"
}

# Script Temporário: analyzer/README.md
if (Test-Path "analyzer/README.md") {
    $fileSize = (Get-Item "analyzer/README.md").Length
    Remove-Item "analyzer/README.md" -Force
    Write-Host "✅ Removido: analyzer/README.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: analyzer/README.md"
}

# Script Temporário: analyzer/suggestions/compliance.ts
if (Test-Path "analyzer/suggestions/compliance.ts") {
    $fileSize = (Get-Item "analyzer/suggestions/compliance.ts").Length
    Remove-Item "analyzer/suggestions/compliance.ts" -Force
    Write-Host "✅ Removido: analyzer/suggestions/compliance.ts ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: analyzer/suggestions/compliance.ts"
}

# Script Temporário: analyzer/suggestions/reference.ts
if (Test-Path "analyzer/suggestions/reference.ts") {
    $fileSize = (Get-Item "analyzer/suggestions/reference.ts").Length
    Remove-Item "analyzer/suggestions/reference.ts" -Force
    Write-Host "✅ Removido: analyzer/suggestions/reference.ts ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: analyzer/suggestions/reference.ts"
}

# Script Temporário: analyzer/tests/synthetic.ts
if (Test-Path "analyzer/tests/synthetic.ts") {
    $fileSize = (Get-Item "analyzer/tests/synthetic.ts").Length
    Remove-Item "analyzer/tests/synthetic.ts" -Force
    Write-Host "✅ Removido: analyzer/tests/synthetic.ts ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: analyzer/tests/synthetic.ts"
}

# Script Temporário: builder-trance.txt
if (Test-Path "builder-trance.txt") {
    $fileSize = (Get-Item "builder-trance.txt").Length
    Remove-Item "builder-trance.txt" -Force
    Write-Host "✅ Removido: builder-trance.txt ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: builder-trance.txt"
}

# Script Temporário: calibration-report-trance.txt
if (Test-Path "calibration-report-trance.txt") {
    $fileSize = (Get-Item "calibration-report-trance.txt").Length
    Remove-Item "calibration-report-trance.txt" -Force
    Write-Host "✅ Removido: calibration-report-trance.txt ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: calibration-report-trance.txt"
}

# Script Temporário: config/bands-eq-map.js
if (Test-Path "config/bands-eq-map.js") {
    $fileSize = (Get-Item "config/bands-eq-map.js").Length
    Remove-Item "config/bands-eq-map.js" -Force
    Write-Host "✅ Removido: config/bands-eq-map.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: config/bands-eq-map.js"
}

# Script Temporário: correcao-definitiva.html
if (Test-Path "correcao-definitiva.html") {
    $fileSize = (Get-Item "correcao-definitiva.html").Length
    Remove-Item "correcao-definitiva.html" -Force
    Write-Host "✅ Removido: correcao-definitiva.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: correcao-definitiva.html"
}

# Script Temporário: correcao-emergencia.js
if (Test-Path "correcao-emergencia.js") {
    $fileSize = (Get-Item "correcao-emergencia.js").Length
    Remove-Item "correcao-emergencia.js" -Force
    Write-Host "✅ Removido: correcao-emergencia.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: correcao-emergencia.js"
}

# Script Temporário: debug-bandas-espectrais.html
if (Test-Path "debug-bandas-espectrais.html") {
    $fileSize = (Get-Item "debug-bandas-espectrais.html").Length
    Remove-Item "debug-bandas-espectrais.html" -Force
    Write-Host "✅ Removido: debug-bandas-espectrais.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-bandas-espectrais.html"
}

# Script Temporário: debug-pushrow-test.html
if (Test-Path "debug-pushrow-test.html") {
    $fileSize = (Get-Item "debug-pushrow-test.html").Length
    Remove-Item "debug-pushrow-test.html" -Force
    Write-Host "✅ Removido: debug-pushrow-test.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-pushrow-test.html"
}

# Script Temporário: debug-server.js
if (Test-Path "debug-server.js") {
    $fileSize = (Get-Item "debug-server.js").Length
    Remove-Item "debug-server.js" -Force
    Write-Host "✅ Removido: debug-server.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-server.js"
}

# Script Temporário: debug-sistema-bandas.html
if (Test-Path "debug-sistema-bandas.html") {
    $fileSize = (Get-Item "debug-sistema-bandas.html").Length
    Remove-Item "debug-sistema-bandas.html" -Force
    Write-Host "✅ Removido: debug-sistema-bandas.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-sistema-bandas.html"
}

# Script Temporário: debug-targets-funk.html
if (Test-Path "debug-targets-funk.html") {
    $fileSize = (Get-Item "debug-targets-funk.html").Length
    Remove-Item "debug-targets-funk.html" -Force
    Write-Host "✅ Removido: debug-targets-funk.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: debug-targets-funk.html"
}

# Script Temporário: diagnostic-sequencial.html
if (Test-Path "diagnostic-sequencial.html") {
    $fileSize = (Get-Item "diagnostic-sequencial.html").Length
    Remove-Item "diagnostic-sequencial.html" -Force
    Write-Host "✅ Removido: diagnostic-sequencial.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: diagnostic-sequencial.html"
}

# Script Temporário: DIAGNOSTIC_PATCH.md
if (Test-Path "DIAGNOSTIC_PATCH.md") {
    $fileSize = (Get-Item "DIAGNOSTIC_PATCH.md").Length
    Remove-Item "DIAGNOSTIC_PATCH.md" -Force
    Write-Host "✅ Removido: DIAGNOSTIC_PATCH.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: DIAGNOSTIC_PATCH.md"
}

# Script Temporário: docs/archive/AUDIO_ANALYSIS_AUDIT_REPORT.md
if (Test-Path "docs/archive/AUDIO_ANALYSIS_AUDIT_REPORT.md") {
    $fileSize = (Get-Item "docs/archive/AUDIO_ANALYSIS_AUDIT_REPORT.md").Length
    Remove-Item "docs/archive/AUDIO_ANALYSIS_AUDIT_REPORT.md" -Force
    Write-Host "✅ Removido: docs/archive/AUDIO_ANALYSIS_AUDIT_REPORT.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: docs/archive/AUDIO_ANALYSIS_AUDIT_REPORT.md"
}

# Script Temporário: docs/archive/AUDIO_ANALYSIS_IMPLEMENTATION_PLAN.md
if (Test-Path "docs/archive/AUDIO_ANALYSIS_IMPLEMENTATION_PLAN.md") {
    $fileSize = (Get-Item "docs/archive/AUDIO_ANALYSIS_IMPLEMENTATION_PLAN.md").Length
    Remove-Item "docs/archive/AUDIO_ANALYSIS_IMPLEMENTATION_PLAN.md" -Force
    Write-Host "✅ Removido: docs/archive/AUDIO_ANALYSIS_IMPLEMENTATION_PLAN.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: docs/archive/AUDIO_ANALYSIS_IMPLEMENTATION_PLAN.md"
}

# Script Temporário: docs/archive/AUDIO_ANALYSIS_TECHNICAL_SPECS.md
if (Test-Path "docs/archive/AUDIO_ANALYSIS_TECHNICAL_SPECS.md") {
    $fileSize = (Get-Item "docs/archive/AUDIO_ANALYSIS_TECHNICAL_SPECS.md").Length
    Remove-Item "docs/archive/AUDIO_ANALYSIS_TECHNICAL_SPECS.md" -Force
    Write-Host "✅ Removido: docs/archive/AUDIO_ANALYSIS_TECHNICAL_SPECS.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: docs/archive/AUDIO_ANALYSIS_TECHNICAL_SPECS.md"
}

# Script Temporário: docs/archive/AUDIO_ANALYSIS_TEST_CASES.md
if (Test-Path "docs/archive/AUDIO_ANALYSIS_TEST_CASES.md") {
    $fileSize = (Get-Item "docs/archive/AUDIO_ANALYSIS_TEST_CASES.md").Length
    Remove-Item "docs/archive/AUDIO_ANALYSIS_TEST_CASES.md" -Force
    Write-Host "✅ Removido: docs/archive/AUDIO_ANALYSIS_TEST_CASES.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: docs/archive/AUDIO_ANALYSIS_TEST_CASES.md"
}

# Script Temporário: docs/archive/IMPLEMENTACAO-MENU-AUTOCLOSE.md
if (Test-Path "docs/archive/IMPLEMENTACAO-MENU-AUTOCLOSE.md") {
    $fileSize = (Get-Item "docs/archive/IMPLEMENTACAO-MENU-AUTOCLOSE.md").Length
    Remove-Item "docs/archive/IMPLEMENTACAO-MENU-AUTOCLOSE.md" -Force
    Write-Host "✅ Removido: docs/archive/IMPLEMENTACAO-MENU-AUTOCLOSE.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: docs/archive/IMPLEMENTACAO-MENU-AUTOCLOSE.md"
}

# Script Temporário: docs/audio-analyzer-audit.md
if (Test-Path "docs/audio-analyzer-audit.md") {
    $fileSize = (Get-Item "docs/audio-analyzer-audit.md").Length
    Remove-Item "docs/audio-analyzer-audit.md" -Force
    Write-Host "✅ Removido: docs/audio-analyzer-audit.md ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: docs/audio-analyzer-audit.md"
}

# Script Temporário: fix-bandas-direto.js
if (Test-Path "fix-bandas-direto.js") {
    $fileSize = (Get-Item "fix-bandas-direto.js").Length
    Remove-Item "fix-bandas-direto.js" -Force
    Write-Host "✅ Removido: fix-bandas-direto.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: fix-bandas-direto.js"
}

# Script Temporário: lib/audio/config.js
if (Test-Path "lib/audio/config.js") {
    $fileSize = (Get-Item "lib/audio/config.js").Length
    Remove-Item "lib/audio/config.js" -Force
    Write-Host "✅ Removido: lib/audio/config.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: lib/audio/config.js"
}

# Script Temporário: lib/audio/engine.js
if (Test-Path "lib/audio/engine.js") {
    $fileSize = (Get-Item "lib/audio/engine.js").Length
    Remove-Item "lib/audio/engine.js" -Force
    Write-Host "✅ Removido: lib/audio/engine.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: lib/audio/engine.js"
}

# Script Temporário: lib/audio/features/chroma.js
if (Test-Path "lib/audio/features/chroma.js") {
    $fileSize = (Get-Item "lib/audio/features/chroma.js").Length
    Remove-Item "lib/audio/features/chroma.js" -Force
    Write-Host "✅ Removido: lib/audio/features/chroma.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: lib/audio/features/chroma.js"
}

# Script Temporário: lib/audio/features/level.js
if (Test-Path "lib/audio/features/level.js") {
    $fileSize = (Get-Item "lib/audio/features/level.js").Length
    Remove-Item "lib/audio/features/level.js" -Force
    Write-Host "✅ Removido: lib/audio/features/level.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: lib/audio/features/level.js"
}

# Script Temporário: lib/audio/features/rhythm.js
if (Test-Path "lib/audio/features/rhythm.js") {
    $fileSize = (Get-Item "lib/audio/features/rhythm.js").Length
    Remove-Item "lib/audio/features/rhythm.js" -Force
    Write-Host "✅ Removido: lib/audio/features/rhythm.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: lib/audio/features/rhythm.js"
}

# Script Temporário: lib/audio/features/stereo.js
if (Test-Path "lib/audio/features/stereo.js") {
    $fileSize = (Get-Item "lib/audio/features/stereo.js").Length
    Remove-Item "lib/audio/features/stereo.js" -Force
    Write-Host "✅ Removido: lib/audio/features/stereo.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: lib/audio/features/stereo.js"
}

# Script Temporário: lib/audio/features/tonalbalance.js
if (Test-Path "lib/audio/features/tonalbalance.js") {
    $fileSize = (Get-Item "lib/audio/features/tonalbalance.js").Length
    Remove-Item "lib/audio/features/tonalbalance.js" -Force
    Write-Host "✅ Removido: lib/audio/features/tonalbalance.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: lib/audio/features/tonalbalance.js"
}

# Script Temporário: lib/audio/simple-decode.js
if (Test-Path "lib/audio/simple-decode.js") {
    $fileSize = (Get-Item "lib/audio/simple-decode.js").Length
    Remove-Item "lib/audio/simple-decode.js" -Force
    Write-Host "✅ Removido: lib/audio/simple-decode.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: lib/audio/simple-decode.js"
}

# Script Temporário: scripts/validate-security.js
if (Test-Path "scripts/validate-security.js") {
    $fileSize = (Get-Item "scripts/validate-security.js").Length
    Remove-Item "scripts/validate-security.js" -Force
    Write-Host "✅ Removido: scripts/validate-security.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: scripts/validate-security.js"
}

# Script Temporário: server.js
if (Test-Path "server.js") {
    $fileSize = (Get-Item "server.js").Length
    Remove-Item "server.js" -Force
    Write-Host "✅ Removido: server.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: server.js"
}

# Script Temporário: simple-server.js
if (Test-Path "simple-server.js") {
    $fileSize = (Get-Item "simple-server.js").Length
    Remove-Item "simple-server.js" -Force
    Write-Host "✅ Removido: simple-server.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: simple-server.js"
}

# Script Temporário: sistema-bandas-padronizadas.html
if (Test-Path "sistema-bandas-padronizadas.html") {
    $fileSize = (Get-Item "sistema-bandas-padronizadas.html").Length
    Remove-Item "sistema-bandas-padronizadas.html" -Force
    Write-Host "✅ Removido: sistema-bandas-padronizadas.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: sistema-bandas-padronizadas.html"
}

# Script Temporário: sistema-com-emergencia.html
if (Test-Path "sistema-com-emergencia.html") {
    $fileSize = (Get-Item "sistema-com-emergencia.html").Length
    Remove-Item "sistema-com-emergencia.html" -Force
    Write-Host "✅ Removido: sistema-com-emergencia.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: sistema-com-emergencia.html"
}

# Script Temporário: sistema-funcionando-corrigido.html
if (Test-Path "sistema-funcionando-corrigido.html") {
    $fileSize = (Get-Item "sistema-funcionando-corrigido.html").Length
    Remove-Item "sistema-funcionando-corrigido.html" -Force
    Write-Host "✅ Removido: sistema-funcionando-corrigido.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: sistema-funcionando-corrigido.html"
}

# Script Temporário: test-api-url.html
if (Test-Path "test-api-url.html") {
    $fileSize = (Get-Item "test-api-url.html").Length
    Remove-Item "test-api-url.html" -Force
    Write-Host "✅ Removido: test-api-url.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: test-api-url.html"
}

# Script Temporário: test-clipping-consistency.html
if (Test-Path "test-clipping-consistency.html") {
    $fileSize = (Get-Item "test-clipping-consistency.html").Length
    Remove-Item "test-clipping-consistency.html" -Force
    Write-Host "✅ Removido: test-clipping-consistency.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: test-clipping-consistency.html"
}

# Script Temporário: test-correcao-bug-tolerancia.html
if (Test-Path "test-correcao-bug-tolerancia.html") {
    $fileSize = (Get-Item "test-correcao-bug-tolerancia.html").Length
    Remove-Item "test-correcao-bug-tolerancia.html" -Force
    Write-Host "✅ Removido: test-correcao-bug-tolerancia.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: test-correcao-bug-tolerancia.html"
}

# Script Temporário: test-endpoint-direct.js
if (Test-Path "test-endpoint-direct.js") {
    $fileSize = (Get-Item "test-endpoint-direct.js").Length
    Remove-Item "test-endpoint-direct.js" -Force
    Write-Host "✅ Removido: test-endpoint-direct.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: test-endpoint-direct.js"
}

# Script Temporário: test-final-working.html
if (Test-Path "test-final-working.html") {
    $fileSize = (Get-Item "test-final-working.html").Length
    Remove-Item "test-final-working.html" -Force
    Write-Host "✅ Removido: test-final-working.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: test-final-working.html"
}

# Script Temporário: test-image-final.html
if (Test-Path "test-image-final.html") {
    $fileSize = (Get-Item "test-image-final.html").Length
    Remove-Item "test-image-final.html" -Force
    Write-Host "✅ Removido: test-image-final.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: test-image-final.html"
}

# Script Temporário: test-openai-direct.js
if (Test-Path "test-openai-direct.js") {
    $fileSize = (Get-Item "test-openai-direct.js").Length
    Remove-Item "test-openai-direct.js" -Force
    Write-Host "✅ Removido: test-openai-direct.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: test-openai-direct.js"
}

# Script Temporário: test-reference-mode-final.html
if (Test-Path "test-reference-mode-final.html") {
    $fileSize = (Get-Item "test-reference-mode-final.html").Length
    Remove-Item "test-reference-mode-final.html" -Force
    Write-Host "✅ Removido: test-reference-mode-final.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: test-reference-mode-final.html"
}

# Script Temporário: test-server.js
if (Test-Path "test-server.js") {
    $fileSize = (Get-Item "test-server.js").Length
    Remove-Item "test-server.js" -Force
    Write-Host "✅ Removido: test-server.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: test-server.js"
}

# Script Temporário: test-spectral-bands-fix.html
if (Test-Path "test-spectral-bands-fix.html") {
    $fileSize = (Get-Item "test-spectral-bands-fix.html").Length
    Remove-Item "test-spectral-bands-fix.html" -Force
    Write-Host "✅ Removido: test-spectral-bands-fix.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: test-spectral-bands-fix.html"
}

# Script Temporário: teste-analise-precisa.js
if (Test-Path "teste-analise-precisa.js") {
    $fileSize = (Get-Item "teste-analise-precisa.js").Length
    Remove-Item "teste-analise-precisa.js" -Force
    Write-Host "✅ Removido: teste-analise-precisa.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: teste-analise-precisa.js"
}

# Script Temporário: teste-chat-simples.html
if (Test-Path "teste-chat-simples.html") {
    $fileSize = (Get-Item "teste-chat-simples.html").Length
    Remove-Item "teste-chat-simples.html" -Force
    Write-Host "✅ Removido: teste-chat-simples.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: teste-chat-simples.html"
}

# Script Temporário: teste-correcao-direta.html
if (Test-Path "teste-correcao-direta.html") {
    $fileSize = (Get-Item "teste-correcao-direta.html").Length
    Remove-Item "teste-correcao-direta.html" -Force
    Write-Host "✅ Removido: teste-correcao-direta.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: teste-correcao-direta.html"
}

# Script Temporário: teste-correcao-eq-final.html
if (Test-Path "teste-correcao-eq-final.html") {
    $fileSize = (Get-Item "teste-correcao-eq-final.html").Length
    Remove-Item "teste-correcao-eq-final.html" -Force
    Write-Host "✅ Removido: teste-correcao-eq-final.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: teste-correcao-eq-final.html"
}

# Script Temporário: teste-deteccao-eq-extremo.js
if (Test-Path "teste-deteccao-eq-extremo.js") {
    $fileSize = (Get-Item "teste-deteccao-eq-extremo.js").Length
    Remove-Item "teste-deteccao-eq-extremo.js" -Force
    Write-Host "✅ Removido: teste-deteccao-eq-extremo.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: teste-deteccao-eq-extremo.js"
}

# Script Temporário: teste-direto-targets.html
if (Test-Path "teste-direto-targets.html") {
    $fileSize = (Get-Item "teste-direto-targets.html").Length
    Remove-Item "teste-direto-targets.html" -Force
    Write-Host "✅ Removido: teste-direto-targets.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: teste-direto-targets.html"
}

# Script Temporário: teste-direto.html
if (Test-Path "teste-direto.html") {
    $fileSize = (Get-Item "teste-direto.html").Length
    Remove-Item "teste-direto.html" -Force
    Write-Host "✅ Removido: teste-direto.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: teste-direto.html"
}

# Script Temporário: teste-eq-labels-working.html
if (Test-Path "teste-eq-labels-working.html") {
    $fileSize = (Get-Item "teste-eq-labels-working.html").Length
    Remove-Item "teste-eq-labels-working.html" -Force
    Write-Host "✅ Removido: teste-eq-labels-working.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: teste-eq-labels-working.html"
}

# Script Temporário: teste-final.html
if (Test-Path "teste-final.html") {
    $fileSize = (Get-Item "teste-final.html").Length
    Remove-Item "teste-final.html" -Force
    Write-Host "✅ Removido: teste-final.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: teste-final.html"
}

# Script Temporário: teste-forcado-correcao.html
if (Test-Path "teste-forcado-correcao.html") {
    $fileSize = (Get-Item "teste-forcado-correcao.html").Length
    Remove-Item "teste-forcado-correcao.html" -Force
    Write-Host "✅ Removido: teste-forcado-correcao.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: teste-forcado-correcao.html"
}

# Script Temporário: teste-inline-definitivo.html
if (Test-Path "teste-inline-definitivo.html") {
    $fileSize = (Get-Item "teste-inline-definitivo.html").Length
    Remove-Item "teste-inline-definitivo.html" -Force
    Write-Host "✅ Removido: teste-inline-definitivo.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: teste-inline-definitivo.html"
}

# Script Temporário: teste-nao-duplicacao.js
if (Test-Path "teste-nao-duplicacao.js") {
    $fileSize = (Get-Item "teste-nao-duplicacao.js").Length
    Remove-Item "teste-nao-duplicacao.js" -Force
    Write-Host "✅ Removido: teste-nao-duplicacao.js ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: teste-nao-duplicacao.js"
}

# Script Temporário: teste-padronizacao-bandas.html
if (Test-Path "teste-padronizacao-bandas.html") {
    $fileSize = (Get-Item "teste-padronizacao-bandas.html").Length
    Remove-Item "teste-padronizacao-bandas.html" -Force
    Write-Host "✅ Removido: teste-padronizacao-bandas.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: teste-padronizacao-bandas.html"
}

# Script Temporário: teste-sistema-profissional.html
if (Test-Path "teste-sistema-profissional.html") {
    $fileSize = (Get-Item "teste-sistema-profissional.html").Length
    Remove-Item "teste-sistema-profissional.html" -Force
    Write-Host "✅ Removido: teste-sistema-profissional.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: teste-sistema-profissional.html"
}

# Script Temporário: teste-sistema-real.html
if (Test-Path "teste-sistema-real.html") {
    $fileSize = (Get-Item "teste-sistema-real.html").Length
    Remove-Item "teste-sistema-real.html" -Force
    Write-Host "✅ Removido: teste-sistema-real.html ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: teste-sistema-real.html"
}

# Arquivo Temporário: builder-trance.txt
if (Test-Path "builder-trance.txt") {
    $fileSize = (Get-Item "builder-trance.txt").Length
    Remove-Item "builder-trance.txt" -Force
    Write-Host "✅ Removido: builder-trance.txt ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: builder-trance.txt"
}

# Arquivo Temporário: calibration-report-trance.txt
if (Test-Path "calibration-report-trance.txt") {
    $fileSize = (Get-Item "calibration-report-trance.txt").Length
    Remove-Item "calibration-report-trance.txt" -Force
    Write-Host "✅ Removido: calibration-report-trance.txt ($(($fileSize/1KB).ToString('F1')) KB)"
    $removedCount++
    $removedSize += $fileSize
} else {
    Write-Host "⚠️ Não encontrado: calibration-report-trance.txt"
}

Write-Host "🎉 Limpeza concluída!"
Write-Host "📁 Arquivos removidos: $removedCount"
Write-Host "💾 Espaço liberado: $(($removedSize/1MB).ToString('F1')) MB"
