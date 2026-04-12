/**
 * Storage Service - Backblaze B2
 * 
 * Serviço de armazenamento persistente para inputs e outputs
 * do AutoMaster V1 em produção usando Backblaze B2.
 * 
 * @module services/storage-service
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { createServiceLogger } = require('./logger.cjs');
const fs = require('fs').promises;
const path = require('path');

// =============================================================================
// LOGGER
// =============================================================================

const logger = createServiceLogger('StorageService');

// =============================================================================
// CONFIGURAÇÃO
// =============================================================================

const B2_ENDPOINT = process.env.B2_ENDPOINT;
const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APP_KEY = process.env.B2_APP_KEY;
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME;

// Validação no boot
if (!B2_ENDPOINT || !B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET_NAME) {
  const missing = [];
  if (!B2_ENDPOINT) missing.push('B2_ENDPOINT');
  if (!B2_KEY_ID) missing.push('B2_KEY_ID');
  if (!B2_APP_KEY) missing.push('B2_APP_KEY');
  if (!B2_BUCKET_NAME) missing.push('B2_BUCKET_NAME');
  
  throw new Error(`Backblaze B2 configuration missing: ${missing.join(', ')}`);
}

// =============================================================================
// CLIENTE B2
// =============================================================================

const client = new S3Client({
  region: 'us-east-005',
  endpoint: B2_ENDPOINT,
  credentials: {
    accessKeyId: B2_KEY_ID,
    secretAccessKey: B2_APP_KEY
  }
});

logger.info({ endpoint: B2_ENDPOINT, bucket: B2_BUCKET_NAME }, 'Backblaze B2 client initialized');

// =============================================================================
// FUNÇÕES PÚBLICAS
// =============================================================================

/**
 * Upload de arquivo para B2
 * 
 * @param {string} key - Chave do objeto (path completo: input/jobId.wav)
 * @param {Buffer} buffer - Conteúdo do arquivo
 * @param {string} contentType - MIME type (default: audio/wav)
 * @returns {Promise<string>} Key do objeto no storage
 */
async function uploadFile(key, buffer, contentType = 'audio/wav') {
  try {
    const command = new PutObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType
    });

    await client.send(command);
    logger.info({ key, size: buffer.length, contentType }, 'File uploaded');
    return key;
  } catch (error) {
    logger.error({ key, error: error.message }, 'Upload failed');
    throw new Error(`B2 upload failed: ${error.message}`);
  }
}

/**
 * Download de arquivo do B2
 * 
 * @param {string} key - Chave do objeto
 * @returns {Promise<Buffer>} Conteúdo do arquivo
 */
async function downloadFile(key) {
  try {
    const command = new GetObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: key
    });

    const response = await client.send(command);
    const stream = response.Body;
    
    // Converter stream para buffer
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    logger.info({ key, size: buffer.length }, 'File downloaded');
    return buffer;
  } catch (error) {
    logger.error({ key, error: error.message }, 'Download failed');
    throw new Error(`B2 download failed: ${error.message}`);
  }
}

/**
 * Gera URL assinada para download
 * 
 * @param {string} key - Chave do objeto
 * @param {number} expiresInSeconds - Tempo de expiração em segundos (padrão 300 = 5min)
 * @returns {Promise<string>} URL assinada
 */
async function generateSignedUrl(key, expiresInSeconds = 300) {
  try {
    const command = new GetObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: key
    });

    const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    logger.info({ key, expiresIn: expiresInSeconds }, 'Signed URL generated');
    return url;
  } catch (error) {
    logger.error({ key, error: error.message }, 'Signed URL generation failed');
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
}

/**
 * Deleta arquivo do B2
 * 
 * @param {string} key - Chave do objeto
 * @returns {Promise<void>}
 */
async function deleteFile(key) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: key
    });

    await client.send(command);
    logger.info({ key }, 'File deleted');
  } catch (error) {
    logger.warn({ key, error: error.message }, 'Delete failed (best-effort)');
    // Não lançar erro - deleção é best-effort
  }
}

// =============================================================================
// FUNÇÕES DE COMPATIBILIDADE (API ANTIGA)
// =============================================================================

/**
 * Upload de arquivo input (compatibilidade)
 * 
 * @param {Buffer} fileBuffer - Conteúdo do arquivo
 * @param {string} jobId - ID do job
 * @returns {Promise<string>} Key do objeto no storage
 */
async function uploadInput(fileBuffer, jobId) {
  const key = `input/${jobId}.wav`;
  return uploadFile(key, fileBuffer, 'audio/wav');
}

/**
 * Upload de arquivo output (compatibilidade)
 * 
 * @param {string} filePath - Caminho local do arquivo masterizado
 * @param {string} jobId - ID do job
 * @returns {Promise<string>} Key do objeto no storage
 */
async function uploadOutput(filePath, jobId) {
  const key = `output/${jobId}_master.wav`;
  const buffer = await fs.readFile(filePath);
  return uploadFile(key, buffer, 'audio/wav');
}

/**
 * Download de arquivo para path local (compatibilidade)
 * 
 * @param {string} key - Chave do objeto
 * @param {string} destinationPath - Caminho local de destino
 * @returns {Promise<void>}
 */
async function downloadToFile(key, destinationPath) {
  const buffer = await downloadFile(key);
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.writeFile(destinationPath, buffer);
  logger.info({ key, destinationPath }, 'File downloaded to disk');
}

/**
 * Gera URL assinada para download de output (compatibilidade)
 * 
 * @param {string} jobId - ID do job
 * @param {number} expiresIn - Tempo de expiração em segundos (padrão 300 = 5min)
 * @returns {Promise<string>} URL assinada
 */
async function getSignedDownloadUrl(jobId, expiresIn = 300) {
  const key = `output/${jobId}_master.wav`;
  return generateSignedUrl(key, expiresIn);
}

/**
 * Deleta objeto do storage (compatibilidade)
 * 
 * @param {string} key - Chave do objeto
 * @returns {Promise<void>}
 */
async function deleteObject(key) {
  return deleteFile(key);
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // API nova (B2 nativo)
  uploadFile,
  downloadFile,
  generateSignedUrl,
  deleteFile,
  
  // API antiga (compatibilidade)
  uploadInput,
  uploadOutput,
  downloadToFile,
  getSignedDownloadUrl,
  deleteObject
};
