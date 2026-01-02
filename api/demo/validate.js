/**
 * 🔥 API de Validação do Modo Demo
 * 
 * Validação server-side para anti-burla do modo demo.
 * Usa Redis para persistência com TTL de 30 dias.
 * 
 * @endpoint POST /api/demo/validate
 * @version 1.0.0
 */

import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════
// 📊 CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════

const DEMO_CONFIG = {
    maxAnalyses: 1,
    maxMessages: 1,
    ttlSeconds: 30 * 24 * 60 * 60, // 30 dias
};

// ═══════════════════════════════════════════════════════════
// 💾 STORAGE IN-MEMORY (fallback se Redis não disponível)
// ═══════════════════════════════════════════════════════════

const memoryStore = new Map();

// ═══════════════════════════════════════════════════════════
// 🔧 FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════

/**
 * Gera hash SHA256 de um valor
 */
function hashValue(value) {
    return crypto.createHash('sha256').update(value || '').digest('hex').substring(0, 16);
}

/**
 * Gera identificador único composto para o demo
 */
function generateDemoId(fingerprint, ip, userAgent) {
    const components = [
        fingerprint || 'unknown',
        hashValue(ip),
        hashValue(userAgent),
    ];
    
    return 'demo:' + crypto.createHash('sha256')
        .update(components.join('|'))
        .digest('hex')
        .substring(0, 32);
}

/**
 * Obtém IP real do request
 */
function getRealIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
        || req.headers['x-real-ip'] 
        || req.socket?.remoteAddress 
        || 'unknown';
}

/**
 * Tenta obter cliente Redis (se disponível)
 */
async function getRedisClient() {
    try {
        // Tentar importar redis-connection se existir
        const { getRedisClient: getRedisFn } = await import('../../lib/redis-connection.js');
        return await getRedisFn();
    } catch (e) {
        console.log('[DEMO-API] Redis não disponível, usando memória');
        return null;
    }
}

/**
 * Obtém dados do demo do storage
 */
async function getDemoData(demoId) {
    const redis = await getRedisClient();
    
    if (redis) {
        try {
            const data = await redis.hgetall(demoId);
            if (data && Object.keys(data).length > 0) {
                return {
                    analyses_used: parseInt(data.analyses_used || '0'),
                    messages_used: parseInt(data.messages_used || '0'),
                    first_access: data.first_access,
                    last_access: data.last_access,
                };
            }
        } catch (e) {
            console.error('[DEMO-API] Erro Redis get:', e.message);
        }
    }
    
    // Fallback para memória
    return memoryStore.get(demoId) || null;
}

/**
 * Salva dados do demo no storage
 */
async function saveDemoData(demoId, data) {
    const redis = await getRedisClient();
    
    if (redis) {
        try {
            await redis.hset(demoId, {
                analyses_used: data.analyses_used.toString(),
                messages_used: data.messages_used.toString(),
                first_access: data.first_access,
                last_access: data.last_access,
            });
            await redis.expire(demoId, DEMO_CONFIG.ttlSeconds);
            return true;
        } catch (e) {
            console.error('[DEMO-API] Erro Redis save:', e.message);
        }
    }
    
    // Fallback para memória
    memoryStore.set(demoId, data);
    
    // Limpar entradas antigas (cleanup básico)
    if (memoryStore.size > 10000) {
        const oldest = [...memoryStore.entries()]
            .sort((a, b) => new Date(a[1].last_access) - new Date(b[1].last_access))
            .slice(0, 1000);
        oldest.forEach(([key]) => memoryStore.delete(key));
    }
    
    return true;
}

// ═══════════════════════════════════════════════════════════
// 🚀 HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'METHOD_NOT_ALLOWED',
            message: 'Apenas POST é aceito'
        });
    }
    
    try {
        const { fingerprint, action } = req.body || {};
        const ip = getRealIP(req);
        const userAgent = req.headers['user-agent'] || '';
        
        // Validar parâmetros
        if (!fingerprint) {
            return res.status(400).json({
                error: 'MISSING_FINGERPRINT',
                message: 'Fingerprint é obrigatório'
            });
        }
        
        if (action && !['check', 'analysis', 'message'].includes(action)) {
            return res.status(400).json({
                error: 'INVALID_ACTION',
                message: 'Action inválido. Use: check, analysis, message'
            });
        }
        
        // Gerar ID único
        const demoId = generateDemoId(fingerprint, ip, userAgent);
        
        console.log(`[DEMO-API] Request: action=${action || 'check'}, demoId=${demoId.substring(0, 20)}...`);
        
        // Buscar ou criar dados
        let data = await getDemoData(demoId);
        const now = new Date().toISOString();
        
        if (!data) {
            // Novo visitante
            data = {
                analyses_used: 0,
                messages_used: 0,
                first_access: now,
                last_access: now,
            };
            console.log(`[DEMO-API] Novo visitante demo: ${demoId.substring(0, 20)}...`);
        }
        
        // Verificar limites
        const canAnalyze = data.analyses_used < DEMO_CONFIG.maxAnalyses;
        const canMessage = data.messages_used < DEMO_CONFIG.maxMessages;
        
        // Se ação específica, registrar uso
        let registered = false;
        
        if (action === 'analysis') {
            if (canAnalyze) {
                data.analyses_used++;
                data.last_access = now;
                registered = true;
                console.log(`[DEMO-API] Análise registrada: ${data.analyses_used}/${DEMO_CONFIG.maxAnalyses}`);
            } else {
                console.log(`[DEMO-API] Análise bloqueada - limite atingido`);
            }
        } else if (action === 'message') {
            if (canMessage) {
                data.messages_used++;
                data.last_access = now;
                registered = true;
                console.log(`[DEMO-API] Mensagem registrada: ${data.messages_used}/${DEMO_CONFIG.maxMessages}`);
            } else {
                console.log(`[DEMO-API] Mensagem bloqueada - limite atingido`);
            }
        }
        
        // Salvar dados atualizados
        if (registered || !await getDemoData(demoId)) {
            await saveDemoData(demoId, data);
        }
        
        // Resposta
        return res.status(200).json({
            success: true,
            demoId: demoId.substring(0, 12) + '...', // ID parcial para debug
            state: {
                analysesUsed: data.analyses_used,
                analysesLimit: DEMO_CONFIG.maxAnalyses,
                analysesRemaining: Math.max(0, DEMO_CONFIG.maxAnalyses - data.analyses_used),
                messagesUsed: data.messages_used,
                messagesLimit: DEMO_CONFIG.maxMessages,
                messagesRemaining: Math.max(0, DEMO_CONFIG.maxMessages - data.messages_used),
            },
            permissions: {
                canAnalyze: data.analyses_used < DEMO_CONFIG.maxAnalyses,
                canMessage: data.messages_used < DEMO_CONFIG.maxMessages,
            },
            action: action || 'check',
            registered,
        });
        
    } catch (error) {
        console.error('[DEMO-API] Erro:', error);
        return res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Erro interno do servidor'
        });
    }
}
