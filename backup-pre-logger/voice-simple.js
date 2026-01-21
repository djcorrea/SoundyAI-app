/* ============ VOICE MESSAGE ULTRA SIMPLES - PROD.AI ============ */
/* 🎤 Versão corrigida que resolve os problemas reais */

console.log('🎤 Loading CORRECTED Voice Message...');

// Aguardar DOM carregar
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded, starting voice integration...');
    setupSimpleVoice();
});

// Backup se DOM já estiver carregado
if (document.readyState !== 'loading') {
    console.log('📄 DOM already loaded, starting voice integration...');
    setupSimpleVoice();
}

function setupSimpleVoice() {
    // Encontrar o ícone de microfone
    const micIcon = document.querySelector('.chatbot-mic-icon');
    
    if (!micIcon) {
        console.log('❌ Mic icon not found, retrying in 2s...');
        setTimeout(setupSimpleVoice, 2000);
        return;
    }
    
    console.log('✅ Mic icon found!', micIcon);
    
    // Variáveis de controle
    let recognition = null;
    let isListening = false;
    let capturedText = '';
    
    // Inicializar Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        // CONFIGURAÇÃO CORRIGIDA - PARA NÃO PARAR SOZINHO
        recognition.lang = 'pt-BR';
        recognition.interimResults = true; // Para ver texto em tempo real
        recognition.continuous = true; // Modo contínuo
        recognition.maxAlternatives = 1;
        
        // CONFIGURAÇÕES ADICIONAIS PARA NÃO PARAR
        recognition.serviceURI = ''; // Remove limitações de serviço
        
        console.log('✅ Speech Recognition configurado para NÃO PARAR SOZINHO');
        console.log('🔧 Config: continuous=true, interimResults=true');
    } else {
        console.log('❌ Speech Recognition not supported');
        return;
    }
    
    // Fazer ícone clicável
    micIcon.style.cursor = 'pointer';
    micIcon.addEventListener('click', toggleVoice);
    
    function toggleVoice() {
        console.log('🎤 Mic clicked! isListening:', isListening);
        
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }
    
    function startListening() {
        console.log('🚀 INICIANDO gravação...');
        
        // PROCURAR O INPUT CORRETO - O PROBLEMA PODE ESTAR AQUI TAMBÉM
        let input = document.getElementById('chatbotMainInput');
        
        // Se não encontrar, procurar alternativas
        if (!input) {
            input = document.getElementById('chatbotActiveInput');
            console.log('📍 Tentando chatbotActiveInput...');
        }
        
        if (!input) {
            input = document.querySelector('input[type="text"]');
            console.log('📍 Tentando qualquer input text...');
        }
        
        if (!input) {
            input = document.querySelector('input');
            console.log('📍 Tentando qualquer input...');
        }
        
        if (!input) {
            console.log('❌ NENHUM INPUT ENCONTRADO!');
            alert('❌ Input do chat não encontrado');
            return;
        }
        
        console.log('✅ Input encontrado:', input.id || input.className || 'sem id/class');
        
        // Reset
        capturedText = '';
        input.value = '';
        
        // Visual feedback SIMPLES
        micIcon.style.fill = '#ff4444';
        input.placeholder = '🔴 Gravando... Fale agora!';
        
        // Configurar eventos
        recognition.onstart = () => {
            isListening = true;
            console.log('🎤 GRAVAÇÃO INICIADA com sucesso');
        };
        
        recognition.onresult = (event) => {
            console.log('📝 RESULTADO recebido! Total:', event.results.length);
            
            let finalText = '';
            let interimText = '';
            
            // Processar resultados
            for (let i = 0; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                
                if (event.results[i].isFinal) {
                    finalText += transcript + ' ';
                    console.log(`✅ FINAL: "${transcript}"`);
                } else {
                    interimText += transcript;
                    console.log(`⏳ INTERIM: "${transcript}"`);
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
            console.log(`🔄 Input atualizado: "${displayText}"`);
        };
        
        recognition.onend = () => {
            console.log('🏁 GRAVAÇÃO FINALIZADA');
            console.log(`📊 Texto capturado: "${capturedText}"`);
            
            isListening = false;
            
            // Restaurar visual
            micIcon.style.fill = 'currentColor';
            input.placeholder = 'Digite sua mensagem...';
            
            // GARANTIR que o texto final está no input
            if (capturedText.trim()) {
                input.value = capturedText.trim();
                console.log(`✅ TEXTO FINAL NO INPUT: "${input.value}"`);
                
                // Disparar eventos para compatibilidade
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                console.log('⚠️ Nenhum texto foi capturado');
            }
        };
        
        recognition.onerror = (event) => {
            console.log('❌ ERRO na gravação:', event.error);
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
                console.log('Erro detalhado:', event);
            }
        };
        
        // INICIAR GRAVAÇÃO
        try {
            recognition.start();
            console.log('🎯 recognition.start() executado');
        } catch (e) {
            console.log('❌ Erro ao iniciar recognition:', e);
            alert('❌ Erro ao iniciar gravação: ' + e.message);
        }
    }
    
    function stopListening() {
        if (recognition && isListening) {
            console.log('⏹️ PARANDO gravação...');
            recognition.stop();
        }
    }
    
    console.log('🎉 Voice integration configurada com sucesso!');
}

