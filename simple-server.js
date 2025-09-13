// Servidor backend simplificado para teste
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json({ limit: "50mb" }));

// Configurar multer para upload de arquivos
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Rota de teste
app.get("/", (req, res) => {
  res.json({ message: "Servidor backend SoundyAI funcionando!" });
});

// Rota de análise de áudio (simulação inicial)
app.post("/api/audio/analyze", upload.single("audio"), async (req, res) => {
  try {
    console.log("🎵 Recebido request para análise de áudio");
    console.log("📁 Arquivo:", req.file ? req.file.originalname : "Nenhum arquivo");
    console.log("📊 Tamanho:", req.file ? req.file.size : 0, "bytes");
    
    if (!req.file) {
      return res.status(400).json({ 
        error: "Nenhum arquivo de áudio fornecido" 
      });
    }

    // Simulação de análise (depois conectaremos ao pipeline real)
    const mockResult = {
      runId: `test-${Date.now()}`,
      timestamp: new Date().toISOString(),
      metrics: {
        overall_score: 7.5,
        lufs: {
          integrated: -14.2,
          short_term: -12.8,
          momentary: -11.5
        },
        true_peak: {
          max: -1.2,
          above_threshold: false
        },
        spectral: {
          brightness: 0.65,
          warmth: 0.72,
          presence: 0.58
        },
        dynamics: {
          dr: 8.5,
          crest_factor: 12.3
        }
      },
      status: "completed",
      filename: req.file.originalname,
      filesize: req.file.size
    };

    console.log("✅ Análise simulada concluída");
    res.json(mockResult);
    
  } catch (error) {
    console.error("❌ Erro na análise:", error);
    res.status(500).json({ 
      error: "Erro interno do servidor",
      details: error.message 
    });
  }
});

// Iniciar servidor
const PORT = 8081;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor backend simples rodando na porta ${PORT}`);
  console.log(`📍 Teste: http://localhost:${PORT}`);
  console.log(`🎵 API: http://localhost:${PORT}/api/audio/analyze`);
  console.log(`🌐 CORS habilitado para http://localhost:3000`);
});