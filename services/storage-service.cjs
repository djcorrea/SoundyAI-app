// [AUDIT] Confirmar qual arquivo storage-service está sendo carregado em runtime
console.log('[STORAGE FILE LOADED]', __filename);

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
// NOTA: as variáveis B2_* são lidas DIRETAMENTE de process.env no momento de uso,
// dentro de getClient() e de cada função. NÃO são cacheadas aqui.
// Isso garante que o valor correto seja usado mesmo em processos filhos (spawn/fork).

// =============================================================================
// CLIENTE B2 (lazy — require do AWS SDK ocorre apenas aqui, na 1ª chamada real)
// =============================================================================

let _client = null;
let _S3Client, _PutObjectCommand, _GetObjectCommand, _DeleteObjectCommand, _getSignedUrl;

function getClient() {
  if (!_client) {
    // Ler env vars AGORA (não das constantes de módulo) para diagnóstico preciso em runtime
    const endpoint   = process.env.B2_ENDPOINT;
    const keyId      = process.env.B2_KEY_ID;
    const appKey     = process.env.B2_APP_KEY;
    const bucketName = process.env.B2_BUCKET_NAME;
    const downloadUrl = process.env.B2_DOWNLOAD_URL;

    // Log diagnóstico — expõe o que realmente está disponível no processo filho
    console.log('[STORAGE AUDIT] getClient() iniciando', {
      B2_ENDPOINT:      endpoint      || '(undefined)',
      B2_BUCKET_NAME:   bucketName    || '(undefined)',
      B2_KEY_ID:        keyId         ? '(set)' : '(undefined)',
      B2_APP_KEY:       appKey        ? '(set)' : '(undefined)',
      B2_DOWNLOAD_URL:  downloadUrl   || '(undefined)',
    });

    // 1. Validação de presença
    const missing = [];
    if (!endpoint)    missing.push('B2_ENDPOINT');
    if (!keyId)       missing.push('B2_KEY_ID');
    if (!appKey)      missing.push('B2_APP_KEY');
    if (!bucketName)  missing.push('B2_BUCKET_NAME');
    if (!downloadUrl) missing.push('B2_DOWNLOAD_URL');

    if (missing.length > 0) {
      throw new Error(`Backblaze B2 configuration missing: ${missing.join(', ')}`);
    }

    // 2. Validação de formato — garante que não chegue URL inválida ao SDK
    if (!endpoint.startsWith('http')) {
      throw new Error(
        `B2_ENDPOINT inválido: "${endpoint}" — deve começar com http:// ou https://`
      );
    }

    // 3. Carregar AWS SDK v3 somente aqui (lazy) — ~15-20MB economizados no idle
    if (!_S3Client) {
      const s3Pkg = require('@aws-sdk/client-s3');
      _S3Client = s3Pkg.S3Client;
      _PutObjectCommand = s3Pkg.PutObjectCommand;
      _GetObjectCommand = s3Pkg.GetObjectCommand;
      _DeleteObjectCommand = s3Pkg.DeleteObjectCommand;
      _getSignedUrl = require('@aws-sdk/s3-request-presigner').getSignedUrl;
    }

    // 4. Criar client com valores lidos agora (não constantes de módulo)
    _client = new _S3Client({
      region: 'us-east-005',
      endpoint: endpoint,
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: appKey
      }
    });

    logger.info({ endpoint, bucket: bucketName }, 'Backblaze B2 client initialized (lazy)');
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
  console.log('[UPLOAD FUNCTION EXECUTING]', { key, contentType, bufferSize: buffer?.length ?? 'null' });
  // Logging diagnóstico completo — expõe EXATAMENTE o que está disponível
  console.log('[STORAGE AUDIT] uploadFile()', {
    B2_ENDPOINT:    process.env.B2_ENDPOINT    || '(undefined)',
    B2_BUCKET_NAME: process.env.B2_BUCKET_NAME || '(undefined)',
    B2_KEY_ID:      process.env.B2_KEY_ID      ? '(set)' : '(undefined)',
    B2_APP_KEY:     process.env.B2_APP_KEY     ? '(set)' : '(undefined)',
    key,
    bufferSize:     buffer?.length ?? 'null',
  });

  try {
    const client = getClient(); // garante que _PutObjectCommand está carregado e validado
    const bucket = process.env.B2_BUCKET_NAME; // leitura fresca, idêntica ao que getClient() usou
    const command = new _PutObjectCommand({
      Bucket: bucket,
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
  const baseUrl = (process.env.B2_DOWNLOAD_URL || '').replace(/\/$/, '');
  const bucket  = process.env.B2_BUCKET_NAME || '';
  const url = `${baseUrl}/file/${bucket}/${key}`;

  console.log('[B2 URL]', url);
  console.log('[INPUT KEY]', key);

  if (!url || !url.startsWith('http')) {
    throw new Error(`Invalid B2 URL: "${url}" — verifique B2_DOWNLOAD_URL e B2_BUCKET_NAME`);
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
      Bucket: process.env.B2_BUCKET_NAME,
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
      Bucket: process.env.B2_BUCKET_NAME,
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
      Bucket: process.env.B2_BUCKET_NAME,
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
