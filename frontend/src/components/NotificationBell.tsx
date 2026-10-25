import { useEffect, useRef, useState } from "react";
import { AlarmClock, Bell, BellOff, Megaphone, MapPin, Siren, X, type LucideIcon } from "lucide-react";
import { useNotificationList, useNotifications } from "../lib/notifications";
import { fmtTime } from "../lib/format";

const KIND: Record<string, { icon: LucideIcon; tone: string; label: string }> = {
  ARRIVAL: { icon: MapPin, tone: "bg-brand-50 text-brand-600 dark:bg-brand-900/50 dark:text-brand-300", label: "Arrival" },
  DELAY: { icon: AlarmClock, tone: "bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300", label: "Delay" },
  ANNOUNCEMENT: { icon: Megaphone, tone: "bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300", label: "Announcement" },
  SOS: { icon: Siren, tone: "bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-300", label: "SOS" },
};
const kind = (type: string) => KIND[type] ?? KIND.ANNOUNCEMENT;

function KindIcon({ type }: { type: string }) {
  const k = kind(type);
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${k.tone}`}>
      <k.icon className="h-4 w-4" aria-hidden />
    </span>
  );
}

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
      <button className="icon-btn btn-subtle relative" aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-slate-900">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="card fixed inset-x-3 top-16 max-h-[70vh] overflow-auto p-0 shadow-float sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96"
          role="dialog" aria-label="Notifications">
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-200/80 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="card-title">Notifications</p>
            <button className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300" onClick={markAllRead}>Mark all read</button>
          </div>
          {list.data?.items.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.data.items.map((n) => (
                <li key={n.id} className="flex gap-3 px-4 py-3">
                  <KindIcon type={n.type} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${n.is_read ? "text-slate-500 dark:text-slate-400" : "text-slate-800 dark:text-slate-100"}`}>{n.message}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{kind(n.type).label} · {fmtTime(n.created_at)}</p>
                  </div>
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <BellOff className="h-6 w-6 text-slate-400" aria-hidden />
              <p className="mt-2 muted">No notifications yet. Set an alert from a bus page.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useNotifications();
  return (
    <div className="fixed bottom-20 right-3 z-[2000] flex w-96 max-w-[calc(100vw-1.5rem)] flex-col gap-2 lg:bottom-6 lg:right-6" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} role="status" className="card flex items-start gap-3 p-4 shadow-float">
          <KindIcon type={t.type} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{kind(t.type).label}</p>
            <p className="mt-0.5 text-sm">{t.message}</p>
          </div>
          <button aria-label="Dismiss notification" className="icon-btn btn-subtle -mr-1 -mt-1 h-7 w-7" onClick={() => dismissToast(t.id)}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
