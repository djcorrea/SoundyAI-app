// work/config/environment.js
// ✅ CONFIGURAÇÃO CENTRALIZADA DE AMBIENTE
// Sistema unificado para detectar ambiente e configurar CORS/features

// 🛡️ PROTEÇÃO: Log de inicialização para debug
console.log('🌍 [ENV-CONFIG] Carregando módulo environment.js...');
console.log('🌍 [ENV-CONFIG] __dirname:', import.meta.url);

/**
 * Detecta o ambiente atual com base em variáveis do Railway e NODE_ENV
 * @returns {'production' | 'test' | 'development'}
 */
export function detectEnvironment() {
  try {
    // 1️⃣ RAILWAY_ENVIRONMENT: Variável do Railway que indica o ambiente
    const railwayEnv = process.env.RAILWAY_ENVIRONMENT;
    
    if (railwayEnv === 'production') {
      return 'production';
    }
    
    if (railwayEnv === 'test') {
      return 'test';
    }
    
    // 2️⃣ NODE_ENV: Fallback padrão
    const nodeEnv = process.env.NODE_ENV;
    
    if (nodeEnv === 'production') {
      return 'production';
    }
    
    if (nodeEnv === 'test') {
      return 'test';
    }
    
    // 3️⃣ APP_ENV: Alternativa customizada
    const appEnv = process.env.APP_ENV;
    
    if (appEnv === 'production') {
      return 'production';
    }
    
    if (appEnv === 'test') {
      return 'test';
    }
    
    // Default: development
    return 'development';
  } catch (error) {
    console.error('⚠️ [ENV-CONFIG] Erro ao detectar ambiente:', error.message);
    return 'development';
  }
}

/**
 * Retorna lista de origens permitidas baseado no ambiente
 * @param {string} env - Ambiente detectado
 * @returns {string[]} Lista de origens permitidas
 */
export function getAllowedOrigins(env = detectEnvironment()) {
  // Origens base para todos os ambientes
  const baseOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:3001',
    'http://127.0.0.1:3000'
  ];
  
  // PRODUÇÃO: Domínio principal + Railway prod + Frontend TESTE
  if (env === 'production') {
    return [
      ...baseOrigins,
      // Produção
      'https://soundyai.com.br',
      'https://www.soundyai.com.br',
      'https://soundyai-app-production.up.railway.app',
      
      // ✅ Frontend TESTE (chama backend de produção)
      'https://soundyai-teste.vercel.app',
      'https://soundyai-app-soundyai-teste.up.railway.app'
    ];
  }
  
  // TESTE: Domínio de teste do Railway
  if (env === 'test') {
    return [
      ...baseOrigins,
      'https://soundyai-app-soundyai-teste.up.railway.app',
      'https://soundyai-teste.vercel.app',
      // Permitir também produção para facilitar testes cruzados
      'https://soundyai.com.br',
      'https://www.soundyai.com.br',
      'https://soundyai-app-production.up.railway.app'
    ];
  }
  
  // DEVELOPMENT: Permitir tudo localmente
  return [
    ...baseOrigins,
    'https://soundyai-app-soundyai-teste.up.railway.app',
    'https://soundyai-teste.vercel.app',
    'https://soundyai-app-production.up.railway.app',
    'https://soundyai.com.br',
    'https://www.soundyai.com.br'
  ];
}

/**
 * Verifica se uma origem é permitida
 * @param {string} origin - Origem a verificar
 * @param {string} env - Ambiente (opcional, detecta automaticamente)
 * @returns {boolean}
 */
export function isOriginAllowed(origin, env = detectEnvironment()) {
  if (!origin) {
    // Permitir requisições sem origin (mobile apps, Postman, etc)
    return true;
  }
  
  const allowedOrigins = getAllowedOrigins(env);
  
  // Verificar match exato ou startsWith (para suportar subdomínios)
  const isAllowed = allowedOrigins.some(allowed => 
    origin === allowed || origin.startsWith(allowed)
  );
  
  // Verificar localhost com regex (para suportar portas dinâmicas)
  const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  
  return isAllowed || isLocalhost;
}

/**
 * Configuração de CORS para Express
 * @param {string} env - Ambiente (opcional)
 * @returns {Object} Configuração do cors()
 */
