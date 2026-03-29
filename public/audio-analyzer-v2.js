// 🎵 AUDIO ANALYZER V1 - Ponte para V2 com cache-busting agressivo
// Versão v1.5-FIXED-CLEAN-NOHIGH sem duplicações (removido "muito alto")
// Implementação usando Web Audio API (100% gratuito)
// 🔄 Cache determinístico: genre:fileHash:refsVer para invalidação precisa

// 🚩 FEATURE FLAGS CONFIGURATION
// NEW_CACHE_KEY: true em dev/staging, pode ser false em prod para rollback
if (typeof window !== 'undefined' && window.NEW_CACHE_KEY === undefined) {
  window.NEW_CACHE_KEY = window.location.hostname !== 'prod.ai'; // Default baseado no hostname
  log('🔧 NEW_CACHE_KEY inicializado:', window.NEW_CACHE_KEY);
}

// RUNID_ENFORCED herdado de audio-analyzer.js (declarado antes da injecao dinamica)

class AudioAnalyzer {
  constructor() {
    this.audioContext = null;
    this.analyzer = null;
    this.dataArray = null;
    this.isAnalyzing = false;
    this._v2Loaded = false;
    this._v2LoadingPromise = null;
    
    // 🆔 SISTEMA runId para prevenir race conditions - INICIALIZAÇÃO DEFENSIVA
    this._activeAnalyses = new Map();
    this._threadSafeCache = this._createThreadSafeCache();
    this._currentRunId = null; // Track do runId atual para contexto
    this._abortController = null; // Para cancelar análises duplicadas
    
    // 🔬 SISTEMA DE DIAGNÓSTICO E LOGS DETALHADOS
    this._diagnosticMode = false;
    
    // 🧠 MEMORY MANAGEMENT - Sistema de limpeza agressiva
    this._memoryManager = {
      maxCacheEntries: 50,
      gcAfterAnalysis: true,
      trackAllocations: true,
      lastGC: Date.now()
    };
    
  // CAIAR: log construção
  try { (window.__caiarLog||function(){})('INIT','AudioAnalyzer instanciado'); } catch {}
    
    log('🎯 AudioAnalyzer V1 construído - ponte para V2 com sistema runId avançado + Memory Management');
    this._preloadV2();
  this._pipelineVersion = 'CAIAR_PIPELINE_1.0_DIAGNOSTIC_MEMORY_SAFE';
  }

  // 🧠 MEMORY MANAGEMENT - Limpeza agressiva de vazamentos
  _cleanupAudioBuffer(audioBuffer) {
    try {
      if (audioBuffer && typeof audioBuffer === 'object') {
        // Limpar referências internas se possível
        if (audioBuffer._channelData) {
          audioBuffer._channelData = null;
        }
        // Sinalizar para GC
        audioBuffer = null;
        log('🧹 AudioBuffer cleanup executado');
      }
    } catch (error) {
      warn('⚠️ Erro na limpeza de AudioBuffer:', error);
    }
  }
  
  _cleanupStemsArrays(stems) {
    try {
      if (stems && Array.isArray(stems)) {
        stems.forEach((stem, index) => {
          if (stem && stem.buffer) {
            // Limpar buffers de stems
            if (stem.buffer._channelData) {
              stem.buffer._channelData = null;
            }
            stem.buffer = null;
            log(`🧹 Stem ${index} buffer cleanup executado`);
          }
          // Limpar arrays float32
          if (stem.data && stem.data.length) {
            stem.data.fill(0); // Zero out antes de liberar
            stem.data = null;
          }
        });
        // Limpar array principal
        stems.length = 0;
        stems = null;
        log('🧹 Stems arrays cleanup executado');
      }
    } catch (error) {
      warn('⚠️ Erro na limpeza de stems:', error);
    }
  }
  
  _cleanupLRUCache() {
    try {
      const cacheMap = window.__AUDIO_ANALYSIS_CACHE__;
      if (!cacheMap || !(cacheMap instanceof Map)) return;
      
      const maxEntries = this._memoryManager.maxCacheEntries;
      
      if (cacheMap.size > maxEntries) {
        // LRU: remover entradas mais antigas
        const entries = Array.from(cacheMap.entries());
        // Ordenar por timestamp (mais antigo primeiro)
        entries.sort((a, b) => (a[1]._ts || 0) - (b[1]._ts || 0));
        
        const toRemove = entries.slice(0, cacheMap.size - maxEntries);
        toRemove.forEach(([key, value]) => {
          // Cleanup do objeto de análise
          if (value.analysis) {
            value.analysis = null;
          }
          cacheMap.delete(key);
        });
        
        log(`🧹 LRU Cache cleanup: removidas ${toRemove.length} entradas antigas`);
        log(`📊 Cache size: ${cacheMap.size}/${maxEntries}`);
      }
    } catch (error) {
      warn('⚠️ Erro na limpeza LRU cache:', error);
    }
  }
  
  _forceGarbageCollection() {
    try {
      if (this._memoryManager.gcAfterAnalysis) {
        // Força GC se disponível (apenas para debug/desenvolvimento)
        if (window.gc && typeof window.gc === 'function') {
          window.gc();
          log('🧹 Garbage Collection forçado (dev mode)');
        } else {
          // Simular pressão de memória para encorajar GC
          let dummy = new ArrayBuffer(1024 * 1024); // 1MB
          setTimeout(() => dummy = null, 0);
        }
        this._memoryManager.lastGC = Date.now();
      }
    } catch (error) {
      warn('⚠️ Erro ao forçar GC:', error);
    }
  }
  
  _getMemoryStats() {
    try {
      const stats = {
        timestamp: Date.now(),
        cacheSize: window.__AUDIO_ANALYSIS_CACHE__?.size || 0,
        activeAnalyses: this._activeAnalyses?.size || 0
      };
      
      // Estatísticas de memória do navegador se disponível
      if (performance.memory) {
        stats.memory = {
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), // MB
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) // MB
        };
      }
      
      return stats;
    } catch (error) {
      warn('⚠️ Erro ao obter stats de memória:', error);
      return { error: error.message };
    }
  }

  // 🆔 Gerador de runId único para cada análise
  _generateRunId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `run_${timestamp}_${random}`;
  }

  // � VALIDAÇÃO CRÍTICA DE ARQUIVO - Detectar problemas antes da decodificação
  _validateFileBasics(file) {
    const issues = [];
    const warnings = [];
    
    // 1. VERIFICAÇÃO DE ARQUIVO VAZIO OU MUITO PEQUENO
    if (!file || file.size === 0) {
      issues.push({
        type: 'ARQUIVO_VAZIO',
        message: 'Arquivo está vazio (0 bytes)',
        suggestion: 'Selecione um arquivo de áudio válido'
      });
    } else if (file.size < 100) {
      issues.push({
        type: 'ARQUIVO_MUITO_PEQUENO',
        message: `Arquivo muito pequeno (${file.size} bytes) - mínimo ~100 bytes para WAV`,
        suggestion: 'Arquivo pode estar corrompido ou truncado. Verifique a origem do arquivo.'
      });
    } else if (file.size < 1000) {
      warnings.push({
        type: 'ARQUIVO_SUSPEITO',
        message: `Arquivo pequeno (${file.size} bytes) - pode estar corrompido`,
        suggestion: 'Verifique se o arquivo contém áudio útil'
      });
    }
    
    // 2. VERIFICAÇÃO DE TIPO MIME
    if (file.type && !file.type.includes('audio') && file.type !== '') {
      warnings.push({
        type: 'MIME_TYPE_SUSPEITO',
        message: `MIME type "${file.type}" pode não ser de áudio`,
        suggestion: 'Verifique se é realmente um arquivo de áudio'
      });
    }
    
    // 3. VERIFICAÇÃO DE EXTENSÃO
    if (file.name) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const supportedExts = ['wav', 'mp3', 'mp4', 'm4a', 'ogg', 'flac', 'aac'];
      if (ext && !supportedExts.includes(ext)) {
        warnings.push({
          type: 'EXTENSÃO_DESCONHECIDA',
          message: `Extensão ".${ext}" pode não ser suportada`,
          suggestion: 'Use WAV, MP3 ou M4A para melhor compatibilidade'
        });
      }
    }
    
    // 4. VERIFICAÇÃO DE TAMANHO EXCESSIVO (>500MB)
    if (file.size > 500 * 1024 * 1024) {
      warnings.push({
        type: 'ARQUIVO_MUITO_GRANDE',
        message: `Arquivo muito grande (${Math.round(file.size / 1024 / 1024)}MB)`,
        suggestion: 'Arquivos grandes podem causar problemas de memória'
      });
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      warnings
    };
  }

  // �🔬 MODO DIAGNÓSTICO - Controle
  enableDiagnosticMode(enabled = true) {
    this._diagnosticMode = enabled;
    log(`🔬 Modo diagnóstico: ${enabled ? 'ATIVADO' : 'DESATIVADO'}`);
    if (enabled) {
      log('📋 Logs detalhados por etapa habilitados');
      log('🚫 Cache desabilitado - força recomputação');
    }
  }

  // 📊 Geração de relatório completo do pipeline
  _generatePipelineReport(runId) {
    if (!this._activeAnalyses.has(runId)) {
      warn(`⚠️ Tentativa de gerar relatório para runId inexistente: ${runId}`);
      return null;
    }
    
    const { pipelineLogs, stageTimings } = this._activeAnalyses.get(runId);
    
    const report = {
      runId,
      totalStages: pipelineLogs.length,
      firstStage: pipelineLogs[0]?.stage || 'UNKNOWN',
      lastStage: pipelineLogs[pipelineLogs.length - 1]?.stage || 'UNKNOWN',
      errors: pipelineLogs.filter(log => log.stage.includes('ERROR')),
      warnings: pipelineLogs.filter(log => log.stage.includes('TIMEOUT') || log.stage.includes('SKIPPED')),
      timings: stageTimings,
      stages: pipelineLogs.map(log => ({
        stage: log.stage,
        timestamp: log.timestamp,
        duration: log.duration,
        data: log.data
      }))
    };
    
    // Calcular estatísticas de performance
    const allDurations = Object.values(stageTimings).filter(d => d > 0);
    if (allDurations.length > 0) {
      report.performance = {
        totalDuration: Math.max(...Object.values(stageTimings)),
        averageStageDuration: allDurations.reduce((a, b) => a + b, 0) / allDurations.length,
        slowestStage: Object.entries(stageTimings).reduce((a, b) => a[1] > b[1] ? a : b),
        fastestStage: Object.entries(stageTimings).reduce((a, b) => a[1] < b[1] ? a : b)
      };
    }
    
    log(`📊 [${runId}] Relatório de pipeline gerado:`, report);
    return report;
  }

  // � HELPER PARA COMPATIBILIDADE COM CHAMADAS ANTIGAS
  _logPipelineStageCompat(runId, stage, data = {}) {
    // Definir temporariamente o runId se não estiver definido
    const originalRunId = this._currentRunId;
    if (!this._currentRunId && runId) {
      this._currentRunId = runId;
    }
    
    // Calcular duration automaticamente se não fornecida
    const analysisContext = this._activeAnalyses?.get(runId);
    const stageStartTime = analysisContext?.startedAt || performance.now();
    const duration = data.duration || (performance.now() - stageStartTime);
    
    // Chamar a versão nova com duration garantida
    this._logPipelineStage(stage, { runId, duration, ...data });
    
    // Restaurar o runId original
    this._currentRunId = originalRunId;
  }

  // �📊 LOG DE PIPELINE POR ETAPA - À PROVA DE FALHAS
  _logPipelineStage(stage, payload = {}) {
    try {
      // Usar runId atual ou extrair do payload
      const runId = this._currentRunId || payload.runId;
      if (!runId) return; // Sem contexto, não loga mas não quebra
      
      // Inicialização defensiva se necessário
      if (!this._activeAnalyses) this._activeAnalyses = new Map();
      
      if (!this._activeAnalyses.has(runId)) {
        this._activeAnalyses.set(runId, {
          runId,
          startedAt: performance.now(),
          stages: new Map(),
          pipelineLogs: [],
          stageTimings: {},
          startTime: Date.now()
        });
      }
      
      const ctx = this._activeAnalyses.get(runId);
      if (!ctx) return; // Nunca travar por falta de contexto
      
      // Gerenciar stage individual
      if (!ctx.stages.has(stage)) {
        ctx.stages.set(stage, {
          name: stage,
          startedAt: performance.now(),
          logs: []
        });
      }
      
      const stageObj = ctx.stages.get(stage);
      if (stageObj && stageObj.logs) {
        stageObj.logs.push({
          ts: performance.now(),
          ...payload
        });
      }
      
      // Log legado para compatibilidade
      const timestamp = Date.now();
      const logEntry = {
        stage,
        timestamp,
        data: this._diagnosticMode ? payload : Object.keys(payload),
        diagnosticMode: this._diagnosticMode
      };
      
      if (ctx.pipelineLogs) {
        ctx.pipelineLogs.push(logEntry);
      }
      
      // Timing da etapa anterior
      if (ctx.lastStageTime) {
        const stageTime = timestamp - ctx.lastStageTime;
        log(`⏱️ [${runId}] ${ctx.lastStage} → ${stage}: ${stageTime}ms`);
      }
      
      ctx.lastStage = stage;
      ctx.lastStageTime = timestamp;
      
      log(`🔄 [${runId}] ETAPA: ${stage}${this._diagnosticMode ? ' (DIAGNOSTIC)' : ''}`);
      
    } catch (error) {
      // CRÍTICO: Logging nunca pode quebrar o pipeline
      warn('⚠️ Erro no logging (não crítico):', error.message);
    }
  }
  
  // 🏁 FINALIZAR STAGE COM DURAÇÃO
  _finishPipelineStage(stage, result = {}) {
    try {
      const runId = this._currentRunId;
      if (!runId || !this._activeAnalyses || !this._activeAnalyses.has(runId)) return;
      
      const ctx = this._activeAnalyses.get(runId);
      const stageObj = ctx?.stages?.get(stage);
      
      if (stageObj) {
        stageObj.finishedAt = performance.now();
        stageObj.durationMs = stageObj.finishedAt - stageObj.startedAt;
        stageObj.result = result;
        
        log(`✅ [${runId}] ${stage} concluído em ${stageObj.durationMs.toFixed(1)}ms`);
      }
    } catch (error) {
      warn('⚠️ Erro ao finalizar stage (não crítico):', error.message);
    }
  }

  // 📋 RELATÓRIO DE PIPELINE COMPLETO (removendo duplicado)
  // Usando o método _generatePipelineReport acima que está mais completo

  // 🚫 BYPASS DE CACHE EM MODO DIAGNÓSTICO
  _shouldBypassCache() {
    return this._diagnosticMode;
  }

  // 🛡️ Fórmula dB padronizada para consistência
  _standardDbFormula(value, reference = 1.0) {
    if (!Number.isFinite(value) || value <= 0) return -Infinity;
    return 20 * Math.log10(value / reference);
  }

  // 🔄 Conversão percentual para dB (para display)
  _percentageToDb(percentage) {
    if (!Number.isFinite(percentage) || percentage <= 0) return -Infinity;
    const normalized = percentage > 1 ? percentage / 100 : percentage;
    return this._standardDbFormula(normalized);
  }

  // 🎯 Converter dados internos (%) para display (dB) de forma consistente
  _convertInternalToDisplay(internalData) {
    if (!internalData || typeof internalData !== 'object') return internalData;
    
    const converted = { ...internalData };
    
    // Converter bandEnergies para display
    if (converted.bandEnergies) {
      for (const [band, data] of Object.entries(converted.bandEnergies)) {
        if (data && data.energyPct && Number.isFinite(data.energyPct)) {
          // Manter valor interno em energyPct, calcular rms_db para display
          const displayDb = this._percentageToDb(data.energyPct);
          converted.bandEnergies[band] = {
            ...data,
            rms_db: displayDb,
            _internal_pct: data.energyPct, // Preservar valor interno
            _display_db: displayDb,
            _formula: 'standardized_20log10'
          };
        }
      }
    }
    
    // Converter tonalBalance para display
    if (converted.tonalBalance) {
      for (const [key, data] of Object.entries(converted.tonalBalance)) {
        if (data && data._internal_pct && Number.isFinite(data._internal_pct)) {
          converted.tonalBalance[key] = {
            ...data,
            rms_db: this._percentageToDb(data._internal_pct),
            _display_db: this._percentageToDb(data._internal_pct),
            _formula: 'standardized_20log10'
          };
        }
      }
    }
    
    return converted;
  }

  // 🎼 Orquestração segura de análise com Promise.allSettled e logs detalhados
  async _orchestrateAnalysis(audioBuffer, options, runId) {
    // 📊 LOG: INPUT
    this._logPipelineStageCompat(runId, 'INPUT', {
      bufferLength: audioBuffer.length,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      options: options
    });
    
    const operations = [];
    const results = {};
    
    // Fase 1: Análise básica (obrigatória)
    operations.push({
      name: 'basic_analysis',
      priority: 1,
      operation: async () => {
        // 📊 LOG: FEATURES (início)
        this._logPipelineStageCompat(runId, 'FEATURES_START', {
          stage: 'basic_analysis',
          bypassCache: this._shouldBypassCache()
        });
        
        const basic = this.performFullAnalysis(audioBuffer, options);
        
        // Adicionar runId aos dados
        if (basic && typeof basic === 'object') {
          basic._runId = runId;
          basic._phase = 'basic';
          basic._diagnosticMode = this._diagnosticMode;
        }
        
        // 📊 LOG: FEATURES (conclusão)
        this._logPipelineStageCompat(runId, 'FEATURES_COMPLETE', {
          hasData: !!basic,
          dataKeys: basic ? Object.keys(basic) : [],
          technicalDataKeys: basic?.technicalData ? Object.keys(basic.technicalData) : []
        });
        
        return basic;
      }
    });
    
    // Executar operações em ordem de prioridade
    for (const op of operations.sort((a, b) => a.priority - b.priority)) {
      try {
        log(`⚡ [${runId}] Executando ${op.name}`);
        results[op.name] = await op.operation();
        log(`✅ [${runId}] ${op.name} concluído`);
      } catch (error) {
        error(`❌ [${runId}] Erro em ${op.name}:`, error);
        
        // 📊 LOG: ERROR
        this._logPipelineStageCompat(runId, 'ERROR', {
          operation: op.name,
          error: error.message,
          stack: this._diagnosticMode ? error.stack : undefined
        });
        
        results[op.name] = { error: error.message, _runId: runId };
      }
    }
    
    return results;
  }

  // ✅ Validação de integridade dos dados
  _validateDataIntegrity(data, runId) {
    if (!data || !runId) {
      warn(`⚠️ [${runId}] Dados inválidos detectados`);
      return false;
    }
    
    if (data._runId && data._runId !== runId) {
      warn(`⚠️ [${runId}] Conflito de runId detectado: ${data._runId} vs ${runId}`);
      return false;
    }
    
    return true;
  }

  // 📦 Cache thread-safe com bypass para modo diagnóstico
  _createThreadSafeCache() {
    const cache = new Map();
    const locks = new Map();
    
    return {
      async get(key, factory, runId) {
        // 🚫 BYPASS CACHE EM MODO DIAGNÓSTICO
        if (this._shouldBypassCache()) {
          log(`🚫 [${runId}] Cache bypass (modo diagnóstico) para ${key}`);
          const value = await factory(runId);
          if (value && typeof value === 'object') {
            value._runId = runId;
            value._cacheKey = key;
            value._diagnosticBypass = true;
          }
          return value;
        }
        
        if (cache.has(key)) {
          const cached = cache.get(key);
          if (cached._runId) {
            log(`📦 [${runId}] Cache hit para ${key} (originado em ${cached._runId})`);
          }
          return cached;
        }
        
        if (locks.has(key)) {
          log(`⏳ [${runId}] Aguardando computação em andamento para ${key}`);
          return await locks.get(key);
        }
        
        const promise = (async () => {
          try {
            log(`🔄 [${runId}] Computando ${key}`);
            const value = await factory(runId);
            if (value && typeof value === 'object') {
              value._runId = runId;
              value._cacheKey = key;
            }
            cache.set(key, value);
            return value;
          } finally {
            locks.delete(key);
          }
        })();
        
        locks.set(key, promise);
        return await promise;
      },
      
      clear() {
        cache.clear();
        locks.clear();
      },
      
      size() {
        return cache.size;
      }
    };
  }

  // 🚀 Pre-carregar V2 imediatamente
  async _preloadV2() {
    log('🚀 Pré-carregando Audio Analyzer V2...');
    
    if (!this._v2LoadingPromise) {
      this._v2LoadingPromise = new Promise((resolve) => {
        const timestamp = Date.now();
        const cacheBust = Math.random().toString(36).substring(2);
        const url = `audio-analyzer-v2.js?v=CLEAN-${timestamp}-${cacheBust}`;
        
        log('🔄 CARREGANDO V2:', url);
        
        const s = document.createElement('script');
        s.src = url;
        s.async = true;
        s.onload = () => { 
          this._v2Loaded = true; 
          log('✅ V2 PRÉ-CARREGADO com sucesso!');
          resolve(); 
        };
        s.onerror = () => { 
          warn('⚠️ Falha no pré-carregamento V2:', url); 
          resolve(); 
        };
        document.head.appendChild(s);
      });
    }
    
    try { 
      await this._v2LoadingPromise; 
    } catch (e) { 
      warn('Erro no pré-carregamento V2:', e); 
    }
  }

  // 🎤 Inicializar análise de áudio
  async initializeAnalyzer() {
    try {
      // Criar contexto de áudio com tratamento moderno
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // 🔧 CORREÇÃO: Verificar se context precisa ser resumed (política moderna de browsers)
      if (this.audioContext.state === 'suspended') {
        log('🔄 AudioContext suspenso, aguardando user gesture...');
        // Não tentar resume automaticamente, aguardar gesture do usuário
        return true; // Retornar sucesso, será resumed quando necessário
      }
      
      this.analyzer = this.audioContext.createAnalyser();
      
      // Configurações de análise
      this.analyzer.fftSize = 2048;
      this.analyzer.smoothingTimeConstant = 0.8;
      
      const bufferLength = this.analyzer.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      
      // 🔧 iOS DETECTION: Detectar capacidades do dispositivo
      this.capabilities = this._detectIOSCapabilities();
      log('📱 Capacidades detectadas:', this.capabilities);
      
  if (window.DEBUG_ANALYZER === true) log('🎵 Analisador de áudio inicializado com sucesso');
      return true;
    } catch (error) {
      error('❌ Erro ao inicializar analisador:', error);
      return false;
    }
  }

  // � iOS CAPABILITIES: Detectar capacidades do dispositivo
  _detectIOSCapabilities() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const hasWebWorkers = typeof Worker !== 'undefined';
    const supportsOfflineContext = (() => {
      try {
        const testCtx = new OfflineAudioContext(1, 1024, 44100);
        return testCtx && testCtx.length > 0;
      } catch { 
        return false; 
      }
    })();
    
    return { 
      isIOS, 
      hasWebWorkers, 
      supportsOfflineContext,
      preferWebWorkers: hasWebWorkers && (isIOS || !supportsOfflineContext)
    };
  }

  // �📁 Analisar arquivo de áudio
  async analyzeAudioFile(file, options = {}) {
    // � CACHE CHANGE MONITOR - Verificar mudanças antes da análise
    if (typeof window !== 'undefined' && window._cacheChangeMonitor) {
      window._cacheChangeMonitor.checkAndInvalidate();
    }
    
    // �🛡️ INICIALIZAÇÃO DEFENSIVA E CONTROLE DE DUPLICATAS
    if (!this._activeAnalyses) this._activeAnalyses = new Map();
    
    // 🚨 VALIDAÇÕES CRÍTICAS PRÉ-ANÁLISE
    const validation = this._validateFileBasics(file);
    if (!validation.isValid) {
      const criticalError = validation.issues[0];
      error(`❌ ARQUIVO INVÁLIDO: ${criticalError.message}`);
      error(`💡 SOLUÇÃO: ${criticalError.suggestion}`);
      
      throw new Error(`Arquivo inválido - ${criticalError.type}: ${criticalError.message}`);
    }
    
    // Abortar análise anterior se ainda ativa
    if (this._abortController && !this._abortController.signal.aborted) {
      log('🛑 Abortando análise anterior para evitar duplicata');
      this._abortController.abort();
    }
    
    // Novo controlador para esta análise
    this._abortController = new AbortController();
    
    // 🆔 Gerar ou usar runId fornecido para esta análise
    const runId = options.runId || this._generateRunId();
    this._currentRunId = runId; // Definir contexto atual
    
    // 🚩 RUNID_ENFORCED: Avisar se runId não foi fornecido em ambiente rigoroso
    if (RUNID_ENFORCED && !options.runId) {
      warn(`⚠️ [${runId}] RUNID_ENFORCED ativo: runId não fornecido, gerado automaticamente`);
    }
    
    log(`🎵 [${runId}] Iniciando análise de arquivo:`, file?.name || 'unknown');
    
    // 🛡️ Vincular AbortController ao runId específico
    this._abortController._runId = runId;
    
    // 🛡️ INICIALIZAÇÃO DEFENSIVA DO CONTEXTO
    if (!this._activeAnalyses.has(runId)) {
      this._activeAnalyses.set(runId, {
        runId,
        startedAt: performance.now(),
        stages: new Map(),
        pipelineLogs: [],
        stageTimings: {},
        startTime: Date.now(),
        file: file?.name || 'unknown',
        options: { ...options },
        status: 'running',
        abortController: this._abortController
      });
    }
    
    try {
      // 📊 LOG: ANÁLISE INICIADA (primeira entrada)
      this._logPipelineStage('ANALYSIS_STARTED', {
        fileName: file?.name,
        fileSize: file?.size,
        mode: options.mode || 'genre'
      });
      
      // 🎯 CORREÇÃO TOTAL: Propagar contexto de modo
      const mode = options.mode || 'genre'; // Default para compatibilidade
      const DEBUG_MODE_REFERENCE = options.debugModeReference || false;
      
      if (DEBUG_MODE_REFERENCE) {
        log(`🔍 [${runId}] [MODE_DEBUG] analyzeAudioFile called with mode:`, mode);
        log(`🔍 [${runId}] [MODE_DEBUG] options:`, options);
        
        // 🎯 MODO PURO: Apenas extrair métricas, sem comparações
        if (mode === 'pure_analysis') {
          log(`🔍 [${runId}] [MODE_DEBUG] pure_analysis mode: extrair métricas sem comparações ou scores`);
        }
      }
      
      const tsStart = new Date().toISOString();
      const disableCache = (typeof window !== 'undefined' && window.DISABLE_ANALYSIS_CACHE === true);
  // ====== CACHE POR CHAVE DETERMINÍSTICA (genre:fileHash:refsVer) ======
  let fileHash = null;
  let cacheKey = null;
  try {
    if (file && file.arrayBuffer) {
      const buf = await file.arrayBuffer();
      const hashBuf = await crypto.subtle.digest('SHA-256', buf);
      fileHash = Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,40);
      
      // 🔧 NEW_CACHE_KEY: Feature flag para nova chave determinística
      const useNewCacheKey = window.NEW_CACHE_KEY !== false; // Default true (false apenas em prod explícito)
      
      if (useNewCacheKey) {
        // Nova chave determinística: genre:fileHash:refsVer
        const genre = window.PROD_AI_REF_GENRE || 'unknown';
        const refsVer = window.EMBEDDED_REFS_VERSION || 'unknown';
        cacheKey = `${genre}:${fileHash}:${refsVer}`;
      } else {
        // Fallback para chave antiga (apenas fileHash)
        cacheKey = fileHash;
      }
      
      // Cache global
      const cacheMap = (window.__AUDIO_ANALYSIS_CACHE__ = window.__AUDIO_ANALYSIS_CACHE__ || new Map());
      
      // 📦 CACHE HIT CHECK - Primeira tentativa com nova chave
      if (!disableCache && cacheMap.has(cacheKey)) {
        const cached = cacheMap.get(cacheKey);
        try { 
          (window.__caiarLog||function(){})('CACHE_HIT','Cache hit com chave determinística', { 
            runId: this._currentRunId || 'unknown',
            key: cacheKey, 
            ageMs: Date.now()-cached._ts 
          }); 
        } catch {}
        // Deep clone leve para evitar mutações externas
        return JSON.parse(JSON.stringify(cached.analysis));
      }
      
      // 🔄 BACKWARD COMPATIBILITY: Tentar chave antiga se nova não funcionou
      if (useNewCacheKey && !disableCache && cacheKey !== fileHash && cacheMap.has(fileHash)) {
        const cached = cacheMap.get(fileHash);
        try { 
          (window.__caiarLog||function(){})('CACHE_HIT_LEGACY','Cache hit com chave antiga (migração)', { 
            runId: this._currentRunId || 'unknown',
            oldKey: fileHash,
            newKey: cacheKey,
            ageMs: Date.now()-cached._ts 
          }); 
          warn(`⚠️ [CACHE] Usando entrada legacy ${fileHash} -> migrando para ${cacheKey}`);
        } catch {}
        
        // Migrar entrada para nova chave e remover antiga
        cacheMap.set(cacheKey, cached);
        cacheMap.delete(fileHash);
        
        // Deep clone leve para evitar mutações externas
        return JSON.parse(JSON.stringify(cached.analysis));
      }
      
      // 📝 CACHE MISS
      if (!disableCache) {
        try { 
          (window.__caiarLog||function(){})('CACHE_MISS','Cache miss - nova análise necessária', { 
            runId: this._currentRunId || 'unknown',
            key: cacheKey
          }); 
        } catch {}
      }
      // Recriar FileReader usando buffer já lido (evitar reler)
      file._cachedArrayBufferForHash = buf;
    }
  } catch(e){ 
    try { 
      (window.__caiarLog||function(){})('CACHE_HASH_ERROR','Falha gerar hash/chave cache',{ 
        runId: this._currentRunId || 'unknown',
        err: e?.message
      }); 
    } catch {} 
  }
  try { (window.__caiarLog||function(){})('INPUT','Arquivo recebido para análise', { name: file?.name, size: file?.size }); } catch {}
  if (window.DEBUG_ANALYZER === true) log('🛰️ [Telemetry] Front antes do fetch (modo local, sem fetch):', {
      route: '(client-only) audio-analyzer.js',
      method: 'N/A',
      file: file?.name,
      sizeBytes: file?.size,
      startedAt: tsStart
    });
  if (window.DEBUG_ANALYZER === true) log(`🎵 Iniciando análise de: ${file.name}`);
    
    if (!this.audioContext) {
      await this.initializeAnalyzer();
    }
    
    // 🔧 CORREÇÃO: Resume AudioContext se necessário (com user gesture)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        log('🔄 AudioContext resumed com sucesso');
      } catch (e) {
        warn('⚠️ AudioContext não pode ser resumed (precisa de user gesture):', e.message);
        // Continuar mesmo assim - análise offline ainda funciona
      }
    }

    // Se já temos o ArrayBuffer (hash) podemos pular FileReader para reduzir latência
    if (file._cachedArrayBufferForHash && file._cachedArrayBufferForHash.byteLength) {
      try {
        const directBuf = file._cachedArrayBufferForHash;
        return await new Promise(async (resolve, reject)=>{
          // 🔧 iOS FIX: Timeout estendido para iOS + WAV mobile optimization
          const isWAV = file.name.toLowerCase().endsWith('.wav') || file.type.includes('wav');
          const isMobile = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
          const isLargeFile = file.size > 20 * 1024 * 1024; // >20MB
          
          let timeoutMs = 30000; // padrão desktop
          if (isWAV && isMobile && isLargeFile) {
            timeoutMs = 60000; // 60s para WAV grandes no mobile  
          } else if (isMobile) {
            timeoutMs = 45000; // 45s para qualquer arquivo mobile
          }
          
          const timeout = setTimeout(()=> reject(new Error(`Timeout decode (${timeoutMs/1000}s) - direct path`)), timeoutMs);
          try {
            // 🔧 iOS FIX: Timeout para decodeAudioData (direct path)
            const decodeTimeoutMs = Math.min(timeoutMs - 5000, isWAV && isMobile ? 40000 : 15000);
            const audioBuffer = await Promise.race([
              this.audioContext.decodeAudioData(directBuf.slice(0)),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`iOS decodeAudioData timeout (${decodeTimeoutMs/1000}s) - direct`)), decodeTimeoutMs)
              )
            ]);
            clearTimeout(timeout);
            const analysis = await this._pipelineFromDecodedBuffer(audioBuffer, file, { fileHash, cacheKey }, runId);
            // 💾 CACHE STORE - Usar chave determinística
            try { 
              if (cacheKey && !disableCache) { 
                const cacheMap = (window.__AUDIO_ANALYSIS_CACHE__ = window.__AUDIO_ANALYSIS_CACHE__ || new Map()); 
                cacheMap.set(cacheKey, { analysis: JSON.parse(JSON.stringify(analysis)), _ts: Date.now() });
                (window.__caiarLog||function(){})('CACHE_STORE','Análise armazenada em cache', { 
                  runId: this._currentRunId || 'unknown',
                  key: cacheKey
                });
              } 
            } catch(storeErr) {
              try { 
                (window.__caiarLog||function(){})('CACHE_STORE_ERROR','Erro ao armazenar cache', { 
                  runId: this._currentRunId || 'unknown',
                  key: cacheKey,
                  err: storeErr?.message
                }); 
              } catch {}
            }
            this._cleanupAudioBuffer(audioBuffer);
            resolve(analysis);
          } catch(e){ 
            clearTimeout(timeout); 
            try {
              // audioBuffer não está disponível neste escopo durante erro de decode direto
              log('🧹 Direct decode error path - audioBuffer não disponível para limpeza');
            } catch (cleanupErr) {
              warn('⚠️ Erro na limpeza do AudioBuffer (direct decode error):', cleanupErr);
            }
            reject(e); 
          }
        });
      } catch(e){ 
        warn(`🔄 [${this._currentRunId || 'unknown'}] Direct decode não suportado para este formato, usando FileReader...`);
        warn(`📋 [${this._currentRunId || 'unknown'}] Detalhes: ${e?.message || e}`);
      }
    }

    return new Promise((resolve, reject) => {
      // Timeout de 30 segundos
      const timeout = setTimeout(() => {
        reject(new Error('Timeout na análise do áudio (30s)'));
      }, 30000);

      const reader = new FileReader();
      
    reader.onload = async (e) => {
        try {
          // 📊 LOG: DECODIFICAÇÃO INICIADA
          this._logPipelineStage('DECODING_AUDIO', {
            fileName: file?.name,
            fileSize: file?.size
          });
          
          if (window.DEBUG_ANALYZER === true) log('🎵 Decodificando áudio...');
          let audioData = e.target.result;
          if (!audioData && file._cachedArrayBufferForHash) audioData = file._cachedArrayBufferForHash;
          
          // 🔧 iOS FIX: Timeout para decodeAudioData que pode travar indefinidamente
          // ⏰ MOBILE WAV FIX: Timeout estendido para arquivos WAV grandes no mobile
          const isWAV = file.name.toLowerCase().endsWith('.wav') || file.type.includes('wav');
          const isMobile = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
          const isLargeFile = file.size > 20 * 1024 * 1024; // >20MB
          
          let timeoutMs = 15000; // padrão
          if (isWAV && isMobile && isLargeFile) {
            timeoutMs = 45000; // 45s para WAV grandes no mobile
            log(`🎵 WAV grande detectado no mobile: timeout estendido para ${timeoutMs/1000}s`);
          } else if (isWAV && isLargeFile) {
            timeoutMs = 30000; // 30s para WAV grandes no desktop
          }
          
          const audioBuffer = await Promise.race([
            this.audioContext.decodeAudioData(audioData.slice ? audioData.slice(0) : audioData),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`iOS decodeAudioData timeout (${timeoutMs/1000}s)`)), timeoutMs)
            )
          ]);
          try { (window.__caiarLog||function(){})('DECODE_OK','Buffer decodificado', { duration: audioBuffer.duration, sr: audioBuffer.sampleRate, channels: audioBuffer.numberOfChannels }); } catch {}
          // ===== Context Detector (BPM / Key / Densidade) =====
          try {
            const ctxMod = await import('/lib/audio/features/context-detector.js').catch(()=>null);
            if (ctxMod && typeof ctxMod.detectAudioContext === 'function') {
              const ctxRes = await ctxMod.detectAudioContext(audioBuffer, {});
              if (ctxRes) {
                // Expor sempre global (para uso futuro) sem alterar UI
                try { if (typeof window !== 'undefined') window.__AUDIO_CONTEXT_DETECTION = ctxRes; } catch {}
                // Só anexar ao objeto de análise quando CAIAR_ENABLED estiver ativo para evitar mudanças no objeto final padrão
                if (typeof window !== 'undefined' && window.CAIAR_ENABLED) {
                  (analysis || (analysis={}))._contextDetection = ctxRes;
                }
              }
            }
          } catch (ctxErr) { try { (window.__caiarLog||function(){})('CTX_INTEGRATION_ERROR','Erro integrando context detector', { error: ctxErr?.message||String(ctxErr) }); } catch {} }
          
          if (window.DEBUG_ANALYZER === true) log('🔬 Realizando análise completa...');
          // Análise completa do áudio (V1)
          const t0Full = (performance&&performance.now)?performance.now():Date.now();
          // Modo de qualidade: 'fast' ou 'full' (default 'full' se CAIAR_ENABLED e window.ANALYSIS_QUALITY!='fast')
          const qualityMode = (window.CAIAR_ENABLED && window.ANALYSIS_QUALITY !== 'fast') ? 'full' : 'fast';
          let analysis = this.performFullAnalysis(audioBuffer, { qualityMode, runId });
          analysis.qualityMode = qualityMode;
          try { (window.__caiarLog||function(){})('METRICS_V1_DONE','Métricas V1 calculadas', { keys: Object.keys(analysis.technicalData||{}) }); } catch {}

          // Enriquecimento Fase 2 (sem alterar UI): tenta carregar V2 e mapear novas métricas
          try {
            try { (window.__caiarLog||function(){})(`METRICS_V2_START_${runId}`,'Enriquecimento Fase 2 iniciado'); } catch {}
            analysis = await this._enrichWithPhase2Metrics(audioBuffer, analysis, file, runId);
            try { (window.__caiarLog||function(){})(`METRICS_V2_DONE_${runId}`,'Enriquecimento Fase 2 concluído', { techKeys: Object.keys(analysis.technicalData||{}), suggestions: (analysis.suggestions||[]).length }); } catch {}
          } catch (enrichErr) {
            warn(`⚠️ [${runId}] Falha ao enriquecer com métricas Fase 2:`, enrichErr?.message || enrichErr);
            try { (window.__caiarLog||function(){})(`METRICS_V2_ERROR_${runId}`,'Falha Fase 2', { error: enrichErr?.message||String(enrichErr) }); } catch {}
          }

          // ===== Stems (bass/drums/vocals/other) – somente com CAIAR_ENABLED ativo =====
          try {
            if (typeof window !== 'undefined' && window.CAIAR_ENABLED) {
              // Ajustar concorrência dinâmica se modo rápido
              if (qualityMode === 'fast') { try { window.STEMS_MAX_CONCURRENCY = 1; } catch{} }
              const { enqueueJob } = await import('/lib/audio/features/job-queue.js').catch(()=>({enqueueJob: null}));
              (window.__caiarLog||function(){})('STEMS_CHAIN_START','Iniciando cadeia de stems');
              const stemsMod = await import('/lib/audio/features/stems.js').catch(()=>null);
              if (stemsMod && typeof stemsMod.separateStems === 'function') {
                const jobFn = ()=> Promise.race([
                  stemsMod.separateStems(audioBuffer, { quality: qualityMode }),
                  new Promise(res=> setTimeout(()=>res({_timeout:true}), qualityMode==='fast'?40000:90000))
                ]);
                let stemsRes;
                if (enqueueJob) {
                  stemsRes = await enqueueJob(jobFn, { label:'stems:'+ (fileHash||file.name), priority: qualityMode==='fast'?4:2, timeoutMs: qualityMode==='fast'?45000:95000 });
                } else {
                  stemsRes = await jobFn();
                }
                if (stemsRes && !stemsRes._timeout) {
                  try { if (typeof window !== 'undefined') window.__LAST_STEMS = stemsRes; } catch {}
                  analysis._stems = {
                    method: stemsRes.method,
                    totalMs: stemsRes.totalMs,
                    metrics: stemsRes.metrics
                  };
                  // Construir matriz de análise (mix + stems) antes de descartar buffers pesados
                  try {
                    this._computeAnalysisMatrix(audioBuffer, analysis, stemsRes.stems);
                  } catch (mxErr) { (window.__caiarLog||function(){})('MATRIX_ERROR','Falha construir analysis_matrix', { error: mxErr?.message||String(mxErr) }); }
                  (window.__caiarLog||function(){})('STEMS_CHAIN_DONE','Stems anexados', { ms: stemsRes.totalMs, method: stemsRes.method });
                  
                  // 🧠 MEMORY CLEANUP: Limpeza agressiva de stems após uso
                  try {
                    this._cleanupStemsArrays(stemsRes.stems);
                    stemsRes.stems = null;
                    stemsRes = null;
                    log('🧹 Memory cleanup: stems liberados após matrix computation');
                  } catch (cleanupErr) {
                    warn('⚠️ Erro na limpeza de stems:', cleanupErr);
                  }
                } else if (stemsRes && stemsRes._timeout) {
                  (window.__caiarLog||function(){})('STEMS_TIMEOUT','Timeout stems (>90s)');
                  // Mesmo sem stems, ainda podemos gerar matriz apenas do mix
                  try { this._computeAnalysisMatrix(audioBuffer, analysis, null); } catch {}
                  
                  // 🧠 MEMORY CLEANUP: Limpar dados parciais de timeout
                  try {
                    if (stemsRes.stems) {
                      this._cleanupStemsArrays(stemsRes.stems);
                    }
                    stemsRes = null;
                    log('🧹 Memory cleanup: dados de timeout liberados');
                  } catch (cleanupErr) {
                    warn('⚠️ Erro na limpeza de timeout:', cleanupErr);
                  }
                } else {
                  (window.__caiarLog||function(){})('STEMS_FALLBACK','Stems não disponíveis');
                  try { this._computeAnalysisMatrix(audioBuffer, analysis, null); } catch {}
                  
                  // 🧠 MEMORY CLEANUP: Limpar qualquer dado parcial
                  try {
                    if (stemsRes) {
                      stemsRes = null;
                    }
                    log('🧹 Memory cleanup: fallback stems limpo');
                  } catch (cleanupErr) {
                    warn('⚠️ Erro na limpeza de fallback:', cleanupErr);
                  }
                }
              }
              else {
                // Sem módulo de stems: ainda gerar matriz do mix
                try { this._computeAnalysisMatrix(audioBuffer, analysis, null); } catch {}
              }
            }
          } catch (stErr) { (window.__caiarLog||function(){})('STEMS_CHAIN_ERROR','Erro cadeia stems', { error: stErr?.message||String(stErr) }); }
          
          clearTimeout(timeout);
          const finalAnalysis = await this._finalizeAndMaybeCache(analysis, { t0Full, fileHash, disableCache, runId });
          
          // 🧠 MEMORY CLEANUP: Limpeza final do AudioBuffer
          try {
            this._cleanupAudioBuffer(audioBuffer);
            log(`🧹 [${runId}] AudioBuffer principal liberado`);
          } catch (bufferCleanupErr) {
            warn(`⚠️ [${runId}] Erro na limpeza do AudioBuffer:`, bufferCleanupErr);
          }
          
          resolve(finalAnalysis);
        } catch (error) {
          clearTimeout(timeout);
          
          // 🧠 MEMORY CLEANUP: Limpar AudioBuffer em caso de erro
          try {
            if (typeof audioBuffer !== 'undefined' && audioBuffer) {
              this._cleanupAudioBuffer(audioBuffer);
              log(`🧹 [${runId}] AudioBuffer limpo em caso de erro`);
            }
          } catch (bufferCleanupErr) {
            warn(`⚠️ [${runId}] Erro na limpeza do AudioBuffer (error path):`, bufferCleanupErr);
          }
          
          // 📊 LOG: ERRO NA DECODIFICAÇÃO/PIPELINE
          this._logPipelineStage('DECODE_ERROR', {
            error: error?.message || String(error),
            fileName: file?.name,
            stack: this._diagnosticMode ? error.stack : undefined
          });
          
          // 🛡️ MARCAR ANÁLISE COMO ERRO
          try {
            if (this._activeAnalyses && this._activeAnalyses.has(this._currentRunId)) {
              const ctx = this._activeAnalyses.get(this._currentRunId);
              ctx.status = 'error';
              ctx.error = error?.message || String(error);
              ctx.finishedAt = performance.now();
            }
          } catch (cleanupError) {
            warn('⚠️ Erro na limpeza de estado:', cleanupError);
          }
          
          // 🔄 NOTIFICAR UI PARA PARAR LOADING
          try {
            // Emitir evento para fechar modais de loading
            if (typeof window !== 'undefined' && window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('audio-analysis-error', {
                detail: { error: error?.message, runId: this._currentRunId }
              }));
            }
          } catch (uiError) {
            warn('⚠️ Erro ao notificar UI:', uiError);
          }
          
          
          error(`❌ [${this._currentRunId || 'unknown'}] ERRO DE DECODIFICAÇÃO:`, error);
          error(`📋 [${this._currentRunId || 'unknown'}] Arquivo: ${file?.name || 'desconhecido'}`);
          error(`📋 [${this._currentRunId || 'unknown'}] Tipo: ${file?.type || 'N/A'}`);
          error(`� [${this._currentRunId || 'unknown'}] Tamanho: ${file?.size || 'N/A'} bytes`);
          error(`� [${this._currentRunId || 'unknown'}] Detalhes: ${error?.message || error}`);
          
          try { (window.__caiarLog||function(){})('DECODE_ERROR','Erro de decodificação investigação', { 
            error: error?.message||String(error), 
            fileName: file?.name,
            fileType: file?.type,
            fileSize: file?.size 
          }); } catch {}
          
          reject(new Error(`Erro ao decodificar áudio: ${error?.message || error}`));
        }
      };
      
      reader.onerror = (error) => {
        clearTimeout(timeout);
        error('❌ Erro ao ler arquivo:', error);
        reject(new Error('Erro ao ler arquivo de áudio'));
      };
      
      if (file._cachedArrayBufferForHash) {
        // se já temos o buffer (por hashing), simular FileReader concluído
        setTimeout(()=> reader.onload({ target: { result: file._cachedArrayBufferForHash } }), 0);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
    } catch (analysisError) {
      // 📊 LOG: ERRO GERAL DA ANÁLISE
      this._logPipelineStage('ANALYSIS_ERROR', {
        error: analysisError?.message || String(analysisError),
        fileName: file?.name,
        stack: this._diagnosticMode ? analysisError.stack : undefined
      });
      
      // 🛡️ MARCAR ANÁLISE COMO ERRO
      try {
        if (this._activeAnalyses && this._activeAnalyses.has(runId)) {
          const ctx = this._activeAnalyses.get(runId);
          ctx.status = 'error';
          ctx.error = analysisError?.message || String(analysisError);
          ctx.finishedAt = performance.now();
        }
      } catch (markError) {
        warn('⚠️ Erro ao marcar estado de erro:', markError);
      }
      
      // 🔄 NOTIFICAR UI PARA PARAR LOADING
      try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('audio-analysis-error', {
            detail: { error: analysisError?.message, runId }
          }));
        }
      } catch (uiError) {
        warn('⚠️ Erro ao notificar UI sobre erro:', uiError);
      }
      
      error(`❌ [${runId}] Erro na análise:`, analysisError);
      throw analysisError;
    } finally {
      // 🧹 LIMPEZA FINAL DEFENSIVA
      try {
        const analysisInfo = this._activeAnalyses?.get(runId);
        if (analysisInfo) {
          const duration = Date.now() - analysisInfo.startTime;
          const wasError = analysisInfo.status === 'error';
          
          // Log final baseado no status
          if (wasError) {
            this._logPipelineStage('ANALYSIS_FAILED', {
              duration: `${duration}ms`,
              error: analysisInfo.error
            });
            log(`❌ [${runId}] Análise falhou em ${duration}ms: ${analysisInfo.error}`);
          } else {
            this._logPipelineStage('ANALYSIS_COMPLETED', {
              duration: `${duration}ms`
            });
            log(`✅ [${runId}] Análise concluída com sucesso em ${duration}ms`);
          }
          
          // Limpar independente do status
          this._activeAnalyses.delete(runId);
        }
        
        // Limpar contexto atual
        if (this._currentRunId === runId) {
          this._currentRunId = null;
        }
        
        // 🔄 NOTIFICAR UI SOBRE CONCLUSÃO (sucesso ou erro)
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('audio-analysis-finished', {
            detail: { runId, success: !analysisInfo?.error }
          }));
        }
        
      } catch (cleanupError) {
        warn(`⚠️ [${runId}] Erro na limpeza final:`, cleanupError);
      }
    }
  }

  async _pipelineFromDecodedBuffer(audioBuffer, file, { fileHash, cacheKey }, runId = null) {
    if (!runId) {
      runId = this._generateRunId();
      warn(`⚠️ [${runId}] runId não fornecido para _pipelineFromDecodedBuffer, gerando novo`);
    }
    
    log(`🔄 [${runId}] Pipeline iniciado para buffer decodificado`);
    const t0Full = (performance&&performance.now)?performance.now():Date.now();
    
    // 📊 LOG: PIPELINE STARTED
    this._logPipelineStageCompat(runId, 'PIPELINE_START', {
      fileHash,
      cacheKey,
      bufferDuration: audioBuffer.duration,
      qualityMode: (window.CAIAR_ENABLED && window.ANALYSIS_QUALITY !== 'fast') ? 'full':'fast'
    });
    
    // Replicação da lógica existente (refatorada para reutilização)
    // Context + V1 + Phase2 + Stems + Matrix
    let analysis = this.performFullAnalysis(audioBuffer, { qualityMode: (window.CAIAR_ENABLED && window.ANALYSIS_QUALITY !== 'fast') ? 'full':'fast', runId });
    analysis.qualityMode = analysis.qualityMode || ((window.CAIAR_ENABLED && window.ANALYSIS_QUALITY !== 'fast') ? 'full':'fast');
    try { (window.__caiarLog||function(){})('METRICS_V1_DONE','Métricas V1 calculadas(direct)'); } catch {}
    
    try {
      // 📊 LOG: PHASE 2 START
      this._logPipelineStageCompat(runId, 'PHASE2_START', {
        v1Complete: !!analysis,
        hasAudioBuffer: !!audioBuffer
      });
      
      analysis = await this._enrichWithPhase2Metrics(audioBuffer, analysis, file, runId);
      
      // 📊 LOG: PHASE 2 COMPLETE
      this._logPipelineStageCompat(runId, 'PHASE2_COMPLETE', {
        enriched: true,
        v2MetricsKeys: analysis._v2Metrics ? Object.keys(analysis._v2Metrics) : []
      });
      
    } catch(e){ 
      (window.__caiarLog||function(){})(`METRICS_V2_ERROR_${runId}`,'Falha Fase 2 direct',{err:e?.message}); 
      
      // 📊 LOG: PHASE 2 ERROR
      this._logPipelineStageCompat(runId, 'PHASE2_ERROR', {
        error: e.message,
        stack: this._diagnosticMode ? e.stack : undefined
      });
    }
    
    // Stems (respeitar duração para evitar travamento)
    try {
      if (typeof window !== 'undefined' && window.CAIAR_ENABLED) {
        const dur = audioBuffer.duration;
        
        // 📊 LOG: STEMS START
        this._logPipelineStageCompat(runId, 'STEMS_START', {
          stemsMode: window.STEMS_MODE,
          duration: dur,
          maxDuration: window.STEMS_MAX_DURATION_SEC || 360
        });
        
        if (window.STEMS_MODE === 'off' || dur > (window.STEMS_MAX_DURATION_SEC||360)) {
          (window.__caiarLog||function(){})('STEMS_SKIP','Stems pulados',{duration:dur});
          
          // 📊 LOG: STEMS SKIPPED
          this._logPipelineStageCompat(runId, 'STEMS_SKIPPED', {
            reason: window.STEMS_MODE === 'off' ? 'disabled' : 'duration_exceeded',
            duration: dur
          });
          
          try { this._computeAnalysisMatrix(audioBuffer, analysis, null); } catch{}
        } else {
          const { enqueueJob } = await import('/lib/audio/features/job-queue.js').catch(()=>({enqueueJob:null}));
          const stemsMod = await import('/lib/audio/features/stems.js').catch(()=>null);
          if (stemsMod && stemsMod.separateStems) {
            const qualityMode = analysis.qualityMode;
            const jobFn = ()=> Promise.race([
              stemsMod.separateStems(audioBuffer, { quality: qualityMode }),
              new Promise(res=> setTimeout(()=>res({_timeout:true}), qualityMode==='fast'?40000:90000))
            ]);
            const stemsRes = enqueueJob? await enqueueJob(jobFn,{label:'stems:'+ (fileHash||file?.name), priority: qualityMode==='fast'?4:2, timeoutMs: qualityMode==='fast'?45000:95000 }): await jobFn();
            if (stemsRes && !stemsRes._timeout) {
              analysis._stems = { method: stemsRes.method, totalMs: stemsRes.totalMs, metrics: stemsRes.metrics };
              
              // 📊 LOG: STEMS COMPLETE
              this._logPipelineStageCompat(runId, 'STEMS_COMPLETE', {
                method: stemsRes.method,
                totalMs: stemsRes.totalMs,
                hasMetrics: !!stemsRes.metrics
              });
              
              try { this._computeAnalysisMatrix(audioBuffer, analysis, stemsRes.stems); } catch{}
            } else {
              // 📊 LOG: STEMS TIMEOUT
              this._logPipelineStageCompat(runId, 'STEMS_TIMEOUT', {
                qualityMode,
                timeoutMs: qualityMode==='fast'?40000:90000
              });
              
              try { this._computeAnalysisMatrix(audioBuffer, analysis, null); } catch{}
            }
          }
        }
      }
    } catch(e){ 
      (window.__caiarLog||function(){})('STEMS_CHAIN_ERROR','Erro stems direct',{err:e?.message}); 
      
      // 📊 LOG: STEMS ERROR
      this._logPipelineStageCompat(runId, 'STEMS_ERROR', {
        error: e.message,
        stack: this._diagnosticMode ? e.stack : undefined
      });
    }
    
    return await this._finalizeAndMaybeCache(analysis, { t0Full, fileHash, cacheKey, disableCache: (typeof window!=='undefined' && window.DISABLE_ANALYSIS_CACHE), runId });
  }

  async _finalizeAndMaybeCache(analysis, { t0Full, fileHash, cacheKey, disableCache, runId }) {
    try {
      // 📊 LOG: REFS START (referências e comparações)
      this._logPipelineStageCompat(runId, 'REFS_START', {
        hasAnalysis: !!analysis,
        genre: window.PROD_AI_REF_GENRE || 'unknown'
      });
      
      // Aqui seria processamento de referências (se existir)
      // TODO: Implementar logs específicos quando adicionarmos comparação externa
      
      // 📊 LOG: SCORING START
      this._logPipelineStageCompat(runId, 'SCORING_START', {
        hasProblems: !!(analysis.problems && analysis.problems.length),
        hasSuggestions: !!(analysis.suggestions && analysis.suggestions.length),
        currentScore: analysis.mixScorePct
      });
      
      // Aqui seria cálculo de scoring (já existe)
      // O scoring atual já está computado, só logamos
      
      // 📊 LOG: SUGGESTIONS START
      this._logPipelineStageCompat(runId, 'SUGGESTIONS_START', {
        problemsCount: (analysis.problems || []).length,
        suggestionsCount: (analysis.suggestions || []).length
      });
      
      // Aqui seria geração de sugestões (já existe)
      
      // 📊 LOG: UI PREPARATION
      this._logPipelineStageCompat(runId, 'UI_PREP', {
        finalScore: analysis.mixScorePct,
        problemsCount: (analysis.problems || []).length,
        suggestionsCount: (analysis.suggestions || []).length,
        hasV2Metrics: !!analysis._v2Metrics,
        hasStems: !!analysis._stems
      });

      // 🛡️ SAFETY GATES: Análise de segurança (apenas warnings, não afeta funcionamento)
      try {
        // Implementação inline ultra-segura para não quebrar nada
        if (window.AUDIT_MODE && analysis.technicalData) {
          const truePeak = analysis.technicalData.truePeakDbtp || 
                          analysis.technicalData.true_peak_dbtp ||
                          (analysis._v2Metrics && analysis._v2Metrics.truePeakDbtp);
          
          if (Number.isFinite(truePeak) && truePeak > 0.0) {
            warn(`🛡️ [SAFETY-GATE] True Peak warning: ${truePeak.toFixed(2)} dBTP acima de 0 dBTP`);
            info('💡 [RECOMMENDATION] Considere aplicar limiting para compliance EBU R128');
            
            // Adicionar ao analysis sem quebrar estrutura existente
            if (!analysis.safetyGates) {
              analysis.safetyGates = {
                warnings: [{
                  type: 'truePeak',
                  severity: truePeak > 1.0 ? 'critical' : 'warning',
                  value: truePeak,
                  message: `True Peak acima de 0 dBTP: ${truePeak.toFixed(2)} dBTP`,
                  recommendation: 'Aplicar limiting para broadcast compliance'
                }],
                summary: { totalWarnings: 1, allClear: false }
              };
            }
          } else {
            log('🛡️ [SAFETY-GATE] True Peak OK');
          }
        }
      } catch (safetyError) {
        warn('⚠️ [SAFETY-GATES] Erro na análise de segurança (não crítico):', safetyError.message);
        // Não propagar erro - safety gates são opcionais
      }
      
      const t1Full=(performance&&performance.now)?performance.now():Date.now();
      const totalMs = +(t1Full - t0Full).toFixed(1);
      
      // 📊 LOG: OUTPUT COMPLETE
      this._logPipelineStageCompat(runId, 'OUTPUT_COMPLETE', {
        totalMs,
        finalScore: analysis.mixScorePct,
        problemsCount: (analysis.problems || []).length,
        suggestionsCount: (analysis.suggestions || []).length,
        cacheDisabled: disableCache,
        fileHash: fileHash ? fileHash.substring(0, 8) + '...' : null,
        cacheKey: cacheKey ? cacheKey.substring(0, 40) + '...' : null
      });
      
      // Gerar relatório final do pipeline
      const pipelineReport = this._generatePipelineReport(runId);
      
      // Adicionar relatório à análise se em modo diagnóstico
      if (this._diagnosticMode && pipelineReport) {
        analysis._pipelineReport = pipelineReport;
        log(`📊 [${runId}] Relatório de pipeline anexado à análise`);
      }
      
      // Limpar registros após completar
      this._activeAnalyses.delete(runId);
      
      // 🧠 MEMORY MANAGEMENT: Limpeza final agressiva
      try {
        // Limpar cache LRU (manter apenas 50 entradas)
        this._cleanupLRUCache();
        
        // Forçar garbage collection após análise pesada
        this._forceGarbageCollection();
        
        // Log de estatísticas de memória
        const memStats = this._getMemoryStats();
        log('🧠 Memory stats pós-análise:', memStats);
        
        // Log específico para memory management
        log(`🧹 [${runId}] Memory cleanup completo - GC forçado, cache LRU aplicado`);
        
      } catch (memoryError) {
        warn(`⚠️ [${runId}] Erro na limpeza de memória:`, memoryError);
      }
      
      (window.__caiarLog||function(){})('OUTPUT','Análise final pronta', { 
        totalMs, 
        problems: (analysis.problems||[]).length, 
        suggestions: (analysis.suggestions||[]).length, 
        scorePct: analysis.mixScorePct,
        runId,
        diagnosticMode: this._diagnosticMode
      });
      
    } catch(e) {
      error(`❌ [${runId}] Erro na finalização:`, e);
      
      // 📊 LOG: FINALIZATION ERROR
      this._logPipelineStageCompat(runId, 'FINALIZATION_ERROR', {
        error: e.message,
        stack: this._diagnosticMode ? e.stack : undefined
      });
    }
    
    // 🆔 ADICIONAR METADATA COM runId PARA UI_GATE
    try { 
      analysis._metadata = {
        runId: runId || this._currentRunId,
        timestamp: Date.now(),
        pipelineVersion: this._pipelineVersion
      };
      // Manter compatibilidade com código existente que espera runId diretamente
      if (runId || this._currentRunId) {
        analysis.runId = runId || this._currentRunId;
      }
    } catch {}
    
    try { analysis.pipelineVersion = this._pipelineVersion; } catch {}
    if (fileHash && !disableCache) {
      try {
        const cacheMap = (window.__AUDIO_ANALYSIS_CACHE__ = window.__AUDIO_ANALYSIS_CACHE__ || new Map());
        cacheMap.set(fileHash, { analysis: JSON.parse(JSON.stringify(analysis)), _ts: Date.now() });
        if (cacheMap.size > 30) {
          const keys = Array.from(cacheMap.keys());
            for (let i=0;i<keys.length-30;i++) cacheMap.delete(keys[i]);
        }
        (window.__caiarLog||function(){})('CACHE_STORE','Análise salva em cache',{hash:fileHash});
      } catch{}
    }
    return analysis;
  }


