import AWS from "aws-sdk";
import dotenv from "dotenv";

dotenv.config();

const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint(`https://${process.env.B2_BUCKET_NAME}.s3.us-east-005.backblazeb2.com`), 
  region: "us-east-005",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
  signatureVersion: "v4",
  s3ForcePathStyle: false, // 👈 garante virtual-host
});

// Debug
console.log("🔑 [b2.js] Config:", {
  endpoint: `https://${process.env.B2_BUCKET_NAME}.s3.us-east-005.backblazeb2.com`,
  bucket: process.env.B2_BUCKET_NAME,
});

export default s3;
