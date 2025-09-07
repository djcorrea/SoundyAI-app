/**
 * Upload API para arquivos de áudio
 * Suporta WAV, FLAC, MP3 até 60MB
 * Configurado para runtime Node.js + Backblaze S3
 *
 * Implementação final: setembro 2025
 */

import fs from "fs";
import formidable from "formidable";
import s3 from "./b2.js"; // 👉 usa configuração do Backblaze S3

// 🚫 Importante: desabilita bodyParser do Next/Express
export const config = {
  api: {
    bodyParser: false,
  },
};

// Limite padrão 60MB (ajustável via env)
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || "60");
const MAX_UPLOAD_SIZE = MAX_UPLOAD_MB * 1024 * 1024;

// Formatos aceitos
const ALLOWED_FORMATS = ["audio/wav", "audio/flac", "audio/mpeg", "audio/mp3", "audio/x-wav", "audio/vnd.wave"];
const ALLOWED_EXTENSIONS = [".wav", ".flac", ".mp3"];

/**
 * Valida o tipo de arquivo (normaliza mimetype e extensão)
 */
function validateFileType(mimetype, filename) {
  if (!mimetype && !filename) return false;

  const type = (mimetype || "").toLowerCase();

  // aceita MP3 (variações)
  if (type === "audio/mpeg" || type === "audio/mp3") return true;

  // aceita WAV (variações)
  if (type === "audio/wav" || type === "audio/x-wav" || type === "audio/vnd.wave") return true;

  // aceita FLAC
  if (type === "audio/flac") return true;

  // fallback: checa extensão
  if (filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
    return ALLOWED_EXTENSIONS.includes(ext);
  }

  return false;
}

/**
 * Handler principal
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "METODO_NAO_PERMITIDO",
      message: "Apenas POST é aceito",
      allowedMethods: ["POST"],
    });
  }

  const form = formidable({
    multiples: false,
    maxFileSize: MAX_UPLOAD_SIZE,
  });

  form.parse(req, async (err, fields, files) => {
    try {
      if (err) {
        console.error("[UPLOAD] Erro no parse:", err);
        return res.status(400).json({
          error: "ERRO_PARSE",
          message: err.message,
        });
      }

      const file = files.file; // 👈 nome do campo no frontend
      if (!file) {
        return res.status(400).json({
          error: "NENHUM_ARQUIVO",
          message: "Nenhum arquivo foi enviado",
        });
      }

      // Validação
      if (!validateFileType(file.mimetype, file.originalFilename)) {
        return res.status(400).json({
          error: "FORMATO_NAO_SUPORTADO",
          message: "Formato de arquivo não suportado",
          supportedFormats: ["WAV", "FLAC", "MP3"],
        });
      }

      // 🔑 Gera chave única no bucket
      const fileKey = `uploads/${Date.now()}-${file.originalFilename}`;

      // 🚀 Upload para Backblaze
      await s3
        .upload({
          Bucket: process.env.B2_BUCKET_NAME,
          Key: fileKey,
          Body: fs.createReadStream(file.filepath), // 👈 stream do arquivo
          ContentType: file.mimetype?.replace("x-", "") || "application/octet-stream",
        })
        .promise();

      console.log(`[UPLOAD] Arquivo salvo no bucket: ${fileKey}`);

      // ✅ Resposta no formato esperado
      return res.status(200).json({
        success: true,
        message: "Upload realizado com sucesso",
        job: {
          file_key: fileKey,
          status: "queued",
        },
      });
    } catch (error) {
      console.error("[UPLOAD] Erro no upload:", error);
      return res.status(500).json({
        error: "ERRO_UPLOAD",
        message: error.message,
      });
    }
  });
}
