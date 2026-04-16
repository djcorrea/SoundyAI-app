// hub.js - Lógica do Hub SoundyAI
// ✅ NÃO altera sistema de login existente
// ✅ Detecta login via localStorage (idToken, token, user)
// ✅ Salva destino e redireciona para login se necessário

debugLog('🚀 [HUB] Inicializando SoundyAI Hub...');

// ═══════════════════════════════════════════════════════════════════
// 🔐 DETECÇÃO DE LOGIN (sem tocar no sistema atual)
// ═══════════════════════════════════════════════════════════════════

/**
 * Verifica se usuário está logado baseado em indicadores no localStorage
 * Suporta 3 formatos: idToken, token, user
 * @returns {boolean}
 */
function isUserLoggedIn() {
  try {
    // Verificar múltiplos indicadores de sessão
    const idToken = localStorage.getItem('idToken');
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    // Considerar logado se qualquer um existir e não estiver vazio
    const hasValidToken = (idToken && idToken !== 'undefined' && idToken !== 'null');
    const hasValidGenericToken = (token && token !== 'undefined' && token !== 'null');
    const hasValidUser = (user && user !== 'undefined' && user !== 'null');
    
    const isLogged = hasValidToken || hasValidGenericToken || hasValidUser;
    
    debugLog('🔍 [HUB] Status de login:', {
      idToken: !!idToken,
      token: !!token,
      user: !!user,
      isLogged
    });
    
    return isLogged;
  } catch (error) {
    debugError('❌ [HUB] Erro ao verificar login:', error);
    return false;
  }
}

/**
 * Verifica se há redirecionamento pendente e executa
 * Chamado ao carregar a página se usuário já estiver logado
 */
function checkPendingRedirect() {
  const pendingRedirect = localStorage.getItem('postLoginRedirect');
  
  if (pendingRedirect) {
    debugLog('✅ [HUB] Redirecionamento pendente detectado:', pendingRedirect);
    
    // Limpar flag para evitar loops
    localStorage.removeItem('postLoginRedirect');
    
    // Executar redirecionamento
    redirectToDestination(pendingRedirect);
    return true;
  }
  
  return false;
}

// ═══════════════════════════════════════════════════════════════════
// 🎯 SISTEMA DE REDIRECIONAMENTO
// ═══════════════════════════════════════════════════════════════════

/**
 * Mapeia ações para URLs de destino com parâmetros
 * @param {string} action - analyze, master ou chat
 * @returns {string} URL de destino
 */
function getDestinationUrl(action) {
  const destinations = {
    'analyze': '/index.html?startAnalysis=true',
    'master': '/master.html',
    'chat': '/index.html'
  };
  
  return destinations[action] || '/index.html';
}

/**
 * Redireciona para o destino apropriado
 * @param {string} action - analyze, master ou chat
 */
function redirectToDestination(action) {
  const url = getDestinationUrl(action);
  debugLog(`🎯 [HUB] Redirecionando para: ${url}`);
  
  // Pequeno delay para feedback visual
  setTimeout(() => {
    window.location.href = url;
  }, 300);
}

/**
 * Salva destino e redireciona para login
 * @param {string} action - analyze, master ou chat
 */
function saveDestinationAndLogin(action) {
  debugLog(`💾 [HUB] Salvando destino: ${action}`);
  
  // Salvar destino no localStorage
  localStorage.setItem('postLoginRedirect', action);
  
  debugLog('🔐 [HUB] Redirecionando para login...');
  
  // Redirecionar para login (sistema atual não modificado)
  setTimeout(() => {
    window.location.href = '/login.html';
  }, 200);
}

// ═══════════════════════════════════════════════════════════════════
// 🎬 HANDLERS DE EVENTOS
// ═══════════════════════════════════════════════════════════════════

/**
 * Handler para cliques nos CTAs
 * @param {Event} event 
 */
function handleOptionClick(event) {
  const button = event.currentTarget;
  const action = button.getAttribute('data-action');
  
  if (!action) {
    debugError('❌ [HUB] Ação não definida no botão');
    return;
  }
  
  debugLog(`🎯 [HUB] Opção clicada: ${action}`);
  
  // Feedback visual
  button.classList.add('loading');
  button.innerHTML = '<span>Processando...</span>';
  
  // Verificar se usuário está logado
  if (isUserLoggedIn()) {
    debugLog('✅ [HUB] Usuário já logado, redirecionando direto...');
    redirectToDestination(action);
  } else {
    debugLog('🔐 [HUB] Usuário não logado, salvando destino e indo para login...');
    saveDestinationAndLogin(action);
  }
}

/**
 * Adiciona highlight visual no hover (opcional, já tem CSS)
 */
function enhanceCardInteractions() {
  const cards = document.querySelectorAll('.hub-card');
  
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      debugLog('🎨 [HUB] Card hover:', card.getAttribute('data-option'));
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// 🚀 INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  debugLog('🎉 [HUB] DOM carregado, iniciando setup...');
  
  // 1️⃣ Verificar se há redirecionamento pendente (usuário voltou logado)
  if (isUserLoggedIn()) {
    debugLog('✅ [HUB] Usuário já está logado');
    
    if (checkPendingRedirect()) {
      // Redirecionamento será executado, não continuar setup
      return;
    }
  } else {
    debugLog('🔓 [HUB] Usuário não está logado (normal, hub é público)');
  }
  
  // 2️⃣ Adicionar event listeners nos CTAs
  const ctaButtons = document.querySelectorAll('[data-action]');
  
  debugLog(`🎯 [HUB] Registrando ${ctaButtons.length} botões CTA`);
  
  ctaButtons.forEach(button => {
    button.addEventListener('click', handleOptionClick);
  });
  
  // 3️⃣ Enhancements opcionais
  enhanceCardInteractions();
  
  debugLog('✅ [HUB] Setup completo, pronto para uso!');
});

// ═══════════════════════════════════════════════════════════════════
// 📊 DEBUG MODE (apenas em desenvolvimento)
// ═══════════════════════════════════════════════════════════════════

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  debugLog('🔧 [HUB-DEBUG] Modo debug ativado');
  
  // Expor funções para testes no console
  window.SoundyHub = {
    isLoggedIn: isUserLoggedIn,
    checkRedirect: checkPendingRedirect,
    forceRedirect: redirectToDestination,
    clearRedirect: () => localStorage.removeItem('postLoginRedirect'),
    simulateLogin: () => {
      localStorage.setItem('idToken', 'test-token-123');
      debugLog('✅ Login simulado! Recarregue a página.');
    },
    simulateLogout: () => {
      localStorage.removeItem('idToken');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      debugLog('✅ Logout simulado! Recarregue a página.');
    }
  };
  
  debugLog('💡 [HUB-DEBUG] Comandos disponíveis no console:');
  debugLog('   - SoundyHub.isLoggedIn()');
  debugLog('   - SoundyHub.simulateLogin()');
  debugLog('   - SoundyHub.simulateLogout()');
  debugLog('   - SoundyHub.forceRedirect("analyze")');
}
