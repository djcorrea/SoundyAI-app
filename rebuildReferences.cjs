#!/usr/bin/env node

/**
 * 🔧 REBUILD REFERENCES - Sistema de Recálculo de Médias de Referência
 * 
 * Recalcula as médias aritméticas das métricas de áudio a partir dos WAVs
 * de referência, preservando o schema dos JSONs e aplicando validações rigorosas.
 * 
 * Uso:
 *   node rebuildReferences.js --dry-run    # Apenas relatório
 *   node rebuildReferences.js --apply      # Aplica as mudanças
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================================
// CONFIGURAÇÃO E CONSTANTES
// ============================================================================

const CONFIG = {
  refsDir: './refs',
  outputDir: './refs/out',
  genresDirs: ['funk_mandela', 'eletronico', 'funk_bruxaria', 'trance', 'trap'],
  backupSuffix: '.bak',
  tempSuffix: '.tmp',
  validationTolerance: 0.1, // % para soma de bandas
  logLevel: 'INFO' // DEBUG, INFO, WARN, ERROR
};

// Gerar runId único para esta execução
const RUN_ID = `rebuild_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

// ============================================================================
// SISTEMA DE LOGS ESTRUTURADOS
// ============================================================================

class Logger {
  constructor(runId, level = 'INFO') {
    this.runId = runId;
    this.level = level;
    this.levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
  }

  _log(level, message, data = {}) {
    if (this.levels[level] >= this.levels[this.level]) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        runId: this.runId,
        level,
        message,
        ...data
      };
      console.log(`[${level}] ${message}`, data);
    }
  }

  debug(message, data) { this._log('DEBUG', message, data); }
  info(message, data) { this._log('INFO', message, data); }
  warn(message, data) { this._log('WARN', message, data); }
  error(message, data) { this._log('ERROR', message, data); }
}

const logger = new Logger(RUN_ID);

// ============================================================================
// SIMULAÇÃO DE ANÁLISE DE ÁUDIO (MOCK para desenvolvimento)
// ============================================================================

/**
 * IMPORTANTE: Esta é uma simulação para desenvolvimento.
 * Na implementação final, estas funções devem usar os mesmos
 * algoritmos de análise já implementados no sistema.
 */
class AudioAnalysisMock {
  
  static analyzeWAV(filePath) {
    logger.debug('Analisando arquivo WAV', { filePath });
    
    // Simular análise com valores realísticos baseados no arquivo
    const fileName = path.basename(filePath);
    const seed = this._generateSeed(fileName);
    
    // Métricas principais (valores realísticos para funk/eletrônico)
    const lufsIntegrated = -4.5 + (seed % 100) * 0.05 - 2.5; // -7.0 a -2.0
    const truePeakDbtp = -6.0 + (seed % 80) * 0.1; // -6.0 a +2.0
    const dynamicRange = 5.0 + (seed % 40) * 0.15; // 5.0 a 11.0
    const lra = 6.0 + (seed % 60) * 0.1; // 6.0 a 12.0
    const stereoCorrelation = 0.2 + (seed % 60) * 0.01; // 0.2 a 0.8
    
    // Bandas espectrais (RMS em dB relativo)
    const bands = {
      sub: -8.0 + (seed % 50) * 0.1,
      low_bass: -10.0 + (seed % 60) * 0.12,
      upper_bass: -15.0 + (seed % 40) * 0.15,
      low_mid: -12.0 + (seed % 70) * 0.2,
      mid: -8.0 + (seed % 80) * 0.15,
      high_mid: -15.0 + (seed % 50) * 0.12,
      brilho: -20.0 + (seed % 60) * 0.2,
      presenca: -25.0 + (seed % 40) * 0.3
    };
    
    // Converter para % energia e normalizar
    const energyPercentages = this._convertToEnergyPercentages(bands);
    
    return {
      lufsIntegrated: parseFloat(lufsIntegrated.toFixed(1)),
      truePeakDbtp: parseFloat(truePeakDbtp.toFixed(1)),
      dynamicRange: parseFloat(dynamicRange.toFixed(1)),
      lra: parseFloat(lra.toFixed(1)),
      stereoCorrelation: parseFloat(stereoCorrelation.toFixed(2)),
      bands: {
        sub: { rms_db: parseFloat(bands.sub.toFixed(1)), energy_pct: energyPercentages.sub },
        low_bass: { rms_db: parseFloat(bands.low_bass.toFixed(1)), energy_pct: energyPercentages.low_bass },
        upper_bass: { rms_db: parseFloat(bands.upper_bass.toFixed(1)), energy_pct: energyPercentages.upper_bass },
        low_mid: { rms_db: parseFloat(bands.low_mid.toFixed(1)), energy_pct: energyPercentages.low_mid },
        mid: { rms_db: parseFloat(bands.mid.toFixed(1)), energy_pct: energyPercentages.mid },
        high_mid: { rms_db: parseFloat(bands.high_mid.toFixed(1)), energy_pct: energyPercentages.high_mid },
        brilho: { rms_db: parseFloat(bands.brilho.toFixed(1)), energy_pct: energyPercentages.brilho },
        presenca: { rms_db: parseFloat(bands.presenca.toFixed(1)), energy_pct: energyPercentages.presenca }
      }
    };
  }
  
