#!/usr/bin/env node
/**
 * 🧪 SCRIPT DE VALIDAÇÃO PÓS-PATCH
 * Valida que os patches 1-3 foram aplicados corretamente
 * 
 * USAGE:
 * node validate-patches.cjs [JOB_ID]
 * 
 * Se JOB_ID não fornecido, processará um arquivo de teste.
 */

const http = require('http');
const fs = require('fs');

const API_BASE = 'http://localhost:3001';
const jobId = process.argv[2];

console.log('🧪 VALIDAÇÃO DE PATCHES (Core Métricas Market-Ready)\n');

if (!jobId) {
  console.log('⚠️ JOB_ID não fornecido. Forneça um job existente:');
  console.log('   node validate-patches.cjs [JOB_ID]\n');
  console.log('💡 Ou processe um arquivo de teste primeiro:');
  console.log('   curl -X POST http://localhost:3001/api/jobs -F "audioFile=@test.mp3"\n');
  process.exit(1);
}

console.log(`📊 Validando JOB: ${jobId}\n`);

// Fetch job data
http.get(`${API_BASE}/api/jobs/${jobId}`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const tech = json.technicalData || {};
      
      console.log('═══════════════════════════════════════════════════');
      console.log('📦 PATCH 3: Contrato JSON Explícito');
      console.log('═══════════════════════════════════════════════════\n');
      
      // Validar PATCH 3: Chaves explícitas
      const hasNewKeys = tech.rmsPeak300msDb !== undefined && tech.rmsAverageDb !== undefined;
      const hasOldKeys = tech.peak !== undefined && tech.rms !== undefined && tech.avgLoudness !== undefined;
      
      console.log('🆕 Chaves Novas (explícitas):');
      console.log(`   rmsPeak300msDb:  ${tech.rmsPeak300msDb !== undefined ? '✅' : '❌'} ${tech.rmsPeak300msDb ?? 'AUSENTE'}`);
      console.log(`   rmsAverageDb:    ${tech.rmsAverageDb !== undefined ? '✅' : '❌'} ${tech.rmsAverageDb ?? 'AUSENTE'}`);
      
      console.log('\n🔄 Chaves Legadas (backward compat):');
      console.log(`   peak:            ${tech.peak !== undefined ? '✅' : '❌'} ${tech.peak ?? 'AUSENTE'}`);
      console.log(`   rms:             ${tech.rms !== undefined ? '✅' : '❌'} ${tech.rms ?? 'AUSENTE'}`);
      console.log(`   avgLoudness:     ${tech.avgLoudness !== undefined ? '✅' : '❌'} ${tech.avgLoudness ?? 'AUSENTE'}`);
      
      // Validar valores idênticos
      console.log('\n🔍 Validação de Compatibilidade:');
      const peakMatch = Math.abs((tech.rmsPeak300msDb || 0) - (tech.peak || 0)) < 0.01;
      const rmsMatch = Math.abs((tech.rmsAverageDb || 0) - (tech.rms || 0)) < 0.01;
      const avgMatch = Math.abs((tech.rmsAverageDb || 0) - (tech.avgLoudness || 0)) < 0.01;
      
      console.log(`   rmsPeak300msDb == peak:       ${peakMatch ? '✅' : '❌'} (diff=${Math.abs(tech.rmsPeak300msDb - tech.peak).toFixed(3)})`);
      console.log(`   rmsAverageDb == rms:          ${rmsMatch ? '✅' : '❌'} (diff=${Math.abs(tech.rmsAverageDb - tech.rms).toFixed(3)})`);
      console.log(`   rmsAverageDb == avgLoudness:  ${avgMatch ? '✅' : '❌'} (diff=${Math.abs(tech.rmsAverageDb - tech.avgLoudness).toFixed(3)})`);
      
      console.log('\n═══════════════════════════════════════════════════');
      console.log('📊 OUTRAS MÉTRICAS (sanity check)');
      console.log('═══════════════════════════════════════════════════\n');
      
      console.log('Core Metrics:');
      console.log(`   LUFS Integrado:   ${tech.lufsIntegrated?.toFixed(2) ?? '—'} LUFS`);
      console.log(`   True Peak:        ${tech.truePeakDbtp?.toFixed(2) ?? '—'} dBTP`);
      console.log(`   Dynamic Range:    ${tech.dynamicRange?.toFixed(2) ?? '—'} dB`);
      console.log(`   LRA:              ${tech.lra?.toFixed(2) ?? '—'} LU`);
      console.log(`   Crest Factor:     ${tech.crestFactor?.toFixed(2) ?? '—'} dB`);
      
      // Invariantes básicos
      console.log('\n🔍 Invariantes Matemáticas:');
      
      const rmsCheck = tech.rmsAverageDb <= tech.rmsPeak300msDb + 0.5;
      console.log(`   RMS Average <= RMS Peak:  ${rmsCheck ? '✅' : '❌'} (${tech.rmsAverageDb?.toFixed(2)} <= ${tech.rmsPeak300msDb?.toFixed(2)})`);
      
      const drCheck = tech.dynamicRange >= 0;
      console.log(`   Dynamic Range >= 0:       ${drCheck ? '✅' : '❌'} (${tech.dynamicRange?.toFixed(2)} dB)`);
      
      if (tech.samplePeakDbfs !== undefined && tech.truePeakDbtp !== undefined) {
        const peakCheck = tech.truePeakDbtp >= tech.samplePeakDbfs - 0.5;
        console.log(`   True Peak >= Sample Peak: ${peakCheck ? '✅' : '❌'} (${tech.truePeakDbtp?.toFixed(2)} >= ${tech.samplePeakDbfs?.toFixed(2)})`);
      } else {
        console.log(`   True Peak >= Sample Peak: ⏭️ SKIPPED (Sample Peak não calculado)`);
      }
      
      // Resultado final
      console.log('\n═══════════════════════════════════════════════════');
      console.log('🎯 RESULTADO DA VALIDAÇÃO');
      console.log('═══════════════════════════════════════════════════\n');
      
      const allChecks = hasNewKeys && hasOldKeys && peakMatch && rmsMatch && avgMatch && rmsCheck && drCheck;
      
      if (allChecks) {
        console.log('✅ TODOS OS CHECKS PASSARAM!');
        console.log('✅ Patches 1-3 aplicados corretamente');
        console.log('✅ Backward compatibility mantida');
        console.log('✅ Sistema "market-ready"\n');
      } else {
        console.log('❌ ALGUNS CHECKS FALHARAM!');
        if (!hasNewKeys) console.log('❌ Chaves novas ausentes (Patch 3 não aplicado?)');
        if (!hasOldKeys) console.log('❌ Chaves legadas ausentes (quebrou compatibilidade!)');
        if (!peakMatch || !rmsMatch || !avgMatch) console.log('❌ Valores divergem entre chaves novas/antigas');
        if (!rmsCheck) console.log('❌ Invariante RMS violado');
        if (!drCheck) console.log('❌ Dynamic Range inválido');
        console.log();
      }
      
      // Instruções de UI
      console.log('📱 VALIDAÇÃO MANUAL DA UI:');
      console.log('   1. Abra: http://localhost:3000');
      console.log(`   2. Carregue job: ${jobId}`);
      console.log('   3. Verifique card: deve exibir "RMS Peak (300ms)" (não "Pico Máximo")');
      console.log('   4. Verifique tabela: "Dynamic Range (dB)" (não "LU")\n');
      
    } catch (err) {
      console.error('❌ Erro ao parsear JSON:', err.message);
      console.error('   Response:', data.substring(0, 500));
      process.exit(1);
    }
  });
}).on('error', (err) => {
  console.error('❌ Erro ao conectar API:', err.message);
  console.error('   Servidor rodando em http://localhost:3001 ?');
  process.exit(1);
});
