/**
 * 🧪 TESTE - Endpoint para verificar se rotas em /api/chat/ funcionam
 */

export default function handler(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Rota /api/chat/test funcionando',
    timestamp: new Date().toISOString(),
    method: req.method,
    path: '/api/chat/test'
  });
}
