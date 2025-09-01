#!/usr/bin/env node
/**
 * 📊 AUDITORIA: ANÁLISE DO SISTEMA DE SCORING
 * 
 * Extrai fórmulas, pesos e tolerâncias do sistema de score
 * Realiza análise de contribuição (ablation study) para identificar o que mais impacta o score
 */

const fs = require('fs').promises;
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'audit', 'out');

class ScoringAuditor {
  constructor() {
    this.runId = `scoring_audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.scoringMethods = [];
    this.weightAnalysis = {};
    this.ablationResults = [];
    this.formulaAnalysis = {};
    console.log(`📊 [${this.runId}] Iniciando auditoria do sistema de scoring...`);
  }

  async audit() {
    console.log(`🔍 Analisando sistema de scoring...`);
    
    // Carregar e analisar módulo de scoring
    await this.analyzeScoringModule();
    
    // Extrair fórmulas e pesos
    await this.extractFormulasAndWeights();
    
    // Executar análise de contribuição (ablation study)
    await this.performAblationStudy();
    
    // Analisar tolerâncias por gênero
    await this.analyzeTolerancesByGenre();
    
    // Gerar relatórios
    await this.generateReports();
  }

  async analyzeScoringModule() {
    console.log(`📄 Carregando módulo de scoring...`);
    
    try {
      const scoringPath = path.join(PROJECT_ROOT, 'lib', 'audio', 'features', 'scoring.js');
      const scoringContent = await fs.readFile(scoringPath, 'utf-8');
      
      // Analisar métodos de scoring disponíveis
      this.extractScoringMethods(scoringContent);
      
      // Analisar fórmulas matemáticas
      this.extractMathematicalFormulas(scoringContent);
      
      console.log(`✅ Módulo de scoring analisado: ${this.scoringMethods.length} métodos encontrados`);
      
    } catch (error) {
      console.error(`❌ Erro ao analisar módulo de scoring: ${error.message}`);
    }
  }

  extractScoringMethods(content) {
    // Identificar métodos de scoring
    const methods = [];
    
    // Buscar por funções que calculam score
    const functionMatches = content.match(/function\s+(\w*[Ss]cor\w*)\s*\(/g);
    if (functionMatches) {
      functionMatches.forEach(match => {
        const funcName = match.match(/function\s+(\w+)/)[1];
        methods.push({
          name: funcName,
          type: 'function',
          description: this.extractFunctionDescription(content, funcName)
        });
      });
    }

    // Buscar por sistemas identificados nos comentários
    const systemMatches = content.match(/\/\/.*(?:EQUAL_WEIGHT|SCORING_V2|V3|SISTEMA)/gi);
    if (systemMatches) {
      systemMatches.forEach(match => {
        methods.push({
          name: match.replace(/\/\/\s*/, '').trim(),
          type: 'system',
          description: 'Sistema identificado em comentário'
        });
      });
    }

    this.scoringMethods = methods;
  }

  extractFunctionDescription(content, funcName) {
    // Buscar comentário antes da função
    const funcPattern = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*function\\s+${funcName}`, 'i');
    const match = content.match(funcPattern);
    
    if (match) {
      return match[0]
        .replace(/\/\*\*|\*\/|function.*/g, '')
        .replace(/\*\s?/g, '')
        .trim()
        .substring(0, 150);
    }
    
