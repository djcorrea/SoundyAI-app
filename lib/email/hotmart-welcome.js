/**
 * 📧 SISTEMA DE E-MAIL HOTMART - BOAS-VINDAS PRO
 * 
 * ✅ Envia e-mail de boas-vindas com:
 *    - Confirmação do acesso ao curso + IA
 *    - Link direto para a IA
 *    - Credenciais de acesso (se usuário novo)
 *    - Informações sobre o plano PRO (4 meses)
 * 
 * ✅ Usa Resend SDK oficial
 * ✅ Tolerante a falhas - NUNCA quebra o webhook
 * ✅ Logs estruturados para debug rápido
 * ✅ Validações robustas
 * 
 * @version 2.0.0 - AUDITADO E BLINDADO
 * @updated 2026-01-04
 */

import { Resend } from 'resend';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO SEGURA - DOMÍNIO VERIFICADO COM FALLBACK
// ═══════════════════════════════════════════════════════════════════

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.APP_URL || 'https://soundyai.com.br';

/**
 * FROM_EMAIL usando domínio verificado no Resend
 * 
 * ✅ DOMÍNIO VERIFICADO: soundyai.com.br
 * ⚠️ NUNCA usar subdomínios não verificados (ex: send.soundyai.com.br)
 * ⚠️ NUNCA usar onboarding@resend.dev (só funciona para testes)
 * 
 * Pode ser sobrescrito por process.env.EMAIL_FROM se configurado
 */
const FROM_EMAIL = process.env.EMAIL_FROM || 'SoundyAI <noreply@soundyai.com.br>';

/**
 * Envia e-mail de boas-vindas para usuário do combo Hotmart
 * 
 * ✅ TOLERANTE A FALHAS: Nunca lança exceção que quebre o webhook
 * ✅ LOGS ESTRUTURADOS: Permite debug em 10 segundos
 * ✅ VALIDAÇÃO ROBUSTA: Garante dados válidos antes de enviar
 * 
 * @param {Object} options - Dados do usuário
 * @param {string} options.email - E-mail do destinatário
 * @param {string} options.name - Nome do usuário
 * @param {string|null} options.tempPassword - Senha provisória (apenas se usuário novo)
 * @param {boolean} options.isNewUser - Se é um usuário novo
 * @param {string} options.expiresAt - Data de expiração do PRO
 * @param {string} options.transactionId - ID da transação Hotmart
 * @returns {Promise<Object>} { success: boolean, emailId?: string, error?: string }
 */
