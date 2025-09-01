#!/usr/bin/env node

import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Identificar arquivos que são DOCUMENTAÇÃO (não código funcional)
function isDocumentationFile(filePath) {
    const patterns = [
        // Arquivos de auditoria/relatórios
        /^audit\//,
        /^ANALISE_.*\.md$/,
        /^AUDITORIA_.*\.md$/,
        /^CORRECAO_.*\.md$/,
        /^RELATORIO_.*\.md$/,
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
        /^RESUMO_.*\.md$/,
        /^SISTEMA_.*\.md$/,
        /^STATUS_.*\.md$/,
        /^TESTE_.*\.md$/,
        /^UPLOAD_.*\.md$/,
        /^VERIFICACAO_.*\.md$/,
        /^ATUALIZACAO_.*\.md$/
    ];
    
    return patterns.some(pattern => pattern.test(filePath));
}

// Identificar arquivos funcionais que não devem ser removidos
function isFunctionalFile(filePath) {
    const functionalPatterns = [
        // Core do projeto
        /^(public|api|tools|refs|samples)\//,
        /^package\.json$/,
        /^vercel\.json$/,
        /^firebase\.json$/,
        /^\.env/,
        /^\.gitignore$/,
        /^README\.md$/,
        
        // Scripts em uso
        /^debug-analyzer\.js$/,
        /^dev-server\.js$/,
        /^dev-server-fixed\.js$/
    ];
    
    return functionalPatterns.some(pattern => pattern.test(filePath));
}

// Análise específica para documentação desnecessária
async function analyzeDocumentationFiles() {
    console.log('📚 Analisando arquivos de documentação...\n');
    
    const allFiles = [];
    
    // Coletar todos os arquivos
    async function collectFiles(dir) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    // Pular diretórios críticos
                    if (!['node_modules', '.git', '.vercel', 'public'].includes(entry.name)) {
                        await collectFiles(fullPath);
                    }
                } else {
                    allFiles.push(fullPath);
                }
            }
        } catch (error) {
            // Ignorar diretórios com erro
        }
    }
    
    await collectFiles(projectRoot);
    
    const documentationFiles = [];
    const functionalFiles = [];
    const otherFiles = [];
    
    for (const filePath of allFiles) {
        const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
        
        if (isFunctionalFile(relativePath)) {
            functionalFiles.push(relativePath);
        } else if (isDocumentationFile(relativePath)) {
            const stats = fssync.statSync(filePath);
            documentationFiles.push({
                path: relativePath,
                size: stats.size,
                lastModified: stats.mtime.toISOString().split('T')[0],
                type: path.extname(relativePath) || 'no-ext'
            });
        } else {
            otherFiles.push(relativePath);
        }
    }
    
    return { documentationFiles, functionalFiles, otherFiles };
}

// Identificar arquivos de debug HTML que são seguros
function isDebugHtmlFile(filePath) {
    const debugPatterns = [
        /^debug-.*\.html$/,
        /^cache-diagnostic\.html$/,
        /^critical-error-report\.html$/,
        /^diagnostic-.*\.html$/,
        /^validation-.*\.html$/,
        /^correcao-.*\.html$/
    ];
    
    return debugPatterns.some(pattern => pattern.test(path.basename(filePath)));
}

