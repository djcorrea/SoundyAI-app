/* ============ PROD.AI CHATBOT SCRIPT - VERSÃO 2025.01.28-17:12 ============ */
/* 🛑 CACHE BUSTING: Forçar reload do navegador */
// Área de conversa do novo layout
const chatbox = document.getElementById('chatbotConversationArea');
// Input principal (welcome state)
const input = document.getElementById('chatbotMainInput');
// Botão de envio principal (welcome state)
const sendBtn = document.getElementById('chatbotSendButton');
// Indicador de digitação do novo layout
const typingIndicator = document.getElementById('chatbotTypingIndicator');

let isFirstMessage = true;
let conversationHistory = [];
let chatStarted = false;

/* ============ VARIÁVEIS GLOBAIS (Visual Novo) ============ */
let vantaEffect = null;
let isDesktop = window.innerWidth > 768;

/* ============ CONFIGURAÇÃO DA API (Sistema Antigo) ============ */
const API_CONFIG = {
  baseURL: (() => {
    const host = window.location.hostname || '';
    // Produção/preview no domínio do frontend -> usar mesma origem para evitar CORS
    const isVercel = host.endsWith('vercel.app');
    const isAiSynthProject = isVercel && (
      host.toLowerCase().startsWith('ai-synth') ||
      host.includes('ai-synth-dj-correas-projects') ||
      host.includes('ai-synth-czzxlraox-dj-correas-projects')
    );
    if (isAiSynthProject || host === 'https://soundyai-app-production.up.railway.app' || 
        host === 'https://soundyai-app-production.up.railway.app' ||
        host === 'ai-synth-czzxlraox-dj-correas-projects.vercel.app') {
      return '/api';
    }
    // Ambiente local mantém uso do backend dedicado atual
    if (host === 'localhost' || host.startsWith('127.0.0.1')) {
      return 'https://soundyai-app-production.up.railway.app/api';
    }
    // Demais casos: manter backend dedicado atual
    return 'https://soundyai-app-production.up.railway.app/api';
  })(),

  get chatEndpoint() {
    return `${this.baseURL}/chat`;
  }
};

/* ============ FUNÇÕES GLOBAIS SIMPLIFICADAS ============ */
// Versão otimizada - definições diretas sem verificações excessivas
window.testAPIConnection = window.testAPIConnection || async function() {
    try {
        if (!document.querySelector('#startSendBtn') && !document.querySelector('#sendBtn')) return;
        const response = await fetch(API_CONFIG.chatEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'teste de conexão', userUid: 'test' })
        });
        // API test - silent mode for performance
    } catch (error) {
        // Silent API error handling
    }
};

window.initParticleEffects = window.initParticleEffects || function() {
    const heroSection = document.querySelector('.hero');
    const ctaSection = document.querySelector('.cta');
    if (heroSection) heroSection.classList.add('particles-active');
    if (ctaSection) ctaSection.classList.add('particles-active');
};

window.setupEventListeners = window.setupEventListeners || function() {
    // Configurações básicas se necessário
};

/* ============ FUNÇÕES GLOBAIS (Declaradas no início para evitar erros) ============ */
// Função testAPIConnection (definição completa no início)
window.testAPIConnection = async function testAPIConnection() {
  try {
    // Verificar se estamos na página principal
    if (!document.querySelector('#startSendBtn') && !document.querySelector('#sendBtn')) {
      return;
    }
    
    const response = await fetch(API_CONFIG.chatEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'teste de conexão',
        userUid: 'test'
      })
    });
    
    // Silent API check for performance
  } catch (error) {
    // Silent error handling
  }
};

// Função initParticleEffects (definição completa no início)
window.initParticleEffects = function initParticleEffects() {
    try {
        // Verificar se os elementos existem antes de aplicar efeitos
        const heroSection = document.querySelector('.hero');
        const ctaSection = document.querySelector('.cta');
        
        if (heroSection) {
            // Adicionar classe para efeitos de partículas na seção hero
            heroSection.classList.add('particles-active');
        }
        
        if (ctaSection) {
            // Adicionar classe para efeitos de partículas na seção CTA
            ctaSection.classList.add('particles-active');
        }
        
    } catch (error) {
        // Silent error handling for particles
    }
};

/* ============ INICIALIZAÇÃO DO VANTA BACKGROUND (Visual Novo) ============ */
function initVantaBackground() {
    try {
        // Verificar se estamos na página principal e se o elemento existe
        const vantaElement = document.getElementById("vanta-bg");
        if (!vantaElement) {
            return;
        }
        
        if (typeof VANTA !== 'undefined' && typeof THREE !== 'undefined') {
            // Balanceado: Visual preservado + performance otimizada
            const isLowPerformance = navigator.hardwareConcurrency <= 4;
            vantaEffect = VANTA.NET({
                el: "#vanta-bg",
                mouseControls: true,
                touchControls: true,
                gyroControls: false,
                minHeight: 200.00,
                minWidth: 200.00,
                scale: 1.00,
                scaleMobile: 1.00,
                color: 0x8a2be2,
                backgroundColor: 0x0a0a1a,
                // Balanceado: Redução moderada - visual mantido
                points: isLowPerformance ? 3.00 : (isDesktop ? 6.00 : 3.00),
                maxDistance: isLowPerformance ? 12.00 : (isDesktop ? 20.00 : 12.00),
                spacing: isLowPerformance ? 30.00 : (isDesktop ? 20.00 : 28.00),
                showDots: true // Manter pontos visíveis para visual
            });
            // Vanta.js loaded successfully
        } else {
            // Vanta.js not available on this page
        }
    } catch (error) {
        // Silent Vanta.js error handling
    }
}

/* ============ EFEITOS DE HOVER (Visual Novo) ============ */
function initHoverEffects() {
    const elements = [
        { selector: '.robo', scale: 1.03, glow: 40 },
        { selector: '.notebook', scale: 1.06, glow: 30 },
        { selector: '.teclado', scale: 1.05, glow: 25 },
        { selector: '.caixas', scale: 1.04, glow: 35 },
        { selector: '.mesa', scale: 1.01, glow: 25 }
    ];
    
    elements.forEach(({ selector, scale }) => {
        const element = document.querySelector(selector);
        if (!element) return;
        
        element.addEventListener('mouseenter', () => {
            if (typeof gsap !== 'undefined') {
                gsap.to(element, {
                    scale: scale,
                    y: selector !== '.mesa' ? -8 : 0,
                    duration: 0.2,
                    ease: "back.out(1.7)"
                });
            }
        });
        
        element.addEventListener('mouseleave', () => {
            if (typeof gsap !== 'undefined') {
                gsap.to(element, {
                    scale: 1,
                    y: 0,
                    duration: 0.2,
                    ease: "back.out(1.7)"
                });
            }
        });
    });
}

/* ============ DETECÇÃO DE PERFORMANCE E OTIMIZAÇÕES AUTOMÁTICAS ============ */
function optimizeForMobile() {
    const isLowPerformance = navigator.hardwareConcurrency <= 4 || navigator.deviceMemory <= 4;
    const isOldDevice = /iPhone [1-8]|iPad.*OS [1-9]|Android [1-6]/.test(navigator.userAgent);
    
    if (isLowPerformance || isOldDevice) {
        const style = document.createElement('style');
        style.textContent = `
            /* OTIMIZADO: Apenas reduzir frequência de animações, não remover */
            .robo, .notebook, .teclado, .caixas, .mesa {
                animation-duration: 8s !important; /* Mais lento = menos processamento */
            }
            .chatbot-main-robot {
                animation-duration: 4s !important; /* Reduzir frequência */
            }
            .floating-particle {
                animation-duration: 20s !important; /* Muito mais lento */
            }
            /* Manter visual mas reduzir processamento */
            .particles-overlay {
                opacity: 0.3 !important; /* Reduzir mas não esconder */
            }
        `;
        document.head.appendChild(style);
        console.warn('🐌 Dispositivo com performance baixa detectado - animações otimizadas');
        return true; // Performance mode enabled
    }
    
    // Mobile optimizations mais suaves
    if (!isDesktop) {
        const style = document.createElement('style');
        style.textContent = `
            /* Manter animações mas reduzir frequência no mobile */
            .robo, .notebook, .teclado, .caixas, .mesa {
                animation-duration: 6s !important; /* Mais lento no mobile */
            }
            .particles-overlay {
                opacity: 0.5 !important; /* Reduzir mas manter visível */
            }
        `;
        document.head.appendChild(style);
        // Mobile optimizations applied
    }
    return false; // Normal performance
}

