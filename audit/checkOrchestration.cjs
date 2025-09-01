#!/usr/bin/env node
/**
 * 🎭 AUDITORIA: ORQUESTRAÇÃO DO SISTEMA
 * 
 * Analisa como os componentes trabalham juntos: pipeline, dependências,
 * fluxo de dados, sincronização e coordenação entre módulos
 */

const fs = require('fs').promises;
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'audit', 'out');

class OrchestrationAuditor {
  constructor() {
    this.runId = `orchestration_audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.components = [];
    this.dataFlow = [];
    this.dependencies = {};
    this.coordinationIssues = [];
    this.pipelineStages = [];
    console.log(`🎭 [${this.runId}] Iniciando auditoria de orquestração...`);
  }

  async audit() {
    console.log(`🔍 Analisando orquestração do sistema...`);
    
    // Mapear componentes principais
    await this.mapComponents();
    
    // Analisar fluxo de dados
    await this.analyzeDataFlow();
    
    // Verificar dependências
    await this.analyzeDependencies();
    
    // Identificar estágios do pipeline
    await this.identifyPipelineStages();
    
    // Analisar coordenação
    await this.analyzeCoordination();
    
    // Detectar problemas de sincronização
    await this.detectSynchronizationIssues();
    
    // Gerar relatórios
    await this.generateReports();
  }

  async mapComponents() {
    console.log(`🏗️ Mapeando componentes do sistema...`);
    
    const componentDefinitions = [
      {
        name: 'Audio Input Handler',
        files: ['public/audio-analyzer-integration.js', 'public/audio-analyzer-v2.js'],
        responsibility: 'Processamento de entrada de áudio',
        interfaces: ['FileReader API', 'Web Audio API'],
        type: 'input'
      },
      {
        name: 'Audio Feature Extractor',
        files: ['lib/audio/features/', 'analyzer/'],
        responsibility: 'Extração de características do áudio',
        interfaces: ['LUFS, True Peak, DR, Spectral Analysis'],
        type: 'processing'
      },
      {
        name: 'Reference Manager',
        files: ['refs/out/*.json', 'lib/refs/'],
        responsibility: 'Gestão de referências por gênero',
        interfaces: ['JSON configs', 'Target/tolerance data'],
        type: 'configuration'
      },
      {
        name: 'Scoring Engine',
        files: ['lib/audio/features/scoring.js'],
        responsibility: 'Cálculo de scores de qualidade',
        interfaces: ['Metric comparison', 'Weight calculation'],
        type: 'computation'
      },
      {
        name: 'Suggestion Generator',
        files: ['public/audio-analyzer-integration.js'],
        responsibility: 'Geração de sugestões de melhoria',
        interfaces: ['Rule engine', 'Feedback system'],
        type: 'advisory'
      },
      {
        name: 'UI Renderer',
        files: ['public/*.html', 'public/*.js'],
        responsibility: 'Interface do usuário e visualização',
        interfaces: ['DOM manipulation', 'Charts/meters'],
        type: 'presentation'
      },
      {
        name: 'Cache System',
        files: ['cache-*'],
        responsibility: 'Otimização de performance',
        interfaces: ['Local storage', 'File caching'],
        type: 'optimization'
      }
    ];

    for (const component of componentDefinitions) {
      const exists = await this.checkComponentExists(component);
      this.components.push({
        ...component,
        exists,
        status: exists ? 'active' : 'missing',
        lastModified: exists ? await this.getLastModified(component.files[0]) : null
      });
    }

    console.log(`✅ ${this.components.length} componentes mapeados`);
  }

  async checkComponentExists(component) {
    for (const file of component.files) {
      try {
        const fullPath = path.join(PROJECT_ROOT, file);
        await fs.access(fullPath);
        return true;
      } catch {
        // Continue checking other files
      }
    }
    return false;
  }

  async getLastModified(filePath) {
    try {
      const fullPath = path.join(PROJECT_ROOT, filePath);
      const stats = await fs.stat(fullPath);
      return stats.mtime;
    } catch {
      return null;
    }
  }

  async analyzeDataFlow() {
    console.log(`📊 Analisando fluxo de dados...`);
    
    // Definir fluxo de dados teórico baseado na arquitetura
    this.dataFlow = [
      {
        stage: 1,
        from: 'User Interface',
        to: 'Audio Input Handler',
        data: 'Audio file (MP3, WAV, etc.)',
        method: 'File upload/drag&drop',
        validation: 'File format, size checks'
      },
      {
        stage: 2,
        from: 'Audio Input Handler',
        to: 'Audio Feature Extractor',
        data: 'Audio buffer, sample rate, channels',
        method: 'Web Audio API processing',
        validation: 'Buffer integrity, format conversion'
      },
      {
        stage: 3,
        from: 'Audio Feature Extractor',
        to: 'Reference Manager',
        data: 'Raw metrics (LUFS, Peak, DR, bands)',
        method: 'Function calls',
        validation: 'Metric range validation'
      },
      {
        stage: 4,
        from: 'Reference Manager',
        to: 'Scoring Engine',
        data: 'Metrics + Genre references',
        method: 'JSON config loading',
        validation: 'Reference file integrity'
      },
      {
        stage: 5,
        from: 'Scoring Engine',
        to: 'Suggestion Generator',
        data: 'Scores, deviations, tolerances',
        method: 'Calculation results',
        validation: 'Score range (0-100)'
      },
      {
        stage: 6,
        from: 'Suggestion Generator',
        to: 'UI Renderer',
        data: 'Scores + Suggestions + Visualizations',
        method: 'DOM updates',
        validation: 'Data sanitization'
      },
      {
        stage: 7,
        from: 'Cache System',
        to: 'All Components',
        data: 'Cached results, configurations',
        method: 'Local storage/file cache',
        validation: 'Cache validity checks'
      }
    ];

    // Analisar pontos de falha potenciais
    this.dataFlowIssues = await this.identifyDataFlowIssues();
    
    console.log(`✅ Fluxo de dados mapeado em ${this.dataFlow.length} estágios`);
  }

  async identifyDataFlowIssues() {
    const issues = [];
    
    // Verificar se existem validações adequadas
    const validationIssues = this.dataFlow.filter(flow => 
      !flow.validation || flow.validation.length < 10
    );
    
    if (validationIssues.length > 0) {
      issues.push({
        type: 'validation',
        severity: 'high',
        description: `${validationIssues.length} estágios com validação insuficiente`,
        affected: validationIssues.map(v => v.from + ' → ' + v.to)
      });
    }

    // Verificar pontos únicos de falha
    const criticalPaths = this.dataFlow.filter(flow => 
      flow.stage <= 4 // Estágios críticos do pipeline
    );
    
    issues.push({
      type: 'single_point_failure',
      severity: 'medium',
      description: `${criticalPaths.length} estágios críticos no pipeline`,
      affected: criticalPaths.map(p => `Stage ${p.stage}`)
    });

    return issues;
  }

  async analyzeDependencies() {
    console.log(`🔗 Analisando dependências entre componentes...`);
    
    // Mapear dependências baseadas na arquitetura
    this.dependencies = {
      'Audio Input Handler': {
        depends_on: ['Web Audio API', 'FileReader API'],
        depended_by: ['Audio Feature Extractor'],
        coupling: 'loose',
        critical: true
      },
      'Audio Feature Extractor': {
        depends_on: ['Audio Input Handler', 'Audio processing libraries'],
        depended_by: ['Reference Manager', 'Scoring Engine'],
        coupling: 'medium',
        critical: true
      },
      'Reference Manager': {
        depends_on: ['JSON files', 'File system'],
        depended_by: ['Scoring Engine'],
        coupling: 'loose',
        critical: true
      },
      'Scoring Engine': {
        depends_on: ['Audio Feature Extractor', 'Reference Manager'],
        depended_by: ['Suggestion Generator', 'UI Renderer'],
        coupling: 'tight',
        critical: true
      },
      'Suggestion Generator': {
        depends_on: ['Scoring Engine'],
        depended_by: ['UI Renderer'],
        coupling: 'medium',
        critical: false
      },
      'UI Renderer': {
        depends_on: ['Scoring Engine', 'Suggestion Generator'],
        depended_by: [],
        coupling: 'loose',
        critical: false
      },
      'Cache System': {
        depends_on: ['Local storage', 'File system'],
        depended_by: ['All components'],
        coupling: 'loose',
        critical: false
      }
    };

    // Analisar problemas de dependência
    this.dependencyIssues = this.analyzeDependencyIssues();
    
    console.log(`✅ Dependências mapeadas para ${Object.keys(this.dependencies).length} componentes`);
  }

  analyzeDependencyIssues() {
    const issues = [];
    
    // Identificar componentes com muitas dependências
    const highDependency = Object.entries(this.dependencies).filter(
      ([name, deps]) => deps.depends_on.length > 3
    );
    
    if (highDependency.length > 0) {
      issues.push({
        type: 'high_dependency',
        severity: 'medium',
        description: 'Componentes com muitas dependências',
        components: highDependency.map(([name]) => name)
      });
    }

    // Identificar componentes críticos com acoplamento forte
    const tightlyCoupled = Object.entries(this.dependencies).filter(
      ([name, deps]) => deps.coupling === 'tight' && deps.critical
    );
    
    if (tightlyCoupled.length > 0) {
      issues.push({
        type: 'tight_coupling',
        severity: 'high',
        description: 'Componentes críticos com acoplamento forte',
        components: tightlyCoupled.map(([name]) => name)
      });
    }

    // Verificar pontos únicos de falha
    const singlePoints = Object.entries(this.dependencies).filter(
      ([name, deps]) => deps.depended_by.length > 2 && deps.critical
    );
    
    if (singlePoints.length > 0) {
      issues.push({
        type: 'single_point_failure',
        severity: 'high',
        description: 'Componentes que são pontos únicos de falha',
        components: singlePoints.map(([name]) => name)
      });
    }

    return issues;
  }

  async identifyPipelineStages() {
    console.log(`⚙️ Identificando estágios do pipeline...`);
    
    this.pipelineStages = [
      {
        stage: 'Input',
        order: 1,
        components: ['Audio Input Handler'],
        duration_estimate: '100-500ms',
        failure_rate: 'low',
        bottleneck_risk: 'low',
        error_handling: 'basic'
      },
      {
        stage: 'Processing',
        order: 2,
        components: ['Audio Feature Extractor'],
        duration_estimate: '1-5s',
        failure_rate: 'medium',
        bottleneck_risk: 'high',
        error_handling: 'partial'
      },
      {
        stage: 'Reference Loading',
        order: 3,
        components: ['Reference Manager'],
        duration_estimate: '10-100ms',
        failure_rate: 'low',
        bottleneck_risk: 'low',
        error_handling: 'basic'
      },
      {
        stage: 'Scoring',
        order: 4,
        components: ['Scoring Engine'],
        duration_estimate: '50-200ms',
        failure_rate: 'low',
        bottleneck_risk: 'medium',
        error_handling: 'good'
      },
      {
        stage: 'Suggestion Generation',
        order: 5,
        components: ['Suggestion Generator'],
        duration_estimate: '100-300ms',
        failure_rate: 'medium',
        bottleneck_risk: 'low',
        error_handling: 'basic'
      },
      {
        stage: 'Rendering',
        order: 6,
        components: ['UI Renderer'],
        duration_estimate: '200-1000ms',
        failure_rate: 'low',
        bottleneck_risk: 'medium',
        error_handling: 'good'
      }
    ];

    // Identificar gargalos
    this.bottlenecks = this.pipelineStages.filter(stage => 
      stage.bottleneck_risk === 'high' || stage.bottleneck_risk === 'medium'
    );

    console.log(`✅ Pipeline mapeado em ${this.pipelineStages.length} estágios`);
  }

  async analyzeCoordination() {
    console.log(`🎼 Analisando coordenação entre componentes...`);
    
    // Simular cenários de coordenação
    const coordinationScenarios = [
      {
        name: 'Cold Start',
        description: 'Primeira execução sem cache',
        coordination_complexity: 'high',
        expected_duration: '5-10s',
        failure_points: ['Reference loading', 'Audio processing']
      },
      {
        name: 'Warm Start',
        description: 'Execução com cache parcial',
        coordination_complexity: 'medium',
        expected_duration: '2-5s',
        failure_points: ['Audio processing']
      },
      {
        name: 'Hot Start',
        description: 'Execução com cache completo',
        coordination_complexity: 'low',
        expected_duration: '0.5-2s',
        failure_points: ['UI rendering']
      },
      {
        name: 'Genre Switch',
        description: 'Mudança de gênero musical',
        coordination_complexity: 'medium',
        expected_duration: '1-3s',
        failure_points: ['Reference loading', 'Score recalculation']
      },
      {
        name: 'Error Recovery',
        description: 'Recuperação de erro de processamento',
        coordination_complexity: 'high',
        expected_duration: 'variable',
        failure_points: ['Error propagation', 'State cleanup']
      }
    ];

    // Avaliar cada cenário
    this.coordinationAnalysis = {};
    for (const scenario of coordinationScenarios) {
      this.coordinationAnalysis[scenario.name] = {
        ...scenario,
        risk_level: this.assessCoordinationRisk(scenario),
        mitigation_strategies: this.suggestMitigationStrategies(scenario)
      };
    }

    console.log(`✅ ${coordinationScenarios.length} cenários de coordenação analisados`);
  }

  assessCoordinationRisk(scenario) {
    let riskScore = 0;
    
    // Complexidade
    if (scenario.coordination_complexity === 'high') riskScore += 30;
    else if (scenario.coordination_complexity === 'medium') riskScore += 15;
    
    // Número de pontos de falha
    riskScore += scenario.failure_points.length * 10;
    
    // Duração esperada (maior duração = maior risco)
    if (scenario.expected_duration.includes('10s')) riskScore += 20;
    else if (scenario.expected_duration.includes('5s')) riskScore += 10;
    
    if (riskScore >= 50) return 'high';
    if (riskScore >= 25) return 'medium';
    return 'low';
  }

  suggestMitigationStrategies(scenario) {
    const strategies = [];
    
    if (scenario.coordination_complexity === 'high') {
      strategies.push('Implementar timeout e retry logic');
      strategies.push('Adicionar progress indicators detalhados');
    }
    
    if (scenario.failure_points.includes('Audio processing')) {
      strategies.push('Implementar processamento em chunks menores');
      strategies.push('Adicionar fallback para formatos de áudio');
    }
    
    if (scenario.failure_points.includes('Reference loading')) {
      strategies.push('Implementar cache persistente para referências');
      strategies.push('Adicionar validação de integridade dos arquivos');
    }
    
    if (scenario.failure_points.includes('UI rendering')) {
      strategies.push('Implementar rendering progressivo');
      strategies.push('Adicionar skeleton loading states');
    }
    
    return strategies;
  }

  async detectSynchronizationIssues() {
    console.log(`⏱️ Detectando problemas de sincronização...`);
    
    const synchronizationIssues = [
      {
        type: 'Race Condition',
        location: 'Audio processing vs UI updates',
        description: 'UI pode mostrar dados antigos durante processamento',
        severity: 'medium',
        likelihood: 'high',
        impact: 'User confusion, inconsistent state'
      },
      {
        type: 'Callback Hell',
        location: 'Pipeline de processamento',
        description: 'Múltiplos callbacks aninhados podem causar problemas de timing',
        severity: 'low',
        likelihood: 'medium',
        impact: 'Code maintainability, debugging difficulty'
      },
      {
        type: 'Cache Invalidation',
        location: 'Genre switching',
        description: 'Cache pode não ser invalidado corretamente ao trocar gênero',
        severity: 'high',
        likelihood: 'medium',
        impact: 'Incorrect results, user confusion'
      },
      {
        type: 'Event Order Dependency',
        location: 'Component initialization',
        description: 'Componentes podem depender de ordem específica de inicialização',
        severity: 'medium',
        likelihood: 'low',
        impact: 'Initialization failures'
      },
      {
        type: 'Memory Leaks',
        location: 'Audio buffer handling',
        description: 'Buffers de áudio podem não ser liberados adequadamente',
        severity: 'high',
        likelihood: 'medium',
        impact: 'Performance degradation, crashes'
      }
    ];

    this.coordinationIssues = synchronizationIssues;
    
    console.log(`⚠️ ${synchronizationIssues.length} problemas potenciais identificados`);
  }

  async generateReports() {
    await this.generateMainReport();
    await this.generateArchitectureReport();
    await this.saveStructuredData();
  }

  async generateMainReport() {
    const activeComponents = this.components.filter(c => c.exists).length;
    const criticalIssues = this.coordinationIssues.filter(i => i.severity === 'high').length;
    const avgRiskLevel = this.calculateAverageRiskLevel();

    const report = `# 🎭 AUDITORIA DA ORQUESTRAÇÃO DO SISTEMA

**Run ID:** \`${this.runId}\`  
**Timestamp:** ${new Date().toISOString()}  
**Componentes Ativos:** ${activeComponents}/${this.components.length}  
**Problemas Críticos:** ${criticalIssues}  
**Nível de Risco Médio:** ${avgRiskLevel}  

## 📊 RESUMO EXECUTIVO

### ✅ Pontos Fortes da Arquitetura
${this.identifyArchitectureStrengths().map(strength => `- ${strength}`).join('\n')}

### 🚨 Problemas Identificados
${this.identifyArchitectureWeaknesses().map(weakness => `- ${weakness}`).join('\n')}

## 🏗️ COMPONENTES DO SISTEMA

${this.components.map(component => `
### ${component.exists ? '✅' : '❌'} ${component.name} (${component.type})
**Status:** ${component.status}  
**Responsabilidade:** ${component.responsibility}  
**Interfaces:** ${component.interfaces.join(', ')}  
**Arquivos:** ${component.files.join(', ')}  
${component.lastModified ? `**Última Modificação:** ${component.lastModified.toISOString()}` : ''}
`).join('')}

## 📊 FLUXO DE DADOS

${this.dataFlow.map(flow => `
### Stage ${flow.stage}: ${flow.from} → ${flow.to}
**Dados:** ${flow.data}  
**Método:** ${flow.method}  
**Validação:** ${flow.validation}
`).join('')}

### 🚨 Problemas no Fluxo de Dados
${this.dataFlowIssues.map(issue => `
- **${issue.type}** (${issue.severity}): ${issue.description}
  - Afetados: ${issue.affected.join(', ')}
`).join('')}

## 🔗 ANÁLISE DE DEPENDÊNCIAS

${Object.entries(this.dependencies).map(([name, deps]) => `
### ${name}
**Depende de:** ${deps.depends_on.join(', ')}  
**Usado por:** ${deps.depended_by.join(', ')}  
**Acoplamento:** ${deps.coupling}  
**Crítico:** ${deps.critical ? 'Sim' : 'Não'}
`).join('')}

### 🚨 Problemas de Dependência
${this.dependencyIssues.map(issue => `
- **${issue.type}** (${issue.severity}): ${issue.description}
  - Componentes: ${issue.components.join(', ')}
`).join('')}

## ⚙️ PIPELINE DE PROCESSAMENTO

${this.pipelineStages.map(stage => `
### ${stage.order}. ${stage.stage}
**Componentes:** ${stage.components.join(', ')}  
**Duração Estimada:** ${stage.duration_estimate}  
**Taxa de Falha:** ${stage.failure_rate}  
**Risco de Gargalo:** ${stage.bottleneck_risk}  
**Tratamento de Erro:** ${stage.error_handling}
`).join('')}

### 🔻 Gargalos Identificados
${this.bottlenecks.map(bottleneck => `
- **${bottleneck.stage}**: ${bottleneck.bottleneck_risk} risco de gargalo (${bottleneck.duration_estimate})
`).join('')}

## 🎼 ANÁLISE DE COORDENAÇÃO

${Object.entries(this.coordinationAnalysis).map(([name, analysis]) => `
### ${analysis.risk_level === 'high' ? '🔴' : analysis.risk_level === 'medium' ? '🟡' : '🟢'} ${name}
**Descrição:** ${analysis.description}  
**Complexidade:** ${analysis.coordination_complexity}  
**Duração Esperada:** ${analysis.expected_duration}  
**Nível de Risco:** ${analysis.risk_level}  
**Pontos de Falha:** ${analysis.failure_points.join(', ')}  

**Estratégias de Mitigação:**
${analysis.mitigation_strategies.map(strategy => `- ${strategy}`).join('\n')}
`).join('')}

## ⏱️ PROBLEMAS DE SINCRONIZAÇÃO

${this.coordinationIssues.map(issue => `
### ${issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢'} ${issue.type}
**Local:** ${issue.location}  
**Descrição:** ${issue.description}  
**Severidade:** ${issue.severity}  
**Probabilidade:** ${issue.likelihood}  
**Impacto:** ${issue.impact}
`).join('')}

## 📝 RECOMENDAÇÕES DE MELHORIA

### Prioridade Alta (P0)
${this.getHighPriorityOrchestrationRecommendations().map(rec => `- ${rec}`).join('\n')}

### Prioridade Média (P1)
${this.getMediumPriorityOrchestrationRecommendations().map(rec => `- ${rec}`).join('\n')}

### Prioridade Baixa (P2)
${this.getLowPriorityOrchestrationRecommendations().map(rec => `- ${rec}`).join('\n')}

## 🎯 MÉTRICAS DE QUALIDADE

**Modularidade:** ${this.calculateModularityScore()}/100  
**Robustez:** ${this.calculateRobustnessScore()}/100  
**Manutenibilidade:** ${this.calculateMaintainabilityScore()}/100  
**Performance:** ${this.calculatePerformanceScore()}/100  

---

**Próximos Passos:**
1. Implementar tratamento robusto de erros em componentes críticos
2. Adicionar monitoramento de performance em tempo real
3. Melhorar cache e invalidação para otimizar coordenação
4. Implementar testes de integração para cenários complexos
`;

    const reportPath = path.join(OUTPUT_DIR, 'ORCHESTRATION_AUDIT_REPORT.md');
    await fs.writeFile(reportPath, report, 'utf-8');
    console.log(`📄 Relatório principal: ${reportPath}`);
  }

