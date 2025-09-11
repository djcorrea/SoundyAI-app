import express from "express";
import pkg from "pg";
import multer from "multer";
import AWS from "aws-sdk";
import cors from "cors";

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 3000;// 🚨 LISTA NEGRA: Arquivos conhecidos por causar travamento
const BLACKLISTED_FILES = [
  'uploads/1757557620994.wav',
  'uploads/1757557104596.wav'
];

// ---------- CORS restrito ----------
app.use(
  cors({
    origin: [
      "https://soundyai-app-production.up.railway.app", // domínio principal (sem barra no final)
      "http://localhost:3000", // útil para testes locais
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
  limits: { fileSize: 120 * 1024 * 1024 }, // 120 MB
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

// ---------- APIs ANTI-TRAVAMENTO ----------

// 🔄 Resetar job travado
app.post("/api/reset-job/:jobId", async (req, res) => {
  const { jobId } = req.params;
  
  try {
    console.log(`🔄 API: Resetando job travado: ${jobId}`);
    
    const result = await pool.query(`
      UPDATE jobs 
      SET status = 'queued', 
          error = 'Resetado pelo sistema anti-travamento',
          updated_at = NOW()
      WHERE id = $1 AND status = 'processing'
      RETURNING id, status
    `, [jobId]);
    
    if (result.rows.length > 0) {
      console.log(`✅ API: Job ${jobId} resetado com sucesso`);
      res.json({ success: true, message: 'Job resetado com sucesso' });
    } else {
      console.log(`⚠️ API: Job ${jobId} não encontrado ou não está em processing`);
      res.status(404).json({ success: false, message: 'Job não encontrado ou não em processing' });
    }
    
  } catch (error) {
    console.error(`❌ API: Erro ao resetar job ${jobId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ❌ Cancelar job travado
app.post("/api/cancel-job/:jobId", async (req, res) => {
  const { jobId } = req.params;
  
  try {
    console.log(`❌ API: Cancelando job: ${jobId}`);
    
    const result = await pool.query(`
      UPDATE jobs 
      SET status = 'cancelled', 
          error = 'Cancelado por timeout do sistema',
          updated_at = NOW()
      WHERE id = $1 AND status IN ('processing', 'queued')
      RETURNING id, status
    `, [jobId]);
    
    if (result.rows.length > 0) {
      console.log(`✅ API: Job ${jobId} cancelado com sucesso`);
      res.json({ success: true, message: 'Job cancelado com sucesso' });
    } else {
      res.status(404).json({ success: false, message: 'Job não encontrado' });
    }
    
  } catch (error) {
    console.error(`❌ API: Erro ao cancelar job ${jobId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📊 Status detalhado do job
app.get("/api/jobs/:jobId", async (req, res) => {
  const { jobId } = req.params;
  
  try {
    const result = await pool.query(
      "SELECT * FROM jobs WHERE id = $1",
      [jobId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Job não encontrado" });
    }
    
    const job = result.rows[0];
    
    // Estrutura de resposta padronizada
    res.json({
      id: job.id,
      status: job.status,
      progress: job.progress || null,
      error: job.error || null,
      result: job.result ? (typeof job.result === 'string' ? JSON.parse(job.result) : job.result) : null,
      created_at: job.created_at,
      updated_at: job.updated_at,
      completed_at: job.completed_at
    });
    
  } catch (error) {
    console.error(`❌ API: Erro ao buscar job ${jobId}:`, error);
    res.status(500).json({ error: error.message });
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



// ---------- Upload com Lista Negra ----------
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "Nenhum arquivo foi enviado." });
    }

    // 🛡️ VERIFICAR LISTA NEGRA
    const originalname = req.file.originalname;
    const blacklistedNames = ['1757557620994.wav', '1757557104596.wav'];
    
    if (blacklistedNames.some(name => originalname.includes(name))) {
      console.warn(`🚨 Arquivo bloqueado (lista negra): ${originalname}`);
      return res.status(400).json({ 
        error: "Este arquivo é conhecido por causar problemas no sistema. Tente outro arquivo.",
        code: "FILE_BLACKLISTED"
      });
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