  static _generateSeed(fileName) {
    let hash = 0;
    for (let i = 0; i < fileName.length; i++) {
      const char = fileName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
  
  static _convertToEnergyPercentages(bandsDb) {
    // Converter dB para energia linear
    const linearEnergies = {};
    let totalEnergy = 0;
    
    for (const [band, db] of Object.entries(bandsDb)) {
      const linear = Math.pow(10, db / 10);
      linearEnergies[band] = linear;
      totalEnergy += linear;
    }
    
    // Converter para percentagens e normalizar
    const percentages = {};
    for (const [band, linear] of Object.entries(linearEnergies)) {
      percentages[band] = parseFloat(((linear / totalEnergy) * 100).toFixed(2));
    }
    
    // Garantir soma = 100.00%
    const sum = Object.values(percentages).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100.0) > 0.01) {
      // Ajustar na banda com maior energia
      const maxBand = Object.keys(percentages).reduce((a, b) => 
        percentages[a] > percentages[b] ? a : b
      );
      percentages[maxBand] = parseFloat((percentages[maxBand] + (100.0 - sum)).toFixed(2));
    }
    
    return percentages;
  }
}

// ============================================================================
// CLASSES PRINCIPAIS
// ============================================================================

class GenreProcessor {
  constructor(genreName, logger) {
    this.genreName = genreName;
    this.logger = logger;
    this.wavsDir = path.join(CONFIG.refsDir, genreName);
    this.outputFile = path.join(CONFIG.outputDir, `${genreName}.json`);
    this.results = [];
  }

  async process() {
    this.logger.info(`Iniciando processamento do gênero: ${this.genreName}`);
    
    // A) Detectar WAVs
    const wavFiles = this._detectWAVFiles();
    this.logger.info(`Detectados ${wavFiles.length} arquivos WAV`, { 
      genre: this.genreName, 
      files: wavFiles.length 
    });
    
    if (wavFiles.length === 0) {
      throw new Error(`Nenhum arquivo WAV encontrado em ${this.wavsDir}`);
    }
    
    // B) Processar cada WAV
    for (const wavFile of wavFiles) {
      const filePath = path.join(this.wavsDir, wavFile);
      try {
        const analysis = AudioAnalysisMock.analyzeWAV(filePath);
        this.results.push({
          fileName: wavFile,
          ...analysis
        });
        this.logger.debug(`Processado: ${wavFile}`, { lufs: analysis.lufsIntegrated });
      } catch (error) {
        this.logger.error(`Erro ao processar ${wavFile}`, { error: error.message });
        throw error;
      }
    }
    
    // C) Calcular médias
    const averages = this._calculateAverages();
    
    // D) Validar
    this._validateResults(averages);
    
    this.logger.info(`Processamento concluído para ${this.genreName}`, {
      processed: this.results.length,
      expected: wavFiles.length
    });
    
    return {
      genreName: this.genreName,
      itemsProcessed: this.results.length,
      averages,
      rawResults: this.results
    };
  }
  
  _detectWAVFiles() {
    if (!fs.existsSync(this.wavsDir)) {
      return [];
    }
    
    return fs.readdirSync(this.wavsDir)
      .filter(file => file.toLowerCase().endsWith('.wav'))
      .sort();
  }
  
