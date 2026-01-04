// 📘 DOCUMENTO TÉCNICO - LOADER MARKDOWN

document.addEventListener('DOMContentLoaded', async function() {
    console.log('📘 [DOC-LOADER] Iniciando carregamento...');
    
    const docContent = document.getElementById('docContent');
    
    if (!docContent) {
        console.error('❌ [DOC-LOADER] Container #docContent não encontrado no DOM!');
        return;
    }

    // Mostrar loading
    docContent.innerHTML = '<div style="text-align: center; padding: 60px; color: #a0aec0;"><p>⏳ Carregando documento técnico...</p></div>';

    try {
        // Carregar o arquivo Markdown
        console.log('📡 [DOC-LOADER] Fazendo fetch do arquivo markdown...');
        const response = await fetch('../DOCUMENTO_TECNICO_USO_PLATAFORMA.md');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const markdown = await response.text();
        console.log(`✅ [DOC-LOADER] Documento carregado (${markdown.length} caracteres)`);
        
        if (!markdown || markdown.trim().length === 0) {
            throw new Error('Arquivo markdown vazio');
        }
        
        // Converter Markdown para HTML
        console.log('🔄 [DOC-LOADER] Convertendo markdown para HTML...');
        const html = convertMarkdownToHTML(markdown);
        console.log(`✅ [DOC-LOADER] HTML gerado (${html.length} caracteres)`);
        
        docContent.innerHTML = html;
        console.log('✅ [DOC-LOADER] HTML inserido no DOM');
        
        // Highlight de seção ativa
        setupScrollSpy();
        
        console.log('✅ [DOC-LOADER] Documento renderizado com sucesso!');
        
    } catch (error) {
        console.error('❌ [DOC-LOADER] ERRO CRÍTICO:', error);
        docContent.innerHTML = `
            <div style="text-align: center; padding: 60px; color: #ff6b6b;">
                <h2>❌ Erro ao carregar documento</h2>
                <p>Por favor, pressione <strong>Ctrl + F5</strong> para recarregar a página.</p>
                <p style="font-size: 0.9rem; color: #a0aec0; margin-top: 20px;"><strong>Erro:</strong> ${error.message}</p>
                <p style="font-size: 0.85rem; color: #718096; margin-top: 10px;">Se o problema persistir, abra o Console (F12) e envie a mensagem de erro.</p>
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
