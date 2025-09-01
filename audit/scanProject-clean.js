#!/usr/bin/env node
/**
 * 🔍 AUDITORIA: SCAN DO PROJETO - MAPEAMENTO COMPLETO DO PIPELINE
 * 
 * Inventário de módulos relevantes e diagrama do pipeline de análise de mixagem
 * Modo: READ-ONLY, nenhuma alteração no código de produção
 */

const fs = require('fs').promises;
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'audit', 'out');

class ProjectScanner {
  constructor() {
    this.runId = `scan_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.modules = [];
    this.pipeline = [];
    console.log(`🔍 [${this.runId}] Iniciando scan do projeto...`);
  }

  async scan() {
    console.log(`📁 Escaneando estrutura do projeto...`);
    
    // Escanear módulos principais
    await this.scanDirectory(PROJECT_ROOT, ['node_modules', '.git', 'audit', 'backup']);
    
    // Mapear pipeline
    this.mapPipeline();
    
    // Gerar relatório
    await this.generateReport();
  }

  async scanDirectory(dir, exclude = []) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (exclude.includes(entry.name)) continue;
      
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath, exclude);
      } else if (this.isRelevantFile(entry.name)) {
        await this.analyzeFile(fullPath);
      }
    }
  }

  isRelevantFile(filename) {
    const relevantExtensions = ['.js', '.ts', '.json'];
    const relevantPatterns = [
      /audio.*analyzer/i,
      /scoring/i,
      /loudness/i,
      /truepeak/i,
      /spectral/i,
      /dynamic.*range/i,
      /metrics/i,
      /reference/i,
      /genre/i
    ];
    
    if (!relevantExtensions.some(ext => filename.endsWith(ext))) return false;
    
    return relevantPatterns.some(pattern => pattern.test(filename)) ||
           filename.includes('audio') ||
           filename.includes('mix') ||
           filename.includes('feature');
  }

  async analyzeFile(filePath) {
    try {
      const relativePath = path.relative(PROJECT_ROOT, filePath);
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      
      const moduleInfo = {
        path: relativePath,
        type: this.classifyModule(relativePath, content),
        description: this.extractDescription(content),
        dependencies: this.extractDependencies(content),
        exports: this.extractExports(content),
        size: stats.size,
        lastModified: stats.mtime
      };
      
      this.modules.push(moduleInfo);
    } catch (error) {
      console.warn(`⚠️ Erro ao analisar ${filePath}: ${error.message}`);
    }
  }

  classifyModule(relativePath, content) {
    if (relativePath.includes('refs/')) return 'refs';
    if (relativePath.includes('public/') || relativePath.includes('ui/')) return 'ui';
    if (relativePath.includes('scoring') || content.includes('calculateScore')) return 'scoring';
    if (relativePath.includes('lib/audio/features/')) return 'core';
    if (relativePath.includes('integration') || content.includes('bridge')) return 'bridge';
    if (relativePath.includes('test') || content.includes('describe(')) return 'test';
    if (relativePath.endsWith('.json')) return 'config';
    return 'core';
  }

  extractDescription(content) {
    // Extrair comentários de cabeçalho
    const headerComments = content.match(/\/\*\*[\s\S]*?\*\//);
    if (headerComments) {
      return headerComments[0]
        .replace(/\/\*\*|\*\/|\*\s?/g, '')
        .split('\n')[0]
        .trim()
        .substring(0, 100);
    }
    
    // Extrair primeira linha de comentário
    const lineComment = content.match(/\/\/\s*(.+)/);
    if (lineComment) {
      return lineComment[1].substring(0, 100);
    }
    
    return 'Sem descrição disponível';
  }

  extractDependencies(content) {
    const deps = [];
    
    // Import statements
    const imports = content.match(/import.*from\s+['"]([^'"]+)['"]/g);
    if (imports) {
      imports.forEach(imp => {
        const match = imp.match(/from\s+['"]([^'"]+)['"]/);
        if (match) deps.push(match[1]);
      });
    }
    
    // Require statements
    const requires = content.match(/require\(['"]([^'"]+)['"]\)/g);
    if (requires) {
      requires.forEach(req => {
        const match = req.match(/require\(['"]([^'"]+)['"]\)/);
        if (match) deps.push(match[1]);
      });
    }
    
    return [...new Set(deps)];
  }

  extractExports(content) {
    const exports = [];
    
    // Function exports
    const functions = content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g);
    if (functions) {
      functions.forEach(func => {
        const match = func.match(/function\s+(\w+)/);
        if (match) exports.push(match[1]);
      });
    }
    
    // Class exports
    const classes = content.match(/(?:export\s+)?class\s+(\w+)/g);
    if (classes) {
      classes.forEach(cls => {
        const match = cls.match(/class\s+(\w+)/);
        if (match) exports.push(match[1]);
      });
    }
    
    // Const/let exports
    const consts = content.match(/export\s+(?:const|let)\s+(\w+)/g);
    if (consts) {
      consts.forEach(cons => {
        const match = cons.match(/(?:const|let)\s+(\w+)/);
        if (match) exports.push(match[1]);
      });
    }
    
    return [...new Set(exports)];
  }

  mapPipeline() {
    this.pipeline = [
      {
        name: 'Audio Input & Loading',
        modules: this.getModulesByPattern(['audio.*load', 'file.*upload', 'dropzone']),
        inputs: ['Audio file (WAV/MP3/FLAC)'],
        outputs: ['Raw audio buffer', 'Sample rate', 'Channel count'],
        cachePoints: [],
        order: 1
      },
      {
        name: 'Audio Processing & Feature Extraction',
        modules: this.getModulesByPattern(['loudness', 'truepeak', 'dynamic.*range', 'spectral', 'stereo']),
        inputs: ['Raw audio buffer'],
        outputs: ['LUFS', 'True Peak', 'DR', 'LRA', 'Spectral bands', 'Stereo metrics'],
        cachePoints: ['FFT windows', 'Gated blocks'],
        order: 2
      },
      {
        name: 'Reference Loading',
        modules: this.getModulesByPattern(['refs/', 'genre', 'reference']),
        inputs: ['Genre selection'],
        outputs: ['Target values', 'Tolerances', 'Genre-specific config'],
        cachePoints: ['refs/out/*.json'],
        order: 3
      },
      {
        name: 'Metrics Comparison',
        modules: this.getModulesByPattern(['compar', 'tolerance', 'deviation']),
        inputs: ['Extracted metrics', 'Reference targets'],
        outputs: ['Deviations', 'Status flags', 'Severity levels'],
        cachePoints: [],
        order: 4
      },
      {
        name: 'Score Calculation',
        modules: this.getModulesByPattern(['scoring', 'weight', 'penalty']),
        inputs: ['Metric deviations', 'Tolerances'],
        outputs: ['Overall score', 'Component scores', 'Penalty breakdown'],
        cachePoints: [],
        order: 5
      },
      {
        name: 'Suggestions Generation',
        modules: this.getModulesByPattern(['suggest', 'feedback', 'recommend']),
        inputs: ['Deviations', 'Score components'],
        outputs: ['Actionable suggestions', 'Priority levels'],
        cachePoints: [],
        order: 6
      },
      {
        name: 'UI Rendering & Presentation',
        modules: this.getModulesByPattern(['ui', 'render', 'display', 'integration']),
        inputs: ['Score', 'Suggestions', 'Metrics'],
        outputs: ['Visual feedback', 'Charts', 'Text reports'],
        cachePoints: [],
        order: 7
      }
    ];
  }

  getModulesByPattern(patterns) {
    return this.modules
      .filter(mod => patterns.some(pattern => new RegExp(pattern, 'i').test(mod.path)))
      .map(mod => mod.path);
  }

  async generateReport() {
    const report = this.buildReport();
    const reportPath = path.join(OUTPUT_DIR, 'SCAN_REPORT.md');
    
    await fs.writeFile(reportPath, report, 'utf-8');
    console.log(`📄 Relatório gerado: ${reportPath}`);
  }

  buildReport() {
    const totalSize = this.modules.reduce((sum, mod) => sum + mod.size, 0);
    const modulesByType = this.groupModulesByType();
    
    return `# 🔍 SCAN DO PROJETO - PIPELINE DE ANÁLISE DE MIXAGEM

**Run ID:** \`${this.runId}\`  
**Timestamp:** ${new Date().toISOString()}  
**Módulos Escaneados:** ${this.modules.length}  
**Tamanho Total:** ${(totalSize / 1024).toFixed(1)} KB  

## 📊 RESUMO POR TIPO

${Object.entries(modulesByType).map(([type, modules]) => 
  `- **${type}**: ${modules.length} módulos (${(modules.reduce((s, m) => s + m.size, 0) / 1024).toFixed(1)} KB)`
).join('\n')}

## 🏗️ DIAGRAMA DO PIPELINE

${this.pipeline.map(stage => `
### ${stage.order}. ${stage.name}

**Módulos:**
${stage.modules.length > 0 ? stage.modules.map(m => `- \`${m}\``).join('\n') : '- ⚠️ Nenhum módulo identificado'}

**Inputs:** ${stage.inputs.join(', ')}  
**Outputs:** ${stage.outputs.join(', ')}  
**Cache Points:** ${stage.cachePoints.join(', ') || 'Nenhum'}
`).join('\n')}

## 📁 INVENTÁRIO DETALHADO

### Módulos Core (Extração de Métricas)
${this.renderModuleTable(modulesByType.core || [])}

### Módulos de Scoring
${this.renderModuleTable(modulesByType.scoring || [])}

### Módulos de UI/Bridge
${this.renderModuleTable(modulesByType.ui || []).concat(this.renderModuleTable(modulesByType.bridge || []))}

### Configurações e Referências
${this.renderModuleTable(modulesByType.refs || []).concat(this.renderModuleTable(modulesByType.config || []))}

## 🔍 PONTOS DE ATENÇÃO

### Potenciais Race Conditions
${this.identifyRaceConditions()}

### Dependências Críticas
${this.identifyCriticalDependencies()}

### Cache e Performance
${this.identifyCachePoints()}

---

**Próximos Passos da Auditoria:**
1. \`generateTestAudio.js\` - Gerar casos de teste
2. \`recalcReferences.js\` - Validar referências
3. \`validateRuntimeMetrics.js\` - Testar extração de métricas
4. \`checkScoring.js\` - Auditar fórmulas de score
`;
  }

