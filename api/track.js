// api/track.js
// Endpoint de tracking de eventos do funil de conversão.
// POST /api/track — salva eventos no Firestore (coleção: events)

import express from 'express';
import { getFirestore, getAuth } from '../firebase/admin.js';

const router = express.Router();

// Eventos permitidos (whitelist para evitar poluição de dados)
const ALLOWED_EVENTS = new Set([
  'result_viewed',
  'clicked_unlock',
  'clicked_analyze',
  'plans_viewed',
  'checkout_started',
  'purchase',
]);

/**
 * POST /api/track
 * Body: { event: string, sessionId: string, data?: object }
 * Headers (opcional): Authorization: Bearer <firebase_token>
 */
router.post('/', async (req, res) => {
  try {
    const { event, sessionId, data } = req.body;

    // Validação de entrada
    if (!event || typeof event !== 'string') {
      return res.status(400).json({ error: 'invalid_event', message: 'Campo event obrigatório' });
    }

    if (!ALLOWED_EVENTS.has(event)) {
      return res.status(400).json({ error: 'unknown_event', message: `Evento não reconhecido: ${event}` });
    }

    if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 128) {
      return res.status(400).json({ error: 'invalid_session', message: 'sessionId inválido ou ausente' });
    }

    // Tentar identificar usuário autenticado (opcional — não bloqueia se ausente)
    let userId = null;
    let email = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const auth = getAuth();
        const decoded = await auth.verifyIdToken(token);
        userId = decoded.uid || null;
        // Email só salvo se presente no token — não expor desnecessariamente
        email = decoded.email || null;
      } catch (_) {
        // Token inválido/expirado — continua sem userId (tracking anônimo)
      }
    }

    // Sanitizar data — não aceitar tipos não permitidos (objetos simples apenas)
    let safeData = {};
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      // Aceitar apenas chaves simples com valores primitivos
      for (const [key, value] of Object.entries(data)) {
        if (
          typeof key === 'string' &&
          key.length <= 64 &&
          (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null)
        ) {
          safeData[key] = value;
        }
      }
    }

    const db = getFirestore();

    await db.collection('events').add({
      event,
      userId,
      sessionId,
      email,
      timestamp: Date.now(),
      data: safeData,
    });

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('[TRACK] Erro ao salvar evento:', error.message);
    // Responder 200 mesmo em erro — tracking não deve quebrar a experiência
    return res.status(200).json({ ok: false });
  }
});

export default router;
