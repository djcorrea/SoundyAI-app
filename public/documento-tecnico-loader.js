// 📘 DOCUMENTO TÉCNICO - LOADER MARKDOWN

document.addEventListener('DOMContentLoaded', async function() {
    console.log('📘 [DOC-TECNICO] Iniciando carregamento...');
    console.log('📍 [DOC-TECNICO] URL atual:', window.location.href);
    
    const docContent = document.getElementById('docContent');
    
    if (!docContent) {
        console.error('❌ [DOC-TECNICO] Container #docContent não encontrado');
        return;
    }

    console.log('✅ [DOC-TECNICO] Container encontrado');

    // Mostrar loading
    docContent.innerHTML = `
        <div style="text-align: center; padding: 60px; color: #a0aec0;">
            <h2 style="color: #ffffff; margin-bottom: 20px;">Carregando documento...</h2>
            <div style="display: inline-block; width: 50px; height: 50px; border: 4px solid rgba(93, 21, 134, 0.3); border-top-color: #5d1586; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        </div>
        <style>
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    `;

    try {
        // Tentar múltiplos caminhos
        const paths = [
            '../DOCUMENTO_TECNICO_USO_PLATAFORMA.md',
            './DOCUMENTO_TECNICO_USO_PLATAFORMA.md',
            '/DOCUMENTO_TECNICO_USO_PLATAFORMA.md'
        ];

        let markdown = null;
        let successPath = null;

        for (const path of paths) {
            try {
                console.log(`🔍 [DOC-TECNICO] Tentando carregar: ${path}`);
                const response = await fetch(path);
                
                if (response.ok) {
                    markdown = await response.text();
                    successPath = path;
                    console.log(`✅ [DOC-TECNICO] Documento carregado de: ${path}`);
                    console.log(`📄 [DOC-TECNICO] Tamanho: ${markdown.length} caracteres`);
                    break;
                }
            } catch (err) {
                console.log(`❌ [DOC-TECNICO] Falhou: ${path} - ${err.message}`);
            }
        }

        if (!markdown) {
            throw new Error('Não foi possível carregar o documento de nenhum caminho');
        }
        
        // Converter Markdown para HTML
        console.log('🔄 [DOC-TECNICO] Convertendo Markdown para HTML...');
        const html = convertMarkdownToHTML(markdown);
        console.log(`✅ [DOC-TECNICO] HTML gerado: ${html.length} caracteres`);
        
        docContent.innerHTML = html;
        
        // Highlight de seção ativa
        setupScrollSpy();
        
        console.log('✅ [DOC-TECNICO] Documento renderizado com sucesso');
        
    } catch (error) {
        console.error('❌ [DOC-TECNICO] Erro crítico:', error);
        docContent.innerHTML = `
            <div style="text-align: center; padding: 60px; color: #ff6b6b;">
                <h2 style="color: #ff6b6b; margin-bottom: 20px;">❌ Erro ao carregar documento</h2>
                <p style="color: #a0aec0; margin-bottom: 10px;">Por favor, recarregue a página ou entre em contato com o suporte.</p>
                <p style="font-size: 0.9rem; color: #718096; background: rgba(255, 107, 107, 0.1); padding: 15px; border-radius: 8px; margin-top: 20px; font-family: monospace;">${error.message}</p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 24px; background: #5d1586; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem;">🔄 Recarregar Página</button>
            </div>
        `;
    }
});

/**
 * Converter Markdown para HTML
 */
function convertMarkdownToHTML(markdown) {
    // Separar por linhas
    const lines = markdown.split('\n');
    const result = [];
    let inList = false;
    let inCodeBlock = false;
    let codeBlockContent = [];
    
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
            if (inList) { result.push('</ul>'); inList = false; }
            result.push(`<h1>${line.substring(2)}</h1>`);
            continue;
        }
        
        if (line.startsWith('## ')) {
            if (inList) { result.push('</ul>'); inList = false; }
            const text = line.substring(3);
            const id = createSlug(text);
            result.push(`<h2 id="${id}">${text}</h2>`);
            continue;
        }
        
        if (line.startsWith('### ')) {
            if (inList) { result.push('</ul>'); inList = false; }
            result.push(`<h3>${line.substring(4)}</h3>`);
            continue;
        }
        
        if (line.startsWith('#### ')) {
            if (inList) { result.push('</ul>'); inList = false; }
            result.push(`<h4>${line.substring(5)}</h4>`);
            continue;
        }
        
        // Listas
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            if (!inList) {
                result.push('<ul>');
                inList = true;
            }
            result.push(`<li>${processInlineMarkdown(line.trim().substring(2))}</li>`);
            continue;
        }
        
        if (line.match(/^\d+\.\s/)) {
            if (!inList) {
                result.push('<ol>');
                inList = true;
            }
            result.push(`<li>${processInlineMarkdown(line.replace(/^\d+\.\s/, ''))}</li>`);
            continue;
        }
        
        // Fechar lista se necessário
        if (inList && line.trim() === '') {
            result.push('</ul>');
            inList = false;
            continue;
        }
        
        // Linha horizontal
        if (line.trim() === '---') {
            if (inList) { result.push('</ul>'); inList = false; }
            result.push('<hr>');
            continue;
        }
        
        // Parágrafos
        if (line.trim() !== '') {
            if (inList) { result.push('</ul>'); inList = false; }
            result.push(`<p>${processInlineMarkdown(line)}</p>`);
        }
    }
    
    // Fechar lista se ainda aberta
    if (inList) {
        result.push('</ul>');
    }
    
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