/* ============ REDIMENSIONAMENTO OTIMIZADO (Visual Novo) ============ */
let resizeTimeout;
function handleResize() {
    // Throttle para evitar execução excessiva
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const newIsDesktop = window.innerWidth > 768;
        
        if (newIsDesktop !== isDesktop) {
            isDesktop = newIsDesktop;
            
            if (vantaEffect) {
                vantaEffect.destroy();
                setTimeout(initVantaBackground, 50);
            }
            
            optimizeForMobile();
        }
        
        // Combinar com a funcionalidade do indicator
        const indicator = document.getElementById('messages-remaining-indicator');
        if (indicator) {
            indicator.style.display = window.innerWidth <= 767 ? 'none' : 'block';
        }
    }, 150); // Throttle de 150ms
}

/* ============ FUNÇÕES DO SISTEMA ANTIGO ============ */
function waitForFirebase() {
  // Waiting for Firebase...
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 50; // Máximo 5 segundos (50 * 100ms)
    
    const checkFirebase = () => {
      // Reduzir console.log excessivos - só logar na primeira e última tentativa
      if (attempts === 0 || attempts >= maxAttempts - 1) {
        console.log('🔍 Verificando Firebase:', { auth: !!window.auth, firebaseReady: !!window.firebaseReady });
      }
      if (window.auth && window.firebaseReady) {
        console.log('✅ Firebase pronto!');
        resolve();
        return; // PARAR O LOOP
      } else if (attempts >= maxAttempts) {
        console.warn('⚠️ Timeout no Firebase, continuando...');
        resolve();
        return; // PARAR O LOOP
      } else {
        attempts++;
        if (attempts === 1) {
          console.log('⏳ Firebase ainda não está pronto, aguardando...');
        }
        setTimeout(checkFirebase, 100);
      }
    };
    checkFirebase();
  });
}

/* ============ CLASSE CHATBOT INTEGRADA COM FUNCIONALIDADES EXISTENTES ============ */
class ProdAIChatbot {
    constructor() {
        this.isActive = false;
        this.messageCount = 0;
        this.init();
    }
    
    init() {
        this.setupElements();
        this.setupEventListeners();
        this.waitForPageLoad();
    }
    
    setupElements() {
        // Container principal
        this.container = document.getElementById('chatbotContainer');
        
        // Estado Welcome
        this.welcomeState = document.getElementById('chatbotWelcomeState');
        this.mainRobot = document.getElementById('chatbotMainRobot');
        this.mainTitle = document.getElementById('chatbotMainTitle');
        this.mainSubtitle = document.getElementById('chatbotMainSubtitle');
        this.branding = document.getElementById('chatbotBranding');
        this.inputSection = document.getElementById('chatbotInputSection');
        this.mainInput = document.getElementById('chatbotMainInput');
        this.sendButton = document.getElementById('chatbotSendButton');
        
        // Estado Ativo
        this.activeState = document.getElementById('chatbotActiveState');
        this.headerBar = document.getElementById('chatbotHeaderBar');
        this.conversationArea = document.getElementById('chatbotConversationArea');
        this.typingIndicator = document.getElementById('chatbotTypingIndicator');
        this.activeInput = document.getElementById('chatbotActiveInput');
        this.activeSendBtn = document.getElementById('chatbotActiveSendBtn');
    }
    
    setupEventListeners() {
        // Eventos do estado Welcome
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => this.handleFirstMessage());
        }
        if (this.mainInput) {
            this.mainInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleFirstMessage();
            });
            this.mainInput.addEventListener('focus', () => this.animateInputFocus());
        }
        
        // Eventos do estado Ativo
        if (this.activeSendBtn) {
            this.activeSendBtn.addEventListener('click', () => this.sendMessage());
        }
        if (this.activeInput) {
            this.activeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendMessage();
            });
        }
        
        // Event listeners para botões de ação
        const actionButtons = document.querySelectorAll('.chatbot-action-btn');
        actionButtons.forEach(button => {
            if (button) {
                button.addEventListener('click', (e) => {
                    const action = e.target.closest('.chatbot-action-btn').getAttribute('data-action');
                    this.handleActionButton(action);
                });
            }
        });
    }
    
    handleActionButton(action) {
        switch(action) {
            case 'analyze':
                if (typeof window.openModeSelectionModal === 'function') {
                    window.openModeSelectionModal();
                } else {
                    console.error('openModeSelectionModal não está disponível');
                }
                break;
            case 'upgrade':
                window.location.href = 'planos.html';
                break;
            case 'manage':
                window.location.href = 'gerenciar.html';
                break;
            case 'logout':
                if (typeof window.logout === "function") {
                    window.logout();
                } else {
                    localStorage.clear();
                    window.location.href = "login.html";
                }
                break;
        }
    }
    
    waitForPageLoad() {
        let attempts = 0;
        const maxAttempts = 200; // Máximo 10 segundos (200 * 50ms)
        
        // Cache do querySelector para evitar consultas repetidas
        const images = document.querySelectorAll('img');
        
        const checkPageReady = () => {
            // Otimizado: Não fazer querySelectorAll a cada loop
            let allImagesLoaded = true;
            
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                if (!img.complete || img.naturalHeight === 0) {
                    allImagesLoaded = false;
                    break; // Early exit - mais eficiente que forEach
                }
            }
            
            const librariesLoaded = typeof gsap !== 'undefined' && typeof VANTA !== 'undefined';
            
            if (allImagesLoaded && librariesLoaded) {
                // Aguardar as animações fadeInPush dos elementos terminarem (0.6s) + buffer
                setTimeout(() => {
                    this.animateInitialAppearance();
                }, 1000); // 0.6s animação + 0.4s buffer para sincronia suave
                return; // PARAR O LOOP
            } else if (attempts >= maxAttempts) {
                console.warn('⚠️ Timeout no carregamento, continuando...');
                // Mesmo com timeout, aguardar um pouco para não conflitar
                setTimeout(() => {
                    this.animateInitialAppearance();
                }, 1000);
                return; // PARAR O LOOP
            } else {
                attempts++;
                setTimeout(checkPageReady, 50);
            }
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkPageReady);
        } else {
            checkPageReady();
        }
    }
    
    animateInitialAppearance() {
        if (typeof gsap !== 'undefined') {
            gsap.fromTo(this.container, 
                { 
                    scale: 0.7, 
                    opacity: 0,
                    rotationY: 20,
                    y: 50
                },
                { 
                    scale: 1, 
                    opacity: 1,
                    rotationY: 0,
                    y: 0,
                    duration: 0.6,
                    ease: "back.out(1.7)"
                }
            );
            
            const tl = gsap.timeline({ delay: 0.15 });
            
            tl.fromTo([this.mainRobot, this.mainTitle, this.mainSubtitle, this.inputSection], 
                { scale: 0.5, opacity: 0, y: 30 },
                { 
                    scale: 1, 
                    opacity: 1, 
                    y: 0, 
                    duration: 0.5, 
                    ease: "back.out(1.7)",
                    stagger: 0.05
                }
            );
        } else {
            this.container.style.opacity = '1';
        }
    }
    
    animateInputFocus() {
        if (typeof gsap !== 'undefined') {
            gsap.to(this.inputSection, {
                scale: 1.02,
                duration: 0.15,
                ease: "power2.out"
            });
        }
    }
    
    async handleFirstMessage() {
        const message = this.mainInput.value.trim();
        if (!message) {
            this.shakeInput();
            return;
        }
        
        // 🖼️ Verificar se há imagens selecionadas
        let images = [];
        if (window.imagePreviewSystem && window.imagePreviewSystem.hasImages()) {
            images = window.imagePreviewSystem.getImagesForSending();
            console.log('📸 Primeira mensagem com imagens:', images.length);
        }
        
        // Se há imagens mas não há texto, não permitir envio
        if (images.length > 0 && !message) {
            console.warn('❌ Não é possível enviar apenas imagens sem texto');
            this.shakeInput();
            return;
        }
        
        // Integrar com a função sendFirstMessage existente
        await this.activateChat(message, images);
    }
    
    shakeInput() {
        if (typeof gsap !== 'undefined') {
            gsap.to(this.inputSection, {
                x: -10,
                duration: 0.05,
                repeat: 5,
                yoyo: true,
                ease: "power2.inOut",
                onComplete: () => {
                    gsap.set(this.inputSection, { x: 0 });
                }
            });
        }
    }
    
    async activateChat(firstMessage, images = []) {
        if (this.isActive) return;
        this.isActive = true;
        
        // 🖼️ Limpar imagens após capturar para envio
        if (window.imagePreviewSystem && images.length > 0) {
            window.imagePreviewSystem.clearImages();
        }
        
        // Aguardar autenticação Firebase (integração com sistema existente)
        await waitForFirebase();
        
        if (typeof gsap !== 'undefined') {
            const tl = gsap.timeline();
            
            tl.to([this.mainRobot, this.branding], {
                opacity: 0,
                y: -60,
                scale: 0.8,
                duration: 0.3,
                ease: "power2.inOut"
            })
            
            .to(this.container, {
                width: 850,
                height: 750,
                duration: 0.4,
                ease: "back.out(1.7)"
            }, "-=0.15")
            
            .set(this.welcomeState, { display: 'none' })
            .set(this.activeState, { display: 'flex' })
            
            .fromTo([this.activeState, this.headerBar, this.conversationArea, '.chatbot-input-area'], 
                { opacity: 0, y: 20 },
                { 
                    opacity: 1, 
                    y: 0, 
                    duration: 0.4, 
                    ease: "power2.out",
                    stagger: 0.05
                }
            );
        } else {
            this.welcomeState.style.display = 'none';
            this.activeState.style.display = 'flex';
            this.activeState.classList.add('active');
            this.container.classList.add('expanded');
        }
        
        setTimeout(() => {
            this.addMessage(firstMessage, 'user', images);
            this.activeInput.focus();
            
            // Integrar com processMessage existente, agora com suporte a imagens
            setTimeout(() => {
                this.showTyping();
                processMessage(firstMessage, images).then(() => {
                    this.hideTyping();
                });
            }, 200);
        }, 800);
    }
    
    async sendMessage() {
        const message = this.activeInput.value.trim();
        if (!message) return;
        
        // 🖼️ Verificar se há imagens selecionadas
        let images = [];
        if (window.imagePreviewSystem && window.imagePreviewSystem.hasImages()) {
            images = window.imagePreviewSystem.getImagesForSending();
            console.log('📸 Imagens encontradas para envio:', images.length);
        }
        
        // Se há imagens mas não há texto, não permitir envio
        if (images.length > 0 && !message) {
            console.warn('❌ Não é possível enviar apenas imagens sem texto');
            return;
        }
        
        this.addMessage(message, 'user', images);
        this.activeInput.value = '';
        
        // 🖼️ Limpar imagens após adicionar à mensagem
        if (window.imagePreviewSystem && images.length > 0) {
            window.imagePreviewSystem.clearImages();
        }
        
        // Usar a função processMessage existente, agora com suporte a imagens
        setTimeout(() => {
            this.showTyping();
            processMessage(message, images).then(() => {
                this.hideTyping();
            });
        }, 100);
    }
    
    addMessage(text, sender, images = []) {
        // Usar a função appendMessage global que já está adaptada ao novo layout
        let formattedText = sender === 'user' ? `<strong>Você:</strong> ${text}` : `<strong>Assistente:</strong> ${text}`;
        
        // 🖼️ Se há imagens, adicionar preview na mensagem
        if (images.length > 0 && sender === 'user') {
            const imagesPreviews = images.map(img => 
                `<div class="message-image-preview">
                    <img src="data:${img.type};base64,${img.base64}" alt="${img.filename}" style="max-width: 200px; max-height: 150px; border-radius: 4px; margin: 4px;">
                    <div style="font-size: 11px; color: rgba(255,255,255,0.6);">${img.filename}</div>
                </div>`
            ).join('');
            
            formattedText += `<div class="message-images" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">${imagesPreviews}</div>`;
        }
        
        appendMessage(formattedText, sender === 'user' ? 'user' : 'bot');
        
        // Adicionar ao histórico de conversa
        const historyEntry = { role: sender, content: text };
        if (images.length > 0) {
            historyEntry.images = images;
        }
        conversationHistory.push(historyEntry);
        this.messageCount++;
    }
    
    showTyping() {
        showTypingIndicator();
    }
    
    hideTyping() {
        hideTypingIndicator();
    }
    
    scrollToBottom() {
        const chatboxEl = document.getElementById('chatbotConversationArea');
        if (chatboxEl) {
            setTimeout(() => {
                chatboxEl.scrollTop = chatboxEl.scrollHeight;
            }, 25);
        }
    }
    
    getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
}

