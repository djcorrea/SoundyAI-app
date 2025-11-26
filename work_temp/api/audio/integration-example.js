/**
 * Exemplo de Integração - Audio Decoder + Pipeline (5.1 + 5.2 + 5.3)
 *
 * Integra o novo pipeline backend (decodificação + segmentação + métricas)
 * Mantém compatibilidade total com o frontend existente
 */

import { processAudioWithCoreMetrics } from './core-metrics.js';

/**
 * Integrar decoder com o sistema de análise existente
 *
 * Substitui decodeAudioData do frontend pelo pipeline backend
 */
async function integrateWithExistingAnalysis(audioFileBuffer, filename, mode, options = {}) {
  console.log(`[INTEGRATION] Iniciando análise integrada: ${filename}, modo: ${mode}`);

  try {
    // Executar pipeline completo (5.1 + 5.2 + 5.3)
    const pipeline = await processAudioWithCoreMetrics(audioFileBuffer, filename);

    const audioData = pipeline.phase1;
    const segmentedData = pipeline.phase2;
    const metricsData = pipeline.phase3;

    console.log(`[INTEGRATION] Pipeline concluído:`, {
      sampleRate: audioData.sampleRate,
      duration: audioData.duration,
      channels: audioData.numberOfChannels,
      fftFrames: segmentedData.framesFFT.count,
      lufs: metricsData.lufs.integrated,
      truePeak: metricsData.truePeak.maxDbtp
    });

    // Estrutura de resposta compatível com frontend
    const analysisResult = {
      // Dados básicos de áudio
      audioInfo: {
        sampleRate: audioData.sampleRate,
        duration: audioData.duration,
        length: audioData.length,
        numberOfChannels: audioData.numberOfChannels,
        format: audioData._metadata.originalFormat,
        decodedSuccessfully: true
      },

      // Dados de análise real
      analysis: {
        timestamp: new Date().toISOString(),
        mode: mode,

        // Métricas core (reais)
        lufsIntegrated: metricsData.lufs.integrated,
        truePeakDbtp: metricsData.truePeak.maxDbtp,
        dynamicRange: metricsData.lufs.lra,

        // Frequências
        frequencyAnalysis: {
          lowEnd: metricsData.fft.frequencyBands.bass.energyDb,
          midRange: metricsData.fft.frequencyBands.mid.energyDb,
          highEnd: metricsData.fft.frequencyBands.presence.energyDb,
          spectralBalance: metricsData.stereo.balance
        },

        // Dados espectrais
        spectralData: {
          bands: metricsData.fft.frequencyBands,
          stft: metricsData.fft.spectrograms,
          fftSize: metricsData.fft.frameSize,
          hopSize: metricsData.fft.hopSize
        }
      },

      // Metadados de processamento
      processing: {
        phase: '5.1-5.3-complete',
        backendProcessing: true,
        decodingTime: audioData._metadata.processingTime,
        segmentationTime: segmentedData._metadata.processingTime,
        metricsTime: metricsData._metadata.processingTime,
        totalProcessingTime: pipeline.pipeline.totalProcessingTime,
        nextPhases: ['5.4-scoring']
      }
    };

    console.log(`[INTEGRATION] Análise integrada concluída`);
    return analysisResult;

  } catch (error) {
    console.error(`[INTEGRATION] Erro na análise integrada:`, error);

    // Estrutura de erro compatível
    throw {
      error: 'BACKEND_PIPELINE_ERROR',
      message: `Falha no pipeline: ${error.message}`,
      phase: error.phase || '5.1-5.3',
      originalError: error.message,
      fallbackSuggestion: 'Tente usar o processamento client-side temporariamente'
    };
  }
}

/**
 * Adaptar função para ser usada nas rotas da API atual
 */
