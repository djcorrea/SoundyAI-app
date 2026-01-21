// auth.js - Versão Corrigida
console.log('🚀 Carregando auth.js...');

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
      linkWithCredential 
    } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js');
    
    // Importações Firestore
    const { doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');

    console.log('✅ Todas as importações carregadas com sucesso');

    // ✅ VARIÁVEIS GLOBAIS - Usar window para garantir persistência
    window.confirmationResult = null;
    window.lastPhone = "";
    window.isNewUserRegistering = false; // ✅ Proteger cadastro em progresso
    // ✅ SMS OBRIGATÓRIO: Ativado para segurança (1 telefone = 1 conta)
    let SMS_VERIFICATION_ENABLED = true; // ⚡ SMS obrigatório no cadastro
    
    // Função para alternar modo SMS (para facilitar reativação)
    window.toggleSMSMode = function(enable = true) {
      SMS_VERIFICATION_ENABLED = enable;
      console.log('🔄 Modo SMS:', enable ? 'ATIVADO' : 'DESATIVADO');
      showMessage(`Modo SMS ${enable ? 'ativado' : 'desativado'}. Recarregue a página.`, "success");
    };
    
    let recaptchaVerifier = null;

    // Configuração simplificada (SMS desabilitado temporariamente)
    try {
      console.log('🔧 Modo de cadastro direto por email ativado (SMS temporariamente desabilitado)');
      
      // Verificar configuração do projeto
      console.log('🔍 Projeto configurado:', {
        projectId: auth.app.options.projectId,
        authDomain: auth.app.options.authDomain,
        modoSMS: SMS_VERIFICATION_ENABLED ? 'Habilitado' : 'Desabilitado (temporário)'
      });
      
      console.log('✅ Sistema configurado para cadastro direto');
    } catch (configError) {
      console.warn('⚠️ Aviso de configuração:', configError);
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
        console.error(`${type.toUpperCase()}: ${msg}`);
      } else {
        console.log(`${type.toUpperCase()}: ${msg}`);
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

    // Função para garantir container do reCAPTCHA
    function ensureRecaptchaDiv() {
      let recaptchaDiv = document.getElementById('recaptcha-container');
      if (!recaptchaDiv) {
        recaptchaDiv = document.createElement('div');
        recaptchaDiv.id = 'recaptcha-container';
        recaptchaDiv.style.position = 'absolute';
        recaptchaDiv.style.top = '-9999px';
        recaptchaDiv.style.left = '-9999px';
        document.body.appendChild(recaptchaDiv);
        console.log('📦 Container reCAPTCHA criado');
      } else {
        recaptchaDiv.innerHTML = '';
        console.log('🧹 Container reCAPTCHA limpo');
      }
      return recaptchaDiv;
    }

    // Função para mostrar seção SMS
    function showSMSSection() {
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
        console.log('✅ [AUTH] Token salvo no localStorage como authToken');
        
        // ═══════════════════════════════════════════════════════════════════
        // 🔥 INICIALIZAR SESSÃO COMPLETA (visitor ID, flags, estado)
        // ═══════════════════════════════════════════════════════════════════
        await initializeSessionAfterSignup(result.user, idToken);

        try {
          const snap = await getDoc(doc(db, 'usuarios', result.user.uid));
          
          if (!snap.exists()) {
            // Usuário não existe no Firestore - redirecionar para entrevista
            window.location.href = "entrevista.html";
            return;
          }
          
          const userData = snap.data();
          
          // ✅ VALIDAÇÃO OBRIGATÓRIA: Usar Firebase Auth como fonte de verdade
          // Se user.phoneNumber existe, SMS foi verificado (Auth é a verdade)
          const smsVerificado = !!result.user.phoneNumber;
          
          if (!smsVerificado && !userData.criadoSemSMS) {
            // Conta criada mas telefone não verificado no Auth - forçar logout
            console.warn('⚠️ [SEGURANÇA] Login bloqueado - telefone não verificado no Auth');
            console.warn('   user.phoneNumber:', result.user.phoneNumber);
            console.warn('   criadoSemSMS:', userData.criadoSemSMS);
            await auth.signOut();
            localStorage.clear();
            showMessage(
              "❌ Sua conta precisa de verificação por SMS. Complete o cadastro.",
              "error"
            );
            return;
          }
          
          if (smsVerificado) {
            console.log('✅ [SMS-SYNC] SMS verificado detectado no Auth (user.phoneNumber existe)');
          }
          
          // Prosseguir com navegação normal
          if (userData.entrevistaConcluida === false) {
            window.location.href = "entrevista.html";
          } else {
            window.location.href = "index.html";
          }
        } catch (e) {
          console.error('❌ Erro ao buscar dados do usuário:', e);
          window.location.href = "entrevista.html";
        }
      } catch (error) {
        console.error('❌ Erro no login:', error);
        
        let errorMessage = "Erro ao fazer login: ";
        
        // Tratamento específico de erros Firebase para login
        switch (error.code) {
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
            errorMessage += error.message;
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
      } catch (error) {
        showMessage(error, "error");
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
        
        console.log('✅ Usuário criado:', user.uid);
        
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
        
        console.log('📌 [DIRECT-SIGNUP] Metadados salvos para criação do Firestore');
        console.log('   Firestore será criado automaticamente pelo listener global');

        // Obter token
        const idToken = await user.getIdToken();
        
        // ✅ Salvar token com chave consistente
        localStorage.setItem("authToken", idToken);
        localStorage.setItem("idToken", idToken); // Manter compatibilidade
        console.log('✅ [AUTH] Token salvo no localStorage como authToken');
        
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

        showMessage("✅ Conta criada com sucesso! Redirecionando...", "success");
        
        // Redirecionar após sucesso
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 2000);

      } catch (error) {
        console.error('❌ Erro no cadastro direto:', error);
        
        let errorMessage = "Erro ao criar conta: ";
        
        // Tratamento específico de erros Firebase
        switch (error.code) {
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
      console.log('🔄 Resetando estado do SMS...');
      
      // Limpar reCAPTCHA
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
          console.log('🧹 reCAPTCHA limpo');
        } catch (e) {
          console.log('⚠️ Erro ao limpar reCAPTCHA:', e);
        }
        recaptchaVerifier = null;
      }
      
      // Limpar container DOM
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.innerHTML = '';
      }
      
      // ⚠️ CRÍTICO: NÃO resetar confirmationResult se SMS foi enviado
      // Apenas resetar se realmente necessário (erro antes do envio)
      console.warn('⚠️ resetSMSState: Mantendo confirmationResult preservado');
      console.log('   confirmationResult atual:', window.confirmationResult ? 'EXISTE' : 'NULL');
      
      // ✅ NÃO fazer: confirmationResult = null
      // ✅ NÃO fazer: lastPhone = ""
      
      console.log('✅ Estado resetado (confirmationResult preservado)');
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
        
        console.log('✅ [UNICIDADE] Telefone disponível para cadastro');
      } catch (checkError) {
        console.error('❌ Erro ao verificar unicidade do telefone:', checkError);
        showMessage(
          "Erro ao validar telefone. Tente novamente.",
          "error"
        );
        return false;
      }

      // Garantir container do reCAPTCHA
      ensureRecaptchaDiv();

      // Limpar reCAPTCHA anterior
      if (recaptchaVerifier) {
        try { 
          recaptchaVerifier.clear(); 
        } catch (e) {}
        recaptchaVerifier = null;
      }

      // Limpar o container DOM
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.innerHTML = '';
      }

      // Criar reCAPTCHA v2 normal (NÃO Enterprise) - configuração simples
      try {
        console.log('🔄 Criando reCAPTCHA v2 normal...');
        
        // Configuração mínima para reCAPTCHA v2
        recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'normal',
          'callback': function(response) {
            console.log('✅ reCAPTCHA v2 resolvido:', response ? 'Token recebido' : 'Sem token');
          },
          'expired-callback': function() {
            console.log('⏰ reCAPTCHA v2 expirou - solicite novo');
            showMessage("reCAPTCHA expirou. Clique para gerar novo.", "error");
          },
          'error-callback': function(error) {
            console.log('❌ Erro reCAPTCHA v2:', error);
            showMessage("Erro no reCAPTCHA. Recarregue a página.", "error");
          }
        });

        console.log('🔄 Renderizando reCAPTCHA v2...');
        await recaptchaVerifier.render();
        console.log('✅ reCAPTCHA v2 renderizado com sucesso');
        
      } catch (renderError) {
        console.error('❌ Erro no reCAPTCHA v2:', renderError);
        
        // Fallback para configuração ultra-simples
        try {
          console.log('🔄 Tentando reCAPTCHA v2 simplificado...');
          if (recaptchaVerifier) {
            try { recaptchaVerifier.clear(); } catch (e) {}
          }
          
          recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'normal'
          });
          
          await recaptchaVerifier.render();
          console.log('✅ reCAPTCHA v2 simplificado funcionou');
          
        } catch (fallbackError) {
          console.error('❌ Falha total reCAPTCHA v2:', fallbackError);
          showMessage(`Erro reCAPTCHA: ${fallbackError.message}. Verifique se reCAPTCHA v2 está habilitado no Firebase Console.`, "error");
          return false;
        }
      }
      // Tenta enviar SMS
      let smsSent = false;
      try {
        console.log('📱 Enviando SMS para:', phone);
        
        // ✅ USAR window.confirmationResult para garantir persistência
        window.confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
        window.lastPhone = phone;
        
        // ✅ VALIDAR se verificationId existe
        if (!window.confirmationResult || !window.confirmationResult.verificationId) {
          throw new Error('SMS enviado mas confirmationResult inválido');
        }
        
        console.log('✅ SMS enviado com sucesso');
        console.log('   verificationId:', window.confirmationResult.verificationId?.substring(0, 20) + '...');
        console.log('   confirmationResult armazenado em window.confirmationResult');
        
        // Usar função específica para sucesso do SMS
        if (typeof window.showSMSSuccess === 'function') {
          window.showSMSSuccess();
        } else {
          showMessage("Código SMS enviado! Verifique seu celular.", "success");
        }
        
        showSMSSection();
        smsSent = true;
      } catch (smsError) {
        console.error('❌ Erro ao enviar SMS:', smsError);
        
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
              
              console.log('🔄 Implementando soluções para too-many-requests...');
              
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
      console.log('🔄 Iniciando processo de cadastro...');
      
      // Verificar se SMS está habilitado ou usar cadastro direto
      if (!SMS_VERIFICATION_ENABLED) {
        console.log('📧 Usando cadastro direto por email (SMS desabilitado)');
        return await directEmailSignUp();
      }
      
      // Sistema SMS original (quando habilitado)
      console.log('📱 Usando cadastro com verificação SMS');
      
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
        console.log('✅ SMS já enviado para este telefone - mostrando seção');
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
      } catch (error) {
        console.error('❌ Erro ao enviar e-mail de recuperação:', error);
        let errorMessage = "Erro ao enviar e-mail de recuperação.";
        
        if (error.code === 'auth/user-not-found') {
          errorMessage = "E-mail não encontrado. Verifique se digitou corretamente.";
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = "E-mail inválido. Digite um e-mail válido.";
        }
        
        showMessage(errorMessage, "error");
      }
    }

    // Função para confirmar código SMS
    async function confirmSMSCode() {
      console.log('🔐 [CONFIRM] Iniciando confirmação de código SMS...');
      
      // ✅ CRÍTICO: Capturar email do FORMULÁRIO (não do Firebase Auth)
      const formEmail = document.getElementById("email")?.value?.trim();
      const formPassword = document.getElementById("password")?.value?.trim();
      const formPhone = document.getElementById("phone")?.value?.trim();
      const code = document.getElementById("smsCode")?.value?.trim();

      // ✅ VALIDAÇÃO OBRIGATÓRIA: Email e senha devem existir
      if (!formEmail) {
        console.error('❌ [CONFIRM] Email não preenchido no formulário');
        showMessage("❌ Erro: O campo e-mail está vazio. Preencha novamente.", "error");
        return;
      }
      
      if (!formPassword) {
        console.error('❌ [CONFIRM] Senha não preenchida no formulário');
        showMessage("❌ Erro: O campo senha está vazio. Preencha novamente.", "error");
        return;
      }
      
      if (!formPhone) {
        console.error('❌ [CONFIRM] Telefone não preenchido no formulário');
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
      
      console.log('📧 [CONFIRM] Email do formulário:', formEmail);
      console.log('📱 [CONFIRM] Telefone formatado:', formattedPhone);

      // ✅ VALIDAÇÃO ROBUSTA do confirmationResult
      if (!window.confirmationResult) {
        console.error('❌ [CONFIRM] window.confirmationResult é NULL');
        showMessage("Erro: Solicite um novo código SMS.", "error");
        return;
      }
      
      if (!window.confirmationResult.verificationId) {
        console.error('❌ [CONFIRM] verificationId não existe');
        console.error('   confirmationResult:', window.confirmationResult);
        showMessage("Erro: Sessão de verificação inválida. Solicite novo SMS.", "error");
        return;
      }
      
      console.log('✅ [CONFIRM] confirmationResult validado com sucesso');
      console.log('   verificationId:', window.confirmationResult.verificationId.substring(0, 20) + '...');
      console.log('   código digitado:', code);

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
        console.log('🛡️ [CONFIRM] Cadastro marcado como em progresso');
        
        // ✅ OBTER DEVICE FINGERPRINT antes da autenticação
        try {
          if (window.SoundyFingerprint) {
            const fpData = await window.SoundyFingerprint.get();
            deviceId = fpData.fingerprint_hash;
            console.log('✅ DeviceID obtido:', deviceId?.substring(0, 16) + '...');
          } else {
            console.warn('⚠️ SoundyFingerprint não disponível, usando fallback');
            deviceId = 'fp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          }
        } catch (fpError) {
          console.error('❌ Erro ao obter fingerprint:', fpError);
          deviceId = 'fp_fallback_' + Date.now();
        }
        
        showMessage("Verificando código...", "success");
        
        // ✅ DESBLOQUEAR SCROLL (caso esteja bloqueado)
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';

        // ═══════════════════════════════════════════════════════════════════
        // ✅ FLUXO CORRETO: CRIAR USUÁRIO COM EMAIL PRIMEIRO
        // ═══════════════════════════════════════════════════════════════════
        
        console.log('📧 [CONFIRM] PASSO 1: Criando usuário com email e senha...');
        console.log('   Email:', formEmail);
        
        // ✅ PASSO 1: Criar usuário com EMAIL e SENHA
        userResult = await createUserWithEmailAndPassword(auth, formEmail, formPassword);
        console.log('✅ [CONFIRM] Usuário criado com email:', userResult.user.uid);
        console.log('   Email verificado:', userResult.user.email);
        
        // ✅ PASSO 2: Confirmar código SMS
        showMessage("📱 Confirmando SMS...", "success");
        console.log('📱 [CONFIRM] PASSO 2: Confirmando código SMS...');
        console.log('   Código:', code);
        
        const phoneCredential = PhoneAuthProvider.credential(
          window.confirmationResult.verificationId, 
          code
        );
        
        // ✅ PASSO 3: Vincular TELEFONE ao usuário de EMAIL
        showMessage("🔗 Vinculando telefone...", "success");
        console.log('🔗 [CONFIRM] PASSO 3: Vinculando telefone ao usuário de email...');
        console.log('   Telefone:', formattedPhone);
        
        await linkWithCredential(userResult.user, phoneCredential);
        console.log('✅ [CONFIRM] Telefone vinculado com sucesso ao email');
        
        // ═══════════════════════════════════════════════════════════════════
        // 🔥 CORREÇÃO CRÍTICA: FORÇAR RELOAD DO USUÁRIO APÓS LINKAGEM
        // ═══════════════════════════════════════════════════════════════════
        // PROBLEMA: linkWithCredential NÃO atualiza imediatamente auth.currentUser
        // SOLUÇÃO: Forçar reload() para obter estado atualizado do Firebase
        // ═══════════════════════════════════════════════════════════════════
        console.log('🔄 [CONFIRM] PASSO 4: FORÇANDO RELOAD do usuário após linkagem...');
        await auth.currentUser.reload();
        
        // Obter referência atualizada do usuário
        const refreshedUser = auth.currentUser;
        console.log('✅ [CONFIRM] Usuário recarregado - estado atualizado:');
        console.log('   UID:', refreshedUser.uid);
        console.log('   Email:', refreshedUser.email);
        console.log('   phoneNumber:', refreshedUser.phoneNumber);
        console.log('   providerData:', refreshedUser.providerData.map(p => p.providerId));
        
        // Validar se telefone foi realmente vinculado
        if (!refreshedUser.phoneNumber) {
          console.error('❌ [CONFIRM] ERRO CRÍTICO: phoneNumber ainda é null após reload!');
          throw new Error('Telefone não foi vinculado corretamente');
        }
        
        console.log('✅ [CONFIRM] Verificação PASS: phoneNumber presente:', refreshedUser.phoneNumber);
        
        // Atualizar referência do userResult para usar dados atualizados
        userResult.user = refreshedUser;
        
        // ═══════════════════════════════════════════════════════════════════
        // ✅ PASSO 5: AGUARDAR ESTABILIZAÇÃO DA SESSÃO
        // ═══════════════════════════════════════════════════════════════════
        console.log('⏳ [CONFIRM] PASSO 5: Aguardando propagação do onAuthStateChanged...');
        
        // Aguardar onAuthStateChanged confirmar atualização (com timeout curto pois já fizemos reload)
        await new Promise((resolve) => {
          const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user && user.uid === refreshedUser.uid && user.phoneNumber) {
              console.log('✅ [CONFIRM] onAuthStateChanged propagado com phoneNumber:', user.phoneNumber);
              unsubscribe();
              resolve();
            }
          });
          
          // Timeout curto (1 segundo) - já garantimos o estado com reload()
          setTimeout(() => {
            console.log('⏱️ [CONFIRM] Timeout onAuthStateChanged - continuando (reload já garantiu estado)');
            unsubscribe();
            resolve();
          }, 1000);
        });
        
        // ✅ PASSO 6: Renovar token com estado garantido
        console.log('🔄 [CONFIRM] PASSO 6: Renovando token...');
        try {
          freshToken = await refreshedUser.getIdToken(true);
          console.log('✅ [CONFIRM] Token renovado com sucesso');
        } catch (tokenError) {
          console.warn('⚠️ [CONFIRM] Falha ao renovar token (não crítico):', tokenError.message);
          // Usar token sem forçar refresh
          freshToken = await refreshedUser.getIdToken();
        }
        
        // ✅ AUTENTICAÇÃO COMPLETA - Salvar tokens e metadados IMEDIATAMENTE
        console.log('💾 [CONFIRM] Salvando tokens de autenticação...');
        console.log('   UID:', userResult.user.uid);
        console.log('   Email:', formEmail);
        console.log('   Telefone (Auth):', userResult.user.phoneNumber); // ✅ Usar phoneNumber do Auth
        
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
        
        console.log('✅ [CONFIRM] Usuário AUTENTICADO - sessão salva');
        console.log('📌 [CONFIRM] Metadados salvos para criação do Firestore');
        console.log('📱 [CONFIRM] Telefone confirmado:', userResult.user.phoneNumber);
        
        // ═══════════════════════════════════════════════════════════════════
        // 🔥 INICIALIZAR SESSÃO COMPLETA (visitor ID, flags, estado)
        // ═══════════════════════════════════════════════════════════════════
        await initializeSessionAfterSignup(userResult.user, freshToken);
        
      } catch (authError) {
        // ❌ ERRO CRÍTICO DE AUTENTICAÇÃO - Abortar cadastro
        console.error('❌ [AUTH-ERROR] Falha crítica na autenticação:', authError);
        console.error('   Código:', authError.code);
        console.error('   Mensagem:', authError.message);
        
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
      
      console.log('🚀 [CONFIRM] Redirecionando para entrevista.html em 1.5s...');
      console.log('📌 [CONFIRM] Firestore será criado automaticamente pelo listener global');
      setTimeout(() => {
        window.location.replace("entrevista.html");
      }, 1500);
    }

    // ═══════════════════════════════════════════════════════════════════
    // � FUNÇÃO AUXILIAR: Inicializar sessão completa após cadastro
    // ═══════════════════════════════════════════════════════════════════
    async function initializeSessionAfterSignup(user, freshToken) {
      console.log('🔐 [SESSION] Inicializando sessão completa após cadastro...');
      
      try {
        // 1️⃣ Marcar autenticação como pronta
        window.__AUTH_READY__ = true;
        localStorage.setItem('hasAuthToken', 'true');
        console.log('✅ [SESSION] Estado de autenticação marcado como pronto');
        
        // 2️⃣ Garantir que o token está salvo
        localStorage.setItem("idToken", freshToken);
        localStorage.setItem("authToken", freshToken);
        console.log('✅ [SESSION] Token revalidado e salvo');
        
        // 3️⃣ Inicializar Visitor ID se não existir
        let visitorId = localStorage.getItem('visitorId');
        if (!visitorId) {
          // Tentar obter via FingerprintJS se disponível
          if (window.SoundyFingerprint) {
            try {
              const fpData = await window.SoundyFingerprint.get();
              visitorId = fpData.fingerprint_hash;
              console.log('✅ [SESSION] Visitor ID obtido via FingerprintJS');
            } catch (fpError) {
              console.warn('⚠️ [SESSION] Erro ao obter fingerprint, gerando fallback');
              visitorId = 'fp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            }
          } else {
            // Gerar visitor ID simples
            visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            console.log('✅ [SESSION] Visitor ID gerado (fallback)');
          }
          
          localStorage.setItem('visitorId', visitorId);
          console.log('✅ [SESSION] Visitor ID salvo:', visitorId.substring(0, 16) + '...');
        } else {
          console.log('✅ [SESSION] Visitor ID já existe:', visitorId.substring(0, 16) + '...');
        }
        
        // 4️⃣ Salvar UID para referência rápida
        localStorage.setItem('currentUserId', user.uid);
        console.log('✅ [SESSION] UID salvo para referência rápida:', user.uid);
        
        // 5️⃣ Marcar modo autenticado
        localStorage.setItem('chatMode', 'authenticated');
        localStorage.removeItem('anonymousMode'); // Remover flag anônimo se existir
        console.log('✅ [SESSION] Modo de chat definido como: authenticated');
        
        // 6️⃣ Desativar modo anônimo explicitamente
        if (window.SoundyAnonymous && typeof window.SoundyAnonymous.deactivate === 'function') {
          window.SoundyAnonymous.deactivate();
          console.log('✅ [SESSION] Modo anônimo desativado (SoundyAnonymous.deactivate)');
        }
        
        console.log('🎉 [SESSION] Sessão completa inicializada com sucesso!');
        console.log('   UID:', user.uid);
        console.log('   Token válido: sim');
        console.log('   Visitor ID: sim');
        console.log('   Modo: authenticated');
        
        return true;
      } catch (sessionError) {
        console.error('❌ [SESSION] Erro ao inicializar sessão:', sessionError);
        return false;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // �🔐 FUNÇÃO DE LOGOUT ROBUSTA - LIMPEZA COMPLETA DE ESTADO
    // ═══════════════════════════════════════════════════════════════════
    async function logout() {
      console.log('🔓 [LOGOUT] Iniciando processo de logout completo...');
      
      try {
        // 1️⃣ SIGNOUT DO FIREBASE
        if (auth && typeof auth.signOut === 'function') {
          await auth.signOut();
          console.log('✅ [LOGOUT] Firebase signOut executado');
        }
      } catch (e) {
        console.warn('⚠️ [LOGOUT] Erro no Firebase signOut (continuando limpeza):', e.message);
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
          console.log('🗑️ [LOGOUT] Removido:', key);
        }
      });
      
      console.log('✅ [LOGOUT] localStorage limpo');
      
      // 3️⃣ LIMPAR SESSIONSTORAGE
      sessionStorage.clear();
      console.log('✅ [LOGOUT] sessionStorage limpo');
      
      // 4️⃣ RESETAR VARIÁVEIS GLOBAIS DE AUTH
      if (window.auth) {
        // Firebase auth continua existindo mas sem currentUser
        console.log('✅ [LOGOUT] window.auth.currentUser:', window.auth.currentUser);
      }
      
      // Limpar qualquer referência global a token/user
      window.currentUserToken = null;
      window.currentUserData = null;
      window.cachedIdToken = null;
      
      // 5️⃣ FORÇAR MODO ANÔNIMO (se voltando para index)
      if (window.SoundyAnonymous) {
        window.SoundyAnonymous.isAnonymousMode = true;
        window.SoundyAnonymous.forceCleanState = true;
        console.log('✅ [LOGOUT] Modo anônimo forçado para próximo acesso');
      }
      
      console.log('🔓 [LOGOUT] Processo de logout COMPLETO');
      
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
            console.log('🔥 [AUTH] Timeout - Página demo detectada, permitindo acesso');
            resolve(null);
            return;
          }
          
          // 🔓 MODO ANÔNIMO: Se está no index.html, ativar modo anônimo
          if (isIndexPage) {
            // Após 5s de timeout, SoundyAnonymous deve estar disponível
            if (window.SoundyAnonymous && window.SoundyAnonymous.isEnabled) {
              console.log('🔓 [AUTH] Timeout - Ativando modo anônimo');
              await window.SoundyAnonymous.activate();
              resolve(null);
              return;
            } else {
              console.error('❌ [AUTH] Timeout - SoundyAnonymous não disponível após 5s');
              console.log('   window.SoundyAnonymous:', window.SoundyAnonymous);
            }
          }
          
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
            console.log('🛡️ [AUTH] Cadastro em progresso detectado - permitindo acesso');
            window.isNewUserRegistering = false;
            localStorage.removeItem('cadastroEmProgresso');
            resolve(user);
            return;
          }

          if (!user && !isLoginPage) {
            // 🔥 MODO DEMO: Permitir acesso sem login
            if (isDemoPage) {
              console.log('🔥 [AUTH] Usuário não logado na página demo - permitindo acesso');
              resolve(null);
              return;
            }
            
            // 🔓 MODO ANÔNIMO: Se está no index.html, permitir acesso anônimo
            // ✅ FIX TIMING: Aguardar SoundyAnonymous carregar se necessário
            if (isIndexPage) {
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
                    console.warn('⚠️ [AUTH] Timeout aguardando SoundyAnonymous');
                    resolveWait(false);
                  }
                }, 50);
              });
              
              const anonymousAvailable = await waitForAnonymousMode();
              
              if (anonymousAvailable) {
                console.log('🔓 [AUTH] Usuário não logado no index - Ativando modo anônimo');
                await window.SoundyAnonymous.activate();
                resolve(null);
                return;
              }
            }
            
            window.location.href = "login.html";
          } else if (user && isLoginPage) {
            // 🔓 MODO ANÔNIMO: Desativar se estava ativo
            if (window.SoundyAnonymous && window.SoundyAnonymous.isAnonymousMode) {
              window.SoundyAnonymous.deactivate();
            }
            
            try {
              const snap = await getDoc(doc(db, 'usuarios', user.uid));
              if (snap.exists() && snap.data().entrevistaConcluida === false) {
                window.location.href = "entrevista.html";
              } else if (snap.exists() && snap.data().entrevistaConcluida === true) {
                window.location.href = "index.html";
              } else {
                window.location.href = "entrevista.html";
              }
            } catch (e) {
              window.location.href = "entrevista.html";
            }
          } else if (user) {
            // ✅ USUÁRIO AUTENTICADO - Validar Firestore
            console.log('✅ [AUTH] Usuário autenticado:', user.uid);
            
            // 🔓 MODO ANÔNIMO: Desativar se usuário autenticou
            if (window.SoundyAnonymous && window.SoundyAnonymous.isAnonymousMode) {
              window.SoundyAnonymous.deactivate();
            }
            
            // ✅ VALIDAÇÃO CRÍTICA: Verificar se telefone foi confirmado
            try {
              const userSnap = await getDoc(doc(db, 'usuarios', user.uid));
              
              if (!userSnap.exists()) {
                // ⚠️ DOCUMENTO NÃO EXISTE: Pode ser race condition (Firestore ainda não sincronizou)
                console.warn('⚠️ [AUTH] Documento Firestore não encontrado para:', user.uid);
                console.warn('⚠️ [AUTH] Isso pode ser normal logo após cadastro (race condition)');
                
                // ✅ NÃO DESLOGAR - Permitir acesso temporariamente
                // O Firestore pode levar alguns segundos para sincronizar
                console.log('✅ [AUTH] Permitindo acesso (Firestore pode estar sincronizando)');
                resolve(user);
                return;
              }
              
              const userData = userSnap.data();
              
              // ✅ BUG #2 FIX: Não validar telefone se cadastro ainda em progresso
              const cadastroEmProgresso = localStorage.getItem('cadastroEmProgresso') === 'true';
              if (cadastroEmProgresso) {
                console.log('🛡️ [AUTH] Cadastro em progresso - pulando validação de telefone');
                resolve(user);
                return;
              }
              
              // ✅ VALIDAÇÃO OBRIGATÓRIA: Usar Firebase Auth como fonte de verdade
              // Se user.phoneNumber existe, SMS foi verificado (Auth é a verdade)
              const smsVerificado = !!user.phoneNumber;
              
              if (!smsVerificado && !userData.criadoSemSMS) {
                console.warn('⚠️ [SEGURANÇA] Login bloqueado - telefone não verificado no Auth');
                console.warn('   user.phoneNumber:', user.phoneNumber);
                console.warn('   criadoSemSMS:', userData.criadoSemSMS);
                
                await auth.signOut();
                localStorage.clear();
                sessionStorage.clear();
                
                showMessage(
                  "❌ Sua conta precisa de verificação por SMS. Complete o cadastro.",
                  "error"
                );
                
                window.location.href = "login.html";
                resolve(null);
                return;
              }
              
              console.log('✅ [AUTH] Validação completa - acesso permitido');
              console.log('   SMS verificado (Auth):', smsVerificado);
              console.log('   user.phoneNumber:', user.phoneNumber);
              console.log('   criadoSemSMS:', userData.criadoSemSMS);
              
              // 🎧 BETA DJS: Verificar se o plano DJ expirou e exibir modal
              if (userData.djExpired === true && !sessionStorage.getItem('betaDjModalShown')) {
                console.log('🎧 [BETA-DJ] Usuário com beta expirado detectado - exibindo modal');
                
                setTimeout(() => {
                  if (typeof window.openBetaExpiredModal === 'function') {
                    window.openBetaExpiredModal();
                  } else {
                    console.warn('⚠️ [BETA-DJ] Função openBetaExpiredModal não disponível ainda');
                  }
                }, 1000);
              }
              
            } catch (error) {
              console.error('❌ [AUTH] Erro ao verificar Firestore:', error);
              
              // ✅ ERRO TRANSITÓRIO - NÃO DESLOGAR
              // Pode ser problema de rede, Firestore offline, etc.
              console.warn('⚠️ [AUTH] Erro no Firestore - permitindo acesso temporariamente');
              console.warn('   Se o problema persistir, usuário será bloqueado na próxima tentativa');
              
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

      console.log('✅ Event listeners configurados');
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
      
      console.log('🔍 [AUTH-LISTENER] Usuário autenticado detectado');
      console.log('   UID:', user.uid);
      console.log('   Email:', user.email);
      console.log('   Telefone:', user.phoneNumber);
      
      try {
        // Importar Firestore dinamicamente
        const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
        
        // ✅ SEMPRE verificar se documento existe
        const userRef = doc(db, 'usuarios', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          console.log('✅ [AUTH-LISTENER] Documento já existe no Firestore');
          
          // ═══════════════════════════════════════════════════════════════════
          // 🔥 SINCRONIZAÇÃO SMS: Se telefone existe no Auth, atualizar Firestore
          // ═══════════════════════════════════════════════════════════════════
          if (user.phoneNumber) {
            const userData = userSnap.data();
            
            // Se Firestore ainda marca como não verificado, sincronizar
            if (!userData.verificadoPorSMS) {
              console.log('📱 [SMS-SYNC] Telefone detectado no Auth mas Firestore não atualizado');
              console.log('   user.phoneNumber:', user.phoneNumber);
              console.log('   Firestore verificadoPorSMS:', userData.verificadoPorSMS);
              console.log('   🔄 [SMS-SYNC] Sincronizando status de verificação...');
              
              try {
                await updateDoc(userRef, {
                  verificadoPorSMS: true,
                  telefone: user.phoneNumber,
                  smsVerificadoEm: serverTimestamp(),
                  updatedAt: new Date().toISOString()
                });
                
                console.log('✅ [SMS-SYNC] Firestore atualizado para verificado');
                console.log('   verificadoPorSMS: true');
                console.log('   telefone:', user.phoneNumber);
              } catch (syncError) {
                console.error('❌ [SMS-SYNC] Erro ao sincronizar:', syncError);
              }
            } else {
              console.log('✅ [SMS-SYNC] Status já sincronizado (verificadoPorSMS: true)');
            }
          }
          
          // Limpar metadados se existirem
          const cadastroMetadata = localStorage.getItem('cadastroMetadata');
          if (cadastroMetadata) {
            localStorage.removeItem('cadastroMetadata');
            console.log('🧹 [AUTH-LISTENER] Metadados de cadastro removidos');
          }
          return;
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // 🚨 DOCUMENTO NÃO EXISTE - CRIAR IMEDIATAMENTE
        // ═══════════════════════════════════════════════════════════════════
        console.warn('⚠️ [AUTH-LISTENER] Documento não existe! Criando agora...');
        
        // Tentar obter metadados (OPCIONAL - pode não existir)
        let metadata = null;
        const cadastroMetadataStr = localStorage.getItem('cadastroMetadata');
        if (cadastroMetadataStr) {
          try {
            metadata = JSON.parse(cadastroMetadataStr);
            console.log('📋 [AUTH-LISTENER] Metadados encontrados:', {
              email: metadata.email,
              telefone: metadata.telefone,
              criadoSemSMS: metadata.criadoSemSMS
            });
          } catch (parseError) {
            console.warn('⚠️ [AUTH-LISTENER] Erro ao parsear metadados:', parseError);
            metadata = null;
          }
        } else {
          console.log('📋 [AUTH-LISTENER] Sem metadados - usando dados do Firebase Auth');
        }
        
        // ✅ OBTER DADOS: Preferir metadados, fallback para user
        const email = metadata?.email || user.email || '';
        const telefone = user.phoneNumber || metadata?.telefone || ''; // ✅ Auth é a verdade
        const deviceId = metadata?.deviceId || 'fallback_' + Date.now();
        const criadoSemSMS = metadata?.criadoSemSMS || false;
        
        // 🔥 REGRA DE OURO: user.phoneNumber === telefone verificado
        const verificadoPorSMS = !!user.phoneNumber;
        
        console.log('💾 [AUTH-LISTENER] Criando documento usuarios/ com dados:');
        console.log('   Email:', email);
        console.log('   Telefone:', telefone);
        console.log('   DeviceID:', deviceId?.substring(0, 16) + '...');
        console.log('   verificadoPorSMS:', verificadoPorSMS, '(baseado em user.phoneNumber)');
        console.log('   criadoSemSMS:', criadoSemSMS);
        
        // ✅ CRIAR DOCUMENTO
        await setDoc(userRef, {
          uid: user.uid,
          email: email,
          telefone: telefone,
          deviceId: deviceId,
          plan: 'free',
          messagesToday: 0,
          analysesToday: 0,
          messagesMonth: 0,
          analysesMonth: 0,
          imagesMonth: 0,
          billingMonth: new Date().toISOString().slice(0, 7),
          lastResetAt: new Date().toISOString().slice(0, 10),
          verificadoPorSMS: verificadoPorSMS,
          criadoSemSMS: criadoSemSMS,
          entrevistaConcluida: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        
        console.log('✅ [AUTH-LISTENER] Documento usuarios/ criado com sucesso!');
        
        // ✅ VERIFICAR CRIAÇÃO
        const verificacao = await getDoc(userRef);
        if (verificacao.exists()) {
          console.log('✅ [AUTH-LISTENER] CONFIRMADO: Documento existe no Firestore');
          console.log('   Dados completos:', verificacao.data());
          
          // Limpar metadados após sucesso
          if (cadastroMetadataStr) {
            localStorage.removeItem('cadastroMetadata');
            console.log('🧹 [AUTH-LISTENER] Metadados de cadastro removidos');
          }
        } else {
          console.error('❌ [AUTH-LISTENER] ERRO CRÍTICO: Documento não foi criado após setDoc!');
        }
        
      } catch (error) {
        console.error('❌ [AUTH-LISTENER] Erro ao processar Firestore:', error);
        console.error('   Código:', error.code);
        console.error('   Mensagem:', error.message);
        console.error('   Stack:', error.stack);
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

    console.log('✅ Sistema de autenticação carregado - Modo:', SMS_VERIFICATION_ENABLED ? 'SMS' : 'Email Direto');

  } catch (error) {
    console.error('❌ Erro crítico ao carregar auth.js:', error);
  }
})();