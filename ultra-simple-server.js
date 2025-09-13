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
  console.log("Headers:", req.headers);
  console.log("Body keys:", Object.keys(req.body || {}));
  
  res.json({
    success: true,
    message: "Backend recebeu o request",
    data: {
      lufs_integrated: -14.2,
      true_peak_dbtp: -1.2,
      dynamic_range: 8.5,
      score: 7.5,
      timestamp: new Date().toISOString()
    }
  });
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