  _calculateAverages() {
    const n = this.results.length;
    if (n === 0) throw new Error('Nenhum resultado para calcular médias');
    
    // Médias das métricas principais
    const avgLufs = this.results.reduce((sum, r) => sum + r.lufsIntegrated, 0) / n;
    const avgTruePeak = this.results.reduce((sum, r) => sum + r.truePeakDbtp, 0) / n;
    const avgDR = this.results.reduce((sum, r) => sum + r.dynamicRange, 0) / n;
    const avgLRA = this.results.reduce((sum, r) => sum + r.lra, 0) / n;
    const avgStereo = this.results.reduce((sum, r) => sum + r.stereoCorrelation, 0) / n;
    
    // Médias das bandas (dB e % energia)
    const bandNames = Object.keys(this.results[0].bands);
    const avgBands = {};
    
    for (const band of bandNames) {
      const avgDb = this.results.reduce((sum, r) => sum + r.bands[band].rms_db, 0) / n;
      const avgPct = this.results.reduce((sum, r) => sum + r.bands[band].energy_pct, 0) / n;
      
      avgBands[band] = {
        target_db: parseFloat(avgDb.toFixed(1)),
        energy_pct: parseFloat(avgPct.toFixed(2))
      };
    }
    
    // Renormalizar % energia para somar exatamente 100%
    const totalPct = Object.values(avgBands).reduce((sum, b) => sum + b.energy_pct, 0);
    if (Math.abs(totalPct - 100.0) > 0.01) {
      const factor = 100.0 / totalPct;
      for (const band of bandNames) {
        avgBands[band].energy_pct = parseFloat((avgBands[band].energy_pct * factor).toFixed(2));
      }
    }
    
    return {
      lufs_target: parseFloat(avgLufs.toFixed(1)),
      true_peak_target: parseFloat(avgTruePeak.toFixed(1)),
      dr_target: parseFloat(avgDR.toFixed(1)),
      lra_target: parseFloat(avgLRA.toFixed(1)),
      stereo_target: parseFloat(avgStereo.toFixed(2)),
      bands: avgBands
    };
  }
  
  _validateResults(averages) {
    // Validação 1: Soma das % energia = 100%
    const totalEnergyPct = Object.values(averages.bands)
      .reduce((sum, band) => sum + band.energy_pct, 0);
    
    if (Math.abs(totalEnergyPct - 100.0) > CONFIG.validationTolerance) {
      throw new Error(
        `Soma das % energia inválida: ${totalEnergyPct.toFixed(2)}% (esperado: 100.00% ± ${CONFIG.validationTolerance}%)`
      );
    }
    
    // Validação 2: Valores físicos válidos
    const validations = [
      { name: 'LUFS', value: averages.lufs_target, min: -60, max: 0 },
      { name: 'True Peak', value: averages.true_peak_target, min: -60, max: 10 },
      { name: 'DR', value: averages.dr_target, min: 0, max: 30 },
      { name: 'LRA', value: averages.lra_target, min: 0, max: 50 },
      { name: 'Stereo', value: averages.stereo_target, min: -1, max: 1 }
    ];
    
    for (const val of validations) {
      if (!Number.isFinite(val.value) || val.value < val.min || val.value > val.max) {
        throw new Error(
          `${val.name} fora da faixa válida: ${val.value} (esperado: ${val.min} a ${val.max})`
        );
      }
    }
    
    this.logger.info('Validações passou', { 
      energySum: totalEnergyPct.toFixed(2),
      genre: this.genreName 
    });
  }
}

class JSONManager {
  constructor(genreName, logger) {
    this.genreName = genreName;
    this.logger = logger;
    this.outputFile = path.join(CONFIG.outputDir, `${genreName}.json`);
    this.tempFile = this.outputFile + CONFIG.tempSuffix;
    this.backupFile = this.outputFile + CONFIG.backupSuffix + '.' + Date.now();
  }
  
