/**
 * 🎯 PLANO.JS - Lógica da página de Plano de Correção
 * 
 * Responsável por:
 * - Carregar plano do Firestore
 * - Renderizar etapas dinamicamente
 * - Gerenciar estados (loading, erro, sucesso)
 * - Controle de autenticação
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3001' 
  : '';

// Firebase config (mesmo do firebase.js)
const firebaseConfig = {
  apiKey: "AIzaSyBKby0RdIOGorhrfBRMCWnL25peU3epGTw",
  authDomain: "prodai-58436.firebaseapp.com",
  projectId: "prodai-58436",
  storageBucket: "prodai-58436.appspot.com",
  messagingSenderId: "801631191322",
  appId: "1:801631322:web:80e3d29cf7468331652ca3"
};

// Inicializar Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 ELEMENTOS DOM
// ═══════════════════════════════════════════════════════════════════════════════

const elements = {
  loadingOverlay: document.getElementById('loadingOverlay'),
  errorState: document.getElementById('errorState'),
  errorMessage: document.getElementById('errorMessage'),
  mainContent: document.getElementById('mainContent'),
  planBadge: document.getElementById('planBadge'),
  planSubtitle: document.getElementById('planSubtitle'),
  introText: document.getElementById('introText'),
  reanalysisReminderTop: document.getElementById('reanalysisReminderTop'),
  stepsList: document.getElementById('stepsList'),
  finalNoteText: document.getElementById('finalNoteText'),
  generatedAt: document.getElementById('generatedAt')
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🛠️ FUNÇÕES UTILITÁRIAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Obtém o ID do plano da URL
 */
function getPlanIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

/**
 * Mostra estado de loading
 */
function showLoading() {
  elements.loadingOverlay.style.display = 'flex';
  elements.errorState.style.display = 'none';
  elements.mainContent.style.display = 'none';
}

/**
 * Mostra estado de erro
 */
function showError(message) {
  elements.loadingOverlay.style.display = 'none';
  elements.errorState.style.display = 'flex';
  elements.mainContent.style.display = 'none';
  elements.errorMessage.textContent = message;
}

/**
 * Mostra conteúdo principal
 */
function showContent() {
  elements.loadingOverlay.style.display = 'none';
  elements.errorState.style.display = 'none';
  elements.mainContent.style.display = 'block';
}

/**
 * Formata data para exibição
 */
function formatDate(timestamp) {
  if (!timestamp) return 'Data não disponível';
  
  let date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }
  
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Retorna classe CSS baseado no impacto
 */
function getImpactClass(impact) {
  const map = {
    'CRÍTICO': 'impact-critical',
    'ALTO': 'impact-high',
    'FINO': 'impact-fine'
  };
  return map[impact] || 'impact-high';
}

/**
 * Retorna emoji baseado no impacto
 */
function getImpactEmoji(impact) {
  const map = {
    'CRÍTICO': '🔴',
    'ALTO': '🟡',
    'FINO': '🟢'
  };
  return map[impact] || '🟡';
}

/**
 * Retorna badge de plano
 */
