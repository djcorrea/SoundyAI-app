import express from "express";
import s3 from "./b2.js"; // cliente S3 configurado
const router = express.Router();

const BUCKET_NAME = process.env.B2_BUCKET_NAME;

router.get("/presign", async (req, res) => {
  try {
    const { ext } = req.query;

    // ✅ agora só exige ext
    if (!ext) {
      return res.status(400).json({
        error: "Parâmetro 'ext' é obrigatório (ex: wav, mp3, flac)"
      });
    }

    const fileKey = `uploads/${Date.now()}.${ext}`;

    const params = {
      Bucket: BUCKET_NAME,
      Key: fileKey,
      Expires: 600, // URL válida por 10 min
    };

    const uploadUrl = await s3.getSignedUrlPromise("putObject", params);

    // ✅ resposta padronizada
    res.status(200).json({ uploadUrl, fileKey });
  } catch (err) {
    console.error("❌ Erro ao gerar presign:", err);
    res.status(500).json({
      error: "Erro ao gerar URL pré-assinada",
      details: err.message,
      code: err.code
    });
  }
});

export default router;
