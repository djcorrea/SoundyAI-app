/**
 * 📊 PARTNER DASHBOARD API - READ-ONLY
 * 
 * Endpoint para consultar métricas de afiliados
 * 
 * ⚠️ CRÍTICO: 100% READ-ONLY
 * - NÃO escreve nada no Firestore
 * - NÃO altera documentos existentes
 * - Apenas agrega e retorna dados
 * 
 * ✅ SEGURANÇA:
 * - Usa Admin SDK (bypassa Firestore Rules)
 * - Validação rigorosa de partnerId
 * - Rate limit simples
 * - Logs detalhados
 * 
 * @route GET /api/partner/dashboard?partnerId=X
 * @version 1.0.0
 * @date 2026-01-29
 */

import { getFirestore } from '../../work/firebase/admin.js';
import cors from 'cors';
import { getCorsConfig } from '../../work/config/environment.js';

// ═══════════════════════════════════════════════════════════════════
// CORS MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════

const corsMiddleware = cors(getCorsConfig());

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════

/**
 * Tabela de preços dos planos (hardcoded)
 */
const PLAN_PRICES = {
  plus: 29.99,
  pro: 69.99,
  studio: 99.99,
  free: 0,
  demo: 0,
  anonymous: 0
};

/**
 * Rate limit simples (por IP)
 */
const RATE_LIMIT = {
  windowMs: 60000, // 1 minuto
  maxRequests: 30   // 30 requests por minuto
};

const requestCounts = new Map();

// ═══════════════════════════════════════════════════════════════════
// VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════

/**
 * Valida partnerId (3-50 chars alfanuméricos)
 */
function isValidPartnerId(partnerId) {
  if (!partnerId || typeof partnerId !== 'string') return false;
  const regex = /^[a-z0-9_-]{3,50}$/i;
  return regex.test(partnerId);
}

/**
 * Rate limit simples por IP
 */