  loadCurrentSchema() {
    if (!fs.existsSync(this.outputFile)) {
      this.logger.warn(`Arquivo de referência não existe: ${this.outputFile}`);
      return null;
    }
    
    try {
      const content = fs.readFileSync(this.outputFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Erro ao carregar schema atual', { error: error.message });
      throw error;
    }
  }
  
  generateUpdatedJSON(currentSchema, averages, metadata) {
    // Se não há schema atual, criar estrutura básica
    if (!currentSchema) {
      currentSchema = {
        [this.genreName]: {
          version: "1.0.0-rebuild",
          legacy_compatibility: {}
        }
      };
    }
    
    // Clonar schema preservando estrutura
    const updated = JSON.parse(JSON.stringify(currentSchema));
    const genreKey = this.genreName;
    
    // Garantir que existe a seção do gênero
    if (!updated[genreKey]) {
      updated[genreKey] = {};
    }
    
    // Atualizar legacy_compatibility (seção principal usada pelo sistema)
    const legacy = updated[genreKey].legacy_compatibility || {};
    
    // Atualizar métricas principais
    legacy.lufs_target = averages.lufs_target;
    legacy.true_peak_target = averages.true_peak_target;
    legacy.dr_target = averages.dr_target;
    legacy.lra_target = averages.lra_target;
    legacy.stereo_target = averages.stereo_target;
    
    // Atualizar tolerâncias (manter existentes ou valores padrão)
    legacy.tol_lufs = legacy.tol_lufs || 3.0;
    legacy.tol_true_peak = legacy.tol_true_peak || 2.5;
    legacy.tol_dr = legacy.tol_dr || 5.0;
    legacy.tol_lra = legacy.tol_lra || 5.0;
    legacy.tol_stereo = legacy.tol_stereo || 0.7;
    
    // Atualizar bandas
    legacy.bands = legacy.bands || {};
    for (const [bandName, bandData] of Object.entries(averages.bands)) {
      legacy.bands[bandName] = {
        target_db: bandData.target_db,
        tol_db: legacy.bands[bandName]?.tol_db || 2.5, // Manter tolerância existente
        energy_pct: bandData.energy_pct // Nova propriedade
      };
    }
    
    // Atualizar metadados
    updated[genreKey].version = this._incrementVersion(updated[genreKey].version);
    updated[genreKey].num_tracks = metadata.itemsProcessed;
    updated[genreKey].generated_at = new Date().toISOString();
    updated[genreKey].rebuildRunId = metadata.runId;
    updated[genreKey].last_updated = new Date().toISOString();
    
    // Preservar seção legacy_compatibility atualizada
    updated[genreKey].legacy_compatibility = legacy;
    
    return updated;
  }
  
  _incrementVersion(currentVersion) {
    if (!currentVersion) return "1.0.0-rebuild";
    
    // Incrementar patch version
    const parts = currentVersion.split('.');
    if (parts.length >= 3) {
      const patch = parseInt(parts[2].split('-')[0]) + 1;
      return `${parts[0]}.${parts[1]}.${patch}-rebuild`;
    }
    
    return currentVersion + '-rebuild';
  }
  
  async saveSecurely(jsonData) {
    try {
      // 1. Escrever arquivo temporário
      fs.writeFileSync(this.tempFile, JSON.stringify(jsonData, null, 2), 'utf8');
      this.logger.debug('Arquivo temporário criado', { tempFile: this.tempFile });
      
      // 2. Validar arquivo temporário
      const tempContent = JSON.parse(fs.readFileSync(this.tempFile, 'utf8'));
      if (!tempContent[this.genreName]) {
        throw new Error('Validação falhou: estrutura de gênero ausente');
      }
      
      // 3. Criar backup se arquivo original existe
      if (fs.existsSync(this.outputFile)) {
        fs.copyFileSync(this.outputFile, this.backupFile);
        this.logger.info('Backup criado', { backupFile: this.backupFile });
      }
      
      // 4. Replace atômico
      fs.renameSync(this.tempFile, this.outputFile);
      this.logger.info('Arquivo atualizado com sucesso', { 
        outputFile: this.outputFile,
        backupCreated: fs.existsSync(this.backupFile)
      });
      
      return {
        outputFile: this.outputFile,
        backupFile: fs.existsSync(this.backupFile) ? this.backupFile : null,
        success: true
      };
      
    } catch (error) {
      // Cleanup em caso de erro
      if (fs.existsSync(this.tempFile)) {
        fs.unlinkSync(this.tempFile);
      }
      throw error;
    }
  }
  
  generateDiffReport(oldSchema, newAverages) {
    if (!oldSchema || !oldSchema[this.genreName]) {
      return { isNew: true, diffs: [] };
    }
    
    const old = oldSchema[this.genreName].legacy_compatibility || {};
    const diffs = [];
    
    // Comparar métricas principais
    const mainMetrics = [
      { key: 'lufs_target', name: 'LUFS', unit: 'LUFS' },
      { key: 'true_peak_target', name: 'True Peak', unit: 'dBTP' },
      { key: 'dr_target', name: 'DR', unit: 'dB' },
      { key: 'lra_target', name: 'LRA', unit: 'LU' },
      { key: 'stereo_target', name: 'Stereo', unit: '' }
    ];
    
    for (const metric of mainMetrics) {
      const oldVal = old[metric.key];
      const newVal = newAverages[metric.key];
      
      if (oldVal !== undefined && newVal !== undefined) {
        const diff = newVal - oldVal;
        if (Math.abs(diff) > 0.1) {
          diffs.push({
            type: 'metric',
            name: metric.name,
            oldValue: oldVal,
            newValue: newVal,
            difference: parseFloat(diff.toFixed(2)),
            unit: metric.unit
          });
        }
      }
    }
    
    // Comparar bandas
    if (old.bands && newAverages.bands) {
      for (const [bandName, newBand] of Object.entries(newAverages.bands)) {
        const oldBand = old.bands[bandName];
        if (oldBand && oldBand.target_db !== undefined) {
          const diff = newBand.target_db - oldBand.target_db;
          if (Math.abs(diff) > 0.2) {
            diffs.push({
              type: 'band',
              name: bandName,
              oldValue: oldBand.target_db,
              newValue: newBand.target_db,
              difference: parseFloat(diff.toFixed(1)),
              unit: 'dB'
            });
          }
        }
      }
    }
    
    return { isNew: false, diffs };
  }
}

// ============================================================================
// SISTEMA PRINCIPAL
// ============================================================================

class ReferenceRebuilder {
  constructor(dryRun = true) {
    this.dryRun = dryRun;
    this.logger = logger;
    this.results = new Map();
    this.errors = [];
  }
  
