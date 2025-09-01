#!/usr/bin/env node

import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Arquivos CRÍTICOS que nunca devem ser removidos
const CRITICAL_FILES = new Set([
    // Core do projeto
    'index.html', 'package.json', 'package-lock.json', 'vercel.json',
    'firebase.json', 'firestore.rules', 'storage.rules',
    
    // APIs
    'api/upload-audio.js', 'api/chat.js', 'api/payment.js',
    
    // Scripts funcionais
    'debug-analyzer.js', 'dev-server.js', 'dev-server-fixed.js',
    
    // Configurações
    '.env', '.env.example', '.gitignore', 'README.md'
]);

// Diretórios críticos
const CRITICAL_DIRS = new Set([
    'public', 'api', 'tools', 'refs', 'samples', 
    'node_modules', '.git', '.vercel'
]);

// Padrões de arquivos SEGUROS para remoção (documentação/debug)
const SAFE_REMOVAL_PATTERNS = [
    // Documentação de processo/debug
    /^ANALISE_.*\.md$/,
    /^AUDITORIA_.*\.md$/,
    /^CORRECAO_.*\.md$/,
    /^CHECKLIST_.*\.md$/,
    /^CONFIGURACAO_.*\.md$/,
    /^DIAGNOSTICO_.*\.md$/,
    /^ETAPA_.*\.md$/,
    /^FINAL_.*\.md$/,
    /^GUIA_.*\.md$/,
    /^HOTFIX_.*\.md$/,
    /^IMPLEMENTACAO_.*\.md$/,
    /^INVESTIGACAO_.*\.md$/,
    /^LIMITE_.*\.md$/,
    /^LOG_.*\.md$/,
    /^PATCH_.*\.md$/,
    /^PLANO_.*\.md$/,
    /^POST_.*\.md$/,
    /^PROBLEMA_.*\.md$/,
    /^RELATORIO_.*\.md$/,
    /^RESUMO_.*\.md$/,
    /^SISTEMA_.*\.md$/,
    /^STATUS_.*\.md$/,
    /^TESTE_.*\.md$/,
    /^UPLOAD_.*\.md$/,
    /^VERIFICACAO_.*\.md$/,
    /^ATUALIZACAO_.*\.md$/,
    
    // Scripts de configuração temporária
    /^configurar-.*\.(ps1|sh)$/,
    /^limpar-.*\.ps1$/,
    
    // Relatórios HTML de debug (não funcionais)
    /^cache-diagnostic\.html$/,
    /^critical-error-report\.html$/,
    /^debug-score-.*\.html$/,
    /^debug-interpretation\.html$/,
    /^debug-suggestion-logic\.html$/,
    /^debug-technical-problems\.html$/,
    /^debug-subscore-precision\.html$/,
    /^debug-valores-problema\.html$/,
    /^correcao-.*\.html$/,
    /^diagnostic-.*\.html$/,
    /^validation-.*\.html$/,
    
    // Arquivos de texto temporários
    /^builder-.*\.txt$/,
    /^calibration-.*\.txt$/,
    /.*-report.*\.txt$/,
    /^cache-.*\.txt$/,
    
    // Scripts de correção pontuais vazios
    /^correcao-emergencia\.js$/,
    /^debug-server\.js$/,
    /^fix-bandas-direto\.js$/,
    
    // Arquivos vazios ou temporários
    /^deploy-trigger\.js$/
];

// Função para verificar se um arquivo está sendo importado/usado
async function isFileReferenced(filePath, fileName, baseName) {
    const searchPatterns = [
        // Import/require diretos
        `import.*${fileName}`,
        `import.*${baseName}`,
        `require.*${fileName}`,
        `require.*${baseName}`,
        
        // Referências em HTML
        `src=.*${fileName}`,
        `href=.*${fileName}`,
        
        // Referências em strings
        `"${fileName}"`,
        `'${fileName}'`,
        `\`${fileName}\``,
        
        // Scripts npm
        `node ${fileName}`,
        `node ${baseName}`,
        
        // Paths relativos
        `../${fileName}`,
        `./${fileName}`,
        `/${fileName}`
    ];
    
    // Verificar package.json especificamente
    try {
        const packageContent = await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8');
        const packageData = JSON.parse(packageContent);
        
        // Verificar scripts
        for (const script of Object.values(packageData.scripts || {})) {
            if (script.includes(fileName) || script.includes(baseName)) {
                return true;
            }
        }
    } catch (error) {
        // Ignorar se não conseguir ler package.json
    }
    
    // Buscar em todos os arquivos do projeto
    const allFiles = await getAllFilesRecursive(projectRoot);
    
    for (const file of allFiles) {
        // Pular arquivos binários e irrelevantes
        if (isBinaryFile(file) || file.includes('node_modules') || file.includes('.git')) {
            continue;
        }
        
        try {
            const content = await fs.readFile(file, 'utf8');
            
            for (const pattern of searchPatterns) {
                const regex = new RegExp(pattern, 'i');
                if (regex.test(content)) {
                    return true;
                }
            }
        } catch (error) {
            // Ignorar arquivos que não conseguimos ler
        }
    }
    
    return false;
}