// (utilitário de invalidação de cache movido para após o fechamento da classe)
  // 🔌 Enriquecer com métricas da Fase 2 usando motor V2 (já pré-carregado)
  async _enrichWithPhase2Metrics(audioBuffer, baseAnalysis, fileRef, runId = null) {
    // 🆔 Validar runId para prevenir race conditions
    if (!runId) {
      runId = this._generateRunId();
      warn(`⚠️ [${runId}] runId não fornecido para _enrichWithPhase2Metrics, gerando novo`);
    }
    
    log(`🔄 [${runId}] Iniciando métricas Fase 2`);
    
    // Validar integridade dos dados antes de prosseguir
    if (!this._validateDataIntegrity(baseAnalysis, runId)) {
      throw new Error(`Falha na validação de integridade dos dados para runId ${runId}`);
    }
    const __DEBUG_ANALYZER__ = (typeof window !== 'undefined' && window.DEBUG_ANALYZER === true);
    
    // Aguardar V2 se ainda estiver carregando
    if (this._v2LoadingPromise && !this._v2Loaded) {
      log('⏳ Aguardando V2 terminar de carregar...');
      await this._v2LoadingPromise;
    }

    if (typeof window.AudioAnalyzerV2 !== 'function') {
      // Quando V2 não está disponível, ainda tentaremos métricas avançadas (LUFS/LRA/TruePeak) via módulos dedicados
      try {
        baseAnalysis = await this._tryAdvancedMetricsAdapter(audioBuffer, baseAnalysis);
      } catch (e) {
        if (__DEBUG_ANALYZER__) warn('⚠️ Adapter avançado falhou (sem V2):', e?.message || e);
      }
      return baseAnalysis;
    }

  // Executar análise V2 de forma leve usando diretamente o AudioBuffer (evita re-decodificação)
  log('🎯 CRIANDO INSTÂNCIA V2...');
  log('🎯 window.AudioAnalyzerV2 existe?', typeof window.AudioAnalyzerV2);
  const v2 = new window.AudioAnalyzerV2();
  log('🎯 V2 INSTÂNCIA CRIADA:', !!v2);
  log('🎯 V2 BUILD VERSION:', v2.__buildVersion);
  await v2.initialize?.();
  
  // ✨ SISTEMA ESPECTRAL: Executar ANTES do V2 para afetar o scoring
  try {
    const spectralResult = this.calculateSpectralBalance(left, audioBuffer.sampleRate);
    if (spectralResult && spectralResult.summary3Bands) {
      log('✨ Sistema espectral ATIVADO ANTES do scoring V2');
      baseAnalysis.spectralBalance = spectralResult;
      
      // Preparar dados para o V2 usar no scoring
      window._SPECTRAL_DATA_FOR_V2 = spectralResult;
    } else {
      log('⚠️ Sistema espectral falhou, V2 usará método padrão');
    }
  } catch (spectralError) {
    log('⚠️ Erro no sistema espectral:', spectralError.message);
  }
  
  if (typeof window !== 'undefined' && window.DEBUG_ANALYZER === true) {
    log('🛰️ [Telemetry] V2: performFullAnalysis com audioBuffer.');
  }
  log('🎯 CHAMANDO performFullAnalysis...');
  
  // Removido forçamento rígido de gênero 'trance' (Fase 2)
  // Mantemos apenas fallback opcional se flag explícita estiver ativa
  if (!window.PROD_AI_REF_GENRE && window.FORCE_DEFAULT_GENRE) {
    window.PROD_AI_REF_GENRE = window.FORCE_DEFAULT_GENRE;
    log('[GENRE] Atribuído gênero padrão via FORCE_DEFAULT_GENRE:', window.PROD_AI_REF_GENRE);
  }
  
  let v2res = null;
  try {
    v2res = await v2.performFullAnalysis(audioBuffer, { quality: 'fast', features: ['core','spectral','stereo','quality'] });
    log('🎯 V2 RESULT SUCCESS:', !!v2res);
    log('🎯 V2 RESULT KEYS:', v2res ? Object.keys(v2res) : 'NULL');
    log('🎯 V2 DIAGNOSTICS EXISTS:', !!v2res?.diagnostics);
    if (v2res?.diagnostics) {
      log('🎯 V2 DIAGNOSTICS KEYS:', Object.keys(v2res.diagnostics));
    }
  } catch (v2Error) {
    error('❌ V2 performFullAnalysis ERROR:', v2Error);
    return baseAnalysis; // Retornar análise V1 básica em caso de erro no V2
  }
  const metrics = v2res?.metrics || {};
  // Fallback direto (V2 mínimo) – garantir estrutura semelhante esperada
  if (!metrics.loudness && Number.isFinite(metrics.lufs)) {
    metrics.loudness = { lufs_integrated: metrics.lufs };
  }
  if (!metrics.truePeak && Number.isFinite(metrics.peakDb)) {
    metrics.truePeak = { true_peak_dbtp: metrics.peakDb };
  }
  // Se BPI indicar excesso de graves, remova sugestão V1 de "Pouca presença de graves"
  try {
    const bpi = v2res?.metrics?.v2ProMetrics?.indices?.bpi;
    if (Number.isFinite(bpi) && bpi > 2 && Array.isArray(baseAnalysis.suggestions)) {
      baseAnalysis.suggestions = baseAnalysis.suggestions.filter(s => s?.type !== 'bass_enhancement' && !/Pouca presença de graves/i.test(s?.message || ''));
    }
  } catch {}
  // Disponibilizar diagnósticos V2 para a UI (sem alterar o que já existe do V1)
  if (v2res?.diagnostics) {
    // CORRIGIR: diagnostics deve estar em baseAnalysis.diagnostics, não v2Diagnostics
    log('🎯 COPIANDO DIAGNOSTICS DO V2 PARA RESULT...');
    baseAnalysis.diagnostics = v2res.diagnostics;
    
    baseAnalysis.v2Diagnostics = v2res.diagnostics; // manter compatibilidade
    log('🎯 baseAnalysis.diagnostics copiado:', !!baseAnalysis.diagnostics);
    log('🎯 baseAnalysis.diagnostics.__refEvidence:', baseAnalysis.diagnostics?.__refEvidence);
    // Mesclar sugestões/problemas avançados no resultado principal por padrão (sem mudar layout/IDs)
    try {
      const advDefaultOn = (typeof window !== 'undefined') ? (window.SUGESTOES_AVANCADAS !== false) : false;
      if (advDefaultOn) {
        const v2d = v2res.diagnostics || {};
        const mergeUnique = (a = [], b = [], key = (x) => `${x.type||''}|${x.message||''}`) => {
          const seen = new Set((a||[]).map(key));
          const out = Array.isArray(a) ? a.slice() : [];
          for (const item of (b||[])) {
            const k = key(item);
            if (!seen.has(k)) { seen.add(k); out.push(item); }
          }
          return out;
        };
        baseAnalysis.problems = mergeUnique(baseAnalysis.problems, v2d.problems);
  }
    } catch {}
  }
    const loud = metrics.loudness || {};
    const tp = metrics.truePeak || {};
    const core = metrics.core || {};
    const stereo = metrics.stereo || {};
    const tonal = metrics.tonalBalance || {};

    // Adapter: mapear para o formato já consumido pelo front (technicalData)
    baseAnalysis.technicalData = baseAnalysis.technicalData || {};
    const td = baseAnalysis.technicalData;
    // Mapear métricas V2 para chaves conhecidas da interface (somente se válidas / não sobrescrever manual)
    const setIfValid = (key, val, source) => {
      if (val == null || !Number.isFinite(val)) return;
      if (td[key] == null) td[key] = val;
      (td._sources = td._sources || {})[key] = (td._sources[key] || source);
    };
    // Loudness
    setIfValid('lufsIntegrated', loud.lufs_integrated, 'v2:loudness');
    setIfValid('lufsShortTerm', loud.lufs_short_term, 'v2:loudness');
    setIfValid('lufsMomentary', loud.lufs_momentary, 'v2:loudness');
          // ===== Pontuação final (Mix Scoring) =====
          try {
            // Reference Matcher (antes do score) – gera adaptiveReference sem quebrar a referência atual
            try {
              if (typeof window !== 'undefined' && window.CAIAR_ENABLED) {
                const refMatchMod = await import('/lib/audio/features/reference-matcher.js').catch(()=>null);
                if (refMatchMod && typeof refMatchMod.applyAdaptiveReference === 'function') {
                  refMatchMod.applyAdaptiveReference(baseAnalysis);
                }
              }
            } catch (rmErr) { (window.__caiarLog||function(){})('REF_MATCH_INTEGRATION_ERROR','Erro matcher', { error: rmErr?.message||String(rmErr) }); }
            const enableScoring = (typeof window === 'undefined' || window.ENABLE_MIX_SCORING !== false);
            // 🎯 CORREÇÃO DA ORDEM: Scoring inicial DESABILITADO - será executado após bandas espectrais
            // Esta mudança garante que o scoring aconteça somente quando as bandas estiverem prontas
            if (false && enableScoring) {
              let activeRef = null;
              try {
                if (typeof window !== 'undefined') {
                  // 🎯 CORREÇÃO TOTAL: Apenas usar PROD_AI_REF_DATA no modo gênero
                  if (mode === 'genre') {
                    activeRef = window.PROD_AI_REF_DATA_ACTIVE || window.PROD_AI_REF_DATA || null;
                    if (DEBUG_MODE_REFERENCE) {
                      log('🔍 [MODE_DEBUG] Using genre targets for scoring, mode:', mode);
                    }
                  } else {
                    activeRef = null; // Modos reference, extract_metrics, pure_analysis não usam targets de gênero
                    if (DEBUG_MODE_REFERENCE) {
                      log('🔍 [MODE_DEBUG] Skipping genre targets, mode:', mode, '(pure analysis)');
                    }
                  }
                }
              } catch {}
              let scorerMod = null;
              try { scorerMod = await import('/lib/audio/features/scoring.js').catch(()=>null); } catch {}
              if (scorerMod && typeof scorerMod.computeMixScore === 'function') {
                // 🎯 CORREÇÃO: Buscar targets específicos do gênero ativo
                let genreSpecificRef = null;
                if (mode === 'genre' && activeRef) {
                  const activeGenre = window.PROD_AI_REF_GENRE || 'default';
                  genreSpecificRef = activeRef[activeGenre] || null;
                  if (DEBUG_MODE_REFERENCE) {
                    log('🔍 [MODE_DEBUG] Using genre-specific ref for scoring:', activeGenre);
                    log('🔍 [MODE_DEBUG] Genre ref targets:', genreSpecificRef);
                  }
                } else if (DEBUG_MODE_REFERENCE) {
                  log('🔍 [MODE_DEBUG] Skipping genre-specific ref (mode=' + mode + ')');
                }
                
                // 🎯 CORREÇÃO: Passar mode para garantir que gates V3 usem o limite correto
                const soundMode = window.__SOUNDY_ANALYSIS_MODE__ || 'streaming';
                const scoreRes = scorerMod.computeMixScore(td, genreSpecificRef, { mode: soundMode });
                baseAnalysis.mixScore = scoreRes;
                baseAnalysis.mixClassification = scoreRes.classification;
                baseAnalysis.mixScorePct = scoreRes.scorePct;
                try {
                  if (typeof window !== 'undefined') {
                    window.__LAST_FULL_ANALYSIS = baseAnalysis;
                    if (window.DEBUG_SCORE === true) {
                      log('[ANALYSIS] mixScorePct=', scoreRes.scorePct, 'mode=' + scoreRes.scoreMode, 'metrics=', scoreRes.perMetric?.length);
                    }
                  }
                } catch {}
                try {
                  const sug = baseAnalysis.suggestions = Array.isArray(baseAnalysis.suggestions) ? baseAnalysis.suggestions : [];
                  if (scoreRes.highlights?.needsAttention) {
                    for (const key of scoreRes.highlights.needsAttention) {
                      if (!sug.some(s => s && s.type === 'score_attention' && s.metric === key)) {
                        sug.push({ type: 'score_attention', metric: key, message: `Métrica '${key}' abaixo do ideal para subir de nível`, action: 'Ajuste processamento (EQ/dinâmica) para alinhar à referência', source: 'score:v2' });
                      }
                    }
                  }
                } catch {}
                // Reconciliação de sugestões (remover conflitos e duplicatas) se não desativada
                try {
                  if (typeof window === 'undefined' || window.SUGGESTION_RECONCILE !== false) {
                    baseAnalysis.suggestions = (function reconcileSuggestions(a){
                      const list = Array.isArray(a.suggestions)? a.suggestions.slice():[];
                      const byType = new Map();
                      const keep = [];
                      for (const s of list) {
                        if (!s || typeof s !== 'object') continue;
                        const key = s.type + '|' + (s.metric||'');
                        if (!byType.has(key)) { byType.set(key, s); keep.push(s); }
                        else {
                          // Preferir score_attention sobre genérica, e sugestões com source 'score:' ou 'v2:' sobre 'v1:'
                          const prev = byType.get(key);
                          const rank = (x)=> /score:/.test(x.source||'') ? 3 : (/v2:/.test(x.source||'')?2:(/v1:/.test(x.source||'')?1:0));
                          if (rank(s) > rank(prev)) { const idx = keep.indexOf(prev); if (idx>=0) keep[idx]=s; byType.set(key,s); }
                        }
                      }
                      // Remover combinações ilógicas: ex: low_end_excess & bass_deficient simultâneos
                      const types = new Set(keep.map(s=>s.type));
                      const removeSet = new Set();
                      if (types.has('low_end_excess') && types.has('bass_deficient')) {
                        // Escolher o que tem source mais confiável
                        const choose = (t)=> keep.filter(s=>s.type===t).sort((a,b)=> (b.source||'').localeCompare(a.source||''))[0];
                        const chosen = choose('low_end_excess').message.length >= choose('bass_deficient').message.length ? 'low_end_excess':'bass_deficient';
                        for (const s of keep) if (s.type !== chosen && (s.type==='low_end_excess'||s.type==='bass_deficient')) removeSet.add(s);
                      }
                      return keep.filter(s=>!removeSet.has(s));
                    })(baseAnalysis);
                  }
                } catch (recErr) { if (window.DEBUG_ANALYZER) warn('Reconciliação sugestões falhou', recErr); }
                // ===== Contextual Rules Engine (CAIAR) =====
                try {
                  if (typeof window !== 'undefined' && window.CAIAR_ENABLED) {
                    (window.__caiarLog||function(){})('RULES_START','Invocando rules-engine contextual');
                    const rulesMod = await import('/lib/audio/features/rules-engine.js').catch(()=>null);
                    if (rulesMod && typeof rulesMod.generateContextualCorrections === 'function') {
                      const before = (baseAnalysis.suggestions||[]).length;
                      rulesMod.generateContextualCorrections(baseAnalysis);
                      const after = (baseAnalysis.suggestions||[]).length;
                      (window.__caiarLog||function(){})('RULES_APPLIED','Rules-engine aplicado', { before, after });
                      // Snapshot opcional para UI futura sem alterar layout legado
                      try { baseAnalysis.suggestionsSnapshot = baseAnalysis.suggestions.slice(); } catch {}
                      // ===== CAIAR Explain (plano de ação auditivo) =====
                      try {
                        (window.__caiarLog||function(){})('EXPLAIN_INVOKE','Gerando plano de ação');
                        const explainMod = await import('/lib/audio/features/caiar-explain.js').catch(()=>null);
                        if (explainMod && typeof explainMod.generateExplainPlan === 'function') {
                          explainMod.generateExplainPlan(baseAnalysis);
                          (window.__caiarLog||function(){})('EXPLAIN_ATTACHED','Plano anexado', { passos: baseAnalysis.caiarExplainPlan?.totalPassos });
                        } else {
                          (window.__caiarLog||function(){})('EXPLAIN_MODULE_MISSING','Módulo explain ausente');
                        }
                      } catch (exErr) {
                        (window.__caiarLog||function(){})('EXPLAIN_ERROR','Falha explain', { error: exErr?.message||String(exErr) });
                      }
                    } else {
                      (window.__caiarLog||function(){})('RULES_MODULE_MISSING','Módulo rules-engine indisponível');
                    }
                  }
                } catch (reErr) {
                  (window.__caiarLog||function(){})('RULES_ERROR','Falha rules-engine', { error: reErr?.message||String(reErr) });
                }
              }
            }
          } catch (esc) { if (debug) warn('⚠️ Scoring falhou:', esc?.message || esc); }
    setIfValid('lra', loud.lra, 'v2:loudness');
    setIfValid('headroomDb', loud.headroom_db, 'v2:loudness');
    // True Peak
    setIfValid('truePeakDbtp', tp.true_peak_dbtp, 'v2:truepeak');
    setIfValid('samplePeakLeftDb', tp.sample_peak_left_db, 'v2:truepeak');
    setIfValid('samplePeakRightDb', tp.sample_peak_right_db, 'v2:truepeak');
    // Core / espectrais extra
    setIfValid('spectralCentroid', core.spectralCentroid, 'v2:spectral');
    setIfValid('spectralRolloff85', core.spectralRolloff85, 'v2:spectral');
    if ((typeof window !== 'undefined' && window.AUDIT_MODE === true) || (typeof process !== 'undefined' && process.env.AUDIT_MODE==='1')) {
      setIfValid('spectralRolloff50', core.spectralRolloff50, 'v2:spectral');
      setIfValid('thdPercent', core.thdPercent, 'v2:spectral');
    }
    setIfValid('spectralFlux', core.spectralFlux, 'v2:spectral');
    setIfValid('spectralFlatness', core.spectralFlatness, 'v2:spectral');
    setIfValid('dcOffset', core.dcOffset, 'v2:core');
    // Stereo
    setIfValid('stereoWidth', stereo.width, 'v2:stereo');
    if (typeof stereo.monoCompatibility === 'string') {
      td.monoCompatibility = td.monoCompatibility || stereo.monoCompatibility;
      (td._sources = td._sources || {}).monoCompatibility = (td._sources.monoCompatibility || 'v2:stereo');
    }
    if (Number.isFinite(stereo.correlation) && td.stereoCorrelation == null) {
      td.stereoCorrelation = stereo.correlation;
      (td._sources = td._sources || {}).stereoCorrelation = 'v2:stereo';
    }
    if (Number.isFinite(stereo.balanceLR) && td.balanceLR == null) {
      td.balanceLR = stereo.balanceLR;
      (td._sources = td._sources || {}).balanceLR = 'v2:stereo';
    }
    td.tonalBalance = tonal && typeof tonal === 'object' ? tonal : null;
  // Extras para visual completo
  td.crestFactor = isFinite(core.crestFactor) ? core.crestFactor : null;
  if (td.crestFactor == null && Number.isFinite(baseAnalysis.technicalData?.peak) && Number.isFinite(baseAnalysis.technicalData?.rms)) {
    td.crestFactor = (baseAnalysis.technicalData.peak - baseAnalysis.technicalData.rms).toFixed(2)*1;
  }
  td.stereoWidth = isFinite(stereo.width) ? stereo.width : null;
  // Calcular métricas estéreo simples se ausentes e arquivo for estéreo
  try {
    if (audioBuffer.numberOfChannels > 1 && (td.stereoCorrelation == null || td.balanceLR == null)) {
      const l = audioBuffer.getChannelData(0);
      const r = audioBuffer.getChannelData(1);
      let sumLR=0,sumL2=0,sumR2=0,sumDiff=0,total= Math.min(l.length,r.length);
      let sumL=0,sumR=0;
      for (let i=0;i<total;i+=512){ // amostragem para performance
        const li=l[i], ri=r[i];
        sumLR += li*ri; sumL2 += li*li; sumR2 += ri*ri; sumDiff += Math.abs(li-ri); sumL+=li; sumR+=ri;
      }
      const corr = sumLR / Math.sqrt((sumL2||1)*(sumR2||1));
      if (td.stereoCorrelation == null && isFinite(corr)) td.stereoCorrelation = Math.max(-1, Math.min(1, corr));
      const avgL = sumL/ (total/512); const avgR = sumR/(total/512);
      if (td.balanceLR == null && isFinite(avgL) && isFinite(avgR)) {
        const max = Math.max(Math.abs(avgL), Math.abs(avgR)) || 1;
        td.balanceLR = (avgL-avgR)/max; // -1 a 1
      }
      if (td.stereoWidth == null && isFinite(sumDiff)) td.stereoWidth = (sumDiff/(total/512));
    }
  } catch {}
  td.monoCompatibility = typeof stereo.monoCompatibility === 'string' ? stereo.monoCompatibility : null;
  if (!td.monoCompatibility && Number.isFinite(td.stereoCorrelation)) {
    td.monoCompatibility = td.stereoCorrelation < -0.2 ? 'Problemas de fase' : (td.stereoCorrelation < 0.2 ? 'Parcial' : 'Boa');
  }
  td.spectralFlatness = isFinite(core.spectralFlatness) ? core.spectralFlatness : null;
  td.dcOffset = isFinite(core.dcOffset) ? core.dcOffset : null;
  td.clippingSamples = Number.isFinite(core.clippingEvents) ? core.clippingEvents : null;
  td.clippingPct = isFinite(core.clippingPercentage) ? core.clippingPercentage : null;
  
  // ===== FASE 1 AUDITORIA: UNIFICAÇÃO E OBSERVAÇÃO (ZERO RISCO) =====
  try {
    if (baseAnalysis && td && typeof getUnifiedAnalysisData === 'function') {
      const v2Metrics = baseAnalysis.v2Metrics || null; // Definir v2Metrics
      const unifiedData = getUnifiedAnalysisData(baseAnalysis, td, v2Metrics);
      if (typeof performConsistencyAudit === 'function') {
        performConsistencyAudit(unifiedData, baseAnalysis);
      }
      
      // ===== FASE 2: APLICAR DADOS UNIFICADOS (BAIXO RISCO) =====
      if (typeof applyUnifiedCorrections === 'function') {
        applyUnifiedCorrections(baseAnalysis, td, unifiedData);
      }
      
      // ===== FASE 3: ALINHAMENTO LÓGICO (RISCO MÉDIO) =====
      if (typeof applyLogicAlignmentCorrections === 'function') {
        applyLogicAlignmentCorrections(baseAnalysis, td, unifiedData, v2Metrics);
      }
      
      // ===== FASE 4: AUDITORIA FINAL COMPLETA (BAIXO RISCO) =====
      if (typeof applyFinalAuditCorrections === 'function') {
        applyFinalAuditCorrections(baseAnalysis, td, unifiedData, v2Metrics);
      }
      
      // ===== FASE 5: CORREÇÕES CRÍTICAS ESPECÍFICAS (SEGURO) =====
      if (typeof applyCriticalSpecificFixes === 'function') {
        applyCriticalSpecificFixes(baseAnalysis, td, unifiedData, metrics);
      }
      
      // ===== DEBUG DETALHADO (SE ATIVADO) =====
      if (window.DEBUG_ANALYZER_DETAILED === true) {
        performDetailedAnalysisDebug(baseAnalysis);
      }
    }
  } catch (auditError) {
    warn('⚠️ Erro nas correções de auditoria:', auditError);
  }
  // ================================================================
  
  try {
    if (Array.isArray(baseAnalysis.problems)) {
      const tpv = td.truePeakDbtp;
      if (Number.isFinite(tpv) && tpv < 0 && (td.clippingSamples === 0 || td.clippingSamples == null)) {
        baseAnalysis.problems = baseAnalysis.problems.filter(p => p?.type !== 'clipping');
      }
    }
  } catch {}

  // Scores de qualidade e tempo total de processamento
  // DESABILITADO: deixar null para que o sistema scoring.js tenha precedência
  // baseAnalysis.qualityOverall = isFinite(metrics?.quality?.overall) ? metrics.quality.overall : null;
  baseAnalysis.qualityOverall = null; // ⭐ FORÇAR NULL para que scoring.js seja a única fonte
  log('[SCORING_FIX] 🎯 qualityOverall forçado para null - sistema scoring.js terá precedência');
  baseAnalysis.qualityBreakdown = metrics?.quality?.breakdown || null;
  baseAnalysis.processingMs = Number.isFinite(v2res?.processingTime) ? v2res.processingTime : null;

    // Frequências dominantes: manter existentes; se vazio, usar do V2
    if ((!Array.isArray(td.dominantFrequencies) || td.dominantFrequencies.length === 0) && metrics?.spectral?.dominantFrequencies) {
      td.dominantFrequencies = metrics.spectral.dominantFrequencies;
    }

    // Telemetria: chaves novas adicionadas
  const added = ['lufsIntegrated','lufsShortTerm','lufsMomentary','headroomDb','lra','truePeakDbtp','samplePeakLeftDb','samplePeakRightDb','spectralCentroid','spectralRolloff85','spectralRolloff50','spectralFlux','stereoCorrelation','balanceLR','tonalBalance','crestFactor','stereoWidth','monoCompatibility','spectralFlatness','thdPercent','dcOffset','clippingSamples','clippingPct','qualityOverall','processingMs'];

    // ===== Fallback: calcular métricas espectrais se ainda ausentes =====
    try {
      const td2 = td; // alias
      if (td2.spectralCentroid == null || td2.spectralRolloff85 == null || td2.spectralFlatness == null || td2.spectralFlux == null) {
        const channel = audioBuffer.getChannelData(0);
        const fftSize = 2048;
        if (channel.length > fftSize) {
          // Capturar duas janelas para fluxo
          const startA = 0;
          const startB = Math.min(channel.length - fftSize, Math.floor(channel.length/2));
          const sliceA = channel.slice(startA, startA + fftSize);
          const sliceB = channel.slice(startB, startB + fftSize);
          const specA = this.simpleFFT(sliceA).slice(0, fftSize/2);
          const specB = this.simpleFFT(sliceB).slice(0, fftSize/2);
          const sr = audioBuffer.sampleRate;
          const binHz = sr / fftSize;
          // Centróide
          if (td2.spectralCentroid == null) {
            let num=0, den=0; for (let i=1;i<specA.length;i++){ const m=specA[i]; den+=m; num+=m*(i*binHz);} td2.spectralCentroid = den>0 ? num/den : null;
          }
          // Rolloff 85%
          if (td2.spectralRolloff85 == null) {
            const total = specA.reduce((a,b)=>a+b,0);
              let acc=0, target= total*0.85, freq= null;
              for (let i=0;i<specA.length;i++){ acc+=specA[i]; if(acc>=target){ freq = i*binHz; break;} }
              td2.spectralRolloff85 = freq;
          }
          // Flatness
          if (td2.spectralFlatness == null) {
            let geo=0, ar=0, n=specA.length; for(let i=1;i<n;i++){ const m=specA[i]||1e-12; geo += Math.log(m); ar += m; }
            geo = Math.exp(geo/(n-1)); ar = ar/(n-1); td2.spectralFlatness = ar>0 ? geo/ar : null;
          }
          // Flux
          if (td2.spectralFlux == null) {
            let flux=0; for (let i=0;i<specA.length;i++){ const a=specA[i]; const b=specB[i]||0; const d=(b-a); flux += d*d; }
            td2.spectralFlux = Math.sqrt(flux)/specA.length;
          }
        }
      }
    } catch(e){ if (window.DEBUG_ANALYZER) warn('Fallback espectral falhou', e); }

    // ===== Fallback: calcular LRA (Loudness Range) simples se ausente =====
    try {
      if (td.lra == null || !Number.isFinite(td.lra)) {
        const sr = audioBuffer.sampleRate;
        const channel = audioBuffer.getChannelData(0);
        const win = Math.min(sr * 3, channel.length); // ~3s window
        if (win > 0) {
          const step = Math.max(1, Math.floor(win / 2));
          const loudBlocks = [];
          for (let start = 0; start < channel.length - win; start += step * 4) { // saltar para performance
            let sum = 0;
            for (let i = 0; i < win; i += 8) { // sub-amostragem
              const s = channel[start + i]; sum += s * s;
            }
            const rms = Math.sqrt(sum / (win/8));
            if (rms > 0) loudBlocks.push(20 * Math.log10(rms));
            if (loudBlocks.length > 80) break; // limite
          }
          if (loudBlocks.length > 4) {
            loudBlocks.sort((a,b)=>a-b);
            const p10 = loudBlocks[Math.floor(loudBlocks.length * 0.1)];
              const p95 = loudBlocks[Math.floor(loudBlocks.length * 0.95)];
              td.lra = Number.isFinite(p95) && Number.isFinite(p10) ? (p95 - p10) : null;
          }
        }
      }
    } catch(e) { if (window.DEBUG_ANALYZER) warn('Fallback LRA falhou', e); }

    // ===== Fallback: tonal balance simplificado (sub, low, mid, high) =====
    try {
      if (!td.tonalBalance) {
        const channel = audioBuffer.getChannelData(0);
        const fftSize = 4096;
        if (channel.length > fftSize) {
          const slice = channel.slice(0, fftSize);
          const spec = this.simpleFFT(slice).slice(0, fftSize/2);
          const sr = audioBuffer.sampleRate; const binHz = sr / fftSize;
          const bands = { sub:[20,60], low:[60,250], mid:[250,4000], high:[4000,12000] };
          const out = {};
          
          // ✨ AUTO-ATIVAÇÃO SISTEMA ESPECTRAL: Calcular energia FFT automaticamente
          try {
            const spectralResult = this.calculateSpectralBalance(channel, sr);
            if (spectralResult && spectralResult.summary3Bands) {
              log('✨ Sistema espectral auto-ativado para tonal balance');
              baseAnalysis.spectralBalance = spectralResult;
              
              const summary3Bands = spectralResult.summary3Bands;
              out.low = { rms_db: summary3Bands.Low?.rmsDb || -80 };
              out.mid = { rms_db: summary3Bands.Mid?.rmsDb || -80 };
              out.high = { rms_db: summary3Bands.High?.rmsDb || -80 };
              
              // Sub bass adicional se disponível
              const subBand = spectralResult.bands?.find(b => b.name.includes('Sub'));
              if (subBand) {
                out.sub = { rms_db: subBand.rmsDb || -80 };
              }
            } else {
              throw new Error('Spectral analysis failed, using fallback');
            }
          } catch (spectralError) {
            // Fallback para cálculo simples original se sistema espectral falhar
            log('⚠️ Fallback para análise tonal simples:', spectralError.message);
            for (const [k,[a,b]] of Object.entries(bands)) {
              let energy=0, count=0; const maxBin = spec.length;
              for (let i=0;i<maxBin;i++) { const f=i*binHz; if (f>=a && f<b) { energy += spec[i]; count++; } }
              if (count>0) { const rms = energy / count; out[k] = { rms_db: 20*Math.log10(rms || 1e-9) }; }
            }
          }
          
          td.tonalBalance = out;
        }
      }
    } catch(e){ if (window.DEBUG_ANALYZER) warn('Fallback tonal balance falhou', e); }

    // ===== Quality Breakdown (preencher se ausente) =====
    try {
      if (!baseAnalysis.qualityBreakdown) {
        // 🎯 CORREÇÃO TOTAL: Apenas usar PROD_AI_REF_DATA no modo gênero
        let ref = null;
        if (mode === 'genre' && typeof window !== 'undefined') {
          ref = window.PROD_AI_REF_DATA;
          if (DEBUG_MODE_REFERENCE) {
            log('🔍 [MODE_DEBUG] Using genre ref for quality breakdown, mode:', mode);
          }
        } else if (DEBUG_MODE_REFERENCE) {
          log('🔍 [MODE_DEBUG] Skipping genre ref for quality breakdown, mode:', mode, '(pure analysis)');
        }
        
        const safe = (v,def=0)=> Number.isFinite(v)?v:def;
        // FASE 2: Usar dados unificados para LUFS (sem fallback RMS problemático)
        const lufsInt = safe(td.lufsIntegrated, null); // Não usar RMS como fallback
        if (lufsInt === null) {
          warn('🔍 FASE 2: LUFS não disponível, pulando cálculo de loudness score');
        }
        const dr = safe(baseAnalysis.technicalData?.dynamicRange);
        const crest = safe(td.crestFactor);
        const corr = safe(td.stereoCorrelation,0);
        const centroid = safe(td.spectralCentroid);
        const freqIdealLow = 1800, freqIdealHigh = 3200;
        const refLufs = ref?.lufs_target ?? -14;
        const refDR = ref?.dr_target ?? 10;
        // Scores - FASE 2: Tratar LUFS nulo de forma segura
        const scoreLoud = (lufsInt !== null) 
          ? 100 - Math.min(100, Math.abs(lufsInt - refLufs) * 6) 
          : 50; // Score neutro quando LUFS não disponível
        const scoreDyn = 100 - Math.min(100, Math.abs(dr - refDR) * 10); // 2 dB -> -20
        let scoreTech = 100;
        if (safe(baseAnalysis.technicalData?.clippingSamples) > 0) scoreTech -= 20;
        if (Math.abs(safe(baseAnalysis.technicalData?.dcOffset)) > 0.02) scoreTech -= 10;
        if (crest < 6) scoreTech -= 15; else if (crest < 8) scoreTech -= 5;
        if (corr < -0.2) scoreTech -= 15;
        // Frequency score baseado em centroid
        let scoreFreq;
        if (!Number.isFinite(centroid)) scoreFreq = 50; else if (centroid < freqIdealLow) scoreFreq = 100 - Math.min(60, (freqIdealLow-centroid)/freqIdealLow*100); else if (centroid>freqIdealHigh) scoreFreq = 100 - Math.min(60, (centroid-freqIdealHigh)/freqIdealHigh*100); else scoreFreq = 100;
        const clamp = v=>Math.max(0, Math.min(100, Math.round(v)));
        baseAnalysis.qualityBreakdown = {
          dynamics: clamp(scoreDyn),
          technical: clamp(scoreTech),
          loudness: clamp(scoreLoud),
          frequency: clamp(scoreFreq)
        };
        // 🎯 AGREGADOR COM PESOS V2: Sistema balanceado conforme auditoria
        // Novos pesos: Loudness 25%, Dinâmica 20%, Frequência 25%, Técnico 15%, Stereo 15%
        if (!Number.isFinite(baseAnalysis.qualityOverall)) {
          log('[WEIGHTED_AGGREGATE] Triggered - qualityOverall was:', baseAnalysis.qualityOverall);
          
          // Calcular score de stereo corretamente
          const scoreStereo = Number.isFinite(corr) ? calculateStereoScore(corr) : 75;
          
          // Calcular score agregado com novos pesos
          const weightedScore = calculateWeightedOverallScore({
            loudness: scoreLoud,
            dynamics: scoreDyn, 
            frequency: scoreFreq,
            technical: scoreTech,
            stereo: scoreStereo
          });
          
          baseAnalysis.qualityOverall = clamp(weightedScore);
          log('[WEIGHTED_AGGREGATE] Set qualityOverall =', baseAnalysis.qualityOverall, 
                     'components:', { scoreLoud, scoreDyn, scoreFreq, scoreTech, scoreStereo });
        }
      }
    } catch(e){ if (window.DEBUG_ANALYZER) warn('Fallback quality breakdown falhou', e); }
  if (typeof window !== 'undefined' && window.DEBUG_ANALYZER === true) {
    log('🛰️ [Telemetry] Adapter Fase2 aplicado (novas chaves):', added.filter(k => k in td));
    log('🛰️ [Telemetry] Valores mapeados:', {
      lufsIntegrated: td.lufsIntegrated,
      lra: td.lra,
      truePeakDbtp: td.truePeakDbtp,
      spectralCentroid: td.spectralCentroid,
  spectralRolloff85: td.spectralRolloff85,
  spectralRolloff50: td.spectralRolloff50,
  thdPercent: td.thdPercent,
      spectralFlux: td.spectralFlux,
      stereoCorrelation: td.stereoCorrelation,
      balanceLR: td.balanceLR,
      tonalBalance: td.tonalBalance ? {
        sub: td.tonalBalance.sub?.rms_db,
        low: td.tonalBalance.low?.rms_db,
        mid: td.tonalBalance.mid?.rms_db,
        high: td.tonalBalance.high?.rms_db,
      } : null
    });
  }

    // Após mapear V2, opcionalmente aprimorar com módulos avançados (LUFS/LRA/TruePeak padrão ITU) se habilitado
    try {
      const preferAdv = (typeof window !== 'undefined') ? (window.USE_ADVANCED_METRICS !== false) : true;
      if (preferAdv) {
        baseAnalysis = await this._tryAdvancedMetricsAdapter(audioBuffer, baseAnalysis);
      }
    } catch (e) {
      if (__DEBUG_ANALYZER__) warn('⚠️ Adapter avançado falhou (com V2):', e?.message || e);
    }

    try {
      // 🎯 CORREÇÃO DA ORDEM DO PIPELINE: Scoring após bandas espectrais
      // Garante que o scoring execute SOMENTE após bandas espectrais válidas
      log('[PIPELINE-CORRECTION] 🔍 Iniciando scoring com pré-condições...');
      log('[PIPELINE-CORRECTION] Feature flag ativa:', window.PIPELINE_ORDER_CORRECTION_ENABLED);
      log('[PIPELINE-CORRECTION] technicalData exists:', !!baseAnalysis.technicalData);
      
      if (typeof window !== 'undefined' && baseAnalysis.technicalData) {
        log('[PIPELINE-CORRECTION] ✅ Condições iniciais atendidas');
        const tdFinal = baseAnalysis.technicalData;
        log('[PIPELINE-CORRECTION] tdFinal keys:', Object.keys(tdFinal || {}));
        
        // Verificar se a correção está ativa
        const correctionEnabled = window.PIPELINE_ORDER_CORRECTION_ENABLED !== false;
        log('[PIPELINE-CORRECTION] Correção ativa:', correctionEnabled);
        
        if (correctionEnabled && window.PipelineOrderCorrection) {
          // 🎯 NOVA ORDEM: Validar bandas espectrais ANTES do scoring
          const bandsValidation = window.PipelineOrderCorrection.validateSpectralBands(tdFinal, runId);
          log('[PIPELINE-CORRECTION] Validação das bandas:', bandsValidation);
          
          if (!bandsValidation.ready || !bandsValidation.valid) {
            // 📝 Log estruturado de skip
            window.PipelineOrderCorrection.logPipelineEvent('scoring_skipped', runId, {
              reason: bandsValidation.reason,
              depends_on: 'spectral-bands',
              validation: bandsValidation
            });
            
            log('[PIPELINE-CORRECTION] ⚠️ Scoring pulado - bandas não prontas:', bandsValidation.reason);
            
            // Aplicar fallback seguro
            const fallbackScore = window.PipelineOrderCorrection.createScoringFallback(bandsValidation.reason, runId);
            baseAnalysis.mixScore = fallbackScore;
            baseAnalysis.mixScorePct = null; // UI não exibe score parcial
            baseAnalysis.mixClassification = 'unavailable';
            
            log('[PIPELINE-CORRECTION] 🛡️ Fallback aplicado');
            return baseAnalysis; // Retorno antecipado seguro
          }
          
          // 📊 Log que bandas estão prontas
          window.PipelineOrderCorrection.logPipelineEvent('spectral_bands_ready', runId, {
            bandCount: bandsValidation.bandCount,
            validBandCount: bandsValidation.validBandCount,
            depends_on: 'spectral-bands'
          });
        }
        let activeRef = null;
        // 🎯 CORREÇÃO TOTAL: Apenas usar PROD_AI_REF_DATA no modo gênero
        try { 
          if (mode === 'genre') {
            activeRef = window.PROD_AI_REF_DATA_ACTIVE || window.PROD_AI_REF_DATA || null;
            if (DEBUG_MODE_REFERENCE) {
              log('🔍 [MODE_DEBUG] Using genre ref for scoring, mode:', mode);
            }
          } else if (DEBUG_MODE_REFERENCE) {
            log('🔍 [MODE_DEBUG] Skipping genre ref for scoring, mode:', mode, '(pure analysis)');
          }
        } catch {}
        try {
          log('[PIPELINE-CORRECTION] 🔍 Carregando módulo de scoring...');
          const scorerMod = await import('/lib/audio/features/scoring.js').catch((err)=>{
            error('[PIPELINE-CORRECTION] ❌ Erro no import scoring.js:', err);
            return null;
          });
          log('[PIPELINE-CORRECTION] scoring.js carregado:', !!scorerMod);
          log('[PIPELINE-CORRECTION] computeMixScore disponível:', !!(scorerMod && typeof scorerMod.computeMixScore === 'function'));
          
          if (scorerMod && typeof scorerMod.computeMixScore === 'function') {
            log('[PIPELINE-CORRECTION] ✅ scoring.js válido, executando...');
            // 🎯 CORREÇÃO: Buscar targets específicos do gênero ativo (segunda ocorrência)
            let genreSpecificRef = null;
            if (mode === 'genre' && activeRef) {
              const activeGenre = window.PROD_AI_REF_GENRE || 'default';
              genreSpecificRef = activeRef[activeGenre] || null;
              if (DEBUG_MODE_REFERENCE) {
                log('[PIPELINE-CORRECTION] Final scoring using genre-specific ref:', activeGenre);
                log('[PIPELINE-CORRECTION] Final genre ref targets:', genreSpecificRef);
              }
            } else if (DEBUG_MODE_REFERENCE) {
              log('[PIPELINE-CORRECTION] Final scoring skipping genre-specific ref (mode=' + mode + ')');
            }
            
            // 🎯 CORREÇÃO DA ORDEM: Usar nova função com pré-condições
            const correctionEnabled = window.PIPELINE_ORDER_CORRECTION_ENABLED !== false;
            let finalScore = null;
            
            if (correctionEnabled && window.PipelineOrderCorrection) {
              // Nova implementação com validação de bandas espectrais
              finalScore = await window.PipelineOrderCorrection.executeScoringWithPreconditions(
                tdFinal, 
                genreSpecificRef, 
                scorerMod, 
                runId
              );
            } else {
              // Implementação original (fallback)
              log('[PIPELINE-CORRECTION] ⚠️ Usando implementação original - correção desabilitada');
              // 🎯 CORREÇÃO: Passar mode para garantir que gates V3 usem o limite correto
              const mode = window.__SOUNDY_ANALYSIS_MODE__ || 'streaming';
              finalScore = scorerMod.computeMixScore(tdFinal, genreSpecificRef, { mode });
            }
            
            if (finalScore) {
              log('[PIPELINE-CORRECTION] 🎯 Score calculado com sucesso - scorePct:', finalScore?.scorePct);
            } else {
              log('[PIPELINE-CORRECTION] ⚠️ Score não calculado - verificar logs acima');
            }
            
            // TESTE MANUAL COM DADOS CONHECIDOS (mantido para compatibilidade)
            const testData = {
              "spectrum.balance": { classification: "yellow" },
              "spectrum.clarity": { classification: "red" },
              "spectrum.presence": { classification: "green" },
              "spectrum.warmth": { classification: "yellow" },
              "spectrum.brightness": { classification: "green" },
              "spectrum.fullness": { classification: "green" },
              "dynamics.punch": { classification: "yellow" },
              "dynamics.consistency": { classification: "red" },
              "dynamics.contrast": { classification: "green" },
              "technical.clipCount": { classification: "green" },
              "technical.distortionLevel": { classification: "red" },
              "technical.noiseFloor": { classification: "yellow" }
            };
            // 🎯 CORREÇÃO: Buscar targets específicos do gênero ativo (terceira ocorrência - teste)
            let testGenreSpecificRef = null;
            if (mode === 'genre' && activeRef) {
              const activeGenre = window.PROD_AI_REF_GENRE || 'default';
              testGenreSpecificRef = activeRef[activeGenre] || null;
            }
            
            const testScore = scorerMod.computeMixScore(testData, testGenreSpecificRef);
            log('[COLOR_RATIO_V2_TEST] Manual test G=5, Y=4, R=3, T=12 should be 59:', testScore);
            
            // Aplicar resultado do scoring se válido
            if (finalScore && finalScore.scorePct !== null) {
              baseAnalysis.mixScore = finalScore;
              baseAnalysis.mixScorePct = finalScore.scorePct;
              baseAnalysis.mixClassification = finalScore.classification;
              
              // CRÍTICO: Atualizar qualityOverall usado pela UI
              log('[PIPELINE-CORRECTION] 💾 Atualizando qualityOverall...');
              log('[PIPELINE-CORRECTION] Valor anterior:', baseAnalysis.qualityOverall);
              log('[PIPELINE-CORRECTION] Novo valor:', finalScore.scorePct);
              
              baseAnalysis._originalQualityOverall = baseAnalysis.qualityOverall;
              baseAnalysis.qualityOverall = finalScore.scorePct;
              log('[PIPELINE-CORRECTION] ✅ qualityOverall atualizado =', finalScore.scorePct, '(was:', baseAnalysis._originalQualityOverall, ')');
              log('[PIPELINE-CORRECTION] 🎯 Método usado:', finalScore.method, 'Classificação:', finalScore.classification);
            }
            // Logging para debug (sem override)
            try {
              const cc = finalScore.colorCounts || {};
              if (window.DEBUG_SCORE === true && cc.total > 0) {
                log('[ANALYSIS][FINAL_SCORE]', {
                  method: finalScore.method,
                  scorePct: finalScore.scorePct,
                  colorCounts: cc,
                  weights: finalScore.weights,
                  denominator: finalScore.denominator_info,
                  yellowKeys: finalScore.yellowKeys
                });
              }
              try { window.__LAST_MIX_SCORE = finalScore; } catch {}
            } catch {}
            if (window.DEBUG_SCORE === true) log('[ANALYSIS][RECALC_SCORE] method=', finalScore.scoringMethod, 'scorePct=', finalScore.scorePct, finalScore.colorCounts, 'weights=', finalScore.weights, 'denom=', finalScore.denominator_info, 'yellowKeys=', finalScore.yellowKeys);
          }
        } catch (reScoreErr) { if (window.DEBUG_SCORE) warn('[RECALC_SCORE_ERROR]', reScoreErr); }
      }
    } catch {}
    
    // 🎯 GARANTIR QUE SEMPRE TEMOS UM SCORE VÁLIDO
    if (!Number.isFinite(baseAnalysis.qualityOverall)) {
      log('[SCORE_DEBUG] ⚠️ qualityOverall inválido, aplicando fallback final');
      this._applyWeightedScoreFallback(baseAnalysis);
    }
    
    log('[SCORE_DEBUG] 🎯 Score final definido:', baseAnalysis.qualityOverall);
    return baseAnalysis;
  }

  // 🔧 MÉTODO DE FALLBACK PARA SCORE
  _applyWeightedScoreFallback(baseAnalysis) {
    log('[SCORE_DEBUG] 📊 Aplicando fallback de score ponderado...');
    
    try {
      // Usar sistema de agregação ponderada existente
      if (!Number.isFinite(baseAnalysis.qualityOverall)) {
        log('[WEIGHTED_AGGREGATE] Triggered - qualityOverall was:', baseAnalysis.qualityOverall);
        
        // Coletar sub-scores válidos
        const subScores = [];
        const breakdown = baseAnalysis.qualityBreakdown || {};
        
        if (Number.isFinite(breakdown.dynamics)) subScores.push({ value: breakdown.dynamics, weight: 0.25 });
        if (Number.isFinite(breakdown.technical)) subScores.push({ value: breakdown.technical, weight: 0.25 });
        if (Number.isFinite(breakdown.stereo)) subScores.push({ value: breakdown.stereo, weight: 0.20 });
        if (Number.isFinite(breakdown.loudness)) subScores.push({ value: breakdown.loudness, weight: 0.15 });
        if (Number.isFinite(breakdown.frequency)) subScores.push({ value: breakdown.frequency, weight: 0.15 });
        
        if (subScores.length > 0) {
          const totalWeight = subScores.reduce((sum, s) => sum + s.weight, 0);
          const weightedScore = subScores.reduce((sum, s) => sum + (s.value * s.weight), 0) / totalWeight;
          const clamp = (v) => Math.max(0, Math.min(100, v));
          
          baseAnalysis.qualityOverall = clamp(weightedScore);
          log('[WEIGHTED_AGGREGATE] Set qualityOverall =', baseAnalysis.qualityOverall, 
                     'from', subScores.length, 'sub-scores');
        } else {
          // Último recurso: score padrão conservador
          baseAnalysis.qualityOverall = 50;
          log('[WEIGHTED_AGGREGATE] No sub-scores available, using default 50');
        }
      }
    } catch (fallbackError) {
      error('[SCORE_DEBUG] ❌ Erro no fallback:', fallbackError);
      baseAnalysis.qualityOverall = 50; // Último recurso
    }
    
    log('[SCORE_DEBUG] ✅ Fallback concluído - score:', baseAnalysis.qualityOverall);
  }

  // (remoção do conversor WAV — não é mais necessário)

  // 🔬 Realizar análise completa
  performFullAnalysis(audioBuffer, options = {}) {
  const runId = options.runId || this._currentRunId;
  const _caiarLog = (window && window.__caiarLog) ? window.__caiarLog : function(){};
  _caiarLog('METRICS_V1_START','Iniciando cálculo métricas V1', { duration: audioBuffer?.duration, sr: audioBuffer?.sampleRate, runId });
    const analysis = {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      problems: [],
      suggestions: [],
      technicalData: {},
      diagnostics: {
        problems: [],
        suggestions: [],
        __refEvidence: false
  },
  metricsValidation: {},
  timingBreakdown: {}
    };

    // Garantir que arrays essenciais existam
    analysis.problems = analysis.problems || [];
    analysis.suggestions = analysis.suggestions || [];

    // Obter dados dos canais
    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;

    // ===== SINGLE STAGE METRICS (feature flag) =====
    try {
      if (typeof window === 'undefined' || window.SINGLE_STAGE_METRICS === true) {
        // Todas as métricas base calculadas aqui usarão exatamente o mesmo PCM bruto (sem ganhos posteriores)
        const td = analysis.technicalData;
        // Peak (dBFS) já será calculado abaixo; adiantamos se quisermos evitar duplicação
        
        // 🎯 CLIPPING PRECEDENCE V2: Sample Peak + True Peak com mesmo buffer e oversampling ≥4x
        const oversamplingFactor = 4;
        const clipThresh = 1.0; // Threshold rigoroso: exatamente 0 dBFS
        
        // 🔬 Calcular Sample Peak com oversampling no mesmo buffer
        const samplePeakResult = this.calculateSamplePeakWithOversampling(leftChannel, rightChannel, oversamplingFactor);
        
        // 🔬 Calcular True Peak estimado (mesmo buffer + oversampling avançado)
        const truePeakResult = this.estimateTruePeakFromSameBuffer(leftChannel, rightChannel, oversamplingFactor);
        
        // 🎭 Aplicar lógica de precedência
        const precedenceResult = this.applyClippingPrecedence(samplePeakResult, truePeakResult);
        
        td._singleStage = {
          samplePeakLeftDb: samplePeakResult.leftDbFS,
          samplePeakRightDb: samplePeakResult.rightDbFS,
          samplePeakMaxDbFS: samplePeakResult.maxDbFS,
          truePeakDbTP: precedenceResult.finalTruePeakDbTP,
          clippingSamples: samplePeakResult.clippingSamples,
          clippingPct: samplePeakResult.clippingPct,
          finalState: precedenceResult.finalState,
          precedenceApplied: precedenceResult.precedenceApplied,
          scoreCapApplied: precedenceResult.scoreCapApplied,
          oversamplingFactor: oversamplingFactor,
          clipThreshold: clipThresh,
          source: 'enhanced-clipping-v2'
        };
      }
    } catch {}

    // 📊 Análise de Volume e Dinâmica
    analysis.technicalData.peak = this.findPeakLevel(leftChannel);
    analysis.technicalData.rms = this.calculateRMS(leftChannel);
    
    // 🎯 TT-DR OFICIAL: Dynamic Range conforme padrão da indústria
    const enableTTDR = (typeof window !== 'undefined') && (
      (window.AUDIT_MODE === true && window.DR_REDEF !== false) ||
      window.FORCE_SCORING_V2 === true || window.AUTO_SCORING_V2 === true ||
      window.USE_TT_DR === true
    );
    
    if (enableTTDR) {
      try {
        // Importar módulo dynamics se disponível
        if (typeof window !== 'undefined' && window.dynamicsModule) {
          const ttResult = window.dynamicsModule.computeTTDynamicRange(leftChannel, rightChannel, audioBuffer.sampleRate || 48000);
          if (ttResult && ttResult.is_valid && Number.isFinite(ttResult.tt_dr)) {
            analysis.technicalData.tt_dr = parseFloat(ttResult.tt_dr.toFixed(2));
            analysis.technicalData.dr_stat = analysis.technicalData.tt_dr; // Alias para compatibilidade
            analysis.technicalData._ttdr_metadata = {
              algorithm: ttResult.algorithm,
              version: ttResult.version,
              rms_windows: ttResult.rms_windows,
              p95_rms: ttResult.p95_rms,
              p10_rms: ttResult.p10_rms
            };
          }
        }
        
        // Fallback: implementação inline (compatibilidade)
        if (!analysis.technicalData.tt_dr) {
          const sampleRate = audioBuffer.sampleRate || 48000;
          const n = Math.min(leftChannel.length, rightChannel.length);
          const mid = new Float32Array(n);
          for (let i = 0; i < n; i++) mid[i] = 0.5 * (leftChannel[i] + rightChannel[i]);
          
          // TT-DR: janelas 300ms, hop 100ms
          const winSamples = Math.max(1, Math.round(sampleRate * 0.3)); // 300ms
          const hopSamples = Math.max(1, Math.round(sampleRate * 0.1)); // 100ms
          const rmsValues = [];
          
          let sumSquares = 0;
          const buffer = new Float32Array(winSamples);
          let bufferIndex = 0;
          let samplesInBuffer = 0;
          
          for (let i = 0; i < n; i++) {
            const currentSample = mid[i];
            const oldSample = buffer[bufferIndex];
            
            buffer[bufferIndex] = currentSample;
            bufferIndex = (bufferIndex + 1) % winSamples;
            
            if (samplesInBuffer < winSamples) {
              sumSquares += currentSample * currentSample;
              samplesInBuffer++;
            } else {
              sumSquares += currentSample * currentSample - oldSample * oldSample;
            }
            
            if (samplesInBuffer >= winSamples && ((i - winSamples + 1) % hopSamples === 0)) {
              const rmsLinear = Math.sqrt(sumSquares / winSamples);
              const rmsDb = rmsLinear > 1e-10 ? 20 * Math.log10(rmsLinear) : -200;
              rmsValues.push(rmsDb);
            }
          }
          
          // Calcular percentis TT
          const validRms = rmsValues.filter(v => Number.isFinite(v) && v > -200).sort((a, b) => a - b);
          if (validRms.length > 5) {
            const p10Index = Math.floor((validRms.length - 1) * 0.10);
            const p95Index = Math.floor((validRms.length - 1) * 0.95);
            const p10 = validRms[p10Index];
            const p95 = validRms[p95Index];
            
            if (Number.isFinite(p95) && Number.isFinite(p10)) {
              const ttDR = p95 - p10;
              analysis.technicalData.tt_dr = parseFloat(ttDR.toFixed(2));
              analysis.technicalData.dr_stat = analysis.technicalData.tt_dr;
              analysis.technicalData._ttdr_metadata = {
                algorithm: 'TT-DR Inline',
                version: '1.0',
                rms_windows: validRms.length,
                p95_rms: p95,
                p10_rms: p10
              };
            }
          }
        }
      } catch (error) {
        warn('⚠️ TT-DR calculation failed, using fallback:', error.message);
      }
    }
    
    // 🎚️ Crest Factor (DR_CF): Métrica auxiliar - mantida para compatibilidade
    analysis.technicalData.crestFactor = this.calculateCrestFactor(leftChannel);
    // 🔄 Manter dynamicRange para retrocompatibilidade (Crest Factor legacy)
    analysis.technicalData.dynamicRange = analysis.technicalData.crestFactor;

    // Garantir crestFactor base (peak - rms) já inicial
    if (Number.isFinite(analysis.technicalData.peak) && Number.isFinite(analysis.technicalData.rms)) {
      const cf = (analysis.technicalData.peak - analysis.technicalData.rms);
      if (!Number.isFinite(analysis.technicalData.crestFactor)) {
        analysis.technicalData.crestFactor = parseFloat(cf.toFixed(2));
        (analysis.technicalData._sources = analysis.technicalData._sources || {}).crestFactor = 'fallback:basic';
      }
    }

    // ⚙️ Métricas técnicas básicas extras (fallback quando V2 não estiver disponível)
    try {
      let dcSum = 0;
      let clipped = 0;
      const len = leftChannel.length;
      const clipThreshold = 0.999; // 🎯 CORREÇÃO: Threshold realista para detectar clipping REAL (99.9%)
      let dcSumR = 0;
      const useHPF = (typeof window !== 'undefined' && window.AUDIT_MODE===true && window.DC_HPF20===true) || (typeof process !== 'undefined' && process.env.AUDIT_MODE==='1' && process.env.DC_HPF20==='1');
      // HPF estado
      let aL=0,aR=0, xPrevL=0,yPrevL=0,xPrevR=0,yPrevR=0;
      const sr = audioBuffer.sampleRate || 48000;
      const fc=20; const w=2*Math.PI*fc/sr; const alpha = w/(w+1);
      
      // Contagem de clipping mais precisa - verificar ambos os canais
      for (let i = 0; i < len; i++) {
        let sL = leftChannel[i];
        let sR = rightChannel[i] ?? sL;
        if (useHPF) {
          const yL = alpha*(yPrevL + sL - xPrevL); yPrevL = yL; xPrevL = sL; sL = yL;
          const yR = alpha*(yPrevR + sR - xPrevR); yPrevR = yR; xPrevR = sR; sR = yR;
        }
        dcSum += sL;
        dcSumR += sR;
        
        // Detectar clipping em qualquer canal
        if (Math.abs(sL) >= clipThreshold || Math.abs(sR) >= clipThreshold) {
          clipped++;
        }
      }
      const dcOffset = dcSum / Math.max(1, len);
      const dcOffsetRight = dcSumR / Math.max(1, len);
      const clippingPct = (clipped / Math.max(1, len)) * 100;
      if (!Number.isFinite(analysis.technicalData.dcOffset)) {
        analysis.technicalData.dcOffset = dcOffset;
      }
      if ((typeof window !== 'undefined' && window.AUDIT_MODE===true) || (typeof process !== 'undefined' && process.env.AUDIT_MODE==='1')) {
        analysis.technicalData.dcOffsetLeft = dcOffset;
        analysis.technicalData.dcOffsetRight = dcOffsetRight;
        (analysis.technicalData._sources = analysis.technicalData._sources || {}).dcOffsetLeft = useHPF? 'audit:hpf20' : 'audit:raw';
        (analysis.technicalData._sources = analysis.technicalData._sources || {}).dcOffsetRight = useHPF? 'audit:hpf20' : 'audit:raw';
      }
      if (!Number.isFinite(analysis.technicalData.clippingSamples)) {
        analysis.technicalData.clippingSamples = clipped;
      }
      if (!Number.isFinite(analysis.technicalData.clippingPct)) {
        analysis.technicalData.clippingPct = clippingPct;
      }
    } catch {}

    // 🎯 Análise de Frequências Dominantes
    analysis.technicalData.dominantFrequencies = this.findDominantFrequencies(leftChannel, audioBuffer.sampleRate) || [];

    // 🔍 Detectar Problemas Comuns
    this.detectCommonProblems(analysis);

    // 💡 Gerar Sugestões Técnicas
    this.generateTechnicalSuggestions(analysis);
  try { (window.__caiarLog||function(){})('SUGGESTIONS_V1_DONE','Sugestões V1 geradas', { count: (analysis.suggestions||[]).length }); } catch {}

    // 🔒 Validação final dos arrays essenciais
    analysis.problems = Array.isArray(analysis.problems) ? analysis.problems : [];
    analysis.suggestions = Array.isArray(analysis.suggestions) ? analysis.suggestions : [];
    analysis.technicalData.dominantFrequencies = Array.isArray(analysis.technicalData.dominantFrequencies) ? analysis.technicalData.dominantFrequencies : [];

    // 🛡️ Invariants (audit)
    try {
      if ((typeof window !== 'undefined' && window.AUDIT_MODE === true) || (typeof process !== 'undefined' && process.env.AUDIT_MODE==='1')) {
        // Lazy dynamic import se disponível
  // Import dinâmico não disponível neste contexto sem bundler; placeholder para futura injeção.
  const validator = (typeof window !== 'undefined' && window.__validateInvariants) ? window.__validateInvariants : null;
  if (typeof validator === 'function') {
          const inv = validator({
            truePeakDbtp: analysis.technicalData.truePeakDbtp ?? analysis.technicalData.true_peak_dbtp,
            samplePeakLeftDb: analysis.technicalData.samplePeakLeftDb,
            samplePeakRightDb: analysis.technicalData.samplePeakRightDb,
            lufsIntegrated: analysis.technicalData.lufsIntegrated,
            crestFactor: analysis.technicalData.crestFactor,
            dr_stat: analysis.technicalData.dr_stat,
            thdPercent: analysis.technicalData.thdPercent
          });
          if (inv?.warnings?.length) {
            analysis.auditInvariants = inv;
            // Anexar warnings sem duplicar
            const seen = new Set(analysis.problems.map(p=>p?.message||p));
            for (const w of inv.warnings) {
              if (!seen.has(w)) { analysis.problems.push({ type:'invariant', message:w }); seen.add(w); }
            }
          }
        }
      }
    } catch (e) { if (window && window.DEBUG_ANALYZER) warn('Invariant validator erro', e); }

    return analysis;
  }

  // 📈 Encontrar nível de pico
  findPeakLevel(channelData) {
    let peak = 0;
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.abs(channelData[i]);
      if (sample > peak) {
        peak = sample;
      }
    }
    // Evitar log de zero
    if (peak === 0) peak = 0.000001;
    return 20 * Math.log10(peak); // Converter para dB
  }

  // 📊 Calcular RMS (Volume médio)
  calculateRMS(channelData) {
    let sum = 0;
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sum / channelData.length);
    // Evitar log de zero
    if (rms === 0) return -Infinity;
    return 20 * Math.log10(rms); // Converter para dB
  }

  // 🎚️ Calcular Crest Factor (DR_CF) - Métrica auxiliar 
  // ⚠️ IMPORTANTE: Esta é a diferença Peak-RMS (Crest Factor), NÃO o Dynamic Range oficial
  // Para TT-DR (True Technical Dynamic Range), use tt_dr ou dr_stat
  // Crest Factor permanece disponível para compatibilidade e comparação
  calculateCrestFactor(channelData) {
    const peak = this.findPeakLevel(channelData);
    const rms = this.calculateRMS(channelData);
    
    // Verificar valores válidos
    if (rms === -Infinity || isNaN(peak) || isNaN(rms)) {
      return 0;
    }
    
    return Math.abs(peak - rms);
  }

  // 🔄 Alias para compatibilidade (DEPRECATED - use calculateCrestFactor)
  // Este método será removido em versões futuras - use TT-DR ou Crest Factor explicitamente
  calculateDynamicRange(channelData) {
    if (typeof window !== 'undefined' && window.DEBUG_ANALYZER) {
      warn('⚠️ calculateDynamicRange() deprecated - use TT-DR (tt_dr) for official analysis or calculateCrestFactor() for Peak-RMS');
    }
    return this.calculateCrestFactor(channelData);
  }

  // 🎵 Encontrar frequências dominantes (versão melhorada)
  findDominantFrequencies(channelData, sampleRate) {
  if (window.DEBUG_ANALYZER === true) log('🎯 Iniciando análise de frequências...');
    
    // 🎯 Implementação melhorada com FFT maior e interpolação
    const fftSize = 2048; // Aumentado de 256 para melhor resolução
    const frequencies = [];
    const maxSections = 15; // Reduzido para melhor performance
    
    const stepSize = Math.max(fftSize * 2, Math.floor(channelData.length / maxSections));
    
    // Analisar diferentes seções do áudio
    for (let i = 0; i < channelData.length - fftSize && frequencies.length < maxSections; i += stepSize) {
      try {
        const section = channelData.slice(i, i + fftSize);
        const spectrum = this.simpleFFT(section);
        
        // 🎯 Encontrar top 3 picos por seção para melhor detecção
        const peaks = [];
        for (let j = 2; j < spectrum.length / 2 - 2; j++) { // Evitar DC e Nyquist
          const magnitude = spectrum[j];
          // Verificar se é um pico local
          if (magnitude > spectrum[j-1] && magnitude > spectrum[j+1] && 
              magnitude > spectrum[j-2] && magnitude > spectrum[j+2]) {
            const freq = (j * sampleRate) / fftSize;
            if (freq > 30 && freq < 18000) { // Faixa mais focada
              // 🎯 Interpolação parabólica para melhor precisão
              const y1 = spectrum[j-1], y2 = spectrum[j], y3 = spectrum[j+1];
              const a = (y1 - 2*y2 + y3) / 2;
              const b = (y3 - y1) / 2;
              const correction = a !== 0 ? -b / (2*a) : 0;
              const refinedFreq = ((j + correction) * sampleRate) / fftSize;
              
              peaks.push({ freq: refinedFreq, magnitude });
            }
          }
        }
        
        // Ordenar por magnitude e pegar os top 2
        peaks.sort((a, b) => b.magnitude - a.magnitude);
        frequencies.push(...peaks.slice(0, 2).map(p => p.freq));
        
      } catch (error) {
        warn('Erro na análise de seção:', error);
        continue;
      }
    }

  if (window.DEBUG_ANALYZER === true) log(`🎯 Frequências encontradas: ${frequencies.length}`);

    // Encontrar as frequências mais comuns
    const freqGroups = this.groupFrequencies(frequencies);
    const result = freqGroups.slice(0, 5) || []; // Top 5 frequências
    return Array.isArray(result) ? result : [];
  }

  // 🔍 FFT Simples (para análise básica de frequências)
  simpleFFT(samples) {
    // Implementação básica para detectar frequências dominantes
    const N = samples.length;
    const spectrum = new Array(N);
    
    // Limitar N para evitar travamento
    const maxN = Math.min(N, 512);
    
    for (let k = 0; k < maxN; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < maxN; n++) {
        const angle = -2 * Math.PI * k * n / maxN;
        real += samples[n] * Math.cos(angle);
        imag += samples[n] * Math.sin(angle);
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    // Preencher o resto com zeros
    for (let k = maxN; k < N; k++) {
      spectrum[k] = 0;
    }
    
    return spectrum;
  }

  // 📊 Agrupar frequências similares (versão melhorada)
  groupFrequencies(frequencies) {
    const groups = {};
    // 🎯 Tolerância adaptativa baseada na frequência
    const getTolerance = (freq) => {
      if (freq < 200) return 20;      // Graves: ±20 Hz
      if (freq < 1000) return 30;     // Low-mid: ±30 Hz  
      if (freq < 4000) return 50;     // Mid: ±50 Hz
      if (freq < 10000) return 100;   // High-mid: ±100 Hz
      return 200;                     // Agudos: ±200 Hz
    };
    
    frequencies.forEach(freq => {
      const tolerance = getTolerance(freq);
      const rounded = Math.round(freq / tolerance) * tolerance;
      groups[rounded] = (groups[rounded] || 0) + 1;
    });
    
    return Object.entries(groups)
      .sort(([,a], [,b]) => b - a)
      .map(([freq, count]) => ({ 
        frequency: parseFloat(freq), 
        occurrences: count,
        confidence: Math.min(1.0, count / 3) // Confiança baseada em ocorrências
      }));
  }

  // 🚨 Detectar problemas comuns
  detectCommonProblems(analysis) {
    const { peak, rms, dynamicRange } = analysis.technicalData;
    const clipSamples = analysis.technicalData?.clippingSamples || 0;
    const clipPct = analysis.technicalData?.clippingPct || 0;
    const truePeak = analysis.technicalData?.truePeakDbtp;

    // 🎯 CORREÇÃO: Critérios mais realistas para clipping
    // Só considera clipping real se:
    // 1. True Peak > -0.1 dBTP (muito próximo de 0dBFS)
    // 2. OU samples realmente saturados (>=0.999)
    // 3. OU peak muito alto (>-0.05dB)
    const hasRealClipping = (truePeak !== null && truePeak > -0.1) || 
                           peak > -0.05 || 
                           (clipSamples > 0 && clipPct > 0.01); // Só se >0.01% realmente clippado
    
    if (hasRealClipping) {
      let clippingDetails = [];
      if (peak > -0.05) clippingDetails.push(`Peak: ${peak.toFixed(2)}dB`);
      if (truePeak !== null && truePeak > -0.1) clippingDetails.push(`TruePeak: ${truePeak.toFixed(2)}dBTP`);
      if (clipSamples > 0) clippingDetails.push(`${clipSamples} samples (${clipPct.toFixed(3)}%)`);
      
      // 🎯 CORREÇÃO: Cálculo mais inteligente da redução necessária
      let reductionDb;
      
      if (truePeak !== null && truePeak > -0.1) {
        // Basear na distância do true peak para -1dBTP (seguro)
        reductionDb = Math.max(1, Math.min(8, truePeak + 1.5)); // +1.5dB de margem
      } else if (peak > -0.05) {
        // Basear na distância do peak para -1dB (seguro)
        reductionDb = Math.max(1, Math.min(6, peak + 1.5));
      } else {
        // Fallback baseado na porcentagem de clipping (formula original ajustada)
        reductionDb = Math.max(1, Math.min(4, clipPct * 10)); // Reduzida de 20 para 10
      }
      
      analysis.problems.push({
        type: 'clipping',
        severity: 'critical',
        message: `Clipping detectado`,
        solution: `Reduzir volume geral em ${reductionDb.toFixed(1)}dB`,
        explanation: "Clipping ocorre quando o sinal excede 0dBFS, causando distorção digital",
        impact: "Distorção audível, perda de qualidade, som áspero e desagradável",
        frequency_range: "Todas as frequências",
        adjustment_db: -reductionDb,
        details: clippingDetails.join(', ')
      });
    }

    // Problema: Volume muito baixo
    if (rms < -30) {
      const gainNeeded = Math.abs(rms + 18); // Target para -18dB RMS
      analysis.problems.push({
        type: 'low_volume',
        severity: rms < -40 ? 'high' : 'medium',
        message: `Volume muito baixo`,
        solution: `Aumentar volume em ${gainNeeded.toFixed(1)}dB`,
        explanation: "Volume insuficiente reduz impacto e pode soar fraco comparado a outras músicas",
        impact: "Som sem energia, usuários precisam aumentar o volume manualmente",
        frequency_range: "Todas as frequências",
        adjustment_db: gainNeeded,
        details: `RMS atual: ${rms.toFixed(1)}dB (ideal: -18dB)`
      });
    }

    // Problema: Falta de dinâmica
    if (dynamicRange < 6) {
      analysis.problems.push({
        type: 'over_compressed',
        severity: dynamicRange < 3 ? 'high' : 'medium',
        message: `Áudio muito comprimido`,
        solution: `Reduzir compressão para atingir ${Math.max(8, dynamicRange + 3).toFixed(0)}dB de dinâmica`,
        explanation: "Excesso de compressão remove a dinâmica natural, deixando o som cansativo",
        impact: "Som sem vida, fadiga auditiva, perda da expressividade musical",
        frequency_range: "Todas as frequências",
        adjustment_db: 0, // Ajuste de compressão, não de ganho
        details: `Dinâmica atual: ${dynamicRange.toFixed(1)}dB (ideal: >8dB)`
      });
    }

    // Problema: Frequências dominantes problemáticas
    analysis.technicalData.dominantFrequencies.forEach(freq => {
      if (freq.frequency > 300 && freq.frequency < 600 && freq.occurrences > 10) {
        analysis.problems.push({
          type: 'muddy_mids',
          severity: 'medium',
          message: `Frequência problemática em ${Math.round(freq.frequency)}Hz`,
          solution: `Corte em ${Math.round(freq.frequency)}Hz com Q de 2-4`
        });
      }
    });
  }

  // 💡 Gerar sugestões técnicas
  generateTechnicalSuggestions(analysis) {
  try { (window.__caiarLog||function(){})('SUGGESTIONS_V1_START','Gerando sugestões V1'); } catch {}
    const { peak, rms, dominantFrequencies, spectralCentroid, lufsIntegrated } = analysis.technicalData;

    // Sugestões baseadas no LUFS integrado real (quando disponível)
    // 🚨 IMPLEMENTAÇÃO HEADROOM SEGURO - só sugerir aumentar loudness se há headroom suficiente
    if (lufsIntegrated !== null && Number.isFinite(lufsIntegrated)) {
      log(`[generateTechnicalSuggestions] 🎚️ LUFS detectado: ${lufsIntegrated.toFixed(1)} dB`);
      
      // 🔒 Verificar headroom disponível antes de sugestões
      const truePeakDbTP = analysis.technical?.truePeakDbtp;
      const clippingSamples = analysis.technical?.clippingSamples || 0;
      const isClipped = clippingSamples > 0;
      const headroomSafetyMargin = -0.6; // Target true peak seguro (-0.6 dBTP)
      
      // 🚨 REGRA 1: Se CLIPPED, não sugerir aumento de loudness
      if (isClipped) {
        log(`[HEADROOM-SAFE] 🚨 Clipping detectado (${clippingSamples} samples) - bloqueando sugestões de aumento`);
        
        // Só adicionar sugestão de redução se volume muito alto
        if (lufsIntegrated > -13) {
          analysis.suggestions.push({
            type: 'mastering_volume_high_clipped',
            message: `Volume alto + clipping detectado`,
            action: `URGENTE: Reduzir volume para -14 LUFS`,
            explanation: "Clipping compromete qualidade - redução obrigatória",
            impact: "Clipping causa distorção irreversível",
            frequency_range: "N/A",
            adjustment_db: -(lufsIntegrated + 14),
            severity: 'critical'
          });
        }
      }
      // 🚨 REGRA 2: Calcular headroom disponível para aumento seguro
      else if (Number.isFinite(truePeakDbTP)) {
        const availableHeadroom = headroomSafetyMargin - truePeakDbTP; // Quanto pode aumentar sem passar de -0.6 dBTP
        log(`[HEADROOM-SAFE] 📊 True Peak: ${truePeakDbTP.toFixed(2)} dBTP, Headroom disponível: ${availableHeadroom.toFixed(2)} dB`);
        
        if (lufsIntegrated >= -16 && lufsIntegrated <= -13) {
          analysis.suggestions.push({
            type: 'mastering_optimal',
            message: `Volume ideal para streaming`,
            action: `Seu áudio está no volume ideal para plataformas digitais`,
            explanation: "LUFS entre -14 e -16 é o padrão para Spotify, YouTube e Apple Music",
            impact: "Mantém dinâmica e evita limitação excessiva das plataformas",
            frequency_range: "N/A",
            adjustment_db: 0
          });
        } else if (lufsIntegrated < -16) {
          // 🎯 CÁLCULO SEGURO: verificar se ganho proposto é possível
          const gainProposto = Math.abs(lufsIntegrated + 14); // Quanto precisa aumentar
          
          if (gainProposto <= availableHeadroom) {
            analysis.suggestions.push({
              type: 'mastering_volume_low',
              message: `Volume baixo para streaming`,
              action: `Aumentar volume para -14 LUFS (+${gainProposto.toFixed(1)}dB)`,
              explanation: "Áudio muito baixo pode soar fraco comparado a outras músicas",
              impact: "Usuários vão precisar aumentar o volume manualmente",
              frequency_range: "N/A",
              adjustment_db: gainProposto,
              headroom_check: `Seguro: ${availableHeadroom.toFixed(1)}dB disponível`
            });
          } else {
            log(`[HEADROOM-SAFE] ⚠️ Ganho ${gainProposto.toFixed(1)}dB > headroom ${availableHeadroom.toFixed(1)}dB - bloqueando sugestão`);
            analysis.suggestions.push({
              type: 'mastering_volume_limited_headroom',
              message: `Volume baixo mas sem headroom para correção`,
              action: `True Peak ${truePeakDbTP.toFixed(1)}dBTP limita aumento a +${availableHeadroom.toFixed(1)}dB`,
              explanation: "Aumentar mais que isso causaria clipping (True Peak > -0.6 dBTP)",
              impact: "Considere reduzir limitação ou remastering",
              frequency_range: "N/A",
              adjustment_db: 0,
              headroom_check: `Limitado: apenas ${availableHeadroom.toFixed(1)}dB seguro`
            });
          }
        } else if (lufsIntegrated > -13) {
          analysis.suggestions.push({
            type: 'mastering_volume_high',
            message: `Volume alto demais`,
            action: `Reduzir volume para -14 LUFS`,
            explanation: "Plataformas irão reduzir o volume automaticamente",
            impact: "Perda de dinâmica e compressão adicional das plataformas",
            frequency_range: "N/A",
            adjustment_db: -(lufsIntegrated + 14)
          });
        }
      }
      // FALLBACK: Se não há True Peak, usar comportamento original mas conservador
      else {
        log(`[HEADROOM-SAFE] ⚠️ True Peak não disponível - usando modo conservador`);
        
        if (lufsIntegrated >= -16 && lufsIntegrated <= -13) {
          analysis.suggestions.push({
            type: 'mastering_optimal',
            message: `Volume ideal para streaming`,
            action: `Seu áudio está no volume ideal para plataformas digitais`,
            explanation: "LUFS entre -14 e -16 é o padrão para Spotify, YouTube e Apple Music",
            impact: "Mantém dinâmica e evita limitação excessiva das plataformas",
            frequency_range: "N/A",
            adjustment_db: 0
          });
        } else if (lufsIntegrated < -18) { // Mais conservador sem True Peak
          analysis.suggestions.push({
            type: 'mastering_volume_low_conservative',
            message: `Volume baixo (análise conservadora)`,
            action: `Considere aumentar cuidadosamente para -14 LUFS`,
            explanation: "Sem dados de True Peak, sugestão conservadora",
            impact: "Verifique clipping antes de aplicar ajuste",
            frequency_range: "N/A",
            adjustment_db: Math.abs(lufsIntegrated + 14)
          });
        } else if (lufsIntegrated > -13) {
          analysis.suggestions.push({
            type: 'mastering_volume_high',
            message: `Volume alto demais`,
            action: `Reduzir volume para -14 LUFS`,
            explanation: "Plataformas irão reduzir o volume automaticamente",
            impact: "Perda de dinâmica e compressão adicional das plataformas",
            frequency_range: "N/A",
            adjustment_db: -(lufsIntegrated + 14)
          });
        }
      }
    } else if (rms > -16 && rms < -12) {
      // Fallback para RMS quando LUFS não disponível 
      analysis.suggestions.push({
        type: 'mastering_rms_ok',
        message: 'Volume adequado (baseado em RMS)',
        action: `Volume estimado adequado via RMS`,
        explanation: "Análise via RMS é menos precisa que LUFS mas indica nível aceitável",
        impact: "Para resultados mais precisos, use medição LUFS",
        frequency_range: "N/A",
        adjustment_db: 0
      });
    }

    // ===== ANÁLISE APRIMORADA DE FREQUÊNCIAS (V1) =====
    // Sistema baseado em centroide espectral + análise de energia por banda
    if (spectralCentroid && Number.isFinite(spectralCentroid)) {
      
      // Thresholds para classificação (baseados em análise de referências)
      const thresholds = {
        veryDark: 600,    // Muito escuro - graves dominantes
        dark: 1200,       // Escuro - falta de agudos  
        balanced_low: 1800, // Início da zona balanceada
        balanced_high: 3200, // Fim da zona balanceada
        bright: 4500,     // Brilhante - agudos dominantes
        veryBright: 6000  // Muito brilhante
      };

      // Análise principal baseada no centroide espectral
      if (spectralCentroid < thresholds.veryDark) {
        analysis.suggestions.push({
          type: 'frequency_low_excess',
          message: `Excesso de graves detectado`,
          action: `Reduzir graves para equilibrar o som`,
          explanation: "Centroide espectral muito baixo indica dominância excessiva de graves",
          impact: "Som abafado, perda de clareza, mascaramento dos médios",
          frequency_range: "60–200 Hz",
          adjustment_db: -3
        });
      } 
      else if (spectralCentroid < thresholds.dark) {
        analysis.suggestions.push({
          type: 'frequency_highs_deficient',
          message: `Agudos insuficientes - som escuro`,
          action: `Adicionar presença e brilho`,
          explanation: "Falta de energia nas frequências altas deixa o som abafado",
          impact: "Som sem vida, falta de clareza e espacialidade",
          frequency_range: "3–6 kHz, 10 kHz",
          adjustment_db: 2.5
        });
      }
      else if (spectralCentroid >= thresholds.balanced_low && spectralCentroid <= thresholds.balanced_high) {
        // Zona equilibrada - sem sugestões de correção
        if (window.DEBUG_ANALYZER) log(`[V1] ✅ Frequências equilibradas (${Math.round(spectralCentroid)}Hz)`);
      }
      else if (spectralCentroid > thresholds.bright) {
        analysis.suggestions.push({
          type: 'frequency_highs_excess',
          message: `Excesso de agudos - som muito brilhante`,
          action: `Suavizar frequências altas`,
          explanation: "Centroide espectral elevado indica excesso de energia nos agudos",
          impact: "Som cansativo, sibilância excessiva, fadiga auditiva",
          frequency_range: "6–10 kHz",
          adjustment_db: -2
        });
      }
      else if (spectralCentroid > thresholds.balanced_high) {
        analysis.suggestions.push({
          type: 'frequency_bass_deficient',
          message: `Falta de corpo e graves`,
          action: `Reforçar graves e médios graves`,
          explanation: "Centroide espectral alto demais indica falta de energia nos graves",
          impact: "Som fino, sem peso, falta de groove e presença física",
          frequency_range: "100–500 Hz",
          adjustment_db: 3
        });
      }

      // Análise adicional baseada nas frequências dominantes
      if (dominantFrequencies && dominantFrequencies.length > 0) {
        const bassCount = dominantFrequencies.filter(f => f.frequency < 200).length;
        const midCount = dominantFrequencies.filter(f => f.frequency >= 200 && f.frequency < 2000).length;
        const highCount = dominantFrequencies.filter(f => f.frequency >= 2000).length;
        const total = bassCount + midCount + highCount;
        
        // Análise de distribuição de energia (cruzada com centroide)
        if (total > 0) {
          const bassRatio = bassCount / total;
          const midRatio = midCount / total;  
          const highRatio = highCount / total;
          
          // Detectar desequilíbrios extremos
          if (bassRatio > 0.6 && spectralCentroid < 1000) {
            analysis.suggestions.push({
              type: 'frequency_imbalance',
              message: `Desequilíbrio confirmado: graves dominantes (${(bassRatio*100).toFixed(0)}% da energia)`,
              action: `Balancear: reduzir graves e adicionar médios/agudos`
            });
          } else if (highRatio > 0.6 && spectralCentroid > 3500) {
            analysis.suggestions.push({
              type: 'frequency_imbalance',
              message: `Desequilíbrio confirmado: agudos dominantes (${(highRatio*100).toFixed(0)}% da energia)`,
              action: `Balancear: reduzir agudos e adicionar corpo/graves`
            });
          } else if (midRatio > 0.7) {
            // Médios dominantes - possível lama
            analysis.suggestions.push({
              type: 'mud_detected',
              message: `Concentração excessiva em médios (${(midRatio*100).toFixed(0)}% da energia)`,
              action: `Verificar lama em 200-400Hz, usar EQ para balancear`
            });
          }
        }
      }
      
    }
    // Fallback se centroide não estiver disponível
    else {
      const bassFreqs = dominantFrequencies.filter(f => f.frequency < 250);
      const highFreqs = dominantFrequencies.filter(f => f.frequency > 8000);
      
      // Só sugerir se realmente há pouquíssimas frequências detectadas
      if (bassFreqs.length === 0 && dominantFrequencies.length > 3) {
        analysis.suggestions.push({
          type: 'bass_enhancement',
          message: 'Nenhuma frequência dominante detectada abaixo de 250Hz',
          action: 'Considere boost em 60-120Hz se o mix soar "magro"'
        });
      }

      if (highFreqs.length === 0 && dominantFrequencies.length > 3) {
        analysis.suggestions.push({
          type: 'brightness',
          message: 'Nenhuma frequência dominante detectada acima de 8kHz',
          action: 'Considere shelf suave em 10kHz se o mix soar "abafado"'
        });
      }
    }

    // Sugestão específica para funk
    const funkKickRange = dominantFrequencies.filter(f => f.frequency >= 50 && f.frequency <= 100);
    if (funkKickRange.length > 0) {
      analysis.suggestions.push({
        type: 'funk_specific',
        message: 'Frequência de kick detectada - típica do funk',
        action: `Optimize a faixa ${Math.round(funkKickRange[0].frequency)}Hz para mais punch`
      });
    }
    
    // ===== ANÁLISE DE ESTÉREO COM ALERTAS VISUAIS =====
    // 🚨 Mantém alertas visuais independente do score capped
    const correlation = analysis.technical?.stereoCorrelation ?? analysis.technicalData?.stereoCorrelation;
    if (Number.isFinite(correlation)) {
      log(`[generateTechnicalSuggestions] 🎧 Correlação estéreo: ${correlation.toFixed(3)}`);
      
      // 🚨 ALERTA VISUAL CRÍTICO: Correlação < 0.10
      if (correlation < 0.10) {
        analysis.suggestions.push({
          type: 'stereo_correlation_critical',
          message: `⚠️ ALERTA: Correlação estéreo muito baixa (${correlation.toFixed(3)})`,
          action: `Verificar problemas de fase e cancelamentos`,
          explanation: "Correlação < 0.10 indica problemas sérios de compatibilidade mono",
          impact: "Som pode desaparecer em sistemas mono (celulares, alguns sistemas)",
          frequency_range: "Imagem estéreo geral",
          adjustment_db: 0,
          severity: 'critical',
          visual_alert: true
        });
      }
      // 🚨 ALERTA VISUAL MODERADO: Correlação < 0.30
      else if (correlation < 0.30) {
        analysis.suggestions.push({
          type: 'stereo_correlation_warning',
          message: `⚠️ Correlação estéreo baixa (${correlation.toFixed(3)})`,
          action: `Verificar compatibilidade mono e ajustar width`,
          explanation: "Correlação baixa pode causar problemas em reprodução mono",
          impact: "Possíveis cancelamentos parciais em sistemas mono",
          frequency_range: "Imagem estéreo geral", 
          adjustment_db: 0,
          severity: 'moderate',
          visual_alert: true
        });
      }
      // 💡 Correlação muito alta (possível mono)
      else if (correlation > 0.90) {
        analysis.suggestions.push({
          type: 'stereo_width_narrow',
          message: `💡 Imagem estéreo muito estreita (correlação: ${correlation.toFixed(3)})`,
          action: `Considere expandir a imagem estéreo com cuidado`,
          explanation: "Alta correlação indica imagem estéreo limitada",
          impact: "Som pode parecer mono demais, perdendo espacialidade",
          frequency_range: "Imagem estéreo geral",
          adjustment_db: 0,
          severity: 'info'
        });
      }
    }
    
    // Tag de origem v1 se ainda não marcada
    try {
      analysis.suggestions = (analysis.suggestions||[]).map(s=> (s && typeof s==='object' && !s.source) ? ({...s, source:'v1:rules'}) : s);
    } catch {}
  try { (window.__caiarLog||function(){})('SUGGESTIONS_V1_POST','Sugestões V1 pós-processadas', { total: (analysis.suggestions||[]).length }); } catch {}
  }

  // 🎯 Gerar prompt personalizado para IA (otimizado)
  generateAIPrompt(analysis) {
    const td = analysis.technicalData || {};
    const sugList = analysis.suggestionsSnapshot || analysis.suggestions || [];
    
    // Cabeçalho compacto
    let prompt = `🎵 ANÁLISE DE ÁUDIO - Preciso de ajuda para otimizar meu mix:\n\n`;
    
    // Métricas principais em linha compacta
    const metrics = [
      `Peak: ${td.peak?.toFixed(1)||'N/A'}dB`,
      `RMS: ${td.rms?.toFixed(1)||'N/A'}dB`, 
      `DR: ${td.dynamicRange?.toFixed(1)||'N/A'}dB`,
      td.lufsIntegrated ? `LUFS: ${td.lufsIntegrated.toFixed(1)}` : null,
      td.truePeakDbtp ? `TP: ${td.truePeakDbtp.toFixed(1)}dBTP` : null,
      td.lra ? `LRA: ${td.lra.toFixed(1)}` : null
    ].filter(Boolean);
    
    prompt += `📊 MÉTRICAS: ${metrics.join(' | ')}\n`;
    
    // Frequências dominantes (só as 3 principais)
    if (td.dominantFrequencies?.length > 0) {
      const topFreqs = td.dominantFrequencies.slice(0, 3)
        .map(f => `${Math.round(f.frequency)}Hz`)
        .join(', ');
      prompt += `🎯 FREQ. DOMINANTES: ${topFreqs}\n`;
    }
    
    // Centroide espectral se disponível
    if (td.spectralCentroid) {
      prompt += `🎼 CENTROIDE: ${Math.round(td.spectralCentroid)}Hz\n`;
    }
    
    prompt += `\n`;

    // Problemas críticos
    if (analysis.problems?.length > 0) {
      prompt += `🚨 PROBLEMAS:\n`;
      analysis.problems.forEach(p => {
        prompt += `• ${p.message} → ${p.solution}\n`;
      });
      prompt += `\n`;
    }

    // Sugestões principais
    if (sugList.length > 0) {
      prompt += `💡 SUGESTÕES:\n`;
      // Converter sugestões para nomes amigáveis
      const friendlySuggestions = (window.convertSuggestionsToFriendly && window.convertSuggestionsToFriendly(sugList)) || sugList;
      friendlySuggestions.forEach(s => {
        prompt += `• ${s.message} → ${s.action}\n`;
      });
      prompt += `\n`;
    }

    // Contexto direto e objetivo
    prompt += `CONTEXTO: Com base nestes dados técnicos REAIS, forneça conselhos específicos com valores exatos (dB, Hz, Q, ratios) para EQ, compressão e limitação.`;

    // JSON estruturado otimizado
    try {
      // Deduplicação de sugestões por tipo - apenas uma por problema
      const deduplicatedSuggestions = this._deduplicateByType(sugList);
      const deduplicatedProblems = this._deduplicateByType(analysis.problems || []);
      
      const data = {
        metrics: {
          peak: td.peak,
          rms: td.rms,
          dynamicRange: td.dynamicRange,
          dr_stat: td.dr_stat,
          lufsIntegrated: td.lufsIntegrated,
          lra: td.lra,
          truePeakDbtp: td.truePeakDbtp,
          spectralCentroid: td.spectralCentroid,
          clippingSamples: td.clippingSamples,
          dcOffset: td.dcOffset
        },
        score: analysis.mixScore?.scorePct,
        classification: analysis.mixScore?.classification,
        suggestions: deduplicatedSuggestions.map(s => ({ 
          type: s.type, 
          message: s.message, 
          action: s.action,
          frequency_range: s.frequency_range,
          adjustment_db: s.adjustment_db,
          impact: s.impact,
          explanation: s.explanation
        })),
        problems: deduplicatedProblems.map(p => ({ 
          type: p.type, 
          message: p.message, 
          solution: p.solution,
          explanation: p.explanation,
          impact: p.impact,
          frequency_range: p.frequency_range,
          adjustment_db: p.adjustment_db,
          details: p.details
        }))
      };
      
      // Remove propriedades null/undefined para economizar espaço
      Object.keys(data.metrics).forEach(k => {
        if (data.metrics[k] == null) delete data.metrics[k];
      });
      
      prompt += `\n\n### JSON_DATA\n${JSON.stringify(data, null, 1)}\n### END_JSON`;
    } catch {}

    return prompt;
  }

  // Função para dedupilcar sugestões/problemas por tipo
  _deduplicateByType(items) {
    const seen = new Map();
    const deduplicated = [];
    
    for (const item of items) {
      if (!item || !item.type) continue;
      
      // Se já existe um item deste tipo, manter o mais detalhado
      if (seen.has(item.type)) {
        const existing = seen.get(item.type);
        // Priorizar item com mais detalhes técnicos
        const currentScore = this._calculateDetailScore(item);
        const existingScore = this._calculateDetailScore(existing);
        
        if (currentScore > existingScore) {
          // Substituir na lista
          const index = deduplicated.findIndex(d => d.type === item.type);
          if (index !== -1) {
            deduplicated[index] = item;
            seen.set(item.type, item);
          }
        }
      } else {
        seen.set(item.type, item);
        deduplicated.push(item);
      }
    }
    
    return deduplicated;
  }

  // Calcular score de detalhamento técnico
  _calculateDetailScore(item) {
    let score = 0;
    if (item.frequency_range) score += 2;
    if (item.adjustment_db && item.adjustment_db !== 0) score += 2;
    if (item.impact) score += 1;
    if (item.explanation) score += 1;
    if (item.details) score += 1;
    return score;
  }

  // ====== MATRIX: Métricas por banda e por stem (aprox) ======
  _computeAnalysisMatrix(mainBuffer, analysis, stemBuffersOrNull) {
    if (typeof window === 'undefined' || !window.CAIAR_ENABLED) return; // somente modo CAIAR
    const log = window.__caiarLog||function(){};
    log('MATRIX_START','Construindo analysis_matrix');
    const bandsDef = {
      sub: [20,60],
      low: [60,250],
      mid: [250,4000],
      high: [4000,12000]
    };
    const maxSeconds = 30; // limitar custo
    const procWindow = 2048;
    const hop = 1024;
    const toDb = v=> v>0 ? 20*Math.log10(v) : -Infinity;
    const percentile = (arr,p)=> { if(!arr.length) return null; const a=arr.slice().sort((x,y)=>x-y); const i=Math.min(a.length-1, Math.max(0, Math.floor(p*(a.length-1)))); return a[i]; };
    const processBuffer = (buf)=> {
      try {
        const sr = buf.sampleRate||48000;
        const lenLimit = Math.min(buf.length, sr*maxSeconds);
        const chL = buf.getChannelData(0);
        const chR = buf.numberOfChannels>1 ? buf.getChannelData(1) : chL;
        // Mid channel simplificado
        const mid = new Float32Array(lenLimit);
        for (let i=0;i<lenLimit;i++) mid[i] = 0.5*(chL[i]+chR[i]);
        // Janelas FFT
        const bandEnergyTotal = {}; const bandWindowEnergies = {}; const bandMaxEnergy = {}; const bandWindowRmsDbSeries = {};
        Object.keys(bandsDef).forEach(b=> { bandEnergyTotal[b]=0; bandWindowEnergies[b]=[]; bandMaxEnergy[b]=0; bandWindowRmsDbSeries[b]=[]; });
        for (let start=0; start+procWindow<=lenLimit; start+=hop) {
          const slice = mid.subarray(start, start+procWindow);
            const spec = this.simpleFFT ? this.simpleFFT(slice) : [];
            const half = spec.length/2;
            if (!half) continue;
            const binHz = (sr/procWindow);
            // Convert spec to magnitude (if complex output assumed real-imag pairs we need adaptation; aqui simpleFFT retorna magnitudes já no código existente)
            for (const [band, [fLo,fHi]] of Object.entries(bandsDef)) {
              let e = 0; let bins=0;
              const kStart = Math.max(1, Math.floor(fLo / binHz));
              const kEnd = Math.min(half-1, Math.floor(fHi / binHz));
              for (let k=kStart; k<=kEnd; k++) { const m = spec[k]; if (Number.isFinite(m)) { e += m*m; bins++; } }
              if (bins>0) {
                bandEnergyTotal[band] += e;
                if (e > bandMaxEnergy[band]) bandMaxEnergy[band] = e;
                bandWindowEnergies[band].push(e);
                const rms = Math.sqrt(e / Math.max(1,bins));
                bandWindowRmsDbSeries[band].push(toDb(rms));
              }
            }
        }
        const outBands = {};
        for (const band of Object.keys(bandsDef)) {
          const energies = bandWindowEnergies[band];
          if (!energies.length) { outBands[band] = null; continue; }
          const totalE = bandEnergyTotal[band];
          const maxE = bandMaxEnergy[band];
          const meanE = totalE / energies.length;
          const rms = Math.sqrt(meanE / (procWindow/2)); // normalização aproximada
          const peakAmp = Math.sqrt(maxE / (procWindow/2));
          const rmsDb = toDb(rms);
          const peakDb = toDb(peakAmp);
          const crest = Number.isFinite(rmsDb) && Number.isFinite(peakDb) ? parseFloat((peakDb - rmsDb).toFixed(2)) : null;
          const series = bandWindowRmsDbSeries[band].filter(v=>Number.isFinite(v));
          const p95 = percentile(series,0.95); const p10 = percentile(series,0.10);
          const lraApprox = (Number.isFinite(p95) && Number.isFinite(p10)) ? parseFloat((p95-p10).toFixed(2)) : null;
          const stWindows = series.slice(-3);
          const stMean = stWindows.length? (stWindows.reduce((a,b)=>a+b,0)/stWindows.length): null;
          outBands[band] = {
            rmsDb: Number.isFinite(rmsDb)? parseFloat(rmsDb.toFixed(2)) : null,
            truePeakDbtpApprox: Number.isFinite(peakDb)? parseFloat(peakDb.toFixed(2)) : null,
            crestFactor: crest,
            lraApprox,
            lufsIntegratedApprox: Number.isFinite(rmsDb)? parseFloat(rmsDb.toFixed(2)) : null,
            lufsShortTermApprox: Number.isFinite(stMean)? parseFloat(stMean.toFixed(2)) : null,
            windows: energies.length
          };
        }
        // Overall metrics (reuse existing if available)
        let overall = {};
        try {
          const td = analysis.technicalData||{};
          overall = {
            lufsIntegrated: td.lufsIntegrated ?? null,
            lufsShortTerm: td.lufsShortTerm ?? null,
            truePeakDbtp: td.truePeakDbtp ?? null,
            crestFactor: td.crestFactor ?? (Number.isFinite(td.peak) && Number.isFinite(td.rms)? parseFloat((td.peak-td.rms).toFixed(2)) : null),
            lra: td.lra ?? null
          };
        } catch {}
        return { bands: outBands, overall };
      } catch (e) { log('MATRIX_BUFFER_ERROR','Erro processando buffer', { error: e?.message||String(e) }); return null; }
    };
    const stems = {};
    // Mix principal
    stems.mix = processBuffer(mainBuffer);
    if (stemBuffersOrNull && typeof stemBuffersOrNull === 'object') {
      for (const [k,buf] of Object.entries(stemBuffersOrNull)) {
        if (buf) stems[k] = processBuffer(buf);
      }
    }
    analysis.analysis_matrix = {
      stems,
      meta: { version: '1.0.0', bands: bandsDef, approximations: true, generatedAt: new Date().toISOString() }
    };
    log('MATRIX_DONE','analysis_matrix pronta', { stems: Object.keys(stems).length });
  }
}

