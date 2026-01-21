// 🔍 ATIVADOR DE AUDITORIA - FASES 1-5 COMPLETAS
// Este arquivo ativa os logs de auditoria para detectar inconsistências

// Habilitar logs detalhados de auditoria e correções
window.DEBUG_ANALYZER = true;
window.ENABLE_AUDIT_LOGS = true;
window.ENABLE_PHASE2_CORRECTIONS = true;
window.ENABLE_PHASE3_LOGIC_ALIGNMENT = true;
window.ENABLE_PHASE4_FINAL_AUDIT = true;
window.ENABLE_PHASE5_CRITICAL_FIXES = true; // NOVO: Fase 5 - Correções Críticas

console.log('🔍 AUDITORIA FASES 1-5 ATIVADAS - Sistema completo de correções críticas habilitado');

// Função helper para consultar resultados da auditoria
window.getAuditResults = function() {
  const results = window.__AUDIT_RESULTS__ || [];
  
  console.group('📊 RESULTADOS DA AUDITORIA');
  console.log(`Total de análises auditadas: ${results.length}`);
  
  const allIssues = results.flatMap(r => r.issues);
  const allWarnings = results.flatMap(r => r.warnings);
  
  if (allIssues.length > 0) {
    console.group('🚨 PROBLEMAS CRÍTICOS ENCONTRADOS');
    allIssues.forEach(issue => {
      console.error(`${issue.type}: ${issue.description}`, issue.data);
    });
    console.groupEnd();
  }
  
  if (allWarnings.length > 0) {
    console.group('⚠️ AVISOS ENCONTRADOS');
    allWarnings.forEach(warning => {
      console.warn(`${warning.type}: ${warning.description}`, warning.data);
    });
    console.groupEnd();
  }
  
  if (allIssues.length === 0 && allWarnings.length === 0) {
    console.log('✅ Nenhum problema detectado nas análises');
  }
  
  console.groupEnd();
  
  return {
    totalAnalyses: results.length,
    criticalIssues: allIssues.length,
    warnings: allWarnings.length,
    results: results
  };
};

// Função helper para consultar correções da Fase 2
window.getPhase2Corrections = function() {
  const corrections = window.__PHASE2_CORRECTIONS__ || [];
  
  console.group('🔧 CORREÇÕES FASE 2 APLICADAS');
  console.log(`Total de análises com correções: ${corrections.length}`);
  
  const allCorrections = corrections.flatMap(r => r.corrections);
  const correctionTypes = {};
  
  allCorrections.forEach(correction => {
    correctionTypes[correction.type] = (correctionTypes[correction.type] || 0) + 1;
  });
  
  if (allCorrections.length > 0) {
    console.group('📈 TIPOS DE CORREÇÕES');
    Object.entries(correctionTypes).forEach(([type, count]) => {
      console.log(`${type}: ${count} ocorrências`);
    });
    console.groupEnd();
    
    console.group('📋 DETALHES DAS CORREÇÕES');
    allCorrections.forEach(correction => {
      console.log(`✅ ${correction.type}: ${correction.description}`);
    });
    console.groupEnd();
  } else {
    console.log('ℹ️ Nenhuma correção aplicada ainda');
  }
  
  console.groupEnd();
  
  return {
    totalAnalyses: corrections.length,
    totalCorrections: allCorrections.length,
    correctionTypes: correctionTypes,
    corrections: corrections
  };
};

// Função para limpar cache de auditoria
window.clearAuditResults = function() {
  window.__AUDIT_RESULTS__ = [];
  window.__PHASE2_CORRECTIONS__ = [];
  window.__PHASE3_CORRECTIONS__ = [];
  window.__PHASE4_CORRECTIONS__ = [];
  window.__PHASE5_CORRECTIONS__ = []; // NOVO: Fase 5
  console.log('🗑️ Cache de auditoria e correções (Fases 1-5) limpo');
};