export async function sendWelcomeProEmail({ 
  email, 
  name, 
  tempPassword, 
  isNewUser, 
  expiresAt, 
  transactionId 
}) {
  const startTime = Date.now();

  // ═══════════════════════════════════════════════════════════════════
  // VALIDAÇÕES CRÍTICAS - EVITAR ENVIO DE LIXO
  // ═══════════════════════════════════════════════════════════════════
  
  console.log(`📧 [EMAIL] Iniciando envio para: ${email}`, {
    name,
    isNewUser,
    transactionId,
    hasTempPassword: !!tempPassword
  });

  // Validar API Key (sem vazar a chave nos logs)
  if (!RESEND_API_KEY) {
    console.error('❌ [EMAIL ERROR] RESEND_API_KEY não configurado no ambiente. E-mail não será enviado, mas webhook continua.');
    return { 
      success: false, 
      error: 'RESEND_API_KEY não configurado' 
    };
  }

  // Detectar chave de teste (começa com re_test_ ou contém "test")
  const isTestKey = RESEND_API_KEY.startsWith('re_test_') || RESEND_API_KEY.toLowerCase().includes('test');
  if (isTestKey) {
    console.error('⚠️ [EMAIL WARNING] RESEND_API_KEY parece ser uma chave de TESTE. E-mails só serão enviados para o próprio e-mail cadastrado no Resend. Use uma chave LIVE para produção.');
    // NÃO retorna erro - deixa tentar enviar (vai falhar se destinatário não for o owner)
  }

  // Log seguro: mostra apenas prefixo da chave para confirmar configuração
  const keyPrefix = RESEND_API_KEY.substring(0, 10);
  console.log(`🔑 [EMAIL] API Key configurada: ${keyPrefix}...`);

  // Validar e-mail
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    console.error('❌ [EMAIL ERROR] E-mail inválido:', email);
    return { 
      success: false, 
      error: 'E-mail inválido ou vazio' 
    };
  }

  // Validar data de expiração
  if (!expiresAt) {
    console.error('❌ [EMAIL ERROR] Data de expiração ausente');
    return { 
      success: false, 
      error: 'Data de expiração ausente' 
    };
  }

  const expirationDate = new Date(expiresAt);
  if (isNaN(expirationDate.getTime())) {
    console.error('❌ [EMAIL ERROR] Data de expiração inválida:', expiresAt);
    return { 
      success: false, 
      error: 'Data de expiração inválida' 
    };
  }

  // Validar transaction ID
  if (!transactionId) {
    console.error('❌ [EMAIL ERROR] Transaction ID ausente');
    return { 
      success: false, 
      error: 'Transaction ID ausente' 
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // PREPARAÇÃO DO CONTEÚDO
  // ═══════════════════════════════════════════════════════════════════

  // Formatar data de expiração
  const formattedExpiration = expirationDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  // Calcular dias restantes
  const daysRemaining = Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // Construir HTML do e-mail
  const htmlContent = buildEmailHTML({
    name: name || 'Produtor',
    email,
    tempPassword,
    isNewUser,
    formattedExpiration,
    daysRemaining,
    transactionId
  });

  // Construir versão texto
  const textContent = buildEmailText({
    name: name || 'Produtor',
    email,
    tempPassword,
    isNewUser,
    formattedExpiration,
    daysRemaining
  });

  // ═══════════════════════════════════════════════════════════════════
  // ENVIO VIA RESEND SDK - TOLERANTE A FALHAS
  // ═══════════════════════════════════════════════════════════════════

  const emailSubject = '🎉 Bem-vindo ao SoundyAI PRO! Seu acesso está liberado';

  try {
    // Inicializar SDK
    const resend = new Resend(RESEND_API_KEY);

    // Log ANTES do envio: destinatário, remetente e subject
    console.log(`📧 [EMAIL] Preparando envio via Resend...`, {
      to: email,
      from: FROM_EMAIL,
      domainUsed: FROM_EMAIL.match(/@([^>]+)/)?.[1] || 'unknown',
      subject: emailSubject,
      isNewUser,
      transaction: transactionId
    });

    // Enviar e-mail
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: emailSubject,
      html: htmlContent,
      text: textContent,
      tags: [
        { name: 'source', value: 'hotmart' },
        { name: 'plan', value: 'pro' },
        { name: 'transaction', value: transactionId }
      ]
    });

    // Verificar resposta do SDK
    if (error) {
      const elapsedTime = Date.now() - startTime;
      console.error('❌ [EMAIL ERROR] Resend retornou erro:', {
        errorName: error.name || 'unknown',
        errorMessage: error.message || 'Sem mensagem',
        statusCode: error.statusCode || error.status || 'N/A',
        to: email,
        from: FROM_EMAIL,
        transaction: transactionId,
        elapsedMs: elapsedTime
      });
      
      // Dica de debug para erro comum de chave de teste
      if (error.message && error.message.includes('testing emails')) {
        console.error('💡 [EMAIL HINT] Este erro indica que você está usando uma API Key de TESTE. Use uma chave LIVE do Resend para enviar para qualquer destinatário.');
      }
      
      // ⚠️ CRÍTICO: Retornar erro, mas NÃO lançar exceção
      return {
        success: false,
        error: error.message || 'Erro desconhecido do Resend',
        errorName: error.name,
        statusCode: error.statusCode || error.status
      };
    }

    // Sucesso!
    const elapsedTime = Date.now() - startTime;
    console.log(`✅ [EMAIL SUCCESS] E-mail enviado com sucesso!`, {
      emailId: data.id,
      to: email,
      from: FROM_EMAIL,
      subject: emailSubject,
      transaction: transactionId,
      elapsedMs: elapsedTime
    });

    return {
      success: true,
      emailId: data.id,
      to: email
    };

  } catch (error) {
    // ⚠️ CRÍTICO: Capturar QUALQUER erro e logar
    // NUNCA permitir que exceção quebre o webhook
    const elapsedTime = Date.now() - startTime;
    
    console.error('❌ [EMAIL EXCEPTION] Falha inesperada ao enviar e-mail:', {
      message: error.message,
      stack: error.stack,
      email,
      transaction: transactionId,
      elapsedMs: elapsedTime
    });

    // Retornar erro gracefully
    return {
      success: false,
      error: error.message || 'Exceção desconhecida ao enviar e-mail'
    };
  }
}

/**
 * Constrói o HTML do e-mail
 */