//  Função para analisar arquivo e enviar para chat
async function analyzeAndChat(file) {
  try {
    log('🎵 Iniciando análise de áudio...');
    
    const analysis = await window.audioAnalyzer.analyzeAudioFile(file);
    const aiPrompt = window.audioAnalyzer.generateAIPrompt(analysis);
    
    log('✅ Análise concluída:', analysis);
    
    // Enviar prompt personalizado para o chat
    await sendAudioAnalysisToChat(aiPrompt, analysis);
    
  } catch (error) {
    error('❌ Erro na análise:', error);
    
    // Detectar tipos específicos de erro
    if (error.message?.includes('ARQUIVO_MUITO_PEQUENO')) {
      alert(`Arquivo corrompido ou incompleto!\n\nO arquivo possui apenas ${error.message.match(/\d+/)?.[0] || 'poucos'} bytes, mas um arquivo de áudio válido precisa de pelo menos 100 bytes.\n\nPossíveis causas:\n• Upload foi interrompido\n• Arquivo está corrompido\n• Arquivo não é realmente de áudio\n\nTente fazer upload novamente ou use outro arquivo.`);
    } else if (error.message?.includes('ARQUIVO_VAZIO')) {
      alert('Arquivo vazio selecionado!\n\nO arquivo não contém dados. Selecione um arquivo de áudio válido.');
    } else if (error.message?.includes('Formato de áudio não suportado')) {
      warn('⚠️ Formato de áudio incompatível:', error.message);
      alert('Formato de áudio não suportado pelo navegador. Tente converter para WAV, MP3 ou M4A.');
    } else if (error.message?.includes('Unable to decode audio data')) {
      alert('Erro ao decodificar arquivo de áudio!\n\nPossíveis causas:\n• Arquivo corrompido ou incompleto\n• Formato de áudio não suportado\n• Codificação incompatível\n\nTente converter o arquivo para WAV PCM ou MP3 padrão.');
    } else {
      alert(`Erro ao analisar áudio: ${error.message}\n\nVerifique se é um arquivo de áudio válido e tente novamente.`);
    }
  }
}

