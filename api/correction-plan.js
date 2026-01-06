/**
 * 🎯 CORRECTION PLAN API ENDPOINT
 * 
 * Gera planos de correção personalizados usando GPT-4o mini
 * baseados na análise do SoundyAI.
 * 
 * POST /api/correction-plan
 * 
 * Features:
 * - Validação de autenticação Firebase
 * - Controle de plano (Free/Plus/Pro)
 * - Rate limiting específico
 * - Cache de respostas (Firestore)
 * - Fallback em caso de erro
 */

// 🔥 Firebase Admin - usar módulo global (funciona via server.js da raiz)
import { getAuth, getFirestore } from '../firebase/admin.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const auth = getAuth();
const db = getFirestore();
import cors from 'cors';
import OpenAI from 'openai';

import {
  CORRECTION_PLAN_SYSTEM_PROMPT,
  buildCorrectionPlanPrompt,
  validateAndParseResponse
} from './helpers/correction-plan-prompt.js';

// 🔐 ENTITLEMENTS: Sistema de controle de acesso por plano
import { getUserPlan, hasEntitlement, buildPlanRequiredResponse } from '../work/lib/entitlements.js';

// ⚠️ NOTA: userPlans não está disponível em api/ - implementar fallback inline
// import {
//   getOrCreateUser,
//   getUserPlanInfo
// } from '../work/lib/user/userPlans.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const COLLECTION_CORRECTION_PLANS = 'correction_plans';
const COLLECTION_USERS = 'usuarios';

// Limites por plano (planos/mês)
// ✅ ATUALIZADO 2026-01-06: PRO não tem mais acesso, agora é DJ/STUDIO only
const PLAN_LIMITS = {
  free: 1,     // 1 plano/mês (preview/trial)
  plus: 0,     // ❌ Não tem acesso
  pro: 0,      // ❌ REMOVIDO 2026-01-06: PRO não tem mais Plano de Correção
  dj: 50,      // 50 planos/mês (beta temporário)
  studio: 100  // 100 planos/mês (hard cap anti-abuse)
};

// ═══════════════════════════════════════════════════════════════════════════════
// 👤 HELPER: Obter plano do usuário (versão simplificada inline)
// ═══════════════════════════════════════════════════════════════════════════════

async function getUserPlanInfo(uid) {
  try {
    const userDoc = await db.collection(COLLECTION_USERS).doc(uid).get();
    
    if (!userDoc.exists) {
      console.log(`[CORRECTION-PLAN] Usuário ${uid} não encontrado, usando free`);
      return { plan: 'free' };
    }
    
    const data = userDoc.data();
    const plan = data.plan || 'free';
    
    console.log(`[CORRECTION-PLAN] Plano do usuário ${uid}: ${plan}`);
    return { plan };
    
  } catch (error) {
    console.error(`[CORRECTION-PLAN] Erro ao buscar plano: ${error.message}`);
    return { plan: 'free' }; // Fallback seguro
  }
}

// Rate limit (requisições por hora)
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hora
const MAX_REQUESTS_PER_HOUR = 5;

// OpenAI config
const OPENAI_MODEL = 'gpt-4o-mini';
const MAX_TOKENS = 1500;
const TEMPERATURE = 0.3;

// Cache de rate limiting em memória
const userRequestCount = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
// 🔒 CORS MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

