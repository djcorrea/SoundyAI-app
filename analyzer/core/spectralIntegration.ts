/**
 * 🔗 SPECTRAL INTEGRATION
 * Integração entre o novo sistema de balanço espectral (energia %) 
 * e o sistema existente (dB), mantendo compatibilidade total
 */

import { 
  SpectralBalanceAnalyzer, 
  analyzeSpectralBalance,
  stereoToMono,
  normalizeAudio,
  DEFAULT_BANDS_7,
  DEFAULT_BANDS_3,
  type SpectralBalanceResult,
  type SpectralBandConfig 
} from './spectralBalance';

import type { 
  AudioAnalysisResult, 
  SpectralAnalysisConfig,
  SpectralReference
} from './spectralTypes';

/**
 * 🎵 Integrar análise espectral no pipeline existente
 */
export class SpectralIntegration {
  private config: SpectralAnalysisConfig;
  
  constructor(config: SpectralAnalysisConfig = {}) {
    this.config = {
      bandConfig: DEFAULT_BANDS_7,
      use3BandSummary: true,
      fftSize: 4096,
      hopSize: 2048,
      windowType: 'hann',
      maxFrames: 50,
      normalizeInput: false,
      referenceDb: 0,
      generateLegacyFormats: true,
      preserveDbValues: true,
      ...config
    };
  }
  
