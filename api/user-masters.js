/**
 * API: User Masters History
 *
 * Endpoints para histórico de masterizações.
 * NÃO altera fluxo de masterização, créditos ou download existente.
 *
 * Endpoints:
 *   GET  /api/user/masters              → Lista histórico (com lazy cleanup de expirados)
 *   GET  /api/user/masters/:id/stream   → Stream de áudio para preview
 *   GET  /api/user/masters/:id/download → Download com atualização de contador
 *
 * Função exportada:
 *   saveMasterToHistory() → Chamada SOMENTE por /api/automaster/download/:jobId
 */

import { Router } from 'express';
import { getFirestore, getAdmin } from '../firebase/admin.js';
import { verifyFirebaseToken } from '../work/lib/auth/verify-token-middleware.js';
import storageServiceModule from '../services/storage-service.cjs';

const router = Router();

// ─── Constantes ───
const SAFE_ID = /^[a-zA-Z0-9_-]+$/;
const EXPIRATION_DAYS = 30;

// ─── GET /api/user/masters ───
// Retorna apenas masters válidos (não expirados).
// LIMPEZA LAZY: antes de retornar, remove expirados do Firestore e do B2 em background.
router.get('/api/user/masters', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const db = getFirestore();
    const now = new Date();

    const snap = await db
      .collection('users').doc(uid)
      .collection('masters')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const valid = [];
    const expiredDocs = [];

    snap.forEach(doc => {
      const d = doc.data();
      const expiresAt = d.expiresAt ? d.expiresAt.toDate() : null;

      if (expiresAt && expiresAt < now) {
        // Acumular para limpeza async — não bloqueia resposta
        expiredDocs.push({ ref: doc.ref, storageKey: d.storageKey || null });
      } else {
        valid.push({
          id: doc.id,
          originalName: d.originalName || null,
          fileName: d.fileName || null,
          mode: d.mode || null,
          createdAt: d.createdAt ? d.createdAt.toDate().toISOString() : null,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
          downloadCount: d.downloadCount ?? 0,
        });
      }
    });

    // Limpeza lazy: executa em background após a resposta ser enviada.
    // Cada doc expirado: (1) remove arquivo do B2 (best-effort), (2) remove doc do Firestore.
    if (expiredDocs.length > 0) {
      Promise.allSettled(
        expiredDocs.map(async ({ ref, storageKey }) => {
          if (storageKey) {
            try { await storageServiceModule.deleteFile(storageKey); } catch (_) {}
          }
          await ref.delete();
        })
      ).catch(err => console.warn('⚠️ [USER-MASTERS] Lazy cleanup error:', err.message));
    }

    return res.json({ masters: valid });
  } catch (err) {
    console.error('❌ [USER-MASTERS] List error:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

// ─── GET /api/user/masters/:id/stream ───
// Stream do arquivo para preview. storageKey nunca exposto ao cliente.
router.get('/api/user/masters/:id/stream', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const masterId = req.params.id;

    if (!SAFE_ID.test(masterId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const db = getFirestore();
    // Acesso restrito ao path users/{uid}/masters — impossível acessar dados de outro usuário
    const doc = await db.collection('users').doc(uid).collection('masters').doc(masterId).get();

    if (!doc.exists) return res.status(404).json({ error: 'Master não encontrado' });

    const data = doc.data();

    if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
      return res.status(410).json({ error: 'Arquivo expirado' });
    }

    if (!data.storageKey) return res.status(404).json({ error: 'Arquivo não disponível' });

    // storageKey usado apenas server-side para buscar no B2
    const buffer = await storageServiceModule.downloadFile(data.storageKey);

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.send(buffer);
  } catch (err) {
    console.error('❌ [USER-MASTERS] Stream error:', err.message);
    return res.status(500).json({ error: 'Erro ao reproduzir' });
  }
});

// ─── GET /api/user/masters/:id/download ───
// Download do arquivo. Incrementa downloadCount + lastDownloadAt após enviar resposta.
router.get('/api/user/masters/:id/download', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const masterId = req.params.id;

    if (!SAFE_ID.test(masterId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const db = getFirestore();
    const admin = getAdmin();
    // Acesso restrito ao path users/{uid}/masters — impossível acessar dados de outro usuário
    const docRef = db.collection('users').doc(uid).collection('masters').doc(masterId);
    const doc = await docRef.get();

    if (!doc.exists) return res.status(404).json({ error: 'Master não encontrado' });

    const data = doc.data();

    if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
      return res.status(410).json({ error: 'Arquivo expirado' });
    }

    if (!data.storageKey) return res.status(404).json({ error: 'Arquivo não disponível' });

    const buffer = await storageServiceModule.downloadFile(data.storageKey);

    const baseName = (data.originalName || 'audio')
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_\-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'audio';

    const safeName = `master-soundyai_${baseName}.wav`;

    // Enviar resposta ANTES de atualizar contador — não bloqueia o download
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);

    // Incrementar contador em background (não bloqueia)
    docRef.update({
      downloadCount: admin.firestore.FieldValue.increment(1),
      lastDownloadAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(err => console.warn('⚠️ [USER-MASTERS] Download count update error:', err.message));
  } catch (err) {
    console.error('❌ [USER-MASTERS] Download error:', err.message);
    return res.status(500).json({ error: 'Erro no download' });
  }
});

export default router;

/**
 * saveMasterToHistory
 *
 * Salva o registro de uma masterização no Firestore.
 *
 * QUANDO É CHAMADO:
 *   - Somente por /api/automaster/download/:jobId (após download real pelo usuário)
 *   - Nunca pelo /api/automaster/status/:jobId
 *
 * IDEMPOTÊNCIA:
 *   - Usa jobId como doc ID em users/{uid}/masters/{jobId}
 *   - Se doc já existe (download repetido), apenas incrementa contador
 *
 * STORAGE:
 *   - NÃO faz novo upload — arquivo já está no B2
 *   - storageKey derivado do padrão output/{jobId}_master.wav
 *   - storageKey nunca é exposto ao cliente
 *
 * @param {string} uid     - UID do usuário autenticado (req.user.uid)
 * @param {string} jobId   - ID do job (doc ID — garante idempotência)
 * @param {object} jobData - Dados do job vindos do jobStore
 */
export async function saveMasterToHistory(uid, jobId, jobData) {
  try {
    const db = getFirestore();
    const admin = getAdmin();
    const docRef = db.collection('users').doc(uid).collection('masters').doc(jobId);

    // Nome original: prioriza original_filename; se ausente usa jobId
    // (nunca usa string genérica "audio" que não identifica o arquivo)
    const rawBase = (jobData.original_filename || jobData.file_name || '')
      .replace(/\.[^.]+$/, '')
      .trim();
    const originalName = rawBase || jobId;

    // storageKey: reutiliza output_key do job (arquivo já está no B2 — sem novo upload)
    const storageKey = jobData.output_key || `output/${jobId}_master.wav`;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + EXPIRATION_DAYS);

    // TRANSAÇÃO ATÔMICA: elimina race condition TOCTOU (Time-Of-Check-Time-Of-Use).
    // Sem transação: dois downloads simultâneos poderiam criar dois docs com downloadCount=1.
    // Com transação: Firestore garante que apenas um cria; o outro incrementa.
    // Em caso de contenção, o Firestore retenta automaticamente (até 5x).
    let finalDownloadCount = 1;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);

      if (snap.exists) {
        // Doc já existe — incrementar contador atomicamente
        tx.update(docRef, {
          downloadCount: admin.firestore.FieldValue.increment(1),
          lastDownloadAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        finalDownloadCount = (snap.data().downloadCount ?? 0) + 1;
      } else {
        // Primeira vez — criar doc completo com todos os campos obrigatórios
        tx.set(docRef, {
          jobId,
          originalName,
          fileName: `Master SoundyAI - ${originalName}`,
          mode: jobData.mode || null,
          storageKey,                 // nunca exposto ao cliente — usado só server-side
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          downloadCount: 1,
          lastDownloadAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        finalDownloadCount = 1;
      }
    });

    // Log pós-salvamento para auditoria
    console.log(JSON.stringify({
      event: 'history_saved',
      jobId,
      downloadCount: finalDownloadCount,
      timestamp: new Date().toISOString(),
    }));
  } catch (err) {
    // Não crítico — nunca bloquear o fluxo de download
    console.error('⚠️ [HISTORY] Erro ao salvar histórico (não fatal):', err.message);
  }
}
