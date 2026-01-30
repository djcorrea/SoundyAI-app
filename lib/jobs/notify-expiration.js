/**
 * 📧 SISTEMA DE NOTIFICAÇÃO DE EXPIRAÇÃO - SoundyAI
 * 
 * ✅ Envia emails de aviso antes da expiração do plano
 * ✅ Três momentos: 7 dias antes, 3 dias antes, no dia
 * ✅ Marca notificações enviadas para evitar duplicatas
 * ✅ Integrável com job agendado (Railway Cron)
 * 
 * @version 1.0.0
 * @created 2026-01-30
 */

import { getFirestore } from '../../firebase/admin.js';

const USERS_COLLECTION = 'usuarios';

/**
 * Calcula quantos dias faltam até a data de expiração
 * @param {string|Date} expiresAt - Data de expiração
 * @returns {number} Dias até expiração (pode ser negativo se já expirou)
 */
function getDaysUntilExpiration(expiresAt) {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Envia email de aviso de expiração
 * @param {Object} params - Parâmetros do email
 * @param {string} params.email - Email do usuário
 * @param {string} params.name - Nome do usuário
 * @param {string} params.plan - Plano atual ('plus', 'pro', 'studio')
 * @param {number} params.daysLeft - Dias restantes
 * @param {string} params.expiresAt - Data de expiração (ISO string)
 * @returns {Promise<Object>} Resultado do envio
 */
async function sendExpirationEmail({ email, name, plan, daysLeft, expiresAt }) {
  try {
    console.log(`📧 [EXPIRATION-NOTICE] Enviando email para ${email}:`);
    console.log(`   Plano: ${plan.toUpperCase()}`);
    console.log(`   Dias restantes: ${daysLeft}`);
    console.log(`   Expira em: ${new Date(expiresAt).toLocaleDateString('pt-BR')}`);

    // TODO: Implementar envio real via Resend ou outro serviço de email
    // Por enquanto, apenas logamos (simula envio)
    
    const planNames = {
      plus: 'PLUS',
      pro: 'PRO',
      studio: 'STUDIO'
    };

    const planName = planNames[plan] || plan.toUpperCase();
    
    const subject = daysLeft > 0 
      ? `Seu plano ${planName} expira em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}`
      : `Seu plano ${planName} expira hoje`;

    const message = daysLeft > 0
      ? `Olá ${name}! Seu plano ${planName} expira em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'} (${new Date(expiresAt).toLocaleDateString('pt-BR')}). Renove agora para continuar aproveitando todos os recursos premium.`
      : `Olá ${name}! Seu plano ${planName} expira hoje (${new Date(expiresAt).toLocaleDateString('pt-BR')}). Renove agora para não perder acesso aos recursos premium.`;

    // Simular envio (substituir por implementação real)
    console.log(`✅ [EXPIRATION-NOTICE] Email simulado:`);
    console.log(`   To: ${email}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Message: ${message}`);

    return {
      success: true,
      emailId: `simulated-${Date.now()}`,
      to: email,
      subject,
      message
    };

  } catch (error) {
    console.error(`❌ [EXPIRATION-NOTICE] Erro ao enviar email:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Processa notificações para um tipo específico de plano
 * @param {Object} params - Parâmetros
 * @param {FirebaseFirestore} params.db - Instância do Firestore
 * @param {string} params.plan - Nome do plano ('plus', 'pro', 'studio')
 * @param {string} params.expiresField - Campo de expiração ('plusExpiresAt', 'proExpiresAt', etc)
 * @param {number} params.daysThreshold - Dias de antecedência (7, 3, 1)
 * @param {string} params.notificationKey - Chave da notificação ('day7', 'day3', 'day1')
 * @returns {Promise<Object>} Estatísticas de processamento
 */
async function processNotifications({ db, plan, expiresField, daysThreshold, notificationKey }) {
  const stats = {
    checked: 0,
    sent: 0,
    skipped: 0,
    errors: []
  };

  try {
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + daysThreshold);
    
    // Buscar usuários com plano ativo e data de expiração próxima
    const query = db.collection(USERS_COLLECTION)
      .where('plan', '==', plan)
      .where(expiresField, '!=', null);
    
    const snapshot = await query.get();
    
    console.log(`🔍 [EXPIRATION-NOTICE] Verificando plano ${plan.toUpperCase()} (${daysThreshold} dias):`);
    console.log(`   Total de usuários: ${snapshot.size}`);

    for (const doc of snapshot.docs) {
      stats.checked++;
      
      try {
        const userData = doc.data();
        const uid = doc.id;
        const expiresAt = userData[expiresField];
        
        // Calcular dias restantes
        const daysLeft = getDaysUntilExpiration(expiresAt);
        
        // Verificar se está no threshold correto (ex: exatamente 7 dias, ou 7 dias ou menos)
        const isInThreshold = (daysThreshold === 1) 
          ? (daysLeft <= 1 && daysLeft >= 0)  // Dia 1 ou dia 0
          : (daysLeft <= daysThreshold && daysLeft > daysThreshold - 1); // Exatamente no dia
        
        if (!isInThreshold) {
          continue;
        }

        // Verificar se já enviou esta notificação
        const notifications = userData.expirationNotifications || {};
        if (notifications[notificationKey]) {
          stats.skipped++;
          console.log(`⏭️ [EXPIRATION-NOTICE] ${uid} já recebeu notificação ${notificationKey}`);
          continue;
        }

        // Enviar email
        const emailResult = await sendExpirationEmail({
          email: userData.email,
          name: userData.displayName || userData.name || 'Usuário',
          plan,
          daysLeft,
          expiresAt
        });

        if (emailResult.success) {
          // Marcar notificação como enviada
          await doc.ref.update({
            [`expirationNotifications.${notificationKey}`]: true,
            [`expirationNotifications.${notificationKey}SentAt`]: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          stats.sent++;
          console.log(`✅ [EXPIRATION-NOTICE] Notificação enviada: ${uid} (${daysLeft} dias)`);
        } else {
          stats.errors.push({
            uid,
            error: emailResult.error || 'Falha ao enviar email'
          });
          console.error(`❌ [EXPIRATION-NOTICE] Falha ao enviar: ${uid}`);
        }

      } catch (err) {
        stats.errors.push({
          uid: doc.id,
          error: err.message
        });
        console.error(`❌ [EXPIRATION-NOTICE] Erro ao processar ${doc.id}:`, err.message);
      }
    }

  } catch (error) {
    console.error(`❌ [EXPIRATION-NOTICE] Erro crítico ao processar ${plan}:`, error.message);
    stats.errors.push({
      plan,
      error: error.message
    });
  }

  return stats;
}

/**
 * Executa o job de notificação de expiração
 * @returns {Promise<Object>} Resumo da execução
 */
export async function runExpirationNotificationJob() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📧 [EXPIRATION-NOTICE] Iniciando job de notificações');
  console.log('📅 [EXPIRATION-NOTICE] Data atual:', new Date().toISOString());

  const db = getFirestore();
  const summary = {
    total: 0,
    sent: 0,
    skipped: 0,
    errors: [],
    byPlan: {}
  };

  try {
    // Configuração de planos e thresholds
    const configs = [
      // 7 dias antes
      { plan: 'plus', expiresField: 'plusExpiresAt', daysThreshold: 7, notificationKey: 'day7' },
      { plan: 'pro', expiresField: 'proExpiresAt', daysThreshold: 7, notificationKey: 'day7' },
      { plan: 'studio', expiresField: 'studioExpiresAt', daysThreshold: 7, notificationKey: 'day7' },
      
      // 3 dias antes
      { plan: 'plus', expiresField: 'plusExpiresAt', daysThreshold: 3, notificationKey: 'day3' },
      { plan: 'pro', expiresField: 'proExpiresAt', daysThreshold: 3, notificationKey: 'day3' },
      { plan: 'studio', expiresField: 'studioExpiresAt', daysThreshold: 3, notificationKey: 'day3' },
      
      // 1 dia antes ou no dia
      { plan: 'plus', expiresField: 'plusExpiresAt', daysThreshold: 1, notificationKey: 'day1' },
      { plan: 'pro', expiresField: 'proExpiresAt', daysThreshold: 1, notificationKey: 'day1' },
      { plan: 'studio', expiresField: 'studioExpiresAt', daysThreshold: 1, notificationKey: 'day1' },
    ];

    // Processar cada configuração
    for (const config of configs) {
      const stats = await processNotifications({ db, ...config });
      
      const key = `${config.plan}_${config.notificationKey}`;
      summary.byPlan[key] = stats;
      summary.total += stats.checked;
      summary.sent += stats.sent;
      summary.skipped += stats.skipped;
      summary.errors.push(...stats.errors);
    }

    // Resultado final
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ [EXPIRATION-NOTICE] Job concluído!');
    console.log(`📊 [EXPIRATION-NOTICE] Resumo:`);
    console.log(`   - Total verificados: ${summary.total}`);
    console.log(`   - Emails enviados: ${summary.sent}`);
    console.log(`   - Ignorados (já notificados): ${summary.skipped}`);
    console.log(`   - Erros: ${summary.errors.length}`);
    console.log('═══════════════════════════════════════════════════════════');

    return summary;

  } catch (error) {
    console.error('💥 [EXPIRATION-NOTICE] Erro crítico:', error);
    summary.errors.push({ global: true, error: error.message });
    return summary;
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXECUÇÃO DIRETA (node lib/jobs/notify-expiration.js)
// ═══════════════════════════════════════════════════════════════════
const isDirectRun = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;

if (isDirectRun) {
  console.log('🚀 [EXPIRATION-NOTICE] Executando diretamente...');
  runExpirationNotificationJob()
    .then(summary => {
      console.log('\n📋 Resultado:', JSON.stringify(summary, null, 2));
      process.exit(summary.errors.length > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('💥 Erro fatal:', err);
      process.exit(1);
    });
}

export default { runExpirationNotificationJob };
