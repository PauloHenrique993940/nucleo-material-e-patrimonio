import { useEffect, useId, useRef, type ReactNode } from 'react';
import { PanelsTopLeft, X } from 'lucide-react';
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const node = ref.current!;
    const previous = document.activeElement as HTMLElement;
    node.showModal();
    return () => {
      node.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      className={`app-modal${wide ? ' app-modal-wide' : ''}`}
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby={titleId}
    >
      <div className="dialog-heading">
        <span className="dialog-icon" aria-hidden="true">
          <PanelsTopLeft size={22} />
        </span>
        <h2 id={titleId}>{title}</h2>
        <button type="button" onClick={onClose} aria-label="Fechar janela">
          <X size={20} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
