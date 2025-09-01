#!/usr/bin/env node

import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Configurações de performance
const AUDIT_MAX_SIZE = parseInt(process.env.AUDIT_MAX_SIZE) || 2 * 1024 * 1024; // 2MB default
const CONCURRENCY_LIMIT = parseInt(process.env.AUDIT_CONCURRENCY) || 12; // 12 arquivos simultâneos
const BINARY_CHECK_SIZE = 8192; // 8KB para detectar binários

// Diretórios ignorados durante indexação
const IGNORED_DIRS = new Set([
    'node_modules', '.git', '.next', 'dist', 'build', 'coverage', 
    '.quarantine', 'audit', 'out', 'tmp', 'logs', '.vercel'
]);

// Extensões binárias conhecidas
const BINARY_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.svg',
    '.mp3', '.wav', '.ogg', '.mp4', '.avi', '.mov', '.webm',
    '.zip', '.rar', '.7z', '.tar', '.gz', '.pdf', '.doc', '.docx',
    '.exe', '.dll', '.so', '.dylib', '.bin', '.dat'
]);

// Cache global para conteúdos de arquivos
const fileContentCache = new Map();
const fileStatsCache = new Map();

// Arquivos e diretórios críticos que nunca devem ser considerados para remoção
const CRITICAL_PATTERNS = [
    // Configurações críticas
    /^\.env/,
    /^\.vercel/,
    /^vercel\.json$/,
    /^firebase\./,
    /^firestore\.rules$/,
    /^storage\.rules$/,
    /^serviceAccount.*\.json$/,
    
    // Diretórios críticos
    /^public[\/\\]/,
    /^assets[\/\\]/,
    /^static[\/\\]/,
    /^styles[\/\\]/,
    /^scripts[\/\\]/,
    /^lib[\/\\]/,
    /^migrations[\/\\]/,
    /^prisma[\/\\]/,
    /^samples[\/\\]/,
    
    // Configurações de ferramentas
    /^tsconfig/,
    /^eslint/,
    /^prettier/,
    /^jest/,
    /^vitest/,
    /^playwright/,
    /^cypress/,
    /^\.husky[\/\\]/,
    /^\.github[\/\\]/,
    
    // Arquivos de projeto
    /^package.*\.json$/,
    /^README\.md$/,
    /^\.gitignore$/,
    /^\.htaccess$/,
    /^favicon\.ico$/,
    
    // APIs e rotas
    /^api[\/\\]/,
    /^pages[\/\\]/,
    /^app[\/\\]/,
    /^src[\/\\]/,
    
    // Referências musicais (críticas para o funcionamento)
    /^refs[\/\\]/
];