function getPlanBadgeClass(plan) {
  const map = {
    'free': 'badge-free',
    'plus': 'badge-plus',
    'pro': 'badge-pro'
  };
  return map[plan] || 'badge-free';
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 FUNÇÕES DE RENDERIZAÇÃO - LAYOUT COMPACTO v2
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 🆕 Mapeamento de categorias para ícones e nomes
 */
const CATEGORY_CONFIG = {
  loudness: { icon: '🎚️', name: 'Loudness', color: '#ff3b5c' },
  frequency: { icon: '🎛️', name: 'Frequências', color: '#a855f7' },
  dynamics: { icon: '📊', name: 'Dinâmica', color: '#ffb020' },
  stereo: { icon: '🔊', name: 'Estéreo', color: '#22d3ee' },
  other: { icon: '⚙️', name: 'Geral', color: '#71717a' }
};

/**
 * 🆕 Extrai a categoria de uma etapa
 */
function getStepCategory(step) {
  if (step.category) return step.category;
  
  const title = (step.title || '').toLowerCase();
  const type = (step.problemRef?.type || '').toLowerCase();
  
  if (title.includes('lufs') || title.includes('peak') || title.includes('loudness') ||
      type.includes('lufs') || type.includes('peak')) {
    return 'loudness';
  }
  if (title.includes('freq') || title.includes('eq') || title.includes('bass') ||
      title.includes('sub') || title.includes('mid') || title.includes('high') ||
      title.includes('brilho') || title.includes('presença')) {
    return 'frequency';
  }
  if (title.includes('dinâm') || title.includes('dynamic') || title.includes('dr') ||
      title.includes('lra') || title.includes('compress')) {
    return 'dynamics';
  }
  if (title.includes('stereo') || title.includes('estéreo') || title.includes('width') ||
      title.includes('correlat')) {
    return 'stereo';
  }
  return 'other';
}

/**
 * 🔧 Sanitiza valores para nunca mostrar "undefined"
 */
function sanitizeValue(value, fallback = 'N/A') {
  if (value === undefined || value === null || value === 'undefined' || value === '') {
    return fallback;
  }
  return String(value);
}

/**
 * Renderiza uma única etapa - VERSÃO COMPACTA v2
 */
function renderStep(step, index) {
  const impactClass = getImpactClass(step.impact);
  const impactEmoji = getImpactEmoji(step.impact);
  const category = getStepCategory(step);
  const categoryConfig = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
  
  // Renderizar lista de "how" - compacto
  const howList = Array.isArray(step.how) 
    ? step.how.map(item => `<li>${escapeHtml(sanitizeValue(item, 'Verificar documentação'))}</li>`).join('')
    : `<li>${escapeHtml(sanitizeValue(step.how, 'Verificar documentação'))}</li>`;
  
  // Renderizar problemRef com validação - especial para frequências
  let problemRefHtml = '';
  if (step.problemRef) {
    const type = sanitizeValue(step.problemRef.type, 'Métrica');
    const current = sanitizeValue(step.problemRef.currentValue, 'Detectado');
    const target = sanitizeValue(step.problemRef.targetValue, 'Alvo');
    const details = step.problemRef.details;
    
    problemRefHtml = `
      <div class="step-problem-ref compact">
        <div class="problem-header">
          <span class="problem-type">${escapeHtml(type)}</span>
          <span class="problem-values">${escapeHtml(current)} → ${escapeHtml(target)}</span>
        </div>
        ${details ? `<div class="problem-details">${escapeHtml(details)}</div>` : ''}
      </div>
    `;
  }
  
  // Descrição curta do impacto
  const impactDescription = {
    'CRÍTICO': 'Impede distribuição',
    'ALTO': 'Afeta qualidade', 
    'FINO': 'Refinamento'
  };
  
  return `
    <div class="step-card compact ${impactClass}" data-step="${step.number}" data-category="${category}">
      <div class="step-header" onclick="toggleStep(${step.number})" tabindex="0" role="button" aria-expanded="false">
        <div class="step-number">${step.number}</div>
        <div class="step-title-wrapper">
          <h3 class="step-title">${escapeHtml(sanitizeValue(step.title, 'Correção'))}</h3>
          <div class="step-meta">
            <span class="step-category" style="color:${categoryConfig.color}">${categoryConfig.icon} ${categoryConfig.name}</span>
            <span class="step-impact">${impactEmoji} ${step.impact}</span>
          </div>
        </div>
        <div class="step-toggle">
          <svg class="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </div>
      
      <div class="step-content compact" id="stepContent${step.number}">
        ${problemRefHtml}
        
        <div class="step-section why">
          <h4>📌 Por que isso importa</h4>
          <p>${escapeHtml(sanitizeValue(step.why, 'Este problema afeta a qualidade final da sua música.'))}</p>
        </div>
        
        <div class="step-section how">
          <h4>🔧 Como corrigir</h4>
          <ol class="how-list compact">${howList}</ol>
        </div>
        
        ${step.dawSpecific && step.dawSpecific !== 'undefined' ? `
          <div class="step-section tip">
            <h4>💡 Dica DAW</h4>
            <p>${escapeHtml(step.dawSpecific)}</p>
          </div>
        ` : ''}
        
        ${step.avoidMistake && step.avoidMistake !== 'undefined' ? `
          <div class="step-section warning">
            <h4>⚠️ Evitar</h4>
            <p>${escapeHtml(step.avoidMistake)}</p>
          </div>
        ` : ''}
        
        <div class="step-footer">
          <div class="step-verify">
            <strong>✅ Validar:</strong> ${escapeHtml(sanitizeValue(step.verify, 'Reanalisar no SoundyAI'))}
          </div>
          <div class="step-next">
            <strong>🔄 Próximo:</strong> ${escapeHtml(sanitizeValue(step.nextStepCondition, 'Reanalisar antes de prosseguir'))}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renderiza todas as etapas - VERSÃO COMPACTA v2
 */
function renderSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    elements.stepsList.innerHTML = `
      <div class="no-steps">
        <div class="no-steps-icon">🎯</div>
        <p class="no-steps-title">Nenhuma correção necessária</p>
        <p class="no-steps-text">Sua música está dentro dos padrões profissionais!</p>
      </div>
    `;
    return;
  }
  
  // Agrupar por categoria
  const byCategory = {
    loudness: [],
    frequency: [],
    dynamics: [],
    stereo: [],
    other: []
  };
  
  steps.forEach(step => {
    const cat = getStepCategory(step);
    if (byCategory[cat]) {
      byCategory[cat].push(step);
    } else {
      byCategory.other.push(step);
    }
  });
  
  // Contar por severidade
  const criticalCount = steps.filter(s => s.impact === 'CRÍTICO').length;
  const highCount = steps.filter(s => s.impact === 'ALTO').length;
  const fineCount = steps.filter(s => s.impact === 'FINO').length;
  
  // Header compacto com badges
  let summaryHtml = `
    <div class="steps-summary compact">
      <div class="summary-badges">
        ${criticalCount > 0 ? `<span class="badge critical">${criticalCount} Crítico${criticalCount > 1 ? 's' : ''}</span>` : ''}
        ${highCount > 0 ? `<span class="badge high">${highCount} Alto${highCount > 1 ? 's' : ''}</span>` : ''}
        ${fineCount > 0 ? `<span class="badge fine">${fineCount} Fino${fineCount > 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="summary-categories">
  `;
  
  // Adicionar mini-resumo por categoria ativa
  Object.entries(byCategory).forEach(([cat, catSteps]) => {
    if (catSteps.length > 0) {
      const config = CATEGORY_CONFIG[cat];
      summaryHtml += `<span class="category-chip" style="border-color:${config.color}">${config.icon} ${catSteps.length}</span>`;
    }
  });
  
  summaryHtml += `</div></div>`;
  
  // Renderizar etapas
  const stepsHtml = steps.map((step, index) => renderStep(step, index)).join('');
  elements.stepsList.innerHTML = summaryHtml + stepsHtml;
  
  // Abrir primeira etapa crítica ou primeira geral
  const firstCritical = steps.find(s => s.impact === 'CRÍTICO');
  const firstStep = firstCritical || steps[0];
  if (firstStep) {
    toggleStep(firstStep.number, true);
  }
}

/**
 * Renderiza o plano completo - VERSÃO COMPACTA v2
 */
function renderPlan(planData, metadata) {
  // Badge do plano
  const userPlan = metadata.plan || 'free';
  elements.planBadge.textContent = userPlan.toUpperCase();
  elements.planBadge.className = `plan-badge ${getPlanBadgeClass(userPlan)}`;
  
  // Subtítulo com nome do arquivo e contexto técnico
  const fileName = sanitizeValue(
    metadata.input?.userProfile?.fileName || metadata.input?.metadata?.fileName,
    'Sua música'
  );
  const genre = sanitizeValue(
    metadata.input?.metadata?.genre || metadata.input?.userProfile?.genre,
    ''
  );
  const daw = sanitizeValue(
    metadata.input?.metadata?.daw || metadata.input?.userProfile?.daw,
    ''
  );
  
  let subtitleParts = [fileName];
  if (genre && genre !== 'generic') subtitleParts.push(genre);
  if (daw && daw !== 'generic' && daw !== 'Não informada') subtitleParts.push(daw);
  
  elements.planSubtitle.textContent = subtitleParts.join(' • ');
  
  // Intro com mais contexto
  elements.introText.textContent = planData.intro || 'Vamos corrigir os problemas detectados na sua música de forma sistemática e profissional.';
  
  // Reminder de reanálise
  if (planData.reanalysisReminder) {
    elements.reanalysisReminderTop.textContent = planData.reanalysisReminder;
  }
  
  // Etapas
  renderSteps(planData.steps);
  
  // Nota final
  elements.finalNoteText.textContent = planData.finalNote || 'O resultado final depende de iterações no SoundyAI. Cada correção aproxima sua música do padrão profissional!';
  
  // Data de geração com formato premium
  const formattedDate = formatDate(metadata.generatedAt);
  elements.generatedAt.textContent = `Plano gerado em ${formattedDate}`;
}

/**
 * Escape HTML para prevenir XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Toggle de etapa (acordeão)
 */
window.toggleStep = function(stepNumber, forceOpen = false) {
  const content = document.getElementById(`stepContent${stepNumber}`);
  const card = document.querySelector(`.step-card[data-step="${stepNumber}"]`);
  
  if (!content || !card) return;
  
  const isOpen = card.classList.contains('open');
  
  if (forceOpen || !isOpen) {
    // Fechar outras etapas
    document.querySelectorAll('.step-card.open').forEach(openCard => {
      openCard.classList.remove('open');
    });
    
    card.classList.add('open');
  } else {
    card.classList.remove('open');
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 FUNÇÕES DE DADOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Carrega plano do Firestore
 */
async function loadPlanFromFirestore(planId, uid) {
  try {
    const docRef = db.collection('correction_plans').doc(planId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      throw new Error('Plano não encontrado');
    }
    
    const data = docSnap.data();
    
    // Verificar se o plano pertence ao usuário
    if (data.userId !== uid) {
      throw new Error('Acesso não autorizado a este plano');
    }
    
    return {
      id: docSnap.id,
      plan: data.response,
      metadata: {
        plan: data.plan,
        generatedAt: data.generatedAt,
        input: data.input,
        stepsCount: data.stepsCount,
        fallbackUsed: data.fallbackUsed
      }
    };
    
  } catch (error) {
    console.error('[PLANO] Erro ao carregar do Firestore:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

async function init() {
  console.log('[PLANO] Inicializando página...');
  showLoading();
  
  // Verificar se há ID na URL
  const planId = getPlanIdFromUrl();
  if (!planId) {
    showError('ID do plano não encontrado na URL. Volte e gere um novo plano.');
    return;
  }
  
  console.log('[PLANO] Plan ID:', planId);
  
  // Aguardar autenticação
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      console.log('[PLANO] Usuário não autenticado, redirecionando...');
      window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
      return;
    }
    
    console.log('[PLANO] Usuário autenticado:', user.uid);
    
    try {
      // Carregar plano
      const { plan, metadata } = await loadPlanFromFirestore(planId, user.uid);
      
      console.log('[PLANO] Plano carregado:', {
        stepsCount: plan.steps?.length,
        hasIntro: !!plan.intro,
        hasFinalNote: !!plan.finalNote
      });
      
      // Renderizar
      renderPlan(plan, metadata);
      
      // Mostrar conteúdo
      showContent();
      
      // 🔧 FIX: Scroll para o topo do conteúdo após renderizar
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Garantir que o body não está travado
        document.body.style.overflow = 'auto';
        document.documentElement.style.overflow = 'auto';
      }, 100);
      
    } catch (error) {
      console.error('[PLANO] Erro:', error);
      showError(error.message || 'Erro ao carregar plano de correção.');
    }
  });
}

// Iniciar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
