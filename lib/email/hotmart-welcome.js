/**
 * 📧 SISTEMA DE E-MAIL HOTMART - BOAS-VINDAS PRO
 * 
 * ✅ Envia e-mail de boas-vindas com:
 *    - Confirmação do acesso ao curso + IA
 *    - Link direto para a IA
 *    - Credenciais de acesso (se usuário novo)
 *    - Informações sobre o plano PRO (4 meses)
 * 
 * ✅ Usa Resend (API moderna e gratuita para até 100 emails/dia)
 * 
 * @version 1.0.0
 * @created 2026-01-04
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.APP_URL || 'https://soundyai.com.br';
const FROM_EMAIL = process.env.FROM_EMAIL || 'SoundyAI <noreply@soundyai.com.br>';

/**
 * Envia e-mail de boas-vindas para usuário do combo Hotmart
 * @param {Object} options - Dados do usuário
 * @param {string} options.email - E-mail do destinatário
 * @param {string} options.name - Nome do usuário
 * @param {string|null} options.tempPassword - Senha provisória (apenas se usuário novo)
 * @param {boolean} options.isNewUser - Se é um usuário novo
 * @param {string} options.expiresAt - Data de expiração do PRO
 * @param {string} options.transactionId - ID da transação Hotmart
 * @returns {Promise<Object>} Resultado do envio
 */
export async function sendWelcomeProEmail({ 
  email, 
  name, 
  tempPassword, 
  isNewUser, 
  expiresAt, 
  transactionId 
}) {
  console.log(`📧 [EMAIL] Preparando e-mail de boas-vindas para: ${email}`);

  // Validar configuração
  if (!RESEND_API_KEY) {
    console.error('❌ [EMAIL] RESEND_API_KEY não configurado');
    throw new Error('Sistema de e-mail não configurado (RESEND_API_KEY ausente)');
  }

  // Formatar data de expiração
  const expirationDate = new Date(expiresAt);
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

  // Enviar via Resend
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: '🎉 Bem-vindo ao SoundyAI PRO! Seu acesso está liberado',
        html: htmlContent,
        text: textContent,
        tags: [
          { name: 'source', value: 'hotmart' },
          { name: 'plan', value: 'pro' },
          { name: 'transaction', value: transactionId }
        ]
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ [EMAIL] Erro na API Resend:', result);
      throw new Error(result.message || 'Erro ao enviar e-mail');
    }

    console.log(`✅ [EMAIL] E-mail enviado com sucesso! ID: ${result.id}`);
    return {
      success: true,
      emailId: result.id,
      to: email
    };

  } catch (error) {
    console.error('❌ [EMAIL] Falha ao enviar:', error.message);
    throw error;
  }
}

/**
 * Constrói o HTML do e-mail
 */
function buildEmailHTML({ name, email, tempPassword, isNewUser, formattedExpiration, daysRemaining, transactionId }) {
  const credentialsSection = isNewUser ? `
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
          ⚠️ <strong>Importante:</strong> Por segurança, troque sua senha no primeiro acesso.
        </p>
      </div>
    </div>
  ` : `
    <div style="background: rgba(0, 245, 255, 0.1); border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid rgba(0, 245, 255, 0.3);">
      <p style="color: #00f5ff; margin: 0; font-size: 15px;">
        ✅ Identificamos sua conta existente! Use suas credenciais atuais para fazer login.
      </p>
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

      <!-- Dicas -->
      <div style="background: rgba(0, 245, 255, 0.05); border-radius: 12px; padding: 20px; margin-top: 24px;">
        <h4 style="color: #00f5ff; margin: 0 0 12px 0; font-size: 15px;">💡 Dicas para começar:</h4>
        <ol style="color: #888; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>Faça login com seu e-mail e senha acima</li>
          <li>Faça upload da sua primeira música</li>
          <li>Escolha o gênero musical para análise personalizada</li>
          <li>Explore as sugestões da IA para melhorar seu mix</li>
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
  const credentials = isNewUser 
    ? `\n\n🔑 SUAS CREDENCIAIS:\n   E-mail: ${email}\n   Senha: ${tempPassword}\n\n   ⚠️ IMPORTANTE: Troque sua senha no primeiro acesso!\n`
    : `\n\n✅ Use suas credenciais atuais para fazer login.\n`;

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

💡 DICAS PARA COMEÇAR:
   1. Faça login com seu e-mail e senha
   2. Faça upload da sua primeira música
   3. Escolha o gênero musical
   4. Explore as sugestões da IA

Dúvidas? Responda este e-mail.

---
© ${new Date().getFullYear()} SoundyAI
soundyai.com.br
  `.trim();
}

export default {
  sendWelcomeProEmail
};
