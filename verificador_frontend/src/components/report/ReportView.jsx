import { Link } from 'react-router-dom';
import { CLASSIFICATION, THRESHOLDS, scopeText } from '../../domain/constants.js';
import { calcScore } from '../../domain/scoring.js';
import { formatDateTime, formatDuration, formatNumber } from '../../lib/format.js';
import { useCatalog } from '../../context/CatalogProvider.jsx';
import Icon from '../ui/Icon.jsx';
import ExportMenu from './ExportMenu.jsx';
import RuleList from './RuleList.jsx';
import ScoreRing from './ScoreRing.jsx';

const SCALE = [
  ['bajo', `menos de ${THRESHOLDS.parcial}`],
  ['parcial', `${THRESHOLDS.parcial} a ${THRESHOLDS.alto - 1}`],
  ['alto', `${THRESHOLDS.alto} o más`],
];

export default function ReportView({ scan, previous, changes, onRescan, busy }) {
  const { catalog } = useCatalog();
  const result = calcScore(scan.rules, catalog.rules);
  const pct = scan.score ?? result.pct;
  const cls = scan.classification ?? result.classification;

  return (
    <div>
      <Link to="/historial" className="text-sm font-medium text-accent hover:underline print:hidden">← Historial</Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Informe de verificación</p>
          <h1 className="mt-1 break-all font-mono text-xl font-medium sm:text-2xl">{scan.url}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button type="button" onClick={onRescan} disabled={busy} className="btn btn-primary btn-sm">
            <Icon name="refresh" className="h-4 w-4" /> Volver a verificar
          </button>
        </div>
      </div>

      <div className="mt-4 print:hidden">
        <ExportMenu scan={scan} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <div><dt className="eyebrow">Fecha y hora</dt><dd className="mt-0.5 font-mono tabular-nums">{formatDateTime(scan.startedAt)}</dd></div>
        <div><dt className="eyebrow">Identificador</dt><dd className="mt-0.5 break-all font-mono">{scan.id}</dd></div>
        <div><dt className="eyebrow">Alcance</dt><dd className="mt-0.5">{scopeText(scan.scope)}</dd></div>
        <div><dt className="eyebrow">Duración</dt><dd className="mt-0.5 tabular-nums">{formatDuration(scan.startedAt, scan.finishedAt)}</dd></div>
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="panel p-5" aria-label="Nivel de cumplimiento">
          <p className="eyebrow">Nivel de cumplimiento</p>
          <div className="mt-3 flex flex-wrap items-center gap-5">
            <ScoreRing pct={pct} classification={cls} />
            <div>
              <p className="font-display text-2xl font-bold tracking-tight">{CLASSIFICATION[cls]?.label ?? '—'}</p>
              <p className="mt-0.5 text-sm text-mute">{formatNumber(result.points)} de {result.evaluated} puntos</p>
              <p className="mt-0.5 text-sm text-mute">{result.evaluated} de {result.total} reglas evaluadas</p>
              {changes?.scoreDelta != null && changes.scoreDelta !== 0 && (
                <p className={`mt-2 inline-flex items-center gap-1 text-sm font-semibold ${changes.scoreDelta > 0 ? 'text-ok' : 'text-bad'}`}>
                  <Icon name={changes.scoreDelta > 0 ? 'trendUp' : 'trendDown'} className="h-4 w-4" />
                  {changes.scoreDelta > 0 ? '+' : ''}{changes.scoreDelta} puntos vs. {formatDateTime(previous.startedAt)}
                </p>
              )}
            </div>
          </div>
          <ul className="mt-5 space-y-2 border-t border-line pt-4">
            {SCALE.map(([key, range]) => {
              const on = key === cls;
              return (
                <li key={key} className={`flex items-center gap-2 text-sm ${on ? 'font-semibold' : 'text-mute'}`}>
                  <span className={`chip ${CLASSIFICATION[key].chip} ${on ? '' : 'opacity-60'}`}>{CLASSIFICATION[key].label}</span>
                  {range}
                  {on && <span className="sr-only"> (resultado actual)</span>}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel p-5" aria-label="Resultado por categoría">
          <p className="eyebrow">Resultado por categoría</p>
          <ul className="mt-4 space-y-5">
            {catalog.categories.map((c) => {
              const b = result.byCategory[c.id] ?? { points: 0, evaluated: 0 };
              const ratio = b.evaluated ? b.points / b.evaluated : 0;
              const tone = ratio >= 0.85 ? 'bg-ok' : ratio >= 0.5 ? 'bg-warn' : 'bg-bad';
              return (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{c.label}</span>
                    <span className="font-mono text-xs tabular-nums text-mute">{formatNumber(b.points)} de {b.evaluated} puntos</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral">
                    <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 grid grid-cols-4 gap-2 border-t border-line pt-4 text-center">
            {[['C', 'Cumplen', 'text-ok'], ['P', 'Parciales', 'text-warn'], ['N', 'No cumplen', 'text-bad'], ['E', 'No evaluables', 'text-mute']].map(([k, label, tone]) => (
              <div key={k}>
                <p className={`font-display text-2xl font-bold tabular-nums ${tone}`}>{result.counts[k]}</p>
                <p className="text-xs text-mute">{label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {changes && (
        <p className="mt-4 text-sm text-mute" data-testid="comparison">
          {changes.improved.length > 0 || changes.worsened.length > 0 ? (
            <>
              Comparado con la verificación anterior de este sitio ({formatDateTime(previous.startedAt)}):{' '}
              <span className="font-semibold text-ok">{changes.improved.length} reglas mejoraron</span> y{' '}
              <span className="font-semibold text-bad">{changes.worsened.length} empeoraron</span>.
            </>
          ) : (
            <>Sin cambios en las reglas respecto de la verificación anterior de este sitio ({formatDateTime(previous.startedAt)}).</>
          )}
        </p>
      )}

      <RuleList rules={scan.rules} changes={changes} />

      <p className="mt-8 text-xs text-mute">
        Informe generado automáticamente a partir de reglas predefinidas. Sirve como apoyo a la revisión y no reemplaza una auditoría ni asesoría legal.
      </p>
    </div>
  );
}
