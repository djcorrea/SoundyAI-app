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
            content: `Você é um assistente de mix/master altamente técnico.

REGRAS CRÍTICAS DE SAÍDA:
- Responda SOMENTE com JSON VÁLIDO (sem texto antes/depois, sem markdown), codificação UTF-8.
- Retorne um objeto com o campo "suggestions" contendo um array do MESMO comprimento das sugestões recebidas.
- Cada sugestão deve ser um objeto com as chaves (PT-BR):
  {
    "problema": "Texto explicando o problema com valores exatos (ex: Sub 20–60 Hz +24.1 dB acima do alvo -17.5 dB ±2.5 dB)",
    "causa": "Causa provável em linguagem simples",
    "solucao": "Explicação educativa e prática, incluindo faixas exatas em Hz ou dB",
    "plugin": "Plugins indicados (ex: FabFilter Pro-Q3, ReaEQ, stock DAW)",
    "resultado": "Benefício esperado (ex: mais clareza no sub e melhor compatibilidade para streaming)"
  }
- SEMPRE incluir no campo "problema" os valores medidos, alvo e tolerância no formato: "Valor medido: X dB/Hz, alvo: Y ±Z → diferença: W".
- Não inclua campos extras. Não use markdown. Não explique o JSON.
`
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

  // Processar resposta da IA e enriquecer sugestões (parser ultra blindado + autocorreção)
  const enhancedSuggestions = await processAIResponse(suggestions, aiSuggestion, process.env.OPENAI_API_KEY, process.env.AI_MODEL || 'gpt-3.5-turbo');

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
Analise estas ${suggestions.length} detecções automáticas para ${genre || 'música geral'} e transforme cada uma numa sugestão EDUCACIONAL, aplicável e precisa.

Sugestões originais (contexto):
${suggestionsList}

Métricas (apoio):
${metricsInfo}