/* ============ ANIMAÇÕES E FUNCIONALIDADES (Sistema Existente Adaptado) ============ */

async function animateToChat() {
  const startScreen = document.getElementById('startScreen');
  const startHeader = document.getElementById('startHeader');
  const motivationalText = document.getElementById('motivationalText');
  const startInputContainer = document.getElementById('startInputContainer');
  const mainHeader = document.getElementById('mainHeader');
  const chatContainer = document.getElementById('chatContainer');
  const mainFooter = document.getElementById('mainFooter');
  const container = document.getElementById('chatbotContainer');

  if (!startScreen) return;

  // Animar elementos de saída
  if (motivationalText) motivationalText.classList.add('fade-out');
  if (startInputContainer) startInputContainer.classList.add('fade-out');

  setTimeout(() => {
    if (startHeader) startHeader.classList.add('animate-to-top');
  }, 200);

  // Expandir container usando GSAP se disponível
  if (typeof gsap !== 'undefined' && container) {
    gsap.to(container, {
      width: 850,
      height: 750,
      duration: 0.6,
      ease: "back.out(1.7)",
      delay: 0.3
    });
  }

  setTimeout(() => {
    if (startScreen) startScreen.style.display = 'none';
    if (mainHeader) mainHeader.style.display = 'block';
    if (chatContainer) chatContainer.style.display = 'flex';
    if (mainFooter) mainFooter.style.display = 'flex';

    setTimeout(() => {
      if (chatContainer) chatContainer.classList.add('expanded');
      if (mainHeader) mainHeader.classList.add('header-visible');
      if (mainFooter) mainFooter.classList.add('footer-visible');

      const mainInput = document.getElementById('user-input');
      if (mainInput) mainInput.focus();
    }, 50);
  }, 500);
}

// ═══════════════════════════════════════════════════════════
// 🎴 SISTEMA DE RENDERIZAÇÃO DE CARDS EDUCACIONAIS
// ═══════════════════════════════════════════════════════════

/**
 * Parse texto markdown simples para HTML
 * @param {string} text - Texto com markdown básico
 * @returns {string} HTML formatado
 */
function parseMarkdownToHTML(text) {
  if (!text) return '';
  
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Listas
    .replace(/^• (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\) (.+)$/gm, '<li><strong>$1)</strong> $2</li>')
    // Checkboxes
    .replace(/^(\d+)\. ☐ (.+)$/gm, '<li><input type="checkbox" disabled> $2</li>')
    // Code inline
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Quebras de linha duplas → parágrafos
    .replace(/\n\n/g, '</p><p>')
    // Quebras de linha simples → <br>
    .replace(/\n/g, '<br>');
}

/**
 * Parse cards e subcards do texto da IA
 * @param {string} text - Texto com sintaxe [CARD] e [SUBCARD]
 * @returns {Array} Array de objetos card { type, title, content, subcards }
 */
function parseCards(text) {
  if (!text || typeof text !== 'string') return null;
  
  // Detectar se há sintaxe de CARD
  if (!text.includes('[CARD')) {
    return null; // Fallback para texto normal
  }
  
  const cards = [];
  
  // Regex para capturar CARDS principais
  const cardRegex = /\[CARD title="([^"]+)"\]([\s\S]*?)\[\/CARD\]/g;
  let cardMatch;
  
  while ((cardMatch = cardRegex.exec(text)) !== null) {
    const title = cardMatch[1];
    const cardContent = cardMatch[2].trim();
    
    // Parse subcards dentro deste card
    const subcards = [];
    const subcardRegex = /\[SUBCARD title="([^"]+)"\]([\s\S]*?)\[\/SUBCARD\]/g;
    let subcardMatch;
    
    let contentWithoutSubcards = cardContent;
    
    while ((subcardMatch = subcardRegex.exec(cardContent)) !== null) {
      subcards.push({
        title: subcardMatch[1],
        content: subcardMatch[2].trim()
      });
      // Remover subcard do conteúdo principal
      contentWithoutSubcards = contentWithoutSubcards.replace(subcardMatch[0], '');
    }
    
    cards.push({
      type: 'CARD',
      title: title,
      content: contentWithoutSubcards.trim(),
      subcards: subcards.length > 0 ? subcards : null
    });
  }
  
  return cards.length > 0 ? cards : null;
}

