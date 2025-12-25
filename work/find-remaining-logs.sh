#!/bin/bash
# Script para encontrar todos os console.log restantes no backend

echo "🔍 Procurando console.log/warn/debug/info no backend (work/)..."
echo ""

echo "📊 RESUMO GERAL:"
echo "----------------"
grep -r "console\.\(log\|debug\|info\|warn\|error\)" work/ --include="*.js" --exclude-dir=node_modules | wc -l
echo "logs console.* encontrados no total"
echo ""

echo "📁 POR ARQUIVO (top 10 com mais logs):"
echo "---------------------------------------"
grep -r "console\.\(log\|debug\|info\)" work/ --include="*.js" --exclude-dir=node_modules | cut -d: -f1 | sort | uniq -c | sort -rn | head -10
echo ""

echo "🎯 LOGS RELACIONADOS A FFT/SPECTRUM/BANDS:"
echo "-------------------------------------------"
grep -r "console\.log.*\(fft\|spectrum\|spectral\|bands\|frequency\)" work/ --include="*.js" --exclude-dir=node_modules -i | wc -l
echo "logs FFT-related encontrados"
echo ""

echo "🔍 ARQUIVOS PRIORITÁRIOS PARA CORREÇÃO:"
echo "----------------------------------------"
echo "1. worker.js ou index.js (AUDIT/GENRE logs)"
echo "2. lib/audio/features/spectral-bands.js"
echo "3. lib/audio/features/spectral-metrics.js"
echo "4. lib/audio/features/spectral-centroid.js"
echo ""

echo "✅ ARQUIVOS JÁ CORRIGIDOS:"
echo "--------------------------"
echo "- work/lib/logger.js (CRIADO)"
echo "- work/api/audio/core-metrics.js"
echo "- work/api/audio/pipeline-complete.js"
echo ""

echo "🚀 PRÓXIMO PASSO:"
echo "-----------------"
echo "1. Adicionar 'import logger from \"./lib/logger.js\"' nos arquivos restantes"
echo "2. Substituir console.log por logger.debugFFT (FFT/spectrum)"
echo "3. Substituir console.log por logger.debug (outros)"
echo "4. Substituir console.warn por logger.warn"
echo "5. Substituir console.error por logger.error"
echo ""
