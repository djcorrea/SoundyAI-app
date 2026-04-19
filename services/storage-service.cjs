/**
 * Storage Service - Backblaze B2
 * 
 * Serviço de armazenamento persistente para inputs e outputs
 * do AutoMaster V1 em produção usando Backblaze B2.
 * 
 * @module services/storage-service
 */

// 🧹 MEMORY OPT: AWS SDK v3 não é carregado no startup
// Os require de @aws-sdk foram movidos para DENTRO de getClient()
// Apenas módulos leves são carregados aqui (logger, fs, path)
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
const B2_DOWNLOAD_URL = process.env.B2_DOWNLOAD_URL;

// =============================================================================
// HELPERS DE VALIDAÇÃO
// =============================================================================

/**
 * Normaliza o endpoint B2: garante protocolo https:// e remove trailing slash.
 * Causa raiz do "Invalid URL": o AWS SDK v3 faz `new URL(endpoint)` internamente.
 * Se o endpoint não tiver protocolo (ex: "s3.us-east-005.backblazeb2.com"),
 * new URL() lança "Invalid URL". Esse helper corrige silenciosamente.
 *
 * @param {string} endpoint
 * @returns {string} endpoint normalizado
 */
function normalizeEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== 'string') return endpoint;
  const trimmed = endpoint.trim().replace(/\/+$/, ''); // remove trailing slashes
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Valida se uma string é uma URL absoluta válida.
 * @param {string} url
 * @returns {{ valid: boolean, error?: string }}
 */
function validateUrl(url) {
  try {
    new URL(url);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/**
 * Sanitiza uma storage key: remove barras iniciais e caracteres problemáticos.
 * @param {string} key
 * @returns {string}
 */
function sanitizeKey(key) {
  if (!key || typeof key !== 'string') return key;
  return key
    .replace(/^\/+/, '')        // remove barras iniciais
    .replace(/\s+/g, '_')       // substitui espaços por underscore
    .replace(/[^\w.\-/]/g, '_'); // mantém apenas alfanum, ponto, hífen, barra
}

// =============================================================================
// CLIENTE B2 (lazy — require do AWS SDK ocorre apenas aqui, na 1ª chamada real)
// =============================================================================

let _client = null;
let _S3Client, _PutObjectCommand, _GetObjectCommand, _DeleteObjectCommand, _getSignedUrl;

function getClient() {
  if (!_client) {
    // Validação de env vars adiada para o momento de uso real
    const missing = [];
    if (!B2_ENDPOINT) missing.push('B2_ENDPOINT');
    if (!B2_KEY_ID) missing.push('B2_KEY_ID');
    if (!B2_APP_KEY) missing.push('B2_APP_KEY');
    if (!B2_BUCKET_NAME) missing.push('B2_BUCKET_NAME');
    if (!B2_DOWNLOAD_URL) missing.push('B2_DOWNLOAD_URL');

    if (missing.length > 0) {
      throw new Error(`Backblaze B2 configuration missing: ${missing.join(', ')}`);
    }

    // Normalizar endpoint: garante https:// e sem trailing slash
    // FIX "Invalid URL": o AWS SDK v3 faz new URL(endpoint) internamente.
    // Se B2_ENDPOINT não tiver protocolo, lança "Invalid URL" no client.send().
    const normalizedEndpoint = normalizeEndpoint(B2_ENDPOINT);
    const endpointCheck = validateUrl(normalizedEndpoint);
    if (!endpointCheck.valid) {
      throw new Error(
        `B2_ENDPOINT inválido após normalização: "${B2_ENDPOINT}" → "${normalizedEndpoint}": ${endpointCheck.error}`
      );
    }

    // Carregar AWS SDK v3 somente aqui (lazy) — ~15-20MB economizados no idle
    if (!_S3Client) {
      const s3Pkg = require('@aws-sdk/client-s3');
      _S3Client = s3Pkg.S3Client;
      _PutObjectCommand = s3Pkg.PutObjectCommand;
      _GetObjectCommand = s3Pkg.GetObjectCommand;
      _DeleteObjectCommand = s3Pkg.DeleteObjectCommand;
      _getSignedUrl = require('@aws-sdk/s3-request-presigner').getSignedUrl;
    }

    _client = new _S3Client({
      region: 'us-east-005',
      endpoint: normalizedEndpoint,
      // CRÍTICO para Backblaze B2: o SDK usa virtual-hosted por padrão
      // (https://{bucket}.{host}/{key}), mas B2 exige path-style
      // (https://{host}/{bucket}/{key}). Sem isso, a URL construída falha.
      forcePathStyle: true,
      credentials: {
        accessKeyId: B2_KEY_ID,
        secretAccessKey: B2_APP_KEY
      }
    });

    logger.info(
      { endpoint: normalizedEndpoint, bucket: B2_BUCKET_NAME },
      'Backblaze B2 client initialized (lazy, forcePathStyle=true)'
    );
  }
  return _client;
}

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
  const safeKey = sanitizeKey(key);

  // Log estruturado ANTES do upload — visível nos logs do Railway
  const debugCtx = {
    endpoint: normalizeEndpoint(B2_ENDPOINT) || '(undefined)',
    bucket: B2_BUCKET_NAME || '(undefined)',
    key: safeKey,
    size: buffer ? buffer.length : 0,
    contentType,
  };
  console.log('[UPLOAD DEBUG]', JSON.stringify(debugCtx));
  logger.info(debugCtx, 'Starting B2 upload');

  const MAX_ATTEMPTS = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const client = getClient(); // inicializa SDK + valida endpoint
      const command = new _PutObjectCommand({
        Bucket: B2_BUCKET_NAME,
        Key: safeKey,
        Body: buffer,
        ContentType: contentType,
      });

      await client.send(command);
      logger.info({ key: safeKey, size: buffer.length, contentType, attempt }, 'File uploaded successfully');
      return safeKey;

    } catch (error) {
      lastError = error;
      logger.warn(
        { key: safeKey, endpoint: debugCtx.endpoint, bucket: debugCtx.bucket, attempt, error: error.message },
        `Upload attempt ${attempt}/${MAX_ATTEMPTS} failed`
      );
      console.error(`[UPLOAD ERROR] attempt=${attempt}/${MAX_ATTEMPTS} key="${safeKey}" endpoint="${debugCtx.endpoint}" bucket="${debugCtx.bucket}" error="${error.message}"`);

      // Não retentar em caso de erros permanentes (configuração inválida)
      const isPermanent = (
        error.message.includes('Invalid URL') ||
        error.message.includes('configuration missing') ||
        error.message.includes('credentials') ||
        error.message.includes('B2_ENDPOINT inválido')
      );
      if (isPermanent) {
        logger.error(
          { key: safeKey, endpoint: debugCtx.endpoint, error: error.message },
          'Upload falhou com erro permanente — sem retry'
        );
        break; // sai do loop, vai para o throw abaixo
      }

      // Backoff exponencial: 1s, 2s (não espera na última tentativa)
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  }

  // Todas as tentativas falharam — lançar erro detalhado
  throw new Error(
    `B2 upload failed após ${MAX_ATTEMPTS} tentativas` +
    ` [endpoint="${debugCtx.endpoint}" bucket="${debugCtx.bucket}" key="${safeKey}"]: ` +
    lastError.message
  );
}

