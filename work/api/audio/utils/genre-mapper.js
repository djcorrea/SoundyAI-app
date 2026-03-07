// workers/utils/genre-mapper.js
// Normaliza qualquer gênero recebido do frontend para a chave interna correta.
// Nunca lança erro — retorna "default" quando o gênero é desconhecido.

const GENRE_MAP = {
  electronic: "edm",
  edm: "edm",
  techno: "techno",
  house: "house",
  trance: "trance",
  phonk: "phonk",

  funk: "funk_automotivo",
  "funk automotivo": "funk_automotivo",
  "funk mandela": "funk_mandela",
  "funk bh": "funk_bh",
  "funk bruxaria": "funk_bruxaria",

  trap: "trap",
  drill: "rap_drill",

  default: "default"
};

/**
 * Normaliza o gênero recebido do frontend para a chave interna usada pelo loader.
 * @param {string|null|undefined} input - Gênero bruto vindo do payload
 * @returns {string} Chave normalizada ou "default"
 */
export function normalizeGenre(input) {
  if (!input) return "default";

  const key = String(input).toLowerCase().trim();

  return GENRE_MAP[key] || "default";
}
