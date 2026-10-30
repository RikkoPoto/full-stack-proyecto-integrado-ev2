import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/index.js';

const CatalogContext = createContext(null);

/** Carga una sola vez el catálogo de reglas y categorías (GET /api/rules). */
export function CatalogProvider({ children }) {
  const [state, setState] = useState({ catalog: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      setState({ catalog: await api.getCatalog(), loading: false, error: null });
    } catch (error) {
      setState({ catalog: null, loading: false, error });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo(() => {
    const { catalog } = state;
    return {
      ...state,
      reload: load,
      ruleById: new Map((catalog?.rules ?? []).map((r) => [r.id, r])),
      categoryById: new Map((catalog?.categories ?? []).map((c) => [c.id, c])),
    };
  }, [state, load]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export const useCatalog = () => useContext(CatalogContext);
