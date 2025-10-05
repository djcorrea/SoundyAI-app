// 🔍 DEBUG: Script para identificar onde as sugestões de IA estão sendo renderizadas

console.log('🔍 DEBUG: Iniciando diagnóstico das sugestões de IA...');

// Função para verificar elementos no DOM
function checkDOMElements() {
    console.log('📋 Elementos relacionados às sugestões de IA:');
    
    const elements = {
        'aiSuggestionsExpanded': document.getElementById('aiSuggestionsExpanded'),
        'ai-suggestions-section': document.getElementById('ai-suggestions-section'),
        'aiExpandedContent': document.getElementById('aiExpandedContent'),
        'modalTechnicalData': document.getElementById('modalTechnicalData')
    };
    
    for (const [name, element] of Object.entries(elements)) {
        console.log(`- ${name}:`, element ? '✅ Encontrado' : '❌ Não encontrado');
        if (element) {
            console.log(`  - Display: ${element.style.display}`);
            console.log(`  - Conteúdo: ${element.innerHTML.substring(0, 100)}...`);
        }
    }
}

// Função para verificar controladores
function checkControllers() {
    console.log('🎮 Controladores de IA disponíveis:');
    
    const controllers = {
        'window.aiUIController': window.aiUIController,
        'window.forceShowAISuggestions': window.forceShowAISuggestions,
        'window.aiSuggestionLayer': window.aiSuggestionLayer
    };
    
    for (const [name, controller] of Object.entries(controllers)) {
        console.log(`- ${name}:`, controller ? '✅ Disponível' : '❌ Não disponível');
    }
}

// Função para interceptar renderização
function interceptRendering() {
    console.log('🕵️ Interceptando renderização...');
    
    // Interceptar innerHTML nos elementos principais
    const elementsToWatch = ['aiSuggestionsExpanded', 'ai-suggestions-section', 'aiExpandedContent'];
    
    elementsToWatch.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            const originalSetInnerHTML = element.__lookupSetter__('innerHTML') || Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;
            
            Object.defineProperty(element, 'innerHTML', {
                set: function(value) {
                    console.log(`🎯 CAPTURADO: innerHTML sendo definido em ${id}`);
                    console.log('📝 Conteúdo:', value.substring(0, 200) + '...');
                    
                    // Verificar se contém o texto informativo
                    if (value.includes('métricas e sugestões são baseadas em ciência')) {
                        console.log('✅ Texto informativo ENCONTRADO no conteúdo!');
                    } else {
                        console.log('❌ Texto informativo NÃO encontrado no conteúdo');
                    }
                    
                    originalSetInnerHTML.call(this, value);
                },
                get: function() {
                    return this.querySelector('*') ? this.querySelector('*').parentElement.innerHTML : '';
                }
            });
        }
    });
}

// Executar diagnóstico
checkDOMElements();
checkControllers();
interceptRendering();

// Monitorar mudanças no DOM
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    if (node.id === 'ai-suggestions-section' || node.className?.includes('ai-suggestion')) {
                        console.log('🎯 NOVO ELEMENTO IA DETECTADO:', node.id || node.className);
                        
                        // Verificar se contém o texto informativo
                        if (node.innerHTML.includes('métricas e sugestões são baseadas em ciência')) {
                            console.log('✅ Texto informativo encontrado no novo elemento!');
                        } else {
                            console.log('❌ Texto informativo não encontrado no novo elemento');
                        }
                    }
                }
            });
        }
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log('🔍 DEBUG: Diagnóstico configurado. Execute uma análise de áudio para ver os logs.');