// Padrões de arquivos que são candidatos típicos a limpeza
const CLEANUP_CANDIDATES = [
    // Arquivos de debug
    /^debug-.*\.(js|html)$/,
    /^critical-.*\.(js|html)$/,
    
    // Relatórios e logs
    /^RELATORIO_.*\.md$/,
    /^CORRECAO_.*\.md$/,
    /^AUDITORIA_.*\.md$/,
    /^ANALISE_.*\.md$/,
    /^ATUALIZACAO_.*\.md$/,
    /^CHECKLIST_.*\.md$/,
    /^CONFIGURACAO_.*\.md$/,
    /^DIAGNOSTICO_.*\.md$/,
    /^ETAPA_.*\.md$/,
    /^FINAL_.*\.md$/,
    /^GUIA_.*\.md$/,
    /^HOTFIX_.*\.md$/,
    /^IMPLEMENTACAO_.*\.md$/,
    /^INVESTIGACAO_.*\.md$/,
    /^LOG_.*\.md$/,
    /^LIMITE_.*\.md$/,
    /^PATCH_.*\.md$/,
    /^PLANO_.*\.md$/,
    /^POST_.*\.md$/,
    /^PROBLEMA_.*\.md$/,
    /^RESUMO_.*\.md$/,
    /^SISTEMA_.*\.md$/,
    /^STATUS_.*\.md$/,
    /^TESTE_.*\.md$/,
    /^UPLOAD_.*\.md$/,
    /^URGENTE_.*\.html$/,
    /^VERIFICACAO_.*\.md$/,
    
    // Arquivos de teste temporários
    /^test-.*\.(js|html)$/,
    /^teste-.*\.(js|html|ps1)$/,
    /^validation-.*\.html$/,
    /^validate-.*\.(js|html)$/,
    
    // Arquivos de desenvolvimento
    /^dev-.*\.js$/,
    /^simple-.*\.js$/,
    /^temp-.*\.js$/,
    /^emergency-.*\.(js|html)$/,
    
    // Arquivos de configuração temporária
    /^configurar-.*\.(ps1|sh)$/,
    /^limpar-.*\.ps1$/,
    
    // Backups e arquivos antigos
    /.*-backup\.(js|css|html)$/,
    /.*\.old$/,
    /.*\.bak$/,
    /.*\.tmp$/,
    
    // Arquivos de cache e diagnóstico
    /^cache-.*\.(txt|html)$/,
    /^diagnostic.*\.html$/,
    /^performance-.*\.(js|css)$/,
    
    // Scripts de correção pontuais
    /^correcao-.*\.(js|html)$/,
    /^fix-.*\.js$/,
    /^update-.*\.js$/,
    /^deploy-.*\.js$/,
    
    // Arquivos de texto temporários
    /^builder-.*\.txt$/,
    /^calibration-.*\.txt$/,
    /.*-report.*\.txt$/
];

// Detector simples de arquivo binário
function isBinaryFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) return true;
    
    try {
        const buffer = fssync.readFileSync(filePath, { encoding: null, flag: 'r' });
        const checkSize = Math.min(buffer.length, BINARY_CHECK_SIZE);
        
        // Procurar por bytes nulos nos primeiros 8KB
        for (let i = 0; i < checkSize; i++) {
            if (buffer[i] === 0) return true;
        }
        return false;
    } catch (error) {
        return true; // Assumir binário se não conseguir ler
    }
}

// Indexação assíncrona com controle de concorrência
async function indexRepository() {
    console.log('📚 Iniciando indexação do repositório...');
    const startTime = Date.now();
    
    const allFiles = [];
    const textFiles = [];
    let processedCount = 0;
    
    // Coleta recursiva de arquivos
    async function collectFiles(dir) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    if (!IGNORED_DIRS.has(entry.name)) {
                        await collectFiles(fullPath);
                    }
                } else {
                    allFiles.push(fullPath);
                    
                    // Verificar se é arquivo de texto e dentro do limite de tamanho
                    try {
                        const stats = await fs.stat(fullPath);
                        fileStatsCache.set(fullPath, stats);
                        
                        if (stats.size <= AUDIT_MAX_SIZE && !isBinaryFile(fullPath)) {
                            textFiles.push(fullPath);
                        }
                    } catch (error) {
                        // Ignorar arquivos com erro de acesso
                    }
                }
            }
        } catch (error) {
            // Ignorar diretórios com erro de acesso
        }
    }
    
    await collectFiles(projectRoot);
    
    console.log(`📁 Encontrados ${allFiles.length} arquivos (${textFiles.length} de texto)`);
    
    // Cache de conteúdos com controle de concorrência
    const semaphore = new Array(CONCURRENCY_LIMIT).fill(Promise.resolve());
    let semaphoreIndex = 0;
    
    const cachePromises = textFiles.map(async (filePath) => {
        // Esperar por um slot disponível
        const currentIndex = semaphoreIndex;
        semaphoreIndex = (semaphoreIndex + 1) % CONCURRENCY_LIMIT;
        
        await semaphore[currentIndex];
        
        // Processar arquivo
        const promise = (async () => {
            try {
                const content = await fs.readFile(filePath, 'utf8');
                fileContentCache.set(filePath, content);
                
                processedCount++;
                if (processedCount % 100 === 0) {
                    console.log(`📖 Indexados ${processedCount}/${textFiles.length} arquivos de texto...`);
                }
            } catch (error) {
                // Ignorar arquivos com erro de leitura
            }
        })();
        
        semaphore[currentIndex] = promise.catch(() => {});
        return promise;
    });
    
    await Promise.allSettled(cachePromises);
    
    const indexTime = Date.now() - startTime;
    console.log(`✅ Indexação concluída em ${(indexTime / 1000).toFixed(2)}s`);
    console.log(`💾 Cache: ${fileContentCache.size} arquivos (${(getMemoryUsage() / 1024 / 1024).toFixed(1)}MB)\n`);
    
    return allFiles;
}

