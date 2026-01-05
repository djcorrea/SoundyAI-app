// ✅ CORREÇÃO CRÍTICA: decoded is not defined fixed!
// 🎯 SISTEMA AVANÇADO: Intent detection + Token management + Context injection
import { getAuth, getFirestore } from '../firebase/admin.js';

const auth = getAuth();
const db = getFirestore();
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import cors from 'cors';
import formidable from 'formidable';
import fs from 'fs';

// 🎯 IMPORTAR HELPERS AVANÇADOS (com fallback para compatibilidade)
import { 
  prepareAnalysisForPrompt, 
  formatAnalysisAsText 
} from './helpers/analysis-prompt-filter.js';

import { 
  classifyIntent, 
  isMixAnalysisMessage 
} from './helpers/intent-classifier.js';

import { 
  prepareMessagesWithBudget,
  validateTokenBudget 
} from './helpers/token-budget-validator.js';

import { 
  getSystemPromptForIntent,
  getPromptConfigForIntent,
  injectUserContext 
} from './helpers/advanced-system-prompts.js';

// 🎯 IMPORTAR SISTEMA DE PLANOS CENTRALIZADO
import { canUseChat, registerChat } from '../work/lib/user/userPlans.js';

// ✅ CORREÇÃO: Configuração para suporte a multipart
export const config = {
  api: {
    bodyParser: false,
  },
};

// ✅ Função para processar multipart/form-data (versão Vercel-friendly)
async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB (Vercel limit friendly)
      maxFiles: 3,
      multiples: true,
      allowEmptyFiles: false,
      keepExtensions: true,
      filter: function ({ name, originalFilename, mimetype }) {
        console.log('🔍 Filtering file:', { name, originalFilename, mimetype });
        // Aceitar campos de texto e imagens
        if (name === 'message' || name === 'conversationHistory' || name === 'idToken') {
          return true;
        }
        // Aceitar apenas imagens válidas
        if (name === 'images' && mimetype && mimetype.startsWith('image/')) {
          return true;
        }
        console.log('❌ File rejected:', { name, mimetype });
        return false;
      }
    });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('❌ Erro no formidable:', {
          message: err.message,
          code: err.code,
          httpCode: err.httpCode
        });
        reject(new Error(`FORMIDABLE_ERROR: ${err.message}`));
        return;
      }

      console.log('📋 Campos recebidos:', Object.keys(fields));
      console.log('📁 Arquivos recebidos:', Object.keys(files));

      try {
        // ✅ Processar imagens de forma assíncrona e robusta
        const images = [];
        if (files.images) {
          const imageFiles = Array.isArray(files.images) ? files.images : [files.images];
          
          // ✅ CRÍTICO: Validar número máximo de imagens
          if (imageFiles.length > MAX_IMAGES_PER_MESSAGE) {
            throw new Error(`IMAGES_LIMIT_EXCEEDED: Máximo ${MAX_IMAGES_PER_MESSAGE} imagens por envio`);
          }
          
          let totalImageSize = 0;
          
          for (const [index, file] of imageFiles.entries()) {
            try {
              console.log(`📸 Processando imagem ${index + 1}:`, {
                name: file.originalFilename,
                size: file.size,
                type: file.mimetype,
                exists: fs.existsSync(file.filepath)
              });
              
              // ✅ CRÍTICO: Validar tamanho individual
              if (file.size > MAX_IMAGE_SIZE) {
                throw new Error(`IMAGE_TOO_LARGE: ${file.originalFilename} excede ${MAX_IMAGE_MB}MB`);
              }
              
              totalImageSize += file.size;
              
              // ✅ CRÍTICO: Validar payload total
              if (totalImageSize > MAX_TOTAL_PAYLOAD_SIZE) {
                throw new Error(`PAYLOAD_TOO_LARGE: Total excede ${MAX_TOTAL_PAYLOAD_MB}MB`);
              }
              
              // Verificar se arquivo existe e é válido
              if (!fs.existsSync(file.filepath)) {
                console.error(`❌ Arquivo não encontrado: ${file.filepath}`);
                continue;
              }

              if (file.size === 0) {
                console.error(`❌ Arquivo vazio: ${file.originalFilename}`);
                continue;
              }
              
              // Ler arquivo de forma segura
              const buffer = await fs.promises.readFile(file.filepath);
              
              // ✅ CRÍTICO: Validar magic bytes
              const imageFormat = validateImageMagicBytes(buffer);
              if (!imageFormat) {
                throw new Error(`INVALID_IMAGE_FORMAT: ${file.originalFilename} não é uma imagem válida (magic bytes)`);
              }
              
              const base64 = buffer.toString('base64');
              
              // Validar base64
              if (!base64 || base64.length < 100) { // Mínimo razoável para uma imagem
                console.error(`❌ Base64 inválido para: ${file.originalFilename}`);
                continue;
              }
              
              images.push({
                base64,
                filename: file.originalFilename || `image-${index + 1}.jpg`,
                type: file.mimetype || 'image/jpeg',
                size: file.size,
                format: imageFormat
              });
              
              console.log(`✅ Imagem ${index + 1} processada: ${(base64.length/1024).toFixed(1)}KB base64 - Formato: ${imageFormat}`);
              
            } catch (fileError) {
              console.error(`❌ Erro ao processar imagem ${index + 1}:`, fileError.message);
              // Re-throw erros críticos, continue outros
              if (fileError.message.includes('IMAGE_TOO_LARGE') || 
                  fileError.message.includes('PAYLOAD_TOO_LARGE') ||
                  fileError.message.includes('INVALID_IMAGE_FORMAT')) {
                throw fileError;
              }
              // Continuar processando outras imagens para erros menores
            } finally {
              // Sempre tentar limpar arquivo temporário
              try {
                if (fs.existsSync(file.filepath)) {
                  await fs.promises.unlink(file.filepath);
                }
              } catch (cleanupError) {
                console.warn(`⚠️ Erro ao limpar ${file.filepath}:`, cleanupError.message);
              }
            }
          }
          
          console.log(`✅ Payload validado: ${images.length} imagem(ns), ${(totalImageSize/1024/1024).toFixed(1)}MB total`);
        }

        console.log(`✅ Multipart processado: ${images.length} imagem(ns) válida(s)`);

        // Processar campos de texto
        const getFieldValue = (field) => {
          if (!field) return '';
          return Array.isArray(field) ? field[0] : field;
        };

        resolve({
          message: getFieldValue(fields.message) || '',
          conversationHistory: getFieldValue(fields.conversationHistory) || '[]',
          idToken: getFieldValue(fields.idToken) || '',
          images
        });

      } catch (processError) {
        console.error('❌ Erro ao processar dados do formulário:', processError);
        reject(new Error(`PROCESS_ERROR: ${processError.message}`));
      }
    });
  });
}

// ✅ Função para processar request body (JSON ou multipart) com error handling
async function parseRequestBody(req) {
  const contentType = req.headers['content-type'] || '';
  
  try {
    if (contentType.includes('multipart/form-data')) {
      console.log('📦 Processando multipart/form-data...');
      const result = await parseMultipart(req);
      console.log('✅ Multipart processado com sucesso');
      return result;
    } else {
      console.log('📝 Processando application/json...');
      // Vercel já faz parse do JSON por padrão se bodyParser não for false
      const body = req.body || {};
      console.log('✅ JSON processado:', { hasMessage: !!body.message, hasImages: !!(body.images && body.images.length) });
      return body;
    }
  } catch (error) {
    console.error('❌ Erro ao processar request body:', error);
    throw new Error(`BODY_PARSE_ERROR: ${error.message}`);
  }
}

// ✅ CRÍTICO: Configuração centralizada de limites
const MAX_IMAGES_PER_MESSAGE = 3;
const MAX_TOTAL_PAYLOAD_MB = 30;
const MAX_IMAGE_MB = 10;
const MAX_IMAGE_SIZE = MAX_IMAGE_MB * 1024 * 1024;
const MAX_TOTAL_PAYLOAD_SIZE = MAX_TOTAL_PAYLOAD_MB * 1024 * 1024;
const MAX_IMAGE_ANALYSIS_TOKENS = 1500;

// 🎯 NOVO: Configurações para seleção de modelo
const MAX_TEXT_RESPONSE_TOKENS = 1500; // Máximo para respostas texto
const GPT4_COMPLEXITY_THRESHOLD = 7; // Score mínimo para usar GPT-4o