// Função para verificar se é arquivo binário
function isBinaryFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.mp3', '.wav', '.mp4', '.zip', '.pdf'];
    return binaryExtensions.includes(ext);
}

// Função para listar todos os arquivos recursivamente
async function getAllFilesRecursive(dir) {
    const files = [];
    
    async function traverse(currentDir) {
        try {
            const entries = await fs.readdir(currentDir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                
                if (entry.isDirectory()) {
                    const relativePath = path.relative(projectRoot, fullPath);
                    if (!CRITICAL_DIRS.has(entry.name) && !relativePath.includes('node_modules')) {
                        await traverse(fullPath);
                    }
                } else {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Ignorar diretórios com erro de acesso
        }
    }
    
    await traverse(dir);
    return files;
}

// Função principal de análise
async function analyzeSafeRemoval() {
    console.log('🔍 Analisando arquivos seguros para remoção...\n');
    
    const allFiles = await getAllFilesRecursive(projectRoot);
    const safeForRemoval = [];
    const suspicious = [];
    const critical = [];
    
    let processed = 0;
    const total = allFiles.length;
    
    for (const filePath of allFiles) {
        const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
        const fileName = path.basename(relativePath);
        const baseName = path.parse(fileName).name;
        
        processed++;
        if (processed % 50 === 0) {
            console.log(`📊 Processando ${processed}/${total} arquivos...`);
        }
        
        // Verificar se é arquivo crítico
        if (CRITICAL_FILES.has(relativePath) || CRITICAL_FILES.has(fileName)) {
            critical.push({ path: relativePath, reason: 'Arquivo crítico do sistema' });
            continue;
        }
        
        // Verificar se corresponde aos padrões de remoção segura
        const isSafePattern = SAFE_REMOVAL_PATTERNS.some(pattern => 
            pattern.test(fileName) || pattern.test(relativePath)
        );
        
        if (isSafePattern) {
            // Verificar se está sendo referenciado
            const isReferenced = await isFileReferenced(filePath, fileName, baseName);
            
            if (!isReferenced) {
                const stats = fssync.statSync(filePath);
                safeForRemoval.push({
                    path: relativePath,
                    size: stats.size,
                    lastModified: stats.mtime.toISOString().split('T')[0],
                    reason: 'Documentação/debug não referenciado',
                    type: getFileType(fileName)
                });
            } else {
                suspicious.push({
                    path: relativePath,
                    reason: 'Arquivo de debug mas com referências encontradas'
                });
            }
        }
    }
    
    return { safeForRemoval, suspicious, critical, total: processed };
}

function getFileType(fileName) {
    const ext = path.extname(fileName);
    if (!ext) return 'no-ext';
    return ext;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Gerar relatório de remoção segura
function generateSafeRemovalReport(analysis) {
    const { safeForRemoval, suspicious, critical } = analysis;
    
    let report = `# 🗑️ Relatório de Arquivos Seguros para Remoção\n\n`;
    report += `**Data:** ${new Date().toLocaleDateString('pt-BR')}\n`;
    report += `**Análise:** Apenas arquivos de documentação/debug sem referências\n\n`;
    
    // Resumo
    const totalSize = safeForRemoval.reduce((sum, file) => sum + file.size, 0);
    report += `## 📊 Resumo\n\n`;
    report += `- **Arquivos seguros para remoção:** ${safeForRemoval.length}\n`;
    report += `- **Espaço a ser liberado:** ${formatBytes(totalSize)}\n`;
    report += `- **Arquivos suspeitos (revisar):** ${suspicious.length}\n`;
    report += `- **Arquivos críticos preservados:** ${critical.length}\n\n`;
    
    // Arquivos seguros para remoção
    if (safeForRemoval.length > 0) {
        report += `## ✅ Arquivos SEGUROS para Remoção (${safeForRemoval.length})\n\n`;
        report += `| Arquivo | Tipo | Tamanho | Última Modificação | Motivo |\n`;
        report += `|---------|------|---------|-------------------|--------|\n`;
        
        safeForRemoval
            .sort((a, b) => b.size - a.size)
            .forEach(file => {
                report += `| \`${file.path}\` | ${file.type} | ${formatBytes(file.size)} | ${file.lastModified} | ${file.reason} |\n`;
            });
        report += `\n`;
    }
    
    // Arquivos suspeitos
    if (suspicious.length > 0) {
        report += `## ⚠️ Arquivos Suspeitos - REVISAR MANUALMENTE (${suspicious.length})\n\n`;
        report += `| Arquivo | Motivo |\n`;
        report += `|---------|--------|\n`;
        
        suspicious.forEach(file => {
            report += `| \`${file.path}\` | ${file.reason} |\n`;
        });
        report += `\n`;
    }
    
    // Estatísticas por tipo
    const typeStats = {};
    safeForRemoval.forEach(file => {
        if (!typeStats[file.type]) {
            typeStats[file.type] = { count: 0, size: 0 };
        }
        typeStats[file.type].count++;
        typeStats[file.type].size += file.size;
    });
    
    if (Object.keys(typeStats).length > 0) {
        report += `## 📈 Arquivos por Tipo\n\n`;
        report += `| Tipo | Quantidade | Tamanho Total |\n`;
        report += `|------|------------|---------------|\n`;
        
        Object.entries(typeStats)
            .sort((a, b) => b[1].size - a[1].size)
            .forEach(([type, stats]) => {
                report += `| ${type || 'sem extensão'} | ${stats.count} | ${formatBytes(stats.size)} |\n`;
            });
    }
    
    return report;
}

// Gerar script de remoção segura
function generateSafeRemovalScript(analysis) {
    const { safeForRemoval } = analysis;
    
    let script = `# Script de Remoção Segura - Apenas Documentação/Debug\n`;
    script += `# Data: ${new Date().toISOString()}\n`;
    script += `# Arquivos: ${safeForRemoval.length}\n\n`;
    
    script += `Write-Host "🗑️ Iniciando remoção de arquivos de documentação/debug..."\n`;
    script += `Write-Host "📁 Total de arquivos: ${safeForRemoval.length}"\n\n`;
    
    script += `# Criar backup antes da remoção\n`;
    script += `$backupDir = ".backup-$(Get-Date -Format 'yyyy-MM-dd-HHmm')"\n`;
    script += `New-Item -ItemType Directory -Path $backupDir -Force | Out-Null\n`;
    script += `Write-Host "💾 Backup criado em: $backupDir"\n\n`;
    
    for (const file of safeForRemoval) {
        const backupPath = `$backupDir\\${file.path}`;
        const backupDir = path.dirname(backupPath);
        
        script += `# Removendo: ${file.path} (${formatBytes(file.size)})\n`;
        script += `if (Test-Path "${file.path}") {\n`;
        script += `    $backupFileDir = "${backupDir}\\${path.dirname(file.path)}"\n`;
        script += `    New-Item -ItemType Directory -Path $backupFileDir -Force | Out-Null\n`;
        script += `    Copy-Item "${file.path}" "$backupFileDir\\" -Force\n`;
        script += `    Remove-Item "${file.path}" -Force\n`;
        script += `    Write-Host "✅ Removido: ${file.path}"\n`;
        script += `} else {\n`;
        script += `    Write-Host "⚠️ Não encontrado: ${file.path}"\n`;
        script += `}\n\n`;
    }
    
    const totalSize = safeForRemoval.reduce((sum, file) => sum + file.size, 0);
    script += `Write-Host "🎉 Remoção concluída!"\n`;
    script += `Write-Host "💾 Espaço liberado: ${formatBytes(totalSize)}"\n`;
    script += `Write-Host "📦 Backup salvo em: $backupDir"\n`;
    script += `Write-Host "↩️ Para reverter: mova os arquivos do backup de volta"\n`;
    
    return script;
}

// Executar análise
async function main() {
    try {
        console.log('🚀 Executando análise de remoção segura...\n');
        
        const analysis = await analyzeSafeRemoval();
        
        // Gerar relatórios
        const report = generateSafeRemovalReport(analysis);
        const script = generateSafeRemovalScript(analysis);
        const jsonData = JSON.stringify(analysis, null, 2);
        
        // Salvar arquivos
        const auditDir = path.join(projectRoot, 'audit');
        await fs.writeFile(path.join(auditDir, 'safe_removal_report.md'), report);
        await fs.writeFile(path.join(auditDir, 'safe_removal_script.ps1'), script);
        await fs.writeFile(path.join(auditDir, 'safe_removal_data.json'), jsonData);
        
        console.log('\n📊 ANÁLISE DE REMOÇÃO SEGURA CONCLUÍDA');
        console.log('==========================================');
        console.log(`✅ Arquivos seguros para remoção: ${analysis.safeForRemoval.length}`);
        console.log(`⚠️ Arquivos suspeitos (revisar): ${analysis.suspicious.length}`);
        console.log(`🛡️ Arquivos críticos preservados: ${analysis.critical.length}`);
        
        const totalSize = analysis.safeForRemoval.reduce((sum, file) => sum + file.size, 0);
        console.log(`💾 Espaço a ser liberado: ${formatBytes(totalSize)}`);
        console.log(`📄 Relatório: audit/safe_removal_report.md`);
        console.log(`🔧 Script: audit/safe_removal_script.ps1`);
        console.log('==========================================\n');
        
    } catch (error) {
        console.error('❌ Erro durante análise:', error.message);
        process.exit(1);
    }
}

main();