  groupModulesByType() {
    return this.modules.reduce((groups, module) => {
      if (!groups[module.type]) groups[module.type] = [];
      groups[module.type].push(module);
      return groups;
    }, {});
  }

  renderModuleTable(modules) {
    if (modules.length === 0) return '⚠️ Nenhum módulo encontrado\n';
    
    return `
| Arquivo | Descrição | Tamanho | Última Modificação |
|---------|-----------|---------|-------------------|
${modules.map(mod => 
  `| \`${mod.path}\` | ${mod.description} | ${(mod.size / 1024).toFixed(1)}KB | ${mod.lastModified.toLocaleDateString()} |`
).join('\n')}
`;
  }

  identifyRaceConditions() {
    const asyncModules = this.modules.filter(mod => 
      mod.exports.some(exp => exp.includes('async') || exp.includes('Promise'))
    );
    
    if (asyncModules.length === 0) return '✅ Nenhum padrão assíncrono identificado nos exports';
    
    return `⚠️ Módulos com operações assíncronas detectados:
${asyncModules.map(mod => `- \`${mod.path}\`: ${mod.exports.filter(e => e.includes('async') || e.includes('Promise')).join(', ')}`).join('\n')}

**Recomendação:** Verificar se há controle de ordem de execução (runId, Promise.allSettled)`;
  }

  identifyCriticalDependencies() {
    const coreModules = this.modules.filter(mod => mod.type === 'core');
    const scoringModules = this.modules.filter(mod => mod.type === 'scoring');
    
    return `**Core Features:** ${coreModules.length} módulos
**Scoring Logic:** ${scoringModules.length} módulos

${coreModules.length === 0 ? '🚨 CRÍTICO: Nenhum módulo core identificado!' : ''}
${scoringModules.length === 0 ? '🚨 CRÍTICO: Nenhum módulo de scoring identificado!' : ''}`;
  }

  identifyCachePoints() {
    const cachePoints = this.pipeline.flatMap(stage => stage.cachePoints).filter(Boolean);
    return cachePoints.length > 0 ? 
      `Pontos identificados:\n${cachePoints.map(p => `- ${p}`).join('\n')}` : 
      '⚠️ Nenhum ponto de cache explícito identificado';
  }
}

// Executar scan se chamado diretamente
if (require.main === module) {
  const scanner = new ProjectScanner();
  scanner.scan().catch(console.error);
}

module.exports = { ProjectScanner };
