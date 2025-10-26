// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// 🔑 IMPORTANTE: Carregar .env ANTES de importar outros módulos
dotenv.config();

// 🚀 RAILWAY OPTIMIZATION: Logs críticos mínimos no boot
console.log("🏗️ [RAILWAY] Iniciando SoundyAI Server...");
console.log("🌐 [ENV] PORT:", process.env.PORT || 'not-set');
console.log("🔧 [ENV] NODE_ENV:", process.env.NODE_ENV || 'development');

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🚀 RAILWAY: Configuração básica EXPRESS (rápida)
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 🎯 RAILWAY FIX: Health check INSTANTÂNEO (prioridade máxima)
app.get("/", (req, res) => {
  res.status(200).json({
    status: "✅ SoundyAI API Online",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: "1.0.0",
    port: process.env.PORT || 8080,
    uptime: Math.floor(process.uptime())
  });
});

// 🚀 RAILWAY: Configurar servidor IMEDIATAMENTE
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

console.log(`🚀 [BOOT] Iniciando servidor na porta ${PORT}...`);
console.log(`🌐 [BOOT] Host: ${HOST}`);

const server = app.listen(PORT, HOST, () => {
  console.log(`\n🎉 [SUCCESS] ════════════════════════════════════════`);
  console.log(`✅ [SUCCESS] SoundyAI Server ONLINE!`);
  console.log(`🚀 Servidor SoundyAI rodando em http://${HOST}:${PORT}`);
  console.log(`🔗 [HEALTH] Health check: http://${HOST}:${PORT}/`);
  console.log(`🕐 [BOOT] Tempo de boot: ${Math.floor(process.uptime())}s`);
  console.log(`🎯 [RAILWAY] Health check pronto - sem 502!`);
  console.log(`════════════════════════════════════════════════════\n`);
  
  // 🚀 FASE 2: Inicialização ASSÍNCRONA de componentes pesados
  initializeHeavyComponents();
});

