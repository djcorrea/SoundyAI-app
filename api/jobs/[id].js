// api/jobs/[id].js
import express from "express";

const router = express.Router();

// memória local para simular jobs
const jobs = {};

/**
 * Criar job fake em memória
 * Chamado de dentro do /analyze.js para sincronizar com o frontend
 */
export function createJob(id, fileKey, mode, fileName) {
  jobs[id] = {
    id,
    fileKey,
    mode,
    fileName,
    status: "processing",
    createdAt: Date.now(),
  };

  console.log(`[JOBS] Job ${id} criado em memória (fileKey=${fileKey})`);

  // simula conclusão em 5 segundos
  setTimeout(() => {
    jobs[id].status = "completed";
    jobs[id].result = {
      message: `✅ Análise do arquivo ${fileName} concluída com sucesso!`,
      fileKey,
      metrics: {
        similarity: Math.floor(Math.random() * 40) + 60, // 60–100%
        dynamicRange: `${Math.floor(Math.random() * 6) + 6} dB`,
        stereoWidth: `${Math.floor(Math.random() * 30) + 70}%`,
      },
    };
    console.log(`[JOBS] Job ${id} concluído e atualizado`);
  }, 5000);
}

/**
 * Rota GET /api/jobs/:id
 * Usada pelo frontend para polling do status do job
 */
router.get("/:id", (req, res) => {
  const { id } = req.params;

  if (!jobs[id]) {
    return res.status(404).json({ error: "Job não encontrado" });
  }

  res.json(jobs[id]);
});

export default router;
