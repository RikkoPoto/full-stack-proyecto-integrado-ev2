import Icon from './Icon.jsx';

export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function PageLoading({ label = 'Cargando…' }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'No se pudo cargar la información' }) {
  return (
    <div role="alert" className="panel mx-auto max-w-xl border-bad p-8 text-center">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-bad-soft text-bad">
        <Icon name="alert" />
      </span>
      <h2 className="mt-3 font-display text-lg font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-mute">{error?.message ?? 'Ocurrió un error inesperado.'}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-ghost mt-5">
          <Icon name="refresh" className="h-4 w-4" /> Reintentar
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="panel mx-auto max-w-xl p-8 text-center">
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      {children && <p className="mt-2 text-sm text-mute">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