// 🎯 NOVO: Função para verificar correções da Fase 3
window.getPhase3Corrections = function() {
  const corrections = window.__PHASE3_CORRECTIONS__ || [];
  
  console.group('🎯 CORREÇÕES FASE 3 - ALINHAMENTO LÓGICO');
  console.log(`Total de análises com correções lógicas: ${corrections.length}`);
  
  const allCorrections = corrections.flatMap(r => r.corrections);
  const correctionTypes = {};
  
  allCorrections.forEach(correction => {
    correctionTypes[correction.type] = (correctionTypes[correction.type] || 0) + 1;
  });
  
  if (allCorrections.length > 0) {
    console.group('� TIPOS DE CORREÇÕES LÓGICAS');
    Object.entries(correctionTypes).forEach(([type, count]) => {
      console.log(`${type}: ${count} ocorrências`);
    });
    console.groupEnd();
    
    console.group('�📋 DETALHES DAS CORREÇÕES LÓGICAS');
    allCorrections.forEach(correction => {
      console.log(`🎯 ${correction.type}: ${correction.description}`);
      if (correction.type === 'PHASE3_ROLLBACK') {
        console.warn(`    ⚠️ Motivo do rollback: ${correction.reason}`);
      }
    });
    console.groupEnd();
  } else {
    console.log('ℹ️ Nenhuma correção lógica aplicada ainda');
  }
  
  console.groupEnd();
  
  return {
    totalAnalyses: corrections.length,
    totalCorrections: allCorrections.length,
    correctionTypes: correctionTypes,
    corrections: corrections
  };
};

// 🔍 NOVO: Auditoria completa (todas as fases)
window.getCompleteAudit = function() {
  console.group('🔍 AUDITORIA COMPLETA - Todas as Fases');
  
  console.log('📊 FASE 1 - Observação:');
  const phase1 = window.getAuditResults();
  
  console.log('\n🔧 FASE 2 - Correções Baixo Risco:');
  const phase2 = window.getPhase2Corrections();
  
  console.log('\n🎯 FASE 3 - Alinhamento Lógico:');
  const phase3 = window.getPhase3Corrections();
  
  console.log('\n🎯 FASE 4 - Auditoria Final Completa:');
  const phase4 = window.getPhase4Corrections();
  
  console.log('\n🎯 FASE 5 - Correções Críticas Específicas:');
  const phase5 = window.getPhase5Corrections();
  
  console.log('\n📈 RESUMO GERAL:');
  console.log(`Análises auditadas: ${phase1.totalAnalyses}`);
  console.log(`Problemas críticos: ${phase1.criticalIssues}`);
  console.log(`Correções Fase 2: ${phase2.totalCorrections}`);
  console.log(`Correções Fase 3: ${phase3.totalCorrections}`);
  console.log(`Correções Fase 4: ${phase4.totalCorrections}`);
  console.log(`Correções Fase 5: ${phase5.totalCorrections}`);
  
  console.groupEnd();
  
  return { phase1, phase2, phase3, phase4, phase5 };
};

