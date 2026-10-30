import { Link, useLocation } from 'react-router-dom';
import { useActiveScan } from '../../context/ActiveScanProvider.jsx';
import { hostOf } from '../../lib/format.js';

/** Acceso rápido a la verificación en curso, visible desde cualquier otra pantalla. */
export default function ActiveScanPill() {
  const { active, percent } = useActiveScan();
  const { pathname } = useLocation();
  if (!active || pathname.includes(active.id)) return null; // ya la está viendo
  return (
    <Link
      to={`/verificaciones/${active.id}`}
      className="flex max-w-[16rem] items-center gap-2 rounded-full border border-line bg-accent-soft px-3 py-1 text-xs font-semibold text-accent hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent motion-reduce:animate-none" aria-hidden="true" />
      <span className="truncate font-mono">{hostOf(active.url)}</span>
      <span className="tabular-nums">{percent}%</span>
      <span className="sr-only">verificación en curso</span>
    </Link>
  );
}
