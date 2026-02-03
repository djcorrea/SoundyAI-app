const firebaseConfig = {
  apiKey: "AIzaSyBKby0RdIOGorhrfBRMCWnL25peU3epGTw",
  authDomain: "prodai-58436.firebaseapp.com",
  projectId: "prodai-58436",
  storageBucket: "prodai-58436.appspot.com",
  messagingSenderId: "801631191322",
  appId: "1:801631322:web:80e3d29cf7468331652ca3",
  measurementId: "G-MBDHDYN6Z0"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// ✅ PLANOS COM ACESSO À ENTREVISTA (PRO, STUDIO, DJ)
const ALLOWED_PLANS = ['pro', 'studio', 'dj'];

// 🔐 VERIFICAÇÃO DE ACESSO: Bloquear FREE e PLUS
async function checkInterviewAccess() {
  log('🔐 [INTERVIEW] Verificando acesso à entrevista...');
  
  const user = auth.currentUser;
  if (!user) {
    log('❌ [INTERVIEW] Usuário não autenticado - redirecionando para login');
    window.location.href = 'login.html';
    return false;
  }
  
  try {
    const userDoc = await db.collection('usuarios').doc(user.uid).get();
    if (!userDoc.exists) {
      warn('⚠️ [INTERVIEW] Documento do usuário não existe - redirecionando para index');
      window.location.href = 'index.html';
      return false;
    }
    
    const userData = userDoc.data();
    const userPlan = userData.plan || 'free';
    
    log(`🔍 [INTERVIEW] Plano do usuário: ${userPlan}`);
    
    if (!ALLOWED_PLANS.includes(userPlan)) {
      warn(`❌ [INTERVIEW] Acesso negado - plano ${userPlan} não tem acesso à entrevista`);
      log('   Redirecionando para index.html...');
      alert('❌ A personalização de entrevista é exclusiva dos planos PRO, STUDIO e DJ Beta. Faça upgrade para personalizar sua experiência!');
      window.location.href = 'index.html';
      return false;
    }
    
    log(`✅ [INTERVIEW] Acesso permitido - plano ${userPlan}`);
    return true;
  } catch (error) {
    error('❌ [INTERVIEW] Erro ao verificar acesso:', error);
    window.location.href = 'index.html';
    return false;
  }
}

const questions = [
  { key: 'nomeArtistico',  text: 'Qual seu nome artístico?', type: 'text' },
  { key: 'nivelTecnico',   text: 'Qual seu nível técnico?', type: 'select', options: ['Iniciante','Intermediário','Avançado','Profissional'] },
  { key: 'daw',            text: 'Qual DAW você usa? (ex: FL Studio, Ableton, Logic...)', type: 'text' },
  { key: 'estilo',         text: 'Qual estilo musical você produz?', type: 'text' },
  { key: 'dificuldade',    text: 'Qual sua maior dificuldade na produção musical?', type: 'text' },
  { key: 'sobre',          text: 'Me conte mais sobre você', type: 'textarea' }
];

let current = 0;
const answers = {};

function showQuestion() {
  const q = questions[current];
  if (!q) return;
  const questionEl = document.getElementById('question');
  const inputArea = document.getElementById('inputArea');
  questionEl.textContent = q.text;
  let inputHtml = '';
  if (q.type === 'select') {
    inputHtml = `<select class="input-field" id="answerField">${q.options.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
  } else if (q.type === 'textarea') {
    inputHtml = `<textarea class="input-field" id="answerField" rows="4"></textarea>`;
  } else {
    inputHtml = `<input class="input-field" id="answerField" type="text" />`;
  }
  inputArea.innerHTML = inputHtml;
}

document.addEventListener('DOMContentLoaded', async () => {
  // 🔐 VERIFICAR ACESSO ANTES DE MOSTRAR FORMULÁRIO
  const hasAccess = await checkInterviewAccess();
  if (!hasAccess) {
    log('❌ [INTERVIEW] Acesso negado - página será redirecionada');
    return; // checkInterviewAccess já faz o redirect
  }
  
  log('✅ [INTERVIEW] Acesso confirmado - inicializando formulário');
  showQuestion();
  const btn = document.getElementById('nextBtn');
  btn.addEventListener('click', async () => {
    const field = document.getElementById('answerField');
    if (!field) return;
    const value = field.value.trim();
    if (!value) { field.focus(); return; }
    answers[questions[current].key] = value;
    current++;
    if (current < questions.length) {
      showQuestion();
      if (current === questions.length - 1) btn.textContent = 'Enviar';
    } else {
      btn.disabled = true;
      try {
        const user = auth.currentUser;
        if (!user) throw new Error('Usuário não autenticado');
        
        // ✅ SALVAR PERFIL E MARCAR ENTREVISTA CONCLUÍDA
        await db.collection('usuarios').doc(user.uid).set({
          perfil: answers,
          entrevistaConcluida: true,
          needsInterviewInvite: false, // ✅ NOVO: Marcar que modal já foi usado
          interviewCompletedAt: firebase.firestore.Timestamp.now() // ✅ NOVO: Timestamp de conclusão
        }, { merge: true });
        
        log('🎉 [INTERVIEW] Entrevista concluída com sucesso!');
        log('📋 [INTERVIEW] Perfil salvo:', answers);
        alert('✅ Seu perfil foi salvo com sucesso! Suas respostas e sugestões da IA serão personalizadas.');
        window.location.href = 'index.html';
      } catch (e) {
        error('❌ [INTERVIEW] Erro ao salvar perfil:', e);
        alert('Erro ao salvar seu perfil. Tente novamente.');
        btn.disabled = false;
      }
    }
  });
});
