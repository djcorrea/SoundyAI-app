#!/usr/bin/env node

/**
 * Script rápido para criar o parceiro `privbyg` no Firestore.
 * Uso (no backend):
 *   node scripts/create-partner-privbyg.js
 *
 * NÃO executar no frontend. Exige que a variável FIREBASE_SERVICE_ACCOUNT
 * esteja configurada no ambiente (mesma configuração do servidor).
 */

import { getFirestore } from '../work/firebase/admin.js';

const db = getFirestore();

async function run() {
  const partnerId = 'privbyg';
  const partnerDoc = {
    partnerId: partnerId,
    name: 'Privbyg',
    referralCode: 'privbyg',
    email: 'privbyg@example.com',
    commissionPercent: 30,
    active: true,
    description: 'Parceiro Privbyg',
    website: null,
    tier: 'standard',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalEarnings: 0
  };

  console.log(`📝 criando parceiro: ${partnerId}`);
  try {
    await db.collection('partners').doc(partnerId).set(partnerDoc);
    console.log('✅ parceiro criado com sucesso');
  } catch (err) {
    console.error('❌ erro ao criar parceiro:', err);
    process.exit(1);
  }

  process.exit(0);
}

run();
