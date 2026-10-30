import { CLASSIFICATION } from '../../domain/constants.js';

export default function ScoreRing({ pct, classification }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const dash = ((pct ?? 0) / 100) * C;
  const stroke = CLASSIFICATION[classification]?.stroke ?? 'var(--mute)';

  return (
    <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0" role="img" aria-label={pct != null ? `Cumplimiento ${pct} por ciento` : 'Sin puntaje'}>
      <circle cx="60" cy="60" r={R} fill="none" stroke="var(--neutral)" strokeWidth="12" />
      <circle
        cx="60" cy="60" r={R} fill="none" stroke={stroke} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${dash.toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dasharray .6s ease' }}
      />
      <text x="60" y="68" textAnchor="middle" fontSize="28" fontWeight="700" fill="var(--ink)" fontFamily="'Schibsted Grotesk Variable', system-ui, sans-serif">
        {pct != null ? `${pct}%` : '—'}
      </text>
    </svg>
  );
}
