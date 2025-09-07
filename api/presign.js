import express from "express";
import s3 from "./b2.js"; // cliente S3 configurado
const router = express.Router();

const BUCKET_NAME = process.env.B2_BUCKET_NAME;

router.get("/presign", async (req, res) => {
  try {
    const { ext, contentType } = req.query;
    if (!ext || !contentType) {
      return res
        .status(400)
        .json({ error: "Parâmetros ext e contentType são obrigatórios" });
    }

    const fileKey = `uploads/${Date.now()}.${ext}`;

    const params = {
      Bucket: BUCKET_NAME,
      Key: fileKey,
      Expires: 600, // URL válida por 10min
      ContentType: contentType, // 👈 garante match com o frontend
    };

    const uploadUrl = await s3.getSignedUrlPromise("putObject", params);

    // 🔑 força o header correto e responde o JSON
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ uploadUrl, fileKey });
  } catch (err) {
    console.error("❌ Erro ao gerar presign:", err);
    res.status(500).json({
      error: "Erro ao gerar URL pré-assinada",
      details: err.message,
      code: err.code,
    });
  }
});

export default router;
