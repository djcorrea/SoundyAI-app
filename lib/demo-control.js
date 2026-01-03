/**
 * 🔥 DEMO CONTROL - BACKEND
 * 
 * Controle de limite do modo demo 100% server-side
 * Torna impossível burlar limpando cache do navegador
 * 
 * ESTRATÉGIA DE IDENTIFICAÇÃO:
 * - Gera demo_id único baseado em múltiplos fatores
 * - fingerprint (FingerprintJS do frontend)
 * - IP address (ou subnet /24 para NAT)
 * - User-Agent
 * - Timezone
 * - Accept-Language
 * 
 * STORAGE:
 * - Redis com TTL de 30 dias
 * - Key: demo:{demo_id}
 * - Value: { used: boolean, usedAt: timestamp, ip: string }
 * 
 * @version 1.0.0
 * @created 2026-01-03
 */

import crypto from 'crypto';
import { getRedisConnection } from './redis-connection.js';

// Configuração
const DEMO_CONFIG = {
    // TTL do bloqueio: 30 dias em segundos
    blockTTL: 30 * 24 * 60 * 60,
    
    // Prefixo das keys no Redis
    keyPrefix: 'demo:',
    
    // Limite de análises por demo_id
    maxAnalyses: 1,
};

/**
 * Extrai IP real do request (considerando proxies/load balancers)
 * @param {Request} req - Express request
 * @returns {string} IP address
 */
function getClientIP(req) {
    // Railway/Vercel usam x-forwarded-for
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // Pode ter múltiplos IPs, pegar o primeiro (cliente original)
        return forwarded.split(',')[0].trim();
    }
    
    // Fallback para IP direto
    return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * Extrai subnet /24 do IP (para lidar com NAT dinâmico)
 * Ex: 192.168.1.100 → 192.168.1.0
 * @param {string} ip - IP address
 * @returns {string} Subnet /24
 */
function getIPSubnet(ip) {
    if (!ip || ip === 'unknown') return 'unknown';
    
    // IPv4
    const ipv4Match = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/);
    if (ipv4Match) {
        return ipv4Match[1] + '.0';
    }
    
    // IPv6 - usar primeiros 4 grupos
    if (ip.includes(':')) {
        const parts = ip.split(':').slice(0, 4);
        return parts.join(':');
    }
    
    return ip;
}

/**
 * Gera demo_id único baseado em múltiplos fatores
 * 
 * FATORES:
 * 1. fingerprint (FingerprintJS) - identificador do navegador
 * 2. IP subnet /24 - rede do usuário
 * 3. User-Agent - navegador/OS
 * 4. Timezone - fuso horário
 * 5. Accept-Language - idioma
 * 
 * @param {Object} params - Parâmetros de identificação
 * @returns {string} demo_id hash
 */
export function generateDemoId(params) {
    const {
        fingerprint = 'unknown',
        ip = 'unknown',
        userAgent = 'unknown',
        timezone = 'unknown',
        language = 'unknown',
    } = params;
    
    // Usar subnet ao invés de IP exato (permite NAT dinâmico)
    const subnet = getIPSubnet(ip);
    
    // Normalizar User-Agent (remover versões específicas)
    const normalizedUA = userAgent
        .replace(/[\d.]+/g, 'X')  // Versões → X
        .substring(0, 100);       // Limitar tamanho
    
    // Concatenar fatores
    const factors = [
        fingerprint,
        subnet,
        normalizedUA,
        timezone,
        language
    ].join('|');
    
    // Gerar hash SHA256
    const hash = crypto
        .createHash('sha256')
        .update(factors)
        .digest('hex');
    
    // Retornar primeiros 32 caracteres (suficiente para unicidade)
    const demoId = hash.substring(0, 32);
    
    console.log('[DEMO-CONTROL] 🔑 Gerando demo_id:', {
        fingerprint: fingerprint.substring(0, 16) + '...',
        subnet,
        timezone,
        language,
        demoId: demoId.substring(0, 16) + '...'
    });
    
    return demoId;
}

/**
 * Extrai parâmetros de identificação do request
 * @param {Request} req - Express request
 * @returns {Object} Parâmetros para generateDemoId
 */
export function extractDemoParams(req) {
    return {
        fingerprint: req.headers['x-demo-visitor'] || req.body?.fingerprint || 'unknown',
        ip: getClientIP(req),
        userAgent: req.headers['user-agent'] || 'unknown',
        timezone: req.headers['x-timezone'] || req.body?.timezone || 'unknown',
        language: req.headers['accept-language']?.split(',')[0] || 'unknown',
    };
}

/**
 * Obtém estado do demo do Redis
 * @param {string} demoId - ID do demo
 * @returns {Promise<Object>} Estado do demo
 */
