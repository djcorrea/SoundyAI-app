#!/usr/bin/env node
/**
 * 🔍 AUDITORIA: SCAN DO PROJETO - MAPEAMENTO COMPLETO DO PIPELINE
 * 
 * Inventário de módulos relevantes e diagrama do pipeline de análise de mixagem
 * Modo: READ-ONLY, nenhuma alteração no código de produção
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'audit', 'out');

interface ModuleInfo {
  path: string;
  type: 'core' | 'ui' | 'refs' | 'scoring' | 'bridge' | 'config' | 'test';
  description: string;
  dependencies: string[];
  exports: string[];
  size: number;
  lastModified: Date;
}

interface PipelineStage {
  name: string;
  modules: string[];
  inputs: string[];
  outputs: string[];
  cachePoints: string[];
  order: number;
}

class ProjectScanner {
  private modules: ModuleInfo[] = [];
  private pipeline: PipelineStage[] = [];
  private runId: string;

  constructor() {
    this.runId = `scan_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    console.log(`🔍 [${this.runId}] Iniciando scan do projeto...`);
  }

  async scan(): Promise<void> {
    console.log(`📁 Escaneando estrutura do projeto...`);
    
    // Escanear módulos principais
    await this.scanDirectory(PROJECT_ROOT, ['node_modules', '.git', 'audit', 'backup']);
    
    // Mapear pipeline
    this.mapPipeline();
    
    // Gerar relatório
    await this.generateReport();
  }

  private async scanDirectory(dir: string, exclude: string[] = []): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    
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

  private isRelevantFile(filename: string): boolean {
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

  private async analyzeFile(filePath: string): Promise<void> {
    try {
      const relativePath = path.relative(PROJECT_ROOT, filePath);
      const stats = await fs.promises.stat(filePath);
      const content = await fs.promises.readFile(filePath, 'utf-8');
      
      const moduleInfo: ModuleInfo = {
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

  private classifyModule(relativePath: string, content: string): ModuleInfo['type'] {
    if (relativePath.includes('refs/')) return 'refs';
    if (relativePath.includes('public/') || relativePath.includes('ui/')) return 'ui';
    if (relativePath.includes('scoring') || content.includes('calculateScore')) return 'scoring';
    if (relativePath.includes('lib/audio/features/')) return 'core';
    if (relativePath.includes('integration') || content.includes('bridge')) return 'bridge';
    if (relativePath.includes('test') || content.includes('describe(')) return 'test';
    if (relativePath.endsWith('.json')) return 'config';
    return 'core';
  }

  private extractDescription(content: string): string {
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

  private extractDependencies(content: string): string[] {
    const deps: string[] = [];
    
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

  private extractExports(content: string): string[] {
    const exports: string[] = [];
    
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

  private mapPipeline(): void {
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

  private getModulesByPattern(patterns: string[]): string[] {
    return this.modules
      .filter(mod => patterns.some(pattern => new RegExp(pattern, 'i').test(mod.path)))
      .map(mod => mod.path);
  }

  private async generateReport(): Promise<void> {
    const report = this.buildReport();
    const reportPath = path.join(OUTPUT_DIR, 'SCAN_REPORT.md');
    
    await fs.promises.writeFile(reportPath, report, 'utf-8');
    console.log(`📄 Relatório gerado: ${reportPath}`);
  }

  private buildReport(): string {
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
1. \`generateTestAudio.ts\` - Gerar casos de teste
2. \`recalcReferences.ts\` - Validar referências
3. \`validateRuntimeMetrics.ts\` - Testar extração de métricas
4. \`checkScoring.ts\` - Auditar fórmulas de score
`;
  }

  private groupModulesByType(): Record<string, ModuleInfo[]> {
    return this.modules.reduce((groups, module) => {
      if (!groups[module.type]) groups[module.type] = [];
      groups[module.type].push(module);
      return groups;
    }, {} as Record<string, ModuleInfo[]>);
  }

  private renderModuleTable(modules: ModuleInfo[]): string {
    if (modules.length === 0) return '⚠️ Nenhum módulo encontrado\n';
    
    return `
| Arquivo | Descrição | Tamanho | Última Modificação |
|---------|-----------|---------|-------------------|
${modules.map(mod => 
  `| \`${mod.path}\` | ${mod.description} | ${(mod.size / 1024).toFixed(1)}KB | ${mod.lastModified.toLocaleDateString()} |`
).join('\n')}
`;
  }

  private identifyRaceConditions(): string {
    const asyncModules = this.modules.filter(mod => 
      mod.exports.some(exp => exp.includes('async') || exp.includes('Promise'))
    );
    
    if (asyncModules.length === 0) return '✅ Nenhum padrão assíncrono identificado nos exports';
    
    return `⚠️ Módulos com operações assíncronas detectados:
${asyncModules.map(mod => `- \`${mod.path}\`: ${mod.exports.filter(e => e.includes('async') || e.includes('Promise')).join(', ')}`).join('\n')}

**Recomendação:** Verificar se há controle de ordem de execução (runId, Promise.allSettled)`;
  }

  private identifyCriticalDependencies(): string {
    const coreModules = this.modules.filter(mod => mod.type === 'core');
    const scoringModules = this.modules.filter(mod => mod.type === 'scoring');
    
    return `**Core Features:** ${coreModules.length} módulos
**Scoring Logic:** ${scoringModules.length} módulos

${coreModules.length === 0 ? '🚨 CRÍTICO: Nenhum módulo core identificado!' : ''}
${scoringModules.length === 0 ? '🚨 CRÍTICO: Nenhum módulo de scoring identificado!' : ''}`;
  }

  private identifyCachePoints(): string {
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