async function enhanceExistingAnalyzeEndpoint(req, res, originalData) {
  try {
    console.log(`[API_ENHANCE] Processando com pipeline backend...`);

    const { audio, mode = 'genre', genre, referenceAudio, options } = originalData;

    if (!audio || !audio.content) {
      throw new Error('Arquivo de áudio obrigatório');
    }

    // Usar pipeline completo
    const analysisResult = await integrateWithExistingAnalysis(
      audio.content,
      audio.filename,
      mode,
      options
    );

    // Estrutura de resposta existente
    const responseStructure = {
      success: true,
      mode: mode,

      ...(mode === 'genre' && {
        genre: genre,
        audio: {
          filename: audio.filename,
          size: audio.size,
          format: audio.filename.split('.').pop()?.toLowerCase()
        }
      }),

      ...(mode === 'reference' && referenceAudio && {
        files: {
          user: {
            filename: audio.filename,
            size: audio.size,
            format: audio.filename.split('.').pop()?.toLowerCase()
          },
          reference: {
            filename: referenceAudio.filename,
            size: referenceAudio.size,
            format: referenceAudio.filename.split('.').pop()?.toLowerCase()
          }
        }
      }),

      analysis: analysisResult,

      _backend: {
        version: '5.1-5.3-pipeline',
        processingMode: 'server-side',
        timestamp: new Date().toISOString()
      }
    };

    return responseStructure;

  } catch (error) {
    console.error(`[API_ENHANCE] Erro no endpoint aprimorado:`, error);

    throw {
      error: 'Erro no processamento',
      message: error.message || 'Erro desconhecido durante o processamento',
      code: 'BACKEND_PROCESSING_ERROR',
      phase: error.phase || '5.1-5.3'
    };
  }
}

/**
 * Função utilitária para decidir se usa backend
 */
function shouldUseNewDecoder(options = {}) {
  const ENABLE_BACKEND_DECODER = process.env.ENABLE_BACKEND_DECODER === 'true';
  const FORCE_BACKEND = options.forceBackend === true;
  const CLIENT_SUPPORTS_BACKEND = options.clientSupportsBackend === true;

  return ENABLE_BACKEND_DECODER || FORCE_BACKEND || CLIENT_SUPPORTS_BACKEND;
}

/**
 * Headers de migração
 */
function addMigrationHeaders(res, phase = '5.1-5.3') {
  res.setHeader('X-SoundyAI-Backend-Phase', phase);
  res.setHeader('X-SoundyAI-Processing-Mode', 'server-side');
  res.setHeader('X-SoundyAI-Migration-Status', 'active');
  res.setHeader('X-SoundyAI-Fallback-Available', 'true');
}

/**
 * Exemplo de rota existente com pipeline
 */
async function exampleIntegrationWithExistingRoute(req, res) {
  addMigrationHeaders(res, '5.1-5.3-pipeline');

  try {
    const data = await parseMultipartData(req);

    if (!shouldUseNewDecoder(data.options)) {
      console.log(`[INTEGRATION] Usando client-side (flag desativada)`);
      return originalProcessing(data);
    }

    console.log(`[INTEGRATION] Usando pipeline backend completo`);
    const result = await enhanceExistingAnalyzeEndpoint(req, res, data);

    const processingTime = Date.now() - req.startTime;
    result.performance = {
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString(),
      backendPhase: '5.1-5.3-pipeline'
    };

    res.status(200).json(result);

  } catch (error) {
    console.error('[INTEGRATION] Erro na integração:', error);

    if (error.phase?.startsWith('5.1') && process.env.AUTO_FALLBACK === 'true') {
      console.log(`[INTEGRATION] Fallback para client-side`);
      res.setHeader('X-SoundyAI-Fallback-Triggered', 'true');
      return await originalProcessing(data);
    }

    const statusCode = error.code === 'FILE_TOO_LARGE' ? 413 : 400;
    res.status(statusCode).json({
      error: error.error || 'Erro no processamento',
      message: error.message,
      code: error.code || 'PROCESSING_ERROR',
      phase: error.phase || '5.1-5.3',
      fallbackAvailable: true
    });
  }
}

// Placeholder da função original
async function originalProcessing(data) {
  return {
    success: true,
    mode: data.mode || 'genre',
    analysis: {
      message: 'Processamento client-side (implementação original)',
      backendMode: false
    }
  };
}

// Placeholder para parse
async function parseMultipartData(req) {
  return { mode: 'genre', audio: { content: Buffer.alloc(0), filename: 'test.wav' } };
}

export {
  integrateWithExistingAnalysis,
  enhanceExistingAnalyzeEndpoint,
  shouldUseNewDecoder,
  addMigrationHeaders,
  exampleIntegrationWithExistingRoute
};