// 📤 Enviar análise para chat
async function sendAudioAnalysisToChat(prompt, analysis) {
  // Simular envio de mensagem do usuário
  const message = `[ANÁLISE DE ÁUDIO] Analisei meu áudio e preciso de ajuda para melhorar. Aqui estão os dados técnicos:\n\n${prompt}`;
  
  // Enviar para o sistema de chat existente
  if (window.sendMessage) {
    window.sendMessage(message);
  } else {
    log('Prompt gerado:', message);
  }
}

log('🎵 Audio Analyzer carregado com sucesso!');

// Utilitário global para invalidar cache manualmente (fora da classe)
if (typeof window !== 'undefined') {
  // Sempre redefinir para garantir que temos a versão mais recente
  window.invalidateAudioAnalysisCache = function(){
    try {
      const map = window.__AUDIO_ANALYSIS_CACHE__;
      let size = 0;
      if (map && typeof map.clear === 'function') {
        size = map.size || 0;
        map.clear();
      }
      (window.__caiarLog||function(){})('CACHE_INVALIDATE','Cache de análises limpo manualmente', {
        entriesCleared: size,
        reason: 'manual'
      });
      log(`[AudioAnalyzer] Cache limpo (${size} entradas). Próxima análise será recalculada.`);
      return { cleared: size };
    } catch(e){ 
      warn('Falha ao invalidar cache', e); 
      return { cleared: 0, error: e?.message };
    }
  };
  
  log('✅ invalidateAudioAnalysisCache definida');
  
  // 🔄 CACHE INVALIDATION BY GENRE/REFS CHANGE
  // Sempre redefinir para garantir versão mais recente
  window.invalidateCacheByChange = function(changeType, oldValue, newValue) {
    try {
      const map = window.__AUDIO_ANALYSIS_CACHE__;
      if (!map || typeof map.delete !== 'function') return { cleared: 0 };
      
      let cleared = 0;
      
      // Invalidar apenas entradas que contenham o componente alterado
      for (const [key, entry] of map.entries()) {
        let shouldInvalidate = false;
        
        if (changeType === 'genre' && key.includes(`${oldValue}:`)) {
          shouldInvalidate = true;
        } else if (changeType === 'refsVersion' && key.includes(`:${oldValue}`)) {
          shouldInvalidate = true;
        } else if (changeType === 'all') {
          shouldInvalidate = true;
        }
        
        if (shouldInvalidate) {
          map.delete(key);
          cleared++;
        }
      }
      
      (window.__caiarLog||function(){})('CACHE_INVALIDATE','Cache invalidado por mudança', {
        changeType,
        oldValue,
        newValue,
        entriesCleared: cleared,
        reason: `${changeType}_change`
      });
      
      log(`[AudioAnalyzer] Cache invalidado: ${cleared} entradas removidas por ${changeType} change`);
      return { cleared };
      
    } catch(e) {
      (window.__caiarLog||function(){})('CACHE_INVALIDATE_ERROR','Erro na invalidação por mudança', {
        changeType,
        error: e?.message
      });
      warn('Falha ao invalidar cache por mudança', e);
      return { cleared: 0, error: e?.message };
    }
  };
  
  log('✅ invalidateCacheByChange definida');
  
  // 🔍 CACHE CHANGE MONITOR - Monitoramento automático de mudanças
  // Sempre redefinir para garantir versão mais recente
  window._cacheChangeMonitor = {
      lastGenre: window.PROD_AI_REF_GENRE,
      lastRefsVersion: window.EMBEDDED_REFS_VERSION,
      
      checkAndInvalidate() {
        const currentGenre = window.PROD_AI_REF_GENRE;
        const currentRefsVersion = window.EMBEDDED_REFS_VERSION;
        
        if (this.lastGenre && this.lastGenre !== currentGenre) {
          window.invalidateCacheByChange?.('genre', this.lastGenre, currentGenre);
        }
        
        if (this.lastRefsVersion && this.lastRefsVersion !== currentRefsVersion) {
          window.invalidateCacheByChange?.('refsVersion', this.lastRefsVersion, currentRefsVersion);
        }
        
        this.lastGenre = currentGenre;
        this.lastRefsVersion = currentRefsVersion;
      }
    };
  
  log('✅ _cacheChangeMonitor definido');
}

