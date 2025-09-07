/**
 * Upload API para arquivos de áudio
 * Suporta WAV, FLAC, MP3 até 60MB
 * Configurado para runtime Node.js
 *
 * Implementação corrigida: setembro 2025
 */

import multer from "multer";
import s3 from "./b2.js"; // 👉 S3 client configurado

// Configuração via variável de ambiente (padrão: 60MB)
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || "60");
const MAX_UPLOAD_SIZE = MAX_UPLOAD_MB * 1024 * 1024; // Converte para bytes

// Multer config → armazena em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE },
});

// Formatos aceitos
const ALLOWED_FORMATS = ["audio/wav", "audio/flac", "audio/mpeg", "audio/mp3"];
const ALLOWED_EXTENSIONS = [".wav", ".flac", ".mp3"];

// Valida tipo
function validateFileType(mimetype, filename) {
  if (ALLOWED_FORMATS.includes(mimetype)) return true;
  if (filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
    return ALLOWED_EXTENSIONS.includes(ext);
  }
  return false;
}

// Handler
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "METODO_NAO_PERMITIDO" });
    }

    // Usar multer para parsear o arquivo
    await new Promise((resolve, reject) => {
      upload.single("file")(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const audioFile = req.file;
    if (!audioFile) {
      return res.status(400).json({
        error: "NENHUM_ARQUIVO",
        message: "Nenhum arquivo foi enviado",
      });
    }

    if (!validateFileType(audioFile.mimetype, audioFile.originalname)) {
      return res.status(400).json({
        error: "FORMATO_NAO_SUPORTADO",
        message: "Formato de arquivo não suportado",
      });
    }

    // 🔑 Gera chave única
    const fileKey = `uploads/${Date.now()}-${audioFile.originalname}`;

    // 🚀 Upload para o Backblaze
    await s3
      .upload({
        Bucket: process.env.B2_BUCKET_NAME,
        Key: fileKey,
        Body: audioFile.buffer, // 👈 multer coloca o conteúdo aqui
        ContentType: audioFile.mimetype,
      })
      .promise();

    console.log(`[UPLOAD] Arquivo salvo no bucket: ${fileKey}`);

    // ✅ Resposta para o frontend
    res.status(200).json({
      success: true,
      message: "Upload realizado com sucesso",
      job: {
        file_key: fileKey,
        status: "queued",
      },
    });
  } catch (error) {
    console.error("[UPLOAD] Erro no upload:", error);
    res.status(500).json({ error: "ERRO_UPLOAD", message: error.message });
  }
}
