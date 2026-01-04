/**
 * 📧 SISTEMA DE E-MAIL - ONBOARDING CLEAN PREMIUM
 * 
 * ✅ Design minimalista e profissional
 * ✅ Usa Firebase Password Reset Link como "Criar Senha"
 * ✅ Sem exibição de senha no e-mail
 * ✅ Compatível com Gmail (tabelas HTML, inline CSS)
 * ✅ Tolerante a falhas - NUNCA quebra o webhook
 * 
 * @version 3.0.0 - REDESIGN CLEAN PREMIUM
 * @updated 2026-01-04
 */

import { Resend } from 'resend';
import { getAuth } from '../../firebase/admin.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.APP_URL || 'https://soundyai.com.br';
const FROM_EMAIL = process.env.EMAIL_FROM || 'SoundyAI <noreply@soundyai.com.br>';

/**
 * Gera link de criação de senha do Firebase
 * @param {string} email - E-mail do usuário
 * @returns {Promise<string>} Link de criar senha
 */
async function generatePasswordSetupLink(email) {
  const auth = getAuth();
  
  const actionCodeSettings = {
    url: `${APP_URL}/primeiro-acesso.html`,
    handleCodeInApp: true,
  };

  try {
    const link = await auth.generatePasswordResetLink(email, actionCodeSettings);
    console.log(`🔗 [ONBOARDING] Link gerado para: ${email}`);
    return link;
  } catch (error) {
    console.error(`❌ [ONBOARDING] Erro ao gerar link:`, error);
    throw error;
  }
}

/**
 * Envia e-mail de onboarding clean premium
 * 
 * @param {Object} options - Dados do onboarding
 * @param {string} options.email - E-mail do destinatário
 * @param {string} options.name - Nome do usuário
 * @param {boolean} options.isNewUser - Se é usuário novo
 * @param {string} options.expiresAt - Data de expiração do PRO
 * @param {string} options.transactionId - ID da transação Hotmart
 * @returns {Promise<Object>} { success: boolean, emailId?: string, error?: string }
 */
export async function sendOnboardingEmail({ 
  email, 
  name, 
  isNewUser, 
  expiresAt, 
  transactionId 
}) {
  const startTime = Date.now();

  console.log(`📧 [ONBOARDING] Iniciando envio para: ${email}`, {
    name,
    isNewUser,
    transactionId
  });

  // ═══════════════════════════════════════════════════════════════
  // VALIDAÇÕES
  // ═══════════════════════════════════════════════════════════════
  
  if (!RESEND_API_KEY) {
    console.error('❌ [ONBOARDING] RESEND_API_KEY não configurado');
    return { success: false, error: 'RESEND_API_KEY não configurado' };
  }

  if (!email || !email.includes('@')) {
    console.error('❌ [ONBOARDING] E-mail inválido:', email);
    return { success: false, error: 'E-mail inválido' };
  }

  // ═══════════════════════════════════════════════════════════════
  // GERAR LINK DE CRIAR SENHA
  // ═══════════════════════════════════════════════════════════════
  
  let passwordSetupLink;
  try {
    passwordSetupLink = await generatePasswordSetupLink(email);
  } catch (error) {
    console.error('❌ [ONBOARDING] Falha ao gerar link:', error);
    return { 
      success: false, 
      error: `Falha ao gerar link: ${error.message}` 
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PREPARAR CONTEÚDO
  // ═══════════════════════════════════════════════════════════════
  
  const expirationDate = new Date(expiresAt);
  const formattedExpiration = expirationDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const htmlContent = buildCleanEmailHTML({
    name: name || 'Produtor',
    email,
    passwordSetupLink,
    isNewUser,
    formattedExpiration
  });

  const textContent = buildCleanEmailText({
    name: name || 'Produtor',
    passwordSetupLink,
    formattedExpiration
  });

  // ═══════════════════════════════════════════════════════════════
  // ENVIAR VIA RESEND
  // ═══════════════════════════════════════════════════════════════
  
  const emailSubject = isNewUser 
    ? 'Seu acesso ao SoundyAI PRO está ativo' 
    : 'Seu plano PRO foi renovado';

  try {
    const resend = new Resend(RESEND_API_KEY);

    console.log(`📧 [ONBOARDING] Enviando...`, {
      to: email,
      from: FROM_EMAIL,
      subject: emailSubject,
      transaction: transactionId
    });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: emailSubject,
      html: htmlContent,
      text: textContent,
      tags: [
        { name: 'source', value: 'hotmart-onboarding' },
        { name: 'version', value: 'clean-premium-3.0' }
      ]
    });

    if (error) {
      console.error('❌ [ONBOARDING] Resend retornou erro:', {
        errorName: error.name || 'unknown',
        errorMessage: error.message || 'Sem mensagem',
        statusCode: error.statusCode || error.status || 'N/A'
      });

      return {
        success: false,
        error: error.message || 'Erro desconhecido do Resend',
        errorName: error.name
      };
    }

    const elapsedTime = Date.now() - startTime;
    console.log(`✅ [ONBOARDING] E-mail enviado!`, {
      emailId: data.id,
      to: email,
      elapsedMs: elapsedTime
    });

    return {
      success: true,
      emailId: data.id,
      to: email
    };

  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    
    console.error('❌ [ONBOARDING] Exceção inesperada:', {
      message: error.message,
      stack: error.stack,
      elapsedMs: elapsedTime
    });

    return {
      success: false,
      error: error.message || 'Exceção desconhecida'
    };
  }
}