/**
 * Renderiza cards educacionais com glass effect
 * @param {HTMLElement} container - Elemento onde renderizar
 * @param {string} text - Texto com sintaxe de cards
 */
function renderAssistantCards(container, text) {
  const cards = parseCards(text);
  
  // Se não há cards, usar renderização normal
  if (!cards) {
    container.innerHTML = parseMarkdownToHTML(text);
    return;
  }
  
  // Container principal de cards
  const cardsWrapper = document.createElement('div');
  cardsWrapper.className = 'ai-cards-container';
  
  cards.forEach((card, cardIndex) => {
    // Card principal
    const cardEl = document.createElement('div');
    cardEl.className = 'ai-card';
    
    // Título do card
    const cardTitle = document.createElement('div');
    cardTitle.className = 'ai-card-title';
    cardTitle.innerHTML = card.title;
    cardEl.appendChild(cardTitle);
    
    // Conteúdo do card (antes dos subcards)
    if (card.content) {
      const cardBody = document.createElement('div');
      cardBody.className = 'ai-card-body';
      cardBody.innerHTML = parseMarkdownToHTML(card.content);
      cardEl.appendChild(cardBody);
    }
    
    // Subcards (se houver)
    if (card.subcards && card.subcards.length > 0) {
      const subcardsContainer = document.createElement('div');
      subcardsContainer.className = 'ai-subcards-container';
      
      card.subcards.forEach((subcard, subcardIndex) => {
        const subcardEl = document.createElement('div');
        subcardEl.className = 'ai-subcard';
        
        // Título do subcard
        const subcardTitle = document.createElement('div');
        subcardTitle.className = 'ai-subcard-title';
        subcardTitle.innerHTML = subcard.title;
        subcardEl.appendChild(subcardTitle);
        
        // Conteúdo do subcard
        const subcardBody = document.createElement('div');
        subcardBody.className = 'ai-subcard-body';
        subcardBody.innerHTML = parseMarkdownToHTML(subcard.content);
        subcardEl.appendChild(subcardBody);
        
        subcardsContainer.appendChild(subcardEl);
        
        // Animação GSAP se disponível
        if (typeof gsap !== 'undefined') {
          gsap.fromTo(subcardEl,
            { opacity: 0, y: 20, scale: 0.95 },
            { 
              opacity: 1, 
              y: 0, 
              scale: 1, 
              duration: 0.4,
              delay: cardIndex * 0.1 + subcardIndex * 0.05,
              ease: "back.out(1.2)"
            }
          );
        }
      });
      
      cardEl.appendChild(subcardsContainer);
    }
    
    cardsWrapper.appendChild(cardEl);
    
    // Animação GSAP para card principal
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(cardEl,
        { opacity: 0, y: 30, scale: 0.95 },
        { 
          opacity: 1, 
          y: 0, 
          scale: 1, 
          duration: 0.5,
          delay: cardIndex * 0.15,
          ease: "back.out(1.5)"
        }
      );
    }
  });
  
  container.appendChild(cardsWrapper);
}

function appendMessage(content, className) {
  // Usar a área de conversa do novo layout
  const chatboxEl = document.getElementById('chatbotConversationArea');
  if (!chatboxEl) {
    console.error('Área de conversa não encontrada');
    return;
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = `chatbot-message ${className === 'bot' ? 'chatbot-message-assistant' : 'chatbot-message-user'}`;
  
  // Avatar removido para aumentar largura da conversa
  // const avatar = document.createElement('div');
  // avatar.className = 'chatbot-message-avatar';
  // avatar.innerHTML = className === 'bot' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
  
  // Criar container de conteúdo
  const messageContent = document.createElement('div');
  messageContent.className = 'chatbot-message-content';
  
  // Criar bubble da mensagem
  const bubble = document.createElement('div');
  bubble.className = 'chatbot-message-bubble ia-response';
  
  // Para mensagens do usuário, mostrar imediatamente
  if (className === 'user') {
    bubble.innerHTML = content.replace(/\n/g, '<br>');
  } else {
    // Para mensagens do bot, verificar se há cards
    // Iniciar vazio para permitir renderização de cards ou efeito de digitação
    bubble.innerHTML = '';
  }
  
  // Criar timestamp
  const timestamp = document.createElement('div');
  timestamp.className = 'chatbot-message-timestamp';
  timestamp.textContent = new Date().toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  // Montar estrutura
  messageContent.appendChild(bubble);
  messageContent.appendChild(timestamp);
  // messageDiv.appendChild(avatar); // Avatar removido
  messageDiv.appendChild(messageContent);
  
  chatboxEl.appendChild(messageDiv);
  
  // ✅ SCROLL INICIAL: Role até a nova mensagem uma única vez
  setTimeout(() => {
    messageDiv.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start',
      inline: 'nearest'
    });
  }, 100);

  // Animar entrada da mensagem com GSAP
  if (typeof gsap !== 'undefined') {
    gsap.fromTo(messageDiv, 
      { opacity: 0, y: 30, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.7)" }
    );
  }

  // Se for mensagem do bot, verificar se há cards ou usar texto normal
  if (className === 'bot') {
    // Tentar renderizar como cards
    const hasCards = content.includes('[CARD');
    
    if (hasCards) {
      // Renderizar cards imediatamente (sem efeito de digitação)
      renderAssistantCards(bubble, content);
    } else {
      // Fallback: efeito de digitação para texto normal
      startTypingEffect(bubble, content, messageDiv);
    }
  }
}