// Estimativa de uso de memória do cache
function getMemoryUsage() {
    let totalSize = 0;
    for (const content of fileContentCache.values()) {
        totalSize += Buffer.byteLength(content, 'utf8');
    }
    return totalSize;
}

function getAllFiles(dir, fileList = []) {
    // Esta função agora é substituída pela indexação assíncrona
    // Mantida para compatibilidade, mas não será usada
    return fileList;
}

function getRelativePath(filePath) {
    return path.relative(projectRoot, filePath).replace(/\\/g, '/');
}

function isCritical(relativePath) {
    return CRITICAL_PATTERNS.some(pattern => pattern.test(relativePath));
}

function isCleanupCandidate(relativePath) {
    const fileName = path.basename(relativePath);
    return CLEANUP_CANDIDATES.some(pattern => pattern.test(fileName) || pattern.test(relativePath));
}

function getFileSize(filePath) {
    try {
        // Usar cache se disponível
        const cached = fileStatsCache.get(filePath);
        if (cached) return cached.size;
        
        const stats = fssync.statSync(filePath);
        fileStatsCache.set(filePath, stats);
        return stats.size;
    } catch (error) {
        return 0;
    }
}

function getLastModified(filePath) {
    try {
        // Usar cache se disponível
        const cached = fileStatsCache.get(filePath);
        if (cached) return cached.mtime.toISOString().split('T')[0];
        
        const stats = fssync.statSync(filePath);
        fileStatsCache.set(filePath, stats);
        return stats.mtime.toISOString().split('T')[0];
    } catch (error) {
        return 'unknown';
    }
}

// Busca otimizada usando cache de conteúdos
function searchReferencesOptimized(fileName, baseName) {
    const searchPatterns = [
        fileName,
        baseName,
        `'${fileName}'`,
        `"${fileName}"`,
        `'${baseName}'`,
        `"${baseName}"`,
        `import.*${baseName}`,
        `require.*${baseName}`,
        `href.*${fileName}`,
        `src.*${fileName}`,
        `url.*${fileName}`
    ];
    
    let references = 0;
    
    // Usar cache em vez de ler arquivos do disco
    for (const [filePath, content] of fileContentCache.entries()) {
        try {
            for (const pattern of searchPatterns) {
                if (content.includes(pattern)) {
                    references++;
                    break; // Não contar múltiplas referências no mesmo arquivo
                }
            }
        } catch (error) {
            // Ignorar erros de processamento
        }
    }
    
    return references;
}

function searchReferences(fileName, baseName) {
    // Função legacy mantida para compatibilidade - usa versão otimizada
    return searchReferencesOptimized(fileName, baseName);
}