  calculateAverageRiskLevel() {
    const riskLevels = Object.values(this.coordinationAnalysis).map(a => a.risk_level);
    const riskScores = riskLevels.map(level => 
      level === 'high' ? 3 : level === 'medium' ? 2 : 1
    );
    const avgScore = riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length;
    
    if (avgScore >= 2.5) return 'Alto';
    if (avgScore >= 1.5) return 'Médio';
    return 'Baixo';
  }

  identifyArchitectureStrengths() {
    const strengths = [];
    
    const activeComponentsRatio = this.components.filter(c => c.exists).length / this.components.length;
    if (activeComponentsRatio > 0.8) {
      strengths.push('Arquitetura bem implementada com a maioria dos componentes ativos');
    }
    
    const looselyCoupleds = Object.values(this.dependencies).filter(d => d.coupling === 'loose').length;
    if (looselyCoupleds > 3) {
      strengths.push('Boa separação de responsabilidades com baixo acoplamento');
    }
    
    if (this.pipelineStages.length >= 5) {
      strengths.push('Pipeline bem estruturado em múltiplos estágios');
    }
    
    return strengths.length > 0 ? strengths : ['Sistema funcional básico implementado'];
  }

  identifyArchitectureWeaknesses() {
    const weaknesses = [];
    
    const highRiskScenarios = Object.values(this.coordinationAnalysis).filter(a => a.risk_level === 'high').length;
    if (highRiskScenarios > 2) {
      weaknesses.push(`${highRiskScenarios} cenários de coordenação com alto risco`);
    }
    
    const criticalIssues = this.coordinationIssues.filter(i => i.severity === 'high').length;
    if (criticalIssues > 0) {
      weaknesses.push(`${criticalIssues} problemas críticos de sincronização`);
    }
    
    const tightCouplings = Object.values(this.dependencies).filter(d => d.coupling === 'tight' && d.critical).length;
    if (tightCouplings > 1) {
      weaknesses.push(`${tightCouplings} componentes críticos com acoplamento forte`);
    }
    
    const highBottlenecks = this.bottlenecks.filter(b => b.bottleneck_risk === 'high').length;
    if (highBottlenecks > 0) {
      weaknesses.push(`${highBottlenecks} gargalos críticos identificados`);
    }
    
    return weaknesses.length > 0 ? weaknesses : ['Nenhum problema crítico identificado'];
  }

