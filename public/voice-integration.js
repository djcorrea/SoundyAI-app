// 🎤 VOICE MESSAGE - INTEGRAÇÃO COM CHAT EXISTENTE
// Adicione este código ao seu arquivo de chat principal

class VoiceMessageIntegration {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.setupVoiceUI();
    }

    setupVoiceUI() {
        // Adicionar botão de voz no chat
        const messageContainer = document.querySelector('.message-input-container') || 
                                document.querySelector('.chat-input') ||
                                document.querySelector('#message-input').parentElement;
        
        if (messageContainer) {
            this.addVoiceButton(messageContainer);
        }
    }

    addVoiceButton(container) {
        // Criar botão de voz
        const voiceButton = document.createElement('button');
        voiceButton.id = 'voice-btn';
        voiceButton.innerHTML = '🎤';
        voiceButton.style.cssText = `
            background: linear-gradient(45deg, #00ffff, #ff00ff);
            border: none;
            border-radius: 50%;
            width: 45px;
            height: 45px;
            font-size: 1.5rem;
            cursor: pointer;
            margin: 0 10px;
            transition: all 0.3s ease;
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.4);
        `;

        // Event listeners
        voiceButton.addEventListener('click', () => this.toggleRecording());
        voiceButton.addEventListener('mouseenter', () => {
            voiceButton.style.transform = 'scale(1.1)';
            voiceButton.style.boxShadow = '0 0 25px rgba(0, 255, 255, 0.6)';
        });
        voiceButton.addEventListener('mouseleave', () => {
            voiceButton.style.transform = 'scale(1)';
            voiceButton.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.4)';
        });

        // Inserir no container
        container.appendChild(voiceButton);

        // Criar modal de gravação
        this.createRecordingModal();
    }

    createRecordingModal() {
        const modal = document.createElement('div');
        modal.id = 'voice-modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(5px);
            z-index: 10000;
            justify-content: center;
            align-items: center;
        `;

        modal.innerHTML = `
            <div style="
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
                backdrop-filter: blur(15px);
                border: 1px solid rgba(0, 255, 255, 0.3);
                border-radius: 20px;
                padding: 40px;
                text-align: center;
                color: white;
                max-width: 400px;
                width: 90%;
            ">
                <div id="recording-icon" style="font-size: 4rem; margin-bottom: 20px;">🎤</div>
                <div id="recording-status" style="font-size: 1.2rem; margin-bottom: 20px; color: #00ffff;">
                    Clique para iniciar gravação
                </div>
                <div id="recording-timer" style="font-size: 2rem; margin-bottom: 20px; display: none;">
                    00:00
                </div>
                <div style="display: flex; gap: 20px; justify-content: center;">
                    <button id="record-toggle" style="
                        background: linear-gradient(45deg, #00ffff, #0099ff);
                        border: none;
                        padding: 15px 30px;
                        border-radius: 25px;
                        color: white;
                        font-weight: bold;
                        cursor: pointer;
                    ">Iniciar</button>
                    <button id="cancel-recording" style="
                        background: linear-gradient(45deg, #ff4444, #ff6666);
                        border: none;
                        padding: 15px 30px;
                        border-radius: 25px;
                        color: white;
                        font-weight: bold;
                        cursor: pointer;
                    ">Cancelar</button>
                </div>
                
                <audio id="audio-preview" controls style="width: 100%; margin-top: 20px; display: none;"></audio>
                <button id="send-voice" style="
                    background: linear-gradient(45deg, #00ff66, #00aa44);
                    border: none;
                    padding: 15px 30px;
                    border-radius: 25px;
                    color: white;
                    font-weight: bold;
                    cursor: pointer;
                    margin-top: 20px;
                    width: 100%;
                    display: none;
                ">Enviar Mensagem de Voz 🚀</button>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners do modal
        document.getElementById('record-toggle').addEventListener('click', () => this.handleRecordToggle());
        document.getElementById('cancel-recording').addEventListener('click', () => this.closeModal());
        document.getElementById('send-voice').addEventListener('click', () => this.sendVoiceMessage());
        
        // Fechar modal clicando fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });
    }

    toggleRecording() {
        document.getElementById('voice-modal').style.display = 'flex';
    }

    async handleRecordToggle() {
        if (!this.isRecording) {
            await this.startRecording();
        } else {
            this.stopRecording();
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });

            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            this.recordingStartTime = Date.now();

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.handleRecordingComplete();
            };

            this.mediaRecorder.start(100);
            this.isRecording = true;

            // Atualizar UI
            document.getElementById('recording-icon').textContent = '⏺️';
            document.getElementById('recording-status').textContent = 'Gravando...';
            document.getElementById('recording-timer').style.display = 'block';
            document.getElementById('record-toggle').textContent = 'Parar';
            document.getElementById('record-toggle').style.background = 'linear-gradient(45deg, #ff4444, #ff6666)';

            // Iniciar timer
            this.startTimer();

        } catch (error) {
            console.error('Erro ao iniciar gravação:', error);
            alert('Erro: Não foi possível acessar o microfone. Verifique as permissões.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.isRecording = false;
            this.stopTimer();
        }
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const seconds = Math.floor(elapsed / 1000);
            const minutes = Math.floor(seconds / 60);
            const displaySeconds = seconds % 60;
            
            document.getElementById('recording-timer').textContent = 
                `${minutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`;
                
            // Limite de 2 minutos
            if (seconds >= 120) {
                this.stopRecording();
                alert('Gravação limitada a 2 minutos. Processando áudio...');
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }

    handleRecordingComplete() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const audioURL = URL.createObjectURL(audioBlob);
        
        // Mostrar preview
        const audioPreview = document.getElementById('audio-preview');
        audioPreview.src = audioURL;
        audioPreview.style.display = 'block';
        
        // Mostrar botão enviar
        document.getElementById('send-voice').style.display = 'block';
        
        // Atualizar UI
        document.getElementById('recording-icon').textContent = '✅';
        document.getElementById('recording-status').textContent = 'Gravação concluída!';
        document.getElementById('record-toggle').style.display = 'none';
        
        // Salvar blob para envio
        this.currentAudioBlob = audioBlob;
    }

    async sendVoiceMessage() {
        if (!this.currentAudioBlob) return;

        const sendButton = document.getElementById('send-voice');
        sendButton.textContent = 'Processando...';
        sendButton.disabled = true;

        try {
            // Converter para base64
            const reader = new FileReader();
            reader.onload = async () => {
                const base64Audio = reader.result.split(',')[1];
                
                // Chamar API de voice message
                const response = await this.callVoiceAPI(base64Audio);
                
                if (response.success) {
                    // Adicionar mensagem no chat
                    this.addVoiceMessageToChat(response);
                    this.closeModal();
                } else {
                    throw new Error('Erro na API de voz');
                }
            };
            reader.readAsDataURL(this.currentAudioBlob);

        } catch (error) {
            console.error('Erro ao enviar voice message:', error);
            alert('Erro ao processar áudio. Tente novamente.');
        } finally {
            sendButton.textContent = 'Enviar Mensagem de Voz 🚀';
            sendButton.disabled = false;
        }
    }

    async callVoiceAPI(audioBase64) {
        const idToken = localStorage.getItem('idToken');
        
        const response = await fetch('/api/voice-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                audioData: audioBase64,
                idToken: idToken
            })
        });

        return await response.json();
    }

    addVoiceMessageToChat(response) {
        const chatContainer = document.querySelector('.messages-container') || 
                             document.querySelector('.chat-messages') ||
                             document.querySelector('#messages');

        if (!chatContainer) return;

        // Adicionar mensagem do usuário (transcrição)
        const userMessage = document.createElement('div');
        userMessage.className = 'message user-message';
        userMessage.innerHTML = `
            <div class="message-content">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                    <span style="font-size: 1.2rem;">🎤</span>
                    <strong>Mensagem de Voz</strong>
                </div>
                <div style="background: rgba(0, 255, 255, 0.1); padding: 10px; border-radius: 8px; font-style: italic;">
                    "${response.transcription}"
                </div>
            </div>
        `;
        
        chatContainer.appendChild(userMessage);

        // Adicionar resposta da IA
        const aiMessage = document.createElement('div');
        aiMessage.className = 'message ai-message';
        aiMessage.innerHTML = `
            <div class="message-content">
                <div style="white-space: pre-line; line-height: 1.6;">
                    ${response.aiResponse}
                </div>
                ${response.audioAnalysis ? `
                    <div style="margin-top: 15px; padding: 10px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; font-size: 0.9rem;">
                        <strong>📊 Análise do Áudio:</strong><br>
                        • Duração: ~${response.audioAnalysis.estimatedDuration}s<br>
                        • Qualidade: ${response.audioAnalysis.quality}<br>
                        • Conteúdo: ${response.audioAnalysis.likelyContent}
                    </div>
                ` : ''}
            </div>
        `;
        
        chatContainer.appendChild(aiMessage);

        // Scroll para baixo
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    closeModal() {
        // Parar gravação se estiver ativa
        if (this.isRecording) {
            this.stopRecording();
        }

        // Limpar estado
        this.currentAudioBlob = null;
        this.audioChunks = [];

        // Resetar UI
        document.getElementById('recording-icon').textContent = '🎤';
        document.getElementById('recording-status').textContent = 'Clique para iniciar gravação';
        document.getElementById('recording-timer').style.display = 'none';
        document.getElementById('record-toggle').textContent = 'Iniciar';
        document.getElementById('record-toggle').style.background = 'linear-gradient(45deg, #00ffff, #0099ff)';
        document.getElementById('record-toggle').style.display = 'block';
        document.getElementById('audio-preview').style.display = 'none';
        document.getElementById('send-voice').style.display = 'none';

        // Fechar modal
        document.getElementById('voice-modal').style.display = 'none';
    }
}

