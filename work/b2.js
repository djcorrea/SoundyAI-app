import AWS from "aws-sdk";

const s3 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT,          // https://s3.us-east-005.backblazeb2.com
  region: "us-east-005",                      // Região do Backblaze
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,       // seu KeyID
    secretAccessKey: process.env.B2_APPLICATION_KEY, // sua ApplicationKey
  },
});

export default s3;
