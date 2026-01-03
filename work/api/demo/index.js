/**
 * 🔥 API ENDPOINT: /api/demo/can-analyze
 * 
 * Verifica se visitante pode usar demo (controle 100% backend)
 * 
 * @method POST
 * @body { fingerprint?: string, timezone?: string }
 * @headers x-demo-visitor, x-timezone, user-agent, accept-language
 * @returns { allowed: boolean, remaining: number, demoId: string }
 */

import express from 'express';
import { canDemoAnalyze, DEMO_CONTROL_CONFIG } from '../../../lib/demo-control.js';

const router = express.Router();

/**
 * POST /api/demo/can-analyze
 * Verifica se demo pode fazer análise
 */
router.post('/can-analyze', async (req, res) => {
    console.log('[DEMO-API] 📥 POST /api/demo/can-analyze');
    
    try {
        const result = await canDemoAnalyze(req);
        
        if (result.allowed) {
            console.log('[DEMO-API] ✅ Demo permitido');
            return res.json({
                success: true,
                allowed: true,
                remaining: result.remaining,
                maxAnalyses: result.maxAnalyses,
                demoId: result.demoId // Retornar para frontend rastrear
            });
        }
        
        console.log('[DEMO-API] 🚫 Demo bloqueado:', result.reason);
        return res.status(403).json({
            success: false,
            allowed: false,
            error: 'DEMO_LIMIT_REACHED',
            reason: result.reason,
            message: result.reason === 'already_used' 
                ? 'Você já utilizou sua análise demonstrativa gratuita.'
                : 'Limite de análises demo atingido.',
            analysesCount: result.analysesCount,
            maxAnalyses: result.maxAnalyses
        });
        
    } catch (error) {
        console.error('[DEMO-API] ❌ Erro:', error);
        
        // Fail-open: em caso de erro, permitir (não perder venda)
        return res.json({
            success: true,
            allowed: true,
            remaining: 1,
            maxAnalyses: DEMO_CONTROL_CONFIG.maxAnalyses,
            warning: 'Fallback mode - error checking limits'
        });
    }
});

/**
 * GET /api/demo/status
 * Endpoint de diagnóstico
 */
router.get('/status', async (req, res) => {
    console.log('[DEMO-API] 📥 GET /api/demo/status');
    
    try {
        const result = await canDemoAnalyze(req);
        
        res.json({
            success: true,
            status: 'ok',
            config: {
                maxAnalyses: DEMO_CONTROL_CONFIG.maxAnalyses,
                blockTTL: DEMO_CONTROL_CONFIG.blockTTL
            },
            currentState: {
                demoId: result.demoId?.substring(0, 16) + '...',
                allowed: result.allowed,
                analysesCount: result.analysesCount,
                remaining: result.remaining
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[DEMO-API] ❌ Erro status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
