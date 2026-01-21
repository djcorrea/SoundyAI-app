/* ============ VOICE MESSAGE INTEGRATION - PROD.AI ============ */
/* 🎤 Integração para fazer o botão de microfone EXISTENTE funcionar */

class ProdAIVoiceMessage {
    constructor() {
        this.recognition = null;
        this.finalTranscript = '';
        this.isListening = false;
        this.modal = null;
        
        // Inicializar Web Speech API
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'pt-BR';
            this.recognition.continuous = false; // Mudança: false para parar automaticamente
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;
            log('🎤 Web Speech API initialized');
        }
        
        this.init();
    }
    
    init() {
        // Aguardar DOM carregar completamente
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupVoiceButtons());
        } else {
            this.setupVoiceButtons();
        }
    }
    
    setupVoiceButtons() {
        // Encontrar o ícone de microfone existente
        const micIcon = document.querySelector('.chatbot-mic-icon');
        
        if (micIcon) {
            log('🎤 Ícone de microfone encontrado! Configurando voice message...');
            
            // Fazer o ícone clicável
            micIcon.style.cursor = 'pointer';
            micIcon.style.transition = 'all 0.3s ease';
            
            // Adicionar hover effect
            micIcon.addEventListener('mouseenter', () => {
                micIcon.style.transform = 'scale(1.2)';
                micIcon.style.filter = 'drop-shadow(0 0 10px #00ffff)';
            });
            
            micIcon.addEventListener('mouseleave', () => {
                micIcon.style.transform = 'scale(1)';
                micIcon.style.filter = 'none';
            });
            
            // Evento principal - CLICAR NO MICROFONE
            micIcon.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleVoiceMessage();
            });
            
            log('✅ Voice message configurado no ícone existente!');
        } else {
            log('❌ Ícone de microfone não encontrado. Tentando novamente em 2s...');
            setTimeout(() => this.setupVoiceButtons(), 2000);
        }
        
        // Adicionar animação CSS para o pulse
        this.addPulseAnimation();
    }
    
    toggleVoiceMessage() {
        if (!this.recognition) {
            alert('❌ Seu navegador não suporta reconhecimento de voz.\n\nUse: Chrome, Edge ou Safari');
            return;
        }
        
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }
    
    startListening() {
        // Não mostrar modal - integração direta!
        // Resetar transcrição
        this.finalTranscript = '';
        
        // Encontrar input ativo (welcome ou chat)
        const activeInput = document.getElementById('chatbotActiveInput') || document.getElementById('chatbotMainInput');
        const micIcon = document.querySelector('.chatbot-mic-icon');
        
        log('Active input found:', activeInput);
        log('Mic icon found:', micIcon);
        
        if (!activeInput) {
            alert('❌ Input não encontrado');
            return;
        }
        
        // Configurar eventos
        this.recognition.onstart = () => {
            this.isListening = true;
            log('🎤 Recognition started');
            
            // Mudar ícone para vermelho e animar
            if (micIcon) {
                micIcon.style.fill = '#ff4444';
                micIcon.style.filter = 'drop-shadow(0 0 10px #ff4444)';
                micIcon.style.animation = 'pulse 1s infinite';
                log('🔴 Mic icon changed to red');
            }
            
            // Placeholder visual
            activeInput.placeholder = '🔴 Ouvindo... Fale sua pergunta!';
            activeInput.style.borderColor = '#ff4444';
            activeInput.style.boxShadow = '0 0 10px rgba(255, 68, 68, 0.5)';
            log('📝 Input placeholder updated');
        };
        
        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                
                if (event.results[i].isFinal) {
                    this.finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }
            
            // Debug logs
            log('Final:', this.finalTranscript);
            log('Interim:', interimTranscript);
            
            // Mostrar transcrição diretamente no input
            const fullTranscript = this.finalTranscript + interimTranscript;
            activeInput.value = fullTranscript;
            
            log('Input value set to:', fullTranscript);
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            
            log('Recognition ended. Final transcript:', this.finalTranscript);
            
            // Restaurar ícone
            if (micIcon) {
                micIcon.style.fill = 'currentColor';
                micIcon.style.filter = 'none';
                micIcon.style.animation = 'none';
            }
            
            // Restaurar input
            activeInput.placeholder = 'Digite sua mensagem...';
            activeInput.style.borderColor = '';
            activeInput.style.boxShadow = '';
            
            // Garantir que o texto final está no input
            const finalText = this.finalTranscript.trim();
            activeInput.value = finalText;
            
            log('Input final value:', finalText);
            
            // Auto-enviar se tiver texto
            if (finalText.length > 3) {
                log('Auto-sending in 1.5s...');
                // Dar um tempo para usuário ver a transcrição
                setTimeout(() => {
                    // Simular envio automático
                    const sendBtn = document.getElementById('chatbotActiveSendBtn') || document.getElementById('chatbotSendButton');
                    if (sendBtn) {
                        log('Clicking send button...');
                        sendBtn.click();
                    } else {
                        log('Send button not found');
                    }
                }, 1500);
            } else {
                log('Text too short, not auto-sending');
            }
        };
        
        this.recognition.onerror = (event) => {
            error('Speech recognition error:', event.error);
            this.isListening = false;
            
            // Restaurar ícone
            if (micIcon) {
                micIcon.style.fill = 'currentColor';
                micIcon.style.filter = 'none';
                micIcon.style.animation = 'none';
            }
            
            // Mostrar erro no placeholder
            activeInput.placeholder = '❌ Erro no reconhecimento - tente novamente';
            activeInput.style.borderColor = '';
            activeInput.style.boxShadow = '';
            
            // Se tiver texto parcial, manter
            if (this.finalTranscript.trim()) {
                activeInput.value = this.finalTranscript.trim();
                log('Partial text saved due to error:', this.finalTranscript.trim());
            }
        };
        
        // Auto-stop depois de 10 segundos para evitar travamento
        setTimeout(() => {
            if (this.isListening) {
                log('Auto-stopping recognition after 10s');
                this.recognition.stop();
            }
        }, 10000);
        
        // Iniciar reconhecimento
        this.recognition.start();
    }
    
    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }
    
    addPulseAnimation() {
        // Adicionar CSS para animação apenas se ainda não existe
        if (!document.getElementById('voice-pulse-animation')) {
            const style = document.createElement('style');
            style.id = 'voice-pulse-animation';
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.7; transform: scale(1.1); }
                }
            `;
            document.head.appendChild(style);
        }
    }
}

/* ============ AUTO-INICIALIZAÇÃO ============ */
// Aguardar DOM e scripts carregarem
let voiceMessageInstance = null;

function initProdAIVoice() {
    if (!voiceMessageInstance) {
        voiceMessageInstance = new ProdAIVoiceMessage();
        log('🎤 PROD.AI Voice Message inicializado!');
    }
}

// Tentar inicializar em diferentes momentos
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProdAIVoice);
} else {
    initProdAIVoice();
}

// Backup: tentar após 2 segundos se não conseguiu
setTimeout(initProdAIVoice, 2000);

// Expor globalmente para debug
window.ProdAIVoice = voiceMessageInstance;
