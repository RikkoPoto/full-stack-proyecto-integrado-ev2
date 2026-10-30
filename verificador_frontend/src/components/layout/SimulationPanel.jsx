import { useState } from 'react';
import { USE_MOCK } from '../../config.js';
import { simulation } from '../../api/mock/mockApi.js';
import Icon from '../ui/Icon.jsx';

/** Herramientas de prueba, en el pie de página. Solo existe en modo simulación. */
export default function SimulationPanel() {
  const [open, setOpen] = useState(false);
  const [fail, setFail] = useState(simulation.failMidScan);
  if (!USE_MOCK) return null;

  return (
    <div className="relative print:hidden">
      {open && (
        <div className="panel absolute bottom-full right-0 z-40 mb-2 w-72 p-4 text-left text-sm shadow-lg">
          <p className="eyebrow">Modo simulación</p>
          <label className="mt-3 flex items-start gap-2">
            <input
              type="checkbox"
              checked={fail}
              onChange={(e) => {
                simulation.failMidScan = e.target.checked;
                setFail(e.target.checked);
              }}
              className="mt-1 h-4 w-4"
              style={{ accentColor: 'var(--accent)' }}
            />
            <span>Simular un error de conexión a mitad del próximo escaneo</span>
          </label>
          <p className="mt-3 text-xs text-mute">
            También falla cualquier dirección con «error» en el dominio. Recargar mientras corre un escaneo lo deja interrumpido.
          </p>
        </div>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1.5 rounded font-mono text-xs text-mute hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <Icon name="flask" className="h-3.5 w-3.5" /> Datos simulados · Simulación
      </button>
    </div>
  );
}
