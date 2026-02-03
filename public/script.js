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

/* ============ CONFIGURAÇÃO DA API ============ */
const API_CONFIG = {
  baseURL: (() => {
    const host = window.location.hostname || '';
    
    // 🧪 AMBIENTE DE TESTE: Railway TEST
    if (host === 'soundyai-app-soundyai-teste.up.railway.app') {
      console.log('🧪 [API_CONFIG] ═══════════════════════════════════════');
      console.log('🧪 [API_CONFIG] AMBIENTE DE TESTE DETECTADO');
      console.log('🧪 [API_CONFIG] Host:', host);
      console.log('🧪 [API_CONFIG] API URL: /api (relativo)');
      console.log('🧪 [API_CONFIG] Backend: soundyai-app-soundyai-teste.up.railway.app');
      console.log('🧪 [API_CONFIG] ═══════════════════════════════════════');
      return '/api';
    }
    
    // 🧪 FRONTEND DE TESTE (Vercel) -> Chamar API de TESTE
    if (host === 'soundyai-teste.vercel.app') {
      console.log('🧪 [API_CONFIG] ═══════════════════════════════════════');
      console.log('🧪 [API_CONFIG] FRONTEND TESTE (Vercel)');
      console.log('🧪 [API_CONFIG] Host:', host);
      console.log('🧪 [API_CONFIG] API URL: https://soundyai-app-soundyai-teste.up.railway.app/api');
      console.log('🧪 [API_CONFIG] Backend: TESTE Railway');
      console.log('🧪 [API_CONFIG] ═══════════════════════════════════════');
      return 'https://soundyai-app-soundyai-teste.up.railway.app/api';
    }
    
    // 🚀 PRODUÇÃO: soundyai.com.br (Railway) -> usar /api relativo
    if (host === 'soundyai.com.br' || host === 'www.soundyai.com.br') {
      console.log('🚀 [API_CONFIG] ═══════════════════════════════════════');
      console.log('🚀 [API_CONFIG] AMBIENTE DE PRODUÇÃO');
      console.log('🚀 [API_CONFIG] Host:', host);
      console.log('🚀 [API_CONFIG] API URL: /api (relativo)');
      console.log('🚀 [API_CONFIG] Backend: soundyai-app-production.up.railway.app');
      console.log('🚀 [API_CONFIG] ═══════════════════════════════════════');
      return '/api';
    }
    
    // 🚀 Railway PRODUÇÃO direto
    if (host === 'soundyai-app-production.up.railway.app') {
      console.log('🚀 [API_CONFIG] ═══════════════════════════════════════');
      console.log('🚀 [API_CONFIG] RAILWAY PRODUÇÃO DIRETO');
      console.log('🚀 [API_CONFIG] Host:', host);
      console.log('🚀 [API_CONFIG] API URL: /api (relativo)');
      console.log('🚀 [API_CONFIG] Backend: soundyai-app-production.up.railway.app');
      console.log('🚀 [API_CONFIG] ═══════════════════════════════════════');
      return '/api';
    }
    
    // 🔧 Ambiente local -> chamar Railway PRODUÇÃO
    if (host === 'localhost' || host.startsWith('127.0.0.1')) {
      console.log('🔧 [API_CONFIG] ═══════════════════════════════════════');
      console.log('🔧 [API_CONFIG] AMBIENTE LOCAL');
      console.log('🔧 [API_CONFIG] Host:', host);
      console.log('🔧 [API_CONFIG] API URL: https://soundyai-app-production.up.railway.app/api');
      console.log('🔧 [API_CONFIG] Backend: Railway PRODUÇÃO');
      console.log('🔧 [API_CONFIG] ═══════════════════════════════════════');
      return 'https://soundyai-app-production.up.railway.app/api';
    }
    
    // ⚠️ Fallback: Railway PRODUÇÃO
    console.warn('⚠️ [API_CONFIG] ═══════════════════════════════════════');
    console.warn('⚠️ [API_CONFIG] AMBIENTE DESCONHECIDO - USANDO PRODUÇÃO');
    console.warn('⚠️ [API_CONFIG] Host:', host);
    console.warn('⚠️ [API_CONFIG] API URL: https://soundyai-app-production.up.railway.app/api');
    console.warn('⚠️ [API_CONFIG] ═══════════════════════════════════════');
    return 'https://soundyai-app-production.up.railway.app/api';
  })(),

  get chatEndpoint() {
    return `${this.baseURL}/chat`;
  },
  
  // 🔓 Endpoint de chat anônimo (sem Firebase Auth)
  get chatAnonymousEndpoint() {
    return `${this.baseURL}/chat/anonymous`;
  },
  
  // 🔓 Endpoint de análise anônima (sem Firebase Auth)
  get analyzeAnonymousEndpoint() {
    return `${this.baseURL}/audio/analyze-anonymous`;
  }
};

