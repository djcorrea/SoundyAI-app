// 🚨 CORREÇÃO EMERGENCIAL DIRETA - FORÇAR SUGESTÕES
// Este script força as sugestões a aparecer no modal

console.log('🚨 [EMERGENCY] Iniciando correção direta de sugestões');

// Interceptar a função displayModalResults
if (typeof window !== 'undefined' && window.displayModalResults) {
    const originalDisplayModalResults = window.displayModalResults;
    
    window.displayModalResults = function(analysis) {
        console.log('🚨 [EMERGENCY] Interceptando displayModalResults:', analysis);
        
        // FORÇA SUGESTÕES SE NÃO EXISTIREM
        if (!analysis.suggestions || analysis.suggestions.length === 0) {
            console.log('🚨 [EMERGENCY] FORÇANDO sugestões - análise sem sugestões detectada');
            
            // Verificar se há sugestões em outros lugares
            const emergencySuggestions = [];
            
            // 1. Buscar em diagnostics.suggestions
            if (analysis.diagnostics?.suggestions) {
                console.log('🚨 [EMERGENCY] Encontradas sugestões em diagnostics.suggestions:', analysis.diagnostics.suggestions.length);
                emergencySuggestions.push(...analysis.diagnostics.suggestions);
            }
            
            // 2. Gerar sugestões básicas se ainda não há nenhuma
            if (emergencySuggestions.length === 0) {
                console.log('🚨 [EMERGENCY] Gerando sugestões básicas de emergência');
                
                const tech = analysis.technicalData || {};
                
                // Sugestão baseada em LUFS
                if (tech.lufsIntegrated && tech.lufsIntegrated < -23) {
                    emergencySuggestions.push({
                        type: 'loudness',
                        message: 'Volume muito baixo detectado',
                        action: 'Aumentar o volume geral da mixagem',
                        details: `LUFS atual: ${tech.lufsIntegrated.toFixed(1)}, recomendado: -14 LUFS`,
                        priority: 8
                    });
                }
                
                // Sugestão baseada em True Peak
                if (tech.truePeakDbtp && tech.truePeakDbtp > -1) {
                    emergencySuggestions.push({
                        type: 'headroom',
                        message: 'True Peak muito alto',
                        action: 'Reduzir o ganho para evitar distorção',
                        details: `True Peak atual: ${tech.truePeakDbtp.toFixed(1)} dBTP, recomendado: < -1 dBTP`,
                        priority: 9
                    });
                }
                
                // Sugestão baseada em dinâmica
                if (tech.dynamicRange && tech.dynamicRange < 5) {
                    emergencySuggestions.push({
                        type: 'dynamics',
                        message: 'Dinâmica limitada detectada',
                        action: 'Reduzir compressão excessiva',
                        details: `Range dinâmico: ${tech.dynamicRange.toFixed(1)} dB, recomendado: > 7 dB`,
                        priority: 7
                    });
                }
                
                // Sugestão genérica se ainda não há nenhuma
                if (emergencySuggestions.length === 0) {
                    emergencySuggestions.push({
                        type: 'general',
                        message: 'Análise técnica concluída',
                        action: 'Verificar métricas técnicas na seção acima',
                        details: 'Use os dados técnicos para otimizar sua mixagem',
                        priority: 5
                    });
                }
            }
            
            // APLICAR AS SUGESTÕES FORÇADAS
            analysis.suggestions = emergencySuggestions;
            console.log('🚨 [EMERGENCY] Sugestões forçadas aplicadas:', analysis.suggestions.length);
        }
        
        // Chamar função original com análise corrigida
        return originalDisplayModalResults.call(this, analysis);
    };
    
    console.log('🚨 [EMERGENCY] Interceptação instalada com sucesso');
} else {
    console.error('🚨 [EMERGENCY] Função displayModalResults não encontrada');
}

// También interceptar normalizeBackendAnalysisData se existir
if (typeof window !== 'undefined' && window.normalizeBackendAnalysisData) {
    const originalNormalize = window.normalizeBackendAnalysisData;
    
    window.normalizeBackendAnalysisData = function(backendData) {
        console.log('🚨 [EMERGENCY] Interceptando normalizeBackendAnalysisData:', backendData);
        
        const result = originalNormalize.call(this, backendData);
        
        // FORÇA MAPEAMENTO DIRETO
        if (backendData.diagnostics?.suggestions && (!result.suggestions || result.suggestions.length === 0)) {
            console.log('🚨 [EMERGENCY] FORÇANDO mapeamento direto de diagnostics.suggestions');
            result.suggestions = backendData.diagnostics.suggestions.map(s => ({
                type: s.type || s.metric || 'general',
                message: s.message || s.description || 'Sugestão detectada',
                action: s.action || s.recommendation || 'Verificar configuração',
                details: s.details || s.context || 'Detalhes da sugestão',
                priority: s.priority || 5
            }));
            console.log('🚨 [EMERGENCY] Mapeamento forçado concluído:', result.suggestions.length);
        }
        
        return result;
    };
    
    console.log('🚨 [EMERGENCY] Interceptação de normalização instalada');
}

console.log('🚨 [EMERGENCY] Script de correção carregado - teste enviando um novo arquivo');