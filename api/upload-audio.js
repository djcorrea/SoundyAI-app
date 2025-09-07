/**
 * Upload API para arquivos de áudio → Backblaze S3
 */
import formidable from "formidable";
import fs from "fs";
import s3 from "./b2.js";

export const config = {
  api: {
    bodyParser: false, // Desliga bodyParser para permitir o formidable
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const form = formidable({ multiples: false, maxFileSize: 60 * 1024 * 1024 });

  form.parse(req, async (err, fields, files) => {
    try {
      if (err) {
        console.error("[UPLOAD] Erro no formidable:", err);
        return res.status(400).json({ error: "Erro ao processar upload" });
      }

      const file = files.file;
      if (!file) {
        return res.status(400).json({ error: "NENHUM_ARQUIVO", message: "Nenhum arquivo foi enviado" });
      }

      console.log("[UPLOAD] Arquivo recebido:", file.originalFilename, file.mimetype, file.size);

      // Chave única no bucket
      const fileKey = `uploads/${Date.now()}-${file.originalFilename}`;

      // 🚀 Faz upload via stream
      const uploadStream = fs.createReadStream(file.filepath);

      await s3.upload({
        Bucket: process.env.B2_BUCKET_NAME,
        Key: fileKey,
        Body: uploadStream,
        ContentType: file.mimetype,
      }).promise();

      console.log(`[UPLOAD] Salvo no bucket: ${fileKey}`);

      res.status(200).json({
        success: true,
        message: "Upload realizado com sucesso",
        job: { file_key: fileKey, status: "queued" },
      });
    } catch (error) {
      console.error("[UPLOAD] Erro:", error);
      res.status(500).json({ error: "ERRO_UPLOAD", message: error.message });
    }
  });
}
