/**
 * 🎯 SSOT ALIGNMENT VALIDATOR
 * 
 * Script de validação para garantir que os valores numéricos nos CARDS de sugestões
 * são idênticos aos valores da TABELA de comparação (comparisonResult.rows).
 * 
 * USAGE:
 *   node scripts/validate-ssot-alignment.js <analysis-json-file>
 * 
 * EXAMPLE:
 *   node scripts/validate-ssot-alignment.js ./test-data/analysis-result.json
 * 
 * Este script NÃO deve rodar em produção automaticamente.
 * Use apenas para validação durante desenvolvimento/testes.
 */

import fs from 'fs';
import path from 'path';

// Cores para output no terminal
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

/**
 * Normaliza chave de métrica para comparação
 */
function normalizeKey(key) {
  if (!key) return '';
  
  const keyMap = {
    'lufs': 'lufs',
    'loudness': 'lufs',
    'lufsIntegrated': 'lufs',
    'truePeak': 'truePeak',
    'truepeak': 'truePeak',
    'true_peak': 'truePeak',
    'dr': 'dr',
    'dynamicRange': 'dr',
    'lra': 'lra',
    'loudnessRange': 'lra',
    'stereo': 'stereo',
    'stereoCorrelation': 'stereo'
  };
  
  return keyMap[key] || key.toLowerCase();
}

/**
 * Extrai min/max de uma sugestão
 */
function extractRangeFromSuggestion(suggestion) {
  // Tentar diferentes campos que podem conter o range
  let min = suggestion.targetMin ?? suggestion.rangeMin ?? suggestion.bounds?.min;
  let max = suggestion.targetMax ?? suggestion.rangeMax ?? suggestion.bounds?.max;
  
  // Se não encontrou diretamente, tentar extrair do targetValue/targetRange text
  if (min === undefined || max === undefined) {
    const targetText = suggestion.targetValue || suggestion.targetRange || '';
    const match = targetText.match(/([-\d.]+)\s*a\s*([-\d.]+)/);
    if (match) {
      min = parseFloat(match[1]);
      max = parseFloat(match[2]);
    }
  }
  
  return { min, max };
}

/**
 * Valida alinhamento entre uma row da tabela e uma sugestão
 */
function validateAlignment(tableRow, suggestion) {
  const errors = [];
  
  // Extrair range da sugestão
  const suggestionRange = extractRangeFromSuggestion(suggestion);
  
  // Comparar min
  if (typeof tableRow.min === 'number' && typeof suggestionRange.min === 'number') {
    if (Math.abs(tableRow.min - suggestionRange.min) > 0.01) {
      errors.push({
        field: 'min',
        tableValue: tableRow.min,
        suggestionValue: suggestionRange.min,
        diff: Math.abs(tableRow.min - suggestionRange.min)
      });
    }
  }
  
  // Comparar max
  if (typeof tableRow.max === 'number' && typeof suggestionRange.max === 'number') {
    if (Math.abs(tableRow.max - suggestionRange.max) > 0.01) {
      errors.push({
        field: 'max',
        tableValue: tableRow.max,
        suggestionValue: suggestionRange.max,
        diff: Math.abs(tableRow.max - suggestionRange.max)
      });
    }
  }
  
  return errors;
}

/**
 * Valida um resultado de análise completo
 */
