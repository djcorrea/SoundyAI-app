import express from "express";
import pkg from "pg";

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 3000;

// Conexão com o banco usando Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Railway/Postgres
});

// Endpoint de healthcheck
app.get("/health", (req, res) => {
  res.send("API está rodando 🚀");
});

// Endpoint de teste -> cria um job fake
app.get("/test", async (req, res) => {
  try {
    const result = await pool.query(
      "INSERT INTO jobs (file_key, status) VALUES ($1, $2) RETURNING *",
      ["uploads/teste.mp3", "queued"]
    );
    console.log("✅ Job inserido:", result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro ao inserir job:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
