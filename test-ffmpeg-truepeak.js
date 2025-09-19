#!/usr/bin/env node
/**
 * 🧪 TESTE DIRETO - FFmpeg True Peak
 * 
 * Testa diretamente a implementação FFmpeg para True Peak
 */

import { getTruePeakFromFFmpeg, analyzeTruePeaks } from "./work/lib/audio/features/truepeak.js";
import path from 'path';

console.log("🧪 TESTE: FFmpeg True Peak - Implementação Real");
console.log("=" .repeat(60));

async function testFFmpegTruePeak() {
  // Testar com arquivo existente
  const testFile = "tests/musica.flac";
  
  console.log(`📁 Arquivo de teste: ${testFile}`);
  
  try {
    console.log("\n🔧 Testando getTruePeakFromFFmpeg() diretamente...");
    const ffmpegResult = await getTruePeakFromFFmpeg(testFile);
    
    console.log("\n📋 RESULTADO FFMPEG:");
    console.log("  true_peak_dbtp:", ffmpegResult.true_peak_dbtp);
    console.log("  true_peak_linear:", ffmpegResult.true_peak_linear);
    console.log("  processing_time_ms:", ffmpegResult.processing_time_ms);
    console.log("  algorithm:", ffmpegResult.algorithm);
    console.log("  error:", ffmpegResult.error);
    
    console.log("\n🔧 Testando analyzeTruePeaks() com filePath...");
    const analysisResult = await analyzeTruePeaks(testFile);
    
    console.log("\n📋 RESULTADO ANALYSIS:");
    console.log("  true_peak_dbtp:", analysisResult.true_peak_dbtp);
    console.log("  truePeakDbtp:", analysisResult.truePeakDbtp);
    console.log("  maxDbtp:", analysisResult.maxDbtp);
    console.log("  maxLinear:", analysisResult.maxLinear);
    console.log("  _ffmpeg_integration_status:", analysisResult._ffmpeg_integration_status);
    
    // Validações
    console.log("\n✅ VALIDAÇÃO:");
    
    if (ffmpegResult.true_peak_dbtp !== null) {
      console.log("  ✅ FFmpeg executou com sucesso");
      console.log(`  ✅ True Peak: ${ffmpegResult.true_peak_dbtp} dBTP`);
      
      // Verificar se analyzeTruePeaks usa o resultado FFmpeg
      if (analysisResult.true_peak_dbtp === ffmpegResult.true_peak_dbtp) {
        console.log("  ✅ analyzeTruePeaks usa resultado FFmpeg");
      } else {
        console.log("  ❌ analyzeTruePeaks NÃO usa resultado FFmpeg");
      }
      
      // Verificar campos obrigatórios
      const requiredFields = ['truePeakDbtp', 'maxDbtp', 'maxLinear'];
      for (const field of requiredFields) {
        if (field in analysisResult && analysisResult[field] !== null) {
          console.log(`  ✅ Campo '${field}': ${analysisResult[field]}`);
        } else {
          console.log(`  ❌ Campo '${field}': MISSING ou NULL`);
        }
      }
      
    } else {
      console.log("  ❌ FFmpeg falhou");
      console.log("  Erro:", ffmpegResult.error);
      console.log("  Mensagem:", ffmpegResult.error_message);
    }
    
    console.log("\n🎯 CONCLUSÃO:");
    if (ffmpegResult.true_peak_dbtp !== null) {
      console.log("  🟢 SUCESSO: FFmpeg True Peak funcionando!");
      console.log("  📱 Modal receberá valores reais do FFmpeg");
      console.log("  🔧 Implementação ITU-R BS.1770-4 ativa");
    } else {
      console.log("  🔴 PROBLEMA: FFmpeg não conseguiu calcular True Peak");
      console.log("  🔧 Verificar instalação FFmpeg ou formato do arquivo");
    }
    
  } catch (error) {
    console.error("\n❌ ERRO NO TESTE:");
    console.error("  ", error.message);
    console.error("\n📋 Stack Trace:");
    console.error(error.stack);
  }
}

testFFmpegTruePeak().catch(console.error);