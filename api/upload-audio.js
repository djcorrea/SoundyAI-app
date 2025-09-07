/**
 * Upload API para arquivos de áudio
 * Suporta WAV, FLAC, MP3 até 60MB
 * Configurado para runtime Node.js
 *
 * Implementação final: setembro 2025
 */

import fs from "fs";
import formidable from "formidable";
import s3 from "./b2.js"; // 👉 cliente S3 configurado no b2.js

// Configuração via variável de ambiente (padrão: 60MB)
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || "60");

// Formatos aceitos
const ALLOWED_FORMATS = ["audio/wav", "audio/flac", "audio/mpeg", "audio/mp3"];
const ALLOWED_EXTENSIONS = [".wav", ".flac", ".mp3"];

// Desabilitar bodyParser padrão (obrigatório p/ formidable)
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Valida o tipo de arquivo
 */
function validateFileType(mimetype, filename) {
  if (ALLOWED_FORMATS.includes(mimetype)) return true;
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
    });
  }

  try {
    // 📂 Usando formidable para parsear o multipart
    const form = formidable({ multiples: false, maxFileSize: MAX_UPLOAD_MB * 1024 * 1024 });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("[UPLOAD] Erro no parse:", err);
        return res.status(400).json({ error: "ERRO_PARSE", message: err.message });
      }

      const file = files.file;
      if (!file) {
        return res.status(400).json({
          error: "NENHUM_ARQUIVO",
          message: "Nenhum arquivo foi enviado",
        });
      }

      // Nome seguro
      const safeName = file.originalFilename.replace(/\s+/g, "_");
      const mimetype = file.mimetype;

      if (!validateFileType(mimetype, safeName)) {
        return res.status(400).json({
          error: "FORMATO_NAO_SUPORTADO",
          message: "Formato de arquivo não suportado",
          supportedFormats: ["WAV", "FLAC", "MP3"],
        });
      }

      // 🔑 Gera chave única
      const fileKey = `uploads/${Date.now()}-${safeName}`;
      const fileStream = fs.createReadStream(file.filepath);

      // 🚀 Upload para Backblaze
      await s3
        .upload({
          Bucket: process.env.B2_BUCKET_NAME,
          Key: fileKey,
          Body: fileStream,
          ContentType: mimetype,
        })
        .promise();

      console.log(`[UPLOAD] Arquivo salvo no bucket: ${fileKey}`);

      // ✅ Resposta no formato esperado pelo front
      res.status(200).json({
        success: true,
        message: "Upload realizado com sucesso",
        job: {
          file_key: fileKey,
          status: "queued",
        },
      });
    });
  } catch (error) {
    console.error("[UPLOAD] Erro no upload:", error);
    res.status(500).json({
      error: "ERRO_UPLOAD",
      message: error.message,
    });
  }
}
