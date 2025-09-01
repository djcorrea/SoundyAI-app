/**
 * 🎵 SPECTRAL ANALYSIS TYPES
 * Definições de tipos para análise espectral e balanço tonal
 */

// Re-exportar tipos do spectralBalance
import type {
  SpectralBandConfig,
  SpectralBandResult,
  SpectralBalanceResult,
  SpectralBalanceConfig
} from './spectralBalance';

export type {
  SpectralBandConfig,
  SpectralBandResult,
  SpectralBalanceResult,
  SpectralBalanceConfig
};

/**
 * 📊 Resultado da análise de áudio completa
 */
export interface AudioAnalysisResult {
  // Métricas de loudness (mantidas)
  lufsIntegrated: number;
  lufsShortTerm: number;
  lufsMomentary: number;
  lra: number;
  
  // Métricas de peak (mantidas)
  truePeakDbtp: number;
  peakDbfs: number;
  
  // Métricas de dinâmica (mantidas)
  dynamicRange: number;
  dr?: number; // alias
  dr_stat?: number; // versão estatística
  crestFactor: number;
  
  // Métricas estéreo (mantidas)
  stereoCorrelation: number;
  stereoWidth: number;
  balanceLR: number;
  
  // ✨ NOVO: Análise espectral com energia e porcentagem
  spectralBalance?: SpectralBalanceResult;
  
  // Métricas espectrais individuais (mantidas para compatibilidade)
  spectralCentroid?: number;
  spectralRolloff85?: number;
  spectralRolloff50?: number;
  spectralFlatness?: number;
  
  // Métricas técnicas (mantidas)
  dcOffset?: number;
  dcOffsetLeft?: number;
  dcOffsetRight?: number;
  thdPercent?: number;
  clippingPct?: number;
  clippingSamples?: number;
  
  // Balanço tonal legacy (para compatibilidade)
  tonalBalance?: {
    sub?: { rms_db: number };
    low?: { rms_db: number };
    mid?: { rms_db: number };
    high?: { rms_db: number };
  };
  
  // ✨ NOVO: Energias por banda (compatível com sistema existente)
  bandEnergies?: {
    [bandName: string]: {
      rms_db: number;        // Mantido para compatibilidade UI
      energy?: number;       // Nova: energia linear
      energyPct?: number;    // Nova: porcentagem de energia
      hzLow?: number;        // Nova: frequência inferior
      hzHigh?: number;       // Nova: frequência superior
    };
  };
  
  // Metadados
  sampleRate: number;
  duration: number;
  channels: number;
  bitDepth?: number;
  format?: string;
}

/**
 * 🎯 Configuração para análise de balanço espectral
 */
export interface SpectralAnalysisConfig {
  // Configuração de bandas
  bandConfig?: SpectralBandConfig[];
  use3BandSummary?: boolean;
  
  // Configuração de FFT
  fftSize?: number;
  hopSize?: number;
  windowType?: 'hann' | 'hamming' | 'blackman' | 'rectangular';
  
  // Configuração de processamento
  maxFrames?: number;
  normalizeInput?: boolean;
  referenceDb?: number;
  
  // Compatibilidade
  generateLegacyFormats?: boolean;
  preserveDbValues?: boolean;
}

/**
 * 📈 Resultado de scoring espectral
 */
export interface SpectralScoringResult {
  // Score baseado em energia (interno)
  energyScore: number;
  energyBreakdown: {
    [bandName: string]: {
      targetPct: number;
      actualPct: number;
      deviation: number;
      score: number;
    };
  };
  
  // Score baseado em dB (UI)
  dbScore: number;
  dbBreakdown: {
    [bandName: string]: {
      targetDb: number;
      actualDb: number;
      tolerance: number;
      score: number;
    };
  };
  
  // Resumo
  overallScore: number;
  recommendation: string;
  criticalIssues: string[];
}

/**
 * 🎵 Referência por gênero musical
 */
export interface SpectralReference {
  // Identificação
  genre: string;
  subgenre?: string;
  
  // Targets em energia (para scoring interno)
  energyTargets?: {
    [bandName: string]: {
      targetPct: number;
      tolerancePct: number;
      weight: number;
    };
  };
  
  // Targets em dB (para UI e compatibilidade)
  bands?: {
    [bandName: string]: {
      target_db: number;
      tol_db?: number;
      tol_min?: number;
      tol_max?: number;
      toleranceDb?: number; // alias
    };
  };
  
  // Outros targets (mantidos)
  lufs_target?: number;
  tol_lufs?: number;
  tol_lufs_min?: number;
  tol_lufs_max?: number;
  
  dr_target?: number;
  tol_dr?: number;
  
  true_peak_target?: number;
  tol_true_peak?: number;
  
  stereo_target?: number;
  tol_stereo?: number;
  
  lra_target?: number;
  tol_lra?: number;
}

/**
 * 🔧 Estado da análise
 */
export interface AnalysisState {
  isAnalyzing: boolean;
  progress: number;
  stage: 'loading' | 'preprocessing' | 'loudness' | 'spectral' | 'scoring' | 'complete' | 'error';
  error?: string;
  warnings: string[];
}

/**
 * 🎛️ Configuração global do analisador
 */
export interface AnalyzerConfig {
  // Qualidade da análise
  quality: 'fast' | 'balanced' | 'accurate';
  
  // Features habilitadas
  enableSpectralBalance: boolean;
  enableAdvancedMetrics: boolean;
  enableScoring: boolean;
  
  // Configurações específicas
  spectral: SpectralAnalysisConfig;
  
  // Referência ativa
  activeReference?: SpectralReference;
  
  // Debug e logs
  debugMode: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

/**
 * 🎨 Status visual das métricas (para UI)
 */
export type MetricStatus = 'OK' | 'BAIXO' | 'ALTO';
export type MetricSeverity = 'leve' | 'media' | 'alta';

export interface MetricStatusInfo {
  status: MetricStatus;
  severity?: MetricSeverity;
  message?: string;
  suggestion?: string;
}

/**
 * 📊 Resultado de métrica individual
 */
export interface MetricResult {
  key: string;
  category: string;
  value: number;
  target: number;
  tolerance: number;
  score: number;
  statusInfo: MetricStatusInfo;
  unit: string;
  displayName: string;
}

/**
 * 🎯 Resultado de scoring completo
 */
export interface ScoringResult {
  // Score principal
  scorePct: number;
  classification: string;
  method: string;
  
  // Breakdown por categoria
  categories: {
    [category: string]: {
      weight: number;
      score: number;
    };
  };
  
  // Métricas individuais
  perMetric: MetricResult[];
  
  // Análise de cores (para UI)
  colorCounts?: {
    green: number;
    yellow: number;
    red: number;
    total: number;
  };
  
  // Informações adicionais
  highlights: {
    bestCategories: string[];
    worstCategories: string[];
    criticalIssues: string[];
    recommendations: string[];
  };
}

// Export de tipos utilitários
export type SpectralBandName = string;
export type FrequencyRange = [number, number];
export type EnergyValue = number;
export type DbValue = number;
