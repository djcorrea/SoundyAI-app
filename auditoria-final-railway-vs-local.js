/**
 * 🚨 AUDITORIA FINAL: Railway vs Local
 * 
 * Descobrir por que o Railway sempre usa fallback mas local funciona
 */

console.log("🚨 [AUDITORIA FINAL] Analisando diferenças Railway vs Local...");

console.log("\n📊 ENVIRONMENT VARIABLES:");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);
console.log("B2_KEY_ID exists:", !!process.env.B2_KEY_ID);
console.log("B2_APP_KEY exists:", !!process.env.B2_APP_KEY);
console.log("B2_BUCKET_NAME:", process.env.B2_BUCKET_NAME);
console.log("B2_ENDPOINT:", process.env.B2_ENDPOINT);

console.log("\n🔍 POSSÍVEIS CAUSAS DO FALLBACK NO RAILWAY:");

console.log("\n1️⃣ ERRO DE IMPORTAÇÃO:");
console.log("   - music-metadata pode estar faltando no Railway");
console.log("   - AWS SDK pode ter erro de versão");
console.log("   - Timeout de rede S3");

console.log("\n2️⃣ ERRO DE EXECUÇÃO:");
console.log("   - Pipeline pode estar falhando silenciosamente");
console.log("   - Erro de memória (áudios grandes)");
console.log("   - Timeout de processamento");

console.log("\n3️⃣ ERRO DE CONFIGURAÇÃO:");
console.log("   - S3 endpoint diferente"); 
console.log("   - Credenciais Railway vs Local");

// Testar importações críticas
console.log("\n🧪 TESTANDO IMPORTAÇÕES:");

try {
    const AWS = await import("aws-sdk");
    console.log("✅ AWS SDK importado com sucesso");
} catch (error) {
    console.log("❌ AWS SDK erro:", error.message);
}

try {
    const mm = await import("music-metadata");
    console.log("✅ music-metadata importado com sucesso");
} catch (error) {
    console.log("❌ music-metadata erro:", error.message);
}

// Simular exatamente o que acontece no Railway
console.log("\n🔧 SIMULANDO EXATAMENTE O RAILWAY:");

// Reproduzir o bloco try-catch do index.js
async function simulateRailwayExecution() {
    const job = {
        id: "railway-test",
        file_key: "uploads/1757641137308.wav",
        filename: "test.wav"
    };
    
    // Simular variável processAudioComplete
    let processAudioComplete = null;
    
    // Definir função (como no Railway)
    async function simulateCompleteAnalysis(audioBuffer, filename, genre) {
        console.log("🎯 [RAILWAY-SIM] Executando pipeline...");
        
        // POSSÍVEL PONTO DE FALHA: Timeout ou erro silencioso
        throw new Error("Simulated Railway failure");
        
        return { status: "success" };
    }
    
    processAudioComplete = simulateCompleteAnalysis;
    
    console.log("processAudioComplete definido:", !!processAudioComplete);
    
    // Tentar executar (como no Railway)
    let result;
    
    try {
        if (processAudioComplete) {
            console.log("🎯 Usando pipeline completo");
            
            // Simular dados
            const audioBuffer = Buffer.alloc(1000000); // 1MB
            
            result = await processAudioComplete(audioBuffer, job.filename, "electronic");
            
            console.log("✅ Pipeline completo processou com sucesso");
        } else {
            throw new Error("processAudioComplete não definido");
        }
        
    } catch (error) {
        console.error("❌ ERRO capturado (Railway behavior):", error.message);
        
        console.log("⚠️ Caindo para fallback metadata...");
        
        // Fallback (exatamente como Railway faz)
        result = {
            ok: true,
            file: job.file_key,
            mode: "fallback_metadata",
            score: 50,
            status: "success",
            warnings: ["Pipeline completo indisponível. Resultado mínimo via metadata."],
            usedFallback: true,
            scoringMethod: "error_fallback",
            technicalData: {
                bitrate: 1411200,
                channels: 2,
                sampleRate: 44100,
                durationSec: 112.61
            },
            classification: "Básico",
            frontendCompatible: true
        };
    }
    
    return result;
}

const railwayResult = await simulateRailwayExecution();

console.log("\n📊 RESULTADO RAILWAY SIMULADO:");
console.log(JSON.stringify(railwayResult, null, 2));

console.log("\n🎯 CONCLUSÕES:");
console.log("1. Railway está executando fallback por algum erro silencioso");
console.log("2. Local funciona porque não há o erro específico do Railway");
console.log("3. Precisamos investigar logs do Railway para ver o erro real");

console.log("\n🔧 CORREÇÃO SUGERIDA:");
console.log("1. Adicionar logs detalhados no index.js Railway");
console.log("2. Capturar erro específico que causa fallback"); 
console.log("3. Verificar se é timeout, memória ou importação");
console.log("4. Implementar retry logic ou fix específico");
