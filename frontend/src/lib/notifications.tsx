import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post, tokenStore, WS_URL } from "./api";
import { useAuth } from "./auth";
import type { Notification, Page } from "./types";

interface NotificationState {
  unread: number;
  toasts: Notification[];
  dismissToast: (id: number) => void;
  markAllRead: () => Promise<void>;
}

const Ctx = createContext<NotificationState | null>(null);

/** Listens on /ws/notifications and turns pushed alerts into toasts + an unread count. */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [toasts, setToasts] = useState<Notification[]>([]);

  const unreadQ = useQuery({
    queryKey: ["unread"],
    queryFn: () => api<{ unread: number }>("/notifications/unread-count"),
    enabled: !!user,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!user) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let timer: number | undefined;
    const connect = () => {
      const token = tokenStore.get();
      if (!token) return;
      ws = new WebSocket(`${WS_URL}/ws/notifications?token=${encodeURIComponent(token)}`);
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type !== "notification") return;
        const n: Notification = msg.notification;
        setToasts((t) => [n, ...t].slice(0, 4));
        qc.invalidateQueries({ queryKey: ["unread"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
        if (n.type === "SOS") qc.invalidateQueries({ queryKey: ["sos"] });
        window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), 12000);
      };
      ws.onclose = () => {
        if (!closed) timer = window.setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      closed = true;
      window.clearTimeout(timer);
      ws?.close();
    };
  }, [user, qc]);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const markAllRead = useCallback(async () => {
    await post("/notifications/read-all");
    qc.invalidateQueries({ queryKey: ["unread"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }, [qc]);

  return (
    <Ctx.Provider value={{ unread: unreadQ.data?.unread ?? 0, toasts, dismissToast, markAllRead }}>
      {children}
    </Ctx.Provider>
  );
}

export function useNotifications() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useNotifications outside provider");
  return c;
}

export function useNotificationList(enabled: boolean) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<Page<Notification>>("/notifications?size=20"),
    enabled,
  });
}
