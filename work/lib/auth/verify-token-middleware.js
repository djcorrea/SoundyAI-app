// work/lib/auth/verify-token-middleware.js
// Middleware Express para verificar tokens Firebase ID em rotas protegidas.
// Popula req.user = { uid } após validação bem-sucedida.

import { getAuth } from '../../../firebase/admin.js';

/**
 * Middleware: verifica o token Firebase enviado no header Authorization.
 *
 * Espera: Authorization: Bearer <idToken>
 *
 * Em caso de sucesso: chama next() com req.user = { uid }
 * Em caso de falha:   retorna 401 com JSON { error, message }
 */
export async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Token de autenticação ausente. Faça login para continuar.',
    });
  }

  const token = authHeader.split('Bearer ')[1];

  if (!token || token.trim().length === 0) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Token de autenticação inválido.',
    });
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.user = { uid: decoded.uid };
    next();
  } catch (err) {
    console.error('❌ [AUTH-MIDDLEWARE] Token Firebase inválido:', err.message);
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Token inválido ou expirado. Faça login novamente.',
    });
  }
}
