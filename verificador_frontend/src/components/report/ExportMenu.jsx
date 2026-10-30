import { useState } from 'react';
import { api } from '../../api/index.js';
import { downloadBlob } from '../../lib/exporters.js';
import { useToast } from '../../context/ToastProvider.jsx';
import Icon from '../ui/Icon.jsx';

export default function ExportMenu({ scan }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(null);

  async function exportAs(format) {
    setBusy(format);
    try {
      const { blob, filename } = await api.exportReport(scan.id, format);
      downloadBlob(blob, filename);
      toast({ tone: 'success', message: `Informe exportado en ${format.toUpperCase()}.` });
    } catch (err) {
      toast({ tone: 'error', message: err.message });
    } finally {
      setBusy(null);
    }
  }

  // Con backend real el PDF lo genera el servidor; en simulación se usa la impresión del navegador.
  const pdf = () => (api.capabilities.serverPdf ? exportAs('pdf') : window.print());

  const buttons = [
    ['PDF', pdf, busy === 'pdf'],
    ['CSV', () => exportAs('csv'), busy === 'csv'],
    ['JSON', () => exportAs('json'), busy === 'json'],
  ];

  return (
    <div className="flex flex-wrap gap-2 print:hidden" role="group" aria-label="Exportar informe">
      {buttons.map(([label, fn, loading]) => (
        <button key={label} type="button" onClick={fn} disabled={Boolean(busy)} className="btn btn-ghost btn-sm">
          <Icon name="download" className="h-4 w-4" />
          {loading ? 'Generando…' : `Exportar ${label}`}
        </button>
      ))}
    </div>
  );
}
