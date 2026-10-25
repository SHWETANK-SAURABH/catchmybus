import { useEffect, useRef, type ReactNode } from "react";

/** Accessible modal dialog: focus moves inside, Escape closes, backdrop click closes. */
export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="modal-title"
        className="card w-full max-w-md outline-none" onClick={(e) => e.stopPropagation()}>
        <h2 id="modal-title" className="mb-3 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
