import { RULE_STATUS } from './constants.js';

const rank = (status) => {
  const p = RULE_STATUS[status]?.points;
  return p == null ? null : p;
};

/** Compara dos verificaciones completadas del mismo sitio. */
export function compareScans(current, previous) {
  const before = new Map(previous.rules.map((r) => [r.id, r.status]));
  const improved = [];
  const worsened = [];

  for (const rule of current.rules) {
    const a = rank(before.get(rule.id));
    const b = rank(rule.status);
    if (a == null || b == null || a === b) continue;
    (b > a ? improved : worsened).push(rule.id);
  }

  const scoreDelta = current.score != null && previous.score != null ? current.score - previous.score : null;
  return { scoreDelta, improved, worsened };
}
