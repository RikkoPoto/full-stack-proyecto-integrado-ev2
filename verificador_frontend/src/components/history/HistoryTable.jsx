import { Link } from 'react-router-dom';
import { canRetry } from '../../domain/constants.js';
import { formatDateTime, hostOf } from '../../lib/format.js';
import { ClassChip, ScanChip } from '../ui/Chips.jsx';
import Icon from '../ui/Icon.jsx';

export default function HistoryTable({ items, onRetry, onDelete }) {
  return (
    <table className="w-full min-w-[46rem] text-left text-sm">
      <caption className="sr-only">Historial de verificaciones</caption>
      <thead>
        <tr className="text-xs uppercase tracking-wider text-mute">
          <th scope="col" className="px-4 py-3 font-medium">Fecha y hora</th>
          <th scope="col" className="px-4 py-3 font-medium">Sitio</th>
          <th scope="col" className="px-4 py-3 font-medium">Resultado</th>
          <th scope="col" className="px-4 py-3 font-medium">Estado</th>
          <th scope="col" className="px-4 py-3 text-right font-medium"><span className="sr-only">Acciones</span></th>
        </tr>
      </thead>
      <tbody>
        {items.map((s) => (
          <tr key={s.id} className="border-t border-line align-top">
            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-mute">{formatDateTime(s.startedAt)}</td>
            <td className="px-4 py-3">
              <p className="break-all font-mono text-sm">{hostOf(s.url)}</p>
              <p className="font-mono text-xs text-mute">{s.id}</p>
            </td>
            <td className="whitespace-nowrap px-4 py-3">
              {s.score != null ? (
                <>
                  <span className="font-display font-bold tabular-nums">{s.score}%</span> <span className="ml-1"><ClassChip classification={s.classification} /></span>
                </>
              ) : (
                <span className="text-mute">—</span>
              )}
            </td>
            <td className="px-4 py-3">
              <ScanChip status={s.status} />
              {s.errorMessage && <p className="mt-0.5 max-w-xs text-xs text-mute">{s.errorMessage}</p>}
            </td>
            <td className="px-4 py-3">
              <div className="flex justify-end gap-2">
                {s.status === 'done' && <Link to={`/verificaciones/${s.id}/informe`} className="btn btn-ghost btn-sm">Ver informe</Link>}
                {s.status === 'running' && <Link to={`/verificaciones/${s.id}`} className="btn btn-ghost btn-sm">Ver avance</Link>}
                {canRetry(s.status) && (
                  <>
                    <Link to={`/verificaciones/${s.id}`} className="btn btn-ghost btn-sm">Ver detalle</Link>
                    <button type="button" onClick={() => onRetry(s)} className="btn btn-ghost btn-sm">Reintentar</button>
                  </>
                )}
                <button type="button" onClick={() => onDelete(s)} aria-label={`Eliminar verificación de ${hostOf(s.url)}`} className="btn btn-ghost btn-sm px-2 text-mute hover:text-bad">
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