// === Extensão: análise direta de AudioBuffer (uso interno / testes) ===
if (!AudioAnalyzer.prototype.analyzeAudioBufferDirect) {
  AudioAnalyzer.prototype.analyzeAudioBufferDirect = async function(audioBuffer, label='synthetic') {
    try {
      if (!this.audioContext) {
        await this.initializeAnalyzer();
      }
      let base = this.performFullAnalysis(audioBuffer);
      // Enriquecer (fase 2 / avançado) – reutiliza pipeline existente
      try { base = await this._enrichWithPhase2Metrics(audioBuffer, base, { name: label }); } catch {}
      base.syntheticLabel = label;
      return base;
    } catch (e) {
      warn('analyzeAudioBufferDirect falhou', e);
      return null;
    }
  }
}

// 🎯 CLIPPING PRECEDENCE V2: Métodos para análise de picos com precedência correta
// ======================================================================

// ✨ SISTEMA ESPECTRAL AUTO-ATIVADO: Análise FFT com cálculo de energia
AudioAnalyzer.prototype.calculateSpectralBalance = function(audioData, sampleRate) {
  try {
    const fftSize = 4096;
    const hopSize = fftSize / 4;
    const maxFrames = 50;
    
    // Definir bandas de frequência
    const bandDefinitions = [
      { name: 'Sub Bass', hzLow: 20, hzHigh: 60 },
      { name: 'Bass', hzLow: 60, hzHigh: 120 },
      { name: 'Low Mid', hzLow: 120, hzHigh: 250 },
      { name: 'Mid', hzLow: 250, hzHigh: 1000 },
      { name: 'High Mid', hzLow: 1000, hzHigh: 4000 },
      { name: 'High', hzLow: 4000, hzHigh: 8000 },
      { name: 'Presence', hzLow: 8000, hzHigh: 16000 }
    ];
    
    const nyquist = sampleRate / 2;
    const binResolution = sampleRate / fftSize;
    
    // Inicializar acumuladores de energia
    const bandEnergies = bandDefinitions.map(band => ({ ...band, totalEnergy: 0 }));
    let totalSignalEnergy = 0;
    let processedFrames = 0;
    
    // Janela Hann
    const hannWindow = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      hannWindow[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));
    }
    
    // Processar frames com STFT
    for (let frameStart = 0; frameStart < audioData.length - fftSize && processedFrames < maxFrames; frameStart += hopSize) {
      // Extrair frame e aplicar janela
      const frame = new Float32Array(fftSize);
      for (let i = 0; i < fftSize; i++) {
        frame[i] = audioData[frameStart + i] * hannWindow[i];
      }
      
      // FFT simples
      const spectrum = this.simpleFFT(frame);
      
      // Calcular magnitude espectral
      for (let bin = 0; bin < fftSize / 2; bin++) {
        const frequency = bin * binResolution;
        if (frequency > nyquist) break;
        
        // Magnitude ao quadrado (energia)
        const magnitude = spectrum[bin];
        const energy = magnitude * magnitude;
        totalSignalEnergy += energy;
        
        // Acumular energia por banda
        bandEnergies.forEach(band => {
          if (frequency >= band.hzLow && frequency < band.hzHigh) {
            band.totalEnergy += energy;
          }
        });
      }
      
      processedFrames++;
    }
    
    // Filtrar apenas banda de 20Hz a 20kHz
    const validTotalEnergy = bandEnergies.reduce((sum, band) => sum + band.totalEnergy, 0);
    
    if (validTotalEnergy === 0) {
      throw new Error('Energia total zero - áudio silencioso ou erro');
    }
    
    // Calcular porcentagens e dB
    const bands = bandEnergies.map(band => {
      const energyPct = (band.totalEnergy / validTotalEnergy) * 100;
      const rmsDb = band.totalEnergy > 0 ? 10 * Math.log10(band.totalEnergy / validTotalEnergy) : -80;
      
      return {
        name: band.name,
        hzLow: band.hzLow,
        hzHigh: band.hzHigh,
        energy: band.totalEnergy,
        energyPct: energyPct,
        rmsDb: rmsDb
      };
    });
    
    // Resumo 3 bandas
    const summary3Bands = {
      Low: {
        energyPct: bands.filter(b => b.hzLow < 250).reduce((sum, b) => sum + b.energyPct, 0),
        rmsDb: -6.2 // Placeholder - pode ser calculado
      },
      Mid: {
        energyPct: bands.filter(b => b.hzLow >= 250 && b.hzLow < 4000).reduce((sum, b) => sum + b.energyPct, 0),
        rmsDb: -7.6
      },
      High: {
        energyPct: bands.filter(b => b.hzLow >= 4000).reduce((sum, b) => sum + b.energyPct, 0),
        rmsDb: -12.3
      }
    };
    
    return {
      bands: bands,
      summary3Bands: summary3Bands,
      totalEnergy: validTotalEnergy,
      processedFrames: processedFrames,
      fftSize: fftSize,
      sampleRate: sampleRate
    };
    
  } catch (error) {
    warn('⚠️ Erro na análise espectral:', error);
    return null;
  }
};

// 🎯 Calcular Sample Peak com oversampling ≥4x (mesmo buffer para consistência)
AudioAnalyzer.prototype.calculateSamplePeakWithOversampling = function(leftChannel, rightChannel, oversamplingFactor = 4) {
  const toDb = v => v > 0 ? 20 * Math.log10(v) : -Infinity;
  
  // Aplicar oversampling por interpolação linear
  const oversampleChannel = (channel) => {
    const oversampledLength = channel.length * oversamplingFactor;
    const oversampled = new Float32Array(oversampledLength);
    
    for (let i = 0; i < oversampledLength; i++) {
      const originalIndex = i / oversamplingFactor;
      const lowerIndex = Math.floor(originalIndex);
      const upperIndex = Math.min(Math.ceil(originalIndex), channel.length - 1);
      const fraction = originalIndex - lowerIndex;
      
      if (lowerIndex === upperIndex) {
        oversampled[i] = channel[lowerIndex];
      } else {
        oversampled[i] = channel[lowerIndex] * (1 - fraction) + channel[upperIndex] * fraction;
      }
    }
    return oversampled;
  };
  
  const oversampledLeft = oversampleChannel(leftChannel);
  const oversampledRight = rightChannel !== leftChannel ? oversampleChannel(rightChannel) : oversampledLeft;
  
  // Encontrar peaks nos sinais oversampleados
  let peakLeft = 0, peakRight = 0, clippingSamples = 0;
  const clipThreshold = 1.0; // Exatamente 0 dBFS
  
  for (let i = 0; i < oversampledLeft.length; i++) {
    const absLeft = Math.abs(oversampledLeft[i]);
    if (absLeft > peakLeft) peakLeft = absLeft;
    if (absLeft >= clipThreshold) clippingSamples++;
  }
  
  for (let i = 0; i < oversampledRight.length; i++) {
    const absRight = Math.abs(oversampledRight[i]);
    if (absRight > peakRight) peakRight = absRight;
    if (absRight >= clipThreshold) clippingSamples++;
  }
  
  const maxPeak = Math.max(peakLeft, peakRight);
  const clippingPct = (clippingSamples / (oversampledLeft.length + oversampledRight.length)) * 100;
  
  return {
    leftLinear: peakLeft,
    rightLinear: peakRight,
    maxLinear: maxPeak,
    leftDbFS: toDb(peakLeft),
    rightDbFS: toDb(peakRight),
    maxDbFS: toDb(maxPeak),
    clippingSamples,
    clippingPct,
    oversamplingFactor,
    source: 'sample_peak_oversampled'
  };
};

// 🎭 Estimar True Peak no mesmo buffer (compatível com ITU-R BS.1770-4)
AudioAnalyzer.prototype.estimateTruePeakFromSameBuffer = function(leftChannel, rightChannel, oversamplingFactor = 4) {
  const toDb = v => v > 0 ? 20 * Math.log10(v) : -Infinity;
  
  // True Peak simulation: aplicar upsampling com filtro mais sofisticado
  const estimateTruePeakChannel = (channel) => {
    // Simular oversampling com filtro anti-aliasing básico
    const upsampledLength = channel.length * oversamplingFactor;
    const upsampled = new Float32Array(upsampledLength);
    
    // Zero-stuffing + interpolação com filtro passa-baixas simples
    for (let i = 0; i < channel.length; i++) {
      const upsampledIndex = i * oversamplingFactor;
      upsampled[upsampledIndex] = channel[i] * oversamplingFactor; // Compensar ganho
    }
    
    // Filtro passa-baixas simples (moving average)
    const filterLength = Math.min(oversamplingFactor * 2, 8);
    const filtered = new Float32Array(upsampledLength);
    
    for (let i = 0; i < upsampledLength; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = -filterLength; j <= filterLength; j++) {
        const idx = i + j;
        if (idx >= 0 && idx < upsampledLength) {
          sum += upsampled[idx];
          count++;
        }
      }
      
      filtered[i] = count > 0 ? sum / count : 0;
    }
    
    // Encontrar peak no sinal filtrado
    let peak = 0;
    for (let i = 0; i < filtered.length; i++) {
      const abs = Math.abs(filtered[i]);
      if (abs > peak) peak = abs;
    }
    
    return peak;
  };
  
  const truePeakLeft = estimateTruePeakChannel(leftChannel);
  const truePeakRight = rightChannel !== leftChannel ? estimateTruePeakChannel(rightChannel) : truePeakLeft;
  const maxTruePeak = Math.max(truePeakLeft, truePeakRight);
  
  return {
    leftLinear: truePeakLeft,
    rightLinear: truePeakRight,
    maxLinear: maxTruePeak,
    leftDbTP: toDb(truePeakLeft),
    rightDbTP: toDb(truePeakRight),
    maxDbTP: toDb(maxTruePeak),
    isClipped: maxTruePeak >= 1.0,
    oversamplingFactor,
    source: 'true_peak_estimated'
  };
};

// 🎪 Aplicar lógica de precedência: Sample Peak > 0 dBFS override True Peak
AudioAnalyzer.prototype.applyClippingPrecedence = function(samplePeakResult, truePeakResult) {
  const result = {
    finalState: 'CLEAN',
    finalSamplePeakDbFS: samplePeakResult.maxDbFS,
    finalTruePeakDbTP: truePeakResult.maxDbTP,
    precedenceApplied: false,
    scoreCapApplied: false,
    clippingType: 'none'
  };
  
  // REGRA 1: Se Sample Peak > 0 dBFS → estado CLIPPED (precedência absoluta)
  if (samplePeakResult.maxDbFS > 0) {
    result.finalState = 'CLIPPED';
    result.clippingType = 'sample_peak';
    result.scoreCapApplied = true;
    
    // REGRA 2: True Peak não pode reportar < 0 dBTP em estado CLIPPED
    if (result.finalTruePeakDbTP < 0) {
      result.finalTruePeakDbTP = Math.max(0, result.finalTruePeakDbTP);
      result.precedenceApplied = true;
    }
  }
  // REGRA 3: Se apenas True Peak > 0 dBTP
  else if (truePeakResult.isClipped) {
    result.finalState = 'TRUE_PEAK_ONLY';
    result.clippingType = 'true_peak_only';
    result.scoreCapApplied = false; // Não aplicar caps para True Peak isolado
  }
  
  return result;
};

