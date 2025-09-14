#!/usr/bin/env node
// test-audit.js - Execução rápida da auditoria
import "dotenv/config";
import { runAudioAudit } from "./run-audio-audit.js";

console.log("🚀 Executando auditoria de áudio backend...\n");

try {
  const results = await runAudioAudit();
  
  console.log("\n" + "=".repeat(50));
  console.log("📊 RESUMO EXECUTIVO");
  console.log("=".repeat(50));
  
  const { summary } = results;
  
  console.log(`✅ Fases executadas: ${summary.successfulPhases}/${summary.totalPhases}`);
  console.log(`⚠️  Anomalias encontradas: ${summary.totalAnomalies}`);
  console.log(`🔥 Anomalias críticas: ${summary.highSeverityAnomalies}`);
  console.log(`🚨 Fallback detectado: ${summary.fallbackDetected ? 'SIM' : 'NÃO'}`);
  console.log(`❌ Erros encontrados: ${results.errors.length}`);
  
  if (summary.fallbackDetected) {
    console.log("\n🚨 ATENÇÃO: Pipeline caiu em fallback!");
    console.log("Causas detectadas:");
    results.anomalies
      .filter(a => a.type.includes('fallback'))
      .forEach(anomaly => {
        console.log(`  - ${anomaly.description}`);
        if (anomaly.evidence) {
          console.log(`    Evidência: ${JSON.stringify(anomaly.evidence)}`);
        }
      });
  }
  
  if (summary.highSeverityAnomalies > 0) {
    console.log("\n⚠️ ANOMALIAS CRÍTICAS:");
    results.anomalies
      .filter(a => a.severity === 'HIGH')
      .forEach(anomaly => {
        console.log(`  - ${anomaly.description}`);
      });
  }
  
  console.log("\n📈 MÉTRICAS CALCULADAS:");
  const { metrics } = results;
  console.log(`  LUFS: ${metrics.lufs ?? 'NÃO CALCULADO'}`);
  console.log(`  True Peak: ${metrics.truePeak ?? 'NÃO CALCULADO'}`);
  console.log(`  Score: ${metrics.score ?? 'NÃO CALCULADO'}`);
  console.log(`  Classificação: ${metrics.classification ?? 'NÃO CALCULADA'}`);
  
  console.log("\n🎯 DIAGNÓSTICO:");
  if (!summary.fallbackDetected && summary.highSeverityAnomalies === 0) {
    console.log("✅ Pipeline funcionando corretamente!");
  } else {
    console.log("❌ Pipeline com problemas detectados.");
    console.log("Recomendação: Investigar logs detalhados com AUDIO_AUDIT_VERBOSE=1");
  }
  
  process.exit(summary.fallbackDetected || summary.highSeverityAnomalies > 0 ? 1 : 0);
  
} catch (error) {
  console.error("💀 ERRO CRÍTICO NA AUDITORIA:");
  console.error(error.message);
  console.error("\nStack trace:");
  console.error(error.stack);
  process.exit(1);
}