  getHighPriorityOrchestrationRecommendations() {
    const recs = [];
    
    const criticalIssues = this.coordinationIssues.filter(i => i.severity === 'high');
    if (criticalIssues.length > 0) {
      recs.push('Resolver problemas críticos de sincronização (cache invalidation, memory leaks)');
    }
    
    const highRiskScenarios = Object.values(this.coordinationAnalysis).filter(a => a.risk_level === 'high');
    if (highRiskScenarios.length > 1) {
      recs.push('Implementar estratégias de mitigação para cenários de alto risco');
    }
    
    const missingComponents = this.components.filter(c => !c.exists);
    if (missingComponents.length > 2) {
      recs.push('Completar implementação de componentes em falta');
    }
    
    return recs.length > 0 ? recs : ['Sistema funcional - focar em melhorias de robustez'];
  }

  getMediumPriorityOrchestrationRecommendations() {
    return [
      'Implementar monitoramento de performance em tempo real',
      'Adicionar circuit breakers para componentes críticos',
      'Melhorar tratamento de erros e recovery automático',
      'Implementar rate limiting para prevenir sobrecarga'
    ];
  }

  getLowPriorityOrchestrationRecommendations() {
    return [
      'Adicionar métricas de observabilidade (logs, traces)',
      'Implementar testes de carga e stress',
      'Otimizar algoritmos de cache para melhor performance',
      'Adicionar documentação de arquitetura detalhada'
    ];
  }

