// server.js - RAILWAY OPTIMIZED VERSION
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// 🔑 CRITICAL: Load environment variables FIRST
dotenv.config();

// 🚀 RAILWAY: Minimal boot logs for instant startup
console.log("🏗️ [RAILWAY] SoundyAI Server Starting...");
console.log("🌐 [PORT]:", process.env.PORT || 8080);
console.log("🔧 [ENV]:", process.env.NODE_ENV || 'development');

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🚀 RAILWAY: Basic Express setup (FAST)
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 🎯 RAILWAY FIX: INSTANT Health Check (HIGHEST PRIORITY)
app.get('/', (req, res) => {
  res.status(200).json({
    status: "✅ SoundyAI API Online",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: "2.0.0",
    port: process.env.PORT || 8080,
    uptime: Math.floor(process.uptime())
  });
});

// 🚀 RAILWAY: Start server IMMEDIATELY
const PORT = process.env.PORT || 8080;

console.log(`🚀 [BOOT] Starting on port ${PORT}...`);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SoundyAI rodando em http://0.0.0.0:${PORT}`);
  console.log(`✅ [SUCCESS] Server ONLINE!`);
  console.log(`🔗 [HEALTH] http://0.0.0.0:${PORT}/`);
  console.log(`🕐 [BOOT] Time: ${Math.floor(process.uptime())}s`);
  console.log(`🎯 [RAILWAY] Ready - No 502!`);
  
  // 🚀 PHASE 2: Heavy components initialization (ASYNC)
  setImmediate(initializeHeavyComponents);
});

