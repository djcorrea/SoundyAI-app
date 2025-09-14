// Testar diferentes formatos de endpoint B2
require('dotenv').config();

async function testB2Formats() {
  const AWS = (await import('aws-sdk')).default;
  
  const configs = [
    {
      name: "Com https://",
      endpoint: "https://s3.us-east-005.backblazeb2.com"
    },
    {
      name: "Sem https://",
      endpoint: "s3.us-east-005.backblazeb2.com"
    },
    {
      name: "Formato da variável do Railway",
      endpoint: process.env.B2_ENDPOINT
    }
  ];
  
  for (const config of configs) {
    console.log(`\n🔍 Testando: ${config.name}`);
    console.log(`   Endpoint: ${config.endpoint}`);
    
    try {
      const s3 = new AWS.S3({
        endpoint: config.endpoint,
        region: "us-east-005",
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APP_KEY,
        signatureVersion: "v4",
      });
      
      console.log(`   Key ID: ${process.env.B2_KEY_ID}`);
      console.log(`   App Key: ${process.env.B2_APP_KEY?.substring(0,10)}...`);
      
      // Teste simples: listar objetos
      const result = await s3.listObjects({ 
        Bucket: process.env.B2_BUCKET_NAME,
        MaxKeys: 1 
      }).promise();
      
      console.log(`   ✅ SUCESSO! Objects: ${result.Contents?.length || 0}`);
      
    } catch (error) {
      console.log(`   ❌ ERRO: ${error.message}`);
    }
  }
}

testB2Formats();