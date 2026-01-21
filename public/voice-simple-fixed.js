/* ============ VOICE MESSAGE ULTRA SIMPLES - PROD.AI ============ */
/* 🎤 Versão corrigida que resolve os problemas reais */

log('🎤 Loading CORRECTED Voice Message...');

// Aguardar DOM carregar
document.addEventListener('DOMContentLoaded', () => {
    log('📄 DOM loaded, starting voice integration...');
    setupSimpleVoice();
});

// Backup se DOM já estiver carregado
if (document.readyState !== 'loading') {
    log('📄 DOM already loaded, starting voice integration...');
    setupSimpleVoice();
}

function setupSimpleVoice() {
    // Encontrar o ícone de microfone
    const micIcon = document.querySelector('.chatbot-mic-icon');
    
    if (!micIcon) {
        log('❌ Mic icon not found, retrying in 2s...');
        setTimeout(setupSimpleVoice, 2000);
        return;
    }
    
    log('✅ Mic icon found!', micIcon);
    
    // Variáveis de controle
    let recognition = null;
    let isListening = false;
    let capturedText = '';
    
    // Inicializar Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        // CONFIGURAÇÃO CORRIGIDA - O PROBLEMA ESTAVA AQUI
        recognition.lang = 'pt-BR';
        recognition.interimResults = true; // Para ver texto em tempo real
        recognition.continuous = true; // NÃO PARAR SOZINHO
        recognition.maxAlternatives = 1;
        
        log('✅ Speech Recognition configurado corretamente');
        log('🔧 Config: continuous=true, interimResults=true');
    } else {
        log('❌ Speech Recognition not supported');
        return;
    }
    
    // Fazer ícone clicável
    micIcon.style.cursor = 'pointer';
    micIcon.addEventListener('click', toggleVoice);
    
    function toggleVoice() {
        log('🎤 Mic clicked! isListening:', isListening);
        
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }
    
    function startListening() {
        log('🚀 INICIANDO gravação...');
        
        // PROCURAR O INPUT CORRETO - O PROBLEMA PODE ESTAR AQUI TAMBÉM
        let input = document.getElementById('chatbotMainInput');
        
        // Se não encontrar, procurar alternativas
        if (!input) {
            input = document.getElementById('chatbotActiveInput');
            log('📍 Tentando chatbotActiveInput...');
        }
        
        if (!input) {
            input = document.querySelector('input[type="text"]');
            log('📍 Tentando qualquer input text...');
        }
        
        if (!input) {
            input = document.querySelector('input');
            log('📍 Tentando qualquer input...');
        }
        
        if (!input) {
            log('❌ NENHUM INPUT ENCONTRADO!');
            alert('❌ Input do chat não encontrado');
            return;
        }
        
        log('✅ Input encontrado:', input.id || input.className || 'sem id/class');
        
        // Reset
        capturedText = '';
        input.value = '';
        
        // Visual feedback SIMPLES
        micIcon.style.fill = '#ff4444';
        input.placeholder = '🔴 Gravando... Fale agora!';
        
        // Configurar eventos
        recognition.onstart = () => {
            isListening = true;
            log('🎤 GRAVAÇÃO INICIADA com sucesso');
        };
        
        recognition.onresult = (event) => {
            log('📝 RESULTADO recebido! Total:', event.results.length);
            
            let finalText = '';
            let interimText = '';
            
            // Processar resultados
            for (let i = 0; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                
                if (event.results[i].isFinal) {
                    finalText += transcript + ' ';
                    log(`✅ FINAL: "${transcript}"`);
                } else {
                    interimText += transcript;
                    log(`⏳ INTERIM: "${transcript}"`);
                }
            }
            
            // Atualizar texto capturado
            if (finalText.trim()) {
                capturedText = finalText.trim();
            }
            
            // Mostrar no input (final + interim)
            const displayText = (capturedText + ' ' + interimText).trim();
            
            // COLOCAR NO INPUT DE FORMA DIRETA
            input.value = displayText;
            log(`🔄 Input atualizado: "${displayText}"`);
        };
        
        recognition.onend = () => {
            log('🏁 GRAVAÇÃO FINALIZADA');
            log(`📊 Texto capturado: "${capturedText}"`);
            
            isListening = false;
            
            // Restaurar visual
            micIcon.style.fill = 'currentColor';
            input.placeholder = 'Digite sua mensagem...';
            
            // GARANTIR que o texto final está no input
            if (capturedText.trim()) {
                input.value = capturedText.trim();
                log(`✅ TEXTO FINAL NO INPUT: "${input.value}"`);
                
                // Disparar eventos para compatibilidade
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                log('⚠️ Nenhum texto foi capturado');
            }
        };
        
        recognition.onerror = (event) => {
            log('❌ ERRO na gravação:', event.error);
            isListening = false;
            
            // Restaurar visual
            micIcon.style.fill = 'currentColor';
            input.placeholder = 'Erro - tente novamente';
            
            // Mostrar erro específico
            if (event.error === 'not-allowed') {
                alert('❌ Permissão do microfone negada!\nPermita o acesso ao microfone e tente novamente.');
            } else if (event.error === 'network') {
                alert('❌ Erro de rede!\nVerifique sua conexão com a internet.');
            } else {
                log('Erro detalhado:', event);
            }
        };
        
        // INICIAR GRAVAÇÃO
        try {
            recognition.start();
            log('🎯 recognition.start() executado');
        } catch (e) {
            log('❌ Erro ao iniciar recognition:', e);
            alert('❌ Erro ao iniciar gravação: ' + e.message);
        }
    }
    
    function stopListening() {
        if (recognition && isListening) {
            log('⏹️ PARANDO gravação...');
            recognition.stop();
        }
    }
    
    log('🎉 Voice integration configurada com sucesso!');
}

log('📁 voice-simple.js carregado e pronto!');
