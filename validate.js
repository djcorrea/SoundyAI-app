import fs from "fs";
import path from "path";

// Imports das fases (agora incluindo pipeline completo)
import { processAudioComplete } from "./api/audio/pipeline-complete.js";  // Pipeline Completo 5.1-5.4

const TEST_DIR = path.join(process.cwd(), "tests");

async function validateFile(filePath) {
  console.log(`\n🎵 Testando arquivo: ${path.basename(filePath)}`);

  try {
    // Pipeline completo (Fases 5.1 → 5.2 → 5.3 → 5.4)
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    const result = await processAudioComplete(fileBuffer, fileName);

    // Exibir resultados principais
    console.log("Score Final:", result.score?.toFixed(1) + "%", `(${result.classification})`);
    console.log("Método Scoring:", result.scoringMethod);
    console.log("LUFS:", result.technicalData.lufsIntegrated?.toFixed(2), "LUFS");
    console.log("True Peak:", result.technicalData.truePeakDbtp?.toFixed(2), "dBTP");
    console.log("Correlação Estéreo:", result.technicalData.stereoCorrelation?.toFixed(3));
    console.log("Bandas FFT:", Object.keys(result.technicalData.frequencyBands || {}).length);
    console.log("Tempo Total:", result.metadata.processingTime + "ms");

    // Mostrar breakdown de tempo por fase
    if (result.metadata.phaseBreakdown) {
      const breakdown = result.metadata.phaseBreakdown;
      console.log(`⚡ Breakdown: Dec=${breakdown.phase1_decoding}ms, Seg=${breakdown.phase2_segmentation}ms, Core=${breakdown.phase3_core_metrics}ms, JSON=${breakdown.phase4_json_output}ms`);
    }

    // Mostrar warnings se houver
    if (result.warnings && result.warnings.length > 0) {
      console.log("⚠️ Warnings:", result.warnings.join(', '));
    }

    // Salvar resultado completo
    fs.writeFileSync(
      path.join(TEST_DIR, `${fileName}.complete.json`),
      JSON.stringify(result, null, 2)
    );

    return result;

  } catch (error) {
    console.error(`❌ Erro ao processar ${path.basename(filePath)}:`, error.message);
    return null;
  }
}

async function main() {
  const files = fs.readdirSync(TEST_DIR).filter(f =>
    f.endsWith(".wav") || f.endsWith(".flac")
  );

  for (const file of files) {
    await validateFile(path.join(TEST_DIR, file));
  }

  console.log("\n✅ Testes concluídos!");
}

main().catch(err => console.error("Erro nos testes:", err));
