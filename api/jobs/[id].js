// api/jobs/[id].js
import express from "express";

const router = express.Router();

// memória local para simular jobs
const jobs = {};

// criar um job fake (você pode chamar isso de dentro do /analyze)
export function createJob(id, fileKey, mode, fileName) {
  jobs[id] = {
    id,
    fileKey,
    mode,
    fileName,
    status: "processing",
    createdAt: Date.now(),
  };

  // simula conclusão em 5 segundos
  setTimeout(() => {
    jobs[id].status = "completed";
    jobs[id].result = {
      message: `Análise do arquivo ${fileName} concluída com sucesso!`,
    };
  }, 5000);
}

// rota GET /api/jobs/:id
router.get("/:id", (req, res) => {
  const { id } = req.params;

  if (!jobs[id]) {
    return res.status(404).json({ error: "Job não encontrado" });
  }

  res.json(jobs[id]);
});

export default router;
