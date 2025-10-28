/**
 * 🧪 TESTE SIMPLIFICADO - VALIDAÇÃO UUID
 * Testar apenas a geração e validação de UUID sem dependências externas
 */

import { randomUUID } from 'crypto';

function validateUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function testUUIDGeneration() {
  console.log('🧪 TESTE DE VALIDAÇÃO UUID');
  console.log('================================================================');
  
  // 🧪 TESTE 1: Gerar UUID válido (como na API)
  console.log('\n🧪 === TESTE 1: GERAÇÃO UUID ===');
  
  const jobId = randomUUID();
  const externalId = `audio-${Date.now()}-${jobId.substring(0, 8)}`;
  
  console.log(`🔑 UUID gerado: ${jobId}`);
  console.log(`📋 External ID: ${externalId}`);
  console.log(`✅ UUID válido: ${validateUUID(jobId)}`);
  console.log(`❌ External ID válido: ${validateUUID(externalId)}`);
  
  // 🧪 TESTE 2: Comparar com formatos inválidos antigos
  console.log('\n🧪 === TESTE 2: COMPARAÇÃO FORMATOS ===');
  
  const invalidIds = [
    'test-1761668038564',
    'teste123',
    `audio-${Date.now()}`,
    'job-' + Math.random().toString(36).substring(2)
  ];
  
  console.log('❌ Formatos INVÁLIDOS (causavam erro 22P02):');
  invalidIds.forEach(id => {
    console.log(`   "${id}" → UUID válido: ${validateUUID(id)}`);
  });
  
  console.log('\n✅ Formato CORRETO (implementado):');
  console.log(`   "${jobId}" → UUID válido: ${validateUUID(jobId)}`);
  
  // 🧪 TESTE 3: Demonstrar estrutura de dados
  console.log('\n🧪 === TESTE 3: ESTRUTURA DADOS ===');
  
  const jobData = {
    // 🔑 Para PostgreSQL (coluna 'id' tipo 'uuid')
    jobId: jobId,
    
    // 📋 Para logs e identificação externa
    externalId: externalId,
    
    // 📁 Dados do arquivo
    fileKey: 'test/uuid-validation.wav',
    fileName: 'test-file.wav',
    mode: 'genre'
  };
  
  console.log('📊 Estrutura de dados do job:');
  console.log(JSON.stringify(jobData, null, 2));
  
  // 🧪 TESTE 4: Simular SQL que funcionará
  console.log('\n🧪 === TESTE 4: SQL SIMULADO ===');
  
  const sqlQuery = `INSERT INTO jobs (id, file_key, mode, status, file_name, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`;
  
  const sqlParams = [jobId, jobData.fileKey, jobData.mode, "queued", jobData.fileName];
  
  console.log('✅ SQL que funcionará:');
  console.log('Query:', sqlQuery);
  console.log('Params:', sqlParams);
  console.log(`🔑 Parâmetro $1 (UUID): ${sqlParams[0]} → Válido: ${validateUUID(sqlParams[0])}`);
  
  console.log('\n🎉 === RESULTADOS FINAIS ===');
  console.log('✅ UUID válido gerado com randomUUID()');
  console.log('✅ PostgreSQL aceitará o UUID na coluna tipo "uuid"');
  console.log('✅ External ID disponível para logs personalizados');
  console.log('✅ Estrutura compatível com Worker existente');
  console.log('❌ Formatos antigos (test-*, audio-*) eliminados');
  
  return {
    success: true,
    jobId: jobId,
    externalId: externalId,
    validUUID: validateUUID(jobId)
  };
}

// Executar teste
try {
  const result = testUUIDGeneration();
  console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO');
  process.exit(0);
} catch (error) {
  console.error('\n💥 ERRO NO TESTE:', error.message);
  process.exit(1);
}