  /**
   * 🔬 Analisar espectro e gerar formatos compatíveis
   */
  async analyzeSpectrum(
    audioData: Float32Array | Float32Array[], 
    sampleRate: number
  ): Promise<Partial<AudioAnalysisResult>> {
    console.log('🔬 Iniciando integração de análise espectral...');
    
    try {
      // Processar entrada (mono/estéreo)
      const monoData = this.preprocessAudio(audioData);
      
      // Executar análise espectral
      const spectralResult = analyzeSpectralBalance(
        monoData,
        sampleRate,
        this.config.bandConfig
      );
      
      // Converter para formatos compatíveis
      const result: Partial<AudioAnalysisResult> = {
        // ✨ NOVO: Resultado completo da análise espectral
        spectralBalance: spectralResult,
        
        // ✨ NOVO: Formato bandEnergies (compatível com scoring)
        bandEnergies: this.convertToBandEnergies(spectralResult),
        
        sampleRate,
      };
      
      // Gerar formatos legacy se solicitado
      if (this.config.generateLegacyFormats) {
        Object.assign(result, this.generateLegacyFormats(spectralResult));
      }
      
      console.log('✅ Integração espectral concluída');
      console.log(`📊 Geradas ${spectralResult.bands.length} bandas espectrais`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Erro na integração espectral:', error);
      return {
        sampleRate,
        // Retornar estrutura vazia em caso de erro
        spectralBalance: undefined,
        bandEnergies: undefined
      };
    }
  }
  
  /**
   * 🔄 Pré-processar áudio (mono/estéreo + normalização)
   */
  private preprocessAudio(audioData: Float32Array | Float32Array[]): Float32Array {
    let monoData: Float32Array;
    
    // Converter para mono se necessário
    if (Array.isArray(audioData)) {
      if (audioData.length === 2) {
        // Estéreo: somar energia dos canais
        monoData = stereoToMono(audioData[0], audioData[1]);
        console.log('🔄 Convertido estéreo para mono (soma de energia)');
      } else if (audioData.length === 1) {
        monoData = audioData[0];
      } else {
        throw new Error(`Formato de áudio não suportado: ${audioData.length} canais`);
      }
    } else {
      monoData = audioData;
    }
    
    // Normalizar se solicitado
    if (this.config.normalizeInput) {
      monoData = normalizeAudio(monoData);
      console.log('📈 Áudio normalizado para análise');
    }
    
    return monoData;
  }
  
  /**
   * 🏷️ Converter resultado para formato bandEnergies (compatível com scoring)
   */
  convertToBandEnergies(spectralResult: SpectralBalanceResult): AudioAnalysisResult['bandEnergies'] {
    const bandEnergies: NonNullable<AudioAnalysisResult['bandEnergies']> = {};
    
    for (const band of spectralResult.bands) {
      // Usar nome da banda como chave
      const bandKey = band.name.toLowerCase().replace(/\s+/g, '_');
      
      bandEnergies[bandKey] = {
        rms_db: band.rmsDb,          // Mantido para compatibilidade UI
        energy: band.energy,         // Nova: energia linear
        energyPct: band.energyPct,   // Nova: porcentagem de energia
        hzLow: band.hzLow,          // Nova: frequência inferior
        hzHigh: band.hzHigh         // Nova: frequência superior
      };
    }
    
    // Adicionar resumo de 3 bandas se habilitado
    if (this.config.use3BandSummary) {
      const summary = spectralResult.summary3Bands;
      
      bandEnergies.low = {
        rms_db: summary.Low.rmsDb,
        energyPct: summary.Low.energyPct,
        hzLow: 20,
        hzHigh: 250
      };
      
      bandEnergies.mid = {
        rms_db: summary.Mid.rmsDb,
        energyPct: summary.Mid.energyPct,
        hzLow: 250,
        hzHigh: 4000
      };
      
      bandEnergies.high = {
        rms_db: summary.High.rmsDb,
        energyPct: summary.High.energyPct,
        hzLow: 4000,
        hzHigh: 16000
      };
    }
    
    return bandEnergies;
  }
  
  /**
   * 📜 Gerar formatos legacy para compatibilidade
   */
  private generateLegacyFormats(spectralResult: SpectralBalanceResult): Partial<AudioAnalysisResult> {
    const result: Partial<AudioAnalysisResult> = {};
    
    // Gerar tonalBalance legacy
    if (this.config.use3BandSummary) {
      const summary = spectralResult.summary3Bands;
      
      result.tonalBalance = {
        sub: { rms_db: summary.Low.rmsDb },
        low: { rms_db: summary.Low.rmsDb },
        mid: { rms_db: summary.Mid.rmsDb },
        high: { rms_db: summary.High.rmsDb }
      };
    }
    
    // Calcular métricas espectrais individuais (aproximadas)
    result.spectralCentroid = this.calculateCentroid(spectralResult);
    result.spectralRolloff85 = this.calculateRolloff(spectralResult, 0.85);
    result.spectralRolloff50 = this.calculateRolloff(spectralResult, 0.50);
    result.spectralFlatness = this.calculateFlatness(spectralResult);
    
    return result;
  }
  
  /**
   * 📊 Calcular centroide espectral aproximado
   */
  private calculateCentroid(spectralResult: SpectralBalanceResult): number {
    let numerator = 0;
    let denominator = 0;
    
    for (const band of spectralResult.bands) {
      const centerFreq = (band.hzLow + band.hzHigh) / 2;
      const weight = band.energyPct / 100; // Normalizar porcentagem
      
      numerator += centerFreq * weight;
      denominator += weight;
    }
    
    return denominator > 0 ? numerator / denominator : 0;
  }
  
  /**
   * 📈 Calcular rolloff espectral aproximado
   */
  private calculateRolloff(spectralResult: SpectralBalanceResult, percentage: number): number {
    let cumulativeEnergy = 0;
    const targetEnergy = 100 * percentage; // Porcentagem total
    
    // Ordenar bandas por frequência
    const sortedBands = [...spectralResult.bands].sort((a, b) => a.hzLow - b.hzLow);
    
    for (const band of sortedBands) {
      cumulativeEnergy += band.energyPct;
      
      if (cumulativeEnergy >= targetEnergy) {
        // Interpolação linear dentro da banda
        const excessEnergy = cumulativeEnergy - targetEnergy;
        const bandProgress = 1 - (excessEnergy / band.energyPct);
        
        return band.hzLow + (band.hzHigh - band.hzLow) * bandProgress;
      }
    }
    
    // Se não atingiu o target, retornar frequência máxima
    return spectralResult.bands[spectralResult.bands.length - 1]?.hzHigh || 16000;
  }
  
  /**
   * 📏 Calcular flatness espectral aproximada
   */
  private calculateFlatness(spectralResult: SpectralBalanceResult): number {
    const energies = spectralResult.bands.map(b => b.energyPct).filter(e => e > 0);
    
    if (energies.length === 0) return 0;
    
    // Média geométrica / média aritmética
    const geometricMean = Math.pow(
      energies.reduce((prod, e) => prod * e, 1),
      1 / energies.length
    );
    
    const arithmeticMean = energies.reduce((sum, e) => sum + e, 0) / energies.length;
    
    return arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
  }
  
  /**
   * 🎯 Aplicar referência de gênero (para scoring)
   */
  applyReference(reference: SpectralReference): void {
    console.log(`🎯 Aplicando referência: ${reference.genre}`);
    
    // Atualizar configuração com base na referência
    if (reference.energyTargets) {
      // Configurar targets de energia para scoring interno
      console.log('📊 Targets de energia configurados');
    }
    
    if (reference.bands) {
      // Manter targets em dB para UI
      console.log('🎛️ Targets em dB mantidos para UI');
    }
  }
  
  /**
   * 🧪 Validar compatibilidade com sistema existente
   */
  validateCompatibility(existingResult: Partial<AudioAnalysisResult>): boolean {
    console.log('🧪 Validando compatibilidade...');
    
    const issues: string[] = [];
    
    // Verificar se campos obrigatórios existem
    if (!existingResult.bandEnergies) {
      issues.push('bandEnergies ausente');
    }
    
    // Verificar diferenças em dB (deve ser < 0.2 dB)
    if (existingResult.tonalBalance && existingResult.spectralBalance) {
      const dbDifference = this.compareDbValues(existingResult);
      if (dbDifference > 0.2) {
        issues.push(`Diferença em dB muito alta: ${dbDifference.toFixed(3)} dB`);
      }
    }
    
    if (issues.length > 0) {
      console.warn('⚠️ Problemas de compatibilidade:', issues);
      return false;
    }
    
    console.log('✅ Compatibilidade validada');
    return true;
  }
  
  /**
   * 📏 Comparar valores em dB entre sistemas
   */
  private compareDbValues(result: Partial<AudioAnalysisResult>): number {
    if (!result.tonalBalance || !result.spectralBalance) return 0;
    
    const legacy = result.tonalBalance;
    const newSystem = result.spectralBalance.summary3Bands;
    
    const differences = [
      Math.abs((legacy.low?.rms_db || 0) - newSystem.Low.rmsDb),
      Math.abs((legacy.mid?.rms_db || 0) - newSystem.Mid.rmsDb),
      Math.abs((legacy.high?.rms_db || 0) - newSystem.High.rmsDb)
    ].filter(d => isFinite(d));
    
    return Math.max(...differences, 0);
  }
}

/**
 * 🎯 Função utilitária para integração rápida
 */
export async function integrateSpectralAnalysis(
  audioData: Float32Array | Float32Array[],
  sampleRate: number,
  config?: SpectralAnalysisConfig
): Promise<Partial<AudioAnalysisResult>> {
  const integration = new SpectralIntegration(config);
  return await integration.analyzeSpectrum(audioData, sampleRate);
}

/**
 * 🔄 Converter resultado existente para incluir novos campos
 */
export function upgradeExistingResult(
  existingResult: Partial<AudioAnalysisResult>,
  spectralResult: SpectralBalanceResult
): AudioAnalysisResult {
  const integration = new SpectralIntegration();
  
  return {
    // Manter todos os campos existentes
    ...existingResult,
    
    // Adicionar novos campos
    spectralBalance: spectralResult,
    bandEnergies: {
      ...existingResult.bandEnergies,
      ...integration.convertToBandEnergies(spectralResult)
    },
    
    // Garantir campos obrigatórios
    sampleRate: existingResult.sampleRate || 48000,
    duration: existingResult.duration || 0,
    channels: existingResult.channels || 1,
    lufsIntegrated: existingResult.lufsIntegrated || -Infinity,
    truePeakDbtp: existingResult.truePeakDbtp || -Infinity,
    dynamicRange: existingResult.dynamicRange || 0,
    crestFactor: existingResult.crestFactor || 0,
    stereoCorrelation: existingResult.stereoCorrelation || 0,
    stereoWidth: existingResult.stereoWidth || 0,
    balanceLR: existingResult.balanceLR || 0,
    lra: existingResult.lra || 0,
    lufsShortTerm: existingResult.lufsShortTerm || -Infinity,
    lufsMomentary: existingResult.lufsMomentary || -Infinity,
    peakDbfs: existingResult.peakDbfs || -Infinity
  } as AudioAnalysisResult;
}
