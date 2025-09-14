// Script para identificar exatamente onde o worker está crashando
require('dotenv').config();

// Simular exatamente o que o worker faz
import('aws-sdk').then(async (AWSModule) => {
  const AWS = AWSModule.default;
  const fs = require('fs');
  const path = require('path');

  console.log('🔍 Simulando download do B2...');
  
  const s3 = new AWS.S3({
    endpoint: process.env.B2_ENDPOINT || "https://s3.us-east-005.backblazeb2.com",
    region: "us-east-005",
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
    signatureVersion: "v4",
  });
  
  const BUCKET_NAME = process.env.B2_BUCKET_NAME;
  
  // Testar download de um arquivo que está falhando
  const testKey = "uploads/1757815772676.wav";
  
  try {
    console.log(`📥 Testando download: ${testKey}`);
    
    const localPath = path.join("./", "test-download.wav");
    
    const downloadPromise = new Promise((resolve, reject) => {
      const write = fs.createWriteStream(localPath);
      const read = s3.getObject({ Bucket: BUCKET_NAME, Key: testKey }).createReadStream();

      const timeout = setTimeout(() => {
        write.destroy();
        read.destroy();
        reject(new Error(`Download timeout após 30 segundos`));
      }, 30000);

      read.on("error", (err) => {
        clearTimeout(timeout);
        console.error("❌ Erro no stream de leitura:", err.message);
        reject(err);
      });
      
      write.on("error", (err) => {
        clearTimeout(timeout);
        console.error("❌ Erro no stream de escrita:", err.message);
        reject(err);
      });
      
      write.on("finish", () => {
        clearTimeout(timeout);
        console.log("✅ Download concluído");
        resolve(localPath);
      });

      read.pipe(write);
    });
    
    const result = await downloadPromise;
    console.log(`✅ Arquivo baixado: ${result}`);
    
    // Verificar tamanho
    const stats = fs.statSync(result);
    console.log(`📊 Tamanho: ${stats.size} bytes`);
    
    // Limpar
    fs.unlinkSync(result);
    console.log("✅ Arquivo de teste removido");
    
  } catch (error) {
    console.error("❌ ERRO NO DOWNLOAD:", error.message);
    console.error("🔍 Stack:", error.stack);
  }
}).catch(err => {
  console.error('❌ Erro ao importar AWS:', err);
});