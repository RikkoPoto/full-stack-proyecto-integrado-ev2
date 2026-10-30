const TZ = 'America/Santiago';

const dateTime = new Intl.DateTimeFormat('es-CL', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const clock = new Intl.DateTimeFormat('es-CL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

const parts = (fmt, d) => Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));

/** 28-10-2026 14:05 (hora de Chile) */
export function formatDateTime(iso) {
  if (!iso) return '—';
  const p = parts(dateTime, new Date(iso));
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
}

export function formatClock(iso) {
  if (!iso) return '';
  const p = parts(clock, new Date(iso));
  return `${p.hour}:${p.minute}:${p.second}`;
}

export function formatDuration(startIso, endIso, nowMs = Date.now()) {
  if (!startIso) return '—';
  const end = endIso ? new Date(endIso).getTime() : nowMs;
  const total = Math.max(0, Math.round((end - new Date(startIso).getTime()) / 1000));
  const m = Math.floor(total / 60);
  return m > 0 ? `${m} min ${total % 60} s` : `${total} s`;
}

export const formatNumber = (n) => n.toLocaleString('es-CL', { maximumFractionDigits: 1 });

export function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
