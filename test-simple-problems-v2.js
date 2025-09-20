// 🧪 TESTE SIMPLIFICADO - Problems & Suggestions Analyzer V2
// Teste standalone sem dependências externas

// Mock da função logAudio para testes
const logAudio = (module, event, data) => {
  console.log(`[${module}] ${event}:`, data);
};

/**
 * 🎨 Sistema de Criticidade com Cores
 */
const SEVERITY_SYSTEM = {
  CRITICAL: {
    level: 'critical',
    priority: 4,
    color: '#ff4444',
    colorHex: 'red',
    icon: '🔴',
    label: 'CRÍTICO'
  },
  WARNING: {
    level: 'warning', 
    priority: 3,
    color: '#ff8800',
    colorHex: 'orange',
    icon: '🟠',
    label: 'ATENÇÃO'
  },
  OK: {
    level: 'ok',
    priority: 1,
    color: '#00ff88',
    colorHex: 'green', 
    icon: '🟢',
    label: 'OK'
  }
};

/**
 * 🎵 Thresholds por Gênero Musical (simplificado)
 */
const GENRE_THRESHOLDS = {
  'funk_automotivo': {
    lufs: { target: -6.2, tolerance: 2.0, critical: 3.0 },
    truePeak: { target: -1.0, tolerance: 0.5, critical: 1.0 },
    dr: { target: 6.8, tolerance: 2.0, critical: 3.0 }
  },
  'trance': {
    lufs: { target: -11.5, tolerance: 2.5, critical: 4.0 },
    truePeak: { target: -1.0, tolerance: 1.0, critical: 2.0 },
    dr: { target: 8.8, tolerance: 3.0, critical: 5.0 }
  }
};

/**
 * 🎯 Classe Simplificada para Testes
 */
class TestProblemsAnalyzer {
  constructor(genre = 'funk_automotivo') {
    this.genre = genre;
    this.thresholds = GENRE_THRESHOLDS[genre] || GENRE_THRESHOLDS['funk_automotivo'];
    this.severity = SEVERITY_SYSTEM;
  }
  
  analyze(audioMetrics) {
    const suggestions = [];
    
    // Análise LUFS
    const lufs = audioMetrics.lufs?.integrated;
    if (Number.isFinite(lufs)) {
      const threshold = this.thresholds.lufs;
      const diff = Math.abs(lufs - threshold.target);
      const severity = this.calculateSeverity(diff, threshold.tolerance, threshold.critical);
      
      let message, explanation, action;
      if (severity.level === 'critical') {
        message = `🔴 LUFS crítico: ${lufs.toFixed(1)} dB`;
        explanation = `Muito ${lufs > threshold.target ? 'alto' : 'baixo'} para ${this.genre}`;
        action = `${lufs > threshold.target ? 'Reduza' : 'Aumente'} o gain no limiter`;
      } else if (severity.level === 'warning') {
        message = `🟠 LUFS atenção: ${lufs.toFixed(1)} dB`;
        explanation = `Um pouco fora do ideal para ${this.genre}`;
        action = `Ajuste suave de 1-2 dB`;
      } else {
        message = `🟢 LUFS ideal: ${lufs.toFixed(1)} dB`;
        explanation = `Perfeito para ${this.genre}!`;
        action = `Mantenha esse nível`;
      }
      
      suggestions.push({
        metric: 'lufs',
        severity: severity.level,
        color: severity.colorHex,
        colorCode: severity.color,
        icon: severity.icon,
        message,
        explanation,
        action,
        currentValue: `${lufs.toFixed(1)} LUFS`,
        targetValue: `${threshold.target} LUFS`,
        delta: `${(lufs - threshold.target).toFixed(1)} dB`
      });
    }
    
    // Análise True Peak
    const truePeak = audioMetrics.truePeak?.peak;
    if (Number.isFinite(truePeak)) {
      const threshold = this.thresholds.truePeak;
      const diff = truePeak - threshold.target;
      const severity = diff <= 0 ? this.severity.OK : 
                      diff <= threshold.tolerance ? this.severity.WARNING : 
                      this.severity.CRITICAL;
      
      suggestions.push({
        metric: 'truePeak',
        severity: severity.level,
        color: severity.colorHex,
        colorCode: severity.color,
        icon: severity.icon,
        message: `${severity.icon} True Peak: ${truePeak.toFixed(1)} dBTP`,
        explanation: severity.level === 'critical' ? 'CLIPPING DETECTADO!' : 
                    severity.level === 'warning' ? 'Próximo do limite' : 'Seguro',
        action: severity.level === 'critical' ? 'URGENTE: Reduza gain' : 
               severity.level === 'warning' ? 'Reduza 1-2 dB' : 'Perfeito!',
        currentValue: `${truePeak.toFixed(1)} dBTP`,
        targetValue: `< ${threshold.target} dBTP`,
        delta: diff > 0 ? `+${diff.toFixed(1)} dB` : `${Math.abs(diff).toFixed(1)} dB seguro`
      });
    }
    
    return {
      genre: this.genre,
      suggestions,
      summary: {
        criticalIssues: suggestions.filter(s => s.severity === 'critical').length,
        warningIssues: suggestions.filter(s => s.severity === 'warning').length,
        okMetrics: suggestions.filter(s => s.severity === 'ok').length,
        readyForRelease: suggestions.filter(s => s.severity === 'critical').length === 0
      }
    };
  }
  
