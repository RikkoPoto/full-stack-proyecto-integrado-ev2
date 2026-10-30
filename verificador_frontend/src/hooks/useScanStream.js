import { useCallback, useEffect, useReducer, useState } from 'react';
import { api } from '../api/index.js';
import { applyEvent } from '../domain/scanReducer.js';

const initial = { scan: null, error: null, loading: true };

function reducer(state, action) {
  switch (action.type) {
    case 'snapshot':
      return { scan: action.scan, error: null, loading: false };
    case 'event':
      return state.scan ? { ...state, scan: applyEvent(state.scan, action.event) } : state;
    case 'error':
      return { ...state, error: action.error, loading: false };
    default:
      return state;
  }
}

/**
 * Mantiene una verificación sincronizada en tiempo real, sin perder eventos:
 * 1) se suscribe primero a los eventos (SSE) y los retiene,
 * 2) pide la "foto" completa (GET /scans/{id}),
 * 3) aplica sobre la foto los eventos retenidos y sigue aplicando los nuevos.
 * Como applyEvent es idempotente, un evento que ya venga incluido en la foto no se duplica.
 * reconnect() vuelve a empezar (se usa después de reintentar).
 */
export function useScanStream(id) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let ready = false;
    const buffer = [];

    const unsubscribe = api.subscribe(id, {
      onEvent: (event) => {
        if (cancelled) return;
        if (ready) dispatch({ type: 'event', event });
        else buffer.push(event);
      },
      onSnapshot: (scan) => !cancelled && dispatch({ type: 'snapshot', scan }),
      onError: (error) => !cancelled && dispatch({ type: 'error', error }),
    });

    api
      .getScan(id)
      .then((scan) => {
        if (cancelled) return;
        dispatch({ type: 'snapshot', scan });
        buffer.splice(0).forEach((event) => dispatch({ type: 'event', event }));
        ready = true;
        if (scan.status !== 'running') unsubscribe();
      })
      .catch((error) => {
        if (cancelled) return;
        unsubscribe();
        dispatch({ type: 'error', error });
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [id, epoch]);

  const reconnect = useCallback(() => setEpoch((n) => n + 1), []);
  return { ...state, reconnect };
}
