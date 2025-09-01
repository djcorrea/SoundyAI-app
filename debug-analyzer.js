// 🔍 DEBUG ANALYZER - Sistema de diagnóstico para audio-analyzer.js
// Criado para resolver erro 404 reportado em index.html

console.log('🔍 Debug Analyzer carregado');

// Sistema de diagnóstico básico
window.debugAnalyzer = {
  version: '1.0.0',
  loaded: true,
  
  // Verificar se o AudioAnalyzer está funcionando
  checkAudioAnalyzer() {
    const checks = {
      audioAnalyzerExists: typeof window.audioAnalyzer !== 'undefined',
      audioAnalyzerReady: window.audioAnalyzer?._v2Loaded || false,
      webAudioSupport: typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined',
      fileAPISupport: typeof FileReader !== 'undefined'
    };
    
    console.log('🔍 Debug Analyzer - Verificações:', checks);
    return checks;
  },
  
  // Log de status
  logStatus() {
    console.log('🔍 Debug Analyzer - Status:', {
      timestamp: new Date().toISOString(),
      checks: this.checkAudioAnalyzer()
    });
  }
};

// Auto-verificação ao carregar
if (typeof window !== 'undefined') {
  window.debugAnalyzer.logStatus();
}
