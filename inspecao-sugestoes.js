// Script para inspecionar estrutura real das sugestões
console.log('=== INSPEÇÃO DETALHADA DE SUGESTÕES ===');

// Aguardar que as sugestões sejam carregadas
setTimeout(() => {
    if (window.currentModalAnalysis && window.currentModalAnalysis.suggestions) {
        const suggestions = window.currentModalAnalysis.suggestions;
        console.log('📊 Total de sugestões:', suggestions.length);
        
        if (suggestions.length > 0) {
            console.log('🔍 PRIMEIRA SUGESTÃO (estrutura completa):');
            console.log(JSON.stringify(suggestions[0], null, 2));
            
            console.log('🗂️ CHAVES DISPONÍVEIS:');
            console.log(Object.keys(suggestions[0]));
            
            console.log('🔍 SEGUNDA SUGESTÃO (para comparação):');
            if (suggestions[1]) {
                console.log(JSON.stringify(suggestions[1], null, 2));
            }
            
            // Verificar campos comuns
            console.log('📋 ANÁLISE DE CAMPOS:');
            suggestions.slice(0, 3).forEach((sug, i) => {
                console.log(`Sugestão ${i}:`, {
                    hasText: !!sug.text,
                    hasMessage: !!sug.message,
                    hasDescription: !!sug.description,
                    hasCategory: !!sug.category,
                    hasType: !!sug.type,
                    hasTitle: !!sug.title,
                    hasEducationalTitle: !!sug.educationalTitle,
                    hasAction: !!sug.action,
                    hasImportance: !!sug.importance,
                    hasSeverity: !!sug.severity,
                    allKeys: Object.keys(sug)
                });
            });
        }
    } else {
        console.log('❌ Nenhuma sugestão encontrada em currentModalAnalysis');
        console.log('🔍 Verificando outras possíveis localizações...');
        
        // Verificar se há sugestões em outros lugares
        if (window.lastGeneratedSuggestions) {
            console.log('✅ Encontradas em lastGeneratedSuggestions:', window.lastGeneratedSuggestions.length);
        }
        
        if (window.enhancedSuggestionEngine && window.enhancedSuggestionEngine.lastSuggestions) {
            console.log('✅ Encontradas no engine:', window.enhancedSuggestionEngine.lastSuggestions.length);
        }
    }
}, 2000);