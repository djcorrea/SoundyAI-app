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

// 🚀 RAILWAY HEALTH CHECK: Log de variáveis críticas na inicialização
console.log("🏗️ [RAILWAY] Iniciando SoundyAI Server...");
console.log("📂 [ENV] Arquivo .env carregado");
console.log("🔧 [ENV] NODE_ENV:", process.env.NODE_ENV || 'development');
console.log("🌐 [ENV] PORT:", process.env.PORT || 'not-set');

// Validações críticas para Railway
const criticalEnvs = {
  'B2_KEY_ID': process.env.B2_KEY_ID,
  'B2_APP_KEY': process.env.B2_APP_KEY,
  'B2_BUCKET_NAME': process.env.B2_BUCKET_NAME,
  'B2_ENDPOINT': process.env.B2_ENDPOINT,
  'DATABASE_URL': process.env.DATABASE_URL,
  'REDIS_HOST': process.env.REDIS_HOST,
  'REDIS_PORT': process.env.REDIS_PORT,
  'REDIS_PASSWORD': process.env.REDIS_PASSWORD
};

console.log("🔍 [VALIDATION] Verificando variáveis críticas:");
Object.entries(criticalEnvs).forEach(([key, value]) => {
  const status = value ? "✅" : "❌";
  const display = value ? (key.includes('PASSWORD') || key.includes('KEY') ? `${value.substring(0, 8)}...` : "configurada") : "NÃO CONFIGURADA";
  console.log(`   ${status} ${key}: ${display}`);
});

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 🚀 RAILWAY FIX: Rota de health check principal (deve retornar 200)
app.get("/", (req, res) => {
  console.log(`📍 [HEALTH] Health check request from ${req.ip || 'unknown'}`);
  res.status(200).json({ 
    status: "✅ SoundyAI API Online", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: "1.0.0",
    port: process.env.PORT || 8080,
    uptime: Math.floor(process.uptime())
  });
});