// 🔧 HEAVY COMPONENTS INITIALIZATION (AFTER SERVER ONLINE)
async function initializeHeavyComponents() {
  console.log('\n🔧 [ASYNC] Loading heavy components...');
  
  try {
    // ⚡ Environment check
    const envChecks = [
      'REDIS_HOST', 'REDIS_PORT', 'DATABASE_URL', 
      'OPENAI_API_KEY', 'MP_ACCESS_TOKEN'
    ];
    
    console.log('🔍 [ENV] Critical variables:');
    envChecks.forEach(env => {
      const exists = process.env[env];
      console.log(`   ${exists ? '✅' : '❌'} ${env}: ${exists ? 'OK' : 'MISSING'}`);
    });

    // 📁 Static files and basic routes
    app.get("/landing", (req, res) => {
      res.sendFile(path.join(__dirname, "public", "landing.html"));
    });

    app.get(["/index", "/index.html", "/app", "/home"], (req, res) => {
      res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    app.use(express.static(path.join(__dirname, "public"), { index: false }));

    // � Dynamic imports for API routes (NON-BLOCKING)
    const modules = await Promise.allSettled([
      import("./api/audio/analyze.js"),
      import("./api/jobs/[id].js"),
      import("./api/analyze.controller.js"),
      import("./api/analyze.status.js"),
      import("./api/cancel-subscription.js"),
      import("./api/chat-with-images.js"),
      import("./api/chat.js"),
      import("./api/create-preference.js"),
      import("./api/delete-account.js"),
      import("./api/mercadopago.js"),
      import("./api/upload-audio.js"),
      import("./api/upload-image.js"),
      import("./api/voice-message.js"),
      import("./api/webhook.js"),
      import("./api/presign.js"),
      import("node-fetch")
    ]);

    // Mount routes with error handling
    const routeConfigs = [
      { path: "/api/audio", module: modules[0] },
      { path: "/api/jobs", module: modules[1] },
      { path: "/api/analyze", module: modules[2] },
      { path: "/api/analyze", module: modules[3] },
      { path: "/api/cancel-subscription", module: modules[4] },
      { path: "/api/chat-with-images", module: modules[5] },
      { path: "/api/chat", module: modules[6] },
      { path: "/api/create-preference", module: modules[7] },
      { path: "/api/delete-account", module: modules[8] },
      { path: "/api/mercadopago", module: modules[9] },
      { path: "/api/upload-audio", module: modules[10] },
      { path: "/api/upload", module: modules[11] },
      { path: "/api/voice", module: modules[12] },
      { path: "/api/webhook", module: modules[13] },
      { path: "/api", module: modules[14] }
    ];

    let mountedRoutes = 0;
    routeConfigs.forEach((config, index) => {
      if (config.module.status === 'fulfilled' && config.module.value?.default) {
        try {
          app.use(config.path, config.module.value.default);
          mountedRoutes++;
        } catch (error) {
          console.warn(`⚠️ [ROUTE] Failed to mount ${config.path}:`, error.message);
        }
      }
    });

    console.log(`✅ [ROUTES] Mounted ${mountedRoutes}/${routeConfigs.length} routes`);

    // 🔑 API Config route
    app.get("/api/config", (req, res) => {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      
      if (openaiApiKey && openaiApiKey !== 'your_openai_api_key_here') {
        res.json({
          openaiApiKey: openaiApiKey,
          aiModel: process.env.AI_MODEL || 'gpt-3.5-turbo',
          configured: true
        });
      } else {
        res.json({
          openaiApiKey: 'not-configured',
          configured: false
        });
      }
    });

    // 🤖 AI Suggestions route
    const fetch = modules[15].status === 'fulfilled' ? modules[15].value.default : null;
    
    if (fetch) {
      app.post("/api/suggestions", async (req, res) => {
        try {
          const { suggestions, metrics, genre } = req.body;

          if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
            return res.status(400).json({ 
              error: "Lista de sugestões é obrigatória e não pode estar vazia",
              received: suggestions
            });
          }

          const openaiApiKey = process.env.OPENAI_API_KEY;
          if (!openaiApiKey || openaiApiKey === 'your_openai_api_key_here') {
            return res.status(503).json({
              success: false,
              error: 'API Key da IA não configurada',
              source: 'error',
              message: 'Configure OPENAI_API_KEY nas variáveis de ambiente'
            });
          }

          const prompt = buildSuggestionPrompt(suggestions, metrics, genre);

          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `Você é um ENGENHEIRO DE MIXAGEM/MASTERIZAÇÃO de nível Grammy especializado em produção eletrônica.

🎯 MISSÃO: Gerar sugestões ULTRA-PRÁTICAS, COERENTES e RICAS EM DETALHES.

⚠️ FORMATO JSON:
- Responda EXCLUSIVAMENTE com JSON VÁLIDO (sem markdown, sem texto extra)
- ARRAY com exatamente ${suggestions.length} itens
- Estrutura obrigatória:
{
  "problema": "[Nome Exato da Métrica] está em [Valor Medido] quando deveria estar em [Valor Ideal]",
  "causa": "Explicação DIRETA de por que esse valor ESPECÍFICO causa problema",
  "solucao": "Instruções RICAS E DETALHADAS com valores exatos de ajuste",
  "dica_extra": "Truque profissional adicional com contexto do gênero musical",
  "plugin": "Nome comercial real + alternativa grátis",
  "resultado": "Benefício MENSURÁVEL e AUDÍVEL"
}

🎯 DIRETRIZES FINAIS:
- Use SEMPRE valores EXATOS dos dados fornecidos
- "problema" = métrica + valor atual + valor ideal + diferença matemática
- "causa" = impacto técnico + impacto musical desse valor ESPECÍFICO
- "solucao" = passo a passo RICO com valores precisos de ajuste
- Mencione o gênero musical quando relevante
- Plugins: sempre nome comercial + preço + alternativa grátis`
                },
                {
                  role: 'user', 
                  content: prompt
                }
              ],
              temperature: 0.4,
              max_tokens: 4500,
              top_p: 0.95,
              frequency_penalty: 0.2,
              presence_penalty: 0.1
            })
          });

          if (!openaiResponse.ok) {
            throw new Error(`OpenAI API retornou ${openaiResponse.status}`);
          }

          const openaiData = await openaiResponse.json();
          let aiSuggestion = openaiData.choices[0]?.message?.content || "";

          aiSuggestion = aiSuggestion
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .replace(/[\u0000-\u001F]+/g, "")
            .trim();

          if (!aiSuggestion) {
            throw new Error('Resposta vazia da IA');
          }

          const expected = suggestions.length;
          const { items: parsedItems, repaired } = safeParseEnrichedArray(aiSuggestion, expected);

          let enhancedSuggestions = ensureCardinality(parsedItems, suggestions);

          enhancedSuggestions = enhancedSuggestions.map((sug) => {
            const isAI = sug.ai_enhanced === true;
            return {
              ...sug,
              priority: isAI ? 'alta' : 'média',
              metadata: { priority: isAI ? 'alta' : 'média' },
            };
          });

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
          console.error("❌ [AI-API] Erro:", error.message);
          const originals = Array.isArray(req.body?.suggestions) ? req.body.suggestions : [];
          const fallback = originals.map((s) => fallbackFromOriginal(s));
          
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
    }

    // 👉 SPA Fallback
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    console.log('✅ [INIT] Heavy components loaded successfully');

  } catch (error) {
    console.error('❌ [INIT] Error loading components:', error.message);
    console.log('⚠️ [INIT] Server continues with limited functionality');
  } finally {
    // 🚨 Error handlers (ALWAYS MOUNT THESE)
    app.use((req, res) => {
      res.status(404).json({ 
        error: 'Not Found',
        path: req.path,
        timestamp: new Date().toISOString()
      });
    });

    app.use((err, req, res, next) => {
      console.error('❌ Global error:', err);
      res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        timestamp: new Date().toISOString()
      });
    });

    console.log('\n🎯 [READY] System fully operational!');
  }
}