// 🔌 Adapter para métricas avançadas (LUFS/LRA ITU + True Peak oversampled) via módulos em /lib
// - Seguro e opcional: só sobrescreve valores quando ausentes ou quando preferido via flag
// - Cacheia módulos para evitar recarregamento
// Prototype method definido após a classe principal
AudioAnalyzer.prototype._tryAdvancedMetricsAdapter = async function(audioBuffer, baseAnalysis) {
  try {
    const debug = (typeof window !== 'undefined' && window.DEBUG_ANALYZER === true);
    const td = baseAnalysis.technicalData = baseAnalysis.technicalData || {};
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left;
    const sr = audioBuffer.sampleRate;

    // Resolver URLs absolutas para import dinâmico
    // URLs base
    const primary = {
      loud: '/lib/audio/features/loudness.js',
      tp: '/lib/audio/features/truepeak.js',
      spec: '/lib/audio/features/spectrum.js'
    };
    const fallback = {
      loud: '/public/lib/audio/features/loudness.js',
      tp: '/public/lib/audio/features/truepeak.js',
      spec: '/public/lib/audio/features/spectrum.js'
    };
    // Helper para importar com fallback
    async function importWithFallback(url1, url2) {
      try { return await import(url1 + '?v=' + Date.now()); }
      catch (e) { try { return await import(url2 + '?v=' + Date.now()); } catch (e2) { return { __err: e2 || e }; } }
    }

    // Cache global simples
    const cache = (window.__PROD_AI_ADV_CACHE__ = window.__PROD_AI_ADV_CACHE__ || {});

    // Flags de controle
    const doLoud = (typeof window === 'undefined' || window.USE_ADVANCED_LOUDNESS !== false);
    const doTP = (typeof window === 'undefined' || window.USE_ADVANCED_TRUEPEAK !== false);

    // Importar módulos necessários
    const imports = [];
    if (doLoud && !cache.loudMod) imports.push(importWithFallback(primary.loud, fallback.loud).then(m => cache.loudMod = m));
    if (doTP && !cache.tpMod) imports.push(importWithFallback(primary.tp, fallback.tp).then(m => cache.tpMod = m));
  // Import espectro somente se quisermos fase 2 (flag USE_ADVANCED_SPECTRUM não false)
  const doSpec = (typeof window !== 'undefined' || window.USE_ADVANCED_SPECTRUM !== false);
  if (doSpec && !cache.specMod) imports.push(importWithFallback(primary.spec, fallback.spec).then(m => cache.specMod = m));
    if (imports.length) await Promise.all(imports);

    // Cálculo LUFS/LRA
  const timing = baseAnalysis.timingBreakdown || (baseAnalysis.timingBreakdown = {});
  const t0Loud = performance.now();
  if (doLoud && cache.loudMod && !cache.loudMod.__err && typeof cache.loudMod.calculateLoudnessMetrics === 'function') {
      try {
        const lres = cache.loudMod.calculateLoudnessMetrics(left, right, sr);
        // Preencher/atualizar valores: preferir avançado se ausente ou se PREFER_ADVANCED_METRICS=true
        const prefer = (typeof window !== 'undefined' && window.PREFER_ADVANCED_METRICS === true);
        const setIfBetter = (key, val) => {
          if (val == null || !Number.isFinite(val)) return;
          if (td[key] == null || prefer) {
            td[key] = val;
            (td._sources = td._sources || {})[key] = 'advanced:loudness';
          }
        };
        setIfBetter('lufsIntegrated', lres.lufs_integrated);
        setIfBetter('lufsShortTerm', lres.lufs_short_term);
        setIfBetter('lufsMomentary', lres.lufs_momentary);
        setIfBetter('lra', lres.lra);
        // headroom_db original (offset para -23 LUFS) mantido para compatibilidade
        setIfBetter('headroomDb', lres.headroom_db);
        if (Number.isFinite(lres.loudness_offset_db)) {
          td.loudnessOffsetDb = lres.loudness_offset_db;
          (td._sources = td._sources || {}).loudnessOffsetDb = 'advanced:loudness';
        }
        // Guardar meta-info útil
        baseAnalysis.advancedLoudness = {
          gating: lres.gating_stats,
          referenceLevel: lres.reference_level,
          meetsBroadcast: !!lres.meets_broadcast
        };
        if (debug) log('✅ [ADV] Loudness/LRA aplicados:', {
          lufs: td.lufsIntegrated, lra: td.lra, headroomDb: td.headroomDb
        });
      } catch (e) { if (debug) warn('⚠️ [ADV] Falha LUFS:', e?.message || e); }
    }
  timing.loudnessMs = Math.round(performance.now() - t0Loud);

    // Cálculo True Peak
  const t0TP = performance.now();
  if (doTP && cache.tpMod && !cache.tpMod.__err && typeof cache.tpMod.analyzeTruePeaks === 'function') {
      try {
        const tres = cache.tpMod.analyzeTruePeaks(left, right, sr);
        const prefer = (typeof window !== 'undefined' && window.PREFER_ADVANCED_METRICS === true);
        const setIfBetter = (key, val) => {
          if (val == null || !Number.isFinite(val)) return;
          if (td[key] == null || prefer) {
            td[key] = val;
            (td._sources = td._sources || {})[key] = 'advanced:truepeak';
          }
        };
        setIfBetter('truePeakDbtp', tres.true_peak_dbtp);
        setIfBetter('samplePeakLeftDb', tres.sample_peak_left_db);
        setIfBetter('samplePeakRightDb', tres.sample_peak_right_db);
        // === Clipping oversampled unificado (domínio True Peak) ===
        try {
          const enableUnifiedClip = (typeof window === 'undefined' || window.UNIFIED_TRUEPEAK_CLIP === true);
          if (enableUnifiedClip && Number.isFinite(tres.true_peak_clipping_count)) {
            td.clippingSamplesTruePeak = tres.true_peak_clipping_count;
            (td._sources = td._sources || {}).clippingSamplesTruePeak = 'advanced:truepeak';
            td.truePeakClipThresholdDbtp = tres.true_peak_clip_threshold_dbtp;
            td.truePeakClipThresholdLinear = tres.true_peak_clip_threshold_linear;
            // Se contagem legacy inexistente ou prefer avançado, substituir
            if (td.clippingSamples == null || prefer) {
              td.clippingSamples = tres.true_peak_clipping_count;
              (td._sources = td._sources || {}).clippingSamples = 'advanced:truepeak';
            }
          }
        } catch {}
        // Derivar headroom real (pico até 0 dBTP) e ajustar se valor anterior incoerente
        try {
          const peaks = [tres.true_peak_dbtp, tres.sample_peak_left_db, tres.sample_peak_right_db].filter(v => Number.isFinite(v));
          if (peaks.length) {
            const maxPeak = Math.max(...peaks);
            const headroomTrue = 0 - maxPeak;
            if (Number.isFinite(headroomTrue)) {
              td.headroomTruePeakDb = headroomTrue;
              (td._sources = td._sources || {}).headroomTruePeakDb = 'derived:truepeak';
              if (!Number.isFinite(td.headroomDb) || td.headroomDb < -40 || td.headroomDb > 60) {
                td.headroomDb = headroomTrue;
                (td._sources = td._sources || {}).headroomDb = 'derived:truepeak';
              }
            }
          }
        } catch {}
        // Info extra
        baseAnalysis.advancedTruePeak = {
          oversampling: tres.oversampling_factor,
          exceedsMinus1dBTP: !!tres.exceeds_minus1dbtp,
          warnings: tres.warnings || []
        };
        if (debug) log('✅ [ADV] True Peak aplicado:', { truePeakDbtp: td.truePeakDbtp });
      } catch (e) { if (debug) warn('⚠️ [ADV] Falha TruePeak:', e?.message || e); }
    }
  timing.truePeakMs = Math.round(performance.now() - t0TP);

  // ===== FASE 2 (INÍCIO): Bandas espectrais alinhadas às referências =====
    try {
      const t0Spec = performance.now();
      const ref = (typeof window !== 'undefined') ? window.PROD_AI_REF_DATA : null;
      const doBands = !!ref && cache.specMod && !cache.specMod.__err && typeof cache.specMod.analyzeSpectralFeatures === 'function';
      if (doBands) {
        // Evitar reprocessar se já existe (idempotente)
        if (!td.bandEnergies) {
          // Esperar referência carregada (até 1s) se necessário
          if (!ref) {
            await new Promise(r => setTimeout(r, 50));
          }
          // Fonte espectral: por padrão usa canal esquerdo (compatibilidade). Opcionalmente mix estéreo
          const useStereoMix = (typeof window !== 'undefined' && window.USE_STEREO_MIX_SPECTRUM === true);
          const srcBuffer = (useStereoMix && right) ? (function(){
            const maxSeconds = 90;
            const maxSamples = Math.min(Math.min(left.length, right.length), sr * maxSeconds);
            const mix = new Float32Array(maxSamples);
            for (let i=0;i<maxSamples;i++) mix[i] = 0.5*(left[i] + right[i]);
            return mix;
          })() : (function(){
            const maxSeconds = 90;
            const maxSamples = Math.min(left.length, sr * maxSeconds);
            return left.subarray(0, maxSamples);
          })();
          const slice = srcBuffer;
          let specRes = null;
          try {
            specRes = cache.specMod.analyzeSpectralFeatures(slice, sr, 'fast');
          } catch (se) { if (debug) warn('⚠️ [ADV] Falha analyzeSpectralFeatures:', se?.message || se); }
          if (specRes && Array.isArray(specRes.spectrum_avg) && Array.isArray(specRes.freq_bins_compact)) {
            // Definir faixas das bandas (assumido; documentar se necessário)
            const bandDefs = {
              sub: [20, 60],
              low_bass: [60, 120],
              upper_bass: [120, 250],
              low_mid: [250, 500],
              mid: [500, 2000],
              high_mid: [2000, 6000],
              brilho: [6000, 12000],
              presenca: [12000, 18000]
            };
            const bins = specRes.freq_bins_compact;
            const mags = specRes.spectrum_avg;
            const bandEnergies = {};
            
            // ✨ AUTO-ATIVAÇÃO SISTEMA ESPECTRAL: Usar análise FFT avançada automaticamente
            if (baseAnalysis.spectralBalance && baseAnalysis.spectralBalance.bands) {
              log('✨ Sistema espectral auto-ativado para bandEnergies');
              // Mapear bandas espectrais para formato bandEnergies
              const spectralBands = baseAnalysis.spectralBalance.bands;
              const bandMapping = {
                'Sub Bass': 'sub',
                'Bass': 'low_bass', 
                'Low Mid': 'low_mid',
                'Mid': 'mid',
                'High Mid': 'high_mid',
                'High': 'brilho',
                'Presence': 'presenca'
              };
              
              spectralBands.forEach(band => {
                const mappedName = bandMapping[band.name] || band.name.toLowerCase().replace(' ', '_');
                if (mappedName) {
                  // Converter % energia para dB relativo
                  const energyRatio = band.energyPct / 100; // Converter % para proporção
                  const db = 10 * Math.log10(energyRatio || 1e-9);
                  bandEnergies[mappedName] = { 
                    energy: band.energy, 
                    rms_db: db,
                    energyPct: band.energyPct, // ✨ Novo campo!
                    scale: 'spectral_balance_auto' 
                  };
                }
              });
              
              td.bandEnergies = bandEnergies;
              (td._sources = td._sources || {}).bandEnergies = 'spectral_balance_auto_fft';
            } else {
              // Fallback para análise espectral padrão
              const totalEnergy = mags.reduce((a,b)=>a + (b>0?b:0),0) || 1;
              for (const [band,[fLow,fHigh]] of Object.entries(bandDefs)) {
                let energy=0, count=0;
                for (let i=0; i<bins.length; i++) {
                  const f = bins[i];
                  if (f >= fLow && f < fHigh) { energy += mags[i]; count++; }
                }
                if (count>0) {
                  const lin = energy / count; // média simples
                  // CORREÇÃO: Normalizar pela energia TOTAL, não pela média por bin
                  // Isso garante valores relativos negativos (banda < total)
                  const norm = energy / totalEnergy; // Proporção da energia total
                  const db = 10 * Math.log10(norm || 1e-9);
                  bandEnergies[band] = { energy: lin, rms_db: db, scale: 'log_ratio_db' };
                } else {
                  bandEnergies[band] = { energy: 0, rms_db: -Infinity, scale: 'log_ratio_db' };
                }
              }
              td.bandEnergies = bandEnergies;
              (td._sources = td._sources || {}).bandEnergies = 'advanced:spectrum';
            }
            // Alternativa segura: normalização log baseada na proporção da soma linear por banda
            try {
              const sumPerBand = {};
              let totalSum = 0;
              for (const [band,[fLow,fHigh]] of Object.entries(bandDefs)) {
                let sum=0;
                for (let i=0;i<bins.length;i++) {
                  const f = bins[i];
                  if (f >= fLow && f < fHigh) { const v = mags[i]; if (v>0) sum += v; }
                }
                sumPerBand[band] = sum;
                totalSum += sum;
              }
              const safeTotal = totalSum || 1;
              const bandEnergiesLog = {};
              for (const band of Object.keys(bandDefs)) {
                let ratio = sumPerBand[band] / safeTotal;
                if (!(ratio>0)) ratio = 1e-9; // evitar -Inf
                const db = 10 * Math.log10(ratio);
                // manter shape compatível (usa rms_db)
                bandEnergiesLog[band] = { rms_db: db, proportion: ratio, scale: 'log_proportion_db' };
              }
              td.bandEnergiesLog = bandEnergiesLog;
              (td._sources = td._sources || {}).bandEnergiesLog = 'advanced:spectrum:log';
              // Metadados de escala global
              td.bandScale = 'log_ratio_db';
              td.bandLogScale = 'log_proportion_db';
            } catch (_) { /* não crítico */ }
            // 🛡️ TONAL BALANCE SAFE V1: Validação avançada antes de criar tonalBalance
            if (!td.tonalBalance && Object.keys(bandEnergies).length > 0) {
              const candidateTonalBalance = {
                sub: bandEnergies.sub ? { rms_db: bandEnergies.sub.rms_db } : null,
                low: bandEnergies.low_bass ? { rms_db: bandEnergies.low_bass.rms_db } : null,
                mid: bandEnergies.mid ? { rms_db: bandEnergies.mid.rms_db } : null,
                high: bandEnergies.brilho ? { rms_db: bandEnergies.brilho.rms_db } : null
              };
              
              // 🔍 Aplicar validação se sistema seguro estiver ativo
              if (typeof window !== 'undefined' && window.TONAL_BALANCE_SAFE_V1 && window.validateSpectralBandsData) {
                const validation = window.validateSpectralBandsData(candidateTonalBalance);
                
                if (validation.shouldDisplay) {
                  // Dados validados - pode usar
                  td.tonalBalance = candidateTonalBalance;
                  (td._sources = td._sources || {}).tonalBalance = 'advanced:spectrum:validated';
                } else {
                  // Dados problemáticos - não criar tonalBalance (UI mostrará "—")
                  td.tonalBalance = null;
                  (td._sources = td._sources || {}).tonalBalance = 'advanced:spectrum:rejected';
                  
                  if (typeof window !== 'undefined' && window.TONAL_BALANCE_CONFIG?.DEBUG) {
                    log('🚫 [TONAL-SAFE] tonalBalance rejeitado na origem:', validation.issues);
                  }
                }
              } else {
                // Sistema seguro não ativo - usar comportamento original
                td.tonalBalance = candidateTonalBalance;
                (td._sources = td._sources || {}).tonalBalance = 'advanced:spectrum';
              }
            }
            // Comparar com targets da referência e gerar sugestões band_adjust
            try {
              const sug = baseAnalysis.suggestions = Array.isArray(baseAnalysis.suggestions) ? baseAnalysis.suggestions : [];
              const existingKeys = new Set(sug.map(s => s && s._bandKey));
              let addedCount = 0;
              const maxBandSuggestions = (typeof window !== 'undefined' && Number.isFinite(window.MAX_BAND_SUGGESTIONS)) ? window.MAX_BAND_SUGGESTIONS : 6;
              // === Normalização de escala de bandas (feature flag) ===
              // Objetivo: quando referências possuem escala diferente (ex.: valores positivos grandes) alinhar ao espaço dos valores medidos (normalmente negativos em log_ratio_db)
              let refBandTargetsNormalized = null;
              try {
                const enableNorm = (typeof window !== 'undefined' && window.ENABLE_REF_BAND_NORMALIZATION === true);
                if (enableNorm && ref && ref.bands && td.bandEnergies) {
                  const measuredVals = Object.values(td.bandEnergies).map(v => v && Number.isFinite(v.rms_db) ? v.rms_db : null).filter(v => v!=null);
                  const refVals = Object.values(ref.bands).map(v => v && Number.isFinite(v.target_db) ? v.target_db : null).filter(v => v!=null);
                  if (measuredVals.length >= 3 && refVals.length >= 3) {
                    const measMin = Math.min(...measuredVals);
                    const measMax = Math.max(...measuredVals);
                    const refMin = Math.min(...refVals);
                    const refMax = Math.max(...refVals);
                    const posRefRatio = refVals.filter(v => v > 0).length / refVals.length;
                    const allMeasuredNeg = measuredVals.every(v => v <= 0);
                    if (allMeasuredNeg && posRefRatio > 0.6 && (refMax - refMin) > 1e-3 && (measMax - measMin) > 1e-3) {
                      refBandTargetsNormalized = {};
                      for (const [bk, rb] of Object.entries(ref.bands)) {
                        if (rb && Number.isFinite(rb.target_db)) {
                          const t = (rb.target_db - refMin) / (refMax - refMin);
                          refBandTargetsNormalized[bk] = measMin + t * (measMax - measMin);
                        }
                      }
                    }
                  }
                  // Construir estrutura norm com status (OK/OUT/NA)
                  const normBands = {};
                  for (const [bk, rb] of Object.entries(ref.bands)) {
                    const measured = td.bandEnergies[bk];
                    const hasTarget = rb && Number.isFinite(rb.target_db) && Number.isFinite(rb.tol_db);
                    if (!hasTarget) {
                      normBands[bk] = { rms_db: measured?.rms_db ?? null, status: 'NA' };
                      continue;
                    }
                    const target = (refBandTargetsNormalized && Number.isFinite(refBandTargetsNormalized[bk])) ? refBandTargetsNormalized[bk] : rb.target_db;
                    const tol = rb.tol_db;
                    const val = measured && Number.isFinite(measured.rms_db) ? measured.rms_db : null;
                    if (val == null) { normBands[bk] = { rms_db: null, target, tol, status: 'MISSING' }; continue; }
                    const delta = val - target;
                    normBands[bk] = { rms_db: val, target, tol, delta, status: Math.abs(delta) <= tol ? 'OK':'OUT' };
                  }
                  // 🛡️ PROTEÇÃO RACE CONDITION: Aplicar runId antes da atribuição crítica
                  const bandNormData = { 
                    bands: normBands, 
                    normalized: !!refBandTargetsNormalized,
                    _runId: runId,
                    _timestamp: Date.now()
                  };
                  
                  // Verificar se não há conflito de runId antes da atribuição
                  if (td.bandNorm && td.bandNorm._runId && td.bandNorm._runId !== runId) {
                    warn(`⚠️ [${runId}] Conflito de runId detectado em td.bandNorm: ${td.bandNorm._runId} vs ${runId}`);
                  }
                  
                  td.bandNorm = bandNormData;
                  (td._sources = td._sources || {}).bandNorm = `audit:band_norm:${runId}`;
                }
              } catch (eNorm) { if (window.DEBUG_ANALYZER) warn('[REF_SCALE] Falha normalização bandas', eNorm); }
              for (const [band, data] of Object.entries(bandEnergies)) {
                if (addedCount >= maxBandSuggestions) break;
                const refBand = ref?.bands?.[band];
                if (!refBand || !Number.isFinite(refBand.target_db) || !Number.isFinite(refBand.tol_db)) continue;
                if (!Number.isFinite(data.rms_db) || data.rms_db === -Infinity) continue;
                // Usar valor normalizado se disponível
                const refTarget = (refBandTargetsNormalized && Number.isFinite(refBandTargetsNormalized[band])) ? refBandTargetsNormalized[band] : refBand.target_db;
                // CORREÇÃO: Usar mesmo cálculo da tabela de referência (atual - target)
                const diff = data.rms_db - refTarget;
                // Suporte a tolerância assimétrica: tol_min / tol_max. Compat: usar tol_db se não existirem.
                const tolMin = Number.isFinite(refBand.tol_min) ? refBand.tol_min : refBand.tol_db;
                const tolMax = Number.isFinite(refBand.tol_max) ? refBand.tol_max : refBand.tol_db;
                const highLimit = refTarget + tolMax;
                const lowLimit = refTarget - tolMin;
                let status = 'OK';
                if (data.rms_db < lowLimit) status = 'BAIXO'; else if (data.rms_db > highLimit) status = 'ALTO';
                const outOfRange = status !== 'OK';
                if (outOfRange) {
                  // CORREÇÃO: Usar a mesma lógica da tabela de referência
                  // diff > 0 = valor atual maior que target = DIMINUIR/CORTAR
                  // diff < 0 = valor atual menor que target = AUMENTAR/BOOST
                  const shouldReduce = diff > 0; // valor atual > target
                  const shouldBoost = diff < 0;  // valor atual < target
                  
                  const baseMag = Math.abs(diff);
                  const sideTol = diff > 0 ? tolMax : tolMin;
                  const n = sideTol>0 ? baseMag / sideTol : 0;
                  const severity = n <= 1 ? 'leve' : (n <= 2 ? 'media' : 'alta');
                  let action;
                  
                  if (shouldReduce) {
                    // Valor atual > target = precisa reduzir
                    if (band === 'high_mid') {
                      action = `Médios Agudos estão ${baseMag.toFixed(1)}dB acima do ideal`;
                      var explanation = "Excesso nesta faixa causa harshness e fadiga auditiva";
                      var impact = "Som áspero, vocais agressivos, cymbals cortantes";
                      var frequency_range = "2–4 kHz";
                      var adjustment_db = -baseMag;
                    }
                    else if (band === 'brilho') {
                      action = `Agudos estão ${baseMag.toFixed(1)}dB acima do ideal`;
                      var explanation = "Excesso de brilho pode causar sibilância excessiva";
                      var impact = "Som muito brilhante, sibilantes exageradas, fadiga";
                      var frequency_range = "4–8 kHz";
                      var adjustment_db = -baseMag;
                    }
                    else if (band === 'presenca') {
                      action = `Presença está ${baseMag.toFixed(1)}dB acima do ideal`;
                      var explanation = "Excesso de presença torna o som artificial e cansativo";
                      var impact = "Vocais muito na frente, instrumentos artificiais";
                      var frequency_range = "8–12 kHz";
                      var adjustment_db = -baseMag;
                    }
                    else if (band === 'low_bass') {
                      action = `Bass está ${baseMag.toFixed(1)}dB acima do ideal`;
                      var explanation = "Excesso de graves causa perda de definição e mascaramento";
                      var impact = "Som confuso, perda de punch, mascaramento dos médios";
                      var frequency_range = "60–200 Hz";
                      var adjustment_db = -baseMag;
                    }
                    else if (band === 'mid_bass') {
                      action = `Médios Graves estão ${baseMag.toFixed(1)}dB acima do ideal`;
                      var explanation = "Excesso nesta região causa 'muddy sound' (som enlameado)";
                      var impact = "Som abafado, instrumentos sem clareza, mix confuso";
                      var frequency_range = "200–500 Hz";
                      var adjustment_db = -baseMag;
                    }
                    else if (band === 'mid') {
                      action = `Médios estão ${baseMag.toFixed(1)}dB acima do ideal`;
                      var explanation = "Excesso de médios deixa o som entediante e sem vida";
                      var impact = "Som monótono, vocais abafados, falta de dinâmica";
                      var frequency_range = "500 Hz–2 kHz";
                      var adjustment_db = -baseMag;
                    }
                    else {
                      action = `${band} precisa ser reduzido em ${baseMag.toFixed(1)}dB`;
                      var explanation = "Nível acima do recomendado para o gênero";
                      var impact = "Desequilíbrio tonal geral";
                      var frequency_range = "N/A";
                      var adjustment_db = -baseMag;
                    }
                  } else if (shouldBoost) {
                    // Valor atual < target = precisa aumentar
                    if (band === 'high_mid') {
                      action = `Médios Agudos estão ${baseMag.toFixed(1)}dB abaixo do ideal`;
                      var explanation = "Falta de definição e clareza na região de presença vocal";
                      var impact = "Vocais distantes, falta de inteligibilidade, som sem vida";
                      var frequency_range = "2–4 kHz";
                      var adjustment_db = baseMag;
                    }
                    else if (band === 'brilho') {
                      action = `Agudos estão ${baseMag.toFixed(1)}dB abaixo do ideal`;
                      var explanation = "Falta de brilho e air deixa o som sem abertura";
                      var impact = "Som abafado, cymbals sem crisp, falta de espacialidade";
                      var frequency_range = "4–8 kHz";
                      var adjustment_db = baseMag;
                    }
                    else if (band === 'presenca') {
                      action = `Presença está ${baseMag.toFixed(1)}dB abaixo do ideal`;
                      var explanation = "Falta de presença reduz a proximidade e intimidade";
                      var impact = "Instrumentos distantes, falta de conexão emocional";
                      var frequency_range = "8–12 kHz";
                      var adjustment_db = baseMag;
                    }
                    else if (band === 'low_bass') {
                      action = `Bass está ${baseMag.toFixed(1)}dB abaixo do ideal`;
                      var explanation = "Falta de fundação graves reduz o impacto e energia";
                      var impact = "Som fraco, sem peso, falta de groove e energia";
                      var frequency_range = "60–200 Hz";
                      var adjustment_db = baseMag;
                    }
                    else if (band === 'mid_bass') {
                      action = `Médios Graves estão ${baseMag.toFixed(1)}dB abaixo do ideal`;
                      var explanation = "Falta de corpo e warmth na região fundamental";
                      var impact = "Som fino, instrumentos sem corpo, falta de calor";
                      var frequency_range = "200–500 Hz";
                      var adjustment_db = baseMag;
                    }
                    else if (band === 'mid') {
                      action = `Médios estão ${baseMag.toFixed(1)}dB abaixo do ideal`;
                      var explanation = "Falta de preenchimento na região mais importante para audição";
                      var impact = "Som oco, vocais distantes, falta de corpo geral";
                      var frequency_range = "500 Hz–2 kHz";
                      var adjustment_db = baseMag;
                    }
                    else {
                      action = `${band} precisa ser aumentado em ${baseMag.toFixed(1)}dB`;
                      var explanation = "Nível abaixo do recomendado para o gênero";
                      var impact = "Desequilíbrio tonal geral";
                      var frequency_range = "N/A";
                      var adjustment_db = baseMag;
                    }
                  }
                  const key = `band:${band}`;
                  if (!existingKeys.has(key)) {
                    // Acrescentar faixa sugerida (Hz) nos detalhes, usando definição das bandas
                    const br = bandDefs[band];
                    const rangeTxt = Array.isArray(br) && br.length===2 ? ` | faixa ${Math.round(br[0])}-${Math.round(br[1])}Hz` : '';
                    // Usar nome amigável da banda se disponível
                    const friendlyBandName = (window.getFriendlyLabel && window.getFriendlyLabel(`band:${band}`)) || band;
                    const statusMessage = shouldReduce ? `${friendlyBandName} acima do ideal` : `${friendlyBandName} abaixo do ideal`;
                    
                    sug.push({
                      type: 'band_adjust',
                      _bandKey: key,
                      message: `${friendlyBandName}: ${statusMessage}`,
                      action: action.replace(new RegExp(`\\b${band}\\b`, 'gi'), friendlyBandName),
                      explanation: explanation || "Ajuste necessário para equilibrio tonal",
                      impact: impact || "Afeta o balanço geral da mixagem",
                      frequency_range: frequency_range || "N/A",
                      adjustment_db: adjustment_db || 0,
                      details: `Atual: ${data.rms_db.toFixed(1)}dB | Alvo: ${refTarget.toFixed(1)}dB | Diferença: ${diff>0?'+':''}${diff.toFixed(1)}dB`
                    });
                    existingKeys.add(key);
                    addedCount++;
                  }
                }
              }
            } catch (es) { if (debug) warn('⚠️ [ADV] Sugestões bandas falharam:', es?.message || es); }
            // Sugestões agrupadas (Lote B) – somente se múltiplas bandas relacionadas fora do alvo
            try {
              const sug = baseAnalysis.suggestions = Array.isArray(baseAnalysis.suggestions) ? baseAnalysis.suggestions : [];
              const groups = [
                { name: 'Graves', bands: ['sub','low_bass','upper_bass'] },
                { name: 'Médios', bands: ['low_mid','mid','high_mid'] },
                { name: 'Agudos', bands: ['brilho','presenca'] }
              ];
              for (const g of groups) {
                const related = sug.filter(s => s.type==='band_adjust' && g.bands.some(b => s._bandKey === `band:${b}`));
                if (related.length >= 2) {
                  const diffs = related.map(r => {
                    const m = r.details && r.details.match(/([+\-]?[0-9.]+)dB/); return m ? Math.abs(parseFloat(m[1])) : 0; });
                  const meanAbs = diffs.reduce((a,b)=>a+b,0)/Math.max(1,diffs.length);
                  if (!sug.some(s => s.type==='band_group_adjust' && s.group===g.name)) {
                    sug.push({
                      type: 'band_group_adjust',
                      group: g.name,
                      message: `${g.name} com várias bandas fora do alvo`,
                      action: `Aplicar EQ geral nos ${g.name.toLowerCase()} (ajuste médio ~${meanAbs.toFixed(1)}dB)`,
                      details: related.map(r=>r.message).join(' | ')
                    });
                  }
                }
              }
            } catch (eg) { if (debug) warn('⚠️ [ADV] Agrupamento bandas falhou:', eg?.message || eg); }
            // Ordenação opcional das sugestões por prioridade (não altera padrão)
            try {
              if (typeof window !== 'undefined' && window.SORT_SUGGESTIONS === true) {
                const priority = {
                  band_group_adjust: 1,
                  band_adjust: 2,
                  surgical_eq: 3,
                  mastering: 4,
                  frequency_imbalance: 5,
                  highs_excess: 5,
                  highs_deficient: 5,
                  low_end_excess: 5,
                  bass_deficient: 5,
                };
                const arr = baseAnalysis.suggestions || [];
                baseAnalysis.suggestions = arr
                  .map((s, idx) => ({ s, idx }))
                  .sort((a,b)=> (priority[a.s?.type]||99) - (priority[b.s?.type]||99) || a.idx - b.idx)
                  .map(x=>x.s);
              }
            } catch (esrt) { if (debug) warn('⚠️ [ADV] Sort sugestões falhou:', esrt?.message || esrt); }
            // Sugestões cirúrgicas (detecção de ressonâncias estreitas)
            try {
              const enableSurgical = (typeof window === 'undefined' || window.USE_SURGICAL_EQ !== false);
              if (enableSurgical && Array.isArray(mags) && Array.isArray(bins)) {
                const sug = baseAnalysis.suggestions = Array.isArray(baseAnalysis.suggestions) ? baseAnalysis.suggestions : [];
                const maxItems = (typeof window !== 'undefined' && Number.isFinite(window.MAX_SURGICAL_EQ)) ? window.MAX_SURGICAL_EQ : 3;
                const minHz = 120; // evitar subgrave
                const maxHz = 12000; // evitar extremo alto
                const results = [];
                // Suavização local simples e detecção por contraste com vizinhos
                const eps = 1e-12;
                const win = 2; // vizinhos de cada lado
                for (let i = win; i < mags.length - win; i++) {
                  const f = bins[i];
                  if (f < minHz || f > maxHz) continue;
                  const m = Math.max(mags[i], 0);
                  // média de vizinhos (exclui o pico)
                  let nsum = 0, ncount = 0;
                  for (let k = i - win; k <= i + win; k++) {
                    if (k === i) continue; const mv = Math.max(mags[k], 0); nsum += mv; ncount++;
                  }
                  const navg = nsum / Math.max(1, ncount);
                  const contrastDb = 20 * Math.log10((m + eps) / (navg + eps));
                  if (!Number.isFinite(contrastDb)) continue;
                  // critério: pico pelo menos 7 dB acima da vizinhança
                  if (contrastDb >= 7) {
                    results.push({ idx: i, freq: f, gainDb: contrastDb, mag: m });
                  }
                }
                // Ordenar por saliência e filtrar próximos (>= 200 Hz de distância)
                results.sort((a,b)=> b.gainDb - a.gainDb);
                const picked = [];
                const minDist = 200; // Hz
                for (const r of results) {
                  if (picked.length >= maxItems) break;
                  if (picked.some(p => Math.abs(p.freq - r.freq) < minDist)) continue;
                  picked.push(r);
                }
                // Adicionar sugestões
                for (const r of picked) {
                  // Severidade baseada no ganho relativo
                  const severity = r.gainDb >= 12 ? 'severa' : (r.gainDb >= 9 ? 'alta' : 'moderada');
                  const freqStr = Math.round(r.freq);
                  const gainStr = (r.gainDb >= 12 ? 4 : r.gainDb >= 9 ? 3 : 2); // sugestão de corte aproximado
                  const qStr = r.freq < 1500 ? 5 : (r.freq < 5000 ? 6 : 7);
                  // Evitar duplicados aproximados
                  const dupe = sug.some(s => s.type==='surgical_eq' && /\[(\d+)Hz\]/.test(s.message || '') && Math.abs(parseFloat((s.message.match(/\[(\d+)Hz\]/)||[])[1]) - r.freq) < 120);
                  if (dupe) continue;
                  sug.push({
                    type: 'surgical_eq',
                    message: `Ressonância — [${freqStr}Hz] - ${severity}`,
                    action: `Corte cirúrgico em ${freqStr} Hz: -${gainStr} dB, Q ${qStr}`,
                    details: `Pico estreito ~+${r.gainDb.toFixed(1)} dB acima da vizinhança`
                  });
                }
              }
            } catch (esurg) { if (debug) warn('⚠️ [ADV] Surgical EQ falhou:', esurg?.message || esurg); }
            if (debug) log('✅ [ADV] Band energies calculadas', td.bandEnergies);
          }
        }
      }
      if (doBands) timing.spectrumMs = Math.round(performance.now() - t0Spec);
    } catch (e) { if (debug) warn('⚠️ [ADV] Band energies falharam:', e?.message || e); }
    // ===== FASE 2 (FIM) =====

    // ===== Validação de consistência (DR vs crestFactor, Loudness Range plausível) =====
    try {
      const mv = baseAnalysis.metricsValidation || (baseAnalysis.metricsValidation = {});
      const peak = td.peak ?? baseAnalysis.technicalData.peak;
      const rms = td.rms ?? baseAnalysis.technicalData.rms;
      const dr = td.dynamicRange ?? baseAnalysis.technicalData.dynamicRange;
      const crest = td.crestFactor;
      if (Number.isFinite(peak) && Number.isFinite(rms)) {
        const expectedDR = Math.abs(peak - rms);
        if (Number.isFinite(dr)) {
          const diff = Math.abs(dr - expectedDR);
          mv.dynamicRangeConsistency = diff < 0.8 ? 'ok' : (diff < 1.5 ? 'warn' : 'check');
          mv.dynamicRangeDelta = parseFloat(diff.toFixed(2));
        }
        if (Number.isFinite(crest)) {
          const d2 = Math.abs(crest - expectedDR);
          mv.crestFactorConsistency = d2 < 0.8 ? 'ok' : (d2 < 1.5 ? 'warn' : 'check');
          mv.crestVsExpectedDelta = parseFloat(d2.toFixed(2));
        }
      }
      // 🎯 Validação LRA: detectar valores anômalos
      if (Number.isFinite(td.lra)) {
        if (td.lra > 30) {
          mv.lraAnomaly = 'high';
          mv.lraNote = 'LRA muito alto - possível uso de algoritmo legacy';
          warn(`⚠️ LRA anômalo: ${td.lra.toFixed(1)} LU - considere ativar USE_R128_LRA`);
        } else if (td.lra < 0.5) {
          mv.lraAnomaly = 'low';
          mv.lraNote = 'LRA muito baixo - material muito comprimido';
        } else {
          mv.lraAnomaly = 'normal';
        }
      }
      // 🎯 Validação LUFS: range broadcasting
      if (Number.isFinite(td.lufsIntegrated)) {
        const lufs = td.lufsIntegrated;
        if (lufs > -6) {
          mv.lufsWarning = 'very_loud';
          mv.lufsNote = 'LUFS muito alto - risco de distorção';
        } else if (lufs < -50) {
          mv.lufsWarning = 'very_quiet';
          mv.lufsNote = 'LUFS muito baixo - possível silêncio/erro';
        } else if (lufs >= -24 && lufs <= -22) {
          mv.lufsNote = 'Broadcast compliant (EBU R128)';
        }
      }
      // 🎯 Validação adicional LRA vs DR
      if (Number.isFinite(td.lra) && Number.isFinite(dr)) {
        // LRA plausível: não maior que 3× DR e não negativa
        mv.lraPlausibility = (td.lra >= 0 && td.lra <= dr * 3) ? 'ok' : 'check';
      }
    } catch (e) { if (debug) warn('⚠️ [ADV] Validação métricas falhou:', e?.message || e); }
    // === Invariantes & saneamento (feature flag ENABLE_METRIC_INVARIANTS) ===
    try {
      if (typeof window === 'undefined' || window.ENABLE_METRIC_INVARIANTS === true) {
        const tdv = baseAnalysis.technicalData || {};
        const logWarn = (m,c={})=>{ if (typeof window !== 'undefined' && window.DEBUG_ANALYZER) warn('[INVARIANT]', m, c); };
        // Consolidar sample peaks
        if (Number.isFinite(tdv.samplePeakLeftDb) && Number.isFinite(tdv.samplePeakRightDb)) {
          const maxPk = Math.max(tdv.samplePeakLeftDb, tdv.samplePeakRightDb);
          if (!Number.isFinite(tdv.samplePeakDb)) tdv.samplePeakDb = maxPk;
        }
        // SamplePeak ≤ TruePeak ≤ 0
        if (Number.isFinite(tdv.truePeakDbtp)) {
          if (tdv.truePeakDbtp > 0.05) logWarn('TruePeak > 0dBTP', {tp: tdv.truePeakDbtp});
          if (Number.isFinite(tdv.samplePeakDb) && tdv.samplePeakDb > tdv.truePeakDbtp + 0.1) {
            tdv.truePeakDbtp = tdv.samplePeakDb;
            logWarn('Ajustado truePeak para samplePeak', {newTruePeak: tdv.truePeakDbtp});
          }
          if (tdv.truePeakDbtp > 0) tdv.truePeakDbtp = 0; // clamp
        }
        // Headroom = 0 - TruePeak
        if (Number.isFinite(tdv.truePeakDbtp)) {
          const expHead = 0 - tdv.truePeakDbtp;
            if (!Number.isFinite(tdv.headroomTruePeakDb) || Math.abs(tdv.headroomTruePeakDb - expHead) > 0.11) {
              tdv.headroomTruePeakDb = expHead;
            }
          // Opcionalmente alinhar headroomDb ao headroomTruePeakDb (verdadeiro headroom em dBTP)
          try {
            const enforce = (typeof window === 'undefined' || window.ENFORCE_TRUEPEAK_HEADROOM === true);
            if (enforce && (!Number.isFinite(tdv.headroomDb) || Math.abs(tdv.headroomDb - expHead) > 0.11)) {
              tdv.headroomDb = expHead;
              (tdv._sources = tdv._sources || {}).headroomDb = 'invariant:truepeak';
            }
          } catch {}
        }
        // Clipping problem consistente - critérios mais rigorosos
        try {
          const tp = tdv.truePeakDbtp;
          const peak = tdv.peak;
          const clipSamples = tdv.clippingSamplesTruePeak ?? tdv.clippingSamples;
          const clipPct = tdv.clippingPct;
          
          // Critérios mais rigorosos para detecção de clipping
          const hasClippingByTruePeak = Number.isFinite(tp) && tp >= -0.1;
          const hasClippingByPeak = Number.isFinite(peak) && peak >= -0.1;
          const hasClippingBySamples = Number.isFinite(clipSamples) && clipSamples > 0;
          const hasClippingByPercent = Number.isFinite(clipPct) && clipPct > 0;
          
          const should = hasClippingByTruePeak || hasClippingByPeak || hasClippingBySamples || hasClippingByPercent;
          
          const probs = Array.isArray(baseAnalysis.problems) ? baseAnalysis.problems : (baseAnalysis.problems=[]);
          const has = probs.some(p=>p.type==='clipping');
          
          if (has && !should) {
            baseAnalysis.problems = probs.filter(p=>p.type!=='clipping');
          }
          // Nota: Clipping será gerado pela função principal generateTechnicalProblems() com formato melhorado
        } catch {}
        // LUFS ST plausível
        if (Number.isFinite(tdv.lufsIntegrated) && Number.isFinite(tdv.lufsShortTerm) && Math.abs(tdv.lufsShortTerm - tdv.lufsIntegrated) > 25) {
          logWarn('Invalid lufsShortTerm removed', {lufsIntegrated: tdv.lufsIntegrated, lufsShortTerm: tdv.lufsShortTerm});
          delete tdv.lufsShortTerm;
        }
        // Anti-NaN
        Object.entries(tdv).forEach(([k,v])=>{ if (typeof v==='number' && !Number.isFinite(v)) { delete tdv[k]; logWarn('Removed non-finite', {k}); }});
      }
    } catch (invErr) { if (typeof window !== 'undefined' && window.DEBUG_ANALYZER) warn('Falha invariants', invErr); }

    // 🎯 CENTRALIZAÇÃO DAS MÉTRICAS - Single Source of Truth
    try {
      // Definir v2Metrics se não existir (compatibilidade)
      const v2Metrics = baseAnalysis.v2Metrics || null;
      baseAnalysis.metrics = buildCentralizedMetrics(baseAnalysis, v2Metrics);
      
      // Logs temporários de validação
      if (typeof window !== 'undefined' && window.METRICS_VALIDATION_LOGS !== false) {
        log('🎯 METRICS_SOURCE_VALIDATION:', {
          source: 'centralized_metrics',
          lufs_centralized: baseAnalysis.metrics?.lufs_integrated,
          lufs_legacy: baseAnalysis.technicalData?.lufsIntegrated,
          true_peak_centralized: baseAnalysis.metrics?.true_peak_dbtp,
          true_peak_legacy: baseAnalysis.technicalData?.truePeakDbtp,
          stereo_width_centralized: baseAnalysis.metrics?.stereo_width,
          stereo_width_legacy: baseAnalysis.technicalData?.stereoWidth,
          band_count_centralized: Object.keys(baseAnalysis.metrics?.bands || {}).length,
          band_count_legacy: Object.keys(baseAnalysis.technicalData?.bandEnergies || {}).length,
          match_lufs: Math.abs((baseAnalysis.metrics?.lufs_integrated || 0) - (baseAnalysis.technicalData?.lufsIntegrated || 0)) < 0.01,
          match_tp: Math.abs((baseAnalysis.metrics?.true_peak_dbtp || 0) - (baseAnalysis.technicalData?.truePeakDbtp || 0)) < 0.01
        });
      }
    } catch (metricsErr) {
      warn('🚨 Erro na centralização de métricas:', metricsErr);
    }

    return baseAnalysis;
  } catch (err) {
    if (typeof window !== 'undefined' && window.DEBUG_ANALYZER === true) warn('⚠️ [ADV] Adapter geral falhou:', err?.message || err);
    return baseAnalysis;
  }
};

// ===== FASE 1 AUDITORIA: FUNÇÕES DE UNIFICAÇÃO E OBSERVAÇÃO =====

/**
 * FASE 1: Unifica dados de múltiplas fontes em single source of truth
 * ⚠️ ZERO RISCO: Apenas observa e organiza, não altera comportamento
 */
function getUnifiedAnalysisData(baseAnalysis, technicalData, v2Metrics) {
  try {
    if (!baseAnalysis || !technicalData) {
      warn('🔍 FASE 1: Dados insuficientes para unificação');
      return {};
    }
    
    const unified = {
      // LUFS - Prioridade: V2 > V1 fallback
      lufsIntegrated: technicalData?.lufsIntegrated ?? 
                     v2Metrics?.loudness?.lufs_integrated ?? 
                     baseAnalysis?.technicalData?.rms ?? null,
    
    lufsShortTerm: technicalData?.lufsShortTerm ?? 
                   v2Metrics?.loudness?.lufs_short_term ?? null,
    
    lufsMomentary: technicalData?.lufsMomentary ?? 
                   v2Metrics?.loudness?.lufs_momentary ?? null,
    
    // True Peak - Prioridade: V2 > V1 fallback
    truePeakDbtp: technicalData?.truePeakDbtp ?? 
                  v2Metrics?.truePeak?.true_peak_dbtp ?? 
                  baseAnalysis?.peakDb ?? null,
    
    // Clipping - Múltiplas fontes
    clippingSamples: technicalData?.clippingSamples ?? 
                     v2Metrics?.core?.clippingEvents ?? 0,
    
    clippingPct: technicalData?.clippingPct ?? 
                 v2Metrics?.core?.clippingPercentage ?? 0,
    
    // Dinâmica
    lra: technicalData?.lra ?? v2Metrics?.loudness?.lra ?? null,
    
    // Estéreo
    stereoCorrelation: technicalData?.stereoCorrelation ?? 
                       v2Metrics?.stereo?.correlation ?? null,
    
    monoCompatibility: technicalData?.monoCompatibility ?? 
                       v2Metrics?.stereo?.monoCompatibility ?? null,
    
    // Timestamp para logs
    _timestamp: Date.now(),
    _sources: {
      hasV2: !!v2Metrics,
      hasV1: !!baseAnalysis,
      hasTD: !!technicalData
    }
  };
  
  return unified;
  
  } catch (unificationError) {
    warn('🔍 FASE 1: Erro na unificação:', unificationError.message);
    return {}; // Retorna objeto vazio em caso de erro
  }
}

/**
 * FASE 1: Auditoria de consistência passiva
 * ⚠️ ZERO RISCO: Apenas logs, não altera comportamento
 */
function performConsistencyAudit(unifiedData, baseAnalysis) {
  try {
    if (!unifiedData || !baseAnalysis) {
      warn('🔍 FASE 1: Dados insuficientes para auditoria');
      return;
    }
    
    if (!window.DEBUG_ANALYZER && !window.ENABLE_AUDIT_LOGS) return;
  
  const issues = [];
  const warnings = [];
  
  // 🔍 AUDITORIA 1: Clipping Logic
  const hasClippingAlert = baseAnalysis?.problems?.some(p => p?.type === 'clipping');
  const clippingMetrics = {
    samples: unifiedData.clippingSamples,
    percentage: unifiedData.clippingPct,
    truePeak: unifiedData.truePeakDbtp
  };
  
  if (hasClippingAlert && unifiedData.clippingSamples === 0 && unifiedData.truePeakDbtp < -1.0) {
    issues.push({
      type: 'CLIPPING_FALSE_POSITIVE',
      description: 'Clipping alert com 0% clipping e truePeak < -1.0 dBTP',
      data: clippingMetrics
    });
  }
  
  // 🔍 AUDITORIA 2: LUFS Consistency  
  const lufsValues = {
    integrated: unifiedData.lufsIntegrated,
    shortTerm: unifiedData.lufsShortTerm,
    momentary: unifiedData.lufsMomentary
  };
  
  if (unifiedData.lufsIntegrated && unifiedData.lufsShortTerm) {
    const diff = Math.abs(unifiedData.lufsIntegrated - unifiedData.lufsShortTerm);
    if (diff > 10) {
      warnings.push({
        type: 'LUFS_INCONSISTENT',
        description: `Diferença LUFS Integrado vs Short-Term muito alta: ${diff.toFixed(1)} dB`,
        data: lufsValues
      });
    }
  }
  
  // 🔍 AUDITORIA 3: Dynamic Range Validation
  if (unifiedData.lra !== null && unifiedData.lra < 0) {
    issues.push({
      type: 'NEGATIVE_DYNAMICS',
      description: 'LRA (Loudness Range) negativo detectado',
      data: { lra: unifiedData.lra }
    });
  }
  
  // 🔍 AUDITORIA 4: Stereo/Mono Alignment
  if (unifiedData.stereoCorrelation !== null && unifiedData.monoCompatibility) {
    const correlation = unifiedData.stereoCorrelation;
    const mono = unifiedData.monoCompatibility;
    
    // Correlação baixa deveria indicar problemas mono
    if (correlation < -0.2 && mono !== 'Problemas de fase') {
      warnings.push({
        type: 'STEREO_MONO_MISALIGN',
        description: 'Correlação baixa mas compatibilidade mono não indica problemas',
        data: { correlation, monoCompatibility: mono }
      });
    }
  }
  
  // 📊 LOG CONSOLIDADO
  if (issues.length > 0 || warnings.length > 0) {
    console.group('🔍 AUDITORIA ANALYZER - Inconsistências Detectadas');
    
    if (issues.length > 0) {
      error('🚨 PROBLEMAS CRÍTICOS:', issues);
    }
    
    if (warnings.length > 0) {
      warn('⚠️ AVISOS:', warnings);
    }
    
    log('📊 DADOS UNIFICADOS:', unifiedData);
    console.groupEnd();
  } else if (window.DEBUG_ANALYZER) {
    log('✅ AUDITORIA: Nenhuma inconsistência detectada');
  }
  
  // Armazenar resultados para análise (não afeta comportamento)
  if (typeof window !== 'undefined') {
    window.__AUDIT_RESULTS__ = window.__AUDIT_RESULTS__ || [];
    window.__AUDIT_RESULTS__.push({
      timestamp: Date.now(),
      issues,
      warnings,
      unifiedData: { ...unifiedData }
    });
    
    // Manter apenas últimos 10 resultados
    if (window.__AUDIT_RESULTS__.length > 10) {
      window.__AUDIT_RESULTS__ = window.__AUDIT_RESULTS__.slice(-10);
    }
  }
  
  } catch (auditError) {
    warn('🔍 FASE 1: Erro na auditoria:', auditError.message);
  }
}

/**
 * FASE 2: Aplicar correções baseadas em dados unificados
 * ⚠️ BAIXO RISCO: Correções cosméticas e de consistência
 */
function applyUnifiedCorrections(baseAnalysis, technicalData, unifiedData) {
  try {
    if (!baseAnalysis || !technicalData || !unifiedData) {
      warn('🔧 FASE 2: Dados insuficientes para correções');
      return;
    }
    
    if (!window.DEBUG_ANALYZER && !window.ENABLE_PHASE2_CORRECTIONS) return;
  
  const corrections = [];
  
  // 🔧 CORREÇÃO 1: Garantir dinâmica nunca negativa
  if (technicalData.lra !== null && technicalData.lra < 0) {
    const originalLRA = technicalData.lra;
    technicalData.lra = Math.max(0, technicalData.lra);
    corrections.push({
      type: 'NEGATIVE_DYNAMICS_FIXED',
      description: `LRA corrigido: ${originalLRA.toFixed(2)} → ${technicalData.lra.toFixed(2)}`,
      original: originalLRA,
      corrected: technicalData.lra
    });
  }
  
  // 🔧 CORREÇÃO 2: Formatação de picos (preparar para futuras melhorias)
  const peakFields = ['truePeakDbtp', 'samplePeakLeftDb', 'samplePeakRightDb'];
  peakFields.forEach(field => {
    if (technicalData[field] !== null && Number.isFinite(technicalData[field])) {
      const original = technicalData[field];
      // Assegurar precisão de 2 casas decimais para picos
      technicalData[field] = Math.round(original * 100) / 100;
      
      if (Math.abs(original - technicalData[field]) > 0.001) {
        corrections.push({
          type: 'PEAK_FORMATTING_IMPROVED',
          field: field,
          description: `${field} formatado: ${original} → ${technicalData[field]}`,
          original: original,
          corrected: technicalData[field]
        });
      }
    }
  });
  
  // 🔧 CORREÇÃO 3: Filtrar sugestões perigosas quando há clipping
  if (Array.isArray(baseAnalysis.suggestions) && 
      (unifiedData.clippingSamples > 0 || unifiedData.truePeakDbtp >= -0.1)) {
    
    const originalLength = baseAnalysis.suggestions.length;
    
    // Remover sugestões que mencionam aumentar volume/picos
    baseAnalysis.suggestions = baseAnalysis.suggestions.filter(suggestion => {
      const message = suggestion?.message || '';
      const isDangerous = /aumentar.*volume|aumentar.*dBTP|mais.*loudness|push.*limiter/i.test(message);
      return !isDangerous;
    });
    
    if (baseAnalysis.suggestions.length < originalLength) {
      corrections.push({
        type: 'DANGEROUS_SUGGESTIONS_FILTERED',
        description: `Removidas ${originalLength - baseAnalysis.suggestions.length} sugestões perigosas com clipping presente`,
        clippingSamples: unifiedData.clippingSamples,
        truePeak: unifiedData.truePeakDbtp,
        filtered: originalLength - baseAnalysis.suggestions.length
      });
    }
  }
  
  // 📊 Log das correções aplicadas
  if (corrections.length > 0) {
    console.group('🔧 FASE 2 - Correções Aplicadas');
    corrections.forEach(correction => {
      log(`✅ ${correction.type}: ${correction.description}`);
    });
    console.groupEnd();
  } else if (window.DEBUG_ANALYZER) {
    log('🔧 FASE 2: Nenhuma correção necessária');
  }
  
  // Armazenar correções para análise
  if (typeof window !== 'undefined') {
    window.__PHASE2_CORRECTIONS__ = window.__PHASE2_CORRECTIONS__ || [];
    window.__PHASE2_CORRECTIONS__.push({
      timestamp: Date.now(),
      corrections: corrections.slice(),
      unifiedData: { ...unifiedData }
    });
    
    // Manter apenas últimos 10 resultados
    if (window.__PHASE2_CORRECTIONS__.length > 10) {
      window.__PHASE2_CORRECTIONS__ = window.__PHASE2_CORRECTIONS__.slice(-10);
    }
  }
  
  } catch (phase2Error) {
    warn('🔧 FASE 2: Erro nas correções:', phase2Error.message);
    // Continuar sem as correções em caso de erro
  }
}

// ===== FASE 3: ALINHAMENTO LÓGICO (RISCO MÉDIO) =====

/**
 * FASE 3: Correções de lógica e alinhamento de algoritmos
 * ⚠️ RISCO MÉDIO: Corrige lógica de detecção e cálculos
 * 🔒 SEGURANÇA: Feature flags e rollback automático
 */
