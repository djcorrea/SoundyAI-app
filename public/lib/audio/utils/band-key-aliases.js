// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

/**
 * band-key-aliases.js
 * Sistema centralizado de normalização de chaves de bandas espectrais
 * 
 * @version 1.0.0
 * @description Resolve inconsistências entre diferentes fontes de dados
 *              (backend, JSONs de gênero, UI, etc.)
 */

(function(global) {
  'use strict';

  // ============================================================================
  // MAPA DE ALIASES: Diferentes nomes para a mesma banda
  // ============================================================================
  const BAND_ALIASES = {
    // SUB (20-60 Hz)
    'sub': ['sub', 'sub_bass', 'subBass', 'sub-bass', 'subbass'],
    
    // BASS / LOW_BASS (60-250 Hz)
    'bass': ['bass', 'low_bass', 'lowBass', 'low-bass', 'baixo', 'graves'],
    
    // LOW_MID (250-500 Hz)
    'low_mid': ['low_mid', 'lowMid', 'low-mid', 'lowmid', 'médio_grave', 'medio_grave'],
    
    // MID (500-2000 Hz)
    'mid': ['mid', 'mids', 'médio', 'medio', 'medios', 'midrange'],
    
    // HIGH_MID (2000-4000 Hz)
    'high_mid': ['high_mid', 'highMid', 'high-mid', 'highmid', 'médio_agudo', 'medio_agudo', 'upper_mid', 'upperMid'],
    
    // PRESENCE (4000-6000 Hz)
    'presence': ['presence', 'presenca', 'presença', 'vocal', 'vocal_presence'],
    
    // BRILHO / AIR (6000-20000 Hz)
    'brilho': ['brilho', 'air', 'brilliance', 'highs', 'agudos', 'treble', 'high']
  };

  // ============================================================================
  // CHAVES CANÔNICAS: Nome oficial de cada banda
  // ============================================================================
  const CANONICAL_KEYS = ['sub', 'bass', 'low_mid', 'mid', 'high_mid', 'presence', 'brilho'];

  // ============================================================================
  // META KEYS: Chaves que NÃO são bandas (devem ser ignoradas)
  // ============================================================================
  const META_KEYS = [
    'totalPercentage', 'total_percentage', '_status', 'status',
    'timestamp', 'version', 'source', '_source', '_metadata',
    'notes', 'comments', '_isReferenceMode', '_genreTargetsLoaded',
    '_disabledBands', '_referenceBands', '_userBands'
  ];

  // ============================================================================
  // FUNÇÕES UTILITÁRIAS
  // ============================================================================

  /**
   * Normaliza uma chave de banda para sua forma canônica
   * @param {string} key - Chave original (ex: 'lowMid', 'presenca', 'sub_bass')
   * @returns {string|null} Chave canônica (ex: 'low_mid', 'presence', 'sub') ou null se não reconhecida
   */
  function normalizeBandKey(key) {
    if (!key || typeof key !== 'string') return null;
    
    const lowerKey = key.toLowerCase().trim();
    
    // Verificar se é meta key
    if (META_KEYS.some(mk => mk.toLowerCase() === lowerKey)) {
      return null;
    }
    
    // Buscar em aliases
    for (const [canonical, aliases] of Object.entries(BAND_ALIASES)) {
      if (aliases.some(alias => alias.toLowerCase() === lowerKey)) {
        return canonical;
      }
    }
    
    // Não reconhecida
    return null;
  }

  /**
   * Verifica se uma chave é de banda válida
   * @param {string} key
   * @returns {boolean}
   */
  function isBandKey(key) {
    return normalizeBandKey(key) !== null;
  }

  /**
   * Verifica se uma chave é meta (deve ser ignorada)
   * @param {string} key
   * @returns {boolean}
   */
  function isMetaKey(key) {
    if (!key || typeof key !== 'string') return true;
    return META_KEYS.some(mk => mk.toLowerCase() === key.toLowerCase());
  }

  /**
   * Obtém todas as bandas válidas de um objeto, normalizando as chaves
   * @param {Object} bandsObj - Objeto com bandas (pode ter chaves inconsistentes)
   * @returns {Object} Objeto com chaves normalizadas e valores preservados
   */
  function normalizeBandsObject(bandsObj) {
    if (!bandsObj || typeof bandsObj !== 'object') return {};
    
    const normalized = {};
    const skipped = [];
    
    for (const [key, value] of Object.entries(bandsObj)) {
      const canonicalKey = normalizeBandKey(key);
      
      if (canonicalKey) {
        // Se já existe, manter o primeiro (prioridade)
        if (!normalized[canonicalKey]) {
          normalized[canonicalKey] = value;
        }
      } else if (!isMetaKey(key)) {
        // Chave não reconhecida (nem meta, nem banda)
        skipped.push(key);
      }
    }
    
    if (skipped.length > 0) {
      warn('[BAND-ALIASES] Chaves não reconhecidas:', skipped);
    }
    
    return normalized;
  }

  /**
   * Busca uma banda em um objeto usando aliases
   * @param {Object} bandsObj - Objeto com bandas
   * @param {string} canonicalKey - Chave canônica (ex: 'low_mid')
   * @returns {any} Valor da banda ou undefined
   */
  function getBandValue(bandsObj, canonicalKey) {
    if (!bandsObj || typeof bandsObj !== 'object') return undefined;
    
    const aliases = BAND_ALIASES[canonicalKey];
    if (!aliases) return undefined;
    
    for (const alias of aliases) {
      // Tentar variações de case
      if (bandsObj[alias] !== undefined) return bandsObj[alias];
      if (bandsObj[alias.toLowerCase()] !== undefined) return bandsObj[alias.toLowerCase()];
      if (bandsObj[alias.toUpperCase()] !== undefined) return bandsObj[alias.toUpperCase()];
    }
    
    return undefined;
  }

  /**
   * Extrai energy_db de um valor de banda (suporta múltiplos formatos)
   * @param {any} bandValue - Valor da banda (pode ser número, objeto, etc)
   * @returns {number|null} Energia em dB ou null
   */
  function extractEnergyDb(bandValue) {
    if (bandValue === null || bandValue === undefined) return null;
    
    // Se for número direto
    if (typeof bandValue === 'number' && Number.isFinite(bandValue)) {
      return bandValue;
    }
    
    // Se for objeto
    if (typeof bandValue === 'object') {
      const energy = bandValue.energy_db ?? 
                     bandValue.energyDb ?? 
                     bandValue.energy_Db ?? 
                     bandValue.db ?? 
                     bandValue.rms_db ?? 
                     bandValue.rmsDb ?? 
                     bandValue.value;
      
      if (Number.isFinite(energy)) return energy;
    }
    
    return null;
  }

  /**
   * Mapeia bandas do usuário para targets de referência
   * Retorna objeto com: { bandKey: { userValue, targetValue, hasMatch } }
   * @param {Object} userBands - Bandas do áudio do usuário
   * @param {Object} refBands - Bandas de referência/target
   * @returns {Object} Mapeamento completo com diagnóstico
   */
  function mapBandsWithDiagnostic(userBands, refBands) {
    const result = {
      mapped: {},
      userBandsUsed: [],
      refBandsUsed: [],
      userBandsIgnored: [],
      refBandsIgnored: [],
      missingInUser: [],
      missingInRef: []
    };
    
    // Normalizar ambos os objetos
    const normalizedUser = normalizeBandsObject(userBands);
    const normalizedRef = normalizeBandsObject(refBands);
    
    // Para cada banda canônica
    for (const canonical of CANONICAL_KEYS) {
      const userValue = extractEnergyDb(normalizedUser[canonical]);
      const refValue = normalizedRef[canonical];
      
      // Extrair target de refValue (pode ser objeto com target_range, target_db, etc)
      let targetDb = null;
      let tolDb = null;
      
      if (refValue !== undefined) {
        if (typeof refValue === 'number') {
          targetDb = refValue;
          tolDb = 3.0; // Default
        } else if (typeof refValue === 'object') {
          // target_range tem prioridade
          if (refValue.target_range?.min !== undefined && refValue.target_range?.max !== undefined) {
            targetDb = (refValue.target_range.min + refValue.target_range.max) / 2;
            tolDb = (refValue.target_range.max - refValue.target_range.min) / 2;
          } else if (refValue.target_db !== undefined) {
            targetDb = refValue.target_db;
            tolDb = refValue.tol_db ?? 3.0;
          } else {
            // energy_db como fallback (modo reference)
            targetDb = extractEnergyDb(refValue);
            tolDb = 3.0;
          }
        }
      }
      
      const hasUserValue = userValue !== null;
      const hasRefValue = targetDb !== null;
      
      result.mapped[canonical] = {
        userValue,
        targetDb,
        tolDb,
        hasMatch: hasUserValue && hasRefValue
      };
      
      if (hasUserValue) {
        result.userBandsUsed.push(canonical);
      } else {
        result.missingInUser.push(canonical);
      }
      
      if (hasRefValue) {
        result.refBandsUsed.push(canonical);
      } else {
        result.missingInRef.push(canonical);
      }
    }
    
    // Detectar chaves não mapeadas
    for (const key of Object.keys(userBands || {})) {
      if (!isBandKey(key) && !isMetaKey(key)) {
        result.userBandsIgnored.push(key);
      }
    }
    
    for (const key of Object.keys(refBands || {})) {
      if (!isBandKey(key) && !isMetaKey(key)) {
        result.refBandsIgnored.push(key);
      }
    }
    
    return result;
  }

  // ============================================================================
  // EXPORTAR
  // ============================================================================
  const BandKeyAliases = {
    BAND_ALIASES,
    CANONICAL_KEYS,
    META_KEYS,
    normalizeBandKey,
    isBandKey,
    isMetaKey,
    normalizeBandsObject,
    getBandValue,
    extractEnergyDb,
    mapBandsWithDiagnostic
  };

  // CommonJS
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BandKeyAliases;
  }
  
  // Browser global
  if (typeof window !== 'undefined') {
    window.BandKeyAliases = BandKeyAliases;
  }

  // AMD
  if (typeof define === 'function' && define.amd) {
    define(function() { return BandKeyAliases; });
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