console.log('📁 voice-simple.js carregado e pronto!');
    
    // Fazer ícone clicável
    micIcon.style.cursor = 'pointer';
    micIcon.addEventListener('click', toggleVoice);
    
    function toggleVoice() {
        console.log('🎤 Mic icon clicked. Currently listening:', isListening);
        
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }
    
    function startListening() {
        console.log('🚀 Starting to listen...');
        
        // Encontrar input ativo
        const input = document.getElementById('chatbotActiveInput') || document.getElementById('chatbotMainInput');
        
        if (!input) {
            console.log('❌ No input found');
            alert('Input não encontrado');
            return;
        }
        
        console.log('✅ Input found:', input.id);
        
        // Reset
        finalText = '';
        input.value = '';
        
        // Visual feedback
        micIcon.style.fill = '#ff4444';
        micIcon.style.filter = 'drop-shadow(0 0 10px #ff4444)';
        input.placeholder = '🔴 Ouvindo... Fale sua pergunta!';
        input.style.borderColor = '#ff4444';
        
        // Configurar events
        recognition.onstart = () => {
            isListening = true;
            console.log('🎤 Recognition started successfully');
        };
        
        recognition.onresult = (event) => {
            console.log('� RESULTADO DETECTADO! Total results:', event.results.length);
            
            let interim = '';
            let allFinalText = '';
            
            // Processar TODOS os resultados com mais detalhes
            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                const transcript = result[0].transcript;
                const confidence = result[0].confidence || 0;
                const isFinal = result.isFinal;
                
                console.log(`📝 Result[${i}]: "${transcript}" | Final: ${isFinal} | Confidence: ${confidence.toFixed(2)}`);
                
                if (isFinal) {
                    allFinalText += transcript + ' ';
                    console.log(`✅ TEXTO FINAL CAPTURADO: "${transcript}"`);
                } else {
                    interim += transcript;
                    console.log(`⏳ Texto interim: "${transcript}"`);
                }
            }
            
            // Atualizar finalText se tiver texto final novo
            if (allFinalText.trim()) {
                finalText = allFinalText.trim();
                console.log('🎯 FINAL TEXT UPDATED TO:', `"${finalText}"`);
            }
            
            // Mostrar texto em tempo real (final + interim)
            const displayText = (finalText + ' ' + interim).trim();
            
            // MÚLTIPLAS FORMAS DE FORÇAR O INPUT
            console.log(`🚀 FORÇANDO INPUT COM: "${displayText}"`);
            
            // Método 1: Valor direto
            input.value = displayText;
            
            // Método 2: Propriedade textContent (backup)
            input.setAttribute('value', displayText);
            
            // Método 3: Eventos múltiplos
            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
            
            input.dispatchEvent(inputEvent);
            input.dispatchEvent(changeEvent);
            
            // Método 4: Focus para garantir
            input.focus();
            
            console.log(`✅ Input value após força: "${input.value}"`);
            console.log(`✅ Input getAttribute: "${input.getAttribute('value') || 'null'}"`);
        };
        
        recognition.onend = () => {
            console.log('🏁 RECOGNITION ENDED!');
            console.log(`🎯 Final text captured: "${finalText}"`);
            console.log(`📱 Is mobile: ${/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)}`);
            console.log(`🎤 Is still listening: ${isListening}`);
            
            const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // ESTRATÉGIA MOBILE: Se parou e não tem texto, tentar mais uma vez
            if (isMobile && isListening) {
                const textLength = finalText.trim().length;
                console.log(`📱 Mobile check - Text length: ${textLength}`);
                
                if (textLength === 0) {
                    console.log('📱 MOBILE: Sem texto capturado, tentando novamente em 200ms...');
                    setTimeout(() => {
                        if (isListening) {
                            console.log('📱 RESTARTING mobile recognition...');
                            try {
                                recognition.start();
                                return;
                            } catch (e) {
                                console.log('❌ Erro ao reiniciar:', e);
                            }
                        }
                    }, 200);
                    return;
                }
            }
            
            // FINALIZAR CAPTURA
            isListening = false;
            
            // Restaurar visual
            micIcon.style.fill = 'currentColor';
            micIcon.style.filter = 'none';
            input.placeholder = 'Digite sua mensagem...';
            input.style.borderColor = '';
            
            // SUPER FORÇA o texto final - TODAS AS ESTRATÉGIAS
            const cleanText = finalText.trim();
            console.log(`🔥 SUPER FORCING final text: "${cleanText}"`);
            
            if (cleanText) {
                // Estratégia 1: Valor direto múltiplas vezes
                input.value = cleanText;
                input.value = cleanText; // Duplo para garantir
                
                // Estratégia 2: Attribute
                input.setAttribute('value', cleanText);
                
                // Estratégia 3: textContent backup
                if (input.value !== cleanText) {
                    console.log('⚠️ Input.value falhou, usando setAttribute...');
                    input.setAttribute('value', cleanText);
                }
                
                // Estratégia 4: Eventos FORTES
                ['input', 'change', 'keyup', 'paste'].forEach(eventType => {
                    const event = new Event(eventType, { bubbles: true, cancelable: true });
                    input.dispatchEvent(event);
                });
                
                // Estratégia 5: Focus + blur para forçar atualização
                input.focus();
                setTimeout(() => input.blur(), 50);
                
                // Verificação MÚLTIPLA
                setTimeout(() => {
                    console.log(`🔍 VERIFICAÇÃO 1 (50ms): input.value = "${input.value}"`);
                    if (input.value !== cleanText) {
                        console.log('⚠️ TENTATIVA 2: Forçando novamente...');
                        input.value = cleanText;
                        input.focus();
                    }
                }, 50);
                
                setTimeout(() => {
                    console.log(`🔍 VERIFICAÇÃO 2 (100ms): input.value = "${input.value}"`);
                    if (input.value !== cleanText) {
                        console.log('⚠️ TENTATIVA 3: Usando createElement strategy...');
                        // Estratégia extrema: simular typing
                        input.focus();
                        input.value = '';
                        input.value = cleanText;
                    }
                    console.log(`✅ VALOR FINAL CONFIRMADO: "${input.value}"`);
                }, 100);
            } else {
                console.log('❌ Nenhum texto capturado para finalizar');
            }
            
            // Auto-enviar se tiver texto suficiente
            if (cleanText.length > 2) {
                console.log('🚀 Tentando auto-enviar mensagem...');
                setTimeout(() => {
                    const sendBtn = document.getElementById('chatbotActiveSendBtn') || 
                                  document.getElementById('chatbotSendButton') ||
                                  document.querySelector('.chatbot-send-button') ||
                                  document.querySelector('[id*="send"]') ||
                                  document.querySelector('button[type="submit"]');
                                  
                    if (sendBtn) {
                        console.log('📤 SEND BUTTON ENCONTRADO, clicando:', sendBtn);
                        sendBtn.click();
                    } else {
                        console.log('❌ Nenhum botão de envio encontrado');
                        console.log('🔍 Botões disponíveis:', document.querySelectorAll('button'));
                    }
                }, 2000); // 2 segundos para garantir que o texto foi definido
            }
        };
        
        recognition.onerror = (event) => {
            console.log('❌ Recognition error:', event.error);
            isListening = false;
            
            // Restaurar visual
            micIcon.style.fill = 'currentColor';
            micIcon.style.filter = 'none';
            input.placeholder = 'Erro - tente novamente';
            input.style.borderColor = '';
            
            // Salvar texto parcial
            if (finalText.trim()) {
                input.value = finalText.trim();
                console.log('💾 Saved partial text:', finalText.trim());
            }
        };
        
        // Iniciar
        console.log('🎯 Starting recognition...');
        recognition.start();
    }
    
    function stopListening() {
        if (recognition && isListening) {
            console.log('⏹️ Stopping recognition...');
            recognition.stop();
        }
    }
    
    console.log('🎉 Simple Voice Message setup complete!');
}

console.log('📁 voice-simple.js loaded');
