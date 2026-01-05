/**
 * 📧 SISTEMA DE E-MAIL WAITLIST - CONFIRMAÇÃO DE LISTA DE ESPERA
 * 
 * ✅ Envia e-mail elegante de confirmação quando usuário entra na waitlist
 * ✅ Design premium, clean e moderno
 * ✅ Copy estratégica para gerar expectativa e conexão
 * ✅ CTA para Instagram
 * 
 * @version 1.0.0
 * @created 2026-01-05
 */

import { Resend } from 'resend';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.APP_URL || 'https://soundyai.com.br';

// FROM_EMAIL usando domínio verificado no Resend
// Fallback para onboarding@resend.dev apenas em desenvolvimento
const FROM_EMAIL = process.env.EMAIL_FROM || 'SoundyAI <noreply@soundyai.com.br>';

// Data oficial do lançamento
const LAUNCH_DATE = '22 de janeiro de 2026';

// Instagram
const INSTAGRAM_URL = 'https://instagram.com/soundyaibr';
const INSTAGRAM_HANDLE = '@soundyaibr';

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE DE E-MAIL PREMIUM
// ═══════════════════════════════════════════════════════════════════

/**
 * Gera o HTML do e-mail de confirmação da waitlist
 * Design: Dark theme, minimalista, premium
 * 
 * @param {string} name - Nome do usuário
 * @returns {string} HTML completo do e-mail
 */
