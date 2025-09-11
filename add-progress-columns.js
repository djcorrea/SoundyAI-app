// add-progress-columns.js - Adicionar colunas de progresso na tabela jobs
import "dotenv/config";
import pkg from "pg";

const { Client } = pkg;

async function addProgressColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Conectado ao banco de dados");

    // Verificar se as colunas já existem
    const checkColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' 
      AND column_name IN ('progress', 'progress_message')
    `);

    const existingColumns = checkColumns.rows.map(row => row.column_name);
    
    if (existingColumns.includes('progress') && existingColumns.includes('progress_message')) {
      console.log("✅ Colunas de progresso já existem");
      return;
    }

    console.log("🔧 Adicionando colunas de progresso...");

    // Adicionar coluna progress se não existir
    if (!existingColumns.includes('progress')) {
      await client.query(`
        ALTER TABLE jobs 
        ADD COLUMN progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100)
      `);
      console.log("✅ Coluna 'progress' adicionada");
    }

    // Adicionar coluna progress_message se não existir
    if (!existingColumns.includes('progress_message')) {
      await client.query(`
        ALTER TABLE jobs 
        ADD COLUMN progress_message TEXT DEFAULT NULL
      `);
      console.log("✅ Coluna 'progress_message' adicionada");
    }

    // Verificar estrutura final da tabela
    const tableStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'jobs'
      ORDER BY ordinal_position
    `);

    console.log("\n📊 Estrutura final da tabela 'jobs':");
    tableStructure.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

    console.log("\n🎉 Colunas de progresso configuradas com sucesso!");

  } catch (error) {
    console.error("❌ Erro ao adicionar colunas de progresso:", error);
    throw error;
  } finally {
    await client.end();
  }
}

if (import.meta.url === new URL(import.meta.url).href) {
  addProgressColumns().catch(console.error);
}

export default addProgressColumns;