const corsMiddleware = cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://www.soundyai.com.br',
      'https://soundyai.com.br',
      'https://soundyai-app-production.up.railway.app',
      'http://localhost:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://127.0.0.1:3000'
    ];
    
    const allowedPatterns = [
      /^https:\/\/ai-synth[a-z0-9\-]*\.vercel\.app$/,
      /^https:\/\/prod-ai[a-z0-9\-]*\.vercel\.app$/,
      /^https:\/\/.*soundyai.*\.railway\.app$/
    ];
    
    if (!origin || 
        allowedOrigins.includes(origin) ||
        allowedPatterns.some(p => p.test(origin)) ||
        origin.startsWith('file://')) {
      callback(null, true);
    } else {
      console.log('[CORRECTION-PLAN] CORS blocked:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});

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

// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️ FUNÇÕES DE SEGURANÇA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verifica rate limit por usuário
 */
function checkRateLimit(uid) {
  const now = Date.now();
  const userRequests = userRequestCount.get(uid) || [];
  
  // Remover requests antigos
  const validRequests = userRequests.filter(t => now - t < RATE_LIMIT_WINDOW);
  
  if (validRequests.length >= MAX_REQUESTS_PER_HOUR) {
    console.warn(`[CORRECTION-PLAN] Rate limit excedido: ${uid}`);
    return false;
  }
  
  validRequests.push(now);
  userRequestCount.set(uid, validRequests);
  
  return true;
}

/**
 * Verifica limite mensal de planos gerados
 */
async function checkMonthlyLimit(uid, plan) {
  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  try {
    // Contar planos gerados este mês
    const snapshot = await db.collection(COLLECTION_CORRECTION_PLANS)
      .where('userId', '==', uid)
      .where('billingMonth', '==', currentMonth)
      .count()
      .get();
    
    const count = snapshot.data().count;
    
    if (count >= limit) {
      console.warn(`[CORRECTION-PLAN] Limite mensal atingido: ${uid} (${count}/${limit})`);
      return { allowed: false, current: count, limit };
    }
    
    return { allowed: true, current: count, limit };
  } catch (error) {
    console.error('[CORRECTION-PLAN] Erro ao verificar limite mensal:', error.message);
    // Em caso de erro, permitir (evitar bloquear usuário por erro técnico)
    return { allowed: true, current: 0, limit };
  }
}

/**
 * Verifica se existe plano em cache para mesma análise
 * SIMPLIFICADO: Sem orderBy para evitar necessidade de índice composto
 */
async function getCachedPlan(analysisId, uid) {
  try {
    const snapshot = await db.collection(COLLECTION_CORRECTION_PLANS)
      .where('analysisId', '==', analysisId)
      .where('userId', '==', uid)
      .limit(5) // Pega até 5 e filtra no código
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    // Encontrar o mais recente manualmente
    let latestDoc = null;
    let latestTime = 0;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const time = data.generatedAt?.toDate?.()?.getTime() || 0;
      if (time > latestTime) {
        latestTime = time;
        latestDoc = { id: doc.id, ...data };
      }
    });
    
    if (!latestDoc) {
      return null;
    }
    
    // Cache válido por 24 horas
    const age = Date.now() - latestTime;
    if (age < 24 * 60 * 60 * 1000) {
      console.log(`[CORRECTION-PLAN] Cache hit para análise: ${analysisId}`);
      return latestDoc;
    }
    
    return null;
  } catch (error) {
    console.error('[CORRECTION-PLAN] Erro ao buscar cache:', error.message);
    return null; // Falha silenciosa - prosseguir sem cache
  }
}

/**
 * Sanitiza inputs do usuário
 * 🔧 v2: Adicionado suporte a problemsSummary categorizado
 */