// Função para mostrar mensagens restantes de forma elegante
function showRemainingMessages(count) {
  if (count === null || count === undefined) return;
  
  // Não exibir no mobile (largura menor que 768px)
  if (window.innerWidth <= 767) {
    return;
  }
  
  try {
    // Criar ou atualizar indicador de mensagens restantes
    let indicator = document.getElementById('messages-remaining-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'messages-remaining-indicator';
      indicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(10, 10, 26, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 500;
        z-index: 1000;
        transition: all 0.3s ease;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(10, 10, 26, 0.3);
      `;
      document.body.appendChild(indicator);
    }
    
    indicator.innerHTML = `<i class="fas fa-comment"></i> ${count} mensagem${count !== 1 ? 's' : ''} restante${count !== 1 ? 's' : ''}`;
    
    // Mudar cor baseado na quantidade
    if (count <= 2) {
      indicator.style.background = 'rgba(10, 10, 26, 0.95)';
      indicator.style.borderColor = 'rgba(239, 68, 68, 0.5)';
      indicator.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.3)';
    } else if (count <= 5) {
      indicator.style.background = 'rgba(10, 10, 26, 0.95)';
      indicator.style.borderColor = 'rgba(245, 158, 11, 0.5)';
      indicator.style.boxShadow = '0 0 10px rgba(245, 158, 11, 0.3)';
    }
    
    // Animar se GSAP estiver disponível
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(indicator, 
        { scale: 1.2, opacity: 0.7 },
        { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.7)" }
      );
    }
  } catch (error) {
    console.log('⚠️ Erro ao mostrar indicador de mensagens (não crítico):', error.message);
  }
}

// ❌ REMOVIDO: System Prompt duplicado (mantido apenas no backend chat.js)
function formatarRespostaEstilosa(textoPuro) {
  // Função simplificada - não modifica o conteúdo da resposta
  let texto = textoPuro.replace(/<strong>Assistente:<\/strong>\s*/, '').trim();
  
  // Apenas formatação HTML básica, sem injections de prompts
  const linhas = texto.split('\n');
  let htmlFormatado = '';
  let dentroLista = false;
  
  for (let i = 0; i < linhas.length; i++) {
    let linha = linhas[i].trim();
    
    if (!linha) {
      if (dentroLista) {
        htmlFormatado += '</ul>';
        dentroLista = false;
      }
      htmlFormatado += '<br>';
      continue;
    }
    
    // Detectar itens de lista básicos apenas (sem emojis forçados)
    const regexLista = /^(\d+[\.\)]|\-|\•)\s+(.+)$/;
    
    if (regexLista.test(linha)) {
      if (!dentroLista) {
        htmlFormatado += '<ul>';
        dentroLista = true;
      }
      
      const match = linha.match(regexLista);
      if (match) {
        const icone = match[1];
        let conteudo = match[2];
        
        // Formatação básica mantida
        conteudo = conteudo.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        conteudo = conteudo.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        htmlFormatado += `<li>${icone} ${conteudo}</li>`;
      }
    } else {
      if (dentroLista) {
        htmlFormatado += '</ul>';
        dentroLista = false;
      }
      
      // Formatação básica mantida
      linha = linha.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      linha = linha.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      
      if (linha.length > 0) {
        htmlFormatado += `<p>${linha}</p>`;
      }
    }
  }
  
  // Fechar lista se ainda estiver aberta
  if (dentroLista) {
    htmlFormatado += '</ul>';
  }
  
  return `<div class="chatbot-message-estilosa">${htmlFormatado}</div>`;
}

// Função para aplicar emojis significativos no início de blocos de conteúdo
// ❌ REMOVIDO: System Prompt duplicado (mantido apenas no backend chat.js)

// ❌ REMOVIDO: System Prompt duplicado (mantido apenas no backend chat.js)
function aplicarEmojiDireto(texto) {
  // Função simplificada - não altera mais o conteúdo
  return texto;
}

// Função para injetar estilos CSS da resposta estilosa
function injetarEstilosRespostaEstilosa() {
  const style = document.createElement('style');
  style.textContent = `
    .chatbot-message-estilosa {
      background: linear-gradient(135deg, rgba(20, 26, 48, 0.7), rgba(28, 34, 58, 0.8));
      border: 1px solid rgba(80, 100, 150, 0.2);
      border-radius: 16px;
      padding: 20px 24px;
      margin: 15px 0;
      color: #ffffff;
      font-size: 16px;
      line-height: 1.7;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 6px 25px rgba(20, 26, 48, 0.3);
      backdrop-filter: blur(10px);
      position: relative;
      overflow: hidden;
    }

    .chatbot-message-estilosa::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, #4a90e2, #5aa3f0, #6bb6ff);
      border-radius: 16px 16px 0 0;
    }

    .chatbot-message-estilosa p {
      margin-bottom: 12px;
      font-weight: 600;
      font-size: 16px;
      color: #e3f2fd;
      line-height: 1.6;
    }

    .chatbot-message-estilosa p:last-child {
      margin-bottom: 0;
    }

    .chatbot-message-estilosa ul {
      list-style: none;
      padding-left: 0;
      margin: 16px 0 8px 0;
      background: rgba(20, 26, 48, 0.4);
      border-radius: 12px;
      padding: 12px;
    }

    .chatbot-message-estilosa li {
      margin-bottom: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      border-left: 3px solid rgba(106, 182, 255, 0.6);
      transition: all 0.2s ease;
    }

    .chatbot-message-estilosa li:hover {
      background: rgba(255, 255, 255, 0.08);
      border-left-color: #6ab6ff;
    }

    .chatbot-message-estilosa li:last-child {
      margin-bottom: 0;
    }

    .chatbot-message-estilosa strong {
      color: #ffffff;
      font-weight: 700;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      font-size: 16px;
    }

    .chatbot-message-estilosa em {
      color: #90caf9;
      font-style: italic;
      background: rgba(144, 202, 249, 0.15);
      padding: 2px 6px;
      border-radius: 4px;
    }

    .chatbot-message-estilosa br {
      line-height: 2;
    }

    /* Efeito de brilho sutil */
    .chatbot-message-estilosa {
      animation: subtle-glow 3s ease-in-out infinite alternate;
    }

    @keyframes subtle-glow {
      from {
        box-shadow: 0 6px 25px rgba(20, 26, 48, 0.3);
      }
      to {
        box-shadow: 0 8px 30px rgba(74, 144, 226, 0.2);
      }
    }

    /* Responsividade */
    @media (max-width: 768px) {
      .chatbot-message-estilosa {
        font-size: 14px;
        padding: 16px 18px;
        border-radius: 12px;
        margin: 12px 0;
      }
      
      .chatbot-message-estilosa p {
        font-size: 16px;
        margin-bottom: 10px;
      }

      .chatbot-message-estilosa ul {
        padding: 8px;
        margin: 12px 0 6px 0;
      }

      .chatbot-message-estilosa li {
        padding: 8px 10px;
        margin-bottom: 8px;
      }
    }

    /* Animação de entrada */
    .chatbot-message-estilosa {
      animation: slideInFromBottom 0.6s ease-out, subtle-glow 3s ease-in-out infinite alternate;
    }

    @keyframes slideInFromBottom {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `;
  document.head.appendChild(style);
}

// Função avançada para digitar HTML formatado mantendo a estrutura
function typeFormattedHTML(element, html, speed = 15) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  const nodes = Array.from(temp.childNodes);
  element.innerHTML = ""; // Limpa o destino

  let nodeIndex = 0;
  let isTyping = true;

  function typeNode() {
    if (nodeIndex >= nodes.length || !isTyping) {
      // Finalizar digitação e fazer scroll final
      setTimeout(() => {
        const messageDiv = element.closest('.chatbot-message');
        if (messageDiv) {
          messageDiv.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
          });
        }
      }, 500);
      return;
    }

    const node = nodes[nodeIndex++];

    if (node.nodeType === Node.TEXT_NODE) {
      // Nó de texto - digitar caractere por caractere
      const text = node.textContent;
      let charIndex = 0;
      const span = document.createElement("span");
      element.appendChild(span);

      function typeCharacter() {
        if (charIndex < text.length && isTyping) {
          span.textContent += text[charIndex++];
          
          // ❌ REMOVIDO: Scroll automático durante digitação
          // const chatboxEl = document.getElementById('chatbotConversationArea');
          // if (chatboxEl) {
          //   chatboxEl.scrollTop = chatboxEl.scrollHeight;
          // }
          
          setTimeout(typeCharacter, speed);
        } else {
          // Texto completo, passar para próximo nó
          setTimeout(typeNode, speed * 2);
        }
      }

      typeCharacter();

    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Nó elemento - clonar e continuar com conteúdo interno
      const clone = node.cloneNode(false); // Não clonar filhos
      element.appendChild(clone);

      if (node.childNodes.length > 0) {
        // Se tem filhos, digitar o conteúdo interno
        typeFormattedHTML(clone, node.innerHTML, speed);
        // Aguardar um pouco antes do próximo nó
        setTimeout(typeNode, speed * 3);
      } else {
        // Sem filhos, continuar
        setTimeout(typeNode, speed);
      }
    } else {
      // Outros tipos de nó, continuar
      setTimeout(typeNode, speed);
    }
  }

  typeNode();
  
  // Retornar função para parar a digitação se necessário
  return () => { isTyping = false; };
}

// Função para efeito de digitação nas respostas do bot
function startTypingEffect(bubbleElement, content, messageDiv) {
  // Aplicar formatação estilosa ao conteúdo primeiro
  const conteudoFormatado = formatarRespostaEstilosa(content);
  
  // Limpar o conteúdo inicial
  bubbleElement.innerHTML = '';
  
  // Iniciar digitação formatada após um pequeno delay
  setTimeout(() => {
    typeFormattedHTML(bubbleElement, conteudoFormatado, 15);
  }, 300);
}

function showTypingIndicator() {
  const chatboxEl = document.getElementById('chatbotConversationArea');
  
  if (chatboxEl) {
    // Remover indicador existente se houver
    const existingIndicator = chatboxEl.querySelector('.chatbot-conversation-typing');
    if (existingIndicator) {
      existingIndicator.remove();
    }
    
    // Criar novo indicador como mensagem
    const typingMessage = document.createElement('div');
    typingMessage.className = 'chatbot-conversation-typing active';
    typingMessage.innerHTML = `
      <span class="typing-text">SoundyAI está digitando</span>
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    
    chatboxEl.appendChild(typingMessage);
    chatboxEl.scrollTop = chatboxEl.scrollHeight;
  }
}

function hideTypingIndicator() {
  const chatboxEl = document.getElementById('chatbotConversationArea');
  
  if (chatboxEl) {
    const typingMessage = chatboxEl.querySelector('.chatbot-conversation-typing');
    if (typingMessage) {
      typingMessage.remove();
    }
  }
}

async function processMessage(message, images = []) {
  console.log('🚀 Processando mensagem:', message);
  if (images.length > 0) {
    console.log('📸 Processando com imagens:', images.length);
  }
  
  const mainSendBtn = document.getElementById('sendBtn');
  if (mainSendBtn && chatStarted) {
    mainSendBtn.disabled = true;
    mainSendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  }

  showTypingIndicator();

  try {
    console.log('⏳ Aguardando Firebase...');
    await waitForFirebase();
    
    console.log('🔐 Verificando usuário...');
    const currentUser = window.auth.currentUser;
    if (!currentUser) {
      console.error('❌ Usuário não autenticado');
      appendMessage(`<strong>Assistente:</strong> Você precisa estar logado para usar o chat.`, 'bot');
      hideTypingIndicator();
      if (mainSendBtn && chatStarted) {
        mainSendBtn.disabled = false;
        mainSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
      }
      return;
    }

    console.log('✅ Usuário autenticado:', currentUser.uid);
    console.log('🎫 Obtendo token...');
    const idToken = await currentUser.getIdToken();
    console.log('✅ Token obtido');

    // 🖼️ Preparar payload: multipart para imagens, JSON para texto
    const hasImages = images && images.length > 0;
    let requestBody;
    let requestHeaders;

    if (hasImages) {
      // ✅ CORREÇÃO #1: Usar FormData (multipart) quando há imagens
      console.log('📸 Preparando multipart com', images.length, 'imagem(ns)');
      
      const formData = new FormData();
      formData.append('message', message);
      formData.append('conversationHistory', JSON.stringify(conversationHistory));
      formData.append('idToken', idToken);
      
      // Converter imagens base64 para blobs
      images.forEach((img, index) => {
        try {
          const binaryString = atob(img.base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: img.type });
          formData.append('images', blob, img.filename || `image-${index + 1}.jpg`);
          console.log(`� Imagem ${index + 1} adicionada:`, img.filename, blob.size, 'bytes');
        } catch (error) {
          console.error(`❌ Erro ao processar imagem ${index + 1}:`, error);
          throw new Error(`Erro ao processar imagem: ${img.filename}`);
        }
      });
      
      requestBody = formData;
      // ✅ CORREÇÃO #2: Headers consistentes para multipart
      requestHeaders = { 
        'Authorization': `Bearer ${idToken}`
        // Não definir Content-Type para FormData (browser define automaticamente)
      };
    } else {
      // JSON para mensagens só texto
      console.log('📝 Preparando JSON para mensagem texto');
      
      requestBody = JSON.stringify({ 
        message, 
        conversationHistory, 
        idToken 
      });
      // ✅ CORREÇÃO #2: Headers consistentes para JSON
      requestHeaders = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      };
    }

    console.log('📤 Enviando para API:', API_CONFIG.chatEndpoint, hasImages ? '(multipart)' : '(json)');
    const response = await fetch(API_CONFIG.chatEndpoint, {
      method: 'POST',
      headers: requestHeaders,
      body: requestBody
    });

    console.log('📥 Resposta recebida:', response.status, response.statusText);

    let data;
    if (response.ok) {
      const rawText = await response.text();
      console.log('📄 Resposta raw:', rawText.substring(0, 200) + '...');
      try {
        data = JSON.parse(rawText);
        console.log('✅ JSON parseado:', data);
      } catch (parseError) {
        console.error('❌ Erro ao parsear JSON:', parseError);
        data = { error: 'RESPONSE_PARSE_ERROR', message: 'Erro ao processar resposta do servidor' };
      }
    } else {
      const errorText = await response.text();
      console.error('❌ Erro na resposta:', response.status, errorText);
      
      // ✅ CORREÇÃO #3: Error handling específico (não mascarado)
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: 'UNKNOWN_ERROR', message: errorText || 'Erro desconhecido' };
      }
      
      // Categorizar erros específicos
      if (response.status === 403) {
        data = { error: 'DAILY_LIMIT_EXCEEDED', message: 'limite diário' };
      } else if (response.status === 401) {
        data = { error: 'AUTH_TOKEN_INVALID', message: 'Token de autenticação inválido' };
      } else if (response.status === 404) {
        data = { error: 'API_NOT_FOUND', message: 'API não encontrada. Verifique a configuração.' };
      } else if (response.status === 413) {
        data = { error: 'PAYLOAD_TOO_LARGE', message: 'Imagens muito grandes. Reduza o tamanho.' };
      } else if (response.status === 422) {
        data = { error: 'VALIDATION_ERROR', message: errorData.message || 'Dados inválidos' };
      } else if (response.status === 429) {
        data = { error: 'RATE_LIMITED', message: 'Muitas tentativas. Aguarde um momento.' };
      } else if (response.status === 500) {
        data = { error: 'SERVER_ERROR', message: errorData.message || 'Erro interno do servidor' };
      } else if (response.status === 502) {
        data = { error: 'BAD_GATEWAY', message: 'Erro de conexão com o servidor' };
      } else if (response.status === 503) {
        data = { error: 'SERVICE_UNAVAILABLE', message: 'Serviço temporariamente indisponível' };
      } else if (response.status === 504) {
        data = { error: 'GATEWAY_TIMEOUT', message: 'Tempo limite de processamento excedido' };
      } else {
        data = { 
          error: errorData.error || 'UNKNOWN_ERROR', 
          message: errorData.message || 'Erro do servidor',
          status: response.status
        };
      }
    }

    hideTypingIndicator();

    // ✅ CORREÇÃO #5: Tratamento específico de erros com códigos categorizados
    if (data.error) {
      let userMessage = '';
      
      if (data.error === 'AUTH_TOKEN_MISSING' || data.error === 'AUTH_ERROR' || data.error.includes('Token')) {
        userMessage = '🔒 Sessão expirada. <a href="index.html">Faça login novamente</a>.';
      } else if (data.error === 'FILE_UPLOAD_ERROR' || data.error === 'REQUEST_FORMAT_ERROR') {
        userMessage = '📁 Erro no upload de imagens. Verifique se os arquivos são válidos e tente novamente.';
      } else if (data.error === 'IMAGES_LIMIT_EXCEEDED') {
        userMessage = '📸 Máximo de 3 imagens por vez. Remova algumas imagens e tente novamente.';
      } else if (data.error === 'PAYLOAD_TOO_LARGE') {
        userMessage = '📦 Imagens muito grandes. Comprima as imagens ou use formatos mais leves.';
      } else if (data.error === 'VALIDATION_ERROR' || data.error === 'MESSAGE_INVALID') {
        userMessage = `📝 ${data.message || 'Dados enviados são inválidos'}`;
      } else if (data.error === 'RATE_LIMITED') {
        userMessage = '⏰ Muitas tentativas simultâneas. Aguarde um momento e tente novamente.';
      } else if (data.error === 'GATEWAY_TIMEOUT' || data.error === 'AI_SERVICE_ERROR') {
        userMessage = '⏱️ Processamento demorou muito. Tente uma mensagem mais simples ou aguarde alguns minutos.';
      } else if (data.error === 'SERVICE_UNAVAILABLE' || data.error === 'SERVER_ERROR') {
        userMessage = '🔧 Serviço temporariamente indisponível. Nossa equipe foi notificada. Tente novamente em alguns minutos.';
      } else if (data.error === 'DAILY_LIMIT_EXCEEDED' || data.error.toLowerCase().includes('limite diário')) {
        userMessage = '🚫 Você atingiu o limite de <strong>10 mensagens diárias</strong>.<br><br>' +
                     '🔓 <a href="planos.html" class="btn-plus" target="_blank">Assinar versão Plus</a>';
      } else if (data.error.includes('API não encontrada')) {
        userMessage = '⚙️ Sistema em configuração. Tente novamente em alguns minutos.';
      } else {
        userMessage = `❌ ${data.message || 'Erro inesperado. Nossa equipe foi notificada.'}`;
      }
      
      appendMessage(`<strong>Assistente:</strong> ${userMessage}`, 'bot');
      
      // ✅ Mostrar botão de retry para erros temporários
      if (data.error === 'GATEWAY_TIMEOUT' || data.error === 'SERVICE_UNAVAILABLE' || data.error === 'SERVER_ERROR' || data.error === 'AI_SERVICE_ERROR') {
        setTimeout(() => {
          const retryBtn = document.createElement('button');
          retryBtn.textContent = '🔄 Tentar Novamente';
          retryBtn.style.cssText = `
            background: rgba(0, 150, 255, 0.2);
            border: 1px solid rgba(0, 150, 255, 0.5);
            color: #0096ff;
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 14px;
            margin: 8px 0;
            transition: all 0.2s ease;
          `;
          
          retryBtn.onmouseover = () => retryBtn.style.background = 'rgba(0, 150, 255, 0.3)';
          retryBtn.onmouseout = () => retryBtn.style.background = 'rgba(0, 150, 255, 0.2)';
          
          retryBtn.onclick = () => {
            retryBtn.remove();
            processMessage(message, images); // Retry automático
          };
          
          const lastMessage = document.querySelector('.chatbot-conversation-area .chatbot-message:last-child');
          if (lastMessage) {
            lastMessage.appendChild(retryBtn);
          }
        }, 1500);
      }
      
    } else if (data.reply) {
      console.log('✅ Resposta recebida da IA, iniciando validação de conteúdo');

      // 🔎 Validação: se a mensagem do usuário aparenta ser uma análise de áudio, validar presença de números-chave
      const isAudioAnalysis = /\[ANÁLISE DE ÁUDIO\]/i.test(message) || /ANÁLISE TÉCNICA DE ÁUDIO/i.test(message) || /📊 DADOS TÉCNICOS:/i.test(message);

      let finalReply = data.reply;

      if (isAudioAnalysis) {
        try {
          const values = extrairValoresAnaliseDoPrompt(message);
          const ok = validarPresencaValoresNaResposta(values, finalReply);
          if (!ok && !data._validatedResend) {
            console.warn('⚠️ Resposta não contém todos os valores técnicos. Reenviando com reforço...');
            showTypingIndicator();

            const reforco = `\n\n⚠️ REGRA OBRIGATÓRIA: Inclua explicitamente no texto todos estes valores do meu JSON: Peak ${values.peak}dB, RMS ${values.rms}dB, Dinâmica ${values.dinamica}dB e as frequências dominantes ${values.freqs.join(', ')} Hz. Explique cada ajuste com base nesses números.`;

            const response2 = await fetch(API_CONFIG.chatEndpoint, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({ 
                message: message + reforco,
                conversationHistory, 
                idToken,
                _validatedResend: true
              })
            });
            hideTypingIndicator();
            if (response2.ok) {
              const rawText2 = await response2.text();
              try {
                const data2 = JSON.parse(rawText2);
                if (data2.reply) {
                  finalReply = data2.reply;
                }
              } catch {}
            }
          }
        } catch (e) {
          console.log('Validação da análise: não foi possível extrair valores', e?.message);
        }
      }

      console.log('✅ Exibindo resposta final da IA');
      appendMessage(`<strong>Assistente:</strong> ${finalReply}`, 'bot');
      conversationHistory.push({ role: 'assistant', content: finalReply });
      
      // Mostrar mensagens restantes se for usuário gratuito
      if (data.mensagensRestantes !== null && data.mensagensRestantes !== undefined) {
        showRemainingMessages(data.mensagensRestantes);
      }
    } else {
      console.error('❌ Resposta inesperada:', data);
      appendMessage(
        `<strong>Assistente:</strong> ❌ Erro: ${data.error || 'Erro inesperado'}.`,
        'bot'
      );
    }
  } catch (err) {
    console.error('❌ Erro crítico:', err);
    hideTypingIndicator();
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      appendMessage(
        `<strong>Assistente:</strong> 🌐 Erro de conexão. Verifique sua internet e tente novamente.`,
        'bot'
      );
    } else {
      appendMessage(
        `<strong>Assistente:</strong> ❌ Erro ao se conectar com o servidor.`,
        'bot'
      );
    }
  } finally {
    if (mainSendBtn && chatStarted) {
      mainSendBtn.disabled = false;
      mainSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }
  }
}

