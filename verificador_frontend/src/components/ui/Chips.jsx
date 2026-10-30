import { CLASSIFICATION, RULE_STATUS, SCAN_STATUS } from '../../domain/constants.js';

export function RuleChip({ status }) {
  const meta = RULE_STATUS[status];
  return <span className={`chip ${meta?.chip ?? 'chip-E'}`}>{meta?.label ?? status}</span>;
}

export function ScanChip({ status }) {
  const meta = SCAN_STATUS[status] ?? SCAN_STATUS.running;
  return (
    <span className={`chip ${meta.chip}`}>
      {status === 'running' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" aria-hidden="true" />}
      {meta.label}
    </span>
  );
}

export function ClassChip({ classification }) {
  const meta = CLASSIFICATION[classification];
  return meta ? <span className={`chip ${meta.chip}`}>{meta.label}</span> : null;
}