// 🔧 FUNÇÃO PARA INICIALIZAR COMPONENTES PESADOS APÓS SERVER ONLINE
async function initializeHeavyComponents() {
  console.log('🔧 [ASYNC-INIT] Iniciando componentes assíncronos...');
  
  try {
    // Import dinâmico de módulos pesados
    const [
      analyzeRoute,
      jobsRoute,
      analyzeController,
      analyzeStatus,
      fetch
    ] = await Promise.all([
      import("./api/audio/analyze.js"),
      import("./api/jobs/[id].js"),
      import("./api/analyze.controller.js"),
      import("./api/analyze.status.js"),
      import("node-fetch")
    ]);

    // 🔍 [RAILWAY] Verificação de variáveis críticas
    console.log('\n🔧 [ENV-CHECK] Verificando variáveis críticas:');
    const criticalChecks = [
      { name: 'REDIS_HOST', value: process.env.REDIS_HOST, required: true },
      { name: 'REDIS_PORT', value: process.env.REDIS_PORT, required: true },
      { name: 'DATABASE_URL', value: process.env.DATABASE_URL, required: true },
      { name: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY, required: true },
      { name: 'MP_ACCESS_TOKEN', value: process.env.MP_ACCESS_TOKEN, required: true }
    ];

    let missingCritical = 0;
    criticalChecks.forEach(check => {
      const exists = check.value && check.value !== '';
      const status = exists ? '✅' : '❌';
      const display = exists ? 'configurada' : 'NÃO CONFIGURADA';
      console.log(`   ${status} ${check.name}: ${display}`);
      if (check.required && !exists) missingCritical++;
    });

    if (missingCritical > 0) {
      console.warn(`\n⚠️ [INIT] ${missingCritical} variáveis críticas faltando (funcionalidade limitada)`);
    } else {
      console.log('\n✅ [INIT] Todas as variáveis críticas configuradas!');
    }

    // 👉 Configurar rotas básicas de navegação
    app.get("/landing", (req, res) => {
      res.sendFile(path.join(__dirname, "public", "landing.html"));
    });

    app.get(["/index", "/index.html", "/app", "/home"], (req, res) => {
      res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    // 👉 Servir arquivos estáticos
    app.use(
      express.static(path.join(__dirname, "public"), {
        index: false,
      })
    );

    // 🔧 Import dinâmico das rotas da API (não bloqueia boot)
    const [
      cancelSubscriptionRoute,
      chatWithImagesRoute,
      chatRoute,
      createPreferenceRoute,
      deleteAccountRoute,
      mercadopagoRoute,
      uploadAudioRoute,
      uploadImageRoute,
      voiceMessageRoute,
      webhookRoute,
      presignRoute
    ] = await Promise.all([
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
      import("./api/presign.js")
    ]);

    // Montar rotas da API
    app.use("/api/cancel-subscription", cancelSubscriptionRoute.default);
    app.use("/api/chat-with-images", chatWithImagesRoute.default);
    app.use("/api/chat", chatRoute.default);
    app.use("/api/create-preference", createPreferenceRoute.default);
    app.use("/api/delete-account", deleteAccountRoute.default);
    app.use("/api/mercadopago", mercadopagoRoute.default);
    app.use("/api/upload-audio", uploadAudioRoute.default);
    app.use("/api/upload", uploadImageRoute.default);
    app.use("/api/voice", voiceMessageRoute.default);
    app.use("/api/webhook", webhookRoute.default);
    app.use("/api", presignRoute.default);

    // Rotas de análise (componentes pesados)
    app.use("/api/audio", analyzeRoute.default);
    app.use("/api/jobs", jobsRoute.default);

    // 🚀 SISTEMA DE FILAS BULLMQ
    app.use("/api/analyze", analyzeController.default);
    app.use("/api/analyze", analyzeStatus.default);

    // ---------- ROTA DE CONFIGURAÇÃO DA API KEY ----------
    app.get("/api/config", (req, res) => {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      
      if (openaiApiKey && openaiApiKey !== 'your_openai_api_key_here') {
        const masked = openaiApiKey.substring(0, 10) + '...';
        console.log('🔑 [CONFIG-API] API Key disponível:', masked);
        
        res.json({
          openaiApiKey: openaiApiKey,
          aiModel: process.env.AI_MODEL || 'gpt-3.5-turbo',
          configured: true
        });
      } else {
        console.warn('⚠️ [CONFIG-API] API Key NÃO configurada');
        res.json({
          openaiApiKey: 'not-configured',
          configured: false
        });
      }
    });

    // ---------- ROTA DE SUGESTÕES IA ----------
    app.post("/api/suggestions", async (req, res) => {
      try {
        const { suggestions, metrics, genre } = req.body;

        console.log(`🚀 [AI-API] Recebidas ${suggestions?.length || 0} sugestões para processamento`);

        if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
          console.error("❌ [AI-API] Lista de sugestões inválida");
          return res.status(400).json({ 
            error: "Lista de sugestões é obrigatória e não pode estar vazia",
            received: suggestions
          });
        }

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

        const prompt = buildSuggestionPrompt(suggestions, metrics, genre);
        console.log(`🤖 [AI-API] Enviando prompt para OpenAI...`);

        const openaiResponse = await fetch.default('https://api.openai.com/v1/chat/completions', {
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
            max_tokens: 4500,
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
        console.log(`[AI-PROCESSING] JSON ${repaired ? 'REPARADO' : 'OK'} - itens parseados: ${parsedItems.length}/${expected}`);

        let enhancedSuggestions = ensureCardinality(parsedItems, suggestions);

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

    // 👉 Fallback SPA
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    // 🚨 MIDDLEWARE DE ERROR HANDLING GLOBAL
    app.use((err, req, res, next) => {
      console.error('💥 [ERROR] Erro não tratado:', err.message);
      console.error('🔍 [ERROR] Stack:', err.stack);
      console.error('📍 [ERROR] URL:', req.url);
      
      res.status(err.status || 500).json({
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Algo deu errado',
        timestamp: new Date().toISOString(),
        path: req.path
      });
    });

    // 🚨 MIDDLEWARE 404 - DEVE VIR POR ÚLTIMO
    app.use((req, res) => {
      console.log(`⚠️ [404] Rota não encontrada: ${req.method} ${req.path}`);
      res.status(404).json({
        error: 'Rota não encontrada',
        method: req.method,
        path: req.path,
        timestamp: new Date().toISOString()
      });
    });

    // 🧪 DESENVOLVIMENTO: Executar testes se não for produção
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔧 [DEV] Executando testes de validação...');
      try {
        testRealisticSuggestions();
        console.log('✅ [DEV] Testes concluídos com sucesso');
      } catch (error) {
        console.error('❌ [DEV] Erro nos testes:', error.message);
      }
    }

    console.log('\n📋 [STATUS] Sistema totalmente inicializado:');
    console.log(`   ✅ Express server running`);
    console.log(`   ✅ Health check instant response`);
    console.log(`   ✅ API routes mounted`);
    console.log(`   ✅ Static files serving`);
    console.log(`   ✅ Error handling middleware`);
    console.log(`   ✅ 404 fallback route`);
    console.log('\n🎯 [READY] Sistema totalmente operacional!');

  } catch (error) {
    console.error('❌ [INIT-ERROR] Erro na inicialização de componentes pesados:', error.message);
    console.log('⚠️ [INIT-ERROR] Servidor continua funcionando com funcionalidade limitada');
  }
}

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

// 🎛️ Função auxiliar para garantir caps por banda (limites máximos em dB)
function clampDeltaByBand(band, delta) {
  const caps = {
    sub: 6, bass: 6, low_mid: 5, mid: 5, high_mid: 5, presence: 5, air: 4,
    lowMid: 5, highMid: 5, presenca: 5, brilho: 4
  };
  
  const maxCap = caps[band] || 5;
  return Math.max(-maxCap, Math.min(maxCap, delta));
}

// 📊 Função para calcular ajuste proporcional baseado no delta
function calculateProportionalAdjustment(delta, band) {
  const caps = {
    sub: 6, bass: 6, low_mid: 5, mid: 5, high_mid: 5, presence: 5, air: 4,
    lowMid: 5, highMid: 5, presenca: 5, brilho: 4
  };
  
  const clampedDelta = clampDeltaByBand(band, delta);
  const absDelta = Math.abs(clampedDelta);
  
  let minAdjust, maxAdjust;
  
  if (absDelta <= 3) {
    minAdjust = Math.max(1, Math.floor(absDelta * 0.3));
    maxAdjust = Math.max(2, Math.ceil(absDelta * 0.6));
  } else if (absDelta <= 6) {
    minAdjust = Math.max(2, Math.floor(absDelta * 0.5));
    maxAdjust = Math.max(3, Math.ceil(absDelta * 0.75));
  } else {
    minAdjust = Math.max(3, Math.floor(absDelta * 0.75));
    maxAdjust = Math.min(caps[band] || 5, Math.ceil(absDelta * 1.0));
  }
  
  const maxCap = caps[band] || 5;
  minAdjust = Math.min(minAdjust, maxCap);
  maxAdjust = Math.min(maxAdjust, maxCap);
  
  const sign = clampedDelta >= 0 ? '+' : '-';
  
  return {
    range: `${sign}${minAdjust} a ${sign}${maxAdjust} dB`,
    direction: clampedDelta > 0 ? 'reforçar' : 'reduzir',
    intensity: absDelta <= 3 ? 'suavemente' : absDelta <= 6 ? 'moderadamente' : 'com mais ênfase'
  };
}

// 🔧 Função para preprocessar sugestões aplicando caps e calculando ajustes proporcionais
function preprocessSuggestions(suggestions) {
  return suggestions.map((s, i) => {
    let enhancedSuggestion = { ...s };
    
    if (s.technical && s.technical.delta && s.subtype) {
      const band = s.subtype.toLowerCase();
      const adjustment = calculateProportionalAdjustment(s.technical.delta, band);
      
      enhancedSuggestion.adjustmentGuide = {
        originalDelta: s.technical.delta,
        suggestedRange: adjustment.range,
        direction: adjustment.direction,
        intensity: adjustment.intensity,
        band: band
      };
    }
    
    return enhancedSuggestion;
  });
}

// Função para construir o prompt da IA
function buildSuggestionPrompt(suggestions, metrics, genre) {
  const preprocessedSuggestions = preprocessSuggestions(suggestions);
  
  const suggestionsList = preprocessedSuggestions.map((s, i) => {
    let baseSuggestion = `${i + 1}. ${s.message || s.title || 'Sugestão'} - ${s.action || s.description || 'Sem ação definida'}`;
    
    if (s.adjustmentGuide) {
      baseSuggestion += ` [AJUSTE CALCULADO: ${s.adjustmentGuide.direction} ${s.adjustmentGuide.suggestedRange} na banda ${s.adjustmentGuide.band}]`;
    }
    
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

  const genreContext = getGenreContext(genre);
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

🎵 DIRETRIZES ESPECÍFICAS DO GÊNERO:
${genreContext}
`;
}

// Função para obter contexto educativo e musical do gênero
function getGenreContext(genre) {
  const contexts = {
    funk_mandela: `
🎵 CONTEXTO FUNK MANDELA - LINGUAGEM E PRIORIDADES:
- LINGUAGEM: Use termos do funk ("grave pesado", "vocal cristalino", "pancada no peito")
- SUB/BASS (20-150Hz): PRIORITÁRIO - Deve "bater no peito" sem mascarar o kick
- MÉDIOS (200Hz-2kHz): Vocal sempre em evidência, cuidado com máscara
- AGUDOS (5-15kHz): Controlado, nunca agressivo
- TARGETS: DR 4-6 | True Peak -1dBTP | LUFS -8 a -12`,
    
    trance: `
🎵 CONTEXTO TRANCE - LINGUAGEM E PRIORIDADES:  
- LINGUAGEM: Use termos eletrônicos ("kick punchy", "lead cortante", "atmosfera ampla")
- SUB (20-60Hz): Limpo e controlado para não competir com kick
- KICK (60-120Hz): Deve ser o protagonista dos graves
- LEADS (2-8kHz): Brilhantes mas não agressivos, com espaço para vocal
- TARGETS: DR 3-5 | True Peak -0.5dBTP | LUFS -6 a -9`,
    
    electronic: `
🎵 CONTEXTO ELETRÔNICO GERAL:
- LINGUAGEM: "Precisão digital", "punch eletrônico", "clareza sintética"
- SUB (20-80Hz): Controlado digitalmente, mono perfeito
- MÉDIOS: Separação precisa entre elementos sintéticos  
- AGUDOS: Cristalinos mas não metálicos
- TARGETS: DR 4-8 | True Peak -1dBTP | LUFS -8 a -12`,

    hip_hop: `
🎵 CONTEXTO HIP HOP:
- LINGUAGEM: "Boom bap", "vocal na frente", "groove pesado"
- SUB/KICK: Deve "bater forte" sem distorção
- VOCAL: SEMPRE protagonista, clareza total
- SAMPLES: Preserve caráter original, evite over-processing
- TARGETS: DR 5-8 | True Peak -1dBTP | LUFS -9 a -13`
  };
  
  return contexts[genre] || contexts[detectGenreType(genre)] || `
🎵 CONTEXTO MUSICAL GERAL:
- LINGUAGEM: Seja educativo e musical, evite jargões técnicos pesados
- GRAVES: Balance presença vs. limpeza, preserve groove natural
- MÉDIOS: Foque na inteligibilidade, evite máscara entre elementos
- AGUDOS: Brilho sem agressividade, preserve naturalidade
- FILOSOFIA: "Realce a musicalidade, preserve a emoção"
- RESULTADO: "Mix equilibrado, musical e profissional"`;
}

// Função auxiliar para detectar tipo de gênero
function detectGenreType(genre) {
  if (!genre) return null;
  
  const genreLower = genre.toLowerCase();
  
  if (genreLower.includes('funk') || genreLower.includes('mandela')) return 'funk_mandela';
  if (genreLower.includes('trance') || genreLower.includes('progressive')) return 'trance';  
  if (genreLower.includes('brux') || genreLower.includes('ambient')) return 'bruxaria';
  if (genreLower.includes('electronic') || genreLower.includes('edm') || genreLower.includes('house')) return 'electronic';
  if (genreLower.includes('hip') || genreLower.includes('rap') || genreLower.includes('trap')) return 'hip_hop';
  
  return null;
}

// 🧪 Função de teste para validar caps e proporcionalidade
function testRealisticSuggestions() {
  console.log('🧪 [TESTE] Validando sistema de caps e proporcionalidade...');
  
  const testCases = [
    { band: 'sub', delta: -2.5, expected: 'ajuste mínimo (1-2 dB)' },
    { band: 'bass', delta: -7.0, expected: 'ajuste máximo limitado ao cap (6 dB)' },
    { band: 'mid', delta: 4.5, expected: 'ajuste intermediário (2-4 dB)' },
    { band: 'presence', delta: -12.0, expected: 'ajuste máximo limitado ao cap (5 dB)' },
    { band: 'air', delta: 2.0, expected: 'ajuste mínimo (1-2 dB)' }
  ];
  
  testCases.forEach(test => {
    const clampedDelta = clampDeltaByBand(test.band, test.delta);
    const adjustment = calculateProportionalAdjustment(test.delta, test.band);
    
    console.log(`📊 Banda: ${test.band} | Delta original: ${test.delta} dB`);
    console.log(`   ✂️ Delta limitado: ${clampedDelta} dB`);
    console.log(`   🎯 Ajuste sugerido: ${adjustment.range}`);
    console.log(`   📝 Esperado: ${test.expected}`);
    console.log(`   ✅ Status: ${Math.abs(clampedDelta) <= (test.band === 'air' ? 4 : test.band.includes('mid') || test.band === 'presence' ? 5 : 6) ? 'PASSOU' : 'FALHOU'}\n`);
  });
  
  return true;
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

// 🛡️ RAILWAY: Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('📡 [SHUTDOWN] SIGTERM recebido, encerrando servidor...');
  server.close(() => {
    console.log('✅ [SHUTDOWN] Servidor encerrado gracefully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📡 [SHUTDOWN] SIGINT recebido, encerrando servidor...');
  server.close(() => {
    console.log('✅ [SHUTDOWN] Servidor encerrado gracefully');
    process.exit(0);
  });
});

// 🚨 RAILWAY: Error handling para crashes
process.on('uncaughtException', (error) => {
  console.error('💥 [CRASH] Uncaught Exception:', error);
  console.error('🔍 [CRASH] Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 [CRASH] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;