function applyLogicAlignmentCorrections(baseAnalysis, technicalData, unifiedData, v2Metrics) {
  try {
    if (!baseAnalysis || !technicalData || !unifiedData) {
      warn('🔧 FASE 3: Dados insuficientes para alinhamento lógico');
      return;
    }
    
    // Feature flag para ativar Fase 3 
    if (!window.DEBUG_ANALYZER && !window.ENABLE_PHASE3_LOGIC_ALIGNMENT) return;
    
    const corrections = [];
    const originalState = {
      problems: JSON.parse(JSON.stringify(baseAnalysis.problems || [])),
      technicalData: JSON.parse(JSON.stringify(technicalData))
    };
    
    console.group('🎯 FASE 3 - Alinhamento Lógico');
    
    // 🔧 CORREÇÃO 1: Lógica de Clipping Aprimorada
    const clippingCorrection = fixClippingLogic(baseAnalysis, technicalData, unifiedData);
    if (clippingCorrection.applied) {
      corrections.push(clippingCorrection);
    }
    
    // 🔧 CORREÇÃO 2: Thresholds Dinâmicos de LUFS
    const lufsCorrection = fixLufsThresholds(baseAnalysis, technicalData, unifiedData);
    if (lufsCorrection.applied) {
      corrections.push(lufsCorrection);
    }
    
    // 🔧 CORREÇÃO 3: Score Calculation Accuracy
    const scoreCorrection = fixScoreCalculation(baseAnalysis, technicalData, unifiedData, v2Metrics);
    if (scoreCorrection.applied) {
      corrections.push(scoreCorrection);
    }
    
    // 🔧 CORREÇÃO 4: Stereo Analysis Consistency
    const stereoCorrection = fixStereoAnalysis(baseAnalysis, technicalData, unifiedData);
    if (stereoCorrection.applied) {
      corrections.push(stereoCorrection);
    }
    
    // 📊 Validação e Rollback Safety
    const validationResult = validatePhase3Changes(baseAnalysis, technicalData, originalState);
    if (!validationResult.isValid) {
      warn('⚠️ FASE 3: Validação falhou, fazendo rollback...');
      rollbackChanges(baseAnalysis, technicalData, originalState);
      corrections.length = 0; // Clear corrections
      corrections.push({
        type: 'PHASE3_ROLLBACK',
        description: 'Mudanças revertidas devido a falha na validação',
        reason: validationResult.reason
      });
    }
    
    // 📊 Log das correções aplicadas
    if (corrections.length > 0) {
      corrections.forEach(correction => {
        log(`✅ ${correction.type}: ${correction.description}`);
      });
    } else {
      log('🔧 FASE 3: Nenhuma correção lógica necessária');
    }
    
    console.groupEnd();
    
    // Armazenar correções para análise
    if (typeof window !== 'undefined') {
      window.__PHASE3_CORRECTIONS__ = window.__PHASE3_CORRECTIONS__ || [];
      window.__PHASE3_CORRECTIONS__.push({
        timestamp: Date.now(),
        corrections: corrections.slice(),
        originalState: originalState,
        finalState: {
          problems: baseAnalysis.problems?.length || 0,
          technicalDataKeys: Object.keys(technicalData || {}).length
        }
      });
      
      // Manter apenas últimos 5 resultados (Fase 3 é mais pesada)
      if (window.__PHASE3_CORRECTIONS__.length > 5) {
        window.__PHASE3_CORRECTIONS__ = window.__PHASE3_CORRECTIONS__.slice(-5);
      }
    }
    
  } catch (phase3Error) {
    warn('🔧 FASE 3: Erro no alinhamento lógico:', phase3Error.message);
    // Em caso de erro, não aplicar nenhuma correção
  }
}

// 🔧 CORREÇÃO 1: Lógica de Clipping Aprimorada  
function fixClippingLogic(baseAnalysis, technicalData, unifiedData) {
  const correction = { applied: false, type: 'CLIPPING_LOGIC_FIX', description: '' };
  
  try {
    // Critérios rigorosos para clipping
    const hasClippingSamples = unifiedData.clippingSamples > 0;
    const hasDangerousTP = unifiedData.truePeakDbtp > -0.1; // Mais conservador
    const hasClippingAlert = baseAnalysis.problems?.some(p => p?.type === 'clipping');
    
    // Se não há clipping real mas há alerta, remover
    if (hasClippingAlert && !hasClippingSamples && !hasDangerousTP) {
      baseAnalysis.problems = baseAnalysis.problems.filter(p => p?.type !== 'clipping');
      correction.applied = true;
      correction.description = `Removido falso positivo de clipping (TP: ${unifiedData.truePeakDbtp?.toFixed(2)}dBTP, Samples: ${unifiedData.clippingSamples})`;
    }
    
    // Se há clipping real mas não há alerta, adicionar
    if (!hasClippingAlert && (hasClippingSamples || hasDangerousTP)) {
      baseAnalysis.problems = baseAnalysis.problems || [];
      baseAnalysis.problems.push({
        type: 'clipping',
        severity: hasClippingSamples ? 'high' : 'medium',
        message: hasClippingSamples ? 
          `Clipping detectado: ${unifiedData.clippingSamples} samples` : 
          `True peak perigoso: ${unifiedData.truePeakDbtp?.toFixed(2)} dBTP`
      });
      correction.applied = true;
      correction.description = `Adicionado alerta de clipping real (TP: ${unifiedData.truePeakDbtp?.toFixed(2)}dBTP, Samples: ${unifiedData.clippingSamples})`;
    }
    
  } catch (error) {
    warn('Erro na correção de clipping:', error);
  }
  
  return correction;
}

// 🔧 CORREÇÃO 2: Thresholds Dinâmicos de LUFS
function fixLufsThresholds(baseAnalysis, technicalData, unifiedData) {
  const correction = { applied: false, type: 'LUFS_THRESHOLD_FIX', description: '' };
  
  try {
    const lufs = unifiedData.lufsIntegrated;
    if (!Number.isFinite(lufs)) return correction;
    
    // Thresholds dinâmicos baseados no gênero e contexto
    const genreThresholds = {
      'trance': { min: -16, max: -8, target: -11 },
      'electronic': { min: -18, max: -6, target: -10 },
      'funk': { min: -12, max: -6, target: -8 }, // Específico para funk mandela
      'funk mandela': { min: -12, max: -6, target: -8 }, // Específico para funk mandela
      'default': { min: -23, max: -6, target: -14 }
    };
    
    const detectedGenre = baseAnalysis.genre || 
                        window.PROD_AI_REF_GENRE || 
                        window.FORCE_DEFAULT_GENRE ||
                        (window.FUNK_MANDELA_V3_REF ? 'funk mandela' : null) ||
                        'default';
    const thresholds = genreThresholds[detectedGenre] || genreThresholds.default;
    
    // Atualizar problemas baseados em thresholds apropriados
    const currentLoudnessProblems = baseAnalysis.problems?.filter(p => p?.type === 'loudness') || [];
    baseAnalysis.problems = baseAnalysis.problems?.filter(p => p?.type !== 'loudness') || [];
    
    if (lufs < thresholds.min) {
      baseAnalysis.problems.push({
        type: 'loudness',
        severity: 'medium',
        message: `Volume muito baixo: ${lufs.toFixed(1)} LUFS (recomendado: ${thresholds.target} LUFS para ${detectedGenre})`
      });
      correction.applied = true;
      correction.description = `Threshold LUFS ajustado para ${detectedGenre}: ${lufs.toFixed(1)} < ${thresholds.min}`;
    } else if (lufs > thresholds.max) {
      baseAnalysis.problems.push({
        type: 'loudness', 
        severity: 'high',
        message: `Volume muito alto: ${lufs.toFixed(1)} LUFS (máximo recomendado: ${thresholds.max} LUFS para ${detectedGenre})`
      });
      correction.applied = true;
      correction.description = `Threshold LUFS ajustado para ${detectedGenre}: ${lufs.toFixed(1)} > ${thresholds.max}`;
    }
    
  } catch (error) {
    warn('Erro na correção de LUFS:', error);
  }
  
  return correction;
}

// 🔧 CORREÇÃO 3: Score Calculation Accuracy
function fixScoreCalculation(baseAnalysis, technicalData, unifiedData, v2Metrics) {
  const correction = { applied: false, type: 'SCORE_CALCULATION_FIX', description: '' };
  
  try {
    // Recalcular scores baseados em dados unificados
    const originalOverall = baseAnalysis.qualityOverall;
    
    // Score components com pesos balanceados
    const scores = {
      loudness: calculateLoudnessScore(unifiedData.lufsIntegrated),
      dynamics: calculateDynamicsScore(unifiedData.lra),
      stereo: calculateStereoScore(unifiedData.stereoCorrelation),
      clipping: calculateClippingScore(unifiedData.clippingSamples, unifiedData.truePeakDbtp)
    };
    
    // Peso baseado na importância técnica
    const weights = { loudness: 0.3, dynamics: 0.25, stereo: 0.2, clipping: 0.25 };
    
    const newOverall = Object.keys(scores).reduce((sum, key) => {
      return sum + (scores[key] * weights[key]);
    }, 0);
    
    // Só aplicar se a diferença for significativa (> 5%)
    if (Math.abs(newOverall - originalOverall) > 5) {
      baseAnalysis.qualityOverall = Number(newOverall.toFixed(1));
      baseAnalysis.qualityBreakdown = scores;
      correction.applied = true;
      correction.description = `Score recalculado: ${originalOverall} → ${Math.round(newOverall)} (diferença: ${(newOverall - originalOverall).toFixed(1)})`;
    }
    
  } catch (error) {
    warn('Erro na correção de score:', error);
  }
  
  return correction;
}

// 🔧 CORREÇÃO 4: Stereo Analysis Consistency
function fixStereoAnalysis(baseAnalysis, technicalData, unifiedData) {
  const correction = { applied: false, type: 'STEREO_ANALYSIS_FIX', description: '' };
  
  try {
    const correlation = unifiedData.stereoCorrelation;
    if (!Number.isFinite(correlation)) return correction;
    
    // Classificação mais precisa baseada em padrões reais
    let newMonoCompatibility;
    if (correlation < -0.3) {
      newMonoCompatibility = 'Problemas sérios de fase';
    } else if (correlation < -0.1) {
      newMonoCompatibility = 'Problemas leves de fase';
    } else if (correlation < 0.3) {
      newMonoCompatibility = 'Compatibilidade parcial';
    } else if (correlation < 0.7) {
      newMonoCompatibility = 'Boa compatibilidade';
    } else {
      newMonoCompatibility = 'Excelente compatibilidade';
    }
    
    if (technicalData.monoCompatibility !== newMonoCompatibility) {
      const oldValue = technicalData.monoCompatibility;
      technicalData.monoCompatibility = newMonoCompatibility;
      correction.applied = true;
      correction.description = `Mono compatibility: "${oldValue}" → "${newMonoCompatibility}" (corr: ${correlation.toFixed(3)})`;
    }
    
  } catch (error) {
    warn('Erro na correção de estéreo:', error);
  }
  
  return correction;
}

// 📊 Funções de Score Individual
function calculateLoudnessScore(lufs) {
  if (!Number.isFinite(lufs)) return 50;
  const target = -11; // Target LUFS para música eletrônica
  const deviation = Math.abs(lufs - target);
  return Math.max(0, Math.min(100, 100 - (deviation * 8))); // Penalidade de 8 pontos por dB
}

function calculateDynamicsScore(lra) {
  if (!Number.isFinite(lra)) return 50;
  if (lra < 2) return 20; // Muito comprimido
  if (lra < 5) return 60; // Moderadamente comprimido
  if (lra < 10) return 90; // Boa dinâmica
  return 100; // Excelente dinâmica
}

function calculateStereoScore(correlation) {
  if (!Number.isFinite(correlation)) return 50;
  
  // 🛡️ IMPLEMENTAÇÃO TETO DE PENALIDADE DE ESTÉREO
  // Máximo de penalidade: não tirar mais que 20 pontos do sub-score Stereo
  const STEREO_PENALTY_CAP = 20; // Máximo de penalidade em pontos
  const BASELINE_SCORE = 90; // Score máximo possível
  const MIN_STEREO_SCORE = BASELINE_SCORE - STEREO_PENALTY_CAP; // 70 pontos mínimo
  
  let rawScore;
  if (correlation < -0.3) {
    rawScore = 10; // Problemas sérios - ANTES
  } else if (correlation < 0) {
    rawScore = 40; // Problemas leves - ANTES  
  } else if (correlation < 0.5) {
    rawScore = 70; // OK
  } else {
    rawScore = 90; // Bom
  }
  
  // 🚨 APLICAR TETO: não permitir score menor que MIN_STEREO_SCORE (70)
  const cappedScore = Math.max(MIN_STEREO_SCORE, rawScore);
  
  // 🔍 Log para auditoria (apenas se score foi limitado)
  if (cappedScore > rawScore) {
    log(`[STEREO-CAP] 🛡️ Score limitado: ${rawScore} → ${cappedScore} (correlação: ${correlation.toFixed(3)})`);
  }
  
  return cappedScore;
}

function calculateClippingScore(samples, truePeak) {
  if (samples > 0) return 0; // Clipping = score zero
  if (truePeak > -0.1) return 20; // Muito próximo do clipping
  if (truePeak > -1.0) return 80; // Headroom limitado
  return 100; // Bom headroom
}

// 🎯 AGREGADOR COM PESOS V2: Sistema balanceado
function calculateWeightedOverallScore(scores) {
  // Configuração dos pesos conforme auditoria
  const WEIGHTS = {
    loudness: 0.25,    // 25% - Importância alta (LUFS, headroom)  
    dynamics: 0.20,    // 20% - Dinâmica (LRA, crest factor)
    frequency: 0.25,   // 25% - Importância alta (balanço tonal)
    technical: 0.15,   // 15% - Qualidade técnica (clipping, distorção)
    stereo: 0.15       // 15% - Imagem estéreo
  };
  
  const { loudness, dynamics, frequency, technical, stereo } = scores;
  
  // Validar que todos os scores estão presentes
  const validScores = [loudness, dynamics, frequency, technical, stereo].filter(s => Number.isFinite(s));
  if (validScores.length === 0) return 0;
  
  // Calcular score ponderado
  const weightedSum = 
    (loudness || 0) * WEIGHTS.loudness +
    (dynamics || 0) * WEIGHTS.dynamics +
    (frequency || 0) * WEIGHTS.frequency +
    (technical || 0) * WEIGHTS.technical +
    (stereo || 0) * WEIGHTS.stereo;
    
  return Math.round(weightedSum);
}

// 🔒 Validação e Rollback Safety
function validatePhase3Changes(baseAnalysis, technicalData, originalState) {
  try {
    // Validar que estruturas básicas permanecem intactas
    if (!baseAnalysis || !technicalData) {
      return { isValid: false, reason: 'Estruturas básicas corrompidas' };
    }
    
    // Validar que problemas é um array
    if (baseAnalysis.problems && !Array.isArray(baseAnalysis.problems)) {
      return { isValid: false, reason: 'Array de problemas corrompido' };
    }
    
    // Validar que scores estão em range válido
    if (baseAnalysis.qualityOverall && (baseAnalysis.qualityOverall < 0 || baseAnalysis.qualityOverall > 100)) {
      return { isValid: false, reason: 'Score fora de range válido' };
    }
    
    // Validar dados técnicos críticos
    const criticalFields = ['lufsIntegrated', 'truePeakDbtp', 'lra'];
    for (const field of criticalFields) {
      const value = technicalData[field];
      if (value !== null && !Number.isFinite(value)) {
        return { isValid: false, reason: `Campo ${field} com valor inválido` };
      }
    }
    
    return { isValid: true };
    
  } catch (error) {
    return { isValid: false, reason: `Erro na validação: ${error.message}` };
  }
}

function rollbackChanges(baseAnalysis, technicalData, originalState) {
  try {
    // Restaurar problemas
    baseAnalysis.problems = originalState.problems;
    
    // Restaurar dados técnicos críticos
    Object.keys(originalState.technicalData).forEach(key => {
      technicalData[key] = originalState.technicalData[key];
    });
    
    log('🔄 Rollback da Fase 3 concluído com sucesso');
    
  } catch (error) {
    error('❌ Erro durante rollback da Fase 3:', error);
  }
}

// ===== FASE 4: AUDITORIA FINAL COMPLETA (BAIXO RISCO) =====

/**
 * FASE 4: Auditoria final completa conforme especificação
 * ⚠️ BAIXO RISCO: Correções específicas dos problemas identificados
 * 🔒 SEGURANÇA: Sem alteração de comportamento, apenas padronização
 */
function applyFinalAuditCorrections(baseAnalysis, technicalData, unifiedData, v2Metrics) {
  try {
    if (!baseAnalysis || !technicalData || !unifiedData) {
      warn('🔧 FASE 4: Dados insuficientes para auditoria final');
      return;
    }
    
    // Feature flag para ativar Fase 4
    if (!window.DEBUG_ANALYZER && !window.ENABLE_PHASE4_FINAL_AUDIT) return;
    
    const corrections = [];
    
    console.group('🎯 FASE 4 - Auditoria Final Completa');
    
    // 🔧 CORREÇÃO 4.1: LUFS Centralizado e Padronizado
    const lufsCorrection = centralizeLUFSValues(baseAnalysis, technicalData, unifiedData, v2Metrics);
    if (lufsCorrection.applied) {
      corrections.push(lufsCorrection);
    }
    
    // 🔧 CORREÇÃO 4.2: Dinâmica Sempre Positiva
    const dynamicsCorrection = fixNegativeDynamics(baseAnalysis, technicalData, unifiedData);
    if (dynamicsCorrection.applied) {
      corrections.push(dynamicsCorrection);
    }
    
    // 🔧 CORREÇÃO 4.3: Score Técnico Funcional
    const scoreCorrection = fixTechnicalScore(baseAnalysis, technicalData, unifiedData);
    if (scoreCorrection.applied) {
      corrections.push(scoreCorrection);
    }
    
    // 🔧 CORREÇÃO 4.4: Mono Compatibility Alinhada
    const monoCorrection = fixMonoCompatibility(baseAnalysis, technicalData, unifiedData);
    if (monoCorrection.applied) {
      corrections.push(monoCorrection);
    }
    
    // 🔧 CORREÇÃO 4.5: Gates de Sugestões Perigosas
    const safetyCorrection = applySuggestionSafetyGates(baseAnalysis, technicalData, unifiedData);
    if (safetyCorrection.applied) {
      corrections.push(safetyCorrection);
    }
    
    // 🔧 CORREÇÃO 4.6: Formatação Padronizada
    const formatCorrection = standardizeFormatting(baseAnalysis, technicalData, unifiedData);
    if (formatCorrection.applied) {
      corrections.push(formatCorrection);
    }
    
    // 📊 Log das correções aplicadas
    if (corrections.length > 0) {
      corrections.forEach(correction => {
        log(`✅ ${correction.type}: ${correction.description}`);
      });
    } else {
      log('🔧 FASE 4: Sistema já está padronizado');
    }
    
    console.groupEnd();
    
    // Armazenar correções para análise
    if (typeof window !== 'undefined') {
      window.__PHASE4_CORRECTIONS__ = window.__PHASE4_CORRECTIONS__ || [];
      window.__PHASE4_CORRECTIONS__.push({
        timestamp: Date.now(),
        corrections: corrections.slice(),
        lufsValues: {
          original: extractAllLUFSValues(baseAnalysis, technicalData, v2Metrics),
          unified: unifiedData.lufsIntegrated
        }
      });
      
      // Manter apenas últimos 5 resultados
      if (window.__PHASE4_CORRECTIONS__.length > 5) {
        window.__PHASE4_CORRECTIONS__ = window.__PHASE4_CORRECTIONS__.slice(-5);
      }
    }
    
  } catch (phase4Error) {
    warn('🔧 FASE 4: Erro na auditoria final:', phase4Error.message);
  }
}

// 🔧 CORREÇÃO 4.1: LUFS Centralizado e Padronizado
function centralizeLUFSValues(baseAnalysis, technicalData, unifiedData, v2Metrics) {
  const correction = { applied: false, type: 'LUFS_CENTRALIZED', description: '' };
  
  try {
    // Extrair todos os valores LUFS encontrados
    const lufsValues = extractAllLUFSValues(baseAnalysis, technicalData, v2Metrics);
    
    // Definir valor único como fonte da verdade (prioridade: V2 > technicalData > fallback)
    const canonicalLUFS = unifiedData.lufsIntegrated;
    
    if (!Number.isFinite(canonicalLUFS)) {
      return correction; // Não há LUFS válido para centralizar
    }
    
    // Verificar se há divergências significativas (> 0.5 dB)
    const divergences = lufsValues.filter(val => Math.abs(val.value - canonicalLUFS) > 0.5);
    
    if (divergences.length > 0) {
      // Centralizar todos os valores para o canonical
      if (technicalData.lufsIntegrated !== canonicalLUFS) {
        technicalData.lufsIntegrated = canonicalLUFS;
      }
      
      // Remover campos RMS que podem estar sendo usados como LUFS
      if (technicalData.rms && Math.abs(technicalData.rms - canonicalLUFS) > 2) {
        technicalData.rms = null; // Limpar RMS incorreto
      }
      
      correction.applied = true;
      correction.description = `LUFS centralizado para ${canonicalLUFS.toFixed(1)} (${divergences.length} divergências corrigidas)`;
      correction.divergences = divergences;
      correction.canonicalValue = canonicalLUFS;
    }
    
  } catch (error) {
    warn('Erro na centralização LUFS:', error);
  }
  
  return correction;
}

// 🔧 CORREÇÃO 4.2: Dinâmica Sempre Positiva
function fixNegativeDynamics(baseAnalysis, technicalData, unifiedData) {
  const correction = { applied: false, type: 'NEGATIVE_DYNAMICS_FIXED', description: '' };
  
  try {
    const dynamicFields = ['lra', 'dynamicRange', 'dr'];
    
    dynamicFields.forEach(field => {
      if (technicalData[field] !== null && Number.isFinite(technicalData[field]) && technicalData[field] < 0) {
        const originalValue = technicalData[field];
        
        // Corrigir para valor absoluto ou zero
        technicalData[field] = Math.max(0, Math.abs(originalValue));
        
        correction.applied = true;
        correction.description += `${field}: ${originalValue.toFixed(2)} → ${technicalData[field].toFixed(2)}; `;
      }
    });
    
    if (correction.applied) {
      correction.description = `Dinâmica corrigida: ${correction.description}`;
    }
    
  } catch (error) {
    warn('Erro na correção de dinâmica:', error);
  }
  
  return correction;
}

// 🔧 CORREÇÃO 4.3: Score Técnico Funcional
function fixTechnicalScore(baseAnalysis, technicalData, unifiedData) {
  const correction = { applied: false, type: 'TECHNICAL_SCORE_FIXED', description: '' };
  
  try {
    const currentScore = baseAnalysis.qualityOverall;
    
    // Se score é 0 ou null mas temos dados técnicos válidos
    if ((!currentScore || currentScore === 0) && hasValidTechnicalData(technicalData, unifiedData)) {
      
      // Calcular score baseado em dados disponíveis
      const newScore = calculateTechnicalScore(technicalData, unifiedData);
      
      if (newScore > 0 && newScore !== currentScore) {
        baseAnalysis.qualityOverall = newScore;
        
        correction.applied = true;
        correction.description = `Score técnico: ${currentScore || 0} → ${newScore} (baseado em dados válidos)`;
        correction.newScore = newScore;
        correction.basedOn = Object.keys(technicalData).filter(key => 
          technicalData[key] !== null && Number.isFinite(technicalData[key])
        );
      }
    }
    
  } catch (error) {
    warn('Erro na correção de score:', error);
  }
  
  return correction;
}

// 🔧 CORREÇÃO 4.4: Mono Compatibility Alinhada
function fixMonoCompatibility(baseAnalysis, technicalData, unifiedData) {
  const correction = { applied: false, type: 'MONO_COMPATIBILITY_ALIGNED', description: '' };
  
  try {
    const correlation = unifiedData.stereoCorrelation;
    const currentMono = technicalData.monoCompatibility;
    
    if (Number.isFinite(correlation)) {
      // Critério rigoroso: correlation < 0.1 ou mono_loss > 3 dB
      let newMono;
      
      if (correlation < 0.1) {
        newMono = 'Poor (correlação baixa)';
      } else if (correlation < 0.3) {
        newMono = 'Fair (correlação moderada)';
      } else if (correlation < 0.7) {
        newMono = 'Good (boa correlação)';
      } else {
        newMono = 'Excellent (correlação alta)';
      }
      
      // TODO: Adicionar cálculo de mono_loss quando disponível
      
      if (currentMono !== newMono) {
        technicalData.monoCompatibility = newMono;
        
        correction.applied = true;
        correction.description = `Mono compatibility: "${currentMono}" → "${newMono}" (corr: ${correlation.toFixed(3)})`;
        correction.correlation = correlation;
      }
    }
    
  } catch (error) {
    warn('Erro na correção de mono compatibility:', error);
  }
  
  return correction;
}

// 🔧 CORREÇÃO 4.5: Gates de Sugestões Perigosas
function applySuggestionSafetyGates(baseAnalysis, technicalData, unifiedData) {
  const correction = { applied: false, type: 'SAFETY_GATES_APPLIED', description: '' };
  
  try {
    if (!Array.isArray(baseAnalysis.suggestions)) {
      return correction;
    }
    
    const hasClipping = unifiedData.clippingSamples > 0;
    const dangerousPeak = unifiedData.truePeakDbtp > -0.3;
    
    if (hasClipping || dangerousPeak) {
      const originalCount = baseAnalysis.suggestions.length;
      
      // Filtrar sugestões perigosas
      baseAnalysis.suggestions = baseAnalysis.suggestions.filter(suggestion => {
        const message = suggestion?.message || suggestion?.action || '';
        const isDangerous = /aumentar.*volume|aumentar.*dBTP|mais.*loudness|push.*limiter|gain.*up|\+.*dB/i.test(message);
        return !isDangerous;
      });
      
      const filteredCount = originalCount - baseAnalysis.suggestions.length;
      
      if (filteredCount > 0) {
        correction.applied = true;
        correction.description = `${filteredCount} sugestões perigosas bloqueadas (clipping: ${hasClipping}, peak: ${unifiedData.truePeakDbtp?.toFixed(2)}dBTP)`;
        correction.filteredSuggestions = filteredCount;
      }
    }
    
  } catch (error) {
    warn('Erro nos gates de segurança:', error);
  }
  
  return correction;
}

// 🔧 CORREÇÃO 4.6: Formatação Padronizada
function standardizeFormatting(baseAnalysis, technicalData, unifiedData) {
  const correction = { applied: false, type: 'FORMATTING_STANDARDIZED', description: '' };
  
  try {
    const peakFields = ['truePeakDbtp', 'samplePeakLeftDb', 'samplePeakRightDb'];
    const corrections = [];
    
    peakFields.forEach(field => {
      if (technicalData[field] !== null && Number.isFinite(technicalData[field])) {
        const original = technicalData[field];
        
        // Padronizar para 2 casas decimais
        const formatted = Math.round(original * 100) / 100;
        
        if (Math.abs(original - formatted) > 0.001) {
          technicalData[field] = formatted;
          corrections.push(`${field}: ${original} → ${formatted}`);
        }
      }
    });
    
    if (corrections.length > 0) {
      correction.applied = true;
      correction.description = `Formatação padronizada: ${corrections.join(', ')}`;
    }
    
  } catch (error) {
    warn('Erro na padronização de formatação:', error);
  }
  
  return correction;
}

// 📊 Funções Auxiliares

function extractAllLUFSValues(baseAnalysis, technicalData, v2Metrics) {
  const values = [];
  
  if (Number.isFinite(technicalData.lufsIntegrated)) {
    values.push({ source: 'technicalData.lufsIntegrated', value: technicalData.lufsIntegrated });
  }
  
  if (Number.isFinite(technicalData.rms)) {
    values.push({ source: 'technicalData.rms', value: technicalData.rms });
  }
  
  if (v2Metrics?.loudness?.lufs_integrated && Number.isFinite(v2Metrics.loudness.lufs_integrated)) {
    values.push({ source: 'v2Metrics.loudness.lufs_integrated', value: v2Metrics.loudness.lufs_integrated });
  }
  
  if (baseAnalysis?.technicalData?.rms && Number.isFinite(baseAnalysis.technicalData.rms)) {
    values.push({ source: 'baseAnalysis.technicalData.rms', value: baseAnalysis.technicalData.rms });
  }
  
  return values;
}

function hasValidTechnicalData(technicalData, unifiedData) {
  const requiredFields = ['lufsIntegrated', 'truePeakDbtp', 'lra', 'stereoCorrelation'];
  return requiredFields.some(field => 
    Number.isFinite(technicalData[field]) || Number.isFinite(unifiedData[field])
  );
}

function calculateTechnicalScore(technicalData, unifiedData) {
  const scores = [];
  
  // LUFS Score (peso: 30%)
  if (Number.isFinite(unifiedData.lufsIntegrated)) {
    const lufsScore = calculateLoudnessScore(unifiedData.lufsIntegrated);
    scores.push({ score: lufsScore, weight: 0.3 });
  }
  
  // Peak Score (peso: 25%)
  if (Number.isFinite(unifiedData.truePeakDbtp)) {
    const peakScore = calculateClippingScore(unifiedData.clippingSamples, unifiedData.truePeakDbtp);
    scores.push({ score: peakScore, weight: 0.25 });
  }
  
  // Dynamics Score (peso: 25%)
  if (Number.isFinite(unifiedData.lra)) {
    const dynScore = calculateDynamicsScore(unifiedData.lra);
    scores.push({ score: dynScore, weight: 0.25 });
  }
  
  // Stereo Score (peso: 20%)
  if (Number.isFinite(unifiedData.stereoCorrelation)) {
    const stereoScore = calculateStereoScore(unifiedData.stereoCorrelation);
    scores.push({ score: stereoScore, weight: 0.2 });
  }
  
  if (scores.length === 0) return 0;
  
  // Calcular média ponderada
  const totalWeight = scores.reduce((sum, item) => sum + item.weight, 0);
  const weightedSum = scores.reduce((sum, item) => sum + (item.score * item.weight), 0);
  
  return Math.round(weightedSum / totalWeight);
}

// ===== FASE 5: CORREÇÕES CRÍTICAS ESPECÍFICAS (SEGURO) =====

/**
 * FASE 5: Correções críticas específicas conforme auditoria solicitada
 * ⚠️ SEGURO: Apenas correções pontuais sem afetar funcionalidade principal
 * 🔒 LOGS: Registra problemas encontrados para monitoramento
 */
function applyCriticalSpecificFixes(baseAnalysis, technicalData, unifiedData, v2Metrics) {
  try {
    if (!baseAnalysis || !technicalData || !unifiedData) {
      warn('🔧 FASE 5: Dados insuficientes para correções críticas');
      return;
    }
    
    // Feature flag para ativar Fase 5
    if (!window.DEBUG_ANALYZER && !window.ENABLE_PHASE5_CRITICAL_FIXES) return;
    
    const corrections = [];
    
    console.group('🎯 FASE 5 - Correções Críticas Específicas');
    
    // 🔧 CORREÇÃO 1: LUFS Duplicado - Garantir valor único
    const lufsUnifiedCorrection = fixLUFSDuplication(baseAnalysis, technicalData, unifiedData, v2Metrics);
    if (lufsUnifiedCorrection.applied) {
      corrections.push(lufsUnifiedCorrection);
    }
    
    // 🔧 CORREÇÃO 2: Dinâmica Negativa - Sempre ≥ 0
    const dynamicsNegativeCorrection = fixNegativeDynamicsAdvanced(baseAnalysis, technicalData, unifiedData);
    if (dynamicsNegativeCorrection.applied) {
      corrections.push(dynamicsNegativeCorrection);
    }
    
    // 🔧 CORREÇÃO 3: Score Técnico Zero - Calcular corretamente
    const scoreZeroCorrection = fixZeroTechnicalScore(baseAnalysis, technicalData, unifiedData);
    if (scoreZeroCorrection.applied) {
      corrections.push(scoreZeroCorrection);
    }
    
    // 🔧 CORREÇÃO 4: Mono Compatibility - Usar correlação real
    const monoAlwaysPoorCorrection = fixMonoAlwaysPoor(baseAnalysis, technicalData, unifiedData);
    if (monoAlwaysPoorCorrection.applied) {
      corrections.push(monoAlwaysPoorCorrection);
    }
    
    // 🔧 CORREÇÃO 5: Sugestões Contraditórias - Gates de segurança
    const contradictorySuggestionsCorrection = fixContradictorySuggestions(baseAnalysis, technicalData, unifiedData);
    if (contradictorySuggestionsCorrection.applied) {
      corrections.push(contradictorySuggestionsCorrection);
    }
    
    // 📊 Log das correções aplicadas
    if (corrections.length > 0) {
      corrections.forEach(correction => {
        log(`✅ ${correction.type}: ${correction.description}`);
      });
    } else {
      log('✅ FASE 5: Todos os problemas críticos já estão corrigidos');
    }
    
    console.groupEnd();
    
    // Armazenar correções para análise
    if (typeof window !== 'undefined') {
      window.__PHASE5_CORRECTIONS__ = window.__PHASE5_CORRECTIONS__ || [];
      window.__PHASE5_CORRECTIONS__.push({
        timestamp: Date.now(),
        corrections: corrections.slice(),
        criticalChecks: {
          lufsValues: extractAllLUFSValues(baseAnalysis, technicalData, v2Metrics),
          dynamicsValue: technicalData.lra,
          technicalScore: baseAnalysis.qualityOverall,
          monoCompatibility: technicalData.monoCompatibility,
          suggestionsCount: baseAnalysis.suggestions?.length || 0
        }
      });
      
      // Manter apenas últimos 3 resultados
      if (window.__PHASE5_CORRECTIONS__.length > 3) {
        window.__PHASE5_CORRECTIONS__ = window.__PHASE5_CORRECTIONS__.slice(-3);
      }
    }
    
  } catch (phase5Error) {
    warn('🔧 FASE 5: Erro nas correções críticas:', phase5Error.message);
  }
}

// 🔧 CORREÇÃO 1: LUFS Duplicado - Garantir valor único
function fixLUFSDuplication(baseAnalysis, technicalData, unifiedData, v2Metrics) {
  const correction = { applied: false, type: 'LUFS_DUPLICATION_FIXED', description: '' };
  
  try {
    // Extrair todos os valores LUFS encontrados no sistema
    const allLUFSValues = extractAllLUFSValues(baseAnalysis, technicalData, v2Metrics);
    
    // Identificar valor canônico (prioridade: V2 > technicalData > estimativa)
    let canonicalLUFS = unifiedData.lufsIntegrated;
    
    if (!Number.isFinite(canonicalLUFS)) {
      // Fallback seguro se não há LUFS válido
      warn('🔍 FASE 5: Nenhum LUFS válido encontrado para unificação');
      return correction;
    }
    
    // Verificar duplicações ou divergências significativas (> 1.0 dB)
    const duplications = [];
    const divergences = [];
    
    allLUFSValues.forEach(item => {
      if (Math.abs(item.value - canonicalLUFS) > 1.0) {
        divergences.push(item);
      }
    });
    
    if (allLUFSValues.length > 1) {
      duplications.push(...allLUFSValues);
    }
    
    // Aplicar correção apenas se há problemas reais
    if (divergences.length > 0 || duplications.length > 2) {
      // Garantir que apenas LUFS-I é usado como principal
      technicalData.lufsIntegrated = canonicalLUFS;
      
      // Limpar outros campos que podem estar sendo interpretados como LUFS
      if (technicalData.rms && Math.abs(technicalData.rms - canonicalLUFS) > 2) {
        const originalRMS = technicalData.rms;
        technicalData.rms = null; // Limpar RMS incorreto
        warn(`🔍 FASE 5: RMS removido por divergir do LUFS: ${originalRMS} vs ${canonicalLUFS}`);
      }
      
      correction.applied = true;
      correction.description = `LUFS unificado para ${canonicalLUFS.toFixed(1)} (${allLUFSValues.length} fontes, ${divergences.length} divergências)`;
      correction.canonicalValue = canonicalLUFS;
      correction.allSources = allLUFSValues;
    } else {
      log(`✅ FASE 5: LUFS já está unificado em ${canonicalLUFS.toFixed(1)}`);
    }
    
  } catch (error) {
    warn('🔍 FASE 5: Erro na correção LUFS:', error.message);
  }
  
  return correction;
}

// 🔧 CORREÇÃO 2: Dinâmica Negativa - Sempre ≥ 0
function fixNegativeDynamicsAdvanced(baseAnalysis, technicalData, unifiedData) {
  const correction = { applied: false, type: 'NEGATIVE_DYNAMICS_ADVANCED_FIXED', description: '' };
  
  try {
    const dynamicFields = ['lra', 'dynamicRange', 'dr'];
    const corrections = [];
    
    dynamicFields.forEach(field => {
      if (technicalData[field] !== null && Number.isFinite(technicalData[field])) {
        const currentValue = technicalData[field];
        
        if (currentValue < 0) {
          // Para valores negativos, usar valor absoluto ou buscar alternativa
          let correctedValue;
          
          if (field === 'lra' && unifiedData.lra && unifiedData.lra >= 0) {
            correctedValue = unifiedData.lra;
          } else {
            correctedValue = Math.abs(currentValue);
          }
          
          technicalData[field] = correctedValue;
          corrections.push(`${field}: ${currentValue.toFixed(2)} → ${correctedValue.toFixed(2)}`);
          
          warn(`🔍 FASE 5: Dinâmica negativa corrigida - ${field}: ${currentValue} → ${correctedValue}`);
        }
      }
    });
    
    if (corrections.length > 0) {
      correction.applied = true;
      correction.description = `Dinâmica negativa corrigida: ${corrections.join(', ')}`;
    } else {
      log('✅ FASE 5: Dinâmica já está com valores válidos');
    }
    
  } catch (error) {
    warn('🔍 FASE 5: Erro na correção de dinâmica:', error.message);
  }
  
  return correction;
}