// 🎯 NOVO: Função para verificar correções da Fase 4
window.getPhase4Corrections = function() {
  const corrections = window.__PHASE4_CORRECTIONS__ || [];
  
  console.group('🎯 FASE 4 - AUDITORIA FINAL COMPLETA');
  console.log(`Total de análises com auditoria final: ${corrections.length}`);
  
  const allCorrections = corrections.flatMap(r => r.corrections);
  const correctionTypes = {};
  
  allCorrections.forEach(correction => {
    correctionTypes[correction.type] = (correctionTypes[correction.type] || 0) + 1;
  });
  
  if (allCorrections.length > 0) {
    console.group('📈 TIPOS DE CORREÇÕES FINAIS');
    Object.entries(correctionTypes).forEach(([type, count]) => {
      console.log(`${type}: ${count} ocorrências`);
    });
    console.groupEnd();
    
    console.group('📋 DETALHES DAS CORREÇÕES FINAIS');
    allCorrections.forEach(correction => {
      console.log(`🎯 ${correction.type}: ${correction.description}`);
    });
    console.groupEnd();
    
    console.group('📊 LUFS UNIFICAÇÃO');
    corrections.slice(-2).forEach((entry, index) => {
      if (entry.lufsValues) {
        console.log(`Análise ${index + 1}:`);
        console.log(`  Fontes originais: ${entry.lufsValues.original.length}`);
        console.log(`  LUFS unificado: ${entry.lufsValues.unified?.toFixed(1) || 'N/A'}`);
      }
    });
    console.groupEnd();
  } else {
    console.log('ℹ️ Nenhuma correção final aplicada ainda');
  }
  
  console.groupEnd();
  
  return {
    totalAnalyses: corrections.length,
    totalCorrections: allCorrections.length,
    correctionTypes: correctionTypes,
    corrections: corrections
  };
};

console.log('📋 Comandos disponíveis:');
console.log('- window.getAuditResults() - Ver resultados da auditoria (Fase 1)');
console.log('- window.getPhase2Corrections() - Ver correções aplicadas na Fase 2');
console.log('- window.getPhase3Corrections() - Ver correções aplicadas na Fase 3');
console.log('- window.getPhase4Corrections() - Ver auditoria final completa na Fase 4');
console.log('- window.getPhase5Corrections() - Ver correções críticas específicas na Fase 5 (NOVO)');
console.log('- window.getCompleteAudit() - Ver auditoria completa de todas as fases (atualizado)');
console.log('- window.clearAuditResults() - Limpar cache de auditoria e correções');

// 🎯 NOVO: Função para verificar correções da Fase 5
window.getPhase5Corrections = function() {
  const corrections = window.__PHASE5_CORRECTIONS__ || [];
  
  console.group('🎯 FASE 5 - CORREÇÕES CRÍTICAS ESPECÍFICAS');
  console.log(`Total de análises com correções críticas: ${corrections.length}`);
  
  const allCorrections = corrections.flatMap(r => r.corrections);
  const correctionTypes = {};
  
  allCorrections.forEach(correction => {
    correctionTypes[correction.type] = (correctionTypes[correction.type] || 0) + 1;
  });
  
  if (allCorrections.length > 0) {
    console.group('📈 TIPOS DE CORREÇÕES CRÍTICAS');
    Object.entries(correctionTypes).forEach(([type, count]) => {
      console.log(`${type}: ${count} ocorrências`);
    });
    console.groupEnd();
    
    console.group('📋 DETALHES DAS CORREÇÕES CRÍTICAS');
    allCorrections.forEach(correction => {
      console.log(`🎯 ${correction.type}: ${correction.description}`);
    });
    console.groupEnd();
    
    console.group('📊 VERIFICAÇÕES CRÍTICAS REALIZADAS');
    corrections.slice(-2).forEach((entry, index) => {
      if (entry.criticalChecks) {
        const checks = entry.criticalChecks;
        console.log(`Análise ${index + 1}:`);
        console.log(`  LUFS fontes: ${checks.lufsValues?.length || 0}`);
        console.log(`  Dinâmica: ${checks.dynamicsValue?.toFixed(2) || 'N/A'}`);
        console.log(`  Score técnico: ${checks.technicalScore || 0}`);
        console.log(`  Mono compatibility: ${checks.monoCompatibility || 'N/A'}`);
        console.log(`  Sugestões: ${checks.suggestionsCount || 0}`);
      }
    });
    console.groupEnd();
  } else {
    console.log('ℹ️ Nenhuma correção crítica aplicada ainda');
  }
  
  console.groupEnd();
  
  return {
    totalAnalyses: corrections.length,
    totalCorrections: allCorrections.length,
    correctionTypes: correctionTypes,
    corrections: corrections
  };
};