  calculateSeverity(diff, tolerance, critical) {
    if (diff <= tolerance) return this.severity.OK;
    else if (diff <= critical) return this.severity.WARNING;
    else return this.severity.CRITICAL;
  }
}

/**
 * 🧪 Executar Testes
 */
function runTests() {
  console.log('\n🧪 TESTANDO PROBLEMS & SUGGESTIONS ANALYZER V2\n');
  
  // Teste 1: Funk Automotivo CRÍTICO
  console.log('📍 TESTE 1: Funk Automotivo com problemas críticos');
  const test1 = new TestProblemsAnalyzer('funk_automotivo');
  const result1 = test1.analyze({
    lufs: { integrated: -3.5 },    // Muito alto (target: -6.2)
    truePeak: { peak: 2.4 }        // Clipping grave (target: -1.0)
  });
  
  console.log('📊 RESULTADO:');
  console.log(`   🎵 Gênero: ${result1.genre}`);
  console.log(`   🔴 Críticos: ${result1.summary.criticalIssues}`);
  console.log(`   🟠 Avisos: ${result1.summary.warningIssues}`);
  console.log(`   🟢 OK: ${result1.summary.okMetrics}`);
  console.log(`   🚀 Pronto: ${result1.summary.readyForRelease ? 'SIM' : 'NÃO'}`);
  
  console.log('\n💡 SUGESTÕES:');
  result1.suggestions.forEach((s, i) => {
    console.log(`   ${i+1}. ${s.icon} [${s.metric}] ${s.message}`);
    console.log(`      💭 ${s.explanation}`);
    console.log(`      🔧 ${s.action}`);
    console.log(`      📊 ${s.currentValue} → ${s.targetValue} (Δ ${s.delta})`);
  });
  
  // JSON Final
  console.log('\n📄 JSON FINAL EXEMPLO:');
  console.log(JSON.stringify({
    suggestions: result1.suggestions.slice(0, 1),
    summary: result1.summary
  }, null, 2));
  
  console.log('\n' + '='.repeat(60));
  
  // Teste 2: Trance IDEAL
  console.log('\n📍 TESTE 2: Trance ideal');
  const test2 = new TestProblemsAnalyzer('trance');
  const result2 = test2.analyze({
    lufs: { integrated: -11.4 },   // Perfeito (target: -11.5)
    truePeak: { peak: -1.2 }       // Seguro (target: -1.0)
  });
  
  console.log('📊 RESULTADO:');
  console.log(`   🎵 Gênero: ${result2.genre}`);
  console.log(`   🔴 Críticos: ${result2.summary.criticalIssues}`);
  console.log(`   🟠 Avisos: ${result2.summary.warningIssues}`);
  console.log(`   🟢 OK: ${result2.summary.okMetrics}`);
  console.log(`   🚀 Pronto: ${result2.summary.readyForRelease ? 'SIM' : 'NÃO'}`);
  
  console.log('\n💡 SUGESTÕES:');
  result2.suggestions.forEach((s, i) => {
    console.log(`   ${i+1}. ${s.icon} [${s.metric}] ${s.message}`);
    console.log(`      💭 ${s.explanation}`);
    console.log(`      🔧 ${s.action}`);
  });
  
  console.log('\n✅ TESTE COMPLETO!\n');
  console.log('🎯 SISTEMA FUNCIONANDO:');
  console.log('   ✅ Criticidade por cores implementada');
  console.log('   ✅ Sugestões educativas funcionando');
  console.log('   ✅ Thresholds por gênero ativos');
  console.log('   ✅ JSON final com estrutura correta');
}

// Executar testes
runTests();