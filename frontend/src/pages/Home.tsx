import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { RouteDetail } from "../lib/types";
import LiveMap from "../components/LiveMap";
import { useTracking } from "../hooks/useTracking";

export default function Home() {
  const { buses, connected } = useTracking();
  const routes = useQuery({ queryKey: ["routes-detail"], queryFn: () => api<RouteDetail[]>("/routes/all/detail") });

  return (
    <div className="relative h-[calc(100vh-57px)]">
      <LiveMap routes={routes.data ?? []} buses={Object.values(buses)} />
      <div className="absolute bottom-3 left-3 z-[500] rounded-md bg-white/90 px-2 py-1 text-xs shadow dark:bg-slate-800/90"
        role="status">
        {connected ? "● Live" : "○ Reconnecting…"} · {Object.keys(buses).length} buses
      </div>
    </div>
  );
}
