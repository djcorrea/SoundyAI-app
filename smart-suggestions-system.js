// 🚨 CORREÇÃO AVANÇADA - SUGESTÕES INTELIGENTES BASEADAS EM DADOS REAIS
console.log('🚨 [SMART-SUGGESTIONS] Carregando sistema inteligente de sugestões...');

// Interceptar displayModalResults com lógica avançada
if (typeof window !== 'undefined' && window.displayModalResults) {
    const originalDisplayModalResults = window.displayModalResults;
    
    window.displayModalResults = function(analysis) {
        console.log('🚨 [SMART-SUGGESTIONS] Interceptando com dados:', analysis);
        
        // Gerar sugestões inteligentes baseadas nos dados reais
        const smartSuggestions = generateSmartSuggestions(analysis);
        
        // Aplicar sugestões se não existirem ou forem genéricas
        if (!analysis.suggestions || analysis.suggestions.length === 0 || 
            (analysis.suggestions.length === 1 && analysis.suggestions[0].type === 'general')) {
            analysis.suggestions = smartSuggestions;
            console.log('🚨 [SMART-SUGGESTIONS] Aplicadas', smartSuggestions.length, 'sugestões inteligentes');
        }
        
        return originalDisplayModalResults.call(this, analysis);
    };
    
    console.log('🚨 [SMART-SUGGESTIONS] Sistema inteligente instalado');
}

