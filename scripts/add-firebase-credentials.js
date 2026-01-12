// scripts/add-firebase-credentials.js
// 🔑 Helper para adicionar credenciais do Firebase ao .env

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho do arquivo .env
const envPath = path.join(__dirname, '..', '.env');

// Caminho padrão onde o Firebase salva o JSON (Downloads)
const defaultJsonPath = path.join(
  process.env.USERPROFILE || process.env.HOME,
  'Downloads'
);

console.log('========================================');
console.log('🔑 CONFIGURAÇÃO DE CREDENCIAIS FIREBASE');
console.log('========================================\n');

// Procurar arquivo JSON no Downloads
console.log(`📂 Procurando arquivo JSON em: ${defaultJsonPath}\n`);

const files = fs.readdirSync(defaultJsonPath);
const jsonFiles = files.filter(f => 
  f.startsWith('prodai-58436-') && f.endsWith('.json')
);

if (jsonFiles.length === 0) {
  console.error('❌ NENHUM ARQUIVO JSON ENCONTRADO');
  console.log('\n📋 INSTRUÇÕES:');
  console.log('1. Clique no botão "Gerar nova chave privada" no Firebase Console');
  console.log('2. Baixe o arquivo JSON');
  console.log('3. Execute novamente: node scripts/add-firebase-credentials.js\n');
  process.exit(1);
}

// Usar o arquivo mais recente
const latestFile = jsonFiles.sort().reverse()[0];
const jsonPath = path.join(defaultJsonPath, latestFile);

console.log(`✅ Arquivo encontrado: ${latestFile}\n`);

try {
  // Ler o JSON
  const serviceAccount = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  
  // Validar campos obrigatórios
  const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
  const missingFields = requiredFields.filter(field => !serviceAccount[field]);
  
  if (missingFields.length > 0) {
    console.error(`❌ Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
    process.exit(1);
  }
  
  console.log('✅ JSON validado com sucesso');
  console.log(`   Project ID: ${serviceAccount.project_id}`);
  console.log(`   Client Email: ${serviceAccount.client_email}\n`);
  
  // Converter para string em linha única
  const jsonString = JSON.stringify(serviceAccount);
  
  // Ler .env atual
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Verificar se FIREBASE_SERVICE_ACCOUNT já existe
  if (envContent.includes('FIREBASE_SERVICE_ACCOUNT=')) {
    console.log('⚠️  FIREBASE_SERVICE_ACCOUNT já existe no .env');
    console.log('   Substituindo valor antigo...\n');
    
    // Substituir linha existente
    envContent = envContent.replace(
      /FIREBASE_SERVICE_ACCOUNT=.*/,
      `FIREBASE_SERVICE_ACCOUNT=${jsonString}`
    );
  } else {
    console.log('➕ Adicionando FIREBASE_SERVICE_ACCOUNT ao .env...\n');
    
    // Adicionar no final
    envContent += `\n# Firebase Admin SDK (Service Account)\nFIREBASE_SERVICE_ACCOUNT=${jsonString}\n`;
  }
  
  // Salvar .env
  fs.writeFileSync(envPath, envContent, 'utf8');
  
  console.log('========================================');
  console.log('✅ CREDENCIAIS CONFIGURADAS COM SUCESSO!');
  console.log('========================================\n');
  
  console.log('📋 Próximos passos:');
  console.log('   1. Testar script de limpeza:');
  console.log('      node scripts/cleanup-users.js\n');
  
  // Opcional: Apagar o arquivo JSON baixado (segurança)
  console.log('🗑️  Deseja apagar o arquivo JSON baixado? (recomendado por segurança)');
  console.log(`   Arquivo: ${jsonPath}`);
  console.log('   Para apagar manualmente, execute:');
  console.log(`   Remove-Item "${jsonPath}"\n`);
  
} catch (err) {
  console.error('❌ ERRO AO PROCESSAR ARQUIVO:');
  console.error(err.message);
  console.log('\n💡 Verifique se o arquivo JSON está correto e tente novamente.\n');
  process.exit(1);
}
