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
// 🎨 FUNÇÕES DE RENDERIZAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Renderiza uma única etapa - VERSÃO PREMIUM TÉCNICA
 */
function renderStep(step, index) {
  const impactClass = getImpactClass(step.impact);
  const impactEmoji = getImpactEmoji(step.impact);
  
  // Renderizar lista de "how" com numeração premium
  const howList = Array.isArray(step.how) 
    ? step.how.map(item => `<li>${escapeHtml(item)}</li>`).join('')
    : `<li>${escapeHtml(step.how)}</li>`;
  
  // Criar badge de impacto com descrição técnica
  const impactDescription = {
    'CRÍTICO': 'Bloqueia distribuição',
    'ALTO': 'Afeta qualidade audível', 
    'FINO': 'Otimização profissional'
  };
  
  return `
    <div class="step-card ${impactClass}" data-step="${step.number}">
      <div class="step-header" onclick="toggleStep(${step.number})" tabindex="0" role="button" aria-expanded="false">
        <div class="step-number">${step.number}</div>
        <div class="step-title-wrapper">
          <h3 class="step-title">${escapeHtml(step.title)}</h3>
          <span class="step-impact">${impactEmoji} ${step.impact} <small style="opacity:0.7;font-weight:400">• ${impactDescription[step.impact] || ''}</small></span>
        </div>
        <div class="step-toggle">
          <svg class="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </div>
      
      <div class="step-content" id="stepContent${step.number}">
        ${step.problemRef ? `
          <div class="step-problem-ref">
            <span class="problem-label">🎯 Problema Detectado:</span>
            <span class="problem-type">${escapeHtml(step.problemRef.type)}</span>
            <span class="problem-values">
              <strong>Atual:</strong> ${step.problemRef.currentValue} → 
              <strong>Alvo:</strong> ${step.problemRef.targetValue}
            </span>
          </div>
        ` : ''}
        
        <div class="step-why">
          <h4>📌 Por que isso importa</h4>
          <p>${escapeHtml(step.why)}</p>
        </div>
        
        <div class="step-how">
          <h4>🔧 Passo a passo técnico</h4>
          <ol class="how-list">${howList}</ol>
        </div>
        
        ${step.dawSpecific ? `
          <div class="step-daw-tip">
            <h4>💡 Dica específica para sua DAW</h4>
            <p>${escapeHtml(step.dawSpecific)}</p>
          </div>
        ` : ''}
        
        ${step.avoidMistake ? `
          <div class="step-avoid">
            <h4>⚠️ Erro comum a evitar</h4>
            <p>${escapeHtml(step.avoidMistake)}</p>
          </div>
        ` : ''}
        
        <div class="step-verify">
          <h4>✅ Validação técnica</h4>
          <p>${escapeHtml(step.verify)}</p>
        </div>
        
        <div class="step-next">
          <h4>🔄 Condição para próxima etapa</h4>
          <p class="next-condition">${escapeHtml(step.nextStepCondition)}</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renderiza todas as etapas - VERSÃO PREMIUM
 */
function renderSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    elements.stepsList.innerHTML = `
      <div class="no-steps" style="text-align:center;padding:3rem;background:rgba(168,85,247,0.05);border-radius:1rem;border:1px dashed rgba(168,85,247,0.3);">
        <p style="font-size:1.25rem;margin:0;color:#a1a1aa;">🎯 Nenhuma correção necessária detectada.</p>
        <p style="font-size:0.9rem;margin-top:0.5rem;color:#71717a;">Sua música está dentro dos padrões profissionais!</p>
      </div>
    `;
    return;
  }
  
  // Contar por severidade
  const criticalCount = steps.filter(s => s.impact === 'CRÍTICO').length;
  const highCount = steps.filter(s => s.impact === 'ALTO').length;
  const fineCount = steps.filter(s => s.impact === 'FINO').length;
  
  // Header com contagem
  const summaryHtml = `
    <div class="steps-summary" style="display:flex;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap;">
      ${criticalCount > 0 ? `<span style="background:rgba(255,59,92,0.1);border:1px solid rgba(255,59,92,0.3);padding:0.5rem 1rem;border-radius:0.5rem;font-size:0.875rem;font-weight:600;color:#ff3b5c;">${criticalCount} Crítico${criticalCount > 1 ? 's' : ''}</span>` : ''}
      ${highCount > 0 ? `<span style="background:rgba(255,176,32,0.1);border:1px solid rgba(255,176,32,0.3);padding:0.5rem 1rem;border-radius:0.5rem;font-size:0.875rem;font-weight:600;color:#ffb020;">${highCount} Alto${highCount > 1 ? 's' : ''}</span>` : ''}
      ${fineCount > 0 ? `<span style="background:rgba(16,224,128,0.1);border:1px solid rgba(16,224,128,0.3);padding:0.5rem 1rem;border-radius:0.5rem;font-size:0.875rem;font-weight:600;color:#10e080;">${fineCount} Fino${fineCount > 1 ? 's' : ''}</span>` : ''}
    </div>
  `;
  
  const stepsHtml = steps.map((step, index) => renderStep(step, index)).join('');
  elements.stepsList.innerHTML = summaryHtml + stepsHtml;
  
  // Abrir primeira etapa por padrão
  if (steps.length > 0) {
    toggleStep(1, true);
  }
}

/**
 * Renderiza o plano completo - VERSÃO PREMIUM TÉCNICA
 */
function renderPlan(planData, metadata) {
  // Badge do plano
  const userPlan = metadata.plan || 'free';
  elements.planBadge.textContent = userPlan.toUpperCase();
  elements.planBadge.className = `plan-badge ${getPlanBadgeClass(userPlan)}`;
  
  // Subtítulo com nome do arquivo e contexto técnico
  const fileName = metadata.input?.userProfile?.fileName || metadata.input?.metadata?.fileName || 'Sua música';
  const genre = metadata.input?.metadata?.genre || metadata.input?.userProfile?.genre || '';
  const daw = metadata.input?.metadata?.daw || metadata.input?.userProfile?.daw || '';
  
  let subtitleParts = [`Correções para: ${fileName}`];
  if (genre) subtitleParts.push(`Gênero: ${genre}`);
  if (daw && daw !== 'generic') subtitleParts.push(`DAW: ${daw}`);
  
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
