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

    // Validação dos dados de entrada
    if (!suggestions || !Array.isArray(suggestions)) {
      return res.status(400).json({ 
        error: "Lista de sugestões é obrigatória",
        fallbackSuggestions: suggestions || []
      });
    }

    // Se não tiver API key, retornar sugestões normais
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey || openaiApiKey === 'your_openai_api_key_here') {
      console.log("⚠️ OpenAI API Key não configurada - usando fallback");
      return res.json({
        success: true,
        enhancedSuggestions: suggestions,
        source: 'fallback',
        message: 'Sugestões básicas (IA indisponível)'
      });
    }

    // Construir prompt para IA
    const prompt = buildSuggestionPrompt(suggestions, metrics, genre);

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
            content: `🎵 VOCÊ É O MAIOR ESPECIALISTA MUNDIAL EM ÁUDIO ENGINEERING

🎯 EXPERTISE:
- 25+ anos mixagem/mastering profissional
- Especialista em psychoacoustics e DSP
- Conhecimento profundo de Fletcher-Munson, masking, phase
- Experiência com todos os gêneros e plataformas de streaming

🔬 SUA MISSÃO:
- Analisar problemas de áudio com precisão cirúrgica
- Fornecer soluções EXATAS com valores específicos
- Ensinar conceitos técnicos avançados
- Sempre responder em JSON estruturado

⚡ CARACTERÍSTICAS:
- Precisão técnica absoluta
- Soluções práticas e testadas
- Explicações educativas claras
- Foco em resultados auditivos reais

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

    // Processar resposta da IA e enriquecer sugestões
    const enhancedSuggestions = processAIResponse(suggestions, aiSuggestion);

    console.log(`✅ Sugestões enriquecidas com IA: ${enhancedSuggestions.length} items`);

    res.json({
      success: true,
      enhancedSuggestions,
      source: 'ai',
      message: 'Sugestões enriquecidas com IA',
      metadata: {
        originalCount: suggestions.length,
        enhancedCount: enhancedSuggestions.length,
        genre: genre || 'não especificado',
        processingTime: Date.now()
      }
    });

  } catch (error) {
    console.error("❌ Erro no endpoint de sugestões:", error.message);
    
    // Sempre retornar fallback em caso de erro
    const { suggestions } = req.body;
    res.json({
      success: true,
      enhancedSuggestions: suggestions || [],
      source: 'fallback',
      message: 'Usando sugestões básicas devido a erro na IA',
      error: error.message
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
        "problem": "⚠️ Descrição técnica precisa do problema",
        "cause": "🎯 Causa raiz específica e detalhada", 
        "solution": "🛠️ Solução prática com valores exatos",
        "tip": "💡 Dica avançada ou conceito técnico extra"
      },
      "metadata": {
        "priority": "alta|média|baixa",
        "difficulty": "iniciante|intermediário|avançado",
        "confidence": 0.95,
        "frequency_range": "20-60Hz",
        "processing_type": "EQ|Compressor|Limiter|Spatial",
        "expected_improvement": "Melhoria específica esperada"
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
  
  try {
    // Limpar resposta (remover markdown, etc.)
    const cleanResponse = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
    
    // Tentar parsear JSON
    const parsed = JSON.parse(cleanResponse);
    console.log('✅ [AI-PROCESSING] JSON válido parseado');
    
    if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
      console.log(`🔄 [AI-PROCESSING] ${parsed.suggestions.length} sugestões processadas pela IA`);
      return parsed.suggestions;
    }
    
    throw new Error('Formato de resposta inválido');
    
  } catch (error) {
    console.error('❌ [AI-PROCESSING] Erro ao processar resposta:', error.message);
    console.log('🔄 [AI-PROCESSING] Usando fallback estruturado...');
    
    // Fallback: estruturar sugestões originais
    return originalSuggestions.map(suggestion => ({
      blocks: {
        problem: `⚠️ ${suggestion.message || suggestion.title || 'Problema detectado'}`,
        cause: '🎯 Análise automática identificou desvio dos padrões técnicos',
        solution: `🛠️ ${suggestion.action || suggestion.description || 'Ajuste recomendado'}`,
        tip: '💡 Monitore resultado em diferentes sistemas de reprodução'
      },
      metadata: {
        priority: suggestion.priority || 'média',
        difficulty: 'intermediário', 
        confidence: suggestion.confidence || 0.7,
        frequency_range: suggestion.frequency_range || 'amplo espectro',
        processing_type: 'Ajuste geral',
        expected_improvement: 'Melhoria na qualidade sonora geral'
      },
      aiEnhanced: false
    }));
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