/**
 * Constrói HTML clean premium para Gmail
 */
function buildCleanEmailHTML({ name, email, passwordSetupLink, isNewUser, formattedExpiration }) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seu acesso ao SoundyAI PRO</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  
  <!-- Container principal -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f7; padding: 40px 20px;">
    <tr>
      <td align="center">
        
        <!-- Card principal -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
          
          <!-- Header com logo -->
          <tr>
            <td style="padding: 48px 40px 32px; text-align: center; border-bottom: 1px solid #e5e5e7;">
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 32px; font-weight: 700; color: #1d1d1f; margin-bottom: 8px;">
                SoundyAI
              </div>
              <div style="font-size: 14px; color: #86868b; font-weight: 500;">
                Masterização Inteligente
              </div>
            </td>
          </tr>
          
          <!-- Corpo principal -->
          <tr>
            <td style="padding: 40px 40px 48px;">
              
              <!-- Saudação -->
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #1d1d1f; line-height: 1.3;">
                ${isNewUser ? 'Bem-vindo' : 'Bem-vindo de volta'}, ${name}
              </h1>
              
              <p style="margin: 0 0 28px; font-size: 16px; line-height: 1.6; color: #515154;">
                Seu acesso ao <strong>SoundyAI PRO</strong> está ativo até <strong>${formattedExpiration}</strong>.
              </p>
              
              <!-- Box de ação -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f7; border-radius: 10px; padding: 24px; margin-bottom: 32px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #1d1d1f;">
                      ${isNewUser ? 'Próximo passo' : 'Acesse sua conta'}
                    </p>
                    <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.5; color: #515154;">
                      ${isNewUser 
                        ? 'Defina sua senha para acessar a plataforma pela primeira vez.' 
                        : 'Defina uma nova senha para acessar a plataforma.'}
                    </p>
                    
                    <!-- Botão CTA -->
                    <a href="${passwordSetupLink}" 
                       style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; text-align: center;">
                      Criar senha e acessar
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- O que está incluído -->
              <div style="margin-bottom: 32px;">
                <p style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #1d1d1f;">
                  Seu plano inclui:
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #515154;">
                      <span style="color: #6366f1; margin-right: 8px;">✓</span> Análises ilimitadas de áudio
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #515154;">
                      <span style="color: #6366f1; margin-right: 8px;">✓</span> Sugestões personalizadas por gênero
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #515154;">
                      <span style="color: #6366f1; margin-right: 8px;">✓</span> Comparação com faixas de referência
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Aviso de segurança -->
              <div style="padding: 16px; background-color: #f5f5f7; border-left: 3px solid #6366f1; border-radius: 0 6px 6px 0; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #515154;">
                  <strong style="color: #1d1d1f;">Link válido por 1 hora.</strong><br>
                  Se não foi você quem solicitou este acesso, ignore este e-mail.
                </p>
              </div>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #e5e5e7; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #86868b;">
                Dúvidas? Responda este e-mail.
              </p>
              <p style="margin: 0; font-size: 12px; color: #86868b;">
                © ${new Date().getFullYear()} SoundyAI • soundyai.com.br
              </p>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
  `;
}

/**
 * Constrói versão texto (fallback)
 */
function buildCleanEmailText({ name, passwordSetupLink, formattedExpiration }) {
  return `
SOUNDYAI PRO

Olá, ${name}!

Seu acesso ao SoundyAI PRO está ativo até ${formattedExpiration}.

PRÓXIMO PASSO:
Defina sua senha para acessar a plataforma:
${passwordSetupLink}

SEU PLANO INCLUI:
✓ Análises ilimitadas de áudio
✓ Sugestões personalizadas por gênero
✓ Comparação com faixas de referência

IMPORTANTE:
- Este link é válido por 1 hora
- Se não foi você quem solicitou, ignore este e-mail

Dúvidas? Responda este e-mail.

© ${new Date().getFullYear()} SoundyAI
soundyai.com.br
  `.trim();
}

export default {
  sendOnboardingEmail
};
