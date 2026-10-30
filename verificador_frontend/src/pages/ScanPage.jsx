import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/index.js';
import { useActiveScan } from '../context/ActiveScanProvider.jsx';
import { useToast } from '../context/ToastProvider.jsx';
import { useScanStream } from '../hooks/useScanStream.js';
import { useDocumentTitle } from '../hooks/useMisc.js';
import { hostOf } from '../lib/format.js';
import ScanLive from '../components/scan/ScanLive.jsx';
import { ErrorState, PageLoading } from '../components/ui/States.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';

export default function ScanPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { track } = useActiveScan();
  const { scan, error, loading, reconnect } = useScanStream(id);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useDocumentTitle(scan ? `Verificando ${hostOf(scan.url)}` : 'Verificación');

  async function run(action, after) {
    setBusy(true);
    try {
      await action();
      after?.();
    } catch (err) {
      toast({ tone: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  }

  const handleRetry = () =>
    run(() => api.retryScan(id), () => {
      track(scan);
      reconnect();
    });

  const handleCancel = () => {
    setConfirmCancel(false);
    run(() => api.cancelScan(id));
  };

  if (loading) return <PageLoading label="Cargando verificación…" />;
  if (error && !scan) {
    return (
      <div className="space-y-4">
        <ErrorState error={error} onRetry={reconnect} title={error.status === 404 ? 'No encontramos esta verificación' : undefined} />
        <p className="text-center"><Link to="/historial" className="text-sm font-medium text-accent hover:underline">Ir al historial</Link></p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 rounded-md border border-warn bg-warn-soft px-4 py-2 text-sm font-medium text-warn">
          Se perdió la conexión con el servidor. Reintentando…
        </p>
      )}
      <ScanLive
        scan={scan}
        busy={busy}
        onCancel={() => setConfirmCancel(true)}
        onRetry={handleRetry}
        onViewReport={() => navigate(`/verificaciones/${scan.id}/informe`)}
      />
      <ConfirmDialog
        open={confirmCancel}
        title="¿Cancelar el escaneo?"
        confirmLabel="Cancelar escaneo"
        danger
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      >
        El avance se conserva y podrás reintentarlo después: continuará desde el último paso.
      </ConfirmDialog>
    </>
  );
}
