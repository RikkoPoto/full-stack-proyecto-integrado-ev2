import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/index.js';
import { isFinal } from '../domain/constants.js';
import { percentOf } from '../domain/scanReducer.js';
import { hostOf } from '../lib/format.js';
import { useToast } from './ToastProvider.jsx';

const KEY = 'verificador.active';
const ActiveScanContext = createContext(null);

const read = () => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
};
const write = (value) => {
  try {
    if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento */
  }
};

/**
 * Recuerda la verificación que la persona inició en esta pestaña para mostrarla en el encabezado
 * mientras corre y avisar cuando termina, aunque haya navegado a otra pantalla.
 */
export function ActiveScanProvider({ children }) {
  const { toast } = useToast();
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const [active, setActive] = useState(read);
  const [percent, setPercent] = useState(0);

  const track = useCallback((scan) => {
    const value = { id: scan.id, url: scan.url };
    write(value);
    setPercent(0);
    setActive(value);
  }, []);

  const clear = useCallback(() => {
    write(null);
    setActive(null);
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    let stopped = false;

    const poll = async () => {
      try {
        const scan = await api.getScan(active.id);
        if (stopped) return;
        setPercent(percentOf(scan));
        if (!isFinal(scan.status)) return;
        clear();
        if (pathRef.current.includes(active.id)) return; // ya la está viendo
        const host = hostOf(scan.url);
        if (scan.status === 'done') {
          toast({ tone: 'success', message: `Verificación de ${host} completada: ${scan.score}% de cumplimiento.`, action: { label: 'Ver informe', to: `/verificaciones/${scan.id}/informe` } });
        } else if (scan.status === 'error') {
          toast({ tone: 'error', message: `La verificación de ${host} terminó con un error.`, action: { label: 'Ver detalle', to: `/verificaciones/${scan.id}` } });
        } else {
          clear();
        }
      } catch (err) {
        if (err.status === 404 && !stopped) clear();
      }
    };

    poll();
    const timer = setInterval(poll, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [active, clear, toast]);

  const value = useMemo(() => ({ active, percent, track, clear }), [active, percent, track, clear]);
  return <ActiveScanContext.Provider value={value}>{children}</ActiveScanContext.Provider>;
}

export const useActiveScan = () => useContext(ActiveScanContext);
