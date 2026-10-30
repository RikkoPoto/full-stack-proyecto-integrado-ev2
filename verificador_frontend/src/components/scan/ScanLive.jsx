import { useEffect, useRef } from 'react';
import { canRetry, scopeText } from '../../domain/constants.js';
import { percentOf } from '../../domain/scanReducer.js';
import { STAGE_TEXT, buildStages } from '../../domain/stages.js';
import { formatClock, formatDateTime, formatDuration } from '../../lib/format.js';
import { useNow } from '../../hooks/useMisc.js';
import { useCatalog } from '../../context/CatalogProvider.jsx';
import { ScanChip, RuleChip } from '../ui/Chips.jsx';
import Icon from '../ui/Icon.jsx';

const LOG_TONE = {
  info: 'text-mute',
  ok: 'text-ok',
  warn: 'text-warn',
  fail: 'text-bad',
  na: 'text-mute',
  error: 'text-bad font-semibold',
};

function StageIcon({ state }) {
  if (state === 'done') return <Icon name="check" className="h-5 w-5 rounded-full bg-ok-soft p-1 text-ok" />;
  if (state === 'stalled') return <Icon name="x" className="h-5 w-5 rounded-full bg-bad-soft p-1 text-bad" />;
  if (state === 'active') {
    return <span className="block h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent motion-reduce:animate-none" aria-hidden="true" />;
  }
  return <span className="block h-5 w-5 rounded-full border-2 border-line" aria-hidden="true" />;
}

function stepText(scan, stages) {
  const current = stages.find((s) => s.state === 'active' || s.state === 'stalled');
  const n = Math.min(scan.step + 1, scan.total);
  if (scan.status === 'running') return `${current?.label ?? 'Finalizando'} · paso ${n} de ${scan.total}`;
  if (scan.status === 'done') return `Escaneo completado. ${scan.rules.length} reglas revisadas.`;
  const where = `El escaneo se detuvo en el paso ${n} de ${scan.total}. Al reintentar continúa desde ahí.`;
  return scan.status === 'cancelled' ? where.replace('se detuvo', 'se interrumpió') : where;
}

export default function ScanLive({ scan, busy, onCancel, onRetry, onViewReport }) {
  const { catalog, ruleById } = useCatalog();
  const now = useNow(scan.status === 'running');
  const logRef = useRef(null);
  const percent = percentOf(scan);
  const stages = buildStages(scan, catalog);
  const findings = scan.rules.filter((r) => r.status === 'N' || r.status === 'P');

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [scan.log.length]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Verificación {scan.id}</p>
          <h1 className="mt-1 break-all font-mono text-xl font-medium sm:text-2xl">{scan.url}</h1>
          <p className="mt-1 text-sm text-mute">
            Iniciada el {formatDateTime(scan.startedAt)} · alcance: {scopeText(scan.scope)}
            {scan.retries > 0 && ` · reintentos: ${scan.retries}`}
            {' · '}duración: <span className="tabular-nums">{formatDuration(scan.startedAt, scan.finishedAt, now)}</span>
          </p>
        </div>
        <ScanChip status={scan.status} />
      </div>

      <section className="panel mt-6 p-4 sm:p-6" aria-label="Avance">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-semibold">Avance</p>
          <p className="font-display text-3xl font-bold tabular-nums">{percent}%</p>
        </div>
        <div
          role="progressbar"
          aria-label="Avance del escaneo"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-neutral"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${scan.status === 'error' ? 'bg-bad' : 'bg-accent'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-mute">{stepText(scan, stages)}</p>

        {scan.status === 'error' && (
          <div role="alert" className="mt-4 rounded-md border border-bad bg-bad-soft p-3 text-sm font-medium text-bad">
            {scan.errorMessage}
            {scan.errorCode && <code className="ml-2 font-mono text-xs opacity-80">{scan.errorCode}</code>}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          {scan.status === 'running' && (
            <button type="button" onClick={onCancel} disabled={busy} className="btn btn-ghost">
              <Icon name="stop" className="h-4 w-4" /> Cancelar escaneo
            </button>
          )}
          {canRetry(scan.status) && (
            <button type="button" onClick={onRetry} disabled={busy} className="btn btn-primary">
              <Icon name="refresh" className="h-4 w-4" /> Reintentar escaneo
            </button>
          )}
          {scan.status === 'done' && (
            <button type="button" onClick={onViewReport} className="btn btn-primary">
              Ver informe <Icon name="arrowRight" className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <section className="panel p-4" aria-label="Etapas">
          <h2 className="text-sm font-semibold">Etapas</h2>
          <ol className="mt-3 space-y-3">
            {stages.map((g) => (
              <li key={g.id} className="flex items-center gap-3">
                <StageIcon state={g.state} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{g.label}</p>
                  <p className="text-xs text-mute">{STAGE_TEXT[g.state]}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel min-w-0" aria-label="Registro en vivo">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Registro en vivo</h2>
          </div>
          <ol ref={logRef} role="log" aria-live="polite" aria-label="Registro del escaneo" className="max-h-72 space-y-1 overflow-y-auto p-4 font-mono text-xs leading-5">
            {scan.log.length === 0 && <li className="text-mute">Esperando eventos…</li>}
            {scan.log.map((l, i) => (
              <li key={`${l.ts}-${i}`} className={`flex gap-3 ${LOG_TONE[l.level] ?? 'text-mute'}`}>
                <time dateTime={l.ts} className="shrink-0 tabular-nums text-mute">{formatClock(l.ts)}</time>
                <span className="min-w-0 break-words">{l.text}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="panel mt-6" aria-label="Incumplimientos detectados">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">Incumplimientos detectados</h2>
          <span className={`chip ${findings.length ? 'chip-N' : 'chip-E'}`}>{findings.length}</span>
        </div>
        {findings.length === 0 ? (
          <p className="px-4 py-5 text-sm text-mute">Todavía no se detecta ningún incumplimiento.</p>
        ) : (
          <ul className="divide-y divide-line">
            {findings.map((f) => (
              <li key={f.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3">
                <span className="w-14 shrink-0 pt-0.5 font-mono text-xs text-mute">{f.id}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{ruleById.get(f.id)?.title ?? f.id}</p>
                  <p className="mt-0.5 text-sm text-mute">{f.evidence}</p>
                </div>
                <RuleChip status={f.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
