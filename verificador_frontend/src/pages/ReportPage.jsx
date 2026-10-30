import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/index.js';
import { compareScans } from '../domain/compare.js';
import { useActiveScan } from '../context/ActiveScanProvider.jsx';
import { useToast } from '../context/ToastProvider.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useDocumentTitle } from '../hooks/useMisc.js';
import { hostOf } from '../lib/format.js';
import ReportView from '../components/report/ReportView.jsx';
import { EmptyState, ErrorState, PageLoading } from '../components/ui/States.jsx';

async function loadReport(id) {
  const scan = await api.getScan(id);
  if (scan.status !== 'done') return { scan, previous: null };

  // Busca la verificación completada anterior del mismo sitio para mostrar la evolución.
  const host = hostOf(scan.url);
  const list = await api.listScans({ q: host, status: 'done', pageSize: 20 });
  const older = list.items
    .filter((s) => hostOf(s.url) === host && s.id !== scan.id && s.startedAt < scan.startedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const previous = older ? await api.getScan(older.id) : null;
  return { scan, previous };
}

export default function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { track } = useActiveScan();
  const { data, error, loading, reload } = useAsync(() => loadReport(id), [id]);
  const [busy, setBusy] = useState(false);

  useDocumentTitle(data ? `Informe de ${hostOf(data.scan.url)}` : 'Informe');

  async function rescan() {
    setBusy(true);
    try {
      const next = await api.createScan({ url: data.scan.url, scope: data.scan.scope });
      track(next);
      navigate(`/verificaciones/${next.id}`);
    } catch (err) {
      toast({ tone: 'error', message: err.message });
      setBusy(false);
    }
  }

  if (loading) return <PageLoading label="Cargando informe…" />;
  if (error) return <ErrorState error={error} onRetry={reload} title={error.status === 404 ? 'No encontramos este informe' : undefined} />;

  const { scan, previous } = data;
  if (scan.status === 'running') return <Navigate to={`/verificaciones/${scan.id}`} replace />;
  if (scan.status !== 'done') {
    return (
      <EmptyState
        title="Este escaneo no tiene informe"
        action={<Link to="/historial" className="btn btn-primary">Ir al historial</Link>}
      >
        Solo las verificaciones completadas generan un informe. Puedes reintentar desde el historial.
      </EmptyState>
    );
  }

  const changes = previous ? compareScans(scan, previous) : null;
  return <ReportView scan={scan} previous={previous} changes={changes} onRescan={rescan} busy={busy} />;
}
