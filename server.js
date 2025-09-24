// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fetch from "node-fetch";

// 🔑 IMPORTANTE: Carregar .env ANTES de importar outros módulos
dotenv.config();

// Rotas principais
import analyzeRoute from "./api/audio/analyze.js";
import jobsRoute from "./api/jobs/[id].js"; // 👈 rota de jobs conectada ao Postgres

console.log("📂 Arquivo .env carregado");
console.log("B2_KEY_ID:", process.env.B2_KEY_ID);
console.log("B2_APP_KEY:", process.env.B2_APP_KEY);
console.log("B2_BUCKET_NAME:", process.env.B2_BUCKET_NAME);
console.log("B2_ENDPOINT:", process.env.B2_ENDPOINT);
console.log("🗄️ DATABASE_URL:", process.env.DATABASE_URL ? "✅ Configurada" : "❌ Não configurada");

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 👉 ROTA RAIZ PRIMEIRO: abre a landing
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing.html"));
});

// 👉 Aliases para o app (index)
app.get(["/index", "/index.html", "/app", "/home"], (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 👉 Servir arquivos estáticos SEM index automático
app.use(
  express.static(path.join(__dirname, "public"), {
    index: false,
  })
);

// Rotas da API
import cancelSubscriptionRoute from "./api/cancel-subscription.js";
import chatWithImagesRoute from "./api/chat-with-images.js";
import chatRoute from "./api/chat.js";
import createPreferenceRoute from "./api/create-preference.js";
import deleteAccountRoute from "./api/delete-account.js";
import mercadopagoRoute from "./api/mercadopago.js";
import uploadAudioRoute from "./api/upload-audio.js";
import uploadImageRoute from "./api/upload-image.js";
import voiceMessageRoute from "./api/voice-message.js";
import webhookRoute from "./api/webhook.js";
import presignRoute from "./api/presign.js";

app.use("/api/cancel-subscription", cancelSubscriptionRoute);
app.use("/api/chat-with-images", chatWithImagesRoute);
app.use("/api/chat", chatRoute);
app.use("/api/create-preference", createPreferenceRoute);
app.use("/api/delete-account", deleteAccountRoute);
app.use("/api/mercadopago", mercadopagoRoute);
app.use("/api/upload-audio", uploadAudioRoute);
app.use("/api/upload", uploadImageRoute);
app.use("/api/voice", voiceMessageRoute);
app.use("/api/webhook", webhookRoute);
app.use("/api", presignRoute);

// Rotas de análise
app.use("/api/audio", analyzeRoute);
app.use("/api/jobs", jobsRoute); // ✅ rota de jobs conectada ao banco

// ---------- ROTA REVOLUCIONÁRIA DE SUGESTÕES IA ----------
app.post("/api/suggestions", async (req, res) => {
  try {
    const { suggestions, metrics, genre } = req.body;

    console.log(`🚀 [AI-API] Recebidas ${suggestions?.length || 0} sugestões para processamento`);

    // Validação dos dados de entrada
    if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
      console.error("❌ [AI-API] Lista de sugestões inválida");
      return res.status(400).json({ 
        error: "Lista de sugestões é obrigatória e não pode estar vazia",
        received: suggestions
      });
    }

    // Se não tiver API key, retornar erro (não fallback)
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey || openaiApiKey === 'your_openai_api_key_here') {
      console.error("⚠️ [AI-API] OpenAI API Key não configurada");
      return res.status(503).json({
        success: false,
        error: 'API Key da IA não configurada',
        source: 'error',
        message: 'Configure OPENAI_API_KEY nas variáveis de ambiente'
      });
    }

    console.log(`📋 [AI-API] Construindo prompt para ${suggestions.length} sugestões do gênero: ${genre || 'geral'}`);

    // Construir prompt para TODAS as sugestões
    const prompt = buildSuggestionPrompt(suggestions, metrics, genre);

    console.log(`🤖 [AI-API] Enviando prompt para OpenAI...`);

    // Chamar OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `🎵 VOCÊ É UM ASSISTENTE DE MIXAGEM E MASTERIZAÇÃO MUSICAL ULTRA-AVANÇADO

🎯 SUA MISSÃO:
Analisar os PROBLEMAS de áudio detectados e gerar sugestões EDUCATIVAS, claras e aplicáveis para o usuário.

📋 ESTRUTURA OBRIGATÓRIA para cada sugestão:

⚠️ Problema: [descrição curta e clara]
🎯 Causa Provável: [explicação técnica simples, sem jargão pesado]
🛠️ Solução Prática: [passo a passo direto que pode ser feito em qualquer DAW]
💡 Dica Extra: [truque avançado ou consideração criativa]
🎹 Exemplo de Plugin/Ferramenta: [cite pelo menos 1 plugin popular ou gratuito que ajude]
✅ Resultado Esperado: [explique de forma motivadora o que vai melhorar no som]

� REGRAS DE OURO:
- Escreva de forma educativa e motivadora, sem ser rígido
- Use linguagem simples, mas com conteúdo técnico real
- Sempre que possível, dê referências a gêneros musicais (Funk, Trap, Eletrônico, etc.)
- Saída formatada em blocos claros com emojis para facilitar leitura
- Seja prático: usuário deve conseguir aplicar HOJE no seu projeto

🚀 RESPONDA SEMPRE EM JSON PURO, SEM EXPLICAÇÕES EXTRAS.`
          },
          {
            role: 'user', 
            content: prompt
          }
        ],
        temperature: parseFloat(process.env.AI_TEMPERATURE || '0.3'),
        max_tokens: parseInt(process.env.AI_MAX_TOKENS || '2000'),
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      })
    });

    if (!openaiResponse.ok) {
      console.error("❌ Erro na API da OpenAI:", openaiResponse.status, openaiResponse.statusText);
      throw new Error(`OpenAI API retornou ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const aiSuggestion = openaiData.choices[0]?.message?.content;

    if (!aiSuggestion) {
      throw new Error('Resposta vazia da IA');
    }

  // Processar resposta da IA e enriquecer sugestões (parser ultra blindado)
  const enhancedSuggestions = processAIResponse(suggestions, aiSuggestion);

    console.log(`✅ [AI-API] Processamento concluído:`, {
      suggestionsOriginais: suggestions.length,
      suggestionsEnriquecidas: enhancedSuggestions.length,
      sucessoTotal: enhancedSuggestions.length === suggestions.length ? 'SIM' : 'PARCIAL'
    });

    res.json({
      success: true,
      enhancedSuggestions,
      source: 'ai',
      message: `${enhancedSuggestions.length} sugestões enriquecidas pela IA`,
      metadata: {
        originalCount: suggestions.length,
        enhancedCount: enhancedSuggestions.length,
        genre: genre || 'não especificado',
        processingTime: Date.now(),
        aiSuccess: enhancedSuggestions.length,
        aiErrors: Math.max(0, suggestions.length - enhancedSuggestions.length)
      }
    });

  } catch (error) {
    console.error("❌ [AI-API] Erro crítico no processamento:", error.message);

    // Manter o sistema funcionando: retornar fallback estruturado (200 OK)
    const original = req.body?.suggestions || [];
    const fallbackEnhanced = original.map((s) => ({
      blocks: {
        problem: `⚠️ ${s.message || s.title || 'Problema detectado'}`,
        cause: '🎯 Análise automática',
        solution: `🛠️ ${s.action || s.description || 'Ajuste recomendado'}`,
        tip: '💡 Monitore em diferentes sistemas',
        plugin: '🎹 EQ/Compressor nativos',
        result: '✅ Melhoria na inteligibilidade e equilíbrio'
      },
      metadata: {
        priority: s.priority || 'média',
        difficulty: 'intermediário',
        confidence: s.confidence || 0.7,
        frequency_range: s.frequency_range || 'amplo espectro',
        processing_type: 'Ajuste geral'
      },
      aiEnhanced: false
    }));

    res.json({
      success: true,
      enhancedSuggestions: fallbackEnhanced,
      source: 'fallback',
      message: 'Usando sugestões estruturadas devido a erro da IA',
      metadata: {
        originalCount: original.length,
        enhancedCount: fallbackEnhanced.length,
        aiSuccess: 0,
        aiErrors: Math.max(0, original.length - fallbackEnhanced.length)
      }
    });
  }
});

