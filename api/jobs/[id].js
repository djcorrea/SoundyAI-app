// api/jobs/[id].js
import express from "express";
import pkg from "pg";

const { Pool } = pkg;
const router = express.Router();

// 🔑 Conexão com Postgres (Railway usa DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
});

// rota GET /api/jobs/:id
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT id, file_key, mode, status, error, result,
              progress, progress_message,
              created_at, updated_at, completed_at
         FROM jobs
        WHERE id = $1
        LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Job não encontrado" });
    }

    const job = rows[0];

    // 🔑 Normalizar status para o frontend entender
    let normalizedStatus = job.status;
    if (normalizedStatus === "done") normalizedStatus = "completed";
    if (normalizedStatus === "failed") normalizedStatus = "error";

    return res.json({
      id: job.id,
      fileKey: job.file_key,
      mode: job.mode,
      status: normalizedStatus, // ✅ garante compatibilidade com o pollJobStatus
      error: job.error || null,
      result: job.result || null, // ✅ já vem como objeto do Postgres (jsonb field)
      progress: job.progress || 0, // ✅ progresso real
      progressMessage: job.progress_message || null, // ✅ mensagem de progresso
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at,
    });
  } catch (err) {
    console.error("❌ Erro ao buscar job:", err);
    return res.status(500).json({ error: "Falha ao buscar job" });
  }
});

export default router;
