import Icon from './Icon.jsx';

export default function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
      <p className="text-mute tabular-nums">
        {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <Icon name="arrowLeft" className="h-4 w-4" /> Anterior
        </button>
        <span className="tabular-nums text-mute">Página {page} de {pages}</span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Siguiente <Icon name="arrowRight" className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
