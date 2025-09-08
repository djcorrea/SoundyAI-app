import AWS from "aws-sdk";
import dotenv from "dotenv";

// garante que o .env seja carregado antes de usar
dotenv.config();

const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint(process.env.B2_ENDPOINT), // precisa estar com https:// no .env
  region: "us-east-005",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
  signatureVersion: "v4",
  s3ForcePathStyle: false // 👈 força usar virtual-host style (bucket.s3.us-east-005.backblazeb2.com)
});

// Debug
console.log("🔑 [b2.js] Config:", {
  endpoint: process.env.B2_ENDPOINT,
  bucket: process.env.B2_BUCKET_NAME,
});

export default s3;
