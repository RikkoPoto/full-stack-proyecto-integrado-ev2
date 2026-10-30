import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/index.js';
import { SCOPE_OPTIONS } from '../domain/constants.js';
import { useActiveScan } from '../context/ActiveScanProvider.jsx';
import { useCatalog } from '../context/CatalogProvider.jsx';
import { useDocumentTitle } from '../hooks/useMisc.js';
import { useAsync } from '../hooks/useAsync.js';
import { formatDateTime, hostOf } from '../lib/format.js';
import { normalizeUrl } from '../lib/url.js';
import { ClassChip, ScanChip } from '../components/ui/Chips.jsx';
import { Skeleton } from '../components/ui/States.jsx';
import Icon from '../components/ui/Icon.jsx';

const COMMITMENTS = [
  'Solo se guarda la dirección, la fecha y hora, y los resultados de cada verificación.',
  'No se pide cuenta ni datos personales para ejecutar un escaneo.',
  'El análisis lee solo contenido público: no envía formularios ni inicia sesión.',
  'No existen reglas sin referencia a la norma.',
];

export default function HomePage() {
  useDocumentTitle('Inicio');
  const navigate = useNavigate();
  const { track } = useActiveScan();
  const { catalog, loading: catalogLoading } = useCatalog();
  const recent = useAsync(() => api.listScans({ pageSize: 4 }), []);

  const [value, setValue] = useState('');
  const [scope, setScope] = useState(10);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const result = normalizeUrl(value);
    if (result.error) {
      setError(result.error);
      document.getElementById('url')?.focus();
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const scan = await api.createScan({ url: result.url, scope });
      track(scan);
      navigate(`/verificaciones/${scan.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="max-w-2xl">
        <p className="eyebrow">Ley N.º 21.719 · Protección de datos personales</p>
        <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl" style={{ textWrap: 'balance' }}>
          Revisa si un sitio web cumple la Ley 21.719
        </h1>
        <p className="mt-3 text-mute">
          Ingresa la dirección de un sitio. El sistema revisa su política de privacidad, el consentimiento y los canales para ejercer derechos, y entrega un informe que puedes exportar.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="panel mt-8 p-4 sm:p-6">
        <label htmlFor="url" className="block text-sm font-semibold">Dirección del sitio</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="url" name="url" type="text" inputMode="url" autoComplete="off" spellCheck={false} autoFocus
            placeholder="https://www.ejemplo.cl" value={value}
            onChange={(e) => { setValue(e.target.value); if (error) setError(''); }}
            aria-invalid={Boolean(error)} aria-describedby={error ? 'url-error' : 'url-help'}
            className={`field min-w-0 flex-1 font-mono ${error ? 'border-bad' : ''}`}
          />
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Iniciando…' : 'Iniciar verificación'}
            {!submitting && <Icon name="arrowRight" className="h-4 w-4" />}
          </button>
        </div>
        {error ? (
          <p id="url-error" role="alert" className="mt-2 text-sm font-medium text-bad">{error}</p>
        ) : (
          <p id="url-help" className="mt-2 text-sm text-mute">Puedes pegar la dirección con o sin https://.</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-4">
          <div className="flex items-center gap-2">
            <label htmlFor="scope" className="text-sm text-mute">Alcance</label>
            <select id="scope" value={scope} onChange={(e) => setScope(Number(e.target.value))} className="field py-1.5">
              {SCOPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </form>

      <section className="mt-12" aria-labelledby="que-se-revisa">
        <h2 id="que-se-revisa" className="font-display text-xl font-bold tracking-tight">Qué se revisa</h2>
        <p className="mt-1 text-sm text-mute">Cada regla viene de un criterio de la Ley 21.719 y su reglamento.</p>
        <div className="mt-5 grid gap-8 md:grid-cols-3">
          {catalogLoading || !catalog
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)
            : catalog.categories.map((c) => {
                const rules = catalog.rules.filter((r) => r.category === c.id);
                return (
                  <div key={c.id} className="min-w-0 border-t border-line pt-4">
                    <p className="eyebrow">{rules.length} reglas</p>
                    <h3 className="mt-1 font-display text-base font-bold tracking-tight">{c.label}</h3>
                    <ul className="mt-3 space-y-1.5 text-sm text-mute">
                      {rules.map((r) => <li key={r.id}>{r.title}</li>)}
                    </ul>
                  </div>
                );
              })}
        </div>
      </section>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <section className="panel min-w-0 p-5" aria-labelledby="privacidad-diseno">
          <p className="eyebrow">Compromisos de diseño</p>
          <h2 id="privacidad-diseno" className="mt-2 font-display text-lg font-bold tracking-tight">Privacidad desde el diseño</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {COMMITMENTS.map((c) => (
              <li key={c} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                {c}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel min-w-0 p-5" aria-labelledby="ultimas">
          <div className="flex items-center justify-between gap-3">
            <h2 id="ultimas" className="font-display text-lg font-bold tracking-tight">Últimas verificaciones</h2>
            <Link to="/historial" className="text-sm font-medium text-accent hover:underline">Ver historial</Link>
          </div>
          {recent.loading && <div className="mt-3 space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>}
          {recent.error && <p className="mt-3 text-sm text-bad">No se pudo cargar el historial.</p>}
          {recent.data && recent.data.items.length === 0 && <p className="mt-3 text-sm text-mute">Aún no hay verificaciones.</p>}
          {recent.data && (
            <ul className="mt-3 divide-y divide-line">
              {recent.data.items.map((s) => (
                <li key={s.id}>
                  <Link
                    to={s.status === 'done' ? `/verificaciones/${s.id}/informe` : `/verificaciones/${s.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 hover:bg-neutral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm">{hostOf(s.url)}</p>
                      <p className="font-mono text-xs tabular-nums text-mute">{formatDateTime(s.startedAt)}</p>
                    </div>
                    {s.score != null ? (
                      <span className="flex items-center gap-2"><span className="font-display font-bold tabular-nums">{s.score}%</span><ClassChip classification={s.classification} /></span>
                    ) : (
                      <ScanChip status={s.status} />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
