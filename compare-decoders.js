/**
 * Script comparador entre Web Audio API (frontend) e novo decoder backend
 * Objetivo: validar sampleRate, length, duration e RMS dos arquivos de teste
 */

import fs from "fs";
import path from "path";
import audioDecode from "audio-decode"; // ✅ correto
import { decodeAudioFile } from "./api/audio/audio-decoder.js";

// Função auxiliar para calcular RMS
function calcRMS(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
  }
  return Math.sqrt(sum / data.length);
}

async function compare(filePath) {
  console.log(`\n🔍 Testando arquivo: ${filePath}`);

  // --- Decodificação antiga (simulação Web Audio API)
  const buf = fs.readFileSync(filePath);
  const audioBuffer = await audioDecode(buf);
  const oldData = audioBuffer.getChannelData(0);
  const oldRMS = calcRMS(oldData);

  // --- Decodificação nova (sua função back-end)
  const filename = path.basename(filePath); // extrai o nome do arquivo
  const newDecoded = await decodeAudioFile(buf, filename);
  const newData = newDecoded.data;
  const newRMS = calcRMS(newData);

  // --- Comparações
  console.log("📊 Comparação:");
  console.log(`SampleRate → Antigo: ${audioBuffer.sampleRate}, Novo: ${newDecoded.sampleRate}`);
  console.log(`Channels   → Antigo: ${audioBuffer.numberOfChannels}, Novo: ${newDecoded.numberOfChannels}`);
  console.log(`Length     → Antigo: ${audioBuffer.length}, Novo: ${newDecoded.length}`);
  console.log(`Duration   → Antigo: ${audioBuffer.duration.toFixed(3)}s, Novo: ${newDecoded.duration.toFixed(3)}s`);
  console.log(`RMS        → Antigo: ${oldRMS.toFixed(6)}, Novo: ${newRMS.toFixed(6)}`);

  // --- Critérios de tolerância
  const diffDur = Math.abs(audioBuffer.duration - newDecoded.duration);
  const diffRMS = Math.abs(oldRMS - newRMS);

  if (diffDur <= 0.01 && diffRMS <= 0.001) {
    console.log("✅ Resultado: DECODIFICAÇÃO COMPATÍVEL");
  } else {
    console.log("⚠️ Resultado: DIFERENÇAS DETECTADAS");
  }
}

// Rode para múltiplos arquivos de teste
(async () => {
  const testFiles = [
    "./tests/silencio.wav",
    "./tests/seno-1khz.wav",
    "./tests/musica.flac"
  ];
  for (const f of testFiles) {
    await compare(f);
  }
})();
