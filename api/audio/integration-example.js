/**
 * Exemplo de Integração - Audio Decoder na API Existente
 * 
 * Demonstra como integrar o novo decoder com o sistema atual
 * Mantém compatibilidade total com o frontend existente
 */

import { decodeAudioFile, getAudioInfo } from './audio-decoder.js';

/**
 * Integrar decoder com o sistema de análise existente
 * 
 * Esta função substitui a parte de decodificação que antes
 * era feita com Web Audio API no frontend
 */
async function integrateWithExistingAnalysis(audioFileBuffer, filename, mode, options = {}) {
  console.log(`[INTEGRATION] Iniciando análise integrada: ${filename}, modo: ${mode}`);
  
  try {
    // FASE 5.1: Decodificação (substitui decodeAudioData)
    const audioData = await decodeAudioFile(audioFileBuffer, filename);
    
    console.log(`[INTEGRATION] Decodificação concluída:`, {
      sampleRate: audioData.sampleRate,
      duration: audioData.duration,
      samples: audioData.length,
      channels: audioData.numberOfChannels
    });
    
    // PRÓXIMAS FASES: Aqui será integrado o pipeline de análise
    // Por enquanto, retornamos dados simulados compatíveis
    
    // Simular estrutura de resposta compatível com o frontend
    const analysisResult = {
      // Dados de decodificação (reais)
      audioInfo: {
        sampleRate: audioData.sampleRate,
        duration: audioData.duration,
        length: audioData.length,
        numberOfChannels: audioData.numberOfChannels,
        format: audioData._metadata.originalFormat,
        decodedSuccessfully: true
      },
      
      // Placeholder para análise (será implementado nas próximas fases)
      analysis: {
        // FASE 5.2: Simulação temporal
        timestamp: new Date().toISOString(),
        mode: mode,
        
        // FASE 5.3: Métricas core (placeholder)
        lufsIntegrated: -14.2, // Será calculado
        truePeakDbtp: -1.1,    // Será calculado
        dynamicRange: 8.5,     // Será calculado
        
        // FASE 5.4: Dados para scoring (placeholder)
        frequencyAnalysis: {
          lowEnd: 0.85,
          midRange: 0.92,
          highEnd: 0.78,
          spectralBalance: 0.87
        },
        
        // Manter compatibilidade com estrutura atual
        spectralData: {
          bands: [], // Será preenchido pela Fase 5.3
          stft: [],  // Será preenchido pela Fase 5.3
          fftSize: 4096,
          hopSize: 1024
        }
      },
      
      // Metadados de processamento
      processing: {
        phase: '5.1-decode-only',
        backendProcessing: true,
        decodingTime: audioData._metadata.processingTime,
        nextPhases: ['5.2-temporal', '5.3-metrics', '5.4-scoring']
      }
    };
    
    console.log(`[INTEGRATION] Análise integrada concluída para Fase 5.1`);
    return analysisResult;
    
  } catch (error) {
    console.error(`[INTEGRATION] Erro na análise integrada:`, error);
    
    // Estrutura de erro compatível
    throw {
      error: 'BACKEND_DECODE_ERROR',
      message: `Falha na decodificação: ${error.message}`,
      phase: '5.1-decode',
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
    console.log(`[API_ENHANCE] Processando com novo decoder...`);
    
    // Extrair dados do request original
    const { audio, mode = 'genre', genre, referenceAudio, options } = originalData;
    
    if (!audio || !audio.content) {
      throw new Error('Arquivo de áudio obrigatório');
    }
    
    // Usar novo decoder ao invés de placeholder
    const analysisResult = await integrateWithExistingAnalysis(
      audio.content,
      audio.filename,
      mode,
      options
    );
    
    // Manter estrutura de resposta existente
    const responseStructure = {
      success: true,
      mode: mode,
      
      // Dados específicos do modo
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
      
      // Dados de análise (compatíveis com estrutura existente)
      analysis: analysisResult,
      
      // Indicador de que está usando novo backend
      _backend: {
        version: '5.1-decoder',
        processingMode: 'server-side',
        timestamp: new Date().toISOString()
      }
    };
    
    return responseStructure;
    
  } catch (error) {
    console.error(`[API_ENHANCE] Erro no endpoint aprimorado:`, error);
    
    // Para compatibilidade, retornar erro no formato esperado
    throw {
      error: 'Erro no processamento',
      message: error.message || 'Erro desconhecido durante o processamento',
      code: 'BACKEND_PROCESSING_ERROR',
      phase: '5.1-integration'
    };
  }
}

/**
 * Função utilitária para verificar se deve usar novo decoder
 */
function shouldUseNewDecoder(options = {}) {
  // Feature flag para controle gradual
  const ENABLE_BACKEND_DECODER = process.env.ENABLE_BACKEND_DECODER === 'true';
  const FORCE_BACKEND = options.forceBackend === true;
  const CLIENT_SUPPORTS_BACKEND = options.clientSupportsBackend === true;
  
  return ENABLE_BACKEND_DECODER || FORCE_BACKEND || CLIENT_SUPPORTS_BACKEND;
}

/**
 * Middleware para adicionar cabeçalhos de controle da migração
 */
function addMigrationHeaders(res, phase = '5.1') {
  res.setHeader('X-SoundyAI-Backend-Phase', phase);
  res.setHeader('X-SoundyAI-Processing-Mode', 'server-side');
  res.setHeader('X-SoundyAI-Migration-Status', 'active');
  res.setHeader('X-SoundyAI-Fallback-Available', 'true');
}

/**
 * Exemplo de como integrar com a rota existente
 */
async function exampleIntegrationWithExistingRoute(req, res) {
  // Adicionar headers de controle
  addMigrationHeaders(res, '5.1-decoder');
  
  try {
    // Parse dos dados (código existente)
    const data = await parseMultipartData(req); // Função já existente
    
    // Verificar se deve usar novo decoder
    if (!shouldUseNewDecoder(data.options)) {
      console.log(`[INTEGRATION] Usando processamento client-side (feature flag desabilitada)`);
      // Delegar para implementação original
      return originalProcessing(data);
    }
    
    // Usar novo decoder integrado
    console.log(`[INTEGRATION] Usando novo decoder server-side`);
    const result = await enhanceExistingAnalyzeEndpoint(req, res, data);
    
    // Adicionar métricas de performance
    const processingTime = Date.now() - req.startTime;
    result.performance = {
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString(),
      backendPhase: '5.1-decoder'
    };
    
    res.status(200).json(result);
    
  } catch (error) {
    console.error('[INTEGRATION] Erro na integração:', error);
    
    // Fallback automático em caso de erro
    if (error.phase === '5.1-decode' && process.env.AUTO_FALLBACK === 'true') {
      console.log(`[INTEGRATION] Tentando fallback para client-side...`);
      res.setHeader('X-SoundyAI-Fallback-Triggered', 'true');
      
      try {
        return await originalProcessing(data);
      } catch (fallbackError) {
        console.error('[INTEGRATION] Fallback também falhou:', fallbackError);
      }
    }
    
    // Resposta de erro padrão
    const statusCode = error.code === 'FILE_TOO_LARGE' ? 413 : 400;
    res.status(statusCode).json({
      error: error.error || 'Erro no processamento',
      message: error.message,
      code: error.code || 'PROCESSING_ERROR',
      phase: error.phase || '5.1-unknown',
      fallbackAvailable: true
    });
  }
}

// Placeholder para função original
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

// Placeholder para função de parse existente
async function parseMultipartData(req) {
  // Esta função já existe no arquivo analyze.js
  // Aqui seria uma referência para ela
  return { mode: 'genre', audio: { content: Buffer.alloc(0), filename: 'test.wav' } };
}

export {
  integrateWithExistingAnalysis,
  enhanceExistingAnalyzeEndpoint,
  shouldUseNewDecoder,
  addMigrationHeaders,
  exampleIntegrationWithExistingRoute
};
