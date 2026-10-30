import { useCallback, useEffect, useRef, useState } from 'react';

/** Ejecuta una función asíncrona al montar (y cuando cambian las dependencias) y guarda su estado. */
export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const run = useRef(0);

  const execute = useCallback(() => {
    const ticket = ++run.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => ticket === run.current && setState({ data, error: null, loading: false }),
      (error) => ticket === run.current && setState({ data: null, error, loading: false }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    execute();
    return () => {
      run.current++;
    };
  }, [execute]);

  return { ...state, reload: execute };
}
