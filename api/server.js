import express from "express";
import pkg from "pg";
import multer from "multer";
import AWS from "aws-sdk";

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Conexão com Postgres ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Railway/Postgres
});

// ---------- Configuração Backblaze ----------
const s3 = new AWS.S3({
  endpoint: "https://s3.us-east-005.backblazeb2.com", // endpoint do Backblaze (ajuste se sua região for diferente)
  region: "us-east-005", // mesma região usada no bucket
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
  signatureVersion: "v4",
});

// Nome do bucket
const BUCKET_NAME = process.env.B2_BUCKET_NAME;

// ---------- Middleware para upload ----------
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ---------- Rotas ----------
app.get("/health", (req, res) => {
  res.send("API está rodando 🚀");
});

// Criar job fake no banco
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

// Upload de arquivo para Backblaze
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: `uploads/${Date.now()}-${req.file.originalname}`,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    const data = await s3.upload(params).promise();
    console.log("✅ Upload concluído:", data.Location);

    // Criar job no banco referenciando o arquivo no bucket
    const result = await pool.query(
      "INSERT INTO jobs (file_key, status) VALUES ($1, $2) RETURNING *",
      [data.Key, "queued"]
    );

    res.json({
      message: "Arquivo enviado e job criado!",
      fileUrl: data.Location,
      job: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Erro no upload:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
