import { useEffect, useRef } from 'react';

export default function ConfirmDialog({ open, title, children, confirmLabel = 'Confirmar', danger = false, busy = false, onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => e.target === ref.current && onCancel()}
      aria-labelledby="confirm-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-md border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50"
    >
      <div className="p-6">
        <h2 id="confirm-title" className="font-display text-lg font-bold tracking-tight">{title}</h2>
        <div className="mt-2 text-sm text-mute">{children}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn btn-ghost" autoFocus>Volver</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