  async run() {
    this.logger.info('🔧 INICIANDO REBUILD DE REFERÊNCIAS', {
      runId: RUN_ID,
      mode: this.dryRun ? 'DRY-RUN' : 'APPLY',
      genres: CONFIG.genresDirs
    });
    
    try {
      // Processar cada gênero
      for (const genreName of CONFIG.genresDirs) {
        try {
          await this._processGenre(genreName);
        } catch (error) {
          this.logger.error(`Erro no gênero ${genreName}`, { error: error.message });
          this.errors.push({ genre: genreName, error: error.message });
        }
      }
      
      // Gerar relatório final
      this._generateFinalReport();
      
      // Decidir se aplicar ou não
      if (!this.dryRun && this.errors.length === 0) {
        await this._applyChanges();
      } else if (!this.dryRun && this.errors.length > 0) {
        this.logger.error('❌ Não aplicando mudanças devido a erros', { 
          errors: this.errors.length 
        });
      }
      
    } catch (error) {
      this.logger.error('Erro crítico no rebuild', { error: error.message });
      throw error;
    }
  }
  
  async _processGenre(genreName) {
    this.logger.info(`📊 Processando gênero: ${genreName}`);
    
    // Processar WAVs e calcular médias
    const processor = new GenreProcessor(genreName, this.logger);
    const processResult = await processor.process();
    
    // Gerenciar JSON
    const jsonManager = new JSONManager(genreName, this.logger);
    const currentSchema = jsonManager.loadCurrentSchema();
    
    // Gerar diff
    const diffReport = jsonManager.generateDiffReport(currentSchema, processResult.averages);
    
    // Gerar JSON atualizado
    const updatedJSON = jsonManager.generateUpdatedJSON(
      currentSchema,
      processResult.averages,
      {
        itemsProcessed: processResult.itemsProcessed,
        runId: RUN_ID
      }
    );
    
    // Armazenar resultado
    this.results.set(genreName, {
      processResult,
      currentSchema,
      updatedJSON,
      diffReport,
      jsonManager
    });
    
    this.logger.info(`✅ Gênero processado: ${genreName}`, {
      processed: processResult.itemsProcessed,
      diffs: diffReport.diffs.length
    });
  }
  
