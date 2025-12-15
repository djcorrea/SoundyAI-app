// work/lib/mercadopago/signature.js
// Validação de assinatura HMAC para webhooks Mercado Pago

import crypto from 'crypto';

/**
 * Validar assinatura do webhook Mercado Pago
 * 
 * Mercado Pago envia header x-signature com formato:
 * ts=<timestamp>,v1=<hmac_signature>
 * 
 * @param {Object} req - Request Express
 * @returns {boolean} true se válido
 */
export function validateMercadoPagoSignature(req) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  
  // Se secret não configurado, logar alerta mas permitir (fallback)
  if (!secret) {
    console.warn('⚠️ [MERCADOPAGO] WEBHOOK_SECRET não configurado - validação de assinatura DESABILITADA');
    return true; // Modo permissivo se não configurado
  }
  
  try {
    // Obter assinatura do header
    const signature = req.headers['x-signature'];
    if (!signature) {
      console.error('❌ [MERCADOPAGO] Header x-signature ausente');
      return false;
    }
    
    // Obter request ID
    const requestId = req.headers['x-request-id'];
    if (!requestId) {
      console.error('❌ [MERCADOPAGO] Header x-request-id ausente');
      return false;
    }
    
    // Parsear assinatura: ts=xxx,v1=yyy
    const parts = {};
    signature.split(',').forEach(part => {
      const [key, value] = part.split('=');
      parts[key.trim()] = value.trim();
    });
    
    const timestamp = parts.ts;
    const receivedSignature = parts.v1;
    
    if (!timestamp || !receivedSignature) {
      console.error('❌ [MERCADOPAGO] Formato de assinatura inválido');
      return false;
    }
    
    // Construir payload para validação
    // Formato: id:<data.id>;request-id:<x-request-id>;ts:<ts>
    const paymentId = req.body?.data?.id;
    if (!paymentId) {
      console.error('❌ [MERCADOPAGO] Payment ID ausente no body');
      return false;
    }
    
    const manifest = `id:${paymentId};request-id:${requestId};ts:${timestamp}`;
    
    // Calcular HMAC SHA256
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');
    
    // Comparar assinaturas (timing-safe)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(computedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
    
    if (!isValid) {
      console.error('❌ [MERCADOPAGO] Assinatura inválida');
      console.error(`   Expected: ${computedSignature}`);
      console.error(`   Received: ${receivedSignature}`);
      console.error(`   Manifest: ${manifest}`);
      return false;
    }
    
    console.log('✅ [MERCADOPAGO] Assinatura validada com sucesso');
    return true;
    
  } catch (error) {
    console.error('❌ [MERCADOPAGO] Erro ao validar assinatura:', error.message);
    return false;
  }
}
