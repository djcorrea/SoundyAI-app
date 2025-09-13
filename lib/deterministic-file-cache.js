/**
 * Sistema de Cache Determinístico por Hash de Arquivo
 * Garante que o mesmo arquivo sempre retorne exatamente os mesmos resultados
 * Resolve o problema de análises diferentes para a mesma música
 */

class DeterministicFileCache {
    constructor() {
        this.cacheKey = 'SOUNDYAI_DETERMINISTIC_CACHE_V1';
        this.maxCacheSize = 100; // Máximo 100 análises em cache
        this.cache = this.loadCache();
        
        console.log(`🔐 [DETERMINISTIC_CACHE] Inicializado com ${Object.keys(this.cache).length} análises em cache`);
    }

    /**
     * Gera hash SHA-256 do arquivo para usar como chave única
     */
    async generateFileHash(file) {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        console.log(`🔑 [DETERMINISTIC_CACHE] Hash gerado para ${file.name}: ${hashHex.substring(0, 16)}...`);
        return hashHex;
    }

    /**
     * Verifica se já existe análise em cache para este arquivo
     */
    async hasAnalysis(file) {
        const hash = await this.generateFileHash(file);
        const exists = hash in this.cache;
        
        console.log(`🔍 [DETERMINISTIC_CACHE] Cache para ${file.name}: ${exists ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
        return exists;
    }

    /**
     * Recupera análise do cache
     */
    async getAnalysis(file) {
        const hash = await this.generateFileHash(file);
        const cached = this.cache[hash];
        
        if (cached) {
            console.log(`✅ [DETERMINISTIC_CACHE] Recuperando análise cached: ${file.name}`);
            console.log(`📊 [DETERMINISTIC_CACHE] Cached em: ${cached.timestamp}`);
            console.log(`🎯 [DETERMINISTIC_CACHE] Peak: ${cached.result.technicalData?.peak_db || 'N/A'}, LUFS: ${cached.result.technicalData?.lufs_integrated || 'N/A'}`);
            
            // Atualiza timestamp de último acesso
            cached.lastAccessed = new Date().toISOString();
            this.saveCache();
            
            return cached.result;
        }
        
        return null;
    }

    /**
     * Salva análise no cache
     */
    async saveAnalysis(file, analysisResult) {
        const hash = await this.generateFileHash(file);
        
        const cacheEntry = {
            hash: hash,
            filename: file.name,
            fileSize: file.size,
            timestamp: new Date().toISOString(),
            lastAccessed: new Date().toISOString(),
            result: analysisResult
        };
        
        this.cache[hash] = cacheEntry;
        this.cleanupCache();
        this.saveCache();
        
        console.log(`💾 [DETERMINISTIC_CACHE] Análise salva para ${file.name}`);
        console.log(`📊 [DETERMINISTIC_CACHE] Peak: ${analysisResult.technicalData?.peak_db || 'N/A'}, LUFS: ${analysisResult.technicalData?.lufs_integrated || 'N/A'}`);
    }

    /**
     * Remove entradas antigas se cache estiver muito grande
     */
    cleanupCache() {
        const entries = Object.entries(this.cache);
        
        if (entries.length > this.maxCacheSize) {
            // Ordena por último acesso e remove as mais antigas
            entries.sort((a, b) => new Date(a[1].lastAccessed) - new Date(b[1].lastAccessed));
            
            const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
            toRemove.forEach(([hash]) => {
                console.log(`🗑️ [DETERMINISTIC_CACHE] Removendo entrada antiga: ${this.cache[hash].filename}`);
                delete this.cache[hash];
            });
        }
    }

    /**
     * Carrega cache do localStorage
     */
    loadCache() {
        try {
            const stored = localStorage.getItem(this.cacheKey);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn(`⚠️ [DETERMINISTIC_CACHE] Erro ao carregar cache: ${error.message}`);
            return {};
        }
    }

    /**
     * Salva cache no localStorage
     */
    saveCache() {
        try {
            localStorage.setItem(this.cacheKey, JSON.stringify(this.cache));
            console.log(`💾 [DETERMINISTIC_CACHE] Cache salvo com ${Object.keys(this.cache).length} entradas`);
        } catch (error) {
            console.error(`❌ [DETERMINISTIC_CACHE] Erro ao salvar cache: ${error.message}`);
        }
    }

    /**
     * Limpa todo o cache
     */
    clearCache() {
        this.cache = {};
        localStorage.removeItem(this.cacheKey);
        console.log(`🧹 [DETERMINISTIC_CACHE] Cache limpo completamente`);
    }

    /**
     * Estatísticas do cache
     */
    getStats() {
        const entries = Object.values(this.cache);
        const totalSize = entries.reduce((sum, entry) => sum + (entry.fileSize || 0), 0);
        
        return {
            totalEntries: entries.length,
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => new Date(e.timestamp))) : null,
            newestEntry: entries.length > 0 ? Math.max(...entries.map(e => new Date(e.timestamp))) : null
        };
    }

    /**
     * Verifica integridade do arquivo comparando com cache
     */
    async verifyFileIntegrity(file) {
        const hash = await this.generateFileHash(file);
        const cached = this.cache[hash];
        
        if (cached) {
            const sizeMatch = cached.fileSize === file.size;
            const nameMatch = cached.filename === file.name;
            
            console.log(`🔐 [DETERMINISTIC_CACHE] Verificação de integridade:`);
            console.log(`   📏 Tamanho: ${sizeMatch ? 'MATCH' : 'DIFERENTE'} (${file.size} vs ${cached.fileSize})`);
            console.log(`   📝 Nome: ${nameMatch ? 'MATCH' : 'DIFERENTE'} (${file.name} vs ${cached.filename})`);
            
            return sizeMatch && nameMatch;
        }
        
        return true; // Não há cache para comparar
    }
}

// Instância global
window.deterministicFileCache = new DeterministicFileCache();

// API para debugging
window.debugDeterministicCache = {
    getStats: () => window.deterministicFileCache.getStats(),
    clearCache: () => window.deterministicFileCache.clearCache(),
    viewCache: () => window.deterministicFileCache.cache
};

console.log(`🔐 [DETERMINISTIC_CACHE] Sistema carregado - Execute debugDeterministicCache.getStats() para estatísticas`);