function sanitizeInput(data) {
  const {
    analysisId,
    problems = [],
    problemsSummary = {},
    userProfile = {},
    genreTargets = {},
    analysisMetrics = {},
    metadata = {},
    plan = 'free'
  } = data;
  
  // Validar analysisId
  if (!analysisId || typeof analysisId !== 'string') {
    throw new Error('INVALID_ANALYSIS_ID');
  }
  
  // Sanitizar problems - VALIDAR QUE NÃO SÃO UNDEFINED
  const sanitizedProblems = problems
    .filter(p => p && typeof p === 'object' && p.metric && p.metric !== 'undefined')
    .slice(0, 20) // Máximo 20 problemas
    .map(p => ({
      id: String(p.id || p.metric || p.type || '').slice(0, 100),
      metric: String(p.metric || '').slice(0, 100),
      severity: String(p.severity || 'média').slice(0, 20),
      value: p.value ?? p.currentValue ?? null,
      target: p.target ?? p.targetValue ?? null,
      difference: p.difference ?? p.diff ?? null,
      category: String(p.category || 'other').slice(0, 20),
      action: String(p.action || '').slice(0, 500)
    }));
  
  // 🆕 Sanitizar problemsSummary categorizado
  const sanitizedSummary = {
    hasLoudnessProblems: Boolean(problemsSummary.hasLoudnessProblems),
    hasFrequencyProblems: Boolean(problemsSummary.hasFrequencyProblems),
    hasDynamicsProblems: Boolean(problemsSummary.hasDynamicsProblems),
    hasStereoProblems: Boolean(problemsSummary.hasStereoProblems),
    loudnessProblems: Array.isArray(problemsSummary.loudnessProblems) 
      ? problemsSummary.loudnessProblems.slice(0, 5) : [],
    frequencyProblems: Array.isArray(problemsSummary.frequencyProblems) 
      ? problemsSummary.frequencyProblems.slice(0, 10) : [],
    dynamicsProblems: Array.isArray(problemsSummary.dynamicsProblems) 
      ? problemsSummary.dynamicsProblems.slice(0, 5) : [],
    stereoProblems: Array.isArray(problemsSummary.stereoProblems) 
      ? problemsSummary.stereoProblems.slice(0, 3) : [],
    totalProblems: Number(problemsSummary.totalProblems) || sanitizedProblems.length,
    criticalCount: Number(problemsSummary.criticalCount) || 0,
    attentionCount: Number(problemsSummary.attentionCount) || 0
  };
  
  // Sanitizar userProfile (combinar com metadata)
  const sanitizedProfile = {
    daw: String(userProfile.daw || metadata.daw || '').slice(0, 50),
    level: String(userProfile.level || userProfile.nivelTecnico || metadata.level || 'iniciante').slice(0, 30),
    genre: String(userProfile.genre || userProfile.estilo || metadata.genre || '').slice(0, 50),
    fileName: String(metadata.fileName || userProfile.fileName || '').slice(0, 200),
    dificuldade: String(userProfile.dificuldade || '').slice(0, 200)
  };
  
  // Sanitizar genreTargets
  const sanitizedTargets = {
    lufs: genreTargets.lufs ?? null,
    true_peak: genreTargets.true_peak ?? genreTargets.tp ?? null,
    dr: genreTargets.dr ?? null,
    lra: genreTargets.lra ?? null
  };
  
  // Sanitizar analysisMetrics
  const sanitizedMetrics = {
    lufsIntegrated: analysisMetrics.lufsIntegrated ?? null,
    truePeakDbtp: analysisMetrics.truePeakDbtp ?? null,
    dynamicRange: analysisMetrics.dynamicRange ?? null,
    lra: analysisMetrics.lra ?? null,
    crestFactor: analysisMetrics.crestFactor ?? null,
    stereoCorrelation: analysisMetrics.stereoCorrelation ?? null
  };
  
  // Validar plano (✅ ATUALIZADO 2026-01-06: inclui dj e studio)
  const validPlans = ['free', 'plus', 'pro', 'dj', 'studio'];
  const sanitizedPlan = validPlans.includes(plan) ? plan : 'free';
  
  return {
    analysisId,
    problems: sanitizedProblems,
    problemsSummary: sanitizedSummary,
    userProfile: sanitizedProfile,
    genreTargets: sanitizedTargets,
    analysisMetrics: sanitizedMetrics,
    plan: sanitizedPlan
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🤖 FUNÇÃO DE GERAÇÃO DO PLANO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Chama GPT-4o mini para gerar o plano
 */
async function generatePlanWithAI(sanitizedData) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  
  const userPrompt = buildCorrectionPlanPrompt(sanitizedData);
  
  console.log('[CORRECTION-PLAN] Chamando GPT-4o mini...');
  console.log('[CORRECTION-PLAN] Problemas:', sanitizedData.problems.length);
  console.log('[CORRECTION-PLAN] DAW:', sanitizedData.userProfile.daw);
  console.log('[CORRECTION-PLAN] Nível:', sanitizedData.userProfile.level);
  
  const startTime = Date.now();
  
  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: CORRECTION_PLAN_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      response_format: { type: 'json_object' }
    });
    
    const elapsed = Date.now() - startTime;
    const content = response.choices[0]?.message?.content;
    const usage = response.usage;
    
    console.log(`[CORRECTION-PLAN] ✅ Resposta recebida em ${elapsed}ms`);
    console.log(`[CORRECTION-PLAN] Tokens: ${usage?.total_tokens || 'N/A'}`);
    
    // Validar e parsear resposta
    const parsed = validateAndParseResponse(content);
    
    if (!parsed.success) {
      console.error('[CORRECTION-PLAN] Erro ao parsear:', parsed.error);
      return {
        success: false,
        data: parsed.fallback,
        usage,
        elapsed,
        fallbackUsed: true
      };
    }
    
    return {
      success: true,
      data: parsed.data,
      usage,
      elapsed,
      fallbackUsed: false
    };
    
  } catch (error) {
    console.error('[CORRECTION-PLAN] Erro OpenAI:', error.message);
    
    // Retornar fallback
    const fallback = validateAndParseResponse(null).fallback;
    return {
      success: false,
      data: fallback,
      error: error.message,
      elapsed: Date.now() - startTime,
      fallbackUsed: true
    };
  }
}

