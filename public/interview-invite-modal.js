/**
 * 🎯 INTERVIEW INVITE MODAL
 * Sistema de convite para entrevista pós-upgrade (PRO/STUDIO/DJ)
 * 
 * Fluxo:
 * 1. Detecta flag needsInterviewInvite: true no Firestore
 * 2. Mostra modal elegante convidando para personalizar experiência
 * 3. Botão "Personalizar agora" → redireciona para entrevista.html
 * 4. Botão "Fazer depois" → marca flag como false e fecha modal
 * 
 * Data: 03/02/2026
 */

(function() {
  'use strict';

  log('🎯 [INTERVIEW-MODAL] Inicializando sistema de convite...');

  // ✅ Planos com acesso à entrevista
  const PAID_PLANS = ['pro', 'studio', 'dj'];

  /**
   * Verifica se deve mostrar o modal de convite para entrevista
   * @returns {Promise<boolean>}
   */
  async function shouldShowInterviewInvite() {
    try {
      // Verificar autenticação
      if (!window.auth || !window.auth.currentUser) {
        log('⏭️ [INTERVIEW-MODAL] Usuário não autenticado');
        return false;
      }

      const uid = window.auth.currentUser.uid;

      // Importar Firestore functions
      const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
      
      // Buscar dados do usuário
      const userDoc = await getDoc(doc(window.db, 'usuarios', uid));
      
      if (!userDoc.exists()) {
        log('⏭️ [INTERVIEW-MODAL] Documento do usuário não existe');
        return false;
      }

      const userData = userDoc.data();
      const userPlan = userData.plan || 'free';
      
      log(`🔍 [INTERVIEW-MODAL] Verificação de convite:`);
      log(`   Plan: ${userPlan}`);
      log(`   needsInterviewInvite: ${userData.needsInterviewInvite}`);
      log(`   entrevistaConcluida: ${userData.entrevistaConcluida}`);

      // Verificar se deve mostrar modal
      if (
        PAID_PLANS.includes(userPlan) &&           // Plano pago
        userData.needsInterviewInvite === true &&  // Flag de convite ativa
        userData.entrevistaConcluida !== true      // Entrevista ainda não feita
      ) {
        log('✅ [INTERVIEW-MODAL] Condições atendidas - modal será exibido');
        return true;
      }

      log('⏭️ [INTERVIEW-MODAL] Condições não atendidas - modal não será exibido');
      return false;
    } catch (error) {
      error('❌ [INTERVIEW-MODAL] Erro ao verificar convite:', error);
      return false;
    }
  }

  /**
   * Marca a flag needsInterviewInvite como false
   */
  async function dismissInterviewInvite() {
    try {
      const uid = window.auth.currentUser.uid;
      const { doc, updateDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
      
      await updateDoc(doc(window.db, 'usuarios', uid), {
        needsInterviewInvite: false,
        interviewInviteShownAt: Timestamp.now()
      });

      log('✅ [INTERVIEW-MODAL] Flag needsInterviewInvite marcada como false');
    } catch (error) {
      error('❌ [INTERVIEW-MODAL] Erro ao marcar flag:', error);
    }
  }

  /**
   * Cria e exibe o modal de convite
   */
  async function showInterviewInviteModal() {
    log('🎨 [INTERVIEW-MODAL] Criando modal...');

    // Criar HTML do modal
    const modalHTML = `
      <div id="interviewInviteModal" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        animation: fadeIn 0.3s ease;
      ">
        <div style="
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 2px solid rgba(139, 92, 246, 0.3);
          border-radius: 20px;
          padding: 40px;
          max-width: 550px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(139, 92, 246, 0.3);
          position: relative;
          animation: slideUp 0.4s ease;
        ">
          <!-- Ícone de estrela -->
          <div style="text-align: center; margin-bottom: 20px; font-size: 48px;">
            ⭐
          </div>

          <!-- Título -->
          <h2 style="
            color: #fff;
            font-size: 28px;
            font-weight: 700;
            text-align: center;
            margin: 0 0 15px 0;
            font-family: 'Orbitron', sans-serif;
            text-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
          ">
            Bem-vindo ao SoundyAI PRO! 🎉
          </h2>

          <!-- Subtítulo -->
          <p style="
            color: #a0a0ff;
            font-size: 16px;
            text-align: center;
            margin: 0 0 30px 0;
            line-height: 1.6;
            font-family: 'Space Grotesk', sans-serif;
          ">
            Agora que você desbloqueou o SoundyAI completo, personalize suas análises e respostas da IA para seu estilo de produção 🎧
          </p>

          <!-- Features list -->
          <div style="
            background: rgba(139, 92, 246, 0.1);
            border: 1px solid rgba(139, 92, 246, 0.2);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
          ">
            <div style="color: #fff; font-size: 14px; margin-bottom: 10px;">
              ✨ Com a personalização você terá:
            </div>
            <ul style="
              color: #d0d0ff;
              font-size: 14px;
              margin: 0;
              padding-left: 20px;
              list-style: none;
            ">
              <li style="margin: 8px 0;">✓ Sugestões da IA adaptadas ao seu nível técnico</li>
              <li style="margin: 8px 0;">✓ Referências específicas para sua DAW</li>
              <li style="margin: 8px 0;">✓ Análises focadas no seu estilo musical</li>
              <li style="margin: 8px 0;">✓ Chatbot que entende suas dificuldades</li>
            </ul>
          </div>

          <!-- Botões -->
          <div style="display: flex; gap: 15px; flex-direction: column;">
            <button id="interviewInviteAccept" style="
              background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
              color: #fff;
              border: none;
              border-radius: 12px;
              padding: 16px 30px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.3s ease;
              box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
              font-family: 'Space Grotesk', sans-serif;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 30px rgba(139, 92, 246, 0.6)';"
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 20px rgba(139, 92, 246, 0.4)';">
              🎯 Personalizar agora
            </button>

            <button id="interviewInviteLater" style="
              background: transparent;
              color: #a0a0ff;
              border: 2px solid rgba(139, 92, 246, 0.3);
              border-radius: 12px;
              padding: 14px 30px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.3s ease;
              font-family: 'Space Grotesk', sans-serif;
            " onmouseover="this.style.borderColor='rgba(139, 92, 246, 0.6)'; this.style.color='#fff';"
               onmouseout="this.style.borderColor='rgba(139, 92, 246, 0.3)'; this.style.color='#a0a0ff';">
              Fazer depois
            </button>
          </div>

          <!-- Nota de rodapé -->
          <p style="
            color: #6b7280;
            font-size: 12px;
            text-align: center;
            margin: 20px 0 0 0;
            font-style: italic;
          ">
            Você pode personalizar sua experiência a qualquer momento acessando seu perfil
          </p>
        </div>
      </div>

      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      </style>
    `;

    // Injetar modal no DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer.firstElementChild);

    log('✅ [INTERVIEW-MODAL] Modal criado e injetado no DOM');

    // Event listeners dos botões
    const acceptBtn = document.getElementById('interviewInviteAccept');
    const laterBtn = document.getElementById('interviewInviteLater');

    acceptBtn.addEventListener('click', async () => {
      log('✅ [INTERVIEW-MODAL] Usuário aceitou - redirecionando para entrevista');
      await dismissInterviewInvite();
      window.location.href = 'entrevista.html';
    });

    laterBtn.addEventListener('click', async () => {
      log('⏭️ [INTERVIEW-MODAL] Usuário escolheu fazer depois');
      await dismissInterviewInvite();
      const modal = document.getElementById('interviewInviteModal');
      modal.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => modal.remove(), 300);
    });

    // Adicionar animação de fadeOut
    const style = document.createElement('style');
    style.textContent = '@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }';
    document.head.appendChild(style);
  }

  /**
   * Inicialização automática quando Firebase estiver pronto
   */
  async function initInterviewInviteSystem() {
    log('🚀 [INTERVIEW-MODAL] Inicializando sistema...');

    // Aguardar Firebase estar pronto
    const waitForFirebase = () => new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (window.auth && window.db && window.firebaseReady) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);

      // Timeout de 10 segundos
      setTimeout(() => {
        clearInterval(checkInterval);
        warn('[INTERVIEW-MODAL] Timeout aguardando Firebase');
        resolve(false);
      }, 10000);
    });

    const firebaseReady = await waitForFirebase();
    if (!firebaseReady) {
      warn('⚠️ [INTERVIEW-MODAL] Firebase não inicializou - sistema abortado');
      return;
    }

    log('✅ [INTERVIEW-MODAL] Firebase pronto');

    // Aguardar autenticação (se houver)
    await new Promise((resolve) => {
      if (window.auth.currentUser) {
        resolve();
      } else {
        const unsubscribe = window.auth.onAuthStateChanged((user) => {
          unsubscribe();
          resolve();
        });
      }
    });

    // Verificar se deve mostrar modal
    const shouldShow = await shouldShowInterviewInvite();
    if (shouldShow) {
      // Aguardar 2 segundos após login para não ser invasivo
      setTimeout(() => {
        showInterviewInviteModal();
      }, 2000);
    } else {
      log('⏭️ [INTERVIEW-MODAL] Modal não será exibido');
    }
  }

  // ✅ EXPOR FUNÇÃO GLOBALMENTE (para testes e debug)
  window.InterviewInvite = {
    shouldShow: shouldShowInterviewInvite,
    show: showInterviewInviteModal,
    dismiss: dismissInterviewInvite,
    init: initInterviewInviteSystem
  };

  // ✅ AUTO-INICIALIZAÇÃO quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInterviewInviteSystem);
  } else {
    initInterviewInviteSystem();
  }

  log('✅ [INTERVIEW-MODAL] Sistema carregado e pronto');
})();
