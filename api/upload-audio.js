/**
 * Upload API para arquivos de áudio
 * Suporta WAV, FLAC, MP3 até 60MB
 * Configurado para runtime Node.js
 * 
 * Implementação: Setembro 2025
 */

import s3 from "./b2.js"; // 🔑 Importa cliente configurado do Backblaze
const BUCKET_NAME = process.env.B2_BUCKET_NAME;

// Configuração via variável de ambiente (padrão: 60MB)
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || "60");
const MAX_UPLOAD_SIZE = MAX_UPLOAD_MB * 1024 * 1024; // Converte para bytes

// Formatos aceitos
const ALLOWED_FORMATS = ["audio/wav", "audio/flac", "audio/mpeg", "audio/mp3"];
const ALLOWED_EXTENSIONS = [".wav", ".flac", ".mp3"];

// Configuração de CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

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
 * Parse multipart/form-data manual
 */
function parseMultipartData(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"] || "";

    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      reject(new Error(`Content-Type inválido: ${contentType}`));
      return;
    }

    const boundaryMatch = contentType.match(/boundary=([^;]+)/);
    if (!boundaryMatch) {
      reject(new Error("Boundary não encontrado"));
      return;
    }

    const boundary = boundaryMatch[1].replace(/"/g, "");
    let data = Buffer.alloc(0);
    let totalSize = 0;

    req.on("data", (chunk) => {
      totalSize += chunk.length;
      if (totalSize > MAX_UPLOAD_SIZE) {
        reject(new Error(`LIMITE_EXCEDIDO:${MAX_UPLOAD_MB}`));
        return;
      }
      data = Buffer.concat([data, chunk]);
    });

    req.on("end", () => {
      try {
        const boundaryBuffer = Buffer.from(`--${boundary}`);
        const parts = [];
        let start = 0;

        while (true) {
          const boundaryIndex = data.indexOf(boundaryBuffer, start);
          if (boundaryIndex === -1) break;
          if (start > 0) {
            const part = data.slice(start, boundaryIndex);
            if (part.length > 4) parts.push(part);
          }
          start = boundaryIndex + boundaryBuffer.length;
        }

        const files = [];
        for (const part of parts) {
          const headerEnd = part.indexOf("\r\n\r\n");
          if (headerEnd === -1) continue;

          const headers = part.slice(0, headerEnd).toString();
          const content = part.slice(headerEnd + 4, part.length - 2);

          const dispositionMatch = headers.match(
            /Content-Disposition: form-data; name="([^"]+)"(?:; filename="([^"]+)")?/
          );
          if (!dispositionMatch) continue;

          const filename = dispositionMatch[2];
          if (filename) {
            const contentTypeMatch = headers.match(/Content-Type: ([^\r\n]+)/);
            const contentType = contentTypeMatch
              ? contentTypeMatch[1]
              : "application/octet-stream";

            files.push({
              filename,
              contentType,
              content,
              size: content.length,
            });
          }
        }

        resolve({ files, totalSize });
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

/**
 * Handler principal
 */
export default async function handler(req, res) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({
      error: "METODO_NAO_PERMITIDO",
      message: "Apenas POST é aceito",
    });
    return;
  }

  try {
    const { files } = await parseMultipartData(req);
    if (!files.length) {
      res.status(400).json({ error: "NENHUM_ARQUIVO", message: "Nenhum arquivo enviado" });
      return;
    }

    const audioFile = files[0];
    if (!validateFileType(audioFile.contentType, audioFile.filename)) {
      res.status(400).json({
        error: "FORMATO_NAO_SUPORTADO",
        message: "Formato não suportado",
      });
      return;
    }

    // 🔑 Gerar chave única no bucket
    const fileKey = `uploads/${Date.now()}-${audioFile.filename}`;

    // 🚀 Upload para Backblaze
    await s3
      .upload({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: audioFile.content,
        ContentType: audioFile.contentType,
      })
      .promise();

    console.log(`[UPLOAD] Arquivo salvo no bucket: ${fileKey}`);

    // ✅ Resposta
    res.status(200).json({
      success: true,
      message: "Upload realizado com sucesso",
      job: {
        file_key: fileKey,
        status: "queued",
      },
    });
  } catch (error) {
    console.error("[UPLOAD] Erro:", error);
    res.status(500).json({ error: error.message });
  }
}

export const config = {
  runtime: "nodejs",
  api: { bodyParser: false, responseLimit: false },
};
