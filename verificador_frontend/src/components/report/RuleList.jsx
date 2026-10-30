import { useState } from 'react';
import { useCatalog } from '../../context/CatalogProvider.jsx';
import { RuleChip } from '../ui/Chips.jsx';
import Icon from '../ui/Icon.jsx';

const FILTERS = [
  ['all', 'Todas'],
  ['N', 'No cumple'],
  ['P', 'Parcial'],
  ['C', 'Cumple'],
  ['E', 'No evaluable'],
];

export default function RuleList({ rules, changes }) {
  const { ruleById, categoryById } = useCatalog();
  const [filter, setFilter] = useState('all');

  const counts = { all: rules.length, N: 0, P: 0, C: 0, E: 0 };
  rules.forEach((r) => {
    counts[r.status] += 1;
  });
  const visible = rules.filter((r) => filter === 'all' || r.status === filter);

  return (
    <section aria-labelledby="reglas-titulo" className="mt-8">
      <h2 id="reglas-titulo" className="font-display text-xl font-bold tracking-tight">Reglas evaluadas</h2>

      <div className="mt-3 flex flex-wrap gap-2 print:hidden" role="group" aria-label="Filtrar reglas por resultado">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`btn btn-sm ${filter === value ? 'btn-primary' : 'btn-ghost'}`}
          >
            {label} <span className="tabular-nums opacity-80">{counts[value]}</span>
          </button>
        ))}
      </div>

      <div className="panel mt-4">
        {visible.length === 0 && <p className="px-4 py-8 text-center text-sm text-mute">Ninguna regla tiene este resultado.</p>}
        {visible.map((r) => {
          const rule = ruleById.get(r.id);
          const change = changes?.improved.includes(r.id) ? 'up' : changes?.worsened.includes(r.id) ? 'down' : null;
          return (
            <details key={r.id} className="group border-b border-line last:border-0">
              <summary className="flex cursor-pointer flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3 hover:bg-neutral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
                <Icon name="chevron" className="mt-1 h-4 w-4 shrink-0 text-mute transition-transform group-open:rotate-90 motion-reduce:transition-none" />
                <span className="w-14 shrink-0 pt-0.5 font-mono text-xs text-mute">{r.id}</span>
                <span className="min-w-0 flex-1 basis-48 font-medium">{rule?.title ?? r.id}</span>
                {change && (
                  <span className={`chip ${change === 'up' ? 'chip-C' : 'chip-N'}`} title="Respecto de la verificación anterior">
                    <Icon name={change === 'up' ? 'trendUp' : 'trendDown'} className="h-3.5 w-3.5" />
                    {change === 'up' ? 'Mejoró' : 'Empeoró'}
                  </span>
                )}
                <RuleChip status={r.status} />
              </summary>
              <div className="grid gap-4 px-4 pb-4 pt-1 text-sm sm:pl-[5.75rem]">
                <div>
                  <p className="eyebrow">Evidencia</p>
                  <p className="mt-1 rounded bg-neutral px-3 py-2 font-mono text-xs leading-5">{r.evidence}</p>
                </div>
                {(r.status === 'N' || r.status === 'P') && rule?.fix && (
                  <div>
                    <p className="eyebrow">Qué corregir</p>
                    <p className="mt-1">{rule.fix}</p>
                  </div>
                )}
                <div>
                  <p className="eyebrow">Referencia normativa</p>
                  <p className="mt-1 text-mute">
                    {rule?.legalRef ?? 'Ley N.º 21.719'} · {categoryById.get(rule?.category)?.label}
                  </p>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
