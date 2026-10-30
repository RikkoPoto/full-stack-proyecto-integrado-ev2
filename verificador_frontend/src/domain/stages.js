/**
 * Etapas visibles del escaneo: conexión, una por categoría del catálogo y cálculo final.
 * El estado de cada una se deduce de las reglas ya evaluadas, sin depender del orden de ejecución.
 */
export function buildStages(scan, catalog) {
  const evaluated = new Set(scan.rules.map((r) => r.id));
  const base = [{ id: 'connect', label: 'Conexión y descarga', done: scan.step >= 1 }];

  for (const cat of catalog.categories) {
    const rules = catalog.rules.filter((r) => r.category === cat.id);
    if (!rules.length) continue;
    base.push({ id: cat.id, label: cat.label, done: rules.every((r) => evaluated.has(r.id)) });
  }
  base.push({ id: 'score', label: 'Cálculo del resultado', done: scan.status === 'done' });

  let currentFound = false;
  return base.map((stage) => {
    if (stage.done || scan.status === 'done') return { ...stage, state: 'done' };
    if (!currentFound) {
      currentFound = true;
      return { ...stage, state: scan.status === 'running' ? 'active' : 'stalled' };
    }
    return { ...stage, state: 'pending' };
  });
}

export const STAGE_TEXT = { done: 'Listo', active: 'En curso', stalled: 'Detenido', pending: 'Pendiente' };
