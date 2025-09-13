// SERVIDOR BACKEND REAL COM PIPELINE DE ÁUDIO COMPLETO
import express from "express";
import multer from "multer";
import { processAudioComplete } from "./api/audio/pipeline-complete.js";

const app = express();

// CORS simplificado
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

// Configurar multer para receber arquivos
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Rota de teste
app.get("/", (req, res) => {
  console.log("✅ GET / recebido");
  res.json({ 
    message: "Servidor Backend REAL funcionando!", 
    timestamp: new Date().toISOString(),
    pipeline: "audio-decoder + core-metrics + pipeline-complete",
    status: "ok"
  });
});

// Rota de análise REAL com pipeline completo
app.post("/api/audio/analyze", upload.single("audio"), async (req, res) => {
  console.log("🎵 POST /api/audio/analyze recebido");
  console.log("📡 Content-Type:", req.headers['content-type']);
  console.log("📁 Arquivo recebido:", req.file ? req.file.originalname : "Nenhum arquivo");
  console.log("📊 Tamanho:", req.file ? req.file.size : 0, "bytes");
  
  if (!req.file) {
    console.error("❌ Nenhum arquivo fornecido");
    return res.status(400).json({ 
      success: false,
      error: "Nenhum arquivo de áudio fornecido" 
    });
  }

  try {
    console.log("🚀 Iniciando processamento com pipeline completo...");
    
    // Usar o pipeline REAL de áudio
    const analysisOptions = {
      genre: req.body.genre || 'funk_bruxaria',
      mode: req.body.mode || 'genre',
      fileName: req.file.originalname
    };
    
    console.log("🔧 Opções de análise:", analysisOptions);
    
    // Chamar pipeline completo (audio-decoder + core-metrics + json-output)
    const result = await processAudioComplete(
      req.file.buffer, 
      req.file.originalname, 
      analysisOptions
    );
    
    console.log("✅ Pipeline concluído com sucesso!");
    console.log("📊 LUFS Integrado:", result.lufs?.integrated);
    console.log("🎯 True Peak:", result.truePeak?.maxDbtp);
    console.log("📈 Score:", result.score);
    
    // 🔧 LOGS ADICIONAIS para debug das métricas
    console.log("🔍 [DEBUG] Estrutura do result completa:");
    console.log("🔍 [DEBUG] result.technicalData:", !!result.technicalData);
    console.log("🔍 [DEBUG] result.rms:", result.rms);
    console.log("🔍 [DEBUG] result.peak:", result.peak);
    console.log("🔍 [DEBUG] result.dynamicRange:", result.dynamicRange);
    console.log("🔍 [DEBUG] result.bandEnergies:", !!result.bandEnergies);
    
    // 🎯 RESPOSTA COMPLETA com TODAS as métricas obrigatórias
    const frontendResult = {
      success: true,
      backend: true,
      pipeline: "real",
      message: "Análise concluída pelo pipeline real",
      
      // ✅ MÉTRICAS OBRIGATÓRIAS (exatamente como esperado pelo frontend)
      metrics: {
        peak: result.peak?.db || result.technicalData?.peak || null,
        rms: result.rms?.db || result.technicalData?.rms || null, 
        lufsIntegrated: result.lufs?.integrated || result.technicalData?.lufsIntegrated || null,
        truePeakDbtp: result.truePeak?.maxDbtp || result.technicalData?.truePeakDbtp || null,
        dynamicRange: result.dynamicRange?.crest || result.technicalData?.dynamicRange || null,
        stereoCorrelation: result.stereo?.correlation || result.technicalData?.stereoCorrelation || null,
        lra: result.loudnessRange?.lra || result.technicalData?.lra || null
      },
      
      // ✅ DADOS TÉCNICOS COMPLETOS
      technicalData: {
        lufsIntegrated: result.lufs?.integrated || result.technicalData?.lufsIntegrated || null,
        lufsShortTerm: result.lufs?.shortTerm || result.technicalData?.lufsShortTerm || null,
        lufsMomentary: result.lufs?.momentary || result.technicalData?.lufsMomentary || null,
        truePeakDbtp: result.truePeak?.maxDbtp || result.technicalData?.truePeakDbtp || null,
        truePeakLinear: result.truePeak?.linear || result.technicalData?.truePeakLinear || null,
        // ✅ MÉTRICAS BÁSICAS CORRIGIDAS - usar basicMetrics primeiro
        peak: result.basicMetrics?.peak || result.technicalData?.peak || null,
        rms: result.basicMetrics?.rms || result.technicalData?.rms || null,
        dynamicRange: result.dynamicRange?.crest || result.technicalData?.dynamicRange || null,
        lra: result.loudnessRange?.lra || result.technicalData?.lra || null,
        stereoCorrelation: result.stereo?.correlation || result.technicalData?.stereoCorrelation || null,
        stereoWidth: result.stereo?.width || result.technicalData?.stereoWidth || null,
        balanceLR: result.stereo?.balance || result.technicalData?.balanceLR || null,
        sampleRate: result.metadata?.sampleRate || 48000,
        channels: result.metadata?.channels || 2,
        duration: result.metadata?.duration || 0
      },
      
      // ✅ BALANÇO ESPECTRAL
      spectral_balance: result.bandEnergies || result.technicalData?.bandEnergies || {},
      
      // ✅ SCORE E CLASSIFICAÇÃO  
      score: result.score || null,
      classification: result.classification || "Básico",
      
      // ✅ METADATA
      metadata: {
        fileName: analysisOptions.fileName,
        sampleRate: result.metadata?.sampleRate || 48000,
        channels: result.metadata?.channels || 2,
        duration: result.metadata?.duration || 0,
        processedAt: new Date().toISOString(),
        processingTime: result.metadata?.processingTime || 0,
        engineVersion: "5.4.0-real",
        pipelinePhase: "complete"
      }
    };
    
    // 🔍 LOGS FINAIS de validação
    console.log("🔍 [VALIDATION] Métricas na resposta:");
    console.log("🔍 [VALIDATION] peak:", frontendResult.metrics.peak);
    console.log("🔍 [VALIDATION] rms:", frontendResult.metrics.rms);
    console.log("🔍 [VALIDATION] lufsIntegrated:", frontendResult.metrics.lufsIntegrated);
    console.log("🔍 [VALIDATION] truePeakDbtp:", frontendResult.metrics.truePeakDbtp);
    console.log("🔍 [VALIDATION] dynamicRange:", frontendResult.metrics.dynamicRange);
    
    console.log("📤 Enviando resposta adaptada para frontend");
    res.json(frontendResult);
    
  } catch (error) {
    console.error("❌ Erro no pipeline de áudio:", error);
    console.error("📍 Stack trace:", error.stack);
    
    res.status(500).json({ 
      success: false,
      error: "Erro no processamento de áudio",
      details: error.message,
      backend: true,
      pipeline: "real"
    });
  }
});

// Error handler global
app.use((error, req, res, next) => {
  console.error("❌ Erro global:", error);
  res.status(500).json({ 
    success: false,
    error: "Erro interno do servidor",
    details: error.message 
  });
});

// Iniciar servidor
const PORT = 8083;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Backend REAL na porta ${PORT}`);
  console.log(`📍 Teste: http://localhost:${PORT}`);
  console.log(`🎵 API: http://localhost:${PORT}/api/audio/analyze`);
  console.log(`🔧 Pipeline: audio-decoder + core-metrics + pipeline-complete`);
}).on('error', (err) => {
  console.error("❌ Erro ao iniciar servidor:", err);
});