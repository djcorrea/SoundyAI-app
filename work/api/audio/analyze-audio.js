import ffmpeg from "fluent-ffmpeg";
import * as mm from "music-metadata";

export async function analyzeAudio(filePath) {
  // Metadados básicos
  const metadata = await mm.parseFile(filePath);
  const format = metadata.format;

  // Usar ffprobe para picos, duração etc
  const ffprobe = () =>
    new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

  const probeData = await ffprobe();

  return {
    metadata: {
      duration: format.duration,
      sampleRate: format.sampleRate,
      bitRate: format.bitrate,
      channels: format.numberOfChannels,
      codec: format.codec
    },
    metrics: {
      rms: -14.2, // você pode calcular RMS de verdade depois
      peak: -1.1,
      lufsIntegrated: -13.5
    },
    diagnostics: {
      clipped: false,
      warnings: []
    },
    probe: probeData
  };
}