function buildEmailHTML({ name, email, tempPassword, isNewUser, formattedExpiration, daysRemaining, transactionId }) {
  // ═══════════════════════════════════════════════════════════════════
  // SEÇÃO DE CREDENCIAIS - DIFERENCIADA POR TIPO DE USUÁRIO
  // ═══════════════════════════════════════════════════════════════════
  
  const credentialsSection = isNewUser ? `
    <!-- 🆕 USUÁRIO NOVO: Mostrar senha provisória -->
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #00f5ff;">
      <h3 style="color: #00f5ff; margin: 0 0 16px 0; font-size: 18px;">🔑 Suas Credenciais de Acesso</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #888; width: 100px;">E-mail:</td>
          <td style="padding: 8px 0; color: #fff; font-family: monospace; font-size: 14px;">${email}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #888;">Senha:</td>
          <td style="padding: 8px 0; color: #00f5ff; font-family: monospace; font-size: 16px; font-weight: bold;">${tempPassword}</td>
        </tr>
      </table>
      <div style="background: rgba(255, 193, 7, 0.1); border-left: 4px solid #ffc107; padding: 12px; margin-top: 16px; border-radius: 0 8px 8px 0;">
        <p style="color: #ffc107; margin: 0; font-size: 14px;">
          ⚠️ <strong>Importante:</strong> Por segurança, recomendamos trocar sua senha após o primeiro acesso.
          <br><span style="color: #ccc; font-size: 13px;">Você pode fazer isso em "Gerenciar Conta" dentro do app.</span>
        </p>
      </div>
    </div>
  ` : `
    <!-- ✅ USUÁRIO EXISTENTE: NÃO mostrar senha, instruir recuperação -->
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #00ff88;">
      <h3 style="color: #00ff88; margin: 0 0 16px 0; font-size: 18px;">✅ Conta Identificada!</h3>
      <p style="color: #ccc; margin: 0 0 12px 0; font-size: 15px; line-height: 1.6;">
        Encontramos uma conta existente com o e-mail <strong style="color: #fff;">${email}</strong>.
        <br>Seu plano PRO já foi ativado automaticamente!
      </p>
      <div style="background: rgba(0, 245, 255, 0.1); border-left: 4px solid #00f5ff; padding: 12px; margin-top: 16px; border-radius: 0 8px 8px 0;">
        <p style="color: #00f5ff; margin: 0; font-size: 14px;">
          🔐 <strong>Não lembra sua senha?</strong>
          <br><span style="color: #ccc; font-size: 13px;">
            Na tela de login, clique em <strong>"Esqueci minha senha"</strong> para receber um link de redefinição por e-mail.
          </span>
        </p>
      </div>
    </div>
  `;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao SoundyAI PRO</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0f;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #0d0d12 0%, #1a1a2e 100%); border-radius: 16px 16px 0 0;">
      <div style="font-size: 48px; margin-bottom: 16px;">🎵</div>
      <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 700;">
        Bem-vindo ao <span style="background: linear-gradient(135deg, #00f5ff, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">SoundyAI PRO</span>
      </h1>
      <p style="color: #888; margin: 12px 0 0 0; font-size: 16px;">
        Sua inteligência artificial para masterização profissional
      </p>
    </div>

    <!-- Main Content -->
    <div style="background: #12121a; padding: 32px; border-radius: 0 0 16px 16px;">
      
      <!-- Saudação -->
      <p style="color: #fff; font-size: 18px; margin: 0 0 24px 0;">
        Olá, <strong>${name}</strong>! 👋
      </p>

      <p style="color: #ccc; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        Sua compra foi <strong style="color: #00ff88;">confirmada com sucesso</strong>! Agora você tem acesso ao 
        <strong style="color: #8b5cf6;">curso completo</strong> pela Hotmart e ao 
        <strong style="color: #00f5ff;">SoundyAI PRO</strong> por 4 meses.
      </p>

      <!-- Credenciais -->
      ${credentialsSection}

      <!-- Card PRO -->
      <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <div style="font-size: 32px; margin-bottom: 8px;">👑</div>
        <h2 style="color: #fff; margin: 0 0 8px 0; font-size: 22px;">Plano PRO Ativo!</h2>
        <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 15px;">
          Válido até <strong>${formattedExpiration}</strong>
        </p>
        <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0 0; font-size: 13px;">
          (${daysRemaining} dias restantes)
        </p>
      </div>

      <!-- O que você tem acesso -->
      <h3 style="color: #fff; font-size: 18px; margin: 32px 0 16px 0;">
        🚀 O que está incluído no seu acesso:
      </h3>

      <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 20px;">
        <ul style="color: #ccc; font-size: 14px; line-height: 2; margin: 0; padding-left: 20px;">
          <li>✅ <strong>Curso completo</strong> pela plataforma Hotmart</li>
          <li>✅ <strong>Análises ilimitadas</strong> de áudio</li>
          <li>✅ <strong>Sugestões de IA</strong> personalizadas por gênero</li>
          <li>✅ <strong>Comparação A/B</strong> com músicas de referência</li>
          <li>✅ <strong>Relatórios PDF</strong> profissionais</li>
          <li>✅ <strong>Chat com IA</strong> para tirar dúvidas técnicas</li>
          <li>✅ <strong>Análise espectral avançada</strong></li>
          <li>✅ <strong>Planos de correção</strong> detalhados</li>
        </ul>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${APP_URL}/index.html" 
           style="display: inline-block; background: linear-gradient(135deg, #00f5ff 0%, #00d4aa 100%); color: #000; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 20px rgba(0, 245, 255, 0.3);">
          🎧 ACESSAR O SOUNDYAI AGORA
        </a>
      </div>

      <!-- Dicas - Diferenciadas por tipo de usuário -->
      <div style="background: rgba(0, 245, 255, 0.05); border-radius: 12px; padding: 20px; margin-top: 24px;">
        <h4 style="color: #00f5ff; margin: 0 0 12px 0; font-size: 15px;">💡 ${isNewUser ? 'Dicas para começar:' : 'Próximos passos:'}</h4>
        <ol style="color: #888; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
          ${isNewUser ? `
          <li>Faça login com seu e-mail e a senha provisória acima</li>
          <li>Troque sua senha em "Gerenciar Conta" (recomendado)</li>
          <li>Faça upload da sua primeira música</li>
          <li>Escolha o gênero musical para análise personalizada</li>
          ` : `
          <li>Faça login com seu e-mail e senha atuais</li>
          <li>Se não lembrar a senha, use "Esqueci minha senha"</li>
          <li>Aproveite todas as features PRO desbloqueadas!</li>
          <li>Explore as sugestões da IA para melhorar seu mix</li>
          `}
        </ol>
      </div>

      <!-- Suporte -->
      <div style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 32px; padding-top: 24px; text-align: center;">
        <p style="color: #666; font-size: 13px; margin: 0;">
          Dúvidas? Responda este e-mail ou acesse o chat da IA no app.
        </p>
        <p style="color: #444; font-size: 12px; margin: 12px 0 0 0;">
          ID da transação: ${transactionId}
        </p>
      </div>

    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px; color: #444; font-size: 12px;">
      <p style="margin: 0;">
        © ${new Date().getFullYear()} SoundyAI - Inteligência Artificial para Produtores Musicais
      </p>
      <p style="margin: 8px 0 0 0;">
        <a href="${APP_URL}" style="color: #00f5ff; text-decoration: none;">soundyai.com.br</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

/**
 * Constrói a versão texto do e-mail (fallback)
 */
function buildEmailText({ name, email, tempPassword, isNewUser, formattedExpiration, daysRemaining }) {
  // ═══════════════════════════════════════════════════════════════════
  // SEÇÃO DE CREDENCIAIS - DIFERENCIADA POR TIPO DE USUÁRIO
  // ═══════════════════════════════════════════════════════════════════
  
  const credentials = isNewUser 
    ? `

🔑 SUAS CREDENCIAIS DE ACESSO:
   E-mail: ${email}
   Senha provisória: ${tempPassword}

   ⚠️ IMPORTANTE: Recomendamos trocar sua senha após o primeiro acesso.
   Você pode fazer isso em "Gerenciar Conta" dentro do app.
`
    : `

✅ CONTA IDENTIFICADA!
   Encontramos uma conta existente com o e-mail ${email}.
   Seu plano PRO já foi ativado automaticamente!

   🔐 Não lembra sua senha?
   Na tela de login, clique em "Esqueci minha senha" para
   receber um link de redefinição por e-mail.
`;

  const tips = isNewUser
    ? `
💡 DICAS PARA COMEÇAR:
   1. Faça login com seu e-mail e a senha provisória
   2. Troque sua senha em "Gerenciar Conta" (recomendado)
   3. Faça upload da sua primeira música
   4. Escolha o gênero musical`
    : `
💡 PRÓXIMOS PASSOS:
   1. Faça login com seu e-mail e senha atuais
   2. Se não lembrar a senha, use "Esqueci minha senha"
   3. Aproveite todas as features PRO desbloqueadas!
   4. Explore as sugestões da IA`;

  return `
🎵 BEM-VINDO AO SOUNDYAI PRO!

Olá, ${name}!

Sua compra foi confirmada com sucesso! Agora você tem acesso ao curso completo pela Hotmart e ao SoundyAI PRO por 4 meses.
${credentials}
👑 PLANO PRO ATIVO
   Válido até: ${formattedExpiration}
   (${daysRemaining} dias restantes)

🚀 O QUE ESTÁ INCLUÍDO:
   ✅ Curso completo pela Hotmart
   ✅ Análises ilimitadas de áudio
   ✅ Sugestões de IA personalizadas
   ✅ Comparação A/B com referências
   ✅ Relatórios PDF profissionais
   ✅ Chat com IA
   ✅ Análise espectral avançada
   ✅ Planos de correção detalhados

🔗 ACESSE AGORA:
   ${APP_URL}/index.html
${tips}

Dúvidas? Responda este e-mail.

---
© ${new Date().getFullYear()} SoundyAI
soundyai.com.br
  `.trim();
}

export default {
  sendWelcomeProEmail
};
