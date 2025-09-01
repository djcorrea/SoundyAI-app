// 🎵 AUDIO ANALYSIS SCHEMA V2 - PHASE 2
// Schema de validação com 12 métricas core implementadas

import { z } from 'zod';

// 📊 Constants - Updated for Phase 2
export const ANALYSIS_CONSTANTS = {
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB
  MAX_DURATION: 600, // 10 minutos
  MIN_DURATION: 0.1, // 100ms
  SUPPORTED_FORMATS: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'webm'],
  SAMPLE_RATES: [22050, 44100, 48000, 88200, 96000],
  FREQUENCY_BANDS: {
    sub: [20, 60],
    bass: [60, 250],
    'low-mid': [250, 500],
    mid: [500, 2000],
    'high-mid': [2000, 4000],
    high: [4000, 8000],
    air: [8000, 20000]
  },
  QUALITY_THRESHOLDS: {
    excellent: 90,
    good: 75,
    fair: 60,
    poor: 45
  }
};

// Schema para frequências dominantes
const DominantFrequencySchema = z.object({
  frequency: z.number().min(20).max(20000).describe('Frequência em Hz'),
  magnitude: z.number().min(0).max(1).describe('Magnitude normalizada'),
  occurrences: z.number().int().min(1).describe('Número de ocorrências'),
  band: z.enum(['sub', 'bass', 'low-mid', 'mid', 'high-mid', 'high', 'air']).optional()
});

