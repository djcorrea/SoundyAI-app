// test-simular-api.js
// 🔥 SIMULAR EXATAMENTE O QUE A API FAZ

import express from 'express';
import { audioQueue } from './work/queue/redis.js';
import { randomUUID } from 'crypto';

const app = express();
app.use(express.json());

console.log('🚀 [SIMULADOR API] Iniciando servidor de teste...');

// Simular exatamente o endpoint da API
app.post('/api/audio/analyze', async (req, res) => {
  try {
    const { fileKey, mode = "genre", fileName } = req.body;
    const jobId = randomUUID();

    console.log(`📥 [SIMULADOR] Tentando enfileirar job: ${jobId}`);
    console.log(`🗂️ [SIMULADOR] FileKey: ${fileKey}, Mode: ${mode}`);

    // Enfileirar EXATAMENTE como a API faz
    await audioQueue.add('analyze', {
      jobId,
      fileKey,
      mode,
      fileName: fileName || null
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 50,
      removeOnFail: 100
    });

    console.log(`✅ [SIMULADOR] Job ${jobId} enfileirado com sucesso`);

    res.json({
      success: true,
      jobId,
      fileKey,
      mode,
      status: 'queued'
    });

  } catch (error) {
    console.error(`❌ [SIMULADOR] Erro:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para verificar stats da fila
app.get('/stats', async (req, res) => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      audioQueue.getWaitingCount(),
      audioQueue.getActiveCount(), 
      audioQueue.getCompletedCount(),
      audioQueue.getFailedCount()
    ]);

    const stats = { waiting, active, completed, failed };
    console.log('📊 [SIMULADOR] Stats:', stats);
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🌐 [SIMULADOR] Servidor rodando na porta ${PORT}`);
  console.log(`📡 [SIMULADOR] Teste: POST http://localhost:${PORT}/api/audio/analyze`);
  console.log(`📊 [SIMULADOR] Stats: GET http://localhost:${PORT}/stats`);
});

// Eventos da fila para debug
audioQueue.on('waiting', (job) => {
  console.log(`⌛ [SIMULADOR] Job waiting: ${job.id} | ${job.data.jobId}`);
});

audioQueue.on('active', (job) => {
  console.log(`⚡ [SIMULADOR] Job ativo: ${job.id} | ${job.data.jobId}`);
});

audioQueue.on('completed', (job, result) => {
  console.log(`✅ [SIMULADOR] Job completo: ${job.id} | ${job.data.jobId}`);
});

audioQueue.on('failed', (job, err) => {
  console.log(`❌ [SIMULADOR] Job falhou: ${job.id} | ${job.data.jobId} | Erro: ${err.message}`);
});