// Função para gerar sugestões inteligentes
function generateSmartSuggestions(analysis) {
    const suggestions = [];
    const tech = analysis.technicalData || {};
    const scores = analysis.scores || {};
    
    console.log('🧠 [SMART] Analisando dados técnicos:', tech);
    console.log('🧠 [SMART] Scores disponíveis:', scores);
    
    // 1. SUGESTÕES DE LOUDNESS (LUFS)
    if (tech.lufsIntegrated !== undefined && tech.lufsIntegrated !== null) {
        if (tech.lufsIntegrated < -23) {
            suggestions.push({
                type: 'loudness',
                message: 'Volume muito baixo para streaming',
                action: 'Aumentar o volume geral com limitador',
                details: `LUFS atual: ${tech.lufsIntegrated.toFixed(1)} | Recomendado: -14 LUFS para Spotify, -16 LUFS para YouTube`,
                priority: 9
            });
        } else if (tech.lufsIntegrated > -12) {
            suggestions.push({
                type: 'loudness',
                message: 'Volume muito alto, pode causar distorção',
                action: 'Reduzir o ganho geral da mixagem',
                details: `LUFS atual: ${tech.lufsIntegrated.toFixed(1)} | Recomendado: máximo -14 LUFS`,
                priority: 8
            });
        } else if (tech.lufsIntegrated >= -14 && tech.lufsIntegrated <= -12) {
            suggestions.push({
                type: 'loudness',
                message: 'Excelente loudness para streaming',
                action: 'Manter o volume atual',
                details: `LUFS: ${tech.lufsIntegrated.toFixed(1)} - Ideal para plataformas digitais`,
                priority: 3
            });
        }
    }
    
    // 2. SUGESTÕES DE TRUE PEAK
    if (tech.truePeakDbtp !== undefined && tech.truePeakDbtp !== null) {
        if (tech.truePeakDbtp > -0.1) {
            suggestions.push({
                type: 'headroom',
                message: 'True Peak perigosamente alto',
                action: 'URGENTE: Aplicar limitador com ceiling em -0.3dB',
                details: `True Peak: ${tech.truePeakDbtp.toFixed(2)}dBTP | Máximo seguro: -0.1dBTP`,
                priority: 10
            });
        } else if (tech.truePeakDbtp > -1) {
            suggestions.push({
                type: 'headroom',
                message: 'True Peak alto, pouco headroom',
                action: 'Reduzir o ganho ou aplicar limitador suave',
                details: `True Peak: ${tech.truePeakDbtp.toFixed(2)}dBTP | Recomendado: < -1dBTP`,
                priority: 7
            });
        }
    }
    
    // 3. SUGESTÕES DE DINÂMICA
    if (tech.dynamicRange !== undefined && tech.dynamicRange !== null) {
        if (tech.dynamicRange < 3) {
            suggestions.push({
                type: 'dynamics',
                message: 'Dinâmica muito limitada (over-compressed)',
                action: 'Reduzir compressão e limitação excessiva',
                details: `DR atual: ${tech.dynamicRange.toFixed(1)}dB | Mínimo recomendado: 7dB`,
                priority: 8
            });
        } else if (tech.dynamicRange > 15) {
            suggestions.push({
                type: 'dynamics',
                message: 'Dinâmica muito alta para música comercial',
                action: 'Aplicar compressão suave para consistência',
                details: `DR atual: ${tech.dynamicRange.toFixed(1)}dB | Recomendado: 7-12dB`,
                priority: 6
            });
        } else if (tech.dynamicRange >= 7 && tech.dynamicRange <= 12) {
            suggestions.push({
                type: 'dynamics',
                message: 'Excelente balanço dinâmico',
                action: 'Manter a dinâmica atual',
                details: `DR: ${tech.dynamicRange.toFixed(1)}dB - Ideal para música moderna`,
                priority: 2
            });
        }
    }
    
    // 4. SUGESTÕES DE BALANCEAMENTO ESPECTRAL
    if (scores.frequencia !== undefined && scores.frequencia < 50) {
        const centralizedBands = analysis.centralizedBands || {};
        const problematicBands = [];
        
        // Identificar bandas problemáticas
        Object.entries(centralizedBands).forEach(([band, value]) => {
            if (typeof value === 'number') {
                if (band === 'sub' && value > -10) problematicBands.push('Sub-bass excessivo');
                if (band === 'bass' && value > -10) problematicBands.push('Bass excessivo');
                if (band === 'mid' && value < -25) problematicBands.push('Médios insuficientes');
                if (band === 'highMid' && value < -30) problematicBands.push('High-mid insuficientes');
            }
        });
        
        if (problematicBands.length > 0) {
            suggestions.push({
                type: 'eq',
                message: 'Balanceamento espectral precisa de ajustes',
                action: 'Equalizar as frequências problemáticas',
                details: `Problemas: ${problematicBands.join(', ')} | Score atual: ${scores.frequencia}%`,
                priority: 7
            });
        }
    }
    
    // 5. SUGESTÕES DE ESTÉREO
    if (tech.stereoCorrelation !== undefined) {
        if (tech.stereoCorrelation < 0.3) {
            suggestions.push({
                type: 'stereo',
                message: 'Imagem estéreo muito descorrelacionada',
                action: 'Verificar phasing e reduzir processamento estéreo excessivo',
                details: `Correlação: ${(tech.stereoCorrelation * 100).toFixed(1)}% | Recomendado: > 50%`,
                priority: 6
            });
        } else if (tech.stereoCorrelation > 0.95) {
            suggestions.push({
                type: 'stereo',
                message: 'Som muito mono, pouca espacialidade',
                action: 'Aumentar largura estéreo com reverb ou delay',
                details: `Correlação: ${(tech.stereoCorrelation * 100).toFixed(1)}% | Recomendado: 70-90%`,
                priority: 5
            });
        }
    }
    
    // 6. SUGESTÕES BASEADAS NO SCORE GERAL
    if (scores.final !== undefined) {
        if (scores.final >= 85) {
            suggestions.push({
                type: 'success',
                message: 'Mixagem de excelente qualidade!',
                action: 'Mix está pronto para masterização/lançamento',
                details: `Score geral: ${scores.final}% - Padrão profissional atingido`,
                priority: 1
            });
        } else if (scores.final < 60) {
            suggestions.push({
                type: 'warning',
                message: 'Mixagem precisa de melhorias significativas',
                action: 'Revisar equalização, dinâmica e loudness',
                details: `Score geral: ${scores.final}% - Foque nas áreas com menor pontuação`,
                priority: 9
            });
        }
    }
    
    // 7. SUGESTÃO PADRÃO SE NENHUMA FOI GERADA
    if (suggestions.length === 0) {
        suggestions.push({
            type: 'analysis',
            message: 'Análise técnica concluída',
            action: 'Revisar métricas técnicas para otimizações',
            details: 'Dados insuficientes para sugestões específicas. Verifique os valores técnicos acima.',
            priority: 5
        });
    }
    
    // Ordenar por prioridade (maior prioridade primeiro)
    suggestions.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    console.log('🧠 [SMART] Geradas', suggestions.length, 'sugestões inteligentes:', suggestions);
    return suggestions;
}

console.log('✅ [SMART-SUGGESTIONS] Sistema inteligente carregado - Teste enviando um arquivo!');