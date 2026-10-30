import { RULE_STATUS, THRESHOLDS } from './constants.js';

export function classify(pct) {
  if (pct == null) return null;
  if (pct >= THRESHOLDS.alto) return 'alto';
  if (pct >= THRESHOLDS.parcial) return 'parcial';
  return 'bajo';
}

/**
 * Calcula el puntaje a partir de las reglas evaluadas.
 * Cumple = 1 punto, Parcial = 0,5, No cumple = 0, No evaluable no entra al puntaje.
 * En producción el puntaje oficial lo entrega el backend; esto se usa para el desglose
 * por categoría y como respaldo si el backend no lo envía.
 *
 * @param {{id:string,status:string}[]} rules
 * @param {{id:string,category:string}[]} catalogRules
 */
export function calcScore(rules, catalogRules = []) {
  const categoryOf = new Map(catalogRules.map((r) => [r.id, r.category]));
  const counts = { C: 0, P: 0, N: 0, E: 0 };
  const byCategory = {};
  let points = 0;
  let evaluated = 0;

  for (const rule of rules) {
    const meta = RULE_STATUS[rule.status];
    if (!meta) continue;
    counts[rule.status] += 1;
    const cat = categoryOf.get(rule.id) ?? 'otros';
    byCategory[cat] ??= { points: 0, evaluated: 0, total: 0 };
    byCategory[cat].total += 1;
    if (meta.points == null) continue;
    points += meta.points;
    evaluated += 1;
    byCategory[cat].points += meta.points;
    byCategory[cat].evaluated += 1;
  }

  const pct = evaluated ? Math.round((points / evaluated) * 100) : null;
  return { pct, points, evaluated, total: rules.length, counts, byCategory, classification: classify(pct) };
}
