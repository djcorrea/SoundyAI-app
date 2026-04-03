import express from "express";
import pkg from "pg";
import multer from "multer";
import AWS from "aws-sdk";
import cors from "cors";
import fetch from "node-fetch";

// ⚠️ CORRECTION PLAN movido para server.js da raiz (SoundyAI-app)
// Não importar aqui - serviço api/ não tem as variáveis de ambiente

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para JSON
app.use(express.json({ limit: '10mb' }));

// ---------- CORS restrito ----------
app.use(
  cors({
    origin: [
      "https://soundyai.com.br",
      "https://www.soundyai.com.br",
      "https://soundyai-app-production.up.railway.app",
      "http://localhost:3000",
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
  limits: { fileSize: 150 * 1024 * 1024 }, // 150 MB
  fileFilter,
});

// ⚠️ CORRECTION PLAN: Rota está no SoundyAI-app (server.js raiz)
// O serviço api/ não precisa dessa rota

// ---------- Rota para sugestões com IA ----------
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
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em pré-masterização e mixagem, com foco em análise técnica objetiva.

CONTEXTO: Você está analisando uma MIX em fase PRÉ-MASTER — NÃO o produto final masterizado.

REGRAS ABSOLUTAS:
1. Gere APENAS sugestões baseadas nestas 4 métricas: LUFS, True Peak, Dynamic Range (DR), Crest Factor.
2. PROIBIDO gerar sugestões sobre: bandas de frequência, EQ, ajustes de Hz, estéreo, imagem estéreo, loudness para streaming ou plataformas, loudness competitivo.
3. NÃO fale como se fosse o produto final. Fale como avaliação técnica da mix antes da masterização.
4. Linguagem: objetiva, técnica, direta.
5. Gere no máximo 3 sugestões no array. Se não houver problemas reais, retorne array vazio: []
6. Cada sugestão DEVE ter o campo "metric" preenchido com: "lufs", "truePeak", "dr" ou "crestFactor".

FORMATO JSON OBRIGATÓRIO (ARRAY de no máximo 3 itens, ou vazio):
[
  {
    "metric": "lufs|truePeak|dr|crestFactor",
    "problema": "Descrição objetiva: [Métrica] está em [valor medido], valor esperado é [alvo].",
    "causa": "Impacto técnico direto na etapa de masterização.",
    "solucao": "Ação prática e direta sobre a mix.",
    "dica_extra": "Contexto técnico adicional relevante para esta etapa de pré-master.",
    "plugin": "Ferramenta de medição ou ajuste específica para esta métrica."
  }
]

RESPONDA EXCLUSIVAMENTE COM JSON VÁLIDO (ARRAY), sem markdown, sem texto extra.`
          },
          {
            role: 'user', 
            content: prompt
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
  const suggestionsList = suggestions.map((s, i) => {
    let entry = `${i + 1}. MÉTRICA: ${s.metric || s.key || 'N/A'} — ${s.message || s.title || 'Sugestão'}`;
    if (s.currentValue !== undefined && s.targetValue !== undefined) {
      entry += ` (valor atual: ${s.currentValue}${s.unit || ''}, alvo: ${s.targetValue}${s.unit || ''})`;
    }
    return entry;
  }).join('\n');

  const metricsInfo = metrics ? `MÉTRICAS DA MIX (pré-master):
- LUFS Integrado: ${metrics.lufsIntegrated || 'N/A'} dB
- True Peak: ${metrics.truePeakDbtp || 'N/A'} dBTP
- Dynamic Range: ${metrics.dynamicRange || 'N/A'} LU
- LRA: ${metrics.lra || 'N/A'} LU
- Crest Factor: ${metrics.crestFactor || 'N/A'} dB` : '';

  const expected = Math.min(suggestions.length, 3);
  return `Analise as seguintes detecções de uma MIX em fase pré-master para o gênero: ${genre || 'não especificado'}.

DETECÇÕES:
${suggestionsList}

${metricsInfo}

Gere exatamente ${expected} sugestão(ões) em formato JSON (ARRAY).
Cada item DEVE ter o campo "metric" preenchido com: "lufs", "truePeak", "dr" ou "crestFactor".
NÃO gere sugestões de EQ, bandas de frequência, estéreo ou loudness para distribuição.
Se não houver problemas reais nessas métricas, retorne um array vazio: []
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

// Função para processar resposta da IA
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