// Identificar scripts temporários vazios ou de configuração
async function isEmptyOrConfigScript(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        const size = content.trim().length;
        
        // Scripts vazios ou muito pequenos
        if (size < 50) return true;
        
        // Scripts de configuração temporária
        const tempPatterns = [
            /configurar-.*\.(ps1|sh)$/,
            /limpar-.*\.ps1$/,
            /deploy-trigger\.js$/,
            /fix-bandas-direto\.js$/,
            /debug-server\.js$/,
            /correcao-emergencia\.js$/
        ];
        
        return tempPatterns.some(pattern => pattern.test(path.basename(filePath)));
    } catch (error) {
        return false;
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Análise principal
async function main() {
    try {
        console.log('🧹 ANÁLISE DE LIMPEZA INTELIGENTE\n');
        console.log('Focando apenas em documentação e arquivos temporários...\n');
        
        const analysis = await analyzeDocumentationFiles();
        
        // Separar por categorias mais específicas
        const safeForRemoval = [];
        const needsReview = [];
        
        // 1. Arquivos de documentação (sempre seguros)
        for (const doc of analysis.documentationFiles) {
            safeForRemoval.push({
                ...doc,
                category: 'Documentação',
                reason: 'Arquivo de documentação/relatório de processo'
            });
        }
        
        // 2. Arquivos HTML de debug
        for (const filePath of analysis.otherFiles) {
            if (isDebugHtmlFile(filePath)) {
                const stats = fssync.statSync(path.join(projectRoot, filePath));
                safeForRemoval.push({
                    path: filePath,
                    size: stats.size,
                    lastModified: stats.mtime.toISOString().split('T')[0],
                    type: '.html',
                    category: 'Debug HTML',
                    reason: 'Arquivo HTML de debug/diagnóstico'
                });
            }
        }
        
        // 3. Scripts temporários
        for (const filePath of analysis.otherFiles) {
            const fullPath = path.join(projectRoot, filePath);
            if (await isEmptyOrConfigScript(fullPath)) {
                const stats = fssync.statSync(fullPath);
                safeForRemoval.push({
                    path: filePath,
                    size: stats.size,
                    lastModified: stats.mtime.toISOString().split('T')[0],
                    type: path.extname(filePath) || 'no-ext',
                    category: 'Script Temporário',
                    reason: 'Script de configuração temporária ou vazio'
                });
            }
        }
        
        // 4. Arquivos de texto temporários
        for (const filePath of analysis.otherFiles) {
            const fileName = path.basename(filePath);
            const tempTextPatterns = [
                /^builder-.*\.txt$/,
                /^calibration-.*\.txt$/,
                /^cache-.*\.txt$/,
                /.*-report.*\.txt$/
            ];
            
            if (tempTextPatterns.some(p => p.test(fileName))) {
                const stats = fssync.statSync(path.join(projectRoot, filePath));
                safeForRemoval.push({
                    path: filePath,
                    size: stats.size,
                    lastModified: stats.mtime.toISOString().split('T')[0],
                    type: '.txt',
                    category: 'Arquivo Temporário',
                    reason: 'Arquivo de texto temporário/cache'
                });
            }
        }
        
        // Gerar relatório
        const totalSize = safeForRemoval.reduce((sum, file) => sum + file.size, 0);
        
        let report = `# 🧹 Relatório de Limpeza Inteligente\n\n`;
        report += `**Data:** ${new Date().toLocaleDateString('pt-BR')}\n`;
        report += `**Análise:** Arquivos de documentação e temporários seguros para remoção\n\n`;
        
        report += `## 📊 Resumo\n\n`;
        report += `- **Arquivos seguros para remoção:** ${safeForRemoval.length}\n`;
        report += `- **Espaço a ser liberado:** ${formatBytes(totalSize)}\n`;
        report += `- **Arquivos funcionais preservados:** ${analysis.functionalFiles.length}\n\n`;
        
        // Por categoria
        const byCategory = {};
        safeForRemoval.forEach(file => {
            if (!byCategory[file.category]) byCategory[file.category] = [];
            byCategory[file.category].push(file);
        });
        
        report += `## 📂 Arquivos por Categoria\n\n`;
        for (const [category, files] of Object.entries(byCategory)) {
            const categorySize = files.reduce((sum, f) => sum + f.size, 0);
            report += `### ${category} (${files.length} arquivos - ${formatBytes(categorySize)})\n\n`;
            report += `| Arquivo | Tamanho | Última Modificação |\n`;
            report += `|---------|---------|-------------------|\n`;
            
            files.sort((a, b) => b.size - a.size).forEach(file => {
                report += `| \`${file.path}\` | ${formatBytes(file.size)} | ${file.lastModified} |\n`;
            });
            report += `\n`;
        }
        
        // Lista completa
        report += `## 📋 Lista Completa para Remoção\n\n`;
        report += `| Arquivo | Categoria | Tamanho | Motivo |\n`;
        report += `|---------|-----------|---------|--------|\n`;
        
        safeForRemoval.sort((a, b) => b.size - a.size).forEach(file => {
            report += `| \`${file.path}\` | ${file.category} | ${formatBytes(file.size)} | ${file.reason} |\n`;
        });
        
        // Gerar script de remoção
        let script = `# Script de Limpeza Inteligente\n`;
        script += `# Remove apenas documentação e arquivos temporários\n`;
        script += `# Data: ${new Date().toISOString()}\n\n`;
        
        script += `Write-Host "🧹 Iniciando limpeza inteligente..."\n`;
        script += `Write-Host "📁 Arquivos a remover: ${safeForRemoval.length}"\n`;
        script += `Write-Host "💾 Espaço a liberar: ${formatBytes(totalSize)}"\n\n`;
        
        script += `# Confirmar antes de prosseguir\n`;
        script += `$confirm = Read-Host "Deseja continuar? (s/N)"\n`;
        script += `if ($confirm -ne "s" -and $confirm -ne "S") {\n`;
        script += `    Write-Host "❌ Operação cancelada"\n`;
        script += `    exit 0\n`;
        script += `}\n\n`;
        
        script += `$removedCount = 0\n`;
        script += `$removedSize = 0\n\n`;
        
        for (const file of safeForRemoval) {
            script += `# ${file.category}: ${file.path}\n`;
            script += `if (Test-Path "${file.path}") {\n`;
            script += `    $fileSize = (Get-Item "${file.path}").Length\n`;
            script += `    Remove-Item "${file.path}" -Force\n`;
            script += `    Write-Host "✅ Removido: ${file.path} ($(($fileSize/1KB).ToString('F1')) KB)"\n`;
            script += `    $removedCount++\n`;
            script += `    $removedSize += $fileSize\n`;
            script += `} else {\n`;
            script += `    Write-Host "⚠️ Não encontrado: ${file.path}"\n`;
            script += `}\n\n`;
        }
        
        script += `Write-Host "🎉 Limpeza concluída!"\n`;
        script += `Write-Host "📁 Arquivos removidos: $removedCount"\n`;
        script += `Write-Host "💾 Espaço liberado: $(($removedSize/1MB).ToString('F1')) MB"\n`;
        
        // Salvar arquivos
        const auditDir = path.join(projectRoot, 'audit');
        await fs.writeFile(path.join(auditDir, 'intelligent_cleanup_report.md'), report);
        await fs.writeFile(path.join(auditDir, 'intelligent_cleanup_script.ps1'), script);
        
        console.log('📊 LIMPEZA INTELIGENTE - RELATÓRIO FINAL');
        console.log('========================================');
        console.log(`✅ Arquivos seguros: ${safeForRemoval.length}`);
        console.log(`💾 Espaço a liberar: ${formatBytes(totalSize)}`);
        console.log(`🛡️ Funcionais preservados: ${analysis.functionalFiles.length}`);
        console.log(`📄 Relatório: audit/intelligent_cleanup_report.md`);
        console.log(`🔧 Script: audit/intelligent_cleanup_script.ps1`);
        console.log('========================================\n');
        
        // Resumo por categoria
        console.log('📂 RESUMO POR CATEGORIA:');
        for (const [category, files] of Object.entries(byCategory)) {
            const categorySize = files.reduce((sum, f) => sum + f.size, 0);
            console.log(`   ${category}: ${files.length} arquivos (${formatBytes(categorySize)})`);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

main();
