/**
 * Patch de Emergência - Resolver "Unexpected end of JSON input"
 * 
 * Este patch substitui a função de upload problemática por uma versão
 * mais robusta que trata adequadamente respostas vazias e inválidas.
 */

// Função robusta de upload que não falha com JSON inválido
async function uploadFileToAPISafe(file) {
    log('🔧 [PATCH] Iniciando upload seguro...', {
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        type: file.type
    });
    
    try {
        const formData = new FormData();
        formData.append('audio', file);
        
        log('📤 [PATCH] Enviando requisição...');
        
        const response = await fetch('/api/upload-audio', {
            method: 'POST',
            body: formData,
            headers: {
                // Não definir Content-Type - deixar o browser definir
                'X-Requested-With': 'XMLHttpRequest' // Header para identificar AJAX
            }
        });
        
        log('📥 [PATCH] Resposta recebida:', {
            status: response.status,
            statusText: response.statusText,
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length')
        });
        
        // Ler resposta como texto primeiro
        const responseText = await response.text();
        log('📄 [PATCH] Texto da resposta:', {
            length: responseText.length,
            preview: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''),
            isEmpty: !responseText.trim()
        });
        
        // Verificar se a resposta está vazia
        if (!responseText.trim()) {
            throw new Error('Servidor retornou resposta vazia. Verifique se o servidor está funcionando corretamente.');
        }
        
        // Tentar parsear JSON
        let result;
        try {
            result = JSON.parse(responseText);
            log('✅ [PATCH] JSON parseado com sucesso:', result);
        } catch (jsonError) {
            error('❌ [PATCH] Erro ao parsear JSON:', jsonError);
            error('📄 [PATCH] Conteúdo que causou erro:', responseText);
            
            // Se não conseguir parsear JSON, tentar extrair informação útil
            if (responseText.includes('404') || responseText.includes('Not Found')) {
                throw new Error('API de upload não encontrada. Verifique se o servidor está rodando com suporte a APIs.');
            } else if (responseText.includes('500') || responseText.includes('Internal Server Error')) {
                throw new Error('Erro interno do servidor. Verifique os logs do servidor.');
            } else if (responseText.includes('<html>') || responseText.includes('<HTML>')) {
                throw new Error('Servidor retornou página HTML ao invés de JSON. Verifique a configuração da API.');
            } else {
                throw new Error(`Resposta inválida do servidor: ${responseText.substring(0, 100)}...`);
            }
        }
        
        // Verificar status da resposta
        if (!response.ok) {
            warn('⚠️ [PATCH] Resposta não-OK:', response.status);
            
            // Tratar diferentes tipos de erro com base no JSON
            if (result.error === 'ARQUIVO_MUITO_GRANDE') {
                throw new Error(`Arquivo muito grande: ${(file.size / 1024 / 1024).toFixed(1)}MB. Limite máximo: ${result.maxSizeMB || 60}MB. ${result.recommendation || ''}`);
            } else if (result.error === 'FORMATO_NAO_SUPORTADO') {
                throw new Error(`Formato não suportado: ${result.receivedType || file.type}. Formatos aceitos: ${result.supportedFormats?.join(', ') || 'WAV, FLAC, MP3'}. ${result.recommendation || ''}`);
            } else {
                throw new Error(result.message || `Erro do servidor: ${response.status} ${response.statusText}`);
            }
        }
        
        // Verificar se a resposta contém dados válidos
        if (!result || typeof result !== 'object') {
            throw new Error('Resposta do servidor não contém dados válidos');
        }
        
        // Log da recomendação se houver
        if (result.recommendation) {
            log('💡 [PATCH] Recomendação:', result.recommendation);
        }
        
        log('✅ [PATCH] Upload concluído com sucesso');
        return result;
        
    } catch (error) {
        error('❌ [PATCH] Erro no upload:', error);
        
        // Re-throw com informação adicional
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            throw new Error('Não foi possível conectar com o servidor. Verifique se o servidor está rodando na porta 3000.');
        } else if (error.name === 'AbortError') {
            throw new Error('Upload cancelado ou timeout. Tente novamente.');
        } else {
            // Manter a mensagem original do erro
            throw error;
        }
    }
}

// Substituir a função original de upload no escopo global
if (typeof window !== 'undefined') {
    window.uploadFileToAPI = uploadFileToAPISafe;
    log('🔧 [PATCH] Função de upload substituída pela versão segura');
} else {
    // Se não estiver no browser, exportar para Node.js
    module.exports = { uploadFileToAPISafe };
}

log('✅ [PATCH] Patch de emergência carregado - Upload robusto ativo');
