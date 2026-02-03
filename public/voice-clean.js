/* ============ VOICE MESSAGE LIMPO - PROD.AI ============ */
/* 🎤 Versão completamente nova e limpa */
/* 🌿 INDEX-LEAN: NUNCA auto-inicia, só ao clicar no microfone */

log('🎤 VOICE CLEAN VERSION loaded');

// 🌿 INDEX-LEAN: BLOQUEADO no load por padrão
const leanMode = window.__INDEX_LEAN_MODE || window.__LEAN_DISABLE_VOICE_AUTOSTART;

if (leanMode) {
    log('🌿 [INDEX-LEAN] Voice auto-start BLOQUEADO (lazy loading)');
    
    // Expor função de inicialização para lazy loading
    window.initVoiceIntegration = async function() {
        log('🔄 [INDEX-LEAN] Inicializando voice integration sob demanda...');
        
        // Remove flag para permitir execução
        window.__LEAN_DISABLE_VOICE_AUTOSTART = false;
        
        // Inicializar voice
        setupVoice();
        setupDOMObserver();
        
        log('✅ [INDEX-LEAN] Voice integration inicializada');
    };
    
    // NÃO configurar auto-start, NÃO continuar com código abaixo
    log('🌿 [INDEX-LEAN] Use window.lazyLoadVoice() ou clique no microfone para carregar');
    
} else {
    // Comportamento legado (se lean mode desabilitado)
    log('⚠️ [VOICE] Lean mode desabilitado - auto-start ativo');
    
    window.addEventListener('load', () => {
        log('🚀 Window loaded - starting voice integration');
        setTimeout(setupVoice, 1500);
        setupDOMObserver();
    });
}

// FUNÇÃO PARA OBSERVAR MUDANÇAS NO DOM E RECONFIGURAR MICROFONES
function setupDOMObserver() {
    // 🔒 GUARDRAIL: Só criar observer UMA VEZ
    if (window.__VOICE_DOM_OBSERVER_ACTIVE) {
        log('⚠️ DOM Observer já ativo, abortando (anti-reinit)');
        return;
    }
    
    // 🕒 THROTTLE: Não reconfigurar mais que 1x a cada 3s
    let lastReconfigTime = 0;
    const THROTTLE_DELAY = 3000; // 3 segundos
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Verificar se foram adicionados novos nós
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    // Se é um elemento e contém microfones
                    if (node.nodeType === 1) { // ELEMENT_NODE
                        const newMics = node.querySelectorAll ? node.querySelectorAll('.chatbot-mic-icon') : [];
                        
                        if (newMics.length > 0) {
                            const now = Date.now();
                            if (now - lastReconfigTime < THROTTLE_DELAY) {
                                log(`⏸️ THROTTLE: Ignorando reconfiguração (${newMics.length} mics), última foi há ${now - lastReconfigTime}ms`);
                                return;
                            }
                            
                            lastReconfigTime = now;
                            log('🔄 NOVOS microfones detectados no DOM:', newMics.length);
                            setTimeout(() => {
                                setupVoice(); // Reconfigurar sistema
                            }, 500);
                        }
                        
                        // Também verificar se o próprio nó é um microfone
                        if (node.classList && node.classList.contains('chatbot-mic-icon')) {
                            const now = Date.now();
                            if (now - lastReconfigTime < THROTTLE_DELAY) {
                                log(`⏸️ THROTTLE: Ignorando microfone individual, última reconfig há ${now - lastReconfigTime}ms`);
                                return;
                            }
                            
                            lastReconfigTime = now;
                            log('🔄 Novo microfone individual detectado');
                            setTimeout(() => {
                                setupVoice(); // Reconfigurar sistema
                            }, 500);
                        }
                    }
                });
            }
        });
    });
    
    // Observar mudanças em todo o documento
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // 🔒 Marcar como ativo e guardar referência para cleanup
    window.__VOICE_DOM_OBSERVER_ACTIVE = true;
    window.__VOICE_DOM_OBSERVER_INSTANCE = observer;
    
    log('👀 DOM Observer ativado - reconfigurará microfones com throttle de 3s');
}

