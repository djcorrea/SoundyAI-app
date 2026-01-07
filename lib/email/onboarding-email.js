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
 * @param {string} options.expiresAt - Data de expiração do plano
 * @param {string} options.transactionId - ID da transação
 * @param {string} options.planName - Nome do plano (default: 'Premium')
 * @returns {Promise<Object>} { success: boolean, emailId?: string, error?: string }
 */
export async function sendOnboardingEmail({ 
  email, 
  name, 
  isNewUser, 
  expiresAt, 
  transactionId,
  planName = 'Premium'
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
    formattedExpiration,
    planName
  });

  const textContent = buildCleanEmailText({
    name: name || 'Produtor',
    passwordSetupLink,
    formattedExpiration,
    planName
  });

  // ═══════════════════════════════════════════════════════════════
  // ENVIAR VIA RESEND
  // ═══════════════════════════════════════════════════════════════
  
  const emailSubject = isNewUser 
    ? `Bem-vindo ao SoundyAI ${planName} — crie sua senha para acessar` 
    : `Seu plano ${planName} foi renovado — redefina sua senha`;

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
 * ESTRUTURA BULLETPROOF: 100% compatível Gmail desktop/mobile, sem overflow
 */
function buildCleanEmailHTML({ name, email, passwordSetupLink, isNewUser, formattedExpiration, planName = 'Premium' }) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Bem-vindo ao SoundyAI ${planName}</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse:collapse;border-spacing:0;border:0;margin:0;}
    div, td {padding:0;}
    div {margin:0 !important;}
  </style>
  <![endif]-->
  <style type="text/css">
    @media only screen and (max-width: 600px) {
      .wrapper { width: 100% !important; }
      .container { width: 100% !important; max-width: 100% !important; }
      .mobile-padding { padding: 20px 16px !important; }
      .mobile-text { font-size: 14px !important; line-height: 1.5 !important; }
      .button { padding: 14px 28px !important; font-size: 15px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; width:100%; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  
  <!-- WRAPPER EXTERNO 100% -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0; padding:0; width:100%; background: linear-gradient(135deg, #1a1625 0%, #0f0f1e 100%);">
    <tr>
      <td align="center" style="padding:40px 0;">
        
        <!-- CONTAINER PRINCIPAL 600px -->
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,0.4);">
          
          <!-- HEADER -->
          <tr>
            <td style="padding:0;">
              <!-- Gradient bar -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:4px; background:linear-gradient(90deg, #6366f1 0%, #3b82f6 50%, #8b5cf6 100%); line-height:4px; font-size:1px;">&nbsp;</td>
                </tr>
              </table>
              
              <!-- Logo -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="mobile-padding" style="padding:40px 24px 32px; text-align:center; background:linear-gradient(180deg, #fafafa 0%, #ffffff 100%);">
                    <h1 style="margin:0 0 8px; font-size:36px; font-weight:800; color:#0f0f1e; letter-spacing:-0.5px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">SoundyAI</h1>
                    <p style="margin:0; font-size:13px; color:#6b7280; font-weight:500; letter-spacing:0.5px; text-transform:uppercase;">Masterização inteligente • Análise técnica</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- HERO SECTION -->
          <tr>
            <td class="mobile-padding" style="padding:40px 24px 32px; background-color:#ffffff;">
              <h2 style="margin:0 0 16px; font-size:28px; font-weight:700; color:#0f0f1e; line-height:1.2; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Seu acesso ao SoundyAI ${planName} está ativo</h2>
              
              <p style="margin:0 0 12px; font-size:16px; line-height:1.6; color:#374151; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Olá, <strong style="color:#0f0f1e;">${name}</strong></p>
              
              <p style="margin:0 0 12px; font-size:15px; line-height:1.6; color:#4b5563; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; word-break:break-word; overflow-wrap:anywhere;">A <strong>SoundyAI</strong> analisa sua música com métricas profissionais e recomenda ajustes práticos. Sua assinatura ${planName} está ativa até <strong>${formattedExpiration}</strong>.</p>
              
              <p style="margin:0 0 32px; font-size:14px; line-height:1.6; color:#6b7280; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Após esse período, você pode renovar com planos mensais.</p>
              
              <!-- CTA BOX -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td style="padding:32px 20px; background:linear-gradient(135deg, #f0f3ff 0%, #faf5ff 100%); border-radius:12px; border:1px solid #e0e7ff;">
                    <p style="margin:0 0 20px; font-size:15px; font-weight:600; color:#374151; text-align:center; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">${isNewUser ? '🔐 Primeiro acesso: crie sua senha' : '🔐 Redefina sua senha para acessar'}</p>
                    
                    <!-- BOTÃO CTA BULLETPROOF -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                      <tr>
                        <td align="center" bgcolor="#6366f1" style="border-radius:10px; background:linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); box-shadow:0 4px 14px rgba(99,102,241,0.4);">
                          <a href="${passwordSetupLink}" class="button" style="display:block; padding:16px 40px; color:#ffffff; text-decoration:none; font-size:16px; font-weight:700; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; word-break:break-word;">Criar senha e acessar →</a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin:20px 0 0; font-size:12px; color:#6b7280; line-height:1.5; text-align:center; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">⚠️ Este link expira em <strong>1 hora</strong> por segurança.<br>Se expirar, use a opção "Esqueci minha senha" no login.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- O QUE VOCÊ DESBLOQUEOU -->
          <tr>
            <td class="mobile-padding" style="padding:32px 24px; background-color:#fafafa;">
              <h3 style="margin:0 0 20px; font-size:18px; font-weight:700; color:#0f0f1e; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">O que você desbloqueou no ${planName}</h3>
              
              <!-- LISTA COM TABELAS (BULLETPROOF) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:12px 0; font-size:14px; color:#374151; line-height:1.6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; word-break:break-word;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="28" valign="top" style="padding-right:12px;">
                          <div style="width:24px; height:24px; background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%); border-radius:50%; text-align:center; line-height:24px; color:#ffffff; font-weight:700; font-size:12px;">✓</div>
                        </td>
                        <td style="font-size:14px; color:#374151; line-height:1.6;"><strong>Análises completas</strong> com métricas profissionais e diagnóstico detalhado</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0; font-size:14px; color:#374151; line-height:1.6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; word-break:break-word;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="28" valign="top" style="padding-right:12px;">
                          <div style="width:24px; height:24px; background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%); border-radius:50%; text-align:center; line-height:24px; color:#ffffff; font-weight:700; font-size:12px;">✓</div>
                        </td>
                        <td style="font-size:14px; color:#374151; line-height:1.6;"><strong>Comparação por referência</strong> (A/B) com faixas do mercado</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0; font-size:14px; color:#374151; line-height:1.6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; word-break:break-word;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="28" valign="top" style="padding-right:12px;">
                          <div style="width:24px; height:24px; background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%); border-radius:50%; text-align:center; line-height:24px; color:#ffffff; font-weight:700; font-size:12px;">✓</div>
                        </td>
                        <td style="font-size:14px; color:#374151; line-height:1.6;"><strong>Recomendações por gênero</strong> e padrão de streaming</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0; font-size:14px; color:#374151; line-height:1.6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; word-break:break-word;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="28" valign="top" style="padding-right:12px;">
                          <div style="width:24px; height:24px; background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%); border-radius:50%; text-align:center; line-height:24px; color:#ffffff; font-weight:700; font-size:12px;">✓</div>
                        </td>
                        <td style="font-size:14px; color:#374151; line-height:1.6;"><strong>Relatório detalhado</strong> em PDF com gráficos</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0; font-size:14px; color:#374151; line-height:1.6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; word-break:break-word;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="28" valign="top" style="padding-right:12px;">
                          <div style="width:24px; height:24px; background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%); border-radius:50%; text-align:center; line-height:24px; color:#ffffff; font-weight:700; font-size:12px;">✓</div>
                        </td>
                        <td style="font-size:14px; color:#374151; line-height:1.6;"><strong>Análise espectral avançada</strong> (frequências, dinâmica)</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0; font-size:14px; color:#374151; line-height:1.6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; word-break:break-word;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="28" valign="top" style="padding-right:12px;">
                          <div style="width:24px; height:24px; background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%); border-radius:50%; text-align:center; line-height:24px; color:#ffffff; font-weight:700; font-size:12px;">✓</div>
                        </td>
                        <td style="font-size:14px; color:#374151; line-height:1.6;"><strong>Acesso ao curso completo</strong> pela plataforma Hotmart</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- COMO COMEÇAR -->
          <tr>
            <td class="mobile-padding" style="padding:32px 24px; background-color:#ffffff;">
              <h3 style="margin:0 0 20px; font-size:18px; font-weight:700; color:#0f0f1e; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Como começar em 60 segundos</h3>
              
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:16px 0; border-bottom:1px solid #e5e7eb;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="40" valign="middle" style="padding-right:16px;">
                          <div style="width:32px; height:32px; background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%); border-radius:8px; text-align:center; line-height:32px; color:#ffffff; font-weight:800; font-size:16px;">1</div>
                        </td>
                        <td style="font-size:15px; color:#374151; font-weight:500; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; word-break:break-word;">Clique em "Criar senha e acessar"</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 0; border-bottom:1px solid #e5e7eb;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="40" valign="middle" style="padding-right:16px;">
                          <div style="width:32px; height:32px; background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%); border-radius:8px; text-align:center; line-height:32px; color:#ffffff; font-weight:800; font-size:16px;">2</div>
                        </td>
                        <td style="font-size:15px; color:#374151; font-weight:500; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; word-break:break-word;">Faça login com sua nova senha</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="40" valign="middle" style="padding-right:16px;">
                          <div style="width:32px; height:32px; background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%); border-radius:8px; text-align:center; line-height:32px; color:#ffffff; font-weight:800; font-size:16px;">3</div>
                        </td>
                        <td style="font-size:15px; color:#374151; font-weight:500; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; word-break:break-word;">Envie seu áudio e receba o diagnóstico</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- LINKS ÚTEIS -->
          <tr>
            <td class="mobile-padding" style="padding:24px; background-color:#fafafa;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="50%" style="padding:10px 10px 10px 0;">
                    <a href="${APP_URL}/index.html" style="color:#6366f1; text-decoration:none; font-size:14px; font-weight:600; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; word-break:break-word;">→ Acessar SoundyAI</a>
                  </td>
                  <td width="50%" align="right" style="padding:10px 0 10px 10px;">
                    <a href="${APP_URL}/documento-tecnico.html" style="color:#6b7280; text-decoration:none; font-size:14px; font-weight:500; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; word-break:break-word;">Documento Técnico</a>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:10px 10px 10px 0;">
                    <a href="${APP_URL}/gerenciar.html" style="color:#6b7280; text-decoration:none; font-size:14px; font-weight:500; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; word-break:break-word;">Gerenciar conta</a>
                  </td>
                  <td width="50%" align="right" style="padding:10px 0 10px 10px;">
                    <a href="mailto:suporte@soundyai.com.br" style="color:#6b7280; text-decoration:none; font-size:14px; font-weight:500; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; word-break:break-word;">Suporte</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- AVISO DE SEGURANÇA -->
          <tr>
            <td class="mobile-padding" style="padding:24px 24px 32px; background-color:#ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left:4px solid #f59e0b; border-radius:8px;">
                <tr>
                  <td style="padding:20px; word-break:break-word;">
                    <p style="margin:0 0 8px; font-size:14px; font-weight:700; color:#92400e; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">🔒 Segurança</p>
                    <p style="margin:0; font-size:13px; line-height:1.6; color:#78350f; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Se você não fez essa compra, <strong>ignore esta mensagem</strong>. Seu acesso permanecerá seguro.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- FOOTER -->
          <tr>
            <td style="padding:32px 24px; background:linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%); border-top:1px solid #e5e7eb; text-align:center;">
              <p style="margin:0 0 12px; font-size:13px; color:#6b7280; line-height:1.6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; word-break:break-word;"><strong>SoundyAI</strong> • Masterização Inteligente com IA<br>Dúvidas? Responda este e-mail ou acesse o suporte.</p>
              <p style="margin:0; font-size:12px; color:#9ca3af; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">© ${new Date().getFullYear()} SoundyAI • <a href="https://soundyai.com.br" style="color:#6366f1; text-decoration:none; word-break:break-word;">soundyai.com.br</a></p>
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
function buildCleanEmailText({ name, passwordSetupLink, formattedExpiration, planName = 'Premium' }) {
  return `
SOUNDYAI ${planName.toUpperCase()}

Olá, ${name}!

Seu acesso ao SoundyAI ${planName} está ativo até ${formattedExpiration}.

PRÓXIMO PASSO:
Defina sua senha para acessar a plataforma:
${passwordSetupLink}

⚠️ ATENÇÃO: Este link expira em 1 hora por segurança.
Se expirar, use "Esqueci minha senha" na página de login.

SEU PLANO INCLUI:
✓ Análises ilimitadas de áudio
✓ Sugestões personalizadas por gênero
✓ Comparação com faixas de referência

Dúvidas? Responda este e-mail.

© ${new Date().getFullYear()} SoundyAI
soundyai.com.br
  `.trim();
}

export default {
  sendOnboardingEmail
};