// Função para construir o prompt da IA
function buildSuggestionPrompt(suggestions, metrics, genre) {
  const suggestionsList = suggestions.map((s, i) => 
    `${i + 1}. ${s.message || s.title || 'Sugestão'} - ${s.action || s.description || 'Sem ação definida'} (Prioridade: ${s.priority || 5}, Confiança: ${s.confidence || 0.5})`
  ).join('\n');

  const metricsInfo = metrics ? `
🔊 ANÁLISE ESPECTRAL DETALHADA:
- LUFS Integrado: ${metrics.lufsIntegrated || 'N/A'} dB (Loudness global)
- True Peak: ${metrics.truePeakDbtp || 'N/A'} dBTP (Picos digitais)  
- Dynamic Range: ${metrics.dynamicRange || 'N/A'} LU (Dinâmica)
- Correlação Estéreo: ${metrics.stereoCorrelation || 'N/A'} (Espacialização)
- LRA (Range): ${metrics.lra || 'N/A'} LU (Variação dinâmica)
` : '';

  const genreContext = getGenreContext(genre);

  return `
🎵 VOCÊ É O MAIS AVANÇADO ENGENHEIRO DE ÁUDIO E MASTERING DO MUNDO

Analise estas detecções automáticas para ${genre || 'música geral'} e transforme cada uma numa sugestão REVOLUCIONÁRIA:

${suggestionsList}

${metricsInfo}

${genreContext}

📋 RETORNE JSON PURO com este formato EXATO:
{
  "suggestions": [
    {
      "blocks": {
        "problem": "⚠️ [descrição curta e clara do problema]",
        "cause": "🎯 [explicação técnica simples, sem jargão pesado]", 
        "solution": "🛠️ [passo a passo direto que pode ser feito em qualquer DAW]",
        "tip": "💡 [truque avançado ou consideração criativa]",
        "plugin": "🎹 [cite pelo menos 1 plugin popular ou gratuito que ajude]",
        "result": "✅ [explique de forma motivadora o que vai melhorar no som]"
      },
      "metadata": {
        "priority": "alta|média|baixa",
        "difficulty": "iniciante|intermediário|avançado",
        "confidence": 0.95,
        "frequency_range": "20-60Hz",
        "processing_type": "EQ|Compressor|Limiter|Spatial",
        "genre_specific": "Se aplicável ao gênero analisado"
      },
      "aiEnhanced": true
    }
  ]
}`;
}