// ✅ CRÍTICO: Validação robusta de magic bytes
function validateImageMagicBytes(buffer) {
  if (!buffer || buffer.length < 8) return false;
  
  const arr = new Uint8Array(buffer);
  
  // JPEG: FF D8 FF
  if (arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) {
    return 'jpeg';
  }
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) {
    return 'png';
  }
  
  // WebP: 52 49 46 46 (RIFF) + WebP signature at offset 8
  if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 &&
      arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50) {
    return 'webp';
  }
  
  return false;
}

// ✅ Rate limiting melhorado - Fase 1 (compatível com Redis futuro)
const userRequestCount = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const MAX_REQUESTS_PER_MINUTE = 10;

// Métricas de rate limiting
const rateLimitMetrics = {
  totalRequests: 0,
  blockedRequests: 0,
  lastCleanup: Date.now()
};

// Cache para respostas frequentes (Fase 2)
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function checkRateLimit(uid) {
  const now = Date.now();
  rateLimitMetrics.totalRequests++;
  
  const userRequests = userRequestCount.get(uid) || [];
  
  // Remover requests antigos (fora da janela de tempo)
  const validRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  // Verificar se excedeu o limite
  if (validRequests.length >= MAX_REQUESTS_PER_MINUTE) {
    rateLimitMetrics.blockedRequests++;
    console.warn(`🚫 Rate limit excedido para usuário: ${uid} (${validRequests.length}/${MAX_REQUESTS_PER_MINUTE})`);
    return false;
  }
  
  // Adicionar request atual e atualizar
  validRequests.push(now);
  userRequestCount.set(uid, validRequests);
  
  // Cleanup periódico (a cada 100 requests)
  if (rateLimitMetrics.totalRequests % 100 === 0) {
    cleanupRateLimit();
    cleanupResponseCache();
  }
  
  return true;
}

// Função de limpeza de memória
function cleanupRateLimit() {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW;
  const beforeSize = userRequestCount.size;
  
  for (const [uid, timestamps] of userRequestCount.entries()) {
    const valid = timestamps.filter(t => t > cutoff);
    if (valid.length === 0) {
      userRequestCount.delete(uid);
    } else if (valid.length !== timestamps.length) {
      userRequestCount.set(uid, valid);
    }
  }
  
  const cleaned = beforeSize - userRequestCount.size;
  if (cleaned > 0) {
    console.log(`🧹 Rate limit cleanup: ${cleaned} usuários inativos removidos`);
  }
  rateLimitMetrics.lastCleanup = now;
}

// Cache inteligente para respostas (Fase 2)
function getCachedResponse(messageHash) {
  const cached = responseCache.get(messageHash);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`💾 Cache hit para mensagem: ${messageHash.substring(0, 8)}`);
    return cached.response;
  }
  if (cached) {
    responseCache.delete(messageHash);
  }
  return null;
}

function setCachedResponse(messageHash, response) {
  // Limitar cache a 100 entradas
  if (responseCache.size >= 100) {
    const oldestKey = responseCache.keys().next().value;
    responseCache.delete(oldestKey);
  }
  
  responseCache.set(messageHash, {
    response,
    timestamp: Date.now()
  });
  console.log(`💾 Cache set para mensagem: ${messageHash.substring(0, 8)}`);
}

function cleanupResponseCache() {
  const now = Date.now();
  const beforeSize = responseCache.size;
  
  for (const [hash, data] of responseCache.entries()) {
    if (now - data.timestamp > CACHE_TTL) {
      responseCache.delete(hash);
    }
  }
  
  const cleaned = beforeSize - responseCache.size;
  if (cleaned > 0) {
    console.log(`🧹 Response cache cleanup: ${cleaned} entradas expiradas removidas`);
  }
}

// Hash simples para mensagens (para cache)
function hashMessage(message) {
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Middleware CORS dinâmico
const corsMiddleware = cors({
  origin: (origin, callback) => {
    // ✅ Domínios de produção (PRIORIDADE)
    const productionDomains = [
      'https://soundyai.com.br',
      'https://www.soundyai.com.br',
      'https://soundyai-app-production.up.railway.app'
    ];
    
    // URLs Vercel (preview/deploy)
    const directUrl = 'https://ai-synth-czzxlraox-dj-correas-projects.vercel.app';
    const apiPreviewRegex = /^https:\/\/prod-ai-teste-[a-z0-9\-]+\.vercel\.app$/;
    const frontendPreviewRegex = /^https:\/\/ai-synth(?:-[a-z0-9\-]+)?\.vercel\.app$/;
    const newDeploymentRegex = /^https:\/\/ai-synth-[a-z0-9\-]+\.vercel\.app$/;

    // Adicionar suporte para desenvolvimento local
    const localOrigins = [
      'http://localhost:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://127.0.0.1:3000',
      'http://localhost:8080',
      'http://127.0.0.1:8080'
    ];

    // [CORS-AUDIT] Log de diagnóstico
    console.log(`[CORS-AUDIT] origin=${origin || 'null'} checking...`);

    // Permitir requests sem origin (same-origin, curl, etc)
    if (!origin) {
      console.log('[CORS-AUDIT] Permitido: sem origin (same-origin)');
      callback(null, true);
      return;
    }

    // Verificar domínios de produção
    if (productionDomains.includes(origin)) {
      console.log(`[CORS-AUDIT] Permitido: domínio produção ${origin}`);
      callback(null, true);
      return;
    }

    // Verificar Vercel
    if (origin === directUrl ||
        apiPreviewRegex.test(origin) ||
        frontendPreviewRegex.test(origin) ||
        newDeploymentRegex.test(origin)) {
      console.log(`[CORS-AUDIT] Permitido: Vercel ${origin}`);
      callback(null, true);
      return;
    }

    // Verificar localhost
    if (localOrigins.includes(origin) || origin.startsWith('file://')) {
      console.log(`[CORS-AUDIT] Permitido: local ${origin}`);
      callback(null, true);
      return;
    }

    // Bloqueado
    console.log(`[CORS-AUDIT] BLOQUEADO: origin=${origin}`);
    callback(new Error('Not allowed by CORS: ' + origin));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

// Função para validar e sanitizar dados de entrada - ATUALIZADA COM SUPORTE A IMAGENS
function validateAndSanitizeInput(requestData) {
  const { message, conversationHistory, idToken, images = [] } = requestData;
  
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('TOKEN_MISSING');
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('MESSAGE_INVALID');
  }
  
  // ✅ Processar conversationHistory (pode vir como string do FormData)
  let validHistory = [];
  let historyData = conversationHistory;
  
  if (typeof conversationHistory === 'string') {
    try {
      historyData = JSON.parse(conversationHistory);
    } catch (error) {
      console.warn('⚠️ Erro ao parsear conversationHistory:', error);
      historyData = [];
    }
  }
  
  if (Array.isArray(historyData)) {
    validHistory = historyData
      .filter(msg => {
        return msg && 
          typeof msg === 'object' && 
          msg.role && 
          msg.content &&
          typeof msg.content === 'string' &&
          msg.content.trim().length > 0 &&
          ['user', 'assistant', 'system'].includes(msg.role);
      })
      .slice(-5); // Histórico reduzido para performance
  }
  
  // ✅ Validar imagens se presentes
  let validImages = [];
  if (Array.isArray(images) && images.length > 0) {
    if (images.length > 3) {
      throw new Error('IMAGES_LIMIT_EXCEEDED');
    }
    
    validImages = images.filter(img => {
      return img && 
        typeof img === 'object' && 
        img.base64 && 
        typeof img.base64 === 'string' &&
        img.filename && 
        typeof img.filename === 'string';
    }).slice(0, 3); // Garantir máximo de 3 imagens
    
    console.log(`✅ ${validImages.length} imagem(ns) válida(s) processada(s)`);
  }
  
  return {
    message: message.trim().substring(0, 2000),
    conversationHistory: validHistory,
    idToken: idToken.trim(),
    images: validImages,
    // 🎤 Detectar se é voice message (GRATUITO)
    isVoiceMessage: message.startsWith('[VOICE MESSAGE]'),
    // 🖼️ Detectar se tem imagens (requer GPT-4 Vision)
    hasImages: validImages.length > 0
  };
}

// Função para gerenciar limites de usuário e cota de imagens - ATUALIZADA
async function handleUserLimits(db, uid, email) {
  const userRef = db.collection('usuarios').doc(uid);

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const now = Timestamp.now();
      const today = now.toDate().toDateString();
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      let userData;

      if (!snap.exists) {
        userData = {
          uid,
          plano: 'gratis',
          mensagensRestantes: 9,
          dataUltimoReset: now,
          createdAt: now
          // ❌ REMOVIDO: imagemAnalises (sistema antigo)
          // O contador de imagens agora é gerenciado por userPlans.js com imagesMonth
        };
        if (email) {
          userData.email = email;
        }
        tx.set(userRef, userData);
      } else {
        userData = snap.data();
        const lastReset = userData.dataUltimoReset?.toDate().toDateString();

        // VERIFICAÇÃO AUTOMÁTICA DE EXPIRAÇÃO DO PLANO PLUS
        if (userData.plano === 'plus' && userData.planExpiresAt) {
          const currentDate = new Date();
          const expirationDate = userData.planExpiresAt instanceof Date ? 
            userData.planExpiresAt : 
            userData.planExpiresAt.toDate ? userData.planExpiresAt.toDate() : new Date(userData.planExpiresAt);
          
          if (expirationDate <= currentDate) {
            console.log('⏰ Plano Plus expirado, convertendo para gratuito:', uid);
            
            // Dados para converter plano expirado
            const expiredPlanData = {
              plano: 'gratis',
              isPlus: false,
              mensagensRestantes: 10,
              planExpiredAt: now,
              previousPlan: 'plus',
              dataUltimoReset: now
              // ❌ REMOVIDO: imagemAnalises (sistema antigo)
              // O contador de imagens agora é gerenciado por userPlans.js
            };
            
            // Atualizar no Firestore
            tx.update(userRef, expiredPlanData);
            
            // Atualizar userData local para refletir as mudanças
            userData = { ...userData, ...expiredPlanData };
            
            console.log('✅ Usuário convertido de Plus expirado para gratuito:', uid);
          }
        }

        // Verificar reset diário das mensagens
        if (lastReset !== today) {
          userData.mensagensRestantes = 10;
          tx.update(userRef, {
            mensagensRestantes: 10,
            dataUltimoReset: now,
          });
        }

        // ❌ REMOVIDO: Reset mensal da cota de imagens (sistema antigo)
        // O contador de imagens agora é gerenciado automaticamente por:
        // - normalizeUserDoc() em userPlans.js
        // - Campo plano: imagesMonth (não objeto imagemAnalises)

        // Verificar limite de mensagens diárias (apenas plano gratuito)
        if (userData.plano === 'gratis') {
          if (userData.mensagensRestantes <= 0) {
            throw new Error('LIMIT_EXCEEDED');
          }
          tx.update(userRef, {
            mensagensRestantes: FieldValue.increment(-1),
          });
          userData.mensagensRestantes =
            (userData.mensagensRestantes || 10) - 1;
        }
      }

      return userData;
    });

    const finalSnap = await userRef.get();
    return { ...result, perfil: finalSnap.data().perfil };
  } catch (error) {
    if (error.message === 'LIMIT_EXCEEDED') {
      console.warn('🚫 Limite de mensagens atingido para:', email);
      throw error;
    }
    console.error('❌ Erro na transação do usuário:', error);
    throw new Error('Erro ao processar limites do usuário');
  }
}

