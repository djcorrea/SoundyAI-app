/* ============ VOICE MESSAGE ULTRA DIRETO - PROD.AI ============ */
/* 🔥 Versão super simples que DEVE funcionar */

log('🔥 VOICE ULTRA DIRECT loaded');

// AGUARDAR TODO O DOM
window.addEventListener('load', () => {
    log('🚀 Window loaded - starting voice');
    setTimeout(initVoice, 1000); // Aguarda 1 segundo
});

function initVoice() {
    log('🎯 Init Voice - procurando elementos...');
    
    // Encontrar elementos
    const micIcon = document.querySelector('.chatbot-mic-icon');
    const input = document.getElementById('chatbotMainInput') || document.getElementById('chatbotActiveInput');
    
    if (!micIcon) {
        log('❌ MIC ICON não encontrado');
        return;
    }
    
    if (!input) {
        log('❌ INPUT não encontrado');
        return;
    }
    
    log('✅ Elementos encontrados:', { mic: micIcon, input: input });
    
    // Verificar suporte
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        log('❌ Speech Recognition não suportado');
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
    
    log('✅ Recognition criado com config simples');
    
    let isListening = false;
    
    // CLIQUE NO MICROFONE
    micIcon.style.cursor = 'pointer';
    micIcon.addEventListener('click', () => {
        log('🎤 MIC CLICADO! isListening:', isListening);
        
        if (isListening) {
            log('⏹️ Parando...');
            recognition.stop();
            return;
        }
        
        log('🚀 Iniciando gravação...');
        
        // Limpar input
        input.value = '';
        
        // Visual feedback
        micIcon.style.fill = '#ff4444';
        input.placeholder = '🔴 Falando...';
        
        // Eventos
        recognition.onstart = () => {
            isListening = true;
            log('🎤 GRAVAÇÃO INICIADA');
        };
        
        recognition.onresult = (event) => {
            log('📝 RESULTADO RECEBIDO!');
            log('📋 Event results:', event.results);
            
            if (event.results.length > 0) {
                const transcript = event.results[0][0].transcript;
                log('🎯 TRANSCRIPT:', transcript);
                
                // COLOCAR NO INPUT DE FORMA SUPER DIRETA
                input.value = transcript;
                log('✅ Texto colocado no input:', input.value);
                
                // Verificar se realmente foi colocado
                setTimeout(() => {
                    log('🔍 Verificação após 100ms:', input.value);
                    if (input.value !== transcript) {
                        log('⚠️ Forçando novamente...');
                        input.value = transcript;
                        input.focus();
                    }
                }, 100);
            }
        };
        
        recognition.onend = () => {
            log('🏁 GRAVAÇÃO FINALIZADA');
            isListening = false;
            
            // Restaurar visual
            micIcon.style.fill = 'currentColor';
            input.placeholder = 'Digite sua mensagem...';
            
            log('📊 Input final:', input.value);
        };
        
        recognition.onerror = (event) => {
            log('❌ ERRO:', event.error);
            isListening = false;
            micIcon.style.fill = 'currentColor';
            input.placeholder = 'Erro - tente novamente';
        };
        
        // INICIAR
        try {
            recognition.start();
            log('🎯 Recognition.start() chamado');
        } catch (e) {
            log('❌ Erro ao iniciar:', e);
        }
    });
    
    log('🎉 Voice integration setup complete!');
}

log('📁 voice-simple.js carregado - aguardando window load');
