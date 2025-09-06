import fs from "fs";
import path from "path";

// Imports das fases
import decodeAudioFile from "./api/audio/audio-decoder.js";              // Fase 5.1 (default export)
import { segmentAudioTemporal } from "./api/audio/temporal-segmentation.js"; // Fase 5.2
import { calculateCoreMetrics } from "./api/audio/core-metrics.js";     // Fase 5.3

const TEST_DIR = path.join(process.cwd(), "tests");

async function validateFile(filePath) {
  console.log(`\n🎵 Testando arquivo: ${path.basename(filePath)}`);

  // 1) Decodificação (Fase 5.1)
  const fileBuffer = fs.readFileSync(filePath);
  const audioData = await decodeAudioFile(fileBuffer, path.basename(filePath));

  // 2) Segmentação temporal (Fase 5.2)
  const segmentedData = segmentAudioTemporal(audioData);

  console.log(`FFT Frames: ${segmentedData.framesFFT.left.length}`);
  console.log(`FFT Frame size: ${segmentedData.framesFFT.frameSize}`);
  console.log(`RMS Frames: ${segmentedData.framesRMS.left.length}`);
  console.log(`RMS Frame size: ${segmentedData.framesRMS.frameSize}`);

  // 3) Métricas core (Fase 5.3)
  const metrics = await calculateCoreMetrics(segmentedData);

  console.log("LUFS:", metrics.lufs.integrated?.toFixed(2), "LUFS");
  console.log("True Peak:", metrics.truePeak.maxDbtp?.toFixed(2), "dBTP");
  console.log("Spectral Bands:", metrics.fft.frequencyBands.left);
  console.log("Stereo Width:", metrics.truePeak.channels.left.peakDbtp, "/", metrics.truePeak.channels.right.peakDbtp);

  // 4) Salvar saída JSON para conferência
  fs.writeFileSync(
    path.join(TEST_DIR, `${path.basename(filePath)}.json`),
    JSON.stringify(metrics, null, 2)
  );
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