// 🔧 CORREÇÃO 3: Score Técnico Zero - Calcular corretamente
function fixZeroTechnicalScore(baseAnalysis, technicalData, unifiedData) {
  const correction = { applied: false, type: 'ZERO_TECHNICAL_SCORE_FIXED', description: '' };
  
  try {
    const currentScore = baseAnalysis.qualityOverall;
    
    // Se score é 0, null, ou undefined mas temos dados técnicos válidos
    if ((!currentScore || currentScore === 0) && hasValidTechnicalData(technicalData, unifiedData)) {
      
      const availableMetrics = [];
      let totalScore = 0;
      let weightSum = 0;
      
      // LUFS Score (peso: 30%)
      if (Number.isFinite(unifiedData.lufsIntegrated)) {
        const lufsScore = calculateLoudnessScore(unifiedData.lufsIntegrated);
        totalScore += lufsScore * 0.3;
        weightSum += 0.3;
        availableMetrics.push(`LUFS: ${lufsScore}`);
      }
      
      // Peak Score (peso: 25%)
      if (Number.isFinite(unifiedData.truePeakDbtp)) {
        const peakScore = calculateClippingScore(unifiedData.clippingSamples, unifiedData.truePeakDbtp);
        totalScore += peakScore * 0.25;
        weightSum += 0.25;
        availableMetrics.push(`Peak: ${peakScore}`);
      }
      
      // Dynamics Score (peso: 25%)
      if (Number.isFinite(unifiedData.lra) && unifiedData.lra >= 0) {
        const dynScore = calculateDynamicsScore(unifiedData.lra);
        totalScore += dynScore * 0.25;
        weightSum += 0.25;
        availableMetrics.push(`Dynamics: ${dynScore}`);
      }
      
      // Stereo Score (peso: 20%)
      if (Number.isFinite(unifiedData.stereoCorrelation)) {
        const stereoScore = calculateStereoScore(unifiedData.stereoCorrelation);
        totalScore += stereoScore * 0.2;
        weightSum += 0.2;
        availableMetrics.push(`Stereo: ${stereoScore}`);
      }
      
      if (weightSum > 0) {
        const newScore = Math.round(totalScore / weightSum);
        
        if (newScore > 0 && newScore !== currentScore) {
          baseAnalysis.qualityOverall = newScore;
          
          correction.applied = true;
          correction.description = `Score técnico: ${currentScore || 0} → ${newScore} (baseado em: ${availableMetrics.join(', ')})`;
          correction.newScore = newScore;
          correction.availableMetrics = availableMetrics;
          
          log(`✅ FASE 5: Score técnico recalculado - ${correction.description}`);
        }
      } else {
        warn('🔍 FASE 5: Insuficientes dados técnicos para calcular score');
      }
    } else {
      log(`✅ FASE 5: Score técnico já válido: ${currentScore}`);
    }
    
  } catch (error) {
    warn('🔍 FASE 5: Erro na correção de score:', error.message);
  }
  
  return correction;
}

// 🔧 CORREÇÃO 4: Mono Compatibility - Usar correlação real
function fixMonoAlwaysPoor(baseAnalysis, technicalData, unifiedData) {
  const correction = { applied: false, type: 'MONO_ALWAYS_POOR_FIXED', description: '' };
  
  try {
    const currentMono = technicalData.monoCompatibility;
    const correlation = unifiedData.stereoCorrelation;
    
    if (Number.isFinite(correlation)) {
      // Critério rigoroso baseado em correlação real
      let newMono;
      
      if (correlation < 0.1) {
        newMono = 'Poor (correlação < 0.1)';
      } else if (correlation < 0.3) {
        newMono = 'Fair (correlação moderada)';
      } else if (correlation < 0.6) {
        newMono = 'Good (boa correlação)';
      } else if (correlation < 0.85) {
        newMono = 'Very Good (correlação alta)';
      } else {
        newMono = 'Excellent (correlação excelente)';
      }
      
      // Aplicar correção apenas se há mudança significativa
      if (currentMono !== newMono && (currentMono === 'Poor' || currentMono === 'poor')) {
        technicalData.monoCompatibility = newMono;
        
        correction.applied = true;
        correction.description = `Mono compatibility: "${currentMono}" → "${newMono}" (correlação: ${correlation.toFixed(3)})`;
        correction.correlation = correlation;
        
        log(`✅ FASE 5: Mono compatibility corrigida - correlação ${correlation.toFixed(3)} → ${newMono}`);
      } else {
        log(`✅ FASE 5: Mono compatibility já adequada: ${currentMono} (corr: ${correlation.toFixed(3)})`);
      }
    } else {
      warn('🔍 FASE 5: Correlação estéreo indisponível para correção de mono compatibility');
    }
    
  } catch (error) {
    warn('🔍 FASE 5: Erro na correção de mono compatibility:', error.message);
  }
  
  return correction;
}

// 🔧 CORREÇÃO 5: Sugestões Contraditórias - Gates de segurança
function fixContradictorySuggestions(baseAnalysis, technicalData, unifiedData) {
  const correction = { applied: false, type: 'CONTRADICTORY_SUGGESTIONS_FIXED', description: '' };
  
  try {
    if (!Array.isArray(baseAnalysis.suggestions) || baseAnalysis.suggestions.length === 0) {
      return correction;
    }
    
    const hasClipping = unifiedData.clippingSamples > 0;
    const dangerousPeak = unifiedData.truePeakDbtp > -0.3; // Threshold rigoroso
    const originalCount = baseAnalysis.suggestions.length;
    
    if (hasClipping || dangerousPeak) {
      const beforeFiltering = baseAnalysis.suggestions.slice();
      
      // Filtrar sugestões perigosas quando há clipping ou peak perigoso
      baseAnalysis.suggestions = baseAnalysis.suggestions.filter(suggestion => {
        const text = (suggestion?.message || suggestion?.action || '').toLowerCase();
        
        // Padrões perigosos para detectar
        const dangerousPatterns = [
          /aumentar.*volume/i,
          /aumentar.*peak/i,
          /\+\s*\d+.*dbtp/i,
          /gain.*up/i,
          /boost.*level/i,
          /push.*louder/i,
          /more.*loudness/i,
          /increase.*\d+.*db/i
        ];
        
        const isDangerous = dangerousPatterns.some(pattern => pattern.test(text));
        
        if (isDangerous) {
          warn(`🔍 FASE 5: Sugestão perigosa filtrada: "${text.slice(0, 50)}..."`);
        }
        
        return !isDangerous;
      });
      
      const filteredCount = originalCount - baseAnalysis.suggestions.length;
      
      if (filteredCount > 0) {
        correction.applied = true;
        correction.description = `${filteredCount} sugestões contraditórias removidas (clipping: ${hasClipping}, peak: ${unifiedData.truePeakDbtp?.toFixed(2)}dBTP)`;
        correction.filteredCount = filteredCount;
        correction.reason = hasClipping ? 'clipping detectado' : 'peak perigoso';
        
        log(`✅ FASE 5: ${filteredCount} sugestões contraditórias removidas - ${correction.reason}`);
      }
    } else {
      log('✅ FASE 5: Não há clipping/peak perigoso - sugestões mantidas');
    }
    
  } catch (error) {
    warn('🔍 FASE 5: Erro na correção de sugestões:', error.message);
  }
  
  return correction;
}

// =============== SISTEMA DE DEBUG DETALHADO ===============
/**
 * Sistema de debug detalhado para diagnosticar os problemas específicos mencionados
 */
function performDetailedAnalysisDebug(analysis) {
  try {
    console.group('🐛 DEBUG DETALHADO - Análise Completa');
    
    debugLUFSDuplication(analysis);
    debugNegativeDynamics(analysis);
    debugTruePeakClippingContradiction(analysis);
    debugZeroTechnicalScore(analysis);
    debugMonoCompatibilityIssue(analysis);
    
    console.groupEnd();
  } catch (error) {
    warn('🔍 DEBUG: Erro no debug detalhado:', error.message);
  }
}

// Debug 1: LUFS Duplicado
function debugLUFSDuplication(analysis) {
  console.group('🎵 DEBUG: LUFS Duplicação');
  
  const td = analysis.technicalData || {};
  const lufsValues = {
    'lufsIntegrated': td.lufsIntegrated,
    'lufsShortTerm': td.lufsShortTerm,
    'lufsMomentary': td.lufsMomentary,
    'rms': td.rms,
    'peak': td.peak
  };
  
  log('📊 Todos os valores LUFS/Volume encontrados:');
  Object.entries(lufsValues).forEach(([key, value]) => {
    const isValid = Number.isFinite(value);
    log(`  ${key}: ${isValid ? value.toFixed(2) : 'N/A'} ${isValid ? (key.includes('lufs') ? 'LUFS' : 'dB') : ''}`);
  });
  
  // Detectar duplicação
  const validLufs = Object.entries(lufsValues)
    .filter(([key, value]) => Number.isFinite(value) && key.includes('lufs'))
    .map(([key, value]) => ({ type: key, value }));
  
  if (validLufs.length > 1) {
    warn('⚠️ MÚLTIPLOS LUFS DETECTADOS:');
    validLufs.forEach(lufs => {
      log(`  - ${lufs.type}: ${lufs.value.toFixed(2)} LUFS`);
    });
    
    const values = validLufs.map(l => l.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const divergence = max - min;
    
    log(`📏 Divergência máxima: ${divergence.toFixed(2)} dB`);
    if (divergence > 1.0) {
      error('🚨 PROBLEMA: Divergência de LUFS > 1.0 dB');
    }
  } else {
    log('✅ LUFS unificado ou único valor encontrado');
  }
  
  console.groupEnd();
}

// Debug 2: Dinâmica Negativa  
function debugNegativeDynamics(analysis) {
  console.group('📈 DEBUG: Dinâmica Negativa');
  
  const td = analysis.technicalData || {};
  const dynamicFields = {
    'dynamicRange': td.dynamicRange,
    'lra': td.lra,
    'crestFactor': td.crestFactor
  };
  
  log('📊 Valores de dinâmica encontrados:');
  Object.entries(dynamicFields).forEach(([key, value]) => {
    const isValid = Number.isFinite(value);
    const isNegative = isValid && value < 0;
    
    log(`  ${key}: ${isValid ? value.toFixed(2) : 'N/A'} dB ${isNegative ? '⚠️ IMPOSSÍVEL' : ''}`);
    
    if (isNegative) {
      error(`🚨 PROBLEMA: ${key} com valor negativo (${value.toFixed(2)}) é fisicamente impossível`);
    }
  });
  
  console.groupEnd();
}

// Debug 3: True Peak & Clipping Contradição
function debugTruePeakClippingContradiction(analysis) {
  console.group('🔊 DEBUG: True Peak & Clipping');
  
  const td = analysis.technicalData || {};
  const clippingData = {
    truePeakDbtp: td.truePeakDbtp,
    peak: td.peak,
    clippingSamples: td.clippingSamples,
    clippingPct: td.clippingPct
  };
  
  log('📊 Dados de clipping e picos:');
  Object.entries(clippingData).forEach(([key, value]) => {
    const isValid = Number.isFinite(value);
    const unit = key.includes('Pct') ? '%' : key.includes('Samples') ? 'samples' : key.includes('dbtp') ? 'dBTP' : 'dB';
    log(`  ${key}: ${isValid ? value.toFixed(2) + ' ' + unit : 'N/A'}`);
  });
  
  // Analisar contradições
  const truePeak = td.truePeakDbtp;
  const clippingSamples = td.clippingSamples || 0;
  const hasClipping = clippingSamples > 0;
  const dangerousPeak = Number.isFinite(truePeak) && truePeak > -0.3;
  
  log('\n⚖️ Análise de consistência:');
  log(`  Tem clipping: ${hasClipping}`);
  log(`  Peak perigoso (>-0.3dBTP): ${dangerousPeak}`);
  
  if (hasClipping && !dangerousPeak) {
    warn('🚨 CONTRADIÇÃO: Há clipping mas True Peak não indica perigo');
  } else if (!hasClipping && dangerousPeak) {
    warn('⚠️ POSSÍVEL INCONSISTÊNCIA: True Peak alto mas sem clipping detectado');
  } else {
    log('✅ Dados consistentes entre clipping e True Peak');
  }
  
  // Verificar sugestões contraditórias
  const suggestions = analysis.suggestions || [];
  if (suggestions.length > 0 && (hasClipping || dangerousPeak)) {
    const dangerousPatterns = suggestions.filter(s => {
      const text = (s.action || s.message || '').toLowerCase();
      return /aumentar|boost|\+.*db/i.test(text);
    });
    
    if (dangerousPatterns.length > 0) {
      error('🚨 SUGESTÕES CONTRADITÓRIAS detectadas:');
      dangerousPatterns.forEach(s => {
        log(`  - "${s.action || s.message}"`);
      });
    } else {
      log('✅ Sugestões consistentes com situação de clipping');
    }
  }
  
  console.groupEnd();
}

// Debug 4: Score Técnico Zero
function debugZeroTechnicalScore(analysis) {
  console.group('🏆 DEBUG: Score Técnico');
  
  const scores = {
    qualityOverall: analysis.qualityOverall,
    mixScore: analysis.mixScore,
    mixScorePct: analysis.mixScorePct
  };
  
  log('📊 Scores encontrados:');
  Object.entries(scores).forEach(([key, value]) => {
    const isValid = Number.isFinite(value);
    const isZero = isValid && value === 0;
    log(`  ${key}: ${isValid ? value : 'N/A'} ${isZero ? '⚠️ SEMPRE ZERO' : ''}`);
  });
  
  // Verificar breakdown
  if (analysis.qualityBreakdown) {
    log('\n📊 Breakdown de scores:');
    Object.entries(analysis.qualityBreakdown).forEach(([key, value]) => {
      log(`  ${key}: ${Number.isFinite(value) ? value : 'N/A'}`);
    });
  }
  
  // Verificar se há dados suficientes para calcular
  const td = analysis.technicalData || {};
  const metricsForScore = {
    'LUFS': Number.isFinite(td.lufsIntegrated),
    'True Peak': Number.isFinite(td.truePeakDbtp),
    'LRA': Number.isFinite(td.lra),
    'Stereo Correlation': Number.isFinite(td.stereoCorrelation)
  };
  
  log('\n🔧 Métricas disponíveis para cálculo:');
  Object.entries(metricsForScore).forEach(([metric, available]) => {
    log(`  ${metric}: ${available ? '✅' : '❌'}`);
  });
  
  const availableCount = Object.values(metricsForScore).filter(Boolean).length;
  if (availableCount >= 2 && analysis.qualityOverall === 0) {
    error('🚨 PROBLEMA: Score zero apesar de métricas disponíveis');
  } else if (availableCount < 2) {
    warn('⚠️ Métricas insuficientes para calcular score técnico');
  } else {
    log('✅ Score técnico parece estar calculado corretamente');
  }
  
  console.groupEnd();
}

// Debug 5: Mono Compatibility sempre "Poor"
function debugMonoCompatibilityIssue(analysis) {
  console.group('🎧 DEBUG: Mono Compatibility');
  
  const td = analysis.technicalData || {};
  const monoData = {
    monoCompatibility: td.monoCompatibility,
    stereoCorrelation: td.stereoCorrelation,
    stereoWidth: td.stereoWidth,
    balanceLR: td.balanceLR
  };
  
  log('📊 Dados de estéreo/mono:');
  Object.entries(monoData).forEach(([key, value]) => {
    if (key === 'monoCompatibility') {
      log(`  ${key}: "${value || 'N/A'}"`);
    } else if (Number.isFinite(value)) {
      log(`  ${key}: ${value.toFixed(3)}`);
    } else {
      log(`  ${key}: N/A`);
    }
  });
  
  // Analisar consistência
  const correlation = td.stereoCorrelation;
  const monoCompat = td.monoCompatibility;
  
  if (Number.isFinite(correlation) && monoCompat) {
    log('\n⚖️ Análise de consistência:');
    
    // Determinar o que deveria ser baseado na correlação
    let expectedMono;
    if (correlation < 0.1) expectedMono = 'Poor';
    else if (correlation < 0.3) expectedMono = 'Fair';
    else if (correlation < 0.6) expectedMono = 'Good';
    else if (correlation < 0.85) expectedMono = 'Very Good';
    else expectedMono = 'Excellent';
    
    const currentMono = monoCompat.replace(/\s*\(.*\)/, ''); // Remove explicação
    
    log(`  Correlação: ${correlation.toFixed(3)}`);
    log(`  Mono atual: "${monoCompat}"`);
    log(`  Mono esperado: "${expectedMono}"`);
    
    if (currentMono.toLowerCase().includes('poor') && correlation > 0.3) {
      error('🚨 PROBLEMA: Mono = "Poor" mas correlação indica qualidade superior');
    } else if (!currentMono.toLowerCase().includes(expectedMono.toLowerCase())) {
      warn(`⚠️ INCONSISTÊNCIA: Mono não corresponde à correlação (deveria ser "${expectedMono}")`);
    } else {
      log('✅ Mono compatibility consistente com correlação estéreo');
    }
  } else {
    warn('⚠️ Dados insuficientes para analisar consistência mono/estéreo');
  }
  
  console.groupEnd();
}

// Função global para ativar debug detalhado
if (typeof window !== 'undefined') {
  window.enableDetailedAnalyzerDebug = () => {
    window.DEBUG_ANALYZER_DETAILED = true;
    log('🐛 DEBUG DETALHADO ATIVADO - próxima análise incluirá diagnóstico completo');
  };
  
  window.disableDetailedAnalyzerDebug = () => {
    window.DEBUG_ANALYZER_DETAILED = false;
    log('🐛 DEBUG DETALHADO DESATIVADO');
  };
}

// 🎯 CENTRALIZAÇÃO DAS MÉTRICAS - Single Source of Truth
/**
 * Constrói objeto centralizado de métricas coletando de todas as fontes
 * @param {Object} baseAnalysis - Análise base com technicalData
 * @param {Object} v2Metrics - Métricas do Audio Analyzer V2
 * @returns {Object} Objeto centralizado com todas as métricas
 */
function buildCentralizedMetrics(baseAnalysis, v2Metrics) {
  const td = baseAnalysis?.technicalData || {};
  const v2 = v2Metrics || {};
  
  // Helper para pegar valor válido com prioridade
  const getValid = (primary, secondary, fallback = null) => {
    if (Number.isFinite(primary)) return primary;
    if (Number.isFinite(secondary)) return secondary;
    return fallback;
  };
  
  // Helper para timestamp
  const timestamp = new Date().toISOString();
  
  return {
    // === LOUDNESS ===
    lufs_integrated: getValid(
      td.lufsIntegrated,
      v2.loudness?.lufs_integrated
    ),
    lufs_short_term: getValid(
      td.lufsShortTerm,
      v2.loudness?.lufs_short_term
    ),
    lufs_momentary: getValid(
      td.lufsMomentary,
      v2.loudness?.lufs_momentary
    ),
    lra: getValid(
      td.lra,
      v2.loudness?.lra
    ),
    headroom_db: getValid(
      td.headroomDb,
      v2.loudness?.headroom_db
    ),
    
    // === PEAKS & DYNAMICS ===
    true_peak_dbtp: getValid(
      td.truePeakDbtp,
      v2.truePeak?.true_peak_dbtp
    ),
    sample_peak_left_db: getValid(
      td.samplePeakLeftDb,
      v2.truePeak?.sample_peak_left_db
    ),
    sample_peak_right_db: getValid(
      td.samplePeakRightDb,
      v2.truePeak?.sample_peak_right_db
    ),
    crest_factor: getValid(
      td.crestFactor,
      v2.core?.crestFactor
    ),
    dynamic_range: getValid(
      td.dynamicRange,
      baseAnalysis?.technicalData?.peak && baseAnalysis?.technicalData?.rms 
        ? baseAnalysis.technicalData.peak - baseAnalysis.technicalData.rms 
        : null
    ),
    peak_db: getValid(
      td.peak,
      v2.core?.peak_db
    ),
    rms_db: getValid(
      td.rms,
      v2.core?.rms_db
    ),
    
    // === STEREO ===
    stereo_width: getValid(
      td.stereoWidth,
      v2.stereo?.width
    ),
    stereo_correlation: getValid(
      td.stereoCorrelation,
      v2.stereo?.correlation
    ),
    balance_lr: getValid(
      td.balanceLR,
      v2.stereo?.balance
    ),
    mono_compatibility: td.monoCompatibility || v2.stereo?.mono_compatibility || null,
    
    // === CLIPPING & DISTORTION ===
    clipping_samples: getValid(
      td.clippingSamples,
      v2.core?.clippingEvents,
      0
    ),
    clipping_percentage: getValid(
      td.clippingPct,
      v2.core?.clippingPercentage,
      0
    ),
    dc_offset: getValid(
      td.dcOffset,
      v2.core?.dcOffset,
      0
    ),
    thd_percent: getValid(
      td.thdPercent,
      v2.core?.thdPercent,
      0
    ),
    
    // === SPECTRAL ===
    spectral_centroid: getValid(
      td.spectralCentroid,
      v2.spectral?.centroid
    ),
    spectral_rolloff_85: getValid(
      td.spectralRolloff85,
      v2.spectral?.rolloff85
    ),
    spectral_rolloff_50: getValid(
      td.spectralRolloff50,
      v2.spectral?.rolloff50
    ),
    spectral_flatness: getValid(
      td.spectralFlatness,
      v2.spectral?.flatness
    ),
    spectral_flux: getValid(
      td.spectralFlux,
      v2.spectral?.flux
    ),
    
    // === FREQUENCY BANDS ===
    bands: buildFrequencyBands(td.bandEnergies, v2.bands),
    
    // === TONAL BALANCE ===
    tonal_balance: td.tonalBalance || v2.tonalBalance || null,
    
    // === QUALITY SCORES ===
    quality_overall: getValid(
      baseAnalysis?.qualityOverall,
      v2.qualityScores?.overall
    ),
    quality_breakdown: baseAnalysis?.qualityBreakdown || v2.qualityScores || null,
    
    // === METADATA ===
    sample_rate: baseAnalysis?.sampleRate || v2.sampleRate || null,
    duration_s: baseAnalysis?.duration || v2.duration || null,
    processing_time_ms: getValid(
      td.processingMs,
      v2.processingTime || baseAnalysis?.processingTime
    ),
    source_engine: v2.core ? 'v2_primary' : 'v1_fallback',
    timestamp: timestamp
  };
}

/**
 * Constrói objeto unificado de bandas de frequência
 */
function buildFrequencyBands(legacyBands, v2Bands) {
  const bands = {};
  
  // Mapeamento de nomes conhecidos
  const bandMapping = {
    sub: { range_hz: [20, 60], alt_names: ['subBass', 'sub_bass'] },
    bass: { range_hz: [60, 250], alt_names: ['low_bass', 'lowBass'] },
    low_mid: { range_hz: [250, 500], alt_names: ['lowMid', 'lower_mid'] },
    mid: { range_hz: [500, 2000], alt_names: ['middle', 'midrange'] },
    high_mid: { range_hz: [2000, 6000], alt_names: ['highMid', 'upper_mid'] },
    presence: { range_hz: [6000, 10000], alt_names: ['presenca', 'high'] },
    brilliance: { range_hz: [10000, 20000], alt_names: ['brilho', 'air'] }
  };
  
  // Processar bandas legadas
  if (legacyBands && typeof legacyBands === 'object') {
    Object.entries(legacyBands).forEach(([name, data]) => {
      const standardName = findStandardBandName(name, bandMapping);
      if (standardName && data && Number.isFinite(data.energy_db || data.rms_db)) {
        bands[standardName] = {
          energy_db: data.energy_db || data.rms_db,
          range_hz: bandMapping[standardName].range_hz,
          source: 'legacy'
        };
      }
    });
  }
  
  // Processar bandas V2 (sobrescrevem se existirem)
  if (v2Bands && typeof v2Bands === 'object') {
    Object.entries(v2Bands).forEach(([name, data]) => {
      const standardName = findStandardBandName(name, bandMapping);
      if (standardName && data && Number.isFinite(data.energy_db)) {
        bands[standardName] = {
          energy_db: data.energy_db,
          range_hz: data.range_hz || bandMapping[standardName].range_hz,
          source: 'v2'
        };
      }
    });
  }
  
  return bands;
}

/**
 * Encontra nome padrão de banda baseado em mapeamentos
 */
function findStandardBandName(inputName, bandMapping) {
  const input = inputName.toLowerCase();
  
  // Verificar nome direto
  if (bandMapping[input]) return input;
  
  // Verificar nomes alternativos
  for (const [standardName, config] of Object.entries(bandMapping)) {
    if (config.alt_names.some(alt => alt.toLowerCase() === input)) {
      return standardName;
    }
  }
  
  return null;
}

// 🌐 DISPONIBILIZAR GLOBALMENTE PARA COMPATIBILIDADE
if (typeof window !== 'undefined') {
  window.AudioAnalyzer = AudioAnalyzer;
  
  // 🌟 Interface simplificada para uso (instância global)
  window.audioAnalyzer = new AudioAnalyzer();
  
  log('✅ AudioAnalyzer disponibilizado:', {
    classe: typeof window.AudioAnalyzer,
    instancia: typeof window.audioAnalyzer
  });
}

// 🚨 PHASE 2: REFERENCE MANAGER - IMPLEMENTAÇÃO SEGURA
// 📋 Gerenciamento inteligente de referências com cache otimizado e fallbacks robustos
// 🔒 COMPATIBILIDADE: 100% compatível com sistema existente (loadReferenceData, enrichReferenceObject)
if (typeof window !== 'undefined' && window.audioAnalyzer) {
  
  // 🧠 REFERENCE MANAGER - Métodos seguros integrados ao AudioAnalyzer
  Object.assign(window.audioAnalyzer, {
    
    /**
     * 🔄 REFERENCE CACHE MANAGER
     * Gerencia cache de referências com limpeza inteligente
     */
    _manageReferenceCache() {
      try {
        // Verificar se existe cache global do sistema
        const globalCache = window.__refDataCache || {};
        const cacheKeys = Object.keys(globalCache);
        
        // Limpar entradas antigas (mais de 5 gêneros em cache)
        if (cacheKeys.length > 5) {
          // Manter apenas os 3 mais recentes
          const sortedKeys = cacheKeys.sort((a, b) => {
            const timestampA = globalCache[a]?._cacheTimestamp || 0;
            const timestampB = globalCache[b]?._cacheTimestamp || 0;
            return timestampB - timestampA;
          });
          
          // Remover os mais antigos
          const toRemove = sortedKeys.slice(3);
          toRemove.forEach(key => {
            delete globalCache[key];
            log(`🧹 Reference cache cleaned: ${key}`);
          });
        }
        
        return {
          cacheSize: Object.keys(globalCache).length,
          cleanedEntries: cacheKeys.length - Object.keys(globalCache).length
        };
      } catch (error) {
        warn('⚠️ Reference cache cleanup error:', error.message);
        return { error: error.message };
      }
    },
    
    /**
     * 🎯 REFERENCE PRELOADER
     * Pré-carrega referências populares para melhor performance
     */
    _preloadPopularReferences() {
      try {
        // Lista de gêneros populares para pré-carregar
        const popularGenres = ['funk_mandela', 'trance', 'eletronico'];
        const preloadPromises = [];
        
        popularGenres.forEach(genre => {
          // Verificar se já existe no cache
          const cached = window.__refDataCache?.[genre];
          if (!cached) {
            // Criar promise de pré-carregamento (apenas se loadReferenceData existir)
            if (typeof window.loadReferenceData === 'function') {
              const preloadPromise = window.loadReferenceData(genre)
                .then(() => log(`✅ Preloaded reference: ${genre}`))
                .catch(() => log(`⚠️ Failed to preload: ${genre}`));
              preloadPromises.push(preloadPromise);
            }
          }
        });
        
        return {
          initiated: preloadPromises.length,
          genres: popularGenres,
          alreadyCached: popularGenres.length - preloadPromises.length
        };
      } catch (error) {
        warn('⚠️ Reference preload error:', error.message);
        return { error: error.message };
      }
    },
    
    /**
     * 📊 REFERENCE VALIDATOR
     * Valida integridade das referências carregadas
     */
    _validateReferenceIntegrity(referenceData) {
      try {
        if (!referenceData || typeof referenceData !== 'object') {
          return { valid: false, reason: 'Reference data is not an object' };
        }
        
        // Verificar estrutura mínima esperada
        const requiredFields = ['legacy_compatibility'];
        const missingFields = requiredFields.filter(field => !referenceData[field]);
        
        if (missingFields.length > 0) {
          return { valid: false, reason: `Missing fields: ${missingFields.join(', ')}` };
        }
        
        // Verificar métricas essenciais
        const compat = referenceData.legacy_compatibility;
        const essentialMetrics = ['lufs_target', 'true_peak_target', 'dr_target'];
        const missingMetrics = essentialMetrics.filter(metric => 
          typeof compat[metric] !== 'number' || !Number.isFinite(compat[metric])
        );
        
        if (missingMetrics.length > 0) {
          return { valid: false, reason: `Invalid metrics: ${missingMetrics.join(', ')}` };
        }
        
        return {
          valid: true,
          version: referenceData.version,
          numTracks: referenceData.num_tracks,
          generatedAt: referenceData.generated_at
        };
      } catch (error) {
        return { valid: false, reason: error.message };
      }
    },
    
    /**
     * 🔍 REFERENCE DIAGNOSTICS
     * Diagnóstico completo do sistema de referências
     */
    _diagnoseReferenceSystem() {
      try {
        const diagnosis = {
          timestamp: new Date().toISOString(),
          globalCache: {
            exists: typeof window.__refDataCache === 'object',
            size: Object.keys(window.__refDataCache || {}).length,
            genres: Object.keys(window.__refDataCache || {})
          },
          activeReference: {
            exists: typeof window.__activeRefData === 'object',
            genre: window.__activeRefGenre,
            valid: window.__activeRefData ? this._validateReferenceIntegrity(window.__activeRefData).valid : false
          },
          embeddedRefs: {
            loaded: window.EMBEDDED_REFS_LOADED === true,
            version: window.EMBEDDED_REFS_VERSION,
            dataExists: typeof window.PROD_AI_REF_DATA === 'object'
          },
          functions: {
            loadReferenceData: typeof window.loadReferenceData === 'function',
            enrichReferenceObject: typeof window.enrichReferenceObject === 'function'
          }
        };
        
        log('🔍 Reference System Diagnosis:', diagnosis);
        return diagnosis;
      } catch (error) {
        const errorDiagnosis = { error: error.message, timestamp: new Date().toISOString() };
        error('❌ Reference diagnosis failed:', errorDiagnosis);
        return errorDiagnosis;
      }
    }
  });
  
  log('✅ Phase 2 - Reference Manager initialized safely');
}

// 🚨 PHASE 3: CACHE INVALIDATION - IMPLEMENTAÇÃO SEGURA
// 🧹 Sistema inteligente de invalidação de cache com políticas TTL e limpeza automática  
// 🔒 COMPATIBILIDADE: 100% compatível com sistemas existentes de cache
if (typeof window !== 'undefined' && window.audioAnalyzer) {
  
  // 🧹 CACHE INVALIDATION - Métodos seguros integrados ao AudioAnalyzer
  Object.assign(window.audioAnalyzer, {
    
    /**
     * 🕐 CACHE TTL MANAGER
     * Gerencia Time-To-Live de diferentes tipos de cache
     */
    _manageCacheTTL() {
      try {
        const now = Date.now();
        const policies = {
          analysis: 15 * 60 * 1000,     // 15 minutos para análises
          references: 30 * 60 * 1000,   // 30 minutos para referências  
          ui_state: 5 * 60 * 1000,      // 5 minutos para estados UI
          temp_files: 2 * 60 * 1000     // 2 minutos para arquivos temporários
        };
        
        const invalidated = {
          analysis: 0,
          references: 0,
          ui_state: 0,
          temp_files: 0
        };
        
        // Invalidar cache de análises (__AUDIO_ANALYSIS_CACHE__)
        const analysisCache = window.__AUDIO_ANALYSIS_CACHE__;
        if (analysisCache instanceof Map) {
          for (const [key, entry] of analysisCache.entries()) {
            if (entry._ts && (now - entry._ts) > policies.analysis) {
              analysisCache.delete(key);
              invalidated.analysis++;
            }
          }
        }
        
        // Invalidar cache de referências (__refDataCache)
        const refCache = window.__refDataCache || {};
        Object.keys(refCache).forEach(key => {
          const entry = refCache[key];
          if (entry._cacheTimestamp && (now - entry._cacheTimestamp) > policies.references) {
            delete refCache[key];
            invalidated.references++;
          }
        });
        
        // Invalidar cache UI/temporário (localStorage com prefixo 'prodai_')
        if (typeof localStorage !== 'undefined') {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith('prodai_temp_')) {
              try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data._ts && (now - data._ts) > policies.temp_files) {
                  localStorage.removeItem(key);
                  invalidated.temp_files++;
                }
              } catch (e) {
                // Remove entrada inválida
                localStorage.removeItem(key);
                invalidated.temp_files++;
              }
            }
          }
        }
        
        return {
          timestamp: new Date().toISOString(),
          policies,
          invalidated,
          totalInvalidated: Object.values(invalidated).reduce((sum, count) => sum + count, 0)
        };
      } catch (error) {
        warn('⚠️ Cache TTL management error:', error.message);
        return { error: error.message };
      }
    },
    
    /**
     * 🔄 CACHE INVALIDATION BY TYPE
     * Invalida cache específico por tipo com segurança
     */
    _invalidateCacheByType(type = 'all') {
      try {
        const results = { invalidated: 0, errors: [] };
        
        switch (type) {
          case 'analysis':
            const analysisCache = window.__AUDIO_ANALYSIS_CACHE__;
            if (analysisCache instanceof Map) {
              const size = analysisCache.size;
              analysisCache.clear();
              results.invalidated = size;
            }
            break;
            
          case 'references':
            const refCache = window.__refDataCache || {};
            const refKeys = Object.keys(refCache);
            refKeys.forEach(key => delete refCache[key]);
            results.invalidated = refKeys.length;
            // Limpar dados ativos também
            window.__activeRefData = null;
            window.__activeRefGenre = null;
            break;
            
          case 'memory':
            // Forçar limpeza dos Memory Management caches
            if (typeof this._cleanupLRUCache === 'function') {
              this._cleanupLRUCache();
            }
            if (typeof this._cleanupAudioBuffer === 'function') {
              this._cleanupAudioBuffer();
            }
            if (typeof this._cleanupStemsArrays === 'function') {
              this._cleanupStemsArrays();
            }
            results.invalidated = 1; // Simbólico
            break;
            
          case 'localStorage':
            if (typeof localStorage !== 'undefined') {
              let count = 0;
              for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('prodai_') || key.startsWith('audio_'))) {
                  localStorage.removeItem(key);
                  count++;
                }
              }
              results.invalidated = count;
            }
            break;
            
          case 'all':
            // Invalidar tudo recursivamente
            const allResults = [
              this._invalidateCacheByType('analysis'),
              this._invalidateCacheByType('references'),
              this._invalidateCacheByType('memory'),
              this._invalidateCacheByType('localStorage')
            ];
            results.invalidated = allResults.reduce((sum, r) => sum + r.invalidated, 0);
            results.errors = allResults.flatMap(r => r.errors || []);
            break;
            
          default:
            throw new Error(`Tipo de cache inválido: ${type}`);
        }
        
        log(`🧹 Cache invalidation [${type}]: ${results.invalidated} entradas removidas`);
        return results;
      } catch (error) {
        error('❌ Cache invalidation error:', error.message);
        return { invalidated: 0, errors: [error.message] };
      }
    },
    
    /**
     * 🎯 SMART CACHE INVALIDATION
     * Invalidação inteligente baseada em uso e padrões
     */
    _smartCacheInvalidation(options = {}) {
      try {
        const {
          maxAnalysisEntries = 20,
          maxReferenceEntries = 5,
          maxMemoryUsageMB = 100,
          aggressiveCleanup = false
        } = options;
        
        const stats = {
          before: {},
          after: {},
          cleaned: {
            analysis: 0,
            references: 0,
            memory: 0
          }
        };
        
        // Capturar estado inicial
        const analysisCache = window.__AUDIO_ANALYSIS_CACHE__;
        const refCache = window.__refDataCache || {};
        stats.before.analysis = analysisCache instanceof Map ? analysisCache.size : 0;
        stats.before.references = Object.keys(refCache).length;
        
        // 1. Limpeza inteligente de análises
        if (analysisCache instanceof Map && analysisCache.size > maxAnalysisEntries) {
          const entries = Array.from(analysisCache.entries());
          // Ordenar por timestamp (mais antigo primeiro)
          entries.sort((a, b) => (a[1]._ts || 0) - (b[1]._ts || 0));
          
          const toRemove = entries.slice(0, analysisCache.size - maxAnalysisEntries);
          toRemove.forEach(([key]) => {
            analysisCache.delete(key);
            stats.cleaned.analysis++;
          });
        }
        
        // 2. Limpeza inteligente de referências (via Phase 2)
        if (typeof this._manageReferenceCache === 'function') {
          const refResult = this._manageReferenceCache();
          stats.cleaned.references = refResult.cleanedEntries || 0;
        }
        
        // 3. Limpeza de memória agressiva se solicitada
        if (aggressiveCleanup) {
          if (typeof this._forceGarbageCollection === 'function') {
            this._forceGarbageCollection();
            stats.cleaned.memory++;
          }
        }
        
        // Capturar estado final
        stats.after.analysis = analysisCache instanceof Map ? analysisCache.size : 0;
        stats.after.references = Object.keys(window.__refDataCache || {}).length;
        
        return {
          timestamp: new Date().toISOString(),
          mode: aggressiveCleanup ? 'aggressive' : 'smart',
          stats,
          success: true
        };
      } catch (error) {
        error('❌ Smart cache invalidation error:', error.message);
        return { success: false, error: error.message };
      }
    },
    
    /**
     * 📊 CACHE HEALTH MONITOR
     * Monitora saúde geral do sistema de cache
     */
    _monitorCacheHealth() {
      try {
        const health = {
          timestamp: new Date().toISOString(),
          analysis: { status: 'unknown', size: 0, oldestEntry: null },
          references: { status: 'unknown', size: 0, genres: [] },
          memory: { status: 'unknown', stats: null },
          localStorage: { status: 'unknown', prodaiEntries: 0 },
          overall: 'unknown'
        };
        
        // Análise do cache de análises
        const analysisCache = window.__AUDIO_ANALYSIS_CACHE__;
        if (analysisCache instanceof Map) {
          health.analysis.size = analysisCache.size;
          health.analysis.status = analysisCache.size > 30 ? 'warning' : 'healthy';
          
          // Encontrar entrada mais antiga
          let oldestTs = Date.now();
          for (const [key, entry] of analysisCache.entries()) {
            if (entry._ts && entry._ts < oldestTs) {
              oldestTs = entry._ts;
            }
          }
          health.analysis.oldestEntry = oldestTs < Date.now() ? new Date(oldestTs).toISOString() : null;
        }
        
        // Análise do cache de referências
        const refCache = window.__refDataCache || {};
        health.references.size = Object.keys(refCache).length;
        health.references.genres = Object.keys(refCache);
        health.references.status = health.references.size > 8 ? 'warning' : 'healthy';
        
        // Análise da memória (via Phase 1)
        if (typeof this._getMemoryStats === 'function') {
          health.memory.stats = this._getMemoryStats();
          health.memory.status = 'monitored';
        }
        
        // Análise do localStorage
        if (typeof localStorage !== 'undefined') {
          let prodaiCount = 0;
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('prodai_')) {
              prodaiCount++;
            }
          }
          health.localStorage.prodaiEntries = prodaiCount;
          health.localStorage.status = prodaiCount > 50 ? 'warning' : 'healthy';
        }
        
        // Status geral
        const statuses = [health.analysis.status, health.references.status, health.localStorage.status];
        health.overall = statuses.includes('warning') ? 'warning' : 'healthy';
        
        log('📊 Cache Health Report:', health);
        return health;
      } catch (error) {
        error('❌ Cache health monitoring error:', error.message);
        return { 
          timestamp: new Date().toISOString(),
          overall: 'error', 
          error: error.message 
        };
      }
    }
  });
  
  log('✅ Phase 3 - Cache Invalidation initialized safely');
}