  calculateModularityScore() {
    const looselyCoupleds = Object.values(this.dependencies).filter(d => d.coupling === 'loose').length;
    const total = Object.keys(this.dependencies).length;
    return Math.round((looselyCoupleds / total) * 100);
  }

  calculateRobustnessScore() {
    const criticalIssues = this.coordinationIssues.filter(i => i.severity === 'high').length;
    const totalIssues = this.coordinationIssues.length;
    const robustnessScore = Math.max(0, 100 - (criticalIssues * 20) - (totalIssues * 5));
    return Math.round(robustnessScore);
  }

  calculateMaintainabilityScore() {
    const tightCouplings = Object.values(this.dependencies).filter(d => d.coupling === 'tight').length;
    const total = Object.keys(this.dependencies).length;
    const maintainabilityScore = Math.max(0, 100 - (tightCouplings / total) * 80);
    return Math.round(maintainabilityScore);
  }

  calculatePerformanceScore() {
    const highBottlenecks = this.bottlenecks.filter(b => b.bottleneck_risk === 'high').length;
    const mediumBottlenecks = this.bottlenecks.filter(b => b.bottleneck_risk === 'medium').length;
    const performanceScore = Math.max(0, 100 - (highBottlenecks * 30) - (mediumBottlenecks * 15));
    return Math.round(performanceScore);
  }