// Função para obter contexto do gênero
function getGenreContext(genre) {
  const contexts = {
    funk_mandela: `
🎵 CONTEXTO FUNK MANDELA:
- Foco em sub bass (40-80Hz) com presença forte
- Mid bass (80-200Hz) deve ter punch sem masking
- Vocal range (1-4kHz) cristalino para inteligibilidade
- High-end (8-15kHz) controlado mas presente
- Dinâmica: moderada (DR 4-6) para energia constante
- True Peak: máximo -1dBTP para sistemas potentes
- LUFS target: -8 a -12 LUFS para som competitivo`,
    
    trance: `
🎵 CONTEXTO TRANCE:
- Sub bass limpo (30-60Hz) sem distorção
- Kick punch (60-120Hz) definido e controlado  
- Lead synths (2-8kHz) brilhantes e espaciais
- Reverb/delay equilibrados para profundidade
- Dinâmica: baixa (DR 3-5) para energia sustentada
- True Peak: -0.5dBTP para maximizar loudness
- LUFS target: -6 a -9 LUFS para dancefloor impact`,
    
    bruxaria: `
🎵 CONTEXTO BRUXARIA/EXPERIMENTAL:
- Frequências graves (20-100Hz) podem ser não-convencionais
- Mid range (200Hz-2kHz) com espaço para atmosferas
- High-end (5-20kHz) pode ter texturas únicas
- Dinâmica: variável (DR 6-12) para expressividade
- True Peak: flexível (-3 a -1dBTP) conforme estética
- LUFS target: -12 a -16 LUFS para preservar dinâmica`
  };
  
  return contexts[genre] || `
🎵 CONTEXTO GERAL:
- Analise características específicas do gênero
- Balance entre clareza e energia
- Respeite a dinâmica natural do estilo
- Foque na inteligibilidade e impacto emocional`;
}

