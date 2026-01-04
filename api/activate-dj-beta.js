/**
 * 🎧 API PARA ATIVAR PLANO DJ BETA
 * 
 * Endpoint administrativo para ativar o plano DJ Beta em contas específicas
 * 
 * POST /api/activate-dj-beta
 * Body: { email: "usuario@email.com" }
 * 
 * ⚠️ ATENÇÃO: Este endpoint deve ser protegido em produção!
 * Considere adicionar autenticação de admin ou desabilitar após fase beta.
 */

import { getAuth, getFirestore } from '../firebase/admin.js';

const auth = getAuth();
const db = getFirestore();

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { email, uid } = req.body;

    if (!email && !uid) {
      return res.status(400).json({ 
        error: 'Email ou UID do usuário é obrigatório',
        usage: 'POST /api/activate-dj-beta com body: { email: "usuario@email.com" } ou { uid: "firebaseUid" }'
      });
    }

    console.log(`🎧 [DJ-BETA] Solicitação de ativação recebida:`, { email, uid });

    // Buscar usuário por email ou UID
    let userRecord;
    if (uid) {
      userRecord = await auth.getUser(uid);
    } else {
      userRecord = await auth.getUserByEmail(email);
    }

    if (!userRecord) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userId = userRecord.uid;
    console.log(`👤 [DJ-BETA] Usuário encontrado: ${userId} (${userRecord.email})`);

    // Calcular data de expiração (15 dias a partir de agora)
    const now = Date.now();
    const expiresAt = new Date(now + 15 * 86400000); // 15 dias em milissegundos
    const expiresAtISO = expiresAt.toISOString();

    // Atualizar documento no Firestore
    const userRef = db.collection('usuarios').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Criar documento se não existir
      await userRef.set({
        uid: userId,
        email: userRecord.email,
        plan: 'dj',
        djExpiresAt: expiresAtISO,
        djExpired: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Campos mensais
        messagesMonth: 0,
        analysesMonth: 0,
        imagesMonth: 0,
        billingMonth: new Date().toISOString().slice(0, 7),
      });
    } else {
      // Atualizar documento existente
      await userRef.update({
        plan: 'dj',
        djExpiresAt: expiresAtISO,
        djExpired: false,
        plusExpiresAt: null,   // Limpar outros planos
        proExpiresAt: null,
        updatedAt: new Date().toISOString(),
      });
    }

    console.log(`✅ [DJ-BETA] Plano DJ ativado para ${userRecord.email}`);
    console.log(`📅 [DJ-BETA] Expira em: ${expiresAtISO} (15 dias)`);

    return res.status(200).json({
      success: true,
      message: 'Plano DJ Beta ativado com sucesso',
      user: {
        uid: userId,
        email: userRecord.email,
        plan: 'dj',
        expiresAt: expiresAtISO,
        daysRemaining: 15
      }
    });

  } catch (error) {
    console.error('❌ [DJ-BETA] Erro ao ativar plano:', error);
    return res.status(500).json({ 
      error: 'Erro ao ativar plano DJ Beta',
      details: error.message 
    });
  }
}
