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
            content: `Você é um engenheiro de mixagem/masterização musical altamente especializado.  
Sua missão é gerar sugestões **educativas, detalhadas e práticas**, com base nos dados de análise recebidos.  

⚠️ REGRAS ABSOLUTAS:
- Responda EXCLUSIVAMENTE com um JSON VÁLIDO.
- O JSON deve ser um ARRAY com exatamente N itens (N = número de sugestões enviadas).
- Não escreva nada antes ou depois do JSON (sem markdown, sem explicação, sem texto solto).
- Estrutura obrigatória de cada item:
  {
    "problema": "descrição clara com valores medidos e referência (ex: Subgrave +9.2 dB em 20–60 Hz, ref = –14 dB)",
    "causa": "explicação técnica e impacto auditivo do problema",
    "solucao": "passos práticos, incluindo ajuste sugerido em dB ou LUFS",
    "dica_extra": "dica de produção/masterização adicional",
    "plugin": "plugin recomendado (nomes reais ou nativos da DAW, ex: FabFilter Pro-Q3, Waves L2, limiter nativo)",
    "resultado": "descrição clara do que melhora após aplicar a solução"
  }

📊 Diretrizes:
- Sempre cite os valores exatos medidos e a referência do estilo.
- Mostre a diferença em números (ex: +3 dB acima do ideal).
- Indique quanto deve ser reduzido ou aumentado (em dB ou LUFS).
- Explique o impacto sonoro de forma simples (ex: “subgrave mascara o kick e tira punch”).
- Ofereça soluções educativas para que o usuário aprenda (ex: “Use EQ dinâmico multibanda cortando 20–60 Hz em –4 dB”).
- Sugira plugins populares, mas também dê opção de plugins nativos da DAW.
- Se o valor estiver dentro da faixa ideal, informe que está correto e não precisa ajustar.
`
          },
          {
            role: 'user', 
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 3500,
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
    let aiSuggestion = openaiData.choices[0]?.message?.content || "";

    // 🔒 Sanitização extra antes do parse
    aiSuggestion = aiSuggestion
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .replace(/[\u0000-\u001F]+/g, "")
      .trim();

    if (!aiSuggestion) {
      throw new Error('Resposta vazia da IA');
    }

    // Processar resposta da IA (JSON array com itens enriquecidos)
    const expected = suggestions.length;
    const { items: parsedItems, repaired } = safeParseEnrichedArray(aiSuggestion, expected);
    console.log(`[AI-PROCESSING] JSON ${repaired ? 'REPARADO' : 'OK'} - itens parseados: ${parsedItems.length}/${expected}`);

    // Garantir cardinalidade: preencher faltantes com fallback das originais
    let enhancedSuggestions = ensureCardinality(parsedItems, suggestions);

    // Normalização de prioridade
    let normalizedCount = 0;
    enhancedSuggestions = enhancedSuggestions.map((sug) => {
      const isAI = sug.ai_enhanced === true;
      const rootPriority = typeof sug.priority === 'string' ? sug.priority : (isAI ? 'alta' : undefined);
      const meta = sug.metadata || {};
      const metaPriority = typeof meta.priority === 'string' ? meta.priority : (isAI ? 'alta' : undefined);
      if (isAI && (rootPriority !== 'alta' || metaPriority !== 'alta')) normalizedCount++;
      return {
        ...sug,
        priority: rootPriority || (isAI ? 'alta' : 'média'),
        metadata: { ...meta, priority: metaPriority || (isAI ? 'alta' : 'média') },
      };
    });
    console.log(`[AI-NORMALIZE] priority aplicados (alta) nas enriquecidas: ${normalizedCount}`);

    console.log(`✅ [AI-API] Processamento concluído:`, {
      suggestionsOriginais: suggestions.length,
      suggestionsEnriquecidas: enhancedSuggestions.length,
      sucessoTotal: enhancedSuggestions.length === suggestions.length ? 'SIM' : 'PARCIAL'
    });

    // Garantir que todas têm priority string antes de enviar
    const finalEnhanced = enhancedSuggestions.map((sug) => ({
      ...sug,
      metadata: {
        ...(sug.metadata || {}),
        priority: typeof sug?.metadata?.priority === 'string' ? sug.metadata.priority : 'alta',
      },
    }));

    res.json({
      success: true,
      enhancedSuggestions: finalEnhanced,
      source: 'ai',
      message: `${finalEnhanced.length} sugestões enriquecidas pela IA`,
      metadata: {
        originalCount: suggestions.length,
        enhancedCount: finalEnhanced.length,
        genre: genre || 'não especificado',
        processingTime: Date.now(),
        aiSuccess: finalEnhanced.filter(s=>s.ai_enhanced === true).length,
        aiErrors: Math.max(0, suggestions.length - finalEnhanced.filter(s=>s.ai_enhanced === true).length)
      }
    });

  } catch (error) {
    console.error("❌ [AI-API] Erro crítico no processamento:", error.message);
    const originals = Array.isArray(req.body?.suggestions) ? req.body.suggestions : [];
    const fallback = originals.map((s) => fallbackFromOriginal(s));
    console.log(`[AI-PROCESSING] Fallback total aplicado: ${fallback.length}/${originals.length}`);
    res.status(200).json({
      success: true,
      enhancedSuggestions: fallback,
      source: 'ai',
      message: `${fallback.length} sugestões (fallback) enviadas`,
      metadata: {
        originalCount: originals.length,
        enhancedCount: fallback.length,
        aiSuccess: 0,
        aiErrors: originals.length
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
- LUFS Integrado: ${metrics.lufsIntegrated || 'N/A'} dB
- True Peak: ${metrics.truePeakDbtp || 'N/A'} dBTP
- Dynamic Range: ${metrics.dynamicRange || 'N/A'} LU
- Correlação Estéreo: ${metrics.stereoCorrelation || 'N/A'}
- LRA: ${metrics.lra || 'N/A'} LU
` : '';

  const genreContext = getGenreContext(genre);

  const expected = suggestions.length;
  return `
Analise estas detecções para ${genre || 'música geral'} e gere sugestões práticas. Retorne APENAS um JSON que seja um ARRAY com exatamente ${expected} itens. Para cada item:
{
  "problema": "descrição clara",
  "causa": "explicação simples",
  "solucao": "passos aplicáveis",
  "dica_extra": "dica útil",
  "plugin": "exemplo de plugin",
  "resultado": "resultado esperado"
}

Sugestões originais:
${suggestionsList}

Contexto técnico:
${metricsInfo}

Diretrizes de gênero:
${genreContext}
`;
}

// Função para obter contexto do gênero
function getGenreContext(genre) {
  const contexts = {
    funk_mandela: `
🎵 CONTEXTO FUNK MANDELA:
- Sub bass (40-80Hz) forte
- Mid bass (80-200Hz) com punch
- Vocais (1-4kHz) claros
- High-end (8-15kHz) controlado
- DR 4-6 | True Peak -1dBTP | LUFS -8 a -12`,
    
    trance: `
🎵 CONTEXTO TRANCE:
- Sub bass limpo (30-60Hz)
- Kick (60-120Hz) definido
- Leads (2-8kHz) brilhantes
- Reverb/delay equilibrados
- DR 3-5 | True Peak -0.5dBTP | LUFS -6 a -9`,
    
    bruxaria: `
🎵 CONTEXTO BRUXARIA:
- Graves (20-100Hz) livres
- Médios (200Hz-2kHz) atmosféricos
- High-end (5-20kHz) texturizado
- DR 6-12 | True Peak -3 a -1dBTP | LUFS -12 a -16`
  };
  
  return contexts[genre] || `
🎵 CONTEXTO GERAL:
- Balance clareza/energia
- Preserve dinâmica do estilo
- Foque em inteligibilidade`;
}

// Helpers de parse e fallback
function safeParseEnrichedArray(aiContent, expectedLength) {
  let repaired = false;
  try {
    const clean = aiContent.replace(/```json\n?|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return { items: parsed, repaired };
    if (parsed && Array.isArray(parsed.suggestions)) return { items: parsed.suggestions, repaired };
    throw new Error('Formato inválido: não é array');
  } catch (e1) {
    try {
      const onlyArray = extractJsonArray(aiContent);
      const fixed = fixTrailingCommas(onlyArray);
      const parsed2 = JSON.parse(fixed);
      repaired = true;
      if (Array.isArray(parsed2)) return { items: parsed2, repaired };
      return { items: [], repaired };
    } catch (e2) {
      console.error('[AI-PROCESSING] Falha no parse/reparo de JSON:', e1.message, '|', e2.message);
      return { items: [], repaired };
    }
  }
}

function extractJsonArray(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) throw new Error('Array não encontrado');
  return text.slice(start, end + 1);
}

function fixTrailingCommas(jsonStr) {
  return jsonStr
    .replace(/,\s*([\]}])/g, '$1')
    .replace(/\u0000/g, '');
}