// 🐛 NOVO: Sistema de Controle de Debug Detalhado
window.enableDetailedDebug = function() {
  window.DETAILED_DEBUG_ENABLED = true;
  window.DEBUG_ANALYZER = true;
  window.ENABLE_DETAILED_ANALYSIS_DEBUG = true;
  
  console.log('🐛 DEBUG DETALHADO ATIVADO');
  console.log('📊 Funções de debug habilitadas:');
  console.log('  - performDetailedAnalysisDebug()');
  console.log('  - debugLUFSDuplication()');
  console.log('  - debugNegativeDynamics()');
  console.log('  - debugTruePeakClippingContradiction()');
  console.log('  - debugZeroTechnicalScore()');
  console.log('  - debugMonoCompatibilityIssue()');
  
  return { status: 'enabled', timestamp: new Date().toISOString() };
};

window.disableDetailedDebug = function() {
  window.DETAILED_DEBUG_ENABLED = false;
  window.ENABLE_DETAILED_ANALYSIS_DEBUG = false;
  
  console.log('🔇 DEBUG DETALHADO DESATIVADO');
  
  return { status: 'disabled', timestamp: new Date().toISOString() };
};

window.getDebugStatus = function() {
  const status = {
    detailedDebug: !!window.DETAILED_DEBUG_ENABLED,
    analyzerDebug: !!window.DEBUG_ANALYZER,
    auditLogs: !!window.ENABLE_AUDIT_LOGS,
    phase2Corrections: !!window.ENABLE_PHASE2_CORRECTIONS,
    phase3Logic: !!window.ENABLE_PHASE3_LOGIC_ALIGNMENT,
    phase4Audit: !!window.ENABLE_PHASE4_FINAL_AUDIT,
    phase5Critical: !!window.ENABLE_PHASE5_CRITICAL_FIXES,
    enabledSince: new Date().toISOString()
  };
  
  console.group('🔍 STATUS DO SISTEMA DE DEBUG');
  console.log('Debug detalhado:', status.detailedDebug ? '✅ Ativo' : '❌ Inativo');
  console.log('Analyzer debug:', status.analyzerDebug ? '✅ Ativo' : '❌ Inativo');
  console.log('Audit logs:', status.auditLogs ? '✅ Ativo' : '❌ Inativo');
  console.log('Correções Fase 2:', status.phase2Corrections ? '✅ Ativo' : '❌ Inativo');
  console.log('Lógica Fase 3:', status.phase3Logic ? '✅ Ativo' : '❌ Inativo');
  console.log('Auditoria Fase 4:', status.phase4Audit ? '✅ Ativo' : '❌ Inativo');
  console.log('Críticas Fase 5:', status.phase5Critical ? '✅ Ativo' : '❌ Inativo');
  console.groupEnd();
  
  return status;
};

// 🔧 Função para ativar debug específico por problema
window.enableSpecificDebug = function(problems = []) {
  const validProblems = ['lufs', 'dynamics', 'clipping', 'score', 'mono'];
  const selected = problems.filter(p => validProblems.includes(p));
  
  window.SPECIFIC_DEBUG_PROBLEMS = selected;
  window.DETAILED_DEBUG_ENABLED = true;
  
  console.group('🎯 DEBUG ESPECÍFICO ATIVADO');
  console.log(`Problemas selecionados: ${selected.join(', ')}`);
  console.log('Para debugar todos os problemas: enableSpecificDebug([\'lufs\', \'dynamics\', \'clipping\', \'score\', \'mono\'])');
  console.groupEnd();
  
  return { enabled: selected, total: validProblems };
};

console.log('🐛 Comandos de debug detalhado adicionados:');
console.log('- window.enableDetailedDebug() - Ativar debug detalhado completo');
console.log('- window.disableDetailedDebug() - Desativar debug detalhado');
console.log('- window.getDebugStatus() - Verificar status de todos os sistemas');
console.log('- window.enableSpecificDebug([\'problema1\', \'problema2\']) - Debug específico');
