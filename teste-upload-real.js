/**
 * 🧪 TESTE REAL: Upload via URL pré-assinada
 * Simula exatamente o que o frontend faz
 */

import "dotenv/config";
import AWS from "aws-sdk";
import fs from "fs";

const s3 = new AWS.S3({
    endpoint: new AWS.Endpoint(process.env.B2_ENDPOINT),
    region: "us-east-005", 
    s3ForcePathStyle: true,
    credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APP_KEY,
    },
    signatureVersion: "v4",
});

async function testRealUpload() {
    try {
        console.log("🧪 [TESTE] Simulando upload via URL pré-assinada...");
        
        // 1. Gerar URL pré-assinada
        const params = {
            Bucket: process.env.B2_BUCKET_NAME,
            Key: `test-uploads/teste-${Date.now()}.txt`,
            Expires: 600,
        };
        
        const uploadUrl = await s3.getSignedUrlPromise("putObject", params);
        console.log("✅ URL pré-assinada gerada");
        
        // 2. Criar arquivo de teste
        const testContent = `Teste de upload - ${new Date().toISOString()}`;
        
        // 3. Fazer upload via fetch (como o frontend faz)
        const response = await fetch(uploadUrl, {
            method: "PUT",
            body: testContent,
            headers: {
                'Content-Type': 'text/plain'
            }
        });
        
        console.log("📤 Upload realizado:");
        console.log("  - Status:", response.status);
        console.log("  - StatusText:", response.statusText);
        console.log("  - Headers:", Object.fromEntries(response.headers.entries()));
        
        if (response.ok) {
            console.log("🎉 SUCESSO! Upload funcionando corretamente");
            console.log("✅ O erro 'Malformed Access Key Id' foi resolvido");
        } else {
            const errorText = await response.text();
            console.log("❌ Erro no upload:", errorText);
        }
        
    } catch (error) {
        console.error("❌ Erro durante teste:", error);
    }
}

testRealUpload();
