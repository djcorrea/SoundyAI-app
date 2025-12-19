#!/usr/bin/env node

/**
 * Script de Validação Rápida - Reference Base Fix
 * Valida se o deploy corrigiu o bug crítico
 */

const BASE_URL = process.env.API_URL || 'https://soundyai-app-production.up.railway.app';

console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║  🔍 VALIDAÇÃO: Reference Base Fix                                ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

async function checkVersion() {
  console.log('1️⃣  Verificando versão da API...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/health/version`);
    const data = await response.json();
    
    console.log(`   ✅ Build Tag: ${data.buildTag}`);
    console.log(`   ✅ Git SHA: ${data.gitSha.substring(0, 7)}`);
    console.log(`   ✅ Entrypoint: ${data.entrypoint}`);
    console.log(`   ✅ Handler: ${data.jobsHandlerPath}`);
    console.log(`   ✅ Uptime: ${data.uptime}s\n`);
    
    if (data.buildTag !== 'SOUNDYAI_2025_12_18_B') {
      console.log('   ⚠️  Build antigo detectado! Recomendado: railway up --force\n');
      return false;
    }
    
    return true;
  } catch (error) {
    console.log(`   ❌ Erro ao verificar versão: ${error.message}\n`);
    return false;
  }
}

async function checkJobHeaders(jobId) {
  console.log(`2️⃣  Verificando headers de /api/jobs/:id...`);
  
  if (!jobId) {
    console.log('   ⏭️  Pulando (jobId não fornecido)\n');
    console.log('   💡 Para testar: node validate-fix.js <job-id>\n');
    return null;
  }
  
  try {
    const response = await fetch(`${BASE_URL}/api/jobs/${jobId}`);
    
    const handler = response.headers.get('x-soundyai-jobs-handler');
    const buildTag = response.headers.get('x-build-tag');
    const gitSha = response.headers.get('x-git-sha');
    
    console.log(`   ✅ X-SOUNDYAI-JOBS-HANDLER: ${handler}`);
    console.log(`   ✅ X-BUILD-TAG: ${buildTag}`);
    console.log(`   ✅ X-GIT-SHA: ${gitSha?.substring(0, 7)}\n`);
    
    const data = await response.json();
    
    if (data.job?.mode === 'reference' && data.job?.referenceStage === 'base') {
      console.log('3️⃣  Validando Reference Base...');
      console.log(`   ✅ Status: ${data.job.status}`);
      console.log(`   ✅ referenceJobId: ${data.job.referenceJobId ?? 'null'}`);
      console.log(`   ✅ requiresSecondTrack: ${data.job.requiresSecondTrack}`);
      console.log(`   ✅ nextAction: ${data.job.nextAction}\n`);
      
      if (data.job.status === 'completed' && data.job.referenceJobId === null) {
        console.log('   🎉 CORREÇÃO CONFIRMADA!\n');
        return true;
      } else {
        console.log('   ⚠️  Ainda com problema:\n');
        if (data.job.status !== 'completed') {
          console.log(`      - Status deveria ser 'completed', mas é '${data.job.status}'`);
        }
        if (data.job.referenceJobId !== null) {
          console.log(`      - referenceJobId deveria ser null, mas é '${data.job.referenceJobId}'`);
        }
        console.log('');
        return false;
      }
    } else {
      console.log('   ℹ️  Job não é reference-base (pular validação específica)\n');
    }
    
    return null;
  } catch (error) {
    console.log(`   ❌ Erro ao verificar job: ${error.message}\n`);
    return false;
  }
}

async function main() {
  const jobId = process.argv[2];
  
  const versionOk = await checkVersion();
  const jobOk = await checkJobHeaders(jobId);
  
  console.log('═══════════════════════════════════════════════════════════════════');
  
  if (versionOk && (jobOk === true || jobOk === null)) {
    console.log('✅ VALIDAÇÃO COMPLETA: API atualizada com sucesso!');
  } else if (versionOk && jobOk === false) {
    console.log('⚠️  ATENÇÃO: API atualizada mas job ainda apresenta problema');
    console.log('    Verificar logs Railway para mais detalhes');
  } else {
    console.log('❌ VALIDAÇÃO FALHOU: API não foi atualizada corretamente');
    console.log('    Executar: railway up --force');
  }
  
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
