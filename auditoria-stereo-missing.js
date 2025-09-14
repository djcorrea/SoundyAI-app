/**
 * 🔍 BUSCA DIRECIONADA: CORRELAÇÃO ESTÉREO MISSING
 * 
 * Script para localizar onde está implementada a análise estéreo
 * que está retornando correlação 0 fixa
 */

import fs from 'fs';
import path from 'path';

// Termos para buscar
const SEARCH_TERMS = [
  'stereo.*correlation',
  'correlation.*stereo', 
  'calculateStereoMetrics',
  'stereo.*width',
  'stereo.*phase',
  'crossCorrelation',
  'cross.*correlation',
  'autocorrelation',
  'stereo.*analysis',
  'stereo.*imaging',
  'left.*right.*correlation',
  'L.*R.*correlation'
];

const DIRECTORIES_TO_SEARCH = [
  './work/api/audio',
  './work/lib/audio',
  './api/audio',
  './lib/audio',
  './public'
];

const FILE_EXTENSIONS = ['.js', '.mjs', '.ts'];

/**
 * 🔍 Buscar em arquivo
 */
function searchInFile(filePath, content) {
  const results = [];
  const lines = content.split('\n');
  
  SEARCH_TERMS.forEach(term => {
    const regex = new RegExp(term, 'gi');
    lines.forEach((line, index) => {
      if (regex.test(line)) {
        results.push({
          term,
          file: filePath,
          line: index + 1,
          content: line.trim(),
          context: lines.slice(Math.max(0, index - 2), index + 3)
        });
      }
    });
  });
  
  return results;
}

/**
 * 🗂️ Buscar em diretório recursivamente
 */
async function searchInDirectory(dir) {
  const results = [];
  
  if (!fs.existsSync(dir)) {
    console.log(`⚠️ Diretório não existe: ${dir}`);
    return results;
  }
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && !item.includes('node_modules')) {
      // Buscar recursivamente em subdiretórios
      const subResults = await searchInDirectory(fullPath);
      results.push(...subResults);
    } else if (stat.isFile() && FILE_EXTENSIONS.some(ext => item.endsWith(ext))) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const fileResults = searchInFile(fullPath, content);
        results.push(...fileResults);
      } catch (error) {
        console.log(`❌ Erro ao ler ${fullPath}: ${error.message}`);
      }
    }
  }
  
  return results;
}

/**
 * 🎯 Busca específica por função calculateStereoMetrics
 */
function searchCalculateStereoMetrics() {
  console.log('\n🎯 BUSCA ESPECÍFICA: calculateStereoMetrics');
  console.log('=' .repeat(60));
  
  const coreMetricsPath = './work/api/audio/core-metrics.js';
  
  if (!fs.existsSync(coreMetricsPath)) {
    console.log('❌ Arquivo core-metrics.js não encontrado');
    return;
  }
  
  const content = fs.readFileSync(coreMetricsPath, 'utf-8');
  const lines = content.split('\n');
  
  // Procurar pela função
  let foundFunction = false;
  let functionStart = -1;
  let functionEnd = -1;
  let braceCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('calculateStereoMetrics')) {
      console.log(`📍 Encontrada na linha ${i + 1}:`);
      console.log(`   ${line.trim()}`);
      foundFunction = true;
      functionStart = i;
    }
    
    if (foundFunction) {
      // Contar chaves para encontrar fim da função
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      
      if (braceCount === 0 && i > functionStart) {
        functionEnd = i;
        break;
      }
    }
  }
  
  if (foundFunction && functionEnd > functionStart) {
    console.log(`\n📋 IMPLEMENTAÇÃO COMPLETA (linhas ${functionStart + 1}-${functionEnd + 1}):`);
    console.log('-' .repeat(60));
    
    for (let i = functionStart; i <= functionEnd; i++) {
      console.log(`${(i + 1).toString().padStart(3)}: ${lines[i]}`);
    }
  } else if (foundFunction) {
    console.log('\n⚠️ Função encontrada mas fim não detectado. Mostrando 20 linhas:');
    for (let i = functionStart; i < Math.min(functionStart + 20, lines.length); i++) {
      console.log(`${(i + 1).toString().padStart(3)}: ${lines[i]}`);
    }
  } else {
    console.log('❌ Função calculateStereoMetrics não encontrada em core-metrics.js');
  }
}

/**
 * 🚀 Execução principal
 */
async function main() {
  console.log('🔍 AUDITORIA DIRECIONADA: CORRELAÇÃO ESTÉREO MISSING');
  console.log('=' .repeat(80));
  console.log('Buscando implementação de análise estéreo no codebase...\n');
  
  let allResults = [];
  
  // Buscar em todos os diretórios
  for (const dir of DIRECTORIES_TO_SEARCH) {
    console.log(`📂 Buscando em: ${dir}`);
    const results = await searchInDirectory(dir);
    allResults.push(...results);
    console.log(`   Encontrados: ${results.length} matches`);
  }
  
  // Busca específica na função principal
  searchCalculateStereoMetrics();
  
  // Agrupar resultados por arquivo
  const resultsByFile = {};
  allResults.forEach(result => {
    if (!resultsByFile[result.file]) {
      resultsByFile[result.file] = [];
    }
    resultsByFile[result.file].push(result);
  });
  
  console.log('\n📊 RESUMO DOS ACHADOS:');
  console.log('=' .repeat(60));
  
  if (Object.keys(resultsByFile).length === 0) {
    console.log('❌ PROBLEMA CRÍTICO: Nenhuma implementação de correlação estéreo encontrada!');
    console.log('\n💡 POSSÍVEIS CAUSAS:');
    console.log('1. Função não implementada (retorna valores fixos)');
    console.log('2. Implementação em biblioteca externa não importada');
    console.log('3. Código comentado ou removido');
    console.log('4. Nome de função diferente do esperado');
    
    console.log('\n🔧 AÇÕES RECOMENDADAS:');
    console.log('1. Implementar análise estéreo completa');
    console.log('2. Adicionar correlação cruzada L/R');
    console.log('3. Calcular largura estéreo e fase');
    console.log('4. Validar com material estéreo conhecido');
  } else {
    Object.keys(resultsByFile).forEach(file => {
      console.log(`\n📁 ${file}:`);
      resultsByFile[file].forEach(result => {
        console.log(`   Linha ${result.line}: ${result.term}`);
        console.log(`   Código: ${result.content}`);
      });
    });
  }
  
  // Salvar relatório
  const reportData = {
    timestamp: new Date().toISOString(),
    searchTerms: SEARCH_TERMS,
    directoriesSearched: DIRECTORIES_TO_SEARCH,
    totalMatches: allResults.length,
    resultsByFile,
    criticalIssue: Object.keys(resultsByFile).length === 0,
    recommendations: [
      'Implementar calculateStereoMetrics completa',
      'Adicionar correlação cruzada L/R',
      'Implementar cálculo de largura estéreo',
      'Adicionar análise de fase estéreo',
      'Validar com material de teste conhecido'
    ]
  };
  
  fs.writeFileSync('AUDITORIA_STEREO_MISSING.json', JSON.stringify(reportData, null, 2));
  console.log('\n💾 Relatório salvo em: AUDITORIA_STEREO_MISSING.json');
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as auditStereoMissing };