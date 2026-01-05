/**
 * 🧪 SERVIDOR DE TESTE - Waitlist Email Flow
 * 
 * Servidor isolado para testar apenas o fluxo de e-mail da waitlist
 * sem carregar todo o projeto (evita erro de Firebase não configurado)
 * 
 * Uso: node test-waitlist-server.js
 * Acesse: http://localhost:3333/prelaunch.html
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Simular Firebase Admin para testes
const mockAdmin = {
  apps: [],
  firestore: {
    FieldValue: {
      serverTimestamp: () => new Date().toISOString()
    }
  }
};

// Mock do Firestore
const mockDb = {
  _leads: [],
  collection: (name) => ({
    where: () => ({
      limit: () => ({
        get: async () => ({
          empty: !mockDb._leads.find(l => l.email === mockDb._lastQuery),
          docs: []
        })
      })
    }),
    add: async (data) => {
      mockDb._leads.push(data);
      console.log('📝 [MOCK-FIRESTORE] Lead salvo:', { email: data.email, name: data.name });
      return { id: `mock-${Date.now()}`, update: async () => {} };
    },
    get: async () => ({ size: mockDb._leads.length })
  })
};

// Import do template de e-mail
import { sendWaitlistConfirmationEmail } from './lib/email/waitlist-welcome.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════════════════════════
// ROTA: POST /api/waitlist
// ═══════════════════════════════════════════════════════════════════
app.post('/api/waitlist', async (req, res) => {
  console.log('\n📥 [WAITLIST-TEST] Requisição recebida');
  const startTime = Date.now();

  try {
    const { name, email, enrichment } = req.body;

    // Validação básica
    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Nome e e-mail são obrigatórios'
      });
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedName = name.trim();
    const firstName = sanitizedName.split(' ')[0];

    console.log(`📝 [WAITLIST-TEST] Processando: ${firstName} <${sanitizedEmail}>`);

    // Verificar duplicidade (mock)
    mockDb._lastQuery = sanitizedEmail;
    const existingQuery = await mockDb.collection('waitlist').where().limit().get();
    
    if (!existingQuery.empty) {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_EMAIL',
        message: 'Este e-mail já está na lista de espera'
      });
    }

    // Salvar no Firestore (mock)
    const leadData = {
      name: sanitizedName,
      email: sanitizedEmail,
      createdAt: mockAdmin.firestore.FieldValue.serverTimestamp(),
      source: 'landing_pre_launch',
      status: 'waiting',
      enrichment: enrichment || null
    };

    const docRef = await mockDb.collection('waitlist').add(leadData);
    console.log(`✅ [WAITLIST-TEST] Lead salvo com ID: ${docRef.id}`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: DISPARAR E-MAIL VIA RESEND (REAL!)
    // ═══════════════════════════════════════════════════════════════
    
    let emailResult = { success: false, error: 'not_attempted' };

    try {
      console.log('📧 [WAITLIST-TEST] Disparando e-mail via Resend...');
      
      emailResult = await sendWaitlistConfirmationEmail({
        email: sanitizedEmail,
        name: sanitizedName
      });

      if (emailResult.success) {
        console.log(`📧 [WAITLIST-TEST] ✅ E-mail enviado! ID: ${emailResult.emailId}`);
      } else {
        console.warn(`📧 [WAITLIST-TEST] ⚠️ E-mail falhou:`, emailResult.error);
      }
    } catch (emailError) {
      console.error('❌ [WAITLIST-TEST] Erro no envio:', emailError.message);
      emailResult = { success: false, error: emailError.message };
    }

    // Retornar sucesso
    const duration = Date.now() - startTime;
    console.log(`✅ [WAITLIST-TEST] Concluído em ${duration}ms\n`);

    return res.status(201).json({
      success: true,
      message: 'Você entrou na lista de espera!',
      data: {
        position: mockDb._leads.length,
        emailSent: emailResult.success
      }
    });

  } catch (error) {
    console.error('❌ [WAITLIST-TEST] Erro:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Erro interno. Tente novamente.'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ROTA: GET /api/waitlist/count
// ═══════════════════════════════════════════════════════════════════
app.get('/api/waitlist/count', async (req, res) => {
  res.json({
    success: true,
    count: mockDb._leads.length
  });
});

// ═══════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════
const PORT = 3333;

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║        🧪 SERVIDOR DE TESTE - WAITLIST EMAIL FLOW            ║
╠══════════════════════════════════════════════════════════════╣
║  Servidor rodando em:  http://localhost:${PORT}                 ║
║  Landing page:         http://localhost:${PORT}/prelaunch.html  ║
╠══════════════════════════════════════════════════════════════╣
║  ⚠️  Este servidor usa MOCK para Firestore                   ║
║  ✅ O envio de e-mail é REAL via Resend                      ║
╚══════════════════════════════════════════════════════════════╝
`);

  // Verificar configuração do Resend
  if (process.env.RESEND_API_KEY) {
    console.log('✅ RESEND_API_KEY configurada');
    console.log(`📧 FROM_EMAIL: ${process.env.FROM_EMAIL || 'onboarding@resend.dev'}`);
  } else {
    console.warn('⚠️  RESEND_API_KEY não configurada - e-mails serão simulados');
  }
  
  console.log('');
});
