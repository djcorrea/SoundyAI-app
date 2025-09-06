// 🎯 BACKEND AUDIO PROCESSING API
// Endpoints para processamento de áudio sem Web Audio API
// Implementação das Fases 5.1-5.5 no backend Node.js

import express from "express";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🏪 ARMAZENAMENTO EM MEMÓRIA (substituir por Redis em produção)
const jobsStore = new Map();
const filesStore = new Map();

// 🔧 CONFIGURAÇÕES
const AUDIO_CONFIG = {
  maxFileSize: 60 * 1024 * 1024, // 60MB
  allowedFormats: ['.wav', '.flac', '.mp3', '.m4a'],
  uploadTimeout: 300000, // 5 minutos
  processingTimeout: 300000, // 5 minutos
  tempDir: path.join(__dirname, '..', 'temp', 'audio'),
  mockResults: true // Usar resultados mockados por enquanto
};

// 🔧 GARANTIR DIRETÓRIO TEMP
async function ensureTempDir() {
  try {
    await fs.mkdir(AUDIO_CONFIG.tempDir, { recursive: true });
  } catch (error) {
    console.warn('⚠️ Erro ao criar diretório temp:', error.message);
  }
}

// 🎯 ENDPOINT 1: POST /presign
// Gerar URL presignada para upload de arquivo
router.post('/presign', async (req, res) => {
  console.log('📤 POST /presign - Gerando URL presignada');
  
  try {
    const { fileName, fileSize, contentType } = req.body;
    
    // Validações
    if (!fileName || typeof fileName !== 'string') {
      return res.status(400).json({ 
        error: 'Nome do arquivo é obrigatório' 
      });
    }
    
    if (!fileSize || fileSize > AUDIO_CONFIG.maxFileSize) {
      return res.status(400).json({ 
        error: `Arquivo muito grande. Máximo: ${Math.round(AUDIO_CONFIG.maxFileSize / 1024 / 1024)}MB` 
      });
    }
    
    // Verificar extensão
    const ext = path.extname(fileName).toLowerCase();
    if (!AUDIO_CONFIG.allowedFormats.includes(ext)) {
      return res.status(400).json({ 
        error: `Formato não suportado. Use: ${AUDIO_CONFIG.allowedFormats.join(', ')}` 
      });
    }
    
    // Gerar chave única
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const fileKey = `audio_${timestamp}_${random}${ext}`;
    
    // Para desenvolvimento, usar URL mock do próprio servidor
    const uploadUrl = `${req.protocol}://${req.get('host')}/api/audio/upload/${fileKey}`;
    
    // Armazenar metadata do arquivo
    filesStore.set(fileKey, {
      originalName: fileName,
      size: fileSize,
      contentType: contentType || 'audio/wav',
      uploadUrl,
      status: 'pending_upload',
      createdAt: new Date().toISOString()
    });
    
    console.log(`✅ URL presignada gerada: ${fileKey}`);
    
    res.json({
      uploadUrl,
      fileKey,
      expiresIn: 3600 // 1 hora
    });
    
  } catch (error) {
    console.error('❌ Erro em /presign:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});

// 🎯 ENDPOINT AUXILIAR: PUT /upload/:fileKey
// Receber o arquivo uploadado (mock do S3)
router.put('/upload/:fileKey', async (req, res) => {
  console.log(`📥 PUT /upload/${req.params.fileKey} - Recebendo arquivo`);
  
  try {
    const { fileKey } = req.params;
    const fileMetadata = filesStore.get(fileKey);
    
    if (!fileMetadata) {
      return res.status(404).json({ 
        error: 'Chave de arquivo não encontrada' 
      });
    }
    
    // Garantir diretório temp
    await ensureTempDir();
    
    // Simular salvamento do arquivo
    const filePath = path.join(AUDIO_CONFIG.tempDir, fileKey);
    
    // Em um ambiente real, você salvaria o arquivo aqui
    // Por enquanto, apenas marcar como uploaded
    fileMetadata.status = 'uploaded';
    fileMetadata.filePath = filePath;
    fileMetadata.uploadedAt = new Date().toISOString();
    
    console.log(`✅ Arquivo simulado como uploaded: ${fileKey}`);
    
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Erro em /upload:', error);
    res.status(500).json({ 
      error: 'Erro no upload' 
    });
  }
});

// 🎯 ENDPOINT 2: POST /process
// Iniciar processamento de áudio
router.post('/process', async (req, res) => {
  console.log('⚡ POST /process - Iniciando processamento');
  
  try {
    const { fileKey, options = {} } = req.body;
    
    // Validações
    if (!fileKey || typeof fileKey !== 'string') {
      return res.status(400).json({ 
        error: 'Chave do arquivo é obrigatória' 
      });
    }
    
    const fileMetadata = filesStore.get(fileKey);
    if (!fileMetadata) {
      return res.status(404).json({ 
        error: 'Arquivo não encontrado' 
      });
    }
    
    if (fileMetadata.status !== 'uploaded') {
      return res.status(400).json({ 
        error: 'Arquivo ainda não foi uploadado' 
      });
    }
    
    // Gerar ID do job
    const jobId = crypto.randomUUID();
    
    // Criar job de processamento
    const job = {
      id: jobId,
      fileKey,
      status: 'pending',
      progress: 0,
      options: {
        enableConcurrency: options.enableConcurrency !== false,
        timeout: options.timeout || AUDIO_CONFIG.processingTimeout,
        outputFormat: options.outputFormat || 'json',
        ...options
      },
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null,
      result: null
    };
    
    // Armazenar job
    jobsStore.set(jobId, job);
    
    // Iniciar processamento assíncrono
    processAudioJob(jobId).catch(error => {
      console.error(`❌ Erro no processamento do job ${jobId}:`, error);
      const job = jobsStore.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error.message;
        job.completedAt = new Date().toISOString();
      }
    });
    
    console.log(`✅ Job criado: ${jobId}`);
    
    res.json({
      jobId,
      status: 'pending',
      estimatedTime: '30-60 segundos'
    });
    
  } catch (error) {
    console.error('❌ Erro em /process:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});

// 🎯 ENDPOINT 3: GET /jobs/:id
// Consultar status do job
router.get('/jobs/:id', (req, res) => {
  console.log(`📊 GET /jobs/${req.params.id} - Consultando status`);
  
  try {
    const { id } = req.params;
    const job = jobsStore.get(id);
    
    if (!job) {
      return res.status(404).json({ 
        error: 'Job não encontrado' 
      });
    }
    
    // Preparar resposta
    const response = {
      id: job.id,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt
    };
    
    // Incluir resultado se completo
    if (job.status === 'completed' && job.result) {
      response.result = job.result;
    }
    
    // Incluir erro se falhou
    if (job.status === 'failed' && job.error) {
      response.error = job.error;
    }
    
    console.log(`📊 Status do job ${id}: ${job.status}`);
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Erro em /jobs/:id:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});

// 🔧 FUNÇÃO DE PROCESSAMENTO DE ÁUDIO
async function processAudioJob(jobId) {
  console.log(`🎵 Iniciando processamento do job: ${jobId}`);
  
  const job = jobsStore.get(jobId);
  if (!job) {
    throw new Error('Job não encontrado');
  }
  
  try {
    // Atualizar status
    job.status = 'processing';
    job.startedAt = new Date().toISOString();
    job.progress = 10;
    
    // Simular fases do processamento
    await simulateProcessingPhases(job);
    
    // Gerar resultado mockado (substituir por pipeline real)
    const result = await generateMockResult(job);
    
    // Concluir job
    job.status = 'completed';
    job.result = result;
    job.progress = 100;
    job.completedAt = new Date().toISOString();
    
    console.log(`✅ Job ${jobId} processado com sucesso`);
    
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    job.completedAt = new Date().toISOString();
    throw error;
  }
}

// 🎭 SIMULAR FASES DE PROCESSAMENTO
async function simulateProcessingPhases(job) {
  const phases = [
    { name: 'Decodificação (Fase 5.1)', progress: 20, duration: 1000 },
    { name: 'Simulação temporal (Fase 5.2)', progress: 40, duration: 1500 },
    { name: 'Métricas core (Fase 5.3)', progress: 70, duration: 2000 },
    { name: 'Saída JSON + Scoring (Fase 5.4)', progress: 90, duration: 1000 },
    { name: 'Concorrência finalizada (Fase 5.5)', progress: 95, duration: 500 }
  ];
  
  for (const phase of phases) {
    console.log(`🔄 ${job.id}: ${phase.name}`);
    job.progress = phase.progress;
    await new Promise(resolve => setTimeout(resolve, phase.duration));
  }
}

// 🎭 GERAR RESULTADO MOCKADO
async function generateMockResult(job) {
  const fileMetadata = filesStore.get(job.fileKey);
  
  // Simular métricas realistas
  const baseScore = 7.2 + Math.random() * 2.3; // 7.2 - 9.5
  
  return {
    // Score principal
    score: Math.round(baseScore * 10) / 10,
    classification: getClassificationFromScore(baseScore),
    scoringMethod: 'Equal Weight V3',
    buildVersion: 'backend-v5.5',
    pipelineVersion: 'Node.js 5.1-5.5',
    
    // Dados técnicos
    technicalData: {
      // LUFS (ITU-R BS.1770-4)
      lufsIntegrated: -14.2 + (Math.random() - 0.5) * 6, // -17.2 a -11.2
      lufsShortTerm: -13.8 + (Math.random() - 0.5) * 5,
      lufsMomentary: -12.5 + (Math.random() - 0.5) * 7,
      lra: 3.2 + Math.random() * 8, // 3.2 - 11.2 LU
      
      // True Peak (oversampling 4x)
      truePeakDbtp: -1.2 + (Math.random() - 0.5) * 2.5, // -2.45 a 0.05
      truePeakLinear: 0.85 + Math.random() * 0.14, // 0.85 - 0.99
      
      // Análise estéreo
      stereoCorrelation: 0.75 + Math.random() * 0.24, // 0.75 - 0.99
      stereoWidth: 0.8 + Math.random() * 0.19, // 0.8 - 0.99
      balanceLR: (Math.random() - 0.5) * 0.1, // -0.05 a 0.05
      
      // Bandas espectrais (simuladas)
      bandEnergies: {
        subBass: Math.random() * 0.3,
        bass: 0.4 + Math.random() * 0.4,
        lowMid: 0.5 + Math.random() * 0.3,
        mid: 0.6 + Math.random() * 0.25,
        highMid: 0.45 + Math.random() * 0.35,
        presence: 0.3 + Math.random() * 0.4,
        brilliance: 0.25 + Math.random() * 0.35
      },
      
      // Metadata
      sampleRate: 48000,
      channels: 2,
      bitDepth: 24
    },
    
    // Metadata do processamento
    metadata: {
      fileName: fileMetadata.originalName,
      fileSize: fileMetadata.size,
      processingTime: 2500 + Math.random() * 2000, // 2.5-4.5s
      duration: 180 + Math.random() * 120, // 3-5 minutos
      phases: ['5.1', '5.2', '5.3', '5.4', '5.5'],
      concurrencyUsed: job.options.enableConcurrency
    },
    
    // Timestamp
    analyzedAt: new Date().toISOString()
  };
}

// 🏷️ CLASSIFICAÇÃO BASEADA NO SCORE
function getClassificationFromScore(score) {
  if (score >= 9.0) return 'Excelente';
  if (score >= 8.0) return 'Muito Bom';
  if (score >= 7.0) return 'Bom';
  if (score >= 6.0) return 'Regular';
  if (score >= 5.0) return 'Baixo';
  return 'Crítico';
}

// 🧹 LIMPEZA PERIÓDICA (remover jobs antigos)
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 horas
  
  let removedJobs = 0;
  let removedFiles = 0;
  
  // Limpar jobs antigos
  for (const [jobId, job] of jobsStore.entries()) {
    const jobAge = now - new Date(job.createdAt).getTime();
    if (jobAge > maxAge) {
      jobsStore.delete(jobId);
      removedJobs++;
    }
  }
  
  // Limpar arquivos antigos
  for (const [fileKey, file] of filesStore.entries()) {
    const fileAge = now - new Date(file.createdAt).getTime();
    if (fileAge > maxAge) {
      filesStore.delete(fileKey);
      removedFiles++;
    }
  }
  
  if (removedJobs > 0 || removedFiles > 0) {
    console.log(`🧹 Limpeza: ${removedJobs} jobs, ${removedFiles} arquivos removidos`);
  }
}, 60 * 60 * 1000); // A cada hora

// 📊 ENDPOINT DE STATUS DO SISTEMA
router.get('/status', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    pipeline: 'Node.js 5.1-5.5',
    activeJobs: jobsStore.size,
    activeFiles: filesStore.size,
    config: {
      maxFileSize: AUDIO_CONFIG.maxFileSize,
      allowedFormats: AUDIO_CONFIG.allowedFormats,
      mockResults: AUDIO_CONFIG.mockResults
    },
    uptime: process.uptime()
  });
});

console.log('🎵 Audio Processing API carregada');
console.log('📋 Endpoints disponíveis:');
console.log('   POST /api/audio/presign - Gerar URL presignada');
console.log('   POST /api/audio/process - Iniciar processamento');
console.log('   GET /api/audio/jobs/:id - Consultar status');
console.log('   GET /api/audio/status - Status do sistema');

export default router;
