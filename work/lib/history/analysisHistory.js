// work/lib/history/analysisHistory.js
// Sistema de Histórico de Análises - APENAS PRO
// ✅ Salva apenas o JSON final, reutiliza renderização existente

import { getFirestore } from "../../../firebase/admin.js";

const getDb = () => getFirestore();
const HISTORY_COLLECTION = "analysis_history"; // Coleção no Firestore
const MAX_HISTORY_PER_USER = 50; // Limite máximo de análises salvas por usuário

console.log(`🕐 [ANALYSIS-HISTORY] Módulo carregado - Collection: ${HISTORY_COLLECTION}`);

/**
 * 🔐 Verifica se usuário é PRO, DJ ou STUDIO (planos com acesso ao histórico)
 * ✅ ATUALIZADO 2026-01-06: STUDIO adicionado
 * @param {string} plan - Plano do usuário
 * @returns {boolean} Se tem acesso ao histórico
 */
function hasHistoryAccess(plan) {
    const normalizedPlan = (plan || 'free').toLowerCase().trim();
    return normalizedPlan === 'pro' || normalizedPlan === 'dj' || normalizedPlan === 'studio';
}

/**
 * 💾 Salva análise no histórico (APENAS para usuários PRO)
 * 
 * @param {string} userId - UID do usuário Firebase
 * @param {string} userPlan - Plano do usuário ('free', 'plus', 'pro', 'dj')
 * @param {Object} analysisResult - JSON completo da análise (mesmo que alimenta o modal)
 * @returns {Promise<{success: boolean, historyId?: string, error?: string}>}
 */