// Função para processar resposta da IA
function processAIResponse(originalSuggestions, aiResponse) {
  console.log('🤖 [AI-PROCESSING] Processando resposta da IA...');

  // Pequena função utilitária para normalizar um item vindo da IA
  function normalizeAISuggestion(aiItem, original) {
    if (!aiItem || typeof aiItem !== 'object') {
      return {
        blocks: {
          problem: `⚠️ ${original.message || original.title || 'Problema detectado'}`,
          cause: '🎯 Análise automática',
          solution: `🛠️ ${original.action || original.description || 'Ajuste recomendado'}`,
          tip: '💡 Monitore em diferentes sistemas',
          plugin: '🎹 EQ/Compressor nativos',
          result: '✅ Melhoria esperada na clareza e impacto'
        },
        metadata: {
          priority: original.priority || 'média',
          difficulty: 'intermediário',
          confidence: original.confidence || 0.7,
          frequency_range: original.frequency_range || 'amplo espectro',
          processing_type: 'Ajuste geral'
        },
        aiEnhanced: false
      };
    }

    // Se vier no formato "flat" (problem/solution), converte para blocks
    const blocks = aiItem.blocks || {
      problem: aiItem.problem || `⚠️ ${original.message || original.title || 'Problema detectado'}`,
      cause: aiItem.cause || '🎯 Causa técnica em análise',
      solution: aiItem.solution || `🛠️ ${original.action || original.description || 'Solução recomendada'}`,
      tip: aiItem.tip || '💡 Verifique com referência e mono-compatibilidade',
      plugin: aiItem.plugin || '🎹 EQ/Compressor',
      result: aiItem.result || '✅ Melhoria na qualidade sonora geral'
    };

    const metadata = aiItem.metadata || {
      priority: aiItem.priority || original.priority || 'média',
      difficulty: aiItem.difficulty || 'intermediário',
      confidence: aiItem.confidence || original.confidence || 0.8,
      frequency_range: aiItem.frequency_range || original.frequency_range || 'banda_ampla',
      processing_type: aiItem.processing_type || 'eq'
    };

    return {
      blocks,
      metadata,
      aiEnhanced: aiItem.aiEnhanced !== undefined ? aiItem.aiEnhanced : true
    };
  }

  try {
    const parsedArray = safeParseAIResponse(aiResponse, originalSuggestions);

    // Se o safe parser devolveu as sugestões originais (fallback), normaliza todas
    const usingFallback = parsedArray === originalSuggestions;

    let normalized = [];
    if (usingFallback) {
      console.log(`�️ [AI-PROCESSING] Fallback usado, preservando ${originalSuggestions.length} sugestões`);
      normalized = originalSuggestions.map((orig) => normalizeAISuggestion(null, orig));
    } else {
      // parsedArray pode ser o próprio array de sugestões da IA OU um objeto com .suggestions
      const aiArray = Array.isArray(parsedArray)
        ? parsedArray
        : (parsedArray && Array.isArray(parsedArray.suggestions) ? parsedArray.suggestions : []);

      // Normalizar cada item, alinhando por índice com as originais
      normalized = originalSuggestions.map((orig, idx) => normalizeAISuggestion(aiArray[idx], orig));
    }

    console.log(`✅ [AI-PROCESSING] Parse bem-sucedido: ${normalized.length} sugestões`);
    return normalized;
  } catch (err) {
    console.error('❌ [AI-PROCESSING] Erro crítico no processamento:', err.message);
    console.log(`�️ [AI-PROCESSING] Fallback usado, preservando ${originalSuggestions.length} sugestões`);
    return originalSuggestions.map((orig) => normalizeAISuggestion(null, orig));
  }
}

// Parser ultra blindado para resposta da IA
function safeParseAIResponse(raw, fallbackArray) {
  try {
    const rawStr = typeof raw === 'string' ? raw : String(raw ?? '');
    console.log(`[AI-PROCESSING] Resposta recebida: ${rawStr.length} chars`);

    // 1) Sanitização básica
    let cleaned = rawStr
      // remover cercas de código markdown
      .replace(/```json\s*|```/g, '')
      // normalizar quebras de linha
      .replace(/\r\n|\r/g, '\n')
      // remover caracteres de controle inválidos
      .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, '')
      .trim();

    // remover vírgulas soltas antes de ] ou }
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

    // 2) Tentar JSON.parse direto
    try {
      const direct = JSON.parse(cleaned);
      const arr = Array.isArray(direct) ? direct : (direct && direct.suggestions);
      if (Array.isArray(arr)) return direct; // mantém estrutura original (array puro ou objeto com suggestions)
    } catch (_) {
      // segue para estratégia de extração
    }

    // 3) Extração do array [...] válido via regex/recorte
    console.log('[AI-PROCESSING] Parse falhou, correção aplicada');
    const firstIdx = cleaned.indexOf('[');
    const lastIdx = cleaned.lastIndexOf(']');
    if (firstIdx !== -1 && lastIdx !== -1 && lastIdx > firstIdx) {
      let arrayText = cleaned.slice(firstIdx, lastIdx + 1);
      // limpar vírgulas finais novamente
      arrayText = arrayText.replace(/,\s*]/g, ']');
      arrayText = arrayText.replace(/,\s*}/g, '}');
      try {
        const arr = JSON.parse(arrayText);
        if (Array.isArray(arr)) return arr; // retorna array puro
      } catch (_) {
        // ainda não deu
      }
    }

    // 4) Falhou: retornar fallback
    console.warn('[AI-PROCESSING] Parse falhou, usando fallback');
    return fallbackArray; // devolve exatamente o fallback recebido
  } catch (e) {
    console.error('[AI-PROCESSING] Erro inesperado no safeParse:', e.message);
    return fallbackArray;
  }
}

// 👉 Fallback SPA: qualquer rota não-API cai no app (index.html)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Servidor SoundyAI rodando na porta ${PORT}`);
});

export default app;