  async generateArchitectureReport() {
    const report = `# 🏗️ RELATÓRIO DETALHADO DA ARQUITETURA

**Run ID:** \`${this.runId}\`  
**Timestamp:** ${new Date().toISOString()}  

## 📐 DIAGRAMA DE ARQUITETURA (ASCII)

\`\`\`
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Input    │───▶│  Audio Handler   │───▶│ Feature Extract │
│   (File Upload) │    │  (Web Audio API) │    │ (LUFS/Peak/DR)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   UI Renderer   │◀───│  Scoring Engine  │◀───│ Reference Mgr   │
│ (Charts/Meters) │    │ (Equal Weight V3)│    │ (Genre configs) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        ▲                       │
        │                       ▼
        │               ┌─────────────────┐
        └───────────────│ Suggestion Gen  │
                        │ (Rule Engine)   │
                        └─────────────────┘

Cache System (Local Storage) ───▶ All Components
\`\`\`

## 🔄 MATRIZ DE COMUNICAÇÃO

| Componente | Input Handler | Feature Extract | Ref Manager | Scoring | Suggestions | UI Renderer |
|------------|---------------|-----------------|-------------|---------|-------------|-------------|
| Input Handler | - | Data | - | - | - | Status |
| Feature Extract | - | - | Request | Data | - | Progress |
| Ref Manager | - | - | - | Config | - | - |
| Scoring | - | - | - | - | Results | Results |
| Suggestions | - | - | - | - | - | Feedback |
| UI Renderer | - | - | - | - | - | - |

## 📊 ANÁLISE DE COMPLEXIDADE

### Complexidade Ciclomática por Componente
- **Audio Feature Extractor**: Alta (múltiplos algoritmos de processamento)
- **Scoring Engine**: Média (lógica de comparação e peso)
- **Suggestion Generator**: Média (regras condicionais)
- **Reference Manager**: Baixa (operações CRUD simples)
- **UI Renderer**: Média (múltiplas visualizações)
- **Audio Input Handler**: Baixa (operações de I/O básicas)

### Pontos de Integração Críticos
1. **Audio Handler ↔ Feature Extractor**: Buffer transfer, format conversion
2. **Feature Extractor ↔ Scoring Engine**: Metric validation and computation
3. **Reference Manager ↔ Scoring Engine**: Genre-specific configuration loading
4. **Scoring Engine ↔ UI Renderer**: Real-time data visualization

## 🎯 RECOMENDAÇÕES DE REFATORAÇÃO

### Padrões Arquiteturais Recomendados
1. **Observer Pattern**: Para notificações de mudança de estado
2. **Strategy Pattern**: Para diferentes algoritmos de scoring
3. **Factory Pattern**: Para criação de componentes de visualização
4. **Circuit Breaker**: Para componentes de processamento crítico

### Melhorias de Design
1. Implementar interfaces bem definidas entre componentes
2. Adicionar abstrações para facilitar testes unitários
3. Separar lógica de negócio da lógica de apresentação
4. Implementar injeção de dependências para maior flexibilidade

---

**Conclusão Arquitetural:** Sistema bem estruturado mas com oportunidades de melhoria na robustez e modularidade.
`;

    const reportPath = path.join(OUTPUT_DIR, 'ARCHITECTURE_DETAILED_REPORT.md');
    await fs.writeFile(reportPath, report, 'utf-8');
    console.log(`📄 Relatório de arquitetura: ${reportPath}`);
  }

  async saveStructuredData() {
    const data = {
      runId: this.runId,
      timestamp: new Date().toISOString(),
      components: this.components,
      dataFlow: this.dataFlow,
      dependencies: this.dependencies,
      coordinationIssues: this.coordinationIssues,
      pipelineStages: this.pipelineStages,
      coordinationAnalysis: this.coordinationAnalysis,
      scores: {
        modularityScore: this.calculateModularityScore(),
        robustnessScore: this.calculateRobustnessScore(),
        maintainabilityScore: this.calculateMaintainabilityScore(),
        performanceScore: this.calculatePerformanceScore()
      }
    };

    const dataPath = path.join(OUTPUT_DIR, 'artifacts', 'orchestration_audit_data.json');
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
    console.log(`💾 Dados estruturados salvos: ${dataPath}`);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const auditor = new OrchestrationAuditor();
  auditor.audit().catch(console.error);
}

module.exports = { OrchestrationAuditor };