// ═══════════════════════════════════════════════════════════════════
// 🔐 GATE CENTRAL DE AUTENTICAÇÃO - SINGLE SOURCE OF TRUTH
// ═══════════════════════════════════════════════════════════════════
window.AuthGate = {
  /**
   * Verifica se o usuário está realmente autenticado
   * @returns {boolean}
   */
  isAuthenticated() {
    // 1. Verificar Firebase currentUser (FONTE DE VERDADE PRIMÁRIA)
    const hasFirebaseUser = !!(window.auth?.currentUser);
    
    // 2. Verificar tokens no localStorage
    const hasIdToken = !!(localStorage.getItem('idToken'));
    const hasAuthToken = !!(localStorage.getItem('authToken'));
    
    // ✅ REGRA ABSOLUTA: Se tem Firebase currentUser, está autenticado
    // NÃO importa se SoundyAnonymous está ativo - Firebase Auth é a verdade
    if (hasFirebaseUser) {
      log('✅ [AuthGate] Firebase currentUser existe - usuário AUTENTICADO');
      
      // Se modo anônimo estava ativo mas temos usuário, DESATIVAR anônimo
      if (window.SoundyAnonymous?.isAnonymousMode) {
        log('🔄 [AuthGate] Desativando modo anônimo (usuário autenticado)');
        if (typeof window.SoundyAnonymous.deactivate === 'function') {
          window.SoundyAnonymous.deactivate();
        } else {
          window.SoundyAnonymous.isAnonymousMode = false;
        }
      }
      
      return true;
    }
    
    // 3. Se não tem Firebase user, verificar se tem tokens salvos
    const hasTokens = hasIdToken || hasAuthToken;
    
    // 4. Verificar se modo anônimo está FORÇADO (apenas se não tem tokens)
    const isAnonymousForced = window.SoundyAnonymous?.isAnonymousMode === true;
    const forceClean = window.SoundyAnonymous?.forceCleanState === true;
    
    // Se modo anônimo foi forçado E não tem tokens, não está autenticado
    if ((isAnonymousForced || forceClean) && !hasTokens) {
      log('🔒 [AuthGate] Modo anônimo forçado e sem tokens - não autenticado');
      return false;
    }
    
    // Se tem tokens mas não tem Firebase user, pode ser race condition
    if (hasTokens && !hasFirebaseUser) {
      log('⏳ [AuthGate] Tokens existem mas Firebase user não - aguardando sincronização');
      return true; // Considerar autenticado temporariamente
    }
    
    log('🔐 [AuthGate] isAuthenticated: false (sem Firebase user nem tokens)');
    return false;
  },
  
  /**
   * Obtém o endpoint correto baseado no estado de auth
   * @param {string} type - 'chat' ou 'analyze'
   * @returns {string} - URL do endpoint
   */
  getEndpoint(type) {
    const isAuth = this.isAuthenticated();
    
    if (type === 'chat') {
      const endpoint = isAuth ? API_CONFIG.chatEndpoint : API_CONFIG.chatAnonymousEndpoint;
      log(`📍 [AuthGate] Chat endpoint: ${endpoint}`);
      return endpoint;
    }
    
    if (type === 'analyze') {
      const endpoint = isAuth ? `${API_CONFIG.baseURL}/audio/analyze` : API_CONFIG.analyzeAnonymousEndpoint;
      log(`📍 [AuthGate] Analyze endpoint: ${endpoint}`);
      return endpoint;
    }
    
    error('❌ [AuthGate] Tipo de endpoint desconhecido:', type);
    return null;
  },
  
  /**
   * Obtém headers corretos para a requisição
   * @returns {Object} - Headers para fetch
   */
  async getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };
    
    if (!this.isAuthenticated()) {
      log('🔓 [AuthGate] Headers anônimos (sem Authorization)');
      return headers;
    }
    
    // Obter token do Firebase
    try {
      let idToken = null;
      
      if (window.auth?.currentUser) {
        idToken = await window.auth.currentUser.getIdToken();
      }
      
      if (!idToken) {
        idToken = localStorage.getItem('idToken') || localStorage.getItem('authToken');
      }
      
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
        log('🔐 [AuthGate] Headers autenticados (com Authorization)');
      }
    } catch (err) {
      warn('⚠️ [AuthGate] Erro ao obter token:', err.message);
    }
    
    return headers;
  },
  
  /**
   * Bloqueia chamadas autenticadas quando em modo anônimo
   * @param {string} url - URL sendo chamada
   * @returns {boolean} - true se deve bloquear
   */
  shouldBlockAuthenticatedCall(url) {
    const isAnonymous = !this.isAuthenticated();
    const isAuthenticatedEndpoint = (
      url.includes('/api/chat') && !url.includes('/anonymous') ||
      url.includes('/api/audio/analyze') && !url.includes('anonymous')
    );
    
    if (isAnonymous && isAuthenticatedEndpoint) {
      error('🚫 [AuthGate] BLOQUEANDO chamada autenticada em modo anônimo:', url);
      return true;
    }
    
    return false;
  }
};

