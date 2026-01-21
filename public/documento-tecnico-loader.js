// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

// 📘 DOCUMENTO TÉCNICO - LOADER MARKDOWN

document.addEventListener('DOMContentLoaded', async function() {
    log('📘 [DOCLOADER] Iniciando carregamento do documento técnico...');
    
    const docContent = document.getElementById('docContent');
    
    if (!docContent) {
        error('❌ [DOCLOADER] Container #docContent não encontrado no DOM');
        return;
    }

    try {
        // 🔧 Path absoluto para funcionar em produção (Railway) e localhost
        const docPath = '/DOCUMENTO_TECNICO_USO_PLATAFORMA.md';
        log(`📂 [DOCLOADER] Buscando arquivo: ${docPath}`);
        
        // Carregar o arquivo Markdown
        const response = await fetch(docPath);
        
        if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
        }
        
        const markdown = await response.text();
        log(`✅ [DOCLOADER] Documento carregado (${markdown.length} caracteres)`);
        
        // Converter Markdown para HTML
        const html = convertMarkdownToHTML(markdown);
        docContent.innerHTML = html;
        
        // Highlight de seção ativa
        setupScrollSpy();
        
        log('✅ [DOCLOADER] Documento renderizado com sucesso');
        
    } catch (error) {
        error('❌ [DOCLOADER] Erro fatal ao carregar documento:', error);
        error('   Stack:', error.stack);
        
        docContent.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #ff6b6b; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #ff6b6b; margin-bottom: 20px;">⚠️ Erro ao Carregar Documento</h2>
                <p style="font-size: 1.1rem; color: #e0e6ed; margin-bottom: 30px;">
                    Não foi possível carregar o conteúdo técnico no momento.
                </p>
                <div style="background: rgba(255, 107, 107, 0.1); padding: 20px; border-radius: 10px; margin-bottom: 30px;">
                    <p style="font-size: 0.9rem; color: #a0aec0; margin: 0;">
                        <strong>Detalhes técnicos:</strong><br/>
                        ${error.message}
                    </p>
                </div>
                <button onclick="location.reload()" style="
                    background: linear-gradient(135deg, #5d1586 0%, #7b2cbf 100%);
                    color: white;
                    border: none;
                    padding: 12px 30px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 1rem;
                    font-weight: 600;
                ">
                    🔄 Recarregar Página
                </button>
                <p style="font-size: 0.85rem; color: #718096; margin-top: 30px;">
                    Se o problema persistir, entre em contato com o suporte.
                </p>
            </div>
        `;
    }
});

/**
 * Converter Markdown para HTML
 * 
 * FIX 2026-01-05: Corrigido bug onde <ol> era fechado com </ul>
 * Causa: variável inList era boolean, não rastreava tipo da lista
 * Resultado do bug: HTML inválido causava nesting errado e deslocamento progressivo
 */
function convertMarkdownToHTML(markdown) {
    // Separar por linhas
    const lines = markdown.split('\n');
    const result = [];
    // FIX: Agora armazena o TIPO da lista ('ul', 'ol') ou false se não estiver em lista
    let listType = false;
    let inCodeBlock = false;
    let codeBlockContent = [];
    
    // Helper para fechar lista corretamente
    function closeList() {
        if (listType) {
            result.push(`</${listType}>`);
            listType = false;
        }
    }
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Code blocks
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                // Fechar code block
                result.push(`<pre><code>${codeBlockContent.join('\n')}</code></pre>`);
                codeBlockContent = [];
                inCodeBlock = false;
            } else {
                // Abrir code block
                inCodeBlock = true;
            }
            continue;
        }
        
        if (inCodeBlock) {
            codeBlockContent.push(escapeHtml(line));
            continue;
        }
        
        // Headers
        if (line.startsWith('# ')) {
            closeList();
            result.push(`<h1>${line.substring(2)}</h1>`);
            continue;
        }
        
        if (line.startsWith('## ')) {
            closeList();
            const text = line.substring(3);
            const id = createSlug(text);
            result.push(`<h2 id="${id}">${text}</h2>`);
            continue;
        }
        
        if (line.startsWith('### ')) {
            closeList();
            result.push(`<h3>${line.substring(4)}</h3>`);
            continue;
        }
        
        if (line.startsWith('#### ')) {
            closeList();
            result.push(`<h4>${line.substring(5)}</h4>`);
            continue;
        }
        
        // Listas não ordenadas (- ou *)
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            // Se estava em outro tipo de lista, fechar primeiro
            if (listType && listType !== 'ul') {
                closeList();
            }
            if (!listType) {
                result.push('<ul>');
                listType = 'ul';
            }
            result.push(`<li>${processInlineMarkdown(line.trim().substring(2))}</li>`);
            continue;
        }
        
        // Listas ordenadas (1. 2. 3. etc)
        if (line.match(/^\d+\.\s/)) {
            // Se estava em outro tipo de lista, fechar primeiro
            if (listType && listType !== 'ol') {
                closeList();
            }
            if (!listType) {
                result.push('<ol>');
                listType = 'ol';
            }
            result.push(`<li>${processInlineMarkdown(line.replace(/^\d+\.\s/, ''))}</li>`);
            continue;
        }
        
        // Fechar lista se linha em branco
        if (listType && line.trim() === '') {
            closeList();
            continue;
        }
        
        // Linha horizontal
        if (line.trim() === '---') {
            closeList();
            result.push('<hr>');
            continue;
        }
        
        // Parágrafos
        if (line.trim() !== '') {
            closeList();
            result.push(`<p>${processInlineMarkdown(line)}</p>`);
        }
    }
    
    // Fechar lista se ainda aberta
    closeList();
    
    return result.join('\n');
}

/**
 * Processar markdown inline (bold, italic, code, links)
 */
function processInlineMarkdown(text) {
    // Code inline
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    return text;
}

/**
 * Criar slug para IDs
 */
function createSlug(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Escapar HTML
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Highlight da seção ativa no índice baseado no scroll
 */
function setupScrollSpy() {
    const tocLinks = document.querySelectorAll('.doc-toc a');
    const sections = document.querySelectorAll('.doc-content h2');
    
    if (tocLinks.length === 0 || sections.length === 0) return;
    
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    
                    // Remove classe active de todos
                    tocLinks.forEach(link => link.classList.remove('active'));
                    
                    // Adiciona classe active ao link correspondente
                    const activeLink = document.querySelector(`.doc-toc a[href="#${id}"]`);
                    if (activeLink) {
                        activeLink.classList.add('active');
                    }
                }
            });
        },
        {
            rootMargin: '-20% 0px -70% 0px'
        }
    );
    
    sections.forEach(section => observer.observe(section));
}
