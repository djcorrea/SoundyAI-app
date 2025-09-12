/**
 * 🔍 AUDITORIA PROFUNDA: Erro "Malformed Access Key Id"
 * 
 * ANÁLISE DO PROBLEMA:
 * - O erro está acontecendo quando o frontend tenta fazer upload
 * - "Malformed Access Key Id" indica problema com credenciais B2/S3
 * - Pode ser diferença entre .env local vs Railway
 */

import "dotenv/config";
import AWS from "aws-sdk";

console.log("🔍 [AUDITORIA] Iniciando diagnóstico completo do erro Malformed Access Key Id");

// ========== AUDITORIA 1: VERIFICAR VARIÁVEIS DE AMBIENTE ==========
console.log("\n📋 [AUDITORIA 1] Verificando variáveis de ambiente:");
const requiredVars = ['B2_KEY_ID', 'B2_APP_KEY', 'B2_BUCKET_NAME', 'B2_ENDPOINT'];

requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
        console.log(`✅ ${varName}: ${varName.includes('KEY') ? value.substring(0, 8) + '...' : value}`);
    } else {
        console.log(`❌ ${varName}: AUSENTE`);
    }
});

// ========== AUDITORIA 2: TESTAR CONFIGURAÇÃO S3 ==========
console.log("\n🔧 [AUDITORIA 2] Testando configuração S3:");

const s3Config = {
    endpoint: new AWS.Endpoint(process.env.B2_ENDPOINT),
    region: "us-east-005",
    s3ForcePathStyle: true,
    credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APP_KEY,
    },
    signatureVersion: "v4",
};

console.log("📊 Config S3:", {
    endpoint: s3Config.endpoint.hostname,
    region: s3Config.region,
    pathStyle: s3Config.s3ForcePathStyle,
    keyId: s3Config.credentials.accessKeyId ? s3Config.credentials.accessKeyId.substring(0, 8) + "..." : "❌ VAZIO",
    secretKey: s3Config.credentials.secretAccessKey ? "✅ PRESENTE" : "❌ VAZIO"
});

const s3 = new AWS.S3(s3Config);

// ========== AUDITORIA 3: TESTAR PRESIGNED URL ==========
console.log("\n🌐 [AUDITORIA 3] Testando geração de URL pré-assinada:");

async function testPresignedUrl() {
    try {
        const params = {
            Bucket: process.env.B2_BUCKET_NAME,
            Key: `test-audit/${Date.now()}.mp3`,
            Expires: 600,
        };

        console.log("📝 Parâmetros presign:", params);

        const uploadUrl = await s3.getSignedUrlPromise("putObject", params);
        
        console.log("✅ URL gerada com sucesso!");
        console.log("🔗 URL (primeiros 100 chars):", uploadUrl.substring(0, 100) + "...");
        
        // Validar formato da URL
        const url = new URL(uploadUrl);
        console.log("🔍 Análise da URL:");
        console.log("  - Host:", url.hostname);
        console.log("  - Protocol:", url.protocol);
        console.log("  - Pathname:", url.pathname);
        
        // Verificar parâmetros AWS
        const awsParams = ['X-Amz-Algorithm', 'X-Amz-Credential', 'X-Amz-Date', 'X-Amz-SignedHeaders', 'X-Amz-Signature'];
        awsParams.forEach(param => {
            const value = url.searchParams.get(param);
            console.log(`  - ${param}:`, value ? "✅ PRESENTE" : "❌ AUSENTE");
        });

    } catch (error) {
        console.error("❌ Erro ao gerar URL pré-assinada:");
        console.error("  - Message:", error.message);
        console.error("  - Code:", error.code);
        console.error("  - Stack:", error.stack);
    }
}

// ========== AUDITORIA 4: TESTAR ENDPOINT B2 ==========
console.log("\n🌍 [AUDITORIA 4] Testando conectividade com Backblaze B2:");

async function testB2Connection() {
    try {
        const response = await fetch(process.env.B2_ENDPOINT, {
            method: 'HEAD'
        });
        console.log(`✅ B2 Endpoint acessível: ${response.status} ${response.statusText}`);
    } catch (error) {
        console.error("❌ Erro ao conectar com B2:", error.message);
    }
}

// ========== AUDITORIA 5: VERIFICAR FORMATO DAS CREDENCIAIS ==========
console.log("\n🔑 [AUDITORIA 5] Validando formato das credenciais:");

function validateCredentials() {
    const keyId = process.env.B2_KEY_ID;
    const appKey = process.env.B2_APP_KEY;
    
    console.log("🔍 Análise B2_KEY_ID:");
    if (keyId) {
        console.log(`  - Comprimento: ${keyId.length} chars`);
        console.log(`  - Formato: ${keyId.match(/^[0-9a-f]+$/i) ? "✅ Hexadecimal" : "❌ Formato inválido"}`);
        console.log(`  - Primeiros 8 chars: ${keyId.substring(0, 8)}`);
    }
    
    console.log("🔍 Análise B2_APP_KEY:");
    if (appKey) {
        console.log(`  - Comprimento: ${appKey.length} chars`);
        console.log(`  - Formato: ${appKey.match(/^[A-Za-z0-9+/]+$/) ? "✅ Base64-like" : "❌ Formato suspeito"}`);
        console.log(`  - Primeiros 8 chars: ${appKey.substring(0, 8)}`);
    }
}

// ========== AUDITORIA 6: TESTAR LISTAGEM DE BUCKETS ==========
console.log("\n📦 [AUDITORIA 6] Testando listagem de buckets:");

async function testListBuckets() {
    try {
        const result = await s3.listBuckets().promise();
        console.log("✅ Buckets acessíveis:");
        result.Buckets.forEach(bucket => {
            console.log(`  - ${bucket.Name} (${bucket.CreationDate})`);
        });
        
        // Verificar se o bucket alvo existe
        const targetBucket = process.env.B2_BUCKET_NAME;
        const bucketExists = result.Buckets.some(b => b.Name === targetBucket);
        console.log(`🎯 Bucket alvo '${targetBucket}': ${bucketExists ? "✅ EXISTE" : "❌ NÃO ENCONTRADO"}`);
        
    } catch (error) {
        console.error("❌ Erro ao listar buckets:");
        console.error("  - Message:", error.message);
        console.error("  - Code:", error.code);
        
        if (error.code === 'InvalidAccessKeyId') {
            console.error("🚨 PROBLEMA IDENTIFICADO: Access Key inválido");
        }
        if (error.code === 'SignatureDoesNotMatch') {
            console.error("🚨 PROBLEMA IDENTIFICADO: Secret Key inválido");
        }
    }
}

// ========== EXECUTAR TODAS AS AUDITORIAS ==========
async function runFullAudit() {
    try {
        validateCredentials();
        await testB2Connection();
        await testListBuckets();
        await testPresignedUrl();
        
        console.log("\n📊 [RESUMO] Auditoria concluída!");
        console.log("Se ainda houver erro 'Malformed Access Key Id', verifique:");
        console.log("1. Credenciais B2 no Railway vs local");
        console.log("2. Formato das credenciais (sem espaços, caracteres especiais)");
        console.log("3. Permissões do Application Key no Backblaze");
        console.log("4. Endpoint correto para a região");
        
    } catch (error) {
        console.error("❌ Erro durante auditoria:", error);
    }
}

runFullAudit();