// Expor globalmente
window.API_CONFIG = API_CONFIG;

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

/* ============ 🚀 PERFORMANCE: Detecção de dispositivo e preferências ============ */
const performanceConfig = {
    isLowPerformance: navigator.hardwareConcurrency <= 4 || (navigator.deviceMemory && navigator.deviceMemory <= 4),
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    isVisible: true
};

/* ============ INICIALIZAÇÃO DO VANTA BACKGROUND (Visual Novo) ============ */
/* 🚀 PERFORMANCE: Agora delegado ao EffectsController para gerenciamento centralizado */
function initVantaBackground() {
    // Se EffectsController existe, ele cuida do Vanta
    if (window.EffectsController) {
        log('🎨 Vanta.js gerenciado pelo EffectsController');
        return;
    }
    
    try {
        // Fallback: código original caso EffectsController não tenha carregado
        if (performanceConfig.prefersReducedMotion) {
            log('🎨 Vanta.js desabilitado (prefers-reduced-motion)');
            return;
        }
        
        const vantaElement = document.getElementById("vanta-bg");
        if (!vantaElement) return;
        
        if (typeof VANTA !== 'undefined' && typeof THREE !== 'undefined') {
            const isLowPerformance = performanceConfig.isLowPerformance;
            
            vantaEffect = VANTA.NET({
                el: "#vanta-bg",
                mouseControls: !isLowPerformance,
                touchControls: !isLowPerformance,
                gyroControls: false,
                minHeight: 200.00,
                minWidth: 200.00,
                scale: 1.00,
                scaleMobile: 0.80,
                color: 0x8a2be2,
                backgroundColor: 0x0a0a1a,
                points: isLowPerformance ? 2.50 : (isDesktop ? 5.00 : 3.00),
                maxDistance: isLowPerformance ? 10.00 : (isDesktop ? 18.00 : 12.00),
                spacing: isLowPerformance ? 35.00 : (isDesktop ? 22.00 : 28.00),
                showDots: true
            });
            log('✨ Vanta.js inicializado (fallback mode)');
        }
    } catch (error) {
        warn('⚠️ Vanta.js não carregou:', error.message);
    }
}