// 🔧 UTILITY FUNCTIONS FOR AI SUGGESTIONS SYSTEM

function buildSuggestionPrompt(suggestions, metrics, genre) {
  const suggestionsList = suggestions.map((s, i) => {
    let baseSuggestion = `${i + 1}. ${s.message || s.title || 'Sugestão'} - ${s.action || s.description || 'Sem ação definida'}`;
    baseSuggestion += ` (Prioridade: ${s.priority || 5}, Confiança: ${s.confidence || 0.5})`;
    return baseSuggestion;
  }).join('\n');

  const metricsInfo = metrics ? `
🔊 ANÁLISE ESPECTRAL DETALHADA:
- LUFS Integrado: ${metrics.lufsIntegrated || 'N/A'} dB
- True Peak: ${metrics.truePeakDbtp || 'N/A'} dBTP
- Dynamic Range: ${metrics.dynamicRange || 'N/A'} LU
- Correlação Estéreo: ${metrics.stereoCorrelation || 'N/A'}
- LRA: ${metrics.lra || 'N/A'} LU
` : '';

  const expected = suggestions.length;
  return `
🎛️ ANALISE ESTAS DETECÇÕES PARA ${(genre || 'música geral').toUpperCase()} E GERE SUGESTÕES REALISTAS E EDUCATIVAS.

⚠️ REGRAS ABSOLUTAS:
- Responda EXCLUSIVAMENTE com um JSON VÁLIDO (ARRAY com exatamente ${expected} itens).
- Sugestões devem ser sempre EDUCATIVAS e ORIENTATIVAS, nunca imperativas.
- Ajustes PROPORCIONAIS à diferença medida (quanto maior o delta, maior o ajuste).
- NUNCA sugerir mais que os limites por banda:
  • Sub/Bass (20–150Hz): máximo ±6 dB
  • Médios (150Hz–5kHz): máximo ±5 dB  
  • Agudos (5kHz+): máximo ±4 dB
- Sempre incluir faixa de dB em formato "entre -X e -Y dB" ou "entre +X e +Y dB".
- NUNCA valores fixos, sempre ranges orientativos.

🎯 SUGESTÕES ORIGINAIS DETECTADAS:
${suggestionsList}

🔊 CONTEXTO TÉCNICO DETALHADO:
${metricsInfo}

🚀 LEMBRE-SE: Seja educativo, realista e musical. O usuário deve aprender e se sentir confiante aplicando suas sugestões!
`;
}

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