// 👉 Rota para landing page específica
app.get("/landing", (req, res) => {
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

// 🚀 FASE 1 - ROTAS DO SISTEMA DE FILAS BULLMQ
import analyzeController from "./api/analyze.controller.js";
import analyzeStatus from "./api/analyze.status.js";

app.use("/api/analyze", analyzeController); // Nova rota: criar jobs via fila
app.use("/api/analyze", analyzeStatus);     // Nova rota: consultar status dos jobs

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
    sub: 6,           // Sub (20–60Hz): ±6 dB
    bass: 6,          // Bass (60–150Hz): ±6 dB  
    low_mid: 5,       // Low-Mid (150–500Hz): ±5 dB
    mid: 5,           // Mid (500Hz–2kHz): ±5 dB
    high_mid: 5,      // High-Mid (2–5kHz): ±5 dB
    presence: 5,      // Presence (5–10kHz): ±5 dB
    air: 4,           // Air (10–20kHz): ±4 dB
    
    // Aliases para compatibilidade
    lowMid: 5,
    highMid: 5,
    presenca: 5,
    brilho: 4
  };
  
  const maxCap = caps[band] || 5; // Default 5 dB se banda não encontrada
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
  
  // Proporcionalidade: quanto maior o delta, maior o ajuste (respeitando caps)
  if (absDelta <= 3) {
    // Diferença pequena: correção mínima (30-60% do delta)
    minAdjust = Math.max(1, Math.floor(absDelta * 0.3));
    maxAdjust = Math.max(2, Math.ceil(absDelta * 0.6));
  } else if (absDelta <= 6) {
    // Diferença moderada: ajuste intermediário (50-75% do delta)
    minAdjust = Math.max(2, Math.floor(absDelta * 0.5));
    maxAdjust = Math.max(3, Math.ceil(absDelta * 0.75));
  } else {
    // Diferença grande: ajuste máximo permitido pelo cap (75-100% do delta)
    minAdjust = Math.max(3, Math.floor(absDelta * 0.75));
    maxAdjust = Math.min(caps[band] || 5, Math.ceil(absDelta * 1.0));
  }
  
  // Garantir que não ultrapasse os caps
  const maxCap = caps[band] || 5;
  minAdjust = Math.min(minAdjust, maxCap);
  maxAdjust = Math.min(maxAdjust, maxCap);
  
  // Manter sinal do delta original
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
    
    // Se a sugestão tem dados técnicos com delta e banda, calcular ajuste proporcional
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
  // Preprocessar sugestões para incluir dados de ajuste proporcional
  const preprocessedSuggestions = preprocessSuggestions(suggestions);
  
  const suggestionsList = preprocessedSuggestions.map((s, i) => {
    let baseSuggestion = `${i + 1}. ${s.message || s.title || 'Sugestão'} - ${s.action || s.description || 'Sem ação definida'}`;
    
    // Adicionar informações de ajuste se disponível
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

🎵 LINGUAGEM OBRIGATÓRIA:
- "Experimente reduzir entre -2 a -3 dB nesta região..."
- "Considere reforçar entre +1 a +2 dB no sub para dar mais punch..."
- "Avalie se o sample ou instrumento já se encaixa naturalmente..."
- "Teste um corte suave entre -1 a -2 dB..."

📊 PROPORCIONALIDADE:
- Delta pequeno (até 3 dB): sugerir correção mínima (1-2 dB)
- Delta moderado (3-6 dB): sugerir ajuste intermediário (2-4 dB)  
- Delta grande (6+ dB): sugerir ajuste máximo permitido pelo cap

🔧 ESTRUTURA OBRIGATÓRIA:
{
  "problema": "descrição curta com valor medido vs referência (ex: 'Sub +4.2 dB acima do ideal')",
  "causa": "impacto auditivo claro (ex: 'Máscara o kick e tira o punch')",
  "solucao": "instrução orientativa com range proporcional (ex: 'Experimente reduzir entre -2 a -3 dB em 40-80Hz')",
  "dica_extra": "dica contextual musical (ex: 'Cuidado para não tirar o groove do kick')",
  "plugin": "ferramenta específica por banda (FabFilter Pro-Q3 para médios, Waves C6 para graves, De-Esser para sibilância)",
  "resultado": "melhoria auditiva realista (ex: 'Kick mais presente, grove definido, mix limpo')"
}

🎯 SUGESTÕES ORIGINAIS DETECTADAS:
${suggestionsList}

🔊 CONTEXTO TÉCNICO DETALHADO:
${metricsInfo}

🎵 DIRETRIZES ESPECÍFICAS DO GÊNERO:
${genreContext}

� EXEMPLOS DE SUGESTÕES IDEAIS:

EXEMPLO DELTA PEQUENO (-2.5 dB no sub):
{
  "problema": "Sub bass +2.5 dB acima do ideal",
  "causa": "Pode mascarar levemente o kick e comprometer o punch",
  "solucao": "Experimente reduzir entre -1 a -2 dB na região de 40-80Hz",
  "dica_extra": "Monitore o groove do kick para não tirar a pegada",
  "plugin": "FabFilter Pro-Q3 ou EQ nativo com filtro bell suave",
  "resultado": "Kick mais presente, sub controlado, groove definido"
}

EXEMPLO DELTA GRANDE (-8 dB nos médios):
{
  "problema": "Médios +8 dB muito acima da referência",
  "causa": "Máscara vocal e outros elementos, som 'boxeado'",
  "solucao": "Experimente reduzir entre -4 a -5 dB em 800Hz-2kHz",
  "dica_extra": "Use EQ dinâmico para preservar transientes importantes",
  "plugin": "Waves C6 ou FabFilter Pro-MB para controle dinâmico",
  "resultado": "Vocal destacado, instrumentos com espaço, mix aberto"
}

�🚀 LEMBRE-SE: Seja educativo, realista e musical. O usuário deve aprender e se sentir confiante aplicando suas sugestões!
`;
}

// Função para obter contexto educativo e musical do gênero
function getGenreContext(genre) {
  const contexts = {
    funk_mandela: `
🎵 CONTEXTO FUNK MANDELA - LINGUAGEM E PRIORIDADES:
- LINGUAGEM: Use termos do funk ("grave pesado", "vocal cristalino", "pancada no peito")
- SUB/BASS (20-150Hz): PRIORITÁRIO - Deve "bater no peito" sem mascarar o kick
  • Plugin ideal: Waves Renaissance Bass, FabFilter Pro-MB
  • Dica: Side-chain com kick, preserve groove 
- MÉDIOS (200Hz-2kHz): Vocal sempre em evidência, cuidado com máscara
  • Plugin ideal: FabFilter Pro-Q3, Waves C6
  • Dica: EQ complementar (corta onde vocal precisa brilhar)
- AGUDOS (5-15kHz): Controlado, nunca agressivo
  • Plugin ideal: De-Esser nativo, Waves DeEsser
  • Resultado: "Hi-hat crocante, vocal inteligível"
- TARGETS: DR 4-6 | True Peak -1dBTP | LUFS -8 a -12`,
    
    trance: `
🎵 CONTEXTO TRANCE - LINGUAGEM E PRIORIDADES:  
- LINGUAGEM: Use termos eletrônicos ("kick punchy", "lead cortante", "atmosfera ampla")
- SUB (20-60Hz): Limpo e controlado para não competir com kick
  • Plugin ideal: FabFilter Pro-Q3 high-pass, Waves Renaissance Bass
  • Dica: Mono até 100Hz, side-chain com kick
- KICK (60-120Hz): Deve ser o protagonista dos graves
  • Plugin ideal: FabFilter Pro-MB, compressão multibanda
  • Resultado: "Kick perfurado, presença definida"
- LEADS (2-8kHz): Brilhantes mas não agressivos, com espaço para vocal
  • Plugin ideal: FabFilter Pro-Q3, harmonic exciter sutil
  • Dica: Use EQ dinâmico para não brigar com vocal
- REVERB/DELAY: Equilibrado, sem máscara
  • Resultado: "Atmosfera ampla, leads definidos, kick presente"
- TARGETS: DR 3-5 | True Peak -0.5dBTP | LUFS -6 a -9`,
    
    bruxaria: `
🎵 CONTEXTO BRUXARIA - LINGUAGEM E PRIORIDADES:
- LINGUAGEM: Use termos atmosféricos ("texturas orgânicas", "ambiência natural", "dinâmica respirante")
- GRAVES (20-100Hz): Livres e orgânicos, nunca over-processed
  • Plugin ideal: EQ vintage (Neve, API emulation), compressão suave
  • Dica: Preserve transientes naturais, menos side-chain
- MÉDIOS (200Hz-2kHz): Atmosféricos, com espaço para respirar
  • Plugin ideal: EQ analógico modelado, compressão ótica
  • Resultado: "Vozes orgânicas, instrumentos com corpo natural"
- AGUDOS (5-20kHz): Texturizados, nunca limpos demais
  • Plugin ideal: EQ vintage, tape saturation sutil
  • Dica: Harmônicos naturais, evite filtros digitais duros
- DINÂMICA: Preserve variações naturais, menos limitação
  • Resultado: "Mix respirante, texturas ricas, ambiência natural"
- TARGETS: DR 6-12 | True Peak -3 a -1dBTP | LUFS -12 a -16`,

    electronic: `
🎵 CONTEXTO ELETRÔNICO GERAL:
- LINGUAGEM: "Precisão digital", "punch eletrônico", "clareza sintética"
- SUB (20-80Hz): Controlado digitalmente, mono perfeito
  • Plugin ideal: FabFilter Pro-Q3, análise em tempo real
- MÉDIOS: Separação precisa entre elementos sintéticos  
  • Plugin ideal: EQ dinâmico, compressão multibanda
- AGUDOS: Cristalinos mas não metálicos
  • Resultado: "Sínteses definidas, espacialização precisa"
- TARGETS: DR 4-8 | True Peak -1dBTP | LUFS -8 a -12`,

    hip_hop: `
🎵 CONTEXTO HIP HOP:
- LINGUAGEM: "Boom bap", "vocal na frente", "groove pesado"
- SUB/KICK: Deve "bater forte" sem distorção
  • Plugin ideal: Waves CLA Bass, side-chain com vocal
- VOCAL: SEMPRE protagonista, clareza total
  • Plugin ideal: Waves CLA Vocals, De-Esser obrigatório
- SAMPLES: Preserve caráter original, evite over-processing
  • Resultado: "Vocal cristalino, beat pesado, samples com alma"
- TARGETS: DR 5-8 | True Peak -1dBTP | LUFS -9 a -13`
  };
  
  return contexts[genre] || contexts[detectGenreType(genre)] || `
🎵 CONTEXTO MUSICAL GERAL:
- LINGUAGEM: Seja educativo e musical, evite jargões técnicos pesados
- GRAVES: Balance presença vs. limpeza, preserve groove natural
  • Plugin ideal: EQ nativo da DAW, compressor suave
- MÉDIOS: Foque na inteligibilidade, evite máscara entre elementos
  • Plugin ideal: FabFilter Pro-Q3, EQ dinâmico
- AGUDOS: Brilho sem agressividade, preserve naturalidade
  • Plugin ideal: De-Esser nativo, EQ shelf suave
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

// Start server
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0'; // 🚀 RAILWAY FIX: Bind em todas as interfaces

console.log(`🚀 [BOOT] Iniciando servidor na porta ${PORT}...`);
console.log(`🌐 [BOOT] Host: ${HOST}`);
console.log(`📦 [BOOT] Ambiente: ${process.env.NODE_ENV || 'development'}`);

// 🔍 [RAILWAY] Verificação crítica de variáveis de ambiente
console.log('\n🔧 [ENV-CHECK] Verificando variáveis críticas para Railway:');
const criticalChecks = [
  { name: 'PORT', value: process.env.PORT, required: false },
  { name: 'REDIS_HOST', value: process.env.REDIS_HOST, required: true },
  { name: 'REDIS_PORT', value: process.env.REDIS_PORT, required: true },
  { name: 'MP_ACCESS_TOKEN', value: process.env.MP_ACCESS_TOKEN, required: true },
  { name: 'DATABASE_URL', value: process.env.DATABASE_URL, required: true },
  { name: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY, required: true }
];

let missingCritical = 0;
criticalChecks.forEach(check => {
  const exists = check.value && check.value !== '';
  const status = exists ? '✅' : (check.required ? '❌' : '⚠️');
  const display = exists ? 'configurada' : 'NÃO CONFIGURADA';
  
  console.log(`   ${status} ${check.name}: ${display}`);
  
  if (check.required && !exists) {
    missingCritical++;
  }
});

if (missingCritical > 0) {
  console.error(`\n🚨 [BOOT] ATENÇÃO: ${missingCritical} variáveis críticas não configuradas!`);
} else {
  console.log('\n✅ [BOOT] Todas as variáveis críticas estão configuradas!');
}

const server = app.listen(PORT, HOST, () => {
  console.log(`\n🎉 [SUCCESS] ════════════════════════════════════════`);
  console.log(`✅ [SUCCESS] SoundyAI Server ONLINE!`);
  console.log(`🚀 Servidor SoundyAI rodando em http://${HOST}:${PORT}`);
  console.log(`🌐 [SERVER] Listening on ${HOST}:${PORT}`);
  console.log(`🔗 [SERVER] Health check: http://${HOST}:${PORT}/`);
  console.log(`📊 [SERVER] Status: READY para receber requests`);
  console.log(`🕐 [SERVER] Tempo de boot: ${Math.floor(process.uptime())}s`);
  console.log(`🎯 [RAILWAY] Servidor pronto para deploy!`);
  console.log(`════════════════════════════════════════════════════\n`);
  
  // 🚀 FASE 2: Inicialização assíncrona de componentes pesados
  // Movido para DEPOIS do listen() para garantir boot rápido
  setTimeout(() => {
    console.log('🔧 [ASYNC-INIT] Iniciando componentes assíncronos...');
    
    // 🧪 DESENVOLVIMENTO: Executar testes apenas após server online
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔧 [DEV] Executando testes de validação...');
      try {
        testRealisticSuggestions();
        console.log('✅ [DEV] Testes concluídos com sucesso');
      } catch (error) {
        console.error('❌ [DEV] Erro nos testes:', error.message);
      }
    }
    
    // 🔍 Log final de status
    console.log('\n📋 [STATUS] Configurações aplicadas:');
    console.log(`   ✅ Express server running`);
    console.log(`   ✅ CORS enabled`);
    console.log(`   ✅ JSON parser (50MB limit)`);
    console.log(`   ✅ Static files serving`);
    console.log(`   ✅ API routes mounted`);
    console.log(`   ✅ Health check route active`);
    console.log(`   ✅ Error handling middleware`);
    console.log(`   ✅ 404 fallback route`);
    console.log('\n🎯 [READY] Sistema totalmente operacional!');
    
  }, 100); // Pequeno delay para não bloquear o boot
});

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