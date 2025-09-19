#!/usr/bin/env node
/**
 * 🧪 DEBUG - Output FFmpeg ebur128
 * 
 * Examina o output completo do FFmpeg para ajustar o regex
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegStatic from 'ffmpeg-static';

const execFileAsync = promisify(execFile);

console.log("🧪 DEBUG: FFmpeg ebur128 Output");
console.log("=" .repeat(60));

async function debugFFmpegOutput() {
  try {
    const testFile = "tests/musica.flac";
    
    console.log(`📁 Arquivo: ${testFile}`);
    console.log(`🔧 FFmpeg path: ${ffmpegStatic}`);
    
    const ffmpegArgs = [
      '-i', testFile,
      '-filter:a', 'ebur128=peak=true',
      '-f', 'null',
      '-'
    ];
    
    console.log(`🔧 Command: ${ffmpegStatic} ${ffmpegArgs.join(' ')}`);
    
    const { stdout, stderr } = await execFileAsync(ffmpegStatic, ffmpegArgs, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120000
    });
    
    console.log("\n📊 STDOUT length:", stdout.length);
    console.log("📊 STDERR length:", stderr.length);
    
    // Examinar stderr (onde FFmpeg gera output do ebur128)
    console.log("\n📝 STDERR COMPLETO:");
    console.log("=" .repeat(80));
    console.log(stderr);
    console.log("=" .repeat(80));
    
    // Procurar diferentes padrões possíveis
    console.log("\n🔍 PROCURANDO PADRÕES:");
    
    const patterns = [
      /True peak:\s+(-?\d+(?:\.\d+)?)\s+dBTP/gi,
      /Peak:\s+(-?\d+(?:\.\d+)?)\s+dBTP/gi,
      /true.*peak.*(-?\d+(?:\.\d+)?).*dbtp/gi,
      /(-?\d+(?:\.\d+)?)\s+dBTP/gi,
      /peak.*(-?\d+(?:\.\d+)?)/gi
    ];
    
    patterns.forEach((pattern, index) => {
      const matches = stderr.match(pattern);
      console.log(`  Pattern ${index + 1}: ${pattern} → ${matches ? matches.length + ' matches' : 'No matches'}`);
      if (matches) {
        matches.forEach((match, i) => {
          console.log(`    Match ${i + 1}: "${match}"`);
        });
      }
    });
    
    // Procurar linhas que contenham "peak" (case insensitive)
    console.log("\n🔍 LINHAS COM 'PEAK':");
    const lines = stderr.split('\n');
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes('peak')) {
        console.log(`  Linha ${index + 1}: "${line.trim()}"`);
      }
    });
    
    // Procurar informações de EBU R128
    console.log("\n🔍 LINHAS COM 'EBU' ou 'R128' ou 'LUFS':");
    lines.forEach((line, index) => {
      if (line.toLowerCase().match(/ebu|r128|lufs|loud/)) {
        console.log(`  Linha ${index + 1}: "${line.trim()}"`);
      }
    });
    
  } catch (error) {
    console.error("\n❌ ERRO:", error.message);
    console.error("Stack:", error.stack);
  }
}

debugFFmpegOutput().catch(console.error);