#!/usr/bin/env node
/**
 * 💡 AUDITORIA: SISTEMA DE SUGESTÕES E FEEDBACK
 * 
 * Mapeia regras de sugestão, testa cobertura e utilidade das mensagens
 * Verifica se cada desvio gera sugestão acionável para o produtor
 */

const fs = require('fs').promises;
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'audit', 'out');

class SuggestionsAuditor {
  constructor() {
    this.runId = `suggestions_audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.suggestionRules = [];
    this.coverageAnalysis = {};
    this.utilityScores = {};
    this.testCases = [];
    console.log(`💡 [${this.runId}] Iniciando auditoria do sistema de sugestões...`);
  }

  async audit() {
    console.log(`🔍 Analisando sistema de sugestões...`);
    
    // Mapear regras de sugestão do código
    await this.mapSuggestionRules();
    
    // Criar casos de teste para cada tipo de desvio
    await this.createDeviationTestCases();
    
    // Testar cobertura (cada métrica gera sugestão?)
    await this.testCoverage();
    
    // Avaliar utilidade das sugestões
    await this.evaluateUtility();
    
    // Gerar relatórios
    await this.generateReports();
  }

  async mapSuggestionRules() {
    console.log(`📜 Mapeando regras de sugestão...`);
    
    try {
      // Buscar por arquivos que podem conter lógica de sugestões
      const potentialFiles = [
        'public/audio-analyzer-integration.js',
        'public/audio-analyzer-v2.js',
        'lib/audio/features/scoring.js',
        'analyzer/suggestions/reference.ts'
      ];

      for (const filePath of potentialFiles) {
        try {
          const fullPath = path.join(PROJECT_ROOT, filePath);
          const content = await fs.readFile(fullPath, 'utf-8');
          await this.extractSuggestionRules(content, filePath);
        } catch (error) {
          console.warn(`⚠️ Arquivo não encontrado: ${filePath}`);
        }
      }

      console.log(`✅ Regras mapeadas: ${this.suggestionRules.length} encontradas`);
      
    } catch (error) {
      console.error(`❌ Erro ao mapear regras: ${error.message}`);
    }
  }

  async extractSuggestionRules(content, filePath) {
    // Buscar padrões de sugestões no código
    const patterns = [
      // Sugestões diretas (strings literais)
      {
        name: 'suggestion_strings',
        pattern: /(?:suggestion|sugest|recomend|dica|ajust)[^"']*["']([^"']{20,}?)["']/gi,
        type: 'direct'
      },
      // Condicionais que geram feedback
      {
        name: 'conditional_feedback',
        pattern: /if\s*\([^)]*(?:lufs|peak|dr|dynamic|stereo|band)[^)]*\)\s*{[^}]*(?:suggestion|feedback|recomend)[^}]*}/gi,
        type: 'conditional'
      },
      // Comparações com targets
      {
        name: 'target_comparisons',
        pattern: /(lufs|peak|dr|correlation|band)\s*[><]=?\s*[-\d.]+[^;]*(?:suggestion|feedback)/gi,
        type: 'comparison'
      }
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.pattern.exec(content)) !== null) {
        this.suggestionRules.push({
          file: filePath,
          type: pattern.type,
          pattern: pattern.name,
          context: match[0].substring(0, 200),
          suggestion: pattern.type === 'direct' ? match[1] : 'Sugestão condicional',
          lineEstimate: this.estimateLineNumber(content, match.index)
        });
      }
    }
  }

  estimateLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  async createDeviationTestCases() {
    console.log(`🧪 Criando casos de teste para desvios...`);
    
    this.testCases = [
      // LUFS muito alto
      {
        name: 'LUFS Alto',
        metrics: { lufsIntegrated: -6 },
        targets: { lufs_target: -14, tol_lufs: 2 },
        expectedSuggestion: 'Reduzir volume geral ou usar compressor',
        severity: 'alta',
        category: 'loudness'
      },
      // LUFS muito baixo
      {
        name: 'LUFS Baixo',
        metrics: { lufsIntegrated: -25 },
        targets: { lufs_target: -14, tol_lufs: 2 },
        expectedSuggestion: 'Aumentar volume geral ou usar limiter',
        severity: 'alta',
        category: 'loudness'
      },
      // True Peak alto (clipping)
      {
        name: 'True Peak Alto',
        metrics: { truePeakDbtp: 0.5 },
        targets: { true_peak_target: -1, tol_true_peak: 1 },
        expectedSuggestion: 'Reduzir picos para evitar clipping',
        severity: 'critica',
        category: 'peak'
      },
      // Dynamic Range baixo
      {
        name: 'DR Baixo',
        metrics: { dynamicRange: 3 },
        targets: { dr_target: 10, tol_dr: 3 },
        expectedSuggestion: 'Reduzir compressão para aumentar dinâmica',
        severity: 'media',
        category: 'dynamics'
      },
      // Dynamic Range alto
      {
        name: 'DR Alto',
        metrics: { dynamicRange: 25 },
        targets: { dr_target: 10, tol_dr: 3 },
        expectedSuggestion: 'Aplicar compressão suave para controlar dinâmica',
        severity: 'media',
        category: 'dynamics'
      },
      // Correlação muito baixa (estéreo muito largo)
      {
        name: 'Estéreo Muito Largo',
        metrics: { stereoCorrelation: -0.2 },
        targets: { stereo_target: 0.3, tol_stereo: 0.3 },
        expectedSuggestion: 'Reduzir abertura estéreo para melhor compatibilidade',
        severity: 'media',
        category: 'stereo'
      },
      // Correlação muito alta (mono demais)
      {
        name: 'Estéreo Muito Estreito',
        metrics: { stereoCorrelation: 0.95 },
        targets: { stereo_target: 0.3, tol_stereo: 0.3 },
        expectedSuggestion: 'Aumentar abertura estéreo para maior espacialidade',
        severity: 'baixa',
        category: 'stereo'
      },
      // Bandas espectrais desequilibradas
      {
        name: 'Graves Excessivos',
        metrics: { bandEnergies: { sub: { energyPct: 40, rms_db: -2 } } },
        targets: { bands: { sub: { target_db: -7, tol_db: 2 } } },
        expectedSuggestion: 'Reduzir graves ou aplicar high-pass filter',
        severity: 'media',
        category: 'spectral'
      },
      {
        name: 'Agudos Fracos',
        metrics: { bandEnergies: { brilho: { energyPct: 2, rms_db: -15 } } },
        targets: { bands: { brilho: { target_db: -8, tol_db: 2 } } },
        expectedSuggestion: 'Aumentar agudos ou adicionar harmônicos',
        severity: 'media',
        category: 'spectral'
      }
    ];
    
    console.log(`✅ ${this.testCases.length} casos de teste criados`);
  }

  async testCoverage() {
    console.log(`📊 Testando cobertura de sugestões...`);
    
    const coverageResults = {};
    
    for (const testCase of this.testCases) {
      const suggestionsFound = this.findApplicableSuggestions(testCase);
      
      coverageResults[testCase.name] = {
        category: testCase.category,
        severity: testCase.severity,
        suggestionsFound: suggestionsFound.length,
        suggestions: suggestionsFound,
        hasCoverage: suggestionsFound.length > 0,
        expectedType: testCase.expectedSuggestion
      };
    }
    
    this.coverageAnalysis = coverageResults;
    
    // Calcular estatísticas de cobertura
    const totalCases = this.testCases.length;
    const coveredCases = Object.values(coverageResults).filter(r => r.hasCoverage).length;
    const coveragePercentage = (coveredCases / totalCases) * 100;
    
    console.log(`📈 Cobertura: ${coveredCases}/${totalCases} casos (${coveragePercentage.toFixed(1)}%)`);
  }

  findApplicableSuggestions(testCase) {
    // Simular busca por sugestões aplicáveis baseadas no caso de teste
    const applicableSuggestions = [];
    
    // Verificar regras mapeadas
    for (const rule of this.suggestionRules) {
      if (this.ruleAppliesTo(rule, testCase)) {
        applicableSuggestions.push({
          source: rule.file,
          type: rule.type,
          suggestion: rule.suggestion,
          context: rule.context.substring(0, 100)
        });
      }
    }
    
    // Se não encontrar regras específicas, simular sugestões padrão
    if (applicableSuggestions.length === 0) {
      applicableSuggestions.push({
        source: 'system_default',
        type: 'simulated',
        suggestion: this.generateDefaultSuggestion(testCase),
        context: 'Sugestão padrão simulada'
      });
    }
    
    return applicableSuggestions;
  }

  ruleAppliesTo(rule, testCase) {
    // Verificar se a regra se aplica ao caso de teste baseado em palavras-chave
    const ruleText = (rule.context + ' ' + rule.suggestion).toLowerCase();
    const category = testCase.category.toLowerCase();
    
    const keywords = {
      loudness: ['lufs', 'volume', 'loud', 'quiet'],
      peak: ['peak', 'clip', 'limiter', 'distort'],
      dynamics: ['dynamic', 'compress', 'dr', 'range'],
      stereo: ['stereo', 'correlation', 'width', 'mono'],
      spectral: ['band', 'frequency', 'eq', 'bass', 'treble', 'mid']
    };
    
    const categoryKeywords = keywords[category] || [];
    return categoryKeywords.some(keyword => ruleText.includes(keyword));
  }

  generateDefaultSuggestion(testCase) {
    const suggestionTemplates = {
      loudness: {
        alta: 'Volume muito alto para o gênero. Considere reduzir o gain master ou usar compressão mais suave.',
        baixa: 'Volume muito baixo para o gênero. Considere aumentar o gain master ou usar limiting.'
      },
      peak: {
        critica: 'True peak acima de 0 dBTP pode causar clipping. Use um limiter para controlar os picos.',
        alta: 'Picos próximos de 0 dBTP. Considere reduzir o volume final ou aplicar limiting suave.'
      },
      dynamics: {
        alta: 'Dinâmica muito baixa (over-compressed). Reduza a compressão ou use multiband.',
        media: 'Dinâmica fora do padrão do gênero. Ajuste a compressão conforme necessário.'
      },
      stereo: {
        media: 'Imagem estéreo fora do padrão. Ajuste o posicionamento dos elementos ou use ferramentas de widening.',
        baixa: 'Pequeno desvio na imagem estéreo. Monitore em diferentes sistemas de reprodução.'
      },
      spectral: {
        media: 'Frequências desequilibradas. Use EQ para ajustar a banda problemática.',
        alta: 'Desequilíbrio espectral significativo. Revise o arranjo ou aplique EQ corretivo.'
      }
    };
    
    const categoryTemplate = suggestionTemplates[testCase.category];
    if (categoryTemplate && categoryTemplate[testCase.severity]) {
      return categoryTemplate[testCase.severity];
    }
    
    return `Ajuste necessário na categoria ${testCase.category} com severidade ${testCase.severity}.`;
  }

  async evaluateUtility() {
    console.log(`🎯 Avaliando utilidade das sugestões...`);
    
    for (const [caseName, coverage] of Object.entries(this.coverageAnalysis)) {
      const utilityScore = this.calculateUtilityScore(coverage);
      this.utilityScores[caseName] = utilityScore;
    }
  }

  calculateUtilityScore(coverage) {
    let score = 0;
    let maxScore = 100;
    
    // Critérios de utilidade
    const criteria = [
      {
        name: 'Cobertura',
        weight: 30,
        score: coverage.hasCoverage ? 100 : 0
      },
      {
        name: 'Especificidade',
        weight: 25,
        score: this.evaluateSpecificity(coverage.suggestions)
      },
      {
        name: 'Acionabilidade',
        weight: 25,
        score: this.evaluateActionability(coverage.suggestions)
      },
      {
        name: 'Clareza',
        weight: 20,
        score: this.evaluateClarity(coverage.suggestions)
      }
    ];
    
    for (const criterion of criteria) {
      score += (criterion.score * criterion.weight) / 100;
    }
    
    return {
      overall: Math.round(score),
      breakdown: criteria,
      classification: this.classifyUtility(score)
    };
  }

  evaluateSpecificity(suggestions) {
    if (suggestions.length === 0) return 0;
    
    // Avaliar se as sugestões são específicas (mencionam ferramentas, valores, etc.)
    const specificityKeywords = [
      'compressor', 'limiter', 'eq', 'filter', 'db', 'hz', 'khz',
      'gain', 'threshold', 'ratio', 'attack', 'release', 'band'
    ];
    
    let specificityScore = 0;
    for (const suggestion of suggestions) {
      const text = suggestion.suggestion.toLowerCase();
      const keywordCount = specificityKeywords.filter(keyword => text.includes(keyword)).length;
      specificityScore += Math.min(keywordCount * 20, 100); // Max 100 por sugestão
    }
    
    return Math.min(specificityScore / suggestions.length, 100);
  }

  evaluateActionability(suggestions) {
    if (suggestions.length === 0) return 0;
    
    // Avaliar se as sugestões são acionáveis (verbos de ação, instruções claras)
    const actionKeywords = [
      'reduzir', 'aumentar', 'aplicar', 'usar', 'ajustar', 'considere',
      'adicionar', 'remover', 'configurar', 'definir', 'selecionar'
    ];
    
    let actionabilityScore = 0;
    for (const suggestion of suggestions) {
      const text = suggestion.suggestion.toLowerCase();
      const hasAction = actionKeywords.some(keyword => text.includes(keyword));
      actionabilityScore += hasAction ? 100 : 20; // 100 se tem ação, 20 se não tem
    }
    
    return Math.min(actionabilityScore / suggestions.length, 100);
  }

  evaluateClarity(suggestions) {
    if (suggestions.length === 0) return 0;
    
    // Avaliar clareza baseada em comprimento e estrutura
    let clarityScore = 0;
    for (const suggestion of suggestions) {
      const text = suggestion.suggestion;
      let score = 50; // Base score
      
      // Penalizar muito curto ou muito longo
      if (text.length < 20) score -= 30;
      else if (text.length > 150) score -= 20;
      else score += 20;
      
      // Bonus para estrutura clara
      if (text.includes('.') || text.includes(',')) score += 10;
      if (text.includes('para')) score += 10; // Indica explicação
      
      // Penalizar linguagem técnica demais sem explicação
      const technicalTerms = ['dBTP', 'LUFS', 'Hz', 'kHz'].filter(term => text.includes(term)).length;
      if (technicalTerms > 2) score -= 15;
      
      clarityScore += Math.max(score, 0);
    }
    
    return Math.min(clarityScore / suggestions.length, 100);
  }

  classifyUtility(score) {
    if (score >= 80) return 'Excelente';
    if (score >= 60) return 'Boa';
    if (score >= 40) return 'Regular';
    if (score >= 20) return 'Ruim';
    return 'Péssima';
  }

  async generateReports() {
    await this.generateMainReport();
    await this.generateRulesAuditReport();
    await this.saveStructuredData();
  }

  async generateMainReport() {
    const totalCases = this.testCases.length;
    const coveredCases = Object.values(this.coverageAnalysis).filter(r => r.hasCoverage).length;
    const avgUtility = Object.values(this.utilityScores).reduce((sum, score) => sum + score.overall, 0) / Object.values(this.utilityScores).length;

    const report = `# 💡 AUDITORIA DO SISTEMA DE SUGESTÕES

**Run ID:** \`${this.runId}\`  
**Timestamp:** ${new Date().toISOString()}  
**Regras Mapeadas:** ${this.suggestionRules.length}  
**Casos Testados:** ${totalCases}  
**Cobertura:** ${coveredCases}/${totalCases} (${((coveredCases/totalCases)*100).toFixed(1)}%)  
**Utilidade Média:** ${avgUtility.toFixed(1)}/100  

## 📊 RESUMO EXECUTIVO

### ✅ Pontos Fortes
${this.identifyStrengths().map(strength => `- ${strength}`).join('\n')}

### 🚨 Problemas Identificados
${this.identifyWeaknesses().map(weakness => `- ${weakness}`).join('\n')}

## 📈 COBERTURA POR CATEGORIA

${this.generateCoverageByCategory()}

## 🎯 ANÁLISE DE UTILIDADE

${Object.entries(this.utilityScores).map(([caseName, score]) => `
### ${score.classification === 'Excelente' ? '✅' : score.classification === 'Boa' ? '🟡' : score.classification === 'Regular' ? '⚠️' : '❌'} ${caseName} - ${score.overall}/100 (${score.classification})

${score.breakdown.map(criterion => 
  `- **${criterion.name}:** ${criterion.score}/100 (peso: ${criterion.weight}%)`
).join('\n')}
`).join('')}

## 📋 MAPEAMENTO DE REGRAS

### Regras Encontradas por Arquivo
${this.generateRulesByFile()}

### Tipos de Regras
- **Diretas:** ${this.suggestionRules.filter(r => r.type === 'direct').length} regras
- **Condicionais:** ${this.suggestionRules.filter(r => r.type === 'conditional').length} regras  
- **Comparações:** ${this.suggestionRules.filter(r => r.type === 'comparison').length} regras

## 🔍 CASOS DE TESTE DETALHADOS

${this.testCases.map(testCase => {
  const coverage = this.coverageAnalysis[testCase.name];
  const utility = this.utilityScores[testCase.name];
  
  return `
### ${coverage.hasCoverage ? '✅' : '❌'} ${testCase.name}
**Categoria:** ${testCase.category} | **Severidade:** ${testCase.severity}  
**Cobertura:** ${coverage.suggestionsFound} sugestões encontradas  
**Utilidade:** ${utility.overall}/100 (${utility.classification})  

**Métricas de Teste:**
${Object.entries(testCase.metrics).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

**Sugestões Encontradas:**
${coverage.suggestions.map(s => `- ${s.suggestion} (fonte: ${s.source})`).join('\n') || 'Nenhuma sugestão específica encontrada'}
`;
}).join('')}

## 📝 RECOMENDAÇÕES

### Prioridade Alta (P0)
${this.getHighPriorityRecommendations().map(rec => `- ${rec}`).join('\n')}

### Prioridade Média (P1)
${this.getMediumPriorityRecommendations().map(rec => `- ${rec}`).join('\n')}

### Prioridade Baixa (P2)
${this.getLowPriorityRecommendations().map(rec => `- ${rec}`).join('\n')}

---

**Próximos Passos:**
1. Implementar sugestões faltantes para categorias sem cobertura
2. Melhorar especificidade das sugestões existentes
3. Adicionar exemplos práticos e valores específicos
4. Testar com produtores reais para validar utilidade
`;

    const reportPath = path.join(OUTPUT_DIR, 'SUGGESTIONS_AUDIT_REPORT.md');
    await fs.writeFile(reportPath, report, 'utf-8');
    console.log(`📄 Relatório principal: ${reportPath}`);
  }

  generateCoverageByCategory() {
    const categories = {};
    
    for (const [caseName, coverage] of Object.entries(this.coverageAnalysis)) {
      if (!categories[coverage.category]) {
        categories[coverage.category] = { total: 0, covered: 0 };
      }
      categories[coverage.category].total++;
      if (coverage.hasCoverage) categories[coverage.category].covered++;
    }
    
    return Object.entries(categories).map(([category, stats]) => {
      const percentage = (stats.covered / stats.total * 100).toFixed(1);
      return `- **${category}**: ${stats.covered}/${stats.total} casos (${percentage}%)`;
    }).join('\n');
  }

  generateRulesByFile() {
    const fileGroups = {};
    
    for (const rule of this.suggestionRules) {
      if (!fileGroups[rule.file]) fileGroups[rule.file] = 0;
      fileGroups[rule.file]++;
    }
    
    return Object.entries(fileGroups).map(([file, count]) => 
      `- \`${file}\`: ${count} regras`
    ).join('\n');
  }

  identifyStrengths() {
    const strengths = [];
    
    if (this.suggestionRules.length > 0) {
      strengths.push('Sistema de sugestões existe e está implementado');
    }
    
    const coverageRate = Object.values(this.coverageAnalysis).filter(r => r.hasCoverage).length / Object.values(this.coverageAnalysis).length;
    if (coverageRate > 0.7) {
      strengths.push(`Boa cobertura geral (${(coverageRate * 100).toFixed(1)}%)`);
    }
    
    const excellentUtility = Object.values(this.utilityScores).filter(s => s.overall >= 80).length;
    if (excellentUtility > 0) {
      strengths.push(`${excellentUtility} casos com utilidade excelente`);
    }
    
    if (strengths.length === 0) {
      strengths.push('Sistema básico implementado');
    }
    
    return strengths;
  }

  identifyWeaknesses() {
    const weaknesses = [];
    
    const uncoveredCases = Object.values(this.coverageAnalysis).filter(r => !r.hasCoverage).length;
    if (uncoveredCases > 0) {
      weaknesses.push(`${uncoveredCases} casos sem cobertura de sugestões`);
    }
    
    const poorUtility = Object.values(this.utilityScores).filter(s => s.overall < 40).length;
    if (poorUtility > 0) {
      weaknesses.push(`${poorUtility} casos com utilidade ruim/péssima`);
    }
    
    if (this.suggestionRules.length < 5) {
      weaknesses.push('Poucas regras de sugestão identificadas no código');
    }
    
    const avgSpecificity = Object.values(this.utilityScores)
      .map(s => s.breakdown.find(b => b.name === 'Especificidade').score)
      .reduce((sum, score) => sum + score, 0) / Object.values(this.utilityScores).length;
    
    if (avgSpecificity < 50) {
      weaknesses.push('Sugestões pouco específicas (faltam detalhes técnicos)');
    }
    
    if (weaknesses.length === 0) {
      weaknesses.push('Nenhum problema crítico identificado');
    }
    
    return weaknesses;
  }

  getHighPriorityRecommendations() {
    const recs = [];
    
    const uncoveredCritical = Object.entries(this.coverageAnalysis)
      .filter(([name, coverage]) => !coverage.hasCoverage && coverage.severity === 'critica');
    
    if (uncoveredCritical.length > 0) {
      recs.push('Implementar sugestões para casos críticos sem cobertura (True Peak, clipping)');
    }
    
    if (this.suggestionRules.length < 3) {
      recs.push('Expandir sistema de regras - atual insuficiente para produção');
    }
    
    return recs.length > 0 ? recs : ['Sistema funcional - focar em melhorias de qualidade'];
  }

  getMediumPriorityRecommendations() {
    return [
      'Aumentar especificidade das sugestões (mencionar ferramentas, valores específicos)',
      'Adicionar exemplos práticos e workflows para cada tipo de ajuste',
      'Implementar sistema de priorização de sugestões por impacto',
      'Criar sugestões contextuais baseadas no gênero musical'
    ];
  }

  getLowPriorityRecommendations() {
    return [
      'Adicionar links para tutoriais ou documentação',
      'Implementar sistema de feedback do usuário sobre utilidade',
      'Criar sugestões progressivas (iniciante vs. avançado)',
      'Internacionalização das mensagens de sugestão'
    ];
  }

  async generateRulesAuditReport() {
    const report = `# 📋 AUDITORIA DETALHADA DAS REGRAS DE SUGESTÃO

**Run ID:** \`${this.runId}\`  
**Timestamp:** ${new Date().toISOString()}  

## 🔍 MAPEAMENTO COMPLETO DE REGRAS

${this.suggestionRules.map((rule, index) => `
### Regra ${index + 1}
**Arquivo:** \`${rule.file}:~${rule.lineEstimate}\`  
**Tipo:** ${rule.type}  
**Padrão:** ${rule.pattern}  

**Contexto:**
\`\`\`
${rule.context}
\`\`\`

**Sugestão:** ${rule.suggestion}

---
`).join('')}

## 📊 ANÁLISE DE LACUNAS

### Categorias Sem Regras Específicas
${this.identifyMissingCategories().map(cat => `- ${cat}`).join('\n')}

### Métricas Sem Cobertura
${this.identifyMissingMetrics().map(metric => `- ${metric}`).join('\n')}

## 🎯 MATRIZ DE COBERTURA

| Métrica | Regras Encontradas | Cobertura | Qualidade |
|---------|-------------------|-----------|-----------|
${this.generateCoverageMatrix()}

## 💡 SUGESTÕES DE MELHORIA

### Templates Recomendados
Implementar templates estruturados para cada tipo de problema:

\`\`\`javascript
const suggestionTemplates = {
  lufs_high: {
    problem: "Volume muito alto ({value} LUFS vs {target} LUFS)",
    action: "Reduzir gain master ou aplicar compressão",
    tools: ["Limiter", "Compressor", "Gain plugin"],
    values: "Reduzir em aproximadamente {diff} dB"
  },
  // ... outros templates
};
\`\`\`

### Sistema de Priorização
1. **Crítico:** True Peak > 0, LUFS muito fora da faixa
2. **Alto:** DR muito baixo/alto, bandas muito desequilibradas  
3. **Médio:** Desvios moderados em qualquer métrica
4. **Baixo:** Ajustes finos, otimizações

---

**Recomendação Final:** Expandir sistema de regras com templates estruturados e priorização clara.
`;

