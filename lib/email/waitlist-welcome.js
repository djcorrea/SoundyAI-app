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
const INSTAGRAM_URL = 'https://instagram.com/soundyai';
const INSTAGRAM_HANDLE = '@soundyai';

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
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  
  <!-- Wrapper Table -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0f;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; background: linear-gradient(180deg, #12121a 0%, #0a0a0f 100%); border-radius: 16px; overflow: hidden; border: 1px solid rgba(168, 85, 247, 0.2);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center; border-bottom: 1px solid rgba(168, 85, 247, 0.15);">
              <!-- Logo Text -->
              <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 2px;">
                <span style="background: linear-gradient(135deg, #a855f7, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">SoundyAI</span>
              </h1>
              <p style="margin: 8px 0 0 0; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: rgba(255, 255, 255, 0.5);">
                Engenharia de Áudio com IA
              </p>
            </td>
          </tr>
          
          <!-- Success Badge -->
          <tr>
            <td style="padding: 35px 40px 0 40px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                  <td style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(6, 182, 212, 0.15)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 50px; padding: 10px 24px;">
                    <span style="color: #22c55e; font-size: 13px; font-weight: 600; letter-spacing: 1px;">✓ CONFIRMADO</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 30px 40px 20px 40px;">
              
              <!-- Greeting -->
              <h2 style="margin: 0 0 20px 0; font-size: 26px; font-weight: 700; color: #ffffff; line-height: 1.3; text-align: center;">
                ${firstName}, você fez a escolha certa.
              </h2>
              
              <!-- Opening paragraph -->
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.7; color: rgba(255, 255, 255, 0.8); text-align: center;">
                Poucos produtores vão ter a chance de acessar o SoundyAI antes de todo mundo.<br>
                <strong style="color: #a855f7;">Você é um deles.</strong>
              </p>
              
              <!-- Divider -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding: 20px 0;">
                    <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.3), transparent);"></div>
                  </td>
                </tr>
              </table>
              
              <!-- What is SoundyAI -->
              <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
                O que é o SoundyAI?
              </h3>
              
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.7; color: rgba(255, 255, 255, 0.75);">
                Uma <strong style="color: #06b6d4;">inteligência artificial</strong> que analisa seu áudio e te mostra 
                <em>exatamente</em> o que ajustar para alcançar o padrão profissional.
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.7; color: rgba(255, 255, 255, 0.75);">
                Nada de achismo. Nada de perder horas tentando entender o que está errado. 
                O SoundyAI te dá <strong style="color: #ffffff;">direção clara</strong> baseada em ciência de áudio 
                e referências reais do seu gênero.
              </p>
              
              <!-- Benefits mini-list -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
                <tr>
                  <td style="padding: 12px 16px; background: rgba(168, 85, 247, 0.08); border-radius: 8px; margin-bottom: 8px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td width="30" style="color: #a855f7; font-size: 16px;">🎯</td>
                        <td style="color: rgba(255, 255, 255, 0.85); font-size: 14px; line-height: 1.5;">
                          Análise detalhada de LUFS, True Peak, Dinâmica e Frequências
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 12px 16px; background: rgba(6, 182, 212, 0.08); border-radius: 8px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td width="30" style="color: #06b6d4; font-size: 16px;">🤖</td>
                        <td style="color: rgba(255, 255, 255, 0.85); font-size: 14px; line-height: 1.5;">
                          Sugestões personalizadas geradas por IA treinada em mixagens profissionais
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 12px 16px; background: rgba(34, 197, 94, 0.08); border-radius: 8px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td width="30" style="color: #22c55e; font-size: 16px;">⚡</td>
                        <td style="color: rgba(255, 255, 255, 0.85); font-size: 14px; line-height: 1.5;">
                          Resultados em segundos, não em horas de tentativa e erro
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Launch Date Box -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(6, 182, 212, 0.12)); border: 1px solid rgba(168, 85, 247, 0.25); border-radius: 12px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255, 255, 255, 0.5);">
                      Lançamento Oficial
                    </p>
                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: 1px;">
                      ${LAUNCH_DATE}
                    </p>
                    <p style="margin: 12px 0 0 0; font-size: 14px; color: rgba(255, 255, 255, 0.65);">
                      Você será avisado assim que liberarmos o acesso 🚀
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Instagram CTA -->
          <tr>
            <td style="padding: 0 40px 35px 40px; text-align: center;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: rgba(255, 255, 255, 0.8);">
                Enquanto isso, acompanhe os bastidores e conteúdos exclusivos:
              </p>
              
              <!-- Instagram Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                  <td style="border-radius: 10px; background: linear-gradient(135deg, #833AB4, #E1306C, #F77737);">
                    <a href="${INSTAGRAM_URL}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; letter-spacing: 0.5px;">
                      📸 Seguir ${INSTAGRAM_HANDLE}
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 16px 0 0 0; font-size: 13px; color: rgba(255, 255, 255, 0.5);">
                Dicas de produção, engenharia de áudio e novidades do lançamento
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: rgba(0, 0, 0, 0.3); border-top: 1px solid rgba(168, 85, 247, 0.1);">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: rgba(255, 255, 255, 0.6);">
                      Obrigado por acreditar no que estamos construindo.
                    </p>
                    <p style="margin: 0 0 20px 0; font-size: 13px; color: rgba(255, 255, 255, 0.4);">
                      Nos vemos no lançamento! 🎶
                    </p>
                    <p style="margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.3);">
                      Equipe SoundyAI
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
        <!-- End Main Container -->
        
        <!-- Unsubscribe Footer -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px;">
          <tr>
            <td style="padding: 24px 20px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: rgba(255, 255, 255, 0.3); line-height: 1.5;">
                Você recebeu este e-mail porque se cadastrou na lista de espera do SoundyAI.<br>
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
SOUNDYAI - VOCÊ ESTÁ NA LISTA! ✓

Olá ${firstName},

Você fez a escolha certa.

Poucos produtores vão ter a chance de acessar o SoundyAI antes de todo mundo. Você é um deles.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

O QUE É O SOUNDYAI?

Uma inteligência artificial que analisa seu áudio e te mostra exatamente o que ajustar para alcançar o padrão profissional.

• Análise detalhada de LUFS, True Peak, Dinâmica e Frequências
• Sugestões personalizadas geradas por IA
• Resultados em segundos, não em horas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 LANÇAMENTO OFICIAL: ${LAUNCH_DATE}

Você será avisado assim que liberarmos o acesso.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACOMPANHE OS BASTIDORES:
Instagram: ${INSTAGRAM_HANDLE}
${INSTAGRAM_URL}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Obrigado por acreditar no que estamos construindo.
Nos vemos no lançamento! 🎶

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
