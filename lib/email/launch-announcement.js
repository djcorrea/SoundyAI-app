/**
 * 📧 E-MAIL DE LANÇAMENTO - Anúncio oficial do SoundyAI
 * 
 * ✅ Enviado para toda a lista de espera no dia do lançamento
 * ✅ Design premium, moderno e centralizado
 * ✅ Destaque para o treinamento "Do Beat ao Hit"
 * ✅ CTA indireto para página de vendas
 * 
 * @version 1.0.0
 * @created 2026-01-05
 */

import { Resend } from 'resend';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'SoundyAI <noreply@soundyai.com.br>';
const SALES_PAGE_URL = process.env.SALES_PAGE_URL || 'https://soundyai.com.br/lancamento';
const INSTAGRAM_URL = 'https://instagram.com/soundyaibr';

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE HTML - E-MAIL DE LANÇAMENTO
// ═══════════════════════════════════════════════════════════════════

/**
 * Gera o HTML do e-mail de lançamento
 * Design: Premium, dark theme, centralizado, moderno
 * 
 * @param {string} name - Nome do usuário
 * @returns {string} HTML completo do e-mail
 */
function generateLaunchEmailHTML(name) {
  const firstName = name.split(' ')[0];
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>O SoundyAI está no ar - Acesso Liberado</title>
  <style>
    @media only screen and (max-width: 600px) {
      .mobile-padding { padding: 24px 20px !important; }
      .mobile-title { font-size: 24px !important; }
      .mobile-text { font-size: 14px !important; }
      .mobile-btn { padding: 16px 28px !important; font-size: 14px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0f;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; background: linear-gradient(180deg, #0f0f1a 0%, #0a0a0f 100%); border-radius: 12px; overflow: hidden;">
          
          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 48px 40px 32px 40px;">
              <div style="font-size: 42px; font-weight: 800; letter-spacing: -0.5px; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); -webkit-background-clip: text; background-clip: text; color: transparent;">
                SoundyAI
              </div>
              <div style="margin-top: 8px; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255, 255, 255, 0.4); font-weight: 500;">
                Engenharia de Áudio com IA
              </div>
            </td>
          </tr>
          
          <!-- Badge de Lançamento -->
          <tr>
            <td align="center" style="padding: 0 40px 24px 40px;">
              <div style="display: inline-block; background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(99, 102, 241, 0.15)); border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 100px; padding: 12px 32px;">
                <span style="color: #a78bfa; font-size: 13px; font-weight: 700; letter-spacing: 1.5px;">🚀 LANÇAMENTO OFICIAL</span>
              </div>
            </td>
          </tr>
          
          <!-- Título Principal -->
          <tr>
            <td align="center" class="mobile-padding" style="padding: 0 50px 20px 50px;">
              <h1 class="mobile-title" style="margin: 0; font-size: 30px; font-weight: 700; color: #ffffff; line-height: 1.25; letter-spacing: -0.5px;">
                ${firstName}, o dia chegou
              </h1>
            </td>
          </tr>
          
          <!-- Texto de Abertura -->
          <tr>
            <td align="center" class="mobile-padding" style="padding: 0 50px 32px 50px;">
              <p class="mobile-text" style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.65; color: rgba(255, 255, 255, 0.75);">
                Você entrou na lista de espera antes de todo mundo.<br>
                Agora, o acesso está <span style="color: #a78bfa; font-weight: 600;">oficialmente liberado</span>.
              </p>
              <p class="mobile-text" style="margin: 0; font-size: 16px; line-height: 1.65; color: rgba(255, 255, 255, 0.75);">
                O SoundyAI está no ar — e quem chegou primeiro tem prioridade.
              </p>
            </td>
          </tr>
          
          <!-- Divisor -->
          <tr>
            <td style="padding: 0 60px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.25), transparent);"></div>
            </td>
          </tr>
          
          <!-- Seção do Treinamento -->
          <tr>
            <td align="center" style="padding: 40px 40px 24px 40px;">
              <div style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255, 255, 255, 0.4); margin-bottom: 12px; font-weight: 600;">
                Treinamento Exclusivo
              </div>
              <h2 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">
                Do Beat ao Hit
              </h2>
            </td>
          </tr>
          
          <!-- Descrição do Treinamento -->
          <tr>
            <td align="center" class="mobile-padding" style="padding: 0 50px 32px 50px;">
              <p class="mobile-text" style="margin: 0; font-size: 15px; line-height: 1.7; color: rgba(255, 255, 255, 0.7); text-align: center;">
                Um treinamento completo de <span style="color: #ffffff; font-weight: 500;">40 aulas</span> focado em produção de funk — do zero ao profissional.
              </p>
            </td>
          </tr>
          
          <!-- Cards de Módulos -->
          <tr>
            <td align="center" style="padding: 0 40px 32px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px;">
                
                <!-- Módulo 1 -->
                <tr>
                  <td align="center" style="padding: 14px 20px; background: rgba(139, 92, 246, 0.06); border-left: 3px solid #8b5cf6; border-radius: 8px;">
                    <div style="font-size: 20px; margin-bottom: 6px;">🎹</div>
                    <div style="color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500;">
                      Criação de Beats do Zero
                    </div>
                    <div style="color: rgba(255, 255, 255, 0.5); font-size: 12px; margin-top: 4px;">
                      Melodias, drums, arranjos e estrutura
                    </div>
                  </td>
                </tr>
                <tr><td style="height: 10px;"></td></tr>
                
                <!-- Módulo 2 -->
                <tr>
                  <td align="center" style="padding: 14px 20px; background: rgba(139, 92, 246, 0.06); border-left: 3px solid #6366f1; border-radius: 8px;">
                    <div style="font-size: 20px; margin-bottom: 6px;">🎤</div>
                    <div style="color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500;">
                      Voz, Mix e Plugins
                    </div>
                    <div style="color: rgba(255, 255, 255, 0.5); font-size: 12px; margin-top: 4px;">
                      Tratamento vocal e mixagem profissional
                    </div>
                  </td>
                </tr>
                <tr><td style="height: 10px;"></td></tr>
                
                <!-- Módulo 3 -->
                <tr>
                  <td align="center" style="padding: 14px 20px; background: rgba(139, 92, 246, 0.06); border-left: 3px solid #8b5cf6; border-radius: 8px;">
                    <div style="font-size: 20px; margin-bottom: 6px;">🤖</div>
                    <div style="color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500;">
                      Geração de Vocais com IA
                    </div>
                    <div style="color: rgba(255, 255, 255, 0.5); font-size: 12px; margin-top: 4px;">
                      Técnicas avançadas de síntese vocal
                    </div>
                  </td>
                </tr>
                <tr><td style="height: 10px;"></td></tr>
                
                <!-- Módulo 4 -->
                <tr>
                  <td align="center" style="padding: 14px 20px; background: rgba(139, 92, 246, 0.06); border-left: 3px solid #6366f1; border-radius: 8px;">
                    <div style="font-size: 20px; margin-bottom: 6px;">🎓</div>
                    <div style="color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500;">
                      Aulas Extras e Atualizações
                    </div>
                    <div style="color: rgba(255, 255, 255, 0.5); font-size: 12px; margin-top: 4px;">
                      Conteúdo bônus e novidades
                    </div>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Divisor -->
          <tr>
            <td style="padding: 0 60px 32px 60px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.15), transparent);"></div>
            </td>
          </tr>
          
          <!-- Bônus -->
          <tr>
            <td align="center" style="padding: 0 40px 32px 40px;">
              <div style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255, 255, 255, 0.4); margin-bottom: 16px; font-weight: 600;">
                Inclusos no Acesso
              </div>
              
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="padding: 8px 16px; background: rgba(34, 197, 94, 0.08); border-radius: 6px; margin-right: 8px;">
                    <span style="color: #22c55e; font-size: 13px;">📘 E-book de Melodias</span>
                  </td>
                  <td style="width: 12px;"></td>
                  <td style="padding: 8px 16px; background: rgba(34, 197, 94, 0.08); border-radius: 6px;">
                    <span style="color: #22c55e; font-size: 13px;">🎛️ Pack de Presets</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- CTA Principal -->
          <tr>
            <td align="center" style="padding: 16px 40px 48px 40px;">
              <a href="${SALES_PAGE_URL}" target="_blank" class="mobile-btn" style="display: inline-block; padding: 18px 40px; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); border-radius: 10px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; letter-spacing: 0.3px; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.35);">
                Clique aqui para entender como garantir seu acesso
              </a>
              
              <p style="margin: 20px 0 0 0; font-size: 13px; color: rgba(255, 255, 255, 0.4);">
                Acesso prioritário para quem entrou na lista de espera
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 32px 40px; border-top: 1px solid rgba(139, 92, 246, 0.1);">
              <p style="margin: 0 0 12px 0; font-size: 14px; color: rgba(255, 255, 255, 0.6);">
                Obrigado por acreditar no SoundyAI desde o início.
              </p>
              <p style="margin: 0 0 20px 0; font-size: 13px; color: rgba(255, 255, 255, 0.5);">
                Nos vemos do outro lado 🎶
              </p>
              <p style="margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.3); font-weight: 500;">
                Equipe SoundyAI
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Legal Footer -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px;">
          <tr>
            <td align="center" style="padding: 32px 20px;">
              <p style="margin: 0 0 8px 0; font-size: 11px; color: rgba(255, 255, 255, 0.25);">
                Você recebeu este e-mail porque faz parte da lista de espera do SoundyAI.
              </p>
              <p style="margin: 0; font-size: 11px; color: rgba(255, 255, 255, 0.25);">
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
 * Gera versão em texto simples do e-mail de lançamento
 * 
 * @param {string} name - Nome do usuário
 * @returns {string} Texto simples do e-mail
 */
function generateLaunchEmailText(name) {
  const firstName = name.split(' ')[0];
  
  return `
SOUNDYAI - LANÇAMENTO OFICIAL 🚀

Olá ${firstName},

O dia chegou.

Você entrou na lista de espera antes de todo mundo.
Agora, o acesso está oficialmente liberado.

O SoundyAI está no ar — e quem chegou primeiro tem prioridade.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TREINAMENTO EXCLUSIVO: DO BEAT AO HIT

Um treinamento completo de 40 aulas focado em produção de funk — do zero ao profissional.

O que você vai aprender:
• Criação de Beats do Zero (melodias, drums, arranjos)
• Voz, Mix e Plugins (tratamento vocal profissional)
• Geração de Vocais com IA (técnicas avançadas)
• Aulas Extras e Atualizações contínuas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INCLUSOS NO ACESSO:
📘 E-book de Melodias
🎛️ Pack de Presets

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👉 Clique aqui para entender como garantir seu acesso:
${SALES_PAGE_URL}

Acesso prioritário para quem entrou na lista de espera.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Obrigado por acreditar no SoundyAI desde o início.
Nos vemos do outro lado 🎶

Equipe SoundyAI

---
© 2026 SoundyAI. Todos os direitos reservados.
`;
}

// ═══════════════════════════════════════════════════════════════════
// FUNÇÃO DE ENVIO INDIVIDUAL
// ═══════════════════════════════════════════════════════════════════

/**
 * Envia e-mail de lançamento para um único lead
 * 
 * @param {Object} options - Dados do lead
 * @param {string} options.email - E-mail do destinatário
 * @param {string} options.name - Nome do usuário
 * @returns {Promise<Object>} { success: boolean, emailId?: string, error?: string }
 */
export async function sendLaunchEmail({ email, name }) {
  const startTime = Date.now();
  
  console.log(`📧 [LAUNCH-EMAIL] Enviando para: ${email}`);
  
  // Validar API Key
  if (!RESEND_API_KEY) {
    console.error('❌ [LAUNCH-EMAIL] RESEND_API_KEY não configurado');
    return { success: false, error: 'RESEND_API_KEY não configurado' };
  }
  
  // Validar e-mail
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    console.error('❌ [LAUNCH-EMAIL] E-mail inválido:', email);
    return { success: false, error: 'E-mail inválido' };
  }
  
  const safeName = name && name.trim().length > 0 ? name.trim() : 'Produtor';
  
  try {
    const resend = new Resend(RESEND_API_KEY);
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: `${safeName.split(' ')[0]}, o SoundyAI está no ar 🚀`,
      html: generateLaunchEmailHTML(safeName),
      text: generateLaunchEmailText(safeName),
      tags: [
        { name: 'type', value: 'launch_announcement' },
        { name: 'campaign', value: 'launch_2026_01_22' }
      ]
    });
    
    if (error) {
      console.error('❌ [LAUNCH-EMAIL] Erro Resend:', error);
      return { success: false, error: error.message || 'Erro ao enviar' };
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ [LAUNCH-EMAIL] Enviado: ${data.id} (${duration}ms)`);
    
    return { success: true, emailId: data.id, duration };
    
  } catch (error) {
    console.error('❌ [LAUNCH-EMAIL] Exceção:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// FUNÇÃO DE DISPARO EM MASSA
// ═══════════════════════════════════════════════════════════════════

/**
 * Dispara e-mail de lançamento para TODOS os leads da waitlist
 * 
 * ✅ IDEMPOTENTE: Verifica launchEmailSent antes de enviar
 * ✅ RESILIENTE: Não interrompe loop em caso de falha individual
 * ✅ AUDITÁVEL: Loga cada envio e atualiza Firestore
 * 
 * @param {Object} db - Instância do Firestore
 * @returns {Promise<Object>} Estatísticas do disparo
 */
export async function sendLaunchEmailsToAllWaitlist(db) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 [LAUNCH-BLAST] INICIANDO DISPARO DE E-MAILS DE LANÇAMENTO');
  console.log('═══════════════════════════════════════════════════════════');
  
  const startTime = Date.now();
  const stats = {
    total: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };
  
  try {
    // Buscar todos os leads elegíveis
    // status = "waiting" E launchEmailSent != true
    const waitlistRef = db.collection('waitlist');
    const snapshot = await waitlistRef
      .where('status', '==', 'waiting')
      .get();
    
    if (snapshot.empty) {
      console.log('⚠️ [LAUNCH-BLAST] Nenhum lead encontrado na waitlist');
      return { ...stats, message: 'Nenhum lead encontrado' };
    }
    
    stats.total = snapshot.size;
    console.log(`📊 [LAUNCH-BLAST] Total de leads na waitlist: ${stats.total}`);
    
    // Processar cada lead
    for (const doc of snapshot.docs) {
      const lead = doc.data();
      const docId = doc.id;
      
      // VERIFICAÇÃO DE IDEMPOTÊNCIA
      if (lead.launchEmailSent === true) {
        console.log(`⏭️ [LAUNCH-BLAST] Pulando ${lead.email} (já enviado)`);
        stats.skipped++;
        continue;
      }
      
      // Tentar enviar e-mail
      console.log(`📨 [LAUNCH-BLAST] Processando: ${lead.email}`);
      
      const result = await sendLaunchEmail({
        email: lead.email,
        name: lead.name || 'Produtor'
      });
      
      if (result.success) {
        // Atualizar documento no Firestore
        await doc.ref.update({
          launchEmailSent: true,
          launchEmailSentAt: new Date(),
          launchEmailId: result.emailId
        });
        
        stats.sent++;
        console.log(`✅ [LAUNCH-BLAST] ${stats.sent}/${stats.total} enviado: ${lead.email}`);
        
      } else {
        // Registrar falha mas NÃO interromper
        await doc.ref.update({
          launchEmailError: result.error,
          launchEmailAttemptedAt: new Date()
        });
        
        stats.failed++;
        stats.errors.push({ email: lead.email, error: result.error });
        console.error(`❌ [LAUNCH-BLAST] Falha: ${lead.email} - ${result.error}`);
      }
      
      // Rate limiting: aguardar 100ms entre envios para evitar throttling
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
  } catch (error) {
    console.error('❌ [LAUNCH-BLAST] Erro fatal:', error);
    stats.fatalError = error.message;
  }
  
  const duration = Date.now() - startTime;
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 [LAUNCH-BLAST] RELATÓRIO FINAL');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   Total: ${stats.total}`);
  console.log(`   Enviados: ${stats.sent}`);
  console.log(`   Pulados (já enviado): ${stats.skipped}`);
  console.log(`   Falhas: ${stats.failed}`);
  console.log(`   Duração: ${(duration / 1000).toFixed(1)}s`);
  console.log('═══════════════════════════════════════════════════════════');
  
  return {
    ...stats,
    duration,
    completedAt: new Date().toISOString()
  };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export default {
  sendLaunchEmail,
  sendLaunchEmailsToAllWaitlist,
  generateLaunchEmailHTML,
  generateLaunchEmailText
};
