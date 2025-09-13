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
    // 🔍 DEBUG de valores calculados
    console.log("🔍 [DEBUG] Valores básicos calculados:");
    console.log("🔍 [DEBUG] result.basicMetrics:", result.basicMetrics);
    console.log("🔍 [DEBUG] result.technicalData:", !!result.technicalData);
    console.log("🔍 [DEBUG] result.lufs:", result.lufs);
    console.log("🔍 [DEBUG] result.truePeak:", result.truePeak);
    console.log("🔍 [DEBUG] result.bandEnergies:", !!result.bandEnergies);
    
    // ✅ EXTRAÇÃO CORRETA das métricas básicas
    const extractedPeak = result.basicMetrics?.peak || result.technicalData?.peak || null;
    const extractedRms = result.basicMetrics?.rms || result.technicalData?.rms || null;
    const extractedLufs = result.lufs?.integrated || result.technicalData?.lufsIntegrated || null;
    const extractedTruePeak = result.truePeak?.maxDbtp || result.technicalData?.truePeakDbtp || null;
    const extractedDynamicRange = result.dr || result.technicalData?.dynamicRange || null;
    
    console.log("🎯 [EXTRACTION] Métricas extraídas:");
    console.log("🎯 [EXTRACTION] peak:", extractedPeak);
    console.log("🎯 [EXTRACTION] rms:", extractedRms);
    console.log("🎯 [EXTRACTION] lufsIntegrated:", extractedLufs);
    console.log("🎯 [EXTRACTION] truePeakDbtp:", extractedTruePeak);
    console.log("🎯 [EXTRACTION] dynamicRange:", extractedDynamicRange);
    
    // 🎯 RESPOSTA PADRONIZADA (formato esperado pelo frontend)
    const frontendResult = {
      success: true,
      backend: true,
      pipeline: "real",
      message: "Análise concluída pelo pipeline real",
      
      // ✅ MÉTRICAS OBRIGATÓRIAS (exatamente como esperado pelo frontend)
      metrics: {
        peak: extractedPeak,
        rms: extractedRms,
        lufsIntegrated: extractedLufs,
        truePeakDbtp: extractedTruePeak,
        dynamicRange: extractedDynamicRange,
        // Métricas complementares
        stereoCorrelation: result.stereo?.correlation || result.technicalData?.stereoCorrelation || null,
        lra: result.lufs?.lra || result.technicalData?.lra || null
      },
      
      // ✅ DADOS TÉCNICOS COMPLETOS
      technicalData: {
        // Métricas principais
        peak: extractedPeak,
        rms: extractedRms,
        lufsIntegrated: extractedLufs,
        truePeakDbtp: extractedTruePeak,
        dynamicRange: extractedDynamicRange,
        // Métricas LUFS complementares
        lufsShortTerm: result.lufs?.shortTerm || result.technicalData?.lufsShortTerm || null,
        lufsMomentary: result.lufs?.momentary || result.technicalData?.lufsMomentary || null,
        lra: result.lufs?.lra || result.technicalData?.lra || null,
        // True Peak detalhado
        truePeakLinear: result.truePeak?.maxLinear || result.technicalData?.truePeakLinear || null,
        // Métricas estéreo
        stereoCorrelation: result.stereo?.correlation || result.technicalData?.stereoCorrelation || null,
        stereoWidth: result.stereo?.width || result.technicalData?.stereoWidth || null,
        balanceLR: result.stereo?.balance || result.technicalData?.balanceLR || null,
        // Metadados
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
    
    // ✅ VALIDAÇÃO FINAL COMPLETA das métricas obrigatórias
    const requiredMetrics = ['peak', 'rms', 'lufsIntegrated', 'truePeakDbtp', 'dynamicRange'];
    const missingMetrics = [];
    const presentMetrics = [];
    
    requiredMetrics.forEach(metric => {
      const value = frontendResult.metrics[metric];
      if (value === null || value === undefined) {
        missingMetrics.push(metric);
      } else {
        presentMetrics.push(`${metric}: ${value}`);
      }
    });
    
    console.log("🔍 [VALIDATION] ===== CHECKLIST DE MÉTRICAS =====");
    console.log("✅ [VALIDATION] Métricas presentes:", presentMetrics.length > 0 ? presentMetrics : "NENHUMA");
    console.log("❌ [VALIDATION] Métricas ausentes:", missingMetrics.length > 0 ? missingMetrics : "NENHUMA");
    console.log("🎯 [VALIDATION] Total obrigatórias:", requiredMetrics.length);
    console.log("✅ [VALIDATION] Total presentes:", presentMetrics.length);
    console.log("� [VALIDATION] Taxa de completude:", `${(presentMetrics.length / requiredMetrics.length * 100).toFixed(1)}%`);
    
    // Status de análise
    const analysisComplete = missingMetrics.length === 0;
    console.log(analysisComplete ? 
      "🎉 [VALIDATION] ANÁLISE COMPLETA - Todas as métricas presentes!" : 
      "⚠️ [VALIDATION] ANÁLISE INCOMPLETA - Métricas ausentes detectadas"
    );
    
    console.log("📤 Enviando resposta padronizada para frontend");
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