function ensureCardinality(parsedItems, originalSuggestions) {
  const expected = originalSuggestions.length;
  const result = [];
  for (let i = 0; i < expected; i++) {
    const aiItem = parsedItems[i];
    if (aiItem && typeof aiItem === 'object') {
      result.push(normalizeEnrichedItem(aiItem, true));
    } else {
      result.push(fallbackFromOriginal(originalSuggestions[i]));
    }
  }
  return result;
}

function normalizeEnrichedItem(item, aiEnhanced) {
  return {
    problema: item.problema || '',
    causa: item.causa || '',
    solucao: item.solucao || '',
    dica_extra: item.dica_extra || '',
    plugin: item.plugin || '',
    resultado: item.resultado || '',
    ai_enhanced: aiEnhanced === true,
    priority: 'alta',
    metadata: { priority: 'alta' }
  };
}

function fallbackFromOriginal(s) {
  return {
    problema: `⚠️ ${s.message || s.title || 'Problema detectado'}`,
    causa: 'Análise automática identificou desvio dos padrões de referência',
    solucao: `🛠️ ${s.action || s.description || 'Ajuste recomendado pelo sistema'}`,
    dica_extra: '💡 Valide em diferentes sistemas de áudio',
    plugin: '🎹 EQ/Compressor nativo da DAW ou gratuito',
    resultado: '✅ Melhoria de clareza e compatibilidade',
    ai_enhanced: false,
    priority: 'média',
    metadata: { priority: 'média' }
  };
}

// 👉 Fallback SPA
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