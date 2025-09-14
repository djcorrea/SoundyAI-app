// audit/run-audio-audit.js - Script de Auditoria Não-Invasivo
// FEATURE FLAG: AUDIO_AUDIT_VERBOSE=1 para logs detalhados
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🚩 FEATURE FLAG - Desabilitado por padrão
const AUDIT_ENABLED = process.env.AUDIO_AUDIT_VERBOSE === "1";
const LOG_FILE = path.join(__dirname, "audit.log");

// Logger de auditoria isolado
class AuditLogger {
  constructor() {
    this.logEntries = [];
  }

  log(level, message, data = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      pid: process.pid
    };
    
    this.logEntries.push(entry);
    
    // Console sempre (para stdout)
    const formatted = `[${entry.timestamp}] [${level}] ${message}`;
    console.log(formatted);
    if (data && AUDIT_ENABLED) {
      console.log('  📊 Data:', JSON.stringify(data, null, 2));
    }
    
    // Arquivo apenas se AUDIT_ENABLED
    if (AUDIT_ENABLED) {
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(LOG_FILE, logLine);
    }
  }

  info(message, data) { this.log('INFO', message, data); }
  warn(message, data) { this.log('WARN', message, data); }
  error(message, data) { this.log('ERROR', message, data); }
  
  getEntries() { return this.logEntries; }
}

const auditLogger = new AuditLogger();

// Criar WAV de teste pequeno (1 segundo, 48kHz, estéreo)
function createTestWav() {
  const sampleRate = 48000;
  const duration = 4; // 4 segundos para LUFS válido
  const samples = sampleRate * duration;
  
  // Header WAV (44 bytes)
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + samples * 4, 4); // fileSize
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // subchunk1Size
  header.writeUInt16LE(1, 20); // audioFormat (PCM)
  header.writeUInt16LE(2, 22); // numChannels (stereo)
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 4, 28); // byteRate
  header.writeUInt16LE(4, 32); // blockAlign
  header.writeUInt16LE(16, 34); // bitsPerSample
  header.write('data', 36);
  header.writeUInt32LE(samples * 4, 40); // subchunk2Size
  
  // Data (sine wave 440Hz) - Volume adequado para LUFS
  const data = Buffer.alloc(samples * 4);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.8; // Volume -18 dBFS adequado para LUFS
    const sample16 = Math.round(sample * 32767);
    
    // Left channel
    data.writeInt16LE(sample16, i * 4);
    // Right channel  
    data.writeInt16LE(sample16, i * 4 + 2);
  }
  
  return Buffer.concat([header, data]);
}

