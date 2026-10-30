import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/index.js';
import { PAGE_SIZE } from '../config.js';
import { SCAN_STATUS } from '../domain/constants.js';
import { useActiveScan } from '../context/ActiveScanProvider.jsx';
import { useToast } from '../context/ToastProvider.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useDebounced, useDocumentTitle } from '../hooks/useMisc.js';
import { hostOf } from '../lib/format.js';
import HistoryTable from '../components/history/HistoryTable.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States.jsx';

export default function HistoryPage() {
  useDocumentTitle('Historial');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { track } = useActiveScan();
  const [params, setParams] = useSearchParams();

  // Los filtros viven en la URL: se pueden compartir y sobreviven al recargar.
  const status = params.get('estado') ?? '';
  const page = Number(params.get('pagina')) || 1;
  const [text, setText] = useState(params.get('q') ?? '');
  const q = useDebounced(text.trim(), 300);

  useEffect(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (q) next.set('q', q); else next.delete('q');
        if ((prev.get('q') ?? '') !== q) next.delete('pagina');
        return next;
      },
      { replace: true },
    );
  }, [q, setParams]);

  const setParam = (key, value) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      if (key !== 'pagina') next.delete('pagina');
      return next;
    });

  const { data, error, loading, reload } = useAsync(() => api.listScans({ q, status, page, pageSize: PAGE_SIZE }), [q, status, page]);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  async function retry(scan) {
    try {
      await api.retryScan(scan.id);
      track(scan);
      navigate(`/verificaciones/${scan.id}`);
    } catch (err) {
      toast({ tone: 'error', message: err.message });
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await api.deleteScan(toDelete.id);
      toast({ tone: 'success', message: 'Verificación eliminada.' });
      setToDelete(null);
      if (data.items.length === 1 && page > 1) setParam('pagina', String(page - 1));
      else reload();
    } catch (err) {
      toast({ tone: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  }

  const hasFilters = Boolean(q || status);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Historial de verificaciones</h1>
          <p className="mt-1 text-sm text-mute">Cada verificación guarda la fecha y hora de ejecución, el sitio y el resultado.</p>
        </div>
        <Link to="/" className="btn btn-primary">Nueva verificación</Link>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="hist-q" className="sr-only">Buscar por sitio</label>
          <input id="hist-q" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar por sitio" autoComplete="off" className="field w-full font-mono" />
        </div>
        <div>
          <label htmlFor="hist-status" className="sr-only">Filtrar por estado</label>
          <select id="hist-status" value={status} onChange={(e) => setParam('estado', e.target.value)} className="field w-full sm:w-auto">
            <option value="">Todos los estados</option>
            {Object.entries(SCAN_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading && !data ? (
          <div className="panel space-y-3 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        ) : data.items.length === 0 ? (
          hasFilters ? (
            <EmptyState title="Sin resultados" action={<button type="button" className="btn btn-ghost" onClick={() => { setText(''); setParams({}); }}>Limpiar filtros</button>}>
              Ninguna verificación coincide con el filtro.
            </EmptyState>
          ) : (
            <EmptyState title="Aún no hay verificaciones" action={<Link to="/" className="btn btn-primary">Iniciar la primera</Link>}>
              Cuando ejecutes un escaneo, quedará registrado aquí.
            </EmptyState>
          )
        ) : (
          <div className={`panel overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
            <HistoryTable items={data.items} onRetry={retry} onDelete={setToDelete} />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(p) => setParam('pagina', String(p))} />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="¿Eliminar esta verificación?"
        confirmLabel="Eliminar"
        danger
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      >
        Se eliminará el registro de <span className="font-mono">{toDelete && hostOf(toDelete.url)}</span> y su informe. Esta acción no se puede deshacer.
      </ConfirmDialog>
    </div>
  );
}