export function getCorsConfig(env = detectEnvironment()) {
  return {
    origin: function(origin, callback) {
      // Log detalhado para debugging
      console.log('🔍 [CORS] ═══════════════════════════════════════');
      console.log('🔍 [CORS] Validando origem:');
      console.log('🔍 [CORS]   Origin:', origin || 'undefined');
      console.log('🔍 [CORS]   Ambiente Backend:', env);
      
      // 🧪 Origens de TESTE
      const testOrigins = [
        'https://soundyai-teste.vercel.app',
        'https://soundyai-app-soundyai-teste.up.railway.app'
      ];
      
      // 🚀 Origens de PRODUÇÃO
      const prodOrigins = [
        'https://soundyai.com.br',
        'https://www.soundyai.com.br',
        'https://soundyai-app-production.up.railway.app'
      ];
      
      const isTestOrigin = origin && testOrigins.some(testOrigin => origin.includes(testOrigin));
      const isProdOrigin = origin && prodOrigins.some(prodOrigin => origin.includes(prodOrigin));
      
      // 🧪 Ambiente TEST: Permitir apenas origens de teste
      if (env === 'test') {
        if (isTestOrigin) {
          console.log('✅ [CORS] PERMITIDO (test env → test origin)');
          console.log('🔍 [CORS] ═══════════════════════════════════════');
          callback(null, true);
        } else if (isProdOrigin) {
          console.warn('🚫 [CORS] BLOQUEADO (test env → prod origin não permitido)');
          console.log('🔍 [CORS] ═══════════════════════════════════════');
          callback(new Error('Test environment: production origins not allowed'));
        } else if (isOriginAllowed(origin, env)) {
          console.log('✅ [CORS] PERMITIDO (fallback: localhost/dev)');
          console.log('🔍 [CORS] ═══════════════════════════════════════');
          callback(null, true);
        } else {
          console.warn('🚫 [CORS] BLOQUEADO (origem desconhecida)');
          console.log('🔍 [CORS] ═══════════════════════════════════════');
          callback(new Error('Not allowed by CORS'));
        }
        return;
      }
      
      // 🚀 Ambiente PRODUCTION: Permitir prod + test (para compatibilidade)
      if (env === 'production') {
        if (isProdOrigin || isTestOrigin) {
          console.log(`✅ [CORS] PERMITIDO (${isProdOrigin ? 'prod' : 'test'} origin)`);
          console.log('🔍 [CORS] ═══════════════════════════════════════');
          callback(null, true);
        } else if (isOriginAllowed(origin, env)) {
          console.log('✅ [CORS] PERMITIDO (fallback: localhost/dev)');
          console.log('🔍 [CORS] ═══════════════════════════════════════');
          callback(null, true);
        } else {
          console.warn('🚫 [CORS] BLOQUEADO (origem desconhecida)');
          console.log('🔍 [CORS] ═══════════════════════════════════════');
          callback(new Error('Not allowed by CORS'));
        }
        return;
      }
      
      // 🔧 Ambiente DEVELOPMENT: Permitir tudo
      if (isOriginAllowed(origin, env)) {
        console.log('✅ [CORS] PERMITIDO (dev environment)');
        console.log('🔍 [CORS] ═══════════════════════════════════════');
        callback(null, true);
      } else {
        console.warn('🚫 [CORS] BLOQUEADO');
        console.log('🔍 [CORS] ═══════════════════════════════════════');
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Feature'],
    credentials: true
  };
}

/**
 * Configuração de features por ambiente
 * @param {string} env - Ambiente
 * @returns {Object} Features ativas
 */
export function getEnvironmentFeatures(env = detectEnvironment()) {
  return {
    // Ambiente atual
    environment: env,
    isProduction: env === 'production',
    isTest: env === 'test',
    isDevelopment: env === 'development',
    
    // Features de teste
    features: {
      // ❌ DESABILITADO: NÃO promover usuários para PRO automaticamente
      // Usuários FREE devem permanecer FREE até upgrade via pagamento
      autoGrantProPlan: false, // ✅ CORRIGIDO: era env === 'test' || env === 'development'
      
      // Logs detalhados em não-produção
      verboseLogs: env !== 'production',
      
      // Rate limiting mais permissivo em teste
      relaxedRateLimit: env === 'test' || env === 'development',
      
      // Cache desabilitado em desenvolvimento
      enableCache: env === 'production'
    }
  };
}

// Log da configuração ao carregar
const currentEnv = detectEnvironment();
console.log('🌍 [ENV-CONFIG] Ambiente detectado:', currentEnv);
console.log('🌍 [ENV-CONFIG] RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
console.log('🌍 [ENV-CONFIG] NODE_ENV:', process.env.NODE_ENV);
console.log('🌍 [ENV-CONFIG] Origens permitidas:', getAllowedOrigins(currentEnv));
console.log('🌍 [ENV-CONFIG] Features:', getEnvironmentFeatures(currentEnv));
