/**
 * Upload API para arquivos de áudio
 * Suporta WAV, FLAC, MP3 até 60MB
 * Configurado para runtime Node.js
 * 
 * Implementação: 18 de agosto de 2025
 */

import { createWriteStream, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Configuração via variável de ambiente (padrão: 60MB)
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '60');
const MAX_UPLOAD_SIZE = MAX_UPLOAD_MB * 1024 * 1024; // Converte para bytes

// Formatos aceitos
const ALLOWED_FORMATS = ['audio/wav', 'audio/flac', 'audio/mpeg', 'audio/mp3'];
const ALLOWED_EXTENSIONS = ['.wav', '.flac', '.mp3'];

// Configuração de CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

/**
 * Valida o tipo de arquivo
 */
function validateFileType(contentType, filename) {
  // Verifica MIME type
  if (ALLOWED_FORMATS.includes(contentType)) {
    return true;
  }
  
  // Fallback: verifica extensão
  if (filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return ALLOWED_EXTENSIONS.includes(ext);
  }
  
  return false;
}

/**
 * Parse multipart/form-data manual (para controle total do tamanho)
 */
function parseMultipartData(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    
    console.log(`[UPLOAD] Content-Type recebido: "${contentType}"`);
    
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      console.log(`[UPLOAD] Erro: Content-Type inválido`);
      reject(new Error(`Content-Type deve ser multipart/form-data, recebido: ${contentType}`));
      return;
    }
    
    // Extrair boundary
    const boundaryMatch = contentType.match(/boundary=([^;]+)/);
    if (!boundaryMatch) {
      console.log(`[UPLOAD] Erro: Boundary não encontrado no Content-Type`);
      reject(new Error('Boundary não encontrado no Content-Type'));
      return;
    }
    
    const boundary = boundaryMatch[1].replace(/"/g, ''); // Remove aspas se houver
    console.log(`[UPLOAD] Boundary extraído: "${boundary}"`);
    
    let data = Buffer.alloc(0);
    let totalSize = 0;
    
    req.on('data', chunk => {
      totalSize += chunk.length;
      
      // Verificar limite de tamanho em tempo real
      if (totalSize > MAX_UPLOAD_SIZE) {
        reject(new Error(`LIMITE_EXCEDIDO:${MAX_UPLOAD_MB}`));
        return;
      }
      
      data = Buffer.concat([data, chunk]);
    });
    
    req.on('end', () => {
      try {
        // Parse manual do multipart
        const boundaryBuffer = Buffer.from(`--${boundary}`);
        const parts = [];
        let start = 0;
        
        while (true) {
          const boundaryIndex = data.indexOf(boundaryBuffer, start);
          if (boundaryIndex === -1) break;
          
          if (start > 0) {
            const part = data.slice(start, boundaryIndex);
            if (part.length > 4) {
              parts.push(part);
            }
          }
          
          start = boundaryIndex + boundaryBuffer.length;
        }
        
        // Processar cada parte
        const files = [];
        
        for (const part of parts) {
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd === -1) continue;
          
          const headers = part.slice(0, headerEnd).toString();
          const content = part.slice(headerEnd + 4, part.length - 2); // Remove \r\n final
          
          // Parse Content-Disposition
          const dispositionMatch = headers.match(/Content-Disposition: form-data; name="([^"]+)"(?:; filename="([^"]+)")?/);
          if (!dispositionMatch) continue;
          
          const fieldName = dispositionMatch[1];
          const filename = dispositionMatch[2];
          
          if (filename) {
            // É um arquivo
            const contentTypeMatch = headers.match(/Content-Type: ([^\r\n]+)/);
            const contentType = contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream';
            
            files.push({
              fieldName,
              filename,
              contentType,
              content,
              size: content.length
            });
          }
        }
        
        resolve({ files, totalSize });
      } catch (error) {
        reject(error);
      }
    });
    
    req.on('error', reject);
  });
}

/**
 * Gera mensagem de erro amigável
 */
