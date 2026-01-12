// scripts/test-cleanup-logic.js
// 🧪 TESTE UNITÁRIO DA LÓGICA DE DECISÃO
// Valida a função shouldKeepUser() sem conectar ao Firebase

// ========================================
// 📋 CASOS DE TESTE
// ========================================

const testCases = [
  {
    name: 'DJ válido com expiração futura',
    firestoreDoc: {
      exists: true,
      data: () => ({
        plan: 'dj',
        djExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30 dias
      }),
    },
    expected: { shouldKeep: true, reason: 'DJ_VALID' },
  },
  {
    name: 'DJ vitalício (sem expiração)',
    firestoreDoc: {
      exists: true,
      data: () => ({
        plan: 'dj',
        djExpiresAt: null,
      }),
    },
    expected: { shouldKeep: true, reason: 'DJ_NO_EXPIRATION' },
  },
  {
    name: 'DJ vitalício (sem campo djExpiresAt)',
    firestoreDoc: {
      exists: true,
      data: () => ({
        plan: 'dj',
      }),
    },
    expected: { shouldKeep: true, reason: 'DJ_NO_EXPIRATION' },
  },
  {
    name: 'DJ expirado',
    firestoreDoc: {
      exists: true,
      data: () => ({
        plan: 'dj',
        djExpiresAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // -30 dias
      }),
    },
    expected: { shouldKeep: false, reason: 'DJ_EXPIRED' },
  },
  {
    name: 'Plano Free',
    firestoreDoc: {
      exists: true,
      data: () => ({
        plan: 'free',
      }),
    },
    expected: { shouldKeep: false, reason: 'PLAN_FREE' },
  },
  {
    name: 'Plano Plus',
    firestoreDoc: {
      exists: true,
      data: () => ({
        plan: 'plus',
      }),
    },
    expected: { shouldKeep: false, reason: 'PLAN_PLUS' },
  },
  {
    name: 'Plano Pro',
    firestoreDoc: {
      exists: true,
      data: () => ({
        plan: 'pro',
      }),
    },
    expected: { shouldKeep: false, reason: 'PLAN_PRO' },
  },
  {
    name: 'Plano Studio',
    firestoreDoc: {
      exists: true,
      data: () => ({
        plan: 'studio',
      }),
    },
    expected: { shouldKeep: false, reason: 'PLAN_STUDIO' },
  },
  {
    name: 'Sem documento no Firestore',
    firestoreDoc: null,
    expected: { shouldKeep: false, reason: 'NO_FIRESTORE_DOC' },
  },
  {
    name: 'Documento vazio (sem plano)',
    firestoreDoc: {
      exists: true,
      data: () => ({}),
    },
    expected: { shouldKeep: false, reason: 'PLAN_NULL' },
  },
  {
    name: 'Plano em maiúsculas (DJ)',
    firestoreDoc: {
      exists: true,
      data: () => ({
        plan: 'DJ',
      }),
    },
    expected: { shouldKeep: true, reason: 'DJ_NO_EXPIRATION' },
  },
  {
    name: 'Plano em maiúsculas (FREE)',
    firestoreDoc: {
      exists: true,
      data: () => ({
        plan: 'FREE',
      }),
    },
    expected: { shouldKeep: false, reason: 'PLAN_FREE' },
  },
];

// ========================================
// 🔍 FUNÇÃO DE DECISÃO (CÓPIA DO SCRIPT)
// ========================================

function shouldKeepUser(firestoreDoc, uid) {
  // Caso 1: Sem documento no Firestore → Considerar usuário de teste
  if (!firestoreDoc || !firestoreDoc.exists) {
    return {
      shouldKeep: false,
      reason: 'NO_FIRESTORE_DOC',
    };
  }

  const data = firestoreDoc.data();
  const plan = data.plan?.toLowerCase();

  // Caso 2: Plano não é DJ → APAGAR
  if (plan !== 'dj') {
    return {
      shouldKeep: false,
      reason: `PLAN_${(plan || 'null').toUpperCase()}`,
    };
  }

  // Caso 3: Plano DJ com expiração
  if (data.djExpiresAt) {
    const expiresAt = new Date(data.djExpiresAt).getTime();
    const now = Date.now();

    // Se já expirou, apagar
    if (now > expiresAt) {
      return {
        shouldKeep: false,
        reason: 'DJ_EXPIRED',
        details: `Expirou em ${new Date(expiresAt).toISOString()}`,
      };
    }

    // Ainda não expirou, manter
    return {
      shouldKeep: true,
      reason: 'DJ_VALID',
      details: `Expira em ${new Date(expiresAt).toISOString()}`,
    };
  }

  // Caso 4: Plano DJ sem data de expiração → MANTER (pode ser vitalício)
  return {
    shouldKeep: true,
    reason: 'DJ_NO_EXPIRATION',
    details: 'DJ sem expiração (vitalício)',
  };
}

// ========================================
// 🧪 EXECUTAR TESTES
// ========================================

function runTests() {
  console.log('========================================');
  console.log('🧪 TESTES DE LÓGICA DE DECISÃO');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  testCases.forEach((test, index) => {
    const result = shouldKeepUser(test.firestoreDoc, `test-uid-${index}`);

    const isCorrect = 
      result.shouldKeep === test.expected.shouldKeep &&
      result.reason === test.expected.reason;

    if (isCorrect) {
      passed++;
      console.log(`✅ PASSOU: ${test.name}`);
      console.log(`   Resultado: shouldKeep=${result.shouldKeep}, reason=${result.reason}`);
    } else {
      failed++;
      console.log(`❌ FALHOU: ${test.name}`);
      console.log(`   Esperado: shouldKeep=${test.expected.shouldKeep}, reason=${test.expected.reason}`);
      console.log(`   Recebido: shouldKeep=${result.shouldKeep}, reason=${result.reason}`);
    }
    console.log('');
  });

  console.log('========================================');
  console.log('📊 RESULTADO DOS TESTES');
  console.log('========================================');
  console.log(`Total: ${testCases.length}`);
  console.log(`✅ Passou: ${passed}`);
  console.log(`❌ Falhou: ${failed}`);
  console.log('========================================\n');

  if (failed === 0) {
    console.log('✅ TODOS OS TESTES PASSARAM! Script está seguro para uso.\n');
    process.exit(0);
  } else {
    console.error('❌ ALGUNS TESTES FALHARAM! NÃO execute o script de limpeza.\n');
    process.exit(1);
  }
}

// ========================================
// 🎬 EXECUTAR
// ========================================

runTests();
