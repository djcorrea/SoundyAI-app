/**
 * Webhook Mercado Pago - Processamento de pagamentos
 * Confirma pagamentos aprovados e ativa planos automaticamente
 * 
 * Fluxos suportados:
 * - Plano PRO mensal (30 dias)
 * - Combo lançamento PRO (120 dias / 4 meses)
 */

import { applyPlan } from '../work/lib/user/userPlans.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      message: 'Apenas POST é aceito'
    });
  }

  try {
    const { type, data } = req.body;

    console.log('📥 Webhook Mercado Pago recebido:', {
      type,
      dataId: data?.id,
      timestamp: new Date().toISOString()
    });

    // Mercado Pago envia notificação de pagamento
    if (type === 'payment') {
      const paymentId = data.id;

      // Buscar detalhes do pagamento na API do Mercado Pago
      const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      
      if (!accessToken) {
        console.error('❌ MERCADOPAGO_ACCESS_TOKEN não configurado');
        return res.status(500).json({
          error: 'CONFIG_ERROR',
          message: 'Credenciais do Mercado Pago não configuradas'
        });
      }

      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!paymentResponse.ok) {
        console.error('❌ Erro ao buscar pagamento:', paymentResponse.status);
        return res.status(200).json({ received: true }); // Aceita webhook mesmo com erro
      }

      const payment = await paymentResponse.json();

      console.log('💳 Detalhes do pagamento:', {
        id: payment.id,
        status: payment.status,
        externalReference: payment.external_reference,
        amount: payment.transaction_amount
      });

      // Processar apenas pagamentos aprovados
      if (payment.status === 'approved') {
        const uid = payment.external_reference; // UID do Firebase no external_reference
        
        if (!uid) {
          console.error('❌ external_reference (uid) não encontrado no pagamento');
          return res.status(200).json({ received: true });
        }

        // Determinar duração do plano baseado no valor ou metadata
        let durationDays = 30; // Padrão: 1 mês
        
        // Combo de lançamento (4 meses) - identificar por metadata ou valor específico
        const metadata = payment.metadata || {};
        if (metadata.combo === '4months' || metadata.plan === 'pro_4months') {
          durationDays = 120; // 4 meses
          console.log('🎁 Combo de lançamento detectado: 4 meses');
        }

        // Aplicar upgrade do plano
        try {
          const updatedUser = await applyPlan(uid, {
            plan: 'pro',
            durationDays
          });

          console.log('✅ Plano PRO ativado:', {
            uid,
            durationDays,
            expiresAt: updatedUser.proExpiresAt
          });

          return res.status(200).json({
            received: true,
            processed: true,
            plan: 'pro',
            durationDays,
            uid
          });

        } catch (planError) {
          console.error('❌ Erro ao ativar plano:', planError);
          return res.status(200).json({ received: true }); // Aceita webhook mesmo com erro
        }

      } else {
        console.log(`⏳ Pagamento não aprovado ainda: ${payment.status}`);
        return res.status(200).json({ received: true, status: payment.status });
      }
    }

    // Outros tipos de notificação (merchant_order, etc)
    console.log(`📬 Tipo de notificação ignorado: ${type}`);
    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('💥 Erro no webhook:', error);
    // Sempre retornar 200 para evitar retry do Mercado Pago
    return res.status(200).json({ received: true, error: error.message });
  }
}
