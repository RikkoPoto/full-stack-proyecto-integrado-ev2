import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/ui/Icon.jsx';

const ToastContext = createContext(null);

const TONES = {
  info: 'border-line',
  success: 'border-ok',
  error: 'border-bad',
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    ({ message, tone = 'info', action, duration = 6000 }) => {
      const id = crypto.randomUUID();
      setItems((list) => [...list.slice(-2), { id, message, tone, action }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] print:hidden"
      >
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-md border bg-surface px-4 py-3 text-sm shadow-lg ${TONES[t.tone]}`}>
            <p className="min-w-0 flex-1 font-medium">{t.message}</p>
            {t.action && (
              <Link to={t.action.to} onClick={() => dismiss(t.id)} className="shrink-0 font-semibold text-accent hover:underline">
                {t.action.label}
              </Link>
            )}
            <button onClick={() => dismiss(t.id)} aria-label="Cerrar aviso" className="shrink-0 text-mute hover:text-ink">
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
