// test-pipeline.js - TESTE DE FLUXO COMPLETO DO PIPELINE
// 🧪 Valida criação de job → enfileiramento Redis → processamento → resultado

import { randomUUID } from "crypto";

// Simular uma requisição para a API de análise
async function testJobCreation() {
  console.log("🧪 [TEST] Iniciando teste de criação de job...");
  
  try {
    const testJobData = {
      fileKey: "uploads/test_audio_sample.wav",
      mode: "genre",
      fileName: "test_sample.wav"
    };

    console.log("📤 [TEST] Enviando requisição para API...");
    
    const response = await fetch("http://localhost:3000/api/audio/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(testJobData)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log("✅ [TEST] Job criado com sucesso:");
      console.log("   JobID:", result.jobId);
      console.log("   Status:", result.status);
      console.log("   FileKey:", result.fileKey);
      console.log("   Mode:", result.mode);
      
      // Aguardar alguns segundos para ver se aparece na fila Redis
      console.log("⏳ [TEST] Aguardando job aparecer na fila Redis...");
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      return result.jobId;
    } else {
      console.error("❌ [TEST] Erro na criação do job:", result);
      return null;
    }
  } catch (error) {
    console.error("🚨 [TEST] Erro na requisição:", error.message);
    return null;
  }
}

// Verificar status do job via API
async function checkJobStatus(jobId) {
  console.log(`🔍 [TEST] Verificando status do job: ${jobId}`);
  
  try {
    const response = await fetch(`http://localhost:3000/api/jobs/${jobId}`);
    const result = await response.json();
    
    if (response.ok) {
      console.log(`📊 [TEST] Status atual: ${result.status}`);
      console.log(`⏰ [TEST] Atualizado em: ${result.updatedAt}`);
      
      if (result.status === "completed") {
        console.log("🎉 [TEST] Job processado com sucesso!");
        console.log("📄 [TEST] Resultado disponível:", !!result.result);
      } else if (result.status === "error") {
        console.log("💥 [TEST] Job falhou:", result.error);
      } else if (result.status === "processing") {
        console.log("⚙️ [TEST] Job em processamento...");
      } else {
        console.log("⏳ [TEST] Job aguardando processamento...");
      }
      
      return result;
    } else {
      console.error("❌ [TEST] Erro ao consultar job:", result);
      return null;
    }
  } catch (error) {
    console.error("🚨 [TEST] Erro na consulta:", error.message);
    return null;
  }
}

// Monitorar job até completar ou falhar
async function monitorJob(jobId, maxWaitMinutes = 5) {
  console.log(`👁️ [TEST] Monitorando job ${jobId} por até ${maxWaitMinutes} minutos...`);
  
  const startTime = Date.now();
  const maxWaitTime = maxWaitMinutes * 60 * 1000;
  
  while (Date.now() - startTime < maxWaitTime) {
    const status = await checkJobStatus(jobId);
    
    if (!status) {
      console.log("⚠️ [TEST] Não foi possível verificar status, tentando novamente...");
      await new Promise(resolve => setTimeout(resolve, 10000));
      continue;
    }
    
    if (status.status === "completed") {
      console.log("🎯 [TEST] Job completado com sucesso!");
      return { success: true, status };
    }
    
    if (status.status === "error") {
      console.log("💥 [TEST] Job falhou!");
      return { success: false, status };
    }
    
    // Aguardar 10 segundos antes da próxima verificação
    console.log("⏱️ [TEST] Aguardando 10 segundos para próxima verificação...");
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  
  console.log("⏰ [TEST] Timeout atingido!");
  return { success: false, timeout: true };
}

// Teste principal
async function runPipelineTest() {
  console.log("🚀 [TEST] ===== INICIANDO TESTE DE PIPELINE COMPLETO =====");
  console.log("📋 [TEST] Testando: Criação → Enfileiramento → Processamento → Resultado");
  console.log("");
  
  // 1. Criar job
  const jobId = await testJobCreation();
  if (!jobId) {
    console.log("💥 [TEST] FALHA: Não foi possível criar job");
    return;
  }
  
  console.log("");
  
  // 2. Monitorar processamento
  const result = await monitorJob(jobId);
  
  console.log("");
  console.log("📝 [TEST] ===== RESULTADO FINAL =====");
  
  if (result.success) {
    console.log("✅ [TEST] SUCESSO: Pipeline funcionando corretamente!");
    console.log("🎉 [TEST] Job processado do início ao fim");
  } else if (result.timeout) {
    console.log("⏰ [TEST] TIMEOUT: Job não processou a tempo");
    console.log("🔍 [TEST] Verificar logs dos workers Redis");
  } else {
    console.log("❌ [TEST] FALHA: Job falhou durante processamento");
    console.log("🔍 [TEST] Verificar logs para detalhes do erro");
  }
}

// Executar teste
runPipelineTest().catch(error => {
  console.error("🚨 [TEST] Erro crítico no teste:", error);
});