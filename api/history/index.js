// api/history/index.js
// API de Histórico de Análises - APENAS PRO
// Endpoints para listar, buscar e deletar análises salvas

import express from "express";
import { getFirestore } from "../../firebase/admin.js";

const router = express.Router();

// 🔧 Configurações
const HISTORY_COLLECTION = "analysis_history";
const MAX_HISTORY_PER_USER = 50;

// 🔐 Middleware de verificação de plano PRO
function requirePro(req, res, next) {
    const userPlan = req.headers['x-user-plan'] || req.body?.userPlan || 'free';
    const normalizedPlan = userPlan.toLowerCase().trim();
    
    if (normalizedPlan !== 'pro' && normalizedPlan !== 'dj') {
        console.log(`🕐 [HISTORY-API] ⛔ Acesso negado - plano: ${userPlan}`);
        return res.status(403).json({
            success: false,
            error: 'FORBIDDEN',
            message: 'Histórico disponível apenas para usuários PRO'
        });
    }
    
    req.userPlan = normalizedPlan;
    next();
}

/**
 * POST /api/history
 * Salva nova análise no histórico do usuário PRO
 * Headers: x-user-id, x-user-plan
 * Body: { analysisResult: Object }
 */
router.post('/', requirePro, async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { analysisResult } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_USER_ID',
                message: 'Header x-user-id é obrigatório'
            });
        }
        
        if (!analysisResult) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_DATA',
                message: 'analysisResult é obrigatório no body'
            });
        }
        
        console.log(`🕐 [HISTORY-API] POST / - userId: ${userId.slice(0, 8)}...`);
        
        const db = getFirestore();
        const historyRef = db.collection(HISTORY_COLLECTION);
        
        // Extrair metadados
        const trackName = analysisResult.metadata?.fileName || 
                         analysisResult.fileName || 
                         analysisResult.trackName || 
                         'Análise sem nome';
        
        const analysisType = analysisResult.mode === 'reference' ? 'reference' : 'genre';
        
        const genreOrReferenceName = analysisType === 'genre' 
            ? (analysisResult.genre || analysisResult.data?.genre || 'Gênero não definido')
            : (analysisResult.referenceTrackName || analysisResult.metadata?.referenceFileName || 'Referência personalizada');
        
        const analysisVersion = analysisResult.version || '1.0';
        
        // Verificar limite (50 análises)
        const userHistoryQuery = await historyRef
            .where('userId', '==', userId)
            .orderBy('createdAt', 'asc')
            .get();
        
        const existingCount = userHistoryQuery.size;
        console.log(`🕐 [HISTORY-API] Análises existentes: ${existingCount}/${MAX_HISTORY_PER_USER}`);
        
        // Se ultrapassou limite, remover as mais antigas
        if (existingCount >= MAX_HISTORY_PER_USER) {
            const toDelete = existingCount - MAX_HISTORY_PER_USER + 1;
            const docsToDelete = userHistoryQuery.docs.slice(0, toDelete);
            
            console.log(`🕐 [HISTORY-API] 🗑️ Removendo ${toDelete} análise(s) antiga(s)...`);
            
            for (const doc of docsToDelete) {
                await doc.ref.delete();
            }
        }
        
        // Salvar nova análise
        const historyDoc = {
            userId: userId,
            createdAt: new Date(),
            trackName: trackName,
            analysisType: analysisType,
            genreOrReferenceName: genreOrReferenceName,
            analysisVersion: analysisVersion,
            result: analysisResult
        };
        
        const newDoc = await historyRef.add(historyDoc);
        
        console.log(`🕐 [HISTORY-API] ✅ Análise salva: ${newDoc.id}`);
        
        res.json({
            success: true,
            historyId: newDoc.id,
            trackName: trackName,
            analysisType: analysisType
        });
        
    } catch (error) {
        console.error('🕐 [HISTORY-API] ❌ Erro POST /:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

/**
 * GET /api/history
 * Lista histórico de análises do usuário PRO
 * Headers: x-user-id, x-user-plan
 */
router.get('/', requirePro, async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const limit = Math.min(parseInt(req.query.limit) || 50, MAX_HISTORY_PER_USER);
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_USER_ID',
                message: 'Header x-user-id é obrigatório'
            });
        }
        
        console.log(`🕐 [HISTORY-API] GET / - userId: ${userId.slice(0, 8)}...`);
        
        const db = getFirestore();
        const historyRef = db.collection(HISTORY_COLLECTION);
        
        const querySnapshot = await historyRef
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        
        const history = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                trackName: data.trackName,
                analysisType: data.analysisType,
                genreOrReferenceName: data.genreOrReferenceName,
                analysisVersion: data.analysisVersion,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
            };
        });
        
        console.log(`🕐 [HISTORY-API] ✅ ${history.length} análises encontradas`);
        
        res.json({
            success: true,
            count: history.length,
            history: history
        });
        
    } catch (error) {
        console.error('🕐 [HISTORY-API] ❌ Erro GET /:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

/**
 * GET /api/history/:id
 * Busca uma análise específica pelo ID (inclui result completo)
 * Headers: x-user-id, x-user-plan
 */
router.get('/:id', requirePro, async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const historyId = req.params.id;
        
        if (!userId || !historyId) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_DATA',
                message: 'userId e historyId são obrigatórios'
            });
        }
        
        console.log(`🕐 [HISTORY-API] GET /${historyId} - userId: ${userId.slice(0, 8)}...`);
        
        const db = getFirestore();
        const docRef = db.collection(HISTORY_COLLECTION).doc(historyId);
        const docSnap = await docRef.get();
        
        if (!docSnap.exists) {
            return res.status(404).json({
                success: false,
                error: 'NOT_FOUND',
                message: 'Análise não encontrada'
            });
        }
        
        const data = docSnap.data();
        
        // 🔐 Validação de ownership
        if (data.userId !== userId) {
            console.warn(`🕐 [HISTORY-API] ⛔ Ownership mismatch: ${data.userId} != ${userId}`);
            return res.status(403).json({
                success: false,
                error: 'FORBIDDEN',
                message: 'Você não tem permissão para acessar esta análise'
            });
        }
        
        console.log(`🕐 [HISTORY-API] ✅ Análise encontrada: ${data.trackName}`);
        
        res.json({
            success: true,
            analysis: {
                id: docSnap.id,
                trackName: data.trackName,
                analysisType: data.analysisType,
                genreOrReferenceName: data.genreOrReferenceName,
                analysisVersion: data.analysisVersion,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                // ✅ CRÍTICO: result é o JSON completo para displayModalResults()
                result: data.result
            }
        });
        
    } catch (error) {
        console.error('🕐 [HISTORY-API] ❌ Erro GET /:id:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

/**
 * DELETE /api/history/:id
 * Remove uma análise do histórico
 * Headers: x-user-id, x-user-plan
 */
router.delete('/:id', requirePro, async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const historyId = req.params.id;
        
        if (!userId || !historyId) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_DATA',
                message: 'userId e historyId são obrigatórios'
            });
        }
        
        console.log(`🕐 [HISTORY-API] DELETE /${historyId} - userId: ${userId.slice(0, 8)}...`);
        
        const db = getFirestore();
        const docRef = db.collection(HISTORY_COLLECTION).doc(historyId);
        const docSnap = await docRef.get();
        
        if (!docSnap.exists) {
            return res.status(404).json({
                success: false,
                error: 'NOT_FOUND',
                message: 'Análise não encontrada'
            });
        }
        
        // 🔐 Validação de ownership
        if (docSnap.data().userId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'FORBIDDEN',
                message: 'Você não tem permissão para deletar esta análise'
            });
        }
        
        await docRef.delete();
        
        console.log(`🕐 [HISTORY-API] ✅ Análise removida: ${historyId}`);
        
        res.json({
            success: true,
            message: 'Análise removida com sucesso'
        });
        
    } catch (error) {
        console.error('🕐 [HISTORY-API] ❌ Erro DELETE /:id:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

export default router;