function categorizeFile(relativePath) {
    const fileName = path.basename(relativePath);
    const ext = path.extname(fileName);
    
    if (isCritical(relativePath)) {
        return { category: 'critical', confidence: 'baixa', reason: 'Arquivo crítico do sistema' };
    }
    
    if (isCleanupCandidate(relativePath)) {
        const references = searchReferences(fileName, path.parse(fileName).name);
        
        if (references === 0) {
            return { 
                category: 'cleanup', 
                confidence: 'alta', 
                reason: 'Arquivo de debug/teste sem referências' 
            };
        } else {
            return { 
                category: 'cleanup', 
                confidence: 'média', 
                reason: `Arquivo de debug/teste com ${references} referência(s)` 
            };
        }
    }
    
    // Verificar se é arquivo órfão (sem referências)
    const references = searchReferences(fileName, path.parse(fileName).name);
    
    if (references === 0 && !['.md', '.txt', '.json'].includes(ext)) {
        return { 
            category: 'orphan', 
            confidence: 'média', 
            reason: 'Arquivo sem referências detectadas' 
        };
    }
    
    return { category: 'keep', confidence: 'baixa', reason: 'Arquivo em uso ou incerto' };
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function analyzeProject() {
    console.log('🔍 Iniciando auditoria de arquivos...\n');
    
    // Fase 1: Indexação do repositório
    const allFiles = await indexRepository();
    
    // Fase 2: Análise dos arquivos
    console.log('🔍 Iniciando análise de arquivos...');
    const analysisStartTime = Date.now();
    
    const results = [];
    let totalSize = 0;
    let candidatesSize = 0;
    let candidatesCount = 0;
    let processedCount = 0;
    
    console.log(`📁 Analisando ${allFiles.length} arquivos...\n`);
    
    for (const filePath of allFiles) {
        const relativePath = getRelativePath(filePath);
        const fileName = path.basename(relativePath);
        const fileSize = getFileSize(filePath);
        const lastModified = getLastModified(filePath);
        const analysis = categorizeFile(relativePath);
        
        totalSize += fileSize;
        
        if (analysis.category === 'cleanup' || analysis.category === 'orphan') {
            candidatesSize += fileSize;
            candidatesCount++;
        }
        
        results.push({
            path: relativePath,
            fileName,
            size: fileSize,
            sizeFormatted: formatBytes(fileSize),
            lastModified,
            category: analysis.category,
            confidence: analysis.confidence,
            reason: analysis.reason,
            type: path.extname(fileName) || 'no-ext'
        });
        
        processedCount++;
        if (processedCount % 100 === 0) {
            console.log(`⚡ Analisados ${processedCount}/${allFiles.length} arquivos...`);
        }
    }
    
    const analysisTime = Date.now() - analysisStartTime;
    console.log(`✅ Análise concluída em ${(analysisTime / 1000).toFixed(2)}s\n`);
    
    return {
        results,
        summary: {
            totalFiles: allFiles.length,
            totalSize: formatBytes(totalSize),
            candidatesCount,
            candidatesSize: formatBytes(candidatesSize),
            potentialSavings: ((candidatesSize / totalSize) * 100).toFixed(1) + '%'
        }
    };
}

function generateMarkdownReport(analysis) {
    const { results, summary } = analysis;
    
    let report = `# Relatório de Auditoria de Arquivos Não Utilizados\n\n`;
    report += `**Data:** ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    
    // Resumo executivo
    report += `## 📊 Resumo Executivo\n\n`;
    report += `- **Total de arquivos analisados:** ${summary.totalFiles}\n`;
    report += `- **Candidatos para limpeza:** ${summary.candidatesCount}\n`;
    report += `- **Economia potencial:** ${summary.candidatesSize} (${summary.potentialSavings} do total)\n`;
    report += `- **Tamanho total do projeto:** ${summary.totalSize}\n\n`;
    
    // Candidatos de alta confiança
    const highConfidenceCandidates = results.filter(r => 
        (r.category === 'cleanup' || r.category === 'orphan') && r.confidence === 'alta'
    );
    
    if (highConfidenceCandidates.length > 0) {
        report += `## 🎯 Candidatos de Alta Confiança (${highConfidenceCandidates.length})\n\n`;
        report += `| Arquivo | Tamanho | Última Modificação | Motivo |\n`;
        report += `|---------|---------|-------------------|--------|\n`;
        
        for (const file of highConfidenceCandidates) {
            report += `| \`${file.path}\` | ${file.sizeFormatted} | ${file.lastModified} | ${file.reason} |\n`;
        }
        report += `\n`;
    }
    
    // Candidatos de média confiança
    const mediumConfidenceCandidates = results.filter(r => 
        (r.category === 'cleanup' || r.category === 'orphan') && r.confidence === 'média'
    );
    
    if (mediumConfidenceCandidates.length > 0) {
        report += `## ⚠️ Candidatos de Média Confiança (${mediumConfidenceCandidates.length})\n\n`;
        report += `| Arquivo | Tamanho | Última Modificação | Motivo |\n`;
        report += `|---------|---------|-------------------|--------|\n`;
        
        for (const file of mediumConfidenceCandidates) {
            report += `| \`${file.path}\` | ${file.sizeFormatted} | ${file.lastModified} | ${file.reason} |\n`;
        }
        report += `\n`;
    }
    
    // Análise por tipo de arquivo
    const typeStats = {};
    results.forEach(file => {
        if (file.category === 'cleanup' || file.category === 'orphan') {
            if (!typeStats[file.type]) {
                typeStats[file.type] = { count: 0, size: 0 };
            }
            typeStats[file.type].count++;
            typeStats[file.type].size += file.size;
        }
    });
    
    if (Object.keys(typeStats).length > 0) {
        report += `## 📈 Análise por Tipo de Arquivo\n\n`;
        report += `| Tipo | Quantidade | Tamanho Total |\n`;
        report += `|------|------------|---------------|\n`;
        
        Object.entries(typeStats)
            .sort((a, b) => b[1].size - a[1].size)
            .forEach(([type, stats]) => {
                report += `| ${type || 'sem extensão'} | ${stats.count} | ${formatBytes(stats.size)} |\n`;
            });
        report += `\n`;
    }
    
    // Lista completa de candidatos
    const allCandidates = results.filter(r => r.category === 'cleanup' || r.category === 'orphan');
    if (allCandidates.length > 0) {
        report += `## 📋 Lista Completa de Candidatos\n\n`;
        report += `| Arquivo | Tipo | Tamanho | Última Modificação | Confiança | Motivo |\n`;
        report += `|---------|------|---------|-------------------|-----------|--------|\n`;
        
        allCandidates
            .sort((a, b) => {
                // Ordenar por confiança e depois por tamanho
                const confidenceOrder = { 'alta': 3, 'média': 2, 'baixa': 1 };
                const aDiff = confidenceOrder[a.confidence] || 0;
                const bDiff = confidenceOrder[b.confidence] || 0;
                if (aDiff !== bDiff) return bDiff - aDiff;
                return b.size - a.size;
            })
            .forEach(file => {
                report += `| \`${file.path}\` | ${file.type} | ${file.sizeFormatted} | ${file.lastModified} | ${file.confidence} | ${file.reason} |\n`;
            });
    }
    
    return report;
}

function generateQuarantineScript(analysis) {
    const { results } = analysis;
    const highConfidenceCandidates = results.filter(r => 
        (r.category === 'cleanup' || r.category === 'orphan') && r.confidence === 'alta'
    );
    
    let script = `# Script de Quarentena - Dry Run\n`;
    script += `# Data: ${new Date().toISOString()}\n`;
    script += `# Total de arquivos: ${highConfidenceCandidates.length}\n\n`;
    
    script += `Write-Host "🔍 Iniciando quarentena dry-run..."\n`;
    script += `Write-Host "📁 Criando diretório de quarentena..."\n`;
    script += `New-Item -ItemType Directory -Path ".quarantine" -Force | Out-Null\n\n`;
    
    for (const file of highConfidenceCandidates) {
        const quarantinePath = `.quarantine/${file.path}`;
        const quarantineDir = path.dirname(quarantinePath);
        
        script += `# Movendo: ${file.path} (${file.sizeFormatted})\n`;
        script += `New-Item -ItemType Directory -Path "${quarantineDir}" -Force | Out-Null\n`;
        script += `if (Test-Path "${file.path}") {\n`;
        script += `    Move-Item "${file.path}" "${quarantinePath}" -Force\n`;
        script += `    Write-Host "✅ Movido: ${file.path}"\n`;
        script += `} else {\n`;
        script += `    Write-Host "⚠️ Não encontrado: ${file.path}"\n`;
        script += `}\n\n`;
    }
    
    script += `Write-Host "🧪 Testando build..."\n`;
    script += `npm run build\n`;
    script += `$buildResult = $LASTEXITCODE\n\n`;
    
    script += `if ($buildResult -eq 0) {\n`;
    script += `    Write-Host "✅ Build passou! Quarentena bem-sucedida."\n`;
    script += `} else {\n`;
    script += `    Write-Host "❌ Build falhou! Revertendo mudanças..."\n`;
    script += `    if (Test-Path ".quarantine") {\n`;
    script += `        Get-ChildItem ".quarantine" -Recurse -File | ForEach-Object {\n`;
    script += `            $originalPath = $_.FullName -replace [regex]::Escape((Resolve-Path ".quarantine").Path + "\\\\"), ""\n`;
    script += `            $originalDir = Split-Path $originalPath -Parent\n`;
    script += `            if ($originalDir) {\n`;
    script += `                New-Item -ItemType Directory -Path $originalDir -Force | Out-Null\n`;
    script += `            }\n`;
    script += `            Move-Item $_.FullName $originalPath -Force\n`;
    script += `            Write-Host "↩️ Revertido: $originalPath"\n`;
    script += `        }\n`;
    script += `        Remove-Item ".quarantine" -Recurse -Force\n`;
    script += `    }\n`;
    script += `    exit 1\n`;
    script += `}\n\n`;
    
    script += `Write-Host "🎉 Quarentena concluída com sucesso!"\n`;
    script += `Write-Host "💡 Para reverter: Execute o script de restore ou mova arquivos de .quarantine de volta"\n`;
    
    return script;
}

// Executar análise principal
async function main() {
    try {
        console.log('🚀 Executando auditoria de arquivos otimizada...\n');
        console.log(`⚙️ Configurações: MaxSize=${formatBytes(AUDIT_MAX_SIZE)}, Concorrência=${CONCURRENCY_LIMIT}\n`);
        
        const totalStartTime = Date.now();
        const analysis = await analyzeProject();
        
        // Fase 3: Geração de relatórios
        console.log('📝 Gerando relatórios...');
        const reportStartTime = Date.now();
        
        const markdownReport = generateMarkdownReport(analysis);
        const quarantineScript = generateQuarantineScript(analysis);
        const jsonReport = JSON.stringify(analysis, null, 2);
        
        // Salvar relatórios usando fs async
        const auditDir = path.join(projectRoot, 'audit');
        try {
            await fs.access(auditDir);
        } catch {
            await fs.mkdir(auditDir, { recursive: true });
        }
        
        await Promise.all([
            fs.writeFile(path.join(auditDir, 'unused_files_report.md'), markdownReport),
            fs.writeFile(path.join(auditDir, 'unused_files_report.json'), jsonReport),
            fs.writeFile(path.join(auditDir, 'quarantine_dryrun.ps1'), quarantineScript)
        ]);
        
        const reportTime = Date.now() - reportStartTime;
        const totalTime = Date.now() - totalStartTime;
        
        console.log(`✅ Relatórios gerados em ${(reportTime / 1000).toFixed(2)}s\n`);
        
        console.log('📊 RESUMO FINAL DA AUDITORIA');
        console.log('================================');
        console.log(`⏱️ Tempo total: ${(totalTime / 1000).toFixed(2)}s`);
        console.log(`� Cache utilizado: ${(getMemoryUsage() / 1024 / 1024).toFixed(1)}MB`);
        console.log(`�📁 Total de arquivos: ${analysis.summary.totalFiles}`);
        console.log(`🎯 Candidatos para limpeza: ${analysis.summary.candidatesCount}`);
        console.log(`💾 Economia potencial: ${analysis.summary.candidatesSize} (${analysis.summary.potentialSavings})`);
        console.log(`📄 Relatório salvo em: audit/unused_files_report.md`);
        console.log(`🗃️ Dados JSON salvos em: audit/unused_files_report.json`);
        console.log(`🔧 Script de quarentena: audit/quarantine_dryrun.ps1`);
        console.log('================================\n');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro durante a auditoria:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Executar análise
main();
