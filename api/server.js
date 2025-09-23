import express from "express";
import pkg from "pg";
import multer from "multer";
import AWS from "aws-sdk";
import cors from "cors";
import fetch from "node-fetch";

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para JSON
app.use(express.json({ limit: '10mb' }));

// ---------- CORS restrito ----------
app.use(
  cors({
    origin: [
      "https://soundyai-app-production.up.railway.app", // domínio principal (sem barra no final)
      "http://localhost:3000", // útil para testes locais
    ],
  })
);

// ---------- Conexão com Postgres ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Railway/Postgres
});

// ---------- Configuração Backblaze ----------
const s3 = new AWS.S3({
  endpoint: "https://s3.us-east-005.backblazeb2.com",
  region: "us-east-005",
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
  signatureVersion: "v4",
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME;

// ---------- Middleware para upload ----------
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "audio/mpeg",   // mp3
    "audio/wav",    // wav
    "audio/x-wav",  // outra variação wav
    "audio/wave",   // outra variação wav
    "audio/x-m4a",  // m4a
    "audio/mp4",    // m4a/mp4
  ];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new Error("Tipo de arquivo não permitido. Envie apenas mp3, wav ou m4a."),
      false
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 120 * 1024 * 1024 }, // 120 MB
  fileFilter,
});

