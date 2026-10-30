import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import ActiveScanPill from './ActiveScanPill.jsx';
import SimulationPanel from './SimulationPanel.jsx';
import ThemeToggle from './ThemeToggle.jsx';

const NAV = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/historial', label: 'Historial' },
  { to: '/integracion', label: 'Integración' },
];

export default function AppShell() {
  const { pathname } = useLocation();
  const mainRef = useRef(null);

  // Al cambiar de pantalla: vuelve arriba y mueve el foco al contenido (importante para lectores de pantalla).
  useEffect(() => {
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg">
        Saltar al contenido
      </a>

      <header className="border-b border-line print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 pt-4">
          <Link to="/" className="flex items-center gap-2.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <Icon name="shield" className="h-6 w-6 text-accent" />
            <span className="font-display text-lg font-bold tracking-tight">Verificador 21.719</span>
          </Link>
          <div className="flex items-center gap-3">
            <ActiveScanPill />
            <ThemeToggle />
          </div>
        </div>
        <nav aria-label="Principal" className="mx-auto mt-3 flex max-w-6xl gap-1 overflow-x-auto">
          {NAV.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="navlink">
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="contenido" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 py-8 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-line py-5 text-xs text-mute print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <p>Herramienta de apoyo a la revisión. Los resultados no constituyen asesoría legal ni una auditoría formal.</p>
          <SimulationPanel />
        </div>
      </footer>
    </div>
  );
}