// ========== Validação da resposta com base no prompt de análise ==========
function extrairValoresAnaliseDoPrompt(userPrompt) {
  // Procura por linhas tipo: • Peak: -1.2dB, • RMS: -12.3dB, • Dinâmica: 8.5dB
  const peakMatch = userPrompt.match(/Peak:\s*([-+]?\d+(?:[\.,]\d+)?)\s*dB/i);
  const rmsMatch = userPrompt.match(/RMS:\s*([-+]?\d+(?:[\.,]\d+)?)\s*dB/i);
  const dynMatch = userPrompt.match(/Dinâmica:\s*([-+]?\d+(?:[\.,]\d+)?)\s*dB/i);
  // Frequências: linhas "• 120Hz (3x detectada)"
  const freqRegex = /\n\s*•\s*(\d{2,5})\s*Hz/gi;
  const freqs = [];
  let m;
  while ((m = freqRegex.exec(userPrompt)) !== null) {
    const f = parseInt(m[1], 10);
    if (!isNaN(f)) freqs.push(f);
    if (freqs.length >= 5) break;
  }
  return {
    peak: peakMatch ? normalizarNumero(peakMatch[1]) : null,
    rms: rmsMatch ? normalizarNumero(rmsMatch[1]) : null,
    dinamica: dynMatch ? normalizarNumero(dynMatch[1]) : null,
    freqs
  };
}

