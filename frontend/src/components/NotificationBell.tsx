import { useEffect, useRef, useState } from "react";
import { useNotificationList, useNotifications } from "../lib/notifications";
import { fmtTime } from "../lib/format";

const icon: Record<string, string> = { ARRIVAL: "🚏", DELAY: "⏱️", ANNOUNCEMENT: "📢", SOS: "🆘" };

export function NotificationBell() {
  const { unread, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const list = useNotificationList(open);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative" aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open} onClick={() => setOpen(!open)}>
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{unread}</span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 mt-2 max-h-96 w-80 overflow-auto p-0" role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
            <strong className="text-sm">Notifications</strong>
            <button className="text-xs text-brand-600 underline dark:text-brand-100" onClick={markAllRead}>Mark all read</button>
          </div>
          {list.data?.items.length ? (
            <ul>
              {list.data.items.map((n) => (
                <li key={n.id} className={`border-b border-slate-100 px-3 py-2 text-sm dark:border-slate-700 ${n.is_read ? "opacity-70" : ""}`}>
                  <span aria-hidden>{icon[n.type] ?? "•"}</span> {n.message}
                  <div className="text-xs text-slate-500">{fmtTime(n.created_at)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-3 text-sm text-slate-500">No notifications yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useNotifications();
  return (
    <div className="fixed bottom-4 right-4 z-[2000] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} role="status"
          className={`card flex items-start gap-2 border-l-4 ${t.type === "DELAY" || t.type === "SOS" ? "border-l-red-500" : "border-l-brand-500"}`}>
          <span aria-hidden>{icon[t.type] ?? "•"}</span>
          <p className="flex-1 text-sm">{t.message}</p>
          <button aria-label="Dismiss notification" className="text-slate-500" onClick={() => dismissToast(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}
