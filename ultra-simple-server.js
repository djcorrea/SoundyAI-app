// Servidor ultra-simples para teste
import express from "express";

const app = express();

// CORS básico
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

// Rota de teste simples
app.get("/", (req, res) => {
  console.log("✅ GET / recebido");
  res.json({ 
    message: "Servidor funcionando!", 
    timestamp: new Date().toISOString(),
    status: "ok"
  });
});

// Rota de análise simplificada
app.post("/api/audio/analyze", (req, res) => {
  console.log("🎵 POST /api/audio/analyze recebido");
  console.log("📡 Headers:", req.headers['content-type']);
  console.log("📦 Body tipo:", typeof req.body);
  console.log("📦 Body keys:", req.body ? Object.keys(req.body) : 'nenhum');
  
  // Simular processamento
  setTimeout(() => {
    const mockResult = {
      success: true,
      message: "Análise concluída pelo backend",
      data: {
        lufs_integrated: -14.2,
        lufs_short_term: -12.8,
        lufs_momentary: -11.5,
        true_peak_dbtp: -1.2,
        true_peak_dbfs: -1.0,
        headroom_true_peak_db: 0.8,
        dynamic_range: 8.5,
        lra: 6.2,
        stereo_correlation: 0.3,
        balance_lr: 0.0,
        rms_db: -18.5,
        peak_db: -3.2,
        score: 7.5,
        timestamp: new Date().toISOString(),
        backend: true
      }
    };
    
    console.log("✅ Enviando resposta:", JSON.stringify(mockResult, null, 2));
    res.json(mockResult);
  }, 1000);
});

// Error handler
app.use((error, req, res, next) => {
  console.error("❌ Erro:", error);
  res.status(500).json({ error: error.message });
});

const PORT = 8082;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ultra-simples na porta ${PORT}`);
  console.log(`📍 Teste: http://localhost:${PORT}`);
}).on('error', (err) => {
  console.error("❌ Erro ao iniciar servidor:", err);
});