// Função para consumir cota de análise de imagens - NOVA
// ❌ FUNÇÃO REMOVIDA: consumeImageAnalysisQuota
// Motivo: Sistema antigo causava conflito com imagesMonth (userPlans.js)
// O contador de imagens agora é gerenciado EXCLUSIVAMENTE por:
// - canUseChat(uid, hasImages) - verifica limite
// - registerChat(uid, hasImages) - incrementa contador
// Sistema novo usa campo plano: imagesMonth (não objeto imagemAnalises)

// ═══════════════════════════════════════════════════════════
// 🎯 HELPERS PARA INTENT MIX_ANALYZER_HELP - TUTORIAL HARDCORE
// ═══════════════════════════════════════════════════════════

/**
 * Intent Classifier - Detecta se mensagem é de análise de mixagem
 * @param {string} message - Mensagem do usuário
 * @returns {string} "mix_analyzer_help" ou "default"
 */
function intentClassifier(message) {
  if (!message || typeof message !== 'string') {
    return 'default';
  }
  
  const lowerMessage = message.toLowerCase();
  
  // Indicadores fortes de análise de mixagem
  const analysisIndicators = [
    '### json_data',
    'análise de áudio',
    'lufs',
    'true peak',
    'dbtp',
    'loudness',
    'dynamic range',
    'crest factor',
    'lra',
    'problemas detectados',
    'severidade',
    'freq_excess',
    'freq_lack',
    'turbidez',
    'sibilância',
    'ressonância',
    'stereo_phase',
    'mix analyzer',
    'analisar mixagem'
  ];
  
  // Verificar se contém algum indicador
  const hasIndicator = analysisIndicators.some(indicator => 
    lowerMessage.includes(indicator)
  );
  
  if (hasIndicator) {
    console.log('🎯 Intent detectado: mix_analyzer_help');
    return 'mix_analyzer_help';
  }
  
  console.log('🎯 Intent detectado: default');
  return 'default';
}

/**
 * Prepare Analysis for Prompt - Extrai e organiza dados de análise
 * @param {Object} analysis - Objeto de análise bruto
 * @returns {Object} Análise otimizada para prompt
 */
function prepareAnalysisForPromptV2(analysis) {
  if (!analysis || typeof analysis !== 'object') {
    return null;
  }
  
  // Extrair métricas principais
  const result = {
    genre: analysis.genre || 'Não informado',
    bpm: analysis.bpm || null,
    lufsIntegrated: analysis.lufsIntegrated ?? null,
    truePeakDbtp: analysis.truePeakDbtp ?? null,
    dynamicRange: analysis.dynamicRange ?? null,
    lra: analysis.lra ?? null,
    crestFactor: analysis.crestFactor ?? null,
    problems: []
  };
  
  // Se já tem problems array, usar
  if (Array.isArray(analysis.problems) && analysis.problems.length > 0) {
    result.problems = analysis.problems
      .map(p => ({
        type: p.id || p.type || 'unknown',
        shortName: p.title || p.shortName || formatProblemName(p.id || p.type),
        severity: p.severity || 'média',
        evidence: p.evidence || formatEvidence(p, analysis),
        rangeHz: p.rangeHz || extractFreqRange(p),
        targets: p.targets || [],
        channelHint: p.channelHint || 'master'
      }))
      .sort((a, b) => {
        // Ordenar por severidade: alta > média > baixa
        const severityOrder = { alta: 3, média: 2, media: 2, baixa: 1 };
        return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      });
  } else {
    // Deduzir problemas a partir de métricas
    result.problems = deduceProblemsFromMetrics(analysis);
  }
  
  return result;
}

/**
 * Formata nome do problema de forma legível
 */
