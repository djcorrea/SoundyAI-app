// 🆓 VOICE MESSAGE ECONÔMICO - SEM CUSTOS DE API
// Usando Web Speech API (GRATUITO) + Análise Local

class EconomicVoiceMessage {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recognition = null;
        this.setupSpeechRecognition();
        this.setupVoiceUI();
    }

    // 🎤 TRANSCRIÇÃO GRATUITA COM WEB SPEECH API
    setupSpeechRecognition() {
        // Verificar suporte do navegador
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            // Configurações otimizadas para produção musical
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'pt-BR';
            this.recognition.maxAlternatives = 3;
            
            console.log('✅ Speech Recognition disponível (GRÁTIS!)');
        } else {
            console.warn('❌ Speech Recognition não suportado - fallback para texto');
        }
    }

    setupVoiceUI() {
        // Adicionar botão de voz simples e econômico
        const chatInput = document.querySelector('.message-input-container') || 
                         document.querySelector('#message-input')?.parentElement ||
                         document.body;

        const voiceButton = this.createEconomicVoiceButton();
        chatInput.appendChild(voiceButton);

        // Modal super simples (sem bibliotecas externas)
        this.createSimpleModal();
    }

    createEconomicVoiceButton() {
        const button = document.createElement('button');
        button.innerHTML = '🎤';
        button.style.cssText = `
            background: linear-gradient(45deg, #00ffff, #ff00ff);
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            font-size: 1.2rem;
            cursor: pointer;
            margin: 5px;
            transition: transform 0.2s;
            position: relative;
        `;
        
        button.onmouseover = () => button.style.transform = 'scale(1.1)';
        button.onmouseout = () => button.style.transform = 'scale(1)';
        button.onclick = () => this.toggleVoiceInput();
        
        return button;
    }

    createSimpleModal() {
        const modal = document.createElement('div');
        modal.id = 'voice-modal-eco';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 9999;
            justify-content: center;
            align-items: center;
        `;

        modal.innerHTML = `
            <div style="
                background: #1a1a2e;
                padding: 30px;
                border-radius: 15px;
                text-align: center;
                color: white;
                max-width: 300px;
                border: 2px solid #00ffff;
            ">
                <div id="voice-icon-eco" style="font-size: 3rem; margin-bottom: 15px;">🎤</div>
                <div id="voice-status-eco" style="margin-bottom: 15px;">Fale agora...</div>
                <div id="voice-transcript-eco" style="
                    min-height: 60px;
                    background: rgba(0,255,255,0.1);
                    padding: 10px;
                    border-radius: 8px;
                    margin: 15px 0;
                    font-style: italic;
                ">Aguardando...</div>
                <button id="voice-send-eco" style="
                    background: #00ffff;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 20px;
                    color: black;
                    font-weight: bold;
                    cursor: pointer;
                    margin: 5px;
                ">Enviar</button>
                <button id="voice-cancel-eco" style="
                    background: #ff4444;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 20px;
                    color: white;
                    font-weight: bold;
                    cursor: pointer;
                    margin: 5px;
                ">Cancelar</button>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        document.getElementById('voice-send-eco').onclick = () => this.sendTranscript();
        document.getElementById('voice-cancel-eco').onclick = () => this.closeModal();
        modal.onclick = (e) => e.target === modal && this.closeModal();
    }

    toggleVoiceInput() {
        const modal = document.getElementById('voice-modal-eco');
        modal.style.display = 'flex';
        this.startListening();
    }

    // 🎤 ESCUTA GRATUITA (SEM CUSTOS DE API)
    startListening() {
        if (!this.recognition) {
            alert('Seu navegador não suporta reconhecimento de voz. Use Chrome/Edge.');
            this.closeModal();
            return;
        }

        const transcript = document.getElementById('voice-transcript-eco');
        const status = document.getElementById('voice-status-eco');
        const icon = document.getElementById('voice-icon-eco');
        
        let finalTranscript = '';
        
        // Configurar eventos
        this.recognition.onstart = () => {
            status.textContent = '🎤 Ouvindo...';
            icon.textContent = '🔴';
            icon.style.animation = 'pulse 1s infinite';
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcriptPart = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcriptPart + ' ';
                } else {
                    interimTranscript += transcriptPart;
                }
            }
            
            transcript.innerHTML = `
                <span style="color: #00ffff;">${finalTranscript}</span>
                <span style="color: #888; font-size: 0.9em;">${interimTranscript}</span>
            `;
            
            // Auto-parar após 10 segundos de silêncio
            clearTimeout(this.silenceTimer);
            this.silenceTimer = setTimeout(() => {
                this.recognition.stop();
            }, 10000);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            status.textContent = '❌ Erro: ' + event.error;
        };

        this.recognition.onend = () => {
            icon.textContent = '✅';
            icon.style.animation = 'none';
            status.textContent = 'Finalizado! Pode enviar.';
            this.finalTranscript = finalTranscript.trim();
        };

        // Iniciar reconhecimento
        this.recognition.start();
    }

    // 🚀 ENVIO ECONÔMICO (SEM WHISPER)
    async sendTranscript() {
        if (!this.finalTranscript || this.finalTranscript.length < 5) {
            alert('Fale algo primeiro!');
            return;
        }

        const sendBtn = document.getElementById('voice-send-eco');
        sendBtn.textContent = 'Enviando...';
        sendBtn.disabled = true;

        try {
            // Usar API de chat normal (já existe) em vez de nova API
            const response = await this.sendToExistingChatAPI(this.finalTranscript);
            this.addToChat(response);
            this.closeModal();
            
        } catch (error) {
            alert('Erro ao enviar. Tente novamente.');
            console.error(error);
        } finally {
            sendBtn.textContent = 'Enviar';
            sendBtn.disabled = false;
        }
    }

    // 💰 ECONOMIA: USAR API DE CHAT EXISTENTE
    async sendToExistingChatAPI(transcript) {
        const idToken = localStorage.getItem('idToken');
        
        // Adicionar contexto de voice message no prompt
        const voiceMessage = `[VOICE MESSAGE] ${transcript}`;
        
        // Usar sua API de chat existente!
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: voiceMessage,
                conversationHistory: [], // Ou pegar do histórico existente
                idToken: idToken
            })
        });

        const data = await response.json();
        return {
            transcript: transcript,
            reply: data.reply || 'Erro na resposta'
        };
    }

    // 🎨 ADICIONAR NO CHAT EXISTENTE
    addToChat(response) {
        const chatContainer = document.querySelector('.messages-container') || 
                             document.querySelector('#messages') ||
                             document.querySelector('.chat-messages');
        
        if (!chatContainer) {
            alert(`Transcrição: "${response.transcript}"\n\nResposta: ${response.reply}`);
            return;
        }

        // Mensagem do usuário (voice)
        const userMsg = document.createElement('div');
        userMsg.className = 'message user-message';
        userMsg.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <span style="font-size: 1.1rem;">🎤</span>
                <span style="font-size: 0.9rem; opacity: 0.8;">Voice Message</span>
            </div>
            <div style="background: rgba(0,255,255,0.1); padding: 12px; border-radius: 8px; font-style: italic;">
                "${response.transcript}"
            </div>
        `;
        
        // Resposta da IA
        const aiMsg = document.createElement('div');
        aiMsg.className = 'message ai-message';
        aiMsg.innerHTML = `<div class="message-content">${response.reply}</div>`;
        
        chatContainer.appendChild(userMsg);
        chatContainer.appendChild(aiMsg);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    closeModal() {
        if (this.recognition) {
            this.recognition.stop();
        }
        
        document.getElementById('voice-modal-eco').style.display = 'none';
        
        // Reset
        document.getElementById('voice-transcript-eco').textContent = 'Aguardando...';
        document.getElementById('voice-status-eco').textContent = 'Fale agora...';
        document.getElementById('voice-icon-eco').textContent = '🎤';
        this.finalTranscript = '';
    }
}

// 🚀 CSS ECONÔMICO (INLINE, SEM ARQUIVO EXTRA)
const economicCSS = `
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
    .voice-message-indicator {
        background: linear-gradient(90deg, #00ffff, #ff00ff);
        background-size: 200% 200%;
        animation: gradient 2s ease infinite;
    }
    @keyframes gradient {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }
`;

// Adicionar CSS
if (!document.getElementById('voice-eco-styles')) {
    const style = document.createElement('style');
    style.id = 'voice-eco-styles';
    style.textContent = economicCSS;
    document.head.appendChild(style);
}

// 🎯 INICIALIZAR VERSÃO ECONÔMICA
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.economicVoice = new EconomicVoiceMessage();
        console.log('🎤💰 Voice Message ECONÔMICO ativado!');
    }, 1000);
});

// 🔥 DETECTOR DE TERMOS MUSICAIS (BONUS GRÁTIS)
function detectMusicalContext(transcript) {
    const musicalTerms = {
        'kick': '🥁 Kick detectado',
        'beat': '🎵 Beat mencionado', 
        'mix': '🎛️ Mixagem',
        'eq': '⚡ Equalização',
        'compressor': '🔧 Compressão',
        'reverb': '🌊 Reverb',
        'sample': '🎤 Sample',
        'funk': '🎶 Funk',
        'trap': '🔥 Trap',
        'bass': '🎸 Bass'
    };
    
    const detected = [];
    const lower = transcript.toLowerCase();
    
    Object.keys(musicalTerms).forEach(term => {
        if (lower.includes(term)) {
            detected.push(musicalTerms[term]);
        }
    });
    
    return detected.length > 0 ? detected.join(', ') : null;
}
