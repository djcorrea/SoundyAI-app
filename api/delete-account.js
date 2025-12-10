import { getAuth, getFirestore } from '../firebase/admin.js';

const auth = getAuth();
const db = getFirestore();

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // Adicionar headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Responder a preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  console.log('🚀 API delete-account chamada');
  console.log('📋 Método:', req.method);
  console.log('📋 Headers:', req.headers);
  
  // Permitir apenas POST
  if (req.method !== 'POST') {
    console.log('❌ Método não permitido:', req.method);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Verificar token de autenticação
    const authHeader = req.headers.authorization || '';
    console.log('🔐 Auth header presente:', !!authHeader);
    
    if (!authHeader.startsWith('Bearer ')) {
      console.log('❌ Token Bearer não encontrado');
      return res.status(401).json({ error: 'Token de autorização não fornecido' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      console.error('❌ Token inválido:', error);
      return res.status(401).json({ error: 'Token inválido' });
    }

    const userId = decodedToken.uid;
    
    // Validação adicional de segurança
    if (!userId || typeof userId !== 'string' || userId.length === 0) {
      console.error('❌ UID inválido no token:', userId);
      return res.status(401).json({ error: 'Token não contém UID válido' });
    }
    
    console.log('🗑️ Iniciando exclusão permanente da conta para usuário:', userId);

    // Buscar dados do usuário no Firestore para verificar se existe
    const userDoc = await db.collection('usuarios').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log('⚠️ Usuário não encontrado no Firestore, mas prosseguindo com exclusão do Auth');
    } else {
      console.log('👤 Dados do usuário encontrados no Firestore');
    }

    // ETAPA 1: EXCLUIR TODOS OS DADOS DO FIRESTORE
    try {
      console.log('🔥 Excluindo dados do Firestore...');
      
      // Excluir documento principal do usuário
      if (userDoc.exists) {
        await db.collection('usuarios').doc(userId).delete();
        console.log('✅ Documento principal do usuário excluído do Firestore');
      }
      
      // Excluir possíveis subcoleções ou documentos relacionados
      // (Se houver mensagens de chat, logs, etc. em outras coleções)
      
      // Exemplo: Se houver uma coleção de mensagens por usuário
      try {
        const messagesQuery = await db.collection('mensagens').where('userId', '==', userId).get();
        if (!messagesQuery.empty) {
          const batch = db.batch();
          messagesQuery.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          console.log(`✅ ${messagesQuery.docs.length} mensagens excluídas do Firestore`);
        }
      } catch (msgError) {
        console.log('⚠️ Nenhuma mensagem encontrada ou erro ao excluir mensagens:', msgError.message);
      }

      // Exemplo: Se houver uma coleção de logs por usuário
      try {
        const logsQuery = await db.collection('logs').where('userId', '==', userId).get();
        if (!logsQuery.empty) {
          const batch = db.batch();
          logsQuery.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          console.log(`✅ ${logsQuery.docs.length} logs excluídos do Firestore`);
        }
      } catch (logError) {
        console.log('⚠️ Nenhum log encontrado ou erro ao excluir logs:', logError.message);
      }

    } catch (firestoreError) {
      console.error('❌ Erro ao excluir dados do Firestore:', firestoreError);
      // Continuar mesmo se houver erro no Firestore, pois o importante é excluir o usuário
    }

    // ETAPA 2: EXCLUIR USUÁRIO DO FIREBASE AUTHENTICATION
    try {
      console.log('🔐 Excluindo usuário do Firebase Authentication...');
      await auth.deleteUser(userId);
      console.log('✅ Usuário excluído do Firebase Authentication');
    } catch (authError) {
      console.error('❌ Erro ao excluir usuário do Authentication:', authError);
      
      // Se não conseguir excluir do Auth, retornar erro
      return res.status(500).json({ 
        error: 'Erro ao excluir conta do sistema de autenticação',
        details: authError.message,
        timestamp: new Date().toISOString()
      });
    }

    console.log('✅ Conta excluída permanentemente com sucesso para usuário:', userId);

    return res.status(200).json({ 
      success: true, 
      message: 'Sua conta foi excluída permanentemente com sucesso. Você será redirecionado para a página inicial.' 
    });

  } catch (error) {
    console.error('❌ Erro completo ao excluir conta:', error);
    console.error('❌ Stack trace:', error.stack);
    
    return res.status(500).json({ 
      error: 'Erro interno do servidor ao excluir conta',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
