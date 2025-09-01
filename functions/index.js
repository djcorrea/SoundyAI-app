import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  const { uid, email, phoneNumber } = user;
  const docRef = db.collection('usuarios').doc(uid);
  const snap = await docRef.get();
  if (!snap.exists) {
    await docRef.set({
      uid,
      email: email || null,
      phone: phoneNumber || null,
      plano: 'gratis',
      mensagensRestantes: 10,
      dataUltimoReset: admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
      entrevistaConcluida: false,
    });
  }
});

export const registerAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login necessário');
  }
  const { fingerprint, phone } = data;
  if (!fingerprint || !phone) {
    throw new functions.https.HttpsError('invalid-argument', 'Dados inválidos');
  }
  const fpRef = db.collection('fingerprints').doc(fingerprint);
  const phoneRef = db.collection('phones').doc(phone);
  const [fpSnap, phoneSnap] = await Promise.all([fpRef.get(), phoneRef.get()]);
  if (fpSnap.exists || phoneSnap.exists) {
    throw new functions.https.HttpsError('already-exists', 'Fingerprint ou telefone já utilizados');
  }
  const now = admin.firestore.Timestamp.now();
  await fpRef.set({ uid: context.auth.uid, phone, createdAt: now });
  await phoneRef.set({ uid: context.auth.uid, fingerprint, createdAt: now });
  return { success: true };
});

// ============ VERIFICAÇÃO AUTOMÁTICA DE PLANOS EXPIRADOS ============
export const checkExpiredPlans = functions.pubsub
  .schedule('0 */6 * * *') // Executa a cada 6 horas (00:00, 06:00, 12:00, 18:00)
  .timeZone('America/Sao_Paulo') // Timezone do Brasil
  .onRun(async (context) => {
    console.log('🕐 Iniciando verificação automática de planos expirados...');
    
    try {
      const now = admin.firestore.Timestamp.now();
      const currentDate = now.toDate();
      
      console.log('📅 Data/hora atual:', currentDate.toISOString());
      
      // Buscar todos os usuários com plano Plus que têm data de expiração
      const expiredQuery = db.collection('usuarios')
        .where('plano', '==', 'plus')
        .where('planExpiresAt', '<=', now);
      
      console.log('🔍 Buscando usuários com plano Plus expirado...');
      const expiredSnapshot = await expiredQuery.get();
      
      if (expiredSnapshot.empty) {
        console.log('✅ Nenhum plano expirado encontrado');
        return null;
      }
      
      console.log(`📊 ${expiredSnapshot.size} usuários com plano expirado encontrados`);
      
      // Usar batch para atualizar todos de uma vez (máximo 500 operações por batch)
      const batch = db.batch();
      let processedCount = 0;
      let batchCount = 0;
      
      const processedUsers = [];
      
      expiredSnapshot.forEach((doc) => {
        const userData = doc.data();
        const userId = doc.id;
        
        // Log detalhado do usuário sendo processado
        console.log(`🔄 Processando usuário: ${userId}`, {
          email: userData.email,
          plano: userData.plano,
          planExpiresAt: userData.planExpiresAt?.toDate?.()?.toISOString() || 'N/A'
        });
        
        // Dados para conversão do plano expirado
        const expiredPlanData = {
          plano: 'gratis',
          isPlus: false,
          planExpiredAt: now,
          previousPlan: 'plus',
          mensagensRestantes: 10,
          dataUltimoReset: now,
          // Preservar dados históricos importantes
          expiredByScheduler: true,
          schedulerProcessedAt: now
        };
        
        batch.update(doc.ref, expiredPlanData);
        processedUsers.push({
          userId,
          email: userData.email || 'sem-email',
          expiredDate: userData.planExpiresAt?.toDate?.()?.toISOString() || 'N/A'
        });
        
        processedCount++;
        
        // Firebase Firestore batch tem limite de 500 operações
        if (processedCount % 500 === 0) {
          batchCount++;
          console.log(`📦 Preparando batch ${batchCount} com 500 operações`);
        }
      });
      
      // Executar o batch
      console.log('💾 Executando atualizações em batch...');
      await batch.commit();
      
      // Log detalhado dos usuários processados
      console.log('📋 USUÁRIOS PROCESSADOS:');
      processedUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.userId} (${user.email}) - expirado em: ${user.expiredDate}`);
      });
      
      console.log(`✅ ${processedCount} planos expirados processados com sucesso!`);
      console.log(`📊 Estatísticas: ${batchCount + 1} batch(es) executado(s)`);
      console.log('🎉 Verificação automática concluída');
      
      return {
        success: true,
        processedCount,
        batchCount: batchCount + 1,
        timestamp: currentDate.toISOString(),
        processedUsers: processedUsers.map(u => ({ userId: u.userId, email: u.email }))
      };
      
    } catch (error) {
      console.error('❌ Erro durante verificação de planos expirados:', error);
      console.error('❌ Stack trace:', error.stack);
      
      // Em caso de erro, ainda retornar informações úteis
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  });

// ============ FUNÇÃO PARA TESTE MANUAL DE PLANOS EXPIRADOS ============
export const testCheckExpiredPlans = functions.https.onCall(async (data, context) => {
  // Verificar autenticação (apenas para admins ou durante desenvolvimento)
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login necessário para executar teste');
  }
  
  console.log('🧪 Iniciando TESTE MANUAL de verificação de planos expirados...');
  console.log('👤 Executado por:', context.auth.uid, context.auth.token.email);
  
  try {
    const now = admin.firestore.Timestamp.now();
    const currentDate = now.toDate();
    
    console.log('📅 Data/hora atual:', currentDate.toISOString());
    
    // Buscar todos os usuários com plano Plus que têm data de expiração
    const expiredQuery = db.collection('usuarios')
      .where('plano', '==', 'plus')
      .where('planExpiresAt', '<=', now);
    
    console.log('🔍 Buscando usuários com plano Plus expirado...');
    const expiredSnapshot = await expiredQuery.get();
    
    if (expiredSnapshot.empty) {
      console.log('✅ Nenhum plano expirado encontrado');
      return {
        success: true,
        message: 'Nenhum plano expirado encontrado',
        processedCount: 0,
        timestamp: currentDate.toISOString()
      };
    }
    
    console.log(`📊 ${expiredSnapshot.size} usuários com plano expirado encontrados`);
    
    // No teste manual, apenas listar sem processar (modo seguro)
    const expiredUsers = [];
    expiredSnapshot.forEach((doc) => {
      const userData = doc.data();
      expiredUsers.push({
        userId: doc.id,
        email: userData.email || 'sem-email',
        plano: userData.plano,
        planExpiresAt: userData.planExpiresAt?.toDate?.()?.toISOString() || 'N/A',
        upgradedAt: userData.upgradedAt?.toDate?.()?.toISOString() || 'N/A'
      });
    });
    
    console.log('📋 USUÁRIOS QUE SERIAM PROCESSADOS:');
    expiredUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.userId} (${user.email}) - expirado em: ${user.planExpiresAt}`);
    });
    
    return {
      success: true,
      message: `${expiredUsers.length} usuários com plano expirado encontrados (apenas listagem de teste)`,
      processedCount: 0,
      expiredUsers: expiredUsers,
      timestamp: currentDate.toISOString(),
      note: 'Esta é uma execução de TESTE - nenhum dados foi alterado'
    };
    
  } catch (error) {
    console.error('❌ Erro durante teste de verificação:', error);
    throw new functions.https.HttpsError('internal', `Erro no teste: ${error.message}`);
  }
});
