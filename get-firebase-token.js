/**
 * 🔑 SCRIPT AUXILIAR - Obter Firebase ID Token
 * 
 * Este script facilita a obtenção do Firebase ID Token necessário
 * para executar o teste de concorrência.
 * 
 * 🚀 USO:
 * node get-firebase-token.js --email=seu@email.com --password=suasenha
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Configuração do Firebase (mesma do cliente)
const firebaseConfig = {
  apiKey: "AIzaSyBKby0RdIOGorhrfBRMCWnL25peU3epGTw",
  authDomain: "prodai-58436.firebaseapp.com",
  projectId: "prodai-58436",
  storageBucket: "prodai-58436.appspot.com",
  messagingSenderId: "801631191322",
  appId: "1:801631322:web:80e3d29cf7468331652ca3",
  measurementId: "G-MBDHDYN6Z0"
};

/**
 * Parse argumentos da linha de comando
 */
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const [key, value] = arg.split('=');
    args[key.replace('--', '')] = value;
  });
  return args;
}

/**
 * Obter Firebase ID Token
 */
async function getFirebaseToken(email, password) {
  try {
    console.log('🔑 Obtendo Firebase ID Token...\n');
    
    // Inicializar Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    
    console.log('📧 Email:', email);
    console.log('🔐 Autenticando...\n');
    
    // Fazer login
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log('✅ Autenticação bem-sucedida!');
    console.log('👤 UID:', user.uid);
    console.log('📧 Email:', user.email);
    console.log('📧 Email verificado:', user.emailVerified ? '✅' : '❌');
    console.log('');
    
    // Obter token
    const idToken = await user.getIdToken();
    
    console.log('🎫 Firebase ID Token obtido com sucesso!\n');
    console.log('═'.repeat(80));
    console.log(idToken);
    console.log('═'.repeat(80));
    console.log('');
    
    console.log('📋 Use este token no comando de teste:');
    console.log('');
    console.log(`node test-concurrency.js \\`);
    console.log(`  --audioFile=./audio.wav \\`);
    console.log(`  --idToken=${idToken}`);
    console.log('');
    
    console.log('⚠️ IMPORTANTE:');
    console.log('   - Este token expira em 1 hora');
    console.log('   - Não compartilhe este token');
    console.log('   - Use conta PRO para evitar limites');
    console.log('');
    
    // Salvar token em arquivo (opcional)
    const fs = await import('fs');
    fs.writeFileSync('.firebase-token', idToken);
    console.log('💾 Token salvo em: .firebase-token');
    console.log('');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro ao obter token:', error.message);
    
    if (error.code === 'auth/user-not-found') {
      console.error('\n⚠️ Usuário não encontrado. Verifique o email.');
    } else if (error.code === 'auth/wrong-password') {
      console.error('\n⚠️ Senha incorreta.');
    } else if (error.code === 'auth/invalid-email') {
      console.error('\n⚠️ Email inválido.');
    } else if (error.code === 'auth/too-many-requests') {
      console.error('\n⚠️ Muitas tentativas. Aguarde alguns minutos.');
    }
    
    console.error('');
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 🚀 EXECUÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n');
  console.log('═'.repeat(80));
  console.log('🔑 OBTER FIREBASE ID TOKEN - SoundyAI');
  console.log('═'.repeat(80));
  console.log('');
  
  const args = parseArgs();
  
  if (!args.email || !args.password) {
    console.log('❌ Parâmetros obrigatórios ausentes!\n');
    console.log('Uso:');
    console.log('  node get-firebase-token.js --email=seu@email.com --password=suasenha\n');
    console.log('Exemplo:');
    console.log('  node get-firebase-token.js --email=teste@soundyai.com --password=minhasenha123\n');
    process.exit(1);
  }
  
  await getFirebaseToken(args.email, args.password);
}

main().catch(error => {
  console.error('❌ Erro fatal:', error.message);
  process.exit(1);
});