Diretiva de saída (OBRIGATÓRIO): retorne JSON PURO com este formato EXATO:
{
  "suggestions": [
    {
      "problema": "Texto com valores exatos (ex: Sub 20–60 Hz +24.1 dB acima do alvo -17.5 dB ±2.5 dB; Valor medido: +6.6 dB, alvo: -17.5 dB ±2.5 dB → diferença: +24.1 dB)",
      "causa": "Causa provável em linguagem simples",
      "solucao": "Passos práticos e educativos incluindo Hz/dB",
      "plugin": "Plugins específicos (ex: FabFilter Pro-Q3, ReaEQ)",
      "resultado": "Benefício esperado para o usuário"
    }
  ]
}
`;
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
async function processAIResponse(originalSuggestions, aiResponse, openaiApiKey, model) {
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

    // Mapear diferentes esquemas de chaves (en/pt-br) e blocks
    const problem = aiItem?.blocks?.problem || aiItem?.problem || aiItem?.problema;
    const cause = aiItem?.blocks?.cause || aiItem?.cause || aiItem?.causa || aiItem?.causaProvavel;
    const solution = aiItem?.blocks?.solution || aiItem?.solution || aiItem?.solucao || aiItem?.solucaoPratica;
    const tip = aiItem?.blocks?.tip || aiItem?.tip || aiItem?.dica || aiItem?.dicaExtra;
    const plugin = aiItem?.blocks?.plugin || aiItem?.plugin || aiItem?.pluginFerramenta;
    const result = aiItem?.blocks?.result || aiItem?.result || aiItem?.resultadoEsperado;

    const blocks = aiItem.blocks || {
      problem: problem || `⚠️ ${original.message || original.title || 'Problema detectado'}`,
      cause: cause || '🎯 Causa técnica em análise',
      solution: solution || `🛠️ ${original.action || original.description || 'Solução recomendada'}`,
      tip: tip || '💡 Verifique com referência e mono-compatibilidade',
      plugin: plugin || '🎹 EQ/Compressor',
      result: result || '✅ Melhoria na qualidade sonora geral'
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
    let parsed = safeParseAIResponse(aiResponse, originalSuggestions);

    // Se o parse não retornou algo útil, tentar autocorreção via IA (até 2 tentativas)
    if (parsed === originalSuggestions) {
      console.log('[AI-PROCESSING] Conteúdo não parseável: ativando recuperação assistida por IA (tentativas: até 2)');
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const fixed = await fixResponseToValidJSON(aiResponse, openaiApiKey, model);
          const reparsed = safeParseAIResponse(fixed, originalSuggestions);
          if (reparsed !== originalSuggestions) {
            parsed = reparsed;
            console.log(`[AI-PROCESSING] Recuperação bem-sucedida na tentativa ${attempt}`);
            break;
          }
        } catch (e) {
          console.warn(`[AI-PROCESSING] Tentativa de recuperação ${attempt} falhou: ${e.message}`);
        }
      }
    }

    // Normalização final
    let normalized = [];
    const aiArray = Array.isArray(parsed)
      ? parsed
      : (parsed && Array.isArray(parsed.suggestions) ? parsed.suggestions : []);

    if (aiArray.length === 0) {
      console.log(`[AI-PROCESSING] Mantendo ${originalSuggestions.length} itens após recuperação`);
      normalized = originalSuggestions.map((orig) => normalizeAISuggestion(null, orig));
    } else {
      // Garantir o mesmo comprimento das originais (nunca perder sugestões)
      normalized = originalSuggestions.map((orig, idx) => normalizeAISuggestion(aiArray[idx], orig));
    }

    console.log(`✅ [AI-PROCESSING] Processamento concluído: ${normalized.length} sugestões`);
    return normalized;
  } catch (err) {
    console.error('❌ [AI-PROCESSING] Erro crítico no processamento:', err.message);
    console.log(`[AI-PROCESSING] Mantendo ${originalSuggestions.length} itens (modo de contingência)`);
    return originalSuggestions.map((orig) => normalizeAISuggestion(null, orig));
  }
}

// Parser ultra blindado para resposta da IA
function safeParseAIResponse(raw, fallbackArray) {
  try {
    const rawStr = typeof raw === 'string' ? raw : String(raw ?? '');
    console.log(`[AI-PROCESSING] Resposta recebida: ${rawStr.length} chars`);

    // 0) Se existir bloco ```json ... ```, extrair somente o conteúdo interno
    const fenceMatch = rawStr.match(/```json\s*([\s\S]*?)```/i);
    let work = fenceMatch ? fenceMatch[1] : rawStr;

    // 1) Sanitização básica
    let cleaned = work
      // remover cercas de código remanescentes
      .replace(/```json\s*|```/g, '')
      // normalizar quebras de linha
      .replace(/\r\n|\r/g, '\n')
      // normalizar aspas tipográficas
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      // remover BOM
      .replace(/^\uFEFF/, '')
      // remover caracteres de controle inválidos
      .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, '')
      .trim();

    // remover vírgulas soltas antes de ] ou }
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
    // tentar balancear colchetes básicos: remover sufixos soltos comuns
    cleaned = cleaned.replace(/\n+\s*\/{2,}.*$/gm, '');

    // 2) Tentar JSON.parse direto
    try {
      const direct = JSON.parse(cleaned);
      const arr = Array.isArray(direct) ? direct : (direct && direct.suggestions);
      if (Array.isArray(arr)) return direct; // mantém estrutura original (array puro ou objeto com suggestions)
    } catch (_) {
      // segue para estratégia de extração
    }

    // 3) Extração do array [...] válido via regex/recorte
    console.log('[AI-PROCESSING] Aplicando reformatador de conteúdo (extração de array)');
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

    // 3.1) Extração de objeto { ... } com campo suggestions
    console.log('[AI-PROCESSING] Tentando extrair objeto com suggestions');
    const objFirst = cleaned.indexOf('{');
    const objLast = cleaned.lastIndexOf('}');
    if (objFirst !== -1 && objLast !== -1 && objLast > objFirst) {
      let objText = cleaned.slice(objFirst, objLast + 1);
      objText = objText.replace(/,\s*}/g, '}');
      try {
        const obj = JSON.parse(objText);
        if (obj && Array.isArray(obj.suggestions)) return obj;
      } catch (_) {
        // segue
      }
    }

    // 4) Falhou: retornar fallback
    console.warn('[AI-PROCESSING] Conteúdo da IA fora do padrão esperado (ativar recuperação)');
    return fallbackArray; // devolve exatamente o fallback recebido
  } catch (e) {
    console.error('[AI-PROCESSING] Erro inesperado no safeParse:', e.message);
    return fallbackArray;
  }
}

// Solicita à IA que converta um texto em JSON válido no formato exigido
async function fixResponseToValidJSON(raw, apiKey, model) {
  const body = {
    model: model || 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'Você corrige respostas para JSON válido. Responda SOMENTE com JSON válido (sem markdown).' },
      { role: 'user', content: `Corrija este texto para JSON válido, no formato {"suggestions": [ { "problema": "...", "causa": "...", "solucao": "...", "plugin": "...", "resultado": "..." } ] }. Mantenha o mesmo número de itens do input. Não explique. Não adicione texto fora do JSON.\n\nTEXTO:\n${raw}` }
    ],
    temperature: 0.0,
    max_tokens: 1800
  };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error(`OpenAI JSON-fix HTTP ${resp.status}`);
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  return content;
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