function generateWaitlistEmailHTML(name) {
  // Pegar apenas o primeiro nome para personalização
  const firstName = name.split(' ')[0];
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Você está na lista - SoundyAI</title>
  <style>
    @media only screen and (max-width: 600px) {
      .mobile-padding { padding: 24px 20px !important; }
      .mobile-text { font-size: 14px !important; }
      .mobile-title { font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  
  <!-- Wrapper Table -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0f;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; background: linear-gradient(180deg, #0f0f1a 0%, #0a0a0f 100%); border-radius: 12px; overflow: hidden;">
          
          <!-- Logo Section - Centralizado -->
          <tr>
            <td align="center" style="padding: 48px 40px 40px 40px;">
              <!-- Logo em SVG com cor roxa sólida -->
              <div style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); -webkit-background-clip: text; background-clip: text; color: transparent; font-size: 42px; font-weight: 800; letter-spacing: -0.5px; margin: 0;">
                SoundyAI
              </div>
              <div style="margin-top: 8px; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255, 255, 255, 0.4); font-weight: 500;">
                Engenharia de Áudio com IA
              </div>
            </td>
          </tr>
          
          <!-- Badge de Confirmação - Centralizado -->
          <tr>
            <td align="center" style="padding: 0 40px 32px 40px;">
              <div style="display: inline-block; background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 100px; padding: 10px 28px;">
                <span style="color: #8b5cf6; font-size: 12px; font-weight: 600; letter-spacing: 1.5px;">✓ CONFIRMADO</span>
              </div>
            </td>
          </tr>
          
          <!-- Título Principal - Centralizado -->
          <tr>
            <td align="center" class="mobile-padding" style="padding: 0 60px 24px 60px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; line-height: 1.3; letter-spacing: -0.5px;">
                ${firstName}, você fez a escolha certa
              </h1>
            </td>
          </tr>
          
          <!-- Texto de Abertura - Centralizado -->
          <tr>
            <td align="center" class="mobile-padding" style="padding: 0 60px 40px 60px;">
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: rgba(255, 255, 255, 0.7); font-weight: 400;">
                Poucos produtores terão acesso antecipado ao SoundyAI.<br>
                <span style="color: #8b5cf6; font-weight: 600;">Você é um deles.</span>
              </p>
            </td>
          </tr>
          
          <!-- Divisor -->
          <tr>
            <td style="padding: 0 60px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.2), transparent);"></div>
            </td>
          </tr>
          
          <!-- O que é o SoundyAI - Centralizado -->
          <tr>
            <td align="center" class="mobile-padding" style="padding: 40px 60px 20px 60px;">
              <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: -0.3px;">
                O que é o SoundyAI?
              </h2>
            </td>
          </tr>
          
          <tr>
            <td align="center" class="mobile-padding" style="padding: 0 60px 32px 60px;">
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.7; color: rgba(255, 255, 255, 0.7); text-align: center;">
                Uma inteligência artificial que analisa seu áudio e mostra <span style="color: #ffffff; font-weight: 500;">exatamente</span> o que ajustar para alcançar o padrão profissional.
              </p>
              
              <p style="margin: 0; font-size: 15px; line-height: 1.7; color: rgba(255, 255, 255, 0.7); text-align: center;">
                Sem achismo. Sem perder horas tentando descobrir o que está errado. O SoundyAI te dá <span style="color: #ffffff; font-weight: 500;">direção clara</span> baseada em ciência de áudio.
              </p>
            </td>
          </tr>
          
          <!-- Benefícios - Cards Minimalistas Centralizados -->
          <tr>
            <td align="center" style="padding: 0 40px 40px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px;">
                <tr>
                  <td align="center" style="padding: 16px 24px; background: rgba(139, 92, 246, 0.06); border-left: 3px solid #8b5cf6; border-radius: 8px; margin-bottom: 12px;">
                    <div style="font-size: 24px; margin-bottom: 8px;">🎯</div>
                    <div style="color: rgba(255, 255, 255, 0.85); font-size: 14px; line-height: 1.6;">
                      Análise detalhada de LUFS, True Peak,<br>Dinâmica e Frequências
                    </div>
                  </td>
                </tr>
                <tr><td style="height: 12px;"></td></tr>
                <tr>
                  <td align="center" style="padding: 16px 24px; background: rgba(139, 92, 246, 0.06); border-left: 3px solid #6366f1; border-radius: 8px; margin-bottom: 12px;">
                    <div style="font-size: 24px; margin-bottom: 8px;">🤖</div>
                    <div style="color: rgba(255, 255, 255, 0.85); font-size: 14px; line-height: 1.6;">
                      Sugestões personalizadas com base<br>em mixagens profissionais
                    </div>
                  </td>
                </tr>
                <tr><td style="height: 12px;"></td></tr>
                <tr>
                  <td align="center" style="padding: 16px 24px; background: rgba(139, 92, 246, 0.06); border-left: 3px solid #8b5cf6; border-radius: 8px;">
                    <div style="font-size: 24px; margin-bottom: 8px;">⚡</div>
                    <div style="color: rgba(255, 255, 255, 0.85); font-size: 14px; line-height: 1.6;">
                      Resultados em segundos,<br>não em horas de tentativa e erro
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Box de Data de Lançamento - Centralizado -->
          <tr>
            <td align="center" style="padding: 0 40px 40px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 12px;">
                <tr>
                  <td align="center" style="padding: 32px 24px;">
                    <div style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255, 255, 255, 0.4); margin-bottom: 12px; font-weight: 600;">
                      Lançamento Oficial
                    </div>
                    <div style="font-size: 28px; font-weight: 700; color: #ffffff; margin-bottom: 12px; letter-spacing: -0.5px;">
                      ${LAUNCH_DATE}
                    </div>
                    <div style="font-size: 14px; color: rgba(255, 255, 255, 0.6);">
                      Você será avisado assim que liberarmos o acesso
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- CTA Instagram - Centralizado -->
          <tr>
            <td align="center" style="padding: 0 40px 48px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 15px; color: rgba(255, 255, 255, 0.7);">
                Acompanhe os bastidores e conteúdos exclusivos
              </p>
              
              <!-- Botão Instagram -->
              <a href="${INSTAGRAM_URL}" target="_blank" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #833AB4, #E1306C); border-radius: 8px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; letter-spacing: 0.3px;">
                📸 Seguir ${INSTAGRAM_HANDLE}
              </a>
              
              <p style="margin: 16px 0 0 0; font-size: 13px; color: rgba(255, 255, 255, 0.4);">
                Dicas de produção e novidades do lançamento
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 32px 40px 40px 40px; border-top: 1px solid rgba(139, 92, 246, 0.1);">
              <p style="margin: 0 0 16px 0; font-size: 14px; color: rgba(255, 255, 255, 0.6); line-height: 1.5;">
                Obrigado por acreditar no que<br>estamos construindo.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 13px; color: rgba(255, 255, 255, 0.5);">
                Nos vemos no lançamento 🎶
              </p>
              <p style="margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.3); font-weight: 500;">
                Equipe SoundyAI
              </p>
            </td>
          </tr>
          
        </table>
        <!-- End Main Container -->
        
        <!-- Legal Footer -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px;">
          <tr>
            <td align="center" style="padding: 32px 20px;">
              <p style="margin: 0; font-size: 11px; color: rgba(255, 255, 255, 0.25); line-height: 1.6;">
                Você recebeu este e-mail porque se cadastrou na lista de espera.<br>
                © 2026 SoundyAI. Todos os direitos reservados.
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
 * Gera versão em texto simples do e-mail (fallback)
 * 
 * @param {string} name - Nome do usuário
 * @returns {string} Texto simples do e-mail
 */
function generateWaitlistEmailText(name) {
  const firstName = name.split(' ')[0];
  
  return `
SOUNDYAI - VOCÊ ESTÁ NA LISTA ✓

Olá ${firstName},

Você fez a escolha certa.

Poucos produtores terão acesso antecipado ao SoundyAI.
Você é um deles.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

O QUE É O SOUNDYAI?

Uma inteligência artificial que analisa seu áudio e mostra exatamente o que ajustar para alcançar o padrão profissional.

• Análise detalhada de LUFS, True Peak, Dinâmica e Frequências
• Sugestões personalizadas com base em mixagens profissionais
• Resultados em segundos, não em horas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 LANÇAMENTO OFICIAL: ${LAUNCH_DATE}

Você será avisado assim que liberarmos o acesso.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACOMPANHE OS BASTIDORES:
Instagram: ${INSTAGRAM_HANDLE}
${INSTAGRAM_URL}

Dicas de produção e novidades do lançamento.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Obrigado por acreditar no que estamos construindo.
Nos vemos no lançamento 🎶

Equipe SoundyAI

---
© 2026 SoundyAI. Todos os direitos reservados.
`;
}

// ═══════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL DE ENVIO
// ═══════════════════════════════════════════════════════════════════

/**
 * Envia e-mail de confirmação da waitlist
 * 
 * ✅ TOLERANTE A FALHAS: Nunca lança exceção
 * ✅ LOGS ESTRUTURADOS: Debug fácil
 * ✅ VALIDAÇÕES: Garante dados válidos
 * 
 * @param {Object} options - Dados do lead
 * @param {string} options.email - E-mail do destinatário
 * @param {string} options.name - Nome do usuário
 * @returns {Promise<Object>} { success: boolean, emailId?: string, error?: string }
 */
export async function sendWaitlistConfirmationEmail({ email, name }) {
  const startTime = Date.now();
  
  console.log(`📧 [WAITLIST-EMAIL] Iniciando envio para: ${email}`, {
    name,
    timestamp: new Date().toISOString()
  });
  
  // ═══════════════════════════════════════════════════════════════════
  // VALIDAÇÕES
  // ═══════════════════════════════════════════════════════════════════
  
  // Validar API Key
  if (!RESEND_API_KEY) {
    console.error('❌ [WAITLIST-EMAIL] RESEND_API_KEY não configurado');
    return { 
      success: false, 
      error: 'RESEND_API_KEY não configurado',
      shouldRetry: false 
    };
  }
  
  // Log seguro da API Key (apenas prefixo)
  const keyPrefix = RESEND_API_KEY.substring(0, 10);
  console.log(`🔑 [WAITLIST-EMAIL] API Key: ${keyPrefix}...`);
  
  // Validar e-mail
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    console.error('❌ [WAITLIST-EMAIL] E-mail inválido:', email);
    return { 
      success: false, 
      error: 'E-mail inválido',
      shouldRetry: false 
    };
  }
  
  // Validar nome (usar fallback se vazio)
  const safeName = name && name.trim().length > 0 ? name.trim() : 'Produtor';
  
  // ═══════════════════════════════════════════════════════════════════
  // ENVIO VIA RESEND SDK
  // ═══════════════════════════════════════════════════════════════════
  
  try {
    const resend = new Resend(RESEND_API_KEY);
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: 'Você está na lista, ' + safeName.split(' ')[0] + ' 🎵',
      html: generateWaitlistEmailHTML(safeName),
      text: generateWaitlistEmailText(safeName),
      tags: [
        { name: 'type', value: 'waitlist_confirmation' },
        { name: 'source', value: 'landing_pre_launch' }
      ]
    });
    
    if (error) {
      console.error('❌ [WAITLIST-EMAIL] Erro Resend:', error);
      return { 
        success: false, 
        error: error.message || 'Erro ao enviar e-mail',
        shouldRetry: true 
      };
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ [WAITLIST-EMAIL] Enviado com sucesso!`, {
      emailId: data.id,
      to: email,
      duration: `${duration}ms`
    });
    
    return { 
      success: true, 
      emailId: data.id,
      duration 
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ [WAITLIST-EMAIL] Exceção:', {
      message: error.message,
      code: error.code,
      duration: `${duration}ms`
    });
    
    return { 
      success: false, 
      error: error.message,
      shouldRetry: error.code !== 'validation_error' 
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT DEFAULT PARA COMPATIBILIDADE
// ═══════════════════════════════════════════════════════════════════

export default {
  sendWaitlistConfirmationEmail
};
