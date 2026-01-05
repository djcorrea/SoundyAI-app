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
 * Sanitiza string para uso como tag do Resend
 * Resend aceita apenas: ASCII letters, numbers, underscores, dashes
 * 
 * @param {string} str - String para sanitizar
 * @param {string} fallback - Fallback se resultado ficar vazio
 * @returns {string} String sanitizada
 */
function sanitizeResendTag(str, fallback = 'unknown') {
  if (!str || typeof str !== 'string') {
    return fallback;
  }

  return str
    // Normalizar e remover diacríticos (acentos)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Converter para minúsculo
    .toLowerCase()
    // Trocar espaços e barras por underscore
    .replace(/[\s\/]/g, '_')
    // Remover tudo que não for a-z, 0-9, underscore ou dash
    .replace(/[^a-z0-9_-]/g, '')
    // Remover underscores/dashes consecutivos
    .replace(/[_-]+/g, '_')
    // Remover underscores/dashes no início/fim
    .replace(/^[_-]+|[_-]+$/g, '')
    // Limitar tamanho
    .substring(0, 64)
    // Se ficou vazio, usar fallback
    || fallback;
}

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

  // 🔍 LOG DA CONFIGURAÇÃO
  console.log(`🔗 [ONBOARDING] actionCodeSettings configurado:`);
  console.log(`🔗 [ONBOARDING] urlConfigured = ${actionCodeSettings.url}`);
  console.log(`🔗 [ONBOARDING] handleCodeInApp = ${actionCodeSettings.handleCodeInApp}`);

  try {
    const link = await auth.generatePasswordResetLink(email, actionCodeSettings);
    
    // 🔍 LOGS DETALHADOS PARA DIAGNÓSTICO
    console.log(`✅ [ONBOARDING] resetLinkGenerated = true`);
    
    // Validar estrutura do link
    const linkUrl = new URL(link);
    console.log(`🔗 [ONBOARDING] resetLinkHost = ${linkUrl.host}`);
    console.log(`🔗 [ONBOARDING] resetLinkPathname = ${linkUrl.pathname}`);
    console.log(`🔗 [ONBOARDING] resetLinkHasOobCode = ${link.includes('oobCode=')}`);
    console.log(`🔗 [ONBOARDING] resetLinkHasMode = ${link.includes('mode=')}`);
    
    // Log do link gerado (mascarando parte sensível em produção)
    const maskedLink = link.substring(0, 50) + '...' + link.substring(link.length - 20);
    console.log(`🔗 [ONBOARDING] Link mascarado: ${maskedLink}`);
    
    // ⚠️ VALIDAÇÃO CRÍTICA: Link DEVE conter oobCode
    if (!link.includes('oobCode=')) {
      const error = new Error('Link gerado pelo Firebase não contém oobCode!');
      console.error(`🚨 [ONBOARDING] ERRO CRÍTICO:`, error.message);
      throw error;
    }
    
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

  // 🔍 VALIDAÇÃO DO LINK ANTES DE USAR NO EMAIL
  console.log(`🔗 [ONBOARDING] ctaHrefUsed = ${passwordSetupLink.substring(0, 50)}...`);
  console.log(`✅ [ONBOARDING] ctaHasOobCode = ${passwordSetupLink.includes('oobCode=')}`);
  console.log(`✅ [ONBOARDING] ctaHasMode = ${passwordSetupLink.includes('mode=')}`);
  
  // ⚠️ VALIDAÇÃO CRÍTICA: Não enviar email sem oobCode
  if (!passwordSetupLink.includes('oobCode=')) {
    console.error('🚨 [ONBOARDING] BLOQUEIO DE ENVIO: Link sem oobCode!');
    return {
      success: false,
      error: 'Link de criar senha inválido (sem oobCode). Email não enviado.'
    };
  }

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
    ? 'Bem-vindo ao SoundyAI PRO — crie sua senha para acessar' 
    : 'Seu plano PRO foi renovado — redefina sua senha';

  try {
    const resend = new Resend(RESEND_API_KEY);

    console.log(`📧 [ONBOARDING] Enviando...`, {
      to: email,
      from: FROM_EMAIL,
      subject: emailSubject,
      transaction: transactionId
    });

    // Sanitizar tags para Resend (apenas ASCII letters, numbers, underscore, dash)
    const sanitizedTags = [
      { name: 'source', value: sanitizeResendTag('hotmart-onboarding') },
      { name: 'version', value: sanitizeResendTag('tech-premium-4.0') }
    ];

    console.log(`🏷️ [ONBOARDING] Tags sanitizadas:`, sanitizedTags);

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: emailSubject,
      html: htmlContent,
      text: textContent,
      tags: sanitizedTags
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
 * Constrói HTML tech premium para Gmail
 * Design: Roxo + Azul (sutil), fundo escuro suave, visual tech clean
 */
function buildCleanEmailHTML({ name, email, passwordSetupLink, isNewUser, formattedExpiration }) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao SoundyAI PRO</title>
  <style type="text/css">
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .content-padding { padding: 24px 20px !important; }
      .header-padding { padding: 32px 20px 24px !important; }
      .button { padding: 12px 24px !important; font-size: 14px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #1a1625 0%, #0f0f1e 100%); min-height: 100vh;">
  
  <!-- Container principal -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(135deg, #1a1625 0%, #0f0f1e 100%); padding: 40px 20px;">
    <tr>
      <td align="center">
        
        <!-- Card principal -->
        <table role="presentation" class="container" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);">
          
          <!-- Header com gradient tech -->
          <tr>
            <td style="position: relative; padding: 0;">
              <!-- Gradient bar tech -->
              <div style="height: 4px; background: linear-gradient(90deg, #6366f1 0%, #3b82f6 50%, #8b5cf6 100%); width: 100%;"></div>
              
              <!-- Logo e tagline -->
              <div class="header-padding" style="padding: 40px 40px 32px; text-align: center; background: linear-gradient(180deg, #fafafa 0%, #ffffff 100%);">
                <h1 style="margin: 0 0 8px; font-size: 36px; font-weight: 800; color: #0f0f1e; letter-spacing: -0.5px;">
                  SoundyAI
                </h1>
                <p style="margin: 0; font-size: 13px; color: #6b7280; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;">
                  Masterização inteligente • Análise técnica • Padrão streaming
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Hero section -->
          <tr>
            <td class="content-padding" style="padding: 40px 40px 32px; background-color: #ffffff;">
              
              <h2 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: #0f0f1e; line-height: 1.2;">
                Seu acesso ao SoundyAI PRO está ativo
              </h2>
              
              <p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #374151;">
                Olá, <strong style="color: #0f0f1e;">${name}</strong>
              </p>
              
              <p style="margin: 0 0 32px; font-size: 15px; line-height: 1.6; color: #4b5563;">
                A <strong>SoundyAI</strong> analisa sua música com métricas profissionais e recomenda ajustes práticos para você chegar mais rápido no som "de referência". Sua assinatura PRO está ativa até <strong>${formattedExpiration}</strong>.
              </p>
              
              <!-- CTA Principal -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="padding: 32px 24px; background: linear-gradient(135deg, #f0f3ff 0%, #faf5ff 100%); border-radius: 12px; border: 1px solid #e0e7ff;">
                    <p style="margin: 0 0 20px; font-size: 15px; font-weight: 600; color: #374151;">
                      ${isNewUser ? '🔐 Primeiro acesso: crie sua senha' : '🔐 Redefina sua senha para acessar'}
                    </p>
                    
                    <!-- Botão CTA -->
                    <a href="${passwordSetupLink}" class="button" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 16px; font-weight: 700; text-align: center; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4); transition: all 0.2s;">
                      Criar senha e acessar →
                    </a>
                    
                    <p style="margin: 20px 0 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                      Este link é seguro e expira em 1 hora. Se expirar, você pode solicitar outro no login.
                    </p>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Seção: O que você desbloqueou -->
          <tr>
            <td class="content-padding" style="padding: 32px 40px; background-color: #fafafa;">
              
              <h3 style="margin: 0 0 20px; font-size: 18px; font-weight: 700; color: #0f0f1e;">
                O que você desbloqueou no PRO
              </h3>
              
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding: 12px 0; font-size: 14px; color: #374151; line-height: 1.6;">
                    <span style="display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 50%; text-align: center; line-height: 24px; color: #ffffff; font-weight: 700; font-size: 12px; margin-right: 12px; vertical-align: middle;">✓</span>
                    <strong>Análises completas</strong> com métricas profissionais e diagnóstico detalhado
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-size: 14px; color: #374151; line-height: 1.6;">
                    <span style="display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 50%; text-align: center; line-height: 24px; color: #ffffff; font-weight: 700; font-size: 12px; margin-right: 12px; vertical-align: middle;">✓</span>
                    <strong>Comparação por referência</strong> (A/B) com faixas do mercado
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-size: 14px; color: #374151; line-height: 1.6;">
                    <span style="display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 50%; text-align: center; line-height: 24px; color: #ffffff; font-weight: 700; font-size: 12px; margin-right: 12px; vertical-align: middle;">✓</span>
                    <strong>Recomendações por gênero</strong> e padrão de streaming (Spotify, Apple Music, YouTube)
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-size: 14px; color: #374151; line-height: 1.6;">
                    <span style="display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 50%; text-align: center; line-height: 24px; color: #ffffff; font-weight: 700; font-size: 12px; margin-right: 12px; vertical-align: middle;">✓</span>
                    <strong>Relatório detalhado</strong> em PDF com gráficos e plano de ação
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-size: 14px; color: #374151; line-height: 1.6;">
                    <span style="display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 50%; text-align: center; line-height: 24px; color: #ffffff; font-weight: 700; font-size: 12px; margin-right: 12px; vertical-align: middle;">✓</span>
                    <strong>Análise espectral avançada</strong> (frequências, dinâmica, campo estéreo)
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-size: 14px; color: #374151; line-height: 1.6;">
                    <span style="display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 50%; text-align: center; line-height: 24px; color: #ffffff; font-weight: 700; font-size: 12px; margin-right: 12px; vertical-align: middle;">✓</span>
                    <strong>Acesso ao curso completo</strong> pela plataforma Hotmart
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Seção: Como começar em 60 segundos -->
          <tr>
            <td class="content-padding" style="padding: 32px 40px; background-color: #ffffff;">
              
              <h3 style="margin: 0 0 20px; font-size: 18px; font-weight: 700; color: #0f0f1e;">
                Como começar em 60 segundos
              </h3>
              
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
                    <div style="display: inline-block; width: 32px; height: 32px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); border-radius: 8px; text-align: center; line-height: 32px; color: #ffffff; font-weight: 800; font-size: 16px; margin-right: 16px; vertical-align: middle;">1</div>
                    <span style="font-size: 15px; color: #374151; font-weight: 500;">Clique em "Criar senha e acessar"</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
                    <div style="display: inline-block; width: 32px; height: 32px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); border-radius: 8px; text-align: center; line-height: 32px; color: #ffffff; font-weight: 800; font-size: 16px; margin-right: 16px; vertical-align: middle;">2</div>
                    <span style="font-size: 15px; color: #374151; font-weight: 500;">Faça login com sua nova senha</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 0;">
                    <div style="display: inline-block; width: 32px; height: 32px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); border-radius: 8px; text-align: center; line-height: 32px; color: #ffffff; font-weight: 800; font-size: 16px; margin-right: 16px; vertical-align: middle;">3</div>
                    <span style="font-size: 15px; color: #374151; font-weight: 500;">Envie seu áudio e receba o diagnóstico completo</span>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Links úteis -->
          <tr>
            <td class="content-padding" style="padding: 24px 40px; background-color: #fafafa;">
              
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding: 10px 0;">
                    <a href="${APP_URL}/index.html" style="color: #6366f1; text-decoration: none; font-size: 14px; font-weight: 600; transition: color 0.2s;">
                      → Acessar SoundyAI
                    </a>
                  </td>
                  <td style="padding: 10px 0; text-align: right;">
                    <a href="${APP_URL}/documento-tecnico.html" style="color: #6b7280; text-decoration: none; font-size: 14px; font-weight: 500;">
                      Documento Técnico
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <a href="${APP_URL}/gerenciar.html" style="color: #6b7280; text-decoration: none; font-size: 14px; font-weight: 500;">
                      Gerenciar conta
                    </a>
                  </td>
                  <td style="padding: 10px 0; text-align: right;">
                    <a href="mailto:suporte@soundyai.com.br" style="color: #6b7280; text-decoration: none; font-size: 14px; font-weight: 500;">
                      Suporte
                    </a>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Aviso de segurança -->
          <tr>
            <td class="content-padding" style="padding: 24px 40px 32px; background-color: #ffffff;">
              <div style="padding: 20px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b; border-radius: 8px;">
                <p style="margin: 0 0 8px; font-size: 14px; font-weight: 700; color: #92400e;">
                  🔒 Segurança
                </p>
                <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #78350f;">
                  Se você não fez essa compra ou não reconhece este e-mail, <strong>ignore esta mensagem</strong>. Seu acesso permanecerá seguro.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; background: linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%); border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0 0 12px; font-size: 13px; color: #6b7280; line-height: 1.6;">
                <strong>SoundyAI</strong> • Masterização Inteligente com IA<br>
                Dúvidas? Responda este e-mail ou acesse o suporte.
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                © ${new Date().getFullYear()} SoundyAI • <a href="https://soundyai.com.br" style="color: #6366f1; text-decoration: none;">soundyai.com.br</a>
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
