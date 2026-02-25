/**
 * db/ensure-automaster-schema.js
 *
 * Migration automática de boot — AutoMaster V1
 *
 * Garante que a tabela `jobs` possui todas as colunas necessárias
 * para o AutoMaster sem apagar dados, remover colunas ou quebrar
 * o analisador existente.
 *
 * Uso: chamar ensureAutomasterSchema(pool) no boot do servidor.
 * Erros são capturados e logados — NUNCA derrubam o servidor.
 */

const COLUMNS = [
  { name: 'type',       def: "TEXT DEFAULT 'analyze'" },
  { name: 'mode',       def: 'TEXT' },
  { name: 'input_key',  def: 'TEXT' },
  { name: 'output_key', def: 'TEXT' },
  { name: 'progress',   def: 'INTEGER DEFAULT 0' },
];

/**
 * Garante que as colunas do AutoMaster existem na tabela `jobs`.
 * Adiciona apenas colunas faltantes. Nunca remove ou renomeia.
 *
 * @param {import('pg').Pool} pool - Pool PostgreSQL já inicializado
 * @returns {Promise<void>}
 */
export async function ensureAutomasterSchema(pool) {
  const TAG = '[SCHEMA-MIGRATION]';

  console.log(`${TAG} Iniciando verificação de schema AutoMaster...`);

  let client;
  try {
    client = await pool.connect();
  } catch (connErr) {
    console.error(`${TAG} Não foi possível conectar ao PostgreSQL — migration ignorada:`, connErr.message);
    return;
  }

  try {
    // ──────────────────────────────────────────────
    // 1. Adicionar colunas faltantes (idempotente)
    // ──────────────────────────────────────────────
    for (const col of COLUMNS) {
      try {
        await client.query(
          `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ${col.name} ${col.def}`
        );
        console.log(`${TAG} ✅ Coluna garantida: ${col.name} ${col.def}`);
      } catch (colErr) {
        // Erro isolado por coluna — não bloqueia as demais
        console.warn(`${TAG} ⚠️  Falha ao garantir coluna "${col.name}":`, colErr.message);
      }
    }

    // ──────────────────────────────────────────────
    // 2. Corrigir linhas com type NULL
    //    (jobs antigos inseridos antes da migration)
    // ──────────────────────────────────────────────
    try {
      const r1 = await client.query(
        `UPDATE jobs SET type = 'automaster' WHERE type IS NULL`
      );
      if (r1.rowCount > 0) {
        console.log(`${TAG} 🔧 Corrigidos ${r1.rowCount} job(s) com type NULL → 'automaster'`);
      }
    } catch (fixErr) {
      console.warn(`${TAG} ⚠️  Falha ao corrigir type NULL:`, fixErr.message);
    }

    // ──────────────────────────────────────────────
    // 3. Corrigir linhas com mode NULL (somente automaster)
    // ──────────────────────────────────────────────
    try {
      const r2 = await client.query(
        `UPDATE jobs SET mode = 'BALANCED' WHERE mode IS NULL AND type = 'automaster'`
      );
      if (r2.rowCount > 0) {
        console.log(`${TAG} 🔧 Corrigidos ${r2.rowCount} job(s) automaster com mode NULL → 'MEDIUM'`);
      }
    } catch (fixErr) {
      console.warn(`${TAG} ⚠️  Falha ao corrigir mode NULL:`, fixErr.message);
    }

    console.log(`${TAG} ✅ Migration AutoMaster concluída com sucesso.`);

  } catch (err) {
    // Erro genérico inesperado — apenas loga, nunca derruba o boot
    console.error(`${TAG} ❌ Erro inesperado durante migration (não fatal):`, err.message);
  } finally {
    client.release();
  }
}
