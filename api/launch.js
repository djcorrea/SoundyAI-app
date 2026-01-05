/**
 * 📧 API LAUNCH BLAST - Endpoint para disparo de e-mails de lançamento
 * 
 * ✅ Dispara e-mails de lançamento para toda a lista de espera
 * ✅ Protegido por chave secreta (não exposto publicamente)
 * ✅ Idempotente: não envia duplicados
 * ✅ Endpoint para cron job agendado
 * 
 * IMPORTANTE:
 * - Este endpoint deve ser chamado APENAS pelo cron job agendado
 * - A chave LAUNCH_SECRET_KEY protege contra disparos acidentais
 * 
 * @version 1.0.0
 * @created 2026-01-05
 */

import express from 'express';
import { getFirestore } from '../work/firebase/admin.js';
import { sendLaunchEmailsToAllWaitlist, sendLaunchEmail } from '../lib/email/launch-announcement.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO DE SEGURANÇA
// ═══════════════════════════════════════════════════════════════════

/**
 * Chave secreta para autorizar o disparo
 * DEVE ser configurada no ambiente de produção
 */
const LAUNCH_SECRET_KEY = process.env.LAUNCH_SECRET_KEY || 'soundyai-launch-2026-01-22-secret';

/**
 * Data e horário programado do lançamento (America/Sao_Paulo)
 */
const LAUNCH_DATE = '2026-01-22';
const LAUNCH_HOUR = 12; // 12:00 horário de Brasília

// ═══════════════════════════════════════════════════════════════════
// MIDDLEWARE DE AUTENTICAÇÃO
// ═══════════════════════════════════════════════════════════════════

/**
 * Verifica se a requisição está autorizada
 */
function authorizeLaunch(req, res, next) {
  const authHeader = req.headers['x-launch-key'] || req.headers['authorization'];
  const queryKey = req.query.key;
  
  const providedKey = authHeader || queryKey;
  
  if (!providedKey) {
    console.warn('⚠️ [LAUNCH-API] Tentativa sem chave de autorização');
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Chave de autorização não fornecida'
    });
  }
  
  // Remover "Bearer " se presente
  const cleanKey = providedKey.replace('Bearer ', '').trim();
  
  if (cleanKey !== LAUNCH_SECRET_KEY) {
    console.warn('⚠️ [LAUNCH-API] Chave de autorização inválida');
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Chave de autorização inválida'
    });
  }
  
  next();
}

// ═══════════════════════════════════════════════════════════════════
// ROTA: POST /api/launch/blast
// Dispara e-mails para TODA a lista de espera
// ═══════════════════════════════════════════════════════════════════

