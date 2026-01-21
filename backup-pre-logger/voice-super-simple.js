/* ============ VOICE MESSAGE ULTRA DIRETO - PROD.AI ============ */
/* 🔥 Versão super simples que DEVE funcionar */

console.log('🔥 VOICE ULTRA DIRECT loaded');

// AGUARDAR TODO O DOM
window.addEventListener('load', () => {
    console.log('🚀 Window loaded - starting voice');
    setTimeout(initVoice, 1000); // Aguarda 1 segundo
});

function initVoice() {
    console.log('🎯 Init Voice - procurando elementos...');
    
    // Encontrar elementos
    const micIcon = document.querySelector('.chatbot-mic-icon');
    const input = document.getElementById('chatbotMainInput') || document.getElementById('chatbotActiveInput');
    
    if (!micIcon) {
        console.log('❌ MIC ICON não encontrado');
        return;
    }
    
    if (!input) {
        console.log('❌ INPUT não encontrado');
        return;
    }
    
    console.log('✅ Elementos encontrados:', { mic: micIcon, input: input });
    
    // Verificar suporte
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.log('❌ Speech Recognition não suportado');
        return;
    }
    
    // Criar recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    // CONFIG ULTRA SIMPLES
    recognition.lang = 'pt-BR';
    recognition.interimResults = false; // SÓ RESULTADO FINAL
    recognition.continuous = false; // PARA SOZINHO
    recognition.maxAlternatives = 1;
    
    console.log('✅ Recognition criado com config simples');
    
    let isListening = false;
    
    // CLIQUE NO MICROFONE
    micIcon.style.cursor = 'pointer';
    micIcon.addEventListener('click', () => {
        console.log('🎤 MIC CLICADO! isListening:', isListening);
        
        if (isListening) {
            console.log('⏹️ Parando...');
            recognition.stop();
            return;
        }
        
        console.log('🚀 Iniciando gravação...');
        
        // Limpar input
        input.value = '';
        
        // Visual feedback
        micIcon.style.fill = '#ff4444';
        input.placeholder = '🔴 Falando...';
        
        // Eventos
        recognition.onstart = () => {
            isListening = true;
            console.log('🎤 GRAVAÇÃO INICIADA');
        };
        
        recognition.onresult = (event) => {
            console.log('📝 RESULTADO RECEBIDO!');
            console.log('📋 Event results:', event.results);
            
            if (event.results.length > 0) {
                const transcript = event.results[0][0].transcript;
                console.log('🎯 TRANSCRIPT:', transcript);
                
                // COLOCAR NO INPUT DE FORMA SUPER DIRETA
                input.value = transcript;
                console.log('✅ Texto colocado no input:', input.value);
                
                // Verificar se realmente foi colocado
                setTimeout(() => {
                    console.log('🔍 Verificação após 100ms:', input.value);
                    if (input.value !== transcript) {
                        console.log('⚠️ Forçando novamente...');
                        input.value = transcript;
                        input.focus();
                    }
                }, 100);
            }
        };
        
        recognition.onend = () => {
            console.log('🏁 GRAVAÇÃO FINALIZADA');
            isListening = false;
            
            // Restaurar visual
            micIcon.style.fill = 'currentColor';
            input.placeholder = 'Digite sua mensagem...';
            
            console.log('📊 Input final:', input.value);
        };
        
        recognition.onerror = (event) => {
            console.log('❌ ERRO:', event.error);
            isListening = false;
            micIcon.style.fill = 'currentColor';
            input.placeholder = 'Erro - tente novamente';
        };
        
        // INICIAR
        try {
            recognition.start();
            console.log('🎯 Recognition.start() chamado');
        } catch (e) {
            console.log('❌ Erro ao iniciar:', e);
        }
    });
    
    console.log('🎉 Voice integration setup complete!');
}

console.log('📁 voice-simple.js carregado - aguardando window load');
