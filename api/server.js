import express from "express";
import pkg from "pg";

const { Client } = pkg;
const app = express();
const PORT = process.env.PORT || 3000;

// Conexão com o banco
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Railway/Postgres precisa disso
});

client.connect()
  .then(() => console.log("✅ Conectado ao Postgres"))
  .catch(err => console.error("❌ Erro ao conectar no Postgres:", err));

// Endpoint de healthcheck
app.get("/health", (req, res) => {
  res.send("API está rodando 🚀");
});

// Endpoint de teste -> cria um job fake
app.get("/test", async (req, res) => {
  try {
    const result = await client.query(
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

