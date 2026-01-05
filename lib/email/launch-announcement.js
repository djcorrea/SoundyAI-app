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
 * Copywriting: Neuromarketing, exclusividade, alta conversão
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
  <title>Acesso liberado - SoundyAI</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @media only screen and (max-width: 600px) {
      .mobile-padding { padding: 24px 20px !important; }
      .mobile-title { font-size: 22px !important; line-height: 1.3 !important; }
      .mobile-text { font-size: 15px !important; }
      .mobile-btn { padding: 16px 28px !important; font-size: 14px !important; }
      .mobile-card { padding: 16px !important; }
      .mobile-bonus { display: block !important; margin-bottom: 10px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  
  <!-- Preheader invisível (aparece na preview do e-mail) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    Você foi um dos primeiros a acreditar. Agora o acesso está liberado, e você tem prioridade.
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0f;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; background: linear-gradient(180deg, #0f0f1a 0%, #0a0a0f 100%); border-radius: 16px; overflow: hidden; border: 1px solid rgba(139, 92, 246, 0.08);">
          
          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 48px 40px 24px 40px;">
              <div style="font-size: 38px; font-weight: 800; letter-spacing: -0.5px; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent;">
                SoundyAI
              </div>
            </td>
          </tr>
          
          <!-- Abertura Forte - Validação + Privilégio -->
          <tr>
            <td align="center" class="mobile-padding" style="padding: 0 50px 16px 50px;">
              <p class="mobile-text" style="margin: 0; font-size: 15px; line-height: 1.7; color: rgba(255, 255, 255, 0.5);">
                ${firstName}, você foi um dos poucos que chegou antes.
              </p>
            </td>
          </tr>
          
          <!-- Título Principal -->
          <tr>
            <td align="center" class="mobile-padding" style="padding: 0 40px 24px 40px;">
              <h1 class="mobile-title" style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; line-height: 1.25; letter-spacing: -0.5px;">
                O acesso ao SoundyAI<br>acabou de ser liberado.
              </h1>
            </td>
          </tr>
          
          <!-- Contexto Rápido -->
          <tr>
            <td align="center" class="mobile-padding" style="padding: 0 50px 32px 50px;">
              <p class="mobile-text" style="margin: 0; font-size: 15px; line-height: 1.75; color: rgba(255, 255, 255, 0.7);">
                A partir de agora, quem usa o SoundyAI não precisa mais adivinhar. A IA analisa seu áudio e te mostra exatamente o que ajustar — com a precisão que só a tecnologia consegue entregar.
              </p>
            </td>
          </tr>
          
          <!-- Divisor sutil -->
          <tr>
            <td style="padding: 0 80px 32px 80px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.2), transparent);"></div>
            </td>
          </tr>
          
          <!-- Introdução aos Bônus -->
          <tr>
            <td align="center" class="mobile-padding" style="padding: 0 50px 24px 50px;">
              <p class="mobile-text" style="margin: 0; font-size: 15px; line-height: 1.7; color: rgba(255, 255, 255, 0.65);">
                Mas o SoundyAI é só o começo.
              </p>
              <p class="mobile-text" style="margin: 12px 0 0 0; font-size: 15px; line-height: 1.7; color: rgba(255, 255, 255, 0.65);">
                Por estar na lista antes do lançamento, você também garante acesso a:
              </p>
            </td>
          </tr>
          
          <!-- Bônus Secundários -->
          <tr>
            <td align="center" style="padding: 0 40px 24px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td class="mobile-bonus" style="padding: 10px 16px; background: rgba(139, 92, 246, 0.08); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.15);">
                    <span style="color: #a78bfa; font-size: 14px; font-weight: 500;">📘 E-book de Melodias</span>
                  </td>
                  <td style="width: 12px;"></td>
                  <td class="mobile-bonus" style="padding: 10px 16px; background: rgba(139, 92, 246, 0.08); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.15);">
                    <span style="color: #a78bfa; font-size: 14px; font-weight: 500;">🎛️ Pack de Presets</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Transição para o Bônus Principal -->
          <tr>
            <td align="center" class="mobile-padding" style="padding: 0 50px 32px 50px;">
              <p class="mobile-text" style="margin: 0; font-size: 15px; line-height: 1.7; color: rgba(255, 255, 255, 0.65);">
                E o principal:
              </p>
            </td>
          </tr>
          
          <!-- Card do Treinamento Principal -->
          <tr>
            <td align="center" style="padding: 0 30px 32px 30px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%); border-radius: 16px; border: 1px solid rgba(139, 92, 246, 0.2);">
                <tr>
                  <td class="mobile-card" style="padding: 32px 28px;">
                    
                    <!-- Badge -->
                    <div style="text-align: center; margin-bottom: 20px;">
                      <span style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 16px; border-radius: 100px;">
                        🎓 Treinamento Completo
                      </span>
                    </div>
                    
                    <!-- Título do Treinamento -->
                    <h2 style="margin: 0 0 16px 0; font-size: 26px; font-weight: 700; color: #ffffff; text-align: center; letter-spacing: -0.3px;">
                      Do Beat ao Hit
                    </h2>
                    
                    <!-- Descrição -->
                    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: rgba(255, 255, 255, 0.7); text-align: center;">
                      <span style="color: #ffffff; font-weight: 600;">40 aulas</span> focadas em produção de funk — do primeiro beat até a master final. Esse treinamento, sozinho, poderia ser vendido separadamente. Mas quem entrou na lista antes, leva junto.
                    </p>
                    
                    <!-- Lista de Módulos -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      
                      <tr>
                        <td style="padding: 12px 16px; background: rgba(0, 0, 0, 0.2); border-radius: 8px; margin-bottom: 8px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="width: 32px; vertical-align: top;">
                                <span style="font-size: 18px;">🎹</span>
                              </td>
                              <td>
                                <div style="color: #ffffff; font-size: 14px; font-weight: 600;">Criação de Beats</div>
                                <div style="color: rgba(255, 255, 255, 0.5); font-size: 12px; margin-top: 2px;">Melodias, drums, sintetizadores e arranjos</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr><td style="height: 8px;"></td></tr>
                      
                      <tr>
                        <td style="padding: 12px 16px; background: rgba(0, 0, 0, 0.2); border-radius: 8px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="width: 32px; vertical-align: top;">
                                <span style="font-size: 18px;">🎚️</span>
                              </td>
                              <td>
                                <div style="color: #ffffff; font-size: 14px; font-weight: 600;">Mix e Master</div>
                                <div style="color: rgba(255, 255, 255, 0.5); font-size: 12px; margin-top: 2px;">Plugins, tratamento vocal e finalização</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr><td style="height: 8px;"></td></tr>
                      
                      <tr>
                        <td style="padding: 12px 16px; background: rgba(0, 0, 0, 0.2); border-radius: 8px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="width: 32px; vertical-align: top;">
                                <span style="font-size: 18px;">🤖</span>
                              </td>
                              <td>
                                <div style="color: #ffffff; font-size: 14px; font-weight: 600;">Vocais com IA</div>
                                <div style="color: rgba(255, 255, 255, 0.5); font-size: 12px; margin-top: 2px;">Geração e manipulação de vozes sintéticas</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr><td style="height: 8px;"></td></tr>
                      
                      <tr>
                        <td style="padding: 12px 16px; background: rgba(0, 0, 0, 0.2); border-radius: 8px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="width: 32px; vertical-align: top;">
                                <span style="font-size: 18px;">🎓</span>
                              </td>
                              <td>
                                <div style="color: #ffffff; font-size: 14px; font-weight: 600;">Aulas Extras</div>
                                <div style="color: rgba(255, 255, 255, 0.5); font-size: 12px; margin-top: 2px;">Conteúdo bônus e atualizações contínuas</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      
                    </table>
                    
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Quebra de Comparação (sutil) -->
          <tr>
            <td align="center" class="mobile-padding" style="padding: 0 50px 32px 50px;">
              <p class="mobile-text" style="margin: 0; font-size: 14px; line-height: 1.7; color: rgba(255, 255, 255, 0.45); font-style: italic;">
                Enquanto alguns ainda vão continuar ajustando no achismo, você vai saber exatamente o que fazer.
              </p>
            </td>
          </tr>
          
          <!-- Divisor antes do CTA -->
          <tr>
            <td style="padding: 0 80px 32px 80px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.15), transparent);"></div>
            </td>
          </tr>
          
          <!-- CTA Principal -->
          <tr>
            <td align="center" style="padding: 0 40px 16px 40px;">
              <a href="${SALES_PAGE_URL}" target="_blank" class="mobile-btn" style="display: inline-block; padding: 18px 36px; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); border-radius: 12px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; letter-spacing: 0.2px; box-shadow: 0 8px 32px rgba(139, 92, 246, 0.4); transition: all 0.2s ease;">
                Clique aqui para entender como garantir seu acesso
              </a>
            </td>
          </tr>
          
          <!-- Texto de Urgência Sutil -->
          <tr>
            <td align="center" style="padding: 0 40px 48px 40px;">
              <p style="margin: 16px 0 0 0; font-size: 13px; color: rgba(255, 255, 255, 0.4);">
                Acesso prioritário para quem entrou na lista de espera.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 32px 40px; border-top: 1px solid rgba(139, 92, 246, 0.08);">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: rgba(255, 255, 255, 0.5);">
                Obrigado por acreditar desde o início.
              </p>
              <p style="margin: 0; font-size: 13px; color: rgba(255, 255, 255, 0.3); font-weight: 500;">
                Equipe SoundyAI
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Legal Footer -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px;">
          <tr>
            <td align="center" style="padding: 32px 20px;">
              <p style="margin: 0 0 8px 0; font-size: 11px; color: rgba(255, 255, 255, 0.2);">
                Você recebeu este e-mail porque faz parte da lista de espera do SoundyAI.
              </p>
              <p style="margin: 0; font-size: 11px; color: rgba(255, 255, 255, 0.2);">
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
${firstName}, você foi um dos poucos que chegou antes.

O acesso ao SoundyAI acabou de ser liberado.

A partir de agora, quem usa o SoundyAI não precisa mais adivinhar. A IA analisa seu áudio e te mostra exatamente o que ajustar — com a precisão que só a tecnologia consegue entregar.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Mas o SoundyAI é só o começo.

Por estar na lista antes do lançamento, você também garante acesso a:

📘 E-book de Melodias
🎛️ Pack de Presets

E o principal:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎓 TREINAMENTO COMPLETO: DO BEAT AO HIT

40 aulas focadas em produção de funk — do primeiro beat até a master final. Esse treinamento, sozinho, poderia ser vendido separadamente. Mas quem entrou na lista antes, leva junto.

O que você vai dominar:

🎹 Criação de Beats
   Melodias, drums, sintetizadores e arranjos

🎚️ Mix e Master
   Plugins, tratamento vocal e finalização

🤖 Vocais com IA
   Geração e manipulação de vozes sintéticas

🎓 Aulas Extras
   Conteúdo bônus e atualizações contínuas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Enquanto alguns ainda vão continuar ajustando no achismo, você vai saber exatamente o que fazer.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👉 Clique aqui para entender como garantir seu acesso:
${SALES_PAGE_URL}

Acesso prioritário para quem entrou na lista de espera.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Obrigado por acreditar desde o início.

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
      subject: `${safeName.split(' ')[0]}, seu acesso foi liberado`,
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
