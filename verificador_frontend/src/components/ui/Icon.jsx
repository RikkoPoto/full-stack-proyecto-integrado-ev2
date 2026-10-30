const PATHS = {
  shield: ['M12 3 4.5 6v5.5c0 4.5 3.1 8.2 7.5 9.5 4.4-1.3 7.5-5 7.5-9.5V6L12 3Z', 'm8.8 12 2.4 2.4 4.2-4.6'],
  check: ['M5 13l4 4L19 7'],
  x: ['M6 6l12 12M18 6L6 18'],
  alert: ['M12 9v4m0 4h.01', 'M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z'],
  chevron: ['m7.5 4.5 5.5 5.5-5.5 5.5'],
  chevronDown: ['m6 9 6 6 6-6'],
  arrowRight: ['M5 12h14m-6-6 6 6-6 6'],
  arrowLeft: ['M19 12H5m6-6-6 6 6 6'],
  download: ['M12 4v12m0 0-4-4m4 4 4-4M4 20h16'],
  refresh: ['M4 4v5h5M20 20v-5h-5', 'M5.6 15A8 8 0 0 0 18.4 17M18.4 9A8 8 0 0 0 5.6 7'],
  trash: ['M4 7h16M10 11v6M14 11v6', 'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3'],
  search: ['m21 21-4.3-4.3', 'M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z'],
  sun: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z'],
  monitor: ['M3 5h18v11H3z', 'M8 20h8m-4-4v4'],
  stop: ['M7 7h10v10H7z'],
  plus: ['M12 5v14M5 12h14'],
  external: ['M14 4h6v6m0-6L10 14', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  trendUp: ['m3 17 6-6 4 4 8-8', 'M15 7h6v6'],
  trendDown: ['m3 7 6 6 4-4 8 8', 'M15 17h6v-6'],
  flask: ['M9 3h6M10 3v6L4.5 18.5A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3'],
};

export default function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
