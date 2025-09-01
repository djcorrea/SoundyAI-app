// 🔧 CACHE FUNCTIONS STANDALONE - Versão isolada para testes
console.log('🔧 Iniciando carregamento das funções de cache...');

// Verificar se estamos no navegador
if (typeof window === 'undefined') {
  console.error('❌ Não está no navegador, window não disponível');
} else {
  console.log('✅ Window disponível, definindo funções...');
  
  try {
    // 1. Invalidação manual de cache
    window.invalidateAudioAnalysisCache = function() {
      console.log('🧹 Executando invalidateAudioAnalysisCache...');
      try {
        const map = window.__AUDIO_ANALYSIS_CACHE__;
        let size = 0;
        if (map && typeof map.clear === 'function') {
          size = map.size || 0;
          map.clear();
        }
        console.log(`Cache limpo: ${size} entradas removidas`);
        return { cleared: size };
      } catch(e) {
        console.error('Erro ao limpar cache:', e);
        return { cleared: 0, error: e.message };
      }
    };
    console.log('✅ invalidateAudioAnalysisCache definida');
    
    // 2. Invalidação por mudanças
    window.invalidateCacheByChange = function(changeType, oldValue, newValue) {
      console.log(`🔄 Executando invalidateCacheByChange: ${changeType} ${oldValue} -> ${newValue}`);
      try {
        const map = window.__AUDIO_ANALYSIS_CACHE__;
        if (!map || typeof map.delete !== 'function') {
          return { cleared: 0 };
        }
        
        let cleared = 0;
        for (const [key] of map.entries()) {
          let shouldInvalidate = false;
          
          if (changeType === 'genre' && key.includes(`${oldValue}:`)) {
            shouldInvalidate = true;
          } else if (changeType === 'refsVersion' && key.includes(`:${oldValue}`)) {
            shouldInvalidate = true;
          } else if (changeType === 'all') {
            shouldInvalidate = true;
          }
          
          if (shouldInvalidate) {
            map.delete(key);
            cleared++;
          }
        }
        
        console.log(`Cache invalidado: ${cleared} entradas removidas por ${changeType} change`);
        return { cleared };
      } catch(e) {
        console.error('Erro na invalidação por mudança:', e);
        return { cleared: 0, error: e.message };
      }
    };
    console.log('✅ invalidateCacheByChange definida');
    
    // 3. Monitor de mudanças
    window._cacheChangeMonitor = {
      lastGenre: window.PROD_AI_REF_GENRE,
      lastRefsVersion: window.EMBEDDED_REFS_VERSION,
      
      checkAndInvalidate() {
        console.log('🔍 Verificando mudanças...');
        const currentGenre = window.PROD_AI_REF_GENRE;
        const currentRefsVersion = window.EMBEDDED_REFS_VERSION;
        
        if (this.lastGenre && this.lastGenre !== currentGenre) {
          console.log(`Gênero mudou: ${this.lastGenre} -> ${currentGenre}`);
          window.invalidateCacheByChange?.('genre', this.lastGenre, currentGenre);
        }
        
        if (this.lastRefsVersion && this.lastRefsVersion !== currentRefsVersion) {
          console.log(`Refs mudaram: ${this.lastRefsVersion} -> ${currentRefsVersion}`);
          window.invalidateCacheByChange?.('refsVersion', this.lastRefsVersion, currentRefsVersion);
        }
        
        this.lastGenre = currentGenre;
        this.lastRefsVersion = currentRefsVersion;
      }
    };
    console.log('✅ _cacheChangeMonitor definido');
    
    // Feature flag
    if (window.NEW_CACHE_KEY === undefined) {
      window.NEW_CACHE_KEY = window.location.hostname !== 'prod.ai';
      console.log(`🚩 NEW_CACHE_KEY definido: ${window.NEW_CACHE_KEY}`);
    }
    
    console.log('🎉 Todas as funções de cache foram definidas com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro fatal ao definir funções:', error);
  }
}

// Função de teste para verificar se tudo funciona
function testCacheFunctions() {
  console.log('🧪 Testando funções de cache...');
  
  const tests = [
    'invalidateAudioAnalysisCache',
    'invalidateCacheByChange',
    '_cacheChangeMonitor'
  ];
  
  tests.forEach(fn => {
    if (window[fn]) {
      console.log(`✅ ${fn}: disponível (${typeof window[fn]})`);
    } else {
      console.log(`❌ ${fn}: não encontrada`);
    }
  });
  
  return tests.map(fn => ({
    name: fn,
    available: !!window[fn],
    type: typeof window[fn]
  }));
}

// Disponibilizar função de teste globalmente
window.testCacheFunctions = testCacheFunctions;

console.log('🔧 Cache functions standalone carregado. Use testCacheFunctions() para testar.');
