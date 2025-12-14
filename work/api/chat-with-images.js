import { getAuth, getFirestore } from '../../firebase/admin.js';

const auth = getAuth();
const db = getFirestore();
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import cors from 'cors';
import { canUseChat, registerChat } from '../lib/user/userPlans.js';
import { chatLimiter } from '../lib/rateLimiterRedis.js'; // ✅ V3: Rate limiting GLOBAL via Redis

// Middleware CORS dinâmico
const corsMiddleware = cors({
  origin: (origin, callback) => {
    const fixedOrigin = 'https://soundyai-app-production.up.railway.app';
    const prodFrontend = 'https://https://soundyai-app-production.up.railway.app';
    const apiPreviewRegex = /^https:\/\/prod-ai-teste-[a-z0-9\-]+\.vercel\.app$/;
    const frontendPreviewRegex = /^https:\/\/ai-synth(?:-[a-z0-9\-]+)?\.vercel\.app$/;

    // Adicionar suporte para desenvolvimento local
    const localOrigins = [
      'http://localhost:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://127.0.0.1:3000',
      'http://localhost:8080',
      'http://127.0.0.1:8080'
    ];

    // Permitir origens locais, Vercel e file://
    if (!origin ||
        origin === fixedOrigin ||
        origin === prodFrontend ||
        apiPreviewRegex.test(origin) ||
        frontendPreviewRegex.test(origin) ||
        localOrigins.includes(origin) ||
        origin.startsWith('file://')) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS: ' + origin));
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

// Função para validar e sanitizar dados de entrada - ATUALIZADA COM SUPORTE A IMAGENS
function validateAndSanitizeInput(req) {
  const { message, conversationHistory = [], idToken, images = [] } = req.body;
  
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('TOKEN_MISSING');
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('MESSAGE_INVALID');
  }
  
  let validHistory = [];
  if (Array.isArray(conversationHistory)) {
    validHistory = conversationHistory
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
  
  // Validar imagens se presentes
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

// ❌ FUNÇÃO REMOVIDA: consumeImageAnalysisQuota
// Motivo: Sistema antigo causava conflito com imagesMonth (userPlans.js)
// O contador de imagens agora é gerenciado EXCLUSIVAMENTE por:
// - canUseChat(uid, hasImages) - verifica limite
// - registerChat(uid, hasImages) - incrementa contador
// Sistema novo usa campo plano: imagesMonth (não objeto imagemAnalises)

// System prompts para diferentes cenários
const SYSTEM_PROMPTS = {
  // Prompt para análise de imagens com GPT-4 Vision
  imageAnalysis: `Você é o PROD.AI 🎵, um especialista master em produção musical e análise visual.

INSTRUÇÕES PARA ANÁLISE DE IMAGENS:
- Analise detalhadamente todas as imagens fornecidas
- Identifique: interfaces, plugins, waveforms, espectrogramas, mixers, equipamentos, DAWs
- Forneça feedback técnico específico sobre configurações visíveis
- Sugira melhorias baseadas no que você vê
- Explique problemas identificados nas imagens
- Dê conselhos práticos e aplicáveis
- Use valores específicos quando relevante (Hz, dB, ms)
- Seja direto, técnico e preciso

ESPECIALIDADES:
- Análise de waveforms e espectrogramas
- Configurações de plugins (EQ, compressores, reverbs)
- Layouts de DAW e workflow
- Equipamentos de estúdio
- Problemas visuais em mixagem
- Configurações de master chain

Responda de forma detalhada sobre o que você vê nas imagens e como melhorar.`,

  // Prompt padrão para conversas sem imagens
  default: `Você é o PROD.AI 🎵, um especialista master em produção musical com conhecimento técnico avançado.

INSTRUÇÕES PRINCIPAIS:
- Seja direto, técnico e preciso em todas as respostas
- Use valores específicos, frequências exatas (Hz), faixas dinâmicas (dB), tempos (ms)
- Mencione equipamentos, plugins e técnicas por nome
- Forneça parâmetros exatos quando relevante
- Seja conciso mas completo - evite respostas genéricas
- Dê conselhos práticos e aplicáveis imediatamente

ESPECIALIDADES TÉCNICAS:
- Mixagem: EQ preciso, compressão dinâmica, reverb/delay, automação
- Mastering: Limiters, maximizers, análise espectral, LUFS, headroom
- Sound Design: Síntese, sampling, modulação, efeitos
- Arranjo: Teoria musical aplicada, harmonias, progressões
- Acústica: Tratamento de sala, posicionamento de monitores
- Workflow: Técnicas de produção rápida e eficiente`
};

// Função principal do handler com rate limiting
async function handlerWithoutRateLimit(req, res) {
  console.log('🔄 Nova requisição recebida:', {
    method: req.method,
    timestamp: new Date().toISOString(),
    hasBody: !!req.body
  });

  try {
    await runMiddleware(req, res, corsMiddleware);
  } catch (err) {
    console.error('CORS error:', err);
    return res.status(403).end();
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    let validatedData;
    try {
      validatedData = validateAndSanitizeInput(req);
    } catch (error) {
      if (error.message === 'TOKEN_MISSING') {
        return res.status(401).json({ error: 'Token de autenticação necessário' });
      }
      if (error.message === 'MESSAGE_INVALID') {
        return res.status(400).json({ error: 'Mensagem inválida ou vazia' });
      }
      if (error.message === 'IMAGES_LIMIT_EXCEEDED') {
        return res.status(400).json({ error: 'Máximo de 3 imagens por envio' });
      }
      throw error;
    }

    const { message, conversationHistory, idToken, images, hasImages } = validatedData;

    // Verificar autenticação
    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    const uid = decoded.uid;
    const email = decoded.email;

    // ✅ SISTEMA UNIFICADO: Verificar limites (texto e imagem)
    let canChat;
    try {
      canChat = await canUseChat(uid, hasImages);
      console.log(`🔐 [CHAT-CHECK] hasImages=${hasImages}, allowed=${canChat.allowed}`);
    } catch (error) {
      console.error('❌ Erro ao verificar permissão:', error);
      throw error;
    }

    if (!canChat.allowed) {
      return res.status(403).json({
        error: 'Limite atingido',
        message: canChat.reason
      });
    }

    const userData = canChat.user || { plano: 'gratis', mensagensRestantes: 0 };

    // Preparar mensagens para a IA
    const messages = [];
    
    // System prompt baseado no tipo de análise
    if (hasImages) {
      messages.push({
        role: 'system',
        content: SYSTEM_PROMPTS.imageAnalysis
      });
    } else {
      messages.push({
        role: 'system', 
        content: SYSTEM_PROMPTS.default
      });
    }

    // Adicionar histórico de conversa
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }

    // Preparar mensagem do usuário
    const userMessage = {
      role: 'user',
      content: hasImages ? [
        { type: 'text', text: message },
        ...images.map(img => ({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${img.base64}`,
            detail: 'high'
          }
        }))
      ] : message
    };

    messages.push(userMessage);

    // Escolher modelo baseado no tipo de análise
    const model = hasImages ? 'gpt-4o' : 'gpt-3.5-turbo';
    
    console.log(`🤖 Usando modelo: ${model} ${hasImages ? '(análise de imagem)' : '(texto)'}`);

    // Chamar API da OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: hasImages ? 2000 : 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Erro da OpenAI:', error);
      throw new Error('Erro na API da OpenAI');
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    console.log('✅ Resposta da IA gerada com sucesso');

    // ✅ INCREMENTAR CONTADOR
    try {
      await registerChat(uid, hasImages);
      console.log(`📊 [COUNTER] Incrementado: hasImages=${hasImages}`);
    } catch (error) {
      console.error('❌ Erro ao registrar chat:', error);
    }

    // Preparar resposta final
    const responseData = {
      reply,
      mensagensRestantes: userData.plano === 'gratis' ? userData.mensagensRestantes : null,
      model: model,
      ...(hasImages && { imageAnalysisProcessed: true })
    };

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('💥 ERRO NO SERVIDOR:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({ 
      error: 'Erro interno do servidor', 
      details: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno'
    });
  }
}

// ✅ EXPORTAR HANDLER COM RATE LIMITING
// Aplica rate limiter (30 req/min por IP) antes de processar requisição
export default function handler(req, res) {
  return chatLimiter(req, res, () => handlerWithoutRateLimit(req, res));
}
