import fs from "fs";
import formidable from "formidable";
import s3 from "./b2.js";

export const config = {
  api: {
    bodyParser: false, // 🚫 importante, deixa o formidable cuidar do upload
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    try {
      if (err) {
        console.error("[UPLOAD] Erro parse:", err);
        return res.status(500).json({ error: "Erro ao processar upload" });
      }

      const file = files.file; // 👈 o campo "file" do frontend
      if (!file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      // 🔑 Gera chave única
      const fileKey = `uploads/${Date.now()}-${file.originalFilename}`;

      // 🚀 Upload para Backblaze com stream
      await s3
        .upload({
          Bucket: process.env.B2_BUCKET_NAME,
          Key: fileKey,
          Body: fs.createReadStream(file.filepath), // 👈 usa o stream do arquivo temporário
          ContentType: file.mimetype,
        })
        .promise();

      console.log(`[UPLOAD] Arquivo salvo no bucket: ${fileKey}`);

      return res.status(200).json({
        success: true,
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
