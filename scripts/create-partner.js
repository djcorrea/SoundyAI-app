#!/usr/bin/env node

/**
 * Script para criar parceiros no Firestore
 * 
 * Uso:
 *   node scripts/create-partner.js
 * 
 * ⚠️ IMPORTANTE: Rodar APENAS via backend (Node.js)
 * Nunca expor este script no frontend
 */

import { getFirestore } from '../firebase/admin.js';

const db = getFirestore();

/**
 * Criar novo parceiro no Firestore
 * @param {Object} partnerData - Dados do parceiro
 * @returns {Promise<void>}
 */
async function createPartner(partnerData) {
  const {
    partnerId,
    name,
    referralCode,
    email,
    commissionPercent,
    active = true,
    description = null,
    website = null,
    tier = null,
  } = partnerData;

  // Validações
  if (!partnerId || !name || !referralCode || !email || commissionPercent === undefined) {
    throw new Error('Campos obrigatórios: partnerId, name, referralCode, email, commissionPercent');
  }

  if (typeof commissionPercent !== 'number' || commissionPercent < 0 || commissionPercent > 100) {
    throw new Error('commissionPercent deve ser um número entre 0 e 100');
  }

  const now = new Date().toISOString();

  const partnerDoc = {
    partnerId,
    name,
    referralCode,
    email,
    commissionPercent,
    active,
    description,
    website,
    tier,
    createdAt: now,
    updatedAt: now,
  };

  console.log(`📝 [CREATE-PARTNER] Criando parceiro: ${partnerId}`);
  console.log(`   Nome: ${name}`);
  console.log(`   Código: ${referralCode}`);
  console.log(`   Email: ${email}`);
  console.log(`   Comissão: ${commissionPercent}%`);

  await db.collection('partners').doc(partnerId).set(partnerDoc);

  console.log(`✅ [CREATE-PARTNER] Parceiro criado com sucesso!`);
}

/**
 * Atualizar parceiro existente
 * @param {string} partnerId - ID do parceiro
 * @param {Object} updates - Campos a atualizar
 * @returns {Promise<void>}
 */
async function updatePartner(partnerId, updates) {
  console.log(`📝 [UPDATE-PARTNER] Atualizando parceiro: ${partnerId}`);

  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await db.collection('partners').doc(partnerId).update(updateData);

  console.log(`✅ [UPDATE-PARTNER] Parceiro atualizado!`);
}

/**
 * Desativar parceiro
 * @param {string} partnerId - ID do parceiro
 * @returns {Promise<void>}
 */
async function deactivatePartner(partnerId) {
  console.log(`⏸️ [DEACTIVATE-PARTNER] Desativando parceiro: ${partnerId}`);

  await db.collection('partners').doc(partnerId).update({
    active: false,
    updatedAt: new Date().toISOString(),
  });

  console.log(`✅ [DEACTIVATE-PARTNER] Parceiro desativado!`);
}

/**
 * Reativar parceiro
 * @param {string} partnerId - ID do parceiro
 * @returns {Promise<void>}
 */
async function activatePartner(partnerId) {
  console.log(`▶️ [ACTIVATE-PARTNER] Reativando parceiro: ${partnerId}`);

  await db.collection('partners').doc(partnerId).update({
    active: true,
    updatedAt: new Date().toISOString(),
  });

  console.log(`✅ [ACTIVATE-PARTNER] Parceiro reativado!`);
}

/**
 * Listar todos os parceiros
 * @returns {Promise<void>}
 */
async function listPartners() {
  console.log(`📋 [LIST-PARTNERS] Buscando todos os parceiros...\n`);

  const snapshot = await db.collection('partners').get();

  if (snapshot.empty) {
    console.log('⚠️ Nenhum parceiro cadastrado.');
    return;
  }

  console.log(`✅ Total de parceiros: ${snapshot.size}\n`);

  snapshot.forEach(doc => {
    const partner = doc.data();
    const status = partner.active ? '✅ ATIVO' : '⏸️ INATIVO';
    
    console.log(`${status} ${partner.name}`);
    console.log(`   ID: ${partner.partnerId}`);
    console.log(`   Código: ${partner.referralCode}`);
    console.log(`   Email: ${partner.email}`);
    console.log(`   Comissão: ${partner.commissionPercent}%`);
    console.log(`   Criado: ${partner.createdAt}`);
    console.log('');
  });
}

// ═══════════════════════════════════════════════════════════════════
// 🎯 EXECUÇÃO DO SCRIPT
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log('========================================');
  console.log('🤝 GERENCIADOR DE PARCEIROS - SoundyAI');
  console.log('========================================\n');

  try {
    // ✅ CRIAR PARCEIRO: papohertz
    await createPartner({
      partnerId: 'papohertz',
      name: 'Papo Hertz',
      referralCode: 'papohertz',
      email: 'contato@papohertz.com',  // ⚠️ ALTERE para o email real do parceiro
      commissionPercent: 50,
      active: true,
      description: 'Parceiro oficial - Papo Hertz',
      website: 'https://youtube.com/@papohertz',  // ⚠️ ALTERE se necessário
      tier: 'gold',
    });

    console.log('\n========================================');
    console.log('✅ Script executado com sucesso!');
    console.log('========================================\n');

    // Listar todos os parceiros
    await listPartners();

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao executar script:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Executar script
main();

// ═══════════════════════════════════════════════════════════════════
// 📚 EXEMPLOS DE USO
// ═══════════════════════════════════════════════════════════════════

/*
// Criar novo parceiro
await createPartner({
  partnerId: 'parceiro2',
  name: 'Nome do Parceiro',
  referralCode: 'parceiro2',
  email: 'contato@parceiro.com',
  commissionPercent: 40,
});

// Atualizar comissão
await updatePartner('estudioherta', {
  commissionPercent: 60,
});

// Desativar parceiro
await deactivatePartner('estudioherta');

// Reativar parceiro
await activatePartner('estudioherta');

// Listar parceiros
await listPartners();
*/
