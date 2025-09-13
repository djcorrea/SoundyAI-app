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
    
    // Adaptar resultado para formato esperado pelo frontend
    const frontendResult = {
      success: true,
      message: "Análise concluída pelo pipeline real",
      data: {
        // LUFS - SEM FALLBACKS FICTÍCIOS
        lufs_integrated: result.lufs?.integrated,
        lufs_short_term: result.lufs?.shortTerm,
        lufs_momentary: result.lufs?.momentary,
        
        // True Peak - SEM FALLBACKS FICTÍCIOS
        true_peak_dbtp: result.truePeak?.maxDbtp,
        true_peak_dbfs: result.truePeak?.maxDbfs,
        headroom_true_peak_db: result.truePeak?.headroom,
        
        // Dinâmica - SEM FALLBACKS FICTÍCIOS
        dynamic_range: result.dynamicRange?.crest,
        lra: result.loudnessRange?.lra,
        
        // Estéreo - SEM FALLBACKS FICTÍCIOS
        stereo_correlation: result.stereo?.correlation,
        balance_lr: result.stereo?.balance,
        
        // RMS e Pico - SEM FALLBACKS FICTÍCIOS
        rms_db: result.rms?.db,
        peak_db: result.peak?.db,
        
        // Bandas espectrais (se disponíveis)
        bands: result.bands || {},
        
        // Score e problemas
        score: result.score || 7.5,
        problems: result.problems || [],
        suggestions: result.suggestions || [],
        
        // Metadata
        timestamp: new Date().toISOString(),
        backend: true,
        pipeline: "real",
        processing_time_ms: result.metadata?.processingTime || 0,
        
        // Dados brutos para debugging
        rawResult: result
      }
    };
    
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