import express from "express";
import s3 from "./b2.js"; // cliente S3 configurado
const router = express.Router();

const BUCKET_NAME = process.env.B2_BUCKET_NAME;

router.get("/presign", async (req, res) => {
  try {
    const { ext } = req.query;

    if (!ext) {
      return res.status(400).json({
        error: "Parâmetro 'ext' é obrigatório (ex: wav, mp3, flac)"
      });
    }

    const fileKey = `uploads/${Date.now()}.${ext}`;

    const params = {
      Bucket: BUCKET_NAME,
      Key: fileKey,
      Expires: 600, // 10 minutos
    };

    console.log("📡 [PRESIGN] Gerando URL pré-assinada...");
    console.log("➡️ Bucket:", BUCKET_NAME);
    console.log("➡️ Key:", fileKey);
    console.log("➡️ Endpoint:", process.env.B2_ENDPOINT);
    console.log("➡️ KeyID:", process.env.B2_KEY_ID);

    const uploadUrl = await s3.getSignedUrlPromise("putObject", params);

    console.log("✅ [PRESIGN] URL gerada com sucesso:", uploadUrl.substring(0, 120) + "...");

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