// ---------- Rota para sugestões com IA ----------
app.post("/api/suggestions", async (req, res) => {
  try {
    // ✅ NOVO FORMATO: Suporte para enriquecimento de sugestões
    const { action, originalSuggestions, context, suggestions, metrics, genre } = req.body;

    // Determinar formato (novo ou legado)
    const isEnrichmentMode = action === 'enrich_suggestions';
    const suggestionsToProcess = isEnrichmentMode ? originalSuggestions : suggestions;
    const processingMetrics = isEnrichmentMode ? context?.audioMetrics : metrics;
    const processingGenre = isEnrichmentMode ? context?.genre : genre;

    // Validação dos dados de entrada
    if (!suggestionsToProcess || !Array.isArray(suggestionsToProcess)) {
      return res.status(400).json({ 
        error: "Lista de sugestões é obrigatória",
        fallbackSuggestions: suggestionsToProcess || []
      });
    }

    console.log(`🎵 [SUGGESTIONS-API] Modo: ${isEnrichmentMode ? 'ENRIQUECIMENTO' : 'LEGADO'}`);
    console.log(`📊 [SUGGESTIONS-API] Processando ${suggestionsToProcess.length} sugestões para ${processingGenre}`);

    // Log das primeiras sugestões para debug
    if (suggestionsToProcess.length > 0) {
      console.log("🔍 [DEBUG] Primeira sugestão:", JSON.stringify(suggestionsToProcess[0], null, 2));
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

    // Construir prompt contextual
    const basePrompt = buildSuggestionPrompt(suggestionsToProcess, processingMetrics, processingGenre);
    
    // ✅ NOVO: Prompt específico para enriquecimento educativo
    const enrichmentPrompt = isEnrichmentMode ? `
MODO ENRIQUECIMENTO EDUCATIVO

SUGESTÕES ORIGINAIS PARA ENRIQUECER:
${JSON.stringify(suggestionsToProcess, null, 2)}

INSTRUÇÕES ESPECÍFICAS:
1. Preserve EXATAMENTE a estrutura de cada sugestão (category, issue, solution, severity, etc.)
2. Enriqueça o campo 'solution' com explicações educativas detalhadas
3. Adicione o campo 'educationalContext' explicando o conceito técnico por trás
4. Adicione o campo 'learningTips' com dicas práticas para evitar o problema
5. Mantenha a severidade e categoria originais
6. Use linguagem clara e educativa, mas tecnicamente precisa

CONTEXTO DO ÁUDIO:
${basePrompt}

Retorne um JSON com exatamente a mesma quantidade de sugestões, mas enriquecidas educacionalmente com os novos campos.
` : basePrompt;

    const finalPrompt = isEnrichmentMode ? enrichmentPrompt : basePrompt;

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
            content: finalPrompt
          }
        ],
        temperature: parseFloat(process.env.AI_TEMPERATURE || '0.3'), // Mais focado
        max_tokens: parseInt(process.env.AI_MAX_TOKENS || '2000'),    // Mais detalhado
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

    // Processar resposta da IA
    const processedSuggestions = isEnrichmentMode 
      ? processEnrichedResponse(suggestionsToProcess, aiSuggestion)
      : processAIResponse(suggestionsToProcess, aiSuggestion);

    console.log(`✅ [SUGGESTIONS-API] Processamento concluído: ${processedSuggestions.length} sugestões`);

    // ✅ NOVO: Resposta adequada ao formato
    const responseData = isEnrichmentMode ? {
      success: true,
      enrichedSuggestions: processedSuggestions,
      source: 'ai_enriched',
      message: `Sugestões enriquecidas educacionalmente`,
      metadata: {
        originalCount: suggestionsToProcess.length,
        enhancedCount: processedSuggestions.length,
        genre: processingGenre || 'não especificado',
        processingTime: Date.now(),
        mode: 'enrichment'
      }
    } : {
      success: true,
      enhancedSuggestions: processedSuggestions,
      source: 'ai',
      message: 'Sugestões enriquecidas com IA',
      metadata: {
        originalCount: suggestionsToProcess.length,
        enhancedCount: processedSuggestions.length,
        genre: processingGenre || 'não especificado',
        processingTime: Date.now(),
        mode: 'legacy'
      }
    };

    res.json(responseData);

  } catch (error) {
    console.error("❌ Erro no endpoint de sugestões:", error.message);
    
    // Sempre retornar fallback em caso de erro
    const { action, originalSuggestions, suggestions } = req.body;
    const fallbackSuggestions = originalSuggestions || suggestions || [];
    
    res.json({
      success: true,
      enhancedSuggestions: fallbackSuggestions,
      source: 'fallback',
      message: 'Usando sugestões básicas devido a erro na IA',
      error: error.message,
      mode: action === 'enrich_suggestions' ? 'enrichment_fallback' : 'legacy_fallback'
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

🎯 INSTRUÇÕES ULTRA-ESPECÍFICAS:

1. Para CADA sugestão, identifique o problema REAL psicoacústico
2. Explique a CAUSA técnica profunda (masking, phase, resonance, etc.)
3. Dê solução PRECISA com valores de EQ, compressão, etc.
4. Adicione dica PROFISSIONAL que poucos conhecem

📊 ESTRUTURA JSON OBRIGATÓRIA:
{
  "suggestions": [
    {
      "id": 1,
      "problem": "⚠️ [TÉCNICO] Descrição precisa do problema psicoacústico",
      "cause": "🎯 Causa física/técnica específica (Hz, dB, ms, fase, etc.)",
      "solution": "🛠️ Solução EXATA: EQ 3.2kHz -2.8dB Q=1.4, Compressor 4:1 @ 30ms",
      "tip": "💡 Segredo profissional ou conceito avançado",
      "priority": "crítica|alta|média|baixa",
      "difficulty": "profissional|avançado|intermediário|básico",
      "frequency_range": "20-60Hz|60-200Hz|200-500Hz|500-2kHz|2-5kHz|5-10kHz|10-20kHz",
      "processing_type": "eq|compression|stereo|dynamics|harmonic|temporal"
    }
  ]
}

🚀 FOQUE EM:
- Problemas REAIS que afetam a qualidade
- Valores PRECISOS (não genéricos)
- Explicações que ENSINAM técnica avançada
- Soluções que funcionam no MUNDO REAL

⚡ RESPONDA APENAS JSON PURO, SEM EXPLICAÇÕES EXTRAS.
`;
}

// 🎵 Contextos específicos por gênero
function getGenreContext(genre) {
  const contexts = {
    'funk_mandela': `
🎵 GÊNERO: FUNK MANDELA
- Sub-bass: 40-80Hz deve ser POTENTE mas controlado
- Kick: 80-120Hz com ataque em 3-5kHz  
- Snare: 200Hz (corpo) + 3-8kHz (crack)
- Hi-hats: 8-15kHz brilhantes mas não agressivos
- Vocal: Presença em 2-4kHz, clareza em 6-10kHz
- LUFS alvo: -7 a -10 dB (alta energia)
- True Peak: máximo -1dBTP
- Espacialização: Graves mono, agudos estéreo`,

    'trance': `
🎵 GÊNERO: TRANCE  
- Sub-bass: 30-60Hz profundo e limpo
- Kick: 60-100Hz + click em 2-4kHz
- Bass: 80-250Hz com movimento lateral controlado
- Lead: 500Hz-8kHz com harmônicos ricos
- Pads: 200Hz-12kHz em stereo wide
- LUFS alvo: -8 a -12 dB
- True Peak: máximo -0.3dBTP  
- Dinâmica: Breathe entre seções`,

    'funk_bruxaria': `
🎵 GÊNERO: FUNK BRUXARIA
- Sub graves: 25-50Hz místicos e profundos
- Elementos percussivos: 100-300Hz tribais
- Efeitos: 1-20kHz com espacialização ampla
- Vocal: Processing criativo em 500Hz-6kHz
- LUFS alvo: -6 a -9 dB (impacto máximo)
- Atmosfera: Reverbs longos, delays creativos`
  };

  return contexts[genre] || `
🎵 GÊNERO: GERAL
- Analise com base em princípios universais
- Foque em clareza, dinâmica e espacialização
- LUFS alvo: -14 a -8 dB conforme necessidade
- True Peak: máximo -1dBTP para streaming`;
}

// Função para processar resposta da IA (modo legado)
function processAIResponse(originalSuggestions, aiResponse) {
  try {
    console.log("🤖 [AI-PROCESSING] Processando resposta da IA...");
    
    // Tentar parsear JSON da resposta
    let aiData;
    try {
      aiData = JSON.parse(aiResponse);
      console.log("✅ [AI-PROCESSING] JSON válido parseado");
    } catch (jsonError) {
      console.log("🔧 [AI-PROCESSING] Tentando extrair JSON de markdown...");
      // Se não for JSON válido, tentar extrair JSON de markdown ou texto
      const jsonMatch = aiResponse.match(/```(?:json)?\s*({[\s\S]*})\s*```/) || 
                       aiResponse.match(/({[\s\S]*"suggestions"[\s\S]*})/);
      if (jsonMatch) {
        aiData = JSON.parse(jsonMatch[1]);
        console.log("✅ [AI-PROCESSING] JSON extraído com sucesso");
      } else {
        console.log("⚠️ [AI-PROCESSING] Formato não reconhecido, usando fallback");
        throw new Error('Resposta não está em formato JSON válido');
      }
    }

    if (!aiData.suggestions || !Array.isArray(aiData.suggestions)) {
      console.log("❌ [AI-PROCESSING] Estrutura de sugestões inválida");
      throw new Error('Formato de resposta inválido - esperado array de suggestions');
    }

    console.log(`🎯 [AI-PROCESSING] ${aiData.suggestions.length} sugestões IA recebidas`);

    // Combinar sugestões originais com melhorias ULTRA-AVANÇADAS da IA
    const enhanced = originalSuggestions.map((original, index) => {
      const aiSuggestion = aiData.suggestions[index];
      
      if (aiSuggestion) {
        console.log(`🎨 [AI-PROCESSING] Processando sugestão ${index + 1}: ${aiSuggestion.problem?.substring(0, 50)}...`);
        
        return {
          ...original,
          aiEnhanced: true,
          enhanced: true,
          source: 'ai_ultra_advanced',
          timestamp: new Date().toISOString(),
          
          // 🎯 BLOCOS EDUCACIONAIS ULTRA-AVANÇADOS
          blocks: {
            problem: aiSuggestion.problem || `⚠️ ${original.message || 'Problema detectado'}`,
            cause: aiSuggestion.cause || '🎯 Análise espectral em progresso...',
            solution: aiSuggestion.solution || `🛠️ ${original.action || 'Solução técnica recomendada'}`,
            tip: aiSuggestion.tip || '💡 Monitore em diferentes sistemas de reprodução'
          },
          
          // 🔬 METADADOS TÉCNICOS AVANÇADOS
          metadata: {
            priority: aiSuggestion.priority || original.priority || 'média',
            difficulty: aiSuggestion.difficulty || 'intermediário',
            frequency_range: aiSuggestion.frequency_range || 'banda_ampla',
            processing_type: aiSuggestion.processing_type || 'eq',
            confidence: aiSuggestion.confidence || original.confidence || 0.8,
            enhanced: true,
            ai_powered: true,
            processing_time: Date.now()
          },
          
          // 🎵 PARÂMETROS TÉCNICOS ESPECÍFICOS
          technical: {
            original_priority: original.priority || 5,
            original_confidence: original.confidence || 0.5,
            ai_enhancement_level: 'ultra_advanced',
            spectral_analysis: true
          }
        };
      }

      console.log(`⚠️ [AI-PROCESSING] Sugestão ${index + 1} sem correspondência IA - usando enhanced fallback`);
      
      // 🚀 FALLBACK MELHORADO (não mais básico!)
      return {
        ...original,
        aiEnhanced: false,
        enhanced: true,
        source: 'enhanced_fallback',
        blocks: {
          problem: `⚠️ ${original.message || 'Problema detectado automaticamente'}`,
          cause: '🎯 Requer análise técnica aprofundada',
          solution: `🛠️ ${original.action || 'Solução recomendada'}`,
          tip: '💡 Verifique o resultado em sistemas de monitoração'
        },
        metadata: {
          priority: 'média',
          difficulty: 'intermediário',
          enhanced: false
        }
      };
    });

    return enhanced;

  } catch (error) {
    console.error("❌ Erro ao processar resposta da IA:", error.message);
    
    // Fallback: retornar sugestões originais com estrutura básica
    return originalSuggestions.map(original => ({
      ...original,
      aiEnhanced: false,
      blocks: {
        problem: `⚠️ ${original.message || 'Problema detectado'}`,
        cause: '🎯 Análise automática',
        solution: `🛠️ ${original.action || 'Ajuste recomendado'}`,
        tip: '💡 Teste em diferentes sistemas de áudio'
      },
      metadata: {
        priority: 'média',
        difficulty: 'intermediário',
        enhanced: false
      }
    }));
  }
}

// ✅ NOVA: Função para processar enriquecimento educativo
function processEnrichedResponse(originalSuggestions, aiResponse) {
  try {
    console.log("🎓 [ENRICHMENT-PROCESSING] Processando enriquecimento educativo...");
    
    // Tentar parsear JSON da resposta
    let aiData;
    try {
      aiData = JSON.parse(aiResponse);
      console.log("✅ [ENRICHMENT-PROCESSING] JSON válido parseado");
    } catch (jsonError) {
      console.warn("⚠️ [ENRICHMENT-PROCESSING] JSON inválido, tentando extrair...");
      // Tentar extrair JSON da resposta
      const jsonMatch = aiResponse.match(/\[.*\]/s) || aiResponse.match(/\{.*\}/s);
      if (jsonMatch) {
        aiData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Formato de resposta inválido para enriquecimento');
      }
    }

    // Validar se é um array de sugestões enriquecidas
    const enrichedData = Array.isArray(aiData) ? aiData : (aiData.suggestions || aiData.enrichedSuggestions || []);
    
    if (!Array.isArray(enrichedData)) {
      throw new Error('Resposta não contém array de sugestões enriquecidas');
    }

    console.log(`🎓 [ENRICHMENT-PROCESSING] ${enrichedData.length} sugestões enriquecidas recebidas`);

    // Combinar sugestões originais com enriquecimento educativo da IA
    const enriched = originalSuggestions.map((original, index) => {
      const aiEnrichment = enrichedData[index];
      
      if (aiEnrichment) {
        console.log(`📚 [ENRICHMENT-PROCESSING] Enriquecendo sugestão ${index + 1}: ${original.issue?.substring(0, 50)}...`);
        
        return {
          ...original,
          // Preservar estrutura original
          category: original.category,
          issue: original.issue,
          solution: aiEnrichment.solution || original.solution,
          severity: original.severity,
          
          // ✅ NOVOS CAMPOS EDUCATIVOS
          educationalContext: aiEnrichment.educationalContext || `Conceito técnico relacionado a ${original.category}`,
          learningTips: aiEnrichment.learningTips || ['Monitore este parâmetro durante a mixagem', 'Teste em diferentes sistemas de reprodução'],
          
          // Metadados de enriquecimento
          aiEnriched: true,
          enrichmentTimestamp: new Date().toISOString(),
          source: 'ai_enriched',
          
          // Preservar campos técnicos originais
          ...(original.frequency && { frequency: original.frequency }),
          ...(original.value && { value: original.value }),
          ...(original.threshold && { threshold: original.threshold })
        };
      }

      console.log(`⚠️ [ENRICHMENT-PROCESSING] Sugestão ${index + 1} sem enriquecimento - mantendo original`);
      
      // Fallback: manter sugestão original sem modificação
      return {
        ...original,
        aiEnriched: false,
        source: 'original'
      };
    });

    console.log(`✅ [ENRICHMENT-PROCESSING] ${enriched.length} sugestões processadas com enriquecimento`);
    return enriched;

  } catch (error) {
    console.error("❌ Erro ao processar enriquecimento educativo:", error.message);
    
    // Fallback: retornar sugestões originais sem modificação
    return originalSuggestions.map(original => ({
      ...original,
      aiEnriched: false,
      source: 'original_fallback',
      fallbackReason: 'Erro no enriquecimento IA'
    }));
  }
}

// ---------- Rotas existentes ----------
app.get("/health", (req, res) => {
  res.send("API está rodando 🚀");
});

// ---------- Rota para gerar URL pré-assinada ----------
app.get("/api/presign", async (req, res) => {
  try {
    const { ext, contentType } = req.query;

    // Validação dos parâmetros obrigatórios
    if (!ext || !contentType) {
      return res.status(400).json({ 
        error: "Parâmetros 'ext' e 'contentType' são obrigatórios" 
      });
    }

    // Validação da extensão
    const allowedExtensions = ['mp3', 'wav', 'flac', 'm4a'];
    if (!allowedExtensions.includes(ext.toLowerCase())) {
      return res.status(400).json({ 
        error: `Extensão '${ext}' não permitida. Use: ${allowedExtensions.join(', ')}` 
      });
    }

    // Gerar fileKey único
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const fileKey = `uploads/audio_${timestamp}_${randomId}.${ext}`;

    // Parâmetros para URL pré-assinada
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
      Expires: 600, // 10 minutos
    };

    // Gerar URL pré-assinada
    const uploadUrl = await s3.getSignedUrlPromise('putObject', params);

    console.log(`✅ URL pré-assinada gerada: ${fileKey}`);

    res.json({
      uploadUrl,
      fileKey
    });

  } catch (err) {
    console.error("❌ Erro ao gerar URL pré-assinada:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

app.get("/test", async (req, res) => {
  try {
    const result = await pool.query(
      "INSERT INTO jobs (file_key, status) VALUES ($1, $2) RETURNING *",
      ["uploads/teste.mp3", "queued"]
    );
    console.log("✅ Job inserido:", result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro ao inserir job:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "Nenhum arquivo enviado ou tipo inválido." });
    }

    const key = `uploads/${Date.now()}-${req.file.originalname}`;

    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    const data = await s3.upload(params).promise();
    console.log("✅ Upload concluído:", key);

    const result = await pool.query(
      "INSERT INTO jobs (file_key, status) VALUES ($1, $2) RETURNING *",
      [key, "queued"]
    );

    res.json({
      message: "Arquivo enviado e job criado!",
      fileUrl: `https://s3.us-east-005.backblazeb2.com/${BUCKET_NAME}/${key}`,
      job: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Erro no upload:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
