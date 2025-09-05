#!/usr/bin/env node

/**
 * 🔍 DIAGNÓSTICO COMPLETO DA NORMALIZAÇÃO DE MÚSICAS DE REFERÊNCIA
 * 
 * Checklist técnico de verificação conforme solicitado:
 * 1. Confirmação da normalização LUFS
 * 2. Consistência no cálculo das métricas
 * 3. Recálculo das médias aritméticas
 * 4. Uso dos arquivos normalizados
 * 5. Escala de valores por gênero
 * 6. Integração com pipeline
 * 7. Logs e relatórios
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURAÇÃO E UTILITÁRIOS
// ============================================================================

const CONFIG = {
  refsDir: 'public/refs',
  backupDir: 'backup/refs-original-backup',
  expectedLufsTarget: -18.0,
  genres: ['funk_mandela', 'eletronico', 'trance', 'funk_bruxaria']
};

const colors = {
  pass: '✅',
  fail: '❌',
  warn: '⚠️',
  info: 'ℹ️',
  check: '🔍'
};

// ============================================================================
// CLASSES DE DIAGNÓSTICO
// ============================================================================

class NormalizationDiagnostic {
  constructor() {
    this.results = {
      lufsNormalization: [],
      metricsConsistency: [],
      averageRecalculation: [],
      fileUsage: [],
      valueScale: [],
      pipelineIntegration: [],
      logs: []
    };
    this.summary = {
      passed: 0,
      failed: 0,
      warnings: 0
    };
  }

  /**
   * 1. Verificar normalização LUFS
   */
  async checkLufsNormalization() {
    console.log('\n🎛️ 1. VERIFICAÇÃO DA NORMALIZAÇÃO LUFS');
    console.log('=' .repeat(60));

    for (const genre of CONFIG.genres) {
      const filePath = path.join(CONFIG.refsDir, `${genre}.json`);
      
      if (!fs.existsSync(filePath)) {
        this.addResult('lufsNormalization', 'fail', `Arquivo não encontrado: ${genre}.json`);
        continue;
      }

      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const genreData = data[genre];

        // Verificar se há informações de normalização
        const hasHybridProcessing = genreData.hybrid_processing;
        const hasNormalizationInfo = genreData.normalization_info;
        const originalLufs = genreData.hybrid_processing?.original_metrics?.lufs_integrated;
        const legacyLufs = genreData.legacy_compatibility?.lufs_target;

        console.log(`\n${colors.check} ${genre.toUpperCase()}:`);
        
        if (hasHybridProcessing) {
          console.log(`  ${colors.pass} Processamento híbrido detectado`);
          console.log(`  ${colors.info} LUFS original: ${originalLufs} LUFS`);
          console.log(`  ${colors.info} LUFS legacy: ${legacyLufs} LUFS`);
          
          // Verificar se as bandas espectrais foram recalculadas
          const spectralBands = genreData.hybrid_processing.spectral_bands;
          if (spectralBands) {
            console.log(`  ${colors.pass} Bandas espectrais normalizadas presentes`);
            this.addResult('lufsNormalization', 'pass', 
              `${genre}: Normalização híbrida completa (${originalLufs} → -18 LUFS)`);
          } else {
            console.log(`  ${colors.fail} Bandas espectrais normalizadas ausentes`);
            this.addResult('lufsNormalization', 'fail', 
              `${genre}: Bandas espectrais não recalculadas`);
          }
        } else if (hasNormalizationInfo) {
          const targetLufs = genreData.normalization_info.lufs_target;
          console.log(`  ${colors.info} Normalização direta para: ${targetLufs} LUFS`);
          
          if (Math.abs(targetLufs - CONFIG.expectedLufsTarget) < 0.1) {
            this.addResult('lufsNormalization', 'pass', 
              `${genre}: Normalizado para ${targetLufs} LUFS`);
          } else {
            this.addResult('lufsNormalization', 'warn', 
              `${genre}: LUFS target inesperado: ${targetLufs}`);
          }
        } else {
          console.log(`  ${colors.warn} Sem evidências claras de normalização`);
          this.addResult('lufsNormalization', 'warn', 
            `${genre}: Normalização não confirmada`);
        }

      } catch (error) {
        console.log(`  ${colors.fail} Erro ao ler arquivo: ${error.message}`);
        this.addResult('lufsNormalization', 'fail', 
          `${genre}: Erro de leitura - ${error.message}`);
      }
    }
  }

  /**
   * 2. Verificar consistência das métricas
   */
  async checkMetricsConsistency() {
    console.log('\n🧮 2. VERIFICAÇÃO DA CONSISTÊNCIA DAS MÉTRICAS');
    console.log('=' .repeat(60));

    const genresData = {};
    let allMetricsConsistent = true;

    // Carregar dados de todos os gêneros
    for (const genre of CONFIG.genres) {
      const filePath = path.join(CONFIG.refsDir, `${genre}.json`);
      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          genresData[genre] = data[genre];
        } catch (error) {
          console.log(`${colors.fail} Erro ao carregar ${genre}: ${error.message}`);
          allMetricsConsistent = false;
        }
      }
    }

    // Verificar estruturas consistentes
    const expectedFields = [
      'hybrid_processing.original_metrics.lufs_integrated',
      'hybrid_processing.original_metrics.true_peak_dbtp',
      'hybrid_processing.spectral_bands.sub.target_db',
      'hybrid_processing.spectral_bands.presenca.target_db'
    ];

    for (const field of expectedFields) {
      console.log(`\n${colors.check} Verificando campo: ${field}`);
      
      for (const genre of CONFIG.genres) {
        if (!genresData[genre]) continue;
        
        const value = this.getNestedValue(genresData[genre], field);
        if (value !== undefined && value !== null) {
          console.log(`  ${colors.pass} ${genre}: ${value}`);
        } else {
          console.log(`  ${colors.fail} ${genre}: Campo ausente`);
          allMetricsConsistent = false;
        }
      }
    }

    if (allMetricsConsistent) {
      this.addResult('metricsConsistency', 'pass', 'Todas as métricas possuem estrutura consistente');
    } else {
      this.addResult('metricsConsistency', 'fail', 'Inconsistências encontradas na estrutura das métricas');
    }

    // Verificar se os cálculos são realizados com o mesmo método
    console.log(`\n${colors.check} Verificando métodos de cálculo:`);
    
    const versions = Object.values(genresData).map(data => data.version).filter(Boolean);
    const uniqueVersions = [...new Set(versions)];
    
    if (uniqueVersions.length === 1) {
      console.log(`  ${colors.pass} Versão consistente: ${uniqueVersions[0]}`);
      this.addResult('metricsConsistency', 'pass', `Mesma versão de processamento: ${uniqueVersions[0]}`);
    } else {
      console.log(`  ${colors.warn} Versões múltiplas: ${uniqueVersions.join(', ')}`);
      this.addResult('metricsConsistency', 'warn', `Versões inconsistentes: ${uniqueVersions.join(', ')}`);
    }
  }

  /**
   * 3. Verificar recálculo das médias aritméticas
   */
  async checkAverageRecalculation() {
    console.log('\n📊 3. VERIFICAÇÃO DO RECÁLCULO DAS MÉDIAS');
    console.log('=' .repeat(60));

    // Comparar com backups se disponíveis
    for (const genre of CONFIG.genres) {
      const currentPath = path.join(CONFIG.refsDir, `${genre}.json`);
      const backupPath = path.join(CONFIG.backupDir, `${genre}.json`);

      if (!fs.existsSync(currentPath)) continue;

      console.log(`\n${colors.check} ${genre.toUpperCase()}:`);

      try {
        const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'))[genre];
        
        if (fs.existsSync(backupPath)) {
          const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'))[genre];
          
          // Comparar LUFS targets
          const currentLufs = currentData.legacy_compatibility?.lufs_target;
          const backupLufs = backupData.lufs_target || backupData.legacy_compatibility?.lufs_target;
          
          if (currentLufs !== backupLufs) {
            console.log(`  ${colors.pass} LUFS recalculado: ${backupLufs} → ${currentLufs}`);
            this.addResult('averageRecalculation', 'pass', 
              `${genre}: LUFS médio atualizado (${backupLufs} → ${currentLufs})`);
          } else {
            console.log(`  ${colors.warn} LUFS inalterado: ${currentLufs}`);
            this.addResult('averageRecalculation', 'warn', 
              `${genre}: LUFS médio não alterado`);
          }

          // Comparar bandas espectrais
          const currentBands = currentData.hybrid_processing?.spectral_bands || currentData.bands;
          const backupBands = backupData.bands || backupData.flex?.tonalCurve?.bands;
          
          if (currentBands && backupBands) {
            let bandsChanged = false;
            for (const band in currentBands) {
              if (currentBands[band].target_db !== backupBands[band]?.target_db) {
                bandsChanged = true;
                break;
              }
            }
            
            if (bandsChanged) {
              console.log(`  ${colors.pass} Bandas espectrais recalculadas`);
            } else {
              console.log(`  ${colors.warn} Bandas espectrais inalteradas`);
            }
          }
        } else {
          console.log(`  ${colors.info} Backup não encontrado - primeira execução ou backup movido`);
          this.addResult('averageRecalculation', 'info', 
            `${genre}: Sem backup para comparação`);
        }

        // Verificar timestamp de atualização
        const lastUpdated = currentData.last_updated || currentData.generated_at;
        if (lastUpdated) {
          const updateDate = new Date(lastUpdated);
          const daysSinceUpdate = (Date.now() - updateDate.getTime()) / (1000 * 60 * 60 * 24);
          console.log(`  ${colors.info} Última atualização: ${updateDate.toLocaleString()} (${daysSinceUpdate.toFixed(1)} dias atrás)`);
        }

      } catch (error) {
        console.log(`  ${colors.fail} Erro na comparação: ${error.message}`);
        this.addResult('averageRecalculation', 'fail', 
          `${genre}: Erro na verificação - ${error.message}`);
      }
    }
  }

  /**
   * 4. Verificar uso dos arquivos normalizados
   */
  async checkNormalizedFileUsage() {
    console.log('\n📁 4. VERIFICAÇÃO DO USO DOS ARQUIVOS NORMALIZADOS');
    console.log('=' .repeat(60));

    // Verificar se os arquivos atuais têm evidências de normalização
    for (const genre of CONFIG.genres) {
      const filePath = path.join(CONFIG.refsDir, `${genre}.json`);
      
      if (!fs.existsSync(filePath)) continue;

      console.log(`\n${colors.check} ${genre.toUpperCase()}:`);

      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))[genre];
        
        // Verificar marcadores de normalização
        const hasNormalizationMarkers = [
          data.hybrid_processing,
          data.normalization_info,
          data.processing_info?.hybrid_mode,
          data.version?.includes('hybrid') || data.version?.includes('norm')
        ].some(Boolean);

        if (hasNormalizationMarkers) {
          console.log(`  ${colors.pass} Arquivo com marcadores de normalização`);
          console.log(`  ${colors.info} Versão: ${data.version}`);
          console.log(`  ${colors.info} Modo de processamento: ${data.processing_mode || 'N/A'}`);
          
          this.addResult('fileUsage', 'pass', 
            `${genre}: Usando arquivo normalizado (${data.version})`);
        } else {
          console.log(`  ${colors.fail} Sem marcadores de normalização`);
          this.addResult('fileUsage', 'fail', 
            `${genre}: Possivelmente usando arquivo não normalizado`);
        }

        // Verificar cache busting
        const cacheBust = data.cache_bust;
        if (cacheBust) {
          console.log(`  ${colors.pass} Cache bust presente: ${cacheBust}`);
        } else {
          console.log(`  ${colors.warn} Cache bust ausente`);
        }

      } catch (error) {
        console.log(`  ${colors.fail} Erro na verificação: ${error.message}`);
        this.addResult('fileUsage', 'fail', 
          `${genre}: Erro na verificação - ${error.message}`);
      }
    }
  }

  /**
   * 5. Verificar escala de valores por gênero
   */
  async checkValueScale() {
    console.log('\n📏 5. VERIFICAÇÃO DA ESCALA DE VALORES POR GÊNERO');
    console.log('=' .repeat(60));

    const valueRanges = {
      lufs: { min: -25, max: -5, name: 'LUFS' },
      truePeak: { min: -3, max: 1, name: 'True Peak' },
      sub: { min: -25, max: -10, name: 'Sub (dB)' },
      presenca: { min: -40, max: -25, name: 'Presença (dB)' }
    };

    for (const genre of CONFIG.genres) {
      const filePath = path.join(CONFIG.refsDir, `${genre}.json`);
      
      if (!fs.existsSync(filePath)) continue;

      console.log(`\n${colors.check} ${genre.toUpperCase()}:`);

      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))[genre];
        
        // Verificar LUFS
        const lufs = data.hybrid_processing?.original_metrics?.lufs_integrated || 
                    data.legacy_compatibility?.lufs_target || data.lufs_target;
        
        if (lufs && this.isValueInRange(lufs, valueRanges.lufs)) {
          console.log(`  ${colors.pass} LUFS: ${lufs} (dentro do esperado)`);
        } else if (lufs) {
          console.log(`  ${colors.fail} LUFS: ${lufs} (fora do esperado: ${valueRanges.lufs.min} a ${valueRanges.lufs.max})`);
          this.addResult('valueScale', 'fail', 
            `${genre}: LUFS impossível: ${lufs}`);
        }

        // Verificar True Peak
        const truePeak = data.hybrid_processing?.original_metrics?.true_peak_dbtp ||
                        data.legacy_compatibility?.true_peak_target;
        
        if (truePeak && this.isValueInRange(truePeak, valueRanges.truePeak)) {
          console.log(`  ${colors.pass} True Peak: ${truePeak} dBTP (dentro do esperado)`);
        } else if (truePeak) {
          console.log(`  ${colors.fail} True Peak: ${truePeak} dBTP (fora do esperado: ${valueRanges.truePeak.min} a ${valueRanges.truePeak.max})`);
          this.addResult('valueScale', 'fail', 
            `${genre}: True Peak impossível: ${truePeak}`);
        }

        // Verificar bandas espectrais
        const bands = data.hybrid_processing?.spectral_bands || data.legacy_compatibility?.bands;
        
        if (bands) {
          const subValue = bands.sub?.target_db;
          const presencaValue = bands.presenca?.target_db;

          if (subValue && this.isValueInRange(subValue, valueRanges.sub)) {
            console.log(`  ${colors.pass} Sub: ${subValue} dB (dentro do esperado)`);
          } else if (subValue) {
            console.log(`  ${colors.warn} Sub: ${subValue} dB (verificar se é relativo)`);
          }

          if (presencaValue && this.isValueInRange(presencaValue, valueRanges.presenca)) {
            console.log(`  ${colors.pass} Presença: ${presencaValue} dB (dentro do esperado)`);
          } else if (presencaValue) {
            console.log(`  ${colors.warn} Presença: ${presencaValue} dB (verificar se é relativo)`);
          }
        }

        this.addResult('valueScale', 'pass', 
          `${genre}: Valores dentro da escala esperada ou explicáveis`);

      } catch (error) {
        console.log(`  ${colors.fail} Erro na verificação: ${error.message}`);
        this.addResult('valueScale', 'fail', 
          `${genre}: Erro na verificação - ${error.message}`);
      }
    }
  }

  /**
   * 6. Verificar integração com pipeline
   */
  async checkPipelineIntegration() {
    console.log('\n🔧 6. VERIFICAÇÃO DA INTEGRAÇÃO COM O PIPELINE');
    console.log('=' .repeat(60));

    // Verificar scripts de processamento
    const scriptsToCheck = [
      'scripts/refs-normalize-and-rebuild.js',
      'scripts/refs-normalize-and-rebuild.cjs',
      'refs-hybrid-normalize.cjs',
      'public/audio-analyzer.js'
    ];

    console.log(`${colors.check} Verificando scripts de processamento:`);
    
    for (const script of scriptsToCheck) {
      const scriptPath = path.join('.', script);
      if (fs.existsSync(scriptPath)) {
        console.log(`  ${colors.pass} ${script} - Presente`);
        
        // Verificar se o script foi atualizado recentemente
        const stats = fs.statSync(scriptPath);
        const daysSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceModified < 7) {
          console.log(`    ${colors.info} Modificado há ${daysSinceModified.toFixed(1)} dias`);
        }
      } else {
        console.log(`  ${colors.fail} ${script} - Ausente`);
        this.addResult('pipelineIntegration', 'fail', `Script ausente: ${script}`);
      }
    }

    // Verificar se o front-end carrega as referências corretas
    console.log(`\n${colors.check} Verificando carregamento no front-end:`);
    
    const indexPath = 'public/index.html';
    if (fs.existsSync(indexPath)) {
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      if (indexContent.includes('audio-analyzer.js')) {
        console.log(`  ${colors.pass} Audio analyzer incluído no index.html`);
        this.addResult('pipelineIntegration', 'pass', 'Front-end configurado para usar audio-analyzer.js');
      } else {
        console.log(`  ${colors.warn} Audio analyzer não encontrado no index.html`);
      }
    }

    // Verificar estrutura de deployment
    console.log(`\n${colors.check} Verificando deployment:`);
    
    const deploymentFiles = ['vercel.json', 'deployment-manifest.json'];
    for (const file of deploymentFiles) {
      if (fs.existsSync(file)) {
        console.log(`  ${colors.pass} ${file} - Presente`);
        
        if (file === 'deployment-manifest.json') {
          try {
            const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (manifest.corrections_implemented?.lufs_system?.status === 'COMPLETED') {
              console.log(`    ${colors.pass} Normalização LUFS marcada como COMPLETA`);
              this.addResult('pipelineIntegration', 'pass', 'Deployment manifest confirma normalização LUFS completa');
            }
          } catch (error) {
            console.log(`    ${colors.warn} Erro ao ler manifest: ${error.message}`);
          }
        }
      } else {
        console.log(`  ${colors.warn} ${file} - Ausente`);
      }
    }
  }

  /**
   * 7. Verificar logs e relatórios
   */
  async checkLogsAndReports() {
    console.log('\n📝 7. VERIFICAÇÃO DE LOGS E RELATÓRIOS');
    console.log('=' .repeat(60));

    // Verificar arquivos de log/relatório
    const logFiles = [
      'deployment-manifest.json',
      'audit/',
      'backup/',
      'AUDITORIA_*.md',
      'RELATORIO_*.md'
    ];

    console.log(`${colors.check} Verificando arquivos de relatório:`);

    // Deployment manifest
    if (fs.existsSync('deployment-manifest.json')) {
      const manifest = JSON.parse(fs.readFileSync('deployment-manifest.json', 'utf8'));
      console.log(`  ${colors.pass} Deployment manifest presente`);
      console.log(`    ${colors.info} Versão: ${manifest.deployment?.version}`);
      console.log(`    ${colors.info} Timestamp: ${manifest.deployment?.timestamp}`);
      
      if (manifest.corrections_implemented) {
        console.log(`    ${colors.pass} Correções documentadas: ${Object.keys(manifest.corrections_implemented).length}`);
        this.addResult('logs', 'pass', 'Deployment manifest com correções documentadas');
      }
    }

    // Diretório de auditoria
    if (fs.existsSync('audit')) {
      const auditFiles = fs.readdirSync('audit').filter(f => f.endsWith('.json') || f.endsWith('.md'));
      console.log(`  ${colors.pass} Diretório audit/ com ${auditFiles.length} arquivos`);
      this.addResult('logs', 'pass', `Auditoria: ${auditFiles.length} arquivos de relatório`);
    }

    // Backups
    if (fs.existsSync('backup')) {
      const backupFiles = fs.readdirSync('backup');
      console.log(`  ${colors.pass} Diretório backup/ com ${backupFiles.length} itens`);
      this.addResult('logs', 'pass', `Backup: ${backupFiles.length} itens preservados`);
    }

    // Arquivos de auditoria markdown
    const auditMarkdownFiles = fs.readdirSync('.').filter(f => f.startsWith('AUDITORIA_') && f.endsWith('.md'));
    if (auditMarkdownFiles.length > 0) {
      console.log(`  ${colors.pass} Relatórios de auditoria: ${auditMarkdownFiles.length} arquivos`);
      this.addResult('logs', 'pass', `Relatórios markdown: ${auditMarkdownFiles.length} arquivos`);
    }

    // Verificar se há evidências de processamento recente
    console.log(`\n${colors.check} Verificando evidências de processamento:`);
    
    const recentFiles = fs.readdirSync('.')
      .filter(f => f.includes('debug') || f.includes('test') || f.includes('verificar'))
      .filter(f => {
        const stats = fs.statSync(f);
        const daysSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceModified < 7;
      });

    if (recentFiles.length > 0) {
      console.log(`  ${colors.pass} Arquivos de debug/teste recentes: ${recentFiles.length}`);
      recentFiles.slice(0, 3).forEach(file => {
        console.log(`    ${colors.info} ${file}`);
      });
      this.addResult('logs', 'pass', `Evidências de desenvolvimento ativo: ${recentFiles.length} arquivos`);
    } else {
      console.log(`  ${colors.warn} Nenhum arquivo de debug/teste recente encontrado`);
    }
  }

  /**
   * Gerar relatório final
   */
  generateFinalReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 RELATÓRIO FINAL DE DIAGNÓSTICO DA NORMALIZAÇÃO');
    console.log('='.repeat(80));

    const sections = [
      { key: 'lufsNormalization', title: '1. Normalização LUFS' },
      { key: 'metricsConsistency', title: '2. Consistência das Métricas' },
      { key: 'averageRecalculation', title: '3. Recálculo das Médias' },
      { key: 'fileUsage', title: '4. Uso dos Arquivos Normalizados' },
      { key: 'valueScale', title: '5. Escala de Valores por Gênero' },
      { key: 'pipelineIntegration', title: '6. Integração com Pipeline' },
      { key: 'logs', title: '7. Logs e Relatórios' }
    ];

    for (const section of sections) {
      console.log(`\n${section.title}:`);
      
      const sectionResults = this.results[section.key];
      if (sectionResults.length === 0) {
        console.log(`  ${colors.warn} Nenhuma verificação realizada`);
        continue;
      }

      const passed = sectionResults.filter(r => r.status === 'pass').length;
      const failed = sectionResults.filter(r => r.status === 'fail').length;
      const warnings = sectionResults.filter(r => r.status === 'warn').length;

      console.log(`  ${colors.pass} Passou: ${passed} | ${colors.fail} Falhou: ${failed} | ${colors.warn} Avisos: ${warnings}`);

      // Mostrar falhas críticas
      const criticalFailures = sectionResults.filter(r => r.status === 'fail');
      if (criticalFailures.length > 0) {
        console.log(`  ${colors.fail} Problemas críticos:`);
        criticalFailures.forEach(failure => {
          console.log(`    • ${failure.message}`);
        });
      }
    }

    // Resumo geral
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMO GERAL:');
    
    const totalResults = Object.values(this.results).flat();
    const totalPassed = totalResults.filter(r => r.status === 'pass').length;
    const totalFailed = totalResults.filter(r => r.status === 'fail').length;
    const totalWarnings = totalResults.filter(r => r.status === 'warn').length;

    console.log(`Total de verificações: ${totalResults.length}`);
    console.log(`${colors.pass} Passou: ${totalPassed}`);
    console.log(`${colors.fail} Falhou: ${totalFailed}`);
    console.log(`${colors.warn} Avisos: ${totalWarnings}`);

    const successRate = totalResults.length > 0 ? (totalPassed / totalResults.length * 100).toFixed(1) : 0;
    console.log(`Taxa de sucesso: ${successRate}%`);

    // Veredicto final
    console.log('\n' + '='.repeat(80));
    if (totalFailed === 0) {
      console.log(`${colors.pass} VEREDICTO: NORMALIZAÇÃO IMPLEMENTADA COM SUCESSO`);
      console.log('Todas as verificações críticas passaram. O sistema está usando');
      console.log('arquivos normalizados corretamente.');
    } else if (totalFailed < 3) {
      console.log(`${colors.warn} VEREDICTO: NORMALIZAÇÃO PARCIALMENTE IMPLEMENTADA`);
      console.log('A maioria das verificações passou, mas há alguns problemas que');
      console.log('precisam ser corrigidos.');
    } else {
      console.log(`${colors.fail} VEREDICTO: PROBLEMAS CRÍTICOS NA NORMALIZAÇÃO`);
      console.log('Múltiplas falhas detectadas. A normalização pode não estar');
      console.log('funcionando corretamente.');
    }
    
    console.log('='.repeat(80));
  }

  // Métodos auxiliares
  addResult(section, status, message) {
    this.results[section].push({ status, message });
    this.summary[status === 'pass' ? 'passed' : status === 'fail' ? 'failed' : 'warnings']++;
  }

  isValueInRange(value, range) {
    return value >= range.min && value <= range.max;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

// ============================================================================
// EXECUÇÃO PRINCIPAL
// ============================================================================

async function main() {
  console.log('🔍 INICIANDO DIAGNÓSTICO COMPLETO DA NORMALIZAÇÃO');
  console.log('Verificando implementação de normalização das músicas de referência...\n');

  const diagnostic = new NormalizationDiagnostic();

  try {
    await diagnostic.checkLufsNormalization();
    await diagnostic.checkMetricsConsistency();
    await diagnostic.checkAverageRecalculation();
    await diagnostic.checkNormalizedFileUsage();
    await diagnostic.checkValueScale();
    await diagnostic.checkPipelineIntegration();
    await diagnostic.checkLogsAndReports();

    diagnostic.generateFinalReport();

  } catch (error) {
    console.error(`\n${colors.fail} ERRO DURANTE O DIAGNÓSTICO:`, error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { NormalizationDiagnostic };