export async function getDemoState(demoId) {
    const redis = getRedisConnection();
    const key = DEMO_CONFIG.keyPrefix + demoId;
    
    try {
        const data = await redis.get(key);
        
        if (!data) {
            console.log('[DEMO-CONTROL] 📭 Demo não encontrado:', demoId.substring(0, 16) + '...');
            return {
                exists: false,
                used: false,
                analysesCount: 0,
                allowed: true
            };
        }
        
        const state = JSON.parse(data);
        console.log('[DEMO-CONTROL] 📬 Estado do demo:', {
            demoId: demoId.substring(0, 16) + '...',
            used: state.used,
            analysesCount: state.analysesCount || 0
        });
        
        return {
            exists: true,
            used: state.used || false,
            usedAt: state.usedAt,
            analysesCount: state.analysesCount || 0,
            ip: state.ip,
            allowed: !state.used && (state.analysesCount || 0) < DEMO_CONFIG.maxAnalyses
        };
    } catch (err) {
        console.error('[DEMO-CONTROL] ❌ Erro ao obter estado:', err.message);
        // Em caso de erro, permitir (fail-open para não bloquear vendas)
        return {
            exists: false,
            used: false,
            analysesCount: 0,
            allowed: true,
            error: err.message
        };
    }
}

/**
 * Marca demo como usado no Redis
 * @param {string} demoId - ID do demo
 * @param {Object} metadata - Metadados adicionais
 * @returns {Promise<boolean>} Sucesso
 */
export async function markDemoAsUsed(demoId, metadata = {}) {
    const redis = getRedisConnection();
    const key = DEMO_CONFIG.keyPrefix + demoId;
    
    try {
        // Obter estado atual
        const currentData = await redis.get(key);
        let state = currentData ? JSON.parse(currentData) : {};
        
        // Atualizar estado
        state = {
            ...state,
            used: true,
            usedAt: new Date().toISOString(),
            analysesCount: (state.analysesCount || 0) + 1,
            ip: metadata.ip || state.ip,
            userAgent: metadata.userAgent || state.userAgent,
            lastAccess: new Date().toISOString()
        };
        
        // Salvar com TTL
        await redis.setex(key, DEMO_CONFIG.blockTTL, JSON.stringify(state));
        
        console.log('[DEMO-CONTROL] ✅ Demo marcado como usado:', {
            demoId: demoId.substring(0, 16) + '...',
            analysesCount: state.analysesCount
        });
        
        return true;
    } catch (err) {
        console.error('[DEMO-CONTROL] ❌ Erro ao marcar demo:', err.message);
        return false;
    }
}

/**
 * Verifica se demo pode analisar (função principal)
 * @param {Request} req - Express request
 * @returns {Promise<Object>} { allowed, demoId, reason }
 */
export async function canDemoAnalyze(req) {
    const params = extractDemoParams(req);
    const demoId = generateDemoId(params);
    const state = await getDemoState(demoId);
    
    if (!state.allowed) {
        console.log('[DEMO-CONTROL] 🚫 Demo bloqueado:', {
            demoId: demoId.substring(0, 16) + '...',
            reason: state.used ? 'already_used' : 'limit_reached',
            analysesCount: state.analysesCount
        });
        
        return {
            allowed: false,
            demoId,
            reason: state.used ? 'already_used' : 'limit_reached',
            analysesCount: state.analysesCount,
            maxAnalyses: DEMO_CONFIG.maxAnalyses
        };
    }
    
    console.log('[DEMO-CONTROL] ✅ Demo permitido:', {
        demoId: demoId.substring(0, 16) + '...',
        analysesCount: state.analysesCount,
        remaining: DEMO_CONFIG.maxAnalyses - state.analysesCount
    });
    
    return {
        allowed: true,
        demoId,
        analysesCount: state.analysesCount,
        remaining: DEMO_CONFIG.maxAnalyses - state.analysesCount,
        maxAnalyses: DEMO_CONFIG.maxAnalyses
    };
}

/**
 * Registra uso de demo após análise bem-sucedida
 * @param {Request} req - Express request
 * @returns {Promise<Object>} Resultado do registro
 */
export async function registerDemoUsage(req) {
    const params = extractDemoParams(req);
    const demoId = generateDemoId(params);
    
    const success = await markDemoAsUsed(demoId, {
        ip: params.ip,
        userAgent: params.userAgent
    });
    
    return {
        success,
        demoId,
        blocked: success // Se registrou, agora está bloqueado
    };
}

// Exportar configuração para uso externo
export const DEMO_CONTROL_CONFIG = DEMO_CONFIG;