/**
 * Download de arquivo do B2
 * 
 * @param {string} key - Chave do objeto
 * @returns {Promise<Buffer>} Conteúdo do arquivo
 */
async function downloadFile(key) {
  const baseUrl = B2_DOWNLOAD_URL.replace(/\/$/, '');
  const url = `${baseUrl}/file/${B2_BUCKET_NAME}/${key}`;

  console.log('[B2 URL]', url);
  console.log('[INPUT KEY]', key);

  if (!url || !url.startsWith('http')) {
    throw new Error(`Invalid B2 URL: ${url}`);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    logger.info({ key, size: buffer.length }, 'File downloaded');
    return buffer;
  } catch (error) {
    logger.error({ key, error: error.message }, 'Download failed');
    throw new Error(`B2 download failed: ${error.message}`);
  }
}

/**
 * Abre stream de leitura direto do B2 sem bufferizar em memória.
 * Use para proxy de download — elimina o problema de timeout em arquivos grandes.
 *
 * @param {string} key - Chave do objeto
 * @returns {Promise<{ stream: import('stream').Readable, contentLength: number|null }>}
 */
async function getFileStream(key) {
  try {
    const client = getClient(); // garante que _GetObjectCommand está carregado
    const command = new _GetObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: key
    });
    const response = await client.send(command);
    logger.info({ key, contentLength: response.ContentLength }, 'File stream opened');
    return {
      stream: response.Body,            // Node.js Readable — suporta .pipe()
      contentLength: response.ContentLength || null,
    };
  } catch (error) {
    logger.error({ key, error: error.message }, 'Stream open failed');
    throw new Error(`B2 stream failed: ${error.message}`);
  }
}

/**
 * Gera URL assinada para download
 *
 * @param {string} key             - Chave do objeto
 * @param {number} expiresInSeconds - Tempo de expiração em segundos (padrão 300 = 5min)
 * @param {string|null} filename    - Se informado, inclui ResponseContentDisposition:attachment
 *                                    no pré-signed URL para forçar download no browser.
 *                                    Não usar para URLs de preview (previewBefore/After).
 * @returns {Promise<string>} URL assinada
 */
async function generateSignedUrl(key, expiresInSeconds = 300, filename = null) {
  try {
    const commandParams = {
      Bucket: B2_BUCKET_NAME,
      Key: key,
    };

    // Quando filename é fornecido, o B2 retorna Content-Disposition: attachment
    // no response — o browser baixa o arquivo em vez de reproduzir inline.
    if (filename) {
      // Sanitizar: apenas caracteres seguros para header HTTP
      const safe = filename.replace(/[^\w.\-]/g, '_');
      commandParams.ResponseContentDisposition = `attachment; filename="${safe}"`;
    }

    const command = new _GetObjectCommand(commandParams);
    const url = await _getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
    logger.info({ key, expiresIn: expiresInSeconds, hasFilename: !!filename }, 'Signed URL generated');
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
    const client = getClient(); // garante que _DeleteObjectCommand está carregado
    const command = new _DeleteObjectCommand({
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

  // Ler arquivo local — falha aqui indica problema no pipeline, não no storage
  let buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch (readError) {
    throw new Error(`uploadOutput: falha ao ler arquivo local "${filePath}": ${readError.message}`);
  }

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
  getFileStream,
  generateSignedUrl,
  deleteFile,
  
  // API antiga (compatibilidade)
  uploadInput,
  uploadOutput,
  downloadToFile,
  getSignedDownloadUrl,
  deleteObject
};
