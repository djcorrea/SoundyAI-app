// 🔥 PATCH DEFINITIVO: AUDITORIA DE SPREAD CONTAMINATION
// Adicionar APÓS a linha 19801 em audio-analyzer-integration.js
// (logo após normalized.__normalizedAt = Date.now();)

// 🔥 AUDITORIA CRÍTICA: Verificar se genre sobreviveu ao spread
console.log('[GENRE-SPREAD-AUDIT] 🔍 Verificação pós-spread:', {
    'normalized.genre': normalized.genre,
    'normalized.data.genre': normalized.data.genre,
    'normalized.__genreAudit': normalized.__genreAudit,
    'spreadContamination': normalized.__genreAudit?.spreadContamination,
    'source': {
        'result.genre': result?.genre,
        'data.genre': data.genre,
        'data.data.genre': data.data?.genre
    }
});

// 🚨 ALERTA SE GENRE FOI CONTAMINADO
if (normalized.__genreAudit?.spreadContamination) {
    console.error('🔴 [GENRE-SPREAD-AUDIT] CONTAMINAÇÃO DETECTADA!');
    console.error('🔴 Genre correto foi sobrescrito por data.data.genre = null');
    console.error('🔴 Valores:', normalized.__genreAudit);
}
