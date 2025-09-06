import express from "express";
import pkg from "pg";
import multer from "multer";
import AWS from "aws-sdk";
import cors from "cors";

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 3000;

// ---------- CORS restrito ----------
app.use(
  cors({
    origin: [
      "https://soundyai-app-production.up.railway.app/", // 🚨 troque para seu domínio real
    ],
  })
);

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

// Função para validar tipo e tamanho
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["audio/mpeg", "audio/wav", "audio/x-m4a"];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Tipo de arquivo não permitido. Envie apenas mp3, wav ou m4a."));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 120 * 1024 * 1024 }, // 120 MB
  fileFilter,
});

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
    console.error("❌ Erro ao inserir job:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Upload de arquivo para Backblaze
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado ou tipo inválido." });
    }

    const params = {
      Bucket: BUCKET_NAME,
      Key: `uploads/${Date.now()}-${req.file.originalname}`,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    const data = await s3.upload(params).promise();
    console.log("✅ Upload concluído:", params.Key);

    // Criar job no banco referenciando o arquivo no bucket
    const result = await pool.query(
      "INSERT INTO jobs (file_key, status) VALUES ($1, $2) RETURNING *",
      [params.Key, "queued"]
    );

    res.json({
      message: "Arquivo enviado e job criado!",
      fileUrl: `${s3.endpoint.href}${BUCKET_NAME}/${params.Key}`, // URL completa do arquivo
      job: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Erro no upload:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