function checkRateLimit(ip) {
  const now = Date.now();
  const key = `${ip}`;
  
  if (!requestCounts.has(key)) {
    requestCounts.set(key, { count: 1, startTime: now });
    return true;
  }
  
  const record = requestCounts.get(key);
  const elapsed = now - record.startTime;
  
  if (elapsed > RATE_LIMIT.windowMs) {
    // Reset window
    requestCounts.set(key, { count: 1, startTime: now });
    return true;
  }
  
  if (record.count >= RATE_LIMIT.maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
}

// ═══════════════════════════════════════════════════════════════════
// FUNÇÕES DE AGREGAÇÃO
// ═══════════════════════════════════════════════════════════════════

/**
 * Busca todos os visitantes de um parceiro
 * @param {string} partnerId - ID do parceiro
 * @returns {Promise<Array>} Lista de visitantes
 */
async function getVisitorsByPartner(partnerId) {
  const db = getFirestore();
  const visitorsRef = db.collection('referral_visitors');
  
  try {
    const snapshot = await visitorsRef
      .where('partnerId', '==', partnerId)
      .get();
    
    const visitors = [];
    snapshot.forEach(doc => {
      visitors.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`[PARTNER-DASH] ${visitors.length} visitantes encontrados para ${partnerId}`);
    return visitors;
  } catch (error) {
    console.error(`[PARTNER-DASH] Erro ao buscar visitantes:`, error);
    return [];
  }
}

/**
 * Busca todos os usuários referenciados por um parceiro
 * @param {string} partnerId - ID do parceiro (referralCode)
 * @returns {Promise<Array>} Lista de usuários
 */
async function getUsersByReferralCode(partnerId) {
  const db = getFirestore();
  const usersRef = db.collection('usuarios');
  
  try {
    const snapshot = await usersRef
      .where('referralCode', '==', partnerId)
      .get();
    
    const users = [];
    snapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`[PARTNER-DASH] ${users.length} usuários encontrados com referralCode=${partnerId}`);
    return users;
  } catch (error) {
    console.error(`[PARTNER-DASH] Erro ao buscar usuários:`, error);
    return [];
  }
}

/**
 * Calcula métricas gerais
 * @param {Array} visitors - Lista de visitantes
 * @param {Array} users - Lista de usuários
 * @returns {Object} Métricas agregadas
 */
function calculateMetrics(visitors, users) {
  // Visitantes: total de documentos em referral_visitors
  const totalVisitors = visitors.length;
  
  // Cadastros: visitantes com registered=true
  const totalSignups = visitors.filter(v => v.registered === true).length;
  
  // Conversões: visitantes com convertedAt != null
  const totalConversions = visitors.filter(v => v.convertedAt != null).length;
  
  // MRR: soma dos valores dos planos dos usuários
  const mrr = users.reduce((sum, user) => {
    const plan = user.plan || 'free';
    const price = PLAN_PRICES[plan] || 0;
    return sum + price;
  }, 0);
  
  console.log('[PARTNER-DASH] Métricas calculadas:', {
    totalVisitors,
    totalSignups,
    totalConversions,
    mrr: mrr.toFixed(2)
  });
  
  return {
    visitors: totalVisitors,
    signups: totalSignups,
    conversions: totalConversions,
    mrr: parseFloat(mrr.toFixed(2))
  };
}

/**
 * Calcula métricas por período de tempo
 * @param {Array} visitors - Lista de visitantes
 * @param {Array} users - Lista de usuários
 * @returns {Object} Timeline com métricas por período
 */
function calculateTimeline(visitors, users) {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  function filterByDate(items, dateField, since) {
    return items.filter(item => {
      if (!item[dateField]) return false;
      const itemDate = item[dateField].toDate ? item[dateField].toDate() : new Date(item[dateField]);
      return itemDate >= since;
    });
  }
  
  // Today
  const todayVisitors = filterByDate(visitors, 'firstSeenAt', oneDayAgo);
  const todaySignups = todayVisitors.filter(v => v.registered === true);
  const todayConversions = todayVisitors.filter(v => v.convertedAt != null);
  
  // Last 7 days
  const last7Visitors = filterByDate(visitors, 'firstSeenAt', sevenDaysAgo);
  const last7Signups = last7Visitors.filter(v => v.registered === true);
  const last7Conversions = last7Visitors.filter(v => v.convertedAt != null);
  
  // Last 30 days
  const last30Visitors = filterByDate(visitors, 'firstSeenAt', thirtyDaysAgo);
  const last30Signups = last30Visitors.filter(v => v.registered === true);
  const last30Conversions = last30Visitors.filter(v => v.convertedAt != null);
  
  console.log('[PARTNER-DASH] Timeline calculada:', {
    today: { visitors: todayVisitors.length, signups: todaySignups.length },
    last7days: { visitors: last7Visitors.length, signups: last7Signups.length },
    last30days: { visitors: last30Visitors.length, signups: last30Signups.length }
  });
  
  return {
    today: {
      visitors: todayVisitors.length,
      signups: todaySignups.length,
      conversions: todayConversions.length
    },
    last7days: {
      visitors: last7Visitors.length,
      signups: last7Signups.length,
      conversions: last7Conversions.length
    },
    last30days: {
      visitors: last30Visitors.length,
      signups: last30Signups.length,
      conversions: last30Conversions.length
    }
  };
}

/**
 * Busca eventos recentes (últimos 10)
 * @param {Array} visitors - Lista de visitantes
 * @returns {Array} Eventos recentes
 */
function getRecentEvents(visitors) {
  const events = [];
  
  visitors.forEach(visitor => {
    // Evento de visita
    if (visitor.firstSeenAt) {
      events.push({
        type: 'visitor',
        visitorId: visitor.visitorId || visitor.id,
        timestamp: visitor.firstSeenAt.toDate ? visitor.firstSeenAt.toDate().toISOString() : visitor.firstSeenAt
      });
    }
    
    // Evento de cadastro
    if (visitor.registered && visitor.registeredAt) {
      events.push({
        type: 'signup',
        visitorId: visitor.visitorId || visitor.id,
        uid: visitor.uid,
        timestamp: visitor.registeredAt.toDate ? visitor.registeredAt.toDate().toISOString() : visitor.registeredAt
      });
    }
    
    // Evento de conversão
    if (visitor.convertedAt) {
      events.push({
        type: 'conversion',
        visitorId: visitor.visitorId || visitor.id,
        uid: visitor.uid,
        plan: visitor.plan,
        timestamp: visitor.convertedAt.toDate ? visitor.convertedAt.toDate().toISOString() : visitor.convertedAt
      });
    }
  });
  
  // Ordenar por timestamp (mais recente primeiro)
  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Retornar últimos 10
  const recentEvents = events.slice(0, 10);
  console.log(`[PARTNER-DASH] ${recentEvents.length} eventos recentes retornados`);
  
  return recentEvents;
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`\n[PARTNER-DASH:${requestId}] ═════════════════════════════════════`);
  console.log(`[PARTNER-DASH:${requestId}] Nova requisição recebida`);
  console.log(`[PARTNER-DASH:${requestId}] Método: ${req.method}`);
  console.log(`[PARTNER-DASH:${requestId}] Query: ${JSON.stringify(req.query)}`);
  
  // ═══════════════════════════════════════════════════════════════════
  // 1. CORS
  // ═══════════════════════════════════════════════════════════════════
  
  try {
    await runMiddleware(req, res, corsMiddleware);
  } catch (error) {
    console.error(`[PARTNER-DASH:${requestId}] Erro no CORS:`, error);
    return res.status(500).json({ success: false, error: 'CORS error' });
  }
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // 2. VALIDAR MÉTODO
  // ═══════════════════════════════════════════════════════════════════
  
  if (req.method !== 'GET') {
    console.warn(`[PARTNER-DASH:${requestId}] Método não permitido: ${req.method}`);
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      message: 'Use GET'
    });
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // 3. RATE LIMIT
  // ═══════════════════════════════════════════════════════════════════
  
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  
  if (!checkRateLimit(clientIp)) {
    console.warn(`[PARTNER-DASH:${requestId}] Rate limit excedido para IP: ${clientIp}`);
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'Rate limit: 30 requests/min'
    });
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // 4. VALIDAR PARTNER ID
  // ═══════════════════════════════════════════════════════════════════
  
  const partnerId = req.query.partnerId;
  
  if (!partnerId) {
    console.warn(`[PARTNER-DASH:${requestId}] PartnerId ausente`);
    return res.status(400).json({
      success: false,
      error: 'Missing partnerId',
      message: 'Query parameter "partnerId" is required'
    });
  }
  
  if (!isValidPartnerId(partnerId)) {
    console.warn(`[PARTNER-DASH:${requestId}] PartnerId inválido: ${partnerId}`);
    return res.status(400).json({
      success: false,
      error: 'Invalid partnerId',
      message: 'PartnerId must be 3-50 alphanumeric characters'
    });
  }
  
  console.log(`[PARTNER-DASH:${requestId}] PartnerId validado: ${partnerId}`);
  
  // ═══════════════════════════════════════════════════════════════════
  // 5. BUSCAR DADOS NO FIRESTORE
  // ═══════════════════════════════════════════════════════════════════
  
  try {
    console.log(`[PARTNER-DASH:${requestId}] Buscando dados do Firestore...`);
    
    // Buscar visitantes (referral_visitors)
    const visitors = await getVisitorsByPartner(partnerId);
    
    // Buscar usuários (usuarios com referralCode)
    const users = await getUsersByReferralCode(partnerId);
    
    console.log(`[PARTNER-DASH:${requestId}] Dados obtidos:`, {
      visitors: visitors.length,
      users: users.length
    });
    
    // ═══════════════════════════════════════════════════════════════════
    // 6. CALCULAR MÉTRICAS
    // ═══════════════════════════════════════════════════════════════════
    
    console.log(`[PARTNER-DASH:${requestId}] Calculando métricas...`);
    
    const metrics = calculateMetrics(visitors, users);
    const timeline = calculateTimeline(visitors, users);
    const recentEvents = getRecentEvents(visitors);
    
    // ═══════════════════════════════════════════════════════════════════
    // 7. RETORNAR RESPOSTA
    // ═══════════════════════════════════════════════════════════════════
    
    const response = {
      success: true,
      partnerId,
      metrics,
      timeline,
      recentEvents,
      timestamp: new Date().toISOString()
    };
    
    console.log(`[PARTNER-DASH:${requestId}] ✅ Resposta gerada com sucesso`);
    console.log(`[PARTNER-DASH:${requestId}] Métricas:`, metrics);
    console.log(`[PARTNER-DASH:${requestId}] ═════════════════════════════════════\n`);
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error(`[PARTNER-DASH:${requestId}] ❌ Erro ao processar requisição:`, error);
    console.error(`[PARTNER-DASH:${requestId}] Stack:`, error.stack);
    
    // Retornar zeros em caso de erro (não quebrar painel)
    return res.status(200).json({
      success: true,
      partnerId,
      metrics: {
        visitors: 0,
        signups: 0,
        conversions: 0,
        mrr: 0
      },
      timeline: {
        today: { visitors: 0, signups: 0, conversions: 0 },
        last7days: { visitors: 0, signups: 0, conversions: 0 },
        last30days: { visitors: 0, signups: 0, conversions: 0 }
      },
      recentEvents: [],
      error: 'Data aggregation error',
      timestamp: new Date().toISOString()
    });
  }
}
