import AWS from "aws-sdk";

const s3 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT, // https://s3.us-east-005.backblazeb2.com
  region: "us-east-005",             // Região do Backblaze
  credentials: {
    accessKeyId: process.env.B2_KEY_ID, // KeyID
    secretAccessKey:
      process.env.B2_APPLICATION_KEY || process.env.B2_APP_KEY, 
    // aceita tanto B2_APPLICATION_KEY quanto B2_APP_KEY
  },
  signatureVersion: "v4", // garante compatibilidade com presigned URL
});

export default s3;
