// auth.js - Versão Corrigida
log('🚀 Carregando auth.js...');

(async () => {
  try {
    // Importações corretas com URLs válidas
    const { auth, db } = await import('./firebase.js');
    
    // Importações Firebase Auth com URLs corretas
    const { 
      RecaptchaVerifier, 
      signInWithPhoneNumber, 
      signInWithEmailAndPassword, 
      createUserWithEmailAndPassword,
      sendPasswordResetEmail, 
      EmailAuthProvider, 
      PhoneAuthProvider, 
      signInWithCredential, 
      linkWithCredential,
      GoogleAuthProvider,
      signInWithPopup
    } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js');
    
    // Importações Firestore
    const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');

    log('✅ Todas as importações carregadas com sucesso');

    // ✅ VARIÁVEIS GLOBAIS - Usar window para garantir persistência
    window.confirmationResult = null;
    window.lastPhone = "";
    window.isNewUserRegistering = false; // ✅ Proteger cadastro em progresso
    window.recaptchaVerifier = null; // 🔥 CORREÇÃO: Mover para window para controle total
    
    // ✅ SMS OBRIGATÓRIO: Ativado para segurança (1 telefone = 1 conta)
    let SMS_VERIFICATION_ENABLED = true; // ⚡ SMS obrigatório no cadastro
    
    // Função para alternar modo SMS (para facilitar reativação)
    window.toggleSMSMode = function(enable = true) {
      SMS_VERIFICATION_ENABLED = enable;
      log('🔄 Modo SMS:', enable ? 'ATIVADO' : 'DESATIVADO');
      showMessage(`Modo SMS ${enable ? 'ativado' : 'desativado'}. Recarregue a página.`, "success");
    };

    // Configuração simplificada (SMS desabilitado temporariamente)
    try {
      log('🔧 Modo de cadastro direto por email ativado (SMS temporariamente desabilitado)');
      
      // Verificar configuração do projeto
      log('🔍 Projeto configurado:', {
        projectId: auth.app.options.projectId,
        authDomain: auth.app.options.authDomain,
        modoSMS: SMS_VERIFICATION_ENABLED ? 'Habilitado' : 'Desabilitado (temporário)'
      });
      
      log('✅ Sistema configurado para cadastro direto');
    } catch (configError) {
      warn('⚠️ Aviso de configuração:', configError);
    }

    // Mensagens de erro em português (focadas em reCAPTCHA v2)
    const firebaseErrorsPt = {
      'auth/invalid-phone-number': 'Número de telefone inválido. Use o formato: 11987654321',
      'auth/missing-phone-number': 'Digite seu número de telefone.',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente em alguns minutos.',
      'auth/quota-exceeded': 'Limite do Firebase atingido. Tente mais tarde.',
      'auth/user-disabled': 'Usuário desativado.',
      'auth/code-expired': 'O código expirou. Solicite um novo.',
      'auth/invalid-verification-code': 'Código de verificação inválido.',
      'auth/captcha-check-failed': 'Falha na verificação reCAPTCHA v2. Complete o desafio.',
      'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
      'auth/app-not-authorized': 'App não autorizado. Configure domínios no Firebase Console.',
      'auth/session-expired': 'Sessão expirada. Tente novamente.',
      'auth/invalid-verification-id': 'Falha na verificação. Tente novamente.',
      'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/user-not-found': 'Usuário não encontrado.',
      'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
      'auth/api-key-not-valid': 'API Key inválida. Verifique configuração Firebase.',
      'auth/invalid-app-credential': 'Configure reCAPTCHA v2 (não Enterprise) no Firebase Console.',
      'auth/recaptcha-not-enabled': 'reCAPTCHA v2 não habilitado. Configure no Firebase Console.',
      'auth/missing-recaptcha-token': 'Complete o reCAPTCHA v2.',
      'auth/invalid-recaptcha-token': 'reCAPTCHA v2 inválido. Tente novamente.',
      'auth/recaptcha-not-supported': 'Use reCAPTCHA v2 em vez de Enterprise.'
    };

    // Função para mostrar mensagens
    function showMessage(messageOrError, type = "error") {
      const msg = typeof messageOrError === 'object' && messageOrError.code
        ? (firebaseErrorsPt[messageOrError.code] || messageOrError.message || 'Erro desconhecido.')
        : messageOrError;

      if (type === "error") {
        error(`${type.toUpperCase()}: ${msg}`);
      } else {
        log(`${type.toUpperCase()}: ${msg}`);
      }

      // Usar as novas funções de status se disponíveis
      if (typeof window.showStatusMessage === 'function') {
        window.showStatusMessage(msg, type === "success" ? "success" : "error");
      } else {
        // Fallback para o sistema antigo
        const el = document.getElementById("error-message");
        if (el) {
          el.innerText = msg;
          el.style.display = "block";
          el.classList.remove("error-message", "success-message");
          el.classList.add(type === "success" ? "success-message" : "error-message");
        } else {
          alert(msg);
        }
      }
    }

    // 🔥 CORREÇÃO DEFINITIVA: Container do reCAPTCHA
    // Garantir que container existe e está VISÍVEL (não criar duplicado)
    function ensureRecaptchaDiv() {
      let recaptchaDiv = document.getElementById('recaptcha-container');
      
      if (!recaptchaDiv) {
        error('❌ ERRO CRÍTICO: Container recaptcha-container não existe no HTML!');
        error('   Verifique se login.html tem <div id="recaptcha-container"></div>');
        return null;
      }
      
      // Limpar conteúdo mas manter container visível
      recaptchaDiv.innerHTML = '';
      
      // 🔥 GARANTIR que container está VISÍVEL
      recaptchaDiv.style.display = 'flex';
      recaptchaDiv.style.justifyContent = 'center';
      recaptchaDiv.style.margin = '24px 0';
      
      log('✅ Container reCAPTCHA pronto e visível');
      return recaptchaDiv;
    }

    // Função para mostrar seção SMS
    function showSMSSection() {
      // ✅ CRÍTICO: GARANTIR SCROLL SEMPRE DESBLOQUEADO
      forceUnlockScroll();
      
      const smsSection = document.getElementById('sms-section');
      if (smsSection) {
        smsSection.style.display = 'block';
        smsSection.scrollIntoView({ behavior: 'smooth' });
      }

      const signUpBtn = document.getElementById('signUpBtn');
      if (signUpBtn) {
        signUpBtn.disabled = true;
        signUpBtn.textContent = 'Código Enviado';
      }
      
      // ✅ Verificar novamente após 100ms (garantir que está desbloqueado)
      setTimeout(() => forceUnlockScroll(), 100);
    }
    
    // ✅ FUNÇÃO AUXILIAR: Forçar desbloqueio de scroll (failsafe)
    function forceUnlockScroll() {
      // Desbloquear body
      document.body.style.overflow = 'auto';
      document.body.style.overflowY = 'auto';
      document.body.style.overflowX = 'hidden';
      document.body.style.position = 'relative';
      
      // Desbloquear html
      document.documentElement.style.overflow = 'auto';
      document.documentElement.style.overflowY = 'auto';
      document.documentElement.style.overflowX = 'hidden';
      
      // Remover classes que possam bloquear scroll
      document.body.classList.remove('modal-open', 'no-scroll', 'scroll-locked');
      document.documentElement.classList.remove('modal-open', 'no-scroll', 'scroll-locked');
      
      log('✅ [SCROLL] Scroll forçado para desbloqueado');
    }

    // Função de login
    async function login() {
      const email = document.getElementById("email")?.value?.trim();
      const password = document.getElementById("password")?.value?.trim();

      if (!email || !password) {
        showMessage("Preencha e-mail e senha.", "error");
        return;
      }

      try {
        showMessage("Entrando...", "success");
        const result = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await result.user.getIdToken();
        localStorage.setItem("user", JSON.stringify({
          uid: result.user.uid,
          email: result.user.email
        }));
        // ✅ Salvar token com chave consistente
        localStorage.setItem("authToken", idToken);
        localStorage.setItem("idToken", idToken); // Manter compatibilidade
        log('✅ [AUTH] Token salvo no localStorage como authToken');
        
        // ═══════════════════════════════════════════════════════════════════
        // 🔥 INICIALIZAR SESSÃO COMPLETA (visitor ID, flags, estado)
        // ═══════════════════════════════════════════════════════════════════
        await initializeSessionAfterSignup(result.user, idToken);

        try {
          const snap = await getDoc(doc(db, 'usuarios', result.user.uid));
          
          if (!snap.exists()) {
            // Usuário não existe no Firestore - criar será feito automaticamente pelo listener
            // Redirecionar direto para index.html (entrevista é premium-only)
            log('✅ [AUTH] Novo usuário - redirecionando para index.html');
            window.location.href = "index.html";
            return;
          }
          
          const userData = snap.data();
          
          // 🔍 DEBUG: Imprimir userData completo para auditoria
          console.log('═════════════════════════════════════════════');
          console.log('🔍 [AUTH-DEBUG] DADOS COMPLETOS DO USUÁRIO:');
          console.log('   UID:', result.user.uid);
          console.log('   Email:', result.user.email);
          console.log('   userData completo:', JSON.stringify(userData, null, 2));
          console.log('═════════════════════════════════════════════');
          console.log('📋 [AUTH-DEBUG] CAMPOS CRÍTICOS DE BYPASS SMS:');
          console.log('   origin:', userData.origin || '(não definido)');
          console.log('   criadoSemSMS:', userData.criadoSemSMS);
          console.log('   authType:', userData.authType || '(não definido)');
          console.log('   hotmartTransactionId:', userData.hotmartTransactionId || '(não definido)');
          console.log('   user.phoneNumber (Firebase Auth):', result.user.phoneNumber || '(null)');
          console.log('═════════════════════════════════════════════');
          
          // ✅ VALIDAÇÃO OBRIGATÓRIA: Decidir pedido de SMS apenas com base no Firestore
          // Como regra: aceitar apenas os campos persistidos em Firestore como decisão final
          const smsVerificado = (userData.verified === true || userData.verificadoPorSMS === true);
          
          // 🔐 BYPASS SMS: Verificar se usuário pode entrar sem SMS
          const isBypassSMS = userData.criadoSemSMS === true || userData.origin === 'hotmart';
          
          // 🔍 AUDITORIA: DECISÃO DE PEDIR SMS
          console.log('[SMS-DECISION] auth.js login() linha ~242');
          console.log('[SMS-DECISION] Auth phoneNumber:', result.user.phoneNumber || 'NULL');
          console.log('[SMS-DECISION] Firestore phoneNumber:', userData.phoneNumber || 'NULL');
          console.log('[SMS-DECISION] Firestore verified:', userData.verified);
          console.log('[SMS-DECISION] Firestore verificadoPorSMS:', userData.verificadoPorSMS);
          console.log('[SMS-DECISION] Firestore criadoSemSMS:', userData.criadoSemSMS);
          console.log('[SMS-DECISION] Firestore origin:', userData.origin);
          console.log('[SMS-DECISION] Computed smsVerificado (from Firestore flags):', smsVerificado);
          console.log('[SMS-DECISION] Computed isBypassSMS:', isBypassSMS);
          console.log('[SMS-DECISION] DECISÃO FINAL:', (!smsVerificado && !isBypassSMS) ? 'BLOQUEAR E PEDIR SMS' : 'PERMITIR LOGIN');
          
          console.log('🔐 [AUTH-DEBUG] VERIFICAÇÃO DE SMS:');
          console.log('   smsVerificado (Firestore verified flags):', smsVerificado);
          console.log('   criadoSemSMS === true:', userData.criadoSemSMS === true);
          console.log('   origin === hotmart:', userData.origin === 'hotmart');
          console.log('   isBypassSMS (pode entrar sem SMS):', isBypassSMS);
          console.log('   Decisão:', (!smsVerificado && !isBypassSMS) ? '❌ BLOQUEIO' : '✅ PERMITE');
          console.log('═════════════════════════════════════════════');
          
          if (!smsVerificado && !isBypassSMS) {
            // Conta criada mas telefone não verificado no Auth - forçar logout
            warn('⚠️ [SEGURANÇA] Login bloqueado - telefone não verificado no Auth');
            warn('   user.phoneNumber:', result.user.phoneNumber);
            warn('   criadoSemSMS:', userData.criadoSemSMS);
            await auth.signOut();
            
            // 🔗 PRESERVAR referralCode antes de limpar localStorage
            const referralCode = localStorage.getItem('soundy_referral_code');
            const referralTimestamp = localStorage.getItem('soundy_referral_timestamp');
            localStorage.clear();
            if (referralCode) {
              localStorage.setItem('soundy_referral_code', referralCode);
              localStorage.setItem('soundy_referral_timestamp', referralTimestamp);
              console.log('🔗 [REFERRAL] Código preservado após logout:', referralCode);
            }
            
            showMessage(
              "❌ Sua conta precisa de verificação por SMS. Complete o cadastro.",
              "error"
            );
            return;
          }
          
          if (smsVerificado) {
            log('✅ [SMS-SYNC] SMS verificado detectado no Auth (user.phoneNumber existe)');
          } else if (isBypassSMS) {
            console.log('═════════════════════════════════════════════');
            console.log('✅ [HOTMART-BYPASS] LOGIN SEM SMS APROVADO');
            console.log('   Motivo: Usuário Hotmart (criadoSemSMS: true ou origin: hotmart)');
            console.log('   UID:', result.user.uid);
            console.log('   Email:', result.user.email);
            console.log('   origin:', userData.origin);
            console.log('   authType:', userData.authType);
            console.log('═════════════════════════════════════════════');
          }
          
          // Prosseguir com navegação normal
          // ✅ NOVO: Entrevista apenas para planos pagos (PRO, STUDIO, DJ)
          const userPlan = userData.plan || 'free';
          const isPaidPlan = ['pro', 'studio', 'dj'].includes(userPlan);
          
          if (userData.entrevistaConcluida === false && isPaidPlan) {
            log(`✅ [AUTH] Plano ${userPlan} - verificando entrevista`);
            window.location.href = "entrevista.html";
          } else {
            log(`✅ [AUTH] Plano ${userPlan} - redirecionando para index.html`);
            window.location.href = "index.html";
          }
        } catch (e) {
          error('❌ Erro ao buscar dados do usuário:', e);
          window.location.href = "entrevista.html";
        }
      } catch (err) {
        error('❌ Erro no login:', err);
        
        let errorMessage = "Erro ao fazer login: ";
        
        // Tratamento específico de erros Firebase para login
        switch (err.code) {
          case 'auth/user-not-found':
            errorMessage = "E-mail não encontrado. Verifique o e-mail ou crie uma conta.";
            break;
          case 'auth/wrong-password':
            errorMessage = "Senha incorreta. Tente novamente ou use 'Esqueci a senha'.";
            break;
          case 'auth/invalid-email':
            errorMessage = "E-mail inválido. Verifique o formato do e-mail.";
            break;
          case 'auth/user-disabled':
            errorMessage = "Esta conta foi desabilitada. Entre em contato com o suporte.";
            break;
          case 'auth/too-many-requests':
            errorMessage = "Muitas tentativas de login. Aguarde alguns minutos.";
            break;
          case 'auth/api-key-not-valid':
            errorMessage = "Erro de configuração. Tente novamente em alguns minutos.";
            break;
          case 'auth/invalid-credential':
            errorMessage = "Credenciais inválidas. Verifique e-mail e senha.";
            break;
          default:
            errorMessage += err.message;
        }
        
        showMessage(errorMessage, "error");
      }
    }

    // Função de recuperação de senha
    async function forgotPassword() {
      const email = document.getElementById("email")?.value?.trim();
      if (!email) {
        showMessage("Digite seu e-mail para recuperar a senha.", "error");
        return;
      }
      try {
        await sendPasswordResetEmail(auth, email);
        showMessage("Link de redefinição enviado para seu e-mail!", "success");
      } catch (err) {
        showMessage(err.message || "Erro ao enviar e-mail", "error");
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🔐 LOGIN COM GOOGLE - Integração completa
    // ═══════════════════════════════════════════════════════════════════
    async function loginWithGoogle() {
      log('🔵 [GOOGLE-AUTH] Iniciando login com Google...');
      
      try {
        showMessage("Abrindo janela de login do Google...", "success");
        
        // Criar provider do Google
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
          prompt: 'select_account'
        });
        
        log('✅ [GOOGLE-AUTH] Provider configurado');
        
        // Executar login com popup
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        log('✅ [GOOGLE-AUTH] Login bem-sucedido:', {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName
        });
        
        // Obter token
        const idToken = await user.getIdToken();
        
        // Salvar token localmente
        localStorage.setItem("authToken", idToken);
        localStorage.setItem("idToken", idToken);
        localStorage.setItem("user", JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName
        }));
        
        log('✅ [GOOGLE-AUTH] Token salvo no localStorage');
        
        // ═══════════════════════════════════════════════════════════════════
        // 🔥 GARANTIR CRIAÇÃO DE DOCUMENTO FIRESTORE (FUNÇÃO CENTRALIZADA)
        // ═══════════════════════════════════════════════════════════════════
        
        try {
          // ✅ USAR FUNÇÃO CENTRALIZADA ensureUserDocument()
          const result = await ensureUserDocument(user, {
            provider: 'google',
            deviceId: 'google_auth_' + Date.now()
          });
          
          if (result.created) {
            log('✅ [GOOGLE-AUTH] Novo usuário - documento criado com plan: "free"');
          } else if (result.updated) {
            log('✅ [GOOGLE-AUTH] Usuário existente - documento atualizado (plan preservado)');
          } else {
            log('✅ [GOOGLE-AUTH] Usuário existente - nenhuma alteração necessária');
          }
          
          // ═══════════════════════════════════════════════════════════════════
          // 🔥 INICIALIZAR SESSÃO COMPLETA
          // ═══════════════════════════════════════════════════════════════════
          await initializeSessionAfterSignup(user, idToken);
          
          showMessage("✅ Login com Google realizado com sucesso!", "success");
          
          // Verificar se precisa ir para entrevista (apenas planos pagos)
          const { doc: docFunc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
          const userDocRef = docFunc(db, 'usuarios', user.uid);
          const userSnap = await getDoc(userDocRef);
          const userData = userSnap.data();
          
          // ✅ NOVO: Entrevista apenas para planos pagos
          const userPlan = userData.plan || 'free';
          const isPaidPlan = ['pro', 'studio', 'dj'].includes(userPlan);
          
          if (userData.entrevistaConcluida === false && isPaidPlan) {
            log(`🎯 [GOOGLE-AUTH] Plano ${userPlan} - redirecionando para entrevista`);
            setTimeout(() => {
              window.location.href = "entrevista.html";
            }, 1500);
          } else {
            log(`🎯 [GOOGLE-AUTH] Plano ${userPlan} - redirecionando para index`);
            setTimeout(() => {
              window.location.href = "index.html";
            }, 1500);
          }
          
        } catch (firestoreError) {
          error('❌ [GOOGLE-AUTH] Erro ao gerenciar Firestore:', firestoreError);
          showMessage("Erro ao salvar dados do usuário. Tente novamente.", "error");
        }
        
      } catch (err) {
        error('❌ [GOOGLE-AUTH] Erro no login com Google:', err);
        
        let errorMessage = "Erro ao fazer login com Google: ";
        
        // Tratamento de erros específicos do Google Auth
        switch (err.code) {
          case 'auth/popup-closed-by-user':
            errorMessage = "Login cancelado. Tente novamente.";
            break;
          case 'auth/popup-blocked':
            errorMessage = "Popup bloqueado pelo navegador. Permita popups e tente novamente.";
            break;
          case 'auth/cancelled-popup-request':
            errorMessage = "Login cancelado. Tente novamente.";
            break;
          case 'auth/account-exists-with-different-credential':
            errorMessage = "Este e-mail já está cadastrado com outro método. Tente fazer login com e-mail e senha.";
            break;
          case 'auth/operation-not-allowed':
            errorMessage = "Login com Google não está habilitado. Entre em contato com o suporte.";
            break;
          case 'auth/unauthorized-domain':
            errorMessage = "Domínio não autorizado. Configure no Firebase Console.";
            break;
          case 'auth/network-request-failed':
            errorMessage = "Falha de conexão. Verifique sua internet.";
            break;
          default:
            errorMessage += err.message;
        }
        
        showMessage(errorMessage, "error");
      }
    }

    // Função de cadastro direto por email (substitui SMS temporariamente)
    async function directEmailSignUp() {
      const email = document.getElementById("email")?.value?.trim();
      const password = document.getElementById("password")?.value?.trim();
      const phone = document.getElementById("phone")?.value?.trim();

      // Validações robustas
      if (!email || !password) {
        showMessage("Preencha e-mail e senha para cadastro.", "error");
        return;
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showMessage("Digite um e-mail válido.", "error");
        return;
      }

      // Validar senha (mínimo 6 caracteres)
      if (password.length < 6) {
        showMessage("A senha deve ter pelo menos 6 caracteres.", "error");
        return;
      }

      if (!phone) {
        showMessage("Digite seu telefone (será salvo no perfil, sem verificação por SMS).", "error");
        return;
      }

      try {
        showMessage("Criando conta...", "success");
        
        // Criar conta diretamente com email e senha
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        
        log('✅ Usuário criado:', user.uid);
        
        // ═══════════════════════════════════════════════════════════════════
        // 🔥 CRÍTICO: NÃO criar Firestore aqui!
        // O listener global onAuthStateChanged criará após auth estabilizar
        // ═══════════════════════════════════════════════════════════════════
        
        // Salvar metadados para listener criar Firestore
        localStorage.setItem('cadastroMetadata', JSON.stringify({
          email: email,
          telefone: phone,
          deviceId: 'direct_signup_' + Date.now(),
          timestamp: new Date().toISOString(),
          criadoSemSMS: true
        }));
        
        log('📌 [DIRECT-SIGNUP] Metadados salvos para criação do Firestore');
        log('   Firestore será criado automaticamente pelo listener global');

        // Obter token
        const idToken = await user.getIdToken();
        
        // ✅ Salvar token com chave consistente
        localStorage.setItem("authToken", idToken);
        localStorage.setItem("idToken", idToken); // Manter compatibilidade
        log('✅ [AUTH] Token salvo no localStorage como authToken');
        
        // Salvar dados localmente
        localStorage.setItem("user", JSON.stringify({
          uid: user.uid,
          email: user.email,
          telefone: phone,
          plano: 'gratis'
        }));
        
        // ═══════════════════════════════════════════════════════════════════
        // 🔥 INICIALIZAR SESSÃO COMPLETA (visitor ID, flags, estado)
        // ═══════════════════════════════════════════════════════════════════
        await initializeSessionAfterSignup(user, idToken);
        
        // 📊 GA4 Tracking: Cadastro completado
        if (window.GATracking?.trackSignupCompleted) {
            window.GATracking.trackSignupCompleted({
                method: 'email',
                plan: 'gratis'
            });
        }

        showMessage("✅ Conta criada com sucesso! Redirecionando...", "success");
        
        // Redirecionar após sucesso
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 2000);

      } catch (err) {
        error('❌ Erro no cadastro direto:', err);
        
        let errorMessage = "Erro ao criar conta: ";
        
        // Tratamento específico de erros Firebase
        switch (err.code) {
          case 'auth/email-already-in-use':
            errorMessage = "Este e-mail já está em uso. Tente fazer login ou use outro e-mail.";
            break;
          case 'auth/invalid-email':
            errorMessage = "E-mail inválido. Verifique o formato do e-mail.";
            break;
          case 'auth/operation-not-allowed':
            errorMessage = "Cadastro por e-mail/senha não está habilitado.";
            break;
          case 'auth/weak-password':
            errorMessage = "Senha muito fraca. Use pelo menos 6 caracteres.";
            break;
          case 'auth/api-key-not-valid':
            errorMessage = "Erro de configuração. Tente novamente em alguns minutos.";
            break;
          case 'auth/too-many-requests':
            errorMessage = "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
            break;
          default:
            errorMessage += error.message;
        }
        
        showMessage(errorMessage, "error");
      }
    }
    function resetSMSState() {
      log('🔄 Resetando estado do SMS...');
      
      // Limpar reCAPTCHA
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
          log('🧹 reCAPTCHA limpo');
        } catch (e) {
          log('⚠️ Erro ao limpar reCAPTCHA:', e);
        }
        window.recaptchaVerifier = null;
      }
      
      // Limpar container DOM
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.innerHTML = '';
      }
      
      // ⚠️ CRÍTICO: NÃO resetar confirmationResult se SMS foi enviado
      // Apenas resetar se realmente necessário (erro antes do envio)
      warn('⚠️ resetSMSState: Mantendo confirmationResult preservado');
      log('   confirmationResult atual:', window.confirmationResult ? 'EXISTE' : 'NULL');
      
      // ✅ NÃO fazer: confirmationResult = null
      // ✅ NÃO fazer: lastPhone = ""
      
      log('✅ Estado resetado (confirmationResult preservado)');
    }

    // Função para enviar SMS
    async function sendSMS(rawPhone) {
      function formatPhone(phone) {
        const clean = phone.replace(/\D/g, '');
        const withoutCountry = clean.replace(/^55/, '');
        return '+55' + withoutCountry;
      }

      const phone = formatPhone(rawPhone);

      // Validação básica do formato
      if (!phone.startsWith('+55') || phone.length < 13 || phone.length > 14) {
        showMessage("Formato inválido. Use: 11987654321 (DDD + número)", "error");
        return false;
      }

      // ✅ VALIDAÇÃO DE UNICIDADE: 1 telefone = 1 conta
      // Verificar se telefone já existe no sistema ANTES de enviar SMS
      try {
        const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
        
        const phoneQuery = query(
          collection(db, 'phone_mappings'),
          where('telefone', '==', phone)
        );
        
        const snapshot = await getDocs(phoneQuery);
        
        if (!snapshot.empty) {
          showMessage(
            "❌ Este telefone já está vinculado a outra conta. Use outro número ou faça login.",
            "error"
          );
          return false;
        }
        
        log('✅ [UNICIDADE] Telefone disponível para cadastro');
      } catch (checkError) {
        error('❌ Erro ao verificar unicidade do telefone:', checkError);
        showMessage(
          "Erro ao validar telefone. Tente novamente.",
          "error"
        );
        return false;
      }

      // 🔥 CORREÇÃO DEFINITIVA: Container do reCAPTCHA
      const container = ensureRecaptchaDiv();
      
      if (!container) {
        error('❌ Container recaptcha-container não existe no HTML!');
        showMessage("ERRO: Container do reCAPTCHA não encontrado. Recarregue a página.", "error");
        return false;
      }

      // 🔥 LIMPAR instância anterior COMPLETAMENTE
      if (window.recaptchaVerifier) {
        try { 
          window.recaptchaVerifier.clear(); 
          log('🧹 reCAPTCHA anterior destruído');
        } catch (e) {
          log('⚠️ Ignorando erro ao limpar:', e.message);
        }
        window.recaptchaVerifier = null;
      }

      // 🔥 AGUARDAR 100ms para garantir DOM está pronto
      await new Promise(resolve => setTimeout(resolve, 100));

      // 🔥 CRIAR RecaptchaVerifier com configuração MÍNIMA
      try {
        log('🔄 Criando RecaptchaVerifier...');
        log('   Container:', container.id);
        log('   Auth pronto:', !!auth);
        
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'normal', // Visível - usuário resolve manualmente
          'callback': (response) => {
            log('✅ reCAPTCHA resolvido pelo usuário');
            log('   Token recebido:', response ? 'SIM' : 'NÃO');
          },
          'expired-callback': () => {
            warn('⏰ reCAPTCHA expirou (3 minutos)');
            showMessage("reCAPTCHA expirou. Resolva novamente.", "error");
          },
          'error-callback': (error) => {
            error('❌ reCAPTCHA erro:', error);
          }
        });

        log('🔄 Renderizando reCAPTCHA (aguarde)...');
        await window.recaptchaVerifier.render();
        log('✅ reCAPTCHA RENDERIZADO COM SUCESSO!');
        
        // ✅ GARANTIR que scroll não travou após render do reCAPTCHA
        forceUnlockScroll();
        
      } catch (renderError) {
        error('❌ Falha ao criar reCAPTCHA:', renderError);
        error('   Código:', renderError.code);
        error('   Mensagem:', renderError.message);
        
        // Limpar estado de falha
        if (window.recaptchaVerifier) {
          try { window.recaptchaVerifier.clear(); } catch (e) {}
          window.recaptchaVerifier = null;
        }
        
        // Mensagem específica baseada no erro
        let userMessage = "Erro ao carregar reCAPTCHA. ";
        
        if (renderError.code === 'auth/invalid-app-credential') {
          userMessage += "Configure reCAPTCHA v2 no Firebase Console.";
        } else if (renderError.code === 'auth/app-not-authorized') {
          userMessage += "Domínio não autorizado. Configure no Firebase Console.";
        } else {
          userMessage += renderError.message;
        }
        
        showMessage(userMessage, "error");
        return false;
      }
      
      // 🔥 AGUARDAR mais 500ms para garantir reCAPTCHA está pronto
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 🔥 ENVIAR SMS apenas após reCAPTCHA COMPLETAMENTE pronto
      let smsSent = false;
      try {
        log('📱 Enviando SMS...');
        log('   Telefone:', phone);
        log('   RecaptchaVerifier:', !!window.recaptchaVerifier);
        
        window.confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
        window.lastPhone = phone;
        
        // ✅ VALIDAR se verificationId existe
        if (!window.confirmationResult || !window.confirmationResult.verificationId) {
          throw new Error('SMS enviado mas confirmationResult inválido');
        }
        
        log('✅ SMS enviado com sucesso');
        log('   verificationId:', window.confirmationResult.verificationId?.substring(0, 20) + '...');
        log('   confirmationResult armazenado em window.confirmationResult');
        
        // ✅ CRÍTICO: DESBLOQUEAR SCROLL IMEDIATAMENTE
        forceUnlockScroll();
        
        // Usar função específica para sucesso do SMS
        if (typeof window.showSMSSuccess === 'function') {
          window.showSMSSuccess();
        } else {
          showMessage("Código SMS enviado! Verifique seu celular.", "success");
        }
        
        showSMSSection();
        smsSent = true;
        
        // ✅ Verificar novamente após 200ms (garantia adicional)
        setTimeout(() => forceUnlockScroll(), 200);
      } catch (smsError) {
        error('❌ Erro ao enviar SMS:', smsError);
        
        // Tratamento específico de erros com soluções
        let errorMessage = "Erro ao enviar SMS. ";
        let canRetry = false;
        
        if (smsError.code) {
          switch (smsError.code) {
            case 'auth/invalid-phone-number':
              errorMessage = "Número inválido. Use formato: +5511987654321";
              break;
            case 'auth/too-many-requests':
              errorMessage = "⚠️ Limite de tentativas atingido. ";
              canRetry = true;
              
              log('🔄 Implementando soluções para too-many-requests...');
              
              // Resetar estado para permitir nova tentativa
              resetSMSState();
              
              // Estratégias de recuperação
              errorMessage += "Soluções disponíveis:\n";
              errorMessage += "1. Aguarde 60 segundos e tente novamente\n";
              errorMessage += "2. Use um número de telefone diferente\n";
              errorMessage += "3. Recarregue a página completamente";
              
              // Criar interface de recuperação
              setTimeout(() => {
                const recoveryDiv = document.createElement('div');
                recoveryDiv.style.cssText = 'margin: 15px 0; padding: 15px; background: #1a1a2e; border: 1px solid #7b2cbf; border-radius: 8px;';
                recoveryDiv.innerHTML = `
                  <h4 style="color: #7b2cbf; margin: 0 0 10px 0;">🔧 Opções de Recuperação:</h4>
                  <button id="retry-60s" style="margin: 5px; padding: 8px 15px; background: #7b2cbf; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    ⏱️ Aguardar 60s e Tentar Novamente
                  </button>
                  <button id="reset-form" style="margin: 5px; padding: 8px 15px; background: #16213e; color: white; border: 1px solid #7b2cbf; border-radius: 4px; cursor: pointer;">
                    🔄 Limpar e Usar Outro Número
                  </button>
                  <button id="reload-page" style="margin: 5px; padding: 8px 15px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    🔄 Recarregar Página
                  </button>
                `;
                
                // Adicionar eventos
                const retryBtn = recoveryDiv.querySelector('#retry-60s');
                const resetBtn = recoveryDiv.querySelector('#reset-form');
                const reloadBtn = recoveryDiv.querySelector('#reload-page');
                
                let countdown = 60;
                retryBtn.onclick = () => {
                  const interval = setInterval(() => {
                    retryBtn.textContent = `⏱️ Aguarde ${countdown}s...`;
                    countdown--;
                    if (countdown < 0) {
                      clearInterval(interval);
                      recoveryDiv.remove();
                      resetSMSState();
                      sendSMS(document.getElementById('phone').value);
                    }
                  }, 1000);
                };
                
                resetBtn.onclick = () => {
                  resetSMSState();
                  recoveryDiv.remove();
                  document.getElementById('phone').value = '';
                  document.getElementById('phone').focus();
                  showMessage("✅ Estado limpo. Digite um número diferente.", "success");
                };
                
                reloadBtn.onclick = () => {
                  window.location.reload();
                };
                
                const container = document.getElementById('sms-section') || document.querySelector('.form-container');
                if (container) {
                  container.appendChild(recoveryDiv);
                }
                
              }, 1000);
              
              break;
            case 'auth/captcha-check-failed':
              errorMessage = "Falha no reCAPTCHA. Recarregue a página e tente novamente.";
              break;
            case 'auth/quota-exceeded':
              errorMessage = "Limite diário de SMS excedido. Tente novamente amanhã ou use email.";
              break;
            case 'auth/app-not-authorized':
              errorMessage = "App não autorizado para este domínio. Configure no Firebase Console.";
              break;
            default:
              errorMessage += `Código: ${smsError.code}`;
          }
        } else {
          errorMessage += smsError.message || "Erro desconhecido.";
        }
        
        showMessage(errorMessage, "error");
      }
      return smsSent;
    }

    // Função de cadastro
    async function signUp() {
      log('🔄 Iniciando processo de cadastro...');
      
      // Verificar se SMS está habilitado ou usar cadastro direto
      if (!SMS_VERIFICATION_ENABLED) {
        log('📧 Usando cadastro direto por email (SMS desabilitado)');
        return await directEmailSignUp();
      }
      
      // Sistema SMS original (quando habilitado)
      log('📱 Usando cadastro com verificação SMS');
      
      const email = document.getElementById("email")?.value?.trim();
      const password = document.getElementById("password")?.value?.trim();
      const rawPhone = document.getElementById("phone")?.value?.trim();

      if (!email || !password || !rawPhone) {
        showMessage("Preencha todos os campos obrigatórios.", "error");
        return;
      }

      // Validações básicas
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showMessage("Digite um e-mail válido.", "error");
        return;
      }

      if (password.length < 6) {
        showMessage("A senha deve ter pelo menos 6 caracteres.", "error");
        return;
      }

      const cleanPhone = rawPhone.replace(/\D/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 11) {
        showMessage("Digite um telefone válido com DDD.", "error");
        return;
      }

      const formattedPhone = '+55' + cleanPhone.replace(/^55/, '');

      // Se já enviou SMS para este telefone, mostrar seção SMS
      if (window.confirmationResult && window.lastPhone === formattedPhone) {
        log('✅ SMS já enviado para este telefone - mostrando seção');
        if (typeof window.showSMSSuccess === 'function') {
          window.showSMSSuccess();
        } else {
          showMessage("Código já enviado! Digite o código recebido.", "success");
        }
        showSMSSection();
        return;
      }

      // Enviar SMS
      isNewUserRegistering = true;
      const sent = await sendSMS(rawPhone);
      if (!sent) {
        isNewUserRegistering = false;
        return;
      }
    }

    // Função para reset de senha (corrige erro do console)
    async function resetPassword() {
      const email = document.getElementById("email")?.value?.trim();
      
      if (!email) {
        showMessage("Digite seu e-mail para recuperar a senha.", "error");
        return;
      }

      try {
        showMessage("Enviando e-mail de recuperação...", "success");
        await sendPasswordResetEmail(auth, email);
        showMessage("E-mail de recuperação enviado! Verifique sua caixa de entrada.", "success");
      } catch (err) {
        error('❌ Erro ao enviar e-mail de recuperação:', err);
        let errorMessage = "Erro ao enviar e-mail de recuperação.";
        
        if (err.code === 'auth/user-not-found') {
          errorMessage = "E-mail não encontrado. Verifique se digitou corretamente.";
        } else if (err.code === 'auth/invalid-email') {
          errorMessage = "E-mail inválido. Digite um e-mail válido.";
        }
        
        showMessage(errorMessage, "error");
      }
    }

    // Função para confirmar código SMS
    async function confirmSMSCode() {
      log('🔐 [CONFIRM] Iniciando confirmação de código SMS...');
      
      // ✅ CRÍTICO: Capturar email do FORMULÁRIO (não do Firebase Auth)
      const formEmail = document.getElementById("email")?.value?.trim();
      const formPassword = document.getElementById("password")?.value?.trim();
      const formPhone = document.getElementById("phone")?.value?.trim();
      const code = document.getElementById("smsCode")?.value?.trim();

      // ✅ VALIDAÇÃO OBRIGATÓRIA: Email e senha devem existir
      if (!formEmail) {
        error('❌ [CONFIRM] Email não preenchido no formulário');
        showMessage("❌ Erro: O campo e-mail está vazio. Preencha novamente.", "error");
        return;
      }
      
      if (!formPassword) {
        error('❌ [CONFIRM] Senha não preenchida no formulário');
        showMessage("❌ Erro: O campo senha está vazio. Preencha novamente.", "error");
        return;
      }
      
      if (!formPhone) {
        error('❌ [CONFIRM] Telefone não preenchido no formulário');
        showMessage("❌ Erro: O campo telefone está vazio. Preencha novamente.", "error");
        return;
      }

      if (!code) {
        showMessage("Digite o código recebido por SMS.", "error");
        return;
      }

      if (code.length !== 6) {
        showMessage("O código deve ter 6 dígitos.", "error");
        return;
      }
      
      // ✅ FORMATAR TELEFONE NO PADRÃO INTERNACIONAL (consistência)
      const cleanPhone = formPhone.replace(/\D/g, '').replace(/^55/, '');
      const formattedPhone = '+55' + cleanPhone;
      
      log('📧 [CONFIRM] Email do formulário:', formEmail);
      log('📱 [CONFIRM] Telefone formatado:', formattedPhone);

      // ✅ VALIDAÇÃO ROBUSTA do confirmationResult
      if (!window.confirmationResult) {
        error('❌ [CONFIRM] window.confirmationResult é NULL');
        showMessage("Erro: Solicite um novo código SMS.", "error");
        return;
      }
      
      if (!window.confirmationResult.verificationId) {
        error('❌ [CONFIRM] verificationId não existe');
        error('   confirmationResult:', window.confirmationResult);
        showMessage("Erro: Sessão de verificação inválida. Solicite novo SMS.", "error");
        return;
      }
      
      log('✅ [CONFIRM] confirmationResult validado com sucesso');
      log('   verificationId:', window.confirmationResult.verificationId.substring(0, 20) + '...');
      log('   código digitado:', code);

      // ═══════════════════════════════════════════════════════════════════
      // 🔐 BLOCO 1: AUTENTICAÇÃO (CRÍTICO - Se falhar, abortar)
      // ═══════════════════════════════════════════════════════════════════
      let userResult = null;
      let freshToken = null;
      let deviceId = null;
      
      try {
        // ✅ Marcar cadastro em progresso
        window.isNewUserRegistering = true;
        localStorage.setItem('cadastroEmProgresso', 'true');
        log('🛡️ [CONFIRM] Cadastro marcado como em progresso');
        
        // ✅ OBTER DEVICE FINGERPRINT antes da autenticação
        try {
          if (window.SoundyFingerprint) {
            const fpData = await window.SoundyFingerprint.get();
            deviceId = fpData.fingerprint_hash;
            log('✅ DeviceID obtido:', deviceId?.substring(0, 16) + '...');
          } else {
            warn('⚠️ SoundyFingerprint não disponível, usando fallback');
            deviceId = 'fp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          }
        } catch (fpError) {
          error('❌ Erro ao obter fingerprint:', fpError);
          deviceId = 'fp_fallback_' + Date.now();
        }
        
        showMessage("Verificando código...", "success");
        
        // ✅ DESBLOQUEAR SCROLL (caso esteja bloqueado)
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';

        // ═══════════════════════════════════════════════════════════════════
        // ✅ FLUXO CORRETO: CRIAR USUÁRIO COM EMAIL PRIMEIRO
        // ═══════════════════════════════════════════════════════════════════
        
        log('📧 [CONFIRM] PASSO 1: Criando usuário com email e senha...');
        log('   Email:', formEmail);
        
        // ✅ PASSO 1: Criar usuário com EMAIL e SENHA
        userResult = await createUserWithEmailAndPassword(auth, formEmail, formPassword);
        log('✅ [CONFIRM] Usuário criado com email:', userResult.user.uid);
        log('   Email verificado:', userResult.user.email);
        
        // ✅ PASSO 2: Confirmar código SMS
        showMessage("📱 Confirmando SMS...", "success");
        log('📱 [CONFIRM] PASSO 2: Confirmando código SMS...');
        log('   Código:', code);
        
        const phoneCredential = PhoneAuthProvider.credential(
          window.confirmationResult.verificationId, 
          code
        );
        
        // ✅ PASSO 3: Vincular TELEFONE ao usuário de EMAIL
        showMessage("🔗 Vinculando telefone...", "success");
        log('🔗 [CONFIRM] PASSO 3: Vinculando telefone ao usuário de email...');
        log('   Telefone:', formattedPhone);
        
        // Usar auth.currentUser conforme padrão (mais robusto)
        await linkWithCredential(auth.currentUser, phoneCredential);
        log('✅ [CONFIRM] Telefone vinculado com sucesso ao email');
        
        // ═══════════════════════════════════════════════════════════════════
        // 🔥 CORREÇÃO CRÍTICA: FORÇAR RELOAD DO USUÁRIO APÓS LINKAGEM
        // ═══════════════════════════════════════════════════════════════════
        // PROBLEMA: linkWithCredential NÃO atualiza imediatamente auth.currentUser
        // SOLUÇÃO: Forçar reload() para obter estado atualizado do Firebase
        // ═══════════════════════════════════════════════════════════════════
        log('🔄 [CONFIRM] PASSO 4: FORÇANDO RELOAD do usuário após linkagem...');
        await auth.currentUser.reload();
        
        // Obter referência atualizada do usuário
        const refreshedUser = auth.currentUser;
        log('✅ [CONFIRM] Usuário recarregado - estado atualizado:');
        log('   UID:', refreshedUser.uid);
        log('   Email:', refreshedUser.email);
        log('   phoneNumber:', refreshedUser.phoneNumber);
        log('   providerData:', refreshedUser.providerData.map(p => p.providerId));
        
        // Validar se telefone foi realmente vinculado
        if (!refreshedUser.phoneNumber) {
          error('❌ [CONFIRM] ERRO CRÍTICO: phoneNumber ainda é null após reload!');
          throw new Error('Telefone não foi vinculado corretamente');
        }
        
        log('✅ [CONFIRM] Verificação PASS: phoneNumber presente:', refreshedUser.phoneNumber);
        
        // Atualizar referência do userResult para usar dados atualizados
        userResult.user = refreshedUser;
        
        // ═══════════════════════════════════════════════════════════════════
        // ✅ PASSO 5: AGUARDAR ESTABILIZAÇÃO DA SESSÃO
        // ═══════════════════════════════════════════════════════════════════
        log('⏳ [CONFIRM] PASSO 5: Aguardando propagação do onAuthStateChanged...');
        
        // Aguardar onAuthStateChanged confirmar atualização (com timeout curto pois já fizemos reload)
        await new Promise((resolve) => {
          const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user && user.uid === refreshedUser.uid && user.phoneNumber) {
              log('✅ [CONFIRM] onAuthStateChanged propagado com phoneNumber:', user.phoneNumber);
              unsubscribe();
              resolve();
            }
          });
          
          // Timeout curto (1 segundo) - já garantimos o estado com reload()
          setTimeout(() => {
            log('⏱️ [CONFIRM] Timeout onAuthStateChanged - continuando (reload já garantiu estado)');
            unsubscribe();
            resolve();
          }, 1000);
        });
        
        // ✅ PASSO 6: Renovar token com estado garantido
        log('🔄 [CONFIRM] PASSO 6: Renovando token...');
        try {
          freshToken = await refreshedUser.getIdToken(true);
          log('✅ [CONFIRM] Token renovado com sucesso');
        } catch (tokenError) {
          warn('⚠️ [CONFIRM] Falha ao renovar token (não crítico):', tokenError.message);
          // Usar token sem forçar refresh
          freshToken = await refreshedUser.getIdToken();
        }
        
        // ✅ AUTENTICAÇÃO COMPLETA - Salvar tokens e metadados IMEDIATAMENTE
        log('💾 [CONFIRM] Salvando tokens de autenticação...');
        log('   UID:', userResult.user.uid);
        log('   Email:', formEmail);
        log('   Telefone (Auth):', userResult.user.phoneNumber); // ✅ Usar phoneNumber do Auth
        
        localStorage.setItem("idToken", freshToken);
        localStorage.setItem("authToken", freshToken);
        localStorage.setItem("user", JSON.stringify({
          uid: userResult.user.uid,
          email: formEmail,
          telefone: userResult.user.phoneNumber // ✅ CRÍTICO: Usar phoneNumber do Firebase Auth
        }));
        
        // ✅ CRÍTICO: Salvar metadados do cadastro para onAuthStateChanged criar Firestore
        localStorage.setItem("cadastroMetadata", JSON.stringify({
          email: formEmail,
          telefone: userResult.user.phoneNumber, // ✅ CRÍTICO: Usar phoneNumber do Firebase Auth
          deviceId: deviceId,
          timestamp: new Date().toISOString()
        }));
        
        log('✅ [CONFIRM] Usuário AUTENTICADO - sessão salva');
        log('📌 [CONFIRM] Metadados salvos para criação do Firestore');
        log('📱 [CONFIRM] Telefone confirmado:', userResult.user.phoneNumber);
        
        // ═══════════════════════════════════════════════════════════════════
        // 🔥 SINCRONIZAR Firestore ANTES de inicializar sessão completa
        // Garantir campos canônicos em inglês (phoneNumber, verified, verifiedAt)
        // e manter campos legacy/PT para compatibilidade.
        try {
          const { doc, updateDoc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
          const userRef = doc(db, 'usuarios', userResult.user.uid);

          // Determinar telefone a ser salvo: preferir o telefone capturado no input (window.lastPhone)
          // Isso garante que salvamos o número que o usuário confirmou, não o estado do Auth (que pode demorar a propagar)
          let phoneToSave = window.lastPhone || null;
          try {
            const meta = localStorage.getItem('cadastroMetadata');
            if (!phoneToSave && meta) {
              const parsed = JSON.parse(meta);
              phoneToSave = parsed?.telefone || parsed?.phoneNumber || phoneToSave;
            }
          } catch (e) {
            // ignorar
          }
          if (!phoneToSave) phoneToSave = userResult.user.phoneNumber || null;

          const updates = {
            phoneNumber: phoneToSave,
            verified: true,
            verifiedAt: serverTimestamp(),
            telefone: phoneToSave,
            verificadoPorSMS: true,
            smsVerificadoEm: serverTimestamp(),
            updatedAt: serverTimestamp()
          };

          // 🔍 AUDITORIA: ESCRITA NO FIRESTORE
          console.log('[FIRESTORE-WRITE usuarios] auth.js confirmSMSCode() linha ~1231');
          console.log('[FIRESTORE-WRITE usuarios] Payload:', updates);
          console.log('[FIRESTORE-WRITE usuarios] UID:', userResult.user.uid);
          
          try {
            await updateDoc(userRef, updates);
            log('✅ [CONFIRM] Firestore atualizado (updateDoc) para verificado');
          } catch (uErr) {
            // Se documento não existir, criar com merge para não sobrescrever campos existentes
            console.warn('[POSSIBLE OVERWRITE usuarios] setDoc merge fallback', new Error().stack);
            try {
              await setDoc(userRef, updates, { merge: true });
              log('✅ [CONFIRM] Firestore criado via setDoc merge com campos de verificação');
            } catch (sErr) {
              throw sErr;
            }
          }
        } catch (syncErr) {
          warn('⚠️ [CONFIRM] Falha ao sincronizar Firestore após confirmação:', syncErr);
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🔥 INICIALIZAR SESSÃO COMPLETA (visitor ID, flags, estado)
        // ═══════════════════════════════════════════════════════════════════
        await initializeSessionAfterSignup(userResult.user, freshToken);
        
      } catch (authError) {
        // ❌ ERRO CRÍTICO DE AUTENTICAÇÃO - Abortar cadastro
        error('❌ [AUTH-ERROR] Falha crítica na autenticação:', authError);
        error('   Código:', authError.code);
        error('   Mensagem:', authError.message);
        
        window.isNewUserRegistering = false;
        localStorage.removeItem('cadastroEmProgresso');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        
        let errorMessage = "❌ Erro ao confirmar código: ";
        
        if (authError.code === 'auth/invalid-verification-code') {
          errorMessage = "❌ Código SMS incorreto. Verifique e tente novamente.";
        } else if (authError.code === 'auth/code-expired') {
          errorMessage = "❌ Código SMS expirou. Solicite um novo.";
        } else if (authError.code === 'auth/session-expired') {
          errorMessage = "❌ Sessão expirou. Recarregue a página e tente novamente.";
        } else if (authError.code === 'auth/email-already-in-use') {
          errorMessage = "❌ Este e-mail já está em uso. Faça login ou use outro e-mail.";
        } else if (authError.code === 'auth/invalid-email') {
          errorMessage = "❌ E-mail inválido. Verifique o formato.";
        } else if (authError.code) {
          errorMessage += firebaseErrorsPt[authError.code] || authError.message;
        } else {
          errorMessage += authError.message;
        }
        
        showMessage(errorMessage, "error");
        return; // ❌ ABORTAR - Autenticação falhou
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // ✅ BLOCO 2: FINALIZAÇÃO (SEMPRE EXECUTAR)
      // ═══════════════════════════════════════════════════════════════════
      // 🔥 IMPORTANTE: A criação do Firestore será feita pelo listener global
      // onAuthStateChanged quando detectar usuário novo sem documento.
      // Isso garante que o auth state esteja completamente estável.
      // ═══════════════════════════════════════════════════════════════════
      
      // Limpar flag de cadastro em progresso
      window.isNewUserRegistering = false;
      localStorage.removeItem('cadastroEmProgresso');
      
      // Desbloquear scroll
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';

      showMessage("✅ Cadastro realizado com sucesso! Redirecionando...", "success");
      
      // ✅ NOVO: Redirecionar para index.html (entrevista é premium-only via modal)
      log('🚀 [CONFIRM] Redirecionando para index.html em 1.5s...');
      log('📌 [CONFIRM] Firestore será criado automaticamente pelo listener global');
      setTimeout(() => {
        window.location.replace("index.html");
      }, 1500);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🔥 FUNÇÃO CENTRALIZADA: Garantir criação de documento Firestore
    // ═══════════════════════════════════════════════════════════════════
    /**
     * Garante que o usuário autenticado tenha um documento no Firestore.
     * Se não existir, cria com todos os campos padrão necessários.
     * 
     * @param {Object} user - Objeto user do Firebase Auth
     * @param {Object} options - Opções adicionais
     * @param {string} options.provider - Método de autenticação ('google', 'email', 'phone')
     * @param {string} options.deviceId - ID do dispositivo (opcional)
     * @param {string} options.referralCode - Código de afiliado (opcional)
     * @returns {Promise<boolean>} - true se criou novo documento, false se já existia
     */
    // ═══════════════════════════════════════════════════════════════════════
    // 🎯 SCHEMA OFICIAL DO USUÁRIO - VERSÃO CORRIGIDA 2026-02-02
    // ═══════════════════════════════════════════════════════════════════════
    // REGRAS OBRIGATÓRIAS:
    // 1. Apenas campos em INGLÊS (campos em português são legacy)
    // 2. Campo de plano oficial: "plan" (valores: "free" | "plus" | "pro" | "studio")
    // 3. Primeiro login SEMPRE cria com plan: "free"
    // 4. Upgrade de plano APENAS via fluxo de pagamento (Stripe/Hotmart)
    // 5. Login NUNCA altera plan de usuário existente
    // 6. Não criar campos aleatórios não previstos no schema
    // ═══════════════════════════════════════════════════════════════════════
    
    const USER_SCHEMA_ALLOWED_FIELDS = [
      // Identificação
      'uid', 'email', 'displayName', 'phoneNumber', 'deviceId', 'authType',
      
      // Plano (APENAS EM INGLÊS)
      'plan', // ✅ Campo oficial (valores: "free" | "plus" | "pro" | "studio")
      'freeAnalysesRemaining', // ✅ Trial: 1 análise full gratuita
      'reducedMode', // ✅ Modo reduzido (métricas borradas após trial)
      
      // Limites e contadores
      'messagesToday', 'analysesToday', 'messagesMonth', 'analysesMonth', 'imagesMonth',
      'billingMonth', 'lastResetAt',
      
      // Status e verificações
      'verified', 'verifiedAt', 'bypassSMS', 'onboardingCompleted',
      
      // Sistema de afiliados
      'visitorId', 'referralCode', 'referralTimestamp', 'convertedAt', 'firstPaidPlan',
      
      // Assinaturas (expiração de planos pagos)
      'plusExpiresAt', 'proExpiresAt', 'studioExpiresAt',
      
      // ✅ ATTRIBUTION DATA (UTMs, GCLID, Anonymous ID)
      'anon_id', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'gclid', 'first_seen_attribution',
      
      // Metadata e origem
      'origin', 'createdAt', 'updatedAt', 'lastLoginAt',
      
      // Beta/legado (manter compatibilidade temporária)
      'djExpiresAt', 'djExpired'
    ];
    
    const DEFAULT_USER_DOCUMENT = {
      // Identificação (preenchido dinamicamente)
      uid: null,
      email: null,
      displayName: null,
      phoneNumber: null,
      deviceId: null,
      authType: 'unknown',
      
      // ✅ PLANO PADRÃO: SEMPRE "free" NO PRIMEIRO LOGIN
      plan: 'free',
      freeAnalysesRemaining: 1,  // Trial de 1 análise full
      reducedMode: false,        // Começa em modo completo
      
      // Limites e contadores (resetados mensalmente)
      messagesToday: 0,
      analysesToday: 0,
      messagesMonth: 0,
      analysesMonth: 0,
      imagesMonth: 0,
      billingMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
      lastResetAt: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
      
      // Status e verificações
      verified: false,
      verifiedAt: null,
      bypassSMS: false,
      onboardingCompleted: false,
      
      // Sistema de afiliados
      visitorId: null,
      referralCode: null,
      referralTimestamp: null,
      convertedAt: null,
      firstPaidPlan: null,
      
      // Assinaturas (null = plano não adquirido)
      plusExpiresAt: null,
      proExpiresAt: null,
      studioExpiresAt: null,
      
      // Metadata
      origin: 'direct_signup',
      createdAt: null, // serverTimestamp()
      updatedAt: null, // serverTimestamp()
      lastLoginAt: null // serverTimestamp()
    };

    /**
     * 🔐 FUNÇÃO CENTRALIZADA: Garantir documento do usuário no Firestore
     * 
     * COMPORTAMENTO:
     * - Se documento NÃO existe: cria com DEFAULT_USER_DOCUMENT (plan: "free")
     * - Se documento JÁ existe: NÃO altera plan, apenas garante campos mínimos
     * 
     * REGRAS:
     * 1. NUNCA setar plan como "pro"/"plus"/"studio" no login
     * 2. Upgrade de plano APENAS via webhook de pagamento
     * 3. Validar campos contra whitelist (USER_SCHEMA_ALLOWED_FIELDS)
     * 4. Remover campos legacy em português (plano, creditos, etc)
     * 
     * @param {Object} user - Objeto user do Firebase Auth
     * @param {Object} options - Opções adicionais
     * @param {string} options.provider - Método de autenticação ('google', 'email', 'phone')
     * @param {string} options.deviceId - ID do dispositivo (opcional)
     * @param {string} options.referralCode - Código de afiliado (opcional)
     * @returns {Promise<{created: boolean, updated: boolean}>}
     */
    async function ensureUserDocument(user, options = {}) {
      if (!user || !user.uid) {
        error('❌ [ENSURE-USER] user ou user.uid é inválido');
        return { created: false, updated: false };
      }

      const {
        provider = 'unknown',
        deviceId = null,
        referralCode = null
      } = options;

      log('🔍 [ENSURE-USER] Verificando documento Firestore para:', user.uid);
      log('   Email:', user.email);
      log('   Telefone:', user.phoneNumber);
      log('   Provider:', provider);

      try {
        // Importar Firestore dinamicamente
        const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
        
        const userRef = doc(db, 'usuarios', user.uid);
        const userSnap = await getDoc(userRef);
        
        // ═══════════════════════════════════════════════════════════════════
        // CASO 1: DOCUMENTO JÁ EXISTE - APENAS GARANTIR CAMPOS MÍNIMOS
        // ═══════════════════════════════════════════════════════════════════
        if (userSnap.exists()) {
          log('✅ [ENSURE-USER] Documento já existe');
          
          const existingData = userSnap.data();
          log('   Plan atual:', existingData.plan || existingData.plano || 'não definido');
          
          // 🔄 Atualizar apenas lastLoginAt (sem alterar plan)
          const updates = {
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          
          // 🔧 MIGRAÇÃO: Se existe "plano" (PT) mas não existe "plan" (EN), migrar
          if (existingData.plano && !existingData.plan) {
            const legacyPlanMap = {
              'gratis': 'free',
              'plus': 'plus',
              'pro': 'pro',
              'studio': 'studio',
              'dj': 'dj'
            };
            updates.plan = legacyPlanMap[existingData.plano] || 'free';
            log('🔄 [MIGRAÇÃO] Convertendo plano PT → EN:', existingData.plano, '→', updates.plan);
          }
          
          // ✅ Garantir campos mínimos ausentes (sem sobrescrever existentes)
          const missingFields = {};
          if (!existingData.plan && !existingData.plano) missingFields.plan = 'free';
          if (typeof existingData.freeAnalysesRemaining !== 'number') missingFields.freeAnalysesRemaining = 1;
          if (typeof existingData.reducedMode !== 'boolean') missingFields.reducedMode = false;
          if (!existingData.messagesToday) missingFields.messagesToday = 0;
          if (!existingData.analysesToday) missingFields.analysesToday = 0;
          if (!existingData.messagesMonth) missingFields.messagesMonth = 0;
          if (!existingData.analysesMonth) missingFields.analysesMonth = 0;
          if (!existingData.imagesMonth) missingFields.imagesMonth = 0;
          if (!existingData.billingMonth) missingFields.billingMonth = new Date().toISOString().slice(0, 7);
          if (!existingData.lastResetAt) missingFields.lastResetAt = new Date().toISOString().slice(0, 10);
          
          if (Object.keys(missingFields).length > 0) {
            log('🔧 [ENSURE-USER] Adicionando campos ausentes:', Object.keys(missingFields));
            Object.assign(updates, missingFields);
          }
          
          // 🔍 AUDITORIA: ESCRITA NO FIRESTORE
          console.log('[FIRESTORE-WRITE usuarios] auth.js ensureUserDocument() linha ~1507');
          console.log('[FIRESTORE-WRITE usuarios] Operação: updateDoc (preserva campos)');
          console.log('[FIRESTORE-WRITE usuarios] Updates:', updates);
          
          await updateDoc(userRef, updates);
          log('✅ [ENSURE-USER] Documento atualizado (plan preservado)');
          
          return { created: false, updated: true };
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // CASO 2: DOCUMENTO NÃO EXISTE - CRIAR COM DEFAULTS CORRETOS
        // ═══════════════════════════════════════════════════════════════════
        log('📝 [ENSURE-USER] Documento não existe - criando com plan: "free"');
        
        // Tentar obter deviceId de diferentes fontes
        let finalDeviceId = deviceId;
        if (!finalDeviceId) {
          const metadataStr = localStorage.getItem('cadastroMetadata');
          if (metadataStr) {
            try {
              const metadata = JSON.parse(metadataStr);
              finalDeviceId = metadata.deviceId;
            } catch (e) {
              // Ignorar erro de parse
            }
          }
          
          // Fallback: gerar novo
          if (!finalDeviceId) {
            if (window.SoundyFingerprint) {
              try {
                const fpData = await window.SoundyFingerprint.get();
                finalDeviceId = fpData.fingerprint_hash;
              } catch (fpError) {
                finalDeviceId = 'fp_fallback_' + Date.now();
              }
            } else {
              finalDeviceId = 'fp_fallback_' + Date.now();
            }
          }
        }
        
        // Obter referralCode e visitorId do localStorage (sistema de afiliados)
        const visitorId = localStorage.getItem('soundy_visitor_id') || null;
        const storedReferralCode = referralCode || localStorage.getItem('soundy_referral_code') || null;
        const referralTimestamp = localStorage.getItem('soundy_referral_timestamp') || null;
        
        // ✅ NOVO: Capturar UTMs e GCLID do localStorage (tracking.js)
        const utm_source = localStorage.getItem('soundy_utm_source') || null;
        const utm_medium = localStorage.getItem('soundy_utm_medium') || null;
        const utm_campaign = localStorage.getItem('soundy_utm_campaign') || null;
        const utm_term = localStorage.getItem('soundy_utm_term') || null;
        const utm_content = localStorage.getItem('soundy_utm_content') || null;
        const gclid = localStorage.getItem('soundy_gclid') || null;
        const first_seen = localStorage.getItem('soundy_first_seen') || null;
        const landing_page = localStorage.getItem('soundy_landing_page') || null;
        const first_referrer = localStorage.getItem('soundy_referrer') || null;
        const anon_id = localStorage.getItem('soundy_anon_id') || null;
        
        // Determinar verificação SMS
        const bypassSMS = provider === 'google' || provider === 'email';
        const verified = !!user.phoneNumber;
        
        // Nome do usuário
        const displayName = user.displayName || user.email?.split('@')[0] || 'User';
        
        log('📋 [ENSURE-USER] Dados do novo documento:');
        log('   Email:', user.email);
        log('   Nome:', displayName);
        log('   Telefone:', user.phoneNumber || '(none)');
        log('   Provider:', provider);
        log('   DeviceID:', finalDeviceId?.substring(0, 16) + '...');
        log('   Plan:', 'free'); // ✅ SEMPRE "free" no primeiro login
        log('   bypassSMS:', bypassSMS);
        log('   verified:', verified);
        log('   referralCode:', storedReferralCode || '(none)');
        log('   visitorId:', visitorId?.substring(0, 16) + '...' || '(none)');
        log('   🎯 Attribution (UTMs):', { utm_source, utm_medium, utm_campaign, gclid: gclid?.substring(0, 10) + '...' || '(none)' });
        log('   🎯 Anonymous ID:', anon_id?.substring(0, 20) + '...' || '(none)');
        
        // ✅ CRIAR DOCUMENTO COM SCHEMA OFICIAL (APENAS CAMPOS EM INGLÊS)
        const newUserDoc = {
          // Identificação
          uid: user.uid,
          email: user.email || '',
          displayName: displayName,
          // Não derivar phoneNumber de auth.user.phoneNumber nesta etapa
          // Para evitar race condition, criar sempre com phoneNumber null
          phoneNumber: null,
          deviceId: finalDeviceId,
          authType: provider,
          
          // ✅ PLANO: SEMPRE "free" NO PRIMEIRO LOGIN
          plan: 'free',
          
          // ✅ SISTEMA DE TRIAL
          freeAnalysesRemaining: 1,  // Trial de 1 análise full
          reducedMode: false,        // Começa em modo completo
          
          // Limites e contadores
          messagesToday: 0,
          analysesToday: 0,
          messagesMonth: 0,
          analysesMonth: 0,
          imagesMonth: 0,
          billingMonth: new Date().toISOString().slice(0, 7),
          lastResetAt: new Date().toISOString().slice(0, 10),
          
          // Status e verificações
          // NÃO derivar verified do Auth no momento da criação do documento
          // Criar sempre como não verificado; confirmação SMS é a única fonte
          verified: false,
          verifiedAt: null,
          bypassSMS: bypassSMS,
          onboardingCompleted: false,
          
          // Sistema de afiliados
          visitorId: visitorId,
          referralCode: storedReferralCode,
          referralTimestamp: referralTimestamp,
          convertedAt: null,
          firstPaidPlan: null,
          
          // Assinaturas (null = não adquirido)
          plusExpiresAt: null,
          proExpiresAt: null,
          studioExpiresAt: null,
          
          // ✅ ATTRIBUTION DATA (UTMs e GCLID do tracking.js)
          anon_id: anon_id,
          utm_source: utm_source,
          utm_medium: utm_medium,
          utm_campaign: utm_campaign,
          utm_term: utm_term,
          utm_content: utm_content,
          gclid: gclid,
          first_seen_attribution: first_seen ? {
            timestamp: first_seen,
            landing_page: landing_page,
            referrer: first_referrer
          } : null,
          
          // Metadata
          origin: provider === 'google' ? 'google_auth' : 'direct_signup',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp()
        };
        
        // 🔒 VALIDAÇÃO: Filtrar apenas campos permitidos (whitelist)
        const validatedDoc = {};
        for (const [key, value] of Object.entries(newUserDoc)) {
          if (USER_SCHEMA_ALLOWED_FIELDS.includes(key)) {
            validatedDoc[key] = value;
          } else {
            warn('⚠️ [ENSURE-USER] Campo não permitido ignorado:', key);
          }
        }
        
        // 🔍 AUDITORIA: ESCRITA NO FIRESTORE (CRIAÇÃO)
        console.log('[FIRESTORE-WRITE usuarios] auth.js ensureUserDocument() linha ~1659');
        console.log('[FIRESTORE-WRITE usuarios] Operação: setDoc (criação nova)');
        console.log('[FIRESTORE-WRITE usuarios] Payload completo:', validatedDoc);
        console.warn('[POSSIBLE OVERWRITE usuarios] setDoc criação de documento novo', new Error().stack);
        
        await setDoc(userRef, validatedDoc);
        
        log('✅ [ENSURE-USER] Documento criado com sucesso!');
        log('   UID:', user.uid);
        log('   Plan:', validatedDoc.plan); // ✅ Sempre "free"
        log('   Campos criados:', Object.keys(validatedDoc).length);
        
        // Limpar metadados após criação
        localStorage.removeItem('cadastroMetadata');
        
        // 📊 GA4 Tracking: Cadastro completado
        if (window.GATracking?.trackSignupCompleted) {
          window.GATracking.trackSignupCompleted({
            method: provider,
            plan: 'free' // ✅ Sempre "free"
          });
        }
        
        return { created: true, updated: false };
        
      } catch (err) {
        error('❌ [ENSURE-USER] Erro ao garantir documento:', err);
        error('   UID:', user.uid);
        error('   Stack:', err.stack);
        throw err;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🔐 FUNÇÃO AUXILIAR: Inicializar sessão completa após cadastro
    // ═══════════════════════════════════════════════════════════════════
    async function initializeSessionAfterSignup(user, freshToken) {
      log('🔐 [SESSION] Inicializando sessão completa após cadastro...');
      
      try {
        // 1️⃣ Marcar autenticação como pronta
        window.__AUTH_READY__ = true;
        localStorage.setItem('hasAuthToken', 'true');
        log('✅ [SESSION] Estado de autenticação marcado como pronto');
        
        // 2️⃣ Garantir que o token está salvo
        localStorage.setItem("idToken", freshToken);
        localStorage.setItem("authToken", freshToken);
        log('✅ [SESSION] Token revalidado e salvo');
        
        // 3️⃣ Inicializar Visitor ID se não existir
        let visitorId = localStorage.getItem('visitorId');
        if (!visitorId) {
          // Tentar obter via FingerprintJS se disponível
          if (window.SoundyFingerprint) {
            try {
              const fpData = await window.SoundyFingerprint.get();
              visitorId = fpData.fingerprint_hash;
              log('✅ [SESSION] Visitor ID obtido via FingerprintJS');
            } catch (fpError) {
              warn('⚠️ [SESSION] Erro ao obter fingerprint, gerando fallback');
              visitorId = 'fp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            }
          } else {
            // Gerar visitor ID simples
            visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            log('✅ [SESSION] Visitor ID gerado (fallback)');
          }
          
          localStorage.setItem('visitorId', visitorId);
          log('✅ [SESSION] Visitor ID salvo:', visitorId.substring(0, 16) + '...');
        } else {
          log('✅ [SESSION] Visitor ID já existe:', visitorId.substring(0, 16) + '...');
        }
        
        // 4️⃣ Salvar UID para referência rápida
        localStorage.setItem('currentUserId', user.uid);
        log('✅ [SESSION] UID salvo para referência rápida:', user.uid);
        
        // 5️⃣ Marcar modo autenticado
        localStorage.setItem('chatMode', 'authenticated');
        localStorage.removeItem('anonymousMode'); // Remover flag anônimo se existir
        log('✅ [SESSION] Modo de chat definido como: authenticated');
        
        // 6️⃣ Desativar modo anônimo explicitamente
        if (window.SoundyAnonymous && typeof window.SoundyAnonymous.deactivate === 'function') {
          window.SoundyAnonymous.deactivate();
          log('✅ [SESSION] Modo anônimo desativado (SoundyAnonymous.deactivate)');
        }
        
        log('🎉 [SESSION] Sessão completa inicializada com sucesso!');
        log('   UID:', user.uid);
        log('   Token válido: sim');
        log('   Visitor ID: sim');
        log('   Modo: authenticated');
        
        return true;
      } catch (sessionError) {
        error('❌ [SESSION] Erro ao inicializar sessão:', sessionError);
        return false;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // �🔐 FUNÇÃO DE LOGOUT ROBUSTA - LIMPEZA COMPLETA DE ESTADO
    // ═══════════════════════════════════════════════════════════════════
    async function logout() {
      log('🔓 [LOGOUT] Iniciando processo de logout completo...');
      
      try {
        // 1️⃣ SIGNOUT DO FIREBASE
        if (auth && typeof auth.signOut === 'function') {
          await auth.signOut();
          log('✅ [LOGOUT] Firebase signOut executado');
        }
      } catch (e) {
        warn('⚠️ [LOGOUT] Erro no Firebase signOut (continuando limpeza):', e.message);
      }
      
      // 2️⃣ LIMPAR TODO O LOCALSTORAGE DE AUTH
      const keysToRemove = [
        'user',
        'idToken',
        'authToken',
        'firebase:authUser',
        'soundy_user_profile',
        'soundy_auth_state',
        'currentUserData'
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      // Limpar também chaves que começam com firebase:
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (key.startsWith('firebase:')) {
          localStorage.removeItem(key);
          log('🗑️ [LOGOUT] Removido:', key);
        }
      });
      
      log('✅ [LOGOUT] localStorage limpo');
      
      // 3️⃣ LIMPAR SESSIONSTORAGE
      sessionStorage.clear();
      log('✅ [LOGOUT] sessionStorage limpo');
      
      // 4️⃣ RESETAR VARIÁVEIS GLOBAIS DE AUTH
      if (window.auth) {
        // Firebase auth continua existindo mas sem currentUser
        log('✅ [LOGOUT] window.auth.currentUser:', window.auth.currentUser);
      }
      
      // Limpar qualquer referência global a token/user
      window.currentUserToken = null;
      window.currentUserData = null;
      window.cachedIdToken = null;
      
      // 5️⃣ FORÇAR MODO ANÔNIMO (se voltando para index)
      if (window.SoundyAnonymous) {
        window.SoundyAnonymous.isAnonymousMode = true;
        window.SoundyAnonymous.forceCleanState = true;
        log('✅ [LOGOUT] Modo anônimo forçado para próximo acesso');
      }
      
      log('🔓 [LOGOUT] Processo de logout COMPLETO');
      
      // 6️⃣ REDIRECIONAR
      window.location.href = "login.html";
    }

    // Verificar estado de autenticação
    function checkAuthState() {
      return new Promise((resolve) => {
        const timeout = setTimeout(async () => {
          const isLoginPage = window.location.pathname.includes("login.html");
          const isIndexPage = window.location.pathname.includes("index.html") || 
                              window.location.pathname === '/' || 
                              window.location.pathname === '';
          const isDemoPage = window.location.pathname.includes("/demo") || 
                             window.location.search.includes("mode=demo");
          
          // 🔥 MODO DEMO: Permitir acesso sem login (ativado pelo demo-core.js)
          if (isDemoPage) {
            log('🔥 [AUTH] Timeout - Página demo detectada, permitindo acesso');
            resolve(null);
            return;
          }
          
          // 🔓 MODO ANÔNIMO: DESATIVADO 2026-02-02 - Forçar login obrigatório
          // ✅ Para reativar: descomente o bloco abaixo
          /*
          if (isIndexPage) {
            // ✅ VALIDAR SE HÁ SESSÃO AUTENTICADA ANTES DE ATIVAR ANÔNIMO
            const hasIdToken = localStorage.getItem('idToken');
            const hasAuthToken = localStorage.getItem('authToken');
            const hasUser = localStorage.getItem('user');
            const hasAuthReady = window.__AUTH_READY__ === true;
            
            if (hasIdToken || hasAuthToken || hasUser || hasAuthReady) {
              log('⏳ [AUTH] Timeout mas sessão válida existe - aguardando Firebase Auth');
              log('   hasIdToken:', !!hasIdToken);
              log('   hasAuthToken:', !!hasAuthToken);
              log('   hasUser:', !!hasUser);
              log('   __AUTH_READY__:', hasAuthReady);
              resolve(null);
              return;
            }
            
            // Após 5s de timeout, SoundyAnonymous deve estar disponível
            if (window.SoundyAnonymous && window.SoundyAnonymous.isEnabled) {
              log('🔓 [AUTH] Timeout - Nenhuma sessão válida - Ativando modo anônimo');
              await window.SoundyAnonymous.activate();
              resolve(null);
              return;
            } else {
              error('❌ [AUTH] Timeout - SoundyAnonymous não disponível após 5s');
              log('   window.SoundyAnonymous:', window.SoundyAnonymous);
            }
          }
          */
          
          if (!isLoginPage) window.location.href = "login.html";
          resolve(null);
        }, 5000);

        auth.onAuthStateChanged(async (user) => {
          clearTimeout(timeout);
          const isLoginPage = window.location.pathname.includes("login.html");
          const isEntrevistaPage = window.location.pathname.includes("entrevista.html");
          const isIndexPage = window.location.pathname.includes("index.html") || 
                              window.location.pathname === '/' || 
                              window.location.pathname === '';
          const isDemoPage = window.location.pathname.includes("/demo") || 
                             window.location.search.includes("mode=demo");

          // ✅ BUG #2 FIX: Proteger cadastro em progresso
          if (window.isNewUserRegistering && isEntrevistaPage) {
            log('🛡️ [AUTH] Cadastro em progresso detectado - permitindo acesso');
            window.isNewUserRegistering = false;
            localStorage.removeItem('cadastroEmProgresso');
            resolve(user);
            return;
          }

          if (!user && !isLoginPage) {
            // 🔥 MODO DEMO: Permitir acesso sem login
            if (isDemoPage) {
              log('🔥 [AUTH] Usuário não logado na página demo - permitindo acesso');
              resolve(null);
              return;
            }
            
            // 🔓 MODO ANÔNIMO: DESATIVADO 2026-02-02 - Forçar login obrigatório
            // ✅ Para reativar: descomente o bloco abaixo
            /*
            if (isIndexPage) {
              // ✅ VALIDAR SE HÁ SESSÃO AUTENTICADA ANTES DE ATIVAR ANÔNIMO
              const hasIdToken = localStorage.getItem('idToken');
              const hasAuthToken = localStorage.getItem('authToken');
              const hasUser = localStorage.getItem('user');
              const hasAuthReady = window.__AUTH_READY__ === true;
              
              if (hasIdToken || hasAuthToken || hasUser || hasAuthReady) {
                log('⏳ [AUTH] onAuthStateChanged: Sessão válida existe mas user null');
                log('   hasIdToken:', !!hasIdToken);
                log('   hasAuthToken:', !!hasAuthToken);
                log('   hasUser:', !!hasUser);
                log('   __AUTH_READY__:', hasAuthReady);
                log('   Aguardando 2s antes de recarregar...');
                
                setTimeout(() => {
                  log('🔄 [AUTH] Recarregando para sincronizar Firebase Auth...');
                  window.location.reload();
                }, 2000);
                return;
              }
              
              // Função auxiliar para aguardar SoundyAnonymous
              const waitForAnonymousMode = () => new Promise((resolveWait) => {
                // Se já existe, usar imediatamente
                if (window.SoundyAnonymous && window.SoundyAnonymous.isEnabled) {
                  resolveWait(true);
                  return;
                }
                
                // Aguardar até 2 segundos para o script carregar
                let attempts = 0;
                const maxAttempts = 40; // 40 x 50ms = 2000ms
                const checkInterval = setInterval(() => {
                  attempts++;
                  if (window.SoundyAnonymous && window.SoundyAnonymous.isEnabled) {
                    clearInterval(checkInterval);
                    resolveWait(true);
                  } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    warn('⚠️ [AUTH] Timeout aguardando SoundyAnonymous');
                    resolveWait(false);
                  }
                }, 50);
              });
              
              const anonymousAvailable = await waitForAnonymousMode();
              
              if (anonymousAvailable) {
                log('🔓 [AUTH] Usuário não logado no index - Nenhuma sessão válida - Ativando modo anônimo');
                await window.SoundyAnonymous.activate();
                resolve(null);
                return;
              }
            }
            */
            
            window.location.href = "login.html";
          } else if (user && isLoginPage) {
            // 🔓 MODO ANÔNIMO: Desativar se estava ativo
            if (window.SoundyAnonymous && window.SoundyAnonymous.isAnonymousMode) {
              window.SoundyAnonymous.deactivate();
            }
            
            try {
              const snap = await getDoc(doc(db, 'usuarios', user.uid));
              if (snap.exists()) {
                const userData = snap.data();
                const userPlan = userData.plan || 'free';
                const isPaidPlan = ['pro', 'studio', 'dj'].includes(userPlan);
                
                // ✅ NOVO: Entrevista apenas para planos pagos não concluídos
                if (userData.entrevistaConcluida === false && isPaidPlan) {
                  log(`✅ [AUTH-STATE] Plano ${userPlan} - redirecionando para entrevista`);
                  window.location.href = "entrevista.html";
                } else {
                  log(`✅ [AUTH-STATE] Plano ${userPlan} - redirecionando para index.html`);
                  window.location.href = "index.html";
                }
              } else {
                // Documento não existe - ir para index (será criado automaticamente)
                log('✅ [AUTH-STATE] Documento não existe - redirecionando para index.html');
                window.location.href = "index.html";
              }
            } catch (e) {
              error('❌ [AUTH-STATE] Erro ao verificar usuário:', e);
              window.location.href = "index.html";
            }
          } else if (user) {
            // ✅ USUÁRIO AUTENTICADO - Validar Firestore
            log('✅ [AUTH] Usuário autenticado:', user.uid);
            
            // 🔓 MODO ANÔNIMO: Desativar se usuário autenticou
            if (window.SoundyAnonymous && window.SoundyAnonymous.isAnonymousMode) {
              window.SoundyAnonymous.deactivate();
            }
            
            // ✅ VALIDAÇÃO CRÍTICA: Verificar se telefone foi confirmado
            try {
              const userSnap = await getDoc(doc(db, 'usuarios', user.uid));
              
              if (!userSnap.exists()) {
                // ⚠️ DOCUMENTO NÃO EXISTE: Pode ser race condition (Firestore ainda não sincronizou)
                warn('⚠️ [AUTH] Documento Firestore não encontrado para:', user.uid);
                warn('⚠️ [AUTH] Isso pode ser normal logo após cadastro (race condition)');
                
                // ✅ NÃO DESLOGAR - Permitir acesso temporariamente
                // O Firestore pode levar alguns segundos para sincronizar
                log('✅ [AUTH] Permitindo acesso (Firestore pode estar sincronizando)');
                resolve(user);
                return;
              }
              
              const userData = userSnap.data();
              
              // ✅ BUG #2 FIX: Não validar telefone se cadastro ainda em progresso
              const cadastroEmProgresso = localStorage.getItem('cadastroEmProgresso') === 'true';
              if (cadastroEmProgresso) {
                log('🛡️ [AUTH] Cadastro em progresso - pulando validação de telefone');
                resolve(user);
                return;
              }
              
              // ✅ VALIDAÇÃO INFORMATIVA: Verificar SMS (NÃO BLOQUEIA ACESSO)
              // REGRA: auth.currentUser.phoneNumber é a ÚNICA fonte de verdade
              // Campo verificadoPorSMS no Firestore é APENAS informativo
              const smsVerificado = !!user.phoneNumber;
              
              // 📊 LOGGING INFORMATIVO (NÃO BLOQUEIA)
              if (!smsVerificado && !userData.criadoSemSMS) {
                warn('⚠️ [INFO] Telefone não verificado no Auth (mas acesso permitido)');
                warn('   user.phoneNumber:', user.phoneNumber);
                warn('   criadoSemSMS:', userData.criadoSemSMS);
                warn('   ✅ Usuário autenticado - acesso PERMITIDO');
              }
              
              log('✅ [AUTH] Validação completa - acesso permitido');
              log('   SMS verificado (Auth):', smsVerificado);
              log('   user.phoneNumber:', user.phoneNumber);
              log('   criadoSemSMS:', userData.criadoSemSMS);
              
              // 🎧 BETA DJS: Verificar se o plano DJ expirou e exibir modal
              if (userData.djExpired === true && !sessionStorage.getItem('betaDjModalShown')) {
                log('🎧 [BETA-DJ] Usuário com beta expirado detectado - exibindo modal');
                
                setTimeout(() => {
                  if (typeof window.openBetaExpiredModal === 'function') {
                    window.openBetaExpiredModal();
                  } else {
                    warn('⚠️ [BETA-DJ] Função openBetaExpiredModal não disponível ainda');
                  }
                }, 1000);
              }
              
            } catch (err) {
              error('❌ [AUTH] Erro ao verificar Firestore:', err);
              
              // ✅ ERRO TRANSITÓRIO - NÃO DESLOGAR
              // Pode ser problema de rede, Firestore offline, etc.
              warn('⚠️ [AUTH] Erro no Firestore - permitindo acesso temporariamente');
              warn('   Se o problema persistir, usuário será bloqueado na próxima tentativa');
              
              // Permitir acesso mesmo com erro (melhor UX)
              // A próxima navegação validará novamente
            }
          }
          resolve(user);
        });
      });
    }

    // Expor funções globalmente
    window.login = login;
    window.signUp = signUp;
    window.confirmSMSCode = confirmSMSCode;
    window.forgotPassword = forgotPassword;
    window.loginWithGoogle = loginWithGoogle; // ✅ Expor login com Google
    window.ensureUserDocument = ensureUserDocument; // ✅ Expor função centralizada
    window.logout = logout;
    window.showSMSSection = showSMSSection;
    window.auth = auth;
    window.db = db;
    window.firebaseReady = true;

    // Configurar listeners dos botões
    function setupEventListeners() {
      const loginBtn = document.getElementById("loginBtn");
      const signUpBtn = document.getElementById("signUpBtn");
      const confirmBtn = document.getElementById("confirmCodeBtn");
      const forgotLink = document.getElementById("forgotPasswordLink");
      const googleLoginBtn = document.getElementById("googleLoginBtn"); // ✅ Botão Google

      if (loginBtn) {
        loginBtn.addEventListener("click", (e) => {
          e.preventDefault();
          window.login();
        });
      }
      
      if (signUpBtn) {
        signUpBtn.addEventListener("click", (e) => {
          e.preventDefault();
          window.signUp();
        });
      }
      
      if (confirmBtn) {
        confirmBtn.addEventListener("click", (e) => {
          e.preventDefault();
          window.confirmSMSCode();
        });
      }
      
      if (forgotLink) {
        forgotLink.addEventListener("click", (e) => {
          e.preventDefault();
          window.resetPassword();
        });
      }
      
      // ✅ LISTENER DO GOOGLE LOGIN
      if (googleLoginBtn) {
        googleLoginBtn.addEventListener("click", (e) => {
          e.preventDefault();
          window.loginWithGoogle();
        });
        log('✅ [GOOGLE-AUTH] Event listener do botão Google configurado');
      }

      log('✅ Event listeners configurados');
    }

    // Inicializar
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
      setupEventListeners();
    }

    // Verificar estado de autenticação
    checkAuthState();
    
    // ═══════════════════════════════════════════════════════════════════
    // 🔥 LISTENER GLOBAL: Criar Firestore SEMPRE que necessário
    // ═══════════════════════════════════════════════════════════════════
    // REGRA CRÍTICA: Cria usuarios/{uid} SEMPRE que:
    // 1. user !== null (autenticado)
    // 2. usuarios/{uid} não existe
    // cadastroMetadata é OPCIONAL - usado apenas como fonte de dados
    // ═══════════════════════════════════════════════════════════════════
    auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      
      log('🔍 [AUTH-LISTENER] Usuário autenticado detectado');
      log('   UID:', user.uid);
      log('   Email:', user.email);
      log('   Telefone:', user.phoneNumber);
      
      try {
        // ═══════════════════════════════════════════════════════════════════
        // 🔥 USAR FUNÇÃO CENTRALIZADA ensureUserDocument()
        // ═══════════════════════════════════════════════════════════════════
        
        // Detectar provider baseado em user
        let provider = 'unknown';
        if (user.providerData && user.providerData.length > 0) {
          const providerId = user.providerData[0].providerId;
          if (providerId === 'google.com') provider = 'google';
          else if (providerId === 'password') provider = 'email';
          else if (providerId === 'phone') provider = 'phone';
        }
        
        // Tentar obter deviceId dos metadados
        let deviceId = null;
        const metadataStr = localStorage.getItem('cadastroMetadata');
        if (metadataStr) {
          try {
            const metadata = JSON.parse(metadataStr);
            deviceId = metadata.deviceId;
          } catch (e) {
            // Ignorar erro de parse
          }
        }
        
        // ✅ CHAMAR FUNÇÃO CENTRALIZADA
        const result = await ensureUserDocument(user, {
          provider: provider,
          deviceId: deviceId
        });
        
        if (result.created) {
          log('✅ [AUTH-LISTENER] Novo usuário - documento criado com plan: "free"');
        } else if (result.updated) {
          log('✅ [AUTH-LISTENER] Usuário existente - documento atualizado (plan preservado)');
        } else {
          log('✅ [AUTH-LISTENER] Usuário existente - nenhuma alteração necessária');
          
          // ═══════════════════════════════════════════════════════════════════
          // 🔥 SINCRONIZAÇÃO SMS: Se telefone existe no Auth, atualizar Firestore
          // ═══════════════════════════════════════════════════════════════════
          if (user.phoneNumber) {
            const { doc, getDoc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
            const userRef = doc(db, 'usuarios', user.uid);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();
            
            // Se Firestore ainda marca como não verificado (PT) ou não tem campos canônicos (EN), sincronizar
            if (!userData.verificadoPorSMS || !userData.verified) {
              log('📱 [SMS-SYNC] Telefone detectado no Auth mas Firestore não atualizado');
              log('   user.phoneNumber:', user.phoneNumber);
              log('   Firestore verificadoPorSMS:', userData.verificadoPorSMS);
              log('   Firestore verified (EN):', userData.verified);
              log('   🔄 [SMS-SYNC] Sincronizando status de verificação...');
              
              const syncUpdates = {
                // Campos canônicos (EN)
                phoneNumber: user.phoneNumber,
                verified: true,
                verifiedAt: serverTimestamp(),
                // Campos legacy/PT para compatibilidade
                verificadoPorSMS: true,
                telefone: user.phoneNumber,
                smsVerificadoEm: serverTimestamp(),
                updatedAt: serverTimestamp()
              };
              
              // 🔍 AUDITORIA: ESCRITA NO FIRESTORE (SMS-SYNC)
              console.log('[FIRESTORE-WRITE usuarios] auth.js onAuthStateChanged SMS-SYNC linha ~2227');
              console.log('[FIRESTORE-WRITE usuarios] Sync payload:', syncUpdates);
              
              try {
                await updateDoc(userRef, syncUpdates);
                
                log('✅ [SMS-SYNC] Firestore atualizado para verificado');
                log('   verificadoPorSMS: true');
                log('   telefone:', user.phoneNumber);
              } catch (syncError) {
                error('❌ [SMS-SYNC] Erro ao sincronizar:', syncError);
              }
            } else {
              log('✅ [SMS-SYNC] Status já sincronizado (verificadoPorSMS: true)');
            }
          }
        }
        
        // Limpar metadados se existirem
        const cadastroMetadata = localStorage.getItem('cadastroMetadata');
        if (cadastroMetadata) {
          localStorage.removeItem('cadastroMetadata');
          log('🧹 [AUTH-LISTENER] Metadados de cadastro removidos');
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // 🔗 VINCULAR CADASTRO AO REFERRAL (REFERRAL V3 - BACKEND)
        // ═══════════════════════════════════════════════════════════════════
        
        // Obter visitorId e referralCode do localStorage
        const visitorId = localStorage.getItem('visitorId');
        const referralCode = localStorage.getItem('soundy_referral_code');
        const userRef = doc(db, 'usuarios', user.uid);
        
        if (visitorId && referralCode) {
          try {
            log('💾 [REFERRAL-V3] Vinculando cadastro via backend...');
            log('   visitorId:', visitorId.substring(0, 16) + '...');
            log('   uid:', user.uid);
            log('   partnerId:', referralCode);
            
            // ✅ NOVO: Chamar backend via Admin SDK (bypassa Firestore Rules)
            const apiUrl = window.getAPIUrl ? window.getAPIUrl('/api/referral/link-registration') : '/api/referral/link-registration';
            
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                uid: user.uid,
                visitorId: visitorId
              })
            });
            
            const result = await response.json();
            
            if (result.success) {
              log('✅ [REFERRAL-V3] Vinculação concluída com sucesso!');
              log('   Mensagem:', result.message);
              log('   Linked:', result.data?.linked);
              log('   PartnerId:', result.data?.partnerId);
              
              // Se vinculou, mostrar confirmação no console
              if (result.data?.linked && result.data?.partnerId) {
                log('🎉 [REFERRAL-V3] Cadastro rastreado para parceiro:', result.data.partnerId);
              }
            } else {
              warn('⚠️ [REFERRAL-V3] Backend retornou erro:', result.message);
              warn('   Reason:', result.reason);
              // NÃO bloqueia cadastro - erro silencioso
            }
            
          } catch (error) {
            error('❌ [REFERRAL-V3] Erro ao chamar backend:', error);
            error('   Detalhes:', error.message);
            // ⚠️ NÃO bloqueia cadastro - erro silencioso
          }
          
          // ═══════════════════════════════════════════════════════════════
          // ⚠️ CÓDIGO LEGADO V2 (MANTER POR ENQUANTO - FALLBACK)
          // ═══════════════════════════════════════════════════════════════
          // Este código será removido após validação do V3 em produção
          // POR ENQUANTO: mantido como fallback caso backend falhe
          
          try {
            log('💾 [REFERRAL-V2-FALLBACK] Tentando método antigo (direto no Firestore)...');
            
            const visitorRef = doc(db, 'referral_visitors', visitorId);
            await updateDoc(visitorRef, {
              registered: true,
              uid: user.uid,
              registeredAt: serverTimestamp(),
              lastSeenAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            
            log('✅ [REFERRAL-V2-FALLBACK] Método antigo também executou');
            
          } catch (error) {
            log('⚠️ [REFERRAL-V2-FALLBACK] Método antigo falhou (esperado - rules bloqueadas)');
            log('   Erro:', error.message);
            // Não bloqueia o cadastro
          }
          
          // 🧹 LIMPAR CÓDIGOS do localStorage (manter visitorId)
          localStorage.removeItem('soundy_referral_code');
          localStorage.removeItem('soundy_referral_timestamp');
          log('🧹 [REFERRAL-V3] Códigos limpos do localStorage (visitorId mantido)');
        }
        
        // ✅ VERIFICAR CRIAÇÃO
        const verificacao = await getDoc(userRef);
        if (verificacao.exists()) {
          log('✅ [AUTH-LISTENER] CONFIRMADO: Documento existe no Firestore');
          log('   Dados completos:', verificacao.data());
          
          // Limpar metadados após sucesso (já foi limpo acima se existia)
          const cadastroMetadataStr = localStorage.getItem('cadastroMetadata');
          if (cadastroMetadataStr) {
            localStorage.removeItem('cadastroMetadata');
            log('🧹 [AUTH-LISTENER] Metadados de cadastro removidos (segunda verificação)');
          }
        } else {
          error('❌ [AUTH-LISTENER] ERRO CRÍTICO: Documento não foi criado após setDoc!');
        }
        
      } catch (err) {
        error('❌ [AUTH-LISTENER] Erro ao processar Firestore:', err);
        error('   Código:', err.code);
        error('   Mensagem:', err.message);
        error('   Stack:', err.stack);
        // NÃO remover metadados - retry na próxima inicialização
      }
    });

    // Exportar funções importantes para acesso global
    window.resetSMSState = resetSMSState;
    window.sendSMS = sendSMS;
    window.login = login;
    window.resetPassword = resetPassword;
    window.verifySMSCode = confirmSMSCode; // Corrigir referência para função existente
    window.confirmSMSCode = confirmSMSCode;
    window.directEmailSignUp = directEmailSignUp;
    window.signUp = signUp;

    log('✅ Sistema de autenticação carregado - Modo:', SMS_VERIFICATION_ENABLED ? 'SMS' : 'Email Direto');

  } catch (err) {
    error('❌ Erro crítico ao carregar auth.js:', err);
  }
})();