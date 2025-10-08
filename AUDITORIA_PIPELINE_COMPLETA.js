// 🔍 AUDITORIA COMPLETA DO PIPELINE DE ANÁLISE DE ÁUDIO
// Sistema para rastrear onde ganhos são aplicados e por que EQ +5dB não aparece nas métricas

(function() {
  'use strict';

  // 🔒 Prevenir múltiplas execuções
  if (window.__PIPELINE_AUDIT_ENABLED__) {
    console.warn('⚠️ Auditoria de pipeline já ativa - evitando duplicação');
    return;
  }
  window.__PIPELINE_AUDIT_ENABLED__ = true;

  console.group('🔍 AUDITORIA: Sistema de diagnóstico do pipeline iniciado');
  console.log('📋 Versão da auditoria:', '1.0.0');
  console.log('🎯 Objetivo: Detectar normalizações automáticas e perdas de ganho');
  console.groupEnd();

  // 📊 SISTEMA DE COLETA DE DADOS DA AUDITORIA
  const auditData = {
    stages: [],
    transformations: [],
    gainChanges: [],
    spectralData: {
      beforeProcessing: null,
      afterProcessing: null,
      bandChanges: {}
    },
    timing: {},
    audioBufferSnapshots: []
  };

  // 🔧 UTILITY: Calcular ganho RMS em dB
  function calculateRMSdB(channelData) {
    if (!channelData || channelData.length === 0) return -Infinity;
    let sum = 0;
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sum / channelData.length);
    return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  }

  // 🔧 UTILITY: Calcular peak em dB
  function calculatePeakdB(channelData) {
    if (!channelData || channelData.length === 0) return -Infinity;
    let peak = 0;
    for (let i = 0; i < channelData.length; i++) {
      const abs = Math.abs(channelData[i]);
      if (abs > peak) peak = abs;
    }
    return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
  }

  // 🔧 UTILITY: Calcular energia espectral por banda
  function calculateSpectralBands(channelData, sampleRate) {
    if (!channelData || channelData.length < 512) return null;
    
    // FFT simples para análise de bandas
    const fftSize = Math.min(2048, channelData.length);
    const section = channelData.slice(0, fftSize);
    
    // Análise de frequências por bandas
    const bands = {
      sub: 0,      // 20-60 Hz
      bass: 0,     // 60-250 Hz  
      lowMid: 0,   // 250-500 Hz
      mid: 0,      // 500-2000 Hz
      highMid: 0,  // 2000-4000 Hz
      presence: 0, // 4000-6000 Hz
      brilliance: 0 // 6000-20000 Hz
    };

    // Calcular energia por banda (método simplificado)
    const nyquist = sampleRate / 2;
    const binSize = nyquist / (fftSize / 2);
    
    for (let i = 0; i < fftSize; i++) {
      const freq = i * binSize;
      const energy = Math.abs(section[i]);
      
      if (freq >= 20 && freq < 60) bands.sub += energy;
      else if (freq >= 60 && freq < 250) bands.bass += energy;
      else if (freq >= 250 && freq < 500) bands.lowMid += energy;
      else if (freq >= 500 && freq < 2000) bands.mid += energy;
      else if (freq >= 2000 && freq < 4000) bands.highMid += energy;
      else if (freq >= 4000 && freq < 6000) bands.presence += energy;
      else if (freq >= 6000 && freq <= 20000) bands.brilliance += energy;
    }

    // Normalizar por energia total para comparação
    const totalEnergy = Object.values(bands).reduce((sum, val) => sum + val, 0);
    if (totalEnergy > 0) {
      Object.keys(bands).forEach(key => {
        bands[key] = (bands[key] / totalEnergy) * 100; // Porcentagem
      });
    }

    return bands;
  }

  // 🎯 INTERCEPTOR PRINCIPAL: analyzeAudioFile
  function auditAnalyzeAudioFile() {
    if (!window.audioAnalyzer || !window.audioAnalyzer.analyzeAudioFile) {
      console.warn('⚠️ AudioAnalyzer não encontrado - tentando localizar automaticamente');
      return;
    }

    const originalAnalyze = window.audioAnalyzer.analyzeAudioFile.bind(window.audioAnalyzer);
    
    window.audioAnalyzer.analyzeAudioFile = async function(file, options = {}) {
      console.group('🔍 AUDITORIA: Início da análise');
      console.log('📁 Arquivo:', {
        nome: file.name,
        tamanho: file.size,
        sizeFormatted: `${(file.size / 1024 / 1024).toFixed(2)} MB`
      });
      console.log('⚙️ Opções:', options);
      
      auditData.stages.push({
        stage: 'ANALYSIS_STARTED',
        timestamp: performance.now(),
        fileName: file.name,
        fileSize: file.size,
        options: { ...options }
      });
      
      try {
        const result = await originalAnalyze(file, options);
        
        auditData.stages.push({
          stage: 'ANALYSIS_COMPLETED',
          timestamp: performance.now(),
          success: true
        });
        
        console.log('✅ Análise concluída:', result);
        console.groupEnd();
        
        // Gerar relatório final
        generateAuditReport();
        
        return result;
      } catch (error) {
        auditData.stages.push({
          stage: 'ANALYSIS_FAILED',
          timestamp: performance.now(),
          error: error.message
        });
        
        console.error('❌ Erro na análise:', error);
        console.groupEnd();
        throw error;
      }
    };
  }

  // 🎯 INTERCEPTOR: performFullAnalysis 
  function auditPerformFullAnalysis() {
    if (!window.audioAnalyzer || !window.audioAnalyzer.performFullAnalysis) {
      console.warn('⚠️ performFullAnalysis não encontrado');
      return;
    }

    const originalPerform = window.audioAnalyzer.performFullAnalysis.bind(window.audioAnalyzer);
    
    window.audioAnalyzer.performFullAnalysis = function(audioBuffer, options = {}) {
      console.group('🔍 AUDITORIA: performFullAnalysis');
      
      const runId = options.runId || 'unknown';
      const t0 = performance.now();
      
      // Capturar estado inicial do audioBuffer
      const leftChannel = audioBuffer.getChannelData(0);
      const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;
      
      const initialState = {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        leftRMSdB: calculateRMSdB(leftChannel),
        leftPeakdB: calculatePeakdB(leftChannel),
        rightRMSdB: calculateRMSdB(rightChannel),
        rightPeakdB: calculatePeakdB(rightChannel)
      };
      
      console.log('[AUDITORIA]', 'INITIAL_AUDIO_STATE', {
        etapa: 'entrada_perform_full_analysis',
        tipo: 'snapshot',
        runId,
        ...initialState
      });

      // Calcular bandas espectrais iniciais
      const initialSpectral = calculateSpectralBands(leftChannel, audioBuffer.sampleRate);
      if (initialSpectral) {
        auditData.spectralData.beforeProcessing = initialSpectral;
        console.log('[AUDITORIA]', 'INITIAL_SPECTRAL', {
          etapa: 'bandas_espectrais_entrada',
          tipo: 'espectro',
          runId,
          bandas: initialSpectral
        });
      }

      auditData.audioBufferSnapshots.push({
        stage: 'PERFORM_FULL_ANALYSIS_START',
        timestamp: performance.now(),
        runId,
        state: initialState,
        spectral: initialSpectral
      });

      try {
        const result = originalPerform(audioBuffer, options);
        
        const processingTime = performance.now() - t0;
        
        console.log('[AUDITORIA]', 'PERFORM_FULL_ANALYSIS_COMPLETE', {
          etapa: 'saida_perform_full_analysis',
          tipo: 'resultado',
          runId,
          processingTimeMs: processingTime.toFixed(2),
          metricas: {
            peak: result?.technicalData?.peak,
            rms: result?.technicalData?.rms,
            crestFactor: result?.technicalData?.crestFactor,
            lufsIntegrated: result?.technicalData?.lufsIntegrated
          }
        });

        console.groupEnd();
        return result;
        
      } catch (error) {
        console.error('[AUDITORIA]', 'PERFORM_FULL_ANALYSIS_ERROR', {
          etapa: 'erro_perform_full_analysis',
          tipo: 'erro',
          runId,
          error: error.message
        });
        console.groupEnd();
        throw error;
      }
    };
  }

  // 🎯 INTERCEPTOR: _enrichWithPhase2Metrics
  function auditEnrichWithPhase2Metrics() {
    if (!window.audioAnalyzer || !window.audioAnalyzer._enrichWithPhase2Metrics) {
      console.warn('⚠️ _enrichWithPhase2Metrics não encontrado');
      return;
    }

    const originalEnrich = window.audioAnalyzer._enrichWithPhase2Metrics.bind(window.audioAnalyzer);
    
    window.audioAnalyzer._enrichWithPhase2Metrics = async function(audioBuffer, baseAnalysis, fileRef, runId) {
      console.group('🔍 AUDITORIA: _enrichWithPhase2Metrics (Fase 2)');
      
      const t0 = performance.now();
      
      // Estado antes da Fase 2
      console.log('[AUDITORIA]', 'FASE2_ENTRADA', {
        etapa: 'fase2_entrada',
        tipo: 'pre_v2',
        runId,
        metricas_v1: {
          peak: baseAnalysis?.technicalData?.peak,
          rms: baseAnalysis?.technicalData?.rms,
          crestFactor: baseAnalysis?.technicalData?.crestFactor,
          dominantFrequencies: baseAnalysis?.technicalData?.dominantFrequencies?.length || 0
        }
      });

      try {
        const enrichedResult = await originalEnrich(audioBuffer, baseAnalysis, fileRef, runId);
        
        const processingTime = performance.now() - t0;
        
        // Estado após Fase 2
        console.log('[AUDITORIA]', 'FASE2_SAIDA', {
          etapa: 'fase2_saida',
          tipo: 'pos_v2',
          runId,
          processingTimeMs: processingTime.toFixed(2),
          metricas_v2: {
            lufsIntegrated: enrichedResult?.technicalData?.lufsIntegrated,
            lufsShortTerm: enrichedResult?.technicalData?.lufsShortTerm,
            truePeakDbtp: enrichedResult?.technicalData?.truePeakDbtp,
            headroomDb: enrichedResult?.technicalData?.headroomDb,
            lra: enrichedResult?.technicalData?.lra
          },
          ganhoDetectado: calcularGanhoAplicado(baseAnalysis, enrichedResult)
        });

        console.groupEnd();
        return enrichedResult;
        
      } catch (error) {
        console.error('[AUDITORIA]', 'FASE2_ERROR', {
          etapa: 'fase2_erro',
          tipo: 'erro',
          runId,
          error: error.message
        });
        console.groupEnd();
        throw error;
      }
    };
  }

  // 🎯 INTERCEPTOR: calculateLoudnessMetrics (se disponível)
  function auditLoudnessCalculation() {
    // Verificar se o módulo de loudness está disponível
    if (window.__PROD_AI_ADV_CACHE__ && window.__PROD_AI_ADV_CACHE__.loudMod) {
      const loudMod = window.__PROD_AI_ADV_CACHE__.loudMod;
      
      if (loudMod.calculateLoudnessMetrics) {
        const originalCalc = loudMod.calculateLoudnessMetrics;
        
        loudMod.calculateLoudnessMetrics = function(leftChannel, rightChannel, sampleRate) {
          console.group('🔍 AUDITORIA: calculateLoudnessMetrics');
          
          const t0 = performance.now();
          
          // Estado de entrada para LUFS
          const inputState = {
            leftRMSdB: calculateRMSdB(leftChannel),
            leftPeakdB: calculatePeakdB(leftChannel),
            rightRMSdB: calculateRMSdB(rightChannel),
            rightPeakdB: calculatePeakdB(rightChannel),
            sampleRate,
            samples: leftChannel.length
          };
          
          console.log('[AUDITORIA]', 'LUFS_CALCULATION_INPUT', {
            etapa: 'calculo_lufs_entrada',
            tipo: 'loudness_pre',
            ...inputState
          });

          try {
            const result = originalCalc(leftChannel, rightChannel, sampleRate);
            
            const processingTime = performance.now() - t0;
            
            console.log('[AUDITORIA]', 'LUFS_CALCULATION_OUTPUT', {
              etapa: 'calculo_lufs_saida',
              tipo: 'loudness_pos',
              processingTimeMs: processingTime.toFixed(2),
              lufs_integrated: result.lufs_integrated,
              lufs_short_term: result.lufs_short_term,
              lufs_momentary: result.lufs_momentary,
              lra: result.lra,
              headroom_db: result.headroom_db,
              loudness_offset_db: result.loudness_offset_db,
              gating_stats: result.gating_stats
            });

            console.groupEnd();
            return result;
            
          } catch (error) {
            console.error('[AUDITORIA]', 'LUFS_CALCULATION_ERROR', {
              etapa: 'calculo_lufs_erro',
              tipo: 'erro',
              error: error.message
            });
            console.groupEnd();
            throw error;
          }
        };
      }
    }
  }

  // 🧮 HELPER: Calcular ganho aplicado entre duas análises
  function calcularGanhoAplicado(before, after) {
    if (!before?.technicalData || !after?.technicalData) return null;
    
    const beforePeak = before.technicalData.peak;
    const afterPeak = after.technicalData.peak;
    const beforeRMS = before.technicalData.rms;
    const afterRMS = after.technicalData.rms;
    
    const gainChange = {
      peakGainDb: null,
      rmsGainDb: null,
      normalizedDetected: false
    };
    
    if (Number.isFinite(beforePeak) && Number.isFinite(afterPeak)) {
      gainChange.peakGainDb = afterPeak - beforePeak;
    }
    
    if (Number.isFinite(beforeRMS) && Number.isFinite(afterRMS)) {
      gainChange.rmsGainDb = afterRMS - beforeRMS;
    }
    
    // Detectar se houve normalização (redução significativa)
    if (gainChange.peakGainDb && gainChange.peakGainDb < -1.0) {
      gainChange.normalizedDetected = true;
    }
    
    return gainChange;
  }

  // 📊 GERADOR DE RELATÓRIO FINAL
  function generateAuditReport() {
    console.group('🔍 AUDITORIA: Relatório Final do Pipeline');
    
    const totalStages = auditData.stages.length;
    const startTime = auditData.stages[0]?.timestamp || 0;
    const endTime = auditData.stages[totalStages - 1]?.timestamp || 0;
    const totalTime = endTime - startTime;
    
    console.log('📊 Resumo da Análise:');
    console.table({
      'Total de Estágios': totalStages,
      'Tempo Total (ms)': totalTime.toFixed(2),
      'Snapshots do AudioBuffer': auditData.audioBufferSnapshots.length,
      'Transformações Detectadas': auditData.transformations.length,
      'Mudanças de Ganho': auditData.gainChanges.length
    });
    
    console.log('🎯 Estágios do Pipeline:');
    auditData.stages.forEach((stage, index) => {
      console.log(`${index + 1}. [${stage.timestamp.toFixed(2)}ms] ${stage.stage}`);
      if (stage.error) console.log(`   ❌ Erro: ${stage.error}`);
    });
    
    if (auditData.spectralData.beforeProcessing && auditData.spectralData.afterProcessing) {
      console.log('🎵 Análise Espectral:');
      console.table({
        'Antes': auditData.spectralData.beforeProcessing,
        'Depois': auditData.spectralData.afterProcessing
      });
    }
    
    if (auditData.audioBufferSnapshots.length > 0) {
      console.log('📸 Snapshots do AudioBuffer:');
      auditData.audioBufferSnapshots.forEach((snapshot, index) => {
        console.log(`${index + 1}. [${snapshot.stage}] RMS: ${snapshot.state.leftRMSdB.toFixed(2)} dB, Peak: ${snapshot.state.leftPeakdB.toFixed(2)} dB`);
      });
    }
    
    // Verificar se há evidência de normalização automática
    const possibleNormalization = auditData.gainChanges.some(change => 
      change.normalizedDetected || (change.peakGainDb && change.peakGainDb < -3.0)
    );
    
    if (possibleNormalization) {
      console.warn('⚠️ POSSÍVEL NORMALIZAÇÃO AUTOMÁTICA DETECTADA!');
      console.log('   Isso pode explicar por que aumentos de EQ não aparecem nas métricas.');
    }
    
    console.log('🔗 Dados completos disponíveis em: window.__PIPELINE_AUDIT_DATA__');
    window.__PIPELINE_AUDIT_DATA__ = auditData;
    
    console.groupEnd();
  }

  // 🚀 INICIALIZAÇÃO DA AUDITORIA
  function initAudit() {
    console.log('🔍 Iniciando interceptação do pipeline...');
    
    // Aguardar o AudioAnalyzer estar disponível
    const checkAnalyzer = () => {
      if (window.audioAnalyzer) {
        console.log('✅ AudioAnalyzer encontrado - aplicando interceptadores');
        auditAnalyzeAudioFile();
        auditPerformFullAnalysis();
        auditEnrichWithPhase2Metrics();
        auditLoudnessCalculation();
        
        console.log('🎯 Sistema de auditoria ativo - próxima análise será monitorada');
      } else {
        console.log('⏳ Aguardando AudioAnalyzer...');
        setTimeout(checkAnalyzer, 1000);
      }
    };
    
    checkAnalyzer();
  }

  // 🎯 FUNÇÃO PÚBLICA PARA ATIVAR/DESATIVAR
  window.togglePipelineAudit = function(enable = true) {
    if (enable && !window.__PIPELINE_AUDIT_ENABLED__) {
      initAudit();
    } else if (!enable && window.__PIPELINE_AUDIT_ENABLED__) {
      console.log('🔍 Auditoria de pipeline desabilitada');
      window.__PIPELINE_AUDIT_ENABLED__ = false;
      // Note: Os interceptadores permanecem ativos até refresh da página
    }
  };

  // 🎯 FUNÇÃO PARA LIMPAR DADOS DE AUDITORIA
  window.clearPipelineAuditData = function() {
    auditData.stages = [];
    auditData.transformations = [];
    auditData.gainChanges = [];
    auditData.spectralData = { beforeProcessing: null, afterProcessing: null, bandChanges: {} };
    auditData.timing = {};
    auditData.audioBufferSnapshots = [];
    console.log('🧹 Dados de auditoria limpos');
  };

  // 🎯 FUNÇÃO PARA EXPORTAR RELATÓRIO
  window.exportPipelineAuditReport = function() {
    const report = {
      timestamp: new Date().toISOString(),
      auditVersion: '1.0.0',
      ...auditData
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-audit-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log('📥 Relatório de auditoria exportado');
  };

  // 🚀 INICIAR AUTOMATICAMENTE
  initAudit();

  console.log('🔍 Sistema de Auditoria de Pipeline carregado!');
  console.log('   Comandos disponíveis:');
  console.log('   - window.togglePipelineAudit(true/false)');
  console.log('   - window.clearPipelineAuditData()');
  console.log('   - window.exportPipelineAuditReport()');
  console.log('   - window.__PIPELINE_AUDIT_DATA__ (dados coletados)');

})();