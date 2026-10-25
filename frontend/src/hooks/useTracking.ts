import { useEffect, useRef, useState } from "react";
import { api, tokenStore, WS_URL } from "../lib/api";
import type { BusLocation } from "../lib/types";

/**
 * Live bus positions from /ws/tracking. Reconnects with back-off, and falls back to
 * polling GET /buses/live every 4 s while the socket is down.
 */
export function useTracking() {
  const [buses, setBuses] = useState<Record<number, BusLocation>>({});
  const [connected, setConnected] = useState(false);
  const retry = useRef(0);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let reconnectTimer: number | undefined;

    const apply = (list: BusLocation[]) =>
      setBuses(Object.fromEntries(list.map((b) => [b.bus_id, b])));

    const connect = () => {
      const token = tokenStore.get();
      if (!token) return;
      ws = new WebSocket(`${WS_URL}/ws/tracking?token=${encodeURIComponent(token)}`);
      ws.onopen = () => {
        retry.current = 0;
        setConnected(true);
      };
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === "positions") apply(msg.buses);
      };
      ws.onclose = () => {
        setConnected(false);
        if (closed) return;
        const delay = Math.min(10000, 1000 * 2 ** retry.current++);
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };
    connect();

    const poll = window.setInterval(() => {
      if (ws?.readyState !== WebSocket.OPEN) api<BusLocation[]>("/buses/live").then(apply).catch(() => {});
    }, 4000);

    return () => {
      closed = true;
      window.clearTimeout(reconnectTimer);
      window.clearInterval(poll);
      ws?.close();
    };
  }, []);

  return { buses, connected };
}
