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

/**
 * Valida e normaliza número de WhatsApp para formato E.164
 * @param {string|null|undefined} phone - Número de telefone informado
 * @returns {{ valid: boolean, phone: string|null, error?: string }}
 * 
 * Formatos aceitos:
 * - +5511999999999 (E.164 completo)
 * - 5511999999999 (sem +)
 * - 11999999999 (DDD + número BR)
 * - (11) 99999-9999 (formatado BR)
 * - +1234567890 (internacional)
 * 
 * Retorna null se campo não foi preenchido (opcional)
 */
function validateAndNormalizePhone(phone) {
  // Campo opcional: se não preenchido, retorna null (não undefined)
  if (!phone || typeof phone !== 'string' || phone.trim() === '') {
    return { valid: true, phone: null };
  }
  
  // Remover todos os caracteres não-numéricos, exceto o + inicial
  let cleaned = phone.trim();
  const hasPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/[^\d]/g, '');
  
  // Restaurar o + se existia
  if (hasPlus) {
    cleaned = '+' + cleaned;
  }
  
  // Validar tamanho mínimo (pelo menos 8 dígitos para números internacionais)
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length < 8) {
    return { valid: false, error: 'Número de WhatsApp muito curto', phone: null };
  }
  
  // Validar tamanho máximo (E.164 permite até 15 dígitos)
  if (digitsOnly.length > 15) {
    return { valid: false, error: 'Número de WhatsApp muito longo', phone: null };
  }
  
  // Normalizar para formato E.164
  let normalized;
  
  if (cleaned.startsWith('+')) {
    // Já está com código de país
    normalized = cleaned;
  } else if (cleaned.startsWith('55') && digitsOnly.length >= 12) {
    // Número brasileiro sem +
    normalized = '+' + cleaned;
  } else if (digitsOnly.length === 11 || digitsOnly.length === 10) {
    // Número brasileiro com DDD (11 dígitos = celular, 10 = fixo)
    // Assumir Brasil (+55)
    normalized = '+55' + digitsOnly;
  } else if (digitsOnly.length >= 10) {
    // Número internacional sem código de país conhecido
    // Tentar assumir que já tem código de país
    normalized = '+' + digitsOnly;
  } else {
    return { valid: false, error: 'Formato de WhatsApp inválido', phone: null };
  }
  
  // Validação final: formato E.164 (+ seguido de 8-15 dígitos)
  const e164Regex = /^\+[1-9]\d{7,14}$/;
  if (!e164Regex.test(normalized)) {
    return { valid: false, error: 'Número de WhatsApp inválido', phone: null };
  }
  
  return { valid: true, phone: normalized };
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
    
    const { name, email, phone, enrichment } = req.body;
    
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
    
    // Validar e normalizar WhatsApp (opcional)
    const phoneValidation = validateAndNormalizePhone(phone);
    if (!phoneValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: phoneValidation.error,
        field: 'phone'
      });
    }
    
    const sanitizedName = nameValidation.name;
    const sanitizedEmail = emailValidation.email;
    // phone pode ser string normalizada ou null (nunca undefined)
    const sanitizedPhone = phoneValidation.phone;
    
    console.log(`👤 [WAITLIST-API] Lead: ${sanitizedName} <${sanitizedEmail}>${sanitizedPhone ? ` | WhatsApp: ${sanitizedPhone}` : ''}`);
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 2: VERIFICAR DUPLICIDADE E POSSÍVEL ATUALIZAÇÃO
    // ═══════════════════════════════════════════════════════════════
    
    const firestore = getDb();
    const waitlistRef = firestore.collection('waitlist');
    
    // Verificar se e-mail já existe
    const existingQuery = await waitlistRef
      .where('email', '==', sanitizedEmail)
      .limit(1)
      .get();
    
    // Se e-mail já existe, verificar se podemos atualizar o WhatsApp
    if (!existingQuery.empty) {
      const existingDoc = existingQuery.docs[0];
      const existingData = existingDoc.data();
      
      // Se o usuário está fornecendo WhatsApp E o documento atual NÃO tem WhatsApp
      // Permite atualizar apenas o campo phone (não sobrescreve outros dados)
      if (sanitizedPhone && (existingData.phone === null || existingData.phone === undefined)) {
        console.log(`📱 [WAITLIST-API] Atualizando WhatsApp para e-mail existente: ${sanitizedEmail}`);
        
        try {
          await existingDoc.ref.update({
            phone: sanitizedPhone,
            whatsappConsent: true,
            whatsappSent: false,
            _phoneUpdatedAt: getAdmin().firestore.FieldValue.serverTimestamp()
          });
          
          console.log(`✅ [WAITLIST-API] WhatsApp atualizado com sucesso`);
          
          return res.status(200).json({
            success: true,
            message: 'WhatsApp adicionado ao seu cadastro!',
            data: {
              id: existingDoc.id,
              updated: true,
              whatsappAdded: true
            }
          });
        } catch (updateError) {
          console.error('❌ [WAITLIST-API] Erro ao atualizar WhatsApp:', updateError);
          return res.status(500).json({
            success: false,
            error: 'UPDATE_ERROR',
            message: 'Erro ao atualizar cadastro. Tente novamente.'
          });
        }
      }
      
      // E-mail já cadastrado e não há WhatsApp novo para adicionar
      // OU já existe WhatsApp cadastrado (não sobrescreve)
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
      source: 'waitlist', // Padronizado conforme especificação
      status: 'waiting',
      
      // === WHATSAPP (novos campos conforme especificação) ===
      // phone: formato E.164 (ex: +5511999999999) ou null se não informado
      phone: sanitizedPhone,
      // whatsappConsent: true apenas se o campo WhatsApp foi preenchido
      whatsappConsent: sanitizedPhone !== null,
      // whatsappSent: controle para automação futura (Make/WhatsApp Cloud API)
      whatsappSent: false,
      
      // === ENRICHMENT DATA (se disponível) ===
      device: enrichment?.device || null,
      locale: enrichment?.locale || null,
      marketing: enrichment?.marketing || null,
      temporal: enrichment?.temporal || null,
      engagement: enrichment?.engagement || null,
      environment: enrichment?.environment || null,
      inferredProfile: enrichment?.inferredProfile || null,
      
      // === METADATA ===
      _schemaVersion: '2.1', // Incrementado para nova estrutura com WhatsApp
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