/**
 * Salva o plano no Firestore
 */
async function savePlanToFirestore(uid, sanitizedData, planResult) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  const docData = {
    userId: uid,
    analysisId: sanitizedData.analysisId,
    plan: sanitizedData.plan,
    billingMonth: currentMonth,
    generatedAt: Timestamp.now(),
    
    // Dados usados na geração
    input: {
      problemsCount: sanitizedData.problems.length,
      problems: sanitizedData.problems.map(p => p.id),
      userProfile: sanitizedData.userProfile,
      genreTargets: sanitizedData.genreTargets
    },
    
    // Resultado
    response: planResult.data,
    stepsCount: planResult.data.steps?.length || 0,
    
    // Metadata
    model: OPENAI_MODEL,
    tokensUsed: planResult.usage?.total_tokens || null,
    generationTimeMs: planResult.elapsed,
    fallbackUsed: planResult.fallbackUsed || false
  };
  
  const docRef = await db.collection(COLLECTION_CORRECTION_PLANS).add(docData);
  
  console.log(`[CORRECTION-PLAN] Plano salvo: ${docRef.id}`);
  
  return docRef.id;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  console.log('\n[CORRECTION-PLAN] ═══════════════════════════════════════════');
  console.log('[CORRECTION-PLAN] Nova requisição:', req.method);
  console.log('[CORRECTION-PLAN] 🔑 OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Configurada' : '❌ NÃO CONFIGURADA');
  
  // CORS
  try {
    await runMiddleware(req, res, corsMiddleware);
  } catch (error) {
    console.error('[CORRECTION-PLAN] CORS error:', error.message);
    return res.status(403).json({ error: 'CORS_BLOCKED' });
  }
  
  // OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  
  try {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. AUTENTICAÇÃO
    // ─────────────────────────────────────────────────────────────────────────
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[CORRECTION-PLAN] Token ausente');
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token de autenticação ausente' });
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (authError) {
      console.error('[CORRECTION-PLAN] Token inválido:', authError.message);
      return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Token de autenticação inválido' });
    }
    
    const uid = decodedToken.uid;
    console.log(`[CORRECTION-PLAN] Usuário autenticado: ${uid}`);
    
    // ─────────────────────────────────────────────────────────────────────────
    // 2. BUSCAR PLANO DO USUÁRIO
    // ─────────────────────────────────────────────────────────────────────────
    
    const userInfo = await getUserPlanInfo(uid);
    const userPlan = userInfo.plan || 'free';
    console.log(`[CORRECTION-PLAN] Plano do usuário: ${userPlan}`);
    
    // ─────────────────────────────────────────────────────────────────────────
    // 2.5 ENTITLEMENTS: Verificar permissão para Plano de Correção (PRO only)
    // ─────────────────────────────────────────────────────────────────────────
    
    if (!hasEntitlement(userPlan, 'correctionPlan')) {
      console.log(`[CORRECTION-PLAN] ❌ BLOQUEADO: Plano de Correção requer PRO, usuário tem ${userPlan}`);
      return res.status(403).json(buildPlanRequiredResponse('correctionPlan', userPlan));
    }
    
    console.log(`[CORRECTION-PLAN] ✅ Plano de Correção permitido para plano ${userPlan}`);
    
    // ─────────────────────────────────────────────────────────────────────────
    // 3. RATE LIMITING
    // ─────────────────────────────────────────────────────────────────────────
    
    if (!checkRateLimit(uid)) {
      return res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Muitas requisições. Tente novamente em alguns minutos.',
        retryAfter: 3600
      });
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // 4. LIMITE MENSAL
    // ─────────────────────────────────────────────────────────────────────────
    
    const monthlyCheck = await checkMonthlyLimit(uid, userPlan);
    if (!monthlyCheck.allowed) {
      return res.status(403).json({
        error: 'MONTHLY_LIMIT_REACHED',
        message: `Limite de ${monthlyCheck.limit} planos/mês atingido para o plano ${userPlan.toUpperCase()}.`,
        current: monthlyCheck.current,
        limit: monthlyCheck.limit,
        upgrade: userPlan !== 'pro' ? 'Faça upgrade para gerar mais planos.' : null
      });
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // 5. SANITIZAR INPUT
    // ─────────────────────────────────────────────────────────────────────────
    
    let sanitizedData;
    try {
      sanitizedData = sanitizeInput({
        ...req.body,
        plan: userPlan // Forçar plano do servidor, não do cliente
      });
    } catch (inputError) {
      console.error('[CORRECTION-PLAN] Input inválido:', inputError.message);
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: inputError.message
      });
    }
    
    console.log(`[CORRECTION-PLAN] Análise: ${sanitizedData.analysisId}`);
    console.log(`[CORRECTION-PLAN] Problemas: ${sanitizedData.problems.length}`);
    
    // ─────────────────────────────────────────────────────────────────────────
    // 6. VERIFICAR CACHE
    // ─────────────────────────────────────────────────────────────────────────
    
    const cachedPlan = await getCachedPlan(sanitizedData.analysisId, uid);
    if (cachedPlan) {
      console.log('[CORRECTION-PLAN] Retornando plano do cache');
      return res.status(200).json({
        success: true,
        planId: cachedPlan.id,
        plan: cachedPlan.response,
        cached: true,
        stepsCount: cachedPlan.stepsCount
      });
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // 7. GERAR PLANO COM IA
    // ─────────────────────────────────────────────────────────────────────────
    
    // Verificar se API key está configurada
    if (!process.env.OPENAI_API_KEY) {
      console.error('[CORRECTION-PLAN] ❌ OPENAI_API_KEY não configurada!');
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Serviço de IA temporariamente indisponível. Tente novamente mais tarde.'
      });
    }
    
    let planResult;
    try {
      planResult = await generatePlanWithAI(sanitizedData);
    } catch (aiError) {
      console.error('[CORRECTION-PLAN] ❌ Erro ao gerar plano com IA:', aiError.message);
      console.error('[CORRECTION-PLAN] Stack:', aiError.stack);
      return res.status(500).json({
        error: 'AI_ERROR',
        message: 'Erro ao gerar plano de correção. A IA pode estar sobrecarregada.'
      });
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // 8. SALVAR NO FIRESTORE
    // ─────────────────────────────────────────────────────────────────────────
    
    let planId;
    try {
      planId = await savePlanToFirestore(uid, sanitizedData, planResult);
    } catch (saveError) {
      console.error('[CORRECTION-PLAN] ❌ Erro ao salvar no Firestore:', saveError.message);
      // Mesmo se falhar salvar, retornar o plano gerado
      planId = `temp-${Date.now()}`;
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // 9. RETORNAR RESPOSTA
    // ─────────────────────────────────────────────────────────────────────────
    
    console.log('[CORRECTION-PLAN] ✅ Plano gerado com sucesso');
    
    return res.status(200).json({
      success: true,
      planId,
      plan: planResult.data,
      cached: false,
      stepsCount: planResult.data.steps?.length || 0,
      fallbackUsed: planResult.fallbackUsed,
      metadata: {
        model: OPENAI_MODEL,
        tokensUsed: planResult.usage?.total_tokens || null,
        generationTimeMs: planResult.elapsed,
        monthlyUsage: {
          current: monthlyCheck.current + 1,
          limit: monthlyCheck.limit
        }
      }
    });
    
  } catch (error) {
    console.error('[CORRECTION-PLAN] ❌ Erro não tratado:', error);
    console.error('[CORRECTION-PLAN] Stack:', error.stack);
    
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Erro interno ao gerar plano de correção. Tente novamente.'
    });
  }
}
