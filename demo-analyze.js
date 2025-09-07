// Demo da rota refatorada
import express from 'express';
import analyzeRoute from './api/audio/analyze.js';

const app = express();

// Middleware básico
app.use(express.json());

// Registrar rota de análise
app.use('/api/audio', analyzeRoute);

// Rota de teste
app.get('/', (req, res) => {
  res.json({ message: 'Servidor de demonstração da rota /api/audio/analyze', status: 'ok' });
});

const PORT = 3001; // Usar porta diferente para evitar conflitos
app.listen(PORT, () => {
  console.log(`🧪 Demo servidor rodando na porta ${PORT}`);
  console.log(`📡 Teste: POST http://localhost:${PORT}/api/audio/analyze`);
  console.log(`🏠 Home: GET http://localhost:${PORT}/`);
});
