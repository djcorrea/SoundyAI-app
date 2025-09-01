#!/usr/bin/env node

/**
 * 🔍 AUDIT REFS INCONSISTÊNCIAS - Script de auditoria para detectar causa raiz
 * dos valores inconsistentes nas bandas espectrais após normalização LUFS
 * 
 * PROBLEMA IDENTIFICADO: Bandas com valores positivos altos (+26.8 dB) fisicamente
 * impossíveis para sinal normalizado a -18 LUFS
 * 
 * Hipóteses a investigar:
 * 1. Média em dB sendo feita aritmeticamente (erro: média_dB != dB_da_média)
 * 2. Math.abs() sendo aplicado onde não deveria
 * 3. Offset de referência sendo somado incorretamente
 * 4. Métricas extraídas do buffer original (não normalizado)
 * 5. Conversão linear ↔ dB com erro de escala/offset
 * 6. RMS calculado incorretamente no domínio da frequência
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Importar módulos para auditoria
const { WAVDecoder, LUFSNormalizer, SpectralMetricsCalculator } = require('./refs-normalize-and-rebuild.cjs');
const loudnessUtils = require('./loudness-utils.cjs');
const spectralUtils = require('./spectral-utils.cjs');

// Configuração da auditoria
const AUDIT_CONFIG = {
  genre: 'funk_mandela',
  maxTracksToAudit: 3,
  inputDir: 'REFs',
  outputDir: 'public/refs/out',
  lufsTarget: -18.0,
  truePeakCeiling: -1.0,
  logLevel: 'DEBUG'
};

// Sistema de logs detalhado
class AuditLogger {
  constructor() {
    this.findings = [];
    this.measurements = [];
    this.warnings = [];
  }

  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const entry = { timestamp, level, message, ...data };
    
    console.log(`[${level}] ${message}`);
    if (Object.keys(data).length > 0) {
      console.log('    ', JSON.stringify(data, null, 2));
    }
    
    if (level === 'FINDING') this.findings.push(entry);
    if (level === 'MEASUREMENT') this.measurements.push(entry);
    if (level === 'WARNING') this.warnings.push(entry);
  }

  finding(message, data) { this.log('FINDING', message, data); }
  measurement(message, data) { this.log('MEASUREMENT', message, data); }
  warning(message, data) { this.log('WARNING', message, data); }
  info(message, data) { this.log('INFO', message, data); }
  debug(message, data) { this.log('DEBUG', message, data); }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 RELATÓRIO DE AUDITORIA - INCONSISTÊNCIAS NAS REFERÊNCIAS');
    console.log('='.repeat(80));
    
    console.log(`\n📊 RESUMO:`);
    console.log(`   Findings: ${this.findings.length}`);
    console.log(`   Measurements: ${this.measurements.length}`);
    console.log(`   Warnings: ${this.warnings.length}`);
    
    if (this.findings.length > 0) {
      console.log(`\n🔍 FINDINGS CRÍTICOS:`);
      this.findings.forEach((finding, i) => {
        console.log(`   ${i + 1}. ${finding.message}`);
        if (finding.data) {
          Object.entries(finding.data).forEach(([key, value]) => {
            console.log(`      ${key}: ${JSON.stringify(value)}`);
          });
        }
      });
    }
    
    if (this.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS:`);
      this.warnings.forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning.message}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
  }
}

// Auditor principal
class RefsInconsistencyAuditor {
  constructor(config) {
    this.config = config;
    this.logger = new AuditLogger();
    this.normalizer = new LUFSNormalizer(config.lufsTarget, config.truePeakCeiling);
    this.spectralCalculator = new SpectralMetricsCalculator();
  }

  async runAudit() {
    this.logger.info('🔍 INICIANDO AUDITORIA DE INCONSISTÊNCIAS', {
      genre: this.config.genre,
      maxTracks: this.config.maxTracksToAudit
    });

    // 1. Carregar JSON atual e verificar valores problemáticos
    await this._auditCurrentJSON();

    // 2. Processar algumas faixas WAV e rastrear pipeline
    await this._auditWAVProcessing();

    // 3. Verificar implementações de cálculo de média
    await this._auditAveragingMethods();

    // 4. Testar unidades e conversões
    await this._auditUnitsAndConversions();

    // 5. Comparar com valores esperados
    await this._auditExpectedRanges();

    this.logger.generateReport();
    return this.logger.findings;
  }

  async _auditCurrentJSON() {
    this.logger.info('📄 AUDITANDO JSON ATUAL');
    
    const jsonPath = path.join(this.config.outputDir, `${this.config.genre}.json`);
    if (!fs.existsSync(jsonPath)) {
      this.logger.warning('JSON não encontrado', { path: jsonPath });
      return;
    }

    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const genreData = jsonData[this.config.genre];
    
    if (!genreData || !genreData.legacy_compatibility || !genreData.legacy_compatibility.bands) {
      this.logger.warning('Estrutura de bandas não encontrada no JSON');
      return;
    }

    const bands = genreData.legacy_compatibility.bands;
    
    this.logger.measurement('JSON - Valores das bandas atuais', { bands });

    // VERIFICAÇÃO 1: Detectar valores fisicamente impossíveis
    Object.entries(bands).forEach(([bandName, bandData]) => {
      const targetDb = bandData.target_db;
      
      // Para sinal normalizado a -18 LUFS, nenhuma banda deveria ter RMS > -10 dB
      if (targetDb > -6) {
        this.logger.finding(`BANDA ${bandName}: Valor impossível (+${targetDb} dB)`, {
          bandName,
          targetDb,
          expectedRange: '[-60, -10] dB para LUFS -18',
          possibleCause: 'Média em dB incorreta ou offset de referência'
        });
      }
      
      // Valores positivos são definitivamente impossíveis
      if (targetDb > 0) {
        this.logger.finding(`BANDA ${bandName}: Valor positivo impossível (+${targetDb} dB)`, {
          bandName,
          targetDb,
          severity: 'CRÍTICO',
          possibleCause: 'Math.abs() aplicado incorretamente ou conversão linear→dB com erro'
        });
      }
    });

    // VERIFICAÇÃO 2: Verificar soma de energia
    const totalEnergyPct = Object.values(bands).reduce((sum, band) => sum + band.energy_pct, 0);
    if (Math.abs(totalEnergyPct - 100.0) > 0.1) {
      this.logger.finding('Energia total das bandas != 100%', {
        totalEnergyPct,
        expectedTotal: 100.0,
        difference: totalEnergyPct - 100.0
      });
    }

    // VERIFICAÇÃO 3: Verificar coerência LUFS vs bandas
    const lufsTarget = genreData.legacy_compatibility.lufs_target;
    this.logger.measurement('LUFS target vs bandas', {
      lufsTarget,
      bandsSeemConsistent: Object.values(bands).every(b => b.target_db < -6)
    });
  }

  async _auditWAVProcessing() {
    this.logger.info('🎵 AUDITANDO PROCESSAMENTO DE WAV');
    
    const genreDir = path.join(this.config.inputDir, this.config.genre);
    if (!fs.existsSync(genreDir)) {
      this.logger.warning('Diretório do gênero não encontrado', { path: genreDir });
      return;
    }

    const wavFiles = fs.readdirSync(genreDir)
      .filter(file => file.toLowerCase().endsWith('.wav'))
      .slice(0, this.config.maxTracksToAudit);

    for (const wavFile of wavFiles) {
      await this._auditSingleTrack(path.join(genreDir, wavFile));
    }
  }

  async _auditSingleTrack(filePath) {
    const fileName = path.basename(filePath);
    this.logger.info(`🎯 AUDITANDO FAIXA: ${fileName}`);

    try {
      // STEP 1: Decodificar WAV
      const audioData = await WAVDecoder.readWAVFile(filePath);
      const { left, right, sampleRate } = audioData;
      
      this.logger.measurement('Áudio decodificado', {
        fileName,
        sampleRate,
        duration: (left.length / sampleRate).toFixed(2) + 's',
        channels: audioData.channels
      });

      // STEP 2: Medir LUFS original
      const originalAnalysis = await this.normalizer.analyzer.measureLoudnessAndTruePeak(left, right, sampleRate);
      
      this.logger.measurement('Métricas originais', {
        fileName,
        lufs_original: originalAnalysis.lufsIntegrated.toFixed(2),
        truePeak_original: originalAnalysis.truePeakDbtp.toFixed(2),
        lra_original: originalAnalysis.lra.toFixed(2)
      });

      // STEP 3: Calcular ganho de normalização
      const normPlan = loudnessUtils.calculateNormalizationGain(
        originalAnalysis.lufsIntegrated,
        this.config.lufsTarget,
        originalAnalysis.truePeakDbtp,
        this.config.truePeakCeiling
      );

      this.logger.measurement('Plano de normalização', {
        fileName,
        gainDb: normPlan.gainDb.toFixed(2),
        limitedByTruePeak: normPlan.limitedByTruePeak,
        reduction: normPlan.reduction?.toFixed(2)
      });

      // STEP 4: Aplicar ganho estático
      const { normalizedLeft, normalizedRight } = loudnessUtils.applyStaticGain(
        left, right, normPlan.gainDb
      );

      // STEP 5: Verificar LUFS pós-normalização
      const normalizedAnalysis = await this.normalizer.analyzer.measureLoudnessAndTruePeak(
        normalizedLeft, normalizedRight, sampleRate
      );

      this.logger.measurement('Métricas pós-normalização', {
        fileName,
        lufs_normalized: normalizedAnalysis.lufsIntegrated.toFixed(2),
        truePeak_normalized: normalizedAnalysis.truePeakDbtp.toFixed(2),
        target_achieved: Math.abs(normalizedAnalysis.lufsIntegrated - this.config.lufsTarget) < 0.5
      });

      // STEP 6: CRÍTICO - Calcular métricas espectrais no SINAL NORMALIZADO
      this.logger.info('🎼 CALCULANDO MÉTRICAS ESPECTRAIS (sinal normalizado)');
      
      // 6a. Verificar qual sinal está sendo usado para análise espectral
      const spectralOnOriginal = this.spectralCalculator.calculateSpectralMetrics(left, right, sampleRate);
      const spectralOnNormalized = this.spectralCalculator.calculateSpectralMetrics(normalizedLeft, normalizedRight, sampleRate);

      this.logger.measurement('Comparação espectral: Original vs Normalizado', {
        fileName,
        original: this._summarizeBands(spectralOnOriginal),
        normalized: this._summarizeBands(spectralOnNormalized),
        gainDb: normPlan.gainDb.toFixed(2)
      });

      // STEP 7: CRÍTICO - Verificar se a diferença é exatamente o ganho aplicado
      this._auditSpectralGainConsistency(spectralOnOriginal, spectralOnNormalized, normPlan.gainDb, fileName);

      // STEP 8: Testar diferentes implementações espectrais
      await this._auditSpectralImplementations(normalizedLeft, normalizedRight, sampleRate, fileName);

    } catch (error) {
      this.logger.warning(`Erro ao auditar faixa ${fileName}`, { error: error.message });
    }
  }

  _summarizeBands(spectralMetrics) {
    const summary = {};
    Object.entries(spectralMetrics).forEach(([bandName, bandData]) => {
      if (bandData && typeof bandData.rms_db === 'number') {
        summary[bandName] = {
          rms_db: bandData.rms_db.toFixed(1),
          energy_pct: bandData.energy_pct?.toFixed(1) || 'N/A'
        };
      }
    });
    return summary;
  }

  _auditSpectralGainConsistency(originalSpectral, normalizedSpectral, gainDb, fileName) {
    this.logger.info('🔍 VERIFICANDO CONSISTÊNCIA DO GANHO ESPECTRAL');

    Object.keys(originalSpectral).forEach(bandName => {
      const originalRms = originalSpectral[bandName]?.rms_db;
      const normalizedRms = normalizedSpectral[bandName]?.rms_db;

      if (typeof originalRms === 'number' && typeof normalizedRms === 'number') {
        const expectedNormalizedRms = originalRms + gainDb;
        const actualDifference = normalizedRms - originalRms;
        const error = Math.abs(actualDifference - gainDb);

        if (error > 0.1) {
          this.logger.finding(`BANDA ${bandName}: Ganho espectral inconsistente`, {
            fileName,
            bandName,
            originalRms: originalRms.toFixed(2),
            normalizedRms: normalizedRms.toFixed(2),
            expectedNormalizedRms: expectedNormalizedRms.toFixed(2),
            actualGain: actualDifference.toFixed(2),
            expectedGain: gainDb.toFixed(2),
            error: error.toFixed(2),
            possibleCause: 'RMS sendo calculado incorretamente ou no sinal errado'
          });
        } else {
          this.logger.measurement(`BANDA ${bandName}: Ganho consistente`, {
            fileName,
            bandName,
            gain: actualDifference.toFixed(2),
            error: error.toFixed(3)
          });
        }
      }
    });
  }

  async _auditSpectralImplementations(normalizedLeft, normalizedRight, sampleRate, fileName) {
    this.logger.info('🔬 AUDITANDO IMPLEMENTAÇÕES ESPECTRAIS');

    try {
      // Testar implementação dos utilitários espectrais
      const spectralUtilsResult = spectralUtils.analyzeSpectralFeatures(
        normalizedLeft, normalizedRight, sampleRate, 'full'
      );

      this.logger.measurement('SpectralUtils - Resultado', {
        fileName,
        bands: this._summarizeBands(spectralUtilsResult.bands),
        totalEnergyCheck: Object.values(spectralUtilsResult.bands).reduce((sum, b) => sum + (b.energy_pct || 0), 0)
      });

      // VERIFICAÇÃO CRÍTICA: Valores razoáveis para sinal normalizado a -18 LUFS?
      Object.entries(spectralUtilsResult.bands).forEach(([bandName, bandData]) => {
        if (bandData.rms_db > -10) {
          this.logger.finding(`SpectralUtils - Banda ${bandName} com valor suspeito`, {
            fileName,
            bandName,
            rms_db: bandData.rms_db.toFixed(2),
            expectedRange: '[-60, -15] dB para LUFS -18',
            possibleIssue: 'RMS calculation or scaling error'
          });
        }
      });

    } catch (error) {
      this.logger.warning('Erro ao testar SpectralUtils', { fileName, error: error.message });
    }

    // Testar cálculo manual de RMS por banda
    this._auditManualBandRMS(normalizedLeft, normalizedRight, sampleRate, fileName);
  }

  _auditManualBandRMS(leftChannel, rightChannel, sampleRate, fileName) {
    this.logger.info('📐 CALCULANDO RMS MANUAL POR BANDA');

    // Conversão para mono
    const monoSignal = new Float32Array(leftChannel.length);
    for (let i = 0; i < leftChannel.length; i++) {
      monoSignal[i] = (leftChannel[i] + rightChannel[i]) / 2;
    }

    // Calcular RMS total do sinal
    let totalRMS = 0;
    for (let i = 0; i < monoSignal.length; i++) {
      totalRMS += monoSignal[i] * monoSignal[i];
    }
    totalRMS = Math.sqrt(totalRMS / monoSignal.length);
    const totalRMSdB = totalRMS > 0 ? 20 * Math.log10(totalRMS) : -Infinity;

    this.logger.measurement('RMS Total do sinal normalizado', {
      fileName,
      totalRMS_linear: totalRMS.toFixed(6),
      totalRMS_dB: totalRMSdB.toFixed(2),
      expectedRange: '~[-20, -15] dB para LUFS -18'
    });

    // VERIFICAÇÃO: RMS total deve estar coerente com LUFS -18
    if (totalRMSdB > -10 || totalRMSdB < -30) {
      this.logger.finding('RMS total do sinal normalizado fora do esperado', {
        fileName,
        totalRMS_dB: totalRMSdB.toFixed(2),
        expectedRange: '~[-20, -15] dB',
        possibleCause: 'Normalização não aplicada corretamente ou escala incorreta'
      });
    }

    // Simular cálculo de banda (apenas sub para teste)
    const subBandEnergy = this._calculateBandEnergyManual(monoSignal, sampleRate, [20, 60]);
    
    this.logger.measurement('Banda SUB - Cálculo manual', {
      fileName,
      bandRange: '[20, 60] Hz',
      rms_linear: subBandEnergy.rms.toFixed(6),
      rms_dB: subBandEnergy.rmsDb.toFixed(2),
      ratio_to_total: (subBandEnergy.rms / totalRMS).toFixed(3)
    });
  }

  _calculateBandEnergyManual(signal, sampleRate, [lowFreq, highFreq]) {
    // Implementação simplificada para auditoria
    // Na implementação real seria feita via FFT, aqui é apenas uma aproximação
    
    // Simular filtro passa-banda básico usando factor de frequência
    const centerFreq = Math.sqrt(lowFreq * highFreq);
    const freqFactor = Math.max(0.1, 1 - Math.abs(Math.log10(centerFreq / 1000)) * 0.2);
    
    let sumSquares = 0;
    for (let i = 0; i < signal.length; i++) {
      // Aplicar factor de banda (aproximação grosseira)
      const sample = signal[i] * freqFactor;
      sumSquares += sample * sample;
    }
    
    const rms = Math.sqrt(sumSquares / signal.length);
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    
    return { rms, rmsDb };
  }

  async _auditAveragingMethods() {
    this.logger.info('🧮 AUDITANDO MÉTODOS DE MÉDIA');

    // Simular dados de teste com valores em dB
    const testDbValues = [-15.2, -18.7, -12.5, -20.1, -16.8];
    
    // MÉTODO INCORRETO: Média aritmética direta em dB
    const wrongAverage = testDbValues.reduce((sum, val) => sum + val, 0) / testDbValues.length;
    
    // MÉTODO CORRETO: Converter para linear, fazer média, converter de volta
    const linearValues = testDbValues.map(db => Math.pow(10, db / 20));
    const linearAverage = linearValues.reduce((sum, val) => sum + val, 0) / linearValues.length;
    const correctAverage = 20 * Math.log10(linearAverage);
    
    const difference = Math.abs(wrongAverage - correctAverage);
    
    this.logger.measurement('Comparação de métodos de média', {
      testValues: testDbValues,
      wrongMethod_dB: wrongAverage.toFixed(2),
      correctMethod_dB: correctAverage.toFixed(2),
      difference_dB: difference.toFixed(2),
      significantError: difference > 0.5
    });

    if (difference > 0.5) {
      this.logger.finding('Média em dB pode estar sendo calculada incorretamente', {
        wrongMethod: 'Média aritmética direta dos valores em dB',
        correctMethod: 'dB→linear→média→dB',
        expectedImpact: 'Valores de bandas inconsistentes',
        difference: difference.toFixed(2) + ' dB'
      });
    }
  }

  async _auditUnitsAndConversions() {
    this.logger.info('📏 AUDITANDO UNIDADES E CONVERSÕES');

    // Testar conversões comuns que podem estar com erro
    const testCases = [
      { rms: 0.1, expectedDb: -20 },
      { rms: 0.01, expectedDb: -40 },
      { rms: 0.001, expectedDb: -60 },
      { rms: 1.0, expectedDb: 0 }
    ];

    testCases.forEach(({ rms, expectedDb }) => {
      const calculatedDb = 20 * Math.log10(rms);
      const error = Math.abs(calculatedDb - expectedDb);
      
      if (error > 0.1) {
        this.logger.finding('Erro na conversão RMS→dB', {
          rms,
          expectedDb,
          calculatedDb: calculatedDb.toFixed(2),
          error: error.toFixed(2)
        });
      }
    });

    // Testar se há confusão com power vs amplitude
    const testRMS = 0.1;
    const amplitudeDb = 20 * Math.log10(testRMS);  // CORRETO para RMS
    const powerDb = 10 * Math.log10(testRMS);      // INCORRETO para RMS
    
    this.logger.measurement('Verificação de fórmulas dB', {
      testRMS,
      correctAmplitudeDb: amplitudeDb.toFixed(2),
      incorrectPowerDb: powerDb.toFixed(2),
      difference: Math.abs(amplitudeDb - powerDb).toFixed(2)
    });
  }

  async _auditExpectedRanges() {
    this.logger.info('📊 AUDITANDO FAIXAS ESPERADAS');

    // Para um sinal normalizado a -18 LUFS, as bandas espectrais devem estar aproximadamente em:
    const expectedRanges = {
      sub: [-30, -15],
      low_bass: [-28, -12],
      upper_bass: [-25, -10],
      low_mid: [-23, -8],
      mid: [-20, -5],
      high_mid: [-25, -10],
      brilho: [-30, -15],
      presenca: [-35, -20]
    };

    this.logger.measurement('Faixas esperadas para LUFS -18', { expectedRanges });

    // Carregar JSON atual e comparar
    const jsonPath = path.join(this.config.outputDir, `${this.config.genre}.json`);
    if (fs.existsSync(jsonPath)) {
      const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const bands = jsonData[this.config.genre]?.legacy_compatibility?.bands;

      if (bands) {
        Object.entries(bands).forEach(([bandName, bandData]) => {
          const targetDb = bandData.target_db;
          const expectedRange = expectedRanges[bandName];

          if (expectedRange) {
            const [minExpected, maxExpected] = expectedRange;
            const inRange = targetDb >= minExpected && targetDb <= maxExpected;

            if (!inRange) {
              this.logger.finding(`BANDA ${bandName}: Valor fora da faixa esperada`, {
                bandName,
                currentValue: targetDb,
                expectedRange: `[${minExpected}, ${maxExpected}] dB`,
                deviation: targetDb < minExpected ? 
                  `${(minExpected - targetDb).toFixed(1)} dB abaixo` :
                  `${(targetDb - maxExpected).toFixed(1)} dB acima`,
                severity: Math.abs(targetDb - ((minExpected + maxExpected) / 2)) > 10 ? 'CRÍTICO' : 'MODERADO'
              });
            }
          }
        });
      }
    }
  }
}

// Função principal
async function main() {
  console.log('🔍 AUDIT REFS INCONSISTÊNCIAS - Rastreamento de Causa Raiz\n');

  try {
    const auditor = new RefsInconsistencyAuditor(AUDIT_CONFIG);
    const findings = await auditor.runAudit();

    console.log(`\n✅ Auditoria concluída com ${findings.length} findings críticos`);
    
    if (findings.length > 0) {
      console.log('\n🎯 PRÓXIMOS PASSOS RECOMENDADOS:');
      console.log('   1. Verificar se média das bandas está sendo calculada corretamente (dB→linear→média→dB)');
      console.log('   2. Confirmar que métricas espectrais são extraídas do sinal NORMALIZADO');
      console.log('   3. Verificar se não há Math.abs() sendo aplicado onde não deveria');
      console.log('   4. Validar conversões linear↔dB');
      console.log('   5. Executar teste rápido com patch sugerido');
    }

  } catch (error) {
    console.error('❌ Erro durante auditoria:', error.message);
    if (AUDIT_CONFIG.logLevel === 'DEBUG') {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { RefsInconsistencyAuditor, AuditLogger };
