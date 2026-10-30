// Catálogos del dominio. Los strings de clases están completos para que Tailwind los detecte.

/** Estados de una regla evaluada. */
export const RULE_STATUS = {
  C: { label: 'Cumple', points: 1, chip: 'chip-C', log: 'text-ok' },
  P: { label: 'Parcial', points: 0.5, chip: 'chip-P', log: 'text-warn' },
  N: { label: 'No cumple', points: 0, chip: 'chip-N', log: 'text-bad' },
  E: { label: 'No evaluable', points: null, chip: 'chip-E', log: 'text-mute' },
};

/** Estados de un escaneo. */
export const SCAN_STATUS = {
  running: { label: 'En curso', chip: 'chip-A' },
  done: { label: 'Completado', chip: 'chip-C' },
  error: { label: 'Error', chip: 'chip-N' },
  cancelled: { label: 'Interrumpido', chip: 'chip-P' },
};

export const isFinal = (status) => status !== 'running';
export const canRetry = (status) => status === 'error' || status === 'cancelled';

/** Umbrales de clasificación: Bajo < 50, Parcial 50–84, Alto ≥ 85. En producción los define el backend. */
export const THRESHOLDS = { parcial: 50, alto: 85 };

export const CLASSIFICATION = {
  alto: { label: 'Alto', chip: 'chip-C', text: 'text-ok', bar: 'bg-ok', stroke: 'var(--ok)' },
  parcial: { label: 'Parcial', chip: 'chip-P', text: 'text-warn', bar: 'bg-warn', stroke: 'var(--warn)' },
  bajo: { label: 'Bajo', chip: 'chip-N', text: 'text-bad', bar: 'bg-bad', stroke: 'var(--bad)' },
};

export const SCOPE_OPTIONS = [
  { value: 1, label: 'Solo la página indicada' },
  { value: 10, label: 'Hasta 10 páginas del sitio' },
  { value: 50, label: 'Hasta 50 páginas del sitio' },
];

export const scopeText = (n) => (n === 1 ? 'solo la página indicada' : `hasta ${n} páginas`);
