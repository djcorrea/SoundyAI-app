require('dotenv').config();
/**
 * ============================================================================
 * EXPRESS API SERVER
 * ============================================================================
 * 
 * Servidor Express para AutoMaster SaaS.
 * Integra rotas de upload e status com rate limiting.
 * 
 * Autor: SoundyAI Engineering
 * Data: 2026-02-11
 * Versão: 2.0.0 (Production-Ready)
 * 
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const uploadRoute = require('./upload-route.cjs');
const jobStatusRoute = require('./job-status-route.cjs');
const { createServiceLogger } = require('../services/logger.cjs');

const app = express();
const PORT = process.env.PORT || 3000;
const logger = createServiceLogger('api-server');

// ============================================================================
// MIDDLEWARES
// ============================================================================

app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.ip
    }, 'Request completado');
  });
  
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'automaster-api',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// ROUTES
// ============================================================================

app.use('/', uploadRoute);
app.use('/', jobStatusRoute);

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint não encontrado'
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error({ error: err.message, stack: err.stack }, 'Erro no servidor');

  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API Server iniciado');
});

module.exports = app;