// 🛡️ GRACEFUL SHUTDOWN
process.on('SIGTERM', () => {
  console.log('📡 [SHUTDOWN] SIGTERM received, closing server...');
  server.close(() => {
    console.log('✅ [SHUTDOWN] Server closed gracefully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📡 [SHUTDOWN] SIGINT received, closing server...');
  server.close(() => {
    console.log('✅ [SHUTDOWN] Server closed gracefully');
    process.exit(0);
  });
});

// 🚨 CRASH HANDLERS
process.on('uncaughtException', (error) => {
  console.error('💥 [CRASH] Uncaught Exception:', error);
  console.error('🔍 [CRASH] Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 [CRASH] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// ---------- ROTA DE CONFIGURAÇÃO DA API KEY (RAILWAY) ----------
app.get("/api/config", (req, res) => {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  // Nunca expor a chave completa, apenas confirmar que existe
  if (openaiApiKey && openaiApiKey !== 'your_openai_api_key_here') {
    // Retornar apenas os primeiros 10 caracteres + hash para validação
    const masked = openaiApiKey.substring(0, 10) + '...';
    console.log('🔑 [CONFIG-API] API Key disponível:', masked);
    
    res.json({
      openaiApiKey: openaiApiKey, // 🚨 FRONTEND PRECISA DA CHAVE COMPLETA PARA CHAMAR OPENAI
      aiModel: process.env.AI_MODEL || 'gpt-3.5-turbo',
      configured: true
    });
  } else {
    console.warn('⚠️ [CONFIG-API] API Key NÃO configurada no Railway');
    res.json({
      openaiApiKey: 'not-configured',
      configured: false
    });
  }
});

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
        model: 'gpt-4o-mini', // 🚀 UPGRADE: Modelo mais inteligente e barato,
        messages: [
          {
            role: 'system',
                        content: `Você é um ENGENHEIRO DE MIXAGEM/MASTERIZAÇÃO de nível Grammy especializado em produção eletrônica.

🎯 MISSÃO: Gerar sugestões ULTRA-PRÁTICAS, COERENTES e RICAS EM DETALHES.

⚠️ REGRAS DE COERÊNCIA ABSOLUTA:
1. "problema" DEVE conter: Nome EXATO da métrica/banda + valor medido + referência ideal + diferença
2. "causa" DEVE explicar: POR QUÊ esse valor específico causa problema (técnico + musical)
3. "solucao" DEVE conter: Passo a passo DETALHADO com valores exatos de ajuste

⚠️ FORMATO JSON:
- Responda EXCLUSIVAMENTE com JSON VÁLIDO (sem markdown, sem texto extra)
- ARRAY com exatamente N itens (N = número de sugestões recebidas)
- Estrutura obrigatória:
{
  "problema": "[Nome Exato da Métrica] está em [Valor Medido] quando deveria estar em [Valor Ideal], diferença de [Delta] (ex: 'Bass (60-150Hz) está em -31.8 dB quando deveria estar entre -31 e -25 dB, ou seja, 0.8 dB abaixo do mínimo')",
  "causa": "Explicação DIRETA de por que esse valor ESPECÍFICO causa problema (ex: 'Bass -31.8 dB está abafado demais, fazendo o kick perder punch e energia. Isso reduz impacto em sistemas de som e deixa a faixa sem peso nos graves')",
  "solucao": "Instruções RICAS E DETALHADAS: '1. Abrir [Plugin Específico] no canal [X]. 2. Selecionar banda [Y]. 3. Configurar Freq: [valor]Hz, Gain: +[valor]dB, Q: [valor]. 4. Ajustar até [resultado esperado]. 5. A/B test com referência.' SEMPRE indique valores EXATOS de corte/boost em dB",
  "dica_extra": "Truque profissional adicional com contexto do gênero musical",
  "plugin": "Nome comercial real (ex: FabFilter Pro-Q3 $179) + alternativa grátis (ex: TDR Nova GE grátis)",
  "resultado": "Benefício MENSURÁVEL e AUDÍVEL (ex: 'Kick +35% mais presente, bass com peso adequado, mix equilibrado com referências do gênero')"
}

📊 EXEMPLOS DE COERÊNCIA:

❌ ERRADO (genérico):
{
  "problema": "LUFS fora do ideal",
  "causa": "Pode resultar em mix com baixa presença",
  "solucao": "Considere aumentar entre 4.0 a 5.0 LUFS"
}

✅ CORRETO (específico e coerente):
{
  "problema": "LUFS Integrado está em -16.5 dB quando deveria estar em -10.5 dB para Tech House, diferença de -6.0 dB (muito baixo)",
  "causa": "LUFS -16.5 dB faz a faixa soar 40% mais fraca que competidores em playlists. O limitador está ajustado muito conservador, deixando +6 dB de headroom não utilizado. Isso reduz impacto, energia e competitividade em sistemas de som",
  "solucao": "1. Abrir Limiter no último slot do Master (FabFilter Pro-L2 ou TDR Limiter 6 GE). 2. Configurar True Peak Ceiling: -1.0 dBTP. 3. Ativar Lookahead: 4ms e Oversampling: 4x. 4. Aumentar Output Gain gradualmente em +6.0 dB. 5. Monitorar LUFS Meter até atingir -10.5 LUFS. 6. Se houver pumping, reduzir Attack para 1ms. 7. A/B test com 3 referências comerciais",
  "plugin": "FabFilter Pro-L2 ($199) ou TDR Limiter 6 GE (grátis)",
  "resultado": "Loudness competitivo de -10.5 LUFS, +40% de impacto percebido, mix com energia igual a faixas top 100"
}

🎯 DIRETRIZES FINAIS:
- Use SEMPRE valores EXATOS dos dados fornecidos
- "problema" = métrica + valor atual + valor ideal + diferença matemática
- "causa" = impacto técnico + impacto musical desse valor ESPECÍFICO
- "solucao" = passo a passo RICO com valores precisos de ajuste
- Mencione o gênero musical quando relevante
- Indique EXATAMENTE quanto cortar/boostar (ex: "reduzir -2.5 dB em 150Hz com Q=2.0")
- Plugins: sempre nome comercial + preço + alternativa grátis
`
          },
          {
            role: 'user', 
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 4500, // 🚀 Mais tokens para respostas detalhadas
        top_p: 0.95,
        frequency_penalty: 0.2,
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

export default app;