/* ============ 🚀 PERFORMANCE: Visibility change delegado ao EffectsController ============ */
/* O listener de visibilitychange agora está no effects-controller.js para gerenciamento centralizado */

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
        warn('🐌 Dispositivo com performance baixa detectado - animações otimizadas');
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
/* 🚀 PERFORMANCE V2: Resize de Vanta agora é gerenciado pelo EffectsController */
let resizeTimeout;
function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const newIsDesktop = window.innerWidth > 768;
        
        if (newIsDesktop !== isDesktop) {
            isDesktop = newIsDesktop;
            optimizeForMobile();
            // Vanta resize é gerenciado pelo EffectsController
        }
        
        const indicator = document.getElementById('messages-remaining-indicator');
        if (indicator) {
            indicator.style.display = window.innerWidth <= 767 ? 'none' : 'block';
        }
    }, 150);
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
        log('🔍 Verificando Firebase:', { auth: !!window.auth, firebaseReady: !!window.firebaseReady });
      }
      if (window.auth && window.firebaseReady) {
        log('✅ Firebase pronto!');
        resolve();
        return; // PARAR O LOOP
      } else if (attempts >= maxAttempts) {
        warn('⚠️ Timeout no Firebase, continuando...');
        resolve();
        return; // PARAR O LOOP
      } else {
        attempts++;
        if (attempts === 1) {
          log('⏳ Firebase ainda não está pronto, aguardando...');
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
        this.showChatbotImmediately();
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
                // ✅ PERFORMANCE: Lazy-load audio-analyzer antes de abrir modal
                if (typeof window.loadAudioAnalyzer === 'function') {
                    log('🚀 [PERFORMANCE] Carregando Audio Analyzer sob demanda...');
                    window.loadAudioAnalyzer()
                        .then(() => {
                            log('✅ [PERFORMANCE] Audio Analyzer carregado, abrindo modal...');
                            if (typeof window.openAudioModal === 'function') {
                                window.openAudioModal();
                            } else {
                                error('openAudioModal não está disponível após lazy-load');
                            }
                        })
                        .catch(err => {
                            error('❌ [PERFORMANCE] Falha ao carregar Audio Analyzer:', err);
                            alert('Erro ao carregar sistema de análise. Por favor, recarregue a página.');
                        });
                } else {
                    // Fallback: se lazy-loader não estiver disponível, tentar chamar diretamente
                    warn('⚠️ loadAudioAnalyzer não encontrado, tentando chamar openAudioModal diretamente');
                    if (typeof window.openAudioModal === 'function') {
                        window.openAudioModal();
                    } else {
                        error('openAudioModal não está disponível');
                    }
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
                    // 🔗 Preservar dados importantes antes de limpar
                    var adminBypass = localStorage.getItem('soundy_admin_bypass');
                    var referralCode = localStorage.getItem('soundy_referral_code');
                    var referralTimestamp = localStorage.getItem('soundy_referral_timestamp');
                    
                    localStorage.clear();
                    
                    // Restaurar dados preservados
                    if (adminBypass) {
                        localStorage.setItem('soundy_admin_bypass', adminBypass);
                    }
                    if (referralCode) {
                        localStorage.setItem('soundy_referral_code', referralCode);
                        localStorage.setItem('soundy_referral_timestamp', referralTimestamp);
                        console.log('🔗 [REFERRAL] Código preservado após logout:', referralCode);
                    }
                    
                    window.location.href = "login.html";
                }
                break;
        }
    }
    
    showChatbotImmediately() {
        log('🚀 [PERFORMANCE] Inicializando chatbot otimizado - exibição imediata');
        
        const initChatbot = () => {
            log('✅ [PERFORMANCE] DOMContentLoaded - animando chatbot IMEDIATAMENTE');
            
            // Animar chatbot imediatamente (com ou sem GSAP)
            this.animateInitialAppearance();
        };
        
        // Executar no DOMContentLoaded (ou imediatamente se já carregou)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initChatbot);
        } else {
            initChatbot();
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
            log('📸 Primeira mensagem com imagens:', images.length);
        }
        
        // Se há imagens mas não há texto, não permitir envio
        if (images.length > 0 && !message) {
            warn('❌ Não é possível enviar apenas imagens sem texto');
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
        
        // � MODO ANÔNIMO: Verificar limite de mensagens
        // ðŸ”¥ MODO DEMO: Verificar limite de mensagens (PRIORIDADE)
        if (window.SoundyDemo && window.SoundyDemo.isActive) {
            if (!window.SoundyDemo.interceptMessage()) {
                log('ðŸš« [SCRIPT] Mensagem bloqueada - limite demo atingido');
                return;
            }
        }
        // ðŸ”“ MODO ANÃ”NIMO: Verificar limite de mensagens
        else if (window.SoundyAnonymous && window.SoundyAnonymous.isAnonymousMode) {
            if (!window.SoundyAnonymous.interceptMessage()) {
                log('🚫 [SCRIPT] Mensagem bloqueada - limite anônimo atingido');
                return;
            }
        }
        
        // 🖼️ Verificar se há imagens selecionadas
        let images = [];
        if (window.imagePreviewSystem && window.imagePreviewSystem.hasImages()) {
            images = window.imagePreviewSystem.getImagesForSending();
            log('📸 Imagens encontradas para envio:', images.length);
        }
        
        // Se há imagens mas não há texto, não permitir envio
        if (images.length > 0 && !message) {
            warn('❌ Não é possível enviar apenas imagens sem texto');
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
                
                // 🔓 MODO ANÔNIMO: Registrar mensagem SOMENTE após resposta da IA
                if (window.SoundyAnonymous && window.SoundyAnonymous.isAnonymousMode) {
                    window.SoundyAnonymous.registerMessage();
                    log('📊 [ANONYMOUS] Mensagem registrada após resposta da IA');
                }
                
                // 🔥 MODO DEMO: Registrar mensagem SOMENTE após resposta da IA
                // CRÍTICO: Registro só acontece após sucesso real da resposta
                if (window.SoundyDemo && window.SoundyDemo.isActive) {
                    window.SoundyDemo.registerMessage();
                    log('📊 [DEMO] Mensagem registrada após resposta da IA');
                }
            }).catch((err) => {
                this.hideTyping();
                error('❌ Erro na resposta da IA - mensagem NÃO registrada:', err);
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
    error('Área de conversa não encontrada');
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
    log('⚠️ Erro ao mostrar indicador de mensagens (não crítico):', error.message);
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
  log('🚀 Processando mensagem:', message);
  if (images.length > 0) {
    log('📸 Processando com imagens:', images.length);
  }
  
  const mainSendBtn = document.getElementById('sendBtn');
  if (mainSendBtn && chatStarted) {
    mainSendBtn.disabled = true;
    mainSendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  }

  showTypingIndicator();

  try {
    log('⏳ Aguardando Firebase...');
    await waitForFirebase();
    
    log('🔐 Verificando usuário...');
    const currentUser = window.auth?.currentUser;
    const isAnonymousMode = window.SoundyAnonymous?.isAnonymousMode;
    
    // 🔓 MODO ANÔNIMO: Permitir mensagens sem autenticação (dentro do limite)
    if (!currentUser && !isAnonymousMode) {
      error('❌ Usuário não autenticado e modo anônimo não ativo');
      appendMessage(`<strong>Assistente:</strong> Você precisa estar logado para usar o chat.`, 'bot');
      hideTypingIndicator();
      if (mainSendBtn && chatStarted) {
        mainSendBtn.disabled = false;
        mainSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
      }
      return;
    }

    // 🔓 MODO ANÔNIMO: Usar visitor_id como identificador
    let idToken = null;
    let userUid = 'anonymous';
    
    if (currentUser) {
      log('✅ Usuário autenticado:', currentUser.uid);
      log('🎫 Obtendo token...');
      idToken = await currentUser.getIdToken();
      userUid = currentUser.uid;
      log('✅ Token obtido');
      
      // 🔥 CORREÇÃO CRÍTICA: Garantir visitorId existe para usuários autenticados
      let visitorId = localStorage.getItem('visitorId');
      if (!visitorId) {
        warn('⚠️ [CHAT] visitorId ausente para usuário autenticado - gerando agora');
        visitorId = 'auth_' + currentUser.uid + '_' + Date.now();
        localStorage.setItem('visitorId', visitorId);
        log('✅ [CHAT] visitorId gerado e salvo:', visitorId.substring(0, 20) + '...');
      }
    } else if (isAnonymousMode) {
      log('🔓 Modo anônimo ativo - visitorId:', window.SoundyAnonymous?.visitorId?.substring(0, 12));
      userUid = 'anon_' + (window.SoundyAnonymous?.visitorId || 'unknown');
    }

    // 🖼️ Preparar payload: multipart para imagens, JSON para texto
    const hasImages = images && images.length > 0;
    const isAnonymous = !idToken; // Flag para identificar requisição anônima
    let requestBody;
    let requestHeaders;

    if (hasImages) {
      // ✅ CORREÇÃO #1: Usar FormData (multipart) quando há imagens
      log('📸 Preparando multipart com', images.length, 'imagem(ns)');
      
      const formData = new FormData();
      formData.append('message', message);
      formData.append('conversationHistory', JSON.stringify(conversationHistory));
      if (idToken) {
        formData.append('idToken', idToken);
      }
      // 🔓 MODO ANÔNIMO: Enviar visitorId para tracking
      if (isAnonymous) {
        formData.append('anonymousMode', 'true');
        formData.append('visitorId', window.SoundyAnonymous?.visitorId || 'unknown');
      }
      
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
          log(`📷 Imagem ${index + 1} adicionada:`, img.filename, blob.size, 'bytes');
        } catch (error) {
          error(`❌ Erro ao processar imagem ${index + 1}:`, error);
          throw new Error(`Erro ao processar imagem: ${img.filename}`);
        }
      });
      
      requestBody = formData;
      // ✅ CORREÇÃO #2: Headers - só incluir Authorization se tiver token
      requestHeaders = idToken ? { 'Authorization': `Bearer ${idToken}` } : {};
    } else {
      // JSON para mensagens só texto
      log('📝 Preparando JSON para mensagem texto', isAnonymous ? '(anônimo)' : '(autenticado)');
      
      const payload = { 
        message, 
        conversationHistory
      };
      
      // 🔓 MODO ANÔNIMO: Adicionar campos específicos
      if (idToken) {
        payload.idToken = idToken;
      }
      if (isAnonymous) {
        payload.visitorId = window.SoundyAnonymous?.visitorId || 'unknown';
      }
      
      requestBody = JSON.stringify(payload);
      // ✅ Headers - só incluir Authorization se tiver token
      requestHeaders = { 'Content-Type': 'application/json' };
      if (idToken) {
        requestHeaders['Authorization'] = `Bearer ${idToken}`;
      }
    }

    // 🔓 ESCOLHER ENDPOINT: Baseado no token obtido (fonte de verdade)
    let chatEndpoint;
    
    // ✅ REGRA ABSOLUTA: Se temos idToken válido, SEMPRE usar endpoint autenticado
    // NÃO depender do AuthGate para usuários já autenticados com token
    if (idToken && currentUser) {
      // Usuário autenticado com token válido = SEMPRE endpoint autenticado
      chatEndpoint = API_CONFIG.chatEndpoint;
      log('✅ [CHAT] Token válido presente - usando endpoint autenticado');
    } else if (window.AuthGate) {
      // Só usar AuthGate para decidir se NÃO temos token
      chatEndpoint = window.AuthGate.getEndpoint('chat');
    } else {
      chatEndpoint = isAnonymous 
        ? API_CONFIG.chatAnonymousEndpoint 
        : API_CONFIG.chatEndpoint;
    }
    
    log('📤 Enviando para API:', chatEndpoint, hasImages ? '(multipart)' : '(json)', isAnonymous ? '[ANÔNIMO]' : '[AUTH]');
    const response = await fetch(chatEndpoint, {
      method: 'POST',
      headers: requestHeaders,
      body: requestBody
    });

    log('📥 Resposta recebida:', response.status, response.statusText);

    let data;
    if (response.ok) {
      const rawText = await response.text();
      log('📄 Resposta raw:', rawText.substring(0, 200) + '...');
      try {
        data = JSON.parse(rawText);
        log('✅ JSON parseado:', data);
      } catch (parseError) {
        error('❌ Erro ao parsear JSON:', parseError);
        data = { error: 'RESPONSE_PARSE_ERROR', message: 'Erro ao processar resposta do servidor' };
      }
    } else {
      const errorText = await response.text();
      error('❌ Erro na resposta:', response.status, errorText);
      
      // ✅ CORREÇÃO #3: Error handling específico (não mascarado)
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: 'UNKNOWN_ERROR', message: errorText || 'Erro desconhecido' };
      }
      
      // Categorizar erros específicos
      if (response.status === 403) {
        data = { error: errorData.code || 'FORBIDDEN', message: errorData.message || 'Acesso negado' };
      } else if (response.status === 401) {
        data = { error: 'AUTH_TOKEN_INVALID', message: 'Token de autenticação inválido' };
      } else if (response.status === 404) {
        data = { error: 'API_NOT_FOUND', message: 'API não encontrada. Verifique a configuração.' };
      } else if (response.status === 413) {
        data = { error: 'PAYLOAD_TOO_LARGE', message: 'Imagens muito grandes. Reduza o tamanho.' };
      } else if (response.status === 422) {
        data = { error: 'VALIDATION_ERROR', message: errorData.message || 'Dados inválidos' };
      } else if (response.status === 429) {
        // ✅ CORREÇÃO: Preservar dados completos do backend para LIMIT_REACHED
        data = errorData; // Manter code, plan, limit, used, period, resetAt
      } else if (response.status === 500) {
        // ✅ Distinguir PLAN_LOOKUP_FAILED de erro genérico
        if (errorData.code === 'PLAN_LOOKUP_FAILED') {
          data = { error: 'PLAN_LOOKUP_FAILED', message: errorData.message || 'Erro ao verificar plano.' };
        } else {
          data = { error: 'SERVER_ERROR', message: errorData.message || 'Erro interno do servidor' };
        }
      } else if (response.status === 502) {
        data = { error: 'BAD_GATEWAY', message: 'Erro de conexão com o servidor' };
      } else if (response.status === 503) {
        data = { error: 'SERVICE_UNAVAILABLE', message: 'Serviço temporariamente indisponível' };
      } else if (response.status === 504) {
        data = { error: 'GATEWAY_TIMEOUT', message: 'Tempo limite de processamento excedido' };
      } else {
        data = { 
          error: errorData.error || errorData.code || 'UNKNOWN_ERROR', 
          message: errorData.message || 'Erro do servidor',
          status: response.status
        };
      }
    }

    hideTypingIndicator();

    // ✅ CORREÇÃO #5: Tratamento específico de erros com ErrorMapper V2 (scope-aware)
    if (data.error || data.code) {
      const errorCode = data.code || data.error;
      let userMessage = '';
      
      // 📊 [CHAT-LIMIT-AUDIT:FRONT] Log de diagnóstico (apenas console)
      log(`[CHAT-LIMIT-AUDIT:FRONT] scope=${data.scope || 'inferred:chat'} code=${errorCode} plan=${data.plan || 'unknown'} used=${data.used || 'N/A'} limit=${data.limit || 'N/A'} period=${data.period || 'N/A'}`);
      
      // 🎯 V2: USAR ERROR MAPPER COM SCOPE
      if (window.ErrorMapper && typeof window.ErrorMapper.mapBlockUi === 'function') {
        const errorUi = window.ErrorMapper.mapBlockUi({
          scope: data.scope || 'chat', // Backend V2 envia scope, fallback para 'chat'
          code: errorCode,
          feature: data.feature || 'chat',
          plan: data.plan,
          meta: {
            ...(data.meta || {}),
            cap: data.meta?.cap || data.limit,
            used: data.meta?.used || data.used,
            resetDate: data.meta?.resetDate || data.resetAt,
            plan: data.plan,
            period: data.period
          }
        });
        
        // Renderizar mensagem amigável
        userMessage = window.ErrorMapper.renderChatError(errorUi);
        log(`[CHAT] ✅ Erro mapeado V2: ${errorUi.title} (scope: ${errorUi._debug?.scope})`);
        
      } else if (window.ErrorMapper && typeof window.ErrorMapper.mapErrorToUi === 'function') {
        // 🔄 FALLBACK V1: mapErrorToUi
        warn('[CHAT] Usando mapErrorToUi (V1 fallback)');
        const errorUi = window.ErrorMapper.mapErrorToUi({
          code: errorCode,
          plan: data.plan,
          feature: 'chat',
          meta: {
            cap: data.limit,
            used: data.used,
            resetDate: data.resetAt,
            plan: data.plan,
            scope: 'chat' // Informar scope via meta
          }
        });
        userMessage = window.ErrorMapper.renderChatError(errorUi);
      } else {
        // 🔴 FALLBACK: mensagens antigas se ErrorMapper não disponível
        warn('[CHAT] ErrorMapper não disponível, usando fallback');
        
        if (errorCode === 'AUTH_TOKEN_MISSING' || errorCode === 'AUTH_ERROR' || (typeof errorCode === 'string' && errorCode.includes('Token'))) {
          userMessage = '🔒 Sessão expirada. <a href="index.html">Faça login novamente</a>.';
        } else if (errorCode === 'FILE_UPLOAD_ERROR' || errorCode === 'REQUEST_FORMAT_ERROR') {
          userMessage = '📁 Erro no upload de imagens. Verifique se os arquivos são válidos e tente novamente.';
        } else if (errorCode === 'IMAGES_LIMIT_EXCEEDED') {
          userMessage = '📸 Máximo de 3 imagens por vez. Remova algumas imagens e tente novamente.';
        } else if (errorCode === 'PAYLOAD_TOO_LARGE') {
          userMessage = '📦 Imagens muito grandes. Comprima as imagens ou use formatos mais leves.';
        } else if (errorCode === 'VALIDATION_ERROR' || errorCode === 'MESSAGE_INVALID') {
          userMessage = `📝 ${data.message || 'Dados enviados são inválidos'}`;
        } else if (errorCode === 'RATE_LIMIT_EXCEEDED') {
          userMessage = '⏰ Muitas tentativas simultâneas. Aguarde um momento e tente novamente.';
        } else if (errorCode === 'GATEWAY_TIMEOUT' || errorCode === 'AI_SERVICE_ERROR') {
          userMessage = '⏱️ Processamento demorou muito. Tente uma mensagem mais simples ou aguarde alguns minutos.';
        } else if (errorCode === 'SERVICE_UNAVAILABLE' || errorCode === 'SERVER_ERROR') {
          userMessage = '🔧 Serviço temporariamente indisponível. Nossa equipe foi notificada. Tente novamente em alguns minutos.';
        } else if (errorCode === 'PLAN_LOOKUP_FAILED') {
          userMessage = '⚠️ Erro ao verificar seu plano. Tente novamente em alguns instantes.';
        } else if (errorCode === 'SYSTEM_PEAK_USAGE') {
          userMessage = '⚠️ Sistema em alta demanda no momento. Por favor, aguarde alguns minutos e tente novamente.';
        } else if (errorCode === 'IMAGE_PEAK_USAGE') {
          userMessage = '📸 Você atingiu o limite mensal de análises com imagens. O limite será renovado no próximo mês.';
        } else if (errorCode === 'LIMIT_REACHED') {
          const planName = (data.plan || 'free').toUpperCase();
          const limitValue = data.limit || 20;
          const resetDate = data.resetAt ? new Date(data.resetAt).toLocaleDateString('pt-BR') : 'próximo mês';
          
          userMessage = `🚫 Você atingiu o limite de <strong>${limitValue} mensagens mensais</strong> do plano ${planName}.<br><br>` +
                        `📅 Seu limite será renovado em: <strong>${resetDate}</strong><br><br>` +
                        `🔓 <a href="planos.html" class="btn-plus" target="_blank">Fazer upgrade de plano</a>`;
        } else if (typeof errorCode === 'string' && errorCode.includes('API não encontrada')) {
          userMessage = '⚙️ Sistema em configuração. Tente novamente em alguns minutos.';
        } else {
          userMessage = `❌ ${data.message || 'Erro inesperado. Nossa equipe foi notificada.'}`;
        }
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
      log('✅ Resposta recebida da IA, iniciando validação de conteúdo');

      // 🔎 Validação: se a mensagem do usuário aparenta ser uma análise de áudio, validar presença de números-chave
      const isAudioAnalysis = /\[ANÁLISE DE ÁUDIO\]/i.test(message) || /ANÁLISE TÉCNICA DE ÁUDIO/i.test(message) || /📊 DADOS TÉCNICOS:/i.test(message);

      let finalReply = data.reply;

      if (isAudioAnalysis) {
        try {
          const values = extrairValoresAnaliseDoPrompt(message);
          const ok = validarPresencaValoresNaResposta(values, finalReply);
          if (!ok && !data._validatedResend) {
            warn('⚠️ Resposta não contém todos os valores técnicos. Reenviando com reforço...');
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
          log('Validação da análise: não foi possível extrair valores', e?.message);
        }
      }

      log('✅ Exibindo resposta final da IA');
      appendMessage(`<strong>Assistente:</strong> ${finalReply}`, 'bot');
      conversationHistory.push({ role: 'assistant', content: finalReply });
      
      // Mostrar mensagens restantes se for usuário gratuito
      if (data.mensagensRestantes !== null && data.mensagensRestantes !== undefined) {
        showRemainingMessages(data.mensagensRestantes);
      }
    } else {
      error('❌ Resposta inesperada:', data);
      appendMessage(
        `<strong>Assistente:</strong> ❌ Erro: ${data.error || 'Erro inesperado'}.`,
        'bot'
      );
    }
  } catch (err) {
    error('❌ Erro crítico:', err);
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
async function initializeEverything() {
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
        log('🎯 Inicializando sistema da página principal...');
        
        // Vanta é gerenciado pelo EffectsController (carregado antes)
        // Apenas inicializar partículas se disponível
        if (window.initParticleEffects && typeof window.initParticleEffects === 'function') {
            window.initParticleEffects();
        } else {
            log('⚠️ initParticleEffects não disponível');
        }
        
        // ✅ FLUXO CORRETO: Firebase → Plano → App
        await waitForFirebase();
        log('✅ Firebase pronto');
        
        // ⏳ AGUARDAR plano do usuário estar carregado
        if (window.PlanCapabilities && typeof window.PlanCapabilities.waitForUserPlan === 'function') {
            log('⏳ Aguardando plano do usuário...');
            const userPlan = await window.PlanCapabilities.waitForUserPlan();
            log(`✅ Plano carregado: ${userPlan}`);
            window.userPlan = userPlan; // Garantir que está disponível globalmente
        } else {
            warn('⚠️ PlanCapabilities.waitForUserPlan não disponível - continuando...');
        }
        
        // 🚀 AGORA SIM inicializar app com plano correto
        log('🚀 Inicializando chatbot com plano:', window.userPlan);
        window.prodAIChatbot = new ProdAIChatbot();
    } else {
        log('📄 Página secundária detectada - pulando inicialização completa do script.js');
    }
}

function debugVercel() {
  log('=== DEBUG VERCEL ===');
  log('🌐 Location:', window.location.href);
  log('🔗 API Endpoint:', API_CONFIG.chatEndpoint);
  log('🔥 Auth loaded:', !!window.auth);
  log('🔥 Firebase ready:', window.firebaseReady);
  log('👤 Current user:', window.auth?.currentUser?.uid || 'None');
  log('📝 Start input:', !!document.getElementById('start-input'));
  log('🚀 Start button:', !!document.getElementById('startSendBtn'));
  log('💬 User input:', !!document.getElementById('user-input'));
  log('📤 Send button:', !!document.getElementById('sendBtn'));
  log('📺 Chatbox:', !!document.getElementById('chatbox'));
  log('=================');
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
    log("🚀 Job criado:", jobId);

    // Começar a acompanhar
    pollJobStatus(jobId);
  } catch (err) {
    error("❌ Erro ao iniciar análise:", err);
    appendMessage(`<strong>Assistente:</strong> ❌ Erro ao iniciar análise: ${err.message}`, "bot");
  }
}