  async _applyChanges() {
    this.logger.info('💾 Aplicando mudanças...');
    
    for (const [genreName, result] of this.results) {
      try {
        const saveResult = await result.jsonManager.saveSecurely(result.updatedJSON);
        this.logger.info(`✅ ${genreName} salvo`, saveResult);
      } catch (error) {
        this.logger.error(`❌ Erro ao salvar ${genreName}`, { error: error.message });
        this.errors.push({ genre: genreName, phase: 'save', error: error.message });
      }
    }
  }
  
  _generateFinalReport() {
    this.logger.info('📋 RELATÓRIO FINAL DE REBUILD', { runId: RUN_ID });
    
    console.log('\n' + '='.repeat(80));
    console.log(`🔧 RELATÓRIO FINAL - REBUILD REFERÊNCIAS`);
    console.log(`RunId: ${RUN_ID}`);
    console.log(`Modo: ${this.dryRun ? 'DRY-RUN (apenas relatório)' : 'APPLY (aplicar mudanças)'}`);
    console.log(`Data: ${new Date().toISOString()}`);
    console.log('='.repeat(80));
    
    for (const [genreName, result] of this.results) {
      const { processResult, diffReport } = result;
      
      console.log(`\n🎵 GÊNERO: ${genreName.toUpperCase()}`);
      console.log(`   Faixas processadas: ${processResult.itemsProcessed}`);
      console.log(`   Status: ${this.errors.some(e => e.genre === genreName) ? '❌ ERRO' : '✅ OK'}`);
      
      // Validação de soma de bandas
      const totalEnergyPct = Object.values(processResult.averages.bands)
        .reduce((sum, band) => sum + band.energy_pct, 0);
      console.log(`   Soma % energia: ${totalEnergyPct.toFixed(2)}% ${Math.abs(totalEnergyPct - 100.0) <= CONFIG.validationTolerance ? '✅' : '❌'}`);
      
      if (diffReport.isNew) {
        console.log(`   📝 Novo arquivo de referência criado`);
      } else {
        console.log(`   📈 Diferenças encontradas: ${diffReport.diffs.length}`);
        
        // Mostrar principais diferenças
        const significantDiffs = diffReport.diffs.filter(d => 
          (d.type === 'metric' && Math.abs(d.difference) > 1.0) ||
          (d.type === 'band' && Math.abs(d.difference) > 2.0)
        );
        
        for (const diff of significantDiffs.slice(0, 5)) {
          const sign = diff.difference > 0 ? '+' : '';
          console.log(`     ${diff.name}: ${diff.oldValue} → ${diff.newValue} (${sign}${diff.difference} ${diff.unit})`);
        }
        
        if (significantDiffs.length > 5) {
          console.log(`     ... e mais ${significantDiffs.length - 5} diferenças`);
        }
      }
    }
    
    // Resumo de erros
    if (this.errors.length > 0) {
      console.log(`\n❌ ERROS ENCONTRADOS: ${this.errors.length}`);
      for (const error of this.errors) {
        console.log(`   ${error.genre}: ${error.error}`);
      }
    }
    
    // Status final
    const successCount = this.results.size - this.errors.length;
    console.log(`\n📊 RESUMO FINAL:`);
    console.log(`   Gêneros processados com sucesso: ${successCount}/${CONFIG.genresDirs.length}`);
    console.log(`   Erros: ${this.errors.length}`);
    console.log(`   Aplicação: ${this.dryRun ? 'NÃO (dry-run)' : (this.errors.length === 0 ? 'SIM' : 'NÃO (erros presentes)')}`);
    
    console.log('\n' + '='.repeat(80));
  }
}

// ============================================================================
// PONTO DE ENTRADA
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || (args[0] !== '--dry-run' && args[0] !== '--apply')) {
    console.error('Uso: node rebuildReferences.js [--dry-run|--apply]');
    console.error('  --dry-run: Apenas gera relatório sem modificar arquivos');
    console.error('  --apply:   Aplica as mudanças nos arquivos JSON');
    process.exit(1);
  }
  
  const dryRun = args[0] === '--dry-run';
  
  try {
    const rebuilder = new ReferenceRebuilder(dryRun);
    await rebuilder.run();
    
    console.log(`\n✅ Rebuild concluído ${dryRun ? '(dry-run)' : '(aplicado)'}`);
    
  } catch (error) {
    console.error('\n❌ Erro durante rebuild:', error.message);
    process.exit(1);
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ReferenceRebuilder, AudioAnalysisMock };