// 🚀 INICIALIZAR VOICE MESSAGE
// Adicione esta linha no seu arquivo de chat principal
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar um pouco para garantir que o chat foi inicializado
    setTimeout(() => {
        window.voiceMessage = new VoiceMessageIntegration();
        console.log('🎤 Voice Message integrado com sucesso!');
    }, 1000);
});

// 🎨 CSS ADICIONAL PARA VOICE MESSAGES
const voiceMessageStyles = `
    .message.voice-message {
        background: linear-gradient(135deg, rgba(0, 255, 255, 0.1), rgba(255, 0, 255, 0.1));
        border-left: 4px solid #00ffff;
    }
    
    .message.voice-message .message-content {
        position: relative;
    }
    
    .message.voice-message .message-content::before {
        content: '🎤';
        position: absolute;
        top: -5px;
        right: -5px;
        font-size: 1.2rem;
        opacity: 0.7;
    }
    
    .voice-indicator {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: rgba(0, 255, 255, 0.2);
        padding: 5px 10px;
        border-radius: 15px;
        font-size: 0.9rem;
        margin-bottom: 10px;
    }
    
    .voice-indicator::before {
        content: '🎵';
        animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
`;

// Adicionar estilos
const styleSheet = document.createElement('style');
styleSheet.textContent = voiceMessageStyles;
document.head.appendChild(styleSheet);
