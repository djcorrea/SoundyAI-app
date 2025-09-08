import AWS from "aws-sdk";
import dotenv from "dotenv";

dotenv.config();

const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint(`https://${process.env.B2_ENDPOINT}`), // Adicionando https://
  region: "us-east-005",
  s3ForcePathStyle: true,  // Força path-style, necessário para o Backblaze
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
  signatureVersion: "v4",
});

// Debug: Mostra informações de configuração para verificação
console.log("🔑 [b2.js] Config:", {
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  bucket: process.env.B2_BUCKET_NAME,
});
// Debug para verificar se as credenciais estão corretas
console.log("🔑 [b2.js] Config carregada:", {
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  bucket: process.env.B2_BUCKET_NAME,
  keyId: process.env.B2_KEY_ID ? process.env.B2_KEY_ID.substring(0, 8) + "..." : "❌ vazio",
  appKey: process.env.B2_APP_KEY ? "✅ presente" : "❌ vazio"
});

export default s3;
