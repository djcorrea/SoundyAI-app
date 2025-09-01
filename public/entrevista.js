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

document.addEventListener('DOMContentLoaded', () => {
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
        await db.collection('usuarios').doc(user.uid).set({
          perfil: answers,
          entrevistaConcluida: true
        }, { merge: true });
        
        // Verificar se é uma repersonalização
        const urlParams = new URLSearchParams(window.location.search);
        const isRepersonalizando = urlParams.get('repersonalizando') === 'true';
        
        if (isRepersonalizando) {
          // Se é repersonalização, redirecionar direto para o chat
          console.log('🔄 Repersonalização detectada - redirecionando para index.html');
          window.location.href = 'index.html';
        } else {
          // Se é primeira vez, redirecionar para página final
          console.log('🎉 Primeira entrevista - redirecionando para entrevista-final.html');
          window.location.href = 'entrevista-final.html';
        }
      } catch (e) {
        console.error(e);
        btn.disabled = false;
      }
    }
  });
});
