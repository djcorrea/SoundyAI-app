/**
 * 📧 API WAITLIST - Endpoint para cadastro na lista de espera
 * 
 * ✅ Fluxo:
 *    1. Frontend envia nome + e-mail + dados enriquecidos
 *    2. Backend valida os dados
 *    3. Backend verifica duplicidade no Firestore
 *    4. Backend salva no Firestore
 *    5. Backend dispara e-mail via Resend
 *    6. Backend retorna sucesso para o frontend
 * 
 * ✅ Garantias:
 *    - Se e-mail falhar, lead NÃO é perdido (já foi salvo)
 *    - Disparo apenas UMA vez por e-mail (verificação de duplicidade)
 *    - Enrichment data preservado mesmo em falha parcial
 * 
 * @version 1.0.0
 * @created 2026-01-05
 */

import express from 'express';
import { getFirestore, getAdmin } from '../work/firebase/admin.js';
import { sendWaitlistConfirmationEmail } from '../lib/email/waitlist-welcome.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════
// FIREBASE - Usando singleton do projeto
// ═══════════════════════════════════════════════════════════════════

/**
 * Obter instância do Firestore usando o singleton global
 */
function getDb() {
  return getFirestore();
}

// ═══════════════════════════════════════════════════════════════════
// VALIDAÇÕES
// ═══════════════════════════════════════════════════════════════════

/**
 * Valida e sanitiza o e-mail
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'E-mail é obrigatório' };
  }
  
  const trimmed = email.trim().toLowerCase();
  
  // Regex básico de validação de e-mail
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'E-mail inválido' };
  }
  
  if (trimmed.length > 255) {
    return { valid: false, error: 'E-mail muito longo' };
  }
  
  return { valid: true, email: trimmed };
}

/**
 * Valida e sanitiza o nome
 */
function validateName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Nome é obrigatório' };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < 2) {
    return { valid: false, error: 'Nome muito curto' };
  }
  
  if (trimmed.length > 100) {
    return { valid: false, error: 'Nome muito longo' };
  }
  
  return { valid: true, name: trimmed };
}

// ═══════════════════════════════════════════════════════════════════
// ROTA PRINCIPAL: POST /api/waitlist
// ═══════════════════════════════════════════════════════════════════

router.post('/', async (req, res) => {
  const startTime = Date.now();
  
  console.log('📥 [WAITLIST-API] Requisição recebida');
  
  try {
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: VALIDAR DADOS
    // ═══════════════════════════════════════════════════════════════
    
    const { name, email, enrichment } = req.body;
    
    // Validar nome
    const nameValidation = validateName(name);
    if (!nameValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: nameValidation.error,
        field: 'name'
      });
    }
    
    // Validar e-mail
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: emailValidation.error,
        field: 'email'
      });
    }
    
    const sanitizedName = nameValidation.name;
    const sanitizedEmail = emailValidation.email;
    
    console.log(`👤 [WAITLIST-API] Lead: ${sanitizedName} <${sanitizedEmail}>`);
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 2: VERIFICAR DUPLICIDADE
    // ═══════════════════════════════════════════════════════════════
    
    const firestore = getDb();
    const waitlistRef = firestore.collection('waitlist');
    
    // Verificar se e-mail já existe
    const existingQuery = await waitlistRef
      .where('email', '==', sanitizedEmail)
      .limit(1)
      .get();
    
    if (!existingQuery.empty) {
      console.log(`⚠️ [WAITLIST-API] E-mail já cadastrado: ${sanitizedEmail}`);
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_EMAIL',
        message: 'Este e-mail já está na lista de espera'
      });
    }
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 3: PREPARAR DADOS COMPLETOS
    // ═══════════════════════════════════════════════════════════════
    
    const leadData = {
      // === DADOS BASE ===
      name: sanitizedName,
      email: sanitizedEmail,
      createdAt: getAdmin().firestore.FieldValue.serverTimestamp(),
      source: 'landing_pre_launch',
      status: 'waiting',
      
      // === ENRICHMENT DATA (se disponível) ===
      device: enrichment?.device || null,
      locale: enrichment?.locale || null,
      marketing: enrichment?.marketing || null,
      temporal: enrichment?.temporal || null,
      engagement: enrichment?.engagement || null,
      environment: enrichment?.environment || null,
      inferredProfile: enrichment?.inferredProfile || null,
      
      // === METADATA ===
      _schemaVersion: '2.0',
      _enrichmentVersion: enrichment ? 'v1' : null,
      _emailSent: false, // Será atualizado após envio
      _emailSentAt: null
    };
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 4: SALVAR NO FIRESTORE (PRIORIDADE MÁXIMA)
    // ═══════════════════════════════════════════════════════════════
    
    let docRef;
    try {
      docRef = await waitlistRef.add(leadData);
      console.log(`✅ [WAITLIST-API] Lead salvo: ${docRef.id}`);
    } catch (firestoreError) {
      console.error('❌ [WAITLIST-API] Erro ao salvar no Firestore:', firestoreError);
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: 'Erro ao salvar cadastro. Tente novamente.'
      });
    }
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 5: DISPARAR E-MAIL (SECUNDÁRIO - NÃO DEVE FALHAR A REQUISIÇÃO)
    // ═══════════════════════════════════════════════════════════════
    
    let emailResult = { success: false, error: 'not_attempted' };
    
    try {
      emailResult = await sendWaitlistConfirmationEmail({
        email: sanitizedEmail,
        name: sanitizedName
      });
      
      // Atualizar documento com status do e-mail
      if (emailResult.success) {
        await docRef.update({
          _emailSent: true,
          _emailSentAt: getAdmin().firestore.FieldValue.serverTimestamp(),
          _emailId: emailResult.emailId
        });
        console.log(`📧 [WAITLIST-API] E-mail enviado: ${emailResult.emailId}`);
      } else {
        // E-mail falhou, mas lead já está salvo
        await docRef.update({
          _emailError: emailResult.error,
          _emailAttemptedAt: getAdmin().firestore.FieldValue.serverTimestamp()
        });
        console.warn(`⚠️ [WAITLIST-API] E-mail falhou:`, emailResult.error);
      }
    } catch (emailError) {
      console.error('❌ [WAITLIST-API] Exceção no envio de e-mail:', emailError);
      // Não falhar a requisição por causa do e-mail
      emailResult = { success: false, error: emailError.message };
      
      try {
        await docRef.update({
          _emailError: emailError.message,
          _emailAttemptedAt: getAdmin().firestore.FieldValue.serverTimestamp()
        });
      } catch (updateError) {
        // Ignorar erro de update secundário
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 6: RETORNAR SUCESSO
    // ═══════════════════════════════════════════════════════════════
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [WAITLIST-API] Concluído em ${duration}ms`, {
      docId: docRef.id,
      emailSent: emailResult.success
    });
    
    return res.status(201).json({
      success: true,
      message: 'Cadastro realizado com sucesso!',
      data: {
        id: docRef.id,
        emailSent: emailResult.success
      }
    });
    
  } catch (error) {
    console.error('❌ [WAITLIST-API] Erro inesperado:', error);
    
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Erro interno. Tente novamente em alguns segundos.'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ROTA DE STATUS: GET /api/waitlist/count
// ═══════════════════════════════════════════════════════════════════

router.get('/count', async (req, res) => {
  try {
    const firestore = getDb();
    const snapshot = await firestore.collection('waitlist').count().get();
    
    return res.json({
      success: true,
      count: snapshot.data().count
    });
  } catch (error) {
    console.error('❌ [WAITLIST-API] Erro ao contar:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR'
    });
  }
});

export default router;