// Auditoria completa do pipeline
async function runAudioAudit() {
  auditLogger.info("🔍 INICIANDO AUDITORIA DE ÁUDIO BACKEND", {
    environment: process.env.NODE_ENV || 'development',
    auditVerbose: AUDIT_ENABLED,
    timestamp: Date.now()
  });

  const auditResults = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    },
    phases: {},
    anomalies: [],
    metrics: {},
    fallbackDetected: false,
    errors: []
  };

  try {
    // ===== FASE A: IMPORTAÇÃO DOS MÓDULOS =====
    auditLogger.info("📦 FASE A: Importação dos módulos");
    const moduleImportStart = Date.now();
    
    let processAudioComplete = null;
    try {
      const imported = await import("../work/api/audio/pipeline-complete.js");
      processAudioComplete = imported.processAudioComplete;
      auditLogger.info("✅ Pipeline completo importado");
    } catch (importError) {
      auditLogger.error("❌ Falha ao importar pipeline", { error: importError.message });
      auditResults.errors.push({
        phase: 'module_import',
        error: importError.message,
        critical: true
      });
      return auditResults;
    }
    
    auditResults.phases.moduleImport = {
      success: true,
      timeMs: Date.now() - moduleImportStart
    };

    // ===== FASE B: GERAÇÃO DO ÁUDIO DE TESTE =====
    auditLogger.info("🎵 FASE B: Geração do áudio de teste");
    const testWav = createTestWav();
    auditLogger.info("WAV de teste gerado", {
      sizeBytes: testWav.length,
      expectedSize: 192044 // 44 + 48000*4
    });
    
    auditResults.phases.testGeneration = {
      success: true,
      audioSizeBytes: testWav.length,
      expectedSizeBytes: 192044,
      sizeMatch: testWav.length === 192044
    };

    // ===== FASE C: PROCESSAMENTO PIPELINE =====
    auditLogger.info("🚀 FASE C: Execução do pipeline completo");
    const pipelineStart = Date.now();
    
    let pipelineResult = null;
    let pipelineError = null;
    
    try {
      pipelineResult = await processAudioComplete(testWav, "audit-test.wav", {
        jobId: "audit-" + Date.now(),
        reference: null
      });
      
      const pipelineTime = Date.now() - pipelineStart;
      auditLogger.info("✅ Pipeline executado com sucesso", { timeMs: pipelineTime });
      
      auditResults.phases.pipelineExecution = {
        success: true,
        timeMs: pipelineTime,
        hasResult: !!pipelineResult
      };
      
    } catch (error) {
      pipelineError = error;
      auditLogger.error("❌ Pipeline falhou", { 
        error: error.message,
        stack: AUDIT_ENABLED ? error.stack : undefined
      });
      
      auditResults.phases.pipelineExecution = {
        success: false,
        timeMs: Date.now() - pipelineStart,
        error: error.message
      };
      
      auditResults.errors.push({
        phase: 'pipeline_execution',
        error: error.message,
        critical: true
      });
    }

    // ===== FASE D: ANÁLISE DO RESULTADO =====
    if (pipelineResult) {
      auditLogger.info("📊 FASE D: Análise do resultado");
      
      // Verificar se caiu em fallback
      const isFallback = 
        pipelineResult.mode === 'fallback_metadata' ||
        pipelineResult.scoringMethod?.includes('fallback') ||
        pipelineResult.usedFallback === true ||
        pipelineResult._worker?.error === true;

      auditResults.fallbackDetected = isFallback;
      
      if (isFallback) {
        auditLogger.warn("⚠️ FALLBACK DETECTADO", {
          mode: pipelineResult.mode,
          scoringMethod: pipelineResult.scoringMethod,
          workerError: pipelineResult._worker?.error
        });
        
        auditResults.anomalies.push({
          type: 'fallback_detected',
          description: 'Pipeline caiu em fallback',
          evidence: {
            mode: pipelineResult.mode,
            scoringMethod: pipelineResult.scoringMethod,
            workerError: pipelineResult._worker?.error
          },
          severity: 'HIGH'
        });
      }

      // Extrair métricas brutas
      const technicalData = pipelineResult.technicalData || {};
      auditResults.metrics = {
        lufs: technicalData.lufs,
        truePeak: technicalData.truePeak,
        spectralBalance: technicalData.spectralBalance,
        score: pipelineResult.score,
        classification: pipelineResult.classification
      };

      // Verificar métricas suspeitas
      if (technicalData.lufs === undefined || technicalData.lufs === null) {
        auditResults.anomalies.push({
          type: 'missing_lufs',
          description: 'LUFS não calculado',
          severity: 'HIGH'
        });
      }
      
      if (technicalData.truePeak === undefined || technicalData.truePeak === null) {
        auditResults.anomalies.push({
          type: 'missing_truepeak', 
          description: 'True Peak não calculado',
          severity: 'HIGH'
        });
      }

      if (typeof technicalData.lufs === 'number' && technicalData.lufs === -60) {
        auditResults.anomalies.push({
          type: 'sentinel_lufs',
          description: 'LUFS com valor sentinela (-60 dB)',
          evidence: { lufs: technicalData.lufs },
          severity: 'MEDIUM'
        });
      }

      auditLogger.info("📈 Métricas extraídas", auditResults.metrics);
    }

    // ===== FASE E: VERIFICAÇÃO DE AMBIENTE =====
    auditLogger.info("🔧 FASE E: Verificação de ambiente");
    auditResults.environment.variables = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      B2_KEY_ID: !!process.env.B2_KEY_ID,
      B2_APP_KEY: !!process.env.B2_APP_KEY,
      B2_BUCKET_NAME: !!process.env.B2_BUCKET_NAME,
      NODE_ENV: process.env.NODE_ENV,
      AUDIO_AUDIT_VERBOSE: process.env.AUDIO_AUDIT_VERBOSE
    };

  } catch (criticalError) {
    auditLogger.error("💀 ERRO CRÍTICO NA AUDITORIA", { 
      error: criticalError.message,
      stack: AUDIT_ENABLED ? criticalError.stack : undefined
    });
    
    auditResults.errors.push({
      phase: 'critical_error',
      error: criticalError.message,
      critical: true
    });
  }

  // ===== RESULTADOS FINAIS =====
  auditResults.summary = {
    totalPhases: Object.keys(auditResults.phases).length,
    successfulPhases: Object.values(auditResults.phases).filter(p => p.success).length,
    totalAnomalies: auditResults.anomalies.length,
    highSeverityAnomalies: auditResults.anomalies.filter(a => a.severity === 'HIGH').length,
    fallbackDetected: auditResults.fallbackDetected,
    hasErrors: auditResults.errors.length > 0
  };

  auditLogger.info("🎯 AUDITORIA CONCLUÍDA", auditResults.summary);
  
  return auditResults;
}

// Executar apenas se chamado diretamente ou com flag
if (import.meta.url === `file://${process.argv[1]}` || AUDIT_ENABLED) {
  runAudioAudit()
    .then((results) => {
      console.log("\n" + "=".repeat(60));
      console.log("📋 RELATÓRIO DE AUDITORIA");
      console.log("=".repeat(60));
      console.log(JSON.stringify(results, null, 2));
      
      if (AUDIT_ENABLED) {
        console.log(`\n📄 Log detalhado salvo em: ${LOG_FILE}`);
      }
      
      process.exit(results.hasErrors ? 1 : 0);
    })
    .catch((error) => {
      console.error('❌ ERRO CRÍTICO:', error);
      process.exit(1);
    });
}

export { runAudioAudit, AuditLogger };