function formatProblemName(id) {
  const names = {
    'true_peak_high': 'True Peak Alto',
    'true_peak': 'True Peak Alto',
    'lufs_low': 'LUFS Baixo',
    'lufs_high': 'LUFS Alto',
    'lufs': 'LUFS Fora do Alvo',
    'dynamic_range_low': 'Dynamic Range Baixo',
    'turbidez_200_400': 'Turbidez 200-400 Hz',
    'sibilancia': 'Sibilância Excessiva',
    'ressonancia_3k2': 'Ressonância 3.2 kHz',
    'stereo_phase': 'Problemas de Fase Estéreo',
    'freq_excess': 'Excesso de Frequência',
    'freq_lack': 'Falta de Frequência'
  };
  return names[id] || id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Formata evidência do problema
 */
function formatEvidence(problem, analysis) {
  if (problem.evidence) return problem.evidence;
  
  const id = problem.id || problem.type;
  if (id?.includes('true_peak') && analysis.truePeakDbtp != null) {
    return `TP = ${analysis.truePeakDbtp.toFixed(2)} dBTP`;
  }
  if (id?.includes('lufs') && analysis.lufsIntegrated != null) {
    return `LUFS = ${analysis.lufsIntegrated.toFixed(1)}`;
  }
  if (id?.includes('dynamic_range') && analysis.dynamicRange != null) {
    return `DR = ${analysis.dynamicRange.toFixed(1)} dB`;
  }
  
  return 'Detectado na análise';
}

/**
 * Extrai range de frequência do problema
 */
function extractFreqRange(problem) {
  const id = problem.id || problem.type || '';
  
  if (id.includes('200_400') || id.includes('turbidez')) {
    return [200, 400];
  }
  if (id.includes('sibilancia')) {
    return [6000, 10000];
  }
  if (id.includes('3k2') || id.includes('3.2')) {
    return [3000, 3500];
  }
  if (problem.rangeHz) {
    return problem.rangeHz;
  }
  
  return null;
}

/**
 * Deduz problemas a partir de métricas quando não há array de problems
 */
function deduceProblemsFromMetrics(analysis) {
  const problems = [];
  
  // True Peak alto
  if (analysis.truePeakDbtp != null && analysis.truePeakDbtp > -1.0) {
    problems.push({
      type: 'true_peak_high',
      shortName: 'True Peak Alto',
      severity: analysis.truePeakDbtp > 0 ? 'alta' : 'média',
      evidence: `TP = ${analysis.truePeakDbtp.toFixed(2)} dBTP`,
      rangeHz: null,
      targets: [],
      channelHint: 'master'
    });
  }
  
  // LUFS fora do alvo (assumindo -14 como referência streaming)
  if (analysis.lufsIntegrated != null) {
    const diff = Math.abs(analysis.lufsIntegrated - (-14));
    if (diff > 3) {
      problems.push({
        type: analysis.lufsIntegrated < -14 ? 'lufs_low' : 'lufs_high',
        shortName: analysis.lufsIntegrated < -14 ? 'LUFS Baixo' : 'LUFS Alto',
        severity: diff > 6 ? 'alta' : 'média',
        evidence: `LUFS = ${analysis.lufsIntegrated.toFixed(1)}`,
        rangeHz: null,
        targets: [],
        channelHint: 'master'
      });
    }
  }
  
  // Dynamic Range muito baixo (sobre-compressão)
  if (analysis.dynamicRange != null && analysis.dynamicRange < 6) {
    problems.push({
      type: 'dynamic_range_low',
      shortName: 'Dynamic Range Baixo',
      severity: analysis.dynamicRange < 4 ? 'alta' : 'média',
      evidence: `DR = ${analysis.dynamicRange.toFixed(1)} dB`,
      rangeHz: null,
      targets: [],
      channelHint: 'mixbus'
    });
  }
  
  return problems;
}

// ✅ OTIMIZAÇÃO: Seleção inteligente de modelo para economizar tokens
function selectOptimalModel(hasImages, conversationHistory, currentMessage) {
  try {
    // ✅ DEBUG: Log entrada da função
    console.log('🎯 selectOptimalModel chamada com:', { hasImages, messageLength: currentMessage.length });
    
    // ✅ REGRA CRÍTICA: Imagens sempre usam GPT-4o
    if (hasImages) {
      console.log('🎯 GPT-4o selecionado: análise de imagem detectada');
      return {
        model: 'gpt-4o',
        reason: 'REQUIRED_FOR_IMAGES',
        maxTokens: MAX_IMAGE_ANALYSIS_TOKENS,
        temperature: 0.7
      };
    }
    
    // ✅ Análise de complexidade do texto
    const messageLength = currentMessage.length;
    const wordCount = currentMessage.split(/\s+/).length;
    const hasComplexTerms = /(?:analis|interpreta|desenvol|implement|algorit|arquitet|complex|detail|profund|técnic)/i.test(currentMessage);
    const hasCode = /(?:```|`|function|class|import|export|const|let|var|if|for|while)/i.test(currentMessage);
    const isQuestion = /(?:\?|como|qual|onde|quando|por que|explique|descreva)/i.test(currentMessage);
    
    // ✅ Verificar se é follow-up de análise de imagem recente
    const recentMessages = conversationHistory.slice(-2);
    const hasRecentImageAnalysis = recentMessages.some(msg => 
      msg.role === 'assistant' && 
      (msg.content.includes('imagem') || msg.content.includes('vejo') || msg.content.includes('analise'))
    );
    
    // ✅ Cálculo de score de complexidade
    let complexityScore = 0;
    
    // Tamanho e densidade
    if (messageLength > 500) complexityScore += 2;
    else if (messageLength > 200) complexityScore += 1;
    
    if (wordCount > 100) complexityScore += 2;
    else if (wordCount > 50) complexityScore += 1;
    
    // Conteúdo técnico
    if (hasComplexTerms) complexityScore += 3;
    if (hasCode) complexityScore += 2;
    if (isQuestion && messageLength > 100) complexityScore += 1;
    
    // Follow-up de imagem com pergunta específica
    if (hasRecentImageAnalysis && isImageRelatedFollowUp(currentMessage)) {
      complexityScore += 4; // Força usar GPT-4o
    }
    
    // ✅ DECISÃO FINAL baseada no threshold
    // 🎯 UPGRADE: Chat principal agora usa GPT-4o-mini como padrão para melhor qualidade
    const useGPT4Full = complexityScore >= GPT4_COMPLEXITY_THRESHOLD;
    const selectedModel = useGPT4Full ? 'gpt-4o' : 'gpt-4o-mini';
    const maxTokens = useGPT4Full ? MAX_TEXT_RESPONSE_TOKENS : Math.min(MAX_TEXT_RESPONSE_TOKENS, 1200);
    
    const reason = useGPT4Full 
      ? `COMPLEX_ANALYSIS: Score ${complexityScore}/${GPT4_COMPLEXITY_THRESHOLD}`
      : `STANDARD_QUALITY: Score ${complexityScore}/${GPT4_COMPLEXITY_THRESHOLD} (gpt-4o-mini)`;
    
    console.log(`🎯 ${selectedModel} selecionado:`, {
      complexityScore,
      threshold: GPT4_COMPLEXITY_THRESHOLD,
      messageLength,
      hasComplexTerms,
      hasRecentImageAnalysis,
      reason
    });
    
    return {
      model: selectedModel,
      reason,
      maxTokens,
      temperature: useGPT4Full ? 0.7 : 0.5
    };
    
  } catch (error) {
    console.warn('⚠️ Erro na seleção de modelo, usando padrão:', error.message);
    // ✅ FALLBACK SEGURO - GPT-4o-mini para melhor qualidade
    return {
      model: 'gpt-4o-mini',
      reason: 'FALLBACK_ERROR',
      maxTokens: 1000,
      temperature: 0.7
    };
  }
}

// ✅ Detectar se é pergunta relacionada à imagem analisada
function isImageRelatedFollowUp(message) {
  const imageKeywords = [
    'imagem', 'foto', 'vejo', 'viu', 'mostrei', 'anexei',
    'screenshot', 'captura', 'interface', 'tela', 'plugin',
    'waveform', 'espectro', 'eq', 'compressor', 'daw'
  ];
  
  const messageLower = message.toLowerCase();
  return imageKeywords.some(keyword => messageLower.includes(keyword));
}

// System prompts para diferentes cenários
const SYSTEM_PROMPTS = {
  // ✅ MELHORIA: Prompt otimizado para análise de imagens com GPT-4 Vision
  imageAnalysis: `Você é o SoundyAI 🎵, um especialista master EXCLUSIVAMENTE em produção musical e análise visual técnica.

🎯 REGRAS FUNDAMENTAIS:
- ANALISE APENAS imagens relacionadas à música: DAWs, plugins, waveforms, espectrogramas, mixers, equipamentos musicais
- Se a imagem não for relacionada à música/áudio, responda: "🎵 Analiso apenas imagens relacionadas à produção musical! Envie screenshots de DAWs, plugins, waveforms ou equipamentos de áudio."
- SEMPRE mantenha foco exclusivo em contexto musical

🔍 INSTRUÇÕES PARA ANÁLISE DE IMAGENS MUSICAIS:
- Analise detalhadamente todas as imagens com foco técnico e prático
- Identifique: interfaces de DAW, plugins, waveforms, espectrogramas, mixers, equipamentos
- Forneça feedback específico sobre configurações visíveis (valores exatos em Hz, dB, ms)
- Sugira melhorias concretas baseadas no que você vê
- Explique problemas identificados e suas causas
- Dê conselhos imediatamente aplicáveis
- Se vir múltiplas imagens, analise cada uma separadamente

🔍 ESPECIALIDADES DE ANÁLISE VISUAL:
- Waveforms: dinâmica, clipping, headroom, fases
- Espectrogramas: frequências dominantes, vazios espectrais, mascaramento
- Plugins EQ: curvas problemáticas, frequências de corte/boost
- Compressores: ratios, attack/release, threshold settings
- DAWs: organização, routing, problemas de workflow
- Master chain: ordem de plugins, configurações de limiting

📊 FORMATO DE RESPOSTA (apenas para imagens musicais):
- Comece identificando o que vê na(s) imagem(ns)
- Aponte problemas específicos com valores técnicos
- Sugira correções práticas e imediatas
- Finalize com dica pro aplicar agora

🚫 IMAGENS PROIBIDAS: Qualquer imagem não relacionada à música/áudio/produção.

Seja direto, técnico e focado exclusivamente em soluções musicais.`,

  // 🎯 NOVO: Prompt otimizado para chat principal - Especialista em Produção Musical
  default: `Você é o SoundyAI 🎵 — um engenheiro de mixagem e mastering sênior com 15+ anos de experiência em estúdios profissionais.

═══════════════════════════════════════════════════════════
🎯 IDENTIDADE E TOM
═══════════════════════════════════════════════════════════

• Fala como produtor profissional, não como tutorial genérico
• Linguagem técnica mas acessível — nunca robótica
• Educado, claro e direto ao ponto
• Zero enrolação — respostas densas e eficientes
• Referencia plugins, técnicas e parâmetros reais do mercado

═══════════════════════════════════════════════════════════
📐 ESTRUTURA PADRÃO DE RESPOSTA (siga sempre)
═══════════════════════════════════════════════════════════

1️⃣ **DIAGNÓSTICO RÁPIDO** (1-2 linhas)
   O que está acontecendo tecnicamente, sem rodeios.

2️⃣ **EXPLICAÇÃO TÉCNICA** (2-3 linhas)
   O porquê do problema ou da técnica — fundamentação breve.

3️⃣ **PASSO A PASSO PRÁTICO**
   • Ações numeradas e executáveis
   • Mencione plugins específicos (stock da DAW + alternativas pro)
   • Se souber a DAW do usuário, adapte os nomes dos plugins

4️⃣ **PARÂMETROS TÉCNICOS RECOMENDADOS**
   • LUFS: valores exatos (ex: -14 LUFS para streaming)
   • True Peak: sempre ≤ -1.0 dBTP
   • Frequências: Hz exatos (ex: corte em 80 Hz, boost em 3.2 kHz)
   • Compressão: ratio, attack (ms), release (ms), threshold (dB)
   • Reverb/Delay: pre-delay (ms), decay (s), mix (%)
   • Stereo: width (%), mono até X Hz

5️⃣ **ERROS COMUNS A EVITAR** (quando relevante)
   • 1-2 armadilhas típicas que o usuário deve evitar

═══════════════════════════════════════════════════════════
🛡️ REGRAS ABSOLUTAS
═══════════════════════════════════════════════════════════

1. RESPONDA APENAS sobre música, produção musical e áudio
2. Assuntos fora do escopo → redirecione educadamente:
   "🎵 Sou especialista em produção musical! Posso ajudar com mixagem, mastering, sound design... O que você precisa?"
3. NUNCA invente plugins ou técnicas inexistentes
4. SEMPRE forneça valores numéricos quando técnico
5. ADAPTE a complexidade ao nível do usuário (quando informado)
6. SEM repetição desnecessária — seja conciso mas completo

═══════════════════════════════════════════════════════════
🎚️ REFERÊNCIAS TÉCNICAS
═══════════════════════════════════════════════════════════

**Mastering Streaming:** LUFS -14 (Spotify), -16 (YouTube), TP ≤ -1.0 dBTP
**Mixagem:** Headroom -3 a -6 dBFS, mono low-end até 120-150 Hz
**Por Gênero:** Pop/EDM (-10 a -14 LUFS), Rock (-12 a -14), Trap (-8 a -12)

═══════════════════════════════════════════════════════════
🎯 PERSONALIZAÇÃO
═══════════════════════════════════════════════════════════

• **Iniciante:** Mais didático, termos simples
• **Avançado:** Direto, jargão técnico sem explicar básico
• **DAW conhecida:** Plugins stock dessa DAW
• **Gênero preferido:** Técnicas específicas do gênero

Se NÃO tiver contexto: resposta neutra, perguntando DAW/nível se relevante.`
};

// Função principal do handler
export default async function handler(req, res) {
  // ✅ CRÍTICO: Declarar todas as variáveis no início do escopo para evitar ReferenceError
  let hasImages = false;
  let modelSelection = null;
  let requestTimeout = 60000;
  let requestData = null;
  let decoded = null;
  
  const requestId = Math.random().toString(36).substring(7);
  console.log(`🔄 [${requestId}] Nova requisição recebida:`, {
    method: req.method,
    timestamp: new Date().toISOString(),
    hasBody: !!req.body,
    contentType: req.headers['content-type'],
    origin: req.headers.origin
  });

  // Prevenir múltiplas respostas
  let responseSent = false;
  const sendResponse = (status, data) => {
    if (responseSent) {
      console.warn(`⚠️ [${requestId}] Tentativa de enviar resposta duplicada ignorada`);
      return;
    }
    responseSent = true;
    return res.status(status).json(data);
  };

  try {
    await runMiddleware(req, res, corsMiddleware);
  } catch (err) {
    console.error(`❌ [${requestId}] CORS error:`, err);
    return sendResponse(403, { error: 'CORS_ERROR', message: 'Not allowed by CORS policy' });
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return sendResponse(405, { error: 'METHOD_NOT_ALLOWED', message: 'Método não permitido' });
  }

  try {
    // ✅ CORREÇÃO: Processar body dinamicamente (JSON ou multipart) com error handling
    try {
      requestData = await parseRequestBody(req);
      console.log('📨 Request data processado:', {
        hasMessage: !!requestData.message,
        hasImages: !!(requestData.images && requestData.images.length > 0),
        imageCount: requestData.images?.length || 0,
        contentType: req.headers['content-type']
      });
    } catch (parseError) {
      console.error('❌ Erro ao processar request body:', parseError);
      if (parseError.message.includes('BODY_PARSE_ERROR')) {
        return res.status(400).json({ 
          error: 'INVALID_REQUEST_FORMAT', 
          message: 'Formato de requisição inválido. Verifique se as imagens são válidas.' 
        });
      }
      throw parseError;
    }

    let validatedData;
    
    // ═══════════════════════════════════════════════════════════
    // 🔥 MODO DEMO: Detectar antes da validação
    // ═══════════════════════════════════════════════════════════
    const isDemoMode = req.headers['x-demo-mode'] === 'true' || req.query.mode === 'demo';
    const demoVisitorId = req.headers['x-demo-visitor'] || 'unknown';
    
    // Para demo, injetar um token dummy para passar validação
    if (isDemoMode && (!requestData.idToken || requestData.idToken === '')) {
      requestData.idToken = 'demo_token_' + demoVisitorId;
      console.log(`🔥 [${requestId}] DEMO MODE: Token dummy injetado`);
    }
    
    try {
      validatedData = validateAndSanitizeInput(requestData);
    } catch (error) {
      console.error('❌ Erro na validação:', error.message);
      if (error.message === 'TOKEN_MISSING') {
        // 🔥 DEMO MODE: Bypass se for demo
        if (isDemoMode) {
          console.log(`🔥 [${requestId}] DEMO MODE: Ignorando token ausente`);
          validatedData = {
            message: (requestData.message || '').trim().substring(0, 2000),
            conversationHistory: [],
            idToken: 'demo_token_' + demoVisitorId,
            images: [],
            isVoiceMessage: false,
            hasImages: false
          };
        } else {
          return res.status(401).json({ error: 'AUTH_TOKEN_MISSING', message: 'Token de autenticação necessário' });
        }
      } else if (error.message === 'MESSAGE_INVALID') {
        return res.status(422).json({ error: 'MESSAGE_INVALID', message: 'Mensagem inválida ou vazia' });
      } else if (error.message === 'IMAGES_LIMIT_EXCEEDED') {
        return res.status(422).json({ error: 'IMAGES_LIMIT_EXCEEDED', message: 'Máximo de 3 imagens por envio' });
      } else {
        throw error;
      }
    }

    const { message, conversationHistory, idToken, images } = validatedData;
    hasImages = validatedData.hasImages;
    
    // ✅ DEBUG: Log critical para diagnosticar seleção de modelo
    console.log(`🔍 [${requestId}] Estado antes da seleção de modelo:`, {
      hasImages,
      imageCount: images ? images.length : 0,
      validatedDataHasImages: validatedData.hasImages
    });

    // 🔥 Verificar autenticação (bypass para demo)
    let uid;
    let email;
    
    if (isDemoMode) {
      console.log(`🔥 [${requestId}] MODO DEMO detectado - visitor: ${demoVisitorId}`);
      uid = `demo_${demoVisitorId}`;
      email = 'demo@soundyai.com';
      decoded = { uid, email, demo: true };
    } else {
      // Verificar autenticação normal
      try {
        decoded = await auth.verifyIdToken(idToken);
      } catch (err) {
        console.error(`❌ [${requestId}] Token verification failed:`, err.message);
        return sendResponse(401, { error: 'AUTH_ERROR', message: 'Token inválido ou expirado' });
      }
      
      uid = decoded.uid;
      email = decoded.email;
    }

    // ✅ SEGURANÇA: Verificar rate limiting (aplicar também no demo)
    if (!checkRateLimit(uid)) {
      return sendResponse(429, { 
        error: 'RATE_LIMIT_EXCEEDED', 
        message: 'Muitas solicitações. Aguarde um momento antes de tentar novamente.',
        retryAfter: 60
      });
    }

    // Gerenciar limites de usuário com sistema centralizado
    let chatCheck;
    
    if (isDemoMode) {
      // 🔥 DEMO MODE: Permitir chat (frontend controla o limite de 1)
      chatCheck = { 
        allowed: true, 
        demo: true, 
        remaining: 1,
        user: { 
          uid: uid,
          email: email,
          plan: 'demo',
          entrevistaConcluida: true,
          messagesMonth: 0
        }
      };
      console.log(`🔥 [${requestId}] DEMO MODE: Limites controlados pelo frontend`);
    } else {
      try {
        chatCheck = await canUseChat(uid, hasImages);
      } catch (planError) {
        // 🚨 CRÍTICO: Erro ao buscar plano - NÃO assumir free
        console.error(`[CHAT-LIMIT-AUDIT] PLAN_LOOKUP_FAILED uid=${uid} error=${planError.message}`);
        return sendResponse(500, {
          ok: false,
          code: 'PLAN_LOOKUP_FAILED',
          message: 'Erro ao verificar seu plano. Tente novamente.',
        });
      }
    }
    
    // 📊 [CHAT-LIMIT-AUDIT] Log de diagnóstico
    const currentMonth = new Date().toISOString().slice(0, 7);
    const planLimits = { free: 20, plus: 80, pro: Infinity, demo: 1 };
    const userPlan = (chatCheck.user?.plan || 'free').toLowerCase();
    const userLimit = planLimits[userPlan] || 20;
    const usedMessages = chatCheck.user?.messagesMonth || 0;
    
    console.log(`[CHAT-LIMIT-AUDIT] uid=${uid} plan=${userPlan} period=${currentMonth} usedBefore=${usedMessages} limit=${userLimit} decision=${chatCheck.allowed ? 'ALLOW' : 'BLOCK'} reason=${chatCheck.errorCode || 'OK'} timestamp=${new Date().toISOString()}`);
    
    if (!chatCheck.allowed) {
      // 🚨 Calcular primeiro dia do próximo mês para resetAt
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const resetAt = nextMonth.toISOString().split('T')[0];
      
      return sendResponse(429, {
        ok: false,
        code: 'LIMIT_REACHED',
        scope: 'chat',
        plan: userPlan,
        limit: userLimit,
        used: usedMessages,
        period: currentMonth,
        resetAt: resetAt,
        message: `Você atingiu o limite de ${userLimit} mensagens mensais do plano ${userPlan.toUpperCase()}.`,
      });
    }
    
    const userData = chatCheck.user;

    // ❌ REMOVIDO: consumeImageAnalysisQuota (sistema antigo)
    // O contador de imagens agora é gerenciado por canUseChat/registerChat

    // 🎯 SISTEMA AVANÇADO: Intent Detection + Context Injection + Token Management
    let detectedIntent = null;
    let intentInfo = null;
    
    try {
      // 🎯 PASSO 1: Detectar intent da mensagem (usar classifier simples)
      detectedIntent = intentClassifier(message);
      
      // Se detectou mix_analyzer_help, usar classifier avançado para mais detalhes
      if (detectedIntent === 'mix_analyzer_help') {
        try {
          intentInfo = classifyIntent(message, conversationHistory);
          detectedIntent = intentInfo.intent;
          console.log(`🎯 Intent AVANÇADO detectado: ${detectedIntent}`, {
            confidence: intentInfo.confidence,
            reasoning: intentInfo.reasoning
          });
        } catch (e) {
          console.log('🎯 Intent SIMPLES detectado: mix_analyzer_help');
          intentInfo = { intent: 'mix_analyzer_help', confidence: 0.9, reasoning: 'Indicadores de análise detectados' };
        }
      } else {
        // Para outros intents, tentar classifier avançado
        try {
          intentInfo = classifyIntent(message, conversationHistory);
          detectedIntent = intentInfo.intent;
          console.log(`🎯 Intent detectado: ${detectedIntent}`, {
            confidence: intentInfo.confidence,
            reasoning: intentInfo.reasoning
          });
        } catch (e) {
          console.log(`🎯 Intent fallback: ${detectedIntent}`);
          intentInfo = { intent: detectedIntent, confidence: 0.5, reasoning: 'Fallback do classifier simples' };
        }
      }
    } catch (intentError) {
      console.warn('⚠️ Erro ao classificar intent, usando fallback:', intentError.message);
      detectedIntent = 'default';
      intentInfo = { intent: 'default', confidence: 0.5, reasoning: 'Erro no classifier' };
    }

    // 🎯 PASSO 2: Preparar contexto do usuário (DAW, gênero, nível)
    // ✅ CORREÇÃO CRÍTICA: Usar nomes corretos dos campos do Firestore
    // 🔒 REGRA DE NEGÓCIO: Personalização APENAS para Plus/Pro/DJ
    const userPlanForPersonalization = (userData.plano || 'gratis').toLowerCase();
    const isPremiumUser = ['plus', 'pro', 'dj'].includes(userPlanForPersonalization);
    
    let userContext = {};
    
    if (isPremiumUser && userData.perfil) {
      // ✅ Usuários Plus/Pro/DJ: usar entrevista completa
      userContext = {
        nomeArtistico: userData.perfil?.nomeArtistico || null,
        nivelTecnico: userData.perfil?.nivelTecnico || null,
        daw: userData.perfil?.daw || null,
        estilo: userData.perfil?.estilo || null,
        dificuldade: userData.perfil?.dificuldade || null,
        sobre: userData.perfil?.sobre || null,
        // Aliases para compatibilidade com código legado
        level: userData.perfil?.nivelTecnico || null,
        genre: userData.perfil?.estilo || null
      };
      
      console.log(`✅ [${userPlanForPersonalization.toUpperCase()}] Contexto PERSONALIZADO carregado:`, {
        nomeArtistico: userContext.nomeArtistico || '(não informado)',
        nivelTecnico: userContext.nivelTecnico || '(não informado)',
        daw: userContext.daw || '(não informado)',
        estilo: userContext.estilo || '(não informado)',
        temDificuldade: !!userContext.dificuldade,
        temSobre: !!userContext.sobre
      });
    } else {
      // ❌ Usuários Free: contexto vazio (respostas genéricas)
      console.log(`❌ [${userPlanForPersonalization.toUpperCase()}] Sem personalização - plano FREE`);
      userContext = {}; // Garante que nenhum dado será injetado
    }
    
    console.log('📋 Contexto do usuário final:', userContext);

    // 🎯 PASSO 3: Selecionar system prompt baseado no intent
    let baseSystemPrompt;
    let promptConfig;
    
    try {
      baseSystemPrompt = getSystemPromptForIntent(detectedIntent, hasImages);
      promptConfig = getPromptConfigForIntent(detectedIntent, hasImages);
      
      // Injetar contexto do usuário no system prompt
      const systemPromptWithContext = injectUserContext(baseSystemPrompt, userContext);
      
      console.log(`🎯 System prompt selecionado para intent: ${detectedIntent}`, {
        temperature: promptConfig.temperature,
        maxTokens: promptConfig.maxTokens,
        preferredModel: promptConfig.preferredModel,
        hasContext: !!(userContext.daw || userContext.genre || userContext.level)
      });
      
      baseSystemPrompt = systemPromptWithContext;
      
    } catch (promptError) {
      console.warn('⚠️ Erro ao selecionar prompt, usando fallback:', promptError.message);
      // Fallback para prompts antigos (compatibilidade) - ATUALIZADO para GPT-4o-mini
      baseSystemPrompt = hasImages ? SYSTEM_PROMPTS.imageAnalysis : SYSTEM_PROMPTS.default;
      promptConfig = {
        temperature: 0.5,
        maxTokens: hasImages ? 1500 : 1200,
        preferredModel: hasImages ? 'gpt-4o' : 'gpt-4o-mini'
      };
    }

    // 🎯 PASSO 4: Preparar mensagens para a IA
    const messages = [];
    
    // System prompt (já com contexto injetado)
    messages.push({
      role: 'system',
      content: baseSystemPrompt
    });

    // 🎯 PASSO 5: Adicionar histórico (expandido de 5 para 10 mensagens)
    const historyLimit = 10; // Melhorado de 5 para 10
    const recentHistory = conversationHistory.slice(-historyLimit);
    
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }

    // 🎯 PASSO 6: Filtrar e otimizar mensagem (se for análise de mix)
    let optimizedMessage = message;
    let analysisData = null;
    
    if ((detectedIntent === 'MIX_ANALYZER_HELP' || detectedIntent === 'mix_analyzer_help') && !hasImages) {
      try {
        // Tentar extrair JSON da mensagem
        const jsonMatch = message.match(/### JSON_DATA\s*\n([\s\S]*?)\n### END_JSON/);
        
        if (jsonMatch) {
          const jsonData = JSON.parse(jsonMatch[1]);
          
          // 🎯 NOVO: Usar prepareAnalysisForPromptV2 para tutorial hardcore
          analysisData = prepareAnalysisForPromptV2(jsonData);
          
          if (analysisData && analysisData.problems && analysisData.problems.length > 0) {
            // Montar mensagem otimizada com formato JSON limpo
            optimizedMessage = JSON.stringify(analysisData, null, 2) + 
                              '\n\nGere a resposta seguindo ESTRITAMENTE o CONTRATO e o UI CONTRACT.';
            
            console.log(`🎯 Análise preparada para tutorial hardcore:`, {
              problems: analysisData.problems.length,
              lufs: analysisData.lufsIntegrated,
              truePeak: analysisData.truePeakDbtp,
              genre: analysisData.genre
            });
          } else {
            // Fallback: usar helper antigo
            const filteredAnalysis = prepareAnalysisForPrompt(jsonData);
            const optimizedText = formatAnalysisAsText(filteredAnalysis);
            
            const headerMatch = message.match(/^(.*?)(?=### JSON_DATA)/s);
            const header = headerMatch ? headerMatch[1].trim() : '🎵 Análise de áudio para consultoria';
            
            optimizedMessage = `${header}\n\n${optimizedText}`;
            
            console.log(`🎯 Mensagem de análise otimizada (fallback):`, {
              originalLength: message.length,
              optimizedLength: optimizedMessage.length,
              reduction: `${Math.round((1 - optimizedMessage.length / message.length) * 100)}%`
            });
          }
        } else {
          console.log('⚠️ JSON_DATA não encontrado, usando mensagem original');
        }
      } catch (filterError) {
        console.warn('⚠️ Erro ao filtrar análise, usando mensagem original:', filterError.message);
        // Continuar com mensagem original
      }
    }
    
    // Preparar mensagem do usuário (otimizada se aplicável)
    const userMessage = {
      role: 'user',
      content: hasImages ? [
        { type: 'text', text: optimizedMessage },
        ...images.map(img => ({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${img.base64}`,
            detail: 'high'
          }
        }))
      ] : optimizedMessage
    };

    messages.push(userMessage);

    // 🎯 PASSO 7: Seleção inteligente de modelo (usa intent detectado)
    modelSelection = selectOptimalModel(hasImages, conversationHistory, message);
    
    // 🚀 PASSO 8: LÓGICA HÍBRIDA - GPT-4o-mini primeira resposta + GPT-3.5 follow-ups
    if ((detectedIntent === 'MIX_ANALYZER_HELP' || detectedIntent === 'mix_analyzer_help') && !hasImages && promptConfig) {
      try {
        // 🧠 DETECÇÃO DE PRIMEIRA RESPOSTA: Se nunca houve mensagem do assistente, é a primeira
        const lastAssistantMessage = conversationHistory.find(msg => msg.role === 'assistant' && msg.content);
        const isFirstResponse = !lastAssistantMessage;
        
        if (isFirstResponse) {
          console.log(`🚀 PRIMEIRA RESPOSTA: Usando GPT-4o-mini para máxima qualidade (intent: ${detectedIntent})`);
          modelSelection = {
            model: 'gpt-4o-mini',
            reason: 'FIRST_RESPONSE_AFTER_ANALYSIS',
            maxTokens: 1800,       // Mais espaço para resposta detalhada
            temperature: 0.3,      // Máxima precisão técnica
            top_p: 1               // Determinístico
          };
        } else {
          console.log(`📚 FOLLOW-UP: Usando GPT-4o-mini para eficiência (intent: ${detectedIntent})`);
          modelSelection = {
            model: 'gpt-4o-mini',
            reason: 'FOLLOWUP_MODE_MIX_ANALYZER',
            maxTokens: 1300,       // Eficiente para follow-ups
            temperature: 0.3,      // Máxima precisão
            top_p: 1               // Determinístico
          };
        }
      } catch (error) {
        console.error('❌ Erro na seleção híbrida de modelo:', error);
        // Fallback seguro para gpt-4o-mini
        modelSelection = {
          model: 'gpt-4o-mini',
          reason: 'FALLBACK_ERROR',
          maxTokens: 1300,
          temperature: 0.3,
          top_p: 1
        };
      }
    }
    
    // 📊 AUDIT LOG: Registrar decisão de modelo para análise de custo/qualidade
    if (detectedIntent === 'MIX_ANALYZER_HELP' || detectedIntent === 'mix_analyzer_help') {
      const lastAssistantMessage = conversationHistory.find(msg => msg.role === 'assistant' && msg.content);
      const isFirstResponse = !lastAssistantMessage;
      console.log(`📊 AUDIT MODEL SELECTION:
  intent=${detectedIntent}
  firstResponse=${isFirstResponse}
  model=${modelSelection.model}
  reason=${modelSelection.reason}
  maxTokens=${modelSelection.maxTokens}
  temperature=${modelSelection.temperature}
  conversationHistoryLength=${conversationHistory.length}`);
    }
    
    // Sobrescrever com preferência do intent se aplicável (outros casos)
    else if (promptConfig && promptConfig.preferredModel) {
      const intentPreferredModel = promptConfig.preferredModel;
      
      // Apenas sobrescrever se for upgrade (nunca downgrade de gpt-4o para gpt-3.5)
      if (intentPreferredModel === 'gpt-4o' && modelSelection.model === 'gpt-3.5-turbo') {
        console.log(`🎯 Upgrade de modelo: ${modelSelection.model} → ${intentPreferredModel} (intent: ${detectedIntent})`);
        modelSelection = {
          model: intentPreferredModel,
          reason: `INTENT_PREFERENCE_${detectedIntent}`,
          maxTokens: promptConfig.maxTokens,
          temperature: promptConfig.temperature
        };
      }
    }
    
    // ✅ SEGURANÇA CRÍTICA: Garantir GPT-4o para imagens (double-check)
    if (hasImages && modelSelection.model !== 'gpt-4o') {
      console.warn('🚨 CORREÇÃO CRÍTICA: Forçando GPT-4o para imagens!');
      modelSelection = {
        model: 'gpt-4o',
        reason: 'FORCED_FOR_IMAGES_SAFETY',
        maxTokens: MAX_IMAGE_ANALYSIS_TOKENS,
        temperature: 0.7
      };
    }

    // 🎯 PASSO 9: Validar e otimizar orçamento de tokens
    let finalMessages = messages;
    let tokenBudgetInfo = null;
    
    try {
      const budgetResult = prepareMessagesWithBudget(
        messages, 
        modelSelection.model, 
        modelSelection.maxTokens
      );
      
      finalMessages = budgetResult.messages;
      tokenBudgetInfo = budgetResult.budget;
      
      if (budgetResult.trimmed) {
        console.log(`⚠️ Histórico reduzido: ${budgetResult.removedCount} mensagens removidas para caber no orçamento`);
      }
      
      console.log(`📊 Token Budget:`, {
        input: tokenBudgetInfo.usage.inputTokens,
        maxOutput: tokenBudgetInfo.usage.maxOutputTokens,
        total: tokenBudgetInfo.usage.totalEstimated,
        limit: tokenBudgetInfo.usage.limit,
        margin: tokenBudgetInfo.usage.margin,
        valid: tokenBudgetInfo.valid
      });
      
    } catch (budgetError) {
      console.warn('⚠️ Erro ao validar token budget, usando mensagens sem trimming:', budgetError.message);
      // Continuar com mensagens originais em caso de erro
      finalMessages = messages;
    }
    
    console.log(`🤖 Usando modelo: ${modelSelection.model}`, {
      reason: modelSelection.reason,
      maxTokens: modelSelection.maxTokens,
      temperature: modelSelection.temperature,
      hasImages: hasImages,
      intent: detectedIntent,
      messageCount: finalMessages.length
    });

    // ✅ TIMEOUT CONFIGURÁVEL baseado na complexidade
    requestTimeout = hasImages ? 180000 : (modelSelection.model === 'gpt-4o' ? 120000 : 60000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

    // Chamar API da OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelSelection.model,
        messages: finalMessages, // 🎯 Usando mensagens otimizadas
        max_tokens: modelSelection.maxTokens,
        temperature: modelSelection.temperature,
      }),
    });

    // ✅ Limpar timeout após resposta
    clearTimeout(timeoutId);

    // ✅ MELHORIA: Tratamento de erro mais específico e retry em casos específicos
    if (!response.ok) {
      let errorDetails = 'Unknown error';
      try {
        errorDetails = await response.text();
      } catch (parseErr) {
        console.error('❌ Failed to parse OpenAI error response:', parseErr);
      }
      console.error('❌ OpenAI API Error:', {
        status: response.status,
        statusText: response.statusText,
        details: errorDetails,
        model: modelSelection.model,
        hasImages: hasImages
      });
      
      // Mapear erros específicos da OpenAI
      if (response.status === 401) {
        throw new Error('OpenAI API key invalid or expired');
      } else if (response.status === 429) {
        // Rate limit - sugerir retry
        throw new Error('OpenAI API rate limit exceeded. Please try again in a moment.');
      } else if (response.status === 400 && errorDetails.includes('image')) {
        // Erro específico de imagem
        throw new Error('Image format not supported or corrupted. Please try a different image.');
      } else if (response.status >= 500) {
        throw new Error('OpenAI service temporarily unavailable');
      } else {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    console.log(`✅ [${requestId}] Resposta da IA gerada com sucesso`, {
      model: modelSelection ? modelSelection.model : 'unknown',
      hasImages: hasImages,
      responseLength: reply.length,
      tokenEstimate: Math.ceil(reply.length / 4),
      userPlan: userData.plano
    });

    // Preparar resposta final
    const responseData = {
      reply,
      mensagensRestantes: userData?.plano === 'gratis' ? userData?.mensagensRestantes : null,
      model: modelSelection ? modelSelection.model : 'unknown',
      plan: isDemoMode ? 'demo' : (userData?.plano || 'unknown'),
      demoMode: isDemoMode || false,
      // ✅ Incluir info se foi análise de imagem
      ...(hasImages && { imageAnalysisProcessed: true })
    };

    // ✅ REGISTRAR USO DE CHAT NO SISTEMA DE LIMITES
    // 🔥 DEMO MODE: Não registrar no banco
    if (!isDemoMode) {
      await registerChat(uid, hasImages); // ✅ CORRIGIDO: Passar hasImages
    } else {
      console.log(`🔥 [${requestId}] DEMO MODE: Pulando registro de uso no banco`);
    }

    return sendResponse(200, responseData);

  } catch (error) {
    // ✅ Limpar timeout em caso de erro
    if (typeof timeoutId !== 'undefined') {
      clearTimeout(timeoutId);
    }
    
    console.error(`💥 [${requestId}] ERRO NO SERVIDOR:`, {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userId: 'unknown',
      hasImages: typeof hasImages !== 'undefined' ? !!hasImages : false,
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
      contentType: req.headers['content-type']
    });
    
    // ✅ Tratamento específico para AbortError (timeout)
    if (error.name === 'AbortError') {
      console.error('⏰ Timeout na requisição para OpenAI:', {
        timeout: typeof requestTimeout !== 'undefined' ? requestTimeout : 60000,
        model: modelSelection ? modelSelection.model : 'unknown',
        hasImages: typeof hasImages !== 'undefined' ? hasImages : false
      });
      return sendResponse(408, { 
        error: 'REQUEST_TIMEOUT', 
        message: 'A análise demorou mais que o esperado. Tente novamente ou reduza a complexidade da mensagem.'
      });
    }
    
    // ✅ Categorizar erros específicos para melhor debugging
    if (error.message.includes('IMAGES_LIMIT_EXCEEDED')) {
      return sendResponse(422, { 
        error: 'IMAGES_LIMIT_EXCEEDED', 
        message: `Máximo ${MAX_IMAGES_PER_MESSAGE} imagens por envio.`
      });
    }
    
    if (error.message.includes('IMAGE_TOO_LARGE')) {
      return sendResponse(413, { 
        error: 'IMAGE_TOO_LARGE', 
        message: `Imagem muito grande. Máximo ${MAX_IMAGE_MB}MB por imagem.`
      });
    }
    
    if (error.message.includes('PAYLOAD_TOO_LARGE')) {
      return sendResponse(413, { 
        error: 'PAYLOAD_TOO_LARGE', 
        message: `Payload total muito grande. Máximo ${MAX_TOTAL_PAYLOAD_MB}MB no total.`
      });
    }
    
    if (error.message.includes('INVALID_IMAGE_FORMAT')) {
      return sendResponse(415, { 
        error: 'INVALID_IMAGE_FORMAT', 
        message: 'Formato de imagem inválido. Use JPEG, PNG ou WebP.'
      });
    }
    
    if (error.message.includes('FORMIDABLE_ERROR')) {
      return sendResponse(400, { 
        error: 'FILE_UPLOAD_ERROR', 
        message: 'Erro ao processar upload de arquivo. Verifique se as imagens são válidas.'
      });
    }
    
    if (error.message.includes('BODY_PARSE_ERROR')) {
      return sendResponse(400, { 
        error: 'REQUEST_FORMAT_ERROR', 
        message: 'Formato de requisição inválido.'
      });
    }
    
    if (error.message.includes('PROCESS_ERROR')) {
      return sendResponse(422, { 
        error: 'DATA_PROCESSING_ERROR', 
        message: 'Erro ao processar dados enviados.'
      });
    }
    
    if (error.message.includes('OpenAI')) {
      return sendResponse(503, { 
        error: 'AI_SERVICE_ERROR', 
        message: 'Serviço de IA temporariamente indisponível. Tente novamente.'
      });
    }
    
    if (error.message.includes('Firebase') || error.message.includes('auth')) {
      return sendResponse(401, { 
        error: 'AUTH_ERROR', 
        message: 'Erro de autenticação. Faça login novamente.'
      });
    }
    
    // Erro genérico
    return sendResponse(500, { 
      error: 'SERVER_ERROR', 
      message: 'Erro interno do servidor. Nossa equipe foi notificada.',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
