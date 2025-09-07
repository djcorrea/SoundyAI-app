/**
 * Upload API para arquivos de áudio
 * Suporta WAV, FLAC, MP3 até 60MB
 * Configurado para runtime Node.js
 *
 * Implementação corrigida: setembro 2025
 */

import s3 from "./b2.js"; // 👉 importa o S3 já configurado no b2.js

// Configuração via variável de ambiente (padrão: 60MB)
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || "60");
const MAX_UPLOAD_SIZE = MAX_UPLOAD_MB * 1024 * 1024; // Converte para bytes

// Formatos aceitos
const ALLOWED_FORMATS = ["audio/wav", "audio/flac", "audio/mpeg", "audio/mp3"];
const ALLOWED_EXTENSIONS = [".wav", ".flac", ".mp3"];

/**
 * Valida o tipo de arquivo
 */
function validateFileType(contentType, filename) {
  if (ALLOWED_FORMATS.includes(contentType)) return true;
  if (filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
    return ALLOWED_EXTENSIONS.includes(ext);
  }
  return false;
}

/**
 * Handler principal da API
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "METODO_NAO_PERMITIDO",
        message: "Apenas POST é aceito",
        allowedMethods: ["POST"],
      });
    }

    // Carregar dados do arquivo (vem do parse anterior)
    const files = req.body?.files || req.files; // depende do parse configurado
    if (!files || files.length === 0) {
      return res.status(400).json({
        error: "NENHUM_ARQUIVO",
        message: "Nenhum arquivo foi enviado",
      });
    }

    const audioFile = files[0];

    if (!validateFileType(audioFile.contentType, audioFile.filename)) {
      return res.status(400).json({
        error: "FORMATO_NAO_SUPORTADO",
        message: "Formato de arquivo não suportado",
        supportedFormats: ["WAV", "FLAC", "MP3"],
      });
    }

    // 🔑 Gera chave única no bucket
    const fileKey = `uploads/${Date.now()}-${audioFile.filename}`;

    // 🚀 Upload para Backblaze (usando S3 API)
    await s3
      .upload({
        Bucket: process.env.B2_BUCKET_NAME, // 👉 bucketName correto
        Key: fileKey,
        Body: audioFile.content,
        ContentType: audioFile.contentType,
      })
      .promise();

    console.log(`[UPLOAD] Arquivo salvo no bucket: ${fileKey}`);

    // ✅ Resposta no formato esperado pelo frontend
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
    res.status(500).json({
      error: "ERRO_UPLOAD",
      message: error.message,
    });
  }
}