function setupVoice() {
    log('🔍 Procurando elementos...');
    
    // 🔒 GUARDRAIL: Não permitir múltiplas execuções simultâneas
    if (window.__VOICE_SETUP_RUNNING) {
        log('⚠️ setupVoice já em execução, abortando (single-flight)');
        return;
    }
    
    window.__VOICE_SETUP_RUNNING = true;
    
    // 🕒 MAX_RETRIES: Não tentar mais de 5 vezes
    if (!window.__VOICE_SETUP_ATTEMPTS) {
        window.__VOICE_SETUP_ATTEMPTS = 0;
    }
    
    window.__VOICE_SETUP_ATTEMPTS++;
    const MAX_RETRIES = 5;
    
    if (window.__VOICE_SETUP_ATTEMPTS > MAX_RETRIES) {
        error(`❌ setupVoice abortado após ${MAX_RETRIES} tentativas - microfones não encontrados`);
        window.__VOICE_SETUP_RUNNING = false;
        return;
    }
    
    log(`🔍 Tentativa ${window.__VOICE_SETUP_ATTEMPTS}/${MAX_RETRIES}...`);
    
    // Encontrar TODOS os microfones (inicial e ativo)
    const allMicIcons = document.querySelectorAll('.chatbot-mic-icon');
    
    if (allMicIcons.length === 0) {
        log('❌ Nenhum microfone encontrado, tentando novamente em 2s...');
        window.__VOICE_SETUP_RUNNING = false;
        
        if (window.__VOICE_SETUP_ATTEMPTS < MAX_RETRIES) {
            setTimeout(setupVoice, 2000);
        }
        return;
    }
    
    log(`✅ ${allMicIcons.length} microfone(s) encontrado(s):`, allMicIcons);
    
    // Verificar suporte ao Speech Recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        log('❌ Speech Recognition não suportado');
        allMicIcons.forEach(mic => {
            mic.style.opacity = '0.5';
            mic.title = 'Speech Recognition não suportado neste navegador';
        });
        return;
    }
    
    // Criar Speech Recognition (uma única instância global)
    if (!window.globalVoiceRecognition) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        window.globalVoiceRecognition = new SpeechRecognition();
        
        // Configuração ULTRA SIMPLES
        window.globalVoiceRecognition.lang = 'pt-BR';
        window.globalVoiceRecognition.interimResults = true;
        window.globalVoiceRecognition.continuous = true; // MODO CONTÍNUO - NÃO PARA SOZINHO
        window.globalVoiceRecognition.maxAlternatives = 1;
        
        log('✅ Speech Recognition GLOBAL configurado para GRAVAÇÃO CONTÍNUA');
    }
    
    const recognition = window.globalVoiceRecognition;
    
    // Variáveis globais de estado
    if (!window.voiceState) {
        window.voiceState = {
            isRecording: false,
            finalTranscript: '',
            currentMicIcon: null,
            currentInput: null
        };
    }
    
    // Configurar TODOS os microfones (incluindo novos)
    allMicIcons.forEach(micIcon => {
        // Verificar se já foi configurado para evitar duplicações
        if (micIcon.dataset.voiceConfigured === 'true') {
            log('⏭️ Microfone já configurado, pulando:', micIcon);
            return;
        }
        
        micIcon.style.cursor = 'pointer';
        micIcon.title = 'Clique para gravar mensagem de voz';
        micIcon.addEventListener('click', () => handleMicClick(micIcon));
        micIcon.dataset.voiceConfigured = 'true'; // Marcar como configurado
        
        log('✅ Novo microfone configurado:', micIcon);
    });
    
    // 🧹 CLEANUP: Marcar como concluído
    window.__VOICE_SETUP_RUNNING = false;
    log(`✅ setupVoice concluído - ${allMicIcons.length} microfone(s) configurado(s)`);
    
    function handleMicClick(clickedMicIcon) {
        log('🎤 Microfone clicado!');
        log('📊 Estado atual:', window.voiceState.isRecording ? '🔴 GRAVANDO' : '⚫ PARADO');
        log('🎯 Microfone clicado:', clickedMicIcon);
        
        window.voiceState.currentMicIcon = clickedMicIcon;
        
        if (window.voiceState.isRecording) {
            log('⏹️ USUÁRIO QUER PARAR - finalizando gravação...');
            window.voiceState.isRecording = false; // Marcar que usuário quer parar
            recognition.stop(); // Parar recognition
        } else {
            log('🚀 USUÁRIO QUER GRAVAR - iniciando gravação...');
            startRecording();
        }
    }
    
    function startRecording() {
        // Encontrar input ATUAL dinamicamente
        let chatInput = null;
        
        // ESTRATÉGIA 1: Procurar input visível e não disabled
        const allInputs = [
            document.getElementById('chatbotActiveInput'),
            document.getElementById('chatbotMainInput'),
            document.querySelector('.chatbot-active-input'),
            document.querySelector('.chatbot-main-input'),
            ...document.querySelectorAll('input[type="text"]')
        ];
        
        for (let input of allInputs) {
            if (input && !input.disabled) {
                // Verificar se o input está visível
                const style = window.getComputedStyle(input);
                const parent = input.closest('.chatbot-active-state, .chatbot-welcome-state');
                
                if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                    if (!parent || window.getComputedStyle(parent).display !== 'none') {
                        chatInput = input;
                        log(`✅ Input ATIVO encontrado: ${input.id || input.className}`);
                        break;
                    }
                }
            }
        }
        
        if (!chatInput) {
            log('❌ NENHUM input ativo encontrado!');
            log('🔍 Inputs disponíveis:', {
                activeInput: document.getElementById('chatbotActiveInput'),
                mainInput: document.getElementById('chatbotMainInput'),
                allInputs: document.querySelectorAll('input')
            });
            alert('❌ Campo de texto do chat não encontrado!');
            return;
        }
        
        window.voiceState.currentInput = chatInput;
        log('✅ Usando input:', {
            id: chatInput.id,
            className: chatInput.className,
            placeholder: chatInput.placeholder,
            visible: window.getComputedStyle(chatInput).display !== 'none'
        });
        
        // Resetar variáveis
        window.voiceState.finalTranscript = '';
        chatInput.value = '';
        
        // Feedback visual CONTÍNUO para o microfone atual
        if (window.voiceState.currentMicIcon) {
            window.voiceState.currentMicIcon.style.fill = '#ff4444';
            window.voiceState.currentMicIcon.style.transform = 'scale(1.1)';
            window.voiceState.currentMicIcon.style.filter = 'drop-shadow(0 0 10px #ff4444)';
            window.voiceState.currentMicIcon.style.animation = 'pulse 1.5s infinite';
        }
        
        chatInput.placeholder = '🔴 Captando áudio... Clique novamente para parar';
        
        // Adicionar animação pulsante para indicar gravação ativa
        if (!document.querySelector('#voice-animation-style')) {
            const style = document.createElement('style');
            style.id = 'voice-animation-style';
            style.textContent = `
                @keyframes pulse {
                    0% { transform: scale(1.1); }
                    50% { transform: scale(1.2); filter: drop-shadow(0 0 15px #ff4444); }
                    100% { transform: scale(1.1); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Configurar eventos do recognition
        recognition.onstart = function() {
            window.voiceState.isRecording = true;
            log('🎤 ✅ GRAVAÇÃO INICIADA!');
        };
        
        recognition.onresult = function(event) {
            log('📝 Resultado recebido:', event.results.length, 'resultados');
            
            let interimTranscript = '';
            let newFinalTranscript = '';
            
            // Processar todos os resultados
            for (let i = 0; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                const confidence = event.results[i][0].confidence || 0;
                const isFinal = event.results[i].isFinal;
                
                log(`   [${i}] "${transcript}" (final: ${isFinal}, conf: ${confidence.toFixed(2)})`);
                
                if (isFinal) {
                    newFinalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            // Atualizar transcript final
            if (newFinalTranscript) {
                window.voiceState.finalTranscript += newFinalTranscript + ' ';
                log('✅ Texto final atualizado:', window.voiceState.finalTranscript);
            }
            
            // Mostrar no input ATUAL (final + interim)
            if (window.voiceState.currentInput) {
                const displayText = (window.voiceState.finalTranscript + interimTranscript).trim();
                window.voiceState.currentInput.value = displayText;
                log('🔄 Input ATUAL atualizado com:', displayText);
            }
        };
        
        recognition.onend = function() {
            log('🏁 Recognition tentou finalizar');
            log('📊 Texto final capturado:', window.voiceState.finalTranscript);
            log('🎤 Usuário ainda quer gravar?', window.voiceState.isRecording);
            
            // SE O USUÁRIO AINDA QUER GRAVAR (não clicou para parar)
            if (window.voiceState.isRecording) {
                log('🔄 REINICIANDO automaticamente - usuário não parou manualmente');
                
                // Tentar reiniciar em 100ms
                setTimeout(() => {
                    if (window.voiceState.isRecording) {
                        try {
                            log('🚀 Reiniciando recognition...');
                            recognition.start();
                            return; // NÃO continuar com finalização
                        } catch (e) {
                            log('❌ Erro ao reiniciar:', e.message);
                            // Se não conseguir reiniciar, finalizar normalmente
                        }
                    }
                }, 100);
                
                // Se conseguir reiniciar, não executar o resto da função
                if (window.voiceState.isRecording) return;
            }
            
            // FINALIZAÇÃO NORMAL (quando usuário clicou para parar)
            log('🏁 Finalizando gravação por solicitação do usuário');
            window.voiceState.isRecording = false;
            
            // Restaurar visual COMPLETAMENTE do microfone atual
            if (window.voiceState.currentMicIcon) {
                window.voiceState.currentMicIcon.style.fill = 'currentColor';
                window.voiceState.currentMicIcon.style.transform = 'scale(1)';
                window.voiceState.currentMicIcon.style.filter = 'none';
                window.voiceState.currentMicIcon.style.animation = 'none';
            }
            
            if (window.voiceState.currentInput) {
                window.voiceState.currentInput.placeholder = 'Digite sua mensagem...';
            }
            
            log('🎨 Visual restaurado - gravação finalizada');
            
            // Garantir que o texto final está no input ATUAL
            const cleanText = window.voiceState.finalTranscript.trim();
            if (cleanText && window.voiceState.currentInput) {
                window.voiceState.currentInput.value = cleanText;
                log('✅ SUCESSO! Texto final no input ATUAL:', window.voiceState.currentInput.value);
                
                // Disparar eventos
                window.voiceState.currentInput.dispatchEvent(new Event('input', { bubbles: true }));
                window.voiceState.currentInput.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                log('⚠️ Nenhum texto foi capturado');
                if (window.voiceState.currentInput) {
                    window.voiceState.currentInput.placeholder = 'Nenhum texto capturado - tente novamente';
                }
            }
        };
        
        recognition.onerror = function(event) {
            log('❌ ERRO na gravação:', event.error);
            
            window.voiceState.isRecording = false;
            
            // Restaurar visual COMPLETAMENTE do microfone atual
            if (window.voiceState.currentMicIcon) {
                window.voiceState.currentMicIcon.style.fill = 'currentColor';
                window.voiceState.currentMicIcon.style.transform = 'scale(1)';
                window.voiceState.currentMicIcon.style.filter = 'none';
                window.voiceState.currentMicIcon.style.animation = 'none';
            }
            
            // Tratar erros específicos
        switch(event.error) {
                case 'not-allowed':
                    if (window.voiceState.currentInput) window.voiceState.currentInput.placeholder = '❌ Permissão negada - habilite o microfone';
                    alert('❌ Permissão do microfone negada!\n\nClique no ícone de microfone na barra de endereços e permita o acesso.');
                    break;
                case 'network':
                    if (window.voiceState.currentInput) window.voiceState.currentInput.placeholder = '❌ Erro de rede - verifique sua conexão';
                    break;
                case 'no-speech':
                    if (window.voiceState.currentInput) window.voiceState.currentInput.placeholder = '❌ Nenhuma fala detectada - tente novamente';
                    break;
                case 'aborted':
                    if (window.voiceState.currentInput) window.voiceState.currentInput.placeholder = 'Gravação interrompida pelo usuário';
                    log('ℹ️ Gravação foi interrompida pelo usuário - normal');
                    break;
                default:
            if (window.voiceState.currentInput) window.voiceState.currentInput.placeholder = `❌ Erro: ${event.error}`;
                    break;
            }
        };
        
        // INICIAR GRAVAÇÃO
        try {
            log('🎯 Chamando recognition.start()...');
            recognition.start();
        } catch (error) {
            log('❌ Erro ao iniciar gravação:', error);
            alert('❌ Erro ao iniciar gravação: ' + error.message);
        }
    }
    
    log('🎉 Voice integration configurada com sucesso!');
}

log('📄 voice-clean.js carregado');