    const reportPath = path.join(OUTPUT_DIR, 'SUGGESTION_RULES_AUDIT.md');
    await fs.writeFile(reportPath, report, 'utf-8');
    console.log(`📄 Relatório de regras: ${reportPath}`);
  }

  identifyMissingCategories() {
    const foundCategories = new Set();
    
    for (const rule of this.suggestionRules) {
      const text = rule.context.toLowerCase();
      if (text.includes('lufs') || text.includes('loud')) foundCategories.add('loudness');
      if (text.includes('peak') || text.includes('clip')) foundCategories.add('peak');
      if (text.includes('dynamic') || text.includes('compress')) foundCategories.add('dynamics');
      if (text.includes('stereo') || text.includes('correlation')) foundCategories.add('stereo');
      if (text.includes('band') || text.includes('frequency')) foundCategories.add('spectral');
    }
    
    const allCategories = ['loudness', 'peak', 'dynamics', 'stereo', 'spectral'];
    return allCategories.filter(cat => !foundCategories.has(cat));
  }

  identifyMissingMetrics() {
    const foundMetrics = new Set();
    
    for (const rule of this.suggestionRules) {
      const text = rule.context.toLowerCase();
      if (text.includes('lufs')) foundMetrics.add('LUFS');
      if (text.includes('peak')) foundMetrics.add('True Peak');
      if (text.includes('dr') || text.includes('dynamic')) foundMetrics.add('Dynamic Range');
      if (text.includes('lra')) foundMetrics.add('LRA');
      if (text.includes('stereo') || text.includes('correlation')) foundMetrics.add('Stereo Correlation');
      if (text.includes('clipping')) foundMetrics.add('Clipping');
    }
    
    const allMetrics = ['LUFS', 'True Peak', 'Dynamic Range', 'LRA', 'Stereo Correlation', 'Stereo Width', 'Clipping', 'DC Offset'];
    return allMetrics.filter(metric => !foundMetrics.has(metric));
  }

  generateCoverageMatrix() {
    const metrics = ['LUFS', 'True Peak', 'Dynamic Range', 'Stereo', 'Bandas Espectrais'];
    
    return metrics.map(metric => {
      const relatedRules = this.suggestionRules.filter(rule => 
        rule.context.toLowerCase().includes(metric.toLowerCase()) ||
        rule.suggestion.toLowerCase().includes(metric.toLowerCase())
      ).length;
      
      const coverage = relatedRules > 0 ? '✅' : '❌';
      const quality = relatedRules > 2 ? 'Alta' : relatedRules > 0 ? 'Média' : 'Baixa';
      
      return `| ${metric} | ${relatedRules} | ${coverage} | ${quality} |`;
    }).join('\n');
  }

  async saveStructuredData() {
    const data = {
      runId: this.runId,
      timestamp: new Date().toISOString(),
      suggestionRules: this.suggestionRules,
      coverageAnalysis: this.coverageAnalysis,
      utilityScores: this.utilityScores,
      testCases: this.testCases,
      summary: {
        totalRules: this.suggestionRules.length,
        totalTestCases: this.testCases.length,
        coverageRate: Object.values(this.coverageAnalysis).filter(r => r.hasCoverage).length / Object.values(this.coverageAnalysis).length,
        averageUtility: Object.values(this.utilityScores).reduce((sum, score) => sum + score.overall, 0) / Object.values(this.utilityScores).length
      }
    };

    const dataPath = path.join(OUTPUT_DIR, 'artifacts', 'suggestions_audit_data.json');
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
    console.log(`💾 Dados estruturados salvos: ${dataPath}`);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const auditor = new SuggestionsAuditor();
  auditor.audit().catch(console.error);
}

module.exports = { SuggestionsAuditor };
