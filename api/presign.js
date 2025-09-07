import express from "express";
import s3 from "./b2.js"; // se você salvou o cliente s3 configurado na pasta lib
const router = express.Router();

const BUCKET_NAME = process.env.B2_BUCKET_NAME;

router.get("/presign", async (req, res) => {
  try {
    const { ext, contentType } = req.query;
    if (!ext || !contentType) {
      return res.status(400).json({ error: "Parâmetros ext e contentType são obrigatórios" });
    }

    // Cria chave única
    const fileKey = `uploads/${Date.now()}.${ext}`;

    const params = {
      Bucket: SoundyAI-Bucket,
      Key: fileKey,
      ContentType: contentType,
      Expires: 600, // expira em 10 minutos
    };

    const uploadUrl = await s3.getSignedUrlPromise("putObject", params);

    res.json({ uploadUrl, fileKey });
  } catch (err) {
    console.error("❌ Erro ao gerar presign:", err.message);
    res.status(500).json({ error: "Erro ao gerar URL pré-assinada" });
  }
});

export default router;