function normalizarNumero(str) {
  return parseFloat(String(str).replace(',', '.'));
}

function validarPresencaValoresNaResposta(values, replyText) {
  if (!values) return true;
  const txt = (replyText || '').toLowerCase();

  const checks = [];
  if (typeof values.peak === 'number') {
    checks.push(incluiNumeroComSufixo(txt, values.peak, 'db'));
  }
  if (typeof values.rms === 'number') {
    checks.push(incluiNumeroComSufixo(txt, values.rms, 'db'));
  }
  if (typeof values.dinamica === 'number') {
    checks.push(incluiNumeroComSufixo(txt, values.dinamica, 'db'));
  }
  // Checar pelo menos 1-2 frequências
  let freqOk = true;
  if (values.freqs && values.freqs.length) {
    const sampleFreqs = values.freqs.slice(0, Math.min(2, values.freqs.length));
    freqOk = sampleFreqs.every(f => incluiNumeroComSufixo(txt, f, 'hz'));
  }
  return checks.every(Boolean) && freqOk;
}

function incluiNumeroComSufixo(texto, numero, sufixo) {
  if (typeof numero !== 'number' || !isFinite(numero)) return true;
  // Tolerância de variação: aceitar arredondamentos 0.0 e 0.1
  const candidatos = new Set();
  const base = Math.round(numero * 10) / 10;
  const variantes = [base, Math.round(numero), Math.floor(numero), Math.ceil(numero)];
  variantes.forEach(v => {
    candidatos.add(`${String(v).replace('.', ',')}${sufixo}`.toLowerCase());
    candidatos.add(`${v}${sufixo}`.toLowerCase());
    candidatos.add(`${String(v).replace('.', ',')} ${sufixo}`.toLowerCase());
    candidatos.add(`${v} ${sufixo}`.toLowerCase());
  });
  // Também aceitar com sinal +/-
  const withSign = Array.from(candidatos).flatMap(c => [c, c.replace(/^/, '+'), c.replace(/^/, '-')]);
  return withSign.some(pattern => texto.includes(pattern));
}

/* ============ INICIALIZAÇÃO DO SISTEMA ============ */

/* ============ INICIALIZAÇÃO CONSOLIDADA ============ */
function initializeEverything() {
    // Ativar fade-in suave apenas nos elementos principais (sem fundo)
    setTimeout(() => {
        const fadeElements = document.querySelectorAll('.fade-in-start');
        
        // Aplicar animação fadeInPush sincronizada a todos os elementos
        fadeElements.forEach((element, index) => {
            // Remover delay individual para sincronia perfeita
            element.style.animationDelay = '0ms';
            element.style.animation = 'fadeInPush 0.6s ease-out forwards';
        });
        
    }, 200);
    
    // Injetar estilos CSS para respostas estilosas
    injetarEstilosRespostaEstilosa();
    
    // Verificar se estamos na página principal antes de inicializar tudo
    const isMainPage = document.querySelector('.hero') || document.querySelector('#startSendBtn') || window.location.pathname.includes('index.html');
    
    if (isMainPage) {
        console.log('🎯 Inicializando sistema da página principal...');
        
        // Inicializar efeitos visuais (agora as funções já estão declaradas)
        initVantaBackground();
        if (window.initParticleEffects && typeof window.initParticleEffects === 'function') {
            window.initParticleEffects();
        } else {
            console.log('⚠️ initParticleEffects não disponível');
        }
        
        // Aguardar Firebase e inicializar chatbot
        waitForFirebase().then(() => {
            console.log('✅ Firebase pronto, inicializando chatbot...');
            window.prodAIChatbot = new ProdAIChatbot();
        });
    } else {
        console.log('📄 Página secundária detectada - pulando inicialização completa do script.js');
    }
}

