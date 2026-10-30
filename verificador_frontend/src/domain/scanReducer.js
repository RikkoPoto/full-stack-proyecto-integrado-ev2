// El estado de un escaneo se construye aplicando eventos (los mismos que envía el backend por SSE).
// Es idempotente: aplicar dos veces el mismo evento no duplica nada, así que da igual si el
// evento llega antes o después de la "foto" (snapshot) inicial.

const MAX_LOG = 500;

/**
 * @typedef {Object} ScanEvent
 * @property {'progress'|'rule'|'log'|'error'|'cancelled'|'retry'|'done'} type
 */

export function applyEvent(scan, ev) {
  switch (ev.type) {
    case 'progress':
      return { ...scan, step: Math.max(scan.step, ev.step), total: ev.total ?? scan.total };

    case 'rule': {
      const rules = scan.rules.some((r) => r.id === ev.rule.id)
        ? scan.rules.map((r) => (r.id === ev.rule.id ? ev.rule : r))
        : [...scan.rules, ev.rule];
      return { ...scan, rules, step: Math.max(scan.step, ev.step ?? 0), total: ev.total ?? scan.total };
    }

    case 'log': {
      const entry = { ts: ev.ts, level: ev.level ?? 'info', text: ev.text };
      const dup = scan.log.some((l) => l.ts === entry.ts && l.text === entry.text);
      return dup ? scan : { ...scan, log: [...scan.log, entry].slice(-MAX_LOG) };
    }

    case 'error':
      return { ...scan, status: 'error', errorMessage: ev.message, errorCode: ev.code ?? null, finishedAt: ev.ts ?? new Date().toISOString() };

    case 'cancelled':
      return { ...scan, status: 'cancelled', finishedAt: ev.ts ?? new Date().toISOString() };

    case 'retry':
      return { ...scan, status: 'running', retries: ev.retries ?? scan.retries + 1, errorMessage: null, errorCode: null, finishedAt: null };

    case 'done':
      return {
        ...scan,
        status: 'done',
        step: scan.total,
        score: ev.score ?? scan.score,
        classification: ev.classification ?? scan.classification,
        finishedAt: ev.finishedAt ?? new Date().toISOString(),
      };

    default:
      return scan;
  }
}

export const FINAL_EVENTS = ['done', 'error', 'cancelled'];

export const percentOf = (scan) => {
  if (scan.status === 'done') return 100;
  return scan.total ? Math.min(100, Math.round((scan.step / scan.total) * 100)) : 0;
};
