// Datos de prueba. Viven solo en las pruebas: la aplicación no incluye ninguna dirección de ejemplo.
import { CATALOG, TOTAL_STEPS, evidenceFor } from '../api/mock/catalog.js';
import { calcScore } from '../domain/scoring.js';

export { TOTAL_STEPS };

// Resultado por regla en el orden del catálogo: C cumple, P parcial, N no cumple, E no evaluable
export const MIXED = 'CCNPNNNCCCCCNNE'; // 7 C, 1 P, 6 N, 1 E -> 7,5 de 14 puntos = 54 %
export const ALL_OK = 'CCCCCCCCCCCCCCE';

export const rulesFromString = (str) =>
  CATALOG.rules.map((r, i) => ({ id: r.id, status: str[i], evidence: evidenceFor(r.id, str[i]) }));

const base = { scope: 10, total: TOTAL_STEPS, retries: 0, log: [], errorMessage: null, score: null, classification: null };

export function doneScan(id, url, results, startedAt) {
  const rules = rulesFromString(results);
  const { pct, classification } = calcScore(rules, CATALOG.rules);
  const finishedAt = new Date(new Date(startedAt).getTime() + 2 * 60_000).toISOString();
  return { ...base, id, url, startedAt, finishedAt, status: 'done', step: TOTAL_STEPS, rules, score: pct, classification };
}

export const failedScan = (id, url, startedAt) => ({
  ...base, id, url, startedAt, finishedAt: startedAt, status: 'error', step: 0, rules: [], errorMessage: 'Tiempo de espera agotado.',
});

export const cancelledScan = (id, url, startedAt) => ({
  ...base, id, url, startedAt, finishedAt: startedAt, status: 'cancelled', step: 4, rules: rulesFromString(MIXED).slice(0, 3),
});

/** Historial de 6 verificaciones para probar filtros y paginación. */
export const historyFixture = () => [
  doneScan('VER-A1', 'https://www.sitio-uno.cl', MIXED, '2026-10-28T14:05:12-03:00'),
  doneScan('VER-A2', 'https://www.sitio-dos.cl', ALL_OK, '2026-10-27T18:42:00-03:00'),
  failedScan('VER-A3', 'https://www.sitio-tres.cl', '2026-10-27T09:10:00-03:00'),
  doneScan('VER-A4', 'https://www.sitio-cuatro.cl', MIXED, '2026-10-22T16:30:00-03:00'),
  cancelledScan('VER-A5', 'https://www.sitio-cinco.cl', '2026-10-20T11:15:00-03:00'),
  doneScan('VER-A6', 'https://www.sitio-seis.cl', ALL_OK, '2026-10-15T10:00:00-03:00'),
];
