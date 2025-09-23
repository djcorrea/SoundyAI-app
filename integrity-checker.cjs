#!/usr/bin/env node

/**
 * 🔍 VERIFICADOR DE INTEGRIDADE - Sistema de Sugestões IA
 * 
 * Este script verifica se todos os arquivos e dependências 
 * do sistema de sugestões IA estão corretos e funcionando.
 */

const fs = require('fs');
const path = require('path');

class IntegrityChecker {
    constructor() {
        this.results = {
            files: {},
            dependencies: {},
            content: {},
            errors: [],
            warnings: []
        };
        
        this.baseDir = process.cwd();
        console.log('🔍 Verificador de Integridade - Sistema IA');
        console.log(`📁 Diretório base: ${this.baseDir}`);
        console.log('=' .repeat(60));
    }
    
    log(type, message) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        console.log(`${icons[type]} ${message}`);
        
        if (type === 'error') {
            this.results.errors.push(message);
        } else if (type === 'warning') {
            this.results.warnings.push(message);
        }
    }
    
    checkFile(relativePath, description) {
        const fullPath = path.join(this.baseDir, relativePath);
        const exists = fs.existsSync(fullPath);
        
        this.results.files[relativePath] = {
            exists,
            description,
            size: exists ? fs.statSync(fullPath).size : 0
        };
        
        if (exists) {
            this.log('success', `${description}: ${relativePath} (${this.results.files[relativePath].size} bytes)`);
        } else {
            this.log('error', `${description}: ${relativePath} NÃO ENCONTRADO`);
        }
        
        return exists;
    }
    
    checkFileContent(relativePath, searchStrings, description) {
        const fullPath = path.join(this.baseDir, relativePath);
        
        if (!fs.existsSync(fullPath)) {
            this.log('error', `Arquivo ${relativePath} não existe para verificação de conteúdo`);
            return false;
        }
        
        try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const foundStrings = [];
            const missingStrings = [];
            
            searchStrings.forEach(searchString => {
                if (content.includes(searchString)) {
                    foundStrings.push(searchString);
                } else {
                    missingStrings.push(searchString);
                }
            });
            
            this.results.content[relativePath] = {
                description,
                found: foundStrings,
                missing: missingStrings,
                totalLines: content.split('\n').length
            };
            
            if (missingStrings.length === 0) {
                this.log('success', `${description}: Todos os elementos encontrados`);
            } else {
                this.log('warning', `${description}: ${missingStrings.length} elemento(s) ausente(s)`);
                missingStrings.forEach(missing => {
                    this.log('warning', `  - Ausente: "${missing}"`);
                });
            }
            
            return missingStrings.length === 0;
        } catch (error) {
            this.log('error', `Erro ao ler ${relativePath}: ${error.message}`);
            return false;
        }
    }
    
    checkNodeDependencies() {
        this.log('info', '\n📦 Verificando dependências Node.js...');
        
        const packageJsonPath = path.join(this.baseDir, 'api', 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            this.log('error', 'package.json não encontrado em /api/');
            return false;
        }
        
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const requiredDeps = ['express', 'cors', 'node-fetch'];
            
            requiredDeps.forEach(dep => {
                const hasDepInDeps = packageJson.dependencies && packageJson.dependencies[dep];
                const hasDepInDevDeps = packageJson.devDependencies && packageJson.devDependencies[dep];
                
                if (hasDepInDeps || hasDepInDevDeps) {
                    const version = hasDepInDeps || hasDepInDevDeps;
                    this.log('success', `Dependência ${dep}: ${version}`);
                    this.results.dependencies[dep] = { exists: true, version };
                } else {
                    this.log('error', `Dependência ${dep}: NÃO ENCONTRADA`);
                    this.results.dependencies[dep] = { exists: false };
                }
            });
            
            return true;
        } catch (error) {
            this.log('error', `Erro ao ler package.json: ${error.message}`);
            return false;
        }
    }
    
    checkIntegrationCompatibility() {
        this.log('info', '\n🔗 Verificando compatibilidade de integração...');
        
        // Check if index.html has all required script includes
        const indexPath = path.join(this.baseDir, 'public', 'index.html');
        if (fs.existsSync(indexPath)) {
            const content = fs.readFileSync(indexPath, 'utf8');
            const requiredIncludes = [
                'ai-suggestions-expanded.css',
                'ai-suggestions-integration.js',
                'id="aiSuggestionsExpanded"'
            ];
            
            requiredIncludes.forEach(include => {
                if (content.includes(include)) {
                    this.log('success', `index.html contém: ${include}`);
                } else {
                    this.log('error', `index.html NÃO contém: ${include}`);
                }
            });
        }
    }
    
    generateReport() {
        this.log('info', '\n📊 Gerando relatório final...');
        
        const totalFiles = Object.keys(this.results.files).length;
        const existingFiles = Object.values(this.results.files).filter(f => f.exists).length;
        const totalDeps = Object.keys(this.results.dependencies).length;
        const existingDeps = Object.values(this.results.dependencies).filter(d => d.exists).length;
        
        console.log('\n' + '='.repeat(60));
        console.log('📈 RELATÓRIO FINAL DE INTEGRIDADE');
        console.log('='.repeat(60));
        
        console.log(`📁 Arquivos: ${existingFiles}/${totalFiles} encontrados`);
        console.log(`📦 Dependências: ${existingDeps}/${totalDeps} instaladas`);
        console.log(`❌ Erros: ${this.results.errors.length}`);
        console.log(`⚠️ Avisos: ${this.results.warnings.length}`);
        
        if (this.results.errors.length === 0) {
            console.log('\n🎉 SISTEMA ÍNTEGRO - Pronto para uso!');
        } else {
            console.log('\n🚨 PROBLEMAS DETECTADOS:');
            this.results.errors.forEach(error => {
                console.log(`   ❌ ${error}`);
            });
        }
        
        if (this.results.warnings.length > 0) {
            console.log('\n⚠️ AVISOS:');
            this.results.warnings.forEach(warning => {
                console.log(`   ⚠️ ${warning}`);
            });
        }
        
        console.log('\n📋 PRÓXIMOS PASSOS:');
        if (this.results.errors.length === 0) {
            console.log('   1. ✅ Execute: node api/server.js');
            console.log('   2. ✅ Acesse: http://localhost:3000/test-ai-suggestions-system.html');
            console.log('   3. ✅ Execute teste completo');
        } else {
            console.log('   1. 🔧 Corrija os erros listados acima');
            console.log('   2. 🔄 Execute este verificador novamente');
            console.log('   3. 📋 Repita até não haver erros');
        }
        
        return this.results.errors.length === 0;
    }
    
    async run() {
        console.log('🚀 Iniciando verificação...\n');
        
        // 1. Check core files
        this.log('info', '📁 Verificando arquivos principais...');
        this.checkFile('api/server.js', 'Servidor back-end');
        this.checkFile('public/ai-suggestions-expanded.css', 'Estilos CSS');
        this.checkFile('public/ai-suggestions-integration.js', 'Integração JavaScript');
        this.checkFile('public/index.html', 'Página principal');
        this.checkFile('public/test-ai-suggestions-system.html', 'Página de teste');
        
        // 2. Check file contents
        this.log('info', '\n🔍 Verificando conteúdo dos arquivos...');
        
        this.checkFileContent('api/server.js', [
            '/api/suggestions',
            'buildSuggestionPrompt',
            'processAIResponse',
            'node-fetch'
        ], 'Back-end API');
        
        this.checkFileContent('public/ai-suggestions-expanded.css', [
            '.ai-suggestions-expanded',
            '.ai-suggestion-card',
            'backdrop-filter',
            'glassmorphism'
        ], 'Estilos CSS');
        
        this.checkFileContent('public/ai-suggestions-integration.js', [
            'AISuggestionsIntegration',
            'processWithAI',
            'displaySuggestions',
            'integrateWithExistingSystem'
        ], 'Integração JavaScript');
        
        this.checkFileContent('public/index.html', [
            'ai-suggestions-expanded.css',
            'ai-suggestions-integration.js',
            'aiSuggestionsExpanded'
        ], 'HTML principal');
        
        // 3. Check dependencies
        this.checkNodeDependencies();
        
        // 4. Check integration
        this.checkIntegrationCompatibility();
        
        // 5. Generate final report
        const isHealthy = this.generateReport();
        
        process.exit(isHealthy ? 0 : 1);
    }
}

// Execute if called directly
if (require.main === module) {
    const checker = new IntegrityChecker();
    checker.run().catch(error => {
        console.error('❌ Erro fatal na verificação:', error);
        process.exit(1);
    });
}

module.exports = IntegrityChecker;