// Schema para problemas detectados
const ProblemSchema = z.object({
  type: z.enum([
    'clipping', 'low_volume', 'over_compressed', 'dc_offset', 
    'muddy_mids', 'harsh_highs', 'phase_issues', 'mono_content'
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  message: z.string().min(10).max(200),
  solution: z.string().min(10).max(300),
  frequency: z.number().optional().describe('Frequência problemática em Hz'),
  timestamp: z.number().optional().describe('Momento no áudio em segundos')
});

// Schema para sugestões
const SuggestionSchema = z.object({
  type: z.enum([
    'mastering', 'eq', 'compression', 'limiting', 'stereo_enhancement',
    'bass_enhancement', 'brightness', 'dynamics', 'phase_correction'
  ]),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  message: z.string().min(10).max(200),
  action: z.string().min(10).max(300),
  parameters: z.record(z.string(), z.union([z.string(), z.number()])).optional()
});

// Schema para métricas core (sempre disponíveis)
const CoreMetricsSchema = z.object({
  // Básicos
  peak: z.number().describe('Peak level em dBFS'),
  truePeak: z.number().optional().describe('True Peak com oversampling'),
  rms: z.number().describe('RMS level em dBFS'),
  dynamicRange: z.number().min(0).describe('Dynamic range em dB'),
  crestFactor: z.number().min(1).describe('Crest factor'),
  
  // DC e Clipping
  dcOffset: z.number().describe('DC offset'),
  clippingEvents: z.number().int().min(0).describe('Número de samples com clipping'),
  clippingPercentage: z.number().min(0).max(100).describe('Percentual de clipping'),
  
  // Frequências
  dominantFrequencies: z.array(DominantFrequencySchema).max(10),
  spectralCentroid: z.number().optional().describe('Centroide espectral em Hz'),
  spectralRolloff: z.number().optional().describe('Rolloff frequency em Hz'),
  spectralFlux: z.number().optional().describe('Flux espectral normalizado'),
  spectralFlatness: z.number().optional().describe('Flatness espectral')
});

// Schema para métricas estéreo
const StereoMetricsSchema = z.object({
  correlation: z.number().min(-1).max(1).describe('Correlação estéreo'),
  width: z.number().min(0).max(2).describe('Largura estéreo'),
  balance: z.number().min(-1).max(1).describe('Balance L/R'),
  monoCompatibility: z.enum(['excellent', 'good', 'fair', 'poor']),
  phaseIssues: z.boolean().describe('Problemas de fase detectados')
});

// Schema para métricas de loudness (avançadas)
const LoudnessMetricsSchema = z.object({
  lufsIntegrated: z.number().optional().describe('LUFS integrado'),
  lufsShortTerm: z.number().optional().describe('LUFS short-term'),
  lufsMomentary: z.number().optional().describe('LUFS momentary'),
  lra: z.number().optional().describe('Loudness Range'),
  headroom: z.number().describe('Headroom disponível em dB')
});

// Schema para análise tonal
const TonalMetricsSchema = z.object({
  key: z.string().optional().describe('Tonalidade detectada (ex: A, Bb)'),
  scale: z.enum(['major', 'minor', 'unknown']).optional(),
  keyConfidence: z.number().min(0).max(1).optional(),
  bpm: z.number().optional().describe('BPM detectado'),
  bpmConfidence: z.number().min(0).max(1).optional()
});

// Schema para análise de mascaramento
const MaskingAnalysisSchema = z.object({
  kickBassMasking: z.object({
    index: z.number().min(0).max(1).describe('Índice de mascaramento'),
    overlap: z.enum(['none', 'slight', 'moderate', 'severe']),
    sidechainSuggested: z.boolean(),
    criticalFrequencies: z.array(z.number()).max(5),
    recommendation: z.string().optional()
  }).optional()
});

// Schema para scores e qualidade
const QualityScoresSchema = z.object({
  overall: z.number().int().min(0).max(100).describe('Score geral 0-100'),
  breakdown: z.object({
    dynamics: z.number().int().min(0).max(100),
    frequency: z.number().int().min(0).max(100),
    stereo: z.number().int().min(0).max(100),
    loudness: z.number().int().min(0).max(100),
    technical: z.number().int().min(0).max(100)
  }),
  colorization: z.object({
    hue: z.string().describe('Cor musical principal'),
    mood: z.enum(['dark', 'neutral', 'bright', 'warm', 'cold']),
    character: z.string().optional()
  }).optional()
});

// Schema principal para metadados
const AudioMetadataSchema = z.object({
  duration: z.number().min(0).describe('Duração em segundos'),
  sampleRate: z.number().int().min(8000).max(192000),
  channels: z.number().int().min(1).max(8),
  bitDepth: z.number().int().optional(),
  fileSize: z.number().int().min(0).describe('Tamanho em bytes'),
  format: z.string().optional(),
  codec: z.string().optional()
});

// Schema para configurações de análise
const AnalysisConfigSchema = z.object({
  features: z.array(z.enum([
    'core', 'spectral', 'stereo', 'loudness', 'tonal', 'masking', 'quality'
  ])).default(['core']),
  quality: z.enum(['fast', 'balanced', 'accurate']).default('balanced'),
  advancedMetrics: z.boolean().default(false),
  customSettings: z.record(z.string(), z.unknown()).optional()
});

// Schema principal da resposta da API
export const AudioAnalysisResponseSchema = z.object({
  success: z.boolean(),
  version: z.string().default('2.0'),
  timestamp: z.string().datetime(),
  processingTime: z.number().min(0).describe('Tempo de processamento em ms'),
  
  metadata: AudioMetadataSchema,
  config: AnalysisConfigSchema,
  
  metrics: z.object({
    core: CoreMetricsSchema,
    stereo: StereoMetricsSchema.optional(),
    loudness: LoudnessMetricsSchema.optional(),
    tonal: TonalMetricsSchema.optional(),
    masking: MaskingAnalysisSchema.optional(),
    quality: QualityScoresSchema.optional()
  }),
  
  diagnostics: z.object({
    problems: z.array(ProblemSchema),
    suggestions: z.array(SuggestionSchema),
    feedback: z.array(z.string()).max(5).describe('Feedback textual curto')
  }),
  
  // Para debugging
  debug: z.object({
    analysisSteps: z.array(z.string()),
    warnings: z.array(z.string()),
    performance: z.record(z.string(), z.number())
  }).optional()
});

// Schema para request da API
export const AudioAnalysisRequestSchema = z.object({
  config: AnalysisConfigSchema.optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional()
});

// Esquemas exportados para validação
// Para usar os tipos em TypeScript, importe os schemas e use z.infer<typeof Schema>

// Funções de validação
export function validateAnalysisResponse(data) {
  try {
    return {
      success: true,
      data: AudioAnalysisResponseSchema.parse(data)
    };
  } catch (error) {
    return {
      success: false,
      error: error.errors || error.message
    };
  }
}

export function validateAnalysisRequest(data) {
  try {
    return {
      success: true,
      data: AudioAnalysisRequestSchema.parse(data)
    };
  } catch (error) {
    return {
      success: false,
      error: error.errors || error.message
    };
  }
}

// 📊 Constants - Updated for Phase 2 
export const ANALYSIS_CONSTANTS = {
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB
  MAX_DURATION: 600, // 10 minutos
  MIN_DURATION: 0.1, // 100ms
  SUPPORTED_FORMATS: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'webm'],
  SAMPLE_RATES: [22050, 44100, 48000, 88200, 96000],
  FREQUENCY_BANDS: {
    sub: [20, 60],
    bass: [60, 250],
    'low-mid': [250, 500],
    mid: [500, 2000],
    'high-mid': [2000, 4000],
    high: [4000, 8000],
    air: [8000, 20000]
  },
  QUALITY_THRESHOLDS: {
    excellent: 90,
    good: 75,
    fair: 60,
    poor: 45
  }
};

console.log('🎵 Audio Analysis Schema V2 - Phase 2 loaded');