function debugVercel() {
  console.log('=== DEBUG VERCEL ===');
  console.log('🌐 Location:', window.location.href);
  console.log('🔗 API Endpoint:', API_CONFIG.chatEndpoint);
  console.log('🔥 Auth loaded:', !!window.auth);
  console.log('🔥 Firebase ready:', window.firebaseReady);
  console.log('👤 Current user:', window.auth?.currentUser?.uid || 'None');
  console.log('📝 Start input:', !!document.getElementById('start-input'));
  console.log('🚀 Start button:', !!document.getElementById('startSendBtn'));
  console.log('💬 User input:', !!document.getElementById('user-input'));
  console.log('📤 Send button:', !!document.getElementById('sendBtn'));
  console.log('📺 Chatbox:', !!document.getElementById('chatbox'));
  console.log('=================');
}
async function startAudioAnalysis(file, mode = 'genre') {
  try {
    // Subir arquivo via /api/analyze (já integrado ao backend)
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);

    const response = await fetch(`${API_CONFIG.baseURL}/audio/analyze`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error("Falha ao iniciar análise");

    const { jobId } = await response.json();
    console.log("🚀 Job criado:", jobId);

    // Começar a acompanhar
    pollJobStatus(jobId);
  } catch (err) {
    console.error("❌ Erro ao iniciar análise:", err);
    appendMessage(`<strong>Assistente:</strong> ❌ Erro ao iniciar análise: ${err.message}`, "bot");
  }
}

async function pollJobStatus(jobId) {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`${API_CONFIG.baseURL}/jobs/${jobId}`);
      if (!res.ok) throw new Error("Job não encontrado");

      const job = await res.json();
      console.log("📊 Status job:", job);

      if (job.status === "completed") {
        clearInterval(interval);
        showJobResult(job.result);
      }
    } catch (err) {
      clearInterval(interval);
      console.error("❌ Erro no polling:", err);
      appendMessage(`<strong>Assistente:</strong> ❌ Erro ao buscar resultado da análise.`, "bot");
    }
  }, 2000); // checar a cada 2s
}

function showJobResult(result) {
  if (!result) {
    appendMessage(`<strong>Assistente:</strong> ❌ Nenhum resultado retornado.`, "bot");
    return;
  }

  // 👉 Passar texto puro, formatado em Markdown/estiloso
  const msg = `
[ANÁLISE DE ÁUDIO]  
🎵 Resultado da análise:  
${result.message || "Análise concluída!"}
  `;

  appendMessage(`<strong>Assistente:</strong> ${msg}`, "bot");
}
// Patch: impedir erro de NodeAnalysisUI
window.NodeAnalysisUI = {
  render: function(result) {
    console.log("🎨 NodeAnalysisUI render chamado com:", result);
    showJobResult(result); // usa tua função que já mostra no chat
  }
};


/* ============ INICIALIZAÇÃO DO VISUAL NOVO ============ */
function initVisualEffects() {
    console.log('🚀 Inicializando cenário futurista...');
    
    optimizeForMobile();
    initVantaBackground();
    initEntranceAnimations();
    initParallaxEffect();
    initHoverEffects();
    
    console.log('✅ Cenário futurista carregado!');
}

/* ============ INICIALIZAÇÃO PRINCIPAL ============ */
function initializeApp() {
  console.log('🚀 Inicializando aplicação...');
  
  // Inicializar visual novo
  initVisualEffects();
  
  // Inicializar efeitos visuais
  optimizeForMobile();
  initVantaBackground();
  
  // Inicializar sistema antigo com delay para garantir que tudo carregou
  setTimeout(() => {
    setupEventListeners();

    const isLoginPage = window.location.pathname.includes("login.html");
    if (isLoginPage) return;

    const startInputEl = document.getElementById('start-input');
    if (startInputEl) startInputEl.focus();
  }, 100);
  
  if (typeof gsap !== 'undefined') {
    const tl = gsap.timeline();
    
    // Animar fundo
    tl.to('.fundo', {
        opacity: 0.3,
        duration: 0.6,
        ease: "power2.out"
    })
    
    // Animar todos os elementos com stagger mínimo
    .fromTo(['.mesa', '.caixas', '.notebook', '.teclado', '.robo'], {
        y: 100,
        opacity: 0
    }, {
        y: 0,
        opacity: 1,
        duration: 1.2,
        ease: "power2.out",
        stagger: 0.1
    }, "-=0.4");
  }
}

/* ============ LIMPEZA ============ */
window.addEventListener('beforeunload', () => {
    if (vantaEffect) {
        vantaEffect.destroy();
    }
});

/* ============ EFEITO PARALLAX ============ */
function initParallaxEffect() {
    if (!isDesktop) return;
    
    let parallaxTimeout;
    document.addEventListener('mousemove', (e) => {
        // CRÍTICO: Throttle para evitar travamento
        if (parallaxTimeout) return;
        parallaxTimeout = setTimeout(() => parallaxTimeout = null, 16); // ~60fps
        
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        
        if (typeof gsap !== 'undefined') {
            // Movimento do robô
            const robo = document.querySelector('.robo');
            if (robo) {
                gsap.to(robo, {
                    duration: 0.3,
                    rotationY: x * 3,
                    rotationX: -y * 2,
                    x: x * 15,
                    y: y * 10,
                    ease: "power2.out"
                });
            }
            
            // Controle do Vanta
            if (vantaEffect) {
                vantaEffect.setOptions({
                    mouseControls: true,
                    gyroControls: false
                });
            }
            
            // Movimento dos outros elementos
            gsap.to('.notebook', {
                duration: 0.4,
                x: x * 8,
                y: -y * 5,
                rotationY: x * 2,
                ease: "power2.out"
            });
            
            gsap.to('.caixas', {
                duration: 0.45,
                x: x * 5,
                y: -y * 3,
                ease: "power2.out"
            });
            
            gsap.to('.teclado', {
                duration: 0.35,
                x: x * 6,
                y: -y * 4,
                ease: "power2.out"
            });
        }
    });
}

/* ============ INICIALIZAÇÃO NO DOM READY ============ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeEverything);
} else {
  initializeEverything();
}

// Listener único de redimensionamento (otimizado com throttle)
window.addEventListener('resize', handleResize);

// Expor funções globais (manter compatibilidade)
window.sendFirstMessage = () => {
  if (window.prodAIChatbot) {
    window.prodAIChatbot.handleFirstMessage();
  }
};
window.sendMessage = () => {
  if (window.prodAIChatbot && window.prodAIChatbot.isActive) {
    window.prodAIChatbot.sendMessage();
  }
};
// window.testAPIConnection já foi declarado acima

// Debug após carregamento - Garantir que a função existe antes de chamar
setTimeout(() => {
  debugVercel();
  // Verificação mais robusta da função
  if (window.testAPIConnection && typeof window.testAPIConnection === 'function') {
    window.testAPIConnection();
  } else {
    console.log('📄 testAPIConnection não disponível nesta página');
  }
}, 1000);

/* ============ ANIMAÇÕES DE ENTRADA (Visual Novo) ============ */
function initEntranceAnimations() {
    try {
        if (typeof gsap !== 'undefined') {
            const tl = gsap.timeline();
            
            // Animar fundo
            tl.to('.fundo', {
                opacity: 0.3,
                duration: 0.6,
                ease: "power2.out"
            })
            
            // Animar todos os elementos com stagger mínimo
            .fromTo(['.mesa', '.caixas', '.notebook', '.teclado', '.robo'], {
                y: 100,
                opacity: 0,
                scale: 0.8
            }, {
                y: 0,
                opacity: 1,
                scale: 1,
                duration: 0.6,
                ease: "back.out(1.7)",
                stagger: 0.05
            }, "-=0.4");
            
            console.log('✅ GSAP animações carregadas');
        } else {
            document.body.classList.add('fallback-animation');
            console.warn('⚠️ GSAP não encontrado, usando animações CSS de fallback');
        }

// REMOVIDO: Listener duplicado de resize - agora está no handleResize otimizado
    } catch (error) {
        console.warn('⚠️ Erro no GSAP:', error);
        document.body.classList.add('fallback-animation');
    }
}