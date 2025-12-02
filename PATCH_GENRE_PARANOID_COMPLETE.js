/**
 * 🔬 PATCH COMPLETO - GENRE PARANOID MODE
 * 
 * Este patch adiciona verificação FORENSE completa em 3 pontos críticos:
 * 1. ANTES do JSON.stringify
 * 2. DEPOIS do JSON.stringify
 * 3. DEPOIS do UPDATE (leitura imediata do banco)
 * 
 * APLICAR NO ARQUIVO: work/worker.js
 * SUBSTITUIR LINHAS: ~810-825
 */

// ============================================================================
// PATCH INÍCIO - Substituir de "const finalUpdateResult = await client.query"
// até logo DEPOIS do "if (finalUpdateResult.rowCount === 0)"
// ============================================================================

    // 🔍 AUDITORIA FORENSE NÍVEL 1: Verificar result object ANTES de stringificar
    console.log("[GENRE-PARANOID][1-BEFORE-STRINGIFY] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[GENRE-PARANOID][1] Tipo do result:", typeof result);
    console.log("[GENRE-PARANOID][1] result.genre:", result.genre);
    console.log("[GENRE-PARANOID][1] result.summary?.genre:", result.summary?.genre);
    console.log("[GENRE-PARANOID][1] result.metadata?.genre:", result.metadata?.genre);
    console.log("[GENRE-PARANOID][1] result.suggestionMetadata?.genre:", result.suggestionMetadata?.genre);
    console.log("[GENRE-PARANOID][1] result.data?.genre:", result.data?.genre);
    console.log("[GENRE-PARANOID][1] Tem método toJSON():", typeof result.toJSON === 'function');
    console.log("[GENRE-PARANOID][1] Chaves do result:", Object.keys(result));
    console.log("[GENRE-PARANOID][1] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // 🔍 Verificação extra: Se tem toJSON, chamar e ver o que retorna
    if (typeof result.toJSON === 'function') {
      console.warn("[GENRE-PARANOID][1] ⚠️ ALERTA: result tem método toJSON() customizado!");
      try {
        const toJSONResult = result.toJSON();
        console.log("[GENRE-PARANOID][1] toJSON() retornou:", {
          genre: toJSONResult?.genre,
          summaryGenre: toJSONResult?.summary?.genre,
          keys: Object.keys(toJSONResult || {})
        });
      } catch (e) {
        console.error("[GENRE-PARANOID][1] Erro ao chamar toJSON():", e.message);
      }
    }

    // 🔍 AUDITORIA FORENSE NÍVEL 2: Stringificar e verificar JSON string
    const resultJSON = JSON.stringify(result);
    
    console.log("[GENRE-PARANOID][2-AFTER-STRINGIFY] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[GENRE-PARANOID][2] Tamanho do JSON:", resultJSON.length, "bytes");
    
    // Fazer parse imediato para verificar se genre está presente
    let parsedResult = null;
    try {
      parsedResult = JSON.parse(resultJSON);
      console.log("[GENRE-PARANOID][2] JSON.parse() bem-sucedido");
      console.log("[GENRE-PARANOID][2] parsedResult.genre:", parsedResult.genre);
      console.log("[GENRE-PARANOID][2] parsedResult.summary?.genre:", parsedResult.summary?.genre);
      console.log("[GENRE-PARANOID][2] parsedResult.metadata?.genre:", parsedResult.metadata?.genre);
      console.log("[GENRE-PARANOID][2] parsedResult.suggestionMetadata?.genre:", parsedResult.suggestionMetadata?.genre);
      console.log("[GENRE-PARANOID][2] parsedResult.data?.genre:", parsedResult.data?.genre);
      
      // 🚨 ALERTA SE GENRE FOI PERDIDO NA STRINGIFICAÇÃO
      if (!parsedResult.genre || parsedResult.genre === null) {
        console.error("[GENRE-PARANOID][2] 🚨 CRÍTICO: genre foi PERDIDO durante JSON.stringify!");
        console.error("[GENRE-PARANOID][2] result.genre ANTES:", result.genre);
        console.error("[GENRE-PARANOID][2] parsedResult.genre DEPOIS:", parsedResult.genre);
        console.error("[GENRE-PARANOID][2] Sample JSON:", resultJSON.substring(0, 1000));
      }
      
      if (!parsedResult.summary?.genre || parsedResult.summary.genre === 'default') {
        console.error("[GENRE-PARANOID][2] 🚨 ALERTA: summary.genre é null ou 'default'!");
        console.error("[GENRE-PARANOID][2] result.summary.genre ANTES:", result.summary?.genre);
        console.error("[GENRE-PARANOID][2] parsedResult.summary.genre DEPOIS:", parsedResult.summary?.genre);
      }
      
    } catch (parseError) {
      console.error("[GENRE-PARANOID][2] ❌ ERRO CRÍTICO: JSON string inválido!", parseError.message);
      console.error("[GENRE-PARANOID][2] JSON sample:", resultJSON.substring(0, 500));
    }
    
    console.log("[GENRE-PARANOID][2] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // 🔍 AUDITORIA FORENSE NÍVEL 3: UPDATE e verificação imediata do banco
    console.log("[GENRE-PARANOID][3-UPDATE] Executando UPDATE no Postgres...");
    
    // ✅ CORREÇÃO CRÍTICA: Remover cast ::jsonb (Postgres driver detecta JSON automaticamente)
    const finalUpdateResult = await client.query(
      "UPDATE jobs SET status = $1, result = $2, results = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $3",
      ["done", resultJSON, job.id]
    );

    console.log("[GENRE-PARANOID][3-UPDATE] UPDATE concluído:", {
      rowCount: finalUpdateResult.rowCount,
      updateSuccessful: finalUpdateResult.rowCount > 0
    });

    if (finalUpdateResult.rowCount === 0) {
      console.error("[GENRE-PARANOID][3-UPDATE] 🚨 CRÍTICO: UPDATE não afetou nenhuma linha!");
      throw new Error(`Falha ao atualizar job ${job.id} para status 'done'`);
    }

    // 🔍 AUDITORIA FORENSE NÍVEL 4: LER IMEDIATAMENTE do banco para confirmar
    console.log("[GENRE-PARANOID][4-VERIFY-DB] Verificando dados salvos no Postgres...");
    
    try {
      const verifyResult = await client.query(
        `SELECT 
          id,
          mode,
          data->>'genre' as data_genre,
          result->>'genre' as result_genre,
          results->>'genre' as results_genre,
          result->'summary'->>'genre' as result_summary_genre,
          results->'summary'->>'genre' as results_summary_genre,
          result->'metadata'->>'genre' as result_metadata_genre,
          results->'metadata'->>'genre' as results_metadata_genre
        FROM jobs 
        WHERE id = $1`,
        [job.id]
      );
      
      if (verifyResult.rows.length === 0) {
        console.error("[GENRE-PARANOID][4-VERIFY-DB] ❌ ERRO: Job não encontrado no banco após UPDATE!");
      } else {
        const dbRow = verifyResult.rows[0];
        
        console.log("[GENRE-PARANOID][4-VERIFY-DB] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("[GENRE-PARANOID][4-VERIFY-DB] 📊 ESTADO REAL NO POSTGRES:");
        console.log("[GENRE-PARANOID][4-VERIFY-DB] Job ID:", dbRow.id);
        console.log("[GENRE-PARANOID][4-VERIFY-DB] Mode:", dbRow.mode);
        console.log("[GENRE-PARANOID][4-VERIFY-DB] ─────────────────────────────────────────");
        console.log("[GENRE-PARANOID][4-VERIFY-DB] data.genre:", dbRow.data_genre);
        console.log("[GENRE-PARANOID][4-VERIFY-DB] ─────────────────────────────────────────");
        console.log("[GENRE-PARANOID][4-VERIFY-DB] result.genre:", dbRow.result_genre);
        console.log("[GENRE-PARANOID][4-VERIFY-DB] result.summary.genre:", dbRow.result_summary_genre);
        console.log("[GENRE-PARANOID][4-VERIFY-DB] result.metadata.genre:", dbRow.result_metadata_genre);
        console.log("[GENRE-PARANOID][4-VERIFY-DB] ─────────────────────────────────────────");
        console.log("[GENRE-PARANOID][4-VERIFY-DB] results.genre:", dbRow.results_genre);
        console.log("[GENRE-PARANOID][4-VERIFY-DB] results.summary.genre:", dbRow.results_summary_genre);
        console.log("[GENRE-PARANOID][4-VERIFY-DB] results.metadata.genre:", dbRow.results_metadata_genre);
        console.log("[GENRE-PARANOID][4-VERIFY-DB] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        
        // 🚨 COMPARAÇÃO CRÍTICA: Verificar inconsistências
        const expectedGenre = result.genre;
        
        if (dbRow.data_genre !== expectedGenre) {
          console.warn("[GENRE-PARANOID][4-VERIFY-DB] ⚠️ data.genre diferente do esperado:", {
            expected: expectedGenre,
            actual: dbRow.data_genre
          });
        }
        
        if (dbRow.result_genre !== expectedGenre) {
          console.error("[GENRE-PARANOID][4-VERIFY-DB] 🚨 result.genre PERDIDO NO BANCO:", {
            expected: expectedGenre,
            actual: dbRow.result_genre
          });
        }
        
        if (dbRow.results_genre !== expectedGenre) {
          console.error("[GENRE-PARANOID][4-VERIFY-DB] 🚨 results.genre PERDIDO NO BANCO:", {
            expected: expectedGenre,
            actual: dbRow.results_genre
          });
        }
        
        if (dbRow.result_summary_genre !== expectedGenre) {
          console.error("[GENRE-PARANOID][4-VERIFY-DB] 🚨 result.summary.genre PERDIDO NO BANCO:", {
            expected: expectedGenre,
            actual: dbRow.result_summary_genre
          });
        }
        
        if (dbRow.results_summary_genre !== expectedGenre) {
          console.error("[GENRE-PARANOID][4-VERIFY-DB] 🚨 results.summary.genre PERDIDO NO BANCO:", {
            expected: expectedGenre,
            actual: dbRow.results_summary_genre
          });
        }
        
        // ✅ CONFIRMAÇÃO FINAL
        if (dbRow.results_genre === expectedGenre && dbRow.results_summary_genre === expectedGenre) {
          console.log("[GENRE-PARANOID][4-VERIFY-DB] ✅ SUCESSO TOTAL: Genre salvo corretamente!");
        } else {
          console.error("[GENRE-PARANOID][4-VERIFY-DB] ❌ FALHA: Genre foi perdido entre worker e Postgres!");
          console.error("[GENRE-PARANOID][4-VERIFY-DB] Evidências:", {
            sentToPostgres: expectedGenre,
            resultsGenreInDB: dbRow.results_genre,
            resultsSummaryGenreInDB: dbRow.results_summary_genre,
            jsonSentSize: resultJSON.length,
            jobId: job.id
          });
        }
      }
    } catch (verifyError) {
      console.error("[GENRE-PARANOID][4-VERIFY-DB] ❌ Erro ao verificar banco:", verifyError.message);
    }

    console.log(`✅ Job ${job.id} concluído e salvo no banco COM aiSuggestions`);
    
// ============================================================================
// PATCH FIM
// ============================================================================

/**
 * 📋 INSTRUÇÕES DE APLICAÇÃO:
 * 
 * 1. Abrir arquivo: work/worker.js
 * 
 * 2. Localizar linha ~813 (procurar por "const finalUpdateResult = await client.query")
 * 
 * 3. SUBSTITUIR todo o bloco de código desde:
 *    ```
 *    const finalUpdateResult = await client.query(
 *      "UPDATE jobs SET status = $1, result = $2, results = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $3",
 *      ["done", JSON.stringify(result), job.id]
 *    );
 * 
 *    if (finalUpdateResult.rowCount === 0) {
 *      throw new Error(`Falha ao atualizar job ${job.id} para status 'done'`);
 *    }
 * 
 *    console.log(`✅ Job ${job.id} concluído e salvo no banco COM aiSuggestions`);
 *    ```
 * 
 * 4. COLAR todo o código deste patch (desde "// 🔍 AUDITORIA FORENSE NÍVEL 1" até o final)
 * 
 * 5. Salvar arquivo
 * 
 * 6. Reiniciar worker
 * 
 * 7. Fazer novo upload de áudio em modo genre
 * 
 * 8. VERIFICAR LOGS procurando por:
 *    - [GENRE-PARANOID][1-BEFORE-STRINGIFY]
 *    - [GENRE-PARANOID][2-AFTER-STRINGIFY]
 *    - [GENRE-PARANOID][3-UPDATE]
 *    - [GENRE-PARANOID][4-VERIFY-DB]
 * 
 * 9. ANÁLISE DOS LOGS:
 *    
 *    ✅ SE [1] mostrar genre correto E [2] mostrar genre null:
 *       → Problema está no JSON.stringify (verificar método toJSON)
 *    
 *    ✅ SE [2] mostrar genre correto E [4] mostrar genre null:
 *       → Problema está no UPDATE do Postgres (verificar triggers/constraints)
 *    
 *    ✅ SE [4] mostrar genre correto:
 *       → Problema está no GET endpoint ou no frontend
 * 
 * 10. COMPARTILHAR LOGS completos de uma análise para diagnóstico final
 */

/**
 * 🎯 CHECKLIST DE VERIFICAÇÃO APÓS APLICAR PATCH:
 * 
 * [ ] Worker reiniciado com sucesso
 * [ ] Novo upload em modo genre realizado
 * [ ] Logs [GENRE-PARANOID][1] aparecem nos logs do worker
 * [ ] Logs [GENRE-PARANOID][2] aparecem nos logs do worker
 * [ ] Logs [GENRE-PARANOID][3-UPDATE] aparecem nos logs do worker
 * [ ] Logs [GENRE-PARANOID][4-VERIFY-DB] aparecem nos logs do worker
 * [ ] Verificar se há 🚨 CRÍTICO ou ❌ ERRO nos logs
 * [ ] Comparar genre em cada nível (1, 2, 4)
 * [ ] Se tudo estiver correto em [4], verificar GET endpoint e frontend
 */
