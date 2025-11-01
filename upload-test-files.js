// upload-test-files.js - Upload de arquivos de teste para o bucket
import "dotenv/config";
import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import fs from "fs";

const s3 = new S3Client({
  endpoint: process.env.B2_ENDPOINT || "https://s3.us-east-005.backblazeb2.com",
  region: "us-east-005",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME;

async function listExistingFiles() {
  console.log("📋 Listando arquivos existentes no bucket...\n");
  
  try {
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: "uploads/",
      MaxKeys: 20
    }));

    if (result.Contents && result.Contents.length > 0) {
      console.log(`✅ Encontrados ${result.Contents.length} arquivos:\n`);
      result.Contents.forEach(obj => {
        const sizeMB = (obj.Size / 1024 / 1024).toFixed(2);
        console.log(`   - ${obj.Key} (${sizeMB} MB)`);
      });
      return result.Contents;
    } else {
      console.log("⚠️ Nenhum arquivo encontrado no bucket");
      return [];
    }
  } catch (error) {
    console.error("❌ Erro ao listar arquivos:", error.message);
    return [];
  }
}

listExistingFiles();