function getErrorMessage(error) {
  if (error.message.startsWith('LIMITE_EXCEDIDO:')) {
    const maxSize = error.message.split(':')[1];
    return {
      error: 'ARQUIVO_MUITO_GRANDE',
      message: `Arquivo excede o limite de ${maxSize}MB`,
      recommendation: 'Reduza o tamanho do arquivo ou use compressão sem perda de qualidade',
      maxSizeMB: parseInt(maxSize)
    };
  }
  
  return {
    error: 'ERRO_UPLOAD',
    message: error.message || 'Erro interno no upload'
  };
}

/**
 * Handler principal da API
 */
export default async function handler(req, res) {
  // Configurar CORS
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  // Responder OPTIONS para preflight CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Apenas POST é aceito
  if (req.method !== 'POST') {
    res.status(405).json({
      error: 'METODO_NAO_PERMITIDO',
      message: 'Apenas POST é aceito',
      allowedMethods: ['POST']
    });
    return;
  }
  
  try {
    console.log(`[UPLOAD] Iniciando upload - Content-Length: ${req.headers['content-length']} bytes`);
    console.log(`[UPLOAD] Method: ${req.method}, Content-Type: ${req.headers['content-type']}`);
    
    // Parse dos dados multipart
    const { files, totalSize } = await parseMultipartData(req);
    
    console.log(`[UPLOAD] Dados recebidos - Total: ${totalSize} bytes, Arquivos: ${files.length}`);
    
    if (files.length === 0) {
      res.status(400).json({
        error: 'NENHUM_ARQUIVO',
        message: 'Nenhum arquivo foi enviado'
      });
      return;
    }
    
    const audioFile = files[0]; // Primeiro arquivo
    
    // Validar tipo de arquivo
    if (!validateFileType(audioFile.contentType, audioFile.filename)) {
      res.status(400).json({
        error: 'FORMATO_NAO_SUPORTADO',
        message: 'Formato de arquivo não suportado',
        supportedFormats: ['WAV', 'FLAC', 'MP3'],
        receivedType: audioFile.contentType,
        recommendation: 'Prefira WAV ou FLAC para maior precisão na análise. MP3 é aceito para teste rápido.'
      });
      return;
    }
    
    // Log detalhado do arquivo
    console.log(`[UPLOAD] Arquivo válido:`, {
      filename: audioFile.filename,
      contentType: audioFile.contentType,
      size: audioFile.size,
      sizeFormatted: `${(audioFile.size / 1024 / 1024).toFixed(2)}MB`
    });
    
    // Resposta de sucesso com informações do arquivo
    res.status(200).json({
      success: true,
      message: 'Upload realizado com sucesso',
      file: {
        name: audioFile.filename,
        type: audioFile.contentType,
        size: audioFile.size,
        sizeFormatted: `${(audioFile.size / 1024 / 1024).toFixed(2)}MB`
      },
      limits: {
        maxSizeMB: MAX_UPLOAD_MB,
        supportedFormats: ['WAV', 'FLAC', 'MP3']
      },
      recommendation: audioFile.contentType === 'audio/mpeg' || audioFile.contentType === 'audio/mp3' 
        ? 'MP3 detectado. Para maior precisão na análise, considere usar WAV ou FLAC.'
        : 'Formato ideal para análise de alta precisão.',
      // Buffer do arquivo para processamento (base64)
      audioData: audioFile.content.toString('base64'),
      metadata: {
        uploadTime: new Date().toISOString(),
        processingReady: true
      }
    });
    
    console.log(`[UPLOAD] Upload concluído com sucesso - ${audioFile.filename}`);
    
  } catch (error) {
    console.error('[UPLOAD] Erro no upload:', error);
    console.error('[UPLOAD] Stack:', error.stack);
    
    const errorResponse = getErrorMessage(error);
    const statusCode = error.message.startsWith('LIMITE_EXCEDIDO:') ? 413 : 400;
    
    console.log(`[UPLOAD] Enviando resposta de erro: ${statusCode}`, errorResponse);
    
    res.status(statusCode).json(errorResponse);
  }
}

// Configuração do runtime para Node.js (não Edge)
export const config = {
  runtime: 'nodejs',
  api: {
    bodyParser: false, // Desabilita parser padrão para controle manual
    responseLimit: false // Remove limite de resposta (para arquivos grandes)
  }
};
