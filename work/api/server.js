import express from "express";
import multer from "multer";
import AWS from "aws-sdk";
import cors from "cors";
import pool from "../db.js";

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- CORS restrito ----------
app.use(
  cors({
    origin: [
      "https://soundyai-app-production.up.railway.app", // domínio principal (sem barra no final)
      "http://localhost:3000", // útil para testes locais
    ],
  })
);

// ---------- Configuração Backblaze ----------
const s3 = new AWS.S3({
  endpoint: "https://s3.us-east-005.backblazeb2.com",
  region: "us-east-005",
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
  signatureVersion: "v4",
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME;

// ---------- Middleware para upload ----------
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "audio/mpeg",   // mp3
    "audio/wav",    // wav
    "audio/x-wav",  // outra variação wav
    "audio/wave",   // outra variação wav
    "audio/x-m4a",  // m4a
    "audio/mp4",    // m4a/mp4
  ];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new Error("Tipo de arquivo não permitido. Envie apenas mp3, wav ou m4a."),
      false
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150 MB
  fileFilter,
});

// ---------- Rotas ----------
app.get("/health", (req, res) => {
  res.send("API está rodando 🚀");
});

// ---------- Rota para gerar URL pré-assinada ----------
app.get("/api/presign", async (req, res) => {
  try {
    const { ext, contentType } = req.query;

    // Validação dos parâmetros obrigatórios
    if (!ext || !contentType) {
      return res.status(400).json({ 
        error: "Parâmetros 'ext' e 'contentType' são obrigatórios" 
      });
    }

    // Validação da extensão
    const allowedExtensions = ['mp3', 'wav', 'flac', 'm4a'];
    if (!allowedExtensions.includes(ext.toLowerCase())) {
      return res.status(400).json({ 
        error: `Extensão '${ext}' não permitida. Use: ${allowedExtensions.join(', ')}` 
      });
    }

    // Gerar fileKey único
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const fileKey = `uploads/audio_${timestamp}_${randomId}.${ext}`;

    // Parâmetros para URL pré-assinada
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
      Expires: 600, // 10 minutos
    };

    // Gerar URL pré-assinada
    const uploadUrl = await s3.getSignedUrlPromise('putObject', params);

    console.log(`✅ URL pré-assinada gerada: ${fileKey}`);

    res.json({
      uploadUrl,
      fileKey
    });

  } catch (err) {
    console.error("❌ Erro ao gerar URL pré-assinada:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

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

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "Nenhum arquivo enviado ou tipo inválido." });
    }

    const key = `uploads/${Date.now()}-${req.file.originalname}`;

    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    const data = await s3.upload(params).promise();
    console.log("✅ Upload concluído:", key);

    const result = await pool.query(
      "INSERT INTO jobs (file_key, status) VALUES ($1, $2) RETURNING *",
      [key, "queued"]
    );

    res.json({
      message: "Arquivo enviado e job criado!",
      fileUrl: `https://s3.us-east-005.backblazeb2.com/${BUCKET_NAME}/${key}`,
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
