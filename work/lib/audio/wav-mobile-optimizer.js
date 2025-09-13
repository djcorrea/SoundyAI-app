/**
 * 🎵 WAV MOBILE OPTIMIZER - iOS/Android WAV Processing
 * Otimizações específicas para arquivos WAV grandes em dispositivos móveis
 * Inclui feedback de progresso, timeouts estendidos e fallbacks
 */

// Configurações específicas para WAV mobile - TIMEOUTS UNIFICADOS
const WAV_MOBILE_CONFIG = {
  LARGE_FILE_THRESHOLD: 20 * 1024 * 1024, // 20MB
  MOBILE_DECODE_TIMEOUT: 120000, // 2 min UNIFICADO 
  DESKTOP_DECODE_TIMEOUT: 90000, // 1.5 min UNIFICADO
  ESTIMATED_SPEED_MOBILE: 2 * 1024 * 1024, // 2MB/s estimado mobile
  ESTIMATED_SPEED_DESKTOP: 8 * 1024 * 1024, // 8MB/s estimado desktop
  CHUNK_SIZE: 5 * 1024 * 1024, // 5MB chunks para fallback
};

// Detectar ambiente
function detectEnvironment() {
  const userAgent = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const isMobile = isIOS || isAndroid;
  const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
  
  return { isIOS, isAndroid, isMobile, isSafari };
}

// Analisar arquivo WAV e estimar tempo de processamento
function analyzeWAVFile(file) {
  const isWAV = file.name.toLowerCase().endsWith('.wav') || 
                file.type.includes('wav') || 
                file.type === 'audio/wav';
  
  if (!isWAV) {
    return { isWAV: false };
  }
  
  const env = detectEnvironment();
  const sizeInMB = file.size / (1024 * 1024);
  const isLarge = file.size > WAV_MOBILE_CONFIG.LARGE_FILE_THRESHOLD;
  
  // Estimar tempo baseado no ambiente
  const estimatedSpeed = env.isMobile ? 
    WAV_MOBILE_CONFIG.ESTIMATED_SPEED_MOBILE : 
    WAV_MOBILE_CONFIG.ESTIMATED_SPEED_DESKTOP;
  
  const estimatedSeconds = Math.ceil(file.size / estimatedSpeed);
  const recommendedTimeout = estimatedSeconds * 1.5 * 1000; // 50% buffer
  
  return {
    isWAV: true,
    isLarge,
    sizeInMB: sizeInMB.toFixed(1),
    estimatedSeconds,
    recommendedTimeout: Math.min(recommendedTimeout, 120000), // máximo 2 minutos
    environment: env,
    requiresOptimization: isLarge && env.isMobile
  };
}

// Mostrar feedback específico para WAV
function showWAVProcessingFeedback(analysis) {
  if (!analysis.isWAV) return;
  
  const progressText = document.getElementById('audioProgressText');
  if (!progressText) return;
  
  if (analysis.requiresOptimization) {
    // WAV grande no mobile
    progressText.innerHTML = `
      🎵 Processando WAV (${analysis.sizeInMB}MB)<br>
      ⏱️ Tempo estimado: ${analysis.estimatedSeconds}-${analysis.estimatedSeconds * 2}s<br>
      📱 Otimização mobile ativa...
    `;
    
    // Log detalhado
    console.log('🎵 WAV Mobile Processing:', {
      size: analysis.sizeInMB + 'MB',
      estimated: analysis.estimatedSeconds + 's',
      timeout: analysis.recommendedTimeout + 'ms',
      env: analysis.environment
    });
    
  } else if (analysis.isLarge) {
    // WAV grande no desktop
    progressText.innerHTML = `
      🎵 Processando WAV (${analysis.sizeInMB}MB)<br>
      ⏱️ Tempo estimado: ${Math.ceil(analysis.estimatedSeconds / 2)}s<br>
      🖥️ Processamento desktop...
    `;
    
  } else {
    // WAV normal
    progressText.innerHTML = `🎵 Processando WAV (${analysis.sizeInMB}MB)...`;
  }
}

// Aplicar otimizações específicas WAV
function applyWAVOptimizations(file) {
  const analysis = analyzeWAVFile(file);
  
  if (analysis.requiresOptimization) {
    // Configurar timeouts estendidos
    if (typeof window !== 'undefined') {
      window.__WAV_MOBILE_TIMEOUT__ = analysis.recommendedTimeout;
      window.__WAV_PROCESSING_START__ = Date.now();
      
      console.log(`🔧 WAV mobile optimizations applied: ${analysis.recommendedTimeout}ms timeout`);
    }
    
    // Mostrar feedback imediato
    setTimeout(() => showWAVProcessingFeedback(analysis), 500);
    
    // Feedback progressivo
    const intervals = [5000, 15000, 30000]; // 5s, 15s, 30s
    intervals.forEach((delay, index) => {
      setTimeout(() => {
        const elapsed = Math.ceil((Date.now() - window.__WAV_PROCESSING_START__) / 1000);
        const remaining = Math.max(0, analysis.estimatedSeconds - elapsed);
        
        const progressText = document.getElementById('audioProgressText');
        if (progressText && remaining > 0) {
          progressText.innerHTML = `
            🎵 WAV ${analysis.sizeInMB}MB processando...<br>
            ⏱️ ${elapsed}s decorridos, ~${remaining}s restantes<br>
            📱 Aguarde, arquivo grande no mobile
          `;
        }
      }, delay);
    });
  }
  
  return analysis;
}

// Validar progresso WAV
function validateWAVProgress() {
  if (typeof window !== 'undefined' && window.__WAV_PROCESSING_START__) {
    const elapsed = Date.now() - window.__WAV_PROCESSING_START__;
    const elapsedSeconds = Math.ceil(elapsed / 1000);
    
    console.log(`🎵 WAV processing progress: ${elapsedSeconds}s elapsed`);
    
    // Detectar possível travamento
    if (elapsed > 90000) { // >90s
      console.warn('⚠️ WAV processing taking longer than expected');
      
      const progressText = document.getElementById('audioProgressText');
      if (progressText) {
        progressText.innerHTML = `
          ⚠️ Processamento demorado detectado<br>
          🎵 WAV grande pode levar até 2 minutos<br>
          📱 Por favor, mantenha a tela ativa
        `;
      }
    }
  }
}

// Limpar otimizações WAV
function cleanupWAVOptimizations() {
  if (typeof window !== 'undefined') {
    delete window.__WAV_MOBILE_TIMEOUT__;
    delete window.__WAV_PROCESSING_START__;
  }
}

// Integração com sistema existente
if (typeof window !== 'undefined') {
  window.wavMobileOptimizer = {
    analyzeWAVFile,
    applyWAVOptimizations,
    showWAVProcessingFeedback,
    validateWAVProgress,
    cleanupWAVOptimizations,
    detectEnvironment,
    config: WAV_MOBILE_CONFIG
  };
  
  console.log('🎵 WAV Mobile Optimizer carregado');
}

export {
  analyzeWAVFile,
  applyWAVOptimizations,
  showWAVProcessingFeedback,
  validateWAVProgress,
  cleanupWAVOptimizations,
  detectEnvironment,
  WAV_MOBILE_CONFIG
};