async function saveToHistory(userId, userPlan, analysisResult) {
    console.log(`🕐 [HISTORY] saveToHistory() chamado`, {
        userId: userId?.slice(0, 8) + '...',
        plan: userPlan,
        hasResult: !!analysisResult
    });
    
    // 1️⃣ VALIDAÇÃO: Verificar plano PRO
    if (!hasHistoryAccess(userPlan)) {
        console.log(`🕐 [HISTORY] ⏭️ Plano "${userPlan}" não tem acesso ao histórico - pulando salvamento`);
        return { success: false, error: 'NOT_PRO', message: 'Histórico disponível apenas para PRO' };
    }
    
    // 2️⃣ VALIDAÇÃO: Dados obrigatórios
    if (!userId || !analysisResult) {
        console.error('🕐 [HISTORY] ❌ Dados obrigatórios ausentes:', { hasUserId: !!userId, hasResult: !!analysisResult });
        return { success: false, error: 'MISSING_DATA' };
    }
    
    try {
        const db = getDb();
        const historyRef = db.collection(HISTORY_COLLECTION);
        
        // 3️⃣ EXTRAIR METADADOS
        const trackName = analysisResult.metadata?.fileName || 
                         analysisResult.fileName || 
                         analysisResult.trackName || 
                         'Análise sem nome';
        
        const analysisType = analysisResult.mode === 'reference' ? 'reference' : 'genre';
        
        const genreOrReferenceName = analysisType === 'genre' 
            ? (analysisResult.genre || analysisResult.data?.genre || 'Gênero não definido')
            : (analysisResult.referenceTrackName || analysisResult.metadata?.referenceFileName || 'Referência personalizada');
        
        const analysisVersion = analysisResult.version || '1.0';
        
        // 4️⃣ MONTAR DOCUMENTO
        const historyDoc = {
            userId: userId,
            createdAt: new Date(),
            trackName: trackName,
            analysisType: analysisType, // "genre" | "reference"
            genreOrReferenceName: genreOrReferenceName,
            analysisVersion: analysisVersion,
            // ✅ CRÍTICO: O campo result contém o JSON COMPLETO que alimenta o modal
            result: analysisResult
        };
        
        // 5️⃣ VERIFICAR LIMITE (50 análises)
        const userHistoryQuery = await historyRef
            .where('userId', '==', userId)
            .orderBy('createdAt', 'asc')
            .get();
        
        const existingCount = userHistoryQuery.size;
        console.log(`🕐 [HISTORY] Análises existentes para user: ${existingCount}/${MAX_HISTORY_PER_USER}`);
        
        // Se ultrapassou limite, remover as mais antigas
        if (existingCount >= MAX_HISTORY_PER_USER) {
            const toDelete = existingCount - MAX_HISTORY_PER_USER + 1; // +1 para abrir espaço para a nova
            const docsToDelete = userHistoryQuery.docs.slice(0, toDelete);
            
            console.log(`🕐 [HISTORY] 🗑️ Removendo ${toDelete} análise(s) antiga(s)...`);
            
            for (const doc of docsToDelete) {
                await doc.ref.delete();
                console.log(`🕐 [HISTORY] 🗑️ Removido: ${doc.id}`);
            }
        }
        
        // 6️⃣ SALVAR NOVA ANÁLISE
        const newDoc = await historyRef.add(historyDoc);
        
        console.log(`🕐 [HISTORY] ✅ Análise salva no histórico:`, {
            historyId: newDoc.id,
            trackName: trackName,
            analysisType: analysisType,
            userId: userId.slice(0, 8) + '...'
        });
        
        return { 
            success: true, 
            historyId: newDoc.id,
            trackName: trackName,
            analysisType: analysisType
        };
        
    } catch (error) {
        console.error('🕐 [HISTORY] ❌ Erro ao salvar no histórico:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 📋 Lista histórico de análises do usuário PRO
 * 
 * @param {string} userId - UID do usuário Firebase
 * @param {string} userPlan - Plano do usuário
 * @param {number} limit - Máximo de registros a retornar (default: 50)
 * @returns {Promise<{success: boolean, history?: Array, error?: string}>}
 */
async function getHistory(userId, userPlan, limit = 50) {
    console.log(`🕐 [HISTORY] getHistory() chamado`, {
        userId: userId?.slice(0, 8) + '...',
        plan: userPlan,
        limit
    });
    
    // 1️⃣ VALIDAÇÃO: Verificar plano PRO
    if (!hasHistoryAccess(userPlan)) {
        console.log(`🕐 [HISTORY] ⛔ Plano "${userPlan}" não tem acesso ao histórico`);
        return { success: false, error: 'NOT_PRO', message: 'Histórico disponível apenas para PRO' };
    }
    
    // 2️⃣ VALIDAÇÃO: UserId obrigatório
    if (!userId) {
        console.error('🕐 [HISTORY] ❌ userId obrigatório');
        return { success: false, error: 'MISSING_USER_ID' };
    }
    
    try {
        const db = getDb();
        const historyRef = db.collection(HISTORY_COLLECTION);
        
        // 3️⃣ BUSCAR HISTÓRICO (ordenado por data, mais recente primeiro)
        const querySnapshot = await historyRef
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(Math.min(limit, MAX_HISTORY_PER_USER))
            .get();
        
        // 4️⃣ MAPEAR RESULTADOS (NÃO inclui o result completo, apenas metadados)
        const history = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                trackName: data.trackName,
                analysisType: data.analysisType,
                genreOrReferenceName: data.genreOrReferenceName,
                analysisVersion: data.analysisVersion,
                createdAt: data.createdAt?.toDate?.() || data.createdAt,
                // ⚠️ NÃO incluir 'result' aqui para não sobrecarregar a listagem
            };
        });
        
        console.log(`🕐 [HISTORY] ✅ ${history.length} análises encontradas`);
        
        return { success: true, history: history };
        
    } catch (error) {
        console.error('🕐 [HISTORY] ❌ Erro ao buscar histórico:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 🔍 Busca uma análise específica pelo ID (com result completo)
 * 
 * @param {string} userId - UID do usuário Firebase (para validação de ownership)
 * @param {string} userPlan - Plano do usuário
 * @param {string} historyId - ID do documento no histórico
 * @returns {Promise<{success: boolean, analysis?: Object, error?: string}>}
 */
async function getHistoryItem(userId, userPlan, historyId) {
    console.log(`🕐 [HISTORY] getHistoryItem() chamado`, {
        userId: userId?.slice(0, 8) + '...',
        plan: userPlan,
        historyId
    });
    
    // 1️⃣ VALIDAÇÃO: Verificar plano PRO
    if (!hasHistoryAccess(userPlan)) {
        console.log(`🕐 [HISTORY] ⛔ Plano "${userPlan}" não tem acesso ao histórico`);
        return { success: false, error: 'NOT_PRO', message: 'Histórico disponível apenas para PRO' };
    }
    
    // 2️⃣ VALIDAÇÃO: Dados obrigatórios
    if (!userId || !historyId) {
        console.error('🕐 [HISTORY] ❌ userId e historyId obrigatórios');
        return { success: false, error: 'MISSING_DATA' };
    }
    
    try {
        const db = getDb();
        const docRef = db.collection(HISTORY_COLLECTION).doc(historyId);
        const docSnap = await docRef.get();
        
        // 3️⃣ VERIFICAR SE DOCUMENTO EXISTE
        if (!docSnap.exists) {
            console.warn(`🕐 [HISTORY] ⚠️ Análise não encontrada: ${historyId}`);
            return { success: false, error: 'NOT_FOUND' };
        }
        
        const data = docSnap.data();
        
        // 4️⃣ VALIDAÇÃO DE OWNERSHIP (segurança)
        if (data.userId !== userId) {
            console.error(`🕐 [HISTORY] ⛔ Acesso negado: userId mismatch`);
            return { success: false, error: 'FORBIDDEN' };
        }
        
        // 5️⃣ RETORNAR ANÁLISE COMPLETA (inclui result)
        console.log(`🕐 [HISTORY] ✅ Análise encontrada: ${data.trackName}`);
        
        return {
            success: true,
            analysis: {
                id: docSnap.id,
                trackName: data.trackName,
                analysisType: data.analysisType,
                genreOrReferenceName: data.genreOrReferenceName,
                analysisVersion: data.analysisVersion,
                createdAt: data.createdAt?.toDate?.() || data.createdAt,
                // ✅ CRÍTICO: O result é o JSON que alimenta displayModalResults()
                result: data.result
            }
        };
        
    } catch (error) {
        console.error('🕐 [HISTORY] ❌ Erro ao buscar análise:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 🗑️ Remove uma análise do histórico
 * 
 * @param {string} userId - UID do usuário Firebase
 * @param {string} userPlan - Plano do usuário
 * @param {string} historyId - ID do documento no histórico
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteHistoryItem(userId, userPlan, historyId) {
    console.log(`🕐 [HISTORY] deleteHistoryItem() chamado`, {
        userId: userId?.slice(0, 8) + '...',
        historyId
    });
    
    // 1️⃣ VALIDAÇÃO: Verificar plano PRO
    if (!hasHistoryAccess(userPlan)) {
        return { success: false, error: 'NOT_PRO' };
    }
    
    if (!userId || !historyId) {
        return { success: false, error: 'MISSING_DATA' };
    }
    
    try {
        const db = getDb();
        const docRef = db.collection(HISTORY_COLLECTION).doc(historyId);
        const docSnap = await docRef.get();
        
        if (!docSnap.exists) {
            return { success: false, error: 'NOT_FOUND' };
        }
        
        // Validar ownership
        if (docSnap.data().userId !== userId) {
            return { success: false, error: 'FORBIDDEN' };
        }
        
        await docRef.delete();
        
        console.log(`🕐 [HISTORY] ✅ Análise removida: ${historyId}`);
        return { success: true };
        
    } catch (error) {
        console.error('🕐 [HISTORY] ❌ Erro ao remover:', error);
        return { success: false, error: error.message };
    }
}

// ✅ EXPORTAR FUNÇÕES
export {
    hasHistoryAccess,
    saveToHistory,
    getHistory,
    getHistoryItem,
    deleteHistoryItem,
    MAX_HISTORY_PER_USER
};