function validateAnalysis(analysis) {
  const results = {
    passed: [],
    failed: [],
    skipped: []
  };
  
  // Extrair comparisonResult
  const comparisonResult = analysis?.data?.comparisonResult || 
                           analysis?.comparisonResult ||
                           analysis?.technicalData?.comparisonResult;
  
  if (!comparisonResult?.rows?.length) {
    console.log(`${colors.yellow}⚠️ comparisonResult.rows não encontrado ou vazio${colors.reset}`);
    return results;
  }
  
  // Extrair sugestões
  const suggestions = analysis?.aiSuggestions || 
                      analysis?.suggestions || 
                      analysis?.data?.suggestions ||
                      [];
  
  if (!suggestions.length) {
    console.log(`${colors.yellow}⚠️ Nenhuma sugestão encontrada${colors.reset}`);
    return results;
  }
  
  console.log(`\n📊 Validando ${comparisonResult.rows.length} rows da tabela vs ${suggestions.length} sugestões\n`);
  
  // Para cada row da tabela, buscar sugestão correspondente
  for (const row of comparisonResult.rows) {
    const rowKey = normalizeKey(row.key);
    
    // Buscar sugestão correspondente
    const matchingSuggestion = suggestions.find(s => {
      const suggKey = normalizeKey(s.metric || s.metricKey || s.type || s.key);
      return suggKey === rowKey;
    });
    
    if (!matchingSuggestion) {
      // Não há sugestão para esta métrica (pode ser OK ou ausente por design)
      if (row.severity === 'OK') {
        results.skipped.push({
          metric: row.key,
          reason: 'Métrica OK - sugestão corretamente omitida'
        });
      } else {
        results.skipped.push({
          metric: row.key,
          reason: `Sem sugestão correspondente (severity: ${row.severity})`
        });
      }
      continue;
    }
    
    // Validar alinhamento
    const errors = validateAlignment(row, matchingSuggestion);
    
    if (errors.length === 0) {
      results.passed.push({
        metric: row.key,
        tableRange: `${row.min?.toFixed(1)} a ${row.max?.toFixed(1)}`,
        suggestionRange: extractRangeFromSuggestion(matchingSuggestion)
      });
    } else {
      results.failed.push({
        metric: row.key,
        errors
      });
    }
  }
  
  return results;
}

/**
 * Imprime resultados formatados
 */
function printResults(results) {
  console.log('\n' + '═'.repeat(60));
  console.log('📋 RESULTADO DA VALIDAÇÃO SSOT');
  console.log('═'.repeat(60) + '\n');
  
  // PASSED
  if (results.passed.length > 0) {
    console.log(`${colors.green}✅ ALINHADOS (${results.passed.length}):${colors.reset}`);
    results.passed.forEach(p => {
      console.log(`   • ${p.metric}: ${p.tableRange}`);
    });
    console.log();
  }
  
  // FAILED
  if (results.failed.length > 0) {
    console.log(`${colors.red}❌ DIVERGENTES (${results.failed.length}):${colors.reset}`);
    results.failed.forEach(f => {
      console.log(`   • ${f.metric}:`);
      f.errors.forEach(e => {
        console.log(`     - ${e.field}: TABELA=${e.tableValue?.toFixed(2)} vs CARD=${e.suggestionValue?.toFixed(2)} (diff: ${e.diff?.toFixed(2)})`);
      });
    });
    console.log();
  }
  
  // SKIPPED
  if (results.skipped.length > 0) {
    console.log(`${colors.yellow}⏭️ PULADOS (${results.skipped.length}):${colors.reset}`);
    results.skipped.forEach(s => {
      console.log(`   • ${s.metric}: ${s.reason}`);
    });
    console.log();
  }
  
  // SUMMARY
  console.log('═'.repeat(60));
  const total = results.passed.length + results.failed.length;
  const passRate = total > 0 ? ((results.passed.length / total) * 100).toFixed(1) : 0;
  
  if (results.failed.length === 0) {
    console.log(`${colors.green}🎯 VALIDAÇÃO PASSED: ${passRate}% (${results.passed.length}/${total})${colors.reset}`);
  } else {
    console.log(`${colors.red}🔴 VALIDAÇÃO FAILED: ${passRate}% (${results.passed.length}/${total})${colors.reset}`);
  }
  console.log('═'.repeat(60) + '\n');
  
  return results.failed.length === 0;
}

// ════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
${colors.blue}🎯 SSOT ALIGNMENT VALIDATOR${colors.reset}

Usage:
  node scripts/validate-ssot-alignment.js <analysis-json-file>

Example:
  node scripts/validate-ssot-alignment.js ./test-data/analysis-result.json

Este script valida se os valores numéricos dos CARDS de sugestões
são idênticos aos valores da TABELA (comparisonResult.rows).
`);
  process.exit(0);
}

const filePath = args[0];

if (!fs.existsSync(filePath)) {
  console.error(`${colors.red}❌ Arquivo não encontrado: ${filePath}${colors.reset}`);
  process.exit(1);
}

try {
  const content = fs.readFileSync(filePath, 'utf8');
  const analysis = JSON.parse(content);
  
  console.log(`${colors.blue}📂 Validando: ${path.basename(filePath)}${colors.reset}`);
  
  const results = validateAnalysis(analysis);
  const passed = printResults(results);
  
  process.exit(passed ? 0 : 1);
  
} catch (error) {
  console.error(`${colors.red}❌ Erro ao processar arquivo: ${error.message}${colors.reset}`);
  process.exit(1);
}
