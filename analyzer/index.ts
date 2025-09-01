/**
 * 🎵 AI-SYNTH ANALYZER
 * Módulo principal do analisador de áudio com suporte a balanço espectral avançado
 */

// Exportar todas as classes e funções principais
export {
  SpectralBalanceAnalyzer,
  analyzeSpectralBalance,
  stereoToMono,
  normalizeAudio,
  DEFAULT_BANDS_7 as DEFAULT_BANDS,
  DEFAULT_BANDS_3,
  type SpectralBandConfig,
  type SpectralBandResult,
  type SpectralBalanceResult,
  type SpectralBalanceConfig
} from './core/spectralBalance';

export {
  SpectralIntegration,
  integrateSpectralAnalysis,
  upgradeExistingResult
} from './core/spectralIntegration';

export type {
  AudioAnalysisResult,
  SpectralAnalysisConfig,
  SpectralReference,
  AnalysisState,
  AnalyzerConfig,
  MetricStatus,
  MetricSeverity,
  MetricStatusInfo,
  MetricResult,
  ScoringResult,
  SpectralScoringResult,
  SpectralBandName,
  FrequencyRange,
  EnergyValue,
  DbValue
} from './core/spectralTypes';

// Importar tipos para uso interno
import type {
  AudioAnalysisResult,
  SpectralAnalysisConfig,
  SpectralReference,
  AnalyzerConfig
} from './core/spectralTypes';

import { SpectralIntegration } from './core/spectralIntegration';

// Exportar testes (para desenvolvimento)
export {
  runAllTests,
  testSinePurity,
  testWhiteNoiseDistribution,
  testCompatibility,
  testDbStability,
  exampleUsage,
  generateSineWave,
  generateWhiteNoise
} from './tests/synthetic';

/**
 * 🎯 Versão e informações do módulo
 */
export const VERSION = '1.0.0';
export const MODULE_NAME = 'AI-Synth Spectral Analyzer';

/**
 * 🔧 Configuração padrão do analisador
 */
export const DEFAULT_ANALYZER_CONFIG: AnalyzerConfig = {
  quality: 'balanced',
  enableSpectralBalance: true,
  enableAdvancedMetrics: true,
  enableScoring: true,
  spectral: {
    fftSize: 4096,
    hopSize: 2048,
    windowType: 'hann',
    maxFrames: 50,
    normalizeInput: false,
    referenceDb: 0,
    generateLegacyFormats: true,
    preserveDbValues: true,
    use3BandSummary: true
  },
  debugMode: false,
  logLevel: 'info'
};

/**
 * 🎵 Classe principal do analisador
 */
export class AudioAnalyzer {
  private config: AnalyzerConfig;
  private spectralIntegration: SpectralIntegration;
  
  constructor(config: Partial<AnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_ANALYZER_CONFIG, ...config };
    this.spectralIntegration = new SpectralIntegration(this.config.spectral);
    
    if (this.config.debugMode) {
      console.log('🎵 AudioAnalyzer iniciado:', {
        version: VERSION,
        config: this.config
      });
    }
  }
  
  /**
   * 🔬 Analisar áudio completo
   */
  async analyzeAudio(
    audioData: Float32Array | Float32Array[],
    sampleRate: number = 48000
  ): Promise<Partial<AudioAnalysisResult>> {
    const startTime = Date.now();
    
    try {
      if (this.config.debugMode) {
        console.log('🔬 Iniciando análise de áudio...');
      }
      
      const result: Partial<AudioAnalysisResult> = {
        sampleRate,
        channels: Array.isArray(audioData) ? audioData.length : 1,
        duration: Array.isArray(audioData) 
          ? audioData[0].length / sampleRate 
          : audioData.length / sampleRate
      };
      
      // Análise espectral (se habilitada)
      if (this.config.enableSpectralBalance) {
        const spectralResult = await this.spectralIntegration.analyzeSpectrum(
          audioData, 
          sampleRate
        );
        
        Object.assign(result, spectralResult);
      }
      
      // TODO: Integrar outras análises (LUFS, DR, etc.) quando necessário
      
      const processingTime = Date.now() - startTime;
      
      if (this.config.debugMode) {
        console.log(`✅ Análise concluída em ${processingTime}ms`);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Erro na análise de áudio:', error);
      throw error;
    }
  }
  
  /**
   * 🎯 Aplicar referência de gênero
   */
  setReference(reference: SpectralReference): void {
    this.config.activeReference = reference;
    this.spectralIntegration.applyReference(reference);
    
    if (this.config.debugMode) {
      console.log('🎯 Referência aplicada:', reference.genre);
    }
  }
  
  /**
   * ⚙️ Atualizar configuração
   */
  updateConfig(newConfig: Partial<AnalyzerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Recriar integração espectral se necessário
    if (newConfig.spectral) {
      this.spectralIntegration = new SpectralIntegration(this.config.spectral);
    }
  }
  
  /**
   * 📊 Obter estatísticas do analisador
   */
  getStats(): object {
    return {
      version: VERSION,
      config: this.config,
      features: {
        spectralBalance: this.config.enableSpectralBalance,
        advancedMetrics: this.config.enableAdvancedMetrics,
        scoring: this.config.enableScoring
      }
    };
  }
}

/**
 * 🚀 Função utilitária para análise rápida
 */
export async function quickAnalyze(
  audioData: Float32Array | Float32Array[],
  sampleRate: number = 48000,
  options: Partial<AnalyzerConfig> = {}
): Promise<Partial<AudioAnalysisResult>> {
  const analyzer = new AudioAnalyzer(options);
  return await analyzer.analyzeAudio(audioData, sampleRate);
}

/**
 * 🧪 Função para executar testes de validação
 */
export async function validateSystem(): Promise<boolean> {
  try {
    console.log('🧪 Validando sistema de análise espectral...');
    const { runAllTests } = await import('./tests/synthetic');
    await runAllTests();
    console.log('✅ Sistema validado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Falha na validação do sistema:', error);
    return false;
  }
}

/**
 * 🔧 Utilitários para debug
 */
export const debug = {
  /**
   * Testar com sinal senoidal
   */
  testSine: async (frequency: number = 1000, duration: number = 1.0) => {
    const { generateSineWave } = await import('./tests/synthetic');
    const signal = generateSineWave(frequency, duration);
    return await quickAnalyze(signal);
  },
  
  /**
   * Testar com ruído branco
   */
  testNoise: async (duration: number = 1.0) => {
    const { generateWhiteNoise } = await import('./tests/synthetic');
    const signal = generateWhiteNoise(duration);
    return await quickAnalyze(signal);
  },
  
  /**
   * Validar compatibilidade
   */
  testCompatibility: async () => {
    const { testCompatibility } = await import('./tests/synthetic');
    return await testCompatibility();
  }
};

// Log de inicialização
if (typeof console !== 'undefined') {
  console.log(`🎵 ${MODULE_NAME} v${VERSION} carregado`);
}
