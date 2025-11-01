#!/usr/bin/env node

/**
 * 🔧 TESTE DE DOWNLOAD: Verificar se o worker consegue baixar arquivos reais
 */

import "dotenv/config";
import path from 'path';
import fs from 'fs';

// Simular o mesmo processo de download do worker
async function downloadFileFromBucket(fileKey) {
  const { Client } = await import("@aws-sdk/client-s3");
  
  const s3Client = new Client({
    region: process.env.BACKBLAZE_REGION || "us-west-004",
    endpoint: process.env.BACKBLAZE_ENDPOINT || "https://s3.us-west-004.backblazeb2.com",
    credentials: {
      accessKeyId: process.env.BACKBLAZE_ACCESS_KEY_ID,
      secretAccessKey: process.env.BACKBLAZE_SECRET_ACCESS_KEY,
    },
  });

  const bucketName = process.env.BACKBLAZE_BUCKET_NAME || "soundyai";
  const tempDir = path.join(process.cwd(), "temp");
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const localFilePath = path.join(tempDir, `test_${Date.now()}_${path.basename(fileKey)}`);

  try {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const getObjectParams = {
      Bucket: bucketName,
      Key: fileKey,
    };
    
    console.log(`📥 Baixando ${fileKey}...`);
    const response = await s3Client.send(new GetObjectCommand(getObjectParams));
    
    const fileBuffer = Buffer.concat(await response.Body.toArray());
    await fs.promises.writeFile(localFilePath, fileBuffer);
    
    console.log(`✅ Arquivo baixado: ${localFilePath} (${fileBuffer.length} bytes)`);
    return localFilePath;
    
  } catch (error) {
    console.error(`❌ Erro no download de ${fileKey}:`, error.message);
    throw error;
  }
}

async function testDownloads() {
  console.log("🔧 TESTE DE DOWNLOAD: Arquivos Reais");
  console.log("====================================");

  const files = [
    "uploads/DJ_TOPO_QUEM_NAO_QUER_SOU_EU_mastered_1730397160052.wav",
    "uploads/4_Piano_Magico_DJ_Correa_MC_Lipivox_e_MC_Baiano_1730396617014.wav"
  ];

  for (const fileKey of files) {
    try {
      const localPath = await downloadFileFromBucket(fileKey);
      
      // Verificar o arquivo
      const stats = await fs.promises.stat(localPath);
      console.log(`📊 Tamanho: ${stats.size} bytes`);
      
      // Limpar arquivo temporário
      await fs.promises.unlink(localPath);
      console.log(`🗑️ Arquivo temporário removido`);
      
    } catch (error) {
      console.error(`❌ Falha no teste para ${fileKey}:`, error.message);
    }
    
    console.log("");
  }
}

testDownloads().catch(console.error);