router.post('/blast', authorizeLaunch, async (req, res) => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 [LAUNCH-API] REQUISIÇÃO DE DISPARO EM MASSA RECEBIDA');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   Horário: ${new Date().toISOString()}`);
  console.log(`   IP: ${req.ip}`);
  console.log('═══════════════════════════════════════════════════════════');
  
  const startTime = Date.now();
  
  try {
    // Opção para forçar disparo independente da data (para testes)
    const forceDispatch = req.body.force === true || req.query.force === 'true';
    
    // Verificar se está na data correta (proteção extra)
    if (!forceDispatch) {
      const now = new Date();
      const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const currentDate = brTime.toISOString().split('T')[0];
      const currentHour = brTime.getHours();
      
      if (currentDate !== LAUNCH_DATE) {
        console.log(`⚠️ [LAUNCH-API] Data incorreta: ${currentDate} (esperado: ${LAUNCH_DATE})`);
        return res.status(400).json({
          success: false,
          error: 'WRONG_DATE',
          message: `Disparo programado para ${LAUNCH_DATE}. Use force=true para teste.`,
          currentDate,
          expectedDate: LAUNCH_DATE
        });
      }
      
      if (currentHour < LAUNCH_HOUR) {
        console.log(`⚠️ [LAUNCH-API] Horário incorreto: ${currentHour}h (esperado: >= ${LAUNCH_HOUR}h)`);
        return res.status(400).json({
          success: false,
          error: 'WRONG_TIME',
          message: `Disparo programado para ${LAUNCH_HOUR}:00. Use force=true para teste.`,
          currentHour,
          expectedHour: LAUNCH_HOUR
        });
      }
    } else {
      console.log('⚠️ [LAUNCH-API] MODO FORCE ATIVADO - Ignorando verificação de data/hora');
    }
    
    // Obter instância do Firestore
    const db = getFirestore();
    
    // Executar disparo em massa
    const result = await sendLaunchEmailsToAllWaitlist(db);
    
    const duration = Date.now() - startTime;
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ [LAUNCH-API] DISPARO CONCLUÍDO');
    console.log('═══════════════════════════════════════════════════════════');
    
    return res.status(200).json({
      success: true,
      message: 'Disparo de e-mails concluído',
      stats: result,
      duration: `${(duration / 1000).toFixed(1)}s`
    });
    
  } catch (error) {
    console.error('❌ [LAUNCH-API] Erro no disparo:', error);
    
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ROTA: POST /api/launch/test
// Envia e-mail de teste para UM único destinatário
// ═══════════════════════════════════════════════════════════════════

router.post('/test', authorizeLaunch, async (req, res) => {
  console.log('🧪 [LAUNCH-API] Requisição de teste recebida');
  
  const { email, name } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_EMAIL',
      message: 'E-mail de teste é obrigatório'
    });
  }
  
  try {
    const result = await sendLaunchEmail({
      email,
      name: name || 'Teste'
    });
    
    if (result.success) {
      console.log(`✅ [LAUNCH-API] E-mail de teste enviado: ${result.emailId}`);
      return res.status(200).json({
        success: true,
        message: 'E-mail de teste enviado',
        emailId: result.emailId
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'SEND_FAILED',
        message: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ [LAUNCH-API] Erro no teste:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ROTA: GET /api/launch/status
// Verifica status da waitlist e e-mails já enviados
// ═══════════════════════════════════════════════════════════════════

router.get('/status', authorizeLaunch, async (req, res) => {
  console.log('📊 [LAUNCH-API] Requisição de status recebida');
  
  try {
    const db = getFirestore();
    const waitlistRef = db.collection('waitlist');
    
    // Contar totais
    const [allDocs, sentDocs, pendingDocs] = await Promise.all([
      waitlistRef.where('status', '==', 'waiting').get(),
      waitlistRef.where('launchEmailSent', '==', true).get(),
      waitlistRef.where('status', '==', 'waiting').where('launchEmailSent', '!=', true).get()
    ]);
    
    const stats = {
      total: allDocs.size,
      sent: sentDocs.size,
      pending: allDocs.size - sentDocs.size,
      launchDate: LAUNCH_DATE,
      launchHour: `${LAUNCH_HOUR}:00 (America/Sao_Paulo)`,
      currentTime: new Date().toISOString()
    };
    
    console.log('📊 [LAUNCH-API] Status:', stats);
    
    return res.status(200).json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('❌ [LAUNCH-API] Erro ao buscar status:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ROTA: POST /api/launch/schedule-check
// Endpoint para o cron job verificar se deve disparar
// ═══════════════════════════════════════════════════════════════════

router.post('/schedule-check', authorizeLaunch, async (req, res) => {
  console.log('⏰ [LAUNCH-API] Verificação de agendamento recebida');
  
  // Obter horário de Brasília
  const now = new Date();
  const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const currentDate = brTime.toISOString().split('T')[0];
  const currentHour = brTime.getHours();
  const currentMinute = brTime.getMinutes();
  
  console.log(`⏰ [LAUNCH-API] Horário atual (BR): ${currentDate} ${currentHour}:${currentMinute}`);
  
  // Verificar se está no horário certo
  const shouldDispatch = currentDate === LAUNCH_DATE && currentHour >= LAUNCH_HOUR;
  
  if (shouldDispatch) {
    console.log('🚀 [LAUNCH-API] HORÁRIO DE LANÇAMENTO ATINGIDO! Iniciando disparo...');
    
    try {
      const db = getFirestore();
      const result = await sendLaunchEmailsToAllWaitlist(db);
      
      return res.status(200).json({
        success: true,
        dispatched: true,
        message: 'Disparo executado com sucesso',
        stats: result
      });
      
    } catch (error) {
      console.error('❌ [LAUNCH-API] Erro no disparo agendado:', error);
      return res.status(500).json({
        success: false,
        dispatched: false,
        error: error.message
      });
    }
    
  } else {
    console.log('⏳ [LAUNCH-API] Ainda não é hora do disparo');
    
    return res.status(200).json({
      success: true,
      dispatched: false,
      message: 'Ainda não é hora do disparo',
      currentTime: `${currentDate} ${currentHour}:${currentMinute}`,
      scheduledTime: `${LAUNCH_DATE} ${LAUNCH_HOUR}:00`
    });
  }
});

export default router;
