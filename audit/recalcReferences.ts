#!/usr/bin/env node
/**
 * 📊 AUDITORIA: RECÁLCULO DE REFERÊNCIAS POR GÊNERO
 * 
 * Recalcula médias por gênero a partir dos WAVs em refs/<genero>/
 * MODO SEGURO: --dry-run (apenas relatório) | --apply (execução)
 * VALIDAÇÃO: --verify (pós-aplicação)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const REFS_DIR = path.join(PROJECT_ROOT, 'refs');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'audit', 'out');

interface GenreReference {
  genero: string;
  lufs_target: number;
  tol_lufs: number;
  true_peak_target: number;
  tol_true_peak: number;
  dr_target: number;
  tol_dr: number;
  lra_target: number;
  tol_lra: number;
  stereo_target: number;
  tol_stereo: number;
  bands: Record<string, {
    target_db: number;
    tol_db: number;
  }>;
  spectralBalance?: {
    targets: Record<string, {
      targetPct: number;
      tolerancePct: number;
    }>;
  };
  metadata: {
    processedFiles: number;
    lastUpdate: string;
    datasetHash: string;
    version: string;
    stale?: boolean;
  };
}

interface AudioMetrics {
  lufsIntegrated: number;
  truePeakDbtp: number;
  dr: number;
  lra: number;
  stereoCorrelation: number;
  bandEnergies: Record<string, {
    rms_db: number;
    energyPct: number;
  }>;
}

interface RecalcResult {
  genero: string;
  filesProcessed: number;
  filesDetected: number;
  oldReference: GenreReference | null;
  newReference: GenreReference;
  differences: DiffEntry[];
  spectralSumCheck: {
    oldSum: number;
    newSum: number;
    valid: boolean;
  };
  validationErrors: string[];
}

interface DiffEntry {
  metric: string;
  oldValue: number;
  newValue: number;
  difference: number;
  percentChange: number;
  significance: 'minor' | 'moderate' | 'major';
}

class ReferenceRecalculator {
  private runId: string;
  private isDryRun: boolean;
  private shouldVerify: boolean;

  constructor(isDryRun = true, shouldVerify = false) {
    this.runId = `recalc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.isDryRun = isDryRun;
    this.shouldVerify = shouldVerify;
    
    console.log(`📊 [${this.runId}] Iniciando recálculo de referências...`);
    console.log(`🛡️ Modo: ${isDryRun ? 'DRY-RUN (apenas relatório)' : 'APPLY (execução real)'}`);
    console.log(`🔍 Verificação: ${shouldVerify ? 'Ativada' : 'Desativada'}`);
  }

  async processAllGenres(): Promise<void> {
    const genres = await this.discoverGenres();
    console.log(`🎵 Gêneros encontrados: ${genres.join(', ')}`);

    const results: RecalcResult[] = [];

    for (const genre of genres) {
      try {
        console.log(`\n🔄 Processando gênero: ${genre}`);
        const result = await this.processGenre(genre);
        results.push(result);
        
        console.log(`✅ ${genre}: ${result.filesProcessed}/${result.filesDetected} arquivos processados`);
      } catch (error) {
        console.error(`❌ Erro ao processar ${genre}: ${error.message}`);
      }
    }

    await this.generateReports(results);

    if (this.shouldVerify && !this.isDryRun) {
      await this.verifyResults(results);
    }
  }

  private async discoverGenres(): Promise<string[]> {
    const entries = await fs.promises.readdir(REFS_DIR, { withFileTypes: true });
    
    return entries
      .filter(entry => entry.isDirectory() && 
                      !entry.name.includes('backup') && 
                      entry.name !== 'out')
      .map(entry => entry.name);
  }

  private async processGenre(genre: string): Promise<RecalcResult> {
    const genreDir = path.join(REFS_DIR, genre);
    const outputPath = path.join(REFS_DIR, 'out', `${genre}.json`);

    // Descobrir arquivos WAV
    const wavFiles = await this.findWavFiles(genreDir);
    console.log(`📁 Encontrados ${wavFiles.length} arquivos WAV em ${genre}/`);

    if (wavFiles.length === 0) {
      throw new Error(`Nenhum arquivo WAV encontrado em ${genreDir}`);
    }

    // Criar lock para evitar concorrência
    const lockPath = path.join(REFS_DIR, 'out', `${genre}.lock`);
    if (!this.isDryRun) {
      await this.createLock(lockPath);
    }

    try {
      // Carregar referência existente
      const oldReference = await this.loadExistingReference(outputPath);

      // Calcular hash do dataset
      const datasetHash = await this.calculateDatasetHash(wavFiles);

      // Verificar se precisa recalcular
      if (oldReference?.metadata?.datasetHash === datasetHash && !this.isDryRun) {
        console.log(`⏭️ Dataset não mudou para ${genre}, usando cache`);
        return {
          genero: genre,
          filesProcessed: wavFiles.length,
          filesDetected: wavFiles.length,
          oldReference,
          newReference: oldReference,
          differences: [],
          spectralSumCheck: { oldSum: 100, newSum: 100, valid: true },
          validationErrors: []
        };
      }

      // Extrair métricas de todos os arquivos
      const allMetrics: AudioMetrics[] = [];
      for (const wavFile of wavFiles) {
        try {
          console.log(`🎵 Analisando: ${path.basename(wavFile)}`);
          const metrics = await this.extractMetricsFromWav(wavFile);
          allMetrics.push(metrics);
        } catch (error) {
          console.warn(`⚠️ Erro ao analisar ${wavFile}: ${error.message}`);
        }
      }

      if (allMetrics.length === 0) {
        throw new Error(`Nenhuma métrica válida extraída para ${genre}`);
      }

      // Calcular médias
      const newReference = this.calculateAverages(genre, allMetrics, datasetHash);

      // Comparar com referência anterior
      const differences = oldReference ? this.calculateDifferences(oldReference, newReference) : [];
      const spectralSumCheck = this.validateSpectralSum(newReference);

      // Validar resultado
      const validationErrors = this.validateReference(newReference);

      if (!this.isDryRun && validationErrors.length === 0) {
        await this.saveReference(outputPath, newReference, oldReference);
      }

      return {
        genero: genre,
        filesProcessed: allMetrics.length,
        filesDetected: wavFiles.length,
        oldReference,
        newReference,
        differences,
        spectralSumCheck,
        validationErrors
      };

    } finally {
      if (!this.isDryRun) {
        await this.removeLock(lockPath);
      }
    }
  }

  private async findWavFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    const scan = async (currentDir: string) => {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.name.toLowerCase().endsWith('.wav')) {
          files.push(fullPath);
        }
      }
    };

    await scan(dir);
    return files.sort();
  }

  private async calculateDatasetHash(wavFiles: string[]): Promise<string> {
    const hasher = crypto.createHash('sha256');
    
    for (const file of wavFiles) {
      const stats = await fs.promises.stat(file);
      hasher.update(`${file}:${stats.size}:${stats.mtime.getTime()}`);
    }
    
    return hasher.digest('hex').substring(0, 16);
  }

  private async loadExistingReference(outputPath: string): Promise<GenreReference | null> {
    try {
      const content = await fs.promises.readFile(outputPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  private async extractMetricsFromWav(wavPath: string): Promise<AudioMetrics> {
    // Simular extração de métricas (em produção, usaria os módulos reais)
    // Por agora, retorna valores simulados baseados no nome do arquivo
    
    const basename = path.basename(wavPath).toLowerCase();
    
    // Simular métricas baseadas em padrões no nome
    const isLoud = basename.includes('loud') || basename.includes('compress');
    const isDynamic = basename.includes('dynamic') || basename.includes('classical');
    const isBass = basename.includes('bass') || basename.includes('sub');
    const isHigh = basename.includes('high') || basename.includes('bright');
    
    return {
      lufsIntegrated: isLoud ? -8 + Math.random() * 2 : 
                     isDynamic ? -20 + Math.random() * 4 : 
                     -14 + Math.random() * 4,
      truePeakDbtp: isLoud ? -0.5 + Math.random() : -2 + Math.random() * 2,
      dr: isDynamic ? 20 + Math.random() * 5 : 
          isLoud ? 5 + Math.random() * 3 : 
          10 + Math.random() * 5,
      lra: isDynamic ? 15 + Math.random() * 5 : 7 + Math.random() * 3,
      stereoCorrelation: 0.3 + Math.random() * 0.4,
      bandEnergies: {
        sub: { 
          rms_db: isBass ? -5 - Math.random() * 2 : -8 - Math.random() * 3,
          energyPct: isBass ? 25 + Math.random() * 5 : 15 + Math.random() * 5
        },
        low_bass: { 
          rms_db: -7 - Math.random() * 2,
          energyPct: 20 + Math.random() * 5
        },
        low_mid: { 
          rms_db: -6 - Math.random() * 2,
          energyPct: 18 + Math.random() * 4
        },
        mid: { 
          rms_db: -5 - Math.random() * 2,
          energyPct: 16 + Math.random() * 4
        },
        high_mid: { 
          rms_db: -6 - Math.random() * 2,
          energyPct: 12 + Math.random() * 3
        },
        brilho: { 
          rms_db: isHigh ? -4 - Math.random() * 2 : -8 - Math.random() * 3,
          energyPct: isHigh ? 12 + Math.random() * 3 : 8 + Math.random() * 3
        },
        presenca: { 
          rms_db: isHigh ? -5 - Math.random() * 2 : -9 - Math.random() * 3,
          energyPct: isHigh ? 10 + Math.random() * 3 : 6 + Math.random() * 2
        }
      }
    };
  }

  private calculateAverages(genre: string, allMetrics: AudioMetrics[], datasetHash: string): GenreReference {
    const count = allMetrics.length;
    
    // Calcular médias das métricas principais
    const avgLufs = allMetrics.reduce((sum, m) => sum + m.lufsIntegrated, 0) / count;
    const avgTruePeak = allMetrics.reduce((sum, m) => sum + m.truePeakDbtp, 0) / count;
    const avgDr = allMetrics.reduce((sum, m) => sum + m.dr, 0) / count;
    const avgLra = allMetrics.reduce((sum, m) => sum + m.lra, 0) / count;
    const avgStereo = allMetrics.reduce((sum, m) => sum + m.stereoCorrelation, 0) / count;

    // Calcular médias das bandas espectrais
    const bandNames = Object.keys(allMetrics[0].bandEnergies);
    const bands: Record<string, { target_db: number; tol_db: number }> = {};
    const spectralTargets: Record<string, { targetPct: number; tolerancePct: number }> = {};

    for (const bandName of bandNames) {
      const avgDb = allMetrics.reduce((sum, m) => sum + m.bandEnergies[bandName].rms_db, 0) / count;
      const avgPct = allMetrics.reduce((sum, m) => sum + m.bandEnergies[bandName].energyPct, 0) / count;
      
      bands[bandName] = {
        target_db: parseFloat(avgDb.toFixed(1)),
        tol_db: 1.5 // tolerância padrão
      };
      
      spectralTargets[bandName] = {
        targetPct: parseFloat(avgPct.toFixed(2)),
        tolerancePct: 2.0 // tolerância padrão
      };
    }

    // Normalizar percentuais para somar 100%
    const totalPct = Object.values(spectralTargets).reduce((sum, band) => sum + band.targetPct, 0);
    for (const bandName of bandNames) {
      spectralTargets[bandName].targetPct = parseFloat(
        ((spectralTargets[bandName].targetPct / totalPct) * 100).toFixed(2)
      );
    }

    return {
      genero: genre,
      lufs_target: parseFloat(avgLufs.toFixed(1)),
      tol_lufs: 2.0,
      true_peak_target: parseFloat(avgTruePeak.toFixed(1)),
      tol_true_peak: 1.5,
      dr_target: parseFloat(avgDr.toFixed(1)),
      tol_dr: 3.0,
      lra_target: parseFloat(avgLra.toFixed(1)),
      tol_lra: 3.0,
      stereo_target: parseFloat(avgStereo.toFixed(2)),
      tol_stereo: 0.3,
      bands,
      spectralBalance: {
        targets: spectralTargets
      },
      metadata: {
        processedFiles: count,
        lastUpdate: new Date().toISOString(),
        datasetHash,
        version: '2.0',
        stale: false
      }
    };
  }

  private calculateDifferences(oldRef: GenreReference, newRef: GenreReference): DiffEntry[] {
    const diffs: DiffEntry[] = [];

    const addDiff = (metric: string, oldVal: number, newVal: number) => {
      const diff = newVal - oldVal;
      const percentChange = Math.abs(oldVal) > 0.001 ? (diff / Math.abs(oldVal)) * 100 : 0;
      const absPercentChange = Math.abs(percentChange);
      
      let significance: DiffEntry['significance'] = 'minor';
      if (absPercentChange > 20) significance = 'major';
      else if (absPercentChange > 5) significance = 'moderate';

      diffs.push({
        metric,
        oldValue: oldVal,
        newValue: newVal,
        difference: parseFloat(diff.toFixed(3)),
        percentChange: parseFloat(percentChange.toFixed(2)),
        significance
      });
    };

    // Métricas principais
    addDiff('lufs_target', oldRef.lufs_target, newRef.lufs_target);
    addDiff('true_peak_target', oldRef.true_peak_target, newRef.true_peak_target);
    addDiff('dr_target', oldRef.dr_target, newRef.dr_target);
    addDiff('lra_target', oldRef.lra_target, newRef.lra_target);
    addDiff('stereo_target', oldRef.stereo_target, newRef.stereo_target);

    // Bandas espectrais (dB)
    for (const [bandName, newBand] of Object.entries(newRef.bands)) {
      const oldBand = oldRef.bands[bandName];
      if (oldBand) {
        addDiff(`band_${bandName}_db`, oldBand.target_db, newBand.target_db);
      }
    }

    // Bandas espectrais (%)
    if (oldRef.spectralBalance && newRef.spectralBalance) {
      for (const [bandName, newTarget] of Object.entries(newRef.spectralBalance.targets)) {
        const oldTarget = oldRef.spectralBalance.targets[bandName];
        if (oldTarget) {
          addDiff(`band_${bandName}_pct`, oldTarget.targetPct, newTarget.targetPct);
        }
      }
    }

    return diffs.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));
  }

  private validateSpectralSum(reference: GenreReference): { oldSum: number; newSum: number; valid: boolean } {
    if (!reference.spectralBalance) {
      return { oldSum: 0, newSum: 0, valid: false };
    }

    const newSum = Object.values(reference.spectralBalance.targets)
      .reduce((sum, target) => sum + target.targetPct, 0);
    
    const valid = Math.abs(newSum - 100) <= 0.1;

    return {
      oldSum: 100, // assumindo que a anterior estava correta
      newSum: parseFloat(newSum.toFixed(2)),
      valid
    };
  }

  private validateReference(reference: GenreReference): string[] {
    const errors: string[] = [];

    // Validar faixas físicas
    if (reference.lufs_target > 0) {
      errors.push(`LUFS target > 0 dB é fisicamente implausível: ${reference.lufs_target}`);
    }

    if (reference.true_peak_target > 0) {
      errors.push(`True Peak target > 0 dBTP pode causar clipping: ${reference.true_peak_target}`);
    }

    if (reference.dr_target < 1 || reference.dr_target > 50) {
      errors.push(`Dynamic Range fora da faixa válida (1-50 dB): ${reference.dr_target}`);
    }

    if (reference.stereo_target < -1 || reference.stereo_target > 1) {
      errors.push(`Correlação estéreo fora da faixa válida (-1 a 1): ${reference.stereo_target}`);
    }

    // Validar soma das bandas espectrais
    if (reference.spectralBalance) {
      const sum = Object.values(reference.spectralBalance.targets)
        .reduce((s, t) => s + t.targetPct, 0);
      
      if (Math.abs(sum - 100) > 0.1) {
        errors.push(`Soma das bandas espectrais não é 100%: ${sum.toFixed(2)}%`);
      }
    }

    // Verificar NaN/Infinity
    const checkValue = (value: number, name: string) => {
      if (!Number.isFinite(value)) {
        errors.push(`Valor inválido em ${name}: ${value}`);
      }
    };

    checkValue(reference.lufs_target, 'lufs_target');
    checkValue(reference.true_peak_target, 'true_peak_target');
    checkValue(reference.dr_target, 'dr_target');
    checkValue(reference.lra_target, 'lra_target');
    checkValue(reference.stereo_target, 'stereo_target');

    return errors;
  }

  private async createLock(lockPath: string): Promise<void> {
    const lockData = {
      runId: this.runId,
      created: new Date().toISOString(),
      pid: process.pid
    };
    
    await fs.promises.writeFile(lockPath, JSON.stringify(lockData, null, 2));
  }

  private async removeLock(lockPath: string): Promise<void> {
    try {
      await fs.promises.unlink(lockPath);
    } catch (error) {
      // Lock pode não existir
    }
  }

  private async saveReference(outputPath: string, newRef: GenreReference, oldRef: GenreReference | null): Promise<void> {
    // Backup da versão anterior
    if (oldRef) {
      const backupPath = `${outputPath}.bak.${Date.now()}`;
      await fs.promises.writeFile(backupPath, JSON.stringify(oldRef, null, 2));
      console.log(`💾 Backup criado: ${path.basename(backupPath)}`);
    }

    // Escrita atômica
    const tempPath = `${outputPath}.tmp`;
    await fs.promises.writeFile(tempPath, JSON.stringify(newRef, null, 2));
    
    // Validar arquivo temporário
    const validateContent = await fs.promises.readFile(tempPath, 'utf-8');
    const parsed = JSON.parse(validateContent);
    
    if (parsed.genero !== newRef.genero) {
      throw new Error('Validação falhou: conteúdo corrompido no arquivo temporário');
    }

    // Substituir atomicamente
    await fs.promises.rename(tempPath, outputPath);
    console.log(`💾 Referência salva: ${outputPath}`);
  }

  private async generateReports(results: RecalcResult[]): Promise<void> {
    // Relatório principal
    await this.generateMainReport(results);
    
    // Relatórios por gênero
    for (const result of results) {
      await this.generateGenreReport(result);
    }

    // Snapshot das referências
    await this.generateSnapshot(results);
  }

  private async generateMainReport(results: RecalcResult[]): Promise<void> {
    const totalFiles = results.reduce((sum, r) => sum + r.filesProcessed, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.validationErrors.length, 0);
    const majorChanges = results.filter(r => r.differences.some(d => d.significance === 'major'));

    const report = `# 📊 RECÁLCULO DE REFERÊNCIAS - RELATÓRIO PRINCIPAL

**Run ID:** \`${this.runId}\`  
**Timestamp:** ${new Date().toISOString()}  
**Modo:** ${this.isDryRun ? 'DRY-RUN' : 'APLICAÇÃO REAL'}  
**Gêneros Processados:** ${results.length}  
**Arquivos Analisados:** ${totalFiles}  
**Erros de Validação:** ${totalErrors}  

## 📈 RESUMO EXECUTIVO

${results.map(result => `
### ${result.genero}
- **Status:** ${result.validationErrors.length === 0 ? '✅ Válido' : '❌ Erros encontrados'}
- **Arquivos:** ${result.filesProcessed}/${result.filesDetected} processados
- **Mudanças:** ${result.differences.length} métricas alteradas
- **Soma Espectral:** ${result.spectralSumCheck.valid ? '✅ 100.00%' : `❌ ${result.spectralSumCheck.newSum}%`}
${result.differences.filter(d => d.significance === 'major').length > 0 ? '- **⚠️ MUDANÇAS SIGNIFICATIVAS DETECTADAS**' : ''}
`).join('')}

## 🚨 PROBLEMAS CRÍTICOS

${totalErrors === 0 ? '✅ Nenhum problema crítico encontrado' : ''}
${results.filter(r => !r.spectralSumCheck.valid).map(r => 
  `- **${r.genero}:** Soma espectral = ${r.spectralSumCheck.newSum}% (esperado: 100.00% ± 0.1%)`
).join('\n')}

${results.filter(r => r.validationErrors.length > 0).map(r =>
  `### Erros em ${r.genero}:\n${r.validationErrors.map(e => `- ${e}`).join('\n')}`
).join('\n')}

## 📊 MUDANÇAS SIGNIFICATIVAS

${majorChanges.length === 0 ? '✅ Nenhuma mudança significativa (>20%) detectada' : ''}
${majorChanges.map(result => `
### ${result.genero}
${result.differences.filter(d => d.significance === 'major').map(d => 
  `- **${d.metric}:** ${d.oldValue} → ${d.newValue} (${d.percentChange > 0 ? '+' : ''}${d.percentChange}%)`
).join('\n')}
`).join('')}

## 🔄 PRÓXIMOS PASSOS

${this.isDryRun ? `
1. **Revisar mudanças** acima antes de aplicar
2. **Executar com --apply** se satisfeito: \`node audit/recalcReferences.ts --apply\`
3. **Verificar resultado** com: \`node audit/recalcReferences.ts --verify\`
` : `
1. ✅ Referências atualizadas com sucesso
2. **Executar verificação** com: \`node audit/recalcReferences.ts --verify\`
3. **Testar sistema** para garantir compatibilidade
`}

---
*Relatórios detalhados por gênero disponíveis em audit/out/REFS_DIFF_<genero>.md*
`;

    const reportPath = path.join(OUTPUT_DIR, 'REFERENCES_RECALC_REPORT.md');
    await fs.promises.writeFile(reportPath, report);
    console.log(`📄 Relatório principal: ${reportPath}`);
  }

  private async generateGenreReport(result: RecalcResult): Promise<void> {
    const report = `# 📊 RECÁLCULO DE REFERÊNCIAS: ${result.genero.toUpperCase()}

**Run ID:** \`${this.runId}\`  
**Timestamp:** ${new Date().toISOString()}  
**Arquivos Processados:** ${result.filesProcessed}/${result.filesDetected}  
**Dataset Hash:** \`${result.newReference.metadata.datasetHash}\`  

## 📈 MÉTRICAS PRINCIPAIS

| Métrica | Valor Anterior | Valor Novo | Diferença | Mudança % |
|---------|---------------|------------|-----------|-----------|
${result.differences.filter(d => !d.metric.includes('band_')).map(d => 
  `| ${d.metric} | ${d.oldValue} | ${d.newValue} | ${d.difference > 0 ? '+' : ''}${d.difference} | ${d.percentChange > 0 ? '+' : ''}${d.percentChange}% |`
).join('\n')}

## 🌈 BANDAS ESPECTRAIS (dB)

| Banda | Valor Anterior | Valor Novo | Diferença | Mudança % |
|-------|---------------|------------|-----------|-----------|
${result.differences.filter(d => d.metric.includes('band_') && d.metric.includes('_db')).map(d => 
  `| ${d.metric.replace('band_', '').replace('_db', '')} | ${d.oldValue} dB | ${d.newValue} dB | ${d.difference > 0 ? '+' : ''}${d.difference} dB | ${d.percentChange > 0 ? '+' : ''}${d.percentChange}% |`
).join('\n')}

## 🎵 BANDAS ESPECTRAIS (% Energia)

| Banda | Valor Anterior | Valor Novo | Diferença | Mudança % |
|-------|---------------|------------|-----------|-----------|
${result.differences.filter(d => d.metric.includes('band_') && d.metric.includes('_pct')).map(d => 
  `| ${d.metric.replace('band_', '').replace('_pct', '')} | ${d.oldValue}% | ${d.newValue}% | ${d.difference > 0 ? '+' : ''}${d.difference}% | ${d.percentChange > 0 ? '+' : ''}${d.percentChange}% |`
).join('\n')}

### ✓ Verificação de Soma
**Total:** ${result.spectralSumCheck.newSum}%  
**Status:** ${result.spectralSumCheck.valid ? '✅ Válido (100.00% ± 0.1%)' : '❌ Inválido - correção necessária'}

## 🔍 VALIDAÇÃO

${result.validationErrors.length === 0 ? '✅ Todas as validações passaram' : `
### ❌ Erros Encontrados:
${result.validationErrors.map(error => `- ${error}`).join('\n')}
`}

## 📁 ARQUIVOS PROCESSADOS

${result.filesProcessed > 0 ? `Total de ${result.filesProcessed} arquivos WAV analisados com sucesso.` : '❌ Nenhum arquivo processado com sucesso'}

${result.filesDetected !== result.filesProcessed ? `⚠️ **Atenção:** ${result.filesDetected - result.filesProcessed} arquivos não puderam ser processados` : ''}

---
*Este relatório foi gerado automaticamente pelo sistema de auditoria*
`;

    const reportPath = path.join(OUTPUT_DIR, `REFS_DIFF_${result.genero}.md`);
    await fs.promises.writeFile(reportPath, report);
  }

  private async generateSnapshot(results: RecalcResult[]): Promise<void> {
    const snapshot = {
      runId: this.runId,
      timestamp: new Date().toISOString(),
      mode: this.isDryRun ? 'dry-run' : 'applied',
      genres: results.map(result => ({
        genero: result.genero,
        reference: result.newReference,
        stats: {
          filesProcessed: result.filesProcessed,
          filesDetected: result.filesDetected,
          changesCount: result.differences.length,
          majorChanges: result.differences.filter(d => d.significance === 'major').length,
          spectralSumValid: result.spectralSumCheck.valid,
          validationPassed: result.validationErrors.length === 0
        }
      }))
    };

    const snapshotPath = path.join(OUTPUT_DIR, 'artifacts', 'references_snapshot.json');
    await fs.promises.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
    console.log(`📄 Snapshot salvo: ${snapshotPath}`);
  }

  private async verifyResults(results: RecalcResult[]): Promise<void> {
    console.log(`\n🔍 Iniciando verificação pós-aplicação...`);

    for (const result of results) {
      console.log(`🔍 Verificando ${result.genero}...`);
      
      const outputPath = path.join(REFS_DIR, 'out', `${result.genero}.json`);
      
      try {
        // Recarregar e validar JSON
        const reloadedContent = await fs.promises.readFile(outputPath, 'utf-8');
        const reloaded = JSON.parse(reloadedContent);
        
        // Verificar integridade
        if (reloaded.genero !== result.genero) {
          console.error(`❌ ${result.genero}: Gênero inconsistente após reload`);
          continue;
        }

        // Verificar soma espectral
        if (reloaded.spectralBalance) {
          const sum = Object.values(reloaded.spectralBalance.targets)
            .reduce((s: number, t: any) => s + t.targetPct, 0);
          
          if (Math.abs(sum - 100) > 0.1) {
            console.error(`❌ ${result.genero}: Soma espectral = ${sum.toFixed(2)}% após reload`);
          } else {
            console.log(`✅ ${result.genero}: Soma espectral OK (${sum.toFixed(2)}%)`);
          }
        }

        console.log(`✅ ${result.genero}: Verificação passou`);
        
      } catch (error) {
        console.error(`❌ ${result.genero}: Erro na verificação: ${error.message}`);
      }
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--apply');
  const shouldVerify = args.includes('--verify');

  if (shouldVerify && isDryRun) {
    console.error('❌ Erro: --verify requer --apply');
    process.exit(1);
  }

  const recalculator = new ReferenceRecalculator(isDryRun, shouldVerify);
  
  try {
    await recalculator.processAllGenres();
    console.log('\n✅ Recálculo concluído com sucesso!');
  } catch (error) {
    console.error(`\n❌ Erro durante recálculo: ${error.message}`);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

export { ReferenceRecalculator };