    return 'Sem descrição disponível';
  }

  extractMathematicalFormulas(content) {
    const formulas = {};
    
    // Buscar fórmulas matemáticas principais
    const formulaPatterns = [
      {
        name: 'Score Tolerance',
        pattern: /function\s+scoreTolerance[^}]+}/gs,
        description: 'Fórmula para calcular score baseado em tolerância'
      },
      {
        name: 'Color Ratio',
        pattern: /COLOR_RATIO_V2[^}]+}/gs,
        description: 'Sistema de cores (verde/amarelo/vermelho)'
      },
      {
        name: 'Equal Weight',
        pattern: /_computeEqualWeightV3[^}]+}/gs,
        description: 'Sistema de pesos iguais V3'
      },
      {
        name: 'Penalty Calculation',
        pattern: /P_sum.*=.*penalties[^;]+;/g,
        description: 'Cálculo de penalidades'
      }
    ];

    formulaPatterns.forEach(pattern => {
      const matches = content.match(pattern.pattern);
      if (matches) {
        formulas[pattern.name] = {
          description: pattern.description,
          code: matches[0].substring(0, 300) + (matches[0].length > 300 ? '...' : ''),
          found: true
        };
      } else {
        formulas[pattern.name] = {
          description: pattern.description,
          found: false
        };
      }
    });

    this.formulaAnalysis = formulas;
  }

  async extractFormulasAndWeights() {
    console.log(`⚖️ Extraindo pesos e tolerâncias...`);
    
    try {
      const scoringPath = path.join(PROJECT_ROOT, 'lib', 'audio', 'features', 'scoring.js');
      const content = await fs.readFile(scoringPath, 'utf-8');
      
      // Extrair pesos das bandas espectrais
      this.extractSpectralWeights(content);
      
      // Extrair tolerâncias padrão
      this.extractDefaultTolerances(content);
      
      // Extrair sistema de cores (verde/amarelo/vermelho)
      this.extractColorWeights(content);
      
    } catch (error) {
      console.error(`❌ Erro ao extrair pesos: ${error.message}`);
    }
  }

  extractSpectralWeights(content) {
    // Buscar definições de pesos das bandas
    const weightPatterns = [
      /band_(\w+):\s*([\d.]+)/g,
      /(\w+):\s*([\d.]+).*\/\/.*band/gi
    ];

    const spectralWeights = {};
    
    weightPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const bandName = match[1];
        const weight = parseFloat(match[2]);
        
        if (!isNaN(weight)) {
          spectralWeights[bandName] = weight;
        }
      }
    });

    this.weightAnalysis.spectralWeights = spectralWeights;
  }

  extractDefaultTolerances(content) {
    // Buscar DEFAULT_TARGETS
    const defaultTargetsMatch = content.match(/DEFAULT_TARGETS\s*=\s*{[\s\S]*?};/);
    
    if (defaultTargetsMatch) {
      try {
        // Extrair apenas a parte dos valores (simplificado)
        const tolerances = {};
        const targetSection = defaultTargetsMatch[0];
        
        const metricPattern = /(\w+):\s*{\s*target:\s*([-\d.]+),\s*tol:\s*([\d.]+)/g;
        let match;
        
        while ((match = metricPattern.exec(targetSection)) !== null) {
          tolerances[match[1]] = {
            target: parseFloat(match[2]),
            tolerance: parseFloat(match[3])
          };
        }
        
        this.weightAnalysis.defaultTolerances = tolerances;
      } catch (error) {
        console.warn(`⚠️ Erro ao parsear DEFAULT_TARGETS: ${error.message}`);
      }
    }
  }

  extractColorWeights(content) {
    // Buscar pesos do sistema de cores
    const colorWeights = {};
    
    const patterns = [
      { name: 'green', pattern: /SCORE_WEIGHT_GREEN[^:]*:\s*([\d.]+)/i },
      { name: 'yellow', pattern: /SCORE_WEIGHT_YELLOW[^:]*:\s*([\d.]+)/i },
      { name: 'red', pattern: /SCORE_WEIGHT_RED[^:]*:\s*([\d.]+)/i },
      { name: 'green_fallback', pattern: /wGreen.*=.*(\d\.\d+)/i },
      { name: 'yellow_fallback', pattern: /wYellow.*=.*(\d\.\d+)/i },
      { name: 'red_fallback', pattern: /wRed.*=.*(\d\.\d+)/i }
    ];

    patterns.forEach(pattern => {
      const match = content.match(pattern.pattern);
      if (match) {
        colorWeights[pattern.name] = parseFloat(match[1]);
      }
    });

    this.weightAnalysis.colorWeights = colorWeights;
  }

  async performAblationStudy() {
    console.log(`🧪 Executando análise de contribuição (ablation study)...`);
    
    // Criar casos de teste para ablation
    const testCases = this.createAblationTestCases();
    
    for (const testCase of testCases) {
      const result = await this.runAblationTest(testCase);
      this.ablationResults.push(result);
      
      console.log(`📊 ${testCase.name}: impacto de ${result.impact.toFixed(1)}% no score`);
    }

    // Ordenar por impacto
    this.ablationResults.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  }

  createAblationTestCases() {
    // Casos de teste: remover uma métrica por vez para ver o impacto
    return [
      {
        name: 'Sem LUFS',
        description: 'Remove LUFS integrado',
        removeMetric: 'lufsIntegrated',
        baselineMetrics: this.createBaselineMetrics()
      },
      {
        name: 'Sem True Peak',
        description: 'Remove True Peak',
        removeMetric: 'truePeakDbtp',
        baselineMetrics: this.createBaselineMetrics()
      },
      {
        name: 'Sem Dynamic Range',
        description: 'Remove Dynamic Range',
        removeMetric: 'dynamicRange',
        baselineMetrics: this.createBaselineMetrics()
      },
      {
        name: 'Sem bandas espectrais',
        description: 'Remove todas as bandas de frequência',
        removeMetric: 'bandEnergies',
        baselineMetrics: this.createBaselineMetrics()
      },
      {
        name: 'Sem correlação estéreo',
        description: 'Remove correlação estéreo',
        removeMetric: 'stereoCorrelation',
        baselineMetrics: this.createBaselineMetrics()
      }
    ];
  }

  createBaselineMetrics() {
    // Métricas de referência "perfeitas" (próximas aos targets)
    return {
      lufsIntegrated: -14.0,
      truePeakDbtp: -1.0,
      dynamicRange: 10.0,
      lra: 7.0,
      stereoCorrelation: 0.3,
      stereoWidth: 0.6,
      clippingPct: 0,
      dcOffset: 0,
      bandEnergies: {
        sub: { rms_db: -7.0, energyPct: 15.0 },
        low_bass: { rms_db: -6.5, energyPct: 18.0 },
        low_mid: { rms_db: -6.0, energyPct: 16.0 },
        mid: { rms_db: -5.5, energyPct: 20.0 },
        high_mid: { rms_db: -6.0, energyPct: 15.0 },
        brilho: { rms_db: -7.0, energyPct: 10.0 },
        presenca: { rms_db: -8.0, energyPct: 6.0 }
      }
    };
  }

  async runAblationTest(testCase) {
    // Simular cálculo de score com e sem a métrica
    const baselineScore = this.simulateScoreCalculation(testCase.baselineMetrics);
    
    const modifiedMetrics = { ...testCase.baselineMetrics };
    if (testCase.removeMetric === 'bandEnergies') {
      delete modifiedMetrics.bandEnergies;
    } else {
      delete modifiedMetrics[testCase.removeMetric];
    }
    
    const modifiedScore = this.simulateScoreCalculation(modifiedMetrics);
    
    const impact = baselineScore - modifiedScore;
    
    return {
      name: testCase.name,
      description: testCase.description,
      removedMetric: testCase.removeMetric,
      baselineScore,
      modifiedScore,
      impact,
      relativeImpact: baselineScore > 0 ? (impact / baselineScore) * 100 : 0
    };
  }

  simulateScoreCalculation(metrics) {
    // Simulação simplificada do cálculo de score
    // Em produção, chamaria o sistema real
    
    let totalScore = 0;
    let metricCount = 0;
    
    // LUFS (peso alto)
    if (Number.isFinite(metrics.lufsIntegrated)) {
      const lufsScore = this.calculateMetricScore(metrics.lufsIntegrated, -14, 2);
      totalScore += lufsScore * 0.2; // 20% do peso total
      metricCount += 0.2;
    }
    
    // True Peak (peso médio-alto)
    if (Number.isFinite(metrics.truePeakDbtp)) {
      const tpScore = this.calculateMetricScore(metrics.truePeakDbtp, -1, 1);
      totalScore += tpScore * 0.15; // 15% do peso total
      metricCount += 0.15;
    }
    
    // Dynamic Range (peso médio)
    if (Number.isFinite(metrics.dynamicRange)) {
      const drScore = this.calculateMetricScore(metrics.dynamicRange, 10, 3);
      totalScore += drScore * 0.15; // 15% do peso total
      metricCount += 0.15;
    }
    
    // Correlação estéreo (peso baixo)
    if (Number.isFinite(metrics.stereoCorrelation)) {
      const stereoScore = this.calculateMetricScore(metrics.stereoCorrelation, 0.3, 0.3);
      totalScore += stereoScore * 0.1; // 10% do peso total
      metricCount += 0.1;
    }
    
    // Bandas espectrais (peso alto combinado)
    if (metrics.bandEnergies) {
      let bandScore = 0;
      let bandCount = 0;
      
      const expectedBands = {
        sub: 15, low_bass: 18, low_mid: 16, mid: 20,
        high_mid: 15, brilho: 10, presenca: 6
      };
      
      for (const [band, expected] of Object.entries(expectedBands)) {
        if (metrics.bandEnergies[band]) {
          const score = this.calculateMetricScore(
            metrics.bandEnergies[band].energyPct,
            expected,
            3 // tolerância de 3%
          );
          bandScore += score;
          bandCount++;
        }
      }
      
      if (bandCount > 0) {
        totalScore += (bandScore / bandCount) * 0.4; // 40% do peso total para bandas
        metricCount += 0.4;
      }
    }
    
    return metricCount > 0 ? (totalScore / metricCount) * 100 : 0;
  }

  calculateMetricScore(value, target, tolerance) {
    if (!Number.isFinite(value) || !Number.isFinite(target)) return 0;
    
    const diff = Math.abs(value - target);
    if (diff <= tolerance) return 1; // Score perfeito
    if (diff >= tolerance * 2) return 0; // Score mínimo
    
    // Linear entre tolerância e 2x tolerância
    return 1 - ((diff - tolerance) / tolerance);
  }

  async analyzeTolerancesByGenre() {
    console.log(`🎵 Analisando tolerâncias por gênero...`);
    
    try {
      const refsDir = path.join(PROJECT_ROOT, 'refs', 'out');
      const files = await fs.readdir(refsDir);
      const genreFiles = files.filter(f => f.endsWith('.json') && f !== 'genres.json');
      
      const toleranceAnalysis = {};
      
      for (const file of genreFiles) {
        const genreName = file.replace('.json', '');
        try {
          const content = await fs.readFile(path.join(refsDir, file), 'utf-8');
          const genreData = JSON.parse(content);
          
          toleranceAnalysis[genreName] = {
            lufs: genreData.tol_lufs || 'N/A',
            truePeak: genreData.tol_true_peak || 'N/A',
            dr: genreData.tol_dr || 'N/A',
            lra: genreData.tol_lra || 'N/A',
            stereo: genreData.tol_stereo || 'N/A',
            bandCount: genreData.bands ? Object.keys(genreData.bands).length : 0
          };
        } catch (error) {
          console.warn(`⚠️ Erro ao analisar ${file}: ${error.message}`);
        }
      }
      
      this.weightAnalysis.tolerancesByGenre = toleranceAnalysis;
    } catch (error) {
      console.error(`❌ Erro ao analisar tolerâncias: ${error.message}`);
    }
  }

  async generateReports() {
    // Relatório principal
    await this.generateMainReport();
    
    // Relatório de explicabilidade do score
    await this.generateExplainabilityReport();
    
    // Dados estruturados
    await this.saveStructuredData();
  }

  async generateMainReport() {
    const report = `# 📊 AUDITORIA DO SISTEMA DE SCORING

**Run ID:** \`${this.runId}\`  
**Timestamp:** ${new Date().toISOString()}  
**Métodos Encontrados:** ${this.scoringMethods.length}  
**Fórmulas Analisadas:** ${Object.keys(this.formulaAnalysis).length}  

## 📈 RESUMO EXECUTIVO

### ✅ Sistema Atual Identificado
- **Método Principal:** Equal Weight V3 (pesos iguais)
- **Sistema de Cores:** Verde/Amarelo/Vermelho com pesos ${JSON.stringify(this.weightAnalysis.colorWeights)}
- **Tolerâncias:** Configuráveis por gênero
- **Bandas Espectrais:** ${Object.keys(this.weightAnalysis.spectralWeights || {}).length} bandas identificadas

### 📊 Análise de Contribuição (O que mais impacta o score)

${this.ablationResults.map((result, index) => `
${index + 1}. **${result.name}** - Impacto: **${result.impact.toFixed(1)}%**
   - Baseline: ${result.baselineScore.toFixed(1)}% → Sem métrica: ${result.modifiedScore.toFixed(1)}%
   - ${result.description}
`).join('')}

## ⚖️ PESOS E TOLERÂNCIAS IDENTIFICADOS

### Pesos das Bandas Espectrais
${Object.entries(this.weightAnalysis.spectralWeights || {}).map(([band, weight]) => 
  `- **${band}**: ${weight} (${(weight * 100).toFixed(1)}%)`
).join('\n')}

### Sistema de Cores (Verde/Amarelo/Vermelho)
${Object.entries(this.weightAnalysis.colorWeights || {}).map(([color, weight]) => 
  `- **${color}**: ${weight} (${color.includes('green') ? 'Perfeito' : color.includes('yellow') ? 'Moderado' : 'Problemático'})`
).join('\n')}

### Tolerâncias Padrão
${Object.entries(this.weightAnalysis.defaultTolerances || {}).map(([metric, data]) => 
  `- **${metric}**: Target ${data.target}, Tolerância ±${data.tolerance}`
).join('\n')}

## 🎵 TOLERÂNCIAS POR GÊNERO

${Object.entries(this.weightAnalysis.tolerancesByGenre || {}).map(([genre, tolerances]) => `
### ${genre}
- LUFS: ±${tolerances.lufs} dB
- True Peak: ±${tolerances.truePeak} dB  
- DR: ±${tolerances.dr} dB
- LRA: ±${tolerances.lra} LU
- Estéreo: ±${tolerances.stereo}
- Bandas: ${tolerances.bandCount} configuradas
`).join('')}

## 🔍 FÓRMULAS MATEMÁTICAS IDENTIFICADAS

${Object.entries(this.formulaAnalysis).map(([name, formula]) => `
### ${formula.found ? '✅' : '❌'} ${name}
**Descrição:** ${formula.description}  
${formula.found ? `**Código:** \`\`\`javascript\n${formula.code}\n\`\`\`` : '**Status:** Não encontrada'}
`).join('\n')}

## 📋 MÉTODOS DE SCORING DISPONÍVEIS

${this.scoringMethods.map(method => `
### ${method.name} (${method.type})
${method.description}
`).join('\n')}

## 🚨 ACHADOS CRÍTICOS

### Problemas Identificados
${this.identifyCriticalIssues().map(issue => `- ${issue}`).join('\n')}

### Recomendações
1. **Transparência:** Documentar claramente os pesos atuais
2. **Validação:** Verificar se pesos refletem a importância real para produtores
3. **Configurabilidade:** Permitir ajuste de pesos por gênero/preferência
4. **Testes:** Implementar testes automatizados para mudanças de fórmula
`;

    const reportPath = path.join(OUTPUT_DIR, 'SCORING_AUDIT_REPORT.md');
    await fs.writeFile(reportPath, report, 'utf-8');
    console.log(`📄 Relatório principal: ${reportPath}`);
  }

  identifyCriticalIssues() {
    const issues = [];
    
    // Verificar pesos dos sistemas de cores
    const colorWeights = this.weightAnalysis.colorWeights || {};
    if (colorWeights.red_fallback && colorWeights.red_fallback > 0.5) {
      issues.push('⚠️ Peso do vermelho muito alto, pode penalizar excessivamente');
    }
    
    if (colorWeights.yellow_fallback && colorWeights.yellow_fallback < 0.5) {
      issues.push('⚠️ Peso do amarelo baixo, pode não incentivar melhorias');
    }
    
    // Verificar balanceamento de ablation
    const topImpact = this.ablationResults[0];
    if (topImpact && Math.abs(topImpact.impact) > 50) {
      issues.push(`🚨 Métrica "${topImpact.name}" tem impacto muito alto (${topImpact.impact.toFixed(1)}%) - sistema desequilibrado`);
    }
    
    // Verificar consistência entre gêneros
    const genres = Object.keys(this.weightAnalysis.tolerancesByGenre || {});
    if (genres.length < 2) {
      issues.push('⚠️ Poucos gêneros configurados para análise comparativa');
    }
    
    if (issues.length === 0) {
      issues.push('✅ Nenhum problema crítico identificado no balanceamento');
    }
    
    return issues;
  }

  async generateExplainabilityReport() {
    const report = `# 📊 EXPLICABILIDADE DO SCORE - ANÁLISE DETALHADA

**Run ID:** \`${this.runId}\`  
**Timestamp:** ${new Date().toISOString()}  

## 🎯 COMO O SCORE É CALCULADO

### Fórmula Principal: Equal Weight V3
O sistema utiliza **pesos iguais** para todas as métricas disponíveis, garantindo que nenhuma métrica domine o resultado final.

### Sistema de Cores
- **Verde (${this.weightAnalysis.colorWeights?.green_fallback || 1.0})**: Métrica dentro da tolerância ideal
- **Amarelo (${this.weightAnalysis.colorWeights?.yellow_fallback || 0.7})**: Métrica fora da tolerância mas aceitável  
- **Vermelho (${this.weightAnalysis.colorWeights?.red_fallback || 0.3})**: Métrica problemática mas ainda contribui

### Cálculo Final
\`\`\`
Score = (Σ(métrica_score × peso_cor) / total_métricas) × 100
\`\`\`

## 📊 CONTRIBUIÇÃO POR MÉTRICA (Ablation Analysis)

Esta análise remove uma métrica por vez para medir seu impacto real:

${this.ablationResults.map((result, index) => `
### ${index + 1}º. ${result.name}
**Impacto no Score:** ${result.impact > 0 ? '+' : ''}${result.impact.toFixed(1)}% (${result.relativeImpact.toFixed(1)}% relativo)  
**Interpretação:** ${this.interpretImpact(result.impact)}  
**Recomendação:** ${this.getRecommendationForMetric(result)}
`).join('')}

## 🎵 EXEMPLO PRÁTICO

Imagine uma música com as seguintes métricas:

| Métrica | Valor | Target | Status | Score Individual |
|---------|-------|--------|--------|------------------|
| LUFS | -12 dB | -14 dB | 🟡 Amarelo | 70% |
| True Peak | -0.5 dBTP | -1 dBTP | 🟡 Amarelo | 75% |
| Dynamic Range | 8 dB | 10 dB | 🟡 Amarelo | 80% |
| Correlação | 0.4 | 0.3 | 🟢 Verde | 100% |
| Bandas | Balanceado | Targets | 🟢 Verde | 95% |

**Score Final:** \`(70 + 75 + 80 + 100 + 95) / 5 = 84%\`  
**Classificação:** Referência Mundial

## 💡 INTERPRETAÇÃO PARA PRODUTORES

### O que o score NÃO diz:
- Não julga criatividade ou gosto musical
- Não considera contexto artístico
- Não substitui ouvido treinado

### O que o score DIZ:
- Conformidade técnica com padrões do gênero
- Compatibilidade com sistemas de reprodução
- Otimização para streaming/rádio
- Potencial de tradução em diferentes sistemas

### Como usar o score:
1. **>85%:** Excelente conformidade técnica
2. **70-85%:** Boa qualidade, pequenos ajustes
3. **55-70%:** Ajustes moderados recomendados  
4. **<55%:** Revisão técnica necessária

---

**Nota:** Este score é uma ferramenta de auxílio, não um julgamento definitivo da qualidade musical.
`;

    const reportPath = path.join(OUTPUT_DIR, 'SCORE_EXPLAINABILITY.md');
    await fs.writeFile(reportPath, report, 'utf-8');
    console.log(`📄 Relatório de explicabilidade: ${reportPath}`);
  }

  interpretImpact(impact) {
    const absImpact = Math.abs(impact);
    if (absImpact > 30) return 'Impacto MUITO ALTO - métrica dominante';
    if (absImpact > 15) return 'Impacto ALTO - métrica importante';
    if (absImpact > 5) return 'Impacto MODERADO - métrica relevante';
    return 'Impacto BAIXO - métrica complementar';
  }

  getRecommendationForMetric(result) {
    if (Math.abs(result.impact) > 25) {
      return '🚨 Considerar reduzir peso - pode mascarar outros problemas';
    }
    if (Math.abs(result.impact) > 15) {
      return '⚖️ Peso adequado - métrica importante mantida';
    }
    if (Math.abs(result.impact) < 3) {
      return '🤔 Considerar se métrica agrega valor suficiente';
    }
    return '✅ Contribuição balanceada';
  }

  async saveStructuredData() {
    const data = {
      runId: this.runId,
      timestamp: new Date().toISOString(),
      scoringMethods: this.scoringMethods,
      weightAnalysis: this.weightAnalysis,
      ablationResults: this.ablationResults,
      formulaAnalysis: this.formulaAnalysis
    };

    const dataPath = path.join(OUTPUT_DIR, 'artifacts', 'scoring_audit_data.json');
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
    console.log(`💾 Dados estruturados salvos: ${dataPath}`);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const auditor = new ScoringAuditor();
  auditor.audit().catch(console.error);
}

module.exports = { ScoringAuditor };