async function pollJobStatus(jobId) {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`${API_CONFIG.baseURL}/jobs/${jobId}`);
      if (!res.ok) throw new Error("Job não encontrado");

      const job = await res.json();
      log("📊 Status job:", job);

      if (job.status === "completed") {
        clearInterval(interval);
        showJobResult(job.result);
      }
    } catch (err) {
      clearInterval(interval);
      error("❌ Erro no polling:", err);
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
    log("🎨 NodeAnalysisUI render chamado com:", result);
    showJobResult(result); // usa tua função que já mostra no chat
  }
};


/* ============ INICIALIZAÇÃO DO VISUAL NOVO ============ */
/* 🚀 PERFORMANCE V2: Vanta é gerenciado pelo EffectsController */
function initVisualEffects() {
    log('🚀 Inicializando cenário futurista...');
    
    optimizeForMobile();
    // Vanta gerenciado pelo EffectsController
    initEntranceAnimations();
    initParallaxEffect();
    initHoverEffects();
    
    log('✅ Cenário futurista carregado!');
}

/* ============ INICIALIZAÇÃO PRINCIPAL ============ */
/* 🚀 PERFORMANCE V2: Vanta é gerenciado pelo EffectsController */
function initializeApp() {
  log('🚀 Inicializando aplicação...');
  
  // Inicializar visual novo (Vanta gerenciado pelo EffectsController)
  initVisualEffects();
  
  // Inicializar otimizações mobile
  optimizeForMobile();
  
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
/* 🚀 PERFORMANCE V2: Limpeza de Vanta gerenciada pelo EffectsController */
window.addEventListener('beforeunload', () => {
    // Vanta é destruído pelo EffectsController
    if (window.EffectsController) {
        window.EffectsController.pause();
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
            
            // Controle do Vanta gerenciado pelo EffectsController
            // mouseControls já definido por tier no effects-controller.js
            
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
    log('📄 testAPIConnection não disponível nesta página');
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
            
            log('✅ GSAP animações carregadas');
        } else {
            document.body.classList.add('fallback-animation');
            warn('⚠️ GSAP não encontrado, usando animações CSS de fallback');
        }

// REMOVIDO: Listener duplicado de resize - agora está no handleResize otimizado
    } catch (error) {
        warn('⚠️ Erro no GSAP:', error);
        document.body.classList.add('fallback-animation');
    }
}